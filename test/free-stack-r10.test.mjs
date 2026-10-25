import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createComfyImageBridge,localComfyUrl} from '../src/lib/comfyui-local.mjs';
import {createImageRouter} from '../src/lib/image-gen.mjs';
import {ollamaLocalStatus,freeStackStatus} from '../src/lib/free-stack.mjs';
const require=createRequire(import.meta.url),{createPng}=require('../integrations/media-engine/src/images.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-free-'));
after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const png=path.join(dir,'photo.png');createPng(png,{width:280,height:160,seed:'controlled fixture NOT AI output'});const bytes=fs.readFileSync(png);
const workflowFile=path.join(dir,'comfy-workflow.json');
const workflow={'9':{class_type:'CLIPTextEncode',inputs:{text:'Illustrate: __AIOS_PROMPT__'}},'18':{class_type:'SaveImage',inputs:{images:['7',0],filename_prefix:'AIOS'}}};
fs.writeFileSync(workflowFile,JSON.stringify(workflow));
const uid='12345678-1234-4123-9123-123456789abc';
let graphSubmitted=null;
const mockFetch=async(url,opts={})=>{
 const u=new URL(url);
 if(u.pathname==='/system_stats')return Response.json({devices:[{name:'mock-gpu',type:'cuda'}]});
 if(u.pathname==='/prompt'){graphSubmitted=JSON.parse(opts.body);return Response.json({prompt_id:uid});}
 if(u.pathname==='/history/'+uid)return Response.json({[uid]:{outputs:{'18':{images:[{filename:'aios_output.png',subfolder:'',type:'output'}]}},status:{status_str:'success',completed:true}}});
 if(u.pathname==='/view')return new Response(bytes,{status:200,headers:{'content-type':'image/png'}});
 return Response.json({error:'not found'},{status:404});
};
const bridge=createComfyImageBridge({workflowPath:workflowFile,fetchImpl:mockFetch,sleep:async()=>{},maxWaitMs:1000});
test('ComfyUI bridge refuses external hosts / credential URLs (no SSRF)',()=>{
 for(const bad of ['https://127.0.0.1:8188','http://192.168.0.1:8188','http://10.0.0.1:8188','http://user:pass@localhost:8188','http://example.com:8188','http://127.0.0.1:8188/foo'])assert.throws(()=>localComfyUrl(bad),{code:'COMFY_SECURITY'});
 assert.equal(localComfyUrl('http://127.0.0.1:8188'),'http://127.0.0.1:8188');
});
test('ComfyUI sends a real API graph and saves returned image bytes without guessing a model',async()=>{
 const h=await bridge.health();assert.equal(h.ready,true);assert.equal(h.configured,true);
 const out=await bridge.generate({prompt:'A forest in Vietnam',output:path.join(dir,'scene.png'),expectedWorkflowHash:h.workflowHash});
 assert.equal(out.provider,'comfyui-local');assert.equal(out.paid,false);assert.deepEqual(fs.readFileSync(out.file),bytes);
 assert.equal(graphSubmitted.prompt['9'].inputs.text,'Illustrate: A forest in Vietnam');assert.equal(graphSubmitted.prompt['18'].class_type,'SaveImage');
});
test('ComfyUI requires placeholder and fails closed after workflow edits',async()=>{
 const snap=bridge.snapshot();fs.writeFileSync(workflowFile,JSON.stringify({'1':{class_type:'SaveImage',inputs:{}}}));
 assert.equal(bridge.snapshot().configured,false);
 await assert.rejects(bridge.generate({prompt:'example',output:path.join(dir,'missing.png')}),{code:'COMFY_CONFIGURATION'});
 fs.writeFileSync(workflowFile,JSON.stringify({...workflow,'21':{class_type:'PreviewImage',inputs:{images:['7',0]}}}));
 await assert.rejects(bridge.generate({prompt:'example',output:path.join(dir,'changed.png'),expectedWorkflowHash:snap.workflowHash}),{code:'IMAGE_IDENTITY_CHANGED'});
 fs.writeFileSync(workflowFile,JSON.stringify(workflow));
});
test('Image AUTO uses configured ComfyUI free-first; does not call a paid AI',async()=>{
 let billed=0,local=0;
 const accounts=[{id:'open',kind:'openai',name:'billed',secret:'fixture-key',credentialVersion:'v1'}];
 const helper={snapshot:()=>({configured:true,workflowHash:'fixture-hash'}),health:async()=>({configured:true,ready:true}),generate:async({output,prompt})=>{local++;const file=output.replace(/\.[^.]+$/,'')+'.png';fs.writeFileSync(file,bytes);return {provider:'comfyui-local',file,bytes:bytes.length};}};
 const router=createImageRouter({list:()=>accounts,get:()=>accounts[0],availability:()=>({models:['gpt-image-1']}),unlocked:()=>true,discover:async()=>{},comfyBridge:helper,worker:{_record:()=>null},fetchImpl:async()=>{billed++;throw Error('No paid API should run.');}});
 const pool=await router.prepare({provider:'auto',allowPaid:false});assert.equal(pool.length,1);assert.equal(pool[0].provider,'comfyui-local');
 const result=await router.generate({provider:'auto',prompt:'A tree',output:path.join(dir,'free-first.png'),pool});
 assert.equal(result.provider,'comfyui-local');assert.equal(result.connectionId,'local:comfyui');assert.equal(billed,0);assert.equal(local,1);
});
test('Free-first can try local Flux after ComfyUI failure, without switching to paid API',async()=>{
 let calls=0,billed=0;
 const router=createImageRouter({list:()=>[{id:'a',kind:'openai',secret:'paid',credentialVersion:'v1',name:'Paid'}],get:()=>({id:'a',kind:'openai',secret:'paid',credentialVersion:'v1',name:'Paid'}),availability:()=>({models:['gpt-image-1']}),unlocked:()=>true,discover:async()=>{},comfyBridge:{snapshot:()=>({configured:true,workflowHash:'wf'}),health:async()=>({ready:true}),generate:async()=>{calls++;throw Object.assign(Error('Local offline'),{code:'COMFY_OFFLINE'});}},worker:{_record:()=>({state:'READY',enabled:true,installedAt:'v1'}),generateImage:async({outputBase})=>{calls++;const file=outputBase.replace(/\.[^.]+$/,'')+'.png';fs.writeFileSync(file,bytes);return {file,bytes:bytes.length,provenance:{model:'local-test-model'}};}},fetchImpl:async()=>{billed++;throw Error('Never call a paid provider.');}});
 const pool=await router.prepare({allowPaid:false});assert.equal(pool.length,2);
 const made=await router.generate({prompt:'Forest',output:path.join(dir,'free-fallback.png'),pool,maxAttempts:3});assert.equal(made.provider,'local-flux');assert.equal(made.attempts.length,2);assert.equal(calls,2);assert.equal(billed,0);
});
test('ComfyUI policy prevents tampering with approved local binding',async()=>{
 const router=createImageRouter({list:()=>[],get:()=>null,availability:()=>({}),unlocked:()=>true,comfyBridge:{snapshot:()=>({configured:true,workflowHash:'stable'}),health:async()=>({ready:true}),generate:async()=>{throw Error('Not invoked');}},worker:{_record:()=>null}});
 const pool=await router.prepare({provider:'auto'});
 await assert.rejects(router.generate({prompt:'x',output:path.join(dir,'tamper.png'),pool:[{...pool[0],paid:true}]}),{code:'IMAGE_SECURITY'});
 await assert.rejects(router.generate({prompt:'x',output:path.join(dir,'tamper2.png'),pool:[{...pool[0],bindingHash:'wrong'}]}),{code:'IMAGE_IDENTITY_CHANGED'});
});
test('Ollama readiness only probes loopback and distinguishes empty model catalog',async()=>{
 let called='';const s=await ollamaLocalStatus({fetchImpl:async(url)=>{called=url;return Response.json({models:[{name:'qwen-local:latest'}]});}});
 assert.equal(called,'http://127.0.0.1:11434/api/tags');assert.equal(s.ready,true);assert.deepEqual(s.models,['qwen-local:latest']);
 const empty=await ollamaLocalStatus({fetchImpl:async()=>Response.json({models:[]})});assert.equal(empty.ready,false);
});
test('Free-stack diagnostics are read-only and do not install anything',async()=>{
 const check=await freeStackStatus({comfy:{health:async()=>({ready:true,configured:true})},workers:{status:async()=>({state:'READY'})},ollama:async()=>({ready:false,models:[],reason:'none'}),speech:()=>({ready:true}),opencode:()=>({ready:true}),concat:()=>null,ffmpeg:()=>({ready:true})});
 assert.equal(check.noPaidApiCalled,true);assert.equal(check.tools.length,8);assert.equal(check.tools.find(x=>x.id==='flux2').ready,true);
});
