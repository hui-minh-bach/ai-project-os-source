async function renderPublish(){loadClosedLoop();loadSocialHub();}
/* ---- Vòng khép kín & đăng nền tảng (YouTube / Facebook / TikTok) ---- */
const clPipelines=[['news-video','Tin tức → Video ngắn'],['news-article','Tin tức → Bài phân tích'],['dub-video','Video nước ngoài → Lồng tiếng'],['idea-film','Ý tưởng → Phim ngắn']];
const clPlatformList=[['youtube','YouTube'],['facebook','Facebook'],['tiktok','TikTok']];
const clRunStates={pending:'Đang chờ',queued:'Đang chờ',scheduled:'Đã lên lịch',running:'Đang chạy','awaiting-approval':'Chờ duyệt đăng',approved:'Đã duyệt',publishing:'Đang đăng',completed:'Hoàn thành',done:'Hoàn thành',succeeded:'Hoàn thành',failed:'Thất bại',error:'Thất bại',stopped:'Đã dừng',cancelled:'Đã hủy',skipped:'Bỏ qua'};
const clStepStates={pending:'chờ',queued:'chờ',running:'đang chạy',completed:'xong',done:'xong',succeeded:'xong',failed:'lỗi',error:'lỗi',skipped:'bỏ qua'};
let clData={config:null,runs:[],platforms:{},records:[]};
function clTime(x){if(!x)return '';const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('vi-VN'):''}
function clSafeUrl(u){u=String(u||'');return /^https?:\/\//i.test(u)?u:''}
function clSimBadge(sim){return sim?'<span class="tag warn">MÔ PHỎNG</span>':''}
function clRenderPlatforms(){
 const box=$('#clPlatforms');if(!box)return;
 box.innerHTML=clPlatformList.map(([key,name])=>{
  const p=clData.platforms[key]||{};
  const tags=[p.connected?'<span class="tag good">Đã liên kết</span>':'<span class="tag bad">Chưa liên kết</span>',clSimBadge(p.simulated),key==='tiktok'?(p.tiktokApproved?'<span class="tag good">App đã duyệt</span>':'<span class="tag warn">App chưa duyệt · chỉ đăng riêng tư</span>'):''].filter(Boolean).join(' ');
  return `<div class="card"><h4>${name}</h4><p>${p.connected?esc(p.accountLabel||'Đã liên kết tài khoản'):'Chưa liên kết — vào tab Kết nối để liên kết tài khoản.'}</p><div class="skillchips">${tags}</div><p class="muted">Đã ghi nhận ${esc(clData.records.filter(r=>r.platform===key).length)} bài đăng</p></div>`;
 }).join('');
}
function clRenderControls(){
 const box=$('#clControls');if(!box)return;const cfg=clData.config;
 const banner=$('#clStopBanner');
 if(banner)banner.innerHTML=cfg?.stopAll?'<div class="notice" style="border-color:#6f3333;color:#ffb3b3;background:#2a1215">⛔ Vòng khép kín ĐÃ DỪNG TOÀN BỘ — không lượt chạy mới nào được bắt đầu cho đến khi bỏ dừng.</div>':'';
 if(!cfg){box.innerHTML='<div class="empty">Chưa tải được cấu hình bộ điều phối.</div>';return}
 box.innerHTML=`
 <label class="checkboxLine"><input type="checkbox" id="clEnabled" ${cfg.enabled?'checked':''}> Bật bộ điều phối vòng khép kín (tự chạy theo lịch & trần mỗi ngày)</label>
 <label class="checkboxLine" style="color:var(--danger);font-weight:700"><input type="checkbox" id="clStopAll" ${cfg.stopAll?'checked':''}> ⛔ DỪNG TOÀN BỘ — áp dụng ngay, chặn mọi lượt chạy mới</label>
 ${clPipelines.map(([key,name])=>{const p=cfg.pipelines?.[key]||{};const hours=Array.isArray(p.activeHours)?p.activeHours:[7,21];return `<div class="check" style="margin:10px 0">
   <div class="inline" style="justify-content:space-between"><strong>${name}</strong><span class="inline"><button class="ghost small" type="button" data-cl-run="${key}">Chạy ngay</button><label class="checkboxLine" style="margin:0"><input type="checkbox" data-cl-pipe-enabled="${key}" ${p.enabled?'checked':''}> Bật</label></span></div>
   <div class="inline" style="margin-top:8px;gap:14px">
     <label style="margin:0">Chế độ AI <select data-cl-pipe-mode="${key}" style="width:auto"><option value="gateway" ${p.aiMode!=='simulated'?'selected':''}>AI tài khoản</option><option value="simulated" ${p.aiMode==='simulated'?'selected':''}>Mô phỏng</option></select></label>
     ${['news-video','idea-film'].includes(key)?`<label style="margin:0">Nhạc nền <select data-cl-pipe-music="${key}" style="width:auto"><option value="synthesized" ${p.musicSource!=='ace-step'?'selected':''}>Nhạc tổng hợp (mặc định)</option><option value="ace-step" ${p.musicSource==='ace-step'?'selected':''}>ACE-Step tại chỗ (khi sẵn sàng)</option></select></label>`:''}
     <label class="checkboxLine" style="margin:0"><input type="checkbox" data-cl-pipe-approval="${key}" ${p.requireApproval?'checked':''}> Duyệt trước khi đăng</label>
     <label style="margin:0">Tối đa/ngày <input type="number" min="0" max="100" data-cl-pipe-cap="${key}" value="${Number.isFinite(+p.dailyCap)?+p.dailyCap:2}" style="width:70px"></label>
     <label style="margin:0">Giờ chạy <input type="number" min="0" max="23" data-cl-pipe-from="${key}" value="${Number.isFinite(+hours[0])?+hours[0]:7}" style="width:60px"> – <input type="number" min="0" max="23" data-cl-pipe-to="${key}" value="${Number.isFinite(+hours[1])?+hours[1]:21}" style="width:60px"></label>
   </div>
   <div class="inline" style="margin-top:6px"><span class="muted">Đăng lên:</span>${clPlatformList.map(([pk,pn])=>`<label class="checkboxLine" style="margin:0"><input type="checkbox" data-cl-pipe-platform="${key}:${pk}" ${(p.platforms||[]).includes(pk)?'checked':''}> ${pn}</label>`).join('')}</div>
 </div>`}).join('')}
 <button id="clSaveConfig" class="primary" type="button">Lưu cấu hình vòng khép kín</button>`;
}
function clRenderRuns(){
 const box=$('#clRuns');if(!box)return;
 const runs=[...(clData.runs||[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,20);
 if(!runs.length){box.innerHTML='<div class="empty">Chưa có lượt chạy nào.</div>';return}
 box.innerHTML=runs.map(r=>{
  const name=(clPipelines.find(p=>p[0]===r.pipeline)||[])[1]||r.pipeline||'';
  const stateTag=r.state==='awaiting-approval'?'warn':r.state==='failed'||r.state==='error'?'bad':['completed','done','succeeded'].includes(r.state)?'good':'';
  const steps=(r.steps||[]).map(s=>`<span class="tag ${s.state==='failed'||s.state==='error'?'bad':['completed','done','succeeded'].includes(s.state)?'good':s.state==='running'?'warn':''}">${esc(s.name)}: ${esc(clStepStates[s.state]||s.state||'')}${s.detail?` · ${esc(typeof s.detail==='object'?JSON.stringify(s.detail):s.detail)}`:''}</span>`).join(' ');
  return `<div class="task" style="margin:8px 0"><div class="inline" style="justify-content:space-between"><strong>${esc(name)}</strong><span class="tag ${stateTag}">${esc(clRunStates[r.state]||r.state||'')}</span></div><div class="meta">${esc(clTime(r.createdAt))}${r.projectId?` · Dự án: ${esc(r.projectId)}`:''}${r.cardId?` · Thẻ tin: ${esc(r.cardId)}`:''}</div>${steps?`<div class="skillchips">${steps}</div>`:''}${r.error?`<p class="bad">${esc(r.error.message||JSON.stringify(r.error))}</p>`:''}${r.state==='failed'&&!r.publishAttempted&&!(r.publish||[]).length&&(r.retryCount||0)<3?`<button class="ghost small" type="button" data-cl-retry="${esc(r.id)}">Thử lại bước lỗi (giữ kết quả cũ)</button>`:''}${r.state==='awaiting-approval'?`<button class="primary small" type="button" data-cl-approve="${esc(r.id)}">Duyệt đăng</button>`:''}</div>`;
 }).join('');
}
function clRenderRecords(){
 const box=$('#clRecords');if(!box)return;const rows=[...(clData.records||[])].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
 if(!rows.length){box.innerHTML='<div class="empty">Chưa có bài đăng nào được ghi nhận.</div>';return}
 const fmt=n=>n===null||n===undefined?'—':new Intl.NumberFormat('vi-VN').format(n);
 const updated=rows.map(r=>r.metricsUpdatedAt).filter(Boolean).sort().at(-1);
 box.innerHTML=`<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>${['Nền tảng','Tiêu đề','Thời gian','Lượt xem','Thích','Bình luận','Liên kết'].map(h=>`<th style="text-align:left;padding:6px;border-bottom:1px solid var(--line)">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>{const url=clSafeUrl(r.url);const pn=(clPlatformList.find(p=>p[0]===r.platform)||[])[1]||r.platform||'';return `<tr><td style="padding:6px;border-bottom:1px solid var(--line)">${esc(pn)} ${clSimBadge(r.simulated)}${r.draft?' <span class="tag warn">📝 Bản nháp</span>':''}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${esc(r.title||r.platformVideoId||'')}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${esc(clTime(r.publishedAt))}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${fmt(r.metrics?.views)}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${fmt(r.metrics?.likes)}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${fmt(r.metrics?.comments)}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Mở ↗</a>`:'—'}</td></tr>`}).join('')}</tbody></table></div>${updated?`<p class="muted">Số liệu cập nhật lần cuối: ${esc(clTime(updated))}</p>`:''}`;
}
async function loadClosedLoop(){
 if(!$('#closedLoopPanel'))return;
 const [statusR,orchR,recR]=await Promise.allSettled([api('/api/integrations/status'),api('/api/orchestrator'),api('/api/publish/records')]);
 if(statusR.status==='fulfilled'){clData.platforms=statusR.value.media?.platforms||{};clData.publishRecordTotal=statusR.value.media?.publishRecords??null}
 if(orchR.status==='fulfilled'){clData.config=orchR.value.config||null;clData.runs=orchR.value.runs||[]}
 if(recR.status==='fulfilled'){clData.records=recR.value.records||[]}
 clRenderPlatforms();clRenderControls();clRenderRuns();clRenderRecords();clRenderStats();
}
function clCollectConfig(){
 const cfg=structuredClone(clData.config||{pipelines:{}});
 cfg.enabled=$('#clEnabled')?.checked||false;
 cfg.stopAll=$('#clStopAll')?.checked||false;
 cfg.pipelines=cfg.pipelines||{};
 for(const [key] of clPipelines){
  const p=cfg.pipelines[key]||(cfg.pipelines[key]={});
  p.enabled=$(`[data-cl-pipe-enabled="${key}"]`)?.checked||false;
  p.aiMode=$(`[data-cl-pipe-mode="${key}"]`)?.value||'gateway';
  if(['news-video','idea-film'].includes(key))p.musicSource=$(`[data-cl-pipe-music="${key}"]`)?.value||'synthesized';
  p.requireApproval=$(`[data-cl-pipe-approval="${key}"]`)?.checked||false;
  p.dailyCap=Math.max(0,parseInt($(`[data-cl-pipe-cap="${key}"]`)?.value,10)||0);
  const from=parseInt($(`[data-cl-pipe-from="${key}"]`)?.value,10),to=parseInt($(`[data-cl-pipe-to="${key}"]`)?.value,10);
  p.activeHours=[Number.isFinite(from)?from:7,Number.isFinite(to)?to:21];
  p.platforms=clPlatformList.filter(([pk])=>$(`[data-cl-pipe-platform="${key}:${pk}"]`)?.checked).map(([pk])=>pk);
 }
 return cfg;
}
async function clRunPipeline(key){
 const body={pipeline:key};
 if(key==='news-video'||key==='news-article'){
  const x=await api('/api/ingest/cards');
  const unused=(x.cards||[]).filter(c=>!c.usedByProjectId).sort((a,b)=>new Date(a.publishedAt||a.fetchedAt)-new Date(b.publishedAt||b.fetchedAt));
  if(!unused.length){toast('Chưa có thẻ tin chưa dùng — quét nguồn tin ở tab Idea trước');return}
  body.cardId=unused[0].id;
 }
 if(key==='idea-film'){const idea=prompt('Noi dung y tuong phim:');if(!idea?.trim())return;body.ideaText=idea;}
 if(key==='dub-video'){toast('Tai video nguon trong Video Studio va chon long tieng.');return;}
 const r=await api('/api/orchestrator/run',{method:'POST',body:JSON.stringify(body)});
 if(r.run?.state==='failed'){await loadClosedLoop();throw new Error(r.run.error?.message||'Quy trinh that bai.');}
 toast('Đã bắt đầu lượt chạy'+(r.run?.id?` ${r.run.id}`:''));
 await loadClosedLoop();
}
$('#closedLoopPanel').addEventListener('click',async e=>{
 const retryBtn=e.target.closest('[data-cl-retry]');
 const runBtn=e.target.closest('[data-cl-run]'),apBtn=e.target.closest('[data-cl-approve]');
 try{
  if(e.target.id==='clRefresh'){await loadClosedLoop();toast('Đã làm mới vòng khép kín');return}
  if(e.target.id==='clMetricsRefresh'||e.target.id==='pubStatsRefresh'){e.target.disabled=true;try{await api('/api/publish/metrics/refresh',{method:'POST',body:'{}'});await loadClosedLoop();toast('Đã cập nhật số liệu')}finally{e.target.disabled=false}return}
  if(e.target.id==='clSaveConfig'){const config=clCollectConfig();const saved=await api('/api/orchestrator/config',{method:'POST',body:JSON.stringify({config})});clData.config=saved.config||config;clRenderControls();toast('Đã lưu cấu hình vòng khép kín');return}
  if(runBtn){runBtn.disabled=true;try{await clRunPipeline(runBtn.dataset.clRun)}finally{runBtn.disabled=false}return}
  if(retryBtn){retryBtn.disabled=true;try{const r=await api(`/api/orchestrator/runs/${encodeURIComponent(retryBtn.dataset.clRetry)}/retry`,{method:'POST',body:'{}'});if(r.run?.state==='failed')throw new Error(r.run.error?.message||'Thu lai chua thanh cong.');toast('Da chay lai buoc loi; xem ket qua thuc te.');}finally{await loadClosedLoop();retryBtn.disabled=false;}return;}
  if(apBtn){apBtn.disabled=true;const approval=await api(`/api/orchestrator/runs/${encodeURIComponent(apBtn.dataset.clApprove)}/approve`,{method:'POST',body:'{}'});if(approval.run?.state==='failed'){await loadClosedLoop();throw new Error(approval.run.error?.message||'Dang bai that bai.');}toast('Đã duyệt — hệ thống đang đăng bài');await loadClosedLoop();return}
 }catch(err){toast(err.message)}
});
$('#closedLoopPanel').addEventListener('change',async e=>{
 if(e.target.id!=='clStopAll')return;
 try{const r=await api('/api/orchestrator/stop',{method:'POST',body:JSON.stringify({stopAll:e.target.checked})});if(clData.config)clData.config.stopAll=r.stopAll??e.target.checked;clRenderControls();toast(e.target.checked?'⛔ ĐÃ DỪNG toàn bộ vòng khép kín':'Đã bỏ dừng toàn bộ — vòng khép kín hoạt động lại')}
 catch(err){toast(err.message);e.target.checked=!e.target.checked}
});

/* ===== Kho GitHub: existing repos -> project -> issue brief -> PR ===== */
function ghRenderBinding(){
  const box=$('#ghBinding');if(!box)return;const b=state.project?.settings?.github;
  if(!b?.fullName){box.textContent='Dự án đang chọn chưa gắn repo GitHub nào. Nạp danh sách repo ở trên rồi bấm "Nhập thành dự án".';ghRenderContinuation(null);return;}
  const v=b.vercel?(b.vercel.detected?`Vercel: đã nối sẵn trong repo (project ${b.vercel.projectId})`:b.vercel.manual?`Vercel: ${b.vercel.manual}`:''):'';
  box.textContent=`Dự án đang gắn với repo: ${b.fullName} (nhánh gốc ${b.defaultBranch||'main'})${b.issueNumber?` · Đang làm issue #${b.issueNumber}`:''}${b.lastPrUrl?` · PR gần nhất: ${b.lastPrUrl}`:''}${v?' · '+v:''}`;
  ghRenderContinuation(b.continuation||null);
}
function ghRenderContinuation(c){
  const box=$('#ghContinuation');if(!box)return;
  if(!c){box.innerHTML='Chưa đọc hướng dẫn trong repo. Bấm nút <b>"Đọc hướng dẫn & lập việc tiếp tục"</b> để app đọc README/hướng dẫn trong repo, nhận diện liên kết Vercel và lập danh sách việc tiếp tục cho đội AI.';return;}
  const srcName={guide:'📘 Hướng dẫn',issue:'🐛 Issue',todo:'📝 TODO'};
  box.innerHTML=`<b>Đã đọc hướng dẫn trong repo</b> (${esc(String(c.builtAt||'').slice(0,10))})<br>`+
   `File hướng dẫn: ${c.guideFiles?.length?c.guideFiles.map(f=>esc(f.path)).join(', '):'không thấy file nào'}<br>`+
   (c.stack?`Stack: ${esc(c.stack)}<br>`:'')+
   (c.vercel?`Vercel: ${c.vercel.detected?'đã nối sẵn trong repo':esc(c.vercel.manual||'')}<br>`:'')+
   `<b>Danh sách việc tiếp tục (${c.items?.length||0}):</b>`+
   (c.items?.length?c.items.map(i=>`<div class="ghRepoItem"><div>${srcName[i.source]||i.source} — ${esc(i.title)}</div></div>`).join(''):'<div>Chưa rút được mục việc nào (hướng dẫn không có checklist, không có issue mở, không có TODO).</div>')+
   `<small>Brief của dự án đã được viết lại theo hướng dẫn trong repo — trao đổi và nhận việc tại Trưởng phòng tiếp nhận để đội AI lập kế hoạch theo brief này.</small>`;
}
$('#ghLoadRepos')?.addEventListener('click',async()=>{
  const box=$('#ghRepoList');box.textContent='Đang nạp repo từ GitHub…';
  try{const d=await api('/api/github/repos');
    if(!d.available){box.textContent=d.reason||'Chưa liên kết GitHub.';return;}
    if(!d.repos.length){box.textContent='Tài khoản GitHub chưa có repo nào.';return;}
    box.innerHTML=d.repos.map(r=>`<div class="ghRepoItem"><div><b>${esc(r.fullName)}</b> ${r.private?'🔒':'🌐'} <small>${esc(r.description||'')}</small><br><small>Cập nhật: ${esc(String(r.updatedAt||'').slice(0,10))}</small></div>${r.importedProjectId?`<button type="button" class="ghost small" data-gh-open="${esc(r.importedProjectId)}">Mở dự án</button>`:`<button type="button" class="ghost small" data-gh-import="${esc(r.fullName)}">Nhập thành dự án</button>`}</div>`).join('');
  }catch(e){box.textContent='Không nạp được repo: '+e.message;}
});
let ghWatching=null;
const ghStage={queued:'Đang xếp lượt',authenticating:'Đang xác minh GitHub',cloning:'Đang tải code', 'reading-guides':'Đang đọc hướng dẫn và issue',completed:'Đã nhập dự án'};
async function ghWatchImport(id){
 if(ghWatching===id)return;ghWatching=id;const box=$('#ghImportStatus');box.hidden=false;
 try{for(;;){const d=await api('/api/github/import-jobs');const j=d.jobs.find(j=>j.id===id);if(!j)throw new Error('Không tìm thấy lượt nhập repo.');
  box.textContent=`${j.fullName} · ${ghStage[j.stage]||j.stage}${j.percent!==null?' · '+j.percent+'%':''}`;
  if(j.state==='completed'){try{localStorage.removeItem('aiosGithubImport');}catch{}await loadProjects();await chooseProject(j.result.projectId);ghRenderBinding();box.textContent='Đã chọn dự án '+j.fullName+'. Code và hướng dẫn đã sẵn sàng trong workspace.'+(j.result.teamWarning?' '+j.result.teamWarning:'')+(j.result.continuationError?' Chưa đọc được toàn bộ hướng dẫn; bấm Đọc hướng dẫn để thử lại.':'');toast('Đã mở đúng dự án GitHub vừa nhập.');return;}
  if(['failed','interrupted'].includes(j.state)){try{localStorage.removeItem('aiosGithubImport');}catch{}throw new Error(j.error||'Nhập repo chưa hoàn tất.');}await new Promise(r=>setTimeout(r,1500));
 }}catch(e){box.textContent=e.message;}finally{ghWatching=null;$$('[data-gh-import],#ghImportUrl').forEach(b=>{b.disabled=false;if(b.dataset.ghImport)b.textContent='Nhập thành dự án';});}
}
async function ghStartImport(fullName){
 const vercelProject=$('#ghVercelProject')?.value.trim()||'';if(/^https:\/\/github\.com/i.test(vercelProject))throw new Error('Ô Vercel đang chứa link GitHub. Chuyển link đó lên ô Repo GitHub; để trống Vercel nếu chưa cần.');
 const x=await api('/api/github/import-jobs',{method:'POST',body:JSON.stringify({fullName,vercelProject,copyTeamFrom:state.project?.id})});try{localStorage.setItem('aiosGithubImport',x.job.id);}catch{}await ghWatchImport(x.job.id);
}
$('#ghRepoList')?.addEventListener('click',async e=>{
 const open=e.target.closest?.('[data-gh-open]');if(open){await chooseProject(open.dataset.ghOpen);ghRenderBinding();return;}
 const btn=e.target.closest?.('[data-gh-import]');if(!btn)return;btn.disabled=true;
 try{await ghStartImport(btn.dataset.ghImport);}catch(err){$('#ghImportStatus').hidden=false;$('#ghImportStatus').textContent=err.message;btn.disabled=false;}
});
$('#ghImportUrl')?.addEventListener('click',async e=>{e.target.disabled=true;try{await ghStartImport($('#ghRepoUrl').value);}catch(err){$('#ghImportStatus').hidden=false;$('#ghImportStatus').textContent=err.message;}finally{e.target.disabled=false;}});
async function ghResumeImport(){try{const d=await api('/api/github/import-jobs');let pending=null;try{pending=localStorage.getItem('aiosGithubImport');}catch{}const j=d.jobs.find(j=>j.id===pending)||[...d.jobs].reverse().find(j=>['queued','running'].includes(j.state));if(j)void ghWatchImport(j.id);}catch{}}
document.addEventListener('connections-change',ghResumeImport);void ghResumeImport();
$('#ghLoadIssues')?.addEventListener('click',async()=>{
  if(!state.project)return toast('Chọn dự án trước');
  const box=$('#ghIssues');box.textContent='Đang nạp issue…';
  try{const d=await api(`/api/projects/${state.project.id}/github/issues`);
    if(!d.issues.length){box.textContent='Repo chưa có issue đang mở.';return;}
    box.innerHTML=d.issues.map(i=>`<div class="ghRepoItem"><div><b>#${i.number}</b> ${esc(i.title)}<br><small>${esc(i.url)}</small></div><button type="button" class="ghost small" data-gh-issue="${i.number}">Dùng làm brief giao việc</button></div>`).join('');
  }catch(e){box.textContent='Không nạp được issue: '+e.message;}
});
$('#ghIssues')?.addEventListener('click',async e=>{
  const btn=e.target.closest?.('[data-gh-issue]');if(!btn||!state.project)return;btn.disabled=true;
  try{const x=await api(`/api/projects/${state.project.id}/github/issue-brief`,{method:'POST',body:JSON.stringify({number:Number(btn.dataset.ghIssue)})});
    toast(`Đã lấy issue #${x.issue.number} làm brief. Sang tab Ý tưởng/Hội đồng để đội AI lập kế hoạch và giao việc như thường.`);try{await loadProjects?.();}catch{} ghRenderBinding();
  }catch(err){toast(err.message);btn.disabled=false;}
});
$('#ghBuildContinuation')?.addEventListener('click',async()=>{
  if(!state.project)return toast('Chọn dự án trước');
  const box=$('#ghContinuation');box.textContent='Đang đọc hướng dẫn trong repo và lập danh sách việc…';
  try{const x=await api(`/api/projects/${state.project.id}/github/continuation`,{method:'POST',body:JSON.stringify({})});
    try{await loadProjects?.();}catch{} ghRenderBinding();
    toast(`Đã lập ${x.continuation.items?.length||0} việc tiếp tục từ hướng dẫn + issue + TODO. Brief dự án đã cập nhật theo hướng dẫn trong repo.`);
  }catch(e){box.textContent='Chưa lập được: '+e.message;}
});
$('#ghCreatePr')?.addEventListener('click',async()=>{
  if(!state.project)return toast('Chọn dự án trước');
  if(!confirm('Đẩy toàn bộ thay đổi hiện tại của dự án lên GitHub và mở Pull Request? Bạn vẫn duyệt PR trên GitHub trước khi gộp.'))return;
  const out=$('#ghPrResult');out.textContent='Đang commit, push và tạo Pull Request…';
  try{const x=await api(`/api/projects/${state.project.id}/github/pull-request`,{method:'POST',body:JSON.stringify({})});
    out.textContent=`✓ Đã push nhánh ${x.branch}\nPull Request: ${x.url}`;toast('Đã tạo Pull Request trên GitHub');
  }catch(e){out.textContent='Chưa đẩy được: '+e.message;}
});
const ghOrigRenderPublish=renderPublish;
renderPublish=async function(){await ghOrigRenderPublish();ghRenderBinding();};

const PUB_PLATFORM_CATALOG=[['youtube','YouTube','▶️'],['facebook','Facebook','📘'],['tiktok','TikTok','🎵'],['instagram','Instagram','📸'],['threads','Threads','🧵'],['x','X (Twitter)','𝕏'],['zalo','Zalo','💬']];
function clRenderStats(){
 const kpi=$('#pubStatsKpis'),ch=$('#pubStatsChannels');if(!kpi)return;
 const rows=clData.records||[];const posted=rows.filter(r=>!r.draft);const drafts=[...rows.filter(r=>r.draft),...socialData.drafts.filter(r=>r.state!=='published')];
 const fmt=n=>new Intl.NumberFormat('vi-VN').format(n||0);
 const sum=k=>posted.some(r=>Number.isFinite(r.metrics?.[k]))?new Intl.NumberFormat('vi-VN').format(posted.reduce((a,r)=>a+(Number(r.metrics?.[k])||0),0)):'—';
 const hasShares=posted.some(r=>r.metrics&&'shares' in r.metrics);
 const hasFollowers=posted.some(r=>r.metrics&&'followers' in r.metrics);
 const cards=[['Tổng bài đã đăng',fmt(posted.length)],['👁 Lượt xem',sum('views')],['❤️ Lượt thích',sum('likes')],['💬 Bình luận',sum('comments')],['🔁 Chia sẻ',hasShares?sum('shares'):'—'],['👥 Theo dõi mới',hasFollowers?sum('followers'):'—'],['📝 Bản nháp chờ đăng',fmt(drafts.length)]];
 kpi.innerHTML=cards.map(([t,v])=>`<div class="card"><h4>${t}</h4><p style="font-size:22px;font-weight:700">${v}</p></div>`).join('');
 if(ch){
   const by={};for(const r of posted){const b=by[r.platform]||(by[r.platform]={n:0,views:0,likes:0,comments:0,shares:0,followers:0,drafts:0});b.n++;b.views+=Number(r.metrics?.views)||0;b.likes+=Number(r.metrics?.likes)||0;b.comments+=Number(r.metrics?.comments)||0;b.shares+=Number(r.metrics?.shares)||0;b.followers+=Number(r.metrics?.followers)||0;}
   for(const r of drafts){const b=by[r.platform]||(by[r.platform]={n:0,views:0,likes:0,comments:0,shares:0,followers:0,drafts:0});b.drafts++;}
   const known=new Set(PUB_PLATFORM_CATALOG.map(([k])=>k));
   const extras=Object.keys(by).filter(k=>!known.has(k)).map(k=>[k,k,'🌐']);
   ch.innerHTML='<h4 style="margin:12px 0 8px">Thống kê theo nền tảng</h4><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">'
     +[...PUB_PLATFORM_CATALOG,...extras].map(([k,label,icon])=>{const b=by[k];if(!b)return `<div class="card" style="opacity:.75"><h4>${icon} ${esc(label)}</h4><p class="muted" style="margin:4px 0">Chưa có bài đăng nào trên nền tảng này.</p></div>`;
       return `<div class="card"><h4>${icon} ${esc(label)}</h4><p style="margin:4px 0"><b>${fmt(b.n)}</b> bài đã đăng${b.drafts?` · ${fmt(b.drafts)} bản nháp`:''}</p><p class="muted" style="margin:2px 0">👁 ${fmt(b.views)} · ❤️ ${fmt(b.likes)} · 💬 ${fmt(b.comments)} · 🔁 ${hasShares?fmt(b.shares):'—'} · 👥 ${hasFollowers?fmt(b.followers):'—'}</p></div>`;}).join('')+'</div>'
     +(hasFollowers?'':'<p class="muted" style="margin-top:8px">Số "theo dõi mới" chỉ hiện khi nền tảng trả về qua lần cập nhật số liệu; không có thì để trống (—) chứ không ước lượng.</p>');
 }
}

let socialData={channels:[],connections:[],drafts:[]};
async function loadSocialHub(){try{const d=await api('/api/social/channels');socialData={...socialData,...d};$('#socialPlatform').innerHTML=d.channels.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
 $('#socialChannels').innerHTML=d.channels.map(c=>{const linked=d.connections.filter(x=>x.kind===c.id);return `<div class="card"><b>${esc(c.name)}</b><p>${esc(c.note)}</p><small>${c.mode==='export'?'Xuất nội dung · đăng thủ công':c.mode==='video'?'Video ở vòng khép kín':'Kết nối API · cần quyền của nền tảng'}</small>${['threads','x','zalo'].includes(c.id)?`<p>${linked.map(x=>esc(x.name)).join(', ')||'Chưa liên kết'}</p><button data-social-connect="${esc(c.id)}" class="ghost small" type="button">Liên kết bằng token</button>`:''}</div>`;}).join('');await loadSocialDrafts();
 }catch(e){$('#socialStatus').textContent=e.message;}}
async function loadSocialDrafts(){if(!state.project){$('#socialDrafts').textContent='Chọn dự án để lưu bản nháp.';return;}const d=await api('/api/social/drafts?projectId='+encodeURIComponent(state.project.id));socialData.drafts=d.drafts;$('#socialDrafts').innerHTML=d.drafts.map(r=>`<div class="resultBox"><b>${esc(r.title||r.platform)}</b> · ${esc(({draft:'Bản nháp',published:r.simulated?'Xác nhận mô phỏng — chưa đăng thật':'Đã được nền tảng xác nhận',uncertain:'Chưa rõ kết quả — kiểm tra nền tảng',publishing:'Đang gửi'})[r.state]||r.state)}<p style="white-space:pre-wrap">${esc(r.text)}</p><button type="button" class="ghost small" data-social-export="${esc(r.id)}">Tải nội dung .txt</button>${['threads','x','zalo'].includes(r.platform)&&r.state!=='published'?`<select aria-label="Tài khoản đăng bài" data-social-account="${esc(r.id)}">${socialData.connections.filter(c=>c.kind===r.platform).map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.meta?.userId)}</option>`).join('')}</select><button type="button" class="primary small" data-social-preview="${esc(r.id)}">Xem và duyệt đăng</button>`:''}${r.platformPostId?`<p>Mã bài: ${esc(r.platformPostId)}</p>`:''}${r.error?`<p>${esc(r.error)}</p>`:''}</div>`).join('');}
$('#socialChannels').addEventListener('click',e=>{const b=e.target.closest('[data-social-connect]');if(!b)return;const kind=b.dataset.socialConnect;
 modal(`<h3>Liên kết ${esc(kind)}</h3><p>Dùng access token do ứng dụng của bạn trên nền tảng cấp. Không nhập mật khẩu tài khoản. X cần user token có quyền tweet.write; Threads cần threads_basic và threads_content_publish; Zalo cần token OA có quyền nội dung. Chưa có token thì vẫn có thể xuất bản nháp để đăng thủ công.</p><label for="socialToken">Access token</label><input id="socialToken" type="password" autocomplete="off"><button id="socialVerifyToken" class="primary" type="button">Xác minh và lưu</button><p id="socialConnectError" role="status"></p>`);
 $('#socialVerifyToken').onclick=async()=>{const btn=$('#socialVerifyToken');btn.disabled=true;try{await api('/api/social/connect',{method:'POST',body:JSON.stringify({platform:kind,accessToken:$('#socialToken').value})});$('#socialToken').value='';closeCustomerModal();await loadConnections();await loadSocialHub();}catch(err){$('#socialConnectError').textContent=err.message;}finally{btn.disabled=false;}};
});
$('#socialSaveDraft').onclick=async()=>{const b=$('#socialSaveDraft');b.disabled=true;try{if(!state.project)throw new Error('Chọn dự án trước.');await api('/api/social/drafts',{method:'POST',body:JSON.stringify({projectId:state.project.id,platform:$('#socialPlatform').value,title:$('#socialTitle').value,text:$('#socialText').value,coverUrl:$('#socialCover').value})});$('#socialStatus').textContent='Đã lưu bản nháp. Chưa đăng ra mạng.';await loadSocialDrafts();}catch(e){$('#socialStatus').textContent=e.message;}finally{b.disabled=false;}};
$('#socialDrafts').addEventListener('click',async e=>{const ex=e.target.closest('[data-social-export]'),pv=e.target.closest('[data-social-preview]');try{
 if(ex){const r=socialData.drafts.find(r=>r.id===ex.dataset.socialExport);const blob=new Blob([r.title+'\n\n'+r.text+(r.coverUrl?'\n\nẢnh bìa: '+r.coverUrl:'')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='noi-dung-'+r.platform+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
 if(pv){const id=pv.dataset.socialPreview,connectionId=document.querySelector('[data-social-account="'+id+'"]').value;if(!connectionId)throw new Error('Liên kết tài khoản đúng nền tảng trước.');const projectId=state.project.id;const {preview:p}=await api('/api/social/drafts/'+id+'/preview',{method:'POST',body:JSON.stringify({projectId,connectionId})});
 modal(`<h3>Duyệt đăng ${esc(p.platform)}</h3><p>Tài khoản: <b>${esc(p.account)}</b> · ID ${esc(p.accountId)}</p><b>${esc(p.title)}</b><p style="white-space:pre-wrap">${esc(p.text)}</p>${p.coverUrl?`<p>Ảnh bìa: ${esc(p.coverUrl)}</p>`:''}${p.platform==='x'?'<label><input id="socialApiCost" type="checkbox"> Tôi đồng ý chi phí API X theo tài khoản của tôi</label>':''}<p>Thao tác này công khai nội dung trên tài khoản đã chọn.</p><button id="socialConfirmPublish" class="primary" type="button">Duyệt và đăng bài này</button><p id="socialPublishError" role="status"></p>`);
 $('#socialConfirmPublish').onclick=async()=>{const b=$('#socialConfirmPublish');b.disabled=true;try{const allowApiCost=$('#socialApiCost')?.checked===true;await api('/api/social/drafts/'+id+'/publish',{method:'POST',body:JSON.stringify({projectId,connectionId,approvalHash:p.approvalHash,allowApiCost})});closeCustomerModal();await loadSocialDrafts();await loadClosedLoop();}catch(err){$('#socialPublishError').textContent=err.message;}finally{b.disabled=false;}};
 }
 }catch(err){$('#socialStatus').textContent=err.message;}});
document.addEventListener('project-change',()=>{if($('#page-publish').classList.contains('active'))void loadSocialDrafts();});
