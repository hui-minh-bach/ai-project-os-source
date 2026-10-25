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
test('deployment/packaging APIs require local browser session, use one target, return real ZIPs and never infer deployment',{timeout:30000},async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'handover-api-')),port=await freePort(),token='c'.repeat(64),data=path.join(temp,'data'),env={...process.env,AI_PROJECT_OS_PERSONAL_DATA_DIR:data,AI_PROJECT_OS_PORT:String(port),AI_PROJECT_OS_LAUNCH_TOKEN:token,AI_PROJECT_OS_NO_BROWSER:'1'};
 const program="import * as projects from './src/lib/projects.mjs';import {readJson,writeJson} from './src/lib/store.mjs';import {prepareTaskPlan} from './test/helpers/council-fixtures.mjs';import {workspaceDir} from './src/lib/workspace.mjs';import {must} from './src/lib/shell.mjs';import {manualHandoverFixture} from './test/helpers/manual-handover-fixtures.mjs';const f=await manualHandoverFixture({projects,readJson,writeJson,prepareTaskPlan,workspaceDir,must})({});console.log(JSON.stringify({id:f.id,releaseId:f.releaseId}));";
 const setup=spawnSync(process.execPath,['--input-type=module','-e',program],{cwd:root,env,encoding:'utf8'});assert.equal(setup.status,0,setup.stderr);const {id,releaseId}=JSON.parse(setup.stdout.trim().split('\n').at(-1));
 const app=spawn(process.execPath,['src/server.mjs'],{cwd:root,env,stdio:'ignore'});
 try{let ready=false;for(let i=0;i<100;i++){try{if((await fetch(`http://127.0.0.1:${port}/api/health`)).ok){ready=true;break;}}catch{}await pause(80);}assert.equal(ready,true);
  const base=`http://127.0.0.1:${port}/api/projects/${id}`,path=base+'/releases/'+releaseId+'/manual-handover';assert.equal((await fetch(base+'/deployment-target')).status,401);assert.equal((await fetch(path,{method:'POST'})).status,401);
  const grant=await fetch(`http://127.0.0.1:${port}/?launch=${token}`,{redirect:'manual'}),cookie=grant.headers.get('set-cookie').split(';')[0];
  const call=(url,method='GET',body,extra={})=>fetch(url,{method,headers:{Cookie:cookie,'content-type':'application/json',...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  let settings=await (await call(base+'/deployment-target')).json();assert.equal(settings.target,'local-only');assert.equal(settings.adapters[0].id,'static-web-v1');
  assert.equal((await call(base+'/settings','POST',{deploymentTarget:'cloud-manual'})).status,200);settings=await (await call(base+'/deployment-target')).json();assert.equal(settings.target,'cloud-manual');assert.equal(settings.impact.status,'compatible');
  let doc=await (await call(base+'/releases/'+releaseId)).json();assert.equal((await call(path,'POST',{adapterId:'static-web-v1',snapshotHash:doc.contentHash,targetRevision:settings.revision})).status,200);doc=await (await call(base+'/releases/'+releaseId)).json();const record=doc.manualHandoverPackages.at(-1);assert.equal(record.status,'READY',record.message);assert.equal(doc.deployment,null);
  const archiveUrl=path+'/'+record.id+'/archive',archive=await call(archiveUrl);assert.equal(archive.status,200);assert.match(archive.headers.get('content-type'),/application\/zip/);assert.match(archive.headers.get('content-disposition'),/HANDOVER-v0.1.0/);assert.ok((await archive.arrayBuffer()).byteLength>100);assert.equal((await fetch(archiveUrl)).status,401);
  assert.equal((await call(path,'POST',{command:'npm run build'})).status,500);assert.equal((await call(base+'/settings','POST',{deploymentTarget:'local-only'}, {Origin:'https://evil.example'})).status,403);
  assert.equal((await call(base+'/settings','POST',{deploymentTarget:'windows-desktop'})).status,200);doc=await (await call(base+'/releases/'+releaseId)).json();assert.equal(doc.deploymentImpact.status,'architecture-required');assert.equal((await call(path,'POST',{adapterId:'static-web-v1',snapshotHash:doc.contentHash,targetRevision:doc.deploymentTargetRevision})).status,200);doc=await (await call(base+'/releases/'+releaseId)).json();assert.equal(doc.manualHandoverPackages.at(-1).status,'BLOCKED');assert.equal(doc.manualHandoverPackages[0].status,'READY');assert.equal(doc.deployment,null);
  const html=await (await call(`http://127.0.0.1:${port}/`)).text();assert.match(html,/ideaDeploymentTarget/);assert.match(html,/projectDeploymentSettings/);assert.match(html,/deployment-target.js/);
 }finally{app.kill('SIGTERM');await Promise.race([once(app,'exit'),pause(2000)]);fs.rmSync(temp,{recursive:true,force:true});}
});
