import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createIntegrationHost} from '../src/lib/integration-host.mjs';

const toolAvailable=name=>{const p=spawnSync(name,['-version'],{stdio:'ignore'});return !p.error&&p.status===0};
test('offline Piper generated narration is approved, rendered, SHA-verified and does NOT call any paid API', {timeout:120000,skip:!toolAvailable('ffmpeg')||!toolAvailable('ffprobe')}, async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-local-tts-host-'));let host;
 try{
  const model=path.join(dir,'vi-voice.onnx'),cli=path.join(dir,'fake-piper'),audio=path.join(dir,'fixture.wav');
  fs.writeFileSync(model,'test model');
  execFileSync('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','sine=frequency=410:duration=2.6','-c:a','pcm_s16le',audio],{timeout:30000});
  fs.writeFileSync(cli,`#!/usr/bin/env node
const fs=require('fs');
if(process.argv.includes('--help'))process.exit(0);
const p=process.argv.indexOf('--output_file');
fs.copyFileSync(${JSON.stringify(audio)},process.argv[p+1]);
`,{mode:0o755});
  let networkCalls=0;
  host=createIntegrationHost({root:dir,clock:false,env:{PIPER_CLI_PATH:cli,PIPER_MODEL_PATH:model,HEYGEN_API_KEY:'must-not-be-used',HEYGEN_TTS_VOICE_ID:'voice123456'},ttsFetch:async()=>{networkCalls++;throw Error('cloud blocked');}});
  const upload=path.join(host.mediaWorkspace,'uploads');fs.mkdirSync(upload,{recursive:true});
  execFileSync('ffmpeg',['-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=320x180:r=25:d=1.8','-c:v','libx264','-pix_fmt','yuv420p',path.join(upload,'src.mp4')],{timeout:30000});
  assert.equal(host.status().media.ttsProvider,'piper-local');
  assert.equal(host.status().media.concat.speech,'available-in-editor-not-in-json-rpc-0.2');
  const task=host.submit({projectId:'sample',operation:'media.tts-video',params:{source:'uploads/src.mp4',text:'Chao moi nguoi',ttsProvider:'local'}});
  assert.equal(task.state,'paused');await host.core.queue.drain();assert.equal(networkCalls,0);
  host.action(task.id,'approve');await host.core.queue.drain();
  const job=host.core.state.find(task.id);
  assert.equal(job.state,'completed',JSON.stringify(job.error));
  assert.equal(networkCalls,0,'local option must not fall back to HeyGen');
  const artifacts=host.listArtifacts('sample');for(const name of ['generated-natural-voice.wav','video-with-ai-narration.mp4','tts-video-report.json'])assert.ok(artifacts.some(x=>x.name===name),name);
  const report=JSON.parse(host.artifact(artifacts.find(x=>x.name==='tts-video-report.json').id).bytes);
  assert.equal(report.provider,'piper-local');assert.equal(report.source,'offline-licensed-model');assert.equal(report.qa.passed,true);
 }finally{host?.stop();fs.rmSync(dir,{recursive:true,force:true})}
});

test('UI does not force HeyGen; local TTS without model cannot silently pay cloud',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-local-blocked-'));let host;
 try{
  host=createIntegrationHost({root:dir,clock:false,env:{HEYGEN_API_KEY:'notrealkey',HEYGEN_TTS_VOICE_ID:'voice123'}});
  const upload=path.join(host.mediaWorkspace,'uploads');fs.mkdirSync(upload,{recursive:true});fs.writeFileSync(path.join(upload,'sample.mp4'),Buffer.from('x'));
  assert.throws(()=>host.submit({projectId:'sample',operation:'media.tts-video',params:{source:'uploads/sample.mp4',text:'Xin chao',ttsProvider:'local'}}),e=>e.code==='BLOCKED_LOCAL_TTS');
  assert.throws(()=>host.submit({projectId:'sample',operation:'media.tts-video',params:{source:'uploads/sample.mp4',text:'Xin chao'}}),e=>e.code==='BLOCKED_LOCAL_TTS');
  assert.equal(host.listTasks('sample').length,0);
 }finally{host?.stop();fs.rmSync(dir,{recursive:true,force:true})}
});
