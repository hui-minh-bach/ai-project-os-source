/** Kokoro-82M is an optional, separately downloaded offline English speech
 * engine (model + kokoro-js are Apache-2.0). Nothing is redistributed by
 * AI Project OS: the package is installed from the official npm registry and
 * the model from the official Hugging Face repo into the per-user ai-tools
 * folder on the owner's explicit install action, mirroring the managed CLIs.
 * English only — Vietnamese keeps using Piper/FPT. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {TOOLS_DIR, npmCliPath} from './managed-cli.mjs';
import {rootDir} from './store.mjs';

function blocked(message){const e=new Error(message);e.code='BLOCKED_KOKORO_TTS';return e;}
export const KOKORO_PACKAGE='kokoro-js@1.2.1';
export const KOKORO_MODEL_BASE='https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';
export const KOKORO_VOICES=Object.freeze(['af_heart','af_bella','am_michael','bm_george']);
const MODEL_FILES=Object.freeze(['config.json','tokenizer.json','tokenizer_config.json','onnx/model_quantized.onnx']);
const ADVICE='Chưa cài Kokoro TTS (giọng Anh local). Bấm "Cài Kokoro" trong Video Studio (tải ~95MB một lần từ npm + Hugging Face chính thức), hoặc chọn Piper/FPT. Kokoro chỉ đọc tiếng Anh.';
export const KOKORO_DIR=path.join(TOOLS_DIR,'kokoro-model');
export const KOKORO_WORKER=path.join(TOOLS_DIR,'kokoro-worker.mjs');

function modelDir(env){return String(env.KOKORO_MODEL_DIR||KOKORO_DIR);}
function minModelBytes(env){const n=Number(env.KOKORO_MODEL_MIN_BYTES);return Number.isFinite(n)&&n>0?n:80_000_000;}
function fileOk(p,min=1){try{const s=fs.statSync(p);return s.isFile()&&s.size>=min;}catch{return false;}}

let statusCache={key:null,at:0,value:null};
export function kokoroStatus(env=process.env){
  const dir=modelDir(env);
  const key=dir+'\x00'+TOOLS_DIR;
  if(statusCache.key===key&&Date.now()-statusCache.at<30000)return statusCache.value;
  const pkgInstalled=fileOk(path.join(TOOLS_DIR,'node_modules','kokoro-js','package.json'));
  const workerReady=fileOk(KOKORO_WORKER);
  const modelFiles=MODEL_FILES.map(f=>({file:f,ok:f.endsWith('.onnx')?fileOk(path.join(dir,f),minModelBytes(env)):fileOk(path.join(dir,f))}));
  const voices=KOKORO_VOICES.filter(v=>fileOk(path.join(dir,'voices',v+'.bin'),100_000));
  const modelReady=modelFiles.every(f=>f.ok)&&voices.length>0;
  const value={ready:pkgInstalled&&workerReady&&modelReady,pkgInstalled,workerReady,modelReady,modelFiles,voices,defaultVoice:voices[0]||null,dir,source:'Kokoro-82M (Apache-2.0) qua kokoro-js — chạy local, chỉ tiếng Anh',installHint:ADVICE};
  statusCache={key,at:Date.now(),value};return value;
}
export function kokoroVoiceFor(requested,env=process.env){
  const status=kokoroStatus(env);
  if(!status.ready)return null;
  if(requested===undefined||requested===null||String(requested).trim()===''||/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(String(requested).trim()))return status.defaultVoice;
  return String(requested);
}

function runProcess(command,args,{cwd,timeoutMs,input}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,windowsHide:true,stdio:['pipe','ignore','pipe']});
    let stderr='',settled=false;
    const done=(fn,v)=>{if(!settled){settled=true;clearTimeout(timer);fn(v);}};
    const timer=setTimeout(()=>{child.kill();done(reject,blocked('Quá thời gian xử lý.'));},timeoutMs);
    child.once('error',e=>done(reject,e));
    child.stderr.on('data',c=>{if(stderr.length<3000)stderr+=String(c).slice(0,3000);});
    child.once('close',code=>done(resolve,{code,stderr}));
    child.stdin.on('error',()=>{});
    child.stdin.end(input||'');
  });
}

async function downloadFile(url,dest,{fetchImpl,onProgress}={}){
  const res=await fetchImpl(url,{redirect:'follow'});
  if(!res||!res.ok)throw blocked('Tải model Kokoro thất bại (HTTP '+(res?res.status:'?')+') từ '+url);
  const total=Number(res.headers?.get?.('content-length')||0);
  const tmp=dest+'.part';
  fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});
  let seen=0;
  const reader=res.body?.getReader?res.body.getReader():null;
  if(reader){
    // Open a stream only for streaming responses; otherwise its delayed open
    // can truncate the file written by the arrayBuffer fallback.
    const out=fs.createWriteStream(tmp);
    for(;;){const {done,value}=await reader.read();if(done)break;seen+=value.byteLength;out.write(Buffer.from(value));if(onProgress)onProgress({file:path.basename(dest),seen,total});}
    await new Promise((resolve,reject)=>{out.end(()=>resolve());out.once('error',reject);});
  }else{
    const buf=Buffer.from(await res.arrayBuffer());seen=buf.length;await fs.promises.writeFile(tmp,buf);if(onProgress)onProgress({file:path.basename(dest),seen,total:total||seen});
  }
  fs.renameSync(tmp,dest);
  return seen;
}

let installing=false;
export function kokoroInstalling(){return installing;}
export async function kokoroInstall({env=process.env,fetchImpl=globalThis.fetch,onProgress,run=runProcess,npmPath}={}){
  if(installing)throw blocked('Kokoro đang được cài; chờ lần cài hiện tại xong.');
  installing=true;
  try{
    fs.mkdirSync(TOOLS_DIR,{recursive:true,mode:0o700});
    // 1) npm package (official registry), same mechanics as the managed CLIs.
    if(!fileOk(path.join(TOOLS_DIR,'node_modules','kokoro-js','package.json'))){
      if(onProgress)onProgress({phase:'npm',file:KOKORO_PACKAGE});
      const npm=npmPath||npmCliPath();
      const r=await run(process.execPath,[npm,'install','--prefix',TOOLS_DIR,'--no-audit','--no-fund','--omit=dev',KOKORO_PACKAGE],{cwd:TOOLS_DIR,timeoutMs:900000});
      if(r.code!==0)throw blocked('Không cài được kokoro-js từ npm chính thức. Kiểm tra mạng rồi thử lại. '+(r.stderr||'').slice(0,220));
    }
    // 2) worker script next to the shared node_modules so bare imports resolve.
    const srcWorker=path.join(rootDir(),'tools','kokoro-worker.mjs');
    if(!fs.existsSync(srcWorker))throw blocked('Thiếu tools/kokoro-worker.mjs trong bản cài app.');
    fs.copyFileSync(srcWorker,KOKORO_WORKER);
    // 3) model + default voices from the official Hugging Face repo.
    const base=String(env.KOKORO_MODEL_BASE_URL||KOKORO_MODEL_BASE).replace(/\/$/,'');
    const dir=modelDir(env);
    for(const f of MODEL_FILES){
      const dest=path.join(dir,f);
      const need=f.endsWith('.onnx')?!fileOk(dest,minModelBytes(env)):!fileOk(dest);
      if(need)await downloadFile(base+'/'+f,dest,{fetchImpl,onProgress});
    }
    for(const v of KOKORO_VOICES){
      const dest=path.join(dir,'voices',v+'.bin');
      if(!fileOk(dest,100_000))await downloadFile(base+'/voices/'+v+'.bin',dest,{fetchImpl,onProgress});
    }
    // 4) integrity: the ONNX must hash to the repo's published LFS oid when
    // the tree API is reachable; a mismatch deletes the file and fails loudly.
    try{
      const api=await fetchImpl('https://huggingface.co/api/models/onnx-community/Kokoro-82M-v1.0-ONNX/tree/main/onnx');
      if(api&&api.ok){
        const tree=await api.json();
        const entry=Array.isArray(tree)?tree.find(x=>x.path==='onnx/model_quantized.onnx'):null;
        const oid=entry?.lfs?.oid;
        if(oid){
          const buf=await fs.promises.readFile(path.join(dir,'onnx','model_quantized.onnx'));
          const got=crypto.createHash('sha256').update(buf).digest('hex');
          if(got!==oid){fs.rmSync(path.join(dir,'onnx','model_quantized.onnx'),{force:true});throw blocked('Model Kokoro tải về không khớp mã SHA-256 công bố của repo — đã xóa file lỗi. Thử cài lại.');}
        }
      }
    }catch(e){if(e&&e.code==='BLOCKED_KOKORO_TTS')throw e;}
    statusCache={key:null,at:0,value:null};
    const status=kokoroStatus(env);
    if(!status.ready)throw blocked('Cài xong nhưng Kokoro chưa sẵn sàng (pkg='+status.pkgInstalled+', model='+status.modelReady+', giọng='+status.voices.join(',')+').');
    if(onProgress)onProgress({phase:'done'});
    return status;
  }finally{installing=false;}
}

export async function kokoroSynthesize({text,voice,rate=1,output,env=process.env,timeoutMs=600000,run=runProcess}={}){
  const status=kokoroStatus(env);if(!status.ready)throw blocked(ADVICE);
  if(typeof text!=='string'||!text.trim()||text.length>5000)throw blocked('Lời thoại phải có 1-5.000 ký tự.');
  if(typeof output!=='string'||!path.isAbsolute(output)||path.extname(output).toLowerCase()!=='.wav')throw blocked('Đường dẫn xuất WAV không hợp lệ.');
  const speed=Number(rate);if(!Number.isFinite(speed)||speed<.7||speed>1.5)throw blocked('Tốc độ giọng phải từ 0.7 đến 1.5.');
  const chosen=voice?String(voice):status.defaultVoice;
  if(!status.voices.includes(chosen))throw blocked('Giọng Kokoro chưa được tải trên máy: '+chosen+'. Các giọng có sẵn: '+status.voices.join(', ')+'.');
  fs.mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
  const jobFile=output+'.kokoro-job.json';
  fs.writeFileSync(jobFile,JSON.stringify({text:text.trim(),voice:chosen,speed,modelDir:modelDir(env),output}));
  try{
    const r=await run(process.execPath,[KOKORO_WORKER,jobFile],{cwd:TOOLS_DIR,timeoutMs:Math.max(1000,Math.min(900000,timeoutMs))});
    if(r.code!==0)throw blocked('Kokoro không tạo được WAV (mã '+r.code+'): '+(r.stderr||'').slice(0,220));
    const stat=fs.statSync(output);if(!stat.isFile()||stat.size<44)throw blocked('Kokoro không xuất âm thanh WAV hợp lệ.');
    const head=Buffer.alloc(12);const fd=fs.openSync(output,'r');try{fs.readSync(fd,head,0,12,0);}finally{fs.closeSync(fd);}
    if(head.toString('ascii',0,4)!=='RIFF'||head.toString('ascii',8,12)!=='WAVE')throw blocked('Đầu ra Kokoro không phải WAV.');
    return {audioPath:output,provider:'kokoro-local',voice:chosen,wordTimestamps:[],providerRequestId:null,voiceQuality:'LOCAL_MODEL_KOKORO_82M'};
  }catch(error){fs.rmSync(output,{force:true});throw error;}
  finally{fs.rmSync(jobFile,{force:true});}
}
