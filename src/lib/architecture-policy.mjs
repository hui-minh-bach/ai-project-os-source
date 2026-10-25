// Optional, PO-approved machine-checkable addition to Architecture Lite.
export const POLICY_SCHEMA={modules:[{componentId:'component id',paths:['src/frontend/'],allowedImports:['component id']}],dependencies:[{name:'npm:package-name',version:'exact approved package.json value'}],protectedFiles:[{path:'api/openapi.json',sha256:'64 lowercase hex characters',kind:'api|database|security|config'}],rules:[{id:'rule-id',description:'Vietnamese rationale',paths:['src/'],forbiddenText:['literal forbidden text']} ]};
export function policyPath(value){if(typeof value!=='string'||!value||value.length>240||value.startsWith('/')||value.includes('\\')||value.split('/').some(x=>['..','.git','node_modules'].includes(x))||/[\x00-\x1f:*?]/.test(value))throw new Error('Đường dẫn compliance policy không hợp lệ.');return value;}
export const pathMatches=(file,prefix)=>prefix==='.'||file===prefix||prefix.endsWith('/')&&file.startsWith(prefix);
export function normalizePolicy(policy,components){
 const array=(v,max=100)=>{if(!Array.isArray(v)||v.length>max)throw new Error('Compliance policy: danh sách không hợp lệ.');return v;};
 const text=v=>{if(typeof v!=='string'||!v.trim()||v.length>1000)throw new Error('Compliance policy: nội dung không hợp lệ.');return v;};
 if(!policy||typeof policy!=='object'||Object.keys(policy).sort().join(',')!=='dependencies,modules,protectedFiles,rules')throw new Error('Compliance policy: schema không hợp lệ.');
 const ids=new Set(components.map(c=>c.id)),paths=new Set();
 const modules=array(policy.modules,12).map(m=>{
  if(!ids.has(m.componentId))throw new Error('Compliance policy: component không tồn tại.');
  const roots=array(m.paths).map(p=>{policyPath(p);if(paths.has(p))throw new Error('Compliance policy: module path trùng.');paths.add(p);return p;});
  if(!roots.length)throw new Error('Compliance policy: module cần paths.');
  const allowedImports=array(m.allowedImports,12).map(id=>{if(!ids.has(id))throw new Error('Compliance policy: import component sai.');return id;});
  return {componentId:m.componentId,paths:roots,allowedImports};
 });
 if(!modules.length||new Set(modules.map(m=>m.componentId)).size!==modules.length)throw new Error('Compliance policy: cần các module không trùng.');
 const dependencies=array(policy.dependencies).map(d=>{if(!/^npm:(?:@[\w.-]+\/)?[\w.-]+$/.test(d.name))throw new Error('Compliance policy chỉ hỗ trợ dependency npm.');return {name:d.name,version:text(d.version)};});
 const protectedFiles=array(policy.protectedFiles).map(f=>{policyPath(f.path);if(!(f.sha256==='deleted'||/^[a-f0-9]{64}$/.test(f.sha256))||!['api','database','security','config'].includes(f.kind))throw new Error('Compliance policy: protected file không hợp lệ.');return {path:f.path,sha256:f.sha256,kind:f.kind};});
 for(const entries of [dependencies.map(d=>d.name),protectedFiles.map(f=>f.path)])if(new Set(entries).size!==entries.length)throw new Error('Compliance policy: mục trùng.');
 const rules=array(policy.rules,30).map(r=>({id:text(r.id),description:text(r.description),paths:array(r.paths).map(policyPath),forbiddenText:array(r.forbiddenText,20).map(text)}));
 if(rules.some(r=>!r.paths.length||!r.forbiddenText.length))throw new Error('Compliance policy: rule cần phạm vi và forbiddenText.');
 return {modules,dependencies,protectedFiles,rules};
}
