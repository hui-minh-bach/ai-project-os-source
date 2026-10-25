'use strict';
const {fs,path,run,insist,mkdir,jsonRead,jsonWrite,sha,ffprobe,duration,within}=require('./utils.cjs');
const {illustration}=require('./images.cjs');
const subs=require('./subtitles.cjs');
function chapters(text){const normalized=String(text).replace(/\r\n/g,'\n').trim();insist(normalized.length>0,'Empty story');const parts=normalized.split(/(?=^\s*(?:Chương|CHƯƠNG|Chapter)\s+\d+[^\n]*$)/gmu).filter(x=>x.trim());return parts.length?parts.map((x,i)=>({number:i+1,text:x.trim()})):[{number:1,text:normalized}];}
function scenes(text,maxChars=420){
  const lines=text.trim().split(/(?<=[.!?…])\s+/u).filter(Boolean),out=[];let chunk='';
  for(const s of lines){if(chunk&&chunk.length+s.length+1>maxChars){out.push(chunk);chunk='';}if(s.length>maxChars){if(chunk){out.push(chunk);chunk='';}let x=s;while(x.length>maxChars){let cut=x.lastIndexOf(' ',maxChars);if(cut<maxChars/2)cut=maxChars;out.push(x.slice(0,cut));x=x.slice(cut).trimStart();}chunk=x;}else chunk+=(chunk?' ':'')+s;}
  if(chunk)out.push(chunk);return out;
}
function characters(text){const matches=[...text.matchAll(/(?<!\p{L})(?:Ông|Bà|Anh|Chị|Cô|Cậu|Bé|Bác|Chú|ông|bà|anh|chị|cô|cậu|bé|bác|chú)[ \t]+([\p{Lu}][\p{L}]+)/gu)].map(x=>x[0]);return [...new Set(matches)].slice(0,30);}
async function loadText({workspace,source,text,python='python3',pdftotext='pdftotext'}){
 if(typeof text==='string'&&text.trim())return {text:text.trim(),source:'user-text'};
 const file=within(workspace,source),ext=path.extname(file).toLowerCase();
 insist(['.txt','.docx','.pdf'].includes(ext),'Story supports TXT/DOCX/PDF text only');
 if(ext==='.txt')return {text:fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').trim(),source:file};
 if(ext==='.pdf'){
  try{const r=await run(pdftotext,['-layout',file,'-'],{timeoutMs:30000,maxOutput:12e6});insist(r.stdout.trim(),'Scanned PDF is not text-selectable','BLOCKED_OCR');return {text:r.stdout.trim(),source:file};}
  catch(e){if(e.code==='BLOCKED_OCR')throw e;const r=await run(python,['-c','import sys;from pypdf import PdfReader;print("\\n".join(p.extract_text() or "" for p in PdfReader(sys.argv[1]).pages))',file],{timeoutMs:30000,maxOutput:12e6});insist(r.stdout.trim(),'PDF OCR required','BLOCKED_OCR');return {text:r.stdout.trim(),source:file};}
 }
 const py='import zipfile,sys,xml.etree.ElementTree as E\nf=zipfile.ZipFile(sys.argv[1]);t=E.fromstring(f.read("word/document.xml"));ns={"w":"http://schemas.openxmlformats.org/wordprocessingml/2006/main"};print("\\n".join("".join(n.text or "" for n in p.findall(".//w:t",ns)) for p in t.findall(".//w:p",ns)))';
 const r=await run(python,['-c',py,file],{timeoutMs:30000,maxOutput:12e6});insist(r.stdout.trim(),'Empty DOCX');return {text:r.stdout.trim(),source:file};
}
function imageExtension(file){
 const stat=fs.statSync(file);insist(stat.isFile()&&stat.size>12&&stat.size<=20000000,'Image must be a nonempty PNG/JPEG/WebP <=20MB','MEDIA_IMAGE_INPUT');
 const b=Buffer.alloc(12),fd=fs.openSync(file,'r');try{fs.readSync(fd,b,0,12,0);}finally{fs.closeSync(fd);}
 if(b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return '.png';
 if(b[0]===255&&b[1]===216&&b[2]===255)return '.jpg';
 if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return '.webp';
 throw Object.assign(new Error('Uploaded file is not a PNG/JPEG/WebP image.'),{code:'MEDIA_IMAGE_INPUT'});
}
function validateImageSources(workspace,items){
 insist(Array.isArray(items)&&items.length>0&&items.length<=24,'Select 1-24 images for the storyboard','MEDIA_IMAGE_REQUIRED');
 return items.map(rel=>{
  insist(typeof rel==='string'&&/^uploads\/[a-f0-9-]+\.(png|jpe?g|webp)$/i.test(rel),'Use images imported into this workspace','MEDIA_IMAGE_INPUT');
  const file=within(workspace,rel),real=fs.realpathSync(file),base=fs.realpathSync(workspace)+path.sep;
  insist(real.startsWith(base),'Image escaped workspace','MEDIA_IMAGE_INPUT');
  imageExtension(file);return file;
 });
}
async function buildStory({workspace,text,source,gateway,jobDir,voice='vi',maxChars=420,mode='verbatim',allowProviderImages=false,ffprobeBin='ffprobe',ffmpegBin='ffmpeg',python='python3',resolution='720p',rights='unspecified',rate=1,volume=1,emotion='neutral',transition='cut',transitionSeconds=0.4,karaokeCaptions=true,captionPreset='sweep',ttsProvider='local',visualMode,imageProvider='auto',imageSources=[],visualStyle='',jobId='story',imagePool=null,confirmPaidImages=false,maxSceneCount=200,maxSeconds=Infinity}){
 insist(mode==='verbatim'||mode==='adapted','Unknown story mode');
 insist(Number.isFinite(rate)&&rate>=0.65&&rate<=1.5,'Unsupported narration rate');
 insist(Number.isFinite(volume)&&volume>=0.1&&volume<=1,'Unsupported narration volume');
 const loaded=await loadText({workspace,text,source,python});let body=loaded.text;
 if(mode==='adapted'){
  insist(gateway?.invoke,'Adaptation requires explicit ProviderGateway','BLOCKED_PROVIDER');const r=await gateway.invoke({capability:'story.adapt',input:{text:body,retainFacts:true}});
  insist(typeof r?.text==='string'&&r.text.trim(),'Adaptation provider returned no story');body=r.text;
 }
 const ch=chapters(body),storyboard=[],subtitles=[],subtitleAudio=[];let cursor=0;
 insist(ch.reduce((n,c)=>n+scenes(c.text,maxChars).length,0)<=maxSceneCount,'Too many scenes; shorten the script before spending image quota','CONCAT_STORY_LIMIT');
 const visual=visualMode||(allowProviderImages?'ai':'procedural');
 insist(['ai','uploads','procedural'].includes(visual),'Unknown illustration mode','MEDIA_IMAGE_MODE');
 const style=String(visualStyle||'Clean editorial illustration; consistent colour palette; depict only the supplied subject.').slice(0,500);
 const sources=visual==='uploads'?validateImageSources(workspace,imageSources):[];
 const sourceHashes=sources.map(file=>sha(fs.readFileSync(file)));

 for(const chapter of ch){
  const parts=scenes(chapter.text,maxChars);
  for(let j=0;j<parts.length;j++){
   const index=storyboard.length,key=sha(JSON.stringify({index,voice,ttsProvider,rate,volume,emotion,mode,text:parts[j],visual,imageProvider,imagePool,style,sourceHashes})).slice(0,24),dir=mkdir(path.join(jobDir,'scenes',key));
   const voicePath=path.join(dir,'speech.wav'),imgPath=path.join(dir,'image.png');
   // Sentence/phrase-level synthesis: each caption duration is measured from its own real audio.
   // This avoids arbitrary fixed-word timing and makes subtitle edits independently addressable.
   const phrases=scenes(parts[j],125),units=[];let unitDuration=0;
   for(let k=0;k<phrases.length;k++){
    const piece=path.join(dir,`part-${String(k).padStart(3,'0')}.wav`);
    const audioReceipt=piece+'.json',previousAudio=jsonRead(audioReceipt,null);
    const audioCached=fs.existsSync(piece)&&previousAudio?.sha256===sha(fs.readFileSync(piece));
    if(!audioCached){
     fs.rmSync(piece,{force:true});
     insist(gateway?.invoke,'TTS must be called through ProviderGateway','BLOCKED_TTS');
     const r=await gateway.invoke({capability:'speech.synthesize',input:{text:phrases[k],language:'vi',voice,rate,volume,emotion,output:piece,ttsProvider},consentRequired:false});
     insist(r?.audioPath&&fs.existsSync(r.audioPath),'Vietnamese TTS provider returned no audio file','BLOCKED_TTS');
     if(path.resolve(r.audioPath)!==path.resolve(piece))fs.copyFileSync(r.audioPath,piece);
     const audioInfo=await ffprobe(piece,ffprobeBin);insist(audioInfo.streams.some(s=>s.codec_type==='audio')&&duration(audioInfo)>.1,'Speech has no valid audio stream','BLOCKED_TTS');
     jsonWrite(audioReceipt,{sha256:sha(fs.readFileSync(piece)),provider:r.provider||ttsProvider,voice:r.voice||voice,voiceId:r.voiceId||voice});
    }
    const seconds=duration(await ffprobe(piece,ffprobeBin));insist(seconds>.1,'Invalid sentence audio','BLOCKED_TTS');
    units.push({text:phrases[k],file:piece,seconds});unitDuration+=seconds;
   }
   const concatList=path.join(dir,'voice-list.txt');fs.writeFileSync(concatList,units.map(x=>`file '${x.file.replace(/'/g,"'\\''")}'`).join('\n')+'\n');
   // Regenerate on every run if segments changed; concat costs little and is deterministic.
   await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i',concatList,'-c:a','pcm_s16le',voicePath],{timeoutMs:90000});
   const measured=duration(await ffprobe(voicePath,ffprobeBin));insist(measured>0.2,'TTS audio has invalid duration','BLOCKED_TTS');
   insist(cursor+measured<=maxSeconds,'Narration exceeds the approved video duration limit; shorten the script. Completed images/voices are kept.','CONCAT_STORY_LIMIT');
   let t=cursor;
   for(let k=0;k<units.length;k++){
    const end=k===units.length-1?cursor+measured:t+units[k].seconds;
    subtitles.push({id:String(subtitles.length+1),start:t,end,text:units[k].text,sceneIndex:index});subtitleAudio.push(units[k].file);t=end;
   }
   const receiptPath=path.join(dir,'image-receipt.json');
   let pic=null;
   if(fs.existsSync(receiptPath)){
    const r=jsonRead(receiptPath,null);
    if(r&&typeof r.file==='string'&&['image.png','image.jpg','image.webp'].includes(r.file)){
     const file=path.join(dir,r.file);if(fs.existsSync(file)&&sha(fs.readFileSync(file))===r.sha256)pic={...r,path:file,cacheHit:true};
    }
   }
   if(!pic){
    if(visual==='uploads'){
     const src=sources[index%sources.length],dest=path.join(dir,'image'+imageExtension(src));
     fs.copyFileSync(src,dest);pic={path:dest,origin:'user-upload',sourceIndex:index%sources.length};
    }else{
     const made=await illustration({gateway,description:parts[j],characterSheet:style,output:imgPath,offline:visual==='procedural',scene:index,provider:imageProvider,jobId:jobId+'-'+key,parentJobId:jobId,imagePool,confirmPaidImages});
     const suffix=imageExtension(made.path);const dest=path.join(dir,'image'+suffix);
     if(path.resolve(made.path)!==path.resolve(dest))fs.copyFileSync(made.path,dest);
     pic={...made,path:dest};
    }
    const imageInfo=await ffprobe(pic.path,ffprobeBin);insist(imageInfo.streams.some(v=>v.codec_type==='video'&&v.width>0&&v.height>0&&v.width*v.height<=48000000),'Image could not be decoded or is too large','MEDIA_IMAGE_INPUT');
    jsonWrite(receiptPath,{file:path.basename(pic.path),origin:pic.origin,provider:pic.provider||null,model:pic.model||null,connectionId:pic.connectionId||null,connectionName:pic.connectionName||null,attempts:pic.attempts||[],sourceIndex:pic.sourceIndex??null,sha256:sha(fs.readFileSync(pic.path))});
   }
   const scene={index,chapter:chapter.number,sourceText:parts[j],title:`Scene ${index+1}`,image:pic.path,imageOrigin:pic.origin,imageProvider:pic.provider||null,imageModel:pic.model||null,imageConnection:pic.connectionName||null,imageAttempts:pic.attempts||[],audio:voicePath,duration:measured,voice,characterSheet:style,cacheKey:key,start:cursor,end:cursor+measured};
   storyboard.push(scene);cursor+=measured;
  }
 }
 const sizes={'360p':[640,360],'720p':[1280,720],'1080p':[1920,1080]};insist(sizes[resolution],'Unsupported story resolution');
 const XF_OK=['crossfade','fadeblack','slideleft','slideright','wipeleft'];
 const effTransition=XF_OK.includes(transition)?transition:'cut';
 const effSeconds=Math.max(0.1,Math.min(0.75,Number(transitionSeconds)||0.4));
 // Narration is never cross-faded or shortened. Visual tails provide the
 // overlap for image transitions while speech and captions retain their timing.
 const expectedDuration=cursor;
 for(const sub of subtitles)delete sub.sceneIndex;
 // Karaoke captions (0.9.31): word timings measured by local Whisper on each
 // phrase's own synthesized audio when available; otherwise the aligner
 // splits each phrase proportionally. Displayed text is always the script.
 let karaokeFile=null,karaokeStyle=null,karaokeTiming=null,karaokeWords=0;
 if(karaokeCaptions&&subtitles.length){
  try{
   const kc=await import(require('url').pathToFileURL(path.join(__dirname,'..','..','..','src','lib','karaoke-captions.mjs')).href);
   const preset=kc.KARAOKE_PRESETS.includes(captionPreset)?captionPreset:'sweep';
   let whisperWords=null;
   const model=String(process.env.WHISPER_MODEL_PATH||''),cli=String(process.env.WHISPER_CLI_PATH||'whisper-cli');
   if(model&&fs.existsSync(model)){
    whisperWords=[];
    const tmp=mkdir(path.join(jobDir,'karaoke-tmp'));
    for(let i=0;i<subtitles.length;i++){
     const src=subtitleAudio[i];if(!src||!fs.existsSync(src))continue;
     try{
      const w16=path.join(tmp,`phrase-${i}.wav`),stem=path.join(tmp,`phrase-${i}`);
      await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-i',src,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',w16],{timeoutMs:60000});
      await run(cli,['-m',model,'-f',w16,'-l','vi','-ojf','-of',stem],{timeoutMs:300000});
      const data=JSON.parse(fs.readFileSync(stem+'.json','utf8'));
      for(const seg of data?.transcription||[])for(const tok of seg?.tokens||[]){
       const text=String(tok?.text||'');if(!text||text.startsWith('[_'))continue;
       const from=Number(tok?.offsets?.from),to=Number(tok?.offsets?.to);if(!Number.isFinite(from)||!Number.isFinite(to))continue;
       const clean=text.trim(),startsWord=text.startsWith(' ')||whisperWords.length===0;
       if(startsWord||!/^[\p{L}\p{N}]/u.test(clean)){if(clean)whisperWords.push({start:subtitles[i].start+from/1000,end:subtitles[i].start+to/1000,text:clean,phrase:i});}
       else if(whisperWords.length){whisperWords[whisperWords.length-1].text+=clean;whisperWords[whisperWords.length-1].end=subtitles[i].start+to/1000;}
      }
     }catch{/* one phrase without measured words: the aligner falls back for it */}
    }
    try{fs.rmSync(tmp,{recursive:true,force:true});}catch{}
    if(!whisperWords.length)whisperWords=null;
   }
   const aligned=kc.alignKaraokeWords({segments:subtitles,texts:subtitles.map(x=>x.text),whisperWords});
   const ass=kc.buildKaraokeAss({segments:subtitles,timedWords:aligned.timedWords,width:sizes[resolution][0],height:sizes[resolution][1],preset});
   karaokeFile=path.join(jobDir,'captions-karaoke.ass');
   fs.writeFileSync(karaokeFile,ass);
   karaokeStyle='karaoke-'+preset;karaokeTiming=aligned.method;karaokeWords=aligned.wordCount;
  }catch{karaokeFile=null;}
 }
 if(!karaokeFile)karaokeStyle='srt-phrases';
 const timeline={version:1,kind:'story',width:sizes[resolution][0],height:sizes[resolution][1],fps:25,scenes:storyboard,expectedDuration,transition:effTransition,transitionSeconds:effSeconds,preserveNarration:true};
 const metadata={visualMode:visual,imageProvider:visual==='ai'?imageProvider:null,narrationProvider:ttsProvider,mode,source:loaded.source,sourceSHA256:sha(body),sourceCharacters:body.length,chapters:ch.length,characters:characters(body),characterSheet:style,voice,rate,volume,emotion,rights,segmentTimings:'Measured via ffprobe for every separately synthesized Vietnamese phrase; not phoneme/word forced alignment',sceneCount:storyboard.length};
 if(karaokeStyle){metadata.captionStyle=karaokeStyle;if(karaokeTiming)metadata.captionTiming=karaokeTiming;if(karaokeWords)metadata.captionWords=karaokeWords;}
 jsonWrite(path.join(jobDir,'storyboard.json'),{metadata,timeline});
 fs.writeFileSync(path.join(jobDir,'captions.srt'),subs.srt(subtitles));
 fs.writeFileSync(path.join(jobDir,'captions.vtt'),subs.vtt(subtitles));
 return {metadata,timeline,subtitles,karaokeFile};
}
module.exports={chapters,scenes,characters,loadText,buildStory,validateImageSources,imageExtension};
