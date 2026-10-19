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
let ideaDraft=false,ideaDirty=false,ideaBusy=false,ideaActiveProject=null,ideaShowMore=false,ideaSelectedFeatures=new Set(),ideaRole=null,ideaRoleRequest=0;
function ideaFields(){return {name:$('#projectName').value.trim(),productType:$('#ideaProductType').value,audience:$('#ideaAudience').value.trim(),goals:$('#ideaGoals').value.trim(),mainFeatures:[...ideaSelectedFeatures]};}
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
 $('#chat').innerHTML=messages.length?messages.map(m=>`<div class="idea-message ${m.role==='user'?'user':'assistant'}"><span class="idea-avatar">${ideaIcon(m.role==='user'?'user':'crown')}</span><div class="idea-message-body"><div class="idea-message-content">${esc(m.content)}</div><div class="idea-message-meta"><time datetime="${esc(m.at)}">${Number.isFinite(Date.parse(m.at))?esc(new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit'}).format(new Date(m.at))):''}</time>${m.role==='user'?`<span class="${m.status==='failed'?'failed':''}">${m.status==='failed'?(m.interruptedAt?'Bị gián đoạn — hãy gửi lại':'Gửi thất bại'):m.status==='pending'?'Đang gửi…':'✓✓'}</span>`:''}</div></div></div>`).join(''):`<div class="idea-empty"><span data-idea-icon="crown">${ideaIcon('crown')}</span><strong>${p?'Bắt đầu cùng Trưởng phòng':'Ý tưởng mới bắt đầu từ đây'}</strong><p>${p?esc(p.idea||'Nhắn cho Trưởng phòng để làm rõ ý tưởng.'): 'Cứ nhắn ý tưởng vào đây — Trưởng phòng sẽ trao đổi, tự lập hồ sơ dự án và nhận việc. Không cần điền mẫu.'}</p></div>`;
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
 for(const id of ['projectName','ideaProductType','ideaAudience','ideaGoals'])$('#'+id).disabled=ideaBusy;
 $$('#ideaFeatureChoices button').forEach(b=>b.disabled=ideaBusy);
 $('#createProject').disabled=ideaBusy;
}
async function ideaLoadRole(){
 const id=state.project?.id,request=++ideaRoleRequest;ideaRole=null;ideaRenderRole();if(!id||ideaDraft)return;
 try{const data=await api(`/api/projects/${encodeURIComponent(id)}/model-roles`);if(request!==ideaRoleRequest)return;ideaRole=data.descriptors?.founder?.[0]||null;ideaRenderRole();}catch(e){if(request===ideaRoleRequest){ideaRole={status:'unavailable',message:e.message};ideaRenderRole();}}
}
function renderIdeaProject(){
 const actual=state.project;const changed=actual?.id!==ideaActiveProject;
 if(changed){ideaDraft=false;ideaDirty=false;ideaActiveProject=actual?.id||null;$('#chatInput').value='';ideaError();}
 const p=ideaDraft?null:actual;
 if(!ideaDirty){$('#projectName').value=p?.name||'';$('#ideaProductType').value=p?.productType||'';$('#ideaAudience').value=p?.audience||'';$('#ideaGoals').value=p?.goals||'';ideaSelectedFeatures=new Set(p?.mainFeatures||[]);$('#ideaSaveStatus').textContent=p?'Đã lưu trên máy':'Chưa có dự án';ideaRenderFeatures();}
 ideaRenderChat(p);ideaRenderStack(p?.stack);ideaRenderBrief(p?.analyzedBrief);ideaRenderWork(p);ideaLoadRole();renderStack(p?.stack);
}
async function ideaSave(){
 if(!['name','productType','audience','goals'].every(k=>ideaFields()[k]))throw new Error('Hãy điền đầy đủ thông tin bắt buộc.');
 const fields=ideaFields();const p=await api(ideaDraft||!state.project?'/api/projects':`/api/projects/${encodeURIComponent(state.project.id)}/brief`,{method:'POST',body:JSON.stringify(fields)});
 ideaDirty=false;ideaDraft=false;state.project=p;await loadProjects();return state.project;
}
async function ideaAction(run){if(ideaBusy)return;ideaBusy=true;ideaError();ideaRenderRole();try{await run();}catch(e){ideaError(e.message);toast(e.message);}finally{ideaBusy=false;ideaRenderRole();}}
$('#ideaBriefForm').onsubmit=e=>{e.preventDefault();ideaAction(async()=>{await ideaSave();toast('Đã lưu ý tưởng');});};
for(const id of ['projectName','ideaProductType','ideaAudience','ideaGoals'])$('#'+id).addEventListener('input',ideaMarkDirty);
$('#ideaNewProject').onclick=()=>{ideaDraft=true;ideaDirty=true;ideaRole=null;for(const id of ['projectName','ideaProductType','ideaAudience','ideaGoals'])$('#'+id).value='';ideaSelectedFeatures.clear();ideaRenderFeatures();ideaRenderChat(null);ideaRenderStack(null);ideaRenderBrief(null);$('#chatInput').value='';$('#ideaSaveStatus').textContent='Dự án mới · chưa lưu';ideaError();ideaRenderRole();$('#projectName').focus();};
$('#sendChat').onclick=()=>ideaAction(async()=>{
 const message=$('#chatInput').value.trim();if(!message)throw new Error('Hãy nhập tin nhắn.');const p=await ideaEnsureProject();
 try{await api(`/api/projects/${encodeURIComponent(p.id)}/chat`,{method:'POST',body:JSON.stringify({message})});$('#chatInput').value='';}
 finally{await chooseProject(p.id);}
});
$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#sendChat').click();}});
$('#ideaClearChat').onclick=()=>{if(ideaBusy)return;modal('<h2>Xóa cuộc trò chuyện?</h2><p>Hội thoại Founder và bản phân tích của dự án sẽ được xóa. Thông tin ý tưởng vẫn được giữ lại.</p><div class="inline"><button class="ghost" id="ideaCancelClear">Giữ hội thoại</button><button class="primary" id="ideaConfirmClear">Xóa hội thoại</button></div>');$('#ideaCancelClear').onclick=()=>$('#modal').classList.add('hidden');$('#ideaConfirmClear').onclick=()=>{$('#modal').classList.add('hidden');ideaAction(async()=>{if(!state.project||ideaDraft)return;await api(`/api/projects/${encodeURIComponent(state.project.id)}/chat/clear`,{method:'POST',body:'{}'});await chooseProject(state.project.id);toast('Đã xóa hội thoại Founder');});};};
$('#ideaAnalyze').onclick=()=>ideaAction(async()=>{const p=await ideaEnsureProject();await api(`/api/projects/${encodeURIComponent(p.id)}/analyze-idea`,{method:'POST',body:'{}'});await chooseProject(p.id);toast('Đã phân tích ý tưởng và tạo project brief');});
$('#ideaSendCouncil').onclick=()=>ideaAction(async()=>{const p=await ideaSave();await api(`/api/projects/${encodeURIComponent(p.id)}/send-council`,{method:'POST',body:'{}'});await chooseProject(p.id);page('council');toast('Đã gửi project brief sang AI Council');});
$('#ideaAttach').onclick=()=>$('#ideaAttachment').click();
$('#ideaAttachment').onchange=async()=>{const file=$('#ideaAttachment').files[0];if(!file)return;try{if(file.size>65536)throw new Error('Tài liệu phải nhỏ hơn 64 KB.');const content=await file.text();if(content.includes('\u0000'))throw new Error('Chỉ hỗ trợ tài liệu văn bản.');const value=[$('#chatInput').value,`Tài liệu: ${file.name}\n${content}`].filter(Boolean).join('\n\n');if(value.length>16000)throw new Error('Tin nhắn kèm tài liệu vượt 16.000 ký tự.');$('#chatInput').value=value;ideaError();$('#chatInput').focus();}catch(e){ideaError(e.message);}finally{$('#ideaAttachment').value='';}};
document.addEventListener('connections-change',()=>{if(!ideaDraft)ideaLoadRole();});
document.addEventListener('page-change',e=>{if(e.detail.page==='idea'){$('#subtitle').textContent='Biến một ý tưởng ban đầu thành dự án có cấu trúc.';ideaLoadRole();}});
// Preserve the existing Council analyzer until its independent tab is replaced.
if($('#analyzeStack'))$('#analyzeStack').onclick=async()=>{if(!state.project)return toast('Hãy chọn dự án');try{await api(`/api/projects/${encodeURIComponent(state.project.id)}/analyze-stack`,{method:'POST',body:JSON.stringify({connectionId:$('#stackSelect')?.value})});await chooseProject(state.project.id);toast('Đã phân tích hạ tầng')}catch(e){toast(e.message)}};
function renderStack(s){const e=$('#stackResult');if(!e)return;if(!s){e.innerHTML='<div class="empty">Chưa phân tích.</div>';return;}e.innerHTML=[['Database',s.needsDatabase],['Auth',s.needsAuth],['Storage',s.needsStorage],['Payments',s.needsPayments],['Backend',s.needsBackend],['Domain',s.needsDomain]].map(([n,v])=>`<div class="stackItem"><span>${n}</span><b class="${v?'ok':'muted'}">${v?'CẦN':'Không bắt buộc'}</b></div>`).join('')+`<p class="muted">Thứ tự: ${esc((s.setupOrder||[]).join(' → '))}</p>`;}
renderIdeaProject();

/* ---- Nguồn tin tự động (đầu vào của vòng khép kín) ---- */
function newsTime(x){if(!x)return '';const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('vi-VN'):''}
function newsSafeUrl(u){u=String(u||'');return /^https?:\/\//i.test(u)?u:''}
async function renderNewsSources(){
 const sBox=$('#newsSources'),cBox=$('#newsCards');if(!sBox||!cBox)return;
 try{
  const [src,cards,fieldsRes,summaryRes]=await Promise.all([api('/api/ingest/sources'),api('/api/ingest/cards'),api('/api/ingest/fields').catch(()=>null),api('/api/orchestrator/fields-summary').catch(()=>null)]);
  renderNewsFields(fieldsRes,summaryRes);
  const sources=src.sources||[],counts=src.counts||{};
  $('#newsStatus').textContent=`${counts.sources??sources.length} nguồn · ${counts.cards??(cards.cards||[]).length} thẻ tin · ${counts.unusedCards??(cards.cards||[]).filter(c=>!c.usedByProjectId).length} thẻ chưa dùng`;
  sBox.innerHTML=sources.length?sources.map(s=>`<div class="idea-stack-card" style="margin:8px 0"><div style="flex:1;min-width:0"><div class="idea-stack-title">${esc(s.name)}<span class="idea-stack-status ${s.enabled?'needed':''}">● ${s.enabled?'Đang bật':'Đang tắt'}</span></div><div class="idea-stack-description">${esc(s.url)}${s.keywords?.length?`<br>Từ khóa: ${esc(s.keywords.join(', '))}`:''}<br>Quét lần cuối: ${s.lastScanAt?esc(newsTime(s.lastScanAt)):'chưa quét'}</div>${s.lastError?`<div style="color:var(--danger)">${esc(s.lastError)}</div>`:''}</div><div class="inline"><label class="checkboxLine" style="margin:0"><input type="checkbox" data-news-toggle="${esc(s.id)}" ${s.enabled?'checked':''}> Bật</label><button type="button" class="ghost small" data-news-scan="${esc(s.id)}">Quét ngay</button><button type="button" class="ghost small" data-news-delete="${esc(s.id)}">Xóa</button></div></div>`).join(''):'<div class="idea-empty"><p>Chưa có nguồn tin nào. Thêm nguồn RSS/Atom ở trên để bắt đầu.</p></div>';
  const byId=new Map(sources.map(s=>[s.id,s.name]));
  const latest=[...(cards.cards||[])].sort((a,b)=>new Date(b.fetchedAt||b.publishedAt)-new Date(a.fetchedAt||a.publishedAt)).slice(0,20);
  const fieldLabel=new Map(((fieldsRes&&fieldsRes.fields)||[]).map(f=>[f.id,f.label]));
  cBox.innerHTML=latest.length?latest.map(c=>{const url=newsSafeUrl(c.link);const srcName=c.sourceId?byId.get(c.sourceId):'';const summary=String(c.summary||'');const badge=c.fieldId?`<span class="idea-stack-status needed">${esc(fieldLabel.get(c.fieldId)||c.fieldId)}${typeof c.score==='number'?` · ${c.score}đ`:''}</span>`:(typeof c.score==='number'?`<span class="idea-stack-status">${c.score}đ</span>`:'');return `<div class="idea-stack-card" style="margin:8px 0"><div style="min-width:0"><div class="idea-stack-title">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a>`:esc(c.title)}${c.usedByProjectId?'<span class="idea-stack-status needed">Đã dùng</span>':''}${badge}</div><div class="idea-stack-description">${srcName?`${esc(srcName)} · `:''}${esc(newsTime(c.publishedAt)||newsTime(c.fetchedAt))}${summary?`<br>${esc(summary.slice(0,220))}${summary.length>220?'…':''}`:''}</div></div></div>`}).join(''):'<div class="idea-empty"><p>Chưa có thẻ tin nào. Bấm “Quét ngay” ở một nguồn để lấy tin mới.</p></div>';
 }catch(e){sBox.innerHTML=`<div class="idea-empty"><p>${esc(e.message)}</p></div>`}
}
function renderNewsFields(fieldsRes,summaryRes){
 const box=$('#newsFields'),sumBox=$('#newsFieldSummary');if(!box)return;
 if(!fieldsRes||!Array.isArray(fieldsRes.fields)){box.innerHTML='<div class="idea-empty"><p>Chưa tải được danh sách lĩnh vực.</p></div>';return}
 const perf=new Map(((summaryRes&&summaryRes.fields)||[]).map(x=>[x.fieldId,x]));
 box.innerHTML=fieldsRes.fields.map(f=>{const p=perf.get(f.id);return `<div class="idea-stack-card" style="margin:8px 0"><div style="flex:1;min-width:0"><div class="idea-stack-title">${esc(f.label)}<span class="idea-stack-status ${f.enabled?'needed':''}">● ${f.enabled?'Đội đang bật':'Đội đang tắt'}</span></div><div class="idea-stack-description">${f.sources} nguồn · ${f.cards} thẻ tin · ${f.unusedCards} chưa dùng · điểm cao nhất ${f.topScore}${p&&p.posts?`<br>Đã đăng ${p.posts} bài · ${p.views} lượt xem · ${p.likes} lượt thích`:''}</div></div><div class="inline"><label class="checkboxLine" style="margin:0"><input type="checkbox" data-news-field-toggle="${esc(f.id)}" ${f.enabled?'checked':''}> Bật đội</label>${f.sources?`<button type="button" class="ghost small" data-news-field-scan="${esc(f.id)}">Quét tin</button>`:`<button type="button" class="ghost small" data-news-field-source="${esc(f.id)}">+ Thêm nguồn</button>`}</div></div>`}).join('')+(fieldsRes.unclassified?`<p class="idea-stack-description" style="margin:6px 2px">${fieldsRes.unclassified} thẻ tin chưa phân loại (không thuộc lĩnh vực nào).</p>`:'');
 if(sumBox){const rows=(summaryRes&&summaryRes.fields||[]).filter(x=>x.posts>0);sumBox.innerHTML=rows.length?`<div class="idea-stack-description">Hiệu quả theo lĩnh vực: ${rows.map(x=>`${esc(x.label)} — ${x.posts} bài, ${x.views} lượt xem`).join(' · ')}</div>`:'';}
}
$('#newsSourceForm').onsubmit=e=>{e.preventDefault();(async()=>{try{
 const name=$('#newsName').value.trim(),url=$('#newsUrl').value.trim();
 const keywords=$('#newsKeywords').value.split(',').map(x=>x.trim()).filter(Boolean);
 if(!url)throw new Error('Hãy nhập địa chỉ RSS/Atom.');
 await api('/api/ingest/sources',{method:'POST',body:JSON.stringify({name:name||url,url,kind:'auto',keywords})});
 $('#newsName').value='';$('#newsUrl').value='';$('#newsKeywords').value='';
 toast('Đã thêm nguồn tin');await renderNewsSources();
}catch(err){toast(err.message)}})();};
$('#newsPanel').addEventListener('click',async e=>{
 const scan=e.target.closest('[data-news-scan]'),del=e.target.closest('[data-news-delete]');
 const fsrc=e.target.closest('[data-news-field-source]'),fscan=e.target.closest('[data-news-field-scan]');
 if(fsrc){fsrc.disabled=true;try{const r=await api(`/api/ingest/fields/${encodeURIComponent(fsrc.dataset.newsFieldSource)}/source`,{method:'POST',body:'{}'});toast(r.created?'Đã thêm nguồn tin theo lĩnh vực':'Lĩnh vực này đã có nguồn');await api('/api/ingest/scan',{method:'POST',body:'{}'});await renderNewsSources()}finally{fsrc.disabled=false}return}
 if(fscan){fscan.disabled=true;try{await api('/api/ingest/scan',{method:'POST',body:'{}'});toast('Đã quét tin');await renderNewsSources()}finally{fscan.disabled=false}return}
 try{
  if(e.target.id==='newsScanAll'){e.target.disabled=true;try{await api('/api/ingest/scan',{method:'POST',body:'{}'});toast('Đã quét tất cả nguồn tin');await renderNewsSources()}finally{e.target.disabled=false}return}
  if(scan){scan.disabled=true;try{await api('/api/ingest/scan',{method:'POST',body:JSON.stringify({sourceId:scan.dataset.newsScan})});toast('Đã quét nguồn tin')}finally{scan.disabled=false}await renderNewsSources();return}
  if(del){if(!confirm('Xóa nguồn tin này? Các thẻ tin đã lấy vẫn được giữ lại.'))return;await api(`/api/ingest/sources/${encodeURIComponent(del.dataset.newsDelete)}`,{method:'DELETE'});toast('Đã xóa nguồn tin');await renderNewsSources();return}
 }catch(err){toast(err.message)}
});
$('#newsPanel').addEventListener('change',async e=>{
 const ft=e.target.closest('[data-news-field-toggle]');
 if(ft){try{await api(`/api/ingest/fields/${encodeURIComponent(ft.dataset.newsFieldToggle)}/enabled`,{method:'POST',body:JSON.stringify({enabled:ft.checked})});toast(ft.checked?'Đã bật đội tin':'Đã tắt đội tin');await renderNewsSources()}catch(err){toast(err.message);ft.checked=!ft.checked}return}
 const t=e.target.closest('[data-news-toggle]');if(!t)return;
 try{await api(`/api/ingest/sources/${encodeURIComponent(t.dataset.newsToggle)}/enabled`,{method:'POST',body:JSON.stringify({enabled:t.checked})});await renderNewsSources()}
 catch(err){toast(err.message);t.checked=!t.checked}
});
document.addEventListener('page-change',e=>{if(e.detail.page==='radar')renderNewsSources()});
renderNewsSources();

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
const IDEA_TASK_STATUS={preparing:['Đang chuẩn bị','warn'],running:['Đang làm','warn'],testing:['Đang kiểm thử','warn'],repairing:['Đang sửa','warn'],reviewing:['Đang review','warn'],merging:['Đang gộp','warn'],review:['Chờ duyệt','warn'],done:['Đã xong','good'],completed:['Đã xong','good'],failed:['Lỗi','bad'],blocked:['Bị chặn','bad'],stale:['Lỗi thời','bad'],interrupted:['Bị gián đoạn','bad'],ready:['Sẵn sàng',''],queued:['Chờ làm',''],pending:['Chờ làm','']};
function ideaRenderWork(p){
 const box=$('#ideaWorkBoard');if(!box)return;
 if(!p){box.innerHTML='<div class="empty">Chưa chọn dự án. Cứ nhắn ý tưởng vào ô chat bên trái — trưởng phòng sẽ tạo dự án và nhận việc.</div>';return}
 const tasks=p.tasks||[];
 const stageNames={idea:'Ý tưởng',discovery:'Đang làm rõ',spec:'Đã có spec',build:'Đang làm',building:'Đang làm',review:'Đang duyệt',done:'Hoàn thành',published:'Đã đăng'};
 const spec=p.specifications?.length?`Spec v${p.specifications.length} · ${p.approvedSpecificationId?'đã duyệt':'chờ duyệt'}`:(p.analyzedBrief?'Đã phân tích brief · chưa họp đội':'Chưa phân tích');
 const counts={};for(const t of tasks){const k=IDEA_TASK_STATUS[t.status]?.[0]||t.status;counts[k]=(counts[k]||0)+1}
 const head=`<p style="margin:4px 0"><b>Giai đoạn:</b> ${esc(stageNames[p.stage]||p.stage||'—')} · <b>Hồ sơ:</b> ${esc(spec)}</p>`
   +(tasks.length?`<p class="muted" style="margin:2px 0 8px">${tasks.length} việc: ${Object.entries(counts).map(([k,v])=>`${esc(k)} ${v}`).join(' · ')}</p>`:'<p class="muted" style="margin:2px 0 8px">Đội chưa chia việc. Khi trưởng phòng nhận việc, các việc sẽ hiện ở đây.</p>');
 const rows=tasks.slice(0,30).map(t=>{const st=IDEA_TASK_STATUS[t.status]||[t.status,''];const who=t.assignedWorker?.label||t.workerBinding?.label||t.assignedWorker?.connectionId||'Worker AI';return `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)"><span class="tag ${st[1]}">${esc(st[0])}</span><span style="flex:1">${esc(t.title||'(việc)')}</span><span class="muted">${esc(who)}</span>${Number.isFinite(t.progress)?`<span class="muted">${t.progress}%</span>`:''}</div>`}).join('');
 const acts=(p.activity||[]).slice(-6).reverse().map(a=>`<p class="muted" style="margin:2px 0">• ${esc(a.text||'')}</p>`).join('');
 box.innerHTML=head+rows+(acts?`<h4 style="margin:10px 0 4px">Hoạt động gần đây</h4>${acts}`:'');
}
let ideaWorkTimer=null;
document.addEventListener('page-change',e=>{
 if(e.detail.page==='idea'){clearInterval(ideaWorkTimer);ideaWorkTimer=setInterval(async()=>{if(ideaDirty||!state.project?.id)return;try{const p=await api(`/api/projects/${encodeURIComponent(state.project.id)}`);ideaRenderWork(p);}catch{}},20000);}
 else clearInterval(ideaWorkTimer);
});
let ideaIntakeTimer=null;
function ideaIntakePing(){
 const active=ideaDirty||!!(state.project?.messages||[]).some(m=>m.role==='user');
 if(active){try{localStorage.setItem('aios-intake',JSON.stringify({ts:Date.now(),lead:ideaRole?.connectionId||null}));}catch{}}
}
document.addEventListener('page-change',e=>{
 if(e.detail.page==='idea'){ideaSource=localStorage.getItem('aios-idea-source')||'new';ideaRenderSource();ideaIntakePing();clearInterval(ideaIntakeTimer);ideaIntakeTimer=setInterval(ideaIntakePing,25000);}
 else{clearInterval(ideaIntakeTimer);ideaIntakeTimer=null;}
});
{const aj=$('#ideaAcceptJob'); if(aj)aj.addEventListener('click',()=>ideaAction(async()=>{await ideaEnsureProject();ideaIntakePing();toast('Trưởng phòng đã nhận việc — đội chuyển sang họp chốt spec.');page('council');}));}

{const ft=$('#ideaFormToggle'); if(ft)ft.addEventListener('click',()=>{const pg=$('#page-idea');const on=pg.classList.toggle('show-form');ft.textContent=on?'💬 Chỉ dùng ô chat':'📝 Mẫu chi tiết';});}
async function ideaEnsureProject(){
 const f=ideaFields();
 if(['name','productType','audience','goals'].every(k=>f[k]))return ideaSave();
 const payload={name:f.name||'Dự án mới',productType:f.productType||'',audience:f.audience||'',goals:f.goals||'',mainFeatures:f.mainFeatures};
 const p=ideaDraft||!state.project?await api('/api/projects',{method:'POST',body:JSON.stringify(payload)}):await api(`/api/projects/${encodeURIComponent(state.project.id)}/brief`,{method:'POST',body:JSON.stringify(payload)});
 ideaDirty=false;ideaDraft=false;state.project=p;await loadProjects();return p;
}
