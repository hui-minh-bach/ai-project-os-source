import { deploymentTarget, deploymentImpact } from './deployment-target.mjs';
import crypto from 'node:crypto';
import { approvedSpecification } from './council-spec.mjs';
import { currentApprovedPrd, projectPrdById } from './project-prd.mjs';
import { approvedArchitecture, architectureDocument } from './project-architecture.mjs';
import { workspaceDir } from './workspace.mjs';
import { run } from './shell.mjs';

const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const now=()=>new Date().toISOString();
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(v);
const safe=v=>String(v??'').replace(/[\r\n]+/g,' ').replace(/\\/g,'\\\\').replace(/([*_`[\]#>])/g,'\\$1').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const text=(v,max=3000)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))throw new Error('Nội dung release không hợp lệ.');return v.trim();};
function keys(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw new Error('Release không cho phép ghi state/evidence từ client.');}
function strings(value){if(!Array.isArray(value)||value.length>30)throw new Error('Release cần danh sách tối đa 30 mục.');return value.map(v=>text(v)).filter(Boolean);}
export function releaseVersion(value){const m=String(value||'').match(/^v?(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/);if(!m)throw new Error('Phiên bản cần dạng v0.1.0 hoặc v1.0.0.');return 'v'+m.slice(1).join('.');}
export const releaseTaskKey=t=>`${t.planId}:${t.id}`;
export function releaseTasks(p){const tasks=[...(p.tasks||[]),...(p.taskArchive||[]),...(p.planHistory||[]).flatMap(h=>h.tasks||[])],map=new Map();for(const task of tasks)if(task.planId&&!map.has(releaseTaskKey(task)))map.set(releaseTaskKey(task),task);return map;}
export function getRelease(p,id){const r=(p.releases||[]).find(r=>r.id===id);if(!r)throw new Error('Không tìm thấy release.');return r;}
export function releaseFingerprint(p,r){return hash([r,p.currentSpecificationId,p.approvedSpecificationId,p.currentCouncilRunId,p.briefRevision,p.councilBrief,p.analyzedBrief,p.specifications,p.approvedArchitectureId,p.architectures,deploymentTarget(p),p.deploymentTargetRevision,p.deploymentTargetDecisions,r.tasks.map(link=>releaseTasks(p).get(link.key)||null)]);}
export function releaseEvent(r,type,detail){r.updatedAt=now();r.revision=(r.revision||0)+1;r.history.push({id:crypto.randomUUID(),at:r.updatedAt,type,detail});}
function editable(r){if(r.handover)throw new Error('Release đã chốt bàn giao; tạo phiên bản mới để giữ nguyên lịch sử.');}
export function createReleaseRecord(p,input){
 keys(input,['version','title','description','targetDate','knownIssues','limitations']);
 const s=approvedSpecification(p),a=approvedArchitecture(p),prd=currentApprovedPrd(p),version=releaseVersion(input.version);
 p.releases=p.releases||[];if(p.releases.length>=50)throw new Error('Tối đa 50 release mỗi dự án.');if(p.releases.some(r=>r.version===version))throw new Error('Phiên bản release đã tồn tại.');
 const r={id:crypto.randomUUID(),version,title:text(input.title||version,180),description:text(input.description||''),targetDate:'',knownIssues:strings(input.knownIssues||[]),limitations:strings(input.limitations||[]),source:{specificationId:s.id,specificationVersion:s.version,requirementsHash:prd.contentHash,architectureId:a.id,architectureVersion:a.version,architectureHash:a.contentHash},tasks:[],acceptanceReceipts:[],notesHistory:[],history:[],createdAt:now(),revision:0};
 if(input.targetDate){if(!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)||!Number.isFinite(Date.parse(input.targetDate)))throw new Error('Ngày dự kiến không hợp lệ.');r.targetDate=input.targetDate;}
 releaseEvent(r,'created','PO tạo release theo baseline đã duyệt');p.releases.push(r);return r;
}
export function updateReleaseRecord(r,input){editable(r);keys(input,['title','description','targetDate','knownIssues','limitations']);for(const k of ['title','description'])if(k in input)r[k]=text(input[k],k==='title'?180:3000);for(const k of ['knownIssues','limitations'])if(k in input)r[k]=strings(input[k]);if('targetDate' in input){if(input.targetDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)||!Number.isFinite(Date.parse(input.targetDate))))throw new Error('Ngày dự kiến không hợp lệ.');r.targetDate=input.targetDate;}releaseEvent(r,'updated','Cập nhật kế hoạch và ghi chú của PO');}
function taskMatches(t,s){const a=t.architectureReference;return t.specificationId===s.specificationId&&a?.specificationId===s.specificationId&&a?.specificationVersion===s.specificationVersion&&a?.architectureId===s.architectureId&&a?.architectureVersion===s.architectureVersion&&a?.architectureHash===s.architectureHash;}
export function assignReleaseTasks(p,r,input){
 editable(r);keys(input,['tasks']);if(!Array.isArray(input.tasks)||input.tasks.length>100)throw new Error('Danh sách task không hợp lệ.');
 const all=releaseTasks(p),seen=new Set(),items=input.tasks.map(item=>{
  keys(item,['taskId','planId','kind']);const key=releaseTaskKey({id:item.taskId,planId:item.planId}),task=all.get(key);
  if(!task||seen.has(key)||!['feature','fix'].includes(item.kind)||!taskMatches(task,r.source))throw new Error('Task bị trùng hoặc không khớp Specification/Architecture của release.');
  if((p.releases||[]).some(other=>other.id!==r.id&&other.tasks.some(t=>t.key===key)))throw new Error('Task đã được gán cho release khác.');seen.add(key);return {key,taskId:task.id,planId:task.planId,kind:item.kind};
 });r.tasks=items;releaseEvent(r,'tasks-assigned',`Gán ${items.length} task theo planId và taskId`);
}
function sourceState(p,r){
 const s=projectPrdById(p,r.source.specificationId),a=(p.architectures||[]).find(a=>a.id===r.source.architectureId);
 if(!s||s.version!==r.source.specificationVersion||s.contentHash!==r.source.requirementsHash||!a||a.status!=='approved'||a.version!==r.source.architectureVersion||a.contentHash!==r.source.architectureHash)throw new Error('Baseline release không còn khớp tài liệu đã duyệt.');architectureDocument(p,a);
 let current=false;try{current=currentApprovedPrd(p).id===s.id&&approvedArchitecture(p).id===a.id;}catch{}
 return {valid:true,current};
}
async function gitVerification(p,runRecord,cache){
 if(!sha(runRecord?.mergeSha)||!sha(runRecord?.commitSha))return {verified:false,reason:'Thiếu SHA Git hợp lệ.'};
 const key=runRecord.mergeSha+':'+runRecord.commitSha;if(cache.has(key))return cache.get(key);
 const cwd=workspaceDir(p.id),check=async args=>{try{return await run('git',args,{cwd,timeoutMs:10000,inheritEnv:false});}catch{return {code:null};}};
 const value=(async()=>{
  const headKey=p.id+':main';if(!cache.has(headKey))cache.set(headKey,check(['rev-parse','refs/heads/main']));const head=await cache.get(headKey);if(head.code!==0||!sha(head.stdout?.trim()))return {verified:false,reason:'Chưa có commit main được xác minh.'};
  const [commit,merge,contains,worker]=await Promise.all([check(['cat-file','-t',runRecord.commitSha]),check(['cat-file','-t',runRecord.mergeSha]),check(['merge-base','--is-ancestor',runRecord.mergeSha,head.stdout.trim()]),check(['merge-base','--is-ancestor',runRecord.commitSha,runRecord.mergeSha])]);
  return head.code===0&&sha(head.stdout.trim())&&commit.stdout?.trim()==='commit'&&merge.stdout?.trim()==='commit'&&contains.code===0&&worker.code===0?{verified:true,mainCommit:head.stdout.trim()}:{verified:false,reason:'Không xác minh được commit/merge hoặc code không còn trên main.'};
 })();cache.set(key,value);return value;
}
function verifySnapshot(snapshot){const {contentHash,...body}=snapshot;if(contentHash!==hash(body))throw new Error('Snapshot release đã bị thay đổi ngoài luồng PO.');return snapshot;}
function archivedView(p,r){const doc=verifySnapshot(r.handover.snapshot);return {...doc,manualHandoverPackages:r.manualHandoverPackages||[],deploymentTarget:deploymentTarget(p),deploymentTargetRevision:p.deploymentTargetRevision||0,deploymentImpact:deploymentImpact(p),sourceState:sourceState(p,r),frozen:true,handover:{at:r.handover.at,by:r.handover.by},deployment:r.deployment||null,milestones:{...doc.milestones,deployed:!!r.deployment},status:r.deployment?'deployed':'ready_for_handover',history:r.history,notesHistory:r.notesHistory.map(({markdown,...x})=>x),evidenceHash:releaseFingerprint(p,r)};}
export async function projectReleaseView(p,r,{cache=new Map()}={}){
 if(r.handover)return archivedView(p,r);
 const source=sourceState(p,r),all=releaseTasks(p),items=[];
 for(const link of r.tasks){
  const task=all.get(link.key),runs=task?.executionRuns||[],record=runs.at(-1),reasons=[];
  const sameRun=task&&record&&taskMatches(task,r.source)&&task.architectureReference.acceptanceHash===hash((task.acceptanceCriteria||[]).map(c=>({id:c.id,text:c.text})))&&JSON.stringify(task.architectureReference)===JSON.stringify(record.architectureReference)&&record.specificationId===r.source.specificationId&&record.requirementsVersion===r.source.specificationVersion&&record.requirementsHash===r.source.requirementsHash&&record.architectureReference?.architectureId===r.source.architectureId&&record.architectureReference?.architectureVersion===r.source.architectureVersion&&record.architectureHash===r.source.architectureHash&&record.planId===link.planId;
  const candidate=sameRun&&task.status==='done'&&record.status==='done'&&record.outcome==='done'&&task.mergeSha===record.mergeSha&&record.commits?.some(c=>c.sha===record.commitSha&&sha(c.sha));
  const git=candidate?await gitVerification(p,record,cache):{verified:false,reason:'Task chưa có phiên hoàn tất/merge cùng baseline.'};
  const review=record?.reviews?.at(-1),reviewSatisfied=record?.settings?.reviewRequired===false?review?.status==='SKIPPED':review?.status==='APPROVED'&&review.approved===true;
  const guard=record?.architectureReceipts?.at(-1),guardSatisfied=guard?.source==='runtime'&&guard?.kind==='architecture-compliance'&&guard?.stage==='merge-result'&&['PASS','WARNING'].includes(guard.status)&&guard.targetSha===record?.mergeSha&&guard.reference?.architectureHash===r.source.architectureHash;
  const buildCommand=record?.testReceipts?.filter(t=>t.source==='runtime'&&t.kind==='command'&&t.script==='build').at(-1),buildCommandSatisfied=!buildCommand||buildCommand.status==='PASS'&&buildCommand.exitCode===0;
  const built=!!candidate&&git.verified&&reviewSatisfied&&guardSatisfied&&buildCommandSatisfied;
  if(!buildCommandSatisfied)reasons.push('Lệnh build runtime chưa thành công: '+buildCommand.status);
  if(!built)reasons.push(git.verified?'Thiếu review/architecture receipt hợp lệ.':git.reason);
  const test=record?.testReceipts?.filter(t=>t.source==='runtime'&&t.kind==='test').at(-1),tested=built&&test?.status==='PASS'&&test.exitCode===0;
  if(!tested)reasons.push(test?`Test runtime: ${test.status}${test.exitCode===0?'':'; chưa có exit 0'}`:'Chưa có receipt test từ runtime.');
  const acceptance=(task?.acceptanceCriteria||[]).map(c=>{
   const fromReview=c.status==='met'&&c.source==='reviewer'&&c.evidence?.runId===record?.id&&review?.status==='APPROVED'&&review.approved===true&&review.acceptance?.some(v=>v.criterionId===c.id&&v.met===true&&v.explanation?.trim());
   const fromPo=r.acceptanceReceipts.some(v=>v.source==='product-owner'&&v.taskKey===link.key&&v.runId===record?.id&&v.mergeSha===record?.mergeSha&&v.criteria.some(x=>x.id===c.id&&x.textHash===hash(c.text)));
   return {id:c.id,text:c.text,verified:built&&(fromReview||fromPo),source:fromReview?'reviewer':fromPo?'product-owner':null};
  });
  const accepted=acceptance.length>0&&acceptance.every(c=>c.verified);if(!accepted)reasons.push('Tiêu chí nghiệm thu chưa được xác nhận bằng bằng chứng.');
  const limitations=[];if(!buildCommand)limitations.push('Chưa có receipt lệnh build riêng; Build Complete xác nhận task/Git, không tự khẳng định compiler hoặc build script đã chạy.');if(record?.settings?.reviewRequired===false)limitations.push('AI Reviewer đã tắt; không có phê duyệt review độc lập.');if(guard?.status==='WARNING')limitations.push(...guard.findings.filter(f=>f.severity==='WARNING').map(f=>f.message));
  items.push({...link,title:task?.title||link.taskId,taskStatus:task?.status||'missing',built,tested,accepted,acceptance,reasons,limitations,runId:record?.id||null,commitSha:built?record.commitSha:null,mergeSha:built?record.mergeSha:null,git,buildCommand:buildCommand?{id:buildCommand.id,status:buildCommand.status,exitCode:buildCommand.exitCode}:null,test:test?{id:test.id,source:test.source,kind:test.kind,status:test.status,exitCode:test.exitCode,script:test.script||null,completedAt:test.completedAt||null}:null,review:review?{status:review.status,approved:review.approved}:null,architectureCheck:guard?{status:guard.status,id:guard.id,stage:guard.stage}:null});
 }
 const total=items.length,built=items.filter(i=>i.built).length,tested=items.filter(i=>i.tested).length,accepted=items.filter(i=>i.accepted).length;
 const buildComplete=total>0&&built===total,testComplete=buildComplete&&tested===total,ready=source.current&&testComplete&&accepted===total;
 return {id:r.id,manualHandoverPackages:r.manualHandoverPackages||[],deploymentTarget:deploymentTarget(p),deploymentTargetRevision:p.deploymentTargetRevision||0,deploymentImpact:deploymentImpact(p),version:r.version,title:r.title,description:r.description,targetDate:r.targetDate,source:r.source,sourceState:source,createdAt:r.createdAt,updatedAt:r.updatedAt,items,progress:{total,built,tested,accepted,percent:total?Math.floor(100*built/total):0},milestones:{buildComplete,tested:testComplete,readyForHandover:ready,deployed:false},status:ready?'ready_for_handover':testComplete?'tested':buildComplete?'build_complete':built?'in_progress':'planned',knownIssues:r.knownIssues,limitations:r.limitations,frozen:false,handover:null,deployment:null,history:r.history,notesHistory:r.notesHistory.map(({markdown,...x})=>x),evidenceHash:releaseFingerprint(p,r)};
}
export async function projectReleases(p){const cache=new Map(),releases=[];for(const r of p.releases||[])releases.push(await projectReleaseView(p,r,{cache}));return {projectId:p.id,deploymentTarget:deploymentTarget(p),deploymentImpact:deploymentImpact(p),releases:releases.reverse(),candidates:[...releaseTasks(p)].map(([key,t])=>({key,taskId:t.id,planId:t.planId,title:t.title,source:t.architectureReference||null,assignedReleaseId:(p.releases||[]).find(r=>r.tasks.some(l=>l.key===key))?.id||null}))};}
export function verifyReleaseAcceptance(p,r,input,doc){
 editable(r);keys(input,['explicitApproval','evidenceHash','taskKey','criterionIds','evidence']);if(input.explicitApproval!==true||input.evidenceHash!==doc.evidenceHash)throw new Error('PO cần đọc và xác nhận bằng chứng release hiện tại.');
 const item=doc.items.find(i=>i.key===input.taskKey);if(!item?.built)throw new Error('Chỉ nghiệm thu task có commit/merge đã xác minh.');
 if(!Array.isArray(input.criterionIds)||!input.criterionIds.length||new Set(input.criterionIds).size!==input.criterionIds.length||input.criterionIds.some(id=>!item.acceptance.some(c=>c.id===id)))throw new Error('Tiêu chí nghiệm thu không hợp lệ.');
 const evidence=text(input.evidence||'');if(evidence.length<10)throw new Error('PO cần mô tả bằng chứng nghiệm thu (ít nhất 10 ký tự).');
 r.acceptanceReceipts.push({id:crypto.randomUUID(),source:'product-owner',at:now(),taskKey:item.key,runId:item.runId,mergeSha:item.mergeSha,criteria:item.acceptance.filter(c=>input.criterionIds.includes(c.id)).map(c=>({id:c.id,textHash:hash(c.text)})),evidence});releaseEvent(r,'acceptance-confirmed',`PO nghiệm thu ${item.taskId}`);
}
export function freezeReleaseHandover(r,input,doc){
 editable(r);keys(input,['explicitApproval','evidenceHash']);if(input.explicitApproval!==true||input.evidenceHash!==doc.evidenceHash)throw new Error('PO cần xác nhận đúng bằng chứng release hiện tại.');if(!doc.milestones.readyForHandover)throw new Error('Chưa đủ build, test, nghiệm thu hoặc baseline hiện hành để bàn giao.');
 const {history,notesHistory,evidenceHash,manualHandoverPackages,...body}=doc,snapshot={...body,artifactCommit:doc.items[0]?.git.mainCommit,asOf:now()};snapshot.contentHash=hash(snapshot);r.handover={at:now(),by:'Product Owner',snapshot};releaseEvent(r,'handover-confirmed','PO chốt snapshot bàn giao theo bằng chứng đã xác minh');
}
export function confirmReleaseDeployment(r,input){
 keys(input,['explicitApproval','snapshotHash','target','evidence']);if(!r.handover)throw new Error('Cần PO chốt bàn giao trước khi xác nhận triển khai.');const snapshot=verifySnapshot(r.handover.snapshot);
 if(input.explicitApproval!==true||input.snapshotHash!==snapshot.contentHash)throw new Error('PO cần xác nhận đúng snapshot đã bàn giao.');
 if(r.deployment)throw new Error('Release đã có xác nhận triển khai; lịch sử được giữ nguyên.');const target=text(input.target||'',500),evidence=text(input.evidence||'');if(!target||evidence.length<10)throw new Error('Cần đích triển khai và mô tả bằng chứng của PO.');
 r.deployment={source:'product-owner',confirmedBy:'Product Owner',confirmedAt:now(),target,evidence,snapshotHash:snapshot.contentHash,artifactCommit:snapshot.artifactCommit};releaseEvent(r,'deployment-confirmed','PO xác nhận Deployed; không suy ra từ build hoặc Agent');
}
export function releaseNotesMarkdown(doc){
 const status={planned:'Đã lập kế hoạch',in_progress:'Đang thực hiện',build_complete:'Build Complete',tested:'Tested',ready_for_handover:'Ready for Handover',deployed:'Deployed · PO xác nhận'};
 const lines=[`# Release Notes ${safe(doc.version)} · ${safe(doc.title)}`,`Trạng thái: ${status[doc.status]}`,`Specification v${doc.source.specificationVersion} (${doc.source.specificationId}) · Architecture v${doc.source.architectureVersion} (${doc.source.architectureId})`,`Requirements hash: ${doc.source.requirementsHash}\nArchitecture hash: ${doc.source.architectureHash}`,`Bằng chứng ghi nhận: ${doc.asOf||new Date().toISOString()}`];
 const list=(title,items)=>{lines.push('## '+title,items.length?items.map(x=>'- '+safe(x)).join('\n'):'Chưa có bằng chứng được xác minh.');};
 for(const [kind,title] of [['feature','Tính năng có bằng chứng build'],['fix','Sửa lỗi có bằng chứng build']])list(title,doc.items.filter(i=>i.kind===kind&&i.built).map(i=>`${i.title} · ${i.taskId} / ${i.planId} · Worker ${i.commitSha} · Merge ${i.mergeSha}${i.tested?' · Test PASS':' · Chưa xác nhận test PASS'}`));
 list('Phạm vi dự kiến và công việc còn lại',doc.items.filter(i=>!i.built).map(i=>`${i.title}: ${i.reasons.join('; ')}`));
 list('Lệnh build riêng',doc.items.map(i=>`${i.taskId}: ${i.buildCommand?i.buildCommand.status+' · exit '+i.buildCommand.exitCode+' · receipt '+i.buildCommand.id:'Chưa có receipt lệnh build riêng; xem giới hạn của Build Complete.'}`));
 list('Kết quả kiểm thử',doc.items.map(i=>`${i.taskId} · ${i.test?.source||'không có runtime receipt'} · ${i.test?.status||'NOT_RUN'} · exit ${i.test?.exitCode??'chưa xác định'} · receipt ${i.test?.id||'—'} · ${i.tested?'đủ điều kiện Tested':'chưa đủ điều kiện Tested'}`));
 list('Nghiệm thu',doc.items.map(i=>`${i.taskId}: ${i.acceptance.filter(c=>c.verified).length}/${i.acceptance.length} tiêu chí có bằng chứng`));
 list('Vấn đề đã biết',[...doc.knownIssues,...(!doc.sourceState.current&&!doc.frozen?['Baseline release không còn hiện hành.']:[]),...doc.items.filter(i=>!i.tested||!i.accepted).map(i=>`${i.taskId}: ${i.reasons.join('; ')}`)]);
 list('Giới hạn',[...new Set([...doc.limitations,...doc.items.flatMap(i=>i.limitations),'Release Notes chỉ ghi bằng chứng tại thời điểm tạo; không xác nhận tương đương ngữ nghĩa hoặc test chưa thực thi.','Commit main có thể chứa công việc khác ngoài các task được gán release; đây không phải gói artifact được tự động triển khai.'])]);
 lines.push('## Triển khai',doc.deployment?`PO xác nhận lúc ${safe(doc.deployment.confirmedAt)}. Đích: ${safe(doc.deployment.target)}. Bằng chứng PO: ${safe(doc.deployment.evidence)}. Commit: ${safe(doc.deployment.artifactCommit)}.`:'Chưa có xác nhận Deployed của PO. Build, test và lời Agent không phải bằng chứng triển khai thành công.');return lines.join('\n\n')+'\n';
}
export function saveReleaseNotes(r,doc){if(r.notesHistory.length>=50)throw new Error('Tối đa 50 bản Release Notes mỗi release.');const note={id:crypto.randomUUID(),revision:r.notesHistory.length+1,createdAt:now(),evidenceHash:doc.evidenceHash,snapshot:{...doc,history:undefined,notesHistory:undefined},markdown:releaseNotesMarkdown(doc)};note.contentHash=hash([note.snapshot,note.markdown]);r.notesHistory.push(note);releaseEvent(r,'notes-generated',`Release Notes r${note.revision} từ bằng chứng runtime/Git và xác nhận PO`);return note;}
export function releaseNote(r,id){const note=r.notesHistory.find(n=>n.id===id);if(!note)return null;if(note.contentHash!==hash([note.snapshot,note.markdown]))throw new Error('Release Notes đã thay đổi ngoài luồng ứng dụng.');return note;}
