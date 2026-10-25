// Real Chrome/CDP evidence, isolated data and synthetic local AI response only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
import {seed,proposal} from '../test/helpers/architecture-guard-fixtures.mjs';
const root=path.resolve(import.meta.dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'architecture-guard-ui-'));
const output=path.join(root,'docs/personal/evidence/step4');fs.mkdirSync(output,{recursive:true});
process.env.AI_PROJECT_OS_PERSONAL_DATA_DIR=path.join(temp,'data');
const freePort=async()=>{const s=http.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;};
let app,chrome,ws;
const fixture=http.createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw),system=b.messages?.[0]?.content||'',prompt=b.messages?.at(-1)?.content||'';
 let value=proposal();if(system.includes('coding worker'))value=prompt.includes('Tool result:')?{tool:'done',summary:'Fixture completed'}:prompt.includes('Compliant UI')?{tool:'write',path:'frontend/ui.css',content:'body { color: navy; }\n'}:{tool:'write',path:'api/openapi.json',content:'{}\n'};
 if(system.includes('senior reviewer'))value={approved:true,summary:'Fixture review',risks:[],fixes:[]};
 res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(value)}}]}));
});
const evidence={browser:'Google Chrome headless / CDP',fixture:'Local synthetic AI, no live credentials or user data',checks:[]};
try{
 fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
 const {unlockVault,saveConnection}=await import('../src/lib/vault.mjs');const {recordModels}=await import('../src/lib/model-bindings.mjs');
 const {createProject,updateProjectModelRoles,proposeArchitecture,confirmCouncilArchitecture,createTask,updateProjectSettings}=await import('../src/lib/projects.mjs');
 const {prepareApprovedSpecification}=await import('../test/helpers/council-fixtures.mjs');
 unlockVault('ui-evidence-fixture-only');
 const c=saveConnection({kind:'openai_compatible',name:'Local UI fixture',model:'fixture',secret:'synthetic-only',baseUrl:`http://127.0.0.1:${fixture.address().port}/v1`});recordModels(c,['fixture']);
 const p=createProject({name:'Architecture Guard · Kiểm thử PO'});prepareApprovedSpecification(p.id,{}, {architecture:false});
 const {workspaceDir}=await import('../src/lib/workspace.mjs');for(const [file,text] of Object.entries(seed)){const location=path.join(workspaceDir(p.id),file);fs.mkdirSync(path.dirname(location),{recursive:true});fs.writeFileSync(location,text);}
 const binding={connectionId:c.id,model:'fixture'};updateProjectModelRoles(p.id,{founder:binding,worker:binding,reviewer:binding});await proposeArchitecture(p.id);
 const {getProject}=await import('../src/lib/projects.mjs');const approved=getProject(p.id).architectures[0];confirmCouncilArchitecture(p.id,{architectureId:approved.id,contentHash:approved.contentHash,explicitApproval:true});updateProjectSettings(p.id,{reviewRequired:false});
 createTask(p.id,{title:'Breaking API UI',role:'frontend',description:'API fixture',doneWhen:'Guard must stop breaking contract'});
 createTask(p.id,{title:'Compliant UI',role:'frontend',description:'CSS fixture',doneWhen:'Scoped CSS passes checks'});
 const port=await freePort(),debugPort=await freePort(),token='f'.repeat(64);
 app=spawn(process.execPath,['src/server.mjs'],{cwd:root,env:{...process.env,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_LAUNCH_TOKEN:token,AI_PROJECT_OS_NO_BROWSER:'1'},stdio:'ignore'});
 async function until(fn,label){for(let i=0;i<150;i++){try{const v=await fn();if(v)return v;}catch{}await pause(100);}throw new Error('Timed out: '+label);}
 await until(async()=> (await fetch(`http://127.0.0.1:${port}/api/health`)).ok,'server');
 chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',[`--user-data-dir=${path.join(temp,'chrome')}`,`--remote-debugging-port=${debugPort}`,'--headless=new','--no-first-run','--no-default-browser-check','--disable-gpu','about:blank'],{stdio:'ignore'});
 const target=await until(async()=>{const list=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();return list.find(x=>x.type==='page');},'Chrome');
 ws=new WebSocket(target.webSocketDebuggerUrl);await once(ws,'open');let serial=0;const calls=new Map();
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const call=calls.get(msg.id);if(call){calls.delete(msg.id);msg.error?call.reject(new Error(JSON.stringify(msg.error))):call.resolve(msg.result);}}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await call('Page.navigate',{url:`http://127.0.0.1:${port}/?launch=${token}`});
 await until(()=>evaluate("typeof state!=='undefined' && state.project && document.getElementById('ideaArchitecture')?.textContent.includes('Architecture v1')"),'project boot');
 const screenshot=async(name,selector)=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start'})`);await pause(200);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name),Buffer.from(shot.data,'base64'));};
 await evaluate("api('/api/vault/unlock',{method:'POST',body:JSON.stringify({password:'ui-evidence-fixture-only'})}).then(async()=>{await vaultRefresh();await loadConnections();await chooseProject(state.project.id);page('idea');teamSelectedTask='T1';renderTasks();})");
 await until(()=>evaluate("!document.querySelector('#teamTaskDetail [data-team-action=run]').disabled"),'Worker ready');
 await evaluate("document.querySelector('#teamTaskDetail [data-team-action=run]').click()");
 await until(()=>evaluate("state.project.tasks[0].status==='architecture-blocked'"),'BLOCKED code');
 assert.equal(await evaluate("state.project.settings.reviewRequired"),false);
 assert.equal(await evaluate("document.querySelector('#teamTaskDetail').textContent.includes('PROTECTED_CONTRACT')"),true);
 await screenshot('task-blocked.png','#teamTaskDetail .architecture-panel');evidence.checks.push('Actual UI run: breaking API blocked with Reviewer disabled; runtime receipt and Change Proposal link visible');
 await evaluate("document.querySelector('[data-team-architecture-council]').click()");
 await until(()=>evaluate("document.querySelector('#councilArchitecture').textContent.includes('Architecture Change Proposals')"),'Change Proposal');
 const cpSelector='#councilArchitecture [data-change-proposal]';
 assert.equal(await evaluate(`document.querySelector(${JSON.stringify(cpSelector)})!==null`),true);
 await screenshot('council-change-proposal.png','#councilArchitecture section');evidence.checks.push('AI Council shows pending Architecture Change Proposal, findings and pinned candidate commit; no bypass approval button');
 await evaluate(`document.querySelector(${JSON.stringify(cpSelector)}).click()`);
 await until(()=>evaluate("state.project.architectures.length===2"),'new proposal');
 assert.equal(await evaluate("state.project.architectures[1].status"),'proposed');assert.equal(await evaluate("state.project.architectureChangeProposals[0].status"),'pending');evidence.checks.push('AI proposes revised architecture; original approved baseline retained and PO approval remains pending');
 await evaluate("page('idea');teamSelectedTask='T2';renderTasks();document.querySelector('#teamTaskDetail [data-team-action=run]').click()");
 await until(()=>evaluate("state.project.tasks[1].status==='done'"),'compliant change');
 assert.equal(await evaluate("state.project.tasks[1].architectureCompliance.status"),'PASS');
 await screenshot('task-pass.png','#teamTaskDetail .architecture-panel');evidence.checks.push('Actual UI run: compliant CSS PASS at coding and merge boundaries and merges with Reviewer disabled');
 const anonymous=await fetch(`http://127.0.0.1:${port}/api/projects/${p.id}/tasks/T1/architecture-bind`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(anonymous.status,401);
 const noConsent=await evaluate(`api('/api/projects/${p.id}/tasks/T1/architecture-bind',{method:'POST',body:JSON.stringify({architectureId:'${approved.id}',contentHash:'${approved.contentHash}'})}).then(()=>false,e=>e.message)`);assert.match(noConsent,/PO/);evidence.checks.push('Task binding endpoint requires browser session and explicit PO consent');
 evidence.status='PASS';fs.writeFileSync(path.join(output,'ui-results.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{
 ws?.close();chrome?.kill('SIGTERM');app?.kill('SIGTERM');fixture.close();await pause(500);fs.rmSync(temp,{recursive:true,force:true});
}
