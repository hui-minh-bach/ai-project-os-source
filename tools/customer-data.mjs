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
function explain(){console.log(`AI Project OS v0.6 — công cụ dữ liệu khách hàng\n\nDữ liệu: ${DATA_DIR}\nBản sao lưu: ${BACKUP_DIR}\n\nLệnh: backup | list | restore <duong-dan-file.aiosbackup> | migrate`);}
function walkLegacy(source,stage){
  for(const item of fs.readdirSync(source,{withFileTypes:true})){
    const name=item.name;
    if(item.isSymbolicLink())throw new Error('Dữ liệu cũ có symlink; không tự chuyển.');
    if(!/^[-.a-zA-Z0-9_ ]+$/.test(name))throw new Error('Có tên dữ liệu không an toàn; liên hệ quản trị viên.');
    if(name.endsWith('.tmp'))continue;
    const from=path.join(source,name),to=path.join(stage,name);
    if(item.isDirectory()){fs.mkdirSync(to,{recursive:true,mode:0o700});walkLegacy(from,to);}
    else if(item.isFile())fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
  }
}
function migrate(){
  const old=path.resolve(import.meta.dirname,'..','.data');
  if(old===DATA_DIR)throw new Error('Dữ liệu đang được lưu trong thư mục cũ. Không cần di chuyển.');
  if(!fs.existsSync(old)||!fs.readdirSync(old).some(x=>x!=='.gitkeep'))throw new Error('Không tìm thấy dữ liệu cũ để chuyển.');
  if(fs.existsSync(DATA_DIR)&&fs.readdirSync(DATA_DIR).some(x=>x!=='.gitkeep'))throw new Error('Đích đã có dữ liệu. Không ghi đè! Hãy sao lưu trước và nhờ hỗ trợ hợp nhất.');
  const stage=DATA_DIR+'.migration-'+Date.now();
  fs.mkdirSync(stage,{recursive:true,mode:0o700});
  try{walkLegacy(old,stage);fs.rmSync(DATA_DIR,{force:true,recursive:true});fs.renameSync(stage,DATA_DIR);}
  catch(e){fs.rmSync(stage,{force:true,recursive:true});throw e;}
  console.log('Đã sao chép dữ liệu cũ sang:',DATA_DIR,'\nBản gốc vẫn giữ nguyên trong:',old);
}
async function requireStopped(){
  const configuredPort=Number(process.env.AI_PROJECT_OS_PORT||4321);
  if(!Number.isSafeInteger(configuredPort)||configuredPort<1024||configuredPort>65535)throw new Error('AI_PROJECT_OS_PORT không hợp lệ.');
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),1300);
  try{const r=await fetch(`http://127.0.0.1:${configuredPort}/api/health`,{signal:controller.signal});if(r.ok)throw new Error('AI Project OS vẫn đang chạy. Hãy tắt cửa sổ ứng dụng trước.');}
  catch(e){if(e.message?.includes('vẫn đang chạy'))throw e;}finally{clearTimeout(timeout);}
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
    await requireStopped();migrate();
  }else explain();
}catch(e){console.error('KHÔNG THÀNH CÔNG:',e.message);process.exitCode=1;}finally{release();}
