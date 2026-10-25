import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawn} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('Real app HTTP server: free-stack endpoint respects one-use launch ticket, cookie and local-only policy',{timeout:30000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-free-http-'));
 const port=await freePort(),token=crypto.randomBytes(32).toString('hex'),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['src/server.mjs'],{cwd:root,env:{...process.env,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_LAUNCH_TOKEN:token,AI_PROJECT_OS_DATA_DIR:path.join(dir,'data')},stdio:['ignore','pipe','pipe']});
 let logs='';child.stderr.on('data',d=>logs+=String(d).slice(0,1200));child.stdout.on('data',d=>logs+=String(d).slice(0,500));
 try{
  let ready=false;
  for(let i=0;i<80;i++){
   if(child.exitCode!==null)throw Error('Server exited early: '+logs.slice(-400));
   try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{}
   await sleep(90);
  }
  assert.equal(ready,true,'Server not ready: '+logs.slice(-400));
  const denied=await fetch(base+'/api/free-stack/status');assert.equal(denied.status,401);
  const ticket=await fetch(base+'/?launch='+token,{redirect:'manual'});assert.equal(ticket.status,303);
  const cookie=ticket.headers.get('set-cookie')?.split(';')[0];assert.match(cookie||'',/^aios_session=[a-f0-9]{64}$/);
  const oldTicket=await fetch(base+'/?launch='+token,{redirect:'manual'});assert.equal(oldTicket.status,403);
  const status=await fetch(base+'/api/free-stack/status',{headers:{Cookie:cookie},signal:AbortSignal.timeout(12000)});
  assert.equal(status.status,200);
  const data=await status.json();assert.equal(data.localOnly,true);assert.equal(data.noPaidApiCalled,true);assert.equal(data.tools.length,8);
  assert.equal(data.tools.find(x=>x.id==='comfyui').ready,false);
  const html=await fetch(base+'/tabs/engines.html',{headers:{Cookie:cookie}});
  if(html.ok)assert.match(await html.text(),/freeStackRefresh/);
 }finally{
  child.kill('SIGTERM');await new Promise(r=>{if(child.exitCode!==null)return r();const t=setTimeout(r,2500);child.once('exit',()=>{clearTimeout(t);r()});});
  if(child.exitCode===null)child.kill('SIGKILL');
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
