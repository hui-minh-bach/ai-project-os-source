import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, atomicWriteText } from './store.mjs';

const FILE = path.join(DATA_DIR, 'vault.enc.json');
let unlocked = null;
const lockListeners = new Set();
export function onVaultLock(fn) { lockListeners.add(fn); return () => lockListeners.delete(fn); }

const b64 = b => Buffer.from(b).toString('base64');
const unb64 = s => Buffer.from(s, 'base64');

function derive(password, salt) {
  return crypto.scryptSync(password, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function encryptObject(obj, password, salt = crypto.randomBytes(16)) {
  const iv = crypto.randomBytes(12);
  const key = derive(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return { version: 2, kdf: 'scrypt-N32768-r8-p1', salt: b64(salt), iv: b64(iv), tag: b64(cipher.getAuthTag()), data: b64(encrypted) };
}

function deriveForPayload(password, payload) {
  const opts = payload?.version >= 2 ? { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } : { N: 16384, r: 8, p: 1 };
  return crypto.scryptSync(password, unb64(payload.salt), 32, opts);
}

function decryptObject(payload, password) {
  if (!payload || !payload.salt || !payload.iv || !payload.tag || !payload.data) throw new Error('Vault payload không hợp lệ.');
  const key = deriveForPayload(password, payload);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, unb64(payload.iv));
  decipher.setAuthTag(unb64(payload.tag));
  const plain = Buffer.concat([decipher.update(unb64(payload.data)), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

function tryLoadVault(password) {
  const candidates = [FILE, `${FILE}.bak`].filter(p => fs.existsSync(p));
  let lastError;
  for (const p of candidates) {
    try {
      const payload = JSON.parse(fs.readFileSync(p, 'utf8'));
      const data = decryptObject(payload, password);
      if (p.endsWith('.bak')) atomicWriteText(FILE, JSON.stringify(payload, null, 2), { backup: false });
      return data;
    } catch (e) { lastError = e; }
  }
  const err = new Error('Không mở được Vault: mật khẩu không đúng hoặc file Vault bị hỏng.');
  err.cause = lastError;
  throw err;
}

function vaultSecrets() {
  return [unlocked?._password, ...(unlocked?.connections || []).map(c => c.secret)].filter(Boolean);
}

function redactPlain(text, secrets) {
  for (const secret of secrets) {
    // Short fixture credentials must not erase parts of ordinary identifiers.
    const token = secret.length <= 4 && /^[\p{L}\p{N}_]+$/u.test(secret);
    let out = '', from = 0, at;
    while ((at = text.indexOf(secret, from)) !== -1) {
      const boundary = !token || (!/[\p{L}\p{N}_]/u.test(text[at - 1] || '') && !/[\p{L}\p{N}_]/u.test(text[at + secret.length] || ''));
      out += text.slice(from, at) + (boundary ? '[redacted]' : secret);
      from = at + secret.length;
    }
    text = out + text.slice(from);
  }
  return text;
}

function redactText(text, secrets, depth = 0) {
  // Nested JSON strings lose an escaping layer on each pass. Bound pathological
  // nesting without returning a potentially encoded credential unchanged.
  if (depth > 32) return '[redacted]';
  const sanitize = value => typeof value === 'string' ? redactText(value, secrets, depth + 1)
    : Array.isArray(value) ? value.map(sanitize)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, val]) => [redactPlain(key, secrets), sanitize(val)]))
    : value;
  if (/^\s*[\[{"]/.test(text)) {
    try {
      const parsed = JSON.parse(text), clean = sanitize(parsed);
      // Retain untouched formatting, and never replace JSON booleans/numbers.
      return JSON.stringify(parsed) === JSON.stringify(clean) ? text
        : text.match(/^\s*/)[0] + JSON.stringify(clean) + text.match(/\s*$/)[0];
    } catch {}
  }
  // Protect protocol JSON inside Markdown before sanitizing surrounding prose.
  const fence = /```[^\r\n]*\r?\n[\s\S]*?```/g;
  const parts = []; let from = 0;
  for (const match of text.matchAll(fence)) {
    parts.push(redactProse(text.slice(from, match.index), secrets, depth));
    const start = match[0].indexOf('\n') + 1;
    parts.push(redactPlain(match[0].slice(0, start), secrets) + redactText(match[0].slice(start, -3), secrets, depth + 1) + '```');
    from = match.index + match[0].length;
  }
  parts.push(redactProse(text.slice(from), secrets, depth));
  return parts.join('');
}

function redactProse(text, secrets, depth) {
  // Decode complete JSON string literals first: replacing raw backslashes in an
  // escaped credential can otherwise break a quoted tool/protocol response.
  // An unmatched quote in raw prose can pair with a later token's opening quote.
  // Try every unescaped quote; skip a span only when it was actually sanitized.
  const quoted = /"(?:[^"\\\r\n]|\\.)*"/y;
  let out = '', from = 0;
  for (let at = text.indexOf('"'); at !== -1; at = text.indexOf('"', at + 1)) {
    let slash = at - 1;
    while (text[slash] === '\\') slash--;
    if ((at - slash - 1) % 2) continue;
    quoted.lastIndex = at;
    const literal = quoted.exec(text)?.[0];
    if (!literal) continue;
    try {
      const decoded = JSON.parse(literal), clean = redactText(decoded, secrets, depth + 1);
      if (decoded === clean) continue;
      out += text.slice(from, at) + JSON.stringify(clean);
      from = at + literal.length;
      at = from - 1;
    } catch {}
  }
  return redactPlain(out + text.slice(from), secrets);
}

export function createVaultSecretRedactor() {
  // Hold only a private snapshot until the request finishes, even if the Vault
  // locks, disconnects, or rotates a credential during the provider await.
  const snapshot = vaultSecrets();
  return value => redactText(String(value ?? ''), [...new Set([...snapshot, ...vaultSecrets()])].sort((a, b) => b.length - a.length));
}

export function redactVaultSecrets(value) {
  return createVaultSecretRedactor()(value);
}

export function vaultStatus() {
  return { exists: fs.existsSync(FILE) || fs.existsSync(`${FILE}.bak`), unlocked: Boolean(unlocked), connections: unlocked ? summarize(unlocked.connections || []) : [] };
}

function summarize(connections) {
  const sanitize = value => typeof value === 'string' ? redactVaultSecrets(value) : Array.isArray(value) ? value.map(sanitize) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, val]) => [key, sanitize(val)])) : value;
  return connections.map(({ secret, ...x }) => sanitize({ ...x, hasSecret: Boolean(secret) }));
}

export function unlockVault(password) {
  if (!password || password.length < 10) throw new Error('Mật khẩu vault cần ít nhất 10 ký tự.');
  if (!fs.existsSync(FILE) && !fs.existsSync(`${FILE}.bak`)) {
    unlocked = { createdAt: new Date().toISOString(), connections: [] };
    unlocked._password = password;
    saveVault(password);
  } else {
    unlocked = tryLoadVault(password);
    unlocked._password = password;
    // Transparently upgrade older KDF payloads after a successful unlock.
    try { saveVault(password); } catch {}
  }
  return vaultStatus();
}

export function lockVault() { unlocked = null; for(const fn of lockListeners) fn(); }

function saveVault(password = unlocked?._password) {
  if (!unlocked || !password) throw new Error('Vault đang khóa.');
  const clean = { ...unlocked }; delete clean._password;
  atomicWriteText(FILE, JSON.stringify(encryptObject(clean, password), null, 2));
}

export function listConnections() {
  if (!unlocked) throw new Error('Hãy mở khóa vault trước.');
  return summarize(unlocked.connections || []);
}

export function getConnection(id) {
  if (!unlocked) throw new Error('Vault đang khóa.');
  const c = (unlocked.connections || []).find(x => x.id === id);
  if (!c) throw new Error('Không tìm thấy kết nối.');
  return c;
}

export function findConnectionByKind(kind) {
  if (!unlocked) return null;
  return (unlocked.connections || []).find(x => x.kind === kind) || null;
}

export function saveConnection(input) {
  if (!unlocked) throw new Error('Vault đang khóa.');
  const validKinds = ['chatgpt_account','claude_account','gemini_account','antigravity_account','openai','gemini','anthropic','openai_compatible','github','vercel','supabase','youtube','facebook','tiktok','other'];
  if (!validKinds.includes(input.kind)) throw new Error('Loại kết nối không hợp lệ.');
  const now = new Date().toISOString();
  const id = input.id || crypto.randomUUID();
  const old = (unlocked.connections || []).find(x => x.id === id);
  const baseUrl = String(input.baseUrl || old?.baseUrl || '').slice(0, 300);
  if (baseUrl) { const u = new URL(baseUrl); if (!['https:', 'http:'].includes(u.protocol) || (u.protocol === 'http:' && !['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname)) || u.username || u.password || u.search || u.hash) throw new Error('Base URL cần HTTPS (hoặc localhost cho thử nghiệm), không chứa credential/query.'); }
  const secret = input.secret ? String(input.secret) : (old?.secret || '');
  const changed = !old || secret !== old.secret || baseUrl !== old.baseUrl || input.kind !== old.kind || (input.kind === 'chatgpt_account' && input.meta?.accountIdentity !== old.meta?.accountIdentity);
  const supplied = input.meta && typeof input.meta === 'object' ? input.meta : old?.meta || {};
  const meta = {};
  for (const k of ['accountIdentity', 'planType', 'authMode', 'management', 'login', 'userId', 'noreplyEmail', 'team', 'project', 'projects', 'ref', 'keyType', 'verifiedAt', 'reasoningEffort', 'pageId', 'pageName', 'accountLabel', 'channelTitle', 'channelId', 'pages', 'username', 'tiktokApproved', 'linkedAt']) { if (k in supplied) meta[k] = structuredClone(supplied[k]); }
  if (changed && old) delete meta.verifiedAt;
  const item = {
    id,
    kind: input.kind,
    name: String(input.name || input.kind).slice(0, 80),
    model: String(input.model || old?.model || '').slice(0, 120),
    baseUrl,
    meta, secret,
    credentialVersion: changed ? crypto.randomUUID() : old.credentialVersion,
    createdAt: old?.createdAt || now,
    updatedAt: now
  };
  unlocked.connections = (unlocked.connections || []).filter(x => x.id !== id);
  unlocked.connections.push(item);
  saveVault();
  return summarize([item])[0];
}

export function renameConnection(id, name) {
  if (!unlocked) throw new Error('Vault đang khóa.');
  const c = (unlocked.connections || []).find(x => x.id === id);
  if (!c) throw new Error('Không tìm thấy kết nối.');
  const clean = String(name || '').trim().slice(0, 80);
  if (!clean) throw new Error('Tên hiển thị không được trống.');
  c.name = clean;
  c.updatedAt = new Date().toISOString();
  saveVault();
  return summarize([c])[0];
}

export function deleteConnection(id) {
  if (!unlocked) throw new Error('Vault đang khóa.');
  unlocked.connections = (unlocked.connections || []).filter(x => x.id !== id);
  saveVault();
}

// Read-only service credential accessor. Secrets must never be serialized to HTTP.
export function findServiceCredential(keyType) {
  if (!unlocked) return null;
  const item = (unlocked.connections || []).find(x => x.kind === 'other' && x.meta?.keyType === keyType);
  return item ? { id: item.id, secret: item.secret, voiceId: item.model } : null;
}
