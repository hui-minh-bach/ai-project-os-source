/** Explicit caption-only newsroom video; no fabricated narration/AI images.
 * The user authorizes this mode. Real FFmpeg output + ffprobe verification. */
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{run,ffprobe,duration}=require('../../integrations/media-engine/src/utils.cjs');
const fail=message=>Object.assign(new Error(message),{code:'CAPTION_VIDEO'});
const clean=s=>String(s||'').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\\/g,'/').replace(/[{}]/g,'').replace(/\s+/g,' ').trim();
export function wrapCaption(text,width=48){const out=[];let line='';for(const word of clean(text).split(' ')){if(line&&(line+' '+word).length>width){out.push(line);line='';}for(let w=word;w.length>width;w=w.slice(width)){if(line){out.push(line);line='';}out.push(w.slice(0,width));}const rest=word.length>width?word.slice(Math.floor((word.length-1)/width)*width):word;line+=(line?' ':'')+rest;}if(line)out.push(line);return out;}
const assTime=t=>{const cent=Math.round(t*100);return `${Math.floor(cent/360000)}:${String(Math.floor(cent/6000)%60).padStart(2,'0')}:${String(Math.floor(cent/100)%60).padStart(2,'0')}.${String(cent%100).padStart(2,'0')}`;};
const srtTime=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
export function captionTimeline(text){
 const lines=wrapCaption(text,50),scenes=[];let at=0;
 for(let i=0;i<lines.length;i+=5){const body=lines.slice(i,i+5).join('\n'),seconds=Math.max(5,Math.min(18,body.length/14));scenes.push({start:at,end:at+seconds,text:body});at+=seconds;}
 if(!scenes.length||at>180)throw fail('Video chu ho tro noi dung toi da 180 giay; hay rut gon kich ban.');
 return {scenes,seconds:at};
}
export async function buildCaptionVideo({text,title='B\u1ea3n tin',sourceUrl='',jobDir,ffmpegBin='ffmpeg',ffprobeBin='ffprobe'}={}){
 if(typeof text!=='string'||!text.trim()||text.length>2000)throw fail('Noi dung video chu can 1-2000 ky tu.');
 const {scenes,seconds}=captionTimeline(text);fs.mkdirSync(jobDir,{recursive:true,mode:0o700});const subtitles=path.join(jobDir,'captions.ass'),srt=path.join(jobDir,'captions.srt'),file=path.join(jobDir,'caption-video.mp4');
 const header=`[Script Info]\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\nWrapStyle: 2\nScaledBorderAndShadow: yes\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Title,Arial,38,&H00FFFFFF,&H00FFFFFF,&H000B1B2E,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,78,78,70,1\nStyle: Body,Arial,34,&H00F2EEE8,&H00FFFFFF,&H000B1B2E,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,82,82,220,1\nStyle: Foot,Arial,18,&H00DFC7AA,&H00FFFFFF,&H000B1B2E,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,82,82,638,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
 let host='';try{host=new URL(sourceUrl).hostname;}catch{}
 const events=[`Dialogue: 0,0:00:00.00,${assTime(seconds)},Title,,0,0,0,,${wrapCaption(title,53).slice(0,2).join('\\N')}`,`Dialogue: 0,0:00:00.00,${assTime(seconds)},Foot,,0,0,0,,${clean(host?'Ngu\u1ed3n: '+host+'  |  Video ch\u1eef - kh\u00f4ng l\u1eddi \u0111\u1ecdc':'Video ch\u1eef - kh\u00f4ng l\u1eddi \u0111\u1ecdc').slice(0,100)}`];
 scenes.forEach((s,i)=>events.push(`Dialogue: 1,${assTime(s.start)},${assTime(s.end)},Body,,0,0,0,,{\\fad(180,180)}${s.text.replace(/\n/g,'\\N')}`));
 fs.writeFileSync(subtitles,header+events.join('\n')+'\n');fs.writeFileSync(srt,scenes.map((s,i)=>`${i+1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join('\n'));
 const filter="drawbox=x=48:y=38:w=1184:h=644:color=0x102f47:t=fill,drawbox=x=48:y=38:w=8:h=644:color=0x50c7d4:t=fill,drawbox=x=80:y=185:w=1120:h=2:color=0x376577:t=fill,subtitles=filename='captions.ass'";
 await run(ffmpegBin,['-hide_banner','-loglevel','error','-nostdin','-y','-f','lavfi','-i','color=c=0x061629:s=1280x720:r=25','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-vf',filter,'-t',seconds.toFixed(3),'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','64k','-movflags','+faststart',file],{cwd:jobDir,timeoutMs:180000});
 const probe=await ffprobe(file,ffprobeBin),vs=(probe.streams||[]).find(s=>s.codec_type==='video');if(!vs||vs.width!==1280||vs.height!==720||Math.abs(duration(probe)-seconds)>.3)throw fail('Video output failed stream/duration check.');
 return {file,srt,qa:{passed:true,width:vs.width,height:vs.height,seconds:duration(probe)},report:{kind:'caption-video',narration:'none-explicit-user-choice',images:'none',subtitleTiming:'reading-time-estimate-not-speech-alignment',scenes:scenes.length,sourceUrl}};
}
