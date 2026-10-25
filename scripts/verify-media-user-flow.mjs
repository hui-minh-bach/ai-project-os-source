// End-to-end smoke through the actual localhost session, no account API and no fake MP4.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
const ROOT=path.resolve(import.meta.dirname,'..');
async function openPort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;s.close();await once(s,'close');return p;}
function assert(ok,message){if(!ok)throw Error(message);}
async function run(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'aios-media-api-'));
 const port=await openPort(),base=`http://127.0.0.1:${port}`,launch=crypto.randomBytes(32).toString('hex');
 const child=spawn(process.execPath,['src/server.mjs'],{cwd:ROOT,env:{...process.env,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_DATA_DIR:path.join(temp,'data'),AI_PROJECT_OS_LAUNCH_TOKEN:launch},stdio:'ignore'});
 try{
  let started=false;
  const expectedVersion=JSON.parse(fs.readFileSync(path.join(ROOT,'RELEASE.json'),'utf8')).version;
 for(let i=0;i<100;i++){try{const h=await fetch(base+'/api/health');if(h.ok&&(await h.json()).version===expectedVersion){started=true;break;}}catch{}await sleep(150);}
  assert(started,'Local Worker did not start');
  let r=await fetch(base+'/?launch='+launch,{redirect:'manual'});assert(r.status===303,'Login ticket failed');
  const cookie=r.headers.get('set-cookie')?.split(';')[0];assert(cookie?.startsWith('aios_personal_session='),'Login session not granted');
  const request=async(endpoint,method='GET',data)=>{
   const headers={cookie};if(data&&!Buffer.isBuffer(data))headers['content-type']='application/json';
   return fetch(base+endpoint,{method,headers,body:data?(Buffer.isBuffer(data)?data:JSON.stringify(data)):undefined});
  };
  r=await request('/api/projects','POST',{name:'Kiểm thử dựng video',idea:'Cắt video dọc và thêm hiệu ứng'});
  assert(r.ok,'Could not create project');const project=await r.json();
  r=await request('/api/integrations/media/planner?projectId='+encodeURIComponent(project.id));assert(r.ok,'Planner status failed');
  const status=await r.json();assert(status.mode==='local'&&!status.available,'Unverified model must never be considered connected');
  const sample=fs.readFileSync(path.join(ROOT,'integrations/media-engine/artifacts/samples/source.mp4'));
  r=await fetch(base+'/api/integrations/media/upload',{method:'POST',headers:{cookie,'x-media-filename':'upload.mp4','content-type':'application/octet-stream'},body:sample});
  assert(r.ok,'Upload failed');const upload=await r.json();
  r=await request('/api/integrations/media/tasks','POST',{projectId:project.id,operation:'media.quick-edit',params:{source:upload.source,prompt:'Đổi sang video dọc 9:16 và thêm hiệu ứng mờ dần'}});assert(r.ok,'Submit quick edit failed');
  const task=await r.json();assert(task.state==='paused','Task must wait for approval');
  r=await request('/api/integrations/media/artifacts?projectId='+project.id);assert((await r.json()).length===0,'Unapproved render created artifact');
  r=await request(`/api/integrations/media/tasks/${task.id}/approve`,'POST',{});assert(r.ok,'Approval failed');
  let completed;
  for(let i=0;i<200;i++){
   r=await request('/api/integrations/media/tasks?projectId='+project.id);
   const jobs=await r.json(),job=jobs.find(x=>x.id===task.id);
   if(['completed','failed','blocked','cancelled'].includes(job?.state)){completed=job;break;}
   await sleep(200);
  }
  assert(completed?.state==='completed',`Quick edit failed: ${JSON.stringify(completed?.error||completed?.state)}`);
  r=await request('/api/integrations/media/artifacts?projectId='+project.id);const artifacts=await r.json();
  const final=artifacts.find(x=>x.name==='final.mp4');const manifest=artifacts.find(x=>x.name==='manifest.json');assert(final&&manifest,'Missing preview/final manifest');
  r=await request('/api/integrations/media/artifacts/'+manifest.id);const j=await r.json();
  assert(j.qa?.passed===true&&j.timeline?.ratio==='9:16','Video QA or aspect ratio failed');
  r=await request('/api/integrations/media/artifacts/'+final.id);const file=Buffer.from(await r.arrayBuffer());
  assert(r.ok&&file.length>1000,'Cannot download generated MP4');
  assert(crypto.createHash('sha256').update(file).digest('hex')===final.sha256,'Downloaded MP4 failed checksum');
  console.log(JSON.stringify({api:'passed',taskState:completed.state,origin:j.timeline.origin,ratio:j.timeline.ratio,framing:j.timeline.framing,effects:j.timeline.effects,bytes:file.length,sha256Verified:true},null,2));
 }finally{
  if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),sleep(4000)]);}
  fs.rmSync(temp,{recursive:true,force:true});
 }
}
await run();
