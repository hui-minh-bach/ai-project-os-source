/** Fixture network/archive tests, not a claim of a real Piper installation. */
import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {boundedOfficialDownload,extractPiperZip,configureLocalVoice,installPiperVietnamese,PIPER_VI,PIPER_RELEASE,piperSetupStatus} from '../src/lib/piper-managed.mjs';
import {createZipBuffer} from '../src/lib/updater.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'piper-managed-r8-'));after(()=>fs.rmSync(dir,{recursive:true,force:true}));let n=0;
const file=()=>path.join(dir,'component-'+(++n));const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=Buffer.from('Nonexecuted test component bytes for integrity checks.');
const official='https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/test.onnx';
test('R8 official HTTPS download enforces the advertised model SHA and streaming size',async()=>{
 const dest=file();const r=await boundedOfficialDownload(official,dest,{maxBytes:100,sha256:digest(bytes),fetchImpl:async()=>new Response(bytes)});assert.equal(r.sha256,digest(bytes));assert.deepEqual(fs.readFileSync(dest),bytes);assert.equal(fs.existsSync(dest+'.partial'),false);
});
test('R8 wrong model hash and oversized unknown-length streams leave no accepted file',async()=>{
 for(const opts of [{maxBytes:100,sha256:'0'.repeat(64)},{maxBytes:12}]){const dest=file();await assert.rejects(boundedOfficialDownload(official,dest,{...opts,fetchImpl:async()=>new Response(bytes)}),e=>['VOICE_HASH','VOICE_SIZE'].includes(e.code));assert.equal(fs.existsSync(dest),false);assert.equal(fs.existsSync(dest+'.partial'),false);}
});
test('R8 voice downloader rejects redirects to private, unknown, credential or HTTP hosts',async()=>{
 for(const next of ['http://github.com/engine.zip','https://127.0.0.1/secret','https://github.com.evil.invalid/a','https://user:password@github.com/a']){let hits=0;await assert.rejects(boundedOfficialDownload(official,file(),{maxBytes:100,fetchImpl:async()=>{hits++;return new Response(null,{status:302,headers:{location:next}});}}),e=>e.code==='VOICE_DOWNLOAD_HOST');assert.equal(hits,1);}
});
test('R8 fixed trusted release redirect is accepted; status and size headers remain checked',async()=>{
 let hits=0;const out=file();await boundedOfficialDownload(PIPER_RELEASE.url,out,{maxBytes:100,fetchImpl:async()=>++hits===1?new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/test/engine.zip'}}):new Response(bytes)});assert.equal(hits,2);
 await assert.rejects(boundedOfficialDownload(official,file(),{maxBytes:100,fetchImpl:async()=>new Response(null,{status:404})}),e=>e.code==='VOICE_DOWNLOAD');
});
test('R8 validated Piper ZIP extracts ordinary components without execution',()=>{
 const dest=file(),z=createZipBuffer({'piper/piper.exe':'MZ-test-only-not-executable','piper/LICENSE':'fixture'});extractPiperZip(z,dest);assert.equal(fs.readFileSync(path.join(dest,'piper','LICENSE'),'utf8'),'fixture');
});
test('R8 Piper extraction rejects traversal, case collisions, encryption, symlinks and CRC corruption',()=>{
 const samples=[createZipBuffer({'piper/../outside.exe':'MZ','piper/LICENSE':'x'}),createZipBuffer({'piper/piper.exe':'MZ-test','piper/PIPER.EXE':'MZ-test'})];
 for(const mutation of ['encrypted','symlink','crc']){const b=createZipBuffer({'piper/piper.exe':'MZ-test-only','piper/LICENSE':'fixture'}),i=b.indexOf(Buffer.from('504b0102','hex'));if(mutation==='encrypted')b.writeUInt16LE(b.readUInt16LE(i+8)|1,i+8);if(mutation==='symlink')b.writeUInt32LE(0xa0000000,i+38);if(mutation==='crc')b.writeUInt32LE(42,i+16);samples.push(b);}
 for(const b of samples)assert.throws(()=>extractPiperZip(b,file()));assert.equal(fs.existsSync(path.join(dir,'outside.exe')),false);
});
function localFiles(){const d=file();fs.mkdirSync(d);const cli=path.join(d,'piper'),model=path.join(d,'vi-fixture.onnx'),config=model+'.json';fs.writeFileSync(cli,'nonexecuted test engine');fs.writeFileSync(model,'fixture');fs.writeFileSync(config,JSON.stringify({espeak:{voice:'vi'}}));return {cli,model,config};}
test('R8 manual local voice configuration needs consent and successful actual-call adapter',async()=>{
 const f=localFiles();let saved=null,calls=0;const deps={dataDir:dir,save:x=>saved=x,synthesize:async x=>{calls++;fs.writeFileSync(x.output,'fake test WAV - not speech');}};
 await assert.rejects(configureLocalVoice(f,deps),e=>e.code==='VOICE_CONSENT');assert.equal(calls,0);
 await configureLocalVoice({...f,confirm:true},deps);assert.deepEqual(saved,f);assert.equal(calls,1);
});
test('R8 failed smoke synthesis never saves broken settings; non-Vietnamese model blocked',async()=>{
 const f=localFiles();let saved=0;await assert.rejects(configureLocalVoice({...f,confirm:true},{dataDir:dir,save:()=>saved++,synthesize:async()=>{throw Error('synthesis failed');}}),/synthesis failed/);assert.equal(saved,0);
 fs.writeFileSync(f.config,JSON.stringify({espeak:{voice:'en-us'}}));await assert.rejects(configureLocalVoice({...f,confirm:true}),e=>e.code==='VOICE_LANGUAGE');
});
test('R8 install is opt-in, supported-platform gated and never implies engine signature verified',async()=>{
 let downloads=0;const deps={platform:'linux',arch:'x64',download:()=>downloads++};await assert.rejects(installPiperVietnamese({},deps),e=>e.code==='VOICE_CONSENT');await assert.rejects(installPiperVietnamese({confirm:true,acceptEngineTrust:true},deps),e=>e.code==='VOICE_PLATFORM');assert.equal(downloads,0);assert.equal(PIPER_VI.sha256.length,64);assert.match(piperSetupStatus().engineTrust,/not-signature-verified/);
});
test('R8 isolated installer contract downloads exactly pinned components then smoke-checks once',async()=>{
 const d=file();fs.mkdirSync(d);let saved=null;const calls=[];
 const deps={platform:'win32',arch:'x64',dataDir:d,save:x=>saved=x,synthesize:async x=>fs.writeFileSync(x.output,'fixture WAV, not real Piper'),download:async(url,dest,opts)=>{calls.push({url,opts});const b=url.endsWith('.zip')?createZipBuffer({'piper/piper.exe':'MZ-nonexecuted-test-engine','piper/LICENSE':'fixture'}):url.endsWith('.json')?Buffer.from('{"espeak":{"voice":"vi"}}'):Buffer.from('fixture ONNX, real download hashes tested separately');fs.writeFileSync(dest,b);return {url,sha256:digest(b),bytes:b.length};}};
 const result=await installPiperVietnamese({confirm:true,acceptEngineTrust:true},deps);assert.equal(result.ready,true);assert.equal(calls.length,3);assert.equal(calls[1].opts.sha256,PIPER_VI.sha256);assert.ok(fs.existsSync(saved.cli));assert.equal(piperSetupStatus().state,'completed');
 // A later changed model is not silently accepted or overwritten.
 await assert.rejects(installPiperVietnamese({confirm:true,acceptEngineTrust:true},deps),e=>e.code==='VOICE_HASH');assert.equal(calls.length,3);
});

 test('R8 offline voice environment excludes provider and launch credentials',async()=>{const {localVoiceEnvironment}=await import('../src/lib/local-piper-tts.mjs');const e=localVoiceEnvironment({PATH:'/bin',SystemRoot:'C:/Windows',TEMP:'/tmp',OPENAI_API_KEY:'must-not-leak',HEYGEN_API_KEY:'must-not-leak',AI_PROJECT_OS_LAUNCH_TOKEN:'must-not-leak'});assert.equal(e.PATH,'/bin');assert.equal(e.SystemRoot,'C:/Windows');assert.equal(e.OPENAI_API_KEY,undefined);assert.equal(e.HEYGEN_API_KEY,undefined);assert.equal(e.AI_PROJECT_OS_LAUNCH_TOKEN,undefined);});

// Live upstream redirect observed for the existing pinned Vietnamese model (2026-10-25).
test('Pinned voice accepts exact current Hugging Face CDN; lookalike hosts remain blocked',async()=>{
 let calls=0;await boundedOfficialDownload(official,file(),{maxBytes:100,sha256:digest(bytes),fetchImpl:async()=>++calls===1?new Response(null,{status:302,headers:{location:'https://us.aws.cdn.hf.co/xet-bridge-us/pinned-model'}}):new Response(bytes)});assert.equal(calls,2);
 await assert.rejects(boundedOfficialDownload(official,file(),{maxBytes:100,fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://us.aws.cdn.hf.co.evil.invalid/model'}})}),{code:'VOICE_DOWNLOAD_HOST'});
});

test('An existing Piper engine with missing model resumes only the missing download and preserves engine',async()=>{
 const d=file(),root=path.join(d,'local-voice','piper-'+PIPER_RELEASE.version),cli=path.join(root,'piper','piper.exe');fs.mkdirSync(path.dirname(cli),{recursive:true});fs.writeFileSync(cli,'MZ-existing-fixture-engine');let calls=0;
 await assert.rejects(installPiperVietnamese({confirm:true,acceptEngineTrust:true},{platform:'win32',arch:'x64',dataDir:d,download:async(url,dest,opts)=>{calls++;assert.equal(url,PIPER_VI.base+PIPER_VI.name+'.onnx');assert.equal(opts.sha256,PIPER_VI.sha256);throw Object.assign(Error('Fixture offline'),{code:'VOICE_DOWNLOAD'});}}),{code:'VOICE_DOWNLOAD'});
 assert.equal(calls,1);assert.equal(fs.readFileSync(cli,'utf8'),'MZ-existing-fixture-engine');
});
