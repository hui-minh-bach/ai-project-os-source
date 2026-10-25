'use strict';
/** Story -> editable Concat project. Independent RPC client, no editor source.
 * FFmpeg prepares silent animated still clips and one continuous narration.
 * Concat owns scene/title/caption/audio tracks and performs the FINAL export.
 * No fallback to an FFmpeg master is allowed for a Concat-selected job. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {run,ffprobe,duration,shaFile,insist,jsonRead,jsonWrite}=require('./utils.cjs');
const {createSession,probe}=require('./concat.cjs');
const {fileInside}=require('./concat-multitrack.cjs');
const quality=require('./quality.cjs');
function validateStory(story,workspace){
 const t=story?.timeline,scenes=t?.scenes;
 insist(t?.kind==='story'&&Array.isArray(scenes)&&scenes.length>0&&scenes.length<=24,'Concat story requires 1-24 scenes','CONCAT_STORY_LIMIT');
 insist([t.width,t.height].every(n=>Number.isInteger(n)&&n>=160&&n<=3840&&n%2===0),'Invalid Concat output size','MEDIA_INPUT');
 insist(Number.isFinite(t.expectedDuration)&&t.expectedDuration>.2&&t.expectedDuration<=300,'Concat story supports up to five minutes','CONCAT_STORY_LIMIT');
 let cursor=0;
 for(const s of scenes){
  insist(Number.isFinite(s.duration)&&s.duration>.15&&Math.abs(s.start-cursor)<.05,'Invalid scene timing','CONCAT_STORY_TIMING');
  s.image=fileInside(workspace,s.image);s.audio=fileInside(workspace,s.audio);cursor+=s.duration;
 }
 insist(Math.abs(cursor-t.expectedDuration)<.05,'Narration length differs from story duration','CONCAT_STORY_TIMING');
 insist(Array.isArray(story.subtitles)&&story.subtitles.length<=240,'Too many caption cues','CONCAT_STORY_LIMIT');
 for(const s of story.subtitles)insist(s.start>=0&&s.end>s.start&&s.end<=cursor+.05&&typeof s.text==='string'&&s.text.length<=500,'Invalid story caption','CONCAT_STORY_TIMING');
 return t;
}
function sceneFilter({width,height,frames,index,effects='gentle',fps=25}){
 const fit=`scale=${width*2}:${height*2}:force_original_aspect_ratio=increase,crop=${width*2}:${height*2},setsar=1`;
 if(effects==='none')return `${fit},scale=${width}:${height},fps=${fps},format=yuv420p`;
 // Animation lives inside each independently editable scene. This avoids the
 // known Concat 0.2 cross-fade/overlaid-text issue without dropping effects.
 const zoom=index%2===0?`1.0+0.045*on/${Math.max(1,frames-1)}`:`1.045-0.045*on/${Math.max(1,frames-1)}`;
 const seconds=frames/fps,fade=Math.min(.24,seconds/5);
 return `${fit},zoompan=z='${zoom}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${width}x${height}:fps=${fps},fade=t=in:st=0:d=${fade},fade=t=out:st=${Math.max(0,seconds-fade)}:d=${fade},format=yuv420p`;
}
async function prepareStoryMedia({workspace,story,dir,effects='gentle',ffmpegBin='ffmpeg',ffprobeBin='ffprobe'}){
 const t=validateStory(story,workspace),fps=25;fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const clips=[],voices=[];
 for(let i=0;i<t.scenes.length;i++){
  const scene=t.scenes[i],startFrame=Math.round(scene.start*fps);
  const endFrame=i===t.scenes.length-1?Math.ceil(t.expectedDuration*fps):Math.round((scene.start+scene.duration)*fps);
  const frames=endFrame-startFrame;insist(frames>0,'Scene has no frames','CONCAT_STORY_TIMING');
  const image=path.join(dir,`image-${i+1}`+path.extname(scene.image).toLowerCase());fs.copyFileSync(scene.image,image);
  const visual=path.join(dir,`scene-${i+1}.mp4`),audio=path.join(dir,`voice-${i+1}.wav`);
  await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-loop','1','-i',image,'-vf',sceneFilter({width:t.width,height:t.height,frames,index:i,effects}),'-frames:v',String(frames),'-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',visual],{timeoutMs:180000});
  await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-i',scene.audio,'-vn','-ar','48000','-ac','2','-c:a','pcm_s16le',audio],{timeoutMs:90000});
  const info=await ffprobe(visual,ffprobeBin);
  insist(info.streams.some(x=>x.codec_type==='video')&&!info.streams.some(x=>x.codec_type==='audio')&&Math.abs(duration(info)-frames/fps)<.09,'Prepared scene failed media checks','CONCAT_CLIP_QA');
  clips.push({index:i,visual,image,at:startFrame/fps,length:frames/fps,frames,sha256:shaFile(visual),imageSha256:shaFile(image)});voices.push(audio);
 }
 const list=path.join(dir,'voice-list.txt'),narration=path.join(dir,'narration.wav');
 fs.writeFileSync(list,voices.map(p=>`file '${p.replace(/'/g,"'\\''")}'`).join('\n')+'\n');
 await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-f','concat','-safe','0','-i',list,'-c:a','pcm_s16le',narration],{timeoutMs:120000});
 const voiceInfo=await ffprobe(narration,ffprobeBin);
 insist(voiceInfo.streams.some(x=>x.codec_type==='audio')&&Math.abs(duration(voiceInfo)-t.expectedDuration)<.08,'Narration was truncated or overlapped','CONCAT_VOICE_DURATION');
 return {clips,narration,seconds:t.expectedDuration,frameSeconds:Math.ceil(t.expectedDuration*fps)/fps,fps};
}
async function verifyFinal({file,story,ffmpegBin,ffprobeBin}){
 const t=story.timeline,info=await ffprobe(file,ffprobeBin),video=info.streams.find(s=>s.codec_type==='video'),audio=info.streams.find(s=>s.codec_type==='audio');
 insist(video?.width===t.width&&video?.height===t.height&&audio,'Concat output streams/resolution differ from the approved story','CONCAT_QUALITY');
 insist(Math.abs(duration(info)-t.expectedDuration)<.3,'Concat export truncated or extended the narration','CONCAT_QUALITY');
 if(Number.isFinite(Number(audio.duration)))insist(Number(audio.duration)>=t.expectedDuration-.25,'Narration tail is missing','CONCAT_QUALITY');
 await run(ffmpegBin,['-hide_banner','-loglevel','error','-xerror','-err_detect','explode','-nostdin','-i',file,'-f','null','-'],{timeoutMs:240000});
 const volume=await run(ffmpegBin,['-hide_banner','-nostdin','-i',file,'-vn','-af','volumedetect','-f','null','-'],{timeoutMs:180000});
 const match=/max_volume:\s*(-?[0-9.]+) dB/.exec(volume.stderr);
 insist(match&&Number(match[1])>-65,'Concat output is silent or inaudible; not a narrated video','CONCAT_QUALITY');
 const qa=await quality.check({file,expectedDuration:t.expectedDuration,ffmpegBin,ffprobeBin,subtitleSegments:story.subtitles});
 insist(qa.passed,'Concat output failed QA: '+qa.problems.join(', '),'CONCAT_QUALITY');
 return {...qa,fullDecode:true,peakDb:Number(match[1]),narrationTailChecked:true};
}
async function createStoryProject({settings,workspace,story,jobId,jobDir,title='',musicSource=null,musicVolume=.12,effects='gentle',ffmpegBin='ffmpeg',ffprobeBin='ffprobe',onProgress=()=>{}}){
 insist(/^[A-Za-z0-9_-]{1,90}$/.test(jobId),'Unsafe Concat job ID','FORBIDDEN_PATH');
 insist(['gentle','none'].includes(effects),'Unsupported story effects','MEDIA_INPUT');
 const base=fs.realpathSync(workspace),t=validateStory(story,base);
 fs.mkdirSync(jobDir,{recursive:true,mode:0o700});
 const inside=fs.realpathSync(jobDir);insist(inside.startsWith(base+path.sep),'Concat job outside workspace','FORBIDDEN_PATH');
 const music=musicSource?fileInside(base,musicSource):null;
 insist(Number.isFinite(musicVolume)&&musicVolume>=0&&musicVolume<=.4,'Invalid music volume','MEDIA_INPUT');
 const signature=crypto.createHash('sha256').update(JSON.stringify({v:1,t:{width:t.width,height:t.height,seconds:t.expectedDuration},scenes:t.scenes.map(s=>[shaFile(s.image),shaFile(s.audio),s.start,s.duration]),captions:story.subtitles,title:String(title).slice(0,95),music:music?shaFile(music):null,musicVolume,effects})).digest('hex');
 const statePath=path.join(inside,'concat-story-state.json');let journal=jsonRead(statePath,null);
 const safeSaved=f=>typeof f==='string'&&path.resolve(f).startsWith(base+path.sep)&&fs.existsSync(f)&&fs.realpathSync(f).startsWith(base+path.sep);
 if(journal?.signature===signature&&journal.phase==='completed'&&safeSaved(journal.report?.exported)&&shaFile(journal.report.exported)===journal.report.exportSha256){return {...journal.report,reused:true};}
 // Reconcile a completed file after a lost response. Never issue a second
 // export while the first could still be running.
 if(journal?.signature===signature&&journal.phase==='exporting'){
  const out=journal.output;
  if(safeSaved(out)){
   const a=fs.statSync(out);await new Promise(r=>setTimeout(r,750));const b=fs.statSync(out);
   if(a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.size>1000){
    let qa;try{qa=await verifyFinal({file:out,story,ffmpegBin,ffprobeBin});}catch{qa=null;}
    if(qa?.passed){const report={...journal.report,exported:out,exportSha256:shaFile(out),qa,reconciled:true};jsonWrite(statePath,{signature,phase:'completed',report});return report;}
   }
  }
  throw Object.assign(new Error('Concat export is pending or its result is unknown. Keep Concat open; retry after it finishes. No duplicate export was started.'),{code:'CONCAT_EXPORT_PENDING'});
 }
 await probe({...settings,timeoutMs:4000}); // Fail before processing/spending.
 const location=path.join(base,'concat-projects');fs.mkdirSync(location,{recursive:true,mode:0o700});
 const name='aios-story-'+jobId.slice(0,38)+'-'+crypto.randomUUID().slice(0,8),project=path.join(location,name);
 const c=createSession({...settings,timeoutMs:15000,requestTimeoutMs:60000});
 let report={engine:'concat-json-rpc-0.2',project,expectedSeconds:t.expectedDuration,effects,sceneCount:t.scenes.length,scenes:[],captionClipIds:[],voiceClipId:null,musicClipId:null,titleClipId:null,sourceSignature:signature,sourceLayers:['scene-video','continuous-narration','captions'],effectOrigin:'FFmpeg per-scene slow zoom and fade; Concat editable scene/text/audio tracks and final export'};
 try{
  const version=await c.call('version');insist(String(version?.apiVersion||'').startsWith('0.2'),'Installed Concat API must be 0.2; no unsupported commands guessed','BLOCKED_CONCAT');report.concatVersion=version.concat||null;
  await c.call('project.create',{location,name,video:{width:t.width,height:t.height,rateNum:25,rateDen:1}});
  jsonWrite(statePath,{signature,phase:'building',project});
  const prepared=await prepareStoryMedia({workspace:base,story,dir:path.join(project,'media-ai-project-os'),effects,ffmpegBin,ffprobeBin});
  async function add(file,start,kind,volume){
   const imp=await c.call('media.import',{path:project,file});insist(typeof imp?.createdId==='string','Concat refused media import','CONCAT_IMPORT_FAILED');
   const placed=await c.call('edit.apply',{path:project,command:{op:'addClipAtFirstFree',mediaId:imp.createdId,start}});insist(typeof placed?.createdId==='string','Concat refused clip placement','CONCAT_EDIT_FAILED');
   if(volume!==undefined)await c.call('edit.apply',{path:project,command:{op:'updateClip',clipId:placed.createdId,patch:{volume}}});
   return {mediaId:imp.createdId,clipId:placed.createdId,kind};
  }
  for(const clip of prepared.clips){const item=await add(clip.visual,clip.at,'scene');report.scenes.push({...clip,...item});onProgress({phase:'concat-scenes',done:report.scenes.length,total:prepared.clips.length});}
  report.voiceClipId=(await add(prepared.narration,0,'narration',1)).clipId;
  if(music){
   const sound=path.join(project,'media-ai-project-os','music.m4a');
   await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-stream_loop','-1','-i',music,'-t',String(t.expectedDuration),'-vn','-c:a','aac','-b:a','128k',sound],{timeoutMs:120000});
   report.musicClipId=(await add(sound,0,'music',musicVolume)).clipId;report.sourceLayers.push('music');
  }
  async function text(content,start,length,offsetY,size){
   const res=await c.call('edit.apply',{path:project,command:{op:'addTextClip',trackId:null,above:true,start,duration:length,offsetY,style:{content,fontSize:size,fontWeight:650,color:'#ffffff',strokeWidth:.003,strokeColor:'#101820',shadow:true}}});
   insist(typeof res?.createdId==='string','Concat refused a caption/title','CONCAT_SUBTITLE_FAILED');return res.createdId;
  }
  const heading=String(title||'').replace(/[\r\n\t]/g,' ').trim().slice(0,95);
  if(heading){report.titleClipId=await text(heading,0,Math.min(2.8,t.expectedDuration),-.36,.055);report.sourceLayers.push('title');}
  for(const cue of story.subtitles)report.captionClipIds.push(await text(cue.text,cue.start,cue.end-cue.start,.35,.042));
  await c.call('project.save',{path:project});
  const output=path.join(project,'aios-story.mp4');
  journal={signature,phase:'exporting',project,output,report};jsonWrite(statePath,journal);
  let start;try{start=await c.call('export.run',{path:project,output,width:t.width,height:t.height,rateNum:25,rateDen:1,codec:'h264',crf:20,preset:'medium'});}catch(e){if(e.rpcCode||e.rpcData){jsonWrite(statePath,{...journal,phase:'export-refused'});}throw e;}
  insist(typeof start?.job==='string','Concat did not return an export job','CONCAT_EXPORT_FAILED');journal.exportJob=start.job;jsonWrite(statePath,journal);
  onProgress({phase:'concat-export',job:start.job});
  const done=await c.waitForJob(start.job,600000);
  if(done.method!=='export.done'){jsonWrite(statePath,{...journal,phase:'export-failed'});throw Object.assign(new Error('Concat export failed; narration and pictures remain saved.'),{code:'CONCAT_EXPORT_FAILED'});}
  insist(safeSaved(output)&&fs.statSync(output).size>1000,'Concat did not produce a real MP4','CONCAT_EXPORT_FAILED');
  let qa;try{qa=await verifyFinal({file:output,story,ffmpegBin,ffprobeBin});}catch(e){jsonWrite(statePath,{...journal,phase:'export-failed',error:e.code||'CONCAT_QUALITY'});throw e;}
  report={...report,exported:output,exportSha256:shaFile(output),qa,frameSeconds:prepared.frameSeconds};
  try{await c.call('project.close',{path:project,save:true});report.editorReleased=true;}catch{report.editorReleased=false;}
  jsonWrite(statePath,{signature,phase:'completed',report});onProgress({phase:'complete',sha256:report.exportSha256});return report;
 }finally{c.close();}
}
module.exports={createStoryProject,prepareStoryMedia,validateStory,sceneFilter,verifyFinal};
