// Signed auto-update for AI Project OS (commercial build).
// Safety rules (owner-set):
// - An update is accepted ONLY when its manifest carries a valid Ed25519
//   signature from the owner key AND the
//   downloaded zip's SHA-256 matches the signed manifest. Anything else is
//   rejected before a single app file is touched.
// - Updates are downloaded to a staging area first and applied by the
//   launcher on the NEXT start, never while the server is running.
// - Applying backs up every file it overwrites (and records files it adds)
//   under <dataDir>/backups/update-<version>/; any failure restores the
//   backup and leaves the old version running. The external data dir is
//   never part of an update payload.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
// Owner public key (Ed25519, PEM) — verifies signed update manifests. The
// matching private key stays with the owner and is frozen: it also signed
// licenses before licensing was removed by owner decision (2026-10-17);
// the key itself must never change or old update channels break.
export const OWNER_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAzVC63rnj173w3DG62Jc48aC5MxeVVUAmJFCPUSpOuKE=
-----END PUBLIC KEY-----`;

function fail(code, message) { const e = new Error(message); e.code = code; return e; }

export function compareVersions(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function canonicalManifest(m) {
  return ['ai-project-os', m.version, m.url, m.sha256, String(m.size)].join('|');
}
export function signManifest(privateKeyPem, fields) {
  const base = { product: 'ai-project-os', ...fields };
  const sig = crypto.sign(null, Buffer.from(canonicalManifest(base), 'utf8'), privateKeyPem);
  return { ...base, signature: sig.toString('base64url') };
}
// Built-in update channel (v0.9.44): the owner's public source repo serves
// the signed manifest + package from its latest GitHub Release, so an
// installed copy needs zero configuration to receive updates. A per-install
// update-config.json or AIOS_UPDATE_MANIFEST_URL still overrides this.
export const DEFAULT_UPDATE_MANIFEST_URL = 'https://github.com/hui-minh-bach/ai-project-os-source/releases/latest/download/update-manifest.json';
export function verifyManifest(manifest, publicKeyPem = OWNER_PUBLIC_KEY_PEM) {
  if (!manifest || manifest.product !== 'ai-project-os' || !manifest.version || !manifest.url || !manifest.sha256 || !manifest.signature)
    throw fail('UPDATE_MANIFEST', 'Manifest cập nhật thiếu trường bắt buộc.');
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(canonicalManifest(manifest), 'utf8'), publicKeyPem, Buffer.from(manifest.signature, 'base64url')); } catch { ok = false; }
  if (!ok) throw fail('UPDATE_MANIFEST_SIGNATURE', 'Chữ ký manifest cập nhật không hợp lệ — từ chối cập nhật.');
  return manifest;
}

// --- Minimal safe ZIP reader (stored + deflate). The whole zip is SHA-256
// verified against the signed manifest before extraction, so per-entry CRC
// is defense-in-depth, not the trust anchor. ZIP64 is rejected explicitly.
const CRC_TABLE = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

export function listZipEntries(buf) {
  if (buf.length < 22) throw fail('UPDATE_ZIP', 'File zip quá nhỏ.');
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65536); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw fail('UPDATE_ZIP', 'Không tìm thấy thư mục trung tâm của zip.');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (count === 0xFFFF || off === 0xFFFFFFFF) throw fail('UPDATE_ZIP64', 'Zip64 chưa được hỗ trợ cho gói cập nhật.');
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw fail('UPDATE_ZIP', 'Bản ghi zip bị hỏng.');
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const usize = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), commentLen = buf.readUInt16LE(off + 32);
    const lhofs = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
    entries.push({ name, method, csize, usize, lhofs });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function extractZipTo(buf, destDir, { maxTotal = 2 * 1024 * 1024 * 1024 } = {}) {
  const entries = listZipEntries(buf);
  const written = [];
  let total = 0;
  for (const e of entries) {
    const rel = e.name.replace(/\\/g, '/');
    if (!rel || rel.endsWith('/')) continue;
    if (rel.startsWith('/') || /^[a-zA-Z]:/.test(rel) || rel.split('/').includes('..'))
      throw fail('UPDATE_ZIP_PATH', 'Đường dẫn nguy hiểm trong zip: ' + e.name);
    if (rel.toLowerCase().startsWith('data/')) throw fail('UPDATE_ZIP_PATH', 'Gói cập nhật không được chứa thư mục data/: ' + e.name);
    total += e.usize; if (total > maxTotal) throw fail('UPDATE_ZIP_SIZE', 'Gói cập nhật vượt giới hạn dung lượng giải nén.');
    const lh = e.lhofs;
    if (buf.readUInt32LE(lh) !== 0x04034b50) throw fail('UPDATE_ZIP', 'Local header bị hỏng: ' + e.name);
    const ln = buf.readUInt16LE(lh + 26), lx = buf.readUInt16LE(lh + 28);
    const data = buf.subarray(lh + 30 + ln + lx, lh + 30 + ln + lx + e.csize);
    let out;
    if (e.method === 0) out = Buffer.from(data);
    else if (e.method === 8) out = zlib.inflateRawSync(data);
    else throw fail('UPDATE_ZIP_METHOD', 'Phương thức nén zip chưa hỗ trợ: ' + e.method);
    if (out.length !== e.usize) throw fail('UPDATE_ZIP', 'Kích thước giải nén không khớp: ' + e.name);
    const target = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, out);
    written.push(rel);
  }
  return written;
}

// Small zip writer (deflate) — used by the owner publish tool tests and
// fixtures. Production update zips may come from any standard zip tool.
export function createZipBuffer(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name.replace(/\\/g, '/'), 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8); eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const sha256File = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

export function createUpdater({ dataDir, currentVersion, publicKeyPem = OWNER_PUBLIC_KEY_PEM, fetchImpl = fetch, now = () => new Date() } = {}) {
  if (!dataDir || !currentVersion) throw fail('UPDATE_CONFIG', 'Thiếu dataDir/currentVersion cho updater.');
  const dir = path.join(dataDir, 'updates');
  const configFile = path.join(dataDir, 'update-config.json');
  const pendingFile = path.join(dataDir, 'pending-update.json');
  const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 2)); fs.renameSync(t, f); };
  function getConfig() { return readJson(configFile) || { url: process.env.AIOS_UPDATE_MANIFEST_URL || DEFAULT_UPDATE_MANIFEST_URL }; }
  function setConfig({ url }) {
    const u = String(url || '').trim();
    if (u && !/^https?:\/\//i.test(u)) throw fail('UPDATE_CONFIG', 'URL manifest cập nhật phải bắt đầu bằng http:// hoặc https://');
    writeJson(configFile, { url: u });
    return getConfig();
  }
  function pending() { return readJson(pendingFile); }
  function status() {
    const p = pending();
    return { currentVersion, configured: Boolean(getConfig().url), url: getConfig().url || '', pending: p ? { version: p.version, stagedAt: p.stagedAt } : null, lastUpdate: readJson(path.join(dataDir, 'last-update.json')), lastFailure: readJson(path.join(dataDir, 'update-failed.json')) };
  }
  async function check() {
    const { url } = getConfig();
    if (!url) return { configured: false, available: false, currentVersion };
    const res = await fetchImpl(url);
    if (!res.ok) throw fail('UPDATE_FETCH', 'Không tải được manifest cập nhật (HTTP ' + res.status + ').');
    const manifest = verifyManifest(await res.json(), publicKeyPem);
    const available = compareVersions(manifest.version, currentVersion) > 0;
    return { configured: true, available, currentVersion, manifest: available ? manifest : { version: manifest.version } };
  }
  async function download() {
    const c = await check();
    if (!c.available) return { downloaded: false, reason: 'up-to-date', currentVersion };
    const m = c.manifest;
    const res = await fetchImpl(m.url);
    if (!res.ok) throw fail('UPDATE_FETCH', 'Không tải được gói cập nhật (HTTP ' + res.status + ').');
    fs.mkdirSync(dir, { recursive: true });
    const part = path.join(dir, m.version + '.zip.part');
    const final = path.join(dir, m.version + '.zip');
    const hash = crypto.createHash('sha256');
    let size = 0;
    const ws = fs.createWriteStream(part);
    const body = res.body;
    if (!body) throw fail('UPDATE_FETCH', 'Máy chủ cập nhật không trả nội dung.');
    for await (const chunk of body) { hash.update(chunk); size += chunk.length; ws.write(chunk); }
    await new Promise((resolve, reject) => ws.end((e) => (e ? reject(e) : resolve())));
    const digest = hash.digest('hex');
    if (m.size && size !== m.size) { fs.rmSync(part, { force: true }); throw fail('UPDATE_SIZE', `Dung lượng gói cập nhật không khớp manifest (${size} != ${m.size}).`); }
    if (digest !== m.sha256) { fs.rmSync(part, { force: true }); throw fail('UPDATE_HASH', 'SHA-256 của gói cập nhật không khớp manifest đã ký — đã hủy gói tải.'); }
    fs.renameSync(part, final);
    writeJson(pendingFile, { version: m.version, file: final, sha256: digest, stagedAt: now().toISOString() });
    return { downloaded: true, version: m.version, file: final, sha256: digest };
  }
  return { getConfig, setConfig, check, download, status, pending };
}

// Called by the launcher BEFORE the server starts. Returns a report object;
// never throws for a bad pending update — it rolls back and records the
// failure so the old version keeps running.
export function applyPendingUpdate({ appRoot, dataDir, now = () => new Date(), log = () => {} } = {}) {
  const pendingFile = path.join(dataDir, 'pending-update.json');
  const pending = (() => { try { return JSON.parse(fs.readFileSync(pendingFile, 'utf8')); } catch { return null; } })();
  if (!pending) return { applied: false, reason: 'none' };
  const failAndRecord = (code, message) => {
    try { fs.writeFileSync(path.join(dataDir, 'update-failed.json'), JSON.stringify({ version: pending.version, code, message, at: now().toISOString() }, null, 2)); } catch { /* ignore */ }
    try { fs.rmSync(pendingFile, { force: true }); } catch { /* ignore */ }
    return { applied: false, reason: code, message };
  };
  try {
    if (!fs.existsSync(pending.file)) return failAndRecord('UPDATE_FILE_MISSING', 'Không thấy gói cập nhật đã tải.');
    if (sha256File(pending.file) !== pending.sha256) return failAndRecord('UPDATE_HASH', 'Gói cập nhật đã thay đổi sau khi tải — hủy áp dụng.');
    const buf = fs.readFileSync(pending.file);
    const entries = listZipEntries(buf).map((e) => e.name.replace(/\\/g, '/')).filter((n) => n && !n.endsWith('/'));
    const backupDir = path.join(dataDir, 'backups', 'update-' + pending.version);
    fs.mkdirSync(backupDir, { recursive: true });
    const backedUp = [], added = [];
    for (const rel of entries) {
      const target = path.join(appRoot, rel);
      if (fs.existsSync(target)) { const b = path.join(backupDir, rel); fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(target, b); backedUp.push(rel); }
      else added.push(rel);
    }
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify({ version: pending.version, backedUp, added, at: now().toISOString() }, null, 2));
    try {
      extractZipTo(buf, appRoot);
    } catch (e) {
      for (const rel of backedUp) fs.copyFileSync(path.join(backupDir, rel), path.join(appRoot, rel));
      for (const rel of added) fs.rmSync(path.join(appRoot, rel), { force: true });
      return failAndRecord(e.code || 'UPDATE_APPLY_FAILED', 'Áp dụng cập nhật lỗi, đã khôi phục bản cũ: ' + e.message);
    }
    fs.rmSync(pendingFile, { force: true });
    fs.writeFileSync(path.join(dataDir, 'last-update.json'), JSON.stringify({ version: pending.version, at: now().toISOString(), files: entries.length }, null, 2));
    log('Đã áp dụng cập nhật v' + pending.version);
    return { applied: true, version: pending.version, files: entries.length, backupDir };
  } catch (e) {
    return failAndRecord(e.code || 'UPDATE_APPLY_FAILED', e.message);
  }
}
