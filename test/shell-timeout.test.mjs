import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/lib/shell.mjs';

const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function procIdentity(stat){const end=stat.lastIndexOf(') '),fields=stat.slice(end+2).split(' ');return {procPid:Number(stat.slice(0,stat.indexOf(' '))),state:fields[0],startTime:fields[19]};}
test('timeout kills a ready grandchild and settles inherited pipes with an honest result', {timeout:8000,skip:process.platform!=='linux'}, async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shell-tree-')),ready=path.join(dir,'ready'),canary=path.join(dir,'canary');let pending,pid,identity;
 try{
  const grandchild=`const fs=require('node:fs');const stat=fs.readFileSync('/proc/self/stat','utf8'),end=stat.lastIndexOf(') '),fields=stat.slice(end+2).split(' ');fs.writeFileSync(${JSON.stringify(ready+'.tmp')},JSON.stringify({pid:process.pid,procPid:Number(stat.slice(0,stat.indexOf(' '))),startTime:fields[19]}));fs.renameSync(${JSON.stringify(ready+'.tmp')},${JSON.stringify(ready)});setInterval(()=>fs.appendFileSync(${JSON.stringify(canary)},'x'),20);setTimeout(()=>{},60000);`;
  const child=`require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'inherit'});`;
  const parent=`require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(child)}],{stdio:'inherit'});`;
  const started=performance.now();pending=run(process.execPath,['-e',parent],{timeoutMs:1800,inheritEnv:false});
  while(!fs.existsSync(ready)&&performance.now()-started<1200)await pause(10);
  assert.ok(fs.existsSync(ready),'grandchild must be running before the timeout fires');identity=JSON.parse(fs.readFileSync(ready,'utf8'));pid=identity.pid;
  // /proc may be mounted from an outer PID namespace. process.pid is only
  // valid for kill() here; the fixture's /proc/self PID identifies its proc entry.
  const running=procIdentity(fs.readFileSync(`/proc/${identity.procPid}/stat`,'utf8'));assert.equal(running.startTime,identity.startTime,'proc entry must identify the ready grandchild');
  const result=await pending;assert.equal(result.timedOut,true);assert.equal(result.code,null);assert.ok(performance.now()-started<4000,'inherited pipes must not keep the command pending for 60s');
  const size=fs.statSync(canary).size;assert.ok(size>0);await pause(150);assert.equal(fs.statSync(canary).size,size,'grandchild must stop writing');
  let observed;try{observed=procIdentity(fs.readFileSync(`/proc/${identity.procPid}/stat`,'utf8'));}catch(error){assert.equal(error.code,'ENOENT');}
  const sameProcess=observed?.startTime===identity.startTime;
  assert.ok(!sameProcess||['Z','X'].includes(observed.state),`descendant must be gone or dead: ${JSON.stringify({identity,observed})}`);
 }finally{if(pid){try{process.kill(pid,'SIGKILL');}catch{}}if(pending)await pending;fs.rmSync(dir,{recursive:true,force:true});}
});

test('bounded shell capture preserves multibyte UTF-8 and filtered environment',async()=>{
 process.env.AIPOS_TIMEOUT_TEST_SECRET='must-not-inherit';
 try{const result=await run(process.execPath,['-e',"process.stdout.write(Buffer.from([0xe2]));setTimeout(()=>process.stdout.write(Buffer.from([0x82,0xac])),10);process.stderr.write(String(process.env.AIPOS_TIMEOUT_TEST_SECRET));"],{inheritEnv:false,timeoutMs:1000});assert.equal(result.stdout,'€');assert.equal(result.stderr,'undefined');assert.equal(result.code,0);assert.equal(result.timedOut,false);}finally{delete process.env.AIPOS_TIMEOUT_TEST_SECRET;}
});
