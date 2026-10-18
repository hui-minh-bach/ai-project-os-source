import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createIntegrationHost} from '../src/lib/integration-host.mjs';
const require=createRequire(import.meta.url);
const timeline=require('../integrations/media-engine/src/timeline.cjs');
const SAMPLE=new URL('../integrations/media-engine/artifacts/samples/source.mp4',import.meta.url);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const probe=p=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',p],{encoding:'utf8',timeout:6000}));
const media=p=>{const info=probe(p),sha256=hash(p);return {path:p,seconds:Number(info.format.duration),sha256,artifactId:'sha256:'+sha256,streams:info.streams};};
function fixture(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'aios-integrator-'));let host;
try{host=createIntegrationHost({root,clock:false});assert.equal(host.status().core.status,'active');const folder=path.join(host.mediaWorkspace,'uploads');fs.mkdirSync(folder,{recursive:true});const source=path.join(folder,'actual.mp4');fs.copyFileSync(SAMPLE,source);return fn({host,source,root});}
finally{host?.stop();fs.rmSync(root,{force:true,recursive:true});}}
const renderParams=(source,plan)=>({projectId:'fixture',operation:'media.render',params:{source:path.relative(path.join(path.dirname(path.dirname(source))),source),editPlan:plan}});
function sourceRelative(host,source){return path.relative(host.mediaWorkspace,source);}
test('integration: host checks actual FFprobe duration, not plan self-report',()=>fixture(({host,source})=>{
 const current=media(source),fake={...current,seconds:current.seconds+10};
 const plan=timeline.validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:fake.seconds-.1}]},fake);
 assert.throws(()=>host.submit({projectId:'fixture',operation:'media.render',params:{source:sourceRelative(host,source),editPlan:plan}}),{code:'MEDIA_PLAN_SOURCE'});
 assert.equal(host.listTasks('fixture').length,0);
}));
test('integration: host refuses v1 plans before approval',()=>fixture(({host,source})=>{
 const current=media(source);const legacy=timeline.validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:current.seconds}]},{path:source,seconds:current.seconds});
 assert.throws(()=>host.submit({projectId:'fixture',operation:'media.render',params:{source:sourceRelative(host,source),editPlan:legacy}}),{code:'MEDIA_PLAN_SOURCE'});
 assert.equal(host.listTasks('fixture').length,0);
}));
test('integration: host detects modified video after queue, before approval',()=>fixture(({host,source})=>{
 const current=media(source),plan=timeline.validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:current.seconds}]},current);
 const t=host.submit({projectId:'fixture',operation:'media.render',params:{source:sourceRelative(host,source),editPlan:plan}});assert.equal(t.state,'paused');
 fs.appendFileSync(source,Buffer.from('tamper-after-plan'));
 assert.throws(()=>host.action(t.id,'approve'),{code:'MEDIA_PLAN_SOURCE'});
 assert.equal(host.listTasks('fixture')[0].state,'paused');
}));
test('integration: quick edit also binds source before user approval',()=>fixture(({host,source})=>{
 const t=host.submit({projectId:'fixture',operation:'media.quick-edit',params:{source:sourceRelative(host,source),prompt:'Cắt video còn 2 giây'}});
 fs.appendFileSync(source,'tamper');
 assert.throws(()=>host.action(t.id,'approve'),{code:'MEDIA_PLAN_SOURCE'});
}));
test('integration: authentic source remains eligible for approval',()=>fixture(({host,source})=>{
 const current=media(source),plan=timeline.validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:current.seconds}]},current);
 const t=host.submit({projectId:'fixture',operation:'media.render',params:{source:sourceRelative(host,source),editPlan:plan}});
 assert.equal(t.state,'paused');const next=host.action(t.id,'approve');assert.notEqual(next.state,'paused');
}));
