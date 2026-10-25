import crypto from 'node:crypto';
import {readJson,writeJson} from './store.mjs';
import {importGithubRepo,normalizeGithubRepo} from './github-repos.mjs';
export function createGithubImportJobs({load=()=>readJson('github-import-jobs.json',[]),save=rows=>writeJson('github-import-jobs.json',rows),perform=importGithubRepo}={}){
 const rows=load();for(const j of rows)if(['queued','running'].includes(j.state)){j.state='interrupted';j.error='App đã khởi động lại trong khi nhập repo. Nạp danh sách để kiểm tra dự án đã nhập trước khi thử lại.';j.updatedAt=new Date().toISOString();}if(rows.length)save(rows);
 const update=(id,patch)=>{const j=rows.find(j=>j.id===id);Object.assign(j,patch,{updatedAt:new Date().toISOString()});save(rows);return structuredClone(j);};
 return {list:()=>structuredClone(rows.slice(-30)),get:id=>structuredClone(rows.find(j=>j.id===id)||null),start(input){
  const fullName=normalizeGithubRepo(input.fullName);const active=rows.find(j=>j.fullName?.toLowerCase()===fullName.toLowerCase()&&['queued','running'].includes(j.state));if(active)return structuredClone(active);
  const j={id:crypto.randomUUID(),fullName,state:'queued',stage:'queued',percent:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};rows.push(j);if(rows.length>100)rows.splice(0,rows.length-100);save(rows);
  // Return immediately; polling is independent of a long-lived browser POST.
  Promise.resolve().then(async()=>{update(j.id,{state:'running'});try{const result=await perform({...input,fullName},{onProgress:p=>update(j.id,p)});update(j.id,{state:'completed',stage:'completed',result,error:null});}catch(e){const known=/^(Clone quá thời gian|Không truy cập được repo|Git không kết nối được|Git clone không hoàn tất|Phiên GitHub CLI|Thiếu xác thực GitHub|Chưa liên kết|Máy chưa cài Git|Repo này đã|Link GitHub cần)/.test(e.message||'');update(j.id,{state:'failed',error:known?e.message:'Không nhập được repo. Kiểm tra kết nối/quyền GitHub và thử lại.'});}});
  return structuredClone(j);
 }};
}
