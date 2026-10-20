// Radar tin (đợt E): chọn lĩnh vực bằng cửa xổ, tin nổi bật theo điểm,
// mỗi ô tin có Làm video / Viết bài — bấm là giao thẳng cho bộ điều phối.
let radarFieldId=localStorage.getItem('aios-radar-field')||'';
const RADAR_FIELD_ICONS={'thoi-su':'🗞️','kinh-doanh':'📈','cong-nghe':'💻','the-thao':'⚽','giai-tri':'🎭','suc-khoe':'🩺','am-thuc':'🍜','du-lich':'🧳','xe-co':'🚗','giao-duc':'🎓','phap-luat':'⚖️','khoa-hoc':'🔬','moi-truong':'🌱','nong-nghiep':'🌾','giao-thong':'🚦','viec-lam':'💼','quoc-te':'🌍','van-hoa':'🏮','bat-dong-san':'🏠','thoi-tiet':'🌦️'};
let radarFields=[];let radarSourceNames={};
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
 const used=card.usedByProjectId?' <span class="tag">Đã dùng</span>':'';
 return `<div class="card" style="margin-bottom:10px"><div style="display:flex;gap:8px;align-items:flex-start"><span class="tag" title="Điểm tin do công thức từ khóa + độ mới chấm">${card.score??'—'} điểm</span><div style="flex:1"><b>${radarEsc(card.title)}</b><p class="muted" style="margin:2px 0">${radarEsc(card.publisher||radarSourceNames[card.sourceId]||'')} · ${card.publishedAt?radarEsc(new Date(card.publishedAt).toLocaleString('vi-VN')):''}</p>${card.summary?`<p style="margin:2px 0">${radarEsc(String(card.summary).slice(0,220))}</p>`:''}${radarLawBadge(card,field)}<div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><button class="primary small" type="button" data-radar-produce="news-video" data-card="${card.id}">🎬 Làm video</button><button class="ghost small" type="button" data-radar-produce="news-article" data-card="${card.id}">✍️ Viết bài phân tích</button>${card.link?`<a class="ghost small" href="${radarEsc(card.link)}" target="_blank" rel="noopener noreferrer">Đọc nguồn ↗</a>`:''}${card.fullText?`<button class="ghost small" type="button" data-radar-viewfull="${card.id}">📄 Toàn văn (${String(card.fullText).length.toLocaleString('vi-VN')} chữ)</button>`:(card.link?`<button class="ghost small" type="button" data-radar-getfull="${card.id}">📄 Lấy toàn văn</button>`:'')}${used}</div><div id="radarFull-${card.id}" hidden style="margin-top:8px;max-height:300px;overflow:auto;border-top:1px dashed var(--line);padding-top:6px">${card.fullText?radarEsc(card.fullText).replace(/\n+/g,'<br>'):''}</div></div></div></div>`;
}
async function radarRender(){
 const field=radarFields.find(f=>f.id===radarFieldId);
 $$('#radarTiles [data-radar-tile]').forEach(b=>{const on=b.dataset.radarTile===radarFieldId;b.style.background=on?'var(--accent)':'';b.style.color=on?'#fff':'';b.style.borderColor=on?'transparent':'';});
 const listBox=$('#radarCards'),featBox=$('#radarFeatured');if(!listBox)return;
 $('#radarLawNote').hidden=!field?.officialDomains?.length;
 $('#radarListTitle').textContent='Tin theo lĩnh vực: '+(field?.label||'');
 let cards=[];
 try{const r=await api(`/api/ingest/cards?fieldId=${encodeURIComponent(radarFieldId)}`);cards=r.cards||[];}catch(e){listBox.innerHTML=`<div class="empty">${radarEsc(e.message)}</div>`;return}
 cards.sort((a,b)=>(b.score||0)-(a.score||0));
 listBox.innerHTML=cards.length?cards.slice(0,30).map(c=>radarCardHtml(c,field)).join(''):'<div class="empty">Chưa có tin nào cho lĩnh vực này. Bấm “Quét tin mới” hệ thống tự lấy tin từ nguồn Google News theo lĩnh vực.</div>';
 featBox.innerHTML=cards.length?cards.slice(0,5).map((c,i)=>`<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${i+1}. ${radarEsc(c.title)}</b><p class="muted" style="margin:2px 0">${c.score??'—'} điểm · ${radarEsc(c.publisher||radarSourceNames[c.sourceId]||'')}</p><div style="display:flex;gap:6px"><button class="ghost small" type="button" data-radar-produce="news-video" data-card="${c.id}">🎬 Video</button><button class="ghost small" type="button" data-radar-produce="news-article" data-card="${c.id}">✍️ Bài viết</button></div></div>`).join(''):'<div class="empty">Chưa có tin nổi bật.</div>';
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
  await radarRender();
 }catch(e){const b=$('#radarCards');if(b)b.innerHTML=`<div class="empty">${radarEsc(e.message)}</div>`}
}
$('#radarField')?.addEventListener('change',e=>{radarFieldId=e.target.value;localStorage.setItem('aios-radar-field',radarFieldId);radarRender();});
$('#radarScan')?.addEventListener('click',async e=>{e.target.disabled=true;$('#radarStatus').textContent='Đang quét…';try{await api('/api/ingest/scan',{method:'POST',body:'{}'});await radarInit();$('#radarStatus').textContent='Đã quét xong.';}catch(err){$('#radarStatus').textContent=err.message;}finally{e.target.disabled=false}});
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
 try{const r=await api('/api/orchestrator/run',{method:'POST',body:JSON.stringify({pipeline:b.dataset.radarProduce,cardId:b.dataset.card})});toast(b.dataset.radarProduce==='news-video'?'Đã giao đội AI làm video — xem tiến độ và duyệt đăng ở tab Publish.':'Đã giao đội AI viết bài — bài kèm caption + hashtag sẽ về Publish chờ duyệt.');if(r?.run?.id)console.info('radar run',r.run.id);}
 catch(err){toast(err.message);}
 finally{b.disabled=false}
});
document.addEventListener('page-change',e=>{if(e.detail.page==='radar'){radarInit();}});
