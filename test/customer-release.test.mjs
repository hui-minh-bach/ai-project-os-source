import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEncryptedBackup, restoreEncryptedBackup, listBackups, backupFileByName } from '../src/lib/customer-backup.mjs';

const fixture=()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-customer-'));
  return {dir,dataDir:path.join(dir,'data'),backupDir:path.join(dir,'backups'),destroy:()=>fs.rmSync(dir,{force:true,recursive:true})};
};
const PASSWORD='test! customer backup. 2026';

test('customer backup: encrypted, restores exact bytes, keeps previous live state for rollback',async()=>{
  const f=fixture();
  try{
    fs.mkdirSync(path.join(f.dataDir,'workspaces','project-1'),{recursive:true});
    fs.writeFileSync(path.join(f.dataDir,'projects.json'),'[{"name":"dự án người dùng"}]');
    fs.writeFileSync(path.join(f.dataDir,'workspaces','project-1','video.mp4'),Buffer.concat([Buffer.from('FAKEVIDEO'),Buffer.alloc(99000,0x1b)]));
    fs.writeFileSync(path.join(f.dataDir,'vault.enc.json'),'encrypted-vault-fixture');
    const backup=await createEncryptedBackup({...f,password:PASSWORD});
    assert.equal(backup.files,3);assert.equal(listBackups(f.backupDir).length,1);
    const archive=fs.readFileSync(backupFileByName(backup.name,f.backupDir));
    assert.equal(archive.subarray(0,8).toString(),'AIOSBKP1');
    assert.ok(!archive.includes(Buffer.from('dự án người dùng')),'backup must not reveal customer project');
    const expected=fs.readFileSync(path.join(f.dataDir,'workspaces','project-1','video.mp4'));
    fs.writeFileSync(path.join(f.dataDir,'projects.json'),'changed after backup');
    const restored=await restoreEncryptedBackup({file:backupFileByName(backup.name,f.backupDir),password:PASSWORD,dataDir:f.dataDir});
    assert.equal(restored.files,3);
    assert.equal(fs.readFileSync(path.join(f.dataDir,'projects.json'),'utf8'),'[{"name":"dự án người dùng"}]');
    assert.deepEqual(fs.readFileSync(path.join(f.dataDir,'workspaces','project-1','video.mp4')),expected);
    assert.equal(fs.readFileSync(path.join(restored.rollback,'projects.json'),'utf8'),'changed after backup');
  }finally{f.destroy();}
});

test('wrong password / tampered encrypted file cannot replace existing customer data',async()=>{
  const f=fixture();
  try{
    fs.mkdirSync(f.dataDir,{recursive:true});fs.writeFileSync(path.join(f.dataDir,'projects.json'),'original');
    const backup=await createEncryptedBackup({...f,password:PASSWORD});
    const file=backupFileByName(backup.name,f.backupDir);
    fs.writeFileSync(path.join(f.dataDir,'projects.json'),'newer changes');
    await assert.rejects(()=>restoreEncryptedBackup({file,password:'not the right password',dataDir:f.dataDir}));
    assert.equal(fs.readFileSync(path.join(f.dataDir,'projects.json'),'utf8'),'newer changes');
    const copy=path.join(f.dir,'modified.aiosbackup');const bytes=fs.readFileSync(file);bytes[46]^=0x80;fs.writeFileSync(copy,bytes);
    await assert.rejects(()=>restoreEncryptedBackup({file:copy,password:PASSWORD,dataDir:f.dataDir}));
    assert.equal(fs.readFileSync(path.join(f.dataDir,'projects.json'),'utf8'),'newer changes');
    assert.ok(!fs.readdirSync(f.dir).some(n=>n.startsWith('.aios-restore')));
  }finally{f.destroy();}
});

test('backup rejects symlink traversal and verifies download names',async()=>{
  const f=fixture();try{
    fs.mkdirSync(f.dataDir,{recursive:true});fs.symlinkSync('/etc/passwd',path.join(f.dataDir,'secret'));
    await assert.rejects(()=>createEncryptedBackup({...f,password:PASSWORD}),/symlink/);
    assert.throws(()=>backupFileByName('../secret.aiosbackup',f.backupDir));
  }finally{f.destroy();}
});

test('customer backup refuses too-short password',async()=>{
  const f=fixture();try{await assert.rejects(()=>createEncryptedBackup({...f,password:'short'}),/12-512/);}finally{f.destroy();}
});
