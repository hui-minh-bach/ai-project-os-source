'use strict';
// Concrete local source/content outcomes. These do not claim remote publication or
// knowledge of web sources; external connectors and independent QA are separate gates.
const {fail,safeName,crypto,fs,path,contained}=require('./common.cjs');
const {allowWorkspacePath}=require('./tools.cjs');
const scrub=str=>String(str).replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;');
const validExternalUrl=v=>{let u;try{u=new URL(v);}catch{throw fail('SOURCE_URL','Invalid provenance URL');}if(u.protocol!=='https:'||!u.hostname||u.username||u.password||/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname))throw fail('SOURCE_URL','External sources must use safe HTTPS URLs');return u.href;};
class OutcomeKit{
 constructor({queue,state,artifacts,tools}){this.queue=queue;this.state=state;this.artifacts=artifacts;this.tools=tools;}
 websiteDraft({projectId,files,approved=false}={}){
  safeName(projectId);
  if(approved!==true||!Array.isArray(files)||files.length<1||files.length>12)throw fail('OUTCOME_APPROVAL','Explicit approval and 1-12 source files are required');
  const steps=[],checks=[];
  for(const f of files){
   if(typeof f.path!=='string'||!/^[-a-zA-Z0-9_./]{1,120}$/.test(f.path)||!/.\.(html|css|js|mjs|json|txt)$/.test(f.path)||typeof f.content!=='string'||Buffer.byteLength(f.content)>128000)throw fail('OUTCOME_FILE','Unsafe source file');
   allowWorkspacePath(f.path);steps.push({tool:'file_write',args:{path:f.path,text:f.content}});
   checks.push({type:'exists',path:f.path});if(/\.(?:js|mjs)$/.test(f.path))checks.push({type:'node_syntax',path:f.path});
  }
  const task=this.queue.add({projectId,kind:'software',input:{approved:true,allowedTools:['file_write','node_check'],steps,checks},maxAttempts:1});
  return {taskId:task.id,projectId,status:task.state,origin:'user-provided-files',remotePublished:false,independentPreviewVerified:false};
 }
 contentDraft({projectId,title,sections,approved=false}={}){
  safeName(projectId);
  if(approved!==true||typeof title!=='string'||title.length<4||title.length>160||!Array.isArray(sections)||sections.length<1||sections.length>30)throw fail('OUTCOME_APPROVAL','Approve title and content sections');
  const sources=[];let markdown='# '+scrub(title)+'\n\n';
  for(const [i,section] of sections.entries()){
   if(typeof section.heading!=='string'||section.heading.length<1||section.heading.length>160||typeof section.text!=='string'||section.text.length>10000||!Array.isArray(section.sources))throw fail('OUTCOME_FORMAT','Invalid content section');
   markdown+='## '+scrub(section.heading)+'\n\n'+scrub(section.text)+'\n\n';
   if(section.sources.length>10)throw fail('OUTCOME_FORMAT','Too many provenance links');
   for(const src of section.sources){const url=validExternalUrl(src);sources.push({sectionIndex:i,url,verification:'user-supplied-not-fetched'});markdown+='- Reference (not independently checked): '+url+'\n';}
  }
  if(Buffer.byteLength(markdown)>256000)throw fail('OUTCOME_SIZE','Content pack too large');
  const task=this.queue.add({projectId,kind:'software',input:{approved:true,allowedTools:['file_write'],steps:[{tool:'file_write',args:{path:'content-pack.md',text:markdown}}],checks:[{type:'exists',path:'content-pack.md'}]},maxAttempts:1});
  return {taskId:task.id,projectId,status:task.state,provenance:sources,verifiedSources:0,claimsValidated:false,localMarkdown:true};
 }
 finalize(taskId,{fileName='content-pack.md',kind='text',mimeType='text/markdown'}={}){
  const t=this.state.find(taskId);if(t.state!=='completed'||!['software'].includes(t.kind))throw fail('OUTCOME_UNVERIFIED','Task must pass independent local checks');
  const file=contained(path.join(this.tools.root,t.projectId,t.id),allowWorkspacePath(fileName));const buf=fs.readFileSync(file);
  const a=this.artifacts.put({projectId:t.projectId,taskId:t.id,name:fileName.replace(/\//g,'-'),content:buf,kind,mimeType,provenance:{origin:'local-worker',sourceVerified:false}});
  const checked=this.artifacts.verify(a.id);this.state.update(t.id,x=>{x.outputArtifactIds.push(checked.id);});
  return {artifactId:checked.id,sha256:checked.sha256,sizeBytes:checked.sizeBytes,localVerified:true,sourceVerified:false,externalPublished:false};
 }
}
module.exports={OutcomeKit,validExternalUrl};
