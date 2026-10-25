import test from 'node:test';import assert from 'node:assert/strict';
import {freeStackStatus} from '../src/lib/free-stack.mjs';
import {automaticProductionPlan} from '../src/lib/production-preflight.mjs';
import {placeNameLabels} from '../public/space-studio/name-labels.mjs';
const defaults={comfy:{health:async()=>({ready:false})},workers:{status:async()=>({state:'MISSING'})},ollama:async()=>({ready:false,models:[]}),speech:()=>({ready:false}),opencode:()=>({ready:false}),concat:()=>'/installed/Concat',ffmpeg:()=>({ready:true})};
const capability=(connected=false,voice=false)=>()=>({videoReady:true,voices:[{id:'windows',ready:voice,paid:false}],concat:{configured:connected}});
test('Installed Concat is not an authenticated editor; FFmpeg readiness does not supply narration',async()=>{
 let calls=0;const s=await freeStackStatus({...defaults,capabilities:capability(),concatProbe:async()=>{calls++;return {connected:true};}});
 const c=s.tools.find(t=>t.id==='concat');assert.equal(c.installed,true);assert.equal(c.ready,false);assert.equal(c.connected,false);assert.match(c.statusLabel,/Đã cài/);assert.equal(calls,0);
 assert.equal(s.tools.find(t=>t.id==='ffmpeg').ready,true);assert.equal(s.narration.ready,false);assert.equal(s.narration.rendererReady,true);assert.equal(s.narration.voiceReady,false);
});
test('Concat badge requires successful API response and does not require a discoverable executable',async()=>{
 const s=await freeStackStatus({...defaults,concat:()=>null,capabilities:capability(true,true),concatProbe:async()=>({connected:true})});
 const c=s.tools.find(t=>t.id==='concat');assert.equal(c.ready,true);assert.equal(c.installed,false);assert.equal(c.connected,true);assert.equal(s.narration.ready,true);
});
test('Stale Concat token/offline API cannot remain green',async()=>{
 const s=await freeStackStatus({...defaults,capabilities:capability(true),concatProbe:async()=>{throw Error('ECONNREFUSED');}});const c=s.tools.find(t=>t.id==='concat');assert.equal(c.ready,false);assert.equal(c.configured,true);assert.match(c.statusLabel,/chưa phản hồi/);
});
test('Narrated job reports missing voice even when both renderers are present',()=>{
 const host={status:()=>({media:{status:'available',ffmpeg:true,ffprobe:true,concat:{configured:true},images:{candidates:[{paid:false}]}}})};
 assert.throws(()=>automaticProductionPlan(host,'news-video'),e=>e.code==='MEDIA_VOICE_REQUIRED'&&e.message.includes('FFmpeg/FFprobe đã sẵn sàng'));
 host.status=()=>({media:{status:'available',ffmpeg:true,ffprobe:true,concat:{configured:true},windowsTts:{ready:true},images:{candidates:[{paid:false}]}}});
 const p=automaticProductionPlan(host,'news-video');assert.equal(p.renderEngine,'concat');assert.equal(p.ttsProvider,'windows');
});
test('Crowded names retain identity, stay near heads and never cascade into the sky',()=>{
 const points=Array.from({length:16},(_,i)=>({id:'ai-'+i,x:230+(i%4)*60,y:240+Math.floor(i/4)*46,width:70,height:22,visible:true}));
 const result=placeNameLabels(points,{width:850,height:760,top:90,bottom:620});assert.equal(result.length,16);
 for(let i=0;i<result.length;i++){const p=result[i];assert.equal(p.id,points[i].id);assert.equal(p.visible,true);assert.ok(Math.abs(p.x-p.anchorX)<=40);assert.ok(Math.abs(p.y-p.anchorY)<=26);assert.ok(p.y-p.height>=90);}
 assert.deepEqual(result,placeNameLabels(points,{width:850,height:760,top:90,bottom:620}));
});
test('Offscreen/behind-camera accounts cannot create floating labels or clickable stale tags',()=>{
 const p=placeNameLabels([{id:'behind',visible:false,x:200,y:200},{id:'header',visible:true,x:200,y:40},{id:'controls',visible:true,x:200,y:650},{id:'good',visible:true,x:200,y:300}],{width:390,height:700,top:90,bottom:600});assert.deepEqual(p.map(p=>p.visible),[false,false,false,true]);
});
