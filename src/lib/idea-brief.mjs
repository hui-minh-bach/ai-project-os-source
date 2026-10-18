export const IDEA_FEATURES = Object.freeze(['auth','database','payments','dashboard','mobile','storage','domain','backend']);
export const PRODUCT_TYPES = Object.freeze(['web-saas','website','mobile-app','desktop-app','api','automation','other']);
function text(value, key, max, required=false) {
  if (typeof value!=='string'||value.length>max||/[\x00]/.test(value)) throw new Error(`${key} không hợp lệ (tối đa ${max} ký tự).`);
  const out=value.trim(); if(required&&!out)throw new Error(`${key} không được trống.`); return out;
}
function list(value,key,{required=false,max=20,length=1000}={}) {
  if(!Array.isArray(value)||value.length>max)throw new Error(`${key} phải là danh sách tối đa ${max} mục.`);
  const out=[...new Set(value.map(x=>text(x,key,length,true)))]; if(required&&!out.length)throw new Error(`${key} không được trống.`);return out;
}
export function projectBriefInput(input={},current={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Thông tin dự án không hợp lệ.');
  const out={name:current.name||'Dự án mới',idea:current.idea||'',productType:current.productType||'',audience:current.audience||'',goals:current.goals||'',mainFeatures:current.mainFeatures||[]};
  for(const [key,max] of [['name',100],['idea',12000],['audience',3000],['goals',6000]])if(key in input)out[key]=text(input[key],key,max,key==='name');
  if('productType' in input){if(input.productType!==''&&!PRODUCT_TYPES.includes(input.productType))throw new Error('Loại sản phẩm không hợp lệ.');out.productType=input.productType;}
  if('mainFeatures' in input){out.mainFeatures=list(input.mainFeatures,'Tính năng',{max:IDEA_FEATURES.length,length:40});if(out.mainFeatures.some(x=>!IDEA_FEATURES.includes(x)))throw new Error('Tính năng không hợp lệ.');}
  return out;
}
export function normalizeIdeaStack(raw,{legacy=false}={}) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('AI Stack không hợp lệ.');
  const out={};
  for(const key of ['needsGithub','needsVercel','needsDatabase','needsAuth','needsStorage','needsPayments','needsDomain','needsBackend']){
    if(legacy&&raw[key]===undefined&&['needsGithub','needsVercel'].includes(key)){out[key]=key==='needsGithub'?raw.recommended?.source==='github':raw.recommended?.deploy==='vercel';continue;}
    if(typeof raw[key]!=='boolean')throw new Error(`AI Stack: ${key} phải là boolean.`);out[key]=raw[key];
  }
  const rec=raw.recommended;if(!rec||typeof rec!=='object')throw new Error('AI Stack thiếu recommended.');out.recommended={};
  for(const [key,choices] of [['source',['github','none','other']],['deploy',['vercel','none','other']],['database',['supabase','none','other']]]){if(!choices.includes(rec[key]))throw new Error(`AI Stack: recommended.${key} không hợp lệ.`);out.recommended[key]=rec[key];}
  out.reasons=list(raw.reasons,'Lý do',{max:20,length:2000});out.setupOrder=list(raw.setupOrder,'Thứ tự thiết lập',{max:20,length:500});return out;
}
export function normalizeAnalyzedBrief(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('AI không trả project brief hợp lệ.');
  const out={};for(const key of ['summary','problem','audience'])out[key]=text(raw[key],key,4000,true);
  for(const key of ['goals','features','userFlows','constraints','openQuestions','successCriteria'])out[key]=list(raw[key],key,{required:['goals','features','userFlows','successCriteria'].includes(key)});
  out.stack=normalizeIdeaStack(raw.stack);return out;
}
export function briefContext(p) {
  return JSON.stringify({name:p.name,idea:p.idea,productType:p.productType||'',audience:p.audience||'',goals:p.goals||'',mainFeatures:p.mainFeatures||[],messages:(p.messages||[]).slice(-20).map(m=>({role:m.role,content:m.content}))});
}
export const IDEA_BRIEF_SCHEMA='{"summary":string,"problem":string,"audience":string,"goals":string[],"features":string[],"userFlows":string[],"constraints":string[],"openQuestions":string[],"successCriteria":string[],"stack":{"needsGithub":boolean,"needsVercel":boolean,"needsDatabase":boolean,"needsAuth":boolean,"needsStorage":boolean,"needsPayments":boolean,"needsDomain":boolean,"needsBackend":boolean,"recommended":{"source":"github|none|other","deploy":"vercel|none|other","database":"supabase|none|other"},"reasons":string[],"setupOrder":string[]}}';
