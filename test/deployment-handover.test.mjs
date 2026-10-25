import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
import {manualHandoverFixture} from './helpers/manual-handover-fixtures.mjs';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
const runtime=isolatedRuntime('manual-handover');after(()=>runtime.cleanup());
const projects=await runtime.import('src/lib/projects.mjs');
const {readJson,writeJson}=await runtime.import('src/lib/store.mjs');
const {prepareTaskPlan,prepareApprovedSpecification,prepareApprovedArchitecture}=await runtime.import('test/helpers/council-fixtures.mjs');
const {approvedArchitecture,architectureMarkdown}=await runtime.import('src/lib/project-architecture.mjs');
const {deploymentImpact}=await runtime.import('src/lib/deployment-target.mjs');
const {workspaceDir}=await runtime.import('src/lib/workspace.mjs');
const {must}=await runtime.import('src/lib/shell.mjs');
const {listZipEntries,extractZipTo}=await runtime.import('src/lib/updater.mjs');
const {HANDOVER_ADAPTERS}=await runtime.import('src/lib/manual-handover.mjs');
function edit(id,fn){const list=readJson('projects.json',[]);fn(list.find(p=>p.id===id));writeJson('projects.json',list);}
const support={targets:['not-specified','local-only','on-premises','cloud-manual'],rationale:'Website tĩnh không có backend, DB hoặc credential; giữ cùng static artifacts và dùng hướng dẫn server/TLS thủ công ở đích.'};
const fixture=manualHandoverFixture({projects,readJson,writeJson,prepareTaskPlan,workspaceDir,must});

test('Deployment Target is optional, independent of Application Type, and uses the same canonical setting from idea/settings',()=>{
 const p=projects.createProject({name:'Idea',productType:'desktop-app'});assert.equal(p.deploymentTarget,'not-specified');projects.updateProjectBrief(p.id,{deploymentTarget:'cloud-manual'});let current=projects.getProject(p.id);assert.equal(current.productType,'desktop-app');assert.equal(current.deploymentTarget,'cloud-manual');assert.equal(current.briefRevision,0);
 projects.updateProjectSettings(p.id,{deploymentTarget:'local-only'});current=projects.getProject(p.id);assert.equal(current.deploymentTarget,'local-only');assert.equal(current.productType,'desktop-app');assert.equal(current.settings.deploymentTarget,undefined);assert.equal(current.deploymentTargetHistory.length,2);assert.throws(()=>projects.updateProjectSettings(p.id,{deploymentTarget:'auto-vercel'}),/không hợp lệ/);
});
test('declared compatible targets require no new architecture baseline; material desktop change cannot be waived',()=>{
 const p=projects.createProject({name:'Target impact',deploymentTarget:'local-only'});prepareApprovedSpecification(p.id,{}, {architecture:false});prepareApprovedArchitecture(p.id,{deploymentSupport:support});const original=JSON.stringify(projects.getProject(p.id).architectures[0]),s=projects.getProject(p.id).approvedSpecificationId;
 projects.updateProjectSettings(p.id,{deploymentTarget:'cloud-manual'});let current=projects.getProject(p.id);assert.equal(deploymentImpact(current).status,'compatible');assert.equal(approvedArchitecture(current).version,1);assert.equal(current.approvedSpecificationId,s);assert.equal(JSON.stringify(current.architectures[0]),original);
 projects.updateProjectSettings(p.id,{deploymentTarget:'windows-desktop'});current=projects.getProject(p.id);assert.equal(deploymentImpact(current).status,'architecture-required');assert.throws(()=>approvedArchitecture(current),/Deployment Target/);assert.throws(()=>projects.confirmProjectDeploymentImpact(p.id,{explicitApproval:true,revision:current.deploymentTargetRevision,architectureId:current.approvedArchitectureId,architectureHash:current.architectures[0].contentHash,material:false,rationale:'Attempt to waive a required desktop decision.'}),/không còn/);
 prepareApprovedArchitecture(p.id);current=projects.getProject(p.id);assert.equal(approvedArchitecture(current).version,2);assert.match(architectureMarkdown(approvedArchitecture(current)),/windows-desktop/);assert.equal(JSON.stringify(current.architectures[0]),original);
});
test('uncertain changes need an explicit PO impact assessment; non-material decisions do not rewrite architecture',()=>{
 const p=projects.createProject({name:'Review target',deploymentTarget:'local-only'});prepareApprovedSpecification(p.id);const a=approvedArchitecture(projects.getProject(p.id));projects.updateProjectSettings(p.id,{deploymentTarget:'on-premises'});let current=projects.getProject(p.id),impact=deploymentImpact(current);assert.equal(impact.status,'review-required');assert.throws(()=>approvedArchitecture(current),/Deployment Target/);
 const body={revision:impact.revision,architectureId:a.id,architectureHash:a.contentHash,material:false,rationale:'Static application remains unchanged; administrator supplies existing HTTP/TLS service and no application runtime or database changes.'};assert.throws(()=>projects.confirmProjectDeploymentImpact(p.id,body),/PO/);projects.confirmProjectDeploymentImpact(p.id,{...body,explicitApproval:true});current=projects.getProject(p.id);assert.equal(approvedArchitecture(current).id,a.id);assert.equal(deploymentImpact(current).status,'compatible');assert.equal(current.architectures.length,1);
 projects.updateProjectSettings(p.id,{deploymentTarget:'cloud-manual'});assert.throws(()=>projects.confirmProjectDeploymentImpact(p.id,{...body,explicitApproval:true}),/không còn/);
});
test('verified static handover includes required files from the immutable release commit, no deploy, no environment dependencies',async()=>{
 const f=await fixture({files:{'pixel.png':Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM9sAAAAASUVORK5CYII=','base64')}});fs.writeFileSync(path.join(f.cwd,'index.html'),'DIRTY WORKSPACE MUST NOT BE PACKAGED');fs.writeFileSync(path.join(f.cwd,'.env'),'PASSWORD=must-not-copy');const r=await f.build();assert.equal(r.status,'READY',r.message);assert.equal(r.validation.executedProjectCode,false);assert.equal(f.get().releases[0].deployment,undefined);assert.equal(r.artifactCommit,f.merge);
 const archive=projects.projectManualHandoverArchive(f.id,f.releaseId,r.id),names=listZipEntries(archive.data).map(e=>e.name);for(const expected of ['app/index.html','app/style.css','config.example.json','VERSION.json','TEST-RESULTS.json','INSTALL-RUN.md','RELEASE-NOTES.md','ROLLBACK.md','SHA256SUMS.json','preview.mjs'])assert.ok(names.includes(expected));assert.ok(!names.some(n=>n.includes('.env')||n.includes('vault')||n.includes('node_modules')));
 const extracted=path.join(runtime.root,'extracted-'+r.id);extractZipTo(archive.data,extracted);assert.match(fs.readFileSync(path.join(extracted,'app/index.html'),'utf8'),/Verified static artifact/);assert.doesNotMatch(fs.readFileSync(path.join(extracted,'config.example.json'),'utf8'),/PASSWORD|must-not-copy/);assert.match(fs.readFileSync(path.join(extracted,'TEST-RESULTS.json'),'utf8'),/fixture-test/);assert.match(fs.readFileSync(path.join(extracted,'VERSION.json'),'utf8'),new RegExp(f.merge));assert.match(fs.readFileSync(path.join(extracted,'preview.mjs'),'utf8'),/'127.0.0.1'/);
 const listener=net.createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r));
 const preview=spawn(process.execPath,['preview.mjs',String(port)],{cwd:extracted,stdio:'ignore'});
 try{let response;for(let i=0;i<70;i++){try{response=await fetch(`http://127.0.0.1:${port}/`);if(response.ok)break;}catch{}await pause(50);}assert.equal(response?.status,200);assert.match(await response.text(),/Verified static artifact/);assert.equal((await fetch(`http://127.0.0.1:${port}/style.css`)).status,200);assert.equal((await fetch(`http://127.0.0.1:${port}/pixel.png`)).status,200);assert.equal((await fetch(`http://127.0.0.1:${port}/`,{method:'POST'})).status,405);
  if(process.platform!=='win32'){fs.writeFileSync(path.join(extracted,'private.txt'),'private fixture outside app');fs.symlinkSync(path.join(extracted,'private.txt'),path.join(extracted,'app/leak.txt'));assert.equal((await fetch(`http://127.0.0.1:${port}/leak.txt`)).status,404);}
 }finally{preview.kill('SIGTERM');await Promise.race([once(preview,'exit'),pause(1000)]);}

});
test('manual on-premises/cloud packages stay local and preserve existing optional cloud settings',async()=>{
 for(const target of ['on-premises','cloud-manual','not-specified']){const f=await fixture({target});projects.saveProjectGithub(f.id,{fullName:'untouched/repository'});projects.saveProjectDomain(f.id,{domain:'example.test',deploymentUrl:'https://example.test'});const record=await f.build();assert.equal(record.status,'READY',record.message);assert.equal(f.get().settings.github.fullName,'untouched/repository');assert.equal(f.get().releases[0].deployment,undefined);}
});
test('Windows Desktop and unknown adapters report UNSUPPORTED, no fake installer or package archive',async()=>{
 const f=await fixture({target:'windows-desktop'});const r=await f.build();assert.equal(r.status,'UNSUPPORTED');assert.equal(r.archiveHash,undefined);assert.throws(()=>projects.projectManualHandoverArchive(f.id,f.releaseId,r.id),/chưa sẵn sàng/);const other=await f.build('electron-unverified');assert.equal(other.status,'UNSUPPORTED');assert.equal(f.get().releases[0].deployment,undefined);
});
test('framework/build scripts are not executed; packaging unsupported technologies does not bypass Safe mode',async()=>{
 const f=await fixture({files:{'package.json':JSON.stringify({scripts:{build:'touch SHOULD_NEVER_RUN'},dependencies:{react:'*'}})}});const r=await f.build();assert.equal(r.status,'UNSUPPORTED');assert.equal(fs.existsSync(path.join(f.cwd,'SHOULD_NEVER_RUN')),false);assert.equal(f.get().settings.sandboxMode,'safe');
});
for(const [label,options,expected] of [
 ['unquoted missing asset',{files:{'index.html':'<html><img src=missing.png></html>'}},'UNSUPPORTED'],
 ['missing asset',{files:{'index.html':'<html><img src="missing.png"></html>'}},'UNSUPPORTED'],
 ['secret in artifact',{files:{'index.html':'<html><script>const apiKey = "private-credential-do-not-export";</script></html>'}},'BLOCKED'],
 ['secret in release notes',{notes:['apiKey = "private-credential-do-not-export"']},'BLOCKED'],
 ['credential profile',{files:{'account-profiles/account/auth.json':'{\"token\":\"stored-credential\"}'}},'BLOCKED'],
 ['tracked secret path',{files:{'.env':'password=do-not-export'}},'BLOCKED'],
 ['server runtime',{files:{'server.py':'print("Do not execute")'}},'UNSUPPORTED'],
 ['not the AI Project OS installer',{files:{'package.json':'{"name":"ai-project-os-personal"}'}},'BLOCKED'],
 ['external resource',{files:{'index.html':'<script src="https://cdn.example.test/runtime.js"></script>'}},'UNSUPPORTED']
])test(label+' cannot produce a successful handover',async()=>{const f=await fixture(options),record=await f.build();assert.equal(record.status,expected,record.message);assert.equal(record.archiveHash,undefined);});
test('unapproved handover, stale target revision and caller-supplied commands fail safely',async()=>{
 const draft=await fixture({freeze:false});assert.equal((await draft.build()).status,'BLOCKED');const f=await fixture();projects.updateProjectSettings(f.id,{deploymentTarget:'cloud-manual'});assert.equal((await f.build('static-web-v1',{targetRevision:0})).status,'BLOCKED');await assert.rejects(f.build('static-web-v1',{command:'curl example.test'}),/không nhận command/);
});
test('history is immutable, archives are hash-verified, and configured target changes do not rewrite old packages',async()=>{
 const f=await fixture(),r=await f.build();assert.equal(r.status,'READY');const before=JSON.stringify(f.get().releases[0].manualHandoverPackages[0]);projects.updateProjectSettings(f.id,{deploymentTarget:'cloud-manual'});const next=await f.build();assert.equal(next.status,'READY');assert.equal(next.deploymentTarget,'cloud-manual');assert.equal(JSON.stringify(f.get().releases[0].manualHandoverPackages[0]),before);assert.ok(projects.projectManualHandoverArchive(f.id,f.releaseId,r.id).data.length);
 edit(f.id,p=>p.releases[0].manualHandoverPackages[0].archiveHash='0'.repeat(64));assert.throws(()=>projects.projectManualHandoverArchive(f.id,f.releaseId,r.id),/bị sửa/);assert.equal(Object.isFrozen(HANDOVER_ADAPTERS),true);
});
