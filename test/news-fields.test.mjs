import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NEWS_FIELDS, listNewsFields, newsFieldById, googleNewsRssUrl, classifyNewsField, scoreNewsItem } from '../src/lib/news-fields.mjs';
import { createIngestStore } from '../src/lib/ingest.mjs';
import { createOrchestrator, createSimulatedAi, defaultOrchestratorConfig } from '../src/lib/orchestrator.mjs';

test('news fields: catalog is complete and Google News URL is a plain RSS feed', () => {
  assert.equal(NEWS_FIELDS.length, 20);
  assert.equal(new Set(NEWS_FIELDS.map(f => f.id)).size, 20);
  for (const f of listNewsFields()) assert.ok(f.keywords.length >= 5, f.id);
  assert.equal(newsFieldById('the-thao').label, 'Thể thao');
  const url = googleNewsRssUrl('bóng đá Việt Nam');
  assert.match(url, /^https:\/\/news\.google\.com\/rss\/search\?q=/);
  assert.match(url, /hl=vi&gl=VN&ceid=VN:vi/);
});

test('news fields: classification follows keywords and never guesses', () => {
  assert.equal(classifyNewsField({ title: 'Đội tuyển thắng lớn ở vòng loại World Cup', summary: 'Cầu thủ ghi bàn ở phút 90.' }), 'the-thao');
  assert.equal(classifyNewsField({ title: 'VN-Index vượt mốc mới, ngân hàng đồng loạt tăng', summary: 'Chứng khoán sôi động.' }), 'kinh-doanh');
  assert.equal(classifyNewsField({ title: 'Trời hôm nay nhiều mây', summary: 'Nhiệt độ trung bình.' }), null);
});

test('news fields: score rewards fresh keyword-rich items, stays within 0..100', () => {
  const now = new Date('2026-10-18T10:00:00+07:00');
  const fresh = scoreNewsItem({ title: 'Đội tuyển bóng đá thắng trận cầu thủ lập công lớn', summary: 'Trận đấu bóng đá hấp dẫn với nhiều bàn thắng của đội tuyển quốc gia.', publishedAt: '2026-10-18T09:00:00+07:00' }, { fieldId: 'the-thao', now });
  const stale = scoreNewsItem({ title: 'Tin cũ', summary: '', publishedAt: '2026-10-10T09:00:00+07:00' }, { fieldId: 'the-thao', now });
  assert.ok(fresh.score > stale.score, `${fresh.score} > ${stale.score}`);
  assert.ok(fresh.score <= 100 && stale.score >= 0);
  assert.equal(fresh.basis, 'keyword-freshness');
});

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Fixture</title>
<item><title>Đội tuyển bóng đá thắng lớn tại World Cup</title><link>https://example.com/a1</link><description>Cầu thủ đội tuyển ghi bàn trong trận bóng đá tối qua.</description><pubDate>${new Date().toUTCString()}</pubDate></item>
<item><title>Chứng khoán tăng mạnh, VN-Index lập đỉnh</title><link>https://example.com/a2</link><description>Thị trường chứng khoán và ngân hàng cùng tăng điểm trong phiên giao dịch.</description><pubDate>${new Date().toUTCString()}</pubDate></item>
</channel></rss>`;

test('ingest: scanned cards carry field, score and basis; field sources pin their field', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-fields-'));
  const store = createIngestStore({ file: path.join(dir, 'ingest.json'), fetchImpl: async () => ({ ok: true, status: 200, text: async () => RSS }) });
  const s1 = store.addSource({ name: 'Tổng hợp', url: 'https://example.com/feed.xml' });
  const r = await store.scanSource(s1.id);
  assert.equal(r.added, 2);
  const cards = store.listCards();
  const sport = cards.find(c => c.link.endsWith('/a1'));
  const econ = cards.find(c => c.link.endsWith('/a2'));
  assert.equal(sport.fieldId, 'the-thao');
  assert.equal(econ.fieldId, 'kinh-doanh');
  assert.ok(sport.score > 0 && sport.scoreBasis === 'keyword-freshness');
  assert.equal(store.listCards({ fieldId: 'the-thao' }).length, 1);
  const s2 = store.addSource({ name: 'GN Thể thao', url: googleNewsRssUrl('thể thao'), fieldId: 'the-thao' });
  assert.equal(s2.fieldId, 'the-thao');
  assert.throws(() => store.addSource({ name: 'x', url: 'https://example.com/f', fieldId: 'khong-co' }), { code: 'INGEST_FIELD' });
});

function fieldWorld(cards) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-orch-fields-'));
  let seq = 0;
  const artifacts = new Map();
  const ingest = {
    listSources: () => [],
    scanSource: async () => ({ added: 0 }),
    listCards: ({ unusedOnly } = {}) => cards.filter(c => !unusedOnly || !c.usedByProjectId).map(c => ({ ...c })),
    markCardUsed: (id, projectId) => { const c = cards.find(x => x.id === id); if (c) c.usedByProjectId = projectId; },
  };
  const host = {
    mediaWorkspace: path.join(dir, 'media'),
    submit: ({ projectId, operation }) => { const id = 'task-' + (++seq); artifacts.set(id, { id, projectId, name: 'story.mp4', bytes: 2048 }); return { id }; },
    action: () => {},
    core: { queue: { drain: async () => {} }, state: { find: (id) => ({ id, state: 'completed' }) } },
    listArtifacts: (projectId) => [...artifacts.values()].filter(a => a.projectId === projectId),
    artifact: (id) => ({ bytes: Buffer.alloc(artifacts.get(id)?.bytes || 0, 3) }),
    publishRecords: { list: () => [] },
    refreshPublishMetrics: async () => [],
  };
  fs.mkdirSync(host.mediaWorkspace, { recursive: true });
  const orch = createOrchestrator({
    file: path.join(dir, 'orchestrator.json'), ingest, host,
    createProject: ({ name }) => ({ id: 'project-' + (++seq), name }),
    aiAdapters: { simulated: createSimulatedAi(), gateway: createSimulatedAi() },
    now: () => new Date('2026-10-18T09:00:00+07:00'),
    idgen: () => 'run-' + (++seq),
  });
  return { orch, cards };
}
function enableFields(orch, extra = {}) {
  const cfg = defaultOrchestratorConfig();
  cfg.enabled = true;
  cfg.pipelines['news-video'] = { ...cfg.pipelines['news-video'], enabled: true, aiMode: 'simulated', requireApproval: false, platforms: [], dailyCap: 9, activeHours: [0, 24], ...extra };
  orch.setConfig(cfg);
}

test('orchestrator: tick picks the highest-score card inside the enabled fields only', async () => {
  const cards = [
    { id: 'c-econ', title: 'Tin kinh tế điểm cao', summary: '', link: 'https://e.com/1', fieldId: 'kinh-doanh', score: 95, usedByProjectId: null },
    { id: 'c-sport-low', title: 'Tin thể thao điểm thấp', summary: '', link: 'https://e.com/2', fieldId: 'the-thao', score: 40, usedByProjectId: null },
    { id: 'c-sport-high', title: 'Tin thể thao điểm cao', summary: '', link: 'https://e.com/3', fieldId: 'the-thao', score: 70, usedByProjectId: null },
  ];
  const w = fieldWorld(cards);
  enableFields(w.orch, { fieldIds: ['the-thao'], perFieldDailyCap: 5 });
  const out = await w.orch.tick();
  assert.equal(out.started.length, 1);
  assert.equal(out.started[0].fieldId, 'the-thao');
  const run = w.orch.getRun(out.started[0].runId);
  assert.equal(run.cardId, 'c-sport-high', 'highest score inside the field wins, not the global highest');
  assert.equal(run.fieldId, 'the-thao');
});

test('orchestrator: per-field daily cap stops a second run for the same field', async () => {
  const cards = [
    { id: 'c1', title: 'Bóng đá sáng', summary: '', link: 'https://e.com/1', fieldId: 'the-thao', score: 80, usedByProjectId: null },
    { id: 'c2', title: 'Bóng đá chiều', summary: '', link: 'https://e.com/2', fieldId: 'the-thao', score: 60, usedByProjectId: null },
  ];
  const w = fieldWorld(cards);
  enableFields(w.orch, { fieldIds: [], perFieldDailyCap: 1 });
  const first = await w.orch.tick();
  assert.equal(first.started.length, 1);
  const second = await w.orch.tick();
  assert.equal(second.started.length, 0);
  assert.ok(second.skipped.some(s => s.reason === 'field-daily-cap'));
});

test('news fields: server routes and Radar UI are wired', () => {
  const server = fs.readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /\/api\/ingest\/fields/);
  assert.match(server, /fields-summary/);
  assert.match(server, /googleNewsRssUrl/);
  const radarHtml = fs.readFileSync(new URL('../public/tabs/radar.html', import.meta.url), 'utf8');
  const radarJs = fs.readFileSync(new URL('../public/tabs/radar.js', import.meta.url), 'utf8');
  assert.match(radarHtml, /id="radarField"/);
  assert.match(radarHtml, /id="radarTiles"/);
  assert.match(radarHtml, /id="radarFeatured"/);
  assert.doesNotMatch(radarHtml, /id="newsPanel"/);
  assert.match(radarJs, /radarInit/);
  assert.match(radarJs, /data-radar-tile/);
});
