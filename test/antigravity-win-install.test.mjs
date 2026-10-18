import test from 'node:test';
import assert from 'node:assert/strict';
import {installAntigravityWindows,antigravityLauncher} from '../src/lib/antigravity-account.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';

test('WinGet one-click uses only signed package-manager commands, no shell, never runs on other OS',async()=>{
 await assert.rejects(installAntigravityWindows({platform:'linux'}),/Windows/);
 let args=[];
 const result=await installAntigravityWindows({platform:'win32',resolve:()=>{if(args.length)return {command:'C:\\agy.exe'};throw new Error('not installed')},invoke:async(cmd,argv,opts)=>{assert.equal(cmd,'winget.exe');assert.equal(opts.inheritEnv,false);assert.equal(opts.timeoutMs,240000);assert.ok(argv.includes('Google.AntigravityCLI'));assert.equal(argv.includes('--silent'),true);args=argv;return {code:0,timedOut:false};}});
 assert.equal(result.installed,true);
});

test('Windows launcher checks per-user Google and winget locations after process PATH update',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-agy-win-'));const target=path.join(root,'Microsoft','WinGet','Links','agy.exe');try{
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'test');
  const r=antigravityLauncher({platform:'win32',env:{LOCALAPPDATA:root,PATH:''}});
  assert.equal(r.command,target);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('shell supports private prompt over stdin with no command-line secrets',async()=>{
 const {run}=await import('../src/lib/shell.mjs');
 const secret='only-via-stdin-'+Date.now();
 const r=await run(process.execPath,['-e',`process.stdin.setEncoding('utf8');let s='';process.stdin.on('data',v=>s+=v);process.stdin.on('end',()=>process.stdout.write(s));`],{stdin:secret,inheritEnv:false,timeoutMs:10000});
 assert.equal(r.code,0);assert.equal(r.stdout,secret);
 assert.equal(r.stderr,'');
});
