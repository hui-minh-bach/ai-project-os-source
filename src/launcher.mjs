import { APP_ID, APP_NAME, APP_VERSION } from './lib/app-identity.mjs';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { readLocalSessionTicket } from './lib/local-access.mjs';
import http from 'node:http';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Never assume the user launched the shortcut with a particular working directory.
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PORT=Number(process.env.AI_PROJECT_OS_PORT||4321);
const EXPLICIT_PORT=Boolean(process.env.AI_PROJECT_OS_PORT);
// Apply a staged, signature-verified update BEFORE starting the server.
// applyPendingUpdate never throws for a bad package: it rolls back and
// records the failure, and this launcher keeps running the old version.
try{
  const {applyPendingUpdate}=await import('./lib/updater.mjs');
  const {DATA_DIR}=await import('./lib/store.mjs');
  const r=applyPendingUpdate({appRoot:ROOT,dataDir:DATA_DIR,currentVersion:APP_VERSION,log:m=>console.log(m)});
  if(r.reason==='UPDATE_ROLLBACK_FAILED'){console.error('Khôi phục cập nhật thất bại. Dừng khởi động; bản sao lưu:',r.backupDir);process.exit(1);}
  if(r.applied)console.log(`Đã áp dụng bản cập nhật v${r.version} (${r.files} tệp). Sao lưu bản cũ tại: ${r.backupDir}`);
  else if(r.reason&&r.reason!=='none')console.warn('Không áp dụng được bản cập nhật đã tải:',r.message||r.reason,'(vẫn chạy bản hiện tại)');
}catch(e){console.warn('Bỏ qua bước áp dụng cập nhật:',e.message);}
// Read after apply: a newly installed version must be used for health checks.
const EXPECTED=(()=>{const r=JSON.parse(fs.readFileSync(path.join(ROOT,'RELEASE.json'),'utf8'));if(r.productId!==APP_ID||!r.version)throw new Error('RELEASE.json không thuộc Personal Edition.');return r.version;})();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(!Number.isSafeInteger(PORT)||PORT<1024||PORT>65535){console.error('Cổng ứng dụng không hợp lệ (1024–65535).');process.exit(1);}
const url=port=>`http://127.0.0.1:${port}`;
function health(port){return new Promise(resolve=>{const req=http.get(url(port)+'/api/health',{timeout:1000,headers:{Host:`127.0.0.1:${port}`}},res=>{let s='';res.on('data',d=>s+=d);res.on('end',()=>{try{const j=JSON.parse(s);resolve(res.statusCode===200&&j?.ok&&j?.localOnly?j:null)}catch{resolve(null)}})});req.on('timeout',()=>{req.destroy();resolve(null)});req.on('error',()=>resolve(null));});}
function portOccupied(port){return new Promise(resolve=>{const req=http.get(url(port)+'/',{timeout:700},res=>{res.resume();resolve(true)});req.on('timeout',()=>{req.destroy();resolve(false)});req.on('error',()=>resolve(false));});}
function openBrowser(token,port){
  if(process.env.AI_PROJECT_OS_NO_BROWSER==='1')return;
  try{
    if(!token||!/^[0-9a-f]{64}$/.test(token))throw new Error('Missing local launch ticket');
    const target=url(port)+'/?launch='+token;
    if(process.platform==='win32')spawn('cmd',['/c','start','',target],{detached:true,stdio:'ignore'}).unref();
    else if(process.platform==='darwin')spawn('open',[target],{detached:true,stdio:'ignore'}).unref();
    else spawn('xdg-open',[target],{detached:true,stdio:'ignore'}).unref();
  }catch{}
}
// Scan only a small bounded loopback range. Reuse only a service proven to own
// our local session ticket, never navigate to an unrelated process's port.
let selectedPort=null;
for(const candidate of (EXPLICIT_PORT?[PORT]:Array.from({length:10},(_,i)=>PORT+i).filter(p=>p<=65535))){
  const existing=await health(candidate);
  if(existing?.productId===APP_ID&&existing?.version&&existing.version!==EXPECTED){
    console.error(`Đang có AI Project OS v${existing.version} chạy trên cổng ${candidate}. Hãy đóng bản cũ rồi mở lại v${EXPECTED} để tránh dùng nhầm phiên bản.`);
    process.exit(1);
  }
  if(existing?.productId===APP_ID&&existing?.version===EXPECTED){
    const ticket=readLocalSessionTicket({port:candidate,version:EXPECTED});
    if(ticket){console.log(`${APP_NAME} v${EXPECTED} đang chạy trên cổng ${candidate}.`);openBrowser(ticket,candidate);process.exit(0);}
    // No local ownership proof: do not open the browser or reuse this port.
    if(EXPLICIT_PORT){console.error('Dịch vụ hiện tại không có phiên truy cập xác minh. Đóng phiên cũ và mở lại.');process.exit(1);}
    continue;
  }
  if(await portOccupied(candidate)){
    if(EXPLICIT_PORT){console.error(`Cổng ${candidate} đang được chương trình khác sử dụng.`);process.exit(1);}
    continue;
  }
  selectedPort=candidate;break;
}
if(selectedPort===null){console.error('Không tìm thấy cổng local trống trong dải cho phép. Hãy đóng chương trình đang chiếm cổng và thử lại.');process.exit(1);}
console.log(`${APP_NAME}: khởi động trên 127.0.0.1:${selectedPort}`);

const launchToken=crypto.randomBytes(32).toString('hex');
const child=spawn(process.execPath,[path.join(ROOT,'src/server.mjs')],{cwd:ROOT,stdio:'inherit',windowsHide:false,env:{...process.env,AI_PROJECT_OS_PORT:String(selectedPort),AI_PROJECT_OS_LAUNCH_TOKEN:launchToken}});
// Register signal handlers immediately, BEFORE the health poll. Otherwise
// closing the launcher during the first few hundred ms can orphan the Worker.
let stopping=false;
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{stopping=true;try{child.kill(sig)}catch{};const emergency=setTimeout(()=>{try{child.kill('SIGKILL')}catch{}},2000);emergency.unref();});
child.on('exit',code=>process.exit(code??0));
let ready=false;
for(let i=0;i<40;i++){await sleep(250);const h=await health(selectedPort);if(h?.productId===APP_ID&&h?.version===EXPECTED){ready=true;break;}if(child.exitCode!==null)break;}
if(!ready){console.error(`Server không khởi động đúng v${EXPECTED}. Không tự mở trình duyệt.`);try{child.kill()}catch{};process.exitCode=1;}
else if(!stopping)openBrowser(launchToken,selectedPort);
