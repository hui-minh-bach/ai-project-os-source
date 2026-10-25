// Personal Edition signed updates. Disabled unless installation trust is configured.
// Safety rules:
// - An update is accepted ONLY when its manifest carries a valid Ed25519
//   signature from the explicitly trusted Personal key AND the
//   downloaded zip's SHA-256 matches the signed manifest. Anything else is
//   rejected before a single app file is touched.
// - Updates are downloaded to a staging area first and applied by the
//   launcher on the NEXT start, never while the server is running.
// - Applying backs up every file it overwrites (and records files it adds)
//   under <dataDir>/backups/update-<version>-<id>/; write failure restores the
//   backup and leaves the old version running. The external data dir is
//   never part of an update payload.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { APP_ID, APP_VERSION } from './app-identity.mjs';
import { loadUpdatePolicy, validateUpdatePolicy, assertPackageChannel, updateError } from './update-policy.mjs';
const fail = updateError;
export const DEFAULT_UPDATE_MANIFEST_URL = '';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
function versionParts(value) {
  const m = VERSION.exec(String(value));
  if (!m || (m[4] || '').split('.').some(x => /^0\d+$/.test(x))) throw fail('UPDATE_VERSION', 'Phiên bản không hợp lệ.');
  return [m.slice(1, 4).map(Number), m[4]?.split('.')];
}
export function compareVersions(a, b) {
  const [av, ap] = versionParts(a), [bv, bp] = versionParts(b);
  for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] > bv[i] ? 1 : -1;
  if (!ap || !bp) return ap ? -1 : bp ? 1 : 0;
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    if (ap[i] === bp[i]) continue;
    if (ap[i] === undefined || bp[i] === undefined) return ap[i] === undefined ? -1 : 1;
    const an = /^\d+$/.test(ap[i]), bn = /^\d+$/.test(bp[i]);
    if (an && bn) return BigInt(ap[i]) > BigInt(bp[i]) ? 1 : -1;
    if (an !== bn) return an ? -1 : 1;
    return ap[i] > bp[i] ? 1 : -1;
  }
  return 0;
}
export function canonicalManifest(m) {
  return JSON.stringify([2, m.product, m.channel, m.version, m.url, m.sha256, m.size]);
}
export function signManifest(privateKeyPem, fields) {
  const base = { ...fields, schemaVersion: 2, product: APP_ID };
  const sig = crypto.sign(null, Buffer.from(canonicalManifest(base), 'utf8'), privateKeyPem);
  return { ...base, signature: sig.toString('base64url') };
}
export function verifyManifest(manifest, publicKeyPem) {
  if (!manifest || manifest.schemaVersion !== 2 || manifest.product !== APP_ID ||
      !/^personal-[a-z0-9-]{1,40}$/.test(manifest.channel || '') || !manifest.url ||
      !/^[a-f0-9]{64}$/.test(manifest.sha256 || '') || !Number.isSafeInteger(manifest.size) ||
      manifest.size <= 0 || manifest.size > 512 * 1024 * 1024 || !manifest.signature)
    throw fail('UPDATE_MANIFEST', 'Manifest Personal thiếu trường bắt buộc hoặc sai định dạng.');
  versionParts(manifest.version);
  let ok = false;
  try { ok = crypto.verify(null, Buffer.from(canonicalManifest(manifest)), publicKeyPem, Buffer.from(manifest.signature, 'base64url')); } catch { ok = false; }
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
    const flags = buf.readUInt16LE(off + 8);
    const crc = buf.readUInt32LE(off + 16);
    const unixMode = buf.readUInt32LE(off + 38) >>> 16;
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const usize = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), commentLen = buf.readUInt16LE(off + 32);
    const lhofs = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
    entries.push({ name, flags, crc, unixMode, method, csize, usize, lhofs });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function assertSafeTarget(root, rel) {
  const target = path.resolve(root, rel);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw fail('UPDATE_ZIP_PATH', 'Đường dẫn nằm ngoài thư mục được phép.');
  let cursor = path.resolve(root);
  if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw fail('UPDATE_ZIP_PATH', 'Không cập nhật qua symlink.');
  for (const part of rel.split('/')) {
    cursor = path.join(cursor, part);
    try { if (fs.lstatSync(cursor).isSymbolicLink()) throw fail('UPDATE_ZIP_PATH', 'Không cập nhật qua symlink.'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}
function validatedEntries(buf, destDir, maxTotal = 2 * 1024 * 1024 * 1024) {
  const entries = [], seen = new Set(); let total = 0;
  for (const e of listZipEntries(buf)) {
    const rel = e.name.replace(/\\/g, '/'), parts = rel.replace(/\/$/, '').split('/');
    if (!rel || parts.some(p => !p || p === '.' || p === '..' || /[<>:"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)) ||
        /^(?:data|\.data|\.git|backups|updates|personal-update-trust\.json)$/i.test(parts[0]) ||
        parts.some(p => /^\.env(?:\.|$)/i.test(p)) || (e.unixMode & 0xf000) === 0xa000 || (e.flags & 1))
      throw fail('UPDATE_ZIP_PATH', 'Đường dẫn không được phép trong gói cập nhật: ' + e.name);
    const key = parts.join('/').toLowerCase();
    if (seen.has(key)) throw fail('UPDATE_ZIP_PATH', 'Đường dẫn trùng trong gói cập nhật.');
    seen.add(key); assertSafeTarget(destDir, parts.join('/'));
    if (rel.endsWith('/')) continue;
    total += e.usize;
    if (total > maxTotal) throw fail('UPDATE_ZIP_SIZE', 'Gói vượt giới hạn giải nén.');
    entries.push({ ...e, name: rel });
  }
  return entries;
}
function unzipEntry(buf, e) {
  const lh = e.lhofs;
  if (buf.readUInt32LE(lh) !== 0x04034b50) throw fail('UPDATE_ZIP', 'Local header bị hỏng.');
  const ln = buf.readUInt16LE(lh + 26), lx = buf.readUInt16LE(lh + 28);
  const start = lh + 30 + ln + lx;
  if (start + e.csize > buf.length) throw fail('UPDATE_ZIP', 'ZIP bị cắt.');
  const data = buf.subarray(start, start + e.csize);
  let out;
  if (e.method === 0) out = Buffer.from(data);
  else if (e.method === 8) out = zlib.inflateRawSync(data, { maxOutputLength: Math.max(1, e.usize) });
  else throw fail('UPDATE_ZIP_METHOD', 'Phương thức ZIP không được hỗ trợ.');
  if (out.length !== e.usize || crc32(out) !== e.crc) throw fail('UPDATE_ZIP', 'Kích thước hoặc CRC không khớp: ' + e.name);
  return out;
}
export function extractZipTo(buf, destDir, { maxTotal = 2 * 1024 * 1024 * 1024 } = {}) {
  const entries = validatedEntries(buf, destDir, maxTotal);
  for (const e of entries) unzipEntry(buf, e);
  for (const e of entries) {
    const target = assertSafeTarget(destDir, e.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, unzipEntry(buf, e));
  }
  return entries.map(e => e.name);
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

export function createUpdater({ dataDir, currentVersion, policy = loadUpdatePolicy(), fetchImpl = fetch, now = () => new Date() } = {}) {
  if (!dataDir || !currentVersion) throw fail('UPDATE_CONFIG', 'Thiếu dataDir/currentVersion cho updater.');
  const trust = validateUpdatePolicy(policy);
  const dir = path.join(dataDir, 'updates');
  const pendingFile = path.join(dataDir, 'pending-update.json');
  const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(v, null, 2), { mode: 0o600 }); fs.renameSync(t, f); };
  function getConfig() { return { url: trust.enabled ? trust.manifestUrl : '', enabled: trust.enabled, product: APP_ID, channel: trust.channel || null }; }
  function setConfig({ url }) {
    if (!trust.enabled || url !== trust.manifestUrl) throw fail('UPDATE_TRUST', 'Kênh cập nhật chỉ được cấu hình bằng trust file Personal tại thư mục ứng dụng.');
    return getConfig();
  }
  function pending() { return readJson(pendingFile); }
  function status() {
    const p = pending();
    let blocked = !trust.enabled;
    if (p && !blocked) { try { verifyManifest(p.manifest, trust.publicKeyPem); assertPackageChannel(p.manifest, trust); } catch { blocked = true; } }
    return { currentVersion, ...getConfig(), configured: trust.enabled, policy: trust.enabled ? 'personal-trusted' : 'manual-only',
      pending: p ? { version: p.version, stagedAt: p.stagedAt, blocked } : null,
      lastUpdate: readJson(path.join(dataDir, 'last-update.json')), lastFailure: readJson(path.join(dataDir, 'update-failed.json')) };
  }
  async function get(url) {
    // No redirect may leave the explicitly trusted origin, including to upstream.
    const res = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(120000) });
    if (!res.ok || res.redirected || (res.url && res.url !== url)) throw fail('UPDATE_FETCH', 'Không tải được từ đúng địa chỉ kênh Personal đã tin cậy.');
    return res;
  }
  async function check() {
    if (!trust.enabled) return { configured: false, available: false, currentVersion, reason: 'UPDATE_DISABLED' };
    const res = await get(trust.manifestUrl);
    const manifest = verifyManifest(await res.json(), trust.publicKeyPem);
    assertPackageChannel(manifest, trust);
    const available = compareVersions(manifest.version, currentVersion) > 0;
    return { configured: true, available, currentVersion, manifest: available ? manifest : { version: manifest.version } };
  }
  async function download() {
    const c = await check();
    if (!c.available) return { downloaded: false, reason: c.reason || 'up-to-date', currentVersion };
    const m = c.manifest;
    const res = await get(m.url);
    fs.mkdirSync(dir, { recursive: true });
    const final = path.join(dir, m.version + '.zip');
    assertSafeTarget(dataDir, 'updates/' + m.version + '.zip');
    const part = final + '.' + crypto.randomUUID() + '.part';
    const hash = crypto.createHash('sha256');
    let size = 0, fd;
    try {
      fd = fs.openSync(part, 'wx', 0o600);
      if (!res.body) throw fail('UPDATE_FETCH', 'Máy chủ cập nhật không trả nội dung.');
      for await (const chunk of res.body) {
        size += chunk.length;
        if (size > m.size) throw fail('UPDATE_SIZE', 'Dung lượng vượt manifest đã ký.');
        hash.update(chunk); fs.writeFileSync(fd, chunk);
      }
      fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      if (size !== m.size) throw fail('UPDATE_SIZE', 'Dung lượng không khớp manifest.');
      if (hash.digest('hex') !== m.sha256) throw fail('UPDATE_HASH', 'SHA-256 không khớp manifest đã ký.');
      fs.renameSync(part, final);
      writeJson(pendingFile, { version: m.version, file: final, sha256: m.sha256, manifest: m, stagedAt: now().toISOString() });
      return { downloaded: true, version: m.version, file: final, sha256: m.sha256 };
    } finally { if (fd !== undefined) fs.closeSync(fd); fs.rmSync(part, { force: true }); }
  }
  return { getConfig, setConfig, check, download, status, pending };
}

// A disabled/legacy pending package is preserved untouched and never applied.
// Trust is revalidated here, independently of the download/API path.
export function applyPendingUpdate({ appRoot, dataDir, currentVersion = APP_VERSION, policy = loadUpdatePolicy(appRoot), now = () => new Date(), log = () => {} } = {}) {
  const pendingFile = path.join(dataDir, 'pending-update.json');
  if (!fs.existsSync(pendingFile)) return { applied: false, reason: 'none' };
  let backedUp = [], added = [], backupDir, applying = false;
  try {
    const trust = validateUpdatePolicy(policy);
    if (!trust.enabled) return { applied: false, reason: 'UPDATE_DISABLED', message: 'Cập nhật tự động đang tắt; giữ nguyên gói chờ, không áp dụng.' };
    const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    const m = verifyManifest(pending.manifest, trust.publicKeyPem);
    assertPackageChannel(m, trust);
    if (pending.version !== m.version || pending.sha256 !== m.sha256) throw fail('UPDATE_MANIFEST', 'Pending không khớp manifest đã ký.');
    if (compareVersions(m.version, currentVersion) <= 0) throw fail('UPDATE_VERSION', 'Không áp dụng bản cũ hoặc cùng phiên bản.');
    const zipPath = path.join(dataDir, 'updates', m.version + '.zip');
    if (path.resolve(pending.file) !== path.resolve(zipPath)) throw fail('UPDATE_ZIP_PATH', 'Gói chờ nằm ngoài staging Personal.');
    assertSafeTarget(dataDir, 'updates/' + m.version + '.zip');
    if (fs.statSync(zipPath).size !== m.size || sha256File(zipPath) !== m.sha256) throw fail('UPDATE_HASH', 'Gói cập nhật đã thay đổi sau khi tải.');
    const buf = fs.readFileSync(zipPath);
    const entries = validatedEntries(buf, appRoot);
    for (const e of entries) {
      // Conservative case folding also protects Windows/macOS data directories.
      const target = path.resolve(appRoot, e.name).toLowerCase(), dataRoot = path.resolve(dataDir).toLowerCase();
      if (target === dataRoot || target.startsWith(dataRoot + path.sep)) throw fail('UPDATE_ZIP_PATH', 'Gói cập nhật không được ghi vào dữ liệu người dùng.');
    }
    // Validate ALL entries (paths, decompression, CRC) before backups or writes.
    for (const e of entries) unzipEntry(buf, e);
    backupDir = path.join(dataDir, 'backups', 'update-' + m.version + '-' + crypto.randomUUID());
    assertSafeTarget(dataDir, path.relative(dataDir, backupDir).replaceAll('\\', '/'));
    fs.mkdirSync(backupDir, { recursive: true });
    for (const e of entries) {
      const rel = e.name, target = path.join(appRoot, rel);
      if (fs.existsSync(target)) { const b = path.join(backupDir, rel); fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(target, b); backedUp.push(rel); }
      else added.push(rel);
    }
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify({ version: m.version, backedUp, added, at: now().toISOString() }, null, 2));
    applying = true;
    extractZipTo(buf, appRoot);
    fs.writeFileSync(path.join(dataDir, 'last-update.json'), JSON.stringify({ product: APP_ID, version: m.version, at: now().toISOString(), files: entries.length }, null, 2));
    fs.rmSync(pendingFile);
    applying = false;
    try { log('Đã áp dụng cập nhật Personal v' + m.version); } catch { /* logging cannot undo a completed update */ }
    return { applied: true, version: m.version, files: entries.length, backupDir };
  } catch (e) {
    if (applying) {
      try {
        for (const rel of backedUp) fs.copyFileSync(path.join(backupDir, rel), path.join(appRoot, rel));
        for (const rel of added) fs.rmSync(path.join(appRoot, rel), { force: true });
      } catch (rollbackError) { return { applied: false, reason: 'UPDATE_ROLLBACK_FAILED', message: rollbackError.message, backupDir }; }
    }
    const report = { applied: false, reason: e.code || 'UPDATE_APPLY_FAILED', message: e.message, ...(backupDir ? { backupDir } : {}) };
    // Preserve rejected pending evidence; never turn it into an unsigned package.
    try { fs.writeFileSync(path.join(dataDir, 'update-failed.json'), JSON.stringify({ ...report, at: now().toISOString() })); } catch {}
    return report;
  }
}
