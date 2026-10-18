'use strict';
const {fs,path,uid,fail,privateDir,atomic,load,redact}=require('./common.cjs');
const FINAL=new Set(['completed','failed','cancelled']);
const KINDS=new Set(['software','video_edit','story','publish']);
const STATES=new Set(['queued','running','paused','blocked','waiting_approval','interrupted','review','completed','failed','cancelled']);
function checkTask(t){if(!t||typeof t!=='object'||(typeof t.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(t.id))||(typeof t.projectId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(t.projectId))||!KINDS.has(t.kind)||!STATES.has(t.state)||!Array.isArray(t.dependencyIds)||!Array.isArray(t.outputArtifactIds)||!Number.isFinite(t.progress)||t.progress<0||t.progress>100||typeof t.createdAt!=='string'||typeof t.updatedAt!=='string')throw fail('BAD_TASK','Invalid CoreServices v1 task');return t;}
// Do not persist raw credentials supplied by a caller or an untrusted planner.
// Existing v0.7.7 tasks are loaded unchanged so upgrades do not delete projects.
function guardTaskInput(input){
 let serialized;try{serialized=JSON.stringify(input);}catch{throw fail('TASK_INPUT','Task input cannot be serialized');}
 if(typeof serialized!=='string'||Buffer.byteLength(serialized)>128000)throw fail('TASK_INPUT','Task input is too large');
 const visit=(v,depth=0)=>{
  if(depth>14)throw fail('TASK_INPUT','Task input nesting too deep');
  if(typeof v==='string'){if(/sk-[a-zA-Z0-9_-]{18,}|AIza[a-zA-Z0-9_-]{22,}|-----BEGIN [^-]*PRIVATE KEY-----|gh[pousr]_[a-zA-Z0-9]{20,}/.test(v))throw fail('SENSITIVE_TASK','Do not store credentials in task payload');return;}
  if(!v||typeof v!=='object')return;
  if(Array.isArray(v)){for(const item of v)visit(item,depth+1);return;}
  for(const [key,value] of Object.entries(v)){
   if(/^(api[_-]?key|secret|password|passphrase|private[_-]?key|authorization|access[_-]?token|refresh[_-]?token|cookie|credentials?)$/i.test(key)||['__proto__','prototype','constructor'].includes(key))throw fail('SENSITIVE_TASK','Credentials and prototype overrides are forbidden in task data');
   visit(value,depth+1);
  }
 };visit(input);return input;
}
class State {
 constructor(root){this.root=privateDir(root);this.file=path.join(this.root,'tasks.json');this.eventFile=path.join(this.root,'events.json');this.lockfile=path.join(this.root,'core.lock');this.lock();this.data=load(this.file,{version:1,tasks:[],roles:{},projects:[],providers:[],skills:[]});if(this.data.version!==1||!Array.isArray(this.data.tasks))throw fail('CORRUPT_STATE','Unknown task state version');for(const t of this.data.tasks){checkTask(t);if(t.state==='running'||t.state==='review'){t.state='interrupted';t.error={code:'RECOVERY_REQUIRES_REVIEW',message:'Interrupted task requires a fresh operator decision; never replay an in-flight step automatically'};t.updatedAt=new Date().toISOString();}}this.events=load(this.eventFile,{version:1,items:[]});this.persist();}
 lock(){try{fs.writeFileSync(this.lockfile,JSON.stringify({pid:process.pid,id:uid()}),{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;const old=load(this.lockfile,{});if(!Number.isInteger(old.pid)||old.pid<=0)throw fail('LOCKED','Investigate invalid lock; no automatic removal');try{process.kill(old.pid,0);throw fail('LOCKED','Another AI Core process owns this directory');}catch(err){if(err.code!=='ESRCH')throw err;}fs.rmSync(this.lockfile);return this.lock();}this.onExit=()=>{try{const c=load(this.lockfile,{});if(c.pid===process.pid)fs.rmSync(this.lockfile,{force:true});}catch{}};process.on('exit',this.onExit);}
 persist(){atomic(this.file,this.data);}
 emit(type,payload){const v={id:uid(),type,at:new Date().toISOString(),payload:JSON.parse(JSON.stringify(payload,(key,value)=>typeof value==='string'?redact(value):value))};this.events.items.push(v);if(this.events.items.length>1000)this.events.items.splice(0,this.events.items.length-1000);atomic(this.eventFile,this.events);return v;}
 list(){return this.data.tasks.map(t=>structuredClone(t));}
 find(id){const t=this.data.tasks.find(t=>t.id===id);if(!t)throw fail('NOT_FOUND','Task not found');return t;}
 add(t){checkTask(t);guardTaskInput(t.input);if(this.data.tasks.some(x=>x.id===t.id))throw fail('DUPLICATE','Task exists');if(t.dependencyIds.includes(t.id)||t.dependencyIds.some(id=>!this.data.tasks.some(x=>x.id===id&&x.projectId===t.projectId)))throw fail('BAD_DEPENDENCY','Dependency must exist in same project');const scan=(id,seen)=>{if(seen.has(id))throw fail('DEPENDENCY_CYCLE','Circular dependency');seen.add(id);const x=this.data.tasks.find(x=>x.id===id);for(const dep of x?.dependencyIds||[])scan(dep,new Set(seen));};for(const id of t.dependencyIds)scan(id,new Set([t.id]));this.data.tasks.push(t);this.persist();this.emit('task.created',{id:t.id,kind:t.kind});return structuredClone(t);}
 update(id,fn){const current=this.find(id),candidate=structuredClone(current);fn(candidate);candidate.updatedAt=new Date().toISOString();checkTask(candidate);const index=this.data.tasks.findIndex(t=>t.id===id);this.data.tasks[index]=candidate;try{this.persist();}catch(e){this.data.tasks[index]=current;throw e;}this.emit('task.updated',{id,state:candidate.state,progress:candidate.progress,error:candidate.error});return structuredClone(candidate);}
 stop(){this.persist();this.onExit();process.removeListener('exit',this.onExit);}
}
function makeTask({id=uid(),projectId,kind='software',dependencyIds=[],modelRef=null,input={},maxAttempts=2}){const ts=new Date().toISOString();if(!/^[a-zA-Z0-9_-]{1,80}$/.test(projectId||''))throw fail('BAD_PROJECT','Invalid project id');if(!KINDS.has(kind))throw fail('BAD_KIND','Unknown kind');if(maxAttempts<1||maxAttempts>4||!Number.isInteger(maxAttempts))throw fail('BAD_RETRY','Invalid retry limit');guardTaskInput(input);return checkTask({id,projectId,kind,state:'queued',progress:0,dependencyIds,modelRef,outputArtifactIds:[],error:null,createdAt:ts,updatedAt:ts,startedAt:null,completedAt:null,attempts:0,maxAttempts,input,checkpoint:{stage:'queued'},review:null});}
module.exports={State,makeTask,checkTask,guardTaskInput,KINDS,STATES,FINAL};
