import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {whisperStatus} from '../src/lib/local-whisper.mjs';
const require=createRequire(import.meta.url);
const {naturalPlan,validate}=require('../integrations/media-engine/src/timeline.cjs');
const {render}=require('../integrations/media-engine/src/renderer.cjs');
const {analyze}=require('../integrations/media-engine/src/analyzer.cjs');
const {ffprobe,duration}=require('../integrations/media-engine/src/utils.cjs');
const bin=b=>!spawnSync(b,['-version'],{timeout:3000,stdio:'ignore'}).error;

test('Scene plans are genuinely bounded, with timeline crossfade overlap and no invented visual understanding',()=>{
 const media={path:'/tmp/video.mp4',seconds:8};const plan=validate(naturalPlan('tự phân tích cảnh và chuyển cảnh mượt 9:16',media,{sceneChanges:[1.5,3.1,5.2],silences:[]}),media);
 assert.equal(plan.segments.length,4);assert.equal(plan.transition,'crossfade');assert.ok(Math.abs(plan.expectedDuration-(8-3*plan.transitionSeconds))<1e-8);
 assert.match(plan.notes.join(' '),/KHÔNG phải AI/);
 assert.throws(()=>validate({...plan,transition:'shell'},media),/Unsupported transition/);
 assert.equal(whisperStatus({WHISPER_MODEL_PATH:'/does/not/exist',WHISPER_CLI_PATH:'/does/not/exist'}).ready,false);
});

test('Short reel preserves measured scene boundaries and smooth transitions',()=>{
 const media={path:'/tmp/video.mp4',seconds:52,streams:[{codec_type:'video'}]};
 const a={sceneChanges:[2.5,5,11,14.5,21,27.5,36,44],silences:[{start:20.9,end:21.1}]};
 const plan=validate(naturalPlan('cắt xuống 30 giây, phân cảnh, chuyển cảnh mượt 9:16',media,a),media);
 assert.equal(plan.ratio,'9:16');assert.equal(plan.transition,'crossfade');
 assert.ok(plan.segments.length>1,'A reel with real detected scenes must retain edit points');
 assert.ok(plan.expectedDuration>25&&plan.expectedDuration<31,`Unexpected duration ${plan.expectedDuration}`);
});

test('Legacy cut timelines with zero transition length remain valid',()=>{
 const media={path:'/tmp/legacy.mp4',seconds:6};
 const restored=validate({kind:'edit',ratio:'16:9',transition:'cut',transitionSeconds:0,segments:[{start:0,end:6}]},media);
 assert.equal(restored.expectedDuration,6);assert.equal(restored.transitionSeconds,0);
});

test('Real FFmpeg smooth scene transition produces valid MP4 and reduced runtime', {timeout:180000,skip:!bin('ffmpeg')||!bin('ffprobe')},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-crossfade-'));
 try{
  const snippets=[];
  for(const [i,color] of ['red','green','blue'].entries()){
   const f=path.join(root,`${i}.mp4`),p=spawnSync('ffmpeg',['-v','error','-nostdin','-y','-f','lavfi','-i',`color=c=${color}:s=192x108:r=25:d=1.8`,'-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1.8','-c:v','libx264','-c:a','aac','-shortest',f],{timeout:30000});assert.equal(p.status,0,String(p.stderr));snippets.push(f);
  }
  fs.writeFileSync(path.join(root,'files.txt'),snippets.map(f=>`file '${f}'`).join('\n'));
  const input=path.join(root,'original.mp4');assert.equal(spawnSync('ffmpeg',['-v','error','-nostdin','-y','-f','concat','-safe','0','-i',path.join(root,'files.txt'),'-c','copy',input],{timeout:30000}).status,0);
  const meta=await ffprobe(input),media={path:input,seconds:duration(meta),streams:meta.streams},cuts=await analyze({media});
  assert.ok(cuts.sceneChanges.length>0,'Must detect at least one real video scene cut');
  const plan=validate(naturalPlan('tự phân cảnh, chuyển cảnh mượt, dọc 9:16',media,cuts),media);
  assert.ok(plan.segments.length>1,JSON.stringify(plan));
  const result=await render({timeline:plan,jobDir:root,preview:true});assert.ok(fs.statSync(result.file).size>3000);
  assert.ok(Math.abs(result.actualSeconds-plan.expectedDuration)<.4);assert.ok(result.actualSeconds<media.seconds,'Crossfade must overlap clips');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
