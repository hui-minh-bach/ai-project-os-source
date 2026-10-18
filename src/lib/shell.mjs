import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function safeBaseEnv(extra={}){
  const keep=['PATH','PATHEXT','HOME','USERPROFILE','SystemRoot','WINDIR','COMSPEC','TEMP','TMP','TMPDIR','APPDATA','LOCALAPPDATA','LANG','LC_ALL','TERM'];
  const env={};for(const k of keep){if(process.env[k]!==undefined)env[k]=process.env[k];}
  return {...env,...extra};
}

export function run(cmd,args=[],opts={}){
  return new Promise((resolve,reject)=>{
    const base=opts.inheritEnv===false?safeBaseEnv():process.env;
    // A timed command owns its process group on POSIX. Killing only npm's
    // parent leaves script descendants holding stdout/stderr open indefinitely.
    const grouped=Boolean(opts.timeoutMs)&&process.platform!=='win32';
    if(Object.hasOwn(opts,'stdin')&&(typeof opts.stdin!=='string'||Buffer.byteLength(opts.stdin)>500000))return reject(new Error('Dữ liệu stdin không hợp lệ hoặc quá dài.'));
    const child=spawn(cmd,args,{cwd:opts.cwd,env:{...base,...(opts.env||{})},shell:false,windowsHide:true,detached:grouped,stdio:[Object.hasOwn(opts,'stdin')?'pipe':'ignore','pipe','pipe']});
    let stdout='',stderr='',done=false,timedOut=false,settlementTimer=null,killer=null,terminationError=null,childClosed=false,closeCode=null;
    const finish=(code,error)=>{
      if(done)return;done=true;clearTimeout(timer);clearTimeout(settlementTimer);
      if(killer){killer.kill('SIGKILL');killer.unref();killer=null;}
      if(terminationError)stderr=(stderr+'\n'+terminationError).slice(-500000);
      if(error)reject(error);else resolve({code:timedOut?null:code,stdout,stderr,timedOut,...(terminationError?{terminationError}: {})});
    };
    const timer=opts.timeoutMs?setTimeout(()=>{
      if(done)return;timedOut=true;
      // Bound settlement even if OS termination fails or an escaped descendant
      // still owns a pipe. Report timeout, never manufacture a successful exit.
      settlementTimer=setTimeout(()=>{
        terminationError ||= 'Process tree did not close its output pipes after timeout.';
        child.stdout?.destroy();child.stderr?.destroy();child.kill('SIGKILL');child.unref();finish(null);
      },1500);
      if(!child.pid)return;
      if(process.platform==='win32'){
        const taskkill=path.join(process.env.SystemRoot||process.env.WINDIR||'C:\\Windows','System32','taskkill.exe');
        killer=spawn(taskkill,['/PID',String(child.pid),'/T','/F'],{shell:false,windowsHide:true,stdio:'ignore',env:safeBaseEnv()});
        killer.on('error',()=>{terminationError='Windows process-tree termination could not start.';child.kill('SIGKILL');});
        killer.on('close',code=>{killer=null;if(code!==0&&!done){terminationError='Windows process-tree termination failed.';child.kill('SIGKILL');}if(childClosed)finish(closeCode);});
      }else{
        try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')terminationError='POSIX process-group termination failed: '+error.code;child.kill('SIGKILL');}
      }
    },opts.timeoutMs):null;
    if(Object.hasOwn(opts,'stdin')){child.stdin.on('error',()=>{});child.stdin.end(opts.stdin);}
    child.stdout?.setEncoding('utf8');child.stderr?.setEncoding('utf8');
    child.stdout?.on('data',d=>{stdout+=d;if(stdout.length>500000)stdout=stdout.slice(-500000);});
    child.stderr?.on('data',d=>{stderr+=d;if(stderr.length>500000)stderr=stderr.slice(-500000);});
    child.on('error',e=>finish(null,e));
    child.on('close',code=>{childClosed=true;closeCode=code;if(!killer)finish(code);});
  });
}

export async function commandExists(cmd){
  const name=String(cmd||'');if(!name||/[\\/]/.test(name))return false;
  const dirs=String(process.env.PATH||'').split(path.delimiter).filter(Boolean);
  const exts=process.platform==='win32'?String(process.env.PATHEXT||'.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean):[''];
  for(const dir of dirs){for(const ext of exts){const candidate=path.join(dir,process.platform==='win32'?name+(path.extname(name)?'':ext):name);try{fs.accessSync(candidate,process.platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);return true;}catch{}}}
  return false;
}
export async function must(cmd,args=[],opts={}){const r=await run(cmd,args,opts);if(r.code!==0)throw new Error(`${cmd} thất bại (${r.code})${r.timedOut?' [timeout]':''}\n${r.stderr||r.stdout}`);return r;}
