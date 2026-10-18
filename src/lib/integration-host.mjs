/**
 * AI Project OS integration boundary.
 * The independently handed-off AI Core and Media Engine sources are intentionally unchanged.
 * Local-only, opt-in bridge: no browser-visible bearer token.
 * Social publishing (YouTube/Facebook/TikTok) was added 2026-10-17 on the
 * owner's explicit directive: opt-in per connection, always behind the task
 * approval gate, and success is only reported on platform confirmation.
 */
import fs from 'node:fs';
import { findInstalledConcat, configPath, openConcat, concatRunning } from './concat-managed.mjs';

import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHeygenTts } from './heygen-tts.mjs';
import { piperStatus, piperSynthesize, piperVoiceFor } from './local-piper-tts.mjs';
import { buildVoiceover } from './voiceover.mjs';
import { writeWordCaptions } from './voice-captions.mjs';
import { DATA_DIR } from './store.mjs';
import { findServiceCredential, findConnectionByKind } from './vault.mjs';
import { youtubeUpload, facebookUpload, tiktokUpload, youtubeStats, facebookStats, tiktokStats, platformConnectionStatus, isSimulatedEndpoint, platformBase, PLATFORM_KINDS } from './publish-platforms.mjs';
import { createPublishRecords } from './publish-records.mjs';
import { mediaPlannerStatus, mediaModelPlan, mediaReviewerPlan, translateSegmentsWithModel, writeRethemeScriptWithModel, splitScriptAcrossWindows, writeTextWithModel, buildDirectorModelCall, parseDirectorPlan, routeDirectorPlan, groupSpeechSegments } from './media-ai.mjs';
import { generateImage, IMAGE_PROVIDERS } from './image-gen.mjs';
import { whisperStatus, transcribeLocal } from './local-whisper.mjs';

const require=createRequire(import.meta.url);
const PROJECT_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {createStandaloneCore}=require('../../integrations/ai-core/server.cjs');
const {createCore}=require('../../integrations/ai-core/core.cjs');
const {registerMediaEngine}=require('../../integrations/media-engine/index.cjs');
const storyLogic=require('../../integrations/media-engine/src/story.cjs');
const concatRpc=require('../../integrations/media-engine/src/concat.cjs');
const concatMultitrack=require('../../integrations/media-engine/src/concat-multitrack.cjs');
const mediaTimeline=require('../../integrations/media-engine/src/timeline.cjs');
const mediaSubtitles=require('../../integrations/media-engine/src/subtitles.cjs');
const mediaUtils=require('../../integrations/media-engine/src/utils.cjs');
const ALLOWED_OPERATIONS=Object.freeze({
  'media.analyze':'video_edit',
  'media.subtitle-edit':'video_edit',
  'media.edit-plan':'video_edit',
  'media.quick-edit':'video_edit',
  'media.render':'video_edit',
  'media.voiceover':'video_edit',
  'media.tts-video':'video_edit',
  'media.image':'video_edit',
  'media.concat-effects':'video_edit',
  'media.dub':'video_edit',
  'media.retheme':'video_edit',
  'media.story':'story',
  'media.story-outline':'story',
  'media.publish-youtube':'publish',
  'media.publish-facebook':'publish',
  'media.publish-tiktok':'publish',
  'media.publish-draft':'publish'
});
const UPLOAD_EXT=new Set(['.mp4','.mkv','.mov','.webm','.m4v','.mp3','.wav','.m4a','.txt','.srt','.vtt']);
const MAX_UPLOAD_BYTES=150*1024*1024;
const safeId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
const safeFileName=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(value);
function err(code,message){const e=new Error(message);e.code=code;return e;}
function checkFile(base,target){const root=fs.realpathSync(base);const p=path.resolve(root,target);if(!(p.startsWith(root+path.sep)))throw err('MEDIA_PATH','Tệp không nằm trong thư mục media được cấp phép.');const real=fs.realpathSync(p);if(!real.startsWith(root+path.sep))throw err('MEDIA_PATH','Không theo liên kết ra ngoài workspace.');if(!fs.statSync(real).isFile())throw err('MEDIA_PATH','Nguồn không phải tệp.');return real;}
function shaFileSync(file){
  const fd=fs.openSync(file,'r');const hash=crypto.createHash('sha256'),buf=Buffer.allocUnsafe(1024*1024);
  try{let len;while((len=fs.readSync(fd,buf,0,buf.length,null))>0)hash.update(buf.subarray(0,len));}
  finally{fs.closeSync(fd);}return hash.digest('hex');
}
function binaryReady(binary){try{return execFileSync(binary,['-version'],{timeout:3500,encoding:'utf8',maxBuffer:15000,windowsHide:true}).split('\n')[0].trim()}catch{return null;}}
// Probe the actual source before approval; a plan's self-reported duration is
// NOT evidence. This also prevents queued tasks targeting another video.
function readRealMediaInfo(file){
  let info;
  try{info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file],
    {encoding:'utf8',timeout:10000,maxBuffer:3_000_000,windowsHide:true}));}
  catch{throw err('BLOCKED_FFPROBE','Không đọc được thông số video thực. Kiểm tra FFprobe trong Hướng dẫn rồi thử lại.');}
  const seconds=Number(info?.format?.duration);
  const streams=Array.isArray(info?.streams)?info.streams:[];
  if(!Number.isFinite(seconds)||seconds<=0||!streams.some(s=>s.codec_type==='video'))
    throw err('MEDIA_PLAN_SOURCE','Video nguồn không có hình hoặc thời lượng hợp lệ. Chọn lại video.');
  const sha256=shaFileSync(file);
  return {path:file,seconds,sha256,artifactId:'sha256:'+sha256,streams};
}
function verifiedPlan(params,file){
  if(params.editPlan?.schemaVersion!==2||!params.editPlan.sourceSha256||!params.editPlan.sourceArtifactId)
    throw err('MEDIA_PLAN_SOURCE','Timeline đời cũ chưa khóa nguồn video. Hãy tạo kế hoạch mới từ video gốc.');
  const real=readRealMediaInfo(file);
  mediaTimeline.validate(params.editPlan,real);
  return real.sha256;
}

function unwrapJson(response){const content=String(response||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');return JSON.parse(content);}

export function createIntegrationHost({root=PROJECT_ROOT, env=process.env, clock=true,ttsFetch=globalThis.fetch}={}){
  const data=path.resolve(root)===PROJECT_ROOT ? DATA_DIR : path.join(root,'.data');
  const mediaWorkspace=path.join(data,'media-workspace');
  const publishRecords=createPublishRecords({file:path.join(data,'publish-records.json')});
  const externalIndexPath=path.join(data,'media-large-index.json');
  let externalArtifacts={version:1,items:[]};
  const handlers=new Map();
  let core=null,media=null,timer=null,problem=null,probeCache=null,probeAt=0,mode=null;
  const tts=createHeygenTts({apiKey:()=>findServiceCredential('heygen_tts')?.secret||env.HEYGEN_API_KEY||'',defaultVoice:()=>findServiceCredential('heygen_tts')?.voiceId||env.HEYGEN_TTS_VOICE_ID||'',fetchImpl:ttsFetch});
  function ttsChoice(requested='auto'){
    // Never select a billable provider without an explicit user choice.
    // Legacy 'auto' jobs use local only; if local is absent they block.
    if(!['auto','local','heygen'].includes(requested))throw err('BLOCKED_TTS','Nhà cung cấp giọng không hợp lệ.');
    if(requested==='heygen'){
      if(!tts.configured())throw err('BLOCKED_TTS','HeyGen chưa được cấu hình; chọn Piper local hoặc nạp âm thanh từ Concat.');
      return {...tts,provider:'heygen'};
    }
    const local=piperStatus(env);
    if(!local.ready)throw err('BLOCKED_LOCAL_TTS',local.installHint);
    return {provider:'piper-local',configured:()=>true,synthesize:input=>piperSynthesize({...input,env})};
  }
  const taskContext=new Map();
  function concatSettings(){const credential=findServiceCredential('concat_remote');const token=credential?.secret||env.CONCAT_API_TOKEN||'';return {host:'127.0.0.1',port:Number(env.CONCAT_API_PORT||7420),token};}
  async function checkConcat(){
    const setting=concatSettings();
    if(!setting.token)throw err('BLOCKED_CONCAT','Mở Vault và bấm Cài + kết nối Concat tự động trong Video Studio.');
    let version;
    try{version=await concatRpc.probe(setting);}
    catch(original){
      // Managed engine: revive Concat on demand only when the saved local
      // configuration matches the Vault token. Never overwrite live edits.
      if(process.platform!=='win32')throw original;
      const exe=findInstalledConcat(env);
      let prefs=null;
      try{prefs=JSON.parse(fs.readFileSync(configPath(env),'utf8'));}catch{}
      if(!exe||prefs?.server?.enabled!==true||prefs.server.listen!==`127.0.0.1:${setting.port}`||prefs.server.token!==setting.token||concatRunning())throw original;
      openConcat(exe);
      for(let i=0;i<8;i++){
        await new Promise(resolve=>setTimeout(resolve,850));
        try{version=await concatRpc.probe(setting);break;}catch{}
      }
      if(!version)throw err('BLOCKED_CONCAT','Đã mở Concat nhưng Remote chưa sẵn sàng; mở ứng dụng và kiểm tra lại.');
    }
    return {connected:true,apiVersion:version.apiVersion||null,concatVersion:version.concat||null};
  }

  function persistExternalIndex(){
    fs.mkdirSync(data,{recursive:true,mode:0o700});
    const tmp=externalIndexPath+'.'+crypto.randomUUID()+'.tmp';
    try{fs.writeFileSync(tmp,JSON.stringify(externalArtifacts,null,2),{flag:'wx',mode:0o600});fs.renameSync(tmp,externalIndexPath);}
    finally{try{fs.rmSync(tmp,{force:true})}catch{}}
  }
  function verifiedExternal(id){
    const meta=externalArtifacts.items.find(x=>x.id===id);
    if(!meta)throw err('MEDIA_NOT_FOUND','Không tìm thấy artifact media lớn.');
    mediaTask(meta.taskId); // require a genuine Media task even after restart.
    const file=checkFile(mediaWorkspace,meta.sourceRelative);
    if(fs.statSync(file).size!==meta.size||shaFileSync(file)!==meta.sha256)throw err('MEDIA_INTEGRITY','Video đã thay đổi; kiểm tra SHA-256 thất bại.');
    const {sourceRelative,...metadata}=meta;
    return {metadata,filePath:file};
  }
  function requireCore(){if(!core)throw err('CORE_OFFLINE','AI Core chưa được kích hoạt. Thiết lập AI_PROJECT_OS_CORE_MASTER_KEY (32+ ký tự) trên máy local.');return core;}
  function start(){
    if(core)return;
    const master=env.AI_PROJECT_OS_CORE_MASTER_KEY || env.KBL_CORE_MASTER_KEY;
    if(master&&(typeof master!=='string'||master.length<32)){problem='AI_PROJECT_OS_CORE_MASTER_KEY phải dài ít nhất 32 ký tự.';return;}
    try{
      fs.mkdirSync(mediaWorkspace,{recursive:true,mode:0o700});
      if(fs.existsSync(externalIndexPath)){externalArtifacts=JSON.parse(fs.readFileSync(externalIndexPath,'utf8'));if(!Array.isArray(externalArtifacts?.items)||externalArtifacts.version!==1)throw err('MEDIA_INDEX','Chỉ mục media lớn không hợp lệ, chưa đọc dữ liệu.');}
      // The deterministic local queue/media bridge needs no online credentials.
      // Only an explicit master unlocks a Core vault for model providers.
      core=master?createStandaloneCore({root:path.join(data,'core-v1'),master,concurrency:2}):createCore({root:path.join(data,'core-v1'),concurrency:2});
      mode=master?'vault-enabled':'local-only';
      const gateway={invoke:async(request)=>{
        const capability=request?.capability;
        if(capability==='speech.synthesize'){const tts=ttsChoice(request?.input?.ttsProvider||'auto');let input=request.input;if(tts.provider==='piper-local'&&input&&typeof input==='object'){const v=piperVoiceFor(input.voice,env);if(v)input={...input,voice:v};}return tts.synthesize(input);}
        if(capability==='speech.transcribe'){
          const audio=checkFile(mediaWorkspace,request?.input?.audio||'');
          const jobId=String(request?.jobId||'');
          const outputRoot=path.join(mediaWorkspace,'.transcript-jobs',jobId.replace(/[^a-zA-Z0-9_-]/g,'_'));
          return transcribeLocal({audio,outputRoot,language:request?.input?.language||'vi',env});
        }
        if(capability==='image.generate'){
          const jobId=String(request?.jobId||'gateway').replace(/[^a-zA-Z0-9_-]/g,'_');
          const dir=path.join(mediaWorkspace,'.gateway-image-jobs',jobId);
          fs.mkdirSync(dir,{recursive:true,mode:0o700});
          const made=await generateImage({provider:request?.input?.provider||'auto',prompt:request?.input?.prompt,output:path.join(dir,'image.png'),size:request?.input?.size});
          return {file:path.relative(mediaWorkspace,made.file),provider:made.provider,model:made.model,bytes:made.bytes,revisedPrompt:made.revisedPrompt||null};
        }
        if(!['video.edit-plan','story.adapt','text.translate'].includes(capability))
          throw err('BLOCKED_PROVIDER',`Chưa có adapter nhà cung cấp thật cho ${capability}. Không giả lập kết quả AI/STT/TTS.`);
        let prompt;
        if(capability==='video.edit-plan')prompt='Return only JSON {"kind":"edit","ratio":"16:9|9:16|1:1","segments":[{"start":0,"end":1}]}, respecting video length and user request. '+JSON.stringify(request.input);
        else if(capability==='story.adapt')prompt='Rewrite provided story naturally. Preserve facts, characters and consent. Reply as text only. '+JSON.stringify(request.input);
        else prompt='Translate text accurately. Return translation text only. '+JSON.stringify(request.input);
        const projectId=taskContext.get(request?.jobId)?.projectId;
        if(capability==='video.edit-plan'&&projectId){
          const selection=mediaPlannerStatus(projectId);
          if(selection.available)return mediaModelPlan(projectId,request.input);
        }
        let reply;
        try { reply=await core.providers.generate('Worker',{prompt,maxOutputTokens:900}); }
        catch(e){
          // Only expected configuration/budget limits permit the clearly labeled local
          // edit-plan fallback. Do not turn actual provider/API failures into fake success.
          if(['MODEL_UNASSIGNED','BUDGET_BLOCKED','VAULT_MISSING','VAULT_LOCKED','PROVIDER_QUOTA'].includes(e.code))
            throw err('BLOCKED_PROVIDER',`Chưa có AI Worker có ngân sách/khả năng gọi model (${e.code}); áp dụng timeline quy tắc local nếu hỗ trợ.`);
          throw e;
        }
        if(capability==='video.edit-plan'){try{return unwrapJson(reply.text);}catch{throw err('BLOCKED_PROVIDER','AI trả về kế hoạch dựng không hợp lệ.');}}
        return {text:reply.text};
      }};
      const artifactPort={
        putFile:async({jobId,source,name})=>{
          const ctx=taskContext.get(jobId);if(!ctx)throw err('MEDIA_CONTEXT','Không có tác vụ đang được xác thực.');
          const file=checkFile(mediaWorkspace,source);
          const size=fs.statSync(file).size;
          if(size>1024*1024*1024)throw err('MEDIA_ARTIFACT_LIMIT','Tệp lớn hơn giới hạn 1GB của Media Studio.');
          if(size>15*1024*1024){
            // The unchanged AI Core caps artifacts at 15 MB. Save a small Core
            // receipt and use a separately indexed, SHA-verified local file for
            // real full-size footage, without weakening the Core artifact store.
            const id=crypto.randomUUID(),sha256=shaFileSync(file),sourceRelative=path.relative(mediaWorkspace,file);
            const large={id,projectId:ctx.projectId,taskId:ctx.taskId,name,sha256,size,createdAt:new Date().toISOString(),sourceRelative,storage:'media-workspace-large'};
            const receipt=core.artifacts.put({projectId:ctx.projectId,taskId:ctx.taskId,name:`${name}.receipt.json`,content:JSON.stringify({id,name,sha256,size,storage:'media-workspace-large'})});
            ctx.ids.push(receipt.id);ctx.externalIds.push(id);externalArtifacts.items.push(large);persistExternalIndex();
            return {uri:`media-file:${id}`,sha256,id};
          }
          const item=core.artifacts.put({projectId:ctx.projectId,taskId:ctx.taskId,name,content:fs.readFileSync(file)});ctx.ids.push(item.id);return {uri:`core-artifact:${item.id}`,sha256:item.sha256,id:item.id};
        },
        putJson:async({jobId,name,data:payload})=>{
          const ctx=taskContext.get(jobId);if(!ctx)throw err('MEDIA_CONTEXT','Không có tác vụ đang được xác thực.');
          const item=core.artifacts.put({projectId:ctx.projectId,taskId:ctx.taskId,name,content:Buffer.from(JSON.stringify(payload,null,2))});ctx.ids.push(item.id);return {uri:`core-artifact:${item.id}`,sha256:item.sha256,id:item.id};
        }
      };
      media=registerMediaEngine({CoreServices:{ProviderGateway:gateway,ArtifactStore:artifactPort,
        TaskQueue:{registerTask:(name,fn)=>{if(handlers.has(name))throw err('MEDIA_DUPLICATE','Đăng ký media task trùng.');handlers.set(name,fn);}},
        EventBus:{publish:(topic,payload)=>core.state.emit(topic,payload)}
      },workspace:mediaWorkspace});
      // Concat is a genuine editable multitrack document: original scene clips
      // are imported separately into its project, not one pre-flattened MP4.
      // The verified FFmpeg output remains independently available as fallback.
      const originalQuick=handlers.get('media.quick-edit');
      handlers.set('media.quick-edit',async args=>{
        const payload=args||{};
        // A token alone is not proof the external editor is running. Reject
        // before FFmpeg spends time rendering a preview/final for a Concat task.
        if(payload.concatProject)await checkConcat();
        const base=await originalQuick(args);
        let output=base.final.file,narrationAudio=null,captionsPath=null;
        const jobId=args.jobId;
        const dir=path.join(mediaWorkspace,'.enhanced-quick-jobs',jobId);
        const preCaptions=path.join(path.dirname(base.final.file),'captions.srt');
        if(fs.existsSync(preCaptions))captionsPath=preCaptions;
        if(payload.captionsSource)captionsPath=checkFile(mediaWorkspace,payload.captionsSource);
        if(payload.narrationAudio)narrationAudio=checkFile(mediaWorkspace,payload.narrationAudio);
        let synthesis=null;
        if(payload.narrationText){
          fs.mkdirSync(dir,{recursive:true,mode:0o700});
          narrationAudio=path.join(dir,'narration.wav');
          synthesis=await ttsChoice(payload.narrationProvider||'auto').synthesize({
            text:payload.narrationText,voice:payload.voice||undefined,rate:1,language:'vi',output:narrationAudio});
          const utils=require('../../integrations/media-engine/src/utils.cjs');
          const info=await utils.ffprobe(narrationAudio,'ffprobe');
          let caps=writeWordCaptions(path.join(dir,'narration-captions.srt'),synthesis.wordTimestamps,{audioSeconds:utils.duration(info)});
          if(!caps&&whisperStatus(env).ready){
            const result=await transcribeLocal({audio:narrationAudio,outputRoot:path.join(dir,'captions-whisper'),language:'vi',env});
            const sub=require('../../integrations/media-engine/src/subtitles.cjs');
            const file=path.join(dir,'narration-captions.srt');
            fs.writeFileSync(file,sub.srt(result.segments));caps={file};
          }
          if(caps&&!payload.captionsSource)captionsPath=caps.file;
        }
        if(narrationAudio){
          const mixed=await buildVoiceover({workspace:mediaWorkspace,jobDir:path.join(dir,'mix'),
            videoSource:path.relative(mediaWorkspace,output),audioSource:path.relative(mediaWorkspace,narrationAudio),
            captionsSource:captionsPath?path.relative(mediaWorkspace,captionsPath):null,
            musicSource:payload.musicSource||null,musicVolume:payload.musicVolume??.12,alignment:'hold'});
          output=mixed.file;
          if(synthesis){
            await artifactPort.putFile({jobId,source:narrationAudio,name:'narration.wav'});
            await artifactPort.putJson({jobId,name:'narration-report.json',data:{provider:synthesis.provider,
              source:synthesis.provider==='piper-local'?'offline-user-installed-model':'approved-external-tts',
              captions:captionsPath?'real-timing-or-user-upload':'unavailable',qa:mixed.qa}});
          }
          await artifactPort.putFile({jobId,source:output,name:'video-with-ai-narration.mp4'});
          if(captionsPath)await artifactPort.putFile({jobId,source:captionsPath,name:'narration-captions.srt'});
        }
        if(payload.concatProject){
          const setting=concatSettings();
          if(!setting.token)throw err('BLOCKED_CONCAT','Concat chưa kết nối; hãy lưu token trong Vault.');
          const created=await concatMultitrack.createMultitrackProject({
            settings:setting,workspace:mediaWorkspace,source:payload.source,
            timeline:base.timeline,jobId,captionsSource:captionsPath,
            narrationSource:narrationAudio,musicSource:payload.musicSource||null,
            musicVolume:payload.musicVolume??.12,title:payload.concatTitle||''});
          const checker=require('../../integrations/media-engine/src/quality.cjs');
          const qa=await checker.check({file:created.exported,expectedDuration:created.expectedSeconds});
          if(!qa.passed)throw err('CONCAT_QUALITY','Concat xuất video chưa đạt: '+qa.problems.join(', '));
          const safeReport={...created,qaPassed:true,qa,mode:'real-separate-scene-audio-title-tracks',
            voiceProvider:synthesis?.provider|| (narrationAudio?'user-owned-upload':'none')};
          // The paths are local-only metadata; actual audio/video is never sent
          // to remote providers for this workflow.
          await artifactPort.putJson({jobId,name:'concat-multitrack-project.json',data:safeReport});
          await artifactPort.putFile({jobId,source:created.exported,name:'concat-export.mp4'});
        }
        return {...base,enhancedFinal:output};
      });
      // Offline voice substitution: real audio from an authorized upload, no TTS needed.
      handlers.set('media.voiceover',async({jobId,source,audioSource,captionsSource,musicSource,musicVolume,alignment,hardsubCover='off',hardsubRegionPct=13})=>{
        const rendered=await buildVoiceover({workspace:mediaWorkspace,jobDir:path.join(mediaWorkspace,'.voiceover-jobs',jobId),videoSource:source,audioSource,captionsSource,musicSource,musicVolume,alignment,hardsubCover:{mode:hardsubCover,regionPct:hardsubRegionPct}});
        await artifactPort.putFile({jobId,source:rendered.file,name:'video-with-natural-voice.mp4'});
        if(rendered.captionPath)await artifactPort.putFile({jobId,source:rendered.captionPath,name:'captions.srt'});
        await artifactPort.putJson({jobId,name:'voiceover-report.json',data:{qa:rendered.qa,voiceOrigin:rendered.voiceOrigin,subtitleSync:rendered.subtitleSync,alignment:rendered.alignment,videoSeconds:rendered.videoSeconds,audioSeconds:rendered.audioSeconds,musicMixed:rendered.musicMixed,musicVolume:rendered.musicVolume}});
        return rendered;
      });
      // AI image generation through the user's own connections: the logged-in
      // ChatGPT account (Codex hosted image tool) or a Vault API connection.
      // No route configured -> the task fails honestly at execution time.
      handlers.set('media.image',async({jobId,scenes,imageProvider='auto',size})=>{
        const dir=path.join(mediaWorkspace,'.image-jobs',jobId);
        fs.mkdirSync(dir,{recursive:true,mode:0o700});
        const report={provider:null,model:null,scenes:[]};
        for(let i=0;i<scenes.length;i++){
          const made=await generateImage({provider:imageProvider,prompt:scenes[i].prompt,output:path.join(dir,`scene-${String(i+1).padStart(2,'0')}.png`),size});
          report.provider=made.provider;report.model=made.model;
          const put=await artifactPort.putFile({jobId,source:made.file,name:path.basename(made.file)});
          report.scenes.push({index:i+1,name:typeof scenes[i].name==='string'?scenes[i].name:null,prompt:scenes[i].prompt,artifactSha256:put.sha256,bytes:made.bytes,revisedPrompt:made.revisedPrompt||null});
        }
        await artifactPort.putJson({jobId,name:'images-report.json',data:report});
        return {count:scenes.length,provider:report.provider,model:report.model};
      });
      // Post-production pass: a finished worker/local render goes through
      // Concat for titles, captions, music and transitions. The edit plan is
      // either supplied manually or planned by the project's Reviewer-role
      // model; Concat renders deterministically and QA gates the export.
      handlers.set('media.concat-effects',async({jobId,source,prompt,planSource='reviewer',plan:manualPlan,title,captionsSource,musicSource,musicVolume})=>{
        await checkConcat();
        const ctx=taskContext.get(jobId);
        const srcFile=checkFile(mediaWorkspace,source);
        const real=readRealMediaInfo(srcFile);
        let plan=manualPlan||null;
        if(planSource!=='manual'){
          if(!ctx?.projectId)throw err('MEDIA_CONTEXT','Không có dự án để lấy vai Reviewer.');
          plan=await mediaReviewerPlan(ctx.projectId,{prompt:prompt||'Kiểm tra và thêm hiệu ứng, tiêu đề, chuyển cảnh phù hợp cho phim đã dựng.',media:{seconds:real.seconds,streams:real.streams}});
        }
        if(!plan||plan.kind!=='edit'||!Array.isArray(plan.segments)||!plan.segments.length)throw err('MEDIA_INPUT','Kế hoạch hiệu ứng không hợp lệ.');
        for(const s of plan.segments){if(!Number.isFinite(s?.start)||!Number.isFinite(s?.end)||s.start<0||s.end-s.start<0.15||s.end>real.seconds+0.05)throw err('MEDIA_PLAN_RANGE','Đoạn hiệu ứng nằm ngoài thời lượng video thật.');}
        const dims=plan.ratio==='9:16'?{width:720,height:1280}:plan.ratio==='1:1'?{width:960,height:960}:{width:1280,height:720};
        const timeline={kind:'edit',ratio:plan.ratio||'16:9',framing:plan.framing||'crop',transition:plan.transition||'cut',transitionSeconds:Number(plan.transitionSeconds||0),segments:plan.segments,...dims};
        const created=await concatMultitrack.createMultitrackProject({settings:concatSettings(),workspace:mediaWorkspace,source,timeline,jobId,captionsSource:captionsSource||null,narrationSource:null,musicSource:musicSource||null,musicVolume:musicVolume??.12,title:title||plan.title||''});
        const checker=require('../../integrations/media-engine/src/quality.cjs');
        const qa=await checker.check({file:created.exported,expectedDuration:created.expectedSeconds});
        if(!qa.passed)throw err('CONCAT_QUALITY','Concat xuất video chưa đạt: '+qa.problems.join(', '));
        const report={...created,qaPassed:true,qa,mode:'reviewer-or-manual-plan-concat-multitrack',planSource,planProvider:planSource==='manual'?'manual':'project-reviewer-role',
          applied:{transition:timeline.transition,transitionSeconds:timeline.transitionSeconds,title:title||plan.title||null,captions:!!captionsSource,music:!!musicSource,segments:plan.segments.length},
          effectsRequested:Array.isArray(plan.effects)?plan.effects:[],effectsAppliedByConcat:[],effectsNote:'Concat multitrack 0.2 chưa áp dụng hiệu ứng toàn cục (fade-in-out); các hiệu ứng này được ghi nhận nhưng không áp dụng, không báo cáo giả.'};
        await artifactPort.putJson({jobId,name:'concat-effects-report.json',data:report});
        await artifactPort.putFile({jobId,source:created.exported,name:'concat-export.mp4'});
        return report;
      });
      // Full re-dubbing: source segments (supplied SRT or local Whisper) are
      // translated (verified project model, or texts supplied with the task),
      // re-voiced segment by segment against the original timings, and the
      // original audio track is fully replaced. Timings never come from AI.
      // Shared speech-track assembly for dub + retheme (0.9.11 smoothness):
      // TTS reads GROUPED neighbouring windows in one pass (continuous
      // prosody instead of a cold start per window), tempo is capped at
      // 1.25x, every placed group gets soft in/out fades, and a very quiet
      // room-tone bed replaces the dead digital silence between groups.
      async function assembleSpeechTrack({dir,segments,texts,provider,voice,language,totalSeconds,outName}){
        const groups=groupSpeechSegments(segments.map((sg,i)=>({...sg,text:texts[i]})));
        const segReports=new Array(segments.length);
        const groupFiles=[],filters=[];
        for(let g=0;g<groups.length;g++){
          const grp=groups[g];
          const gWav=path.join(dir,`grp-${String(g+1).padStart(3,'0')}.wav`);
          await provider.synthesize({text:grp.indexes.map(i=>texts[i]).join(' '),voice,rate:1,language,output:gWav});
          const dur=mediaUtils.duration(await mediaUtils.ffprobe(gWav,'ffprobe'));
          const nextStart=g+1<groups.length?groups[g+1].start:totalSeconds;
          const room=Math.max(grp.end-grp.start,nextStart-grp.start);
          let tempo=1;
          if(dur>room&&room>0)tempo=Math.min(dur/room,1.25);
          const placed=dur/tempo;
          const overflow=placed>room+0.05;
          groupFiles.push(gWav);
          const fadeOutStart=Math.max(0,placed-0.06);
          filters.push(`[${g+1}:a]${tempo!==1?`atempo=${tempo.toFixed(3)},`:''}afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.06,adelay=${Math.round(grp.start*1000)}:all=1[a${g}]`);
          for(const i of grp.indexes)segReports[i]={index:i+1,start:segments[i].start,end:segments[i].end,sourceText:segments[i].text||'',text:texts[i],group:g+1,groupSize:grp.indexes.length,voiceSeconds:Number(dur.toFixed(3)),tempo:Number(tempo.toFixed(3)),overflow};
        }
        const bedIndex=groupFiles.length+1;
        const mixFilter=filters.join(';')+`;[${bedIndex}:a]lowpass=f=500,volume=0.012[bed];[0:a]`+groupFiles.map((_,g)=>`[a${g}]`).join('')+`[bed]amix=inputs=${groupFiles.length+2}:duration=first:normalize=0[track]`;
        const out=path.join(dir,outName);
        await mediaUtils.run('ffmpeg',['-v','error','-y','-f','lavfi','-t',totalSeconds.toFixed(3),'-i','anullsrc=r=44100:cl=stereo',...groupFiles.flatMap(f=>['-i',f]),'-f','lavfi','-t',totalSeconds.toFixed(3),'-i','anoisesrc=color=pink:r=44100:a=0.5','-filter_complex',mixFilter,'-map','[track]','-ac','2','-ar','44100',out],{timeoutMs:600000});
        return {file:out,segReports,groupCount:groups.length};
      }
      handlers.set('media.dub',async({jobId,source,captionsSource,sourceLanguage='vi',targetLanguage,translationSource='provider',translatedTexts,ttsProvider='local',voice,musicSource,musicVolume,hardsubCover='off',hardsubRegionPct=13})=>{
        const ctx=taskContext.get(jobId);
        const dir=path.join(mediaWorkspace,'.dub-jobs',jobId);
        fs.mkdirSync(dir,{recursive:true,mode:0o700});
        const srcFile=checkFile(mediaWorkspace,source);
        const real=readRealMediaInfo(srcFile);
        let segments=null,segmentOrigin=null;
        if(captionsSource){
          segments=mediaSubtitles.parseSrt(fs.readFileSync(checkFile(mediaWorkspace,captionsSource),'utf8'));
          segmentOrigin='provided-srt';
        }else{
          if(!whisperStatus(env).ready)throw err('BLOCKED_STT','Chưa có phụ đề nguồn và Whisper local chưa sẵn sàng. Nạp file SRT nguồn hoặc cài whisper.cpp + model.');
          const audioWav=path.join(dir,'source-audio.wav');
          await mediaUtils.run('ffmpeg',['-v','error','-y','-i',srcFile,'-vn','-ac','1','-ar','16000',audioWav],{timeoutMs:300000});
          const tr=await transcribeLocal({audio:audioWav,outputRoot:path.join(dir,'whisper'),language:sourceLanguage,env});
          segments=tr.segments;segmentOrigin='whisper-local';
        }
        if(!Array.isArray(segments)||segments.length<1||segments.length>200)throw err('MEDIA_INPUT','Phụ đề nguồn cần 1-200 đoạn.');
        segments=segments.filter(s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start&&typeof s.text==='string'&&s.text.trim());
        if(!segments.length)throw err('MEDIA_INPUT','Không có đoạn thoại hợp lệ trong phụ đề nguồn.');
        let texts=null,translationMeta=null;
        if(translationSource==='supplied'){
          if(!Array.isArray(translatedTexts)||translatedTexts.length!==segments.length)throw err('MEDIA_INPUT',`Bản dịch nạp sẵn phải có đúng ${segments.length} đoạn khớp phụ đề nguồn.`);
          texts=translatedTexts.map(t=>String(t||'').trim());
          if(texts.some(t=>!t||t.length>1000))throw err('MEDIA_INPUT','Bản dịch có đoạn rỗng hoặc quá 1.000 ký tự.');
          translationMeta={origin:'supplied-with-task',provider:null,model:null};
        }else{
          if(!ctx?.projectId)throw err('MEDIA_CONTEXT','Không có dự án để lấy model dịch.');
          const tr=await translateSegmentsWithModel(ctx.projectId,segments,targetLanguage);
          texts=tr.texts;translationMeta={origin:'project-worker-model',provider:tr.provider,model:tr.model};
        }
        const provider=ttsChoice(ttsProvider==='heygen'?'heygen':'local');
        if(provider.provider==='piper-local'){
          const voiceName=piperStatus(env).voice||'';
          const voiceLang=(voiceName.split(/[_-]/)[0]||'').toLowerCase();
          const targetBase=String(targetLanguage).toLowerCase().split('-')[0];
          if(voiceLang&&voiceLang!==targetBase)throw err('BLOCKED_DUB_VOICE',`Giọng Piper đang cài là ${voiceName} (ngôn ngữ ${voiceLang}), không khớp ngôn ngữ đích ${targetLanguage}. Cài model giọng cho ${targetLanguage} hoặc chọn HeyGen.`);
        }
        const dubAsm=await assembleSpeechTrack({dir,segments,texts,provider,voice,language:targetLanguage,totalSeconds:real.seconds,outName:'dub-track.wav'});
        const segReports=dubAsm.segReports;
        const dubWav=dubAsm.file;
        const translatedSrt=path.join(dir,'captions-target.srt');
        fs.writeFileSync(translatedSrt,mediaSubtitles.srt(segments.map((s,i)=>({start:s.start,end:s.end,text:texts[i]}))));
        const rendered=await buildVoiceover({workspace:mediaWorkspace,jobDir:path.join(dir,'mix'),videoSource:source,audioSource:path.relative(mediaWorkspace,dubWav),captionsSource:path.relative(mediaWorkspace,translatedSrt),musicSource:musicSource||null,musicVolume:musicVolume??.12,alignment:'hold',hardsubCover:{mode:hardsubCover,regionPct:hardsubRegionPct}});
        await artifactPort.putFile({jobId,source:rendered.file,name:'video-with-dubbed-voice.mp4'});
        await artifactPort.putFile({jobId,source:translatedSrt,name:`captions-${targetLanguage}.srt`});
        const report={sourceLanguage,targetLanguage,segmentOrigin,translation:translationMeta,voiceProvider:provider.provider,hardsubCover:rendered.hardsubCover,speechGroups:dubAsm.groupCount,segments:segReports,overflowCount:segReports.filter(s=>s.overflow).length,qa:rendered.qa,videoSeconds:rendered.videoSeconds,audioSeconds:rendered.audioSeconds};
        await artifactPort.putJson({jobId,name:'dub-report.json',data:report});
        return report;
      });
      // Re-theme an existing video: the footage stays untouched; the old
      // voice and topic are replaced wholesale. Timing windows come from a
      // supplied SRT, local Whisper on the original speech, or — when the
      // video has no detectable speech — an even deterministic split of the
      // real duration. The new script is written by the verified project
      // model against a topic, or supplied with the task (array, or free
      // text split deterministically across the windows). The original
      // audio track is fully replaced and new subtitles are burned.
      handlers.set('media.retheme',async({jobId,source,captionsSource,sourceLanguage='vi',targetLanguage='vi',scriptSource='model',topic='',notes='',scriptText='',scriptTexts,ttsProvider='local',voice,musicSource,musicVolume,hardsubCover='off',hardsubRegionPct=13})=>{
        const ctx=taskContext.get(jobId);
        const dir=path.join(mediaWorkspace,'.retheme-jobs',jobId);
        fs.mkdirSync(dir,{recursive:true,mode:0o700});
        const srcFile=checkFile(mediaWorkspace,source);
        const real=readRealMediaInfo(srcFile);
        let segments=null,segmentOrigin=null;
        const validSeg=s=>Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.end>s.start;
        if(captionsSource){
          segments=mediaSubtitles.parseSrt(fs.readFileSync(checkFile(mediaWorkspace,captionsSource),'utf8')).filter(validSeg);
          segmentOrigin='provided-srt';
          if(!segments.length)throw err('MEDIA_INPUT','File SRT nguồn không có đoạn hợp lệ.');
        }else if(whisperStatus(env).ready){
          const audioWav=path.join(dir,'source-audio.wav');
          await mediaUtils.run('ffmpeg',['-v','error','-y','-i',srcFile,'-vn','-ac','1','-ar','16000',audioWav],{timeoutMs:300000});
          const tr=await transcribeLocal({audio:audioWav,outputRoot:path.join(dir,'whisper'),language:sourceLanguage,env});
          segments=(tr.segments||[]).filter(s=>validSeg(s)&&typeof s.text==='string'&&s.text.trim());
          segmentOrigin=segments.length?'whisper-local':'even-windows';
        }else{
          segments=[];segmentOrigin='even-windows';
        }
        if(!segments.length){
          const count=Math.max(1,Math.min(60,Math.ceil(real.seconds/8)));
          const step=real.seconds/count;
          segments=Array.from({length:count},(_,i)=>({start:Number((i*step).toFixed(3)),end:Number(((i+1)*step).toFixed(3)),text:''}));
          segmentOrigin='even-windows';
        }
        if(segments.length>200)throw err('MEDIA_INPUT','Video có quá nhiều đoạn thoại (>200).');
        let texts=null,scriptMeta=null;
        if(scriptSource==='supplied'){
          if(Array.isArray(scriptTexts)){
            if(scriptTexts.length!==segments.length)throw err('MEDIA_INPUT',`Kịch bản nạp sẵn phải có đúng ${segments.length} đoạn khớp số cửa sổ thời gian.`);
            texts=scriptTexts.map(t=>String(t||'').trim());
          }else if(String(scriptText||'').trim()){
            texts=splitScriptAcrossWindows(scriptText,segments);
          }else throw err('MEDIA_INPUT','Chưa có kịch bản: chọn AI viết theo chủ đề hoặc dán kịch bản của bạn.');
          if(texts.some(t=>!t||t.length>1000))throw err('MEDIA_INPUT','Kịch bản có đoạn rỗng hoặc quá 1.000 ký tự — có thể do kịch bản quá ngắn so với số cửa sổ. Viết dài thêm hoặc gộp ý.');
          scriptMeta={origin:'supplied-with-task',provider:null,model:null};
        }else{
          if(!String(topic||'').trim())throw err('MEDIA_INPUT','Nhập chủ đề mới cho video, hoặc chọn chế độ tự dán kịch bản.');
          if(!ctx?.projectId)throw err('MEDIA_CONTEXT','Không có dự án để lấy model viết kịch bản.');
          const wr=await writeRethemeScriptWithModel(ctx.projectId,segments,{topic,notes,language:targetLanguage});
          texts=wr.texts;scriptMeta={origin:'project-worker-model',provider:wr.provider,model:wr.model};
        }
        const provider=ttsChoice(ttsProvider==='heygen'?'heygen':'local');
        if(provider.provider==='piper-local'){
          const voiceName=piperStatus(env).voice||'';
          const voiceLang=(voiceName.split(/[_-]/)[0]||'').toLowerCase();
          const targetBase=String(targetLanguage).toLowerCase().split('-')[0];
          if(voiceLang&&voiceLang!==targetBase)throw err('BLOCKED_RETHEME_VOICE',`Giọng Piper đang cài là ${voiceName} (ngôn ngữ ${voiceLang}), không khớp ngôn ngữ giọng mới ${targetLanguage}. Cài model giọng cho ${targetLanguage} hoặc chọn HeyGen.`);
        }
        const rtAsm=await assembleSpeechTrack({dir,segments,texts,provider,voice,language:targetLanguage,totalSeconds:real.seconds,outName:'new-voice-track.wav'});
        const segReports=rtAsm.segReports;
        const voiceWav=rtAsm.file;
        const newSrt=path.join(dir,'captions-new.srt');
        fs.writeFileSync(newSrt,mediaSubtitles.srt(segments.map((s,i)=>({start:s.start,end:s.end,text:texts[i]}))));
        const rendered=await buildVoiceover({workspace:mediaWorkspace,jobDir:path.join(dir,'mix'),videoSource:source,audioSource:path.relative(mediaWorkspace,voiceWav),captionsSource:path.relative(mediaWorkspace,newSrt),musicSource:musicSource||null,musicVolume:musicVolume??.12,alignment:'hold',hardsubCover:{mode:hardsubCover,regionPct:hardsubRegionPct}});
        await artifactPort.putFile({jobId,source:rendered.file,name:'video-with-new-voice.mp4'});
        await artifactPort.putFile({jobId,source:newSrt,name:`captions-${targetLanguage}.srt`});
        const report={topic:String(topic||''),targetLanguage,segmentOrigin,script:scriptMeta,voiceProvider:provider.provider,hardsubCover:rendered.hardsubCover,speechGroups:rtAsm.groupCount,segments:segReports,overflowCount:segReports.filter(s=>s.overflow).length,qa:rendered.qa,videoSeconds:rendered.videoSeconds,audioSeconds:rendered.audioSeconds};
        await artifactPort.putJson({jobId,name:'retheme-report.json',data:report});
        return report;
      });
      // One-click script to a full narrated MP4, via an explicitly configured real TTS provider.
      // No provider credentials are exposed to the browser or stored in job parameters.
      handlers.set('media.tts-video',async({jobId,source,text,voice,ttsProvider='auto',captionsSource,musicSource,musicVolume,alignment,rate=1})=>{
        const provider=ttsChoice(ttsProvider);
        const dir=path.join(mediaWorkspace,'.tts-jobs',jobId);
        fs.mkdirSync(dir,{recursive:true,mode:0o700});
        const wav=path.join(dir,'generated-voice.wav');
        const synth=await provider.synthesize({text,voice,rate,language:'vi',output:wav});
        let captions=captionsSource||null,captionMethod='provided-SRT';
        if(!captions){
          const probes=require('../../integrations/media-engine/src/utils.cjs');
          const audioInfo=await probes.ffprobe(wav,'ffprobe');
          const generated=writeWordCaptions(path.join(dir,'provider-captions.srt'),synth.wordTimestamps,{audioSeconds:probes.duration(audioInfo)});
          if(generated){captions=generated.file;captionMethod=generated.method;}
          else captionMethod='not-available-provider-did-not-return-word-timestamps';
        }
        const rendered=await buildVoiceover({workspace:mediaWorkspace,jobDir:dir,videoSource:source,audioSource:wav,captionsSource:captions,musicSource,musicVolume,alignment});
        await artifactPort.putFile({jobId,source:wav,name:'generated-natural-voice.wav'});
        await artifactPort.putFile({jobId,source:rendered.file,name:'video-with-ai-narration.mp4'});
        if(rendered.captionPath)await artifactPort.putFile({jobId,source:rendered.captionPath,name:'captions.srt'});
        const report={provider:synth.provider,voice:synth.voice,ttsRequestId:synth.providerRequestId,source:synth.provider==='piper-local'?'offline-licensed-model':'approved-external-api',captions:captionMethod,qa:rendered.qa,alignment:rendered.alignment,videoSeconds:rendered.videoSeconds,audioSeconds:rendered.audioSeconds,musicMixed:rendered.musicMixed,musicVolume:rendered.musicVolume};
        await artifactPort.putJson({jobId,name:'tts-video-report.json',data:report});
        return {file:rendered.file,report};
      });
      // A useful fully local Story Studio deliverable. It is explicitly a text
      // storyboard only; it never presents an AI-generated narrated video.
      handlers.set('media.story-outline',async({jobId,text,rights='unspecified',maxChars=420})=>{
        if(typeof text!=='string'||!text.trim()||text.length>30000)throw err('STORY_INPUT','Truyện cần 1-30.000 ký tự.');
        const ch=storyLogic.chapters(text),segments=[],characters=storyLogic.characters(text);
        for(const item of ch){for(const sceneText of storyLogic.scenes(item.text,Math.max(180,Math.min(1000,Number(maxChars)||420))))
          segments.push({index:segments.length+1,chapter:item.number,sourceText:sceneText,visualPrompt:`Minh họa cảnh ${segments.length+1}: ${sceneText.slice(0,360)}`});}
        if(segments.length>200)throw err('STORY_LIMIT','Quá 200 phân cảnh; hãy chia truyện thành nhiều phần.');
        const storyboard={kind:'story-outline',origin:'deterministic-local-not-ai',rights,chapterCount:ch.length,sceneCount:segments.length,characters,scenes:segments,narration:'not-generated',video:'not-rendered',generatedAt:new Date().toISOString()};
        await artifactPort.putJson({jobId,name:'storyboard.json',data:storyboard});
        return {storyboard};
      });
      // Platform publishing (owner directive 2026-10-17): the video must
      // already live in the media workspace; the connection comes from the
      // Vault; success exists only after the platform API confirms, and the
      // record states plainly when the endpoint was a simulated one.
      const publishHandler=(platform,upload)=>async({jobId,video,title,description='',tags,privacy})=>{
        const file=checkFile(mediaWorkspace,video);
        const connection=findConnectionByKind(platform);
        if(!connection)throw err('BLOCKED_PUBLISH_AUTH',`Chưa liên kết tài khoản ${platform} hoặc Vault đang khóa. Vào tab Kết nối để liên kết.`);
        const ctx=taskContext.get(jobId);
        const res=await upload({connection,file,title,description,tags,privacyStatus:privacy,privacyLevel:privacy});
        const record=publishRecords.append({...res,projectId:ctx?.projectId||null,taskId:jobId,publishedAt:new Date().toISOString(),endpointHost:(()=>{try{return new URL(platformBase(platform,connection)).hostname;}catch{return null;}})(),simulated:isSimulatedEndpoint(platform,connection),metrics:null,metricsUpdatedAt:null});
        await artifactPort.putJson({jobId,name:`publish-record-${platform}.json`,data:record});
        return {platform,platformVideoId:res.platformVideoId,url:res.url,simulated:record.simulated};
      };
      handlers.set('media.publish-youtube',publishHandler('youtube',({connection,file,title,description,tags,privacyStatus})=>youtubeUpload({connection,file,title,description,tags,privacyStatus:privacyStatus||'unlisted'})));
      handlers.set('media.publish-facebook',publishHandler('facebook',({connection,file,title,description})=>facebookUpload({connection,file,title,description})));
      handlers.set('media.publish-tiktok',publishHandler('tiktok',({connection,file,title,privacyLevel})=>tiktokUpload({connection,file,title,privacyLevel:privacyLevel||'PUBLIC_TO_EVERYONE'})));
      for(const [kind,allowed] of Object.entries({video_edit:['media.analyze','media.subtitle-edit','media.edit-plan','media.quick-edit','media.render','media.voiceover','media.tts-video','media.image','media.concat-effects','media.dub','media.retheme'],story:['media.story','media.story-outline'],publish:['media.publish-draft','media.publish-youtube','media.publish-facebook','media.publish-tiktok']})){
        core.queue.registerModule(kind,async({task,workspace})=>{
          const op=task.input?.operation;
          if(!allowed.includes(op))throw err('MEDIA_OPERATION','Loại tác vụ và công việc media không khớp hoặc chưa được phê duyệt.');
          const handler=handlers.get(op);if(!handler)throw err('MODULE_REQUIRED','Media handler chưa được đăng ký.');
          // Recheck after queue scheduling too: the customer file may change
          // between pressing Approve and the worker's actual start.
          if(task.input?.params?.sourceSha256AtSubmit){
            const inputFile=checkFile(mediaWorkspace,task.input.params.source);
            if(shaFileSync(inputFile)!==task.input.params.sourceSha256AtSubmit)
              throw err('MEDIA_PLAN_SOURCE','Video nguồn đã thay đổi sau khi lập tác vụ. Hãy dựng lại từ video gốc.');
          }
          const jobId=task.id.replace(/-/g,'_');
          const ctx={projectId:task.projectId,taskId:task.id,ids:[],externalIds:[]};taskContext.set(jobId,ctx);
          try{
            const result=await handler({jobId,...task.input.params});
            if(ctx.ids.length===0)throw err('MEDIA_EMPTY','Engine không trả về artifact có hash.');
            for(const id of ctx.ids)core.artifacts.read(id); // independently checks all stored digests
            for(const id of ctx.externalIds)verifiedExternal(id); // check SHA after engine work, before marking done
            const proof=path.join(workspace,'media-proof.json');
            fs.writeFileSync(proof,JSON.stringify({taskId:task.id,operation:op,artifactIds:ctx.ids,externalIds:ctx.externalIds,verifiedAt:new Date().toISOString(),engineQuality:result.qa?.passed??null},null,2),{flag:'wx',mode:0o600});
            return {artifacts:ctx.ids};
          }finally{taskContext.delete(jobId);}
        },{approved:true}); // approved module registration != individual task approval
      }
      if(clock){timer=setInterval(()=>core?.queue.tick().catch(()=>{}),500);timer.unref?.();}
    }catch(e){problem=`Khởi động tích hợp thất bại: ${e.code||e.message}`;core?.close();core=null;media=null;}
  }
  start();
  function status(){
    if(Date.now()-probeAt>60000||!probeCache){probeCache={ffmpeg:binaryReady('ffmpeg'),ffprobe:binaryReady('ffprobe')};probeAt=Date.now();}
    const usage=core?.state.data.usage||null;
    return {core:{status:core?'active':problem?'error':'needs-setup',mode:mode||'offline',vaultConfigured:mode==='vault-enabled',version:core?.version||'CoreServices v1',error:problem,
      tasks:core?.state.data.tasks.length||0,budgetUsd:usage?.budgetUsd??null,spentUsd:usage?.spentUsd??null,
      modelVerified:!!usage?.verifiedModelCalls},
      media:{status:media?(probeCache.ffmpeg&&probeCache.ffprobe?'available':'dependency-missing'):'core-offline',
        version:media?.version||'0.1.0',sourceIncluded:true,ffmpeg:probeCache.ffmpeg||null,ffprobe:probeCache.ffprobe||null,
        operations:Object.keys(ALLOWED_OPERATIONS),storyTts:piperStatus(env).ready?'piper-local-ready':tts.configured()?'optional-heygen-api':'needs-local-piper-or-imported-audio',ttsProvider:piperStatus(env).ready?'piper-local':tts.configured()?'heygen':'none',ttsVoiceConfigured:piperStatus(env).ready||tts.voiceConfigured(),localTts:piperStatus(env),heygenOptionalConfigured:tts.configured(),transcription:(whisperStatus(env).ready?'whisper.cpp-local-real':'needs-approved-provider'),socialPosting:'opt-in-approval-gated',platforms:Object.fromEntries(PLATFORM_KINDS.map(k=>[k,platformConnectionStatus(k,findConnectionByKind(k))])),publishRecords:publishRecords.list().length,whisper:whisperStatus(env),concat:{configured:!!concatSettings().token,mode:'real-multitrack-editor-project-after-approval',speech:'available-in-editor-not-in-json-rpc-0.2'}},
      workspace:'dedicated-local-directory',host:'127.0.0.1',approvalRequired:true};
  }
  // Metrics sweep (M7): refresh view/like/comment counts for confirmed
  // posts straight from each platform API and store them on the record.
  async function refreshPublishMetrics({projectId}={}){
    const statsFns={youtube:youtubeStats,facebook:facebookStats,tiktok:tiktokStats};
    const out=[];
    for(const record of publishRecords.list({projectId})){
      const fn=statsFns[record.platform];
      const connection=fn?findConnectionByKind(record.platform):null;
      if(!fn||!connection){out.push({id:record.id,ok:false,error:'NO_CONNECTION'});continue;}
      try{
        const metrics=await fn({connection,videoId:record.platformVideoId});
        publishRecords.update(record.id,{metrics,metricsUpdatedAt:new Date().toISOString()});
        out.push({id:record.id,ok:true,metrics});
      }catch(e){out.push({id:record.id,ok:false,error:e.code||'METRICS_FAILED'});}
    }
    return out;
  }
  function isMediaTask(t){return Boolean(t&&Object.hasOwn(ALLOWED_OPERATIONS,t.input?.operation)&&ALLOWED_OPERATIONS[t.input.operation]===t.kind);}
  function mediaTask(id){const t=requireCore().state.find(id);if(!isMediaTask(t))throw err('MEDIA_TASK_DENIED','Tác vụ này không thuộc Media Studio.');return t;}
  function listTasks(projectId){requireCore();if(projectId&&!safeId(projectId))throw err('PROJECT_ID','Mã dự án không hợp lệ.');return core.state.data.tasks.filter(t=>isMediaTask(t)&&(!projectId||t.projectId===projectId)).map(t=>structuredClone(t));}
  function submit({projectId,operation,params={}}){requireCore();if(!safeId(projectId))throw err('PROJECT_ID','Mã dự án không hợp lệ.');if(!Object.hasOwn(ALLOWED_OPERATIONS,operation))throw err('MEDIA_OPERATION','Tác vụ media chưa hỗ trợ hoặc đang bị khóa.');
    if(!params||typeof params!=='object'||Array.isArray(params)||JSON.stringify(params).length>100000)throw err('MEDIA_INPUT','Dữ liệu không hợp lệ hoặc quá lớn.');
    if(params.sourceLabel!==undefined&&(typeof params.sourceLabel!=='string'||params.sourceLabel.length>160))throw err('MEDIA_INPUT','Tên video hiển thị không hợp lệ.');
    // Empty subtitles mean no subtitles. The engine's subtitle formatter rightly
    // rejects [] if passed explicitly; normalize at the host boundary.
    if(operation==='media.render'&&Array.isArray(params.subtitleSegments)&&params.subtitleSegments.length===0)
      params={...params,subtitleSegments:null};
    // Seal every source-bearing task, not only JSON timeline renders.
    // Never trust a client-provided fingerprint; overwrite it at the boundary.
    if(typeof params.source==='string'&&params.source){
      const actualSource=checkFile(mediaWorkspace,params.source);
      params={...params,sourceSha256AtSubmit:shaFileSync(actualSource)};
    }
    if(operation==='media.render'){
      if(params.autoCaptions||params.concatProject||params.narrationText||params.narrationAudio||params.musicSource||params.captionsSource)
        throw err('MEDIA_WORKFLOW','Luồng Xuất MP4 từ JSON không chạy Concat/Whisper/giọng/nhạc ở Kế hoạch dựng. Dùng Dựng MP4 theo mô tả thay thế.');
      if(!params.source||!params.editPlan||!Array.isArray(params.editPlan.segments))
        throw err('MEDIA_INPUT','Chọn video nguồn và timeline hợp lệ trước khi dựng.');
      verifiedPlan(params,checkFile(mediaWorkspace,params.source));
    }

    if(typeof params.music==='string'&&params.music){checkFile(mediaWorkspace,params.music);}
    if(typeof params.video==='string'&&params.video){checkFile(mediaWorkspace,params.video);}
    if(typeof params.audioSource==='string'&&params.audioSource){checkFile(mediaWorkspace,params.audioSource);}
    if(typeof params.captionsSource==='string'&&params.captionsSource){checkFile(mediaWorkspace,params.captionsSource);}
    if(typeof params.musicSource==='string'&&params.musicSource){checkFile(mediaWorkspace,params.musicSource);}
    if(typeof params.narrationAudio==='string'&&params.narrationAudio){checkFile(mediaWorkspace,params.narrationAudio);}
    if(typeof params.captionsSource==='string'&&params.captionsSource){checkFile(mediaWorkspace,params.captionsSource);}
    if(operation==='media.quick-edit'){
      if(!params.source||typeof params.prompt!=='string'||!params.prompt.trim()||params.prompt.length>4000)throw err('MEDIA_INPUT','Chọn video và mô tả yêu cầu tối đa 4.000 ký tự trước khi dựng nhanh.');
      for(const flag of ['autoCaptions','concatProject'])if(params[flag]!==undefined&&typeof params[flag]!=='boolean')throw err('MEDIA_INPUT','Tùy chọn dựng video phải là bật hoặc tắt.');
      if(params.autoCaptions&&!whisperStatus(env).ready)throw err('BLOCKED_STT','Phụ đề Whisper cần model và whisper-cli local; chưa cài thì tắt tùy chọn này.');
      if(params.narrationText&&params.narrationAudio)throw err('MEDIA_INPUT','Chỉ chọn một nguồn giọng: lời đọc AI hoặc file âm thanh đã tải.');
      if(params.concatTitle!==undefined&& (typeof params.concatTitle!=='string'||params.concatTitle.length>95))throw err('MEDIA_INPUT','Tiêu đề Concat tối đa 95 ký tự.');
      if(params.musicSource&&!params.concatProject&&!params.narrationText&&!params.narrationAudio)throw err('MEDIA_INPUT','Để dùng nhạc nền trong dựng nhanh, hãy bật tạo project Concat.');
      if(params.autoCaptions&&params.narrationAudio)throw err('BLOCKED_STT','Phụ đề cần nhận dạng trên giọng sau khi thay, không phải tiếng video cũ. Nạp SRT đã đồng bộ hoặc tắt Whisper.');
      if(params.narrationText!==undefined){
        if(typeof params.narrationText!=='string'||params.narrationText.trim().length===0||params.narrationText.length>5000)throw err('MEDIA_INPUT','Lời đọc cần từ 1 đến 5000 ký tự.');
        ttsChoice(params.narrationProvider||'auto');
        if(params.autoCaptions)throw err('BLOCKED_STT','Khi thay giọng, hãy tạo phụ đề từ giọng sau khi dựng. Tắt Whisper của video nguồn để tránh lệch mốc thời gian.');
      }
      if(params.concatProject&&!concatSettings().token)throw err('BLOCKED_CONCAT','Chưa kết nối Concat. Vào Video Studio, bật Remote trong Concat và lưu token.');
    }
    if(operation==='media.image'){
      if(!Array.isArray(params.scenes)||params.scenes.length<1||params.scenes.length>24)throw err('MEDIA_INPUT','Cần 1-24 cảnh, mỗi cảnh một mô tả ảnh.');
      for(const s of params.scenes){
        if(!s||typeof s.prompt!=='string'||!s.prompt.trim()||s.prompt.length>2000)throw err('MEDIA_INPUT','Mỗi cảnh cần mô tả ảnh 1-2.000 ký tự.');
        if(s.name!==undefined&&(typeof s.name!=='string'||s.name.length>80))throw err('MEDIA_INPUT','Tên cảnh tối đa 80 ký tự.');
      }
      if(params.imageProvider!==undefined&&!IMAGE_PROVIDERS.includes(params.imageProvider))throw err('MEDIA_INPUT','Nguồn sinh ảnh không hợp lệ.');
      if(params.size!==undefined&&!['1024x1024','1536x1024','1024x1536'].includes(params.size))throw err('MEDIA_INPUT','Kích thước ảnh không được hỗ trợ.');
    }
    if(operation==='media.concat-effects'){
      if(!params.source)throw err('MEDIA_INPUT','Chọn video đã dựng để thêm hiệu ứng Concat.');
      if(params.planSource!==undefined&&!['reviewer','manual'].includes(params.planSource))throw err('MEDIA_INPUT','Nguồn kế hoạch hiệu ứng không hợp lệ.');
      if(params.planSource==='manual'){const p=params.plan;if(!p||p.kind!=='edit'||!Array.isArray(p.segments)||!p.segments.length)throw err('MEDIA_INPUT','Kế hoạch thủ công cần kind=edit và ít nhất một đoạn.');}
      if(params.prompt!==undefined&&(typeof params.prompt!=='string'||params.prompt.length>4000))throw err('MEDIA_INPUT','Mô tả hiệu ứng tối đa 4.000 ký tự.');
      if(params.title!==undefined&&(typeof params.title!=='string'||params.title.length>95))throw err('MEDIA_INPUT','Tiêu đề Concat tối đa 95 ký tự.');
      if(!concatSettings().token)throw err('BLOCKED_CONCAT','Chưa kết nối Concat. Vào Video Studio, bật Remote trong Concat và lưu token.');
    }
    if(operation==='media.dub'){
      if(!params.source)throw err('MEDIA_INPUT','Chọn video nguồn để lồng tiếng.');
      const langOk=v=>typeof v==='string'&&/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(v);
      if(!langOk(params.targetLanguage))throw err('MEDIA_INPUT','Cần ngôn ngữ đích hợp lệ, ví dụ en, vi, ja, ko.');
      if(params.sourceLanguage!==undefined&&!langOk(params.sourceLanguage))throw err('MEDIA_INPUT','Ngôn ngữ nguồn không hợp lệ.');
      if(params.sourceLanguage&&params.sourceLanguage.split('-')[0]===params.targetLanguage.split('-')[0])throw err('MEDIA_INPUT','Ngôn ngữ đích phải khác ngôn ngữ nguồn.');
      if(params.translationSource!==undefined&&!['provider','supplied'].includes(params.translationSource))throw err('MEDIA_INPUT','Nguồn bản dịch không hợp lệ.');
      if(params.translationSource==='supplied'){
        if(!Array.isArray(params.translatedTexts)||params.translatedTexts.length<1||params.translatedTexts.length>200)throw err('MEDIA_INPUT','Bản dịch nạp sẵn cần 1-200 đoạn.');
        for(const t of params.translatedTexts)if(typeof t!=='string'||!t.trim()||t.length>1000)throw err('MEDIA_INPUT','Mỗi đoạn dịch cần 1-1.000 ký tự.');
      }
      if(params.ttsProvider!==undefined&&!['local','heygen'].includes(params.ttsProvider))throw err('MEDIA_INPUT','Nhà cung cấp giọng lồng tiếng không hợp lệ.');
    }
    if(operation==='media.voiceover'&&(!params.source||!params.audioSource))throw err('MEDIA_INPUT','Cần một video nguồn và một file âm thanh WAV/MP3/M4A.');
    if(['media.dub','media.retheme','media.voiceover'].includes(operation)){
      if(params.hardsubCover!==undefined&&!['off','blur','band'].includes(params.hardsubCover))throw err('MEDIA_INPUT','Chế độ che phụ đề cứng phải là off, blur hoặc band.');
      if(params.hardsubRegionPct!==undefined&&(!Number.isInteger(params.hardsubRegionPct)||params.hardsubRegionPct<10||params.hardsubRegionPct>40))throw err('MEDIA_INPUT','Vùng che phụ đề cứng phải là số nguyên 10–40 (% chiều cao).');
    }
    if(operation==='media.tts-video'){
      ttsChoice(params.ttsProvider||'auto');
      if(!params.source||typeof params.text!=='string'||!params.text.trim()||params.text.length>5000)throw err('MEDIA_INPUT','Cần video nguồn và lời thoại 1-5.000 ký tự.');
    }
    if(['media.voiceover','media.tts-video'].includes(operation)){
      if(params.alignment!==undefined&&!['hold','stretch'].includes(params.alignment))throw err('MEDIA_INPUT','Cách đồng bộ âm thanh/video chưa hợp lệ.');
      if(params.musicVolume!==undefined&&!(Number.isFinite(Number(params.musicVolume))&&Number(params.musicVolume)>=0&&Number(params.musicVolume)<=.4))throw err('MEDIA_INPUT','Nhạc nền chỉ hỗ trợ 0-40%.');
    }
    if(['media.story','media.story-outline'].includes(operation)&&!(typeof params.text==='string'&&params.text.trim())&&!params.source)throw err('MEDIA_INPUT','Cần văn bản hoặc nguồn truyện.');
    if(operation==='media.story-outline'&&(!params.text||params.text.length>30000))throw err('STORY_INPUT','Story outline cần văn bản tối đa 30.000 ký tự.');
    if(['media.publish-youtube','media.publish-facebook','media.publish-tiktok'].includes(operation)){
      if(!(typeof params.video==='string'&&params.video.trim()))throw err('MEDIA_INPUT','Cần video trong Media Studio để đăng.');
      if(!(typeof params.title==='string'&&params.title.trim()&&params.title.length<=500))throw err('MEDIA_INPUT','Tiêu đề đăng cần 1-500 ký tự.');
      if(params.description!==undefined&&(typeof params.description!=='string'||params.description.length>5000))throw err('MEDIA_INPUT','Mô tả đăng tối đa 5.000 ký tự.');
      if(operation==='media.publish-youtube'&&params.privacy!==undefined&&!['public','unlisted','private'].includes(params.privacy))throw err('MEDIA_INPUT','Chế độ hiển thị YouTube không hợp lệ.');
      if(operation==='media.publish-tiktok'&&params.privacy!==undefined&&!['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','SELF_ONLY','FOLLOWER_OF_CREATOR'].includes(params.privacy))throw err('MEDIA_INPUT','Chế độ hiển thị TikTok không hợp lệ.');
    }
    if(operation==='media.publish-draft'&&!(typeof params.video==='string'&&params.video.trim()))throw err('MEDIA_INPUT','Thiếu video đã có bản quyền.');
    const task=core.queue.add({projectId,kind:ALLOWED_OPERATIONS[operation],input:{operation,params,approved:false,allowedTools:[],checks:[{type:'exists',path:'media-proof.json'}]}});
    // Core runs every queued task on its next tick. Keep all new media jobs
    // paused until a specific approval is recorded; never rely on UI timing.
    core.queue.pause(task.id);
    return structuredClone(core.state.find(task.id));
  }
  function action(id,verb){requireCore();if(!/^[a-f0-9-]{36}$/.test(id))throw err('TASK_ID','Mã tác vụ không hợp lệ.');
    const t=mediaTask(id); // A media route must never approve, pause or cancel a non-media Core job.
    if(verb==='approve'){
      // Validate current bytes and actual stream metadata BEFORE approving.
      const params=t.input?.params||{};
      if(params.sourceSha256AtSubmit){
        const file=checkFile(mediaWorkspace,params.source);
        if(shaFileSync(file)!==params.sourceSha256AtSubmit)
          throw err('MEDIA_PLAN_SOURCE','Video đã thay đổi từ lúc lập tác vụ. Hãy dựng lại từ video gốc.');
        if(t.input.operation==='media.render')verifiedPlan(params,file);
      }
      const approved=core.queue.approve(id,[]);
      return approved.state==='paused'?core.queue.resume(id):approved;
    }
    if(['resume','retry'].includes(verb)&&t.input?.approved!==true)throw err('APPROVAL_REQUIRED','Chưa phê duyệt Media Studio task.');
    if(['pause','resume','cancel','retry'].includes(verb))return core.queue[verb](id);
    throw err('TASK_ACTION','Hành động không hợp lệ.');
  }
  function listArtifacts(projectId){requireCore();if(!safeId(projectId))throw err('PROJECT_ID','Mã dự án không hợp lệ.');return [
    ...core.artifacts.list(projectId).filter(a=>isMediaTask(core.state.find(a.taskId))),
    ...externalArtifacts.items.filter(a=>a.projectId===projectId&&isMediaTask(core.state.find(a.taskId))).map(({sourceRelative,...a})=>({...a}))
  ];}
  function artifact(id){requireCore();if(!/^[a-f0-9-]{36}$/.test(id))throw err('ARTIFACT_ID','Mã artifact không hợp lệ.');
    if(externalArtifacts.items.some(x=>x.id===id))return verifiedExternal(id);
    const metadata=core.artifacts.get(id);mediaTask(metadata.taskId);return {metadata,bytes:core.artifacts.read(id)};}
  async function directorPlan(projectId,{source='',wish=''}={}){
    requireCore();if(!safeId(projectId))throw err('PROJECT_ID','Mã dự án không hợp lệ.');
    const selection=mediaPlannerStatus(projectId);
    if(!selection.available)return {available:false,fallback:true,reason:'Chưa có AI đã xác minh cho dự án này nên AI đạo diễn chưa thể hiểu ý. Hãy liên kết và xác minh một model (tab Kết nối), hoặc tự chọn cách làm bằng các nút bên dưới.'};
    const cleanWish=String(wish||'').trim().slice(0,2000);
    if(!source&&!cleanWish)return {available:false,fallback:true,reason:'Hãy nạp một video hoặc gõ ý tưởng/mong muốn của bạn vào ô AI đạo diễn.'};
    let probe=null,transcript='';
    const whisperReady=whisperStatus(env).ready;
    if(source){
      const file=checkFile(mediaWorkspace,source);
      probe=readRealMediaInfo(file);
      const hasAudio=probe.streams.some(st=>st.codec_type==='audio');
      if(hasAudio&&whisperReady){
        try{
          const dir=path.join(mediaWorkspace,'.director',crypto.randomUUID());fs.mkdirSync(dir,{recursive:true,mode:0o700});
          const audioWav=path.join(dir,'audio.wav');
          await mediaUtils.run('ffmpeg',['-v','error','-y','-i',file,'-vn','-ac','1','-ar','16000',audioWav],{timeoutMs:300000});
          const tr=await transcribeLocal({audio:audioWav,outputRoot:dir,language:'auto',env});
          transcript=tr.segments.map(sg=>sg.text).join(' ').slice(0,2800);
        }catch{transcript='';}
      }
      var hasAudioFlag=probe.streams.some(st=>st.codec_type==='audio');
      var videoStream=probe.streams.find(st=>st.codec_type==='video')||{};
    }
    const call=buildDirectorModelCall({hasSource:!!source,seconds:probe?.seconds||0,width:videoStream?.width||0,height:videoStream?.height||0,hasAudio:!!hasAudioFlag,transcript,wish:cleanWish,whisperReady});
    let reply;
    try{reply=await writeTextWithModel(projectId,{instructions:call.instructions,prompt:call.prompt,maxChars:7000});}
    catch(e){return {available:false,fallback:true,reason:'AI chưa trả lời được ('+(e.code||'lỗi')+'). Thử lại sau, hoặc tự chọn cách làm bằng các nút bên dưới.'};}
    let plan;try{plan=parseDirectorPlan(reply.text);}catch(e){return {available:false,fallback:true,reason:e.message+' Hãy thử mô tả rõ hơn, hoặc tự chọn cách làm bằng các nút bên dưới.'};}
    const routed=routeDirectorPlan(plan,{source,sourceLabel:'',whisperReady});
    return {available:true,plan,routed:{operation:routed.operation,params:routed.params||null,needsInput:routed.needsInput||null},warnings:routed.warnings||[],model:{provider:selection.target?.provider||selection.provider||'model',name:selection.target?.model||selection.model||''},probe:probe?{seconds:Math.round(probe.seconds),hasAudio:!!hasAudioFlag,transcriptHeard:!!transcript}:null};
  }
  function demoSample(){requireCore();const source=path.resolve(root,'integrations/media-engine/artifacts/samples/source.mp4');
    if(!fs.existsSync(source))throw err('DEMO_MISSING','Không có clip nguồn trong bản bàn giao.');
    const uploadDir=path.join(mediaWorkspace,'uploads');fs.mkdirSync(uploadDir,{recursive:true,mode:0o700});
    const rel=`uploads/sample-${crypto.randomUUID()}.mp4`;fs.copyFileSync(source,path.join(mediaWorkspace,rel),fs.constants.COPYFILE_EXCL);
    return {source:rel,name:'clip mau AI Media Engine',size:fs.statSync(source).size,origin:'sample-source-video'};
  }
  async function importUpload(req,name){requireCore();if(!safeFileName(name))throw err('MEDIA_FILENAME','Tên tệp không hợp lệ.');
    const ext=path.extname(name).toLowerCase();if(!UPLOAD_EXT.has(ext))throw err('MEDIA_FILETYPE','Định dạng chưa được chấp thuận.');
    const declared=Number(req.headers['content-length']||0);if(declared>MAX_UPLOAD_BYTES)throw err('MEDIA_UPLOAD_LIMIT','Giới hạn nhập media là 150MB.');
    const uploadDir=path.join(mediaWorkspace,'uploads');fs.mkdirSync(uploadDir,{recursive:true,mode:0o700});
    const rel=`uploads/${crypto.randomUUID()}${ext}`;const dest=path.join(mediaWorkspace,rel);const fd=fs.openSync(dest,'wx',0o600);
    let size=0;const digest=crypto.createHash('sha256');try{for await(const chunk of req){size+=chunk.length;if(size>MAX_UPLOAD_BYTES)throw err('MEDIA_UPLOAD_LIMIT','Vượt giới hạn 150MB.');fs.writeSync(fd,chunk);digest.update(chunk);}if(size===0)throw err('MEDIA_UPLOAD_EMPTY','Tệp tải lên rỗng.');}
    catch(e){fs.closeSync(fd);fs.rmSync(dest,{force:true});throw e;}
    fs.closeSync(fd);return {source:rel,name,size,sha256:digest.digest('hex')};
  }
  function stop(){if(timer){clearInterval(timer);timer=null;}if(core){core.close();core=null;}}
  return {status,checkConcat,plannerStatus:mediaPlannerStatus,directorPlan,listTasks,listArtifacts,submit,action,artifact,importUpload,demoSample,publishRecords,refreshPublishMetrics,listVoices:()=>tts.listVoices(),stop,get core(){return core;},mediaWorkspace};
}
