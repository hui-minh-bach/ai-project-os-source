import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {illustration}=require('../integrations/media-engine/src/images.cjs');
const SIGNATURE=Buffer.from('89504e470d0a1a0a','hex');
test('real-image mode uses gateway prompt and the actual artifact; no procedural fallback',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-real-images-'));
 try{
  const source=path.join(dir,'generated.png'),output=path.join(dir,'scene.png');
  fs.writeFileSync(source,Buffer.concat([SIGNATURE,Buffer.alloc(200,1)]));
  let got;
  const gateway={invoke:async req=>{got=req;return {file:'generated.png',provider:'local-flux',model:'test-model'};}};
  const made=await illustration({gateway,description:'Solar powered city',characterSheet:'consistent',output,offline:false,strict:true,workspace:dir});
  assert.match(got.input.prompt,/Solar powered city/);
  assert.equal(got.input.provider,'local-flux');
  assert.equal(made.origin,'provider:local-flux');
  assert.equal(made.path,output);
  assert.ok(fs.existsSync(output));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('blocked image worker cannot be replaced with procedural poster',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-real-images-'));
 try{
  await assert.rejects(illustration({gateway:{invoke:async()=>{throw Object.assign(new Error('Worker offline'),{code:'BLOCKED_WORKER'});}},description:'News',output:path.join(dir,'scene.png'),offline:false,strict:true,workspace:dir}),/Worker offline/);
  assert.equal(fs.readdirSync(dir).length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('remote file escapes are blocked in real-image mode',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-workspace-'));
 const external=fs.mkdtempSync(path.join(os.tmpdir(),'aios-external-'));
 try{
  const rogue=path.join(external,'bad.png');fs.writeFileSync(rogue,Buffer.concat([SIGNATURE,Buffer.alloc(200,1)]));
  await assert.rejects(illustration({gateway:{invoke:async()=>({file:rogue})},description:'test',output:path.join(root,'scene.png'),offline:false,strict:true,workspace:root}),/outside the media workspace/);
 }finally{fs.rmSync(root,{recursive:true,force:true});fs.rmSync(external,{recursive:true,force:true});}
});
