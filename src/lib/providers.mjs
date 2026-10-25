import { routingPolicy, dispatchText } from './ai-dispatch.mjs';
import { observeSpaceCall } from './space-activity.mjs';
import crypto from 'node:crypto';
import { recordUsage } from './usage.mjs';
import { askAccount, listAccountModels } from './account-auth.mjs';
import { askCliAccount } from './cli-account.mjs';
import { askAntigravityAccount, listAntigravityModels } from './antigravity-account.mjs';
import { getConnection, saveConnection, createVaultSecretRedactor } from './vault.mjs';
import { resolveModelConnection, recordModels, invalidateModels, modelAvailability, noteModelRuntimeFailure, clearModelRuntimeFailure } from './model-bindings.mjs';
import { poolCandidates, isQuotaError, noteQuotaHit, noteSwitch, notePoolExhausted, poolKindLabel, cooldownUntilMs } from './account-pool.mjs';
import { readJson } from './store.mjs';

const DEFAULT_TIMEOUT_MS = 90000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function readJsonLimited(r, maxBytes = 8_000_000) {
  const len=Number(r.headers.get('content-length')||0);if(len>maxBytes){try{await r.body?.cancel()}catch{}throw new Error(`Provider response quá lớn (${len} bytes).`);}
  if(!r.body){return {};}
  const reader=r.body.getReader();const chunks=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){try{await reader.cancel()}catch{}throw new Error(`Provider response vượt giới hạn ${maxBytes} bytes.`);}chunks.push(Buffer.from(value));}
  if(!chunks.length)return {};
  const text=Buffer.concat(chunks,total).toString('utf8');try{return JSON.parse(text)}catch{return {};}
}

function textFromOpenAI(j) {
  if (typeof j.output_text === 'string') return j.output_text;
  return (j.output || []).flatMap(x => x.content || []).map(x => x.text || x.output_text || '').filter(Boolean).join('\n');
}

async function requestJson(url, init={}, {timeoutMs=DEFAULT_TIMEOUT_MS,retries=2,signal=null}={}) {
  let last;
  for(let attempt=0;attempt<=retries;attempt++) {
    const controller=new AbortController();
    const timeout=Object.assign(new Error('AI request timeout'),{code:'PROVIDER_TIMEOUT'});
    const cancel=()=>controller.abort(Object.assign(new Error('AI request cancelled.'),{code:'AI_CANCELLED'}));
    if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
    const timer=setTimeout(()=>controller.abort(timeout),timeoutMs);
    try {
      const r=await fetch(url,{...init,redirect:'error',signal:controller.signal});
      const j=await readJsonLimited(r);
      if(r.ok)return {r,j};
      const e=new Error(`Provider HTTP ${r.status}. Ki\u1ec3m tra credential v\u00e0 endpoint.`);e.status=r.status;
      const after=r.headers.get('retry-after');
      if(after){const t=/^\d+(?:\.\d+)?$/.test(after)?Date.now()+Number(after)*1000:Date.parse(after);if(Number.isFinite(t))e.resetAt=t;}
      // Do not send the raw provider body (which may echo private input) to logs.
      if(['content_policy_violation','safety','content_filter'].includes(j.error?.code))e.code='PROVIDER_REFUSAL';
      throw e;
    } catch(error) {
      last=controller.signal.aborted?controller.signal.reason:error;
      const retryable=last?.code!=='AI_CANCELLED'&&last?.code!=='PROVIDER_REFUSAL'&&(last?.code==='PROVIDER_TIMEOUT'||[408,409,429].includes(last?.status)||last?.status>=500||last instanceof TypeError);
      if(!retryable||attempt===retries)throw last;
    } finally {clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
    await sleep(300*(2**attempt));
  }
  throw last||new Error('AI request failed');
}

function requireText(name, text) {
  const out = String(text || '').trim();
  if (!out) throw Object.assign(new Error(`${name}: model trả về nội dung rỗng.`), {code:'PROVIDER_EMPTY'});
  if (out.length > 240000) throw new Error(`${name}: model trả về quá nhiều nội dung (>240k ký tự).`);
  return out;
}

const fmtReset = ms => ms ? new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';

/** All-candidates-blocked error: names every account that was tried or
 * skipped, the model it was asked for, and when it rests until — so the
 * owner sees exactly what the router did instead of a bare failure. */
function allBlockedError(primary, entries) {
  const seen = new Map();
  for (const e of entries || []) if (e && e.id && !seen.has(e.id)) seen.set(e.id, e);
  const list = [...seen.values()];
  const earliest = list.reduce((m, e) => (e.until && (!m || e.until < m) ? e.until : m), null);
  const detail = list.length ? ` Đã thử: ${list.map(e => `“${e.name}” (model ${e.model}) — đang nghỉ hạn mức đến ${fmtReset(e.until)}`).join('; ')}.` : '';
  const when = earliest ? ` Sớm nhất mở lại lúc ${fmtReset(earliest)}.` : '';
  return new Error(`Tất cả tài khoản ${poolKindLabel(primary.kind)} trong bể đều đang nghỉ hạn mức.${detail}${when} Hãy chờ hạn mức đặt lại hoặc thêm tài khoản ${poolKindLabel(primary.kind)} khác ở tab Kết nối.`);
}

/** The role's stored backup binding (project.modelRoleBackups), if any.
 * Located from a role-ref target or from the usage context callers pass. */
function backupBindingFor(connectionId, primary) {
  try {
    let projectId = null, role = null, member = 0;
    if (typeof connectionId === 'string' && connectionId.startsWith('role:')) {
      const parts = connectionId.split(':'); projectId = parts[1]; role = parts[2]; member = Number(parts[3] || 0);
    } else if (primary?.usageContext?.projectId && primary?.usageContext?.role) {
      projectId = primary.usageContext.projectId; role = primary.usageContext.role; member = Number(primary.usageContext.member || 0);
    }
    if (!projectId || !role) return null;
    const project = readJson('projects.json', []).find(p => p.id === projectId);
    const backups = project?.modelRoleBackups;
    if (!backups || typeof backups !== 'object') return null;
    const b = role === 'council' ? (Array.isArray(backups.council) ? backups.council[member] : null) : backups[role];
    if (!b?.connectionId || !b?.model) return null;
    if (b.connectionId === primary.id && b.model === primary.model) return null;
    return { connectionId: b.connectionId, model: b.model };
  } catch { return null; }
}

/** Project work uses the R4 dispatcher; explicit connection probes retain their
 * old semantics and never silently probe a different account. */
export async function ask(connectionId, options={}) {
  const {system='',prompt='',usageContext=null,routing={},served=null,validate=null,onAttempt=()=>{},assertCurrent=()=>{},signal=null}=options;
  const redact=createVaultSecretRedactor();
  try {
    const primary=resolveModelConnection(connectionId);
    primary.usageContext={...primary.usageContext,...(usageContext||{})};
    const policy=routingPolicy(primary.usageContext,routing);
    if(!policy.enabled){
      if(!policy.project)return await askLegacy(connectionId,options);
      assertCurrent();
      const out=await observeSpaceCall(primary,()=>invokeScoped(primary,{system,prompt,timeoutMs:policy.attemptTimeoutMs,retries:0,signal}));
      assertCurrent();if(validate&&validate(out)===false)throw Object.assign(new Error('Invalid provider output.'),{code:'PROVIDER_INVALID_OUTPUT'});
      if(served)Object.assign(served,{connectionId:primary.id,connectionName:primary.name,provider:primary.kind,model:primary.model,attempts:1});return redact(out);
    }
    return redact(await dispatchText(primary,{system,prompt,policy,routing,served,validate,onAttempt,assertCurrent,signal},
      (candidate,request)=>observeSpaceCall(candidate,()=>invokeScoped(candidate,request))));
  } catch(error) {
    const safe=new Error(redact(error?.message||'AI request failed'));
    if(['Error','TypeError','AbortError','TimeoutError'].includes(error?.name))safe.name=error.name;
    if(Number.isInteger(error?.status)&&error.status>=100&&error.status<=599)safe.status=error.status;
    if(typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{2,70}$/.test(error.code))safe.code=error.code;
    if(error?.retryable===true)safe.retryable=true;
    if(Number.isInteger(error?.attempts))safe.attempts=error.attempts;
    if(typeof error?.retryAt==='string'&&Number.isFinite(Date.parse(error.retryAt)))safe.retryAt=error.retryAt;
    throw safe;
  }
}
async function invokeScoped(connection, request) {
  try { const out=await askConnection(connection, request);clearModelRuntimeFailure(connection);return out; }
  catch (error) {
    if ([401,403,404,410].includes(error?.status)) noteModelRuntimeFailure(connection,error.status);
    throw error;
  }
}
async function askLegacy(connectionId, { system = '', prompt = '', usageContext = null, served = null }) {
  const redact = createVaultSecretRedactor();
  let c;
  try {
    const primary = resolveModelConnection(connectionId);
    if (usageContext) primary.usageContext = { ...primary.usageContext, ...usageContext };
    c = primary;
    // Runtime routing (v0.9.55 — "điều hướng", the owner's order): an
    // ORDERED candidate list per call — (a) the role's bound
    // connection+model, (b) the same model on other accounts of the same
    // kind (pool order; accounts resting on quota cooldown are skipped),
    // (c) the role's stored backup binding. A quota failure cools that
    // account, journals the rotation and CONTINUES inside the same step;
    // a non-quota failure aborts immediately (real errors are never
    // masked). No further implicit fallback exists.
    const pool = poolCandidates(primary);
    const chain = [...pool.candidates];
    const blocked = [...(pool.cooling || [])];
    const backup = backupBindingFor(connectionId, primary);
    if (backup) {
      try {
        const bc = getConnection(backup.connectionId);
        const cand = { ...bc, model: backup.model, usageContext: primary.usageContext };
        if (!chain.some(x => x.id === cand.id && x.model === cand.model)) {
          const until = cooldownUntilMs(cand.id);
          if (until) blocked.push({ id: cand.id, name: String(cand.name || ''), model: cand.model, until });
          else chain.push(cand);
        }
      } catch { /* the backup connection was removed after it was saved — skip it */ }
    }
    if (!chain.length) { notePoolExhausted(primary.kind, pool.earliestResetMs); throw allBlockedError(primary, blocked); }
    const tried = [];
    let quotaErr = null;
    for (const cand of chain) {
      c = cand;
      try {
        const out = await observeSpaceCall(cand, () => askConnection(cand, { system, prompt }));
        if (cand.id !== primary.id) noteSwitch(primary, cand, cand.model);
        if (served && typeof served === 'object') { served.connectionId = cand.id; served.connectionName = cand.name; served.model = cand.model; }
        return redact(out);
      } catch (e) {
        if (isQuotaError(e)) { const until = noteQuotaHit(cand, e); tried.push({ id: cand.id, name: String(cand.name || ''), model: cand.model, until }); quotaErr = e; continue; }
        throw e;
      }
    }
    notePoolExhausted(primary.kind, pool.earliestResetMs);
    throw allBlockedError(primary, [...blocked, ...tried]);
  } catch (e) {
    if (c && [401,403,404].includes(e?.status)) invalidateModels(c.id);
    // Do not retain the original stack/cause/custom fields containing provider
    // output. HTTP status remains available for existing invalidation callers.
    const safe = new Error(redact(e?.message || 'AI request failed'));
    if (['Error', 'TypeError', 'AbortError', 'TimeoutError'].includes(e?.name)) safe.name = e.name;
    if (Number.isInteger(e?.status) && e.status >= 100 && e.status <= 599) safe.status = e.status;
    throw safe;
  }
}
async function askConnection(c, { system, prompt, timeoutMs=DEFAULT_TIMEOUT_MS, retries=2, signal=null }) {
  const requestOptions={timeoutMs,retries,signal};
  if(c.kind === 'chatgpt_account'){ const result=await askAccount(c,{system,prompt,timeoutMs});recordUsage(c,{usage:result.usage},result.eventId);return requireText(c.name,result.text); }
  if(['claude_account','gemini_account'].includes(c.kind))return requireText(c.name,await askCliAccount(c,{system,prompt,timeoutMs}));
  if(c.kind==='antigravity_account')return requireText(c.name,await askAntigravityAccount(c,{system,prompt,timeoutMs}));
  const requestId = crypto.randomUUID();
  if (!c.secret) throw new Error(`${c.name}: chưa có API credential.`);
  if (!c.model) throw new Error(`${c.name}: chưa chọn model.`);

  if (c.kind === 'openai') {
    const { j } = await requestJson(c.baseUrl || 'https://api.openai.com/v1/responses', {method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${c.secret}`},body:JSON.stringify({model:c.model,instructions:system,input:prompt})},requestOptions);
    recordUsage(c, j, requestId);
    if(j.error?.code==='content_policy_violation'||j.promptFeedback?.blockReason||j.candidates?.some(x=>['SAFETY','RECITATION','PROHIBITED_CONTENT'].includes(x.finishReason))||j.stop_reason==='refusal'||j.choices?.some(x=>x.finish_reason==='content_filter'||x.message?.refusal)||(j.output||[]).some(x=>(x.content||[]).some(y=>y.type==='refusal')))throw Object.assign(new Error('Provider safety refusal. No failover permitted.'),{code:'PROVIDER_REFUSAL'});
    return requireText(c.name, textFromOpenAI(j));
  }
  if (c.kind === 'gemini') {
    // A custom generateContent URL supplies the API root, never the role's model.
    // Keep arbitrary legacy fixture/proxy endpoints unchanged.
    const modelPath = `/models/${encodeURIComponent(c.model)}:generateContent`;
    const endpoint = c.baseUrl ? c.baseUrl.replace(/\/models\/[^/]+:generateContent\/?$/, modelPath) : `https://generativelanguage.googleapis.com/v1beta${modelPath}`;
    const { j } = await requestJson(endpoint,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':c.secret},body:JSON.stringify({system_instruction:system?{parts:[{text:system}]}:undefined,contents:[{role:'user',parts:[{text:prompt}]}]})},requestOptions);
    recordUsage(c, j, requestId);
    if(j.error?.code==='content_policy_violation'||j.promptFeedback?.blockReason||j.candidates?.some(x=>['SAFETY','RECITATION','PROHIBITED_CONTENT'].includes(x.finishReason))||j.stop_reason==='refusal'||j.choices?.some(x=>x.finish_reason==='content_filter'||x.message?.refusal)||(j.output||[]).some(x=>(x.content||[]).some(y=>y.type==='refusal')))throw Object.assign(new Error('Provider safety refusal. No failover permitted.'),{code:'PROVIDER_REFUSAL'});
    return requireText(c.name, (j.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('\n'));
  }
  if (c.kind === 'anthropic') {
    const { j } = await requestJson(c.baseUrl||'https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':c.secret,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:c.model,max_tokens:7000,system,messages:[{role:'user',content:prompt}]})},requestOptions);
    recordUsage(c, j, requestId);
    if(j.error?.code==='content_policy_violation'||j.promptFeedback?.blockReason||j.candidates?.some(x=>['SAFETY','RECITATION','PROHIBITED_CONTENT'].includes(x.finishReason))||j.stop_reason==='refusal'||j.choices?.some(x=>x.finish_reason==='content_filter'||x.message?.refusal)||(j.output||[]).some(x=>(x.content||[]).some(y=>y.type==='refusal')))throw Object.assign(new Error('Provider safety refusal. No failover permitted.'),{code:'PROVIDER_REFUSAL'});
    return requireText(c.name, (j.content||[]).map(x=>x.text||'').join('\n'));
  }
  if(c.kind==='openai_compatible'){
    if(!c.baseUrl)throw new Error('OpenAI-compatible provider cần Base URL.');
    const base=c.baseUrl.replace(/\/$/,'');const url=base.endsWith('/chat/completions')?base:base+'/chat/completions';
    const { j } = await requestJson(url,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${c.secret}`},body:JSON.stringify({model:c.model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:0.2})},requestOptions);
    recordUsage(c, j, requestId);
    if(j.error?.code==='content_policy_violation'||j.promptFeedback?.blockReason||j.candidates?.some(x=>['SAFETY','RECITATION','PROHIBITED_CONTENT'].includes(x.finishReason))||j.stop_reason==='refusal'||j.choices?.some(x=>x.finish_reason==='content_filter'||x.message?.refusal)||(j.output||[]).some(x=>(x.content||[]).some(y=>y.type==='refusal')))throw Object.assign(new Error('Provider safety refusal. No failover permitted.'),{code:'PROVIDER_REFUSAL'});
    return requireText(c.name, j.choices?.[0]?.message?.content||'');
  }
  throw new Error(`Kết nối ${c.kind} chưa phải AI provider.`);
}

function modelEndpoint(c) {
  if (c.kind === 'openai') return c.baseUrl ? c.baseUrl.replace(/\/$/, '').replace(/\/responses$/, '') + '/models' : 'https://api.openai.com/v1/models';
  if (c.kind === 'anthropic') return c.baseUrl ? c.baseUrl.replace(/\/$/, '').replace(/\/messages$/, '') + '/models' : 'https://api.anthropic.com/v1/models';
  if (c.kind === 'gemini') return c.baseUrl ? c.baseUrl.replace(/\/$/, '').replace(/\/models\/[^/]+:generateContent$/, '') + '/models' : 'https://generativelanguage.googleapis.com/v1beta/models';
  if (c.kind === 'openai_compatible' && c.baseUrl) return c.baseUrl.replace(/\/$/, '').replace(/\/chat\/completions$/, '') + '/models';
  throw new Error('Provider không hỗ trợ Models API hoặc thiếu Base URL.');
}

export async function listModels(id) {
  const c = getConnection(id);
  if(c.kind==='chatgpt_account')return listAccountModels(id);
  if(['claude_account','gemini_account'].includes(c.kind))return modelAvailability(id).models||[];
  if(c.kind==='antigravity_account')return listAntigravityModels(id);
  if (!c.secret) throw new Error('Thiếu credential.');
  const headers = c.kind === 'gemini' ? { 'x-goog-api-key': c.secret } : c.kind === 'anthropic' ? { 'x-api-key': c.secret, 'anthropic-version': '2023-06-01' } : { authorization: `Bearer ${c.secret}` };
  const base = modelEndpoint(c), models = [], cursors = new Set();
  let cursor = '';
  try {
    for (let page = 0; page < 100; page++) {
      const u = new URL(base);
      if (c.kind === 'anthropic') { u.searchParams.set('limit', '1000'); if (cursor) u.searchParams.set('after_id', cursor); }
      if (c.kind === 'gemini') { u.searchParams.set('pageSize', '1000'); if (cursor) u.searchParams.set('pageToken', cursor); }
      const { j } = await requestJson(u, { headers }, { timeoutMs: 30000, retries: 1 });
      const data = c.kind === 'gemini' ? j.models : j.data;
      if (!Array.isArray(data)) throw new Error('Models API trả dữ liệu không hợp lệ.');
      for (const x of data) {
        if (c.kind === 'gemini' && !x.supportedGenerationMethods?.includes('generateContent')) continue;
        const id = c.kind === 'gemini' ? String(x.name || '').replace(/^models\//, '') : x.id;
        if (typeof id === 'string' && (!c.secret || !id.includes(c.secret))) models.push(id);
      }
      const next = c.kind === 'gemini' ? j.nextPageToken : c.kind === 'anthropic' && j.has_more ? j.last_id : '';
      if (models.length > 10000) throw new Error('Provider trả quá nhiều model.');
      if (!next) { if (c.kind === 'anthropic' && j.has_more) throw new Error('Models API thiếu pagination cursor.'); return recordModels(c, models); }
      if (typeof next !== 'string' || cursors.has(next)) throw new Error('Models API pagination không hợp lệ.');
      cursors.add(next); cursor = next;
    }
    throw new Error('Models API vượt giới hạn pagination.');
  } catch (e) { invalidateModels(id); throw e; }
}

export async function testConnection(id) {
  const c = getConnection(id);
  try { return await verifyConnection(c); }
  catch(e) { if(['github','vercel','supabase'].includes(c.kind)){const meta={...c.meta};delete meta.verifiedAt;saveConnection({...c,meta});} throw e; }
}
async function verifyConnection(c) {
  const id=c.id;
  if (['openai','gemini','anthropic','openai_compatible'].includes(c.kind)) { const models = await listModels(id); return { ok: true, message: `Models API đã xác minh: ${models.length} model.`, models }; }
  if (c.kind === 'github') {if(c.meta?.authMode==='cli'){const { run }=await import('./shell.mjs');const { resolveInfraCli }=await import('./infra-tools.mjs');const cli=resolveInfraCli('github');const x=await run(cli.command,[...cli.args,'api','user','--jq','.login'],{timeoutMs:15000,inheritEnv:false});if(x.code!==0)throw new Error('GitHub CLI chưa đăng nhập.');const login=x.stdout.trim();if(!login)throw new Error('GitHub CLI không trả tài khoản.');saveConnection({...c,meta:{...c.meta,login,verifiedAt:new Date().toISOString()}});return {ok:true,message:`GitHub CLI: ${login}`};}const {r,j}=await requestJson('https://api.github.com/user',{headers:{authorization:`Bearer ${c.secret}`,accept:'application/vnd.github+json','user-agent':'AI-Project-OS-Local'}},{timeoutMs:30000,retries:1});if(!j.login)throw new Error('GitHub không trả tài khoản hợp lệ.');saveConnection({...c,meta:{...c.meta,login:j.login,userId:String(j.id||''),verifiedAt:new Date().toISOString()}});return {ok:true,message:`GitHub: ${j.login}`};}
  if (c.kind === 'vercel') {if(c.meta?.authMode==='cli'){const { run }=await import('./shell.mjs');const { resolveInfraCli }=await import('./infra-tools.mjs');const cli=resolveInfraCli('vercel');const x=await run(cli.command,[...cli.args,'whoami'],{timeoutMs:20000,inheritEnv:false});if(x.code!==0)throw new Error('Vercel CLI chưa đăng nhập.');const login=x.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);if(!login)throw new Error('Vercel CLI không trả tài khoản.');saveConnection({...c,meta:{...c.meta,login,verifiedAt:new Date().toISOString()}});return {ok:true,message:`Vercel CLI: ${login}`};}const {j}=await requestJson('https://api.vercel.com/v2/user',{headers:{authorization:`Bearer ${c.secret}`}},{timeoutMs:30000,retries:1});const login=j.user?.username||j.user?.name;if(!login)throw new Error('Vercel không trả tài khoản.');saveConnection({...c,meta:{...c.meta,login,verifiedAt:new Date().toISOString()}});return {ok:true,message:`Vercel: ${login}`};}
  if (c.kind === 'supabase') {if(c.meta?.authMode==='cli'){const { run }=await import('./shell.mjs');const { resolveInfraCli }=await import('./infra-tools.mjs');const cli=resolveInfraCli('supabase');const x=await run(cli.command,[...cli.args,'projects','list','--output','json'],{timeoutMs:30000,inheritEnv:false});if(x.code!==0)throw new Error('Supabase CLI chưa đăng nhập.');const rows=JSON.parse(x.stdout);if(!Array.isArray(rows))throw new Error('Supabase CLI trả dữ liệu không hợp lệ.');saveConnection({...c,meta:{...c.meta,projects:rows.map(p=>({id:String(p.id||''),name:String(p.name||'')})),verifiedAt:new Date().toISOString()}});return {ok:true,message:`Supabase CLI: ${rows.length} project`};}if(c.meta?.management){const {j}=await requestJson('https://api.supabase.com/v1/projects',{headers:{authorization:`Bearer ${c.secret}`}},{timeoutMs:30000,retries:1});if(!Array.isArray(j))throw new Error('Supabase trả dữ liệu không hợp lệ.');saveConnection({...c,meta:{...c.meta,projects:j.map(p=>({id:String(p.id||''),name:String(p.name||'')})),verifiedAt:new Date().toISOString()}});return {ok:true,message:`Supabase Management API: ${j.length} project`};}if(!c.baseUrl)throw new Error('Supabase Project connection cần Project URL.');const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);try{const r=await fetch(c.baseUrl.replace(/\/$/,'')+'/rest/v1/',{headers:{apikey:c.secret,authorization:`Bearer ${c.secret}`},signal:controller.signal,redirect:'error'});if(!r.ok)throw new Error(`Supabase ${r.status}`);saveConnection({...c,meta:{...c.meta,verifiedAt:new Date().toISOString()}});return {ok:true,message:'Supabase project endpoint phản hồi.'};}finally{clearTimeout(timer);}}
  return {ok:true,message:'Đã lưu cục bộ.'};
}
