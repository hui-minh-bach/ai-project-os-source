import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createIntegrationHost } from '../src/lib/integration-host.mjs';
import { whisperStatus } from '../src/lib/local-whisper.mjs';

const SAMPLE = new URL('../integrations/media-engine/artifacts/samples/source.mp4', import.meta.url);

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-dub-'));
  let host;
  try {
    host = createIntegrationHost({ root, clock: false });
    assert.equal(host.status().core.status, 'active');
    const folder = path.join(host.mediaWorkspace, 'uploads');
    fs.mkdirSync(folder, { recursive: true });
    const source = path.join(folder, 'actual.mp4');
    fs.copyFileSync(SAMPLE, source);
    return fn({ host, source, root });
  } finally { host?.stop(); fs.rmSync(root, { force: true, recursive: true }); }
}
const rel = (host, source) => path.relative(host.mediaWorkspace, source);

test('dub: submit validates languages and translation source', () => fixture(({ host, source }) => {
  const src = rel(host, source);
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.dub', params: { source: src } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.dub', params: { source: src, targetLanguage: 'vi', sourceLanguage: 'vi' } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.dub', params: { source: src, targetLanguage: 'english!' } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.dub', params: { source: src, targetLanguage: 'en', translationSource: 'magic' } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.dub', params: { source: src, targetLanguage: 'en', translationSource: 'supplied', translatedTexts: [] } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.dub', params: { source: src, targetLanguage: 'en', translationSource: 'supplied', translatedTexts: ['ok', '  '] } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.dub', params: { source: src, targetLanguage: 'en', ttsProvider: 'free' } }), { code: 'MEDIA_INPUT' });
  assert.equal(host.listTasks('fixture').length, 0);
}));

test('dub: valid dub task is created paused for approval', () => fixture(({ host, source }) => {
  const t = host.submit({ projectId: 'fixture', operation: 'media.dub', params: { source: rel(host, source), targetLanguage: 'en', translationSource: 'supplied', translatedTexts: ['Hello.'] } });
  assert.equal(t.state, 'paused');
  assert.equal(t.input.operation, 'media.dub');
  assert.ok(host.status().media.operations.includes('media.dub'));
}));

test('whisper status: a CLI whose --help exceeds 2KB is still detected (regression)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-whisper-probe-'));
  try {
    const cli = path.join(dir, 'whisper-cli');
    fs.writeFileSync(cli, '#!/bin/sh\nyes "whisper-cli usage line with plenty of padding text" | head -n 120\nexit 0\n', { mode: 0o755 });
    const model = path.join(dir, 'ggml.bin');
    fs.writeFileSync(model, 'model');
    const status = whisperStatus({ WHISPER_CLI_PATH: cli, WHISPER_MODEL_PATH: model });
    assert.equal(status.cliConfigured, true);
    assert.equal(status.ready, true);
  } finally { fs.rmSync(dir, { force: true, recursive: true }); }
});
