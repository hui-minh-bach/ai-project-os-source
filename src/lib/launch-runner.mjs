/** Durable orchestration, independent of AI/cloud implementations for fault injection.
 * No step is considered done merely because a request was sent.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {atomicWriteText} from './store.mjs';
import {digest,launchError,qrSvg,sourceZip} from './launch-artifacts.mjs';
export const LAUNCH_STEPS=Object.freeze([
 ['build','AI build and independent review'],['validate','Final tests and frozen source'],
 ['database','Create isolated Supabase project'],['schema','Owner-only tables and private storage'],
 ['hosting','Create Vercel project'],['environment','Public app configuration'],
 ['deploy','Build and wait for READY'],['auth','Auth redirect configuration'],
 ['smoke','Verify HTTPS and exact source'],['handoff','Link, QR and source ZIP']
]);
const ACTIVE=new Set(['preparing','running']);
const str=(x,max=160)=>typeof x==='string'&&x.length>0&&x.length<=max&&!/[\x00-\x1f]/.test(x);
export function normalizeLaunchConfig(x){
 if(!x||typeof x!=='object'||Array.isArray(x))throw launchError('LAUNCH_CONFIG','Invalid delivery settings.');
 const allowed=['vercelConnectionId','teamId','database','supabaseConnectionId','organizationSlug','region','target','testMode','autoAssign'];if(Object.keys(x).some(k=>!allowed.includes(k)))throw launchError('LAUNCH_CONFIG','Unsupported delivery option.');
 if(!str(x.vercelConnectionId)||!str(x.teamId)||typeof x.database!=='boolean'||(x.database&&(!str(x.supabaseConnectionId)||!str(x.organizationSlug))))throw launchError('LAUNCH_CONFIG','Select cloud accounts and their discovered owner scopes.');
 if(!['preview','production'].includes(x.target||'preview')||!['docker','host'].includes(x.testMode||'docker'))throw launchError('LAUNCH_CONFIG','Choose preview/production and Docker/explicit Host test mode.');
 const region=x.region||'ap-southeast-1';if(!['ap-southeast-1','ap-southeast-2','ap-northeast-1','us-east-1','us-west-1','eu-central-1','eu-west-1'].includes(region))throw launchError('LAUNCH_CONFIG','Unsupported project region.');
 return {vercelConnectionId:x.vercelConnectionId,teamId:x.teamId,database:x.database,supabaseConnectionId:x.database?x.supabaseConnectionId:null,organizationSlug:x.database?x.organizationSlug:null,region,target:x.target||'preview',testMode:x.testMode||'docker',autoAssign:x.autoAssign!==false};
}
function atomicBinary(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';let fd;try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,data);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);}finally{if(fd!==undefined)fs.closeSync(fd);fs.rmSync(temp,{force:true});}}
export function createLaunchRunner({dataDir,backend,cloud,redact=x=>x,clock=()=>new Date().toISOString()}){
 const dir=path.join(dataDir,'delivery-runs'),file=path.join(dir,'runs.json');fs.mkdirSync(dir,{recursive:true});
 let db={version:1,runs:[]};if(fs.existsSync(file)){try{db=JSON.parse(fs.readFileSync(file,'utf8'));}catch{if(!fs.existsSync(file+'.bak'))throw launchError('LAUNCH_STORE','Delivery store corrupt; no safe checkpoint.');db=JSON.parse(fs.readFileSync(file+'.bak','utf8'));}}
 if(db.version!==1||!Array.isArray(db.runs))throw launchError('LAUNCH_STORE','Unsupported delivery store.');
 const active=new Map();let closing=false;
 function persist(){atomicWriteText(file,JSON.stringify(db,null,2));}
 function save(r){r.updatedAt=clock();persist();}
 for(const r of db.runs)if(ACTIVE.has(r.state)){r.state='interrupted';r.error={code:'LAUNCH_INTERRUPTED',message:'Application stopped. Resume this run; completed receipts are retained.'};r.updatedAt=clock();}persist();
 const raw=id=>{const r=db.runs.find(r=>r.id===id);if(!r)throw launchError('LAUNCH_NOT_FOUND','Delivery run not found.');return r;};
 function folder(r){if(!/^run-[a-f0-9-]{36}$/.test(r.id))throw launchError('LAUNCH_ID','Invalid delivery run ID.');return path.join(dir,r.id);}
 function projectGuard(r,approval=false){backend.assertAccess();if(closing||r.stopRequested)throw launchError('LAUNCH_STOPPED','Stopped after the current operation; created cloud resources were retained.');
  const p=backend.project(r.projectId);if((p.briefRevision||0)!==r.briefRevision)throw launchError('LAUNCH_STALE_SPEC','Idea changed. This old run cannot continue.');
  if(approval){const s=backend.specification(r.projectId);if(!s||s.id!==r.specificationId||s.status!=='approved'||digest(JSON.stringify(s.specification))!==r.specificationHash)throw launchError('LAUNCH_STALE_SPEC','Approved specification changed.');if(r.grant?.fingerprint!==digest(JSON.stringify([r.config,r.specificationId,r.specificationHash,r.identities])))throw launchError('LAUNCH_APPROVAL','Delivery consent is missing or stale.');cloud.assertIdentity(r);}
 }
 function status(r){const p=backend.project(r.projectId),s=backend.specification(r.projectId);return JSON.parse(redact(JSON.stringify({
  id:r.id,projectId:r.projectId,state:r.state,currentStep:r.currentStep,createdAt:r.createdAt,updatedAt:r.updatedAt,config:r.config,scope:r.scope||null,
  specification:s?{id:s.id,status:s.status,version:s.version,specification:s.specification}:null,
  approval:r.grant?{at:r.grant.at,target:r.config.target}:null,
  steps:LAUNCH_STEPS.map(([id,label])=>({id,label,...r.steps[id]})),resources:r.resources,source:r.source?{hash:r.source.hash,count:r.source.count,bytes:r.source.bytes}:null,
  handoff:r.handoff||null,error:r.error||null,resumeCount:r.resumeCount||0,stopRequested:!!r.stopRequested,
  tasks:(p.tasks||[]).map(t=>({id:t.id,title:t.title,status:t.status,role:t.role,summary:String(t.summary||'').slice(0,300),worker:t.servedWorkerBinding||t.workerBinding||null,reviewer:t.servedReviewerBinding||t.reviewerBinding||null,phase:t.executionStage||null})),
  roles:backend.roles?.(r.projectId)||null,events:(r.events||[]).slice(-35),
  limits:['Web delivery pilot only. No automatic domain purchase, email/SMS billing or payment setup.','HTTP/source smoke checks are not full business-flow, device or security certification.']
 })));}
 function record(r,type,message){r.events.push({at:clock(),type,message:String(redact(message)).slice(0,1800)});if(r.events.length>160)r.events.shift();save(r);}
 function fail(r,e){r.state=e.code==='LAUNCH_STOPPED'?'stopped':'needs-action';r.error={code:e.code||'LAUNCH_FAILED',message:String(redact(e.message||e)).slice(0,2000)};if(r.currentStep&&r.steps[r.currentStep])r.steps[r.currentStep]={...r.steps[r.currentStep],state:'blocked',error:r.error};record(r,'blocked',r.error.message);}
 function source(r){const s=JSON.parse(fs.readFileSync(path.join(folder(r),'snapshot.json'),'utf8'));const h=digest(JSON.stringify(s.files.map(({file,sha256,size})=>({file,sha256,size}))));if(h!==r.source?.hash||s.files.some(f=>digest(Buffer.from(f.data,'base64'))!==f.sha256))throw launchError('LAUNCH_SOURCE_CHANGED','Frozen source was modified; release stopped.');return s;}
 async function step(r,id,fn){if(r.steps[id]?.state==='done'||r.steps[id]?.state==='skipped')return r.steps[id].receipt;projectGuard(r,true);r.currentStep=id;r.steps[id]={state:'running',startedAt:clock()};record(r,'step',id);
  const receipt=await fn();r.steps[id]={...r.steps[id],state:receipt?.skipped?'skipped':'done',completedAt:clock(),receipt};save(r);projectGuard(r,true);return receipt;
 }
 function context(r){return {run:r,save:()=>save(r),guard:()=>projectGuard(r,true),source:()=>source(r)};}
 async function execute(r){try{projectGuard(r,true);r.state='running';r.error=null;save(r);
   await step(r,'build',()=>backend.build(r,()=>projectGuard(r,true)));
   await step(r,'validate',async()=>{const result=await backend.validate(r);projectGuard(r,true);const s=result.source;r.source={hash:s.hash,count:s.count,bytes:s.bytes};r.manifest=result.manifest;
    const dest=folder(r);fs.mkdirSync(dest,{recursive:true});atomicWriteText(path.join(dest,'snapshot.json'),JSON.stringify(s),{backup:false});atomicBinary(path.join(dest,'source.zip'),sourceZip(s.files));save(r);return {sourceHash:s.hash,finalTest:result.test,reviewedTasks:result.reviewedTasks};});
   for(const [id,fn] of [['database',cloud.ensureDatabase],['schema',cloud.setupDatabase],['hosting',cloud.ensureVercel],['environment',cloud.setEnvironment],['deploy',cloud.deploy],['auth',cloud.configureAuth],['smoke',cloud.smoke]])await step(r,id,()=>fn(context(r)));
   await step(r,'handoff',async()=>{const svg=qrSvg(r.resources.url);atomicWriteText(path.join(folder(r),'qr.svg'),svg,{backup:false});r.handoff={url:r.resources.url,target:r.config.target,sourceHash:r.source.hash,verifiedAt:r.steps.smoke.receipt.at,qr:true,source:true,userAcceptance:'pending'};save(r);return r.handoff;});
   r.state='delivered';r.currentStep=null;record(r,'delivered','Delivery URL, QR and source ready. Business acceptance remains with the owner.');
  }catch(e){fail(r,e);}return status(r);
 }
 async function prepare(r){try{projectGuard(r);r.state='preparing';r.error=null;r.currentStep=null;save(r);
   const pre=await cloud.preflight(r);projectGuard(r);Object.assign(r,pre);save(r);
   await backend.prepare(r);projectGuard(r);const spec=backend.specification(r.projectId);if(!spec)throw launchError('LAUNCH_SPEC','No current specification was produced. Review the AI connection/roles.');
   r.specificationId=spec.id;r.specificationHash=digest(JSON.stringify(spec.specification));r.state='needs-approval';record(r,'ready','Review the specification and exact cloud scope. No cloud resource has been created.');
  }catch(e){fail(r,e);}return status(r);
 }
 function schedule(r,fn){if(active.has(r.id))throw launchError('LAUNCH_BUSY','This delivery run is already processing.');const work=Promise.resolve().then(()=>fn(r)).finally(()=>active.delete(r.id));active.set(r.id,work);return status(r);}
 function create(projectId,config){backend.assertAccess();const p=backend.project(projectId),prior=db.runs.find(r=>r.projectId===projectId&&!['stopped','delivered'].includes(r.state));if(prior)throw launchError('LAUNCH_EXISTS','Resume or stop the existing delivery run; do not create duplicates.');
  const r={id:'run-'+crypto.randomUUID(),projectId,briefRevision:p.briefRevision||0,config:normalizeLaunchConfig(config),state:'preparing',createdAt:clock(),updatedAt:clock(),steps:{},resources:{},intents:{},events:[],resumeCount:0};db.runs.unshift(r);save(r);return schedule(r,prepare);
 }
 function approve(id,{specificationId,confirmCosts,confirmProduction=false,confirmHost=false}={}){const r=raw(id);projectGuard(r);if(r.state!=='needs-approval'||active.has(id))throw launchError('LAUNCH_APPROVAL','Run is not awaiting approval.');const s=backend.specification(r.projectId);
  if(!s||s.id!==specificationId||s.id!==r.specificationId||digest(JSON.stringify(s.specification))!==r.specificationHash)throw launchError('LAUNCH_STALE_SPEC','Specification changed; prepare again.');
  if(confirmCosts!==true||(r.config.target==='production'&&confirmProduction!==true)||(r.config.testMode==='host'&&confirmHost!==true))throw launchError('LAUNCH_APPROVAL','Explicit cloud cost, publication and unsafe Host permissions are required for the selected scope.');
  cloud.assertIdentity(r);backend.approve(r,s.id);r.grant={at:clock(),fingerprint:digest(JSON.stringify([r.config,r.specificationId,r.specificationHash,r.identities]))};r.stopRequested=false;r.state='running';save(r);return schedule(r,execute);
 }
 function resume(id){const r=raw(id);backend.assertAccess();if(active.has(id)||!['needs-action','interrupted','stopped'].includes(r.state))throw launchError('LAUNCH_STATE','Run cannot resume from this state.');if(db.runs.some(x=>x.id!==r.id&&x.projectId===r.projectId&&(!['stopped','delivered'].includes(x.state)||active.has(x.id))))throw launchError('LAUNCH_EXISTS','Another delivery run owns this project.');if(r.resumeCount>=8)throw launchError('LAUNCH_RETRY_LIMIT','Eight resume attempts reached. Inspect diagnostics/resources before starting a new run.');r.resumeCount++;r.stopRequested=false;save(r);return schedule(r,r.grant?execute:prepare);}
 function stop(id){const r=raw(id);backend.assertAccess();if(r.state==='delivered')throw launchError('LAUNCH_STATE','Delivered run cannot be stopped.');r.stopRequested=true;if(!active.has(id))r.state='stopped';record(r,'stop','Stop requested. In-flight operation may finish; resources are never silently deleted.');return status(r);}
 function getForProject(id){backend.assertAccess();backend.project(id);const r=db.runs.find(r=>r.projectId===id);return r?status(r):null;}
 function get(id){backend.assertAccess();return status(raw(id));}
 function artifact(id,name){backend.assertAccess();const r=raw(id);if(!['source.zip','qr.svg'].includes(name)||name==='qr.svg'&&r.state!=='delivered'||name==='source.zip'&&!r.source)throw launchError('LAUNCH_ARTIFACT','Artifact not ready.');const file=path.join(folder(r),name);if(!fs.existsSync(file))throw launchError('LAUNCH_ARTIFACT','Artifact file missing.');return {file,bytes:fs.readFileSync(file),mime:name.endsWith('.svg')?'image/svg+xml':'application/zip'};}
 return {create,approve,resume,stop,get,getForProject,artifact,wait:id=>active.get(id)||Promise.resolve(get(id)),isActive:projectId=>db.runs.some(r=>r.projectId===projectId&&active.has(r.id)),close(){closing=true;},options:cloud.options};
}
