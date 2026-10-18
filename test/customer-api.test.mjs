import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
const ROOT=path.resolve(import.meta.dirname,'..');
const LAUNCH_TOKEN='a'.repeat(64);
let sessionCookie='';
async function reservePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;server.close();await once(server,'close');return port;}
async function launch(port,dataDir){
 const child=spawn(process.execPath,['src/server.mjs'],{cwd:ROOT,env:{...process.env,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_DATA_DIR:dataDir,HEYGEN_API_KEY:'',HEYGEN_TTS_VOICE_ID:'',AI_PROJECT_OS_LAUNCH_TOKEN:LAUNCH_TOKEN},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',x=>logs+=String(x));child.stderr.on('data',x=>logs+=String(x));
 for(let i=0;i<90;i++){
  if(child.exitCode!==null)throw new Error('Startup failed: '+logs);
  try{const res=await fetch(`http://127.0.0.1:${port}/api/health`);if(res.ok&&(await res.json()).version==='0.9.14'){
    const unauthorized=await fetch(`http://127.0.0.1:${port}/api/projects`);assert.equal(unauthorized.status,401);
    const wrong=await fetch(`http://127.0.0.1:${port}/?launch=${'b'.repeat(64)}`,{redirect:'manual'});assert.equal(wrong.status,403);
    const authorized=await fetch(`http://127.0.0.1:${port}/?launch=${LAUNCH_TOKEN}`,{redirect:'manual'});
    assert.equal(authorized.status,303);assert.equal(authorized.headers.get('location'),'/');
    sessionCookie=(authorized.headers.get('set-cookie')||'').split(';')[0];
    assert.ok(sessionCookie.startsWith('aios_session='));
    return child;
   }}catch{}
  await delay(100);
 }
 child.kill();throw new Error('Server did not become ready. '+logs);
}
async function stop(child){if(child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(10000)]);}
function request(port,url,method='GET',body=null,origin=null){return fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{'content-type':'application/json',Cookie:sessionCookie,...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});}

test('customer E2E: app data isolated, API gated, HeyGen key encrypted in Vault, backup can download',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-customer-server-')),port=await reservePort(),dataDir=path.join(root,'customer-data');
 let child;
 try{
  child=await launch(port,dataDir);
  let r=await request(port,'/api/system/readiness');assert.equal(r.status,200);const status=await r.json();assert.equal(status.dataDir,dataDir);assert.equal(status.localOnly,true);
  r=await request(port,'/api/system/doctor','POST',{});assert.equal(r.status,200);const doctor=await r.json();assert.equal(doctor.version,'0.9.14');assert.equal(doctor.capabilities.projectManagement,true);assert.ok(doctor.checks.some(x=>x.id==='encode'));assert.equal(doctor.capabilities.cloudSpeechVerified,false);
  r=await request(port,'/api/projects','POST',{name:'Blocked origin'},'https://evil.example');assert.equal(r.status,403);
  r=await request(port,'/api/projects','POST',{name:'Customer A',idea:'Build a voiceover movie'});assert.equal(r.status,200);const project=await r.json();assert.equal(project.name,'Customer A');
  r=await request(port,'/api/system/tts/config','POST',{apiKey:'secret_key_123456789000000000',voiceId:'voice_123456789'});assert.equal(r.status,423);
  r=await request(port,'/api/vault/unlock','POST',{password:'good secret vault password'});assert.equal(r.status,200);
  r=await request(port,'/api/system/tts/config','POST',{apiKey:'secret_key_123456789000000000',voiceId:'voice_123456789'});assert.equal(r.status,200);
  r=await request(port,'/api/system/tts/config');const tts=await r.json();assert.equal(tts.configured,true);assert.equal(tts.voiceId,'voice_123456789');assert.ok(!JSON.stringify(tts).includes('secret_key_'));
  r=await request(port,'/api/integrations/status');const integration=await r.json();assert.equal(integration.media.ttsProvider,'heygen');
  const vaultBytes=fs.readFileSync(path.join(dataDir,'vault.enc.json'),'utf8');assert.ok(!vaultBytes.includes('secret_key_'));
  r=await request(port,'/api/system/backup','POST',{password:'customer backup long password!'});assert.equal(r.status,200);const backup=await r.json();assert.equal(backup.encrypted,true);
  r=await request(port,`/api/system/backups/${backup.name}`);assert.equal(r.status,200);assert.ok(r.headers.get('content-disposition').includes('attachment'));
  const bytes=Buffer.from(await r.arrayBuffer());assert.ok(!bytes.includes(Buffer.from('Customer A')));
  r=await request(port,'/api/vault/lock','POST',{});assert.equal(r.status,200);
  r=await request(port,'/api/integrations/status');assert.equal((await r.json()).media.ttsProvider,'none','locked Vault must disable private TTS access');
  r=await request(port,'/api/projects');assert.equal((await r.json())[0].name,'Customer A');
 }finally{if(child)await stop(child);sessionCookie='';fs.rmSync(root,{recursive:true,force:true});}
});
