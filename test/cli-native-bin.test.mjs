// Regression tests for the 2026-10-20 Windows field report: Claude Code 2.x
// ships a native bin/claude.exe (no cli.js), Antigravity CLI can land in the
// WinGet Packages payload folder, and the desktop IDE is not the CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

test('managed Claude Code 2.x native-bin layout installs and resolves to the exe directly', async () => {
  const f = isolatedRuntime('native-claude');
  try {
    const m = await f.import('src/lib/managed-cli.mjs');
    const npmPath = path.join(f.root, 'npm-cli.js');
    fs.writeFileSync(npmPath, '// fake npm');
    const installed = await m.installManagedCli('claude', {
      npmPath,
      invoke: async () => {
        const pkg = path.join(m.TOOLS_DIR, 'node_modules', '@anthropic-ai', 'claude-code');
        fs.mkdirSync(path.join(pkg, 'bin'), { recursive: true });
        fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@anthropic-ai/claude-code', bin: { claude: 'bin/claude.exe' } }));
        fs.writeFileSync(path.join(pkg, 'bin', 'claude.exe'), 'MZ-fixture');
        return { code: 0, stdout: '', stderr: '' };
      },
    });
    assert.equal(installed.ok, true);
    const r = m.resolveCli('claude', { env: { PATH: '' }, platform: 'win32' });
    assert.equal(r.source, 'managed');
    assert.match(r.command, /claude\.exe$/);
    assert.deepEqual(r.args, []);
    assert.match(m.managedEntry('claude'), /claude\.exe$/);
  } finally { f.cleanup(); }
});

test('system Claude Code native installer in %USERPROFILE%\\.local\\bin is found despite stale PATH', async () => {
  const f = isolatedRuntime('native-claude-sys');
  try {
    const m = await f.import('src/lib/managed-cli.mjs');
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-home-'));
    try {
      const binDir = path.join(home, '.local', 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      fs.writeFileSync(path.join(binDir, 'claude.exe'), 'MZ-fixture');
      const r = m.resolveCli('claude', { env: { PATH: '', USERPROFILE: home }, platform: 'win32' });
      assert.equal(r.source, 'system');
      assert.match(r.command, /claude\.exe$/);
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
  } finally { f.cleanup(); }
});

test('Antigravity launcher finds the WinGet Packages payload when no Links entry exists', async () => {
  const { antigravityLauncher } = await import('../src/lib/antigravity-account.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-agy-pkg-'));
  try {
    const payload = path.join(root, 'Microsoft', 'WinGet', 'Packages', 'Google.AntigravityCLI_8wekyb3d8bbwe');
    fs.mkdirSync(payload, { recursive: true });
    const target = path.join(payload, 'agy.exe');
    fs.writeFileSync(target, 'fixture');
    const r = antigravityLauncher({ platform: 'win32', env: { LOCALAPPDATA: root, PATH: '' } });
    assert.equal(r.command, target);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Antigravity IDE without the CLI produces the IDE-specific instruction', async () => {
  const { antigravityLauncher } = await import('../src/lib/antigravity-account.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-agy-ide-'));
  try {
    const ide = path.join(root, 'Programs', 'Antigravity');
    fs.mkdirSync(ide, { recursive: true });
    fs.writeFileSync(path.join(ide, 'Antigravity.exe'), 'fixture');
    assert.throws(() => antigravityLauncher({ platform: 'win32', env: { LOCALAPPDATA: root, PATH: '' } }), /IDE/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
