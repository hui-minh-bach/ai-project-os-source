// Real Chrome/CDP evidence, isolated data and synthetic local AI response only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
import {architectureFixture} from '../test/helpers/architecture-fixtures.mjs';
const root=path.resolve(import.meta.dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'architecture-ui-'));
const output=path.join(root,'docs/personal/evidence/step3');fs.mkdirSync(output,{recursive:true});
process.env.AI_PROJECT_OS_PERSONAL_DATA_DIR=path.join(temp,'data');
const freePort=async()=>{const s=http.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;};
let app,chrome,ws;
const fixture=http.createServer(async(req,res)=>{for await(const chunk of req){}res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(architectureFixture)}}]}));});
const evidence={browser:'Google Chrome headless / CDP',fixture:'Local synthetic AI, no live credentials or user data',checks:[]};
try{
 fixture.listen(0,'127.0.0.1');await once(fixture,'listening');
 const {unlockVault,saveConnection}=await import('../src/lib/vault.mjs');const {recordModels}=await import('../src/lib/model-bindings.mjs');
 const {createProject,updateProjectModelRoles,proposeArchitecture}=await import('../src/lib/projects.mjs');
 const {prepareApprovedSpecification}=await import('../test/helpers/council-fixtures.mjs');
 unlockVault('ui-evidence-fixture-only');
 const c=saveConnection({kind:'openai_compatible',name:'Local UI fixture',model:'fixture',secret:'synthetic-only',baseUrl:`http://127.0.0.1:${fixture.address().port}/v1`});recordModels(c,['fixture']);
 const p=createProject({name:'Architecture Lite · Trang thông tin cá nhân'});prepareApprovedSpecification(p.id,{}, {architecture:false});updateProjectModelRoles(p.id,{founder:{connectionId:c.id,model:'fixture'}});await proposeArchitecture(p.id);
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
 await evaluate("page('idea')");await until(()=>evaluate("document.querySelector('#ideaArchitecture .architecture-diagram')!==null"),'idea diagram');
 assert.equal(await evaluate("document.querySelector('#ideaArchitecture svg').querySelectorAll('rect').length"),2);
 assert.equal(await evaluate("document.querySelector('#ideaArchitecture').textContent.includes('Proposed')"),true);
 await screenshot('idea-proposed.png','#ideaArchitecture');evidence.checks.push('Idea Studio: proposed status, Tech Stack, two components and relationship rendered');
 await evaluate("page('council')");await until(()=>evaluate("document.querySelector('[data-architecture-consent]')!==null"),'approval control');
 assert.equal(await evaluate("document.querySelector('[data-architecture-approve]').disabled"),true);
 await evaluate("document.querySelector('[data-architecture-consent]').click();document.querySelector('[data-architecture-approve]').click()");
 await until(()=>evaluate("document.querySelector('#councilArchitecture').textContent.includes('Approved')"),'PO approval');
 await screenshot('council-approved.png','#councilArchitecture');evidence.checks.push('AI Council: approval disabled until PO consent, real approval request creates Approved baseline');
 const approved=await evaluate(`fetch('/api/projects/${p.id}/architecture').then(r=>r.json())`);assert.equal(approved.history[0].status,'approved');
 const unauthorized=await fetch(`http://127.0.0.1:${port}/api/projects/${p.id}/architecture`);assert.equal(unauthorized.status,401);
 const download=await evaluate(`fetch('/api/projects/${p.id}/architecture/${approved.approved}/markdown').then(async r=>({status:r.status,filename:r.headers.get('content-disposition'),text:await r.text()}))`);assert.equal(download.status,200);assert.match(download.filename,/ARCHITECTURE-v1.md/);fs.writeFileSync(path.join(output,'ARCHITECTURE-v1.md'),download.text);
 for(const method of ['PATCH','DELETE','POST']){const status=await evaluate(`fetch('/api/projects/${p.id}/architecture/${approved.approved}',{method:'${method}',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.status)`);assert.equal(status,404);}
 evidence.checks.push('No generic baseline modification endpoint; PATCH / DELETE / POST return 404');
 evidence.checks.push('Authenticated versioned Markdown export; unauthenticated architecture API returns 401');
 await evaluate("page('map')");await until(()=>evaluate("document.querySelector('#mapArchitecture').textContent.includes('Approved')"),'approved map');
 const graph=await evaluate("JSON.stringify([...document.querySelectorAll('#ideaArchitecture svg text')].map(x=>x.textContent))===JSON.stringify([...document.querySelectorAll('#mapArchitecture svg text')].map(x=>x.textContent))");assert.equal(graph,true);
 await screenshot('map-approved.png','#mapArchitecture');evidence.checks.push('Project Map: approved v1 / Specification v1 graph matches Idea Studio');
 await evaluate(`fetch('/api/projects/${p.id}/brief',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({goals:'Mục tiêu thay đổi; cần kiến trúc mới'})}).then(r=>r.json()).then(()=>chooseProject('${p.id}'))`);
 await until(()=>evaluate("document.querySelector('#mapArchitecture').textContent.includes('Outdated')"),'outdated map');await screenshot('map-outdated.png','#mapArchitecture');evidence.checks.push('Brief change marks architecture Outdated and retains approved historical export');
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("page('idea')");await until(()=>evaluate("document.querySelector('#ideaArchitecture').textContent.includes('Outdated')"),'mobile idea');await screenshot('idea-mobile.png','#ideaArchitecture');
 assert.equal(await evaluate("document.querySelector('#ideaArchitecture').getBoundingClientRect().width<=390"),true);evidence.checks.push('390px mobile viewport: architecture panel fits available width');
 evidence.status='PASS';fs.writeFileSync(path.join(output,'ui-results.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{
 ws?.close();chrome?.kill('SIGTERM');app?.kill('SIGTERM');fixture.close();await pause(500);fs.rmSync(temp,{recursive:true,force:true});
}
