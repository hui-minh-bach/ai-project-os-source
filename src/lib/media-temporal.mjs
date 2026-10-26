import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {run,shaFile}=require('../../integrations/media-engine/src/utils.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export function temporalBudget(geometry,frameCount){
  const {width,height,seconds,fps}=geometry,bytes=width*height*3*frameCount;
  if(seconds>30||width*height>1280*720||fps>30.01||bytes>1_500_000_000)throw fail('MEDIA_TEMPORAL_LIMIT','Phục hồi nền hỗ trợ tối đa 30 giây, 720p, 30 FPS và 1,5 GB dữ liệu khung mỗi tác vụ. Tách hoặc giảm video trước.');
  return bytes;
}
function inside(r,width,height){return r.x>=1&&r.y>=1&&r.x+r.w<width-1&&r.y+r.h<height-1;}
function samples(r,width,height){
  const out=[];
  for(const pad of [3,7,12]){
    for(let i=0;i<=8;i++){
      const x=Math.round(r.x+r.w*i/8),y=Math.round(r.y+r.h*i/8);
      for(const [a,b] of [[x,r.y-pad],[x,r.y+r.h+pad],[r.x-pad,y],[r.x+r.w+pad,y]])if(a>=0&&b>=0&&a<width&&b<height)out.push([a,b]);
    }
  }
  return out;
}
/** Use observed pixels only. Match the unmasked ring; never score through a logo. */
export function findTemporalDonor(target,donor,{width,height,mask,donorMask,maxShift=24}){
  const ring=samples(mask,width,height);if(ring.length<50)return null;
  let best=null;
  const score=(dx,dy)=>{
    const box={...mask,x:mask.x+dx,y:mask.y+dy};
    if(!inside(box,width,height)||donorMask?.active&&intersects({...box,x:box.x-2,y:box.y-2,w:box.w+4,h:box.h+4},donorMask))return;
    let sum=0,n=0;
    for(const [x,y] of ring){const u=x+dx,v=y+dy;if(u<0||v<0||u>=width||v>=height||donorMask?.active&&u>=donorMask.x-2&&u<donorMask.x+donorMask.w+2&&v>=donorMask.y-2&&v<donorMask.y+donorMask.h+2)return;
      const a=(y*width+x)*3,b=(v*width+u)*3;for(let c=0;c<3;c++){sum+=Math.abs(target[a+c]-donor[b+c]);n++;}}
    const difference=sum/n;if(!best||difference<best.difference)best={dx,dy,difference};
  };
  // Integer translations only: pan supported; no invented optical flow/rotation.
  for(let dy=-maxShift;dy<=maxShift;dy+=4)for(let dx=-maxShift;dx<=maxShift;dx+=4)score(dx,dy);
  if(best){const {dx,dy}=best;for(let y=dy-3;y<=dy+3;y++)for(let x=dx-3;x<=dx+3;x++)if(Math.abs(x)<=maxShift&&Math.abs(y)<=maxShift)score(x,y);}
  return best&&best.difference<=10?best:null;
}
function patchDifference(a,b,mask,width){
  let total=0,count=0;
  for(let y=0;y<mask.h;y+=3)for(let x=0;x<mask.w;x+=3)for(let c=0;c<3;c++){
    const ia=((mask.y+y+a.dy)*width+mask.x+x+a.dx)*3+c,ib=((mask.y+y+b.dy)*width+mask.x+x+b.dx)*3+c;
    total+=Math.abs(a.frame[ia]-b.frame[ib]);count++;
  }
  return total/count;
}
export function restoreTemporalFrame(target,candidates,{width,height,mask}){
  const matches=[];
  for(const candidate of candidates){const match=findTemporalDonor(target,candidate.frame,{width,height,mask,donorMask:candidate.mask});if(match)matches.push({...candidate,...match});}
  matches.sort((a,b)=>a.difference-b.difference);
  let pair=null;
  for(let a=0;a<matches.length&&!pair;a++)for(let b=a+1;b<matches.length;b++)if(Math.abs(matches[a].index-matches[b].index)>=2){const agreement=patchDifference(matches[a],matches[b],mask,width);if(agreement<=10){pair={a:matches[a],b:matches[b],agreement};break;}}
  if(!pair)throw fail('MEDIA_TEMPORAL_UNCERTAIN','Không có hai khung nền sạch khớp nhau. Có thể nền bị che suốt, chuyển cảnh hoặc vật thể thay đổi; không xuất bản nội suy giả.');
  const output=Buffer.from(target),chosen=pair.a;
  for(let y=0;y<mask.h;y++)for(let x=0;x<mask.w;x++){
    const alpha=Math.min(1,Math.min(x+1,y+1,mask.w-x,mask.h-y)/2);
    for(let c=0;c<3;c++){const at=((mask.y+y)*width+mask.x+x)*3+c,from=((mask.y+y+chosen.dy)*width+mask.x+x+chosen.dx)*3+c;output[at]=Math.round(target[at]*(1-alpha)+chosen.frame[from]*alpha);}
  }
  return {frame:output,evidence:{donorFrame:chosen.index,secondDonorFrame:pair.b.index,dx:chosen.dx,dy:chosen.dy,ringDifference:chosen.difference,donorAgreement:pair.agreement}};
}
export async function renderTemporalRemoval({input,plan,dir}){
  const {width,height,fps,rate,seconds}=plan.geometry,frameBytes=width*height*3,count=plan.frames.length,bytes=temporalBudget(plan.geometry,count);
  const available=fs.statfsSync(dir);if(available.bavail*available.bsize<bytes+100_000_000)throw fail('MEDIA_TEMPORAL_DISK','Không đủ dung lượng tạm để phục hồi nền.');
  const raw=path.join(dir,'temporal-source.rgb'),file=path.join(dir,'temporal-cleaned.mp4');let fd,encoder,complete,timer;
  try{
    await run('ffmpeg',['-v','error','-y','-protocol_whitelist','file,pipe','-noautorotate','-i',input,'-vf',`fps=${rate},format=rgb24`,'-an','-pix_fmt','rgb24','-f','rawvideo',raw],{timeoutMs:300000});
    if(fs.statSync(raw).size!==bytes||shaFile(input)!==plan.sourceSha256)throw fail('MEDIA_TEMPORAL_CHANGED','Nguồn hoặc số khung không khớp kế hoạch.');
    fd=fs.openSync(raw,'r');const read=index=>{const b=Buffer.allocUnsafe(frameBytes);if(fs.readSync(fd,b,0,frameBytes,index*frameBytes)!==frameBytes)throw fail('MEDIA_TEMPORAL_FRAMES','Thiếu dữ liệu khung.');return b;};
    encoder=spawn('ffmpeg',['-v','error','-y','-protocol_whitelist','file,pipe','-f','rawvideo','-pix_fmt','rgb24','-s',`${width}x${height}`,'-r',rate,'-i','pipe:0','-protocol_whitelist','file,pipe','-i',input,'-map','0:v:0','-map','1:a?','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-map_metadata','-1','-t',String(count/fps),'-movflags','+faststart',file],{stdio:['pipe','ignore','pipe'],windowsHide:true});
    encoder.stdin.on('error',()=>{});
    let stderr='';encoder.stderr.on('data',b=>{if(stderr.length<5000)stderr+=b;});
    complete=new Promise((resolve,reject)=>{encoder.once('error',reject);encoder.once('close',c=>c===0?resolve():reject(fail('MEDIA_TEMPORAL_RENDER','FFmpeg không xuất được video: '+stderr.slice(-500))));});complete.catch(()=>{});
    const timeoutError=fail('MEDIA_TEMPORAL_TIMEOUT','Phục hồi nền quá thời gian chờ.');
    timer=setTimeout(()=>{encoder.stdin.destroy(timeoutError);encoder.kill('SIGKILL');},900000);
    const evidence=[];
    for(let index=0;index<count;index++){
      const mask=plan.frames[index];let frame=read(index);
      if(mask.active){
        const indices=[...new Set([...[-.25,.25,-.5,.5,-1,1,-1.5,1.5,-2,2,-3,3].map(s=>index+Math.round(s*fps)),0,2,count-3,count-1].filter(i=>i>=0&&i<count&&plan.frames[i].active))];
        let restored;try{restored=restoreTemporalFrame(frame,indices.map(i=>({index:i,frame:read(i),mask:plan.frames[i]})),{width,height,mask});}catch(e){e.message=`Giây ${mask.time.toFixed(2)}: ${e.message}`;throw e;}frame=restored.frame;evidence.push({index,time:mask.time,...restored.evidence});
      }
      await new Promise((resolve,reject)=>encoder.stdin.write(frame,error=>error?reject(error):resolve()));
    }
    encoder.stdin.end();await complete;
    const info=JSON.parse((await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{timeoutMs:30000})).stdout);
    if(!info.streams?.some(s=>s.codec_type==='video')||Math.abs(+info.format.duration-seconds)>.25||shaFile(input)!==plan.sourceSha256)throw fail('MEDIA_TEMPORAL_VERIFY','Đầu ra không khớp nguồn/thời lượng.');
    return {file,report:{method:'temporal-observed-background-translation-aligned',inputSha256:plan.sourceSha256,outputSha256:shaFile(file),seconds:+info.format.duration,width,height,hasAudio:info.streams.some(s=>s.codec_type==='audio'),tracking:{method:plan.method,frameCount:count,frames:plan.frames},restoration:{method:'two-clean-donor-consensus',frames:evidence},limits:'Observed background recovery with integer camera translation only. No neural hallucination, optical flow, rotation, scale or guaranteed reconstruction of permanently hidden or independently changing objects. Confidence checks cannot prove unseen ground truth; review output.'}};
  }catch(e){if(encoder){encoder.stdin.destroy();encoder.kill('SIGKILL');if(complete)await Promise.allSettled([complete]);}fs.rmSync(file,{force:true});throw e;}finally{clearTimeout(timer);if(fd!==undefined)fs.closeSync(fd);fs.rmSync(raw,{force:true});}
}
