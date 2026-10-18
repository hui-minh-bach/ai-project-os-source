import fs from 'node:fs';
import path from 'node:path';
import { run, must } from './shell.mjs';
import { resolveInfraCli } from './infra-tools.mjs';
import { findConnectionByKind } from './vault.mjs';

const REQUIRED_IGNORE=[
  'node_modules/','.env','.env.*','!.env.example','.DS_Store','dist/','.next/','coverage/',
  '.vercel/','.supabase/','.aws/','.ssh/','.npmrc','.pypirc','.netrc','*.pem','*.key','*.p12','*.pfx','credentials.json'
];
const LOCAL_NAME='AI Project OS Local';
const LOCAL_EMAIL='local@ai-project-os.invalid';

function sensitivePath(p){
  const s=String(p||'').replaceAll('\\','/').toLowerCase();
  const base=s.split('/').pop()||'';
  if(base==='.env.example')return false;
  return /(^|\/)\.env(?:\.|$)/.test(s)||/(^|\/)(\.npmrc|\.pypirc|\.netrc|credentials\.json)$/.test(s)||/(^|\/)(id_rsa|id_ed25519)(?:\.|$)/.test(s)||/\.(pem|key|p12|pfx)$/.test(base)||/(^|\/)(\.aws|\.ssh)(\/|$)/.test(s);
}

export function ensureSecureGitignore(cwd){
  const p=path.join(cwd,'.gitignore');
  if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw new Error('.gitignore không được là symbolic link.');
  let text='';try{text=fs.readFileSync(p,'utf8')}catch{}
  const lines=new Set(text.split(/\r?\n/));
  const missing=REQUIRED_IGNORE.filter(x=>!lines.has(x));
  if(missing.length){const prefix=text&& !text.endsWith('\n')?'\n':'';fs.writeFileSync(p,text+prefix+'\n# AI Project OS security defaults\n'+missing.join('\n')+'\n','utf8');}
}

export async function assertNoSensitiveStaged(cwd){
  const r=await run('git',['diff','--cached','--name-only','-z'],{cwd});
  if(r.code!==0)return;
  const bad=r.stdout.split('\0').filter(Boolean).filter(sensitivePath);
  if(bad.length)throw new Error('Git chặn commit vì có file nhạy cảm: '+bad.join(', '));
}

async function setIdentity(cwd,name,email,source){
  await must('git',['config','user.name',name],{cwd});
  await must('git',['config','user.email',email],{cwd});
  return {name,email,source};
}
export async function applyGitHubIdentity(cwd,user){
  if(!user?.id||!user?.login)throw new Error('Không có GitHub user id/login để tạo commit identity hợp lệ.');
  return setIdentity(cwd,String(user.login),`${user.id}+${user.login}@users.noreply.github.com`,'github');
}
export async function ensureReleaseAuthor(cwd,user){
  const identity=await applyGitHubIdentity(cwd,user);
  const current=(await run('git',['log','-1','--format=%ae'],{cwd})).stdout.trim();
  if(current!==identity.email)await must('git',['commit','--allow-empty','-m','Prepare GitHub release'],{cwd});
  return identity;
}

export async function ensureGitIdentity(cwd){
  let name=(await run('git',['config','user.name'],{cwd})).stdout.trim();
  let email=(await run('git',['config','user.email'],{cwd})).stdout.trim();
  if(name&&email)return {name,email,source:email===LOCAL_EMAIL?'local-placeholder':'git-config'};

  try{
    const gh=resolveInfraCli('github');
    const r=await run(gh.command,[...gh.args,'api','user','--jq','[.id,.login]|@tsv'],{timeoutMs:15000,inheritEnv:false});
    if(r.code===0){const [id,login]=r.stdout.trim().split(/\t+/);if(id&&login)return setIdentity(cwd,name||login,email||`${id}+${login}@users.noreply.github.com`,'github-cli');}
  }catch{}
  try{
    const c=findConnectionByKind('github');
    if(c?.secret){const r=await fetch('https://api.github.com/user',{headers:{authorization:`Bearer ${c.secret}`,accept:'application/vnd.github+json','user-agent':'AI-Project-OS-Local'}});if(r.ok){const j=await r.json();if(j?.id&&j?.login)return setIdentity(cwd,name||String(j.login),email||`${j.id}+${j.login}@users.noreply.github.com`,'github-token');}}
  }catch{}
  // Local commits need an identity for worktrees. Before GitHub push, publish.mjs replaces this
  // with the authenticated user's noreply identity and adds a release commit at HEAD.
  return setIdentity(cwd,name||LOCAL_NAME,email||LOCAL_EMAIL,'local-placeholder');
}
