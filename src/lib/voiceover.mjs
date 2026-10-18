/**
 * Real local dubbing: accepted on-disk video/audio, no simulated TTS.
 * Original video sound is REPLACED. Optional licensed music is mixed very quietly.
 * Narration duration controls the final timeline (never cut off the spoken ending).
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const common=require('../../integrations/media-engine/src/utils.cjs');
const subtitles=require('../../integrations/media-engine/src/subtitles.cjs');
const quality=require('../../integrations/media-engine/src/quality.cjs');
const {escapeFilterPath}=require('../../integrations/media-engine/src/renderer.cjs');
const {within,ffprobe,duration,hasAudio,hasVideo,run,insist}=common;

export async function buildVoiceover({workspace,jobDir,videoSource,audioSource,captionsSource=null,musicSource=null,musicVolume=.12,alignment='hold',ffmpegBin='ffmpeg',ffprobeBin='ffprobe'}={}){
  const video=within(workspace,videoSource),audio=within(workspace,audioSource);
  insist(['.mp4','.mkv','.mov','.webm','.m4v'].includes(path.extname(video).toLowerCase()),'Cần file video hợp lệ.','VOICEOVER_VIDEO');
  insist(['.mp3','.wav','.m4a'].includes(path.extname(audio).toLowerCase()),'Giọng đọc phải là WAV/MP3/M4A.','VOICEOVER_AUDIO');
  insist(['hold','stretch'].includes(alignment),'Chế độ khớp hình/tiếng không hợp lệ.','VOICEOVER_ALIGN');
  insist(Number.isFinite(Number(musicVolume))&&Number(musicVolume)>=0&&Number(musicVolume)<=.4,'Nhạc nền phải trong khoảng 0–40%.','VOICEOVER_MUSIC');
  const [vp,ap]=await Promise.all([ffprobe(video,ffprobeBin),ffprobe(audio,ffprobeBin)]);
  insist(hasVideo(vp),'Nguồn không chứa hình video.','VOICEOVER_VIDEO');
  insist(hasAudio(ap),'Tệp giọng đọc không chứa tiếng.','VOICEOVER_AUDIO');
  const audioSeconds=duration(ap),videoSeconds=duration(vp);
  insist(audioSeconds>0.2&&audioSeconds<=3600,'Audio phải dài từ 0,2 giây đến 1 giờ.','VOICEOVER_AUDIO');
  insist(videoSeconds>0.2,'Video không hợp lệ.','VOICEOVER_VIDEO');
  let capFile=null,segments=null;
  if(captionsSource){
    capFile=within(workspace,captionsSource);
    insist(path.extname(capFile).toLowerCase()==='.srt','Chỉ chấp nhận phụ đề SRT có mốc thời gian.','VOICEOVER_SRT');
    insist(fs.statSync(capFile).size<=2*1024*1024,'SRT quá lớn.','VOICEOVER_SRT');
    segments=subtitles.parseSrt(fs.readFileSync(capFile,'utf8'));
    insist(segments.length>0,'Không đọc được phụ đề SRT.','VOICEOVER_SRT');
    insist(segments.every(s=>s.end<=audioSeconds+.1),'Phụ đề vượt quá thời lượng giọng đọc.','VOICEOVER_SRT');
  }
  let music=null;
  if(musicSource){
    music=within(workspace,musicSource);
    insist(['.mp3','.wav','.m4a'].includes(path.extname(music).toLowerCase()),'Nhạc nền phải là WAV/MP3/M4A.','VOICEOVER_MUSIC');
    const mp=await ffprobe(music,ffprobeBin);
    insist(hasAudio(mp),'Tệp nhạc nền không chứa âm thanh.','VOICEOVER_MUSIC');
  }
  fs.mkdirSync(jobDir,{recursive:true});
  const final=path.join(jobDir,'voiceover-final.mp4');
  const extension=Math.max(0,audioSeconds-videoSeconds+.5);
  const stretch=alignment==='stretch';
  const filters=stretch
    ?[`setpts=${(audioSeconds/videoSeconds).toFixed(7)}*(PTS-STARTPTS)`,'fps=25']
    :[...(extension>0.01?[`tpad=stop_mode=clone:stop_duration=${extension.toFixed(3)}`]:[]),'setpts=PTS-STARTPTS','fps=25'];
  filters.push(`trim=duration=${(audioSeconds+.05).toFixed(3)}`,'setpts=PTS-STARTPTS');
  if(capFile)filters.push(`subtitles=filename='${escapeFilterPath(capFile)}'`);
  const inputs=['-i',video,'-i',audio];
  if(music)inputs.push('-stream_loop','-1','-i',music);
  const complex=`[0:v]${filters.join(',')}[v]`+(music?`;[1:a]aresample=48000,volume=1[voice];[2:a]aresample=48000,volume=${Number(musicVolume).toFixed(3)}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.97[a]`:'');
  const args=['-hide_banner','-loglevel','error','-nostdin','-y',...inputs,'-filter_complex',complex,'-map','[v]','-map',music?'[a]':'1:a:0','-c:v','libx264','-preset','veryfast','-threads','2','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','160k','-t',String(audioSeconds),'-movflags','+faststart',final];
  await run(ffmpegBin,args,{timeoutMs:Math.max(120000,audioSeconds*17000)});
  const qa=await quality.check({file:final,expectedDuration:audioSeconds,ffmpegBin,ffprobeBin,subtitleSegments:segments});
  insist(qa.passed,'Không nghiệm thu được video: '+qa.problems.join(','),'VOICEOVER_QA');
  return {file:final,qa,voiceOrigin:'user-supplied-real-audio',subtitleSync:segments?'provided-timed-SRT':'none',alignment:stretch?'stretch-video-to-narration':extension>0?'freeze-last-frame-to-preserve-full-voice':'trim-video-to-voice-length',videoSeconds,audioSeconds,musicMixed:Boolean(music),musicVolume:music?Number(musicVolume):0,captionPath:capFile};
}
