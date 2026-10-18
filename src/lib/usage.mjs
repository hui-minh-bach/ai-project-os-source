// Local counters are observations from provider responses, never plan estimates.
import crypto from 'node:crypto';
import { readJson, writeJson } from './store.mjs';
import { getConnection } from './vault.mjs';
const FILE = 'provider-usage.json';
const number = n => Number.isSafeInteger(n) && n >= 0 ? n : null;
export function normalizeUsage(kind, j) {
  const u = ['gemini','gemini_account'].includes(kind) ? j?.usageMetadata : j?.usage;
  if (!u || typeof u !== 'object') return null;
  const counts = kind === 'chatgpt_account' ? {input:number(u.inputTokens),output:number(u.outputTokens),cacheRead:number(u.cachedInputTokens),cacheWrite:number(u.cacheWriteInputTokens),reasoning:number(u.reasoningOutputTokens),total:number(u.totalTokens)} : ['gemini','gemini_account'].includes(kind) ? {input:number(u.promptTokenCount),output:number(u.candidatesTokenCount),cacheRead:number(u.cachedContentTokenCount),cacheWrite:null,reasoning:number(u.thoughtsTokenCount),total:number(u.totalTokenCount)}
    : ['anthropic','claude_account','antigravity_account'].includes(kind) ? {input:number(u.input_tokens),output:number(u.output_tokens),cacheRead:number(u.cache_read_input_tokens),cacheWrite:number(u.cache_creation_input_tokens),reasoning:null,total:null}
    : {input:number(u.input_tokens ?? u.prompt_tokens),output:number(u.output_tokens ?? u.completion_tokens),cacheRead:number(u.input_tokens_details?.cached_tokens ?? u.prompt_tokens_details?.cached_tokens),cacheWrite:null,reasoning:number(u.output_tokens_details?.reasoning_tokens ?? u.completion_tokens_details?.reasoning_tokens),total:number(u.total_tokens)};
  return Object.values(counts).some(x => x !== null) ? counts : null;
}
export function recordUsage(c, raw, requestId) {
  const ledger = readJson(FILE, {version:1,entries:{}});
  // A request is recorded once, after its successful HTTP response, including
  // empty text. Failed/retried attempts do not invent unreported token usage.
  const key=crypto.createHash('sha256').update(c.id+'\0'+requestId).digest('hex');
  if (ledger.entries[key]) return;
  ledger.entries[key]={connectionId:c.id,accountIdentity:c.kind==='chatgpt_account'?crypto.createHash('sha256').update(c.meta?.accountIdentity||'unknown').digest('hex'):null,model:c.model,role:c.usageContext?.role||null,projectId:c.usageContext?.projectId||null,at:new Date().toISOString(),usage:normalizeUsage(c.kind,raw)};
  // Synchronous read/atomic write cannot interleave in the single server process.
  writeJson(FILE, ledger);
}
export function usageSummary(id) {
  const c=getConnection(id); // Never expose usage while Vault is locked.
  const identity=c.kind==='chatgpt_account'?crypto.createHash('sha256').update(c.meta?.accountIdentity||'unknown').digest('hex'):null;
  const rows=Object.values(readJson(FILE,{entries:{}}).entries).filter(x=>x.connectionId===id&&x.accountIdentity===identity);
  const sum = rows => {
    const totals={input:null,output:null,cacheRead:null,cacheWrite:null,reasoning:null,total:null};
    const coverage=Object.fromEntries(Object.keys(totals).map(k=>[k,rows.filter(x=>x.usage?.[k]!==null&&x.usage?.[k]!==undefined).length]));
    for(const row of rows)for(const k of Object.keys(totals))if(row.usage?.[k]!==null&&row.usage?.[k]!==undefined)totals[k]=(totals[k]??0)+row.usage[k];
    return {coverage,responses:rows.length,withUsage:rows.filter(x=>x.usage).length,missingUsage:rows.filter(x=>!x.usage).length,counts:rows.some(x=>x.usage)?totals:null};
  };
  const groups=new Map();for(const row of rows){const key=JSON.stringify([row.model,row.role,row.projectId]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  return {...sum(rows),since:rows[0]?.at||null,updatedAt:rows.at(-1)?.at||null,scope:'local-observed-responses',groups:[...groups.values()].map(rs=>({model:rs[0].model,role:rs[0].role,projectId:rs[0].projectId,...sum(rs)}))};
}
