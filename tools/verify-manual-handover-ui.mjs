// Real Chrome/CDP evidence, isolated data and synthetic local AI response only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {setTimeout as pause} from 'node:timers/promises';
import {extractZipTo} from '../src/lib/updater.mjs';
import {seed,proposal} from '../test/helpers/architecture-guard-fixtures.mjs';
const root=path.resolve(import.meta.dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'deployment-handover-ui-'));
const output=path.join(root,'docs/personal/evidence/step6');fs.mkdirSync(output,{recursive:true});
process.env.AI_PROJECT_OS_PERSONAL_DATA_DIR=path.join(temp,'data');
const freePort=async()=>{const s=http.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;};
let app,chrome,ws;
const fixture=http.createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw),system=b.messages?.[0]?.content||'',prompt=b.messages?.at(-1)?.content||'';
 let value=proposal();value.overview='Website tĩnh do Agent tạo, không có backend hay database.';value.components=[{id:'user',name:'Người dùng',responsibility:'Đọc trang',boundary:'Trình duyệt'},{id:'frontend',name:'Website tĩnh',responsibility:'Hiển thị nội dung',boundary:'File static trong root và frontend/'}];value.relationships=[{from:'user',to:'frontend',contract:'HTTP GET static files'}];value.compliancePolicy.modules=[{componentId:'frontend',paths:['.'],allowedImports:[]}];value.deploymentSupport={targets:['not-specified','local-only','cloud-manual'],rationale:'Artifact static có thể chạy cục bộ và được người quản trị đưa lên static hosting thủ công, không đổi runtime hoặc dữ liệu.'};const packageText=JSON.stringify({type:'module',dependencies:{},scripts:{test:'node -e \"process.exit(0)\"'}});value.compliancePolicy.protectedFiles.push({path:'package.json',kind:'config',sha256:crypto.createHash('sha256').update(packageText).digest('hex')});if(system.includes('coding worker'))value=prompt.includes('Tool result:')?{tool:'done',summary:'Fixture completed'}:prompt.includes('Fix UI')?{tool:'write',path:'frontend/fix.css',content:'p { color: navy; }\n'}:{tool:'write',path:'frontend/feature.css',content:'body { color: navy; }\n'};
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
 const p=createProject({name:'Ứng dụng Agent · Bàn giao thủ công'});prepareApprovedSpecification(p.id,{}, {architecture:false});
 const {workspaceDir}=await import('../src/lib/workspace.mjs');for(const [file,text] of Object.entries({'index.html':'<!doctype html><html><head><link rel="stylesheet" href="frontend/feature.css"><link rel="stylesheet" href="frontend/fix.css"></head><body><h1>Agent-built static application</h1></body></html>','package.json':JSON.stringify({type:'module',dependencies:{},scripts:{test:'node -e \"process.exit(0)\"'}})})){const location=path.join(workspaceDir(p.id),file);fs.mkdirSync(path.dirname(location),{recursive:true});fs.writeFileSync(location,text);}
 const binding={connectionId:c.id,model:'fixture'};updateProjectModelRoles(p.id,{founder:binding,worker:binding,reviewer:binding});await proposeArchitecture(p.id);
 const {getProject}=await import('../src/lib/projects.mjs');const approved=getProject(p.id).architectures[0];confirmCouncilArchitecture(p.id,{architectureId:approved.id,contentHash:approved.contentHash,explicitApproval:true});updateProjectSettings(p.id,{reviewRequired:false,sandboxMode:'host'});
 createTask(p.id,{title:'Feature UI',role:'frontend',description:'Feature fixture',doneWhen:'Feature stylesheet has correct color'});
 createTask(p.id,{title:'Fix UI',role:'frontend',description:'CSS fixture',doneWhen:'Fix stylesheet has correct color'});
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
 await evaluate("api('/api/vault/unlock',{method:'POST',body:JSON.stringify({password:'ui-evidence-fixture-only'})}).then(async()=>{await vaultRefresh();await loadConnections();await chooseProject(state.project.id);page('map');})");
 await evaluate("page('idea');if(document.getElementById('ideaBriefForm').offsetParent===null)document.getElementById('ideaFormToggle').click();document.getElementById('ideaDeploymentTarget').value='local-only';document.getElementById('ideaDeploymentTarget').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('ideaBriefForm').requestSubmit()");
 await until(()=>evaluate("state.project.deploymentTarget==='local-only'&&!ideaBusy"),'idea deployment target');assert.equal(await evaluate('state.project.productType'),'website');assert.equal(await evaluate('state.project.architectures.length'),1);await screenshot('idea-target-dark.png','#ideaDeploymentTarget');evidence.checks.push('Idea stage: optional Deployment Target saved separately from Application Type, compatible change retains approved architecture');
 await evaluate("page('map')");await until(()=>evaluate("deploymentUi.data?.target==='local-only'"),'Project Settings target');
 await evaluate("(()=>{const form=document.querySelector('[data-deployment-settings]');form.closest('details').open=true;form.elements.deploymentTarget.value='on-premises';form.requestSubmit()})()");
 await until(()=>evaluate("deploymentUi.data?.target==='on-premises'&&deploymentUi.data.impact.status==='review-required'"),'target impact review');await screenshot('target-impact-review.png','#projectDeploymentSettings');
 await evaluate("(()=>{const form=document.querySelector('[data-deployment-impact]');form.elements.material.value='false';form.elements.rationale.value='Website tĩnh không đổi runtime, không có database; quản trị viên cung cấp HTTP/TLS thủ công và kiểm soát mạng theo quy tắc đã duyệt.';form.elements.consent.checked=true;form.requestSubmit()})()");
 await until(()=>evaluate("deploymentUi.data?.target==='on-premises'&&deploymentUi.data.impact.status==='compatible'"),'PO non-material impact');assert.equal(await evaluate('state.project.architectures.length'),1);assert.equal(await evaluate('state.project.architectures[0].contentHash'),approved.contentHash);assert.equal(await evaluate("document.getElementById('ideaDeploymentTarget').value"),'on-premises');evidence.checks.push('Project Map settings use the same canonical target; explicit PO non-material impact decision preserves the architecture baseline and updates Idea field');
 await until(()=>evaluate("document.querySelector('[data-release-create]')!==null"),'release panel');
 await evaluate("(()=>{document.querySelector('.release-create').open=true;const form=document.querySelector('[data-release-create]');form.elements.version.value='v0.1.0';form.elements.title.value='Bản đầu tiên';form.elements.knownIssues.value='Chưa kiểm tra trên mọi thiết bị';form.elements.limitations.value='Dữ liệu fixture, chưa triển khai thực tế';form.requestSubmit()})()");
 await until(()=>evaluate("releaseUi.data?.releases.length===1&&!releaseUi.busy"),'release created');
 const releaseId=await evaluate('releaseUi.selected');
 await evaluate("(()=>{const form=document.querySelector('[data-release-tasks]');form.closest('details').open=true;form.querySelectorAll('input[name=task]').forEach(x=>x.checked=true);form.querySelectorAll('[data-release-kind]')[1].value='fix';form.requestSubmit()})()");
 await until(()=>evaluate("releaseUi.data.releases[0].progress.total===2&&!releaseUi.busy"),'tasks assigned');
 await screenshot('release-scope.png','#projectReleases');evidence.checks.push('Project Map: create v0.1.0 and assign two existing tasks as feature/fix; zero verified completion');
 const runTaskUi=async taskId=>{await evaluate(`page('idea');teamSelectedTask='${taskId}';renderTasks();document.querySelector('#teamTaskDetail [data-team-action=run]').click()`);await until(()=>evaluate(`state.project.tasks.find(t=>t.id==='${taskId}').status==='done'`),'task '+taskId);};
 await runTaskUi('T1');await evaluate("page('map')");await until(()=>evaluate("releaseUi.data?.releases[0].progress.built===1"),'partial progress');
 await evaluate("document.querySelector('[data-release-notes]').click()");await until(()=>evaluate("releaseUi.data.releases[0].notesHistory.length===1&&!releaseUi.busy"),'notes revision 1');
 const initialNote=await evaluate('releaseUi.data.releases[0].notesHistory[0].id');
 const initialNotes=await evaluate(`fetch('/api/projects/${p.id}/releases/${releaseId}/notes/${initialNote}/markdown').then(r=>r.text())`);
 assert.match(initialNotes,/Feature UI/);assert.doesNotMatch(initialNotes.split('## Sửa lỗi có bằng chứng build')[1].split('## ')[0],/Fix UI/);fs.writeFileSync(path.join(output,'RELEASE-NOTES-v0.1.0-r1.md'),initialNotes);evidence.checks.push('Partial Release Notes: verified feature included, unfinished fix excluded from completed items');
 await runTaskUi('T2');await evaluate("page('map')");await until(()=>evaluate("releaseUi.data?.releases[0].progress.tested===2"),'runtime tests');
 assert.equal(await evaluate('releaseUi.data.releases[0].status'),'tested');assert.equal(await evaluate('releaseUi.data.releases[0].deployment'),null);
 await screenshot('release-tested.png','#projectReleases');evidence.checks.push('Actual Native Workers and npm tests: Build Complete and Tested true, handover/deployed remain false without PO acceptance');
 for(let i=0;i<2;i++){
  await evaluate("(()=>{const form=document.querySelector('[data-release-acceptance]');form.closest('details').open=true;form.querySelectorAll('input[name=criterion]:not(:disabled)').forEach(x=>x.checked=true);form.elements.evidence.value='PO kiểm tra màu CSS trong fixture và đối chiếu tiêu chí nghiệm thu.';form.elements.consent.checked=true;form.requestSubmit()})()");
  await until(()=>evaluate(`releaseUi.data.releases[0].progress.accepted===${i+1}&&!releaseUi.busy`),'PO acceptance');
 }
 await evaluate("(()=>{const form=document.querySelector('[data-release-handover]');form.elements.consent.checked=true;form.requestSubmit()})()");
 await until(()=>evaluate("releaseUi.data.releases[0].frozen===true&&!releaseUi.busy"),'frozen handover');assert.equal(await evaluate('releaseUi.data.releases[0].deployment'),null);evidence.checks.push('PO acceptance of existing task criteria and explicit handover freeze immutable release evidence; no automatic Deployed');
 await evaluate("document.querySelector('[data-release-package]').requestSubmit()");
 await until(()=>evaluate("releaseUi.data.releases[0].manualHandoverPackages?.at(-1)?.status==='READY'&&!releaseUi.busy"),'actual handover archive');
 const packageRecord=await evaluate('releaseUi.data.releases[0].manualHandoverPackages.at(-1)');assert.equal(packageRecord.deploymentTarget,'on-premises');assert.equal(await evaluate('releaseUi.data.releases[0].deployment'),null);
 await evaluate("document.querySelector('.manual-handover details').open=true");await screenshot('handover-ready-dark.png','.manual-handover');evidence.checks.push('Actual UI package request creates a verified static artifact ZIP from frozen release commit; Deployed remains unconfirmed');
 const archive=await evaluate(`fetch('/api/projects/${p.id}/releases/${releaseId}/manual-handover/${packageRecord.id}/archive').then(async r=>({status:r.status,base64:btoa(String.fromCharCode(...new Uint8Array(await r.arrayBuffer())))}))`);assert.equal(archive.status,200);const archiveBytes=Buffer.from(archive.base64,'base64');assert.equal(crypto.createHash('sha256').update(archiveBytes).digest('hex'),packageRecord.archiveHash);fs.writeFileSync(path.join(output,'HANDOVER-v0.1.0.zip'),archiveBytes);
 const extracted=path.join(temp,'downloaded-application');extractZipTo(archiveBytes,extracted);for(const file of ['app/index.html','config.example.json','VERSION.json','TEST-RESULTS.json','INSTALL-RUN.md','RELEASE-NOTES.md','ROLLBACK.md'])assert.equal(fs.existsSync(path.join(extracted,file)),true);
 const previewPort=await freePort(),preview=spawn(process.execPath,['preview.mjs',String(previewPort)],{cwd:extracted,stdio:'ignore'});try{const response=await until(async()=>{try{const r=await fetch(`http://127.0.0.1:${previewPort}/`);return r.ok?r:null;}catch{return null;}},'downloaded application preview');assert.match(await response.text(),/Agent-built static application/);assert.equal((await fetch(`http://127.0.0.1:${previewPort}/frontend/feature.css`)).status,200);}finally{preview.kill('SIGTERM');await Promise.race([once(preview,'exit'),pause(1000)]);}
 evidence.checks.push('Downloaded ZIP was hash-checked, extracted and actually run on loopback; artifact/config/version/test results/install guide/release notes/rollback present');
 await evaluate("document.documentElement.setAttribute('data-theme','arctic')");await screenshot('handover-ready-light.png','.manual-handover');await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await screenshot('handover-mobile.png','.manual-handover');assert.equal(await evaluate("document.getElementById('projectDeploymentSettings').getBoundingClientRect().width<=390"),true);evidence.checks.push('Project Settings and handover use current light/dark styles and responsive 390px viewport');
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 await evaluate("(()=>{const form=document.querySelector('[data-deployment-settings]');form.closest('details').open=true;form.elements.deploymentTarget.value='windows-desktop';form.requestSubmit()})()");await until(()=>evaluate("deploymentUi.data?.impact.status==='architecture-required'&&releaseUi.data?.releases[0].deploymentImpact.blocked"),'material target decision');assert.equal(await evaluate("document.querySelector('[data-release-package] button').disabled"),true);assert.equal(await evaluate('releaseUi.data.releases[0].manualHandoverPackages[0].archiveHash'),packageRecord.archiveHash);assert.equal(await evaluate('releaseUi.data.releases[0].deployment'),null);await screenshot('target-material-blocked.png','#projectDeploymentSettings');evidence.checks.push('Windows runtime change requires new architecture decision, disables new packaging, preserves historical archive and does not create installer or deployment');
 evidence.status='PASS';fs.writeFileSync(path.join(output,'ui-results.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{
 ws?.close();chrome?.kill('SIGTERM');app?.kill('SIGTERM');fixture.close();await pause(500);fs.rmSync(temp,{recursive:true,force:true});
}
