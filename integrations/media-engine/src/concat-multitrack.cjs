'use strict';
/** Real Concat JSON-RPC multitrack project builder. This is an independent API
 * client, not a copy of Concat's AGPL code. Concat must already be running on
 * localhost with Remote enabled; no credentials leave the machine.
 *
 * FFmpeg prepares *separate* source scene clips for Concat, not a previously
 * flattened master. The Concat document owns video/audio/title tracks and
 * transitions, and the editor's own export.run performs the final export.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {run,ffprobe,duration,shaFile,insist} = require('./utils.cjs');
const subtitles = require('./subtitles.cjs');
const {createSession,probe} = require('./concat.cjs');

function fileInside(workspace, input){
  insist(typeof input==='string'&&input.length>0,'Missing Concat input file','MEDIA_INPUT');
  const base=fs.realpathSync(workspace), target=fs.realpathSync(path.resolve(base,input));
  insist(target.startsWith(base+path.sep)&&fs.statSync(target).isFile(),
    'Concat cannot use files outside its workspace','FORBIDDEN_PATH');
  return target;
}
function ratioFilter(timeline){
  const w=timeline.width,h=timeline.height;
  insist(Number.isInteger(w)&&w>=160&&w<=3840&&Number.isInteger(h)&&h>=160&&h<=3840,'Invalid output frame size','MEDIA_INPUT');
  return timeline.framing==='crop'
    ?`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=25,format=yuv420p`
    :`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25,format=yuv420p`;
}
function readSrt(file,seconds){
  if(!file)return [];
  const cues=subtitles.parseSrt(fs.readFileSync(file,'utf8'));
  insist(cues.length<=120,'Concat accepts up to 120 subtitle cues in this release','MEDIA_CAPTIONS_LIMIT');
  insist(cues.every(c=>c.end<=seconds+0.25&&c.text.length<=180),
    'Subtitle timings/text do not match the edited video','MEDIA_CAPTIONS_RANGE');
  return cues;
}
function validateTimeline(timeline){
  insist(timeline&&timeline.kind==='edit'&&Array.isArray(timeline.segments)&&timeline.segments.length>0,
    'A real edit timeline is required','MEDIA_INPUT');
  insist(timeline.segments.length<=24,'Concat multitrack beta supports a maximum of 24 scenes','MEDIA_CONCAT_LIMIT');
  const sum=timeline.segments.reduce((s,c)=>s+Number(c.end)-Number(c.start),0);
  insist(Number.isFinite(sum)&&sum>0&&sum<=300,'Concat multitrack beta supports clips up to five minutes','MEDIA_CONCAT_LIMIT');
  for(const c of timeline.segments)insist(Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end-c.start>=.15,
    'Invalid source scene','MEDIA_PLAN_RANGE');
  const overlap=['crossfade','fadeblack','slideleft','slideright','wipeleft'].includes(timeline.transition)&&timeline.segments.length>1 ? Number(timeline.transitionSeconds||0) : 0;
  insist(Number.isFinite(overlap)&&overlap>=0&&overlap<=.75,'Invalid transition duration','MEDIA_TRANSITION');
  return {overlap,seconds:sum-overlap*(timeline.segments.length-1)};
}
async function makeMedia({workspace,source,timeline,jobId,ffmpegBin,ffprobeBin}){
  const base=fs.realpathSync(workspace),src=fileInside(base,source),track=validateTimeline(timeline);
  // Make unique directories for retries. Never mutate a project created by
  // a previous run or share temporary clips across two approved tasks.
  const suffix=crypto.randomUUID().slice(0,8);
  const name=`aios-${jobId.slice(0,50)}-${suffix}`;
  const location=path.join(base,'concat-projects');
  const clipsDir=path.join(base,'.concat-sources',name);
  fs.mkdirSync(clipsDir,{recursive:true,mode:0o700});
  fs.mkdirSync(location,{recursive:true,mode:0o700});
  const info=await ffprobe(src,ffprobeBin), audioTracks=info.streams.filter(s=>s.codec_type==='audio');
  const selectedIndex=timeline.audioStreamIndex==null?audioTracks[0]?.index:timeline.audioStreamIndex;
  const foundAudio=audioTracks.some(s=>s.index===selectedIndex);
  const clips=[], filter=ratioFilter(timeline);
  let startAt=0;
  for(let i=0;i<timeline.segments.length;i++){
    const item=timeline.segments[i],length=item.end-item.start;
    const visual=path.join(clipsDir,`scene-${String(i+1).padStart(3,'0')}.mp4`);
    await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-ss',String(item.start),'-i',src,'-t',String(length),'-map','0:v:0','-vf',filter,'-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','23','-r','25','-pix_fmt','yuv420p','-movflags','+faststart',visual],{timeoutMs:Math.max(90000,Math.min(300000,Math.ceil(length*10000)))});
    const probed=await ffprobe(visual,ffprobeBin);
    insist(fs.statSync(visual).size>1000&&Math.abs(duration(probed)-length)<Math.max(.25,length*.06),
      'Concat source clip failed FFprobe/duration check','CONCAT_CLIP_QA');
    let sound=null;
    if(foundAudio){
      sound=path.join(clipsDir,`sound-${String(i+1).padStart(3,'0')}.wav`);
      await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-ss',String(item.start),'-i',src,'-t',String(length),'-map',`0:${selectedIndex}`,'-vn','-ac','2','-ar','44100','-c:a','pcm_s16le',sound],{timeoutMs:Math.max(90000,Math.ceil(length*5000))});
      insist(fs.statSync(sound).size>500,'Empty source audio segment','CONCAT_CLIP_QA');
    }
    clips.push({index:i+1,visual,sound,at:Number(startAt.toFixed(4)),length:Number(length.toFixed(4)),start:item.start,end:item.end,sha256:shaFile(visual)});
    startAt+=length-track.overlap;
  }
  insist(Math.abs(startAt+track.overlap-track.seconds)<.01,'Concat video scene positions inconsistent','CONCAT_TIMELINE');
  return {name,location,clipsDir,source:src,sourceSha256:shaFile(src),clips,seconds:track.seconds,overlap:track.overlap};
}

async function createMultitrackProject({settings,workspace,source,timeline,jobId,captionsSource=null,narrationSource=null,musicSource=null,title='',musicVolume=.12,exportVideo=true,ffmpegBin='ffmpeg',ffprobeBin='ffprobe'}){
  insist(/^[A-Za-z0-9_-]{1,90}$/.test(jobId),'Unsafe Concat job identifier','FORBIDDEN_PATH');
  const base=fs.realpathSync(workspace),resolvedSource=fileInside(base,source);
  for(const c of timeline?.segments||[])if(c.source)insist(path.resolve(c.source)===resolvedSource,
    'Scene references a different source video','MEDIA_PLAN_SOURCE');
  const sourceDigest=shaFile(resolvedSource);
  insist(!timeline?.sourceSha256||timeline.sourceSha256===sourceDigest,
    'Video changed after its plan was created','MEDIA_PLAN_SOURCE');
  const captionFile=captionsSource?fileInside(base,captionsSource):null;
  const voice=narrationSource?fileInside(base,narrationSource):null;
  const music=musicSource?fileInside(base,musicSource):null;
  // Check every input path BEFORE contacting Concat, then fail fast if it is
  // offline instead of spending seconds encoding throwaway scene clips.
  try{await probe({...settings,timeoutMs:3000});}
  catch(e){if(['FORBIDDEN_NETWORK','BLOCKED_AUTH'].includes(e.code))throw e;
    const failure=new Error('Concat Remote chua san sang. Mo Concat, bat Settings > Remote tren localhost va kiem tra token, sau do thu lai.');
    failure.code='BLOCKED_CONCAT';throw failure;} 
  const prepared=await makeMedia({workspace:base,source:resolvedSource,timeline,jobId,ffmpegBin,ffprobeBin});
  if(voice){
    const voiceInfo=await ffprobe(voice,ffprobeBin);
    insist(voiceInfo.streams.some(s=>s.codec_type==='audio')&&duration(voiceInfo)<=prepared.seconds+.25,
      'The narration is longer than the planned video. Shorten narration or lengthen the edit before Concat export.',
      'CONCAT_VOICE_DURATION');
  }
  let soundBed=music;
  if(music){
    soundBed=path.join(prepared.clipsDir,'background-music.m4a');
    await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y',
      '-stream_loop','-1','-i',music,'-t',String(prepared.seconds),'-vn','-map','0:a:0',
      '-c:a','aac','-b:a','128k',soundBed],{timeoutMs:120000});
  }
  const cues=readSrt(captionFile,prepared.seconds);
  const cleanTitle=String(title||'').replace(/[\r\n\t]/g,' ').trim().slice(0,95);
  insist(Number.isFinite(Number(musicVolume))&&musicVolume>=0&&musicVolume<=.4,'Invalid soundtrack level','MEDIA_INPUT');
  const c=createSession({...settings,timeoutMs:15000,requestTimeoutMs:60000});
  let project=null;
  const report={kind:'concat-multitrack',version:1,engine:'concat-json-rpc-0.2',
    planOrigin:timeline.origin||'unknown',sourceSha256:sourceDigest,
    requested:timeline.segments.length,scenes:[],separateAudioClips:[],voiceClipId:null,musicClipId:null,
    titleClipId:null,captionClipIds:[],transitionIds:[],transitionsSkipped:[],expectedSeconds:prepared.seconds,sourceLayers:[],project:null};
  async function importAdd(file,at,kind,volume=null){
    const imported=await c.call('media.import',{path:project,file});
    const mediaId=imported?.createdId;
    insist(typeof mediaId==='string'&&/^m[\w-]+$/i.test(mediaId),`Concat refused to import ${kind}`, 'CONCAT_IMPORT_FAILED');
    const placement=await c.call('edit.apply',{path:project,command:{op:'addClipAtFirstFree',mediaId,start:at}});
    const clipId=placement?.createdId;
    insist(typeof clipId==='string'&&/^c[\w-]+$/i.test(clipId),`Concat refused to place ${kind}`,'CONCAT_EDIT_FAILED');
    if(volume!==null)await c.call('edit.apply',{path:project,command:{op:'updateClip',clipId,patch:{volume}}});
    return {mediaId,clipId};
  }
  try{
    const version=await c.call('version');
    insist(String(version?.apiVersion||'').startsWith('0.2'),
      'Concat JSON-RPC API 0.2 is required for multitrack editing','BLOCKED_CONCAT');
    // The legacy `cross-fade` id is built into Concat 0.2 and is not a
    // catalogue package. Do not gate it on catalogue.list('transition').
    // Concat beta currently has a multi-transition layer-ordering bug when
    // captions/titles overlay 3+ consecutive scenes. Fail safe to hard cuts
    // for that specific case until the installed editor is fixed.
    const overlayRisk=prepared.clips.length>2&&(cues.length>0||cleanTitle.length>0);
    const canCrossfade=prepared.overlap>0&&!overlayRisk;
    if(prepared.overlap>0&&overlayRisk){
      let position=0;
      for(const item of prepared.clips){item.at=Number(position.toFixed(4));position+=item.length;}
      report.expectedSeconds=position;
      report.transitionsSkipped.push('Concat beta may hide captions/titles after repeated cross-fades; used safe cuts to preserve text');
    }
    await c.call('project.create',{location:prepared.location,name:prepared.name,
      video:{width:timeline.width,height:timeline.height,rateNum:25,rateDen:1}});
    project=path.join(prepared.location,prepared.name);report.project=project;
    // Keep generated video, audio and soundtrack INSIDE the editable Concat
    // project so moving/backing up its folder does not break every scene.
    const localMedia=path.join(project,'media-ai-project-os');
    fs.renameSync(prepared.clipsDir,localMedia);
    const rehome=f=>f&&path.join(localMedia,path.relative(prepared.clipsDir,f));
    for(const item of prepared.clips){item.visual=rehome(item.visual);item.sound=rehome(item.sound);}
    if(soundBed&&soundBed!==music)soundBed=rehome(soundBed);
    let localVoice=voice;
    if(voice){
      const ext=path.extname(voice).toLowerCase();
      localVoice=path.join(localMedia,'narration'+(ext||'.wav'));
      fs.copyFileSync(voice,localVoice,fs.constants.COPYFILE_EXCL);
    }
    // Each original scene is a separate import and *editable clip*, not a
    // flattened MP4. Imported original audio becomes its own track.
    for(let i=0;i<prepared.clips.length;i++){
      const item=prepared.clips[i];const added=await importAdd(item.visual,item.at,'video');
      report.scenes.push({...item,clipId:added.clipId,mediaId:added.mediaId});
      if(i>0&&prepared.overlap>0&&canCrossfade){
        await c.call('edit.apply',{path:project,command:{op:'updateClip',clipId:added.clipId,
          patch:{transitionIn:{id:'cross-fade',duration:prepared.overlap}}}});
        report.transitionIds.push(added.clipId);
      }
    }
    // Import source audio on separate lanes; mute/duck it when a new voice exists.
    for(const item of prepared.clips)if(item.sound){
      const added=await importAdd(item.sound,item.at,'source-audio',voice?.18:1);
      report.separateAudioClips.push({...added,at:item.at});
    }
    if(localVoice){const added=await importAdd(localVoice,0,'narration',1);report.voiceClipId=added.clipId;}
    if(soundBed){const added=await importAdd(soundBed,0,'music',musicVolume);report.musicClipId=added.clipId;}
    if(cleanTitle){
      const res=await c.call('edit.apply',{path:project,command:{op:'addTextClip',trackId:null,above:true,start:0,
        duration:Math.min(2.8,report.expectedSeconds),offsetY:-.28,
        style:{content:cleanTitle,fontSize:.065,fontWeight:700,color:'#ffffff',strokeWidth:.003,strokeColor:'#151515',shadow:true}}});
      insist(typeof res?.createdId==='string','Concat did not create the title layer','CONCAT_TITLE_FAILED');
      report.titleClipId=res.createdId;
    }
    for(const cue of cues){
      const res=await c.call('edit.apply',{path:project,command:{op:'addTextClip',trackId:null,above:true,
        start:cue.start,duration:cue.end-cue.start,offsetY:.37,
        style:{content:cue.text,fontSize:.048,fontWeight:650,color:'#ffffff',strokeWidth:.003,strokeColor:'#111111',shadow:true}}});
      insist(typeof res?.createdId==='string','Concat did not create a subtitle clip','CONCAT_SUBTITLE_FAILED');
      report.captionClipIds.push(res.createdId);
    }
    await c.call('project.save',{path:project});
    report.concatVersion=version.concat||null;
    report.sourceLayers=['video',...(report.separateAudioClips.length?['original-audio']:[]),...(voice?['narration']:[]),...(music?['music']:[]),...(cleanTitle?['title']:[]),...(cues.length?['captions']:[])];
    if(exportVideo){
      const output=path.join(project,'aios-export.mp4');
      const started=await c.call('export.run',{path:project,output,width:timeline.width,height:timeline.height,rateNum:25,rateDen:1});
      insist(typeof started?.job==='string'&&started.job.length>0,'Concat did not start export','CONCAT_EXPORT_FAILED');
      const ended=await c.waitForJob(started.job,600000);
      insist(ended.method==='export.done',`Concat export failed: ${String(ended.params?.error?.message||ended.params?.message||'unknown')}`,'CONCAT_EXPORT_FAILED');
      insist(fs.existsSync(output)&&fs.statSync(output).size>1000,'Concat did not create an MP4','CONCAT_EXPORT_FAILED');
      report.exported=output;report.exportSha256=shaFile(output);
    }
    // Source check again because queued operations can take minutes.
    insist(shaFile(prepared.source)===prepared.sourceSha256,'Video changed during Concat edit','MEDIA_PLAN_SOURCE');
    return report;
  }finally{
    c.close();
    if(!project)fs.rmSync(prepared.clipsDir,{recursive:true,force:true});
  }
}
module.exports={createMultitrackProject,validateTimeline,fileInside};
