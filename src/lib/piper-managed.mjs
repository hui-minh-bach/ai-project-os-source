/** Opt-in per-user local speech. No bundled engines/models or cloud voice.
 * Model weights are SHA-256 pinned to the upstream LFS object. The old standalone
 * engine is from an EXACT upstream HTTPS release; no code signature/pinned
 * engine checksum is claimed. Its downloaded SHA-256 is recorded as provenance.
 * Review the notices in docs/LOCAL_VOICE_R8.md before distributing a bundle. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import zlib from 'node:zlib';
import {DATA_DIR} from './store.mjs';import {listZipEntries,crc32} from './updater.mjs';
import {savePiperPaths,piperEnvironment} from './piper-paths.mjs';
import {piperStatus,piperSynthesize,clearPiperStatus} from './local-piper-tts.mjs';
export const PIPER_RELEASE=Object.freeze({version:'2023.11.14-2',url:'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',maxBytes:32000000,trust:'fixed-upstream-HTTPS-release-not-signature-verified'});
export const PIPER_VI=Object.freeze({name:'vi_VN-vais1000-medium',sha256:'ec7c89e2c85f4d1edc24b6120c18aaf1bda614f06b511567eb9c7c0de15e2dab',base:'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/vi/vi_VN/vais1000/medium/',modelCard:'https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/vi/vi_VN/vais1000/medium/MODEL_CARD',datasetLicense:'CC-BY-4.0'});
const problem=(code,message)=>Object.assign(new Error(message),{code});
let progress={state:'idle',phase:null,error:null};let active=false;
export function piperSetupStatus(){return {...progress,available:process.platform==='win32'&&process.arch==='x64',installed:piperStatus().ready,version:PIPER_RELEASE.version,voice:PIPER_VI.name,modelPinned:true,engineTrust:PIPER_RELEASE.trust};}
function allowed(url){const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com','huggingface.co','cdn-lfs.huggingface.co','cdn-lfs-us-1.huggingface.co','cas-bridge.xethub.hf.co','us.aws.cdn.hf.co'].includes(u.hostname);}
export async function boundedOfficialDownload(url,dest,{maxBytes,sha256,fetchImpl=fetch}={}){
 if(!allowed(url))throw problem('VOICE_DOWNLOAD_HOST','Unapproved voice download host.');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),360000);timer.unref?.();let current=url;const temp=dest+'.partial';
 fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});
 try{
  let r;
  for(let i=0;i<6;i++){r=await fetchImpl(current,{redirect:'manual',signal:ctrl.signal});if([301,302,303,307,308].includes(r.status)){const next=new URL(r.headers.get('location')||'',current).href;if(!allowed(next))throw problem('VOICE_DOWNLOAD_HOST','Untrusted voice redirect.');current=next;continue;}break;}
  if(!r?.ok||!r.body)throw problem('VOICE_DOWNLOAD','Cannot download voice component: HTTP '+r?.status);
  const size=Number(r.headers.get('content-length')||0);if(size>maxBytes)throw problem('VOICE_SIZE','Voice download exceeds limit.');
  const hash=crypto.createHash('sha256'),fd=fs.openSync(temp,'wx',0o600);let n=0;
  try{for await(const chunk of r.body){n+=chunk.length;if(n>maxBytes)throw problem('VOICE_SIZE','Voice download exceeds limit.');hash.update(chunk);fs.writeSync(fd,chunk);}}finally{fs.closeSync(fd);}
  const digest=hash.digest('hex');if(n<12||(sha256&&digest!==sha256))throw problem('VOICE_HASH','Voice SHA-256 mismatch; installation refused.');
  fs.renameSync(temp,dest);return {bytes:n,sha256:digest,url};
 }finally{clearTimeout(timer);fs.rmSync(temp,{force:true});}
}
export function extractPiperZip(buf,dest){
 const entries=listZipEntries(buf);let end=-1;
 for(let i=buf.length-22;i>=Math.max(0,buf.length-65558);i--)if(buf.readUInt32LE(i)===0x06054b50){end=i;break;}
 let offset=buf.readUInt32LE(end+16);const central=new Map();
 for(const e of entries){const attrs=buf.readUInt32LE(offset+38),flags=buf.readUInt16LE(offset+8);if(flags&1||((attrs>>>16)&0xf000)===0xa000)throw problem('VOICE_ARCHIVE','Encrypted files or symlinks are forbidden.');central.set(e.name,buf.readUInt32LE(offset+16));offset+=46+buf.readUInt16LE(offset+28)+buf.readUInt16LE(offset+30)+buf.readUInt16LE(offset+32);}
if(entries.length<2||entries.length>6000)throw problem('VOICE_ARCHIVE','Invalid Piper archive entries.');
 let total=0;const seen=new Set();
 for(const e of entries){const rel=e.name.replace(/\\/g,'/');if(!rel||rel.endsWith('/'))continue;
  if(!rel.startsWith('piper/')||rel.split('/').some(x=>!x||x==='.'||x==='..'||x.endsWith('.')||x.endsWith(' '))||/[:\x00-\x1f]/.test(rel)||seen.has(rel.toLowerCase()))throw problem('VOICE_ARCHIVE','Unsafe Piper archive path.');
  seen.add(rel.toLowerCase());total+=e.usize;if(e.usize>80000000||total>160000000||e.csize>buf.length)throw problem('VOICE_SIZE','Expanded Piper archive too large.');
  const off=e.lhofs;if(off<0||off+30>buf.length||buf.readUInt32LE(off)!==0x04034b50)throw problem('VOICE_ARCHIVE','Invalid local ZIP header.');
  const start=off+30+buf.readUInt16LE(off+26)+buf.readUInt16LE(off+28);if(start+e.csize>buf.length)throw problem('VOICE_ARCHIVE','Invalid ZIP bounds.');
  const data=buf.subarray(start,start+e.csize);let out;
  if(e.method===0)out=data;else if(e.method===8)out=zlib.inflateRawSync(data,{maxOutputLength:Math.max(1,e.usize)});else throw problem('VOICE_ARCHIVE','Unsupported ZIP compression.');
  if(out.length!==e.usize||crc32(out)!==central.get(e.name))throw problem('VOICE_ARCHIVE','Corrupt Piper archive.');
  const target=path.join(dest,rel);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,out,{flag:'wx',mode:0o600});
 }
 const cli=path.join(dest,'piper','piper.exe');if(!fs.existsSync(cli)||fs.readFileSync(cli).subarray(0,2).toString()!=='MZ')throw problem('VOICE_ARCHIVE','Piper executable missing.');return cli;
}
export async function configureLocalVoice({confirm,cli,model,config},deps={}){
 if(confirm!==true)throw problem('VOICE_CONSENT','Explicit permission is required before running a local speech executable.');
 for(const p of [cli,model,config])if(typeof p!=='string'||!path.isAbsolute(p)||!fs.statSync(p).isFile())throw problem('VOICE_PATH','Choose existing absolute paths to Piper, ONNX and JSON config.');
 if(!/^piper(?:\.exe)?$/i.test(path.basename(cli))||path.extname(model).toLowerCase()!=='.onnx'||path.extname(config).toLowerCase()!=='.json')throw problem('VOICE_PATH','Expected piper executable, .onnx voice and .json configuration.');
 const settings=JSON.parse(fs.readFileSync(config,'utf8'));if(!/^vi(?:-|_|$)/i.test(String(settings.espeak?.voice||settings.language?.code||'')))throw problem('VOICE_LANGUAGE','Select a Vietnamese voice model.');
 const env={...process.env,PIPER_CLI_PATH:cli,PIPER_MODEL_PATH:model,PIPER_CONFIG_PATH:config};clearPiperStatus();
 const tmp=path.join(deps.dataDir||DATA_DIR,'voice-check-'+crypto.randomUUID()+'.wav');
 try{await (deps.synthesize||piperSynthesize)({text:'Xin ch\u00e0o. \u0110\u1ed9i AI \u0111\u00e3 s\u1eb5n s\u00e0ng l\u00e0m vi\u1ec7c.',output:tmp,env});(deps.save||savePiperPaths)({cli,model,config});clearPiperStatus();return {ready:true,voice:path.basename(model,'.onnx')};}finally{fs.rmSync(tmp,{force:true});}
}
export async function installPiperVietnamese(input={},deps={}){
 if(input.confirm!==true||input.acceptEngineTrust!==true)throw problem('VOICE_CONSENT','Approve official-release download, local execution and the license notice first.');
 if((deps.platform||process.platform)!=='win32'||(deps.arch||process.arch)!=='x64')throw problem('VOICE_PLATFORM','Automatic Piper setup supports Windows x64; configure an existing compatible engine on other platforms.');
 if(active)throw problem('VOICE_INSTALL_BUSY','A local voice installation is already running.');active=true;progress={state:'running',phase:'engine',error:null};
 const root=path.join(deps.dataDir||DATA_DIR,'local-voice','piper-'+PIPER_RELEASE.version),stage=root+'-'+crypto.randomUUID()+'.staging';
 fs.mkdirSync(stage,{recursive:true,mode:0o700});const download=deps.download||boundedOfficialDownload;
 try{
  if(fs.existsSync(root)){
   const cli=path.join(root,'piper','piper.exe'),model=path.join(root,PIPER_VI.name+'.onnx'),config=model+'.json';
   if(!fs.existsSync(cli))throw problem('VOICE_ENGINE_MISSING','Thư mục giọng đã có nhưng thiếu piper.exe. Chọn bản Piper đang dùng ở mục cấu hình; không tự xóa dữ liệu hoặc ghi đè engine.');
   if(!fs.existsSync(model)){progress.phase='model';await download(PIPER_VI.base+PIPER_VI.name+'.onnx',model,{maxBytes:80000000,sha256:PIPER_VI.sha256});}
   if(crypto.createHash('sha256').update(fs.readFileSync(model)).digest('hex')!==PIPER_VI.sha256)throw problem('VOICE_HASH','Installed voice changed. No existing installation was overwritten.');
   if(!fs.existsSync(config)){progress.phase='configuration';await download(PIPER_VI.base+PIPER_VI.name+'.onnx.json',config,{maxBytes:64000});}
   const result=await configureLocalVoice({confirm:true,cli,model,config},deps);progress={state:'completed',phase:'ready',error:null};return result;
  }
  const zip=path.join(stage,'engine.zip'),engineReceipt=await download(PIPER_RELEASE.url,zip,{maxBytes:PIPER_RELEASE.maxBytes});
  extractPiperZip(fs.readFileSync(zip),stage);fs.rmSync(zip);progress.phase='model';
  const model=path.join(stage,PIPER_VI.name+'.onnx'),config=model+'.json';
  await download(PIPER_VI.base+PIPER_VI.name+'.onnx',model,{maxBytes:80000000,sha256:PIPER_VI.sha256});
  const configReceipt=await download(PIPER_VI.base+PIPER_VI.name+'.onnx.json',config,{maxBytes:64000});
  JSON.parse(fs.readFileSync(config,'utf8'));fs.writeFileSync(path.join(stage,'provenance.json'),JSON.stringify({engine:engineReceipt,engineTrust:PIPER_RELEASE.trust,model:PIPER_VI,configuration:configReceipt,installedAt:new Date().toISOString()},null,2));
  fs.writeFileSync(path.join(stage,'LICENSE-NOTICE.txt'),'Piper standalone 2023.11.14-2: upstream archived. Components have their own licenses (see the upstream release and source).\nVietnamese model: VAIS1000 medium, dataset CC BY 4.0 per model card: '+PIPER_VI.modelCard+'\nNo blanket commercial license certification is made.\n');
  fs.renameSync(stage,root);progress.phase='check';
  const result=await configureLocalVoice({confirm:true,cli:path.join(root,'piper','piper.exe'),model:path.join(root,PIPER_VI.name+'.onnx'),config:path.join(root,PIPER_VI.name+'.onnx.json')},deps);
  progress={state:'completed',phase:'ready',error:null};return result;
 }catch(e){progress={state:'failed',phase:progress.phase,error:String(e.message).slice(0,500)};throw e;}
 finally{active=false;fs.rmSync(stage,{recursive:true,force:true});}
}
