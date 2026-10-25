import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createOrchestrator,defaultOrchestratorConfig} from '../src/lib/orchestrator.mjs';
import {automaticProductionPlan,assertProductionReady} from '../src/lib/production-preflight.mjs';
import {customerDeliveryBundle,listProducts} from '../src/lib/product-service.mjs';

const brief='Giới thiệu dịch vụ chụp ảnh sản phẩm trang sức bằng ánh sáng tự nhiên. Chỉ cung cấp dịch vụ chụp ảnh sản phẩm, chưa có khuyến mãi. Đối tượng là cửa hàng trang sức. Lời kêu gọi: liên hệ để nhận báo giá.';
const status=()=>({core:{status:'active'},media:{status:'available',ffmpeg:true,ffprobe:true,windowsTts:{ready:true},localTts:{ready:false},concat:{configured:false},images:{candidates:[{id:'comfyui-local',paid:false}]}}});
const hasFFmpeg=spawnSync('ffmpeg',['-version']).status===0;

function fakeWorld(t,{video=true,audio=true,voice=true,review=true}={}){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'aios-client-v0969-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const mediaWorkspace=path.join(temp,'media');fs.mkdirSync(mediaWorkspace,{recursive:true});
 const mp4=path.join(temp,'actual-video.mp4'),wav=path.join(temp,'voice.wav');
 if(hasFFmpeg&&video){
  const args=['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x123456:s=640x360:r=12:d=3'];
  if(audio)args.push('-f','lavfi','-i','sine=frequency=440:sample_rate=44100:duration=3');
  args.push('-c:v','mpeg4','-q:v','5',...(audio?['-c:a','aac','-b:a','64k']:['-an']),'-t','3',mp4);
  const result=spawnSync('ffmpeg',args,{timeout:20000,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const wave=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=3','-ac','1','-ar','16000',wav],{timeout:15000,encoding:'utf8'});assert.equal(wave.status,0,wave.stderr);
 }
 const artifacts=new Map(),tasks=new Map();let count=0,created=0;
 function add(id,projectId,taskId,name,data){artifacts.set(id,{id,projectId,taskId,name,size:data.length,fileData:data});}
 const host={mediaWorkspace,status,
  submit({projectId,operation}){const id='task-'+(++count);tasks.set(id,{id,projectId,state:'paused'});
   if(operation==='media.story'){
    add(id+'-video',projectId,id,'story-720p-or-source.mp4',fs.readFileSync(mp4));
    if(voice)add(id+'-voice',projectId,id,'voice.wav',fs.readFileSync(wav));
    for(const [name,data] of [['captions.srt','1\n00:00:00,000 --> 00:00:03,000\nVideo demo\n'],['captions.vtt','WEBVTT\n'],['script-final.md','Video demo'],['thumbnail.png','\x89PNG\r\n\x1a\n']])add(id+'-'+name,projectId,id,name,Buffer.from(data));
   }
   return {id,state:'paused'};
  },
  action(id){tasks.get(id).state='approved';},
  core:{queue:{drain:async()=>{for(const task of tasks.values())if(task.state==='approved')task.state='completed';}},state:{find:id=>tasks.get(id)}},
  listArtifacts:id=>[...artifacts.values()].filter(a=>a.projectId===id),
  artifact:id=>{const a=artifacts.get(id);return a?{bytes:a.fileData}:null;},
  publishRecords:{list:()=>[]},refreshPublishMetrics:async()=>[]
 };
 const ai={mode:'gateway',
  writeClientArticle:async()=>{created++;return {text:'Dịch vụ ảnh trang sức: ảnh trung thực, ánh sáng tự nhiên. Liên hệ nhận báo giá.',publishTitle:'Ảnh trang sức',publishDescription:'Liên hệ nhận báo giá.',provider:'fixture-ai',model:'fixture-worker',connectionId:'fixture-worker',kind:'client-content'};},
  writeClientScript:async()=>{created++;return {text:'Bạn đang tìm dịch vụ ảnh trang sức? Hãy liên hệ nhận báo giá chụp ảnh sản phẩm.',publishTitle:'Video quảng cáo',publishDescription:'Thông tin từ khách',provider:'fixture-ai',model:'fixture-worker',connectionId:'fixture-worker',kind:'client-content'};},
  reviewScript:async()=>({approved:review,feedback:review?'Đối chiếu brief đạt':'Thông tin thiếu nguồn',provider:'fixture-reviewer',model:'fixture-reviewer',connectionId:'fixture-reviewer',scope:'brief-only'})
 };
 const orchestrator=createOrchestrator({file:path.join(temp,'runs.json'),host,ingest:{listCards:()=>[],markCardUsed:()=>{}},createProject:()=>({id:'project-real'}),aiAdapters:{gateway:ai,simulated:{mode:'simulated'}},now:()=>new Date('2026-10-24T13:15:00+07:00')});
 return {orchestrator,host,ai,mediaWorkspace,temp,created:()=>created};
}
function parseZip(zip){const entries=new Map();let i=0;while(i+4<zip.length&&zip.readUInt32LE(i)===0x04034b50){const len=zip.readUInt16LE(i+26),extra=zip.readUInt16LE(i+28),size=zip.readUInt32LE(i+18),name=zip.subarray(i+30,i+30+len).toString(),start=i+30+len+extra;entries.set(name,zip.subarray(start,start+size));i=start+size;}return entries;}

test('client article auto plan requires no TTS/FFmpeg and never authorizes payment',()=>{
 const offline={status:()=>({core:{status:'active'},media:{status:'offline',ffmpeg:false,ffprobe:false}})};
 assert.equal(automaticProductionPlan(offline,'client-article').kind,'article');
 assert.doesNotThrow(()=>assertProductionReady(offline,'client-article',{}));
 assert.throws(()=>automaticProductionPlan(offline,'client-video'),{code:'MEDIA_DEPENDENCY'});
});

test('client article: real adapter path -> separate Reviewer -> local approval -> complete customer ZIP + SHA',async t=>{
 const w=fakeWorld(t,{video:false});const run=await w.orchestrator.startRun('client-article',{projectId:'project-real',title:'Ảnh trang sức',ideaText:brief,requestId:'brief-001',requireReview:true,deliverOnly:true});
 assert.equal(run.state,'awaiting-approval');assert.equal(run.review.approved,true);assert.equal(run.aiMode,'gateway');assert.equal(w.created(),1);
 const replay=await w.orchestrator.startRun('client-article',{projectId:'project-real',title:'Ảnh trang sức',ideaText:brief,requestId:'brief-001',requireReview:true,deliverOnly:true});
 assert.equal(replay.id,run.id);assert.equal(w.created(),1,'must never duplicate same order');
 const delivered=w.orchestrator.receiveRun(run.id);assert.equal(delivered.state,'completed');assert.equal(delivered.receivedLocally,true);
 const pkg=customerDeliveryBundle(delivered,{host:w.host});const entries=parseZip(pkg.bytes);
 assert.ok(entries.has('deliverables/article-final.md'));assert.ok(entries.has('manifest.json'));
 const manifest=JSON.parse(entries.get('manifest.json'));assert.equal(manifest.aiMode,'gateway');
 assert.equal(manifest.approvedBy.model,'fixture-reviewer');
 for(const f of manifest.files)assert.equal(crypto.createHash('sha256').update(entries.get('deliverables/'+f.name)).digest('hex'),f.sha256);
 assert.equal(crypto.createHash('sha256').update(pkg.bytes).digest('hex'),pkg.metadata.sha256);
 assert.match(entries.get('deliverables/article-final.md').toString(),/Liên hệ nhận báo giá/);
});

test('client reviewer rejection blocks delivery instead of returning draft',async t=>{
 const w=fakeWorld(t,{video:false,review:false});const r=await w.orchestrator.startRun('client-article',{projectId:'project-real',title:'Lỗi',ideaText:brief,requireReview:true,deliverOnly:true});
 assert.equal(r.state,'failed');assert.equal(r.error.code,'MEDIA_REVIEW_REJECTED');
 assert.throws(()=>customerDeliveryBundle(r,{host:w.host}),{code:'CLIENT_DELIVERY_NOT_READY'});
});

test('client video: actual FFmpeg audio/video passes mandatory QA, ZIP includes six real artifacts', {skip:!hasFFmpeg},async t=>{
 const w=fakeWorld(t);const r=await w.orchestrator.startRun('client-video',{projectId:'project-real',title:'Video mẫu',ideaText:brief,requestId:'brief-002',requireReview:true,deliverOnly:true,renderEngine:'ffmpeg',voiceMode:'narrated',ttsProvider:'windows'});
 assert.equal(r.state,'awaiting-approval',JSON.stringify(r.error));assert.match(r.quality.checkedBy,/ffprobe/);assert.ok(r.quality.seconds>=2);assert.equal(r.quality.width,640);assert.equal(r.quality.audioCodec,'aac');
 const delivered=w.orchestrator.receiveRun(r.id);const bundle=customerDeliveryBundle(delivered,{host:w.host});const files=parseZip(bundle.bytes);
 for(const name of ['video-final.mp4','voice.wav','captions.srt','captions.vtt','script-final.md','thumbnail.png'])assert.ok(files.has('deliverables/'+name),name);
 const format=spawnSync('ffprobe',['-v','error','-show_entries','stream=codec_type','-of','csv=p=0','-'],{input:files.get('deliverables/video-final.mp4'),encoding:'utf8'});
 assert.equal(format.status,0,format.stderr);assert.match(format.stdout,/video/);assert.match(format.stdout,/audio/);
});

test('client video: silent MP4 and missing WAV fail closed and never offer delivery ZIP', {skip:!hasFFmpeg},async t=>{
 const w=fakeWorld(t,{audio:false});const silent=await w.orchestrator.startRun('client-video',{projectId:'project-real',title:'Video không tiếng',ideaText:brief,requireReview:true,deliverOnly:true,voiceMode:'narrated'});
 assert.equal(silent.state,'failed');assert.equal(silent.error.code,'CLIENT_VIDEO_QUALITY');
 assert.throws(()=>customerDeliveryBundle(silent,{host:w.host}),{code:'CLIENT_DELIVERY_NOT_READY'});
 const w2=fakeWorld(t,{voice:false});const noVoice=await w2.orchestrator.startRun('client-video',{projectId:'project-real',title:'Video thiếu WAV',ideaText:brief,requireReview:true,deliverOnly:true,voiceMode:'narrated'});
 assert.equal(noVoice.state,'failed');assert.equal(noVoice.error.code,'CLIENT_MEDIA_FILES');
});


test('old v0.9.68 persisted orchestration config keeps caps and gains client pipelines safely',t=>{
 const w=fakeWorld(t,{video:false});
 const legacy={config:{enabled:false,stopAll:false,pipelines:{'news-video':{dailyCap:7,aiMode:'gateway',requireApproval:true}}},runs:[]};
 fs.writeFileSync(path.join(w.temp,'runs.json'),JSON.stringify(legacy));
 const reread=createOrchestrator({file:path.join(w.temp,'runs.json'),host:w.host,ingest:{listCards:()=>[]},createProject:()=>({id:'existing'}),aiAdapters:{gateway:w.ai}});
 const cfg=reread.getConfig();assert.equal(cfg.pipelines['news-video'].dailyCap,7);assert.equal(cfg.pipelines['client-article'].aiMode,'gateway');assert.equal(cfg.pipelines['client-video'].enabled,false);
});


test('separate client projects may deliver independently while prior customer awaits receipt',async t=>{
 const w=fakeWorld(t,{video:false});
 const one=await w.orchestrator.startRun('client-article',{projectId:'customer-a',title:'Khách A',ideaText:brief,requestId:'order-A',requireReview:true,deliverOnly:true});
 assert.equal(one.state,'awaiting-approval');
 const two=await w.orchestrator.startRun('client-article',{projectId:'customer-b',title:'Khách B',ideaText:brief,requestId:'order-B',requireReview:true,deliverOnly:true});
 assert.equal(two.state,'awaiting-approval');
 assert.notEqual(one.id,two.id);
 const delivery=w.orchestrator.receiveRun(two.id);
 const zip=customerDeliveryBundle(delivery,{host:w.host});
 assert.ok(parseZip(zip.bytes).has('deliverables/article-final.md'));
 assert.equal(w.orchestrator.getRun(one.id).state,'awaiting-approval');
});
