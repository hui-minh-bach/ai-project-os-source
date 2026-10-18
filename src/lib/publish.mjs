import fs from 'node:fs';
import path from 'node:path';
import { getConnection } from './vault.mjs';
import { workspaceDir } from './workspace.mjs';
import { run, must, commandExists } from './shell.mjs';
import { ensureSecureGitignore, ensureGitIdentity, ensureReleaseAuthor, assertNoSensitiveStaged } from './git-security.mjs';
import { resolveInfraCli } from './infra-tools.mjs';

function slug(s){return String(s||'ai-project').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'ai-project';}
function redactRemote(raw){const r=String(raw||'').trim();if(!r)return '';try{const u=new URL(r);if(u.username||u.password){u.username='';u.password='';return u.toString().replace(/\/$/,'');}return r;}catch{return r.replace(/^(https?:\/\/)[^/@]+@/i,'$1');}}
function githubRemoteInfo(remote){
  const raw=redactRemote(remote).replace(/\.git$/,'');
  let m=raw.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if(!m)m=raw.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  return m?{owner:m[1].toLowerCase(),name:m[2].toLowerCase()}:null;
}
export async function gitStatus(projectId){const cwd=workspaceDir(projectId);if(!fs.existsSync(path.join(cwd,'.git')))return {initialized:false};const branch=(await run('git',['branch','--show-current'],{cwd})).stdout.trim();const status=(await run('git',['status','--short'],{cwd})).stdout;const remote=redactRemote((await run('git',['remote','get-url','origin'],{cwd})).stdout.trim());return {initialized:true,branch,status,remote};}
export async function initGit(projectId){
  if(!(await commandExists('git')))throw new Error('Máy chưa cài Git.');
  const cwd=workspaceDir(projectId);
  if(!fs.existsSync(path.join(cwd,'.git')))await must('git',['init','-b','main'],{cwd});
  ensureSecureGitignore(cwd);
  await ensureGitIdentity(cwd);
  await must('git',['add','-A'],{cwd});
  const has=(await run('git',['diff','--cached','--quiet'],{cwd})).code!==0;
  if(has){await assertNoSensitiveStaged(cwd);await must('git',['commit','-m','Initial project from AI Project OS'],{cwd});}
  return gitStatus(projectId);
}

async function githubUserToken(c){const r=await fetch('https://api.github.com/user',{headers:{authorization:`Bearer ${c.secret}`,accept:'application/vnd.github+json','user-agent':'AI-Project-OS-Local'}});const j=await r.json();if(!r.ok)throw new Error(j.message||'GitHub user lookup failed');return j;}

export async function publishGitHub({projectId,connectionId,name,isPrivate=true,description=''}){
  const c=getConnection(connectionId);if(c.kind!=='github')throw new Error('Hãy chọn kết nối GitHub.');await initGit(projectId);const cwd=workspaceDir(projectId),repoName=slug(name);
  if(c.meta?.authMode==='cli'){
    const gh=resolveInfraCli('github');
    let user={id:c.meta?.userId,login:c.meta?.login};
    if(!user.id||!user.login){const ur=await run(gh.command,[...gh.args,'api','user','--jq','[.id,.login]|@tsv'],{timeoutMs:15000,inheritEnv:false});if(ur.code!==0)throw new Error('Không đọc được GitHub identity.');const [uid,login]=ur.stdout.trim().split(/\t+/);user={id:uid,login};}
    await ensureReleaseAuthor(cwd,user);
    const remoteRead=await run('git',['remote','get-url','origin'],{cwd});
    if(remoteRead.code===0){
      const existing=remoteRead.stdout.trim();
      const info=githubRemoteInfo(existing);
      if(!info||info.name!==repoName.toLowerCase()||info.owner!==String(user.login).toLowerCase())throw new Error(`Workspace đã có origin khác (${redactRemote(existing)}). Không tự push để tránh ghi nhầm repo/tài khoản. Hãy đổi/xóa origin hoặc dùng đúng repo thuộc GitHub account đang kết nối.`);
      await run(gh.command,[...gh.args,'auth','setup-git'],{timeoutMs:30000,inheritEnv:false});
      const push=await run('git',['push','-u','origin','main'],{cwd,timeoutMs:120000,inheritEnv:false});if(push.code!==0)throw new Error('Push GitHub thất bại: '+(push.stderr||push.stdout).slice(-4000));
      const remote=redactRemote(existing);return {ok:true,repo:remote,url:remote.replace(/\.git$/,'').replace('git@github.com:','https://github.com/'),private:isPrivate,authMode:'cli',existingRemote:true};
    }
    const args=['repo','create',repoName,isPrivate?'--private':'--public','--source','.','--remote','origin','--push','--description',String(description||'').slice(0,240)];
    const r=await run(gh.command,[...gh.args,...args],{cwd,timeoutMs:120000,inheritEnv:false});if(r.code!==0)throw new Error('GitHub CLI publish thất bại: '+(r.stderr||r.stdout).slice(-4000));const remote=redactRemote((await run('git',['remote','get-url','origin'],{cwd})).stdout.trim());return {ok:true,repo:remote,url:remote.replace(/\.git$/,'').replace('git@github.com:','https://github.com/'),private:isPrivate,authMode:'cli'};
  }
  if(!c.secret)throw new Error('GitHub token chưa có.');const user=await githubUserToken(c);await ensureReleaseAuthor(cwd,user);let r=await fetch('https://api.github.com/user/repos',{method:'POST',headers:{authorization:`Bearer ${c.secret}`,accept:'application/vnd.github+json','content-type':'application/json','user-agent':'AI-Project-OS-Local'},body:JSON.stringify({name:repoName,private:Boolean(isPrivate),description:String(description||'').slice(0,240),auto_init:false})});let j=await r.json();if(!r.ok&&r.status!==422)throw new Error(j.message||'Không tạo được GitHub repo.');if(r.status===422){const gr=await fetch(`https://api.github.com/repos/${encodeURIComponent(user.login)}/${encodeURIComponent(repoName)}`,{headers:{authorization:`Bearer ${c.secret}`,accept:'application/vnd.github+json','user-agent':'AI-Project-OS-Local'}});j=await gr.json();if(!gr.ok)throw new Error('Tên repo đã tồn tại nhưng không truy cập được.');}
  const remote=j.clone_url||`https://github.com/${user.login}/${repoName}.git`;const existing=(await run('git',['remote'],{cwd})).stdout.split(/\r?\n/).filter(Boolean);if(existing.includes('origin'))await must('git',['remote','set-url','origin',remote],{cwd});else await must('git',['remote','add','origin',remote],{cwd});const authHeader=`AUTHORIZATION: bearer ${c.secret}`;const push=await run('git',['push','-u','origin','main'],{cwd,timeoutMs:120000,inheritEnv:false,env:{GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.extraHeader',GIT_CONFIG_VALUE_0:authHeader}});if(push.code!==0)throw new Error('Push GitHub thất bại: '+push.stderr.slice(-2000));return {ok:true,repo:`${user.login}/${repoName}`,url:j.html_url||`https://github.com/${user.login}/${repoName}`,private:j.private,authMode:'token'};
}

export async function deployVercel({projectId,connectionId,prod=false}){
  const c=getConnection(connectionId);if(c.kind!=='vercel')throw new Error('Hãy chọn kết nối Vercel.');const vc=resolveInfraCli('vercel');const cwd=workspaceDir(projectId);const args=['deploy','--yes'];const env={};if(c.meta?.authMode!=='cli'){if(!c.secret)throw new Error('Thiếu Vercel token.');env.VERCEL_TOKEN=c.secret;}if(prod)args.push('--prod');const r=await run(vc.command,[...vc.args,...args],{cwd,timeoutMs:300000,inheritEnv:false,env});if(r.code!==0)throw new Error('Vercel deploy thất bại: '+r.stderr.slice(-3000));const url=(r.stdout.match(/https:\/\/[^\s]+/g)||[]).at(-1)||'';return {ok:true,url,output:r.stdout.slice(-5000),authMode:c.meta?.authMode||'token'};
}
