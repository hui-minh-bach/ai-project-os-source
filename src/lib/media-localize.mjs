import {mapSourceTime} from './media-timing.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { downloadKind } from './media-download.mjs';
import { validateRegions } from './media-region.mjs';
import {normalizeSpeechSegments,translationIntegrity,validateGlossary} from './media-content.mjs';
import {silentScreenSegments} from './media-auto-cover.mjs';
const require=createRequire(import.meta.url);
const {within,shaFile,jsonWrite}=require('../../integrations/media-engine/src/utils.cjs');
export const LOCALIZE_STEPS=Object.freeze([
  ['input','Nhận / tải video'],['transcribe','Đọc phụ đề / nhận diện lời nói'],['translate','AI dịch tiếng Việt'],
  ['cleanup','Xử lý chữ / logo cũ'],['voice','Tạo giọng Việt thay tiếng gốc'],
  ['captions','Căn phụ đề theo giọng Việt'],['export','Xuất và kiểm tra MP4']
]);
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function validateLocalization(p){
  if(!p||p.rightsConfirmed!==true)throw fail('MEDIA_RIGHTS','Xác nhận quyền tải, dịch và chỉnh sửa video.');
  if(Boolean(p.source)===Boolean(p.url))throw fail('MEDIA_INPUT','Chọn đúng một nguồn: video đã nạp hoặc liên kết.');
  if(p.source&&(typeof p.source!=='string'||p.source.length>300))throw fail('MEDIA_INPUT','Nguồn video không hợp lệ.');
  if(p.url)downloadKind(p.url);
  const language=p.sourceLanguage||'auto';
  if(language!=='auto'&&!/^[a-z]{2,3}$/.test(language))throw fail('MEDIA_INPUT','Ngôn ngữ nguồn phải là auto hoặc mã như en, zh, ja, ko.');
  const provider=p.ttsProvider||'local';
  if(!['local','windows','fpt','heygen'].includes(provider))throw fail('MEDIA_INPUT','Chọn giọng Việt Piper, Windows, FPT.AI hoặc HeyGen.');
  if(['fpt','heygen'].includes(provider)&&p.confirmPaidVoice!==true)throw fail('MEDIA_PAID_CONSENT','Cho phép chi phí giọng đã chọn trước khi chạy.');
  if(!['auto','regions','none'].includes(p.cleanupMode))throw fail('MEDIA_CLEANUP_REQUIRED','Chọn vùng chữ/logo cần xóa hoặc xác nhận video không cần xử lý.');
  if(p.captionsSource!==undefined&&(typeof p.captionsSource!=='string'||p.captionsSource.length>300||!p.captionsSource.toLowerCase().endsWith('.srt')))throw fail('MEDIA_CAPTIONS','Phụ đề nguồn phải là SRT đã nạp.');
  const autoCoverScope=p.autoCoverScope||'all';if(!['all','bottom'].includes(autoCoverScope))throw fail('MEDIA_COVER_INPUT','Chọn phạm vi che chữ.');
  const autoCoverPct=p.autoCoverPct??26;if(!Number.isInteger(autoCoverPct)||autoCoverPct<12||autoCoverPct>40)throw fail('MEDIA_COVER_INPUT','Dải phụ đề phải từ 12–40% chiều cao.');
  const ocrLanguage=p.ocrLanguage||'eng';if(!/^[a-z_]{3,12}(?:\+[a-z_]{3,12}){0,3}$/.test(ocrLanguage))throw fail('MEDIA_OCR_LANGUAGE','Chọn ngôn ngữ chữ cũ.');
  return {fitVideo:p.fitVideo===true,coverSubtitles:p.cleanupMode==='auto'||p.coverSubtitles===true,glossary:validateGlossary(p.glossary),ocrLanguage,captionsSource:p.captionsSource||undefined,autoCoverScope,autoCoverPct,source:p.source||undefined,url:p.url||undefined,sourceLanguage:language,targetLanguage:'vi',
    ttsProvider:provider,voice:typeof p.voice==='string'?p.voice.slice(0,90):undefined,
    cleanupMode:p.cleanupMode,regions:p.cleanupMode==='regions'?validateRegions(p.regions):[],
    rightsConfirmed:true,confirmPaidVoice:p.confirmPaidVoice===true};
}
function checkedSegments(segments,seconds){
  if(!Array.isArray(segments)||segments.length<1||segments.length>200)throw fail('MEDIA_ASR','Cần 1–200 câu thoại thật; video không có lời nói không được báo dịch xong.');
  let end=0;
  return segments.map(s=>{
    if(!Number.isFinite(s?.start)||!Number.isFinite(s?.end)||s.start<end-.02||s.start<0||s.end<=s.start||s.end>seconds+.1||typeof s.text!=='string'||!s.text.trim()||s.text.length>2000)throw fail('MEDIA_ASR','Mốc câu thoại không hợp lệ, chồng nhau hoặc ngoài video.');
    end=s.end;return {start:s.start,end:s.end,text:s.text.trim()};
  });
}
export function localizationProgress(workspace,jobId){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId))return null;
  try{
    const state=JSON.parse(fs.readFileSync(path.join(workspace,'.localize-jobs',jobId,'progress.json'),'utf8'));
    return {steps:state.steps.map(({key,label,state,error})=>({key,label,state,...(error?{error}: {})})),updatedAt:state.updatedAt};
  }catch{return null;}
}
/** One approved task. Dependencies come from the host, never API parameters. */
export async function runLocalization({workspace,jobId,params,deps,onProgress=()=>{},shouldStop=()=>false}){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(jobId))throw fail('MEDIA_CONTEXT','Mã tác vụ không hợp lệ.');
  const input=validateLocalization(params);
  const dir=path.join(workspace,'.localize-jobs',jobId);fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const statePath=path.join(dir,'progress.json');
  const signature=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  let state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{signature,steps:LOCALIZE_STEPS.map(([key,label])=>({key,label:key==='input'&&input.regions.some(r=>r.tracking==='template')?'Nhận video & kiểm tra đường bám':label,state:'pending'})),results:{}};
  if(state.signature!==signature)throw fail('MEDIA_LOCALIZE_CHANGED','Đầu vào khác checkpoint. Tạo tác vụ mới để duyệt lại.');
  const persist=()=>{state.updatedAt=new Date().toISOString();jsonWrite(statePath,state);onProgress(localizationProgress(workspace,jobId));};
  const verify=result=>{
    for(const item of result?._files||[]){const file=within(workspace,item.path);if(shaFile(file)!==item.sha256)throw fail('MEDIA_LOCALIZE_CHANGED','Tệp trong checkpoint đã thay đổi. Không chạy tiếp hoặc gọi lại AI tự động.');}
    return result;
  };
  const step=async(key,fn)=>{
    if(shouldStop())throw fail('MEDIA_LOCALIZE_STOPPED','Tác vụ đã dừng; không chạy bước tiếp theo.');
    for(const value of Object.values(state.results))verify(value);
    const row=state.steps.find(s=>s.key===key);
    if(row.state==='completed')return verify(state.results[key]);
    if(['running','failed'].includes(row.state)&&['translate','voice'].includes(key))throw fail('MEDIA_LOCALIZE_REVIEW','Lần gọi AI/giọng trước chưa hoàn tất. Không tự gọi lại gây phí; kiểm tra lỗi và tạo tác vụ mới với lựa chọn được duyệt.');
    row.state='running';delete row.error;persist();
    try{
      const result=await fn();
      if(shouldStop())throw fail('MEDIA_LOCALIZE_STOPPED','Tác vụ đã dừng; không chạy bước tiếp theo.');
      const sealed={...result,_files:(result.files||[]).map(file=>({path:path.relative(workspace,within(workspace,file)),sha256:shaFile(file)}))};
      delete sealed.files;state.results[key]=sealed;row.state='completed';persist();return sealed;
    }catch(e){row.state='failed';row.error=String(e.message||'Bước xử lý lỗi').slice(0,700);persist();throw e;}
  };
  const source=await step('input',async()=>{
    const made=input.url?await deps.download({url:input.url,rightsConfirmed:true}):{source:input.source};
    const file=within(workspace,made.source),info=await deps.probe(file);
    if(params.captionsSha256AtSubmit&&shaFile(within(workspace,input.captionsSource))!==params.captionsSha256AtSubmit)throw fail('MEDIA_LOCALIZE_CHANGED','SRT nguồn thay đổi sau khi duyệt tác vụ.');
    if(!info.video||!Number.isFinite(info.seconds)||info.seconds<=0||info.seconds>1800||!info.audio&&!input.captionsSource)throw fail('MEDIA_INPUT','Video cần có tiếng và thời lượng không quá 30 phút.');
    let trackingPlan,autoCoverPlan=null;
    if(input.coverSubtitles){if(!deps.prepareAutoCover)throw fail('MEDIA_COVER_ENGINE','Chưa có bộ tự che chữ.');const prepared=await deps.prepareAutoCover({source:made.source,jobId,scope:input.autoCoverScope,regionPct:input.autoCoverPct,language:input.ocrLanguage});autoCoverPlan={file:path.relative(workspace,prepared.file),plan:prepared.plan};}
    if(input.regions.some(r=>r.tracking==='template')){
      if(!deps.prepareCleanup)throw fail('MEDIA_TRACK_ENGINE','Chưa có bộ lập đường bám chuyển động.');
      const prepared=await deps.prepareCleanup({source:made.source,regions:input.regions,jobId});trackingPlan=prepared.file;
    }
    let preparedCleanup=null;
    if(input.regions.some(r=>r.restoration==='temporal')){const restored=await deps.cleanup({source:made.source,regions:input.regions,jobId,planPath:trackingPlan});preparedCleanup={source:path.relative(workspace,restored.file),report:restored.report};}
    return {autoCoverPlan,preparedCleanup,source:made.source,seconds:info.seconds,sha256:shaFile(file),trackingPlan:trackingPlan?path.relative(workspace,trackingPlan):null,files:[file,...(input.captionsSource?[within(workspace,input.captionsSource)]:[]),...(autoCoverPlan?[within(workspace,autoCoverPlan.file)]:[]),...(trackingPlan?[trackingPlan]:[]),...(preparedCleanup?[within(workspace,preparedCleanup.source)]:[])],origin:input.url?'download':'upload'};
  });
  // Always recheck source and completed products before any new external call.
  for(const value of Object.values(state.results))verify(value);
  const transcript=await step('transcribe',async()=>{
    const supplied=input.captionsSource?await deps.readCaptions({source:input.captionsSource,dir}):null;
    const tr=supplied||await deps.transcribe({source:source.source,language:input.sourceLanguage,dir});
    const segments=checkedSegments(tr.origin==='provided-source-srt'||tr.origin==='embedded-subtitle-stream'?tr.segments:normalizeSpeechSegments(tr.segments),source.seconds),screenSegments=source.autoCoverPlan?silentScreenSegments(source.autoCoverPlan.plan,segments):[];
    return {segments,screenSegments,language:tr.language||input.sourceLanguage,origin:tr.origin||'whisper-local'};
  });
  const translated=await step('translate',async()=>{
    const allSegments=[...transcript.segments,...(transcript.screenSegments||[])];
    const tr=await deps.translate(allSegments,'vi',{glossary:input.glossary});
    if(!Array.isArray(tr.texts)||tr.texts.length!==allSegments.length||tr.texts.some(t=>typeof t!=='string'||!t.trim()||t.length>1000))throw fail('MEDIA_TRANSLATION','AI trả bản dịch không khớp câu nguồn.');
    const integrity=translationIntegrity(allSegments,tr.texts,input.glossary);
    return {integrity,texts:tr.texts.slice(0,transcript.segments.length),screenTexts:tr.texts.slice(transcript.segments.length),provider:tr.provider,model:tr.model,connectionId:tr.connectionId||null};
  });
  const cleaned=await step('cleanup',async()=>{
    if(input.cleanupMode==='auto')return {source:source.source,method:source.autoCoverPlan.plan.method,report:source.autoCoverPlan.plan,coverPlan:source.autoCoverPlan.plan,files:[within(workspace,source.source),within(workspace,source.autoCoverPlan.file)]};
    if(input.cleanupMode==='none')return {source:source.source,method:'owner-confirmed-no-cleanup-needed',files:[within(workspace,source.source)]};
    if(source.preparedCleanup)return {coverPlan:source.autoCoverPlan?{...source.autoCoverPlan.plan,originalSourceSha256:source.autoCoverPlan.plan.sourceSha256,sourceSha256:shaFile(within(workspace,source.preparedCleanup.source))}:null,source:source.preparedCleanup.source,method:source.preparedCleanup.report.method,report:source.preparedCleanup.report,files:[within(workspace,source.preparedCleanup.source)]};
    const made=await deps.cleanup({source:source.source,regions:input.regions,jobId,planPath:source.trackingPlan||undefined});
    const coverPlan=source.autoCoverPlan?{...source.autoCoverPlan.plan,originalSourceSha256:source.autoCoverPlan.plan.sourceSha256,sourceSha256:shaFile(made.file)}:null;
    return {coverPlan,source:path.relative(workspace,made.file),method:made.report.method,report:{...made.report,...(coverPlan?{automaticCover:coverPlan}:{})},files:[made.file]};
  });
  const speech=await step('voice',async()=>{
    const made=await deps.voice({segments:transcript.segments,texts:translated.texts,seconds:source.seconds,dir,provider:input.ttsProvider,voice:input.voice,fitVideo:input.fitVideo});
    if(!Array.isArray(made.segments)||made.segments.length!==translated.texts.length||made.segments.some(s=>s.overflow))throw fail('MEDIA_DUB_TIMING','Giọng Việt vượt khung thời gian câu. Không cắt mất lời hoặc cho hai câu chồng nhau.');
    return {audio:path.relative(workspace,made.file),segments:made.segments,provider:made.provider,videoTimeline:made.videoTimeline||null,outputSeconds:made.outputSeconds||source.seconds,files:[made.file]};
  });
  const captions=await step('captions',async()=>{
    const spoken=speech.segments.flatMap((s,i)=>s.captionParts?.length?s.captionParts:([{start:transcript.segments[i].start,end:transcript.segments[i].start+s.voiceSeconds/s.tempo,text:translated.texts[i]}]));
    const screens=(transcript.screenSegments||[]).map((s,i)=>({...s,start:mapSourceTime(speech.videoTimeline,s.start),end:mapSourceTime(speech.videoTimeline,s.end),text:translated.screenTexts[i]}));
    const segments=checkedSegments(spoken,speech.outputSeconds);
    for(const s of screens)if(s.start<0||s.end>speech.outputSeconds+.1||s.end<=s.start)throw fail('MEDIA_CAPTIONS','Chữ trên màn hình vượt timeline mới.');
    const made=await deps.captions({segments,screenSegments:screens,width:source.autoCoverPlan?.plan.width,height:source.autoCoverPlan?.plan.height,dir});
    return {source:path.relative(workspace,made.file),renderSource:made.renderFile?path.relative(workspace,made.renderFile):null,segments,screenSegments:screens,method:screens.length?'measured-speech-chunks-plus-separate-OCR-text-track':'phrase-spans-measured-from-each-TTS-file',files:[made.file,...(made.renderFile?[made.renderFile]:[])]};
  });
  const result=await step('export',async()=>{
    const rendered=await deps.render({source:cleaned.source,audio:speech.audio,captions:captions.renderSource||captions.source,coverPlan:cleaned.coverPlan||null,videoTimeline:speech.videoTimeline,dir});
    if(rendered.qa?.passed!==true)throw fail('MEDIA_QA','MP4 không đạt kiểm tra hình/tiếng/thời lượng.');
    return {file:rendered.file,qa:rendered.qa,files:[rendered.file]};
  });
  return {file:result.file,captions:within(workspace,captions.source),styledCaptions:captions.renderSource?within(workspace,captions.renderSource):null,report:{
    workflow:'seven-step-vi-localization',sourceSha256:source.sha256,origin:source.origin,
    sourceLanguage:transcript.language,transcriptOrigin:transcript.origin,onScreenTranslations:(transcript.screenSegments||[]).map((s,i)=>({...s,text:translated.screenTexts[i]})),targetLanguage:'vi',translation:{provider:translated.provider,model:translated.model,connectionId:translated.connectionId,integrity:translated.integrity},
    cleanup:cleaned.method,cleanupReport:cleaned.report||null,voiceProvider:speech.provider,videoTimeline:speech.videoTimeline,sourceSeconds:source.seconds,outputSeconds:speech.outputSeconds,
    captions:{method:captions.method,segments:captions.segments},qa:result.qa,
    steps:state.steps.map(({key,label,state})=>({key,label,state})),
    limits:'Phrase-level timing, not lip sync or measured word karaoke. Cleanup uses selected spatial interpolation or observed temporal background recovery, completed before external calls when temporal is selected. Template tracking needs one visual seed and stops on loss; Auto cover is opaque, not neural inpainting; OCR is sampled at 2 FPS and can miss brief/unreadable text. Installed language packs required. No scale/rotation recovery.'}};
}
