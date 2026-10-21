// Operator diagnosis door (v0.9.50): the external coordinator gets three
// read-only endpoints — full run detail with the original per-step errors,
// the event journal, and a secret-free connection list — behind the SAME
// operator token (no new scope, no token rotation). These tests boot the
// real server and exercise the real HTTP path end to end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const LAUNCH_TOKEN = 'e'.repeat(64);
const delay = ms => new Promise(r => setTimeout(r, ms));

async function reservePort() { const s = net.createServer(); s.listen(0, '127.0.0.1'); await once(s, 'listening'); const p = s.address().port; s.close(); await once(s, 'close'); return p; }

async function launch(port, dataDir) {
  const child = spawn(process.execPath, ['src/server.mjs'], { cwd: ROOT, env: { ...process.env, AI_PROJECT_OS_PORT: String(port), AI_PROJECT_OS_DATA_DIR: dataDir, HEYGEN_API_KEY: '', HEYGEN_TTS_VOICE_ID: '', AI_PROJECT_OS_LAUNCH_TOKEN: LAUNCH_TOKEN }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', x => logs += String(x)); child.stderr.on('data', x => logs += String(x));
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) throw new Error('Startup failed: ' + logs);
    try { const res = await fetch(`http://127.0.0.1:${port}/api/health`); if (res.ok && (await res.json()).version === VERSION) return child; } catch {}
    await delay(100);
  }
  child.kill(); throw new Error('Server did not become ready. ' + logs);
}
async function stop(child) { if (child.exitCode !== null) return; child.kill('SIGTERM'); await Promise.race([once(child, 'exit'), delay(10000)]); }

test('operator diagnosis endpoints: token-gated, read-only, secret-free', async () => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-opdiag-'));
  const child = await launch(port, dataDir);
  const base = `http://127.0.0.1:${port}`;
  try {
    // Session via the one-time launcher ticket, then mint an operator token
    // exactly the way the owner does in the Connections tab.
    const granted = await fetch(`${base}/?launch=${LAUNCH_TOKEN}`, { redirect: 'manual' });
    assert.equal(granted.status, 303);
    const cookie = (granted.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('aios_session='));
    const session = (url, method = 'GET', body = null) => fetch(base + url, { method, headers: { 'content-type': 'application/json', Cookie: cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const minted = await (await session('/api/operator/token', 'POST', { scopes: { run: true, note: true } })).json();
    assert.match(minted.token, /^aios-op-[0-9a-f]{48}$/);
    const ext = (url, token) => fetch(base + url, token ? { headers: { 'x-aios-operator': token } } : {});

    // 401 without a token and with a wrong token, on every diagnosis door.
    for (const url of ['/api/operator/ext/run/abc', '/api/operator/ext/journal', '/api/operator/ext/connections']) {
      assert.equal((await ext(url)).status, 401, url + ' without token');
      assert.equal((await ext(url, 'aios-op-' + '0'.repeat(48))).status, 401, url + ' with wrong token');
    }

    // Unknown run id -> 404 (not a crash, not an empty 200).
    const missing = await ext('/api/operator/ext/run/run-khong-ton-tai', minted.token);
    assert.equal(missing.status, 404);

    // A note through the operator channel shows up in the journal.
    const noteRes = await fetch(base + '/api/operator/ext/note', { method: 'POST', headers: { 'content-type': 'application/json', 'x-aios-operator': minted.token }, body: JSON.stringify({ text: 'Ghi chú kiểm tra cửa chẩn đoán.' }) });
    assert.equal(noteRes.status, 200);
    const journal = await (await ext('/api/operator/ext/journal', minted.token)).json();
    assert.ok(Array.isArray(journal.feed), 'journal.feed is an array');
    assert.ok(Array.isArray(journal.notes), 'journal.notes is an array');
    assert.ok(journal.notes.some(n => n.kind === 'operator.note' && n.text.includes('cửa chẩn đoán')), 'operator note rendered in journal');
    const limited = await (await ext('/api/operator/ext/journal?limit=3', minted.token)).json();
    assert.ok(limited.feed.length <= 3, 'journal limit honoured');

    // Start a real run through the operator channel (no card -> it fails at
    // input validation), then read its FULL detail back through the new door:
    // steps carry name/state/at and the run carries its original error.
    const startRes = await fetch(base + '/api/operator/ext/run', { method: 'POST', headers: { 'content-type': 'application/json', 'x-aios-operator': minted.token }, body: JSON.stringify({ pipeline: 'news-video' }) });
    const started = await startRes.json();
    if (startRes.status === 200 && started.run && started.run.id) {
      const detailRes = await ext('/api/operator/ext/run/' + started.run.id, minted.token);
      assert.equal(detailRes.status, 200);
      const { run } = await detailRes.json();
      assert.equal(run.id, started.run.id);
      assert.ok(Array.isArray(run.steps) && run.steps.length >= 1, 'run detail carries steps');
      for (const s of run.steps) { assert.ok('name' in s && 'state' in s, 'step has name+state'); }
      assert.ok('error' in run, 'run detail carries the error field');
    }

    // Connections door: locked vault is a graceful answer, and after unlock
    // + one API-key connection the projection exposes NO secret material.
    const locked = await (await ext('/api/operator/ext/connections', minted.token)).json();
    assert.equal(locked.vaultLocked, true);
    assert.deepEqual(locked.connections, []);
    await session('/api/vault/unlock', 'POST', { password: 'mat-khau-thu-123' });
    const DUMMY_SECRET = ['sk', 'test', 'fixture', '987'].join('-');
    // kind 'other' verifies locally (no provider network call), so the save
    // path succeeds offline while still storing a real secret in the vault.
    const saved = await session('/api/connections', 'POST', { kind: 'other', secret: DUMMY_SECRET, meta: { accountLabel: 'Tài khoản thử' } });
    assert.equal(saved.status, 200);
    const conns = await (await ext('/api/operator/ext/connections', minted.token)).json();
    assert.equal(conns.vaultLocked, false);
    assert.equal(conns.connections.length, 1);
    const c0 = conns.connections[0];
    assert.equal(c0.kind, 'other');
    assert.ok('area' in c0, 'projection carries the two-area field (0.9.53)');
    assert.equal(c0.area, null, 'kind "other" belongs to neither area');
    assert.equal(c0.hasSecret, true);
    assert.ok(!('secret' in c0), 'projection has no secret field');
    assert.ok(!JSON.stringify(conns).includes('fixture-987'), 'no secret value anywhere in the payload');
    assert.ok(!JSON.stringify(conns).includes(minted.token), 'operator token never leaks into payloads');
  } finally {
    await stop(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
