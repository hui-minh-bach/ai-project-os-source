'use strict';
const {fs,path,run,sha,insist,mkdir,ffprobe,duration,hasAudio,jsonRead,jsonWrite,shaFile}=require('./utils.cjs');
const escapeFilterPath=file=>file.replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"'\\\\''").replace(/,/g,'\\,').replace(/\[/g,'\\[').replace(/\]/g,'\\]');
const KB=[
 z=>`zoompan=z='min(zoom+0.00045,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1`,
 z=>`zoompan=z='if(eq(on,0),1.14,max(zoom-0.00045,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1`,
 z=>`zoompan=z='1.12':x='iw/2-(iw/zoom/2)+min(on*0.35,60)':y='ih/2-(ih/zoom/2)':d=1`,
 z=>`zoompan=z='1.12':x='iw/2-(iw/zoom/2)-min(on*0.35,60)':y='ih/2-(ih/zoom/2)':d=1`];
const videoFilters=(w,h,motion=false,framing='fit',variant=0)=>motion?
 `scale=${Math.round(w*1.2)}:${Math.round(h*1.2)}:force_original_aspect_ratio=increase,crop=${Math.round(w*1.2)}:${Math.round(h*1.2)},${KB[Math.abs(variant)%4]()}:s=${w}x${h}:fps=25,format=yuv420p`:
 framing==='crop'?`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=25,format=yuv420p`:
 `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p`;
const QUALITY_PROFILES={'standard':{crf:21,preset:'veryfast'},'high':{crf:18,preset:'medium'},'max':{crf:15,preset:'slow'}};
async function render({timeline,jobDir,ffmpegBin='ffmpeg',ffprobeBin='ffprobe',preview=false,subtitle=null,music=null,crf=null,quality='high',maxThreads=2,signal,onProgress=()=>{}}){
 const qp=QUALITY_PROFILES[quality]||QUALITY_PROFILES.high;if(crf===null)crf=qp.crf;const finalPreset=qp.preset;
 insist(['story','edit'].includes(timeline.kind),'Unknown timeline type');
 const w=preview?Math.min(timeline.width,640):timeline.width,h=preview?Math.round(timeline.height*w/timeline.width/2)*2:timeline.height;
 insist(Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0,'Invalid resolution','MEDIA_PLAN_RANGE');
 const clips=timeline.kind==='story'?timeline.scenes:timeline.segments;
 insist(clips.length>0&&clips.length<=120,'Invalid clip count','LIMIT');
 // Make a rerun strictly idempotent. A changed job cannot clobber an existing artifact.
 const output=path.join(jobDir,preview?'preview.mp4':'final.mp4');
 const receipt=output+'.receipt.json';
 const inputs=clips.filter(c=>timeline.kind==='edit').map(c=>c.source);
 const sourceHashes=new Map();
 for(const source of [...new Set(inputs)]){
  insist(fs.existsSync(source)&&fs.statSync(source).isFile(),'Media source missing','MEDIA_PLAN_SOURCE');
  const digest=shaFile(source);sourceHashes.set(source,digest);
  if(timeline.sourceSha256)insist(digest===timeline.sourceSha256,'Video nguồn đã thay đổi SHA-256. Hãy dựng lại kế hoạch từ nguồn.','MEDIA_PLAN_SOURCE');
 }
 const fingerprint=sha(JSON.stringify({version:2,timeline,preview,subtitle:subtitle?shaFile(subtitle):null,music:music?shaFile(music):null,sourceHashes:[...sourceHashes],crf,maxThreads,ffmpegBin,ffprobeBin}));
 if(fs.existsSync(output)||fs.existsSync(receipt)){
  const previous=jsonRead(receipt);
  insist(previous?.fingerprint===fingerprint&&fs.existsSync(output),'Tác vụ đã có đầu ra khác; không ghi đè. Hãy tạo tác vụ mới.','RENDER_CONFLICT');
  insist(shaFile(output)===previous.sha256,'Đầu ra cũ đã bị thay đổi; không ghi đè.','RENDER_CONFLICT');
  const probed=await ffprobe(output,ffprobeBin);
  insist(probed.streams?.some(s=>s.codec_type==='video'),'Video kết quả không hợp lệ','RENDER_CONFLICT');
  onProgress({phase:'complete',path:output,seconds:duration(probed),reused:clips.length,idempotent:true});
  return {...previous.result,reused:clips.length,idempotent:true};
 }
 const chunks=mkdir(path.join(jobDir,'render-cache',preview?'preview':'final'));
 const paths=[];let expected=0,reused=0;
 for(let i=0;i<clips.length;i++){
  const c=clips[i],length=timeline.kind==='story'?c.duration:c.end-c.start;
  insist(Number.isFinite(length)&&length>=.12&&length<=900,'Invalid clip length. Dựng lại từ video gốc.','MEDIA_PLAN_RANGE');expected+=length;
  if(timeline.kind==='edit')insist(shaFile(c.source)===sourceHashes.get(c.source),'Video nguồn đã thay đổi trong lúc dựng.','MEDIA_PLAN_SOURCE');
  let clipFingerprint=timeline.kind==='story'?`${c.cacheKey}:${shaFile(c.audio)}:${shaFile(c.image)}`:`${sourceHashes.get(c.source)}:${c.start}:${c.end}:${timeline.audioStreamIndex??'auto'}`;
  clipFingerprint=sha(JSON.stringify([clipFingerprint,w,h,preview,crf,ffmpegBin,timeline.framing])).slice(0,20);
  const outfile=path.join(chunks,`${String(i).padStart(4,'0')}-${clipFingerprint}.mp4`);
  let valid=false;
  if(fs.existsSync(outfile))try{const p=await ffprobe(outfile,ffprobeBin);valid=duration(p)>.2&&Math.abs(duration(p)-length)<1.0;}catch{}
  if(valid)reused++;else{
   const temp=outfile+'.'+process.pid+'.part.mp4';const args=['-hide_banner','-loglevel','error','-nostdin','-y'];
   if(timeline.kind==='story'){
    args.push('-loop','1','-framerate','25','-i',c.image,'-i',c.audio,'-t',String(length),'-vf',videoFilters(w,h,true,'fit',i),'-af','loudnorm=I=-14:TP=-1.5:LRA=11','-map','0:v:0','-map','1:a:0');
   }else{
    const src=await ffprobe(c.source,ffprobeBin);args.push('-ss',String(c.start),'-t',String(length),'-i',c.source);
    const tracks=(src.streams||[]).filter(s=>s.codec_type==='audio');
    if(tracks.length>1&&timeline.audioStreamIndex==null)insist(false,'Nguồn có nhiều track tiếng, cần chọn audioStreamIndex.','MEDIA_AUDIO_SELECTION');
    const selected=timeline.audioStreamIndex==null?tracks[0]?.index:timeline.audioStreamIndex;
    if(selected!==undefined&&selected!==null)insist(tracks.some(x=>x.index===selected),'Audio track không còn khớp nguồn.','MEDIA_AUDIO_SELECTION');
    if(!hasAudio(src))args.push('-f','lavfi','-t',String(length),'-i','anullsrc=r=48000:cl=stereo');
    args.push('-t',String(length),'-vf',videoFilters(w,h,false,timeline.framing));
    args.push('-map','0:v:0','-map',tracks.length?`0:${selected}`:'1:a:0');
   }
   args.push('-c:v','libx264','-threads',String(Math.max(1,Math.min(4,maxThreads))),'-preset',preview?'ultrafast':finalPreset,'-crf',String(preview?29:crf),'-r','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-ar','48000','-ac','2','-shortest','-movflags','+faststart',temp);
   try{await run(ffmpegBin,args,{timeoutMs:Math.max(90000,length*12000),signal});
    fs.renameSync(temp,outfile);}
   finally{if(fs.existsSync(temp))fs.rmSync(temp,{force:true});}
  }
  paths.push(outfile);onProgress({phase:'clip',completed:i+1,total:clips.length,reused});
 }
 const merged=path.join(jobDir,preview?'preview-merged.mp4':'final-merged.mp4');
 const XF={'crossfade':'fade','fadeblack':'fadeblack','slideleft':'slideleft','slideright':'slideright','wipeleft':'wipeleft'};
 const overlap=XF[timeline.transition]&&paths.length>1 ? Number(timeline.transitionSeconds||0) : 0;
 if(overlap>0){
  const lengths=clips.map(c=>timeline.kind==='story'?c.duration:c.end-c.start);
  const filter=[];let at=0,vprev='[0:v]',aprev='[0:a]';
  for(let i=1;i<paths.length;i++){
   at+=lengths[i-1];const offset=at-i*overlap;
   const vnext=`[v${i}]`,anext=`[a${i}]`;
   filter.push(`${vprev}[${i}:v]xfade=transition=${XF[timeline.transition]}:duration=${overlap.toFixed(4)}:offset=${offset.toFixed(4)}${vnext}`);
   filter.push(`${aprev}[${i}:a]acrossfade=d=${overlap.toFixed(4)}:c1=tri:c2=tri${anext}`);
   vprev=vnext;aprev=anext;
  }
  const args=['-hide_banner','-loglevel','error','-nostdin','-y'];
  for(const file of paths)args.push('-i',file);
  args.push('-filter_complex',filter.join(';'),'-map',vprev,'-map',aprev,'-c:v','libx264','-threads',String(Math.max(1,Math.min(4,maxThreads))),'-preset',preview?'ultrafast':finalPreset,'-crf',String(preview?29:crf),'-r','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-movflags','+faststart',merged);
  await run(ffmpegBin,args,{timeoutMs:Math.max(120000,expected*18000),signal});
  expected-=overlap*(paths.length-1);
 }else{
  const listFile=path.join(chunks,'concat.txt');fs.writeFileSync(listFile,paths.map(p=>`file '${p.replace(/'/g,"'\\''")}'`).join('\n')+'\n');
  await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i',listFile,'-c','copy','-movflags','+faststart',merged],{timeoutMs:Math.max(120000,expected*6000),signal});
 }
 const staged=output+'.'+process.pid+'.part.mp4';
 const fx=timeline.effects?.includes('fade-in-out')===true;
 const fadeDuration=Math.min(.6,Math.max(.12,expected/5));
 const imageFx=fx?[`fade=t=in:st=0:d=${fadeDuration.toFixed(3)}`,`fade=t=out:st=${Math.max(0,expected-fadeDuration).toFixed(3)}:d=${fadeDuration.toFixed(3)}`]:[];
 if(subtitle||music||fx){
  const args=['-hide_banner','-loglevel','error','-nostdin','-y','-i',merged];
  if(music){args.push('-stream_loop','-1','-i',music)}
  const vf=[...(subtitle?[`subtitles=filename='${escapeFilterPath(subtitle)}'`]:[]),...imageFx];
  if(vf.length)args.push('-vf',vf.join(','));
  if(music){
    args.push('-filter_complex','[1:a]volume=0.24[bg];[bg][0:a]sidechaincompress=threshold=0.024:ratio=8:attack=50:release=400[duck];[duck][0:a]amix=inputs=2:duration=first:dropout_transition=0[aout]','-map','0:v:0','-map','[aout]');
  }
  args.push('-c:v','libx264','-threads',String(Math.max(1,Math.min(4,maxThreads))),'-preset',preview?'ultrafast':finalPreset,'-crf',String(preview?29:crf),'-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',staged);
  try{await run(ffmpegBin,args,{timeoutMs:Math.max(120000,expected*14000),signal});}
  catch(e){if(fs.existsSync(staged))fs.rmSync(staged,{force:true});throw e;}
 }else fs.copyFileSync(merged,staged);
 try{
  const probed=await ffprobe(staged,ffprobeBin),actual=duration(probed);
  insist(Math.abs(actual-expected)<Math.max(1,clips.length*.13),'Render duration differs from timeline','RENDER_INVALID');
  insist(probed.streams?.some(s=>s.codec_type==='video'&&s.codec_name==='h264'),'Render lacks H.264 video','RENDER_INVALID');
  insist(probed.streams?.some(s=>s.codec_type==='audio'&&s.codec_name==='aac'),'Render lacks AAC audio','RENDER_INVALID');
  for(const [source,digest] of sourceHashes)insist(shaFile(source)===digest,'Video nguồn đã bị đổi trong khi render.','MEDIA_PLAN_SOURCE');
  insist(!fs.existsSync(output)&&!fs.existsSync(receipt),'Existing render output cannot be overwritten','RENDER_CONFLICT');
  const result={file:output,expectedSeconds:expected,actualSeconds:actual,reused,clips:clips.length,width:w,height:h};
  const stagedHash=shaFile(staged);
  fs.renameSync(staged,output);
  jsonWrite(receipt,{fingerprint,sha256:stagedHash,sourceSha256:timeline.sourceSha256||null,result,validatedAt:new Date().toISOString()});
  onProgress({phase:'complete',path:output,seconds:actual,reused});return result;
 }finally{if(fs.existsSync(staged))fs.rmSync(staged,{force:true});}
}
module.exports={render,escapeFilterPath};
