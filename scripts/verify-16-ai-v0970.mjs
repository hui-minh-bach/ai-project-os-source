import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {isolatedRuntime} from '../test/helpers/isolated-runtime.mjs';
const evidence=path.resolve(process.argv[2]);fs.mkdirSync(evidence,{recursive:true});
const r=isolatedRuntime('audit16');const started=Date.now();const requests=[];const result={type:'local synthetic provider HTTP + production task/Git runtime',liveProviderLogin:false,windows:false,checks:{}};
let release;const hold=new Promise(done=>release=done);let arrived=0;
const server=http.createServer(async(req,res)=>{try{let raw='';for await(const b of req)raw+=b;const q=JSON.parse(raw);const worker=(q.instructions||'').includes('coding worker');const prompt=q.input||'';requests.push({model:q.model,worker,at:Date.now()});let out;
 if(worker){if(!prompt.includes('Tool result:')){arrived++;await hold;const task=JSON.parse(prompt.match(/TASK:\n([^\n]+)/)[1]);out={tool:'write',path:task.id.toLowerCase()+'.html',content:'<h1>'+task.id+'</h1>'};}else out={tool:'done',summary:'Fixture task implemented'};}
 else out={approved:true,summary:'Synthetic independent reviewer',risks:[],fixes:[]};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({output_text:JSON.stringify(out)}));
 }catch(e){res.statusCode=500;res.end(e.message);}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
try{
 const v=await r.import('src/lib/vault.mjs'),m=await r.import('src/lib/model-bindings.mjs'),p=await r.import('src/lib/projects.mjs'),w=await r.import('src/lib/workspace.mjs'),f=await r.import('test/helpers/council-fixtures.mjs');
 v.unlockVault('synthetic-audit-password-2026');const bindings=[];
 for(let i=0;i<17;i++){const id='audit-ai-'+i,model='fixture-model-'+i;v.saveConnection({id,kind:'openai',name:i===16?'Audit coordinator/reviewer':'Synthetic AI '+(i+1),secret:'local-fixture-secret-'+i,model,baseUrl:'http://127.0.0.1:'+server.address().port});m.recordModels(v.getConnection(id),[model]);bindings.push({connectionId:id,model});}
 result.checks.registeredConnections=v.listConnections().length;assert.equal(result.checks.registeredConnections,17);
 const projects=[];for(let g=0;g<1;g++){const project=p.createProject({name:'Audit team '+g});projects.push(project);p.updateProjectModelRoles(project.id,{teams:{worker:bindings.slice(0,16),reviewer:[bindings[16]]}});p.updateProjectSettings(project.id,{sandboxMode:'host',maxParallel:4,failoverScope:'project'});
 f.prepareTaskPlan(project.id,Array.from({length:16},(_,k)=>{const id='T'+(k+1);return {id,title:id,role:'frontend',description:'Write '+id.toLowerCase()+'.html containing <h1>'+id+'</h1>',dependsOn:[],doneWhen:'File content matches task ID and tests pass',status:'todo',engineId:'native',skills:[]};}));
 const dir=w.workspaceDir(project.id);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({private:true,scripts:{test:'node --test validation.test.cjs'}}));fs.writeFileSync(path.join(dir,'validation.test.cjs'),"const t=require('node:test'),a=require('node:assert/strict'),fs=require('fs');t('task HTML matches its own ID',()=>{const files=fs.readdirSync('.').filter(f=>/^t[0-9]+[.]html$/.test(f));a.ok(files.length);for(const f of files)a.equal(fs.readFileSync(f,'utf8'),'<h1>'+f.slice(0,-5).toUpperCase()+'</h1>');});");}
 const batches=projects.map(project=>p.runReadyBatch(project.id,{limit:4,autoContinue:true}));
 const deadline=Date.now()+30000;while(arrived<4&&Date.now()<deadline)await new Promise(done=>setTimeout(done,100));
 result.checks.concurrentWorkersInFirstWave=arrived;result.activeSnapshot=projects.map(project=>({project:project.id,tasks:p.getProject(project.id).tasks.map(t=>({id:t.id,status:t.status,worker:t.workerBinding}))}));release();
 result.batches=await Promise.all(batches);assert.equal(arrived,16);assert.ok(result.batches.every(b=>b.ok));
 result.tasks=projects.flatMap(project=>p.getProject(project.id).tasks.map(t=>{const content=fs.readFileSync(path.join(w.workspaceDir(project.id),t.id.toLowerCase()+'.html'),'utf8');assert.equal(content,'<h1>'+t.id+'</h1>');assert.equal(t.status,'done');assert.equal(t.latestTestReceipt.status,'PASS');assert.ok(t.mergeSha);assert.equal(t.servedReviewerBinding.connectionId,bindings[16].connectionId);return {id:t.id,status:t.status,worker:t.servedWorkerBinding,reviewer:t.servedReviewerBinding,test:t.latestTestReceipt.status,mergeSha:t.mergeSha,content};}));
 result.checks.uniqueServedWorkers=new Set(result.tasks.map(t=>t.worker.connectionId)).size;assert.equal(result.checks.uniqueServedWorkers,16);
 const store=await r.import('src/lib/store.mjs');const disk=JSON.parse(fs.readFileSync(path.join(store.DATA_DIR,'projects.json'),'utf8'));result.checks.persistedCompletedTasks=disk.flatMap(p=>p.tasks).filter(t=>t.status==='done').length;assert.equal(result.checks.persistedCompletedTasks,16);
 result.checks.totalWorkerTasks=arrived;result.checks.teamSize=16;result.checks.singleProject=true;result.status='PASS';v.lockVault();
}catch(e){result.status='FAIL';result.error={message:e.message,stack:e.stack};process.exitCode=1;}
finally{release();server.closeAllConnections();await new Promise(done=>server.close(done));result.durationMs=Date.now()-started;result.requests=requests;fs.writeFileSync(path.join(evidence,'16-ai-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,checks:result.checks,error:result.error,durationMs:result.durationMs}));r.cleanup();}
