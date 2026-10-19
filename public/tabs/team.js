const teamActiveStatuses=new Set(['preparing','running','testing','repairing','reviewing','merging']);
const teamStartableStatuses=new Set(['todo','failed','review','interrupted']);
const teamRoleNames={frontend:'Frontend Developer',backend:'Backend Developer',database:'Data Architect',design:'UI/UX Designer',qa:'QA Engineer',devops:'DevOps Engineer',research:'Researcher',security:'Security Reviewer',architecture:'System Architect'};
const teamRoleDescriptions={frontend:'Xây giao diện và các component.',backend:'Thiết kế và triển khai API, business logic, validation.',database:'Thiết kế schema, migration và dữ liệu.',design:'Thiết kế trải nghiệm và giao diện.',qa:'Kiểm tra chất lượng và tiêu chí nghiệm thu.',devops:'Build, môi trường và quy trình phát hành.',research:'Nghiên cứu và kiểm chứng bằng chứng.',security:'Kiểm tra bảo mật và quyền truy cập.',architecture:'Thiết kế kiến trúc và các ranh giới hệ thống.'};
const teamStatusNames={todo:'ready',preparing:'preparing',running:'coding',testing:'testing',repairing:'repairing',reviewing:'reviewing',merging:'merging',review:'rejected',done:'done',failed:'failed',interrupted:'interrupted',stale:'stale','merge-conflict':'merge-conflict','merge-rollback-failed':'rollback-failed'};
const teamProviderNames={openai:'OpenAI / ChatGPT',gemini:'Google Gemini',anthropic:'Anthropic Claude',openai_compatible:'OpenAI-compatible'};
const teamProviderSymbols={openai:'◎',gemini:'✦',anthropic:'✺',openai_compatible:'◎'};
const teamIcons={
  clipboard:'<path d="M8 5H5v16h14V5h-3M9 3h6v4H9zM8 12l3 3 5-6"/>',
  running:'<path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  inbox:'<path d="m3 14 6-10h6l6 10v6H3zM3 14h5l2 3h4l2-3h5"/>',
  frontend:'<rect x="2" y="3" width="20" height="14" rx="1"/><path d="M9 17v4m6-4v4M6 21h12"/>',
  backend:'<rect x="3" y="3" width="18" height="5" rx="1"/><rect x="3" y="10" width="18" height="5" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/><path d="M6 5.5h1m3 0h6M6 12.5h1m3 0h6M6 19h1m3 0h6"/>',
  database:'<rect x="5" y="8" width="14" height="13" rx="2"/><path d="M8 8V6a4 4 0 0 1 8 0v2m-4 5v4"/>',
  design:'<path d="M12 3a9 9 0 0 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-8Z"/><circle cx="7" cy="9" r=".7"/><circle cx="11" cy="6" r=".7"/><circle cx="16" cy="7" r=".7"/>',
  qa:'<path d="M12 3a9 9 0 0 0 0 18h1a2 2 0 0 0 1-4c-1-1 0-3 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-8Z"/><circle cx="7" cy="9" r=".7"/><circle cx="11" cy="6" r=".7"/><circle cx="16" cy="7" r=".7"/>',
  devops:'<path d="M8 16 4 20m6-17c5-2 9-1 10-1 0 2 1 6-2 10l-6 5-5-5 3-9ZM7 9l-4 1-1 5 5-1m8 3-1 5 5-2 1-4"/><circle cx="15" cy="7" r="2"/>',
  security:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>',
  architecture:'<rect x="8" y="2" width="8" height="5" rx="1"/><rect x="2" y="17" width="7" height="5" rx="1"/><rect x="15" y="17" width="7" height="5" rx="1"/><path d="M12 7v5H5v5m7-5h7v5"/>',
  branch:'<circle cx="6" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 6v12m0-5c8 0 12-3 12-6"/>',
  engine:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10m-5-4V9l5-3 5 3v9"/>',
  dependency:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M5 7v7a5 5 0 0 0 5 5h7m-5-14h7v7M19 5l-9 9"/>',
  document:'<path d="M6 2h9l4 4v16H6zM15 2v5h4M9 11h7m-7 4h7m-7 4h5"/>',
  copy:'<rect x="8" y="7" width="11" height="15" rx="1"/><path d="M15 7V2H4v15h4"/>',
  log:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M7 12h10m-10 4h10"/>'
};
const teamSvg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${teamIcons[name]||teamIcons.document}</svg>`;
let teamSelectedProject=null,teamSelectedTask=null,teamDetailTab='description',teamMenuTask=null,teamSettingsPending=false,teamPlanPending=false,teamBatchPending=false,teamPollPending=false;
const teamTaskRequests=new Set();
function teamCurrentSpecification(){const p=state.project,s=p?.specifications?.find(s=>s.id===p.currentSpecificationId),r=p?.councilRuns?.find(r=>r.id===p.currentCouncilRunId);return s&&s.status==='approved'&&s.approvedAt&&p.approvedSpecificationId===s.id&&s.briefRevision===(p.briefRevision||0)&&p.councilBrief?.revision===(p.briefRevision||0)&&p.analyzedBrief?.revision===(p.briefRevision||0)&&r?.status==='completed'&&s.runId===r.id?s:null;}
function teamTaskCurrent(task){const s=teamCurrentSpecification(),p=state.project;return !!s&&task.specificationId===s.id&&p.planSpecificationId===s.id&&(!p.planId||task.planId===p.planId);}
function teamBinding(task,role){
  const active=teamActiveStatuses.has(task.status)||task.status==='done'||task.status==='stale',binding=active?task[role+'Binding']||task['assigned'+(role==='worker'?'Worker':'Reviewer')]||state.project?.modelRoles?.[role]:task['assigned'+(role==='worker'?'Worker':'Reviewer')]||task[role+'Binding']||state.project?.modelRoles?.[role];
  const c=state.connections.find(c=>c.id===binding?.connectionId),snapshot=task[role+'Descriptor'],descriptor=snapshot?.connectionId===binding?.connectionId&&snapshot?.model===binding?.model?snapshot:null;
  return {binding,provider:descriptor?.provider||c?.kind||'',name:descriptor?.name||c?.name||'',model:binding?.model||'',verified:!!c&&c.availability?.status==='verified'&&c.availability.models.includes(binding?.model)};
}
function teamEngineAvailable(task){const id=task.engineId||state.project?.settings?.defaultEngine||'native';return id==='native'||id==='mini-swe-agent'&&state.engines.find(e=>e.id===id)?.runtimeInstalled&&state.project?.settings?.allowUnsafeExternal===true;}
function teamCanRun(task){return teamStartableStatuses.has(task.status)&&teamTaskCurrent(task)&&teamEngineAvailable(task)&&(state.project?.settings?.sandboxMode!=='docker'||state.sandbox?.docker)&&(task.dependsOn||[]).every(id=>state.project.tasks.find(t=>t.id===id)?.status==='done')&&teamBinding(task,'worker').verified&&(state.project?.settings?.reviewRequired===false||teamBinding(task,'reviewer').verified);}
function teamRunReason(task){if(!teamTaskCurrent(task))return 'Cần specification đã chốt và kế hoạch/task cùng phiên bản.';if(!teamEngineAvailable(task))return 'Engine chưa hỗ trợ task, runtime chưa cài hoặc chưa có opt-in UNSAFE.';if(state.project?.settings?.sandboxMode==='docker'&&!state.sandbox?.docker)return 'Docker runtime chưa khả dụng; chọn Safe để dùng file tools.';if(!teamBinding(task,'worker').verified)return 'Phân vai Worker đã xác minh trong Kết nối hoặc sửa task.';if(state.project?.settings?.reviewRequired!==false&&!teamBinding(task,'reviewer').verified)return 'Phân vai Reviewer đã xác minh trong Kết nối hoặc sửa task.';if((task.dependsOn||[]).some(id=>state.project.tasks.find(t=>t.id===id)?.status!=='done'))return 'Còn dependency chưa hoàn tất.';return teamStartableStatuses.has(task.status)?'Chạy trên worktree riêng':'Trạng thái này chưa hỗ trợ chạy lại.';}
function teamColumn(task){if(task.status==='done')return 'done';if(['review','reviewing','merge-conflict','merge-rollback-failed'].includes(task.status))return 'review';if(teamActiveStatuses.has(task.status))return 'running';return 'ready';}
function teamProgress(task){return typeof task.progress==='number'&&Number.isFinite(task.progress)&&task.progress>=0&&task.progress<=100?`${task.progress}%`:'Chưa đo';}
function teamDuration(task){if(task.durationMs!==null&&task.durationMs!==undefined&&Number.isFinite(task.durationMs))return teamFormatDuration(task.durationMs);if(task.startedAt&&teamActiveStatuses.has(task.status))return teamFormatDuration(Math.max(0,Date.now()-Date.parse(task.startedAt)));return 'Chưa chạy';}
function teamFormatDuration(ms){const s=Math.floor(ms/1000);return s>=3600?`${Math.floor(s/3600)} giờ ${Math.floor(s%3600/60)} phút`:s>=60?`${Math.floor(s/60)} phút ${s%60} giây`:`${s} giây`;}
function teamDate(at){return at&&Number.isFinite(Date.parse(at))?new Date(at).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}):'Chưa có';}
function teamTime(at){return at&&Number.isFinite(Date.parse(at))?new Date(at).toLocaleTimeString('vi-VN',{hour12:false}):'--:--:--';}
function teamEngineName(id){return state.engines.find(e=>e.id===id)?.name||(id==='native'?'Native AI':id||'Chưa chọn');}
function teamEngineOptions(selected,defaultLabel=false){
  const engines=state.engines.length?state.engines:[{id:'native',name:'Native AI',execution:'full'}];
  return engines.map(e=>{const supported=e.id==='native'||e.id==='mini-swe-agent'&&e.runtimeInstalled&&state.project?.settings?.allowUnsafeExternal===true;const reason=e.id==='mini-swe-agent'?!e.runtimeInstalled?'runtime chưa cài':!state.project?.settings?.allowUnsafeExternal?'cần opt-in UNSAFE':'UNSAFE':e.id!=='native'?'chưa hỗ trợ task':'';return `<option value="${esc(e.id)}" ${selected===e.id?'selected':''} ${supported?'':'disabled'}>${esc(e.name)}${defaultLabel&&e.id===state.project?.settings?.defaultEngine?' (mặc định)':''}${reason?' · '+esc(reason):''}</option>`;}).join('');
}
function teamCard(task){
  const worker=teamBinding(task,'worker'),status=teamStatusNames[task.status]||task.status,measured=teamProgress(task)!=='Chưa đo',active=teamActiveStatuses.has(task.status);
  const branch=task.branch||'Chưa tạo branch',pathState=task.worktreeState==='removed'?'Worktree đã dọn':task.worktreeState==='active'?'Worktree riêng':task.worktreeState==='retained'?'Worktree được giữ':task.worktreeState==='unknown'?'Worktree chưa xác minh':'Worktree chưa tạo';
  return `<article class="team-task-card ${teamSelectedTask===task.id?'selected':''}" data-team-task="${esc(task.id)}" tabindex="0" role="button" aria-label="Chọn ${esc(task.title)}" aria-pressed="${teamSelectedTask===task.id}">
    <div class="team-task-heading"><span class="team-role-icon ${esc(task.role)}">${teamSvg(task.role)}</span><div><div class="team-card-name"><h4>${esc(task.title)}</h4><span class="team-role-pill">${esc(teamRoleNames[task.role]||task.role)}</span></div><p class="team-card-description" title="${esc(task.description)}">${esc(task.description||'Chưa có mô tả')}</p></div><button type="button" class="team-card-menu-button" data-team-action="menu" data-task="${esc(task.id)}" aria-label="Thao tác ${esc(task.title)}" aria-expanded="${teamMenuTask===task.id}">⋮</button></div>
    <div class="team-card-binding" title="${esc(worker.name)} · ${esc(worker.model)}"><span class="team-provider-symbol ${esc(worker.provider)}" aria-hidden="true">${teamProviderSymbols[worker.provider]||'◇'}</span><span class="team-provider-name">${esc(teamProviderNames[worker.provider]||'Chưa phân vai Worker')}</span><span class="team-model-name">${esc(worker.model||'Chưa chọn model')}</span></div>
    <div class="team-card-execution"><span title="${esc(teamEngineName(task.engineId))}">${teamSvg('engine')}${esc(teamEngineName(task.engineId))}</span><span title="${esc(branch)} · ${esc(task.worktree||'Chưa tạo worktree')}">${teamSvg('branch')}<span class="team-branch-name">${esc(branch)}${task.branchState==='deleted'?' · đã xóa':''}</span></span></div>
    <div class="team-card-worktree" title="${esc(task.worktree||'Chưa tạo')}">${esc(pathState)}${task.worktree?' · '+esc(task.worktree.split('/').slice(-2).join('/')):''}</div>
    <div class="team-card-footer"><span class="team-status-pill ${esc(task.status)}">${esc(status)}</span><span class="team-priority-pill ${esc(task.priority||'medium')}">${esc(task.priority||'medium')}</span><span class="team-dependency-count" title="Phụ thuộc: ${esc((task.dependsOn||[]).join(', ')||'không có')}">${teamSvg('dependency')}${(task.dependsOn||[]).length}</span></div>
    ${active||measured?`<div class="team-card-progress"><span class="team-progress-track ${measured?'':'unmeasured'}">${measured?`<i style="width:${task.progress}%"></i>`:''}</span><span>${esc(teamProgress(task))}</span></div>`:''}
    ${teamMenuTask===task.id?`<div class="team-card-menu"><button type="button" data-team-action="run" data-task="${esc(task.id)}" ${teamCanRun(task)&&!teamTaskRequests.has(task.id)?'':'disabled'} title="${esc(teamRunReason(task))}">▷ Chạy task trong worktree</button><button type="button" data-team-action="edit" data-task="${esc(task.id)}" ${!active&&task.status!=='done'&&teamTaskCurrent(task)?'':'disabled'}>Sửa task / phân vai</button><button type="button" data-team-action="archive" data-task="${esc(task.id)}" ${!active&&!state.project.tasks.some(t=>t.dependsOn?.includes(task.id))?'':'disabled'}>Lưu trữ task &amp; lịch sử</button></div>`:''}
  </article>`;
}
function renderTasks(){
  const p=state.project;if(teamSelectedProject!==p?.id){teamSelectedProject=p?.id;teamSelectedTask=null;teamDetailTab='description';teamMenuTask=null;}
  renderTeamManagerSelect();
  const tasks=p?.tasks||[];if(!tasks.some(t=>t.id===teamSelectedTask))teamSelectedTask=(tasks.find(t=>teamActiveStatuses.has(t.status))||tasks.find(t=>teamColumn(t)==='review')||tasks[0])?.id||null;
  const columns=[{id:'ready',title:'Ready',subtitle:'Sẵn sàng chạy',icon:'clipboard',empty:'Chưa có task sẵn sàng.',hint:'Task có dependency sẽ chờ task trước hoàn tất.'},{id:'running',title:'Running',subtitle:'Đang thực thi song song',icon:'running',empty:'Chưa có task đang chạy.',hint:'Mỗi Worker chạy trên một branch và worktree riêng.'},{id:'review',title:'Review',subtitle:'Chờ kiểm tra và phản hồi',icon:'search',empty:'Chưa có task chờ review.',hint:'Reviewer kiểm diff và receipt runtime trước khi merge.'},{id:'done',title:'Done',subtitle:'Hoàn thành',icon:'check',empty:'Chưa có task hoàn thành.',hint:'Các task sau khi được review và merge sẽ xuất hiện ở đây.'}];
  $('#taskBoard').innerHTML=columns.map(c=>{const items=tasks.filter(t=>teamColumn(t)===c.id);return `<section class="team-column ${c.id}" aria-label="${c.title}"><div class="team-column-head"><span class="team-column-icon">${teamSvg(c.icon)}</span><div><h3>${c.title}<small>(${items.length})</small></h3><p>${c.subtitle}</p></div></div>${items.length?`<div class="team-column-list">${items.map(teamCard).join('')}</div>`:`<div class="team-column-empty">${teamSvg('inbox')}<p>${c.empty}</p><small>${c.hint}</small></div>`}</section>`;}).join('');
  renderTeamDetail();renderTeamHistory();renderTeamActionAvailability();
}
function teamCriteria(task){
  const items=task.acceptanceCriteria||String(task.doneWhen||'').split('\n').filter(Boolean).map((text,i)=>({id:`AC${i+1}`,text,status:'not-run'}));
  return items.length?`<ul class="team-criteria-list">${items.map(c=>`<li><span class="team-criteria-mark ${esc(c.status)}" aria-hidden="true">${c.status==='met'?'✓':c.status==='not-met'?'×':''}</span><span>${esc(c.text)}<small>${c.status==='met'?'Đã xác nhận':c.status==='not-met'?'Chưa đạt':'Chưa kiểm chứng'}${c.source?' · nguồn '+esc(c.source):''}${c.evidence?.explanation?' · '+esc(c.evidence.explanation):''}</small></span></li>`).join('')}</ul>`:'<p class="team-empty-copy">Chưa có tiêu chí nghiệm thu.</p>';
}
function teamSkillChips(task,historical=false){const skills=(task.skills||[]).map(id=>state.skills.find(s=>s.id===id)).filter(s=>s&&(historical||s.enabled!==false));return skills.length?`<p>${skills.map(s=>`<span class="team-role-pill" title="${esc(s.description)}">${esc(s.name)}${historical?' · lịch sử':''}</span>`).join(' ')}</p>`:'';}
function teamReceiptRows(task){return (task.testReceipts||[]).length?task.testReceipts.map(r=>{const verified=r.source==='runtime',status=verified?r.status:'UNVERIFIED';return `<div class="team-receipt-row"><b>${esc(r.kind==='test'?'Test runtime':r.kind==='external-command'?'External runtime':'Command runtime')}: ${esc(status)}</b><p>${esc(r.command?.join(' ')||r.reason||'Chưa chạy')} · ${esc(r.mode||'không có sandbox')}<br>Exit: ${r.exitCode===null||r.exitCode===undefined?'không có':esc(r.exitCode)} · ${r.durationMs===undefined?'Chưa đo':esc(r.durationMs)+' ms'} · ${esc(teamDate(r.completedAt))}</p>${r.reason?`<p>${esc(r.reason)}</p>`:''}${r.stdout||r.stderr?`<details><summary>stdout / stderr thực</summary><pre>${esc(r.stdout||'')}${r.stderr?'\nSTDERR:\n'+esc(r.stderr):''}</pre></details>`:''}</div>`;}).join(''):'<p class="team-empty-copy">NOT_RUN — chưa có receipt test/command từ runtime.</p>';}
function teamReviewRows(task){return (task.reviews||[]).length?task.reviews.map((r,i)=>`<div class="team-review-attempt"><b>Review #${i+1} · <span class="${esc(r.status||'UNKNOWN')}">${esc(r.status||'UNKNOWN')}</span> · pass ${esc(r.pass||'—')}</b><p>${esc(r.summary||'Chưa có kết luận')}<br>${esc(r.reviewerBinding?.model||'Chưa có Reviewer')} · ${esc(teamDate(r.at||r.startedAt))}</p>${r.fixes?.length?`<ul>${r.fixes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}${r.raw?`<details><summary>Phản hồi Reviewer</summary><pre>${esc(r.raw)}</pre></details>`:''}</div>`).join(''):'<p class="team-empty-copy">Reviewer chưa chạy; chưa có phê duyệt.</p>';}
function teamLogLines(logs){return logs.length?logs.map(l=>`<div class="team-log-line ${l.kind==='error'?'error':''}"><time datetime="${esc(l.at)}">[${teamTime(l.at)}]</time><span>${esc(l.message||l.status||l.kind||'')}</span></div>`).join(''):'<p class="team-empty-copy">Chưa có log thực thi.</p>';}
function teamDetailBody(task){
  if(teamDetailTab==='acceptance')return `<h4>Tiêu chí chấp nhận (Acceptance Criteria)</h4>${teamCriteria(task)}<p class="team-empty-copy">Chỉ đánh dấu khi có xác nhận cụ thể và ghi nguồn. Summary của Worker không phải bằng chứng.</p><h4>Receipt test / command</h4>${teamReceiptRows(task)}<h4>Reviewer độc lập</h4>${teamReviewRows(task)}`;
  if(teamDetailTab==='dependencies')return `<h4>Phụ thuộc (${(task.dependsOn||[]).length})</h4>${task.dependsOn?.length?task.dependsOn.map(id=>{const dep=state.project.tasks.find(t=>t.id===id);return `<div class="team-dependency-row"><b>${esc(id)} · ${esc(dep?.title||'Task không còn trong kế hoạch')}</b><p>${esc(teamStatusNames[dep?.status]||dep?.status||'unknown')}${dep?.status==='done'?' · đã merge':' · chưa hoàn tất'}</p><button class="ghost small" data-team-select="${esc(id)}" ${dep?'':'disabled'}>Xem task</button></div>`;}).join(''):'<p class="team-empty-copy">Task độc lập, không có dependency.</p>'}`;
  if(teamDetailTab==='commits')return `<h4>Commit (${(task.commits||[]).length})</h4>${task.commits?.length?task.commits.map(c=>`<div class="team-commit-row"><code>${esc(c.sha)}</code><p>${esc(c.message)} · pass ${esc(c.pass||'—')}<br>${esc(teamDate(c.at))}</p></div>`).join(''):'<p class="team-empty-copy">Chưa có commit từ task.</p>'}${task.commitSha?`<p>HEAD cuối của Worker: <code>${esc(task.commitSha)}</code></p>`:''}${task.mergeSha?`<p>Merge main: <code>${esc(task.mergeSha)}</code></p>`:''}${task.rollback?`<p class="team-error">Rollback merge: ${task.rollback.ok?'runtime xác nhận thành công':'THẤT BẠI — main chưa xác minh'} · exit ${esc(task.rollback.exitCode)}</p>`:''}<h4>Branch / worktree lịch sử</h4><p>${esc(task.branch||'Chưa tạo branch')}<br>${esc(task.worktree||'Chưa tạo worktree')}<br>${esc(task.branchState||'Chưa xác minh')} / ${esc(task.worktreeState||'Chưa xác minh')}</p>${task.cleanup?.errors?.length?`<p class="team-error">${esc(task.cleanup.errors.join('\n'))}</p>`:''}`;
  if(teamDetailTab==='logs')return `<h4>Log thực thi (${(task.logs||[]).length})</h4>${teamLogLines(task.logs||[])}<h4>Reviewer độc lập — mọi lần thử</h4>${teamReviewRows(task)}<h4>Receipt test / command</h4>${teamReceiptRows(task)}<details><summary>Agent / tool log — gồm lượt đầu và repair (${(task.agentLog||[]).length})</summary>${(task.agentLog||[]).map(e=>`<pre>${esc(JSON.stringify(e,null,2))}</pre>`).join('')||'<p>Chưa chạy.</p>'}</details><details><summary>Lịch sử các phiên thực thi (${(task.executionRuns||[]).length})</summary>${(task.executionRuns||[]).map(r=>`<p>${esc(r.id)} · ${esc(r.outcome||r.status)} · ${esc(teamDate(r.startedAt))} · ${r.durationMs===undefined?'Chưa đo':esc(teamFormatDuration(r.durationMs))}<br>Worker: ${esc(r.workerBinding?.model||'Chưa có')} · Reviewer: ${esc(r.reviewerBinding?.model||'SKIPPED')}<br>Spec: ${esc(r.specificationId)}</p>`).join('')||'<p>Chưa chạy.</p>'}</details>`;
  return `<div class="team-description-section"><h4>Mô tả task</h4><p>${esc(task.description||'Chưa có mô tả.')}</p>${teamSkillChips(task)}${task.error?`<p class="team-error">${esc(task.error)}</p>`:''}</div><h4>Tiêu chí chấp nhận (Acceptance Criteria)</h4>${teamCriteria(task)}<p class="team-empty-copy">Safe: không chạy npm/shell; test chưa chạy nếu không có receipt runtime. Tiến độ phần trăm chưa đo được sẽ để “Chưa đo”.</p>`;
}
function renderTeamDetail(){
  const task=state.project?.tasks?.find(t=>t.id===teamSelectedTask);if(!task){$('#teamTaskDetail').innerHTML='<div class="team-detail-empty">Chọn task để xem mô tả, tiêu chí, phụ thuộc, commit và log thực.\nChốt specification trong AI Council trước khi tạo hoặc chia việc.</div>';return;}
  const worker=teamBinding(task,'worker'),reviewer=teamBinding(task,'reviewer'),tabs=[['description','document','Mô tả'],['acceptance','check','Tiêu chí chấp nhận'],['dependencies','dependency',`Phụ thuộc (${task.dependsOn?.length||0})`],['commits','branch',`Commit (${task.commits?.length||0})`],['logs','log',`Log (${task.logs?.length||0})`]],status=teamStatusNames[task.status]||task.status;
  $('#teamTaskDetail').innerHTML=`<div class="team-detail-overview"><h3>Chi tiết task</h3><div class="team-selected-heading"><span class="team-role-icon ${esc(task.role)}">${teamSvg(task.role)}</span><div class="team-selected-title"><div><h4>${esc(task.title)}</h4><span class="team-status-pill ${esc(task.status)}">${esc(status)}</span><span class="team-selected-progress">${esc(teamProgress(task))}</span></div><p>${esc(task.description||'Chưa có mô tả')}</p></div></div><div class="team-task-meta"><div><small>Vai trò / Agent</small><span class="team-role-pill">${esc(teamRoleNames[task.role]||task.role)}</span><p>${esc(teamRoleDescriptions[task.role]||'Thực thi task trong worktree riêng.')}</p></div><div><small>Provider / Model</small><b>${esc(teamProviderNames[worker.provider]||'Chưa phân vai')}</b><p>${esc(worker.model||'Chưa chọn model')}</p><small>Reviewer</small><p>${esc(task.review?.status==='SKIPPED'?'SKIPPED':reviewer.model||(state.project.settings?.reviewRequired===false?'Review sẽ SKIPPED':'Chưa phân vai'))}</p></div><div><small>Worktree</small><p class="team-worktree-path">${esc(task.branch||'Chưa tạo branch')}</p><p title="${esc(task.worktree||'Chưa tạo worktree')}">${esc(task.worktree?'…/'+task.worktree.split('/').at(-1):'Chưa tạo worktree')}</p><p class="team-path-state">${esc(task.worktreeState||'not-created')} · branch ${esc(task.branchState||'not-created')}</p>${task.worktree?`<button type="button" class="team-copy-path" data-team-copy="${esc(task.worktree)}" title="Sao chép đường dẫn lịch sử" aria-label="Sao chép đường dẫn worktree" ${navigator.clipboard?.writeText?'':'disabled'}>${teamSvg('copy')}</button>`:''}</div></div><div class="team-task-stats"><div><small>Trạng thái</small><span class="team-status-pill ${esc(task.status)}">${esc(status)}</span></div><div><small>Độ ưu tiên</small><span class="team-priority-pill ${esc(task.priority||'medium')}">${esc(task.priority||'medium')}</span></div><div><small>Tạo lúc</small><b>${esc(teamDate(task.createdAt))}</b></div><div><small>Thời gian chạy</small><b data-team-runtime>${esc(teamDuration(task))}</b></div></div><div class="team-selected-actions"><button type="button" data-team-action="run" data-task="${esc(task.id)}" ${teamCanRun(task)&&!teamTaskRequests.has(task.id)?'':'disabled'} title="${esc(teamRunReason(task))}">▷ Chạy task</button><button type="button" data-team-action="edit" data-task="${esc(task.id)}" ${!teamActiveStatuses.has(task.status)&&task.status!=='done'&&teamTaskCurrent(task)?'':'disabled'}>Sửa / phân vai</button></div></div><div class="team-detail-center"><div class="team-detail-tabs" role="tablist" aria-label="Chi tiết task">${tabs.map(([id,icon,title])=>`<button type="button" class="team-detail-tab ${teamDetailTab===id?'active':''}" role="tab" aria-selected="${teamDetailTab===id}" data-team-tab="${id}">${teamSvg(icon)}${title}</button>`).join('')}</div><div class="team-detail-content" role="tabpanel">${teamDetailBody(task)}</div></div><div class="team-detail-log"><div class="team-log-title"><h4>Log thực thi gần đây</h4><button type="button" data-team-tab="logs">Xem tất cả</button></div><div class="team-recent-logs">${teamLogLines((task.logs||[]).slice(-12))}</div></div>`;
}
function renderTeamHistory(){
  const p=state.project,spec=teamCurrentSpecification();$('#teamPlanSummary').textContent=p?`${spec?'Specification v'+spec.version+' đã chốt':'Cần chốt specification hiện tại'} · ${p.tasks?.length||0} task · tối đa ${p.settings?.maxParallel||2} song song · sandbox ${p.settings?.sandboxMode||'safe'}`:'Chọn dự án để tạo task.';
  const archived=(p?.planHistory||[]).map(plan=>`<details class="team-history-row"><summary>Kế hoạch đã lưu trữ · ${esc(teamDate(plan.archivedAt))} · ${plan.tasks?.length||0} task</summary>${(plan.tasks||[]).map(t=>`<div class="team-history-task"><b>${esc(t.id)} · ${esc(t.title)} · ${esc(t.status)}</b>${teamSkillChips(t,true)}<p>${t.reviews?.length||0} review · ${t.commits?.length||0} commit · ${t.logs?.length||0} log · ${esc(t.specificationId||'Spec không còn xác minh')}</p><details><summary>Xem state lịch sử</summary><pre>${esc(JSON.stringify(t,null,2))}</pre></details></div>`).join('')}</details>`).join('');
  const archivedTasks=(p?.taskArchive||[]).map(t=>`<details class="team-history-row"><summary>${esc(t.id)} · ${esc(t.title)} — task đã lưu trữ</summary><p>${t.reviews?.length||0} review · ${t.commits?.length||0} commit · ${t.logs?.length||0} log</p><pre>${esc(JSON.stringify(t,null,2))}</pre></details>`).join('');
  $('#teamPlanHistory').innerHTML=archived+archivedTasks||'<p class="team-empty-copy">Chưa có kế hoạch/task được lưu trữ.</p>';
}
function renderTeamManagerSelect(){
  const p=state.project,e=$('#managerSelect'),previous=e.value,b=p?.modelRoles?.founder,connections=aiConns();
  if(b){const c=connections.find(c=>c.id===b.connectionId);e.innerHTML=c&&c.availability.models.includes(b.model)?`<option value="${esc('role:'+p.id+':founder:0')}">${esc(c.name)} · ${esc(b.model)}</option>`:'<option value="">Project Manager cần xác minh lại</option>';}
  else{e.innerHTML='<option value="">Chọn AI đã xác minh</option>'+connections.filter(c=>c.model&&c.availability.models.includes(c.model)).map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.model)}</option>`).join('');if([...e.options].some(o=>o.value===previous))e.value=previous;}
  e.disabled=!p||teamPlanPending;
}
function renderTeamActionAvailability(){
  const p=state.project,ready=p?.tasks?.filter(teamCanRun)||[],active=p?.tasks?.filter(t=>teamActiveStatuses.has(t.status)).length||0;
  $('#managerSelect').disabled=!p||teamPlanPending;
  $('#runReady').disabled=!p||teamBatchPending||teamSettingsPending||!ready.length||active>=(p.settings?.maxParallel||2);$('#runReady').title=ready.length?`Chạy tối đa ${p.settings?.maxParallel||2} task với Worker/Reviewer đã phân vai`:'Cần task sẵn sàng, specification hiện tại và Worker/Reviewer đã xác minh.';
  $('#createTeamTask').disabled=!teamCurrentSpecification()||teamPlanPending;$('#createTeamTask').title=teamCurrentSpecification()?'Tạo task có lưu backend':'Chốt specification hiện tại trong AI Council';
  $('#buildPlan').disabled=!teamCurrentSpecification()||!$('#managerSelect').value||teamPlanPending||active>0;$('#buildPlan').title=active?'Chờ các task đang chạy hoàn tất':!$('#managerSelect').value?'Chọn Project Manager đã xác minh':'Kế hoạch trước sẽ được lưu cùng toàn bộ review/commit/log';
}
function renderExecutionControls(){
  const settings=state.project?.settings||{},selected=settings.defaultEngine||'native';$('#taskEngineSelect').innerHTML=teamEngineOptions(selected,true);
  $$('input[name="teamSandbox"]').forEach(e=>{e.checked=e.value===(settings.sandboxMode||'safe');e.disabled=!state.project||teamSettingsPending||e.value==='docker'&&!state.sandbox?.docker;e.closest('label').title=e.value==='safe'?'Safe chỉ có file tools; mọi npm/shell bị BLOCKED.':e.value==='docker'&&!state.sandbox?.docker?'Docker runtime chưa khả dụng.':e.value==='host'?'UNSAFE: npm chạy trực tiếp trên máy, có thể truy cập hệ thống.':'';});
  $('#taskEngineSelect').disabled=!state.project||teamSettingsPending;$('#allowUnsafeExternal').checked=settings.allowUnsafeExternal===true;$('#allowUnsafeExternal').disabled=!state.project||teamSettingsPending;
  $('#teamMaxParallel').value=settings.maxParallel||2;$('#teamReviewRequired').checked=settings.reviewRequired!==false;$('#teamAutoRepair').checked=settings.autoRepair!==false;
  ['teamMaxParallel','teamReviewRequired','teamAutoRepair'].forEach(id=>$('#'+id).disabled=!state.project||teamSettingsPending);
  $('#teamEngineHint').textContent=selected==='mini-swe-agent'?'External runtime có shell trên host (UNSAFE).':'Safe: không chạy npm/shell; chỉ có file tools.';
  $('#teamReviewWarning').hidden=settings.reviewRequired!==false;
  const host=settings.sandboxMode==='host',external=settings.allowUnsafeExternal===true;$('#teamUnsafeWarning').hidden=!host&&!external;$('#teamUnsafeWarning').textContent=host?'⚠ UNSAFE — Host chạy npm/test trực tiếp trên máy. Code dự án có thể đọc file và khởi chạy process ngoài worktree.':external?'⚠ UNSAFE — External agent được phép chạy shell trực tiếp trên host. Chỉ runtime đã cài và adapter hỗ trợ mới có thể thực thi.':'';
  renderTeamActionAvailability();
}
async function saveExecutionSettings(){
  if(!state.project)return;const id=state.project.id,settings={defaultEngine:$('#taskEngineSelect').value||'native',sandboxMode:$('input[name="teamSandbox"]:checked')?.value||'safe',allowUnsafeExternal:$('#allowUnsafeExternal').checked===true,maxParallel:Number($('#teamMaxParallel').value)||2,reviewRequired:$('#teamReviewRequired').checked===true,autoRepair:$('#teamAutoRepair').checked===true};
  teamSettingsPending=true;renderTeamActionAvailability();
  try{const p=await api(`/api/projects/${id}/settings`,{method:'POST',body:JSON.stringify(settings)});if(state.project?.id===id){state.project=p;renderTasks();}return p;}finally{teamSettingsPending=false;renderExecutionControls();}
}
async function teamChangeSettings(){try{await saveExecutionSettings();toast('Đã lưu cấu hình thực thi')}catch(e){renderExecutionControls();toast(e.message);}}
$('#taskEngineSelect').addEventListener('change',teamChangeSettings);$$('input[name="teamSandbox"]').forEach(e=>e.addEventListener('change',teamChangeSettings));['allowUnsafeExternal','teamMaxParallel','teamReviewRequired','teamAutoRepair'].forEach(id=>$('#'+id).addEventListener('change',teamChangeSettings));
$('#managerSelect').addEventListener('change',renderTeamActionAvailability);
function teamBindingOptions(role,binding){const configured=state.project?.modelRoles?.[role],configuredText=configured?`${teamProviderNames[state.connections.find(c=>c.id===configured.connectionId)?.kind]||'Provider'} · ${configured.model}`:'chưa phân vai';return `<option value="">Dùng vai trò ${role}: ${esc(configuredText)}</option>`+aiConns().flatMap(c=>c.availability.models.map(model=>{const b={connectionId:c.id,model};return `<option value="${esc(JSON.stringify(b))}" ${binding?.connectionId===c.id&&binding?.model===model?'selected':''}>${esc(c.name)} · ${esc(model)}</option>`;})).join('');}
function openTeamTaskDialog(task){
  const p=state.project;if(!p||!teamCurrentSpecification())return toast('Hãy chốt specification trong AI Council.');
  $('#teamTaskForm').reset();$('#teamTaskFormError').hidden=true;$('#teamEditTaskId').value=task?.id||'';$('#teamTaskFormTitle').textContent=task?'Sửa task '+task.id:'Tạo task mới';$('#teamTaskTitle').value=task?.title||'';$('#teamTaskDescription').value=task?.description||'';$('#teamTaskRole').value=task?.role||'frontend';$('#teamTaskPriority').value=task?.priority||'medium';$('#teamTaskCriteria').value=task?.acceptanceCriteria?.map(c=>c.text).join('\n')||task?.doneWhen||'';
  $('#teamTaskWorker').innerHTML=teamBindingOptions('worker',task?.assignedWorker);$('#teamTaskReviewer').innerHTML=teamBindingOptions('reviewer',task?.assignedReviewer);$('#teamTaskEngine').innerHTML=teamEngineOptions(task?.engineId||p.settings?.defaultEngine||'native');$('#teamTaskDeps').innerHTML=(p.tasks||[]).filter(t=>t.id!==task?.id).map(t=>`<option value="${esc(t.id)}" ${task?.dependsOn?.includes(t.id)?'selected':''}>${esc(t.id)} · ${esc(t.title)} · ${esc(t.status)}</option>`).join('');
  $('#teamTaskDialog').showModal();$('#teamTaskTitle').focus();
}
$('#createTeamTask').onclick=()=>openTeamTaskDialog();$('#teamCloseTaskDialog').onclick=$('#teamCancelTaskDialog').onclick=()=>$('#teamTaskDialog').close();
$('#teamTaskForm').addEventListener('submit',async e=>{
  e.preventDefault();const projectId=state.project?.id,taskId=$('#teamEditTaskId').value;if(!projectId)return;
  const data={title:$('#teamTaskTitle').value,description:$('#teamTaskDescription').value,role:$('#teamTaskRole').value,priority:$('#teamTaskPriority').value,acceptanceCriteria:$('#teamTaskCriteria').value.split('\n').map(s=>s.trim()).filter(Boolean),dependsOn:[...$('#teamTaskDeps').selectedOptions].map(o=>o.value),engineId:$('#teamTaskEngine').value,assignedWorker:$('#teamTaskWorker').value?JSON.parse($('#teamTaskWorker').value):null,assignedReviewer:$('#teamTaskReviewer').value?JSON.parse($('#teamTaskReviewer').value):null};
  $('#teamSaveTask').disabled=true;$('#teamTaskFormError').hidden=true;
  try{const p=await api(`/api/projects/${projectId}/tasks${taskId?'/'+taskId:''}`,{method:taskId?'PATCH':'POST',body:JSON.stringify(data)});$('#teamTaskDialog').close();if(state.project?.id===projectId){state.project=p;teamSelectedTask=taskId||p.tasks.at(-1)?.id;renderTasks();renderExecutionControls();}toast(taskId?'Đã lưu task và phân vai':'Đã tạo task có lưu backend');}catch(err){$('#teamTaskFormError').textContent=err.message;$('#teamTaskFormError').hidden=false;}finally{$('#teamSaveTask').disabled=false;}
});
async function teamRunTask(taskId){const p=state.project,task=p?.tasks?.find(t=>t.id===taskId);if(!task||!teamCanRun(task))return toast(task?teamRunReason(task):'Không tìm thấy task');teamTaskRequests.add(taskId);teamMenuTask=null;renderTasks();try{const result=await api(`/api/projects/${p.id}/run-task`,{method:'POST',body:JSON.stringify({taskId})});if(state.project?.id===p.id)await chooseProject(p.id);toast(result.merged?`${taskId} đã merge; xem receipt test và review trong chi tiết`:`${taskId}: ${result.task?.status||'chưa merge'}`);}catch(err){toast(err.message);if(state.project?.id===p.id)await chooseProject(p.id);}finally{teamTaskRequests.delete(taskId);renderTasks();}}
async function teamArchiveTask(taskId){const p=state.project;try{const next=await api(`/api/projects/${p.id}/tasks/${taskId}`,{method:'DELETE'});if(state.project?.id===p.id){state.project=next;teamMenuTask=null;renderTasks();}toast('Đã lưu trữ task cùng review, commit và log.');}catch(e){toast(e.message);}}
$('#page-team').addEventListener('click',async e=>{
  const tab=e.target.closest('[data-team-tab]');if(tab){teamDetailTab=tab.dataset.teamTab;renderTeamDetail();return;}
  const select=e.target.closest('[data-team-select]');if(select){teamSelectedTask=select.dataset.teamSelect;teamDetailTab='description';renderTasks();return;}
  const copy=e.target.closest('[data-team-copy]');if(copy){try{await navigator.clipboard.writeText(copy.dataset.teamCopy);toast('Đã sao chép đường dẫn lịch sử.');}catch{toast('Clipboard chưa khả dụng trong trình duyệt này.');}return;}
  const action=e.target.closest('[data-team-action]');if(action){if(action.disabled)return;const task=state.project?.tasks?.find(t=>t.id===action.dataset.task);if(!task)return;if(action.dataset.teamAction==='menu'){teamMenuTask=teamMenuTask===task.id?null:task.id;renderTasks();return;}teamMenuTask=null;if(action.dataset.teamAction==='run')await teamRunTask(task.id);else if(action.dataset.teamAction==='edit')openTeamTaskDialog(task);else if(action.dataset.teamAction==='archive')await teamArchiveTask(task.id);return;}
  const card=e.target.closest('[data-team-task]');if(card){teamSelectedTask=card.dataset.teamTask;teamMenuTask=null;renderTasks();}
});
$('#taskBoard').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-team-task]')){e.preventDefault();teamSelectedTask=e.target.dataset.teamTask;teamMenuTask=null;renderTasks();}});
$('#runReady').onclick=async()=>{
  const p=state.project;if(!p)return;teamBatchPending=true;renderTeamActionAvailability();
  try{const result=await api(`/api/projects/${p.id}/run-ready`,{method:'POST',body:JSON.stringify({limit:p.settings?.maxParallel||2})});if(state.project?.id===p.id)await chooseProject(p.id);toast(result.runs?.length?`Batch: ${result.runs.filter(r=>r.status==='done').length}/${result.runs.length} task đã merge; xem test/review thực.`:result.message||'Không có task sẵn sàng.');}catch(err){toast(err.message);if(state.project?.id===p.id)await chooseProject(p.id);}finally{teamBatchPending=false;renderTeamActionAvailability();}
};
$('#buildPlan').onclick=async()=>{const p=state.project;if(!p)return toast('Hãy chọn dự án');teamPlanPending=true;renderTeamActionAvailability();try{await api(`/api/projects/${p.id}/plan`,{method:'POST',body:JSON.stringify({managerId:$('#managerSelect').value||undefined})});if(state.project?.id===p.id)await chooseProject(p.id);toast('Đã chia task; kế hoạch trước được giữ trong lịch sử.');}catch(e){toast(e.message);}finally{teamPlanPending=false;renderTeamActionAvailability();}};
async function loadWorkspace(){if(!state.project)return;const id=state.project.id;try{const x=await api(`/api/projects/${id}/workspace-summary`);if(state.project?.id===id)$('#workspaceFiles').innerHTML=x.files.length?x.files.map(f=>`<code>${esc(f)}</code>`).join(''):'<p class="team-empty-copy">Workspace chưa có file.</p>';}catch(e){$('#workspaceFiles').textContent='Workspace chưa khả dụng: '+e.message;}}
document.addEventListener('page-change',e=>{if(e.detail.page==='team'){$('#subtitle').textContent='Nhiều agent thực thi song song trong worktree và sandbox riêng.';renderTasks();renderExecutionControls();}});
document.addEventListener('connections-change',()=>{renderTasks();renderExecutionControls();});
setInterval(async()=>{
  if(!$('#page-team').classList.contains('active')||!state.project||teamPollPending)return;
  const task=state.project.tasks?.find(t=>t.id===teamSelectedTask),runtime=$('#page-team [data-team-runtime]');if(task&&runtime)runtime.textContent=teamDuration(task);
  if(!(teamBatchPending||teamTaskRequests.size||state.project.tasks?.some(t=>teamActiveStatuses.has(t.status))))return;
  teamPollPending=true;const id=state.project.id;try{const p=await api('/api/projects/'+id);if(state.project?.id===id){state.project=p;renderTasks();renderExecutionControls();}}catch(e){toast('Không tải được state thực thi: '+e.message);}finally{teamPollPending=false;}
},1500);

/* ================= Văn phòng AI (0.9.23) =================
 * Phòng làm việc trực quan của đội: nhân viên là các vai thật trong app,
 * vị trí và việc đang làm suy ra từ dữ liệu thật (orchestrator runs, thẻ
 * tin ingest, task của dự án đang chọn). Không có chuyển động giả: không
 * có việc thì nhân viên đứng ở bàn của mình với trạng thái "Đang chờ việc". */
const OFFICE_CAST=[
 {id:'boss',name:'Sếp Lâm',role:'Tổng giám đốc · duyệt đăng',icon:'👔',station:'boss',color:'#f59e0b'},
 {id:'pm',name:'Tuấn',role:'Trưởng phòng · nhận & chia việc',icon:'🎯',station:'pm',color:'#8b5cf6'},
 {id:'news',name:'Na',role:'Tin tức · tìm tin theo lĩnh vực',icon:'📰',station:'news',color:'#38bdf8'},
 {id:'script',name:'Hằng',role:'Biên tập · viết lời dẫn',icon:'✍️',station:'script',color:'#34d399'},
 {id:'image',name:'Tí',role:'Hình ảnh · tạo minh họa',icon:'🎨',station:'image',color:'#f472b6'},
 {id:'media',name:'Minh',role:'Sản xuất · dựng video',icon:'🎬',station:'media',color:'#818cf8'},
 {id:'review',name:'Tâm',role:'Kiểm duyệt · soi chất lượng',icon:'🔍',station:'review',color:'#facc15'},
 {id:'publish',name:'Phát',role:'Phát hành · đăng bài',icon:'🚀',station:'publish',color:'#fb7185'},
];
/* Hình nhân viên: người chibi vẽ bằng SVG — chân tay chuyển động khi đi. */
function officeFigure(a){
 return `<svg class="office-figure" viewBox="0 0 48 66" aria-hidden="true">
  <g class="fig-bob">
   <g class="fig-leg fig-leg-l"><rect x="18.5" y="42" width="5" height="17" rx="2.4" fill="#3b3b4d"/><rect x="17.8" y="56" width="7" height="4" rx="2" fill="#22222e"/></g>
   <g class="fig-leg fig-leg-r"><rect x="24.5" y="42" width="5" height="17" rx="2.4" fill="#33333f"/><rect x="23.8" y="56" width="7" height="4" rx="2" fill="#22222e"/></g>
   <g class="fig-arm fig-arm-l"><rect x="9.5" y="25" width="5" height="15" rx="2.5" fill="${a.color}"/></g>
   <g class="fig-arm fig-arm-r"><rect x="33.5" y="25" width="5" height="15" rx="2.5" fill="${a.color}"/></g>
   <rect x="13" y="22" width="22" height="22" rx="7" fill="${a.color}"/>
   <circle cx="24" cy="13" r="9.5" fill="#ffd9b3"/>
   <path d="M14.5 13a9.5 9.5 0 0 1 19 0z" fill="#4a3428"/>
   <circle cx="20.6" cy="13.5" r="1.15" fill="#26222a"/><circle cx="27.4" cy="13.5" r="1.15" fill="#26222a"/>
   <path d="M21 17.6q3 2.2 6 0" stroke="#b4713f" stroke-width="1.3" fill="none" stroke-linecap="round"/>
   <text x="40" y="34" font-size="11" text-anchor="middle">${a.icon}</text>
  </g></svg>`;
}
const OFFICE_STATIONS={
 boss:{x:50,y:10,label:'👔 Bàn Sếp Lâm'},
 news:{x:15,y:27,label:'📰 Tin tức'},
 script:{x:38,y:20,label:'✍️ Biên tập'},
 image:{x:62,y:20,label:'🎨 Hình ảnh'},
 media:{x:85,y:27,label:'🎬 Sản xuất'},
 pm:{x:50,y:47,label:'🎯 Điều phối'},
 review:{x:24,y:66,label:'🔍 Kiểm duyệt'},
 publish:{x:76,y:66,label:'🚀 Đăng bài'},
 lounge:{x:10,y:85,label:'🔋 Phòng nạp năng lượng'},
 cage:{x:90,y:83,label:'⚡ Phòng chích điện'},
};
/* Ai làm hỏng việc thì vào Phòng chích điện: xét lượt chạy THẤT BẠI gần
 * nhất trong 24 giờ; nếu sau đó đã có lượt chạy hoàn thành mới hơn thì
 * người đó được thả. Công đoạn hỏng ở đâu, người phụ trách ở đó chịu. */
function officeCulprit(runs){
 const sorted=[...(runs||[])].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 const failed=sorted.find(r=>r.state==='failed');
 if(!failed)return null;
 if(Date.now()-Date.parse(failed.createdAt||0)>24*3600*1000)return null;
 const completed=sorted.find(r=>r.state==='completed');
 if(completed&&String(completed.createdAt||'')>String(failed.createdAt||''))return null;
 const badStep=(failed.steps||[]).find(x=>x.state==='failed');
 const stepName=badStep?badStep.name:'';
 const agentId=stepName.startsWith('produce.')?'media':stepName.startsWith('ai.')?'script':stepName.startsWith('publish:')?'publish':'pm';
 return {agentId,run:failed,step:stepName};
}
let officeNames={}; try{officeNames=JSON.parse(localStorage.getItem('aios-office-names')||'{}')}catch{officeNames={}}
let officeState={runs:[],cards:[],tasks:[],loaded:false,lastFeed:[]};
const officePrevPos={},officeWalkTimers={};
function officeAgentName(a){return officeNames[a.id]||a.name}
function officeStationOf(agentId,ctx){
 const a=OFFICE_CAST.find(x=>x.id===agentId); if(!a)return 'lounge';
 if(ctx.culprit&&ctx.culprit.agentId===agentId)return 'cage';
 const {activeRun,awaiting,tasks}=ctx;
 switch(agentId){
  case 'boss': return 'boss';
  case 'pm': return awaiting?'boss':'pm';
  case 'news': return activeRun&&ctx.stage==='intake'?'pm':'news';
  case 'script': return 'script';
  case 'image': return 'image';
  case 'media': return 'media';
  case 'review': return 'review';
  case 'publish': return 'publish';
  default: return a.station;
 }
}
function officeStageOf(run){
 if(!run)return null;
 if(run.state==='awaiting-approval')return 'gate';
 if(run.state==='completed')return 'done';
 const names=(run.steps||[]).map(s=>s.name);
 if(names.some(n=>n.startsWith('publish:')))return 'publish';
 if(names.some(n=>n.startsWith('produce.')))return 'produce';
 if(names.some(n=>n==='ai.script'||n==='ai.translate'))return 'script';
 return 'intake';
}
function officeRender(){
 const room=$('#officeRoom'); if(!room)return;
 const runs=officeState.runs||[];
 const awaiting=runs.find(r=>r.state==='awaiting-approval')||null;
 const activeRun=runs.find(r=>r.state==='running')||awaiting;
 const justCompleted=runs.find(r=>r.state==='completed'&&Date.now()-Date.parse(r.completedAt||0)<90000)||null;
 const tasks=(state.project&&state.project.tasks)||[];
 const culprit=officeCulprit(officeState.runs);
 const ctx={activeRun,awaiting,tasks,stage:officeStageOf(activeRun),justCompleted,culprit};
 const unused=(officeState.cards||[]).filter(c=>!c.usedByProjectId).length;
 if(!room.dataset.built){
  room.dataset.built='1';
  room.innerHTML=Object.entries(OFFICE_STATIONS).map(([id,st])=>`<div class="office-station" style="left:${st.x}%;top:${st.y}%">${st.label}</div>`).join('')
   +OFFICE_CAST.map(a=>`<button type="button" class="office-agent" id="officeAgent-${a.id}" data-office-agent="${a.id}" style="left:50%;top:50%" title="${esc(a.role)} — bấm để đổi tên"><span class="office-agent-shadow"></span>${officeFigure(a)}<span class="office-agent-name">${esc(officeAgentName(a))}</span><span class="office-agent-badge" hidden></span></button>`).join('')
   +`<div class="office-package" id="officePackage" hidden>📦</div>`
   +(awaiting?'':'' );
  room.querySelectorAll('[data-office-agent]').forEach(el=>el.onclick=()=>{
   const a=OFFICE_CAST.find(x=>x.id===el.dataset.officeAgent); if(!a)return;
   const next=prompt(`Đổi tên cho ${a.role}:`,officeAgentName(a));
   if(next&&next.trim()){officeNames[a.id]=next.trim().slice(0,24);localStorage.setItem('aios-office-names',JSON.stringify(officeNames));officeRender();}
  });
 }
 const slotUse=new Map();
 for(const a of OFFICE_CAST){
  const el=$('#officeAgent-'+a.id); if(!el)continue;
  const stId=officeStationOf(a.id,ctx);
  const st=OFFICE_STATIONS[stId]||OFFICE_STATIONS.lounge;
  const slot=slotUse.get(stId)||0; slotUse.set(stId,slot+1);
  const dx=slot===0?0:slot===1?9:-9;
  const targetX=st.x+dx;
  const prev=officePrevPos[a.id];
  if(prev&&prev.station!==stId+':'+slot){
   el.classList.add('office-walking');
   el.classList.toggle('office-face-left',targetX<prev.x);
   clearTimeout(officeWalkTimers[a.id]);
   officeWalkTimers[a.id]=setTimeout(()=>el.classList.remove('office-walking'),1300);
  }
  officePrevPos[a.id]={station:stId+':'+slot,x:targetX};
  el.style.left=targetX+'%'; el.style.top=`calc(${st.y}% + 32px)`;
  el.querySelector('.office-agent-name').textContent=officeAgentName(a);
  const badge=el.querySelector('.office-agent-badge');
  let badgeText='';
  if(a.id==='boss'&&awaiting)badgeText='✋ chờ duyệt';
  if(a.id==='news'&&unused)badgeText=unused+' tin mới';
  if(a.id==='media'&&ctx.stage==='produce')badgeText='đang dựng…';
  if(a.id==='script'&&ctx.stage==='script')badgeText='đang viết…';
  if(a.id==='publish'&&ctx.stage==='publish')badgeText='đang đăng…';
  if(culprit&&culprit.agentId===a.id)badgeText='⚡ đang bị chích điện';
  if(officeStationOf(a.id,ctx)==='lounge'&&!(culprit&&culprit.agentId===a.id))badgeText='💤 đang nạp năng lượng';
  badge.hidden=!badgeText; badge.textContent=badgeText;
  el.classList.toggle('office-busy',Boolean(badgeText)||(a.id==='pm'&&Boolean(activeRun)));
 }
 const pkg=$('#officePackage');
 if(pkg){
  const target=awaiting?'boss':activeRun?(ctx.stage==='produce'?'media':ctx.stage==='publish'?'publish':ctx.stage==='script'?'script':'pm'):null;
  if(target){const st=OFFICE_STATIONS[target];pkg.hidden=false;pkg.style.left=(st.x+4)+'%';pkg.style.top=(st.y-7)+'%';}
  else pkg.hidden=true;
 }
 const approveBtn=$('#officeApprove');
 if(awaiting&&!approveBtn){
  const bar=document.createElement('div');bar.className='office-approve-bar';bar.id='officeApprove';
  bar.innerHTML=`<span>📦 Có sản phẩm đang chờ Sếp Lâm duyệt đăng: <b>${esc(awaiting.title||awaiting.pipeline)}</b></span><button type="button" class="primary" id="officeApproveBtn">✔ Duyệt đăng ngay</button>`;
  room.after(bar);
  $('#officeApproveBtn').onclick=async()=>{const b=$('#officeApproveBtn');b.disabled=true;try{await api(`/api/orchestrator/runs/${encodeURIComponent(awaiting.id)}/approve`,{method:'POST',body:'{}'});toast('Đã duyệt đăng');officePoll(true);}catch(e){toast(e.message);b.disabled=false;}};
 } else if(!awaiting&&approveBtn){approveBtn.remove();}
 const feed=$('#officeFeed');
 if(feed){
  const lines=[];
  if(!officeState.loaded)lines.push('Đang tải dữ liệu văn phòng…');
  else{
   if(unused)lines.push(`📰 ${officeAgentName(OFFICE_CAST[2])} đang giữ ${unused} thẻ tin chưa dùng.`);
   if(activeRun&&activeRun.state==='running')lines.push(`🎯 ${officeAgentName(OFFICE_CAST[1])} đã chia việc: "${activeRun.title||activeRun.pipeline}" — đang ở công đoạn ${ctx.stage==='script'?'viết lời dẫn':ctx.stage==='produce'?'dựng video':ctx.stage==='publish'?'đăng bài':'tiếp nhận'}.`);
   if(awaiting)lines.push(`👔 Sản phẩm "${awaiting.title||awaiting.pipeline}" đang ở trên bàn Sếp Lâm chờ duyệt.`);
   if(justCompleted)lines.push(`🚀 ${officeAgentName(OFFICE_CAST[7])} vừa đăng xong: "${justCompleted.title||justCompleted.pipeline}".`);
   if(culprit){const ca=OFFICE_CAST.find(x=>x.id===culprit.agentId);lines.push(`⚡ ${officeAgentName(ca)} đang ở Phòng chích điện vì lượt "${culprit.run.title||culprit.run.pipeline}" hỏng${culprit.step?` ở công đoạn ${culprit.step}`:''} — làm xong một lượt tốt là được thả.`);}
   if(!lines.length)lines.push('☕ Cả đội đang chờ việc. Quét tin mới ở tab Ý tưởng hoặc bật vòng khép kín ở tab Publish để văn phòng nhộn nhịp lên.');
  }
  feed.innerHTML=lines.map(l=>`<p>${esc(l)}</p>`).join('');
 }
 const clock=$('#officeClock');
 if(clock)clock.textContent=officeState.loaded?('Cập nhật '+new Date().toLocaleTimeString('vi-VN')):'Đang tải…';
 office3DEnsure();
 if(window.__office3D)window.__office3DSync(ctx);
}
let officePollPending=false;
async function officePoll(force){
 if(officePollPending&&!force)return;
 const room=$('#officeRoom'); if(!room)return;
 officePollPending=true;
 try{
  const [orch,cards]=await Promise.all([api('/api/orchestrator').catch(()=>null),api('/api/ingest/cards').catch(()=>null)]);
  if(orch)officeState.runs=orch.runs||[];
  if(cards)officeState.cards=cards.cards||[];
  officeState.loaded=true;
 }catch{/* giữ trạng thái cũ */}
 finally{officePollPending=false;officeRender();}
}
setInterval(()=>{const page=$('#page-team');if(page&&page.classList.contains('active')&&!document.hidden)officePoll();},4000);
document.addEventListener('page-change',e=>{if(e.detail.page==='team'){officeRender();officePoll();}});
officeRender();officePoll();

/* ================= Văn phòng 3D (0.9.25) =================
 * Cùng một bộ não trạng thái với phòng 2D (officeStationOf/officeCulprit),
 * chỉ khác cách vẽ: phòng 3D bằng Three.js (MIT, nhúng trong source).
 * Nếu WebGL/import lỗi, phòng 2D vẫn chạy như cũ — không giấu lỗi. */
var office3DVisible=true;
document.addEventListener('page-change',e=>{office3DVisible=e.detail.page==='team';});
function office3DEnsure(){
 if(window.__office3DEnsureStarted)return; window.__office3DEnsureStarted=true;
 const room=$('#officeRoom'); if(!room)return;
 import('/vendor/three.module.min.js').then(THREE=>{try{office3DBuild(THREE,room);}catch(err){console.warn('Văn phòng 3D lỗi, dùng bản 2D:',err);}}).catch(()=>{});
}
function officeWorld(pct){return {x:(pct.x-50)/50*13,z:(pct.y-50)/50*8.0};}
function office3DBuild(THREE,room){
 const W=()=>room.clientWidth||1200,H=()=>430;
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
 renderer.setSize(W(),H());
 renderer.domElement.className='office-3d-canvas';
 room.appendChild(renderer.domElement);
 room.classList.add('office-3d-on');
 const scene=new THREE.Scene();
 scene.background=new THREE.Color(0x0b0b13);
 scene.fog=new THREE.Fog(0x0b0b13,30,60);
 const camera=new THREE.PerspectiveCamera(42,W()/H(),0.1,120);
 const orbit={theta:0,phi:1.2,radius:16.8};
 scene.add(new THREE.HemisphereLight(0x9d8fff,0x0a0a10,1.15));
 const sun=new THREE.DirectionalLight(0xffffff,2.4); sun.position.set(7,14,7); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-18; sun.shadow.camera.right=18; sun.shadow.camera.top=18; sun.shadow.camera.bottom=-18; sun.shadow.camera.far=42; sun.shadow.bias=-0.0004; scene.add(sun);
 const purple=new THREE.PointLight(0x7c5cff,60,40); purple.position.set(0,6,-4); scene.add(purple);
 // --- textures vẽ bằng canvas (không file ngoài) ---
 function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);return t;}
 const screenTex=canvasTex(256,160,(g,w,h)=>{g.fillStyle='#0a1420';g.fillRect(0,0,w,h);const cols=['#57e6ff','#8b5cf6','#34d399','#f472b6','#facc15'];for(let i=0;i<13;i++){g.fillStyle=cols[i%cols.length];g.globalAlpha=.75;const lw=30+((i*67)%180);g.fillRect(12,10+i*11,lw,5);}g.globalAlpha=1;});
 const screenTexCache={};
 function screenFor(kind){
  if(screenTexCache[kind])return screenTexCache[kind];
  const tex=canvasTex(256,160,(g,w,h)=>{
   g.fillStyle='#0a1420';g.fillRect(0,0,w,h);
   const bar=(x,y,ww,col,al)=>{g.globalAlpha=al||.8;g.fillStyle=col;g.fillRect(x,y,ww,6);g.globalAlpha=1;};
   const cols=['#57e6ff','#8b5cf6','#34d399','#f472b6','#facc15'];
   if(kind==='news'){const gr=g.createLinearGradient(8,10,110,100);gr.addColorStop(0,'#1d4e89');gr.addColorStop(1,'#3f9e4d');g.fillStyle=gr;g.fillRect(8,10,102,90);bar(120,16,120,'#e8f4ff');bar(120,34,104,'#9fb6cc',.7);bar(120,50,112,'#9fb6cc',.7);bar(120,66,88,'#9fb6cc',.7);g.fillStyle='#e0342b';g.fillRect(0,h-20,w,20);bar(10,h-13,180,'#ffffff',.9);}
   else if(kind==='script'){bar(10,12,150,'#e8f4ff');for(let i=0;i<8;i++)bar(10,32+i*14,180+((i*37)%50),'#9fb6cc',.65);}
   else if(kind==='image'){const grs=[['#f472b6','#8b5cf6'],['#34d399','#1d4e89'],['#facc15','#f472b6'],['#57e6ff','#34d399']];grs.forEach((cc,i)=>{const gr=g.createLinearGradient(0,0,120,74);gr.addColorStop(0,cc[0]);gr.addColorStop(1,cc[1]);g.fillStyle=gr;g.fillRect(8+(i%2)*124,10+Math.floor(i/2)*74,116,66);});}
   else if(kind==='media'){const gr=g.createLinearGradient(8,8,240,84);gr.addColorStop(0,'#312e81');gr.addColorStop(1,'#7c3aed');g.fillStyle=gr;g.fillRect(8,8,240,84);g.fillStyle='#fff';g.beginPath();g.moveTo(112,32);g.lineTo(112,68);g.lineTo(142,50);g.fill();for(let r=0;r<3;r++)for(let i=0;i<6;i++){g.fillStyle=cols[(r+i)%5];g.globalAlpha=.85;g.fillRect(8+i*41,104+r*17,34,11);g.globalAlpha=1;}}
   else if(kind==='review'){for(let i=0;i<5;i++){g.strokeStyle='#34d399';g.lineWidth=3;g.beginPath();g.moveTo(14,24+i*26);g.lineTo(20,30+i*26);g.lineTo(30,16+i*26);g.stroke();bar(42,20+i*26,120,'#9fb6cc',.7);}g.strokeStyle='#34d399';g.lineWidth=6;g.beginPath();g.arc(205,80,32,0,7);g.stroke();g.lineWidth=7;g.beginPath();g.moveTo(188,80);g.lineTo(200,94);g.lineTo(224,62);g.stroke();}
   else if(kind==='publish'){const pc=['#111111','#e0342b','#1877f2','#1da1f2'];pc.forEach((cc,i)=>{g.fillStyle=cc;g.beginPath();g.arc(34+i*44,36,17,0,7);g.fill();});g.strokeStyle='#34d399';g.lineWidth=4;g.beginPath();g.moveTo(12,140);g.lineTo(70,116);g.lineTo(120,124);g.lineTo(180,84);g.lineTo(240,52);g.stroke();}
   else if(kind==='boss'){for(let i=0;i<3;i++){g.fillStyle='#12233a';g.fillRect(8+i*82,10,74,40);bar(16+i*82,26,44,cols[i]);}for(let i=0;i<6;i++){g.fillStyle=cols[i%5];g.globalAlpha=.85;g.fillRect(16+i*38,140-(20+((i*29)%70)),24,20+((i*29)%70));g.globalAlpha=1;}}
   else {for(let cix=0;cix<3;cix++){g.fillStyle='#101c2c';g.fillRect(8+cix*82,10,74,140);bar(14+cix*82,18,60,cols[cix]);for(let r=0;r<3;r++){g.fillStyle='#1b2f47';g.fillRect(14+cix*82,34+r*36,60,28);bar(18+cix*82,42+r*36,44,'#9fb6cc',.6);}}}
  });
  screenTexCache[kind]=tex; return tex;
 }
 const darkMat=new THREE.MeshStandardMaterial({color:0x23232f,roughness:.85});
 const backdropTex=new THREE.TextureLoader().load('/assets/office-backdrop.jpg'); backdropTex.colorSpace=THREE.SRGBColorSpace; backdropTex.wrapS=THREE.RepeatWrapping; backdropTex.repeat.set(1,.72); backdropTex.offset.set(0,.28);
 function textSprite(text,{size=44,color='#e8e8f2',bg='rgba(13,13,20,.72)',scale=[2.6,.65]}={}){
  const tex=canvasTex(512,128,(g,w,h)=>{g.fillStyle=bg;g.beginPath();g.roundRect(6,22,w-12,h-44,26);g.fill();g.font=`700 ${size}px system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=color;g.fillText(text,w/2,h/2+2);});
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));sp.scale.set(scale[0],scale[1],1);return sp;
 }
 // --- sàn + phông thành phố ---
 const floor=new THREE.Mesh(new THREE.CircleGeometry(30,48),new THREE.MeshStandardMaterial({color:0x171724,roughness:.5,metalness:.2}));
 floor.rotation.x=-Math.PI/2; scene.add(floor);
 const grid=new THREE.GridHelper(34,34,0x2e2e46,0x1d1d2c); grid.position.y=.01; grid.material.transparent=true; grid.material.opacity=.55; scene.add(grid);
 const glowTex=canvasTex(512,512,(g,w,h)=>{g.clearRect(0,0,w,h);const blob=(x,y,r,col)=>{const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,col);gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2);};blob(150,300,190,'rgba(45,212,238,.20)');blob(370,190,200,'rgba(139,92,246,.17)');blob(256,256,150,'rgba(255,176,32,.07)');});
 const glow=new THREE.Mesh(new THREE.CircleGeometry(30,48),new THREE.MeshBasicMaterial({map:glowTex,transparent:true,depthWrite:false}));
 glow.rotation.x=-Math.PI/2; glow.position.y=.005; scene.add(glow);
 // cây cảnh ở các góc cho phòng có sức sống
 function buildPlant(px,pz){
  const grp=new THREE.Group();
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(.24,.3,.42,12),new THREE.MeshStandardMaterial({color:0x37424e,roughness:.6})); pot.position.y=.21; grp.add(pot);
  const leafMat=new THREE.MeshStandardMaterial({color:0x2f9e5f,roughness:.8});
  for(const [lx,ly,lz,lr] of [[0,.85,0,.34],[-.2,.68,.08,.24],[.22,.72,-.06,.26]]){const leaf=new THREE.Mesh(new THREE.SphereGeometry(lr,12,10),leafMat); leaf.position.set(lx,ly,lz); grp.add(leaf);}
  grp.position.set(px,0,pz); scene.add(grp);
 }
 buildPlant(-14.6,-6.2); buildPlant(14.6,-6.2); buildPlant(-15,4.4); buildPlant(15,4.6);
 // đèn vòng trên trần + vòng sáng trang trí dưới sàn
 const ceilRing=new THREE.Mesh(new THREE.TorusGeometry(8.5,.07,10,72),new THREE.MeshBasicMaterial({color:0xbfe9ff}));
 ceilRing.rotation.x=Math.PI/2; ceilRing.position.y=8.6; scene.add(ceilRing);
 const ceilRing2=new THREE.Mesh(new THREE.TorusGeometry(5.8,.045,10,64),new THREE.MeshBasicMaterial({color:0x8b5cf6}));
 ceilRing2.rotation.x=Math.PI/2; ceilRing2.position.y=8.6; scene.add(ceilRing2);
 for(const [rr,op] of [[4.6,.30],[7.1,.20]]){
  const fr=new THREE.Mesh(new THREE.RingGeometry(rr,rr+.07,64),new THREE.MeshBasicMaterial({color:0x2dd4ee,transparent:true,opacity:op,side:THREE.DoubleSide}));
  fr.rotation.x=-Math.PI/2; fr.position.y=.012; scene.add(fr);
 }
 // màn hình tường lớn + tủ máy chủ + sofa góc nghỉ
 const wallScr=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.9),new THREE.MeshBasicMaterial({map:screenFor('boss')}));
 wallScr.position.set(-15.6,2.6,-4); wallScr.rotation.y=.62; scene.add(wallScr);
 const rackTex=canvasTex(128,256,(g,w,h)=>{g.fillStyle='#141821';g.fillRect(0,0,w,h);for(let y=10;y<h-8;y+=18)for(let x=10;x<w-14;x+=16){g.fillStyle=Math.random()<.5?'#34d399':'#57e6ff';g.globalAlpha=.5+Math.random()*.5;g.fillRect(x,y,7,7);g.globalAlpha=1;}});
 const rack=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.7,.7),new THREE.MeshStandardMaterial({color:0x1a1e28,roughness:.5,metalness:.4}));
 rack.position.set(15.4,1.35,-6.5); rack.rotation.y=-.55; scene.add(rack);
 const rackFace=new THREE.Mesh(new THREE.PlaneGeometry(1.5,2.5),new THREE.MeshBasicMaterial({map:rackTex}));
 rackFace.position.set(0,0,.36); rack.add(rackFace);
 const sofaMat=new THREE.MeshStandardMaterial({color:0x2c3242,roughness:.85});
 const sofa=new THREE.Group();
 const sBase=new THREE.Mesh(new THREE.BoxGeometry(2.3,.42,.95),sofaMat); sBase.position.y=.3; sofa.add(sBase);
 const sBack=new THREE.Mesh(new THREE.BoxGeometry(2.3,.62,.24),sofaMat); sBack.position.set(0,.72,-.38); sofa.add(sBack);
 for(const sx of [-1.08,1.08]){const sArm=new THREE.Mesh(new THREE.BoxGeometry(.24,.55,.95),sofaMat); sArm.position.set(sx,.55,0); sofa.add(sArm);}
 sofa.position.set(-11.5,0,10.5); sofa.rotation.y=.55; scene.add(sofa);
 const backdrop=new THREE.Mesh(new THREE.CylinderGeometry(30,30,19,48,1,true,Math.PI-1.08,2.16),new THREE.MeshBasicMaterial({map:backdropTex,side:THREE.BackSide,fog:false}));
 backdrop.position.y=4.2; scene.add(backdrop);
 // --- bàn làm việc ---
 const deskMat=new THREE.MeshStandardMaterial({color:0x5a4630,roughness:.7});
 const deskHolos=[];
 function buildDesk(stId){
  const st=OFFICE_STATIONS[stId],pos=officeWorld(st),grp=new THREE.Group();
  const owner=OFFICE_CAST.find(a=>a.station===stId);
  const accentCol=new THREE.Color(owner?owner.color:0x888888);
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.44,.74,24,1,false,Math.PI-.98,1.96),new THREE.MeshStandardMaterial({color:0x272b38,roughness:.45,metalness:.35}));
  shell.position.y=.37; grp.add(shell);
  const topD=new THREE.Mesh(new THREE.CylinderGeometry(1.46,1.46,.06,24,1,false,Math.PI-.98,1.96),new THREE.MeshStandardMaterial({color:0x171b26,roughness:.3,metalness:.4}));
  topD.position.y=.78; grp.add(topD);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(1.47,1.47,.04,24,1,true,Math.PI-.98,1.96),new THREE.MeshBasicMaterial({color:accentCol}));
  band.position.y=.83; grp.add(band);
  function monitor(wd,ht,tex,x,y,z,ry){
   const mon=new THREE.Group();
   const body=new THREE.Mesh(new THREE.BoxGeometry(wd,ht,.05),darkMat); mon.add(body);
   const scr=new THREE.Mesh(new THREE.PlaneGeometry(wd-.08,ht-.08),new THREE.MeshBasicMaterial({map:tex})); scr.position.z=.031; mon.add(scr);
   const neck=new THREE.Mesh(new THREE.BoxGeometry(.07,.3,.05),darkMat); neck.position.set(0,-ht/2-.12,-.03); mon.add(neck);
   mon.position.set(x,y,z); mon.rotation.y=ry; grp.add(mon); return mon;
  }
  monitor(1.18,.7,screenFor(owner?owner.id:'pm'),0,1.42,-.62,0);
  monitor(.82,.52,screenTex,-1.02,1.32,-.34,.5);
  monitor(.82,.52,screenTex,1.02,1.32,-.34,-.5);
  const holo=new THREE.Mesh(new THREE.PlaneGeometry(.95,.52),new THREE.MeshBasicMaterial({map:screenFor(owner?owner.id:'pm'),transparent:true,opacity:.45,side:THREE.DoubleSide}));
  holo.position.set(0,2.14,-.55); holo.rotation.x=-.18; holo.userData.baseY=2.14; holo.userData.phase=pos.x; deskHolos.push(holo); grp.add(holo);
  const kb=new THREE.Mesh(new THREE.BoxGeometry(.72,.03,.26),darkMat); kb.position.set(0,.83,.28); grp.add(kb);
  const mug=new THREE.Mesh(new THREE.CylinderGeometry(.05,.045,.1,12),new THREE.MeshStandardMaterial({color:0xe8e8f2,roughness:.4})); mug.position.set(.58,.88,.18); grp.add(mug);
  const seat=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.08,18),darkMat); seat.position.set(0,.48,.88); grp.add(seat);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.44,8),darkMat); stem.position.set(0,.24,.88); grp.add(stem);
  const backr=new THREE.Mesh(new THREE.BoxGeometry(.56,.62,.07),darkMat); backr.position.set(0,.92,1.08); backr.rotation.x=-.12; grp.add(backr);
  const label=textSprite(st.label.replace(/^\S+\s/,''),{size:40,color:'#b9b9cc',scale:[2.2,.55]}); label.position.set(0,2.62,-.1); grp.add(label);
  grp.position.set(pos.x,0,pos.z); grp.rotation.y=Math.PI;
  scene.add(grp); return grp;
 }
 ['boss','news','script','image','media','review','publish'].forEach(buildDesk);
 // vòng sáng dưới sàn mỗi trạm + bệ điều phối trung tâm với cầu hologram
 for(const stId of ['boss','pm','news','script','image','media','review','publish']){
  const p2=officeWorld(OFFICE_STATIONS[stId]); const owner=OFFICE_CAST.find(a=>a.station===stId);
  const ringM=new THREE.Mesh(new THREE.RingGeometry(1.5,1.62,48),new THREE.MeshBasicMaterial({color:new THREE.Color(owner?owner.color:0x2dd4ee),transparent:true,opacity:.30,side:THREE.DoubleSide}));
  ringM.rotation.x=-Math.PI/2; ringM.position.set(p2.x,.015,p2.z); scene.add(ringM);
 }
 const pmPos=officeWorld(OFFICE_STATIONS.pm);
 const podium=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.4,.12,40),new THREE.MeshStandardMaterial({color:0x1b2130,roughness:.4,metalness:.35}));
 podium.position.set(pmPos.x,.06,pmPos.z); scene.add(podium);
 const earthTex=canvasTex(256,128,(g,w,h)=>{g.fillStyle='#1d4e89';g.fillRect(0,0,w,h);g.fillStyle='#3f9e4d';for(let i=0;i<26;i++){g.beginPath();g.ellipse(Math.random()*w,20+Math.random()*(h-40),8+Math.random()*20,5+Math.random()*11,Math.random()*3,0,7);g.fill();}g.fillStyle='rgba(255,255,255,.5)';for(let i=0;i<20;i++){g.beginPath();g.ellipse(Math.random()*w,Math.random()*h,10+Math.random()*16,3+Math.random()*4,0,0,7);g.fill();}});
 const holoGlobe=new THREE.Group();
 holoGlobe.add(new THREE.Mesh(new THREE.SphereGeometry(.52,24,18),new THREE.MeshBasicMaterial({map:earthTex,transparent:true,opacity:.92})));
 holoGlobe.add(new THREE.Mesh(new THREE.SphereGeometry(.55,18,12),new THREE.MeshBasicMaterial({color:0x57e6ff,wireframe:true,transparent:true,opacity:.26})));
 const holoRing1=new THREE.Mesh(new THREE.TorusGeometry(.78,.012,8,64),new THREE.MeshBasicMaterial({color:0x57e6ff,transparent:true,opacity:.55})); holoRing1.rotation.x=1.1; holoGlobe.add(holoRing1);
 const holoRing2=new THREE.Mesh(new THREE.TorusGeometry(.86,.012,8,64),new THREE.MeshBasicMaterial({color:0x8b5cf6,transparent:true,opacity:.45})); holoRing2.rotation.x=2.2; holoRing2.rotation.y=.7; holoGlobe.add(holoRing2);
 holoGlobe.position.set(pmPos.x,3.05,pmPos.z); scene.add(holoGlobe);
 // Phòng nạp năng lượng: dãy buồng sạc kính ở góc phòng — nhân viên rảnh vào ngủ sạc
 const podPos=officeWorld(OFFICE_STATIONS.lounge);
 {
  const podGroup=new THREE.Group();
  const glassMat=new THREE.MeshStandardMaterial({color:0x8fd8ff,transparent:true,opacity:.30,roughness:.1,metalness:.1,side:THREE.DoubleSide,emissive:0x1d4e5f,emissiveIntensity:.4});
  const capMat=new THREE.MeshStandardMaterial({color:0x39424f,roughness:.4,metalness:.6});
  for(const off of [-1.15,0,1.15]){
   const tube=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,2.1,20,1,true),glassMat); tube.position.set(off,1.15,0); podGroup.add(tube);
   const capT=new THREE.Mesh(new THREE.CylinderGeometry(.64,.64,.1,20),capMat); capT.position.set(off,2.25,0); podGroup.add(capT);
   const capB=capT.clone(); capB.position.set(off,.05,0); podGroup.add(capB);
   const glow=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,1.9,12),new THREE.MeshBasicMaterial({color:0x2dd4ee,transparent:true,opacity:.17})); glow.position.set(off,1.15,0); podGroup.add(glow);
  }
  const podSign=textSprite('🔋 PHÒNG NẠP NĂNG LƯỢNG',{size:36,color:'#7df0c8',scale:[3.8,.82]}); podSign.position.set(0,2.95,0); podGroup.add(podSign);
  podGroup.position.set(podPos.x,0,podPos.z); scene.add(podGroup);
 }
 // --- Phòng chích điện: chuồng sắt ở góc phòng ---
 const cagePos=officeWorld(OFFICE_STATIONS.cage);
 const cage=new THREE.Group();
 {
  const metal=new THREE.MeshStandardMaterial({color:0x9aa3b2,metalness:.85,roughness:.35});
  const base=new THREE.Mesh(new THREE.BoxGeometry(2.6,.09,2.6),new THREE.MeshStandardMaterial({color:0x2a2a33,roughness:.9})); base.position.y=.045; cage.add(base);
  for(const [px,pz] of [[-1.25,-1.25],[1.25,-1.25],[-1.25,1.25],[1.25,1.25]]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,2.7,10),metal); post.position.set(px,1.35,pz); cage.add(post);}
  for(const rot of [0,Math.PI/2]){const beam=new THREE.Mesh(new THREE.BoxGeometry(2.6,.09,.09),metal); beam.position.y=2.68; beam.rotation.y=rot; cage.add(beam); const beam2=beam.clone(); beam2.position.set(rot?1.25:0,2.68,rot?0:1.25); if(rot){beam2.position.set(1.25,2.68,0);} cage.add(beam2);}
  for(let i=-1;i<=1;i+=.25){for(const side of [-1.25,1.25]){const bar=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,2.6,6),metal); bar.position.set(i*1.0,1.32,side); cage.add(bar);} }
  for(let i=-1;i<=1;i+=.25){for(const side of [-1.25,1.25]){const bar=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,2.6,6),metal); bar.position.set(side,1.32,i*1.0); cage.add(bar);} }
  const sign=textSprite('⚡ PHÒNG CHÍCH ĐIỆN',{size:40,color:'#ffd94d',scale:[3.4,.8]}); sign.position.set(0,3.25,0); cage.add(sign);
  cage.position.set(cagePos.x,0,cagePos.z); scene.add(cage);
 }
 // --- mặt robot có biểu cảm (vẽ bằng canvas): đang làm / rảnh / ngủ sạc / bị chích ---
 function faceTexture(mode){
  const c=document.createElement('canvas'); c.width=256; c.height=192; const g=c.getContext('2d');
  g.fillStyle='#0d1420'; g.beginPath(); g.roundRect(30,24,196,144,58); g.fill();
  g.strokeStyle='rgba(87,230,255,.28)'; g.lineWidth=3; g.beginPath(); g.roundRect(30,24,196,144,58); g.stroke();
  g.fillStyle='#57e6ff'; g.strokeStyle='#57e6ff'; g.lineWidth=11; g.lineCap='round';
  const eye=(x,y)=>{ if(mode==='zap'){g.beginPath();g.moveTo(x-13,y-13);g.lineTo(x+13,y+13);g.moveTo(x+13,y-13);g.lineTo(x-13,y+13);g.stroke();}
   else if(mode==='sleep'){g.beginPath();g.arc(x,y-4,14,Math.PI*.15,Math.PI*.85);g.stroke();}
   else if(mode==='work'){g.beginPath();g.arc(x,y+6,14,Math.PI*1.1,Math.PI*1.9);g.stroke();}
   else {g.beginPath();g.arc(x,y,9,0,Math.PI*2);g.fill();} };
  eye(88,84); eye(168,84);
  g.lineWidth=8; g.beginPath();
  if(mode==='zap'){g.moveTo(104,140);g.lineTo(118,131);g.lineTo(132,140);g.lineTo(146,131);g.stroke();}
  else if(mode==='sleep'){g.arc(128,130,7,0,Math.PI*2);g.stroke();}
  else {g.arc(128,116,13,Math.PI*.2,Math.PI*.8);g.stroke();}
  return new THREE.CanvasTexture(c);
 }
 const faceTexCache={work:faceTexture('work'),idle:faceTexture('idle'),sleep:faceTexture('sleep'),zap:faceTexture('zap')};
 // --- nhân viên robot ---
 function officeAttachProp(a,armR,mat,white,joint){
  const prop=new THREE.Group(); prop.position.set(0,-.68,.08); prop.rotation.x=-.5;
  const accent=new THREE.MeshStandardMaterial({color:new THREE.Color(a.color),roughness:.4});
  if(a.id==='pm'){const board=new THREE.Mesh(new THREE.BoxGeometry(.22,.3,.02),new THREE.MeshStandardMaterial({color:0xd8c9a3,roughness:.6})); prop.add(board); const clip=new THREE.Mesh(new THREE.BoxGeometry(.1,.03,.03),joint); clip.position.y=.15; prop.add(clip);}
  else if(a.id==='news'){const ring=new THREE.Mesh(new THREE.TorusGeometry(.09,.016,8,20),joint); ring.position.y=.05; prop.add(ring); const hd=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.13,8),joint); hd.position.set(.07,-.07,0); hd.rotation.z=.7; prop.add(hd);}
  else if(a.id==='script'){const pen=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.24,8),accent); pen.rotation.z=.3; prop.add(pen); const tip=new THREE.Mesh(new THREE.ConeGeometry(.016,.06,8),white); tip.position.set(.04,-.14,0); tip.rotation.z=.3+Math.PI; prop.add(tip);}
  else if(a.id==='image'){const cam=new THREE.Mesh(new THREE.BoxGeometry(.17,.12,.09),joint); prop.add(cam); const lens=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.05,12),new THREE.MeshStandardMaterial({color:0x57e6ff,roughness:.2})); lens.rotation.x=Math.PI/2; lens.position.z=.06; prop.add(lens);}
  else if(a.id==='media'){const b1=new THREE.Mesh(new THREE.BoxGeometry(.21,.05,.02),joint); prop.add(b1); const b2=new THREE.Mesh(new THREE.BoxGeometry(.21,.05,.02),accent); b2.position.set(-.02,.05,0); b2.rotation.z=.5; prop.add(b2);}
  else if(a.id==='review'){const sh=new THREE.Mesh(new THREE.CircleGeometry(.11,20),accent); prop.add(sh); const shIn=new THREE.Mesh(new THREE.CircleGeometry(.07,20),white); shIn.position.z=.005; prop.add(shIn);}
  else if(a.id==='publish'){const bodyR=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.17,10),white); prop.add(bodyR); const nose=new THREE.Mesh(new THREE.ConeGeometry(.05,.1,10),new THREE.MeshStandardMaterial({color:0xe0342b,roughness:.4})); nose.position.y=.13; prop.add(nose);}
  armR.add(prop);
 }
 function buildAgent(a){
  const grp=new THREE.Group();
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(a.color),roughness:.42});
  const white=new THREE.MeshStandardMaterial({color:0xf2f4f9,roughness:.3});
  const joint=new THREE.MeshStandardMaterial({color:0x2b2f3a,roughness:.5,metalness:.3});
  function buildLeg(sx){
   const leg=new THREE.Group(); leg.position.set(sx*.13,.98,0);
   const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.085,.26,4,10),white); thigh.position.y=-.22; leg.add(thigh);
   const knee=new THREE.Mesh(new THREE.SphereGeometry(.08,12,10),joint); knee.position.y=-.46; leg.add(knee);
   const shin=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.24,4,10),white); shin.position.y=-.68; leg.add(shin);
   const foot=new THREE.Mesh(new THREE.SphereGeometry(.11,12,10),joint); foot.scale.set(1,.5,1.5); foot.position.set(0,-.93,.04); leg.add(foot);
   grp.add(leg); return leg;
  }
  const legL=buildLeg(-1),legR=buildLeg(1);
  const pelvis=new THREE.Mesh(new THREE.SphereGeometry(.24,18,14),joint); pelvis.scale.set(1.15,.72,1); pelvis.position.y=1.02; grp.add(pelvis);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.30,.235,.58,20),white); torso.position.y=1.36; grp.add(torso);
  const chestPlate=new THREE.Mesh(new THREE.BoxGeometry(.4,.4,.07),mat); chestPlate.position.set(0,1.42,.24); chestPlate.rotation.x=-.06; grp.add(chestPlate);
  const glyphTex=canvasTex(96,96,(g)=>{g.clearRect(0,0,96,96);g.font='64px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(a.emoji,48,52);});
  const glyph=new THREE.Mesh(new THREE.PlaneGeometry(.2,.2),new THREE.MeshBasicMaterial({map:glyphTex,transparent:true})); glyph.position.set(0,1.42,.285); glyph.rotation.x=-.06; grp.add(glyph);
  const chestLight=new THREE.Mesh(new THREE.CircleGeometry(.04,14),new THREE.MeshBasicMaterial({color:0x9ff3ff})); chestLight.position.set(0,1.63,.27); grp.add(chestLight);
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.245,.03,8,24),mat); belt.rotation.x=Math.PI/2; belt.position.y=1.1; grp.add(belt);
  const pack=new THREE.Mesh(new THREE.BoxGeometry(.36,.46,.15),joint); pack.position.set(0,1.38,-.26); grp.add(pack);
  const packStripe=new THREE.Mesh(new THREE.BoxGeometry(.37,.07,.16),mat); packStripe.position.set(0,1.57,-.26); grp.add(packStripe);
  function buildArm(sx){
   const arm=new THREE.Group(); arm.position.set(sx*.37,1.56,0);
   const pad=new THREE.Mesh(new THREE.SphereGeometry(.13,14,12),mat); pad.scale.set(1,.8,1); pad.position.y=.02; arm.add(pad);
   const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.2,4,10),mat); upper.position.y=-.18; arm.add(upper);
   const elbow=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),joint); elbow.position.y=-.36; arm.add(elbow);
   const fore=new THREE.Mesh(new THREE.CapsuleGeometry(.06,.18,4,10),white); fore.position.y=-.5; arm.add(fore);
   const hand=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),white); hand.position.y=-.68; arm.add(hand);
   grp.add(arm); return arm;
  }
  const armL=buildArm(-1),armR=buildArm(1);
  officeAttachProp(a,armR,mat,white,joint);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.12,12),joint); neck.position.y=1.74; grp.add(neck);
  const head=new THREE.Group(); head.position.y=1.96;
  const skull=new THREE.Mesh(new THREE.SphereGeometry(.36,26,20),white); skull.scale.y=.94; head.add(skull);
  const crest=new THREE.Mesh(new THREE.BoxGeometry(.07,.03,.34),mat); crest.position.set(0,.35,-.02); head.add(crest);
  for(const sx of [-1,1]){
   const earPod=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.07,16),white); earPod.rotation.z=Math.PI/2; earPod.position.set(sx*.36,0,0); head.add(earPod);
   const earRing=new THREE.Mesh(new THREE.TorusGeometry(.07,.014,8,20),new THREE.MeshBasicMaterial({color:new THREE.Color(a.color)})); earRing.rotation.y=Math.PI/2; earRing.position.set(sx*.40,0,0); head.add(earRing);
  }
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.2,6),joint); ant.position.y=.42; head.add(ant);
  const antBall=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8),new THREE.MeshBasicMaterial({color:new THREE.Color(a.color)})); antBall.position.y=.55; head.add(antBall);
  const faceMat=new THREE.MeshBasicMaterial({map:faceTexCache.idle,transparent:true});
  const face=new THREE.Mesh(new THREE.PlaneGeometry(.56,.42),faceMat); face.position.set(0,-.02,.31); head.add(face);
  grp.add(head);
  if(a.id==='boss'){
   const gold=new THREE.MeshStandardMaterial({color:0xf5c542,roughness:.3,metalness:.6});
   const crown=new THREE.Mesh(new THREE.CylinderGeometry(.17,.2,.1,12,1,true),gold); crown.position.y=.4; head.add(crown);
   const tie=new THREE.Mesh(new THREE.BoxGeometry(.09,.24,.02),gold); tie.position.set(0,1.3,.29); grp.add(tie);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(.44,.58,40),new THREE.MeshBasicMaterial({color:new THREE.Color(a.color),transparent:true,opacity:.95,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=.02; ring.visible=false; grp.add(ring);
  const nameSp=textSprite(officeAgentName(a),{size:46,scale:[2.3,.58]}); nameSp.position.y=2.85; grp.add(nameSp);
  const zzz=textSprite('💤',{size:52,bg:'rgba(0,0,0,0)',scale:[.7,.45]}); zzz.position.set(.62,2.55,0); zzz.visible=false; grp.add(zzz);
  scene.add(grp);
  return {a,grp,legL,legR,armL,armR,ring,nameSp,zzz,faceMat,faceMode:'idle',name:officeAgentName(a),target:new THREE.Vector3(),walking:false,busy:false,phase:Math.random()*7};
 }
 const agents={}; for(const a of OFFICE_CAST){const built=buildAgent(a); const home=officeWorld(OFFICE_STATIONS[a.station]); built.grp.position.set(home.x,0,home.z); built.target.copy(built.grp.position); agents[a.id]=built;}
 scene.traverse(o=>{if(o.isMesh&&o.material&&o.material.isMeshStandardMaterial&&!o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});
 floor.receiveShadow=true;
 // đường chấm khi di chuyển + gói hàng
 for(const id in agents){const A=agents[id];const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:new THREE.Color(A.a.color),dashSize:.22,gapSize:.14,transparent:true,opacity:.6}));line.visible=false;scene.add(line);A.path=line;}
 const parcel=new THREE.Mesh(new THREE.BoxGeometry(.36,.36,.36),new THREE.MeshStandardMaterial({color:0xffb020,emissive:0xcf7a00,emissiveIntensity:.55,roughness:.5}));
 parcel.visible=false; scene.add(parcel);
 const parcelTarget=new THREE.Vector3();
 // tia điện
 const bolts=[];
 for(let i=0;i<3;i++){const geo=new THREE.BufferGeometry();const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffe45e,transparent:true,opacity:.95}));line.visible=false;scene.add(line);bolts.push(line);}
 function jaggedBolt(line,from,to){const pts=[];const N=7;for(let i=0;i<=N;i++){const t=i/N;const p=from.clone().lerp(to,t);if(i>0&&i<N){p.x+=(Math.random()-.5)*.3;p.z+=(Math.random()-.5)*.3;}pts.push(p);}line.geometry.dispose();line.geometry=new THREE.BufferGeometry().setFromPoints(pts);}
 let zapId=null,zapClock=0;
 // --- đồng bộ từ trạng thái thật ---
 window.__office3D=true; window.__office3DCamera=orbit;
 window.__office3DSync=(ctx)=>{
  const slotUse=new Map();
  for(const a of OFFICE_CAST){
   const A=agents[a.id]; if(!A)continue;
   const stId=officeStationOf(a.id,ctx);
   const st=OFFICE_STATIONS[stId]||OFFICE_STATIONS.lounge;
   const slot=slotUse.get(stId)||0; slotUse.set(stId,slot+1);
   const dx=slot===0?0:slot===1?9:-9;
   const w=officeWorld(st); let tx=w.x+dx*.22; if(stId==='lounge')tx=w.x+[-1.15,0,1.15][slot%3];
   A.target.set(tx,0,w.z);
   A.busy=(a.id==='boss'&&Boolean(ctx.awaiting))||(a.id==='media'&&ctx.stage==='produce')||(a.id==='script'&&ctx.stage==='script')||(a.id==='publish'&&ctx.stage==='publish')||(ctx.culprit&&ctx.culprit.agentId===a.id);
   A.ring.visible=A.busy;
   if(ctx.culprit&&ctx.culprit.agentId===a.id)A.ring.material.color.set(0xff4545); else A.ring.material.color.set(a.color);
   const sleeping=stId==='lounge'&&!(ctx.culprit&&ctx.culprit.agentId===a.id);
   if(A.zzz)A.zzz.visible=sleeping;
   const fm=(ctx.culprit&&ctx.culprit.agentId===a.id)?'zap':sleeping?'sleep':A.busy?'work':'idle';
   if(A.faceMat&&A.faceMode!==fm){A.faceMat.map=faceTexCache[fm];A.faceMat.needsUpdate=true;A.faceMode=fm;}
   const nm=officeAgentName(a);
   if(nm!==A.name){A.name=nm; const parent=A.nameSp.parent; const idx=parent.children.indexOf(A.nameSp); const fresh=textSprite(nm,{size:46,scale:[2.3,.58]}); fresh.position.y=2.85; parent.remove(A.nameSp); parent.add(fresh); A.nameSp=fresh;}
  }
  zapId=ctx.culprit?ctx.culprit.agentId:null;
  const target=ctx.awaiting?'boss':ctx.activeRun?(ctx.stage==='produce'?'media':ctx.stage==='publish'?'publish':ctx.stage==='script'?'script':'pm'):null;
  if(target){const w=officeWorld(OFFICE_STATIONS[target]); parcelTarget.set(w.x+.8,1.15,w.z-.4); parcel.visible=true;} else parcel.visible=false;
 };
 // --- điều khiển camera: kéo để xoay, lăn chuột để zoom, bấm nhẹ để đổi tên ---
 let dragging=false,dragMoved=0,px=0,py=0;
 const el=renderer.domElement;
 el.style.touchAction='none';
 el.addEventListener('pointerdown',e=>{dragging=true;dragMoved=0;px=e.clientX;py=e.clientY;el.setPointerCapture(e.pointerId);});
 el.addEventListener('pointermove',e=>{if(!dragging)return;const dx=e.clientX-px,dy=e.clientY-py;dragMoved+=Math.abs(dx)+Math.abs(dy);px=e.clientX;py=e.clientY;orbit.theta-=dx*.005;orbit.phi=Math.min(1.35,Math.max(.55,orbit.phi-dy*.004));});
 el.addEventListener('pointerup',e=>{
  dragging=false;
  if(dragMoved>6)return;
  const rect=el.getBoundingClientRect();
  const mouse=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
  const ray=new THREE.Raycaster(); ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(Object.values(agents).map(A=>A.grp),true);
  if(hits.length){let o=hits[0].object;while(o&&!Object.values(agents).some(A=>A.grp===o))o=o.parent;
   if(o){const A=Object.values(agents).find(x=>x.grp===o); if(A){const next=prompt(`Đổi tên cho ${A.a.role}:`,officeAgentName(A.a)); if(next&&next.trim()){officeNames[A.a.id]=next.trim().slice(0,24);localStorage.setItem('aios-office-names',JSON.stringify(officeNames));officeRender();}}}}
 });
 el.addEventListener('wheel',e=>{e.preventDefault();orbit.radius=Math.min(38,Math.max(15,orbit.radius+e.deltaY*.02));},{passive:false});
 addEventListener('resize',()=>renderer.setSize(W(),H()));
 // --- vòng lặp chuyển động ---
 const clockT=new THREE.Clock();
 renderer.setAnimationLoop(()=>{
  if(!office3DVisible||document.hidden)return;
  const dt=Math.min(clockT.getDelta(),.05),t=clockT.elapsedTime;
  for(const id in agents){
   const A=agents[id],p=A.grp.position;
   const dx=A.target.x-p.x,dz=A.target.z-p.z,dist=Math.hypot(dx,dz);
   if(dist>.05){
    const step=Math.min(dist,4.4*dt); p.x+=dx/dist*step; p.z+=dz/dist*step; A.walking=true;
    const targetRot=Math.atan2(dx,dz); let dr=targetRot-A.grp.rotation.y; while(dr>Math.PI)dr-=2*Math.PI; while(dr<-Math.PI)dr+=2*Math.PI; A.grp.rotation.y+=dr*Math.min(1,dt*10);
    const sw=Math.sin(t*11+A.phase)*.55;
    A.legL.rotation.x=sw; A.legR.rotation.x=-sw; A.armL.rotation.x=-sw*.8; A.armR.rotation.x=sw*.8;
    p.y=Math.abs(Math.sin(t*11+A.phase))*.05;
    const pos=A.path.geometry.attributes.position; pos.setXYZ(0,p.x,.06,p.z); pos.setXYZ(1,A.target.x,.06,A.target.z); pos.needsUpdate=true; A.path.computeLineDistances(); A.path.visible=true;
   } else {
    A.walking=false; A.path.visible=false;
    A.legL.rotation.x*=.8; A.legR.rotation.x*=.8; A.armL.rotation.x*=.8; A.armR.rotation.x*=.8;
    p.y=Math.sin(t*1.7+A.phase)*.015;
    let fd=0-A.grp.rotation.y; while(fd>Math.PI)fd-=2*Math.PI; while(fd<-Math.PI)fd+=2*Math.PI; A.grp.rotation.y+=fd*Math.min(1,dt*3.5);
   }
   if(zapId===id){
    zapClock+=dt;
    const burst=(zapClock%1.7)<.38;
    if(burst){A.grp.rotation.z=(Math.random()-.5)*.22; if(Math.random()<.5){const from=new THREE.Vector3(cagePos.x+(Math.random()-.5)*2,2.6,cagePos.z+(Math.random()-.5)*2); const to=new THREE.Vector3(p.x,1.5,p.z); for(const b of bolts){jaggedBolt(b,from,to); b.visible=true;}}}
    else {A.grp.rotation.z=0; for(const b of bolts)b.visible=false;}
   } else if(A.grp.rotation.z)A.grp.rotation.z=0;
  }
  if(parcel.visible){parcel.position.lerp(parcelTarget,Math.min(1,dt*5)); parcel.position.y=1.15+Math.sin(t*2.4)*.07; parcel.rotation.y+=dt*.8;}
  holoGlobe.rotation.y+=dt*.4; holoRing1.rotation.z+=dt*.8; holoRing2.rotation.z-=dt*.6; holoGlobe.position.y=3.05+Math.sin(t*1.3)*.07;
  for(const h of deskHolos){h.position.y=h.userData.baseY+Math.sin(t*1.8+h.userData.phase)*.045; h.rotation.y=Math.sin(t*.7+h.userData.phase)*.25;}
  camera.position.set(Math.sin(orbit.theta)*Math.sin(orbit.phi)*orbit.radius,Math.cos(orbit.phi)*orbit.radius,Math.cos(orbit.theta)*Math.sin(orbit.phi)*orbit.radius);
  camera.lookAt(0,1.0,0);
  renderer.render(scene,camera);
 });
}
