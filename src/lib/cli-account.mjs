// Subscription-backed Claude Code / Gemini CLI adapters. No web passwords or
// cookies are ever accepted by AI Project OS. Only a successful, real, tool-free
// model response can make an account model selectable in the project.
import path from 'node:path';
import fs from 'node:fs';
import { run } from './shell.mjs';
import { resolveCli, cliRuntime } from './managed-cli.mjs';
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
 // Each CLI provider has one isolated login profile per Windows user.
 // A second alias would share credentials and silently misidentify the account.
 if((listConnections()).some(c=>c.kind===MAP[kind]))throw new Error('Mỗi provider CLI hiện hỗ trợ một tài khoản trên máy. Dùng kết nối API key để thêm tài khoản khác.');
 const c=saveConnection({kind:MAP[kind],name:String(name||nameOf[kind]).slice(0,80),meta:{authMode:'cli-account'}});
 return {id:c.id,kind,loginScript:kind==='claude'?'LOGIN-CLAUDE-WINDOWS.cmd':'LOGIN-GEMINI-WINDOWS.cmd',message:'Cài CLI, mở cửa sổ đăng nhập chính thức; sau đó nhập model và bấm Xác minh model.'};
}
export function cliAccountStatus(id){
 assertVault();const c=getConnection(id),kind=account(c),availability=modelAvailability(id);
 let ready=false;try{resolveCli(kind);ready=true;}catch{}
 return {kind,installed:ready,availability,verifiedModels:availability.models||[],message:ready?'Chỉ model đã phản hồi thực sự mới có thể phân vai.':'Chưa cài CLI. Bấm Cài công cụ AI.'};
}
export function removeCliAccount(id){assertVault();const c=getConnection(id);account(c);invalidateModels(id);return {ok:true};}
export function cliInferencePlan(c,{system='',prompt=''}={}){
 const kind=account(c);
 if(typeof c.model!=='string'||!c.model.trim()||c.model.length>120||/[\x00-\x1f]/.test(c.model))throw new Error('Model CLI không hợp lệ.');
 const whole=(String(system||'')+'\n\nUSER:\n'+String(prompt||'')).trim();
 if(!whole||whole.length>120000)throw new Error('Prompt CLI quá dài hoặc trống.');
 const {cwd,env}=cliRuntime(kind);
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
export async function askCliAccount(c,{system='',prompt=''}={},deps={}){
 assertVault();const old=getConnection(c.id),kind=account(old);
 if(old.credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi.');
 const plan=cliInferencePlan(c,{system,prompt}),launcher=(deps.resolve||resolveCli)(kind);
 // CLI is a subprocess, not a tool executor. Output/diagnostics are private;
 // error text is generic to avoid exposing OAuth tokens or profile contents.
 const result=await (deps.invoke||run)(launcher.command,[...launcher.args,...plan.args],{cwd:plan.cwd,env:plan.env,inheritEnv:false,timeoutMs:90000});
 if(result.code!==0||result.timedOut)throw new Error('CLI chưa đăng nhập, model không khả dụng hoặc yêu cầu đã quá hạn. Mở cửa sổ đăng nhập chính thức rồi thử lại.');
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
export async function startCliLoginWindow(kind,{platform=process.platform,exec=run}={}){
 kind=validateKind(kind);
 if(platform!=='win32')throw new Error('Trên Windows dùng nút Mở đăng nhập; trên máy khác chạy CLI chính thức trong Terminal.');
 resolveCli(kind); // Fail immediately if CLI is not installed; never claim a login window opened.
 // This is a fixed PS1 from our release, not untrusted text from the browser.
 const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../LAUNCH-AI-LOGIN-WINDOWS.ps1');
 const r=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script,'-Kind',kind],{timeoutMs:15000,inheritEnv:false});
 if(r.code!==0)throw new Error('Không mở được cửa sổ đăng nhập. Hãy chạy LOGIN-CLAUDE-WINDOWS.cmd hoặc LOGIN-GEMINI-WINDOWS.cmd trong thư mục ứng dụng.');
 return {ok:true,message:'Cửa sổ đăng nhập chính thức đã được mở. Hoàn tất đăng nhập rồi xác minh model.'};
}
