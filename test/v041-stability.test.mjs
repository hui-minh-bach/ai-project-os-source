import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { DATA_DIR, readJson, writeJson } from '../src/lib/store.mjs';
import { unlockVault, saveConnection, lockVault, listConnections } from '../src/lib/vault.mjs';
import { ask } from '../src/lib/providers.mjs';
import { createProject, founderChat, runCouncil, confirmCouncilSpecification, analyzeStack, buildPlan, runReadyBatch, getProject } from '../src/lib/projects.mjs';
import { recordModels } from '../src/lib/model-bindings.mjs';
import { memberResponse, chairResponse, prepareCouncilHandoff, prepareApprovedArchitecture, prepareTaskPlan } from './helpers/council-fixtures.mjs';
import { workspaceDir } from '../src/lib/workspace.mjs';
import { connectCli } from '../src/lib/cli-connections.mjs';
import { listSupabaseProjects, attachSupabaseProject } from '../src/lib/supabase.mjs';
import { runExternalTask } from '../src/lib/external-agents.mjs';

function resetState(){
  lockVault();
  for(const name of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak']) fs.rmSync(path.join(DATA_DIR,name),{force:true});
  fs.rmSync(path.join(DATA_DIR,'workspaces'),{recursive:true,force:true});
  fs.rmSync(path.join(DATA_DIR,'task-worktrees'),{recursive:true,force:true});
}

async function mockServer(){
  const counts={openai:0,gemini:0,anthropic:0};
  const server=http.createServer(async(req,res)=>{
    let raw=''; for await(const c of req)raw+=c; const body=raw?JSON.parse(raw):{};
    const kind=req.url.startsWith('/openai')?'openai':req.url.startsWith('/gemini')?'gemini':'anthropic';
    counts[kind]++;
    const system=kind==='openai'?(body.instructions||''):kind==='gemini'?(body.system_instruction?.parts?.map(x=>x.text).join('\n')||''):(body.system||'');
    const prompt=kind==='openai'?String(body.input||''):kind==='gemini'?(body.contents?.flatMap(x=>x.parts||[]).map(x=>x.text).join('\n')||''):(body.messages?.map(x=>x.content).join('\n')||'');
    const all=system+'\n'+prompt;
    if(kind==='openai'&&counts.openai===1){res.statusCode=429;res.setHeader('content-type','application/json');res.end(JSON.stringify({error:{message:'retry me'}}));return;}
    let text='OK';
    if(all.includes('AI Founder/Project Manager')) text='MVP static app with two independent features.';
    else if(system.includes('COUNCIL_MEMBER_V1')) text=JSON.stringify(memberResponse());
    else if(system.includes('COUNCIL_CHAIR_V1')) text=JSON.stringify(chairResponse());
    else if(all.includes('solution architect')) text=JSON.stringify({needsDatabase:false,needsAuth:false,needsStorage:false,needsPayments:false,needsDomain:false,needsBackend:false,recommended:{source:'github',deploy:'vercel',database:'none'},reasons:['static'],setupOrder:['github','vercel']});
    else if(all.includes('AI Project Manager')) text=JSON.stringify({tasks:[{title:'Feature A',role:'frontend',description:'Create feature-a.txt',dependsOn:[],doneWhen:'exists'},{title:'Feature B',role:'backend',description:'Create feature-b.txt',dependsOn:[],doneWhen:'exists'}]});
    else if(all.includes('senior reviewer độc lập')) text=all.replaceAll('\\_','_').includes('REJECT_SPEC')?JSON.stringify({approved:false,summary:'needs human review',risks:['intentional'],fixes:[]}):JSON.stringify({approved:true,summary:'approved',risks:[],fixes:[]});
    else if(all.includes('coding worker')){
      const isA=all.includes('Feature A'),isB=all.includes('Feature B'),reject=all.includes('Reject Task');
      if(all.includes('Tool result:')) text='```json\n{\n  "tool": "done",\n  "summary": "completed"\n}\n```';
      else if(reject) text='```json\n{\n  "tool": "write",\n  "path": "should-not-merge.txt",\n  "content": "blocked\\n"\n}\n```';
      else text=`\`\`\`json\n{\n  "tool": "write",\n  "path": "${isA?'feature-a.txt':isB?'feature-b.txt':'worker.txt'}",\n  "content": "${isA?'A':isB?'B':'X'}\\n"\n}\n\`\`\``;
    } else if(all.includes('Phản biện độc lập')) text='Keep it small.';
    res.setHeader('content-type','application/json');
    if(kind==='openai')res.end(JSON.stringify({output_text:text}));
    else if(kind==='gemini')res.end(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}));
    else res.end(JSON.stringify({content:[{type:'text',text}]}));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {server,port:server.address().port,counts};
}

function addRejectTask(projectId){
  prepareTaskPlan(projectId,[{id:'T1',title:'Reject Task',role:'frontend',description:'Must be rejected',dependsOn:[],doneWhen:'human approval',status:'todo',engineId:'native',skills:[]}],{scope:'REJECT_SPEC'});
}

test('mock OpenAI + Gemini + Claude complete council and two parallel tasks stably',async()=>{
  resetState();const {server,port,counts}=await mockServer();
  try{
    unlockVault('provider-test-pass');
    const oa=saveConnection({kind:'openai',name:'Mock OpenAI',model:'gpt-mock',secret:'x',baseUrl:`http://127.0.0.1:${port}/openai`});
    const ge=saveConnection({kind:'gemini',name:'Mock Gemini',model:'gemini-mock',secret:'x',baseUrl:`http://127.0.0.1:${port}/gemini`});
    const an=saveConnection({kind:'anthropic',name:'Mock Claude',model:'claude-mock',secret:'x',baseUrl:`http://127.0.0.1:${port}/anthropic`});
    assert.equal(await ask(oa.id,{system:'plain',prompt:'plain'}),'OK');
    assert.equal(counts.openai,2,'429 response should be retried once');
    assert.equal(await ask(ge.id,{system:'plain',prompt:'plain'}),'OK');
    assert.equal(await ask(an.id,{system:'plain',prompt:'plain'}),'OK');
    const p=createProject({name:'Parallel Mock',idea:'Build static demo'});
    for(const c of [oa,ge,an])recordModels(c,[c.model]);
    await founderChat(p.id,oa.id,'go');prepareCouncilHandoff(p.id);const council=await runCouncil(p.id,[oa.id,ge.id,an.id],oa.id);confirmCouncilSpecification(p.id,council.specification.id);prepareApprovedArchitecture(p.id);await analyzeStack(p.id,ge.id);await buildPlan(p.id,an.id);
    const batch=await runReadyBatch(p.id,{workerId:oa.id,reviewerId:an.id,engineId:'native',limit:2});
    assert.equal(batch.ok,true);assert.deepEqual(batch.runs.map(x=>x.status),['done','done']);
    const done=getProject(p.id);assert.deepEqual(done.tasks.map(x=>x.status),['done','done']);
    const root=workspaceDir(p.id);assert.equal(fs.readFileSync(path.join(root,'feature-a.txt'),'utf8'),'A\n');assert.equal(fs.readFileSync(path.join(root,'feature-b.txt'),'utf8'),'B\n');
  } finally {server.close();}
});

test('review rejection rolls back branch and batch reports not-ok',async()=>{
  resetState();const {server,port}=await mockServer();
  try{
    unlockVault('provider-test-pass');
    const oa=saveConnection({kind:'openai',name:'Mock OpenAI',model:'gpt-mock',secret:'x',baseUrl:`http://127.0.0.1:${port}/openai`});
    const an=saveConnection({kind:'anthropic',name:'Mock Claude',model:'claude-mock',secret:'x',baseUrl:`http://127.0.0.1:${port}/anthropic`});
    for(const c of [oa,an])recordModels(c,[c.model]);
    const p=createProject({name:'Reject Mock',idea:'Reject'});addRejectTask(p.id);
    const batch=await runReadyBatch(p.id,{workerId:oa.id,reviewerId:an.id,engineId:'native',limit:1});
    assert.equal(batch.ok,false);assert.equal(batch.runs[0].status,'review');
    const root=workspaceDir(p.id);assert.equal(fs.existsSync(path.join(root,'should-not-merge.txt')),false);
    assert.equal(getProject(p.id).tasks[0].status,'review');
  } finally {server.close();}
});

test('parallel agents editing the same file produce a safe merge-conflict instead of corrupting main',async()=>{
  resetState();
  let calls=0;
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const c of req)raw+=c;const body=raw?JSON.parse(raw):{};const system=body.instructions||'';const prompt=String(body.input||'');const all=system+'\n'+prompt;let text='OK';
    if(all.includes('coding worker')){
      if(all.includes('Tool result:'))text=JSON.stringify({tool:'done',summary:'done'});
      else text=JSON.stringify({tool:'write',path:'shared.txt',content:all.includes('Conflict A')?'A\n':'B\n'});
    } else if(all.includes('senior reviewer độc lập'))text=JSON.stringify({approved:true,summary:'approved',risks:[],fixes:[]});
    res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:text}));calls++;
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    unlockVault('provider-test-pass');const port=server.address().port;const oa=saveConnection({kind:'openai',name:'Mock OpenAI',model:'gpt-mock',secret:'x',baseUrl:`http://127.0.0.1:${port}/openai`});
    recordModels(oa,[oa.model]);const p=createProject({name:'Conflict Mock',idea:'Conflict'});prepareTaskPlan(p.id,[{id:'T1',title:'Conflict A',role:'frontend',description:'same file',dependsOn:[],doneWhen:'done',status:'todo',engineId:'native',skills:[]},{id:'T2',title:'Conflict B',role:'backend',description:'same file',dependsOn:[],doneWhen:'done',status:'todo',engineId:'native',skills:[]}]);
    const batch=await runReadyBatch(p.id,{workerId:oa.id,reviewerId:oa.id,engineId:'native',limit:2});
    assert.equal(batch.ok,false);const statuses=batch.runs.map(r=>r.status).sort();assert.deepEqual(statuses,['done','merge-conflict']);
    const root=workspaceDir(p.id),value=fs.readFileSync(path.join(root,'shared.txt'),'utf8');assert.ok(value==='A\n'||value==='B\n');
    const project=getProject(p.id);assert.equal(project.tasks.filter(t=>t.status==='done').length,1);assert.equal(project.tasks.filter(t=>t.status==='merge-conflict').length,1);
  } finally {server.close();}
});

function fakeExe(dir,name,body){
  const p=path.join(dir,name);fs.writeFileSync(p,'#!/bin/sh\nset -eu\n'+body+'\n','utf8');fs.chmodSync(p,0o755);return p;
}

test('CLI quick-connects and Supabase attach work with simulated gh/vercel/supabase sessions',async()=>{
  resetState();unlockVault('provider-test-pass');const bin=fs.mkdtempSync('/tmp/aipos-bin-');const oldPath=process.env.PATH;
  fakeExe(bin,'gh',`if [ "$1" = "auth" ]; then exit 0; fi\nif [ "$1" = "api" ]; then printf '12345\tmock-github-user\n'; exit 0; fi\nexit 1`);
  fakeExe(bin,'vercel',`if [ "$1" = "whoami" ]; then echo mock-vercel-user; exit 0; fi\nexit 1`);
  fakeExe(bin,'supabase',`if [ "$1" = "projects" ] && [ "$2" = "list" ]; then echo '[{"name":"Demo DB","ref":"demo123","region":"ap-southeast-1"}]'; exit 0; fi\nif [ "$1" = "projects" ] && [ "$2" = "api-keys" ]; then echo '[{"name":"publishable","type":"publishable","api_key":"sb_publishable_mock"}]'; exit 0; fi\nexit 1`);
  process.env.PATH=bin+path.delimiter+oldPath;
  try{
    const gh=await connectCli('github'),ve=await connectCli('vercel'),su=await connectCli('supabase');
    assert.equal(gh.meta.login,'mock-github-user');assert.equal(gh.meta.userId,'12345');assert.equal(ve.meta.login,'mock-vercel-user');assert.equal(su.meta.authMode,'cli');
    const projects=await listSupabaseProjects(su.id);assert.equal(projects[0].ref,'demo123');
    const attached=await attachSupabaseProject({managementConnectionId:su.id,ref:'demo123',name:'Demo DB'});assert.equal(attached.baseUrl,'https://demo123.supabase.co');assert.equal(attached.hasSecret,true);assert.equal(attached.meta.keyType,'publishable');
    assert.ok(listConnections().some(x=>x.name==='Demo DB'));
  } finally {process.env.PATH=oldPath;fs.rmSync(bin,{recursive:true,force:true});}
});

test('mini-SWE adapter passes provider credential to a simulated mini runtime without exposing it in task output',async()=>{
  resetState();unlockVault('provider-test-pass');const bin=fs.mkdtempSync('/tmp/aipos-mini-');const oldPath=process.env.PATH;const root=fs.mkdtempSync('/tmp/aipos-mini-root-');
  fakeExe(bin,'mini',`[ -n "\${OPENAI_API_KEY:-}" ] || exit 31\nprintf 'mini-ok\\n' > mini-result.txt\necho 'simulated mini completed'`);
  process.env.PATH=bin+path.delimiter+oldPath;
  try{
    const oa=saveConnection({kind:'openai',name:'Mock OpenAI',model:'gpt-mock',secret:'super-secret-key'});
    const result=await runExternalTask({engineId:'mini-swe-agent',root,workerId:oa.id,spec:'spec',task:{id:'T1',title:'mini task'},allowUnsafeHost:true});
    assert.equal(fs.readFileSync(path.join(root,'mini-result.txt'),'utf8'),'mini-ok\n');assert.match(result.summary,/completed/i);assert.doesNotMatch(JSON.stringify(result),/super-secret-key/);
  } finally {process.env.PATH=oldPath;fs.rmSync(bin,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});}
});
