import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-publish-data-'));
process.env.AI_PROJECT_OS_DATA_DIR = dataDir;

const { createIntegrationHost } = await import('../src/lib/integration-host.mjs');
const { unlockVault, lockVault, saveConnection } = await import('../src/lib/vault.mjs');
const { startMockPlatforms } = await import('./fixtures/mock-platforms.mjs');

const SAMPLE = new URL('../integrations/media-engine/artifacts/samples/source.mp4', import.meta.url);

test('publish tasks: youtube upload completes through the approval gate and records honestly', async (t) => {
  const mock = await startMockPlatforms({ port: 0 });
  t.after(() => mock.close());
  unlockVault('publish-fixture-vault');
  t.after(() => lockVault());
  saveConnection({ kind: 'youtube', secret: JSON.stringify({ accessToken: 'mock-access-token', refreshToken: 'mock-refresh' }), baseUrl: mock.baseUrl, meta: { channelTitle: 'Kênh thử nghiệm' } });

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-publish-host-'));
  const host = createIntegrationHost({ root, env: {}, clock: false });
  t.after(() => { host.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  const folder = path.join(host.mediaWorkspace, 'uploads');
  fs.mkdirSync(folder, { recursive: true });
  const video = path.join(folder, 'news.mp4');
  fs.copyFileSync(SAMPLE, video);
  const rel = path.relative(host.mediaWorkspace, video);

  // Validation + approval gate.
  assert.throws(() => host.submit({ projectId: 'fixture', operation: 'media.publish-youtube', params: { video: rel } }), { code: 'MEDIA_INPUT' });
  const task = host.submit({ projectId: 'fixture', operation: 'media.publish-youtube', params: { video: rel, title: 'Bản tin thử nghiệm', privacy: 'unlisted' } });
  assert.equal(task.state, 'paused');
  assert.equal(host.publishRecords.list().length, 0);

  host.action(task.id, 'approve');
  await host.core.queue.drain();
  const done = host.core.state.find(task.id);
  assert.equal(done.state, 'completed');

  const records = host.publishRecords.list({ projectId: 'fixture' });
  assert.equal(records.length, 1);
  assert.equal(records[0].platform, 'youtube');
  assert.equal(records[0].simulated, true);
  assert.match(records[0].url, /youtube\.com\/watch\?v=yt-/);
  assert.ok(host.listArtifacts('fixture').some(a => a.name === 'publish-record-youtube.json'));

  const metrics = await host.refreshPublishMetrics({ projectId: 'fixture' });
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0].ok, true);
  assert.equal(typeof metrics[0].metrics.views, 'number');
  assert.equal(host.publishRecords.list({ projectId: 'fixture' })[0].metrics.views, metrics[0].metrics.views);

  const state = await (await fetch(mock.baseUrl + '/__state')).json();
  assert.equal(state.youtube.videos.length, 1);
  assert.equal(state.youtube.videos[0].bytes, fs.statSync(video).size);

  const status = host.status();
  assert.equal(status.media.platforms.youtube.connected, true);
  assert.equal(status.media.platforms.youtube.simulated, true);
});

test('publish tasks: a platform without a linked account fails honestly after approval', async (t) => {
  unlockVault('publish-fixture-vault');
  t.after(() => lockVault());
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-publish-host2-'));
  const host = createIntegrationHost({ root, env: {}, clock: false });
  t.after(() => { host.stop(); fs.rmSync(root, { recursive: true, force: true }); });
  const folder = path.join(host.mediaWorkspace, 'uploads');
  fs.mkdirSync(folder, { recursive: true });
  const video = path.join(folder, 'clip.mp4');
  fs.copyFileSync(SAMPLE, video);
  const rel = path.relative(host.mediaWorkspace, video);
  const task = host.submit({ projectId: 'fixture', operation: 'media.publish-tiktok', params: { video: rel, title: 'Clip thử nghiệm' } });
  host.action(task.id, 'approve');
  await host.core.queue.drain();
  const done = host.core.state.find(task.id);
  assert.equal(done.state, 'failed');
  assert.equal(done.error?.code, 'BLOCKED_PUBLISH_AUTH');
  assert.equal(host.publishRecords.list().length, 0);
});
