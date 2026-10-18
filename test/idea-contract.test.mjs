import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { DATA_DIR, readJson, writeJson } from '../src/lib/store.mjs';
import { lockVault, unlockVault, saveConnection } from '../src/lib/vault.mjs';
import { recordModels } from '../src/lib/model-bindings.mjs';
import { createProject, updateProjectBrief, updateProjectModelRoles, getProject, founderChat, clearFounderChat, analyzeIdea, sendBriefToCouncil, recoverInterruptedFounderChats } from '../src/lib/projects.mjs';
import { normalizeAnalyzedBrief, normalizeIdeaStack } from '../src/lib/idea-brief.mjs';
const stack={needsGithub:true,needsVercel:true,needsDatabase:false,needsAuth:false,needsStorage:false,needsPayments:false,needsDomain:false,needsBackend:false,recommended:{source:'github',deploy:'vercel',database:'none'},reasons:['Static site'],setupOrder:['GitHub','Vercel']};
const brief={summary:'Static project summary',problem:'People need useful information',audience:'Local visitors',goals:['Publish useful information'],features:['Responsive pages'],userFlows:['Visit page and read'],constraints:[],openQuestions:[],successCriteria:['Page can be opened'],stack};
const fields={name:'Idea contract',productType:'website',audience:'Local visitors',goals:'Publish useful information',mainFeatures:['mobile']};
function reset(){lockVault();for(const n of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak','model-registry.json','model-registry.json.bak'])fs.rmSync(path.join(DATA_DIR,n),{force:true});unlockVault('idea-fixture-vault-2026');}
async function fixture(run){
 reset();let mode='normal',release,started;const waiting=new Promise(r=>started=r),seen=[];
 const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const j=JSON.parse(body);seen.push(j);const system=j.messages[0].content;
  let text=system.includes('IDEA_BRIEF_V1')?JSON.stringify(brief):'Founder asks a useful question.';
  if(mode==='invalid')text='{"summary":"bad"}';if(mode==='pause'){started();await new Promise(r=>release=r);}
  res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:text}}]}));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const c=saveConnection({kind:'openai_compatible',name:'HTTP idea fixture',model:'account-default',secret:'idea-not-a-live-secret',baseUrl:`http://127.0.0.1:${server.address().port}/v1`});recordModels(c,['account-default','selected-founder']);const p=createProject(fields);updateProjectModelRoles(p.id,{founder:{connectionId:c.id,model:'selected-founder'}});await run({p,c,seen,setMode:v=>mode=v,waiting,release:()=>release()});}
 finally{server.close();lockVault();}
}
test('project brief fields persist, reject unsupported input, and editing invalidates analyzed data',async()=>{
 await fixture(async({p})=>{assert.deepEqual(getProject(p.id).mainFeatures,['mobile']);assert.throws(()=>updateProjectBrief(p.id,{mainFeatures:['fake']}),/Tính năng/);assert.throws(()=>updateProjectBrief(p.id,{audience:{bad:1}}),/audience/);await analyzeIdea(p.id);const analyzed=getProject(p.id);assert.equal(analyzed.analyzedBrief.revision,0);updateProjectBrief(p.id,{goals:'New explicit goal'});const updated=getProject(p.id);assert.equal(updated.briefRevision,1);assert.equal(updated.analyzedBrief,null);assert.equal(updated.stack,null);assert.equal(updated.goals,'New explicit goal');assert.throws(()=>sendBriefToCouncil(p.id),/phân tích/);});
});
test('Founder uses configured role model, records actual history and timestamps, clears persisted messages',async()=>{
 await fixture(async({p,c,seen})=>{await founderChat(p.id,c.id,'First message');await founderChat(p.id,c.id,'Second message');assert.deepEqual(seen.map(x=>x.model),['selected-founder','selected-founder']);assert.match(seen[1].messages[1].content,/First message/);const stored=getProject(p.id);assert.equal(stored.messages.length,4);assert.ok(stored.messages.every(m=>Number.isFinite(Date.parse(m.at))));assert.ok(stored.messages.every(m=>m.status==='sent'));clearFounderChat(p.id);assert.deepEqual(getProject(p.id).messages,[]);});
});
test('AI brief validates complete stack, sends structured Council input without approving specification',async()=>{
 await fixture(async({p})=>{await analyzeIdea(p.id);const sent=sendBriefToCouncil(p.id);assert.equal(sent.councilBrief.summary,brief.summary);assert.equal(sent.councilBrief.project.productType,'website');assert.equal(sent.stack.needsGithub,true);assert.equal(sent.stack.needsPayments,false);assert.equal(sent.stage,'idea');assert.equal(sent.finalSpec,'');assert.deepEqual(sent.council,[]);});
});
test('malformed AI JSON fails and stale in-flight analysis cannot overwrite edited inputs',async()=>{
 await fixture(async({p,setMode,waiting,release})=>{setMode('invalid');await assert.rejects(()=>analyzeIdea(p.id),/problem/);assert.equal(getProject(p.id).analyzedBrief,null);setMode('pause');const request=analyzeIdea(p.id);await waiting;updateProjectBrief(p.id,{goals:'Edited while request ran'});release();await assert.rejects(()=>request,/thay đổi/);assert.equal(getProject(p.id).analyzedBrief,null);});
});
test('AI schemas reject strings masquerading as booleans, oversized lists and missing required sections',()=>{
 assert.throws(()=>normalizeIdeaStack({...stack,needsAuth:'false'}),/boolean/);assert.throws(()=>normalizeAnalyzedBrief({...brief,features:[]}),/trống/);assert.throws(()=>normalizeAnalyzedBrief({...brief,goals:Array(21).fill('x')}),/20/);assert.throws(()=>normalizeAnalyzedBrief({...brief,stack:{...stack,recommended:{...stack.recommended,deploy:'unknown'}}}),/deploy/);
});

test('boot recovery marks only persisted pending Founder messages failed and preserves history',()=>{
 reset();const p=createProject(fields);const stored=readJson('projects.json',[]);const project=stored.find(x=>x.id===p.id);
 project.messages=[{id:'sent',role:'user',content:'Completed question',at:'2026-10-07T09:00:00.000Z',status:'sent'},{id:'reply',role:'assistant',content:'Completed reply',at:'2026-10-07T09:00:01.000Z',status:'sent'},{id:'pending',role:'user',content:'Unfinished question',at:'2026-10-07T09:01:00.000Z',status:'pending'}];
 writeJson('projects.json',stored);assert.equal(recoverInterruptedFounderChats(),1);
 const recovered=getProject(p.id);assert.equal(recovered.messages.length,3);assert.deepEqual(recovered.messages.slice(0,2),project.messages.slice(0,2));
 const failed=recovered.messages[2];assert.equal(failed.id,'pending');assert.equal(failed.content,'Unfinished question');assert.equal(failed.at,'2026-10-07T09:01:00.000Z');assert.equal(failed.status,'failed');assert.ok(Number.isFinite(Date.parse(failed.interruptedAt)));assert.match(failed.error,/gửi lại/);
 assert.equal(recovered.name,fields.name);assert.deepEqual(recovered.mainFeatures,fields.mainFeatures);assert.equal(recoverInterruptedFounderChats(),0);lockVault();
});
