'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createCore}=require('../core.cjs');
function f({commercialPolicy=true,fetchImpl,secret='test-key',workers=2}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ai-commercial-'));
 let credential=secret;
 const core=createCore({root,commercialPolicy,concurrency:workers,vault:{get:()=>{if(!credential)throw Object.assign(new Error('Vault locked'),{code:'VAULT_LOCKED'});return credential;}},fetchImpl:(fetchImpl|| (async()=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'READY'}}],usage:{prompt_tokens:6,completion_tokens:2}})})))});
 return {root,core,setKey:x=>{credential=x;},close:()=>{core.close();fs.rmSync(root,{recursive:true,force:true});}};
}
const reg=c=>{c.providers.register({id:'p1',type:'openai',pricePerMillionInput:1,pricePerMillionOutput:1});c.providers.setBudget(.25);};
const verify=async c=>c.providers.verifyModel({providerId:'p1',model:'text-model',approved:true,costCeilingUsd:.01});

test('sensitive task payload keys and high-entropy tokens never enter persisted task JSON',()=>{
 const x=f();try{for(const input of [{password:'oops'},{params:{apiKey:'anything'}},{prompt:'sk-ABCDEF012345678901234567890123'},{constructor:{role:'administrator'}}])assert.throws(()=>x.core.queue.add({projectId:'p',input}),{code:'SENSITIVE_TASK'});assert.equal(x.core.state.data.tasks.length,0);assert.ok(!fs.readFileSync(path.join(x.root,'state','tasks.json'),'utf8').includes('oops'));}finally{x.close();}
});
test('commercial mode fails closed for an unverified model and direct billable call',async()=>{
 const x=f();try{reg(x.core);assert.throws(()=>x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'}),{code:'MODEL_UNVERIFIED'});await assert.rejects(x.core.providers.generate('Worker',{prompt:'hello'}),{code:'COST_APPROVAL_REQUIRED'});await verify(x.core);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});assert.equal(x.core.providers.quote('Worker',{prompt:'hello'}).approvalRequired,true);
 }finally{x.close();}
});
test('credential rotation, Vault lock and text capability bind invalidate verified assignments',async()=>{
 const x=f();try{reg(x.core);await verify(x.core);assert.deepEqual(x.core.providers.verifiedModel('p1','text-model').verifiedCapabilities,['text']);assert.throws(()=>x.core.providers.verifiedModel('p1','text-model',{capability:'vision'}),{code:'MODEL_UNVERIFIED'});x.setKey('new-secret');assert.throws(()=>x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'}),{code:'MODEL_UNVERIFIED'});x.setKey('');assert.throws(()=>x.core.providers.verifiedModel('p1','text-model'),{code:'VAULT_LOCKED'});}finally{x.close();}
});
test('unknown quota never invents 5-hour or weekly bars; reported shared bucket stays shared',()=>{
 const x=f();try{reg(x.core);assert.deepEqual(x.core.providers.quotaStatus('p1').availability,'unknown');const q=x.core.providers.recordQuota({providerId:'p1',windowLabel:'provider-declared window',source:'provider:http-response',unit:'requests',limit:100,remaining:12});assert.equal(q.modelId,null);assert.equal(q.isEstimated,false);assert.equal(x.core.providers.quotaStatus('p1','model-A').remaining,12);assert.equal(x.core.providers.quotaStatus('p1','model-B').remaining,12);assert.throws(()=>x.core.providers.recordQuota({providerId:'p1',windowLabel:'1 week',source:'user-guessed',unit:'requests',limit:100,remaining:22}),{code:'QUOTA_UNVERIFIED'});}finally{x.close();}
});
test('429 provider retry-after blocks replay even if new job approval is issued',async()=>{
 let requests=0;const x=f({fetchImpl:async()=>{requests++;return requests===1?{ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'READY'}}]})}:{ok:false,status:429,headers:new Headers({'retry-after':'120'}),text:async()=>JSON.stringify({error:{message:'rate limit'}})};}});
 try{reg(x.core);await verify(x.core);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});const a=x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'limittest1',maxUsd:.01,approved:true});await assert.rejects(x.core.providers.generateApproved('Worker',{prompt:'Hi',approvalId:a.id,projectId:'p'}),{code:'PROVIDER_QUOTA'});assert.equal(x.core.providers.quotaStatus('p1').availability,'unknown');const b=x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'limittest2',maxUsd:.01,approved:true});await assert.rejects(x.core.providers.generateApproved('Worker',{prompt:'Hi',approvalId:b.id,projectId:'p'}),{code:'PROVIDER_COOLDOWN'});assert.equal(requests,2);}finally{x.close();}
});
test('401 expired provider rejects authorization and does not mark model healthy',async()=>{
 const x=f({fetchImpl:async()=>({ok:false,status:401,text:async()=>JSON.stringify({error:'invalid'})})});try{reg(x.core);await assert.rejects(verify(x.core),{code:'PROVIDER_AUTH'});assert.throws(()=>x.core.providers.verifiedModel('p1','text-model'),{code:'MODEL_UNVERIFIED'});}finally{x.close();}
});
test('unknown network outcome is permanently uncertain, never silently retried',async()=>{
 let count=0;const x=f({fetchImpl:async()=>{count++;if(count===1)return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'READY'}}]})};throw new TypeError('simulated network loss');}});
 try{reg(x.core);await verify(x.core);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});const a=x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'offline-job',maxUsd:.01,approved:true});await assert.rejects(x.core.providers.generateApproved('Worker',{prompt:'Hello',approvalId:a.id,projectId:'p'}));assert.equal(x.core.state.data.commercial.approvals.find(q=>q.id===a.id).status,'uncertain');await assert.rejects(x.core.providers.generateApproved('Worker',{prompt:'Hello',approvalId:a.id,projectId:'p'}),{code:'COST_ALREADY_DISPATCHED'});assert.equal(count,2);}finally{x.close();}
});
test('one approval under simultaneous requests dispatches exactly once',async()=>{
 let count=0;const x=f({fetchImpl:async()=>{count++;return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'READY'}}],usage:{prompt_tokens:1,completion_tokens:1}})};}});
 try{reg(x.core);await verify(x.core);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});const a=x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'parallel-job',maxUsd:.01,approved:true});const results=await Promise.allSettled([x.core.providers.generateApproved('Worker',{prompt:'hi',approvalId:a.id,projectId:'p'}),x.core.providers.generateApproved('Worker',{prompt:'hi',approvalId:a.id,projectId:'p'})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);assert.equal(count,2);}finally{x.close();}
});
test('cost approvals reject wrong project, model role changes and duplicate idempotency keys',async()=>{
 const x=f();try{reg(x.core);await verify(x.core);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});const a=x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'invoice777',maxUsd:.01,approved:true});assert.throws(()=>x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'invoice777',maxUsd:.01,approved:true}),{code:'IDEMPOTENCY_CONFLICT'});await assert.rejects(x.core.providers.generateApproved('Worker',{prompt:'Hi',approvalId:a.id,projectId:'other'}),{code:'APPROVAL_SCOPE'});assert.equal(x.core.state.data.commercial.approvals.find(y=>y.id===a.id).status,'approved');}finally{x.close();}
});
test('paid worker task stays awaiting approval until model and task rights are separately granted',async()=>{
 const x=f();try{reg(x.core);await verify(x.core);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});const t=x.core.queue.add({projectId:'p',input:{prompt:'Write a short greeting',approved:false}});assert.equal(t.state,'waiting_approval');await x.core.queue.drain();assert.equal(x.core.state.find(t.id).state,'waiting_approval');x.core.queue.approve(t.id,[]);await x.core.queue.drain();assert.equal(x.core.state.find(t.id).state,'blocked');assert.equal(x.core.state.find(t.id).error.code,'COST_APPROVAL_REQUIRED');}finally{x.close();}
});
test('four workers persist independent local artifacts, and restart retains 1000-event bound',async()=>{
 const x=f({workers:4,commercialPolicy:false});let second;try{const tasks=Array.from({length:4},(_,i)=>x.core.queue.add({projectId:'p',kind:'software',input:{approved:true,allowedTools:['file_write','node_check'],steps:[{tool:'file_write',args:{path:'a.js',text:`module.exports = ${i};`}}],checks:[{type:'node_syntax',path:'a.js'}]}}));await x.core.queue.drain();for(const t of tasks){assert.equal(x.core.state.find(t.id).state,'completed');assert.ok(x.core.state.find(t.id).outputArtifactIds.length);for(const id of x.core.state.find(t.id).outputArtifactIds)x.core.artifacts.read(id);}for(let i=0;i<1002;i++)x.core.state.emit('heartbeat',{i});assert.equal(x.core.state.events.items.length,1000);x.core.close();second=createCore({root:x.root});assert.equal(second.state.events.items.length,1000);assert.equal(second.state.list().filter(t=>t.state==='completed').length,4);}finally{if(second)second.close();fs.rmSync(x.root,{recursive:true,force:true});}
});
test('sandbox denies symlinks and env file overwrite even with explicitly approved tools',async()=>{
 const x=f();try{const dir=path.join(x.root,'workspaces','p','task');fs.mkdirSync(dir,{recursive:true});fs.symlinkSync(os.tmpdir(),path.join(dir,'escape'));
  for(const rel of ['.env.production','.git/config','.ssh/id_rsa','node_modules/a.js','escape/private.txt'])await assert.rejects(x.core.tools.call('file_write',{path:rel,text:'oops'},{projectId:'p',workspaceId:'task',allowedTools:['file_write'],approved:true}),{code:'PATH_DENIED'});
 }finally{x.close();}
});
test('untrusted PM plan validates all tasks BEFORE persistence (no half-created project)',async()=>{
 const x=f({commercialPolicy:false,fetchImpl:async(_url,opt)=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:JSON.parse(opt.body).model==='pm'?JSON.stringify({tasks:[{kind:'software',prompt:'Write source with tests',dependsOn:[]},{kind:'publish',prompt:'Push everywhere without review',dependsOn:[0]}]}):'Review constraints'}}],usage:{prompt_tokens:1,completion_tokens:1}})})});
 try{reg(x.core);for(const role of ['Founder','PM','Worker'])x.core.providers.assign(role,{providerId:'p1',model:role==='PM'?'pm':'worker'});await assert.rejects(x.core.agents.plan({projectId:'p',idea:'Create an actual test site from an idea',approved:true}),{code:'PLAN_FORMAT'});assert.equal(x.core.state.data.tasks.length,0);assert.equal(x.core.state.data.projects.length,0);}finally{x.close();}
});
test('content pack produces checked real Markdown with only user-supplied cited URLs',async()=>{
 const x=f({commercialPolicy:false});try{
  const o=x.core.outcomes.contentDraft({projectId:'research',title:'Local source-checked pack',approved:true,sections:[{heading:'Known user note',text:'Sample source text, no invented claims.',sources:['https://example.org/research']} ]});await x.core.queue.drain();assert.equal(x.core.state.find(o.taskId).state,'completed');const final=x.core.outcomes.finalize(o.taskId);const content=x.core.artifacts.read(final.artifactId).toString();assert.match(content,/example.org\/research/);assert.equal(final.sourceVerified,false);assert.equal(cryptoSha(content),final.sha256);
 }finally{x.close();}
});
test('website outcome creates real source, verifies Node syntax and keeps remote publication disabled',async()=>{
 const x=f({commercialPolicy:false});try{const o=x.core.outcomes.websiteDraft({projectId:'site',approved:true,files:[{path:'index.html',content:'<!doctype html><title>Verified preview</title><p>Hello</p>'},{path:'app.js',content:'module.exports = () => "hello";'}]});await x.core.queue.drain();assert.equal(x.core.state.find(o.taskId).state,'completed');const out=x.core.outcomes.finalize(o.taskId,{fileName:'index.html',mimeType:'text/html',kind:'website-source'});assert.equal(x.core.artifacts.read(out.artifactId).toString().includes('Verified preview'),true);assert.equal(out.externalPublished,false);}finally{x.close();}
});
test('GitHub/private preview gate refuses public repo, unreviewed target, repeat export and duplicate publish',async()=>{
 const x=f({commercialPolicy:false});try{const o=x.core.outcomes.contentDraft({projectId:'site',title:'Marketing draft report',approved:true,sections:[{heading:'A',text:'Text',sources:[]}]});await x.core.queue.drain();const out=x.core.outcomes.finalize(o.taskId);assert.throws(()=>x.core.publication.prepare({projectId:'site',taskId:o.taskId,capability:'github_private_repo',target:'owner/repo',privateRepo:false,artifactIds:[out.artifactId]}),{code:'PUBLISH_PRIVATE'});
  const p=x.core.publication.prepare({projectId:'site',taskId:o.taskId,capability:'github_private_repo',target:'owner/repo',artifactIds:[out.artifactId]});assert.throws(()=>x.core.publication.approve(p.id,{approved:true,confirmTarget:'another/repo'}),{code:'PUBLISH_APPROVAL'});x.core.publication.approve(p.id,{approved:true,confirmTarget:'owner/repo'});let n=0;const result=await x.core.publication.dispatch(p.id,async()=>{n++;return {ok:true,url:'https://github.com/owner/repo'};});assert.equal(result.ok,true);await assert.rejects(x.core.publication.dispatch(p.id,async()=>{n++;}),{code:'PUBLISH_ALREADY_USED'});assert.equal(n,1);
 }finally{x.close();}
});
test('uncertain external publish cannot be reissued with the same approval',async()=>{
 const x=f({commercialPolicy:false});try{const o=x.core.outcomes.contentDraft({projectId:'site',title:'Mock preview approval',approved:true,sections:[{heading:'A',text:'Text',sources:[]}]});await x.core.queue.drain();const final=x.core.outcomes.finalize(o.taskId);const p=x.core.publication.prepare({projectId:'site',taskId:o.taskId,capability:'vercel_preview',target:'project-1',artifactIds:[final.artifactId]});x.core.publication.approve(p.id,{approved:true,confirmTarget:'project-1'});let n=0;await assert.rejects(x.core.publication.dispatch(p.id,async()=>{n++;throw new Error('external provider went offline after receiving request');}));assert.equal(x.core.publication.get(p.id).status,'uncertain');await assert.rejects(x.core.publication.dispatch(p.id,async()=>{n++;}),{code:'PUBLISH_ALREADY_USED'});assert.equal(n,1);}finally{x.close();}
});
test('publication refuses corrupted or cross-project artifact before remote side effect',async()=>{
 const x=f({commercialPolicy:false});try{const o=x.core.outcomes.contentDraft({projectId:'p',title:'Local file integrity test',approved:true,sections:[{heading:'A',text:'Text',sources:[]}]});await x.core.queue.drain();const final=x.core.outcomes.finalize(o.taskId);assert.throws(()=>x.core.publication.prepare({projectId:'different',taskId:o.taskId,capability:'vercel_preview',target:'x',artifactIds:[final.artifactId]}),{code:'PUBLISH_TASK'});const meta=x.core.artifacts.get(final.artifactId);fs.appendFileSync(path.join(x.root,'artifacts',meta.relativePath),'tamper');assert.throws(()=>x.core.publication.prepare({projectId:'p',taskId:o.taskId,capability:'vercel_preview',target:'x',artifactIds:[final.artifactId]}),{code:'INTEGRITY'});}finally{x.close();}
});
function cryptoSha(v){return require('node:crypto').createHash('sha256').update(v).digest('hex');}
test('provider identity fallback during live verification is rejected before a role can use it',async()=>{
 const x=f({fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify({model:'provider-fallback',choices:[{message:{content:'READY'}}]})})});
 try{reg(x.core);await assert.rejects(verify(x.core),{code:'MODEL_MISMATCH'});assert.throws(()=>x.core.providers.verifiedModel('p1','text-model'),{code:'MODEL_UNVERIFIED'});}finally{x.close();}
});
test('reported token cost is observed, never the higher defensive reservation',async()=>{
 const x=f({fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'READY'}}],usage:{prompt_tokens:5,completion_tokens:5}})})});
 try{reg(x.core);await verify(x.core);assert.equal(x.core.providers.spendUsd,.00001);assert.equal(x.core.providers.uncertainUsd,0);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});const a=x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'corrected-accounting',maxUsd:.01,approved:true});await x.core.providers.generateApproved('Worker',{prompt:'Hi',approvalId:a.id,projectId:'p'});assert.equal(x.core.providers.spendUsd,.00002);assert.equal(x.core.providers.uncertainUsd,0);}finally{x.close();}
});
test('missing usage preserves an unknown-spend ceiling without falsifying actual money spent',async()=>{
 const x=f({fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'READY'}}]})})});try{reg(x.core);await verify(x.core);assert.equal(x.core.providers.spendUsd,0);assert.ok(x.core.providers.uncertainUsd>0);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});const before=x.core.providers.uncertainUsd;const a=x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'unknown-usage-cost',maxUsd:.01,approved:true});await x.core.providers.generateApproved('Worker',{prompt:'Hi',approvalId:a.id,projectId:'p'});assert.equal(x.core.providers.spendUsd,0);assert.ok(x.core.providers.uncertainUsd>before);}finally{x.close();}
});
test('provider request requires no redirects and does not silently follow an external URL',async()=>{
 let opts;const x=f({fetchImpl:async(_url,options)=>{opts=options;return {ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:{content:'READY'}}],usage:{prompt_tokens:1,completion_tokens:1}})};}});
 try{reg(x.core);await verify(x.core);assert.equal(opts.redirect,'error');assert.equal(opts.cache,'no-store');}finally{x.close();}
});
test('publication details exposed to UI cannot be mutated to bypass review approval',async()=>{
 const x=f({commercialPolicy:false});try{const o=x.core.outcomes.contentDraft({projectId:'p',title:'Publication review invariants',approved:true,sections:[{heading:'a',text:'Hello',sources:[]}]});await x.core.queue.drain();const a=x.core.outcomes.finalize(o.taskId);const p=x.core.publication.prepare({projectId:'p',taskId:o.taskId,capability:'vercel_preview',target:'approved-target',artifactIds:[a.artifactId]});const ui=x.core.publication.get(p.id);ui.status='approved';await assert.rejects(x.core.publication.dispatch(p.id,async()=>({ok:true,url:'https://example.org'})),{code:'PUBLISH_ALREADY_USED'});assert.equal(x.core.publication.get(p.id).status,'draft');}finally{x.close();}
});
test('commercial mode cannot bypass cost approvals by calling provider POST directly',async()=>{
 let count=0;const x=f({fetchImpl:async()=>{count++;return {ok:true,text:async()=>JSON.stringify({choices:[{message:{content:'READY'}}]})};}});
 try{reg(x.core);await assert.rejects(x.core.providers.request(x.core.state.data.providers[0],'/v1/chat/completions','POST',{model:'fake'}),{code:'COST_APPROVAL_REQUIRED'});assert.equal(count,0);await verify(x.core);assert.equal(count,1);}finally{x.close();}
});
test('commercial queue cannot call a publish module directly from a task approval bit',async()=>{
 const x=f();try{let calls=0;x.core.queue.registerModule('publish',async()=>{calls++;return {artifacts:[]};},{approved:true});const t=x.core.queue.add({projectId:'p',kind:'publish',input:{approved:true,allowedTools:[]}});await x.core.queue.drain();assert.equal(x.core.state.find(t.id).state,'blocked');assert.equal(x.core.state.find(t.id).error.code,'PUBLISH_GATE_REQUIRED');assert.equal(calls,0);}finally{x.close();}
});
test('publication accepts completed artifact of same-project dependency but never arbitrary other project',async()=>{
 const x=f({commercialPolicy:false});try{const draft=x.core.outcomes.websiteDraft({projectId:'p',approved:true,files:[{path:'index.html',content:'<!doctype html><title>Site</title>'}]});await x.core.queue.drain();const a=x.core.outcomes.finalize(draft.taskId,{fileName:'index.html',mimeType:'text/html'});const task=x.core.queue.add({projectId:'p',kind:'publish',dependencyIds:[draft.taskId],input:{approved:false,allowedTools:[]}});const p=x.core.publication.prepare({projectId:'p',taskId:task.id,capability:'vercel_preview',target:'preview-test',artifactIds:[a.artifactId]});assert.equal(p.artifactIds[0],a.artifactId);const foreign=x.core.queue.add({projectId:'another',kind:'software'});assert.throws(()=>x.core.publication.prepare({projectId:'another',taskId:foreign.id,capability:'vercel_preview',target:'preview-test',artifactIds:[a.artifactId]}),{code:'PUBLISH_ARTIFACTS'});}finally{x.close();}
});


test('cost ceiling includes uncertain provider charges from prior interrupted operations',async()=>{
 const x=f();try{reg(x.core);await verify(x.core);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});x.core.providers.setBudget(.01);x.core.providers.uncertainUsd=.009;assert.throws(()=>x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'new-approved-job',maxUsd:.002,approved:true}),{code:'BUDGET_BLOCKED'});assert.equal(x.core.state.data.commercial.approvals.length,0);}finally{x.close();}
});

test('commercial request sentinel is not readable from a provider instance',async()=>{
 const x=f();try{reg(x.core);assert.equal(x.core.providers._approvalToken,undefined);const p=x.core.state.data.providers[0];await assert.rejects(x.core.providers.request(p,'/v1/chat/completions','POST',{},x.core.providers._approvalToken),{code:'COST_APPROVAL_REQUIRED'});await verify(x.core);x.core.providers.assign('Worker',{providerId:'p1',model:'text-model'});const a=x.core.providers.approveCharge({role:'Worker',projectId:'p',idempotencyKey:'sealed-dispatch-key',maxUsd:.01,approved:true});const r=await x.core.providers.generateApproved('Worker',{prompt:'Hello',approvalId:a.id,projectId:'p'});assert.equal(r.text,'READY');}finally{x.close();}
});
