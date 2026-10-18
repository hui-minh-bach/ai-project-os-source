/** Full-file large-media proof, without touching original videos or online APIs. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import assert from 'node:assert/strict';
import {createIntegrationHost} from '../src/lib/integration-host.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-os-large-'));
let host;
try{
  host=createIntegrationHost({root,env:{},clock:false});
  const sourceRel='uploads/large-source.mp4';const source=path.join(host.mediaWorkspace,sourceRel);
  fs.mkdirSync(path.dirname(source),{recursive:true});
  fs.copyFileSync(new URL('../integrations/media-engine/artifacts/samples/source.mp4',import.meta.url),source);
  fs.appendFileSync(source,Buffer.alloc(16*1024*1024));
  const task=host.submit({projectId:'big-media',operation:'media.analyze',params:{source:sourceRel,transcribe:false}});
  assert.equal(task.state,'paused');host.action(task.id,'approve');await host.core.queue.drain();
  assert.equal(host.core.state.find(task.id).state,'completed',JSON.stringify(host.core.state.find(task.id).error));
  const big=host.listArtifacts('big-media').find(a=>a.storage==='media-workspace-large');
  assert.ok(big&&big.size>15*1024*1024);
  assert.ok(host.listArtifacts('big-media').some(a=>a.name.endsWith('.receipt.json')));
  assert.equal(host.artifact(big.id).filePath,fs.realpathSync(source));
  host.stop();host=createIntegrationHost({root,env:{},clock:false});
  assert.equal(host.artifact(big.id).metadata.sha256,big.sha256);
  fs.appendFileSync(source,'tampered');
  assert.throws(()=>host.artifact(big.id),{code:'MEDIA_INTEGRITY'});
  console.log(JSON.stringify({status:'PASS',largeMediaBytes:big.size,verifiedSha256:big.sha256,restartPersistence:true,tamperDetection:true},null,2));
}catch(e){console.error(JSON.stringify({status:'FAIL',error:e.message,code:e.code||null},null,2));process.exitCode=1;}
finally{host?.stop();fs.rmSync(root,{recursive:true,force:true});}
