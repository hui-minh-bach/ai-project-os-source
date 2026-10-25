/**
 * Installer integration for the UNMODIFIED Concat Windows application.
 * Concat is an independent AGPL-3.0-or-later program, not linked into AI Project OS.
 * User must explicitly approve the installation in the local UI.
 * Its official release EXE is hash pinned; no untrusted mirrors or commands.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const CONCAT_RELEASE=Object.freeze({
  version:'0.2.7',
  filename:'Concat-0.2.7-windows-x86_64-setup.exe',
  url:'https://github.com/jub0t/Concat/releases/download/v0.2.7/Concat-0.2.7-windows-x86_64-setup.exe',
  sha256:'305e833449c24c234c935244debd339a4ba25866fe5787c744f374c7ee5b9687',
  bytes:84783443,
  license:'AGPL-3.0-or-later'
});

function own(pathValue){try{return fs.statSync(pathValue).isFile()}catch{return false}}
export function installedCandidates(env=process.env){
  const folders=[
    env.LOCALAPPDATA&&path.join(env.LOCALAPPDATA,'Programs','Concat','concat.exe'),
    env.LOCALAPPDATA&&path.join(env.LOCALAPPDATA,'Concat','concat.exe'),
    env.ProgramFiles&&path.join(env.ProgramFiles,'Concat','concat.exe'),
    env['ProgramFiles(x86)']&&path.join(env['ProgramFiles(x86)'],'Concat','concat.exe'),
    env.AIOS_CONCAT_EXE
  ];
  return [...new Set(folders.filter(Boolean))];
}
export function findInstalledConcat(env=process.env){return installedCandidates(env).find(own)||null}
export function bundledSetup(root){return path.join(root,'vendor','concat',CONCAT_RELEASE.filename)}
export function cacheSetup(env=process.env){
  return path.join(env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'AIProjectOSPersonal','deps',CONCAT_RELEASE.filename);
}
export function concatInstallStatus({root,env=process.env,platform=process.platform}={}){
  return {platform,available:platform==='win32'&&process.arch==='x64',installed:!!findInstalledConcat(env),
    bundled:!!(root&&own(bundledSetup(root))),version:CONCAT_RELEASE.version,
    license:CONCAT_RELEASE.license,autoConnectSupported:platform==='win32',
    needsWindowsLiveTest:true};
}
export function sha256Of(file){const h=crypto.createHash('sha256');const fd=fs.openSync(file,'r'),buf=Buffer.allocUnsafe(1024*1024);try{let size;while((size=fs.readSync(fd,buf,0,buf.length,null))>0)h.update(buf.subarray(0,size));}finally{fs.closeSync(fd)}return h.digest('hex')}
export function verifyPinnedSetup(file){return own(file)&&fs.statSync(file).size===CONCAT_RELEASE.bytes&&sha256Of(file)===CONCAT_RELEASE.sha256}

/** Download only the pinned official GitHub asset, with byte and hash limits. */
export async function downloadOfficialSetup(destination,{fetchImpl=fetch,signal}={}){
  const origin=CONCAT_RELEASE.url;
  fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
  const temp=destination+'.'+crypto.randomUUID()+'.partial';
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(new Error('Concat download timed out')),360000);timeout.unref?.();
  const onAbort=()=>abort.abort(signal.reason||new Error('Cancelled'));
  if(signal)signal.addEventListener('abort',onAbort,{once:true});
  try{
    const response=await fetchImpl(origin,{signal:abort.signal,redirect:'follow',headers:{'User-Agent':'AIProjectOS-Local-Installer/0.8'}});
    const final=new URL(response.url||origin);
    if(final.protocol!=='https:'||!['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(final.hostname))throw new Error('Concat installer redirect was not from trusted GitHub hosting');
    if(!response.ok||!response.body)throw new Error('Unable to download official Concat release (HTTP '+response.status+')');
    const expected=Number(response.headers?.get?.('content-length')||0);
    if(expected&&expected!==CONCAT_RELEASE.bytes)throw new Error('Concat asset content length changed');
    const hash=crypto.createHash('sha256');let count=0;
    await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,enc,cb){count+=chunk.length;if(count>CONCAT_RELEASE.bytes){cb(new Error('Concat asset exceeded pinned size'));return;}hash.update(chunk);cb(null,chunk);}}),fs.createWriteStream(temp,{flags:'wx',mode:0o600}));
    if(count!==CONCAT_RELEASE.bytes||hash.digest('hex')!==CONCAT_RELEASE.sha256)throw new Error('Concat installer SHA-256 check failed; refusing execution');
    fs.renameSync(temp,destination);return destination;
  }finally{clearTimeout(timeout);if(signal)signal.removeEventListener('abort',onAbort);try{fs.rmSync(temp,{force:true})}catch{}}
}

export async function acquireVerifiedSetup({root,env=process.env,downloadImpl=downloadOfficialSetup}={}){
  const local=bundledSetup(root);
  if(own(local)){
    if(!verifyPinnedSetup(local))throw new Error('Concat bundle is damaged or untrusted (SHA-256 mismatch)');
    return {file:local,bundled:true};
  }
  const cached=cacheSetup(env);
  if(own(cached)&&verifyPinnedSetup(cached))return {file:cached,bundled:false};
  if(own(cached))fs.rmSync(cached,{force:true});
  await downloadImpl(cached);
  if(!verifyPinnedSetup(cached))throw new Error('Official Concat installer failed its SHA-256 check');
  return {file:cached,bundled:false};
}
export function concatRunning({platform=process.platform,spawnSyncImpl=spawnSync}={}){
  if(platform!=='win32')return false;
  const p=spawnSyncImpl('tasklist',['/FI','IMAGENAME eq concat.exe','/FO','CSV','/NH'],{encoding:'utf8',timeout:5000,windowsHide:true});
  return p.status===0&&/"concat\.exe"/i.test(String(p.stdout||''));
}
export function configPath(env=process.env){return path.join(env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'app.concat.editor','settings.json')}
/** Preserve existing settings; never overwrite a malformed customer prefs file. */
export function enableConcatRemote({env=process.env,token=crypto.randomBytes(24).toString('hex'),port=7420}={}){
  if(!/^[0-9a-f]{48}$/.test(token))throw new Error('Invalid managed Concat token');
  if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('Invalid managed Concat port');
  const p=configPath(env);fs.mkdirSync(path.dirname(p),{recursive:true,mode:0o700});
  let settings={};
  if(own(p)){
    try{settings=JSON.parse(fs.readFileSync(p,'utf8'))}catch{throw new Error('Concat settings.json is invalid. Its contents were not modified.');}
    if(!settings||typeof settings!=='object'||Array.isArray(settings))throw new Error('Concat settings.json contains invalid settings');
    const backup=p+'.aios-before-managed.bak';
    if(!fs.existsSync(backup))fs.copyFileSync(p,backup,fs.constants.COPYFILE_EXCL);
  }
  settings.server={...(settings.server&&typeof settings.server==='object'&&!Array.isArray(settings.server)?settings.server:{}),enabled:true,listen:`127.0.0.1:${port}`,token};
  const temp=p+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(temp,JSON.stringify(settings,null,2),{flag:'wx',mode:0o600});fs.renameSync(temp,p);}finally{try{fs.rmSync(temp,{force:true})}catch{}}
  return {path:p,token,port};
}
export async function runOfficialInstaller(file,{spawnImpl=spawn,timeoutMs=300000}={}){
  // Official Concat setup is built with Inno Setup, PrivilegesRequired=lowest.
  const args=['/VERYSILENT','/SP-','/SUPPRESSMSGBOXES','/NORESTART','/CURRENTUSER'];
  await new Promise((resolve,reject)=>{
    const proc=spawnImpl(file,args,{windowsHide:true,stdio:'ignore',shell:false});
    let done=false;
    const timeout=setTimeout(()=>{if(done)return;done=true;try{proc.kill()}catch{}reject(new Error('Concat installer timed out'));},timeoutMs);
    const finish=(e)=>{if(done)return;done=true;clearTimeout(timeout);e?reject(e):resolve()};
    proc.once('error',finish);proc.once('exit',(code,signal)=>finish(code===0?null:new Error('Concat installer exited with code '+code+(signal?' ('+signal+')':''))));
  });
}
export function openConcat(exe,{spawnImpl=spawn}={}){
  if(!own(exe))throw new Error('Concat executable missing after setup');
  const proc=spawnImpl(exe,[],{detached:true,stdio:'ignore',windowsHide:false,shell:false});
  proc.on?.('error',()=>{});proc.unref?.();
}
/** Returns token to caller (server only): do not send it to the browser. */
export async function provisionConcat({root,env=process.env,platform=process.platform,downloadImpl=downloadOfficialSetup,installerImpl=runOfficialInstaller,launcherImpl=openConcat,runningImpl=concatRunning}={}){
  if(platform!=='win32'||process.arch!=='x64')throw new Error('Concat automatic setup currently supports Windows x64 only');
  if(runningImpl({platform}))throw new Error('Concat đang mở. Lưu công việc và đóng Concat trước khi kết nối tự động. Không tắt ứng dụng khi đang dựng video.');
  let exe=findInstalledConcat(env),installerBundled=null;
  if(!exe){
    const src=await acquireVerifiedSetup({root,env,downloadImpl});installerBundled=src.bundled;
    await installerImpl(src.file);
    exe=findInstalledConcat(env);
    if(!exe)throw new Error('Concat installer completed but concat.exe was not found. Check the installer log.');
  }
  const auth=enableConcatRemote({env});
  launcherImpl(exe);
  return {installed:true,bundled:installerBundled,version:CONCAT_RELEASE.version,token:auth.token,port:auth.port};
}
