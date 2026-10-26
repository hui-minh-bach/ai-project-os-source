import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{run,shaFile,within,jsonWrite}=require('../../integrations/media-engine/src/utils.cjs');
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function grayFrameDarkFraction(buffer){
 let i=0;const token=()=>{while(i<buffer.length){if(buffer[i]===35){while(i<buffer.length&&buffer[i]!==10)i++;}else if(buffer[i]<=32)i++;else break;}const start=i;while(i<buffer.length&&buffer[i]>32)i++;return buffer.subarray(start,i).toString();};
 if(token()!=='P5')throw fail('MEDIA_OCR_FRAME','Khung OCR không phải ảnh xám hợp lệ.');const width=+token(),height=+token(),max=+token();if(buffer[i]===13&&buffer[i+1]===10)i+=2;else i++;
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||max!==255||buffer.length-i!==width*height)throw fail('MEDIA_OCR_FRAME','Khung OCR thiếu dữ liệu.');let dark=0;for(let j=i;j<buffer.length;j++)if(buffer[j]<32)dark++;return dark/(width*height);
}
export function ocrCli(env=process.env){if(env.TESSERACT_PATH)return env.TESSERACT_PATH;if(process.platform==='win32'){for(const folder of [env.ProgramFiles||'C:\\Program Files',path.join(env.LOCALAPPDATA||'C:\\','Programs')]){const candidate=path.join(folder,'Tesseract-OCR','tesseract.exe');if(fs.existsSync(candidate))return candidate;}}return 'tesseract';}
export function ocrStatus(env=process.env){
 const cli=ocrCli(env);try{const r=spawnSync(cli,['--list-langs'],{encoding:'utf8',windowsHide:true,timeout:4000,maxBuffer:16000});const langs=(r.stdout||'').split(/\r?\n/).slice(1).map(s=>s.trim()).filter(Boolean);return {ready:r.status===0&&langs.includes('eng'),languages:langs,engine:'Tesseract OCR',hint:'Cài Tesseract + eng và gói ngôn ngữ nguồn; đặt TESSERACT_PATH nếu chưa có trong PATH. Hoặc chọn chỉ che dải cuối khung, không cần OCR.'};}catch{return {ready:false,languages:[],engine:'Tesseract OCR',hint:'Chưa có Tesseract OCR. Chọn chỉ che cuối khung hoặc cài OCR trước.'};}
}
export function parseTsv(tsv,{width,height,scaledWidth,scaledHeight,time,seconds,period}){
 const lines=new Map();for(const row of tsv.split(/\r?\n/).slice(1)){
  const a=row.split('\t');if(a.length<12||a[0]!=='5')continue;const conf=+a[10],text=a.slice(11).join(' ').trim();if(conf<55||!/[\p{L}\p{N}]/u.test(text))continue;
  const x=+a[6],y=+a[7],w=+a[8],h=+a[9];if(![x,y,w,h,conf].every(Number.isFinite)||w<=0||h<6||x<0||y<0||x+w>scaledWidth+1||y+h>scaledHeight+1)continue;
  const key=a.slice(1,5).join(':'),old=lines.get(key);if(old){old.text+=' '+text;old.r=Math.max(old.r,x+w);old.b=Math.max(old.b,y+h);old.x=Math.min(old.x,x);old.y=Math.min(old.y,y);old.confidence=Math.min(old.confidence,conf);}else lines.set(key,{x,y,r:x+w,b:y+h,text,confidence:conf});
 }
 return [...lines.values()].filter(r=>r.text.length>=3).map(r=>{const x=Math.max(0,Math.floor(r.x/scaledWidth*width)-8),y=Math.max(0,Math.floor(r.y/scaledHeight*height)-8);return {x,y,w:Math.min(width-x,Math.ceil(r.r/scaledWidth*width)+8-x),h:Math.min(height-y,Math.ceil(r.b/scaledHeight*height)+8-y),start:Math.max(0,time-period*.65),end:Math.min(seconds,time+period*.65),text:r.text,confidence:r.confidence};});
}
export function mergeOcrObservations(rows){
 const out=[];for(const r of rows){const text=r.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');const old=[...out].reverse().find(o=>o.key===text&&Math.abs(o.x-r.x)<15&&Math.abs(o.y-r.y)<15&&r.start<=o.end+.1);
  if(old){old.end=Math.max(old.end,r.end);old.samples++;const right=Math.max(old.x+old.w,r.x+r.w),bottom=Math.max(old.y+old.h,r.y+r.h);old.x=Math.min(old.x,r.x);old.y=Math.min(old.y,r.y);old.w=right-old.x;old.h=bottom-old.y;old.confidence=Math.min(old.confidence,r.confidence);}else out.push({...r,key:text,samples:1});}
 return out.filter(r=>r.samples>=2||r.confidence>=85).map(({key,...r})=>r);
}
export async function prepareAutoCover({workspace,source,jobId,scope='all',regionPct=26,language='eng',env=process.env}){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId)||!['all','bottom'].includes(scope)||!Number.isInteger(regionPct)||regionPct<12||regionPct>40)throw fail('MEDIA_COVER_INPUT','Lựa chọn che phụ đề không hợp lệ.');
 if(!/^[a-z_]{3,12}(?:\+[a-z_]{3,12}){0,3}$/.test(language))throw fail('MEDIA_OCR_LANGUAGE','Mã ngôn ngữ OCR không hợp lệ.');
 const input=within(workspace,source),sourceSha256=shaFile(input),info=JSON.parse((await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_streams','-show_format','-of','json',input],{timeoutMs:30000})).stdout),v=info.streams?.find(s=>s.codec_type==='video'),seconds=+info.format?.duration;
 if(!v||!Number.isFinite(seconds)||seconds<=0||seconds>1800||v.width*v.height>3840*2160)throw fail('MEDIA_COVER_LIMIT','Che phụ đề hỗ trợ video tối đa 30 phút / 4K.');
 if((+v.tags?.rotate||0)!==0||v.side_data_list?.some(s=>s.rotation))throw fail('MEDIA_COVER_ROTATION','Xuất video đúng chiều trước khi tự tìm chữ.');
 const dir=path.join(workspace,'.auto-cover-jobs',jobId);fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'plan.json'),rectangles=[];
 if(scope==='all'){
  if(seconds>120)throw fail('MEDIA_COVER_LIMIT','Tự tìm chữ toàn khung hỗ trợ tối đa 120 giây. Tách clip hoặc chọn che dải phụ đề cuối khung cho video dài.');
  const status=ocrStatus(env);if(!status.ready)throw fail('MEDIA_OCR_MISSING',status.hint);if(language.split('+').some(l=>!status.languages.includes(l)))throw fail('MEDIA_OCR_LANGUAGE','Cài gói OCR '+language+' trong Tesseract trước, hoặc chọn che dải cuối khung.');
  const scaledWidth=Math.min(960,v.width),scaledHeight=Math.round(v.height*scaledWidth/v.width/2)*2,period=.5;
  const frames=path.join(dir,'frames');fs.mkdirSync(frames,{recursive:true});
  try{
   await run('ffmpeg',['-v','error','-y','-protocol_whitelist','file,pipe','-noautorotate','-i',input,'-vf',`fps=2,scale=${scaledWidth}:${scaledHeight},format=gray`,'-frames:v','241',path.join(frames,'%04d.pgm')],{timeoutMs:300000});
   const images=fs.readdirSync(frames).filter(n=>/^\d+\.pgm$/.test(n)).sort();if(!images.length)throw fail('MEDIA_OCR_FRAMES','Không đọc được khung hình OCR.');
   const observations=[],started=Date.now();for(let i=0;i<images.length;i++){if(Date.now()-started>360000)throw fail('MEDIA_OCR_TIMEOUT','OCR vượt 6 phút; tách clip hoặc chọn che dải cuối khung.');
    const image=path.join(frames,images[i]),mode=grayFrameDarkFraction(fs.readFileSync(image))>.8?'6':'11';
    const result=await run(ocrCli(env),[image,'stdout','-l',language,'--psm',mode,'tsv'],{timeoutMs:20000,maxOutput:1_000_000});
    observations.push(...parseTsv(result.stdout,{width:v.width,height:v.height,scaledWidth,scaledHeight,time:i*period+period/2,seconds,period}));
   }
   rectangles.push(...mergeOcrObservations(observations).filter(r=>r.y<v.height*(1-regionPct/100)));if(rectangles.length>350)throw fail('MEDIA_OCR_LIMIT','Quá nhiều vùng chữ để xử lý chắc chắn trong một tác vụ. Tách clip hoặc chọn che dải cuối khung.');
  }finally{fs.rmSync(frames,{recursive:true,force:true});}
 }
 if(shaFile(input)!==sourceSha256)throw fail('MEDIA_LOCALIZE_CHANGED','Nguồn thay đổi trong khi tìm phụ đề.');
 const plan={version:1,method:scope==='all'?'opaque-bottom-band-and-real-ocr-boxes':'opaque-bottom-band',sourceSha256,width:v.width,height:v.height,seconds,regionPct,scope,language,rectangles,notice:'Opaque cover, not background reconstruction. OCR samples at 2 FPS and can miss brief/unreadable text; the bottom band covers continuously. OCR uses the explicitly installed language packs; use bottom-band mode for scripts without an installed pack.'};jsonWrite(file,plan);return {file,plan};
}
export function validateCoverPlan(plan,width,height,seconds){
 if(!plan||plan.version!==1||plan.width!==width||plan.height!==height||!Number.isFinite(plan.seconds)||Math.abs(plan.seconds-seconds)>.15||!Number.isInteger(plan.regionPct)||plan.regionPct<12||plan.regionPct>40||!Array.isArray(plan.rectangles)||plan.rectangles.length>350)throw fail('MEDIA_COVER_PLAN','Kế hoạch che không khớp video.');
 for(const r of plan.rectangles)if(![r.x,r.y,r.w,r.h,r.start,r.end].every(Number.isFinite)||![r.x,r.y,r.w,r.h].every(Number.isInteger)||r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>width||r.y+r.h>height||r.start<0||r.end<=r.start||r.end>seconds+.1)throw fail('MEDIA_COVER_PLAN','Vùng che OCR không hợp lệ.');
 return plan;
}
export function automaticCoverFilters(plan){
 const height=Math.ceil(plan.height*plan.regionPct/100);return [`drawbox=x=0:y=${plan.height-height}:w=${plan.width}:h=${height}:color=black:t=fill`,...plan.rectangles.map(r=>`drawbox=x=${r.x}:y=${r.y}:w=${r.w}:h=${r.h}:color=black:t=fill:enable='between(t,${r.start.toFixed(3)},${r.end.toFixed(3)})'`)];
}
/** OCR text is a separate visual track; it may coexist with spoken captions. */
export function silentScreenSegments(plan,speech){
 const rows=plan.rectangles.filter(r=>r.samples>=2&&r.end-r.start>=.5&&r.y<plan.height*(1-plan.regionPct/100));
 const groups=[];for(const r of rows.sort((a,b)=>a.start-b.start||a.y-b.y)){let g=groups.find(g=>Math.abs(g.start-r.start)<.6&&Math.abs(g.end-r.end)<.6);if(!g){g={start:r.start,end:r.end,lines:[]};groups.push(g);}g.lines.push(r);}
 const segments=groups.map(g=>({start:g.start,end:g.end,text:g.lines.sort((a,b)=>a.y-b.y).map(r=>r.text).join(' ')})).filter(g=>g.text.length>=4).sort((a,b)=>a.start-b.start);
 for(let i=1;i<segments.length;i++)if(segments[i].start<segments[i-1].end){const boundary=(segments[i].start+segments[i-1].end)/2;segments[i].start=boundary;segments[i-1].end=boundary;}return segments.filter(s=>s.end-s.start>=.3).filter(g=>{const key=g.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');return key.length<9||!speech.some(s=>Math.min(s.end,g.end)>Math.max(s.start,g.start)&&(()=>{const value=s.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');return value.includes(key)||key.includes(value);})());});
}
