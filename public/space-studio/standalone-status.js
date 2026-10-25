// Standalone-only fallback. The approved 3D geometry/viewer is unchanged.
// Its loader catches WebGL failures without emitting an error event, so check
// the explicit startup flags and make failures visible to a human.
(()=>{
 const status=document.getElementById('spaceStatus');if(!status)return;
 let ticks=0;
 const timer=setInterval(()=>{
  ticks++;
  if(window.__spaceError){status.hidden=false;status.style.display='grid';status.textContent='Không tải được phòng 3D trên máy này. Hãy kiểm tra tăng tốc WebGL / trình điều khiển GPU hoặc quay về phòng 2D. Chi tiết: '+String(window.__spaceError).split('\n')[0].slice(0,240);clearInterval(timer);return;}
  if(window.__spaceReady){status.hidden=true;status.style.display='none';clearInterval(timer);return;}
  if(ticks>=200){status.textContent='Phòng 3D chưa khởi tạo sau 30 giây. Kiểm tra WebGL và thử mở lại; phòng 2D không bị ảnh hưởng.';clearInterval(timer);}
 },150);
})();
