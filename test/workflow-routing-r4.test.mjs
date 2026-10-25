import test,{after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
const rt=isolatedRuntime('workflow-r4');after(()=>rt.cleanup());
const {DATA_DIR,readJson,writeJson}=await rt.import('src/lib/store.mjs');
const {unlockVault,lockVault,saveConnection}=await rt.import('src/lib/vault.mjs');
const {recordModels}=await rt.import('src/lib/model-bindings.mjs');
const {ask}=await rt.import('src/lib/providers.mjs');
const {dispatchEvents,dispatchStatus,classifyProviderFailure,dispatchCandidates,routingPolicy}=await rt.import('src/lib/ai-dispatch.mjs');
const {createProject,updateProjectModelRoles,updateProjectSettings,getProject,founderChat,runTask,runReadyBatch,acceptProjectWork,confirmCouncilSpecification}=await rt.import('src/lib/projects.mjs');
const {prepareTaskPlan,fixtureBrief,memberResponse,chairResponse}=await rt.import('test/helpers/council-fixtures.mjs');
const {workspaceDir}=await rt.import('src/lib/workspace.mjs');
const servers=[];
after(()=>servers.forEach(x=>{x.closeAllConnections();x.close();}));
beforeEach(()=>{lockVault();fs.rmSync(DATA_DIR,{recursive:true,force:true});fs.mkdirSync(DATA_DIR,{recursive:true});unlockVault('R4-fixture-password-not-a-user-secret');});
async function endpoint(responder){
 const calls=[];const server=http.createServer(async(req,res)=>{
  let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw||'{}');
  const q={body,model:body.model,system:body.instructions||body.messages?.find(x=>x.role==='system')?.content||'',prompt:body.input||body.messages?.filter(x=>x.role!=='system').map(x=>x.content).join('\n')||'',path:req.url};calls.push(q);
  try{const r=await responder(q,calls.length);if(res.destroyed)return;
   res.setHeader('content-type','application/json');
   if(r?.status){res.writeHead(r.status,r.headers||{});res.end(JSON.stringify(r.body||{error:{message:'fixture error'}}));return;}
   const text=typeof r==='string'?r:JSON.stringify(r);
   res.end(JSON.stringify(req.url.includes('/chat/')?{choices:[{message:{content:text}}]}:{output_text:text}));
  }catch(e){if(!res.destroyed){res.writeHead(500);res.end(JSON.stringify({error:{message:e.message}}));}}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));servers.push(server);
 return {calls,url:`http://127.0.0.1:${server.address().port}`};
}
function conn(endpoint,name,kind='openai',model='model-'+name){const c=saveConnection({name,kind,model,secret:'R4-local-fixture-'+name+'-key',baseUrl:endpoint.url});recordModels(c,[model]);return c;}
const bind=c=>({connectionId:c.id,model:c.model});
function project(a,b=null){const p=createProject({name:'R4 fixture',idea:'Create a local static page.'});updateProjectModelRoles(p.id,{founder:bind(a),worker:bind(a),council:[bind(a)],reviewer:bind(b||a),backups:b?{founder:bind(b),worker:bind(b)}:{}});return p;}
const opts=(p,extra={})=>({system:'TEXT ONLY: fixture task',prompt:'Task A; preserve context 42.',usageContext:{projectId:p.id,role:'founder'},...extra});
for(const status of [401,403,408,429,500,503])test(`R4 HTTP ${status} switches to different provider kind with its own catalog model`,async()=>{
 const ea=await endpoint(()=>({status})),eb=await endpoint(()=>'B finished task A');
 const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible','vendor-b-text'),p=project(a,b),served={};
 assert.equal(await ask(bind(a),opts(p,{served})),'B finished task A');
 assert.equal(ea.calls.length,1);assert.equal(eb.calls.length,1);assert.equal(eb.calls[0].model,'vendor-b-text');
 assert.equal(ea.calls[0].prompt,eb.calls[0].prompt);assert.equal(ea.calls[0].system,eb.calls[0].system);
 assert.equal(served.connectionId,b.id);assert.equal(served.attempts,2);
 assert.equal(dispatchStatus().active.length,0);assert.ok(dispatchEvents().some(e=>e.type==='handoff'&&e.fromId===a.id&&e.connectionId===b.id));
});
test('R4 connection reset/refusal, text-only mismatch and unknown failures are categorized conservatively',()=>{
 assert.equal(classifyProviderFailure({code:'PROVIDER_TEXT_ONLY',message:'tools requested'}).retryable,true);
 assert.equal(classifyProviderFailure({code:'PROVIDER_UNAVAILABLE',message:'may be quota or cli'}).reason,'unavailable');
 assert.equal(classifyProviderFailure({code:'ECONNRESET'}).retryable,true);
 assert.equal(classifyProviderFailure({code:'PROVIDER_REFUSAL',status:429}).retryable,false);
 assert.equal(classifyProviderFailure({message:'unknown application bug'}).retryable,false);
});
test('R4 provider timeout is aborted and B can answer without an indefinite wait',async()=>{
 const ea=await endpoint(async()=>{await new Promise(r=>setTimeout(r,500));return 'late A';}),eb=await endpoint(()=>'B');const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),p=project(a,b);
 const start=Date.now();assert.equal(await ask(bind(a),opts(p,{routing:{attemptTimeoutMs:80}})),'B');assert.ok(Date.now()-start<1500);assert.ok(dispatchEvents().some(e=>e.reason==='timeout'));
});
test('R4 empty and invalid JSON output hands off before host tools execute',async()=>{
 const ea=await endpoint(()=>'{broken'),eb=await endpoint(()=>({tool:'done',summary:'valid'}));const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),p=project(a,b);
 const text=await ask(bind(a),opts(p,{validate:t=>{const x=JSON.parse(t);return x.tool==='done';}}));assert.equal(JSON.parse(text).tool,'done');assert.ok(dispatchEvents().some(e=>e.reason==='invalid-output'));
});
test('R4 all candidates failing stops at the budget, preserves input and never reports completed',async()=>{
 const e=await endpoint(()=>({status:503})),a=conn(e,'A'),b=conn(e,'B','openai_compatible'),c=conn(e,'C','openai_compatible'),p=project(a,b);
 await assert.rejects(()=>ask(bind(a),opts(p,{routing:{maxAttempts:2}})),e=>e.code==='AI_DISPATCH_EXHAUSTED'&&e.attempts===2);
 assert.equal(e.calls.length,2);assert.ok(!dispatchEvents().some(x=>x.type==='completed'));assert.equal(dispatchStatus().active.length,0);
 const raw=JSON.stringify(readJson('ai-dispatch.json',{}));assert.ok(!raw.includes('preserve context 42'));assert.ok(!raw.includes('R4-local-fixture'));assert.ok(c.id);
});
test('R4 cooling primary is skipped on subsequent requests; secondary receives same new prompt',async()=>{
 const ea=await endpoint(()=>({status:503})),eb=await endpoint(()=>'B');const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),p=project(a,b);
 await ask(bind(a),opts(p));await ask(bind(a),opts(p,{prompt:'Next task, still no replay'}));
 assert.equal(ea.calls.length,1);assert.equal(eb.calls.length,2);assert.equal(eb.calls[1].prompt,'Next task, still no replay');assert.ok(dispatchEvents().some(e=>e.type==='skipped'));
});
test('R4 policy refusal cannot be evaded by changing provider',async()=>{
 const ea=await endpoint(()=>({status:400,body:{error:{code:'content_policy_violation'}}})),eb=await endpoint(()=>'not called');const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),p=project(a,b);
 await assert.rejects(()=>ask(bind(a),opts(p)),e=>e.code==='PROVIDER_REFUSAL');assert.equal(eb.calls.length,0);
});
test('R4 explicit cancellation never hands off to another account',async()=>{
 const ea=await endpoint(()=> 'not called'),eb=await endpoint(()=> 'not called');const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),p=project(a,b),controller=new AbortController();controller.abort();
 await assert.rejects(()=>ask(bind(a),opts(p,{signal:controller.signal})),e=>e.code==='AI_CANCELLED');assert.equal(ea.calls.length+eb.calls.length,0);
});
test('R4 disabling automatic failover calls only the selected account',async()=>{
 const ea=await endpoint(()=>({status:503})),eb=await endpoint(()=> 'not called');const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),p=project(a,b);updateProjectSettings(p.id,{autoFailover:false});
 await assert.rejects(()=>ask(bind(a),opts(p)));assert.equal(ea.calls.length,1);assert.equal(eb.calls.length,0);
});
test('R4 project-only routing cannot use an unrelated connected account',async()=>{
 const e=await endpoint(()=>({status:503})),a=conn(e,'A'),b=conn(e,'B','openai_compatible'),p=project(a);updateProjectSettings(p.id,{failoverScope:'project'});
 await assert.rejects(()=>ask(bind(a),opts(p)),e=>e.code==='AI_DISPATCH_EXHAUSTED');assert.equal(e.calls.length,1);assert.ok(b.id);
});
test('R4 a failed chat can be retried using the same message id without duplicating the logical job',async()=>{
 let failing=true;const ea=await endpoint(()=>failing?{status:503}:'Recovered'),a=conn(ea,'A'),p=project(a);
 await assert.rejects(()=>founderChat(p.id,null,'Shared task'));let current=getProject(p.id);assert.equal(current.messages.length,1);assert.equal(current.messages[0].status,'failed');
 failing=false;writeJson('ai-dispatch.json',{version:1,circuits:{},events:[]});
 await founderChat(p.id,null,'Shared task',{retryMessageId:current.messages[0].id});current=getProject(p.id);assert.equal(current.messages.length,2);assert.equal(current.messages[0].status,'sent');assert.equal(current.messages[1].content,'Recovered');assert.equal(current.briefRevision,1);
});
const task=(id='T1',dependsOn=[])=>({id,title:'Local '+id,role:'frontend',description:'Write '+id.toLowerCase()+'.html',dependsOn,doneWhen:'File exists',status:'todo',engineId:'native',skills:[]});
function workerAnswer(q){const t=JSON.parse(q.prompt.match(/TASK:\n([^\n]+)/)?.[1]||'{"id":"T1"}');return q.prompt.includes('Tool result:')?{tool:'done',summary:'File written'}:{tool:'write',path:t.id.toLowerCase()+'.html',content:`<h1>${t.id}</h1>`};}
function reviewerOrWorker(q){if(q.system.includes('senior reviewer'))return {approved:true,summary:'Fixture reviewed actual diff',risks:[],fixes:[]};return workerAnswer(q);}
test('R4 actual isolated Git task: A writes once, fails, B reads retained history and completes; independent C reviews',async()=>{
 const ea=await endpoint(q=>q.prompt.includes('Tool result:')?{status:503}:workerAnswer(q)),eb=await endpoint(reviewerOrWorker),ec=await endpoint(reviewerOrWorker);
 const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),c=conn(ec,'C'),p=project(a,b);updateProjectModelRoles(p.id,{worker:bind(a),reviewer:bind(c),founder:bind(a),council:[bind(a)],backups:{worker:bind(b)}});prepareTaskPlan(p.id,[task()]);
 const r=await runTask(p.id,'T1');assert.equal(r.merged,true);const t=getProject(p.id).tasks[0];
 assert.equal(t.workerBinding.connectionId,a.id);assert.equal(t.servedWorkerBinding.connectionId,b.id);assert.equal(t.servedReviewerBinding.connectionId,c.id);
 assert.ok(eb.calls[0].prompt.includes('Tool result:'));assert.ok(eb.calls[0].prompt.includes('t1.html'));assert.equal(t.agentLog.filter(e=>e.kind==='tool'&&e.tool==='write').length,1);
 assert.equal(fs.readFileSync(path.join(workspaceDir(p.id),'t1.html'),'utf8'),'<h1>T1</h1>');assert.equal(t.status,'done');assert.equal(t.review.approved,true);
});
test('R4 dependency-wave batch starts T2 after T1 completes, without a second click',async()=>{
 const e=await endpoint(reviewerOrWorker),a=conn(e,'A'),b=conn(e,'B','openai_compatible'),p=project(a,b);prepareTaskPlan(p.id,[task('T1'),task('T2',['T1'])]);
 const r=await runReadyBatch(p.id,{autoContinue:true});assert.equal(r.ok,true);assert.deepEqual(r.runs.map(x=>x.taskId),['T1','T2']);assert.equal(r.pending.length,0);
});
test('R4 true intake runs Founder and Council, then holds for user specification approval; after approval it executes tasks',async()=>{
 const e=await endpoint(q=>q.system.includes('IDEA_BRIEF_V1')?fixtureBrief:q.system.includes('COUNCIL_MEMBER_V1')?memberResponse():q.system.includes('COUNCIL_CHAIR_V1')?chairResponse():q.system.includes('AI Project Manager')?{tasks:[{title:'One useful page',role:'frontend',description:'Make t1.html',dependsOn:[],doneWhen:'File exists'}]}:reviewerOrWorker(q));
 const a=conn(e,'A'),b=conn(e,'B','openai_compatible'),p=project(a,b);
 let r=await acceptProjectWork(p.id);assert.equal(r.stage,'awaiting-spec-approval');assert.equal(getProject(p.id).tasks.length,0);const n=e.calls.length;await acceptProjectWork(p.id);assert.equal(e.calls.length,n);
 confirmCouncilSpecification(p.id,r.specificationId);r=await acceptProjectWork(p.id);assert.equal(r.stage,'tasks');assert.equal(r.ok,true);assert.equal(getProject(p.id).tasks[0].status,'done');
});

test('R4 repeated project calls after primary HTTP401 preserve its catalog for routing, never claim it verified, and continue on B',async()=>{
 const ea=await endpoint(()=>({status:401})),eb=await endpoint(()=>'B still available');
 const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),p=project(a,b);
 const {modelAvailability,verifiedBinding}=await rt.import('src/lib/model-bindings.mjs');
 const {roleRef}=await rt.import('src/lib/model-bindings.mjs');
 assert.equal(await ask(roleRef(p.id,'founder'),{prompt:'first'}),'B still available');
 assert.equal(modelAvailability(a.id).status,'unverified');assert.equal(modelAvailability(a.id).runtimeIssue.status,401);
 assert.equal(verifiedBinding(bind(a)).connectionId,a.id,'known catalog resolves only to select a healthy alternative');
 assert.equal(await ask(roleRef(p.id,'founder'),{prompt:'second'}),'B still available');
 assert.equal(ea.calls.length,1);assert.equal(eb.calls.length,2);assert.equal(eb.calls[1].prompt,'second');
});

test('R4 original provider HTTP401 cannot prevent later planning, worker and reviewer stages from using valid backups',async()=>{
 const ea=await endpoint(()=>({status:401}));
 const eb=await endpoint(q=>q.system.includes('IDEA_BRIEF_V1')?fixtureBrief:q.system.includes('COUNCIL_MEMBER_V1')?memberResponse():q.system.includes('COUNCIL_CHAIR_V1')?chairResponse():q.system.includes('AI Project Manager')?{tasks:[{title:'Local page',role:'frontend',description:'Make t1.html',dependsOn:[],doneWhen:'File exists'}]}:reviewerOrWorker(q));
 const ec=await endpoint(reviewerOrWorker);
 const a=conn(ea,'A'),b=conn(eb,'B','openai_compatible'),c=conn(ec,'C'),p=project(a,b);
 updateProjectModelRoles(p.id,{founder:bind(a),worker:bind(a),reviewer:bind(c),council:[bind(a)],backups:{founder:bind(b),worker:bind(b),council:[bind(b)]}});
 let r=await acceptProjectWork(p.id);assert.equal(r.stage,'awaiting-spec-approval');
 confirmCouncilSpecification(p.id,r.specificationId);r=await acceptProjectWork(p.id);
 assert.equal(r.ok,true);assert.equal(getProject(p.id).tasks[0].servedWorkerBinding.connectionId,b.id);assert.equal(ea.calls.length,1);
});

test('R4 implicit reviewer failover excludes every model on the worker account; explicit original reviewer remains an owner choice',async()=>{
 const e=await endpoint(()=> 'fixture'),a=conn(e,'Worker'),b=conn(e,'Reviewer'),c=conn(e,'Independent','openai_compatible'),p=project(a,b);
 updateProjectModelRoles(p.id,{founder:bind(a),worker:bind(a),reviewer:bind(b),council:[bind(c)],backups:{reviewer:bind(a)}});
 const policy=routingPolicy({projectId:p.id,role:'reviewer'});
 const primary=(await rt.import('src/lib/vault.mjs')).getConnection(b.id);
 const candidates=dispatchCandidates(primary,policy,{excludeConnectionIds:[a.id]});
 assert.ok(candidates.some(x=>x.id===c.id));assert.ok(!candidates.some(x=>x.id===a.id));
});
