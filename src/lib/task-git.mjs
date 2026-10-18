import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.mjs';
import { workspaceDir } from './workspace.mjs';
import { run, must, commandExists } from './shell.mjs';
import { ensureSecureGitignore, ensureGitIdentity, assertNoSensitiveStaged } from './git-security.mjs';

const WT_ROOT=path.join(DATA_DIR,'task-worktrees');
fs.mkdirSync(WT_ROOT,{recursive:true});
const clean=s=>String(s||'task').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase();
const gitTails=new Map();

async function withGitLock(projectId,fn){
  const key=String(projectId);const prev=gitTails.get(key)||Promise.resolve();let release;
  const gate=new Promise(r=>{release=r});const tail=prev.catch(()=>{}).then(()=>gate);gitTails.set(key,tail);
  await prev.catch(()=>{});
  try{return await fn();}finally{release();if(gitTails.get(key)===tail)gitTails.delete(key);}
}

async function ensureBaselineUnlocked(projectId){
  if(!(await commandExists('git')))throw new Error('Git chưa được cài.');
  const cwd=workspaceDir(projectId);
  if(!fs.existsSync(path.join(cwd,'.git')))await must('git',['init','-b','main'],{cwd});
  ensureSecureGitignore(cwd);
  await ensureGitIdentity(cwd);
  const branch=(await run('git',['branch','--show-current'],{cwd})).stdout.trim();
  if(!branch)await must('git',['checkout','-B','main'],{cwd});
  await must('git',['add','-A'],{cwd});
  const dirty=(await run('git',['diff','--cached','--quiet'],{cwd})).code!==0;
  if(dirty){
    await assertNoSensitiveStaged(cwd);
    const commit=await run('git',['commit','-m','AI Project OS baseline'],{cwd});
    if(commit.code!==0&&!/nothing to commit|working tree clean/i.test(commit.stdout+'\n'+commit.stderr))throw new Error(`git commit baseline thất bại (${commit.code})\n${commit.stderr||commit.stdout}`);
  }
  const hasHead=(await run('git',['rev-parse','--verify','HEAD'],{cwd})).code===0;
  if(!hasHead){
    const marker=path.join(cwd,'.ai-project-os');
    if(fs.existsSync(marker)&&fs.lstatSync(marker).isSymbolicLink())throw new Error('.ai-project-os không được là symbolic link.');
    fs.writeFileSync(marker,'workspace\n','utf8');
    await must('git',['add','.ai-project-os'],{cwd});
    await assertNoSensitiveStaged(cwd);
    await must('git',['commit','-m','AI Project OS initial baseline'],{cwd});
  }
  return cwd;
}

export async function ensureBaseline(projectId){return withGitLock(projectId,()=>ensureBaselineUnlocked(projectId));}

export async function createTaskWorktree(projectId,taskId){
  return withGitLock(projectId,async()=>{
    const main=await ensureBaselineUnlocked(projectId);
    const branch=`ai-task/${clean(taskId)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    const dir=path.join(WT_ROOT,clean(projectId),clean(taskId)+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6));
    fs.mkdirSync(path.dirname(dir),{recursive:true});
    await must('git',['worktree','add','-b',branch,dir,'main'],{cwd:main});
    await ensureGitIdentity(dir);
    return {main,dir,branch,baseSha:(await must('git',['rev-parse','HEAD'],{cwd:dir})).stdout.trim()};
  });
}

export async function commitTask(worktree,message){
  await must('git',['add','-A'],{cwd:worktree.dir});
  const dirty=(await run('git',['diff','--cached','--quiet'],{cwd:worktree.dir})).code!==0;
  if(!dirty)return null;
  await assertNoSensitiveStaged(worktree.dir);
  await must('git',['commit','-m',String(message||'AI task').slice(0,120)],{cwd:worktree.dir});
  return (await must('git',['rev-parse','HEAD'],{cwd:worktree.dir})).stdout.trim();
}

export async function mergeTask(projectId,worktree,{guard,lockSpecification}={}){
  return withGitLock(projectId,async()=>{
    guard?.();
    const main=await ensureBaselineUnlocked(projectId);
    guard?.();
    const current=(await must('git',['branch','--show-current'],{cwd:main})).stdout.trim();
    if(current!=='main')await must('git',['checkout','main'],{cwd:main});
    // The guard runs inside the project Git lock, after every preceding await.
    // A task queued behind another merge cannot merge an obsolete specification.
    const beforeSha=(await must('git',['rev-parse','HEAD'],{cwd:main})).stdout.trim();
    guard?.();const unlock=lockSpecification?.()||(()=>{});
    try{
      const r=await run('git',['merge','--no-ff','--no-edit',worktree.branch],{cwd:main});
      if(r.code!==0){
        const abort=await run('git',['merge','--abort'],{cwd:main});
        return {ok:false,conflict:true,error:(r.stderr||r.stdout).slice(-5000),abort:{ok:abort.code===0,exitCode:abort.code}};
      }
      const sha=(await must('git',['rev-parse','HEAD'],{cwd:main})).stdout.trim();
      try{guard?.();}catch(e){
        // API brief/spec writes are held during this window. This also catches
        // out-of-band state changes; reset --merge preserves unrelated edits.
        const rollback=await run('git',['reset','--merge',beforeSha],{cwd:main});
        e.rollback={source:'runtime',ok:rollback.code===0,exitCode:rollback.code,beforeSha,discardedMergeSha:sha,error:(rollback.stderr||'').slice(-1500)};
        if(rollback.code!==0)e.message+=' · Rollback merge thất bại: '+e.rollback.error;throw e;
      }
      return {ok:true,sha};
    }finally{unlock();}
  });
}

export async function cleanupTaskWorktree(projectId,worktree,{deleteBranch=true}={}){
  if(!worktree)return {at:new Date().toISOString(),worktreeRemoved:true,branchDeleted:false,branchRetained:false,worktreeExists:false,errors:[]};
  return withGitLock(projectId,async()=>{
    const main=workspaceDir(projectId);
    const errors=[];
    const ownedRoot=path.join(WT_ROOT,clean(projectId))+path.sep;
    if(!String(worktree.dir||'').startsWith(ownedRoot)||!String(worktree.branch||'').startsWith('ai-task/'))throw new Error('Chỉ được cleanup worktree/branch thuộc phiên task này.');
    const registered=async()=>{const list=await run('git',['worktree','list','--porcelain'],{cwd:main});if(list.code!==0){errors.push((list.stderr||list.stdout).slice(-1500));return null;}return list.stdout.split(/\r?\n/).includes('worktree '+worktree.dir);};
    if(await registered()){
      const r=await run('git',['worktree','remove','--force',worktree.dir],{cwd:main});if(r.code!==0)errors.push((r.stderr||r.stdout).slice(-1500));
    }
    const beforeBranch=await run('git',['show-ref','--verify','--quiet','refs/heads/'+worktree.branch],{cwd:main});
    if(deleteBranch&&beforeBranch.code===0){const r=await run('git',['branch','-D',worktree.branch],{cwd:main});if(r.code!==0)errors.push((r.stderr||r.stdout).slice(-1500));}
    const stillRegistered=await registered(),afterBranch=await run('git',['show-ref','--verify','--quiet','refs/heads/'+worktree.branch],{cwd:main}),worktreeExists=fs.existsSync(worktree.dir);
    return {at:new Date().toISOString(),worktreeRemoved:stillRegistered===false&&!worktreeExists,worktreeExists,branchDeleted:deleteBranch&&afterBranch.code===1,branchRetained:afterBranch.code===0,errors};
  });
}

export async function taskDiff(worktree){
  const r=await must('git',['diff',`${worktree.baseSha}..HEAD`,'--no-ext-diff','--unified=3'],{cwd:worktree.dir});
  return r.stdout.slice(0,180000);
}
export async function taskHead(worktree){return (await must('git',['rev-parse','HEAD'],{cwd:worktree.dir})).stdout.trim();}
