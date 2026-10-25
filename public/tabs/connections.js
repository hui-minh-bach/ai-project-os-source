const ccProviders=[['openai','OpenAI / ChatGPT'],['gemini','Google Gemini'],['anthropic','Anthropic Claude'],['openai_compatible','Khác / OpenAI-compatible']];
// One-click presets for the OpenAI-compatible slot: the user's own account/key
// at each provider (or a local server that needs no key). Only the name and
// Base URL are filled in — the credential always comes from the user.
const ccCompatPresets=[
 {name:'DeepSeek',base:'https://api.deepseek.com/v1'},
 {name:'xAI Grok',base:'https://api.x.ai/v1'},
 {name:'Mistral AI',base:'https://api.mistral.ai/v1'},
 {name:'Groq',base:'https://api.groq.com/openai/v1'},
 {name:'OpenRouter',base:'https://openrouter.ai/api/v1'},
 {name:'Together AI',base:'https://api.together.xyz/v1'},
 {name:'Ollama (máy local — không cần key)',base:'http://127.0.0.1:11434/v1'},
 {name:'LM Studio (máy local — không cần key)',base:'http://127.0.0.1:1234/v1'},
];
const ccRoles=[['founder','Chatbox / Founder','Lên ý tưởng, định hướng, phân tích.'],['council','AI Council','Phản biện, góp ý đa chiều.'],['worker','Worker / Builder','Thực thi, lập trình, xây dựng.'],['reviewer','Reviewer','Kiểm tra, đánh giá, tối ưu.']];
// --- Phân vai trực tiếp theo tài khoản (0.9.55) ---
// Lớp "hai khu" của 0.9.53 đã bị gỡ theo phán quyết của chủ: một tài
// khoản chỉ có MỘT bình hạn mức chung cho mọi model của nó, nên đơn vị
// chia đúng duy nhất là TÀI KHOẢN. Phân vai chọn thẳng tài khoản + model
// trong danh mục của tài khoản đó; xác minh chỉ là dấu tư vấn.
const ccAccounts={};
function ccSvg(body,cls=''){return `<svg class="${cls}" viewBox="0 0 32 32" aria-hidden="true" fill="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`}
function ccLogo(kind){
 // OpenAI mark adapted from Simple Icons (CC0), viewBox 24 mapped into our 32 grid.
 if(kind==='openai')return ccSvg('<path transform="scale(1.333333)" fill="currentColor" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>');
 if(kind==='gemini')return ccSvg('<defs><linearGradient id="ccGemini" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9131f5"/><stop offset=".5" stop-color="#5766f6"/><stop offset="1" stop-color="#00ceff"/></linearGradient></defs><path d="M16 0C19 11 21 13 32 16C21 19 19 21 16 32C13 21 11 19 0 16C11 13 13 11 16 0Z" fill="url(#ccGemini)"/>');
 if(kind==='anthropic')return 'AI';
 if(kind==='openai_compatible')return ccSvg('<path d="m16 4 10 6v12l-10 6-10-6V10l10-6Zm-10 6 10 6 10-6M16 16v12" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>');
 if(kind==='github')return ccSvg('<path fill="currentColor" d="M16 3a13 13 0 0 0-4.1 25.3c.6.1.8-.3.8-.6v-2.3c-3.4.7-4.1-1.5-4.1-1.5-.6-1.5-1.5-1.9-1.5-1.9-1.2-.8.1-.8.1-.8 1.3.1 1.9 1.3 1.9 1.3 1.2 1.9 3 .9 3.7.7.1-.8.5-1.4.8-1.7-2.7-.3-5.6-1.4-5.6-6.3 0-1.4.5-2.5 1.3-3.4-.2-.3-.6-1.6.1-3.4 0 0 1-.3 3.6 1.3a12.7 12.7 0 0 1 6.6 0C22 8 23 8.4 23 8.4c.7 1.8.3 3.1.1 3.4.8.9 1.3 2 1.3 3.4 0 4.9-2.9 6-5.6 6.3.5.4.8 1.2.8 2.3v3.9c0 .4.2.7.8.6A13 13 0 0 0 16 3Z"/>');
 if(kind==='vercel')return ccSvg('<path d="m16 5 12 21H4L16 5Z" fill="white"/>');
 if(kind==='supabase')return ccSvg('<path d="M17 1 3 19h13V1Z" fill="#00cb9e"/><path d="M16 13h13L15 31V13Z" fill="#009a70"/>');
 if(kind==='domain')return ccSvg('<g stroke="currentColor" stroke-width="1.6"><circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="6" ry="12"/><path d="M4 16h24M6 9h20M6 23h20"/></g>');
 if(kind==='founder')return ccSvg('<path d="m5 10 5 5 6-8 6 8 5-5-3 15H8L5 10Z" fill="white"/><circle cx="5" cy="9" r="2" fill="white"/><circle cx="16" cy="6" r="2" fill="white"/><circle cx="27" cy="9" r="2" fill="white"/>');
 if(kind==='council')return ccSvg('<g fill="white"><circle cx="16" cy="10" r="4"/><circle cx="7" cy="11" r="3"/><circle cx="25" cy="11" r="3"/><path d="M9 26v-5a7 7 0 0 1 14 0v5H9ZM2 23v-4a5 5 0 0 1 7-4l-2 8H2Zm28 0h-5l-2-8a5 5 0 0 1 7 4v4Z"/></g>');
 if(kind==='worker')return ccSvg('<path d="m6 26 13-13-4-4 4-4 8 3 1 7-4 4-3-3L9 29l-3-3Z" fill="white"/>');
 if(kind==='reviewer')return ccSvg('<g stroke="white" stroke-width="2.3" stroke-linecap="round"><path d="M9 5h12l4 4v18H9V5Z"/><path d="M13 11h8M13 16h8M13 21h8"/></g>');
 if(kind==='terminal')return ccSvg('<path d="m7 8 8 8-8 8m12 0h8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>');
 return ccSvg('<g stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="5"/><path d="m13 4-1 4-4 2-4-1-2 4 3 3v4l-3 3 2 4 4-1 4 2 1 4h6l1-4 4-2 4 1 2-4-3-3v-4l3-3-2-4-4 1-4-2-1-4h-6Z"/></g>');
}
function ccIsKind(c,kind){return c.kind===kind||(kind==='openai'&&c.kind==='chatgpt_account')||(kind==='gemini'&&['gemini_account','antigravity_account'].includes(c.kind))||(kind==='anthropic'&&c.kind==='claude_account')}
function ccCurrent(kind){const a=state.connections.filter(c=>ccIsKind(c,kind));return a.find(c=>c.id===ccAccounts[kind])||a[0]}
function ccVerified(c){return state.vault?.unlocked&&c?.availability?.status==='verified'}
function ccHasCatalog(c){return Boolean(state.vault?.unlocked&&(c?.availability?.models||[]).length)}
function ccStatus(c,infra=false){if(!state.vault?.unlocked)return ['locked','Vault đang khóa'];if(!c)return ['','Chưa kết nối'];if(infra)return c.meta?.verifiedAt?['connected','Đã kết nối']:['unverified','Chưa xác minh'];if(ccHasCatalog(c))return ['connected','Đã kết nối'];if(c.kind==='chatgpt_account'&&c.meta?.accountIdentity)return ['unverified','Đã đăng nhập · Chưa có danh mục model'];return ['unverified','Chưa sẵn sàng']}
function ccBadge(status){return `<span class="cc-status ${status[0]}">${status[1]}</span>`}
function ccOptions(models,value,placeholder='Chọn model'){return `<option value="" disabled ${models.includes(value)?'':'selected'}>${esc(placeholder)}</option>`+models.map(m=>`<option value="${esc(m)}" ${m===value?'selected':''}>${esc(m)}</option>`).join('')}
// Reasoning-effort ladders exactly as each vendor defines them: Codex
// model_reasoning_effort (GPT-6 tops out at Max, like the ChatGPT slider)
// and the Claude Code --effort flag. The slider stores the vendor's own
// value, so the app stays in sync with the AI it drives.
const ccEffortLevels={
 chatgpt_account:[['','Mặc định'],['minimal','Tối thiểu'],['low','Thấp'],['medium','Vừa'],['high','Cao'],['xhigh','Rất cao'],['max','Tối đa · Max']],
 claude_account:[['','Mặc định'],['low','Thấp'],['medium','Vừa'],['high','Cao'],['xhigh','Rất cao'],['max','Tối đa · Max']]};
function ccEffortSlider(c,title){const lv=ccEffortLevels[c.kind];if(!lv)return '';const cur=Math.max(0,lv.findIndex(([v])=>v===(c.meta?.reasoningEffort||'')));return `<label>Mức suy luận (tốc độ / token)</label><div class="cc-effort"><div class="cc-effort-read"><strong data-effort-read>${esc(lv[cur][1])}</strong><span data-effort-raw>${lv[cur][0]?esc(lv[cur][0]):'theo hãng'}</span></div><input type="range" class="cc-effort-slider" data-effort-slider="${esc(c.id)}" data-levels="${esc(lv.map(([v])=>v).join(','))}" data-labels="${esc(lv.map(([,l])=>l).join('|'))}" min="0" max="${lv.length-1}" step="1" value="${cur}" aria-label="Mức suy luận ${title}"><div class="cc-effort-ticks">${lv.map(([,l])=>`<span>${esc(l)}</span>`).join('')}</div></div>`}
function ccConnected(){return state.connections.filter(ccHasCatalog)}
function ccBindings(role){const p=state.project;if(role==='council')return p?.modelRoles?.council||[];return p?.modelRoleTeams?.[role]?.length?p.modelRoleTeams[role]:p?.modelRoles?.[role]?[p.modelRoles[role]]:[];}
function ccAddMember(draft,role,binding){const members=role==='council'?draft.council:(draft.teams[role]||[]);if(!members.some(b=>b.connectionId===binding.connectionId&&b.model===binding.model))members.push(binding);draft.teams[role]=members;draft[role]=role==='council'?members:members[0]||null;return draft;}
function ccBinding(role){return role==='council'?state.project?.modelRoles?.council?.[0]:state.project?.modelRoles?.[role]}
function ccBackupBinding(role){return role==='council'?state.project?.modelRoleBackups?.council?.[0]:state.project?.modelRoleBackups?.[role]}
function ccProviderOptions(value){return `<option value="">${state.vault?.unlocked?'Chọn provider':'Mở Vault để chọn'}</option>`+ccConnected().map(c=>`<option value="${esc(c.id)}" ${c.id===value?'selected':''}>${esc(c.name)}${c.kind==='chatgpt_account'?' · ChatGPT':c.kind==='antigravity_account'?' · Antigravity':c.kind==='gemini_account'?' · Gemini CLI':c.kind==='claude_account'?' · Claude CLI':''}</option>`).join('')}
// Dấu tư vấn cạnh mỗi lựa chọn model (0.9.55): xác minh chỉ là thông tin,
// không bao giờ chặn chọn. Ba trạng thái: đã xác minh / chưa xác minh /
// đang nguội hạn mức kèm giờ reset (từ trạng thái bể).
function ccModelBadge(c,model){
 if(!c||!model)return '';
 if(c.pool?.cooldownUntil&&Date.parse(c.pool.cooldownUntil)>Date.now())return `<span class="cc-status unverified">⏸ đang nguội hạn mức — reset ${new Date(c.pool.cooldownUntil).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</span>`;
 if((c.availability?.verifiedModels||[]).includes(model))return '<span class="cc-status connected">✓ đã xác minh</span>';
 return '<span class="cc-status unverified">chưa xác minh — vẫn dùng được</span>';
}
function renderTeamSetup(){
 const box=$('#teamSetupPanel');if(!box)return;
 const aiKinds=['chatgpt_account','claude_account','gemini_account','antigravity_account','openai','anthropic','gemini','openai_compatible'];
 const ai=(state.connections||[]).filter(c=>aiKinds.includes(c.kind));
 const boundIds=new Set();
 for(const p of state.projects||[]){
  const roles=p.modelRoles||{},backups=p.modelRoleBackups||{};
  for(const r of ['founder','worker','reviewer']){if(roles[r]?.connectionId)boundIds.add(roles[r].connectionId);if(backups[r]?.connectionId)boundIds.add(backups[r].connectionId);}
  for(const team of Object.values(p.modelRoleTeams||{}))for(const b of team||[])if(b?.connectionId)boundIds.add(b.connectionId);
  for(const b of roles.council||[])if(b?.connectionId)boundIds.add(b.connectionId);
  for(const b of backups.council||[])if(b?.connectionId)boundIds.add(b.connectionId);
 }
 const tick=ok=>ok?'✅':'⬜';
 box.innerHTML=ai.length?ai.map(c=>{
  const loggedIn=c.kind==='chatgpt_account'?Boolean(c.meta?.accountIdentity):c.kind.endsWith('_account')?Boolean(c.meta?.authMode):Boolean(c.hasSecret);
  const hasCatalog=(c.availability?.models||[]).length>0;
  return `<div class="cc-setup-row"><strong>${esc(c.name)}</strong><span>${tick(loggedIn)} Đã đăng nhập</span><span>${tick(hasCatalog)} Có danh mục model${hasCatalog&&c.availability?.catalogStale?' (danh mục cũ)':''}</span><span>${tick(boundIds.has(c.id))} Đã chọn model cho ít nhất một vai</span></div>`;
 }).join(''):'<p class="cc-dialog-note">Chưa có tài khoản AI nào. Kết nối tài khoản ở các thẻ bên dưới — đăng nhập xong danh mục model tự làm mới.</p>';
}
function ccProviderCard(kind){
  const title=(ccProviders.find(p=>p[0]===kind)||[])[1]||kind;
  const c=ccCurrent(kind),status=ccStatus(c),models=c?.availability?.models||[],accounts=state.connections.filter(x=>ccIsKind(x,kind));
  const isAccount=['chatgpt_account','claude_account','gemini_account','antigravity_account'].includes(c?.kind);const hint=!state.vault?.unlocked?'Mở Vault để xem kết nối.':c&&models.length?`${c.name} · ${models.length} model trong danh mục${c.availability?.catalogStale?' (danh mục cũ — vẫn dùng được)':''} · chọn là dùng được`:isAccount?'Tài khoản đã đăng nhập — danh mục model sẽ tự làm mới, hoặc bấm Quản lý để tải ngay.':c?'Bấm Làm mới để tải danh mục model từ Models API.':kind==='openai'?'API key hoặc tài khoản ChatGPT.':['gemini','anthropic'].includes(kind)?'API key hoặc đăng nhập qua CLI chính thức.':'API key chính thức của provider.';
  return `<article class="cc-card cc-provider ${kind==='openai_compatible'?'other':''}" data-provider="${kind}"><div class="cc-provider-top"><span class="cc-logo ${kind}">${ccLogo(kind)}</span><div class="cc-provider-title"><h3>${title}</h3>${ccBadge(status)}<p class="cc-model-description" title="${esc(hint)}">${esc(hint)}</p>${accounts.length>1?`<select class="cc-account-select" data-account="${kind}" aria-label="Tài khoản ${esc(title)}">${accounts.map(x=>`<option value="${esc(x.id)}" ${x.id===c.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select><p class="cc-model-description">${c?.pool?.cooldownUntil?`⏸ Tài khoản này đang nghỉ hạn mức đến ${new Date(c.pool.cooldownUntil).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})} — đội tự chạy bằng tài khoản khác trong bể.`:`🌀 Bể ${accounts.length} tài khoản: một tài khoản hết hạn mức là đội tự chuyển sang tài khoản kế tiếp.`}</p>`:''}</div><div class="cc-actions"><button class="cc-button ${c?'':'connect'}" data-connect="${kind}">${c?'Quản lý':kind==='openai_compatible'?'Thêm API key':'Kết nối'}</button><button class="cc-button cc-menu" data-manage="${kind}" aria-label="Thao tác ${title}">⋮</button></div></div><label for="cc-model-${kind}">Model khả dụng</label><select id="cc-model-${kind}" data-default-model="${esc(c?.id||'')}" ${models.length?'':'disabled'} aria-label="Model ${title}">${ccOptions(models,c?.model,!state.vault?.unlocked?'Vault đang khóa':!c?'Chưa kết nối tài khoản':!models.length?'Chưa có model khả dụng':'Chọn model mặc định')}</select>${c?ccEffortSlider(c,title):''}<label>Dùng cho vai trò</label><div class="cc-role-buttons">${ccRoles.map(([role])=>{const active=Boolean(c&&ccBindings(role).some(b=>b.connectionId===c.id));return `<button class="cc-button ${active?'active-'+role:''}" data-assign-role="${role}" data-kind="${kind}" ${ccHasCatalog(c)&&state.project?'':'disabled'}>${{founder:'Founder',council:'Council',worker:'Worker',reviewer:'Reviewer'}[role]}</button>`}).join('')}</div>${ccQuotaPanel(c)}</article>`;
}
function renderConnections(){
 $('#connectionGrid').innerHTML=['openai','gemini','anthropic','openai_compatible'].map(kind=>ccProviderCard(kind)).join('');
 renderTeamSetup();renderConnectionRoles();renderConnectionInfrastructure();renderConnectionPlatforms();ccRenderUsage();
 if(state.vault?.unlocked&&$('#page-connections')?.classList.contains('active'))ccFetchVisibleQuotas();
}
function renderConnectionRoles(){
 const enabled=Boolean(state.project&&state.vault?.unlocked&&ccConnected().length);
 $('#connectionRoleHint').textContent=state.project?`Phân vai cho ${state.project.name}: chọn thẳng tài khoản + model trong danh mục của tài khoản đó — không cần xác minh trước (xác minh chỉ là dấu kiểm tra model có phản hồi). Khi chạy, tài khoản chạm hạn mức sẽ tự nghỉ và app chuyển sang tài khoản khác cùng model; hết lượt thì tới Model dự phòng. Có thể chọn nhiều thành viên cho AI Council.`:'Tạo hoặc chọn dự án để lưu phân vai model. Mọi model trong danh mục của tài khoản đã đăng nhập đều chọn được.';
 $('#connectionRoleGrid').innerHTML=ccRoles.map(([role,title,desc])=>{
  const b=ccBinding(role),c=ccConnected().find(x=>x.id===b?.connectionId),models=c?.availability.models||[];
  const bk=ccBackupBinding(role),bc=ccConnected().find(x=>x.id===bk?.connectionId),bmodels=bc?.availability.models||[];
  return `<article class="cc-card cc-role-card"><div class="cc-role-top"><span class="cc-role-icon ${role}">${ccLogo(role)}</span><div><h3>${title}</h3><p>${desc}</p></div>${role==='council'?`<button id="manageCouncil" aria-label="Quản lý thành viên AI Council" title="Quản lý nhiều thành viên" ${enabled?'':'disabled'}>⋮</button>`:''}</div><div class="cc-role-fields"><div><label for="cc-role-provider-${role}">AI provider</label><select id="cc-role-provider-${role}" data-role-provider="${role}" ${enabled?'':'disabled'}>${ccProviderOptions(c?.id)}</select></div><div><label for="cc-role-model-${role}">Model</label><select id="cc-role-model-${role}" data-role-model="${role}" ${enabled&&c?'':'disabled'}>${ccOptions(models,b?.model,!state.vault?.unlocked?'Vault đang khóa':!state.project?'Chọn dự án':b&&!c?'Kết nối không còn':'Chọn model')}</select><div data-role-badge="${role}">${ccModelBadge(c,b?.model)}</div></div><div><label for="cc-role-backup-provider-${role}">Model dự phòng — tài khoản</label><select id="cc-role-backup-provider-${role}" data-role-backup-provider="${role}" ${enabled?'':'disabled'}>${ccProviderOptions(bc?.id)}</select></div><div><label for="cc-role-backup-model-${role}">Model dự phòng</label><select id="cc-role-backup-model-${role}" data-role-backup-model="${role}" ${enabled&&bc?'':'disabled'}>${ccOptions(bmodels,bk?.model,'Không dùng dự phòng')}</select><div data-role-backup-badge="${role}">${ccModelBadge(bc,bk?.model)}</div></div></div></article>`;
 }).join('');
 for(const [i,[role]] of ccRoles.entries()){
  const card=$('#connectionRoleGrid').children[i],members=ccBindings(role);
  card.insertAdjacentHTML('beforeend','<div class="cc-team-members"><small>Thành viên đã giữ ('+members.length+')</small>'+members.map((binding,index)=>'<div>'+esc((state.connections.find(c=>c.id===binding.connectionId)?.name||binding.connectionId)+' / '+binding.model)+' <button class="cc-button" data-team-remove="'+role+'" data-member-index="'+index+'" aria-label="Bỏ thành viên" '+(enabled?'':'disabled')+'>×</button></div>').join('')+'</div>');
 }

}
function renderConnectionInfrastructure(){
 const services=[['github','GitHub','Quản lý mã nguồn, đồng bộ và AI coding.','https://github.com/login'],['vercel','Vercel','Triển khai web, hosting, preview.','https://vercel.com/login'],['supabase','Supabase','Cơ sở dữ liệu, xác thực, lưu trữ.','https://supabase.com/dashboard'],['domain','Domain','Tên miền riêng cho dự án.','https://domains.cloudflare.com']];
 $('#infrastructureGrid').innerHTML=services.map(([kind,title,desc,url])=>{
  const c=ccCurrent(kind),domain=state.project?.settings?.domain;
  const status=kind==='domain'?(domain?['connected','Đã thiết lập']:['','Chưa thiết lập']):ccStatus(c,true);
  const detail=kind==='domain'?domain?.domain:c?.meta?.verifiedAt?(c.meta.login||c.meta.projects?.map(p=>p.name||p.id).join(', ')||'API endpoint đã xác minh'):'';
  return `<article class="cc-card cc-service"><div class="cc-service-top"><span class="cc-logo ${kind}">${ccLogo(kind)}</span><div class="cc-service-title"><div class="cc-service-heading"><h3>${title}</h3>${ccBadge(status)}</div><p title="${esc(detail||desc)}">${esc(detail||desc)}</p></div></div><div class="cc-service-actions"><a class="cc-button cc-open-site" href="${url}" target="_blank" rel="noopener noreferrer">Mở ${title} ↗</a>${kind==='domain'?`<button class="cc-button" data-domain-setup>${ccLogo('settings')}Thiết lập</button>`:`<button class="cc-button" data-infra-link="${kind}">${ccLogo('terminal')}Liên kết tài khoản…</button>`}<button class="cc-button cc-menu" ${kind==='domain'?'data-domain-setup':`data-manage="${kind}"`} aria-label="Thao tác ${title}">⋮</button></div>${kind==='domain'?'':`<p class="muted" data-infra-hint="${kind}"></p>`}</article>`;
 }).join('');
 ccLoadInfraHints();
}
async function ccLoadInfraHints(){
 try{const r=await api('/api/infra-accounts/status');for(const t of r.tools||[]){const el=document.querySelector(`[data-infra-hint="${t.kind}"]`);if(!el)continue;el.textContent=t.connected?`CLI: ${t.installed?'đã cài':'chưa cài'} · Đã liên kết: ${t.connectionName||t.login}`:`CLI: ${t.installed?(t.source==='managed'?'đã cài bởi AI Project OS':'đã có trên máy'):'chưa cài'} · Chưa liên kết tài khoản — bấm "Liên kết tài khoản…" để đăng nhập.`;}}catch{/* hints are advisory only */}
}
function ccInfraAccountDialog(kind){
 if(ccNeedVault())return;
 const titles={github:'GitHub',vercel:'Vercel',supabase:'Supabase'},urls={github:'https://github.com/login',vercel:'https://vercel.com/login',supabase:'https://supabase.com/dashboard'};const title=titles[kind];if(!title)return;
 modal(`<h2>Liên kết tài khoản ${title}</h2><p class="cc-dialog-note">Giống cách liên kết ChatGPT: phần mềm tự cài CLI chính thức của ${title}, mở cửa sổ đăng nhập của chính hãng, rồi kiểm tra CLI báo ai đang đăng nhập mới lưu kết nối vào Vault. Phần mềm không bao giờ nhận mật khẩu ${title} của bạn.</p><p id="ccInfraStatus" class="cc-dialog-note">Đang kiểm tra CLI và kết nối…</p><div class="cc-oauth-actions"><button id="ccInfraInstall">1 · Cài CLI</button><button id="ccInfraLogin">2 · Mở đăng nhập chính thức</button><button id="ccInfraVerify" class="primary">3 · Kiểm tra &amp; tạo kết nối</button></div><div class="cc-oauth-actions"><button id="ccInfraToken" class="cc-text-button">Dùng token / API key thay thế</button><a class="cc-button cc-open-site" href="${urls[kind]}" target="_blank" rel="noopener noreferrer">Chưa có tài khoản? Tạo tại ${title} ↗</a></div>`);
 const refresh=async()=>{try{const r=await api('/api/infra-accounts/status');const t=(r.tools||[]).find(x=>x.kind===kind);if(!t)return;$('#ccInfraStatus').textContent=`${t.label}: ${t.installed?(t.source==='managed'?'đã được AI Project OS cài vào thư mục người dùng':'đã có sẵn trên máy này'):'chưa cài'}.${t.connected?` Đã liên kết: ${t.connectionName||t.login} (xác minh ${t.verifiedAt?new Date(t.verifiedAt).toLocaleString('vi-VN'):''}).`:' Chưa có kết nối nào.'}`;$('#ccInfraInstall').disabled=t.installed;$('#ccInfraLogin').disabled=!t.installed;}catch{}};
 $('#ccInfraInstall').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{const r=await api(`/api/infra-accounts/${kind}/install`,{method:'POST',body:'{}'});toast(r.message||'Đã cài CLI.');await refresh()}catch(err){toast(err.message);b.disabled=false}};
 $('#ccInfraLogin').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{const r=await api(`/api/infra-accounts/${kind}/login`,{method:'POST',body:'{}'});toast(r.message||'Đã mở cửa sổ đăng nhập.')}catch(err){toast(err.message)}finally{b.disabled=false}};
 $('#ccInfraVerify').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{const c=await api('/api/connections/cli/'+kind,{method:'POST',body:'{}'});await loadConnections();closeCustomerModal();toast('Đã tạo kết nối: '+c.name);renderConnections()}catch(err){toast(err.message);b.disabled=false}};
 $('#ccInfraToken').onclick=()=>ccConnectionDialog(kind);
 refresh();
}
function ccNeedVault(){if(state.vault?.unlocked)return false;modal('<h2>Mở Secret Vault</h2><p class="cc-dialog-note">Vault đang khóa. Mở Vault để xem, thêm hoặc kiểm tra credential và model.</p><button class="primary" id="ccOpenVault">Mở Vault</button>');$('#ccOpenVault').onclick=()=>$('#vaultBtn').click();return true}
function ccConnectionDialog(kind,id,apiOnly=false){
 if(ccNeedVault())return;
 if(kind==='openai'&&!apiOnly)return ccOpenAIMethod(id);
 if(['gemini','anthropic'].includes(kind)&&!apiOnly)return ccOtherAIMethod(kind,id);
 const old=id==='new'?null:(state.connections.find(x=>x.id===id)||ccCurrent(kind)),info=kindInfo[kind],ai=ccProviders.some(p=>p[0]===kind);
 modal(`<h2>${old?'Quản lý':'Kết nối'} ${esc(info?.[0]||kind)}</h2><p class="cc-dialog-note">${ai?'Chỉ dùng API key chính thức. Không nhập email, password, cookie hoặc session token của website. Model sẽ được tải từ Models API sau khi lưu.':'Dùng CLI đã đăng nhập hoặc token API chính thức. Trạng thái chỉ được xác minh sau khi kiểm tra dịch vụ.'}</p>${old?`<div class="cc-dialog-status">${esc(old.name)} · ${esc(ccStatus(old,!ai)[1])}<br>${esc(old.availability?.message||old.meta?.login||'')}</div>`:''}<label for="cname">Tên hiển thị</label><input id="cname" value="${esc(old?.name||info?.[0]||kind)}"><label for="csecret">API key / Token ${old?'(để trống để giữ credential)':''}</label><input id="csecret" type="password" autocomplete="new-password" placeholder="${old?'Credential được giữ trong Vault':'Nhập API key chính thức'}">${kind==='openai_compatible'?`<label for="cpreset">Nhà cung cấp có sẵn — chọn để điền sẵn tên và Base URL</label><select id="cpreset"><option value="">— Tự nhập —</option>${ccCompatPresets.map(p=>`<option value="${esc(p.base)}" data-name="${esc(p.name.replace(/ \(.*$/,''))}">${esc(p.name)}</option>`).join('')}</select>`:''}${['openai_compatible','supabase'].includes(kind)?`<label for="cbase">${kind==='supabase'?'Supabase Project URL':'Base URL (ví dụ https://api.example.com/v1)'}</label><input id="cbase" value="${esc(old?.baseUrl||'')}" placeholder="https://...">`:''}${kind==='supabase'?`<label class="checkboxLine"><input type="checkbox" id="cmanagement" ${old?.meta?.management?'checked':''}> Supabase Management PAT</label>`:''}<div id="ccDialogError" class="cc-dialog-error" role="status"></div><div class="cc-dialog-actions"><button id="saveConn" class="primary">Lưu & xác minh</button>${old?'<button id="ccTest" class="ghost">Kiểm tra</button>':''}${old&&ai?'<button id="ccRefresh" class="ghost">Làm mới models</button>':''}${old?'<button id="ccDisconnect" class="ghost">Ngắt kết nối</button>':''}</div>`);
 const run=async(button,fn)=>{button.disabled=true;$('#ccDialogError').textContent='Đang xác minh…';try{await fn();await loadConnections();$('#modal').classList.add('hidden')}catch(e){await loadConnections();if($('#ccDialogError'))$('#ccDialogError').textContent=e.message}finally{button.disabled=false}};
 const preset=$('#cpreset');if(preset)preset.onchange=()=>{const o=preset.selectedOptions[0];if(!o||!o.value)return;$('#cbase').value=o.value;if(o.dataset.name)$('#cname').value=o.dataset.name;};
 $('#saveConn').onclick=e=>run(e.target,async()=>{let secret=$('#csecret').value;if(!old&&!secret.trim()){const base=($('#cbase')?.value||'').trim();if(kind==='openai_compatible'&&/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(base))secret='local-no-key';else throw new Error('Cần API credential để kết nối.');}await api('/api/connections',{method:'POST',body:JSON.stringify({id:old?.id,kind,name:$('#cname').value,secret,baseUrl:$('#cbase')?.value||old?.baseUrl||'',meta:kind==='supabase'?{management:$('#cmanagement').checked,authMode:'pat'}:{}})});toast('Credential đã mã hóa; kết nối đã xác minh')});
 if(old){$('#ccTest').onclick=e=>run(e.target,async()=>{const r=await api(`/api/connections/${encodeURIComponent(old.id)}/test`,{method:'POST',body:'{}'});toast(r.message)});if(ai)$('#ccRefresh').onclick=e=>run(e.target,async()=>{const r=await api(`/api/connections/${encodeURIComponent(old.id)}/models`);toast(`Đã tải ${r.length} model từ provider`)});$('#ccDisconnect').onclick=()=>{modal(`<h2>Ngắt kết nối ${esc(old.name)}</h2><p class="cc-dialog-note">Credential sẽ được xóa khỏi Vault. Các vai trò đang dùng kết nối này sẽ cần được phân lại.</p><button id="ccConfirmDisconnect" class="primary">Ngắt kết nối</button><div id="ccDialogError" class="cc-dialog-error" role="status"></div>`);$('#ccConfirmDisconnect').onclick=e=>run(e.target,async()=>{await api('/api/connections/'+encodeURIComponent(old.id),{method:'DELETE'});toast('Đã ngắt kết nối')})};}
}
async function ccSaveRoles(roles){
 if(!state.project)throw new Error('Tạo hoặc chọn dự án trước.');
 if(roles.teams)roles.teams.council=roles.council||[];
 const projectId=state.project.id;const result=await api(`/api/projects/${encodeURIComponent(projectId)}/model-roles`,{method:'POST',body:JSON.stringify(roles)});
 if(state.project?.id===projectId){state.project=result;const i=state.projects.findIndex(p=>p.id===projectId);if(i>=0)state.projects[i]=result;renderConnections();renderSelectors();document.dispatchEvent(new CustomEvent('connections-change'));toast('Đã lưu phân vai cho dự án')}
}
function ccRoleDraft(){const roles=structuredClone(state.project?.modelRoles||{founder:null,council:[],worker:null,reviewer:null});const backups=structuredClone(state.project?.modelRoleBackups||{founder:null,council:[],worker:null,reviewer:null});const available=b=>Boolean(b&&ccConnected().some(c=>c.id===b.connectionId&&(c.availability.models||[]).includes(b.model)));for(const [role] of ccRoles){if(role==='council'){roles.council=(roles.council||[]).filter(available);backups.council=(backups.council||[]).filter(available);}else{if(!available(roles[role]))roles[role]=null;if(!available(backups[role]))backups[role]=null;}}return {...roles,teams:Object.fromEntries(ccRoles.map(([k])=>[k,structuredClone(ccBindings(k))])),expectedRevision:state.project?.modelRoleRevision||0,backups}}
function ccCouncilDialog(){
 if(ccNeedVault()||!state.project)return;
 const draft=ccRoleDraft();
 let members=structuredClone(draft.council||[]),memberBackups=structuredClone(draft.backups?.council||[]);
 const draw=()=>{modal(`<h2>Thành viên AI Council</h2><p class="cc-dialog-note">Mỗi thành viên chọn thẳng tài khoản và model trong danh mục của tài khoản đó — không cần xác minh trước. Có thể đặt thêm Model dự phòng cho từng thành viên. Thành viên đầu tiên chủ trì tổng hợp. Tối đa 8 thành viên.</p><div id="ccCouncilRows">${members.map((b,i)=>{const c=ccConnected().find(x=>x.id===b.connectionId),bk=memberBackups[i]||null,bc=ccConnected().find(x=>x.id===bk?.connectionId);return `<div class="cc-council-member"><select data-member-provider="${i}" aria-label="Provider thành viên ${i+1}">${ccProviderOptions(c?.id)}</select><select data-member-model="${i}" aria-label="Model thành viên ${i+1}">${ccOptions(c?.availability.models||[],b.model)}</select><select data-member-backup-provider="${i}" aria-label="Tài khoản dự phòng thành viên ${i+1}">${ccProviderOptions(bc?.id)}</select><select data-member-backup-model="${i}" aria-label="Model dự phòng thành viên ${i+1}">${ccOptions(bc?.availability.models||[],bk?.model,'Không dùng dự phòng')}</select><button class="ghost" data-remove-member="${i}" aria-label="Xóa thành viên ${i+1}">×</button></div>`}).join('')||'<p class="cc-dialog-note">Chưa có thành viên.</p>'}</div><div id="ccDialogError" class="cc-dialog-error" role="status"></div><div class="cc-dialog-actions"><button id="ccAddMember" class="ghost" ${members.length<8?'':'disabled'}>+ Thêm thành viên</button><button id="ccSaveCouncil" class="primary">Lưu Council</button></div>`);
 $('#ccAddMember').onclick=()=>{members.push({connectionId:'',model:''});memberBackups.push(null);draw()};
 $$('[data-remove-member]').forEach(b=>b.onclick=()=>{members.splice(Number(b.dataset.removeMember),1);memberBackups.splice(Number(b.dataset.removeMember),1);draw()});
 $$('[data-member-provider]').forEach(s=>s.onchange=()=>{const i=Number(s.dataset.memberProvider);members[i]={connectionId:s.value,model:''};draw()});
 $$('[data-member-model]').forEach(s=>s.onchange=()=>{members[Number(s.dataset.memberModel)].model=s.value});
 $$('[data-member-backup-provider]').forEach(s=>s.onchange=()=>{const i=Number(s.dataset.memberBackupProvider);memberBackups[i]=s.value?{connectionId:s.value,model:''}:null;draw()});
 $$('[data-member-backup-model]').forEach(s=>s.onchange=()=>{const i=Number(s.dataset.memberBackupModel);if(memberBackups[i])memberBackups[i].model=s.value});
 $('#ccSaveCouncil').onclick=async e=>{e.target.disabled=true;try{if(members.some(b=>!b.connectionId||!b.model))throw new Error('Chọn provider và model cho mỗi thành viên.');if(memberBackups.some(b=>b&&(!b.connectionId||!b.model)))throw new Error('Model dự phòng đã chọn tài khoản thì cần chọn cả model (hoặc bỏ chọn tài khoản dự phòng).');const roles=ccRoleDraft();roles.council=members.map(b=>({connectionId:b.connectionId,model:b.model}));roles.backups.council=memberBackups.map(b=>b?{connectionId:b.connectionId,model:b.model}:null);await ccSaveRoles(roles);$('#modal').classList.add('hidden')}catch(err){$('#ccDialogError').textContent=err.message}finally{e.target.disabled=false}};
 };draw();
}
function ccDomainDialog(){
 if(ccNeedVault())return;
 const vercel=state.connections.filter(c=>c.kind==='vercel'&&c.meta?.verifiedAt),enabled=Boolean(state.project&&vercel.length),d=state.project?.settings?.domain;
 modal(`<h2>Thiết lập Domain</h2><p class="cc-dialog-note">Gắn tên miền qua Vercel CLI vào deployment HTTPS của dự án. Sau khi gắn, cấu hình DNS theo hướng dẫn của Vercel.</p>${!enabled?'<div class="cc-dialog-status">Chưa khả dụng: chọn dự án và xác minh kết nối Vercel trước.</div>':''}<label for="ccDomainConnection">Vercel connection</label><select id="ccDomainConnection" ${enabled?'':'disabled'}>${vercel.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')||'<option>Chưa có Vercel đã xác minh</option>'}</select><label for="ccDeployment">Deployment URL</label><input id="ccDeployment" value="${esc(d?.deploymentUrl||'')}" placeholder="https://project.vercel.app" ${enabled?'':'disabled'}><label for="ccDomain">Tên miền</label><input id="ccDomain" value="${esc(d?.domain||'')}" placeholder="app.example.com" ${enabled?'':'disabled'}><div id="ccDialogError" class="cc-dialog-error" role="status"></div><button id="ccSaveDomain" class="primary" ${enabled?'':'disabled'}>Gắn tên miền</button>`);
 $('#ccSaveDomain').onclick=async e=>{e.target.disabled=true;try{const projectId=state.project.id;await api(`/api/projects/${encodeURIComponent(projectId)}/vercel/domain`,{method:'POST',body:JSON.stringify({connectionId:$('#ccDomainConnection').value,deploymentUrl:$('#ccDeployment').value,domain:$('#ccDomain').value})});await chooseProject(projectId);$('#modal').classList.add('hidden');renderConnections();toast('Đã gắn tên miền qua Vercel')}catch(err){$('#ccDialogError').textContent=err.message}finally{e.target.disabled=false}};
}
$('#addConnection').onclick=()=>{if(ccNeedVault())return;modal(`<h2>Thêm kết nối</h2><p class="cc-dialog-note">Chọn provider hoặc dịch vụ để kết nối bằng credential chính thức.</p><label for="ckind">Loại kết nối</label><select id="ckind">${Object.entries(kindInfo).filter(([k])=>k!=='other').map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select><div class="cc-dialog-actions"><button id="ccContinue" class="primary">Tiếp tục</button></div>`);$('#ccContinue').onclick=()=>ccConnectionDialog($('#ckind').value,'new')};
$('#page-connections').addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 try{
  if(b.dataset.quotaRefresh){if(ccNeedVault())return;const c=state.connections.find(x=>x.id===b.dataset.quotaRefresh);if(!c)throw new Error('Tài khoản không còn tồn tại.');b.disabled=true;await ccFetchQuota(c,{force:true});return;}
  if(b.dataset.connect)ccConnectionDialog(b.dataset.connect);
  if(b.dataset.manage)ccConnectionDialog(b.dataset.manage);
  if(b.hasAttribute('data-domain-setup'))ccDomainDialog();
  if(b.id==='manageCouncil')ccCouncilDialog();
  if(b.dataset.infraLink){ccInfraAccountDialog(b.dataset.infraLink)}
  if(b.dataset.cliConnect){if(ccNeedVault())return;b.disabled=true;try{const r=await api('/api/connections/cli/'+b.dataset.cliConnect,{method:'POST',body:'{}'});await loadConnections();toast('Đã xác minh phiên CLI: '+r.name)}finally{b.disabled=false}}
  if(b.dataset.assignRole){const c=ccCurrent(b.dataset.kind),model=$('#cc-model-'+b.dataset.kind).value;if(!model)throw new Error('Chọn model khả dụng trước khi phân vai.');const roles=ccRoleDraft(),binding={connectionId:c.id,model};ccAddMember(roles,b.dataset.assignRole,binding);await ccSaveRoles(roles)}
 }catch(err){toast(err.message)}
});
$('#page-connections').addEventListener('change',async e=>{
 const s=e.target;
 try{
  if(s.dataset.account){ccAccounts[s.dataset.account]=s.value;renderConnections()}
  if(s.hasAttribute('data-default-model')){if(!s.value)return;await api(`/api/connections/${encodeURIComponent(s.dataset.defaultModel)}/model`,{method:'POST',body:JSON.stringify({model:s.value})});await loadConnections();toast('Đã lưu model mặc định của tài khoản')}
  if(s.hasAttribute('data-effort-slider')){const levels=s.dataset.levels.split(','),labels=s.dataset.labels.split('|'),i=Number(s.value),eff=levels[i]||'';await api(`/api/connections/${encodeURIComponent(s.dataset.effortSlider)}/effort`,{method:'POST',body:JSON.stringify({effort:eff})});await loadConnections();toast(eff?('Đã đặt mức suy luận: '+labels[i]+' ('+eff+')'):'Đã trả mức suy luận về mặc định của hãng')}
  if(s.dataset.roleProvider){const role=s.dataset.roleProvider,modelSelect=$('#cc-role-model-'+role),c=ccConnected().find(x=>x.id===s.value);modelSelect.innerHTML=ccOptions(c?.availability.models||[],'');modelSelect.disabled=!c;if(!c){const roles=ccRoleDraft();roles.teams[role]=(roles.teams[role]||[]).slice(1);roles[role]=role==='council'?roles.teams[role]:roles.teams[role][0]||null;await ccSaveRoles(roles)}}
  if(s.dataset.roleModel&&s.value){const role=s.dataset.roleModel,connectionId=$('#cc-role-provider-'+role).value,roles=ccRoleDraft(),binding={connectionId,model:s.value};ccAddMember(roles,role,binding);await ccSaveRoles(roles)}
  if(s.dataset.roleBackupProvider){const role=s.dataset.roleBackupProvider,modelSelect=$('#cc-role-backup-model-'+role),c=ccConnected().find(x=>x.id===s.value);modelSelect.innerHTML=ccOptions(c?.availability.models||[],'',s.value?'Chọn model dự phòng':'Không dùng dự phòng');modelSelect.disabled=!c;if(!s.value){const roles=ccRoleDraft();if(role==='council')roles.backups.council=(roles.backups.council||[]).map((x,i)=>i===0?null:x);else roles.backups[role]=null;await ccSaveRoles(roles)}}
  if(s.dataset.roleBackupModel){const role=s.dataset.roleBackupModel,connectionId=$('#cc-role-backup-provider-'+role).value,roles=ccRoleDraft();if(!s.value){if(role==='council')roles.backups.council=(roles.backups.council||[]).map((x,i)=>i===0?null:x);else roles.backups[role]=null;}else{const binding={connectionId,model:s.value};if(role==='council'){const arr=[...(roles.backups.council||[])];arr[0]=binding;roles.backups.council=arr;}else roles.backups[role]=binding;}await ccSaveRoles(roles)}
 }catch(err){toast(err.message);renderConnections()}
});
$('#page-connections').addEventListener('input',e=>{
 const s=e.target;
 if(!s.hasAttribute||!s.hasAttribute('data-effort-slider'))return;
 const box=s.closest('.cc-effort');if(!box)return;
 const labels=s.dataset.labels.split('|'),levels=s.dataset.levels.split(','),i=Number(s.value);
 const read=box.querySelector('[data-effort-read]'),raw=box.querySelector('[data-effort-raw]');
 if(read)read.textContent=labels[i]||'';
 if(raw)raw.textContent=levels[i]||'theo hãng';
});
document.addEventListener('project-change',()=>renderConnections());
document.addEventListener('page-change',e=>{if(e.detail?.page==='connections')renderConnections()});

let ccUsageSelected='',ccQuota=null,ccAuthPoll=0;
// Only account/rateLimits/read can report subscription windows; API-token
// counters and CLI tokens are NOT a 5-hour / weekly subscription quota.
const ccQuotaCache=new Map(), ccQuotaPending=new Set();
function ccQuotaWindowTiny(w){
 if(!w||!Number.isFinite(w.usedPercent)||w.usedPercent<0||w.usedPercent>100)return '';
 const minutes=w.windowDurationMins;
 const label=minutes===null||!Number.isFinite(minutes)?'Hạn mức':minutes%10080===0?`${minutes/10080} tuần`:minutes%60===0?`${minutes/60} giờ`:`${minutes} phút`;
 const remaining=+(100-w.usedPercent).toFixed(1);
 const reset=Number.isFinite(w.resetsAt)&&w.resetsAt>0?new Date(w.resetsAt*1000).toLocaleString('vi-VN'):'Chưa có thời điểm đặt lại';
 return `<div class="cc-inline-window"><div><span>${esc(label)}</span><strong>${remaining}% còn lại</strong></div><progress max="100" value="${remaining}" aria-label="${esc(label)}: còn lại ${remaining}%"></progress><small>Đặt lại: ${esc(reset)}</small></div>`;
}
function ccQuotaPanel(c){
 if(!state.vault?.unlocked)return '<div class="cc-inline-quota"><span class="cc-inline-title">Hạn mức theo giờ / tuần</span><p>Mở Vault để xem hạn mức thật.</p></div>';
 if(!c)return '<div class="cc-inline-quota"><span class="cc-inline-title">Hạn mức theo giờ / tuần</span><p>Kết nối tài khoản để xem.</p></div>';
 if(c.kind!=='chatgpt_account'){
   const rows=(c.usage?.groups||[]).filter(g=>g.model===c.model),observed=rows.reduce((n,g)=>n+(g.counts?.input||0)+(g.counts?.output||0),0);
   return `<div class="cc-inline-quota"><span class="cc-inline-title">Hạn mức theo giờ / tuần</span><p>Provider chưa cấp dữ liệu hạn mức qua kết nối này.${observed?` Đã ghi nhận ${ccNumber(observed)} token của model.`:''}</p></div>`;
 }
 if(!c.meta?.accountIdentity)return '<div class="cc-inline-quota"><span class="cc-inline-title">Hạn mức giờ / tuần</span><p>Đăng nhập ChatGPT để đọc hạn mức, không cần xác minh model trước.</p></div>';
 const cached=ccQuotaCache.get(c.id),valid=cached?.revision===c.credentialVersion;
 const rows=valid&&cached?.data?.state!=='disconnected'&&cached?.data?ccQuotaRows(cached.data,c.model):'';
 const message=ccQuotaPending.has(c.id)?'Đang đọc từ Codex…':valid&&cached?.error?'Không đọc được hạn mức. Kiểm tra trạng thái tài khoản và thử lại.':valid&&cached?.data?.state==='disconnected'?'Codex đã đăng xuất. Đăng nhập lại để xem hạn mức.':valid&&cached?.data?'Hạn mức gói do Codex cung cấp, độc lập với xác minh model.':'Chưa tải hạn mức tài khoản.';
 return `<div class="cc-inline-quota" data-quota-account="${esc(c.id)}"><div class="cc-inline-head"><span class="cc-inline-title">Hạn mức giờ / tuần</span><button type="button" class="cc-button cc-quota-refresh" data-quota-refresh="${esc(c.id)}" ${ccQuotaPending.has(c.id)?'disabled':''} aria-label="Làm mới hạn mức ${esc(c.name)}">↻ Cập nhật</button></div>${rows}<p>${esc(message)}</p></div>`;
}
function ccQuotaRows(data,model){
 const all=data.rateLimitsByLimitId?Object.entries(data.rateLimitsByLimitId).filter(([,g])=>g&&(g.primary||g.secondary)):[];
 // Never invent a per-model limit: only label a bucket per-model when its
 // exact server-provided ID matches the selected model.
 const sorted=all.sort((a,b)=>Number(b[0].toLowerCase()===String(model||'').toLowerCase())-Number(a[0].toLowerCase()===String(model||'').toLowerCase()));
 const groups=sorted.length?sorted:(data.rateLimits?.primary||data.rateLimits?.secondary)?[['Gói dùng chung',data.rateLimits]]:[];
 if(!groups.length)return '';
 return groups.slice(0,2).map(([id,g])=>`<section class="cc-inline-group"><span>${esc(id==='Gói dùng chung'?'Gói dùng chung':id===model?'Model '+id:'Nhóm '+id)}</span>${ccQuotaWindowTiny(g.primary)}${ccQuotaWindowTiny(g.secondary)}</section>`).join('')+(groups.length>2?'<small class="cc-quota-more">Có thêm nhóm hạn mức khác trong Chi tiết.</small>':'');
}
async function ccFetchQuota(c,{force=false}={}){
 // Account authentication is enough to read quota. Model inference may be
 // unavailable precisely because this quota is exhausted.
 if(!state.vault?.unlocked||!c||c.kind!=='chatgpt_account'||!c.meta?.accountIdentity||ccQuotaPending.has(c.id))return;
 const cached=ccQuotaCache.get(c.id);
 if(!force&&cached?.revision===c.credentialVersion&&Date.now()-cached.at<(cached.error?60000:180000))return;
 ccQuotaPending.add(c.id);
 try{
  const data=await api(`/api/accounts/${encodeURIComponent(c.id)}/usage`);
  if(!state.vault?.unlocked)return;
  if(!state.connections.some(x=>x.id===c.id&&x.credentialVersion===c.credentialVersion))return;
  ccQuotaCache.set(c.id,{revision:c.credentialVersion,at:Date.now(),data});
  // Refresh the grid so the fresh quota lands on the cards right away.
  if(typeof renderConnections==='function')renderConnections();
 }catch(e){ccQuotaCache.set(c.id,{revision:c.credentialVersion,at:Date.now(),error:e.message});}
 finally{ccQuotaPending.delete(c.id);const parent=$(`[data-quota-account="${CSS.escape(c.id)}"]`);if(parent&&state.vault?.unlocked){const current=state.connections.find(x=>x.id===c.id);if(current&&current.credentialVersion===c.credentialVersion)parent.outerHTML=ccQuotaPanel(current);}}
}
function ccFetchVisibleQuotas(){for(const c of state.connections.filter(x=>x.kind==='chatgpt_account'&&x.meta?.accountIdentity))void ccFetchQuota(c);}

function ccNumber(n){return n===null||n===undefined?'Chưa có số liệu':new Intl.NumberFormat('vi-VN').format(n)}
function ccRenderUsage(){
 const accounts=state.connections.filter(c=>ccProviders.some(p=>p[0]===c.kind)||['chatgpt_account','claude_account','gemini_account','antigravity_account'].includes(c.kind));
 const c=accounts.find(c=>c.id===ccUsageSelected)||accounts[0];ccUsageSelected=c?.id||'';
 $('#connectionUsage').innerHTML=`<div class="cc-usage-head"><div><h2>Thống kê token chi tiết</h2><p>Thanh hạn mức giờ / tuần đã chuyển lên từng thẻ AI. Số token chỉ tính từ phản hồi quan sát được trong ứng dụng.</p></div><select id="ccUsageAccount" aria-label="Tài khoản xem thống kê" ${accounts.length?'':'disabled'}>${accounts.map(x=>`<option value="${esc(x.id)}" ${x.id===c?.id?'selected':''}>${esc(x.name)}</option>`).join('')||'<option>Chưa có tài khoản</option>'}</select></div>${c?`<div class="cc-usage-foot"><span>${c.usage?.responses?`${c.usage.withUsage}/${c.usage.responses} phản hồi có số liệu · input ${ccNumber(c.usage?.counts?.input)}, output ${ccNumber(c.usage?.counts?.output)}`:'Chưa có phản hồi với số liệu token.'}</span><button class="cc-button" id="ccUsageDetail">Xem số liệu & hạn mức chi tiết</button></div>`:'<p class="cc-usage-empty">Kết nối tài khoản để xem thống kê.</p>'}`;
 $('#ccUsageAccount').onchange=e=>{ccUsageSelected=e.target.value;ccRenderUsage()};if(c)$('#ccUsageDetail').onclick=()=>ccUsageDialog(c);
}
function ccWindow(w){if(!w)return '';const mins=w.windowDurationMins,label=mins===null?'Cửa sổ hạn mức':mins%10080===0?`Giới hạn ${mins/10080===1?'hàng tuần':mins/10080+' tuần'}`:mins%60===0?`Giới hạn trong ${mins/60} giờ`:`Giới hạn trong ${mins} phút`;return `<div class="cc-quota-window"><div><strong>${label}</strong><span>Còn lại ${new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1}).format(100-w.usedPercent)}%</span></div><progress max="100" value="${100-w.usedPercent}" aria-label="${label}: còn lại ${100-w.usedPercent}%"></progress><small>${w.resetsAt?`Đặt lại lúc ${esc(new Date(w.resetsAt*1000).toLocaleString('vi-VN'))}`:'Chưa có thời điểm đặt lại'}</small></div>`}
function ccAccountQuotaWarning(c){
 if(!c)return '';
 const entry=ccQuotaCache.get(c.id);if(entry?.revision!==c.credentialVersion||!entry?.data)return '';
 const limits=entry.data.rateLimitsByLimitId;
 const groups=limits&&Object.keys(limits).length?Object.entries(limits):entry.data.rateLimits?[['Gói dùng chung',entry.data.rateLimits]]:[];
 const exhausted=groups.filter(([,v])=>[v?.primary,v?.secondary].some(w=>w?.usedPercent>=100&&w.windowDurationMins>0&&w.windowDurationMins<=360));
 if(!exhausted.length)return '';
 const details=exhausted.map(([label,v])=>{
  const w=[v.primary,v.secondary].find(x=>x?.usedPercent>=100&&x.windowDurationMins>0&&x.windowDurationMins<=360);
  const when=w?.resetsAt?new Date(w.resetsAt*1000).toLocaleString('vi-VN'):'chưa có thời gian đặt lại';
  return `${label}: 0% còn lại; đặt lại ${when}`;
 }).join(' · ');
 return `<p class="cc-account-quota-warning">Hạn mức ngắn hạn đã dùng hết ở ${esc(details)}. Nếu model dùng nhóm này, xác minh sẽ không thành công dù đăng nhập đúng. Có thể chờ đặt lại hoặc chọn tài khoản/model còn lượt.</p>`;
}
// Tóm tắt hạn mức hiển thị TRƯỚC khi bấm xác minh (0.9.55): người dùng
// thấy 5 giờ còn bao nhiêu % + giờ reset (và tuần nếu có) rồi mới quyết
// định có đốt một lượt probe hay không. Hết hạn mức thì có sẵn dòng
// hướng dẫn của ccAccountQuotaWarning.
function ccAccountQuotaSummary(c){
 if(!c)return '';
 const entry=ccQuotaCache.get(c.id);
 if(!entry||entry.revision!==c.credentialVersion)return '<p class="cc-dialog-note">Đang đọc hạn mức của tài khoản… Xem hạn mức trước khi xác minh để tránh đốt lượt vô ích.</p>';
 if(entry.error||!entry.data)return '<p class="cc-dialog-note">Chưa đọc được hạn mức của tài khoản này.</p>';
 const rows=ccQuotaRows(entry.data,c.model);
 return (rows?`<div class="cc-inline-quota">${rows}</div>`:'<p class="cc-dialog-note">Tài khoản chưa báo cửa sổ hạn mức.</p>')+(ccAccountQuotaWarning(c)?'':'<p class="cc-dialog-note">Xác minh sẽ gọi thử model và dùng một ít hạn mức. Không xác minh vẫn chọn model và chạy được — khi chạy, app tự xoay sang tài khoản khác nếu tài khoản này chạm hạn mức.</p>');
}
function ccQuotaMarkup(q){if(!q)return '<p class="cc-dialog-note">Chưa có số liệu hạn mức. Bấm làm mới để đọc từ tài khoản.</p>';const limits=q.rateLimitsByLimitId&&Object.keys(q.rateLimitsByLimitId).length?Object.entries(q.rateLimitsByLimitId):q.rateLimits?[['Gói tài khoản',q.rateLimits]]:[];return `<p class="cc-dialog-note">${esc(q.account?.email||'Tài khoản ChatGPT')} · ${esc(q.account?.planType||'Chưa rõ gói')}<br>Giới hạn dùng chung của gói do Codex cung cấp; không phải phần trăm token API.</p>${limits.length?limits.map(([name,v])=>`<div class="cc-quota-group"><h3>${esc(name)}</h3>${ccWindow(v.primary)}${ccWindow(v.secondary)}${!v.primary&&!v.secondary?'<p class="cc-dialog-note">Chưa có số liệu hạn mức.</p>':''}</div>`).join(''):'<p class="cc-dialog-note">Provider chưa cung cấp cửa sổ hạn mức.</p>'}<p class="cc-dialog-note">Token trọn đời do tài khoản báo: ${ccNumber(q.lifetimeTokens)}${q.updatedAt?` · cập nhật ${esc(new Date(q.updatedAt).toLocaleTimeString('vi-VN'))}`:''}</p>`}
function ccUsageDialog(c){
 modal(`<h2>Mức sử dụng · ${esc(c.name)}</h2><p class="cc-dialog-note">Chỉ tổng hợp phản hồi nhận được trong AI Project OS. Các request lỗi, retry hoặc ứng dụng khác có thể phát sinh usage không có trong bảng này. Cache tùy cách tính của provider, không cộng tự động vào đầu vào.</p><div class="cc-usage-table"><table><thead><tr><th>Model / vai trò</th><th>Input</th><th>Output</th><th>Cache đọc</th><th>Cache ghi</th><th>Suy luận</th></tr></thead><tbody>${c.usage?.groups?.map(g=>`<tr><td>${esc(g.model)}<br><small>${esc(g.role||'Chưa xác định vai trò')}</small></td><td>${ccNumber(g.counts?.input)}</td><td>${ccNumber(g.counts?.output)}</td><td>${ccNumber(g.counts?.cacheRead)}</td><td>${ccNumber(g.counts?.cacheWrite)}</td><td>${ccNumber(g.counts?.reasoning)}</td></tr><tr><td colspan="6"><small>Độ phủ input/output/cache đọc/cache ghi/suy luận: ${['input','output','cacheRead','cacheWrite','reasoning'].map(k=>`${g.coverage?.[k]||0}/${g.responses}`).join(' · ')} phản hồi</small></td></tr>`).join('')||'<tr><td colspan="6">Chưa có số liệu</td></tr>'}</tbody></table></div><h3>Giới hạn gói</h3>${c.kind==='chatgpt_account'?`<div id="ccQuotaBody">${ccQuotaMarkup(ccQuota?.id===c.id&&ccQuota?.revision===c.credentialVersion?ccQuota:ccQuotaCache.get(c.id)?.revision===c.credentialVersion?ccQuotaCache.get(c.id)?.data:null)}</div><button id="ccRefreshQuota" class="primary">Làm mới hạn mức</button>`:'<p class="cc-dialog-note">Kết nối API/CLI này chưa có giao diện chính thức đọc hạn mức gói. Chưa có số liệu; xem billing tại provider.</p>'}<div id="ccDialogError" class="cc-dialog-error" role="status"></div>`);
 if(c.kind==='chatgpt_account')$('#ccRefreshQuota').onclick=async e=>{e.target.disabled=true;try{const q=await api(`/api/accounts/${encodeURIComponent(c.id)}/usage`);ccQuota={...q,id:c.id,revision:c.credentialVersion};ccQuotaCache.set(c.id,{revision:c.credentialVersion,at:Date.now(),data:q});$('#ccQuotaBody').innerHTML=ccQuotaMarkup(q);const inline=$(`[data-quota-account="${CSS.escape(c.id)}"]`);if(inline)inline.outerHTML=ccQuotaPanel(c)}catch(err){$('#ccDialogError').textContent=err.message}finally{e.target.disabled=false}};
 if(c.kind==='chatgpt_account'&&!ccQuotaCache.get(c.id)?.data&&!ccQuotaPending.has(c.id))$('#ccRefreshQuota').click();
}
function ccOtherAIMethod(kind,id){
 if(ccNeedVault())return;
 const isGoogle=kind==='gemini',provider=isGoogle?'Google Gemini':'Anthropic Claude';
 const c=id==='new'?null:(state.connections.find(x=>x.id===id)||ccCurrent(kind));
 modal(`<h2>Kết nối ${provider}</h2><p class="cc-dialog-note">Chọn cách kết nối chính thức. Không cần nhập mật khẩu hay cookie website vào AI Project OS.</p>${c?`<div class="cc-dialog-status">${esc(c.name)} · ${c.kind.endsWith('_account')?'Tài khoản đăng nhập':'API key'}</div>`:''}${isGoogle?`<p class="cc-dialog-note"><strong>Google đã dừng Gemini CLI đăng nhập cá nhân từ 18/6/2026.</strong> Hãy dùng Antigravity với tài khoản Google hoặc API key từ AI Studio.</p><div class="cc-method-grid"><button id="ccOtherAccount" class="primary">Đăng nhập Google<small>Google Antigravity CLI · gói cá nhân</small></button><button id="ccOtherAPI" class="ghost">Dùng Gemini API key<small>AI Studio · hạn mức/chi phí riêng</small></button></div><div class="cc-dialog-actions"><button id="ccGoogleEnterprise" class="ghost">Gemini CLI cho doanh nghiệp (nếu có giấy phép)</button></div><p class="cc-dialog-note"><a href="https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals" target="_blank" rel="noopener noreferrer">Thông báo chính thức của Google ↗</a></p>`:`<div class="cc-method-grid"><button id="ccOtherAccount" class="primary">Đăng nhập Claude<small>Qua Claude Code chính thức</small></button><button id="ccOtherAPI" class="ghost">Dùng Claude API key<small>Lưu mã hóa trong Secret Vault</small></button></div>`}`);
 $('#ccOtherAPI').onclick=()=>ccConnectionDialog(kind,c?.kind===kind?c.id:'new',true);
 $('#ccOtherAccount').onclick=()=>isGoogle?ccAntigravityDialog(c?.kind==='antigravity_account'?c:null):ccCliAccountDialog('claude',c?.kind==='claude_account'?c:null);
 if(isGoogle)$('#ccGoogleEnterprise').onclick=()=>ccCliAccountDialog('gemini',c?.kind==='gemini_account'?c:null);
}
function ccAntigravityDialog(c){
 if(ccNeedVault())return;
 modal(`<h2>${c?'Quản lý':'Đăng nhập'} Google · Antigravity</h2><p class="cc-dialog-note">Dùng tài khoản Google cá nhân (Free, Pro, Ultra) với công cụ mới của Google. Ứng dụng không đọc mật khẩu, cookie hay token Google. <strong>Mỗi tài khoản Antigravity có một phiên Google riêng trên máy — thêm bao nhiêu tài khoản cũng được, giống ChatGPT</strong>; cửa sổ đăng nhập luôn ghi rõ đang đăng nhập cho tài khoản nào.</p><div class="cc-dialog-status" id="ccAgyStatus">${esc(c?.availability?.status==='verified'?'Đã xác minh model: '+c.availability.models.join(', '):(c?.availability?.catalogModels||[]).length?'Đã có danh mục model (chưa xác minh phản hồi — vẫn chọn và chạy được).':'Chưa có danh mục model.')}</div><label>Tên kết nối (tên này cũng là tên robot trong văn phòng)</label><input id="ccAgyName" value="${esc(c?.name||'Google Antigravity')}"><div class="cc-dialog-actions"><button class="primary" id="ccAgyInstall">1. Tự cài Antigravity trên Windows</button><a href="https://www.antigravity.google/docs/cli/install/" target="_blank" rel="noopener noreferrer" class="cc-auth-link">Cài từ Google ↗</a><button class="ghost" id="ccAgyCheck">Kiểm tra đã cài</button></div><div class="cc-dialog-actions"><button class="primary" id="ccAgyLogin">2. ${c?'Đăng nhập lại tài khoản Google này':'Tạo kết nối & đăng nhập Google'}</button></div><div class="cc-account-models"><label for="ccAgyModel">Model tài khoản</label><select id="ccAgyModel" ${c?'':'disabled'}>${ccOptions(c?.availability?.catalogModels||[],c?.model,'Tải model thật từ Google')}</select><div class="cc-dialog-actions"><button class="ghost" id="ccAgyModels" ${c?'':'disabled'}>Tải model khả dụng</button><button class="primary" id="ccAgyVerify" ${c?'':'disabled'}>3. Xác minh & sử dụng</button></div></div>${c?'<div class="cc-dialog-actions"><button class="ghost" id="ccAgyAddAnother">＋ Thêm tài khoản Antigravity khác</button><button class="ghost" id="ccAgyRename">Lưu tên hiển thị</button><button class="ghost" id="ccAgyDelete">Xóa kết nối</button></div>':''}<p class="cc-dialog-note">Hạn mức do Google quản lý theo gói của tài khoản; app không đọc trước được. Nếu tài khoản chạm hạn mức khi chạy, app tự cho nó nghỉ và chuyển việc sang tài khoản khác trong bể. Google có thể áp dụng hạn mức gói. Không có tài khoản hợp lệ? <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Tạo Gemini API key tại Google AI Studio ↗</a> (chi phí riêng) rồi dùng nút API key trong Kết nối.</p><p id="ccAgyError" class="cc-dialog-error" role="status"></p>`);
 const status=$('#ccAgyStatus'),error=$('#ccAgyError');
 const busy=async(btn,act)=>{btn.disabled=true;error.textContent='';try{await act()}catch(e){error.textContent=e.message}finally{btn.disabled=false}};
 $('#ccAgyInstall').onclick=e=>busy(e.target,async()=>{status.textContent='Windows đang cài Antigravity chính thức qua WinGet, vui lòng chờ…';const r=await api('/api/antigravity/install',{method:'POST',body:'{}'});status.textContent=r.message;});
 $('#ccAgyCheck').onclick=e=>busy(e.target,async()=>{const r=await api('/api/antigravity/status');status.textContent=r.installed?'Đã tìm thấy Google Antigravity CLI.':'Chưa có Antigravity CLI. Hãy cài từ website Google.';});
 $('#ccAgyLogin').onclick=e=>busy(e.target,async()=>{
  // Thêm tài khoản (giống ChatGPT): tạo kết nối TRƯỚC rồi mở cửa sổ đăng
  // nhập Google của CHÍNH kết nối đó — phiên Google vào đúng hồ sơ riêng.
  let target=c;
  if(!target){const r=await api('/api/antigravity/connect',{method:'POST',body:JSON.stringify({name:$('#ccAgyName').value})});await loadConnections();target=state.connections.find(x=>x.id===r.id);if(!target)throw new Error('Đã tạo kết nối nhưng chưa thấy trong danh sách.');}
  status.textContent='Đang mở Antigravity CLI chính thức…';
  const r=await api('/api/antigravity/login',{method:'POST',body:JSON.stringify({id:target.id})});status.textContent=r.message;
  if(!c)ccAntigravityDialog(state.connections.find(x=>x.id===target.id));
 });
 if(c){
  $('#ccAgyAddAnother').onclick=()=>ccAntigravityDialog(null);
  $('#ccAgyRename').onclick=e=>busy(e.target,async()=>{await api(`/api/connections/${encodeURIComponent(c.id)}/name`,{method:'POST',body:JSON.stringify({name:$('#ccAgyName').value})});await loadConnections();toast('Đã lưu tên hiển thị — robot trong văn phòng đã đổi tên theo');ccAntigravityDialog(state.connections.find(x=>x.id===c.id));});
  $('#ccAgyModels').onclick=e=>busy(e.target,async()=>{status.textContent='Đang lấy danh sách model từ Antigravity CLI…';const models=await api(`/api/antigravity/${encodeURIComponent(c.id)}/models`);$('#ccAgyModel').innerHTML=ccOptions(models,c.model,'Chọn model từ Google');status.textContent='Đã tải '+models.length+' model. Chọn một model rồi bấm Xác minh.';});
  $('#ccAgyVerify').onclick=e=>busy(e.target,async()=>{const model=$('#ccAgyModel').value;if(!model)throw new Error('Hãy tải và chọn model trước.');status.textContent='Đang gọi thử model thật. Yêu cầu này có thể tính vào hạn mức Google…';await api(`/api/antigravity/${encodeURIComponent(c.id)}/verify`,{method:'POST',body:JSON.stringify({model})});await api(`/api/connections/${encodeURIComponent(c.id)}/model`,{method:'POST',body:JSON.stringify({model})});await loadConnections();ccAntigravityDialog(state.connections.find(x=>x.id===c.id));});
  if(!(c.availability?.catalogModels||[]).length)$('#ccAgyModels').click();
  $('#ccAgyDelete').onclick=()=>{modal(`<h2>Xóa kết nối Google Antigravity</h2><p class="cc-dialog-note">Xóa khỏi Vault. Chỉ tài khoản này bị ảnh hưởng — các tài khoản Antigravity khác giữ nguyên phiên Google của chúng. Để hủy hẳn phiên Google của tài khoản này, mở Antigravity bằng hồ sơ của nó và gõ /logout.</p><button class="primary" id="ccAgyConfirmDelete">Xác nhận xóa</button><p id="ccDialogError" class="cc-dialog-error"></p>`);$('#ccAgyConfirmDelete').onclick=async e=>{e.target.disabled=true;try{await api('/api/connections/'+encodeURIComponent(c.id),{method:'DELETE'});await loadConnections();$('#modal').classList.add('hidden')}catch(err){$('#ccDialogError').textContent=err.message;e.target.disabled=false}};};
 }
}
function ccCliAccountDialog(kind,c){
 if(ccNeedVault())return;
 const provider=kind==='gemini'?'Google Gemini':'Claude Code';
 const guessed=c?.model||(kind==='claude'?'sonnet':'gemini-2.5-flash');
 modal(`<h2>${c?'Quản lý':'Đăng nhập'} ${provider}</h2><p class="cc-dialog-note">Cài ${provider} CLI chính thức, đăng nhập qua cửa sổ riêng trên máy, rồi xác minh bằng yêu cầu AI ngắn. Phần mềm không hỏi hoặc lưu mật khẩu/cookie website. Mỗi tài khoản có một hồ sơ đăng nhập CLI riêng trên máy — thêm bao nhiêu tài khoản cũng được, giống ChatGPT; cửa sổ đăng nhập luôn ghi rõ đang đăng nhập cho tài khoản nào.</p><label for="ccCliName">Tên hiển thị (tên này cũng là tên robot trong văn phòng)</label><input id="ccCliName" value="${esc(c?.name||provider+' account')}"><div id="ccCliStatus" class="cc-dialog-status">${esc(c?.availability?.status==='verified'?'Đã xác minh model thật: '+(c.availability.models||[]).join(', '):(c?.availability?.models||[]).length?'Đã có danh mục model (chưa xác minh phản hồi — vẫn chọn và chạy được).':'Chưa xác minh phản hồi của model.')}</div><div class="cc-dialog-actions"><button id="ccCliInstall" class="ghost">1. Cài ${provider} CLI</button><button id="ccCliLogin" class="ghost">2. ${c?'Mở đăng nhập chính thức':'Tạo kết nối & mở đăng nhập'}</button></div><label for="ccCliModel">Model cần xác minh</label><input id="ccCliModel" value="${esc(guessed)}" placeholder="Nhập model hoặc alias từ nhà cung cấp"><p class="cc-dialog-note">Mã model chỉ là gợi ý, chưa chắc tài khoản có quyền sử dụng. Xác minh sẽ gọi AI thật, có thể tiêu hao hạn mức hoặc phát sinh phí tùy gói. Hạn mức của tài khoản này do hãng quản lý, app không đọc trước được — nếu tài khoản chạm hạn mức khi chạy, app tự chuyển sang tài khoản khác trong bể.</p><div class="cc-dialog-actions"><button id="ccCliVerify" class="primary" ${c?'':'disabled'}>3. Xác minh phản hồi & chọn model</button>${c?'<button id="ccCliAddAnother" class="ghost">＋ Thêm tài khoản khác</button><button id="ccCliRename" class="ghost">Lưu tên hiển thị</button><button id="ccCliRemove" class="ghost">Xóa kết nối</button>':''}</div><div id="ccDialogError" class="cc-dialog-error" role="status"></div><p class="cc-dialog-note">Không cài được? Chạy <code>INSTALL-AI-TOOLS-WINDOWS.cmd</code> trong thư mục ứng dụng. Đăng nhập riêng qua <code>${kind==='claude'?'LOGIN-CLAUDE-WINDOWS.cmd':'LOGIN-GEMINI-WINDOWS.cmd'}</code>.</p>`);
 const inform=(s)=>{if($('#ccCliStatus'))$('#ccCliStatus').textContent=s};
 const busy=async(e,fn)=>{e.target.disabled=true;try{await fn()}catch(err){if($('#ccDialogError'))$('#ccDialogError').textContent=err.message}finally{e.target.disabled=false}};
 $('#ccCliInstall').onclick=e=>busy(e,async()=>{inform('Đang cài CLI chính thức, cần Internet lần đầu…');await api(`/api/ai-tools/${kind}/install`,{method:'POST',body:'{}'});inform('Cài CLI hoàn tất. Bấm mở đăng nhập chính thức.')});
 $('#ccCliLogin').onclick=e=>busy(e,async()=>{
  // Thêm tài khoản: tạo kết nối TRƯỚC rồi mở cửa sổ đăng nhập của CHÍNH
  // kết nối đó — phiên CLI vào đúng hồ sơ riêng của tài khoản này.
  let target=c;
  if(!target){const result=await api(`/api/cli-accounts/${kind}/connect`,{method:'POST',body:JSON.stringify({name:$('#ccCliName').value})});await loadConnections();target=state.connections.find(x=>x.id===result.id);if(!target)throw new Error('Đã tạo kết nối nhưng chưa thấy trong danh sách.');}
  const result=await api(`/api/cli-accounts/${kind}/login`,{method:'POST',body:JSON.stringify({id:target.id})});inform(result.message||'Đã mở cửa sổ đăng nhập chính thức.');
  if(!c)ccCliAccountDialog(kind,state.connections.find(x=>x.id===target.id));
 });
 if(c){
  $('#ccCliAddAnother').onclick=()=>ccCliAccountDialog(kind,null);
  $('#ccCliRename').onclick=e=>busy(e,async()=>{await api(`/api/connections/${encodeURIComponent(c.id)}/name`,{method:'POST',body:JSON.stringify({name:$('#ccCliName').value})});await loadConnections();toast('Đã lưu tên hiển thị — robot trong văn phòng đã đổi tên theo');ccCliAccountDialog(kind,state.connections.find(x=>x.id===c.id));});
  $('#ccCliVerify').onclick=e=>busy(e,async()=>{
   const model=$('#ccCliModel').value.trim();if(!model)throw new Error('Nhập model cần kiểm tra.');
   inform('Đang yêu cầu model phản hồi thật qua CLI chính thức (có thể dùng hạn mức)…');
   await api(`/api/cli-accounts/${encodeURIComponent(c.id)}/verify`,{method:'POST',body:JSON.stringify({model})});
   await api(`/api/connections/${encodeURIComponent(c.id)}/model`,{method:'POST',body:JSON.stringify({model})});
   await loadConnections();ccCliAccountDialog(kind,state.connections.find(x=>x.id===c.id));
  });
  $('#ccCliRemove').onclick=()=>{modal(`<h2>Xóa kết nối ${esc(c.name)}</h2><p class="cc-dialog-note">Xóa kết nối này trong Secret Vault. Phiên đăng nhập CLI trong thư mục người dùng không tự bị xóa: hãy dùng công cụ CLI của provider để đăng xuất khi cần.</p><button class="primary" id="ccCliConfirmRemove">Xóa kết nối</button><div id="ccDialogError" class="cc-dialog-error" role="status"></div>`);$('#ccCliConfirmRemove').onclick=e=>busy(e,async()=>{await api(`/api/connections/${encodeURIComponent(c.id)}`,{method:'DELETE'});await loadConnections();$('#modal').classList.add('hidden')});};
 }
}
function ccOpenAIMethod(id){
 if(ccNeedVault())return;const c=id==='new'?null:state.connections.find(x=>x.id===id)||ccCurrent('openai');
 modal(`<h2>Kết nối OpenAI / ChatGPT</h2><p class="cc-dialog-note">Chọn phương thức cho tài khoản này. Có thể thêm nhiều tài khoản và phân vai Founder, Worker, Council và Reviewer cho từng tài khoản.</p>${c?`<div class="cc-dialog-status">${esc(c.name)} · ${c.kind==='chatgpt_account'?'Tài khoản ChatGPT':'API key'}</div>`:''}<div class="cc-method-grid"><button id="ccChooseAPI" class="ghost">API key chính thức<small>Lưu mã hóa trong Secret Vault</small></button><button id="ccChooseAccount" class="primary">Đăng nhập ChatGPT<small>Qua Codex CLI trên máy của bạn</small></button></div><p class="cc-dialog-note">Google cá nhân dùng Antigravity thay cho Gemini CLI cũ; Anthropic hỗ trợ Claude Code hoặc API key. Không nhập mật khẩu hay cookie website.</p>`);
 $('#ccChooseAPI').onclick=()=>ccConnectionDialog('openai',c?.kind==='openai'?c.id:'new',true);$('#ccChooseAccount').onclick=()=>ccAccountDialog(c?.kind==='chatgpt_account'?c:null);
}
function ccAccountDialog(c){
 clearTimeout(ccAuthPoll);const dialogKey=String(Date.now());
 modal(`<h2>${c?'Quản lý':'Đăng nhập'} ChatGPT</h2><p class="cc-dialog-note">Mở trang đăng nhập chính thức do Codex CLI tạo. Thông tin đăng nhập được Codex quản lý trong hồ sơ riêng trên máy, tách khỏi Secret Vault; mở Vault để dùng hồ sơ này.</p><label for="ccAccountName">Tên tài khoản (tên này cũng là tên robot trong văn phòng)</label><input id="ccAccountName" value="${esc(c?.name||'ChatGPT account')}"><label for="ccAuthType">Cách đăng nhập</label><select id="ccAuthType"><option value="chatgpt">Trình duyệt (callback cục bộ)</option><option value="chatgptDeviceCode">Mã thiết bị</option></select><div id="ccAccountState" data-dialog-key="${dialogKey}" class="cc-dialog-status">${esc(c?.meta?.accountIdentity||'Chưa đăng nhập')}<br>${esc(c?.availability?.message||'Cần Codex CLI trên máy chạy ứng dụng.')}</div><div id="ccAuthLink"></div>${ccAccountQuotaWarning(c)}<div id="ccAccountQuotaSummary">${c?ccAccountQuotaSummary(c):''}</div><div class="cc-dialog-actions"><button id="ccLogin" class="primary">${c?'Đăng nhập lại':'Đăng nhập'}</button><button id="ccCheckLogin" class="ghost" ${c?'':'disabled'}>Kiểm tra trạng thái</button><button id="ccCancelLogin" class="ghost" disabled>Hủy đăng nhập</button>${c?'<button id="ccLogout" class="ghost">Đăng xuất</button><button id="ccAccountQuota" class="ghost">Xem hạn mức</button><button id="ccRenameAccount" class="ghost">Lưu tên hiển thị</button><button id="ccDeleteAccount" class="ghost">Xóa kết nối</button>':''}</div>${c?`<div class="cc-account-models"><label for="ccAccountModel">Model tài khoản (chọn là phân vai được ngay — xác minh chỉ để kiểm tra phản hồi)</label><select id="ccAccountModel">${ccOptions(c.availability?.catalogModels||[],c.model,'Làm mới danh mục model')}</select><div class="cc-dialog-actions"><button id="ccAccountModels" class="ghost">Làm mới model</button><button id="ccVerifyAccountModel" class="primary">Xác minh model</button></div></div>`:''}<div class="cc-dialog-actions"><button id="ccInstallCodex" class="ghost">Cài Codex CLI cho máy này</button><a href="https://developers.openai.com/codex/cli" target="_blank" rel="noopener noreferrer">Hướng dẫn chính thức ↗</a></div><p class="cc-dialog-note">Cài đặt cần Internet lần đầu. Công cụ được lưu trong thư mục ứng dụng của tài khoản Windows; dữ liệu dự án không bị thay thế.</p><div id="ccDialogError" class="cc-dialog-error" role="status"></div>`);
 let id=c?.id;const current=()=>$('#ccAccountState')?.dataset.dialogKey===dialogKey&&!$('#modal').classList.contains('hidden');
 $('#ccInstallCodex').onclick=async e=>{e.target.disabled=true;$('#ccDialogError').textContent='Đang cài Codex CLI chính thức (cần Internet). Không đóng ứng dụng.';try{await api('/api/ai-tools/codex/install',{method:'POST',body:'{}'});$('#ccDialogError').textContent='Đã cài Codex. Bấm Đăng nhập để tiếp tục.'}catch(err){$('#ccDialogError').textContent=err.message}finally{e.target.disabled=false}};
 const check=async()=>{if(!id||!current())return;try{const r=await api(`/api/accounts/${encodeURIComponent(id)}/status`);if(!current())return;$('#ccAccountState').textContent=`${{connected:'Đã đăng nhập',pending:'Đang chờ đăng nhập',checking:'Đang xác minh',disconnected:'Chưa đăng nhập',error:'Đăng nhập lỗi',expired:'Phiên đã hết hạn'}[r.state]||r.state}${r.account?.email?' · '+r.account.email:''}\n${r.inference?.reason||''}`;if(r.state==='pending'||r.state==='checking')ccAuthPoll=setTimeout(check,2500);else{clearTimeout(ccAuthPoll);ccAccounts.openai=id;ccUsageSelected=id;await loadConnections();if(r.state==='connected'&&!c)ccAccountDialog(state.connections.find(x=>x.id===id));else if(r.state==='connected'&&current()){const fresh=state.connections.find(x=>x.id===id),sel=$('#ccAccountModel');if(fresh&&sel){sel.innerHTML=ccOptions(fresh.availability?.catalogModels||[],fresh.model);if(fresh.availability?.catalogStale||!(fresh.availability?.catalogModels||[]).length){$('#ccAccountState').textContent+='\nĐang làm mới danh mục model…';setTimeout(async()=>{await loadConnections();if(!current())return;const f2=state.connections.find(x=>x.id===id),s2=$('#ccAccountModel');if(f2&&s2)s2.innerHTML=ccOptions(f2.availability?.catalogModels||[],f2.model);},4000);}}const qs=$('#ccAccountQuotaSummary');if(qs&&fresh)qs.innerHTML=ccAccountQuotaSummary(fresh);}}}catch(e){if(current())$('#ccDialogError').textContent=e.message}};
 if(c)void ccFetchQuota(c).then(()=>{const el=$('#ccAccountQuotaSummary');if(el&&current())el.innerHTML=ccAccountQuotaSummary(state.connections.find(x=>x.id===id)||c)});
 $('#ccLogin').onclick=async e=>{e.target.disabled=true;try{const r=await api('/api/accounts/login',{method:'POST',body:JSON.stringify({id,name:$('#ccAccountName').value,type:$('#ccAuthType').value})});id=r.id;ccAccounts.openai=id;ccUsageSelected=id;if(!current())return;$('#ccCheckLogin').disabled=false;$('#ccCancelLogin').disabled=false;const link=r.login.authUrl||r.login.verificationUrl;$('#ccAuthLink').innerHTML=`<a class="cc-auth-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Mở trang đăng nhập OpenAI ↗</a>${r.login.userCode?`<p>Mã thiết bị: <strong>${esc(r.login.userCode)}</strong></p>`:''}`;$('#ccAccountState').textContent='Đang chờ bạn hoàn tất đăng nhập trên trang chính thức…';ccAuthPoll=setTimeout(check,2500);await loadConnections();}catch(err){if(current())$('#ccDialogError').textContent=err.message}finally{e.target.disabled=false}};
 $('#ccCheckLogin').onclick=check;$('#ccCancelLogin').onclick=async()=>{try{clearTimeout(ccAuthPoll);await api(`/api/accounts/${encodeURIComponent(id)}/cancel`,{method:'POST',body:'{}'});$('#ccAccountState').textContent='Đã hủy đăng nhập.';$('#ccAuthLink').textContent='';}catch(e){$('#ccDialogError').textContent=e.message}};
 if(c){$('#ccAccountModels').onclick=async e=>{e.target.disabled=true;try{const models=await api(`/api/connections/${encodeURIComponent(id)}/models`);$('#ccAccountModel').innerHTML=ccOptions(models,c.model);await loadConnections()}catch(err){$('#ccDialogError').textContent=err.message}finally{e.target.disabled=false}};$('#ccVerifyAccountModel').onclick=async e=>{e.target.disabled=true;try{const model=$('#ccAccountModel').value;if(!model)throw new Error('Chọn model từ danh mục trước.');$('#ccDialogError').textContent='Đang gửi một yêu cầu ngắn để xác minh model (có sử dụng hạn mức)…';await api(`/api/accounts/${encodeURIComponent(id)}/verify`,{method:'POST',body:JSON.stringify({model})});await api(`/api/connections/${encodeURIComponent(id)}/model`,{method:'POST',body:JSON.stringify({model})});await loadConnections();$('#ccDialogError').textContent='Đã xác minh: model phản hồi tốt. Model này đã có thể chọn cho mọi vai.';}catch(err){$('#ccDialogError').textContent=err.message}finally{e.target.disabled=false}};$('#ccRenameAccount').onclick=async e=>{e.target.disabled=true;try{await api(`/api/connections/${encodeURIComponent(id)}/name`,{method:'POST',body:JSON.stringify({name:$('#ccAccountName').value})});await loadConnections();toast('Đã lưu tên hiển thị — robot trong văn phòng đã đổi tên theo');ccAccountDialog(state.connections.find(x=>x.id===id));}catch(err){$('#ccDialogError').textContent=err.message;e.target.disabled=false}};$('#ccLogout').onclick=async e=>{e.target.disabled=true;try{clearTimeout(ccAuthPoll);await api(`/api/accounts/${encodeURIComponent(id)}/logout`,{method:'POST',body:'{}'});await loadConnections();ccAccountDialog(state.connections.find(x=>x.id===id));}catch(err){$('#ccDialogError').textContent=err.message;e.target.disabled=false}};$('#ccAccountQuota').onclick=()=>ccUsageDialog(c);$('#ccDeleteAccount').onclick=()=>{clearTimeout(ccAuthPoll);modal(`<h2>Xóa kết nối ${esc(c.name)}</h2><p class="cc-dialog-note">Đăng xuất và xóa hồ sơ credential riêng của tài khoản trên máy. Các vai trò dùng kết nối này sẽ cần được phân lại.</p><button id="ccConfirmAccountDelete" class="primary">Đăng xuất & xóa</button><div id="ccDialogError" class="cc-dialog-error" role="status"></div>`);$('#ccConfirmAccountDelete').onclick=async e=>{e.target.disabled=true;try{await api(`/api/connections/${encodeURIComponent(id)}`,{method:'DELETE'});await loadConnections();$('#modal').classList.add('hidden')}catch(err){$('#ccDialogError').textContent=err.message;e.target.disabled=false}}};}
}

document.addEventListener('connections-change',()=>{ccQuota=null;if(!state.vault?.unlocked)ccQuotaCache.clear()});

// --- Signed update panel ---
async function renderUpdatePanel(){
  const box=$('#updatePanel');if(!box)return;
  try{
    const upd=await api('/api/update/status');
    box.innerHTML=`
      <div class="cc-dialog-status">Bản hiện tại: v${esc(upd.currentVersion)}${upd.pending?` · ĐÃ TẢI v${esc(upd.pending.version)} — khởi động lại ứng dụng để áp dụng`:''}${upd.lastUpdate?` · Lần cập nhật gần nhất: v${esc(upd.lastUpdate.version)} (${esc(String(upd.lastUpdate.at||'').slice(0,10))})`:''}${upd.lastFailure?` · Lần áp dụng lỗi gần nhất: ${esc(upd.lastFailure.code||'')} (đã tự khôi phục bản cũ)`:''}</div>
      <label for="updUrl">Địa chỉ manifest cập nhật (nhà phát hành cung cấp)</label>
      <input id="updUrl" value="${esc(upd.url||'')}" placeholder="https://…/update-manifest.json">
      <div class="cc-dialog-actions"><button id="updSaveUrl" class="ghost">Lưu địa chỉ</button><button id="updCheck" class="ghost">Kiểm tra cập nhật</button><button id="updDownload" class="primary">Tải bản mới (áp dụng khi khởi động lại)</button></div>
      <div id="updPanelMsg" class="cc-dialog-note" role="status"></div>`;
    const msg=t=>{const m=$('#updPanelMsg');if(m)m.textContent=t};
    $('#updSaveUrl').onclick=async e=>{e.target.disabled=true;try{await api('/api/update/config',{method:'POST',body:JSON.stringify({url:$('#updUrl').value})});msg('Đã lưu địa chỉ cập nhật.');await renderUpdatePanel()}catch(err){msg(err.message)}finally{e.target.disabled=false}};
    $('#updCheck').onclick=async e=>{e.target.disabled=true;try{const r=await api('/api/update/check',{method:'POST',body:'{}'});msg(!r.configured?'Chưa cấu hình địa chỉ cập nhật.':r.available?`Có bản mới v${r.manifest.version}. Bấm "Tải bản mới" để tải về.`:'Bạn đang ở bản mới nhất.')}catch(err){msg(err.message)}finally{e.target.disabled=false}};
    $('#updDownload').onclick=async e=>{e.target.disabled=true;try{const r=await api('/api/update/download',{method:'POST',body:'{}'});msg(r.downloaded?`Đã tải và kiểm chứng chữ ký + SHA-256 của v${r.version}. Khởi động lại ứng dụng để áp dụng — bản cũ được sao lưu tự động.`:'Đang ở bản mới nhất, không có gì để tải.');await renderUpdatePanel()}catch(err){msg(err.message)}finally{e.target.disabled=false}};
  }catch(e){box.innerHTML=`<p class="cc-dialog-note">Không tải được trạng thái cập nhật: ${esc(e.message||e)}</p>`}
}
document.addEventListener('page-change',e=>{if(e.detail?.page==='connections')renderUpdatePanel()});

// --- External operator channel panel ---
async function renderOperatorPanel(){
  const box=$('#operatorPanel');if(!box)return;
  try{
    const {status,notes}=await api('/api/operator');
    const scopeName={run:'Tạo lượt chạy vòng khép kín',note:'Gửi ghi chú / tư vấn vào bàn tiếp nhận',approvePublish:'Duyệt đăng thay Sếp'};
    if(!status.enabled){
      box.innerHTML=`
      <p class="cc-dialog-note">Chưa cấp quyền cho ai. Tạo một token và chọn đúng việc được phép làm:</p>
      <label class="checkboxLine"><input type="checkbox" id="opScopeRun" checked> ${scopeName.run}</label>
      <label class="checkboxLine"><input type="checkbox" id="opScopeNote" checked> ${scopeName.note}</label>
      <label class="checkboxLine"><input type="checkbox" id="opScopeApprove"> ${scopeName.approvePublish} <b>(cân nhắc — mặc định tắt, Sếp giữ cổng duyệt)</b></label>
      <div class="cc-dialog-actions"><button id="opCreate" class="primary">Tạo token điều phối</button></div>
      <div id="opMsg" class="cc-dialog-note" role="status"></div>`;
      $('#opCreate').onclick=async e=>{e.target.disabled=true;try{
        const r=await api('/api/operator/token',{method:'POST',body:JSON.stringify({scopes:{run:$('#opScopeRun').checked,note:$('#opScopeNote').checked,approvePublish:$('#opScopeApprove').checked}})});
        box.innerHTML=`
        <div class="cc-dialog-status">✅ Đã tạo token. <b>Token chỉ hiện MỘT lần này</b> — sao chép ngay và gửi cho trợ lý của Sếp qua kênh riêng:</div>
        <label for="opTokenValue">Token điều phối</label>
        <input id="opTokenValue" readonly value="${esc(r.token)}" onclick="this.select()">
        <p class="cc-dialog-note">Để trợ lý với tới app (app chỉ nghe trong máy này):<br>1) Cài <b>Tailscale</b> trên máy này và đăng nhập tài khoản của Sếp (miễn phí).<br>2) Mở CMD, chạy: <code>tailscale serve --bg 4321</code> — Tailscale cho một địa chỉ dạng <code>https://ten-may.xxxx.ts.net</code> chỉ các máy trong mạng riêng của Sếp mới vào được.<br>3) Gửi cho trợ lý <b>địa chỉ đó + token ở trên</b>. Trợ lý xem trạng thái, giao việc, gửi tư vấn vào bàn tiếp nhận — mọi việc đều ghi lại ở đây và ở mục “Đội AI bàn việc”.<br>Muốn cắt quyền: bấm “Thu hồi token” — token cũ chết ngay.</p>
        <div class="cc-dialog-actions"><button id="opDone" class="primary">Đã sao chép xong</button></div>`;
        $('#opDone').onclick=()=>renderOperatorPanel();
      }catch(err){const m=$('#opMsg');if(m)m.textContent=err.message;e.target.disabled=false}};
    }else{
      box.innerHTML=`
      <div class="cc-dialog-status">🟢 Kênh điều phối ĐANG MỞ · tạo lúc ${esc(String(status.createdAt||'').slice(0,16).replace('T',' '))}<br>Quyền đã cấp: ${Object.entries(status.scopes).filter(([,v])=>v).map(([k])=>esc(scopeName[k]||k)).join(' · ')||'chưa có quyền nào'}</div>
      ${(notes||[]).length?`<p class="cc-dialog-note">Ghi chú điều phối gần nhất:</p>${notes.slice(-5).reverse().map(n=>`<div class="cc-dialog-status">${esc(String(n.at||'').slice(0,16).replace('T',' '))} — ${esc(n.text)}</div>`).join('')}`:'<p class="cc-dialog-note">Chưa có ghi chú nào từ kênh điều phối.</p>'}
      <div class="cc-dialog-actions"><button id="opRevoke" class="ghost">Thu hồi token (cắt quyền ngay)</button><button id="opRecreate" class="ghost">Tạo lại token mới</button></div>
      <div id="opMsg" class="cc-dialog-note" role="status"></div>`;
      $('#opRevoke').onclick=async e=>{e.target.disabled=true;try{await api('/api/operator/token',{method:'DELETE'});renderOperatorPanel();toast('Đã thu hồi token điều phối')}catch(err){const m=$('#opMsg');if(m)m.textContent=err.message;e.target.disabled=false}};
      $('#opRecreate').onclick=async e=>{e.target.disabled=true;try{await api('/api/operator/token',{method:'DELETE'});renderOperatorPanel();toast('Đã hủy token cũ — tạo token mới ở bước tiếp theo')}catch(err){const m=$('#opMsg');if(m)m.textContent=err.message;e.target.disabled=false}};
    }
  }catch(e){box.innerHTML=`<p class="cc-dialog-note">Không tải được trạng thái điều phối: ${esc(e.message||e)}</p>`}
}
document.addEventListener('page-change',e=>{if(e.detail?.page==='connections')renderOperatorPanel()});

/* ---- Platform linking for auto-posting (YouTube / Facebook / TikTok) ---- */
const ccPlatforms=[['youtube','YouTube','Đăng video lên kênh YouTube của bạn.','https://console.cloud.google.com/apis/credentials','Google Cloud Console','youtube.upload, youtube.readonly'],['facebook','Facebook Page','Đăng video lên Facebook Page bạn quản lý.','https://developers.facebook.com/apps','Meta for Developers','pages_show_list, pages_manage_posts, pages_read_engagement'],['tiktok','TikTok','Đăng video lên tài khoản TikTok của bạn.','https://developers.tiktok.com','TikTok Developers','user.info.basic, video.upload, video.publish']];
function ccPlatformConn(kind){return state.connections.find(c=>c.kind===kind)}
function renderConnectionPlatforms(){
 const box=$('#platformGrid');if(!box)return;
 box.innerHTML=ccPlatforms.map(([kind,title,desc])=>{
  const c=ccPlatformConn(kind);
  const status=!state.vault?.unlocked?['locked','Vault đang khóa']:c?['connected','Đã liên kết']:['','Chưa liên kết'];
  let detail=desc;
  if(c){
   detail=c.meta?.accountLabel||c.name||'Đã liên kết';
   if(kind==='facebook')detail+=c.meta?.pageName?` · Page: ${c.meta.pageName}`:' · Chưa chọn Page — bấm Quản lý liên kết để chọn';
   if(kind==='tiktok'&&c.meta?.tiktokApproved!==true)detail+=' · App chưa được TikTok duyệt: chỉ đăng riêng tư được';
   if(c.meta?.linkedAt)detail+=` · ${new Date(c.meta.linkedAt).toLocaleDateString('vi-VN')}`;
  }
  return `<article class="cc-card cc-service"><div class="cc-service-top"><span class="cc-logo ${kind}">${ccLogo(kind)}</span><div class="cc-service-title"><div class="cc-service-heading"><h3>${title}</h3>${ccBadge(status)}</div><p title="${esc(detail)}">${esc(detail)}</p></div></div><div class="cc-service-actions"><button class="cc-button ${c?'':'connect'}" data-platform-link="${kind}">${c?'Quản lý liên kết':'Liên kết & cấp quyền'}</button></div></article>`;
 }).join('');
 $$('#platformGrid [data-platform-link]').forEach(b=>b.onclick=()=>ccPlatformDialog(b.dataset.platformLink));
}
function ccPlatformDialog(kind){
 if(ccNeedVault())return;
 const def=ccPlatforms.find(p=>p[0]===kind);if(!def)return;
 const [,title,desc,devUrl,devName,scopes]=def;
 const c=ccPlatformConn(kind);
 const redirectUri=`${location.origin}/api/connections/oauth/${kind}/callback`;
 modal(`<h2>Liên kết ${esc(title)} để tự động đăng bài</h2><p class="cc-dialog-note">${esc(desc)} Việc cấp quyền diễn ra trên trang chính thức của ${esc(title)} — phần mềm không nhận mật khẩu của bạn. Token lưu trong Secret Vault trên máy này.</p><div class="cc-dialog-status">${c?`Đã liên kết: ${esc(c.meta?.accountLabel||c.name)}${c.meta?.linkedAt?` · ${esc(new Date(c.meta.linkedAt).toLocaleString('vi-VN'))}`:''}`:'Chưa liên kết.'}</div><p class="cc-dialog-note"><strong>Bước 1:</strong> Tạo một ứng dụng nhà phát triển của riêng bạn tại <a href="${devUrl}" target="_blank" rel="noopener noreferrer">${esc(devName)} ↗</a>, rồi dán Redirect URI này vào cấu hình OAuth của ứng dụng đó:</p><input readonly value="${esc(redirectUri)}" onclick="this.select()"><p class="cc-dialog-note"><strong>Bước 2:</strong> Dán Client ID và Client Secret của ứng dụng vào đây. Quyền phần mềm sẽ xin: <em>${esc(scopes)}</em>.</p><label>Client ID</label><input id="ccPfClientId" autocomplete="off" placeholder="${c?'Để trống nếu chỉ liên kết lại bằng ứng dụng cũ — khi đó nhập lại cả hai ô':'Client ID của ứng dụng nền tảng'}"><label>Client Secret</label><input id="ccPfClientSecret" type="password" autocomplete="off" placeholder="Client Secret của ứng dụng nền tảng"><p class="cc-dialog-note"><strong>Bước 3:</strong> Bấm nút dưới đây — trang cấp quyền của ${esc(title)} mở ra, bạn đăng nhập và đồng ý, xong quay lại đây; liên kết tự cập nhật.</p><div class="cc-dialog-actions"><button class="primary" id="ccPfAuthorize">Mở trang cấp quyền của ${esc(title)} →</button>${c?'<button class="ghost" id="ccPfUnlink">Ngắt liên kết</button>':''}</div><div id="ccPfExtra"></div><p id="ccPfError" class="cc-dialog-error" role="status"></p>`);
 const extra=$('#ccPfExtra');
 if(kind==='facebook'&&c){
  const pages=c.meta?.pages||[];
  extra.innerHTML=pages.length?`<label>Page sẽ đăng bài</label><div class="cc-dialog-actions"><select id="ccPfPage">${pages.map(pg=>`<option value="${esc(pg.id)}" ${String(c.meta?.pageId)===String(pg.id)?'selected':''}>${esc(pg.name)}</option>`).join('')}</select><button class="ghost" id="ccPfPickPage">Dùng Page này</button></div><p class="cc-dialog-note">Đăng lên Facebook là đăng lên Page (không phải trang cá nhân). Page token được nền tảng cấp kèm khi liên kết và đã lưu trong Vault.</p>`:'<p class="cc-dialog-note">Tài khoản đã liên kết chưa có Page nào — hãy tạo Page trên Facebook rồi liên kết lại.</p>';
  const pick=$('#ccPfPickPage');if(pick)pick.onclick=async e=>{e.target.disabled=true;try{const r=await api(`/api/connections/${encodeURIComponent(c.id)}/platform-page`,{method:'POST',body:JSON.stringify({pageId:$('#ccPfPage').value})});await loadConnections();ccPlatformDialog(kind);toast(`Đã chọn Page: ${r.meta?.pageName||''}`)}catch(err){$('#ccPfError').textContent=err.message;e.target.disabled=false}};
 }
 if(kind==='tiktok'&&c){
  extra.innerHTML=`<label class="checkboxLine"><input type="checkbox" id="ccPfTiktokApproved" ${c.meta?.tiktokApproved?'checked':''}> Ứng dụng TikTok của tôi ĐÃ được TikTok duyệt đăng công khai</label><p class="cc-dialog-note">Chưa được duyệt thì TikTok chỉ cho đăng ở chế độ riêng tư (SELF_ONLY) — phần mềm tôn trọng đúng giới hạn đó, không lách.</p>`;
  $('#ccPfTiktokApproved').onchange=async e=>{try{await api('/api/connections',{method:'POST',body:JSON.stringify({id:c.id,kind:'tiktok',meta:{tiktokApproved:e.target.checked}})});await loadConnections();toast(e.target.checked?'Đã ghi nhận app TikTok đã duyệt':'Đã bỏ ghi nhận duyệt app TikTok')}catch(err){$('#ccPfError').textContent=err.message;e.target.checked=!e.target.checked}};
 }
 if(kind==='youtube'&&c){
  extra.innerHTML='<p class="cc-dialog-note">Mẹo: nếu ứng dụng Google của bạn chưa qua vòng xác minh của Google, màn hình cấp quyền sẽ cảnh báo “ứng dụng chưa được xác minh” — cứ chọn “Nâng cao → Đi tới ứng dụng” là cấp quyền được cho chính kênh của bạn (chế độ kiểm thử cho phép tối đa 100 tài khoản tự thêm).</p>';
 }
 $('#ccPfAuthorize').onclick=async e=>{
  const btn=e.target;btn.disabled=true;
  try{
   const clientId=$('#ccPfClientId').value.trim(),clientSecret=$('#ccPfClientSecret').value.trim();
   if(!clientId||!clientSecret)throw new Error('Nhập Client ID và Client Secret của ứng dụng nền tảng trước (Bước 2).');
   const r=await api(`/api/connections/oauth/${kind}/start`,{method:'POST',body:JSON.stringify({clientId,clientSecret})});
   window.open(r.url,'_blank','noopener');
   $('#ccPfError').textContent='Đã mở trang cấp quyền. Đồng ý trên trang của '+title+' xong quay lại đây — liên kết sẽ tự cập nhật.';
   const before=c?.meta?.linkedAt||'';
   let tries=0;const timer=setInterval(async()=>{tries++;await loadConnections();const now=ccPlatformConn(kind);if(now&&(now.meta?.linkedAt||'')!==before){clearInterval(timer);ccPlatformDialog(kind);toast('Đã liên kết '+title)}else if(tries>40){clearInterval(timer);const el=$('#ccPfError');if(el)el.textContent='Chưa thấy liên kết mới. Nếu bạn đã cấp quyền xong, đóng hộp thoại này rồi mở lại để xem trạng thái.';}},3000);
  }catch(err){$('#ccPfError').textContent=err.message;btn.disabled=false}
 };
 const unlink=$('#ccPfUnlink');
 if(unlink)unlink.onclick=()=>{modal(`<h2>Ngắt liên kết ${esc(title)}</h2><p class="cc-dialog-note">Token sẽ bị xóa khỏi Vault; vòng khép kín sẽ không đăng lên ${esc(title)} được nữa cho đến khi liên kết lại. Muốn thu hồi hẳn quyền, vào trang bảo mật của ${esc(title)} để gỡ ứng dụng.</p><button class="primary" id="ccPfConfirmUnlink">Ngắt liên kết</button><p id="ccDialogError" class="cc-dialog-error" role="status"></p>`);$('#ccPfConfirmUnlink').onclick=async e=>{e.target.disabled=true;try{await api('/api/connections/'+encodeURIComponent(c.id),{method:'DELETE'});await loadConnections();$('#modal').classList.add('hidden');toast('Đã ngắt liên kết '+title)}catch(err){$('#ccDialogError').textContent=err.message;e.target.disabled=false}};};
}

$('#connectionRoleGrid').addEventListener('click',async e=>{const b=e.target.closest('[data-team-remove]');if(!b||b.disabled)return;b.disabled=true;try{const role=b.dataset.teamRemove,draft=ccRoleDraft();draft.teams[role]=draft.teams[role].filter((_,i)=>i!==Number(b.dataset.memberIndex));draft[role]=role==='council'?draft.teams[role]:draft.teams[role][0]||null;await ccSaveRoles(draft);}catch(error){toast(error.message);b.disabled=false;}});
