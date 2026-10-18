/* Home health and global search: always backed by real host/project state. */
const experience={status:null,coreTasks:[],loading:false,lastChecked:0};
function experienceTasks(){
  const old=(state.projects||[]).flatMap(p=>(p.tasks||[]).map(t=>({id:t.id,title:t.title||t.description||'Task',state:t.status||t.state||'unknown',at:t.completedAt||t.updatedAt||p.updatedAt||'',source:'local'})));
  const core=(experience.coreTasks||[]).map(t=>({id:t.id,title:(t.input?.operation||'Core Task').replace(/^media\./,'Media · '),state:t.state,at:t.updatedAt||'',source:'core'}));
  return [...old,...core];
}
function experienceRenderHealth(){
  const tasks=experienceTasks(),active=tasks.filter(t=>['running','review','repairing','building'].includes(t.state)).length,
    queued=tasks.filter(t=>['queued','todo','pending','planned'].includes(t.state)).length,
    done=tasks.filter(t=>['completed','done','merged'].includes(t.state)).length,
    blocked=tasks.filter(t=>['blocked','failed','interrupted','merge-conflict'].includes(t.state)).length;
  const gauge=$('#experienceHealthGauge');if(!gauge)return;
  gauge.setAttribute('data-loaded','true');gauge.querySelector('span').textContent=`${active}/${tasks.length}`;
  gauge.querySelector('small').textContent='Task đang chạy';
  $('#experienceHealthLegend').innerHTML=`<span class="health-line"><b>${active}</b> Đang xử lý</span><span class="health-line wait"><b>${queued}</b> Đang chờ</span><span class="health-line"><b>${done}</b> Hoàn thành</span><span class="health-line fail"><b>${blocked}</b> Bị chặn / lỗi</span>`;
  const recent=tasks.sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0)).slice(0,5);
  $('#experienceRecentTasks').innerHTML=recent.length?recent.map(t=>`<div class="insight-task"><b>${esc(t.title)}</b><small>${esc(t.state)} · ${esc(t.source==='core'?'AI Core':'AI Team')}</small></div>`).join(''):'<p class="insight-empty">Chưa có tác vụ thực. Tạo dự án trong Idea Studio để bắt đầu.</p>';
}
function experienceRenderCore(){
  const el=$('#experienceCoreStatus'),b=$('#integrationBadge');if(!el)return;
  const data=experience.status;
  if(!data){el.textContent='Không lấy được trạng thái host.';b.textContent='Core: ngoại tuyến';b.dataset.state='error';return;}
  const coreActive=data.core.status==='active',mediaReady=data.media.status==='available';
  b.textContent=coreActive?(data.core.mode==='local-only'?'Core: Local':'Core: Vault'):'Core: ngoại tuyến';b.dataset.state=coreActive?'active':'offline';
  el.innerHTML=`<div class="core-health-row"><span>AI Core v1</span><strong class="${coreActive?'health-ready':'health-blocked'}">${coreActive?(data.core.mode==='local-only'?'● Local · chưa mở Vault':'● Vault đã cấu hình'):'◌ '+esc(data.core.status)}</strong></div><div class="core-health-row"><span>Media Engine</span><strong class="${mediaReady?'health-ready':'health-blocked'}">${mediaReady?'● FFmpeg khả dụng':'◌ '+esc(data.media.status)}</strong></div><div class="core-health-row"><span>Model API thật</span><strong>${data.core.modelVerified?'Đã xác minh':'Chưa xác minh'}</strong></div><div class="core-health-row"><span>Đăng mạng xã hội</span><strong class="health-blocked">Đang khóa</strong></div>`;
}
async function experienceRefresh(){
  if(experience.loading)return;experience.loading=true;
  try{
    const status=await api('/api/integrations/status');experience.status=status;experience.lastChecked=Date.now();
    experience.coreTasks=status.core.status==='active'?await api('/api/integrations/media/tasks'):[];
  }catch(e){experience.status=null;experience.coreTasks=[];}
  finally{experience.loading=false;experienceRenderHealth();experienceRenderCore();document.dispatchEvent(new CustomEvent('integrations-updated',{detail:experience.status}));}
}
function experienceSearch(){
  modal(`<h2>Tìm trong AI Project OS</h2><p class="muted">Tìm tab, kỹ năng hoặc dự án đang lưu trên máy. Không gửi nội dung tìm kiếm lên dịch vụ ngoài.</p><input id="experienceSearchInput" type="search" placeholder="Tìm dự án, AI Team, Video Studio…" autocomplete="off" aria-label="Nhập từ khóa"><div id="experienceSearchResults" class="home-project-list" role="list"></div>`);
  const input=$('#experienceSearchInput');
  function update(){const q=input.value.trim().toLowerCase();const items=[...Object.entries(titles).map(([id,x])=>({type:'tab',id,title:x[0],detail:x[1]})),...(state.projects||[]).map(p=>({type:'project',id:p.id,title:p.name,detail:p.idea||'Dự án local'})),...(state.skills||[]).map(s=>({type:'skill',id:s.id,title:s.name,detail:s.description||'Skill Hub'}))];
    const filtered=items.filter(x=>(x.title+' '+x.detail).toLowerCase().includes(q)).slice(0,14);
    const list=$('#experienceSearchResults');list.innerHTML=filtered.length?filtered.map((x,i)=>`<button type="button" data-experience-item="${i}"><b>${esc(x.title)}</b><span>${esc(x.detail)}</span></button>`).join(''):'<p class="empty">Không tìm thấy kết quả trong dữ liệu local.</p>';
    filtered.forEach((x,i)=>{const button=list.querySelector(`[data-experience-item="${i}"]`);if(button)button.onclick=async()=>{try{if(x.type==='project')await chooseProject(x.id);page(x.type==='project'?'idea':x.type==='skill'?'skills':x.id);$('#modal').classList.add('hidden')}catch(e){toast(e.message)}};});
  }input.addEventListener('input',update);update();input.focus();
}
$('#globalSearch').addEventListener('click',experienceSearch);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();experienceSearch()}});
$$('[data-experience-go]').forEach(b=>b.addEventListener('click',()=>page(b.dataset.experienceGo)));
document.addEventListener('project-change',experienceRenderHealth);
document.addEventListener('page-change',e=>{if(e.detail.page==='home'||e.detail.page==='engines')experienceRefresh()});
setInterval(()=>{if(!document.hidden)experienceRefresh()},20000);
experienceRefresh();
