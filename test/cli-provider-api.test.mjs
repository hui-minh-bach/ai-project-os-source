// Real HTTP interface with a hermetic mock of the official CLI process.
// This does not prove that a real customer's OAuth plan is entitled to a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
const ROOT=path.resolve(import.meta.dirname,'..');
const TOKEN='b'.repeat(64);
const portAvailable=async()=>{const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;s.close();await once(s,'close');return port;};
function mockEntry(parent,kind,code){const entry=kind==='claude'?'@anthropic-ai/claude-code/cli.js':'@google/gemini-cli/dist/index.js';const file=path.join(parent,'ai-tools','node_modules',...entry.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,code);}
async function launch(dataDir){const port=await portAvailable(),child=spawn(process.execPath,['src/server.mjs'],{cwd:ROOT,env:{...process.env,AI_PROJECT_OS_DATA_DIR:dataDir,AI_PROJECT_OS_LAUNCH_TOKEN:TOKEN,AI_PROJECT_OS_PORT:String(port)},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Server exit '+logs);try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok)break;}catch{}await delay(70);}
 const base=`http://127.0.0.1:${port}`;const response=await fetch(base+`/?launch=${TOKEN}`,{redirect:'manual'});assert.equal(response.status,303);const cookie=(response.headers.get('set-cookie')||'').split(';')[0];assert.ok(cookie.startsWith('aios_personal_session='));
 const request=async(method,url,body)=>{const r=await fetch(base+url,{method,headers:{Cookie:cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,payload:await r.json()};};
 return {child,request,base,stop:async()=>{if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),delay(3000)]);if(child.exitCode===null)child.kill('SIGKILL');}}};
}
test('local API and Founder use actually returned CLI text; auth/model failures stay unverified, upgrade retains all user data',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-cli-http-')),data=path.join(root,'data');let app,app2;
 try{
  mockEntry(root,'claude',`const i=process.argv.indexOf('--model');const m=i>=0?process.argv[i+1]:'';if(m==='bad-model'){process.stdout.write(JSON.stringify({type:'result',is_error:true,result:'no access'}));process.exit(0)};console.log(JSON.stringify({type:'result',result:'Mocked Claude response: '+m,model:m,usage:{input_tokens:3,output_tokens:4}}));`);
  mockEntry(root,'gemini',`const i=process.argv.indexOf('--model');const m=i>=0?process.argv[i+1]:'';console.log(JSON.stringify({response:'Mocked Gemini response: '+m,stats:{models:{[m]:{tokens:{input:4,output:3}}}}}));`);
  app=await launch(data);
  let r=await app.request('GET','/api/ai-tools');assert.equal(r.status,200);assert.equal(r.payload.find(x=>x.kind==='claude').managed,true);
  r=await app.request('POST','/api/cli-accounts/claude/connect',{name:'CLI fixture'});assert.equal(r.status,500,'locked vault blocks creating even an unverified account');
  r=await app.request('POST','/api/vault/unlock',{password:'local-fixture-vault-2026-strong'});assert.equal(r.status,200);
  r=await app.request('POST','/api/connections',{kind:'claude_account',name:'Forged',meta:{authMode:'cli-account',verifiedAt:new Date().toISOString()}});assert.equal(r.status,500,'generic route blocks forging a logged-in account');
  r=await app.request('POST','/api/cli-accounts/claude/connect',{name:'CLI fixture'});assert.equal(r.status,200);const id=r.payload.id;assert.match(id,/^[a-f0-9-]{36}$/);
  r=await app.request('GET','/api/connections');assert.equal(r.payload.find(x=>x.id===id).availability.status,'unverified');
  r=await app.request('POST',`/api/cli-accounts/${id}/verify`,{model:'bad-model'});assert.equal(r.status,500);assert.equal((await app.request('GET','/api/connections')).payload.find(x=>x.id===id).availability.status,'unverified');
  r=await app.request('POST',`/api/cli-accounts/${id}/verify`,{model:'sonnet'});assert.equal(r.status,200);assert.equal(r.payload.model,'sonnet');
  r=await app.request('POST',`/api/connections/${id}/model`,{model:'sonnet'});assert.equal(r.status,200);
  assert.equal((await app.request('GET','/api/connections')).payload.find(x=>x.id===id).availability.status,'verified');
  r=await app.request('POST','/api/projects',{name:'Do not erase this Vietnamese project',idea:'Build something useful'});assert.equal(r.status,200);const project=r.payload;
  r=await app.request('POST',`/api/projects/${project.id}/model-roles`,{founder:{connectionId:id,model:'sonnet'}});assert.equal(r.status,200);
  r=await app.request('POST',`/api/projects/${project.id}/chat`,{connectionId:id,message:'Xin chào'});assert.equal(r.status,200);assert.equal(r.payload.reply,'Mocked Claude response: sonnet');
  const gem=await app.request('POST','/api/cli-accounts/gemini/connect',{name:'Gemini fixture'});assert.equal(gem.status,200);
  const gver=await app.request('POST',`/api/cli-accounts/${gem.payload.id}/verify`,{model:'gemini-2.5-flash'});assert.equal(gver.status,200);
  const gm=await app.request('POST',`/api/connections/${gem.payload.id}/model`,{model:'gemini-2.5-flash'});assert.equal(gm.status,200);
  const prev=fs.readFileSync(path.join(data,'projects.json'),'utf8');assert.ok(prev.includes('Do not erase'));
  const vault=fs.readFileSync(path.join(data,'vault.enc.json'),'utf8');assert.ok(!vault.includes('local-fixture-vault-2026-strong'));
  await app.stop();app=null;
  // Simulate extracting a fresh program directory while reusing per-user DATA_DIR.
  const other=path.join(root,'upgrade');fs.mkdirSync(other);fs.cpSync(path.join(ROOT,'src'),path.join(other,'src'),{recursive:true});fs.cpSync(path.join(ROOT,'public'),path.join(other,'public'),{recursive:true});
  const reread=spawn(process.execPath,['-e',`import { readJson } from './src/lib/store.mjs';console.log(JSON.stringify({projects:readJson('projects.json',[]).length,marker:readJson('projects.json',[])[0]?.name}))`],{cwd:other,env:{...process.env,AI_PROJECT_OS_DATA_DIR:data}});
  let output='';for await(const chunk of reread.stdout)output+=chunk.toString();await once(reread,'close');
  assert.deepEqual(JSON.parse(output.trim()),{projects:1,marker:'Do not erase this Vietnamese project'});
  assert.equal(fs.readFileSync(path.join(data,'vault.enc.json'),'utf8'),vault,'vault bytes must not change after app replacement');
  assert.equal(fs.readFileSync(path.join(data,'projects.json'),'utf8'),prev,'data bytes are not rewritten after app replacement');
 }finally{if(app)await app.stop();if(app2)await app2.stop();fs.rmSync(root,{recursive:true,force:true})}
});
