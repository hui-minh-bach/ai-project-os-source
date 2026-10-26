/* v0.9.82 simple client flow. No hidden automatic publishing or paid calls. */
(()=>{
 const root=document.querySelector('#mediaStudio');if(!root)return;
 const q=id=>root.querySelector('#'+id),apiCall=(url,body)=>api(url,{method:'POST',body:JSON.stringify(body)});
 const status=(message,kind='')=>{q('mediaSimpleStatus').textContent=message;q('mediaSimpleStatus').className='mediaSimpleStatus '+kind;};
 let source='',projectId='',jobId='',resultArtifact=null,uploading=false;
 const step=n=>root.querySelectorAll('[data-simple-step]').forEach((el,i)=>{el.classList.toggle('done',i<n);el.classList.toggle('current',i===n)});
 const buttonState=()=>{q('mediaSimpleGenerate').disabled=uploading||!source||!q('mediaSimpleRights').checked||!state.project?.id};
 const clearResult=()=>{resultArtifact=null;jobId='';q('mediaSimpleDownload').hidden=true;q('mediaSimplePublish').disabled=true;q('mediaSimpleResultBadge').textContent='Chưa có kết quả'};
 const reset=()=>{source='';projectId=state.project?.id||'';clearResult();q('mediaSimpleSource').textContent='Chưa chọn video.';q('mediaSimplePlayer').removeAttribute('src');step(0);buttonState()};
 const setPreview=(url)=>{const video=q('mediaSimplePlayer');video.src=url;video.load()};
 const selectAdvanced=show=>{root.classList.toggle('mediaSimpleMode',!show);if(show){mediaSwitchMode('localize');if(source){mediaUI.source=source;mediaUI.sourceProjectId=state.project.id;mediaSourceRefresh();} }else{step(resultArtifact?3:source?1:0)}};
 q('mediaSimpleAdvanced').onclick=()=>selectAdvanced(true);q('mediaSimpleBack').onclick=()=>selectAdvanced(false);
 q('mediaSimpleRights').onchange=buttonState;
 q('mediaSimpleFile').onchange=async()=>{
   const file=q('mediaSimpleFile').files?.[0];if(!file)return;
   if(!state.project?.id){status('Chọn hoặc tạo dự án trước.','error');return;}
   if(file.size>150*1024*1024||!/\\.(mp4|mov|mkv|webm|m4v)$/i.test(file.name)){status('Chỉ hỗ trợ MP4/MOV/MKV/WEBM/M4V, tối đa 150 MB.','error');return;}
   uploading=true;buttonState();clearResult();step(0);status('Đang tải video và kiểm tra dữ liệu…');
   try{
     const response=await fetch('/api/integrations/media/upload',{method:'POST',headers:{'x-media-filename':encodeURIComponent('upload'+file.name.match(/\\.[^.]+$/)[0].toLowerCase())},body:file});
     const uploaded=await response.json();if(!response.ok)throw new Error(uploaded.error||'Không nhập được tệp.');
     if(projectId&&projectId!==state.project.id)throw new Error('Bạn đã đổi dự án trong lúc tải video.');
     source=uploaded.source;projectId=state.project.id;mediaUI.source=source;mediaUI.sourceLabel=file.name;mediaUI.sourceProjectId=projectId;mediaSourceRefresh();mediaDirectorSourceRefresh();
     q('mediaSimpleSource').textContent='Đã nhận: '+file.name+' · '+(file.size/1048576).toFixed(1)+' MB';
     setPreview('/api/integrations/media/source?source='+encodeURIComponent(source));step(1);
     status('Đã tải video. Đang phân tích khả năng dựng video…');
     const ready=await preflight();
     status(ready.ready?'Đã phân tích nguồn và công cụ. Chọn giọng rồi bấm Tạo video tự động.':'Cần bổ sung công cụ: '+ready.checks.filter(c=>!c.ready).map(c=>c.message).join(' · '),ready.ready?'ok':'error');
   }catch(e){status('Không thể tải/phân tích: '+e.message,'error');}finally{uploading=false;buttonState();}
 };
 function params(){
   const voice=q('mediaSimpleVoice').value;
   return {source,sourceLanguage:'auto',cleanupMode:'auto',coverSubtitles:true,autoCoverScope:'all',autoCoverPct:8,ocrLanguage:'eng',fitVideo:true,ttsProvider:voice,rightsConfirmed:q('mediaSimpleRights').checked,confirmPaidVoice:false};
 }
 async function preflight(){return apiCall('/api/integrations/media/localize/preflight',{projectId:state.project.id,...params()})}
 q('mediaSimpleVoice').onchange=()=>{if(source){void preflight().then(s=>status(s.ready?'Giọng đã chọn sẵn sàng. Có thể tạo video.':'Chưa sẵn sàng: '+s.checks.filter(c=>!c.ready).map(c=>c.message).join(' · '),s.ready?'ok':'error')).catch(e=>status(e.message,'error'))}};
 q('mediaSimpleGenerate').onclick=async()=>{
   if(!source||!state.project?.id||state.project.id!==projectId){status('Nguồn và dự án không khớp. Tải lại video.','error');return;}
   if(!q('mediaSimpleRights').checked){status('Xác nhận quyền chỉnh sửa video trước.','error');return;}
   const settings=params();if(['fpt','heygen'].includes(settings.ttsProvider)){
     const approved=window.confirm('Giọng này có thể phát sinh chi phí API. Bạn có đồng ý sử dụng hạn mức/chi phí theo tài khoản đã kết nối?');
     if(!approved)return;settings.confirmPaidVoice=true;
   }
   uploading=true;buttonState();clearResult();step(2);status('Kiểm tra Whisper, OCR, AI dịch, FFmpeg và giọng đọc…');
   try{
     const ready=await apiCall('/api/integrations/media/localize/preflight',{projectId,...settings});
     if(!ready.ready)throw new Error(ready.checks.filter(c=>!c.ready).map(c=>c.message).join(' · '));
     const task=await apiCall('/api/integrations/media/tasks',{projectId,operation:'media.localize',params:settings});
     jobId=task.id;
     await apiCall('/api/integrations/media/tasks/'+encodeURIComponent(task.id)+'/approve',{});
     status('Đã giao một tác vụ tự động: nghe → dịch → làm sạch chữ cũ → tạo tiếng Việt → phụ đề → xuất MP4. Đang dựng trên máy…','ok');
     await mediaRefreshJobs();await refresh();
   }catch(e){status('Không thể dựng video: '+e.message,'error');step(1);}finally{uploading=false;buttonState();}
 };
 async function refresh(){
   if(!jobId||!state.project||state.project.id!==projectId)return;
   try{
     const [tasks,artifacts]=await Promise.all([
       api('/api/integrations/media/tasks?projectId='+encodeURIComponent(projectId)),
       api('/api/integrations/media/artifacts?projectId='+encodeURIComponent(projectId))]);
     const t=tasks.find(t=>t.id===jobId);if(!t)return;
     if(t.state==='completed'){
       const a=artifacts.find(x=>x.taskId===jobId&&x.name==='vietnamese-final.mp4');
       if(!a){status('Tác vụ đã báo hoàn thành nhưng chưa có MP4 xác minh. Kiểm tra công cụ chuyên sâu.','error');return;}
       resultArtifact=a;step(3);const url='/api/integrations/media/artifacts/'+encodeURIComponent(a.id);
       setPreview(url);q('mediaSimpleDownload').href=url;q('mediaSimpleDownload').download='vietnamese-final.mp4';q('mediaSimpleDownload').hidden=false;
       q('mediaSimplePublish').disabled=false;q('mediaSimpleResultBadge').textContent='MP4 đã dựng · cần duyệt';
       q('mediaSimpleOutputInfo').textContent='Video hoàn chỉnh ('+(a.size/1048576).toFixed(1)+' MB). Hãy xem hết nội dung, nghe giọng đọc và xem vùng chữ đã khôi phục trước khi đăng.';
       status('Đã xuất MP4 có tiếng Việt và phụ đề. Đang chờ bạn xem và duyệt.','ok');return;
     }
     if(['failed','blocked','cancelled','interrupted'].includes(t.state)){status('Dừng do lỗi thật: '+(t.error?.message||t.state)+'. Có thể mở Công cụ chuyên sâu để khắc phục.','error');return;}
     const steps=t.localizeProgress?.steps||[];
     const done=steps.filter(s=>s.state==='completed').length;
     status('AI đang xử lý: '+(steps.find(s=>s.state==='running')?.label||'Đợi Worker')+' · '+done+'/7 bước. Video gốc vẫn được giữ nguyên.');
   }catch(e){status('Không cập nhật được tiến độ: '+e.message,'error');}
 }
 q('mediaSimplePublish').onclick=()=>{
   if(!resultArtifact||!jobId||!state.project?.id||state.project.id!==projectId){status('Chỉ được duyệt video hoàn thành của đúng dự án.','error');return;}
   const selected=resultArtifact,task=jobId;
   const stage=async()=>{
     const video=q('mediaSimplePlayer');if(!video.src.includes(encodeURIComponent(selected.id))&&!video.src.includes(selected.id))throw Error('Đang xem sai video đầu ra.');
     const r=await api('/api/integrations/status'),platforms=r.media?.platforms||{};
     const options=['youtube','facebook','tiktok'].filter(k=>platforms[k]?.connected&&!platforms[k]?.simulated);
     if(!options.length){q('mediaSimplePublishState').textContent='Chưa có tài khoản đăng video thật đã kết nối. Hãy liên kết YouTube/Facebook/TikTok trong tab Kết nối.';return;}
     const choices=options.map(k=>'<label class="checkboxLine"><input type="checkbox" data-video-destination="'+k+'">'+({youtube:'YouTube',facebook:'Facebook Page',tiktok:'TikTok'}[k])+'</label>').join('');
     const label=mediaUI.sourceLabel||'Video đã Việt hóa';
     modal('<h3>Duyệt xuất bản video</h3><p>Chọn đúng tài khoản và nền tảng muốn đăng. Bạn cần xem toàn bộ MP4 trước khi xác nhận.</p><p><b>'+esc(label)+'</b> · MP4: '+Math.round(selected.size/1048576*100)/100+' MB</p>'+choices+'<label for="mediaFinalTitle">Tiêu đề đăng</label><input id="mediaFinalTitle" maxlength="150" value="'+esc(label.replace(/\.[^.]+$/,''))+'"><label for="mediaFinalDescription">Mô tả</label><textarea id="mediaFinalDescription" rows="3" maxlength="1500">Video đã được biên tập và lồng tiếng Việt.</textarea><label class="checkboxLine"><input type="checkbox" id="mediaFinalReviewed"> Tôi đã xem, nghe và đồng ý công khai video lên các nền tảng đã chọn.</label><p id="mediaFinalError" role="alert"></p><button id="mediaFinalConfirm" type="button" class="primary">Duyệt và gửi đăng</button>');
     document.getElementById('mediaFinalConfirm').onclick=async()=>{
       const checked=[...document.querySelectorAll('[data-video-destination]:checked')].map(el=>el.dataset.videoDestination);
       const error=document.getElementById('mediaFinalError');
       if(!checked.length||!document.getElementById('mediaFinalReviewed').checked){error.textContent='Chọn nền tảng và xác nhận đã kiểm tra video.';return;}
       const title=document.getElementById('mediaFinalTitle').value.trim();
       if(!title){error.textContent='Nhập tiêu đề.';return;}
       if(state.project?.id!==projectId||jobId!==task||resultArtifact?.id!==selected.id){error.textContent='Video/dự án đã thay đổi. Mở lại duyệt đăng.';return;}
       const button=document.getElementById('mediaFinalConfirm');button.disabled=true;
       try{
         // Each platform requires its own approved media publish task; never assume successful post at queue time.
         const tasks=[];
         for(const k of checked){
           const p={video:'',title,description:document.getElementById('mediaFinalDescription').value};
           // Media API requires a workspace-relative, verified render path; artifact ID is not a path.
           // No unsafe server-side path guessing from a browser artifact.
           throw new Error('Video đã duyệt hiện là artifact an toàn. Cần liên kết artifact với đường dẫn xuất bản trên server trước khi đăng. Chưa gửi ra nền tảng nào.');
         }
         q('mediaSimplePublishState').textContent='Đã chuyển '+tasks.length+' tác vụ đăng lên hàng đợi.';
       }catch(e){error.textContent=e.message;button.disabled=false;}
     };
   };
   void stage().catch(e=>status('Không mở được duyệt đăng: '+e.message,'error'));
 };
 document.addEventListener('project-change',reset);
 setInterval(()=>{if(!document.hidden&&root.classList.contains('mediaSimpleMode')&&jobId)void refresh()},6000);
 reset();
})();
