'use strict';
/** Worker B proof generator. Creates only synthetic media, never touches customer data. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const {shaFile,ffprobe,insist,jsonWrite}=require('../src/utils.cjs');
const {importMedia}=require('../src/importer.cjs');
const {naturalPlan,validate}=require('../src/timeline.cjs');
const {render}=require('../src/renderer.cjs');
const {check}=require('../src/quality.cjs');
const {srt,vtt}=require('../src/subtitles.cjs');
async function main(){
 const dir=path.resolve(process.argv[2]||path.join(os.tmpdir(),'aipos-b-evidence-'+process.pid));
 fs.mkdirSync(dir,{recursive:true});insist(fs.readdirSync(dir).length===0,'Evidence directory must be empty','RENDER_CONFLICT');
 const source=path.join(dir,'synthetic-owned-source.mp4');
 const command=['-hide_banner','-loglevel','error','-nostdin','-y','-f','lavfi','-i','testsrc2=duration=3:size=320x180:rate=25','-f','lavfi','-i','sine=frequency=440:duration=3:sample_rate=48000','-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','ultrafast','-crf','27','-threads','2','-c:a','aac','-shortest',source];
 const cmd=spawnSync('ffmpeg',command,{encoding:'utf8',timeout:30000});insist(cmd.status===0,'Synthetic fixture FFmpeg failed: '+String(cmd.stderr||'').slice(-500));
 const t0=process.hrtime.bigint(),rssBefore=process.memoryUsage().rss;
 const media=await importMedia({workspace:dir,source});const edit=validate(naturalPlan('video dọc 9:16, hiệu ứng mờ dần',media),media);
 const caps=[{id:'1',start:.1,end:1.8,text:'Xin chào, Việt Nam!'}];
 const captions=path.join(dir,'subtitles.srt');fs.writeFileSync(captions,srt(caps));fs.writeFileSync(path.join(dir,'subtitles.vtt'),vtt(caps));
 const jobDir=path.join(dir,'job');fs.mkdirSync(jobDir);
 const preview=await render({timeline:edit,jobDir,preview:true});const final=await render({timeline:edit,jobDir,subtitle:captions});
 const qa=await check({file:final.file,expectedDuration:edit.expectedDuration,subtitleSegments:caps});
 insist(qa.passed,'Quality failed: '+qa.problems.join(','),'QUALITY_FAILED');
 const timeline=path.join(dir,'timeline.json');jsonWrite(timeline,edit);
 const outputs=[source,preview.file,final.file,captions,path.join(dir,'subtitles.vtt'),timeline];
 const files=await Promise.all(outputs.map(async file=>({path:path.relative(dir,file),bytes:fs.statSync(file).size,sha256:shaFile(file),probe:file.endsWith('.mp4')?await ffprobe(file):undefined})));
 const summary={tool:'AI Project OS v0.8.0 Worker B',date:new Date().toISOString(),platform:process.platform,node:process.version,ffmpeg:'system',licenseSource:'synthetic local FFmpeg testsrc2/sine; no external customer data',mediaPlanSchema:edit.schemaVersion,quality:qa,bench:{elapsedMs:Number(process.hrtime.bigint()-t0)/1e6,processRssBeforeMB:Math.round(rssBefore/1024**2),processRssAfterMB:Math.round(process.memoryUsage().rss/1024**2),note:'CPU time and peak resident memory of ffmpeg child not measured'},files};
 jsonWrite(path.join(dir,'qa-worker-b-v077.json'),summary);
 console.log(JSON.stringify({result:'PASS',directory:dir,elapsedMs:summary.bench.elapsedMs,previewSha:files[1].sha256,finalSha:files[2].sha256,qualityPassed:qa.passed}));
}
main().catch(e=>{console.error(e.code||'FAILED',e.message);process.exitCode=1});
