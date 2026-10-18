/** Real integration validation. Requires node>=22 and ffmpeg/ffprobe. Uses no external services. */
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createIntegrationHost } from '../src/lib/integration-host.mjs';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=mkdtempSync(path.join(tmpdir(),'ai-project-integration-'));
const result={test:'real-ffmpeg-bridge',date:new Date().toISOString(),tasks:[],verifiedFiles:[],durationMs:0};
const start=Date.now();
let host;
try{
  const sampleTarget=path.join(root,'integrations/media-engine/artifacts/samples/source.mp4');
  mkdirSync(path.dirname(sampleTarget),{recursive:true});
  copyFileSync(path.join(appRoot,'integrations/media-engine/artifacts/samples/source.mp4'),sampleTarget);
  host=createIntegrationHost({root,env:{KBL_CORE_MASTER_KEY:'e2e-test-key-local-only-long-enough-2026'},clock:false});
  assert.equal(host.status().core.status,'active');
  assert.equal(host.status().media.status,'available');
  const sample=host.demoSample();
  assert.ok(sample.source.startsWith('uploads/'));
  assert.equal(existsSync(path.join(host.mediaWorkspace,sample.source)),true);
  async function run(operation,params){
    const task=host.submit({projectId:'test-media',operation,params});
    assert.equal(task.state,'paused');
    assert.equal(host.core.state.find(task.id).input.approved,false);
    host.action(task.id,'approve');
    await host.core.queue.drain();
    const done=host.core.state.find(task.id);
    result.tasks.push({operation,id:task.id,state:done.state,error:done.error||null,artifactIds:done.outputArtifactIds});
    if(done.state!=='completed')throw Error(`${operation} did not complete: ${JSON.stringify(done.error)}`);
    assert.ok(done.outputArtifactIds.length>=1);
    const arts=host.listArtifacts('test-media').filter(a=>a.taskId===task.id);
    for(const a of arts){const contents=host.artifact(a.id).bytes;assert.equal(crypto.createHash('sha256').update(contents).digest('hex'),a.sha256);result.verifiedFiles.push({name:a.name,sha256:a.sha256,bytes:contents.length});}
    return arts;
  }
  await run('media.subtitle-edit',{segments:[{id:'1',start:0,end:1.5,text:'Xin chao'}],changes:[{id:'1',text:'Xin chào mọi người'}]});
  const analyzed=await run('media.analyze',{source:sample.source,transcribe:false});
  assert.ok(analyzed.some(a=>a.name==='manifest.json'));
  const plans=await run('media.edit-plan',{source:sample.source,prompt:'Tạo video dọc 9:16 ngắn'});
  const planArt=plans.find(a=>a.name==='manifest.json');
  assert.ok(planArt);
  const manifest=JSON.parse(host.artifact(planArt.id).bytes.toString('utf8'));
  assert.equal(manifest.timeline.ratio,'9:16');
  assert.equal(manifest.timeline.origin,'deterministic-rule-not-ai');
  await run('media.render',{source:sample.source,editPlan:manifest.timeline,subtitleSegments:[]});
  const outlined=await run('media.story-outline',{text:'Chương 1\nMột cô gái bước vào tiệm. Cô ấy cầm trên tay một chiếc đồng hồ cũ. Một ký ức bỗng hiện về.',rights:'original-author-owned'});
  assert.ok(outlined.find(a=>a.name==='storyboard.json'));
  await run('media.publish-draft',{video:sample.source,title:'Bản nháp kiểm thử',channel:'youtube',rights:'original-author-owned'});
  assert.throws(()=>host.submit({projectId:'test-media',operation:'media.publish',params:{}}),{code:'MEDIA_OPERATION'});
  assert.throws(()=>host.submit({projectId:'test-media',operation:'media.analyze',params:{source:'../../etc/passwd'}}),{code:'MEDIA_PATH'});
  result.durationMs=Date.now()-start;
  console.log(JSON.stringify({status:'PASS',...result},null,2));
} catch(e){
  console.error(JSON.stringify({status:'FAIL',...result,error:{code:e.code||null,message:e.message,stack:e.stack},durationMs:Date.now()-start},null,2));
  process.exitCode=1;
} finally { try{host?.stop()}finally{rmSync(root,{recursive:true,force:true})} }
