import { run } from './shell.mjs';
import { saveConnection, findConnectionByKind } from './vault.mjs';
import { resolveInfraCli, INFRA_TOOLS } from './infra-tools.mjs';

// Verify an infrastructure CLI session that already exists on this machine
// (created through the app's "Liên kết tài khoản" login window, or by the
// user in their own terminal) and store it as a Vault connection. Nothing is
// marked connected until the vendor CLI itself confirms who is logged in.
export async function connectCli(kind) {
  let resolved;
  try { resolved = resolveInfraCli(kind); }
  catch { throw new Error(`Chưa cài ${INFRA_TOOLS[kind]?.label || 'CLI'}. Mở hộp thoại "Liên kết tài khoản" ở thẻ dịch vụ và bấm Cài CLI.`); }
  const call = (args, timeoutMs) => run(resolved.command, [...resolved.args, ...args], { timeoutMs, inheritEnv: false });
  if (kind === 'github') {
    const status = await call(['auth', 'status'], 15000); if (status.code !== 0) throw new Error('GitHub CLI chưa đăng nhập. Bấm "Mở đăng nhập chính thức" trong hộp thoại Liên kết tài khoản, hoặc chạy: gh auth login');
    const who = await call(['api', 'user', '--jq', '[.id,.login]|@tsv'], 15000); if (who.code !== 0) throw new Error('Không đọc được tài khoản GitHub CLI.');
    const [userId, login] = who.stdout.trim().split(/\t+/); if (!login) throw new Error('GitHub CLI không trả thông tin tài khoản hợp lệ.');
    return saveConnection({ id: findConnectionByKind(kind)?.id, kind: 'github', name: `GitHub CLI · ${login}`, meta: { authMode: 'cli', verifiedAt: new Date().toISOString(), login, userId: userId || '', noreplyEmail: userId ? `${userId}+${login}@users.noreply.github.com` : '' } });
  }
  if (kind === 'vercel') {
    const who = await call(['whoami'], 20000); if (who.code !== 0) throw new Error('Vercel CLI chưa đăng nhập. Bấm "Mở đăng nhập chính thức" trong hộp thoại Liên kết tài khoản, hoặc chạy: vercel login');
    const login = who.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1); if (!login) throw new Error('Vercel CLI không trả tài khoản hợp lệ.');
    return saveConnection({ id: findConnectionByKind(kind)?.id, kind: 'vercel', name: `Vercel CLI · ${login}`, meta: { authMode: 'cli', verifiedAt: new Date().toISOString(), login } });
  }
  if (kind === 'supabase') {
    const r = await call(['projects', 'list', '--output', 'json'], 30000); if (r.code !== 0) throw new Error('Supabase CLI chưa đăng nhập hoặc token thiếu quyền. Bấm "Mở đăng nhập chính thức" trong hộp thoại Liên kết tài khoản, hoặc chạy: supabase login');
    const rows = JSON.parse(r.stdout); if (!Array.isArray(rows)) throw new Error('Supabase CLI trả dữ liệu không hợp lệ.');
    return saveConnection({ id: findConnectionByKind(kind)?.id, kind: 'supabase', name: 'Supabase CLI', meta: { authMode: 'cli', verifiedAt: new Date().toISOString(), management: true, projects: rows.map(p => ({ id: String(p.id || ''), name: String(p.name || '') })) } });
  }
  throw new Error('CLI connection không hỗ trợ.');
}
