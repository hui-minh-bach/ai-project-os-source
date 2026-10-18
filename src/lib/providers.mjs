import crypto from 'node:crypto';
import { recordUsage } from './usage.mjs';
import { askAccount, listAccountModels } from './account-auth.mjs';
import { askCliAccount } from './cli-account.mjs';
import { askAntigravityAccount, listAntigravityModels } from './antigravity-account.mjs';
import { getConnection, saveConnection, createVaultSecretRedactor } from './vault.mjs';
import { resolveModelConnection, recordModels, invalidateModels, modelAvailability } from './model-bindings.mjs';

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

async function requestJson(url, init = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, retries = 2 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('AI request timeout')), timeoutMs);
    try {
      const r = await fetch(url, { ...init, redirect: 'error', signal: controller.signal });
      const j = await readJsonLimited(r);
      if (r.ok) return { r, j };
      const retryable = r.status === 408 || r.status === 409 || r.status === 429 || r.status >= 500;
      const err = new Error(`Provider HTTP ${r.status}. Kiểm tra quyền API, credential và endpoint.`);
      err.status = r.status;
      if (!retryable || attempt === retries) throw err;
      last = err;
    } catch (e) {
      last = e;
      const retryable = controller.signal.aborted || e?.name === 'AbortError' || e?.status === 408 || e?.status === 409 || e?.status === 429 || e?.status >= 500 || e instanceof TypeError;
      if (!retryable || attempt === retries) throw e;
    } finally {
      clearTimeout(timer);
    }
    await sleep(300 * (2 ** attempt));
  }
  throw last || new Error('AI request failed');
}

function requireText(name, text) {
  const out = String(text || '').trim();
  if (!out) throw new Error(`${name}: model trả về nội dung rỗng.`);
  if (out.length > 240000) throw new Error(`${name}: model trả về quá nhiều nội dung (>240k ký tự).`);
  return out;
}

export async function ask(connectionId, { system = '', prompt = '', usageContext = null }) {
  const redact = createVaultSecretRedactor();
  let c;
  try {
    c = resolveModelConnection(connectionId);
    if(usageContext)c.usageContext={...c.usageContext,...usageContext};
    return redact(await askConnection(c, {system, prompt}));
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
async function askConnection(c, { system, prompt }) {
  if(c.kind === 'chatgpt_account'){ const result=await askAccount(c,{system,prompt});recordUsage(c,{usage:result.usage},result.eventId);return requireText(c.name,result.text); }
  if(['claude_account','gemini_account'].includes(c.kind))return requireText(c.name,await askCliAccount(c,{system,prompt}));
  if(c.kind==='antigravity_account')return requireText(c.name,await askAntigravityAccount(c,{system,prompt}));
  const requestId = crypto.randomUUID();
  if (!c.secret) throw new Error(`${c.name}: chưa có API credential.`);
  if (!c.model) throw new Error(`${c.name}: chưa chọn model.`);

  if (c.kind === 'openai') {
    const { j } = await requestJson(c.baseUrl || 'https://api.openai.com/v1/responses', {method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${c.secret}`},body:JSON.stringify({model:c.model,instructions:system,input:prompt})});
    recordUsage(c, j, requestId);
    return requireText(c.name, textFromOpenAI(j));
  }
  if (c.kind === 'gemini') {
    // A custom generateContent URL supplies the API root, never the role's model.
    // Keep arbitrary legacy fixture/proxy endpoints unchanged.
    const modelPath = `/models/${encodeURIComponent(c.model)}:generateContent`;
    const endpoint = c.baseUrl ? c.baseUrl.replace(/\/models\/[^/]+:generateContent\/?$/, modelPath) : `https://generativelanguage.googleapis.com/v1beta${modelPath}`;
    const { j } = await requestJson(endpoint,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':c.secret},body:JSON.stringify({system_instruction:system?{parts:[{text:system}]}:undefined,contents:[{role:'user',parts:[{text:prompt}]}]})});
    recordUsage(c, j, requestId);
    return requireText(c.name, (j.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('\n'));
  }
  if (c.kind === 'anthropic') {
    const { j } = await requestJson(c.baseUrl||'https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':c.secret,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:c.model,max_tokens:7000,system,messages:[{role:'user',content:prompt}]})});
    recordUsage(c, j, requestId);
    return requireText(c.name, (j.content||[]).map(x=>x.text||'').join('\n'));
  }
  if(c.kind==='openai_compatible'){
    if(!c.baseUrl)throw new Error('OpenAI-compatible provider cần Base URL.');
    const base=c.baseUrl.replace(/\/$/,'');const url=base.endsWith('/chat/completions')?base:base+'/chat/completions';
    const { j } = await requestJson(url,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${c.secret}`},body:JSON.stringify({model:c.model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:0.2})});
    recordUsage(c, j, requestId);
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
