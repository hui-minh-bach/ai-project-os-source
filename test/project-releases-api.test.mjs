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
async function freePort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port;}
test('release API reuses browser session, rejects forged evidence/deployment, preserves history and exports versioned Markdown',{timeout:30000},async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'release-api-')),port=await freePort(),token='b'.repeat(64),data=path.join(temp,'data');
 const env={...process.env,AI_PROJECT_OS_PERSONAL_DATA_DIR:data,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_LAUNCH_TOKEN:token,AI_PROJECT_OS_NO_BROWSER:'1'};
 const setup=spawnSync(process.execPath,['--input-type=module','-e',"import {createProject} from './src/lib/projects.mjs';import {prepareTaskPlan} from './test/helpers/council-fixtures.mjs';const p=createProject({name:'Release API'});prepareTaskPlan(p.id,[{id:'T1',title:'Planned feature',role:'frontend',description:'Fixture',status:'todo',dependsOn:[],doneWhen:'Feature opens'}]);console.log(p.id);"],{cwd:root,env,encoding:'utf8'});assert.equal(setup.status,0,setup.stderr);const id=setup.stdout.trim();
 const app=spawn(process.execPath,['src/server.mjs'],{cwd:root,env,stdio:'ignore'});
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok){ready=true;break;}}catch{}await pause(80);}assert.equal(ready,true);
  const base=`http://127.0.0.1:${port}/api/projects/${id}/releases`;assert.equal((await fetch(base)).status,401);
  const grant=await fetch(`http://127.0.0.1:${port}/?launch=${token}`,{redirect:'manual'}),cookie=grant.headers.get('set-cookie').split(';')[0];
  const request=(url,method='GET',body,extra={})=>fetch(url,{method,headers:{Cookie:cookie,'content-type':'application/json',...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const created=await request(base,'POST',{version:'v0.1.0',title:'First API release',knownIssues:['Not tested yet'],limitations:['Fixture only']});assert.equal(created.status,200);let list=await (await request(base)).json(),r=list.releases[0];assert.equal(r.version,'v0.1.0');assert.equal(r.progress.total,0);assert.equal(r.milestones.buildComplete,false);
  assert.equal((await request(base,'POST',{version:'v0.1.0'})).status,500);
  assert.equal((await request(base+'/'+r.id,'PATCH',{deployment:{source:'agent',status:'deployed'}})).status,500);
  const t=list.candidates[0];assert.equal((await request(base+'/'+r.id+'/tasks','POST',{tasks:[{taskId:t.taskId,planId:t.planId,kind:'feature'}]})).status,200);
  assert.equal((await request(base+'/'+r.id+'/handover','POST',{explicitApproval:true,evidenceHash:r.evidenceHash})).status,500);
  assert.equal((await request(base+'/'+r.id+'/deployed','POST',{explicitApproval:true,target:'https://example.test',evidence:'Agent says deploy succeeded'})).status,500);
  assert.equal((await request(base+'/'+r.id+'/notes','POST',{})).status,200);r=await (await request(base+'/'+r.id)).json();assert.equal(r.notesHistory.length,1);assert.ok(r.history.some(h=>h.type==='tasks-assigned'));
  const download=await request(base+'/'+r.id+'/notes/'+r.notesHistory[0].id+'/markdown');assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/RELEASE-NOTES-v0.1.0-r1.md/);const md=await download.text();assert.match(md,/Known|Not tested yet/);assert.match(md,/Chưa có xác nhận Deployed/);assert.doesNotMatch(md.split('## Tính năng có bằng chứng build')[1].split('## ')[0],/Planned feature/);
  assert.equal((await request(base+'/'+r.id,'DELETE')).status,404);assert.equal((await request(base,'POST',{version:'v1.0.0'}, {Origin:'https://evil.example'})).status,403);
  const map=await (await request(`http://127.0.0.1:${port}/api/projects/${id}/map`)).json();assert.equal(map.releases[0].version,'v0.1.0');assert.equal(map.releases[0].deployedConfirmed,false);
  const html=await (await request(`http://127.0.0.1:${port}/`)).text();assert.match(html,/projectReleases/);assert.match(html,/\/tabs\/releases.js/);assert.match(html,/\/tabs\/releases.css/);
  const stored=JSON.parse(fs.readFileSync(path.join(data,'projects.json'),'utf8'))[0];assert.equal(stored.releases[0].notesHistory.length,1);assert.equal(stored.releases[0].deployment,undefined);
 }finally{app.kill('SIGTERM');await Promise.race([once(app,'exit'),pause(3000)]);fs.rmSync(temp,{recursive:true,force:true});}
});
