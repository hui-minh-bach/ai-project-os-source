import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {architectureFixture} from './helpers/architecture-fixtures.mjs';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
const runtime=isolatedRuntime('prd-agent');after(()=>runtime.cleanup());
const {DATA_DIR,readJson,writeJson}=await runtime.import('src/lib/store.mjs');
const {unlockVault,lockVault,saveConnection}=await runtime.import('src/lib/vault.mjs');
const {recordModels}=await runtime.import('src/lib/model-bindings.mjs');
const {createProject,getProject,updateProjectModelRoles,buildPlan,runTask,proposeArchitecture,confirmCouncilArchitecture}=await runtime.import('src/lib/projects.mjs');
const {currentApprovedPrd}=await runtime.import('src/lib/project-prd.mjs');
const {prepareApprovedSpecification,prepareTaskPlan}=await runtime.import('test/helpers/council-fixtures.mjs');
const {workspaceDir}=await runtime.import('src/lib/workspace.mjs');
function reset(){lockVault();for(const x of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak','model-registry.json','model-registry.json.bak'])fs.rmSync(path.join(DATA_DIR,x),{force:true});for(const x of ['workspaces','task-worktrees','trajectories'])fs.rmSync(path.join(DATA_DIR,x),{recursive:true,force:true});}
async function mockProvider(callback){const requests=[],server=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw||'{}');const info={system:String(body.instructions||''),prompt:String(body.input||'')};requests.push(info);let answer=await callback(info);res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:JSON.stringify(answer)}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {requests,url:`http://127.0.0.1:${server.address().port}`,close(){server.closeAllConnections();server.close();}};}
function connection(url){unlockVault('prd-agent-contract-password');const c=saveConnection({kind:'openai',name:'PRD mock',model:'fixture',secret:'fixture-only-key-12345',baseUrl:url});recordModels(c,['fixture']);return c;}
function roles(id,c){updateProjectModelRoles(id,{founder:{connectionId:c.id,model:'fixture'},council:[{connectionId:c.id,model:'fixture'}],worker:{connectionId:c.id,model:'fixture'},reviewer:{connectionId:c.id,model:'fixture'}});}

test('PM, Worker and Reviewer receive the same approved PRD and Architecture version/hash, recorded on the run',{timeout:30000},async()=>{
 reset();const mock=await mockProvider(({system,prompt})=>{
  if(system.includes('ARCHITECTURE_LITE_V1'))return architectureFixture;
  if(system.includes('AI Project Manager'))return {tasks:[{title:'Build T1',role:'frontend',description:'Create t1.html',dependsOn:[],doneWhen:'Page has title'}]};
  if(system.includes('coding worker'))return prompt.includes('Tool result:')?{tool:'done',summary:'Completed'}:{tool:'write',path:'t1.html',content:'<h1>Done</h1>'};
  if(system.includes('senior reviewer'))return {approved:true,summary:'Reviewed',risks:[],fixes:[]};
  return 'OK';
 });
 try{
  const c=connection(mock.url),p=createProject({name:'PRD to agent'});prepareApprovedSpecification(p.id,{}, {architecture:false});roles(p.id,c);
  await proposeArchitecture(p.id);const proposed=getProject(p.id).architectures[0];confirmCouncilArchitecture(p.id,{architectureId:proposed.id,contentHash:proposed.contentHash,explicitApproval:true});
  const prd=currentApprovedPrd(getProject(p.id));const tasks=await buildPlan(p.id,c.id);assert.equal(tasks.length,1);
  const result=await runTask(p.id,'T1',c.id,c.id);assert.equal(result.merged,true);
  const run=getProject(p.id).tasks[0].executionRuns[0];assert.equal(run.architectureHash,proposed.contentHash);assert.equal(run.requirementsVersion,prd.version);assert.equal(run.requirementsHash,prd.contentHash);
  for(const item of mock.requests.filter(x=>x.system.includes('AI Project Manager')||x.system.includes('coding worker')||x.system.includes('senior reviewer'))) {
   assert.match(item.prompt,/ARCHITECTURE v1/);assert.ok(item.prompt.includes(proposed.contentHash));assert.match(item.prompt,/PRD v1/);assert.ok(item.prompt.includes(prd.contentHash));
  }
  assert.equal(fs.existsSync(path.join(workspaceDir(p.id),'projects.json')),false,'official document stays outside agent worktree');
 }finally{mock.close();}
});

test('modifying approved requirements while a Worker is paused prevents merge',{timeout:30000},async()=>{
 reset();let release,reached;const gate=new Promise(r=>release=r),arrival=new Promise(r=>reached=r);let waiting=false;
 const mock=await mockProvider(async({system,prompt})=>{
  if(system.includes('coding worker')){if(!waiting){waiting=true;reached();await gate;}return {tool:'write',path:'t1.html',content:'<h1>Unsafe</h1>'};}
  if(system.includes('senior reviewer'))return {approved:true,summary:'Fine',risks:[],fixes:[]};
  return 'OK';
 });
 try{
  const c=connection(mock.url),p=createProject({name:'Stale PRD'});prepareTaskPlan(p.id,[{id:'T1',title:'Task',role:'frontend',description:'Create t1.html',dependsOn:[],doneWhen:'Done',status:'todo',engineId:'native',skills:[]}]);roles(p.id,c);
  const running=runTask(p.id,'T1',c.id,c.id);await arrival;
  const projects=readJson('projects.json',[]);projects.find(x=>x.id===p.id).specifications[0].specification.goals[0]='Changed after PO approval';writeJson('projects.json',projects);
  release();await assert.rejects(running,/PRD|Specification|Council|đổi|khác/i);
  assert.equal(fs.existsSync(path.join(workspaceDir(p.id),'t1.html')),false);
 }finally{release?.();mock.close();}
});
