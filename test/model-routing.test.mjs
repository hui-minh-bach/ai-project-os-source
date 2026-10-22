// v0.9.55 — ungated model selection + runtime routing ("điều hướng").
// Fixture providers only: an account whose models were NEVER probe-verified
// (catalog-only registry entry) must bind, resolve and serve; quota hits
// rotate inside the step (pool peers, then the role's backup binding);
// non-quota errors abort; the all-blocked error names every candidate.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

function fixtureServer(handler) {
  const hits = { n: 0 };
  return new Promise(resolve => {
    const s = http.createServer((req, res) => { hits.n++; handler(req, res); });
    s.listen(0, '127.0.0.1', () => resolve({ s, hits, url: `http://127.0.0.1:${s.address().port}` }));
  });
}
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const okCompat = text => (req, res) => json(res, 200, { choices: [{ message: { content: text } }] });
const okOpenAi = text => (req, res) => json(res, 200, { output_text: text });
const quota = (req, res) => json(res, 429, { error: { message: 'rate limited' } });

/** A connection whose registry entry is a CATALOG ONLY: the model list is
 * known but no model was ever probe-verified (the owner's deadlock case). */
async function catalogOnly(f, vault, bindings, store, { kind = 'openai_compatible', name, url, model = 'm1', stale = false }) {
  const c = vault.saveConnection({ kind, name, baseUrl: url, secret: '<redacted>', model });
  bindings.recordModels(vault.getConnection(c.id), [model]);
  const reg = store.readJson('model-registry.json', {});
  reg[c.id] = { ...reg[c.id], status: 'catalog', models: [model], verifiedAt: new Date(Date.now() - (stale ? 3 * 24 * 3600e3 : 0)).toISOString() };
  store.writeJson('model-registry.json', reg);
  return vault.getConnection(c.id);
}

async function boot(label) {
  const f = isolatedRuntime(label);
  const vault = await f.import('src/lib/vault.mjs');
  const bindings = await f.import('src/lib/model-bindings.mjs');
  const store = await f.import('src/lib/store.mjs');
  const providers = await f.import('src/lib/providers.mjs');
  const pool = await f.import('src/lib/account-pool.mjs');
  const projects = await f.import('src/lib/projects.mjs');
  vault.unlockVault('routing-fixture-pass');
  return { f, vault, bindings, store, providers, pool, projects };
}

test('ungated: unverified catalog account binds, resolves, and serves a run step', async () => {
  const { f, vault, bindings, store, projects } = await boot('routing-ungated');
  const A = await fixtureServer(okCompat('reply-from-A'));
  try {
    const ca = await catalogOnly(f, vault, bindings, store, { name: 'Catalog Only A', url: A.url });
    const avail = bindings.modelAvailability(ca.id);
    assert.deepEqual(avail.models, ['m1'], 'catalog is exposed for selection');
    assert.deepEqual(avail.verifiedModels, [], 'nothing probe-verified — advisory only');
    const p = projects.createProject({ name: 'Ungated fixture', idea: 'fixture' });
    projects.updateProjectModelRoles(p.id, { worker: { connectionId: ca.id, model: 'm1' } });
    assert.equal(bindings.resolveBinding(bindings.roleRef(p.id, 'worker')).model, 'm1');
    assert.equal(projects.projectModelRoles(p.id).descriptors.worker[0].status, 'ready', 'bindable but unverified = ready, not blocked');
    const media = await f.import('src/lib/media-ai.mjs');
    const r = await media.writeTextWithModel(p.id, { instructions: 'sys', prompt: 'hello' });
    assert.equal(r.text, 'reply-from-A');
    assert.equal(r.provider, 'Catalog Only A');
    assert.equal(r.model, 'm1');
    // A stale catalog binds too — age is a badge, never a gate.
    const cs = await catalogOnly(f, vault, bindings, store, { name: 'Stale B', url: A.url, stale: true });
    projects.updateProjectModelRoles(p.id, { reviewer: { connectionId: cs.id, model: 'm1' } });
    assert.equal(bindings.modelAvailability(cs.id).catalogStale, true);
    assert.equal(bindings.resolveBinding(bindings.roleRef(p.id, 'reviewer')).model, 'm1');
  } finally { A.s.close(); f.cleanup(); }
});

test('stored 0.9.53 binding with an area stamp still loads and resolves; saves never write area', async () => {
  const { f, vault, bindings, store, projects } = await boot('routing-area-stamp');
  const A = await fixtureServer(okCompat('x'));
  try {
    const ca = await catalogOnly(f, vault, bindings, store, { name: 'Stamped', url: A.url });
    const p = projects.createProject({ name: 'Stamp fixture', idea: 'fixture' });
    projects.updateProjectModelRoles(p.id, { worker: { connectionId: ca.id, model: 'm1' } });
    const all = store.readJson('projects.json', []);
    const pr = all.find(x => x.id === p.id);
    pr.modelRoles.worker = { ...pr.modelRoles.worker, area: 'codex' }; // simulate a 0.9.53 save
    store.writeJson('projects.json', all);
    assert.equal(bindings.resolveBinding(bindings.roleRef(p.id, 'worker')).model, 'm1', 'stamped binding resolves');
    assert.equal(projects.projectModelRoles(p.id).roles.worker.connectionId, ca.id, 'stamped binding loads');
    projects.updateProjectModelRoles(p.id, { worker: { connectionId: ca.id, model: 'm1', area: 'chatbox' } });
    assert.ok(!('area' in projects.getProject(p.id).modelRoles.worker), 'area is never written again');
  } finally { A.s.close(); f.cleanup(); }
});

test('routing a→b: quota on the primary rotates to the pooled peer inside the same call, with journal + provenance', async () => {
  const { f, vault, bindings, store, providers, pool } = await boot('routing-pool');
  const A = await fixtureServer(quota);
  const B = await fixtureServer(okCompat('reply-from-B'));
  try {
    const ca = await catalogOnly(f, vault, bindings, store, { name: 'Pool A', url: A.url });
    const cb = await catalogOnly(f, vault, bindings, store, { name: 'Pool B', url: B.url });
    const served = {};
    const out = await providers.ask(ca.id, { prompt: 'hello', served });
    assert.equal(out, 'reply-from-B');
    assert.deepEqual(served, { connectionId: cb.id, connectionName: 'Pool B', model: 'm1' }, 'provenance names the account that actually served');
    assert.ok(pool.isCooling(ca.id), 'the quota-hit account is resting');
    const feed = pool.poolFeedEvents().map(e => e.text).join('\n');
    assert.match(feed, /Pool A.*chạm hạn mức/, 'journal records the quota hit');
    assert.match(feed, /chạm hạn mức — chuyển “Pool B”/, 'journal records the rotation to the next account');
    // Cooling primary is skipped entirely on the next call.
    const aHits = A.hits.n;
    const out2 = await providers.ask(ca.id, { prompt: 'again', served: {} });
    assert.equal(out2, 'reply-from-B');
    assert.equal(A.hits.n, aHits, 'cooling account is not retried');
  } finally { A.s.close(); B.s.close(); f.cleanup(); }
});

test('routing a→b→c: the backup binding serves only after the whole primary kind is exhausted', async () => {
  const { f, vault, bindings, store, providers, projects } = await boot('routing-backup');
  const A = await fixtureServer(quota);
  const B = await fixtureServer(quota);
  const C = await fixtureServer(okOpenAi('reply-from-backup'));
  try {
    const ca = await catalogOnly(f, vault, bindings, store, { name: 'Main A', url: A.url });
    await catalogOnly(f, vault, bindings, store, { name: 'Peer B', url: B.url });
    const cc = await catalogOnly(f, vault, bindings, store, { kind: 'openai', name: 'Backup C', url: C.url });
    const p = projects.createProject({ name: 'Backup fixture', idea: 'fixture' });
    projects.updateProjectModelRoles(p.id, { worker: { connectionId: ca.id, model: 'm1' }, backups: { worker: { connectionId: cc.id, model: 'm1' } } });
    assert.equal(projects.projectModelRoles(p.id).backups.worker.connectionId, cc.id, 'backup binding is stored with the project');
    const served = {};
    const out = await providers.ask(bindings.roleRef(p.id, 'worker'), { prompt: 'work', served });
    assert.equal(out, 'reply-from-backup');
    assert.ok(A.hits.n >= 1 && B.hits.n >= 1, 'primary and pool peer were tried first');
    assert.equal(C.hits.n, 1, 'backup served exactly once, after the pool');
    assert.equal(served.connectionId, cc.id);
  } finally { A.s.close(); B.s.close(); C.s.close(); f.cleanup(); }
});

test('all candidates blocked: the error lists every candidate and the earliest reset; nobody is called', async () => {
  const { f, vault, bindings, store, providers, pool, projects } = await boot('routing-blocked');
  const A = await fixtureServer(okCompat('a'));
  const B = await fixtureServer(okCompat('b'));
  const C = await fixtureServer(okOpenAi('c'));
  try {
    const ca = await catalogOnly(f, vault, bindings, store, { name: 'Blocked A', url: A.url });
    const cb = await catalogOnly(f, vault, bindings, store, { name: 'Blocked B', url: B.url });
    const cc = await catalogOnly(f, vault, bindings, store, { kind: 'openai', name: 'Blocked C', url: C.url });
    const now = Date.now();
    const untilA = now + 30 * 60000, untilB = now + 45 * 60000, untilC = now + 60 * 60000;
    pool.noteQuotaHit(vault.getConnection(ca.id), { resetAt: Math.floor(untilA / 1000) });
    pool.noteQuotaHit(vault.getConnection(cb.id), { resetAt: Math.floor(untilB / 1000) });
    pool.noteQuotaHit(vault.getConnection(cc.id), { resetAt: Math.floor(untilC / 1000) });
    const p = projects.createProject({ name: 'Blocked fixture', idea: 'fixture' });
    projects.updateProjectModelRoles(p.id, { worker: { connectionId: ca.id, model: 'm1' }, backups: { worker: { connectionId: cc.id, model: 'm1' } } });
    const err = await providers.ask(bindings.roleRef(p.id, 'worker'), { prompt: 'work' }).then(() => null, e => e);
    assert.ok(err, 'the call must fail honestly');
    assert.match(err.message, /đều đang nghỉ hạn mức/);
    for (const name of ['Blocked A', 'Blocked B', 'Blocked C']) assert.ok(err.message.includes(name), `error lists ${name}: ${err.message}`);
    const earliest = new Date(untilA).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    assert.ok(err.message.includes(`Sớm nhất mở lại lúc ${earliest}`), `error carries the earliest reset: ${err.message}`);
    assert.equal(A.hits.n + B.hits.n + C.hits.n, 0, 'cooling accounts are never called');
  } finally { A.s.close(); B.s.close(); C.s.close(); f.cleanup(); }
});

test('non-quota errors abort immediately — pool peers and the backup are never touched', async () => {
  const { f, vault, bindings, store, providers, projects } = await boot('routing-abort');
  const A = await fixtureServer((req, res) => json(res, 401, { error: { message: 'invalid key' } }));
  const B = await fixtureServer(okCompat('peer'));
  const C = await fixtureServer(okOpenAi('backup'));
  try {
    const ca = await catalogOnly(f, vault, bindings, store, { name: 'Auth A', url: A.url });
    await catalogOnly(f, vault, bindings, store, { name: 'Peer B', url: B.url });
    const cc = await catalogOnly(f, vault, bindings, store, { kind: 'openai', name: 'Backup C', url: C.url });
    const p = projects.createProject({ name: 'Abort fixture', idea: 'fixture' });
    projects.updateProjectModelRoles(p.id, { worker: { connectionId: ca.id, model: 'm1' }, backups: { worker: { connectionId: cc.id, model: 'm1' } } });
    await assert.rejects(() => providers.ask(bindings.roleRef(p.id, 'worker'), { prompt: 'x' }), /401/);
    assert.equal(B.hits.n, 0, 'a 401 must not rotate to the pool peer');
    assert.equal(C.hits.n, 0, 'a 401 must not rotate to the backup');
  } finally { A.s.close(); B.s.close(); C.s.close(); f.cleanup(); }
});

test('login pass: the model catalog auto-refreshes in the background once the account connects', async () => {
  const { f, vault } = await boot('routing-autorefresh');
  const auth = await f.import('src/lib/account-auth.mjs');
  const bindings = await f.import('src/lib/model-bindings.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-fake-'));
  const script = `
import readline from 'node:readline';
let email = null;
const emit = o => process.stdout.write(JSON.stringify(o) + '\\n');
readline.createInterface({ input: process.stdin }).on('line', line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m.id === undefined) return;
  if (m.method === 'initialize') { setTimeout(() => emit({ id: m.id, result: { userAgent: 'fixture/0.162.1' } }), 10); return; }
  let result = {};
  switch (m.method) {
    case 'account/login/start': result = { loginId: 'fx', authUrl: 'https://auth.openai.com/authorize?fixture=true' }; setTimeout(() => { email = 'fixture@example.invalid'; emit({ method: 'account/login/completed', params: { loginId: 'fx', success: true } }); }, 30); break;
    case 'account/read': result = { account: email ? { type: 'chatgpt', email, planType: 'fixture' } : null }; break;
    case 'model/list': result = { data: [{ model: 'gpt-fixture' }, { model: 'gpt-fixture-2' }], nextCursor: null }; break;
    case 'account/login/cancel': break;
    case 'account/logout': email = null; break;
    default: emit({ id: m.id, error: { code: -32601, message: 'unsupported' } }); return;
  }
  emit({ id: m.id, result });
});`;
  fs.writeFileSync(path.join(dir, 'codex'), '#!' + process.execPath + '\n' + script, { mode: 0o700 });
  const before = process.env.PATH;
  process.env.PATH = dir + path.delimiter + before;
  try {
    const started = await auth.startAccountLogin({ name: 'Auto-refresh fixture' });
    assert.equal(started.state, 'pending');
    // Wait for the login to complete and the session to read as connected.
    let status = null;
    for (let i = 0; i < 50 && status?.state !== 'connected'; i++) { await new Promise(r => setTimeout(r, 100)); status = await auth.refreshAccount(started.id); }
    assert.equal(status.state, 'connected');
    // The test NEVER calls listAccountModels: the catalog must arrive on
    // its own via the background refresh hooked into the login pass.
    let models = [];
    for (let i = 0; i < 50 && !models.length; i++) { await new Promise(r => setTimeout(r, 100)); models = bindings.modelAvailability(started.id).models; }
    assert.deepEqual(models, ['gpt-fixture', 'gpt-fixture-2'], 'catalog auto-refreshed after login');
    void vault;
  } finally { auth.closeAccountSessions(); process.env.PATH = before; fs.rmSync(dir, { recursive: true, force: true }); f.cleanup(); }
});

test('UI contract: areas are gone, backup pickers + advisory badges + team setup panel are in', async () => {
  const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const conn = read('../public/tabs/connections.js');
  const connHtml = read('../public/tabs/connections.html');
  const team = read('../public/tabs/team.js');
  const server = read('../src/server.mjs');
  assert.ok(!conn.includes('data-role-area') && !conn.includes('data-member-area'), 'no area selects in role/council UI');
  assert.ok(!conn.includes('Khu Codex') && !conn.includes('CC_AREA'), 'no area grouping code left');
  assert.ok(!connHtml.includes('Khu Codex') && connHtml.includes('id="teamSetupPanel"'), 'setup checklist panel exists, area copy gone');
  assert.ok(conn.includes('data-role-backup-model') && conn.includes('Model dự phòng'), 'backup picker rendered in role cards');
  assert.ok(conn.includes('đang nguội hạn mức') && conn.includes('đã xác minh') && conn.includes('chưa xác minh'), 'the three advisory badge states render');
  assert.ok(conn.includes('renderTeamSetup') && conn.includes('Đã chọn model cho ít nhất một vai'), 'checklist rows carry the three ticks');
  assert.ok(conn.includes('ccAccountQuotaSummary'), 'verify dialog shows quota before probing');
  assert.ok(!conn.includes('Chỉ provider và model đã xác minh có thể được chọn'), 'the old gating hint is gone');
  assert.ok(!team.includes('areaLabel'), 'office roster/plates carry no area label');
  assert.ok(team.includes('đang nghỉ sạc'), 'office shows resting accounts at charging pods');
  assert.ok(!server.includes('connection-areas') && !server.includes('area:connectionArea'), 'operator diagnose drops the area field');
  assert.ok(!fs.existsSync(new URL('../src/lib/connection-areas.mjs', import.meta.url)), 'connection-areas module is deleted');
  const fleet = await import('../src/lib/office-fleet.mjs');
  const { bots } = fleet.deriveFleet({ connections: [{ id: 'c1', kind: 'chatgpt_account', name: 'Tèo', connected: true, coolingUntil: new Date(Date.now() + 3600e3).toISOString() }], runs: [], workerConnByProject: {}, nowMs: Date.now() });
  assert.equal(bots[0].state, 'charging');
  assert.equal(bots[0].resting, true, 'a cooling account rests at its charging pod');
  assert.ok(!('area' in bots[0]) && !('areaLabel' in bots[0]), 'fleet bots carry no area fields');
});
