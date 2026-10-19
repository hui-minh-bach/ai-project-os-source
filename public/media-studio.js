/* Exact CoreServices v1 browser consumer through same-origin host only. */
const mediaUI={mode:'analyze',source:'',sourceLabel:'',sourceProjectId:null,planSource:null,audioSource:'',captionsSource:'',musicSource:'',busy:false,tasks:[],artifacts:[],lastLoaded:0};
function mediaFeedback(text,level=''){const el=$('#mediaFeedback');if(el){el.textContent=text;el.className='mediaHint '+(level?'media'+level:'');}}
function mediaSwitchMode(mode){if(!['analyze','edit-plan','render','effects','subtitle-edit','story','voiceover','tts-video','retheme','publish-draft'].includes(mode))return;mediaUI.mode=mode;
  $$('[data-media-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mediaMode===mode));
  $$('[data-media-panel]').forEach(panel=>{panel.hidden=panel.dataset.mediaPanel!==mode});
  $('#mediaVoiceMixOptions').hidden=!['voiceover','tts-video'].includes(mode);
  $('#mediaQueueTask').textContent=mode==='edit-plan'?'＋ Chỉ lưu kế hoạch (không dựng video)':mode==='render'?'＋ Tạo tác vụ xuất MP4':'＋ Tạo tác vụ chờ duyệt';
  mediaFeedback(mode==='edit-plan'?'Gõ yêu cầu bằng tiếng Việt và bấm Dựng MP4 theo mô tả. Duyệt một lần trước khi chạy.':'Các tác vụ chỉ chạy sau khi bạn phê duyệt.');
  if(mode==='render'&&!$('#mediaTimeline').value.trim())void mediaUseLatestPlan(true);
}
$$('[data-media-mode]').forEach(button=>button.addEventListener('click',()=>mediaSwitchMode(button.dataset.mediaMode)));
function mediaRenderStatus(data=experience.status){
  const el=$('#mediaStatusBar');if(!el)return;
  if(!data){el.innerHTML='<span class="mediaError">Không kết nối được Local Worker.</span>';return;}
  const on=data.core.status==='active';
  el.innerHTML=`<span class="${on?'mediaSuccess':'mediaError'}">Core: ${on?'đang chạy':'chưa kích hoạt'}</span><span>Concat: ${data.media.concat?.configured?'đã cấu hình token (cần xác minh Remote)':'chưa nối Remote'}</span><span>Giọng local: ${data.media.localTts?.ready?'Piper sẵn sàng':'dùng giọng trong Concat hoặc nạp file'}</span><span>Whisper: ${data.media.whisper?.ready?'đã có model':'chưa cài model'}</span><span class="${data.media.status==='available'?'mediaSuccess':'mediaError'}">FFmpeg: ${data.media.ffmpeg?'dự phòng sẵn sàng':'chưa có'}</span><span>Đăng bài: chưa mở</span>`;
  const warn=$('#mediaLimitations');if(warn)warn.textContent=on?'Không cần HeyGen API: Concat có biên tập, giọng đọc và phụ đề local trong ứng dụng. Để TỰ động tạo giọng qua một tác vụ cần Piper + model offline; nếu Concat đã tạo WAV/MP3 thì nạp tại Thay giọng thật. API Concat 0.2 chưa điều khiển TTS trực tiếp. Đăng bài vẫn khóa.':'Core chưa hoạt động. Kiểm tra Local Worker và mở Vault; không nhập khóa API vào trình duyệt.';
  mediaGuardUnavailableOptions(data);
}
function mediaGuardUnavailableOptions(data){
  const media=data?.media||{};
  const whisperReady=!!media.whisper?.ready;
  const concatConfigured=!!media.concat?.configured;
  const whisper=$('#mediaAutoCaptions'),concat=$('#mediaConcatProject');
  if(whisper){whisper.disabled=!whisperReady;if(!whisperReady)whisper.checked=false;}
  if(concat){concat.disabled=!concatConfigured;if(!concatConfigured)concat.checked=false;}
  const warning=$('#mediaCapabilityPreflight');
  if(warning){const parts=[];
    if(!whisperReady)parts.push('Whisper chưa có model: không thể tự tạo phụ đề. Cài model trước hoặc nạp SRT.');
    if(!concatConfigured)parts.push('Concat chưa kết nối: mở “Kết nối trình biên tập Concat” rồi bấm “Cài + kết nối Concat tự động”.');
    warning.textContent=parts.join(' ')+(parts.length?' FFmpeg chỉ dựng video cơ bản; không thay thế hai tính năng này.':'Khi dựng với Concat, chương trình sẽ kiểm tra kết nối Remote thật trước khi tạo tác vụ.');
  }
}
document.addEventListener('integrations-updated',e=>{mediaRenderStatus(e.detail);if(e.detail?.core.status==='active')mediaRefreshJobs();void mediaPlannerRefresh()});
async function mediaPlannerRefresh(){
  const el=$('#mediaPlannerState');if(!el)return;const projectId=state.project?.id;
  if(!projectId){el.textContent='Tạo hoặc chọn một dự án. Sau đó ứng dụng sẽ tìm AI đã xác minh.';return;}
  try{const j=await api('/api/integrations/media/planner?projectId='+encodeURIComponent(projectId));
    if(state.project?.id!==projectId)return;
    el.textContent=j.available?`AI lập kế hoạch: ${j.provider} / ${j.model} (${j.source==='project-worker'?'Worker của dự án':'model đã xác minh'}). Video được dựng trên máy bằng FFmpeg.`:`Chế độ local (không gọi AI): ${j.reason} Dựng nhanh vẫn cắt/chuyển khung/thêm hiệu ứng cơ bản được.`;
  }catch(e){el.textContent='Chưa kiểm tra được AI: '+e.message;}
}
function mediaClearPlanOnSourceChange(){
  mediaUI.planSource=null;
  const timeline=$('#mediaTimeline');if(timeline)timeline.value='';
  const label=$('#mediaRenderReady');if(label)label.textContent='Ch\u01b0a ch\u1ecdn k\u1ebf ho\u1ea1ch cho video n\u00e0y.';
}
function mediaSourceRefresh(){const el=$('#mediaSourceLabel');if(el)el.textContent=mediaUI.source?`Tệp được nhập: ${mediaUI.sourceLabel||mediaUI.source} (chỉ trong workspace local)`:'Chưa có video được nhập.';}
function mediaDirectorSourceRefresh(){const el=$('#mediaDirectorSource');if(el)el.textContent=mediaUI.source?`Đã có video: ${mediaUI.sourceLabel||mediaUI.source} — gõ mong muốn của bạn, hoặc để trống để AI tự đề xuất.`:'Chưa có video — AI sẽ hiểu ô dưới là ý tưởng làm video mới.';}
async function mediaUploadFile(){
  const file=$('#mediaFile').files?.[0];if(!file){mediaFeedback('Chọn file trước khi tải lên.','Error');return;}
  if(!state.project?.id){mediaFeedback('Hãy chọn hoặc tạo dự án trước khi nhập video.','Error');return;}
  if(file.size>150*1024*1024){mediaFeedback('Tệp vượt 150MB.','Error');return;}
  if(experience.status?.core.status!=='active'){mediaFeedback('AI Core chưa được bật.','Error');return;}
  const ext=(file.name.match(/\.[a-zA-Z0-9]{1,8}$/)||[])[0]||'';
  const allowed=['.mp4','.mkv','.mov','.webm','.m4v','.mp3','.wav','.m4a','.txt','.srt','.vtt'];
  if(!allowed.includes(ext.toLowerCase())){mediaFeedback('Định dạng tệp chưa hỗ trợ.','Error');return;}
  mediaFeedback(`Đang nhập ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)…`,'Loading');$('#mediaUpload').disabled=true;
  try{const r=await fetch('/api/integrations/media/upload',{method:'POST',headers:{'x-media-filename':encodeURIComponent('upload'+ext)},body:file});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
    if(mediaUI.source!==j.source)mediaClearPlanOnSourceChange();mediaUI.source=j.source;mediaUI.sourceLabel=file.name;mediaUI.sourceProjectId=state.project?.id||null;mediaSourceRefresh();mediaDirectorSourceRefresh();if($('#mediaShowAllHistory'))$('#mediaShowAllHistory').checked=false;await mediaRefreshJobs();mediaFeedback(`Đã nhập video thật (${(j.size/1024/1024).toFixed(1)} MB). Chưa thực thi công việc AI.`,'Success');
  }catch(e){mediaFeedback('Nhập file thất bại: '+e.message,'Error');}finally{$('#mediaUpload').disabled=false;}
}
$('#mediaUpload').addEventListener('click',mediaUploadFile);
async function mediaUploadExtra(field,kind,label){
  const file=$('#'+field)?.files?.[0];if(!file){mediaFeedback('Vui lòng chọn tệp trước.','Error');return;}
  const ext=(file.name.match(/\.[a-zA-Z0-9]{1,8}$/)||[])[0]?.toLowerCase()||'';
  if(!(kind==='audio'||kind==='music'?['.wav','.mp3','.m4a']:['.srt']).includes(ext)) {mediaFeedback('Định dạng tệp không hợp lệ.','Error');return;}
  if(file.size>150*1024*1024){mediaFeedback('Giới hạn file là 150 MB.','Error');return;}
  const button=$('#'+(kind==='audio'?'mediaUploadVoiceAudio':kind==='music'?'mediaUploadVoiceMusic':'mediaUploadVoiceSubtitles'));button.disabled=true;
  try{
    const r=await fetch('/api/integrations/media/upload',{method:'POST',headers:{'x-media-filename':encodeURIComponent('voice-'+kind+ext)},body:file});
    const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);
    if(kind==='audio'){mediaUI.audioSource=j.source;$('#mediaVoiceAudioLabel').textContent='✓ '+file.name;}
    else if(kind==='music'){mediaUI.musicSource=j.source;$('#mediaVoiceMusicLabel').textContent='✓ '+file.name;}
    else{mediaUI.captionsSource=j.source;$('#mediaVoiceSubtitlesLabel').textContent='✓ '+file.name;}
    mediaFeedback('Đã nạp '+label+' vào Local Worker. Chưa tạo tác vụ hay gửi dữ liệu đến AI.','Success');
  }catch(e){mediaFeedback('Lỗi nạp '+label+': '+e.message,'Error');}finally{button.disabled=false;}
}
$('#mediaUploadVoiceAudio').addEventListener('click',()=>mediaUploadExtra('mediaVoiceAudio','audio','giọng đọc'));
$('#mediaQuickAddAudio').addEventListener('click',async()=>{await mediaUploadExtra('mediaQuickAudio','audio','giọng đọc');if(mediaUI.audioSource)$('#mediaQuickUseAudio').checked=true;});
$('#mediaQuickAddMusic').addEventListener('click',async()=>{await mediaUploadExtra('mediaQuickMusic','music','nhạc nền');if(mediaUI.musicSource)$('#mediaQuickUseMusic').checked=true;});
$('#mediaQuickAddSubs').addEventListener('click',async()=>{await mediaUploadExtra('mediaQuickSubs','srt','phụ đề');if(mediaUI.captionsSource)$('#mediaQuickUseSubs').checked=true;});
$('#mediaUploadVoiceMusic').addEventListener('click',()=>mediaUploadExtra('mediaVoiceMusic','music','nhạc nền'));
$('#mediaUploadVoiceSubtitles').addEventListener('click',()=>mediaUploadExtra('mediaVoiceSubtitles','srt','phụ đề'));
$('#mediaVoiceOptions').addEventListener('change',()=>{if($('#mediaVoiceOptions').value)$('#mediaTtsVoice').value=$('#mediaVoiceOptions').value});
$('#mediaTtsVideoVoiceOptions').addEventListener('change',()=>{if($('#mediaTtsVideoVoiceOptions').value)$('#mediaTtsVideoVoice').value=$('#mediaTtsVideoVoiceOptions').value});
async function mediaLoadVoices(){
  const buttons=[$('#mediaLoadHeygenVoices'),$('#mediaLoadHeygenVoices2')];buttons.forEach(b=>b.disabled=true);
  try{
    const r=await fetch('/api/integrations/media/voices');const voices=await r.json();if(!r.ok)throw new Error(voices.error||'Không thể đọc danh sách giọng');
    for(const id of ['mediaVoiceOptions','mediaTtsVideoVoiceOptions']){
      const list=$('#'+id);list.innerHTML='<option value="">Chọn giọng HeyGen Starfish</option>';
      for(const v of voices){const o=document.createElement('option');o.value=v.id;o.textContent=`${v.name} (${v.language||'đa ngôn ngữ'}, ${v.gender||''})`;list.appendChild(o);}
    }
    mediaFeedback('Đã tải '+voices.length+' giọng HeyGen từ API (chưa tạo âm thanh).','Success');
  }catch(e){mediaFeedback(e.message,'Error')}finally{buttons.forEach(b=>b.disabled=false);}
}
$('#mediaLoadHeygenVoices').addEventListener('click',mediaLoadVoices);
$('#mediaLoadHeygenVoices2').addEventListener('click',mediaLoadVoices);
$('#mediaDemo').addEventListener('click',async()=>{
  if(!state.project?.id){mediaFeedback('Hãy chọn hoặc tạo dự án trước khi nạp clip mẫu.','Error');return;}
  mediaFeedback('Đang sao chép clip mẫu thật vào thư mục làm việc…','Loading');$('#mediaDemo').disabled=true;
  try{const r=await api('/api/integrations/media/demo',{method:'POST',body:'{}'});mediaClearPlanOnSourceChange();mediaUI.source=r.source;mediaUI.sourceLabel='clip mẫu video nguồn (được đánh dấu rõ là demo)';mediaUI.sourceProjectId=state.project?.id||null;mediaSourceRefresh();mediaFeedback('Clip mẫu đã nhập. Bấm Tạo tác vụ để phân tích/biên tập.','Success');}
  catch(e){mediaFeedback(e.message,'Error')}finally{$('#mediaDemo').disabled=false;}
});
function mediaJson(id,fallback){const raw=$('#'+id)?.value?.trim();if(!raw)return fallback;try{return JSON.parse(raw)}catch{throw new Error('JSON không hợp lệ trong trường '+id)}}
function mediaPayload(){const source=mediaUI.source,mode=mediaUI.mode;let params={};
  if(['analyze','edit-plan','render','voiceover','tts-video','retheme','publish-draft'].includes(mode)&&!source)throw new Error('Hãy vào Phân tích video để nhập hoặc chọn clip mẫu trước.');
  if(mode==='analyze')params={source,transcribe:$('#mediaTranscribe').checked,language:'vi'};
  else if(mode==='edit-plan')params={source,prompt:$('#mediaPrompt').value.trim()||'Phân tích và dựng timeline video nguyên bản'};
  else if(mode==='render'){
    if($('#mediaAutoCaptions').checked||$('#mediaConcatProject').checked||$('#mediaNarrationText').value.trim()||$('#mediaQuickUseAudio').checked||$('#mediaQuickUseMusic').checked||$('#mediaQuickUseSubs').checked)
      throw new Error('Bước 3 chỉ xuất MP4 cơ bản từ JSON; KHÔNG chạy Whisper/Concat/giọng/nhạc đã chọn ở Bước 2. Quay lại Kế hoạch dựng và bấm “Dựng MP4 theo mô tả” để chạy đủ tùy chọn trong một tác vụ.');
    const editPlan=mediaJson('mediaTimeline',null);
    if(!editPlan||typeof editPlan!=='object')throw new Error('Ch\u01b0a c\u00f3 k\u1ebf ho\u1ea1ch d\u1ef1ng. H\u00e3y t\u1ea1o k\u1ebf ho\u1ea1ch m\u1edbi.');
    if(editPlan.schemaVersion!==2||!editPlan.sourceSha256||!editPlan.sourceArtifactId)throw new Error('Kế hoạch cũ chưa khóa nguồn SHA-256. Bấm Lấy kế hoạch mới hoặc Dựng lại từ video gốc.');
    if(mediaUI.planSource&&mediaUI.planSource!==source)throw new Error('K\u1ebf ho\u1ea1ch thu\u1ed9c video kh\u00e1c. H\u00e3y ch\u1ecdn l\u1ea1i k\u1ebf ho\u1ea1ch cho video hi\u1ec7n t\u1ea1i.');
    const track=$('#mediaAudioStreamRender').value.trim();
    if(track!=='')editPlan.audioStreamIndex=Number(track);
    params={source,editPlan,subtitleSegments:mediaJson('mediaRenderSubs',undefined)};
  }
  else if(mode==='voiceover'){if(!mediaUI.audioSource)throw new Error('Nạp file giọng đọc WAV/MP3/M4A trước.');params={source,audioSource:mediaUI.audioSource,captionsSource:mediaUI.captionsSource||undefined,musicSource:mediaUI.musicSource||undefined,musicVolume:Number($('#mediaVoiceMusicVolume').value),alignment:$('#mediaVoiceAlignment').value,hardsubCover:$('#mediaVoiceoverHardsub')?.value||'off',hardsubRegionPct:Number($('#mediaVoiceoverHardsubHeight')?.value||12)};}
  else if(mode==='tts-video'){if($('#mediaTtsProvider').value==='local'&&!experience.status?.media?.localTts?.ready)throw new Error('Chưa cài Piper TTS local. Hãy tạo giọng trong Concat rồi nạp WAV/MP3 ở Thay giọng thật, hoặc cài Piper + model offline. Không cần HeyGen.');const text=$('#mediaTtsVideoText').value.trim();if(!text||text.length>5000)throw new Error('Lời thoại phải từ 1 đến 5000 ký tự.');params={source,text,ttsProvider:$('#mediaTtsProvider').value,voice:$('#mediaTtsVideoVoice').value.trim()||undefined,captionsSource:mediaUI.captionsSource||undefined,musicSource:mediaUI.musicSource||undefined,musicVolume:Number($('#mediaVoiceMusicVolume').value),alignment:$('#mediaVoiceAlignment').value};}
  else if(mode==='effects'){const fx=$$('#mediaFxPanel input[type=checkbox]:checked').map(c=>c.value);if(!fx.length)throw new Error('Tick chọn ít nhất một hiệu ứng.');if(fx.includes('title')&&!$('#mediaFxTitle').value.trim())throw new Error('Nhập chữ vào ô Tiêu đề cho hiệu ứng Tiêu đề mở đầu.');if(fx.includes('lower-third')&&!$('#mediaFxName').value.trim())throw new Error('Nhập chữ vào ô Thẻ tên cho hiệu ứng Thẻ tên.');params={source,effects:fx,title:$('#mediaFxTitle').value.trim()||undefined,name:$('#mediaFxName').value.trim()||undefined};}
  else if(mode==='retheme'){const scriptSource=$('#mediaRethemeScriptSource').value;const topic=$('#mediaRethemeTopic').value.trim();const scriptText=$('#mediaRethemeScriptText').value.trim();if(scriptSource==='model'&&!topic)throw new Error('Nhập chủ đề mới để AI viết kịch bản, hoặc chọn “Tôi tự dán kịch bản”.');if(scriptSource==='supplied'&&!scriptText)throw new Error('Dán kịch bản của bạn vào ô kịch bản.');params={source,scriptSource,topic:topic||undefined,notes:$('#mediaRethemeNotes').value.trim()||undefined,scriptText:scriptText||undefined,targetLanguage:$('#mediaRethemeLanguage').value,hardsubCover:$('#mediaRethemeHardsub')?.value||'blur',hardsubRegionPct:Number($('#mediaRethemeHardsubHeight')?.value||12),karaokeCaptions:$('#mediaRethemeKaraoke')?$('#mediaRethemeKaraoke').checked:true,captionPreset:$('#mediaRethemeCaptionPreset')?.value||'sweep',quality:$('#mediaRethemeQuality')?.value||'high',ttsProvider:$('#mediaRethemeTts')?.value||'local',voice:$('#mediaRethemeTts')?.value==='fpt'?($('#mediaRethemeFptVoice')?.value||undefined):undefined,captionsSource:mediaUI.captionsSource||undefined};}
  else if(mode==='subtitle-edit'){const segments=mediaJson('mediaSegments',null);if(!Array.isArray(segments)||!segments.length)throw new Error('Cần JSON mảng các đoạn phụ đề.');params={segments,changes:mediaJson('mediaChanges',[])};}
  else if(mode==='story'){const text=$('#mediaStoryText').value.trim();if(!text)throw new Error('Cần nội dung truyện.');params={text,mode:$('#mediaStoryMode').value,resolution:$('#mediaStoryRes').value,voice:$('#mediaTtsVoice').value.trim()||undefined,rights:$('#mediaStoryRights').value,transition:$('#mediaStoryTransition')?.value||'crossfade',transitionSeconds:0.4,quality:$('#mediaStoryQuality')?.value||'high',allowProviderImages:!!$('#mediaStoryAiArt')?.checked};}
  else if(mode==='publish-draft'){const title=$('#mediaDraftTitle').value.trim();if(!title)throw new Error('Nhập tiêu đề bản nháp.');params={video:source,title,channel:$('#mediaDraftChannel').value,rights:$('#mediaDraftRights').value};}
  if(source&&params.source===source&&mediaUI.sourceLabel)params.sourceLabel=mediaUI.sourceLabel.slice(0,160);
  return {operation:mode==='story'&&$('#mediaStoryProduct').value==='outline'?'media.story-outline':'media.'+mode,params};
}
async function mediaManagedConcatStatus(){
  const el=$('#mediaConcatManagedStatus');if(!el)return;
  try{const st=await api('/api/integrations/media/concat/managed/status');
    el.textContent=st.platform!=='win32'?'Tự động cài chỉ hỗ trợ Windows x64.':st.installed?'Concat đã được phát hiện; bấm nút để thiết lập Remote.':st.bundled?'Đã có Concat trong gói, sẵn sàng cài offline.':'Concat chưa cài. Bấm nút để tự tải và kiểm tra bản chính thức.';
  }catch(e){el.textContent='Chưa kiểm tra được Concat: '+e.message;}
}
$('#mediaConcatManagedInstall').addEventListener('click',async()=>{
  const button=$('#mediaConcatManagedInstall'),el=$('#mediaConcatManagedStatus');
  if(!confirm('AI Project OS sẽ cài Concat mã nguồn mở AGPL-3.0, cấu hình kết nối localhost, không gửi video lên Internet. Concat chưa ký số trên Windows. Cho phép cài/chạy bộ cài chính thức đã kiểm tra SHA-256?'))return;
  button.disabled=true;el.textContent='Đang xác minh bộ cài và khởi động Concat. Lần đầu có thể mất vài phút…';
  try{const j=await api('/api/integrations/media/concat/managed/install',{method:'POST',body:JSON.stringify({confirm:true})});
    el.textContent=j.message+(j.hint&&!j.connected?' '+j.hint:'');
    if(j.connected){$('#mediaConcatProject').checked=true;$('#mediaConcatFeedback').textContent=`Concat ${j.concatVersion||''} đã kết nối tự động.`;}
    await experienceRefresh();mediaRenderStatus();
  }catch(e){el.textContent='Chưa cài/kết nối được Concat: '+e.message;}
  finally{button.disabled=false;}
});
void mediaManagedConcatStatus();
$('#mediaConcatSave').addEventListener('click',async()=>{
  const value=$('#mediaConcatToken').value.trim();const el=$('#mediaConcatFeedback');
  try{if(!value)throw new Error('Nhập token lấy từ ứng dụng Concat.');
    await api('/api/integrations/media/concat/config',{method:'POST',body:JSON.stringify({token:value})});
    $('#mediaConcatToken').value='';el.textContent='Đã lưu token vào Vault. Bấm Kiểm tra kết nối thật.';
    await experienceRefresh();mediaRenderStatus();
  }catch(e){el.textContent='Không thể lưu: '+e.message;}
});
$('#mediaConcatTest').addEventListener('click',async()=>{
  const el=$('#mediaConcatFeedback');el.textContent='Đang thử Concat thật trên máy…';
  try{const result=await api('/api/integrations/media/concat/test');$('#mediaConcatProject').checked=true;el.textContent=`Concat ${result.concatVersion||''} / API ${result.apiVersion||''} đã kết nối. Dựng nhanh sẽ tạo các clip cảnh, tiếng, phụ đề và chuyển cảnh thành timeline Concat nhiều lớp.`;}
  catch(e){el.textContent='Concat chưa kết nối được: '+e.message;}
});
$('#mediaQuickRender').addEventListener('click',async()=>{
  if(mediaUI.busy)return;
  const button=$('#mediaQuickRender');const projectId=state.project?.id;const prompt=$('#mediaPrompt').value.trim();
  if(!projectId){mediaFeedback('Tạo hoặc chọn dự án trước khi dựng video.','Error');return;}
  if(!mediaUI.source||mediaUI.sourceProjectId!==projectId){mediaFeedback('Chưa có video nguồn cho dự án này. Chọn Phân tích video để nhập video hoặc clip mẫu.','Error');return;}
  if(!prompt){mediaFeedback('Nhập yêu cầu bằng tiếng Việt, ví dụ: video dọc 9:16, thêm hiệu ứng mờ dần.','Error');return;}
  if(experience.status?.core.status!=='active'){mediaFeedback('Local Worker chưa chạy. Hãy kiểm tra ứng dụng.','Error');return;}
  mediaUI.busy=true;button.disabled=true;
  try{
    const uploadedVoice=$('#mediaQuickUseAudio').checked;
    const uploadedMusic=$('#mediaQuickUseMusic').checked;
    const uploadedSubs=$('#mediaQuickUseSubs').checked;
    if(uploadedVoice&&!mediaUI.audioSource)throw new Error('Chưa nạp file giọng đọc.');
    if(uploadedMusic&&!mediaUI.musicSource)throw new Error('Chưa nạp nhạc nền.');
    if(uploadedSubs&&!mediaUI.captionsSource)throw new Error('Chưa nạp phụ đề SRT.');
    if(uploadedVoice&&$('#mediaNarrationText').value.trim())throw new Error('Chỉ dùng một giọng: file đã thu hoặc lời đọc AI.');
    if($('#mediaAutoCaptions').checked&&!experience.status?.media?.whisper?.ready)
      throw new Error('Whisper chưa sẵn sàng. Chưa thể tạo phụ đề tự động. Hãy cài model hoặc tắt tùy chọn này trước khi dựng.');
    if($('#mediaConcatProject').checked){
      if(!experience.status?.media?.concat?.configured)throw new Error('Concat chưa có kết nối. Bấm “Cài + kết nối Concat tự động” trước khi dựng timeline đa lớp.');
      try{await api('/api/integrations/media/concat/test');}
      catch(e){throw new Error('Concat Remote chưa hoạt động: '+e.message+'. Kiểm tra kết nối thật trước khi dựng.');}
    }
    if($('#mediaNarrationText').value.trim()&&$('#mediaNarrationProvider').value==='local'&&!experience.status?.media?.localTts?.ready)
      throw new Error('Chưa có giọng Piper local. Cài Piper + model hoặc dùng file giọng đã thu, không tiếp tục dựng thiếu giọng.');
    const params={source:mediaUI.source,sourceLabel:mediaUI.sourceLabel.slice(0,160),prompt,...($('#mediaAudioStreamQuick').value.trim()?{audioStreamIndex:Number($('#mediaAudioStreamQuick').value)}:{}),
      autoCaptions:$('#mediaAutoCaptions').checked,concatProject:$('#mediaConcatProject').checked,
      concatTitle:$('#mediaConcatTitle').value.trim(),
      narrationText:$('#mediaNarrationText').value.trim()||undefined,narrationProvider:$('#mediaNarrationProvider').value,
      narrationAudio:uploadedVoice?mediaUI.audioSource:undefined,
      musicSource:uploadedMusic?mediaUI.musicSource:undefined,
      captionsSource:uploadedSubs?mediaUI.captionsSource:undefined,
      musicVolume:Number($('#mediaVoiceMusicVolume').value)};
    const task=await api('/api/integrations/media/tasks',{method:'POST',body:JSON.stringify({projectId,operation:'media.quick-edit',params})});
    mediaFeedback(`Đã tạo tác vụ dựng video ${task.id.slice(0,8)}. Bấm Phê duyệt & chạy ở cột bên phải để bắt đầu tạo MP4. Không cần nhập JSON.`, 'Success');
    await mediaRefreshJobs();
  }catch(e){mediaFeedback('Không thể tạo tác vụ: '+e.message,'Error')}finally{mediaUI.busy=false;button.disabled=false;}
});
$('#mediaQueueTask').addEventListener('click',async()=>{
  if(mediaUI.busy)return;
  if(!state.project?.id){mediaFeedback('Tạo hoặc chọn một dự án trước để lưu công việc.','Error');return;}
  if(experience.status?.core.status!=='active'){mediaFeedback('AI Core đang tắt. Hãy kích hoạt an toàn trên máy local.','Error');return;}
  mediaUI.busy=true;$('#mediaQueueTask').disabled=true;
  try{
    if(mediaUI.mode==='edit-plan'&&($('#mediaAutoCaptions').checked||$('#mediaConcatProject').checked||$('#mediaNarrationText').value.trim()||$('#mediaQuickUseAudio').checked||$('#mediaQuickUseMusic').checked||$('#mediaQuickUseSubs').checked))
      throw new Error('“Chỉ lập kế hoạch” không tạo phụ đề, không chạy Concat, không ghép giọng/nhạc. Hãy bấm “Dựng MP4 theo mô tả” tại Bước 2 để những lựa chọn này thực sự được thực hiện.');
    const payload=mediaPayload();const task=await api('/api/integrations/media/tasks',{method:'POST',body:JSON.stringify({projectId:state.project.id,...payload})});
    mediaFeedback(`Tác vụ ${task.id.slice(0,8)} đã vào hàng đợi, chưa chạy. Xem bên phải và bấm Phê duyệt & chạy nếu phù hợp.`,'Success');
    await mediaRefreshJobs();
  }catch(e){mediaFeedback(e.message,'Error');}finally{mediaUI.busy=false;$('#mediaQueueTask').disabled=false;}
});
function mediaOperationLabel(operation){return ({'media.analyze':'Phân tích video','media.edit-plan':'Kế hoạch dựng','media.quick-edit':'Dựng MP4 theo yêu cầu','media.render':'Xuất MP4','media.subtitle-edit':'Chỉnh phụ đề','media.voiceover':'Thay giọng','media.tts-video':'Tạo video có giọng AI','media.image':'Tạo ảnh minh họa AI','media.concat-effects':'Hiệu ứng & xuất Concat','media.dub':'Lồng tiếng ngôn ngữ mới','media.retheme':'Đổi chủ đề & giọng đọc','media.effects':'Hiệu ứng video','media.story':'Video truyện','media.story-outline':'Storyboard','media.publish-draft':'Nháp đăng bài'})[operation]||operation;}
function mediaStateLabel(t){return ({queued:'Chờ duyệt',running:'Đang chạy',review:'Đang kiểm tra',completed:'Hoàn thành',blocked:'Bị chặn',failed:'Lỗi',paused:'Tạm dừng',cancelled:'Đã hủy'})[t.state]||t.state}
function mediaArtifactsFor(t){return mediaUI.artifacts.filter(a=>a.taskId===t.id)}
function mediaRenderJobs(){const host=$('#mediaJobs');if(!host)return;
  if(experience.status?.core.status!=='active'){host.innerHTML='<p class="insight-empty">AI Core chưa hoạt động. Các công việc hiện có trên đĩa không bị xóa.</p>';return;}
  const allHistory=!!$('#mediaShowAllHistory')?.checked;
  const list=[...mediaUI.tasks].reverse().filter(t=>!mediaUI.source||allHistory||t.input?.params?.source===mediaUI.source).slice(0,25);
  host.innerHTML=list.length?list.map(t=>{
    const canApprove=['queued','paused','blocked'].includes(t.state)&&t.input?.approved!==true;
    const art=mediaArtifactsFor(t);
    const video=t.state==='completed'?(art.find(a=>a.name==='concat-export.mp4')||art.find(a=>a.name==='video-with-ai-narration.mp4')||art.find(a=>a.name==='video-with-natural-voice.mp4')||art.find(a=>a.name==='final.mp4')):null;
    const brokenTimeline=t.state==='failed'&&t.input?.operation==='media.render'&&
      (['INVALID','MEDIA_PLAN_SOURCE','MEDIA_PLAN_RANGE'].includes(t.error?.code)||/Invalid clip|kh\u00f4ng kh\u1edbp video|v\u01b0\u1ee3t th\u1eddi l\u01b0\u1ee3ng/i.test(t.error?.message||''));
    const technicalOutput=t.state==='completed'&&['media.render','media.quick-edit'].includes(t.input?.operation);
    const sourceIsDemo=/^uploads\/sample-[\w-]+\.mp4$/.test(String(t.input?.params?.source||''));
    const outputNotice=technicalOutput?`<p class="mediaHint">${sourceIsDemo?'Đây là clip MẪU kỹ thuật, không phải sản phẩm đăng mạng xã hội. ':''}${t.input.operation==='media.render'?'Đây chỉ là xuất MP4 theo timeline: không chạy các tùy chọn Whisper/Concat/giọng/nhạc ở Bước 2. ':'Đã tạo tệp video; chỉ các chức năng có artifact tương ứng mới thực sự chạy. '}Hãy xem toàn bộ video và nghe âm thanh trước khi đăng. Trạng thái này KHÔNG chứng nhận nội dung đã đạt chất lượng thương mại.</p>`:'';
    const inputLabel=t.input?.params?.sourceLabel|| (sourceIsDemo?'Clip mẫu thử nghiệm':t.input?.params?.source||'Không có video nguồn');
    return `<article class="mediaJob${mediaUI.selectedJobId===t.id?' mediaJobSelected':''}" data-media-job="${esc(t.id)}"><div class="mediaJobTitle"><b>${esc(mediaOperationLabel(t.input?.operation||t.kind))}</b><span class="mediaJobBadge ${esc(t.state)}">${esc(canApprove?'Chờ phê duyệt':technicalOutput?'MP4 kỹ thuật xong':mediaStateLabel(t))}</span></div><small>ID ${esc(t.id.slice(0,8))} · ${esc(t.updatedAt||'')}</small><p class="mediaHint">Nguồn: ${esc(String(inputLabel))}</p>${t.input?.params?.planSummary?`<p class="mediaHint">🤖 Kế hoạch AI đạo diễn: ${esc(String(t.input.params.planSummary))}</p>`:''}${t.error?`<p class="mediaError">${esc(t.error.code||'Lỗi')}: ${esc(t.error.message||'')}</p>`:''}${outputNotice}
      <div class="mediaJobActions">${video?'<button data-job-act="preview">▶ Xem trước</button>':''}${canApprove?'<button data-job-act="approve">✓ Phê duyệt & chạy</button>':''}${['queued','running','paused','blocked'].includes(t.state)?'<button data-job-act="cancel">Hủy</button>':''}${!canApprove&&(t.state==='paused'||t.state==='blocked'&&t.error?.code!=='REVIEW_INSUFFICIENT')?'<button data-job-act="resume">Tiếp tục</button>':''}${brokenTimeline?'<button data-job-act="rebuild">D\u1ef1ng l\u1ea1i t\u1eeb video</button>':''}${t.state==='failed'&&!brokenTimeline?'<button data-job-act="retry">Thử lại</button>':''}${t.state==='completed'&&['media.edit-plan','media.quick-edit'].includes(t.input?.operation)?'<button data-job-act="use-timeline">Áp dụng timeline</button>':''}</div>

      ${art.length?`<div class="mediaArtifactLinks">${art.map(a=>`<a href="/api/integrations/media/artifacts/${encodeURIComponent(a.id)}" target="_blank" rel="noopener noreferrer" title="SHA-256: ${esc(a.sha256)}">↧ ${esc(a.name)} (${Math.round(a.size/1024)} KB)</a>`).join('')}</div>`:''}</article>`;
  }).join(''):`<p class="insight-empty">${mediaUI.source&&!allHistory?'Chưa có tác vụ cho video đang chọn. Tick “Hiện cả tác vụ của video khác” nếu cần xem lịch sử.':'Chưa có tác vụ media của dự án đang chọn. Tạo tác vụ ở bên trái rồi phê duyệt.'}</p>`;
}
async function mediaUseLatestPlan(silent=false){
  const plans=[...mediaUI.tasks].reverse().filter(t=>t.state==='completed'&&['media.edit-plan','media.quick-edit'].includes(t.input?.operation)&&mediaArtifactsFor(t).some(a=>a.name==='manifest.json'));
  const last=plans.find(t=>t.input?.params?.source===mediaUI.source);
  if(!last){if(!silent)mediaFeedback(plans.length?'K\u1ebf ho\u1ea1ch c\u0169 thu\u1ed9c video kh\u00e1c. H\u00e3y t\u1ea1o k\u1ebf ho\u1ea1ch m\u1edbi ho\u1eb7c ch\u1ecdn k\u1ebf ho\u1ea1ch c\u0169 t\u1eeb h\u00e0ng \u0111\u1ee3i.':'Ch\u01b0a c\u00f3 k\u1ebf ho\u1ea1ch ho\u00e0n t\u1ea5t cho video n\u00e0y.','Error');return;}
  try{await mediaJobAction(last,'use-timeline')}catch(e){if(!silent)mediaFeedback(e.message,'Error');}
}
$('#mediaUseLatestTimeline').addEventListener('click',()=>mediaUseLatestPlan());
async function mediaRefreshJobs(){
  if(!state.project?.id){mediaUI.tasks=[];mediaUI.artifacts=[];mediaUI.source='';mediaUI.sourceProjectId=null;mediaUI.sourceLabel='';mediaSourceRefresh();mediaRenderJobs();return;}
  const selectedProject=state.project.id;
  if(mediaUI.sourceProjectId!==selectedProject){mediaUI.source='';mediaUI.sourceLabel='';mediaUI.sourceProjectId=selectedProject;mediaClearPlanOnSourceChange();mediaSourceRefresh();}
  if(experience.status?.core.status!=='active'){mediaRenderJobs();return;}
  try{const id=encodeURIComponent(state.project.id);const [tasks,artifacts]=await Promise.all([api('/api/integrations/media/tasks?projectId='+id),api('/api/integrations/media/artifacts?projectId='+id)]);if(state.project?.id!==selectedProject)return;
    mediaUI.tasks=tasks;mediaUI.artifacts=artifacts;mediaUI.lastLoaded=Date.now();
    if(!mediaUI.source){const previous=[...tasks].reverse().find(t=>['media.analyze','media.edit-plan','media.quick-edit','media.render','media.voiceover','media.tts-video'].includes(t.input?.operation)&&typeof t.input?.params?.source==='string'&&t.input.params.source.startsWith('uploads/'));
      if(previous){mediaUI.source=previous.input.params.source;mediaUI.sourceLabel=previous.input?.params?.sourceLabel||(/\/sample-[\w-]+\.mp4$/.test(previous.input.params.source)?'clip mẫu kỹ thuật từ lịch sử':'video đã lưu của dự án');mediaSourceRefresh();}}
    mediaRenderJobs();mediaRenderPool();mediaAutoSelectJob();}
  catch(e){$('#mediaJobs').textContent='Không tải được hàng đợi: '+e.message;}
}
async function mediaJobAction(t,act){
  if(act==='rebuild'){
    const boundSource=t.input?.params?.source;
    if(!boundSource)throw new Error('T\u00e1c v\u1ee5 kh\u00f4ng c\u00f3 video ngu\u1ed3n; h\u00e3y n\u1ea1p video m\u1edbi.');
    mediaUI.source=boundSource;mediaUI.sourceProjectId=state.project?.id||null;
    mediaUI.sourceLabel='video g\u1ed1c c\u1ee7a t\u00e1c v\u1ee5 l\u1ed7i';mediaSourceRefresh();mediaClearPlanOnSourceChange();
    const old=t.input?.params?.editPlan||{};
    const hints=[old.ratio==='9:16'?'D\u1ef1ng video d\u1ecdc 9:16':old.ratio==='1:1'?'D\u1ef1ng video vu\u00f4ng 1:1':'D\u1ef1ng video ngang 16:9'];
    if(old.transition==='crossfade')hints.push('chuy\u1ec3n c\u1ea3nh m\u01b0\u1ee3t');
    if(old.effects?.includes('fade-in-out'))hints.push('th\u00eam hi\u1ec7u \u1ee9ng m\u1edd d\u1ea7n');
    $('#mediaPrompt').value=hints.join(', ');
    mediaSwitchMode('edit-plan');
    mediaFeedback('\u0110\u00e3 kh\u00f4i ph\u1ee5c video g\u1ed1c. B\u1ea5m D\u1ef1ng MP4 theo m\u00f4 t\u1ea3 r\u1ed3i ph\u00ea duy\u1ec7t t\u00e1c v\u1ee5 m\u1edbi.','Success');
    return;
  }
  if(act==='use-timeline'){
    const a=mediaArtifactsFor(t).find(x=>x.name==='manifest.json');if(!a)throw new Error('Chưa có manifest đã được kiểm chứng.');
    const raw=await fetch('/api/integrations/media/artifacts/'+encodeURIComponent(a.id));if(!raw.ok)throw new Error('Không tải được timeline');
    const j=await raw.json();const plan=j.timeline||j.edit;if(!plan)throw new Error('Manifest kh\u00f4ng c\u00f3 timeline');
    const boundSource=t.input?.params?.source;
    if(!boundSource)throw new Error('K\u1ebf ho\u1ea1ch ch\u01b0a c\u00f3 video ngu\u1ed3n. H\u00e3y d\u1ef1ng m\u1edbi.');
    if(boundSource!==mediaUI.source){
      if(!window.confirm('K\u1ebf ho\u1ea1ch n\u00e0y thu\u1ed9c video ngu\u1ed3n kh\u00e1c. Chuy\u1ec3n v\u1ec1 video g\u1ed1c c\u1ee7a k\u1ebf ho\u1ea1ch?'))return;
      mediaUI.source=boundSource;mediaUI.sourceLabel='video g\u1ed1c c\u1ee7a k\u1ebf ho\u1ea1ch';mediaUI.sourceProjectId=state.project?.id||null;mediaSourceRefresh();
    }
    mediaUI.planSource=boundSource;
    $('#mediaTimeline').value=JSON.stringify(plan,null,2);$('#mediaRenderReady').textContent=`Đã chọn kế hoạch ${plan.ratio} (${plan.origin==='provider-ai'?'AI':'quy tắc local'})`;mediaSwitchMode('render');
    mediaFeedback('Đã nạp timeline từ artifact có kiểm tra SHA-256; xem lại rồi tạo tác vụ render.','Success');return;
  }
  if(act==='preview'){await mediaSelectJob(t);return;}
  if(act==='approve'){
    const billable=(t.input?.params?.ttsProvider==='heygen'||t.input?.params?.narrationProvider==='heygen');
    const notice=billable?'Tác vụ này dùng HeyGen API theo lựa chọn của bạn và có thể phát sinh phí. Chỉ phê duyệt nếu bạn đồng ý.':'Dựng và tạo giọng local không cần HeyGen API. Tác vụ AI khác có thể dùng hạn mức model nếu đã chọn.';
    if(!window.confirm('Cho phép chạy tác vụ này? '+notice))return;
  }
  await api(`/api/integrations/media/tasks/${encodeURIComponent(t.id)}/${act}`,{method:'POST',body:'{}'});
  mediaFeedback(act==='approve'?'Đã phê duyệt. TaskQueue sẽ thực thi và lưu kết quả, bấm Làm mới để xem trạng thái.':`Đã gửi lệnh ${act}.`,'Success');
  await mediaRefreshJobs();
}
$('#mediaJobs').addEventListener('click',async event=>{
  const button=event.target.closest('[data-job-act]');if(!button)return;
  const parent=button.closest('[data-media-job]');const job=mediaUI.tasks.find(t=>t.id===parent?.dataset.mediaJob);if(!job)return;
  button.disabled=true;try{await mediaJobAction(job,button.dataset.jobAct)}catch(e){mediaFeedback(e.message,'Error')}finally{button.disabled=false;}
});
$('#mediaRefreshJobs').addEventListener('click',async()=>{await experienceRefresh();await mediaRefreshJobs()});
$('#mediaShowAllHistory').addEventListener('change',mediaRenderJobs);
document.addEventListener('project-change',()=>{void mediaRefreshJobs();void mediaPlannerRefresh()});
document.addEventListener('page-change',e=>{if(e.detail.page==='studio'){void mediaRefreshJobs();void mediaPlannerRefresh();}});
setInterval(()=>{if(!document.hidden&&$('#page-engines')?.classList.contains('active'))mediaRefreshJobs()},8000);
mediaSwitchMode('analyze');mediaSourceRefresh();mediaDirectorSourceRefresh();mediaRenderStatus();void mediaPlannerRefresh();

/* ===== CapCut-style stage, media pool and timeline (real data only) ===== */
mediaUI.selectedJobId=mediaUI.selectedJobId||null;
mediaUI.timeline=mediaUI.timeline||{duration:0,segments:[],outputName:'',sourceLabel:''};
function mediaArtifactUrl(a){return '/api/integrations/media/artifacts/'+encodeURIComponent(a.id)}
function mediaPickVideoArtifact(t){const art=mediaArtifactsFor(t);const pref=['video-with-new-voice.mp4','concat-export.mp4','video-with-ai-narration.mp4','video-with-natural-voice.mp4','final.mp4'];for(const name of pref){const hit=art.find(a=>a.name===name);if(hit)return hit;}return art.find(a=>/\.(mp4|mov|webm|m4v)$/i.test(a.name))||null;}
function mediaParseSrtCues(text){const cues=[];const blocks=String(text||'').replace(/\r\n/g,'\n').split(/\n\s*\n/);const toSec=v=>{const m=String(v).trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);return m?(+m[1])*3600+(+m[2])*60+(+m[3])+(+m[4])/1000:0;};for(const b of blocks){const lines=b.split('\n').filter(x=>x.trim());const ti=lines.findIndex(l=>l.includes('-->'));if(ti<0)continue;const [a,e]=lines[ti].split('-->').map(x=>x.trim());const start=toSec(a),end=toSec(e);if(end>start)cues.push({start,end,text:lines.slice(ti+1).join(' ')});}return cues;}
function mediaRenderPool(){const host=$('#mediaPool');if(!host)return;const arts=[...mediaUI.artifacts].filter(a=>/\.(mp4|mov|webm|m4v|mp3|wav|m4a|srt)$/i.test(a.name));if(!arts.length){host.innerHTML='<p class="mediaHint">Chưa có tệp media nào của dự án. Nạp video ở cột phải hoặc chờ tác vụ hoàn thành.</p>';return;}
  host.innerHTML=arts.slice(0,60).map(a=>{const icon=/\.(mp4|mov|webm|m4v)$/i.test(a.name)?'🎬':/\.srt$/i.test(a.name)?'▤':'🎵';const job=mediaUI.tasks.find(t=>t.id===a.taskId);return `<button type="button" class="mediaPoolItem${job&&mediaUI.selectedJobId===job.id?' active':''}" data-pool-artifact="${esc(a.id)}" title="${esc(a.name)} — SHA-256: ${esc(a.sha256||'')}">${icon}<span>${esc(a.name)}<br><small>${Math.round(a.size/1024)} KB${job?' · '+esc(mediaOperationLabel(job.input?.operation||job.kind)):''}</small></span></button>`;}).join('');}
async function mediaSelectJob(t,preferredArtifactId){
  if(!t)return;mediaUI.selectedJobId=t.id;
  const art=mediaArtifactsFor(t);const video=preferredArtifactId?art.find(a=>a.id===preferredArtifactId):mediaPickVideoArtifact(t);
  const player=$('#mediaMainPlayer'),empty=$('#mediaStageEmpty'),label=$('#mediaStageLabel');
  mediaUI.timeline={duration:0,segments:[],outputName:video?video.name:'',sourceLabel:t.input?.params?.sourceLabel||t.input?.params?.source||''};
  if(video&&player){player.src=mediaArtifactUrl(video);if(empty)empty.hidden=true;if(label)label.textContent=mediaOperationLabel(t.input?.operation||t.kind)+' · '+video.name+' ('+Math.round(video.size/1024)+' KB) — bấm Play để xem, bấm vào dòng thời gian để nhảy đoạn.';}
  else{if(player)player.removeAttribute?.('src');if(empty){empty.hidden=false;empty.textContent='Tác vụ này chưa có video kết quả để xem trước.';}if(label)label.textContent=mediaOperationLabel(t.input?.operation||t.kind)+' · chưa có video.';}
  mediaRenderTimeline();mediaRenderJobs();mediaRenderPool();
  try{
    const report=art.find(a=>a.name==='retheme-report.json')||art.find(a=>a.name==='dub-report.json');
    if(report){const r=await fetch(mediaArtifactUrl(report));if(r.ok){const j=await r.json();if(mediaUI.selectedJobId!==t.id)return;const segs=Array.isArray(j.segments)?j.segments.map(sg=>({start:Number(sg.start)||0,end:Number(sg.end)||0,text:String(sg.text||sg.targetText||sg.translatedText||'')})):[];mediaUI.timeline.segments=segs;mediaUI.timeline.duration=Number(j.videoSeconds)||Number(j.durationSeconds)||segs.reduce((m,sg)=>Math.max(m,sg.end),0);}}
    if(!mediaUI.timeline.segments.length){const srt=art.find(a=>/^captions-.*\.srt$/i.test(a.name))||art.find(a=>/\.srt$/i.test(a.name));if(srt){const r=await fetch(mediaArtifactUrl(srt));if(r.ok){const cues=mediaParseSrtCues(await r.text());if(mediaUI.selectedJobId!==t.id)return;mediaUI.timeline.segments=cues;mediaUI.timeline.duration=cues.reduce((m,c)=>Math.max(m,c.end),0);}}}
    if(!mediaUI.timeline.duration&&player&&player.duration&&isFinite(player.duration))mediaUI.timeline.duration=player.duration;
    mediaRenderTimeline();
  }catch{/* timeline stays with whatever real data was found */}
}
function mediaAutoSelectJob(){if(mediaUI.selectedJobId&&mediaUI.tasks.some(t=>t.id===mediaUI.selectedJobId))return;const candidate=[...mediaUI.tasks].reverse().find(t=>t.state==='completed'&&mediaPickVideoArtifact(t));if(candidate)void mediaSelectJob(candidate);}
function mediaTlFmt(sec){sec=Math.max(0,Math.round(sec));const m=Math.floor(sec/60),s2=sec%60;return m+':'+String(s2).padStart(2,'0');}
function mediaRenderTimeline(){const host=$('#mediaTimeline');if(!host)return;const tl=mediaUI.timeline;const note=$('#mediaTimelineNote');
  if(!tl.duration){host.innerHTML='<p class="mediaHint">Chưa có dữ liệu đoạn cho tác vụ đang chọn. Các tác vụ Đổi chủ đề / Lồng tiếng có báo cáo mốc giây sẽ hiện đầy đủ ở đây.</p>';if(note)note.textContent='Chưa có dữ liệu đoạn.';return;}
  const step=tl.duration<=30?5:tl.duration<=90?10:tl.duration<=300?30:60;const ticks=[];for(let x=0;x<=tl.duration;x+=step)ticks.push(x);if(ticks[ticks.length-1]<tl.duration)ticks.push(Math.round(tl.duration));
  const pct=v=>Math.max(0,Math.min(100,(v/tl.duration)*100));
  const segBlocks=tl.segments.map(sg=>`<div class="mediaTlBlock cap" data-tl-seek="${sg.start}" style="left:${pct(sg.start)}%;width:${Math.max(1.2,pct(sg.end)-pct(sg.start))}%" title="${esc(sg.text||'')}">${esc(sg.text||'đoạn')}</div>`).join('');
  host.innerHTML=`<div class="mediaTlInner"><div class="mediaTlRuler">${ticks.map(x=>`<span class="mediaTlTick" style="left:${pct(x)}%">${mediaTlFmt(x)}</span>`).join('')}<div class="mediaTlPlayhead"></div></div>
  <div class="mediaTlRow"><span class="mediaTlRowLabel">🎬 Hình ảnh</span><div class="mediaTlTrack"><div class="mediaTlBlock film" data-tl-seek="0" style="left:0%;width:100%" title="Video gốc">${esc(tl.sourceLabel||'Video gốc')}</div><div class="mediaTlPlayhead"></div></div></div>
  <div class="mediaTlRow"><span class="mediaTlRowLabel">T Phụ đề</span><div class="mediaTlTrack">${segBlocks||'<span class="mediaHint" style="padding:6px">Chưa có dữ liệu đoạn.</span>'}<div class="mediaTlPlayhead"></div></div></div>
  ${tl.outputName?`<div class="mediaTlRow"><span class="mediaTlRowLabel">✨ Kết quả</span><div class="mediaTlTrack"><div class="mediaTlBlock fx" data-tl-seek="0" style="left:0%;width:100%" title="Video kết quả">${esc(tl.outputName)}</div><div class="mediaTlPlayhead"></div></div></div>`:''}</div>`;
  if(note)note.textContent=tl.segments.length?tl.segments.length+' đoạn · tổng '+mediaTlFmt(tl.duration):'Tổng '+mediaTlFmt(tl.duration);
  mediaTlSyncPlayhead();
  void mediaTlFilmstrip();
}
function mediaTlSyncPlayhead(){const player=$('#mediaMainPlayer');const tl=mediaUI.timeline;if(!player||!tl.duration)return;const frac=Math.max(0,Math.min(1,(player.currentTime||0)/tl.duration));document.querySelectorAll('.mediaTlPlayhead').forEach(ph=>{ph.style.left=(frac*100)+'%';});}
(()=>{const player=$('#mediaMainPlayer');if(player&&player.addEventListener){player.addEventListener('timeupdate',mediaTlSyncPlayhead);player.addEventListener('seeked',mediaTlSyncPlayhead);player.addEventListener('loadedmetadata',()=>{if(!mediaUI.timeline.duration&&isFinite(player.duration)){mediaUI.timeline.duration=player.duration;mediaRenderTimeline();}});}})();
$('#mediaTimeline')?.addEventListener('click',e=>{const block=e.target.closest?.('[data-tl-seek]');const player=$('#mediaMainPlayer');const tl=mediaUI.timeline;if(block&&player){player.currentTime=Number(block.dataset.tlSeek)||0;player.play?.();return;}if(!tl.duration||!player)return;const track=e.target.closest?.('.mediaTlTrack');if(!track||!track.getBoundingClientRect)return;const rect=track.getBoundingClientRect();const frac=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));player.currentTime=frac*tl.duration;player.play?.();});
$('#mediaPool')?.addEventListener('click',e=>{const btn=e.target.closest?.('[data-pool-artifact]');if(!btn)return;const a=mediaUI.artifacts.find(x=>x.id===btn.dataset.poolArtifact);if(!a)return;const job=mediaUI.tasks.find(t=>t.id===a.taskId);if(job)void mediaSelectJob(job,/\.(mp4|mov|webm|m4v)$/i.test(a.name)?a.id:undefined);});

/* ===== AI director: one box, one plan, one approval ===== */
function mediaDirectorRenderFallback(reason){
  const host=$('#mediaDirectorPlan');if(!host)return;host.hidden=false;
  host.innerHTML=`<p class="mediaHint">${esc(reason||'AI đạo diễn chưa sẵn sàng.')}</p>
  <p><b>Bạn tự chọn cách làm — bấm một nút, biểu mẫu tương ứng sẽ mở ở cột phải:</b></p>
  <div class="mediaInline">
    <button type="button" class="ghost" data-director-route="retheme">🔁 Đổi chủ đề & giọng (giữ hình)</button>
    <button type="button" class="ghost" data-director-route="edit-plan">✦ Dựng lại / thêm phụ đề & hiệu ứng</button>
    <button type="button" class="ghost" data-director-route="voiceover">🎙 Thay giọng / lồng tiếng</button>
  </div>`;
}
function mediaDirectorRenderPlan(data){
  const host=$('#mediaDirectorPlan');if(!host)return;host.hidden=false;
  const plan=data.plan||{};const routed=data.routed||{};
  mediaUI.directorRouted=routed.operation?{operation:routed.operation,params:routed.params}:null;
  const steps=(plan.steps||[]).map(s=>`<li>${esc(s)}</li>`).join('');
  const warnings=[...(data.warnings||[])].map(w=>`<p class="mediaError">${esc(w)}</p>`).join('');
  const probe=data.probe?`<p class="mediaHint">AI đã xem video: dài ${esc(String(data.probe.seconds))} giây${data.probe.hasAudio?', có tiếng':', không có tiếng'}${data.probe.transcriptHeard?' — đã nghe được nội dung lời nói':''}.</p>`:'';
  host.innerHTML=`<p><b>🤖 AI hiểu thế này:</b> ${esc(plan.summary||'')}</p>${probe}
  ${steps?`<ol class="mediaDirectorSteps">${steps}</ol>`:''}${warnings}
  ${routed.operation?`<div class="mediaInline"><button type="button" class="primary" id="mediaDirectorAccept">Đúng ý — tạo tác vụ & chạy</button><button type="button" class="ghost" id="mediaDirectorDismiss">Chưa đúng ý</button></div><p class="mediaHint">Bấm “Đúng ý” sẽ tạo tác vụ ${esc(mediaOperationLabel(routed.operation))} và phê duyệt chạy ngay. Kết quả hiện ở khung xem trước + dòng thời gian.</p>`
  :`<div class="mediaInline"><button type="button" class="ghost" id="mediaDirectorDismiss">Để tôi tự chọn cách làm</button></div>`}`;
  const accept=$('#mediaDirectorAccept');
  if(accept)accept.addEventListener('click',mediaDirectorAccept);
  const dismiss=$('#mediaDirectorDismiss');
  if(dismiss)dismiss.addEventListener('click',()=>{host.hidden=true;mediaFeedback('Đã đóng kế hoạch. Bạn có thể gõ lại mong muốn rõ hơn, hoặc tự chọn chế độ ở cột trái.');});
}
async function mediaDirectorAccept(){
  const routed=mediaUI.directorRouted;if(!routed)return;
  if(!state.project?.id){mediaFeedback('Tạo hoặc chọn dự án trước.','Error');return;}
  const button=$('#mediaDirectorAccept');if(button)button.disabled=true;
  try{
    const params={...routed.params};
    if(params.source&&mediaUI.sourceLabel&&!params.sourceLabel)params.sourceLabel=mediaUI.sourceLabel.slice(0,160);
    const task=await api('/api/integrations/media/tasks',{method:'POST',body:JSON.stringify({projectId:state.project.id,operation:routed.operation,params})});
    await api(`/api/integrations/media/tasks/${encodeURIComponent(task.id)}/approve`,{method:'POST',body:'{}'});
    mediaFeedback('Đã tạo và phê duyệt tác vụ theo kế hoạch AI đạo diễn. Xem tiến độ ở cột phải; xong bấm ▶ Xem trước.','Success');
    await mediaRefreshJobs();
  }catch(e){mediaFeedback('Không tạo được tác vụ: '+e.message,'Error');if(button)button.disabled=false;}
}
$('#mediaDirectorGo')?.addEventListener('click',async()=>{
  if(!state.project?.id){mediaFeedback('Tạo hoặc chọn dự án trước khi dùng AI đạo diễn.','Error');return;}
  if(experience.status?.core.status!=='active'){mediaFeedback('AI Core chưa được bật.','Error');return;}
  const button=$('#mediaDirectorGo');button.disabled=true;
  const host=$('#mediaDirectorPlan');if(host){host.hidden=false;host.innerHTML='<p class="mediaHint">AI đang xem video và nghe nội dung để hiểu ý bạn… (video dài có thể mất tới một phút)</p>';}
  try{
    const wish=$('#mediaDirectorWish').value.trim();
    const data=await api('/api/integrations/media/director/plan',{method:'POST',body:JSON.stringify({projectId:state.project.id,source:mediaUI.source||'',wish,voiceProvider:$('#mediaDirectorVoice')?.value||'local'})});
    if(!data.available){mediaDirectorRenderFallback(data.reason);return;}
    mediaDirectorRenderPlan(data);
  }catch(e){mediaDirectorRenderFallback('Không gọi được AI đạo diễn: '+e.message);}
  finally{button.disabled=false;}
});
/* ===== Video templates: pick one, content in, run ===== */
async function mediaTemplatesLoad(){
  const grid=$('#mediaTemplateGrid');if(!grid)return;
  try{
    const data=await api('/api/integrations/media/templates');
    grid.innerHTML=(data.templates||[]).map(t=>`<button type="button" class="mediaTemplateCard" data-template="${esc(t.id)}"><span class="mediaTemplateIcon">${esc(t.icon||'🎬')}</span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></button>`).join('')||'<p class="mediaHint">Chưa có mẫu nào.</p>';
  }catch(e){grid.innerHTML='<p class="mediaHint">Không tải được danh sách mẫu: '+esc(e.message)+'</p>';}
}
$('#mediaTemplateGrid')?.addEventListener('click',async e=>{
  const card=e.target.closest?.('[data-template]');if(!card)return;
  const id=card.dataset.template;
  let tpl=null;try{const data=await api('/api/integrations/media/templates');tpl=(data.templates||[]).find(t=>t.id===id);}catch{}
  if(!tpl){mediaFeedback('Không đọc được mẫu đã chọn.','Error');return;}
  if(tpl.operation==='media.effects'){
    mediaSwitchMode('effects');
    $$('#mediaFxPanel input[type=checkbox]').forEach(c=>{c.checked=(tpl.effects||[]).includes(c.value);});
    mediaFeedback('Đã áp mẫu “'+tpl.name+'”: '+tpl.hint);return;
  }
  if(tpl.operation==='media.story'){
    mediaSwitchMode('story');
    const sel=$('#mediaStoryTransition');if(sel&&tpl.params?.transition)sel.value=tpl.params.transition;
    mediaFeedback('Đã áp mẫu “'+tpl.name+'”: '+tpl.hint);return;
  }
  if(!mediaUI.source){mediaFeedback('Mẫu “'+tpl.name+'” cần video: '+tpl.hint,'Error');return;}
  if(!state.project?.id){mediaFeedback('Tạo hoặc chọn dự án trước.','Error');return;}
  const host=$('#mediaDirectorPlan');if(host){host.hidden=false;host.innerHTML='<p class="mediaHint">Đang áp mẫu “'+esc(tpl.name)+'”…</p>';}
  try{
    const data=await api('/api/integrations/media/director/plan',{method:'POST',body:JSON.stringify({projectId:state.project.id,source:mediaUI.source||'',templateId:id})});
    mediaDirectorRenderPlan(data);
    mediaFeedback('Mẫu “'+tpl.name+'”: '+tpl.hint);
  }catch(err){mediaFeedback('Không áp được mẫu: '+err.message,'Error');}
});
mediaTemplatesLoad();

$('#mediaDirectorPlan')?.addEventListener('click',e=>{
  const btn=e.target.closest?.('[data-director-route]');if(!btn)return;
  mediaSwitchMode(btn.dataset.directorRoute);
  mediaFeedback('Đã mở chế độ tương ứng ở cột phải. Điền biểu mẫu rồi bấm Tạo tác vụ.');
});

/* Concat-style filmstrip: draw real frames from the current preview video
 * into the video lane of the timeline. Purely cosmetic; failures are silent. */
let mediaFilmstripFor='';
async function mediaTlFilmstrip(){
  if(typeof document==='undefined'||!document.querySelector)return;
  const block=document.querySelector('.mediaTlBlock.film');const player=$('#mediaMainPlayer');
  if(!block||!player||!player.currentSrc)return;
  const src=player.currentSrc;if(mediaFilmstripFor===src)return;mediaFilmstripFor=src;
  try{
    const v=document.createElement('video');v.muted=true;v.preload='auto';v.src=src;v.crossOrigin='anonymous';
    await new Promise((res,rej)=>{v.addEventListener('loadedmetadata',res,{once:true});v.addEventListener('error',rej,{once:true});});
    const dur=v.duration;if(!isFinite(dur)||dur<=0)return;
    const strip=document.createElement('canvas');strip.width=720;strip.height=44;const ctx=strip.getContext('2d');
    const n=8,w=strip.width/n;
    for(let i=0;i<n;i++){
      await new Promise(res=>{v.addEventListener('seeked',res,{once:true});v.currentTime=Math.min(dur-0.05,(i+0.5)*dur/n);setTimeout(res,900);});
      try{ctx.drawImage(v,i*w,0,w,strip.height);}catch{}
    }
    block.style.backgroundImage=`url(${strip.toDataURL('image/jpeg',0.72)})`;
    block.classList.add('hasStrip');
  }catch{/* filmstrip is decoration only */}
}
/* Transport bar + open-in-Concat */
(()=>{
  const player=$('#mediaMainPlayer');if(!player)return;
  const fmt=t=>{t=Math.max(0,Math.floor(t||0));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
  const timeEl=$('#mediaTpTime'),playBtn=$('#mediaTpPlay');
  const sync=()=>{if(timeEl)timeEl.textContent=fmt(player.currentTime)+' / '+fmt(player.duration);if(playBtn)playBtn.textContent=player.paused?'▶':'⏸';};
  player.addEventListener('timeupdate',sync);player.addEventListener('play',sync);player.addEventListener('pause',sync);player.addEventListener('loadedmetadata',sync);
  playBtn?.addEventListener('click',()=>{if(player.paused)void player.play();else player.pause();});
  $('#mediaTpBack')?.addEventListener('click',()=>{player.currentTime=Math.max(0,player.currentTime-5);});
  $('#mediaTpFwd')?.addEventListener('click',()=>{player.currentTime=Math.min(player.duration||1e9,player.currentTime+5);});
  $('#mediaOpenConcat')?.addEventListener('click',async()=>{
    const note=$('#mediaConcatNote');
    if(!mediaUI.source){mediaFeedback('Chưa có video nguồn. Nạp video ở mục Phân tích hoặc chọn một tác vụ có video nguồn trước.','Error');return;}
    const btn=$('#mediaOpenConcat');btn.disabled=true;
    try{
      const r=await api('/api/integrations/media/concat/open',{method:'POST',body:JSON.stringify({source:mediaUI.source})});
      if(note){note.hidden=false;note.textContent='🐱 '+r.note+' Project: '+r.projectPath;}
      mediaFeedback('Đã tạo project Concat "'+r.projectName+'" từ video đang chọn.','Success');
    }catch(e){mediaFeedback('Mở trong Concat chưa được: '+(e.message||e),'Error');}
    finally{btn.disabled=false;}
  });
})();
