import path from 'node:path';
import { skillPrompt, skillTaskContext } from './skills.mjs';
import fs from 'node:fs';
import { resolveModelConnection } from './model-bindings.mjs';
import { commandExists, run } from './shell.mjs';
import { DATA_DIR } from './store.mjs';
import { opencodeStatus, runOpencodeTask } from './opencode.mjs';
import { createVaultSecretRedactor } from './vault.mjs';
import os from 'node:os';
import crypto from 'node:crypto';

function envForConnection(id){
  const c=resolveModelConnection(id);const env={};
  if(c.kind==='openai')env.OPENAI_API_KEY=c.secret;
  if(c.kind==='anthropic')env.ANTHROPIC_API_KEY=c.secret;
  if(c.kind==='gemini')env.GEMINI_API_KEY=c.secret;
  if(c.kind==='openai_compatible'){env.OPENAI_API_KEY=c.secret;env.OPENAI_API_BASE=c.baseUrl||'';}
  return {c,env};
}
function miniModel(c){if(String(c.model).includes('/'))return c.model;const p={openai:'openai',anthropic:'anthropic',gemini:'gemini'}[c.kind];return p?`${p}/${c.model}`:c.model;}

async function runOpencodeExternalTask({root,workerId,spec,task,skills,allowUnsafeHost,assertCurrent,onEvent,redact}){
  if(!allowUnsafeHost)throw new Error('OpenCode có quyền shell đầy đủ trên host. Vì an toàn, khóa mặc định. Chỉ bật “Cho external agent chạy shell trên máy (unsafe)” khi bạn hiểu rủi ro.');
  const st=opencodeStatus();
  if(!st.ready)throw new Error(st.installHint);
  const {c,env}=envForConnection(workerId);
  const keyFromEnv=env.OPENAI_API_KEY||env.ANTHROPIC_API_KEY||env.GEMINI_API_KEY||'';
  const connection={kind:c.kind,model:c.model,baseUrl:c.baseUrl||''};
  const outDir=path.join(DATA_DIR,'trajectories');fs.mkdirSync(outDir,{recursive:true});
  const persistedOutput=path.join(outDir,`${String(task.id).replace(/[^a-z0-9_-]/gi,'-')}-${crypto.randomUUID()}.json`);
  const prompt=`You are implementing one task inside an isolated git worktree.\nPROJECT SPEC:\n${spec}\n\nTASK:\n${JSON.stringify(skillTaskContext(task))}\n\nOnly modify files needed for this task. Run relevant tests. Do not read secrets or files outside the repository.${skillPrompt(skills,{role:'worker'})}`;
  assertCurrent();const startedAt=new Date().toISOString(),started=performance.now();
  onEvent({at:startedAt,kind:'external-request',engine:'opencode',status:'WAITING'});
  let r;
  try{r=await runOpencodeTask({root,prompt,connection,secretKey:keyFromEnv,timeoutMs:900000});}
  catch(e){r={code:null,timedOut:false,stdout:'',stderr:redact(e.message),text:'',sessionId:null,cost:0,tokens:{input:0,output:0},error:redact(e.message),modelRef:''};}
  let trajectory=null,trajectoryStatus='NOT_AVAILABLE',trajectoryError='';
  try{
    fs.writeFileSync(persistedOutput,redact(JSON.stringify({engine:'opencode',sessionId:r.sessionId,model:r.modelRef,text:r.text,cost:r.cost,tokens:r.tokens,error:r.error},null,2)),'utf8');
    trajectory=persistedOutput;trajectoryStatus='REDACTED';
  }catch(e){trajectoryStatus='ERROR';trajectoryError=redact(e.message);}
  const receipt={id:crypto.randomUUID(),source:'runtime',kind:'external-command',command:['opencode','run','--model',r.modelRef||''],mode:'host',status:r.timedOut?'TIMED_OUT':r.code===0&&!r.error?'PASS':r.code===null?'ERROR':'FAIL',exitCode:r.code,startedAt,completedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-started),timedOut:r.timedOut===true,reason:'External runtime exit only; no test result inferred.',stdout:redact(String(r.stdout||'').slice(-12000)),stderr:redact(String(r.stderr||'').slice(-8000))};
  const log={at:receipt.completedAt,kind:'external',engine:'opencode',output:trajectory,trajectoryStatus,trajectoryError,stdout:receipt.stdout,status:receipt.status,receipt};onEvent(log);assertCurrent();
  if(r.code!==0||r.timedOut||r.error)throw new Error('OpenCode failed: '+(r.error||receipt.stderr||receipt.stdout).slice(-8000));
  if(trajectoryStatus==='ERROR')throw new Error('OpenCode trajectory không an toàn: '+trajectoryError);
  return {summary:'OpenCode runtime completed. Test results require separate trusted receipts.',log:[log],testReceipts:[receipt]};
}

export async function runExternalTask({engineId,root,workerId,spec,task,skills=[],allowUnsafeHost=false,assertCurrent=()=>{},onEvent=()=>{}}){
  const redact=createVaultSecretRedactor();assertCurrent();
  if(engineId==='opencode')return runOpencodeExternalTask({root,workerId,spec,task,skills,allowUnsafeHost,assertCurrent,onEvent,redact});
  if(engineId!=='mini-swe-agent')throw new Error('Engine này đã có adapter registry nhưng chưa hỗ trợ headless task execution. Dùng Native, mini-SWE-agent hoặc OpenCode.');
  if(!allowUnsafeHost)throw new Error('mini-SWE-agent có quyền shell đầy đủ trên host. Vì an toàn, v0.4.2 khóa mặc định. Chỉ bật “Cho external agent chạy shell trên máy (unsafe)” khi bạn hiểu rủi ro; v0.5 sẽ đưa external agents vào sandbox riêng.');
  if(!(await commandExists('mini')))throw new Error('mini-SWE-agent runtime chưa có. Cài: pip install mini-swe-agent');
  const {c,env}=envForConnection(workerId);
  const outDir=path.join(DATA_DIR,'trajectories');fs.mkdirSync(outDir,{recursive:true});
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-mini-')),output=path.join(temp,'trajectory.json'),persistedOutput=path.join(outDir,`${String(task.id).replace(/[^a-z0-9_-]/gi,'-')}-${crypto.randomUUID()}.json`);
  const prompt=`You are implementing one task inside an isolated git worktree.\nPROJECT SPEC:\n${spec}\n\nTASK:\n${JSON.stringify(skillTaskContext(task))}\n\nOnly modify files needed for this task. Run relevant tests. Do not read secrets or files outside the repository.${skillPrompt(skills,{role:'worker'})}`;
  const args=['--task',prompt,'--yolo','--exit-immediately','--model',miniModel(c),'--output',output];
  assertCurrent();const startedAt=new Date().toISOString(),started=performance.now();
  onEvent({at:startedAt,kind:'external-request',engine:engineId,status:'WAITING'});
  let r,trajectory=null,trajectoryStatus='NOT_AVAILABLE',trajectoryError='';
  try{
    try{r=await run('mini',args,{cwd:root,env,timeoutMs:900000,inheritEnv:false});}
    catch(e){r={code:null,stdout:'',stderr:redact(e.message),timedOut:false};}
    try{
      const st=fs.lstatSync(output);if(st.isSymbolicLink()||!st.isFile()||st.size>25_000_000)throw new Error('Trajectory không phải regular file an toàn hoặc quá lớn.');
      const sanitized=redact(fs.readFileSync(output,'utf8'));fs.writeFileSync(persistedOutput,sanitized,'utf8');trajectory=persistedOutput;trajectoryStatus='REDACTED';
    }catch(e){if(e.code!=='ENOENT'){trajectoryStatus='ERROR';trajectoryError=redact(e.message);}}
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
  const receipt={id:crypto.randomUUID(),source:'runtime',kind:'external-command',command:['mini','--model',miniModel(c)],mode:'host',status:r.timedOut?'TIMED_OUT':r.code===0?'PASS':r.code===null?'ERROR':'FAIL',exitCode:r.code,startedAt,completedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-started),timedOut:r.timedOut===true,reason:'External runtime exit only; no test result inferred.',stdout:redact(String(r.stdout||'').slice(-12000)),stderr:redact(String(r.stderr||'').slice(-8000))};
  const log={at:receipt.completedAt,kind:'external',engine:'mini-swe-agent',output:trajectory,trajectoryStatus,trajectoryError,stdout:receipt.stdout,status:receipt.status,receipt};onEvent(log);assertCurrent();
  if(r.code!==0||r.timedOut)throw new Error('mini-SWE-agent failed: '+(receipt.stderr||receipt.stdout).slice(-8000));
  if(trajectoryStatus==='ERROR')throw new Error('mini-SWE-agent trajectory không an toàn: '+trajectoryError);
  return {summary:'mini-SWE-agent runtime completed. Test results require separate trusted receipts.',log:[log],testReceipts:[receipt]};
}
