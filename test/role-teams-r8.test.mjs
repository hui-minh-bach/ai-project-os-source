/** R8 real persistence, routing and Git with isolated model fixtures, no cloud. */
import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
const r=isolatedRuntime('role-teams-r8');after(()=>r.cleanup());
const {unlockVault,lockVault,saveConnection,getConnection}=await r.import('src/lib/vault.mjs');
const {recordModels,roleBindings,roleRef,resolveBinding}=await r.import('src/lib/model-bindings.mjs');
const {createProject,getProject,projectModelRoles,updateProjectModelRoles,updateProjectSettings,runReadyBatch,runTask}=await r.import('src/lib/projects.mjs');
const {prepareTaskPlan}=await r.import('test/helpers/council-fixtures.mjs');
const {workspaceDir}=await r.import('src/lib/workspace.mjs');
const {ensureProjectTeam}=await r.import('src/lib/project-team.mjs');
function setup(){unlockVault('isolated-r8-team-password');const bindings=[];for(const id of ['alpha','beta','review']){const c=saveConnection({id,kind:'openai',name:'Test '+id,secret:'fixture-'+id,model:id+'-1',baseUrl:'http://127.0.0.1:1'});recordModels(getConnection(c.id),[id+'-1',id+'-2']);bindings.push({connectionId:c.id,model:id+'-1'});}return bindings;}
function project(){return createProject({name:'R8 isolated multi-member team'});}
const task=id=>({id,title:'Independent '+id,role:'frontend',description:'Write '+id.toLowerCase()+'.html',dependsOn:[],doneWhen:'File exists and tests pass',status:'todo',engineId:'native',skills:[]});
test('R8 saves ordered members, deduplicates, reloads descriptors and resolves every role index',()=>{
 const [a,b,c]=setup(),p=project();updateProjectModelRoles(p.id,{teams:{founder:[a,b],council:[a,c],worker:[a,b,a],reviewer:[c]}});
 const j=projectModelRoles(p.id);assert.equal(j.teams.worker.length,2);assert.equal(j.teams.founder.length,2);assert.equal(j.roles.worker.connectionId,a.connectionId);assert.equal(j.roles.council.length,2);
 assert.equal(roleBindings(getProject(p.id),'worker')[1].connectionId,b.connectionId);assert.equal(resolveBinding(roleRef(p.id,'worker',1)).connectionId,b.connectionId);
 assert.ok(j.descriptors.worker.length===2);assert.throws(()=>resolveBinding(roleRef(p.id,'worker',99)));
});
test('R8 partial and old primary saves retain other team members; explicit remove is honored',()=>{
 const [a,b,c]=setup(),p=project();updateProjectModelRoles(p.id,{teams:{founder:[a,b],worker:[a,b],reviewer:[c]},backups:{worker:c}});
 updateProjectModelRoles(p.id,{worker:a});let j=projectModelRoles(p.id);assert.equal(j.teams.worker.length,2);assert.equal(j.teams.founder.length,2);assert.equal(j.teams.reviewer.length,1);assert.deepEqual(j.backups.worker,c);
 updateProjectModelRoles(p.id,{teams:{worker:[b]}});j=projectModelRoles(p.id);assert.deepEqual(j.teams.worker,[b]);assert.deepEqual(j.roles.worker,b);
 updateProjectModelRoles(p.id,{teams:{worker:[]}});assert.deepEqual(projectModelRoles(p.id).teams.worker,[]);assert.equal(projectModelRoles(p.id).roles.worker,null);
});
test('R8 optimistic revision rejects stale role replacement without changing stored members',()=>{
 const [a,b,c]=setup(),p=project();updateProjectModelRoles(p.id,{teams:{worker:[a,b],reviewer:[c]}});const before=projectModelRoles(p.id);updateProjectModelRoles(p.id,{expectedRevision:before.revision,teams:{founder:[a]}});
 assert.throws(()=>updateProjectModelRoles(p.id,{expectedRevision:before.revision,teams:{worker:[b]}}),e=>e.code==='TEAM_STALE');assert.deepEqual(projectModelRoles(p.id).teams.worker,[a,b]);
});
test('R8 invalid/oversized/unavailable groups fail atomically',()=>{
 const [a,b,c]=setup(),p=project();updateProjectModelRoles(p.id,{teams:{worker:[a,b],reviewer:[c]}});const before=JSON.stringify(projectModelRoles(p.id));
 for(const input of [{teams:[]},{teams:{worker:'alpha'}},{teams:{worker:Array(17).fill(a)}},{teams:{worker:[{connectionId:a.connectionId,model:'not-in-catalog'}]}}])assert.throws(()=>updateProjectModelRoles(p.id,input));assert.equal(JSON.stringify(projectModelRoles(p.id)),before);
});
test('R8 ensure-team preserves groups and allows independent models of one account',()=>{
 const [a,b]=setup(),p=project();const review={connectionId:a.connectionId,model:'alpha-2'};updateProjectModelRoles(p.id,{teams:{founder:[a,b],council:[a,b],worker:[a,b],reviewer:[review]}});
 ensureProjectTeam(p.id);assert.deepEqual(projectModelRoles(p.id).teams.worker,[a,b]);assert.deepEqual(projectModelRoles(p.id).teams.reviewer,[review]);
});
test('R8 every selected Worker needs a distinct review option before automatic production',()=>{
 const [a,b]=setup(),p=project();updateProjectModelRoles(p.id,{teams:{worker:[a,b],reviewer:[b]}});assert.throws(()=>ensureProjectTeam(p.id),e=>e.code==='TEAM_REVIEWER');
 updateProjectModelRoles(p.id,{teams:{reviewer:[a,b]}});assert.doesNotThrow(()=>ensureProjectTeam(p.id));
});
test('R8 identical Worker/Reviewer binding is rejected before any worktree runs',async()=>{
 const [a]=setup(),p=project();updateProjectModelRoles(p.id,{teams:{worker:[a],reviewer:[a]}});prepareTaskPlan(p.id,[task('T1')]);
 await assert.rejects(runTask(p.id,'T1'),e=>e.code==='TEAM_MEMBER_UNAVAILABLE');assert.notEqual(getProject(p.id).tasks[0].status,'running');
});
test('R8 two independent tasks run on two chosen Worker accounts, C reviews, real tests/Git merge',{timeout:60000},async()=>{
 const [a,b,c]=setup();const requests=[];let waiting=0,release,arrived;const hold=new Promise(r=>release=r),both=new Promise(r=>arrived=r);
 const server=http.createServer(async(req,res)=>{try{let raw='';for await(const chunk of req)raw+=chunk;const q=JSON.parse(raw);const system=q.instructions||'',prompt=q.input||'';requests.push({model:q.model,system,prompt});let output;
 if(system.includes('coding worker')){if(!prompt.includes('Tool result:')){if(++waiting===2)arrived();await hold;const m=prompt.match(/TASK:\n([^\n]+)/),t=JSON.parse(m[1]);output={tool:'write',path:t.id.toLowerCase()+'.html',content:'<h1>'+t.id+'</h1>'};}else output={tool:'done',summary:'Wrote a fixture file.'};}
 else output={approved:true,summary:'Separate synthetic review',risks:[],fixes:[]};res.setHeader('Content-Type','application/json');res.end(JSON.stringify({output_text:JSON.stringify(output)}));}catch(e){res.statusCode=500;res.end(e.message);}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 try{for(const v of [a,b,c]){saveConnection({...getConnection(v.connectionId),baseUrl:'http://127.0.0.1:'+server.address().port});recordModels(getConnection(v.connectionId),[v.model]);}
 const p=project();updateProjectModelRoles(p.id,{teams:{worker:[a,b],reviewer:[c]}});updateProjectSettings(p.id,{sandboxMode:'host',maxParallel:2,failoverScope:'project'});prepareTaskPlan(p.id,[task('T1'),task('T2')]);
 const dir=workspaceDir(p.id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({private:true,scripts:{test:'node --test validation.test.cjs'}}));fs.writeFileSync(path.join(dir,'validation.test.cjs'),"const t=require('node:test'),a=require('node:assert/strict'),fs=require('fs');t('one implemented task exists',()=>a.ok(['t1.html','t2.html'].some(f=>fs.existsSync(f)&&fs.readFileSync(f,'utf8').includes('<h1>'))));");
 const batch=runReadyBatch(p.id,{limit:2});await Promise.race([both,new Promise((_,rej)=>setTimeout(()=>rej(Error('two workers not reached')),10000).unref())]);
 const active=getProject(p.id).tasks.filter(x=>['running','preparing'].includes(x.status));assert.equal(active.length,2);assert.equal(new Set(active.map(x=>x.workerBinding.connectionId)).size,2);release();const result=await batch;assert.equal(result.ok,true,JSON.stringify(result));
 const tasks=getProject(p.id).tasks;assert.equal(tasks.filter(x=>x.status==='done').length,2);assert.equal(new Set(tasks.map(x=>x.servedWorkerBinding.connectionId)).size,2);for(const t of tasks){assert.equal(t.servedReviewerBinding.connectionId,c.connectionId);assert.equal(t.latestTestReceipt.status,'PASS');assert.ok(fs.existsSync(path.join(dir,t.id.toLowerCase()+'.html')));assert.ok(t.mergeSha);}
 assert.ok(requests.filter(x=>x.system.includes('senior reviewer')).every(x=>x.model===c.model));
 }finally{release();server.closeAllConnections();await new Promise(done=>server.close(done));lockVault();}
});
