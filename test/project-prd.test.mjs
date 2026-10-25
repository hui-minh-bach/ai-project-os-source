import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {isolatedRuntime} from './helpers/isolated-runtime.mjs';
const runtime=isolatedRuntime('prd');after(()=>runtime.cleanup());
const {readJson,writeJson}=await runtime.import('src/lib/store.mjs');
const {createProject,getProject,confirmCouncilSpecification,updateProjectBrief}=await runtime.import('src/lib/projects.mjs');
const {projectPrdHistory,projectPrdById,currentApprovedPrd,agentRequirementsContext}=await runtime.import('src/lib/project-prd.mjs');
const {prepareApprovedSpecification,chairResponse}=await runtime.import('test/helpers/council-fixtures.mjs');
const find=id=>readJson('projects.json',[]).find(p=>p.id===id);
function edit(id,fn){const all=readJson('projects.json',[]),p=all.find(x=>x.id===id);fn(p);writeJson('projects.json',all);}

test('PRD is absent until the current Council Specification receives existing PO approval',()=>{
 const p=createProject({name:'Chưa duyệt',idea:'Hội thoại chưa được chốt'});
 assert.deepEqual(projectPrdHistory(getProject(p.id)),{current:null,history:[]});
 edit(p.id,x=>{x.finalSpec='Nội dung do AI tự đề xuất';x.messages.push({role:'assistant',content:'Một PRD giả'});});
 assert.equal(projectPrdHistory(getProject(p.id)).current,null);
 assert.equal(projectPrdById(getProject(p.id),'none'),null);
});

test('approval creates official versioned PRD from exact Specification fields and metadata',()=>{
 const p=createProject({name:'Sản phẩm A'});
 prepareApprovedSpecification(p.id,{goals:['Tăng tỷ lệ hoàn thành'],scope:'Chỉ chạy trên máy cá nhân',outOfScope:['Thanh toán'],mvpFeatures:['Lưu ghi chú'],userFlows:['Mở và lưu ghi chú'],securityPrivacy:['Không chia sẻ dữ liệu'],data:['Ghi chú local'],integrations:[],acceptanceCriteria:['Mở được ghi chú']});
 const project=getProject(p.id),spec=project.specifications[0],doc=currentApprovedPrd(project);
 assert.equal(doc.id,spec.id);assert.equal(doc.version,1);assert.equal(doc.approvedAt,spec.approvedAt);
 assert.equal(doc.contentHash,spec.approvedRequirementsHash);assert.equal(doc.verification,'approval-snapshot');
 assert.deepEqual(doc.sections.businessObjectives,['Tăng tỷ lệ hoàn thành']);
 assert.deepEqual(doc.sections.functionalRequirements,['Lưu ghi chú']);
 assert.deepEqual(doc.sections.nonFunctionalRequirements,['Không chia sẻ dữ liệu']);
 assert.deepEqual(doc.sections.data,['Ghi chú local']);assert.deepEqual(doc.sections.integrations,[]);
 assert.deepEqual(doc.sections.acceptanceCriteria,['Mở được ghi chú']);
 assert.match(doc.markdown,/## Tiêu chí nghiệm thu/);assert.match(doc.markdown,/Chưa được xác định trong Specification/);
 assert.match(agentRequirementsContext(doc),/PRD v1/);assert.match(agentRequirementsContext(doc),new RegExp(doc.contentHash));
 doc.sections.businessObjectives[0]='Bị sửa trong response';
 assert.deepEqual(currentApprovedPrd(getProject(p.id)).sections.businessObjectives,['Tăng tỷ lệ hoàn thành']);
 const before=JSON.stringify(find(p.id));confirmCouncilSpecification(p.id,spec.id);
 assert.equal(JSON.stringify(find(p.id)),before,'repeated confirmation cannot create a second version or approval');
});

test('version history retains earlier approved PRD while pending version remains unofficial',()=>{
 const p=createProject({name:'Dự án lịch sử'});prepareApprovedSpecification(p.id);
 const previous=currentApprovedPrd(getProject(p.id));
 edit(p.id,x=>{
  const old=x.specifications[0],chair=chairResponse('Phiên mới');
  chair.specification={...chair.specification,goals:['Mục tiêu phiên 2']};
  x.councilRuns.push({...x.councilRuns[0],id:'council-run-2'});
  x.specifications.push({...old,id:'specification-2',runId:'council-run-2',version:2,status:'pending',approvedAt:undefined,approvedRequirementsHash:undefined,specification:chair.specification,chair});
  x.currentSpecificationId='specification-2';x.currentCouncilRunId='council-run-2';x.approvedSpecificationId=null;
 });
 let list=projectPrdHistory(getProject(p.id));assert.equal(list.current,null);assert.equal(list.history.length,1);
 assert.equal(projectPrdById(getProject(p.id),'specification-2'),null);
 confirmCouncilSpecification(p.id,'specification-2');list=projectPrdHistory(getProject(p.id));
 assert.equal(list.current,'specification-2');assert.deepEqual(list.history.map(x=>x.version),[2,1]);
 assert.equal(projectPrdById(getProject(p.id),previous.id).markdown,previous.markdown);
 assert.deepEqual(currentApprovedPrd(getProject(p.id)).sections.businessObjectives,['Mục tiêu phiên 2']);
});

test('first-edition Specification without an approval snapshot cannot masquerade as an approved baseline',()=>{
 const p=createProject({name:'Dự án cũ'});prepareApprovedSpecification(p.id);
 edit(p.id,x=>{delete x.specifications[0].approvedRequirementsHash;});
 assert.throws(()=>currentApprovedPrd(getProject(p.id)),/Chưa có baseline/);
 assert.throws(()=>projectPrdHistory(getProject(p.id)),/Chưa có baseline/);
});

test('unauthorized changes to the approved Specification fail closed for PRD access',()=>{
 const p=createProject({name:'Bảo vệ'});prepareApprovedSpecification(p.id);
 edit(p.id,x=>{x.specifications[0].specification.goals[0]='Bị sửa sau duyệt';});
 assert.throws(()=>currentApprovedPrd(getProject(p.id)),/đã khác|đã đổi/);
 assert.throws(()=>projectPrdById(getProject(p.id),'test-approved-spec'),/đã khác|đã đổi/);
});

test('stale brief removes the current PRD without erasing approved history',()=>{
 const p=createProject({name:'Dự án'});prepareApprovedSpecification(p.id);
 updateProjectBrief(p.id,{name:'Dự án đổi yêu cầu'});
 const list=projectPrdHistory(getProject(p.id));assert.equal(list.current,null);
 assert.equal(list.history.length,1);assert.equal(list.history[0].current,false);
});
