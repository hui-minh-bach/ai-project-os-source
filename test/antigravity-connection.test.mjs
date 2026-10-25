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
 const url=`http://127.0.0.1:${port}`;const grant=await fetch(url+'/?launch='+TOKEN,{redirect:'manual'});assert.equal(grant.status,303);const cookie=(grant.headers.get('set-cookie')||'').split(';')[0];assert.ok(cookie.startsWith('aios_personal_session='));
 const request=async(method,route,body)=>{const r=await fetch(url+route,{method,headers:{cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,value:await r.json()};};
 return {request,stop:async()=>{if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(1500)]);if(child.exitCode===null)child.kill('SIGKILL');}}};
}
function fixtureCommand(bin){const file=path.join(bin,'agy');const content=`#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
const a=process.argv.slice(2);
fs.appendFileSync(path.join(__dirname,'agy-calls.log'),JSON.stringify(a)+'\\n');
let mode='table';try{mode=fs.readFileSync(path.join(__dirname,'agy-mode'),'utf8').trim()||'table'}catch{}
if(a.includes('models')) {
 if(mode==='flags-error'){process.stderr.write('Error: flags provided but not defined: -output-format');process.exit(1)}
 // Real CLI 1.4.0: the models subcommand accepts NO flags besides -h/--help.
 if(a.some(x=>x.startsWith('-'))){process.stderr.write('Error: flags provided but not defined: -output-format');process.exit(1)}
 if(mode==='json'){console.log(JSON.stringify({status:'SUCCESS',command:{name:'models',data:{models:[{id:'gemini-test-flash'},{id:'gemini-test-pro'},{id:'../../bad'}]}}}));process.exit(0)}
 console.log('Available models');console.log('gemini-test-flash      Gemini Test Flash (High)');console.log('gemini-test-pro        Gemini Test Pro (Thinking)');console.log('internal');process.exit(0)}
if(a.includes('--model')) {if(mode==='ask-error'){process.stderr.write('quota exhausted: model unavailable');process.exit(1)}const body=fs.readFileSync(0,'utf8');const message=JSON.parse(body.trim());if(message.event!=='user'||!message.message.content.includes('Yêu cầu:'))process.exit(2);if(a.includes('-p'))process.exit(3);const model=a[a.indexOf('--model')+1];const init=JSON.stringify({event:'init',init:{permission_mode:'request-review',tools:[],cwd:process.cwd()}});const toolOnly=JSON.stringify({event:'result',result:{status:'SUCCESS',tool_calls:[{name:'google_search'}],usage:{input_tokens:8,output_tokens:3}}});
 // 0.9.62 fixtures: 'tool-only' never answers with text; 'tool-retry'
 // answers with text only once the prompt carries the strengthened
 // text-only instruction (marker: 'bất kỳ công cụ').
 if(mode==='tool-only'){console.log(init);console.log(toolOnly);process.exit(0)}
 if(mode==='tool-retry'&&!message.message.content.includes('bất kỳ công cụ')){console.log(init);console.log(toolOnly);process.exit(0)}
 if(mode==='tool-retry'){console.log(init);console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'Văn bản sau khi nhắc lại',usage:{input_tokens:8,output_tokens:3}}}));process.exit(0)}
 const bad=model==='gemini-test-pro';console.log(init);if(bad)console.log(JSON.stringify({event:'step_update',step_update:{step_type:'tool',tool_name:'run_command'}}));console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'OK from '+model,usage:{input_tokens:8,output_tokens:3}}}));process.exit(0)}
process.stderr.write('invalid args');process.exit(1);
`;fs.writeFileSync(file,content,{mode:0o755});fs.chmodSync(file,0o755);}
function fixtureCalls(bin){try{return fs.readFileSync(path.join(bin,'agy-calls.log'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));}catch{return[];}}
function fixtureSetup(mode){const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-agy-')),data=path.join(root,'data'),bin=path.join(root,'bin');fs.mkdirSync(bin,{recursive:true});fixtureCommand(bin);if(mode)fs.writeFileSync(path.join(bin,'agy-mode'),mode);return {root,data,bin};}
test('Antigravity login is official, checks real model catalog, text answer wins over tool steps, reuses user data across application replacement',async()=>{
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
  // Regression (CLI 1.4.0): the models call must be EXACTLY ['models'] — the
  // real CLI exits non-zero on ANY flag ("flags provided but not defined"),
  // which the app once misreported as an incomplete Google login.
  const modelCalls=fixtureCalls(bin).filter(a=>a.includes('models'));assert.ok(modelCalls.length>=1,'fixture must record the models call');
  for(const a of modelCalls){assert.deepEqual(a,['models'],'models must be invoked bare');assert.ok(!a.includes('--output-format'),'--output-format must never be passed to the models call');}
  // v0.9.62: a tool STEP next to a usable text answer no longer fails the
  // ask — in text mode the text IS the answer (the CLI runs --mode=plan +
  // --sandbox behind a deny-all tool profile, so an intent cannot mutate
  // anything). Before 0.9.62 this verify died with "Antigravity yêu cầu
  // hoặc thực hiện công cụ…" — the owner's real 23/10 failure.
  r=await app.request('POST',`/api/antigravity/${id}/verify`,{model:'gemini-test-pro'});assert.equal(r.status,200,'tool step + usable text → text wins (0.9.62)');
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
test('Antigravity models: JSON envelope catalog is still accepted and unsafe ids are filtered',async()=>{
 const {root,data,bin}=fixtureSetup('json');let app;
 try{
  app=await launch(data,bin);
  let r=await app.request('POST','/api/vault/unlock',{password:'antigravity-test-strong-pass'});assert.equal(r.status,200);
  r=await app.request('POST','/api/antigravity/connect',{name:'Google personal'});assert.equal(r.status,200);const id=r.value.id;
  r=await app.request('GET',`/api/antigravity/${id}/models`);assert.equal(r.status,200);assert.deepEqual(r.value,['gemini-test-flash','gemini-test-pro']);
 }finally{if(app)await app.stop();fs.rmSync(root,{recursive:true,force:true})}
});
test('Antigravity models: a CLI failure surfaces the CLI’s own words, not a generic login blame',async()=>{
 const {root,data,bin}=fixtureSetup('flags-error');let app;
 try{
  app=await launch(data,bin);
  let r=await app.request('POST','/api/vault/unlock',{password:'antigravity-test-strong-pass'});assert.equal(r.status,200);
  r=await app.request('POST','/api/antigravity/connect',{name:'Google personal'});assert.equal(r.status,200);const id=r.value.id;
  r=await app.request('GET',`/api/antigravity/${id}/models`);assert.equal(r.status,500);
  assert.ok(String(r.value.error||'').includes('flags provided but not defined'),'error must quote the CLI: '+(r.value.error||''));
 }finally{if(app)await app.stop();fs.rmSync(root,{recursive:true,force:true})}
});
test('Antigravity verify: an ask failure surfaces the CLI stderr',async()=>{
 const {root,data,bin}=fixtureSetup('ask-error');let app;
 try{
  app=await launch(data,bin);
  let r=await app.request('POST','/api/vault/unlock',{password:'antigravity-test-strong-pass'});assert.equal(r.status,200);
  r=await app.request('POST','/api/antigravity/connect',{name:'Google personal'});assert.equal(r.status,200);const id=r.value.id;
  r=await app.request('GET',`/api/antigravity/${id}/models`);assert.equal(r.status,200);assert.deepEqual(r.value,['gemini-test-flash','gemini-test-pro']);
  r=await app.request('POST',`/api/antigravity/${id}/verify`,{model:'gemini-test-flash'});assert.equal(r.status,500);
  assert.ok(String(r.value.error||'').includes('quota exhausted'),'error must quote the CLI stderr: '+(r.value.error||''));
 }finally{if(app)await app.stop();fs.rmSync(root,{recursive:true,force:true})}
});
test('Antigravity ask: a tool-only result is retried once with a strengthened text-only instruction, then succeeds (0.9.62)',async()=>{
 const {root,data,bin}=fixtureSetup('tool-retry');let app;
 try{
  app=await launch(data,bin);
  let r=await app.request('POST','/api/vault/unlock',{password:'antigravity-test-strong-pass'});assert.equal(r.status,200);
  r=await app.request('POST','/api/antigravity/connect',{name:'Google personal'});assert.equal(r.status,200);const id=r.value.id;
  r=await app.request('GET',`/api/antigravity/${id}/models`);assert.equal(r.status,200);
  r=await app.request('POST',`/api/antigravity/${id}/verify`,{model:'gemini-test-flash'});assert.equal(r.status,200);
  const asks=fixtureCalls(bin).filter(a=>a.includes('--model'));assert.equal(asks.length,2,'exactly one retry after the tool-only result');
 }finally{if(app)await app.stop();fs.rmSync(root,{recursive:true,force:true})}
});
test('Antigravity ask: a persistent tool-only result fails with a readable explanation after one retry (0.9.62)',async()=>{
 const {root,data,bin}=fixtureSetup('tool-only');let app;
 try{
  app=await launch(data,bin);
  let r=await app.request('POST','/api/vault/unlock',{password:'antigravity-test-strong-pass'});assert.equal(r.status,200);
  r=await app.request('POST','/api/antigravity/connect',{name:'Google personal'});assert.equal(r.status,200);const id=r.value.id;
  r=await app.request('GET',`/api/antigravity/${id}/models`);assert.equal(r.status,200);
  r=await app.request('POST',`/api/antigravity/${id}/verify`,{model:'gemini-test-flash'});assert.equal(r.status,500);
  const msg=String(r.value.error||'');assert.ok(msg.includes('không trả lời bằng văn bản')&&msg.includes('thử lại một lần'),'readable explanation required, got: '+msg);
  const asks=fixtureCalls(bin).filter(a=>a.includes('--model'));assert.equal(asks.length,2,'one retry before failing');
 }finally{if(app)await app.stop();fs.rmSync(root,{recursive:true,force:true})}
});
test('Founder chat: a provider failure keeps the user message as sent and stores the real reason (0.9.62)',async()=>{
 const {root,data,bin}=fixtureSetup('ask-error');let app;
 try{
  app=await launch(data,bin);
  let r=await app.request('POST','/api/vault/unlock',{password:'antigravity-test-strong-pass'});assert.equal(r.status,200);
  r=await app.request('POST','/api/antigravity/connect',{name:'Google personal'});assert.equal(r.status,200);const id=r.value.id;
  r=await app.request('GET',`/api/antigravity/${id}/models`);assert.equal(r.status,200);
  r=await app.request('POST',`/api/connections/${id}/model`,{model:'gemini-test-flash'});assert.equal(r.status,200);
  r=await app.request('POST','/api/projects',{name:'Chat giữ tin',idea:'Thử chat'});assert.equal(r.status,200);const project=r.value;
  r=await app.request('POST',`/api/projects/${project.id}/chat`,{connectionId:id,message:'tìm tin tức về vàng sáng nay'});assert.equal(r.status,500,'the lead reply itself failed');
  r=await app.request('GET',`/api/projects/${project.id}`);assert.equal(r.status,200);
  const msgs=(r.value.messages||[]).filter(m=>m.role==='user');
  assert.equal(msgs.length,1,'the user message must stay in the thread');
  assert.equal(msgs[0].content,'tìm tin tức về vàng sáng nay');
  assert.equal(msgs[0].status,'sent','a stored message must not be marked as a failed SEND');
  assert.ok(String(msgs[0].replyError||'').includes('hạn mức'),'the real reason (router exhaustion after the CLI quota failure) must be stored on the message: '+JSON.stringify(msgs[0]));
 }finally{if(app)await app.stop();fs.rmSync(root,{recursive:true,force:true})}
});
