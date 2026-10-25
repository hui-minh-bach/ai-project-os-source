/** Optional local ComfyUI bridge. No ComfyUI code is embedded or redistributed.
 * A user-authored API-format workflow is required, with __AIOS_PROMPT__ in a
 * text input. All requests are restricted to loopback; no remote cloud API. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DATA_DIR} from './store.mjs';

function fail(code,message){return Object.assign(new Error(message),{code});}
const PNG=Buffer.from([0x89,0x50,0x4e,0x47]);
const DEFAULT_WORKFLOW=path.join(DATA_DIR,'free-stack','comfyui-image-api.json');
export const COMFY_WORKFLOW_HINT='Trong ComfyUI: Workflow > Export (API Format); lưu thành .data/free-stack/comfyui-image-api.json và đặt __AIOS_PROMPT__ vào ô text prompt. Sau đó mở ComfyUI tại 127.0.0.1:8188.';

export function localComfyUrl(input='http://127.0.0.1:8188'){
  let u;try{u=new URL(input);}catch{throw fail('COMFY_CONFIGURATION','Địa chỉ ComfyUI không hợp lệ.');}
  if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname)||u.username||u.password||u.search||u.hash||u.pathname!=='/'){
    throw fail('COMFY_SECURITY','ComfyUI chỉ được kết nối qua HTTP loopback (127.0.0.1/localhost).');
  }
  return u.origin;
}

function parseWorkflow(raw){
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>2*1024*1024)throw fail('COMFY_CONFIGURATION','Workflow quá lớn (>2 MB).');
  let value;try{value=JSON.parse(raw);}catch{throw fail('COMFY_CONFIGURATION','Workflow ComfyUI không phải JSON hợp lệ.');}
  const graph=value?.prompt&&typeof value.prompt==='object'?value.prompt:value;
  if(!graph||Array.isArray(graph)||typeof graph!=='object'||!Object.keys(graph).length||Object.keys(graph).length>300){
    throw fail('COMFY_CONFIGURATION','Workflow phải là JSON API Format gồm các node có class_type.');
  }
  let tokens=0,saveImage=0;
  for(const [key,node] of Object.entries(graph)){
    if(!/^[A-Za-z0-9_-]{1,60}$/.test(key)||!node||typeof node.class_type!=='string'||!node.inputs||typeof node.inputs!=='object'){
      throw fail('COMFY_CONFIGURATION','Workflow phải chứa các node API Format với class_type và inputs.');
    }
    if(/^SaveImage$/i.test(node.class_type))saveImage++;
    for(const val of Object.values(node.inputs))if(typeof val==='string'&&val.includes('__AIOS_PROMPT__'))tokens++;
  }
  if(!tokens)throw fail('COMFY_CONFIGURATION','Chưa có __AIOS_PROMPT__ trong phần inputs của workflow. '+COMFY_WORKFLOW_HINT);
  if(!saveImage)throw fail('COMFY_CONFIGURATION','Workflow cần có node SaveImage để đưa ảnh về AI Project OS.');
  return graph;
}
function magic(bytes){
  if(bytes.length<1024||bytes.length>25*1024*1024)throw fail('COMFY_IMAGE_INVALID','Ảnh ComfyUI trả về có kích thước bất thường.');
  if(bytes.subarray(0,4).equals(PNG))return '.png';
  if(bytes[0]===0xff&&bytes[1]===0xd8)return '.jpg';
  if(bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP')return '.webp';
  throw fail('COMFY_IMAGE_INVALID','ComfyUI không trả về PNG/JPG/WebP hợp lệ.');
}
function applyPrompt(graph,prompt){
  const clone=structuredClone(graph);
  for(const node of Object.values(clone)){
    for(const [k,v] of Object.entries(node.inputs)){
      if(typeof v==='string'&&v.includes('__AIOS_PROMPT__'))node.inputs[k]=v.replaceAll('__AIOS_PROMPT__',prompt);
    }
  }
  return clone;
}
function firstImage(entry){
  for(const node of Object.values(entry?.outputs||{})){
    const images=node?.images;
    if(!Array.isArray(images))continue;
    for(const img of images){if(img&&typeof img.filename==='string'&&img.filename.length<240&&/^[^\\/\0]+$/.test(img.filename))return img;}
  }
  return null;
}
export function createComfyImageBridge({
  baseUrl=process.env.AIOS_COMFYUI_URL||'http://127.0.0.1:8188',
  workflowPath=process.env.AIOS_COMFYUI_IMAGE_WORKFLOW||DEFAULT_WORKFLOW,
  managedWorkflowPath=DEFAULT_WORKFLOW,
  fetchImpl=globalThis.fetch,
  sleep=ms=>new Promise(r=>setTimeout(r,ms)),
  maxWaitMs=6*60*1000,
  now=Date.now,
}={}){
  const base=localComfyUrl(baseUrl);
  function snapshot(){
    if(!fs.existsSync(workflowPath))return {configured:false,ready:false,workflowPath,reason:'Chưa xuất workflow ComfyUI API Format. '+COMFY_WORKFLOW_HINT};
    let raw,graph;
    try{raw=fs.readFileSync(workflowPath,'utf8');graph=parseWorkflow(raw);}catch(e){return {configured:false,ready:false,workflowPath,reason:e.message};}
    return {configured:true,ready:false,workflowPath,workflowHash:crypto.createHash('sha256').update(raw).digest('hex'),nodes:Object.keys(graph).length,reason:'Đã cấu hình; cần kiểm tra máy chủ ComfyUI đang chạy.'};
  }
  async function jsonRequest(method,endpoint,data=null,timeoutMs=7000){
    const options={method,redirect:'error',signal:AbortSignal.timeout(timeoutMs)};
    if(data!==null){options.headers={'content-type':'application/json'};options.body=JSON.stringify(data);}
    const r=await fetchImpl(base+endpoint,options);
    if(!r.ok)throw fail('COMFY_HTTP',`ComfyUI HTTP ${r.status} (${endpoint.split('?')[0]}).`);
    return r.json();
  }
  /** The UI is only allowed to update the app-owned workflow, not arbitrary
   * paths supplied by a browser. The former workflow stays in place if
   * validation or the atomic replacement fails. */
  function installWorkflow(raw){
    if(path.resolve(workflowPath)!==path.resolve(managedWorkflowPath))throw fail('COMFY_CONFIGURATION_OVERRIDE','ComfyUI đang đọc workflow từ biến môi trường. Gỡ AIOS_COMFYUI_IMAGE_WORKFLOW trước khi nhập trên giao diện.');
    const graph=parseWorkflow(raw);
    const normalized=JSON.stringify(graph,null,2);
    if(Buffer.byteLength(normalized,'utf8')>2*1024*1024)throw fail('COMFY_CONFIGURATION','Workflow ComfyUI vượt quá giới hạn 2 MB.');
    fs.mkdirSync(path.dirname(managedWorkflowPath),{recursive:true,mode:0o700});
    if(fs.existsSync(managedWorkflowPath)&&fs.lstatSync(managedWorkflowPath).isSymbolicLink())throw fail('COMFY_SECURITY','Không được ghi đè workflow thông qua symbolic link.');
    if(fs.existsSync(managedWorkflowPath)&&fs.readFileSync(managedWorkflowPath,'utf8')===normalized)return {installed:true,changed:false,...snapshot()};
    const temp=managedWorkflowPath+'.'+crypto.randomUUID()+'.tmp';
    try{fs.writeFileSync(temp,normalized,{flag:'wx',mode:0o600});fs.renameSync(temp,managedWorkflowPath);}
    finally{fs.rmSync(temp,{force:true});}
    return {installed:true,changed:true,...snapshot()};
  }
  async function health(){
    const config=snapshot();if(!config.configured)return {...config,online:false,endpoint:base,freeApi:true};
    try{const stats=await jsonRequest('GET','/system_stats',null,4000);return {...config,online:true,ready:true,endpoint:base,freeApi:true,devices:(stats?.devices||[]).map(x=>({type:String(x.type||''),name:String(x.name||'').slice(0,100)}))};}
    catch(e){return {...config,online:false,ready:false,endpoint:base,freeApi:true,reason:'ComfyUI chưa phản hồi trên máy: '+e.message};}
  }
  async function generate({prompt,output,expectedWorkflowHash=null,onProgress=()=>{}}={}){
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000||!output||!path.isAbsolute(output))throw fail('COMFY_INPUT','Prompt/đường dẫn ảnh ComfyUI không hợp lệ.');
    const config=snapshot();if(!config.configured)throw fail('COMFY_CONFIGURATION',config.reason);
    if(expectedWorkflowHash&&config.workflowHash!==expectedWorkflowHash)throw fail('IMAGE_IDENTITY_CHANGED','Workflow ComfyUI đã thay đổi. Duyệt lại lựa chọn tạo ảnh.');
    const graph=applyPrompt(parseWorkflow(fs.readFileSync(workflowPath,'utf8')),prompt);
    let submitted;
    try{submitted=await jsonRequest('POST','/prompt',{prompt:graph,client_id:crypto.randomUUID()},15000);}
    catch(e){if(e.code==='COMFY_HTTP')throw e;throw fail('COMFY_OFFLINE','Không gửi được yêu cầu tới ComfyUI local: '+e.message);}
    const id=String(submitted?.prompt_id||'');
    if(!/^[a-f0-9-]{24,40}$/i.test(id))throw fail('COMFY_WORKFLOW_ERROR','ComfyUI từ chối workflow hoặc không trả prompt_id. Kiểm tra node_errors trong ComfyUI.');
    onProgress({state:'queued',promptId:id});
    const started=now();let outputImage=null;
    while(now()-started<maxWaitMs){
      await sleep(1100);
      let history;
      try{history=await jsonRequest('GET','/history/'+encodeURIComponent(id),null,12000);}catch(e){if(e.code==='COMFY_HTTP')throw e;continue;}
      const entry=history?.[id];if(!entry)continue;
      const status=entry.status?.status_str;
      if(status==='error'||entry.status?.completed===false&&status==='success')throw fail('COMFY_WORKFLOW_ERROR','ComfyUI chạy workflow thất bại. Kiểm tra lịch sử ComfyUI.');
      outputImage=firstImage(entry);if(outputImage)break;
      if(entry.status?.completed)throw fail('COMFY_EMPTY','Workflow hoàn tất nhưng không tạo tệp ảnh; cần node SaveImage.');
    }
    if(!outputImage)throw fail('COMFY_TIMEOUT','ComfyUI chưa xuất ảnh trong thời gian cho phép; tác vụ vẫn có thể chạy tại ComfyUI. Kiểm tra lịch sử trước khi retry.');
    const params=new URLSearchParams({filename:outputImage.filename,subfolder:String(outputImage.subfolder||''),type:String(outputImage.type||'output')});
    const r=await fetchImpl(base+'/view?'+params.toString(),{method:'GET',redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw fail('COMFY_HTTP',`Không tải được ảnh từ ComfyUI (HTTP ${r.status}).`);
    if(Number(r.headers?.get('content-length')||0)>25*1024*1024)throw fail('COMFY_IMAGE_INVALID','Ảnh vượt quá 25 MB.');
    // A local service may omit Content-Length: cap the stream while reading.
    const maxBytes=25*1024*1024;
    let total=0;const chunks=[];
    if(!r.body)throw fail('COMFY_IMAGE_INVALID','Phản hồi ảnh ComfyUI trống.');
    const reader=r.body.getReader();
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;
       total+=value.byteLength;if(total>maxBytes)throw fail('COMFY_IMAGE_INVALID','Ảnh ComfyUI vượt quá 25 MB.');
       chunks.push(Buffer.from(value));
      }
    }catch(e){await reader.cancel().catch(()=>{});throw e;}
    const bytes=Buffer.concat(chunks,total);const ext=magic(bytes);
    const file=output.replace(/\.[a-z0-9]+$/i,'')+ext;
    fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,bytes,{mode:0o600});
    onProgress({state:'completed',promptId:id});
    return {provider:'comfyui-local',model:'user-api-workflow',file,bytes:bytes.length,workflowHash:config.workflowHash,promptId:id,paid:false};
  }
  return {snapshot,health,generate,installWorkflow};
}
export const comfyImageBridge=createComfyImageBridge();
