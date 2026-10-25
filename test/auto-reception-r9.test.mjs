import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticProductionPlan,assertProductionReady} from '../src/lib/production-preflight.mjs';
const status=(overrides={})=>({core:{status:'active'},media:{status:'available',ffmpeg:true,ffprobe:true,windowsTts:{ready:true,voiceId:'winrt:vi',voices:[]},localTts:{ready:true},concat:{configured:true},images:{available:true,candidates:[{id:'comfyui-local',paid:false}],routes:['local-flux']},...overrides}});
const host=x=>({status:()=>status(x)});
test('R9 one-click reception selects real local voice and Concat without additional form or paid authorization',()=>{
 const plan=automaticProductionPlan(host(), 'news-video');
 assert.equal(plan.ttsProvider,'windows');assert.equal(plan.voiceMode,'narrated');assert.equal(plan.renderEngine,'concat');assert.equal(plan.visualMode,'ai');assert.equal(plan.confirmPaidVoice,false);assert.equal(plan.confirmPaidImages,false);assertProductionReady(host(),'news-video',plan);
});
test('R9 when Concat is not configured, uses explicit FFmpeg and labels its engine',()=>{
 const plan=automaticProductionPlan(host({concat:{configured:false}}),'idea-film');assert.equal(plan.renderEngine,'ffmpeg');assert.match(plan.note,/FFmpeg/);assertProductionReady(host({concat:{configured:false}}),'idea-film',plan);
});
test('R9 never silently chooses paid voice, captions-only or procedural image when no free provider exists',()=>{
 const env=host({windowsTts:{ready:false},localTts:{ready:false},heygenOptionalConfigured:true,fptOptionalConfigured:true});
 assert.throws(()=>automaticProductionPlan(env,'news-video'),{code:'MEDIA_VOICE_REQUIRED'});
 const imageUnavailable=host({images:{available:true,candidates:[{id:'gemini-api',paid:true}],routes:['gemini-api']}});
 assert.throws(()=>automaticProductionPlan(imageUnavailable,'news-video'),{code:'MEDIA_IMAGE_REQUIRED'});
});
test('R9 article reception needs no video/audio dependency',()=>{
 assert.deepEqual(automaticProductionPlan(host({status:'offline',ffmpeg:false,ffprobe:false}),'news-article').kind,'article');
});
test('R9 uploaded owned images suppress paid-image dependency while preserving default voice',()=>{
 const uploads=['uploads/01234567-1234-4567-aaaa-123456789abc.png'];const plan=automaticProductionPlan(host({images:{available:false,candidates:[],routes:[]}}),'news-video',{imageSources:uploads});
 assert.equal(plan.visualMode,'uploads');assert.deepEqual(plan.imageSources,uploads);assertProductionReady(host({images:{available:false,candidates:[],routes:[]}}),'news-video',plan);
});
