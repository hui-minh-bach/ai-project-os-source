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
async function buildStory({workspace,text,source,gateway,jobDir,voice='vi',maxChars=420,mode='verbatim',allowProviderImages=false,ffprobeBin='ffprobe',ffmpegBin='ffmpeg',python='python3',resolution='720p',rights='unspecified',rate=1,volume=1,emotion='neutral',transition='cut',transitionSeconds=0.4}){
 insist(mode==='verbatim'||mode==='adapted','Unknown story mode');
 insist(Number.isFinite(rate)&&rate>=0.65&&rate<=1.5,'Unsupported narration rate');
 insist(Number.isFinite(volume)&&volume>=0.1&&volume<=1,'Unsupported narration volume');
 const loaded=await loadText({workspace,text,source,python});let body=loaded.text;
 if(mode==='adapted'){
  insist(gateway?.invoke,'Adaptation requires explicit ProviderGateway','BLOCKED_PROVIDER');const r=await gateway.invoke({capability:'story.adapt',input:{text:body,retainFacts:true}});
  insist(typeof r?.text==='string'&&r.text.trim(),'Adaptation provider returned no story');body=r.text;
 }
 const ch=chapters(body),storyboard=[],subtitles=[];let cursor=0;
 const style='Vietnamese countryside at sunrise; repeating silhouette character designs; flat cinematic poster style';
 for(const chapter of ch){
  const parts=scenes(chapter.text,maxChars);
  for(let j=0;j<parts.length;j++){
   const index=storyboard.length,key=sha(`${voice}\n${rate}\n${volume}\n${emotion}\n${mode}\n${parts[j]}`).slice(0,20),dir=mkdir(path.join(jobDir,'scenes',key));
   const voicePath=path.join(dir,'speech.wav'),imgPath=path.join(dir,'image.png');
   // Sentence/phrase-level synthesis: each caption duration is measured from its own real audio.
   // This avoids arbitrary fixed-word timing and makes subtitle edits independently addressable.
   const phrases=scenes(parts[j],125),units=[];let unitDuration=0;
   for(let k=0;k<phrases.length;k++){
    const piece=path.join(dir,`part-${String(k).padStart(3,'0')}.wav`);
    if(!fs.existsSync(piece)){
     insist(gateway?.invoke,'TTS must be called through ProviderGateway','BLOCKED_TTS');
     const r=await gateway.invoke({capability:'speech.synthesize',input:{text:phrases[k],language:'vi',voice,rate,volume,emotion,output:piece},consentRequired:false});
     insist(r?.audioPath&&fs.existsSync(r.audioPath),'Vietnamese TTS provider returned no audio file','BLOCKED_TTS');
     if(path.resolve(r.audioPath)!==path.resolve(piece))fs.copyFileSync(r.audioPath,piece);
    }
    const seconds=duration(await ffprobe(piece,ffprobeBin));insist(seconds>.1,'Invalid sentence audio','BLOCKED_TTS');
    units.push({text:phrases[k],file:piece,seconds});unitDuration+=seconds;
   }
   const concatList=path.join(dir,'voice-list.txt');fs.writeFileSync(concatList,units.map(x=>`file '${x.file.replace(/'/g,"'\\''")}'`).join('\n')+'\n');
   // Regenerate on every run if segments changed; concat costs little and is deterministic.
   await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i',concatList,'-c:a','pcm_s16le',voicePath],{timeoutMs:90000});
   const measured=duration(await ffprobe(voicePath,ffprobeBin));insist(measured>0.2,'TTS audio has invalid duration','BLOCKED_TTS');
   let t=cursor;
   for(let k=0;k<units.length;k++){
    const end=k===units.length-1?cursor+measured:t+units[k].seconds;
    subtitles.push({id:String(subtitles.length+1),start:t,end,text:units[k].text,sceneIndex:index});t=end;
   }
   const pic=fs.existsSync(imgPath)?{path:imgPath,origin:'checkpoint'}:await illustration({gateway,description:parts[j],characterSheet:style,output:imgPath,offline:!allowProviderImages,scene:index});
   const scene={index,chapter:chapter.number,sourceText:parts[j],title:`Scene ${index+1}`,image:pic.path,imageOrigin:pic.origin,audio:voicePath,duration:measured,voice,characterSheet:style,cacheKey:key,start:cursor,end:cursor+measured};
   storyboard.push(scene);cursor+=measured;
  }
 }
 const sizes={'360p':[640,360],'720p':[1280,720],'1080p':[1920,1080]};insist(sizes[resolution],'Unsupported story resolution');
 const XF_OK=['crossfade','fadeblack','slideleft','slideright','wipeleft'];
 const effTransition=XF_OK.includes(transition)?transition:'cut';
 const effSeconds=Math.max(0.1,Math.min(0.75,Number(transitionSeconds)||0.4));
 let expectedDuration=cursor;
 if(effTransition!=='cut'&&storyboard.length>1){
  // xfade output positions: scene i is shifted i*overlap earlier; subtitles
  // and scene spans follow the same shift; the output total shrinks.
  for(const scene of storyboard){const shift=scene.index*effSeconds;scene.start=Math.max(0,scene.start-shift);scene.end=Math.max(scene.start+0.1,scene.end-shift);}
  for(const sub of subtitles){const shift=(sub.sceneIndex||0)*effSeconds;sub.start=Math.max(0,sub.start-shift);sub.end=Math.max(sub.start+0.1,sub.end-shift);}
  expectedDuration=cursor-(storyboard.length-1)*effSeconds;
  // During each crossfade the outgoing line's tail blends under the next
  // line's head; captions stay sequential by ending a line where the next
  // begins (the same convention subtitle editors apply).
  for(let i=0;i<subtitles.length-1;i++){const next=subtitles[i+1];if(subtitles[i].end>next.start)subtitles[i].end=Math.max(subtitles[i].start+0.1,next.start);}
 }
 for(const sub of subtitles)delete sub.sceneIndex;
 const timeline={version:1,kind:'story',width:sizes[resolution][0],height:sizes[resolution][1],fps:25,scenes:storyboard,expectedDuration,transition:effTransition,transitionSeconds:effSeconds};
 const metadata={mode,source:loaded.source,sourceSHA256:sha(body),sourceCharacters:body.length,chapters:ch.length,characters:characters(body),characterSheet:style,voice,rate,volume,emotion,rights,segmentTimings:'Measured via ffprobe for every separately synthesized Vietnamese phrase; not phoneme/word forced alignment',sceneCount:storyboard.length};
 jsonWrite(path.join(jobDir,'storyboard.json'),{metadata,timeline});
 fs.writeFileSync(path.join(jobDir,'captions.srt'),subs.srt(subtitles));
 fs.writeFileSync(path.join(jobDir,'captions.vtt'),subs.vtt(subtitles));
 return {metadata,timeline,subtitles};
}
module.exports={chapters,scenes,characters,loadText,buildStory};
