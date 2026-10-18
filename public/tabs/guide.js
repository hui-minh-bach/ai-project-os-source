const guideData=[['🤖','OpenAI','API dành cho ứng dụng (khác đăng nhập ChatGPT).','https://platform.openai.com/api-keys'],['✦','Gemini','API của Google.','https://aistudio.google.com/apikey'],['◐','Claude','API của Anthropic.','https://console.anthropic.com/'],['⌘','GitHub','Lưu mã nguồn và lịch sử phiên bản.','https://github.com/new'],['▲','Vercel','Deploy website khi sản phẩm đã kiểm thử.','https://vercel.com/new'],['⚡','Supabase','Cơ sở dữ liệu khi dự án cần.','https://supabase.com/dashboard/new'],['🎙','HeyGen','TTS tự nhiên (cần quyền API / có thể phát sinh phí).','https://app.heygen.com/']];
$('#guides').innerHTML=guideData.map(x=>`<div class="guide"><div class="icon">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p><a target="_blank" rel="noopener noreferrer" href="${x[3]}">Mở trang chính thức ↗</a></div>`).join('');
async function customerLoadHealth(){
 const el=$('#customerHealth');if(!el)return;
 el.textContent='Đang kiểm tra...';
 try{const h=await api('/api/system/readiness');const ok=v=>v?'Sẵn sàng':'Chưa có';
   const rows=[['Local Worker',h.installed.core,'Khởi động AI Core'],['Git',h.installed.git,'AI Team / version control (INSTALL-CODE-TOOLS-WINDOWS.cmd)'],['FFmpeg',h.installed.ffmpeg&&h.installed.ffprobe,'Dựng video MP4'],['HeyGen TTS',h.installed.heygenTtsConfigured,'Đã cấu hình key (chưa xác minh quyền/gói)']];
   el.innerHTML=`<div class="customer-runtime-grid">${rows.map(([name,available,detail])=>`<div class="customer-runtime"><strong>${esc(name)}</strong><span class="customer-${available?'yes':'no'}">${ok(available)}</span><small>${esc(detail)}</small></div>`).join('')}</div><p class="muted">Phiên bản: ${esc(h.version)} · Node ${esc(h.node)} · Chỉ mở tại 127.0.0.1</p><p class="muted">Nơi dữ liệu: <code>${esc(h.dataDir)}</code></p><p class="muted">Nơi bản sao lưu: <code>${esc(h.backupDir)}</code></p>`;
 }catch(e){el.textContent='Không thể kiểm tra trạng thái: '+e.message;}
}
async function customerLoadBackups(){
 const e=$('#customerBackupList');if(!e)return;
 e.textContent='Đang tải...';
 try{const bs=await api('/api/system/backups');
   e.innerHTML=bs.length?bs.map(b=>`<div class="customer-backup-row"><span>${esc(b.name)}</span><small>${(b.size/1048576).toFixed(2)} MB</small><a href="/api/system/backups/${encodeURIComponent(b.name)}" download="${esc(b.name)}">Tải về máy</a></div>`).join(''):'<p>Chưa có bản sao lưu. Hãy tạo bản đầu tiên.</p>';
 }catch(err){e.textContent='Không tải được danh sách: '+err.message;}
}
let customerBackupBusy=false;
$('#customerBackupCreate').onclick=async()=>{
 const pw=$('#customerBackupPassword').value,confirm=$('#customerBackupConfirm').value,feedback=$('#customerBackupFeedback');
 if(pw.length<12||pw!==confirm){feedback.textContent='Mật khẩu cần ít nhất 12 ký tự và hai ô phải giống nhau.';return;}
 if(customerBackupBusy)return;
 customerBackupBusy=true;$('#customerBackupCreate').disabled=true;feedback.textContent='Đang mã hóa dữ liệu. Không đóng chương trình...';
 try{const b=await api('/api/system/backup',{method:'POST',body:JSON.stringify({password:pw})});
   feedback.textContent=`Đã tạo ${b.files} tệp dữ liệu, có mã hóa. Hãy tải bản backup xuống và cất tại ổ khác.`;
   $('#customerBackupPassword').value='';$('#customerBackupConfirm').value='';await customerLoadBackups();
 }catch(e){feedback.textContent='Sao lưu thất bại: '+e.message;}
 finally{customerBackupBusy=false;$('#customerBackupCreate').disabled=false;}
};
$('#customerCheck').onclick=customerLoadHealth;
$('#customerBackupRefresh').onclick=customerLoadBackups;
document.addEventListener('page-change',e=>{if(e.detail?.page==='guide'){customerLoadHealth();customerLoadBackups();}});

async function customerTtsStatus(){
 const label=$('#customerTtsStatus');
 try{const c=await api('/api/system/tts/config');
   label.textContent=c.configured?'Đã lưu khóa HeyGen trong Vault (chưa xác minh quyền/gói).':c.envConfigured?'Máy có biến HEYGEN_API_KEY (chưa xác minh quyền/gói).':'Chưa cấu hình HeyGen trong Vault.';
   label.textContent+=c.vault?' Vault đang mở.':' Mở Vault để thêm hoặc chỉnh sửa.';
   $('#customerTtsVoice').value=c.voiceId||'';
 }catch(e){label.textContent='Không kiểm tra được cấu hình: '+e.message;}
}
$('#customerTtsSave').onclick=async()=>{
 const label=$('#customerTtsStatus'),apiKey=$('#customerTtsApiKey').value.trim(),voiceId=$('#customerTtsVoice').value.trim();
 try{const result=await api('/api/system/tts/config',{method:'POST',body:JSON.stringify({apiKey,voiceId})});
   $('#customerTtsApiKey').value='';label.textContent='Đã lưu trong Vault. Khi dựng video, hãy thử danh sách giọng; cấu hình không bảo đảm tài khoản có quyền TTS.';
   await customerLoadHealth();
 }catch(e){label.textContent='Lưu thất bại: '+e.message;}
};
$('#customerTtsDelete').onclick=async()=>{
 if(!confirm('Xóa API key HeyGen đã lưu trong Vault trên máy này?'))return;
 try{await api('/api/system/tts/config',{method:'DELETE',body:'{}'});$('#customerTtsApiKey').value='';$('#customerTtsVoice').value='';await customerTtsStatus();await customerLoadHealth();}
 catch(e){$('#customerTtsStatus').textContent='Không thể xóa: '+e.message;}
};
document.addEventListener('page-change',e=>{if(e.detail?.page==='guide')customerTtsStatus();});


// The doctor deliberately runs only after the user clicks: real local H.264
// encoding can be CPU-heavy; it never calls paid AI APIs.
// Export only allowlisted status codes and titles. Do NOT export raw errors,
// filesystem paths, task input, login, model prompts, Vault or customer data.
let customerDoctorSafeReport=null;
$('#customerDoctorExport').onclick=()=>{
 if(!customerDoctorSafeReport)return;
 const raw=JSON.stringify(customerDoctorSafeReport,null,2);
 const objectUrl=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
 const a=document.createElement('a');a.href=objectUrl;a.download='ai-project-os-diagnostics-redacted.json';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),10000);
};
let customerDoctorBusy=false;
$('#customerDoctorRun').onclick=async()=>{
 if(customerDoctorBusy)return;
 customerDoctorBusy=true;const btn=$('#customerDoctorRun'),out=$('#customerDoctorOutput');
 btn.disabled=true;$('#customerDoctorExport').disabled=true;customerDoctorSafeReport=null;out.textContent='Đang thử quyền lưu trữ và xuất clip H.264 ngắn trên máy...';
 try{
   const result=await api('/api/system/doctor',{method:'POST',body:'{}'});
   const tags={pass:'Đạt',warning:'Cần chú ý',fail:'Không đạt',info:'Thông tin'};
   const allowIds=new Set(['files','node','data','backup','space','media','encode','scene','git','core','voice','windows']);
   customerDoctorSafeReport={app:'AI Project OS Local',reportType:'redacted-opt-in',version:String(result.version||''),
      counts:Object.fromEntries(Object.entries(result.count||{}).filter(([k,v])=>['pass','warning','fail','info'].includes(k)&&Number.isSafeInteger(v))),
      checks:(result.checks||[]).filter(x=>allowIds.has(x.id)).map(x=>({id:x.id,status:['pass','warning','fail','info'].includes(x.status)?x.status:'info'}))};
   $('#customerDoctorExport').disabled=false;
   const c=result.count||{};
   out.innerHTML=`<div class="doctor-summary"><strong>Kiểm tra ${esc(result.version)}:</strong> ${c.pass||0} đạt · ${c.warning||0} cảnh báo · ${c.fail||0} lỗi</div>`+
     `<div class="doctor-grid">${(result.checks||[]).map(x=>`<div class="doctor-check"><span class="doctor-state doctor-${esc(x.status)}">${esc(tags[x.status]||'Thông tin')}</span><strong>${esc(x.title)}</strong><p>${esc(x.description)}</p>${x.status==='pass'||!x.recommendation?'':`<small>Cách xử lý: ${esc(x.recommendation)}</small>`}</div>`).join('')}</div>`+
     `<p class="muted">${esc(result.label||'')}</p>`;
 }catch(e){out.textContent='Kiểm tra thất bại: '+e.message;}
 finally{btn.disabled=false;customerDoctorBusy=false;}
};
$('#copyErrorPrompt').onclick=async()=>{const t=$('#errorPromptTemplate').textContent;const st=$('#copyErrorPromptStatus');try{await navigator.clipboard.writeText(t);st.textContent='Đã sao chép. Dán (Ctrl+V) vào ô chat của AI cùng ảnh chụp lỗi.'}catch{st.textContent='Không tự sao chép được — hãy bôi đen đoạn mẫu ở trên và nhấn Ctrl+C.'}};
