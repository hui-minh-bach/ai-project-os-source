/**
 * Local, non-network customer acceptance check. No provider API request and no
 * model tokens are consumed. The optional H.264 smoke test runs only when the
 * user explicitly asks for a detailed diagnostic.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DATA_DIR, BACKUP_DIR } from './store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
function check(id, status, title, description, recommendation = '') {
  return { id, status, title, description, recommendation };
}
function executable(bin, args = ['-version'], timeout = 3500) {
  try {return execFileSync(bin,args,{timeout,encoding:'utf8',maxBuffer:80_000,windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();}
  catch {return null;}
}
function writableFolder(location) {
  const id=crypto.randomUUID(), target=path.join(location,`.aios-doctor-${id}.tmp`);
  try {
    fs.mkdirSync(location,{recursive:true,mode:0o700});
    fs.writeFileSync(target,'AI Project OS write test',{flag:'wx',mode:0o600});
    return fs.readFileSync(target,'utf8')==='AI Project OS write test';
  } catch {return false;}
  finally {try {fs.rmSync(target,{force:true});}catch {}}
}
function availableDisk(folder) {
  try {const s=fs.statfsSync(folder);return Number(s.bavail)*Number(s.bsize);}
  catch{return null;}
}
function smokeScene(ffmpeg, source) {
  try {
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-i',source,
      '-vf',"select='gt(scene,0.35)',showinfo",'-an','-f','null','-'],
      {timeout:12000,windowsHide:true,maxBuffer:100000,stdio:['ignore','pipe','pipe']});
    return true;
  }catch{return false;}
}
function smokeVideo(ffmpeg,ffprobe) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-video-check-'));
  const file=path.join(dir,'smoke.mp4');
  try {
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-y','-f','lavfi','-i','color=c=blue:s=160x90:r=12:d=0.5','-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',file],{timeout:16000,windowsHide:true,maxBuffer:200000,stdio:['ignore','pipe','pipe']});
    const sceneReady=smokeScene(ffmpeg,file);
    const output=execFileSync(ffprobe,['-v','error','-show_entries','stream=codec_name,width,height','-of','json',file],{timeout:7000,windowsHide:true,encoding:'utf8'});
    const result=JSON.parse(output);
    return {encode:result.streams?.some(x=>x.codec_name==='h264'&&x.width===160&&x.height===90)&&fs.statSync(file).size>500,scene:sceneReady};
  }catch{return false;}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
}
export function systemDoctor({dataDir=DATA_DIR,backupDir=BACKUP_DIR,root=ROOT,smoke=true,ffmpegBin='ffmpeg',ffprobeBin='ffprobe',integrationsStatus=null}={}) {
  const checks=[];
  const add=(...args)=>checks.push(check(...args));
  const files=['src/server.mjs','public/index.html','src/launcher.mjs'];
  const filesValid=files.every(f=>fs.existsSync(path.join(root,f)));
  add('files',filesValid?'pass':'fail','Mã chương trình',filesValid?'Đã có đủ tệp khởi động.':'Thiếu tệp ứng dụng.', 'Giải nén lại toàn bộ gói phát hành; không chép từng tệp vá.');
  const major=Number(process.versions.node.split('.')[0]);
  add('node',major>=22?'pass':'fail','Bộ chạy Node.js',`Đang sử dụng Node.js ${process.version}.`, 'Chạy RUN-WINDOWS.cmd để kiểm tra hoặc cài Node.js 22 trở lên.');
  const dataWritable=writableFolder(dataDir);
  add('data',dataWritable?'pass':'fail','Lưu dự án',dataWritable?'Có thể ghi và đọc dữ liệu trên máy.':'Không thể ghi vào thư mục dữ liệu.', 'Chọn tài khoản Windows có quyền ghi dữ liệu, tránh thư mục bị khóa bởi OneDrive/antivirus.');
  const backupWritable=writableFolder(backupDir);
  add('backup',backupWritable?'pass':'fail','Sao lưu',backupWritable?'Có thể tạo tệp sao lưu riêng.':'Thư mục sao lưu không thể ghi.', 'Chọn tài khoản Windows có quyền ghi và sao lưu sang ổ khác.');
  const disk=availableDisk(dataDir);
  add('space',disk===null?'warning':disk<256*1024*1024?'fail':disk<1024*1024*1024?'warning':'pass','Dung lượng ổ đĩa',disk===null?'Không đọc được dung lượng trống.':`Còn ${(disk/1024**3).toFixed(2)} GB trống tại ổ dữ liệu.`, 'Nên có ít nhất 1 GB trống; video dài thường cần nhiều hơn.');
  const ffmpegVer=executable(ffmpegBin);
  const ffprobeVer=executable(ffprobeBin);
  const mediaReady=Boolean(ffmpegVer&&ffprobeVer);
  add('media',mediaReady?'pass':'warning','FFmpeg + FFprobe',mediaReady?'Cả hai công cụ dựng video đều có thể khởi động.':'Chưa tìm thấy FFmpeg và FFprobe trong PATH.', 'Trên Windows chạy INSTALL-VIDEO-TOOLS-WINDOWS.cmd, sau đó khởi động lại ứng dụng.');
  let encodingReady=false,sceneReady=false;
  if(mediaReady&&smoke){const result=smokeVideo(ffmpegBin,ffprobeBin);encodingReady=Boolean(result?.encode);sceneReady=Boolean(result?.scene);}
  add('encode',!mediaReady?'warning':!smoke?'info':encodingReady?'pass':'fail','Xuất video H.264',!mediaReady?'Cần FFmpeg trước khi thử dựng video.':!smoke?'Chưa chạy thử mã hóa (chế độ kiểm tra nhanh).':encodingReady?'Đã tạo và đọc lại MP4 H.264 160×90 bằng FFmpeg thật.':'Có FFmpeg nhưng không thể tạo và đọc lại MP4 H.264.', 'Chọn bản FFmpeg có libx264 + ffprobe; thử lại.');
  add('scene',!mediaReady?'warning':!smoke?'info':sceneReady?'pass':'fail','Phân tích cảnh bằng FFmpeg',!mediaReady?'Cần FFmpeg trước khi phân tích.':!smoke?'Chưa thử bộ lọc phân cảnh (kiểm tra nhanh).':sceneReady?'Bộ lọc select/showinfo chạy được; không cần -vsync.':'Bộ lọc phân cảnh không chạy với FFmpeg hiện tại.', 'Cập nhật FFmpeg chính thức rồi thử kiểm tra lại.');
  const git=executable('git',['--version'],3500);
  add('git',git?'pass':'warning','Git cho AI Team',git?git.split(/\r?\n/)[0]:'Chưa có Git, AI Team không thể thao tác lịch sử mã nguồn.', 'Trên Windows chạy INSTALL-CODE-TOOLS-WINDOWS.cmd.');
  if(integrationsStatus) {
    const active=integrationsStatus?.core?.status==='active';
    add('core',active?'pass':'fail','AI Core',active?'Hàng đợi tác vụ AI Core hoạt động.':'AI Core chưa sẵn sàng.', 'Kiểm tra nhật ký khởi động, Vault và thư mục dữ liệu.');
    add('voice',integrationsStatus?.media?.localTts?.ready?'pass':'info','Giọng đọc local từ kịch bản',integrationsStatus?.media?.localTts?.ready?'Piper và model giọng đã được phát hiện; muốn nghiệm thu cần tạo WAV thật.':'Giọng local qua Concat có sẵn trong giao diện; API Concat 0.2 chưa gọi TTS. Có thể nạp giọng WAV/MP3 từ Concat. Piper offline cần cài thêm nếu muốn tự tạo từ kịch bản.', 'Bật Concat hoặc cài Piper + model hợp pháp, không cần HeyGen API.');
  }
  add('windows',process.platform==='win32'?'info':'warning','Kiểm thử Windows',process.platform==='win32'?'Đang chạy trực tiếp trên Windows; cần thử theo phiếu nghiệm thu cho máy này.':`Đang chạy trên ${process.platform}/${process.arch}; đây không phải bằng chứng đã thử trên Windows.`, 'Chạy bộ nghiệm thu trên máy Windows 10/11 64-bit trước khi giao khách.');
  const count=Object.fromEntries(['pass','warning','fail','info'].map(s=>[s,checks.filter(x=>x.status===s).length]));
  return {version:'0.9.32',timestamp:new Date().toISOString(),checks,count,
    capabilities:{projectManagement:filesValid&&dataWritable,backup:dataWritable&&backupWritable,video:mediaReady&&(smoke?encodingReady:true),aiCore:integrationsStatus?.core?.status==='active'||false,cloudSpeechVerified:false},
    label:'Chỉ kiểm thử cục bộ. Không gọi API AI, không xác nhận các dịch vụ trả phí.'};
}
