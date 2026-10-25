const ideaIcons={
 edit:'<path d="M16 3l5 5-11 11-6 1 1-6L16 3zm-9 12l-1 3 3-1 10-10-2-2L7 15z"/><path d="M3 3h9v2H4v15h15v-9h2v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>',
 crown:'<path d="M2 6l6 4 4-7 4 7 6-4-3 12H5L2 6zm3 14h14v2H5z"/>',
 user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/>',
 database:'<ellipse cx="12" cy="5" rx="9" ry="4"/><path d="M3 8c3 3 15 3 18 0v5c-3 4-15 4-18 0V8zm0 8c3 3 15 3 18 0v4c-3 4-15 4-18 0v-4z"/>',
 payments:'<path d="M3 4h18a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v3h18V6H3zm0 6v7h18v-7H3zm2 2h6v2H5z"/>',
 dashboard:'<path d="M3 3h2v18h18v2H3V3zm4 10h3v6H7v-6zm5-6h3v12h-3V7zm5 3h3v9h-3v-9z"/>',
 mobile:'<path d="M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 2v17h10V3H7zm4 18v1h2v-1z"/>',
 auth:'<path d="M7 9V6a5 5 0 0 1 10 0v3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h2zm2 0h6V6a3 3 0 0 0-6 0v3zm3 4a2 2 0 0 0-1 4v3h2v-3a2 2 0 0 0-1-4z"/>',
 storage:'<path d="M2 5h7l3 3h10v3H5l-3 9H1V6a1 1 0 0 1 1-1zm4 8h17l-3 9H3l3-9z"/>',
 domain:'<path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm-2 2c-1 2-2 4-2 7H3a9 9 0 0 1 7-7zm4 0a9 9 0 0 1 7 7h-5c0-3-1-5-2-7zM3 12h5c0 4 1 6 2 8a9 9 0 0 1-7-8zm18 0a9 9 0 0 1-7 8c1-2 2-4 2-8h5zm-9-9c1 1 2 4 2 7h-4c0-3 1-6 2-7zm-2 9h4c0 4-1 6-2 8-1-2-2-4-2-8z"/>',
 github:'<path d="M12 1a11 11 0 0 0-3 21.6v-2.2c-2 .4-3-.5-3.3-1.5-.2-.6-.7-1-1-1.3-.3-.3-1-.5-.1-.5 1 0 1.6 1.1 1.9 1.4.6.8 1.8.6 2.5.4.1-.6.4-1 .7-1.2-2.6-.3-5.2-1.3-5.2-5.6 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.5.1-3 0 0 1-.3 3.1 1.2a11 11 0 0 1 5.7 0c2.1-1.5 3.1-1.2 3.1-1.2.6 1.5.2 2.7.1 3 .7.8 1.1 1.8 1.1 3 0 4.3-2.7 5.3-5.2 5.6.4.3.7 1 .7 1.9v3A11 11 0 0 0 12 1z"/>',
 vercel:'<path d="M12 2L24 22H0L12 2z"/>',
 backend:'<path d="M2 2h20v8H2V2zm3 3v2h2V5H5zm-3 9h20v8H2v-8zm3 3v2h2v-2H5z"/>',
 gear:'<path d="M10 1h4l1 3 3 1 3-1 2 4-2 2v4l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-4L1 8l2-4 3 1 3-1 1-3zm2 6a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>',
 trash:'<path d="M8 1h8v3h6v2h-2v16H4V6H2V4h6V1zm2 2v1h4V3h-4zM6 6v14h12V6H6zm3 2h2v10H9V8zm4 0h2v10h-2V8z"/>',
 clip:'<path d="M9 7l7-6a5 5 0 0 1 7 7L11 20a7 7 0 0 1-10-10L12 0l1 2L3 12a5 5 0 0 0 7 7L21 7a3 3 0 0 0-4-4L7 13a1 1 0 0 0 2 2l9-9 1 2-9 9a3 3 0 0 1-4-4L9 7z"/>',
 send:'<path d="M1 1l23 11L1 23l3-10 12-1-12-1L1 1z"/>',
 spark:'<path d="M9 1l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6zm10 10l1 4 4 1-4 2-1 5-2-5-4-2 4-1 2-4z"/>',
 team:'<circle cx="12" cy="5" r="3"/><circle cx="3" cy="7" r="2.5"/><circle cx="21" cy="7" r="2.5"/><path d="M6 22v-6a6 6 0 0 1 12 0v6H6zm-6-3v-5a3 3 0 0 1 5-2l-1 7H0zm20 0l-1-7a3 3 0 0 1 5 2v5h-4z"/>'
};
function ideaIcon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${ideaIcons[name]||ideaIcons.spark}</svg>`}
$$('#page-idea [data-idea-icon]').forEach(e=>e.innerHTML=ideaIcon(e.dataset.ideaIcon));
const ideaFeatures=[['auth','Auth (Đăng nhập)'],['database','Database'],['payments','Payments (Thanh toán)'],['dashboard','Dashboard'],['mobile','Mobile-friendly'],['storage','Storage'],['domain','Domain'],['backend','Backend']];
const ideaStackCards=[['needsGithub','github','GitHub','Lưu trữ mã nguồn'],['needsVercel','vercel','Vercel','Triển khai & hosting'],['needsDatabase','database','Database','Lưu trữ dữ liệu'],['needsAuth','auth','Auth','Xác thực người dùng'],['needsStorage','storage','Storage','Lưu trữ file (ảnh, tài liệu)'],['needsDomain','domain','Domain','Tên miền riêng']];
let ideaTargetDirty=false,ideaDraft=false,ideaDirty=false,ideaBusy=false,ideaActiveProject=null,ideaShowMore=false,ideaSelectedFeatures=new Set(),ideaRole=null,ideaRoleRequest=0;
function ideaFields(){return {name:$('#projectName').value.trim(),productType:$('#ideaProductType').value,deploymentTarget:$('#ideaDeploymentTarget').value,audience:$('#ideaAudience').value.trim(),goals:$('#ideaGoals').value.trim(),mainFeatures:[...ideaSelectedFeatures]};}
function ideaError(message=''){$('#ideaError').hidden=!message;$('#ideaError').textContent=message;}
function ideaMarkDirty(){ideaDirty=true;$('#ideaSaveStatus').textContent='Có thay đổi chưa lưu';ideaRenderStack(null);ideaRenderBrief(null);}
function ideaRenderFeatures(){
 $('#ideaFeatureChoices').innerHTML=ideaFeatures.filter((x,i)=>i<5||ideaShowMore||ideaSelectedFeatures.has(x[0])).map(([id,label])=>`<button type="button" class="idea-feature" data-feature="${id}" aria-pressed="${ideaSelectedFeatures.has(id)}"><span class="idea-feature-check">${ideaSelectedFeatures.has(id)?'✓':''}</span>${ideaIcon(id==='auth'?'user':id)}${label}</button>`).join('')+`<button type="button" class="idea-feature-more" id="ideaMoreFeatures">${ideaShowMore?'Thu gọn':'Thêm tính năng…'}</button>`;
 $$('#ideaFeatureChoices .idea-feature').forEach(b=>b.onclick=()=>{const key=b.dataset.feature;if(ideaSelectedFeatures.has(key))ideaSelectedFeatures.delete(key);else ideaSelectedFeatures.add(key);ideaMarkDirty();ideaRenderFeatures();});
 $('#ideaMoreFeatures').onclick=()=>{ideaShowMore=!ideaShowMore;ideaRenderFeatures();};
}
function ideaRenderStack(stack){
 $('#ideaStackGrid').innerHTML=ideaStackCards.map(([key,icon,title,description])=>{const value=stack?.[key];return `<div class="idea-stack-card" data-stack="${key}"><span class="idea-stack-icon">${ideaIcon(icon)}</span><div><div class="idea-stack-title">${title}<span class="idea-stack-status ${value===true?'needed':''}">● ${value===true?'Cần thiết':value===false?'Tùy chọn':'Chưa rõ'}</span></div><div class="idea-stack-description">${description}</div></div></div>`}).join('');
 $('#ideaStackDetails').innerHTML=stack?`<div>Payments: ${stack.needsPayments?'Cần thiết':'Tùy chọn'} · Backend: ${stack.needsBackend?'Cần thiết':'Tùy chọn'}</div>${stack.reasons?.length?`<div>${esc(stack.reasons.join(' · '))}</div>`:''}`:'';
}
function ideaRenderBrief(brief){
 const e=$('#ideaBriefResult');e.hidden=!brief;if(!brief)return;e.innerHTML=`<h3>Project brief · Founder</h3><p>${esc(brief.summary)}</p><p>${esc(brief.problem)}</p><div class="idea-brief-columns">${[['goals','Mục tiêu'],['features','Tính năng MVP'],['userFlows','Luồng người dùng'],['successCriteria','Tiêu chí thành công'],['constraints','Ràng buộc'],['openQuestions','Câu hỏi cần làm rõ']].map(([key,title])=>`<div><h4>${title}</h4>${brief[key]?.length?`<ul>${brief[key].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>Chưa có nội dung.</p>'}</div>`).join('')}</div>`;
}
function ideaRenderChat(p){
 const messages=p?.messages||[];
 $('#chat').innerHTML=messages.length?messages.map(m=>`<div class="idea-message ${m.role==='user'?'user':'assistant'}"><span class="idea-avatar">${ideaIcon(m.role==='user'?'user':'crown')}</span><div class="idea-message-body"><div class="idea-message-content">${esc(m.content)}</div><div class="idea-message-meta"><time datetime="${esc(m.at)}">${Number.isFinite(Date.parse(m.at))?esc(new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit'}).format(new Date(m.at))):''}</time>${m.role==='user'?`<span class="${m.status==='failed'?'failed':''}">${m.status==='failed'?(m.error?esc(m.error):(m.interruptedAt?'Bị gián đoạn — hãy gửi lại':'Gửi thất bại')):m.status==='pending'?'Đang gửi…':'✓✓'}</span>${m.replyError?`<span class="failed">Trưởng phòng chưa trả lời được: ${esc(m.replyError)}</span>`:''}`:''}</div></div></div>`).join(''):`<div class="idea-empty"><span data-idea-icon="crown">${ideaIcon('crown')}</span><strong>${p?'Bắt đầu cùng Trưởng phòng':'Ý tưởng mới bắt đầu từ đây'}</strong><p>${p?esc(p.idea||'Nhắn cho Trưởng phòng để làm rõ ý tưởng.'): 'Cứ nhắn ý tưởng vào đây — Trưởng phòng sẽ trao đổi, tự lập hồ sơ dự án và nhận việc. Không cần điền mẫu.'}</p></div>`;
 $('#chat').scrollTop=$('#chat').scrollHeight;
}
function ideaRenderRole(){
 const available=ideaRole?.status==='verified';
 $('#ideaFounderStatus').textContent=ideaBusy?'Trưởng phòng đang xử lý…':available?`Trưởng phòng · ${ideaRole.model}`:ideaRole?.status==='locked'?'Vault đang khóa':'Chọn AI trưởng phòng (vai Founder) tại Kết nối';
 $('#ideaFounderStatus').title=ideaRole?.message||$('#ideaFounderStatus').textContent;
 for(const id of ['sendChat','ideaAnalyze'])$('#'+id).disabled=ideaBusy;
 $('#ideaSendCouncil').disabled=ideaBusy;const _aj=$('#ideaAcceptJob');if(_aj)_aj.disabled=ideaBusy;
 $('#ideaClearChat').disabled=ideaBusy||ideaDraft||!state.project?.messages?.length;
 $('#ideaNewProject').disabled=ideaBusy;$('#ideaAttach').disabled=ideaBusy;$('#chatInput').disabled=ideaBusy;
 for(const id of ['projectName','ideaProductType','ideaDeploymentTarget','ideaAudience','ideaGoals'])$('#'+id).disabled=ideaBusy;
 $$('#ideaFeatureChoices button').forEach(b=>b.disabled=ideaBusy);
 $('#createProject').disabled=ideaBusy;
}
async function ideaLoadRole(){
 const id=state.project?.id,request=++ideaRoleRequest;ideaRole=null;ideaRenderRole();if(!id||ideaDraft)return;
 try{const data=await api(`/api/projects/${encodeURIComponent(id)}/model-roles`);if(request!==ideaRoleRequest)return;ideaRole=data.descriptors?.founder?.[0]||null;ideaRenderRole();}catch(e){if(request===ideaRoleRequest){ideaRole={status:'unavailable',message:e.message};ideaRenderRole();}}
}
function renderIdeaProject(){
 const actual=state.project;const changed=actual?.id!==ideaActiveProject;
 if(changed){ideaDraft=false;ideaDirty=false;ideaTargetDirty=false;ideaActiveProject=actual?.id||null;$('#chatInput').value='';ideaError();}
 const p=ideaDraft?null:actual;
 if(!ideaDirty){$('#projectName').value=p?.name||'';$('#ideaProductType').value=p?.productType||'';$('#ideaDeploymentTarget').value=p?.deploymentTarget||'not-specified';$('#ideaAudience').value=p?.audience||'';$('#ideaGoals').value=p?.goals||'';ideaSelectedFeatures=new Set(p?.mainFeatures||[]);$('#ideaSaveStatus').textContent=p?'Đã lưu trên máy':'Chưa có dự án';ideaRenderFeatures();}
 if(!ideaTargetDirty)$('#ideaDeploymentTarget').value=p?.deploymentTarget||'not-specified';
 ideaRenderChat(p);ideaRenderStack(p?.stack);ideaRenderBrief(p?.analyzedBrief);ideaLoadRole();renderStack(p?.stack);
}
async function ideaSave(){
 if(!['name','productType','audience','goals'].every(k=>ideaFields()[k]))throw new Error('Hãy điền đầy đủ thông tin bắt buộc.');
 const fields=ideaFields();const p=await api(ideaDraft||!state.project?'/api/projects':`/api/projects/${encodeURIComponent(state.project.id)}/brief`,{method:'POST',body:JSON.stringify(fields)});
 ideaDirty=false;ideaTargetDirty=false;ideaDraft=false;state.project=p;await loadProjects();return state.project;
}
async function ideaAction(run){if(ideaBusy)return;ideaBusy=true;ideaError();ideaRenderRole();try{await run();}catch(e){ideaError(e.message);toast(e.message);}finally{ideaBusy=false;ideaRenderRole();}}
$('#ideaBriefForm').onsubmit=e=>{e.preventDefault();ideaAction(async()=>{await ideaSave();toast('Đã lưu ý tưởng');});};
for(const id of ['projectName','ideaProductType','ideaDeploymentTarget','ideaAudience','ideaGoals'])$('#'+id).addEventListener('input',ideaMarkDirty);
$('#ideaDeploymentTarget').addEventListener('input',()=>{ideaTargetDirty=true;});
$('#ideaNewProject').onclick=()=>{ideaTargetDirty=true;ideaDraft=true;ideaDirty=true;ideaRole=null;for(const id of ['projectName','ideaProductType','ideaAudience','ideaGoals'])$('#'+id).value='';$('#ideaDeploymentTarget').value='not-specified';ideaSelectedFeatures.clear();ideaRenderFeatures();ideaRenderChat(null);ideaRenderStack(null);ideaRenderBrief(null);$('#chatInput').value='';$('#ideaSaveStatus').textContent='Dự án mới · chưa lưu';ideaError();ideaRenderRole();$('#projectName').focus();};
$('#sendChat').onclick=()=>ideaAction(async()=>{
 const message=$('#chatInput').value.trim();if(!message)throw new Error('Hãy nhập tin nhắn.');const p=await ideaEnsureProject();
 try{await api(`/api/projects/${encodeURIComponent(p.id)}/chat`,{method:'POST',body:JSON.stringify({message})});$('#chatInput').value='';}
 finally{await chooseProject(p.id);}
});
$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#sendChat').click();}});
$('#ideaClearChat').onclick=()=>{if(ideaBusy)return;modal('<h2>Xóa cuộc trò chuyện?</h2><p>Hội thoại Founder và bản phân tích của dự án sẽ được xóa. Thông tin ý tưởng vẫn được giữ lại.</p><div class="inline"><button class="ghost" id="ideaCancelClear">Giữ hội thoại</button><button class="primary" id="ideaConfirmClear">Xóa hội thoại</button></div>');$('#ideaCancelClear').onclick=()=>$('#modal').classList.add('hidden');$('#ideaConfirmClear').onclick=()=>{$('#modal').classList.add('hidden');ideaAction(async()=>{if(!state.project||ideaDraft)return;await api(`/api/projects/${encodeURIComponent(state.project.id)}/chat/clear`,{method:'POST',body:'{}'});await chooseProject(state.project.id);toast('Đã xóa hội thoại Founder');});};};
$('#ideaAnalyze').onclick=()=>ideaAction(async()=>{const p=await ideaEnsureProject();await api(`/api/projects/${encodeURIComponent(p.id)}/analyze-idea`,{method:'POST',body:'{}'});await chooseProject(p.id);toast('Đã phân tích ý tưởng và tạo project brief');});
$('#ideaSendCouncil').onclick=()=>ideaAction(async()=>{const p=await ideaSave();await api(`/api/projects/${encodeURIComponent(p.id)}/send-council`,{method:'POST',body:'{}'});await chooseProject(p.id);page('council');toast('Đã gửi project brief sang AI Council');});
$('#ideaOpenPrd').onclick=()=>{page('council');$('#projectPrdPanel')?.scrollIntoView({behavior:'smooth',block:'start'});};
$('#ideaAttach').onclick=()=>$('#ideaAttachment').click();
$('#ideaAttachment').onchange=async()=>{const file=$('#ideaAttachment').files[0];if(!file)return;try{if(file.size>65536)throw new Error('Tài liệu phải nhỏ hơn 64 KB.');const content=await file.text();if(content.includes('\u0000'))throw new Error('Chỉ hỗ trợ tài liệu văn bản.');const value=[$('#chatInput').value,`Tài liệu: ${file.name}\n${content}`].filter(Boolean).join('\n\n');if(value.length>16000)throw new Error('Tin nhắn kèm tài liệu vượt 16.000 ký tự.');$('#chatInput').value=value;ideaError();$('#chatInput').focus();}catch(e){ideaError(e.message);}finally{$('#ideaAttachment').value='';}};
document.addEventListener('connections-change',()=>{if(!ideaDraft)ideaLoadRole();});
document.addEventListener('page-change',e=>{if(e.detail.page==='idea'){$('#subtitle').textContent='Biến một ý tưởng ban đầu thành dự án có cấu trúc.';ideaLoadRole();}});
// Preserve the existing Council analyzer until its independent tab is replaced.
if($('#analyzeStack'))$('#analyzeStack').onclick=async()=>{if(!state.project)return toast('Hãy chọn dự án');try{await api(`/api/projects/${encodeURIComponent(state.project.id)}/analyze-stack`,{method:'POST',body:JSON.stringify({connectionId:$('#stackSelect')?.value})});await chooseProject(state.project.id);toast('Đã phân tích hạ tầng')}catch(e){toast(e.message)}};
function renderStack(s){const e=$('#stackResult');if(!e)return;if(!s){e.innerHTML='<div class="empty">Chưa phân tích.</div>';return;}e.innerHTML=[['Database',s.needsDatabase],['Auth',s.needsAuth],['Storage',s.needsStorage],['Payments',s.needsPayments],['Backend',s.needsBackend],['Domain',s.needsDomain]].map(([n,v])=>`<div class="stackItem"><span>${n}</span><b class="${v?'ok':'muted'}">${v?'CẦN':'Không bắt buộc'}</b></div>`).join('')+`<p class="muted">Thứ tự: ${esc((s.setupOrder||[]).join(' → '))}</p>`;}
renderIdeaProject();


// ===== Bàn tiếp nhận (đợt B): nguồn dự án + hiện diện tại văn phòng =====
let ideaSource=localStorage.getItem('aios-idea-source')||'new';
function ideaRenderSource(){
 $$('.idea-source-chip').forEach(b=>{const on=b.dataset.source===ideaSource;b.classList.toggle('primary',on);b.classList.toggle('ghost',!on);});
 const gh=$('#ideaGithubBox'); if(gh)gh.hidden=ideaSource!=='github';
 const pg=$('#page-idea'); if(pg)pg.classList.toggle('chat-only',ideaSource==='new');
 const hint=$('#ideaSourceHint');
 if(hint)hint.textContent=ideaSource==='github'?'Chọn một repo có sẵn để nhập thành dự án — trưởng phòng đọc hướng dẫn trong repo và lập danh sách việc tiếp tục cho đội.':ideaSource==='files'?'Dùng nút kẹp giấy trong khung trò chuyện để đính kèm file cho trưởng phòng đọc (.txt/.md/.json/.csv).':'Cứ nhắn ý tưởng vào ô chat — trưởng phòng trao đổi, tự lập hồ sơ và nhận việc. Muốn điền theo mẫu thì bấm “Mẫu chi tiết”.';
}
$$('.idea-source-chip').forEach(b=>b.addEventListener('click',()=>{ideaSource=b.dataset.source;localStorage.setItem('aios-idea-source',ideaSource);ideaRenderSource();
}));
ideaRenderSource();
{const wa=$('#ideaWorkActions'),acts=document.querySelector('#page-idea .idea-actions');if(wa&&acts)wa.appendChild(acts);}
let ideaIntakeTimer=null;
function ideaIntakePing(){
 const active=ideaDirty||!!(state.project?.messages||[]).some(m=>m.role==='user');
 if(active){try{localStorage.setItem('aios-intake',JSON.stringify({ts:Date.now(),lead:ideaRole?.connectionId||null}));}catch{}}
}
document.addEventListener('page-change',e=>{
 if(e.detail.page==='idea'){ideaSource=localStorage.getItem('aios-idea-source')||'new';ideaRenderSource();ideaIntakePing();clearInterval(ideaIntakeTimer);ideaIntakeTimer=setInterval(ideaIntakePing,25000);}
 else{clearInterval(ideaIntakeTimer);ideaIntakeTimer=null;}
});
// ===== Đội AI bàn việc: luồng sự kiện THẬT tại bàn tiếp nhận =====
let ideaMeetingTimer=null,ideaMeetingSig='';
const ideaMeetingState={done:['Hoàn thành','ok'],running:['Đang chạy','run'],waiting:['Chờ Sếp duyệt','wait'],failed:['Lỗi','fail'],approved:['Đã duyệt','ok'],skipped:['Bỏ qua','skip'],info:['','']};
async function ideaMeetingTick(){
 const box=$('#ideaMeetingFeed');if(!box)return;
 try{
  const r=await api('/api/orchestrator/feed');
  const events=r.events||[];
  const live=$('#ideaMeetingLive');
  if(live){const running=events.filter(e=>e.state==='running').length;live.textContent=running?`● ${running} việc đang chạy`:'Đội đang chờ việc';}
  const sig=events.length+':'+(events.at(-1)?.id||'');
  if(sig===ideaMeetingSig)return;ideaMeetingSig=sig;
  const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;
  box.innerHTML=events.length?events.map(e=>{const st=ideaMeetingState[e.state]||['',''];const t=e.at?new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}).format(new Date(e.at)):'';return `<div class="meeting-row"><span class="meeting-actor">${esc(e.actor)}</span><span class="meeting-text">${esc(e.text)}</span>${st[0]?`<span class="meeting-chip ${st[1]}">${st[0]}</span>`:''}<time class="meeting-time">${esc(t)}</time></div>`;}).join(''):'<p class="muted">Chưa có lượt chạy nào. Giao việc ở Radar tin hoặc bấm “Nhận việc &amp; giao đội” — đội làm gì sẽ hiện tại đây.</p>';
  if(nearBottom)box.scrollTop=box.scrollHeight;
 }catch{/* giữ nguyên khung khi mất kết nối tạm thời */}
}
document.addEventListener('page-change',e=>{
 if(e.detail.page==='idea'){ideaMeetingTick();clearInterval(ideaMeetingTimer);ideaMeetingTimer=setInterval(ideaMeetingTick,5000);}
 else{clearInterval(ideaMeetingTimer);ideaMeetingTimer=null;}
});
{const aj=$('#ideaAcceptJob'); if(aj)aj.addEventListener('click',()=>ideaAction(async()=>{await ideaEnsureProject();ideaIntakePing();toast('Trưởng phòng đã nhận việc — đội chuyển sang họp chốt spec.');page('council');}));}

{const ft=$('#ideaFormToggle'); if(ft)ft.addEventListener('click',()=>{const pg=$('#page-idea');const on=pg.classList.toggle('show-form');ft.textContent=on?'💬 Chỉ dùng ô chat':'📝 Mẫu chi tiết';});}
async function ideaEnsureProject(){
 const f=ideaFields();
 if(['name','productType','audience','goals'].every(k=>f[k]))return ideaSave();
 const payload={name:f.name||'Dự án mới',productType:f.productType||'',deploymentTarget:f.deploymentTarget||'not-specified',audience:f.audience||'',goals:f.goals||'',mainFeatures:f.mainFeatures};
 const p=ideaDraft||!state.project?await api('/api/projects',{method:'POST',body:JSON.stringify(payload)}):await api(`/api/projects/${encodeURIComponent(state.project.id)}/brief`,{method:'POST',body:JSON.stringify(payload)});
 ideaDirty=false;ideaTargetDirty=false;ideaDraft=false;state.project=p;await loadProjects();return p;
}
