// Connection rename (v0.9.50): every connection — including account-login
// connections (Codex/Claude/Gemini/Antigravity) whose dialogs previously made
// the name read-only after creation — can be renamed via
// POST /api/connections/:id/name, and the office fleet robot label follows
// the connection name (office-fleet.mjs derives label from connection.name).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { deriveFleet } from '../src/lib/office-fleet.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const LAUNCH_TOKEN = 'cd'.repeat(32); // the launcher ticket must be 64 hex chars (local-access.mjs)
const FAKE_SECRET = ['sk', 'rename', 'fixture', '123'].join('-');
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

test('connection rename: endpoint renames any connection, rejects empty/unknown, robot label follows', async () => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-rename-'));
  const child = await launch(port, dataDir);
  try {
    // Session via the one-time launcher ticket (same flow as the owner).
    const granted = await fetch(`http://127.0.0.1:${port}/?launch=${LAUNCH_TOKEN}`, { redirect: 'manual' });
    assert.equal(granted.status, 303, 'launcher ticket grants a session');
    const cookie = (granted.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(cookie.startsWith('aios_session='), 'session cookie issued');
    const H = { cookie, 'content-type': 'application/json' };
    const call = (p, body) => fetch(`http://127.0.0.1:${port}${p}`, { method: 'POST', headers: H, body: JSON.stringify(body) });

    let r = await call('/api/vault/unlock', { password: '<MASKED_SECRET_002>' });
    assert.equal(r.status, 200, 'vault setup');

    r = await call('/api/connections', { kind: 'other', name: 'Tên gốc', secret: FAKE_SECRET });
    assert.equal(r.status, 200, 'create connection');
    const conn = await r.json();
    assert.equal(conn.name, 'Tên gốc');

    // Rename succeeds and is reflected in the connection list.
    r = await call(`/api/connections/${conn.id}/name`, { name: '  Bạn Hiền GPT  ' });
    assert.equal(r.status, 200, 'rename ok');
    const renamed = await r.json();
    assert.equal(renamed.name, 'Bạn Hiền GPT', 'name is trimmed and stored');
    assert.equal(renamed.hasSecret, true, 'secret state untouched by rename');

    r = await fetch(`http://127.0.0.1:${port}/api/connections`, { headers: H });
    const list = await r.json();
    assert.equal(list.find(x => x.id === conn.id)?.name, 'Bạn Hiền GPT', 'list shows the new name');
    assert.ok(!JSON.stringify(list).includes(FAKE_SECRET), 'no secret leakage in list');

    // Empty name and unknown id are rejected with clear errors.
    r = await call(`/api/connections/${conn.id}/name`, { name: '   ' });
    assert.notEqual(r.status, 200, 'empty name rejected');
    assert.ok(((await r.json()).error || '').includes('không được trống'), 'empty-name error text');
    r = await call(`/api/connections/${crypto.randomUUID()}/name`, { name: 'X' });
    assert.notEqual(r.status, 200, 'unknown id rejected');
    assert.ok(((await r.json()).error || '').includes('Không tìm thấy'), 'unknown-id error text');

    // The office robot takes its label from the connection name.
    const fleet = deriveFleet({ connections: [{ id: 'c1', kind: 'chatgpt_account', name: 'Bạn Hiền GPT' }], runs: [], workerConnByProject: {}, nowMs: Date.now() });
    const bot = fleet.bots.find(b => b.connectionId === 'c1');
    assert.ok(bot, 'fleet has a bot for the account connection');
    assert.equal(bot.label, 'Bạn Hiền GPT', 'robot label follows the connection name');
    const fleetDefault = deriveFleet({ connections: [{ id: 'c2', kind: 'chatgpt_account', name: '' }], runs: [], workerConnByProject: {}, nowMs: Date.now() });
    assert.notEqual(fleetDefault.bots.find(b => b.connectionId === 'c2')?.label, '', 'empty name falls back to a provider label');
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
