// Radar tin (đợt E): chọn lĩnh vực bằng cửa xổ, tin nổi bật theo điểm,
// mỗi ô tin có Làm video / Viết bài — bấm là giao thẳng cho bộ điều phối.
let radarFieldId=localStorage.getItem('aios-radar-field')||'';
const RADAR_FIELD_ICONS={'thoi-su':'🗞️','kinh-doanh':'📈','cong-nghe':'💻','the-thao':'⚽','giai-tri':'🎭','suc-khoe':'🩺','am-thuc':'🍜','du-lich':'🧳','xe-co':'🚗','giao-duc':'🎓','phap-luat':'⚖️','khoa-hoc':'🔬','moi-truong':'🌱','nong-nghiep':'🌾','giao-thong':'🚦','viec-lam':'💼','quoc-te':'🌍','van-hoa':'🏮','bat-dong-san':'🏠','thoi-tiet':'🌦️'};
let radarAge=Number(localStorage.getItem('aios-radar-age')||48);if(![0,24,48,72,168,720].includes(radarAge))radarAge=48;
let radarFields=[];let radarSourceNames={};let radarRenderId=0,radarPage=null;
const radarEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function radarHost(link){try{return new URL(String(link||'')).hostname.replace(/^www\./,'')}catch{return ''}}
function radarLawBadge(card,field){
 if(!field?.officialDomains?.length)return '';
 const h=card.publisher?String(card.publisher).toLowerCase().replace(/^www\./,''):radarHost(card.link);
 const ok=field.officialDomains.some(d=>h===d||h.endsWith('.'+d))||['bộ tư pháp','cổng pháp luật','cơ sở dữ liệu quốc gia','csdl quốc gia','chính phủ','quốc hội','tòa án','viện kiểm sát','công báo'].some(x=>String(card.publisher||'').toLowerCase().includes(x));
 const ref=(String(card.title||'')+' '+String(card.summary||'')).match(/(Nghị định|Thông tư|Luật|Nghị quyết|Quyết định|Chỉ thị)\s+(?:số\s+)?(\d+\/[\w.\-]+)/i);
 return `<p style="margin:4px 0">${ok?'<span class="tag good">⚖️ Nguồn chính thống · '+radarEsc(h)+'</span>':'<span class="tag warn">⚖️ Chưa xác minh nguồn · '+radarEsc(h||'không rõ')+'</span>'}${ref?' <span class="tag">'+radarEsc(ref[1]+' '+ref[2])+'</span>':''}</p>`;
}
function radarCardHtml(card,field){
 card={...card};try{const u=new URL(card.link);if(!["http:","https:"].includes(u.protocol)||u.username||u.password)card.link="";}catch{card.link="";}
 const used=card.usedByProjectId?' <span class="tag">Đã dùng</span>':'';
 return `<div class="card" style="margin-bottom:10px"><div style="display:flex;gap:8px;align-items:flex-start"><span class="tag" title="Điểm tin do công thức từ khóa + độ mới chấm">${card.score??'—'} điểm</span><div style="flex:1"><b>${radarEsc(card.title)}</b><p class="muted" style="margin:2px 0">${radarEsc(card.publisher||radarSourceNames[card.sourceId]||'')} · ${card.publishedAt?radarEsc(new Date(card.publishedAt).toLocaleString('vi-VN')):''}</p>${card.summary?`<p style="margin:2px 0">${radarEsc(String(card.summary).slice(0,220))}</p>`:''}${radarLawBadge(card,field)}<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><button class="primary small" type="button" data-radar-produce="news-video" data-card="${card.id}">🎬 Làm video</button><button class="ghost small" type="button" data-radar-produce="news-article" data-card="${card.id}">✍️ Viết bài phân tích</button>${card.link?`<a class="ghost small" href="${radarEsc(card.link)}" target="_blank" rel="noopener noreferrer">Đọc nguồn ↗</a>`:''}${card.fullText?`<button class="ghost small" type="button" data-radar-viewfull="${card.id}">📄 Toàn văn (${String(card.fullText).length.toLocaleString('vi-VN')} chữ)</button>`:(card.link?`<button class="ghost small" type="button" data-radar-getfull="${card.id}">📄 Lấy toàn văn</button>`:'')}${used}</div><div id="radarFull-${card.id}" hidden style="margin-top:8px;max-height:300px;overflow:auto;border-top:1px dashed var(--line);padding-top:6px">${card.fullText?radarEsc(card.fullText).replace(/\n+/g,'<br>'):''}</div></div></div></div>`;
}
async function radarRender(){
 const renderId=++radarRenderId;radarPage=null;
 const field=radarFields.find(f=>f.id===radarFieldId);
 $$('#radarTiles [data-radar-tile]').forEach(b=>{const on=b.dataset.radarTile===radarFieldId;b.style.background=on?'var(--accent)':'';b.style.color=on?'#fff':'';b.style.borderColor=on?'transparent':'';});
 const listBox=$('#radarCards'),featBox=$('#radarFeatured');if(!listBox)return;
 $('#radarLawNote').hidden=!field?.officialDomains?.length;
 $('#radarListTitle').textContent='Tin theo lĩnh vực: '+(field?.label||'');
 let cards=[];
 try{const r=await api(`/api/ingest/cards?fieldId=${encodeURIComponent(radarFieldId)}&maxAgeHours=${radarAge}&offset=0&limit=30`);if(renderId!==radarRenderId)return;cards=r.cards||[];radarPage={fieldId:radarFieldId,age:radarAge,offset:cards.length,total:r.total??cards.length,hasMore:!!r.hasMore,renderId};}catch(e){listBox.innerHTML=`<div class="empty">${radarEsc(e.message)}</div>`;return}
 cards.sort((a,b)=>(b.score||0)-(a.score||0));
 listBox.innerHTML=cards.length?cards.map(c=>radarCardHtml(c,field)).join(''):'<div class="empty">Chưa có tin phù hợp trong khoảng thời gian đã chọn. Kiểm tra nguồn đang bật hoặc thêm nguồn, rồi quét lại.</div>';
 radarMoreButton();
 featBox.innerHTML=cards.length?cards.slice(0,5).map((c,i)=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${i+1}. ${radarEsc(c.title)}</b><p class="muted" style="margin:2px 0">${c.score??'—'} điểm · ${radarEsc(c.publisher||radarSourceNames[c.sourceId]||'')}</p><div style="display:flex;gap:6px"><button class="ghost small" type="button" data-radar-produce="news-video" data-card="${c.id}">🎬 Video</button><button class="ghost small" type="button" data-radar-produce="news-article" data-card="${c.id}">✍️ Bài viết</button></div></div>`).join(''):'<div class="empty">Chưa có tin nổi bật.</div>';
}
function radarMoreButton(){
 document.getElementById('radarMore')?.remove();
 if(!radarPage?.hasMore)return;
 const b=document.createElement('button');b.id='radarMore';b.type='button';b.className='ghost';
 b.textContent=`Xem thêm (đã hiện ${radarPage.offset}/${radarPage.total})`;
 b.onclick=async()=>{const page={...radarPage};b.disabled=true;try{const r=await api(`/api/ingest/cards?fieldId=${encodeURIComponent(page.fieldId)}&maxAgeHours=${page.age}&offset=${page.offset}&limit=30`);if(page.renderId!==radarRenderId)return;const field=radarFields.find(f=>f.id===page.fieldId);b.remove();$('#radarCards').insertAdjacentHTML('beforeend',(r.cards||[]).map(c=>radarCardHtml(c,field)).join(''));radarPage={...page,offset:page.offset+(r.cards||[]).length,total:r.total,hasMore:r.hasMore};radarMoreButton();}catch(e){toast(e.message);b.disabled=false;}};
 $('#radarCards').append(b);
}
async function radarInit(){
 try{
  const [fr,sr]=await Promise.all([api('/api/ingest/fields'),api('/api/ingest/sources')]);
  radarFields=fr.fields||[];radarSourceNames=Object.fromEntries((sr.sources||[]).map(x=>[x.id,x.name]));
  const sel=$('#radarField');
  sel.innerHTML=radarFields.map(f=>`<option value="${f.id}">${radarEsc(f.label)} (${f.cards||0} tin)</option>`).join('');
  const tiles=$('#radarTiles');
  if(tiles){tiles.innerHTML=radarFields.map(f=>`<button type="button" data-radar-tile="${f.id}" class="ghost small" style="white-space:nowrap;border-radius:999px">${RADAR_FIELD_ICONS[f.id]||'📰'} ${radarEsc(f.label)}</button>`).join('');
  tiles.querySelectorAll('[data-radar-tile]').forEach(b=>b.onclick=()=>{sel.value=b.dataset.radarTile;sel.dispatchEvent(new Event('change'));});}
  if(!radarFields.some(f=>f.id===radarFieldId))radarFieldId=radarFields[0]?.id||'';
  sel.value=radarFieldId;
  if($('#radarAge'))$('#radarAge').value=String(radarAge);
  const edit=$('#radarEditField');if(edit)edit.hidden=!radarFields.find(f=>f.id===radarFieldId)?.custom;
  const sourceBox=$('#radarSources');if(sourceBox)sourceBox.innerHTML=(sr.sources||[]).filter(x=>x.fieldId===radarFieldId).map(x=>`<div class="radar-source"><label><input type="checkbox" data-radar-enable="${radarEsc(x.id)}" ${x.enabled?'checked':''}> ${radarEsc(x.name)}</label><small>${radarEsc(x.lastError||x.lastScanAt||'Chưa quét')}</small></div>`).join('')||'<p>Chưa có nguồn. Lần quét đầu sẽ tạo truy vấn Google News theo lĩnh vực.</p>';

  await radarRender();
 }catch(e){const b=$('#radarCards');if(b)b.innerHTML=`<div class="empty">${radarEsc(e.message)}</div>`}
}
$('#radarField')?.addEventListener('change',e=>{radarFieldId=e.target.value;localStorage.setItem('aios-radar-field',radarFieldId);radarInit();});
$('#radarAge')?.addEventListener('change',e=>{radarAge=Number(e.target.value);localStorage.setItem('aios-radar-age',String(radarAge));radarRender();});
$('#radarScan')?.addEventListener('click',async e=>{
 const b=e.currentTarget;b.disabled=true;$('#radarStatus').textContent='Đang quét đúng lĩnh vực đang chọn...';
 try{const r=await api('/api/ingest/scan',{method:'POST',body:JSON.stringify({fieldId:radarFieldId,maxAgeHours:radarAge})});await radarInit();
  const x=r.summary||{};$('#radarStatus').textContent=(r.status==='failed'?'Không tải được nguồn tin. ':r.status==='partial'?'Quét một phần. ':r.status==='no-sources'?'Không có nguồn đang bật. ':'Đã quét. ')+`${x.added||0} tin mới; ${x.succeeded||0}/${x.sources||0} nguồn thành công; ${x.failed||0} nguồn lỗi. `+(x.notScanned?`${x.notScanned} nguồn chưa quét do giới hạn 40 nguồn/lượt. `:'')+(x.stale?`${x.stale} tin ngoài khoảng thời gian/thiếu ngày đã loại.`:'');
  $('#radarScanDetails').textContent=(r.results||[]).filter(x=>x.error).map(x=>(x.name||x.sourceId)+': '+x.message).join('\n');
 }catch(err){$('#radarStatus').textContent=err.message;}finally{b.disabled=false;}
});
document.addEventListener('click',async e=>{
 const vf=e.target.closest('[data-radar-viewfull]');
 if(vf){const box=document.getElementById('radarFull-'+vf.dataset.radarViewfull);if(box)box.hidden=!box.hidden;return;}
 const gf=e.target.closest('[data-radar-getfull]');
 if(gf){
  gf.disabled=true;gf.textContent='⏳ Đang lấy toàn văn…';
  try{const card=await api('/api/ingest/cards/'+encodeURIComponent(gf.dataset.radarGetfull)+'/fulltext',{method:'POST',body:'{}'});
   const box=document.getElementById('radarFull-'+card.id);if(box){box.innerHTML=radarEsc(card.fullText||'').replace(/\n+/g,'<br>');box.hidden=false;}
   gf.textContent='📄 Toàn văn ('+String(card.fullText||'').length.toLocaleString('vi-VN')+' chữ)';gf.dataset.radarViewfull=card.id;gf.removeAttribute('data-radar-getfull');gf.disabled=false;
  }catch(err){gf.textContent='📄 Lấy toàn văn';gf.disabled=false;toast(err.message);}
  return;
 }
 const b=e.target.closest('[data-radar-produce]');if(!b)return;
 b.disabled=true;
 try{const r=await api('/api/reception/handoff',{method:'POST',body:JSON.stringify({pipeline:b.dataset.radarProduce,cardId:b.dataset.card,copyTeamFrom:state.project?.id,autoStart:true})});state.project=r.project;await loadProjects();await chooseProject(r.project.id);page('idea');window.workCenterRefresh?.();toast('Đã giao việc tự động. Kết quả sẽ chuyển vào Giao file khi hoàn thành.');}
 catch(err){toast(err.message);}
 finally{b.disabled=false}
});
document.addEventListener('page-change',e=>{if(e.detail.page==='radar'){radarInit();}});
$('#radarSources')?.addEventListener('change',async e=>{const b=e.target.closest('[data-radar-enable]');if(!b)return;try{await api('/api/ingest/sources/'+b.dataset.radarEnable+'/enabled',{method:'POST',body:JSON.stringify({enabled:b.checked})});}catch(err){b.checked=!b.checked;toast(err.message);}});
function radarFieldEditor(existing=null){
 const f=existing||{label:'',query:'',keywords:[]};
 modal('<h2>'+ (existing?'Sửa':'Thêm')+' lĩnh vực</h2><label>Tên lĩnh vực<input id="rfLabel" maxlength="80" value="'+radarEsc(f.label)+'" placeholder="Ví dụ: trang sức và thị trường vàng"></label><button id="rfSuggest" type="button" class="ghost">AI hiểu lĩnh vực & gợi ý từ khóa</button><p class="muted">Dùng AI của dự án đang chọn, có thể tiêu hao hạn mức. AI chỉ tạo truy vấn, không tự bịa tin.</p><label>Truy vấn tìm tin<textarea id="rfQuery" maxlength="400">'+radarEsc(f.query)+'</textarea></label><label>Từ khóa (phân cách bằng dấu phẩy)<input id="rfKeywords" value="'+radarEsc(f.keywords.join(', '))+'"></label><p id="rfMessage" role="status"></p><button class="primary" id="rfSave">Lưu lĩnh vực</button>'+(existing?' <button class="ghost" id="rfDelete">Xóa lĩnh vực này</button>':''));
 const label=()=>$('#rfLabel').value.trim();let origin=f.origin||'user';
 $('#rfSuggest').onclick=async()=>{const b=$('#rfSuggest');b.disabled=true;try{const r=await api('/api/ingest/fields/suggest',{method:'POST',body:JSON.stringify({label:label(),projectId:state.project?.id||null})});$('#rfQuery').value=r.query;$('#rfKeywords').value=r.keywords.join(', ');origin=r.origin;$('#rfMessage').textContent=r.warning||r.explanation||'Đã gợi ý. Kiểm tra lại trước khi lưu.';}catch(e){$('#rfMessage').textContent=e.message;}finally{b.disabled=false;}};
 $('#rfSave').onclick=async()=>{const b=$('#rfSave');b.disabled=true;try{const r=await api('/api/ingest/fields'+(existing?'/'+existing.id:''),{method:existing?'PUT':'POST',body:JSON.stringify({label:label(),query:$('#rfQuery').value||label(),keywords:$('#rfKeywords').value.split(','),origin})});radarFieldId=r.field.id;localStorage.setItem('aios-radar-field',radarFieldId);closeCustomerModal();await radarInit();}catch(e){$('#rfMessage').textContent=e.message;b.disabled=false;}};
 if(existing)$('#rfDelete').onclick=async()=>{if(!confirm('Xóa lĩnh vực này? Nguồn sẽ tắt; tin lịch sử được giữ lại.'))return;try{await api('/api/ingest/fields/'+existing.id,{method:'DELETE'});closeCustomerModal();radarFieldId='';await radarInit();}catch(e){$('#rfMessage').textContent=e.message;}};
}
$('#radarAddField')?.addEventListener('click',()=>radarFieldEditor());
$('#radarEditField')?.addEventListener('click',()=>radarFieldEditor(radarFields.find(f=>f.id===radarFieldId)));
$('#radarAddSource')?.addEventListener('click',()=>{
 modal('<h2>Thêm nguồn RSS/Atom</h2><p>Nguồn phải công khai, đúng lĩnh vực. Kiểm tra quyền sử dụng trước khi tái xuất bản; quét tin không chuyển quyền nội dung.</p><label>Tên nguồn<input id="rsName" maxlength="120"></label><label>URL feed<input id="rsUrl" type="url" placeholder="https://..."></label><p id="rsError" role="alert"></p><button id="rsSave" class="primary">Thêm nguồn</button>');
 $('#rsSave').onclick=async()=>{try{await api('/api/ingest/sources',{method:'POST',body:JSON.stringify({name:$('#rsName').value,url:$('#rsUrl').value,fieldId:radarFieldId,fullText:false})});closeCustomerModal();await radarInit();}catch(e){$('#rsError').textContent=e.message;}};
});
