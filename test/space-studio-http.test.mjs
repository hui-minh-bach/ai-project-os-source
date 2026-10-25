/** Real isolated local server; fake credentials and local fixtures only. */
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import net from 'node:net';import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';import {once} from 'node:events';
const ROOT=path.resolve(import.meta.dirname,'..'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;s.close();await once(s,'close');return p;}
test('R3 full HTTP roster authenticates, follows accounts/tasks, excludes secrets and never calls providers',async t=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'aios-r3-http-')),dataDir=path.join(tmp,'data'),p=await port(),token=crypto.randomBytes(32).toString('hex');
 const password='synthetic-r3-fixture-password',secret='synthetic-local-only-no-valid-key';
 const env={...process.env,AI_PROJECT_OS_DATA_DIR:dataDir,AI_PROJECT_OS_BACKUP_DIR:path.join(tmp,'backups'),AI_PROJECT_OS_PORT:String(p),AI_PROJECT_OS_LAUNCH_TOKEN:token};
 const seed=spawnSync(process.execPath,['--input-type=module','-e',`
  import {unlockVault,saveConnection,lockVault} from './src/lib/vault.mjs';
  import {recordModels} from './src/lib/model-bindings.mjs';import {writeJson} from './src/lib/store.mjs';
  unlockVault(${JSON.stringify(password)});const ids=[];
  for(let i=0;i<12;i++){const c=saveConnection({kind:'openai_compatible',name:i===2?'<img src=x onerror=alert(1)>':'Fixture '+i,model:'fixture-model',secret:${JSON.stringify(secret)},baseUrl:'http://127.0.0.1:1/v1'});recordModels(c,['fixture-model']);ids.push(c.id);}
  saveConnection({kind:'other',name:'Not an AI',secret:'fixture-non-ai'});
  writeJson('projects.json',[{id:'p',name:'Fixture project',modelRoles:{worker:{connectionId:ids[0]},reviewer:{connectionId:ids[1]}},tasks:[]}]);
  console.log(JSON.stringify(ids));lockVault();
 `],{cwd:ROOT,env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);const ids=JSON.parse(seed.stdout.trim());
 const child=spawn(process.execPath,['src/server.mjs'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 const base=`http://127.0.0.1:${p}`;
 try{
  for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(child.exitCode!==null)throw new Error(logs);await sleep(50);}
  await t.test('new fleet API rejects missing session',async()=>assert.equal((await fetch(base+'/api/office/space-fleet')).status,401));
  const grant=await fetch(base+'/?launch='+token,{redirect:'manual'});assert.equal(grant.status,303);const cookie=grant.headers.get('set-cookie').split(';')[0];
  const read=()=>fetch(base+'/api/office/space-fleet',{headers:{cookie}}),post=(url,body)=>fetch(base+url,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(body)});
  await t.test('locked Vault hides roster',async()=>assert.equal((await read()).status,423));
  assert.equal((await post('/api/vault/unlock',{password})).status,200);
  await t.test('every AI account including more than ten is visible; integrations excluded',async()=>{const res=await read();assert.equal(res.status,200);const r=await res.json();assert.equal(r.source,'live');assert.equal(r.schema,1);assert.equal(r.bots.length,12);assert.ok(r.bots.every(b=>b.state==='ready'&&b.connected));assert.ok(!JSON.stringify(r).includes(secret));});
  await t.test('read-only repeated polling does not mutate Vault, projects, model catalog',async()=>{const names=['vault.enc.json','projects.json','model-registry.json'];const before=names.map(n=>fs.readFileSync(path.join(dataDir,n),'utf8'));for(let i=0;i<4;i++)assert.equal((await read()).status,200);assert.deepEqual(names.map(n=>fs.readFileSync(path.join(dataDir,n),'utf8')),before);assert.ok(!logs.includes('fetch failed'));});
  await t.test('connection rename keeps same robot ID; markup remains plain data',async()=>{assert.equal((await post('/api/connections/'+ids[0]+'/name',{name:'Renamed robot'})).status,200);const r=await (await read()).json();assert.equal(r.bots.find(b=>b.connectionId===ids[0]).name,'Renamed robot');assert.equal(r.bots[2].name,'<img src=x onerror=alert(1)>');});
  const projectFile=path.join(dataDir,'projects.json');const mutate=fn=>{const ps=JSON.parse(fs.readFileSync(projectFile));fn(ps[0]);fs.writeFileSync(projectFile,JSON.stringify(ps));};
  await t.test('actual task and review state is read without starting a new job',async()=>{mutate(p=>p.tasks=[{id:'T',title:'Fixture task',status:'running',executionStage:'coding',workerBinding:{connectionId:ids[0]},reviewerBinding:{connectionId:ids[1]}}]);let r=await (await read()).json();assert.equal(r.bots[0].state,'working');assert.equal(r.bots[1].state,'ready');mutate(p=>{p.tasks[0].status='reviewing';p.tasks[0].executionStage='reviewing';});r=await (await read()).json();assert.equal(r.bots[0].state,'waiting');assert.ok(r.bots[0].jobs.some(j=>j.state==='waiting'));assert.equal(r.bots[1].state,'reviewing');});
  await t.test('task titles are redacted against the unlocked Vault',async()=>{mutate(p=>p.tasks[0].title='Test '+secret);const r=await (await read()).json();assert.ok(!JSON.stringify(r).includes(secret));});
  await t.test('account deletion removes exactly that robot',async()=>{assert.equal((await fetch(base+'/api/connections/'+ids[11],{method:'DELETE',headers:{cookie}})).status,200);const r=await (await read()).json();assert.equal(r.bots.length,11);assert.ok(!r.bots.some(b=>b.connectionId===ids[11]));});
  await t.test('new fleet modules and original robot are served with correct MIME types',async()=>{for(const name of ['fleet-contract','fleet-feed','fleet-scene','live-motion','navigation']){const r=await fetch(base+'/space-studio/'+name+'.mjs',{headers:{cookie}});assert.equal(r.status,200);assert.ok(r.headers.get('content-type').includes('javascript'));}const r=await fetch(base+'/assets/tam19.glb',{headers:{cookie}});assert.equal(r.status,200);assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,4).toString(),'glTF');});
  await t.test('locking again revokes roster visibility',async()=>{assert.equal((await post('/api/vault/lock',{})).status,200);assert.equal((await read()).status,423);});
 }finally{child.kill();if(child.exitCode===null)await Promise.race([once(child,'exit'),sleep(3000)]);if(child.exitCode===null)child.kill('SIGKILL');fs.rmSync(tmp,{recursive:true,force:true});}
});
