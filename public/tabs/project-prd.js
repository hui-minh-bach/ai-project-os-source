// The Council's approved Specification is the only source of this read-only PRD.
const prdView={projectId:null,selected:null,history:[],request:0};
const prdBox=()=>document.getElementById('projectPrdContent');
const prdBase=id=>`/api/projects/${encodeURIComponent(id)}/prd`;
const prdLabels={businessObjectives:'Mục tiêu kinh doanh',scope:'Phạm vi',outOfScope:'Ngoài phạm vi',functionalRequirements:'Yêu cầu chức năng',userFlows:'Luồng người dùng',nonFunctionalRequirements:'Yêu cầu phi chức năng / Bảo mật',data:'Dữ liệu',integrations:'Tích hợp',acceptanceCriteria:'Tiêu chí nghiệm thu'};
function prdState(message,retry=false){const box=prdBox();if(!box)return;box.innerHTML=`<p class="prd-status">${esc(message)}</p>${retry?'<button class="ghost small" type="button" data-prd-retry>Thử lại</button>':''}`;}
function prdRender(doc){
 const box=prdBox(),history=prdView.history;
 const section=(key,value)=>`<section class="prd-section"><h3>${prdLabels[key]}</h3>${Array.isArray(value)?value.length?`<ul>${value.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:'<p class="muted">Chưa được xác định trong Specification đã duyệt.</p>':`<p>${esc(value)}</p>`}</section>`;
 const past=!doc.current;
 box.innerHTML=`<div class="prd-meta"><span class="tag good">Đã phê duyệt</span><span>PRD v${esc(doc.version)}</span><span>PO · ${esc(new Date(doc.approvedAt).toLocaleString('vi-VN'))}</span>${past?'<span class="tag warn">Bản lịch sử</span>':''}</div>
 <p class="muted">Specification nguồn: v${esc(doc.version)} · Mã nội dung: <code>${esc(doc.contentHash.slice(0,12))}</code>. Tài liệu chính thức chỉ đọc; muốn thay đổi yêu cầu, hãy chốt Specification mới tại AI Council.</p>
 <div class="prd-actions"><a class="ghost small" href="${prdBase(prdView.projectId)}/${encodeURIComponent(doc.id)}/markdown" download="PRD-v${esc(doc.version)}.md">Tải Markdown (.md)</a></div>
 <div class="prd-grid">${Object.entries(prdLabels).map(([key])=>section(key,doc.sections[key])).join('')}</div>
 <div class="prd-history"><strong>Lịch sử phiên bản</strong>${history.map(item=>`<button class="ghost small" type="button" data-prd-version="${esc(item.id)}" aria-current="${item.id===doc.id}">v${esc(item.version)} · ${esc(new Date(item.approvedAt).toLocaleDateString('vi-VN'))}</button>`).join('')}</div>`;
}
async function prdSelect(id){
 const projectId=prdView.projectId,serial=++prdView.request;prdState('Đang tải PRD…');
 try {const doc=await api(`${prdBase(projectId)}/${encodeURIComponent(id)}`);
   if(serial!==prdView.request||projectId!==state.project?.id)return;
   prdView.selected=doc.id;prdRender(doc);
 }catch(error){if(serial===prdView.request)prdState('Không thể tải PRD: '+error.message,true);}
}
async function prdLoad(){
 const box=prdBox();if(!box)return;
 const id=state.project?.id,serial=++prdView.request;prdView.projectId=id;prdView.selected=null;
 if(!id){prdState('Chưa chọn dự án. Chọn hoặc tạo dự án để xem tài liệu.');return;}
 prdState('Đang tải PRD…');
 try {const data=await api(prdBase(id));if(serial!==prdView.request||id!==state.project?.id)return;
   prdView.history=data.history||[];
   if(!data.current){prdState(prdView.history.length?'Chưa có PRD hiện hành. Chốt Specification mới trong AI Council; bản cũ vẫn ở lịch sử.':'Chưa có PRD chính thức. Chốt Specification trong AI Council để tạo tài liệu.');
     if(prdView.history.length)box.insertAdjacentHTML('beforeend',`<div class="prd-history"><strong>Lịch sử đã duyệt</strong>${prdView.history.map(item=>`<button class="ghost small" type="button" data-prd-version="${esc(item.id)}">v${esc(item.version)}</button>`).join('')}</div>`);
     return;
   }
   await prdSelect(data.current);
 }catch(error){if(serial===prdView.request)prdState('Không thể tải PRD: '+error.message,true);}
}
prdBox()?.addEventListener('click',event=>{
 const version=event.target.closest('[data-prd-version]');if(version){prdSelect(version.dataset.prdVersion);return;}
 if(event.target.closest('[data-prd-retry]'))prdLoad();
});
document.addEventListener('project-change',prdLoad);
document.addEventListener('page-change',event=>{if(event.detail?.page==='council')prdLoad();});
