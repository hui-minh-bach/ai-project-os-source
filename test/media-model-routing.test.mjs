import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DATA_DIR} from '../src/lib/store.mjs';
import {lockVault,unlockVault,saveConnection,getConnection} from '../src/lib/vault.mjs';
import {recordModels} from '../src/lib/model-bindings.mjs';
import {createProject,updateProjectModelRoles} from '../src/lib/projects.mjs';
import {mediaPlannerStatus,mediaModelPlan} from '../src/lib/media-ai.mjs';

const key='TEST_ONLY_NONSENSITIVE_CREDENTIAL';
function reset(){lockVault();for(const name of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak','model-registry.json','model-registry.json.bak'])fs.rmSync(path.join(DATA_DIR,name),{force:true});unlockVault('safe-mock-provider-fixture');}

test('media uses actual verified project Worker, no fake AI status, and rejects invalid AI JSON',async()=>{
 reset();const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,init)=>{
  const request=JSON.parse(init?.body||'{}');calls.push({url:String(url),request});
  const text=request.input?.includes('INVALID_RESPONSE')?'not json':JSON.stringify({kind:'edit',ratio:'9:16',framing:'crop',effects:['fade-in-out'],segments:[{start:0,end:1.5}]});
  return new Response(JSON.stringify({output_text:text,usage:{input_tokens:12,output_tokens:7}}),{status:200,headers:{'content-type':'application/json'}});
 };
 try{
  const c=saveConnection({kind:'openai',name:'Local mock GPT API',model:'mock-model',secret:key,baseUrl:'https://mock.invalid/v1/responses'});
  const p=createProject({name:'Planner model route fixture',idea:'Edit real video'});
  assert.equal(mediaPlannerStatus(p.id).available,false,'listing the account alone is not enough');
  recordModels(getConnection(c.id),['mock-model']);
  assert.equal(mediaPlannerStatus(p.id).available,true,'verified default model should be usable');
  updateProjectModelRoles(p.id,{worker:{connectionId:c.id,model:'mock-model'}});
  const status=mediaPlannerStatus(p.id);assert.equal(status.available,true);assert.equal(status.source,'project-worker');assert.equal(status.model,'mock-model');
  const payload={prompt:'Đổi video sang dọc 9:16 có hiệu ứng mờ dần',media:{seconds:4,streams:[{codec_type:'video'}]}};
  const edit=await mediaModelPlan(p.id,payload);
  assert.equal(edit.ratio,'9:16');assert.deepEqual(edit.effects,['fade-in-out']);assert.equal(edit.segments[0].end,1.5);
  assert.equal(calls.length,1);assert.equal(calls[0].request.model,'mock-model');assert.match(calls[0].request.input,/dọc 9:16/);
  assert.doesNotMatch(JSON.stringify(edit),new RegExp(key));
  await assert.rejects(()=>mediaModelPlan(p.id,{...payload,prompt:'INVALID_RESPONSE'}),/không trả kế hoạch JSON hợp lệ/);
  lockVault();assert.equal(mediaPlannerStatus(p.id).available,false,'locked Vault must disable provider routing');
 }finally{globalThis.fetch=original;lockVault();}
});
