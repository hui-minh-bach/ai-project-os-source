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
 boss:{x:50,y:9,label:'👔 Bàn Sếp Lâm'},
 pm:{x:50,y:38,label:'🎯 Trưởng phòng'},
 news:{x:10,y:22,label:'📰 Tin tức'},
 script:{x:12,y:58,label:'✍️ Biên tập'},
 image:{x:88,y:58,label:'🎨 Hình ảnh'},
 media:{x:72,y:30,label:'🎬 Sản xuất'},
 review:{x:88,y:22,label:'🔍 Kiểm duyệt'},
 publish:{x:50,y:82,label:'🚀 Đăng bài'},
 lounge:{x:14,y:86,label:'☕ Góc nghỉ'},
};
let officeNames={}; try{officeNames=JSON.parse(localStorage.getItem('aios-office-names')||'{}')}catch{officeNames={}}
let officeState={runs:[],cards:[],tasks:[],loaded:false,lastFeed:[]};
const officePrevPos={},officeWalkTimers={};
function officeAgentName(a){return officeNames[a.id]||a.name}
function officeStationOf(agentId,ctx){
 const a=OFFICE_CAST.find(x=>x.id===agentId); if(!a)return 'lounge';
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
 const ctx={activeRun,awaiting,tasks,stage:officeStageOf(activeRun),justCompleted};
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
   if(!lines.length)lines.push('☕ Cả đội đang chờ việc. Quét tin mới ở tab Ý tưởng hoặc bật vòng khép kín ở tab Publish để văn phòng nhộn nhịp lên.');
  }
  feed.innerHTML=lines.map(l=>`<p>${esc(l)}</p>`).join('');
 }
 const clock=$('#officeClock');
 if(clock)clock.textContent=officeState.loaded?('Cập nhật '+new Date().toLocaleTimeString('vi-VN')):'Đang tải…';
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
