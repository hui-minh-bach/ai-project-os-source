import crypto from 'node:crypto';
import { normalizeAnalyzedBrief } from './idea-brief.mjs';

export const COUNCIL_MEMBER_SCHEMA='{"version":1,"viewpoint":string,"strengths":string[],"risks":string[],"recommendation":string,"vote":"agree|consider|oppose"}';
export const COUNCIL_CHAIR_SCHEMA='{"version":1,"summary":string,"feasibility":"high|medium|low","recommendation":string,"conflictDecisions":[{"issue":string,"resolution":string,"rationale":string,"members":number[]}],"specification":{"title":string,"goals":string[],"audience":string,"scope":string,"mvpFeatures":string[],"outOfScope":string[],"userFlows":string[],"data":string[],"integrations":string[],"stack":string[],"securityPrivacy":string[],"acceptanceCriteria":string[],"roadmap":string[]}}';

function object(raw,keys,name){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(`${name}: cần JSON object.`);
  if(Object.keys(raw).some(k=>!keys.includes(k))||keys.some(k=>!(k in raw)))throw new Error(`${name}: thiếu hoặc thừa trường trong schema.`);
  return raw;
}
function text(value,name,max=4000){
  if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))throw new Error(`${name}: nội dung không hợp lệ.`);
  return value.trim();
}
function list(value,name,required=false){
  if(!Array.isArray(value)||value.length>20||(required&&!value.length))throw new Error(`${name}: cần danh sách tối đa 20 mục${required?', không được trống':''}.`);
  return [...new Set(value.map(x=>text(x,name,1500)))];
}
export function parseCouncilJson(raw){
  // Council is a structured protocol: prose, fenced JSON and partial objects
  // must not silently become a vote or an approved specification.
  try{return JSON.parse(String(raw));}catch{throw new Error('AI Council không trả JSON thuần hợp lệ.');}
}
export function normalizeCouncilMember(raw){
  object(raw,['version','viewpoint','strengths','risks','recommendation','vote'],'Council member');
  if(raw.version!==1||!['agree','consider','oppose'].includes(raw.vote))throw new Error('Council member: version hoặc vote không hợp lệ.');
  return {version:1,viewpoint:text(raw.viewpoint,'Quan điểm'),strengths:list(raw.strengths,'Điểm mạnh',true),risks:list(raw.risks,'Rủi ro'),recommendation:text(raw.recommendation,'Khuyến nghị'),vote:raw.vote};
}
export function normalizeCouncilChair(raw,members){
  object(raw,['version','summary','feasibility','recommendation','conflictDecisions','specification'],'Council Chair');
  if(raw.version!==1||!['high','medium','low'].includes(raw.feasibility))throw new Error('Council Chair: version hoặc feasibility không hợp lệ.');
  if(!Array.isArray(raw.conflictDecisions)||raw.conflictDecisions.length>20)throw new Error('Chair cần danh sách giải quyết mâu thuẫn.');
  const conflictDecisions=raw.conflictDecisions.map(x=>{
    object(x,['issue','resolution','rationale','members'],'Quyết định mâu thuẫn');
    if(!Array.isArray(x.members)||!x.members.length||x.members.some(n=>!Number.isInteger(n)||n<1||n>members.length))throw new Error('Chair tham chiếu thành viên không hợp lệ.');
    return {issue:text(x.issue,'Vấn đề'),resolution:text(x.resolution,'Quyết định'),rationale:text(x.rationale,'Lý do'),members:[...new Set(x.members)]};
  });
  if(new Set(members.map(m=>m.review.vote)).size>1&&!conflictDecisions.length)throw new Error('Chair cần giải quyết ý kiến khác nhau, không chỉ đếm phiếu.');
  const fields=['title','goals','audience','scope','mvpFeatures','outOfScope','userFlows','data','integrations','stack','securityPrivacy','acceptanceCriteria','roadmap'];
  object(raw.specification,fields,'Specification');const specification={};
  for(const key of fields)specification[key]=['title','audience','scope'].includes(key)?text(raw.specification[key],key):list(raw.specification[key],key,['goals','mvpFeatures','userFlows','securityPrivacy','acceptanceCriteria','roadmap','stack'].includes(key));
  return {version:1,summary:text(raw.summary,'Chair summary'),feasibility:raw.feasibility,recommendation:text(raw.recommendation,'Chair recommendation'),conflictDecisions,specification};
}
export function councilConsensus(members){
  const votes={agree:0,consider:0,oppose:0};for(const m of members)if(m.status==='completed'&&m.review)votes[m.review.vote]++;
  const total=members.length,reviewed=votes.agree+votes.consider+votes.oppose;
  return {...votes,total,reviewed,percent:total?Math.round(100*votes.agree/total):0};
}
export function currentCouncilBrief(project){
  const b=project.councilBrief,revision=project.briefRevision||0;
  if(!b||b.version!==1||b.revision!==revision||project.analyzedBrief?.revision!==revision)throw new Error('Hãy phân tích và gửi brief hiện tại từ Idea Studio sang AI Council.');
  const expected={name:project.name,productType:project.productType,audience:project.audience,goals:project.goals,mainFeatures:project.mainFeatures};
  if(JSON.stringify(b.project)!==JSON.stringify(expected))throw new Error('Project brief đã thay đổi. Hãy gửi lại từ Idea Studio.');
  normalizeAnalyzedBrief(b);return structuredClone(b);
}
export function councilBriefFingerprint(project){return crypto.createHash('sha256').update(JSON.stringify(currentCouncilBrief(project))).digest('hex');}
export function currentSpecification(project){
  const spec=(project.specifications||[]).find(s=>s.id===project.currentSpecificationId),run=(project.councilRuns||[]).find(r=>r.id===project.currentCouncilRunId);
  if(!spec||!run||run.status!=='completed'||spec.runId!==run.id||spec.briefRevision!==(project.briefRevision||0))return null;
  try{if(spec.briefFingerprint!==councilBriefFingerprint(project))return null;}catch{return null;}
  return spec;
}
// Shared by planning and future Team/Publish guards. Old plaintext finalSpec is
// deliberately insufficient evidence of explicit user confirmation.
export function approvedSpecification(project){
  const spec=currentSpecification(project);
  if(!spec||spec.status!=='approved'||project.approvedSpecificationId!==spec.id||!spec.approvedAt)throw new Error('Hãy chốt specification hiện tại trong AI Council trước khi tạo task.');
  return spec;
}
export function specificationText(spec){
  const labels={title:'Tên sản phẩm',goals:'Mục tiêu',audience:'Người dùng',scope:'Phạm vi',mvpFeatures:'Chức năng MVP',outOfScope:'Ngoài phạm vi',userFlows:'Luồng người dùng',data:'Dữ liệu cần lưu',integrations:'Tích hợp',stack:'Stack đề xuất',securityPrivacy:'Bảo mật và riêng tư',acceptanceCriteria:'Tiêu chí nghiệm thu',roadmap:'Lộ trình'};
  return Object.entries(labels).map(([key,label])=>`${label}:\n${Array.isArray(spec[key])?spec[key].map(x=>'- '+x).join('\n'):spec[key]}`).join('\n\n');
}
