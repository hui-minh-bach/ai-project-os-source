/**
 * Local workers (Engine Hub) — heavyweight AI workers that run entirely on
 * the owner's machine: ACE-Step 1.5 (music) and FLUX.2 [klein] 4B (images).
 *
 * Rules of the house:
 *  - Nothing is bundled in the installer. A worker is downloaded on demand
 *    from PINNED artifacts (URL + size + SHA-256 in this file), verified
 *    after download, and stored under <DATA_DIR>/local-workers/<id>/.
 *  - Nothing is compiled on the user's machine: every artifact is a
 *    prebuilt binary or model weights.
 *  - A worker that is not READY answers BLOCKED when invoked — no fake
 *    success, no silent substitution. Pipeline-level fallbacks exist but
 *    are always labeled in the run journal (see resolveStoryMusic).
 *  - FLUX.2 is pinned to the [klein] 4B ONLY (Apache-2.0). The 9B and dev
 *    models carry a non-commercial license and are forbidden here.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { DATA_DIR } from './store.mjs';
import { run } from './shell.mjs';

function err(code, message) { const e = new Error(message); e.code = code; return e; }

export const WORKER_STATES = Object.freeze(['NOT_INSTALLED', 'DOWNLOADING', 'READY', 'ERROR', 'DISABLED']);
export const WORKER_STATE_LABELS = Object.freeze({
  NOT_INSTALLED: 'Chưa cài', DOWNLOADING: 'Đang tải…', READY: 'Sẵn sàng',
  ERROR: 'Lỗi', DISABLED: 'Đã tắt',
});

const SEVEN_ZR = Object.freeze({
  name: '7zr.exe', role: 'tool', platforms: ['win32'],
  url: 'https://www.7-zip.org/a/7zr.exe',
  sha256: '256feca8e274e5da655e2a284fabafd9f554365eb164862089dacd4e8276d282', size: 602624,
});

const SD_RELEASE = 'master-982-0518b34';
const SD_BASE = `https://github.com/leejet/stable-diffusion.cpp/releases/download/${SD_RELEASE}`;

export const WORKER_CATALOG = Object.freeze([
  {
    id: 'ace-step', operation: 'media.music', kind: 'download', platforms: ['win32'],
    name: 'ACE-Step 1.5 — Thợ nhạc tại chỗ', shortName: 'ACE-Step 1.5', license: 'MIT',
    purpose: 'Sinh nhạc nền cho video ngay trên máy của bạn bằng ACE-Step 1.5 (MIT) — không cần tài khoản AI, không tốn phí API. Ở lần chạy đầu, ACE-Step tự tải thêm model nhạc (khoảng 5 GB) từ Hugging Face.',
    requirements: 'Chỉ Windows · card NVIDIA hỗ trợ CUDA 12.8 (chạy bằng CPU được nhưng rất chậm) · tải gói ~2,4 GB, cộng model ở lần chạy đầu ~5 GB.',
    externalHint: 'Đã tự cài ACE-Step 1.5 ở nơi khác? Mở API server của ACE-Step (acestep-api, cổng 8001) rồi bấm “Kiểm tra bản ngoài” — app sẽ dùng luôn bản đó, không tải thêm gì.',
    artifacts: [
      SEVEN_ZR,
      {
        name: 'ACE-Step-1.5.7z', role: 'archive', extractTo: 'app',
        url: 'https://files.acemusic.ai/acemusic/win/ACE-Step-1.5.7z',
        sha256: 'bedae79f97e9193051508d41ef2c29c3dde87e41a215b67a1a839b2962bf5598', size: 2403883448,
      },
    ],
  },
  {
    id: 'flux2-klein', operation: 'image.local', kind: 'download', platforms: ['win32', 'linux', 'darwin'],
    name: 'FLUX.2 Klein 4B — Thợ ảnh tại chỗ', shortName: 'FLUX.2 Klein 4B', license: 'Apache-2.0',
    purpose: 'Sinh ảnh ngay trên máy bằng FLUX.2 [klein] 4B (Apache-2.0, bản GGUF Q4) qua sd-cli (stable-diffusion.cpp) — không cần tài khoản sinh ảnh. Chỉ dùng bản 4B; bản 9B/dev là giấy phép phi thương mại nên không có trong app.',
    requirements: 'Tải ~5,3 GB (chương trình chạy + 3 tệp model). Card ≥8 GB VRAM chạy thoải mái; dưới 8 GB máy chạy chậm — xem ghi chú năng lực ở thẻ này.',
    artifacts: [
      {
        name: 'sd-bin.zip', role: 'archive', extractTo: 'bin',
        perPlatform: {
          win32: { url: `${SD_BASE}/sd-master-0518b34-bin-win-vulkan-x64.zip`, sha256: 'c2ab91b33206beba434f739a9131916539a3d6229da153e6e0311013e6308567', size: 29463840 },
          linux: { url: `${SD_BASE}/sd-master-0518b34-bin-Linux-Ubuntu-24.04-x86_64.zip`, sha256: '929527ad778f14e52fcd2f2340c427b935eb113bca1709b3de4791a2859e6288', size: 26467471 },
          darwin: { url: `${SD_BASE}/sd-master-0518b34-bin-Darwin-macOS-26.6.2-arm64.zip`, sha256: 'b5b995203c1eed71e252d5363237325d6b45b8a64ab14911f3104b57f8c7644a', size: 36737301 },
        },
      },
      SEVEN_ZR,
      {
        name: 'flux-2-klein-4b-Q4_0.gguf', role: 'model', dest: 'models/flux-2-klein-4b-Q4_0.gguf',
        url: 'https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/main/flux-2-klein-4b-Q4_0.gguf',
        sha256: 'd1023499ef3f2f82ff7c50e6778495195c1b6cc34835741778868428111f9ff4', size: 2460378560,
      },
      {
        name: 'Qwen3-4B-Q4_K_M.gguf', role: 'model', dest: 'models/Qwen3-4B-Q4_K_M.gguf',
        url: 'https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf',
        sha256: 'f6f851777709861056efcdad3af01da38b31223a3ba26e61a4f8bf3a2195813a', size: 2497281312,
      },
      {
        name: 'flux2-vae.safetensors', role: 'model', dest: 'models/flux2-vae.safetensors',
        url: 'https://huggingface.co/Comfy-Org/flux2-klein-4B/resolve/main/split_files/vae/flux2-vae.safetensors',
        sha256: '868fe7b343cc8f3a19dbcfcafbc3d5f888802be3f89bd81b65b3621a066ce8f3', size: 336211292,
      },
    ],
  },
]);

/** Resolve the flat artifact list for one worker on one platform. */
export function workerArtifacts(def, platform = process.platform) {
  const out = [];
  for (const a of def.artifacts || []) {
    if (a.platforms && !a.platforms.includes(platform)) continue;
    if (a.perPlatform) {
      const p = a.perPlatform[platform];
      if (!p) continue;
      out.push({ name: a.name, role: a.role, extractTo: a.extractTo || null, dest: a.dest || null, url: p.url, sha256: p.sha256, size: p.size });
    } else {
      out.push({ name: a.name, role: a.role, extractTo: a.extractTo || null, dest: a.dest || null, url: a.url, sha256: a.sha256, size: a.size });
    }
  }
  return out;
}

export function workerDownloadSize(def, platform = process.platform) {
  return workerArtifacts(def, platform).reduce((s, a) => s + (a.size || 0), 0);
}

/** Capability gate for the FLUX worker, from detected VRAM (MB). */
export function fluxCapability(vramMB) {
  if (vramMB == null || !Number.isFinite(vramMB)) {
    return { tier: 'unknown', defaultEnabled: false, warning: 'Không xác định được VRAM của máy này. FLUX.2 sẽ phải đẩy model sang RAM và chạy chậm (vài chục giây–1 phút/ảnh). Worker mặc định TẮT — bật lên khi bạn chấp nhận chờ.' };
  }
  if (vramMB >= 8192) return { tier: 'ok', defaultEnabled: true, warning: null };
  return { tier: 'low', defaultEnabled: false, warning: `Máy này có khoảng ${Math.max(1, Math.round(vramMB / 1024))} GB VRAM (< 8 GB): FLUX.2 chạy chậm (vài chục giây–1 phút/ảnh), hợp cho thumbnail/ảnh lẻ. Worker mặc định TẮT.` };
}

/** Best-effort VRAM detection: nvidia-smi, then Windows CIM, else unknown. */
export async function detectVram(runImpl = run) {
  try {
    const r = await runImpl('nvidia-smi', ['--query-gpu=memory.total,name', '--format=csv,noheader,nounits'], { timeoutMs: 6000 });
    if (r.code === 0) {
      const line = String(r.stdout || '').trim().split('\n')[0] || '';
      const [mb, name] = line.split(/\s*,\s*/);
      const v = parseInt(mb, 10);
      if (Number.isFinite(v) && v > 0) return { vramMB: v, source: 'nvidia-smi', gpuName: name || null };
    }
  } catch { /* fall through */ }
  if (process.platform === 'win32') {
    try {
      const r = await runImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1) | ForEach-Object { "{0}|{1}" -f $_.AdapterRAM, $_.Name }'], { timeoutMs: 8000 });
      if (r.code === 0) {
        const [bytes, name] = String(r.stdout || '').trim().split('|');
        const v = Math.round(Number(bytes) / 1048576);
        if (Number.isFinite(v) && v > 0) return { vramMB: v, source: 'win32-cim (AdapterRAM tối đa ~4 GB)', gpuName: name || null };
      }
    } catch { /* fall through */ }
  }
  return { vramMB: null, source: 'unknown', gpuName: null };
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('data', (d) => h.update(d));
    s.on('end', () => resolve(h.digest('hex')));
    s.on('error', reject);
  });
}

function dirSizeBytes(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) total += dirSizeBytes(p);
    else if (e.isFile()) { try { total += fs.statSync(p).size; } catch { /* raced delete */ } }
  }
  return total;
}

function findFile(root, name, maxDepth = 4) {
  if (!fs.existsSync(root)) return null;
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isFile() && e.name.toLowerCase() === name.toLowerCase()) return p;
      if (e.isDirectory() && depth < maxDepth) queue.push({ dir: p, depth: depth + 1 });
    }
  }
  return null;
}

export function createLocalWorkers({
  dataDir = DATA_DIR,
  fetchImpl = globalThis.fetch,
  platform = process.platform,
  runImpl = run,
  spawnImpl = spawn,
  vramProvider = null,
  aceBaseUrl = process.env.AIOS_ACESTEP_API_URL || 'http://127.0.0.1:8001',
  catalog = WORKER_CATALOG,
  ffmpegBin = 'ffmpeg',
  acePollMs = 3000,
  aceTimeoutMs = 30 * 60000,
  fluxTimeoutMs = 20 * 60000,
} = {}) {
  const root = path.join(dataDir, 'local-workers');
  const stateFile = path.join(dataDir, 'local-workers.json');
  const inflight = new Map(); // id -> {progress:{name, downloaded, total, overallPct}}
  let aceChild = null;
  let vramCache = null;

  function loadRecords() {
    try { const j = JSON.parse(fs.readFileSync(stateFile, 'utf8')); return j && typeof j === 'object' && j.workers ? j.workers : {}; }
    catch { return {}; }
  }
  function saveRecords(records) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const tmp = stateFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ workers: records }, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, stateFile);
  }
  function record(id) { return loadRecords()[id] || null; }
  function patchRecord(id, patch) {
    const records = loadRecords();
    records[id] = { ...(records[id] || {}), ...patch };
    saveRecords(records);
    return records[id];
  }
  function def(id) {
    const d = catalog.find((w) => w.id === id);
    if (!d) throw err('WORKER_NOT_FOUND', `Worker không tồn tại: ${id}`);
    return d;
  }
  function dirOf(id) { return path.join(root, id); }

  async function vram() {
    if (!vramCache) vramCache = vramProvider ? await vramProvider() : await detectVram(runImpl);
    return vramCache;
  }

  function effectiveState(id) {
    if (inflight.has(id)) return 'DOWNLOADING';
    const rec = record(id);
    if (!rec || !rec.state || rec.state === 'NOT_INSTALLED') return 'NOT_INSTALLED';
    if (rec.state === 'READY' && rec.enabled === false) return 'DISABLED';
    return rec.state;
  }

  async function status(id) {
    const d = def(id);
    const rec = record(id) || {};
    const state = effectiveState(id);
    const dir = dirOf(id);
    const out = {
      id: d.id, operation: d.operation, name: d.name, shortName: d.shortName || d.name,
      license: d.license, purpose: d.purpose, requirements: d.requirements,
      externalHint: d.externalHint || null,
      supported: (d.platforms || []).includes(platform),
      state, stateLabel: WORKER_STATE_LABELS[state],
      enabled: rec.enabled !== false,
      installKind: rec.installKind || null,
      installedAt: rec.installedAt || null,
      lastError: rec.lastError || null,
      sizeBytes: rec.state === 'READY' || rec.state === 'ERROR' ? dirSizeBytes(dir) : 0,
      downloadSize: workerDownloadSize(d, platform),
      progress: inflight.get(id)?.progress || null,
    };
    if (id === 'flux2-klein' || d.id === 'flux2-klein') {
      const v = await vram();
      out.capability = { vramMB: v.vramMB, source: v.source, gpuName: v.gpuName, ...fluxCapability(v.vramMB) };
    }
    return out;
  }

  async function list() { return Promise.all(catalog.map((d) => status(d.id))); }

  async function downloadArtifact(id, art, onProgress) {
    const dir = dirOf(id);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const finalPath = art.role === 'archive' || art.role === 'tool'
      ? path.join(dir, '.dl', art.name)
      : path.join(dir, art.dest || art.name);
    // Resume per-artifact: an already-downloaded file with the pinned hash is kept.
    if (fs.existsSync(finalPath)) {
      const existing = fs.statSync(finalPath).size;
      if (existing === art.size && (await sha256File(finalPath)) === art.sha256) return finalPath;
    }
    fs.mkdirSync(path.dirname(finalPath), { recursive: true, mode: 0o700 });
    const part = finalPath + '.part';
    const res = await fetchImpl(art.url, { redirect: 'follow' });
    if (!res || !res.ok) throw err('WORKER_DOWNLOAD', `Tải ${art.name} thất bại (HTTP ${res ? res.status : 'không có phản hồi'}) từ ${art.url}.`);
    if (!res.body || typeof res.body.getReader !== 'function') throw err('WORKER_DOWNLOAD', `Không đọc được dữ liệu tải về cho ${art.name}.`);
    const hash = crypto.createHash('sha256');
    let downloaded = 0;
    const reader = res.body.getReader();
    const fd = fs.openSync(part, 'w');
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        hash.update(value);
        fs.writeSync(fd, value);
        downloaded += value.length;
        onProgress(art, downloaded);
      }
    } finally { fs.closeSync(fd); }
    const digest = hash.digest('hex');
    if (art.size && downloaded !== art.size) {
      fs.rmSync(part, { force: true });
      throw err('WORKER_DOWNLOAD', `Tải ${art.name} không trọn: nhận ${downloaded}/${art.size} byte. Đã xóa phần tải dở; bấm cài lại để tải tiếp.`);
    }
    if (digest !== art.sha256) {
      fs.rmSync(part, { force: true });
      throw err('WORKER_HASH', `SHA-256 của ${art.name} không khớp bản đã ghim (nhận ${digest.slice(0, 16)}…, ghim ${art.sha256.slice(0, 16)}…). Đã xóa tệp tải về — KHÔNG cài đặt. Nguồn phát hành có thể đã thay tệp; hãy báo lại lỗi này.`);
    }
    fs.renameSync(part, finalPath);
    return finalPath;
  }

  async function extractArchive(id, archivePath, art) {
    const dir = dirOf(id);
    const dest = path.join(dir, art.extractTo || 'pkg');
    fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
    if (platform === 'win32') {
      const zr = path.join(dir, '.dl', '7zr.exe');
      if (!fs.existsSync(zr)) throw err('WORKER_EXTRACT', 'Thiếu 7zr.exe để giải nén (tệp công cụ chưa tải xong).');
      const r = await runImpl(zr, ['x', '-y', `-o${dest}`, archivePath], { timeoutMs: 30 * 60000 });
      if (r.code !== 0) throw err('WORKER_EXTRACT', `Giải nén ${art.name} thất bại (${r.code}): ${String(r.stderr || r.stdout || '').slice(-300)}`);
      return dest;
    }
    const lower = archivePath.toLowerCase();
    if (lower.endsWith('.zip')) {
      const r = await runImpl('unzip', ['-o', '-q', archivePath, '-d', dest], { timeoutMs: 10 * 60000 });
      if (r.code !== 0) throw err('WORKER_EXTRACT', `Giải nén ${art.name} thất bại (${r.code}): ${String(r.stderr || r.stdout || '').slice(-300)}`);
      return dest;
    }
    if (lower.endsWith('.7z')) {
      const seven = fs.existsSync('/usr/bin/7z') ? '/usr/bin/7z' : '7z';
      const r = await runImpl(seven, ['x', '-y', `-o${dest}`, archivePath], { timeoutMs: 30 * 60000 });
      if (r.code !== 0) throw err('WORKER_EXTRACT', `Giải nén ${art.name} thất bại (${r.code}): ${String(r.stderr || r.stdout || '').slice(-300)}`);
      return dest;
    }
    throw err('WORKER_EXTRACT', `Định dạng gói chưa hỗ trợ giải nén trên ${platform}: ${art.name}`);
  }

  async function install(id) {
    const d = def(id);
    if (!(d.platforms || []).includes(platform)) throw err('WORKER_PLATFORM', `${d.name} chưa hỗ trợ hệ điều hành ${platform}.`);
    if (inflight.has(id)) throw err('WORKER_BUSY', `${d.name} đang được cài đặt.`);
    const arts = workerArtifacts(d, platform);
    const total = arts.reduce((s, a) => s + (a.size || 0), 0);
    const flight = { progress: { name: null, downloaded: 0, total, overallPct: 0 } };
    inflight.set(id, flight);
    patchRecord(id, { lastError: null });
    let baseDone = 0;
    try {
      const downloadedPaths = new Map();
      for (const art of arts) {
        flight.progress.name = art.name;
        const p = await downloadArtifact(id, art, (a, n) => {
          flight.progress.downloaded = baseDone + n;
          flight.progress.overallPct = total ? Math.min(100, Math.floor((flight.progress.downloaded / total) * 100)) : 0;
        });
        baseDone += art.size || 0;
        flight.progress.downloaded = baseDone;
        downloadedPaths.set(art.name, p);
      }
      for (const art of arts) {
        if (art.role !== 'archive') continue;
        flight.progress.name = `Giải nén ${art.name}`;
        await extractArchive(id, downloadedPaths.get(art.name), art);
        // The extracted tree is the install; keeping the multi-GB archive
        // too would double the disk cost for no benefit.
        fs.rmSync(downloadedPaths.get(art.name), { force: true });
      }
      const dir = dirOf(id);
      const extra = {};
      if (id === 'ace-step') {
        const entry = findFile(path.join(dir, 'app'), 'start_api_server.bat', 4);
        if (!entry) throw err('WORKER_INSTALL', 'Không tìm thấy start_api_server.bat trong gói ACE-Step đã tải — gói phát hành có thể đã đổi cấu trúc.');
        extra.entryDir = path.relative(dir, path.dirname(entry));
        // The portable launcher self-updates the ACE-Step code from GitHub
        // on every start when CHECK_UPDATE=true. Pin it off at install time
        // so the worker the owner installed is the worker that runs.
        try {
          const batText = fs.readFileSync(entry, 'utf8');
          if (/^set CHECK_UPDATE=true$/m.test(batText)) fs.writeFileSync(entry, batText.replace(/^set CHECK_UPDATE=true$/m, 'set CHECK_UPDATE=false'));
        } catch { /* best effort — the server still runs with upstream defaults */ }
      }
      if (id === 'flux2-klein') {
        const bin = findFile(path.join(dir, 'bin'), platform === 'win32' ? 'sd-cli.exe' : 'sd-cli', 4);
        if (!bin) throw err('WORKER_INSTALL', 'Không tìm thấy sd-cli trong gói stable-diffusion.cpp đã tải.');
        extra.binPath = path.relative(dir, bin);
        if (platform !== 'win32') { try { fs.chmodSync(bin, 0o755); } catch { /* best effort */ } }
      }
      const enabledDefault = id === 'flux2-klein' ? fluxCapability((await vram()).vramMB).defaultEnabled : true;
      patchRecord(id, { state: 'READY', installKind: 'download', installedAt: new Date().toISOString(), lastError: null, enabled: enabledDefault, ...extra });
      inflight.delete(id); // status() must not see this install as still running
      return status(id);
    } catch (e) {
      patchRecord(id, { state: 'ERROR', lastError: String(e.message || e).slice(0, 600) });
      throw e;
    } finally { inflight.delete(id); }
  }

  /** Start an install without blocking the caller (UI polls status). */
  function startInstall(id) {
    if (inflight.has(id)) return status(id);
    const p = install(id);
    p.catch(() => { /* error is persisted on the worker record */ });
    return status(id);
  }

  async function remove(id) {
    const d = def(id);
    if (inflight.has(id)) throw err('WORKER_BUSY', `${d.name} đang được cài đặt — chờ tải xong rồi gỡ.`);
    if (id === 'ace-step') stopAceServer();
    fs.rmSync(dirOf(id), { recursive: true, force: true });
    const records = loadRecords();
    delete records[id];
    saveRecords(records);
    return status(id);
  }

  async function setEnabled(id, enabled) {
    const st = effectiveState(id);
    if (st !== 'READY' && st !== 'DISABLED') throw err('WORKER_STATE', `${def(id).name} chưa sẵn sàng để bật/tắt (trạng thái: ${st}).`);
    patchRecord(id, { enabled: Boolean(enabled) });
    return status(id);
  }

  /* ---------- ACE-Step (media.music) ---------- */

  async function aceHealth(base = aceBaseUrl, timeoutMs = 2500) {
    try {
      const res = await fetchImpl(`${base}/health`, { signal: AbortSignal.timeout(timeoutMs) });
      return Boolean(res && res.ok);
    } catch { return false; }
  }

  /** Adopt a user-installed / already-running ACE-Step API as the worker. */
  async function adoptExternal(id) {
    if (id !== 'ace-step') throw err('WORKER_INPUT', 'Chỉ ACE-Step hỗ trợ dùng bản cài ngoài.');
    if (!(await aceHealth())) throw err('WORKER_EXTERNAL', `Chưa thấy ACE-Step API trả lời ở ${aceBaseUrl}. Hãy mở ACE-Step (acestep-api / start_api_server.bat) trước, rồi bấm kiểm tra lại.`);
    patchRecord(id, { state: 'READY', installKind: 'external', installedAt: new Date().toISOString(), lastError: null, enabled: true });
    return status(id);
  }

  function stopAceServer() {
    if (!aceChild) return;
    try {
      if (platform === 'win32' && aceChild.pid) spawn('taskkill.exe', ['/PID', String(aceChild.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else aceChild.kill('SIGKILL');
    } catch { /* best effort */ }
    aceChild = null;
  }

  async function ensureAceServer(rec) {
    if (await aceHealth()) return;
    if (rec.installKind !== 'download') throw err('BLOCKED_WORKER', 'ACE-Step API chưa chạy. Hãy mở ACE-Step (bản ngoài) rồi thử lại.');
    if (platform !== 'win32' || !rec.entryDir) throw err('BLOCKED_WORKER', 'Chưa khởi động được ACE-Step API từ bản cài trong app.');
    const dir = dirOf('ace-step');
    const bat = path.join(dir, rec.entryDir, 'start_api_server.bat');
    if (!fs.existsSync(bat)) throw err('BLOCKED_WORKER', 'Không tìm thấy start_api_server.bat trong bản cài ACE-Step.');
    if (!aceChild) {
      // The portable start_api_server.bat pins HOST/PORT (127.0.0.1:8001)
      // and ACESTEP_INIT_LLM=auto itself — auto means DiT-only on <=6 GB
      // VRAM, which is exactly the low-VRAM mode this worker targets. The
      // default aceBaseUrl matches that port; AIOS_ACESTEP_API_URL exists
      // for external installs listening elsewhere.
      aceChild = spawnImpl('cmd.exe', ['/c', bat], {
        cwd: path.dirname(bat), windowsHide: true, stdio: 'ignore',
        env: { ...process.env },
      });
      aceChild.on('error', () => { aceChild = null; });
      aceChild.on('exit', () => { aceChild = null; });
    }
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      if (await aceHealth(aceBaseUrl, 2000)) return;
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw err('WORKER_RUNTIME', 'ACE-Step API không sẵn sàng sau 4 phút khởi động. Mở Engine Hub xem lỗi, hoặc chạy start_api_server.bat thủ công để xem thông báo của ACE-Step.');
  }

  async function generateMusic({ prompt, tags, durationSec = 60, instrumental = true, outputBase } = {}) {
    const st = await status('ace-step');
    if (st.state !== 'READY') throw err('BLOCKED_WORKER', `ACE-Step chưa sẵn sàng (trạng thái: ${st.stateLabel}). Vào Engine Hub để cài đặt hoặc bật worker trước. Không thay bằng nhạc khác.`);
    const text = String(tags || prompt || '').trim();
    if (!text) throw err('WORKER_INPUT', 'Cần mô tả/tags cho bản nhạc.');
    if (!outputBase) throw err('WORKER_INPUT', 'Thiếu đường dẫn tệp nhạc đầu ra.');
    const rec = record('ace-step');
    await ensureAceServer(rec);
    const base = aceBaseUrl;
    const submitRes = await fetchImpl(`${base}/release_task`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: text, lyrics: instrumental ? '' : undefined, audio_duration: Math.max(10, Math.min(600, Math.round(durationSec) || 60)), instrumental: Boolean(instrumental), batch_size: 1 }),
    });
    const submit = await submitRes.json().catch(() => null);
    const taskId = submit?.data?.task_id || submit?.data?.taskId || submit?.task_id;
    if (!submitRes.ok || !taskId) throw err('WORKER_RUNTIME', `ACE-Step từ chối tạo bản nhạc (HTTP ${submitRes.status}): ${String(submit?.error || submit?.message || 'không rõ lỗi').slice(0, 300)}`);
    const deadline = Date.now() + aceTimeoutMs;
    let resultEntry = null;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, acePollMs));
      const q = await fetchImpl(`${base}/query_result`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ task_id_list: [taskId] }) });
      const qj = await q.json().catch(() => null);
      const item = Array.isArray(qj?.data) ? qj.data[0] : qj?.data;
      if (!item) continue;
      if (item.status === 1) {
        resultEntry = typeof item.result === 'string' ? JSON.parse(item.result || '[]')[0] : (Array.isArray(item.result) ? item.result[0] : item.result);
        break;
      }
      if (item.status === 2) throw err('WORKER_RUNTIME', `ACE-Step tạo nhạc thất bại: ${String(item.result || item.error || 'không rõ lỗi').slice(0, 300)}`);
    }
    if (!resultEntry || !resultEntry.file) throw err('WORKER_RUNTIME', 'ACE-Step không trả tệp nhạc trong thời gian cho phép (30 phút — lần đầu ACE-Step còn phải tải model).');
    const fileUrl = String(resultEntry.file).startsWith('http') ? String(resultEntry.file) : `${base}${resultEntry.file}`;
    const audioRes = await fetchImpl(fileUrl);
    if (!audioRes.ok) throw err('WORKER_RUNTIME', `Không tải được tệp nhạc từ ACE-Step (HTTP ${audioRes.status}).`);
    const bytes = Buffer.from(await audioRes.arrayBuffer());
    if (bytes.length < 1000) throw err('WORKER_RUNTIME', 'ACE-Step trả tệp nhạc rỗng/không hợp lệ. Không lưu tệp giả.');
    const ext = /\.flac(\?|$)/i.test(fileUrl) ? '.flac' : /\.wav(\?|$)/i.test(fileUrl) ? '.wav' : '.mp3';
    const file = outputBase.replace(/\.[a-z0-9]+$/i, '') + ext;
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, bytes, { mode: 0o600 });
    return {
      file, bytes: bytes.length,
      provenance: {
        worker: 'ace-step', workerName: 'ACE-Step 1.5', installKind: rec.installKind || 'download',
        operation: 'media.music', model: resultEntry.dit_model || 'acestep-v15-turbo', lmModel: resultEntry.lm_model || null,
        params: { prompt: text, durationSec: Math.round(durationSec) || 60, instrumental: Boolean(instrumental) },
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /* ---------- FLUX.2 (image.local) ---------- */

  async function generateImage({ prompt, width = 1024, height = 1024, seed, outputBase } = {}) {
    const st = await status('flux2-klein');
    if (st.state !== 'READY') throw err('BLOCKED_WORKER', `FLUX.2 chưa sẵn sàng (trạng thái: ${st.stateLabel}). Vào Engine Hub để cài đặt hoặc bật worker trước. Không thay bằng nguồn ảnh khác.`);
    const text = String(prompt || '').trim();
    if (!text || text.length > 4000) throw err('WORKER_INPUT', 'Mô tả ảnh cần 1–4.000 ký tự.');
    if (!outputBase) throw err('WORKER_INPUT', 'Thiếu đường dẫn tệp ảnh đầu ra.');
    const rec = record('flux2-klein');
    const dir = dirOf('flux2-klein');
    const bin = rec.binPath ? path.join(dir, rec.binPath) : findFile(path.join(dir, 'bin'), platform === 'win32' ? 'sd-cli.exe' : 'sd-cli', 4);
    if (!bin || !fs.existsSync(bin)) throw err('BLOCKED_WORKER', 'Không tìm thấy sd-cli trong bản cài FLUX.2. Hãy gỡ worker rồi cài lại ở Engine Hub.');
    const w = Math.max(256, Math.min(2048, Math.round(width) || 1024));
    const h = Math.max(256, Math.min(2048, Math.round(height) || 1024));
    const file = outputBase.replace(/\.[a-z0-9]+$/i, '') + '.png';
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const args = [
      '--diffusion-model', path.join(dir, 'models', 'flux-2-klein-4b-Q4_0.gguf'),
      '--vae', path.join(dir, 'models', 'flux2-vae.safetensors'),
      '--llm', path.join(dir, 'models', 'Qwen3-4B-Q4_K_M.gguf'),
      '-p', text, '--steps', '4', '--cfg-scale', '1.0', '--sampling-method', 'euler', '--diffusion-fa',
      '-W', String(w), '-H', String(h),
    ];
    if (Number.isFinite(seed)) args.push('-s', String(Math.trunc(seed)));
    const tier = st.capability?.tier;
    if (tier === 'low' || tier === 'unknown') args.push('--offload-to-cpu');
    args.push('-o', file);
    const r = await runImpl(bin, args, { timeoutMs: fluxTimeoutMs, cwd: path.dirname(bin) });
    if (r.code !== 0 || !fs.existsSync(file)) {
      throw err('WORKER_RUNTIME', `sd-cli sinh ảnh thất bại (${r.timedOut ? 'quá thời gian' : 'mã ' + r.code}): ${String(r.stderr || r.stdout || '').slice(-300)}`);
    }
    const head = fs.readFileSync(file).subarray(0, 4);
    if (!head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) throw err('WORKER_RUNTIME', 'sd-cli không trả ảnh PNG hợp lệ. Không lưu tệp giả.');
    const bytes = fs.statSync(file).size;
    return {
      file, bytes,
      provenance: {
        worker: 'flux2-klein', workerName: 'FLUX.2 [klein] 4B', operation: 'image.local',
        model: 'FLUX.2 [klein] 4B GGUF Q4_0', runner: `stable-diffusion.cpp ${SD_RELEASE}`,
        params: { prompt: text, width: w, height: h, seed: Number.isFinite(seed) ? Math.trunc(seed) : null, steps: 4, offloadToCpu: tier === 'low' || tier === 'unknown' },
        vramTier: tier || 'unknown', generatedAt: new Date().toISOString(),
      },
    };
  }

  /* ---------- Synthesized fallback bed + pipeline music resolution ---------- */

  async function synthesizeMusicBed({ outputFile, seconds = 60 } = {}) {
    if (!outputFile) throw err('WORKER_INPUT', 'Thiếu đường dẫn tệp nhạc nền.');
    const dur = Math.max(5, Math.min(600, Math.round(seconds) || 60));
    fs.mkdirSync(path.dirname(outputFile), { recursive: true, mode: 0o700 });
    const fadeOutStart = Math.max(1, dur - 3);
    const filter = `[0:a][1:a][2:a]amix=inputs=3:normalize=1,volume=0.45,lowpass=f=1100,afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=3`;
    const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
      '-f', 'lavfi', '-i', `sine=frequency=261.63:duration=${dur}`,
      '-f', 'lavfi', '-i', `sine=frequency=329.63:duration=${dur}`,
      '-f', 'lavfi', '-i', `sine=frequency=392.00:duration=${dur}`,
      '-filter_complex', filter, '-c:a', 'aac', '-b:a', '96k', outputFile];
    const r = await runImpl(ffmpegBin, args, { timeoutMs: 120000 });
    if (r.code !== 0 || !fs.existsSync(outputFile)) throw err('WORKER_RUNTIME', `Không tạo được nhạc nền tổng hợp (${r.code}): ${String(r.stderr || '').slice(-300)}`);
    return { file: outputFile, bytes: fs.statSync(outputFile).size, source: 'synthesized' };
  }

  /**
   * Decide the music for one story pipeline run. Bound to ACE-Step and the
   * worker is READY → real ACE-Step generation with provenance. Otherwise
   * the app's synthesized bed, ALWAYS labeled — detail.fallbackFrom/reason
   * say exactly why ACE-Step was not used. Never throws for music reasons:
   * worst case returns {file:null, detail:{source:'none', …}}.
   */
  async function resolveStoryMusic({ musicSource, title, outputBase, seconds = 75 } = {}) {
    const wantAce = musicSource === 'ace-step';
    if (wantAce) {
      const st = await status('ace-step');
      if (st.state === 'READY') {
        try {
          const made = await generateMusic({
            prompt: `${String(title || 'Video').slice(0, 120)} — nhạc nền điện ảnh không lời, nhẹ nhàng, ấm áp`,
            tags: 'cinematic, instrumental, calm, background',
            durationSec: seconds, instrumental: true, outputBase,
          });
          return { file: made.file, detail: { source: 'ace-step', worker: 'ace-step', model: made.provenance.model, installKind: made.provenance.installKind } };
        } catch (e) {
          const bed = await synthesizeMusicBed({ outputFile: String(outputBase || '').replace(/\.[a-z0-9]+$/i, '') + '-bed.m4a', seconds }).catch(() => null);
          return { file: bed?.file || null, detail: { source: 'synthesized', fallbackFrom: 'ace-step', reason: e.code || 'WORKER_ERROR', message: String(e.message || e).slice(0, 200) } };
        }
      }
      const bed = await synthesizeMusicBed({ outputFile: String(outputBase || '').replace(/\.[a-z0-9]+$/i, '') + '-bed.m4a', seconds }).catch(() => null);
      return { file: bed?.file || null, detail: { source: 'synthesized', fallbackFrom: 'ace-step', reason: 'WORKER_NOT_READY', workerState: st.state } };
    }
    const bed = await synthesizeMusicBed({ outputFile: String(outputBase || '').replace(/\.[a-z0-9]+$/i, '') + '-bed.m4a', seconds }).catch(() => null);
    return { file: bed?.file || null, detail: { source: 'synthesized' } };
  }

  return {
    catalog, status, list, install, startInstall, remove, setEnabled,
    adoptExternal, aceHealth, generateMusic, generateImage,
    synthesizeMusicBed, resolveStoryMusic, stopAceServer,
    _record: record, _dirOf: dirOf,
  };
}

export const localWorkers = createLocalWorkers();
