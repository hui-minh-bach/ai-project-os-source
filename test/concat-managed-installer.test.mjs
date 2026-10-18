import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  CONCAT_RELEASE, installedCandidates,findInstalledConcat, concatInstallStatus,
  enableConcatRemote, configPath,verifyPinnedSetup,sha256Of,provisionConcat,acquireVerifiedSetup
} from '../src/lib/concat-managed.mjs';
const sandbox=()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-concat-bundle-test-'));return {dir,env:{LOCALAPPDATA:path.join(dir,'local'),APPDATA:path.join(dir,'roaming'),ProgramFiles:path.join(dir,'programfiles')},done:()=>fs.rmSync(dir,{recursive:true,force:true})}};
test('release is pinned to Concat 0.2.7 and known GitHub SHA',()=>{
 assert.equal(CONCAT_RELEASE.version,'0.2.7');assert.equal(CONCAT_RELEASE.bytes,84783443);
 assert.equal(CONCAT_RELEASE.sha256,'305e833449c24c234c935244debd339a4ba25866fe5787c744f374c7ee5b9687');
 assert.match(CONCAT_RELEASE.url,/^https:\/\/github\.com\/jub0t\/Concat\/releases\/download\//);
});
test('Windows default location is detected without guessing arbitrary binaries',()=>{
 const s=sandbox();try{
  assert.equal(findInstalledConcat(s.env),null);
  const exe=installedCandidates(s.env)[0];fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,'exe-test');
  assert.equal(findInstalledConcat(s.env),exe);
  assert.equal(concatInstallStatus({root:s.dir,env:s.env,platform:'win32'}).installed,true);
 }finally{s.done()}
});
test('Concat config is preserved, backed up and remote is loopback-only',()=>{
 const s=sandbox();try{
  const f=configPath(s.env);fs.mkdirSync(path.dirname(f),{recursive:true});
  fs.writeFileSync(f,JSON.stringify({dark:true,locale:'vi',server:{enabled:false,listen:'0.0.0.0:7420',token:'old'}}));
  const token='a'.repeat(48);const installed=enableConcatRemote({env:s.env,token});
  assert.equal(installed.token,token);
  const data=JSON.parse(fs.readFileSync(f,'utf8'));
  assert.equal(data.dark,true);assert.equal(data.locale,'vi');
  assert.equal(data.server.enabled,true);assert.equal(data.server.listen,'127.0.0.1:7420');
  assert.equal(data.server.token,token);
  assert.equal(JSON.parse(fs.readFileSync(f+'.aios-before-managed.bak')).server.enabled,false);
  enableConcatRemote({env:s.env,token:'b'.repeat(48)});
  assert.equal(JSON.parse(fs.readFileSync(f+'.aios-before-managed.bak')).server.token,'old');
 }finally{s.done()}
});
test('Malformed Concat preferences are never overwritten',()=>{
 const s=sandbox();try{const f=configPath(s.env);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,'{broken');
  assert.throws(()=>enableConcatRemote({env:s.env}),/invalid/);assert.equal(fs.readFileSync(f,'utf8'),'{broken');
 }finally{s.done()}
});
test('Existing Concat can be configured/started offline without downloading or exposing the token',async()=>{
 const s=sandbox();try{
  const exe=path.join(s.env.LOCALAPPDATA,'Programs','Concat','concat.exe');fs.mkdirSync(path.dirname(exe),{recursive:true});fs.writeFileSync(exe,'binary-not-executed');
  let installerCalls=0,launches=[];
  const r=await provisionConcat({root:s.dir,env:s.env,platform:'win32',runningImpl:()=>false,installerImpl:()=>{installerCalls++},launcherImpl:f=>launches.push(f)});
  assert.equal(r.installed,true);assert.equal(installerCalls,0);assert.deepEqual(launches,[exe]);
  assert.match(r.token,/^[a-f0-9]{48}$/);
  assert.equal(JSON.parse(fs.readFileSync(configPath(s.env))).server.token,r.token);
 }finally{s.done()}
});
test('Will not modify running editor or launch on Linux',async()=>{
 const s=sandbox();try{
  await assert.rejects(()=>provisionConcat({root:s.dir,env:s.env,platform:'linux'}),/Windows x64/);
  await assert.rejects(()=>provisionConcat({root:s.dir,env:s.env,platform:'win32',runningImpl:()=>true}),/Concat đang mở/);
  assert.equal(fs.existsSync(configPath(s.env)),false);
 }finally{s.done()}
});
test('Bundled but corrupted installer is not trusted',async()=>{
 const s=sandbox();try{
  const f=path.join(s.dir,'vendor','concat',CONCAT_RELEASE.filename);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,'not a valid setup');
  assert.equal(verifyPinnedSetup(f),false);
  await assert.rejects(()=>acquireVerifiedSetup({root:s.dir,env:s.env,downloadImpl:async()=>{throw Error('unexpected download')}}),/untrusted/);
 }finally{s.done()}
});
test('Hash helper verifies exact bytes',()=>{
 const s=sandbox();try{const f=path.join(s.dir,'x');fs.writeFileSync(f,'hello');assert.equal(sha256Of(f),crypto.createHash('sha256').update('hello').digest('hex'))}finally{s.done()}
});
