import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
const ROOT=path.resolve(import.meta.dirname,'..');
async function freeRange(){
 for(let attempt=0;attempt<80;attempt++){
  const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');
  const start=s.address().port;s.close();await once(s,'close');
  if(start>1024&&start<65530)return start;
 }
 throw new Error('no free port');
}
async function waitFor(p,timeout=10_000){
 for(let i=0;i<timeout/100;i++){
  try{const r=await fetch(`http://127.0.0.1:${p}/api/health`,{signal:AbortSignal.timeout(300)});if(r.ok&&(await r.json()).version==='0.9.18')return true;}catch{}
  await sleep(100);
 }
 return false;
}
async function stop(child){
 if(child.exitCode!==null)return;
 child.kill('SIGTERM');await Promise.race([once(child,'exit'),sleep(4000)]);
 if(child.exitCode===null){child.kill('SIGKILL');await Promise.race([once(child,'exit'),sleep(1000)]);}
}
test('Worker C: launcher starts outside its installation working directory',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-c-launch-'));
 const p=await freeRange();
 const child=spawn(process.execPath,[path.join(ROOT,'src','launcher.mjs')],{
  cwd:dir,env:{...process.env,AI_PROJECT_OS_DATA_DIR:path.join(dir,'data'),AI_PROJECT_OS_PORT:String(p)},stdio:'ignore'});
 try{
  assert.ok(await waitFor(p),'server must start with install-root CWD independent of caller');
  const ticket=path.join(dir,'run',`session-${p}.json`);
  assert.ok(fs.existsSync(ticket),'session ticket outside app install directory');
 }finally{await stop(child);fs.rmSync(dir,{recursive:true,force:true});}
});
test('Worker C: explicit occupied port refuses unsafe reuse',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-c-collision-'));
 const p=await freeRange();let connections=0;
 const fake=net.createServer(sock=>{connections++;sock.end('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nOTHER');});
 await new Promise((ok,bad)=>fake.listen(p,'127.0.0.1',err=>err?bad(err):ok()));
 try{
 const locked=spawn(process.execPath,[path.join(ROOT,'src','launcher.mjs')],{
   cwd:dir,env:{...process.env,AI_PROJECT_OS_DATA_DIR:path.join(dir,'data'),AI_PROJECT_OS_PORT:String(p)},stdio:'ignore'});
  try{const [code]=await Promise.race([once(locked,'exit'),sleep(5000).then(()=>[-1])]);assert.equal(code,1,'must refuse explicit occupied port');assert.ok(connections>0);}finally{await stop(locked);}
 }finally{fake.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('Worker C: default port collision falls back without trusting the foreign service',async(t)=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-c-default-'));
 const p=4321;let hits=0;
 const fake=net.createServer(sock=>{hits++;sock.end('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nConnection: close\r\n\r\nOTHER');});
 try{
  try{await new Promise((ok,bad)=>{fake.once('error',bad);fake.listen(p,'127.0.0.1',ok);});}
  catch{t.skip('Default 4321 already occupied; cannot safely claim the local port for this fixture.');return;}
  const env={...process.env,AI_PROJECT_OS_DATA_DIR:path.join(dir,'data')};delete env.AI_PROJECT_OS_PORT;
  const child=spawn(process.execPath,[path.join(ROOT,'src','launcher.mjs')],{cwd:dir,env,stdio:'ignore'});
  try{
   assert.equal(await waitFor(4322,12_000),true,'launcher should select the next available loopback port');
   assert.ok(fs.existsSync(path.join(dir,'run','session-4322.json')));
   assert.ok(hits>0,'foreign service was checked but must never receive a launch token');
  }finally{await stop(child);}
 }finally{fake.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('v0.8.5 launcher refuses to silently use a different port when v0.8.0 is still running',async()=>{
 const http=await import('node:http');const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,localOnly:true,version:'0.8.0'}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-old-rc-launch-'));
 try{
  const app=spawn(process.execPath,[path.join(ROOT,'src','launcher.mjs')],{cwd:dir,env:{...process.env,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_DATA_DIR:path.join(dir,'data')},stdio:['ignore','pipe','pipe']});
  let stderr='';app.stderr.on('data',chunk=>stderr+=String(chunk));
  try{const [code]=await Promise.race([once(app,'exit'),sleep(5000).then(()=>[-1])]);assert.equal(code,1);assert.match(stderr,/bản cũ/);}finally{await stop(app);}
 }finally{server.close();fs.rmSync(dir,{recursive:true,force:true});}
});
