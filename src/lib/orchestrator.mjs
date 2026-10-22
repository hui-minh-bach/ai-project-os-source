/**
 * Closed-loop orchestrator (M2 + M3).
 *
 * Turns inputs (news cards, an uploaded foreign video, an idea) into
 * finished, published deliverables by chaining the app's OWN tasks:
 * AI step (script/translation via the project's Worker model, or a clearly
 * labeled simulated stand-in) → media production tasks → the owner's
 * approval gate → platform publish tasks → metrics refresh.
 *
 * Determinism rules: schedules, daily caps, active hours and the stop
 * switch are code, never model decisions. Every run is persisted with its
 * step log; a step only counts as done when the underlying task completed
 * and (for publishing) the platform record exists.
 */
import fs from 'node:fs';
import { hashtagsForField } from './news-fields.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const mediaSubtitles = require('../../integrations/media-engine/src/subtitles.cjs');

function err(code, message) { const e = new Error(message); e.code = code; return e; }
const todayKey = (d) => d.toISOString().slice(0, 10);

export const PIPELINE_IDS = ['news-video', 'news-article', 'dub-video', 'idea-film'];
export function defaultOrchestratorConfig() {
  return {
    enabled: false,
    stopAll: false,
    ingestScanMinutes: 30,
    pipelines: {
      'news-video': { enabled: false, aiMode: 'gateway', requireApproval: true, platforms: ['youtube'], dailyCap: 2, activeHours: [7, 21], targetLanguage: 'vi', fieldIds: [], perFieldDailyCap: 1, musicSource: 'synthesized' },
      'news-article': { enabled: false, aiMode: 'gateway', requireApproval: true, platforms: ['facebook'], dailyCap: 2, activeHours: [7, 21], targetLanguage: 'vi', fieldIds: [], perFieldDailyCap: 1 },
      'dub-video': { enabled: false, aiMode: 'gateway', requireApproval: true, platforms: ['youtube'], dailyCap: 2, activeHours: [7, 21], sourceLanguage: 'en', targetLanguage: 'vi' },
      'idea-film': { enabled: false, aiMode: 'gateway', requireApproval: true, platforms: ['youtube'], dailyCap: 1, activeHours: [7, 21], targetLanguage: 'vi', musicSource: 'synthesized' },
    },
  };
}

/* -------- Reception meeting feed -------- */

/** Render recorded runs as a meeting-style event feed for the intake desk.
 * Every event is a deterministic rendering of a REAL run record (its creation,
 * its recorded steps, its gate and its outcome) — never invented dialogue.
 * The UI labels it as such; simulated steps keep their simulated label. */
export const PIPELINE_LABELS = Object.freeze({ 'news-video': 'Tin → Video', 'news-article': 'Tin → Bài viết', 'dub-video': 'Lồng tiếng video', 'idea-film': 'Ý tưởng → Phim' });
const FEED_STEP = Object.freeze({
  'project': ['Trưởng phòng tiếp nhận', 'lập hồ sơ dự án'],
  'ai.script': ['AI Biên kịch', 'viết kịch bản'],
  'produce.music': ['AI Sản xuất', 'chuẩn bị nhạc nền'],
  'produce.story': ['AI Sản xuất', 'dựng video'],
  'produce.article': ['AI Sản xuất', 'soạn bài viết'],
  'produce.dub': ['AI Sản xuất', 'lồng tiếng'],
  'analyze.transcribe': ['AI Phân tích', 'bóc băng lời thoại'],
  'ai.translate': ['AI Dịch thuật', 'dịch nội dung'],
  'metrics': ['AI Phát hành', 'cập nhật số liệu'],
  'run': ['Hệ thống', 'lượt chạy'],
});
function feedStepText(step) {
  const d = step.detail || {};
  if (step.name === 'gate') {
    if (step.state === 'waiting') return ['Trưởng phòng tiếp nhận', 'Sản phẩm đã xong — đang chờ Sếp Lâm duyệt đăng.'];
    if (step.state === 'approved') return ['Sếp Lâm', 'Đã duyệt — cho phép đăng.'];
    return ['Cổng duyệt', `Cổng duyệt: ${step.state}.`];
  }
  if (step.name.startsWith('publish:')) {
    const platform = step.name.slice('publish:'.length);
    if (platform === 'draft') return ['AI Phát hành', step.state === 'done' ? 'Đã tạo bản nháp bài đăng.' : 'Không tạo được bản nháp bài đăng.'];
    if (step.state === 'done') return ['AI Phát hành', `Đã đăng lên ${platform}${d.simulated ? ' (qua môi trường mô phỏng)' : ''}${d.url ? `: ${d.url}` : ''}.`];
    if (step.state === 'failed') return ['AI Phát hành', `Đăng lên ${platform} thất bại${d.code ? ` (${d.code})` : ''}.`];
    return ['AI Phát hành', `Đăng ${platform}: ${step.state}.`];
  }
  const [actor, work] = FEED_STEP[step.name] || ['Đội AI', step.name];
  if (step.state === 'done') {
    let extra = '';
    if (step.name === 'ai.script' || step.name === 'ai.translate') extra = d.aiMode === 'simulated' ? ' (AI mô phỏng)' : d.provider ? ` (model: ${d.provider})` : '';
    if (step.name === 'ai.translate' && Number.isFinite(d.segments)) extra += ` — ${d.segments} đoạn`;
    if (step.name === 'produce.article' && Number.isFinite(d.hashtags)) extra = ` — kèm ${d.hashtags} hashtag`;
    if (step.name === 'produce.music') extra = d.source === 'ace-step' ? ' (ACE-Step tại chỗ)' : d.source === 'synthesized' ? (d.fallbackFrom ? ' (nhạc tổng hợp — ACE-Step chưa sẵn sàng, đã ghi rõ)' : ' (nhạc tổng hợp)') : ' (không có nhạc nền)';
    return [actor, `Đã xong bước ${work}${extra}.`];
  }
  if (step.state === 'failed') return [actor, `Lỗi ở bước ${work}${d.code ? ` (${d.code})` : ''}.`];
  if (step.state === 'skipped') return [actor, `Bỏ qua bước ${work}.`];
  return [actor, `Bước ${work}: ${step.state}.`];
}
export function buildRunFeed(runs, { limit = 150, nowMs = Date.now() } = {}) {
  const events = [];
  for (const run of Array.isArray(runs) ? runs : []) {
    if (!run || typeof run !== 'object') continue;
    const title = String(run.title || 'Lượt chạy').slice(0, 160);
    const label = PIPELINE_LABELS[run.pipeline] || run.pipeline || '';
    events.push({ id: `${run.id}:created`, runId: run.id, at: run.createdAt || null, actor: 'Trưởng phòng tiếp nhận', kind: 'run.created', state: 'info', pipeline: run.pipeline || null, text: `Nhận việc: “${title}”${label ? ` — quy trình ${label}` : ''}.` });
    (run.steps || []).forEach((step, i) => {
      if (!step || typeof step !== 'object') return;
      const [actor, text] = feedStepText(step);
      events.push({ id: `${run.id}:step:${i}`, runId: run.id, at: step.at || null, actor, kind: step.name, state: step.state, pipeline: run.pipeline || null, text });
    });
    if (run.state === 'running') {
      const last = (run.steps || []).at(-1);
      events.push({ id: `${run.id}:live`, runId: run.id, at: new Date(nowMs).toISOString(), actor: 'Trưởng phòng tiếp nhận', kind: 'run.live', state: 'running', pipeline: run.pipeline || null, text: `Đang chạy “${title}” — bước gần nhất: ${last ? last.name : 'khởi động'}.` });
    }
    if (run.state === 'completed') events.push({ id: `${run.id}:done`, runId: run.id, at: run.completedAt || (run.steps || []).at(-1)?.at || null, actor: 'Trưởng phòng tiếp nhận', kind: 'run.completed', state: 'done', pipeline: run.pipeline || null, text: `Hoàn tất lượt chạy “${title}”.` });
    if (run.state === 'failed') events.push({ id: `${run.id}:failed`, runId: run.id, at: (run.steps || []).at(-1)?.at || null, actor: 'Hệ thống', kind: 'run.failed', state: 'failed', pipeline: run.pipeline || null, text: `Lượt chạy “${title}” thất bại${run.error?.code ? ` (${run.error.code})` : ''}${run.error?.message ? `: ${String(run.error.message).slice(0, 200)}` : ''}.` });
  }
  events.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  return events.slice(-limit);
}

/* -------- AI adapters -------- */

/** Simulated stand-in: deterministic, uses only the input's own text for
 * scripts, and a small word-substitution glossary for translations. It is
 * ALWAYS labeled aiMode 'simulated' in run records — never a hidden fake. */
export function createSimulatedAi() {
  const glossary = new Map(Object.entries({
    the: '', a: '', an: '', of: 'của', to: 'để', and: 'và', in: 'trong', is: 'là', we: 'chúng ta', you: 'bạn',
    moon: 'Mặt Trăng', space: 'vũ trụ', world: 'thế giới', people: 'con người', today: 'hôm nay',
    choose: 'chọn', go: 'đi', will: 'sẽ', this: 'này', that: 'đó', because: 'bởi vì', not: 'không',
    are: 'là', easy: 'dễ', hard: 'khó', goal: 'mục tiêu', best: 'tốt nhất', our: 'của chúng ta',
  }));
  return {
    mode: 'simulated',
    async writeNewsScript({ card }) {
      const title = String(card.title || '').trim();
      const summary = String(card.summary || '').trim();
      const body = String(card.fullText || '').trim() || summary;
      const text = [title.endsWith('.') ? title : title + '.', body, `Thông tin được tổng hợp và viết lại từ nguồn: ${card.link}`].filter(Boolean).join(' ').slice(0, 900);
      return { text, publishTitle: title.slice(0, 100), publishDescription: (summary + `\nNguồn: ${card.link}`).slice(0, 1000), provider: 'simulated-local', model: null };
    },
    async writeIdeaScript({ idea }) {
      const text = String(idea || '').trim().slice(0, 900);
      return { text, publishTitle: text.split(/[.!?\n]/)[0].slice(0, 100), publishDescription: text.slice(0, 500), provider: 'simulated-local', model: null };
    },
    async translateSegments({ segments }) {
      const texts = segments.map(s => String(s.text || '').split(/\s+/).map(w => { const k = w.toLowerCase().replace(/[^a-z']/g, ''); return glossary.has(k) ? glossary.get(k) : w; }).join(' ').replace(/\s+/g, ' ').trim().slice(0, 1000) || 'Đoạn dịch mô phỏng.');
      return { texts, provider: 'simulated-local', model: null };
    },
  };
}

/** Gateway adapter: the project's bound Worker-role model does the work.
 * Blocks honestly (BLOCKED_PROVIDER) when no verified model is bound. */
export function createGatewayAi({ writeTextWithModel, translateSegmentsWithModel }) {
  return {
    mode: 'gateway',
    async writeNewsScript({ projectId, card }) {
      const r = await writeTextWithModel(projectId, {
        instructions: 'Bạn là biên tập viên tin tức video. Viết lời dẫn đọc thành tiếng cho một video tin ngắn 60-90 giây bằng tiếng Việt: viết LẠI bằng lời của mình từ thẻ tin được cung cấp, không sao chép nguyên văn, giữ đúng sự kiện, cuối lời dẫn ghi rõ nguồn. Chỉ trả về lời dẫn thuần văn, không tiêu đề, không markdown.',
        prompt: JSON.stringify({ title: card.title, summary: card.summary, body: String(card.fullText || '').slice(0, 3500) || undefined, link: card.link }),
        maxChars: 1400,
      });
      return { text: r.text, publishTitle: String(card.title || '').slice(0, 100), publishDescription: (String(card.summary || '') + `\nNguồn: ${card.link}`).slice(0, 1000), provider: r.provider, model: r.model };
    },
    async writeIdeaScript({ projectId, idea }) {
      const r = await writeTextWithModel(projectId, {
        instructions: 'Bạn là biên kịch phim ngắn. Từ ý tưởng được cung cấp, viết lời kể chuyện đọc thành tiếng cho một phim ngắn bằng tiếng Việt, mạch lạc, có mở–thân–kết. Chỉ trả về lời kể thuần văn, không markdown.',
        prompt: String(idea || ''), maxChars: 2000,
      });
      const firstLine = r.text.split(/[.!?\n]/)[0] || 'Phim ngắn';
      return { text: r.text, publishTitle: firstLine.slice(0, 100), publishDescription: r.text.slice(0, 500), provider: r.provider, model: r.model };
    },
    async translateSegments({ projectId, segments, targetLanguage }) {
      const r = await translateSegmentsWithModel(projectId, segments, targetLanguage);
      return { texts: r.texts, provider: r.provider, model: r.model };
    },
  };
}

/* -------- Orchestrator -------- */

export function createOrchestrator({ file, ingest, host, createProject, aiAdapters, storyMusic = null, now = () => new Date(), idgen = () => crypto.randomUUID() }) {
  let state;
  function load() {
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')); if (!state || typeof state !== 'object') throw 0; }
    catch { state = { config: defaultOrchestratorConfig(), runs: [], lastIngestScanAt: null }; }
    if (!state.config) state.config = defaultOrchestratorConfig();
    if (!Array.isArray(state.runs)) state.runs = [];
    // A run still marked 'running' at load time was interrupted by the app
    // stopping mid-flight; record that honestly instead of leaving a
    // phantom active run that would block the pipeline forever.
    let recovered = false;
    for (const r of state.runs) if (r.state === 'running') { r.state = 'failed'; r.error = { code: 'ORCHESTRATOR_INTERRUPTED', message: 'Ứng dụng đã dừng giữa chừng khi lượt chạy đang thực hiện.' }; recovered = true; }
    if (recovered) save();
  }
  function save() {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = file + '.tmp-' + idgen();
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  load();

  const aiFor = (pipelineCfg) => {
    const mode = pipelineCfg.aiMode === 'simulated' ? 'simulated' : 'gateway';
    const adapter = aiAdapters[mode];
    if (!adapter) throw err('ORCHESTRATOR_AI', `Chưa có bộ AI cho chế độ ${mode}.`);
    return adapter;
  };

  function getConfig() { return structuredClone(state.config); }
  function setConfig(next) {
    const base = defaultOrchestratorConfig();
    const merged = { ...base, ...(next || {}) };
    merged.pipelines = { ...base.pipelines };
    for (const id of PIPELINE_IDS) if (next?.pipelines?.[id]) merged.pipelines[id] = { ...base.pipelines[id], ...next.pipelines[id] };
    state.config = merged; save();
    return getConfig();
  }
  function listRuns() { return structuredClone(state.runs).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); }
  function getRun(id) { return state.runs.find(r => r.id === id) || null; }
  function activeRun(pipelineId) { return state.runs.find(r => r.pipeline === pipelineId && (r.state === 'running' || r.state === 'awaiting-approval')) || null; }

  function runsTodayForField(pipelineId, fieldId) {
    if (!fieldId) return 0;
    const key = todayKey(now());
    return state.runs.filter(r => r.pipeline === pipelineId && r.fieldId === fieldId && String(r.createdAt).slice(0, 10) === key && r.state !== 'failed').length;
  }
  function runsToday(pipelineId) {
    const key = todayKey(now());
    return state.runs.filter(r => r.pipeline === pipelineId && String(r.createdAt).slice(0, 10) === key && r.state !== 'failed').length;
  }
  function withinActiveHours(cfg) {
    const h = now().getHours();
    const [from, to] = cfg.activeHours || [0, 24];
    return h >= from && h < to;
  }

  async function runTask(projectId, operation, params) {
    const t = host.submit({ projectId, operation, params });
    host.action(t.id, 'approve');
    await host.core.queue.drain();
    const done = host.core.state.find(t.id);
    if (!done || done.state !== 'completed') {
      const e = new Error(done?.error?.message || `Task ${operation} không hoàn thành.`);
      e.code = done?.error?.code || 'ORCHESTRATOR_TASK';
      throw e;
    }
    return done;
  }

  function step(run, name, stateName, detail) {
    run.steps.push({ name, state: stateName, at: now().toISOString(), ...(detail ? { detail } : {}) });
    save();
  }

  /** Music for a story run, resolved by the host app (server): ACE-Step
   * local worker when bound + READY, else the app's synthesized bed —
   * always journaled with its source label, never silently swapped.
   * Returns {file, detail} or null when no resolver is wired. */
  async function resolveMusic(run, cfg, script) {
    if (typeof storyMusic !== 'function') return null;
    try { return await storyMusic({ run, cfg, script }); }
    catch (e) { return { file: null, detail: { source: 'none', error: String(e.message || e).slice(0, 200) } }; }
  }

  function materializeVideo(run, projectId, beforeIds) {
    const arts = host.listArtifacts(projectId).filter(a => !beforeIds.has(a.id) && /\.mp4$/i.test(a.name || ''));
    if (!arts.length) throw err('ORCHESTRATOR_ARTIFACT', 'Bước sản xuất không tạo được tệp video MP4.');
    const sizeOf = (a) => a.bytes ?? a.size ?? 0;
    arts.sort((a, b) => sizeOf(b) - sizeOf(a));
    const art = arts[0];
    const dir = path.join(host.mediaWorkspace, 'orchestrator');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, `${run.id}-final.mp4`);
    // The host returns inline bytes for core artifacts, but large media is
    // stored externally and comes back as a verified file path instead.
    const got = host.artifact(art.id);
    if (got && Buffer.isBuffer(got.bytes)) fs.writeFileSync(file, got.bytes, { mode: 0o600 });
    else if (got && typeof got.filePath === 'string') fs.copyFileSync(got.filePath, file);
    else throw err('ORCHESTRATOR_ARTIFACT', 'Không đọc được nội dung video từ artifact của bước sản xuất.');
    return path.relative(host.mediaWorkspace, file);
  }

  async function publishAll(run, projectId, videoRel, meta) {
    const cfg = state.config.pipelines[run.pipeline];
    const results = [];
    const failures = [];
    // Each destination is tracked separately: one platform failing must not
    // block the others, and the run record shows exactly which posts exist,
    // so a retry never silently duplicates a post that already went out.
    for (const platform of cfg.platforms) {
      const op = 'media.publish-' + platform;
      try {
        await runTask(projectId, op, { video: videoRel, title: meta.publishTitle, description: meta.publishDescription, privacy: platform === 'youtube' ? 'unlisted' : undefined });
        const record = host.publishRecords.list({ projectId }).filter(r => r.platform === platform).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))[0];
        results.push({ platform, recordId: record?.id || null, url: record?.url || null, simulated: record?.simulated ?? null });
        step(run, 'publish:' + platform, 'done', { url: record?.url || null, simulated: record?.simulated ?? null });
      } catch (e) {
        failures.push({ platform, code: e.code || 'PUBLISH_FAILED', message: String(e.message || e).slice(0, 300) });
        step(run, 'publish:' + platform, 'failed', { code: e.code || 'PUBLISH_FAILED' });
      }
    }
    run.publish = results;
    if (failures.length) {
      const e = new Error(`Đăng thất bại ${failures.length}/${cfg.platforms.length} nền tảng: ${failures.map(f => `${f.platform} (${f.code})`).join(', ')}. Các nền tảng đã đăng thành công vẫn giữ nguyên bản ghi.`);
      e.code = 'ORCHESTRATOR_PUBLISH_PARTIAL';
      e.failures = failures;
      throw e;
    }
    try { await host.refreshPublishMetrics({ projectId }); step(run, 'metrics', 'done'); }
    catch (e) { step(run, 'metrics', 'skipped', { error: e.code || 'METRICS_FAILED' }); }
  }

  async function executeRun(run) {
    const cfg = state.config.pipelines[run.pipeline];
    const ai = aiFor(cfg);
    run.aiMode = ai.mode;
    const project = createProject({ name: run.title, idea: run.ideaText || run.title });
    run.projectId = project.id;
    step(run, 'project', 'done', { projectId: project.id });
    let videoRel, meta;

    if (run.pipeline === 'news-video') {
      const card = ingest.listCards().find(c => c.id === run.cardId);
      if (!card) throw err('ORCHESTRATOR_INPUT', 'Thẻ tin không còn tồn tại.');
      const script = await ai.writeNewsScript({ projectId: project.id, card });
      meta = script;
      step(run, 'ai.script', 'done', { provider: script.provider, model: script.model || null, aiMode: ai.mode });
      { const tags = hashtagsForField(run.fieldId || card.fieldId); if (tags.length) script.publishDescription = (String(script.publishDescription || '') + '\n\n' + tags.join(' ')).slice(0, 1000); }
      const music = await resolveMusic(run, cfg, script);
      if (music) step(run, 'produce.music', 'done', music.detail || { source: 'none' });
      const before = new Set(host.listArtifacts(project.id).map(a => a.id));
      await runTask(project.id, 'media.story', { text: script.text, voice: cfg.targetLanguage || 'vi', rights: 'summarized-from-source-with-credit', ...(music?.file ? { music: music.file } : {}) });
      step(run, 'produce.story', 'done');
      videoRel = materializeVideo(run, project.id, before);
      ingest.markCardUsed(card.id, project.id);
    } else if (run.pipeline === 'news-article') {
      const card = ingest.listCards().find(c => c.id === run.cardId);
      if (!card) throw err('ORCHESTRATOR_INPUT', 'Thẻ tin không còn tồn tại.');
      const script = await ai.writeNewsScript({ projectId: project.id, card });
      meta = script;
      step(run, 'ai.script', 'done', { provider: script.provider, model: script.model || null, aiMode: ai.mode });
      const tags = hashtagsForField(run.fieldId || card.fieldId);
      const caption = `${script.publishTitle}\n\n${script.publishDescription}\n\n${tags.join(' ')}`.trim();
      run.article = { title: script.publishTitle, body: script.text, description: script.publishDescription, caption, hashtags: tags, sourceUrl: card.link || null };
      step(run, 'produce.article', 'done', { hashtags: tags.length });
      ingest.markCardUsed(card.id, project.id);
    } else if (run.pipeline === 'idea-film') {
      const script = await ai.writeIdeaScript({ projectId: project.id, idea: run.ideaText });
      meta = script;
      step(run, 'ai.script', 'done', { provider: script.provider, model: script.model || null, aiMode: ai.mode });
      const music = await resolveMusic(run, cfg, script);
      if (music) step(run, 'produce.music', 'done', music.detail || { source: 'none' });
      const before = new Set(host.listArtifacts(project.id).map(a => a.id));
      await runTask(project.id, 'media.story', { text: script.text, voice: cfg.targetLanguage || 'vi', rights: 'original', ...(music?.file ? { music: music.file } : {}) });
      step(run, 'produce.story', 'done');
      videoRel = materializeVideo(run, project.id, before);
    } else if (run.pipeline === 'dub-video') {
      const params = { source: run.sourceVideo, sourceLanguage: cfg.sourceLanguage || 'en', targetLanguage: cfg.targetLanguage || 'vi', ttsProvider: ['local','heygen','fpt','kokoro'].includes(cfg.ttsProvider) ? cfg.ttsProvider : 'local' };
      if (ai.mode === 'simulated') {
        const before = new Set(host.listArtifacts(project.id).map(a => a.id));
        // Copy the source into this project's media flow by analyzing it in
        // the original (upload) project is not possible; the dub task reads
        // from the shared media workspace, so it can run in this project.
        await runTask(project.id, 'media.analyze', { source: run.sourceVideo, transcribe: true, language: params.sourceLanguage });
        step(run, 'analyze.transcribe', 'done');
        const arts = host.listArtifacts(project.id).filter(a => !before.has(a.id) && /captions.*\.srt$/i.test(a.name || ''));
        if (!arts.length) throw err('ORCHESTRATOR_ARTIFACT', 'Không lấy được phụ đề từ bước nghe.');
        const srt = host.artifact(arts[0].id).bytes.toString('utf8');
        const segments = mediaSubtitles.parseSrt(srt);
        const tr = await ai.translateSegments({ projectId: project.id, segments, targetLanguage: params.targetLanguage });
        step(run, 'ai.translate', 'done', { provider: tr.provider, model: tr.model || null, aiMode: ai.mode, segments: segments.length });
        params.translationSource = 'supplied';
        params.translatedTexts = tr.texts;
      } else {
        params.translationSource = 'provider';
      }
      const before = new Set(host.listArtifacts(project.id).map(a => a.id));
      await runTask(project.id, 'media.dub', params);
      step(run, 'produce.dub', 'done');
      videoRel = materializeVideo(run, project.id, before);
      meta = { publishTitle: run.title, publishDescription: `Bản lồng tiếng ${params.sourceLanguage} → ${params.targetLanguage} được tạo bởi AI Project OS.` };
    }

    if (cfg.requireApproval) {
      run.state = 'awaiting-approval';
      run.finalVideo = videoRel;
      run.publishMeta = meta;
      step(run, 'gate', 'waiting');
      save();
      return run;
    }
    await publishAll(run, project.id, videoRel, meta);
    run.state = 'completed';
    run.completedAt = now().toISOString();
    save();
    return run;
  }

  async function startRun(pipelineId, input = {}) {
    if (!PIPELINE_IDS.includes(pipelineId)) throw err('ORCHESTRATOR_PIPELINE', 'Quy trình không hợp lệ.');
    if (state.config.stopAll) throw err('ORCHESTRATOR_STOPPED', 'Nút dừng toàn cục đang bật — vòng khép kín đang dừng.');
    const cfg = state.config.pipelines[pipelineId];
    if (activeRun(pipelineId)) throw err('ORCHESTRATOR_BUSY', `Quy trình ${pipelineId} đang có một lượt chạy chưa kết thúc. Hãy chờ hoặc duyệt lượt đó trước.`);
    if (runsToday(pipelineId) >= (cfg.dailyCap || 1)) throw err('ORCHESTRATOR_CAP', `Đã đạt trần ${cfg.dailyCap} sản phẩm hôm nay cho quy trình ${pipelineId}.`);
    const inputCard = (pipelineId === 'news-video' || pipelineId === 'news-article') && input.cardId ? ingest.listCards().find(c => c.id === input.cardId) : null;
    const run = {
      id: idgen(), pipeline: pipelineId, state: 'running', createdAt: now().toISOString(),
      cardId: input.cardId || null, fieldId: inputCard?.fieldId || null, sourceVideo: input.sourceVideo || null,
      title: String(input.title || (pipelineId === 'news-video' ? 'Bản tin tự động' : pipelineId === 'dub-video' ? 'Video lồng tiếng tự động' : 'Phim từ ý tưởng')).slice(0, 160),
      ideaText: input.ideaText ? String(input.ideaText).slice(0, 4000) : null,
      steps: [], projectId: null, publish: [], error: null,
    };
    state.runs.push(run); save();
    try { await executeRun(run); }
    catch (e) { run.state = 'failed'; run.error = { code: e.code || 'ORCHESTRATOR_RUN', message: String(e.message || e).slice(0, 400), ...(Array.isArray(e.failures) ? { failures: e.failures } : {}) }; step(run, 'run', 'failed', { code: run.error.code }); save(); }
    return structuredClone(run);
  }

  function publishArticleDraft(run) {
    const rec = host.publishRecords.append({ platform: 'facebook', projectId: run.projectId, taskId: null, title: run.article?.title || run.title, url: null, draft: true, caption: run.article?.caption || '', hashtags: run.article?.hashtags || [], sourceUrl: run.article?.sourceUrl || null, publishedAt: now().toISOString(), endpointHost: null, simulated: false, metrics: null, metricsUpdatedAt: null });
    step(run, 'publish:draft', 'done', { recordId: rec?.id || null });
    run.publish = [{ platform: 'facebook', recordId: rec?.id || null, url: null, simulated: false, draft: true }];
  }

  async function approveRun(id) {
    const run = getRun(id);
    if (!run) throw err('ORCHESTRATOR_NOT_FOUND', 'Không tìm thấy lượt chạy.');
    if (run.state !== 'awaiting-approval') throw err('ORCHESTRATOR_STATE', 'Lượt chạy không ở cổng duyệt.');
    if (state.config.stopAll) throw err('ORCHESTRATOR_STOPPED', 'Nút dừng toàn cục đang bật — không thể duyệt đăng lúc này.');
    run.state = 'running';
    step(run, 'gate', 'approved');
    try {
      if (run.pipeline === 'news-article') publishArticleDraft(run);
      else await publishAll(run, run.projectId, run.finalVideo, run.publishMeta);
      run.state = 'completed';
      run.completedAt = now().toISOString();
    } catch (e) { run.state = 'failed'; run.error = { code: e.code || 'ORCHESTRATOR_RUN', message: String(e.message || e).slice(0, 400), ...(Array.isArray(e.failures) ? { failures: e.failures } : {}) }; }
    save();
    return structuredClone(run);
  }

  /** One scheduler tick: scan due ingest sources, then start at most one
   * run per enabled pipeline within its active hours and daily cap. */
  async function tick() {
    const out = { scanned: 0, started: [], skipped: [] };
    if (!state.config.enabled || state.config.stopAll) return out;
    const scanEveryMs = Math.max(1, state.config.ingestScanMinutes || 30) * 60000;
    const last = state.lastIngestScanAt ? Date.parse(state.lastIngestScanAt) : 0;
    if (now().getTime() - last >= scanEveryMs) {
      for (const source of ingest.listSources().filter(s => s.enabled)) {
        try { await ingest.scanSource(source.id); out.scanned++; } catch { /* lỗi nguồn được ghi trong source.lastError */ }
      }
      state.lastIngestScanAt = now().toISOString(); save();
    }
    for (const pipelineId of PIPELINE_IDS) {
      const cfg = state.config.pipelines[pipelineId];
      if (!cfg.enabled) continue;
      if (activeRun(pipelineId)) { out.skipped.push({ pipelineId, reason: 'run-active' }); continue; }
      if (!withinActiveHours(cfg)) { out.skipped.push({ pipelineId, reason: 'outside-active-hours' }); continue; }
      if (runsToday(pipelineId) >= (cfg.dailyCap || 1)) { out.skipped.push({ pipelineId, reason: 'daily-cap' }); continue; }
      if (pipelineId === 'news-video') {
        const fieldIds = Array.isArray(cfg.fieldIds) ? cfg.fieldIds : [];
        const perFieldCap = Number(cfg.perFieldDailyCap ?? 1);
        const candidates = ingest.listCards({ unusedOnly: true })
          .filter(c => !fieldIds.length || (c.fieldId && fieldIds.includes(c.fieldId)))
          .sort((a, b) => (b.score || 0) - (a.score || 0));
        const card = candidates.find(c => !(perFieldCap > 0 && c.fieldId && runsTodayForField(pipelineId, c.fieldId) >= perFieldCap));
        if (!card) { out.skipped.push({ pipelineId, reason: candidates.length ? 'field-daily-cap' : 'no-unused-card' }); continue; }
        const run = await startRun(pipelineId, { cardId: card.id, title: card.title });
        out.started.push({ pipelineId, runId: run.id, state: run.state, fieldId: run.fieldId || null });
      }
      // dub-video and idea-film need explicit inputs (a video / an idea);
      // they are started manually or by future input watchers, not by tick.
    }
    return out;
  }

  return { getConfig, setConfig, listRuns, getRun, startRun, approveRun, tick };
}
