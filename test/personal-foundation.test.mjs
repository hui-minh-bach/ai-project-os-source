import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { APP_ID, APP_NAME, APP_VERSION, personalDataDir } from '../src/lib/app-identity.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

test('one Personal identity is consistent across release, package, server, launcher and UI',()=>{
 const release=JSON.parse(read('RELEASE.json')),pkg=JSON.parse(read('package.json'));
 assert.equal(release.productId,APP_ID);assert.equal(release.product,APP_NAME);
 assert.equal(release.version,APP_VERSION);assert.equal(pkg.version,APP_VERSION);assert.equal(pkg.name,APP_ID);
 assert.match(read('src/server.mjs'),/VERSION=APP_VERSION/);
 assert.ok(read('src/launcher.mjs').indexOf('const EXPECTED=')>read('src/launcher.mjs').indexOf('const r=applyPendingUpdate'));
 assert.match(read('tools/windows-launcher/main.go'),/version := identity.Version/);
 assert.match(read('tools/windows-launcher/main.go'),/AIProjectOSPersonal/);
 assert.ok(read('public/index.html').includes(APP_NAME));assert.ok(read('public/index.html').includes('{{APP_VERSION}}'));
 assert.equal(release.personalEdition.windowsPortableBuilt,false);
});

test('per-user default directories differ from original on Windows, macOS and Linux',()=>{
 assert.equal(personalDataDir({platform:'win32',home:'C:\\Users\\PO',env:{LOCALAPPDATA:'C:\\Users\\PO\\AppData\\Local'}}),'C:\\Users\\PO\\AppData\\Local\\AIProjectOSPersonal\\data');
 assert.equal(personalDataDir({platform:'darwin',home:'/Users/po',env:{}}),'/Users/po/Library/Application Support/AIProjectOSPersonal/data');
 assert.equal(personalDataDir({platform:'linux',home:'/home/po',env:{}}),'/home/po/.local/share/AIProjectOSPersonal/data');
 assert.equal(personalDataDir({platform:'linux',home:'/home/po',env:{XDG_DATA_HOME:'/custom'}}),'/custom/AIProjectOSPersonal/data');
 assert.throws(()=>personalDataDir({platform:'win32',env:{AI_PROJECT_OS_DATA_DIR:'C:\\Users\\PO\\AppData\\Local\\AIProjectOSLocal\\data'}}));
 assert.throws(()=>personalDataDir({env:{AI_PROJECT_OS_DATA_DIR:'relative'}}));
});

test('clean Personal storage leaves original projects, credentials, workspaces and backups byte-for-byte intact',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'personal-data-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const original=path.join(root,'AIProjectOSLocal','data'),dataDir=path.join(root,'AIProjectOSPersonal','data');
 const files=['projects.json','vault.enc.json','workspaces/p/file.txt','backups/old.aiosbackup','pending-update.json'];
 for(const f of files){const dest=path.join(original,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,'original '+f);}
 const script="const s=await import('./src/lib/store.mjs');s.writeJson('projects.json',[]);console.log(JSON.stringify({dir:s.DATA_DIR,backup:s.BACKUP_DIR,projects:s.readJson('projects.json',null)}));";
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:ROOT,encoding:'utf8',env:{...process.env,AI_PROJECT_OS_PERSONAL_DATA_DIR:dataDir,AI_PROJECT_OS_PERSONAL_BACKUP_DIR:path.join(root,'AIProjectOSPersonal','backups')}});
 assert.equal(result.status,0,result.stderr);const j=JSON.parse(result.stdout);assert.equal(j.dir,dataDir);assert.deepEqual(j.projects,[]);
 for(const f of files)assert.equal(fs.readFileSync(path.join(original,f),'utf8'),'original '+f);
 assert.equal(fs.existsSync(path.join(dataDir,'vault.enc.json')),false);
 assert.equal(fs.existsSync(path.join(dataDir,'pending-update.json')),false);
});

test('session ticket and cookie from original edition cannot authorize Personal',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'personal-session-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const script=`const {createLocalAccess,readLocalSessionTicket}=await import('./src/lib/local-access.mjs');
 const fs=await import('node:fs');const path=await import('node:path');
 const data=process.env.AI_PROJECT_OS_PERSONAL_DATA_DIR;fs.mkdirSync(path.join(path.dirname(data),'run'),{recursive:true});
 fs.writeFileSync(path.join(path.dirname(data),'run','session-54321.json'),JSON.stringify({port:54321,version:'${APP_VERSION}',pid:process.pid,token:'a'.repeat(64)}));
 const a=createLocalAccess({port:54321,version:'${APP_VERSION}'});let cookie;
 a.grant({writeHead(code,h){cookie=h['set-cookie'].split(';')[0]},end(){}});
 console.log(JSON.stringify({ticket:readLocalSessionTicket({port:54321,version:'${APP_VERSION}'}),cookie,legacy:a.validSession({headers:{cookie:cookie.replace('aios_personal_session','aios_session')}})}));`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:ROOT,encoding:'utf8',env:{...process.env,AI_PROJECT_OS_PERSONAL_DATA_DIR:path.join(root,'data')}});
 assert.equal(r.status,0,r.stderr);const j=JSON.parse(r.stdout);assert.equal(j.ticket,null);assert.equal(j.legacy,false);assert.match(j.cookie,/^aios_personal_session=/);
});

test('explicit encrypted import preserves source and destination rollback; restored upstream pending remains blocked',async t=>{
 const {createEncryptedBackup,restoreEncryptedBackup}=await import('../src/lib/customer-backup.mjs');
 const {applyPendingUpdate}=await import('../src/lib/updater.mjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'personal-import-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const original=path.join(root,'original'),personal=path.join(root,'personal'),backups=path.join(root,'archives'),appRoot=path.join(root,'app');
 for(const dir of [original,personal,appRoot])fs.mkdirSync(dir);
 fs.writeFileSync(path.join(original,'projects.json'),'[{"id":"legacy"}]');
 fs.writeFileSync(path.join(original,'vault.enc.json'),'encrypted-fixture');
 const pending=JSON.stringify({version:'99.0.0',file:'old-upstream.zip',sha256:'0'.repeat(64)});
 fs.writeFileSync(path.join(original,'pending-update.json'),pending);
 fs.writeFileSync(path.join(personal,'projects.json'),'[{"id":"personal-before"}]');
 const password='personal-import-fixture-password';
 const backup=await createEncryptedBackup({password,dataDir:original,backupDir:backups});
 const result=await restoreEncryptedBackup({password,file:path.join(backups,backup.name),dataDir:personal});
 assert.equal(fs.readFileSync(path.join(original,'projects.json'),'utf8'),'[{"id":"legacy"}]');
 assert.equal(fs.readFileSync(path.join(personal,'projects.json'),'utf8'),'[{"id":"legacy"}]');
 assert.equal(fs.readFileSync(path.join(result.rollback,'projects.json'),'utf8'),'[{"id":"personal-before"}]');
 assert.equal(fs.readFileSync(path.join(personal,'vault.enc.json'),'utf8'),'encrypted-fixture');
 assert.equal(applyPendingUpdate({appRoot,dataDir:personal}).reason,'UPDATE_DISABLED');
 assert.equal(fs.readFileSync(path.join(personal,'pending-update.json'),'utf8'),pending);
});
