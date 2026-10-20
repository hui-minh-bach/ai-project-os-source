// External operator channel: lets a trusted outside coordinator (for example
// the owner's own assistant agent) drive this app through a narrow, audited
// API instead of the browser session. One revocable token, stored only as a
// SHA-256 hash, with per-scope permissions. Publishing approval is a separate
// scope that defaults OFF — the boss gate stays the boss's until he opts in.
// The server still only listens on loopback; remote reachability is provided
// by the owner's own private network tool (e.g. Tailscale Serve), never by
// opening this app to the internet.
import crypto from 'node:crypto';
import { readJson, writeJson } from './store.mjs';

const TOKEN_FILE = 'operator.json';
const NOTES_FILE = 'operator-notes.json';
const SCOPES = ['run', 'note', 'approvePublish'];

function hashToken(raw) { return crypto.createHash('sha256').update(String(raw)).digest('hex'); }
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); } catch { return false; }
}
function load() { const j = readJson(TOKEN_FILE, null); return j && typeof j === 'object' ? j : null; }
function cleanScopes(input) {
  const out = { run: false, note: false, approvePublish: false };
  if (input && typeof input === 'object') for (const s of SCOPES) out[s] = input[s] === true;
  return out;
}

export function operatorStatus() {
  const j = load();
  if (!j || !j.tokenHash) return { enabled: false, createdAt: null, scopes: { run: false, note: false, approvePublish: false } };
  return { enabled: true, createdAt: j.createdAt || null, scopes: cleanScopes(j.scopes) };
}

export function createOperatorToken(scopes = {}) {
  const raw = 'aios-op-' + crypto.randomBytes(24).toString('hex');
  const record = { tokenHash: hashToken(raw), createdAt: new Date().toISOString(), scopes: cleanScopes(scopes) };
  writeJson(TOKEN_FILE, record);
  // The raw token is returned exactly once, for the owner to hand to his
  // coordinator. Only its hash is kept on disk.
  return { token: raw, createdAt: record.createdAt, scopes: record.scopes };
}

export function revokeOperatorToken() { writeJson(TOKEN_FILE, { tokenHash: null, createdAt: null, scopes: { run: false, note: false, approvePublish: false } }); return operatorStatus(); }

export function verifyOperatorToken(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('aios-op-') || raw.length > 80) return null;
  const j = load();
  if (!j || !j.tokenHash) return null;
  if (!safeEqualHex(hashToken(raw), j.tokenHash)) return null;
  return { scopes: cleanScopes(j.scopes), createdAt: j.createdAt || null };
}

export function operatorCan(auth, scope) { return Boolean(auth && auth.scopes && auth.scopes[scope] === true); }

export function listOperatorNotes(limit = 50) {
  const arr = readJson(NOTES_FILE, []);
  return (Array.isArray(arr) ? arr : []).slice(-limit);
}

export function addOperatorNote(text, author = 'Điều phối ngoài') {
  const clean = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 2000);
  if (!clean) throw new Error('Ghi chú rỗng.');
  const arr = readJson(NOTES_FILE, []);
  const note = { id: crypto.randomUUID(), at: new Date().toISOString(), author: String(author).slice(0, 60), text: clean };
  const next = (Array.isArray(arr) ? arr : []).concat(note).slice(-200);
  writeJson(NOTES_FILE, next);
  return note;
}

/** Notes rendered as feed events, shape-compatible with buildRunFeed events. */
export function operatorNoteEvents(limit = 50) {
  return listOperatorNotes(limit).map(n => ({ id: `opnote:${n.id}`, runId: null, at: n.at, actor: n.author || 'Điều phối ngoài', kind: 'operator.note', state: 'info', pipeline: null, text: n.text }));
}
