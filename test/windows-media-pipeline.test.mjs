import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';
import {windowsSpeechStatus,selectSpeechVoice,windowsSpeechSynthesize,inspectWave} from '../src/lib/windows-speech.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'windows-voice-contract-'));after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const voices=[{id:'sapi:English',name:'English',culture:'en-US',enabled:true,engine:'sapi'},{id:'winrt:Viet',name:'Vietnamese WinRT test',culture:'vi-VN',enabled:true,engine:'winrt'},{id:'sapi:Viet',name:'Vietnamese SAPI test',culture:'vi-VN',enabled:true,engine:'sapi'}];
function wave(){const n=16000,b=Buffer.alloc(n*2+44);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(16000,24);b.writeUInt32LE(32000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)b.writeInt16LE(Math.round(1200*Math.sin(i*.2)),44+i*2);return b;}
test('Windows discovery uses actual installed vi voices and prefers WinRT; never defaults to English',()=>{
 const calls=[];const status=windowsSpeechStatus({platform:'win32',run:(exe,args,options)=>{calls.push({exe,args,options});return {status:0,stdout:JSON.stringify(voices)};}});
 assert.equal(status.voiceId,'winrt:Viet');assert.equal(status.ready,true);assert.equal(selectSpeechVoice(voices,'vi','sapi:Viet').engine,'sapi');assert.equal(selectSpeechVoice(voices,'vi','English'),null);
 assert.deepEqual(JSON.parse(calls[0].options.input),{mode:'probe'});assert.ok(calls[0].args.includes('-EncodedCommand'));assert.ok(!calls[0].args.includes('-ExecutionPolicy'));
 const absent=windowsSpeechStatus({platform:'win32',run:()=>({status:0,stdout:JSON.stringify([voices[0]])})});assert.equal(absent.ready,false);assert.equal(absent.reason,'no-installed-vietnamese-voice');
 assert.equal(windowsSpeechStatus({platform:'linux'}).ready,false);
});
test('Windows synthesis passes Unicode text as stdin data, validates WAV and reports exact installed voice (process fixture, not real Windows)',async()=>{
 const text='Xin ch\u00e0o Vi\u1ec7t Nam. \"; Remove-Item C:/must-not-run; $env:TOKEN',output=path.join(dir,'voice.wav');let request;
 const spawnImpl=(exe,args)=>{const c=new EventEmitter();c.stdin=new PassThrough();c.stderr=new PassThrough();c.kill=()=>{};let input='';c.stdin.on('data',b=>input+=b);c.stdin.on('finish',()=>{request=JSON.parse(input);assert.ok(!Buffer.from(args.at(-1),'base64').toString('utf16le').includes(text));fs.writeFileSync(request.output,wave());setImmediate(()=>c.emit('close',0));});return c;};
 const r=await windowsSpeechSynthesize({text,output,voice:'sapi:Viet',statusProvider:()=>({voices}),spawnImpl});assert.equal(request.text,text);assert.equal(request.voiceId,'sapi:Viet');assert.equal(r.provider,'windows-sapi');assert.equal(r.voiceId,'sapi:Viet');assert.ok(inspectWave(fs.readFileSync(output)).dataBytes>0);assert.equal(fs.readdirSync(dir).filter(f=>f.includes('partial')).length,0);
});
test('Windows failure never silently selects another engine or a paid API',async()=>{
 let invoked=false;await assert.rejects(windowsSpeechSynthesize({text:'a',output:path.join(dir,'x.wav'),statusProvider:()=>({voices:[voices[0]]}),spawnImpl:()=>{invoked=true;}}),e=>e.code==='BLOCKED_WINDOWS_TTS');assert.equal(invoked,false);
 assert.throws(()=>inspectWave(Buffer.from('not a wav')),e=>e.code==='BLOCKED_WINDOWS_TTS');
 const broken=wave();broken.writeUInt32LE(99999999,40);assert.throws(()=>inspectWave(broken),/Incomplete/);
});
