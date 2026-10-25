/** Image task dispatcher. Select only connected image-capable adapters/models.
 * Bounded account handoff; policy refusal never falls back. No hard-coded model
 * substituted for an absent catalog. Billing needs the caller's approved pool. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {listConnections, getConnection, vaultStatus} from './vault.mjs';
import {modelAvailability, connectionHasCredential} from './model-bindings.mjs';
import {listModels} from './providers.mjs';
import {generateAccountImage,accountImageCapability} from './account-auth.mjs';
import {observeSpaceCall} from './space-activity.mjs';
import {localWorkers} from './local-workers.mjs';
import {comfyImageBridge} from './comfyui-local.mjs';
const err=(code,message)=>Object.assign(new Error(message),{code});
export const IMAGE_PROVIDERS=Object.freeze(['auto','chatgpt-account','gemini-api','openai-api','local-flux','comfyui-local']);
export const ACCOUNT_KINDS_WITHOUT_IMAGE=Object.freeze(['claude_account','gemini_account','antigravity_account']);
const routes={chatgpt_account:'chatgpt-account',gemini:'gemini-api',openai:'openai-api'};
export function imageFailureReason(e){
 const code=String(e?.code||'');
 const known={CODEX_RATE_LIMIT:'Hết hạn mức tạo ảnh trong cửa sổ hiện tại',PROVIDER_QUOTA:'Hết hạn mức của tài khoản',CODEX_AUTH_EXPIRED:'Phiên đăng nhập hết hạn',CODEX_ACCESS_DENIED:'Tài khoản không có quyền dùng model',CODEX_MODEL_UNAVAILABLE:'Model không còn khả dụng',CODEX_NETWORK_ERROR:'Kết nối dịch vụ bị gián đoạn',CODEX_IMAGE_PAYLOAD:'Dữ liệu ảnh vượt giới hạn kết nối',CODEX_SESSION_CLOSED:'Phiên tạo ảnh bị đóng',CODEX_RPC_METHOD:'Codex CLI chưa hỗ trợ thao tác tạo ảnh',CODEX_RPC_PARAMS:'Tham số giao thức tạo ảnh không tương thích',IMAGE_CLI_VERSION:'Phiên bản CLI chưa được kiểm chứng',IMAGE_EMPTY:'Không nhận được dữ liệu ảnh',IMAGE_POLICY:'Nhà cung cấp từ chối theo chính sách',BLOCKED_PROVIDER:'Nhà cung cấp không trả ảnh hợp lệ',COMFY_OFFLINE:'ComfyUI chưa phản hồi',COMFY_CONFIGURATION:'Chưa cấu hình workflow ComfyUI',COMFY_WORKFLOW_ERROR:'Workflow ComfyUI bị từ chối hoặc chạy lỗi; kiểm tra node và model trong ComfyUI',COMFY_EMPTY:'ComfyUI hoàn tất nhưng chưa xuất ảnh bằng SaveImage',COMFY_TIMEOUT:'ComfyUI chưa hoàn tất; kiểm tra lịch sử trước khi thử lại'};
 if(known[code])return known[code];
 if(e?.status)return 'Nhà cung cấp trả HTTP '+Number(e.status);
 const message=String(e?.message||'');if(/vượt giới hạn|exceed.*byte|payload/i.test(message))return 'Dữ liệu ảnh vượt giới hạn kết nối';if(/time|thời gian/i.test(message))return 'Tạo ảnh quá thời gian';if(/đóng|closed/i.test(message))return 'Phiên tạo ảnh bị đóng';
 return 'Lỗi khi chạy nguồn ảnh; kiểm tra kết nối nguồn này';
}
const refusal=()=>Object.assign(err('IMAGE_POLICY','Image request was refused by the provider safety policy. No other AI will retry that request.'),{retryable:false});
function providerFailure(status,body){
 const code=String(body?.error?.code||body?.error?.status||'');
 if(/content_policy|safety|moderation|prohibited|refusal/i.test(code)||body?.error?.moderation_details)return refusal();
 return Object.assign(err('IMAGE_PROVIDER_FAILED','Image provider HTTP '+status),{status,retryable:[400,401,403,404,408,409,422,429].includes(status)||status>=500});
}
export function isImageModel(kind,id){
 const m=String(id||'').replace(/^models\//,'');
 return kind==='openai'?/^gpt-image-[a-z0-9.-]+$/i.test(m):kind==='gemini'?/^(?:gemini-[a-z0-9.-]*image[a-z0-9.-]*|imagen-[a-z0-9.-]+)$/i.test(m):false;
}
const fingerprint=c=>crypto.createHash('sha256').update(JSON.stringify([c.kind,c.credentialVersion||'',c.meta?.accountIdentity||'',c.secret||'',c.baseUrl||''])).digest('hex');
const binding=c=>({connectionId:c.connectionId,name:c.name,provider:c.provider,model:c.model,revision:c.revision,bindingHash:c.bindingHash,paid:c.paid});
function assertImageBytes(bytes) {
  if (!bytes || bytes.length <= 1000) throw err('BLOCKED_PROVIDER', 'Nhà cung cấp không trả dữ liệu ảnh hợp lệ. Không lưu tệp giả.');
  const ext = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? '.png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 ? '.jpg'
    : bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP' ? '.webp' : null;
  if (!ext) throw err('BLOCKED_PROVIDER', 'Dữ liệu trả về không phải PNG/JPEG/WebP hợp lệ.');
  return ext;
}

function saveImage(bytes, output) {
  const ext = assertImageBytes(bytes);
  const finalPath = output.replace(/\.[a-z0-9]+$/i, '') + ext;
  fs.mkdirSync(path.dirname(finalPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(finalPath, bytes, { mode: 0o600 });
  return finalPath;
}

async function geminiApiImage(conn, { prompt, output, fetchImpl }) {
  const secret = conn.secret;
  if (!secret) throw err('BLOCKED_PROVIDER', 'Kết nối Gemini API chưa có khóa trong Vault.');
  const model = conn.imageModel;
  if (!model) throw err('IMAGE_CAPABILITY', 'No catalogued image model for this connection.');
  const base = (conn.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '').replace(/\/models\/[^/]+:generateContent$/, '');
  let bytes = null;
  if (/^imagen/i.test(model)) {
    const r = await fetchImpl(`${base}/models/${model}:predict`, { method: 'POST', headers: { 'x-goog-api-key': secret, 'content-type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '16:9' } }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw providerFailure(r.status,j);
    if (j?.predictions?.some(p=>p.raiFilteredReason)) throw refusal();
    const b64 = j?.predictions?.[0]?.bytesBase64Encoded;
    if (b64) bytes = Buffer.from(b64, 'base64');
  } else {
    const r = await fetchImpl(`${base}/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': secret, 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: {aspectRatio:'16:9'} } }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw providerFailure(r.status,j);
    if (j?.promptFeedback?.blockReason || j?.candidates?.some(c=>['SAFETY','IMAGE_SAFETY','PROHIBITED_CONTENT','BLOCKLIST'].includes(c.finishReason))) throw refusal();
    const part = (j?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data);
    if (part) bytes = Buffer.from(part.inlineData.data, 'base64');
  }
  if (!bytes) throw err('BLOCKED_PROVIDER', 'Gemini không trả ảnh trong phản hồi. Không thay bằng ảnh giả.');
  const file = saveImage(bytes, output);
  return { provider: 'gemini-api', model, file, bytes: bytes.length, revisedPrompt: null };
}

async function openaiApiImage(conn, { prompt, output, size, fetchImpl }) {
  const secret = conn.secret;
  if (!secret) throw err('BLOCKED_PROVIDER', 'Kết nối OpenAI API chưa có khóa trong Vault.');
  const model = conn.imageModel;
  if (!model) throw err('IMAGE_CAPABILITY', 'No catalogued image model for this connection.');
  const base = (conn.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '').replace(/\/responses$/, '');
  const r = await fetchImpl(`${base}/images/generations`, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, prompt, size: size || '1536x1024' }) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw providerFailure(r.status,j);
  if (j?.refusal || j?.data?.some(x=>x.refusal)) throw refusal();
  let bytes = null;
  if (j?.data?.[0]?.b64_json) bytes = Buffer.from(j.data[0].b64_json, 'base64');
  
  if (!bytes) throw err('BLOCKED_PROVIDER', 'OpenAI không trả ảnh trong phản hồi. Không thay bằng ảnh giả.');
  const file = saveImage(bytes, output);
  return { provider: 'openai-api', model, file, bytes: bytes.length, revisedPrompt: j?.data?.[0]?.revised_prompt || null };
}


async function localFluxImage({prompt,output,size},worker=localWorkers){
 const m=/^(\d{3,4})x(\d{3,4})$/.exec(String(size||'1024x1024'));
 const made=await worker.generateImage({prompt,width:m?+m[1]:1024,height:m?+m[2]:1024,outputBase:output});
 return {provider:'local-flux',model:made.provenance.model,file:made.file,bytes:made.bytes,revisedPrompt:null};
}
export function createImageRouter({list=listConnections,get=getConnection,unlocked=()=>vaultStatus().unlocked,availability=modelAvailability,discover=listModels,accountImage=generateAccountImage,accountCapabilities=null,fetchImpl=globalThis.fetch,comfyBridge=comfyImageBridge,worker=localWorkers}={}){
 function localCandidates(){
  const found=[];
  const comfy=comfyBridge.snapshot();
  if(comfy.configured)found.push({connectionId:'local:comfyui',name:'ComfyUI local',provider:'comfyui-local',model:'user-api-workflow',revision:comfy.workflowHash,bindingHash:comfy.workflowHash,paid:false,readiness:'configured-check-server-at-preflight'});
  const flux=worker._record?.('flux2-klein');
  if(flux?.state==='READY'&&flux.enabled!==false){
   const revision=String(flux.installedAt||'ready');
   found.push({connectionId:'local:flux2-klein',name:'FLUX.2 [klein] 4B',provider:'local-flux',model:'FLUX.2 [klein] 4B GGUF Q4_0',revision,bindingHash:crypto.createHash('sha256').update('flux2-klein:'+revision).digest('hex'),paid:false,readiness:'installed-check-on-use'});
  }
  return found;
 }
 function candidates(){
  if(!unlocked())return [];
  const found=[];const seen=new Set();
  for(const summary of list()){
   if(!routes[summary.kind])continue;
   let c;try{c=get(summary.id);}catch{continue;}
   if(!connectionHasCredential(c))continue;
   const provider=routes[c.kind];let models=[];
   if(c.kind==='chatgpt_account')models=[c.model||'account-hosted-image-tool'];
   else {
    const available=availability(c.id);const ids=available.catalogModels||available.models||[];
    models=ids.filter(m=>isImageModel(c.kind,m)).map(m=>m.replace(/^models\//,''));
    models.sort((a,b)=>a===c.model?-1:b===c.model?1:0);
   }
   // Multiple models of the same API account are candidates, not several robots.
   for(const model of [...new Set(models)].slice(0,8)){
    const signature=c.kind+':'+crypto.createHash('sha256').update(c.secret||String(c.meta?.accountIdentity||c.id)).digest('hex')+':'+model;
    if(seen.has(signature))continue;seen.add(signature);
    found.push({connectionId:c.id,name:c.name||c.id,provider,model,revision:c.credentialVersion||'',bindingHash:fingerprint(c),paid:c.kind!=='chatgpt_account',readiness:'candidate-permission-checked-on-use'});
   }
  }
  return found.sort((a,b)=>Number(a.paid)-Number(b.paid));
 }
 function status(){
  if(!unlocked())return {available:false,routes:[],candidates:[],reason:'Vault is locked.'};
  const pool=[...localCandidates(),...candidates()],configured=list().some(c=>routes[c.kind])||localCandidates().length>0;
  return {available:pool.length>0,configured,routes:[...new Set(pool.map(c=>c.provider))],candidates:pool.map(binding),automaticHandoff:true,maxAttemptsPerScene:4,reason:pool.length?null:configured?'Refresh model catalogs to discover image-capable models.':'Connect an account with image generation access.'};
 }
 async function prepare({provider='auto',allowPaid=false,refresh=true}={}){
  if(provider==='local-flux')return [];
  const local=[];
  if(provider==='auto'||provider==='comfyui-local'){
   const configured=localCandidates().find(c=>c.provider==='comfyui-local');
   if(configured){
    const health=await comfyBridge.health();
    if(health.ready)local.push(configured);
    else if(provider==='comfyui-local')throw err('COMFY_OFFLINE',health.reason||'ComfyUI không sẵn sàng.');
   }else if(provider==='comfyui-local')throw err('COMFY_CONFIGURATION','Chưa có workflow ComfyUI API Format.');
  }
  if(provider==='auto')local.push(...localCandidates().filter(c=>c.provider==='local-flux'));
  if(provider==='comfyui-local')return local.map(binding);
  if(!unlocked()){
   if(local.length)return local.map(binding);
   throw err('VAULT_LOCKED','Vault is locked.');
  }
  if(refresh){
   for(const c of list().filter(c=>['gemini','openai'].includes(c.kind))){
    if(provider!=='auto'&&routes[c.kind]!==provider)continue;
    if(!(availability(c.id).catalogModels||availability(c.id).models||[]).some(m=>isImageModel(c.kind,m))){try{await discover(c.id);}catch{/* A bad account must not prevent another account from working. */}}
   }
  }
  const checked=[],failures=[];
  for(const candidate of candidates().filter(c=>(provider==='auto'||c.provider===provider)&&(!c.paid||allowPaid))){
   if(candidate.provider==='chatgpt-account'&&accountCapabilities){try{const capability=await accountCapabilities(get(candidate.connectionId),{refresh});if(!capability.available){failures.push(candidate.name+': '+(capability.reason||'Không có công cụ tạo ảnh'));continue;}}catch(e){if(['IMAGE_SECURITY','IMAGE_IDENTITY_CHANGED','VAULT_LOCKED'].includes(e.code))throw e;failures.push(candidate.name+': '+imageFailureReason(e));continue;}}
   checked.push(candidate);
  }
  const pool=[...local,...checked];
  if(!pool.length)throw Object.assign(err('IMAGE_CAPABILITY','Chưa có nguồn ảnh đã kiểm tra dùng được. '+(failures.length?failures.join('; '):'Kiểm tra FLUX/ComfyUI hoặc chọn API ảnh có phí sau khi đồng ý.')),{failures});
  return pool.map(binding);
 }
 async function generate({provider='auto',prompt,output,size,allowPaid=false,pool=null,sceneIndex=0,maxAttempts=4,onAttempt=()=>{},usageContext={},fetchImpl:overrideFetch}={}){
  if(!IMAGE_PROVIDERS.includes(provider)||typeof prompt!=='string'||!prompt.trim()||prompt.length>4000||typeof output!=='string'||!path.isAbsolute(output))throw err('MEDIA_INPUT','Invalid image provider, prompt or output path.');
  if(provider==='local-flux')return localFluxImage({prompt,output,size},worker);
  if(provider==='comfyui-local')return comfyBridge.generate({prompt,output});
  if(!unlocked()&&!localCandidates().length)throw err('BLOCKED_PROVIDER','Vault is locked; cannot use image accounts.');
  let choices=pool||await prepare({provider,allowPaid});
  if(!Array.isArray(choices)||choices.length>128)throw err('MEDIA_INPUT','Invalid approved image pool.');
  // Never trust a client-supplied paid flag, route, model or identity binding.
  // Restore the server's binding; removing/changing an approved identity fails closed.
  const current=[...localCandidates(),...candidates()];
  choices=choices.map(selected=>{
    const actual=current.find(c=>c.connectionId===selected?.connectionId&&c.model===selected?.model);
    if(!actual||actual.bindingHash!==selected.bindingHash||actual.revision!==selected.revision)throw err('IMAGE_IDENTITY_CHANGED','Approved image identity/model changed. Review the task again.');
    if(actual.provider!==selected.provider||actual.paid!==selected.paid)throw err('IMAGE_SECURITY','Image capability/billing binding was altered.');
    return actual;
  }).filter(c=>(provider==='auto'||c.provider===provider)&&(!c.paid||allowPaid));
  if(!choices.length)throw err('IMAGE_CAPABILITY','No approved image provider remains.');
  // Distribute scenes among accounts (not only among models of the first account).
  const local=choices.filter(c=>c.provider==='comfyui-local'||c.provider==='local-flux');
  const remote=choices.filter(c=>c.provider!=='comfyui-local'&&c.provider!=='local-flux');
  const accounts=[...new Set(remote.map(c=>c.connectionId))];
  const offset=accounts.length?Math.abs(Number(sceneIndex)||0)%accounts.length:0;
  const order=accounts.slice(offset).concat(accounts.slice(0,offset));
  remote.sort((a,b)=>order.indexOf(a.connectionId)-order.indexOf(b.connectionId));
  const first=order.map(id=>remote.find(c=>c.connectionId===id));
  const rest=remote.filter(c=>!first.includes(c));choices=[...local,...first,...rest];
  const attempts=[];const failedAccounts=new Set();
  const bounded=Math.max(1,Math.min(4,Number(maxAttempts)||4));
  for(const candidate of choices){
   if(attempts.length>=bounded)break;if(failedAccounts.has(candidate.connectionId))continue;
   const isLocal=candidate.provider==='comfyui-local'||candidate.provider==='local-flux';
   if(!unlocked()&&!isLocal)throw err('VAULT_LOCKED','Vault locked during image task.');
   let c;
   if(isLocal){
    const match=localCandidates().find(x=>x.connectionId===candidate.connectionId&&x.bindingHash===candidate.bindingHash);
    if(!match)throw err('IMAGE_IDENTITY_CHANGED','Local image model/workflow changed. Approve the image plan again.');
    c={id:candidate.connectionId,name:candidate.name,kind:candidate.provider,credentialVersion:candidate.revision};
   }else{
    try{c=get(candidate.connectionId);}catch{throw err('IMAGE_IDENTITY_CHANGED','An approved image account was removed. Review the task again.');}
    if(fingerprint(c)!==candidate.bindingHash||c.credentialVersion!==candidate.revision&&String(c.credentialVersion||'')!==candidate.revision)throw err('IMAGE_IDENTITY_CHANGED','An approved image account identity changed. Review the task again.');
   }
   const receipt={connectionId:c.id,name:c.name||c.id,provider:candidate.provider,model:candidate.model,state:'running'};
   onAttempt({...receipt});
   try{
    const requestFetch=async(url,options={})=>(overrideFetch||fetchImpl)(url,{...options,signal:options.signal||AbortSignal.timeout(150000),redirect:'error'});
    let made;
    const runImage=async()=>{
     if(candidate.provider==='comfyui-local')return await comfyBridge.generate({prompt,output,expectedWorkflowHash:candidate.revision});
     if(candidate.provider==='local-flux')return await localFluxImage({prompt,output,size},worker);
     if(candidate.provider==='chatgpt-account')return await accountImage({...c,model:candidate.model},{prompt,outputPath:output});
     if(candidate.provider==='gemini-api')return await geminiApiImage({...c,imageModel:candidate.model},{prompt,output,size,fetchImpl:requestFetch});
     return await openaiApiImage({...c,imageModel:candidate.model},{prompt,output,size,fetchImpl:requestFetch});
    };
    made=isLocal?await runImage():await observeSpaceCall({...c,model:candidate.model,usageContext},runImage);
    const currentLocal=isLocal&&localCandidates().some(x=>x.connectionId===candidate.connectionId&&x.bindingHash===candidate.bindingHash);
    if((isLocal&&!currentLocal)||(!isLocal&&(!unlocked()||fingerprint(get(c.id))!==candidate.bindingHash))){if(made?.file)fs.rmSync(made.file,{force:true});throw err('IMAGE_IDENTITY_CHANGED','Image provider identity changed during generation.');}
    if(!made?.file||!fs.existsSync(made.file))throw err('IMAGE_EMPTY','Image provider returned no image file.');
    assertImageBytes(fs.readFileSync(made.file));
    receipt.state='completed';attempts.push(receipt);onAttempt({...receipt});
    return {...made,connectionId:c.id,connectionName:c.name||c.id,attempts};
   }catch(e){
    const policy=e.code==='IMAGE_POLICY'||/content.policy|safety.refusal|moderation.block|refused.*safety/i.test(String(e.message||''));
    receipt.state='failed';receipt.code=policy?'IMAGE_POLICY':String(e.code||'IMAGE_PROVIDER_ERROR');receipt.reason=imageFailureReason(e);receipt.status=e.status||null;receipt.outcome=e.status?'provider-rejected':'unknown-or-local-failure';attempts.push(receipt);onAttempt({...receipt});
    if(policy)throw Object.assign(refusal(),{attempts});
    if(['VAULT_LOCKED','IMAGE_IDENTITY_CHANGED','IMAGE_SECURITY','MEDIA_INPUT','FORBIDDEN_PATH'].includes(e.code)||e.retryable===false)throw Object.assign(e,{attempts});
    if([401,403,429].includes(e.status)||e.code==='PROVIDER_QUOTA')failedAccounts.add(c.id);
   }
  }
  throw Object.assign(err('IMAGE_POOL_EXHAUSTED','Không tạo được cảnh ảnh còn lại. Các cảnh đã xong được giữ nguyên. '+attempts.map(a=>a.name+': '+a.reason+' ['+a.code+']').join('; ')),{attempts});
 }
 return {status,prepare,generate};
}
const imageRouter=createImageRouter({accountCapabilities:accountImageCapability});
export const imageProviderStatus=()=>imageRouter.status();
export const prepareImagePool=options=>imageRouter.prepare(options);
export const generateImage=options=>imageRouter.generate(options);
