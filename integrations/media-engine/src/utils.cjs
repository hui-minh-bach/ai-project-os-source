'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {promisify} = require('node:util');
const sleep = promisify(setTimeout);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function shaFile(file){const hash=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buf=Buffer.alloc(1<<20);try{let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0)hash.update(buf.subarray(0,n));}finally{fs.closeSync(fd);}return hash.digest('hex');}
function insist(ok, message, code='INVALID'){if(!ok){const e=new Error(message);e.code=code;throw e;}}
function within(base, p, mustExist=true){
  insist(typeof p==='string' && p.length>0 && !p.includes('\0'), 'File path is required');
  const root=fs.realpathSync(base);
  const target=path.resolve(root,p);
  insist(target===root || target.startsWith(root+path.sep),'Path outside allowed workspace','FORBIDDEN_PATH');
  if(mustExist){
    const real=fs.realpathSync(target);
    insist(real===root || real.startsWith(root+path.sep),'Symlink escapes workspace','FORBIDDEN_PATH');
    return real;
  }
  let parent=path.dirname(target);
  while(!fs.existsSync(parent))parent=path.dirname(parent);
  const real=fs.realpathSync(parent);
  insist(real===root || real.startsWith(root+path.sep),'Parent symlink escapes workspace','FORBIDDEN_PATH');
  return target;
}
function mkdir(p){fs.mkdirSync(p,{recursive:true});return p;}
function atomic(file,contents){mkdir(path.dirname(file));const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,contents);fs.renameSync(tmp,file);}
function jsonRead(file, fallback=null){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
function jsonWrite(file,value){atomic(file,JSON.stringify(value,null,2)+'\n');}
function run(exe,args,{timeoutMs=120000,cwd,signal,maxOutput=2e6}={}){
  return new Promise((resolve,reject)=>{
    insist(typeof exe==='string' && exe.length>0,'Executable required');
    const child=spawn(exe,args,{cwd,stdio:['ignore','pipe','pipe'],windowsHide:true,signal});
    let out='',err='',aborted=false;
    const timer=setTimeout(()=>{aborted=true;child.kill('SIGKILL');},timeoutMs);
    for(const [stream,cb] of [[child.stdout,x=>out+=x],[child.stderr,x=>err+=x]])stream.on('data',b=>{cb(b.toString('utf8'));if(out.length+err.length>maxOutput){aborted=true;child.kill('SIGKILL');}});
    child.once('error',e=>{clearTimeout(timer);reject(e)});
    child.once('close',code=>{clearTimeout(timer);if(aborted)return reject(Object.assign(new Error('Process timeout or excessive output: '+exe),{code:'PROCESS_LIMIT'}));if(code!==0)return reject(Object.assign(new Error(`${exe} exited ${code}: ${err.slice(-1400)}`),{code:'COMMAND_FAILED'}));resolve({stdout:out,stderr:err,code});});
  });
}
const ffprobe=async(file,exe='ffprobe')=>{
  const r=await run(exe,['-v','error','-show_streams','-show_format','-of','json',file],{timeoutMs:30000});
  return JSON.parse(r.stdout);
};
const finite=(n,defaultValue=0)=>Number.isFinite(+n)?+n:defaultValue;
const duration=probe=>finite(probe.format?.duration);
const hasAudio=probe=>probe.streams.some(s=>s.codec_type==='audio');
const hasVideo=probe=>probe.streams.some(s=>s.codec_type==='video');
module.exports={fs,path,sha,shaFile,insist,within,mkdir,atomic,jsonRead,jsonWrite,run,ffprobe,finite,duration,hasAudio,hasVideo,sleep};
