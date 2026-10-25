import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APP_ID } from '../src/lib/app-identity.mjs';
import { loadUpdatePolicy, validateUpdatePolicy } from '../src/lib/update-policy.mjs';
import { createUpdater, applyPendingUpdate, createZipBuffer, extractZipTo, signManifest, verifyManifest, compareVersions } from '../src/lib/updater.mjs';
const keys = crypto.generateKeyPairSync('ed25519');
const publicKeyPem = keys.publicKey.export({type:'spki',format:'pem'});
const privateKeyPem = keys.privateKey.export({type:'pkcs8',format:'pem'});
const trust = {enabled:true,schemaVersion:1,product:APP_ID,channel:'personal-stable',manifestUrl:'https://personal.example/manifest.json',publicKeyPem};
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'personal-update-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const appRoot=path.join(root,'app'),dataDir=path.join(root,'data');
 fs.mkdirSync(appRoot);fs.mkdirSync(dataDir);
 fs.writeFileSync(path.join(appRoot,'keep.txt'),'original');
 return {root,appRoot,dataDir};
}
function stage(f, files={'keep.txt':'new','added.txt':'new'}) {
 const zip=createZipBuffer(files);
 const manifest=signManifest(privateKeyPem,{channel:trust.channel,version:'1.0.0-personal.2',url:'https://personal.example/package.zip',size:zip.length,sha256:crypto.createHash('sha256').update(zip).digest('hex')});
 fs.mkdirSync(path.join(f.dataDir,'updates'),{recursive:true});
 const file=path.join(f.dataDir,'updates',manifest.version+'.zip');fs.writeFileSync(file,zip);
 const pending={version:manifest.version,file,sha256:manifest.sha256,manifest};
 fs.writeFileSync(path.join(f.dataDir,'pending-update.json'),JSON.stringify(pending));
 return {zip,manifest,pending};
}
const apply=(f,policy=trust)=>applyPendingUpdate({...f,policy,currentVersion:'1.0.0-personal.1'});

test('disabled channel ignores legacy config, environment, restored trust and pending without any network or app writes',async t=>{
 const f=fixture(t);const {pending}=stage(f);delete pending.manifest;
 const pendingFile=path.join(f.dataDir,'pending-update.json');fs.writeFileSync(pendingFile,JSON.stringify(pending));
 fs.writeFileSync(path.join(f.dataDir,'update-config.json'),JSON.stringify({url:'https://github.com/hui-minh-bach/ai-project-os-source/releases/latest/download/update-manifest.json'}));
 fs.writeFileSync(path.join(f.dataDir,'personal-update-trust.json'),JSON.stringify(trust));
 const old=process.env.AIOS_UPDATE_MANIFEST_URL;process.env.AIOS_UPDATE_MANIFEST_URL=trust.manifestUrl;
 t.after(()=>{if(old===undefined)delete process.env.AIOS_UPDATE_MANIFEST_URL;else process.env.AIOS_UPDATE_MANIFEST_URL=old;});
 const before=fs.readFileSync(pendingFile);
 const up=createUpdater({dataDir:f.dataDir,currentVersion:'1.0.0',policy:loadUpdatePolicy(f.appRoot),fetchImpl:()=>{assert.fail('must not fetch');}});
 assert.equal((await up.check()).configured,false);assert.equal((await up.download()).downloaded,false);
 assert.throws(()=>up.setConfig({url:trust.manifestUrl}),{code:'UPDATE_TRUST'});
 assert.equal(up.status().pending.blocked,true);
 assert.equal(applyPendingUpdate(f).reason,'UPDATE_DISABLED');
 assert.deepEqual(fs.readFileSync(pendingFile),before);assert.equal(fs.readFileSync(path.join(f.appRoot,'keep.txt'),'utf8'),'original');
});

test('installation trust must explicitly enable Personal with a distinct Ed25519 key and HTTPS',t=>{
 const f=fixture(t);const filename=path.join(f.appRoot,'personal-update-trust.json');
 fs.writeFileSync(filename,'{broken');assert.equal(loadUpdatePolicy(f.appRoot).enabled,false);
 fs.writeFileSync(filename,JSON.stringify(trust));assert.equal(loadUpdatePolicy(f.appRoot).enabled,true);
 for(const patch of [{product:'ai-project-os'},{channel:'stable'},{manifestUrl:'http://personal.example/x'},{manifestUrl:'https://github.com/hui-minh-bach/ai-project-os-source/x'},
  {publicKeyPem:'-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAzVC63rnj173w3DG62Jc48aC5MxeVVUAmJFCPUSpOuKE=\n-----END PUBLIC KEY-----'}])
  assert.throws(()=>validateUpdatePolicy({...trust,...patch}),{code:'UPDATE_TRUST'});
});

test('legacy pending is rejected even after Personal trust is enabled',t=>{
 const f=fixture(t),{pending}=stage(f);delete pending.manifest;
 fs.writeFileSync(path.join(f.dataDir,'pending-update.json'),JSON.stringify(pending));
 assert.equal(apply(f).reason,'UPDATE_MANIFEST');
 assert.equal(fs.readFileSync(path.join(f.appRoot,'keep.txt'),'utf8'),'original');
});

test('product, channel, URL, size, version and hash are signed; another key cannot authorize updates',t=>{
 const f=fixture(t),{manifest}=stage(f);
 for(const patch of [{product:'ai-project-os'},{channel:'personal-other'},{url:'https://evil.example/x'},{size:1},{version:'9.0.0'},{sha256:'f'.repeat(64)}])
  assert.throws(()=>verifyManifest({...manifest,...patch},publicKeyPem));
 const other=crypto.generateKeyPairSync('ed25519').publicKey;
 assert.throws(()=>verifyManifest(manifest,other),{code:'UPDATE_MANIFEST_SIGNATURE'});
});

test('correctly signed wrong-channel and upstream payload URLs are rejected at apply',t=>{
 for(const patch of [{channel:'personal-other'},{url:'https://github.com/hui-minh-bach/ai-project-os-source/package.zip'},{url:'https://evil.example/package.zip'}]){
  const f=fixture(t),{pending}=stage(f);pending.manifest=signManifest(privateKeyPem,{...pending.manifest,...patch});
  fs.writeFileSync(path.join(f.dataDir,'pending-update.json'),JSON.stringify(pending));
  assert.equal(apply(f).applied,false);assert.equal(fs.readFileSync(path.join(f.appRoot,'keep.txt'),'utf8'),'original');
 }
});

test('apply verifies staged bytes and signature again, refuses downgrade and out-of-staging files',t=>{
 const f=fixture(t);let x=stage(f);
 fs.appendFileSync(x.pending.file,'tamper');assert.equal(apply(f).reason,'UPDATE_HASH');
 x=stage(f);x.pending.manifest.signature='bad';fs.writeFileSync(path.join(f.dataDir,'pending-update.json'),JSON.stringify(x.pending));
 assert.equal(apply(f).reason,'UPDATE_MANIFEST_SIGNATURE');
 x=stage(f);assert.equal(applyPendingUpdate({...f,policy:trust,currentVersion:'2.0.0'}).reason,'UPDATE_VERSION');
 x.pending.file=path.join(f.root,'outside.zip');fs.copyFileSync(path.join(f.dataDir,'updates',x.pending.version+'.zip'),x.pending.file);
 fs.writeFileSync(path.join(f.dataDir,'pending-update.json'),JSON.stringify(x.pending));assert.equal(apply(f).reason,'UPDATE_ZIP_PATH');
});

test('ZIP paths, data, trust file, Windows aliases and case collisions are rejected before app mutation',t=>{
 for(const name of ['../outside','/absolute','C:/evil','.data/projects.json','data/x','.git/config','personal-update-trust.json','.env','src/CON.txt','src/a:stream','src/trailing.']){
  const f=fixture(t);stage(f,{'keep.txt':'new',[name]:'bad'});assert.equal(apply(f).applied,false,name);
  assert.equal(fs.readFileSync(path.join(f.appRoot,'keep.txt'),'utf8'),'original');
 }
 const f=fixture(t);assert.throws(()=>extractZipTo(createZipBuffer({'A.txt':'one','a.txt':'two'}),f.appRoot),{code:'UPDATE_ZIP_PATH'});
});

test('ZIP CRC and symlink traversal are checked before extraction',t=>{
 const f=fixture(t);const buf=createZipBuffer({'keep.txt':'new'});
 const central=buf.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));buf.writeUInt32LE(0,central+16);
 assert.throws(()=>extractZipTo(buf,f.appRoot),{code:'UPDATE_ZIP'});
 if(process.platform!=='win32'){
  fs.symlinkSync(f.dataDir,path.join(f.appRoot,'link'));
  assert.throws(()=>extractZipTo(createZipBuffer({'link/x':'bad'}),f.appRoot),{code:'UPDATE_ZIP_PATH'});
 }
 assert.equal(fs.readFileSync(path.join(f.appRoot,'keep.txt'),'utf8'),'original');
});

test('trusted update applies with backup; an actual mid-write failure rolls back existing and added files',t=>{
 const f=fixture(t);stage(f);const result=apply(f);
 assert.equal(result.applied,true);assert.equal(fs.readFileSync(path.join(result.backupDir,'keep.txt'),'utf8'),'original');
 assert.equal(fs.existsSync(path.join(f.dataDir,'pending-update.json')),false);
 const g=fixture(t);stage(g,{'keep.txt':'changed','added.txt':'new','fail.txt':'new'});
 const write=fs.writeFileSync;
 try {
  fs.writeFileSync=function(file,...args){if(file===path.join(g.appRoot,'fail.txt'))throw new Error('simulated disk write failure');return write.call(this,file,...args);};
  const failed=apply(g);assert.equal(failed.applied,false);assert.equal(failed.reason,'UPDATE_APPLY_FAILED');
 } finally {fs.writeFileSync=write;}
 assert.equal(fs.readFileSync(path.join(g.appRoot,'keep.txt'),'utf8'),'original');assert.equal(fs.existsSync(path.join(g.appRoot,'added.txt')),false);
});

test('download rejects redirects, unsigned transport replacements and oversized bytes',async t=>{
 const f=fixture(t),{manifest,zip}=stage(f);fs.rmSync(path.join(f.dataDir,'pending-update.json'));
 for(const mode of ['redirect','hash','size']){
  const fetchImpl=async(url,opts)=>{
   assert.equal(opts.redirect,'error');
   if(mode==='redirect')return {ok:true,redirected:true,url:'https://evil.example'};
   if(url===trust.manifestUrl)return {ok:true,url,json:async()=>manifest};
   const bytes=mode==='size'?Buffer.concat([zip,Buffer.from('extra')]):Buffer.alloc(zip.length,1);
   return {ok:true,url,body:(async function*(){yield bytes;})()};
  };
  const up=createUpdater({dataDir:f.dataDir,currentVersion:'1.0.0-personal.1',policy:trust,fetchImpl});
  await assert.rejects(up.download(),{code:mode==='redirect'?'UPDATE_FETCH':mode==='hash'?'UPDATE_HASH':'UPDATE_SIZE'});
  assert.equal(fs.existsSync(path.join(f.dataDir,'pending-update.json')),false);
 }
});

test('Personal version ordering distinguishes prerelease revisions',()=>{
 assert.equal(compareVersions('0.9.63-personal.10','0.9.63-personal.2'),1);
 assert.equal(compareVersions('0.9.63','0.9.63-personal.10'),1);
 assert.throws(()=>compareVersions('../evil','1.0.0'),{code:'UPDATE_VERSION'});
});

test('an explicit in-app data directory is protected even with a custom name',t=>{
 const f=fixture(t);f.dataDir=path.join(f.appRoot,'custom-user-data');fs.mkdirSync(f.dataDir);
 fs.writeFileSync(path.join(f.dataDir,'projects.json'),'user data');
 stage(f,{'CUSTOM-USER-DATA/projects.json':'overwrite'});
 assert.equal(apply(f).reason,'UPDATE_ZIP_PATH');
 assert.equal(fs.readFileSync(path.join(f.dataDir,'projects.json'),'utf8'),'user data');
});
