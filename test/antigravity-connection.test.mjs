import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT=path.resolve(import.meta.dirname,'..');
const TOKEN='c'.repeat(64);
async function reserve(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;s.close();await once(s,'close');return port;}
async function launch(data,bin){const port=await reserve();const child=spawn(process.execPath,['src/server.mjs'],{cwd:ROOT,env:{...process.env,AI_PROJECT_OS_DATA_DIR:data,AI_PROJECT_OS_LAUNCH_TOKEN:TOKEN,AI_PROJECT_OS_PORT:String(port),PATH:bin+path.delimiter+process.env.PATH},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 let active=false;for(let n=0;n<100;n++){if(child.exitCode!==null)throw new Error('Server stopped: '+logs);try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){active=true;break;}}catch{}await delay(90);}assert.ok(active,'server must start');
 const url=`http://127.0.0.1:${port}`;const grant=await fetch(url+'/?launch='+TOKEN,{redirect:'manual'});assert.equal(grant.status,303);const cookie=(grant.headers.get('set-cookie')||'').split(';')[0];assert.ok(cookie.startsWith('aios_session='));
 const request=async(method,route,body)=>{const r=await fetch(url+route,{method,headers:{cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,value:await r.json()};};
 return {request,stop:async()=>{if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(1500)]);if(child.exitCode===null)child.kill('SIGKILL');}}};
}
function fixtureCommand(bin){const file=path.join(bin,'agy');const content=`#!/usr/bin/env node
const a=process.argv.slice(2);
if(a.includes('models')) {console.log(JSON.stringify({status:'SUCCESS',command:{name:'models',data:{models:[{id:'gemini-test-flash'},{id:'gemini-test-pro'},{id:'../../bad'}]}}}));process.exit(0)}
if(a.includes('--model')) {const body=require('node:fs').readFileSync(0,'utf8');const message=JSON.parse(body.trim());if(message.event!=='user'||!message.message.content.includes('Yêu cầu:'))process.exit(2);if(a.includes('-p'))process.exit(3);const model=a[a.indexOf('--model')+1];const bad=model==='gemini-test-pro';console.log(JSON.stringify({event:'init',init:{permission_mode:'request-review',tools:[],cwd:process.cwd()}}));if(bad)console.log(JSON.stringify({event:'step_update',step_update:{step_type:'tool',tool_name:'run_command'}}));console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'OK from '+model,usage:{input_tokens:8,output_tokens:3}}}));process.exit(0)}
process.stderr.write('invalid args');process.exit(1);
`;fs.writeFileSync(file,content,{mode:0o755});fs.chmodSync(file,0o755);}
test('Antigravity login is official, checks real model catalog, rejects tools, reuses user data across application replacement',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-agy-')),data=path.join(root,'data'),bin=path.join(root,'bin');fs.mkdirSync(bin,{recursive:true});fixtureCommand(bin);let app;
 try{
  app=await launch(data,bin);
  let r=await app.request('GET','/api/antigravity/status');assert.equal(r.status,200);assert.equal(r.value.installed,true);
  r=await app.request('POST','/api/antigravity/connect',{name:'User Gemini'});assert.equal(r.status,500,'locked Vault blocks connection');
  r=await app.request('POST','/api/vault/unlock',{password:'antigravity-test-strong-pass'});assert.equal(r.status,200);
  r=await app.request('POST','/api/connections',{kind:'antigravity_account',name:'Forged access'});assert.equal(r.status,500,'generic API blocks counterfeit account');
  r=await app.request('POST','/api/antigravity/install',{});assert.equal(r.status,500,'no automatic Windows installation from non-Windows host');
  r=await app.request('POST','/api/antigravity/connect',{name:'Google personal'});assert.equal(r.status,200);const id=r.value.id;
  r=await app.request('POST',`/api/antigravity/${id}/verify`,{model:'gemini-test-flash'});assert.equal(r.status,500,'must fetch real catalog first');
  r=await app.request('GET',`/api/antigravity/${id}/models`);assert.equal(r.status,200);assert.deepEqual(r.value,['gemini-test-flash','gemini-test-pro']);
  r=await app.request('POST',`/api/antigravity/${id}/verify`,{model:'gemini-test-pro'});assert.equal(r.status,500,'tool invocation must not verify AI');
  r=await app.request('GET','/api/connections');assert.equal(r.value.find(c=>c.id===id).availability.status,'unverified');
  r=await app.request('POST',`/api/antigravity/${id}/verify`,{model:'gemini-test-flash'});assert.equal(r.status,200);
  r=await app.request('POST',`/api/connections/${id}/model`,{model:'gemini-test-flash'});assert.equal(r.status,200);
  r=await app.request('GET','/api/connections');assert.equal(r.value.find(c=>c.id===id).availability.status,'verified');
  r=await app.request('POST','/api/projects',{name:'Private keep project',idea:'My ideas'});assert.equal(r.status,200);const project=r.value;
  r=await app.request('POST',`/api/projects/${project.id}/model-roles`,{founder:{connectionId:id,model:'gemini-test-flash'}});assert.equal(r.status,200);
  r=await app.request('POST',`/api/projects/${project.id}/chat`,{connectionId:id,message:'Hello'});assert.equal(r.status,200);assert.equal(r.value.reply,'OK from gemini-test-flash');
  const stored=fs.readFileSync(path.join(data,'projects.json'),'utf8'),vault=fs.readFileSync(path.join(data,'vault.enc.json'),'utf8');assert.ok(!vault.includes('antigravity-test-strong-pass'));
  await app.stop();app=null;
  const after=fs.readFileSync(path.join(data,'projects.json'),'utf8');assert.equal(after,stored);assert.equal(fs.readFileSync(path.join(data,'vault.enc.json'),'utf8'),vault);
 }finally{if(app)await app.stop();fs.rmSync(root,{recursive:true,force:true})}
});
