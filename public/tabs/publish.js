async function renderPublish(){loadClosedLoop();const p=state.project;if(!p)return;$('#repoName').value=$('#repoName').value||p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');const s=p.stack||{};$('#publishStack').innerHTML=`<div class="mapFlow"><div class="mapNode"><strong>⚡ Database</strong>${s.needsDatabase?'Nên cấu hình trước Production':'Không bắt buộc'}</div><div class="mapNode"><strong>🔐 Auth</strong>${s.needsAuth?'Cần auth provider/RLS':'Không bắt buộc'}</div><div class="mapNode"><strong>🌐 Domain</strong>${s.needsDomain?'Gắn sau khi Production ổn':'Optional'}</div></div>`;try{const g=await api(`/api/projects/${p.id}/git`);$('#gitResult').textContent=g.initialized?`Git local: ${g.branch||'main'}\nRemote: ${g.remote||'chưa có'}`:'Git chưa init.'}catch{}}
$('#initGit').onclick=async()=>{if(!state.project)return toast('Chọn dự án');try{const g=await api(`/api/projects/${state.project.id}/git/init`,{method:'POST',body:'{}'});$('#gitResult').textContent=JSON.stringify(g,null,2);toast('Git local sẵn sàng')}catch(e){toast(e.message)}};
$('#publishGitHub').onclick=async()=>{if(!state.project)return toast('Chọn dự án');try{const x=await api(`/api/projects/${state.project.id}/github/publish`,{method:'POST',body:JSON.stringify({connectionId:$('#githubSelect').value,name:$('#repoName').value,isPrivate:$('#repoPrivate').checked,description:state.project.idea})});$('#gitResult').textContent=`✓ ${x.repo}\n${x.url}`;toast('Đã push GitHub')}catch(e){toast(e.message)}};
async function deploy(prod){if(!state.project)return toast('Chọn dự án');const out=$('#deployResult');out.textContent='Đang deploy...';try{const x=await api(`/api/projects/${state.project.id}/vercel/deploy`,{method:'POST',body:JSON.stringify({connectionId:$('#vercelSelect').value,prod})});out.textContent=(x.url?`✓ ${x.url}\n`:'')+x.output;if(x.url)$('#domainDeployment').value=x.url;toast(prod?'Production deploy xong':'Preview deploy xong')}catch(e){out.textContent=e.message;toast(e.message)}}$('#deployPreview').onclick=()=>deploy(false);$('#deployProd').onclick=()=>{if(confirm('Deploy PRODUCTION? Hãy chắc chắn đã review/test.'))deploy(true)};
function normalizeSupabaseProjects(x){if(Array.isArray(x))return x;if(Array.isArray(x?.projects))return x.projects;return []}
$('#listSupabase').onclick=async()=>{const id=$('#supabaseSelect').value;if(!id)return toast('Chưa có Supabase connection');try{const x=await api(`/api/supabase/${id}/projects`);const list=normalizeSupabaseProjects(x);$('#supabaseProjects').innerHTML=list.length?`<div class="supabaseList">${list.map(p=>`<div class="supabaseRow"><div><b>${esc(p.name||p.ref||p.id)}</b><br><small>${esc(p.ref||p.id||'')} · ${esc(p.region||p.status||'')}</small></div>${p.ref?`<button class="ghost small" data-attach-supabase="${esc(p.ref)}" data-name="${esc(p.name||p.ref)}">Gắn project</button>`:''}</div>`).join('')}</div>`:'Không tìm thấy project hoặc CLI không trả JSON.'}catch(e){$('#supabaseProjects').textContent=e.message;toast(e.message)}};
$('#supabaseProjects').addEventListener('click',async e=>{const b=e.target.closest('[data-attach-supabase]');if(!b)return;try{const x=await api('/api/supabase/attach',{method:'POST',body:JSON.stringify({managementConnectionId:$('#supabaseSelect').value,ref:b.dataset.attachSupabase,name:b.dataset.name})});await loadConnections();toast('Đã lưu Supabase project connection: '+x.name)}catch(err){toast(err.message)}});
$('#openSupabaseCreate').onclick=async()=>{const id=$('#supabaseSelect').value;if(!id)return toast('Chọn Supabase Management/CLI connection');let generated='';try{generated=(await api('/api/supabase/password')).password}catch{}modal(`<h2>Tạo Supabase Project</h2><p>DB password chỉ dùng để tạo project; hệ thống không ghi password vào source. Hãy lưu nó trong password manager nếu muốn dùng trực tiếp Postgres.</p><label>Tên project</label><input id="spName" value="${esc(state.project?.name||'ai-project')}"><label>Organization ID</label><input id="spOrg" placeholder="Bắt buộc với PAT; CLI có thể suy ra nếu tài khoản chỉ có 1 org"><label>Region / smart region</label><input id="spRegion" value="ap-southeast-1"><label>Database password</label><input id="spPass" type="password" value="${esc(generated)}"><button id="createSupabaseNow" class="primary">Tạo project thật</button><div id="spOut" class="resultBox"></div>`);setTimeout(()=>$('#createSupabaseNow').onclick=async()=>{try{$('#createSupabaseNow').disabled=true;const x=await api('/api/supabase/create',{method:'POST',body:JSON.stringify({connectionId:id,name:$('#spName').value,organizationId:$('#spOrg').value,region:$('#spRegion').value,dbPassword:$('#spPass').value})});$('#spOut').textContent=JSON.stringify(x.project||x,null,2);toast('Supabase create request hoàn tất')}catch(e){$('#spOut').textContent=e.message}finally{$('#createSupabaseNow').disabled=false}},0)};
$('#attachDomain').onclick=async()=>{try{const x=await api(`/api/projects/${state.project.id}/vercel/domain`,{method:'POST',body:JSON.stringify({connectionId:$('#vercelSelect').value,deploymentUrl:$('#domainDeployment').value,domain:$('#customDomain').value})});$('#domainResult').textContent=x.output||('✓ '+x.domain);toast('Đã gửi yêu cầu gắn domain')}catch(e){$('#domainResult').textContent=e.message;toast(e.message)}};

/* ---- Vòng khép kín & đăng nền tảng (YouTube / Facebook / TikTok) ---- */
const clPipelines=[['news-video','Tin tức → Video ngắn'],['dub-video','Video nước ngoài → Lồng tiếng'],['idea-film','Ý tưởng → Phim ngắn']];
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
  const steps=(r.steps||[]).map(s=>`<span class="tag ${s.state==='failed'||s.state==='error'?'bad':['completed','done','succeeded'].includes(s.state)?'good':s.state==='running'?'warn':''}">${esc(s.name)}: ${esc(clStepStates[s.state]||s.state||'')}${s.detail?` · ${esc(s.detail)}`:''}</span>`).join(' ');
  return `<div class="task" style="margin:8px 0"><div class="inline" style="justify-content:space-between"><strong>${esc(name)}</strong><span class="tag ${stateTag}">${esc(clRunStates[r.state]||r.state||'')}</span></div><div class="meta">${esc(clTime(r.createdAt))}${r.projectId?` · Dự án: ${esc(r.projectId)}`:''}${r.cardId?` · Thẻ tin: ${esc(r.cardId)}`:''}</div>${steps?`<div class="skillchips">${steps}</div>`:''}${r.error?`<p class="bad">${esc(r.error)}</p>`:''}${r.state==='awaiting-approval'?`<button class="primary small" type="button" data-cl-approve="${esc(r.id)}">Duyệt đăng</button>`:''}</div>`;
 }).join('');
}
function clRenderRecords(){
 const box=$('#clRecords');if(!box)return;const rows=[...(clData.records||[])].sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt));
 if(!rows.length){box.innerHTML='<div class="empty">Chưa có bài đăng nào được ghi nhận.</div>';return}
 const fmt=n=>n===null||n===undefined?'—':new Intl.NumberFormat('vi-VN').format(n);
 const updated=rows.map(r=>r.metricsUpdatedAt).filter(Boolean).sort().at(-1);
 box.innerHTML=`<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr>${['Nền tảng','Tiêu đề','Thời gian','Lượt xem','Thích','Bình luận','Liên kết'].map(h=>`<th style="text-align:left;padding:6px;border-bottom:1px solid var(--line)">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>{const url=clSafeUrl(r.url);const pn=(clPlatformList.find(p=>p[0]===r.platform)||[])[1]||r.platform||'';return `<tr><td style="padding:6px;border-bottom:1px solid var(--line)">${esc(pn)} ${clSimBadge(r.simulated)}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${esc(r.title||r.platformVideoId||'')}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${esc(clTime(r.publishedAt))}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${fmt(r.metrics?.views)}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${fmt(r.metrics?.likes)}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${fmt(r.metrics?.comments)}</td><td style="padding:6px;border-bottom:1px solid var(--line)">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Mở ↗</a>`:'—'}</td></tr>`}).join('')}</tbody></table></div>${updated?`<p class="muted">Số liệu cập nhật lần cuối: ${esc(clTime(updated))}</p>`:''}`;
}
async function loadClosedLoop(){
 if(!$('#closedLoopPanel'))return;
 const [statusR,orchR,recR]=await Promise.allSettled([api('/api/integrations/status'),api('/api/orchestrator'),api('/api/publish/records')]);
 if(statusR.status==='fulfilled'){clData.platforms=statusR.value.media?.platforms||{};clData.publishRecordTotal=statusR.value.media?.publishRecords??null}
 if(orchR.status==='fulfilled'){clData.config=orchR.value.config||null;clData.runs=orchR.value.runs||[]}
 if(recR.status==='fulfilled'){clData.records=recR.value.records||[]}
 clRenderPlatforms();clRenderControls();clRenderRuns();clRenderRecords();
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
 if(key==='news-video'){
  const x=await api('/api/ingest/cards');
  const unused=(x.cards||[]).filter(c=>!c.usedByProjectId).sort((a,b)=>new Date(a.publishedAt||a.fetchedAt)-new Date(b.publishedAt||b.fetchedAt));
  if(!unused.length){toast('Chưa có thẻ tin chưa dùng — quét nguồn tin ở tab Idea trước');return}
  body.cardId=unused[0].id;
 }
 const r=await api('/api/orchestrator/run',{method:'POST',body:JSON.stringify(body)});
 toast('Đã bắt đầu lượt chạy'+(r.run?.id?` ${r.run.id}`:''));
 await loadClosedLoop();
}
$('#closedLoopPanel').addEventListener('click',async e=>{
 const runBtn=e.target.closest('[data-cl-run]'),apBtn=e.target.closest('[data-cl-approve]');
 try{
  if(e.target.id==='clRefresh'){await loadClosedLoop();toast('Đã làm mới vòng khép kín');return}
  if(e.target.id==='clMetricsRefresh'){e.target.disabled=true;try{await api('/api/publish/metrics/refresh',{method:'POST',body:'{}'});await loadClosedLoop();toast('Đã cập nhật số liệu')}finally{e.target.disabled=false}return}
  if(e.target.id==='clSaveConfig'){const config=clCollectConfig();const saved=await api('/api/orchestrator/config',{method:'POST',body:JSON.stringify({config})});clData.config=saved.config||config;clRenderControls();toast('Đã lưu cấu hình vòng khép kín');return}
  if(runBtn){runBtn.disabled=true;try{await clRunPipeline(runBtn.dataset.clRun)}finally{runBtn.disabled=false}return}
  if(apBtn){apBtn.disabled=true;await api(`/api/orchestrator/runs/${encodeURIComponent(apBtn.dataset.clApprove)}/approve`,{method:'POST',body:'{}'});toast('Đã duyệt — hệ thống đang đăng bài');await loadClosedLoop();return}
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
  box.textContent=b?.fullName?`Dự án đang gắn với repo: ${b.fullName} (nhánh gốc ${b.defaultBranch||'main'})${b.issueNumber?` · Đang làm issue #${b.issueNumber}`:''}${b.lastPrUrl?` · PR gần nhất: ${b.lastPrUrl}`:''}`:'Dự án đang chọn chưa gắn repo GitHub nào. Nạp danh sách repo ở trên rồi bấm "Nhập thành dự án".';
}
$('#ghLoadRepos')?.addEventListener('click',async()=>{
  const box=$('#ghRepoList');box.textContent='Đang nạp repo từ GitHub…';
  try{const d=await api('/api/github/repos');
    if(!d.available){box.textContent=d.reason||'Chưa liên kết GitHub.';return;}
    if(!d.repos.length){box.textContent='Tài khoản GitHub chưa có repo nào.';return;}
    box.innerHTML=d.repos.map(r=>`<div class="ghRepoItem"><div><b>${esc(r.fullName)}</b> ${r.private?'🔒':'🌐'} <small>${esc(r.description||'')}</small><br><small>Cập nhật: ${esc(String(r.updatedAt||'').slice(0,10))}</small></div>${r.importedProjectId?'<span>✓ Đã là dự án</span>':`<button type="button" class="ghost small" data-gh-import="${esc(r.fullName)}">Nhập thành dự án</button>`}</div>`).join('');
  }catch(e){box.textContent='Không nạp được repo: '+e.message;}
});
$('#ghRepoList')?.addEventListener('click',async e=>{
  const btn=e.target.closest?.('[data-gh-import]');if(!btn)return;btn.disabled=true;btn.textContent='Đang clone repo…';
  try{const x=await api('/api/github/import',{method:'POST',body:JSON.stringify({fullName:btn.dataset.ghImport})});
    toast('Đã nhập repo thành dự án. Đang tải lại để chọn dự án mới…');setTimeout(()=>location.reload(),900);
  }catch(err){toast(err.message);btn.disabled=false;btn.textContent='Nhập thành dự án';}
});
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
