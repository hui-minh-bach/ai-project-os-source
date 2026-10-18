// Infrastructure CLI account linking (GitHub / Vercel / Supabase).
//
// Mirrors the AI-account pattern used for ChatGPT/Claude/Gemini: the app
// itself installs the vendor's official CLI into the per-user tools folder,
// opens the vendor's official login in a visible window, then verifies the
// resulting session by asking the CLI who is logged in and only then stores
// a Vault connection. No passwords or tokens ever pass through the app UI.
//
// Binary CLIs (gh, supabase) are pinned to an official GitHub release and
// verified against the SHA-256 published in that release's checksum file
// before anything is extracted. Vercel ships as an official npm package and
// is installed next to the managed AI CLIs.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TOOLS_DIR, npmCliPath } from './managed-cli.mjs';
import { run } from './shell.mjs';
import { listZipEntries, extractZipTo } from './updater.mjs';
import { findConnectionByKind } from './vault.mjs';

export const INFRA_DIR = path.join(TOOLS_DIR, 'infra-cli');

export const INFRA_TOOLS = Object.freeze({
  github: {
    label: 'GitHub CLI (gh)', kind: 'binary', version: '2.102.0',
    url: 'https://github.com/cli/cli/releases/download/v2.102.0/gh_2.102.0_windows_amd64.zip',
    sha256: 'ae64e556ecc240b200f7eba60d550e4bb60d78e860e69dd88c449405b86067f4',
    zipEntry: 'bin/gh.exe', exeName: 'gh.exe', binName: 'gh',
    loginArgs: ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web'],
    loginHint: 'Trình duyệt sẽ mở trang GitHub: đăng nhập và cấp quyền cho GitHub CLI trong cửa sổ đó.',
  },
  supabase: {
    label: 'Supabase CLI', kind: 'binary', version: '2.121.0',
    url: 'https://github.com/supabase/cli/releases/download/v2.121.0/supabase_2.121.0_windows_amd64.zip',
    sha256: '2606459be86e12e03fb6f6b9aa12a02aa00cfe21374857ec837a09c70b837eca',
    zipEntry: 'supabase.exe', exeName: 'supabase.exe', binName: 'supabase',
    loginArgs: ['login'],
    loginHint: 'Trình duyệt sẽ mở trang Supabase cấp mã truy cập: sao chép mã đó và dán vào cửa sổ đăng nhập đang chờ.',
  },
  vercel: {
    label: 'Vercel CLI', kind: 'npm', packageSpec: 'vercel@latest', packageName: 'vercel',
    loginArgs: ['login'],
    loginHint: 'Trình duyệt sẽ mở trang Vercel: đăng nhập và bấm cấp quyền cho Vercel CLI.',
  },
});

const cleanKind = (k) => { if (!Object.hasOwn(INFRA_TOOLS, k)) throw new Error('Dịch vụ hạ tầng không hỗ trợ liên kết CLI.'); return k; };

// Resolve an npm package's declared JS bin inside a node_modules folder,
// following the same safety rules as managed-cli (name must match, bin must
// be a .js file inside the package, no symlink escapes).
function npmPackageEntry(nodeModules, packageName, binNames) {
  const pkg = path.join(nodeModules, ...packageName.split('/'));
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
    if (manifest.name !== packageName) return null;
    const bins = typeof manifest.bin === 'string' ? { [packageName]: manifest.bin } : (manifest.bin || {});
    for (const name of binNames) {
      const bin = bins[name];
      if (typeof bin !== 'string' || !/^([a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.(js|mjs|cjs)$/.test(bin)) continue;
      const actual = path.resolve(pkg, bin);
      const relative = path.relative(pkg, actual);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(actual).isFile()) continue;
      if (!fs.realpathSync(actual).startsWith(fs.realpathSync(pkg) + path.sep)) continue;
      return actual;
    }
  } catch { /* not installed here */ }
  return null;
}

export function resolveInfraCli(kind, { env = process.env, platform = process.platform } = {}) {
  kind = cleanKind(kind);
  const info = INFRA_TOOLS[kind];
  if (info.kind === 'binary') {
    const managed = path.join(INFRA_DIR, kind, info.exeName);
    if (fs.existsSync(managed)) return { command: managed, args: [], source: 'managed' };
    const exe = platform === 'win32' ? info.binName + '.exe' : info.binName;
    for (const dir of String(env.PATH || env.Path || '').split(platform === 'win32' ? ';' : path.delimiter).filter(Boolean)) {
      const candidate = path.join(dir, exe);
      try { fs.accessSync(candidate, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK); return { command: candidate, args: [], source: 'system' }; } catch { /* keep looking */ }
    }
    throw new Error(`Chưa cài ${info.label}. Bấm "Cài CLI" trong hộp thoại Liên kết tài khoản.`);
  }
  // npm-distributed CLI (Vercel): prefer the copy the app installed.
  const managedEntry = npmPackageEntry(path.join(TOOLS_DIR, 'node_modules'), info.packageName, ['vercel', 'vc']);
  if (managedEntry) return { command: process.execPath, args: [managedEntry], source: 'managed' };
  for (const dir of String(env.PATH || env.Path || '').split(platform === 'win32' ? ';' : path.delimiter).filter(Boolean)) {
    const entry = npmPackageEntry(path.join(dir, 'node_modules'), info.packageName, ['vercel', 'vc']);
    if (entry) return { command: process.execPath, args: [entry], source: 'system' };
  }
  // Last resort: a shim on PATH (vercel.cmd on Windows) — only claimed when
  // the shim file is actually there. Verification still decides connection.
  const shim = platform === 'win32' ? 'vercel.cmd' : 'vercel';
  for (const dir of String(env.PATH || env.Path || '').split(platform === 'win32' ? ';' : path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, shim);
    try { fs.accessSync(candidate, platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK); return { command: candidate, args: [], source: 'path' }; } catch { /* keep looking */ }
  }
  throw new Error(`Chưa cài ${info.label}. Bấm "Cài CLI" trong hộp thoại Liên kết tài khoản.`);
}

export function infraToolsStatus() {
  return Object.keys(INFRA_TOOLS).map((kind) => {
    const info = INFRA_TOOLS[kind];
    let installed = false, source = null;
    try { const r = resolveInfraCli(kind); installed = true; source = r.source; } catch { /* not installed */ }
    const c = findConnectionByKind(kind);
    return {
      kind, label: info.label, installed, source,
      connected: Boolean(c),
      connectionName: c?.name || '',
      login: c?.meta?.login || '',
      authMode: c?.meta?.authMode || '',
      verifiedAt: c?.meta?.verifiedAt || '',
    };
  });
}

async function downloadBytes(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Không tải được gói CLI chính thức (HTTP ${res.status}). Kiểm tra mạng rồi thử lại.`);
  return Buffer.from(await res.arrayBuffer());
}

let installingInfra = false;
export async function installInfraTool(kind, deps = {}) {
  kind = cleanKind(kind);
  const info = INFRA_TOOLS[kind];
  if (installingInfra) throw new Error('Một CLI hạ tầng khác đang được cài.');
  installingInfra = true;
  try {
    if (info.kind === 'npm') {
      const invoke = deps.invoke || run;
      fs.mkdirSync(TOOLS_DIR, { recursive: true, mode: 0o700 });
      const npm = deps.npmPath || npmCliPath();
      const result = await invoke(process.execPath, [npm, 'install', '--prefix', TOOLS_DIR, '--no-audit', '--no-fund', '--omit=dev', info.packageSpec], { cwd: TOOLS_DIR, timeoutMs: 240000, inheritEnv: false, env: { npm_config_update_notifier: 'false' } });
      if (result.code !== 0 || result.timedOut) throw new Error('Không cài được Vercel CLI từ npm chính thức. Kiểm tra mạng hoặc quyền ghi thư mục người dùng.');
      if (!npmPackageEntry(path.join(TOOLS_DIR, 'node_modules'), info.packageName, ['vercel', 'vc'])) throw new Error('Vercel CLI cài xong nhưng thiếu tệp khởi động mong đợi. Đã chặn chạy.');
      return { ok: true, kind, installed: true, source: 'managed', message: `Đã cài ${info.label} trong thư mục người dùng. Tiếp tục bước đăng nhập chính thức.` };
    }
    const bytes = deps.download ? await deps.download(info.url) : await downloadBytes(info.url);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    const expected = String(deps.expectedSha256 || info.sha256).toLowerCase();
    if (digest !== expected) throw new Error('Mã SHA-256 của gói CLI tải về không khớp bản phát hành chính thức. Đã hủy cài đặt.');
    const entries = listZipEntries(bytes);
    const entry = entries.find((e) => e.name === info.zipEntry) || entries.find((e) => e.name.endsWith('/' + info.exeName));
    if (!entry) throw new Error('Gói CLI chính thức không chứa tệp chạy mong đợi. Đã hủy cài đặt.');
    const staging = path.join(INFRA_DIR, kind + '-staging');
    fs.rmSync(staging, { recursive: true, force: true });
    try {
      extractZipTo(bytes, staging);
      const extracted = path.join(staging, ...entry.name.split('/'));
      if (!fs.existsSync(extracted)) throw new Error('Gói CLI chính thức không chứa tệp chạy mong đợi. Đã hủy cài đặt.');
      const dir = path.join(INFRA_DIR, kind);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const target = path.join(dir, info.exeName);
      fs.copyFileSync(extracted, target);
      if (process.platform !== 'win32') try { fs.chmodSync(target, 0o755); } catch { /* best effort */ }
    } finally { fs.rmSync(staging, { recursive: true, force: true }); }
    return { ok: true, kind, version: info.version, installed: true, source: 'managed', message: `Đã cài ${info.label} ${info.version} (đã đối chiếu SHA-256 với bản phát hành chính thức). Tiếp tục bước đăng nhập chính thức.` };
  } finally { installingInfra = false; }
}

const LOGIN_TITLES = { github: 'GitHub', vercel: 'Vercel', supabase: 'Supabase' };
export function infraLoginScriptContent(kind, resolved) {
  kind = cleanKind(kind);
  const info = INFRA_TOOLS[kind];
  const tokens = [resolved.command, ...(resolved.args || []), ...info.loginArgs];
  const cmdline = tokens.map((t) => `"${String(t).replaceAll('"', '')}"`).join(' ');
  return [
    '@echo off',
    `title AI Project OS - Dang nhap ${LOGIN_TITLES[kind]}`,
    'echo ============================================================',
    `echo  Dang nhap ${LOGIN_TITLES[kind]} chinh thuc cho AI Project OS`,
    'echo ============================================================',
    `echo  ${info.loginHint.replaceAll('%', '%%')}`,
    'echo  Dang nhap xong, quay lai AI Project OS va bam:',
    'echo  "Kiem tra ^& tao ket noi" trong hop thoai Lien ket tai khoan.',
    'echo.',
    cmdline,
    'echo.',
    'echo Da chay xong lenh dang nhap. Neu trinh duyet chua mo,',
    'echo hay chay lai buoc Mo dang nhap trong AI Project OS.',
    'pause',
    '',
  ].join('\r\n');
}

export async function startInfraLoginWindow(kind, { platform = process.platform, exec = run, resolve = resolveInfraCli } = {}) {
  kind = cleanKind(kind);
  if (platform !== 'win32') throw new Error('Trên Windows dùng nút Mở đăng nhập; trên máy khác hãy chạy lệnh đăng nhập của CLI chính thức trong Terminal rồi bấm Kiểm tra & tạo kết nối.');
  const resolved = resolve(kind); // Fail immediately if the CLI is not installed.
  fs.mkdirSync(INFRA_DIR, { recursive: true, mode: 0o700 });
  const script = path.join(INFRA_DIR, `LOGIN-${kind.toUpperCase()}-WINDOWS.cmd`);
  fs.writeFileSync(script, infraLoginScriptContent(kind, resolved));
  const command = `Start-Process -FilePath "${script}" -WorkingDirectory "${INFRA_DIR}"`;
  const r = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { timeoutMs: 15000, inheritEnv: false });
  if (r.code !== 0) throw new Error(`Không mở được cửa sổ đăng nhập. Hãy chạy tệp ${path.basename(script)} trong thư mục công cụ của AI Project OS.`);
  return { ok: true, kind, message: 'Cửa sổ đăng nhập chính thức đã được mở. Hoàn tất đăng nhập trong cửa sổ đó, rồi quay lại bấm "Kiểm tra & tạo kết nối".' };
}
