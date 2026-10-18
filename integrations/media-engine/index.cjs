'use strict';
const {fs,path,insist,within,mkdir,sha,jsonRead,jsonWrite}=require('./src/utils.cjs');
const importer=require('./src/importer.cjs'),analyzer=require('./src/analyzer.cjs'),transcript=require('./src/transcript.cjs'),subtitles=require('./src/subtitles.cjs');
const timeline=require('./src/timeline.cjs'),renderer=require('./src/renderer.cjs'),quality=require('./src/quality.cjs'),story=require('./src/story.cjs');
const {Publisher}=require('./src/publisher.cjs'),concat=require('./src/concat.cjs');
// CoreServices v1 boundary: no direct web application, Vault, TaskQueue core, or router modifications.
// Pass a dedicated adapter when the host uses different method names. All four ports are mandatory.
function registerMediaEngine({CoreServices,workspace,ffmpegBin='ffmpeg',ffprobeBin='ffprobe',pythonBin=process.platform==='win32'?'py':'python3',limits={}}){
 insist(CoreServices&&workspace,'CoreServices and workspace required');
 const {TaskQueue,ProviderGateway,ArtifactStore,EventBus}=CoreServices;
 insist(typeof TaskQueue?.registerTask==='function','TaskQueue.registerTask required');
 insist(typeof ProviderGateway?.invoke==='function','ProviderGateway.invoke required');
 insist(typeof ArtifactStore?.putFile==='function'&&typeof ArtifactStore?.putJson==='function','ArtifactStore file and JSON ports required');
 insist(typeof EventBus?.publish==='function','EventBus.publish required');
 let activeJobs=0;const maxConcurrent=Math.max(1,Math.min(4,limits.maxConcurrentJobs||1));
 const root=mkdir(path.resolve(workspace)),publisher=new Publisher(mkdir(path.join(root,'.media-engine')));
 const jobDir=id=>mkdir(within(root,path.join('.media-engine','jobs',String(id).replace(/[^a-zA-Z0-9_-]/g,'_')),false));
 async function task(name,handler){TaskQueue.registerTask('media.'+name,async({jobId,...payload})=>{
   insist(/^[a-zA-Z0-9_-]{1,90}$/.test(String(jobId)),'Invalid jobId');
   EventBus.publish('media.progress',{jobId,operation:name,status:'STARTED',percent:0});
   const resourceHeavy=['analyze','render','story'].includes(name);
   if(resourceHeavy&&activeJobs>=maxConcurrent)throw Object.assign(new Error('Media worker concurrency limit; TaskQueue should retry'),{code:'RESOURCE_BUSY'});
   if(resourceHeavy)activeJobs++;
   try{const result=await handler({jobId,...payload},jobDir(jobId));
    EventBus.publish('media.progress',{jobId,operation:name,status:'DONE',percent:100});return result;
   }catch(e){EventBus.publish('media.progress',{jobId,operation:name,status:e.code?.startsWith('BLOCKED')?'BLOCKED':'FAILED',error:e.message});throw e;}
   finally{if(resourceHeavy)activeJobs--;}
 });}
 async function save(jobId,data,files=[]){
  const written=[];
  for(const [name,source] of files){if(source)written.push({name,...await ArtifactStore.putFile({jobId,source,name})});}
  const meta=await ArtifactStore.putJson({jobId,name:'manifest.json',data});
  return {manifest:meta,artifacts:written};
 }
 task('analyze',async({jobId,source,transcribe=false,language='vi'},dir)=>{
  const media=await importer.importMedia({workspace:root,source,maxBytes:limits.maxBytes,maxSeconds:limits.maxSeconds,ffprobeBin});
  const state=path.join(dir,'analyze-'+media.sha256+'.json');let result=jsonRead(state);
  if(!result){const files=await importer.extract({source:media.path,dir:path.join(dir,'extract'),frames:3,seconds:media.seconds,ffmpegBin});
    const analysis=await analyzer.analyze({media,ffmpegBin});result={media,analysis,extracted:files};jsonWrite(state,result);}
  if(transcribe){insist(result.extracted.audio,'Media has no audio','BLOCKED_STT');
   result.transcript=await transcript.transcribe({gateway:ProviderGateway,audio:result.extracted.audio,language});
   fs.writeFileSync(path.join(dir,'captions.srt'),subtitles.srt(result.transcript));
   fs.writeFileSync(path.join(dir,'captions.vtt'),subtitles.vtt(result.transcript));jsonWrite(state,result);
  }
  const files=[['source'+path.extname(media.path),media.path],['audio.wav',result.extracted.audio],...result.extracted.frames.map((x,i)=>[`frame-${i+1}.jpg`,x])];
  if(result.transcript)files.push(['captions.srt',path.join(dir,'captions.srt')],['captions.vtt',path.join(dir,'captions.vtt')]);
  return {...result,saved:await save(jobId,{media:result.media,analysis:result.analysis,transcript:result.transcript||null},files)};
 });
 task('subtitle-edit',async({jobId,segments,changes,translation=null},dir)=>{
  const changed=subtitles.edit(segments,changes||[]);const finalSegments=translation?await transcript.translate({gateway:ProviderGateway,segments:changed,targetLanguage:translation}):changed;
  const srt=path.join(dir,'captions.srt'),vtt=path.join(dir,'captions.vtt');fs.writeFileSync(srt,subtitles.srt(finalSegments));fs.writeFileSync(vtt,subtitles.vtt(finalSegments));
  return {segments:finalSegments,saved:await save(jobId,{segments:finalSegments},[['captions.srt',srt],['captions.vtt',vtt]])};
 });
 task('edit-plan',async({jobId,source,prompt,analysis},dir)=>{
  const media=await importer.importMedia({workspace:root,source,maxBytes:limits.maxBytes,maxSeconds:limits.maxSeconds,ffprobeBin});
  const edit=await timeline.plan({gateway:{invoke:request=>ProviderGateway.invoke({...request,jobId})},prompt,media,analysis});jsonWrite(path.join(dir,'timeline.json'),edit);
  return {timeline:edit,saved:await save(jobId,{timeline:edit})};
 });
 // Single approved task: actual scene boundaries, crossfades, optional local Whisper captions.
 // The user's model is consulted only after task approval. No raw JSON input.
 task('quick-edit',async({jobId,source,prompt,autoCaptions=false,audioStreamIndex=null},dir)=>{
  insist(typeof prompt==='string'&&prompt.trim()&&prompt.length<=4000,'Quick edit needs clear instructions','MEDIA_INPUT');
  const media=await importer.importMedia({workspace:root,source,maxBytes:limits.maxBytes,maxSeconds:limits.maxSeconds,ffprobeBin});
  const needsSceneAnalysis=/im lặng|khoảng lặng|silence|phân cảnh|phân tích cảnh|cảnh quay|cắt cảnh|chuyển cảnh|mượt|tự động|highlight|montage|scene|transition/i.test(prompt);
  const analysis=needsSceneAnalysis?await analyzer.analyze({media,ffmpegBin}):undefined;
  const plan=await timeline.plan({gateway:{invoke:request=>ProviderGateway.invoke({...request,jobId})},prompt,media,analysis,audioStreamIndex});
  const onProgress=p=>EventBus.publish('media.progress',{jobId,operation:'quick-edit',...p});
  const preview=await renderer.render({timeline:plan,jobDir:dir,ffmpegBin,ffprobeBin,preview:true,onProgress});
  let captionFile=null,captionSegments=null,vttFile=null;
  if(autoCaptions){
    // Transcribe the EDITED audio: source timestamps cannot be reused after trims or crossfades.
    const wav=path.join(dir,'transcribe-edited-audio.wav');
    await require('./src/utils.cjs').run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-i',preview.file,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',wav],{timeoutMs:120000});
    captionSegments=await transcript.transcribe({gateway:{invoke:request=>ProviderGateway.invoke({...request,jobId})},audio:wav,language:'vi'});
    captionFile=path.join(dir,'captions.srt');vttFile=path.join(dir,'captions.vtt');
    fs.writeFileSync(captionFile,subtitles.srt(captionSegments));fs.writeFileSync(vttFile,subtitles.vtt(captionSegments));
  }
  const final=await renderer.render({timeline:plan,jobDir:dir,ffmpegBin,ffprobeBin,subtitle:captionFile,onProgress});
  const qa=await quality.check({file:final.file,expectedDuration:plan.expectedDuration,ffmpegBin,ffprobeBin,subtitleSegments:captionSegments});
  insist(qa.passed,'Quality checker failed: '+qa.problems.join(','),'QUALITY_FAILED');
  const timelinePath=path.join(dir,'timeline.json');jsonWrite(timelinePath,plan);
  const saved=await save(jobId,{timeline:plan,analysis:analysis?{sceneChanges:analysis.sceneChanges,silences:analysis.silences}:null,origin:plan.origin,qa,preview,final,captions:captionSegments?{origin:'whisper.cpp-local-real-audio',segments:captionSegments.length}:null},[['preview.mp4',preview.file],['final.mp4',final.file],['timeline.json',timelinePath],['captions.srt',captionFile],['captions.vtt',vttFile]]);
  return {timeline:plan,preview,final,qa,saved};
 });
 task('render',async({jobId,source,editPlan,subtitleSegments,music,quality:qualityProfile},dir)=>{
  const media=await importer.importMedia({workspace:root,source,maxBytes:limits.maxBytes,maxSeconds:limits.maxSeconds,ffprobeBin});
  insist(editPlan?.schemaVersion===2&&editPlan.sourceSha256&&editPlan.sourceArtifactId,'Kế hoạch cũ thiếu dấu vân tay video. Chọn Dựng lại từ video gốc.','MEDIA_PLAN_SOURCE');
  const edit=timeline.validate(editPlan,media);const subtitle=subtitleSegments?path.join(dir,'captions.srt'):null;
  if(subtitle)fs.writeFileSync(subtitle,subtitles.srt(subtitleSegments));
  const sound=music?within(root,music):null;
  const onProgress=p=>EventBus.publish('media.progress',{jobId,operation:'render',...p});
  const preview=await renderer.render({timeline:edit,jobDir:dir,ffmpegBin,ffprobeBin,preview:true,subtitle,music:sound,onProgress});
  const final=await renderer.render({timeline:edit,jobDir:dir,ffmpegBin,ffprobeBin,subtitle,music:sound,onProgress,quality:qualityProfile||'high'});
  const qa=await quality.check({file:final.file,expectedDuration:edit.expectedDuration,ffmpegBin,ffprobeBin,subtitleSegments});
  insist(qa.passed,'Quality checker failed: '+qa.problems.join(','),'QUALITY_FAILED');
  const timelineFile=path.join(dir,'timeline.json');jsonWrite(timelineFile,edit);
  const saved=await save(jobId,{edit,preview,final,qa},[['preview.mp4',preview.file],['final.mp4',final.file],['timeline.json',timelineFile],['captions.srt',subtitle]]);
  return {preview,final,qa,saved};
 });
 task('story',async({jobId,text,source,voice='vi',mode='verbatim',allowProviderImages=false,music,maxChars=420,resolution='720p',rights='unspecified',rate=1,volume=1,emotion='neutral',transition,transitionSeconds,quality:qualityProfile},dir)=>{
  const made=await story.buildStory({workspace:root,text,source,jobDir:dir,gateway:ProviderGateway,voice,mode,allowProviderImages,ffprobeBin,ffmpegBin,python:pythonBin,maxChars,resolution,rights,rate,volume,emotion,transition,transitionSeconds});
  const onProgress=p=>EventBus.publish('media.progress',{jobId,operation:'story',...p});
  const sound=music?within(root,music):null,subtitle=path.join(dir,'captions.srt');
  const preview=await renderer.render({timeline:made.timeline,jobDir:dir,ffmpegBin,ffprobeBin,preview:true,subtitle,music:sound,onProgress});
  const final=await renderer.render({timeline:made.timeline,jobDir:dir,ffmpegBin,ffprobeBin,subtitle,music:sound,onProgress,quality:qualityProfile||'high'});
  const qa=await quality.check({file:final.file,expectedDuration:made.timeline.expectedDuration,ffmpegBin,ffprobeBin,subtitleSegments:made.subtitles});
  insist(qa.passed,'Story quality failed: '+qa.problems.join(','),'QUALITY_FAILED');
  const storyboardFile=path.join(dir,'storyboard.json');
  const saved=await save(jobId,{metadata:made.metadata,timeline:made.timeline,qa,preview,final},[['story-720p-or-source.mp4',final.file],['preview.mp4',preview.file],['captions.srt',subtitle],['captions.vtt',path.join(dir,'captions.vtt')],['storyboard.json',storyboardFile]]);
  return {metadata:made.metadata,timeline:made.timeline,preview,final,qa,saved};
 });
 task('publish-draft',async({jobId,...draft})=>{const video=within(root,draft.video);const d=publisher.createDraft({...draft,video});await save(jobId,{draft:d});return d;});
 task('publish',async({id})=>publisher.publish(id)); // V10 is intentionally HARD LOCKED; no OAuth adapter exists here.
 return {name:'media-engine',version:'0.1.0',taskNames:['media.analyze','media.subtitle-edit','media.edit-plan','media.quick-edit','media.render','media.story','media.publish-draft','media.publish'],status:{v07:'partial-stt-requires-provider',v08:'ffmpeg-render',v09:'tts-requires-real-provider',v10:'BLOCKED'},probeConcat:settings=>concat.probe(settings)};
}
module.exports={registerMediaEngine};
