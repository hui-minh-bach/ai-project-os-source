'use strict';
const {insist,finite,path}=require('./utils.cjs');
const SOURCE_WARNING='K\u1ebf ho\u1ea1ch d\u1ef1ng kh\u00f4ng kh\u1edbp video ngu\u1ed3n. H\u00e3y d\u00f9ng video g\u1ed1c c\u1ee7a k\u1ebf ho\u1ea1ch ho\u1eb7c t\u1ea1o k\u1ebf ho\u1ea1ch m\u1edbi.';
function assertSourceBinding(plan,media){
 insist(media&&typeof media.path==='string'&&media.path.length>0,'Video source is required','MEDIA_PLAN_SOURCE');
 const current=path.resolve(media.path);
 const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
 const segments=Array.isArray(plan?.segments)?plan.segments:[];
 for(const segment of segments){
  if(typeof segment?.source==='string'&&segment.source.trim()&&
     !same(path.resolve(segment.source),current))insist(false,SOURCE_WARNING,'MEDIA_PLAN_SOURCE');
 }
 if(plan?.sourceSha256&&!media.sha256)insist(false,SOURCE_WARNING+' Không xác thực được SHA-256 của video.', 'MEDIA_PLAN_SOURCE');
 if(plan?.sourceArtifactId&&media.artifactId&&plan.sourceArtifactId!==media.artifactId)insist(false,SOURCE_WARNING,'MEDIA_PLAN_SOURCE');
 if(plan?.schemaVersion&&![1,2].includes(plan.schemaVersion))insist(false,'Unsupported media plan schema version','MEDIA_PLAN_VERSION');
 if(plan?.schemaVersion===2&&(!plan.sourceSha256||!plan.sourceArtifactId))insist(false,SOURCE_WARNING,'MEDIA_PLAN_SOURCE');
 if(plan?.sourceProbe?.streams&&Array.isArray(media.streams)){
  const f=x=>(x||[]).filter(s=>s.codec_type==='video'||s.codec_type==='audio').map(s=>[s.index??null,s.codec_type,s.codec_name,s.width??null,s.height??null,s.channels??null]);
  insist(JSON.stringify(f(plan.sourceProbe.streams))===JSON.stringify(f(media.streams)),SOURCE_WARNING,'MEDIA_PLAN_SOURCE');
 }
 if(plan?.sourceSha256&&media.sha256&&plan.sourceSha256!==media.sha256)
  insist(false,SOURCE_WARNING,'MEDIA_PLAN_SOURCE');
 if(Number.isFinite(plan?.sourceSeconds)&&Number.isFinite(media.seconds)&&
    Math.abs(plan.sourceSeconds-media.seconds)>0.08)
  insist(false,SOURCE_WARNING,'MEDIA_PLAN_SOURCE');
}

function naturalPlan(prompt,media,analysis){
 const p=String(prompt||'').toLowerCase();
 const preferShort=/ngắn|short|reel|tiktok|shorts/.test(p);
 const removeSilence=/im lặng|silence|khoảng lặng/.test(p);
 const smartScenes=/phân cảnh|phân tích cảnh|cảnh quay|cắt cảnh|cảnh đẹp|chuyển cảnh|dựng thông minh|tự động|highlight|montage|theo nhịp|mượt|scene|transition/i.test(p);
 const explicitSeconds=p.match(/(?:cắt xuống|rút gọn còn|rút ngắn còn|chỉ còn|giữ lại|trim to|cut to)\s*(\d{1,4})\s*(?:giây|giay|s|sec|seconds)?\b/i);
 const secondsValue=explicitSeconds?Number(explicitSeconds[1]):null;
 const target=secondsValue!==null?Math.max(1,Math.min(media.seconds,secondsValue)):(preferShort?Math.min(55,media.seconds):null);
 let spans=[{start:0,end:media.seconds}];
 if(removeSilence){
  const cuts=(analysis?.cutCandidates||[]).filter(x=>x.end-x.start>.65);
  let cur=0;spans=[];
  for(const cut of cuts){if(cut.start-cur>.25)spans.push({start:cur,end:Math.max(cur,cut.start+.05)});cur=Math.min(media.seconds,cut.end-.05);}
  if(media.seconds-cur>.25)spans.push({start:cur,end:media.seconds});
 }
 // Video scene boundaries are measured by FFmpeg, not invented by a text LLM.
 // Where nearby silence exists, prefer cutting in it to avoid splitting speech.
 if(smartScenes&&!removeSilence){
   const raw=(analysis?.sceneChanges||[]).filter(x=>Number.isFinite(x)&&x>1.25&&x<media.seconds-1.25).sort((a,b)=>a-b);
   const selected=[];
   const silences=Array.isArray(analysis?.silences)?analysis.silences:[];
   for(let boundary of raw){
     const closeSilence=silences.map(s=>({mid:(s.start+s.end)/2,d:Math.abs((s.start+s.end)/2-boundary)})).filter(x=>x.d<=.28).sort((a,b)=>a.d-b.d)[0];
     if(closeSilence)boundary=closeSilence.mid;
     if((!selected.length||boundary-selected.at(-1)>=1.25)&&boundary>1.25)selected.push(boundary);
   }
   const cap=selected.length>11?selected.filter((_,i)=>i%Math.ceil(selected.length/11)===0).slice(0,11):selected;
   const marks=[0,...cap,media.seconds];spans=[];
   for(let i=0;i<marks.length-1;i++)if(marks[i+1]-marks[i]>.3)spans.push({start:marks[i],end:marks[i+1]});
 }
 // Shorten AFTER scene segmentation, otherwise a requested 30-second reel
 // would silently lose every scene boundary and all smooth transitions.
 if(target!==null){let remain=target;spans=spans.flatMap(s=>{
    const d=Math.min(Math.max(0,remain),s.end-s.start);remain-=d;
    return d>.15?[{start:s.start,end:s.start+d}]:[];
  });}
 if(!spans.length)spans=[{start:0,end:Math.min(1,media.seconds)}];
 const ratio=p.includes('9:16')||/dọc|vertical/.test(p)?'9:16':p.includes('1:1')?'1:1':'16:9';
 const effects=/hiệu ứng|hieu ung|fade|mờ dần|mo dan|effect/.test(p)?['fade-in-out']:[];
 const enableCrossfade=smartScenes&&spans.length>1;
 return {version:1,kind:'edit',origin:'deterministic-rule-not-ai',ratio,framing:ratio==='9:16'?'crop':'fit',effects,
  transition:enableCrossfade?'crossfade':'cut',transitionSeconds:.35,
  segments:spans.map((s,i)=>({id:`clip-${i+1}`,source:media.path,...s})),notes:['Kế hoạch quy tắc local; chưa phân tích hình ảnh bằng AI',...(effects.length?['Hiệu ứng mờ dần đầu/cuối hình; không tự tạo cảnh mới.']:[]),
  ...(smartScenes?['Điểm chuyển cảnh do FFmpeg dò thay đổi hình ảnh, có ưu tiên khoảng lặng gần điểm cắt; đây KHÔNG phải AI xem hiểu nội dung cảnh.']:[]) ]};
}

async function plan({gateway,prompt,media,analysis,audioStreamIndex=null}){
 if(gateway?.invoke){try{const r=await gateway.invoke({capability:'video.edit-plan',input:{prompt,media:{seconds:media.seconds,streams:media.streams},analysis}});
  if(r?.segments?.length)return validate({...r,audioStreamIndex,origin:'provider-ai'},media);
 }catch(e){if(e.code!=='BLOCKED_PROVIDER')throw e;}
 }
 return validate({...naturalPlan(prompt,media,analysis),audioStreamIndex},media);
}
function validate(plan,media){insist(plan?.kind==='edit'&&Array.isArray(plan.segments)&&plan.segments.length>0,'Invalid edit plan');assertSourceBinding(plan,media);const dimensions={'16:9':[1280,720],'9:16':[720,1280],'1:1':[720,720]};insist(dimensions[plan.ratio],'Invalid aspect ratio');insist(plan.segments.length<=100,'Too many clips','LIMIT');let total=0;
 const segments=plan.segments.map((s,i)=>{const start=finite(s.start??s.inSeconds,-1),end=finite(s.end??s.outSeconds,-1);insist(start>=0&&end-start>=.12&&end<=media.seconds+0.03,`\u0110o\u1ea1n ${i+1} c\u1ee7a k\u1ebf ho\u1ea1ch (${start}s - ${end}s) v\u01b0\u1ee3t th\u1eddi l\u01b0\u1ee3ng video (${media.seconds}s). H\u00e3y t\u1ea1o l\u1ea1i k\u1ebf ho\u1ea1ch cho video n\u00e0y.`, 'MEDIA_PLAN_RANGE');total+=end-start;insist(total<=3600,'Output duration limit','LIMIT');return {id:s.id||`clip-${i+1}`,start,end,inSeconds:start,outSeconds:end,order:i,source:media.path};});
 const audioStreams=(media.streams||[]).filter(s=>s.codec_type==='audio');
 const audioStreamIndex=plan.audioStreamIndex==null?null:Number(plan.audioStreamIndex);
 if(audioStreamIndex!==null)insist(Number.isInteger(audioStreamIndex)&&(!Array.isArray(media.streams)||audioStreams.some((s,i)=>(s.index??i)===audioStreamIndex)),'Selected audio stream not found','MEDIA_AUDIO_SELECTION');
 if(audioStreams.length>1&&audioStreamIndex===null)insist(false,'Nguồn có nhiều track tiếng; hãy chọn audioStreamIndex trước khi dựng.','MEDIA_AUDIO_SELECTION');
 const effects=Array.isArray(plan.effects)?[...new Set(plan.effects)]:[];insist(effects.every(x=>x==='fade-in-out'),'Unknown edit effect','MEDIA_EFFECT');
 const framing=plan.framing||'fit';insist(['fit','crop'].includes(framing),'Unknown video framing','MEDIA_FRAMING');
 const transition=plan.transition||'cut';insist(['cut','crossfade'].includes(transition),'Unsupported transition','MEDIA_TRANSITION');
 const requested=Number(plan.transitionSeconds??0.35);
 insist(transition==='cut'||(Number.isFinite(requested)&&requested>=.1&&requested<=.75),'Invalid transition length','MEDIA_TRANSITION');
 const shortest=Math.min(...segments.map(s=>s.end-s.start));
 const transitionSeconds=transition==='crossfade'&&segments.length>1&&shortest>=.5?Math.min(requested,shortest/3):0;
 const effectiveTransition=transitionSeconds>=.1?transition:'cut';
 insist(total-(segments.length-1)*transitionSeconds>.2,'Transition overlap too long','MEDIA_TRANSITION');
 return {...plan,version:2,schemaVersion:media.sha256?2:(plan.schemaVersion||1),sourceArtifactId:media.artifactId||(media.sha256?'sha256:'+media.sha256:plan.sourceArtifactId||null),sourceSha256:media.sha256||plan.sourceSha256||null,sourceSeconds:media.seconds,sourceDurationSeconds:media.seconds,sourceProbe:{streams:media.streams||plan.sourceProbe?.streams||[]},analysisProvenance:plan.analysisProvenance||plan.origin||'unknown',effects,framing,segments,transition:effectiveTransition,transitionSeconds:effectiveTransition==='cut'?0:transitionSeconds,audioStreamIndex,width:dimensions[plan.ratio][0],height:dimensions[plan.ratio][1],fps:25,expectedDuration:total-(segments.length-1)*(effectiveTransition==='cut'?0:transitionSeconds)};
}
module.exports={naturalPlan,plan,validate,assertSourceBinding};
