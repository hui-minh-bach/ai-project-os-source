import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createRequire} from 'node:module';
import {imageSceneOnce} from '../src/lib/image-scene-checkpoint.mjs';
import {createComfyImageBridge} from '../src/lib/comfyui-local.mjs';
import {createIntegrationHost} from '../src/lib/integration-host.mjs';
const require=createRequire(import.meta.url);
const {createPng}=require('../integrations/media-engine/src/images.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-finish-'));after(()=>fs.rmSync(root,{recursive:true,force:true}));
const workflow=JSON.stringify({'4':{class_type:'CLIPTextEncode',inputs:{text:'__AIOS_PROMPT__'}},'22':{class_type:'SaveImage',inputs:{images:['8',0]}}});

test('One job resumed after crash does not regenerate completed images; changed prompt cannot reuse old result',async()=>{
 const dir=path.join(root,'scenes');let generated=0;
 const generate=async file=>{generated++;createPng(file,{width:64,height:64,seed:'real bytes scene '+generated});return {file,provider:'comfyui-local',model:'fixture-model',bytes:fs.statSync(file).size,attempts:[{state:'completed'}]};};
 const req1={prompt:'village in Mekong Delta',imageProvider:'auto',size:'1024x1024',paidApproved:false};
 const s1=await imageSceneOnce({dir,index:0,request:req1,generate});assert.equal(s1.resumed,false);
 await assert.rejects(imageSceneOnce({dir,index:1,request:{...req1,prompt:'rainy river'},generate:async()=>{throw Error('Provider connection lost');}}),/Provider connection lost/);
 const afterRestart=await imageSceneOnce({dir,index:0,request:req1,generate:async()=>{throw Error('Do not re-bill already completed scene!');}});
 assert.equal(afterRestart.resumed,true);assert.equal(generated,1);
 assert.equal(afterRestart.made.file,s1.made.file);
 const changed=await imageSceneOnce({dir,index:0,request:{...req1,prompt:'tropical orchard'},generate});
 assert.equal(changed.resumed,false);assert.equal(generated,2);
 const bytes=fs.readFileSync(changed.made.file);fs.writeFileSync(changed.made.file,Buffer.concat([bytes,Buffer.from('tamper')]));
 const fixed=await imageSceneOnce({dir,index:0,request:{...req1,prompt:'tropical orchard'},generate});assert.equal(fixed.resumed,false);assert.equal(generated,3);
});
test('Parallel clicks for the same scene join one generation instead of triggering two paid calls',async()=>{
 const dir=path.join(root,'concurrent');let calls=0,release;
 const blocker=new Promise(resolve=>{release=resolve;});
 const request={prompt:'Sunrise over Vietnam',imageProvider:'auto',paidApproved:false};
 const generate=async output=>{calls++;await blocker;createPng(output,{width:70,height:70,seed:'parallel'});return {file:output,provider:'local',bytes:fs.statSync(output).size};};
 const first=imageSceneOnce({dir,index:0,request,generate});
 const second=imageSceneOnce({dir,index:0,request,generate});
 await assert.rejects(imageSceneOnce({dir,index:0,request:{...request,prompt:'Changed mid-run'},generate}),{code:'IMAGE_SCENE_BUSY'});
 release();const [a,b]=await Promise.all([first,second]);
 assert.equal(calls,1);assert.equal(a.made.file,b.made.file);assert.equal(b.joinedInflight,true);
});
test('Workflow upload validates format and uses atomic replacement without changing previous workflow on error',()=>{
 const target=path.join(root,'owned','comfy.json');
 const bridge=createComfyImageBridge({workflowPath:target,managedWorkflowPath:target});
 assert.equal(bridge.snapshot().configured,false);
 const result=bridge.installWorkflow(workflow);assert.equal(result.configured,true);assert.equal(result.installed,true);assert.equal(result.nodes,2);
 const prev=fs.readFileSync(target,'utf8');
 assert.throws(()=>bridge.installWorkflow(JSON.stringify({'4':{class_type:'CLIPTextEncode',inputs:{text:'__AIOS_PROMPT__'}}})),{code:'COMFY_CONFIGURATION'});
 assert.throws(()=>bridge.installWorkflow('{broken json'),{code:'COMFY_CONFIGURATION'});
 assert.equal(fs.readFileSync(target,'utf8'),prev);
 const same=bridge.installWorkflow(workflow);assert.equal(same.changed,false);
 const outside=createComfyImageBridge({workflowPath:path.join(root,'external.json')});
 assert.throws(()=>outside.installWorkflow(workflow),{code:'COMFY_CONFIGURATION_OVERRIDE'});
});
test('Explicit paid API image provider cannot enter paused task without user consent; free ComfyUI is allowed',()=>{
 const folder=fs.mkdtempSync(path.join(root,'host-'));
 const host=createIntegrationHost({root:folder,clock:false});
 try{
  const args={projectId:'sandbox',operation:'media.image',params:{scenes:[{prompt:'a person studying a book'}],imageProvider:'openai-api'}};
  assert.throws(()=>host.submit(args),{code:'MEDIA_PAID_CONSENT'});
  assert.equal(host.listTasks('sandbox').length,0);
  assert.equal(host.submit({...args,params:{...args.params,confirmPaidImages:true}}).state,'paused');
  assert.equal(host.submit({...args,params:{...args.params,imageProvider:'comfyui-local'}}).state,'paused');
 }finally{host.stop();fs.rmSync(folder,{recursive:true,force:true});}
});

test('Free-first media preflight allows ComfyUI without paid quota consent and blocks forced paid route',async()=>{
 const {assertProductionReady}=await import('../src/lib/production-preflight.mjs');
 const host={status:()=>({media:{ffmpeg:true,ffprobe:true,status:'available',localTts:{ready:true},images:{available:true,configured:true,routes:['comfyui-local','gemini-api'],candidates:[{provider:'comfyui-local',paid:false},{provider:'gemini-api',paid:true}]}}})};
 assert.doesNotThrow(()=>assertProductionReady(host,'idea-film',{ttsProvider:'local',visualMode:'ai',imageProvider:'auto'}));
 assert.doesNotThrow(()=>assertProductionReady(host,'idea-film',{ttsProvider:'local',visualMode:'ai',imageProvider:'comfyui-local'}));
 assert.throws(()=>assertProductionReady(host,'idea-film',{ttsProvider:'local',visualMode:'ai',imageProvider:'gemini-api',confirmImageQuota:true}),{code:'MEDIA_IMAGE_CONSENT'});
});
