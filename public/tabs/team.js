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
  const active=teamActiveStatuses.has(task.status)||task.status==='done'||task.status==='stale',binding=active?task['served'+(role==='worker'?'Worker':'Reviewer')+'Binding']||task[role+'Binding']||task['assigned'+(role==='worker'?'Worker':'Reviewer')]||state.project?.modelRoles?.[role]:task['assigned'+(role==='worker'?'Worker':'Reviewer')]||task[role+'Binding']||state.project?.modelRoles?.[role];
  const c=state.connections.find(c=>c.id===binding?.connectionId),snapshot=task[role+'Descriptor'],descriptor=snapshot?.connectionId===binding?.connectionId&&snapshot?.model===binding?.model?snapshot:null;
  return {binding,provider:descriptor?.provider||c?.kind||'',name:descriptor?.name||c?.name||'',model:binding?.model||'',verified:!!c&&['verified','catalog'].includes(c.availability?.status)&&c.availability.models.includes(binding?.model)};
}
// A temporarily failed primary must not disable the button when a valid
// owner-connected backup can receive the SAME task. Server remains authoritative.
function teamRouteAvailable(task,role){
 const original=teamBinding(task,role),p=state.project;
 if(original.verified)return true;
 if(!state.vault?.unlocked||p?.settings?.autoFailover===false)return false;
 const bound=original.binding,primary=state.connections.find(c=>c.id===bound?.connectionId);
 // A removed/changed identity or an unknown model needs explicit configuration.
 if(!primary||(primary.availability?.catalogModels||[]).indexOf(bound?.model)<0)return false;
 const bindings=[p.modelRoleBackups?.[role],...Object.values(p.modelRoles||{}).flat(),...Object.values(p.modelRoleBackups||{}).flat()].filter(Boolean);
 if(p.settings?.failoverScope!=='project')bindings.push(...aiConns().map(c=>({connectionId:c.id,model:c.model})));
 return bindings.some(b=>{const c=state.connections.find(x=>x.id===b.connectionId);return c&&['verified','catalog'].includes(c.availability?.status)&&(c.availability?.models||[]).includes(b.model)&&!c.meta?.routingDisabled;});
}
function teamEngineAvailable(task){const id=task.engineId||state.project?.settings?.defaultEngine||'native';return id==='native'||id==='mini-swe-agent'&&state.engines.find(e=>e.id===id)?.runtimeInstalled&&state.project?.settings?.allowUnsafeExternal===true;}
function teamCanRun(task){return teamStartableStatuses.has(task.status)&&teamTaskCurrent(task)&&teamEngineAvailable(task)&&(state.project?.settings?.sandboxMode!=='docker'||state.sandbox?.docker)&&(task.dependsOn||[]).every(id=>state.project.tasks.find(t=>t.id===id)?.status==='done')&&teamRouteAvailable(task,'worker')&&(state.project?.settings?.reviewRequired===false||teamRouteAvailable(task,'reviewer'));}
function teamRunReason(task){if(!teamTaskCurrent(task))return 'Cần specification đã chốt và kế hoạch/task cùng phiên bản.';if(!teamEngineAvailable(task))return 'Engine chưa hỗ trợ task, runtime chưa cài hoặc chưa có opt-in UNSAFE.';if(state.project?.settings?.sandboxMode==='docker'&&!state.sandbox?.docker)return 'Docker runtime chưa khả dụng; chọn Safe để dùng file tools.';if(!teamRouteAvailable(task,'worker'))return 'Phân vai Worker đã xác minh trong Kết nối hoặc sửa task.';if(state.project?.settings?.reviewRequired!==false&&!teamRouteAvailable(task,'reviewer'))return 'Phân vai Reviewer đã xác minh trong Kết nối hoặc sửa task.';if((task.dependsOn||[]).some(id=>state.project.tasks.find(t=>t.id===id)?.status!=='done'))return 'Còn dependency chưa hoàn tất.';return teamStartableStatuses.has(task.status)?'Chạy trên worktree riêng':'Trạng thái này chưa hỗ trợ chạy lại.';}
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
  $('#teamMaxParallel').value=settings.maxParallel||2;$('#teamReviewRequired').checked=settings.reviewRequired!==false;$('#teamAutoRepair').checked=settings.autoRepair!==false;$('#teamAutoFailover').checked=settings.autoFailover!==false;$('#teamFailoverScope').value=settings.failoverScope||'connected';$('#teamMaxProviderAttempts').value=settings.maxProviderAttempts||4;
  ['teamMaxParallel','teamReviewRequired','teamAutoRepair','teamAutoFailover','teamFailoverScope','teamMaxProviderAttempts'].forEach(id=>$('#'+id).disabled=!state.project||teamSettingsPending);
  $('#teamEngineHint').textContent=selected==='mini-swe-agent'?'External runtime có shell trên host (UNSAFE).':'Safe: không chạy npm/shell; chỉ có file tools.';
  $('#teamReviewWarning').hidden=settings.reviewRequired!==false;
  const host=settings.sandboxMode==='host',external=settings.allowUnsafeExternal===true;$('#teamUnsafeWarning').hidden=!host&&!external;$('#teamUnsafeWarning').textContent=host?'⚠ UNSAFE — Host chạy npm/test trực tiếp trên máy. Code dự án có thể đọc file và khởi chạy process ngoài worktree.':external?'⚠ UNSAFE — External agent được phép chạy shell trực tiếp trên host. Chỉ runtime đã cài và adapter hỗ trợ mới có thể thực thi.':'';
  renderTeamActionAvailability();
}
async function saveExecutionSettings(){
  if(!state.project)return;const id=state.project.id,settings={defaultEngine:$('#taskEngineSelect').value||'native',sandboxMode:$('input[name="teamSandbox"]:checked')?.value||'safe',allowUnsafeExternal:$('#allowUnsafeExternal').checked===true,maxParallel:Number($('#teamMaxParallel').value)||2,reviewRequired:$('#teamReviewRequired').checked===true,autoRepair:$('#teamAutoRepair').checked===true,autoFailover:$('#teamAutoFailover').checked===true,failoverScope:$('#teamFailoverScope').value,maxProviderAttempts:Number($('#teamMaxProviderAttempts').value)||4};
  teamSettingsPending=true;renderTeamActionAvailability();
  try{const p=await api(`/api/projects/${id}/settings`,{method:'POST',body:JSON.stringify(settings)});if(state.project?.id===id){state.project=p;renderTasks();}return p;}finally{teamSettingsPending=false;renderExecutionControls();}
}
async function teamChangeSettings(){try{await saveExecutionSettings();toast('Đã lưu cấu hình thực thi')}catch(e){renderExecutionControls();toast(e.message);}}
$('#taskEngineSelect').addEventListener('change',teamChangeSettings);$$('input[name="teamSandbox"]').forEach(e=>e.addEventListener('change',teamChangeSettings));['allowUnsafeExternal','teamMaxParallel','teamReviewRequired','teamAutoRepair','teamAutoFailover','teamFailoverScope','teamMaxProviderAttempts'].forEach(id=>$('#'+id).addEventListener('change',teamChangeSettings));
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
$('#page-idea').addEventListener('click',async e=>{
  const tab=e.target.closest('[data-team-tab]');if(tab){teamDetailTab=tab.dataset.teamTab;renderTeamDetail();return;}
  const select=e.target.closest('[data-team-select]');if(select){teamSelectedTask=select.dataset.teamSelect;teamDetailTab='description';renderTasks();return;}
  const copy=e.target.closest('[data-team-copy]');if(copy){try{await navigator.clipboard.writeText(copy.dataset.teamCopy);toast('Đã sao chép đường dẫn lịch sử.');}catch{toast('Clipboard chưa khả dụng trong trình duyệt này.');}return;}
  const action=e.target.closest('[data-team-action]');if(action){if(action.disabled)return;const task=state.project?.tasks?.find(t=>t.id===action.dataset.task);if(!task)return;if(action.dataset.teamAction==='menu'){teamMenuTask=teamMenuTask===task.id?null:task.id;renderTasks();return;}teamMenuTask=null;if(action.dataset.teamAction==='run')await teamRunTask(task.id);else if(action.dataset.teamAction==='edit')openTeamTaskDialog(task);else if(action.dataset.teamAction==='archive')await teamArchiveTask(task.id);return;}
  const card=e.target.closest('[data-team-task]');if(card){teamSelectedTask=card.dataset.teamTask;teamMenuTask=null;renderTasks();}
});
$('#taskBoard').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-team-task]')){e.preventDefault();teamSelectedTask=e.target.dataset.teamTask;teamMenuTask=null;renderTasks();}});
$('#runReady').onclick=async()=>{
  const p=state.project;if(!p)return;teamBatchPending=true;renderTeamActionAvailability();
  try{const result=await api(`/api/projects/${p.id}/run-ready`,{method:'POST',body:JSON.stringify({limit:p.settings?.maxParallel||2,autoContinue:true})});if(state.project?.id===p.id)await chooseProject(p.id);toast(result.runs?.length?`Batch: ${result.runs.filter(r=>r.status==='done').length}/${result.runs.length} task đã merge; xem test/review thực.`:result.message||'Không có task sẵn sàng.');}catch(err){toast(err.message);if(state.project?.id===p.id)await chooseProject(p.id);}finally{teamBatchPending=false;renderTeamActionAvailability();}
};
$('#buildPlan').onclick=async()=>{const p=state.project;if(!p)return toast('Hãy chọn dự án');teamPlanPending=true;renderTeamActionAvailability();try{await api(`/api/projects/${p.id}/plan`,{method:'POST',body:JSON.stringify({managerId:$('#managerSelect').value||undefined})});if(state.project?.id===p.id)await chooseProject(p.id);toast('Đã chia task; kế hoạch trước được giữ trong lịch sử.');}catch(e){toast(e.message);}finally{teamPlanPending=false;renderTeamActionAvailability();}};
async function loadWorkspace(){if(!state.project)return;const id=state.project.id;try{const x=await api(`/api/projects/${id}/workspace-summary`);if(state.project?.id===id)$('#workspaceFiles').innerHTML=x.files.length?x.files.map(f=>`<code>${esc(f)}</code>`).join(''):'<p class="team-empty-copy">Workspace chưa có file.</p>';}catch(e){$('#workspaceFiles').textContent='Workspace chưa khả dụng: '+e.message;}}
document.addEventListener('page-change',e=>{if(e.detail.page==='idea'){renderTasks();renderExecutionControls();}});
document.addEventListener('connections-change',()=>{renderTasks();renderExecutionControls();});
setInterval(async()=>{
  if(!$('#page-idea').classList.contains('active')||!state.project||teamPollPending)return;
  const task=state.project.tasks?.find(t=>t.id===teamSelectedTask),runtime=$('#page-idea [data-team-runtime]');if(task&&runtime)runtime.textContent=teamDuration(task);
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
function officeBotSpriteKey(provider){return {'ChatGPT':'chatgpt','Claude':'claude','Gemini':'gemini','Google Gemini':'gemini','Antigravity':'antigravity'}[provider]||'default'}
function officeFigure(a){
 if(a.fleet){const pk=officeBotSpriteKey(a.fleet.provider); return `<span class="office-bot-sprites" aria-hidden="true"><img class="bot-sprite bot-pose-idle" src="/assets/bots/tam19-${pk}-idle.png" alt=""><span class="bot-sit-window"><img class="bot-sit-sheet" src="/assets/bots/tam19-${pk}-sit.png" alt=""></span><img class="bot-sprite bot-pose-walk" src="/assets/bots/tam19-${pk}-walk.png" alt=""></span>`;}
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
 boss:{x:50,y:8,label:'👔 Bàn Sếp Lâm'},
 intake:{x:64,y:10,label:'🤝 Nhận việc với Sếp'},
 news:{x:12,y:26,label:'📰 Tin tức'},
 script:{x:36,y:18,label:'✍️ Biên tập'},
 image:{x:64,y:18,label:'🎨 Hình ảnh'},
 media:{x:88,y:26,label:'🎬 Sản xuất'},
 pm:{x:50,y:46,label:'🎯 Điều phối'},
 review:{x:20,y:68,label:'🔍 Kiểm duyệt'},
 publish:{x:80,y:68,label:'🚀 Đăng bài'},
 lounge:{x:8,y:86,label:'🔋 Phòng nạp năng lượng'},
 cage:{x:92,y:84,label:'⚡ Phòng chích điện'},
};
/* Tọa độ 2D khớp phông phòng isometric mới (office-backdrop.jpg): chiếu từ
 * tọa độ thế giới của scene gốc qua đúng camera render, đã đối chiếu với
 * ảnh render thật. Chỉ dùng cho bản 2D — bản 3D giữ OFFICE_STATIONS cũ. */
const OFFICE_STATIONS_2D={
 boss:{x:36.8,y:66.6,label:'👔 Bàn Sếp Lâm'},
 intake:{x:42.7,y:68.4,label:'🤝 Nhận việc với Sếp'},
 news:{x:39.9,y:40.7,label:'📰 Tin tức'},
 script:{x:34,y:49.1,label:'✍️ Biên tập'},
 image:{x:57.7,y:64,label:'🎨 Hình ảnh'},
 media:{x:65.1,y:43.8,label:'🎬 Sản xuất'},
 pm:{x:65.7,y:56.9,label:'🎯 Điều phối'},
 review:{x:55.1,y:37.6,label:'🔍 Kiểm duyệt'},
 publish:{x:61.5,y:47.5,label:'🚀 Đăng bài'},
 lounge:{x:41.6,y:30.2,label:'🔋 Phòng nạp năng lượng'},
 cage:{x:77.3,y:52.6,label:'⚡ Phòng chích điện'},
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
/* Ghim vị trí thủ công của robot trong phòng 3D (0.9.57): Sếp bấm chọn
 * một robot rồi bấm vào bàn / ô sạc / điểm sàn để điều nó tới đó. Ghim
 * lưu ở localStorage 'aios-office-pins' theo id nhân viên. QUY TẮC ƯU
 * TIÊN: vị trí theo trạng thái thật (đang chạy → bàn của lượt chạy, lỗi
 * → chuồng chích điện, nghỉ sạc vì hạn mức → ô sạc) LUÔN thắng ghim;
 * ghim tự áp dụng lại khi trạng thái đó qua đi. Chỉ phòng 3D dùng ghim —
 * bản 2D giữ cách điều khiển như cũ. */
function officeLoadPins(){try{return JSON.parse(localStorage.getItem('aios-office-pins')||'{}')}catch{return{}}}
function officeSavePins(p){try{localStorage.setItem('aios-office-pins',JSON.stringify(p))}catch{}}
let officeState={runs:[],cards:[],tasks:[],loaded:false,lastFeed:[],fleet:null,rosterSig:''};
const officePrevPos={},officeWalkTimers={};
function officeAgentName(a){return officeNames[a.id]||a.name}
function officeDisplayName(a,roster){
 if(a.fleet&&a.fleet.standby)return officeAgentName(a);
 if(!a.fleet)return officeAgentName(a);
 const same=(roster||[]).filter(x=>x.fleet&&x.fleet.provider===a.fleet.provider);
 return same.length<2?a.fleet.provider:a.fleet.provider+' '+(same.findIndex(x=>x.id===a.id)+1);
}
// Tên trên bảng tên 3D: tên kết nối (bot tài khoản); cast thường giữ nguyên.
function officePlateName(a){
 return officeAgentName(a);
}
// --- Đội bot theo tài khoản (0.9.33): mỗi kết nối AI là một bot TAM01 ---
function officeFleetActive(){return Boolean(officeState.fleet&&Array.isArray(officeState.fleet.bots));}
/* Phân vị trí cho cả đội (0.9.57) — mỗi robot MỘT vị trí riêng, thứ tự
 * ưu tiên đúng lệnh của Sếp:
 * 1) VỊ TRÍ THEO TRẠNG THÁI THẬT luôn thắng: bot đang chạy → bàn của lượt
 *    chạy (trạm fleet), bot lỗi mới nhất → chuồng chích điện, bot nghỉ sạc
 *    vì chạm hạn mức → ô sạc (ưu tiên đúng baySlot của nó), trưởng phòng
 *    đang nhận việc → trạm intake, Sếp → bàn Sếp.
 * 2) GHIM THỦ CÔNG của Sếp (officeLoadPins) — chỉ áp dụng khi robot
 *    không có vị trí trạng thái; ghim tự quay lại khi trạng thái qua đi.
 * 3) MẶC ĐỊNH: bot đã kết nối đang rảnh → NGỒI vào một bàn trống (mỗi
 *    bot một bàn); hết bàn thì về ô sạc. Bot lỗi (không vào chuồng), bot
 *    chưa kết nối và robot ô trống → ô sạc còn trống, mỗi bot một ô. */
const OFFICE_DESK_POOL=['news','script','image','media','review','publish','pm'];
function officeResolvePosts(roster){
 const pins=officeLoadPins();
 const posts=new Map(), takenDesks=new Set(), takenPods=new Set();
 const podFree=()=>{for(let s=0;s<10;s++)if(!takenPods.has(s))return s; return 9;};
 const setPod=(a,slot,pinned,stateDriven)=>{const s=(Number.isInteger(slot)&&slot>=0&&slot<10&&!takenPods.has(slot))?slot:podFree(); takenPods.add(s); posts.set(a.id,{kind:'pod',slot:s,pinned:!!pinned,stateDriven:!!stateDriven});};
 const setDesk=(a,id,pinned,stateDriven)=>{takenDesks.add(id); posts.set(a.id,{kind:id==='pm'?'station':'desk',id,pinned:!!pinned,stateDriven:!!stateDriven});};
 for(const a of roster){
  if(a.id==='boss'){setDesk(a,'boss',false,true); continue;}
  if(!a.fleet||a.fleet.standby)continue;
  const b=a.fleet;
  let intake=false; try{const ink=JSON.parse(localStorage.getItem('aios-intake')||'null'); intake=Boolean(ink&&Date.now()-ink.ts<180000&&(!ink.lead||ink.lead===b.connectionId));}catch{}
  if(intake){posts.set(a.id,{kind:'station',id:'intake',stateDriven:true}); continue;}
  if(b.cage||b.station==='cage'){posts.set(a.id,{kind:'cage',stateDriven:true}); continue;}
  if(b.state==='working'&&b.station&&b.station!=='bay'){setDesk(a,b.station,false,true); continue;}
  if(b.state==='charging'&&b.resting){setPod(a,typeof b.baySlot==='number'?b.baySlot:-1,false,true); continue;}
 }
 for(const a of roster){
  if(posts.has(a.id))continue;
  const pin=pins[a.id]; if(!pin)continue;
  if(pin.kind==='desk'&&OFFICE_DESK_POOL.includes(pin.id)&&!takenDesks.has(pin.id))setDesk(a,pin.id,true,false);
  else if(pin.kind==='pod')setPod(a,typeof pin.slot==='number'?pin.slot:-1,true,false);
  else if(pin.kind==='floor'&&Number.isFinite(pin.x)&&Number.isFinite(pin.z))posts.set(a.id,{kind:'floor',x:Math.max(-16,Math.min(16,pin.x)),z:Math.max(-10.5,Math.min(10.5,pin.z)),pinned:true,stateDriven:false});
 }
 for(const a of roster){
  if(posts.has(a.id))continue;
  if(a.fleet&&!a.fleet.standby&&a.fleet.connected&&a.fleet.state==='charging'&&!a.fleet.resting){
   const free=OFFICE_DESK_POOL.find(d=>!takenDesks.has(d));
   if(free){setDesk(a,free,false,false); continue;}
  }
  setPod(a,-1,false,false);
 }
 return posts;
}
/* ================= Văn phòng ISOMETRIC (0.9.58) =================
 * Chế độ xem mặc định từ 0.9.58: phông phòng isometric theo concept B2 đã
 * được Sếp duyệt (public/assets/office-iso-backdrop.jpg — chính B2 đã xóa
 * sạch robot) + sprite robot TAM19 render từ GLB thật của Sếp
 * (public/assets/bots/iso/, nhuộm theo màu tài khoản như phòng 3D). Tư thế
 * ngồi bàn chụp từ góc SAU ba phần tư — mặt robot hướng VÀO màn hình, đúng
 * điểm Sếp sửa ở concept B. Vị trí lấy từ CÙNG officeResolvePosts như
 * phòng 3D (trạng thái thật thắng ghim tay; ghim dùng chung khóa
 * localStorage 'aios-office-pins' ở cả hai chế độ xem). */
/* 0.9.59: neo isometric đo TRỰC TIẾP trên đồ nội thất VẼ SẴN trong phông
 * (ghế của từng bàn trong lưới, 4 buồng sạc kính, ghế sofa tiếp nhận) —
 * bản 0.9.58 neo theo lưới tọa độ thế giới nên robot lệch khỏi bàn/ghế vẽ
 * sẵn và cụm ô sạc chồng nhãn. Góc phải của phông từ 0.9.59 là LỒNG CHÍCH
 * ĐIỆN (bản cũ vẽ tên lửa — đã thay bằng lồng kính có hồ quang điện, đúng
 * mô tả "robot lỗi vào chuồng chích điện"); neo cage đứng TRONG lồng,
 * nhãn của trạm cage (ly) hạ xuống dưới đế lồng cho khỏi bị sprite che. */
/* 0.9.60: neo (x,y) = điểm neo của KHUNG robot (nút bấm) — đã cộng sẵn độ
 * lệch khung→thân nhìn thấy của từng tư thế (đo từ bản 0.9.59: robot ngồi
 * đáy thân nhìn thấy nằm trên neo ≈5,4%, đứng ≈4,1%, ô sạc ≈2,6%) sao cho
 * ĐÁY THÂN NHÌN THẤY đáp đúng mặt ghế / sàn buồng / sàn lồng. lx/ly = tâm
 * NHÃN TRẠM (đặt trên thân bàn, dưới mặt trước bàn — không nằm trên robot). */
const OFFICE_ISO_STATIONS={
 boss:{x:46.4,y:29.2,label:'👔 Sếp Lâm'},
 news:{x:33.8,y:43.9,lx:33.8,ly:41.5,label:'📰 Tin tức'}, script:{x:24.5,y:50.5,lx:24.5,ly:47.9,label:'✍️ Biên tập'},
 image:{x:34.5,y:57.5,lx:34.5,ly:56.3,label:'🎨 Hình ảnh'}, media:{x:15.5,y:55.6,lx:15.5,ly:52.9,label:'🎬 Sản xuất'},
 review:{x:24.6,y:64.3,lx:24.6,ly:62.6,label:'🔎 Kiểm duyệt'}, pm:{x:43.7,y:66.9,lx:43.7,ly:67.8,label:'🧭 Điều phối'},
 publish:{x:52.3,y:58.2,lx:52.3,ly:55.6,label:'🚀 Đăng bài'}, intake:{x:48.5,y:78.5,lx:48.5,ly:84.5,label:'🛋️ Tiếp nhận'},
 lounge:{x:66,y:31,lx:52,ly:10.2,label:'🔋 Phòng nạp năng lượng'}, cage:{x:82.6,y:49.3,lx:83.5,ly:57.5,label:'⚡ Phòng chích điện'},
};
/* Ô sạc: 4 ô đầu = đúng 4 buồng kính vẽ sẵn (chân robot ở đế buồng); 6 ô
 * sau = hàng chờ trên sàn trống cạnh khu buồng kính. lx/ly = độ lệch (px,
 * ở bề rộng phòng 626) đưa BẢNG TÊN của ô đó tới ô lưới nhãn riêng phía
 * trên cụm sạc; bx/by = độ lệch của HUY HIỆU trạng thái (nằm dưới chân).
 * Cụm sạc chật mà bảng tên rộng gần bằng khoảng cách hai ô — xếp tên
 * theo lưới lệch sẵn này thì 10 robot đứng cùng lúc tên vẫn không chồng
 * (bản 0.9.58 xếp tên ngay dưới chân từng robot nên chồng thành một đám). */
/* 0.9.60: 4 ô đầu neo vào TRONG 4 buồng kính vẽ sẵn (đáy thân đáp trên sàn
 * buồng, thân nằm gọn trong lòng buồng — xem OFFICE_ISO_POD_INTERIORS);
 * 6 ô sau là hàng chờ trên sàn trống trước khu buồng, giãn đủ xa để thân
 * các robot kề nhau không chạm nhau. lx/ly vẫn là lưới bảng tên phía trên
 * cụm buồng, tính lại theo neo mới. */
const OFFICE_ISO_PODS=[
 {x:65,y:36.4,lx:3,ly:-84,bx:10,by:8},{x:69.35,y:37.4,lx:2,ly:-104,bx:-12,by:8},
 {x:73.4,y:38.4,lx:3,ly:-92,bx:12,by:8},{x:77.5,y:39.6,lx:3,ly:-113,bx:-10,by:8},
 {x:55,y:43.2,lx:1,ly:-13,bx:8,by:0},{x:58.3,y:44.9,lx:1,ly:2,bx:-8,by:0},
 {x:61.6,y:46.6,lx:1,ly:18,bx:10,by:0},{x:66,y:43.9,lx:1,ly:18,bx:-10,by:0},
 {x:70.5,y:45.6,lx:1,ly:-13,bx:8,by:0},{x:75.5,y:47.1,lx:1,ly:2,bx:-8,by:0}];
/* Neo TÂM MÀN HÌNH vẽ sẵn của từng bàn (%, cùng hệ tọa độ phòng) — chỗ
 * hiệu ứng "màn hình sáng lên" sẽ bám vào khi robot ở bàn đó ĐANG LÀM
 * VIỆC THẬT. Đo trực tiếp trên ảnh render đúng tọa độ phòng (probe
 * debug-glow): ở các bàn cubicle, màn hình nằm ở cánh TRÁI của bàn,
 * xuôi xuống theo phép chiếu so với ghế ngồi (tin tức/biên tập là hàng
 * trên cùng); bàn Đăng bài có màn hình ngay sau bàn; Tiếp nhận là
 * laptop trên bàn tròn trong phòng kính. Trạm không có robot đang làm
 * thì màn hình giữ nguyên như phông vẽ. */
/* 0.9.60 đo lại: tâm MÀN HÌNH VẼ SẴN của đúng cái bàn mà ghế của trạm đó
 * quay mặt vào (bản 0.9.59 một số điểm rơi trên mặt bàn / nhầm bàn kề). */
const OFFICE_ISO_MONITORS={
 news:{x:30.2,y:31.2}, script:{x:20,y:38.3}, image:{x:36.6,y:47.6}, media:{x:10.5,y:46.4},
 review:{x:21.2,y:53.6}, pm:{x:39.5,y:55.7}, publish:{x:47.4,y:47.9}, intake:{x:52.5,y:82.5},
};
/* TỈ LỆ sprite theo vùng (0.9.59, góp ý của Sếp về tỉ lệ): phông B2 vẽ
 * các bàn ở lưới trái nhỏ hơn (xa hơn) so với sofa tiếp nhận ở tiền
 * cảnh, buồng sạc và lồng có chiều cao riêng — sprite 84px đồng loạt
 * như 0.9.58 làm robot ở bàn xa trông to như người khổng lồ cạnh bàn
 * nhỏ. Mỗi vùng một hệ số; điểm neo (chân) không đổi nhờ
 * transform-origin đặt đúng điểm neo của phần tử robot. */
/* 0.9.60: pod 0.94 -> 0.70 — thân robot (phần nhìn thấy ≈2,4% bề ngang
 * phòng) phải lọt hẳn vào lòng buồng kính vẽ sẵn (≈2,5–2,7%); tỉ lệ cũ làm
 * robot to hơn buồng nên không thể "ở trong" buồng được. */
const OFFICE_ISO_SCALES={deskFar:0.84,deskNear:0.92,pod:0.67,cage:0.86,intake:1.0,boss:0.95};
/* ===== 0.9.60: LỚP MẶT TRƯỚC (compositing) =====
 * Sprite dán lên phông phẳng thì không bao giờ đọc là "ở trong" nội thất.
 * Các file PNG trong assets/office-iso-fg/ được CẮT TỪ CHÍNH PHÔNG (cùng
 * điểm ảnh nên mép nối vô hình): mặt trước các bàn (đặc), kính trước 4
 * buồng sạc (kính mờ + khung đặc), mặt trước lồng chích điện (kính mờ +
 * khung đặc). Thứ tự vẽ tại mỗi trạm: phông -> sprite -> lớp mặt trước
 * (z = z của robot ở trạm đó + 1). x/y/w/h = hộp bao của mảng cắt, theo %
 * phòng; z khai sẵn theo neo của trạm. */
const OFFICE_ISO_FG=[
 {id:'desk-boss',img:'desk-boss.png',x:42.9,y:22.9,w:11.7,h:12.7,st:'boss'},
 {id:'desk-news',img:'desk-news.png',x:27.6,y:35.9,w:8.6,h:8.1,st:'news'},
 {id:'desk-script',img:'desk-script.png',x:17.1,y:42.2,w:9.6,h:8.3,st:'script'},
 {id:'desk-media',img:'desk-media.png',x:8.1,y:47.2,w:9.1,h:7.8,st:'media'},
 {id:'desk-image',img:'desk-image.png',x:30.1,y:52.2,w:9.6,h:8.3,st:'image'},
 {id:'desk-review',img:'desk-review.png',x:17.1,y:55.2,w:10.1,h:8.3,st:'review'},
 {id:'desk-publish',img:'desk-publish.png',x:44.8,y:50,w:9.1,h:8.1,st:'publish'},
 {id:'desk-pm',img:'desk-pm.png',x:32.6,y:62.2,w:10.1,h:8.3,st:'pm'},
 {id:'pod-0',img:'pod-0.png',x:62.5,y:24.5,w:4.6,h:10.9,pod:0},
 {id:'pod-1',img:'pod-1.png',x:66.9,y:25.5,w:4.5,h:10.9,pod:1},
 {id:'pod-2',img:'pod-2.png',x:71.2,y:26.5,w:4.2,h:10.9,pod:2},
 {id:'pod-3',img:'pod-3.png',x:75.3,y:27.5,w:4.2,h:11.1,pod:3},
 {id:'cage',img:'cage.png',x:77.5,y:28.2,w:9.8,h:19.3,st:'cage'},
];
/* Lòng trong của 4 buồng kính + của lồng chích điện (%, [x0,y0,x1,y1]) —
 * thân robot (phần nhìn thấy) phải nằm trọn trong các hộp này. */
const OFFICE_ISO_POD_INTERIORS=[
 {x0:63.5,y0:25.6,x1:66.2,y1:34.3},{x0:67.9,y0:26.6,x1:70.5,y1:35.2},
 {x0:72,y0:27.6,x1:74.5,y1:36.2},{x0:76.1,y0:28.6,x1:78.6,y1:37.4}];
const OFFICE_ISO_CAGE_INTERIOR={x0:79.4,y0:30.4,x1:85.5,y1:45.9};
/* Vùng mặt ghế của từng bàn (%, [x0,y0,x1,y1]): đáy thân nhìn thấy của
 * robot ngồi phải đáp vào vùng này (điểm đáp = tâm-x, mép dưới thân). */
const OFFICE_ISO_CHAIRS={
 news:{x0:31.6,y0:37.4,x1:36,y1:39.8}, script:{x0:22.3,y0:44,x1:26.7,y1:46.4},
 media:{x0:13.3,y0:49.1,x1:17.7,y1:51.5}, image:{x0:32.3,y0:51,x1:36.7,y1:53.4},
 review:{x0:22.4,y0:57.8,x1:26.8,y1:60.2}, pm:{x0:41.5,y0:59.8,x1:45.9,y1:62.2},
 publish:{x0:50.1,y0:51.1,x1:54.5,y1:53.5}, boss:{x0:44.2,y0:26.2,x1:48.6,y1:28.6},
};
/* Khung thân NHÌN THẤY của sprite theo tư thế — tỉ lệ [trái, trên, phải,
 * dưới] của hộp phần tử .bot-iso ứng với vùng có điểm ảnh (đo alpha>24
 * trên PNG sprite TAM19). Vòng nhãn + QA dùng hộp này, không dùng hộp
 * phần tử (vốn có lề trong suốt làm robot trông to hơn thân thật). */
const OFFICE_ISO_VIS_FRAC={
 idle:[0.283,0.066,0.703,0.85], stand:[0.283,0.066,0.703,0.85], pod:[0.26,0.061,0.74,0.857],
 desk:[0.22,0.089,0.803,0.752], walk:[0.28,0.082,0.72,0.827],
};
function officeIsoScaleFor(post,pt){
 if(!post)return 1;
 if(post.kind==='pod')return OFFICE_ISO_SCALES.pod;
 if(post.kind==='cage')return OFFICE_ISO_SCALES.cage;
 if(post.kind==='desk'||post.kind==='station'){
  if(post.id==='intake')return OFFICE_ISO_SCALES.intake;
  if(post.id==='boss')return OFFICE_ISO_SCALES.boss;
  if(post.id==='pm'||post.id==='publish')return OFFICE_ISO_SCALES.deskNear;
  return OFFICE_ISO_SCALES.deskFar;
 }
 if(post.kind==='floor'){const t=Math.max(0,Math.min(1,(((pt&&pt.y)||50)-20)/55)); return 0.84+0.24*t;}
 return 1;
}
/* Sàn: ánh xạ hai chiều tọa độ thế giới 3D (x,z) <-> % isometric bằng nội
 * suy song tuyến tính trên hình thoi boong tàu trong phông B2 (điểm ghim
 * sàn tự chọn dùng chung được cho cả phòng 3D lẫn isometric). */
const OFFICE_ISO_DECK={top:{x:50,y:15},right:{x:95,y:47},bottom:{x:48,y:91},left:{x:4,y:50}};
function officeIsoWorldToPct(wx,wz){
 const u=Math.max(0,Math.min(1,(wx/17+1)/2)), v=Math.max(0,Math.min(1,(wz/11+1)/2)), D=OFFICE_ISO_DECK;
 return {x:(1-u)*(1-v)*D.top.x+u*(1-v)*D.right.x+u*v*D.bottom.x+(1-u)*v*D.left.x,
         y:(1-u)*(1-v)*D.top.y+u*(1-v)*D.right.y+u*v*D.bottom.y+(1-u)*v*D.left.y};
}
function officeIsoPctToWorld(px,py){
 let u=.5,v=.5; const D=OFFICE_ISO_DECK;
 const fwd=(u,v)=>({x:(1-u)*(1-v)*D.top.x+u*(1-v)*D.right.x+u*v*D.bottom.x+(1-u)*v*D.left.x,
                    y:(1-u)*(1-v)*D.top.y+u*(1-v)*D.right.y+u*v*D.bottom.y+(1-u)*v*D.left.y});
 for(let i=0;i<10;i++){
  const p=fwd(u,v), ex=px-p.x, ey=py-p.y; if(Math.abs(ex)<.01&&Math.abs(ey)<.01)break;
  const h=.001, pu=fwd(u+h,v), pv=fwd(u,v+h);
  const a=(pu.x-p.x)/h, b=(pv.x-p.x)/h, c=(pu.y-p.y)/h, d=(pv.y-p.y)/h, det=a*d-b*c||1e-6;
  u+=(ex*d-ey*b)/det; v+=(a*ey-c*ex)/det; u=Math.max(-.2,Math.min(1.2,u)); v=Math.max(-.2,Math.min(1.2,v));
 }
 return {x:Math.max(-16,Math.min(16,(u*2-1)*17)), z:Math.max(-10.5,Math.min(10.5,(v*2-1)*11))};
}
/* Đa giác sàn boong trong phông B2 (4 góc hình thoi của mặt sàn vẽ sẵn).
 * Mọi điểm hiển thị isometric đều bị KẸP vào trong đa giác này: phông vẽ
 * sàn không lấp đầy cả khung hình (xung quanh là nền sao), nên một điểm
 * ghim sàn ở sát rìa thế giới 3D có thể chiếu ra ngoài mặt sàn — robot
 * khi đó trông như lơ lửng giữa sao. Phòng 3D giữ nguyên tọa độ thế giới
 * của điểm ghim dùng chung; chỉ bản isometric kẹp điểm chiếu của nó vào
 * sàn (điểm ghim lưu trong localStorage không đổi). */
const OFFICE_ISO_DECK_POLY=[{x:50,y:15},{x:95,y:47},{x:48,y:91},{x:4,y:50}];
function officeIsoInDeck(px,py){
 let inside=false; const P=OFFICE_ISO_DECK_POLY;
 for(let i=0,j=P.length-1;i<P.length;j=i++){
  const a=P[i],b=P[j];
  if(((a.y>py)!==(b.y>py))&&(px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x))inside=!inside;
 }
 return inside;
}
function officeIsoClampToDeck(p){
 if(officeIsoInDeck(p.x,p.y))return p;
 let best=null,bd=1e9; const P=OFFICE_ISO_DECK_POLY;
 for(let i=0,j=P.length-1;i<P.length;j=i++){
  const a=P[j],b=P[i],vx=b.x-a.x,vy=b.y-a.y,L=vx*vx+vy*vy||1e-9;
  let t=((p.x-a.x)*vx+(p.y-a.y)*vy)/L; t=Math.max(0,Math.min(1,t));
  const qx=a.x+vx*t,qy=a.y+vy*t,d=(p.x-qx)*(p.x-qx)+(p.y-qy)*(p.y-qy);
  if(d<bd){bd=d;best={x:qx,y:qy};}
 }
 // Hích nhẹ về phía tâm sàn để chân robot nằm hẳn trên mặt sàn vẽ sẵn.
 return {x:best.x+(49.25-best.x)*0.02,y:best.y+(50.75-best.y)*0.02};
}
function officeIsoPointForPost(post){
 if(!post)return OFFICE_ISO_STATIONS.lounge;
 if(post.kind==='desk'||post.kind==='station')return OFFICE_ISO_STATIONS[post.id]||OFFICE_ISO_STATIONS.pm;
 if(post.kind==='pod')return OFFICE_ISO_PODS[Math.max(0,Math.min(9,post.slot||0))];
 if(post.kind==='cage')return OFFICE_ISO_STATIONS.cage;
 if(post.kind==='floor')return officeIsoClampToDeck(officeIsoWorldToPct(post.x,post.z));
 return OFFICE_ISO_STATIONS.lounge;
}
function officeIsoLabelShift(post){
 if(!post)return null;
 if(post.kind==='pod')return OFFICE_ISO_PODS[Math.max(0,Math.min(9,post.slot||0))];
 /* 0.9.60: robot ngồi bàn — bảng tên treo TRÊN ĐẦU (dưới bàn đã có nhãn
  * trạm; để tên dưới thân như cũ là bị sprite che chữ). Robot trong lồng
  * điện: tên nằm ngay dưới đế lồng, huy hiệu treo trên đỉnh lồng (CSS). */
 if(post.kind==='desk'||post.kind==='station'){
  if(post.id==='boss')return {lx:0,ly:22,bx:0,by:0}; // tên Sếp nằm ngay dưới mặt bàn của Sếp (không còn nhãn trạm trùng)
  // tên + huy hiệu xếp chồng TRÊN ĐẦU robot ngồi bàn: dưới bàn là nhãn
  // trạm (tấm biển trên mặt bàn) và thân robot bàn kề — để tên dưới bàn là
  // bị thân robot kề che chữ (bài học zoom 0.9.60 vòng đầu).
  return {lx:0,ly:-93,bx:0,by:-14};
 }
 if(post.kind==='cage')return {lx:0,ly:8,bx:0,by:0};
 return null;
}
function officeIsoSpriteKey(a){
 const kind=a&&a.fleet?a.fleet.kind:'';
 return kind==='chatgpt_account'?'chatgpt':kind==='claude_account'?'claude':kind==='gemini_account'?'gemini':kind==='antigravity_account'?'antigravity':'default';
}
function officeFigureIso(a){
 const base='/assets/bots/iso/tam19-'+officeIsoSpriteKey(a);
 return `<span class="bot-iso" aria-hidden="true"><img class="bot-iso-img pose-idle" src="${base}-idle.png" alt=""><span class="bot-iso-win pose-desk"><img class="bot-iso-sheet4" src="${base}-sit.png" alt=""></span><span class="bot-iso-win pose-walk"><img class="bot-iso-sheet3" src="${base}-walk.png" alt=""></span><img class="bot-iso-img pose-pod" src="${base}-pod.png" alt=""></span>`;
}
function officeIsoStateText(a){
 if(!a)return '';
 if(a.id==='boss')return '👔 Sếp Lâm — người duyệt đăng';
 if(!a.fleet)return a.role||'';
 const b=a.fleet;
 if(b.cage)return '⚡ đang bị chích điện (lượt gần nhất lỗi)';
 if(b.state==='working')return '▶ đang làm việc — '+(OFFICE_ISO_STATIONS[b.station]?.label||'bàn làm việc');
 if(b.state==='failed')return '⚡ lượt gần nhất lỗi — đang chờ thay ca ở khu sạc';
 if(b.resting)return '🔋 đang nghỉ sạc · mở lại '+(b.coolingUntil?new Date(b.coolingUntil).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'');
 if(b.state==='charging')return '🔋 đang sạc · chờ việc';
 return '🔌 chưa kết nối';
}
let officeIsoSelectedId=null;
function officeIsoSelect(id){officeIsoSelectedId=id; officeRender();}
function officeIsoSelectedAgent(){return officeIsoSelectedId?officeRosterCast().find(x=>x.id===officeIsoSelectedId)||null:null;}
function officeIsoDispatchDesk(stationId){
 const a=officeIsoSelectedAgent(); if(!a||a.id==='boss')return;
 if(stationId==='lounge'){officeIsoDispatchPod(-1); return;}
 if(!OFFICE_DESK_POOL.includes(stationId))return;
 const pins=officeLoadPins(); pins[a.id]={kind:'desk',id:stationId}; officeSavePins(pins);
 toast(`📌 Đã ghim ${officePlateName(a)} tới ${(OFFICE_ISO_STATIONS[stationId]||{}).label||stationId} — trạng thái thật vẫn thắng khi có việc.`);
 officeRender();
}
function officeIsoDispatchPod(slot){
 const a=officeIsoSelectedAgent(); if(!a||a.id==='boss')return;
 const pins=officeLoadPins(); pins[a.id]=slot>=0?{kind:'pod',slot}:{kind:'pod'}; officeSavePins(pins);
 toast(`📌 Đã ghim ${officePlateName(a)} tới ô sạc${slot>=0?' '+(slot+1):''} — trạng thái thật vẫn thắng khi có việc.`);
 officeRender();
}
function officeIsoDispatchFloor(px,py){
 const a=officeIsoSelectedAgent(); if(!a||a.id==='boss')return;
 // Bấm ra ngoài mặt sàn vẽ sẵn (nền sao) → kẹp vào điểm sàn gần nhất rồi
 // mới đổi sang tọa độ thế giới, để điểm ghim dùng chung vẫn nằm trên sàn.
 const cp=officeIsoClampToDeck({x:px,y:py});
 const w=officeIsoPctToWorld(cp.x,cp.y);
 const pins=officeLoadPins(); pins[a.id]={kind:'floor',x:Math.round(w.x*10)/10,z:Math.round(w.z*10)/10}; officeSavePins(pins);
 toast(`📌 Đã ghim ${officePlateName(a)} tới điểm sàn đã chọn — trạng thái thật vẫn thắng khi có việc.`);
 officeRender();
}
function officeIsoHotspots(room,on){
 let layer=room.querySelector('.office-pod-hots');
 if(!on){if(layer)layer.remove(); return;}
 if(!layer){layer=document.createElement('div'); layer.className='office-pod-hots'; room.appendChild(layer);}
 layer.innerHTML=OFFICE_ISO_PODS.map((p,i)=>`<button type="button" class="office-pod-hot" data-pod-slot="${i}" style="left:${p.x}%;top:${p.y}%" title="Điều robot đã chọn tới ô sạc ${i+1}"></button>`).join('');
 layer.querySelectorAll('[data-pod-slot]').forEach(b=>b.onclick=e=>{e.stopPropagation(); officeIsoDispatchPod(Number(b.dataset.podSlot));});
}
function officeIsoCardRefresh(){
 const room=$('#officeRoom'); if(!room||!room.classList.contains('office-iso'))return;
 let card=room.querySelector('.office-bot-card');
 const a=officeIsoSelectedAgent();
 room.classList.toggle('office-has-selection',Boolean(a&&a.id!=='boss'));
 if(!a){if(card)card.remove(); officeIsoHotspots(room,false); return;}
 if(!card){
  card=document.createElement('div'); card.className='office-bot-card'; room.appendChild(card);
  card.addEventListener('click',ev=>{
   const btn=ev.target.closest('[data-obc-act]'); if(!btn)return;
   const ag=officeIsoSelectedAgent(); if(!ag)return;
   if(btn.dataset.obcAct==='close')officeIsoSelect(null);
   else if(btn.dataset.obcAct==='auto'){const pins=officeLoadPins(); delete pins[ag.id]; officeSavePins(pins); toast(`↩ ${officePlateName(ag)} đã về chế độ tự động theo trạng thái.`); officeRender();}
   else if(btn.dataset.obcAct==='rename'){const next=prompt(`Đổi tên cho ${ag.role}:`,officeAgentName(ag)); if(next&&next.trim()){officeNames[ag.id]=next.trim().slice(0,24); localStorage.setItem('aios-office-names',JSON.stringify(officeNames)); officeRender();}}
  });
 }
 const pins=officeLoadPins(), pin=pins[a.id];
 const pinText=pin?(pin.kind==='desk'?`📌 Ghim: bàn ${pin.id} — trạng thái thật vẫn thắng`:(pin.kind==='pod'?`📌 Ghim: ô sạc${typeof pin.slot==='number'?' '+(pin.slot+1):''} — trạng thái thật vẫn thắng`:'📌 Ghim: điểm sàn tự chọn — trạng thái thật vẫn thắng')):'Tự động theo trạng thái thật';
 card.innerHTML=`<div class="obc-head"><strong data-obc-name>🤖 ${esc(officePlateName(a))}</strong><button type="button" class="obc-x" data-obc-act="close" aria-label="Đóng thẻ">✕</button></div><p data-obc-state>${esc(officeIsoStateText(a))}</p><p class="obc-pin" data-obc-pin>${esc(pinText)}</p><div class="obc-actions"><button type="button" data-obc-act="rename">Đổi tên</button>${a.id!=='boss'?'<button type="button" data-obc-act="auto">↩ Về tự động</button>':''}</div>${a.id!=='boss'?'<p class="obc-hint">Bấm vào nhãn một trạm, một vòng ô sạc hoặc một điểm trên sàn để điều robot này tới đó. Trạng thái thật (đang làm việc / lỗi / nghỉ sạc) luôn thắng điểm ghim — ghim tự áp dụng lại khi trạng thái qua đi.</p>':''}`;
 officeIsoHotspots(room,Boolean(a&&a.id!=='boss'));
}
/* --- 0.9.59 bổ sung: trực quan "đang làm việc" + luồng thông tin + nhãn ---
 * Màn hình sáng ⟺ có robot fleet đang ở trạng thái working THẬT tại bàn
 * đó (dữ liệu đội quét từ app, không trang trí). Tia luồng chỉ xuất hiện
 * khi giữa hai lần quét liên tiếp quan sát thấy một robot NGỪNG làm việc
 * và một robot khác BẮT ĐẦU làm việc — ưu tiên khớp đúng cùng runId (chuyển
 * giao trong cùng một lượt chạy); dữ liệu không có runId thì một cặp
 * ngừng/bắt đầu trong cùng lần quét cũng được tính là chuyển giao. Không
 * có chuyển giao quan sát được thì không có tia nào cả. */
let officeIsoPrevWorking=null, officeLabelPassTimer=0, officeLabelPassChain=0;
function officeIsoUpdateGlow(room,litStations){
 room.querySelectorAll('[data-glow]').forEach(g=>g.classList.toggle('on',litStations.has(g.dataset.glow)));
 window.__officeIsoGlow=[...litStations];
}
function officeIsoFirePulse(room,from,to,runId){
 const layer=room.querySelector('.office-flow-layer'); if(!layer)return;
 if(layer.childElementCount>=4)return;
 if(!Array.isArray(window.__officeIsoPulses))window.__officeIsoPulses=[];
 window.__officeIsoPulses.push({from:{x:from.x,y:from.y},to:{x:to.x,y:to.y},runId:runId||'',at:Date.now()});
 if(window.__officeIsoPulses.length>20)window.__officeIsoPulses.splice(0,window.__officeIsoPulses.length-20);
 const dot=document.createElement('div'); dot.className='office-flow-pulse'; layer.appendChild(dot);
 const W=room.clientWidth||626, H=room.clientHeight||417;
 const x0=from.x/100*W, y0=from.y/100*H, x1=to.x/100*W, y1=to.y/100*H;
 const cx=(x0+x1)/2, cy=Math.min(y0,y1)-H*0.09;
 const t0=performance.now(), DUR=1400;
 const step=t=>{
  const k=Math.min(1,(t-t0)/DUR), e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
  const x=(1-e)*(1-e)*x0+2*(1-e)*e*cx+e*e*x1, y=(1-e)*(1-e)*y0+2*(1-e)*e*cy+e*e*y1;
  dot.style.left=x+'px'; dot.style.top=y+'px'; dot.style.opacity=String(Math.sin(Math.PI*k));
  if(k<1)requestAnimationFrame(step); else dot.remove();
 };
 requestAnimationFrame(step);
}
function officeIsoDetectFlow(room,curWorking){
 if(officeIsoPrevWorking){
  const stopped=[...officeIsoPrevWorking.entries()].filter(([id])=>!curWorking.has(id));
  const started=[...curWorking.entries()].filter(([id])=>!officeIsoPrevWorking.has(id));
  const usedS=new Set(), usedT=new Set();
  for(const [sid,s] of stopped)for(const [tid,t] of started){
   if(usedS.has(sid)||usedT.has(tid))continue;
   if(s.runId&&t.runId&&s.runId===t.runId){officeIsoFirePulse(room,s,t,s.runId); usedS.add(sid); usedT.add(tid);}
  }
  for(const [sid,s] of stopped)for(const [tid,t] of started){
   if(usedS.has(sid)||usedT.has(tid))continue;
   if(!s.runId||!t.runId){officeIsoFirePulse(room,s,t,s.runId||t.runId); usedS.add(sid); usedT.add(tid);}
  }
 }
 officeIsoPrevWorking=curWorking;
}
/* Vòng nhãn tổng quát của bản isometric: với MỌI nhãn đang hiện (bảng tên,
 * huy hiệu trạng thái, nhãn trạm) — (1) cặp nào chồng nhau thì nhãn dưới bị
 * đẩy xuống dưới mép chồng +3px (nhãn trạm không bị đẩy, nhãn robot nhường
 * đường), (2) nhãn nào tràn khỏi khung phòng thì bị kéo ngược vào trong.
 * Offset phụ lưu ở dataset.gx/gy, cộng lên trên offset gốc của từng nhãn
 * (tên: nlx/nly; huy hiệu: btx/bty) nên chạy lại nhiều lần vẫn ổn định. */
function officeIsoLabelPass(room){
 const rr=room.getBoundingClientRect(); if(!rr.width)return;
 /* 0.9.60: vòng nhãn đo đúng thứ MẮT nhìn — ngoài nhãn-với-nhãn như cũ,
  * mọi chữ (tên / huy hiệu / nhãn trạm) còn phải tránh THÂN ROBOT NHÌN
  * THẤY (hộp alpha của sprite, không phải hộp phần tử có lề trong suốt)
  * và tránh các mảng MẶT TRƯỚC nội thất nào vẽ TRÊN chữ đó (z lớn hơn).
  * Mỗi nhãn có QUỸ ĐẠO TỐI ĐA quanh vị trí gốc (kẹp gx/gy) nên huy hiệu
  * không còn trôi xa khỏi robot của nó như bản 0.9.59. */
 const CLAMP={name:{x:34,y:40},badge:{x:36,y:24},station:{x:64,y:40}};
 room.querySelectorAll('[data-office-agent]').forEach(el=>{
  const nm=el.querySelector('.office-agent-name'), fig=el.querySelector('.bot-iso,.office-figure');
  if(!nm||!fig)return;
  const nr=nm.getBoundingClientRect(), fr2=fig.getBoundingClientRect();
  const dx=(fr2.left+fr2.width/2)-((nr.left+nr.width/2)-(parseFloat(nm.dataset.gx)||0));
  if(Math.abs(dx)>1.5){const nlx=(parseFloat(nm.dataset.nlx)||0)+Math.round(dx); nm.dataset.nlx=String(nlx);
   nm.style.transform=`translate(${nlx}px,${parseFloat(nm.dataset.nly)||0}px)`;}
 });
 const fgRects=[];
 room.querySelectorAll('.office-fg').forEach(el=>{fgRects.push({rect:el.getBoundingClientRect(),z:parseInt(el.style.zIndex||'0',10)||0});});
 const obstacles=[];
 room.querySelectorAll('[data-office-agent]').forEach(el=>{
  const fig=el.querySelector('.bot-iso,.office-figure'); if(!fig)return;
  const r=fig.getBoundingClientRect();
  const fr=fig.classList.contains('bot-iso')?(OFFICE_ISO_VIS_FRAC[el.dataset.isopose]||null):null;
  let rect=!fr?{left:r.left,top:r.top,right:r.right,bottom:r.bottom}
   :{left:r.left+fr[0]*r.width,top:r.top+fr[1]*r.height,right:r.left+fr[2]*r.width,bottom:r.top+fr[3]*r.height};
  // phần thân đã bị một mảng mặt trước che (robot sau mặt bàn / sau kính)
  // không phải chướng ngại thật cho chữ — cắt hộp chướng ngại tại mép trên
  // của mảng che phủ hết bề ngang thân và vẽ trên robot đó.
  const az=parseInt(el.style.zIndex||'10',10)||10;
  for(const f of fgRects){ if(f.z<=az)continue; const fr3=f.rect;
   if(fr3.left<=rect.left+2&&fr3.right>=rect.right-2&&fr3.top>rect.top&&fr3.top<rect.bottom) rect={...rect,bottom:Math.min(rect.bottom,fr3.top)}; }
  obstacles.push({rect});
 });
 room.querySelectorAll('.office-fg').forEach(el=>{
  const r=el.getBoundingClientRect(), ix=rr.width*0.003, iy=rr.height*0.004; // lề trong suốt của mảng cắt không phải chướng ngại thật
  obstacles.push({rect:{left:r.left+ix,top:r.top+iy,right:r.right-ix,bottom:r.bottom-iy},z:parseInt(el.style.zIndex||'0',10)||0,fg:true});
 });
 const items=[];
 room.querySelectorAll('.office-station').forEach(el=>{el.dataset.gx='0'; el.dataset.gy='0'; items.push({el,kind:'station',fixed:true,z:110});});
 room.querySelectorAll('[data-office-agent]').forEach(el=>{
  const az=parseInt(el.style.zIndex||'10',10)||10;
  const nm=el.querySelector('.office-agent-name');
  if(nm){nm.dataset.gx='0'; nm.dataset.gy='0'; items.push({el:nm,kind:'name',fixed:false,z:az});}
  const bd=el.querySelector('.office-agent-badge');
  if(bd&&!bd.hidden){bd.dataset.gx='0'; bd.dataset.gy='0'; items.push({el:bd,kind:'badge',fixed:false,z:az});}
 });
 const apply=it=>{
  const gx=parseFloat(it.el.dataset.gx)||0, gy=parseFloat(it.el.dataset.gy)||0;
  if(it.kind==='name'){const bx=parseFloat(it.el.dataset.nlx)||0, by=parseFloat(it.el.dataset.nly)||0; it.el.style.transform=`translate(${Math.round(bx+gx)}px,${Math.round(by+gy)}px)`;}
  else if(it.kind==='badge'){const bx=parseFloat(it.el.dataset.btx)||0, by=parseFloat(it.el.dataset.bty)||0; it.el.style.transform=`translateX(calc(-50% + ${Math.round(bx+gx)}px)) translateY(${Math.round(by+gy)}px)`;}
  else it.el.style.transform=`translate(-50%,-50%) translate(${Math.round(gx)}px,${Math.round(gy)}px)`;
 };
 items.forEach(apply);
 const ovArea=(rect,r)=>{const ox=Math.min(rect.right,r.right)-Math.max(rect.left,r.left); const oy=Math.min(rect.bottom,r.bottom)-Math.max(rect.top,r.top); return ox>0&&oy>0?ox*oy:0;};
 const scoreOf=(it,rect)=>{
  let s=0;
  for(const o of items){if(o===it)continue; s+=ovArea(rect,o.el.getBoundingClientRect());}
  for(const ob of obstacles){
   if(ob.fg&&(ob.z||0)<=it.z)continue; // mảng mặt trước vẽ DƯỚI chữ này thì không phải chướng ngại
   s+=4*ovArea(rect,ob.rect);
  }
  return s;
 };
 const tryMove=(mv,penalty)=>{
  const mr=mv.el.getBoundingClientRect();
  const base=scoreOf(mv,mr);
  if(base<=0)return false;
  const cl=CLAMP[mv.kind]||CLAMP.name;
  const gx0=parseFloat(mv.el.dataset.gx)||0, gy0=parseFloat(mv.el.dataset.gy)||0;
  // bước dời ứng viên: thoát khỏi từng nhãn/chướng ngại đang chồng (4 hướng)
  const steps=new Set(['0,10','0,-10','10,0','-10,0']);
  const push=(r)=>{const ox=Math.min(mr.right,r.right)-Math.max(mr.left,r.left), oy=Math.min(mr.bottom,r.bottom)-Math.max(mr.top,r.top); if(ox>0&&oy>0){steps.add(`0,${oy+3}`);steps.add(`0,${-(oy+3)}`);steps.add(`${ox+3},0`);steps.add(`${-(ox+3)},0`);}};
  for(const o of items){if(o!==mv)push(o.el.getBoundingClientRect());}
  for(const ob of obstacles){if(ob.fg&&(ob.z||0)<=mv.z)continue; push(ob.rect);}
  let best=null;
  for(const s of steps){
   const [dx,dy]=s.split(',').map(Number);
   if(Math.abs(gx0+dx)>cl.x||Math.abs(gy0+dy)>cl.y)continue;
   const cand={left:mr.left+dx,right:mr.right+dx,top:mr.top+dy,bottom:mr.bottom+dy};
   if(cand.left<rr.left+1||cand.right>rr.right-1||cand.top<rr.top+1||cand.bottom>rr.bottom-1)continue;
   const score=scoreOf(mv,cand)+0.02*(Math.abs(dx)+Math.abs(dy))+(penalty||0);
   if(!best||score<best.score)best={dx,dy,score};
  }
  if(!best||best.score>=(penalty||0)+base)return false;
  mv.el.dataset.gx=String(gx0+best.dx); mv.el.dataset.gy=String(gy0+best.dy);
  apply(mv);
  return true;
 };
 for(let round=0;round<20;round++){
  let moved=false;
  // cặp nhãn-nhãn đang chồng: dời nhãn robot trước, nhãn trạm chỉ dời khi
  // không còn lối nào khác (penalty lớn) — như vòng nhãn cũ.
  const pairs=[];
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
   if(ovArea(items[i].el.getBoundingClientRect(),items[j].el.getBoundingClientRect())>1)pairs.push([i,j]);
  }
  for(const [i,j] of pairs){
   let mv=items[j], ot=items[i];
   if(mv.fixed&&!ot.fixed){const t2=mv; mv=ot; ot=t2;}
   if(mv.fixed&&ot.fixed)continue;
   if(tryMove(mv,0))moved=true;
   else if(!ot.fixed&&tryMove(ot,0))moved=true;
   else if(ot.fixed&&tryMove(ot,400))moved=true;
  }
  // nhãn đang bị thân robot / mặt trước nội thất che: tự thoát ra
  for(const it of items){
   if(it.fixed)continue;
   if(scoreOf(it,it.el.getBoundingClientRect())>0&&tryMove(it,0))moved=true;
  }
  if(!moved)break;
 }
 // kẹp mọi nhãn vào trong khung phòng (tôn trọng quỹ đạo tối đa)
 for(const it of items){
  const r=it.el.getBoundingClientRect(); let dx=0, dy=0;
  if(r.left<rr.left+2)dx=rr.left+2-r.left; else if(r.right>rr.right-2)dx=rr.right-2-r.right;
  if(r.top<rr.top+2)dy=rr.top+2-r.top; else if(r.bottom>rr.bottom-2)dy=rr.bottom-2-r.bottom;
  if(dx||dy){
   const cl=CLAMP[it.kind]||CLAMP.name;
   const gx0=parseFloat(it.el.dataset.gx)||0, gy0=parseFloat(it.el.dataset.gy)||0;
   it.el.dataset.gx=String(Math.max(-cl.x,Math.min(cl.x,gx0+dx)));
   it.el.dataset.gy=String(Math.max(-cl.y,Math.min(cl.y,gy0+dy)));
   apply(it);
  }
 }
}
function officeFleetBot(agentId){
 if(!officeFleetActive()||!String(agentId).startsWith('bot-'))return null;
 const cid=String(agentId).slice(4);
 return officeState.fleet.bots.find(b=>b.connectionId===cid)||null;
}
function officeRosterCast(){
 const bots=officeFleetActive()?officeState.fleet.bots.map(b=>({id:'bot-'+b.connectionId,name:b.label,role:b.provider+' · '+(b.state==='working'?'đang làm việc':b.state==='failed'?'lượt gần nhất lỗi':b.state==='charging'?(b.resting?'đang nghỉ sạc · mở lại '+(b.coolingUntil?new Date(b.coolingUntil).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):''):'đang sạc · chờ việc'):'chưa kết nối'),icon:'🤖',station:b.station==='bay'?'lounge':b.station,color:b.color,fleet:b})):[];
 const cast=[OFFICE_CAST[0],...bots];
 /* Phòng luôn đủ 10 robot TÂM-19 (chỉ đạo Sếp Lâm 20/10): robot đã có tài
  * khoản/bàn thì ngồi ở bàn; các ô robot còn trống đứng ở Phòng nạp năng
  * lượng với nhãn chờ tài khoản — là Ô TRỐNG trung thực, không giả làm
  * tài khoản thật. Liên kết thêm tài khoản thì robot ở phòng sạc tự ra
  * ngồi bàn của tài khoản đó. */
 for(let i=bots.length;i<10;i++){
  cast.push({id:'slot-'+(i+1),name:'Robot '+(i+1),role:'Ô robot trống — chờ tài khoản. Vào tab Kết nối, liên kết một tài khoản AI để robot này có bàn làm việc.',icon:'🤖',station:'lounge',color:'#5b7a99',fleet:{provider:'TAM-19',state:'charging',standby:true}});
 }
 return cast;
}
function officeStationOf(agentId,ctx){
 const bot=officeFleetBot(agentId); if(bot){try{const ink=JSON.parse(localStorage.getItem('aios-intake')||'null');if(ink&&Date.now()-ink.ts<180000&&(!ink.lead||ink.lead===bot.connectionId))return 'intake';}catch{} return bot.station==='bay'?'lounge':bot.station;}
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
 const roster=officeRosterCast();
 const isoMode=room.classList.contains('office-iso');
 const rosterSig=roster.map(a=>a.id).join(',')+(isoMode?'|iso':'|flat');
 if(!room.dataset.built||officeState.rosterSig!==rosterSig){
  // Render đổi danh sách bot/mode: hủy DEMO trước khi thay lớp scene.
  window.__officeChairDemoActive?.stop();
  room.dataset.built='1'; officeState.rosterSig=rosterSig;
  const cnv=room.querySelector('.office-3d-canvas'); if(cnv)cnv.remove();
  room.innerHTML=Object.entries(isoMode?OFFICE_ISO_STATIONS:OFFICE_STATIONS_2D).filter(([id])=>!(isoMode&&id==='boss')).map(([id,st])=>`<div class="office-station" data-station="${id}" style="left:${st.lx??st.x}%;top:${st.ly??st.y}%">${st.label}</div>`).join('')
   +(isoMode?'<div class="office-glow-layer">'+Object.entries(OFFICE_ISO_MONITORS).map(([id,m])=>`<div class="office-monitor-glow" data-glow="${id}" style="left:${m.x}%;top:${m.y}%"></div>`).join('')+'</div><div class="office-flow-layer"></div><div class="office-fg-layer">'+OFFICE_ISO_FG.map(f=>{const ay=f.pod!==undefined?OFFICE_ISO_PODS[f.pod].y:OFFICE_ISO_STATIONS[f.st].y; return `<img class="office-fg" data-fg="${f.id}" src="/assets/office-iso-fg/${f.img}" alt="" style="left:${f.x}%;top:${f.y}%;width:${f.w}%;height:${f.h}%;z-index:${11+Math.round(ay)}">`;}).join('')+'</div>':'')
   +roster.map(a=>`<button type="button" class="office-agent" id="officeAgent-${a.id}" data-office-agent="${a.id}" style="left:50%;top:50%" title="${esc(a.role)}${a.fleet?'':' — bấm để đổi tên'}"><span class="office-agent-shadow"></span>${isoMode&&a.fleet?officeFigureIso(a):officeFigure(a)}<span class="office-agent-name">${esc(officePlateName(a))}</span><span class="office-agent-badge" hidden></span></button>`).join('')
   +`<div class="office-package" id="officePackage" hidden>📦</div>`
   +(awaiting?'':'' );
  if(cnv)room.appendChild(cnv);
  if(isoMode){
   room.querySelectorAll('[data-office-agent]').forEach(el=>el.onclick=e=>{e.stopPropagation(); officeIsoSelect(el.dataset.officeAgent===officeIsoSelectedId?null:el.dataset.officeAgent);});
   room.querySelectorAll('[data-station]').forEach(el=>el.onclick=e=>{e.stopPropagation(); officeIsoDispatchDesk(el.dataset.station);});
   room.onclick=e=>{if(e.target!==room)return; const r=room.getBoundingClientRect(); officeIsoDispatchFloor((e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100);};
  } else {
   room.onclick=null;
   room.querySelectorAll('[data-office-agent]').forEach(el=>el.onclick=()=>{
    const a=officeRosterCast().find(x=>x.id===el.dataset.officeAgent); if(!a)return;
    if(a.fleet){toast(`🤖 ${a.name} (${a.fleet.provider}): ${a.role}`);return;}
    const next=prompt(`Đổi tên cho ${a.role}:`,officeAgentName(a));
    if(next&&next.trim()){officeNames[a.id]=next.trim().slice(0,24);localStorage.setItem('aios-office-names',JSON.stringify(officeNames));officeRender();}
   });
  }
 }
 const slotUse=new Map();
 const isoPosts=isoMode?officeResolvePosts(roster):null;
 const isoLitStations=new Set(), isoCurWorking=new Map();
 if(isoMode)window.__officeIsoPosts={};
 for(const a of roster){
  const el=$('#officeAgent-'+a.id); if(!el)continue;
  if(isoMode){
   const post=isoPosts?isoPosts.get(a.id):null;
   let pt,pose;
   if(post){pt=officeIsoPointForPost(post); pose=post.kind==='pod'?'pod':((post.kind==='desk'||post.kind==='station')&&post.id!=='boss'?'desk':'stand');}
   else{const stId0=officeStationOf(a.id,ctx); pt=OFFICE_ISO_STATIONS[stId0]||OFFICE_ISO_STATIONS.lounge; pose=stId0==='lounge'?'pod':'stand';}
   pt=officeIsoClampToDeck(pt);
   el.style.zIndex=String(10+Math.round(pt.y));
   el.style.setProperty('--isos',String(a.id==='boss'?OFFICE_ISO_SCALES.boss:officeIsoScaleFor(post,pt)));
   if(a.fleet&&a.fleet.state==='working'){
    isoCurWorking.set(a.id,{runId:a.fleet.runId||'',x:pt.x,y:pt.y});
    if(post&&(post.kind==='desk'||post.kind==='station')&&OFFICE_ISO_MONITORS[post.id])isoLitStations.add(post.id);
   }
   const pd=officeIsoLabelShift(post), lsc=(room.clientWidth||626)/626;
   const nmEl=el.querySelector('.office-agent-name'), bdEl=el.querySelector('.office-agent-badge');
   if(nmEl){const nlx=pd?Math.round(pd.lx*lsc):0, nly=pd?Math.round(pd.ly*lsc):0; nmEl.dataset.nlx=String(nlx); nmEl.dataset.nly=String(nly); nmEl.dataset.gx='0'; nmEl.dataset.gy='0'; nmEl.style.transform=`translate(${nlx}px,${nly}px)`;}
   if(bdEl){const btx=pd?Math.round(pd.bx*lsc):0, bty=pd?Math.round(pd.by*lsc):0; bdEl.dataset.btx=String(btx); bdEl.dataset.bty=String(bty); bdEl.dataset.gx='0'; bdEl.dataset.gy='0'; bdEl.style.transform=`translateX(calc(-50% + ${btx}px)) translateY(${bty}px)`;}
   el.dataset.postkind=post?post.kind:'';
   const postKey=post?(post.kind+':'+(post.id!==undefined?post.id:(post.slot!==undefined?post.slot:post.x+','+post.z))):'cast:'+pt.x+','+pt.y;
   const prev=officePrevPos[a.id];
   if(prev&&prev.station!==postKey){
    el.classList.add('office-walking'); el.classList.toggle('office-face-left',pt.x<prev.x);
    clearTimeout(officeWalkTimers[a.id]);
    const wantPose=pose;
    officeWalkTimers[a.id]=setTimeout(()=>{el.classList.remove('office-walking'); if(el.dataset.postkey===postKey)el.dataset.isopose=wantPose;},1300);
    el.dataset.isopose='walk';
   } else el.dataset.isopose=pose;
   el.dataset.postkey=postKey;
   officePrevPos[a.id]={station:postKey,x:pt.x};
   el.style.left=pt.x+'%'; el.style.top=pt.y+'%';
   el.querySelector('.office-agent-name').textContent=officeDisplayName(a,roster);
   el.classList.toggle('iso-selected',officeIsoSelectedId===a.id);
   const badge=el.querySelector('.office-agent-badge');
   let badgeText='';
   if(a.fleet){const b=a.fleet; badgeText=b.cage?'⚡ đang bị chích điện':b.state==='working'?'đang làm việc…':b.state==='failed'?'⚡ vừa lỗi':b.resting?'🔋 nghỉ sạc · '+(b.coolingUntil?new Date(b.coolingUntil).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):''):''; el.dataset.state=b.cage?'failed':b.state;}
   else if(a.id==='boss'&&awaiting)badgeText='✋ chờ duyệt';
   if(culprit&&culprit.agentId===a.id)badgeText='⚡ đang bị chích điện';
   if(!a.fleet&&officeStationOf(a.id,ctx)==='lounge'&&!(culprit&&culprit.agentId===a.id))badgeText='💤 đang nạp năng lượng';
   /* 0.9.59: robot ở ô sạc mà không có trạng thái đáng chú ý (chỉ đang
    * sạc chờ việc / chưa kết nối / ô trống) thì CHỈ hiện bảng tên — dòng
    * trạng thái đã có ở mục tin dưới phòng; bớt một lớp chữ là cụm ô sạc
    * hết cảnh nhãn chồng nhãn (0.9.58). Nghỉ sạc (có giờ mở lại), vừa lỗi
    * và chích điện vẫn giữ huy hiệu. */
   if(pose==='pod'&&a.fleet&&!a.fleet.resting&&a.fleet.state!=='failed'&&!a.fleet.cage)badgeText='';
   badge.hidden=!badgeText; badge.textContent=badgeText;
   el.classList.toggle('office-busy',Boolean(a.fleet&&(a.fleet.state==='working'||a.fleet.cage)));
   window.__officeIsoPosts[a.id]={kind:post?post.kind:'cast',id:post&&post.id!==undefined?post.id:null,slot:post&&post.kind==='pod'?post.slot:null,x:pt.x,y:pt.y,pose:el.dataset.isopose,pinned:Boolean(post&&post.pinned),stateDriven:Boolean(post&&post.stateDriven),sprite:a.fleet?officeIsoSpriteKey(a):null};
   continue;
  }
  const stId=officeStationOf(a.id,ctx);
  const st=OFFICE_STATIONS_2D[stId]||OFFICE_STATIONS_2D.lounge;
  const slot=slotUse.get(stId)||0; slotUse.set(stId,slot+1);
  const dx=stId==='lounge'?[-13,-6.5,0,6.5,13][slot%5]:(stId==='cage'?[0,5.5,-5.5,10.5,-10.5][slot%5]:[0,6,-6,11,-11][slot%5]); const rowY=stId==='lounge'?(slot>=5?38:0):(slot>=5?34:0);
  const targetX=Math.max(6,Math.min(94,st.x+dx));
  const prev=officePrevPos[a.id];
  if(prev&&prev.station!==stId+':'+slot){
   el.classList.add('office-walking');
   el.classList.toggle('office-face-left',targetX<prev.x);
   clearTimeout(officeWalkTimers[a.id]);
   officeWalkTimers[a.id]=setTimeout(()=>el.classList.remove('office-walking'),1300);
  }
  officePrevPos[a.id]={station:stId+':'+slot,x:targetX};
  el.style.left=targetX+'%'; el.style.top=`calc(${st.y}% + ${32+rowY}px)`;
  el.querySelector('.office-agent-name').textContent=officeDisplayName(a,roster);
  const badge=el.querySelector('.office-agent-badge');
  let badgeText='';
  if(a.fleet){const b=a.fleet; badgeText=b.cage?'⚡ đang bị chích điện':b.state==='working'?'đang làm việc…':b.state==='failed'?'⚡ vừa lỗi — chờ thay ca':''; el.dataset.pose=b.state==='working'&&!b.cage?'work':'idle'; el.dataset.state=b.cage?'failed':b.state;}
  else if(a.id==='boss'&&awaiting)badgeText='✋ chờ duyệt';
  if(a.id==='news'&&unused)badgeText=unused+' tin mới';
  if(a.id==='media'&&ctx.stage==='produce')badgeText='đang dựng…';
  if(a.id==='script'&&ctx.stage==='script')badgeText='đang viết…';
  if(a.id==='publish'&&ctx.stage==='publish')badgeText='đang đăng…';
  if(culprit&&culprit.agentId===a.id)badgeText='⚡ đang bị chích điện';
  if(!a.fleet&&officeStationOf(a.id,ctx)==='lounge'&&!(culprit&&culprit.agentId===a.id))badgeText='💤 đang nạp năng lượng';
  badge.hidden=!badgeText; badge.textContent=badgeText;
  el.classList.toggle('office-busy',(Boolean(badgeText)&&(!a.fleet||a.fleet.state==='working'||a.fleet.cage))||(a.id==='pm'&&Boolean(activeRun)));
 }
 if(isoMode){
  /* 0.9.59 (bổ sung theo góp ý 14:43): màn hình bàn nào có robot ĐANG
   * LÀM VIỆC THẬT thì sáng lên; tia luồng chỉ bắn khi quan sát thấy một
   * chuyển giao thật giữa hai lần quét; và vòng nhãn tổng quát lo cả ba
   * việc — gỡ chồng mọi nhãn (tên + huy hiệu + nhãn trạm), kẹp mọi nhãn
   * vào trong khung phòng (không cắt mép như ảnh Sếp chụp), canh lại
   * sau khi robot lướt xong. */
  officeIsoUpdateGlow(room,isoLitStations);
  officeIsoDetectFlow(room,isoCurWorking);
  officeIsoLabelPass(room);
  // Chạy lại theo chuỗi kiểm chứng: lần đo ngay lúc dựng có thể bắt hình
  // học chưa yên (robot còn đang lướt 1,15s, phông chữ đổi nhịp nhãn) —
  // đo lại ở 0,65s / 1,35s / 2,05s cho tới khi nhãn đứng yên hẳn.
  clearTimeout(officeLabelPassTimer);
  officeLabelPassChain=0;
  const officeLabelSettle=()=>{
   const r2=$('#officeRoom'); if(!r2||!r2.classList.contains('office-iso'))return;
   officeIsoLabelPass(r2);
   if(++officeLabelPassChain<3)officeLabelPassTimer=setTimeout(officeLabelSettle,700);
  };
  officeLabelPassTimer=setTimeout(officeLabelSettle,650);
 }
 const pkg=$('#officePackage');
 if(pkg){
  const target=officeFleetActive()?(awaiting?'boss':(officeState.fleet.bots.find(b=>b.state==='working')?.station||null)):(awaiting?'boss':activeRun?(ctx.stage==='produce'?'media':ctx.stage==='publish'?'publish':ctx.stage==='script'?'script':'pm'):null);
  if(target){const st=(isoMode?OFFICE_ISO_STATIONS:OFFICE_STATIONS_2D)[target];pkg.hidden=false;
   if(isoMode){ // 0.9.60: kiện hàng phải NGỒI TRÊN mặt bàn của trạm đích, không lơ lửng trên mép thềm như bản cũ
    const pp=target==='boss'?{x:52.6,y:25.8}:(OFFICE_ISO_MONITORS[target]?{x:OFFICE_ISO_MONITORS[target].x+3.8,y:OFFICE_ISO_MONITORS[target].y+1.2}:{x:st.x+3,y:st.y+1});
    pkg.style.left=pp.x+'%'; pkg.style.top=pp.y+'%';
   } else {pkg.style.left=(st.x+4)+'%'; pkg.style.top=(st.y-7)+'%';}}
  else pkg.hidden=true;
 }
 if(isoMode)officeIsoCardRefresh();
 const approveBtn=$('#officeApprove');
 if(awaiting&&!approveBtn){
  const bar=document.createElement('div');bar.className='office-approve-bar';bar.id='officeApprove';
  bar.innerHTML=`<span>📦 Có sản phẩm đang chờ Sếp Lâm duyệt đăng: <b>${esc(awaiting.title||awaiting.pipeline)}</b></span><button type="button" class="primary" id="officeApproveBtn">✔ Duyệt đăng ngay</button>`;
  room.after(bar);
  $('#officeApproveBtn').onclick=async()=>{const b=$('#officeApproveBtn');b.disabled=true;try{const result=await api(`/api/orchestrator/runs/${encodeURIComponent(awaiting.id)}/approve`,{method:'POST',body:'{}'});if(result.state==='failed')throw new Error(result.error?.message||result.error||'Publish failed; inspect the run before retrying.');toast('Đã duyệt đăng');officePoll(true);}catch(e){toast(e.message);b.disabled=false;}};
 } else if(!awaiting&&approveBtn){approveBtn.remove();}
 const feed=$('#officeFeed');
 if(feed){
  const lines=[];
  if(!officeState.loaded)lines.push('Đang tải dữ liệu văn phòng…');
  else if(officeFleetActive()){
   if(awaiting)lines.push(`👔 Sản phẩm "${awaiting.title||awaiting.pipeline}" đang ở trên bàn Sếp Lâm chờ duyệt.`);
   if(justCompleted)lines.push(`🎉 Lượt "${justCompleted.title||justCompleted.pipeline}" vừa hoàn thành tốt.`);
   for(const b of officeState.fleet.bots){
    const bn=b.label;
    if(b.state==='working')lines.push(`🤖 ${bn} (${b.provider}) đang làm việc ở ${(OFFICE_STATIONS[b.station]||{}).label||'bàn làm việc'} — lượt chạy thật đang chạy trên tài khoản này.`);
    else if(b.cage)lines.push(`⚡ ${bn} đang ở Phòng chích điện vì lượt chạy gần nhất trên tài khoản này bị lỗi — bot khác đã ra thay bàn của nó.`);
    else if(b.state==='failed')lines.push(`⚡ ${bn} vừa có lượt chạy lỗi — đang chờ ở khu sạc và nhường bàn cho bot khác.`);
    else if(b.state==='charging'&&b.resting)lines.push(`🔋 ${bn} (${b.provider}) đang NGHỈ SẠC ở trạm sạc vì chạm hạn mức — mở lại lúc ${b.coolingUntil?new Date(b.coolingUntil).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'?'}; việc của nó đã được đội chuyển sang tài khoản khác.`);
    else if(b.state==='charging')lines.push(`🔋 ${bn} (${b.provider}) đang ở trạm sạc — đã kết nối, chờ việc.`);
    else lines.push(`🔌 ${bn} (${b.provider}) chưa kết nối được — bot đang tắt ở khu sạc. Vào tab Kết nối để đăng nhập và tải danh mục model cho tài khoản này.`);
   }
   if(officeState.fleet.overflow)lines.push(`… và ${officeState.fleet.overflow} tài khoản nữa chưa có bot (văn phòng tối đa 10 bot).`);
   if(officeState.fleet.bots.length<10)lines.push(`🔋 ${10-officeState.fleet.bots.length} robot TÂM-19 đang đứng ở Phòng nạp năng lượng — ô trống chờ tài khoản. Liên kết thêm tài khoản ở tab Kết nối, robot sẽ tự ra ngồi bàn.`);
   if(unused)lines.push(`📰 Đang có ${unused} thẻ tin chưa dùng ở tab Ý tưởng.`);
   if(!lines.length)lines.push('☕ Chưa có tài khoản AI nào. Vào tab Kết nối để thêm tài khoản — mỗi tài khoản là một bot trong văn phòng.');
  }
  else{
   lines.push('🔋 Cả 10 robot TÂM-19 đang đứng ở Phòng nạp năng lượng — chưa có tài khoản nào được giao bàn. Vào tab Kết nối để liên kết tài khoản AI đầu tiên.');
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
 if(window.__office3DWanted)office3DEnsure();
 if(window.__office3D)window.__office3DSync(ctx);
}
let officePollPending=false;
async function officePoll(force){
 if(officePollPending&&!force)return;
 const room=$('#officeRoom'); if(!room)return;
 officePollPending=true;
 try{
  const [orch,cards,fleet]=await Promise.all([api('/api/orchestrator').catch(()=>null),api('/api/ingest/cards').catch(()=>null),api('/api/office/fleet').catch(()=>null)]);
  if(orch)officeState.runs=orch.runs||[];
  if(cards)officeState.cards=cards.cards||[];
  if(fleet&&Array.isArray(fleet.bots))officeState.fleet=fleet;
  officeState.loaded=true;
 }catch{/* giữ trạng thái cũ */}
 finally{officePollPending=false;officeRender();document.dispatchEvent(new Event('office-space-fleet'));}
}
setInterval(()=>{const page=$('#page-idea');if(page&&page.classList.contains('active')&&!document.hidden)officePoll();},4000);
document.addEventListener('page-change',e=>{if(e.detail.page==='idea'){officeRender();officePoll();officeModelsRender();}});
const OFFICE_MODEL_CAST=[['boss','Sếp Lâm'],['pm','Tuấn — Trưởng phòng'],['news','Na — Tin tức'],['script','Hằng — Biên tập'],['image','Tí — Hình ảnh'],['media','Minh — Sản xuất'],['review','Tâm — Kiểm duyệt'],['publish','Phát — Đăng bài']];
async function officeModelsRender(){
 const box=document.getElementById('officeModelRows'); if(!box)return;
 let models=[]; try{models=(await (await fetch('/api/office/models')).json()).models||[];}catch{}
 box.innerHTML=OFFICE_MODEL_CAST.map(([id,label])=>{const m=models.find(x=>x.id===id);return '<div class="office-model-row"><span class="office-model-name">'+label+'</span><span class="office-model-state">'+(m?('✅ đã có model ('+Math.max(1,Math.round(m.bytes/1024))+' KB)'):'— chưa có, đang dùng robot mặc định')+'</span><label class="office-model-pick">Nạp file .glb<input type="file" accept=".glb" data-model-pick="'+id+'" hidden></label>'+(m?'<button type="button" class="ghost small" data-model-del="'+id+'">Xóa</button>':'')+'</div>';}).join('');
 box.querySelectorAll('[data-model-pick]').forEach(inp=>inp.addEventListener('change',async()=>{const f=inp.files&&inp.files[0]; if(!f)return; const id=inp.getAttribute('data-model-pick');
  try{const r=await fetch('/api/office/models/'+id,{method:'POST',body:f}); const j=await r.json(); if(!r.ok)throw new Error(j.message||'Nạp model thất bại'); if(window.__office3DLoadModels)window.__office3DLoadModels();}
  catch(e){alert(e.message||'Nạp model thất bại');}
  officeModelsRender();}));
 box.querySelectorAll('[data-model-del]').forEach(btn=>btn.addEventListener('click',async()=>{await fetch('/api/office/models/'+btn.getAttribute('data-model-del'),{method:'DELETE'}); if(window.__office3DLoadModels)window.__office3DLoadModels(); officeModelsRender();}));
}
officeRender();officePoll();officeModelsRender();

/* Preview ghế tương tác: kích hoạt thủ công, bảo toàn toàn bộ task/fleet/roster AI.
 * Thử trực tiếp robot GLB trên mỹ thuật B2 2D; không làm giả trạng thái xử lý. */
const officeChairPreviewButton=$('#officeChairPreview');
let officeChairPreviewRunning=null;
if(officeChairPreviewButton){
 const resetPreviewButton=()=>{officeChairPreviewButton.disabled=false;officeChairPreviewButton.textContent='🪑 Xem kéo ghế (demo)';};
 officeChairPreviewButton.onclick=async()=>{
  if(officeChairPreviewRunning?.running){officeChairPreviewRunning.stop();return;}
  const room=$('#officeRoom');
  if(!room?.classList.contains('office-iso')||room.classList.contains('office-3d-on')){
   toast('Chuyển về chế độ phòng isometric trước khi xem diễn họa kéo ghế.');return;
  }
  officeChairPreviewButton.disabled=true;officeChairPreviewButton.textContent='Đang nạp robot 3D…';
  try{
   const {mountOfficeChairPreview}=await import('/office-chair-demo.mjs');
   const player=await mountOfficeChairPreview(room,{
    onDone:()=>{officeChairPreviewRunning=null;window.__officeChairDemoActive=null;resetPreviewButton();}
   });
   officeChairPreviewRunning=player;
   window.__officeChairDemoActive=player;
   officeChairPreviewButton.disabled=false;officeChairPreviewButton.textContent='■ Dừng diễn họa';
  }catch(err){
   officeChairPreviewRunning=null;window.__officeChairDemoActive=null;resetPreviewButton();
   console.warn('Không nạp được demo kéo ghế:',err);
   toast('Không thể nạp robot WebGL: '+String(err?.message||err).slice(0,140));
  }
 };
 document.addEventListener('page-change',e=>{
  if(e.detail.page!=='idea')officeChairPreviewRunning?.stop();
 });
}

/* ================= Văn phòng 3D (0.9.25) =================
 * Cùng một bộ não trạng thái với phòng 2D (officeStationOf/officeCulprit),
 * chỉ khác cách vẽ: phòng 3D bằng Three.js (MIT, nhúng trong source).
 * Nếu WebGL/import lỗi, phòng 2D vẫn chạy như cũ — không giấu lỗi. */
var office3DVisible=true;
document.addEventListener('page-change',e=>{office3DVisible=e.detail.page==='idea';});
function office3DEnsure(){
 if(window.__office3DEnsureStarted)return; window.__office3DEnsureStarted=true;
 const room=$('#officeRoom'); if(!room)return;
 setTimeout(()=>{if(window.__office3DWanted&&!window.__office3DReady){const c=room.querySelector('.office-3d-canvas');if(c)c.remove();room.classList.remove('office-3d-on');const t=$('#office3DToggle');if(t){t.disabled=false;t.textContent='🧊 Phòng 3D chưa tải được — đang dùng bản isometric';}console.warn('Phòng 3D không sẵn sàng sau 9 giây — giữ bản isometric.');}},9000);
 import('/vendor/three.module.min.js').then(THREE=>{try{office3DBuild(THREE,room);}catch(err){console.warn('Văn phòng 3D lỗi, dùng bản 2D:',err);}}).catch(()=>{});
}
{const tgl=$('#office3DToggle');if(tgl)tgl.onclick=()=>{
 window.__officeChairDemoActive?.stop();
 const roomEl=$('#officeRoom');
 if(window.__office3DReady&&roomEl&&roomEl.classList.contains('office-3d-on')){window.__office3DOff=true;roomEl.classList.remove('office-3d-on');if(window.__office3DSelect)window.__office3DSelect(null);tgl.textContent='🧊 Xem phòng 3D';try{localStorage.setItem('aios-office-view','iso');}catch{} if(roomEl){roomEl.classList.add('office-iso');officeRender();} return;}
 if(window.__office3DReady&&window.__office3DOff){window.__office3DOff=false;if(roomEl){roomEl.classList.remove('office-iso');roomEl.classList.add('office-3d-on');}tgl.textContent='🗺️ Đang ở phòng 3D — bấm để về isometric';try{localStorage.setItem('aios-office-view','3d');}catch{} return;}
 window.__office3DWanted=true;tgl.disabled=true;tgl.textContent='🧊 Đang tải phòng 3D…';try{localStorage.setItem('aios-office-view','3d');}catch{} office3DEnsure();};}
/* (Lịch sử: 0.9.46–0.9.57 phòng 3D là chế độ mở đầu.) */
/* Từ 0.9.58 chế độ mở đầu là văn phòng ISOMETRIC (concept B2); phòng 3D chỉ
 * tự mở khi Sếp đã chọn nó trước đó ('3d'). Lựa chọn '2d' của các bản cũ
 * cũng về isometric — bản 2D phẳng cũ đã nghỉ, isometric thay thế hẳn. */
try{
 if(localStorage.getItem('aios-space-studio-mode')==='legacy'&&localStorage.getItem('aios-office-view')==='3d'){window.__office3DWanted=true;const t=$('#office3DToggle');if(t){t.disabled=true;t.textContent='🧊 Đang tải phòng 3D…';}office3DEnsure();}
 else{const r0=$('#officeRoom'); if(r0){r0.classList.add('office-iso'); officeRender();}}
}catch{}
function officeWorld(pct){return {x:(pct.x-50)/50*17,z:(pct.y-50)/50*11};}
let officeRoomDeckY=0; // 0 = phòng thủ tục; 0.18 = mặt boong của phòng GLB (nạp bất đồng bộ bên dưới)
function officeYFor(stId){return (stId==='lounge'||stId==='cage')?0:officeRoomDeckY;}
function office3DBuild(THREE,room){
 const W=()=>room.clientWidth||1200,H=()=>430;
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
 renderer.setSize(W(),H());
 renderer.domElement.className='office-3d-canvas';
 room.appendChild(renderer.domElement);
 // KHÔNG bật 'office-3d-on' ngay: lớp 2D chỉ ẩn sau khi khung hình 3D đầu tiên vẽ thành công (tránh hộp đen che hết bot khi 3D lỗi).
 const scene=new THREE.Scene();
 let officeComposer=null; // chuỗi hậu kỳ (bloom + chỉnh màu) — nạp lười bên dưới, lỗi thì render thường
 scene.background=new THREE.Color(0x0b0b13);
 scene.fog=new THREE.Fog(0x0b0b13,36,88);
 const camera=new THREE.PerspectiveCamera(42,W()/H(),0.1,120);
 // --- Hậu kỳ như bản dựng mẫu: bloom .34/.4/.8 + vignette + hơi lạnh màu, qua OutputPass (ACES).
 // Chỉ bật SAU KHI phòng GLB đã nạp xong (hoặc lỗi) — tránh tranh CPU với việc giải nén phòng trên máy yếu; quá 6 giây thì bật dù thế nào.
 let officePostStarted=false;
 function officeEnablePost(){
  if(officePostStarted)return; officePostStarted=true;
  Promise.all([import('/vendor/addons/EffectComposer.js'),import('/vendor/addons/RenderPass.js'),import('/vendor/addons/UnrealBloomPass.js'),import('/vendor/addons/ShaderPass.js'),import('/vendor/addons/OutputPass.js')]).then(([EC,RP,UB,SP,OP])=>{
  try{
   const composer=new EC.EffectComposer(renderer);
   composer.addPass(new RP.RenderPass(scene,camera));
   composer.addPass(new UB.UnrealBloomPass(new THREE.Vector2(W(),H()),.34,.4,.8));
   composer.addPass(new SP.ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',fragmentShader:`uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 col = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(.5, .46));
      col.rgb *= smoothstep(.95, .38, d) * .28 + .72;
      col.rgb = mix(col.rgb, col.rgb * vec3(1.03, 1.0, 1.06), .55);
      gl_FragColor = col;
    }`}));
   composer.addPass(new OP.OutputPass());
   composer.setSize(W(),H());
   officeComposer=composer; window.__officePost=true;
  }catch(err){ console.warn('Hậu kỳ 3D tắt:',err); }
  }).catch(()=>{});
 }
 setTimeout(officeEnablePost,6000);
 const orbit={theta:0,phi:1.16,radius:24,lookX:0,lookY:1.0,lookZ:0};
 scene.add(new THREE.HemisphereLight(0x9d8fff,0x0a0a10,1.3));
 const pmrem=new THREE.PMREMGenerator(renderer);
 const envC=document.createElement('canvas'); envC.width=512; envC.height=256;
 const eg=envC.getContext('2d');
 const egrad=eg.createLinearGradient(0,0,0,256); egrad.addColorStop(0,'#0a1030'); egrad.addColorStop(.45,'#2a1650'); egrad.addColorStop(.62,'#101a38'); egrad.addColorStop(1,'#05070f');
 eg.fillStyle=egrad; eg.fillRect(0,0,512,256);
 eg.shadowBlur=34;
 for(const [x,y,w2,h2,col] of [[60,38,110,44,'rgba(190,230,255,.95)'],[215,26,150,54,'rgba(240,246,255,1)'],[405,42,90,38,'rgba(150,230,255,.9)'],[120,86,70,26,'rgba(200,140,255,.75)'],[330,92,84,28,'rgba(120,255,230,.7)']]){eg.shadowColor=col;eg.fillStyle=col;eg.fillRect(x,y,w2,h2);}
 const envTex=new THREE.CanvasTexture(envC); envTex.mapping=THREE.EquirectangularReflectionMapping; envTex.colorSpace=THREE.SRGBColorSpace;
 scene.environment=pmrem.fromEquirectangular(envTex).texture;
 /* 0.9.58 — BEAUTY PASS (tài nguyên ngoài đã kiểm chứng giấy phép, ghi ở
  * THIRD_PARTY_ASSETS.md): RoomEnvironment của three.js (MIT) làm ánh sáng
  * môi trường IBL chính khi nạp được (sáng, trung tính — Sếp không thích
  * phòng tối); HDRI "Blue Photo Studio" (Poly Haven, CC0) phủ envMap lên
  * vật liệu phòng + sàn để có phản chiếu thật; họa tiết sàn "Blue Floor
  * Tiles 01" (Poly Haven, CC0) trải lên mặt boong. Món nào tải lỗi thì bỏ
  * món đó và giữ nguyên phần còn lại, không sập phòng. */
 let officeHdrTex=null;
 const officeApplyHdr=(root)=>{ if(!officeHdrTex||!root)return; root.traverse(o=>{ if(o.isMesh&&o.material&&o.material.isMeshStandardMaterial){ o.material=o.material.clone(); o.material.envMap=officeHdrTex; o.material.envMapIntensity=.55; o.material.needsUpdate=true; } }); };
 const officeTileTex=new THREE.TextureLoader().load('/assets/env/blue_floor_tiles_01_diff_512.jpg');
 officeTileTex.colorSpace=THREE.SRGBColorSpace; officeTileTex.wrapS=officeTileTex.wrapT=THREE.RepeatWrapping; officeTileTex.repeat.set(9,9);
 const officeApplyFloor=(root)=>{ if(!root)return; root.traverse(o=>{ if(o.isMesh&&(o.name==='Floor'||o.name==='MainDeck'||o.name==='DeckStep')&&o.material&&o.material.isMeshStandardMaterial){ o.material=o.material.clone(); o.material.map=officeTileTex; o.material.needsUpdate=true; } }); };
 window.__officeBeauty={};
 import('/vendor/addons/RoomEnvironment.js').then(m=>{ try{ const t=pmrem.fromScene(new m.RoomEnvironment(),.04).texture; if(t){scene.environment=t; window.__officeBeauty.roomEnvironment=true;} }catch(e){ console.warn('RoomEnvironment lỗi — giữ env canvas:',e); } }).catch(()=>{});
 import('/vendor/addons/RGBELoader.js').then(m=>{ new m.RGBELoader().load('/assets/env/blue_photo_studio_1k.hdr',t=>{ try{ t.mapping=THREE.EquirectangularReflectionMapping; officeHdrTex=pmrem.fromEquirectangular(t).texture; window.__officeBeauty.hdri=true; officeApplyHdr(floor); if(window.__officeRoomEnv)officeApplyHdr(window.__officeRoomEnv); }catch(e){ console.warn('HDRI lỗi — bỏ qua:',e); } },undefined,()=>console.warn('Không tải được HDRI Blue Photo Studio — bỏ qua.')); }).catch(()=>{});
 const rimL=new THREE.DirectionalLight(0x8b5cf6,1.1); rimL.position.set(-9,6,-8); scene.add(rimL);
 const rimR=new THREE.DirectionalLight(0x22d3ee,.9); rimR.position.set(9,5,-8); scene.add(rimR);
 const sun=new THREE.DirectionalLight(0xffffff,2.1); sun.position.set(7,14,7); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-23; sun.shadow.camera.right=23; sun.shadow.camera.top=23; sun.shadow.camera.bottom=-23; sun.shadow.camera.far=42; sun.shadow.bias=-0.0004; scene.add(sun);
 const purple=new THREE.PointLight(0x7c5cff,60,40); purple.position.set(0,6,-4); scene.add(purple);
 // --- textures vẽ bằng canvas (không file ngoài) ---
 function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);return t;}
 const screenTex=canvasTex(256,160,(g,w,h)=>{g.fillStyle='#0a1420';g.fillRect(0,0,w,h);const cols=['#57e6ff','#8b5cf6','#34d399','#f472b6','#facc15'];for(let i=0;i<13;i++){g.fillStyle=cols[i%cols.length];g.globalAlpha=.75;const lw=30+((i*67)%180);g.fillRect(12,10+i*11,lw,5);}g.globalAlpha=1;});
 const screenTexCache={};
 function screenFor(kind){
  if(screenTexCache[kind])return screenTexCache[kind];
  const tex=canvasTex(512,320,(g)=>{g.scale(2,2);const w=256,h=160;
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
 const floorTex=canvasTex(1024,1024,(g,w,h)=>{
  g.fillStyle='#12151f'; g.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){g.fillStyle=`rgba(255,255,255,${Math.random()*.03})`;g.fillRect(Math.random()*w,Math.random()*h,2,2);}
  g.strokeStyle='rgba(96,150,220,.16)'; g.lineWidth=2;
  for(let x=0;x<=w;x+=128){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();g.beginPath();g.moveTo(0,x);g.lineTo(w,x);g.stroke();}
  g.strokeStyle='rgba(45,212,238,.20)';
  for(let x=0;x<=w;x+=512){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();g.beginPath();g.moveTo(0,x);g.lineTo(w,x);g.stroke();}
 });
 floorTex.wrapS=floorTex.wrapT=THREE.RepeatWrapping; floorTex.repeat.set(7,7);
 const floor=new THREE.Mesh(new THREE.CircleGeometry(30,48),new THREE.MeshStandardMaterial({map:floorTex,roughness:.34,metalness:.55,envMapIntensity:.75}));
 floor.rotation.x=-Math.PI/2; scene.add(floor);
 floor.material.map=officeTileTex; floor.material.needsUpdate=true; // 0.9.58: họa tiết gạch xanh CC0 thay họa tiết canvas cũ
 const grid=new THREE.GridHelper(46,46,0x2e2e46,0x1d1d2c); grid.position.y=.01; grid.material.transparent=true; grid.material.opacity=.55; scene.add(grid);
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
 buildPlant(-16.4,-6.4); buildPlant(16.4,-6.4); buildPlant(-16.6,5.2); buildPlant(16.6,5.4);
 const dustGeo=new THREE.BufferGeometry(); const dustCount=220; const dustArr=new Float32Array(dustCount*3);
 for(let i=0;i<dustCount;i++){dustArr[i*3]=(Math.random()-.5)*40; dustArr[i*3+1]=.3+Math.random()*6.5; dustArr[i*3+2]=(Math.random()-.5)*26;}
 dustGeo.setAttribute('position',new THREE.BufferAttribute(dustArr,3));
 const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x9fd8ff,size:.05,transparent:true,opacity:.5}));
 scene.add(dust);
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
 wallScr.position.set(-17.2,2.6,-4); wallScr.rotation.y=.62; scene.add(wallScr);
 const rackGroup=new THREE.Group();
 const rackFrame=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.7,.7),new THREE.MeshStandardMaterial({color:0x161a24,roughness:.45,metalness:.5}));
 rackFrame.position.y=1.35; rackGroup.add(rackFrame);
 const unitTexes=[0,1,2].map(v=>canvasTex(128,32,(g,w,h)=>{
  g.fillStyle='#1b2130'; g.fillRect(0,0,w,h);
  g.fillStyle='rgba(120,150,190,.35)'; for(let x=6;x<58;x+=6)g.fillRect(x,6,3,20);
  for(let i=0;i<7;i++){g.fillStyle=['#34d399','#57e6ff','#facc15'][(i+v)%3]; g.globalAlpha=.55+((i*29+v*13)%10)/22; g.fillRect(70+i*8,12,5,8); g.globalAlpha=1;}
  g.fillStyle='#39424f'; g.fillRect(64,4,2,24);
 }));
 for(let u=0;u<6;u++){
  const unit=new THREE.Mesh(new THREE.BoxGeometry(1.52,.36,.05),new THREE.MeshStandardMaterial({color:0x232a3a,roughness:.4,metalness:.5}));
  unit.position.set(0,.32+u*.4,.36); rackGroup.add(unit);
  const uface=new THREE.Mesh(new THREE.PlaneGeometry(1.46,.3),new THREE.MeshBasicMaterial({map:unitTexes[u%3]}));
  uface.position.set(0,.32+u*.4,.39); rackGroup.add(uface);
  const handle=new THREE.Mesh(new THREE.BoxGeometry(.16,.03,.03),new THREE.MeshStandardMaterial({color:0x9aa6bd,roughness:.35,metalness:.7}));
  handle.position.set(.62,.32+u*.4,.40); rackGroup.add(handle);
 }
 const rackStrip=new THREE.Mesh(new THREE.BoxGeometry(.045,2.5,.02),new THREE.MeshBasicMaterial({color:0x2dd4ee}));
 rackStrip.position.set(-.8,1.35,.36); rackGroup.add(rackStrip);
 const rackTop=new THREE.Mesh(new THREE.BoxGeometry(1.5,.05,.5),new THREE.MeshBasicMaterial({color:0xbfe9ff}));
 rackTop.position.set(0,2.76,0); rackGroup.add(rackTop);
 rackGroup.position.set(17.2,0,-6.8); rackGroup.rotation.y=-.55; scene.add(rackGroup);
 // tủ lưu trữ kính phát sáng ở tường trái
 const storageCab=new THREE.Group();
 const cabFrame=new THREE.Mesh(new THREE.BoxGeometry(2.7,1.7,.62),new THREE.MeshStandardMaterial({color:0x1a1f2c,roughness:.45,metalness:.45}));
 cabFrame.position.y=.95; storageCab.add(cabFrame);
 const cabCols=[0x2dd4ee,0x8b5cf6,0x34d399];
 for(let i=0;i<3;i++){
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(.78,1.34),new THREE.MeshBasicMaterial({color:cabCols[i],transparent:true,opacity:.30}));
  glass.position.set(-.86+i*.86,.95,.32); storageCab.add(glass);
  const shelf=new THREE.Mesh(new THREE.BoxGeometry(.78,.03,.5),new THREE.MeshStandardMaterial({color:0x39424f,roughness:.5}));
  shelf.position.set(-.86+i*.86,.95,0); storageCab.add(shelf);
  for(const [bx,by,bs,bc] of [[-.12,.28,.2,0x2b3448],[.1,.26,.16,0x232b3d],[-.02,.68,.24,0x2b3448]]){
   const crate=new THREE.Mesh(new THREE.BoxGeometry(bs,bs*.8,bs),new THREE.MeshStandardMaterial({color:bc,roughness:.6}));
   crate.position.set(-.86+i*.86+bx,.45+by,.02); storageCab.add(crate);
  }
 }
 const cabTopPlant=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshStandardMaterial({color:0x2f9e5f,roughness:.7}));
 cabTopPlant.position.set(.9,1.95,0); storageCab.add(cabTopPlant);
 storageCab.position.set(-17.2,0,3.8); storageCab.rotation.y=.62; scene.add(storageCab);
 // hai cột trụ có dải sáng đứng + đĩa đèn trần trên bệ điều phối
 for(const px of [-15.5,15.5]){
  const pillar=new THREE.Mesh(new THREE.CylinderGeometry(.34,.46,9.5,14),new THREE.MeshStandardMaterial({color:0x232838,roughness:.4,metalness:.55}));
  pillar.position.set(px,4.75,-7.6); scene.add(pillar);
  const pStrip=new THREE.Mesh(new THREE.BoxGeometry(.07,8.6,.07),new THREE.MeshBasicMaterial({color:0x57e6ff}));
  pStrip.position.set(px*.93,4.6,-7.15); scene.add(pStrip);
  const pRing=new THREE.Mesh(new THREE.TorusGeometry(.42,.03,8,20),new THREE.MeshBasicMaterial({color:0x8b5cf6}));
  pRing.rotation.x=Math.PI/2; pRing.position.set(px,8.9,-7.6); scene.add(pRing);
 }
 const ceilDisc=new THREE.Mesh(new THREE.CylinderGeometry(3.1,3.3,.18,40),new THREE.MeshStandardMaterial({color:0x1c2231,roughness:.4,metalness:.5}));
 ceilDisc.position.set(0,8.15,-.5); scene.add(ceilDisc);
 const ceilGlow=new THREE.Mesh(new THREE.TorusGeometry(2.7,.05,10,48),new THREE.MeshBasicMaterial({color:0xbfe9ff}));
 ceilGlow.rotation.x=Math.PI/2; ceilGlow.position.set(0,8.05,-.5); scene.add(ceilGlow);
 const sofaMat=new THREE.MeshStandardMaterial({color:0x2c3242,roughness:.85});
 const sofa=new THREE.Group();
 const sBase=new THREE.Mesh(new THREE.BoxGeometry(2.3,.42,.95),sofaMat); sBase.position.y=.3; sofa.add(sBase);
 const sBack=new THREE.Mesh(new THREE.BoxGeometry(2.3,.62,.24),sofaMat); sBack.position.set(0,.72,-.38); sofa.add(sBack);
 for(const sx of [-1.08,1.08]){const sArm=new THREE.Mesh(new THREE.BoxGeometry(.24,.55,.95),sofaMat); sArm.position.set(sx,.55,0); sofa.add(sArm);}
 sofa.position.set(-13.5,0,11.5); sofa.rotation.y=.55; scene.add(sofa);
 const backdrop=new THREE.Mesh(new THREE.CylinderGeometry(30,30,19,48,1,true,Math.PI-1.08,2.16),new THREE.MeshBasicMaterial({map:backdropTex,side:THREE.BackSide,fog:false}));
 backdrop.position.y=4.2; scene.add(backdrop);
 // --- bàn làm việc ---
 const deskMat=new THREE.MeshStandardMaterial({color:0x5a4630,roughness:.7});
 const deskHolos=[];
 const deskGroups=[]; // mọi nhóm bàn+ghế: phòng GLB giữ lại + nâng lên mặt sàn .18
 const deskScreens={}; // màn hình của từng trạm (mesh có map canvas) — để sáng lên khi trạm đó đang làm việc thật
 const deskLit=new Set(); // trạm đang có robot working (do __office3DSync cập nhật theo trạng thái thật)
 function buildDesk(stId){
  const st=OFFICE_STATIONS[stId],pos=officeWorld(st),grp=new THREE.Group();
  grp.userData.stationId=stId; // đích raycast cho thao tác điều robot (0.9.57)
  const owner=OFFICE_CAST.find(a=>a.station===stId);
  const accentCol=new THREE.Color(owner?owner.color:0x888888);
  /* 0.9.52 — lệnh của Sếp: robot làm việc phải NGỒI GHẾ ở bàn. Mọi trạm làm
   * việc (kể cả 6 trạm đội) dùng chung bộ bàn cong + màn hình + GHẾ như bàn
   * Sếp. Clip làm việc mặc định quay về InspectTablet (ngồi) nên bàn đứng
   * tích hợp trong GLB P16 không hiện — không còn cảnh hai bàn chồng nhau
   * như lý do gỡ bàn ở 0.9.50. Ghế được kéo lại gần (z .88 -> .28) để đệm
   * ghế nằm ĐÚNG dưới hông robot khi thân hạ .5 theo thế ngồi; trước đây
   * ghế lùi .88 nên robot "ngồi" lơ lửng trước ghế. */
  const mainTex=stId==='boss'?screenFor(owner?owner.id:'pm'):screenFor(stId);
  const shell=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.44,.74,24,1,false,Math.PI-.98,1.96),new THREE.MeshStandardMaterial({color:0x272b38,roughness:.45,metalness:.35}));
  shell.position.y=.37; grp.add(shell);
  const topD=new THREE.Mesh(new THREE.CylinderGeometry(1.46,1.46,.06,24,1,false,Math.PI-.98,1.96),new THREE.MeshStandardMaterial({color:0x171b26,roughness:.3,metalness:.4}));
  topD.position.y=.78; grp.add(topD);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(1.47,1.47,.04,24,1,true,Math.PI-.98,1.96),new THREE.MeshBasicMaterial({color:accentCol}));
  band.position.y=.83; grp.add(band);
  function monitor(wd,ht,tex,x,y,z,ry){
   const mon=new THREE.Group();
   const body=new THREE.Mesh(new THREE.BoxGeometry(wd,ht,.05),darkMat); mon.add(body);
   const scr=new THREE.Mesh(new THREE.PlaneGeometry(wd-.08,ht-.08),new THREE.MeshBasicMaterial({map:tex})); scr.position.z=.031; mon.add(scr); (deskScreens[stId]||(deskScreens[stId]=[])).push(scr);
   const neck=new THREE.Mesh(new THREE.BoxGeometry(.07,.3,.05),darkMat); neck.position.set(0,-ht/2-.12,-.03); mon.add(neck);
   const armJoint=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8),darkMat); armJoint.position.set(0,-ht/2-.02,-.06); mon.add(armJoint);
   mon.position.set(x,y,z); mon.rotation.y=ry; grp.add(mon); return mon;
  }
  const monitorArm=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,.62,8),darkMat); monitorArm.position.set(0,1.02,-.6); monitorArm.rotation.x=.25; grp.add(monitorArm);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.95,2.05,.09,36),new THREE.MeshStandardMaterial({color:0x141824,roughness:.35,metalness:.5,envMapIntensity:.7}));
  plinth.position.y=.045; grp.add(plinth);
  const plinthEdge=new THREE.Mesh(new THREE.TorusGeometry(1.98,.02,8,48),new THREE.MeshBasicMaterial({color:accentCol}));
  plinthEdge.rotation.x=Math.PI/2; plinthEdge.position.y=.09; grp.add(plinthEdge);
  const drawer=new THREE.Mesh(new THREE.BoxGeometry(.46,.52,.5),new THREE.MeshStandardMaterial({color:0x1d2230,roughness:.5,metalness:.35}));
  drawer.position.set(1.12,.3,.42); grp.add(drawer);
  for(const dy of [.42,.24]){const line=new THREE.Mesh(new THREE.BoxGeometry(.4,.015,.01),new THREE.MeshBasicMaterial({color:accentCol})); line.position.set(1.12,dy,.675); grp.add(line);}
  const drawerHandle=new THREE.Mesh(new THREE.BoxGeometry(.2,.025,.03),darkMat); drawerHandle.position.set(1.12,.33,.68); grp.add(drawerHandle);
  const underGlow=new THREE.Mesh(new THREE.BoxGeometry(1.7,.045,.05),new THREE.MeshBasicMaterial({color:accentCol}));
  underGlow.position.set(0,.14,-1.3); grp.add(underGlow);
  const kbTex=canvasTex(128,48,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='rgba(87,230,255,.85)';for(let r=0;r<3;r++)for(let i=0;i<12;i++)g.fillRect(4+i*10.4,4+r*13,8,9);});
  const holoKb=new THREE.Mesh(new THREE.PlaneGeometry(.64,.24),new THREE.MeshBasicMaterial({map:kbTex,transparent:true,opacity:.55,side:THREE.DoubleSide}));
  holoKb.position.set(0,.865,.28); holoKb.rotation.x=-1.25; grp.add(holoKb);
  if(['boss','script','publish'].includes(stId)){
   const pot=new THREE.Mesh(new THREE.CylinderGeometry(.055,.042,.09,10),new THREE.MeshStandardMaterial({color:0x8a5a34,roughness:.8})); pot.position.set(-.66,.885,.12); grp.add(pot);
   const leaf=new THREE.Mesh(new THREE.SphereGeometry(.085,10,8),new THREE.MeshStandardMaterial({color:0x2f9e5f,roughness:.7})); leaf.position.set(-.66,1.0,.12); grp.add(leaf);
  }
  monitor(1.18,.7,mainTex,0,1.42,-.62,0);
  monitor(.82,.52,screenTex,-1.02,1.32,-.34,.5);
  monitor(.82,.52,screenTex,1.02,1.32,-.34,-.5);
  const holo=new THREE.Mesh(new THREE.PlaneGeometry(.95,.52),new THREE.MeshBasicMaterial({map:mainTex,transparent:true,opacity:.45,side:THREE.DoubleSide}));
  holo.position.set(0,2.14,-.55); holo.rotation.x=-.18; holo.userData.baseY=2.14; holo.userData.phase=pos.x; holo.userData.stationId=stId; deskHolos.push(holo); grp.add(holo);
  const kb=new THREE.Mesh(new THREE.BoxGeometry(.72,.03,.26),darkMat); kb.position.set(0,.83,.28); grp.add(kb);
  const mug=new THREE.Mesh(new THREE.CylinderGeometry(.05,.045,.1,12),new THREE.MeshStandardMaterial({color:0xe8e8f2,roughness:.4})); mug.position.set(.58,.88,.18); grp.add(mug);
  const seat=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.08,18),darkMat); seat.position.set(0,.48,.28); grp.add(seat);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.44,8),darkMat); stem.position.set(0,.24,.28); grp.add(stem);
  const backr=new THREE.Mesh(new THREE.BoxGeometry(.56,.62,.07),darkMat); backr.position.set(0,.92,.52); backr.rotation.x=-.12; grp.add(backr);
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(2.35,.64),new THREE.MeshBasicMaterial({color:0x0a1220,transparent:true,opacity:.55}));
  plate.position.set(0,2.62,-.14); grp.add(plate);
  const plateEdge=new THREE.Mesh(new THREE.PlaneGeometry(2.35,.05),new THREE.MeshBasicMaterial({color:accentCol}));
  plateEdge.position.set(0,2.32,-.14); grp.add(plateEdge);
  const label=textSprite(st.label.replace(/^\S+\s/,''),{size:40,color:'#d7dcff',scale:[2.2,.55]}); label.position.set(0,2.62,-.1); grp.add(label);
  grp.position.set(pos.x,0,pos.z); grp.rotation.y=Math.PI;
  deskGroups.push(grp);
  scene.add(grp); return grp;
 }
 ['boss','news','script','image','media','review','publish'].forEach(buildDesk);
 // vòng sáng dưới sàn mỗi trạm + bệ điều phối trung tâm với cầu hologram
 for(const stId of ['boss','pm','news','script','image','media','review','publish']){
  const p2=officeWorld(OFFICE_STATIONS[stId]); const owner=OFFICE_CAST.find(a=>a.station===stId);
  const ringM=new THREE.Mesh(new THREE.RingGeometry(1.5,1.62,48),new THREE.MeshBasicMaterial({color:new THREE.Color(owner?owner.color:0x2dd4ee),transparent:true,opacity:.30,side:THREE.DoubleSide}));
  ringM.rotation.x=-Math.PI/2; ringM.position.set(p2.x,.015,p2.z); scene.add(ringM);
 }
 // huy hiệu trung tâm + đường sáng dẫn lối từ bệ điều phối tới từng bàn
 const medallionTex=canvasTex(512,512,(g,w,h)=>{
  g.clearRect(0,0,w,h);
  g.strokeStyle='rgba(87,230,255,.9)'; g.lineWidth=5; g.beginPath(); g.arc(256,256,238,0,7); g.stroke();
  g.strokeStyle='rgba(139,92,246,.75)'; g.lineWidth=3; g.beginPath(); g.arc(256,256,206,0,7); g.stroke();
  g.strokeStyle='rgba(87,230,255,.5)'; g.lineWidth=2;
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2; g.beginPath(); g.moveTo(256+Math.cos(a)*168,256+Math.sin(a)*168); g.lineTo(256+Math.cos(a)*200,256+Math.sin(a)*200); g.stroke();}
  g.fillStyle='rgba(87,230,255,.85)'; g.font='bold 92px system-ui'; g.textAlign='center'; g.textBaseline='middle'; g.fillText('AI',256,262);
 });
 const medallion=new THREE.Mesh(new THREE.CircleGeometry(3.3,48),new THREE.MeshBasicMaterial({map:medallionTex,transparent:true,opacity:.85,side:THREE.DoubleSide}));
 medallion.rotation.x=-Math.PI/2; medallion.position.set(0,.014,-.88); scene.add(medallion);
 for(const stId of ['boss','news','script','image','media','review','publish']){
  const p3=officeWorld(OFFICE_STATIONS[stId]);
  const dx=p3.x-0, dz=p3.z-(-.88), len=Math.hypot(dx,dz)-3.4;
  if(len<1) continue;
  const stripGeo=new THREE.PlaneGeometry(.42,len); stripGeo.rotateX(-Math.PI/2);
  const strip=new THREE.Mesh(stripGeo,new THREE.MeshBasicMaterial({color:0x2dd4ee,transparent:true,opacity:.16,side:THREE.DoubleSide}));
  strip.position.set(dx/2,.013,-.88+dz/2); strip.rotation.y=Math.atan2(dx,dz); scene.add(strip);
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
   const baseRing=new THREE.Mesh(new THREE.TorusGeometry(.62,.022,8,28),new THREE.MeshBasicMaterial({color:0x2dd4ee})); baseRing.rotation.x=Math.PI/2; baseRing.position.set(off,.1,0); podGroup.add(baseRing);
   const statusDot=new THREE.Mesh(new THREE.SphereGeometry(.05,10,8),new THREE.MeshBasicMaterial({color:[0x34d399,0xfacc15,0x57e6ff][[-1.15,0,1.15].indexOf(off)]||0x34d399})); statusDot.position.set(off,2.36,0); podGroup.add(statusDot);
  }
  const podSign=textSprite('🔋 PHÒNG NẠP NĂNG LƯỢNG',{size:36,color:'#7df0c8',scale:[3.8,.82]}); podSign.position.set(0,2.95,0); podGroup.add(podSign);
  podGroup.position.set(podPos.x,0,podPos.z); scene.add(podGroup);
 }
 /* 10 ô sạc theo lưới 2 hàng × 5 cột quanh điểm neo phòng nạp (0.9.57):
  * trường baySlot của đội bot (office-fleet) cuối cùng cũng lái vị trí —
 * mỗi robot một ô riêng, không còn đứng chồng lên nhau ở một điểm neo. */
 function officePodSlotPos(slot){
  const s=Math.max(0,Math.min(9,slot|0));
  return {x:podPos.x+(s%5-2)*1.15, z:podPos.z+(Math.floor(s/5)===0?-0.9:0.9)};
 }
 const podSlotGroup=new THREE.Group(); podSlotGroup.userData.keepInGlb=true; // giữ lại khi phòng GLB ẩn đồ thủ tục
 const podSlotMeshes=[];
 {
  const ringMat=new THREE.MeshBasicMaterial({color:0x2dd4ee,transparent:true,opacity:.45,side:THREE.DoubleSide});
  for(let s=0;s<10;s++){
   const p=officePodSlotPos(s);
   const ring=new THREE.Mesh(new THREE.RingGeometry(.34,.44,28),ringMat);
   ring.rotation.x=-Math.PI/2; ring.position.set(p.x,.03,p.z); ring.userData.slot=s; ring.name='OfficePodSlot'+s;
   podSlotGroup.add(ring); podSlotMeshes.push(ring);
  }
 }
 scene.add(podSlotGroup);
 /* 0.9.58 — đồ trang trí Kenney Furniture Kit (CC0, xem
  * THIRD_PARTY_ASSETS.md): sofa + thảm + kệ sách + đèn sàn + cây cảnh đặt
  * ở MÉP phòng (ngoài vùng trạm x ±17 / z ±11 và ngoài trục camera mặc
  * định) cho phòng có sức sống mà không che robot hay trạm nào. */
 const propGroup=new THREE.Group(); propGroup.userData.keepInGlb=true; scene.add(propGroup);
 import('/vendor/addons/GLTFLoader.js').then(async ({GLTFLoader})=>{
  const propLoader=new GLTFLoader();
  const placeProp=async (file,x,z,rotY,scale)=>{ try{ const g=await propLoader.loadAsync('/assets/props/kenney/'+file); const o=g.scene; o.position.set(x,0,z); o.rotation.y=rotY||0; if(scale)o.scale.setScalar(scale); o.traverse(m=>{if(m.isMesh){m.castShadow=true; m.receiveShadow=true;}}); propGroup.add(o); }catch(e){ console.warn('Prop Kenney lỗi:',file,e); } };
  await placeProp('rugRound.glb',-19.5,-5.5,0,1.6);
  await placeProp('loungeSofa.glb',-19.5,-5.9,0.5,1);
  await placeProp('bookcaseOpen.glb',20,-8,-1.1,1.15);
  await placeProp('lampRoundFloor.glb',19.6,6.8,0,1);
  await placeProp('plantSmall1.glb',-20,3.2,0,1.4);
  await placeProp('pottedPlant.glb',-15.8,-9.8,0,1.2);
  await placeProp('plantSmall1.glb',20.2,-2.5,0,1.2);
  window.__officeBeauty.props=propGroup.children.length;
 }).catch(()=>{});
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
  const warnTex=canvasTex(128,16,(g,w,h)=>{for(let i=0;i<8;i++){g.fillStyle=i%2?'#0c0c10':'#ffd94d';g.save();g.translate(i*16,0);g.transform(1,0,-.5,1,8,0);g.fillRect(0,0,16,h);g.restore();}});
  warnTex.wrapS=THREE.RepeatWrapping; warnTex.repeat.set(4,1);
  for(const [wx,wz,wr] of [[0,1.42,0],[0,-1.42,0],[1.42,0,Math.PI/2],[-1.42,0,Math.PI/2]]){
   const wst=new THREE.Mesh(new THREE.BoxGeometry(2.9,.07,.16),new THREE.MeshBasicMaterial({map:warnTex}));
   wst.position.set(wx,.035,wz); wst.rotation.y=wr; cage.add(wst);
  }
  const sign=textSprite('⚡ PHÒNG CHÍCH ĐIỆN',{size:40,color:'#ffd94d',scale:[3.4,.8]}); sign.position.set(0,3.25,0); cage.add(sign);
  cage.position.set(cagePos.x,0,cagePos.z); scene.add(cage);
 }
 // --- mặt robot có biểu cảm (vẽ bằng canvas): đang làm / rảnh / ngủ sạc / bị chích ---
 function faceTexture(mode){
  const c=document.createElement('canvas'); c.width=256; c.height=192; const g=c.getContext('2d');
  g.fillStyle='#101a2c'; g.beginPath(); g.roundRect(30,24,196,144,58); g.fill();
  g.strokeStyle='rgba(87,230,255,.28)'; g.lineWidth=3; g.beginPath(); g.roundRect(30,24,196,144,58); g.stroke();
  g.fillStyle='#7df0ff'; g.strokeStyle='#7df0ff'; g.lineWidth=16; g.lineCap='round';
  const eye=(x,y)=>{ if(mode==='zap'){g.beginPath();g.moveTo(x-13,y-13);g.lineTo(x+13,y+13);g.moveTo(x+13,y-13);g.lineTo(x-13,y+13);g.stroke();}
   else if(mode==='sleep'||mode==='blink'){g.beginPath();g.arc(x,y-4,17,Math.PI*.15,Math.PI*.85);g.stroke();}
   else if(mode==='work'){g.beginPath();g.arc(x,y+6,17,Math.PI*1.1,Math.PI*1.9);g.stroke();}
   else {g.beginPath();g.arc(x,y,11,0,Math.PI*2);g.fill();} };
  eye(88,84); eye(168,84);
  g.lineWidth=8; g.beginPath();
  if(mode==='zap'){g.moveTo(104,140);g.lineTo(118,131);g.lineTo(132,140);g.lineTo(146,131);g.stroke();}
  else if(mode==='sleep'){g.arc(128,130,7,0,Math.PI*2);g.stroke();}
  else {g.arc(128,114,16,Math.PI*.2,Math.PI*.8);g.stroke();}
  return new THREE.CanvasTexture(c);
 }
 const faceTexCache={work:faceTexture('work'),idle:faceTexture('idle'),sleep:faceTexture('sleep'),zap:faceTexture('zap'),blink:faceTexture('blink')};
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
  const mat=new THREE.MeshStandardMaterial({color:new THREE.Color(a.color),roughness:.38,envMapIntensity:.6});
  const white=new THREE.MeshStandardMaterial({color:0xf4f6fb,roughness:.22,envMapIntensity:.7});
  const joint=new THREE.MeshStandardMaterial({color:0x2b2f3a,roughness:.45,metalness:.35});
  const glowMat=new THREE.MeshBasicMaterial({color:new THREE.Color(a.color)});
  function buildLeg(sx){
   const leg=new THREE.Group(); leg.position.set(sx*.13,.98,0);
   const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.088,.24,4,10),white); thigh.position.y=-.2; leg.add(thigh);
   const knee=new THREE.Mesh(new THREE.SphereGeometry(.082,12,10),joint); knee.position.y=-.44; leg.add(knee);
   const shinG=new THREE.Group(); shinG.position.y=-.44; leg.add(shinG);
   const shin=new THREE.Mesh(new THREE.CapsuleGeometry(.068,.22,4,10),white); shin.position.y=-.22; shinG.add(shin);
   const ankleRing=new THREE.Mesh(new THREE.TorusGeometry(.075,.012,8,16),mat); ankleRing.rotation.x=Math.PI/2; ankleRing.position.y=-.4; shinG.add(ankleRing);
   const foot=new THREE.Mesh(new THREE.SphereGeometry(.115,12,10),joint); foot.scale.set(1,.5,1.55); foot.position.set(0,-.48,.05); shinG.add(foot);
   grp.add(leg); return {leg,shinG};
  }
  const L1=buildLeg(-1),L2=buildLeg(1); const legL=L1.leg,legR=L2.leg,shinL=L1.shinG,shinR=L2.shinG;
  const pelvis=new THREE.Mesh(new THREE.SphereGeometry(.24,18,14),joint); pelvis.scale.set(1.15,.72,1); pelvis.position.y=1.02; grp.add(pelvis);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.30,.24,.5,20),white); torso.position.y=1.33; grp.add(torso);
  const chestPlate=new THREE.Mesh(new THREE.BoxGeometry(.4,.38,.07),mat); chestPlate.position.set(0,1.38,.24); chestPlate.rotation.x=-.06; grp.add(chestPlate);
  const glyphTex=canvasTex(96,96,(g)=>{g.clearRect(0,0,96,96);g.font='64px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillText(a.emoji,48,52);});
  const glyph=new THREE.Mesh(new THREE.PlaneGeometry(.19,.19),new THREE.MeshBasicMaterial({map:glyphTex,transparent:true})); glyph.position.set(0,1.38,.285); glyph.rotation.x=-.06; grp.add(glyph);
  const chestLight=new THREE.Mesh(new THREE.CircleGeometry(.04,14),new THREE.MeshBasicMaterial({color:0x9ff3ff})); chestLight.position.set(0,1.6,.265); grp.add(chestLight);
  const belt=new THREE.Mesh(new THREE.TorusGeometry(.245,.03,8,24),mat); belt.rotation.x=Math.PI/2; belt.position.y=1.09; grp.add(belt);
  const pack=new THREE.Mesh(new THREE.BoxGeometry(.36,.46,.15),joint); pack.position.set(0,1.35,-.26); grp.add(pack);
  const packStripe=new THREE.Mesh(new THREE.BoxGeometry(.37,.07,.16),mat); packStripe.position.set(0,1.53,-.26); grp.add(packStripe);
  for(const dx of [-.09,.09]){const dot=new THREE.Mesh(new THREE.CircleGeometry(.026,10),glowMat); dot.position.set(dx,1.28,-.34); dot.rotation.y=Math.PI; grp.add(dot);}
  function buildArm(sx){
   const arm=new THREE.Group(); arm.position.set(sx*.37,1.52,0);
   const pad=new THREE.Mesh(new THREE.SphereGeometry(.13,14,12),mat); pad.scale.set(1,.8,1); pad.position.y=.02; arm.add(pad);
   const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.2,4,10),mat); upper.position.y=-.18; arm.add(upper);
   const elbow=new THREE.Mesh(new THREE.SphereGeometry(.065,10,8),joint); elbow.position.y=-.36; arm.add(elbow);
   const fore=new THREE.Mesh(new THREE.CapsuleGeometry(.06,.18,4,10),white); fore.position.y=-.5; arm.add(fore);
   const wrist=new THREE.Mesh(new THREE.TorusGeometry(.062,.011,8,16),mat); wrist.rotation.x=Math.PI/2; wrist.position.y=-.6; arm.add(wrist);
   const hand=new THREE.Mesh(new THREE.SphereGeometry(.075,10,8),white); hand.position.y=-.68; arm.add(hand);
   grp.add(arm); return arm;
  }
  const armL=buildArm(-1),armR=buildArm(1);
  officeAttachProp(a,armR,mat,white,joint);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.12,12),joint); neck.position.y=1.68; grp.add(neck);
  const neckRing=new THREE.Mesh(new THREE.TorusGeometry(.115,.014,8,20),glowMat); neckRing.rotation.x=Math.PI/2; neckRing.position.y=1.68; grp.add(neckRing);
  const head=new THREE.Group(); head.position.y=2.0;
  const skull=new THREE.Mesh(new THREE.SphereGeometry(.40,28,22),white); skull.scale.y=.94; head.add(skull);
  const crest=new THREE.Mesh(new THREE.BoxGeometry(.07,.03,.36),mat); crest.position.set(0,.39,-.02); head.add(crest);
  for(const sx of [-1,1]){
   const earPod=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.07,16),white); earPod.rotation.z=Math.PI/2; earPod.position.set(sx*.40,0,0); head.add(earPod);
   const earRing=new THREE.Mesh(new THREE.TorusGeometry(.08,.015,8,20),glowMat); earRing.rotation.y=Math.PI/2; earRing.position.set(sx*.445,0,0); head.add(earRing);
   const vent=new THREE.Mesh(new THREE.BoxGeometry(.02,.09,.06),joint); vent.position.set(sx*.40,-.17,.02); head.add(vent);
  }
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.2,6),joint); ant.position.y=.46; head.add(ant);
  const antBall=new THREE.Mesh(new THREE.SphereGeometry(.055,10,8),glowMat); antBall.position.y=.6; head.add(antBall);
  const visor=new THREE.Mesh(new THREE.SphereGeometry(.40,28,22),new THREE.MeshStandardMaterial({color:0x0b1220,roughness:.06,metalness:.15,envMapIntensity:1.7}));
  visor.scale.set(.86,.8,.62); visor.position.z=.09; head.add(visor);
  const faceMat=new THREE.MeshBasicMaterial({map:faceTexCache.idle,transparent:true});
  const face=new THREE.Mesh(new THREE.PlaneGeometry(.60,.44),faceMat); face.position.set(0,-.02,.362); head.add(face);
  grp.add(head);
  if(a.id==='boss'){
   const gold=new THREE.MeshStandardMaterial({color:0xf5c542,roughness:.3,metalness:.6});
   const crown=new THREE.Mesh(new THREE.CylinderGeometry(.18,.21,.1,12,1,true),gold); crown.position.y=.44; head.add(crown);
   const tie=new THREE.Mesh(new THREE.BoxGeometry(.09,.24,.02),gold); tie.position.set(0,1.26,.29); grp.add(tie);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(.44,.58,40),new THREE.MeshBasicMaterial({color:new THREE.Color(a.color),transparent:true,opacity:.95,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2; ring.position.y=.02; ring.visible=false; grp.add(ring);
  // Vòng chọn màu vàng (0.9.57): robot đang được Sếp chọn để điều đi nơi khác.
  const selRing=new THREE.Mesh(new THREE.RingGeometry(.56,.68,40),new THREE.MeshBasicMaterial({color:0xffcf4d,transparent:true,opacity:.95,side:THREE.DoubleSide}));
  selRing.rotation.x=-Math.PI/2; selRing.position.y=.035; selRing.visible=false; grp.add(selRing);
  const nameSp=textSprite(officePlateName(a),{size:46,scale:[2.3,.58]}); nameSp.position.y=2.98; grp.add(nameSp);
  const zzz=textSprite('💤',{size:52,bg:'rgba(0,0,0,0)',scale:[.7,.45]}); zzz.position.set(.66,2.66,0); zzz.visible=false; grp.add(zzz);
  scene.add(grp);
  return {a,grp,legL,legR,shinL,shinR,armL,armR,ring,selRing,nameSp,zzz,faceMat,faceMode:'idle',name:officePlateName(a),target:new THREE.Vector3(),walking:false,busy:false,phase:Math.random()*7,sit:0,postKind:null,postId:null,pinned:false,stateDriven:false};
 }
 function officeWrapProcedural(A){
  if(A.procBody)return;
  const keep=new Set([A.nameSp,A.zzz,A.ring,A.selRing]);
  const proc=new THREE.Group();proc.name='ProceduralBody';
  [...A.grp.children].forEach(ch=>{if(!keep.has(ch))proc.add(ch);});
  A.grp.add(proc);A.procBody=proc;
 }
 const agents={}; for(const a of officeRosterCast()){
  const built=buildAgent(a);const home=officeWorld(OFFICE_STATIONS[a.station]);
  built.grp.position.set(home.x,0,home.z);built.target.copy(built.grp.position);
  built.baseY=0;built.yCur=0;officeWrapProcedural(built);agents[a.id]=built;
 }
 let tamTemplate=null,tamClipList=null,tamCloneFn=null,tamBusy=false;
 const TAM_NATIVE_H=1.6137,TAM_TARGET_H=1.9;
 let clipLogic=null; import('/office-clip.mjs').then(m=>{clipLogic=m;}).catch(e=>{console.warn('Không nạp được logic clip phòng 3D — dùng quy tắc dự phòng:',e);});
 let officeMotion=null;
 const officeMotionPromise=import('/office-motion.mjs').then(m=>{officeMotion=m;window.__officeNavReady=true;return m;}).catch(e=>{console.warn('Không nạp được office motion:',e);return null;});
 function officePlayClip(A,want){
  const M=A.model; if(!M||M.current===want)return;
  const clip=M.clips[want]||M.clips.idle;
  if(M.action){try{M.action.fadeOut(.22);}catch{}}
  if(!clip||!A.mixer){M.current=want;M.action=null;return;}
  const act=A.mixer.clipAction(clip);
  act.reset(); act.enabled=true;
  if(['cheer','sitDown','standUp'].includes(want)){act.setLoop(THREE.LoopOnce,1); act.clampWhenFinished=true;}
  else{act.setLoop(THREE.LoopRepeat,Infinity); act.clampWhenFinished=false;}
  act.fadeIn(.22); act.play();
  M.action=act; M.current=want;
 }
 let gltfLoaderPromise=null;
 async function officeLoadModel(A){
  try{
   const list=await (await fetch('/api/office/models')).json();
   const has=(list.models||[]).some(m=>m.id===A.a.id);
   if(!has){
    if(A.model&&A.model.source==='upload'){
     if(A.modelRoot){A.grp.remove(A.modelRoot);A.modelRoot=null;}
     A.model=null;A.mixer=null;
    }
    if(tamTemplate)officeAttachTam(A);
    else if(A.procBody)A.procBody.visible=true;
    return;
   }
   if(!gltfLoaderPromise)gltfLoaderPromise=import('/vendor/addons/GLTFLoader.js').then(m=>new m.GLTFLoader());
   const loader=await gltfLoaderPromise;
   const gltf=await loader.loadAsync('/api/office/models/'+A.a.id+'/file');
   const root=gltf.scene;
   const box=new THREE.Box3().setFromObject(root); const size=box.getSize(new THREE.Vector3());
   if(size.y>0)root.scale.setScalar(2.0/size.y);
   const box2=new THREE.Box3().setFromObject(root); root.position.y-=box2.min.y;
   root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
   if(A.modelRoot)A.grp.remove(A.modelRoot);
   A.bend=null;
   A.grp.add(root); A.modelRoot=root;
   if(!clipLogic)clipLogic=await import('/office-clip.mjs');
   const names=(gltf.animations||[]).map(c=>c.name);
   const clips={};
   for(const want of clipLogic.OFFICE_CLIPS){const found=clipLogic.officeResolveClip(names,want); if(found)clips[want]=gltf.animations.find(c=>c.name===found);}
   // Sếp duyệt việc bằng InspectTablet như cũ — không dùng chu trình bàn
   // đứng WorkCycle dù model có clip đó.
   if(A.a.id==='boss'){const it=(gltf.animations||[]).find(c=>clipLogic.officeClipKey(c.name)==='inspecttablet'); if(it)clips.work=it;}
   const namesByIntent={sitDown:['Sit_Down','SitDown'],standUp:['Stand_Up','StandUp'],seatedIdle:['Seated_Idle','SittingIdle','Sit_Idle'],seatedWork:['Type_Keyboard','Seated_Work','Review_Document']};
   for(const [intent,candidates] of Object.entries(namesByIntent)){
    const clip=(gltf.animations||[]).find(c=>candidates.includes(c.name));
    if(clip)clips[intent]=clip;
   }
   A.mixer=new THREE.AnimationMixer(root);
   A.model={clips,current:null,action:null,source:'upload',hasSeatClips:Boolean(clips.sitDown&&clips.standUp&&clips.seatedIdle)};
   A.workClipName=clips.work?clips.work.name:null;
   A.standingDesk=!A.model.hasSeatClips&&['WorkCycle','Typing','Mouse','TabletTouch'].includes(A.workClipName||'');
   if(A.procBody)A.procBody.visible=false;
  }catch(e){console.warn('Không nạp được model 3D cho',A.a.id,e);}
 }
 window.__office3DLoadModels=()=>{for(const id in agents){if(officeFleetActive()&&id!=='boss')continue; officeLoadModel(agents[id]);}};
 window.__office3DLoadModels();
 // Keep the model template loaded even when no external fleet account exists.
 // officeEnsureTam is defined later, but function declarations are hoisted.
 officeEnsureTam();
 scene.traverse(o=>{if(o.isMesh&&o.material&&o.material.isMeshStandardMaterial&&!o.material.transparent){o.castShadow=true;o.receiveShadow=true;}});
 floor.receiveShadow=true;
 // đường chấm khi di chuyển + gói hàng
 function officeMakePath(A){
  if(A.path)return;
  const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]);
  const line=new THREE.Line(geo,new THREE.LineDashedMaterial({color:new THREE.Color(A.a.color),dashSize:.22,gapSize:.14,transparent:true,opacity:.6}));
  line.visible=false;scene.add(line);A.path=line;
 }
 for(const id in agents)officeMakePath(agents[id]);
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
 window.__office3DModelInfo=()=>Object.fromEntries(Object.entries(agents).map(([id,A])=>[id,{clip:A.model?A.model.current:null,clipName:(A.model&&A.model.action&&A.model.action.getClip)?A.model.action.getClip().name:null,workClip:A.workClipName||null,standing:Boolean(A.standingDesk),seated:A.motionPhase==='seated',phase:A.motionPhase||'standing',routeLeft:Math.max(0,(A.routePoints||[]).length-(A.routeStep||0)),sit:Math.round((A.sit||0)*100)/100,station:A.station||null,post:A.postKind||null,postId:A.postId||null,pinned:Boolean(A.pinned),stateDriven:Boolean(A.stateDriven),pos:[Math.round(A.grp.position.x*10)/10,Math.round(A.grp.position.z*10)/10],walking:Boolean(A.walking)}]));
 window.__office3DSync=(ctx)=>{
  office3DReconcile();
  const roster=officeRosterCast();
  const posts=officeResolvePosts(roster);
  deskLit.clear();
  for(const a of roster){
   const A=agents[a.id]; if(!A)continue;
   const post=posts.get(a.id)||{kind:'pod',slot:0};
   const stId=post.kind==='desk'||post.kind==='station'?post.id:post.kind==='cage'?'cage':post.kind==='floor'?'floor':'lounge';
   let tx,tz;
   if(post.kind==='desk'||post.kind==='station'){const w=officeWorld(OFFICE_STATIONS[post.id]||OFFICE_STATIONS.lounge); tx=w.x; tz=w.z;}
   else if(post.kind==='cage'){const w=officeWorld(OFFICE_STATIONS.cage); tx=w.x; tz=w.z;}
   else if(post.kind==='floor'){tx=post.x; tz=post.z;}
   else {const s=officePodSlotPos(post.slot||0); tx=s.x; tz=s.z;}
   const dg=(post.kind==='desk'||post.kind==='station')?deskGroups.find(g=>g.userData.stationId===post.id):null;
   const oldDesk=A.seatStation||null;
   const newDesk=dg?{x:dg.position.x,z:dg.position.z,yaw:dg.rotation.y}:null;
   if(newDesk){
    // local seat z=.28; the desk is rotated 180 degrees in this room.
    const seat=officeMotion?officeMotion.officeChairPoint(newDesk):{x:newDesk.x,z:newDesk.z-.28,yaw:0};
    tx=seat.x;tz=seat.z;A.facingYaw=seat.yaw;
   }else A.facingYaw=0;
   const destKey=[post.kind,post.id||post.slot||'',tx.toFixed(2),tz.toFixed(2)].join(':');
   const changed=A.navKey!==destKey;
   if(changed){
    const leavingSeat=A.motionPhase==='seated'||A.motionPhase==='sitting';
    if(leavingSeat&&A.navKey)A.leaveSeat=true;
    const obstacleDesks=deskGroups.map(g=>({x:g.position.x,z:g.position.z,yaw:g.rotation.y,r:1.52}));
    const points=(officeMotion&&A.navKey)?officeMotion.officeRoute(
     {x:A.grp.position.x,z:A.grp.position.z},{x:tx,z:tz},obstacleDesks,
     {fromDesk:leavingSeat?oldDesk:null,toDesk:newDesk}
    ):[{x:tx,z:tz}];
    A.routePoints=points.map(v=>new THREE.Vector3(v.x,0,v.z));
    A.routeStep=0;A.navKey=destKey;A.moveSpeed=0;
   }
   A.seatStation=newDesk;A.seatWanted=Boolean(newDesk);
   A.target.set(tx,0,tz);
   A.baseY=(post.kind==='desk'||post.kind==='station')?officeYFor(post.id):post.kind==='floor'?((Math.abs(tx)<=12.6&&Math.abs(tz)<=12.6)?officeRoomDeckY:0):0;
   A.station=stId; A.postKind=post.kind; A.postId=post.kind==='desk'||post.kind==='station'?post.id:post.kind==='pod'?('pod'+(post.slot||0)):post.kind;
   A.pinned=Boolean(post.pinned); A.stateDriven=Boolean(post.stateDriven);
   if(A.selRing)A.selRing.visible=(officeSelectedId===a.id);
   A.busy=a.fleet?a.fleet.state==='working':((a.id==='boss'&&Boolean(ctx.awaiting))||(a.id==='media'&&ctx.stage==='produce')||(a.id==='script'&&ctx.stage==='script')||(a.id==='publish'&&ctx.stage==='publish')||(ctx.culprit&&ctx.culprit.agentId===a.id));
   if((post.kind==='desk'||post.kind==='station')&&A.busy)deskLit.add(post.id);
   A.ring.visible=A.busy;
   if((ctx.culprit&&ctx.culprit.agentId===a.id)||(a.fleet&&a.fleet.cage))A.ring.material.color.set(0xff4545); else A.ring.material.color.set(a.color);
   const sleeping=stId==='lounge'&&!(ctx.culprit&&ctx.culprit.agentId===a.id);
   if(A.zzz)A.zzz.visible=sleeping;
   const fm=(a.fleet&&!a.fleet.standby)?((a.fleet.cage||a.fleet.state==='failed')?'zap':a.fleet.state==='working'?'work':post.kind==='desk'?'idle':post.kind==='pod'?'sleep':'idle'):((ctx.culprit&&ctx.culprit.agentId===a.id)?'zap':sleeping?'sleep':A.busy?'work':'idle');
   if(A.faceMat&&A.faceMode!==fm){A.faceMat.map=faceTexCache[fm];A.faceMat.needsUpdate=true;}
   A.faceMode=fm;
   const nm=officePlateName(a);
   if(nm!==A.name){A.name=nm; const parent=A.nameSp.parent; const idx=parent.children.indexOf(A.nameSp); const fresh=textSprite(nm,{size:46,scale:[2.3,.58]}); fresh.position.y=2.85; parent.remove(A.nameSp); parent.add(fresh); A.nameSp=fresh;}
  }
  window.__office3DGlow=()=>[...deskLit];
  zapId=officeFleetActive()?(officeState.fleet.bots.find(b=>b.cage)?'bot-'+officeState.fleet.bots.find(b=>b.cage).connectionId:null):(ctx.culprit?ctx.culprit.agentId:null);
  const target=officeFleetActive()?(ctx.awaiting?'boss':(officeState.fleet.bots.find(b=>b.state==='working')?.station||null)):(ctx.awaiting?'boss':ctx.activeRun?(ctx.stage==='produce'?'media':ctx.stage==='publish'?'publish':ctx.stage==='script'?'script':'pm'):null);
  if(target){const w=officeWorld(OFFICE_STATIONS[target]); parcelTarget.set(w.x+.8,1.15,w.z-.4); parcel.visible=true;} else parcel.visible=false;
  officeBotCardRefresh();
 };
 /* Thẻ robot đang chọn (0.9.57): bấm vào một robot → hiện thẻ này với
  * tên, trạng thái và các nút [Đổi tên] [↩ Về tự động] [✕]. Đổi tên dời
  * về đây (trước đây bấm vào robot là đổi tên ngay). Sếp Lâm chọn/đổi tên
  * được nhưng KHÔNG bị điều đi — chỗ của Sếp do trạng thái quyết định. */
 let officeSelectedId=null;
 const botCard=document.createElement('div');
 botCard.className='office-bot-card'; botCard.hidden=true;
 botCard.innerHTML=`<div class="obc-head"><strong data-obc-name></strong><button type="button" class="obc-x" data-obc-act="close" aria-label="Đóng thẻ">✕</button></div><p data-obc-state></p><p class="obc-pin" data-obc-pin></p><div class="obc-actions"><button type="button" data-obc-act="rename">Đổi tên</button><button type="button" data-obc-act="auto">↩ Về tự động</button></div><p class="obc-hint">Bấm vào một bàn, một vòng ô sạc hoặc một điểm trên sàn để điều robot này tới đó. Trạng thái thật (đang làm việc / lỗi / nghỉ sạc) luôn thắng điểm ghim — ghim tự áp dụng lại khi trạng thái qua đi.</p>`;
 room.appendChild(botCard);
 function officeSelectedAgent(){return officeSelectedId?agents[officeSelectedId]||null:null;}
 function officeSelectBot(id){officeSelectedId=id||null; for(const k in agents)if(agents[k].selRing)agents[k].selRing.visible=(k===officeSelectedId); officeBotCardRefresh();}
 window.__office3DSelect=officeSelectBot;
 function officeBotCardRefresh(){
  const A=officeSelectedAgent(); if(!A){botCard.hidden=true; return;}
  const a=A.a; botCard.hidden=false;
  botCard.querySelector('[data-obc-name]').textContent='🤖 '+officePlateName(a);
  botCard.querySelector('[data-obc-state]').textContent=a.role||'';
  const pinEl=botCard.querySelector('[data-obc-pin]');
  const autoBtn=botCard.querySelector('[data-obc-act="auto"]');
  const pin=officeLoadPins()[a.id];
  if(a.id==='boss')pinEl.textContent='Sếp Lâm luôn ở bàn của Sếp — chỉ đổi tên được, không điều đi nơi khác.';
  else if(A.stateDriven)pinEl.textContent='Vị trí hiện tại do trạng thái thật quyết định (đang làm việc / lỗi / nghỉ sạc) — điểm ghim sẽ tự áp dụng khi trạng thái đó qua đi.';
  else if(pin)pinEl.textContent='📌 Đang ghim ở '+(pin.kind==='desk'?('bàn '+pin.id):pin.kind==='pod'?('ô sạc số '+(pin.slot+1)):'một điểm trên sàn')+' theo lệnh của Sếp.';
  else pinEl.textContent='Đang ở vị trí tự động theo trạng thái.';
  autoBtn.disabled=!pin||a.id==='boss';
  botCard.querySelector('.obc-hint').style.display=(a.id==='boss')?'none':'';
 }
 botCard.addEventListener('click',e=>{
  const btn=e.target.closest('[data-obc-act]'); if(!btn)return;
  const A=officeSelectedAgent(); if(!A)return;
  const a=A.a;
  if(btn.dataset.obcAct==='close'){officeSelectBot(null); return;}
  if(btn.dataset.obcAct==='auto'){const pins=officeLoadPins(); delete pins[a.id]; officeSavePins(pins); toast('↩ '+officePlateName(a)+' đã về chế độ tự động.'); officeBotCardRefresh(); return;}
  if(btn.dataset.obcAct==='rename'){const next=prompt(`Đổi tên cho ${a.role}:`,officeAgentName(a)); if(next&&next.trim()){officeNames[a.id]=next.trim().slice(0,24); localStorage.setItem('aios-office-names',JSON.stringify(officeNames)); officeRender(); officeBotCardRefresh();}}
 });
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
  /* Bấm vào một robot → CHỌN nó (0.9.57; đổi tên dời vào thẻ chọn).
   * Bấm lại chính robot đang chọn → bỏ chọn. */
  const hits=ray.intersectObjects(Object.values(agents).map(A=>A.grp),true);
  if(hits.length){let o=hits[0].object;while(o&&!Object.values(agents).some(A=>A.grp===o))o=o.parent;
   if(o){const A=Object.values(agents).find(x=>x.grp===o); if(A)officeSelectBot(officeSelectedId===A.a.id?null:A.a.id); return;}}
  /* Có robot đang chọn → bấm vào bàn / vòng ô sạc / điểm sàn là ĐIỀU nó
   * tới đó (ghim lưu ở localStorage 'aios-office-pins'). Sếp Lâm không
   * bị điều đi. Vị trí theo trạng thái thật vẫn thắng ghim (xem
   * officeResolvePosts). */
  const sel=officeSelectedAgent();
  if(sel&&sel.a.id!=='boss'){
   const dh=ray.intersectObjects(deskGroups,true);
   if(dh.length){let g=dh[0].object; while(g&&!deskGroups.includes(g))g=g.parent;
    if(g&&g.userData.stationId&&OFFICE_DESK_POOL.includes(g.userData.stationId)){const pins=officeLoadPins(); pins[sel.a.id]={kind:'desk',id:g.userData.stationId}; officeSavePins(pins); toast(`📌 ${officePlateName(sel.a)} sẽ tới ngồi ở bàn ${g.userData.stationId} — nút "↩ Về tự động" trong thẻ robot thả nó về tự động.`); officeBotCardRefresh(); return;}}
   const ph=ray.intersectObjects(podSlotMeshes,false);
   if(ph.length){const pins=officeLoadPins(); pins[sel.a.id]={kind:'pod',slot:ph[0].object.userData.slot}; officeSavePins(pins); toast(`📌 ${officePlateName(sel.a)} sẽ về ô sạc số ${ph[0].object.userData.slot+1}.`); officeBotCardRefresh(); return;}
   const v=new THREE.Vector3();
   if(ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-officeRoomDeckY),v)){
    const pins=officeLoadPins(); pins[sel.a.id]={kind:'floor',x:Math.max(-16,Math.min(16,v.x)),z:Math.max(-10.5,Math.min(10.5,v.z))}; officeSavePins(pins); toast(`📌 ${officePlateName(sel.a)} sẽ đi tới điểm Sếp vừa chọn trên sàn.`); officeBotCardRefresh(); return;}
  }
  officeSelectBot(null);
 });
 el.addEventListener('wheel',e=>{e.preventDefault();orbit.radius=Math.min(48,Math.max(15,orbit.radius+e.deltaY*.02));},{passive:false});
 addEventListener('resize',()=>{renderer.setSize(W(),H()); if(officeComposer)officeComposer.setSize(W(),H());});
 // --- vòng lặp chuyển động ---
 const clockT=new THREE.Clock();
 renderer.setAnimationLoop(()=>{try{
  if(!office3DVisible||document.hidden||window.__office3DOff)return;
  const dt=Math.min(clockT.getDelta(),.05),t=clockT.elapsedTime;
  for(const id in agents){
   const A=agents[id],p=A.grp.position;
   if(!A.motionPhase)A.motionPhase='standing';
   const distGoal=Math.hypot(A.target.x-p.x,A.target.z-p.z);
   let waypoint=(A.routePoints||[])[A.routeStep||0]||null;
   while(waypoint&&Math.hypot(waypoint.x-p.x,waypoint.z-p.z)<.085){
    A.routeStep++;waypoint=(A.routePoints||[])[A.routeStep]||null;
   }
   const seatedPose=A.motionPhase==='sitting'||A.motionPhase==='seated';
   if(seatedPose&&A.leaveSeat){A.motionPhase='standingUp';A.poseClock=0;}
   let phase=A.motionPhase;
   A.walking=false;
   if(phase==='standingUp'){
    A.poseClock=(A.poseClock||0)+dt;
    const dur=A.model?.clips?.standUp?.duration||.98;
    A.sit=Math.max(0,1-A.poseClock/dur);
    if(A.poseClock>=dur){A.motionPhase='standing';A.poseClock=0;A.sit=0;A.leaveSeat=false;}
   }else if(phase==='sitting'){
    A.poseClock=(A.poseClock||0)+dt;
    const dur=A.model?.clips?.sitDown?.duration||1.05;
    A.sit=Math.min(1,A.poseClock/dur);
    if(A.poseClock>=dur){A.motionPhase='seated';A.poseClock=0;A.sit=1;A.seatedDestKey=A.navKey;}
   }else if(phase==='seated'){
    A.sit=1;
   }else if(waypoint){
    const vx=waypoint.x-p.x,vz=waypoint.z-p.z,dd=Math.hypot(vx,vz);
    const yaw=Math.atan2(vx,vz);
    let turn=yaw-A.grp.rotation.y;
    while(turn>Math.PI)turn-=Math.PI*2;
    while(turn<-Math.PI)turn+=Math.PI*2;
    const turnStep=Math.min(Math.abs(turn),dt*3.3);
    A.grp.rotation.y+=Math.sign(turn)*turnStep;
    // Rotate into the aisle before walking; no instantaneous sideways slide.
    if(Math.abs(turn)<.75){
     const fast=2.25,slow=Math.max(.6,Math.sqrt(dd*5.6));
     A.moveSpeed=Math.min(fast,slow,(A.moveSpeed||0)+dt*3.8);
     const step=Math.min(dd,A.moveSpeed*dt*(Math.abs(turn)>.35?.55:1));
     p.x+=vx/dd*step;p.z+=vz/dd*step;
     A.walking=step>0.0001;A.motionPhase='walking';
    }else{A.moveSpeed=0;A.motionPhase='turning';}
   }else{
    A.moveSpeed=0;
    const sittingHere=A.seatWanted&&distGoal<.12;
    const desiredYaw=sittingHere?(A.facingYaw||0):0;
    let turn=desiredYaw-A.grp.rotation.y;
    while(turn>Math.PI)turn-=Math.PI*2;
    while(turn<-Math.PI)turn+=Math.PI*2;
    if(Math.abs(turn)>.045){A.grp.rotation.y+=Math.sign(turn)*Math.min(Math.abs(turn),dt*3.3);A.motionPhase='turning';}
    else if(sittingHere&&!A.standingDesk){A.motionPhase='sitting';A.poseClock=0;A.sit=0;}
    else{A.motionPhase='standing';A.sit=0;}
   }
   phase=A.motionPhase;
   if(A.path){
    const show=Boolean(waypoint)&&A.walking;
    if(show){const data=A.path.geometry.attributes.position;
     data.setXYZ(0,p.x,officeRoomDeckY>0?.25:.06,p.z);
     data.setXYZ(1,waypoint.x,officeRoomDeckY>0?.25:.06,waypoint.z);
     data.needsUpdate=true;A.path.computeLineDistances();}
    A.path.visible=show;
   }
   const sit=A.sit||0,sw=Math.sin(t*11+A.phase);
   A.yCur+=((A.baseY||0)-A.yCur)*Math.min(1,dt*3);
   if(A.model){if(A.wasBusy&&!A.busy&&!A.walking)A.cheerT=1.5;if(A.cheerT>0)A.cheerT-=dt;}
   A.wasBusy=A.busy;
   if(A.model){
    p.y=A.yCur+(A.walking?Math.abs(Math.sin(t*9+A.phase))*.018:0);
    A.grp.rotation.x=0;
    let want;
    if(phase==='sitting'&&A.model.clips.sitDown)want='sitDown';
    else if(phase==='standingUp'&&A.model.clips.standUp)want='standUp';
    else if(phase==='seated'&&A.model.clips.seatedIdle)want=A.busy&&A.model.clips.seatedWork?'seatedWork':'seatedIdle';
    else want=clipLogic?clipLogic.officeClipFor({walking:A.walking,faceMode:A.faceMode,cheer:A.cheerT>0}):(A.faceMode==='zap'?'fail':A.walking?'walk':A.cheerT>0?'cheer':A.faceMode==='work'?'work':'idle');
    officePlayClip(A,want);
    if(A.mixer)A.mixer.update(dt);
    // Unknown user GLBs may not contain a seated pose. Keep a conservative
    // geometric fallback, but NEVER apply it over a genuine seated clip.
    if(!A.model.hasSeatClips&&A.bend&&sit>.01&&!A.standingDesk){
     p.y=A.yCur-.28*sit;
     const B=A.bend;
     if(B.hipL)B.hipL.rotation.x-=1.05*sit;if(B.hipR)B.hipR.rotation.x-=1.05*sit;
     if(B.kneeL)B.kneeL.rotation.x+=1.43*sit;if(B.kneeR)B.kneeR.rotation.x+=1.43*sit;
     if(B.ankleL)B.ankleL.rotation.x-=.22*sit;if(B.ankleR)B.ankleR.rotation.x-=.22*sit;
    }
   }else if(A.walking){
    A.legL.rotation.x=sw*.55*(1-sit);A.legR.rotation.x=-sw*.55*(1-sit);
    A.shinL.rotation.x=Math.max(0,-sw)*.55*(1-sit);A.shinR.rotation.x=Math.max(0,sw)*.55*(1-sit);
    A.armL.rotation.x=-sw*.44*(1-sit)-.55*sit;A.armR.rotation.x=sw*.44*(1-sit)-.55*sit;
    p.y=A.yCur+Math.abs(Math.sin(t*11+A.phase))*.035*(1-sit)-.28*sit;A.grp.rotation.x=.05*(1-sit);
   }else{
    A.legL.rotation.x=-1.05*sit;A.legR.rotation.x=-1.05*sit;
    A.shinL.rotation.x=1.43*sit;A.shinR.rotation.x=1.43*sit;
    A.armL.rotation.x=-.55*sit;A.armR.rotation.x=-.55*sit;
    p.y=A.yCur+Math.sin(t*1.7+A.phase)*.01-.28*sit;A.grp.rotation.x=.04*sit;
   }
   if(A.faceMode!=='sleep'&&A.faceMode!=='zap'){ const bl=((t+A.phase*3.7)%4.1)<.11; const tgt=bl?faceTexCache.blink:faceTexCache[A.faceMode]; if(A.faceMat.map!==tgt)A.faceMat.map=tgt; }
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
  // Màn hình của trạm đang làm việc THẬT sáng lên (màu vật liệu tiến về
  // trắng = hình canvas hiển thị đầy đủ); trạm nghỉ giữ màn hình tối.
  for(const sid in deskScreens){const lit=deskLit.has(sid); for(const scr of deskScreens[sid]){const m=scr.material, target=lit?1:0.42, cur=m.color.r, nv=cur+(target-cur)*Math.min(1,dt*5); m.color.setScalar(nv);}}
  for(const h of deskHolos){const target=deskLit.has(h.userData.stationId)?0.85:0.45; h.material.opacity+=(target-h.material.opacity)*Math.min(1,dt*5);}
  dust.rotation.y=t*.008; dust.position.y=Math.sin(t*.3)*.15;
  camera.position.set(orbit.lookX+Math.sin(orbit.theta)*Math.sin(orbit.phi)*orbit.radius,orbit.lookY+Math.cos(orbit.phi)*orbit.radius,orbit.lookZ+Math.cos(orbit.theta)*Math.sin(orbit.phi)*orbit.radius);
  camera.lookAt(orbit.lookX,orbit.lookY,orbit.lookZ);
  if(!window.__office3DReady){window.__office3DReady=true;room.classList.remove('office-iso');room.classList.add('office-3d-on');const t=$('#office3DToggle');if(t){t.disabled=false;t.textContent='🗺️ Đang ở phòng 3D — bấm để về isometric';}}
  if(officeComposer)officeComposer.render(); else renderer.render(scene,camera);
 }catch(err){console.warn('Khung hình 3D lỗi — quay về phòng isometric:',err);try{renderer.setAnimationLoop(null);}catch{} window.__office3D=false;window.__office3DReady=false;const c=room.querySelector('.office-3d-canvas');if(c)c.remove();room.classList.remove('office-3d-on');room.classList.add('office-iso');officeRender();} });
 // --- Phòng GLB theo ảnh mẫu (nạp bất đồng bộ): có file thì thay vỏ phòng thủ tục, robot + trạng thái thật giữ nguyên ---
 // --- Thân TAM01 cho đội bot tài khoản: nạp 1 lần, nhân bản theo xương cho từng bot ---
 async function officeEnsureTam(){
  if(tamTemplate||tamBusy)return; tamBusy=true;
  try{
   const [sk,gl]=await Promise.all([import('/vendor/addons/SkeletonUtils.js'),import('/vendor/addons/GLTFLoader.js'),officeMotionPromise]);
   const g=await new gl.GLTFLoader().loadAsync('/assets/tam19.glb');
   tamTemplate=g.scene; tamClipList=g.animations||[]; tamCloneFn=sk.clone;
   window.__officeTamClips=tamClipList.map(c=>c.name);
   for(const A of Object.values(agents))officeAttachTam(A);
  }catch(e){console.warn('Không nạp được thân TAM01, bot dùng thân mặc định:',e);}
  tamBusy=false;
 }
 function officeAttachTam(A){
  if(!tamTemplate||!tamCloneFn||(A.model&&A.model.source==='upload'))return;
  if(A.model&&A.model.source==='stock')return;
  try{
   const inst=tamCloneFn(tamTemplate);
   const col=new THREE.Color(A.a.color||'#57e6ff');
   const offline=A.a.fleet&&A.a.fleet.state==='offline';
   inst.traverse(o=>{
    if(!o.isMesh)return;
    o.frustumCulled=false;
    if(o.material){o.material=o.material.clone();
     if(o.material.name==='emission'||o.material.name==='Eye cyan emission'||o.material.name==='Blue LED'){o.material.emissive=new THREE.Color(col); o.material.color=new THREE.Color(col);}
     else if(o.material.name==='blue'||o.material.name==='Phu Quoc turquoise'){o.material.color=new THREE.Color(o.material.color).lerp(col,.5);}
     if(offline){o.material.color.multiplyScalar(.5); if('emissiveIntensity' in o.material)o.material.emissiveIntensity=.2;}
    }
   });
   const grp=new THREE.Group(); grp.add(inst); grp.scale.setScalar(TAM_TARGET_H/TAM_NATIVE_H);
   A.bend={hipL:inst.getObjectByName('Hip_L'),hipR:inst.getObjectByName('Hip_R'),kneeL:inst.getObjectByName('Knee_L'),kneeR:inst.getObjectByName('Knee_R'),ankleL:inst.getObjectByName('Ankle_L'),ankleR:inst.getObjectByName('Ankle_R')};
   if(A.modelRoot)A.grp.remove(A.modelRoot);
   A.grp.add(grp); A.modelRoot=grp;
   const names=tamClipList.map(c=>c.name); const clips={};
   const pref={idle:['Idle','Idle_Breathe'],work:['InspectTablet','Type_Keyboard','Review_Document','WorkCycle','Typing','Mouse','TabletTouch'],walk:['Walk','Walk_Forward','Walk_Fast'],cheer:['Approve','Wave_Hello','Greeting'],fail:['Reject','Idle']};
   for(const want of ['idle','work','walk','cheer','fail']){
    let c=null; for(const n of pref[want]){c=tamClipList.find(x=>x.name===n); if(c)break;}
    if(!c&&clipLogic){const f=clipLogic.officeFindClip(names,want); if(f)c=tamClipList.find(x=>x.name===f);}
    if(c)clips[want]=c;
   }
   const seatClips=officeMotion&&officeMotion.officeMakeTam19SeatClips(THREE,inst);
   if(seatClips)Object.assign(clips,seatClips);
   A.mixer=new THREE.AnimationMixer(inst);
   A.model={clips,current:null,action:null,source:'stock',hasSeatClips:Boolean(seatClips)};
   // 0.9.52: làm việc tại bàn là NGỒI ghế — clip mặc định InspectTablet
   // không thuộc nhóm bàn đứng, nên vòng lặp chuyển động áp thế ngồi
   // (bend + hạ thân lên ghế của app). Nhóm clip bàn đứng P16 chỉ còn là
   // đường dự phòng cho model không có clip ngồi nào: khi đó robot đứng ở
   // bàn đứng tích hợp của chính model và bend bị tắt như cũ.
   A.workClipName=clips.work?clips.work.name:null;
   A.standingDesk=false;
   if(A.procBody)A.procBody.visible=false;
   window.__officeTamAttached=Object.values(agents).filter(x=>x.model&&x.a.fleet).length;
  }catch(e){console.warn('Gắn thân TAM01 lỗi cho',A.a.id,e);}
 }
 // --- Đối chiếu đội hình 3D với danh sách hiện tại (bot vào/ra khi tài khoản đổi) ---
 let rosterSig3D='';
 function office3DReconcile(){
  const roster=officeRosterCast(); const sig=roster.map(a=>a.id).join(',');
  // Kể cả khi danh sách ID không đổi cũng phải làm mới A.a từ bản cast mới
  // nhất: bot đổi TRẠM (sạc xong ra bàn, hoặc chuyển trạm) không làm thay
  // chữ ký ID — nếu giữ A.a cũ, điều kiện ownDesk của vòng lặp chuyển động
  // so theo trạm cũ nên robot tới bàn mới mà không bao giờ ngồi (0.9.52).
  if(sig===rosterSig3D){for(const A of Object.values(agents)){const fresh=roster.find(x=>x.id===A.a.id); if(fresh)A.a=fresh; if(!A.model)officeAttachTam(A);} return;}
  rosterSig3D=sig;
  const want=new Set(roster.map(a=>a.id));
  for(const id of Object.keys(agents))if(!want.has(id)){
   scene.remove(agents[id].grp);if(agents[id].path)scene.remove(agents[id].path);
   delete agents[id];
  }
  for(const a of roster){
   if(agents[a.id]){agents[a.id].a=a; continue;}
   const built=buildAgent(a); const home=officeWorld(OFFICE_STATIONS[a.station]||OFFICE_STATIONS.lounge);
   built.grp.position.set(home.x,0,home.z); built.target.copy(built.grp.position); built.baseY=0; built.yCur=0;
   officeWrapProcedural(built);officeMakePath(built);agents[a.id]=built;
  }
  // Attach stock GLB immediately to newly arrived bots once the template is ready.
  if(tamTemplate){for(const A of Object.values(agents))if(!A.model)officeAttachTam(A);}
  else officeEnsureTam();
 }
 window.__officeRoomMode='procedural';
 import('/vendor/addons/GLTFLoader.js').then(async ({GLTFLoader})=>{
  try{
   const gltf=await new GLTFLoader().loadAsync('/assets/office-room.glb');
   const env=gltf.scene; env.name='OfficeRoomGLB';
   const bakedLights=[]; env.traverse(o=>{if(o.isLight)bakedLights.push(o);}); bakedLights.forEach(l=>l.removeFromParent());
   scene.add(env);
   /* THÁO RÈM (0.9.57): hai vách trang trí WallPanel_L / WallPanel_R
    * trong GLB phòng (mỗi vách ~3,3 × 12,5 × 26,9 m, dựng hai bên
    * phòng) thành hai mảng màu tím đặc che gần hết khung hình ở góc
    * camera mặc định — chính là "cái rèm" Sếp chụp. Nhận diện bằng
    * render đối chứng (thư mục probe của bản 0.9.57): ẩn đúng hai node
    * này thì mảng tím biến mất, vỏ phòng / tường kính / vòm nguyên vẹn. */
   const OFFICE_GLB_CURTAIN=['WallPanel_L','WallPanel_R'];
   env.traverse(o=>{if(OFFICE_GLB_CURTAIN.includes(o.name))o.visible=false;});
   const keep=new Set(); Object.values(agents).forEach(A=>{keep.add(A.grp); if(A.path)keep.add(A.path);}); keep.add(parcel); bolts.forEach(b=>keep.add(b)); deskGroups.forEach(g=>keep.add(g)); keep.add(podSlotGroup); keep.add(propGroup);
   scene.children.slice().forEach(o=>{ if(keep.has(o)||o===env) return; if(o.isLight) return; o.visible=false; });
   officeRoomDeckY=.18; window.__officeRoomMode='glb';
   // Bàn + ghế của app ở lại trong phòng GLB (0.9.52): nâng lên mặt sàn GLB
   // cho khớp độ cao chân robot (baseY cũng dùng officeRoomDeckY).
   for(const g of deskGroups)g.position.y=officeRoomDeckY;
   /* Vòm đen "ShellFar" (0.9.52): node vỏ bao ngoài của bộ GLB — hộp
    * 62x20x62 m, vật liệu KHÔNG sáng (MeshBasicMaterial) màu
    * (0.003,0.0056,0.0137) ~ đen tuyệt đối, hai mặt. Camera mặc định ở
    * trong vòm nên mặt trong đen của nó phủ mọi khoảng khung hình mà bộ
    * phòng không che; lăn chuột ra xa quá bán kính ~31 (tối đa 48) thì
    * camera ra NGOÀI vòm và mặt ngoài đen nuốt trọn khung hình — đúng
    * "vòm đen" Sếp chụp được. Sửa: thay bằng phông gradient xanh đậm +
    * sao vẽ bằng canvas, chỉ hiện MẶT TRONG (BackSide) nên không bao giờ
    * che phòng, và phóng to vỏ (x1.8 ngang, x2.2 cao) để cả mức zoom xa
    * nhất 48 vẫn nằm trong vòm. */
   const shellFar=env.getObjectByName('ShellFar');
   if(shellFar){
    const domeTex=canvasTex(256,512,(g,w,h)=>{
     const gr=g.createLinearGradient(0,0,0,h);
     gr.addColorStop(0,'#05081a'); gr.addColorStop(.40,'#101f4e'); gr.addColorStop(.55,'#1d3474'); gr.addColorStop(.68,'#0c173c'); gr.addColorStop(1,'#04060f');
     g.fillStyle=gr; g.fillRect(0,0,w,h);
     g.fillStyle='rgba(120,190,255,.10)'; g.fillRect(0,h*.52,w,h*.05);
     for(let i=0;i<170;i++){const sy=Math.pow(Math.random(),1.6)*h*.55; g.fillStyle=`rgba(255,255,255,${(.15+Math.random()*.55).toFixed(2)})`; g.beginPath(); g.arc(Math.random()*w,sy,Math.random()<.12?1.6:.8,0,7); g.fill();}
    });
    domeTex.colorSpace=THREE.SRGBColorSpace;
    shellFar.material=new THREE.MeshBasicMaterial({map:domeTex,side:THREE.BackSide,fog:false});
    shellFar.scale.set(1.8,2.2,1.8);
   }
   officeEnablePost();
   window.__officeRoomEnv=env; officeApplyHdr(env); officeApplyFloor(env); propGroup.position.y=officeRoomDeckY;
   if(gltf.animations&&gltf.animations.length){ const mx=new THREE.AnimationMixer(env); mx.clipAction(gltf.animations[0]).play(); const ck=new THREE.Clock(); (function tick(){ requestAnimationFrame(tick); mx.update(Math.min(ck.getDelta(),.05)); })(); }
  }catch(err){ console.warn('Không nạp được phòng GLB, dùng phòng thủ tục:',err); officeEnablePost(); }
 }).catch(()=>{});
}

/* SPACE STUDIO R2: sanitized read-only account status bridge. */
window.__ideaSpaceReadFleet=()=>officeRosterCast().filter(a=>a.fleet).map(a=>({id:String(a.id),name:String(a.name||a.id),provider:String(a.fleet.provider||''),state:String(a.fleet.state||'unknown'),station:String(a.station||''),placeholder:Boolean(a.fleet.standby)}));
