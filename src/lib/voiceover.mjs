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

export const HARDSUB_COVER_MODES=['off','blur','band'];
/* Cover a burned-in subtitle band (bottom regionPct% of the frame) so old
 * hardsubs do not clash with the new voice/subtitles. This is an honest
 * cover (blur or translucent band), NOT inpainting/removal. The graph
 * segments take label [vbase] and produce [vcover]. */
export function hardsubCoverSegments({mode='off',regionPct=13,width=0,height=0}={}){
  if(mode==='off')return {applied:false,segments:[]};
  if(!HARDSUB_COVER_MODES.includes(mode))throw new Error('Chế độ che phụ đề cứng không hợp lệ.');
  const pct=Math.min(40,Math.max(10,Number(regionPct)||22));
  if(!width||!height)return {applied:false,segments:[]};
  const h=Math.max(2,Math.round(height*pct/100/2)*2), y=height-h;
  if(mode==='band')return {applied:true,pct,segments:[`[vbase]drawbox=x=0:y=${y}:w=${width}:h=${h}:color=black@0.88:t=fill[vcover]`]};
  return {applied:true,pct,segments:[`[vbase]split=2[hsA][hsB]`,`[hsB]crop=${width}:${h}:0:${y},boxblur=luma_radius=24:luma_power=3:chroma_radius=12[hsBlur]`,`[hsA][hsBlur]overlay=0:${y}[vcover]`]};
}

export async function buildVoiceover({workspace,jobDir,videoSource,audioSource,captionsSource=null,musicSource=null,musicVolume=.12,alignment='hold',hardsubCover=null,ffmpegBin='ffmpeg',ffprobeBin='ffprobe'}={}){
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
    const capExt=path.extname(capFile).toLowerCase();
    insist(capExt==='.srt'||capExt==='.ass','Chỉ chấp nhận phụ đề SRT có mốc thời gian hoặc ASS karaoke do app tạo.','VOICEOVER_SRT');
    insist(fs.statSync(capFile).size<=2*1024*1024,'Phụ đề quá lớn.','VOICEOVER_SRT');
    if(capExt==='.srt'){
      segments=subtitles.parseSrt(fs.readFileSync(capFile,'utf8'));
      insist(segments.length>0,'Không đọc được phụ đề SRT.','VOICEOVER_SRT');
      insist(segments.every(s=>s.end<=audioSeconds+.1),'Phụ đề vượt quá thời lượng giọng đọc.','VOICEOVER_SRT');
    }
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
  const vstream=(vp.streams||[]).find(st=>st.codec_type==='video')||{};
  const cover=hardsubCoverSegments({mode:hardsubCover?.mode||'off',regionPct:hardsubCover?.regionPct??13,width:vstream.width||0,height:vstream.height||0});
  let graph=`[0:v]${filters.join(',')}[vbase]`;
  let cur='vbase';
  if(cover.applied){graph+=';'+cover.segments.join(';');cur='vcover';}
  if(capFile){graph+=`;[${cur}]subtitles=filename='${escapeFilterPath(capFile)}'[v]`;cur='v';}
  const inputs=['-i',video,'-i',audio];
  if(music)inputs.push('-stream_loop','-1','-i',music);
  const complex=graph+(music?`;[1:a]aresample=48000,volume=1[voice];[2:a]aresample=48000,volume=${Number(musicVolume).toFixed(3)}[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.97[a]`:'');
  const args=['-hide_banner','-loglevel','error','-nostdin','-y',...inputs,'-filter_complex',complex,'-map',`[${cur}]`,'-map',music?'[a]':'1:a:0','-c:v','libx264','-preset','veryfast','-threads','2','-crf','22','-pix_fmt','yuv420p','-c:a','aac','-ar','48000','-b:a','160k','-t',String(audioSeconds),'-movflags','+faststart',final];
  await run(ffmpegBin,args,{timeoutMs:Math.max(120000,audioSeconds*17000)});
  const qa=await quality.check({file:final,expectedDuration:audioSeconds,ffmpegBin,ffprobeBin,subtitleSegments:segments});
  insist(qa.passed,'Không nghiệm thu được video: '+qa.problems.join(','),'VOICEOVER_QA');
  return {file:final,qa,voiceOrigin:'user-supplied-real-audio',subtitleSync:segments?'provided-timed-SRT':(capFile?'karaoke-ass':'none'),alignment:stretch?'stretch-video-to-narration':extension>0?'freeze-last-frame-to-preserve-full-voice':'trim-video-to-voice-length',videoSeconds,audioSeconds,musicMixed:Boolean(music),musicVolume:music?Number(musicVolume):0,captionPath:capFile,hardsubCover:{mode:hardsubCover?.mode||'off',regionPct:cover.pct||Math.min(40,Math.max(10,Number(hardsubCover?.regionPct)||22)),applied:cover.applied}};
}
