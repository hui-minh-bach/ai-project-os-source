import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, readJson, writeJson } from './store.mjs';
import { commandExists, run } from './shell.mjs';
import { createVaultSecretRedactor } from './vault.mjs';
import { opencodeStatus } from './opencode.mjs';

const ROOT=path.join(DATA_DIR,'engines');fs.mkdirSync(ROOT,{recursive:true});
const CATALOG=[
 {id:'native',name:'Native Sandbox',icon:'native',repo:null,docs:'https://nodejs.org/en/docs',license:'Built-in',risk:'low',mode:'builtin',runtime:'Local Sandbox',safety:'Safe',description:'Thực thi an toàn với sandbox tích hợp, giới hạn quyền truy cập hệ thống.',useCases:'Phù hợp cho: tác vụ thông thường, phân tích, xử lý dữ liệu, thử nghiệm nhanh.',requirements:['Node.js 22+','Safe chỉ dùng file tools; npm và shell bị chặn. Docker / Host UNSAFE là chế độ riêng.'],execution:'full'},
 {id:'mini-swe-agent',name:'mini-SWE-agent',icon:'mini',repo:'https://github.com/SWE-agent/mini-swe-agent.git',docs:'https://mini-swe-agent.com/latest/usage/mini/',license:'MIT',risk:'high',mode:'external',runtime:'Host · opt-in',safety:'Unsafe',description:'AI agent chuyên về lập trình phần mềm. Adapter hiện tại chạy shell trực tiếp trên host.',useCases:'Khuyên dùng: tác vụ coding nâng cao, xây dựng tính năng, sửa lỗi dự án.',requirements:['Python 3.10+','pip install mini-swe-agent','Khóa mặc định; cần explicit unsafe host opt-in trong AI Team.'],detect:'mini',execution:'unsafe-host'},
 {id:'openhands',name:'OpenHands',icon:'openhands',repo:'https://github.com/OpenHands/OpenHands.git',docs:'https://docs.openhands.dev/openhands/usage/agent-canvas/overview',license:'MIT',risk:'medium',mode:'external',runtime:'Agent Canvas',safety:'Advanced',description:'IDE agent mạnh mẽ với khả năng tương tác máy tính, coding và sử dụng công cụ.',useCases:'Phù hợp cho: tác vụ phức tạp, cần tương tác nhiều công cụ, dành cho người dùng có kinh nghiệm.',requirements:['Agent Canvas: Node.js 24+ và npm','CLI OpenHands cũ không còn được duy trì.','Chưa có task adapter cho AI Project OS.'],detect:'agent-canvas',execution:'catalog'},
 {id:'opencode',name:'OpenCode',icon:'opencode',repo:null,docs:'https://opencode.ai/docs/',license:'MIT',risk:'high',mode:'external',runtime:'Host · opt-in',safety:'Unsafe',description:'Coding agent mã nguồn mở (MIT) chạy headless qua lệnh opencode run. Điểm mạnh cho AI Project OS: nói chuyện với MODEL LOCAL qua endpoint OpenAI-compatible (Ollama, LM Studio…) bằng đúng kết nối model chủ sở hữu đã cấu hình — làm task code không cần tài khoản đám mây.',useCases:'Phù hợp cho: tác vụ coding bằng model local, dự án GitHub cần agent sửa code trong worktree.',requirements:['Cài runtime bằng nút "Cài runtime (npm)" (gói chính thức opencode-ai 1.19.3, MIT) vào thư mục ai-tools.','Adapter task đã nối qua external-agents với cùng cổng Host UNSAFE opt-in như mini-SWE-agent (mặc định khóa).','Vòng chạy thật với model local cần nghiệm thu trên máy chủ sở hữu; môi trường kiểm thử của đội phát triển bị proxy chặn luồng provider của OpenCode nên chưa xác minh end-to-end tại đây.'],execution:'unsafe-host'},
 {id:'crewai',name:'CrewAI',icon:'crewai',repo:'https://github.com/crewAIInc/crewAI.git',docs:'https://docs.crewai.com/en/installation',license:'MIT',risk:'medium',mode:'external',runtime:'Python',safety:'Advanced',description:'Framework đa agent, phối hợp nhiều AI làm việc theo vai trò.',useCases:'Phù hợp cho: dự án cần nhiều agent, phối hợp nhiệm vụ, nghiên cứu, tự động hóa quy trình.',requirements:['Python >=3.10, <3.14','CrewAI CLI','Chưa có task adapter cho AI Project OS.'],detect:'crewai',execution:'catalog'},
 {id:'microsoft-agent-framework',name:'Microsoft Agent Framework',icon:'microsoft',repo:'https://github.com/microsoft/agent-framework.git',docs:'https://github.com/microsoft/agent-framework/blob/main/python/README.md',license:'MIT',risk:'medium',mode:'library',runtime:'Python (venv)',safety:'Advanced',description:'Framework chính thức từ Microsoft để xây dựng các AI agent doanh nghiệp.',useCases:'Phù hợp cho: ứng dụng agent trong môi trường doanh nghiệp, tích hợp dịch vụ Microsoft, Azure (local/chạy thử nghiệm).',requirements:['Python 3.10+','pip install agent-framework','Detect module agent_framework và distribution agent-framework-core.','Chưa có task adapter cho AI Project OS.'],detectModule:'agent_framework',execution:'catalog'},
 {id:'metagpt',name:'MetaGPT',icon:'metagpt',repo:'https://github.com/FoundationAgents/MetaGPT.git',docs:'https://github.com/FoundationAgents/MetaGPT',license:'Xem LICENSE của repository',risk:'medium',mode:'external',runtime:'Python <3.12',safety:'Advanced',description:'Multi-agent framework mô phỏng đội ngũ phát triển phần mềm (PM, Architect, Dev, QA).',useCases:'Phù hợp cho: phát triển phần mềm theo quy trình, dự án phức tạp, nghiên cứu AI agent.',requirements:['Python >=3.9, <3.12','pip install --upgrade metagpt','Python 3.12 không đáp ứng yêu cầu này.','Chưa có task adapter cho AI Project OS.'],detect:'metagpt',execution:'catalog'},
 {id:'custom',name:'Khác / Custom',icon:'custom',repo:null,docs:null,license:'Tùy registry',risk:'unknown',mode:'custom',runtime:'Tùy chọn',safety:'Tùy chỉnh',description:'Thêm các engine tùy chỉnh từ source Git hoặc local path.',useCases:'Phù hợp cho: engine tự phát triển hoặc cộng đồng, thử nghiệm tính năng mới.',requirements:['Chỉ lưu metadata. Không clone, cài đặt hay thực thi shell từ metadata.','Chưa hỗ trợ adapter cho engine tùy chỉnh.'],execution:'unsupported'},
 {id:'gpt-pilot-blocked',name:'GPT-Pilot (ví dụ)',icon:'blocked',repo:'https://github.com/Pythagora-io/gpt-pilot.git',docs:'https://github.com/Pythagora-io/gpt-pilot',license:'Xem LICENSE của repository',risk:'blocked',mode:'blocked',runtime:'Host (Nguy hiểm)',safety:'Blocked',description:'Chưa hỗ trợ do yêu cầu quyền truy cập hệ thống cao và rủi ro bảo mật.',useCases:'Lý do: có thể thực thi lệnh trực tiếp trên máy host, không đảm bảo an toàn trong môi trường local.',requirements:['Bị chặn theo chính sách của dự án.','Repo công bố mã độc trong quá khứ đã được gỡ ngày 11/06/2026; không khẳng định mã độc còn tồn tại.'],execution:'blocked'}
];
export function engineCatalog(){return structuredClone(CATALOG);}
export function engineDir(id){return path.join(ROOT,String(id).replace(/[^a-zA-Z0-9_-]/g,'-'));}
function executablePath(name){for(const dir of String(process.env.PATH||'').split(path.delimiter).filter(Boolean)){for(const ext of process.platform==='win32'?String(process.env.PATHEXT||'.EXE;.CMD;.BAT').split(';'):['']){const candidate=path.join(dir,name+ext);try{fs.accessSync(candidate,process.platform==='win32'?fs.constants.F_OK:fs.constants.X_OK);if(fs.statSync(candidate).isFile())return candidate;}catch{}}}return null;}
const VERSION=/\b(v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)/;
export async function probeExecutable(name,{args=['--version'],timeoutMs=5000}={}){
 const redact=createVaultSecretRedactor(),checkedAt=new Date().toISOString(),file=executablePath(name);
 if(!file)return {name,available:false,status:'missing',version:null,path:null,checkedAt,evidence:'Không tìm thấy executable trong PATH.'};
 try{const r=await run(file,args,{timeoutMs,inheritEnv:false}),output=redact((r.stdout||r.stderr).trim()).slice(0,1200),version=output.match(VERSION)?.[1]||null;return {name,available:r.code===0&&!r.timedOut&&Boolean(version),status:r.timedOut?'timeout':r.code!==0?'failed':version?'ready':'unknown',version:r.code===0?version:null,path:redact(file),checkedAt,exitCode:r.code,evidence:output||'Executable không trả về phiên bản.'};}
 catch(e){return {name,available:false,status:'failed',version:null,path:redact(file),checkedAt,evidence:redact(e.message)};}
}
async function probeFramework(){
 const redact=createVaultSecretRedactor(),checkedAt=new Date().toISOString(),py=executablePath('python3')||executablePath('python');
 if(!py)return {name:'agent_framework',available:false,status:'missing',version:null,path:null,checkedAt,evidence:'Không có Python.'};
 try{const r=await run(py,['-c',"import agent_framework, importlib.metadata as m, json; print(json.dumps({'version':m.version('agent-framework-core'),'path':next(iter(agent_framework.__path__))}))"],{timeoutMs:8000,inheritEnv:false});if(r.code!==0)throw new Error(r.stderr||r.stdout);const info=JSON.parse(r.stdout);return {name:'agent_framework',available:Boolean(info.version&&info.path),status:'ready',version:redact(info.version),path:redact(info.path),checkedAt,evidence:'Import agent_framework và package metadata thành công.'};}
 catch(e){return {name:'agent_framework',available:false,status:'missing',version:null,path:null,checkedAt,evidence:redact(e.message).slice(-1200)};}
}
export async function engineDiagnostics(){
 const names=['docker','python3','python','node','git','npm','gh','vercel','supabase','mini','agent-canvas','crewai','metagpt'];
 const executables=await Promise.all(names.map(n=>probeExecutable(n)));
 const docker=executables.find(x=>x.name==='docker');
 if(docker.available){const redact=createVaultSecretRedactor();try{const r=await run('docker',['info','--format','{{.ServerVersion}}'],{timeoutMs:6000,inheritEnv:false});docker.daemonReady=r.code===0&&!r.timedOut;docker.daemonEvidence=redact((r.stdout||r.stderr).trim()).slice(-1200);}catch(e){docker.daemonReady=false;docker.daemonEvidence=redact(e.message);}}
 return {checkedAt:new Date().toISOString(),executables};
}
export async function engineStatuses(){
 return Promise.all(CATALOG.map(async e=>{
  let diagnostic=e.mode==='builtin'?await probeExecutable('node'):e.detect?await probeExecutable(e.detect):e.detectModule?await probeFramework():null;
  if(e.id==='opencode'){const st=opencodeStatus();diagnostic={available:st.ready,version:st.version||'',path:st.binPath||'',checkedAt:new Date().toISOString(),evidence:st.source};}
  if(e.mode==='builtin'&&diagnostic.available&&Number(diagnostic.version.replace(/^v/,'').split('.')[0])<22)diagnostic={...diagnostic,available:false,status:'incompatible',evidence:'Native yêu cầu Node.js 22+.'};
  const sourceDownloaded=Boolean(e.repo&&fs.existsSync(path.join(engineDir(e.id),'source','.git')));
  return {...e,sourceDownloaded,sourceInstalled:sourceDownloaded,runtimeInstalled:Boolean(diagnostic?.available),diagnostic,taskAdapterSupported:['native','mini-swe-agent','opencode'].includes(e.id),executionRequiresUnsafeOptIn:['mini-swe-agent','opencode'].includes(e.id),runtimeInstallSupported:e.id==='opencode',sourceInstallSupported:Boolean(e.repo&&e.mode!=='blocked'),customCount:e.mode==='custom'?listCustomEngines().length:undefined};
 }));
}
const installLocks=new Set();
export async function installEngineSource(id){
 const redact=createVaultSecretRedactor();
 const e=CATALOG.find(x=>x.id===id);if(!e)throw new Error('Engine không tồn tại.');
 if(e.mode==='blocked')throw new Error('Engine này bị chặn theo chính sách dự án.');
 if(!e.repo)throw new Error('Engine này không hỗ trợ tải source.');
 if(installLocks.has(id))throw new Error('Source đang được xử lý.');installLocks.add(id);
 try{
  if(!(await commandExists('git')))throw new Error('Máy chưa có Git.');
  const dir=engineDir(id),source=path.join(dir,'source');
  for(const p of [ROOT,dir,source,path.join(source,'.git')])if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw new Error('Source symlink không được hỗ trợ.');
  fs.mkdirSync(dir,{recursive:true});
  const git=async(args,cwd)=>{const r=await run('git',['-c','core.hooksPath=/dev/null',...args],{cwd,timeoutMs:120000,inheritEnv:false,env:{GIT_TERMINAL_PROMPT:'0'}});if(r.code!==0||r.timedOut)throw new Error('Git source thất bại: '+redact(r.stderr||r.stdout).slice(-2000));return r.stdout.trim();};
  if(fs.existsSync(source)){
   if(!fs.existsSync(path.join(source,'.git')))throw new Error('Thư mục source đã tồn tại; giữ nguyên dữ liệu, không ghi đè.');
   if(await git(['remote','get-url','origin'],source)!==e.repo)throw new Error('Origin không khớp repository allowlist; không cập nhật.');
   if(await git(['status','--porcelain','--untracked-files=all'],source))throw new Error('Source có thay đổi local; giữ nguyên dữ liệu, không cập nhật.');
   // Fetch the fixed catalog URL, not an arbitrary edited fetch URL; never reset local commits.
   await git(['fetch','--deepen=50',e.repo,'HEAD'],source);
   await git(['merge','--ff-only','FETCH_HEAD'],source);
   return {ok:true,path:redact(source),already:true,sourceDownloaded:true,runtimeInstalled:false,note:'Chỉ cập nhật source; runtime không được cài.'};
  }
  await git(['clone','--depth','1','--',e.repo,source]);
  return {ok:true,path:redact(source),already:false,sourceDownloaded:true,runtimeInstalled:false,note:'Chỉ tải source; runtime không được cài.'};
 }catch(error){throw new Error(redact(error.message));}finally{installLocks.delete(id);}
}
function validateCustom(input,id){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Metadata không hợp lệ.');
 if(Object.keys(input).some(k=>!['id','name','source','docs','description'].includes(k)))throw new Error('Chỉ hỗ trợ metadata; không hỗ trợ command, shell hoặc adapter tùy chỉnh.');
 if(input.id&&input.id!==id)throw new Error('Không được đổi ID.');
 const value={id};for(const [key,max] of [['name',80],['source',500],['docs',500],['description',500]]){if(typeof input[key]!=='string'||input[key].length>max||/[\x00-\x1f]/.test(input[key]))throw new Error(`${key} không hợp lệ (tối đa ${max} ký tự).`);value[key]=input[key].trim();}
 if(!value.name||!value.source)throw new Error('Tên và source là bắt buộc.');
 function https(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{return false;}}
 if(!https(value.source)&&(!path.isAbsolute(value.source)||/[`$;|<>]/.test(value.source)))throw new Error('Source cần URL HTTPS không credential hoặc đường dẫn tuyệt đối.');
 if(value.docs&&!https(value.docs))throw new Error('Docs cần URL HTTPS không credential.');
 return {...value,taskAdapterSupported:false,runtimeInstalled:false};
}
export function listCustomEngines(){return readJson('custom-engines.json',[]).filter(x=>/^custom-[a-z0-9-]{1,80}$/.test(x.id)).map(x=>validateCustom(Object.fromEntries(['id','name','source','docs','description'].map(k=>[k,x[k]])),x.id));}
export function saveCustomEngine(input,{updateId}={}){
 const all=listCustomEngines(),id=updateId||input?.id||'custom-'+crypto.randomUUID();
 if(!/^custom-[a-z0-9-]{1,80}$/.test(id))throw new Error('ID engine tùy chỉnh không hợp lệ.');
 const existing=all.findIndex(x=>x.id===id);if(updateId&&existing<0)throw new Error('Không tìm thấy custom engine.');if(!updateId&&existing>=0)throw new Error('ID đã tồn tại.');
 const value=validateCustom(input,id);if(existing<0)all.push(value);else all[existing]=value;writeJson('custom-engines.json',all);return value;
}
export function deleteCustomEngine(id){const all=listCustomEngines();if(!all.some(x=>x.id===id))throw new Error('Không tìm thấy custom engine; không xóa built-in.');writeJson('custom-engines.json',all.filter(x=>x.id!==id));return {ok:true};}
export async function systemPrerequisites(){const names=['git','node','npm','python','python3','docker','gh','vercel','supabase','mini','crewai','metagpt'];return Object.fromEntries(await Promise.all(names.map(async n=>[n,await commandExists(n)])));}
export async function systemPrerequisiteVersions(){const names=['node','git','docker','gh','vercel','supabase','python3','python'];return Object.fromEntries(await Promise.all(names.map(async name=>{const r=await probeExecutable(name);return [name,r.available?(r.version.startsWith('v')?r.version:'v'+r.version):null];})));}
