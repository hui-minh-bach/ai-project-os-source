import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DATA_DIR } from '../src/lib/store.mjs';
import { unlockVault, lockVault } from '../src/lib/vault.mjs';
import { startAccountLogin, refreshAccount, readAccountUsage, listAccountModels, verifyAccountModel, closeAccountSessions } from '../src/lib/account-auth.mjs';
import { modelAvailability } from '../src/lib/model-bindings.mjs';
import { describeCodexTurnFailure, chooseCodexText, quotaWindowNotice } from '../src/lib/codex-turn-diagnostics.mjs';

const CLI_FIXTURE=`#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
const dir=process.env.CODEX_HOME;
const file=path.join(dir,'fake-account.json');
const session=()=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return {}}};
const emit=o=>process.stdout.write(JSON.stringify(o)+'\\n');
let number=0,models=new Map();
readline.createInterface({input:process.stdin}).on('line',line=>{
 const req=JSON.parse(line);if(!Number.isInteger(req.id))return;
 let result={};switch(req.method){
  case 'initialize':result={userAgent:'fixture/0.162.1'};break;
  case 'account/login/start':result={loginId:'login',authUrl:'https://auth.openai.com/authorize'};setTimeout(()=>{fs.writeFileSync(file,JSON.stringify({email:path.basename(dir)+'@example.invalid'}));emit({method:'account/login/completed',params:{loginId:'login',success:true}})},25);break;
  case 'account/read':{const s=session();result={account:s.email?{type:'chatgpt',email:s.email,planType:'fixture'}:null};break;}
  case 'model/list':result={data:['quota-fixture','event-fixture','auth-fixture','silent-fixture'].map(model=>({model})),nextCursor:null};break;
  case 'config/read':result={config:{mcp_servers:{}}};break;
  case 'account/rateLimits/read':{let usage=20;try{usage=JSON.parse(fs.readFileSync(path.join(dir,'fake-limits.json'),'utf8')).usedPercent}catch{}result={rateLimits:{primary:{usedPercent:usage,windowDurationMins:300,resetsAt:1900000000},secondary:{usedPercent:48,windowDurationMins:10080,resetsAt:1900600000}}};break;}
  case 'thread/start':{const id='thread-'+(++number);models.set(id,req.params.model);result={thread:{id,environments:[],cliVersion:'0.162.1'},model:req.params.model,modelProvider:'openai',runtimeWorkspaceRoots:[],instructionSources:[],approvalPolicy:'never',sandbox:{type:'readOnly'}};break;}
  case 'turn/start':{
    result={turn:{id:'turn-1',status:'inProgress'}};const model=models.get(req.params.threadId);
    setTimeout(()=>{
      if(model==='quota-fixture'||model==='auth-fixture'){
        const code=model==='quota-fixture'?429:401;
        const error={message:code===429?'You have hit your usage limit TOKEN_SUPER_SECRET':'401 Unauthorized TOKEN_SUPER_SECRET',codexErrorInfo:{httpConnectionFailed:{httpStatusCode:code}},additionalDetails:'TOKEN_SUPER_SECRET'};
        emit({method:'error',params:{threadId:req.params.threadId,turnId:'turn-1',error,willRetry:false}});
        emit({method:'turn/completed',params:{threadId:req.params.threadId,turn:{id:'turn-1',status:'failed',error,items:[]}}});
      }else{
        if(model==='event-fixture')emit({method:'item/completed',params:{threadId:req.params.threadId,turnId:'turn-1',item:{id:'msg-1',type:'agentMessage',text:'OK'}}});
        emit({method:'turn/completed',params:{threadId:req.params.threadId,turn:{id:'turn-1',status:'completed',items:[],itemsView:'notLoaded'}}});
      }
    },15);
    break;
  }
  case 'thread/unsubscribe':break;
  default:emit({id:req.id,error:{code:-1,message:'Fixture unknown method'}});return;
 }
 emit({id:req.id,result});
});`;

function resetVault(){
 lockVault();for(const name of ['vault.enc.json','model-registry.json','provider-usage.json'])for(const suffix of ['', '.bak'])fs.rmSync(path.join(DATA_DIR,name+suffix),{force:true});
 unlockVault('codex-recovery-isolated-fixture-password');
}
test('Codex failure classes retain safe context and reject empty successful turns',()=>{
 const quota=describeCodexTurnFailure({message:'usage limit exceeded TOKEN_PRIVATE',codexErrorInfo:{httpConnectionFailed:{httpStatusCode:429}}});
 assert.equal(quota.code,'CODEX_RATE_LIMIT');assert.match(quota.message,/hạn mức/);assert.doesNotMatch(quota.message,/TOKEN_PRIVATE/);
 assert.equal(describeCodexTurnFailure({message:'token expired',codexErrorInfo:{httpConnectionFailed:{httpStatusCode:401}}}).code,'CODEX_AUTH_EXPIRED');
 assert.equal(describeCodexTurnFailure({message:'workspace routing discovery failed'}).code,'CODEX_SERVICE_ERROR');
 assert.equal(chooseCodexText([],[{type:'agentMessage',text:'OK'}]),'OK');
 assert.equal(chooseCodexText([],[{type:'tool',text:'NEVER'}]),'');
 assert.ok(quotaWindowNotice({rateLimits:{primary:{usedPercent:100,windowDurationMins:300,resetsAt:1900000000}}}));
 assert.equal(quotaWindowNotice({rateLimitsByLimitId:{'unrelated':{primary:{usedPercent:100,windowDurationMins:300}}}},'different-model'),null);
});
test('two ChatGPT login profiles can read separate quotas before model verification and classify inference failures',async()=>{
 resetVault();const dir=fs.mkdtempSync(path.join(os.tmpdir(),'codex-recovery-fixture-'));const oldPath=process.env.PATH;
 fs.writeFileSync(path.join(dir,'codex'),CLI_FIXTURE.replace('#!/usr/bin/env node','#!'+process.execPath),{mode:0o700});process.env.PATH=dir+path.delimiter+oldPath;
 try{
  const a=await startAccountLogin({name:'Account A'}),b=await startAccountLogin({name:'Account B'});
  await new Promise(r=>setTimeout(r,100));
  assert.equal((await refreshAccount(a.id)).state,'connected');assert.equal((await refreshAccount(b.id)).state,'connected');
  const aHome=path.join(DATA_DIR,'account-profiles',a.id),bHome=path.join(DATA_DIR,'account-profiles',b.id);
  fs.writeFileSync(path.join(aHome,'fake-limits.json'),JSON.stringify({usedPercent:100}));fs.writeFileSync(path.join(bHome,'fake-limits.json'),JSON.stringify({usedPercent:20}));
  assert.equal(modelAvailability(a.id).status,'unverified');assert.equal(modelAvailability(b.id).status,'unverified');
  assert.equal((await readAccountUsage(a.id)).rateLimits.primary.usedPercent,100);
  assert.equal((await readAccountUsage(b.id)).rateLimits.primary.usedPercent,20);
  assert.equal(modelAvailability(a.id).status,'unverified');
  await listAccountModels(a.id);await listAccountModels(b.id);
  await assert.rejects(()=>verifyAccountModel(a.id,'quota-fixture'),e=>e.code==='CODEX_RATE_LIMIT'&&!e.message.includes('TOKEN_SUPER_SECRET'));
  await assert.rejects(()=>verifyAccountModel(a.id,'auth-fixture'),e=>e.code==='CODEX_AUTH_EXPIRED'&&!e.message.includes('TOKEN_SUPER_SECRET'));
  await assert.rejects(()=>verifyAccountModel(b.id,'silent-fixture'),/không trả nội dung văn bản/);
  assert.equal(modelAvailability(a.id).status,'unverified');
  await verifyAccountModel(b.id,'event-fixture');
  assert.deepEqual(modelAvailability(b.id).models,['event-fixture']);
  assert.equal(modelAvailability(a.id).status,'unverified');
 }finally{closeAccountSessions();lockVault();process.env.PATH=oldPath;fs.rmSync(dir,{recursive:true,force:true});}
});
