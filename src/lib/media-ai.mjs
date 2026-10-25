/** Project-specific, verified text-model routing for media plans.
 * A CLI installed on disk is not an authenticated provider. Never infer a
 * connection or export cookies/tokens to the Media Engine. */
import { getProject } from './projects.mjs';
import { ask } from './providers.mjs';
import { listConnections, vaultStatus } from './vault.mjs';
import { AI_KINDS, modelAvailability, verifiedBinding, roleRef } from './model-bindings.mjs';

const preferredKinds = ['chatgpt_account','claude_account','antigravity_account','gemini_account','openai','anthropic','gemini','openai_compatible'];
function blocked(message){const e=new Error(message);e.code='BLOCKED_PROVIDER';return e;}
export function mediaPlannerStatus(projectId, role = 'worker'){
  if(!projectId)return {available:false,mode:'local',reason:'Chọn dự án để chọn AI.'};
  if(!vaultStatus().unlocked)return {available:false,mode:'local',reason:'Vault đang khóa; lập kế hoạch local vẫn dùng được.'};
  const project=getProject(projectId);
  if(project.modelRoles?.[role]){
    try{
      const binding=verifiedBinding(project.modelRoles[role]);
      const c=listConnections().find(x=>x.id===binding.connectionId);
      return {available:true,mode:'ai',source:`project-${role}`,provider:c?.name||'AI',model:binding.model,target:roleRef(projectId,role)};
    }catch(e){return {available:false,mode:'local',reason:`AI ${role} của dự án chưa sẵn sàng: `+e.message};}
  }
  const candidates=listConnections().filter(x=>AI_KINDS.includes(x.kind)&&x.model)
    .sort((a,b)=>preferredKinds.indexOf(a.kind)-preferredKinds.indexOf(b.kind));
  for(const c of candidates){
    if(!modelAvailability(c.id).models.includes(c.model))continue;
    try{
      const binding=verifiedBinding({connectionId:c.id,model:c.model});
      return {available:true,mode:'ai',source:'verified-account',provider:c.name,model:binding.model,target:binding};
    }catch{}
  }
  return {available:false,mode:'local',reason:'Chưa có model nào trong danh mục của các tài khoản đã đăng nhập. Vào Kết nối, đăng nhập và tải danh mục model; hoặc dùng dựng local.'};
}
export async function mediaModelPlan(projectId,input){
  const selection=mediaPlannerStatus(projectId);
  if(!selection.available)throw blocked(selection.reason);
  const system='Bạn là người lập timeline dựng video. Bạn CHỈ biết dữ liệu kỹ thuật và yêu cầu văn bản, không được tuyên bố đã xem ảnh, nghe tiếng hoặc nhận dạng nội dung. Trả CHỈ một đối tượng JSON (không markdown) với kind="edit", ratio thuộc "16:9","9:16","1:1", framing "crop" hoặc "fit", transition thuộc "cut", "crossfade", "fadeblack" (qua đen), "slideleft"/"slideright" (trượt), "wipeleft" (gạt), transitionSeconds từ 0.1 đến 0.75, effects là mảng chỉ chứa "fade-in-out" nếu muốn, segments 1-40 đoạn {start,end} theo số giây. Nếu người dùng muốn chuyển cảnh mượt, dùng crossfade giữa ít nhất 2 đoạn với transitionSeconds khoảng 0.35. Chỉ dùng các mốc sceneChanges có trong analysis, không tự bịa cảnh quay. Đoạn nằm trong video và có start < end; không bịa lời thoại hoặc cảnh. Yêu cầu dọc 9:16 nên dùng ratio 9:16, framing crop; yêu cầu hiệu ứng chung có thể dùng fade-in-out (mờ dần đầu và cuối hình).';
  const text=await ask(selection.target,{system,prompt:JSON.stringify({request:input?.prompt,videoSeconds:input?.media?.seconds,streams:input?.media?.streams,analysis:input?.analysis||null}),usageContext:{role:'worker',projectId}});
  const raw=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('AI đã phản hồi nhưng không trả kế hoạch JSON hợp lệ. Không thay bằng kết quả giả.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||!Array.isArray(parsed.segments))throw new Error('AI trả về kế hoạch không hợp lệ.');
  return parsed;
}

/**
 * Effects plan from the project's Reviewer-role model (e.g. a logged-in
 * Claude account). The model only plans; Concat renders deterministically.
 * Bounds are validated against the real probed media length supplied by the
 * host, never against the model's own claims.
 */
export async function mediaReviewerPlan(projectId,input){
  const selection=mediaPlannerStatus(projectId,'reviewer');
  if(!selection.available)throw blocked(selection.reason);
  const seconds=Number(input?.media?.seconds);
  if(!Number.isFinite(seconds)||seconds<=0)throw new Error('Thiếu thời lượng video thật để lập kế hoạch hiệu ứng.');
  const system='Bạn là Reviewer kiểm tra phim và lập kế hoạch hiệu ứng/hậu kỳ cho bộ dựng Concat. Bạn CHỈ biết dữ liệu kỹ thuật và yêu cầu văn bản, không được tuyên bố đã xem hình hoặc nghe tiếng. Trả CHỈ một đối tượng JSON (không markdown) với kind="edit", ratio thuộc "16:9","9:16","1:1", framing "crop" hoặc "fit", transition thuộc "cut", "crossfade", "fadeblack" (qua đen), "slideleft"/"slideright" (trượt), "wipeleft" (gạt), transitionSeconds từ 0.1 đến 0.75, title là tiêu đề mở đầu tối đa 95 ký tự (hoặc null), effects là mảng chỉ chứa "fade-in-out" nếu muốn, segments 1-24 đoạn {start,end} theo giây nằm trọn trong thời lượng video đã cho, nối tiếp nhau bao phủ phần nội dung chính. Không bịa cảnh quay ngoài thời lượng thật.';
  const text=await ask(selection.target,{system,prompt:JSON.stringify({request:input?.prompt,videoSeconds:seconds,streams:input?.media?.streams||null}),usageContext:{role:'reviewer',projectId}});
  const raw=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('Reviewer đã phản hồi nhưng không trả kế hoạch JSON hợp lệ. Không thay bằng kết quả giả.');}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||parsed.kind!=='edit'||!Array.isArray(parsed.segments)||parsed.segments.length<1||parsed.segments.length>24)throw new Error('Reviewer trả về kế hoạch hiệu ứng không hợp lệ.');
  for(const s of parsed.segments){if(!Number.isFinite(s?.start)||!Number.isFinite(s?.end)||s.start<0||s.end-s.start<0.15||s.end>seconds+0.05)throw new Error('Reviewer trả đoạn nằm ngoài thời lượng video thật. Đã chặn.');}
  if(parsed.title!==undefined&&parsed.title!==null&&(typeof parsed.title!=='string'||parsed.title.length>95))throw new Error('Tiêu đề của Reviewer vượt quá 95 ký tự.');
  if(parsed.transition!==undefined&&!['cut','crossfade','fadeblack','slideleft','slideright','wipeleft'].includes(parsed.transition))throw new Error('Kiểu chuyển cảnh của Reviewer không được hỗ trợ.');
  return parsed;
}

/**
 * Translate subtitle segments with the project's verified Worker-role model.
 * The model returns texts only; timings are always copied deterministically
 * from the source segments by the caller, never invented by the model.
 */
export async function translateSegmentsWithModel(projectId,segments,targetLanguage){
  const selection=mediaPlannerStatus(projectId,'worker');
  if(!selection.available)throw blocked(selection.reason);
  const system='Bạn là dịch giả phụ đề. Dịch từng đoạn sang ngôn ngữ đích được yêu cầu, giữ văn phong tự nhiên và ngắn gọn để đọc thành tiếng khớp thời lượng đoạn gốc. Trả CHỈ một mảng JSON các chuỗi, đúng thứ tự và đúng số lượng đoạn đầu vào, không thêm giải thích hay markdown.';
  const served={};
  const text=await ask(selection.target,{system,prompt:JSON.stringify({targetLanguage,segments:segments.map(s=>s.text)}),usageContext:{role:'worker',projectId},served});
  const raw=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('AI dịch không trả mảng JSON hợp lệ. Không thay bằng bản dịch giả.');}
  if(!Array.isArray(parsed)||parsed.length!==segments.length||parsed.some(t=>typeof t!=='string'||!t.trim()||t.length>1000))throw new Error('Bản dịch không khớp số đoạn nguồn hoặc có đoạn rỗng/quá dài. Đã chặn.');
  // Provenance (v0.9.55): the connection+model that ACTUALLY served —
  // the router may have failed over inside the pool mid-step.
  return {texts:parsed,provider:served.connectionName||selection.provider,model:served.model||selection.model,connectionId:served.connectionId||null};
}

/**
 * Per-window character budgets for a NEW narration script, computed
 * deterministically from window durations and a conservative speaking rate,
 * so a model-written line can be spoken inside its window. Timings and
 * budgets never come from the model.
 */
export function rethemeBudgets(segments,language='vi'){
  const cps=String(language).toLowerCase().startsWith('en')?14.5:13.5;
  return segments.map(s=>Math.max(24,Math.min(900,Math.round((s.end-s.start)*cps))));
}

/**
 * Split a free-form script across timing windows proportionally to window
 * durations, preserving every word exactly once and in order. Deterministic:
 * no AI is involved in the split.
 */
export function splitScriptAcrossWindows(text,segments){
  const words=String(text||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  if(!words.length||!Array.isArray(segments)||!segments.length)return segments.map(()=>'');
  const totalDur=segments.reduce((a,s)=>a+Math.max(0.1,s.end-s.start),0);
  const totalChars=words.join(' ').length;
  const out=[];let wi=0;
  for(let i=0;i<segments.length;i++){
    if(i===segments.length-1){out.push(words.slice(wi).join(' '));break;}
    const share=totalChars*((segments[i].end-segments[i].start)/totalDur);
    const part=[];
    let len=0;
    while(wi<words.length&&(len===0||len+words[wi].length+1<=share)){part.push(words[wi]);len+=words[wi].length+1;wi++;}
    out.push(part.join(' '));
  }
  return out;
}

/**
 * Write a brand-new narration script (new topic) for an existing video, one
 * line per timing window, with the project's verified Worker-role model.
 * The model returns texts only; windows and budgets are computed by code.
 */
export async function writeRethemeScriptWithModel(projectId,segments,{topic,notes='',language='vi'}={}){
  const selection=mediaPlannerStatus(projectId,'worker');
  if(!selection.available)throw blocked(selection.reason);
  const budgets=rethemeBudgets(segments,language);
  const system='Bạn là biên kịch thuyết minh video. Viết kịch bản thuyết minh MỚI hoàn toàn theo chủ đề được giao, mỗi đoạn khớp đúng một cửa sổ thời gian của video gốc. Văn nói tự nhiên, mạch lạc xuyên suốt các đoạn, mỗi đoạn không vượt quá ngân sách ký tự của cửa sổ đó. Trả CHỈ một mảng JSON các chuỗi, đúng thứ tự và đúng số lượng đoạn đầu vào, không thêm giải thích hay markdown.';
  const served={};
  const text=await ask(selection.target,{system,prompt:JSON.stringify({topic:String(topic||'').slice(0,300),notes:String(notes||'').slice(0,800),language,windows:segments.map((s,i)=>({start:s.start,end:s.end,maxChars:budgets[i]}))}),usageContext:{role:'worker',projectId},served});
  const raw=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let parsed;try{parsed=JSON.parse(raw)}catch{throw new Error('AI viết kịch bản không trả mảng JSON hợp lệ. Không thay bằng kịch bản giả.');}
  if(!Array.isArray(parsed)||parsed.length!==segments.length||parsed.some(t=>typeof t!=='string'||!t.trim()||t.length>1000))throw new Error('Kịch bản AI không khớp số cửa sổ hoặc có đoạn rỗng/quá dài. Đã chặn.');
  return {texts:parsed,budgets,provider:served.connectionName||selection.provider,model:served.model||selection.model,connectionId:served.connectionId||null};
}

export async function writeTextWithModel(projectId,{instructions,prompt,maxChars=4500,role='worker'}={}){
  if(!['worker','founder','reviewer'].includes(role))throw blocked('Invalid text-model role.');
  if(role==='reviewer'&&!getProject(projectId).modelRoles?.reviewer)throw blocked('Chon AI Reviewer cua du an.');
  const selection=mediaPlannerStatus(projectId,role);
  if(!selection.available)throw blocked(selection.reason);
  const served={};
  const text=await ask(selection.target,{system:String(instructions||'').slice(0,2000),prompt:String(prompt||'').slice(0,12000),usageContext:{role,projectId},served});
  const out=String(text||'').trim().replace(/^```(?:\w+)?\s*/i,'').replace(/\s*```$/,'');
  if(!out||out.length>maxChars)throw new Error('AI không trả văn bản hợp lệ hoặc văn bản quá dài. Đã chặn.');
  return {text:out,provider:served.connectionName||selection.provider,model:served.model||selection.model,connectionId:served.connectionId||null};
}



/* ===== AI director: one box in, one understandable plan out =====
 * The model only UNDERSTANDS and PROPOSES. Routing below is deterministic:
 * it maps the validated plan onto existing operations with validated params.
 * Nothing executes from here — the routed task still passes the approval gate. */
export const DIRECTOR_INTENTS=['chinh-sua','phu-de','doi-chu-de','long-tieng','thay-giong','y-tuong','khong-ro'];
export function buildDirectorModelCall({hasSource=false,seconds=0,width=0,height=0,hasAudio=false,transcript='',wish='',whisperReady=false}={}){
  const instructions=[
    'Bạn là AI đạo diễn video của AI Project OS. Người dùng không biết kỹ thuật dựng phim.',
    'Nhiệm vụ: hiểu họ muốn gì từ thông tin được cung cấp, rồi đề xuất MỘT kế hoạch duy nhất, nói bằng tiếng Việt dễ hiểu.',
    'Các ý định (intent) được phép:',
    '- "chinh-sua": dựng lại video (cắt gọn, đổi khung hình, hiệu ứng, nhạc, tiêu đề).',
    '- "phu-de": chủ yếu muốn thêm/sửa phụ đề theo lời nói trong video.',
    '- "doi-chu-de": giữ hình, thay toàn bộ nội dung lời sang một chủ đề khác.',
    '- "long-tieng": dịch và lồng tiếng video sang ngôn ngữ khác.',
    '- "thay-giong": giữ nội dung, chỉ thay giọng đọc bằng một file giọng khác.',
    '- "y-tuong": chưa có video; người dùng nêu ý tưởng làm video mới.',
    '- "khong-ro": không đủ thông tin để hiểu ý.',
    'Nếu là "y-tuong": viết luôn kịch bản lời đọc (scriptDraft) theo phong cách video giải thích dễ hiểu: câu mở đầu gây tò mò, các ý chính rõ ràng, câu kết chốt lại; văn nói tự nhiên, tối đa 4000 ký tự.',
    'Nếu là "doi-chu-de": ghi rõ chủ đề mới vào "topic". Nếu "long-tieng": đoán ngôn ngữ gốc của video (sourceLanguage: "vi" hoặc "en") và ngôn ngữ đích người dùng muốn (targetLanguage: "vi" hoặc "en").',
    'Trả về DUY NHẤT một JSON object, không giải thích thêm, đúng mẫu:',
    '{"intent":"...","summary":"một câu tiếng Việt: tôi hiểu bạn muốn...","steps":["bước 1","bước 2"],"prompt":"yêu cầu dựng đã viết lại rõ ràng (cho chinh-sua/phu-de)","autoCaptions":true/false,"title":"tiêu đề gợi ý hoặc rỗng","topic":"chủ đề mới hoặc rỗng","sourceLanguage":"vi|en","targetLanguage":"vi|en","scriptDraft":"kịch bản (chỉ cho y-tuong)"}'
  ].join('\n');
  const facts=hasSource
    ?`Video đã nạp: dài ${Math.round(seconds)} giây, khung ${width}x${height}, ${hasAudio?'có tiếng':'không có tiếng'}. Whisper local: ${whisperReady?'sẵn sàng (nghe được lời nói)':'chưa sẵn sàng'}.\nBản nghe nội dung video (trích): ${transcript?transcript.slice(0,2800):'(không nghe được hoặc video không có lời nói)'}\nMong muốn của người dùng (để trống nghĩa là nhờ AI tự đề xuất cách làm hay nhất): ${wish||'(để trống)'}`
    :`Người dùng CHƯA nạp video. Ý tưởng của họ: ${wish||'(trống)'}`;
  return {instructions,prompt:facts+'\n\nHãy trả JSON kế hoạch theo đúng mẫu đã quy định.'};
}
export function parseDirectorPlan(text){
  const raw=String(text||'');const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
  if(a<0||b<=a)throw new Error('AI không trả kế hoạch JSON đọc được.');
  let j;try{j=JSON.parse(raw.slice(a,b+1));}catch{throw new Error('AI trả kế hoạch JSON không hợp lệ.');}
  if(!DIRECTOR_INTENTS.includes(j.intent))throw new Error('AI trả intent lạ: '+String(j.intent||''));
  const clean=(v,n)=>String(v??'').trim().slice(0,n);
  return {
    intent:j.intent,
    summary:clean(j.summary,400)||'AI chưa tóm tắt được kế hoạch.',
    steps:(Array.isArray(j.steps)?j.steps:[]).map(s=>clean(s,200)).filter(Boolean).slice(0,6),
    prompt:clean(j.prompt,4000),
    autoCaptions:j.autoCaptions===true,
    title:clean(j.title,95),
    topic:clean(j.topic,300),
    sourceLanguage:['vi','en'].includes(j.sourceLanguage)?j.sourceLanguage:'vi',
    targetLanguage:['vi','en'].includes(j.targetLanguage)?j.targetLanguage:'vi',
    scriptDraft:clean(j.scriptDraft,4000)
  };
}
export function routeDirectorPlan(plan,{source='',sourceLabel='',whisperReady=false}={}){
  const warnings=[];const summaryText=(plan.summary+' | '+(plan.steps||[]).join(' → ')).slice(0,600);
  const withSummary=params=>({...params,planSummary:summaryText,...(sourceLabel?{sourceLabel}:{})});
  switch(plan.intent){
    case 'chinh-sua':{
      if(!source)return {operation:null,needsInput:'source',warnings};
      if(plan.autoCaptions&&!whisperReady)warnings.push('Chưa cài Whisper nên chưa tự tạo phụ đề được; kế hoạch dựng vẫn chạy không có phụ đề tự động.');
      return {operation:'media.quick-edit',params:withSummary({source,prompt:plan.prompt||'Dựng lại video gọn gàng, nhịp nhanh, chuyển cảnh mượt',autoCaptions:!!plan.autoCaptions&&whisperReady,concatTitle:plan.title||undefined}),warnings};
    }
    case 'phu-de':{
      if(!source)return {operation:null,needsInput:'source',warnings};
      if(!whisperReady)return {operation:null,needsInput:'whisper',warnings:['Muốn tự tạo phụ đề theo lời nói cần Whisper local — máy này chưa cài model Whisper. Cài model (mục Hướng dẫn) hoặc nạp file SRT ở chế độ Phụ đề.']};
      return {operation:'media.quick-edit',params:withSummary({source,prompt:plan.prompt||'Thêm phụ đề đúng lời nói trong video, giữ nguyên hình và tiếng gốc',autoCaptions:true,concatTitle:plan.title||undefined}),warnings};
    }
    case 'doi-chu-de':{
      if(!source)return {operation:null,needsInput:'source',warnings};
      if(!plan.topic)return {operation:null,needsInput:'topic',warnings:['AI chưa rõ chủ đề mới. Gõ rõ chủ đề vào ô mong muốn rồi bấm lại.']};
      return {operation:'media.retheme',params:withSummary({source,scriptSource:'model',topic:plan.topic,notes:plan.summary,targetLanguage:plan.targetLanguage||'vi',hardsubCover:'blur',karaokeCaptions:true}),warnings};
    }
    case 'long-tieng':{
      if(!source)return {operation:null,needsInput:'source',warnings};
      return {operation:'media.dub',params:withSummary({source,sourceLanguage:plan.sourceLanguage||'vi',targetLanguage:plan.targetLanguage||'vi',translationSource:'model',ttsProvider:'local',hardsubCover:'blur',karaokeCaptions:true}),warnings};
    }
    case 'thay-giong':
      return {operation:null,needsInput:'voice-file',warnings:['Thay giọng cần một file giọng đọc (WAV/MP3) của bạn. Mở chế độ "Thay giọng thật" ở cột trái, nạp file giọng rồi tạo tác vụ.']};
    case 'y-tuong':{
      if(!plan.scriptDraft)return {operation:null,needsInput:'script',warnings:['AI chưa viết được kịch bản từ ý tưởng này. Gõ ý tưởng cụ thể hơn rồi bấm lại.']};
      return {operation:'media.story',params:withSummary({text:plan.scriptDraft,mode:'verbatim',resolution:'720p',rights:'unspecified'}),warnings};
    }
    default:
      return {operation:null,needsInput:'clarify',warnings:['AI chưa hiểu rõ ý. Mô tả thêm một câu bạn muốn làm gì với video/ý tưởng này.']};
  }
}

/* Group neighbouring speech windows so TTS reads longer, continuous
 * passages instead of cold-starting every short window (the main cause of
 * choppy dubbed speech). Pure + deterministic: a group grows while the gap
 * to the next window stays small, the combined text stays bounded and the
 * total span stays bounded. Timings still come from the windows, never AI. */
export function groupSpeechSegments(segments,{maxGap=0.7,maxChars=600,maxSpan=30}={}){
  const groups=[];
  for(let i=0;i<segments.length;i++){
    const s=segments[i];
    const cur=groups[groups.length-1];
    if(cur){
      const gap=s.start-cur.end;
      const chars=cur.chars+String(s.text||'').length+1;
      const span=s.end-cur.start;
      if(gap<=maxGap&&chars<=maxChars&&span<=maxSpan){cur.indexes.push(i);cur.end=s.end;cur.chars=chars;continue;}
    }
    groups.push({start:s.start,end:s.end,indexes:[i],chars:String(s.text||'').length});
  }
  return groups.map(({start,end,indexes})=>({start,end,indexes}));
}
