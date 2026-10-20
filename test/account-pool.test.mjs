// Account pool + quota rotation (v0.9.44): same-kind verified accounts form
// a pool; a quota failure cools the account down and the same call fails
// over to the next account; non-quota errors never fail over.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

test('quota detection and reset parsing stay conservative', async () => {
  const f = isolatedRuntime('pool-unit');
  try {
    const pool = await f.import('src/lib/account-pool.mjs');
    assert.equal(pool.isQuotaError(Object.assign(new Error('Provider HTTP 429.'), { status: 429 })), true);
    assert.equal(pool.isQuotaError(new Error('You have hit your usage limit for this window')), true);
    assert.equal(pool.isQuotaError(new Error('Tài khoản đã vượt giới hạn sử dụng')), true);
    assert.equal(pool.isQuotaError(Object.assign(new Error('Provider HTTP 401.'), { status: 401 })), false);
    assert.equal(pool.isQuotaError(new Error('Model không tồn tại')), false);
    assert.equal(pool.isQuotaError(null), false);
    const now = Date.now();
    assert.ok(Math.abs(pool.extractQuotaResetMs({ resetAt: Math.floor(now / 1000) + 600 }) - (now + 600000)) < 3000);
    assert.ok(pool.extractQuotaResetMs(new Error('rate limited, retry in 30 minutes')) >= now + 29 * 60000);
    assert.equal(pool.extractQuotaResetMs(new Error('plain failure')), null);
    assert.equal(pool.extractQuotaResetMs({ resetAt: 123 }), null, 'past reset is ignored');
  } finally { f.cleanup(); }
});

function fixtureServer(handler) {
  return new Promise(resolve => {
    const s = http.createServer(handler);
    s.listen(0, '127.0.0.1', () => resolve({ s, url: `http://127.0.0.1:${s.address().port}` }));
  });
}
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

test('ask() fails over to the next pooled account on quota and skips the cooling account afterwards', async () => {
  const f = isolatedRuntime('pool-ask');
  const hits = { a: 0, b: 0 };
  let bQuota = false;
  const A = await fixtureServer((req, res) => { hits.a++; json(res, 429, { error: { message: 'rate limited' } }); });
  const B = await fixtureServer((req, res) => { hits.b++; if (bQuota) return json(res, 429, { error: { message: 'rate limited' } }); json(res, 200, { choices: [{ message: { content: 'reply-from-B' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }); });
  try {
    const vault = await f.import('src/lib/vault.mjs');
    const bindings = await f.import('src/lib/model-bindings.mjs');
    const providers = await f.import('src/lib/providers.mjs');
    const pool = await f.import('src/lib/account-pool.mjs');
    vault.unlockVault(['pool', 'fixture', 'pass', '2026'].join('-'));
    const keyA = ['fixture', 'key', 'a'].join('-'), keyB = ['fixture', 'key', 'b'].join('-');
    const ca = vault.saveConnection({ kind: 'openai_compatible', name: 'Compat A', baseUrl: A.url, secret: keyA, model: 'm1' });
    const cb = vault.saveConnection({ kind: 'openai_compatible', name: 'Compat B', baseUrl: B.url, secret: keyB, model: 'm1' });
    bindings.recordModels(vault.getConnection(ca.id), ['m1']);
    bindings.recordModels(vault.getConnection(cb.id), ['m1']);

    // First call: A is the pinned account but quota-fails -> B answers.
    const out1 = await providers.ask(ca.id, { prompt: 'hello' });
    assert.equal(out1, 'reply-from-B');
    assert.ok(hits.a >= 1 && hits.b === 1, `expected A tried then B once, got ${JSON.stringify(hits)}`);
    const until = pool.cooldownUntilMs(ca.id);
    assert.ok(until && until > Date.now(), 'A must be cooling down after the quota hit');
    const kinds = pool.poolEvents().map(e => e.kind);
    assert.ok(kinds.includes('pool.quota') && kinds.includes('pool.switch'), `events: ${kinds}`);
    const feedText = pool.poolFeedEvents().map(e => e.text).join(' ');
    assert.match(feedText, /Compat B/);

    // Second call: A is cooling -> straight to B, A untouched.
    const aHitsBefore = hits.a;
    const out2 = await providers.ask(ca.id, { prompt: 'again' });
    assert.equal(out2, 'reply-from-B');
    assert.equal(hits.a, aHitsBefore, 'cooling account must not be retried');
    assert.equal(hits.b, 2);

    // Both exhausted: honest pool-exhausted error, no fake success.
    bQuota = true;
    await assert.rejects(() => providers.ask(ca.id, { prompt: 'third' }), /đều đang nghỉ hạn mức/);
    assert.ok(pool.poolEvents().some(e => e.kind === 'pool.exhausted'));

    // Candidate ordering: with three accounts and the middle one cooling,
    // the pool leads with the primary then the ready peer.
    pool.clearPoolState();
    const cc = vault.saveConnection({ kind: 'openai_compatible', name: 'Compat C', baseUrl: B.url, secret: keyB, model: 'm1' });
    bindings.recordModels(vault.getConnection(cc.id), ['m1']);
    pool.noteQuotaHit(vault.getConnection(cb.id), Object.assign(new Error('quota'), { status: 429 }));
    const primary = { ...vault.getConnection(ca.id), model: 'm1' };
    const { candidates, poolSize } = pool.poolCandidates(primary);
    assert.equal(poolSize, 3);
    assert.deepEqual(candidates.map(c => c.id), [ca.id, cc.id]);
    const info = pool.poolInfoFor(cb.id);
    assert.equal(info.poolSize, 3);
    assert.ok(info.cooldownUntil, 'cooling peer reports its cooldown to the UI');
  } finally { A.s.close(); B.s.close(); f.cleanup(); }
});

test('non-quota errors do not burn the other pooled accounts', async () => {
  const f = isolatedRuntime('pool-no-failover');
  const hits = { a: 0, b: 0 };
  const A = await fixtureServer((req, res) => { hits.a++; json(res, 401, { error: { message: 'invalid key' } }); });
  const B = await fixtureServer((req, res) => { hits.b++; json(res, 200, { choices: [{ message: { content: 'should-not-happen' } }] }); });
  try {
    const vault = await f.import('src/lib/vault.mjs');
    const bindings = await f.import('src/lib/model-bindings.mjs');
    const providers = await f.import('src/lib/providers.mjs');
    vault.unlockVault(['pool', 'fixture', 'pass', '2026'].join('-'));
    const k = ['fixture', 'key'].join('-');
    const ca = vault.saveConnection({ kind: 'openai_compatible', name: 'Solo A', baseUrl: A.url, secret: k, model: 'm1' });
    const cb = vault.saveConnection({ kind: 'openai_compatible', name: 'Solo B', baseUrl: B.url, secret: k, model: 'm1' });
    bindings.recordModels(vault.getConnection(ca.id), ['m1']);
    bindings.recordModels(vault.getConnection(cb.id), ['m1']);
    await assert.rejects(() => providers.ask(ca.id, { prompt: 'x' }), /401/);
    assert.equal(hits.b, 0, 'a 401 must surface immediately without touching the peer');
  } finally { A.s.close(); B.s.close(); f.cleanup(); }
});
