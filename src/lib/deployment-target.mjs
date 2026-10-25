export const DEPLOYMENT_TARGETS=Object.freeze(['not-specified','local-only','windows-desktop','on-premises','cloud-manual']);
export const TARGET_LABELS=Object.freeze({'not-specified':'Chưa chỉ định · Not Specified','local-only':'Chỉ chạy cục bộ · Local Only','windows-desktop':'Ứng dụng Windows Desktop','on-premises':'Máy chủ nội bộ · On-premises Server','cloud-manual':'Cloud · triển khai thủ công'});
export function normalizeDeploymentTarget(value){if(!DEPLOYMENT_TARGETS.includes(value))throw new Error('Deployment Target không hợp lệ.');return value;}
export const deploymentTarget=p=>normalizeDeploymentTarget(p.deploymentTarget??'not-specified');
export function deploymentImpact(p,target=deploymentTarget(p)){
 normalizeDeploymentTarget(target);const a=p.architectures?.find(a=>a.id===p.approvedArchitectureId&&a.status==='approved'),from=a?.deploymentTarget||'not-specified';
 const base={target,revision:p.deploymentTargetRevision||0,architectureId:a?.id||null,architectureHash:a?.contentHash||null,architectureTarget:from};
 if(!a)return {...base,status:'initial-decision',blocked:false,reason:'Chưa có kiến trúc được PO duyệt; đích chạy sẽ được đưa vào baseline đầu tiên.'};
 if(target===from)return {...base,status:'compatible',blocked:false,reason:'Đích chạy không đổi so với quyết định kiến trúc đã duyệt.'};
 if(target==='not-specified')return {...base,status:'compatible',blocked:false,reason:'Chưa chỉ định đích không cấp quyền triển khai; mọi ràng buộc kiến trúc đã duyệt vẫn giữ nguyên.'};
 if(a.proposal.deploymentSupport?.targets.includes(target))return {...base,status:'compatible',blocked:false,reason:a.proposal.deploymentSupport.rationale};
 if(target==='windows-desktop'||from==='windows-desktop')return {...base,status:'architecture-required',blocked:true,reason:'Thay đổi môi trường desktop/runtime hoặc cách phân phối; cần Architecture mới trừ khi baseline đã duyệt hỗ trợ đích này.'};
 const decision=(p.deploymentTargetDecisions||[]).findLast(d=>d.revision===base.revision&&d.target===target&&d.architectureId===a.id&&d.architectureHash===a.contentHash);
 if(decision)return {...base,status:decision.material?'architecture-required':'compatible',blocked:decision.material,reason:decision.rationale,decision};
 return {...base,status:'review-required',blocked:true,reason:'Chưa đủ bằng chứng xác nhận thay đổi network/runtime/storage/security chỉ là thủ tục bàn giao. PO cần đánh giá tác động; không mặc định bắt duyệt lại toàn bộ kiến trúc.'};
}
export function changeDeploymentTarget(p,value){
 const next=normalizeDeploymentTarget(value),previous=deploymentTarget(p);if(previous===next)return false;
 p.deploymentTarget=next;p.deploymentTargetRevision=(p.deploymentTargetRevision||0)+1;p.deploymentTargetHistory=p.deploymentTargetHistory||[];p.deploymentTargetHistory.push({revision:p.deploymentTargetRevision,from:previous,to:next,at:new Date().toISOString()});return true;
}
export function confirmDeploymentImpact(p,input){
 const allowed=['explicitApproval','revision','architectureId','architectureHash','material','rationale'];
 if(!input||Object.keys(input).some(k=>!allowed.includes(k))||input.explicitApproval!==true||typeof input.material!=='boolean')throw new Error('PO cần xác nhận đánh giá tác động Deployment Target.');
 const assessment=deploymentImpact(p);if(assessment.status!=='review-required'||input.revision!==assessment.revision||input.architectureId!==assessment.architectureId||input.architectureHash!==assessment.architectureHash)throw new Error('Đánh giá tác động không còn hiện hành hoặc đã có quyết định bắt buộc.');
 if(typeof input.rationale!=='string'||input.rationale.trim().length<20||input.rationale.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input.rationale))throw new Error('Cần lý do kỹ thuật ít nhất 20 ký tự về runtime, dữ liệu, network và bảo mật.');
 p.deploymentTargetDecisions=p.deploymentTargetDecisions||[];p.deploymentTargetDecisions.push({...assessment,source:'product-owner',at:new Date().toISOString(),material:input.material,rationale:input.rationale.trim()});return deploymentImpact(p);
}
export function assertDeploymentArchitecture(p){const assessment=deploymentImpact(p);if(assessment.blocked)throw new Error('Deployment Target cần đánh giá/quyết định kiến trúc: '+assessment.reason);return assessment;}
