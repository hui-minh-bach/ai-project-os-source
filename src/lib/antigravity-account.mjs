// Antigravity CLI is Google's replacement for consumer Gemini CLI (June 2026).
// Authentication is owned by Google's official binary. No web passwords,
// browser cookies, unofficial OAuth endpoints, or hidden quotas are used here.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, atomicWriteText } from './store.mjs';
import { run } from './shell.mjs';
import { getConnection, listConnections, saveConnection, vaultStatus } from './vault.mjs';
import { recordAccountCatalog, recordAccountModel, invalidateModels, modelAvailability } from './model-bindings.mjs';
import { recordUsage } from './usage.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const DOCS='https://www.antigravity.google/docs/cli/install/';
const KIND='antigravity_account';
// Per-connection CLI profiles (v0.9.56 — multi-account Antigravity, the
// owner's "giống chatgpt ấy" order). Until 0.9.55 this module had ONE fixed
// session folder for the whole kind, so every Antigravity login shared and
// replaced a single Google session and a second account could not exist.
// Now — exactly like ChatGPT/Codex (account-profiles/<connectionId>) —
// every connection gets its OWN session folder and its own environment.
// Resolution is deterministic and derived from the vault's connection
// list, never stored: peers ordered by (createdAt, id); the earliest
// created connection adopts the LEGACY folder (no migration — the
// owner's existing verified "Ngọc" session survives the upgrade
// untouched, no re-login), later connections get
// cli-profiles/antigravity-accounts/<connectionId>.
const LEGACY_PROFILE=path.join(DATA_DIR,'cli-profiles','antigravity');
const ACCOUNTS_DIR=path.join(DATA_DIR,'cli-profiles','antigravity-accounts');
const byCreation=(a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))||String(a.id).localeCompare(String(b.id));
export function antigravityProfileDir(id){
 if(!id)return LEGACY_PROFILE;
 let peers=[];try{peers=listConnections().filter(c=>c.kind===KIND).sort(byCreation);}catch{peers=[];}
 if(peers.length&&peers[0].id===id)return LEGACY_PROFILE;
 return path.join(ACCOUNTS_DIR,String(id));
}
const SAFE_NAME=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/;
const VALID_STATUS=new Set(['SUCCESS']);
const safeExecutable=(p)=>{try{return fs.statSync(p).isFile()?p:null;}catch{return null;}};
export function antigravityLauncher({platform=process.platform,env=process.env}={}){
 const dirs=[];
 let ideFound=false;
 if(platform==='win32'){
  const local=env.LOCALAPPDATA||path.join(env.USERPROFILE||env.HOME||'', 'AppData','Local');
  const home=env.USERPROFILE||env.HOME||'';
  dirs.push(path.join(local,'agy','bin','agy.exe'));
  dirs.push(path.join(local,'agy','agy.exe'));
  // WinGet registers a per-user link, which may not yet be present in PATH
  // of an already-running AI Project OS process.
  dirs.push(path.join(local,'Microsoft','WinGet','Links','agy.exe'));
  // WinGet package payloads — the Links entry can lag behind the install
  // or be skipped, so probe the package folders directly (bounded scan).
  try{
   const pkgs=path.join(local,'Microsoft','WinGet','Packages');
   for(const name of fs.readdirSync(pkgs)){
    if(!/^Google\.AntigravityCLI/i.test(name))continue;
    const base=path.join(pkgs,name);
    dirs.push(path.join(base,'agy.exe'),path.join(base,'bin','agy.exe'));
    try{for(const sub of fs.readdirSync(base,{withFileTypes:true}))if(sub.isDirectory())dirs.push(path.join(base,sub.name,'agy.exe'),path.join(base,sub.name,'bin','agy.exe'));}catch{}
   }
  }catch{}
  dirs.push(path.join(local,'Programs','Antigravity CLI','bin','agy.exe'));
  dirs.push(path.join(local,'Programs','Antigravity','bin','agy.exe'));
  if(home)dirs.push(path.join(home,'.local','bin','agy.exe'));
  // The Antigravity desktop IDE is a different install from the CLI: detect
  // it so the user gets the right instruction instead of a bare "not found".
  ideFound=Boolean(safeExecutable(path.join(local,'Programs','Antigravity','Antigravity.exe')));
 }
 for(const d of String(env.PATH||env.Path||'').split(platform==='win32'?';':path.delimiter).filter(Boolean)){
  dirs.push(path.join(d,platform==='win32'?'agy.exe':'agy'));
  if(platform==='win32')dirs.push(path.join(d,'bin','agy.exe'));
 }
 for(const file of dirs){const found=safeExecutable(file);if(found)return {command:found,args:[],source:'official-install'};}
 if(ideFound)throw new Error('Đã thấy ứng dụng Antigravity (IDE) trên máy, nhưng chưa có Antigravity CLI (lệnh agy) — IDE và CLI là hai bản cài khác nhau. Bấm nút 1 để cài CLI bằng WinGet, rồi bấm Kiểm tra lại.');
 throw new Error('Chưa tìm thấy Antigravity CLI. Cài từ trang chính thức của Google, sau đó bấm Kiểm tra lại.');
}
export function antigravityEnvironment(id,{env=process.env}={}){
 // Back-compat: a bare {env} first argument (pre-0.9.56 call shape) means
 // "no specific connection" and resolves to the legacy profile.
 if(id&&typeof id==='object'){env=id.env||process.env;id=null;}
 const home=antigravityProfileDir(id),cwd=path.join(home,'empty');fs.mkdirSync(cwd,{recursive:true,mode:0o700});
 const vars={HOME:home,USERPROFILE:home,PATH:env.PATH||env.Path||''};
 for(const k of ['SystemRoot','WINDIR','COMSPEC','TEMP','TMP','PATHEXT','LANG','APPDATA','LOCALAPPDATA'])if(env[k])vars[k]=env[k];
 // Do not inherit any provider API secrets, custom MCP URLs, or billing overrides.
 const settings=path.join(home,'.gemini','antigravity-cli','settings.json');
 fs.mkdirSync(path.dirname(settings),{recursive:true,mode:0o700});
 // This is a separate, locked-down Project OS CLI profile, not the user's
 // regular Antigravity desktop configuration. Deny all tool execution where
 // supported. Explicitly never pass --dangerously-skip-permissions.
 const baseline={toolPermission:'strict',agentMode:'plan',enableTerminalSandbox:true,allowNonWorkspaceAccess:false,artifactReviewPolicy:'asks-for-review',permissions:{allow:[],deny:['command(*)','write_file(*)','read_file(*)','mcp(*)','execute_url(*)','read_url(*)'],ask:[]},mcpServers:{},hooks:{},telemetry:{enabled:false}};
 if(!fs.existsSync(settings))atomicWriteText(settings,JSON.stringify(baseline,null,2),{backup:false});
 else {
  // Keep official authentication/profile settings while removing dangerous
  // grants, MCP servers, and auto-execution settings from this isolated profile.
  let previous={};try{previous=JSON.parse(fs.readFileSync(settings,'utf8'));}catch{}
  // Preserve only CLI presentation/auth state, never carry over grants or plugins.
  const safe={...Object.fromEntries(Object.entries(previous).filter(([k])=>['auth','theme','altScreenMode','preferredModel'].includes(k))),...baseline};
  delete safe.modelProvider; // A Gemini API key is never a subscription login.
  atomicWriteText(settings,JSON.stringify(safe,null,2),{backup:false});
 }
 return {cwd,env:vars,settings};
}
function requireVault(){if(!vaultStatus().unlocked)throw new Error('Hãy mở Secret Vault trước.');}
function currentAccount(id){requireVault();const c=getConnection(id);if(c.kind!==KIND||c.meta?.authMode!=='antigravity-cli')throw new Error('Đây không phải tài khoản Antigravity.');return c;}
export function createAntigravityAccount(name='Google Antigravity'){
 requireVault();
 // Multi-account (v0.9.56): any number of Antigravity connections, like
 // ChatGPT — each one gets its own Google session folder (see
 // antigravityProfileDir), so accounts never share or replace sessions.
 // Probe before persisting: a real CLI must already be installed.
 antigravityLauncher();
 const c=saveConnection({kind:KIND,name:String(name||'Google Antigravity').slice(0,80),meta:{authMode:'antigravity-cli'}});
 return {id:c.id,message:'Đã tạo hồ sơ. Mở đăng nhập Google chính thức rồi tải danh sách model và xác minh.'};
}
export function antigravityStatus(id){
 if(id)currentAccount(id);
 let installed=false,probe='';try{antigravityLauncher();installed=true;}catch(e){probe=e.message;}
 return {installed,officialUrl:DOCS,mode:'google-account',availability:id?modelAvailability(id):undefined,message:installed?'Đã tìm thấy CLI. Chỉ model phản hồi thực tế mới được phân vai.':(probe||'Hãy cài CLI chính thức của Google.')};
}
// Surface the CLI's own words in failure errors: a bare generic message once
// cost days of misdiagnosis — a CLI flags error ("flags provided but not
// defined") was reported to the owner as "login incomplete" while the login
// was fine, sending everyone to re-login instead of fixing the invocation.
function cliFailure(lead,r){
 const tail=String((r&&(r.stderr||r.stdout))||'').trim().slice(-300);
 const why=r&&r.timedOut?'hết thời gian chờ (timeout)':`mã thoát ${r&&r.code!=null?r.code:'không rõ'}`;
 return `${lead} Antigravity CLI không phản hồi — ${why}.${tail?' Chi tiết từ CLI: '+tail:''}`;
}
function stdoutSample(r){return String((r&&r.stdout)||'').trim().slice(0,200);}
export async function listAntigravityModels(id,deps={}){
 const c=currentAccount(id);const bin=(deps.resolve||antigravityLauncher)();const {cwd,env}=(deps.profile||antigravityEnvironment)(id);
 // Antigravity CLI 1.4.0 (proven on the owner's machine): the `models`
 // subcommand accepts NO flags besides -h/--help — passing
 // `--output-format json` exits non-zero with "flags provided but not
 // defined". Call it bare. Its output is a text table
 // ("<model-id><spaces><display name>" per line); keep the JSON-envelope
 // parse first so a future CLI that speaks JSON still works.
 const r=await (deps.invoke||run)(bin.command,[...bin.args,'models'],{cwd,env,inheritEnv:false,timeoutMs:45000});
 if(r.code!==0||r.timedOut)throw new Error(cliFailure('Không đọc được model Antigravity.',r));
 let models=[];
 let parsed;try{parsed=JSON.parse(r.stdout);}catch{parsed=undefined;}
 if(parsed!==undefined){
  const entries=Array.isArray(parsed)?parsed:([parsed.models,parsed.data?.models,parsed.command?.data?.models,parsed.result?.models].find(Array.isArray));
  if(!Array.isArray(entries)||parsed.status&&parsed.status!=='SUCCESS'||parsed.command?.name&&parsed.command.name!=='models')throw new Error(`Antigravity CLI không trả danh sách model hợp lệ. Mẫu đầu ra: ${stdoutSample(r)}`);
  models=entries.map(m=>typeof m==='string'?m:m?.id||m?.slug).filter(m=>typeof m==='string'&&SAFE_NAME.test(m));
 }else{
  // Text-table parse: first whitespace-delimited token of each line, kept
  // only when it is a safe name with model-id shape (contains '-' or '.'),
  // which rejects stray words from any header/footer noise.
  for(const line of String(r.stdout||'').split(/\r?\n/)){
   const token=line.trim().split(/\s+/)[0]||'';
   if(SAFE_NAME.test(token)&&/[-.]/.test(token))models.push(token);
  }
 }
 models=[...new Set(models)].slice(0,100);
 if(!models.length)throw new Error(`Tài khoản Antigravity chưa có model khả dụng. Mẫu đầu ra CLI: ${stdoutSample(r)}`);
 requireVault();if(getConnection(id).credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi khi tải model.');
 recordAccountCatalog(c,models);
 return models;
}
export async function askAntigravityAccount(connection,{system='',prompt='',timeoutMs=90000}={},deps={}){
 const current=currentAccount(connection.id);
 if(current.credentialVersion!==connection.credentialVersion)throw new Error('Tài khoản Antigravity đã thay đổi.');
 if(!SAFE_NAME.test(connection.model||''))throw new Error('Model Antigravity không hợp lệ.');
 const text=(String(system||'')+'\n\nReturn text only. Do not invoke built-in tools. If fresh evidence is missing, state that limitation; the host executes authorized tools separately.\n\nYêu cầu:\n'+String(prompt||'')).trim();
 if(!text||text.length>120000)throw new Error('Prompt rỗng hoặc quá dài.');
 const bin=(deps.resolve||antigravityLauncher)();const {cwd,env}=(deps.profile||antigravityEnvironment)(connection.id);
 const args=[...bin.args,'--input-format','stream-json','--output-format','stream-json','--sandbox','--mode=plan','--model',connection.model];
 // Feed the prompt through stdin rather than placing private user data in the
 // Windows process command line or exposing the OS argument-length limit.
 const stdin=JSON.stringify({event:'user',message:{content:text}})+'\n';
 const r=await (deps.invoke||run)(bin.command,args,{cwd,env,inheritEnv:false,timeoutMs:Math.max(20,Math.min(90000,timeoutMs)),stdin});
 if(r.code!==0||r.timedOut)throw Object.assign(new Error(cliFailure('Antigravity CLI is unavailable.',r)),{code:r.timedOut?'PROVIDER_TIMEOUT':'PROVIDER_UNAVAILABLE'});
 let events;try{events=r.stdout.trim().split(/\r?\n/).map(line=>JSON.parse(line));}catch{throw new Error('Antigravity CLI không trả JSON sự kiện hợp lệ.');}
 const initial=events.find(e=>e.event==='init');
 const resultEvent=events.filter(e=>e.event==='result').at(-1);
 // Google documents `result` nested inside the terminal event.
 const terminal=resultEvent?.result;
 if(!initial||!terminal||!VALID_STATUS.has(terminal.status))throw new Error('Antigravity CLI không trả kết quả thành công.');
 if(initial.init?.permission_mode==='always-proceed')throw new Error('Antigravity đang bật tự động phê duyệt công cụ. Đã chặn phản hồi.');
 const allowed=new Set(['user_input','agent_response','checkpoint','reasoning']);
 if(events.some(e=>e.event==='step_update'&&(!allowed.has(e.step_update?.step_type)||e.step_update?.tool_info||e.step_update?.tool_name))||
    terminal.denied_actions?.length||terminal.tool_calls?.length||Number(terminal.tool_calls)>0)
   throw Object.assign(new Error('Antigravity yêu cầu hoặc thực hiện công cụ. Chế độ trả lời văn bản của AI Project OS đã chặn kết quả.'),{code:'PROVIDER_TEXT_ONLY'});
 const j=terminal;
 if(typeof j.response!=='string'||!j.response.trim()||j.response.length>240000)throw new Error('Antigravity không trả nội dung văn bản hợp lệ.');
 requireVault();if(getConnection(connection.id).credentialVersion!==current.credentialVersion)throw new Error('Tài khoản đã thay đổi trong khi xử lý.');
 recordUsage(connection,{usage:j.usage||{}},crypto.randomUUID());
 return j.response.trim();
}
export async function verifyAntigravityModel(id,model,deps={}){
 const c=currentAccount(id);
 if(typeof model!=='string'||!SAFE_NAME.test(model)||!modelAvailability(id).catalogModels?.includes(model))throw new Error('Hãy chọn model từ danh sách Antigravity đã tải.');
 const answer=await askAntigravityAccount({...c,model},{prompt:'Respond with OK only. Do not run tools or access files.'},deps);
 if(!answer)throw new Error('Model chưa phản hồi.');
 const fresh=currentAccount(id);recordAccountModel(fresh,model);
 saveConnection({...fresh,meta:{...fresh.meta,verifiedAt:new Date().toISOString()}});
 return {ok:true,model,message:'Model Antigravity đã phản hồi thật và sẵn sàng phân vai.'};
}
export function removeAntigravityAccount(id){
 const c=currentAccount(id);invalidateModels(id);
 // Delete isolation (v0.9.56): only THIS connection's affordances are
 // touched — its model registry entry above, and (below) its own session
 // folder. If the removed connection is the one adopting the LEGACY
 // folder while siblings remain, park the legacy folder under the
 // removed account's own per-id slot (renamed, never deleted): the next
 // account in creation order would otherwise resolve to the legacy
 // folder and silently inherit this account's Google session.
 try{
  const siblings=listConnections().filter(x=>x.kind===KIND&&x.id!==id);
  if(siblings.length&&antigravityProfileDir(id)===LEGACY_PROFILE&&fs.existsSync(LEGACY_PROFILE)){
   const parked=path.join(ACCOUNTS_DIR,String(id));
   if(!fs.existsSync(parked)){fs.mkdirSync(ACCOUNTS_DIR,{recursive:true,mode:0o700});fs.renameSync(LEGACY_PROFILE,parked);}
  }
 }catch{/* parking is best-effort hygiene; the vault removal stands */}
 return {ok:true,message:`Đã xóa kết nối “${c.name}” trong Vault. Phiên Google của riêng tài khoản này vẫn nằm trong hồ sơ của nó trên máy — mở Antigravity bằng hồ sơ đó và gõ /logout nếu muốn hủy hẳn. Các tài khoản Antigravity khác không bị ảnh hưởng.`};
}
let installing=false;
export async function installAntigravityWindows({platform=process.platform,invoke=run,resolve=antigravityLauncher}={}){
 if(platform!=='win32')throw new Error('Nút cài tự động chỉ dành cho Windows. Vui lòng xem trang hướng dẫn của Google.');
 if(installing)throw new Error('Đang có một lượt cài Antigravity. Vui lòng chờ.');
 try{resolve();return {ok:true,installed:true,message:'Antigravity đã được cài. Bấm Mở đăng nhập Google.'};}catch{}
 installing=true;
 try{
  // WinGet validates the publisher's installer hash. No remote script eval,
  // shell execution, guessed installer URL, elevation or browser credential scraping.
  let r;try{r=await invoke('winget.exe',['install','--id','Google.AntigravityCLI','--exact','--source','winget','--silent','--accept-package-agreements','--accept-source-agreements'],{inheritEnv:false,timeoutMs:240000});}
  catch{throw new Error('Máy chưa có Windows Package Manager (winget). Hãy cài từ liên kết Google chính thức ở bên dưới.');}
  if(r.timedOut||r.code!==0)throw new Error('Windows không hoàn tất cài Antigravity. Kiểm tra Internet, chính sách máy và thử từ trang Google chính thức.');
  try{resolve();return {ok:true,installed:true,message:'Cài đặt thành công. Bấm Mở đăng nhập Google.'};}
  catch{return {ok:true,installed:false,message:'WinGet đã hoàn tất, nhưng ứng dụng chưa thấy lệnh Antigravity. Đóng và mở lại AI Project OS rồi kiểm tra.'};}
 }finally{installing=false;}
}
export async function openAntigravityLogin({id,platform=process.platform,launch=run}={}){
 const resolved=antigravityLauncher();
 if(platform!=='win32')throw new Error('Hãy mở ứng dụng Antigravity CLI chính thức và đăng nhập Google.');
 // Per-connection login (v0.9.56): when a connection id is given, the
 // login window runs with THAT connection's profile folder as HOME, so
 // the Google session lands in its own folder — the window title names
 // the account so the owner always knows which one they are signing in.
 const c=id?currentAccount(id):null;
 const script=path.join(ROOT,'LAUNCH-ANTIGRAVITY-WINDOWS.ps1');
 // Pass the path THIS resolver just found to the login window: the .cmd's own
 // shorter search misses installs the resolver knows (e.g. WinGet package
 // payloads), which made the window claim "not installed" on machines where
 // the CLI is present and detected.
 const env={AIOS_AGY_EXE:resolved.command};
 if(c){env.AIOS_AGY_PROFILE=antigravityProfileDir(c.id);env.AIOS_AGY_ACCOUNT=c.name;}
 const r=await launch('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{inheritEnv:false,timeoutMs:12000,env});
 if(r.code!==0||r.timedOut)throw new Error('Không mở được cửa sổ đăng nhập. Hãy chạy LOGIN-ANTIGRAVITY-WINDOWS.cmd trong thư mục ứng dụng.');
 return {ok:true,message:c?`Đã mở cửa sổ Antigravity cho tài khoản “${c.name}”. Hoàn tất đăng nhập Google trong cửa sổ đó (phiên nằm trong hồ sơ riêng của tài khoản này), trở lại bấm Tải model.`:'Đã yêu cầu mở Antigravity. Hoàn tất đăng nhập Google, trở lại bấm Tải model.'};
}
