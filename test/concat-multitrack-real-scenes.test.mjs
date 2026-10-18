import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createIntegrationHost} from '../src/lib/integration-host.mjs';
const require=createRequire(import.meta.url);
const {createMultitrackProject}=require('../integrations/media-engine/src/concat-multitrack.cjs');
const {shaFile}=require('../integrations/media-engine/src/utils.cjs');
const SAMPLE=path.resolve('integrations/media-engine/artifacts/samples/source.mp4');
function makeFixtures(dir){
  const uploads=path.join(dir,'uploads');fs.mkdirSync(uploads,{recursive:true});
  const source=path.join(uploads,'source.mp4');fs.copyFileSync(SAMPLE,source);
  const audio=path.join(uploads,'narration.wav'), music=path.join(uploads,'music.wav');
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=380:duration=2','-c:a','pcm_s16le',audio],{timeout:30000});
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=300:duration=2','-c:a','pcm_s16le',music],{timeout:30000});
  const subs=path.join(uploads,'captions.srt');fs.writeFileSync(subs,'1\n00:00:00,200 --> 00:00:01,100\nVideo thử nghiệm\n\n2\n00:00:01,800 --> 00:00:02,650\nPhụ đề đúng thời gian\n');
  return {source,audio,music,subs};
}
function mockConcat(source,{crossfade=true}={}){
  const methods=[],commands=[],imports=[];let id=0,created=0;let latestProject;
  const server=net.createServer(socket=>{
    let buffer='';
    socket.on('data',chunk=>{buffer+=chunk.toString('utf8');let n;
      while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);
        const msg=JSON.parse(line);methods.push(msg.method);
        const reply=result=>socket.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result})+'\n');
        if(msg.method==='auth'){
          if(msg.params?.token!=='secret-for-mock')socket.end(JSON.stringify({jsonrpc:'2.0',id:msg.id,error:{message:'unauthorized'}})+'\n');
          else reply({});
        }else if(msg.method==='version')reply({apiVersion:'0.2',concat:'0.2.7-mock',capabilities:['events','json-rpc']});
        else if(msg.method==='catalogue.list')reply(crossfade?[{id:'cross-fade',kind:'transition'}]:[]);
        else if(msg.method==='project.create'){
          assert.ok(msg.params.video.width>0&&msg.params.video.height>0);
          latestProject=path.join(msg.params.location,msg.params.name);fs.mkdirSync(latestProject,{recursive:true});created++;reply({});
        }else if(msg.method==='media.import'){
          assert.ok(fs.statSync(msg.params.file).size>100);
          imports.push(msg.params.file);reply({createdId:'m'+(++id)});
        }else if(msg.method==='edit.apply'){
          const c=msg.params.command;
          assert.ok(['addClipAtFirstFree','addTextClip','updateClip'].includes(c.op),'unsupported edit: '+c.op);
          commands.push(c);
          reply({createdId:c.op==='updateClip'?null:'c'+(++id)});
        }else if(msg.method==='project.save'){
          fs.writeFileSync(path.join(msg.params.path,'concat-api-test.json'),JSON.stringify(commands));reply({});
        }else if(msg.method==='export.run'){
          // This is a MOCK Concat exporter only: real video bytes are from
          // the included sample fixture, NOT claimed to be Concat output.
          fs.copyFileSync(source,msg.params.output);
          reply({job:'mock-job-'+(++id)});
          setImmediate(()=>socket.write(JSON.stringify({jsonrpc:'2.0',method:'export.done',params:{job:'mock-job-'+id,output:msg.params.output}})+'\n'));
        }else reply({});
      }
    });
  });
  return {server,methods,commands,imports,get created(){return created},get latestProject(){return latestProject}};
}
async function liveMock(m,fn){await new Promise(resolve=>m.server.listen(0,'127.0.0.1',resolve));
  try{return await fn({host:'127.0.0.1',port:m.server.address().port,token:'secret-for-mock'});}
  finally{await new Promise(resolve=>m.server.close(resolve));}}
function plan(src){return {kind:'edit',version:2,schemaVersion:2,origin:'deterministic-rule-not-ai',sourceSha256:shaFile(src),
  segments:[{start:0,end:1.6,source:src},{start:1.6,end:3.2,source:src}],ratio:'16:9',width:1280,height:720,fps:25,
  framing:'fit',transition:'crossfade',transitionSeconds:.35,effects:[],sourceArtifactId:'sha256:'+shaFile(src)};}
test('real FFmpeg source scenes produce Concat RPC project with independent video, audio, narration, music and timed captions',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'concat-multitrack-'));const f=makeFixtures(workspace);const m=mockConcat(f.source);
  try{const result=await liveMock(m,settings=>createMultitrackProject({settings,workspace,source:f.source,timeline:plan(f.source),
    captionsSource:f.subs,narrationSource:f.audio,musicSource:f.music,title:'Cảnh thử',jobId:'a1111111_2222',exportVideo:true}));
    assert.equal(result.scenes.length,2);
    assert.equal(result.captionClipIds.length,2);
    assert.equal(result.separateAudioClips.length,2);
    assert.ok(result.voiceClipId&&result.musicClipId&&result.titleClipId);
    assert.equal(result.transitionIds.length,1);
    assert.equal(result.sourceLayers.length,6);
    assert.ok(fs.existsSync(result.project));assert.ok(fs.statSync(result.exported).size>1000);
    assert.ok(m.commands.filter(x=>x.op==='addClipAtFirstFree').length>=6);
    assert.ok(m.commands.some(x=>x.op==='updateClip'&&x.patch?.transitionIn?.id==='cross-fade'));
    assert.ok(m.commands.some(x=>x.op==='addTextClip'&&x.style?.content==='Video thử nghiệm'));
    for(const s of result.scenes){const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',s.visual]).toString());
      assert.ok(info.streams.some(x=>x.codec_type==='video'));assert.ok(!info.streams.some(x=>x.codec_type==='audio'));}
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
test('Concat 0.2 built-in cross-fade does not depend on effects catalogue',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'concat-built-in-fade-'));const f=makeFixtures(workspace);const m=mockConcat(f.source,{crossfade:false});
  try{const result=await liveMock(m,settings=>createMultitrackProject({settings,workspace,source:f.source,timeline:plan(f.source),jobId:'a2222222'}));
    assert.equal(result.transitionIds.length,1);assert.equal(result.transitionsSkipped.length,0);
    assert.equal(result.scenes[1].at,1.25);assert.ok(Math.abs(result.expectedSeconds-2.85)<.01);
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
test('three overlapping scenes with subtitle/title overlay safely use non-overlapping cuts',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'concat-safe-title-'));const f=makeFixtures(workspace);const m=mockConcat(f.source);
  const p=plan(f.source);p.segments=[{start:0,end:1.1,source:f.source},{start:1.1,end:2.2,source:f.source},{start:2.2,end:3.2,source:f.source}];p.transitionSeconds=.20;
  try{const result=await liveMock(m,settings=>createMultitrackProject({settings,workspace,source:f.source,timeline:p,jobId:'threescenes',
    captionsSource:f.subs,title:'Some title'}));
    assert.equal(result.scenes.length,3);assert.equal(result.transitionIds.length,0);
    assert.equal(result.transitionsSkipped.length,1);assert.ok(result.scenes[2].at>2.19);
    assert.equal(result.captionClipIds.length,2);
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
test('Concat multitrack rejects wrong source SHA and outside-workspace files BEFORE reaching editor',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'concat-forbidden-'));const f=makeFixtures(workspace);
  try{const p=plan(f.source);p.sourceSha256='a'.repeat(64);
    await assert.rejects(createMultitrackProject({settings:{token:'fake'},workspace,source:f.source,timeline:p,jobId:'shafail'}),e=>e.code==='MEDIA_PLAN_SOURCE');
    await assert.rejects(createMultitrackProject({settings:{token:'fake'},workspace,source:f.source,timeline:plan(f.source),musicSource:import.meta.filename,jobId:'outside'}),e=>e.code==='FORBIDDEN_PATH');
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
test('offline Concat refuses before video conversion and leaves no temporary clips',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'concat-offline-'));const f=makeFixtures(workspace);
  try{await assert.rejects(createMultitrackProject({settings:{port:9,host:'127.0.0.1',token:'dummy'},workspace,
    source:f.source,timeline:plan(f.source),jobId:'offline'}),e=>e.code==='BLOCKED_CONCAT');
    assert.equal(fs.existsSync(path.join(workspace,'.concat-sources')),false);
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
test('approved Media quick-edit uses actual Concat multitrack RPC, saves hashes and marks completion only after export QA',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'concat-host-'));let host;
  const stub=mockConcat(SAMPLE);
  try{await liveMock(stub,async settings=>{
    host=createIntegrationHost({root,clock:false,env:{CONCAT_API_TOKEN:settings.token,CONCAT_API_PORT:String(settings.port)}});
    assert.equal(host.status().core.status,'active');
    const f=makeFixtures(host.mediaWorkspace);
    const t=host.submit({projectId:'concat-pilot',operation:'media.quick-edit',params:{source:'uploads/source.mp4',
      prompt:'video 16:9, hiệu ứng mờ dần',concatProject:true,concatTitle:'Quảng cáo ngắn',musicSource:'uploads/music.wav',captionsSource:'uploads/captions.srt'}});
    host.action(t.id,'approve');await host.core.queue.drain();
    const latest=host.listTasks('concat-pilot').find(x=>x.id===t.id);
    assert.equal(latest.state,'completed',JSON.stringify(latest.error));
    const arts=host.listArtifacts('concat-pilot');
    assert.ok(arts.some(a=>a.name==='concat-multitrack-project.json'));
    assert.ok(arts.some(a=>a.name==='concat-export.mp4'));
    assert.ok(stub.commands.some(x=>x.op==='addTextClip'&&x.style?.content==='Quảng cáo ngắn'));
  });}finally{host?.stop();fs.rmSync(root,{recursive:true,force:true});}
});
