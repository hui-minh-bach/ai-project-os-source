import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let vault, cliAccount, accountAuth;
before(async () => {
  // Nested temp dir: the app derives its tools dir from the data dir's
  // parent, which must stay unique to this test process.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-effort-'));
  process.env.AI_PROJECT_OS_DATA_DIR = path.join(base, 'data');
  vault = await import('../src/lib/vault.mjs');
  cliAccount = await import('../src/lib/cli-account.mjs');
  accountAuth = await import('../src/lib/account-auth.mjs');
});

test('vault persists reasoningEffort through the meta whitelist', () => {
  vault.unlockVault('effort-fixture-pass');
  const c = vault.saveConnection({ kind: 'chatgpt_account', name: 'GPT', meta: { authMode: 'cli-account', reasoningEffort: 'low' } });
  assert.equal(vault.getConnection(c.id).meta.reasoningEffort, 'low');
  const c2 = vault.saveConnection({ ...vault.getConnection(c.id), meta: { ...vault.getConnection(c.id).meta, reasoningEffort: 'high' } });
  assert.equal(c2.meta.reasoningEffort, 'high');
  assert.equal(vault.listConnections().find((x) => x.id === c.id).meta.reasoningEffort, 'high');
  vault.lockVault();
});

test('codex thread config carries model_reasoning_effort only when set', () => {
  assert.deepEqual(accountAuth.accountThreadConfig({ meta: { reasoningEffort: 'high' } }), { model_reasoning_effort: 'high' });
  assert.deepEqual(accountAuth.accountThreadConfig({ meta: { reasoningEffort: 'max' } }), { model_reasoning_effort: 'max' });
  assert.deepEqual(accountAuth.accountThreadConfig({ meta: { reasoningEffort: 'minimal' } }), { model_reasoning_effort: 'minimal' });
  assert.equal(accountAuth.accountThreadConfig({ meta: {} }), undefined);
  assert.equal(accountAuth.accountThreadConfig({ meta: { reasoningEffort: 'ultra' } }), undefined);
  assert.equal(accountAuth.accountThreadConfig({}), undefined);
  assert.deepEqual(
    accountAuth.accountThreadConfig({ meta: { reasoningEffort: 'low' } }, { features: { image_generation: true } }),
    { features: { image_generation: true }, model_reasoning_effort: 'low' },
  );
});

test('claude CLI plan adds --effort only when the account has one set', () => {
  const withEffort = cliAccount.cliInferencePlan({ kind: 'claude_account', model: 'claude-sonnet-x', meta: { reasoningEffort: 'low' } }, { prompt: 'hi' });
  const i = withEffort.args.indexOf('--effort');
  assert.ok(i > 0 && withEffort.args[i + 1] === 'low');
  const without = cliAccount.cliInferencePlan({ kind: 'claude_account', model: 'claude-sonnet-x', meta: {} }, { prompt: 'hi' });
  assert.ok(!without.args.includes('--effort'));
  const xhigh = cliAccount.cliInferencePlan({ kind: 'claude_account', model: 'claude-sonnet-x', meta: { reasoningEffort: 'xhigh' } }, { prompt: 'hi' });
  const xi = xhigh.args.indexOf('--effort');
  assert.ok(xi > 0 && xhigh.args[xi + 1] === 'xhigh');
  const gemini = cliAccount.cliInferencePlan({ kind: 'gemini_account', model: 'gemini-x', meta: { reasoningEffort: 'low' } }, { prompt: 'hi' });
  assert.ok(!gemini.args.includes('--effort'));
});

test('route + UI contract: effort picker is wired for account kinds', () => {
  const server = fs.readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  assert.ok(server.includes('/effort'));
  assert.ok(server.includes('reasoningEffort'));
  const js = fs.readFileSync(new URL('../public/tabs/connections.js', import.meta.url), 'utf8');
  assert.ok(js.includes('data-effort-slider'));
  assert.ok(js.includes('ccEffortLevels'));
  assert.ok(js.includes('type="range"'));
  assert.ok(js.includes('Mức suy luận'));
  assert.ok(server.includes("'minimal'"));
  assert.ok(server.includes("'xhigh'"));
  const auth = fs.readFileSync(new URL('../src/lib/account-auth.mjs', import.meta.url), 'utf8');
  assert.ok(auth.includes('model_reasoning_effort'));
});
