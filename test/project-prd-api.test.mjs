import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as pause} from 'node:timers/promises';
const root=path.resolve(import.meta.dirname,'..');
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;s.close();await once(s,'close');return p;}

test('PRD API uses browser session, exports Markdown, and exposes no modification endpoint',{timeout:30000},async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'prd-api-')),dataDir=path.join(temp,'data'),port=await freePort(),token='e'.repeat(64);
 const env={...process.env,AI_PROJECT_OS_PERSONAL_DATA_DIR:dataDir,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_LAUNCH_TOKEN:token,AI_PROJECT_OS_NO_BROWSER:'1'};
 const prepare=spawnSync(process.execPath,['--input-type=module','-e',`import {createProject} from './src/lib/projects.mjs';import {prepareApprovedSpecification} from './test/helpers/council-fixtures.mjs';const p=createProject({name:'PRD API'});prepareApprovedSpecification(p.id);console.log(p.id);`],{cwd:root,env,encoding:'utf8'});
 assert.equal(prepare.status,0,prepare.stderr);const id=prepare.stdout.trim();
 const app=spawn(process.execPath,['src/server.mjs'],{cwd:root,env,stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){ready=true;break;}}catch{}await pause(80);}
  assert.equal(ready,true,'server must start with fixture PRD');
  const base=`http://127.0.0.1:${port}/api/projects/${encodeURIComponent(id)}/prd`;
  assert.equal((await fetch(base)).status,401);
  const grant=await fetch(`http://127.0.0.1:${port}/?launch=${token}`,{redirect:'manual'});
  assert.equal(grant.status,303);const cookie=grant.headers.get('set-cookie').split(';')[0];
  const get=(url,options={})=>fetch(url,{...options,headers:{Cookie:cookie,...(options.headers||{})}});
  let r=await get(base);assert.equal(r.status,200);const list=await r.json();assert.equal(list.history.length,1);assert.equal(list.current,'test-approved-spec');
  r=await get(base+'/'+list.current);assert.equal(r.status,200);const doc=await r.json();assert.equal(doc.version,1);assert.equal(doc.status,'approved');
  r=await get(base+'/'+list.current+'/markdown');assert.equal(r.status,200);assert.match(r.headers.get('content-disposition'),/attachment; filename="PRD-v1.md"/);
  assert.match(await r.text(),/## Mục tiêu kinh doanh/);
  for(const method of ['POST','PATCH','DELETE'])assert.equal((await get(base+'/'+list.current,{method,headers:{'content-type':'application/json'},body:method==='DELETE'?undefined:'{}'})).status,404);
  assert.equal((await get(base+'/unapproved')).status,404);
  const html=await get(`http://127.0.0.1:${port}/`);const page=await html.text();
  assert.match(page,/projectPrdPanel/);assert.match(page,/Tài liệu yêu cầu dự án \(PRD\)/);
  assert.match(page,/\/tabs\/project-prd.js/);assert.match(page,/\/tabs\/project-prd.css/);
  const stored=JSON.parse(fs.readFileSync(path.join(dataDir,'projects.json'),'utf8'))[0];
  assert.equal(stored.specifications[0].approvedRequirementsHash,doc.contentHash);
 }finally{app.kill('SIGTERM');await Promise.race([once(app,'exit'),pause(3000)]);fs.rmSync(temp,{recursive:true,force:true});}
});
