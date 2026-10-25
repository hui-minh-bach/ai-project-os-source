import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {getProject} from './projects.mjs';
import {workspaceDir} from './workspace.mjs';
import {redactVaultSecrets} from './vault.mjs';
import {collectSource,sourceZip} from './launch-artifacts.mjs';
const active=new Set(['preparing','running','testing','repairing','reviewing','merging']);
export function sourceReadiness(p){
 const tasks=(p.tasks||[]).filter(t=>!t.archivedAt);
 return {ready:tasks.length>0&&tasks.every(t=>t.status==='done'&&t.review?.approved===true)&&!tasks.some(t=>active.has(t.status)),tested:tasks.length>0&&tasks.every(t=>t.latestTestReceipt?.status==='PASS')};
}
export function projectSourceZip(id){
 const p=getProject(id),gate=sourceReadiness(p);if(!gate.ready)throw Object.assign(new Error('Source chua hoan tat/review; khong ban giao nhu san pham da xong.'),{code:'PRODUCT_SOURCE_PENDING'});
 const source=collectSource(workspaceDir(id),{redact:redactVaultSecrets});
 if(!sourceReadiness(getProject(id)).ready)throw new Error('Cong viec da thay doi trong khi dong goi.');
 return {bytes:sourceZip(source.files),metadata:{name:'project-source.zip',sha256:source.hash},source:{hash:source.hash,files:source.count,bytes:source.bytes,tested:gate.tested}};
}
export function listProducts(id,{orchestrator,host,delivery}){
 const p=getProject(id),products=[],runs=orchestrator.listRuns().filter(r=>r.projectId===id),base='/api/projects/'+encodeURIComponent(id);
 for(const r of runs){
  if(r.article&&['awaiting-approval','completed'].includes(r.state))products.push({id:'article-'+r.id,kind:'article',runId:r.id,title:r.article.title||r.title,body:r.article.body,caption:r.article.caption,hashtags:r.article.hashtags||[],sourceUrl:r.article.sourceUrl,at:r.createdAt,state:r.state,review:r.review?{approved:r.review.approved,provider:r.review.provider,model:r.review.model,scope:r.review.scope}:null,simulated:r.aiMode==='simulated',name:'article-final.md',download:'/api/work-products/'+encodeURIComponent(r.id)+'/article.md'});
 }
 let artifacts=[],mediaTasks=[],artifactError=null;try{artifacts=host.listArtifacts(id);mediaTasks=host.listTasks(id);}catch(e){artifactError=String(e.message||e).slice(0,200);}
 const selected=new Set(runs.filter(r=>r.finalArtifactId).map(r=>r.finalArtifactId));
 for(const a of artifacts){
  const task=mediaTasks.find(t=>t.id===a.taskId);if(task?.state!=='completed')continue;
  const owner=runs.find(r=>Object.values(r.operationTasks||{}).includes(a.taskId));
  if(owner&&!['awaiting-approval','completed'].includes(owner.state))continue;
  // Scene images and voice intermediates are not separate finished products.
  if(owner?.finalArtifactId&&a.id!==owner.finalArtifactId&&!['captions.srt','captions.vtt','voice.wav','thumbnail.png','script-final.md'].includes(a.name||''))continue;
  const ext=path.extname(a.name||'').toLowerCase();if(!['.mp4','.webm','.png','.jpg','.jpeg','.webp','.wav','.mp3','.srt','.vtt','.md'].includes(ext))continue;
  const run=runs.find(r=>r.finalArtifactId===a.id)||owner;
  products.push({id:a.id,kind:['.mp4','.webm'].includes(ext)?'video':['.wav','.mp3'].includes(ext)?'audio':['.srt','.vtt'].includes(ext)?'captions':ext==='.md'?'document':'image',name:a.name,title:run?.title||a.name,at:a.createdAt||run?.createdAt,bytes:a.size||a.bytes,download:'/api/integrations/media/artifacts/'+encodeURIComponent(a.id),runId:run?.id||null,state:run?.state||'produced',final:selected.has(a.id),narration:run?.voiceMode==='captions'?false:undefined,review:run?.review?{approved:run.review.approved,scope:run.review.scope}:null,simulated:run?.aiMode==='simulated'});
 }
 for(const r of runs.filter(x=>x.receivedLocally&&x.review?.approved&&x.aiMode==='gateway'&&['client-article','client-video'].includes(x.pipeline)&&(x.article||x.finalVideo))){products.push({id:'delivery-'+r.id,kind:'bundle',name:'client-delivery.zip',title:r.title,at:r.completedAt||r.createdAt,state:'ready',download:'/api/work-products/'+encodeURIComponent(r.id)+'/delivery.zip'});}
 const source=sourceReadiness(p);if(source.ready)products.push({id:'source-'+id,kind:'source',name:'project-source.zip',title:p.name,at:p.updatedAt,download:base+'/products/source.zip',tested:source.tested,state:source.tested?'reviewed-tested':'reviewed-test-missing'});
 let launch=null;try{launch=delivery.getForProject(id);}catch{}
 if(launch?.handoff){const b=base+'/launch/'+encodeURIComponent(launch.id)+'/artifact/';products.push({id:launch.id,kind:'website',name:'website-source.zip',title:p.name,at:launch.updatedAt,url:launch.handoff.url,download:b+'source.zip',qr:b+'qr.svg',state:launch.state,target:launch.handoff.target,sourceHash:launch.handoff.sourceHash});}
 return {projectId:id,products:products.reverse(),artifactError,source,at:new Date().toISOString()};
}
export function articleDocument(run){if(!run?.article)throw new Error('Bai viet chua duoc tao.');const a=run.article;return '# '+a.title+'\n\n'+a.body+'\n\n---\n\n'+(a.caption||'')+'\n\n'+(a.sourceUrl?'Nguồn tham khảo: '+a.sourceUrl+'\n\n':'')+(a.clientOrder?'Ghi chú: Các thông tin quảng cáo cần được khách hàng xác nhận trước khi đăng.\n':'')+(run.aiMode==='simulated'?'BAN MO PHONG - KHONG PHAI SAN PHAM AI THAT\n':'');}

/** Self-contained client delivery. Files are read ONLY from completed artifacts
 * belonging to the run. No arbitrary workspace paths, credentials or temp logs. */
export function customerDeliveryBundle(run,{host,maxBytes=120*1024*1024}={}){
 const fail=(code,message)=>Object.assign(new Error(message),{code});
 if(!run?.id||!run.projectId||run.aiMode!=='gateway'||run.review?.approved!==true||run.state!=='completed'||run.receivedLocally!==true||!run.deliveryOnly)
   throw fail('CLIENT_DELIVERY_NOT_READY','Đơn hàng chưa có AI thật, Reviewer duyệt và biên bản bàn giao; không tạo ZIP giả.');
 const entries=[],manifest={version:1,source:'AI Project OS',runId:run.id,orderTitle:run.title,pipeline:run.pipeline,aiMode:run.aiMode,approvedBy:{provider:run.review.provider,model:run.review.model,scope:run.review.scope},quality:run.quality||null,createdAt:run.completedAt||null,files:[],notice:'Khách xác minh nội dung, quyền hình ảnh, nhãn hiệu và thông tin thương mại trước khi phát hành. ZIP này chưa phải bằng chứng có doanh thu hoặc đã đăng.'};
 let sum=0;
 const add=(name,data)=>{
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(name)||!Buffer.isBuffer(data))throw fail('CLIENT_BUNDLE_FILE','Tên hoặc dữ liệu file bàn giao không hợp lệ.');
  sum+=data.length;if(sum>maxBytes)throw fail('CLIENT_DELIVERY_LARGE','Gói video vượt giới hạn ZIP an toàn; tải trực tiếp MP4 và các tệp riêng trong khu bàn giao.');
  const sha256=crypto.createHash('sha256').update(data).digest('hex');
  entries.push({file:'deliverables/'+name,data:data.toString('base64')});manifest.files.push({name,bytes:data.length,sha256});
 };
 if(run.article){add('article-final.md',Buffer.from(articleDocument(run),'utf8'));}
 else {
  if(!run.finalArtifactId||!run.quality||!run.finalVideo)throw fail('CLIENT_DELIVERY_NOT_READY','Video chưa có kết quả kiểm tra MP4 cuối.');
  const tasks=new Set(Object.values(run.operationTasks||{}));
  const candidates=host.listArtifacts(run.projectId).filter(a=>tasks.has(a.taskId||a.sourceTaskId));
  const needed=['voice.wav','captions.srt','captions.vtt','script-final.md','thumbnail.png'];
  const final=candidates.find(a=>a.id===run.finalArtifactId);
  if(!final)throw fail('CLIENT_DELIVERY_NOT_READY','Artifact video cuối không còn trong kho.');
  const read=a=>{const asset=host.artifact(a.id),bytes=Buffer.isBuffer(asset?.bytes)?asset.bytes:typeof asset?.filePath==='string'&&fs.existsSync(asset.filePath)?fs.readFileSync(asset.filePath):null;
   if(!bytes||bytes.length===0)throw fail('CLIENT_BUNDLE_ASSET','Không đọc được file: '+a.name);return bytes;};
  add('video-final.mp4',read(final));
  for(const name of needed){const asset=candidates.find(x=>x.name===name);if(!asset&&['voice.wav','captions.srt','script-final.md'].includes(name))throw fail('CLIENT_BUNDLE_ASSET','Thiếu file bắt buộc: '+name);if(asset)add(name,read(asset));}
 }
 const readme=Buffer.from('AI PROJECT OS - CLIENT DELIVERY\n\nSản phẩm tạo bằng AI đã qua duyệt nội dung tự động.\nKhách hàng cần kiểm lại dữ liệu kinh doanh, giá, quyền tài sản, nhạc và hình ảnh trước khi đăng.\nKhông công bố rằng nội dung đã được thẩm định pháp lý hoặc chuyên môn.\n\nSHA-256 mỗi file ghi trong manifest.json\n','utf8');
 add('README-DELIVERY.txt',readme);
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n','utf8');
 entries.push({file:'manifest.json',data:bytes.toString('base64')});
 const zip=sourceZip(entries);return {metadata:{name:'client-delivery.zip',sha256:crypto.createHash('sha256').update(zip).digest('hex')},bytes:zip};
}
