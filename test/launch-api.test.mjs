/** Real HTTP app, AI protocol fixture, file writes, npm tests and Git merges.
 * No live AI or cloud credentials; cloud HTTP schema is intercepted ONLY in the
 * isolated preloaded child. RUN-WINDOWS never loads the fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {hostNpmInvocation} from '../src/lib/sandbox.mjs';
import {setTimeout as delay} from 'node:timers/promises';
const root=path.resolve(import.meta.dirname,'..');
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;s.close();await once(s,'close');return p;}
async function boot(data,{corrupt=false}={}){const port=await freePort(),base='http://127.0.0.1:'+port,token='a'.repeat(64);fs.mkdirSync(data,{recursive:true});if(corrupt){fs.mkdirSync(path.join(data,'delivery-runs'));fs.writeFileSync(path.join(data,'delivery-runs/runs.json'),'{invalid');}
 const cp=spawn(process.execPath,['--import','./scripts/fixtures/launch-app-preload.mjs','src/server.mjs'],{cwd:root,env:{...process.env,AIOS_DELIVERY_FIXTURE:'1',AI_PROJECT_OS_DATA_DIR:data,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_LAUNCH_TOKEN:token},stdio:['ignore','pipe','pipe']});let log='';cp.stdout.on('data',x=>log+=x);cp.stderr.on('data',x=>log+=x);
 async function stop(){if(cp.exitCode!==null)return;cp.kill('SIGTERM');await Promise.race([once(cp,'exit'),delay(2000)]);if(cp.exitCode===null)cp.kill('SIGKILL');}
 try{let ready=false;for(let i=0;i<100;i++){if(cp.exitCode!==null)throw new Error(log);try{const r=await fetch(base+'/api/health');if(r.ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,'App must start: '+log);
  const login=await fetch(base+'/?launch='+token,{redirect:'manual'});assert.equal(login.status,303);const cookie=login.headers.get('set-cookie').split(';')[0];
  const req=(p,method='GET',body,origin)=>fetch(base+p,{method,headers:{Cookie:cookie,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const id=JSON.parse(fs.readFileSync(path.join(data,'qa-project-id.json'))).id;
  return {base,id,req,stop,log:()=>log};
 }catch(e){await stop();throw e;}}
async function until(app,states){for(let i=0;i<160;i++){const response=await app.req('/api/projects/'+app.id+'/launch');assert.equal(response.status,200);const r=await response.json();if(r&&states.includes(r.state))return r;await delay(100);}throw new Error('Delivery did not reach '+states);}
test('one-button HTTP: idea -> analysis/Council -> consent -> model handoff -> real code/tests/Git -> fixture cloud -> QR/source', {timeout:60000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-delivery-api-'));let app;
 try{app=await boot(path.join(dir,'data'));const {base,id,req}=app,p='/api/projects/'+id+'/launch';
  assert.equal((await fetch(base+'/api/projects')).status,401);
  assert.equal((await req(p,'POST',{},'https://untrusted.invalid')).status,403);
  let response=await req('/api/launch/options','POST',{vercelConnectionId:'v',supabaseConnectionId:'s'});assert.equal(response.status,200);const options=await response.json();assert.ok(options.vercel.find(x=>x.id==='team1'));assert.ok(options.supabase.length);
  response=await req(p,'POST',{vercelConnectionId:'v',teamId:'team1',database:false,target:'preview',testMode:'host'});assert.equal(response.status,202);
  let run=await until(app,['needs-approval','needs-action']);assert.equal(run.state,'needs-approval',JSON.stringify(run.error));assert.equal(run.specification.status,'pending');assert.deepEqual(run.resources,{});
  response=await req(p+'/'+run.id+'/approve','POST',{specificationId:run.specification.id});assert.equal(response.status,409);
  response=await req(p+'/'+run.id+'/approve','POST',{specificationId:run.specification.id,confirmCosts:true,confirmHost:true});assert.equal(response.status,202);
  run=await until(app,['needs-action','delivered']);assert.equal(run.state,'delivered',JSON.stringify(run.error));assert.ok(run.tasks.length>=2);assert.ok(run.tasks.every(t=>t.status==='done'));assert.equal(run.steps.find(s=>s.id==='validate').receipt.finalTest.status,'PASS');assert.equal(run.handoff.userAcceptance,'pending');
  const project=await(await req('/api/projects/'+id)).json();assert.ok(project.tasks.every(t=>t.review.approved&&t.mergeSha));assert.ok(project.tasks.some(t=>t.servedWorkerBinding.connectionId==='ai-b'));assert.ok(project.tasks.every(t=>t.servedReviewerBinding.connectionId==='ai-c'));
  response=await req(p+'/'+run.id+'/artifact/source.zip');assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment/);assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0,4).toString('hex'),'504b0304');
  response=await req(p+'/'+run.id+'/artifact/qr.svg');assert.equal(response.status,200);assert.match(await response.text(),/<svg/);
  const other=await(await req('/api/projects','POST',{name:'Other isolated project',idea:'Do not use this for delivery'})).json();assert.equal((await req('/api/projects/'+other.id+'/launch/'+run.id+'/artifact/source.zip')).status,404);
  response=await req(p+'/'+run.id+'/resume','POST',{});assert.equal(response.status,409,'Completed run must not deploy twice');
  await delay(700);const stats=JSON.parse(fs.readFileSync(path.join(dir,'data/qa-provider-evidence.json')));for(const stage of ['analysis','council-member','council-chair','plan','worker','review'])assert.ok(stats.aiCalls.some(c=>c.stage===stage),'AI stage: '+stage);assert.ok(stats.aiCalls.some(c=>c.model==='fixture-b'));assert.equal(stats.cloudCalls.filter(c=>c.method==='POST'&&c.url.includes('/v13/deployments')).length,1);
  assert.equal((await req('/api/vault/lock','POST',{})).status,200);assert.equal((await req(p)).status,423);assert.equal((await req(p+'/'+run.id+'/artifact/source.zip')).status,423);
  assert.equal((await req('/api/vault/unlock','POST',{password:'fixture-vault-password-not-a-user-secret'})).status,200);assert.equal((await(await req(p)).json()).state,'delivered');
 }finally{if(app)await app.stop();fs.rmSync(dir,{recursive:true,force:true});}
});
test('damaged delivery journal fails closed without taking down other app features',{timeout:20000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-delivery-corrupt-'));let app;try{app=await boot(path.join(dir,'data'),{corrupt:true});assert.equal((await app.req('/api/projects')).status,200);const response=await app.req('/api/projects/'+app.id+'/launch');assert.equal(response.status,503);assert.equal((await response.json()).code,'LAUNCH_STORE');assert.equal(fs.readFileSync(path.join(dir,'data/delivery-runs/runs.json'),'utf8'),'{invalid');}finally{if(app)await app.stop();fs.rmSync(dir,{recursive:true,force:true});}
});

test('Windows npm invocation keeps shell disabled and uses the actual Node/npm JS entry',()=>{const call=hostNpmInvocation({platform:'win32',nodePath:'C:\\Program Files\\nodejs\\node.exe',resolveNpm:()=> 'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js'});assert.ok(call.exe.endsWith('node.exe'));assert.ok(call.prefix[0].endsWith('npm-cli.js'));assert.deepEqual(hostNpmInvocation({platform:'linux'}),{exe:'npm',prefix:[]});});
