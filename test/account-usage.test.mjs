// Isolated HTTP/stdio fixtures only. These tests do not sign into a live account.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {DATA_DIR,readJson} from '../src/lib/store.mjs';
import {unlockVault,lockVault,saveConnection,getConnection,listConnections} from '../src/lib/vault.mjs';
import {ask} from '../src/lib/providers.mjs';
import {recordModels,roleRef,verifiedBinding,recordAccountCatalog,recordAccountModel,modelAvailability} from '../src/lib/model-bindings.mjs';
import {createProject,updateProjectModelRoles,founderChat} from '../src/lib/projects.mjs';
import {runNativeTask,reviewNativeTask} from '../src/lib/native-agent.mjs';
import {usageSummary,recordUsage,normalizeUsage} from '../src/lib/usage.mjs';
import {AccountRpc,startAccountLogin,refreshAccount,cancelAccountLogin,logoutAccount,readAccountUsage,verifyAccountModel,listAccountModels,deleteAccountProfile,closeAccountSessions,normalizeRateLimits,codexLauncher} from '../src/lib/account-auth.mjs';
function reset(){lockVault();for(const n of ['vault.enc.json','projects.json','model-registry.json','provider-usage.json'])for(const suffix of ['', '.bak'])fs.rmSync(path.join(DATA_DIR,n+suffix),{force:true});unlockVault('account-usage-fixture-password');}
async function fixture(handler){const server=http.createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;const result=handler(req,text?JSON.parse(text):{});res.writeHead(result.status||200,{'content-type':'application/json'});res.end(JSON.stringify(result.body));});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {base:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};}
test('all four provider protocols capture real input/output/cache, concurrent accounts, missing usage and empty text before validation',async()=>{
 reset();const f=await fixture((req,b)=>({body:req.url==='/openai'?{output_text:b.input==='empty'?'':'answer',usage:{input_tokens:11,output_tokens:7,total_tokens:18,input_tokens_details:{cached_tokens:3}}}:req.url==='/gemini'?{candidates:[{content:{parts:[{text:'answer'}]}}],usageMetadata:{promptTokenCount:12,candidatesTokenCount:8,totalTokenCount:20,cachedContentTokenCount:4}}:req.url==='/anthropic'?{content:[{text:'answer'}],usage:{input_tokens:13,output_tokens:9,cache_read_input_tokens:5,cache_creation_input_tokens:2}}:{choices:[{message:{content:'answer'}}],...(b.messages?.at(-1)?.content==='missing'?{}:{usage:{prompt_tokens:14,completion_tokens:10,total_tokens:24,prompt_tokens_details:{cached_tokens:6}}})}}));
 try{
  const cs=['openai','gemini','anthropic','openai_compatible'].map(kind=>saveConnection({kind,name:kind,secret:'fixture-token-private',model:'fixture-model',baseUrl:f.base+'/'+kind.replace('openai_compatible','compatible')}));
  await Promise.all(cs.flatMap(c=>Array.from({length:4},()=>ask(c.id,{prompt:'fixture prompt not stored'}))));
  for(let i=0;i<cs.length;i++){const s=usageSummary(cs[i].id);assert.equal(s.responses,4);assert.equal(s.counts.input,(11+i)*4);assert.equal(s.counts.output,(7+i)*4);assert.equal(s.counts.cacheRead,(3+i)*4);}
  await ask(cs[3].id,{prompt:'missing'});assert.equal(usageSummary(cs[3].id).missingUsage,1);await assert.rejects(()=>ask(cs[0].id,{prompt:'empty'}),/rỗng/);assert.equal(usageSummary(cs[0].id).responses,5);
  const c=getConnection(cs[0].id);recordModels(c,['fixture-model']);const p=createProject({name:'Usage fixture',idea:'fixture'});updateProjectModelRoles(p.id,{founder:{connectionId:c.id,model:c.model}});await ask(roleRef(p.id,'founder'),{prompt:'role'});assert.ok(usageSummary(c.id).groups.some(g=>g.role==='founder'&&g.projectId===p.id));
  const plain=JSON.stringify(readJson('provider-usage.json',{}));assert.doesNotMatch(plain,/fixture-token-private|fixture prompt not stored/);
  const loaded=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`import {unlockVault} from './src/lib/vault.mjs';import {usageSummary} from './src/lib/usage.mjs';unlockVault('account-usage-fixture-password');console.log(JSON.stringify(usageSummary('${c.id}')));`],{encoding:'utf8'}));assert.equal(loaded.responses,6);
  lockVault();assert.throws(()=>usageSummary(c.id),/Vault/);
 }finally{await f.close();lockVault();}
});
test('retry success and duplicate completion count once; absent and malformed counters remain unknown',async()=>{
 reset();let tries=0;const f=await fixture(()=>++tries===1?{status:500,body:{usage:{input_tokens:999}}}:{body:{output_text:'ok',usage:{input_tokens:2,output_tokens:1}}});
 try{const c=saveConnection({kind:'openai',secret:'fixture-secret',model:'fixture',baseUrl:f.base});await ask(c.id,{prompt:'fixture'});assert.equal(tries,2);assert.equal(usageSummary(c.id).responses,1);recordUsage(c,{usage:{input_tokens:7}},'same-event');recordUsage(c,{usage:{input_tokens:7}},'same-event');assert.equal(usageSummary(c.id).responses,2);assert.equal(usageSummary(c.id).counts.input,9);assert.equal(normalizeUsage('openai',{usage:{input_tokens:-1,output_tokens:'9'}}),null);assert.equal(normalizeUsage('gemini',{}),null);assert.equal(normalizeUsage('openai',{usage:{input_tokens:0}}).input,0);}finally{await f.close();lockVault();}
});
const script=`#!/usr/bin/env node
import readline from 'node:readline';
import fs from 'node:fs';
const stateFile=process.env.CODEX_HOME+'/fixture-state.json';
let initialized=false,threadCounter=0,threads=new Map();
let email;try{email=JSON.parse(fs.readFileSync(stateFile)).email}catch{}
const emit=x=>process.stdout.write(JSON.stringify(x)+'\\n');
readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id===undefined)return;if(!initialized&&m.method!=='initialize'){emit({id:m.id,error:{code:-1,message:'before handshake'}});return;}let result={};switch(m.method){case 'initialize':setTimeout(()=>{initialized=true;emit({id:m.id,result:{userAgent:'fixture/0.162.1'}})},20);return;case 'account/login/start':result={loginId:'fixture-login',authUrl:'https://auth.openai.com/authorize?fixture=true',verificationUrl:'https://auth.openai.com/codex/device',userCode:'FIXTURE-1234'};setTimeout(()=>{email='isolated-fixture@example.invalid';fs.writeFileSync(stateFile,JSON.stringify({email}));emit({method:'account/login/completed',params:{loginId:'fixture-login',success:true}})},35);break;case 'account/read':result={account:email?{type:'chatgpt',email,planType:'fixture-plan'}:null};break;case 'account/logout':email=null;fs.writeFileSync(stateFile,JSON.stringify({email}));break;case 'account/rateLimits/read':result={rateLimits:{primary:{usedPercent:20,windowDurationMins:300,resetsAt:1900000000},secondary:{usedPercent:40,windowDurationMins:10080,resetsAt:1900600000}}};break;case 'account/usage/read':result={summary:{lifetimeTokens:null}};break;case 'config/read':result={config:{mcp_servers:fs.existsSync(stateFile+'.mcp')?{unexpected:{enabled:true}}:{}}};break;case 'model/list':result={data:['gpt-fixture','worker-fixture','reviewer-fixture','unsafe-fixture','failed-fixture','slow-fixture'].map(model=>({model})),nextCursor:null};break;
case 'thread/start':{const id='thread-'+(++threadCounter);threads.set(id,m.params.model);result={thread:{id,environments:m.params.model==='unsafe-fixture'?[{id:'host'}]:[],cliVersion:'0.162.1'},model:m.params.model,modelProvider:'openai',runtimeWorkspaceRoots:[],instructionSources:[],approvalPolicy:'never',sandbox:{type:'readOnly'}};break;}
case 'turn/start':{const model=threads.get(m.params.threadId);if(model==='failed-fixture'){emit({id:m.id,error:{code:-1}});return;}result={turn:{id:'turn-1',status:'inProgress'}};if(model==='slow-fixture')break;setTimeout(()=>{const p={threadId:m.params.threadId,turnId:'turn-1',tokenUsage:{total:{inputTokens:10,outputTokens:3,cachedInputTokens:2,cacheWriteInputTokens:0,reasoningOutputTokens:1,totalTokens:13}}};emit({method:'thread/tokenUsage/updated',params:p});emit({method:'thread/tokenUsage/updated',params:p});const text=model==='worker-fixture'?JSON.stringify({tool:'done',summary:'fixture done'}):model==='reviewer-fixture'?JSON.stringify({approved:true,summary:'fixture review',risks:[],fixes:[]}):'OK';const event={method:'turn/completed',params:{threadId:m.params.threadId,turn:{id:'turn-1',status:'completed',items:[{type:'agentMessage',text}]}}};emit(event);emit(event);},20);break;}
case 'thread/unsubscribe':break;case 'turn/interrupt':break;case 'account/login/cancel':break;default:emit({id:m.id,error:{code:-32601,message:'fixture secret never surface'}});return;}emit({id:m.id,result});});
`;
test('managed account profile lifecycle uses isolated stdio, real windows contract, cancel/logout/lock and launcher safety',async()=>{
 reset();const dir=fs.mkdtempSync(path.join(os.tmpdir(),'account-fixture-')),before=process.env.PATH,home=process.env.HOME,codexHome=process.env.CODEX_HOME;
 fs.writeFileSync(path.join(dir,'codex'),script.replace('#!/usr/bin/env node','#!'+process.execPath),{mode:0o700});process.env.PATH=dir+path.delimiter+before;
 try{const a=await startAccountLogin({name:'Fixture account'});assert.equal(a.state,'pending');assert.match(a.login.authUrl,/^https:\/\/auth.openai.com/);await new Promise(r=>setTimeout(r,80));const status=await refreshAccount(a.id);assert.equal(status.state,'connected');assert.equal(status.account.email,'isolated-fixture@example.invalid');const usage=await readAccountUsage(a.id);assert.equal(usage.rateLimits.primary.windowDurationMins,300);assert.equal(usage.rateLimits.secondary.usedPercent,40);assert.equal(usage.lifetimeTokens,null);assert.equal(process.env.HOME,home);assert.equal(process.env.CODEX_HOME,codexHome);const profile=path.join(DATA_DIR,'account-profiles',a.id);if(process.platform!=='win32')assert.equal(fs.statSync(profile).mode&0o777,0o700);assert.equal(getConnection(a.id).secret,'');
 const version=getConnection(a.id).credentialVersion;await logoutAccount(a.id);assert.notEqual(getConnection(a.id).credentialVersion,version);assert.equal((await refreshAccount(a.id)).state,'disconnected');const b=await startAccountLogin({type:'chatgptDeviceCode'});assert.equal(b.login.userCode,'FIXTURE-1234');await cancelAccountLogin(b.id);lockVault();await assert.rejects(()=>refreshAccount(a.id),/Vault/);assert.throws(()=>listConnections(),/vault/i);
 const custom=normalizeRateLimits({rateLimits:{primary:{usedPercent:31,windowDurationMins:90,resetsAt:1900000000},secondary:{usedPercent:200}}});assert.equal(custom.rateLimits.primary.windowDurationMins,90);assert.equal(custom.rateLimits.secondary,null);
 const win=path.join(dir,'node_modules','@openai','codex','bin');fs.mkdirSync(win,{recursive:true});fs.writeFileSync(path.join(win,'codex.js'),'');assert.deepEqual(codexLauncher({PATH:dir},'win32'),{command:process.execPath,args:[path.join(win,'codex.js')]});assert.throws(()=>codexLauncher({PATH:path.join(dir,'absent')}),/Chưa tìm thấy/);
 }finally{closeAccountSessions();process.env.PATH=before;fs.rmSync(dir,{recursive:true,force:true});lockVault();}
});
test('stdio refuses server tools, bounds timeout, and never forwards provider error secrets',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rpc-fixture-'));const file=path.join(dir,'server.mjs');fs.writeFileSync(file,`import readline from 'node:readline';readline.createInterface({input:process.stdin}).on('line',l=>{let m=JSON.parse(l);if(m.method==='timeout')return;if(m.method){process.stdout.write(JSON.stringify({method:'item/tool/call',id:'tool-1',params:{}})+'\\n');process.stdout.write(JSON.stringify({id:m.id,error:{message:'do-not-leak-fixture-secret'}})+'\\n');}});`);const rpc=new AccountRpc({command:process.execPath,args:[file],cwd:dir,env:{},timeoutMs:2000}); // 2000 (not 100): the budget must exceed the fixture child's Node boot time, else the FIRST request times out and closes the session before the leak assertion runs — the bound being tested is that a hanging request rejects with the timeout error, which still holds.try{await assert.rejects(()=>rpc.request('bad'),e=>!e.message.includes('do-not-leak'));await assert.rejects(()=>rpc.request('timeout'),/thời gian/);assert.equal(rpc.closed,true);}finally{rpc.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('account inference reaches Founder/native Worker/Reviewer only after verified response; token events dedupe and unsafe/failed/locked turns fail closed',async()=>{
 reset();const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inference-fixture-')),before=process.env.PATH,work=fs.mkdtempSync(path.join(os.tmpdir(),'native-fixture-'));fs.writeFileSync(path.join(dir,'codex'),script.replace('#!/usr/bin/env node','#!'+process.execPath),{mode:0o700});process.env.PATH=dir+path.delimiter+before;
 try{const a=await startAccountLogin({name:'Inference fixture'});await new Promise(r=>setTimeout(r,80));await refreshAccount(a.id);await listAccountModels(a.id);assert.equal(modelAvailability(a.id).status,'unverified');assert.throws(()=>verifiedBinding({connectionId:a.id,model:'gpt-fixture'}),/xác minh/);
 for(const model of ['gpt-fixture','worker-fixture','reviewer-fixture'])await verifyAccountModel(a.id,model);
 assert.equal(usageSummary(a.id).responses,3);assert.equal(usageSummary(a.id).counts.input,30);assert.equal(usageSummary(a.id).counts.reasoning,3);
 const p=createProject({name:'Account role fixture',idea:'fixture'}),b=model=>({connectionId:a.id,model});updateProjectModelRoles(p.id,{founder:b('gpt-fixture'),worker:b('worker-fixture'),reviewer:b('reviewer-fixture')});assert.equal(await founderChat(p.id,a.id,'fixture'),'OK');await runNativeTask({root:work,workerId:roleRef(p.id,'worker'),spec:'fixture',task:{id:'T1',title:'fixture'},maxTurns:1});assert.equal((await reviewNativeTask({reviewerId:roleRef(p.id,'reviewer'),spec:'fixture',task:{id:'T1'},diff:'fixture'})).approved,true);assert.equal(usageSummary(a.id).responses,6);closeAccountSessions();const concurrent=await Promise.all([refreshAccount(a.id),refreshAccount(a.id),refreshAccount(a.id)]);assert.ok(concurrent.every(x=>x.state==='connected'));const mcp=path.join(DATA_DIR,'account-profiles',a.id,'fixture-state.json.mcp');fs.writeFileSync(mcp,'fixture');await assert.rejects(()=>verifyAccountModel(a.id,'gpt-fixture'),/MCP/);fs.rmSync(mcp);
 const frozen=verifiedBinding(b('gpt-fixture'));const c=getConnection(a.id);saveConnection({...c,meta:{...c.meta,accountIdentity:'different-fixture@example.invalid'}});assert.throws(()=>verifiedBinding(frozen),/xác minh|thay đổi/);assert.equal(usageSummary(a.id).responses,0);await refreshAccount(a.id);assert.equal(usageSummary(a.id).responses,6);
 await assert.rejects(()=>verifyAccountModel(a.id,'unsafe-fixture'),/chặn inference/);await refreshAccount(a.id);await assert.rejects(()=>verifyAccountModel(a.id,'failed-fixture'),/không hỗ trợ/);
 const pending=verifyAccountModel(a.id,'slow-fixture');setTimeout(lockVault,80);await assert.rejects(()=>pending,/đóng|Vault|thay đổi/);unlockVault('account-usage-fixture-password');await deleteAccountProfile(a.id);assert.equal(fs.existsSync(path.join(DATA_DIR,'account-profiles',a.id)),false);
 }finally{closeAccountSessions();process.env.PATH=before;fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(work,{recursive:true,force:true});lockVault();}
});
test('account catalogue removal and per-model verification age remain fail closed; metric coverage is explicit',()=>{
 reset();const c=saveConnection({kind:'chatgpt_account',name:'Catalog fixture',meta:{accountIdentity:'catalog@example.invalid'}});recordAccountCatalog(c,['one','two']);recordAccountModel(c,'one');recordAccountModel(c,'two');recordAccountCatalog(c,['two']);assert.deepEqual(modelAvailability(c.id).models,['two']);recordUsage(c,{usage:{inputTokens:10,reasoningOutputTokens:2}},'1');recordUsage(c,{usage:{outputTokens:4}},'2');const s=usageSummary(c.id);assert.equal(s.coverage.input,1);assert.equal(s.coverage.output,1);assert.equal(s.coverage.cacheRead,0);assert.equal(s.responses,2);lockVault();
});


test('stdio preserves Vietnamese and emoji split across bytes in response and notification lines',async()=>{
 const expected='Tiếng Việt 😀';
 const fixtureCode=`
  const requests=[];let input='';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data',chunk=>{input+=chunk;let at;while((at=input.indexOf('\\n'))>=0){requests.push(JSON.parse(input.slice(0,at)));input=input.slice(at+1);}if(requests.length!==2)return;
   const text='Tiếng Việt 😀';
   const raw=Buffer.from([{id:requests[0].id,result:{text}},{method:'fixture/update',params:{text}},{id:requests[1].id,result:{text}}].map(x=>JSON.stringify(x)).join('\\n')+'\\n');
   const cuts=[];for(const char of ['ế','😀']){const bytes=Buffer.from(char);let from=0,pos;while((pos=raw.indexOf(bytes,from))>=0){for(let n=1;n<bytes.length;n++)cuts.push(pos+n);from=pos+bytes.length;}}
   cuts.sort((a,b)=>a-b);cuts.push(raw.length);let start=0;
   const send=()=>{const end=cuts.shift();process.stdout.write(raw.subarray(start,end));start=end;if(cuts.length)setTimeout(send,30);};send();
  });`;
 const notifications=[];const rpc=new AccountRpc({command:process.execPath,args:['-e',fixtureCode],env:{},timeoutMs:3000,onNotification:(method,params)=>notifications.push({method,params})});
 try{const results=await Promise.all([rpc.request('first'),rpc.request('second')]);assert.deepEqual(results,[{text:expected},{text:expected}]);assert.deepEqual(notifications,[{method:'fixture/update',params:{text:expected}}]);}finally{rpc.close();}
});
