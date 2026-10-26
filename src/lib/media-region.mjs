import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {run,shaFile,within}=require('../../integrations/media-engine/src/utils.cjs');
const ffprobe=async file=>JSON.parse((await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',file],{timeoutMs:30000})).stdout);
const fail=message=>Object.assign(new Error(message),{code:'MEDIA_REGION'});
export function validateRegions(regions) {
  if(!Array.isArray(regions)||regions.length<1||regions.length>6)throw fail('Chọn 1–6 vùng chữ/logo.');
  return regions.map(r=>{
    if(!r||!['x','y','width','height'].every(k=>typeof r[k]==='number'&&Number.isFinite(r[k])))throw fail('Vùng phải dùng số phần trăm hữu hạn.');
    if(r.x<1||r.y<1||r.width<1||r.height<1||r.x+r.width>99||r.y+r.height>99)throw fail('Mỗi vùng cần cách mép ít nhất 1%, nằm trong khung hình.');
    const start=r.start===undefined?0:r.start,end=r.end===undefined?null:r.end;
    if(typeof start!=='number'||!Number.isFinite(start)||start<0||end!==null&&(typeof end!=='number'||!Number.isFinite(end)||end<=start))throw fail('Mốc kết thúc phải lớn hơn bắt đầu.');
    if(r.tracking!==undefined&&!['fixed','template'].includes(r.tracking))throw fail('Chế độ theo dõi không hợp lệ.');
    if(r.restoration!==undefined&&!['spatial','temporal'].includes(r.restoration))throw fail('Chế độ phục hồi nền không hợp lệ.');
    if(r.restoration==='temporal'&&r.tracking!=='template')throw fail('Phục hồi nền lân cận cần bật bám chuyển động.');
    const moving=r.tracking==='template';const referenceTime=r.referenceTime??start;
    if(moving&&(typeof referenceTime!=='number'||!Number.isFinite(referenceTime)||referenceTime<start||end!==null&&referenceTime>=end))throw fail('Khung tham chiếu phải nằm trong khoảng xử lý.');
    return {x:r.x,y:r.y,width:r.width,height:r.height,start,end,...(moving?{tracking:'template',referenceTime}:{}),...(r.restoration==='temporal'?{restoration:'temporal'}:{})};
  });
}
export async function removeRegions({workspace,source,regions,rightsConfirmed,jobId,planPath}) {
  if(rightsConfirmed!==true)throw fail('Xác nhận quyền chỉnh sửa video trước.');
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId))throw fail('Mã tác vụ không hợp lệ.');
  const input=within(workspace,source),probe=await ffprobe(input),v=probe.streams.find(s=>s.codec_type==='video');
  if(!v||!Number.isFinite(+probe.format?.duration))throw fail('Nguồn không phải video có thời lượng.');
  const seconds=+probe.format.duration;if(seconds>1800||v.width*v.height>3840*2160)throw fail('Hỗ trợ tối đa 30 phút và 4K.');
  if((+v.tags?.rotate||0)!==0||v.side_data_list?.some(s=>s.rotation))throw fail('Video có metadata xoay. Xuất video đúng chiều trước khi chọn vùng.');
  const normalized=validateRegions(regions);
  if(normalized.some(r=>r.restoration==='temporal')&&normalized.length!==1)throw fail('Phục hồi nền hỗ trợ một vùng mỗi tác vụ.');
  if(normalized.some(r=>r.tracking==='template')){const {renderTrackedRemoval}=await import('./media-tracking.mjs');return renderTrackedRemoval({workspace,source,regions:normalized,jobId,planPath});}
  const pixelRegions=normalized.map(r=>{
    if(r.start>=seconds||r.end!==null&&r.end>seconds+.01)throw fail('Vùng nằm ngoài thời lượng video.');
    return {x:Math.floor(r.x*v.width/100),y:Math.floor(r.y*v.height/100),w:Math.max(2,Math.floor(r.width*v.width/100)),h:Math.max(2,Math.floor(r.height*v.height/100)),start:r.start,end:r.end??seconds};
  });
  const filters=pixelRegions.map(r=>`delogo=x=${r.x}:y=${r.y}:w=${r.w}:h=${r.h}:show=0:enable='between(t,${r.start},${r.end})'`).join(',');
  const dir=path.join(workspace,'.region-jobs',jobId);fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'region-cleaned.mp4');
  try {
    await run('ffmpeg',['-v','error','-y','-protocol_whitelist','file,pipe','-noautorotate','-i',input,'-map','0:v:0','-map','0:a?',
      '-vf',filters,'-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',
      '-map_metadata','-1','-movflags','+faststart',file],{timeoutMs:Math.min(1800000,Math.max(120000,seconds*15000))});
    const out=await ffprobe(file);if(!out.streams.some(s=>s.codec_type==='video')||Math.abs(+out.format.duration-seconds)>.25)throw fail('Video kết quả không đạt kiểm tra thời lượng.');
    return {file,report:{method:'ffmpeg-delogo-spatial-interpolation',regions:pixelRegions,seconds,width:v.width,height:v.height,
      inputSha256:shaFile(input),outputSha256:shaFile(file),hasAudio:out.streams.some(s=>s.codec_type==='audio'),
      limits:'Vùng cố định và mốc thời gian thủ công. Nội suy nền lân cận; có thể còn vệt. Không phải AI inpainting, OCR hay tự bám logo di chuyển.'}};
  } catch(e) {fs.rmSync(file,{force:true});throw e;}
}
