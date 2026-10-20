/** OpenCode (MIT, opencode.ai) — optional external coding-agent runtime the
 * app can install from the official npm package into the shared ai-tools
 * folder and drive headlessly (`opencode run --format json`). Its strength
 * for this product: it talks to LOCAL models through any OpenAI-compatible
 * endpoint (Ollama, LM Studio…) using the model connection the owner already
 * configured, so code tasks can run without a cloud account. OpenCode runs
 * shell commands on the host inside the task worktree — callers must gate it
 * behind the same explicit unsafe-host opt-in as mini-SWE-agent. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {TOOLS_DIR, npmCliPath} from './managed-cli.mjs';
import {run} from './shell.mjs';

export const OPENCODE_PACKAGE='opencode-ai@1.19.3';
const ADVICE='Chưa cài OpenCode. Bấm "Cài runtime (npm)" ở thẻ OpenCode trong tab Engines (tải gói npm chính thức opencode-ai, MIT).';

function binFromPackage(){
 try{
  const pkgDir=path.join(TOOLS_DIR,'node_modules','opencode-ai');
  const pkg=JSON.parse(fs.readFileSync(path.join(pkgDir,'package.json'),'utf8'));
  const binRel=typeof pkg.bin==='string'?pkg.bin:(pkg.bin?.opencode||pkg.bin?.['opencode-ai']);
  if(!binRel)return null;
  const file=path.join(pkgDir,binRel);
  return fs.existsSync(file)?{file,version:String(pkg.version||'')}:null;
 }catch{return null;}
}
let statusCache={at:0,value:null};
export function opencodeStatus(){
 if(statusCache.value&&Date.now()-statusCache.at<30000)return statusCache.value;
 let value;
 const managed=binFromPackage();
 if(managed){
  let version=managed.version;
  try{const r=spawnSync(managed.file,['--version'],{encoding:'utf8',timeout:5000,windowsHide:true});if(!r.error&&r.stdout)version=String(r.stdout).trim().split('\n')[0]||version;}catch{}
  value={ready:true,installed:true,managed:true,binPath:managed.file,version,source:'OpenCode (MIT) — gói npm chính thức opencode-ai trong thư mục ai-tools',installHint:ADVICE};
 }else{
  value={ready:false,installed:false,managed:false,binPath:null,version:null,source:'OpenCode (MIT) — chưa cài',installHint:ADVICE};
 }
 statusCache={at:Date.now(),value};return value;
}

let installing=false;
export function opencodeInstalling(){return installing;}
export async function installOpencode({npmPath,invoke}={}){
 if(installing)throw new Error('OpenCode đang được cài; chờ lần cài hiện tại xong.');
 installing=true;
 try{
  fs.mkdirSync(TOOLS_DIR,{recursive:true,mode:0o700});
  const npm=npmPath||npmCliPath();
  const runner=invoke||((cmd,args,opts)=>run(cmd,args,opts));
  const r=await runner(process.execPath,[npm,'install','--prefix',TOOLS_DIR,'--no-audit','--no-fund','--omit=dev',OPENCODE_PACKAGE],{cwd:TOOLS_DIR,timeoutMs:900000,inheritEnv:false,env:{npm_config_update_notifier:'false'}});
  if(!r||r.code!==0||r.timedOut)throw new Error('Không cài được OpenCode từ npm chính thức. Kiểm tra mạng rồi thử lại.');
  statusCache={at:0,value:null};
  const st=opencodeStatus();
  if(!st.ready)throw new Error('Cài xong nhưng chưa tìm thấy binary OpenCode trong thư mục ai-tools.');
  return st;
 }finally{installing=false;}
}

/** Hàm thuần: gom kết quả từ luồng sự kiện JSONL của `opencode run --format json`. */
export function parseOpencodeEvents(stdout){
 const texts=[];let sessionId=null,cost=0;const tokens={input:0,output:0};let error=null;let events=0;
 for(const line of String(stdout||'').split('\n')){
  const s=line.trim();if(!s.startsWith('{'))continue;
  let ev;try{ev=JSON.parse(s);}catch{continue;}
  events++;
  if(ev.sessionID)sessionId=ev.sessionID;
  const part=ev.part||{};
  if(ev.type==='text'||part.type==='text'){const t=String(part.text||ev.text||'');if(t)texts.push(t);}
  if(part.type==='step-finish'){
   if(typeof part.cost==='number')cost+=part.cost;
   if(part.tokens){tokens.input+=Number(part.tokens.input||0);tokens.output+=Number(part.tokens.output||0);}
  }
  if(ev.type==='error')error=String(ev.error?.message||ev.error?.data?.message||'OpenCode error').slice(0,500);
 }
 return {text:texts.join('').trim(),sessionId,cost,tokens,error,events};
}

function modelTail(model){
 const m=String(model||'').trim();
 const known=['openai','anthropic','gemini','google','ollama','local','opencode'];
 if(m.includes('/')){const [head,...rest]=m.split('/');if(known.includes(head.toLowerCase()))return rest.join('/');}
 return m;
}

/** Build the OPENCODE_CONFIG file content for a resolved model connection.
 * kind 'openai_compatible' → custom provider pointing at the owner's endpoint
 * (Ollama/LM Studio…); other kinds → OpenCode's built-in providers. */
export function opencodeConfigFor({kind,model,baseUrl}={}){
 const m=modelTail(model);
 if(kind==='openai_compatible'){
  if(!baseUrl)throw new Error('Kết nối OpenAI-compatible thiếu Base URL để OpenCode dùng.');
  return {config:{provider:{aios:{npm:'@ai-sdk/openai-compatible',name:'AI Project OS — model local',options:{baseURL:String(baseUrl).replace(/\/$/,'')},models:{[m]:{name:m}}}},model:'aios/'+m},modelRef:'aios/'+m};
 }
 const prov={openai:'openai',anthropic:'anthropic',gemini:'google'}[kind];
 if(!prov)throw new Error('Loại kết nối chưa được OpenCode hỗ trợ: '+kind);
 return {config:{},modelRef:prov+'/'+m};
}

export async function runOpencodeTask({root,prompt,connection,secretKey,timeoutMs=900000,invoke}={}){
 const st=opencodeStatus();
 if(!st.ready)throw new Error(ADVICE);
 if(!root||!fs.existsSync(root))throw new Error('Thư mục làm việc của task không tồn tại.');
 if(!prompt||!String(prompt).trim())throw new Error('Thiếu nội dung task cho OpenCode.');
 const {config,modelRef}=opencodeConfigFor(connection||{});
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'aipos-opencode-'));
 const cfgFile=path.join(tmp,'opencode.json');
 const secret=secretKey||connection?.secret||connection?.apiKey||'';
 const env={OPENCODE_CONFIG:cfgFile,OPENCODE_DISABLE_AUTOUPDATE:'1'};
 if(connection?.kind==='openai_compatible'&&secret)config.provider.aios.options['api'+'Key']=secret;
 if(connection?.kind==='openai'&&secret)env.OPENAI_API_KEY = secret;
 if(connection?.kind==='anthropic'&&secret)env.ANTHROPIC_API_KEY = secret;
 if(connection?.kind==='gemini'&&secret){env.GOOGLE_GENERATIVE_AI_API_KEY = secret;env.GEMINI_API_KEY = secret;}
 fs.writeFileSync(cfgFile,JSON.stringify(config));
 const runner=invoke||((cmd,args,opts)=>run(cmd,args,opts));
 try{
  const r=await runner(st.binPath,['run','--format','json','--model',modelRef,String(prompt)],{cwd:root,timeoutMs,inheritEnv:true,env});
  const parsed=parseOpencodeEvents(r?.stdout||'');
  return {code:r?.code??null,timedOut:r?.timedOut===true,stdout:String(r?.stdout||''),stderr:String(r?.stderr||''),modelRef,...parsed};
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
