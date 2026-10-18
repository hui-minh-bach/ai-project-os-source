import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { DATA_DIR, readJson, writeJson } from '../src/lib/store.mjs';
import { unlockVault, saveConnection, lockVault, listConnections } from '../src/lib/vault.mjs';
import { reviewNativeTask } from '../src/lib/native-agent.mjs';
import { createProject, buildPlan, getProject, recoverInterruptedTasks, readyTasks, updateProjectSettings } from '../src/lib/projects.mjs';
import { workspaceDir, safeResolve, snapshot } from '../src/lib/workspace.mjs';
import { runExternalTask } from '../src/lib/external-agents.mjs';
import { runNpm } from '../src/lib/sandbox.mjs';
import { gitStatus } from '../src/lib/publish.mjs';
import { ensureReleaseAuthor } from '../src/lib/git-security.mjs';
import { run, must } from '../src/lib/shell.mjs';
import { prepareApprovedSpecification, prepareTaskPlan } from './helpers/council-fixtures.mjs';

function reset(){lockVault();for(const n of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak'])fs.rmSync(path.join(DATA_DIR,n),{force:true});fs.rmSync(path.join(DATA_DIR,'workspaces'),{recursive:true,force:true});fs.rmSync(path.join(DATA_DIR,'task-worktrees'),{recursive:true,force:true});}
async function simpleOpenAIServer(reply){const server=http.createServer(async(req,res)=>{for await(const _ of req){}res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:typeof reply==='function'?reply():reply}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;}

function setSpecAndTasks(projectId,mutate){const a=readJson('projects.json',[]),p=a.find(x=>x.id===projectId);mutate(p);writeJson('projects.json',a);}

test('reviewer string "false" never approves a task',async()=>{reset();const server=await simpleOpenAIServer(JSON.stringify({approved:'false',summary:'bad',risks:[],fixes:[]}));try{unlockVault('hardening-pass-123');const c=saveConnection({kind:'openai',name:'review',model:'mock',secret:'x',baseUrl:`http://127.0.0.1:${server.address().port}`});const r=await reviewNativeTask({reviewerId:c.id,spec:'s',task:{id:'T1'},diff:'x'});assert.equal(r.approved,false);}finally{server.close();}});

test('plan normalization prevents AI from overriding id/status/engine fields',async()=>{reset();const server=await simpleOpenAIServer(JSON.stringify({tasks:[{id:'EVIL',status:'done',engineId:'mini-swe-agent',skills:['security-review'],title:'One',role:'frontend',description:'x',dependsOn:[],doneWhen:'x'}]}));try{unlockVault('hardening-pass-123');const c=saveConnection({kind:'openai',name:'pm',model:'mock',secret:'x',baseUrl:`http://127.0.0.1:${server.address().port}`});const p=createProject({name:'p',idea:'i'});prepareApprovedSpecification(p.id);const tasks=await buildPlan(p.id,c.id);assert.equal(tasks[0].id,'T1');assert.equal(tasks[0].status,'todo');assert.equal(tasks[0].engineId,'native');assert.notDeepEqual(tasks[0].skills,['security-review']);}finally{server.close();}});

test('plan rejects forward or unknown dependencies',async()=>{reset();const server=await simpleOpenAIServer(JSON.stringify({tasks:[{title:'One',role:'frontend',description:'x',dependsOn:['T2'],doneWhen:'x'},{title:'Two',role:'backend',description:'x',dependsOn:[],doneWhen:'x'}]}));try{unlockVault('hardening-pass-123');const c=saveConnection({kind:'openai',name:'pm',model:'mock',secret:'x',baseUrl:`http://127.0.0.1:${server.address().port}`});const p=createProject({name:'p',idea:'i'});prepareApprovedSpecification(p.id);await assert.rejects(()=>buildPlan(p.id,c.id),/dependency/i);}finally{server.close();}});

test('workspace blocks symlink escape and snapshot skips symlink content',()=>{reset();if(process.platform==='win32')return;const p=createProject({name:'p',idea:'i'}),root=workspaceDir(p.id),outside=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-out-'));fs.writeFileSync(path.join(outside,'secret.txt'),'TOP_SECRET');fs.symlinkSync(path.join(outside,'secret.txt'),path.join(root,'link.txt'));assert.throws(()=>safeResolve(root,'link.txt'),/symbolic link/i);assert.equal(snapshot(p.id).some(x=>x.content.includes('TOP_SECRET')),false);fs.rmSync(outside,{recursive:true,force:true});});

test('JSON store recovers previous valid generation from backup instead of returning empty',()=>{reset();writeJson('projects.json',[{id:'v1'}]);writeJson('projects.json',[{id:'v2'}]);fs.writeFileSync(path.join(DATA_DIR,'projects.json'),'{broken','utf8');const x=readJson('projects.json',[]);assert.equal(x[0].id,'v2');assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(path.join(DATA_DIR,'projects.json'),'utf8')));});

test('vault can recover a valid backup after primary corruption',()=>{reset();unlockVault('hardening-pass-123');saveConnection({kind:'openai',name:'A',model:'m',secret:'s'});saveConnection({kind:'gemini',name:'B',model:'m',secret:'s'});lockVault();fs.writeFileSync(path.join(DATA_DIR,'vault.enc.json'),'{broken','utf8');const st=unlockVault('hardening-pass-123');assert.equal(st.unlocked,true);assert.ok(listConnections().some(x=>x.name==='A'));});

test('safe sandbox blocks npm command execution',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-safe-'));fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({scripts:{test:'node -e "require(\\\"fs\\\").writeFileSync(\\\"pwned\\\",\\\"1\\\")"'}}));const r=await runNpm(root,'test',{mode:'safe'});assert.equal(r.code,126);assert.equal(fs.existsSync(path.join(root,'pwned')),false);fs.rmSync(root,{recursive:true,force:true});});

test('external mini is blocked by default and does not inherit unrelated shell secrets when explicitly enabled',async()=>{reset();unlockVault('hardening-pass-123');const c=saveConnection({kind:'openai',name:'O',model:'m',secret:'provider-secret'});const bin=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-mini-bin-')),root=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-mini-root-')),oldPath=process.env.PATH,oldAws=process.env.AWS_SECRET_ACCESS_KEY;const exe=path.join(bin,'mini');fs.writeFileSync(exe,'#!/bin/sh\n[ -z "${AWS_SECRET_ACCESS_KEY:-}" ] || exit 41\n[ -n "${OPENAI_API_KEY:-}" ] || exit 42\necho ok\n','utf8');fs.chmodSync(exe,0o755);process.env.PATH=bin+path.delimiter+oldPath;process.env.AWS_SECRET_ACCESS_KEY='ambient-secret';try{await assert.rejects(()=>runExternalTask({engineId:'mini-swe-agent',root,workerId:c.id,spec:'s',task:{id:'T1'}}),/khóa mặc định/i);const r=await runExternalTask({engineId:'mini-swe-agent',root,workerId:c.id,spec:'s',task:{id:'T1'},allowUnsafeHost:true});assert.match(r.log[0].stdout,/ok/);assert.doesNotMatch(JSON.stringify(r),/ambient-secret|provider-secret/);}finally{process.env.PATH=oldPath;if(oldAws===undefined)delete process.env.AWS_SECRET_ACCESS_KEY;else process.env.AWS_SECRET_ACCESS_KEY=oldAws;fs.rmSync(bin,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});}});

test('gitStatus redacts credentials embedded in origin URL',async()=>{reset();const p=createProject({name:'p',idea:'i'}),root=workspaceDir(p.id);await must('git',['init','-b','main'],{cwd:root});await must('git',['remote','add','origin','https://SECRET_TOKEN@github.com/example/demo.git'],{cwd:root});const s=await gitStatus(p.id);assert.doesNotMatch(s.remote,/SECRET_TOKEN/);assert.equal(s.remote,'https://github.com/example/demo.git');});

test('release author uses authenticated GitHub noreply identity',async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-git-'));await must('git',['init','-b','main'],{cwd:root});await must('git',['config','user.name','Local'],{cwd:root});await must('git',['config','user.email','local@ai-project-os.invalid'],{cwd:root});fs.writeFileSync(path.join(root,'a.txt'),'a');await must('git',['add','-A'],{cwd:root});await must('git',['commit','-m','local'],{cwd:root});await ensureReleaseAuthor(root,{id:12345,login:'octocat'});const email=(await run('git',['log','-1','--format=%ae'],{cwd:root})).stdout.trim();assert.equal(email,'12345+octocat@users.noreply.github.com');fs.rmSync(root,{recursive:true,force:true});});

test('restart recovery marks active tasks interrupted and makes them rerunnable',()=>{reset();const p=createProject({name:'p',idea:'i'});prepareTaskPlan(p.id,[{id:'T1',title:'x',role:'frontend',description:'x',dependsOn:[],doneWhen:'x',status:'running',engineId:'native',skills:[]}]);assert.equal(recoverInterruptedTasks(),1);assert.equal(getProject(p.id).tasks[0].status,'interrupted');assert.equal(readyTasks(p.id)[0].id,'T1');});

test('project settings reject invalid sandbox values and default new projects to safe mode',()=>{reset();const p=createProject({name:'p',idea:'i'});assert.equal(p.settings.sandboxMode,'safe');assert.throws(()=>updateProjectSettings(p.id,{sandboxMode:'banana'}),/Sandbox mode/i);});
