'use strict';
const {uid,fail,crypto,safeName,cleanError}=require('./common.cjs');
const CAPABILITIES=new Set(['github_private_repo','vercel_preview','vercel_production']);
const now=()=>new Date().toISOString();
function validTarget(target){
 if(typeof target!=='string'||target.length<1||target.length>300||/[\r\n\x00-\x1f]/.test(target))throw fail('PUBLISH_TARGET','Invalid target');
 if(/(?:@|\/\/[^/]*:)[^/]*@/.test(target))throw fail('PUBLISH_TARGET','Do not include credentials in remote names');
 return target;
}
class PublicationGate{
 constructor({state,artifacts}){this.state=state;this.artifacts=artifacts;this.state.data.publications||=[];this.state.persist();}
 prepare({projectId,taskId,capability,target,artifactIds=[],privateRepo=true,commitSha=null}={}){
  safeName(projectId);if(typeof taskId!=='string'||!this.state.data.tasks.some(t=>t.id===taskId&&t.projectId===projectId))throw fail('PUBLISH_TASK','Publish task does not belong to this project');
  if(!CAPABILITIES.has(capability))throw fail('PUBLISH_CAPABILITY','Unsupported external action');
  validTarget(target);
  if(capability==='github_private_repo'&&privateRepo!==true)throw fail('PUBLISH_PRIVATE','Initial repositories must be private');
  if(!Array.isArray(artifactIds)||!artifactIds.length||artifactIds.length>30)throw fail('PUBLISH_ARTIFACTS','Verified artifacts required');
  const task=this.state.find(taskId),allowed=new Set([taskId]);
  const visit=id=>{const d=this.state.find(id);if(d.projectId!==projectId||d.state!=='completed')throw fail('PUBLISH_ARTIFACTS','Publish dependency has not passed review');if(allowed.has(id))return;allowed.add(id);for(const dep of d.dependencyIds)visit(dep);};
  for(const dep of task.dependencyIds)visit(dep);
  for(const id of artifactIds){const a=this.artifacts.get(id);if(a.projectId!==projectId||!allowed.has(a.taskId))throw fail('PUBLISH_ARTIFACTS','Artifact is outside the reviewed dependency DAG');this.artifacts.read(id);}
  if(capability==='vercel_production'&&(!commitSha||!/^[a-f0-9]{40}$/.test(commitSha)))throw fail('PUBLISH_SHA','Production requires an exact reviewed commit SHA');
  const p={id:uid(),projectId,taskId,capability,target,artifactIds:[...artifactIds],privateRepo,commitSha,status:'draft',createdAt:now(),approvedAt:null,dispatchedAt:null,result:null};
  this.state.data.publications.push(p);this.state.persist();this.state.emit('publication.draft',{id:p.id,capability,projectId,target});return structuredClone(p);
 }
 _find(id){const p=this.state.data.publications.find(p=>p.id===id);if(!p)throw fail('PUBLISH_MISSING','Publication not found');return p;}
 get(id){return structuredClone(this._find(id));}
 approve(id,{approved=false,confirmTarget}={}){
  const p=this._find(id);if(p.status!=='draft')throw fail('PUBLISH_ALREADY_USED','Publication is already approved/dispatched');
  if(approved!==true||confirmTarget!==p.target)throw fail('PUBLISH_APPROVAL','Confirm the exact target before any external action');
  p.status='approved';p.approvedAt=now();this.state.persist();this.state.emit('publication.approved',{id,projectId:p.projectId,target:p.target});return structuredClone(p);
 }
 async dispatch(id,executor){
  const p=this._find(id);if(p.status!=='approved')throw fail('PUBLISH_ALREADY_USED','A publication may dispatch only once');
  if(typeof executor!=='function')throw fail('PUBLISH_ADAPTER','Approved publishing adapter is not installed');
  for(const artifactId of p.artifactIds)this.artifacts.read(artifactId);
  p.status='dispatched';p.dispatchedAt=now();this.state.persist();this.state.emit('publication.dispatched',{id,capability:p.capability,projectId:p.projectId});
  try{const result=await executor(structuredClone(p));
   if(!result||result.ok!==true||typeof result.url!=='string')throw fail('PUBLISH_RESULT','Publisher must return a verified destination URL');
   const url=new URL(result.url);if(url.protocol!=='https:'||url.username||url.password)throw fail('PUBLISH_RESULT','Publisher returned unsafe destination');
   p.status='completed';p.result={ok:true,url:url.href,verifiedAt:now(),commitSha:result.commitSha||null};this.state.persist();this.state.emit('publication.completed',{id,projectId:p.projectId,url:url.origin});return structuredClone(p.result);
  }catch(error){p.status='uncertain';p.error=cleanError(error);this.state.persist();this.state.emit('publication.uncertain',{id,projectId:p.projectId,error:p.error});throw error;}
 }
}
module.exports={PublicationGate};
