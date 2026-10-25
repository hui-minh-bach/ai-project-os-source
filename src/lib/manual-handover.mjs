// Only project workspaces and immutable release commits are packaged here.
// No application installer, cloud client, npm install or project command runs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {DATA_DIR} from './store.mjs';
import {workspaceDir,safeResolve} from './workspace.mjs';
import {must,safeBaseEnv} from './shell.mjs';
import {createZipBuffer} from './updater.mjs';
import {deploymentTarget,deploymentImpact,TARGET_LABELS} from './deployment-target.mjs';
import {releaseNotesMarkdown} from './project-releases.mjs';
import {redactVaultSecrets} from './vault.mjs';
const exec=promisify(execFile),digest=v=>crypto.createHash('sha256').update(v).digest('hex');
const json=v=>JSON.stringify(v,null,2)+'\n';
const artifact=/\.(?:html?|css|js|json|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|txt)$/i;
const textual=/\.(?:html?|css|js|json|svg|txt)$/i;
const secretPath=/(^|\/)(?:vault(?:\.enc)?\.json|auth\.json|secrets\.json|account-profiles|cli-profiles|\.codex|\.claude|\.gemini|\.data)(?:\/|$)|(^|\/)(?:\.env(?:\.|$)|\.aws|\.ssh|\.npmrc|credentials(?:\.json)?|id_rsa|id_ed25519)|\.(?:pem|key|p12|pfx)$/i;
const secretText=/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\b(?:sk-[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{25,})|(?:password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)["']?\s*[:=]\s*["'][^"']+["']|https?:\/\/[^\s/]+:[^\s/]+@/i;
function fail(status,message){const e=new Error(message);e.handoverStatus=status;throw e;}
function safeArchivePath(file){if(!file||file.startsWith('/')||file.includes('\\')||/[\x00-\x1f:*?"<>|]/.test(file)||file.split('/').some(p=>!p||p==='..'||p==='.'||/[. ]$/.test(p)||/^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i.test(p)))fail('BLOCKED','Tên file không an toàn/không portable trong gói bàn giao.');return file;}
async function committedTree(project,commit){
 if(!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(commit||''))fail('BLOCKED','Snapshot chưa có commit đã xác minh.');
 const cwd=workspaceDir(project.id),raw=(await must('git',['ls-tree','-rlz',commit],{cwd,timeoutMs:10000,inheritEnv:false})).stdout;
 if(raw.length>450000)fail('BLOCKED','Danh sách file vượt giới hạn; không đóng gói danh sách bị cắt.');
 const rows=raw.split('\0').filter(Boolean).map(line=>{const m=line.match(/^(\d+) (\w+) ([a-f0-9]+) +([\d-]+)\t([\s\S]+)$/);if(!m)fail('BLOCKED','Không đọc được Git tree.');return {mode:m[1],type:m[2],oid:m[3],size:Number(m[4]),name:safeArchivePath(m[5])};});
 if(rows.length>1000)fail('UNSUPPORTED','Adapter tĩnh giới hạn 1000 file Git.');
 if(rows.some(r=>r.type!=='blob'||!['100644','100755'].includes(r.mode)))fail('BLOCKED','Không đóng gói symlink hoặc submodule.');
 if(rows.some(r=>secretPath.test(r.name)))fail('BLOCKED','Commit có đường dẫn chứa thông tin nhạy cảm; không đưa vào gói.');
 let total=0;const cache=new Map();
 const read=async row=>{
  if(cache.has(row.oid))return cache.get(row.oid);
  if(!Number.isFinite(row.size)||row.size>2000000||(total+=row.size)>10000000)fail('BLOCKED','File/gói vượt giới hạn kiểm chứng (2 MB/file, 10 MB tổng đọc).');
  const {stdout}=await exec('git',['cat-file','blob',row.oid],{cwd,env:safeBaseEnv(),encoding:'buffer',maxBuffer:2100000,timeout:10000,windowsHide:true});if(stdout.length!==row.size)fail('BLOCKED','Nội dung Git không đầy đủ.');cache.set(row.oid,stdout);return stdout;
 };
 return {rows,read};
}
function relativeReference(file,url,files){
 if(!url||url.startsWith('#')||/^(?:data:|mailto:|tel:)/i.test(url))return;
 if(/^(?:[a-z]+:)?\/\//i.test(url))fail('UNSUPPORTED','Artifact có tài nguyên bên ngoài; adapter độc lập chưa xác minh trường hợp này.');
 let decoded;try{decoded=decodeURIComponent(url.split(/[?#]/)[0]);}catch{fail('BLOCKED','URL tài nguyên không hợp lệ.');}
 if(!decoded)return;const resolved=path.posix.normalize(decoded.startsWith('/')?decoded.slice(1):path.posix.join(path.posix.dirname(file),decoded));
 if(resolved==='..'||resolved.startsWith('../'))fail('BLOCKED','Tài nguyên vượt khỏi root ứng dụng.');
 const candidate=resolved==='.'?'index.html':resolved.endsWith('/')?resolved+'index.html':resolved;
 if(!Object.hasOwn(files,candidate)&&!Object.hasOwn(files,resolved+'/index.html'))fail('UNSUPPORTED','Tài nguyên nội bộ không có trong artifact: '+candidate);
}
async function staticWebBuild(tree){
 if(!tree.rows.some(r=>r.name==='index.html'))fail('UNSUPPORTED','Chỉ hỗ trợ website tĩnh độc lập có index.html tại root; chưa có adapter build framework/backend/desktop.');
 const packageRow=tree.rows.find(r=>r.name==='package.json');
 if(packageRow){let p;try{p=JSON.parse((await tree.read(packageRow)).toString('utf8'));}catch{fail('UNSUPPORTED','Không xác minh được package.json.');}
  if(p.name==='ai-project-os-personal')fail('BLOCKED','Đây là mã AI Project OS, không phải ứng dụng được Agent tạo để bàn giao.');
  if(p.scripts?.build||['dependencies','optionalDependencies','peerDependencies','devDependencies'].some(k=>Object.keys(p[k]||{}).length))fail('UNSUPPORTED','Dự án có dependency hoặc bước build chưa được adapter tĩnh kiểm chứng; không chạy npm hoặc suy đoán output.');
 }
 if(tree.rows.some(r=>/\.(?:mjs|cjs|ts|tsx|jsx|py|go|rs|php|java|sql|prisma)$/i.test(r.name)&&!/(^|\/)(?:test|tests)\//.test(r.name)))fail('UNSUPPORTED','Có mã runtime/backend/build ngoài phạm vi static-web-v1.');
 const files=Object.create(null),names=new Set();
 for(const row of tree.rows){
  if(!artifact.test(row.name)||/(^|\/)(?:test|tests|docs|node_modules|\.git)\/|(^|\/)package(?:-lock)?\.json$|(^|\/)config(?:\.example)?\.json$/i.test(row.name))continue;
  if(names.has(row.name.normalize('NFC').toLowerCase()))fail('BLOCKED','Tên file trùng khi chuyển sang hệ thống không phân biệt hoa/thường.');names.add(row.name.normalize('NFC').toLowerCase());
  const bytes=await tree.read(row);if(textual.test(row.name)){const text=bytes.toString('utf8');if(Buffer.byteLength(text)!==bytes.length||text.includes('\0'))fail('BLOCKED','Encoding artifact chưa được hỗ trợ.');if(secretText.test(text)||redactVaultSecrets(text)!==text)fail('BLOCKED','Artifact có dấu hiệu credential; cần loại bí mật trước khi bàn giao.');}
  files[row.name]=bytes;
 }
 for(const [file,bytes] of Object.entries(files)){
  if(!textual.test(file))continue;const text=bytes.toString('utf8');
  if(/\b(?:srcset|srcdoc)\s*=|<(?:video|audio|iframe|object|embed)\b/i.test(text))fail('UNSUPPORTED','Tài nguyên nhúng/srcset chưa được adapter tĩnh kiểm chứng.');
  if(/\.(?:js|html?|svg)$/i.test(file)&&/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|require)\s*\(|\bimport\s*(?:\(|['"{*\w])|<base\b/i.test(text))fail('UNSUPPORTED','Ứng dụng cần API/module loader hoặc base URL chưa được adapter tĩnh xác minh.');
  if(/\.(?:css|html?|svg)$/i.test(file)){if(/@import\b/i.test(text))fail('UNSUPPORTED','CSS import chưa được adapter kiểm chứng.');for(const m of text.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g))relativeReference(file,m[1],files);}
  if(/\.(?:html?|svg)$/i.test(file))for(const tag of text.matchAll(/<([a-zA-Z][\w:-]*)\b([^<>]*)>/g)){
   for(const attr of tag[2].matchAll(/\b(src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)){
    const url=attr[2]??attr[3]??attr[4];if(tag[1].toLowerCase()==='a'&&/^(?:https?:|mailto:|tel:|#)/i.test(url))continue;relativeReference(file,url,files);
   }
  }
 }
 return {files,build:{source:'runtime',status:'PASS',kind:'static-artifact-validation',command:null,executedProjectCode:false,checks:['Immutable release commit','Root index.html','Local asset reference resolution','Portable paths; no symlinks/submodules','Secret-path and known credential pattern checks'],limitations:['Không chạy browser acceptance tests trong bước đóng gói; test results được kế thừa từ snapshot release.','Quét credential theo mẫu không chứng minh mọi nội dung đều không có bí mật ẩn.']}};
}
const staticAdapter=Object.freeze({id:'static-web-v1',name:'Website tĩnh độc lập · HTML/CSS/JS',version:1,targets:['not-specified','local-only','on-premises','cloud-manual'],build:staticWebBuild});
// Trusted code extension point. Adding an adapter requires implementation + tests;
// callers cannot upload adapters or supply a command to execute.
export const HANDOVER_ADAPTERS=Object.freeze([staticAdapter]);
export const handoverAdapters=()=>HANDOVER_ADAPTERS.map(({build,...metadata})=>metadata);
const previewServer=`// Local preview only. Not a production installer.\nimport http from 'node:http';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport {fileURLToPath} from 'node:url';\nconst root=path.join(path.dirname(fileURLToPath(import.meta.url)),'app');\nconst port=Number(process.argv[2]||8080);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Port 1024..65535 required');\nconst mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};\nhttp.createServer((req,res)=>{try{if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}let rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\\/+/, '');if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.resolve(root,rel);if(!file.startsWith(root+path.sep))throw new Error('Path');let cur=root;for(const part of path.relative(root,file).split(path.sep)){cur=path.join(cur,part);if(fs.lstatSync(cur).isSymbolicLink())throw new Error('Symlink');}if(!mime[path.extname(file).toLowerCase()]||!fs.statSync(file).isFile())throw new Error('File');res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()],'x-content-type-options':'nosniff','cache-control':'no-store'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log('Local preview: http://127.0.0.1:'+port));\n`;
function recordHash(record){const {contentHash,...body}=record;return digest(json(body));}
export async function prepareManualHandover(project,doc,input){
 if(!input||Object.keys(input).some(k=>!['adapterId','snapshotHash','targetRevision'].includes(k)))throw new Error('Handover chỉ nhận adapter đã kiểm chứng và snapshot; không nhận command hoặc đường dẫn.');
 const record={id:crypto.randomUUID(),createdAt:new Date().toISOString(),releaseId:doc.id,version:doc.version,adapterId:input.adapterId||'static-web-v1',deploymentTarget:deploymentTarget(project),targetRevision:project.deploymentTargetRevision||0,snapshotHash:doc.contentHash||null,artifactCommit:doc.artifactCommit||null,status:'BLOCKED',message:'',limitations:[],files:[]};let archive=null;
 try{
  if(!doc.frozen||!doc.handover||input.snapshotHash!==doc.contentHash||input.targetRevision!==record.targetRevision)fail('BLOCKED','Cần snapshot bàn giao đã được PO chốt và Deployment Target hiện tại.');
  const impact=deploymentImpact(project);if(impact.blocked)fail('BLOCKED',impact.reason);
  // Frozen historical release must have a decision valid for its own architecture.
  const approved=project.architectures?.find(a=>a.id===doc.source.architectureId);
  const scoped={...project,approvedArchitectureId:approved?.id};if(deploymentImpact(scoped).blocked)fail('BLOCKED','Đích hiện tại chưa được đánh giá cho Architecture của release lịch sử này.');
  const adapter=HANDOVER_ADAPTERS.find(a=>a.id===record.adapterId);if(!adapter)fail('UNSUPPORTED','Chưa có adapter được kiểm chứng cho lựa chọn này.');
  if(!adapter.targets.includes(record.deploymentTarget))fail('UNSUPPORTED','Adapter này không tạo Windows Desktop installer/EXE; không có packager desktop đã kiểm chứng.');
  const tree=await committedTree(project,doc.artifactCommit),built=await adapter.build(tree),files=Object.create(null);
  for(const [name,data] of Object.entries(built.files))files['app/'+name]=data;
  files['preview.mjs']=previewServer;
  files['config.example.json']=json({publicBasePath:'/',deploymentTarget:record.deploymentTarget,notice:'Chỉ cấu hình công khai cho website tĩnh; không đặt password, API key hoặc token trong frontend.'});
  files['VERSION.json']=json({projectId:project.id,releaseVersion:doc.version,commit:doc.artifactCommit,snapshotHash:doc.contentHash,specification:doc.source.specificationVersion,architecture:doc.source.architectureVersion,deploymentTarget:record.deploymentTarget,adapter:adapter.id,generatedAt:record.createdAt});
  files['TEST-RESULTS.json']=json({source:'frozen-release-snapshot',asOf:doc.asOf,packagingValidation:built.build,tasks:doc.items.map(i=>({taskId:i.taskId,runId:i.runId,test:i.test,buildCommand:i.buildCommand,architectureCheck:i.architectureCheck,acceptance:i.acceptance}))});
  files['RELEASE-NOTES.md']=releaseNotesMarkdown(doc);
  files['INSTALL-RUN.md']='# Cài đặt/chạy thủ công · '+doc.version+'\n\nĐích: '+TARGET_LABELS[record.deploymentTarget]+'\n\n1. Giải nén gói vào thư mục mới; kiểm tra VERSION.json và SHA256SUMS.json.\n2. Xem config.example.json: website tĩnh không cần credential server. Không đặt secret vào frontend.\n3. Xem trước cục bộ: máy có Node.js 22 trở lên, mở terminal tại thư mục gói và chạy `node preview.mjs 8080`; mở http://127.0.0.1:8080. Không có npm install/build trong gói.\n4. Đọc TEST-RESULTS.json và Release Notes, rồi kiểm tra acceptance ở máy đích.\n\n'+(record.deploymentTarget==='on-premises'||record.deploymentTarget==='cloud-manual'?'Đưa thư mục app/ vào web server có sẵn do quản trị viên quản lý, bằng thao tác thủ công. Quản trị viên tự cấu hình HTTPS, quyền truy cập, backup và mạng theo Architecture đã duyệt. preview.mjs chỉ bind loopback để xem trước; không dùng làm server production. Không có SSH, upload, cài đặt server hay tạo tài khoản cloud tự động.\n':record.deploymentTarget==='not-specified'?'Chưa chỉ định môi trường đích. Gói chỉ xác nhận website tĩnh và khả năng xem trước cục bộ; chưa xác minh production.\n':'Gói chỉ chạy/xem trước cục bộ; không cài vào Windows hay triển khai từ xa.\n')+'\nĐóng gói thành công không có nghĩa Deployed. PO chỉ xác nhận triển khai sau khi thực sự kiểm tra máy đích.\n';
  files['ROLLBACK.md']='# Rollback thủ công\n\nGiữ gói của phiên bản trước và sao lưu cấu hình/dữ liệu trước khi thay đổi. Nếu bản mới lỗi, phục hồi thư mục app/ của gói trước vào vị trí cũ bằng thao tác thủ công, đối chiếu VERSION.json và kiểm tra lại. Không tự xóa dữ liệu trình duyệt/localStorage. Nếu chưa có bản trước thì chưa có gói rollback; giữ nguyên trạng và xử lý với PO. Không có lệnh tự thay hệ thống hoặc database.\n';
  for(const data of Object.values(files)){if(typeof data==='string'&&(secretText.test(data)||redactVaultSecrets(data)!==data))fail('BLOCKED','Tài liệu/cấu hình bàn giao có dấu hiệu credential; không phát hành archive.');}
  record.files=Object.entries(files).map(([name,data])=>({name,sha256:digest(data),bytes:Buffer.byteLength(data)}));files['SHA256SUMS.json']=json(record.files);
  archive=createZipBuffer(files);record.archiveEntries=Object.keys(files).length;record.archiveHash=digest(archive);record.archiveBytes=archive.length;record.status='READY';record.message='Đã tạo gói bàn giao website tĩnh từ commit release đã chốt. Chưa triển khai.';record.validation=built.build;record.limitations=[...built.build.limitations,...(record.deploymentTarget==='not-specified'?['Chưa chỉ định môi trường đích; chỉ xác minh xem trước cục bộ.']:[]),'Không có installer Windows, build framework, backend hoặc cài đặt máy chủ tự động.'];
 }catch(error){record.status=error.handoverStatus||'FAILED';record.message=error.handoverStatus?error.message:'Không hoàn tất kiểm chứng Git/đóng gói; không có gói thành công.';}
 record.contentHash=recordHash(record);return {record,archive};
}
function archivePath(projectId,id){if(!/^[a-zA-Z0-9_-]{1,80}$/.test(projectId)||!/^[a-f0-9-]{36}$/.test(id))throw new Error('Handover ID không hợp lệ.');return safeResolve(DATA_DIR,`manual-handovers/${projectId}/${id}.zip`);}
export function saveHandoverArchive(projectId,record,archive){if(record.status!=='READY'||digest(archive)!==record.archiveHash)throw new Error('Archive không khớp bản ghi bàn giao.');const file=archivePath(projectId,record.id);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,archive,{flag:'wx',mode:0o600});return file;}
export function readHandoverArchive(projectId,record){if(record.status!=='READY'||record.contentHash!==recordHash(record))throw new Error('Gói bàn giao chưa sẵn sàng hoặc bản ghi đã bị sửa.');const data=fs.readFileSync(archivePath(projectId,record.id));if(digest(data)!==record.archiveHash)throw new Error('Archive bàn giao đã thay đổi.');return data;}
