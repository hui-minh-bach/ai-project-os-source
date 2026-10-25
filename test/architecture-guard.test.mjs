import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
import {api,seed,proposal} from './helpers/architecture-guard-fixtures.mjs';
const runtime=isolatedRuntime('architecture-guard');after(()=>runtime.cleanup());
const projects=await runtime.import('src/lib/projects.mjs');
const {readJson,writeJson}=await runtime.import('src/lib/store.mjs');
const {unlockVault,saveConnection}=await runtime.import('src/lib/vault.mjs');
const {recordModels}=await runtime.import('src/lib/model-bindings.mjs');
const {prepareApprovedSpecification}=await runtime.import('test/helpers/council-fixtures.mjs');
const {workspaceDir}=await runtime.import('src/lib/workspace.mjs');
const {createTaskWorktree,commitTask,mergeTask,cleanupTaskWorktree}=await runtime.import('src/lib/task-git.mjs');
const {must}=await runtime.import('src/lib/shell.mjs');
const {normalizePolicy}=await runtime.import('src/lib/architecture-policy.mjs');
const {inspectArchitecture}=await runtime.import('src/lib/architecture-guard.mjs');

function edit(id,fn){const all=readJson('projects.json',[]);fn(all.find(p=>p.id===id));writeJson('projects.json',all);}
async function fixture(changes,{reviewRequired=true,onWorker,onReview}={}){
 unlockVault('architecture-guard-fixture-password');let output=proposal(),turn=0;const requests=[];
 const server=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw),system=String(b.instructions||''),prompt=String(b.input||'');requests.push({system,prompt});let value;
  if(system.includes('ARCHITECTURE_LITE_V1'))value=output;
  else if(system.includes('coding worker')){await onWorker?.();value=turn<changes.length?{tool:'write',...changes[turn++]}:{tool:'done',summary:'Done; this summary is not evidence'};}
  else if(system.includes('senior reviewer')){await onReview?.();value={approved:true,summary:'AI allows the change',risks:[],fixes:[]};}
  else value={tasks:[]};
  res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:JSON.stringify(value)}));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const c=saveConnection({kind:'openai',name:'Guard local fixture',model:'fixture',secret:'synthetic-only-credential',baseUrl:`http://127.0.0.1:${server.address().port}`});recordModels(c,['fixture']);
 const p=projects.createProject({name:'Guard fixture'});prepareApprovedSpecification(p.id,{}, {architecture:false});
 const root=workspaceDir(p.id);for(const [file,text] of Object.entries(seed)){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),text);}
 const binding={connectionId:c.id,model:'fixture'};projects.updateProjectModelRoles(p.id,{founder:binding,worker:binding,reviewer:binding});
 await projects.proposeArchitecture(p.id);let a=projects.getProject(p.id).architectures[0];projects.confirmCouncilArchitecture(p.id,{architectureId:a.id,contentHash:a.contentHash,explicitApproval:true});
 projects.updateProjectSettings(p.id,{reviewRequired,autoRepair:false});projects.createTask(p.id,{title:'Guarded change',role:'frontend',description:'Implement scoped change',doneWhen:'The change respects approved architecture'});
 return {id:p.id,root,requests,get:()=>projects.getProject(p.id),task:()=>projects.getProject(p.id).tasks[0],run:()=>projects.runTask(p.id,'T1'),setProposal:v=>output=v,resetTurns:()=>turn=0,close:()=>{server.closeAllConnections();server.close();}};
}
const criticalChanges=[
 ['module import',{path:'frontend/view.mjs',content:"import {data} from '../backend/service.mjs';\nexport function greet(name) { return data(); }\n"},'MODULE_IMPORT'],
 ['API contract',{path:'api/openapi.json',content:'{"paths":{}}\n'},'PROTECTED_CONTRACT'],
 ['dependency',{path:'package.json',content:'{"type":"module","dependencies":{"left-pad":"1.3.0"}}\n'},'DEPENDENCY_CHANGE'],
 ['database',{path:'database/schema.sql',content:'DROP TABLE items;\n'},'CRITICAL_ARCHITECTURE'],
 ['security',{path:'security/auth.mjs',content:'export const allow = true;\n'},'CRITICAL_ARCHITECTURE'],
 ['baseline edit',{path:'ARCHITECTURE.md',content:'# Worker approves itself\n'},'BASELINE_EDIT'],
 ['public signature',{path:'frontend/view.mjs',content:'export function greet() { return 1; }\n'},'BREAKING_PUBLIC_SURFACE'],
 ['architecture rule',{path:'frontend/state.mjs',content:"const state = localStorage.getItem('state');\n"},'ARCHITECTURE_RULE'],
 ['dynamic loader',{path:'frontend/load.mjs',content:'const name = "../backend/service.mjs"; const loaded = import(name);\n'},'DYNAMIC_IMPORT'],
 ['database builtin',{path:'frontend/persistence.mjs',content:"import { DatabaseSync } from 'node:sqlite';\nconst connection = new DatabaseSync('app.db');\n"},'SENSITIVE_RUNTIME_IMPORT'],
 ['indirect SQL',{path:'frontend/query.mjs',content:"const query = 'DROP TABLE users';\n"},'SECURITY_OR_API_LOGIC'],
 ['inline executable',{path:'frontend/page.html',content:'<script>import("../backend/service.mjs")</script>'},'ACTIVE_STATIC_CONTENT']
];
test('compliant scoped change PASSes coding and both merge boundaries; Worker and Reviewer get references, rules and receipt',async()=>{
 const f=await fixture([{path:'frontend/style.css',content:'body { color: navy; }\n'}]);
 try{const ref=f.task().architectureReference;assert.equal(ref.architectureVersion,1);assert.ok(ref.moduleIds.includes('frontend'));assert.ok(ref.acceptanceHash);
  const result=await f.run();assert.equal(result.merged,true);assert.equal(f.task().architectureCompliance.status,'PASS');
  const stages=f.task().executionRuns[0].architectureReceipts.map(r=>r.stage);for(const stage of ['coding','merge-preflight','merge-locked','merge-candidate','merge-result'])assert.ok(stages.includes(stage));
  for(const r of f.requests.filter(r=>/coding worker|senior reviewer/.test(r.system))){assert.match(r.prompt,/ARCHITECTURE COMPLIANCE/);assert.ok(r.prompt.includes(ref.architectureHash));assert.match(r.prompt,/applicableModules/);assert.match(r.prompt,/acceptanceCriteria/);}
  assert.match(f.requests.find(r=>r.system.includes('senior reviewer')).prompt,/TRUSTED ARCHITECTURE RECEIPT/);
  assert.equal(fs.readFileSync(path.join(f.root,'frontend/style.css'),'utf8'),'body { color: navy; }\n');
 }finally{f.close();}
});
for(const [name,change,code] of criticalChanges)test(`${name} BLOCKED even with AI Reviewer disabled; baseline/main preserved and Change Proposal created`,async()=>{
 const f=await fixture([change],{reviewRequired:false});
 try{const baseline=JSON.stringify(f.get().architectures[0]);await assert.rejects(f.run(),/Architecture BLOCKED/);
  assert.equal(f.task().status,'architecture-blocked');assert.equal(f.task().architectureCompliance.status,'BLOCKED');assert.ok(f.task().architectureCompliance.findings.some(x=>x.code===code));assert.equal(f.requests.some(r=>r.system.includes('senior reviewer')),false);
  assert.equal(JSON.stringify(f.get().architectures[0]),baseline);assert.ok(f.get().architectureChangeProposals.some(c=>c.status==='pending'));assert.equal(f.task().branchState,'retained');assert.equal(fs.existsSync(path.join(f.root,change.path)),Object.hasOwn(seed,change.path));if(Object.hasOwn(seed,change.path))assert.equal(fs.readFileSync(path.join(f.root,change.path),'utf8'),seed[change.path]);
 }finally{f.close();}
});
test('AI Reviewer approval cannot override breaking API change',async()=>{
 const f=await fixture([{path:'api/openapi.json',content:'{}\n'}]);try{await assert.rejects(f.run(),/Architecture BLOCKED/);assert.equal(f.task().status,'architecture-blocked');}finally{f.close();}
});
test('stale version before execution needs explicit PO rebind; Agent cannot bind through generic task editing',async()=>{
 const f=await fixture([{path:'frontend/style.css',content:'p { color: navy; }\n'}]);
 try{await projects.proposeArchitecture(f.id);const a=f.get().architectures.at(-1);projects.confirmCouncilArchitecture(f.id,{architectureId:a.id,contentHash:a.contentHash,explicitApproval:true});const count=f.requests.length;
  await assert.rejects(f.run(),/Architecture.*cũ/);assert.equal(f.requests.length,count);
  assert.throws(()=>projects.updateTask(f.id,'T1',{architectureReference:{architectureId:a.id}}),/state thực thi/);
  assert.throws(()=>projects.bindTaskArchitecture(f.id,'T1',{architectureId:a.id,contentHash:a.contentHash}),/PO/);
  projects.bindTaskArchitecture(f.id,'T1',{explicitApproval:true,architectureId:a.id,contentHash:a.contentHash,moduleIds:['frontend']});assert.equal((await f.run()).merged,true);
 }finally{f.close();}
});
test('architecture changes while Worker awaits cannot silently merge; active-task approvals refused',async()=>{
 let reached,release,paused=false;const waiting=new Promise(r=>reached=r),gate=new Promise(r=>release=r);
 const f=await fixture([{path:'frontend/style.css',content:'p { color: red; }\n'}],{reviewRequired:false,onWorker:async()=>{if(!paused){paused=true;reached();await gate;}}});
 try{const running=f.run();const rejected=assert.rejects(running,/Architecture đã thay đổi/);await waiting;
  await projects.proposeArchitecture(f.id);const a=f.get().architectures.at(-1);assert.throws(()=>projects.confirmCouncilArchitecture(f.id,{architectureId:a.id,contentHash:a.contentHash,explicitApproval:true}),/task đang chạy/);
  // Simulate out-of-band baseline replacement, bypassing the protected API.
  edit(f.id,p=>{a.status='approved';a.approvedAt=new Date().toISOString();p.architectures[p.architectures.length-1]=a;p.approvedArchitectureId=a.id;});release();await rejected;
  assert.equal(f.task().status,'stale');assert.equal(fs.existsSync(path.join(f.root,'frontend/style.css')),false);
 }finally{release();f.close();}
});
test('direct merge helper cannot bypass execution identity or guard',async()=>{
 const f=await fixture([],{reviewRequired:false});let wt;
 try{wt=await createTaskWorktree(f.id,'T1');fs.writeFileSync(path.join(wt.dir,'api/openapi.json'),'{}\n');await commitTask(wt,'unauthorized API');await assert.rejects(mergeTask(f.id,wt),/Architecture BLOCKED/);assert.equal(fs.readFileSync(path.join(f.root,'api/openapi.json'),'utf8'),api);
 }finally{if(wt)await cleanupTaskWorktree(f.id,wt);f.close();}
});
test('PO-approved Change Proposal creates a new baseline; approval never waives future checks',async()=>{
 const change={path:'package.json',content:'{"type":"module","dependencies":{"left-pad":"1.3.0"}}\n'},f=await fixture([change],{reviewRequired:false});
 try{await assert.rejects(f.run(),/BLOCKED/);const cp=f.get().architectureChangeProposals[0],previous=JSON.stringify(f.get().architectures[0]);
  const next=proposal();next.compliancePolicy.dependencies=[{name:'npm:left-pad',version:'1.3.0'}];f.setProposal(next);await projects.proposeArchitecture(f.id,undefined,{changeProposalId:cp.id});const a=f.get().architectures.at(-1);
  assert.equal(f.get().architectureChangeProposals[0].status,'pending');assert.throws(()=>projects.confirmCouncilArchitecture(f.id,{architectureId:a.id,contentHash:a.contentHash,explicitApproval:false}),/PO/);
  projects.confirmCouncilArchitecture(f.id,{architectureId:a.id,contentHash:a.contentHash,explicitApproval:true});assert.equal(f.get().architectureChangeProposals[0].status,'approved');assert.equal(JSON.stringify(f.get().architectures[0]),previous);
  projects.bindTaskArchitecture(f.id,'T1',{explicitApproval:true,architectureId:a.id,contentHash:a.contentHash});f.resetTurns();assert.equal((await f.run()).merged,true);assert.equal(f.task().architectureCompliance.status,'PASS');
 }finally{f.close();}
});
test('final merged tree is rechecked and rolled back if concurrent main introduces a boundary violation',async()=>{
 let reached,release,paused=false;const waiting=new Promise(r=>reached=r),gate=new Promise(r=>release=r);
 const f=await fixture([{path:'frontend/style.css',content:'p { color: red; }\n'}],{reviewRequired:false,onWorker:async()=>{if(!paused){paused=true;reached();await gate;}}});
 try{const running=f.run(),rejected=assert.rejects(running,/Architecture BLOCKED/);await waiting;
  fs.writeFileSync(path.join(f.root,'frontend/main.mjs'),"import {data} from '../backend/service.mjs';\n");await must('git',['add','frontend/main.mjs'],{cwd:f.root});await must('git',['commit','-m','concurrent main change'],{cwd:f.root});const mainSha=(await must('git',['rev-parse','HEAD'],{cwd:f.root})).stdout.trim();
  release();await rejected;assert.equal((await must('git',['rev-parse','HEAD'],{cwd:f.root})).stdout.trim(),mainSha);assert.equal(f.task().rollback.ok,true);assert.equal(fs.existsSync(path.join(f.root,'frontend/style.css')),false);assert.equal(f.task().architectureCompliance.stage,'merge-candidate');assert.equal(f.task().rollback.discardedMergeSha,null);
 }finally{release();f.close();}
});
test('mini-SWE shell engine reaches the same critical guard; unsupported task engine fails closed',async()=>{
 const f=await fixture([],{reviewRequired:false}),bin=path.join(runtime.root,'mini-bin'),oldPath=process.env.PATH;
 fs.mkdirSync(bin,{recursive:true});fs.writeFileSync(path.join(bin,'mini'),'#!/bin/sh\nprintf "{}\\n" > api/openapi.json\n');fs.chmodSync(path.join(bin,'mini'),0o755);process.env.PATH=bin+path.delimiter+oldPath;
 try{projects.updateProjectSettings(f.id,{allowUnsafeExternal:true});await assert.rejects(projects.runTask(f.id,'T1',undefined,undefined,'opencode'),/chưa hỗ trợ/);await assert.rejects(projects.runTask(f.id,'T1',undefined,undefined,'mini-swe-agent'),/Architecture BLOCKED/);assert.equal(f.task().engineId,'mini-swe-agent');assert.equal(fs.readFileSync(path.join(f.root,'api/openapi.json'),'utf8'),api);
 }finally{process.env.PATH=oldPath;f.close();}
});
test('policy rejects unknown module references and unsafe paths; semantic certainty is never fabricated',()=>{
 const p=proposal();assert.deepEqual(normalizePolicy(p.compliancePolicy,p.components),p.compliancePolicy);
 for(const mutate of [x=>x.modules[0].paths=['../escape/'],x=>x.modules[0].allowedImports=['unknown'],x=>x.protectedFiles[0].sha256='invented']){const policy=structuredClone(p.compliancePolicy);mutate(policy);assert.throws(()=>normalizePolicy(policy,p.components));}
});

test('potential duplicate functionality and unnecessary module produce honest WARNING with semantic limitations',async()=>{
 const text='/* Existing stylesheet to reuse rather than duplicate across modules. */\nbody { color: navy; background: white; }\n';
 const f=await fixture([{path:'frontend/copy.css',content:text},{path:'frontend/extra.mjs',content:'const placeholder = 1;\n'}],{reviewRequired:false});
 try{fs.writeFileSync(path.join(f.root,'frontend/original.css'),text);assert.equal((await f.run()).merged,true);
  const coding=f.task().executionRuns[0].architectureReceipts.find(r=>r.stage==='coding');assert.equal(coding.status,'WARNING');for(const code of ['POTENTIAL_DUPLICATE','NEW_MODULE_REVIEW','SEMANTIC_REVIEW_REQUIRED'])assert.ok(coding.findings.some(f=>f.code===code));assert.ok(coding.limitations.length);
 }finally{f.close();}
});
test('text-only approved architecture cannot silently admit executable source without a PO-approved machine policy',async()=>{
 const f=await fixture([{path:'frontend/new.mjs',content:'const x = 1;\n'}],{reviewRequired:false});
 try{const next=proposal();delete next.compliancePolicy;f.setProposal(next);await projects.proposeArchitecture(f.id);const a=f.get().architectures.at(-1);projects.confirmCouncilArchitecture(f.id,{architectureId:a.id,contentHash:a.contentHash,explicitApproval:true});projects.bindTaskArchitecture(f.id,'T1',{explicitApproval:true,architectureId:a.id,contentHash:a.contentHash});await assert.rejects(f.run(),/Architecture BLOCKED/);assert.ok(f.task().architectureCompliance.findings.some(f=>f.code==='MISSING_MACHINE_POLICY'));
 }finally{f.close();}
});
test('oversized scan fails closed instead of treating a truncated change as PASS',async()=>{
 const f=await fixture([{path:'frontend/huge.txt',content:'x'.repeat(180001)}],{reviewRequired:false});try{await assert.rejects(f.run(),/Architecture BLOCKED/);assert.equal(f.task().architectureCompliance.evidence,'scan-incomplete');assert.equal(fs.existsSync(path.join(f.root,'frontend/huge.txt')),false);}finally{f.close();}
});
test('public re-export removal and opaque class API changes fail closed',async()=>{
 for(const [oldText,nextText,code] of [
  ['export * from "./shared.mjs";\n','const internal = 1;\n','BREAKING_PUBLIC_SURFACE'],
  ['export class Service {\n  read() { return 1; }\n}\n','export class Service {\n  write() { return 1; }\n}\n','OPAQUE_PUBLIC_SURFACE']
 ]){
  const f=await fixture([{path:'frontend/view.mjs',content:nextText}],{reviewRequired:false});
  try{fs.writeFileSync(path.join(f.root,'frontend/view.mjs'),oldText);fs.writeFileSync(path.join(f.root,'frontend/shared.mjs'),'export const value = 1;\n');await assert.rejects(f.run(),/Architecture BLOCKED/);assert.ok(f.task().architectureCompliance.findings.some(f=>f.code===code));}finally{f.close();}
 }
});
