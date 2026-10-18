import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createOrchestrator, createSimulatedAi, defaultOrchestratorConfig } from '../src/lib/orchestrator.mjs';

function fakeWorld() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-orch-'));
  const cards = [{ id: 'card-1', title: 'Tin nóng buổi sáng', summary: 'Tóm tắt nội dung tin.', link: 'https://example.com/tin-1', usedByProjectId: null }];
  const ingest = {
    listCards: ({ unusedOnly } = {}) => cards.filter(c => !unusedOnly || !c.usedByProjectId),
    listSources: () => [],
    scanSource: async () => ({ added: 0 }),
    markCardUsed: (id, projectId) => { const c = cards.find(x => x.id === id); if (c) c.usedByProjectId = projectId; },
  };
  const artifacts = new Map();
  const records = [];
  const tasks = new Map();
  let seq = 0;
  const host = {
    mediaWorkspace: path.join(dir, 'media'),
    submit({ projectId, operation }) {
      const id = 'task-' + (++seq);
      tasks.set(id, { id, projectId, operation, state: 'paused' });
      if (operation === 'media.story') {
        if (host.externalMode) {
          const fp = path.join(dir, 'external-' + id + '.mp4');
          fs.writeFileSync(fp, Buffer.alloc(4096, 7));
          artifacts.set('art-' + id, { id: 'art-' + id, name: 'story-video.mp4', size: 4096, projectId, external: true, filePath: fp });
        } else artifacts.set('art-' + id, { id: 'art-' + id, name: 'story-video.mp4', bytes: 2048, projectId });
      }
      if (operation.startsWith('media.publish-')) records.push({ id: 'rec-' + id, platform: operation.replace('media.publish-', ''), projectId, url: 'https://example.com/watch/1', simulated: true, publishedAt: new Date().toISOString() });
      return { id, state: 'paused' };
    },
    action(id) { const t = tasks.get(id); if (t) t.state = 'approved'; },
    core: {
      queue: { drain: async () => { for (const t of tasks.values()) if (t.state === 'approved') t.state = 'completed'; } },
      state: { find: (id) => tasks.get(id) },
    },
    listArtifacts: (projectId) => [...artifacts.values()].filter(a => a.projectId === projectId),
    artifact: (id) => { const a = artifacts.get(id); return a?.external ? { metadata: {}, filePath: a.filePath } : { bytes: Buffer.alloc(a?.bytes || 0, 3) }; },
    publishRecords: { list: ({ projectId } = {}) => records.filter(r => !projectId || r.projectId === projectId) },
    refreshPublishMetrics: async () => [],
  };
  fs.mkdirSync(host.mediaWorkspace, { recursive: true });
  const orch = createOrchestrator({
    file: path.join(dir, 'orchestrator.json'),
    ingest, host,
    createProject: ({ name }) => ({ id: 'project-' + (++seq), name }),
    aiAdapters: {
      simulated: createSimulatedAi(),
      gateway: { mode: 'gateway', async writeNewsScript() { const e = new Error('Vault đang khóa; lập kế hoạch local vẫn dùng được.'); e.code = 'BLOCKED_PROVIDER'; throw e; }, async writeIdeaScript() { throw new Error('blocked'); }, async translateSegments() { throw new Error('blocked'); } },
    },
    now: () => new Date('2026-10-17T09:00:00+07:00'),
    idgen: () => 'run-' + (++seq),
  });
  return { dir, cards, records, orch, host };
}

function enableNews(orch, extra = {}) {
  const cfg = defaultOrchestratorConfig();
  cfg.enabled = true;
  cfg.pipelines['news-video'] = { ...cfg.pipelines['news-video'], enabled: true, aiMode: 'simulated', requireApproval: true, platforms: ['youtube'], dailyCap: 2, activeHours: [0, 24], ...extra };
  orch.setConfig(cfg);
}

test('orchestrator: large external artifacts (filePath, no inline bytes) are materialized and published', async () => {
  const w = fakeWorld();
  w.host.externalMode = true;
  enableNews(w.orch);
  const run = await w.orch.startRun('news-video', { cardId: 'card-1', title: 'Tin video lớn' });
  assert.equal(run.state, 'awaiting-approval');
  const done = await w.orch.approveRun(run.id);
  assert.equal(done.state, 'completed');
  assert.equal(w.records.length, 1);
});

test('orchestrator: news run produces, waits at the gate, then publishes after approval', async () => {
  const w = fakeWorld();
  enableNews(w.orch);
  const run = await w.orch.startRun('news-video', { cardId: 'card-1', title: 'Tin nóng buổi sáng' });
  assert.equal(run.state, 'awaiting-approval');
  assert.equal(run.aiMode, 'simulated');
  assert.ok(run.steps.some(s => s.name === 'ai.script' && s.detail?.provider === 'simulated-local'));
  assert.ok(run.steps.some(s => s.name === 'produce.story' && s.state === 'done'));
  assert.equal(w.records.length, 0);
  assert.equal(w.cards[0].usedByProjectId, run.projectId);

  const done = await w.orch.approveRun(run.id);
  assert.equal(done.state, 'completed');
  assert.equal(done.publish.length, 1);
  assert.equal(done.publish[0].platform, 'youtube');
  assert.equal(done.publish[0].simulated, true);
  assert.equal(w.records.length, 1);
});

test('orchestrator: busy guard, global stop and daily cap are enforced by code', async () => {
  const w = fakeWorld();
  enableNews(w.orch, { dailyCap: 1 });
  const run = await w.orch.startRun('news-video', { cardId: 'card-1', title: 'Tin 1' });
  assert.equal(run.state, 'awaiting-approval');
  await assert.rejects(w.orch.startRun('news-video', { cardId: 'card-1', title: 'Tin 2' }), { code: 'ORCHESTRATOR_BUSY' });
  const cfg = w.orch.getConfig();
  cfg.stopAll = true;
  w.orch.setConfig(cfg);
  await assert.rejects(w.orch.approveRun(run.id), { code: 'ORCHESTRATOR_STOPPED' });
  cfg.stopAll = false;
  w.orch.setConfig(cfg);
  const done = await w.orch.approveRun(run.id);
  assert.equal(done.state, 'completed');
  await assert.rejects(w.orch.startRun('news-video', { cardId: 'card-1', title: 'Tin 3' }), { code: 'ORCHESTRATOR_CAP' });
});

test('orchestrator: tick skips a pipeline that already has an active run', async () => {
  const w = fakeWorld();
  enableNews(w.orch);
  const run = await w.orch.startRun('news-video', { cardId: 'card-1', title: 'Tin đang chờ' });
  assert.equal(run.state, 'awaiting-approval');
  const out = await w.orch.tick();
  assert.equal(out.started.length, 0);
  assert.ok(out.skipped.some(s => s.pipelineId === 'news-video' && s.reason === 'run-active'));
});

test('orchestrator: a stale running run is recovered as interrupted on load', async () => {
  const w = fakeWorld();
  const file = path.join(w.dir, 'orchestrator.json');
  const stored = { config: defaultOrchestratorConfig(), runs: [{ id: 'stuck-1', pipeline: 'news-video', state: 'running', createdAt: new Date().toISOString(), steps: [], publish: [] }], lastIngestScanAt: null };
  fs.writeFileSync(file, JSON.stringify(stored));
  const orch2 = createOrchestrator({
    file,
    ingest: { listCards: () => [], listSources: () => [], scanSource: async () => ({}), markCardUsed: () => {} },
    host: {},
    createProject: () => ({ id: 'x' }),
    aiAdapters: { simulated: createSimulatedAi() },
  });
  const recovered = orch2.getRun('stuck-1');
  assert.equal(recovered.state, 'failed');
  assert.equal(recovered.error.code, 'ORCHESTRATOR_INTERRUPTED');
});

test('orchestrator: gateway mode fails the run honestly when no model is available', async () => {
  const w = fakeWorld();
  const cfg = defaultOrchestratorConfig();
  cfg.enabled = true;
  cfg.pipelines['news-video'] = { ...cfg.pipelines['news-video'], enabled: true, aiMode: 'gateway', activeHours: [0, 24] };
  w.orch.setConfig(cfg);
  const run = await w.orch.startRun('news-video', { cardId: 'card-1', title: 'Tin gateway' });
  assert.equal(run.state, 'failed');
  assert.equal(run.error.code, 'BLOCKED_PROVIDER');
});

test('orchestrator: tick scans and starts a news run from the oldest unused card', async () => {
  const w = fakeWorld();
  enableNews(w.orch);
  const out = await w.orch.tick();
  assert.equal(out.started.length, 1);
  assert.equal(out.started[0].pipelineId, 'news-video');
  assert.equal(out.started[0].state, 'awaiting-approval');
});
