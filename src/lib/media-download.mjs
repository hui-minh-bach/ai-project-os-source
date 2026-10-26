import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mediaUrl, publicHost, publicRequest, downloadProxy } from './media-network.mjs';
const require=createRequire(import.meta.url);
const {run,shaFile,writeAllSync}=require('../../integrations/media-engine/src/utils.cjs');
const MAX=150*1024*1024;
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function downloadKind(value) {
  const u=mediaUrl(value),host=u.hostname.toLowerCase();
  if (['youtube.com','www.youtube.com','m.youtube.com','youtu.be','tiktok.com','www.tiktok.com','vm.tiktok.com','vt.tiktok.com'].includes(host)) return 'platform';
  return 'direct';
}
export function downloaderStatus(env=process.env) {
  const exe=env.AIOS_YTDLP_PATH||'yt-dlp';
  const p=spawnSync(exe,['--ignore-config','--version'],{encoding:'utf8',timeout:3000,windowsHide:true,maxBuffer:10000});
  return {direct:true,platformReady:p.status===0,version:p.status===0?p.stdout.trim():null,
    limitBytes:MAX,hint:'YouTube/TikTok công khai cần yt-dlp trong PATH hoặc AIOS_YTDLP_PATH. Không dùng cookie, đăng nhập hay vượt khóa.'};
}
export async function downloadVideo({workspace,url,rightsConfirmed,env=process.env,request=publicRequest,resolvePublic=publicHost}) {
  if(rightsConfirmed!==true)throw fail('MEDIA_RIGHTS','Xác nhận quyền tải và chỉnh sửa video trước.');
  const u=mediaUrl(url),kind=downloadKind(url);await resolvePublic(u.hostname);
  const uploads=path.join(workspace,'uploads');fs.mkdirSync(uploads,{recursive:true,mode:0o700});
  const temp=fs.mkdtempSync(path.join(uploads,'.download-'));const output=path.join(temp,'video.mp4');
  try {
    if(kind==='platform'){
      if(!downloaderStatus(env).platformReady)throw fail('MEDIA_DOWNLOADER_MISSING','Chưa có yt-dlp. Cài yt-dlp và FFmpeg rồi khởi động lại app; link MP4 trực tiếp không cần yt-dlp.');
      const proxy=await downloadProxy();let watchdog;
      const abort=new AbortController();
      try {
        watchdog=setInterval(()=>{try{const sizes=fs.readdirSync(temp).map(f=>fs.statSync(path.join(temp,f)).size);if(sizes.some(n=>n>MAX)||sizes.reduce((a,b)=>a+b,0)>MAX*2)abort.abort();}catch{}},250);
        await run(env.AIOS_YTDLP_PATH||'yt-dlp',['--ignore-config','--no-playlist','--no-cache-dir','--no-progress','--no-warnings',
          '--proxy',proxy.url,'--socket-timeout','20','--retries','1','--fragment-retries','1','--max-filesize',String(MAX),
          '--match-filter','!is_live & duration <= 1800','--format','best[ext=mp4]/best','--remux-video','mp4',
          '--output',path.join(temp,'video.%(ext)s'),'--',u.href],{timeoutMs:300000,signal:abort.signal,maxOutput:200000});
      } catch { throw fail('MEDIA_DOWNLOAD_FAILED','yt-dlp không tải được video công khai này (quyền truy cập, giới hạn 150 MB/30 phút hoặc thay đổi của nền tảng). Không bỏ qua khóa đăng nhập/DRM.'); }
      finally {clearInterval(watchdog);proxy.close();}
    } else {
      let current=u.href,completed=false;const controller=new AbortController();const deadline=setTimeout(()=>controller.abort(),300000);
      let response;
      try {
        for(let i=0;i<=5;i++){
          response=await request(current);controller.signal.onabort=()=>response?.destroy();
          if(controller.signal.aborted)throw fail('MEDIA_DOWNLOAD_TIMEOUT','Tải quá thời gian chờ.');
          if([301,302,303,307,308].includes(response.statusCode)){
            response.destroy();const location=response.headers.location;if(!location)throw fail('MEDIA_DOWNLOAD_FAILED','Redirect thiếu đích.');
            current=mediaUrl(new URL(location,current).href).href;continue;
          }
          if(response.statusCode!==200)throw fail('MEDIA_DOWNLOAD_FAILED',`Máy chủ tải trả HTTP ${response.statusCode}.`);
          if(Number(response.headers['content-length'])>MAX)throw fail('MEDIA_UPLOAD_LIMIT','Video vượt 150 MB.');
          if(/text\/html|application\/json/.test(response.headers['content-type']||''))throw fail('MEDIA_URL','Đây là trang web, cần link tệp video trực tiếp.');
          const fd=fs.openSync(output,'wx',0o600);let bytes=0;
          try {for await(const chunk of response){bytes+=chunk.length;if(bytes>MAX)throw fail('MEDIA_UPLOAD_LIMIT','Video vượt 150 MB.');writeAllSync(fd,chunk);}}
          finally {fs.closeSync(fd);}
          completed=true;break;
        }
        if(!completed)throw fail('MEDIA_DOWNLOAD_FAILED','Quá nhiều lần chuyển hướng.');
      } finally {clearTimeout(deadline);response?.destroy();}
    }
    if(!fs.existsSync(output)||!fs.statSync(output).size||fs.statSync(output).size>MAX)throw fail('MEDIA_DOWNLOAD_FAILED','Không có video hợp lệ dưới 150 MB.');
    const probe=JSON.parse((await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',output],{timeoutMs:30000})).stdout);const v=probe.streams?.find(s=>s.codec_type==='video');
    if(!v||!Number.isFinite(+probe.format?.duration)||+probe.format.duration<=0||+probe.format.duration>1800)throw fail('MEDIA_DOWNLOAD_FAILED','Tệp không có video hoặc dài quá 30 phút.');
    // Restrict the container before exposing it as MP4 to the browser.
    if(!String(probe.format?.format_name).split(',').some(n=>['mov','mp4'].includes(n)))throw fail('MEDIA_DOWNLOAD_FAILED','Chỉ nhận MP4/MOV. Hãy tải định dạng MP4 của video.');
    const source=`uploads/download-${crypto.randomUUID()}.mp4`,file=path.join(workspace,source);
    fs.renameSync(output,file);
    return {file,source,size:fs.statSync(file).size,sha256:shaFile(file),sourceHost:u.hostname,kind,seconds:+probe.format.duration,width:v.width,height:v.height};
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
}
