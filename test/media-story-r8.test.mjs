/** Engine contracts with generated fixture media; no commercial provider claims. */
import test,{after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {execFileSync,spawnSync} from 'node:child_process';
import {assertProductionReady} from '../src/lib/production-preflight.mjs';
const require=createRequire(import.meta.url);const {illustration,createPng}=require('../integrations/media-engine/src/images.cjs');const {buildStory,validateImageSources}=require('../integrations/media-engine/src/story.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'story-r8-'));after(()=>fs.rmSync(dir,{recursive:true,force:true}));fs.mkdirSync(path.join(dir,'uploads'));
const one=path.join(dir,'uploads','abcdef01-1111.png'),two=path.join(dir,'uploads','abcdef02-2222.png');createPng(one,{width:128,height:72,seed:'fixture1'});createPng(two,{width:128,height:72,seed:'fixture2'});
const available=!spawnSync('ffmpeg',['-version'],{stdio:'ignore'}).error&&!spawnSync('ffprobe',['-version'],{stdio:'ignore'}).error;
test('R8 image gateway receives prompt/provider/job id and accepts actual path/file',async()=>{
 const calls=[];for(const field of ['path','file']){const pic=await illustration({offline:false,provider:'gemini-api',description:'The requested jewellery workshop',characterSheet:'blue and gold editorial',jobId:'story-A-scene-3',output:path.join(dir,'result.png'),gateway:{invoke:async q=>{calls.push(q);return {[field]:one,provider:'fixture-image',model:'fixture-v1'};}}});assert.equal(pic.path,one);assert.equal(pic.origin,'provider');}
 for(const q of calls){assert.equal(q.capability,'image.generate');assert.equal(q.jobId,'story-A-scene-3');assert.equal(q.input.provider,'gemini-api');assert.match(q.input.prompt,/jewellery workshop/);assert.ok(q.input.prompt.length<=4000);assert.equal(q.input.description,undefined);}
});
test('R8 missing/failing AI images cannot masquerade as unrelated default art',async()=>{
 const out=path.join(dir,'no-fallback.png');for(const gateway of [undefined,{invoke:async()=>{throw Error('quota');}},{invoke:async()=>({path:'missing.png'})}])await assert.rejects(illustration({offline:false,description:'gold',output:out,gateway}));assert.equal(fs.existsSync(out),false);
});
test('R8 uploaded images validate signature, fence paths and reject escaped symlinks',()=>{
 assert.deepEqual(validateImageSources(dir,['uploads/abcdef01-1111.png']),[one]);for(const input of [[],['../secrets.png'],['uploads/unknown.png'],Array(25).fill('uploads/abcdef01-1111.png')])assert.throws(()=>validateImageSources(dir,input));
 const falseImage=path.join(dir,'uploads','bad1.png');fs.writeFileSync(falseImage,'not an image despite extension');assert.throws(()=>validateImageSources(dir,['uploads/bad1.png']),e=>e.code==='MEDIA_IMAGE_INPUT');
 if(process.platform!=='win32'){const outside=fs.mkdtempSync(path.join(os.tmpdir(),'story-r8-out-'));try{createPng(path.join(outside,'image.png'),{width:32,height:32});fs.symlinkSync(path.join(outside,'image.png'),path.join(dir,'uploads','abcdef09.png'));assert.throws(()=>validateImageSources(dir,['uploads/abcdef09.png']),/Symlink escapes|escaped workspace/);}finally{fs.rmSync(outside,{recursive:true,force:true});}}
});
test('R8 media preflight separates voice availability, image availability and explicit quota consent',()=>{
 const host={status:()=>({core:{status:'active'},media:{ffmpeg:true,ffprobe:true,status:'available',localTts:{ready:true},images:{available:true,routes:['gemini-api']}}})};
 assert.throws(()=>assertProductionReady(host,'idea-film',{ttsProvider:'local',visualMode:'uploads',imageSources:[]}),e=>e.code==='MEDIA_IMAGE_REQUIRED');
 assert.throws(()=>assertProductionReady(host,'idea-film',{ttsProvider:'local',visualMode:'ai',imageProvider:'gemini-api'}),e=>e.code==='MEDIA_IMAGE_CONSENT');
 assert.throws(()=>assertProductionReady(host,'idea-film',{ttsProvider:'local',visualMode:'ai',imageProvider:'openai-api',confirmPaidImages:true}),e=>e.code==='MEDIA_IMAGE_REQUIRED');
 assert.doesNotThrow(()=>assertProductionReady(host,'idea-film',{ttsProvider:'local',visualMode:'ai',imageProvider:'gemini-api',confirmPaidImages:true}));assert.doesNotThrow(()=>assertProductionReady(host,'news-video',{voiceMode:'captions'}));
});
function fixtureAudio(file){execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=660:duration=0.8','-c:a','pcm_s16le',file]);}
test('R8 storyboard passes selected TTS provider and retains real uploaded pictures/cache',{skip:!available,timeout:60000},async()=>{
 const jobs=path.join(dir,'job-uploads');fs.mkdirSync(jobs);const calls=[];const gateway={invoke:async q=>{calls.push(q);assert.equal(q.capability,'speech.synthesize');fixtureAudio(q.input.output);return {audioPath:q.input.output,provider:'fixture-tone-not-speech'};}};
 const opts={workspace:dir,text:'First controlled scene. Second controlled scene.',jobDir:jobs,gateway,voice:'test-voice',ttsProvider:'windows',visualMode:'uploads',imageSources:['uploads/abcdef01-1111.png','uploads/abcdef02-2222.png'],maxChars:27,karaokeCaptions:false};
 const result=await buildStory(opts);assert.equal(result.timeline.scenes.length,2);assert.equal(result.metadata.visualMode,'uploads');assert.equal(calls.length,2);assert.ok(calls.every(x=>x.input.ttsProvider==='windows'));assert.ok(result.timeline.scenes.every(s=>s.imageOrigin==='user-upload'));assert.deepEqual(fs.readFileSync(result.timeline.scenes[0].image),fs.readFileSync(one));assert.deepEqual(fs.readFileSync(result.timeline.scenes[1].image),fs.readFileSync(two));
 const before=calls.length;await buildStory(opts);assert.equal(calls.length,before,'same successful phrase cached, not resynthesized');
 await buildStory({...opts,ttsProvider:'local'});assert.equal(calls.length,before+2,'provider change invalidates voice cache');
});
test('R8 AI illustrations receive unique scene jobs and image errors propagate',{skip:!available,timeout:60000},async()=>{
 const jobs=path.join(dir,'job-ai');fs.mkdirSync(jobs);const pictures=[];const gateway={invoke:async q=>{if(q.capability==='speech.synthesize'){fixtureAudio(q.input.output);return {audioPath:q.input.output};}pictures.push(q);return {path:one,provider:'fixture'};}};
 const opts={workspace:dir,text:'First controlled scene. Second controlled scene.',jobDir:jobs,gateway,visualMode:'ai',imageProvider:'gemini-api',jobId:'independent-story',maxChars:27,karaokeCaptions:false};await buildStory(opts);assert.equal(new Set(pictures.map(q=>q.jobId)).size,2);assert.ok(pictures.every(q=>q.input.prompt));
 const fail=path.join(dir,'job-error');fs.mkdirSync(fail);await assert.rejects(buildStory({...opts,jobDir:fail,gateway:{invoke:async q=>{if(q.capability==='speech.synthesize'){fixtureAudio(q.input.output);return {audioPath:q.input.output};}throw Error('image provider quota');}}}),/image provider quota/);assert.equal(fs.existsSync(path.join(fail,'storyboard.json')),false);
});

test('R8 image upload HTTP host path accepts real PNG and removes invalid image uploads',async()=>{
 const {createIntegrationHost}=await import('../src/lib/integration-host.mjs');const root=fs.mkdtempSync(path.join(os.tmpdir(),'r8-image-host-'));const host=createIntegrationHost({root,env:{},clock:false});
 const stream=(bytes,declared=bytes.length)=>({headers:{'content-length':String(declared)},async *[Symbol.asyncIterator](){yield bytes;}});
 try{
  const png=fs.readFileSync(one),r=await host.importUpload(stream(png),'illustration.png');assert.match(r.source,/^uploads\/[a-f0-9-]+\.png$/);assert.deepEqual(fs.readFileSync(path.join(host.mediaWorkspace,r.source)),png);
  await assert.rejects(host.importUpload(stream(Buffer.from('not an image')),'wrong.jpg'),e=>e.code==='MEDIA_IMAGE_INPUT');
  await assert.rejects(host.importUpload(stream(png,20_000_001),'huge.png'),e=>e.code==='MEDIA_UPLOAD_LIMIT');
  assert.equal(fs.readdirSync(path.join(host.mediaWorkspace,'uploads')).length,1);
 }finally{host.stop();fs.rmSync(root,{recursive:true,force:true});}
});

test('R8 image crossfade retains whole spoken phrases and exact caption timeline',{skip:!available,timeout:90000},async()=>{
 const {render}=require('../integrations/media-engine/src/renderer.cjs');const jobs=path.join(dir,'story-safe-fades');fs.mkdirSync(jobs);
 const gateway={invoke:async q=>{fixtureAudio(q.input.output);return {audioPath:q.input.output,provider:'fixture-tone-not-speech'};}};
 const story=await buildStory({workspace:dir,jobDir:jobs,text:'First controlled scene. Second controlled scene.',gateway,visualMode:'uploads',imageSources:['uploads/abcdef01-1111.png','uploads/abcdef02-2222.png'],maxChars:27,resolution:'360p',transition:'crossfade',transitionSeconds:.4,karaokeCaptions:false});
 const sum=story.timeline.scenes.reduce((a,s)=>a+s.duration,0);assert.equal(story.timeline.expectedDuration,sum);assert.equal(story.timeline.scenes[1].start,story.timeline.scenes[0].duration);assert.equal(story.subtitles[1].start,story.subtitles[0].end);
 const result=await render({timeline:story.timeline,jobDir:jobs,quality:'standard',maxThreads:1});assert.ok(Math.abs(result.expectedSeconds-sum)<.001);assert.ok(Math.abs(result.actualSeconds-sum)<.2);
 const audio=spawnSync('ffmpeg',['-v','error','-i',result.file,'-vn','-f','s16le','-ac','1','-ar','8000','-'],{maxBuffer:1000000});assert.equal(audio.status,0);assert.ok(audio.stdout.length>8000*sum*2*.95);
});
