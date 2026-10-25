const issue=(code,message)=>Object.assign(new Error(message),{code});
/** Local checks only: never installs tools, calls a paid voice, or changes a provider. */
export function productionCapabilities(host){
 const s=host.status(),m=s.media||{};
 const voices=[
  {id:'windows',label:'Windows - giọng Việt đã cài',ready:!!m.windowsTts?.ready,paid:false},
  {id:'local',label:'Piper local (optional)',ready:!!m.localTts?.ready,paid:false},
  {id:'kokoro',label:'Kokoro local - English only',ready:false,paid:false,reason:'Vietnamese narration requires a Vietnamese voice.'},
  {id:'heygen',label:'HeyGen API (tính phí theo tài khoản)',ready:!!m.heygenOptionalConfigured,paid:true},
  {id:'fpt',label:'FPT API (tính phí theo tài khoản)',ready:!!m.fptOptionalConfigured,paid:true},
 ];
 const ready=!!m.ffmpeg&&!!m.ffprobe&&m.status==='available';
 return {videoReady:ready,voices,windowsVoices:m.windowsTts?.voices||[],windowsVoiceId:m.windowsTts?.voiceId||null,windowsSpeech:m.windowsTts||{},localSpeech:m.localTts||{},voiceDiagnostics:{windows:m.windowsTts?.reason||null,piper:m.localTts?.reason||null,piperSource:m.localTts?.discoveredFrom||null},concat:m.concat||{},images:m.images||{available:false,routes:[]},captionOnly:{ready,narration:false},defaultVoice:voices.find(v=>v.ready&&!v.paid)?.id||null,checks:{core:s.core?.status||'unknown',ffmpeg:!!m.ffmpeg,ffprobe:!!m.ffprobe},message:ready?'Có thể dựng video. Chọn giọng đọc hoặc chủ động chọn video chữ không lời đọc.':'Cần FFmpeg và FFprobe trên Local Worker. Có Local Worker không đồng nghĩa đã cài giọng đọc.'};
}
export function assertProductionReady(host,pipeline,input={}){
 if(['news-article','client-article'].includes(pipeline))return;
 const c=productionCapabilities(host);
 if(input.renderEngine&&!['concat','ffmpeg'].includes(input.renderEngine))throw issue('MEDIA_INPUT','Unknown renderer');
 if(!c.videoReady)throw issue('MEDIA_DEPENDENCY','Local Worker chua san sang FFmpeg/FFprobe. Mo Engine Hub > Kiểm tra moi truong; khong tao luot loi rong.');
 if(input.voiceMode==='captions'){
  if(pipeline==='dub-video')throw issue('MEDIA_VOICE_MODE','Long tieng can giong doc; khong thay bang video chu.');
  return;
 }
 if(input.renderEngine==='concat'&&!c.concat?.configured)throw issue('BLOCKED_CONCAT','Concat chua duoc ket noi. Bam Ket noi Concat ngay trong bang tiep nhan; khong tao anh mat phi truoc khi editor san sang.');
 const requested=input.ttsProvider||c.defaultVoice;
 const voice=c.voices.find(v=>v.id===requested&&v.ready);
 if(!voice)throw issue('MEDIA_VOICE_REQUIRED','Chưa có giọng đọc phù hợp. Cài Piper/giọng Windows tiếng Việt hoặc chủ động chọn Video chữ - không lời đọc. Không tự chuyển sang API trả phí.');
 if(voice.paid&&input.confirmPaidVoice!==true)throw issue('MEDIA_PAID_CONSENT','Cần đồng ý sử dụng hạn mức/chi phí của giọng API đã chọn.');
 if(input.visualMode!==undefined){
  if(!['ai','uploads','procedural'].includes(input.visualMode))throw issue('MEDIA_IMAGE_MODE','Chon nguon anh minh hoa hop le.');
  if(input.visualMode==='uploads'&&(!Array.isArray(input.imageSources)||!input.imageSources.length))throw issue('MEDIA_IMAGE_REQUIRED','Tai anh minh hoa truoc khi chot video.');
  if(input.visualMode==='ai'){
   const selected=input.imageProvider||'auto';
   // Free local generation does not require the paid-image checkbox.
   // Explicit paid routes always do, regardless of the generic quota flag.
   if(['openai-api','gemini-api'].includes(selected)&&input.confirmPaidImages!==true)
     throw issue('MEDIA_IMAGE_CONSENT','Nguồn ảnh API có phí cần đồng ý chi phí riêng trước khi tạo.');
   const freeCandidates=(c.images.candidates||[]).filter(x=>x.paid===false);
   if(selected==='auto'&&input.confirmPaidImages!==true&&!freeCandidates.length)
     throw issue('MEDIA_IMAGE_REQUIRED','Chưa có công cụ ảnh miễn phí sẵn sàng. Cài ComfyUI/FLUX local hoặc chủ động duyệt API ảnh có phí.');
   if(selected!=='local-flux'&&!c.images.available&&!c.images.configured)throw issue('MEDIA_IMAGE_REQUIRED','Chua co ket noi co kha nang tao anh. Tai anh cua ban hoac cau hinh AI tao anh.');
   if(selected!=='auto'&&selected!=='local-flux'&&!c.images.routes.includes(selected)&&!c.images.configured)throw issue('MEDIA_IMAGE_REQUIRED','Nguon anh da chon chua duoc ket noi.');
  }
 }

}

/** One-click reception contract. Concat edits/exports; TTS is independently
 * synthesized by the configured Windows/Piper provider before adding a track.
 * Never infer a paid-provider authorization from the news-card click. */
export function automaticProductionPlan(host,pipeline,{imageSources=[],defaultVoice=null}={}){
 if(['news-article','client-article'].includes(pipeline))return {kind:'article',renderEngine:null,note:'Bài viết; không yêu cầu TTS/Concat.'};
 const c=productionCapabilities(host);
 if(!c.videoReady)throw issue('MEDIA_DEPENDENCY','FFmpeg/FFprobe chưa sẵn sàng. Kiểm tra Engine Hub trước khi giao video.');
 const selected=defaultVoice&&c.voices.some(v=>v.id===defaultVoice&&v.ready&&!v.paid)?defaultVoice:c.defaultVoice;
 if(!selected)throw issue('MEDIA_VOICE_REQUIRED','Bộ dựng FFmpeg/FFprobe đã sẵn sàng, nhưng chưa có giọng đọc tiếng Việt miễn phí. Concat dựng hình/âm thanh đã có, không cung cấp giọng TTS qua API này. Cài giọng Windows tiếng Việt hoặc Piper rồi kiểm tra lại; không tự dùng API trả phí hay xuất video câm.');
 const uploaded=Array.isArray(imageSources)?imageSources.filter(v=>typeof v==='string'&&/^uploads\/[a-f0-9-]+\.(png|jpe?g|webp)$/i.test(v)).slice(0,24):[];
 const free=(c.images?.candidates||[]).filter(x=>x.paid===false);
 if(!uploaded.length&&!free.length)throw issue('MEDIA_IMAGE_REQUIRED','Chưa có ảnh minh họa được cấp phép hoặc engine ảnh miễn phí sẵn sàng. Kết nối FLUX/ComfyUI hoặc tải ảnh vào Media Studio trước khi thử lại.');
 const renderEngine=c.concat?.configured?'concat':'ffmpeg';
 return {kind:'video',voiceMode:'narrated',ttsProvider:selected,renderEngine,effects:'gentle',visualMode:uploaded.length?'uploads':'ai',imageProvider:'auto',imageSources:uploaded,confirmImageQuota:false,confirmPaidImages:false,confirmPaidVoice:false,
  note:renderEngine==='concat'?'Concat đã cấu hình; TTS tự lấy từ giọng Việt sẵn sàng, phụ đề tự sinh theo audio.':'Concat chưa cấu hình: FFmpeg được chọn minh bạch để dựng MP4 có tiếng và phụ đề. Không gọi đây là Concat.'};
}
