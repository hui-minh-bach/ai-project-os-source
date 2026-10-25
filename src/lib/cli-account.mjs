// Subscription-backed Claude Code / Gemini CLI adapters. No web passwords or
// cookies are ever accepted by AI Project OS. Only a successful, real, tool-free
// model response can make an account model selectable in the project.
import path from 'node:path';
import fs from 'node:fs';
import { run } from './shell.mjs';
import { resolveCli, cliProfileDir, cliRuntimeForHome } from './managed-cli.mjs';
import { getConnection, saveConnection, listConnections, vaultStatus } from './vault.mjs';
import { recordAccountCatalog, recordAccountModel, invalidateModels, modelAvailability } from './model-bindings.mjs';
import { atomicWriteText } from './store.mjs';
import { recordUsage } from './usage.mjs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MAP={claude:'claude_account',gemini:'gemini_account'};
const nameOf={claude:'Claude Code account',gemini:'Google Gemini CLI account'};
const validateKind=k=>{if(!Object.hasOwn(MAP,k))throw new Error('Loại đăng nhập không hỗ trợ.');return k;};
function assertVault(){if(!vaultStatus().unlocked)throw new Error('Cần mở Vault trước khi sử dụng tài khoản CLI.');}
function account(c){const kind=Object.keys(MAP).find(k=>MAP[k]===c.kind);if(!kind)throw new Error('Không phải kết nối CLI account.');return kind;}
export function createCliAccount(kind,name){
 assertVault();kind=validateKind(kind);
 // Multi-account (v0.9.56): any number of accounts per CLI provider,
 // like ChatGPT — each connection gets its OWN isolated login profile
 // (see cliAccountProfileDir), so a second account can never share or
 // silently replace the first account's vendor session.
 const c=saveConnection({kind:MAP[kind],name:String(name||nameOf[kind]).slice(0,80),meta:{authMode:'cli-account'}});
 return {id:c.id,kind,loginScript:kind==='claude'?'LOGIN-CLAUDE-WINDOWS.cmd':'LOGIN-GEMINI-WINDOWS.cmd',message:'Cài CLI, mở cửa sổ đăng nhập chính thức; sau đó nhập model và bấm Xác minh model.'};
}
// Deterministic per-connection profile resolution (v0.9.56), derived
// from the vault's connection list and never stored: peers of the kind
// ordered by (createdAt, id); the earliest-created connection adopts the
// LEGACY per-kind folder (an existing Claude/Gemini login survives the
// upgrade untouched — no migration, no re-login), later connections get
// cli-profiles/<kind>-accounts/<connectionId>.
const byCreation=(a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id).localeCompare(String(b.id));
export function cliAccountProfileDir(c){
 const kind=account(c);
 if(!c?.id)return cliProfileDir(kind);
 let peers=[];try{peers=listConnections().filter(x=>x.kind===MAP[kind]).sort(byCreation);}catch{peers=[];}
 // No readable vault context (plan-shape callers only — every real
 // inference path asserts the vault before planning): keep the legacy
 // per-kind shape. With the vault open the resolution above is exact.
 if(!peers.length)return cliProfileDir(kind);
 return cliProfileDir(kind,peers[0].id===c.id?null:c.id);
}
export function cliAccountStatus(id){
 assertVault();const c=getConnection(id),kind=account(c),availability=modelAvailability(id);
 let ready=false;try{resolveCli(kind);ready=true;}catch{}
 return {kind,installed:ready,availability,verifiedModels:availability.models||[],message:ready?'Chỉ model đã phản hồi thực sự mới có thể phân vai.':'Chưa cài CLI. Bấm Cài công cụ AI.'};
}
export function removeCliAccount(id){
 assertVault();const c=getConnection(id);const kind=account(c);invalidateModels(id);
 // Delete isolation (v0.9.56), same rule as Antigravity: only this
 // connection's affordances are touched. If it is the connection
 // adopting the LEGACY folder while siblings remain, park the legacy
 // folder under its own per-id slot (renamed, never deleted) so the
 // promoted sibling never inherits this account's vendor session.
 try{
  const siblings=listConnections().filter(x=>x.kind===MAP[kind]&&x.id!==id);
  const legacy=cliProfileDir(kind);
  if(siblings.length&&cliAccountProfileDir(c)===legacy&&fs.existsSync(legacy)){
   const parked=cliProfileDir(kind,id);
   if(!fs.existsSync(parked)){fs.mkdirSync(path.dirname(parked),{recursive:true,mode:0o700});fs.renameSync(legacy,parked);}
  }
 }catch{/* parking is best-effort hygiene; the vault removal stands */}
 return {ok:true};
}
export function cliInferencePlan(c,{system='',prompt=''}={}){
 const kind=account(c);
 if(typeof c.model!=='string'||!c.model.trim()||c.model.length>120||/[\x00-\x1f]/.test(c.model))throw new Error('Model CLI không hợp lệ.');
 const whole=(String(system||'')+'\n\nUSER:\n'+String(prompt||'')).trim();
 if(!whole||whole.length>120000)throw new Error('Prompt CLI quá dài hoặc trống.');
 const {cwd,env}=cliRuntimeForHome(cliAccountProfileDir(c));
 if(kind==='gemini'){
  // Google Gemini CLI: tools.core set explicitly to an empty allowlist.
  // Home & working directory are both private and contain no extensions/MCP.
  const settings=path.join(path.dirname(cwd),'.gemini','settings.json');
  let previous={};try{previous=JSON.parse(fs.readFileSync(settings,'utf8'));}catch{}
  const config={tools:{core:[]},mcpServers:{},context:{fileName:[]},telemetry:{enabled:false,logPrompts:false},security:{folderTrust:{enabled:false}}};
  if(previous?.auth&&typeof previous.auth.selectedType==='string')config.auth={selectedType:previous.auth.selectedType};
  atomicWriteText(settings,JSON.stringify(config,null,2),{backup:false});
  return {kind,cwd,env,args:['--prompt',whole,'--model',c.model,'--output-format','json'],settings};
 }
 const claudeEffort=c?.meta?.reasoningEffort;
 return {kind,cwd,env,args:['-p',whole,'--model',c.model,...(['low','medium','high','xhigh','max'].includes(claudeEffort)?['--effort',claudeEffort]:[]),'--output-format','json','--tools','','--disallowedTools','*','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--no-session-persistence','--setting-sources',''],settings:null};
}
export async function askCliAccount(c,{system='',prompt='',timeoutMs=90000}={},deps={}){
 assertVault();const old=getConnection(c.id),kind=account(old);
 if(old.credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi.');
 const plan=cliInferencePlan(c,{system,prompt}),launcher=(deps.resolve||resolveCli)(kind);
 // CLI is a subprocess, not a tool executor. Output/diagnostics are private;
 // error text is generic to avoid exposing OAuth tokens or profile contents.
 const result=await (deps.invoke||run)(launcher.command,[...launcher.args,...plan.args],{cwd:plan.cwd,env:plan.env,inheritEnv:false,timeoutMs:Math.max(20,Math.min(90000,timeoutMs))});
 if(result.code!==0||result.timedOut)throw Object.assign(new Error('CLI chưa đăng nhập, model không khả dụng hoặc yêu cầu đã quá hạn. Mở cửa sổ đăng nhập chính thức rồi thử lại.'),{code:result.timedOut?'PROVIDER_TIMEOUT':'PROVIDER_UNAVAILABLE'});
 let payload;try{payload=JSON.parse(result.stdout);}catch{throw new Error('CLI không trả kết quả JSON hợp lệ. Đã chặn sử dụng tài khoản.');}
 if(!payload||Array.isArray(payload)||payload.is_error||payload.error||payload.type==='error')throw new Error('CLI báo lỗi tài khoản hoặc model. Chưa xác minh.');
 // Do not accept a hidden fallback to a different model, when the CLI reports it.
 if(typeof payload.model==='string'&&payload.model!==c.model)throw new Error('CLI đã trả lời bằng model khác. Không xác minh model đã yêu cầu.');
 if(kind==='gemini'&&payload.stats?.models&&Object.keys(payload.stats.models).length){const used=Object.keys(payload.stats.models);if(!used.includes(c.model))throw new Error('Gemini CLI đã sử dụng model khác. Không xác minh model đã yêu cầu.');}
 const response=kind==='claude'?payload.result:payload.response;
 if(typeof response!=='string'||!response.trim()||response.length>240000)throw new Error('CLI không trả nội dung văn bản hợp lệ.');
 assertVault();if(getConnection(c.id).credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi trong khi chạy.');
 const observed=kind==='claude'?{usage:payload.usage||null}:{usageMetadata:payload.stats?.models?.[c.model]?.tokens||null};
 recordUsage(c,observed,crypto.randomUUID());
 return response.trim();
}
export async function verifyCliAccountModel(id,model,deps={}){
 assertVault();const c=getConnection(id),kind=account(c);
 if(typeof model!=='string'||!model.trim()||model.length>120||/[\x00-\x1f]/.test(model))throw new Error('Nhập tên model hợp lệ.');
 const text=await askCliAccount({...c,model},{prompt:'Reply with OK only. Do not access files or run tools.'},deps);
 if(!text)throw new Error('Model không phản hồi.');
 // Persist verified status only after actual model inference succeeds.
 const current=getConnection(id);
 recordAccountCatalog(current,[...new Set([...(modelAvailability(id).models||[]),model])]);
 recordAccountModel(current,model);
 saveConnection({...current,meta:{...current.meta,authMode:'cli-account',verifiedAt:new Date().toISOString()}});
 return {ok:true,model,kind,message:'Model đã phản hồi. Có thể dùng trong các vai trò AI.'};
}
export async function startCliLoginWindow(kind,{id,platform=process.platform,exec=run}={}){
 kind=validateKind(kind);
 if(platform!=='win32')throw new Error('Trên Windows dùng nút Mở đăng nhập; trên máy khác chạy CLI chính thức trong Terminal.');
 resolveCli(kind); // Fail immediately if CLI is not installed; never claim a login window opened.
 // Per-connection login (v0.9.56): with a connection id, the login
 // window runs against THAT connection's profile folder (passed through
 // the environment to tools/cli-login.mjs) and names the account, so
 // each account's vendor session lands in its own folder.
 let env;
 if(id){assertVault();const c=getConnection(id);if(account(c)!==kind)throw new Error('Kết nối không thuộc provider CLI này.');env={AIOS_CLI_PROFILE_DIR:cliAccountProfileDir(c),AIOS_CLI_ACCOUNT_NAME:c.name};}
 // This is a fixed PS1 from our release, not untrusted text from the browser.
 const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../LAUNCH-AI-LOGIN-WINDOWS.ps1');
 const r=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Kind',kind],{timeoutMs:15000,inheritEnv:false,...(env?{env}:{})});
 if(r.code!==0)throw new Error('Không mở được cửa sổ đăng nhập. Hãy chạy LOGIN-CLAUDE-WINDOWS.cmd hoặc LOGIN-GEMINI-WINDOWS.cmd trong thư mục ứng dụng.');
 return {ok:true,message:env?`Cửa sổ đăng nhập chính thức đã được mở cho tài khoản “${env.AIOS_CLI_ACCOUNT_NAME}” (hồ sơ riêng của tài khoản này). Hoàn tất đăng nhập rồi xác minh model.`:'Cửa sổ đăng nhập chính thức đã được mở. Hoàn tất đăng nhập rồi xác minh model.'};
}
