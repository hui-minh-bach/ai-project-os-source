/** Read-only readiness diagnostics for no-API-fee local components.
 * Probes only loopback endpoints; no install, cloud invocation or secrets. */
import {spawnSync} from 'node:child_process';
import {comfyImageBridge} from './comfyui-local.mjs';
import {localWorkers} from './local-workers.mjs';
import {opencodeStatus} from './opencode.mjs';
import {windowsSpeechStatus} from './windows-speech.mjs';
import {piperStatus} from './local-piper-tts.mjs';
import {findInstalledConcat} from './concat-managed.mjs';

export async function ollamaLocalStatus({fetchImpl=globalThis.fetch}={}){
  try{
    const response=await fetchImpl('http://127.0.0.1:11434/api/tags',{method:'GET',redirect:'error',signal:AbortSignal.timeout(3500)});
    if(!response.ok)return {ready:false,reason:`Ollama trả HTTP ${response.status}`,models:[]};
    const data=await response.json();const models=(Array.isArray(data?.models)?data.models:[]).map(m=>String(m.name||'').slice(0,100)).filter(Boolean).slice(0,30);
    return {ready:models.length>0,serverOnline:true,models,reason:models.length?null:'Ollama đã mở nhưng chưa tải model nào.'};
  }catch{return {ready:false,serverOnline:false,models:[],reason:'Chưa kết nối Ollama tại 127.0.0.1:11434.'};}
}
function binaryStatus(name,{run=spawnSync}={}){
  try{const r=run(name,['-version'],{encoding:'utf8',timeout:3000,maxBuffer:8192,windowsHide:true});return {ready:!r.error&&r.status===0,version:String(r.stdout||'').split('\n')[0].slice(0,120)};}
  catch{return {ready:false,version:null};}
}
export async function freeStackStatus({comfy=comfyImageBridge,workers=localWorkers,ollama=ollamaLocalStatus,speech=windowsSpeechStatus,opencode=opencodeStatus,concat=findInstalledConcat,ffmpeg=binaryStatus,capabilities=null,concatProbe=null}={}){
  const [comfyStatus,flux,ollamaStatus]=await Promise.all([comfy.health(),workers.status('flux2-klein'),ollama()]);
  const c=capabilities?capabilities():null;
  const voice=c?{ready:c.voices.some(v=>v.id==='windows'&&v.ready)}:speech();
  const code=opencode();const video=c?{ready:c.videoReady}:ffmpeg('ffmpeg');const concatBin=concat();
  const concatConfigured=!!c?.concat?.configured;let concatConnected=false;
  if(concatConfigured&&concatProbe){try{concatConnected=(await concatProbe()).connected===true;}catch{/* Failed probe is not readiness. */}}
  const voiceReady=c?c.voices.some(v=>v.ready&&!v.paid):voice.ready;
  const narration={ready:video.ready&&voiceReady,rendererReady:video.ready,voiceReady,
    message:!video.ready?'Thiếu FFmpeg/FFprobe để dựng video.':!voiceReady?'Bộ dựng video đã sẵn sàng; video có lời đọc còn thiếu giọng Việt Windows/Piper. Concat và FFmpeg không thay thế giọng đọc.':'Bộ dựng và giọng Việt miễn phí đã sẵn sàng; video còn cần nguồn ảnh hợp lệ.'};
  const local=c?c.localSpeech||{ready:c.voices.some(v=>v.id==='local'&&v.ready)}:piperStatus();
  const tools=[
    {id:'flux2',name:'FLUX.2 Klein 4B',type:'image',ready:flux.state==='READY',license:'Apache-2.0',note:flux.state==='READY'?'Đã cài; chạy ảnh tại máy':'Mở Thợ AI tại chỗ bên dưới để tải model',url:'https://github.com/black-forest-labs/flux2'},
    {id:'comfyui',name:'ComfyUI API',type:'image',ready:comfyStatus.ready,configured:comfyStatus.configured,license:'GPL-3.0 (ứng dụng riêng)',note:comfyStatus.reason||'Workflow local sẵn sàng',url:'https://github.com/Comfy-Org/ComfyUI'},
    {id:'ollama',name:'Ollama',type:'code-ai',ready:ollamaStatus.ready,license:'MIT (phần mềm; model có giấy phép riêng)',note:ollamaStatus.reason||`${ollamaStatus.models.length} model local`,url:'https://github.com/ollama/ollama'},
    {id:'opencode',name:'OpenCode',type:'code-agent',ready:code.ready,license:'MIT',note:code.ready?'Có runtime điều khiển coding-agent':'Cài OpenCode trong danh sách Engine; chỉ chạy trong sandbox/quyền đã duyệt',url:'https://github.com/anomalyco/opencode'},
    {id:'windows-voice',name:'Windows Voice tiếng Việt',type:'voice',ready:voice.ready,license:'Hệ thống Windows; theo giấy phép của Windows/voice',note:voice.ready?'Có giọng Việt trong Windows':'Cài giọng vi-VN trong Windows Settings > Speech',url:'https://support.microsoft.com/windows'},
    {id:'piper-voice',name:'Piper — Giọng Việt local',type:'voice',ready:!!local.ready,license:'Engine/model theo giấy phép upstream',note:local.ready?'Đã nhận giọng '+(local.voice||'Việt')+'; không cần cài lại.':local.reason==='voice-engine-unavailable'?'Có cấu hình giọng nhưng chương trình Piper không phản hồi. Mở Kiểm tra Local Worker.':'Chưa nhận đủ engine và model giọng Việt. Kiểm tra Local Worker để nhận lại bản đã cài hoặc bổ sung giọng.',url:'https://github.com/rhasspy/piper'},
    {id:'ffmpeg',name:'FFmpeg',type:'video',ready:video.ready,license:'LGPL/GPL tùy bản build',note:video.ready?'FFmpeg/FFprobe có thể dựng video local; lời đọc cần Windows Voice hoặc Piper riêng':'Chưa thấy FFmpeg có thể chạy',url:'https://ffmpeg.org'},
    {id:'concat',name:'Concat',type:'video',ready:concatConnected,installed:!!concatBin,configured:concatConfigured,connected:concatConnected,statusLabel:concatConnected?'✓ Đã kết nối API':concatConfigured?'Có cấu hình · API chưa phản hồi':concatBin?'Đã cài · Chưa kết nối':'Chưa cài / chưa kết nối',license:'AGPL-3.0 (ứng dụng riêng)',note:concatConnected?'API Concat đã xác thực và phản hồi; lời đọc cần Windows Voice hoặc Piper riêng.':concatConfigured?'Đã lưu cấu hình nhưng chưa xác nhận API. Mở Vault và Concat rồi kiểm tra lại.':concatBin?'Đã tìm thấy bản cài. Bật Remote và kết nối trong Media Studio để dựng qua Concat.':'Chưa nhận diện bản cài hoặc kết nối API Concat',url:'https://github.com/jub0t/Concat'},
  ];
  return {localOnly:true,readOnly:true,noPaidApiCalled:true,tools,narration,
    caveats:['Tài nguyên GPU, điện và dung lượng ổ đĩa không miễn phí.','ComfyUI/Concat là chương trình độc lập; tuân thủ GPL/AGPL khi phân phối.','Model coding trong Ollama và ảnh/video cần kiểm tra giấy phép riêng trước khi bán sản phẩm.','Chỉ báo sẵn sàng của runtime không chứng minh chất lượng sản phẩm hoặc triển khai cloud hoàn chỉnh.']};
}
