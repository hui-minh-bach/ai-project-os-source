import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
const runtime=isolatedRuntime('release-management');after(()=>runtime.cleanup());
const projects=await runtime.import('src/lib/projects.mjs');
const {readJson,writeJson}=await runtime.import('src/lib/store.mjs');
const {prepareTaskPlan,prepareApprovedSpecification,prepareApprovedArchitecture}=await runtime.import('test/helpers/council-fixtures.mjs');
const {workspaceDir}=await runtime.import('src/lib/workspace.mjs');
const {must}=await runtime.import('src/lib/shell.mjs');
const {releaseVersion}=await runtime.import('src/lib/project-releases.mjs');
function edit(id,fn){const ps=readJson('projects.json',[]);fn(ps.find(p=>p.id===id));writeJson('projects.json',ps);}
const task=(id='T1')=>({id,title:'Task '+id,role:'frontend',description:'Feature '+id,status:'todo',dependsOn:[],doneWhen:'CSS is correct',engineId:'native'});
async function fixture({complete=true,testStatus='PASS',reviewRequired=false,accept=false}={}){
 const p=projects.createProject({name:'Release contract'});prepareTaskPlan(p.id,[task(),task('T2')]);
 const cwd=workspaceDir(p.id),git=args=>must('git',args,{cwd});await git(['init','-b','main']);await git(['config','user.name','Release Fixture']);await git(['config','user.email','fixture@example.test']);
 fs.writeFileSync(path.join(cwd,'index.html'),'<h1>Fixture</h1>\n');await git(['add','.']);await git(['commit','-m','baseline']);
 const base=(await git(['rev-parse','HEAD'])).stdout.trim();await git(['checkout','-b','fixture-work']);fs.writeFileSync(path.join(cwd,'style.css'),'body { color: navy; }\n');await git(['add','.']);await git(['commit','-m','fixture work']);const worker=(await git(['rev-parse','HEAD'])).stdout.trim();await git(['checkout','main']);await git(['merge','--no-ff','--no-edit','fixture-work']);const merge=(await git(['rev-parse','HEAD'])).stdout.trim();
 if(complete)edit(p.id,p=>{const t=p.tasks[0],s=p.specifications[0],ref=t.architectureReference,runId='fixture-release-run';t.status='done';t.mergeSha=merge;t.commitSha=worker;
  t.executionRuns=[{id:runId,planId:t.planId,specificationId:t.specificationId,requirementsVersion:s.version,requirementsHash:s.approvedRequirementsHash,architectureReference:structuredClone(ref),architectureHash:ref.architectureHash,status:'done',outcome:'done',settings:{reviewRequired},commitSha:worker,mergeSha:merge,commits:[{sha:worker}],testReceipts:[{id:'runtime-test-fixture',source:'runtime',kind:'test',status:testStatus,exitCode:testStatus==='PASS'?0:testStatus==='FAIL'?1:null,completedAt:new Date().toISOString(),script:'test'}],architectureReceipts:[{id:'guard-fixture',source:'runtime',kind:'architecture-compliance',stage:'merge-result',targetSha:merge,reference:ref,status:'PASS',findings:[]}],reviews:[reviewRequired?{status:'APPROVED',approved:true,acceptance:accept?[{criterionId:'AC1',met:true,explanation:'Fixture checks exact CSS'}]:[]}:{status:'SKIPPED',approved:null}]}];
  if(accept)t.acceptanceCriteria[0]={...t.acceptanceCriteria[0],status:'met',source:'reviewer',evidence:{runId}};
 });
 projects.createProjectRelease(p.id,{version:'v0.1.0',title:'First release',knownIssues:['Known fixture issue'],limitations:['Fixture limitation']});const r=projects.getProject(p.id).releases[0];projects.assignProjectReleaseTasks(p.id,r.id,{tasks:[{taskId:'T1',planId:projects.getProject(p.id).planId,kind:'feature'}]});
 return {id:p.id,releaseId:r.id,base,worker,merge,cwd,git,get:()=>projects.getProject(p.id),view:()=>projects.viewProjectRelease(p.id,r.id)};
}
async function acceptAndFreeze(f){let d=await f.view();if(!d.items[0].accepted){await projects.projectReleaseEvidenceAction(f.id,f.releaseId,'acceptance',{explicitApproval:true,evidenceHash:d.evidenceHash,taskKey:d.items[0].key,criterionIds:['AC1'],evidence:'PO inspected CSS fixture and checked acceptance.'});d=await f.view();}await projects.projectReleaseEvidenceAction(f.id,f.releaseId,'handover',{explicitApproval:true,evidenceHash:d.evidenceHash});return f.view();}

test('first-edition projects have no baseline bypass; release creation requires explicit approved Specification and Architecture',async()=>{
 const p=projects.createProject({name:'First edition'});assert.throws(()=>projects.createProjectRelease(p.id,{version:'v0.1.0'}),/specification/);prepareApprovedSpecification(p.id,{}, {architecture:false});
 edit(p.id,p=>{p.architectureRequired=false;});assert.throws(()=>projects.createProjectRelease(p.id,{version:'v0.1.0'}),/Architecture/);await assert.rejects(projects.buildPlan(p.id),/Architecture/);assert.equal(projects.getProject(p.id).architectures.length,0);
 prepareApprovedArchitecture(p.id);projects.createProjectRelease(p.id,{version:'v0.1.0'});assert.equal(projects.getProject(p.id).releases[0].source.architectureVersion,1);
});
test('release version validation, unique versions, task association and baseline references use stable plan/task keys',async()=>{
 const f=await fixture();assert.equal(releaseVersion('1.0.0'),'v1.0.0');for(const invalid of ['v1','v01.0.0','v1.0.0<script>','1.0.0-beta'])assert.throws(()=>releaseVersion(invalid));
 assert.throws(()=>projects.createProjectRelease(f.id,{version:'0.1.0'}),/tồn tại/);projects.createProjectRelease(f.id,{version:'v1.0.0'});const next=f.get().releases[1];assert.throws(()=>projects.assignProjectReleaseTasks(f.id,next.id,{tasks:[{taskId:'T1',planId:f.get().planId,kind:'feature'}]}),/khác/);
 const view=await f.view();assert.equal(view.source.specificationVersion,1);assert.equal(view.source.architectureVersion,1);assert.equal(view.progress.total,1);assert.equal(view.progress.built,1);assert.equal(view.items[0].mergeSha,f.merge);
 edit(f.id,p=>p.tasks[1].architectureReference.architectureVersion=99);assert.throws(()=>projects.assignProjectReleaseTasks(f.id,next.id,{tasks:[{taskId:'T2',planId:f.get().planId,kind:'feature'}]}),/khớp/);
});
test('planned/unverified items never count complete from status, fake Git SHA or agent messages',async()=>{
 const f=await fixture({complete:false});let d=await f.view();assert.equal(d.progress.percent,0);assert.equal(d.milestones.buildComplete,false);
 edit(f.id,p=>{p.tasks[0].status='done';p.tasks[0].summary='All tests passed and deployed successfully';p.tasks[0].mergeSha='a'.repeat(40);});d=await f.view();assert.equal(d.progress.built,0);assert.equal(d.milestones.tested,false);assert.equal(d.deployment,null);
 const built=await fixture();edit(built.id,p=>{p.tasks[0].mergeSha='a'.repeat(40);p.tasks[0].executionRuns[0].mergeSha='a'.repeat(40);p.tasks[0].executionRuns[0].architectureReceipts[0].targetSha='a'.repeat(40);});assert.equal((await built.view()).progress.built,0);
});
test('Build Complete, Tested, Ready for Handover and Deployed remain separate; runtime test and PO acceptance are required',async()=>{
 const f=await fixture({testStatus:'NOT_RUN'});let d=await f.view();assert.equal(d.status,'build_complete');assert.equal(d.milestones.buildComplete,true);assert.equal(d.milestones.tested,false);assert.equal(d.milestones.readyForHandover,false);
 await assert.rejects(projects.projectReleaseEvidenceAction(f.id,f.releaseId,'handover',{explicitApproval:true,evidenceHash:d.evidenceHash}),/Chưa đủ/);
 edit(f.id,p=>{const t=p.tasks[0].executionRuns[0].testReceipts[0];t.status='PASS';t.exitCode=0;});d=await f.view();assert.equal(d.status,'tested');assert.equal(d.milestones.readyForHandover,false);
 await assert.rejects(projects.projectReleaseEvidenceAction(f.id,f.releaseId,'acceptance',{explicitApproval:false,evidenceHash:d.evidenceHash,taskKey:d.items[0].key,criterionIds:['AC1'],evidence:'Checked fixture'}),/PO/);
 d=await acceptAndFreeze(f);assert.equal(d.status,'ready_for_handover');assert.equal(d.frozen,true);assert.equal(d.milestones.deployed,false);
 assert.throws(()=>projects.confirmProjectReleaseDeployment(f.id,f.releaseId,{explicitApproval:false,snapshotHash:d.contentHash,target:'https://example.test',evidence:'PO checked release target.'}),/PO/);
 projects.confirmProjectReleaseDeployment(f.id,f.releaseId,{explicitApproval:true,snapshotHash:d.contentHash,target:'https://example.test',evidence:'PO checked the actual deployment target for this commit.'});d=await f.view();assert.equal(d.status,'deployed');assert.equal(d.milestones.deployed,true);assert.equal(d.deployment.source,'product-owner');assert.equal(d.deployment.artifactCommit,f.merge);
 assert.throws(()=>projects.confirmProjectReleaseDeployment(f.id,f.releaseId,{explicitApproval:true,snapshotHash:d.contentHash,target:'https://other.test',evidence:'Change previous deployment.'}),/lịch sử/);
});
test('failed/latest tests, external exit receipts, missing review, BLOCKED guard and altered criteria cannot fabricate readiness',async()=>{
 for(const change of [
 p=>{p.tasks[0].executionRuns[0].testReceipts.push({source:'runtime',kind:'command',script:'build',status:'FAIL',exitCode:1});},
 p=>{p.tasks[0].executionRuns[0].testReceipts.push({source:'runtime',kind:'test',status:'FAIL',exitCode:1});},
 p=>{p.tasks[0].executionRuns[0].testReceipts=[{source:'runtime',kind:'external-command',status:'PASS',exitCode:0}];},
 p=>{p.tasks[0].executionRuns[0].testReceipts[0].source='agent';},
 p=>{p.tasks[0].executionRuns[0].testReceipts[0].exitCode=null;},
 p=>{p.tasks[0].executionRuns[0].reviews=[];},
 p=>{p.tasks[0].executionRuns[0].architectureReceipts[0].status='BLOCKED';},
 p=>{p.tasks[0].acceptanceCriteria[0].text='Different criterion after approval';}
 ]){const f=await fixture({reviewRequired:true,accept:true});assert.equal((await f.view()).milestones.readyForHandover,true);edit(f.id,change);assert.equal((await f.view()).milestones.readyForHandover,false);}
});
test('notes contain only verified features/fixes and persist immutable revisions with known issues, tests and limitations',async()=>{
 const f=await fixture();projects.assignProjectReleaseTasks(f.id,f.releaseId,{tasks:[{taskId:'T1',planId:f.get().planId,kind:'fix'},{taskId:'T2',planId:f.get().planId,kind:'feature'}]});
 await projects.projectReleaseEvidenceAction(f.id,f.releaseId,'notes',{});const r=f.get().releases[0],note=projects.projectReleaseNote(f.id,f.releaseId,r.notesHistory[0].id);
 assert.match(note.markdown,/Sửa lỗi có bằng chứng build/);assert.match(note.markdown,new RegExp(f.merge));assert.match(note.markdown,/runtime-test-fixture/);assert.match(note.markdown,/Known fixture issue/);assert.match(note.markdown,/Fixture limitation/);assert.match(note.markdown,/Chưa có xác nhận Deployed/);
 const features=note.markdown.split('## Tính năng có bằng chứng build')[1].split('## ')[0];assert.doesNotMatch(features,/Task T2/);assert.match(note.markdown,/Task T2:/);
 await projects.projectReleaseEvidenceAction(f.id,f.releaseId,'notes',{});assert.equal(f.get().releases[0].notesHistory[1].revision,2);assert.equal(projects.projectReleaseNote(f.id,f.releaseId,note.id).markdown,note.markdown);
 edit(f.id,p=>p.releases[0].notesHistory[0].markdown+='Forged deployed');assert.throws(()=>projects.projectReleaseNote(f.id,f.releaseId,note.id),/ngoài luồng/);
});
test('release history survives replanning with reused T1 IDs, source updates and frozen handover cannot be rewritten',async()=>{
 const f=await fixture();const ready=await acceptAndFreeze(f),before=JSON.stringify(f.get().releases[0].handover.snapshot);
 assert.throws(()=>projects.updateProjectRelease(f.id,f.releaseId,{title:'Rewrite frozen history'}),/chốt/);assert.throws(()=>projects.assignProjectReleaseTasks(f.id,f.releaseId,{tasks:[]}),/chốt/);
 edit(f.id,p=>{p.planHistory=[{id:p.planId,tasks:structuredClone(p.tasks)}];p.tasks=[];p.planId='new-plan';p.tasks=[{...task(),planId:'new-plan',specificationId:p.approvedSpecificationId}];});assert.equal((await f.view()).items[0].planId,ready.items[0].planId);
 projects.updateProjectBrief(f.id,{goals:'Next edition scope'});const d=await f.view();assert.equal(d.sourceState.current,false);assert.equal(d.frozen,true);assert.equal(JSON.stringify(f.get().releases[0].handover.snapshot),before);
 edit(f.id,p=>p.releases[0].handover.snapshot.items[0].title='Unauthorized rewrite');await assert.rejects(f.view(),/ngoài luồng/);
});
test('zero-task releases are never complete; stale UI hashes and unapproved deployment state updates are rejected',async()=>{
 const f=await fixture();const d=await f.view();projects.updateProjectRelease(f.id,f.releaseId,{knownIssues:['Changed after PO read']});await assert.rejects(projects.projectReleaseEvidenceAction(f.id,f.releaseId,'acceptance',{explicitApproval:true,evidenceHash:d.evidenceHash,taskKey:d.items[0].key,criterionIds:['AC1'],evidence:'Checked all criteria.'}),/hiện tại/);
 projects.assignProjectReleaseTasks(f.id,f.releaseId,{tasks:[]});assert.equal((await f.view()).milestones.buildComplete,false);assert.throws(()=>projects.updateProjectRelease(f.id,f.releaseId,{deployment:{status:'deployed'}}),/state/);assert.throws(()=>projects.createProjectRelease(f.id,{version:'v2.0.0',source:{architectureVersion:99}}),/state/);
});
test('draft release retains old source versions but cannot become ready after baseline changes',async()=>{
 const f=await fixture({reviewRequired:true,accept:true});assert.equal((await f.view()).milestones.readyForHandover,true);projects.updateProjectBrief(f.id,{goals:'A new product scope'});const d=await f.view();assert.equal(d.source.specificationVersion,1);assert.equal(d.source.architectureVersion,1);assert.equal(d.sourceState.current,false);assert.equal(d.milestones.readyForHandover,false);await assert.rejects(projects.projectReleaseEvidenceAction(f.id,f.releaseId,'handover',{explicitApproval:true,evidenceHash:d.evidenceHash}),/baseline/);
});
