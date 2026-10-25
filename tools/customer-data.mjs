import { APP_NAME, APP_VERSION } from '../src/lib/app-identity.mjs';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { DATA_DIR, BACKUP_DIR } from '../src/lib/store.mjs';
import { createEncryptedBackup, restoreEncryptedBackup, listBackups } from '../src/lib/customer-backup.mjs';
const ACTION=process.argv[2]||'help';
const release=()=>{try{process.stdin.setRawMode(false);}catch{}};
function promptSecret(message){
  if(!process.stdin.isTTY)throw new Error('Chạy trong cửa sổ CMD/Terminal để nhập mật khẩu an toàn.');
  process.stdout.write(message);
  return new Promise((resolve,reject)=>{
    let answer='';process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
    function done(e){process.stdin.removeListener('data',onData);release();process.stdin.pause();process.stdout.write('\n');if(e)reject(e);else resolve(answer);}
    function onData(chunk){for(const char of chunk){const code=char.charCodeAt(0);
      if(code===3){done(new Error('Đã huỷ thao tác.'));return;}
      if(char==='\n'||char==='\r'){done();return;}
      if(code===8||code===127){if(answer.length){answer=answer.slice(0,-1);process.stdout.write('\b \b');}continue;}
      if(code>=32&&answer.length<512){answer+=char;process.stdout.write('*');}
    }}
    process.stdin.on('data',onData);
  });
}
function explain(){console.log(`${APP_NAME} v${APP_VERSION} — công cụ dữ liệu\n\nDữ liệu: ${DATA_DIR}\nBản sao lưu: ${BACKUP_DIR}\n\nLệnh: backup | list | restore <duong-dan-file.aiosbackup> | migrate`);}
async function requireStopped(){
  const configuredPort=Number(process.env.AI_PROJECT_OS_PORT||4321);
  if(!Number.isSafeInteger(configuredPort)||configuredPort<1024||configuredPort>65535)throw new Error('AI_PROJECT_OS_PORT không hợp lệ.');
  const ports = process.env.AI_PROJECT_OS_PORT ? [configuredPort] : Array.from({length:10},(_,i)=>configuredPort+i);
  for (const port of ports) {
    try { const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1300)});
      if(r.ok)throw new Error('AI Project OS vẫn đang chạy. Hãy tắt cả bản gốc và Personal trước khi thao tác dữ liệu.');
    } catch(e) { if(e.message?.includes('vẫn đang chạy'))throw e; }
  }
}
try{
  if(ACTION==='list'){explain();const backups=listBackups();for(const b of backups)console.log(b.name,Math.round(b.size/1024)+' KB');}
  else if(ACTION==='backup'){
    await requireStopped();const first=await promptSecret('Mật khẩu MỚI cho bản sao lưu (ít nhất 12 ký tự): ');
    const second=await promptSecret('Nhập lại mật khẩu: ');if(first!==second)throw new Error('Hai mật khẩu không khớp.');
    const b=await createEncryptedBackup({password:first});console.log(`Sao lưu thành công: ${path.join(BACKUP_DIR,b.name)} (${b.files} file)`);
  }else if(ACTION==='restore'){
    await requireStopped();const file=process.argv[3];if(!file||!fs.existsSync(file))throw new Error('Hãy kéo thả file .aiosbackup vào sau lệnh khôi phục.');
    console.log('LƯU Ý: dữ liệu hiện có được dời sang một thư mục rollback riêng, KHÔNG xóa.');
    const confirm=await promptSecret('Gõ CHAPNHAN để khôi phục: ');
    if(confirm!=='CHAPNHAN')throw new Error('Đã huỷ; xác nhận không chính xác.');
    const password=await promptSecret('Mật khẩu bản sao lưu: ');
    const result=await restoreEncryptedBackup({file,password});
    console.log('Phục hồi thành công:',result.files,'file. Dữ liệu cũ:',result.rollback||'chưa có');
  }else if(ACTION==='migrate'){
    throw new Error('Personal không tự sao chép dữ liệu bản gốc. Hãy tạo .aiosbackup bằng bản gốc, đóng ứng dụng, rồi dùng restore <file.aiosbackup> tại Personal; dữ liệu đích được giữ để rollback.');
  }else explain();
}catch(e){console.error('KHÔNG THÀNH CÔNG:',e.message);process.exitCode=1;}finally{release();}
