import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
import {architectureFixture} from './helpers/architecture-fixtures.mjs';
const runtime=isolatedRuntime('architecture');after(()=>runtime.cleanup());
const {createProject,getProject,proposeArchitecture,confirmCouncilArchitecture,confirmCouncilSpecification,updateProjectBrief,buildPlan,runTask,updateProjectModelRoles}=await runtime.import('src/lib/projects.mjs');
const {readJson,writeJson}=await runtime.import('src/lib/store.mjs');
const {prepareApprovedSpecification}=await runtime.import('test/helpers/council-fixtures.mjs');
const {architectureHistory,approvedArchitecture,normalizeArchitecture,architectureMarkdown,architectureContext}=await runtime.import('src/lib/project-architecture.mjs');
const {unlockVault,saveConnection,lockVault}=await runtime.import('src/lib/vault.mjs');
const {recordModels}=await runtime.import('src/lib/model-bindings.mjs');
const edit=(id,fn)=>{const all=readJson('projects.json',[]);fn(all.find(p=>p.id===id));writeJson('projects.json',all);};

test('Architecture Lite validates graph, versions AI proposals, requires explicit PO Council approval and preserves history',async()=>{
 unlockVault('architecture-test-password');let requests=[],intercept=async()=>{};
 const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;requests.push(JSON.parse(raw));await intercept();res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(architectureFixture)}}]}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const c=saveConnection({kind:'openai_compatible',name:'Architecture fixture',model:'test-model',secret:'fixture-only',baseUrl:`http://127.0.0.1:${server.address().port}/v1`});recordModels(c,['test-model']);
  const p=createProject({name:'Architecture test'});assert.equal(getProject(p.id).architectureRequired,true);prepareApprovedSpecification(p.id,{}, {architecture:false});edit(p.id,p=>p.architectureRequired=true);updateProjectModelRoles(p.id,{founder:{connectionId:c.id,model:'test-model'}});
  assert.throws(()=>approvedArchitecture(getProject(p.id)),/duyệt/);
  await assert.rejects(buildPlan(p.id,c.id),/duyệt Architecture/);
  edit(p.id,p=>p.tasks=[{id:'T1'}]);await assert.rejects(runTask(p.id,'T1',c.id,c.id),/duyệt Architecture/);edit(p.id,p=>p.tasks=[]);assert.equal(requests.length,0);
  edit(p.id,p=>{p.architectureRequired=false;});assert.throws(()=>architectureContext(getProject(p.id)),/duyệt Architecture/);
  await proposeArchitecture(p.id);assert.equal(getProject(p.id).architectureRequired,true);let x=getProject(p.id),a=architectureHistory(x).history[0];
  assert.equal(a.status,'proposed');assert.equal(a.version,1);assert.equal(a.specificationVersion,1);assert.equal(a.displayStatus,'proposed');
  assert.match(requests[0].messages[0].content,/Technical Architect/);assert.match(requests[0].messages[0].content,/system|Architecture|ARCHITECTURE/);
  const approval={architectureId:a.id,contentHash:a.contentHash,explicitApproval:true};
  assert.throws(()=>confirmCouncilArchitecture(p.id,{...approval,explicitApproval:false}),/PO/);
  assert.throws(()=>confirmCouncilArchitecture(p.id,{...approval,contentHash:'wrong'}),/thay đổi/);
  edit(p.id,p=>{p.specifications[0].status='pending';p.approvedSpecificationId=null;});
  assert.throws(()=>confirmCouncilArchitecture(p.id,approval),/chốt specification/);confirmCouncilSpecification(p.id,a.specificationId);
  confirmCouncilArchitecture(p.id,approval);x=getProject(p.id);const baseline=approvedArchitecture(x);
  assert.match(architectureMarkdown(baseline),/# ARCHITECTURE v1/);assert.equal((architectureMarkdown(baseline).match(/^## /gm)||[]).length,8);
  assert.match(architectureContext(x),/KIẾN TRÚC CHÍNH THỨC/);
  await proposeArchitecture(p.id);x=getProject(p.id);assert.equal(architectureHistory(x).history[0].version,2);assert.equal(approvedArchitecture(x).id,a.id);
  assert.throws(()=>confirmCouncilArchitecture(p.id,approval),/hiện hành/);
  const next=architectureHistory(x).history[0];confirmCouncilArchitecture(p.id,{architectureId:next.id,contentHash:next.contentHash,explicitApproval:true});
  assert.equal(architectureHistory(getProject(p.id)).history.filter(a=>a.status==='approved').length,2);
  assert.equal(architectureHistory(getProject(p.id)).history.find(v=>v.id===a.id).displayStatus,'outdated');
  let entered,release;const waiting=new Promise(r=>entered=r),hold=new Promise(r=>release=r);intercept=async()=>{entered();await hold;};
  const staleProposal=proposeArchitecture(p.id);await waiting;await assert.rejects(proposeArchitecture(p.id),/Đang tạo/);
  updateProjectBrief(p.id,{name:'Changed architecture brief'});release();await assert.rejects(staleProposal,/thay đổi/);assert.equal(getProject(p.id).architectures.length,2);x=getProject(p.id);assert.equal(architectureHistory(x).history[0].displayStatus,'outdated');assert.throws(()=>approvedArchitecture(x),/duyệt/);
  edit(p.id,p=>p.architectures[0].proposal.overview='Agent rewrote baseline');assert.throws(()=>architectureHistory(getProject(p.id)),/ngoài luồng/);
 }finally{server.close();lockVault();}
});
test('graph validation rejects dangling edges, duplicate components and omitted trade-offs',()=>{
 assert.deepEqual(normalizeArchitecture(architectureFixture),architectureFixture);
 for(const alter of [b=>b.relationships[0].to='missing',b=>b.components[1].id='user',b=>delete b.stack[0].tradeOff]){const b=structuredClone(architectureFixture);alter(b);assert.throws(()=>normalizeArchitecture(b));}
});
test('first-edition projects without a baseline stay blocked and wait for active work',async()=>{
 const p=createProject({name:'Legacy'});edit(p.id,p=>{delete p.architectureRequired;delete p.architectures;});
 assert.throws(()=>architectureContext(getProject(p.id)),/duyệt Architecture/);assert.equal(architectureHistory(getProject(p.id)).required,true);
 prepareApprovedSpecification(p.id,{}, {architecture:false});edit(p.id,p=>p.tasks=[{id:'T1',status:'running'}]);await assert.rejects(proposeArchitecture(p.id),/task đang chạy/);assert.equal(getProject(p.id).architectureRequired,true);
});
test('a Specification version change invalidates architecture even when requirement text is identical',()=>{
 const p=createProject({name:'Source version binding'});prepareApprovedSpecification(p.id,{}, {architecture:false});
 const x=getProject(p.id),s=x.specifications[0];
 const a={specificationId:s.id,specificationVersion:1,requirementsHash:s.approvedRequirementsHash};
 // Same text, different Specification version must never reuse an approval.
 assert.equal(s.version,1);
 edit(p.id,p=>p.specifications[0].version=2);
 return runtime.import('src/lib/project-architecture.mjs').then(({architectureCurrent})=>assert.equal(architectureCurrent(getProject(p.id),a),false));
});
