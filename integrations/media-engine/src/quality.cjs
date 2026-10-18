'use strict';
const {ffprobe,duration,hasAudio,hasVideo,run}=require('./utils.cjs');
async function check({file,expectedDuration,ffmpegBin='ffmpeg',ffprobeBin='ffprobe',subtitleSegments=null,allowedError=.65}){
 const p=await ffprobe(file,ffprobeBin),seconds=duration(p),problems=[],warnings=[];
 if(!hasVideo(p))problems.push('NO_VIDEO');if(!hasAudio(p))problems.push('NO_AUDIO');
 if(Math.abs(seconds-expectedDuration)>Math.max(.9,expectedDuration*.04))problems.push('DURATION_MISMATCH');
 let black=[],silent=[];
 try{
  const {stderr}=await run(ffmpegBin,['-hide_banner','-nostdin','-i',file,'-vf','blackdetect=d=1.3:pix_th=0.08','-an','-f','null','-'],{timeoutMs:180000});
  black=[...stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map(x=>({start:+x[1],end:+x[2]}));
  if(black.some(x=>x.end-x.start>Math.max(2,seconds*.15)))problems.push('LONG_BLACK_FRAME');
 }catch(e){warnings.push('BLACKDETECT_UNAVAILABLE: '+e.code)}
 try{
  const {stderr}=await run(ffmpegBin,['-hide_banner','-nostdin','-i',file,'-af','silencedetect=noise=-48dB:d=2.0','-vn','-f','null','-'],{timeoutMs:180000});
  silent=[...stderr.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map(x=>({start:+x[1],end:+x[2]}));
  if(silent.some(x=>x.end-x.start>Math.max(4,seconds*.20)))warnings.push('LONG_AUDIO_SILENCE');
 }catch(e){warnings.push('SILENCEDETECT_UNAVAILABLE: '+e.code)}
 if(seconds<5)warnings.push('SHORT_CLIP_REVIEW_DURATION: video dưới 5 giây cần người xem kiểm tra ý nghĩa và nguồn nội dung');
 const sync=[];if(subtitleSegments){for(const s of subtitleSegments){const left=Math.max(0,-s.start),right=Math.max(0,s.end-seconds);sync.push({id:s.id,errorSeconds:Math.max(left,right),method:'clip audio duration boundary; not measured word alignment'});if(left>allowedError||right>allowedError)problems.push('SUBTITLE_OUTSIDE_VIDEO');}}
 return {passed:problems.length===0,problems,warnings,reviewScope:'technical-media-integrity-only',editorialReviewed:false,commercialReady:false,file,durationSeconds:seconds,videoCodec:p.streams.find(x=>x.codec_type==='video')?.codec_name,audioCodec:p.streams.find(x=>x.codec_type==='audio')?.codec_name,black,silence:silent,subtitleBoundaryChecks:sync,subtitleAccuracyScope:'Segment boundaries inferred from individually probed TTS audio. Phoneme/word alignment NOT measured.'};
}
module.exports={check};
