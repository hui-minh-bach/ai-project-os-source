import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { DATA_DIR, readJson, writeJson } from '../src/lib/store.mjs';
import { lockVault, unlockVault, saveConnection } from '../src/lib/vault.mjs';
import { createProject, getProject, runReadyBatch } from '../src/lib/projects.mjs';
import { workspaceDir } from '../src/lib/workspace.mjs';
import { ensureBaseline } from '../src/lib/task-git.mjs';
import { ensureSecureGitignore } from '../src/lib/git-security.mjs';
import { runNpm } from '../src/lib/sandbox.mjs';
import { ask } from '../src/lib/providers.mjs';
import { publishGitHub } from '../src/lib/publish.mjs';
import { run } from '../src/lib/shell.mjs';
import { recordModels } from '../src/lib/model-bindings.mjs';
import { prepareTaskPlan } from './helpers/council-fixtures.mjs';

function reset(){
  lockVault();
  for(const n of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak']) fs.rmSync(path.join(DATA_DIR,n),{force:true});
  fs.rmSync(path.join(DATA_DIR,'workspaces'),{recursive:true,force:true});
  fs.rmSync(path.join(DATA_DIR,'task-worktrees'),{recursive:true,force:true});
}

test('baseline never tracks .env or private key files', async()=>{
  reset();
  const p=createProject({name:'secure git',idea:'i'}), root=workspaceDir(p.id);
  fs.writeFileSync(path.join(root,'app.txt'),'ok');
  fs.writeFileSync(path.join(root,'.env'),'SECRET=do-not-commit');
  fs.writeFileSync(path.join(root,'private.pem'),'PRIVATE');
  await ensureBaseline(p.id);
  const tracked=(await run('git',['ls-files'],{cwd:root})).stdout.split(/\r?\n/).filter(Boolean);
  assert.ok(tracked.includes('app.txt'));
  assert.ok(tracked.includes('.gitignore'));
  assert.equal(tracked.includes('.env'),false);
  assert.equal(tracked.includes('private.pem'),false);
});

test('security refuses a symlinked .gitignore', ()=>{
  if(process.platform==='win32') return;
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-gitignore-'));
  const outside=path.join(os.tmpdir(),'aipos-gitignore-target-'+Date.now());
  fs.writeFileSync(outside,'KEEP');
  fs.symlinkSync(outside,path.join(root,'.gitignore'));
  assert.throws(()=>ensureSecureGitignore(root),/symbolic link/i);
  assert.equal(fs.readFileSync(outside,'utf8'),'KEEP');
  fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{force:true});
});

test('docker sandbox uses no-network, dropped capabilities and resource limits', async()=>{
  const bin=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-docker-bin-'));
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-docker-root-'));
  const log=path.join(os.tmpdir(),'aipos-docker-args-'+process.pid+'-'+Date.now()+'.txt');
  const oldPath=process.env.PATH;
  const exe=path.join(bin,'docker');
  fs.writeFileSync(exe,`#!/bin/sh\nprintf '%s\\n' \"$@\" > '${log.replaceAll("'","'\\''")}'\nexit 0\n`,'utf8');
  fs.chmodSync(exe,0o755);process.env.PATH=bin+path.delimiter+oldPath;
  try{
    const r=await runNpm(root,'test',{mode:'docker'});assert.equal(r.code,0);
    const args=fs.readFileSync(log,'utf8');
    for(const required of ['--network','none','--cap-drop','ALL','no-new-privileges','--pids-limit','--memory','--cpus']) assert.match(args,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }finally{process.env.PATH=oldPath;fs.rmSync(bin,{recursive:true,force:true});fs.rmSync(root,{recursive:true,force:true});fs.rmSync(log,{force:true});}
});

test('provider rejects oversized HTTP responses before model output is accepted', async()=>{
  reset();unlockVault('release-gate-pass-123');
  const server=http.createServer(async(req,res)=>{for await(const _ of req){}res.statusCode=200;res.setHeader('content-type','application/json');res.setHeader('content-length','9000001');res.write('{}');res.end();});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const c=saveConnection({kind:'openai',name:'oversize',model:'mock',secret:'x',baseUrl:`http://127.0.0.1:${server.address().port}`});
    await assert.rejects(()=>ask(c.id,{system:'s',prompt:'p'}),/quá lớn|vượt giới hạn/i);
  }finally{server.close();}
});


test('four parallel workers preserve all task states and merge four independent branches', async()=>{
  reset();unlockVault('release-gate-pass-123');
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const c of req)raw+=c;const body=raw?JSON.parse(raw):{};const all=String(body.instructions||'')+'\n'+String(body.input||'');let text='OK';
    if(all.includes('coding worker')){
      if(all.includes('Tool result:')) text=JSON.stringify({tool:'done',summary:'done'});
      else {const m=all.match(/"id":"(T[1-4])"/);const id=m?.[1]||'T1';text=JSON.stringify({tool:'write',path:`${id.toLowerCase()}.txt`,content:id+'\n'});}
    } else if(all.includes('senior reviewer độc lập')) text=JSON.stringify({approved:true,summary:'approved',risks:[],fixes:[]});
    res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:text}));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const c=saveConnection({kind:'openai',name:'parallel4',model:'mock',secret:'x',baseUrl:`http://127.0.0.1:${server.address().port}`});
    const reviewer=saveConnection({kind:'openai',name:'independent reviewer4',model:'reviewer-mock',secret:'x',baseUrl:`http://127.0.0.1:${server.address().port}`});recordModels(reviewer,[reviewer.model]);
    recordModels(c,[c.model]);const p=createProject({name:'parallel4',idea:'i'});prepareTaskPlan(p.id,[1,2,3,4].map(n=>({id:`T${n}`,title:`Task ${n}`,role:'frontend',description:`write t${n}.txt`,dependsOn:[],doneWhen:'file exists',status:'todo',engineId:'native',skills:[]})));const a=readJson('projects.json',[]);a.find(v=>v.id===p.id).settings.maxParallel=4;writeJson('projects.json',a);
    const batch=await runReadyBatch(p.id,{workerId:c.id,reviewerId:reviewer.id,engineId:'native',limit:4});
    assert.equal(batch.ok,true);assert.deepEqual(getProject(p.id).tasks.map(t=>t.status),['done','done','done','done']);
    const root=workspaceDir(p.id);for(let n=1;n<=4;n++)assert.equal(fs.readFileSync(path.join(root,`t${n}.txt`),'utf8',),`T${n}\n`);
  } finally {server.close();}
});


test('GitHub publish refuses same repo name under a different owner', async()=>{
  reset();unlockVault('release-gate-pass-123');
  const c=saveConnection({kind:'github',name:'gh cli',secret:'',meta:{authMode:'cli',userId:'12345',login:'my-account'}});
  const p=createProject({name:'same',idea:'i'}),root=workspaceDir(p.id);fs.writeFileSync(path.join(root,'app.txt'),'ok');
  await ensureBaseline(p.id);await run('git',['remote','add','origin','https://github.com/other-owner/same.git'],{cwd:root});
  const bin=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-gh-bin-')),oldPath=process.env.PATH,exe=path.join(bin,'gh');
  fs.writeFileSync(exe,'#!/bin/sh\nexit 0\n','utf8');fs.chmodSync(exe,0o755);process.env.PATH=bin+path.delimiter+oldPath;
  try{await assert.rejects(()=>publishGitHub({projectId:p.id,connectionId:c.id,name:'same',isPrivate:true}),/origin khác|ghi nhầm repo/i);}finally{process.env.PATH=oldPath;fs.rmSync(bin,{recursive:true,force:true});}
});
