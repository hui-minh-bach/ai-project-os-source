// Official PRD is a deterministic, read-only view of PO-approved Council specs.
// No AI text, workspace file or separate approval can become an official PRD.
import crypto from 'node:crypto';
import { approvedSpecification, currentSpecification } from './council-spec.mjs';

const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function requirementsFingerprint(project, spec) {
  return digest([1, project.id, spec.id, spec.runId, spec.version, spec.briefFingerprint, spec.specification]);
}
function source(project, spec) {
  if (!spec || spec.status !== 'approved' || !spec.approvedAt || !Number.isFinite(Date.parse(spec.approvedAt)))
    throw new Error('Chỉ Specification đã được PO chốt mới có PRD chính thức.');
  const run=(project.councilRuns||[]).find(r=>r.id===spec.runId);
  if (!run || run.status!=='completed' || run.briefFingerprint!==spec.briefFingerprint ||
      run.briefRevision!==spec.briefRevision)
    throw new Error('PRD không khớp phiên AI Council đã hoàn tất.');
  if (spec.chair?.specification && JSON.stringify(spec.chair.specification)!==JSON.stringify(spec.specification))
    throw new Error('Nội dung Specification đã khác bản Council chốt; PRD bị khóa.');
  const hash=requirementsFingerprint(project,spec);
  if (!spec.approvedRequirementsHash)throw new Error('Chưa có baseline yêu cầu được ghi nhận khi PO duyệt Specification.');
  if (spec.approvedRequirementsHash!==hash)
    throw new Error('Nội dung Specification đã đổi sau khi PO duyệt; PRD bị khóa.');
  return hash;
}
const safe = value => String(value??'').replace(/[\r\n]+/g,' ').replace(/\\/g,'\\\\').replace(/([*_`[\]#>])/g,'\\$1').replace(/</g,'&lt;').replace(/>/g,'&gt;').trim();
const copyList = value => Array.isArray(value) ? value.map(String) : [];
export function prdMarkdown(doc) {
  const s=doc.sections;
  const parts=[`# PRD v${doc.version} · ${safe(doc.title)}`,
    `Dự án: ${safe(doc.projectName)}`,
    `Trạng thái: Đã phê duyệt bởi Product Owner qua AI Council`,
    `Ngày phê duyệt: ${safe(doc.approvedAt)}`,
    `Specification nguồn: v${doc.version} · ${doc.specificationId}`,
    `Mã nội dung: ${doc.contentHash}`];
  const list=(heading,items)=>{parts.push(`## ${heading}`);parts.push(items.length?items.map(x=>'- '+safe(x)).join('\n'):'Chưa được xác định trong Specification đã duyệt.');};
  list('Mục tiêu kinh doanh',s.businessObjectives);
  parts.push('## Phạm vi',safe(s.scope));
  list('Ngoài phạm vi',s.outOfScope);
  list('Yêu cầu chức năng',s.functionalRequirements);
  list('Luồng người dùng',s.userFlows);
  list('Yêu cầu phi chức năng và bảo mật',s.nonFunctionalRequirements);
  list('Dữ liệu',s.data);
  list('Tích hợp',s.integrations);
  list('Tiêu chí nghiệm thu',s.acceptanceCriteria);
  return parts.join('\n\n')+'\n';
}
export function projectPrd(project,spec) {
  const hash=source(project,spec),s=spec.specification;
  const doc={id:spec.id,projectId:project.id,projectName:project.name,title:s.title,
    version:spec.version,status:'approved',approvedAt:spec.approvedAt,
    approvalSource:'Product Owner · AI Council',specificationId:spec.id,councilRunId:spec.runId,
    briefFingerprint:spec.briefFingerprint,contentHash:hash,
    verification:'approval-snapshot',
    current:project.approvedSpecificationId===spec.id && currentSpecification(project)?.id===spec.id,
    readOnly:true,
    sections:{businessObjectives:copyList(s.goals),scope:s.scope,
      outOfScope:copyList(s.outOfScope),functionalRequirements:copyList(s.mvpFeatures),
      userFlows:copyList(s.userFlows),nonFunctionalRequirements:copyList(s.securityPrivacy),
      data:copyList(s.data),integrations:copyList(s.integrations),
      acceptanceCriteria:copyList(s.acceptanceCriteria)}};
  return {...doc,markdown:prdMarkdown(doc)};
}
export function currentApprovedPrd(project) { return projectPrd(project,approvedSpecification(project)); }
export function projectPrdHistory(project) {
  const history=(project.specifications||[]).filter(s=>s.status==='approved').map(s=>projectPrd(project,s));
  let current=null;
  try { current=currentApprovedPrd(project); } catch (error) {
    if (currentSpecification(project)?.id===project.approvedSpecificationId && project.approvedSpecificationId && history.some(d=>d.id===project.approvedSpecificationId)) throw error;
  }
  return {current:current?.id||null,history:history.map(({markdown,sections,...metadata})=>metadata).reverse()};
}
export function projectPrdById(project,id) {
  const spec=(project.specifications||[]).find(s=>s.id===id);
  return spec?.status==='approved'?projectPrd(project,spec):null;
}
export function agentRequirementsContext(doc) {
  return `TÀI LIỆU YÊU CẦU CHÍNH THỨC — PRD v${doc.version} · ${doc.contentHash}\nTài liệu đã được PO duyệt trong AI Council. Chỉ đọc; agent không được sửa nội dung chính thức. Yêu cầu thay đổi phải qua Specification mới được PO chốt.\n\n${doc.markdown}`;
}
