import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { workspaceDir, safeResolve } from './workspace.mjs';
import { approvedArchitecture } from './project-architecture.mjs';
import { currentApprovedPrd } from './project-prd.mjs';
import { approvedSpecification } from './council-spec.mjs';
import { pathMatches } from './architecture-policy.mjs';
import { must } from './shell.mjs';

const digest=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
export const architectureGuardEnabled=p=>!!p?.id;
const criteria=t=>(t.acceptanceCriteria||[]).map(c=>({id:c.id,text:c.text}));
export class ArchitectureBlockedError extends Error{
 constructor(receipt){super('Architecture BLOCKED: '+receipt.findings.filter(f=>f.severity==='BLOCKED').map(f=>f.message).join(' · '));this.name='ArchitectureBlockedError';this.receipt=receipt;}
}
export function taskArchitectureReference(p,task,moduleIds){
 if(!architectureGuardEnabled(p))return null;
 currentApprovedPrd(p);const a=approvedArchitecture(p),s=approvedSpecification(p),ids=moduleIds||a.proposal.components.map(c=>c.id);
 if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!a.proposal.components.some(c=>c.id===id)))throw new Error('Module của task không thuộc Architecture đã duyệt.');
 return {specificationId:s.id,specificationVersion:s.version,architectureId:a.id,architectureVersion:a.version,architectureHash:a.contentHash,moduleIds:ids,rulesHash:digest([a.proposal.deploymentRules,a.proposal.securityNfr,a.proposal.compliancePolicy||null]),acceptanceHash:digest(criteria(task))};
}
export function assertTaskArchitecture(p,task,run){
 if(!architectureGuardEnabled(p))throw new Error('Không tìm thấy dự án để xác minh Architecture.');
 const ref=task.architectureReference;
 if(!ref)throw new Error('Task chưa tham chiếu phiên bản Architecture. PO cần gắn baseline hiện tại hoặc lập kế hoạch lại.');
 const expected=taskArchitectureReference(p,task,ref.moduleIds);
 if(JSON.stringify(expected)!==JSON.stringify(ref)||task.specificationId!==expected.specificationId)throw new Error('Task tham chiếu Architecture/Specification cũ hoặc tiêu chí đã đổi. PO cần xem và gắn lại baseline.');
 if(!criteria(task).length||criteria(task).some(c=>!c.id||typeof c.text!=='string'||!c.text.trim()))throw new Error('Task cần acceptance criteria trước khi thực thi.');
 if(run&&JSON.stringify(run.architectureReference)!==JSON.stringify(ref))throw new Error('Architecture reference thay đổi trong khi task đang chạy.');
 return expected;
}
export function taskGuardContext(p,task){
 const ref=assertTaskArchitecture(p,task);
 const a=approvedArchitecture(p),modules=a.proposal.components.filter(c=>ref.moduleIds.includes(c.id));
 return '\nARCHITECTURE COMPLIANCE — significant deviations require a new PO-approved Architecture, never self-approve.\n'+JSON.stringify({reference:ref,applicableModules:modules,architectureRules:a.proposal.deploymentRules,security:a.proposal.securityNfr,compliancePolicy:a.proposal.compliancePolicy||null,acceptanceCriteria:criteria(task)});
}
function receipt(ref,findings,details={}){return {id:crypto.randomUUID(),source:'runtime',kind:'architecture-compliance',at:new Date().toISOString(),status:findings.some(f=>f.severity==='BLOCKED')?'BLOCKED':findings.length?'WARNING':'PASS',reference:ref,findings,...details};}
export function failureReceipt(p,task,error,stage){return receipt(task?.architectureReference||null,[{severity:'BLOCKED',code:'BASELINE_OR_SCAN_INVALID',message:String(error.message||error)}],{stage});}
export function assertCompliance(r){if(r.status==='BLOCKED')throw new ArchitectureBlockedError(r);return r;}
const source=/\.(?:[cm]?[jt]sx?)$/i;
const textFile=/\.(?:[cm]?[jt]sx?|json|ya?ml|md|txt|html?|css|scss|svg|sql|prisma|toml|ini|xml|graphql|gql|proto|lock|py|go|rs|java|rb|php|sh)$/i;
const staticFile=/\.(?:html?|css|scss|md|txt|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf)$/i;
const reserved=/(^|\/)(?:ARCHITECTURE(?:-v\d+)?\.md|PRD(?:-v\d+)?\.md|SPECIFICATION\.md|architecture-baseline\.json)$/i;
const critical=/(^|\/)(?:api|contracts?|auth|security|permissions?|migrations?|database|db|prisma|supabase|\.github)(\/|\.)|(?:\.gitattributes|\.gitmodules|schema|openapi|swagger|dockerfile|compose|middleware|vite\.config|next\.config|tsconfig|jsconfig)|\.(?:sql|prisma|graphql|gql|proto)$/i;
const manifest=/(^|\/)(?:package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|requirements.*\.txt|pyproject\.toml|Cargo\.(?:toml|lock)|go\.(?:mod|sum)|Gemfile|composer\.json|deno\.json|bun\.lockb?)$/i;
const risky=/\b(?:eval|Function|exec|spawn|createServer|createConnection|createClient|fetch|XMLHttpRequest|WebSocket)\s*\(|\b(?:app|router)\s*\.\s*(?:get|post|put|patch|delete|use)\s*\(|\b(?:Authorization|Access-Control-Allow-Origin|dangerouslySetInnerHTML|innerHTML|jwt|bcrypt|password|credentials|csrf|cors|authenticate|authorize|rowLevelSecurity|disableSecurity|DatabaseSync|PrismaClient|MongoClient|getBuiltinModule)\b|\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|POLICY|DATABASE)\b|\b(?:db|prisma|supabase|sequelize|mongoose)\s*\.|\bprocess\.(?:env|binding)\b/i;
function owner(policy,file){return policy.modules.flatMap(m=>m.paths.filter(prefix=>pathMatches(file,prefix)).map(prefix=>({module:m,length:prefix==='.'?0:prefix.length}))).sort((a,b)=>b.length-a.length)[0]?.module;}
async function tree(cwd,ref){
 const output=(await must('git',['ls-tree','-rlz',ref],{cwd})).stdout;
 if(output.length>450000)throw new Error('Git tree vượt giới hạn kiểm tra; không dùng dữ liệu bị cắt.');
 const rows=output.split('\0').filter(Boolean).map(row=>{const m=row.match(/^(\d+) (\w+) ([a-f0-9]+) +([\d-]+)\t([\s\S]+)$/);if(!m)throw new Error('Không đọc được Git tree.');return {mode:m[1],type:m[2],oid:m[3],size:Number(m[4]),path:m[5]};});
 if(rows.length>2000)throw new Error('Quá 2000 file; cần chia nhỏ phạm vi hoặc nâng cấp bộ kiểm tra.');return new Map(rows.map(r=>[r.path,r]));
}
async function content(cwd,row,budget){
 if(!row)return '';
 if(row.type!=='blob'||row.mode==='120000')throw new Error('Không đọc symlink/submodule trong kiểm tra kiến trúc.');
 if(row.size>180000||(budget.bytes+=row.size)>8000000)throw new Error('Nội dung vượt giới hạn kiểm tra.');
 const text=(await must('git',['cat-file','blob',row.oid],{cwd})).stdout;
 if(Buffer.byteLength(text)!==row.size||text.includes('\0'))throw new Error('Nội dung binary/encoding không được bộ kiểm tra hỗ trợ.');return text;
}
function imports(text){
 const literals=[];
 for(const m of text.matchAll(/\b(?:import|export)\s+(?:[^;'"\n]*?\s+from\s*)?['"]([^'"]+)['"]|\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g))literals.push(m[1]||m[2]);
 return literals;
}
function publicSurface(text){return [...text.matchAll(/\bexport\s+(?:default\s+)?(?:async\s+)?(?:function\s+(\w+)\s*\(([^)]*)\)|class\s+[^\n]+|(?:const|let|var)\s+[^\n]+)|\bexport\s*\{[^}]+\}[^\n]*|\bexport\s+\*(?:\s+as\s+\w+)?\s+from\s*['"][^'"]+['"]|\bexports\.\w+\s*=[^\n]*|\bmodule\.exports\s*=[^\n]*|\bexport\s+default[^\n]*/g)].map(m=>m[0].replace(/\s+/g,' ')).sort();}

// Immutable Git objects, never a truncated diff or an Agent's report.
export async function inspectArchitecture({project,task,run,cwd,baseSha,targetSha,stage='coding'}){
 let ref;
 try{ref=assertTaskArchitecture(project,task,run);}catch(e){return failureReceipt(project,task,e,stage);}

 const a=approvedArchitecture(project),policy=a.proposal.compliancePolicy,findings=[];
 const add=(severity,code,file,message)=>findings.push({severity,code,path:file,message});
 try{
  const [before,after]=await Promise.all([tree(cwd,baseSha),tree(cwd,targetSha)]),budget={bytes:0},cache=new Map();
  const read=async row=>{if(!row)return '';if(!cache.has(row.oid))cache.set(row.oid,await content(cwd,row,budget));return cache.get(row.oid);};
  const changed=[...new Set([...before.keys(),...after.keys()])].filter(file=>before.get(file)?.oid!==after.get(file)?.oid||before.get(file)?.mode!==after.get(file)?.mode);
  if(changed.length>150)throw new Error('Quá 150 file thay đổi; cần chia nhỏ task để kiểm chứng.');
  if(!policy)add('WARNING','TEXT_ONLY_BOUNDARIES','', 'Baseline mô tả bằng văn bản: chưa chứng minh được ranh giới bằng đường dẫn. Chỉ thay đổi file tĩnh được phép; mã thực thi cần policy được PO duyệt.');
  const approvedFile=file=>policy?.protectedFiles.find(f=>f.path===file);
  const allowedBytes=async file=>{const f=approvedFile(file),row=after.get(file);return !!f&&(f.sha256==='deleted'?!row:!!row&&f.sha256===digest(await read(row)));};
  for(const file of changed){
   const old=before.get(file),next=after.get(file);
   if(reserved.test(file)){add('BLOCKED','BASELINE_EDIT',file,'Worker không được sửa bản Architecture/Specification/PRD.');continue;}
   if(next&&(next.type!=='blob'||!['100644','100755'].includes(next.mode))){add('BLOCKED','UNSUPPORTED_GIT_ENTRY',file,'Symlink/submodule không được phép trong thay đổi kiến trúc.');continue;}
   if(next?.mode==='100755'&&old?.mode!=='100755')add('BLOCKED','EXECUTABLE_CHANGE',file,'Thêm quyền thực thi cần PO xem xét.');
   const approved=await allowedBytes(file);
   if(approvedFile(file)&&!approved){add('BLOCKED','PROTECTED_CONTRACT',file,'API/database/security/config khác hash được PO duyệt (kể cả xóa file).');continue;}
   if(critical.test(file)&&!approved)add('BLOCKED','CRITICAL_ARCHITECTURE',file,'Thay đổi API, database, security hoặc deployment cần hash nội dung được PO duyệt.');
   if(policy){const module=owner(policy,file);if(!module||!ref.moduleIds.includes(module.componentId))add('BLOCKED','MODULE_SCOPE',file,'File ngoài module/boundary áp dụng cho task.');}
   if(manifest.test(file)&&!approved){
    if(path.posix.basename(file)==='package.json'){
     let prev,nextPackage;try{prev=JSON.parse(await read(old)||'{}');nextPackage=JSON.parse(await read(next)||'{}');}catch{add('BLOCKED','INVALID_MANIFEST',file,'Không phân tích được dependency manifest.');continue;}
     for(const section of ['dependencies','devDependencies','peerDependencies','optionalDependencies']){
      const x=prev[section]||{},y=nextPackage[section]||{};
      for(const name of new Set([...Object.keys(x),...Object.keys(y)]))if(x[name]!==y[name]&&(!y[name]||!policy?.dependencies.some(d=>d.name==='npm:'+name&&d.version===y[name])))add('BLOCKED','DEPENDENCY_CHANGE',file,`Dependency ${name} thay đổi ngoài giá trị được PO duyệt.`);
     }
     const metadata=x=>Object.fromEntries(Object.entries(x).filter(([k])=>!['name','version','description','license','dependencies','devDependencies','peerDependencies','optionalDependencies'].includes(k)));
     if(JSON.stringify(metadata(prev))!==JSON.stringify(metadata(nextPackage)))add('BLOCKED','PACKAGE_EXECUTION_CONFIG',file,'Script, module resolution hoặc package config đổi cần PO duyệt hash.');
    }else add('BLOCKED','UNSUPPORTED_MANIFEST_CHANGE',file,'Lockfile/manifest này cần PO duyệt hash; không suy đoán dependency resolution.');
   }
   if(!next) {if(source.test(file)&&!approved)add('BLOCKED','MODULE_REMOVAL',file,'Xóa module có thể phá API; cần Architecture Change Proposal.');continue;}
   if(!textFile.test(file)) {if(!staticFile.test(file)&&!approved)add('BLOCKED','UNSUPPORTED_FILE',file,'Loại file chưa có bộ kiểm tra; cần policy/hash được PO duyệt.');continue;}
   const nextText=await read(next),oldText=await read(old);
   if(!approved&&staticFile.test(file)&&(/<script\b|\bon[a-z]+\s*=|(?:src|href)\s*=\s*["'](?:https?:)?\/\/|@import\b/i.test(nextText+'\n'+oldText)))add('BLOCKED','ACTIVE_STATIC_CONTENT',file,'Script, event handler hoặc tài nguyên bên ngoài trong static file cần PO duyệt hash.');
   if(!old&&source.test(file))add('WARNING','NEW_MODULE_REVIEW',file,'Module mới: cần kiểm tra chức năng trùng và sự cần thiết.');
   if(!approved&&risky.test(nextText+'\n'+oldText)&&nextText!==oldText)add('BLOCKED','SECURITY_OR_API_LOGIC',file,'Mã có dấu hiệu API/security/integration thay đổi; yêu cầu PO xem xét, đây là bộ lọc bảo thủ.');
   if(source.test(file)){
    if(!policy&&!approved)add('BLOCKED','MISSING_MACHINE_POLICY',file,'Mã thực thi cần module policy được PO duyệt.');
    if(old&&!approved&&(/\bexport\s+(?:default\s+)?class\b|\bmodule\.exports\b|\bexports\.|\bexport\s*(?:\{|default\s*\{)/.test(oldText)||(oldText.match(/\bexport\b/g)||[]).length>publicSurface(oldText).length))add('BLOCKED','OPAQUE_PUBLIC_SURFACE',file,'Class, CommonJS, export-list hoặc cú pháp public chưa được phân tích đầy đủ; cần PO duyệt hash thay vì suy đoán tương thích.');
    if(old&&!approved&&publicSurface(oldText).some(item=>!publicSurface(nextText).includes(item)))add('BLOCKED','BREAKING_PUBLIC_SURFACE',file,'Export hoặc chữ ký công khai bị xóa/thay đổi.');
    if(!approved)add('WARNING','SEMANTIC_REVIEW_REQUIRED',file,'Static checks không chứng minh được hành vi/API tương đương; cần đọc diff và test liên quan.');
   }else if(!staticFile.test(file)&&!manifest.test(file)&&!approved)add('BLOCKED','UNSUPPORTED_LANGUAGE',file,'Ngôn ngữ/định dạng thực thi chưa được hỗ trợ; không tự cho PASS.');
   if(policy)for(const rule of policy.rules)if(rule.paths.some(prefix=>pathMatches(file,prefix))&&rule.forbiddenText.some(text=>nextText.includes(text)))add('BLOCKED','ARCHITECTURE_RULE',file,`${rule.id}: ${rule.description}`);
   if(!old&&nextText.trim().length>80)for(const [existing,row] of before){if(existing!==file&&row.oid===next.oid){add('WARNING','POTENTIAL_DUPLICATE',file,`Nội dung giống ${existing}; kiểm tra chức năng trùng hoặc module không cần thiết.`);break;}}
  }
  // Scan all JS/TS modules in the candidate tree, including unchanged consumers.
  if(policy)for(const [file,row] of after){
   if(!source.test(file))continue;const module=owner(policy,file);if(!module)continue;
   const text=await read(row);
   const stripped=text.replace(/\b(?:require|import)\s*\(\s*['"][^'"]+['"]\s*\)/g,'');
   if(/\brequire\b|\bimport\s*(?:\(|\/\*)/.test(stripped))add('BLOCKED','DYNAMIC_IMPORT',file,'Không xác minh được import động; cần đường dẫn literal.');
   if(/\b(?:require\.resolve|createRequire|module\s*\[|module\.require|_load)\b/.test(text))add('BLOCKED','INDIRECT_LOADER',file,'Module loader gián tiếp chưa được hỗ trợ.');
   for(const imported of imports(text)){
    if(/^(?:node:)?(?:sqlite|fs(?:\/promises)?|crypto|net|http2?|https|tls|child_process|vm|module|worker_threads|process)$/.test(imported)&&!(await allowedBytes(file))){add('BLOCKED','SENSITIVE_RUNTIME_IMPORT',file,`Import ${imported} có quyền hệ thống/database/security; cần hash code được PO duyệt.`);continue;}
    if(imported.startsWith('node:'))continue;
    if(imported.startsWith('.')){
     const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(file),imported));
     if(resolved.startsWith('../')){add('BLOCKED','IMPORT_ESCAPE',file,'Import vượt project root.');continue;}
     const candidates=[resolved,...['.js','.mjs','.cjs','.ts','.tsx','.jsx','/index.js','/index.ts'].map(ext=>resolved+ext)],target=candidates.find(p=>after.has(p));
     const to=target&&owner(policy,target);
     if(!target||!to||to.componentId!==module.componentId&&!module.allowedImports.includes(to.componentId))add('BLOCKED','MODULE_IMPORT',file,`Import ${imported} vi phạm module boundary hoặc không resolve được.`);
    }else{
     const name=imported.startsWith('@')?imported.split('/').slice(0,2).join('/'):imported.split('/')[0];
     if(!policy.dependencies.some(d=>d.name==='npm:'+name))add('BLOCKED','UNAPPROVED_IMPORT',file,`Import ${imported} chưa thuộc Tech Stack được PO duyệt; dùng node: cho built-in.`);
    }
   }
  }
  const changedArtifacts=[];for(const file of changed){const row=after.get(file);changedArtifacts.push({path:file,sha256:!row?'deleted':textFile.test(file)?digest(await read(row)):null});}
  return receipt(ref,findings,{stage,baseSha,targetSha,changedFiles:changed,changedArtifacts,policy:policy?'structured':'text-only',evidence:'immutable-git-objects',limitations:['Literal JS/TS imports and conservative export/signature checks; no proof of semantic API compatibility.','Duplicate detection compares exact blobs only; necessity and semantic duplication require human review.']});
 }catch(e){return {...failureReceipt(project,task,e,stage),baseSha,targetSha,evidence:'scan-incomplete'};}
}

// Evidence for a new proposal, not an approval or a rewrite of the baseline.
export async function architectureProposalEvidence(project,changeProposal){
 const cwd=workspaceDir(project.id),files=[];let bytes=0,incomplete=false;
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(files.length>=250){incomplete=true;return;}
  if(entry.isSymbolicLink()||['.git','node_modules','dist','build','.next'].includes(entry.name))continue;
  const file=path.join(dir,entry.name),relative=path.relative(cwd,file).split(path.sep).join('/');
  try{safeResolve(cwd,relative);}catch{continue;}
  if(entry.isDirectory()){walk(file);continue;}
  if(!entry.isFile())continue;
  const size=fs.statSync(file).size;
  if(textFile.test(relative)&&size<=180000&&bytes+size<=2000000){const content=fs.readFileSync(file,'utf8');bytes+=size;if(!content.includes('\0')&&Buffer.byteLength(content)===size)files.push({path:relative,sha256:digest(content),...(manifest.test(relative)?{manifest:content}:{})});}
  else{files.push({path:relative,sha256:null});incomplete=true;}
 }}walk(cwd);
 const evidence={source:'local-workspace-inventory',files,incomplete,notice:'Hashes describe bytes on disk, not architectural approval. Candidate changes require a new PO-approved policy.'};
 if(changeProposal?.baseSha&&changeProposal?.candidateSha&&[changeProposal.baseSha,changeProposal.candidateSha].every(s=>/^[a-f0-9]{40,64}$/.test(s))){
  const result=(await must('git',['diff','--no-ext-diff','--no-textconv','--unified=3',changeProposal.baseSha,changeProposal.candidateSha,'--'],{cwd})).stdout;
  evidence.candidateDiff=result.length<180000?result:null;evidence.candidateDiffOmitted=result.length>=180000;
 }
 return evidence;
}
