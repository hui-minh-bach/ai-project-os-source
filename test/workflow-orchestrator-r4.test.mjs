import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createOrchestrator,defaultOrchestratorConfig} from '../src/lib/orchestrator.mjs';
import {prepareNewsEvidence,newsRequest} from '../src/lib/intake-evidence.mjs';
function world(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'r4-orchestrator-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const cards=[{id:'news1',title:'Gold fixture - not real news',summary:'Synthetic test source',link:'https://example.com/news1',publishedAt:'2026-10-23T01:00:00Z'}],tasks=new Map(),arts=new Map(),records=[];
 let sequence=0,projects=0,scriptCalls=0,mediaFailures=0,publishFailures=0;
 const ingest={listCards:()=>cards,listSources:()=>[],markCardUsed(id,p){const c=cards.find(x=>x.id===id);if(c)c.usedByProjectId=p;}};
 const host={mediaWorkspace:path.join(dir,'media'),submit({projectId,operation}){const task={id:'task'+(++sequence),projectId,operation,state:'paused'};tasks.set(task.id,task);return task;},action(id){tasks.get(id).state='approved';},core:{state:{find:id=>tasks.get(id)},queue:{async drain(){for(const task of tasks.values()){if(task.state!=='approved')continue;
  if(task.operation==='media.story'&&mediaFailures-->0){task.state='failed';task.error={code:'MEDIA_UNAVAILABLE',message:'Local fixture media failure'};continue;}
  if(task.operation.startsWith('media.publish-')&&publishFailures-->0){task.state='failed';task.error={code:'NETWORK_TIMEOUT',message:'Publication outcome uncertain'};continue;}
  task.state='completed';
  if(task.operation==='media.story')arts.set('art'+task.id,{id:'art'+task.id,projectId:task.projectId,taskId:task.id,name:'video.mp4',bytes:1024});
  if(task.operation.startsWith('media.publish-'))records.push({id:'rec'+task.id,projectId:task.projectId,platform:task.operation.replace('media.publish-',''),url:'https://example.com/watch',publishedAt:new Date().toISOString()});
 }}}},listArtifacts:id=>[...arts.values()].filter(x=>x.projectId===id),artifact:()=>({bytes:Buffer.alloc(1024,3)}),publishRecords:{list:({projectId}={})=>records.filter(x=>!projectId||x.projectId===projectId),append(r){r={...r,id:'rec'+(++sequence)};records.push(r);return r;}},refreshPublishMetrics:async()=>[]};fs.mkdirSync(host.mediaWorkspace);
 const cfg=defaultOrchestratorConfig();for(const c of Object.values(cfg.pipelines)){c.aiMode='gateway';c.dailyCap=5;}
 const gateway={mode:'gateway',async writeNewsScript(){scriptCalls++;return {text:'A fixture article or narration',publishTitle:'Fixture title',publishDescription:'Fixture source only',provider:'fixture',model:'fixture-text'};},async writeIdeaScript(){scriptCalls++;return {text:'A fixture story',publishTitle:'Story',publishDescription:'Local fixture',provider:'fixture'};}};
 const opts={file:path.join(dir,'state.json'),ingest,host,createProject(){return {id:'project'+(++projects)};},aiAdapters:{gateway}};const orch=createOrchestrator(opts);orch.setConfig(cfg);
 return {dir,cards,records,tasks,arts,orch,opts,get projects(){return projects;},get scriptCalls(){return scriptCalls;},set mediaFailures(n){mediaFailures=n;},set publishFailures(n){publishFailures=n;}};
}
test('R4 missing/invalid inputs fail before creating a run or project',async t=>{
 const w=world(t);for(const [pipeline,input] of [['news-video',{}],['news-article',{cardId:'deleted'}],['idea-film',{ideaText:'  '}],['dub-video',{}]])await assert.rejects(()=>w.orch.startRun(pipeline,input),e=>e.code==='ORCHESTRATOR_INPUT');assert.equal(w.projects,0);assert.equal(w.orch.listRuns().length,0);
});
test('R4 media failure retries same run/project with persisted script and card snapshot, even after feed deletion',async t=>{
 const w=world(t);w.mediaFailures=1;let r=await w.orch.startRun('news-video',{cardId:'news1'});assert.equal(r.state,'failed');assert.ok(r.script);assert.ok(r.cardSnapshot);const id=r.id,pid=r.projectId;w.cards.length=0;
 r=await w.orch.retryRun(id);assert.equal(r.id,id);assert.equal(r.projectId,pid);assert.equal(r.state,'awaiting-approval');assert.equal(w.projects,1);assert.equal(w.scriptCalls,1);assert.equal(r.retryCount,1);assert.equal(r.publish.length,0);
});
test('R4 retry survives app restart and never reruns a completed media operation',async t=>{
 const w=world(t);w.mediaFailures=1;let r=await w.orch.startRun('idea-film',{ideaText:'Fixture'});const resumed=createOrchestrator(w.opts);r=await resumed.retryRun(r.id);assert.equal(r.state,'awaiting-approval');assert.equal(w.projects,1);assert.equal(w.scriptCalls,1);
 const count=w.tasks.size;const done=await resumed.approveRun(r.id);assert.equal(done.state,'completed');assert.equal(w.tasks.size,count+1);await assert.rejects(()=>resumed.retryRun(r.id),e=>e.code==='ORCHESTRATOR_STATE');
});
test('R4 unknown publication outcomes cannot be blindly replayed',async t=>{
 const w=world(t);w.publishFailures=1;const r=await w.orch.startRun('idea-film',{ideaText:'Fixture'});const failed=await w.orch.approveRun(r.id);assert.equal(failed.state,'failed');assert.equal(failed.publishAttempted,true);const n=w.tasks.size;await assert.rejects(()=>w.orch.retryRun(r.id),e=>e.code==='ORCHESTRATOR_RECONCILE');assert.equal(w.tasks.size,n);
});
test('R4 news article without approval produces one actual local draft, never publishes an undefined video',async t=>{
 const w=world(t),cfg=w.orch.getConfig();cfg.pipelines['news-article'].requireApproval=false;w.orch.setConfig(cfg);const r=await w.orch.startRun('news-article',{cardId:'news1'});assert.equal(r.state,'completed');assert.equal(w.records.length,1);assert.equal(w.records[0].draft,true);assert.equal(w.tasks.size,0);
});
test('R4 explicit retries are bounded at three and global stop is respected',async t=>{
 const w=world(t);w.mediaFailures=10;let r=await w.orch.startRun('idea-film',{ideaText:'Fixture'});for(let i=0;i<3;i++)r=await w.orch.retryRun(r.id);await assert.rejects(()=>w.orch.retryRun(r.id),e=>e.code==='ORCHESTRATOR_RETRY_LIMIT');assert.equal(w.projects,1);assert.equal(w.scriptCalls,1);
 const cfg=w.orch.getConfig();cfg.stopAll=true;w.orch.setConfig(cfg);await assert.rejects(()=>w.orch.retryRun(r.id),e=>e.code==='ORCHESTRATOR_STOPPED');
});
test('R4 news intake requires real publication dates, topic matches and correct Vietnam date',async()=>{
 const now=Date.parse('2026-10-23T03:00:00Z'),ingest={listSources:()=>[],listCards:()=>[
 {id:'today',title:'Gold fixture',summary:'Synthetic fixture',publishedAt:'2026-10-22T18:00:00Z',link:'https://example.com/today'},
 {id:'old',title:'Gold old',publishedAt:'2026-10-22T03:00:00Z'},
 {id:'undated',title:'Gold undated',fetchedAt:'2026-10-23T03:00:00Z'},
 {id:'unrelated',title:'Sports fixture',publishedAt:'2026-10-23T01:00:00Z'}]};
 const r=await prepareNewsEvidence('tim tin tuc ve vang sang nay ngay 23/10/2026',ingest,{now});assert.deepEqual(r.cards.map(c=>c.id),['today']);assert.equal(r.date,'2026-10-23');assert.equal(newsRequest('Fix my code',now),null);assert.throws(()=>newsRequest('tin tuc 32/10/2026',now));
});
test('R4 missing news sources returns an honest host limitation without fabricating current news',async()=>{
 const e=await prepareNewsEvidence('tin tuc ve vang', {listSources:()=>[],listCards:()=>[]},{now:Date.parse('2026-10-23T03:00:00Z')});assert.equal(e.required,true);assert.equal(e.cards.length,0);assert.equal(e.scanned,0);assert.ok(e.emptyReply.includes('Radar'));
});
