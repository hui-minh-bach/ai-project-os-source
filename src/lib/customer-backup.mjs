/** AI Project OS customer-data backup (password-encrypted, streamed, authenticated).
 * .aiosbackup = 8-byte magic + 16-byte salt + 12-byte nonce + gzip(AES-GCM ciphertext) + 16-byte tag.
 * The compressed plaintext stream starts with 4-byte BE manifest JSON length, manifest,
 * followed by the declared file bytes in manifest order. Never extract untrusted archive paths.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DATA_DIR, BACKUP_DIR } from './store.mjs';

const MAGIC=Buffer.from('AIOSBKP1','ascii');
const MAX_FILES=60000;
const MAX_BYTES=8*1024*1024*1024;
const MAX_MANIFEST=8*1024*1024;
const utf8=x=>Buffer.from(JSON.stringify(x),'utf8');
function key(password,salt){
  if(typeof password!=='string'||password.length<12||password.length>512)throw new Error('Mật khẩu bản sao lưu phải có 12-512 ký tự.');
  return crypto.scryptSync(password,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
}
function safeRelative(name){
  if(typeof name!=='string'||name.length>1000||!name||name.includes('\\')||name.startsWith('/')||name.includes('\0'))throw new Error('Đường dẫn không hợp lệ trong bản sao lưu.');
  const parts=name.split('/');
  if(parts.some(s=>!s||s==='.'||s==='..'||/[<>:"|?*]/.test(s)||/[. ]$/.test(s)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)))throw new Error('Đường dẫn nguy hiểm hoặc không tương thích Windows.');
  return name;
}
const hashFile=async file=>{
  const h=crypto.createHash('sha256');let size=0;
  for await(const b of fs.createReadStream(file)){h.update(b);size+=b.length;}
  return {sha256:h.digest('hex'),size};
};
function enumerate(dir){
  const files=[];let bytes=0;
  function visit(folder,segments=[]){
    for(const item of fs.readdirSync(folder,{withFileTypes:true})){
      if(item.isSymbolicLink())throw new Error('Không sao lưu symlink trong thư mục dữ liệu.');
      const parts=[...segments,item.name],rel=safeRelative(parts.join('/'));
      const full=path.join(folder,item.name);
      if(item.isDirectory())visit(full,parts);
      else if(item.isFile()){
        if(/\.tmp$/i.test(item.name))continue;
        const stat=fs.statSync(full);bytes+=stat.size;
        if(files.length>=MAX_FILES||bytes>MAX_BYTES)throw new Error('Dữ liệu vượt giới hạn an toàn của công cụ sao lưu.');
        files.push({name:rel,source:full});
      }
    }
  }
  if(fs.existsSync(dir))visit(dir);
  files.sort((a,b)=>a.name.localeCompare(b.name,'en'));
  return files;
}
export function listBackups(backupDir=BACKUP_DIR){
  if(!fs.existsSync(backupDir))return [];
  return fs.readdirSync(backupDir,{withFileTypes:true}).filter(x=>x.isFile()&&/^AIOS_\d{8}T\d{6}_[a-f0-9]{8}\.aiosbackup$/.test(x.name))
    .map(x=>({name:x.name,size:fs.statSync(path.join(backupDir,x.name)).size})).sort((a,b)=>b.name.localeCompare(a.name));
}
export function backupFileByName(name,backupDir=BACKUP_DIR){
  if(typeof name!=='string'||!/^AIOS_\d{8}T\d{6}_[a-f0-9]{8}\.aiosbackup$/.test(name))throw new Error('Tên bản sao lưu không hợp lệ.');
  const dest=path.join(backupDir,name);if(!fs.existsSync(dest)||!fs.statSync(dest).isFile())throw new Error('Không tìm thấy bản sao lưu.');
  return dest;
}
export async function createEncryptedBackup({password,dataDir=DATA_DIR,backupDir=BACKUP_DIR}={}){
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),secret=key(password,salt);
  const files=enumerate(dataDir),entries=[];
  let totalBytes=0;
  for(const item of files){const meta=await hashFile(item.source);totalBytes+=meta.size;entries.push({path:item.name,size:meta.size,sha256:meta.sha256});}
  const manifest={format:'AIOSBKP1',app:'AI Project OS Local',createdAt:new Date().toISOString(),files:entries};
  const header=utf8(manifest);
  if(header.length>MAX_MANIFEST)throw new Error('Quá nhiều file dữ liệu để sao lưu.');
  const len=Buffer.alloc(4);len.writeUInt32BE(header.length);
  const cipher=crypto.createCipheriv('aes-256-gcm',secret,iv);
  fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
  if(path.resolve(backupDir)===path.resolve(dataDir)||path.resolve(backupDir).startsWith(path.resolve(dataDir)+path.sep))throw new Error('Không đặt backup bên trong thư mục dữ liệu.');
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\..*$/,'');
  const name=`AIOS_${stamp}_${crypto.randomBytes(4).toString('hex')}.aiosbackup`;
  const target=path.join(backupDir,name),tmp=target+'.tmp';
  fs.writeFileSync(tmp,Buffer.concat([MAGIC,salt,iv]),{flag:'wx',mode:0o600});
  async function* content(){
    yield len;yield header;
    for(let i=0;i<files.length;i++){
      let read=0,hash=crypto.createHash('sha256');
      for await(const chunk of fs.createReadStream(files[i].source)){read+=chunk.length;hash.update(chunk);yield chunk;}
      if(read!==entries[i].size||hash.digest('hex')!==entries[i].sha256)throw new Error('File đã bị thay đổi trong lúc sao lưu; hãy đóng tác vụ và thử lại.');
    }
  }
  try{
    await pipeline(Readable.from(content()),zlib.createGzip({level:6}),cipher,fs.createWriteStream(tmp,{flags:'a'}));
    fs.appendFileSync(tmp,cipher.getAuthTag());
    fs.renameSync(tmp,target);
    return {name,size:fs.statSync(target).size,files:entries.length,totalBytes,encrypted:true};
  }finally{try{fs.rmSync(tmp,{force:true})}catch{}}
}
function validateManifest(manifest){
  if(!manifest||manifest.format!=='AIOSBKP1'||!Array.isArray(manifest.files)||manifest.files.length>MAX_FILES)throw new Error('Bản backup không đúng định dạng.');
  let total=0;const names=new Set();
  for(const f of manifest.files){safeRelative(f.path);
    if(names.has(f.path)||!Number.isSafeInteger(f.size)||f.size<0||!/^[a-f0-9]{64}$/.test(f.sha256))throw new Error('Danh sách file backup không hợp lệ.');
    names.add(f.path);total+=f.size;if(total>MAX_BYTES)throw new Error('Backup vượt giới hạn giải nén.');
  }
  return manifest.files;
}
class ArchiveParser extends Transform {
  constructor({destination}){super();this.destination=destination;this.buffer=Buffer.alloc(0);this.expected=null;this.files=null;this.current=0;this.remaining=0;this.fd=null;this.hash=null;this.accepted=0;}
  _open(){
    const f=this.files[this.current];if(!f)return;
    const dest=path.join(this.destination,...f.path.split('/'));
    fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});
    this.fd=fs.openSync(dest,'wx',0o600);this.remaining=f.size;this.hash=crypto.createHash('sha256');
  }
  _close(){
    const f=this.files[this.current];if(this.hash.digest('hex')!==f.sha256)throw new Error('SHA-256 dữ liệu backup không khớp.');
    fs.closeSync(this.fd);this.fd=null;this.current++;this.hash=null;this.accepted++;
  }
  _transform(chunk,enc,cb){
    try{
      let pos=0;
      while(pos<chunk.length||this.files&&this.current<this.files.length&&this.remaining===0){
        if(!this.files){
          if(this.expected===null){
            const need=4-this.buffer.length,take=Math.min(need,chunk.length-pos);
            this.buffer=Buffer.concat([this.buffer,chunk.subarray(pos,pos+take)]);pos+=take;
            if(this.buffer.length<4)break;
            this.expected=this.buffer.readUInt32BE(0);this.buffer=Buffer.alloc(0);
            if(this.expected>MAX_MANIFEST||this.expected<10)throw new Error('Đầu mục backup quá lớn hoặc không hợp lệ.');
          }
          const need=this.expected-this.buffer.length,take=Math.min(need,chunk.length-pos);
          this.buffer=Buffer.concat([this.buffer,chunk.subarray(pos,pos+take)]);pos+=take;
          if(this.buffer.length!==this.expected)break;
          this.files=validateManifest(JSON.parse(this.buffer.toString('utf8')));this.buffer=Buffer.alloc(0);
          if(this.files.length)this._open();continue;
        }
        if(this.current===this.files.length){if(pos<chunk.length)throw new Error('Backup có dữ liệu dư ngoài manifest.');break;}
        if(this.remaining===0){this._close();if(this.current<this.files.length)this._open();continue;}
        const take=Math.min(this.remaining,chunk.length-pos);
        if(take===0)break;
        const b=chunk.subarray(pos,pos+take);fs.writeSync(this.fd,b);this.hash.update(b);this.remaining-=take;pos+=take;
      }
      cb();
    }catch(e){if(this.fd!==null){fs.closeSync(this.fd);this.fd=null;}cb(e);}
  }
  _flush(cb){
    try{
      while(this.files&&this.current<this.files.length&&this.remaining===0){this._close();if(this.current<this.files.length)this._open();}
      if(!this.files||this.current!==this.files.length)throw new Error('Bản backup bị cắt hoặc chưa đủ file.');
      cb();
    }catch(e){if(this.fd!==null){fs.closeSync(this.fd);this.fd=null;}cb(e);}
  }
}
export async function restoreEncryptedBackup({file,password,dataDir=DATA_DIR}={}){
  if(!file||!fs.existsSync(file))throw new Error('Không tìm thấy file sao lưu.');
  const st=fs.statSync(file);
  if(!st.isFile()||st.size<54)throw new Error('Tệp sao lưu không hợp lệ.');
  const fd=fs.openSync(file,'r'),head=Buffer.alloc(36),tag=Buffer.alloc(16);
  try{fs.readSync(fd,head,0,36,0);fs.readSync(fd,tag,0,16,st.size-16);}finally{fs.closeSync(fd);}
  if(!head.subarray(0,8).equals(MAGIC))throw new Error('Không đúng định dạng AIOSBKP1.');
  const keyBytes=key(password,head.subarray(8,24));
  const decipher=crypto.createDecipheriv('aes-256-gcm',keyBytes,head.subarray(24,36));decipher.setAuthTag(tag);
  const root=path.dirname(dataDir);fs.mkdirSync(root,{recursive:true});
  const stage=path.join(root,`.aios-restore-${crypto.randomUUID()}`);fs.mkdirSync(stage,{mode:0o700});
  const parser=new ArchiveParser({destination:stage});
  try{
    await pipeline(fs.createReadStream(file,{start:36,end:st.size-17}),decipher,zlib.createGunzip(),parser);
    const rollback=dataDir+`.before-restore-${new Date().toISOString().replace(/[^0-9T]/g,'').slice(0,15)}`;
    let moved=false;
    try{
      if(fs.existsSync(dataDir)){if(fs.existsSync(rollback))throw new Error('Thư mục rollback trùng.');fs.renameSync(dataDir,rollback);moved=true;}
      fs.renameSync(stage,dataDir);
    }catch(e){if(moved&&!fs.existsSync(dataDir))fs.renameSync(rollback,dataDir);throw e;}
    return {ok:true,files:parser.accepted,rollback:moved?rollback:null,dataDir};
  }finally{if(fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});}
}
