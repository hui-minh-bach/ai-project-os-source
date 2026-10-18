'use strict';
const {fs,path,mkdir,run,jsonWrite}=require('../src/utils.cjs');
const {makeLocalPorts}=require('../adapters/local-ports.cjs');
const {demoGateway}=require('../adapters/demo-tts.cjs');
const {registerMediaEngine}=require('../index.cjs');
const {check}=require('../src/quality.cjs');
async function main(){
 const root=path.resolve(__dirname,'..'),workspace=mkdir(path.join(root,'artifacts','demo-workspace'));
 const gateway=demoGateway();const events=[];
 const ports=makeLocalPorts(workspace,{gateway,log:(name,payload)=>events.push({name,...payload})});
 const engine=registerMediaEngine({CoreServices:ports,workspace});
 console.log('REGISTERED',engine.taskNames.join(','));
 const source=path.join(workspace,'source.mp4');
 if(!fs.existsSync(source)){
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y', '-f','lavfi','-i','testsrc2=size=480x270:rate=25:duration=6', '-f','lavfi','-i','sine=frequency=440:duration=6', '-c:v','libx264','-threads','2','-preset','ultrafast','-crf','26','-c:a','aac','-shortest',source],{timeoutMs:120000});
 }
 const analyzed=await ports.TaskQueue.dispatch('media.analyze',{jobId:'demo-analysis',source});
 console.log('ANALYSIS',JSON.stringify({seconds:analyzed.media.seconds,scenes:analyzed.analysis.sceneChanges.length,frames:analyzed.extracted.frames.length}));
 const planned=await ports.TaskQueue.dispatch('media.edit-plan',{jobId:'demo-plan',source,prompt:'Cắt video ngang, rút ngắn video để thử'});
 console.log('PLAN',planned.timeline.origin,planned.timeline.segments.length);
 const output=await ports.TaskQueue.dispatch('media.render',{jobId:'demo-edit',source,editPlan:planned.timeline});
 console.log('EDIT_RENDER',output.final.file,output.qa.passed);
 const text=fs.readFileSync(path.join(root,'examples','truyen-mau.txt'),'utf8');
 console.log('STORY_TEXT_CHARACTERS',text.length);
 const movie=await ports.TaskQueue.dispatch('media.story',{jobId:'demo-story',text,voice:'vi',maxChars:390,resolution:'720p'});
 console.log('STORY_RENDER',movie.final.file,movie.qa.passed,'seconds',movie.final.actualSeconds,'scenes',movie.metadata.sceneCount);
 const draft=await ports.TaskQueue.dispatch('media.publish-draft',{jobId:'demo-draft',channel:'youtube',title:'Demo kể chuyện',video:movie.final.file,rights:'own original demo'});
 const blocked=await ports.TaskQueue.dispatch('media.publish',{jobId:'demo-publish',id:draft.id});
 console.log('PUBLISH_STATUS',blocked.status);
 const report={generatedAt:new Date().toISOString(),engine,analysis:{seconds:analyzed.media.seconds,scenes:analyzed.analysis.sceneChanges.length},edit:{path:output.final.file,qa:output.qa},story:{sourceCharacters:text.length,path:movie.final.file,qa:movie.qa,metadata:movie.metadata},publisher:blocked.status,events:events.length,stt:'BLOCKED: no Whisper model/provider connected, no false transcription',voice:'espeak vi demo (robotic), NOT accepted as natural Vietnamese narration',integration:'CoreServices v1 mock only; host contract unavailable'};
 delete report.engine.probeConcat;
 jsonWrite(path.join(root,'artifacts','validation.json'),report);
 fs.writeFileSync(path.join(root,'artifacts','event-log.json'),JSON.stringify(events,null,2));
 console.log('REPORT',path.join(root,'artifacts','validation.json'));
}
main().catch(e=>{console.error('DEMO_FAILED',e.stack||e);process.exitCode=1});
