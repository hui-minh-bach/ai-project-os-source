/** Real localhost regression: old plan + new video must be rejected before approval. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';
const ROOT=path.resolve(import.meta.dirname,'..');
async function port(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;s.close();await once(s,'close');return p;}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-stale-media-'));
const p=await port(),base=`http://127.0.0.1:${p}`;
const ticket=crypto.randomBytes(32).toString('hex');
const child=spawn(process.execPath,['src/server.mjs'],{cwd:ROOT,env:{...process.env,AI_PROJECT_OS_PORT:String(p),AI_PROJECT_OS_DATA_DIR:path.join(temp,'data'),AI_PROJECT_OS_LAUNCH_TOKEN:ticket},stdio:'ignore'});
try{
 let ok=false;
 for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/health');if(r.ok){ok=true;break;}}catch{}await sleep(150);}
 assert.ok(ok,'Local Worker startup failed');
 let r=await fetch(base+'/?launch='+ticket,{redirect:'manual'});
 assert.equal(r.status,303);
 const cookie=r.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie?.startsWith('aios_personal_session='));
 const call=async(endpoint,method='GET',data=null)=>{const headers={cookie};if(data&&!Buffer.isBuffer(data))headers['content-type']='application/json';return fetch(base+endpoint,{method,headers,...(data?{body:Buffer.isBuffer(data)?data:JSON.stringify(data)}:{})});};
 r=await call('/api/projects','POST',{name:'Stale Media Binding',idea:'Regression for source-aware export'});assert.ok(r.ok);const project=await r.json();
 const sample=fs.readFileSync(path.join(ROOT,'integrations/media-engine/artifacts/samples/source.mp4'));
 const upload=async()=>{const response=await fetch(base+'/api/integrations/media/upload',{method:'POST',headers:{cookie,'x-media-filename':'uploaded.mp4','content-type':'application/octet-stream'},body:sample});assert.ok(response.ok);return response.json();};
 const one=await upload();
 r=await call('/api/integrations/media/tasks','POST',{projectId:project.id,operation:'media.edit-plan',params:{source:one.source,prompt:'video doc 9:16'}});assert.ok(r.ok);const job=await r.json();
 r=await call(`/api/integrations/media/tasks/${job.id}/approve`,'POST',{});assert.ok(r.ok);
 let done=null;
 for(let i=0;i<160;i++){const jobs=await (await call('/api/integrations/media/tasks?projectId='+project.id)).json();done=jobs.find(t=>t.id===job.id);if(['completed','failed','blocked'].includes(done?.state))break;await sleep(200);}
 assert.equal(done?.state,'completed',JSON.stringify(done?.error));
 const artifacts=await (await call('/api/integrations/media/artifacts?projectId='+project.id)).json();
 const manifest=artifacts.find(a=>a.name==='manifest.json'&&a.taskId===job.id);assert.ok(manifest);
 const plan=(await (await call('/api/integrations/media/artifacts/'+manifest.id)).json()).timeline;
 assert.ok(plan.sourceSha256&&plan.sourceSeconds,'New plans must bind the exact video');
 const two=await upload();assert.notEqual(one.source,two.source);
 r=await call('/api/integrations/media/tasks','POST',{projectId:project.id,operation:'media.render',params:{source:two.source,editPlan:plan}});
 assert.equal(r.status,500,'Stale render must fail before queuing');
 const failed=await r.json();assert.match(String(failed.error),/video|ngu/i);
 let jobs=await (await call('/api/integrations/media/tasks?projectId='+project.id)).json();assert.equal(jobs.length,1,'No doomed render task should be enqueued');
 r=await call('/api/integrations/media/tasks','POST',{projectId:project.id,operation:'media.render',params:{source:one.source,editPlan:plan}});assert.ok(r.ok);const exportTask=await r.json();assert.equal(exportTask.state,'paused');
 r=await call(`/api/integrations/media/tasks/${exportTask.id}/approve`,'POST',{});assert.ok(r.ok);
 for(let i=0;i<400;i++){jobs=await (await call('/api/integrations/media/tasks?projectId='+project.id)).json();done=jobs.find(t=>t.id===exportTask.id);if(['completed','failed','blocked'].includes(done?.state))break;await sleep(200);}
 assert.equal(done?.state,'completed','Valid same-source MP4 export failed: '+JSON.stringify(done?.error));
 const files=await (await call('/api/integrations/media/artifacts?projectId='+project.id)).json();const video=files.find(a=>a.name==='final.mp4'&&a.taskId===exportTask.id);assert.ok(video);
 const bytes=Buffer.from(await (await call('/api/integrations/media/artifacts/'+video.id)).arrayBuffer());assert.ok(bytes.length>1000);
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),video.sha256);
 console.log(JSON.stringify({status:'PASS',stalePlanRejected:true,queuedAfterReject:1,validRender:'completed',verifiedBytes:bytes.length,sha256:true}));
}finally{if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),sleep(4000)]);}fs.rmSync(temp,{recursive:true,force:true});}
