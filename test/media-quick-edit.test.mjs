import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createIntegrationHost } from '../src/lib/integration-host.mjs';
import { naturalPlan, validate } from '../integrations/media-engine/src/timeline.cjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function binary(name){const r=spawnSync(name,[name==='git'?'--version':'-version'],{stdio:'ignore'});return !r.error&&r.status===0;}

test('Vietnamese quick-edit plan keeps 9:16, effect and safe source',()=>{
 const media={seconds:8,path:'/example/source.mp4'};
 const plan=validate(naturalPlan('đổi sang video dọc 9:16 thêm hiệu ứng',media),media);
 assert.equal(plan.ratio,'9:16');assert.equal(plan.framing,'crop');assert.deepEqual(plan.effects,['fade-in-out']);
 assert.equal(plan.origin,'deterministic-rule-not-ai');assert.equal(plan.segments[0].source,media.path);
 const trimmed=validate(naturalPlan('cắt xuống 30 giây, video dọc 9:16', {...media,seconds:95}), {...media,seconds:95});
 assert.equal(trimmed.expectedDuration,30);assert.equal(trimmed.ratio,'9:16');
 assert.throws(()=>validate({...plan,effects:['shell']},media),/Unknown edit effect/);
});

test('quick-edit requires explicit approval and creates real MP4 without user JSON', {timeout:180000,skip:process.env.AIOS_MEDIA_REAL_E2E!=='1'||!binary('ffmpeg')||!binary('ffprobe')||!binary('git')},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-media-quick-'));
 let host;
 try{
  host=createIntegrationHost({root,clock:false});
  assert.equal(host.status().core.status,'active',host.status().core.error);
  const uploads=path.join(host.mediaWorkspace,'uploads');fs.mkdirSync(uploads,{recursive:true});
  const src='uploads/short.mp4';fs.copyFileSync(path.join(ROOT,'integrations/media-engine/artifacts/samples/source.mp4'),path.join(host.mediaWorkspace,src));
  const job=host.submit({projectId:'sample',operation:'media.quick-edit',params:{source:src,prompt:'Làm video dọc 9:16, thêm hiệu ứng mờ dần'}});
  assert.equal(job.state,'paused');assert.equal(job.input.approved,false);assert.equal(host.listArtifacts('sample').length,0);
  const approved=host.action(job.id,'approve');assert.equal(approved.state,'queued');
  await host.core.queue.drain();
  const finished=host.listTasks('sample').find(t=>t.id===job.id);
  assert.equal(finished.state,'completed',JSON.stringify(finished.error));
  const artifacts=host.listArtifacts('sample');assert.ok(artifacts.some(a=>a.name==='preview.mp4'));
  assert.ok(artifacts.some(a=>a.name==='final.mp4'));assert.ok(artifacts.some(a=>a.name==='manifest.json'));
  const manifestArtifact=artifacts.find(a=>a.name==='manifest.json');
  const manifest=JSON.parse(host.artifact(manifestArtifact.id).bytes.toString('utf8'));
  assert.equal(manifest.timeline.origin,'deterministic-rule-not-ai');
  assert.equal(manifest.timeline.ratio,'9:16');assert.equal(manifest.timeline.framing,'crop');
  assert.deepEqual(manifest.timeline.effects,['fade-in-out']);assert.equal(manifest.qa.passed,true);
  const video=host.artifact(artifacts.find(a=>a.name==='final.mp4').id);
  assert.ok(video.bytes?.length>4000||video.filePath);
 }finally{host?.stop();fs.rmSync(root,{force:true,recursive:true});}
});
