'use strict';
/** Concat's public JSON-RPC API adapter. No AGPL code is copied or linked.
 * A user-operated Concat editor must explicitly enable Remote and provide its
 * own token. Never listen on a public interface or expose that token to UI. */
const net=require('node:net');
const fs=require('node:fs');
const path=require('node:path');
const {insist}=require('./utils.cjs');
function verify(settings){
 const host=settings?.host||'127.0.0.1',port=Number(settings?.port||7420),token=settings?.token;
 insist(['127.0.0.1','::1','localhost'].includes(host),'Concat restricted to loopback','FORBIDDEN_NETWORK');
 insist(Number.isInteger(port)&&port>0&&port<65536,'Invalid Concat port','BLOCKED_CONCAT');
 insist(typeof token==='string'&&token.length>=1&&token.length<=4096,'Concat auth token required','BLOCKED_AUTH');
 return {host,port,token};
}
function createSession(settings={}){
 const {host,port,token}=verify(settings);const timeoutMs=Math.max(1000,Math.min(15000,Number(settings.timeoutMs||4000)));
 const requestTimeoutMs=Math.max(1000,Math.min(60000,Number(settings.requestTimeoutMs||timeoutMs)));
 const sock=net.createConnection({host,port});let nextId=0,buf='',closed=false,authenticated=false;
 const pending=new Map(),events=[],waiters=[];
 let accept,decline;
 const ready=new Promise((resolve,reject)=>{accept=resolve;decline=reject});
 const authTimer=setTimeout(()=>fail(new Error('Concat authentication timed out')),timeoutMs);
 const fail=(error)=>{if(closed)return;clearTimeout(authTimer);closed=true;for(const [id,p] of pending){clearTimeout(p.timer);p.reject(error);}pending.clear();decline(error);for(const w of waiters){clearTimeout(w.timer);w.reject(error);}waiters.length=0;sock.destroy();};
 sock.on('error',fail);sock.on('close',()=>fail(new Error('Concat closed connection')));
 sock.on('connect',()=>sock.write(JSON.stringify({jsonrpc:'2.0',id:0,method:'auth',params:{token}})+'\n'));
 function consume(obj){
  if(obj?.id===0&&!authenticated){if(obj.error)return fail(new Error('Concat authentication refused'));authenticated=true;clearTimeout(authTimer);accept();return;}
  if(Object.hasOwn(obj,'id')){
   const p=pending.get(obj.id);if(!p)return;pending.delete(obj.id);clearTimeout(p.timer);
   if(obj.error){const e=new Error(String(obj.error?.message||'Concat error'));e.code=obj.error?.data?.code||'CONCAT_API';e.rpcCode=obj.error.code;e.rpcData=obj.error.data;p.reject(e);}
   else p.resolve(obj.result);return;
  }
  if(typeof obj?.method==='string'&&obj.method.startsWith('export.')){
   events.push(obj);if(events.length>100)events.shift();
   for(let i=waiters.length-1;i>=0;i--){const w=waiters[i];if(w.job===obj.params?.job&&['export.done','export.failed'].includes(obj.method)){
    waiters.splice(i,1);clearTimeout(w.timer);w.resolve(obj);
   }}
  }
 }
 sock.on('data',data=>{buf+=data.toString('utf8');if(buf.length>1024*1024)return fail(new Error('Concat JSON-RPC exceeded byte limit'));
  let ix;while((ix=buf.indexOf('\n'))>=0){const line=buf.slice(0,ix);buf=buf.slice(ix+1);if(line.length>512*1024)return fail(new Error('Concat oversized JSON reply'));let parsed;
   try{parsed=JSON.parse(line);}catch{return fail(new Error('Concat invalid JSON-RPC'));}consume(parsed);
  }
 });
 return {async call(method,params={}){
   await ready;if(closed)throw new Error('Concat connection closed');
   insist(typeof method==='string'&&/^[a-z]+(?:\.[a-z]+)?$/.test(method),'Invalid Concat operation','BLOCKED_CONCAT');
   const id=++nextId;return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Concat timed out: '+method));},requestTimeoutMs);
    pending.set(id,{resolve,reject,timer});sock.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
   });
  },
  async waitForJob(job,timeout=600000){
   insist(typeof job==='string'&&job.length<100,'Invalid Concat job','BLOCKED_CONCAT');
   const end=events.find(x=>x.params?.job===job&&['export.done','export.failed'].includes(x.method));if(end)return end;
   return new Promise((resolve,reject)=>{const w={job,resolve,reject,timer:null};w.timer=setTimeout(()=>{const i=waiters.indexOf(w);if(i>=0)waiters.splice(i,1);reject(new Error('Concat export timed out'));},Math.min(1800000,Math.max(1000,timeout)));waiters.push(w);});
  },close(){if(!closed)fail(new Error('Concat session ended'));}};
}
async function call(settings,method,params={}){const c=createSession(settings);try{return await c.call(method,params);}finally{c.close();}}
async function probe(settings){const v=await call(settings,'version');insist(v&&typeof v==='object'&&(String(v.apiVersion||'').startsWith('0.2')||v.capabilities?.includes('json-rpc')),'Unsupported Concat API; require API 0.2','BLOCKED_CONCAT');return v;}
async function createProjectFromVideo({settings,workspace,source,output,jobId}){
 const realBase=fs.realpathSync(workspace),realSource=fs.realpathSync(source);
 insist(realSource.startsWith(realBase+path.sep)&&fs.statSync(realSource).isFile(),'Concat source outside media workspace','FORBIDDEN_PATH');
 insist(/^[a-zA-Z0-9_-]{1,90}$/.test(jobId),'Unsafe job id','FORBIDDEN_PATH');
 const location=path.join(realBase,'concat-projects');fs.mkdirSync(location,{recursive:true,mode:0o700});
 const name='aios-'+jobId;const project=path.join(location,name);
 const c=createSession(settings);
 try{
  const version=await c.call('version');insist(String(version?.apiVersion||'').startsWith('0.2')||version?.capabilities?.includes('json-rpc'),'Incompatible Concat API','BLOCKED_CONCAT');
  await c.call('project.create',{location,name});
  const imported=await c.call('media.import',{path:project,file:realSource});
  const mediaId=imported?.createdId;
  insist(typeof mediaId==='string'&&/^m[\w-]+$/i.test(mediaId),'Concat did not import media','BLOCKED_CONCAT');
  const placed=await c.call('edit.apply',{path:project,command:{op:'addClipAtFirstFree',mediaId,start:0}});
  insist(typeof placed?.createdId==='string','Concat refused to place a clip','BLOCKED_CONCAT');
  await c.call('project.save',{path:project});
  const exported=path.join(realBase,'concat-projects',name+'-export.mp4');
  const started=await c.call('export.run',{path:project,output:exported});
  insist(typeof started?.job==='string','Concat did not start export','BLOCKED_CONCAT');
  const ended=await c.waitForJob(started.job,600000);
  insist(ended.method==='export.done','Concat export failed: '+String(ended?.params?.error?.message||'unknown'),'BLOCKED_CONCAT');
  insist(fs.existsSync(exported)&&fs.statSync(exported).size>1000,'Concat did not produce output video','BLOCKED_CONCAT');
  return {project,exported,engine:'concat-external-api',concatVersion:version.concat||null};
 }finally{c.close();}
}
module.exports={call,probe,createSession,createProjectFromVideo};
