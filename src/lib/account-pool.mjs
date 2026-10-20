// Account pool + quota rotation (v0.9.44).
//
// The owner holds several real accounts per vendor ("chatbox" accounts run
// through the vendors' own CLIs, plus API-key connections). Until now every
// role binding pinned exactly one connection, so a run died the moment that
// account hit its plan quota even when a second account of the same vendor
// was sitting idle. This module groups connections of the same kind into a
// pool: when a call fails with a quota / rate-limit signal, the account is
// put on cooldown until its reset (parsed from the provider error when
// available, otherwise a conservative default) and the call is retried on
// the next pooled account. Every quota hit and every switch is recorded so
// the reception feed ("Đội AI bàn việc") can show the team changing seats.
//
// Accounts are only ever the owner's own logged-in accounts — the pool never
// creates, guesses or shares credentials; it re-orders calls between
// connections the owner already added and verified.
import { readJson, writeJson } from './store.mjs';
import { listConnections, getConnection } from './vault.mjs';
import { registryEntry } from './model-bindings.mjs';

const FILE = 'account-pool.json';
const ACCOUNT_KINDS = new Set(['chatgpt_account', 'claude_account', 'gemini_account', 'antigravity_account']);
const API_KINDS = new Set(['openai', 'gemini', 'anthropic', 'openai_compatible']);
const DEFAULT_COOLDOWN_MS = { account: 60 * 60 * 1000, api: 2 * 60 * 1000 };

const state = () => {
  const s = readJson(FILE, { version: 1, accounts: {}, events: [] });
  if (!s || typeof s !== 'object' || typeof s.accounts !== 'object' || !Array.isArray(s.events)) return { version: 1, accounts: {}, events: [] };
  return s;
};
const save = s => writeJson(FILE, s);
const pushEvent = (s, ev) => { s.events = [...(s.events || []), ev].slice(-120); };

export function isQuotaError(err) {
  if (!err) return false;
  if (err.status === 429) return true;
  const m = String(err.message || err.code || '');
  return /quota|usage limit|usage_limit|rate.?limit|too many requests|limit (has been |was )?reached|exceeded your|resource_exhausted|hạn mức|vượt giới hạn|giới hạn (sử dụng|tốc độ)/i.test(m);
}

/** Best-effort reset time (epoch ms) carried by a provider error. */
export function extractQuotaResetMs(err, nowMs = Date.now()) {
  if (!err) return null;
  for (const v of [err.resetAt, err.resetsAt, err.quotaResetAt]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) { const ms = n < 1e12 ? n * 1000 : n; if (ms > nowMs) return ms; }
  }
  const m = String(err.message || '');
  const iso = m.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/);
  if (iso) { const t = Date.parse(iso[0].replace(' ', 'T')); if (Number.isFinite(t) && t > nowMs) return t; }
  const rel = m.match(/(?:in|after|retry after|sau)\s+(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|giây|phút|giờ)/i);
  if (rel) {
    const n = Number(rel[1]); const unit = rel[2].toLowerCase();
    const mult = /sec|giây/.test(unit) ? 1000 : /hour|hrs?|giờ/.test(unit) ? 3600000 : 60000;
    if (n > 0 && n < 100000) return nowMs + n * mult;
  }
  return null;
}

export function cooldownUntilMs(connectionId, nowMs = Date.now()) {
  const a = state().accounts?.[connectionId];
  const t = a ? Date.parse(a.cooldownUntil || '') : NaN;
  return Number.isFinite(t) && t > nowMs ? t : null;
}
export const isCooling = (connectionId, nowMs = Date.now()) => cooldownUntilMs(connectionId, nowMs) != null;

function recordEvent(kind, fields) {
  const s = state();
  pushEvent(s, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString(), kind, ...fields });
  save(s);
}

/** Mark an account as quota-exhausted; returns the cooldown end (epoch ms). */
export function noteQuotaHit(connection, err, nowMs = Date.now()) {
  const reset = extractQuotaResetMs(err, nowMs);
  const fallback = nowMs + (ACCOUNT_KINDS.has(connection.kind) ? DEFAULT_COOLDOWN_MS.account : DEFAULT_COOLDOWN_MS.api);
  const until = reset && reset > nowMs + 5000 ? reset : fallback;
  const s = state();
  s.accounts[connection.id] = { cooldownUntil: new Date(until).toISOString(), lastQuotaAt: new Date(nowMs).toISOString(), name: String(connection.name || '').slice(0, 120), kind: connection.kind };
  pushEvent(s, { id: `${nowMs}-q-${connection.id.slice(0, 8)}`, at: new Date(nowMs).toISOString(), kind: 'pool.quota', connectionId: connection.id, name: s.accounts[connection.id].name, connKind: connection.kind, until: new Date(until).toISOString() });
  save(s);
  return until;
}

export function noteSwitch(fromConn, toConn, model) {
  recordEvent('pool.switch', { fromId: fromConn.id, fromName: String(fromConn.name || '').slice(0, 120), toId: toConn.id, toName: String(toConn.name || '').slice(0, 120), connKind: toConn.kind, model: String(model || '').slice(0, 120) });
}

export function notePoolExhausted(connKind, earliestMs) {
  recordEvent('pool.exhausted', { connKind, until: earliestMs ? new Date(earliestMs).toISOString() : null });
}

export function poolEvents(limit = 50) { return state().events.slice(-limit); }

const fmtTime = iso => { try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const KIND_LABEL = { chatgpt_account: 'ChatGPT', claude_account: 'Claude', gemini_account: 'Gemini', antigravity_account: 'Antigravity', openai: 'OpenAI API', gemini: 'Gemini API', anthropic: 'Anthropic API', openai_compatible: 'OpenAI-compatible' };
export const poolKindLabel = kind => KIND_LABEL[kind] || String(kind || '');

export function poolFeedEvents(limit = 50) {
  return poolEvents(limit).map(ev => {
    if (ev.kind === 'pool.quota') return { id: `pool:${ev.id}`, at: ev.at, actor: 'Hệ thống', kind: 'pool.quota', state: 'warn', pipeline: null, text: `Tài khoản “${ev.name}” (${poolKindLabel(ev.connKind)}) chạm hạn mức — cho nghỉ đến ${fmtTime(ev.until)}.` };
    if (ev.kind === 'pool.switch') return { id: `pool:${ev.id}`, at: ev.at, actor: 'Hệ thống', kind: 'pool.switch', state: 'info', pipeline: null, text: `Đội chuyển sang tài khoản “${ev.toName}” (${poolKindLabel(ev.connKind)}) để chạy tiếp model ${ev.model}.` };
    if (ev.kind === 'pool.exhausted') return { id: `pool:${ev.id}`, at: ev.at, actor: 'Hệ thống', kind: 'pool.exhausted', state: 'failed', pipeline: null, text: `Tất cả tài khoản ${poolKindLabel(ev.connKind)} đều đang nghỉ hạn mức${ev.until ? ` — sớm nhất mở lại ${fmtTime(ev.until)}` : ''}.` };
    return null;
  }).filter(Boolean);
}

/**
 * Ordered failover candidates for a resolved primary connection.
 * Peers must share the primary's kind AND have the primary's model in their
 * own verified registry — an account is never asked for a model it has not
 * verified. Cooling accounts are skipped; the primary leads when available.
 */
export function poolCandidates(primary, nowMs = Date.now()) {
  const fallback = { candidates: [primary], earliestResetMs: null, poolSize: 1 };
  try {
    if (!primary?.id || !(ACCOUNT_KINDS.has(primary.kind) || API_KINDS.has(primary.kind))) return fallback;
    const peers = [];
    let poolSize = 1;
    for (const c of listConnections()) {
      if (c.id === primary.id || c.kind !== primary.kind) continue;
      poolSize++;
      try {
        const r = registryEntry(c.id);
        if (!r.models.includes(primary.model)) continue;
        peers.push({ ...getConnection(c.id), model: primary.model, usageContext: primary.usageContext });
      } catch { /* unverified peer — not eligible, never an error */ }
    }
    const eligible = [primary, ...peers];
    const ready = eligible.filter(c => !isCooling(c.id, nowMs));
    const cooling = eligible.filter(c => isCooling(c.id, nowMs));
    const earliestResetMs = cooling.length ? Math.min(...cooling.map(c => cooldownUntilMs(c.id, nowMs))) : null;
    return { candidates: ready, earliestResetMs, poolSize };
  } catch { return fallback; }
}

/** UI/status view: position inside the same-kind pool + cooldown state. */
export function poolInfoFor(connectionId, nowMs = Date.now()) {
  try {
    const c = getConnection(connectionId);
    if (!(ACCOUNT_KINDS.has(c.kind) || API_KINDS.has(c.kind))) return undefined;
    const siblings = listConnections().filter(x => x.kind === c.kind);
    const idx = siblings.findIndex(x => x.id === connectionId);
    const until = cooldownUntilMs(connectionId, nowMs);
    return { poolSize: siblings.length, poolIndex: idx >= 0 ? idx : 0, cooldownUntil: until ? new Date(until).toISOString() : null };
  } catch { return undefined; }
}

export function clearPoolState() { save({ version: 1, accounts: {}, events: [] }); }
