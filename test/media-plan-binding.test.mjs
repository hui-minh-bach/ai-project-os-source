import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createIntegrationHost} from '../src/lib/integration-host.mjs';
const require=createRequire(import.meta.url);
const timeline=require('../integrations/media-engine/src/timeline.cjs');
const sample=new URL('../integrations/media-engine/artifacts/samples/source.mp4',import.meta.url);
function tmp(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-plan-binding-'));return {root,close(){fs.rmSync(root,{recursive:true,force:true})}};}

// A real user may keep an older completed timeline and upload a new video.
// Do not queue the old timeline against the new file and then fail at clip 0.
test('old completed plan cannot target another uploaded video (host blocks before approval)',()=>{
 const dir=tmp();let host;
 try{
  host=createIntegrationHost({root:dir.root,clock:false});assert.equal(host.status().core.status,'active');
  const folder=path.join(host.mediaWorkspace,'uploads');fs.mkdirSync(folder,{recursive:true});
  const a=path.join(folder,'a.mp4'),b=path.join(folder,'b.mp4');fs.copyFileSync(sample,a);fs.copyFileSync(sample,b);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',a],{encoding:'utf8'}));
  const media={path:a,seconds:Number(probe.format.duration),streams:probe.streams,sha256:crypto.createHash('sha256').update(fs.readFileSync(a)).digest('hex')};
  const plan=timeline.validate({kind:'edit',ratio:'9:16',segments:[{start:0,end:media.seconds}]},media);
  assert.equal(plan.sourceSha256,media.sha256);assert.equal(plan.sourceSeconds,media.seconds);
  assert.throws(()=>host.submit({projectId:'fixture',operation:'media.render',params:{source:'uploads/b.mp4',editPlan:plan}}),{code:'MEDIA_PLAN_SOURCE'});
  assert.equal(host.listTasks('fixture').length,0,'invalid plan must not create a queued job');
  const ok=host.submit({projectId:'fixture',operation:'media.render',params:{source:'uploads/a.mp4',editPlan:plan}});
  assert.equal(ok.state,'paused');assert.equal(host.listTasks('fixture').length,1);
 }finally{host?.stop();dir.close();}
});

test('restored old plan without fingerprint still checks stored video path',()=>{
 const source='/tmp/a.mp4',other='/tmp/b.mp4';
 const old=timeline.validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:4}]},{path:source,seconds:4});
 assert.throws(()=>timeline.validate(old,{path:other,seconds:4}),{code:'MEDIA_PLAN_SOURCE'});
 assert.throws(()=>timeline.validate({...old,segments:[{start:0,end:9}]},{path:source,seconds:4}),{code:'MEDIA_PLAN_RANGE'});
 assert.throws(()=>timeline.validate(old,{path:source,seconds:8}),{code:'MEDIA_PLAN_SOURCE'});
});

test('same-path changed file is guarded by digest and a valid legacy timeline remains supported',()=>{
 const media={path:'/tmp/video.mp4',seconds:5,sha256:'b'.repeat(64)};
 const plan=timeline.validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:5}]},media);
 assert.throws(()=>timeline.validate(plan,{...media,sha256:'a'.repeat(64)}),{code:'MEDIA_PLAN_SOURCE'});
 const legacy=timeline.validate({kind:'edit',ratio:'16:9',transition:'cut',transitionSeconds:0,segments:[{start:0,end:5}]},media);
 assert.equal(legacy.transitionSeconds,0);assert.equal(legacy.expectedDuration,5);
});

test('browser only loads a plan for the current video and offers one-click recovery',()=>{
 const src=fs.readFileSync(new URL('../public/media-studio.js',import.meta.url),'utf8');
 assert.match(src,/t\.input\?\.params\?\.source===mediaUI\.source/);
 assert.match(src,/mediaUI\.planSource!==source/);
 assert.match(src,/data-job-act="rebuild"/);
 assert.match(src,/mediaClearPlanOnSourceChange\(\)/);
});
