import {roleBindings} from './model-bindings.mjs';
/** Bounded, audited failover of TEXT inference only. Never replays host tools.
 * Candidate credentials remain in Vault. Journal contains metadata, not prompts.
 * Project calls opt in by default in R4; standalone probes keep legacy routing.
 */
import crypto from 'node:crypto';
import { readJson, writeJson } from './store.mjs';
import { getConnection, listConnections, vaultStatus, createVaultSecretRedactor } from './vault.mjs';
import { AI_KINDS, catalogModelsFor, connectionHasCredential, verifiedBinding } from './model-bindings.mjs';
import { isQuotaError, cooldownUntilMs, noteQuotaHit } from './account-pool.mjs';

const FILE = 'ai-dispatch.json';
const active = new Map();
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g,'d').toLowerCase();
const keyOf = c => `${c.id}:${c.credentialVersion || ''}:${c.model}`;
const accountKey = c => `${c.id}:${c.credentialVersion || ''}:*`;
const bindingKey = b => `${b.connectionId || b.id}:${b.model}`;
const clean = (s, n=140) => String(s || '').replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n);
const bounded = (x,d,min,max) => Number.isFinite(Number(x)) ? Math.max(min,Math.min(max,Math.floor(Number(x)))) : d;
const load = () => {
  const s=readJson(FILE,{version:1,circuits:{},events:[]});
  if(!s || s.version!==1 || !s.circuits || !Array.isArray(s.events)) throw new Error('Invalid AI dispatcher state; restore the data backup.');
  return s;
};
export function classifyProviderFailure(error) {
  const code=String(error?.code||''), m=normalized(error?.message), status=Number(error?.status);
  // Never override a user's cancellation, policy decision or changed identity.
  if(['AI_CANCELLED','PROVIDER_REFUSAL','STALE_TASK','AUTH_CHANGED','VAULT_LOCKED'].includes(code) ||
     /vault.*(khoa|lock)|credential.*(changed|thay doi)|tai khoan da thay doi|session da thay doi|prohibited tool|permission denied|eacces|sandbox.*(denied|violation)|content.policy|safety|refusal/.test(m))
    return {reason:'blocked',retryable:false,cooldownMs:0};
  if(error?.name==='AbortError' && code!=='PROVIDER_TIMEOUT')return {reason:'cancelled',retryable:false,cooldownMs:0};
  if(['PROVIDER_EMPTY','PROVIDER_INVALID_OUTPUT','PROVIDER_TEXT_ONLY','PROVIDER_UNAVAILABLE'].includes(code))return {reason:code==='PROVIDER_TEXT_ONLY'?'text-only':code==='PROVIDER_UNAVAILABLE'?'unavailable':'invalid-output',retryable:true,cooldownMs:30000};
  if(isQuotaError(error))return {reason:'quota',retryable:true,cooldownMs:120000};
  if(code==='PROVIDER_TIMEOUT'||error?.name==='TimeoutError'||/timeout|timed out|het thoi gian|qua han/.test(m))return {reason:'timeout',retryable:true,cooldownMs:30000};
  if([401,403].includes(status))return {reason:'authentication',retryable:true,cooldownMs:300000};
  if([404,410].includes(status))return {reason:'model-unavailable',retryable:true,cooldownMs:120000};
  if([408,409,425].includes(status)||status>=500&&status<=599)return {reason:'provider-outage',retryable:true,cooldownMs:30000};
  if(['ECONNRESET','ECONNREFUSED','EHOSTUNREACH','ENETUNREACH','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT'].includes(code)||/fetch failed|network error|socket hang up/.test(m))return {reason:'network',retryable:true,cooldownMs:15000};
  if(/cli.*(chua dang nhap|khong kha dung|khong tra|khong phan hoi)|chua tim thay.*(cli|codex)|tai khoan.*chua dang nhap|model.*(khong kha dung|khong ton tai)|khong tra noi dung van ban/.test(m))return {reason:'unavailable',retryable:true,cooldownMs:30000};
  // Unknown failures are not silently disguised as quota or a successful job.
  return {reason:'error',retryable:false,cooldownMs:0};
}
const labels={quota:'h\u1ebft h\u1ea1n m\u1ee9c',timeout:'h\u1ebft th\u1eddi gian ch\u1edd',authentication:'l\u1ed7i x\u00e1c th\u1ef1c',
  'model-unavailable':'model kh\u00f4ng kh\u1ea3 d\u1ee5ng','provider-outage':'nh\u00e0 cung c\u1ea5p b\u1ecb l\u1ed7i',
  'text-only':'k\u00eanh ch\u1ec9-v\u0103n-b\u1ea3n kh\u00f4ng h\u1ed7 tr\u1ee3 y\u00eau c\u1ea7u c\u00f4ng c\u1ee5',
  'invalid-output':'\u0111\u1ea7u ra r\u1ed7ng/sai c\u1ea5u tr\u00fac',unavailable:'k\u1ebft n\u1ed1i ch\u01b0a s\u1eb5n s\u00e0ng',network:'l\u1ed7i m\u1ea1ng',
  blocked:'b\u1ecb ch\u1eb7n an to\u00e0n',cancelled:'\u0111\u00e3 h\u1ee7y',error:'l\u1ed7i c\u1ea7n ki\u1ec3m tra'};
export function routingPolicy(context={}, overrides={}) {
  const project=context.projectId ? readJson('projects.json',[]).find(p=>p.id===context.projectId) : null;
  const settings=project?.settings||{};
  return {
    enabled:overrides.enabled===false?false:overrides.enabled===true||!!project&&settings.autoFailover!==false,
    scope:overrides.scope||settings.failoverScope||'connected',
    maxAttempts:bounded(overrides.maxAttempts??settings.maxProviderAttempts,4,1,8),
    attemptTimeoutMs:bounded(overrides.attemptTimeoutMs??settings.providerTimeoutMs,45000,20,120000),
    budgetMs:bounded(overrides.budgetMs,180000,50,600000),
    project, context,
  };
}
function textModel(model) { return typeof model==='string' && model.length>0 && model.length<=120 && !/embedding|(?:^|[-_])tts(?:[-_]|$)|whisper|dall-e|imagen|veo-|video-generation|image-generation/i.test(model); }

/** Only the owner's connected credentials and their OWN selected/catalog model.
 * No guessed cross-vendor model names; explicit backups precede broad fallback.
 */
export function dispatchCandidates(primary, policy, options={}) {
  const list=[],seen=new Set(),excluded=new Set(options.excludeBindings||[]),excludedAccounts=new Set(options.excludeConnectionIds||[]);
  const role=policy.context.role, p=policy.project;
  function add(binding,{primaryCandidate=false}={}) {
    try {
      if(!binding?.connectionId || !textModel(binding.model))return;
      const c=getConnection(binding.connectionId);
      if(!AI_KINDS.includes(c.kind)||!connectionHasCredential(c)||c.meta?.routingDisabled===true)return;
      const bk=bindingKey(binding); if(seen.has(bk)||excluded.has(bk)||excludedAccounts.has(c.id))return;
      // A credential replacement is not the same account, even at the same id.
      if(binding.credentialVersion && binding.credentialVersion!==c.credentialVersion)return;
      if(!primaryCandidate)verifiedBinding(binding);
      seen.add(bk);list.push({...c,model:binding.model,usageContext:primary.usageContext});
    } catch { /* unavailable candidate is not guessed or auto-logged-in */ }
  }
  if(options.session?.preferred)add(options.session.preferred);
  else if(options.preferred)add(options.preferred);
  if(primary?.id)add({connectionId:primary.id,model:primary.model,credentialVersion:primary.credentialVersion},{primaryCandidate:true});
  const backup=role==='council'?p?.modelRoleBackups?.council?.[policy.context.member||0]:p?.modelRoleBackups?.[role];
  if(backup)add(backup);
  for(const b of roleBindings(p,role))add(b);
  const connections=listConnections().filter(c=>AI_KINDS.includes(c.kind));
  for(const c of connections)if(policy.scope==='connected'&&c.id!==primary?.id&&c.kind===primary?.kind)add({connectionId:c.id,model:primary.model});
  for(const r of ['worker','founder','reviewer','council']) {
    for(const b of [...roleBindings(p,r),...[p?.modelRoleBackups?.[r]].flat().filter(Boolean)])add(b);
  }
  if(policy.scope==='connected')for(const c of connections)if(c.model)add({connectionId:c.id,model:c.model});
  return list;
}
function circuitUntil(c, at=Date.now()) {
  const circuits=load().circuits,until=Math.max(cooldownUntilMs(c.id,at)||0,Number(circuits[keyOf(c)]?.until)||0,Number(circuits[accountKey(c)]?.until)||0);
  return until>at?until:null;
}
function failure(c,error,kind) {
  const now=Date.now();let until=now+kind.cooldownMs;
  if(kind.reason==='quota')until=noteQuotaHit(c,error,now);
  if(kind.cooldownMs) {
    const s=load();for(const [k,v] of Object.entries(s.circuits))if(v.until<now-86400000)delete s.circuits[k];
    s.circuits[kind.reason==='authentication'?accountKey(c):keyOf(c)]={until,reason:kind.reason};writeJson(FILE,s);
  }
  return until;
}
function journal(event) {
  const redact=createVaultSecretRedactor(),s=load();
  const safe=JSON.parse(redact(JSON.stringify(event)));
  s.events=[...s.events,safe].slice(-240);writeJson(FILE,s);return safe;
}
export function dispatchEvents(limit=80){return load().events.slice(-Math.max(1,Math.min(240,limit)));}
export function dispatchStatus(projectId=null) {
  const filter=x=>!projectId||x.projectId===projectId;
  return {active:[...active.values()].filter(filter).map(x=>({...x})),events:dispatchEvents(100).filter(filter)};
}
export function dispatchFeedEvents(limit=80) {
  return dispatchEvents(limit).map(e=>({id:`dispatch:${e.id}`,at:e.at,projectId:e.projectId,taskId:e.taskId,actor:'\u0110i\u1ec1u ph\u1ed1i AI',
    kind:`dispatch.${e.type}`,state:e.type==='completed'?'done':e.type==='exhausted'||e.type==='blocked'?'failed':e.type==='attempt'&&active.get(e.requestId)?.connectionId===e.connectionId&&active.get(e.requestId)?.attempt===e.attempt?'running':'info',
    text:e.type==='attempt'?`${e.name} \u00b7 ${e.model} nh\u1eadn ${e.role||'y\u00eau c\u1ea7u'}${e.taskId?' '+e.taskId:''} (l\u1ea7n ${e.attempt}).`:
      e.type==='failed'?`${e.name}: ${labels[e.reason]||e.reason}. Ch\u01b0a ho\u00e0n t\u1ea5t y\u00eau c\u1ea7u.`:
      e.type==='handoff'?`Chuy\u1ec3n ${e.fromName||'AI tr\u01b0\u1edbc'} \u2192 ${e.name} \u00b7 ${e.model}; gi\u1eef nguy\u00ean c\u00f4ng vi\u1ec7c v\u00e0 ng\u1eef c\u1ea3nh.`:
      e.type==='completed'?`${e.name} \u00b7 ${e.model} \u0111\u00e3 tr\u1ea3 k\u1ebft qu\u1ea3 cho b\u01b0\u1edbc ${e.role||'AI'}${e.taskId?' '+e.taskId:''}.`:
      e.type==='skipped'?`${e.name} \u0111ang t\u1ea1m ngh\u1ec9 sau l\u1ed7i; ch\u1ecdn AI kh\u00e1c.`:
      e.type==='exhausted'?'Ch\u01b0a c\u00f3 AI kh\u1ea3 d\u1ee5ng trong gi\u1edbi h\u1ea1n th\u1eed. Xem l\u1ed7i k\u1ebft n\u1ed1i r\u1ed3i b\u1ea5m th\u1eed l\u1ea1i; kh\u00f4ng gi\u1ea3 b\u00e1o ho\u00e0n th\u00e0nh.':'D\u1eebng y\u00eau c\u1ea7u theo r\u00e0ng bu\u1ed9c an to\u00e0n.'}));
}

export async function dispatchText(primary, {system='',prompt='',policy,routing={},served=null,onAttempt=()=>{},validate=null,assertCurrent=()=>{},signal=null}, invoke) {
  const id=crypto.randomUUID(),started=Date.now(),deadline=started+policy.budgetMs;
  const context=policy.context, candidates=dispatchCandidates(primary,policy,routing);
  const attempts=[],skipped=[];let previous=null,attempt=0,earliest=null,lastFailure=null;
  const emit=(type,c,extra={})=>{
    const event=journal({id:crypto.randomUUID(),requestId:id,at:new Date().toISOString(),type,
      projectId:clean(context.projectId),taskId:clean(context.taskId),role:clean(context.role,40),runId:clean(context.runId),
      connectionId:clean(c?.id),name:clean(c?.name),model:clean(c?.model,120),attempt,...extra});
    onAttempt(event);return event;
  };
  const guard=()=>{
    if(signal?.aborted)throw Object.assign(new Error('AI request cancelled.'),{code:'AI_CANCELLED'});
    if(!vaultStatus().unlocked)throw Object.assign(new Error('Vault is locked.'),{code:'VAULT_LOCKED'});
    assertCurrent();
  };
  try {
    guard();
    for(const candidate of candidates) {
      guard();if(attempt>=policy.maxAttempts||Date.now()>=deadline)break;
      const until=circuitUntil(candidate);
      if(until){skipped.push({name:clean(candidate.name),model:candidate.model,until});earliest=earliest?Math.min(earliest,until):until;emit('skipped',candidate,{retryAt:new Date(until).toISOString()});continue;}
      // Refresh immediately before use; never send with a credential changed in flight.
      const fresh=getConnection(candidate.id);
      if(fresh.credentialVersion!==candidate.credentialVersion)throw Object.assign(new Error('Credential ho\u1eb7c provider \u0111\u00e3 thay \u0111\u1ed5i trong khi chuy\u1ec3n AI.'),{code:'AUTH_CHANGED'});
      attempt++;
      if(previous || candidate.id!==primary?.id || candidate.model!==primary?.model)emit('handoff',candidate,{fromId:clean(previous?.id||primary?.id),fromName:clean(previous?.name||primary?.name)});
      emit('attempt',candidate);active.set(id,{id,projectId:context.projectId,taskId:context.taskId||'',role:context.role||'',connectionId:candidate.id,name:clean(candidate.name),model:candidate.model,attempt,startedAt:new Date(started).toISOString()});
      try {
        const output=await invoke(candidate,{system,prompt,timeoutMs:Math.max(1,Math.min(policy.attemptTimeoutMs,deadline-Date.now())),retries:0,signal});
        guard();
        if(typeof output!=='string'||!output.trim())throw Object.assign(new Error('Provider returned no text.'),{code:'PROVIDER_EMPTY'});
        if(validate) {
          let accepted=false,issue='schema';
          try{accepted=validate(output)!==false;}catch(e){
            // Only a bounded known field name, never echo provider JSON in logs.
            const field=String(e?.message||'').match(/\b(problem|summary|audience|goals|features|userFlows|constraints|openQuestions|successCriteria|stack|dependency|taskId|schema)\b/i);
            issue=e?.name==='SyntaxError'?'JSON syntax':field?.[1]||'schema';
          }
          if(!accepted)throw Object.assign(new Error('Provider returned invalid structured output: '+issue),{code:'PROVIDER_INVALID_OUTPUT',validationIssue:issue});
        }
        if(getConnection(candidate.id).credentialVersion!==candidate.credentialVersion)throw Object.assign(new Error('Credential ho\u1eb7c provider \u0111\u00e3 thay \u0111\u1ed5i; kh\u00f4ng nh\u1eadn k\u1ebft qu\u1ea3 c\u1ee7a phi\u00ean c\u0169.'),{code:'AUTH_CHANGED'});
        const descriptor={connectionId:candidate.id,connectionName:clean(candidate.name),provider:candidate.kind,model:candidate.model,requestId:id,attempts:attempt};
        if(served)Object.assign(served,descriptor);
        if(routing.session)routing.session.preferred={connectionId:candidate.id,model:candidate.model,credentialVersion:candidate.credentialVersion};
        emit('completed',candidate);return output;
      } catch(error) {
        const kind=classifyProviderFailure(error);lastFailure=error;
        emit(kind.retryable?'failed':'blocked',candidate,{reason:kind.reason});
        if(!kind.retryable)throw error;
        const until=failure(candidate,error,kind);earliest=earliest?Math.min(earliest,until):until;
        attempts.push({connectionId:candidate.id,name:clean(candidate.name),model:candidate.model,reason:kind.reason,status:Number.isInteger(error.status)?error.status:null,validationIssue:error.validationIssue||null});previous=candidate;
      }
    }
    emit('exhausted',previous||primary,{attempts:attempt,retryAt:earliest?new Date(earliest).toISOString():null});
    const detail=attempts.map(a=>`${a.name} (${a.model}): ${labels[a.reason]||a.reason}${a.status?' (HTTP '+a.status+')':''}${a.validationIssue?' ['+a.validationIssue+']':''}`).join('; ');
    const cooling=skipped.length?' '+skipped.map(x=>`${x.name} (${x.model})`).join('; ')+(attempt===0?' \u0111\u1ec1u \u0111ang ngh\u1ec9 h\u1ea1n m\u1ee9c ho\u1eb7c ngh\u1ec9 sau l\u1ed7i.':' \u0111ang t\u1ea1m ngh\u1ec9.') : '';
    const next=earliest?' S\u1edbm nh\u1ea5t m\u1edf l\u1ea1i l\u00fac '+new Date(earliest).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})+'.':'';
    const error=new Error(`Ch\u01b0a AI n\u00e0o ho\u00e0n t\u1ea5t y\u00eau c\u1ea7u sau ${attempt} l\u1ea7n th\u1eed. ${detail||'C\u00e1c k\u1ebft n\u1ed1i \u0111ang ngh\u1ec9 ho\u1eb7c ch\u01b0a c\u00f3 model h\u1ee3p l\u1ec7.'} ${cooling}${next} Ki\u1ec3m tra K\u1ebft n\u1ed1i v\u00e0 th\u1eed l\u1ea1i; y\u00eau c\u1ea7u ch\u01b0a b\u1ecb x\u00f3a.`);
    Object.assign(error,{code:'AI_DISPATCH_EXHAUSTED',retryable:true,status:Number.isInteger(lastFailure?.status)?lastFailure.status:undefined,attempts:attempt,retryAt:earliest?new Date(earliest).toISOString():null,requestId:id});throw error;
  } finally { active.delete(id); }
}
