'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createCore}=require('../core.cjs');
function fixture(options={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-core-a08-'));
 const core=createCore({root,...options});
 return {root,core,close(){core.close();fs.rmSync(root,{recursive:true,force:true});}};
}
test('A0: an approved file_read still refuses .env and git credential files',async()=>{
 const f=fixture();try{
  const workspace=path.join(f.root,'workspaces','p','task');fs.mkdirSync(path.join(workspace,'.git'),{recursive:true});
  fs.writeFileSync(path.join(workspace,'.env'),'SECRET=NEVER_READ');fs.writeFileSync(path.join(workspace,'.git','config'),'TOKEN=NEVER_READ');
  for(const rel of ['.env','.git/config'])await assert.rejects(
   f.core.tools.call('file_read',{path:rel},{projectId:'p',workspaceId:'task',allowedTools:['file_read'],approved:true}),{code:'PATH_DENIED'});
 }finally{f.close();}
});
test('A0: interrupted file_write must NOT be automatically executed again on restart',()=>{
 const f=fixture();let second;try{
  const task=f.core.queue.add({projectId:'p',input:{approved:true,allowedTools:['file_write'],steps:[{tool:'file_write',args:{path:'output.txt',text:'data'}}]}});
  f.core.state.update(task.id,t=>{t.state='running';t.checkpoint={stage:'steps',nextStep:0,inFlight:'file_write'};});
  f.core.close();second=createCore({root:f.root});assert.notEqual(second.state.find(task.id).state,'queued');
  assert.ok(['interrupted','blocked'].includes(second.state.find(task.id).state));
 }finally{if(second)second.close();fs.rmSync(f.root,{recursive:true,force:true});}
});
test('A0: human-approved billed operation is idempotent across retries and restarts',async()=>{
 let calls=0;const fake={get:()=> 'fake-authorized-token'};const f=fixture({vault:fake,fetchImpl:async()=>{calls++;return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'OK'}}],usage:{prompt_tokens:5,completion_tokens:5}})};}});
 try{
  f.core.providers.register({id:'official',type:'openai',pricePerMillionInput:1,pricePerMillionOutput:1});
  f.core.providers.assign('Worker',{providerId:'official',model:'approved-model'});f.core.providers.setBudget(0.05);
  await assert.rejects(f.core.providers.generateApproved('Worker',{prompt:'test',approvalId:'missing'}),{code:'COST_APPROVAL_REQUIRED'});
  assert.equal(calls,0);
  // Verification makes a single bounded, explicitly approved request.
  await f.core.providers.verifyModel({providerId:'official',model:'approved-model',approved:true,costCeilingUsd:0.01});
  const a=f.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'job-001',maxUsd:0.01,approved:true});
  const result=await f.core.providers.generateApproved('Worker',{prompt:'Write one word',approvalId:a.id,projectId:'p'});
  assert.equal(result.text,'OK');const before=calls;
  await assert.rejects(f.core.providers.generateApproved('Worker',{prompt:'Write one word',approvalId:a.id,projectId:'p'}),{code:'COST_ALREADY_DISPATCHED'});
  assert.equal(calls,before);
 }finally{f.close();}
});
