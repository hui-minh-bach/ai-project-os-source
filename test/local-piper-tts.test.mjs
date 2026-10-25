import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {piperStatus,piperSynthesize,piperVoiceFor} from '../src/lib/local-piper-tts.mjs';

test('local-first Piper adapter validates presence, produces a real RIFF WAV without network and rejects wrong voice',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-piper-test-'));
 try{
  const model=path.join(dir,'vietnamese-test.onnx'),cli=path.join(dir,'fake-piper');
  fs.writeFileSync(model,Buffer.from('fake test model'));
  fs.writeFileSync(cli,`#!/usr/bin/env node
const fs=require('fs');
if(process.argv.includes('--help'))process.exit(0);
const p=process.argv.indexOf('--output_file');
if(p<0)process.exit(2);
const audio=Buffer.alloc(44+3200);audio.write('RIFF',0);audio.writeUInt32LE(audio.length-8,4);audio.write('WAVE',8);audio.write('fmt ',12);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(16000,24);audio.writeUInt32LE(32000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(3200,40);fs.writeFileSync(process.argv[p+1],audio);
`,{mode:0o755});
  const env={PIPER_MODEL_PATH:model,PIPER_CLI_PATH:cli};
  assert.equal(piperStatus(env).ready,true);
  const wav=path.join(dir,'out.wav');
  const result=await piperSynthesize({text:'Xin chào mọi người',output:wav,env});
  assert.equal(result.provider,'piper-local');assert.ok(fs.statSync(wav).size>44);
  await assert.rejects(piperSynthesize({text:'xin',voice:'heygen-id',output:path.join(dir,'bad.wav'),env}),/chỉ dùng giọng đã cài/);
  await assert.rejects(piperSynthesize({text:'xin',output:path.join(dir,'no.wav'),env:{PIPER_CLI_PATH:cli}}),/Chưa có Piper/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('missing local engine is unavailable rather than misreported as configured',()=>{
 assert.equal(piperStatus({PIPER_CLI_PATH:'nonexistent-piper-xyz',PIPER_MODEL_PATH:'missing.onnx'}).ready,false);
});

test('piperVoiceFor maps language tags to the installed voice but leaves explicit IDs untouched',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-piper-voice-'));
 try{
  const model=path.join(dir,'vi_VN-vais1000-medium.onnx'),cli=path.join(dir,'fake-piper');
  fs.writeFileSync(model,Buffer.from('fake test model'));
  fs.writeFileSync(cli,`#!/usr/bin/env node\nif(process.argv.includes('--help'))process.exit(0);process.exit(2);\n`,{mode:0o755});
  const env={PIPER_MODEL_PATH:model,PIPER_CLI_PATH:cli};
  assert.equal(piperVoiceFor('vi',env),'vi_VN-vais1000-medium');
  assert.equal(piperVoiceFor('en',env),'vi_VN-vais1000-medium');
  assert.equal(piperVoiceFor('vi-VN',env),'vi_VN-vais1000-medium');
  assert.equal(piperVoiceFor('',env),'vi_VN-vais1000-medium');
  assert.equal(piperVoiceFor(undefined,env),'vi_VN-vais1000-medium');
  assert.equal(piperVoiceFor('vi_VN-vais1000-medium',env),'vi_VN-vais1000-medium');
  assert.equal(piperVoiceFor('2f8b1c9d4e5a6b7c8d9e0f1a2b3c4d5e',env),'2f8b1c9d4e5a6b7c8d9e0f1a2b3c4d5e');
  assert.equal(piperVoiceFor('vi',{PIPER_CLI_PATH:'nonexistent-piper-xyz',PIPER_MODEL_PATH:'missing.onnx'}),null);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
