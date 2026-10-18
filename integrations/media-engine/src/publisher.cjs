'use strict';
const {sha,insist,jsonRead,jsonWrite,fs,path}=require('./utils.cjs');
class Publisher{
 constructor(dir){this.file=path.join(dir,'publish-drafts.json');this.state=jsonRead(this.file,{drafts:[],publishKeys:[]});}
 createDraft({channel,title,description='',hashtags=[],video,thumbnail=null,timeZone='Asia/Ho_Chi_Minh',scheduledAt=null,rights='unspecified'}){
  insist(video&&fs.existsSync(video),'Video must exist before draft');insist(typeof channel==='string'&&channel,'Channel required');
  const id=sha([channel,title,video,scheduledAt].join('|')).slice(0,20);let draft=this.state.drafts.find(x=>x.id===id);
  if(!draft){draft={id,channel,title,description,hashtags,video,thumbnail,timeZone,scheduledAt,rights,status:'DRAFT',approval:false,createdAt:new Date().toISOString()};this.state.drafts.push(draft);jsonWrite(this.file,this.state);}return draft;
 }
 approve(id){const draft=this.state.drafts.find(x=>x.id===id);insist(draft,'Draft not found');draft.approval=true;draft.status='APPROVED';jsonWrite(this.file,this.state);return draft;}
 async publish(id,{enabled=false,oauth=null,apiAdapter=null,verifiedApi=false}={}){
  const draft=this.state.drafts.find(x=>x.id===id);insist(draft,'Draft not found');
  if(!enabled||!draft.approval||!oauth||!apiAdapter||!verifiedApi){draft.status='BLOCKED';draft.reason='OAuth approval, explicit opt-in and verified official API integration are required';jsonWrite(this.file,this.state);return draft;}
  if(draft.scheduledAt&&Date.now()<Date.parse(draft.scheduledAt)){draft.status='SCHEDULED';jsonWrite(this.file,this.state);return draft;}
  const key=sha(`${draft.channel}:${draft.id}:${draft.scheduledAt||'manual'}`);
  if(this.state.publishKeys.includes(key)){draft.status='ALREADY_SUBMITTED';jsonWrite(this.file,this.state);return draft;}
  insist(typeof apiAdapter.uploadOfficial==='function','Official API adapter required');
  // Reserve key BEFORE network call to guarantee at-most-once retry; reconciliation is required for unknown outcomes.
  this.state.publishKeys.push(key);draft.status='SUBMITTING';jsonWrite(this.file,this.state);
  try{const result=await apiAdapter.uploadOfficial({draft,oauth,idempotencyKey:key});draft.status='PUBLISHED';draft.result=result;}
  catch(e){draft.status='UNKNOWN_RECONCILIATION_REQUIRED';draft.reason=String(e.message).slice(0,300);}
  jsonWrite(this.file,this.state);return draft;
 }
 due(now=new Date()){return this.state.drafts.filter(x=>x.status==='SCHEDULED'&&Date.parse(x.scheduledAt)<=+now).map(x=>({...x,overdue:true}));}
}
module.exports={Publisher};
