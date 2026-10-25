import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DATA_DIR, atomicWriteText } from './store.mjs';
import { resolveCli } from './managed-cli.mjs';
import { getConnection, saveConnection, vaultStatus, onVaultLock } from './vault.mjs';
import { invalidateModels, recordAccountCatalog, recordAccountModel, modelAvailability, catalogModelsFor } from './model-bindings.mjs';
import { describeCodexTurnFailure, chooseCodexText } from './codex-turn-diagnostics.mjs';
const VALIDATED_VERSIONS=new Set(['0.159.2','0.162.1']);
export const ACCOUNT_INFERENCE_UNAVAILABLE='ChatGPT: chưa xác minh môi trường chạy chỉ-văn-bản an toàn. Chưa thể dùng tài khoản cho Chatbox/Worker; dùng API key trong thời gian này.';
export const ACCOUNT_INSTALL={command:'npm install -g @openai/codex@0.162.1',url:'https://developers.openai.com/codex/cli',message:'Chưa tìm thấy Codex CLI trên máy đang chạy AI Project OS. Cài Codex CLI rồi thử lại.'};
const ROOT=path.join(DATA_DIR,'account-profiles'), sessions=new Map();
const REASONING_EFFORTS=['minimal','low','medium','high','xhigh','max'];
// The user's per-account reasoning-effort choice (Connections tab). Codex
// documents it as the `model_reasoning_effort` config key; thread/start
// accepts a config object (already used here for features.image_generation).
export function accountReasoningEffort(c){const v=c?.meta?.reasoningEffort;return REASONING_EFFORTS.includes(v)?v:null;}
export function accountThreadConfig(c,extra={}){const effort=accountReasoningEffort(c);const config={...extra,...(effort?{model_reasoning_effort:effort}:{})};return Object.keys(config).length?config:undefined;}
let generation=0;
const safeString=(v,max=180)=>typeof v==='string'?v.slice(0,max):null;
function assertOpen(){if(!vaultStatus().unlocked)throw new Error('Vault đang khóa.');}
function profile(id){if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error('ID tài khoản không hợp lệ.');const dir=path.join(ROOT,id);for(const p of [ROOT,dir,path.join(dir,'empty')]){fs.mkdirSync(p,{recursive:true,mode:0o700});fs.chmodSync(p,0o700);}return dir;}
export function codexLauncher(env=process.env,platform=process.platform){
 try {const {command,args}=resolveCli('codex',{env,platform});return {command,args};}
 catch {throw new Error(ACCOUNT_INSTALL.message+' Hoặc dùng nút Cài Codex trên giao diện.');}
}
export class AccountRpc {
  constructor({command,args=[],cwd,env,timeoutMs=20000,onNotification=()=>{}}){
    this.listeners=new Set();this.imageThreads=new Set();this.next=1;this.pending=new Map();this.closed=false;this.buffer='';this.onNotification=onNotification;this.timeoutMs=timeoutMs;
    this.child=spawn(command,args,{cwd,env,stdio:['pipe','pipe','pipe'],windowsHide:true,shell:false});
    this.child.stdin.on('error',()=>this.close('Codex input đã đóng.'));
    this.child.on('error',()=>this.close('Không khởi động được Codex CLI.'));
    this.child.on('exit',()=>this.close('Codex CLI đã dừng.'));
    this.child.stderr.on('data',()=>{}); // Never return raw CLI diagnostics/auth data.
    this.child.stdout.setEncoding('utf8'); // Preserve code points split across pipe chunks.
    this.child.stdout.on('data',chunk=>{
      this.buffer+=chunk;let at;
      while((at=this.buffer.indexOf('\n'))>=0){
        const line=this.buffer.slice(0,at);this.buffer=this.buffer.slice(at+1);if(!line.trim())continue;
        const bytes=Buffer.byteLength(line);if(bytes>48*1024*1024)return this.close('Codex image payload vượt giới hạn.');
        let msg;try{msg=JSON.parse(line);}catch{return this.close('Codex RPC không hợp lệ.');}
        const p=msg.params||{},imageEvent=this.imageThreads.has(p.threadId)&&((msg.method==='item/completed'&&p.item?.type==='imageGeneration')||(msg.method==='turn/completed'&&p.turn?.items?.some(i=>i.type==='imageGeneration')));
        if(bytes>2_000_000&&!imageEvent)return this.close('Codex RPC vượt giới hạn cho nội dung không phải ảnh.');
        if(msg.method){
          if(msg.id!==undefined){this.write({id:msg.id,error:{code:-32601,message:'Client does not allow tools or approvals'}});continue;}
          try{this.onNotification(msg.method,p);for(const fn of this.listeners)fn(msg.method,p);}catch{return this.close('Codex notification không hợp lệ.');}
          continue;
        }
        const pending=this.pending.get(msg.id);if(pending){this.pending.delete(msg.id);clearTimeout(pending.timer);
          if(msg.error){const e=Object.assign(new Error(msg.error.code===-32601?'Codex CLI chưa hỗ trợ thao tác yêu cầu.':msg.error.code===-32602?'Codex CLI từ chối tham số giao thức.':'Codex không hỗ trợ thao tác hoặc phiên tài khoản chưa sẵn sàng.'),{code:msg.error.code===-32601?'CODEX_RPC_METHOD':msg.error.code===-32602?'CODEX_RPC_PARAMS':'CODEX_RPC_FAILED',rpcCode:msg.error.code});pending.reject(e);}else pending.resolve(msg.result);
        }
      }
      if(Buffer.byteLength(this.buffer)>(this.imageThreads.size?48*1024*1024:2_000_000))this.close('Codex RPC vượt giới hạn.');
    });
  }
  write(message){if(this.closed)throw new Error('Codex session đã đóng.');this.child.stdin.write(JSON.stringify(message)+'\n');}
  request(method,params={}){if(this.closed)return Promise.reject(new Error('Codex session đã đóng.'));if(this.pending.size>=16)return Promise.reject(new Error('Codex đang bận.'));const id=this.next++;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex RPC hết thời gian.'));this.close();},this.timeoutMs);this.pending.set(id,{resolve,reject,timer});try{this.write({id,method,params})}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e)}});}
  close(reason='Codex session đã đóng.'){if(this.closed)return;this.closed=true;for(const fn of this.listeners)fn('client/closed',{reason});this.listeners.clear();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(reason));}this.pending.clear();this.child.stdin.destroy();this.child.kill();const timer=setTimeout(()=>{try{this.child.kill('SIGKILL')}catch{}},1000);timer.unref();}
}
export function closeAccountSessions(){generation++;for(const s of sessions.values()){clearTimeout(s.expiry);s.rpc.close();}sessions.clear();}
onVaultLock(closeAccountSessions);
function accountConnection(id){assertOpen();const c=getConnection(id);if(c.kind!=='chatgpt_account')throw new Error('Đây không phải tài khoản ChatGPT.');return c;}
async function session(id){
  accountConnection(id);let s=sessions.get(id);if(s&&!s.rpc.closed)return s.ready;
  const version=generation,dir=profile(id),launcher=codexLauncher();
  const env={PATH:process.env.PATH||process.env.Path||'',HOME:dir,USERPROFILE:dir,CODEX_HOME:dir};
  for(const k of ['SystemRoot','WINDIR','TEMP','TMP','LANG'])if(process.env[k])env[k]=process.env[k];
  atomicWriteText(path.join(dir,'config.toml'),`web_search = "disabled"\nproject_doc_max_bytes = 0\ncli_auth_credentials_store = "file"\n[features]\nshell_tool = false\nunified_exec = false\napps = false\nhooks = false\nmulti_agent = false\nshell_snapshot = false\n[tools]\nview_image = false\n`,{backup:false});
  s={cwd:path.join(dir,'empty'),state:'disconnected',loginId:null,account:null,error:null};
  s.rpc=new AccountRpc({...launcher,args:[...launcher.args,'app-server',...['web_search="disabled"','project_doc_max_bytes=0','cli_auth_credentials_store="file"','features.shell_tool=false','features.unified_exec=false','features.apps=false','features.hooks=false','features.multi_agent=false','features.shell_snapshot=false','tools.view_image=false','model_provider="openai"'].flatMap(x=>['-c',x])],cwd:path.join(dir,'empty'),env,onNotification:(method,p)=>{if(method==='account/login/completed'&&p.loginId===s.loginId){s.state=p.success?'checking':'error';s.error=p.success?null:'Đăng nhập chưa hoàn tất. Thử lại.';if(p.success)void refreshAccount(id).catch(()=>{});}if(method==='account/updated'&&s.state==='connected')s.state='checking';}});
  sessions.set(id,s);
  s.ready=(async()=>{try{const init=await s.rpc.request('initialize',{clientInfo:{name:'ai_project_os',title:'AI Project OS',version:'0.9.41'},capabilities:{experimentalApi:true}});s.version=init?.userAgent?.match(/\/(\d+\.\d+\.\d+)/)?.[1]||'';s.rpc.write({method:'initialized'});if(version!==generation)throw new Error('Vault session đã thay đổi.');return s;}catch(e){s.rpc.close();if(sessions.get(id)===s)sessions.delete(id);throw e;}})();return s.ready;
}
function snapshot(s){return {state:s.state,account:s.account,error:s.error,inference:{available:VALIDATED_VERSIONS.has(s.version),reason:VALIDATED_VERSIONS.has(s.version)?'Chọn model trong danh mục của tài khoản để phân vai — không cần xác minh trước.':ACCOUNT_INFERENCE_UNAVAILABLE+' Phiên bản Codex được kiểm chứng: '+[...VALIDATED_VERSIONS].join(', ')}};}
function officialUrl(value){try{const u=new URL(value);if(u.protocol==='https:'&&['chatgpt.com','auth.openai.com','auth0.openai.com'].includes(u.hostname)&&!u.username&&!u.password)return u.href;}catch{}throw new Error('Codex không trả URL đăng nhập OpenAI hợp lệ.');}
export async function startAccountLogin({id,name,type='chatgpt'}={}){
  assertOpen();if(!['chatgpt','chatgptDeviceCode'].includes(type))throw new Error('Kiểu đăng nhập không hợp lệ.');
  // Probe first: missing dependency must not create a fake connected account.
  codexLauncher();const c=id?accountConnection(id):saveConnection({kind:'chatgpt_account',name:name||'ChatGPT account',meta:{authMode:'codex'}});
  const s=await session(c.id);if(s.loginId)await s.rpc.request('account/login/cancel',{loginId:s.loginId});
  const result=await s.rpc.request('account/login/start',{type});assertOpen();
  if(!result?.loginId)throw new Error('Codex chưa tạo phiên đăng nhập.');s.loginId=result.loginId;s.state='pending';s.error=null;
  clearTimeout(s.expiry);s.expiry=setTimeout(()=>{s.rpc.close();s.state='expired';},10*60*1000);s.expiry.unref();
  return {id:c.id,...snapshot(s),login:type==='chatgpt'?{authUrl:officialUrl(result.authUrl)}:{verificationUrl:officialUrl(result.verificationUrl),userCode:safeString(result.userCode,80)}};
}
export async function refreshAccount(id){
  const c=accountConnection(id),s=await session(id),version=generation;
  const result=await s.rpc.request('account/read',{refreshToken:false});assertOpen();if(version!==generation)throw new Error('Vault session đã thay đổi.');
  const a=result?.account;s.account=a?.type==='chatgpt'?{type:'chatgpt',email:safeString(a.email),planType:safeString(a.planType,60)}:null;
  s.state=s.account?'connected':s.state==='pending'?'pending':'disconnected';
  const identity=s.account?.email||null;
  if(s.account&&!identity){s.state='unavailable';s.error='Tài khoản không trả định danh ổn định; chưa thể phân vai an toàn.';}
  if(identity!==c.meta?.accountIdentity){invalidateModels(id);saveConnection({...c,meta:{authMode:'codex',accountIdentity:identity,planType:s.account?.planType||null}});}
  if(s.account){clearTimeout(s.expiry);s.loginId=null;}
  // Một lượt đăng nhập trơn (v0.9.55): ngay khi phiên chuyển sang
  // connected mà danh mục model còn thiếu hoặc đã cũ, tự làm mới danh
  // mục ở nền — người dùng không phải bấm "Tải model" nữa. Danh mục cũ
  // vẫn chọn được trong lúc chờ (badge "danh mục cũ"), không chặn gì.
  if(s.state==='connected'){const {entry,stale}=catalogModelsFor(id);if(!entry||stale)refreshAccountCatalogInBackground(id);}
  return snapshot(s);
}
const catalogRefreshInFlight=new Set();
/** Fire-and-forget catalog refresh; single-flight per account, errors
 * swallowed (a failed refresh leaves the last-known catalog in place). */
export function refreshAccountCatalogInBackground(id){
  if(catalogRefreshInFlight.has(id))return false;
  catalogRefreshInFlight.add(id);
  void listAccountModels(id).catch(()=>{}).finally(()=>catalogRefreshInFlight.delete(id));
  return true;
}
export async function cancelAccountLogin(id){const s=await session(id);if(s.loginId)await s.rpc.request('account/login/cancel',{loginId:s.loginId});s.loginId=null;s.state='disconnected';clearTimeout(s.expiry);s.rpc.close();return {ok:true};}
export async function logoutAccount(id){const c=accountConnection(id),s=await session(id);try{await s.rpc.request('account/logout',{});assertOpen();saveConnection({...c,meta:{authMode:'codex',accountIdentity:null,planType:null}});invalidateModels(id);return {ok:true};}finally{clearTimeout(s.expiry);s.rpc.close();sessions.delete(id);if(s.rpc.child.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(resolve,1500);s.rpc.child.once('exit',()=>{clearTimeout(timer);resolve()})});}}
export function accountAvailability(id){accountConnection(id);return modelAvailability(id);}
export function normalizeRateLimits(result){
  const window=w=>w&&typeof w.usedPercent==='number'&&Number.isFinite(w.usedPercent)&&w.usedPercent>=0&&w.usedPercent<=100?{usedPercent:w.usedPercent,windowDurationMins:Number.isFinite(w.windowDurationMins)&&w.windowDurationMins>0?w.windowDurationMins:null,resetsAt:Number.isFinite(w.resetsAt)&&w.resetsAt>0?w.resetsAt:null}:null;
  const limit=x=>({primary:window(x?.primary),secondary:window(x?.secondary)});
  return {rateLimits:result?.rateLimits?limit(result.rateLimits):null,rateLimitsByLimitId:result?.rateLimitsByLimitId&&typeof result.rateLimitsByLimitId==='object'?Object.fromEntries(Object.entries(result.rateLimitsByLimitId).slice(0,50).map(([k,v])=>[k.slice(0,120),limit(v)])):null};
}
export async function readAccountUsage(id){
  const state=await refreshAccount(id);if(state.state!=='connected')return {...state,rateLimits:null,lifetimeTokens:null,updatedAt:null};
  // Subscription quota is independent of model verification. Do not wait
  // for undocumented account/usage/read RPC before displaying the windows.
  const s=await session(id),result=await s.rpc.request('account/rateLimits/read',{});
  assertOpen();return {...state,...normalizeRateLimits(result),lifetimeTokens:null,updatedAt:new Date().toISOString()};
}
export async function listAccountModels(id){
 const state=await refreshAccount(id);if(state.state!=='connected')throw new Error('Đăng nhập ChatGPT trước.');
 const s=await session(id),models=[],seen=new Set();let cursor=null;
 for(let page=0;page<20;page++){const r=await s.rpc.request('model/list',{cursor,limit:100});if(!Array.isArray(r?.data))throw new Error('Codex không trả danh mục model.');for(const m of r.data){const name=m.model||m.id;if(typeof name==='string'&&name.length<=120)models.push(name);}cursor=r.nextCursor;if(!cursor){recordAccountCatalog(getConnection(id),models);return models;}if(seen.has(cursor))throw new Error('Codex model pagination không hợp lệ.');seen.add(cursor);}
 throw new Error('Danh mục model quá lớn.');
}
export async function askAccount(c,{system='',prompt='',timeoutMs=90000}){
 const state=await refreshAccount(c.id),s=await session(c.id);
 if(state.state!=='connected')throw new Error('Tài khoản ChatGPT chưa đăng nhập.');
 if(getConnection(c.id).credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi. Hãy phân vai lại.');
 if(!VALIDATED_VERSIONS.has(s.version))throw new Error(snapshot(s).inference.reason);
 const effective=await s.rpc.request('config/read',{includeLayers:false,cwd:s.cwd});
 if(!effective?.config||Object.keys(effective.config.mcp_servers||effective.config.mcpServers||{}).length){s.rpc.close();throw new Error('Codex có cấu hình MCP hoặc không xác minh được cấu hình. Đã chặn inference để bảo vệ ranh giới chỉ-văn-bản.');}
 const threadConfig=accountThreadConfig(c);
 const t=await s.rpc.request('thread/start',{model:c.model,ephemeral:true,allowProviderModelFallback:false,approvalPolicy:'never',sandbox:'read-only',environments:[],dynamicTools:[],...(threadConfig?{config:threadConfig}:{}),baseInstructions:system+'\nReturn text only. Do not invoke any built-in tools. The host executes its own authorized workflow.',cwd:s.cwd});
 const empty=a=>Array.isArray(a)&&a.length===0;
 if(!t?.thread?.id||t.model!==c.model||t.modelProvider!=='openai'||!empty(t.thread.environments)||!empty(t.runtimeWorkspaceRoots)||!empty(t.instructionSources)||t.approvalPolicy!=='never'||t.sandbox?.type!=='readOnly'||!VALIDATED_VERSIONS.has(t.thread.cliVersion)){s.rpc.close();throw new Error('Codex chưa xác nhận môi trường không truy cập máy. Đã chặn inference.');}
 const threadId=t.thread.id;let turnId=null,usage=null,done=false,timer,resolve,reject;
 let terminalError=null;
 const completedMessages=[];
 const completed=new Promise((yes,no)=>{resolve=yes;reject=no});completed.catch(()=>{});
 const listener=(method,p)=>{
  if(method==='client/closed'){if(!done){done=true;reject(new Error('Phiên Codex đã đóng.'));}return;}
  if(p.threadId!==threadId)return;
  if(method==='thread/tokenUsage/updated')usage=p.tokenUsage?.total||null;
  if(method==='item/started'&&['commandExecution','fileChange','mcpToolCall','dynamicToolCall','webSearch','imageView'].includes(p.item?.type)){s.rpc.close('Codex attempted a prohibited tool');return;}
  // Current app-server builds may send final agent messages only through
  // item/completed; turn.items can be empty or itemsView=notLoaded.
  if(method==='item/completed'&&p.item?.type==='agentMessage'&&typeof p.item.text==='string')completedMessages.push(p.item);
  if(method==='error'&&p.willRetry!==true)terminalError=p.error||{message:'Codex provider error'};
  if(method==='turn/completed'&&!done){
   done=true;turnId=p.turn?.id||turnId;
   if(p.turn?.status!=='completed'||terminalError){reject(describeCodexTurnFailure(p.turn?.error,terminalError,p.turn?.status));return;}
   const text=chooseCodexText(p.turn?.items,completedMessages);
   if(!text){reject(new Error('Codex không trả nội dung văn bản để xác minh model. Hãy chọn model khác hoặc thử lại sau.'));return;}
   resolve({text,usage,eventId:threadId+':'+turnId});
  }
 };
 s.rpc.listeners.add(listener);
 timer=setTimeout(()=>{if(!done){done=true;reject(new Error('Codex inference hết thời gian.'));if(turnId)void s.rpc.request('turn/interrupt',{threadId,turnId}).catch(()=>{});s.rpc.close();}},Math.max(20,Math.min(90000,timeoutMs)));
 try{const r=await s.rpc.request('turn/start',{threadId,input:[{type:'text',text:prompt}],environments:[]});turnId=r?.turn?.id;const result=await completed;const {recordUsage}=await import('./usage.mjs');recordUsage(c,{usage:result.usage},result.eventId);assertOpen();if(getConnection(c.id).credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi trong khi chạy.');return result;}
 finally{clearTimeout(timer);s.rpc.listeners.delete(listener);void s.rpc.request('thread/unsubscribe',{threadId}).catch(()=>{});}
}
/** Provider bounds are verified through the CLI protocol, not inferred from text login. */
export async function accountImageCapability(c,{refresh=false}={}){
 const state=await refreshAccount(c.id),s=await session(c.id);
 if(state.state!=='connected')throw Object.assign(new Error('Tài khoản ChatGPT chưa đăng nhập.'),{code:'CODEX_AUTH_EXPIRED'});
 if(getConnection(c.id).credentialVersion!==c.credentialVersion)throw Object.assign(new Error('Tài khoản đã thay đổi.'),{code:'IMAGE_IDENTITY_CHANGED',retryable:false});
 if(!VALIDATED_VERSIONS.has(s.version))throw Object.assign(new Error('Phiên bản Codex chưa được kiểm chứng cho tạo ảnh.'),{code:'IMAGE_CLI_VERSION',retryable:false});
 if(!refresh&&s.imageCapability&&Date.now()-s.imageCapability.at<600000)return s.imageCapability.value;
 const caps=await s.rpc.request('modelProvider/capabilities/read',{});const value={available:caps?.imageGeneration===true,reason:caps?.imageGeneration===true?null:'Tài khoản này chưa cung cấp công cụ tạo ảnh qua Codex.',code:caps?.imageGeneration===true?null:'IMAGE_CAPABILITY'};
 s.imageCapability={at:Date.now(),value};return value;
}
export async function generateAccountImage(c,{prompt='',outputPath=''}={}){
 const state=await refreshAccount(c.id),s=await session(c.id);
 if(state.state!=='connected')throw new Error('Tài khoản ChatGPT chưa đăng nhập.');
 if(getConnection(c.id).credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi. Hãy phân vai lại.');
 if(!VALIDATED_VERSIONS.has(s.version))throw new Error(snapshot(s).inference.reason);
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000)throw new Error('Mô tả ảnh cần 1-4.000 ký tự.');
 if(typeof outputPath!=='string'||!outputPath)throw new Error('Thiếu đường dẫn tệp ảnh đầu ra.');
 const caps=await accountImageCapability(c);
 if(!caps.available){const e=new Error('Tài khoản/nhà cung cấp này không báo hỗ trợ sinh ảnh qua Codex. Không giả lập ảnh.');e.code='BLOCKED_PROVIDER';throw e;}
 const effective=await s.rpc.request('config/read',{includeLayers:false,cwd:s.cwd});
 if(!effective?.config||Object.keys(effective.config.mcp_servers||effective.config.mcpServers||{}).length){s.rpc.close();throw Object.assign(new Error('Image account security boundary could not be verified.'),{code:'IMAGE_SECURITY',retryable:false});}
 const t=await s.rpc.request('thread/start',{model:c.model,ephemeral:true,allowProviderModelFallback:false,approvalPolicy:'never',sandbox:'workspace-write',environments:[],dynamicTools:[],config:accountThreadConfig(c,{features:{image_generation:true}}),baseInstructions:'Use only the built-in image generation tool to create the requested image. Do not run commands, do not edit files, do not browse the web. Return the generated image only.',cwd:s.cwd});
 if(!t?.thread?.id||!VALIDATED_VERSIONS.has(t.thread.cliVersion)){s.rpc.close();throw Object.assign(new Error('Image account security boundary could not be verified.'),{code:'IMAGE_SECURITY',retryable:false});}
 const threadId=t.thread.id;s.rpc.imageThreads.add(threadId);let turnId=null,usage=null,done=false,timer,resolve,reject,terminalError=null,imageItem=null;
 const completed=new Promise((yes,no)=>{resolve=yes;reject=no});completed.catch(()=>{});
 const listener=(method,p)=>{
  if(method==='client/closed'){if(!done){done=true;reject(Object.assign(new Error(p.reason||'Phiên Codex đã đóng.'),{code:/vượt giới hạn/i.test(p.reason||'')?'CODEX_IMAGE_PAYLOAD':'CODEX_SESSION_CLOSED'}));}return;}
  if(p.threadId!==threadId)return;
  if(method==='thread/tokenUsage/updated')usage=p.tokenUsage?.total||null;
  if(method==='item/started'&&['commandExecution','fileChange','mcpToolCall','dynamicToolCall','webSearch','imageView'].includes(p.item?.type)){done=true;reject(Object.assign(new Error('Image account attempted a prohibited tool.'),{code:'IMAGE_SECURITY',retryable:false}));s.rpc.close('Codex attempted a prohibited tool during image generation');return;}
  if(method==='item/completed'&&p.item?.type==='imageGeneration')imageItem=p.item;
  if(method==='error'&&p.willRetry!==true)terminalError=p.error||{message:'Codex provider error'};
  if(method==='turn/completed'&&!done){
   done=true;turnId=p.turn?.id||turnId;
   if(/safety|policy|moderation|contentFilter|refusal/i.test(JSON.stringify([p.turn?.error?.codexErrorInfo,terminalError?.codexErrorInfo,imageItem?.failure?.type]))){reject(Object.assign(new Error('Nhà cung cấp từ chối ảnh theo chính sách.'),{code:'IMAGE_POLICY',retryable:false}));return;}
   if(p.turn?.status!=='completed'||terminalError){reject(describeCodexTurnFailure(p.turn?.error,terminalError,p.turn?.status));return;}
   imageItem=imageItem||(p.turn?.items||[]).find(i=>i.type==='imageGeneration');
   if(!imageItem){reject(Object.assign(new Error('Codex hoàn thành lượt nhưng không trả ảnh nào.'),{code:'IMAGE_EMPTY'}));return;}
   if(imageItem.failure&&/safety|policy|moderation|contentFilter|refus/i.test(String(imageItem.failure.type||''))){reject(Object.assign(new Error('Image safety refusal; do not retry through another provider.'),{code:'IMAGE_POLICY',retryable:false}));return;}
   if(imageItem.failure){const e=new Error(imageItem.failure.type==='usageLimitExceeded'?'Tài khoản ChatGPT đã hết hạn mức sinh ảnh của gói. Đợi hạn mức hồi phục hoặc đổi nhà cung cấp ảnh.':'Codex báo sinh ảnh thất bại.');e.code=imageItem.failure.type==='usageLimitExceeded'?'PROVIDER_QUOTA':'BLOCKED_PROVIDER';reject(e);return;}
   resolve({imageItem,usage,eventId:threadId+':'+turnId});
  }
 };
 s.rpc.listeners.add(listener);
 timer=setTimeout(()=>{if(!done){done=true;reject(new Error('Sinh ảnh bằng tài khoản ChatGPT hết thời gian (5 phút).'));if(turnId)void s.rpc.request('turn/interrupt',{threadId,turnId}).catch(()=>{});s.rpc.close();}},300000);
 try{
  const r=await s.rpc.request('turn/start',{threadId,input:[{type:'text',text:'Generate an image from this description: '+prompt}],environments:[]});turnId=r?.turn?.id;
  const result=await completed;
  let bytes=null;
  const raw=typeof result.imageItem.result==='string'?result.imageItem.result.trim():'';
  if(raw){const b64=raw.startsWith('data:')?raw.slice(raw.indexOf(',')+1):raw;try{const buf=Buffer.from(b64,'base64');if(buf.length>1000&&buf.length<=24*1024*1024)bytes=buf;}catch{}}
  if(!bytes&&typeof result.imageItem.savedPath==='string'&&result.imageItem.savedPath){const target=path.resolve(s.cwd,result.imageItem.savedPath),allowed=fs.realpathSync(s.cwd);if(!target.startsWith(allowed+path.sep))throw Object.assign(new Error('Generated image escaped the account workspace.'),{code:'IMAGE_SECURITY',retryable:false});const actual=fs.realpathSync(target);if(!actual.startsWith(allowed+path.sep))throw Object.assign(new Error('Generated image escaped the account workspace.'),{code:'IMAGE_SECURITY',retryable:false});bytes=fs.readFileSync(actual);}
  if(!bytes||bytes.length<=1000)throw new Error('Codex trả item ảnh nhưng không có dữ liệu ảnh hợp lệ. Không lưu tệp giả.');
  const ext=bytes.subarray(0,4).equals(Buffer.from([0x89,0x50,0x4e,0x47]))?'.png':bytes[0]===0xff&&bytes[1]===0xd8?'.jpg':bytes.subarray(0,4).toString('latin1')==='RIFF'&&bytes.subarray(8,12).toString('latin1')==='WEBP'?'.webp':null;
  if(!ext)throw new Error('Dữ liệu Codex trả về không phải PNG/JPEG/WebP hợp lệ.');
  const finalPath=outputPath.replace(/\.[a-z0-9]+$/i,'')+ext;
  fs.mkdirSync(path.dirname(finalPath),{recursive:true,mode:0o700});
  fs.writeFileSync(finalPath,bytes,{mode:0o600});
  const {recordUsage}=await import('./usage.mjs');if(result.usage)recordUsage(c,{usage:result.usage},result.eventId);
  assertOpen();if(getConnection(c.id).credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi trong khi chạy.');
  return {provider:'chatgpt-account',model:c.model,file:finalPath,bytes:bytes.length,revisedPrompt:typeof result.imageItem.revisedPrompt==='string'?result.imageItem.revisedPrompt:null};
 }finally{clearTimeout(timer);s.rpc.imageThreads.delete(threadId);s.rpc.listeners.delete(listener);void s.rpc.request('thread/unsubscribe',{threadId}).catch(()=>{});}
}

export async function verifyAccountModel(id,model){
 const c=accountConnection(id);const models=await listAccountModels(id);if(!models.includes(model))throw new Error('Model không có trong danh mục tài khoản.');
 const current={...getConnection(id),model};const result=await askAccount(current,{prompt:'Reply with OK only.'});
 const {recordUsage}=await import('./usage.mjs');recordUsage(current,{usage:result.usage},result.eventId);
 if(!result.text.trim())throw new Error('Model trả nội dung rỗng.');recordAccountModel(current,model);return {ok:true,message:'Model đã phản hồi bằng tài khoản này.',model};
}

export async function deleteAccountProfile(id){
 accountConnection(id);await logoutAccount(id);const dir=profile(id);fs.rmSync(dir,{recursive:true,force:true});return {ok:true};
}
