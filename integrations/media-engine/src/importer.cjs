'use strict';
const {fs,path,shaFile,insist,within,mkdir,ffprobe,duration,hasAudio,hasVideo,run}=require('./utils.cjs');
const VIDEO=new Set(['.mp4','.mov','.mkv','.webm','.avi','.m4v']);
const AUDIO=new Set(['.wav','.mp3','.m4a','.aac','.flac','.ogg','.opus']);
async function importMedia({workspace,source,maxBytes=2*1024**3,maxSeconds=4*3600,ffprobeBin='ffprobe'}){
 const real=within(workspace,source),stat=fs.statSync(real);
 insist(stat.isFile()&&stat.size>0&&stat.size<=maxBytes,'Media is empty or exceeds configured limit','LIMIT');
 let availableBytes=null;try{const x=fs.statfsSync(workspace);availableBytes=x.bavail*x.bsize;}catch{}
 if(availableBytes!==null)insist(availableBytes>Math.max(128*1024**2,Math.min(stat.size*2,4*1024**3)),'Insufficient free disk for media workspace','LIMIT_DISK');
 const ext=path.extname(real).toLowerCase();insist(VIDEO.has(ext)||AUDIO.has(ext),'Unsupported media container');
 const probe=await ffprobe(real,ffprobeBin),secs=duration(probe);
 insist(secs>0&&secs<=maxSeconds,'Invalid duration or exceeds configured limit','LIMIT');
 insist(VIDEO.has(ext)?hasVideo(probe):hasAudio(probe),'Container lacks expected media stream');
 const digest=shaFile(real);
 return {path:real,artifactId:'sha256:'+digest,bytes:stat.size,sha256:digest,seconds:secs,streams:probe.streams.map(({index,codec_type,codec_name,width,height,sample_rate,channels,r_frame_rate,avg_frame_rate,time_base,start_time})=>({index,codec_type,codec_name,width,height,sample_rate,channels,r_frame_rate,avg_frame_rate,time_base,start_time})),maxMemoryEstimateMB:Math.min(2048,Math.ceil(stat.size/1024**2*1.5))};
}
async function extract({ffmpegBin='ffmpeg',source,dir,frames=4,seconds}){
 mkdir(dir);const wav=path.join(dir,'audio.wav');const thumbs=[];
 const src=await ffprobe(source);
 if(hasAudio(src)) await run(ffmpegBin,['-nostdin','-y','-i',source,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',wav],{timeoutMs:180000});
 if(hasVideo(src))for(let i=0;i<frames;i++){
   const t=Math.max(0.01,Math.min(seconds-0.01,(i+0.5)*seconds/frames));const dst=path.join(dir,`frame-${i+1}.jpg`);
   await run(ffmpegBin,['-nostdin','-y','-ss',String(t),'-i',source,'-frames:v','1','-vf','scale=640:-2',dst],{timeoutMs:30000});thumbs.push(dst);
 }
 return {audio:hasAudio(src)?wav:null,frames:thumbs};
}
module.exports={importMedia,extract};
