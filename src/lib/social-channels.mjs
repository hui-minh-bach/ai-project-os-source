/** Explicit per-draft publication. Token setup is manual and verified; never posts on connect. */
import crypto from 'node:crypto';
const catalog=[
 ['youtube','YouTube','video','Đăng video ở vòng khép kín'],['facebook','Facebook Page','video','Đăng video lên Page ở vòng khép kín'],['tiktok','TikTok','video','Đăng video; quyền công khai tùy ứng dụng'],
 ['threads','Threads','text-api','Bài chữ qua token Threads được cấp quyền'],['x','X','text-api','Bài chữ qua user access token; API có thể tính phí'],['zalo','Zalo OA','article-api','Bài viết OA kèm ảnh bìa HTTPS; không phải Zalo cá nhân'],
 ['instagram','Instagram','export','Xuất caption; ảnh/video lấy ở Kết quả dự án'],['zalo-personal','Zalo cá nhân','export','Xuất nội dung; đăng bằng ứng dụng Zalo'],['linkedin','LinkedIn','export','Xuất bài để đăng thủ công'],['pinterest','Pinterest','export','Xuất nội dung Pin để đăng thủ công'],['telegram','Telegram','export','Xuất bài cho kênh/nhóm'],['discord','Discord','export','Xuất nội dung cho server'],['bluesky','Bluesky','export','Xuất bài để đăng thủ công'],['mastodon','Mastodon','export','Xuất bài cho máy chủ của bạn'],['reddit','Reddit','export','Xuất bài; kiểm tra quy định cộng đồng'],['snapchat','Snapchat','export','Xuất caption; ảnh/video lấy ở Kết quả dự án'],['whatsapp','WhatsApp Business','export','Xuất nội dung; không tự gửi tin cho khách']
];
export const SOCIAL_CHANNELS=catalog.map(([id,name,mode,note])=>({id,name,mode,note}));
const origins={threads:'https://graph.threads.net',x:'https://api.x.com',zalo:'https://openapi.zalo.me'};
const fail=(code,message)=>Object.assign(new Error(message),{code});
const esc=t=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function token(c){let t;try{t=JSON.parse(c.secret);}catch{}const v=t?.accessToken||c.secret;if(!v||/[\r\n]/.test(v))throw fail('SOCIAL_AUTH','Token chưa hợp lệ.');return v;}
export function prepareSocialPost(input){
 const channel=SOCIAL_CHANNELS.find(c=>c.id===input.platform);if(!channel)throw fail('SOCIAL_KIND','Chọn một nền tảng.');
 const text=String(input.text||'').trim(),title=String(input.title||'').trim(),coverUrl=String(input.coverUrl||'').trim();
 if(!text||text.length>20000||title.length>300)throw fail('SOCIAL_CONTENT','Nội dung cần 1–20000 ký tự, tiêu đề tối đa 300 ký tự.');
 const count=[...text].length;
 if(channel.id==='threads'&&count>500)throw fail('SOCIAL_LENGTH','Threads: bài chữ tối đa 500 ký tự; app không tự cắt nội dung.');
 // Conservative weight: overcounting emoji sequences is preferable to silently truncating a post.
 const xWeight=[...text.replace(/https?:\/\/[^\s]+/g,'x'.repeat(23))].reduce((n,c)=>n+(c.codePointAt(0)>0x10ff?2:1),0);
 if(channel.id==='x'&&xWeight>280)throw fail('SOCIAL_LENGTH','X: bài vượt giới hạn 280 theo phép đếm bảo thủ. Rút gọn trước khi đăng.');
 if(channel.id==='zalo'){
  if(!title||[...title].length>150)throw fail('SOCIAL_TITLE','Zalo OA cần tiêu đề tối đa 150 ký tự.');
  let u;try{u=new URL(coverUrl);}catch{}if(!u||u.protocol!=='https:'||u.username||u.password||/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)|[:\[\]]|\.(local|localhost)$/i.test(u.hostname))throw fail('SOCIAL_COVER','Zalo OA cần URL ảnh bìa HTTPS công khai (ảnh tối đa 1 MB); file local chưa thể dùng trực tiếp.');
 }
 return {platform:channel.id,title,text,coverUrl};
}
export async function socialRequest(kind,path,{connection,method='GET',body,fetchImpl=fetch}={}){
 if(!origins[kind]||connection.kind!==kind)throw fail('SOCIAL_IDENTITY','Sai tài khoản/nền tảng.');
 const headers=kind==='zalo'?{access_token:token(connection)}:{authorization:'Bearer '+token(connection)};if(body)headers['content-type']='application/json';
 let res;try{res=await fetchImpl(origins[kind]+path,{method,headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw fail('SOCIAL_UNCERTAIN','Không nhận được phản hồi xác nhận. Không tự gửi lại để tránh đăng trùng.');}
 const data=await res.json().catch(()=>null);
 if(!res.ok||!data||data.error){throw fail('SOCIAL_HTTP','Nền tảng '+kind+' chưa xác nhận yêu cầu (HTTP '+res.status+'). Kiểm tra quyền/token/hạn mức trên nền tảng; app không tự thử đăng lại.');}
 return data;
}
export async function socialIdentity(kind,connection,{fetchImpl=fetch}={}){
 const path={threads:'/v1.0/me?fields=id,username',x:'/2/users/me',zalo:'/v2.0/oa/getoa'}[kind];if(!path)throw fail('SOCIAL_KIND','Kênh này hiện chỉ hỗ trợ xuất nội dung.');
 const j=await socialRequest(kind,path,{connection,fetchImpl}),d=kind==='threads'?j:j.data,id=String(d?.id||d?.oaid||d?.oa_id||'');
 if(!/^[A-Za-z0-9_-]+$/.test(id))throw fail('SOCIAL_IDENTITY','Chưa xác minh được ID của tài khoản.');
 return {userId:id,accountLabel:String(d.username||d.name||id).slice(0,80),username:String(d.username||'')};
}
export function createSocialPublisher({load,save,getConnection,appendRecord,fetchImpl=fetch,simulated=false}){
 const rows=load();const busy=new Set();
 for(const r of rows)if(r.state==='publishing')r.state='uncertain';
 if(rows.length)save(rows);
 const persist=()=>save(rows);
 return {list:projectId=>structuredClone(rows.filter(r=>r.projectId===projectId)),create(projectId,input){const content=prepareSocialPost(input);const row={id:crypto.randomUUID(),projectId,...content,simulated,state:'draft',createdAt:new Date().toISOString(),stage:'draft'};rows.push(row);persist();return structuredClone(row);},async publish(id,{approvalHash,connectionId,allowApiCost=false}={}){
  const r=rows.find(r=>r.id===id);if(!r)throw fail('SOCIAL_NOT_FOUND','Không tìm thấy bản nháp.');
  if(r.state==='published')return structuredClone(r);
  if(busy.has(id))throw fail('SOCIAL_BUSY','Bài đang được xử lý.');
  if(!['threads','x','zalo'].includes(r.platform))throw fail('SOCIAL_MANUAL','Kênh này hỗ trợ xuất nội dung để đăng thủ công.');
  const expected=crypto.createHash('sha256').update(JSON.stringify({id:r.id,platform:r.platform,title:r.title,text:r.text,coverUrl:r.coverUrl,connectionId,credentialVersion:getConnection(connectionId).credentialVersion,accountId:getConnection(connectionId).meta?.userId})).digest('hex');
  if(approvalHash!==expected)throw fail('SOCIAL_APPROVAL','Cần duyệt đúng nội dung và tài khoản trước khi đăng.');
  if(r.platform==='x'&&!allowApiCost)throw fail('SOCIAL_COST','Cần đồng ý chi phí API X theo tài khoản của bạn.');
  const c=structuredClone(getConnection(connectionId));if(c.kind!==r.platform||!c.meta?.verifiedAt||!c.meta?.userId)throw fail('SOCIAL_IDENTITY','Cần liên kết và xác minh đúng tài khoản.');
  if(r.connectionId&&(r.connectionId!==c.id||r.credentialVersion!==c.credentialVersion))throw fail('SOCIAL_IDENTITY','Tài khoản/token đã đổi sau lần gửi. Không tự gửi lại.');
  if(r.state==='uncertain'&& !((r.platform==='zalo'&&r.operationToken)||(r.platform==='threads'&&r.containerId&&r.stage==='container-created')))throw fail('SOCIAL_UNCERTAIN','Lần trước chưa rõ đã đăng hay chưa. Kiểm tra trực tiếp trên nền tảng; app không gửi lại.');
  busy.add(id);r.connectionId=c.id;r.credentialVersion=c.credentialVersion;r.state='publishing';persist();
  const request=(path,body)=>{const fresh=getConnection(c.id);if(fresh.credentialVersion!==c.credentialVersion||fresh.kind!==r.platform)throw fail('SOCIAL_IDENTITY','Token đã đổi hoặc Vault đã khóa.');return socialRequest(r.platform,path,{connection:c,method:'POST',body,fetchImpl});};
  try{
   let postId,url=null;
   if(r.platform==='threads'){
    if(!r.containerId){r.stage='creating-container';persist();const j=await request('/v1.0/'+c.meta.userId+'/threads',{media_type:'TEXT',text:r.text});if(!j.id)throw fail('SOCIAL_UNCERTAIN','Threads chưa trả mã container.');r.containerId=String(j.id);r.stage='container-created';persist();}
    r.stage='publishing-container';persist();const j=await request('/v1.0/'+c.meta.userId+'/threads_publish',{creation_id:r.containerId});postId=j.id;
   }else if(r.platform==='x'){
    r.stage='creating-post';persist();const j=await request('/2/tweets',{text:r.text});postId=j.data?.id;if(postId)url='https://x.com/i/web/status/'+encodeURIComponent(postId);
   }else{
    if(!r.operationToken){r.stage='creating-article';persist();const j=await request('/v2.0/article/create',{type:'normal',title:r.title,author:c.meta.accountLabel.slice(0,50),cover:{cover_type:'photo',photo_url:r.coverUrl,status:'show'},description:r.text.slice(0,300),body:[{type:'text',content:esc(r.text)}],related_medias:[],status:'show',comment:'show'});if(!j.data?.token)throw fail('SOCIAL_UNCERTAIN','Zalo chưa trả mã tiến trình.');r.operationToken=j.data.token;r.stage='verifying-article';persist();}
    const j=await request('/v2.0/article/verify',{token:r.operationToken});postId=j.data?.id;
   }
   if(!postId)throw fail('SOCIAL_UNCERTAIN','Nền tảng chưa xác nhận mã bài đăng; chưa tính là đã đăng.');
   r.state='published';r.stage='confirmed';r.platformPostId=String(postId);r.url=url;r.publishedAt=new Date().toISOString();persist();
   // No automatic retry even if record writing fails after remote success.
   const record=appendRecord({platform:r.platform,platformVideoId:r.platformPostId,url:r.url,title:r.title,projectId:r.projectId,publishedAt:r.publishedAt,endpointHost:new URL(origins[r.platform]).hostname,simulated,metrics:null,metricsUpdatedAt:null,socialDraftId:r.id});r.recordId=record.id;persist();return structuredClone(r);
  }catch(e){if(r.state!=='published'){r.state='uncertain';r.error=e.message;persist();}throw e;}finally{busy.delete(id);}
 }};
}
export function socialApprovalHash(r,c){const connectionId=c.id;return crypto.createHash('sha256').update(JSON.stringify({id:r.id,platform:r.platform,title:r.title,text:r.text,coverUrl:r.coverUrl,connectionId,credentialVersion:c.credentialVersion,accountId:c.meta?.userId})).digest('hex');}
