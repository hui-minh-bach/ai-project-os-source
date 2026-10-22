// Local fixture contracts only: no live account success is asserted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { DATA_DIR, readJson, writeJson } from '../src/lib/store.mjs';
import { unlockVault, lockVault, saveConnection, listConnections, deleteConnection, getConnection } from '../src/lib/vault.mjs';
import { listModels, ask, testConnection } from '../src/lib/providers.mjs';
import { recordModels, modelAvailability, verifiedBinding, roleRef, resolveBinding, resolveModelConnection, MODEL_REGISTRY_MAX_AGE_MS } from '../src/lib/model-bindings.mjs';
import { createProject, getProject, updateProjectModelRoles, projectModelRoles, founderChat, runCouncil } from '../src/lib/projects.mjs';
import { runNativeTask, reviewNativeTask } from '../src/lib/native-agent.mjs';
import { memberResponse, chairResponse, prepareCouncilHandoff } from './helpers/council-fixtures.mjs';

const SECRET='fixture-secret-do-not-display-123';
function reset(){lockVault();for(const n of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak','model-registry.json','model-registry.json.bak'])fs.rmSync(path.join(DATA_DIR,n),{force:true});unlockVault('connections-fixture-vault');}
async function fixture(handler){const requests=[];const server=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requests.push({url:req.url,headers:req.headers,body:body?JSON.parse(body):null});const data=await handler(req,body?JSON.parse(body):null);res.writeHead(data.status||200,{'content-type':'application/json',...(data.headers||{})});res.end(JSON.stringify(data.json));});await new Promise(r=>server.listen(0,'127.0.0.1',r));return {base:`http://127.0.0.1:${server.address().port}`,requests,close:()=>new Promise(r=>server.close(r))};}

test('official models endpoints use provider authentication, Anthropic and Gemini paginate, registry persists only safe IDs',async()=>{
 reset();const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,init)=>{const u=new URL(url);calls.push({url:String(url),init});let json;
 if(u.hostname==='api.openai.com')json={data:[{id:'alpha'},{id:'beta'},{id:SECRET}]};
 else if(u.hostname==='api.anthropic.com')json=u.searchParams.has('after_id')?{data:[{id:'claude-b'}],has_more:false}:{data:[{id:'claude-a'}],has_more:true,last_id:'claude-a'};
 else if(u.hostname==='generativelanguage.googleapis.com')json=u.searchParams.has('pageToken')?{models:[{name:'models/gemini-b',supportedGenerationMethods:['generateContent']}]}:{models:[{name:'models/gemini-a',supportedGenerationMethods:['generateContent']},{name:'models/embedding',supportedGenerationMethods:['embedContent']}],nextPageToken:'page-2'};
 else throw new Error('unexpected provider URL');return new Response(JSON.stringify(json),{headers:{'content-type':'application/json'}});
 };
 try{
  const oa=saveConnection({kind:'openai',name:'Fixture OpenAI',secret:SECRET});const an=saveConnection({kind:'anthropic',name:'Fixture Claude',secret:SECRET});const ge=saveConnection({kind:'gemini',name:'Fixture Gemini',secret:SECRET});
  assert.deepEqual(await listModels(oa.id),['alpha','beta']);assert.deepEqual(await listModels(an.id),['claude-a','claude-b']);assert.deepEqual(await listModels(ge.id),['gemini-a','gemini-b']);
  assert.equal(calls[0].url,'https://api.openai.com/v1/models');assert.equal(calls[0].init.headers.authorization,`Bearer ${SECRET}`);assert.equal(calls[1].init.headers['x-api-key'],SECRET);assert.equal(calls[1].init.headers['anthropic-version'],'2023-06-01');assert.match(calls[2].url,/after_id=claude-a/);assert.equal(calls[3].init.headers['x-goog-api-key'],SECRET);assert.match(calls[4].url,/pageToken=page-2/);assert.equal(calls[0].init.redirect,'error');
  const r=readJson('model-registry.json',{});assert.equal(r[oa.id].status,'verified');assert.doesNotMatch(JSON.stringify(r),new RegExp(SECRET));assert.doesNotMatch(JSON.stringify(listConnections()),new RegExp(SECRET));assert.doesNotMatch(fs.readFileSync(path.join(DATA_DIR,'vault.enc.json'),'utf8'),new RegExp(SECRET));
  lockVault();assert.equal(modelAvailability(oa.id).status,'locked');assert.throws(()=>verifiedBinding({connectionId:oa.id,model:'alpha'}),/Vault đang khóa/);unlockVault('connections-fixture-vault');assert.equal(modelAvailability(oa.id).status,'verified');
 }finally{globalThis.fetch=original;lockVault()}
});

test('local compatible API refresh rejects revoked/missing/replaced references; a stale catalog stays selectable (0.9.55 ungating) and secrets never leak',async()=>{
 reset();let revoked=false;const f=await fixture(()=>revoked?{status:401,json:{error:{message:`credential ${SECRET}`}}}:{json:{data:[{id:'alpha'},{id:'beta'}]}});
 try{
  const c=saveConnection({kind:'openai_compatible',name:'Fixture compatible',baseUrl:f.base+'/v1',secret:SECRET,model:'alpha'});assert.deepEqual(await listModels(c.id),['alpha','beta']);const p=createProject({name:'Fixture roles',idea:'Local test'});updateProjectModelRoles(p.id,{founder:{connectionId:c.id,model:'alpha'}});const ref=roleRef(p.id,'founder');assert.equal(resolveBinding(ref).model,'alpha');assert.throws(()=>updateProjectModelRoles(p.id,{worker:{connectionId:c.id,model:'unknown'}}),/không có trong danh mục/);
  const r=readJson('model-registry.json',{});r[c.id].verifiedAt=new Date(Date.now()-MODEL_REGISTRY_MAX_AGE_MS-1).toISOString();writeJson('model-registry.json',r);assert.equal(resolveBinding(ref).model,'alpha','a stale catalog stays selectable — staleness is a badge, never a gate (0.9.55)');assert.equal(modelAvailability(c.id).catalogStale,true);await listModels(c.id);assert.equal(modelAvailability(c.id).catalogStale,false);
  revoked=true;await assert.rejects(()=>listModels(c.id),e=>e.status===401&&!e.message.includes(SECRET));assert.equal(modelAvailability(c.id).status,'unverified');assert.throws(()=>resolveBinding(ref),/Chưa có danh mục/);
  revoked=false;await listModels(c.id);saveConnection({id:c.id,kind:c.kind,secret:'replacement-fixture-secret'});assert.throws(()=>resolveBinding(ref),/Chưa có danh mục/);await listModels(c.id);deleteConnection(c.id);assert.throws(()=>resolveBinding(ref),/Không tìm thấy kết nối/);
  assert.doesNotMatch(JSON.stringify(readJson('projects.json',[])),new RegExp(SECRET));
 }finally{await f.close();lockVault()}
});

test('role broker governs Founder, multiple Council models, native Worker and Reviewer without mutating account default',async()=>{
 reset();const f=await fixture((req,body)=>req.url.endsWith('/models')?{json:{data:['default','founder','council-a','council-b','worker','reviewer'].map(id=>({id}))}}:{json:{output_text:body.instructions?.includes('COUNCIL_MEMBER_V1')?JSON.stringify(memberResponse('Fixture '+body.model)):body.instructions?.includes('COUNCIL_CHAIR_V1')?JSON.stringify(chairResponse('Fixture '+body.model)):body.model==='worker'?'```json\n{"tool":"done","summary":"fixture done"}\n```':body.model==='reviewer'?JSON.stringify({approved:true,summary:'fixture review',risks:[],fixes:[]}):'Fixture '+body.model}});
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'connections-worker-'));
 try{
  const c=saveConnection({kind:'openai',name:'Fixture account',secret:SECRET,model:'default',baseUrl:f.base+'/v1/responses'});await listModels(c.id);const p=createProject({name:'Role fixture',idea:'Local'});const b=model=>({connectionId:c.id,model});updateProjectModelRoles(p.id,{founder:b('founder'),council:[b('council-a'),b('council-b')],worker:b('worker'),reviewer:b('reviewer')});
  assert.equal(await founderChat(p.id,c.id,'Local fixture message'),'Fixture founder');prepareCouncilHandoff(p.id);const council=await runCouncil(p.id,[c.id],c.id);assert.equal(council.results.length,2);assert.equal(JSON.parse(council.results[0].text).viewpoint,'Fixture council-a');assert.equal(JSON.parse(council.results[1].text).viewpoint,'Fixture council-b');assert.equal(JSON.parse(council.synthesis).summary,'Fixture council-a');assert.equal(council.specification.status,'pending');
  await runNativeTask({root,workerId:roleRef(p.id,'worker'),spec:'fixture',task:{id:'T1',title:'fixture'},maxTurns:1});assert.equal((await reviewNativeTask({reviewerId:roleRef(p.id,'reviewer'),spec:'fixture',task:{id:'T1'},diff:'fixture'})).approved,true);
  assert.equal(getConnection(c.id).model,'default');assert.equal(await ask(c.id,{prompt:'Legacy explicit ID'}),'Fixture default');assert.equal(resolveModelConnection(roleRef(p.id,'worker')).model,'worker');assert.equal(projectModelRoles(p.id).descriptors.council[1].ref,roleRef(p.id,'council',1));assert.deepEqual(getProject(p.id).modelRoles.worker,b('worker'));
  const models=f.requests.filter(x=>x.body).map(x=>x.body.model);assert.deepEqual(models,['founder','council-a','council-b','council-a','worker','reviewer','default']);assert.doesNotMatch(JSON.stringify(projectModelRoles(p.id)),new RegExp(SECRET));
 }finally{await f.close();fs.rmSync(root,{recursive:true,force:true});lockVault()}
});

test('model API malformed pagination and generation authorization failure invalidate bindings',async()=>{
 reset();const f=await fixture(req=>req.url.includes('/models')?{json:{data:[{id:'claude-a'}],has_more:true,last_id:'claude-a'}}:{status:403,json:{error:{message:SECRET}}});
 try{
  const c=saveConnection({kind:'anthropic',name:'Fixture Claude',secret:SECRET,model:'claude-a',baseUrl:f.base+'/v1/messages'});await assert.rejects(()=>listModels(c.id),/pagination/);assert.equal(modelAvailability(c.id).status,'unverified');recordModels(getConnection(c.id),['claude-a']);const p=createProject({name:'Fixture revocation',idea:'Local'});updateProjectModelRoles(p.id,{reviewer:{connectionId:c.id,model:'claude-a'}});await assert.rejects(()=>ask(roleRef(p.id,'reviewer'),{prompt:'fixture'}),e=>e.status===403&&!e.message.includes(SECRET));assert.equal(modelAvailability(c.id).status,'unverified');
 }finally{await f.close();lockVault()}
});

test('infrastructure API metadata requires real verification and failed verification clears cached status',async()=>{
 reset();const original=globalThis.fetch;let failed=false;
 globalThis.fetch=async(url,init)=>{assert.equal(init.redirect,'error');const u=new URL(url);const data=u.hostname==='api.github.com'?{id:123,login:'fixture-github'}:u.hostname==='api.vercel.com'?{user:{username:'fixture-vercel'}}:[{id:'fixture-project',name:'Fixture DB'}];return new Response(JSON.stringify(failed?{error:{message:SECRET}}:data),{status:failed?401:200,headers:{'content-type':'application/json'}})};
 try{
  const gh=saveConnection({kind:'github',name:'Fixture GitHub',secret:SECRET}),ve=saveConnection({kind:'vercel',name:'Fixture Vercel',secret:SECRET}),su=saveConnection({kind:'supabase',name:'Fixture Supabase',secret:SECRET,meta:{management:true}});
  await testConnection(gh.id);await testConnection(ve.id);await testConnection(su.id);const all=listConnections();assert.equal(all.find(c=>c.id===gh.id).meta.login,'fixture-github');assert.equal(all.find(c=>c.id===ve.id).meta.login,'fixture-vercel');assert.equal(all.find(c=>c.id===su.id).meta.projects[0].id,'fixture-project');assert.ok(all.every(c=>c.meta.verifiedAt));
  failed=true;await assert.rejects(()=>testConnection(gh.id),/HTTP 401/);assert.equal(getConnection(gh.id).meta.verifiedAt,undefined);assert.doesNotMatch(JSON.stringify(listConnections()),new RegExp(SECRET));
  assert.throws(()=>saveConnection({kind:'openai_compatible',secret:SECRET,baseUrl:'http://example.com/v1'}),/HTTPS/);assert.throws(()=>saveConnection({kind:'openai_compatible',secret:SECRET,baseUrl:'https://user:password@example.com/v1'}),/không chứa credential/);
  const quoteSecret='fixture-"-quoted-key';const quoted=saveConnection({kind:'other',name:quoteSecret,secret:quoteSecret});assert.equal(quoted.name,'[redacted]');
 }finally{globalThis.fetch=original;lockVault()}
});

test('custom model-specific Gemini URL follows two resolved role models while preserving the account default',async()=>{
 reset();const f=await fixture((req)=>{
  const url=new URL(req.url,'http://fixture.local');
  if(req.method==='GET'&&url.pathname==='/v1beta/models')return {json:{models:['default','role-founder','role-reviewer'].map(id=>({name:`models/${id}`,supportedGenerationMethods:['generateContent']}))}};
  const model=decodeURIComponent(url.pathname.match(/\/models\/([^/]+):generateContent$/)?.[1]||'');
  return {json:{candidates:[{content:{parts:[{text:model==='role-reviewer'?JSON.stringify({approved:true,summary:'Gemini fixture reviewer',risks:[],fixes:[]}):`Gemini fixture ${model}`}]}}]}};
 });
 try{
  const baseUrl=f.base+'/v1beta/models/default:generateContent';const c=saveConnection({kind:'gemini',name:'Fixture custom Gemini',secret:SECRET,model:'default',baseUrl});
  assert.deepEqual(await listModels(c.id),['default','role-founder','role-reviewer']);const p=createProject({name:'Custom Gemini role fixture',idea:'Local contract'});const binding=model=>({connectionId:c.id,model});updateProjectModelRoles(p.id,{founder:binding('role-founder'),reviewer:binding('role-reviewer')});
  assert.equal(await founderChat(p.id,c.id,'Fixture founder request'),'Gemini fixture role-founder');assert.equal((await reviewNativeTask({reviewerId:roleRef(p.id,'reviewer'),spec:'fixture',task:{id:'T1'},diff:'fixture'})).approved,true);assert.equal(await ask(c.id,{prompt:'Legacy default request'}),'Gemini fixture default');
  assert.deepEqual(f.requests.filter(r=>r.body).map(r=>r.url),['/v1beta/models/role-founder:generateContent','/v1beta/models/role-reviewer:generateContent','/v1beta/models/default:generateContent']);assert.ok(f.requests.every(r=>r.headers['x-goog-api-key']===SECRET));assert.equal(getConnection(c.id).model,'default');assert.equal(getConnection(c.id).baseUrl,baseUrl);
 }finally{await f.close();lockVault()}
});
