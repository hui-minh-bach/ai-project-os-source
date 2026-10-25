/* R9: manager reception is an artifact inbox, not a media-configuration form.
 * The click on an item in Radar explicitly starts one automatic workflow.
 * Logs display real persisted events, never invented agent conversations.
 */
(()=>{
 const parent=document.querySelector('.idea-founder');if(!parent)return;
 const box=document.createElement('section');box.id='workCenter';box.className='work-center';parent.querySelector('#ideaError').after(box);
 const products=document.createElement('section');products.id='workProducts';products.className='work-products';box.before(products);
 const oldProducts=document.getElementById('deliveryProducts');if(oldProducts)oldProducts.hidden=true;
 const cloud=document.getElementById('deliveryPanel');if(cloud){const d=document.createElement('details');d.className='work-cloud';d.innerHTML='<summary>Triển khai website / Cloud (riêng biệt)</summary>';cloud.before(d);d.append(cloud);}
 let latest=null,pid=null,inFlight=false,seq=0,polling=false,signature='',productSignature='';const completed=new Map();
 const html=s=>esc(String(s??''));
 const status={queued:'Đang xếp việc',running:'Đang thực hiện',completed:'Đã thực hiện',failed:'Cần xử lý lỗi',interrupted:'Bị gián đoạn',todo:'Chờ việc',preparing:'Chuẩn bị',testing:'Kiểm thử',reviewing:'Kiểm tra',merging:'Hợp nhất',done:'Hoàn thành','awaiting-approval':'Đã có file, chờ tiếp nhận',received:'Đã bàn giao',produced:'Đã xuất file','product-ready':'Đã có sản phẩm'};
 const phase={"ai.script":"AI biên kịch",'ai.review':'AI kiểm tra kịch bản','media.story':'Media AI dựng hình/giọng/phụ đề','media.caption-video':'Media AI dựng video chữ','produce.music':'Media AI kiểm tra nhạc','produce.story':'Media AI xuất video','produce.caption':'Media AI xuất video','gate':'Trưởng phòng kiểm tra file','publish':'Xuất bản','metrics':'Báo cáo','project':'Trưởng phòng mở dự án'};
 const safeLink=s=>{try{const u=new URL(s);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
 const active=j=>['queued','running'].includes(j?.state);
 const person=b=>{if(!b)return 'Chưa gắn AI';const c=(state.connections||[]).find(x=>x.id===b.connectionId);return (c?.name||b.connectionId)+' / '+b.model;};
 const iso=s=>{try{return s?new Date(s).toLocaleString('vi-VN'):'';}catch{return ''}};
 function render(r){
  latest=r;window.updateProjectConversation?.(r?.projectId||state.project?.id,r?.conversation||[]);
  let out='<div class="work-inbox-header"><div><h3>Theo dõi dự án</h3><p class="muted">Giao một yêu cầu tại khung phía trên hoặc chọn tin ở Radar. Đội AI tự phân việc, kiểm tra và giao file có thật ở đây.</p></div><button type="button" class="ghost" data-wc="refresh">Làm mới</button></div>';
  if(!state.project){box.innerHTML=out+'<p>Chưa chọn dự án. Hãy chọn tin hoặc nhập ý tưởng.</p>';return;}
  const roles=r?.roles?.roles||{},teams=r?.roles?.teams||{},job=r?.job,pr=r?.request,sp=r?.specification;
  const groups=[['founder','Trưởng phòng'],['worker','Đội thực hiện'],['reviewer','Đội kiểm tra']];
  out+='<div class="work-roles">'+groups.map(([key,label])=>'<div><small>'+label+'</small><b>'+((teams[key]||[roles[key]]).filter(Boolean).map(x=>html(person(x))).join('<br>')||'Chưa phân công')+'</b></div>').join('')+'</div>';
  if(pr){out+='<div class="work-request"><h4>'+html(pr.title)+'</h4><p>'+html(['news-article','client-article'].includes(pr.pipeline)?'Bài viết đã kiểm tra nội dung':'Video MP4 có lời đọc và phụ đề')+' · AI tự dùng giọng Windows/Piper đã cấu hình và bộ dựng sẵn sàng</p>';
   const url=safeLink(pr.sourceUrl);if(url)out+='<a target="_blank" rel="noopener noreferrer" href="'+html(url)+'">Xem nguồn tin</a>';
   out+='</div>';
  }
  if(job)out+='<div class="work-receipt" role="status"><strong>'+html(status[job.state]||job.state)+'</strong><small>Việc: '+html(job.action==='auto-produce'?'Phân việc và sản xuất tự động':job.action)+' · '+html(iso(job.updatedAt))+'</small>'+(job.result?.note?'<p class="muted">'+html(job.result.note)+'</p>':'')+(job.error?'<p class="work-error" role="alert">'+html(job.error.code||'Lỗi')+': '+html(job.error.message)+'</p>':'')+'</div>';
  if(['MEDIA_VOICE_REQUIRED','BLOCKED_LOCAL_TTS','BLOCKED_WINDOWS_TTS'].includes(job?.error?.code))out+='<div class="work-request"><strong>Thiếu giọng đọc, không phải lỗi bộ dựng video</strong><p>FFmpeg/Concat dựng video từ ảnh và audio. Để tạo lời đọc tiếng Việt, cần cài giọng Windows hoặc Piper.</p><button type="button" class="ghost" data-wc="voice-setup">Cài / kiểm tra giọng Việt</button><button type="button" class="ghost" data-wc="voice-refresh">Kiểm tra Local Worker và tiếp tục</button></div>';
  const jobs=r?.jobs||[];
  const runs=r?.runs||[];
  const process=(r?.feed||[]).map(e=>({at:e.at,label:e.actor||'Đội AI',description:e.text||'',detail:e.state==='failed'?e.text:null}));
  if(!r?.feed)for(const run of runs){
   for(const item of run.steps||[]){const at=item.at||item.time||null,step=item.step||item.name||item.stage||item.type||'Bước xử lý';const stat=item.status||item.state||'đã ghi';
    process.push({at,label:phase[step]||step,description:stat,record:item});}
   if(run.error)process.push({label:'Bộ kiểm thử',description:run.error.code||'Lỗi',detail:run.error.message,at:run.updatedAt});
  }
  for(const j of jobs.slice(0,5))process.push({at:j.updatedAt,label:j.action==='auto-produce'?'Trưởng phòng tự phân việc':'Trưởng phòng tiếp nhận',description:status[j.state]||j.state,detail:j.error?.message||''});
  process.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  out+='<details class="work-events"><summary>Nhật ký kỹ thuật ('+process.length+' sự kiện thực tế)</summary>';
  out+=process.length?'<ol>'+process.slice(0,45).map(e=>'<li><b>'+html(e.label)+'</b> · '+html(e.description)+(e.at?'<small>'+html(iso(e.at))+'</small>':'')+(e.detail?'<p class="work-error">'+html(e.detail)+'</p>':'')+'</li>').join('')+'</ol>':'<p class="muted">Chưa có sự kiện. Không tạo hội thoại AI giả.</p>';
  out+='</details>';
  if(r?.tasks?.length){const finished=r.tasks.filter(x=>x.status==='done').length;out+='<details class="work-events"><summary>Tiến độ tạo phần mềm ('+finished+'/'+r.tasks.length+')</summary><ol>'+r.tasks.map(t=>'<li><b>'+html(t.title)+'</b> · '+html(status[t.status]||t.status)+'<small>'+html(person(t.worker))+'</small>'+(t.error?'<p class="work-error">'+html(t.error)+'</p>':'')+'</li>').join('')+'</ol></details>';}
  if(pr&&!active(job)&&(!runs.some(x=>['awaiting-approval','completed'].includes(x.state))))out+='<button class="primary" data-wc="auto-produce" type="button">'+(job?.state==='failed'?'Kiểm tra kết nối và thử lại':'Bắt đầu tự động từ tin này')+'</button><p class="muted">Không tự dùng API ảnh/giọng có phí. Thiếu kết nối sẽ báo đúng nguyên nhân.</p>';
  else if(!pr&&sp?.status==='pending')out+='<div class="work-spec"><h4>Phê duyệt phạm vi trước khi chạy code</h4><p>'+html(sp.specification?.title||'')+'</p><p class="muted">Chạy trong Docker cách ly; không cấp quyền chạy lệnh trên máy chủ.</p><button class="primary" data-wc="approve">Duyệt và giao đội thực hiện</button></div>';
  else if(!pr&&sp?.status==='approved'&&r?.tasks?.some(t=>t.status!=='done')&&!active(job))out+='<button class="primary" data-wc="run">Tiếp tục các công việc đã duyệt</button>';
  else if(!pr&&!sp&&!active(job))out+='<button class="primary" data-wc="prepare">Chuyển ý tưởng thành kế hoạch</button>';
  if(pr&&runs.some(x=>x.state==='failed')&&!active(job))out+='<p class="muted">Lượt sản xuất đã lỗi: xem thông báo ở trên. Không xuất preview thay file hoàn thành.</p>';
  out+='<details class="work-events"><summary>Thiết lập hệ thống một lần (khi thiếu kết nối)</summary><p class="muted">Cấu hình TTS trong Media Studio / Giọng Việt; kết nối Concat trong Media Studio; kết nối AI tạo ảnh ở Kết nối. Phần này không nằm trong thao tác giao việc hằng ngày.</p><button type="button" class="ghost" data-wc="voice-setup">Cấu hình giọng Việt</button><button type="button" class="ghost" data-wc="go-media">Mở Media Studio</button><button type="button" class="ghost" data-wc="go-connections">Mở Kết nối AI</button></details>';
  box.innerHTML=out;
 }
 function renderProducts(data){
  const items=data?.products||[];let out='<h3>Kết quả dự án</h3><p class="muted">Chỉ tệp đã được lưu từ thao tác thật; chưa tạo xong sẽ không xuất hiện ở đây.</p>';
  if(!items.length)out+='<div class="empty">Chưa có tệp hoàn thành. Khi bước sản xuất tạo được file, hệ thống tự hiển thị ở đây.</div>';
  for(const p of items){const link=String(p.download||'').startsWith('/api/')?p.download:null;
   out+='<article class="work-product work-inbox-file"><div class="work-file-meta"><strong>'+html(p.name||p.title||p.kind)+'</strong><span>'+html(({video:'Video',audio:'Giọng đọc',captions:'Phụ đề',image:'Ảnh minh họa',article:'Bài viết',source:'Mã nguồn',website:'Website',document:'Kịch bản',bundle:'Gói file giao khách'})[p.kind]||p.kind)+(p.bytes?' · '+(p.bytes/1048576).toFixed(2)+' MB':'')+' · '+html(iso(p.at))+'</span></div>';
   if(p.simulated)out+='<p class="work-error">BẢN MÔ PHỎNG, KHÔNG PHẢI SẢN PHẨM THẬT</p>';
   if(p.kind==='video'&&link)out+='<video controls playsinline preload="metadata" src="'+html(link)+'"></video>';
   if(p.kind==='audio'&&link)out+='<audio controls preload="metadata" src="'+html(link)+'"></audio>';
   if(p.kind==='image'&&link)out+='<img loading="lazy" src="'+html(link)+'" alt="'+html(p.name||'Ảnh trong dự án')+'">';
   if(p.kind==='article')out+='<details><summary>Xem nội dung</summary><pre>'+html(p.body||'')+'</pre><pre>'+html(p.caption||'')+'</pre></details>';
   if(p.kind==='website'&&safeLink(p.url))out+='<a href="'+html(safeLink(p.url))+'" target="_blank" rel="noopener noreferrer">Mở website</a>';
   if(p.kind==='website'&&typeof p.qr==='string'&&p.qr.startsWith('/api/'))out+='<img class="work-qr" src="'+html(p.qr)+'" alt="Mã QR mở website đã bàn giao"><a class="work-download" href="'+html(p.qr)+'" download="website-qr.svg">Tải mã QR</a>';
   if(link)out+='<a class="work-download" download="'+html(p.name||'')+'" href="'+html(link)+'">Tải file</a>';
   if(p.kind==='source')out+='<p class="muted">'+html(p.tested?'Source có biên bản kiểm thử; cần nghiệm thu trên môi trường đích.':'Source đã review nhưng chưa có kiểm thử đích.')+'</p>';
   out+='</article>';
  }
  if(data?.artifactError)out+='<p class="work-error">Không thể kiểm tra kho tệp: '+html(data.artifactError)+'</p>';
  products.innerHTML=out;
 }
 async function refresh(){
  if(polling||document.hidden||!document.querySelector('#page-idea.active'))return;
  const current=state.project?.id;if(!current){pid=null;render(null);renderProducts(null);return;}
  if(current!==pid){pid=current;signature='';productSignature='';latest=null;}
  const token=++seq;polling=true;
  try{
   const [r,prods]=await Promise.all([api('/api/projects/'+current+'/work-center'),api('/api/projects/'+current+'/products')]);
   if(token!==seq||current!==state.project?.id)return;
   const sig=JSON.stringify(r);if(sig!==signature){signature=sig;render(r);}
   const pSig=JSON.stringify({...prods,at:null});if(pSig!==productSignature){productSignature=pSig;renderProducts(prods);}
   const j=r.job;if(j&&!active(j)&&completed.get(current)!==j.id+j.updatedAt){completed.set(current,j.id+j.updatedAt);if(document.getElementById('globalProjectSelect')?.value===current)await chooseProject(current);}
  }catch(e){if(token!==seq)return;box.innerHTML='<p class="work-error">'+html(e.message)+'</p><button class="ghost" data-wc="refresh">Kết nối lại</button>';products.innerHTML='';}
  finally{polling=false;}
 }
 async function submit(action,input={}){
  if(!state.project?.id)throw new Error('Chưa có dự án.');
  const bytes=crypto.getRandomValues(new Uint8Array(16)),key=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  const r=await api('/api/projects/'+state.project.id+'/work-center',{method:'POST',body:JSON.stringify({action,input,key})});signature='';await refresh();return r;
 }
 const voiceErrors=new Set(['MEDIA_VOICE_REQUIRED','BLOCKED_LOCAL_TTS','BLOCKED_WINDOWS_TTS']);
 const voiceContext=()=>({projectId:state.project?.id,requestId:latest?.request?.id,jobId:latest?.job?.id});
 async function refreshVoiceAndContinue(context,message){
  message.textContent='Đang nhận lại Local Worker và thử tạo giọng Việt thật...';
  const c=await api('/api/production/refresh',{method:'POST',body:JSON.stringify({testVoice:true})});
  if(!c.defaultVoice){message.textContent='Chưa có giọng Việt dùng được. '+(c.voiceDiagnostics?.piper==='voice-engine-unavailable'?'Đã thấy cấu hình/model nhưng chương trình Piper chưa chạy được. ':'')+'Bộ dựng, thợ ảnh và thợ nhạc được kiểm tra riêng; chỉ bổ sung giọng khi thật sự thiếu.';return c;}
  message.textContent='Đã nhận giọng '+(c.defaultVoice==='local'?'Piper local':'Windows tiếng Việt')+'.';
  if(!context.projectId||!context.requestId||context.projectId!==state.project?.id)return c;
  const current=await api('/api/projects/'+context.projectId+'/work-center');
  if(current.request?.id!==context.requestId||current.job?.id!==context.jobId||current.job?.state!=='failed'||!voiceErrors.has(current.job?.error?.code))return c;
  if(context.projectId!==state.project?.id)return c;
  message.textContent+=' Đang tiếp tục đúng việc bị chặn; không tạo đơn hàng mới.';
  await api('/api/projects/'+context.projectId+'/work-center',{method:'POST',body:JSON.stringify({action:'auto-produce',input:{requestId:context.requestId,fromReception:true},key:'voice_resume_'+context.jobId})});
  signature='';await refresh();return c;
 }
 // Same setup action in reception and Media Studio; no download if an installed voice works.
 async function voiceSetup(){
  const context=voiceContext();
  const c=await api('/api/production/refresh',{method:'POST',body:'{}'});
  const st=await api('/api/production/voice/setup');
  const known=c.defaultVoice?'Đã nhận '+(c.defaultVoice==='local'?'Piper local':'Windows tiếng Việt')+' trên máy. Có thể tiếp tục, không cần cài lại.':'App đã kiểm tra mới bộ dựng và giọng đọc. Nếu đã cài Piper, app tự tìm trong thư mục do app quản lý; bản ở nơi khác có thể chọn bên dưới.';
  modal('<h2>Kiểm tra Local Worker / giọng Việt</h2><p id="wcVoiceDetected">'+html(known)+'</p><button id="wcVoiceContinue" '+(c.defaultVoice?'':'disabled')+'>Dùng giọng đã có và tiếp tục</button><details '+(c.defaultVoice?'':'open')+'><summary>Bổ sung giọng Việt khi còn thiếu</summary><p>Giọng Windows/Piper tạo lời đọc; FLUX tạo ảnh; ACE-Step tạo nhạc; FFmpeg/Concat dựng video. Các khả năng được kiểm tra riêng.</p><p>Chỉ tải engine/model khi đồng ý. Chữ ký mã của engine Piper chưa được xác nhận.</p><label><input type="checkbox" id="wcVoiceInstallConsent"> Cho phép tải và chạy Piper trên Windows x64</label><button id="wcVoiceInstall" '+(!c.defaultVoice&&st.available&&st.state!=='running'?'':'disabled')+'>Cài giọng Việt còn thiếu và tiếp tục</button></details><details><summary>Piper đã cài ở thư mục khác</summary><label>Đường dẫn piper.exe<input id="wcPiperCli"></label><label>Model .onnx<input id="wcPiperModel"></label><label>Config .json<input id="wcPiperConfig"></label><button id="wcVoiceSave">Kiểm tra và dùng bản đã cài</button></details><p id="wcVoiceSetupStatus" role="status"></p>');
  const msg=document.getElementById('wcVoiceSetupStatus');if(st.state==='running')msg.textContent='Piper đang cài đặt: '+st.phase;
  async function finish(){const c=await refreshVoiceAndContinue(context,msg);const button=document.getElementById('wcVoiceContinue');if(button)button.disabled=!c.defaultVoice;}
  document.getElementById('wcVoiceContinue').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{await finish();}catch(err){msg.textContent=err.message;}finally{if(b.isConnected)b.disabled=false;}};
  document.getElementById('wcVoiceInstall').onclick=async e=>{if(!document.getElementById('wcVoiceInstallConsent').checked){msg.textContent='Cần đồng ý trước khi cài.';return;}const b=e.currentTarget;b.disabled=true;msg.textContent='Đang bổ sung giọng Việt; giữ nguyên các worker đã cài.';try{await api('/api/production/voice/install',{method:'POST',body:JSON.stringify({confirm:true,acceptEngineTrust:true})});await finish();}catch(err){msg.textContent=err.message;}finally{if(b.isConnected)b.disabled=false;}};
  document.getElementById('wcVoiceSave').onclick=async e=>{if(!confirm('Cho phép chạy Piper tại đường dẫn vừa nhập để kiểm tra?'))return;const b=e.currentTarget;b.disabled=true;try{await api('/api/production/voice/configure',{method:'POST',body:JSON.stringify({confirm:true,cli:document.getElementById('wcPiperCli').value.trim(),model:document.getElementById('wcPiperModel').value.trim(),config:document.getElementById('wcPiperConfig').value.trim()})});await finish();}catch(err){msg.textContent=err.message;}finally{if(b.isConnected)b.disabled=false;}};
 }
 window.showLocalVoiceSetup=voiceSetup;
 window.workCenterRefresh=()=>{signature='';refresh();};
 window.workCenterStart=async()=>{const p=await ideaEnsureProject();await chooseProject(p.id);page('idea');if(state.project?.productionRequest){const r=await api('/api/projects/'+p.id+'/work-center');if(!r.job&&!r.runs?.length)await submit('auto-produce',{requestId:p.productionRequest.id,fromReception:true});}else if(!state.project?.approvedSpecificationId)await submit('prepare');else await refresh();document.getElementById('chat')?.scrollIntoView({block:'nearest',behavior:'smooth'});};
 box.addEventListener('click',async e=>{const b=e.target.closest('[data-wc]');if(!b||inFlight)return;const action=b.dataset.wc;inFlight=true;b.disabled=true;
  try{
   if(action==='refresh')await refresh();
   else if(action==='go-media')page('studio');
   else if(action==='go-connections')page('connections');
   else if(action==='voice-setup')await voiceSetup();
   else if(action==='voice-refresh'){const msg=document.createElement('p');msg.setAttribute('role','status');b.after(msg);await refreshVoiceAndContinue(voiceContext(),msg);}
   else if(action==='auto-produce')await submit('auto-produce',{requestId:latest?.request?.id,fromReception:true});
   else if(action==='approve')await submit('approve',{confirm:true,specificationId:latest?.specification?.id,testMode:'docker',confirmHost:false});
   else if(action==='run')await submit('run',{confirm:true,testMode:'docker',confirmHost:false});
   else if(action==='prepare')await submit('prepare');
  }catch(err){toast(err.message);signature='';await refresh();}finally{inFlight=false;if(b.isConnected)b.disabled=false;}
 });
 document.addEventListener('project-change',()=>{seq++;signature='';productSignature='';refresh();});
 document.addEventListener('page-change',()=>refresh());document.addEventListener('connections-change',()=>{signature='';refresh();});document.addEventListener('visibilitychange',()=>refresh());
 const timer=setInterval(refresh,2500);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});render(null);renderProducts(null);refresh();
})();
