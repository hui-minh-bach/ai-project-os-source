import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createIntegrationHost } from '../src/lib/integration-host.mjs';
import { generateImage, imageProviderStatus } from '../src/lib/image-gen.mjs';

const SAMPLE = new URL('../integrations/media-engine/artifacts/samples/source.mp4', import.meta.url);

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-image-'));
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

test('image: media.image rejects empty or oversized scene lists at submit', () => fixture(({ host }) => {
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.image', params: { scenes: [] } }), { code: 'MEDIA_INPUT' });
  const many = Array.from({ length: 25 }, (_, i) => ({ prompt: 'cảnh ' + i }));
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.image', params: { scenes: many } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.image', params: { scenes: [{ prompt: '  ' }] } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.image', params: { scenes: [{ prompt: 'ok' }], imageProvider: 'claude-account' } }), { code: 'MEDIA_INPUT' });
  assert.equal(host.listTasks('fixture').length, 0);
}));

test('image: media.image accepts a valid scene list and stays paused for approval', () => fixture(({ host }) => {
  const t = host.submit({ projectId: 'fixture', operation: 'media.image', params: { scenes: [{ name: 'Mở đầu', prompt: 'Sân trường hoa phượng buổi sáng' }] } });
  assert.equal(t.state, 'paused');
  assert.equal(t.input.operation, 'media.image');
}));

test('image: generation blocks honestly when no provider route exists', async () => {
  const status = imageProviderStatus();
  if (!status.available) {
    await assert.rejects(() => generateImage({ provider: 'auto', prompt: 'một sân trường', output: path.join(os.tmpdir(), 'aios-never.png') }), { code: 'BLOCKED_PROVIDER' });
  }
  await assert.rejects(() => generateImage({ provider: 'bogus', prompt: 'x', output: path.join(os.tmpdir(), 'aios-never.png') }), { code: 'MEDIA_INPUT' });
  await assert.rejects(() => generateImage({ provider: 'auto', prompt: '   ', output: path.join(os.tmpdir(), 'aios-never.png') }), { code: 'MEDIA_INPUT' });
});

test('concat-effects: submit requires a manual plan or a Concat connection', () => fixture(({ host, source }) => {
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.concat-effects', params: { source: rel(host, source), planSource: 'manual' } }), { code: 'MEDIA_INPUT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.concat-effects', params: { source: rel(host, source), planSource: 'manual', plan: { kind: 'edit', segments: [{ start: 0, end: 1 }] } } }), { code: 'BLOCKED_CONCAT' });
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.concat-effects', params: { planSource: 'reviewer' } }), { code: 'MEDIA_INPUT' });
  assert.equal(host.listTasks('fixture').length, 0);
}));

test('concat-effects: operation is registered in host status', () => fixture(({ host }) => {
  const ops = host.status().media.operations;
  assert.ok(ops.includes('media.image'));
  assert.ok(ops.includes('media.concat-effects'));
}));
