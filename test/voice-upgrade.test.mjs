import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHeygenTts,trustedAudioUrl} from '../src/lib/heygen-tts.mjs';
import {createIntegrationHost} from '../src/lib/integration-host.mjs';
import {buildVoiceover} from '../src/lib/voiceover.mjs';

function ff(...args){execFileSync('ffmpeg',['-loglevel','error','-y',...args],{timeout:30000});}
function scratch(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'voice-upgrade-'));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
const pcm=dest=>ff('-f','lavfi','-i','sine=frequency=410:duration=2.6','-c:a','pcm_s16le',dest);
const video=dest=>ff('-f','lavfi','-i','color=c=teal:s=320x180:r=25:d=1.8','-f','lavfi','-i','sine=frequency=300:duration=1.8','-c:v','libx264','-preset','ultrafast','-c:a','aac','-pix_fmt','yuv420p','-shortest',dest);

test('no cloud key blocks synthesis, but voice import is independent',async()=>{
 const tts=createHeygenTts();assert.equal(tts.configured(),false);
 await assert.rejects(tts.synthesize({voice:'any-voice-id',text:'Xin chào',output:'/tmp/test.wav'}),{code:'BLOCKED_TTS'});
});
test('HeyGen audio URL does not allow redirects to local hosts',()=>{
 assert.throws(()=>trustedAudioUrl('http://127.0.0.1/internal'),{code:'TTS_DOWNLOAD'});
 assert.throws(()=>trustedAudioUrl('https://heygen.ai.example.net/test.wav'),{code:'TTS_DOWNLOAD'});
 assert.throws(()=>trustedAudioUrl('https://heygen.ai:8443/test.wav'),{code:'TTS_DOWNLOAD'});
 assert.equal(trustedAudioUrl('https://resource2.heygen.ai/files/audio.mp3'),'https://resource2.heygen.ai/files/audio.mp3');
});
test('HeyGen TTS adapter POSTs real endpoint and converts returned audio to PCM WAV using mock transport',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'heygen-mock-'));
 try{
  const sample=path.join(dir,'sample.wav');pcm(sample);const bytes=fs.readFileSync(sample),calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/speech'))return {ok:true,json:async()=>({data:{audio_url:'https://resource2.heygen.ai/audio.wav'}})};
    return {ok:true,headers:{get:()=>String(bytes.length)},arrayBuffer:async()=>bytes};
  };
  const tts=createHeygenTts({apiKey:'not-real-secret',defaultVoice:'voice_Test123',fetchImpl});
  const output=path.join(dir,'output.wav');const r=await tts.synthesize({text:'Xin chào',voice:'vi',output,language:'vi'});
  assert.equal(r.provider,'heygen');assert.equal(calls.length,2);
  assert.equal(calls[0].options.headers['X-Api-Key'],'not-real-secret');
  assert.equal(JSON.parse(calls[0].options.body).voice_id,'voice_Test123');
  assert.ok(fs.statSync(output).size>1000);
  const info=JSON.parse(execFileSync('ffprobe',['-v','error','-of','json','-show_streams',output],{encoding:'utf8'}));
  assert.equal(info.streams[0].codec_name,'pcm_s16le');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('media.voiceover produces a full MP4 using uploaded real voice, preserving all audio, approval required',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'worker-voice-'));let host;
 try{
  host=createIntegrationHost({root:dir,env:{},clock:false});
  assert.ok(host.status().media.operations.includes('media.voiceover'));
  const uploads=path.join(host.mediaWorkspace,'uploads');fs.mkdirSync(uploads,{recursive:true});
  const v=path.join(uploads,'original.mp4'),a=path.join(uploads,'natural.wav');video(v);pcm(a);
  const task=host.submit({projectId:'story_test',operation:'media.voiceover',params:{source:'uploads/original.mp4',audioSource:'uploads/natural.wav'}});
  assert.equal(task.state,'paused');await host.core.queue.drain();assert.equal(host.core.state.find(task.id).state,'paused');
  host.action(task.id,'approve');await host.core.queue.drain();
  assert.equal(host.core.state.find(task.id).state,'completed');
  const artifacts=host.listArtifacts('story_test');assert.ok(artifacts.some(x=>x.name==='video-with-natural-voice.mp4'));
  const output=host.artifact(artifacts.find(x=>x.name==='video-with-natural-voice.mp4').id);
  const mp4=path.join(dir,'result.mp4');fs.writeFileSync(mp4,output.bytes);
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-of','json','-show_streams','-show_format',mp4],{encoding:'utf8'}));
  assert.ok(Number(probe.format.duration)>2.5&&Number(probe.format.duration)<3.0);
  assert.ok(probe.streams.some(x=>x.codec_type==='audio'));
  const report=JSON.parse(host.artifact(artifacts.find(x=>x.name==='voiceover-report.json').id).bytes);
  assert.equal(report.qa.passed,true);assert.equal(report.alignment,'freeze-last-frame-to-preserve-full-voice');
 }finally{host?.stop();fs.rmSync(dir,{recursive:true,force:true})}
});

import {wordCaptions} from '../src/lib/voice-captions.mjs';

test('provider timestamps become timecoded subtitles, omitting start/end sentinels',()=>{
 const rows=[{word:'<start>',start:0,end:0},{word:'Xin',start:.1,end:.5},{word:'chao!',start:.5,end:.92},{word:'Toi',start:1.5,end:1.7},{word:'la',start:1.7,end:1.9},{word:'AI.',start:2.0,end:2.5},{word:'<end>',start:2.6,end:2.6}];
 const captions=wordCaptions(rows,{maxCharacters:12,audioSeconds:2.4});
 assert.equal(captions.length,2);assert.equal(captions[0].text,'Xin chao!');assert.equal(captions[1].text,'Toi la AI.');assert.equal(captions[1].end,2.4);
});

test('uploaded real narration can mix short background music and burn SRT, with stretched video',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'voice-with-music-'));
 try{
  const imports=path.join(dir,'imports');fs.mkdirSync(imports);
  video(path.join(imports,'v.mp4'));pcm(path.join(imports,'speech.wav'));
  ff('-f','lavfi','-i','sine=frequency=130:duration=0.65','-c:a','pcm_s16le',path.join(imports,'music.wav'));
  fs.writeFileSync(path.join(imports,'srt.srt'),'1\n00:00:00,200 --> 00:00:02,300\nXin chao tat ca moi nguoi!\n');
  const out=await buildVoiceover({workspace:dir,jobDir:path.join(imports,'out'),videoSource:'imports/v.mp4',audioSource:'imports/speech.wav',captionsSource:'imports/srt.srt',musicSource:'imports/music.wav',musicVolume:.09,alignment:'stretch'});
  assert.equal(out.qa.passed,true);assert.equal(out.musicMixed,true);assert.equal(out.alignment,'stretch-video-to-narration');
  assert.ok(out.qa.durationSeconds>2.5&&out.qa.durationSeconds<3);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('media.tts-video calls HeyGen once only after approval and outputs real speech, MP4, SRT via timestamps',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tts-video-host-'));let host;
 try{
  const sample=path.join(dir,'fixture.wav');pcm(sample);const bytes=fs.readFileSync(sample);
  const calls=[];
  const fetchImpl=async(url,options)=>{
   calls.push({url,method:options.method||'GET'});
   if(url.endsWith('/speech'))return {ok:true,json:async()=>({data:{request_id:'fixture-req',audio_url:'https://resource2.heygen.ai/audio.wav',duration:2.6,word_timestamps:[{word:'Xin',start:.15,end:.55},{word:'chao.',start:.6,end:1.1}]}})};
   return {ok:true,headers:{get:()=>String(bytes.length)},arrayBuffer:async()=>bytes};
  };
  host=createIntegrationHost({root:dir,env:{HEYGEN_API_KEY:'mock-key-DO-NOT-USE',HEYGEN_TTS_VOICE_ID:'voice_123456789'},ttsFetch:fetchImpl,clock:false});
  const uploads=path.join(host.mediaWorkspace,'uploads');fs.mkdirSync(uploads,{recursive:true});video(path.join(uploads,'v.mp4'));
  assert.equal(host.status().media.ttsProvider,'heygen');
  const task=host.submit({projectId:'p1',operation:'media.tts-video',params:{source:'uploads/v.mp4',text:'Xin chao.',ttsProvider:'heygen',musicVolume:.12}});
  assert.equal(task.state,'paused');await host.core.queue.drain();assert.equal(calls.length,0);
  host.action(task.id,'approve');await host.core.queue.drain();
  const item=host.core.state.find(task.id);assert.equal(item.state,'completed',JSON.stringify(item));
  assert.equal(calls.length,2);
  const arts=host.listArtifacts('p1');
  for(const name of ['generated-natural-voice.wav','video-with-ai-narration.mp4','captions.srt','tts-video-report.json'])assert.ok(arts.some(x=>x.name===name),name);
  const report=JSON.parse(host.artifact(arts.find(x=>x.name==='tts-video-report.json').id).bytes);
  assert.equal(report.provider,'heygen');assert.equal(report.captions,'heygen-provider-word-timestamps');assert.equal(report.qa.passed,true);
  assert.equal(report.ttsRequestId,'fixture-req');
 }finally{host?.stop();fs.rmSync(dir,{recursive:true,force:true})}
});

test('media.tts-video blocks missing API before any billable task is created',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tts-unconfigured-'));let host;
 try{
  host=createIntegrationHost({root:dir,env:{},clock:false});
  assert.throws(()=>host.submit({projectId:'p1',operation:'media.tts-video',params:{source:'uploads/x.mp4',text:'Xin chao.'}}));
 }finally{host?.stop();fs.rmSync(dir,{recursive:true,force:true})}
});
