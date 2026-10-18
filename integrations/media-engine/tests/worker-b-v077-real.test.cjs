'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {shaFile,ffprobe,duration}=require('../src/utils.cjs');
const {importMedia}=require('../src/importer.cjs');
const {sceneChanges}=require('../src/analyzer.cjs');
const {validate}=require('../src/timeline.cjs');
const {render}=require('../src/renderer.cjs');
const {srt}=require('../src/subtitles.cjs');
const canRun=['ffmpeg','ffprobe'].every(x=>!spawnSync(x,['-version'],{stdio:'ignore'}).error);
const bin=(argv,cwd)=>{const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-y',...argv],{cwd,encoding:'utf8',timeout:45000});assert.equal(result.status,0,`FFmpeg fixture: ${result.stderr}`)};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'worker-b-real-'));
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
function fixture(name,{seconds=3,audio=true,twoTracks=false,portrait=false}={}){
 const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});
 const args=['-f','lavfi','-i',`testsrc2=size=${portrait?'180x320':'320x180'}:rate=25:duration=${seconds}`];
 if(audio){args.push('-f','lavfi','-i',`sine=frequency=510:sample_rate=48000:duration=${seconds}`);if(twoTracks)args.push('-f','lavfi','-i',`sine=frequency=740:sample_rate=48000:duration=${seconds}`)}
 args.push('-map','0:v:0');if(audio){args.push('-map','1:a:0');if(twoTracks)args.push('-map','2:a:0');}
 args.push('-c:v','libx264','-preset','ultrafast','-threads','2','-crf','28','-c:a','aac','-pix_fmt','yuv420p','-shortest',file);bin(args);return file;
}
async function mediaPlan(source,{audioStreamIndex=null}={}){
 const media=await importMedia({workspace:root,source});const plan=validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:media.seconds}],audioStreamIndex},media);
 // Tiny QA preset to make this a CPU-friendly portable fixture, not a quality showcase.
 return {media,plan:{...plan,width:320,height:180}};
}
test('B0+ B1 3-second silent video really exports AAC/H.264 and reruns without overwrite',{skip:!canRun,timeout:60000},async()=>{
 const source=fixture('Thử nghiệm đường dẫn có dấu/video không tiếng.mp4',{audio:false});const before=shaFile(source);
 const {media,plan}=await mediaPlan(source);assert.equal(plan.schemaVersion,2);assert.equal(plan.sourceArtifactId,'sha256:'+before);assert.equal(plan.sourceProbe.streams[0].codec_name,'h264');
 const jobDir=path.join(root,'job-silent');fs.mkdirSync(jobDir);
 const first=await render({timeline:plan,jobDir});const out=await ffprobe(first.file);
 assert.ok(out.streams.some(x=>x.codec_type==='video'&&x.codec_name==='h264'));
 assert.ok(out.streams.some(x=>x.codec_type==='audio'&&x.codec_name==='aac'));
 assert.ok(Math.abs(duration(out)-3)<.18);assert.equal(shaFile(source),before);
 const renderedHash=shaFile(first.file);const duplicate=await render({timeline:plan,jobDir});assert.equal(duplicate.idempotent,true);assert.equal(shaFile(first.file),renderedHash);
 const altered={...plan,effects:['fade-in-out']};await assert.rejects(render({timeline:altered,jobDir}),{code:'RENDER_CONFLICT'});
 assert.equal(shaFile(first.file),renderedHash);
 // Source content tampered while filename and mtime remain identical.
 const oldStat=fs.statSync(source);const original=fs.readFileSync(source);const changed=Buffer.from(original);changed[240]^=1;fs.writeFileSync(source,changed);fs.utimesSync(source,oldStat.atime,oldStat.mtime);
 await assert.rejects(render({timeline:plan,jobDir:path.join(root,'job-stale')}),{code:'MEDIA_PLAN_SOURCE'});
 assert.equal(media.sha256,before);
});
test('B1 portrait to 16:9 output and Vietnamese SRT burn-in; original source preserved',{skip:!canRun,timeout:60000},async()=>{
 const source=fixture('đầu vào/điện thoại dọc.mp4',{portrait:true});const before=shaFile(source);const {plan}=await mediaPlan(source);
 const jobDir=path.join(root,'job-portrait');fs.mkdirSync(jobDir);
 const caption=path.join(root,'phụ đề có dấu.srt');fs.writeFileSync(caption,srt([{start:0.1,end:1.9,text:'Xin chào, Việt Nam!'}]));
 const out=await render({timeline:plan,jobDir,subtitle:caption});const probe=await ffprobe(out.file);const video=probe.streams.find(x=>x.codec_type==='video');
 assert.equal(video.width,320);assert.equal(video.height,180);assert.equal(shaFile(source),before);assert.ok(fs.statSync(out.file).size>2000);
});
test('B0 ambiguous multi-audio demands explicit track; selected output has exactly one AAC track',{skip:!canRun,timeout:60000},async()=>{
 const source=fixture('multi-audio.mp4',{twoTracks:true});const media=await importMedia({workspace:root,source});
 const tracks=media.streams.filter(x=>x.codec_type==='audio');assert.equal(tracks.length,2);assert.notEqual(tracks[0].index,tracks[1].index);
 assert.throws(()=>validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:2}]},media),{code:'MEDIA_AUDIO_SELECTION'});
 const plan=validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:2}],audioStreamIndex:tracks[1].index},media);
 const jobDir=path.join(root,'job-multi');fs.mkdirSync(jobDir);const output=await render({timeline:{...plan,width:320,height:180},jobDir});
 const probed=await ffprobe(output.file);assert.equal(probed.streams.filter(s=>s.codec_type==='audio').length,1);
});
test('B0 rejects invalid tiny/overlong/zero segments and v2 source mismatch',{skip:!canRun,timeout:30000},async()=>{
 const source=fixture('invalid-plans.mp4'),media=await importMedia({workspace:root,source});
 const valid=validate({kind:'edit',ratio:'16:9',segments:[{start:0,end:media.seconds}]},media);
 for(const [start,end] of [[0,0],[-1,1],[0,media.seconds+5],[2.8,2.84]])assert.throws(()=>validate({...valid,segments:[{start,end}]},media),{code:'MEDIA_PLAN_RANGE'});
 assert.throws(()=>validate(valid,{...media,sha256:'f'.repeat(64)}),{code:'MEDIA_PLAN_SOURCE'});
 const shorter=validate({...valid,transition:'crossfade',transitionSeconds:.35,segments:[{start:0,end:.2},{start:.3,end:.5}]},media);
 assert.equal(shorter.transition,'cut','too-short source handles fall back to hard cut');
});
test('B0 scene detection real FFmpeg no hard cuts is distinguishable from tool failure',{skip:!canRun,timeout:60000},async()=>{
 const source=fixture('long-continuous.mp4',{seconds:4});const points=await sceneChanges({source,maxSeconds:4});assert.ok(Array.isArray(points));
 await assert.rejects(sceneChanges({source,ffmpegBin:'nonexistent-ffmpeg-not-in-path'}));
});
test('B0 cancelled FFmpeg render never marks final complete and does not overwrite input',{skip:!canRun,timeout:30000},async()=>{
 const source=fixture('abort-safe.mp4'),before=shaFile(source);const {plan}=await mediaPlan(source);
 const dir=path.join(root,'aborted');fs.mkdirSync(dir);const controller=new AbortController();controller.abort();
 await assert.rejects(render({timeline:plan,jobDir:dir,signal:controller.signal}));
 assert.equal(fs.existsSync(path.join(dir,'final.mp4')),false);
 assert.equal(shaFile(source),before);
});
test('B3 Concat refuses wrong API token and never reports live connected',{timeout:10000},async()=>{
 const net=require('node:net'),concat=require('../src/concat.cjs');
 const server=net.createServer(s=>s.on('data',()=>{s.write(JSON.stringify({jsonrpc:'2.0',id:0,error:{code:-32000,message:'unauthorized'}})+'\n');s.end();}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{await assert.rejects(concat.probe({token:'bad-token',port:server.address().port,timeoutMs:1000}),/authentication refused|closed connection|unauthorized/i);}
 finally{await new Promise(r=>server.close(r));}
});
test('B1 VFR portrait source normalizes safely to 25 fps and retains duration',{skip:!canRun,timeout:60000},async()=>{
 const src=path.join(root,'vfr-phone-portrait.mp4');
 bin(['-f','lavfi','-i','testsrc2=duration=6:size=180x320:rate=30','-vf','select=not(mod(n\\,2))','-fps_mode','vfr','-c:v','libx264','-threads','2','-preset','ultrafast','-crf','27',src]);
 const media=await importMedia({workspace:root,source:src});
 const plan=validate({kind:'edit',ratio:'9:16',segments:[{start:0,end:media.seconds}]},media);
 const jobDir=path.join(root,'job-vfr');fs.mkdirSync(jobDir);
 const output=await render({timeline:{...plan,width:180,height:320},jobDir});
 const probe=await ffprobe(output.file),video=probe.streams.find(s=>s.codec_type==='video');
 assert.equal(video.codec_name,'h264');assert.ok(Math.abs(duration(probe)-media.seconds)<.2);
 assert.equal(video.avg_frame_rate,'25/1');
});
test('B0 30-second no-cut vs 3 actual hard-cut scene detection',{skip:!canRun,timeout:60000},async()=>{
 const one=path.join(root,'30s-no-cuts.mp4');
 bin(['-f','lavfi','-i','color=blue:size=160x90:rate=5:duration=30','-c:v','libx264','-threads','2','-preset','ultrafast',one]);
 const noCuts=await sceneChanges({source:one,maxSeconds:30});assert.equal(noCuts.length,0);
 const cut=path.join(root,'30s-three-cuts.mp4');
 const args=[];for(const color of ['red','blue','green','yellow'])args.push('-f','lavfi','-i',`color=${color}:size=160x90:rate=5:duration=7.5`);
 args.push('-filter_complex','[0:v][1:v][2:v][3:v]concat=n=4:v=1:a=0[v]','-map','[v]','-c:v','libx264','-threads','2','-preset','ultrafast',cut);bin(args);
 const cuts=await sceneChanges({source:cut,threshold:.2,maxSeconds:30});assert.ok(cuts.length>=3,JSON.stringify(cuts));
});
