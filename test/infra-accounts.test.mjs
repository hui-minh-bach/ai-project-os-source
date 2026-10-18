import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

let infra, zip;
before(async () => {
  // Nested on purpose: the app derives its tools dir from the data dir's
  // parent, so a data dir directly under os.tmpdir() would share one tools
  // folder with every other test process on this machine.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-infra-'));
  process.env.AI_PROJECT_OS_DATA_DIR = path.join(base, 'data');
  infra = await import('../src/lib/infra-tools.mjs');
  zip = await import('../src/lib/updater.mjs');
});

test('install github CLI from official-shaped zip with matching sha', async () => {
  const buf = zip.createZipBuffer({ 'bin/gh.exe': Buffer.from('FAKE-GH-BINARY'), 'LICENSE': 'x' });
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const r = await infra.installInfraTool('github', { download: async () => buf, expectedSha256: sha });
  assert.equal(r.ok, true);
  assert.equal(r.version, '2.102.0');
  const resolved = infra.resolveInfraCli('github');
  assert.equal(resolved.source, 'managed');
  assert.ok(fs.readFileSync(resolved.command).equals(Buffer.from('FAKE-GH-BINARY')));
  const st = infra.infraToolsStatus().find((t) => t.kind === 'github');
  assert.equal(st.installed, true);
  assert.equal(st.connected, false);
});

test('install refuses a zip whose sha does not match the pinned release', async () => {
  const buf = zip.createZipBuffer({ 'bin/gh.exe': 'tampered' });
  await assert.rejects(() => infra.installInfraTool('github', { download: async () => buf, expectedSha256: '0'.repeat(64) }), /SHA-256/);
});

test('install vercel runs the official npm package into the managed tools folder', async () => {
  let seenArgs = null;
  const fakeInvoke = async (cmd, args) => {
    seenArgs = args;
    const pkgDir = path.join(infra.INFRA_DIR, '..', 'node_modules', 'vercel');
    fs.mkdirSync(path.join(pkgDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'vercel', bin: { vercel: './dist/vc.js' } }));
    fs.writeFileSync(path.join(pkgDir, 'dist', 'vc.js'), '// vc');
    return { code: 0 };
  };
  const r = await infra.installInfraTool('vercel', { invoke: fakeInvoke, npmPath: '/fake/npm-cli.js' });
  assert.equal(r.ok, true);
  assert.ok(seenArgs.includes('vercel@latest'));
  const resolved = infra.resolveInfraCli('vercel');
  assert.equal(resolved.source, 'managed');
});

test('login window refuses non-Windows honestly', async () => {
  await assert.rejects(() => infra.startInfraLoginWindow('github', { platform: 'linux' }), /Windows/);
});

test('login script content drives the official CLI login command', () => {
  const content = infra.infraLoginScriptContent('github', { command: 'C:\\tools\\gh.exe', args: [] });
  assert.ok(content.includes('"auth" "login"'));
  assert.ok(content.includes('github.com'));
  assert.ok(content.includes('pause'));
  const c2 = infra.infraLoginScriptContent('supabase', { command: 'sb.exe', args: [] });
  assert.ok(c2.includes('"login"'));
});

test('login window on Windows writes the script and asks PowerShell to open it', async () => {
  let seen = null;
  const r = await infra.startInfraLoginWindow('github', { platform: 'win32', exec: async (cmd, args) => { seen = { cmd, args }; return { code: 0 }; } });
  assert.equal(r.ok, true);
  assert.equal(seen.cmd, 'powershell.exe');
  assert.ok(seen.args.join(' ').includes('Start-Process'));
  assert.ok(fs.existsSync(path.join(infra.INFRA_DIR, 'LOGIN-GITHUB-WINDOWS.cmd')));
});

test('routes + UI contract: account-link dialog is wired', () => {
  const server = fs.readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  assert.ok(server.includes('/api/infra-accounts/status'));
  assert.ok(server.includes('installInfraTool'));
  assert.ok(server.includes('startInfraLoginWindow'));
  const js = fs.readFileSync(new URL('../public/tabs/connections.js', import.meta.url), 'utf8');
  assert.ok(js.includes('data-infra-link'));
  assert.ok(js.includes('ccInfraAccountDialog'));
  assert.ok(js.includes('Liên kết tài khoản'));
});

test('connection verification uses the app-installed CLIs, not the system PATH (regression: spawn gh ENOENT)', async () => {
  const vault = await import('../src/lib/vault.mjs');
  const providers = await import('../src/lib/providers.mjs');
  vault.unlockVault('infra-fixture-pass');
  // Fake CLIs exist ONLY in the app's own tools folder, like on a customer
  // machine where the app installed them and nothing is on the system PATH.
  const ghPath = path.join(infra.INFRA_DIR, 'github', 'gh.exe');
  fs.mkdirSync(path.dirname(ghPath), { recursive: true });
  fs.writeFileSync(ghPath, '#!/bin/sh\necho octocat\n');
  fs.chmodSync(ghPath, 0o755);
  const sbPath = path.join(infra.INFRA_DIR, 'supabase', 'supabase.exe');
  fs.mkdirSync(path.dirname(sbPath), { recursive: true });
  fs.writeFileSync(sbPath, '#!/bin/sh\necho "[]"\n');
  fs.chmodSync(sbPath, 0o755);
  const vcPath = path.join(infra.INFRA_DIR, '..', 'node_modules', 'vercel', 'dist', 'vc.js');
  fs.writeFileSync(vcPath, 'console.log("vercel-user");\n');
  const gh = vault.saveConnection({ kind: 'github', name: 'GitHub CLI · octocat', meta: { authMode: 'cli' } });
  const sb = vault.saveConnection({ kind: 'supabase', name: 'Supabase CLI', meta: { authMode: 'cli' } });
  const vc = vault.saveConnection({ kind: 'vercel', name: 'Vercel CLI · vercel-user', meta: { authMode: 'cli' } });
  const oldPath = process.env.PATH;
  process.env.PATH = '';
  try {
    const r1 = await providers.testConnection(gh.id);
    assert.equal(r1.ok, true);
    assert.ok(r1.message.includes('octocat'));
    assert.ok(vault.getConnection(gh.id).meta.verifiedAt);
    const r2 = await providers.testConnection(sb.id);
    assert.equal(r2.ok, true);
    assert.ok(r2.message.includes('0 project'));
    const r3 = await providers.testConnection(vc.id);
    assert.equal(r3.ok, true);
    assert.ok(r3.message.includes('vercel-user'));
  } finally { process.env.PATH = oldPath; vault.lockVault(); }
});
