import test, { after } from 'node:test';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';
const runtime = isolatedRuntime('team');
after(() => runtime.cleanup());
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
const { DATA_DIR, readJson, writeJson } = await runtime.import('src/lib/store.mjs');
const { lockVault, unlockVault, saveConnection } = await runtime.import('src/lib/vault.mjs');
const { recordModels } = await runtime.import('src/lib/model-bindings.mjs');
const { createProject, getProject, createTask, updateTask, archiveTask, updateProjectSettings, updateProjectModelRoles, updateProjectBrief, buildPlan, runTask, runReadyBatch } = await runtime.import('src/lib/projects.mjs');
const { workspaceDir, safeResolve } = await runtime.import('src/lib/workspace.mjs');
const { runNpm } = await runtime.import('src/lib/sandbox.mjs');
const { runTaskTests } = await runtime.import('src/lib/native-agent.mjs');
const { runExternalTask } = await runtime.import('src/lib/external-agents.mjs');
const { run } = await runtime.import('src/lib/shell.mjs');
const { prepareTaskPlan, prepareApprovedSpecification } = await runtime.import('test/helpers/council-fixtures.mjs');

function reset(){
  lockVault();
  for(const name of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak','model-registry.json','model-registry.json.bak'])fs.rmSync(path.join(DATA_DIR,name),{force:true});
  for(const name of ['workspaces','task-worktrees','trajectories'])fs.rmSync(path.join(DATA_DIR,name),{recursive:true,force:true});
}
const task=(id='T1',extra={})=>({id,title:'Feature '+id,role:'frontend',description:'Create '+id.toLowerCase()+'.html',dependsOn:[],doneWhen:'The file contains a heading',status:'todo',engineId:'native',skills:[],...extra});
function gate(){let release,reached;const wait=new Promise(r=>release=r),arrival=new Promise(r=>reached=r);return {release,arrival,async pause(){reached();await wait;}};}
async function waitUntil(check){const deadline=Date.now()+10000;while(Date.now()<deadline){if(check())return;await new Promise(r=>setTimeout(r,5));}throw new Error('Timed out waiting for fixture process.');}
function parsedTask(prompt){const match=prompt.match(/TASK:\n([^\n]+)/);return match?JSON.parse(match[1]):{id:'T1'};}
async function provider(responder){
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw||'{}');const system=String(body.instructions||''),prompt=String(body.input||'');requests.push({model:body.model,system,prompt});
    let output=await responder({system,prompt,model:body.model,body,requests});res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:typeof output==='string'?output:JSON.stringify(output)}));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {server,requests,url:`http://127.0.0.1:${server.address().port}`,close(){server.closeAllConnections();server.close();}};
}
function defaultReply({system,prompt}){
  if(system.includes('coding worker')){const t=parsedTask(prompt),repair=prompt.includes('Reviewer fixes required:');return prompt.includes('Tool result:')?{tool:'done',summary:'WORKER_CLAIM_TEST_PASS'}:{tool:'write',path:t.id.toLowerCase()+'.html',content:`<h1>${t.id}</h1>${repair?'<!-- repair-applied -->':''}\n`};}
  if(system.includes('senior reviewer độc lập'))return {approved:true,summary:'Diff reviewed',risks:[],fixes:[]};
  if(system.includes('AI Project Manager'))return {tasks:[{title:'New plan task',role:'frontend',description:'A small follow-up',dependsOn:[],doneWhen:'A reviewed change'}]};
  return 'OK';
}
function connection(url,models=['worker-a','worker-b','reviewer-a','reviewer-b','manager']){
  unlockVault('team-contract-password-2026');const c=saveConnection({kind:'openai',name:'Contract provider',model:'manager',secret:'contract-provider-key-12345',baseUrl:url});recordModels(c,models);return c;
}
function roles(id,c,worker='worker-a',reviewer='reviewer-a'){return updateProjectModelRoles(id,{founder:{connectionId:c.id,model:'manager'},council:[{connectionId:c.id,model:'manager'}],worker:{connectionId:c.id,model:worker},reviewer:{connectionId:c.id,model:reviewer}});}

// These cases inspect real persisted execution, Git and runtime receipts rather
// than duplicating card markup or counting progress from model text.
test('task APIs validate enums, bindings, dependency graph and archive real state',{timeout:30000},async()=>{
  reset();const mock=await provider(defaultReply);
  try{
    const c=connection(mock.url),p=createProject({name:'Task API'});prepareApprovedSpecification(p.id);roles(p.id,c);
    const data={title:'First',role:'backend',description:'A real saved task',priority:'high',dependsOn:[],acceptanceCriteria:['One explicit criterion'],assignedWorker:{connectionId:c.id,model:'worker-a'}};
    assert.throws(()=>createTask(p.id,{...data,priority:'banana'}),/ưu tiên/i);assert.throws(()=>createTask(p.id,{...data,status:'done'}),/state/i);assert.throws(()=>createTask(p.id,{...data,dependsOn:['UNKNOWN']}),/dependency/i);assert.throws(()=>createTask(p.id,{...data,assignedWorker:{connectionId:c.id,model:'missing'}}),/Model/i);
    createTask(p.id,data);createTask(p.id,{...data,title:'Second',dependsOn:['T1']});assert.equal(getProject(p.id).tasks[0].priority,'high');assert.equal(getProject(p.id).tasks[0].acceptanceCriteria[0].status,'not-run');
    assert.throws(()=>updateTask(p.id,'T1',{dependsOn:['T2']}),/cycle/i);assert.throws(()=>updateTask(p.id,'T1',{dependsOn:['T1']}),/dependency/i);assert.throws(()=>updateTask(p.id,'T1',{progress:100}),/state/i);assert.throws(()=>archiveTask(p.id,'T1'),/phụ thuộc/i);
    updateTask(p.id,'T2',{dependsOn:[],title:'Second updated'});archiveTask(p.id,'T2');assert.equal(getProject(p.id).taskArchive[0].title,'Second updated');assert.equal(getProject(p.id).taskArchive[0].editHistory.length,1);
    assert.throws(()=>updateProjectSettings(p.id,{reviewRequired:'false'}),/boolean/i);assert.throws(()=>updateProjectSettings(p.id,{maxParallel:1.5}),/nguyên/i);assert.throws(()=>updateProjectSettings(p.id,{defaultEngine:'crewai'}),/Engine/i);
  }finally{mock.close();}
});

test('plaintext legacy spec and mismatched plan/task specification never start a worktree',{timeout:30000},async()=>{
  reset();const mock=await provider(defaultReply);
  try{
    const c=connection(mock.url),p=createProject({name:'No bypass'}),projects=readJson('projects.json',[]),x=projects.find(x=>x.id===p.id);x.finalSpec='Legacy plaintext';x.tasks=[task()];writeJson('projects.json',projects);
    await assert.rejects(()=>runTask(p.id,'T1',c.id,c.id),/specification/i);assert.equal(fs.existsSync(path.join(workspaceDir(p.id),'.git')),false);
    prepareTaskPlan(p.id,[task()]);const stored=readJson('projects.json',[]);stored.find(x=>x.id===p.id).tasks[0].specificationId='old';writeJson('projects.json',stored);
    await assert.rejects(()=>runTask(p.id,'T1',c.id,c.id),/khớp/i);assert.equal(mock.requests.length,0);
  }finally{mock.close();}
});

test('bindings freeze before first Worker await; repair retains both reviews/logs and final commit HEAD',{timeout:30000},async()=>{
  reset();const first=gate();let held=false;
  const mock=await provider(async req=>{
    if(req.system.includes('coding worker')&&!held){held=true;await first.pause();}
    if(req.system.includes('senior reviewer độc lập'))return req.prompt.includes('repair-applied')?{approved:true,summary:'Repaired diff reviewed',risks:[],fixes:[],acceptance:[{criterionId:'AC1',met:true,explanation:'The added HTML diff contains the requested h1.'}]}:{approved:false,summary:'Initial diff needs repair',risks:['Missing repair marker'],fixes:['Add repair-applied marker']};
    return defaultReply(req);
  });
  try{
    const c=connection(mock.url),p=createProject({name:'Freeze and repair'});prepareTaskPlan(p.id,[task()]);roles(p.id,c);
    const pending=runTask(p.id,'T1');await first.arrival;roles(p.id,c,'worker-b','reviewer-b');first.release();const result=await pending;assert.equal(result.merged,true);
    const t=getProject(p.id).tasks[0];assert.deepEqual(t.workerBinding,{connectionId:c.id,model:'worker-a',area:'codex'});assert.deepEqual(t.reviewerBinding,{connectionId:c.id,model:'reviewer-a',area:'codex'});
    assert.deepEqual(t.reviews.map(r=>r.status),['REJECTED','APPROVED']);assert.equal(t.commits.length,2);assert.equal(t.commitSha,t.commits.at(-1).sha);assert.notEqual(t.commitSha,t.commits[0].sha);
    assert.ok(t.agentLog.some(l=>l.pass===1&&l.tool==='write'));assert.ok(t.agentLog.some(l=>l.pass===2&&l.tool==='write'));assert.equal(t.executionRuns[0].commits.length,2);assert.equal(t.acceptanceCriteria[0].source,'reviewer');
    assert.equal(t.latestTestReceipt.status,'NOT_RUN');assert.equal(t.latestTestReceipt.exitCode,null);assert.equal(t.progress,null);assert.equal(t.cleanup.worktreeRemoved,true);assert.equal(t.cleanup.branchDeleted,true);assert.equal(t.worktreeState,'removed');
    assert.ok(mock.requests.filter(r=>r.system.includes('coding worker')).every(r=>r.model==='worker-a'));assert.ok(mock.requests.filter(r=>r.system.includes('senior reviewer')).every(r=>r.model==='reviewer-a'&&!r.prompt.includes('WORKER_CLAIM_TEST_PASS')&&!r.prompt.includes('Initial diff needs repair')));
    const previousReviews=structuredClone(t.reviews);await buildPlan(p.id);const next=getProject(p.id);assert.equal(next.planHistory.length,1);assert.deepEqual(next.planHistory[0].tasks[0].reviews,previousReviews);assert.equal(next.planHistory[0].tasks[0].commits.length,2);assert.equal(next.planHistory[0].tasks[0].executionRuns[0].outcome,'done');
  }finally{first.release();mock.close();}
});

for(const stage of ['worker','reviewer'])test(`brief change during deferred ${stage} marks stale and cleans branch without merging`,{timeout:30000},async()=>{
  reset();const held=gate();let paused=false;const mock=await provider(async req=>{
    const target=stage==='worker'?'coding worker':'senior reviewer';if(req.system.includes(target)&&!paused){paused=true;await held.pause();}return defaultReply(req);
  });
  try{
    const c=connection(mock.url),p=createProject({name:'Stale '+stage});prepareTaskPlan(p.id,[task()]);roles(p.id,c);const pending=runTask(p.id,'T1');const assertion=assert.rejects(pending,/thay đổi|khớp/i);
    await held.arrival;updateProjectBrief(p.id,{goals:'Changed while '+stage+' awaited'});held.release();await assertion;
    const t=getProject(p.id).tasks[0];assert.equal(t.status,'stale');assert.equal(t.executionRuns[0].outcome,'stale');assert.equal(t.cleanup.worktreeRemoved,true);assert.equal(t.cleanup.branchDeleted,true);assert.equal(fs.existsSync(path.join(workspaceDir(p.id),'t1.html')),false);assert.ok(t.agentLog.some(l=>l.kind==='agent'));
    if(stage==='reviewer'){assert.equal(t.reviews.length,1);assert.equal(t.reviews[0].status,'APPROVED');assert.equal(t.commits.length,1);}
  }finally{held.release();mock.close();}
});

test('replanning refuses active tasks before request and after deferred PM response',{timeout:30000},async()=>{
  reset();const pm=gate(),worker=gate();let workerHeld=false;const mock=await provider(async req=>{if(req.system.includes('AI Project Manager'))await pm.pause();if(req.system.includes('coding worker')&&!workerHeld){workerHeld=true;await worker.pause();}return defaultReply(req);});
  try{
    const c=connection(mock.url),p=createProject({name:'Replan guard'});prepareTaskPlan(p.id,[task()]);roles(p.id,c);
    const planning=buildPlan(p.id),planningAssertion=assert.rejects(planning,/Task đã bắt đầu|đang chạy/i);await pm.arrival;const executing=runTask(p.id,'T1');await worker.arrival;pm.release();await planningAssertion;
    await assert.rejects(()=>buildPlan(p.id),/đang chạy/i);assert.equal(getProject(p.id).tasks[0].title,'Feature T1');worker.release();await executing;assert.equal(getProject(p.id).tasks[0].status,'done');
  }finally{pm.release();worker.release();mock.close();}
});

test('Safe command block and missing test script cannot become PASS from Worker summary',{timeout:30000},async()=>{
  reset();let turn=0;const mock=await provider(req=>{if(req.system.includes('coding worker')){turn++;return turn===1?{tool:'run_npm',script:'test'}:turn===2?{tool:'write',path:'t1.html',content:'<h1>real diff</h1>'}:{tool:'done',summary:'ALL TESTS PASS 100%'};}return defaultReply(req);});
  try{
    const c=connection(mock.url),p=createProject({name:'Honest Safe'});prepareTaskPlan(p.id,[task()]);roles(p.id,c);await runTask(p.id,'T1');const t=getProject(p.id).tasks[0];assert.ok(t.testReceipts.some(r=>r.status==='BLOCKED'&&r.exitCode===null));assert.equal(t.latestTestReceipt.status,'NOT_RUN');assert.equal(t.testReceipts.some(r=>r.status==='PASS'),false);assert.equal(t.acceptanceCriteria[0].status,'not-run');assert.equal(t.progress,null);
  }finally{mock.close();}
});

test('review disabled is SKIPPED/null rather than a fabricated approval',{timeout:30000},async()=>{
  reset();const mock=await provider(defaultReply);
  try{const c=connection(mock.url),p=createProject({name:'Skipped review'});prepareTaskPlan(p.id,[task()]);roles(p.id,c);updateProjectSettings(p.id,{reviewRequired:false});await runTask(p.id,'T1');const t=getProject(p.id).tasks[0];assert.equal(t.review.status,'SKIPPED');assert.equal(t.review.approved,null);assert.equal(t.reviewerBinding,null);assert.equal(mock.requests.some(r=>r.system.includes('senior reviewer')),false);assert.equal(t.latestTestReceipt.status,'NOT_RUN');}finally{mock.close();}
});

test('trusted npm receipts record actual pass, failure, timeout, Safe block and absent test',{timeout:30000},async()=>{
  reset();const root=fs.mkdtempSync(path.join(os.tmpdir(),'team-receipts-'));
  try{
    fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({scripts:{test:'node -e "require(\'fs\').writeFileSync(\'ran.txt\',\'runtime\');console.log(\'actual test\')"',fail:'node -e "process.exit(7)"',wait:'node -e "setTimeout(()=>{},60000)"'}}));
    const safe=await runNpm(root,'test',{mode:'safe'});assert.equal(safe.receipt.status,'BLOCKED');assert.equal(safe.receipt.exitCode,null);assert.equal(fs.existsSync(path.join(root,'ran.txt')),false);
    const pass=await runNpm(root,'test',{mode:'host'});assert.equal(pass.receipt.status,'PASS');assert.equal(pass.receipt.source,'runtime');assert.equal(pass.receipt.exitCode,0);assert.equal(fs.readFileSync(path.join(root,'ran.txt'),'utf8'),'runtime');assert.match(pass.receipt.stdout,/actual test/);assert.ok(pass.receipt.durationMs>0);assert.ok(Date.parse(pass.receipt.completedAt)>=Date.parse(pass.receipt.startedAt));
    const fail=await runNpm(root,'fail',{mode:'host'});assert.equal(fail.receipt.status,'FAIL');assert.equal(fail.receipt.exitCode,7);
    const timeout=await runNpm(root,'wait',{mode:'host',timeoutMs:80});assert.equal(timeout.receipt.status,'TIMED_OUT');assert.equal(timeout.receipt.timedOut,true);
    fs.rmSync(path.join(root,'package.json'));const absent=await runTaskTests({root});assert.equal(absent.status,'NOT_RUN');assert.equal(absent.exitCode,null);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('failed runtime test blocks merge even when model Reviewer says approved',{timeout:30000},async()=>{
  reset();const mock=await provider(req=>req.system.includes('coding worker')&&!req.prompt.includes('Tool result:')?{tool:'write',path:'package.json',content:JSON.stringify({scripts:{test:'node -e "process.exit(7)"'}})}:defaultReply(req));
  try{const c=connection(mock.url),p=createProject({name:'Runtime failure'});prepareTaskPlan(p.id,[task()]);roles(p.id,c);updateProjectSettings(p.id,{sandboxMode:'host',autoRepair:false});const result=await runTask(p.id,'T1');const t=getProject(p.id).tasks[0];assert.equal(result.merged,false);assert.equal(t.status,'review');assert.equal(t.latestTestReceipt.status,'FAIL');assert.equal(t.latestTestReceipt.exitCode,7);assert.equal(t.review.approved,false);assert.equal(fs.existsSync(path.join(workspaceDir(p.id),'package.json')),false);}finally{mock.close();}
});

test('parallel budget enforces two active isolated workers before third run',{timeout:30000},async()=>{
  reset();const held=gate();let waiting=0;let both;const arrival=new Promise(r=>both=r);const mock=await provider(async req=>{if(req.system.includes('coding worker')&&!req.prompt.includes('Tool result:')){waiting++;if(waiting===2)both();await held.pause();}return defaultReply(req);});
  try{const c=connection(mock.url),p=createProject({name:'Parallel budget'});prepareTaskPlan(p.id,[task('T1'),task('T2'),task('T3')]);roles(p.id,c);const batch=runReadyBatch(p.id,{limit:4});await arrival;const active=getProject(p.id).tasks.filter(t=>t.status==='running');assert.equal(active.length,2);assert.notEqual(active[0].worktree,active[1].worktree);assert.notEqual(active[0].branch,active[1].branch);await assert.rejects(()=>runTask(p.id,'T3'),/giới hạn/i);assert.equal(fs.existsSync(path.join(workspaceDir(p.id),'t1.html')),false);held.release();const done=await batch;assert.equal(done.runs.length,2);assert.equal(done.ok,true);assert.equal(getProject(p.id).tasks[2].status,'todo');}finally{held.release();mock.close();}
});

for(const rollbackFail of [false,true])test(`post-merge stale check ${rollbackFail?'retains branch and unknown main when rollback fails':'restores pre-merge HEAD and logs actual rollback'}`,{timeout:30000},async()=>{
  reset();const mock=await provider(defaultReply),bin=fs.mkdtempSync(path.join(os.tmpdir(),'team-git-shim-')),oldPath=process.env.PATH,started=path.join(bin,'merged'),released=path.join(bin,'release');
  let assertion;
  const realGit=(await run('which',['git'])).stdout.trim();
  fs.writeFileSync(path.join(bin,'git'),`#!/usr/bin/env node\nconst fs=require('fs'),cp=require('child_process');const args=process.argv.slice(2);if(args[0]==='reset'&&args[1]==='--merge'&&${rollbackFail}){console.error('contract rollback failure');process.exit(8);}const r=cp.spawnSync(${JSON.stringify(realGit)},args,{stdio:'inherit'});if(args[0]==='merge'&&args.includes('--no-ff')&&r.status===0){fs.writeFileSync(${JSON.stringify(started)},'merged');const until=Date.now()+10000;while(!fs.existsSync(${JSON.stringify(released)})&&Date.now()<until)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}process.exit(r.status??1);\n`);fs.chmodSync(path.join(bin,'git'),0o755);process.env.PATH=bin+path.delimiter+oldPath;
  try{
    const c=connection(mock.url),p=createProject({name:'Post merge guard'});prepareTaskPlan(p.id,[task()]);roles(p.id,c);const pending=runTask(p.id,'T1');assertion=assert.rejects(pending,/thay đổi|khớp/i);await waitUntil(()=>fs.existsSync(started));
    assert.throws(()=>updateProjectBrief(p.id,{goals:'Blocked in merge window'}),/Main đang commit/i);
    const projects=readJson('projects.json',[]);projects.find(x=>x.id===p.id).briefRevision++;writeJson('projects.json',projects);fs.writeFileSync(released,'release');await assertion;
    const t=getProject(p.id).tasks[0];assert.equal(t.rollback.ok,!rollbackFail);assert.equal(t.rollback.source,'runtime');assert.equal(t.rollback.exitCode,rollbackFail?8:0);assert.equal(t.cleanup.worktreeRemoved,true);assert.equal(t.cleanup.branchDeleted,!rollbackFail);assert.equal(t.cleanup.branchRetained,rollbackFail);
    assert.equal(t.status,rollbackFail?'merge-rollback-failed':'stale');assert.equal(t.mainState,rollbackFail?'unknown':'restored');assert.equal(fs.existsSync(path.join(workspaceDir(p.id),'t1.html')),rollbackFail);assert.equal(t.commits.length,1);assert.equal(t.reviews[0].status,'APPROVED');
    const head=(await run(realGit,['rev-parse','HEAD'],{cwd:workspaceDir(p.id)})).stdout.trim();assert.equal(head,rollbackFail?t.rollback.discardedMergeSha:t.rollback.beforeSha);
  }finally{fs.writeFileSync(released,'release');if(assertion)await assertion.catch(()=>{});process.env.PATH=oldPath;mock.close();fs.rmSync(bin,{recursive:true,force:true});}
});

test('native safeResolve blocks dangling symlinks, sensitive paths and dependency directory',()=>{
  reset();const root=fs.mkdtempSync(path.join(os.tmpdir(),'team-paths-'));try{if(process.platform!=='win32'){fs.symlinkSync(path.join(root,'missing-target'),path.join(root,'link'));assert.throws(()=>safeResolve(root,'link'),/symbolic/i);}for(const rel of ['.env','.ssh/id_rsa','node_modules/secret','../outside','.git/config'])assert.throws(()=>safeResolve(root,rel),/an toàn|nhạy cảm/i);}finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('npm receipt and external trajectory redact captured credentials after Vault lock',{timeout:30000},async()=>{
  reset();const bin=fs.mkdtempSync(path.join(os.tmpdir(),'team-redaction-')),root=fs.mkdtempSync(path.join(os.tmpdir(),'team-redaction-root-')),oldPath=process.env.PATH,started=path.join(bin,'started');
  const secret='captured-provider-credential-89012';unlockVault('team-contract-password-2026');const c=saveConnection({kind:'openai',name:'External',model:'mock',secret});
  fs.writeFileSync(path.join(bin,'mini'),`#!/usr/bin/env node\nconst fs=require('fs');const a=process.argv.slice(2),i=a.indexOf('--output');if(i<0)process.exit(0);const secret=process.env.OPENAI_API_KEY;fs.writeFileSync(${JSON.stringify(started)},'started');setTimeout(()=>{fs.writeFileSync(a[i+1],JSON.stringify({secret,stderr:secret}));console.log(secret);console.error(secret);},150);\n`);fs.chmodSync(path.join(bin,'mini'),0o755);process.env.PATH=bin+path.delimiter+oldPath;
  try{
    const external=runExternalTask({engineId:'mini-swe-agent',root,workerId:c.id,spec:'confirmed fixture',task:task(),allowUnsafeHost:true});await waitUntil(()=>fs.existsSync(started));lockVault();const result=await external;assert.doesNotMatch(JSON.stringify(result),new RegExp(secret));assert.equal(result.log[0].trajectoryStatus,'REDACTED');assert.doesNotMatch(fs.readFileSync(result.log[0].output,'utf8'),new RegExp(secret));assert.equal(result.log[0].receipt.kind,'external-command');
    unlockVault('team-contract-password-2026');fs.rmSync(started);fs.writeFileSync(path.join(bin,'npm'),`#!/usr/bin/env node\nconst fs=require('fs');fs.writeFileSync(${JSON.stringify(started)},'started');setTimeout(()=>console.log(${JSON.stringify(secret)}),150);\n`);fs.chmodSync(path.join(bin,'npm'),0o755);
    const npm=runNpm(root,'test',{mode:'host'});await waitUntil(()=>fs.existsSync(started));lockVault();const receipt=(await npm).receipt;assert.equal(receipt.status,'PASS');assert.doesNotMatch(JSON.stringify(receipt),new RegExp(secret));
  }finally{process.env.PATH=oldPath;fs.rmSync(bin,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});}
});
