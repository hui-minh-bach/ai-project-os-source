import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
import {proposal} from './helpers/architecture-guard-fixtures.mjs';
const runtime=isolatedRuntime('deployment-context');after(()=>runtime.cleanup());
const projects=await runtime.import('src/lib/projects.mjs');
const {unlockVault,saveConnection}=await runtime.import('src/lib/vault.mjs');
const {recordModels}=await runtime.import('src/lib/model-bindings.mjs');
const {prepareApprovedSpecification}=await runtime.import('test/helpers/council-fixtures.mjs');
const {workspaceDir}=await runtime.import('src/lib/workspace.mjs');
test('target context reaches Architect/Worker; material impact during execution blocks merge; stale proposals never approve the wrong target',async()=>{
 unlockVault('deployment-context-fixture');let pauseWorker=false,pauseArchitect=false,entered,release;
 const requests=[],server=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const b=JSON.parse(raw),system=b.instructions||'',prompt=b.input||'';requests.push({system,prompt});let value;
  if(system.includes('ARCHITECTURE_LITE_V1')){if(pauseArchitect){entered();await new Promise(r=>release=r);}value=proposal();}
  else if(system.includes('coding worker')){if(pauseWorker){entered();await new Promise(r=>release=r);}value={tool:'write',path:'frontend/style.css',content:'body { color: navy; }'};}
  else value={approved:true,summary:'Fixture',risks:[],fixes:[]};res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:JSON.stringify(value)}));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const c=saveConnection({kind:'openai',name:'Local context fixture',model:'fixture',secret:'synthetic-only',baseUrl:`http://127.0.0.1:${server.address().port}`});recordModels(c,['fixture']);const p=projects.createProject({name:'Local application',productType:'website',deploymentTarget:'local-only'});prepareApprovedSpecification(p.id,{}, {architecture:false});const binding={connectionId:c.id,model:'fixture'};projects.updateProjectModelRoles(p.id,{founder:binding,worker:binding,reviewer:binding});await projects.proposeArchitecture(p.id);const a=projects.getProject(p.id).architectures[0];assert.equal(a.deploymentTarget,'local-only');assert.equal(JSON.parse(requests[0].prompt).deploymentTarget,'local-only');projects.confirmCouncilArchitecture(p.id,{architectureId:a.id,contentHash:a.contentHash,explicitApproval:true});projects.createTask(p.id,{title:'Scoped local UI',role:'frontend',doneWhen:'Stylesheet is correct'});projects.updateProjectSettings(p.id,{reviewRequired:false});
  pauseWorker=true;const arrived=new Promise(r=>entered=r),running=projects.runTask(p.id,'T1'),rejected=assert.rejects(running,/Architecture đã thay đổi|Deployment Target/);await arrived;assert.match(requests.at(-1).prompt,/Deployment Target hiện tại: local-only/);projects.updateProjectSettings(p.id,{deploymentTarget:'on-premises'});release();await rejected;assert.equal(projects.getProject(p.id).tasks[0].status,'stale');assert.equal(fs.existsSync(path.join(workspaceDir(p.id),'frontend/style.css')),false);
  pauseWorker=false;projects.updateProjectSettings(p.id,{deploymentTarget:'local-only'});pauseArchitect=true;const started=new Promise(r=>entered=r),proposing=projects.proposeArchitecture(p.id),stale=assert.rejects(proposing,/Deployment Target đã thay đổi/);await started;projects.updateProjectSettings(p.id,{deploymentTarget:'cloud-manual'});release();await stale;assert.equal(projects.getProject(p.id).architectures.length,1);assert.equal(projects.getProject(p.id).approvedArchitectureId,a.id);
 }finally{release?.();server.closeAllConnections();server.close();}
});
