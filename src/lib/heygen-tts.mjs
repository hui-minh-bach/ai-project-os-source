/**
 * Optional HeyGen cloud speech port for the local-only Media Worker.
 * Credentials are read server-side only. No browser key or simulated TTS.
 * The HeyGen API is billed separately from ChatGPT/HeyGen MCP OAuth.
 */
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

const API='https://api.heygen.com/v3/voices/speech';
const VOICES='https://api.heygen.com/v3/voices?engine=starfish&language=vi&limit=20';
const MAX_AUDIO=25*1024*1024;
const fail=(code,message)=>Object.assign(new Error(message),{code});
function trustedAudioUrl(value){
  let u;try{u=new URL(value)}catch{throw fail('TTS_DOWNLOAD','HeyGen trả địa chỉ âm thanh không hợp lệ.');}
  const host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port||!(host==='heygen.ai'||host.endsWith('.heygen.ai')||host==='heygen.com'||host.endsWith('.heygen.com')))
    throw fail('TTS_DOWNLOAD','HeyGen trả URL âm thanh ngoài miền HeyGen; tải bị chặn để bảo vệ Local Worker.');
  return u.href;
}
async function limitedBytes(response,limit=MAX_AUDIO){
  const declared=Number(response.headers?.get?.('content-length')||0);
  if(declared>limit)throw fail('TTS_LIMIT','File âm thanh HeyGen quá lớn.');
  if(!response.body?.getReader){const b=Buffer.from(await response.arrayBuffer());if(b.length>limit)throw fail('TTS_LIMIT','File quá lớn.');return b;}
  const reader=response.body.getReader(),chunks=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw fail('TTS_LIMIT','File âm thanh vượt giới hạn an toàn.');chunks.push(Buffer.from(value));}}
  catch(e){await reader.cancel().catch(()=>{});throw e;}
  return Buffer.concat(chunks,size);
}
function ffmpegConvert(input,output,exe='ffmpeg'){
  return new Promise((resolve,reject)=>{
    const child=spawn(exe,['-hide_banner','-loglevel','error','-nostdin','-y','-i',input,'-vn','-ac','1','-ar','24000','-c:a','pcm_s16le',output],{stdio:['ignore','ignore','pipe'],windowsHide:true});
    let message='';const timer=setTimeout(()=>child.kill('SIGKILL'),120000);
    child.stderr.on('data',x=>{if(message.length<1000)message+=String(x).slice(0,1000-message.length)});
    child.once('error',e=>{clearTimeout(timer);reject(fail('TTS_FFMPEG',`FFmpeg không thể xử lý âm thanh: ${e.code||'không khả dụng'}`));});
    child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(fail('TTS_FFMPEG',`FFmpeg không giải mã được file giọng nói (${code}). ${message.slice(0,160)}`));});
  });
}
export function createHeygenTts({apiKey='',defaultVoice='',fetchImpl=globalThis.fetch,ffmpegBin='ffmpeg'}={}){
  const keyNow=()=>String((typeof apiKey==='function'?apiKey():apiKey)||'');
  const voiceNow=()=>String((typeof defaultVoice==='function'?defaultVoice():defaultVoice)||'');
  const configured=()=>Boolean(keyNow().trim());
  async function synthesize(input){
    if(!configured())throw fail('BLOCKED_TTS','Chưa cấu hình HEYGEN_API_KEY trên Local Worker; có thể nạp file giọng WAV/MP3 thay thế.');
    const voice=String((input?.voice==='vi'?'':input?.voice)||voiceNow()||'').trim();
    if(!/^[a-zA-Z0-9_-]{6,90}$/.test(voice))throw fail('BLOCKED_TTS_VOICE','Chưa chọn HeyGen voice_id tương thích Starfish; cấu hình HEYGEN_TTS_VOICE_ID hoặc chọn trong giao diện.');
    const text=String(input?.text||'').trim(),rate=Number(input?.rate??1);
    if(!text||text.length>5000)throw fail('TTS_INPUT','Lời đọc phải có từ 1 đến 5.000 ký tự.');
    if(!Number.isFinite(rate)||rate<0.5||rate>2)throw fail('TTS_INPUT','Tốc độ giọng nói không hợp lệ.');
    if(typeof input?.output!=='string'||!path.isAbsolute(input.output))throw fail('TTS_INPUT','Đường dẫn file kết quả phải do Worker cung cấp.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
    let audio,metadata={};
    try{
      const response=await fetchImpl(API,{method:'POST',redirect:'error',headers:{'X-Api-Key':keyNow(),'Content-Type':'application/json'},body:JSON.stringify({voice_id:voice,text,language:String(input.language||'vi'),input_type:'text',speed:rate}),signal:controller.signal});
      if(!response.ok)throw fail('TTS_PROVIDER',`HeyGen từ chối yêu cầu TTS (HTTP ${response.status}); kiểm tra API key, quyền truy cập voice và hạn mức.`);
      const data=await response.json();audio=data?.data?.audio_url||data?.data?.audioUrl||data?.audio_url||data?.audioUrl;
      metadata={duration:data?.data?.duration??null,wordTimestamps:data?.data?.word_timestamps??[],requestId:data?.data?.request_id??null};
      if(typeof audio!=='string')throw fail('TTS_PROVIDER','HeyGen không trả audio_url. Không dựng file giả.');
    }finally{clearTimeout(timer);}
    const url=trustedAudioUrl(audio);
    const downController=new AbortController(),downTimer=setTimeout(()=>downController.abort(),120000);
    const tmp=path.join(path.dirname(input.output),`.heygen-${randomUUID()}.download`);
    try{
      const response=await fetchImpl(url,{method:'GET',redirect:'error',signal:downController.signal});
      if(!response.ok)throw fail('TTS_DOWNLOAD',`Không tải được file giọng nói HeyGen (HTTP ${response.status}).`);
      const bytes=await limitedBytes(response);if(bytes.length<64)throw fail('TTS_DOWNLOAD','File giọng nói rỗng hoặc không hợp lệ.');
      fs.mkdirSync(path.dirname(input.output),{recursive:true});
      fs.writeFileSync(tmp,bytes,{flag:'wx',mode:0o600});
      await ffmpegConvert(tmp,input.output,ffmpegBin);
      return {audioPath:input.output,voiceQuality:'HEYGEN_TTS_EXTERNAL_API',provider:'heygen',voice,wordTimestamps:metadata.wordTimestamps||[],providerRequestId:metadata.requestId||null};
    }finally{clearTimeout(downTimer);try{fs.rmSync(tmp,{force:true})}catch{}}
  }
  async function listVoices(){
    if(!configured())throw fail('BLOCKED_TTS','Chưa có HEYGEN_API_KEY; không thể tải danh sách giọng.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const r=await fetchImpl(VOICES,{redirect:'error',headers:{'X-Api-Key':keyNow()},signal:controller.signal});
      if(!r.ok)throw fail('TTS_PROVIDER',`Không tải được danh sách giọng HeyGen (HTTP ${r.status}).`);
      const j=await r.json();const voices=j?.data?.items||j?.items||j?.data?.voices||j?.data;
      if(!Array.isArray(voices))throw fail('TTS_PROVIDER','Danh sách HeyGen voices không đúng định dạng.');
      return voices.filter(x=>/^[a-zA-Z0-9_-]{6,90}$/.test(x.voice_id||'')).slice(0,30).map(x=>({id:x.voice_id,name:String(x.name||x.voice_id).slice(0,80),language:String(x.language||'').slice(0,50),gender:String(x.gender||'').slice(0,20)}));
    }finally{clearTimeout(timer);}
  }
  return {configured,get defaultVoice(){return voiceNow()},voiceConfigured:()=>Boolean(voiceNow()),synthesize,listVoices};
}
export {trustedAudioUrl};
