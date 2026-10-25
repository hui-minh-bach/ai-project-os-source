/** One real HTTP/UI boundary check; no remote model or external service. */
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import net from 'node:net';import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';import {once} from 'node:events';
const ROOT=path.resolve(import.meta.dirname,'..');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;s.close();await once(s,'close');return p;}
test('Authenticated ComfyUI workflow import writes to owned AppData; no external API or unauthorized write',{timeout:40000},async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'aios-comfy-http-'));const dataDir=path.join(temp,'data');
 const port=await freePort(),token=crypto.randomBytes(32).toString('hex'),password='fixture-password-8AZ';
 const env={...process.env,AI_PROJECT_OS_DATA_DIR:dataDir,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_LAUNCH_TOKEN:token};
 const seed=spawnSync(process.execPath,['--input-type=module','-e',`import {unlockVault,lockVault} from './src/lib/vault.mjs';unlockVault(${JSON.stringify(password)});lockVault();`],{cwd:ROOT,env,encoding:'utf8'});
 assert.equal(seed.status,0,seed.stderr);
 const base=`http://127.0.0.1:${port}`,child=spawn(process.execPath,['src/server.mjs'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});let logs='';
 child.stderr.on('data',b=>logs+=b.toString());child.stdout.on('data',b=>logs+=b.toString());
 try{
  let ready=false;for(let i=0;i<70;i++){try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(700)})).ok){ready=true;break;}}catch{}await sleep(100);}
  assert.equal(ready,true,logs.slice(-400));
  const wf={prompt:{'6':{class_type:'CLIPTextEncode',inputs:{text:'A beautiful __AIOS_PROMPT__'}},'8':{class_type:'SaveImage',inputs:{images:['7',0]}}}};
  const request=(cookie,body)=>fetch(base+'/api/free-stack/comfyui/workflow',{method:'POST',headers:{'content-type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  assert.equal((await request(null,{workflow:JSON.stringify(wf)})).status,401);
  const grant=await fetch(base+'/?launch='+token,{redirect:'manual'});assert.equal(grant.status,303);
  const cookie=grant.headers.get('set-cookie').split(';')[0];
  assert.equal((await request(cookie,{workflow:JSON.stringify(wf)})).status,423);
  const unlock=await fetch(base+'/api/vault/unlock',{method:'POST',headers:{Cookie:cookie,'content-type':'application/json'},body:JSON.stringify({password})});assert.equal(unlock.status,200);
  assert.equal((await request(cookie,{workflow:'{bad'})).status,400);
  const ok=await request(cookie,{workflow:JSON.stringify(wf)});assert.equal(ok.status,200);
  const result=await ok.json();assert.equal(result.configured,true);assert.equal(result.nodes,2);
  const managed=path.join(dataDir,'free-stack','comfyui-image-api.json');assert.ok(fs.existsSync(managed));
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(managed,'utf8'))),['6','8']);
  const ui=await fetch(base+'/tabs/engines.html',{headers:{Cookie:cookie}});assert.equal(ui.status,200);assert.match(await ui.text(),/freeStackWorkflowImport/);
 }finally{child.kill('SIGTERM');await Promise.race([once(child,'exit'),sleep(2500)]);if(child.exitCode===null)child.kill('SIGKILL');fs.rmSync(temp,{recursive:true,force:true});}
});
