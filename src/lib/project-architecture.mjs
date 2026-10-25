import { deploymentTarget, deploymentImpact, assertDeploymentArchitecture, normalizeDeploymentTarget } from './deployment-target.mjs';
import { POLICY_SCHEMA, normalizePolicy } from './architecture-policy.mjs';
import crypto from 'node:crypto';
import { currentSpecification } from './council-spec.mjs';
import { requirementsFingerprint } from './project-prd.mjs';

export const ARCHITECTURE_SCHEMA=JSON.stringify({overview:'string',stack:[{technology:'string',rationale:'string',tradeOff:'string'}],components:[{id:'identifier',name:'string',responsibility:'string',boundary:'string'}],relationships:[{from:'component id',to:'component id',contract:'protocol / API contract and data'}],dataStorage:['string'],integrations:['string'],securityNfr:['string'],deploymentRules:['string'],compliancePolicy:POLICY_SCHEMA,deploymentSupport:{targets:['not-specified|local-only|windows-desktop|on-premises|cloud-manual'],rationale:'technical evidence and constraints'}});
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function text(v){if(typeof v!=='string'||!v.trim()||v.length>3000||/[\x00-\x1f]/.test(v))throw new Error('Architecture: nội dung không hợp lệ.');return v.trim();}
function list(v,fn,min=1,max=20){if(!Array.isArray(v)||v.length<min||v.length>max)throw new Error('Architecture: danh sách không hợp lệ.');return v.map(fn);}
function fields(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!(k in v)))throw new Error('Architecture: schema không hợp lệ.');}
export function normalizeArchitecture(v){
 fields(v,['overview','stack','components','relationships','dataStorage','integrations','securityNfr','deploymentRules',...(v?.compliancePolicy!==undefined?['compliancePolicy']:[]),...(v?.deploymentSupport!==undefined?['deploymentSupport']:[])]);
 const result={overview:text(v.overview),stack:list(v.stack,x=>{fields(x,['technology','rationale','tradeOff']);return {technology:text(x.technology),rationale:text(x.rationale),tradeOff:text(x.tradeOff)};}),components:list(v.components,x=>{fields(x,['id','name','responsibility','boundary']);if(!/^[a-zA-Z][\w-]{0,39}$/.test(x.id))throw new Error('Architecture: component id không hợp lệ.');return {id:x.id,name:text(x.name),responsibility:text(x.responsibility),boundary:text(x.boundary)};},1,12)};
 const ids=new Set(result.components.map(x=>x.id));if(ids.size!==result.components.length)throw new Error('Architecture: component id trùng.');
 result.relationships=list(v.relationships,x=>{fields(x,['from','to','contract']);if(!ids.has(x.from)||!ids.has(x.to)||x.from===x.to)throw new Error('Architecture: quan hệ tham chiếu sai component.');return {from:x.from,to:x.to,contract:text(x.contract)};},result.components.length>1?1:0,30);
 for(const key of ['dataStorage','integrations','securityNfr','deploymentRules'])result[key]=list(v[key],text);
 if(v.compliancePolicy!==undefined)result.compliancePolicy=normalizePolicy(v.compliancePolicy,result.components);
 if(v.deploymentSupport!==undefined){fields(v.deploymentSupport,['targets','rationale']);const targets=list(v.deploymentSupport.targets,normalizeDeploymentTarget,1,5);if(new Set(targets).size!==targets.length)throw new Error('Deployment support trùng đích.');result.deploymentSupport={targets,rationale:text(v.deploymentSupport.rationale)};}
 return result;
}
export function architectureHash(a){return hash([a.id,a.version,a.specificationId,a.specificationVersion,a.requirementsHash,a.proposal,...(a.changeProposalId?[a.changeProposalId]:[]),...(a.deploymentTarget!==undefined?[a.deploymentTarget]:[])]);}
export function architectureCurrent(p,a){const s=currentSpecification(p);return !!s&&s.id===a.specificationId&&s.version===a.specificationVersion&&requirementsFingerprint(p,s)===a.requirementsHash;}
export function architectureDocument(p,a){
 if(a.contentHash!==architectureHash(a))throw new Error('Architecture đã thay đổi ngoài luồng duyệt.');
 normalizeArchitecture(a.proposal);
 const current=architectureCurrent(p,a)&&!(a.id===p.approvedArchitectureId&&deploymentImpact(p).blocked)&&(p.currentArchitectureId===a.id||p.approvedArchitectureId===a.id);
 return {...a,current,displayStatus:current?a.status:'outdated',readOnly:true};
}
export function architectureHistory(p){return {changeProposals:p.architectureChangeProposals||[],required:true,current:p.currentArchitectureId||null,approved:p.approvedArchitectureId||null,history:(p.architectures||[]).map(a=>architectureDocument(p,a)).reverse()};}
export function approvedArchitecture(p){
 const a=(p.architectures||[]).find(a=>a.id===p.approvedArchitectureId);
 if(!a||a.status!=='approved'||!a.approvedAt||!architectureCurrent(p,a))throw new Error('Hãy duyệt Architecture Lite hiện tại tại AI Council trước khi phát triển.');
 assertDeploymentArchitecture(p);return architectureDocument(p,a);
}
export function architectureContext(p){const a=approvedArchitecture(p);return '\nDeployment Target hiện tại: '+deploymentTarget(p)+' (không cấp quyền tự triển khai).\nĐánh giá tác động: '+JSON.stringify(deploymentImpact(p))+'\n\nKIẾN TRÚC CHÍNH THỨC — chỉ đọc; thay đổi cần PO duyệt phiên bản mới.\n'+architectureMarkdown(a);}
export function architectureMarkdown(a){
 const clean=v=>String(v).replace(/[<>]/g,'').replace(/([\\`*_\[\]#])/g,'\\$1');
 const b=a.proposal,lines=[`# ARCHITECTURE v${a.version}`,`Trạng thái: ${a.status} · Specification v${a.specificationVersion} (${a.specificationId})`,`PO duyệt: ${a.approvedAt||'Chưa duyệt'} · SHA-256: ${a.contentHash}`];
 const section=(name,items)=>lines.push('## '+name,...items.map(clean));
 section('1. Tổng quan hệ thống',[b.overview]);section('2. Tech Stack · lý do và đánh đổi',b.stack.map(x=>`${x.technology}: ${x.rationale} · Đánh đổi: ${x.tradeOff}`));
 section('3. Cấu trúc component / module',b.components.map(x=>`${x.id}: ${x.name}`));section('4. Trách nhiệm và ranh giới',b.components.map(x=>`${x.name}: ${x.responsibility} · Ranh giới: ${x.boundary}`));
 section('5. Luồng dữ liệu và lưu trữ',[...b.relationships.map(x=>`${x.from} → ${x.to}: ${x.contract}`),...b.dataStorage]);section('6. Tích hợp và API contracts',b.integrations);section('7. Bảo mật và yêu cầu phi chức năng',b.securityNfr);section('8. Triển khai và quy tắc kiến trúc',b.deploymentRules);
 lines.push('### Deployment Target',clean(a.deploymentTarget||'not-specified')+' · Bàn giao thủ công; không cấp quyền tự triển khai.');if(b.deploymentSupport)lines.push('Đích được baseline hỗ trợ: '+b.deploymentSupport.targets.map(clean).join(', '),clean(b.deploymentSupport.rationale));
 if(b.compliancePolicy)lines.push('### Quy tắc compliance đã được PO duyệt','```json\n'+JSON.stringify(b.compliancePolicy,null,2)+'\n```');
 return lines.join('\n\n')+'\n';
}
