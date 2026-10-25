import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const fail=(code,message)=>Object.assign(new Error(message),{code});
const ACTIONS=new Set(['prepare','approve','run','produce','auto-produce','retry-media','receive']);
/** Durable receipts; unfinished operations require explicit reconciliation after restart. */
export function createWorkCenter({file,backend,redact=s=>s,now=()=>new Date().toISOString()}){
 let jobs=[];const running=new Map();let closed=false;
 if(fs.existsSync(file)){try{const data=JSON.parse(fs.readFileSync(file,'utf8'));if(data.version!==1||!Array.isArray(data.jobs))throw 0;jobs=data.jobs;}catch{throw fail('WORK_STORE','Ho so cong viec bi hong; khong tu xoa hoac chay lai. Khoi phuc tu ban sao luu.');}}
 function save(){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const tmp=file+'.tmp-'+crypto.randomUUID();fs.writeFileSync(tmp,JSON.stringify({version:1,jobs},null,2),{mode:0o600});fs.renameSync(tmp,file);}
 let changed=false;for(const j of jobs)if(['queued','running'].includes(j.state)){j.state='interrupted';j.error={code:'WORK_INTERRUPTED',message:'Worker da dung. Kiem tra task/luot cu roi tiep tuc; khong tu phat lai tac dong ben ngoai.'};j.updatedAt=now();changed=true;}if(changed)save();
 const snapshot=j=>j?structuredClone(j):null;
 function list(projectId){return jobs.filter(j=>j.projectId===projectId).slice(-40).map(snapshot).reverse();}
 function latest(projectId){return list(projectId)[0]||null;}
 function active(projectId){return jobs.find(j=>j.projectId===projectId&&['queued','running'].includes(j.state));}
 async function start(projectId,action,input={},key=null){
  if(closed)throw fail('WORK_CLOSED','Worker dang dung.');
  if(!ACTIONS.has(action))throw fail('WORK_ACTION','Thao tac khong hop le.');
  const hash=crypto.createHash('sha256').update(JSON.stringify([action,input])).digest('hex');
  if(key&&(!/^[a-zA-Z0-9_-]{12,100}$/.test(key)))throw fail('WORK_KEY','Ma yeu cau khong hop le.');
  const old=key&&jobs.find(j=>j.projectId===projectId&&j.key===key);
  if(old){if(old.inputHash!==hash)throw fail('WORK_KEY_CONFLICT','Khong dung lai ma yeu cau cho noi dung khac.');return snapshot(old);}
  const previous=active(projectId);if(previous){if(previous.inputHash!==hash)throw fail('WORK_BUSY','Đang thực hiện yêu cầu khác trong dự án. Không tự thay đổi việc đang chạy.');return snapshot(previous);}
  // No awaits between reserving a project and writing the receipt.
  const j={id:crypto.randomUUID(),projectId,action,key,inputHash:hash,state:'queued',createdAt:now(),updatedAt:now(),result:null,error:null};jobs.push(j);save();
  const task=(async()=>{
   try{await backend.validate(projectId,action,input);if(closed)throw fail('WORK_CLOSED','Worker dang dung.');j.state='running';j.updatedAt=now();save();const result=await backend.execute(projectId,action,input);j.result=result;j.state='completed';}
   catch(e){j.state='failed';j.error={code:e.code||'WORK_FAILED',message:String(redact(String(e.message||e))).slice(0,1500)};}
   finally{j.updatedAt=now();save();running.delete(projectId);}
  })();running.set(projectId,task);task.catch(()=>{});return snapshot(j);
 }
 async function wait(projectId){await running.get(projectId);return latest(projectId);}
 return {start,list,latest,isActive:id=>!!active(id),wait,close(){closed=true;}};
}
