'use strict';
// Additive, opt-in CoreServices commercial gateway. No provider key or prompt is persisted.
// Existing v0.7.7 callers continue on the legacy gateway until the integration owner
// routes billed actions through approveCharge/generateApproved.
const {crypto,uid,fail,cleanError,safeName}=require('./common.cjs');
const ROLES=new Set(['Founder','Council','PM','Worker','Reviewer']);
const MODELS_RE=/^[a-zA-Z0-9_.:/-]{1,160}$/;
const stamp=()=>new Date().toISOString();
const goodTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
function data(g){g.state.data.commercial ||= {version:1,verified:{},approvals:[],quota:[],cooldowns:{}};return g.state.data.commercial;}
function pby(g,id){const p=g.state.data.providers.find(p=>p.id===id);if(!p)throw fail('PROVIDER_MISSING','Provider not registered');return p;}
function textFrom(p,r){let content,usage;
 if(p.type==='gemini'){content=(r.candidates?.[0]?.content?.parts||[]).filter(x=>typeof x.text==='string').map(x=>x.text).join('');usage={input:r.usageMetadata?.promptTokenCount,output:r.usageMetadata?.candidatesTokenCount};}
 else if(p.type==='anthropic'){content=(r.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('');usage={input:r.usage?.input_tokens,output:r.usage?.output_tokens};}
 else {content=r.choices?.[0]?.message?.content;usage={input:r.usage?.prompt_tokens,output:r.usage?.completion_tokens};}
 if(typeof content!=='string'||!content.trim())throw fail('PROVIDER_FORMAT','Model returned no usable text');
 return {text:content,usage};
}
async function bounded(g,p,model,prompt,maxOutputTokens,internalToken){
 let r;
 if(p.type==='gemini')r=await g.request(p,`/v1beta/models/${encodeURIComponent(model)}:generateContent`,'POST',{contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens}},internalToken);
 else if(p.type==='anthropic')r=await g.request(p,'/v1/messages','POST',{model,max_tokens:maxOutputTokens,messages:[{role:'user',content:prompt}]},internalToken);
 else r=await g.request(p,'/v1/chat/completions','POST',{model,max_tokens:maxOutputTokens,messages:[{role:'user',content:prompt}]},internalToken);
 if(typeof r.model==='string'&&r.model!==model)throw fail('MODEL_MISMATCH','Provider returned a different model than requested');
 return textFrom(p,r);
}
function fingerprint(g,p){
 // The credential never leaves the Vault. A per-provider random salt prevents
 // straightforward cross-install correlations of local verification receipts.
 const d=data(g);d.credentialSalts||={};d.credentialSalts[p.id]||=crypto.randomBytes(32).toString('hex');
 const key=g.vault.get(p.id);
 return crypto.createHmac('sha256',Buffer.from(d.credentialSalts[p.id],'hex')).update(p.id+'\0'+key).digest('hex');
}
function verified(g,providerId,model,{capability='text'}={}){
 const p=pby(g,providerId),v=data(g).verified[providerId+'\0'+model];
 if(!v||!Array.isArray(v.capabilities)||!v.capabilities.includes(capability)||!goodTime(v.verifiedAt)||Date.now()-Date.parse(v.verifiedAt)>24*60*60*1000)throw fail('MODEL_UNVERIFIED','Model needs an authorized, recent capability probe');
 if(v.credentialFingerprint!==fingerprint(g,p))throw fail('MODEL_UNVERIFIED','Credential changed since model verification');
 return {connectionId:providerId,providerId,modelId:model,verifiedAt:v.verifiedAt,verifiedCapabilities:[...v.capabilities]};
}
function estimate(g,p,prompt,maxOutputTokens){return g.price(p,Buffer.byteLength(prompt)+256,maxOutputTokens);}
function budgetPreflight(g,max){if(!Number.isFinite(max)||max<0||max>100)throw fail('COST_LIMIT','Charge upper bound must be finite and nonnegative');if(g.budgetUsd<=0||g.spendUsd+g.uncertainUsd+g.reservedUsd+max>g.budgetUsd)throw fail('BUDGET_BLOCKED','A sufficient explicit budget is required');}
function approveCharge({role,projectId,idempotencyKey,maxUsd,approved=false,taskId=null}={}){
 if(!ROLES.has(role)||!safeName(projectId)||typeof idempotencyKey!=='string'||!/^[a-zA-Z0-9_.:-]{4,120}$/.test(idempotencyKey))throw fail('COST_APPROVAL_INPUT','Invalid charge scope');
 if(approved!==true)throw fail('COST_APPROVAL_REQUIRED','Human approval is required for each paid operation');
 const {ref,p}=this.resolve(role), v=verified(this,p.id,ref.model);
 budgetPreflight(this,maxUsd);
 const d=data(this);if(d.approvals.some(a=>a.projectId===projectId&&a.idempotencyKey===idempotencyKey))throw fail('IDEMPOTENCY_CONFLICT','Job idempotency key is already reserved');
 const a={id:uid(),projectId,taskId,role,providerId:p.id,model:ref.model,verifiedAt:v.verifiedAt,idempotencyKey,maxUsd,status:'approved',at:stamp()};
 d.approvals.push(a);this.state.persist();this.state.emit('provider.charge-approved',{approvalId:a.id,projectId,taskId,providerId:p.id,model:ref.model,maxUsd});return {...a};
}
async function verifyModel({providerId,model,approved=false,costCeilingUsd,maxOutputTokens=16}={},internalToken){
 if(!safeName(providerId)||typeof model!=='string'||!MODELS_RE.test(model))throw fail('MODEL_INVALID','Invalid provider/model identifier');
 if(approved!==true)throw fail('COST_APPROVAL_REQUIRED','Model verification may use billable tokens; operator approval required');
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<16||maxOutputTokens>32)throw fail('OUTPUT_LIMIT','Probe response must be small');
 const p=pby(this,providerId),prompt='Respond with READY. No tools or side effects.';const cost=estimate(this,p,prompt,maxOutputTokens);
 if(!Number.isFinite(costCeilingUsd)||costCeilingUsd<cost||costCeilingUsd>10)throw fail('COST_LIMIT','Model verification requires an explicit sufficient cost ceiling');
 budgetPreflight(this,costCeilingUsd);this.reservedUsd+=cost;
 try{const r=await bounded(this,p,model,prompt,maxOutputTokens,internalToken);
  const d=data(this),fp=fingerprint(this,p);
  d.verified[providerId+'\0'+model]={providerId,model,capabilities:['text'],verifiedAt:stamp(),credentialFingerprint:fp};
  const measured=Number.isFinite(r.usage.input)&&Number.isFinite(r.usage.output)?this.price(p,r.usage.input,r.usage.output):null;if(measured===null)this.uncertainUsd+=cost;else this.spendUsd+=measured;
  this.state.persist();this.state.emit('provider.model-verified',{providerId,model,capabilities:['text'],source:this.fetch===global.fetch?'live-provider':'injected-test-transport'});
  return {ref:verified(this,providerId,model),usage:r.usage,source:this.fetch===global.fetch?'live-provider':'injected-test-transport'};
 }catch(e){this.uncertainUsd+=cost;this.state.emit('provider.verify-uncertain',{providerId,model,error:cleanError(e)});throw e;}finally{this.reservedUsd-=cost;}
}
async function generateApproved(role,{prompt,maxOutputTokens=512,approvalId,projectId}={},internalToken){
 if(typeof approvalId!=='string')throw fail('COST_APPROVAL_REQUIRED','Approval ID is required');
 const d=data(this),a=d.approvals.find(x=>x.id===approvalId),{ref,p}=this.resolve(role);
 if(!a)throw fail('COST_APPROVAL_REQUIRED','Approval was not found');
 if(a.status!=='approved')throw fail('COST_ALREADY_DISPATCHED','This approval already dispatched or has an uncertain result');
 if(a.role!==role||a.projectId!==projectId||a.providerId!==p.id||a.model!==ref.model)throw fail('APPROVAL_SCOPE','Approval does not match project, provider and model');
 verified(this,p.id,ref.model);const required=estimate(this,p,prompt,maxOutputTokens);
 if(required>a.maxUsd)throw fail('COST_LIMIT','Request could exceed this job approval; request fresh approval');
 budgetPreflight(this,required);
 // Persist BEFORE dispatch; errors/timeouts never cause auto retry. Crucial after crash.
 a.status='dispatched';a.dispatchedAt=stamp();a.estimatedCostUsd=required;this.state.persist();this.state.emit('provider.charge-dispatched',{approvalId,projectId,providerId:p.id,model:ref.model});
 try{const r=await this.generate(role,{prompt,maxOutputTokens},internalToken);if(r.providerId!==a.providerId||r.model!==a.model)throw fail('MODEL_CHANGED','Provider/model changed while dispatching');a.status='completed';a.resultHash=crypto.createHash('sha256').update(r.text).digest('hex');a.finishedAt=stamp();this.state.persist();this.state.emit('provider.charge-reconciled',{approvalId,projectId,resultHash:a.resultHash,usage:r.usage});return {...r,approvalId};}
 catch(e){a.status='uncertain';a.error=cleanError(e);a.finishedAt=stamp();this.state.persist();this.state.emit('provider.charge-uncertain',{approvalId,projectId,error:a.error});throw e;}
}
function quote(role,{prompt,maxOutputTokens=512}={}){
 const {ref,p}=this.resolve(role);const v=verified(this,p.id,ref.model);
 if(typeof prompt!=='string'||!prompt.trim()||Buffer.byteLength(prompt)>80000||!Number.isInteger(maxOutputTokens)||maxOutputTokens<16||maxOutputTokens>2048)throw fail('BAD_PROMPT','Invalid billable request');
 return {connectionId:p.id,providerId:p.id,modelId:ref.model,role,capabilities:v.verifiedCapabilities,estimatedUpperBoundUsd:estimate(this,p,prompt,maxOutputTokens),priceSource:'operator-configured',estimated:true,approvalRequired:true};
}
function quotaStatus(providerId,modelId=null){safeName(providerId);pby(this,providerId);const entries=data(this).quota.filter(q=>q.providerId===providerId&&(modelId===null||q.modelId===null||q.modelId===modelId));const latest=entries.at(-1);if(!latest||Date.now()-Date.parse(latest.observedAt)>30*60*1000)return {availability:'unknown',connectionId:providerId,source:null,observedAt:null};return {...latest,availability:'known'};}
function recordQuota({providerId,modelId=null,windowLabel,unit,remaining,limit,resetAt=null,source,sharedBucket='provider-account'}={}){
 safeName(providerId);pby(this,providerId);
 if(!['requests','tokens'].includes(unit)||typeof windowLabel!=='string'||!windowLabel.trim()||typeof source!=='string'||!source.startsWith('provider:')||![remaining,limit].every(Number.isSafeInteger)||remaining<0||limit<0||remaining>limit)throw fail('QUOTA_UNVERIFIED','Only observed, bounded provider quota is accepted');
 if(resetAt!==null&&!goodTime(resetAt))throw fail('QUOTA_UNVERIFIED','Invalid quota reset time');
 if(modelId!==null&&!(typeof modelId==='string'&&MODELS_RE.test(modelId)))throw fail('QUOTA_UNVERIFIED','Invalid model ID');
 const q={connectionId:providerId,providerId,modelId,sharedBucket,windowLabel,remaining,limit,consumed:limit-remaining,unit,source,observedAt:stamp(),resetAt,isEstimated:false};const d=data(this);d.quota.push(q);if(d.quota.length>200)d.quota.splice(0,d.quota.length-200);this.state.persist();return {...q};
}
function note429(providerId,headers){const h=headers?.get?.('retry-after');if(h===null||h===undefined)return;let seconds=Number(h);if(!Number.isFinite(seconds)){const delta=Date.parse(h)-Date.now();seconds=delta/1000;}
 if(!Number.isFinite(seconds)||seconds<=0)return;const ms=Math.min(seconds*1000,24*60*60*1000);data(this).cooldowns[providerId]=new Date(Date.now()+ms).toISOString();this.state.persist();this.state.emit('provider.cooldown',{providerId,retryAfter:data(this).cooldowns[providerId]});}
function checkCooldown(providerId){const v=data(this).cooldowns[providerId];if(v&&Date.now()<Date.parse(v))throw fail('PROVIDER_COOLDOWN','Provider rate-limit cooldown active until '+v);}
module.exports={attachPolicy(Proto,tokenFor){Object.assign(Proto.prototype,{verifyModel:function(args){return verifyModel.call(this,args,tokenFor(this));},approveCharge,generateApproved:function(role,args){return generateApproved.call(this,role,args,tokenFor(this));},quote,verifiedModel:function(p,m,options){return verified(this,p,m,options);},recordQuota,quotaStatus,note429,checkCooldown});},textFrom};
