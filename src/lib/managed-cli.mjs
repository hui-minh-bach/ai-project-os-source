// Official CLI tools belong to the customer's per-user application folder, never
// the extracted application tree. All commands are whitelisted and shell:false.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_DIR } from './store.mjs';
import { run } from './shell.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const TOOLS_DIR=path.join(path.dirname(DATA_DIR),'ai-tools');
export const CLI_TOOLS=Object.freeze({
 codex:{package:'@openai/codex@0.162.1',entry:'@openai/codex/bin/codex.js',url:'https://developers.openai.com/codex/cli'},
 claude:{package:'@anthropic-ai/claude-code@latest',entry:'@anthropic-ai/claude-code/cli.js',url:'https://code.claude.com/docs/en/quickstart'},
 gemini:{package:'@google/gemini-cli@latest',entry:'@google/gemini-cli/dist/index.js',url:'https://github.com/google-gemini/gemini-cli'}
});
const cleanKind=k=>{if(!Object.hasOwn(CLI_TOOLS,k))throw new Error('CLI không được hỗ trợ.');return k;};
function safePackageFile(pkg,file){
 try{
  const actual=path.resolve(pkg,file),relative=path.relative(pkg,actual);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.statSync(actual).isFile())return null;
  // Reject symbolic links leaving the official package directory.
  if(!fs.realpathSync(actual).startsWith(fs.realpathSync(pkg)+path.sep))return null;
  return actual;
 }catch{return null;}
}
// Resolve the official package's launcher as {file, native} or null.
// Publishers have moved from JavaScript launchers to native binaries
// (Claude Code 2.x declares "bin": "bin/claude.exe" and ships no cli.js),
// so accept both forms — but only a launcher the package itself declares
// in package.json bin, the pinned known entry, or its own bin/ folder.
function packageEntry(nodeModules,kind){
 kind=cleanKind(kind);
 const info=CLI_TOOLS[kind],parts=info.entry.split('/'),packageName=parts.slice(0,2),pkg=path.join(nodeModules,...packageName);
 const known=path.join(nodeModules,...parts);
 if(fs.existsSync(known)&&fs.statSync(known).isFile())return {file:known,native:false};
 let manifest=null;try{manifest=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'),'utf8'));}catch{}
 if(!manifest||manifest.name!==packageName.join('/'))return null;
 const bin=typeof manifest.bin==='string'?manifest.bin:manifest.bin?.[kind];
 if(typeof bin==='string'&&/^([a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/.test(bin)){
  const file=safePackageFile(pkg,bin);
  if(file)return {file,native:!/\.(js|mjs|cjs)$/.test(bin)};
 }
 for(const cand of [`bin/${kind}.exe`,`bin/${kind}`,`${kind}.exe`]){
  const file=safePackageFile(pkg,cand);if(file)return {file,native:true};
 }
 return null;
}
function entryResolution(entry,source){return entry.native?{command:entry.file,args:[],source}:{command:process.execPath,args:[entry.file],source};}
export function managedEntry(kind){const e=packageEntry(path.join(TOOLS_DIR,'node_modules'),kind);return e?e.file:null;}
export function managedResolution(kind){const e=packageEntry(path.join(TOOLS_DIR,'node_modules'),kind);return e?entryResolution(e,'managed'):null;}
export function resolveCli(kind,{env=process.env,platform=process.platform,managed=true}={}){
 kind=cleanKind(kind);
 if(managed){const r=managedResolution(kind);if(r)return r;}
 const cliName=kind;
 const paths=String(env.PATH||env.Path||'').split(platform==='win32'?';':path.delimiter).filter(Boolean);
 if(platform==='win32'){
  // A long-running app process can hold a stale PATH from before the user
  // installed a CLI. Always also probe the standard per-user locations:
  // the Claude Code native installer (~\.local\bin) and npm global (%APPDATA%\npm).
  const home=env.USERPROFILE||env.HOME||'';
  if(home)paths.push(path.join(home,'.local','bin'));
  if(env.APPDATA)paths.push(path.join(env.APPDATA,'npm'));
 }else{
  const home=env.HOME||env.USERPROFILE||'';
  if(home)paths.push(path.join(home,'.local','bin'));
 }
 for(const dir of paths){
  if(platform==='win32'){
   // Windows npm .cmd shims are not launched through a shell. Use the
   // publisher-declared entrypoint: a JS file via our trusted Node binary,
   // or the package's native binary directly.
   const entry=packageEntry(path.join(dir,'node_modules'),kind);
   if(entry)return entryResolution(entry,'system');
   const exe=path.join(dir,cliName+'.exe');if(fs.existsSync(exe))return {command:exe,args:[],source:'system'};
  }else{
   const binary=path.join(dir,cliName);
   try{fs.accessSync(binary,fs.constants.X_OK);return {command:binary,args:[],source:'system'};}catch{}
  }
 }
 throw new Error(`Chưa cài ${kind==='codex'?'Codex':kind==='claude'?'Claude Code':'Gemini CLI'}. Chọn Cài công cụ AI trong tab Kết nối.`);
}
export function npmCliPath({nodePath=process.execPath,root=ROOT}={}){
 const runtimeDir=process.platform==='win32'?(process.arch==='arm64'?'runtime-win-arm64':'runtime-win-x64'):process.platform==='linux'?'runtime-linux-x64':process.platform==='darwin'?(process.arch==='arm64'?'runtime-darwin-arm64':'runtime-darwin-x64'):null;
 const bases=[path.dirname(nodePath),path.resolve(path.dirname(nodePath),'../lib'),path.resolve(path.dirname(nodePath),'../lib64'),...(runtimeDir?[path.join(root,runtimeDir)]:[]),root];
 for(const base of bases){const target=path.join(base,'node_modules','npm','bin','npm-cli.js');if(fs.existsSync(target))return target;}
 throw new Error('Thiếu npm trong Node.js portable. Chạy RUN-WINDOWS.cmd để hoàn tất bộ Node.js hoặc cài Node.js 22+.');
}
let installing=false;
export async function installManagedCli(kind,{invoke=run,npmPath}={}){
 kind=cleanKind(kind);
 if(installing)throw new Error('Một công cụ AI khác đang được cài.');
 installing=true;
 try{
  fs.mkdirSync(TOOLS_DIR,{recursive:true,mode:0o700});
  const npm=npmPath||npmCliPath();
  const args=[npm,'install','--prefix',TOOLS_DIR,'--no-audit','--no-fund','--omit=dev',CLI_TOOLS[kind].package];
  const result=await invoke(process.execPath,args,{cwd:TOOLS_DIR,timeoutMs:240000,inheritEnv:false,env:{npm_config_update_notifier:'false'}});
  if(result.code!==0||result.timedOut)throw new Error('Không cài được CLI từ npm chính thức. Kiểm tra mạng hoặc quyền ghi thư mục người dùng.');
  if(!managedEntry(kind))throw new Error('CLI cài xong nhưng thiếu tệp khởi động mong đợi. Đã chặn chạy.');
  return {ok:true,kind,installed:true,location:'local-user',message:`Đã cài ${kind} trong thư mục người dùng. Tiếp tục bước đăng nhập chính thức.`};
 }finally{installing=false;}
}
export function cliToolsStatus(){return Object.keys(CLI_TOOLS).map(kind=>({kind,installed:(()=>{try{return Boolean(resolveCli(kind));}catch{return false;}})(),managed:!!managedEntry(kind),officialUrl:CLI_TOOLS[kind].url}));}
export function cliProfileDir(kind){cleanKind(kind);return path.join(DATA_DIR,'cli-profiles',kind);}
export function cliRuntime(kind){
 const home=cliProfileDir(kind),cwd=path.join(home,'empty');fs.mkdirSync(cwd,{recursive:true,mode:0o700});
 for(const p of [home,cwd])try{fs.chmodSync(p,0o700);}catch{}
 const base={PATH:process.env.PATH||process.env.Path||'',HOME:home,USERPROFILE:home};
 for(const k of ['SystemRoot','WINDIR','COMSPEC','TEMP','TMP','PATHEXT','LANG','APPDATA','LOCALAPPDATA'])if(process.env[k])base[k]=process.env[k];
 for(const k of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_APPLICATION_CREDENTIALS','CLAUDE_CODE_OAUTH_TOKEN','GOOGLE_GENAI_USE_VERTEXAI'])delete base[k];
 return {cwd,env:base};
}
