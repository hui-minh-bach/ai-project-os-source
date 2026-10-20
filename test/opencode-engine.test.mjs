// OpenCode engine (0.9.43): MIT coding-agent runtime for local models.
// Hermetic tests cover the event parser, the provider config builder, the
// managed install and a faked headless run; the live model loop needs the
// owner's machine (the dev sandbox proxy blocks OpenCode's provider fetch).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseOpencodeEvents, opencodeConfigFor } from '../src/lib/opencode.mjs';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

test('parseOpencodeEvents aggregates text, tokens, cost and errors', () => {
  const stdout = [
    JSON.stringify({ type: 'step_start', sessionID: 'ses_1', part: { type: 'step-start' } }),
    JSON.stringify({ type: 'text', sessionID: 'ses_1', part: { type: 'text', text: 'Xin chào ' } }),
    JSON.stringify({ type: 'text', sessionID: 'ses_1', part: { type: 'text', text: 'bạn.' } }),
    JSON.stringify({ type: 'step_finish', sessionID: 'ses_1', part: { type: 'step-finish', cost: 0.01, tokens: { input: 10, output: 5 } } }),
    'not json at all',
    JSON.stringify({ type: 'step_finish', sessionID: 'ses_1', part: { type: 'step-finish', cost: 0.02, tokens: { input: 3, output: 2 } } }),
  ].join('\n');
  const r = parseOpencodeEvents(stdout);
  assert.equal(r.text, 'Xin chào bạn.');
  assert.equal(r.sessionId, 'ses_1');
  assert.equal(r.cost, 0.03);
  assert.deepEqual(r.tokens, { input: 13, output: 7 });
  assert.equal(r.error, null);
  const bad = parseOpencodeEvents(JSON.stringify({ type: 'error', error: { message: 'provider down' } }));
  assert.equal(bad.error, 'provider down');
});

test('opencodeConfigFor maps connections to providers', () => {
  const local = opencodeConfigFor({ kind: 'openai_compatible', model: 'llama3.1', baseUrl: 'http://127.0.0.1:11434/v1/' });
  assert.equal(local.modelRef, 'aios/llama3.1');
  assert.equal(local.config.provider.aios.options.baseURL, 'http://127.0.0.1:11434/v1');
  const stripped = opencodeConfigFor({ kind: 'openai_compatible', model: 'ollama/llama3.1', baseUrl: 'http://127.0.0.1:11434/v1' });
  assert.equal(stripped.modelRef, 'aios/llama3.1');
  assert.throws(() => opencodeConfigFor({ kind: 'openai_compatible', model: 'x' }), /Base URL/);
  assert.equal(opencodeConfigFor({ kind: 'openai', model: 'gpt-5' }).modelRef, 'openai/gpt-5');
  assert.equal(opencodeConfigFor({ kind: 'gemini', model: 'gemini-2.5-pro' }).modelRef, 'google/gemini-2.5-pro');
});

test('opencode install + status + faked run in an isolated runtime', async () => {
  const f = isolatedRuntime('opencode');
  try {
    const oc = await f.import('src/lib/opencode.mjs');
    const managed = await f.import('src/lib/managed-cli.mjs');
    assert.equal(oc.opencodeStatus().ready, false);
    const fakeNpm = async (cmd, args) => {
      const pkgDir = path.join(managed.TOOLS_DIR, 'node_modules', 'opencode-ai');
      fs.mkdirSync(path.join(pkgDir, 'bin'), { recursive: true });
      fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: 'opencode-ai', version: '1.19.3', bin: { opencode: 'bin/opencode.exe' } }));
      const bin = path.join(pkgDir, 'bin', 'opencode.exe');
      fs.writeFileSync(bin, '#!/bin/sh\necho 1.19.3\n');
      fs.chmodSync(bin, 0o755);
      return { code: 0, stdout: '', stderr: '', timedOut: false };
    };
    const st = await oc.installOpencode({ npmPath: '/fake/npm-cli.js', invoke: fakeNpm });
    assert.equal(st.ready, true);
    assert.equal(st.version, '1.19.3');
    let seenConfig = null;
    const fakeRun = async (cmd, args, opts) => {
      seenConfig = JSON.parse(fs.readFileSync(opts.env.OPENCODE_CONFIG, 'utf8'));
      assert.deepEqual(args.slice(0, 3), ['run', '--format', 'json']);
      return { code: 0, timedOut: false, stdout: JSON.stringify({ type: 'text', sessionID: 'ses_9', part: { type: 'text', text: 'Đã sửa xong.' } }), stderr: '' };
    };
    const r = await oc.runOpencodeTask({ root: f.root, prompt: 'Sửa lỗi này', connection: { kind: 'openai_compatible', model: 'qwen2.5-coder', baseUrl: 'http://127.0.0.1:11434/v1', secret: 'k' }, invoke: fakeRun });
    assert.equal(r.text, 'Đã sửa xong.');
    assert.equal(r.modelRef, 'aios/qwen2.5-coder');
    assert.equal(seenConfig.provider.aios.options.apiKey, 'k');
    const engines = await f.import('src/lib/engines.mjs');
    const statuses = await engines.engineStatuses();
    const entry = statuses.find(e => e.id === 'opencode');
    assert.ok(entry, 'catalog contains opencode');
    assert.equal(entry.taskAdapterSupported, true);
    assert.equal(entry.executionRequiresUnsafeOptIn, true);
    assert.equal(entry.runtimeInstalled, true);
  } finally { f.cleanup(); }
});
