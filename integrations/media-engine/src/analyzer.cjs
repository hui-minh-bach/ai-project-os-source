'use strict';
const {run,finite}=require('./utils.cjs');
async function silence({source,ffmpegBin='ffmpeg',noise='-32dB',minimum=0.45}){
 const {stderr}=await run(ffmpegBin,['-hide_banner','-nostdin','-i',source,'-af',`silencedetect=noise=${noise}:d=${minimum}`,'-f','null','-'],{timeoutMs:180000});
 const events=[];let open=null;
 for(const line of stderr.split('\n')){
  const start=line.match(/silence_start:\s*([\d.]+)/),end=line.match(/silence_end:\s*([\d.]+)/);
  if(start)open=finite(start[1]);if(end&&open!==null){events.push({start:open,end:finite(end[1])});open=null;}
 }
 return events;
}
async function sceneChanges({source,ffmpegBin='ffmpeg',threshold=.35,maxSeconds=300}){
 const {stderr}=await run(ffmpegBin,['-hide_banner','-nostdin','-t',String(maxSeconds),'-i',source,'-vf',`select='gt(scene,${threshold})',showinfo`,'-an','-f','null','-'],{timeoutMs:180000});
 const points=[...stderr.matchAll(/pts_time:([0-9.]+)/g)].map(m=>+m[1]);
 return [...new Set(points)].slice(0,400);
}
async function analyze({media,ffmpegBin='ffmpeg'}){
 const hasAudio=media.streams.some(s=>s.codec_type==='audio'),hasVideo=media.streams.some(s=>s.codec_type==='video');
 const silences=hasAudio?await silence({source:media.path,ffmpegBin}):[];
 const scenes=hasVideo?await sceneChanges({source:media.path,ffmpegBin,maxSeconds:Math.min(media.seconds,300)}):[];
 return {durationSeconds:media.seconds,silences,sceneChanges:scenes,cutCandidates:silences.filter(x=>x.end-x.start>=.8),video:media.streams.filter(s=>s.codec_type==='video'),audio:media.streams.filter(s=>s.codec_type==='audio')};
}
module.exports={silence,sceneChanges,analyze};
