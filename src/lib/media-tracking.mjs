import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {run,shaFile,within,jsonWrite}=require('../../integrations/media-engine/src/utils.cjs');
const {escapeFilterPath}=require('../../integrations/media-engine/src/renderer.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
const probe=async file=>JSON.parse((await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file],{timeoutMs:30000})).stdout);
export function trackingStatus(){
  try{const r=spawnSync('ffmpeg',['-hide_banner','-h','filter=find_rect'],{encoding:'utf8',windowsHide:true,timeout:3500,maxBuffer:20000});return {ready:r.status===0&&/object bitmap filename/.test(r.stdout+r.stderr),engine:'FFmpeg find_rect',maxSeconds:120,maxPixels:1920*1080,maxFps:60,requires:'one visual seed for one constant-size logo/text patch',limits:'No OCR, scale/rotation recovery or guaranteed background reconstruction.'};}
  catch{return {ready:false,engine:'FFmpeg find_rect',message:'Bản FFmpeg này chưa có find_rect.'};}
}
const regionSignature=regions=>crypto.createHash('sha256').update(JSON.stringify(regions)).digest('hex');
export function parseTrackingMetadata(text){
  const frames=[];let current;
  for(const line of text.split(/\r?\n/)){
    const m=/^frame:(\d+)\s+pts:.*?pts_time:([-\d.e+]+)/.exec(line);
    if(m){current={index:Number(m[1]),time:Number(m[2])};frames.push(current);continue;}
    const kv=/^lavfi\.rect\.(x|y|w|h|score)=([-\d.e+]+)/.exec(line);if(kv&&current)current[kv[1]]=Number(kv[2]);
  }
  return frames;
}
function pgmContrast(file){
  const b=fs.readFileSync(file);let i=0;
  const token=()=>{while(i<b.length){if(b[i]===35){while(i<b.length&&b[i]!==10)i++;}else if(b[i]<=32)i++;else break;}const start=i;while(i<b.length&&b[i]>32)i++;return b.subarray(start,i).toString();};
  if(token()!=='P5')throw fail('MEDIA_TRACK_SEED','Mẫu theo dõi không phải ảnh xám hợp lệ.');
  const w=+token(),h=+token(),max=+token();if(b[i]===13&&b[i+1]===10)i+=2;else i++;
  const pixels=b.subarray(i);if(max!==255||pixels.length!==w*h)throw fail('MEDIA_TRACK_SEED','Mẫu theo dõi không hợp lệ.');
  let sum=0,square=0,lo=255,hi=0;for(const value of pixels){sum+=value;square+=value*value;lo=Math.min(lo,value);hi=Math.max(hi,value);}
  return {deviation:Math.sqrt(Math.max(0,square/pixels.length-(sum/pixels.length)**2)),range:hi-lo};
}
function mediaGeometry(info){
  const v=info.streams?.find(s=>s.codec_type==='video'),seconds=+info.format?.duration;
  if(!v||!Number.isFinite(seconds)||seconds<=0||seconds>120||v.width*v.height>1920*1080)throw fail('MEDIA_TRACK_LIMIT','Theo dõi hỗ trợ video tối đa 120 giây, 1080p và 60 FPS mỗi tác vụ.');
  if((+v.tags?.rotate||0)!==0||v.side_data_list?.some(s=>s.rotation))throw fail('MEDIA_TRACK_LIMIT','Xuất video đúng chiều trước khi chọn mẫu theo dõi.');
  const rate=/^(\d+)\/(\d+)$/.exec(v.avg_frame_rate||'');const fps=rate&&+rate[2]>0?+rate[1]/+rate[2]:0;
  if(fps<1||fps>60.01)throw fail('MEDIA_TRACK_LIMIT','Không xác định được FPS hoặc video vượt 60 FPS.');
  const scale=Math.min(1,640/Math.max(v.width,v.height));
  return {width:v.width,height:v.height,seconds,fps,rate:`${+rate[1]}/${+rate[2]}`,sw:Math.max(16,Math.floor(v.width*scale/2)*2),sh:Math.max(16,Math.floor(v.height*scale/2)*2)};
}
export function validateTrajectory(frames,{geometry,region,seed}){
  const {width,height,sw,sh,seconds,fps}=geometry;const end=region.end??seconds;let last=null,active=0,worst=0;
  if(!frames.length||frames.length>7300||Math.abs(frames.length/fps-seconds)>.25)throw fail('MEDIA_TRACK_FRAMES','Không đọc đủ khung hình để theo dõi; không xuất video thiếu đường bám.');
  const out=frames.map((f,i)=>{
    if(f.index!==i||!Number.isFinite(f.time)||Math.abs(f.time-i/fps)>.02)throw fail('MEDIA_TRACK_FRAMES','Mốc theo dõi không liên tục.');
    if(f.time<region.start-.0001||f.time>=end-.0001)return {index:i,time:f.time,active:false};
    if(!['x','y','w','h','score'].every(k=>Number.isFinite(f[k]))||f.score<0||f.score>.12||f.w!==seed.w||f.h!==seed.h)
      throw fail('MEDIA_TRACK_LOST',`Mất dấu logo/chữ tại giây ${f.time.toFixed(2)}. Chọn lại mẫu hoặc tách khoảng thời gian; chưa xuất video.`);
    if(f.x<0||f.y<0||f.x+f.w>sw||f.y+f.h>sh)throw fail('MEDIA_TRACK_EDGE','Vùng theo dõi ngoài khung hình.');
    if(last&&Math.hypot(f.x-last.x,f.y-last.y)>Math.max(24,sw*.15)&&Math.max(f.score,last.score)>.035)
      throw fail('MEDIA_TRACK_JUMP',`Vị trí nhảy đáng ngờ tại giây ${f.time.toFixed(2)}. Cần kiểm tra lại mẫu.`);
    const x=Math.round(f.x/sw*width)-2,y=Math.round(f.y/sh*height)-2,w=Math.ceil(f.w/sw*width)+4,h=Math.ceil(f.h/sh*height)+4;
    if(x<1||y<1||x+w>=width-1||y+h>=height-1)throw fail('MEDIA_TRACK_EDGE',`Logo quá sát mép tại giây ${f.time.toFixed(2)}; không đủ nền quanh vùng để nội suy.`);
    last=f;active++;worst=Math.max(worst,f.score);return {index:i,time:f.time,active:true,x,y,w,h,score:f.score};
  });
  if(!active)throw fail('MEDIA_TRACK_SEED','Khoảng xử lý không có khung hình.');
  const reference=out.filter(f=>f.active).reduce((a,b)=>Math.abs(a.time-region.referenceTime)<Math.abs(b.time-region.referenceTime)?a:b);
  const expected={x:region.x/100*width,y:region.y/100*height};
  if(Math.hypot(reference.x+2-expected.x,reference.y+2-expected.y)>Math.max(8,width/sw*4))throw fail('MEDIA_TRACK_AMBIGUOUS','Bộ tìm mẫu chọn vị trí khác vùng đã chỉ định tại khung tham chiếu; có thể có nhiều logo giống nhau.');
  return {frames:out,activeFrames:active,worstDifference:worst};
}
/** Native template matching on EVERY normalized frame, not a sampled or invented trajectory. */
export async function prepareTrackingPlan({workspace,source,regions,jobId}){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId))throw fail('MEDIA_TRACK_INPUT','Mã theo dõi không hợp lệ.');
  if(!trackingStatus().ready)throw fail('MEDIA_TRACK_ENGINE','Cần FFmpeg có bộ lọc find_rect để bám chuyển động.');
  const moving=regions.filter(r=>r.tracking==='template');if(moving.length!==1)throw fail('MEDIA_TRACK_INPUT','Mỗi tác vụ theo dõi một mẫu logo/chữ; các vùng còn lại có thể cố định.');
  const input=within(workspace,source),sourceSha256=shaFile(input),geometry=mediaGeometry(await probe(input)),region=moving[0];
  if(region.start>=geometry.seconds||(region.end??geometry.seconds)>geometry.seconds+.01||region.referenceTime<region.start||region.referenceTime>=(region.end??geometry.seconds))throw fail('MEDIA_TRACK_SEED','Khung tham chiếu phải nằm trong khoảng xử lý.');
  if(region.restoration==='temporal'){if(regions.length!==1)throw fail('MEDIA_TEMPORAL_INPUT','Phục hồi nền hỗ trợ một vùng mỗi tác vụ.');const {temporalBudget}=await import('./media-temporal.mjs');temporalBudget(geometry,Math.round(geometry.seconds*geometry.fps));}
  const dir=path.join(workspace,'.tracking-jobs',jobId);fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'plan.json');const signature=regionSignature(regions);
  if(fs.existsSync(file)){
    const old=JSON.parse(fs.readFileSync(file,'utf8'));if(old.sourceSha256!==sourceSha256||old.signature!==signature)throw fail('MEDIA_TRACK_CHANGED','Video hoặc vùng theo dõi khác kế hoạch đã lưu.');return {file,plan:old};
  }
  const seed={x:Math.floor(region.x/100*geometry.sw),y:Math.floor(region.y/100*geometry.sh),w:Math.floor(region.width/100*geometry.sw),h:Math.floor(region.height/100*geometry.sh)};
  if(seed.w<12||seed.h<12||seed.w*seed.h>geometry.sw*geometry.sh*.35)throw fail('MEDIA_TRACK_SEED','Chọn mẫu có chữ/logo rõ nét, đủ lớn (ít nhất 12×12 tại độ phân giải theo dõi), không quá 35% khung.');
  const object=path.join(dir,'seed.pgm'),metadata=path.join(dir,'frames.txt');
  await run('ffmpeg',['-v','error','-y','-protocol_whitelist','file,pipe','-noautorotate','-i',input,'-ss',String(region.referenceTime),'-vf',`fps=${geometry.rate},scale=${geometry.sw}:${geometry.sh},crop=${seed.w}:${seed.h}:${seed.x}:${seed.y},format=gray`,'-frames:v','1',object],{timeoutMs:60000});
  const contrast=pgmContrast(object);if(contrast.deviation<5||contrast.range<20)throw fail('MEDIA_TRACK_SEED','Vùng mẫu quá trống/ít tương phản; không đoán vị trí logo.');
  const graph=`fps=${geometry.rate},scale=${geometry.sw}:${geometry.sh},format=gray,find_rect=object='${escapeFilterPath(object)}':threshold=0.12:mipmaps=${Math.min(seed.w,seed.h)<32||region.restoration==='temporal'?2:3},metadata=add:key=aios.frame:value=1,metadata=print:file='${escapeFilterPath(metadata)}'`;
  await run('ffmpeg',['-v','error','-protocol_whitelist','file,pipe','-noautorotate','-i',input,'-vf',graph,'-an','-f','null','-'],{timeoutMs:300000,maxOutput:100000});
  if(fs.statSync(metadata).size>8_000_000)throw fail('MEDIA_TRACK_LIMIT','Dữ liệu theo dõi vượt giới hạn.');
  const tracked=validateTrajectory(parseTrackingMetadata(fs.readFileSync(metadata,'utf8')),{geometry,region,seed});
  if(shaFile(input)!==sourceSha256)throw fail('MEDIA_TRACK_CHANGED','Video thay đổi khi đang theo dõi.');
  const plan={version:1,sourceSha256,signature,geometry,seed,referenceTime:region.referenceTime,method:'ffmpeg-find-rect-every-CFR-frame',...tracked};jsonWrite(file,plan);return {file,plan};
}
/** Border interpolation, distinct from blur/cover. No neural/background reconstruction claim. */
export function interpolateRectangle(frame,width,height,{x,y,w,h}){
  if(![x,y,w,h].every(Number.isInteger)||x<1||y<1||w<2||h<2||x+w>=width-1||y+h>=height-1)throw fail('MEDIA_TRACK_EDGE','Vùng nội suy không có đủ viền nền.');
  const left=Buffer.alloc(h*3),right=Buffer.alloc(h*3),top=Buffer.alloc(w*3),bottom=Buffer.alloc(w*3);
  for(let j=0;j<h;j++){frame.copy(left,j*3,((y+j)*width+x-1)*3,((y+j)*width+x-1)*3+3);frame.copy(right,j*3,((y+j)*width+x+w)*3,((y+j)*width+x+w)*3+3);}
  frame.copy(top,0,((y-1)*width+x)*3,((y-1)*width+x+w)*3);frame.copy(bottom,0,((y+h)*width+x)*3,((y+h)*width+x+w)*3);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){
    const u=(i+1)/(w+1),v=(j+1)/(h+1),alpha=Math.min(1,(Math.min(i+1,j+1,w-i,h-j))/2);
    for(let c=0;c<3;c++){const estimate=((1-u)*left[j*3+c]+u*right[j*3+c]+(1-v)*top[i*3+c]+v*bottom[i*3+c])/2;const at=((y+j)*width+x+i)*3+c;frame[at]=Math.round(frame[at]*(1-alpha)+estimate*alpha);}
  }
}
export async function renderTrackedRemoval({workspace,source,regions,jobId,planPath}){
  const prepared=planPath?{file:within(workspace,planPath),plan:JSON.parse(fs.readFileSync(within(workspace,planPath),'utf8'))}:await prepareTrackingPlan({workspace,source,regions,jobId});
  const {plan}=prepared,input=within(workspace,source);
  if(plan.sourceSha256!==shaFile(input)||plan.signature!==regionSignature(regions))throw fail('MEDIA_TRACK_CHANGED','Kế hoạch theo dõi không khớp video/vùng hiện tại.');
  const {width,height,rate,fps}=plan.geometry;const frameBytes=width*height*3;const dir=path.join(workspace,'.tracking-jobs',jobId);fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'tracked-cleaned.mp4');
  if(regions.some(r=>r.restoration==='temporal')){const {renderTemporalRemoval}=await import('./media-temporal.mjs');return renderTemporalRemoval({input,plan,dir});}
  const decoder=spawn('ffmpeg',['-v','error','-protocol_whitelist','file,pipe','-noautorotate','-i',input,'-vf',`fps=${rate},format=rgb24`,'-an','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  const encoder=spawn('ffmpeg',['-v','error','-y','-protocol_whitelist','file,pipe','-f','rawvideo','-pix_fmt','rgb24','-s',`${width}x${height}`,'-r',rate,'-i','pipe:0','-protocol_whitelist','file,pipe','-i',input,'-map','0:v:0','-map','1:a?','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-map_metadata','-1','-t',String(plan.frames.length/fps),'-movflags','+faststart',file],{stdio:['pipe','ignore','pipe'],windowsHide:true});
  let index=0,filled=0,current=Buffer.allocUnsafe(frameBytes);let timedOut=false;
  const fixed=regions.filter(r=>r.tracking!=='template').map(r=>({x:Math.floor(r.x/100*width),y:Math.floor(r.y/100*height),w:Math.floor(r.width/100*width),h:Math.floor(r.height/100*height),start:r.start,end:r.end??plan.geometry.seconds}));
  const transform=new Transform({readableHighWaterMark:frameBytes,writableHighWaterMark:65536,transform(chunk,_enc,cb){
    try{let offset=0;while(offset<chunk.length){const n=Math.min(frameBytes-filled,chunk.length-offset);chunk.copy(current,filled,offset,offset+n);filled+=n;offset+=n;if(filled===frameBytes){const point=plan.frames[index];if(!point)throw fail('MEDIA_TRACK_FRAMES','Video giải mã có nhiều khung hơn kế hoạch.');if(point.active)interpolateRectangle(current,width,height,point);for(const r of fixed)if(point.time>=r.start&&point.time<r.end)interpolateRectangle(current,width,height,r);this.push(current);current=Buffer.allocUnsafe(frameBytes);filled=0;index++;}}cb();}catch(e){cb(e);}
  },flush(cb){cb(filled||index!==plan.frames.length?fail('MEDIA_TRACK_FRAMES','Video giải mã không khớp số khung đã theo dõi.'):null);}});
  const completion=child=>new Promise((resolve,reject)=>{let error='';child.stderr.on('data',b=>{if(error.length<10000)error+=b.toString();});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(fail('MEDIA_TRACK_RENDER',`FFmpeg xử lý chuyển động lỗi (${code}): ${error.slice(-600)}`)));});
  const decoderDone=completion(decoder),encoderDone=completion(encoder);
  const timer=setTimeout(()=>{timedOut=true;decoder.kill('SIGKILL');encoder.kill('SIGKILL');},900000);
  try{
    await Promise.all([decoderDone,encoderDone,pipeline(decoder.stdout,transform,encoder.stdin)]);
    if(timedOut)throw fail('MEDIA_TRACK_LIMIT','Xử lý chuyển động quá thời gian chờ.');
    const output=await probe(file);if(Math.abs(+output.format.duration-plan.geometry.seconds)>.25||!output.streams.some(s=>s.codec_type==='video'))throw fail('MEDIA_TRACK_RENDER','Video theo dõi không đạt kiểm tra thời lượng.');
    return {file,report:{method:'tracked-spatial-border-interpolation',inputSha256:plan.sourceSha256,outputSha256:shaFile(file),seconds:+output.format.duration,width,height,hasAudio:output.streams.some(s=>s.codec_type==='audio'),tracking:{method:plan.method,referenceTime:plan.referenceTime,frameCount:plan.frames.length,activeFrames:plan.activeFrames,worstDifference:plan.worstDifference,geometry:plan.geometry,frames:plan.frames},limits:'One fixed-size visual template; fail on missing/uncertain match. CFR normalization. No automatic OCR, scale/rotation tracking or neural inpainting; complex backgrounds may show artifacts.'}};
  }catch(e){decoder.kill('SIGKILL');encoder.kill('SIGKILL');await Promise.allSettled([decoderDone,encoderDone]);try{fs.rmSync(file,{force:true});}catch{}throw timedOut?fail('MEDIA_TRACK_LIMIT','Xử lý chuyển động quá thời gian chờ.'):e;}finally{clearTimeout(timer);}
}
