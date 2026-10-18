import { commandExists, run } from './shell.mjs';
import { createVaultSecretRedactor } from './vault.mjs';
import crypto from 'node:crypto';

export async function sandboxStatus(){return {docker:await commandExists('docker')};}

export async function runNpm(root,script,{mode='safe',timeoutMs=180000}={}){
  if(typeof script!=='string'||!/^[a-zA-Z0-9:_-]{1,80}$/.test(script))throw new Error('npm script không hợp lệ.');
  if(!['safe','docker','host'].includes(mode))throw new Error('Sandbox mode không hợp lệ.');
  const redact=createVaultSecretRedactor();
  const startedAt=new Date().toISOString(),started=performance.now();let result,status,reason='';
  try{
    if(mode==='safe'){
      reason='Safe mode blocks command execution. Use Docker for agent-run tests, or explicitly choose Host (unsafe).';
      result={code:126,stdout:'',stderr:reason,timedOut:false};status='BLOCKED';
    }else if(mode==='docker'){
      if(!(await commandExists('docker')))throw new Error('Docker chưa được cài/chạy. Chọn Safe hoặc cài Docker Desktop.');
      const args=['run','--rm','--network','none','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--memory','1536m','--cpus','2','-v',`${root}:/workspace`,'-w','/workspace','node:22-bookworm-slim','npm','run',script];
      result=await run('docker',args,{timeoutMs,inheritEnv:false});
    }else{
      const exe=process.platform==='win32'?'npm.cmd':'npm';
      // Explicit Host mode still excludes unrelated ambient shell credentials.
      result=await run(exe,['run',script],{cwd:root,timeoutMs,inheritEnv:false});
    }
    status=status||(result.timedOut?'TIMED_OUT':result.code===0?'PASS':'FAIL');
  }catch(e){result={code:null,stdout:'',stderr:redact(e?.message||e),timedOut:false};status='ERROR';reason=result.stderr;}
  const receipt={id:crypto.randomUUID(),source:'runtime',kind:script==='test'?'test':'command',command:['npm','run',script],script,mode,status,exitCode:status==='BLOCKED'?null:result.code,startedAt,completedAt:new Date().toISOString(),durationMs:Math.max(0,Math.round(performance.now()-started)),timedOut:result.timedOut===true,reason,stdout:redact(String(result.stdout||'').slice(-40000)),stderr:redact(String(result.stderr||'').slice(-25000))};
  return {...result,stdout:receipt.stdout,stderr:receipt.stderr,receipt};
}
