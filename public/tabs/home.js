let homeIconSequence=0;
function homeIcon(name){
  const id='homeIcon'+(++homeIconSequence), gradient=`url(#${id})`;
  const colors={bulb:['#dfb2ff','#9757e3'],people:['#95b6ff','#4b63fa'],tools:['#2cf2c7','#00ba95'],bot:['#c6c9ff','#7375ff'],folder:['#38a9ff','#0879ef'],link:['#c6e2ff','#85b7ff'],puzzle:['#34f7cf','#00bd9b'],check:['#43ffdf','#00ddba'],project:['#be7aff','#6e36da']};
  const [a,b]=colors[name]||['#5ef6d3','#008e79'];
  const shapes={
    bulb:`<circle cx="32" cy="32" r="31" fill="#352062"/><path d="M19 28a13 13 0 1 1 26 0c0 8-8 10-8 16H27c0-6-8-8-8-16Z" fill="${gradient}"/><path d="M27 45h10v4a5 5 0 0 1-10 0Z" fill="#ddbbff"/><path d="M23 27c0-5 3-8 6-9" fill="none" stroke="#f3dfff" stroke-width="3" stroke-linecap="round"/>`,
    people:`<circle cx="12" cy="26" r="8" fill="#577dfb"/><circle cx="51" cy="26" r="8" fill="#496cf5"/><path d="M2 48v-5c0-9 19-11 22-1v8H5a3 3 0 0 1-3-2Zm39 2v-8c3-10 21-8 21 1v5a3 3 0 0 1-3 2Z" fill="#617aff"/><circle cx="32" cy="23" r="11" fill="${gradient}" stroke="#223990" stroke-width="1.5"/><path d="M16 51v-6c0-15 32-15 32 0v6Z" fill="${gradient}" stroke="#253e95" stroke-width="1.5"/>`,
    tools:`<circle cx="32" cy="32" r="30" fill="#004237"/><path d="m17 12 32 32a5 5 0 0 1-7 7L10 19a5 5 0 0 1 7-7Z" fill="${gradient}"/><path d="M48 12a15 15 0 0 0-19 18L12 47a5 5 0 0 0 7 7l17-17a15 15 0 0 0 18-19l-10 9-7-7Z" fill="${gradient}" stroke="#003e32" stroke-width="2"/><circle cx="16" cy="49" r="2.5" fill="#004a3c"/>`,
    bot:`<path d="M32 11v8" stroke="#9594ff" stroke-width="3"/><circle cx="32" cy="10" r="3.5" fill="#c6c8ff"/><rect x="12" y="20" width="40" height="34" rx="10" fill="${gradient}"/><rect x="6" y="28" width="5" height="19" rx="2" fill="#7b7cff"/><rect x="53" y="28" width="5" height="19" rx="2" fill="#7b7cff"/><circle cx="24" cy="33" r="4" fill="#302d83"/><circle cx="41" cy="33" r="4" fill="#302d83"/><rect x="25" y="43" width="14" height="4" rx="2" fill="#403699"/>`,
    github:`<path fill="#f0f6fc" d="M32 6a26 26 0 0 0-8.22 50.67c1.3.24 1.78-.57 1.78-1.26v-4.85c-7.23 1.57-8.76-3.07-8.76-3.07-1.18-3.01-2.89-3.81-2.89-3.81-2.36-1.61.18-1.58.18-1.58 2.6.18 3.97 2.67 3.97 2.67 2.31 3.96 6.06 2.81 7.53 2.15.24-1.67.9-2.81 1.64-3.46-5.77-.66-11.84-2.89-11.84-12.86 0-2.84 1.01-5.16 2.67-6.98-.27-.66-1.16-3.3.26-6.87 0 0 2.18-.7 7.15 2.66a24.88 24.88 0 0 1 13.02 0c4.96-3.37 7.14-2.66 7.14-2.66 1.42 3.57.53 6.21.26 6.87a10.03 10.03 0 0 1 2.66 6.98c0 10-6.08 12.19-11.87 12.84.93.8 1.76 2.39 1.76 4.81v7.12c0 .7.47 1.52 1.79 1.26A26 26 0 0 0 32 6Z"/>`,
    vercel:`<circle cx="32" cy="32" r="30" fill="#000"/><path d="m32 15 18 30H14Z" fill="#fff"/>`,
    folder:`<path d="M7 14h19l6 7h24a5 5 0 0 1 5 5v25a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V19a5 5 0 0 1 3-5Z" fill="#0078ef"/><path d="M10 28h47c3 0 4 2 3 5l-6 20a4 4 0 0 1-4 3H7Z" fill="${gradient}"/>`,
    link:`<g fill="none" stroke="${gradient}" stroke-width="7" stroke-linecap="round"><path d="m24 24-10 10a10 10 0 0 0 14 14l11-11M39 40l11-11a10 10 0 0 0-14-14L25 26M24 40l16-16"/></g>`,
    puzzle:`<path d="M8 16h15v-5a7 7 0 1 1 13 0v5h14a4 4 0 0 1 4 4v10h-5a7 7 0 1 0 0 13h5v10a4 4 0 0 1-4 4H37v-5a7 7 0 1 0-13 0v5H12a4 4 0 0 1-4-4V41h5a7 7 0 1 0 0-13H8Z" fill="${gradient}"/>`,
    check:`<circle cx="32" cy="32" r="26" fill="${gradient}"/><path d="m21 32 8 8 15-17" fill="none" stroke="#005b51" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    node:`<defs><linearGradient id="${id}node" x2="1" y2="1"><stop stop-color="#83c842"/><stop offset="1" stop-color="#317627"/></linearGradient></defs><path d="m32 5 24 14v27L32 60 8 46V19Z" fill="url(#${id}node)" stroke="#244e1e" stroke-width="2"/><text x="32" y="41" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="bold" fill="#204b19">nɗe</text>`,
    git:`<rect x="12" y="12" width="40" height="40" rx="4" transform="rotate(45 32 32)" fill="#fa4d2f"/><path d="m22 15 20 20M28 21v25" stroke="#40211d" stroke-width="4"/><g fill="#40211d"><circle cx="28" cy="23" r="4"/><circle cx="42" cy="36" r="4"/><circle cx="28" cy="46" r="4"/></g>`,
    docker:`<g fill="#1eabf4"><path d="M4 32h45c6 0 9-3 11-5 1 5-2 9-7 10-4 15-14 20-27 19C11 55 6 45 4 32Z"/><path d="M54 25c-3-1-4-4-4-8-4 1-7 4-6 10Z"/><rect x="8" y="23" width="8" height="7" rx="1"/><rect x="18" y="23" width="8" height="7" rx="1"/><rect x="28" y="23" width="8" height="7" rx="1"/><rect x="38" y="23" width="8" height="7" rx="1"/><rect x="18" y="14" width="8" height="7" rx="1"/><rect x="28" y="14" width="8" height="7" rx="1"/><rect x="28" y="5" width="8" height="7" rx="1"/></g><circle cx="14" cy="40" r="2" fill="#005381"/>`,
    supabase:`<path d="M33 4 7 39a3 3 0 0 0 3 5h23Z" fill="#2af3bd"/><path d="M31 60 57 25a3 3 0 0 0-3-5H31Z" fill="#00ad88"/>`,
    python:`<path d="M32 4c-16 0-17 7-17 14v7h21v3H11C1 28 1 48 10 48h7V37c0-6 5-10 11-10h18V15C46 6 39 4 32 4Z" fill="#39b7ec"/><path d="M32 60c16 0 17-7 17-14v-7H28v-3h25c10 0 10-20 1-20h-7v11c0 6-5 10-11 10H18v12c0 9 7 11 14 11Z" fill="#ffcf37"/><circle cx="25" cy="12" r="2.5" fill="#e8f8ff"/><circle cx="39" cy="52" r="2.5" fill="#fff9df"/>`,
    project:`<rect x="2" y="2" width="60" height="60" rx="17" fill="${gradient}"/><rect x="15" y="18" width="34" height="30" rx="2" fill="none" stroke="#f0dfff" stroke-width="3"/><path d="M16 26h32" stroke="#f0dfff" stroke-width="3"/><circle cx="20" cy="22" r="1.5" fill="#fff"/><circle cx="25" cy="22" r="1.5" fill="#fff"/>`
  };
  return `<svg class="home-icon" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${shapes[name]||shapes.project}</svg>`;
}
const homePipelineSteps=[['bulb','Ý tưởng','Bạn nêu ý tưởng<br>trong một ô chat'],['people','Hội đồng AI','Phân tích, góp ý,<br>lên kế hoạch'],['tools','Skills','Chọn công cụ<br>và kỹ năng phù hợp'],['bot','Agents','Các AI agent<br>thực thi tự động'],['github','GitHub','Quản lý mã nguồn<br>và CI/CD'],['vercel','Vercel','Triển khai<br>lên production']];
$('#homePipeline').innerHTML=homePipelineSteps.map(([icon,label,description],i)=>`${i?'<span class="home-pipeline-arrow" aria-hidden="true">→</span>':''}<div class="home-pipeline-card">${homeIcon(icon)}<h3>${label}</h3><p>${description}</p></div>`).join('');
async function loadPrereq(){
  try{state.prereq=await api('/api/system/prerequisites');state.prereqLoaded=true}catch(e){state.prereqLoaded=false;state.prereqError=e.message}
  try{state.prereqVersions=await api('/api/system/prerequisite-versions')}catch{state.prereqVersions={}}
  try{state.sandbox=await api('/api/system/sandbox')}catch{}
  renderHome();renderSetupCard();if(typeof renderExecutionControls==='function')renderExecutionControls();
}
function homeProjectStage(project){
  const stage=project.stage;
  if(['deployed','published'].includes(stage))return ['deployed','Triển khai','Đã deploy'];
  if(['planned','approved-spec'].includes(stage))return ['planning','Lên kế hoạch',stage==='planned'?'Đã có kế hoạch':'Đã chốt đặc tả'];
  if(stage==='building')return ['building','Phát triển','Đang phát triển'];
  return ['idea',stage==='discovery'?'Khám phá':'Ý tưởng',stage==='discovery'?'Đang làm rõ ý tưởng':'Chưa bắt đầu'];
}
function homeNextAction(project){
 if(!project)return {label:'Tạo dự án đầu tiên',page:'home',description:'Chưa có dự án trên máy.'};
 const stage=project.stage;
 if(['deployed','published'].includes(stage))return {label:'Xem tiến độ',page:'map',description:'Kiểm tra kết quả và lịch sử trước khi xuất bản tiếp.'};
 if(['planned','approved-spec','building'].includes(stage))return {label:'Mở AI Team',page:'team',description:'Kiểm tra nhiệm vụ và quyết định bước xử lý tiếp theo.'};
 return {label:'Tiếp tục Idea Studio',page:'idea',description:'Làm rõ ý tưởng và lưu kế hoạch trước khi dùng AI.'};
}
function renderHomeCurrent(){
 const el=$('#homeCurrentProject');if(!el)return;
 const p=state.project;const next=homeNextAction(p);
 el.innerHTML=`<div><span class="home-current-eyebrow">DỰ ÁN HIỆN TẠI</span><h3>${p?esc(p.name):'Chưa chọn dự án'}</h3><p>${esc(next.description)} ${state.vault?.unlocked?'':'Vault đang khóa; chỉ thao tác cục bộ không cần kết nối AI mới khả dụng.'}</p></div><button class="primary" id="homeNextAction" type="button">${esc(next.label)} →</button>`;
 $('#homeNextAction').onclick=()=>next.page==='home'?homeCreateProject():page(next.page);
}
function renderHome(){
 renderHomeCurrent();
  const ps=state.projects||[],tasks=ps.flatMap(p=>p.tasks||[]),active=ps.filter(p=>!['deployed','published','archived'].includes(p.stage)).length;
  const recentDone=tasks.filter(t=>t.status==='done'&&Date.parse(t.completedAt)>=Date.now()-7*86400000).length;
  const connectionsKnown=state.vault?.unlocked===true;
  const stats=[['folder','Dự án',ps.length,`${active} đang hoạt động`,'projects'],['link','Kết nối',connectionsKnown?state.connections.length:'—',connectionsKnown?'AI providers & dịch vụ':'Mở Vault để xem kết nối','connections'],['puzzle','Skills',state.skills.length,'Kỹ năng & công cụ','skills'],['check','Task Done',tasks.filter(t=>t.status==='done').length,`Hoàn thành ${recentDone} trong 7 ngày qua`,'team']];
  $('#homeStats').innerHTML=stats.map(([icon,label,count,note,destination])=>`<button class="home-stat" data-home-destination="${destination}"><span class="home-stat-icon">${homeIcon(icon)}</span><span class="home-stat-copy"><span class="home-stat-label">${label}</span><b>${count}</b><span class="home-stat-note">${note}</span></span><span class="home-stat-arrow" aria-hidden="true">›</span></button>`).join('');
  $$('#homeStats [data-home-destination]').forEach(button=>button.onclick=()=>button.dataset.homeDestination==='projects'?homeShowAllProjects():page(button.dataset.homeDestination));
  const runtimes=[['node','Node.js'],['git','Git'],['docker','Docker'],['gh','GitHub CLI'],['vercel','Vercel CLI'],['supabase','Supabase CLI'],['python','Python']];
  $('#prereqGrid').innerHTML=runtimes.map(([key,label])=>{
    const installed=key==='python'?Boolean(state.prereq.python3||state.prereq.python):Boolean(state.prereq[key]),version=key==='python'?(state.prereqVersions?.python3||state.prereqVersions?.python):state.prereqVersions?.[key];
    const status=state.prereqLoaded?(installed?'Đã cài đặt':'Chưa cài đặt'):(state.prereqError?'Không xác định':'Đang kiểm tra');
    return `<div class="home-runtime">${homeIcon(key==='gh'?'github':key)}<div><h4>${label}</h4><span class="home-runtime-version" title="${esc(version||'')}">${esc(version||(state.prereqLoaded?(installed?'Có trên máy':'Chưa tìm thấy'):'—'))}</span><span class="home-runtime-badge ${state.prereqLoaded?(installed?'':'missing'):'loading'}">${status}</span></div></div>`;
  }).join('');
  const recent=[...ps].sort((a,b)=>Date.parse(b.updatedAt||b.createdAt||0)-Date.parse(a.updatedAt||a.createdAt||0)).slice(0,4);
  $('#recentProjects').innerHTML=recent.length?recent.map(p=>{const [status,label,description]=homeProjectStage(p);return `<article class="home-project-card" data-home-project="${esc(p.id)}" tabindex="0" aria-label="Mở ${esc(p.name)}">${homeIcon('project')}<div class="home-project-copy"><h4 title="${esc(p.name)}">${esc(p.name)}</h4><p>${esc(p.idea||'Chưa có mô tả dự án.')}</p><span class="home-project-status ${status}">${description}</span></div><span class="home-project-stage ${status}">${label}</span><button class="home-project-menu" data-home-menu="${esc(p.id)}" aria-label="Thao tác với ${esc(p.name)}">⋮</button></article>`}).join(''):`<div class="home-empty-projects">${homeIcon('folder')}<strong>Chưa có dự án</strong><p>Tạo dự án đầu tiên để bắt đầu từ ý tưởng của bạn.</p><button class="primary" id="homeEmptyCreate">＋ Tạo dự án mới</button></div>`;
  $$('#recentProjects [data-home-project]').forEach(card=>{card.onclick=e=>{if(!e.target.closest('[data-home-menu]'))homeOpenProject(card.dataset.homeProject)};card.onkeydown=e=>{if(e.target===card&&['Enter',' '].includes(e.key)){e.preventDefault();homeOpenProject(card.dataset.homeProject)}}});
  $$('#recentProjects [data-home-menu]').forEach(button=>button.onclick=()=>homeProjectActions(button.dataset.homeMenu));
  if($('#homeEmptyCreate'))$('#homeEmptyCreate').onclick=homeCreateProject;
}
async function homeOpenProject(id,destination='idea'){
  try{await chooseProject(id);$('#modal').classList.add('hidden');page(destination)}catch(e){toast(e.message)}
}
function homeShowAllProjects(){
  const ps=state.projects||[];
  modal(`<h2>Dự án của bạn</h2><p class="muted">${ps.length} dự án đang lưu trên máy local.</p><div class="home-project-list">${ps.length?ps.map(p=>`<button data-home-open="${esc(p.id)}"><b>${esc(p.name)}</b><span>${esc(p.idea||'Chưa có mô tả dự án.')}</span></button>`).join(''):'<p class="empty">Chưa có dự án. Tạo dự án đầu tiên để bắt đầu.</p>'}</div><div class="inline" style="margin-top:16px"><button class="primary" id="homeListCreate">＋ Tạo dự án mới</button></div>`);
  $$('#modalBody [data-home-open]').forEach(button=>button.onclick=()=>homeOpenProject(button.dataset.homeOpen));$('#homeListCreate').onclick=homeCreateProject;
}
function homeProjectActions(id){
  const p=state.projects.find(project=>project.id===id);if(!p)return;
  modal(`<h2>${esc(p.name)}</h2><p class="muted">${esc(p.idea||'Chưa có mô tả dự án.')}</p><div class="inline"><button class="primary" id="homeOpenIdea">Mở Idea Studio</button><button class="ghost" id="homeOpenMap">Xem Project Map</button></div>`);
  $('#homeOpenIdea').onclick=()=>homeOpenProject(id);$('#homeOpenMap').onclick=()=>homeOpenProject(id,'map');
}
function homeCreateProject(){
  modal(`<form id="homeCreateForm" class="home-create-form"><h2>Tạo dự án mới</h2><p>Đặt tên và ghi lại ý tưởng. Bạn có thể tiếp tục làm rõ sản phẩm trong Idea Studio.</p><label for="homeProjectName">Tên dự án</label><input id="homeProjectName" name="name" maxlength="100" required placeholder="Tên sản phẩm của bạn" autocomplete="off"><label for="homeProjectIdea">Ý tưởng ban đầu</label><textarea id="homeProjectIdea" name="idea" maxlength="12000" placeholder="Bạn muốn xây dựng sản phẩm gì, dành cho ai?"></textarea><div class="inline"><button class="ghost" type="button" id="homeCancelCreate">Hủy</button><button class="primary" type="submit" id="homeSaveProject">Tạo dự án →</button></div></form>`);
  $('#homeProjectName').focus();$('#homeCancelCreate').onclick=()=>$('#modal').classList.add('hidden');
  $('#homeCreateForm').onsubmit=async event=>{event.preventDefault();const button=$('#homeSaveProject'),name=$('#homeProjectName').value.trim(),idea=$('#homeProjectIdea').value.trim();if(!name){$('#homeProjectName').focus();return}button.disabled=true;button.textContent='Đang tạo…';try{const project=await api('/api/projects',{method:'POST',body:JSON.stringify({name,idea})});state.project=project;await loadProjects();await homeOpenProject(project.id);toast('Đã tạo dự án')}catch(e){toast(e.message);button.disabled=false;button.textContent='Tạo dự án →'}};
}
$('#homeCreateProject').onclick=homeCreateProject;
function renderSetupCard(){
  const card=$('#homeSetupCard');if(!card)return;
  try{
    if(localStorage.getItem('aios-setup-dismissed')==='1'){card.hidden=true;return}
    const conns=Array.isArray(state.connections)?state.connections:[];
    const aiKinds=['openai','anthropic','gemini','openai_compatible'];
    const hasAi=conns.some(c=>aiKinds.includes(c.kind)||String(c.kind||'').endsWith('_account'));
    const hasGithub=conns.some(c=>c.kind==='github');
    const tools=state.prereqLoaded?Boolean(state.prereq.git&&state.prereq.gh):null;
    const hasProject=(state.projects||[]).length>0;
    const steps=[
      {done:hasAi,label:'Kết nối tài khoản AI',hint:'Đăng nhập ChatGPT / Claude / Gemini bằng tài khoản của bạn',go:'connections',cta:'Kết nối'},
      {done:tools,label:'Cài Git & GitHub CLI trên máy',hint:'Hai công cụ nền để app làm việc với GitHub',go:'guide',cta:'Xem hướng dẫn'},
      {done:hasGithub,label:'Liên kết GitHub',hint:'Để đội AI lấy việc và đẩy sản phẩm lên repo của bạn',go:'connections',cta:'Liên kết'},
      {done:hasProject,label:'Tạo dự án đầu tiên',hint:'Bắt đầu từ một ý tưởng, đội AI sẽ đồng hành tiếp',go:null,cta:'Tạo dự án'},
    ];
    const doneCount=steps.filter(x=>x.done===true).length;
    if(doneCount===steps.length){card.hidden=false;card.innerHTML=`<div class="home-setup-done"><span aria-hidden="true">✓</span><p><strong>Đã thiết lập xong.</strong> Máy và tài khoản đã sẵn sàng — bắt đầu từ một ý tưởng mới thôi.</p><button class="home-setup-dismiss" id="homeSetupDismiss">Ẩn</button></div>`;}
    else{
      card.hidden=false;
      card.innerHTML=`<div class="home-setup-head"><h3>Thiết lập ban đầu</h3><span>${doneCount}/${steps.length} bước</span><button class="home-setup-dismiss" id="homeSetupDismiss" aria-label="Ẩn thẻ thiết lập">×</button></div><ol class="home-setup-list">${steps.map(x=>`<li class="${x.done===true?'done':x.done===false?'todo':'unknown'}"><span class="home-setup-ico" aria-hidden="true">${x.done===true?'✓':x.done===false?'○':'…'}</span><div><b>${x.label}</b><p>${x.hint}</p></div>${x.done===true?'':x.go?`<button class="ghost" data-setup-go="${x.go}">${x.cta}</button>`:`<button class="primary" id="homeSetupCreate">${x.cta}</button>`}</li>`).join('')}</ol>`;
      $$('#homeSetupCard [data-setup-go]').forEach(b=>b.onclick=()=>page(b.dataset.setupGo));
      const create=$('#homeSetupCreate');if(create)create.onclick=homeCreateProject;
    }
    const dismiss=$('#homeSetupDismiss');if(dismiss)dismiss.onclick=()=>{localStorage.setItem('aios-setup-dismissed','1');card.hidden=true};
  }catch{card.hidden=true}
}
$('#homeAllProjects').onclick=homeShowAllProjects;
renderHome();renderSetupCard();
