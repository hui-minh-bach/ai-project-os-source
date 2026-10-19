const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={connections:[],projects:[],project:null,skills:[],engines:[],prereq:{},sandbox:{}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,opts={}){
 let r;
 try{r=await fetch(url,{...opts,cache:'no-store',headers:{'content-type':'application/json',...(opts.headers||{})}})}
 catch{throw new Error('Không kết nối được với Local Worker. Hãy mở lại AI Project OS và thử lại. Dữ liệu trên máy chưa bị xóa.');}
 const j=await r.json().catch(()=>({}));
 if(!r.ok){
  const reason=typeof j.error==='string'?j.error:`HTTP ${r.status}`;
  if(r.status===401)throw new Error('Phiên truy cập Local Worker đã hết hạn. Vui lòng mở lại ứng dụng bằng lối tắt AI Project OS.');
  throw new Error(reason);
 }
 return j;
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>t.style.display='none',4000)}
let lastModalFocus=null;
function closeCustomerModal(){
 $('#modal').classList.add('hidden');
 if(lastModalFocus?.isConnected)lastModalFocus.focus();
 lastModalFocus=null;
}
function modal(html){
 lastModalFocus=document.activeElement;
 $('#modalBody').innerHTML=html;
 $('#modal').classList.remove('hidden');
 const first=$('#modal').querySelector('input,select,textarea,button:not(#closeModal)');
 (first||$('#closeModal')).focus();
}
// Keep focus inside the dialog; support Escape and restore the prior focus.
document.addEventListener('keydown',e=>{
 if($('#modal').classList.contains('hidden'))return;
 if(e.key==='Escape'){e.preventDefault();closeCustomerModal();return;}
 if(e.key!=='Tab')return;
 const items=[...$('#modal').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(x=>x.getClientRects().length>0);
 if(!items.length)return;
 if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}
 else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}
});
$('#closeModal').onclick=closeCustomerModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeCustomerModal()};
const titles={home:['Tổng quan','Một ô chat cho người dùng — nhiều AI và engine phối hợp phía sau.'],connections:['Kết nối','AI providers và dịch vụ hạ tầng.'],idea:['Idea Studio','Bàn tiếp nhận dự án — nói với trưởng phòng, chọn nguồn, giao việc cho đội.'],council:['AI Council','Nhiều góc nhìn độc lập trước khi chốt spec.'],team:['AI Team','Task + skill + worker + reviewer.'],skills:['Skill Hub','Năng lực tái sử dụng, độc lập model.'],engines:['Engine Hub','Native + adapters cho agent frameworks ngoài.'],map:['Project Map','Nhìn toàn bộ dự án trong một màn hình.'],studio:['Video Studio','Làm video: lồng tiếng, tạo mới, hiệu ứng và xuất bản.'],radar:['Radar tin','Tin tức theo lĩnh vực — chọn tin là đội AI tự làm.'],publish:['Publish','GitHub và Vercel khi sản phẩm đã sẵn sàng.'],guide:['Hướng dẫn','Wizard cho người mới.']};
function page(name){$$('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+name));$$('.nav').forEach(x=>x.classList.toggle('active',x.dataset.page===name));$('#pageTitle').textContent=titles[name]?.[0]||name;$('#subtitle').textContent=titles[name]?.[1]||'';if(name==='map')renderMap();if(name==='publish')renderPublish();document.dispatchEvent(new CustomEvent('page-change',{detail:{page:name}}));}
$$('.nav').forEach(b=>b.onclick=()=>page(b.dataset.page));$$('[data-go]').forEach(b=>b.onclick=()=>page(b.dataset.go));

async function vaultRefresh(){const v=await api('/api/vault');state.vault=v;$('#vaultBadge').textContent=v.unlocked?'Vault đã mở':'Vault đang khóa';$('#vaultBtn').textContent=v.unlocked?'Khóa Vault':'Mở Vault';if(typeof renderHome==='function')renderHome();return v}
$('#vaultBtn').onclick=async()=>{const v=await api('/api/vault');if(v.unlocked){await api('/api/vault/lock',{method:'POST',body:'{}'});state.connections=[];await vaultRefresh();renderConnections();renderSelectors();return}modal(`<h2>${v.exists?'Mở':'Tạo'} Secret Vault</h2><p>API key và thông tin kết nối được mã hóa AES-256-GCM. Mật khẩu Vault chỉ giữ trong RAM. Credential đăng nhập ChatGPT do Codex quản lý trong hồ sơ riêng, không mã hóa bằng mật khẩu Vault.</p><label>Mật khẩu vault (≥ 10 ký tự)</label><input id="vaultPassword" type="password"><button class="primary" id="unlockNow">${v.exists?'Mở khóa':'Tạo vault'}</button>`);setTimeout(()=>$('#unlockNow').onclick=async()=>{try{await api('/api/vault/unlock',{method:'POST',body:JSON.stringify({password:$('#vaultPassword').value})});$('#modal').classList.add('hidden');await vaultRefresh();await loadConnections();toast('Vault đã mở')}catch(e){toast(e.message)}},0)};

const kindInfo={openai:['OpenAI','AI provider'],gemini:['Google Gemini','AI provider'],anthropic:['Anthropic Claude','AI provider'],openai_compatible:['OpenAI-compatible','AI provider'],github:['GitHub','Source code'],vercel:['Vercel','Deploy'],supabase:['Supabase','Database/Auth/Storage'],other:['Khác','Custom service']};
function aiConns(){return state.connections.filter(x=>['chatgpt_account','claude_account','gemini_account','antigravity_account','openai','gemini','anthropic','openai_compatible'].includes(x.kind)&&x.availability?.status==='verified')}
async function loadConnections(){try{state.connections=await api('/api/connections');state.connectionsError=null}catch(e){state.connections=[];state.connectionsError=e}renderConnections();renderSelectors();if(typeof renderHome==='function')renderHome();document.dispatchEvent(new CustomEvent('connections-change'))}
function renderSelectors(){
 const a=aiConns(),option=c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.model||'chưa chọn model')}</option>`,html='<option value="">Chọn AI đã xác minh</option>'+a.filter(c=>c.model&&c.availability.models.includes(c.model)).map(option).join('');
 const roles=state.project?.modelRoles||{},ref=(role,i=0)=>`role:${state.project.id}:${role}:${i}`;
 const boundOption=(role,b,i=0)=>{const c=a.find(c=>c.id===b?.connectionId);return c&&c.availability.models.includes(b.model)?`<option value="${esc(ref(role,i))}">${esc(c.name)} · ${esc(b.model)}</option>`:'<option value="">Vai trò cần xác minh lại</option>'};
 ['founderSelect','stackSelect','managerSelect'].forEach(id=>{const e=$('#'+id);if(e)e.innerHTML=roles.founder?boundOption('founder',roles.founder):html});
 const chair=$('#chairSelect');if(chair)chair.innerHTML=roles.council?.length?boundOption('council',roles.council[0]):html;
 const cm=$('#councilMembers');if(cm){const members=roles.council?.length?roles.council.map((b,i)=>{const c=a.find(c=>c.id===b.connectionId);return c&&c.availability.models.includes(b.model)?{id:ref('council',i),name:c.name,kind:c.kind,model:b.model}:null}).filter(Boolean):a.filter(c=>c.model&&c.availability.models.includes(c.model));cm.innerHTML=members.map(c=>`<label class="check"><input type="checkbox" value="${esc(c.id)}" checked> ${esc(c.name)}<br><span class="muted">${esc(c.kind)} · ${esc(c.model)}</span></label>`).join('');}
 for(const [id,kind] of [['githubSelect','github'],['vercelSelect','vercel'],['supabaseSelect','supabase']]){const e=$('#'+id);if(e)e.innerHTML=state.connections.filter(c=>c.kind===kind&&c.meta?.verifiedAt).map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');}
}
async function loadProjects(){state.projects=await api('/api/projects');const html=state.projects.length?state.projects.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''):'<option value="">Chưa có dự án</option>';if($('#projectSelect'))$('#projectSelect').innerHTML=html;$('#globalProjectSelect').innerHTML=html;state.project=state.projects.find(x=>x.id===state.project?.id)||state.projects[0]||null;if(state.project){if($('#projectSelect'))$('#projectSelect').value=state.project.id;$('#globalProjectSelect').value=state.project.id;if($('#repoName'))$('#repoName').value=(state.project.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}renderProject();renderHome()}
async function chooseProject(id){if(!id)return;state.project=await api('/api/projects/'+encodeURIComponent(id));if($('#projectSelect'))$('#projectSelect').value=id;$('#globalProjectSelect').value=id;renderProject();renderHome()}
if($('#projectSelect'))$('#projectSelect').onchange=()=>chooseProject($('#projectSelect').value);$('#globalProjectSelect').onchange=()=>chooseProject($('#globalProjectSelect').value);
function renderProject(){renderIdeaProject();renderCouncilProject();renderTasks();renderExecutionControls();loadWorkspace();document.dispatchEvent(new CustomEvent('project-change'));}

// Visible, actionable offline state. Errors must not disappear behind transient toasts.
function customerShowFailure(section,error){
 const banner=$('#customerErrorBanner');if(!banner)return;
 $('#customerErrorTitle').textContent=`Không thể tải ${section}`;
 $('#customerErrorMessage').textContent=String(error?.message||error||'Không rõ nguyên nhân')+' — dữ liệu cục bộ vẫn được giữ nguyên.';
 banner.classList.remove('hidden');
}
function customerClearFailure(){const banner=$('#customerErrorBanner');if(banner)banner.classList.add('hidden');}
$('#customerRetry').onclick=()=>{if(typeof customerBootstrap==='function')customerBootstrap();};
$('#customerShowGuide').onclick=()=>{page('guide');toast('Mở mục Kiểm tra hệ thống trong tab Hướng dẫn hoặc khởi động lại bằng lối tắt.');};
