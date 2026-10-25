import test, { after } from 'node:test';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';
const runtime = isolatedRuntime('local-workers');
after(() => runtime.cleanup());
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const lw = await runtime.import('src/lib/local-workers.mjs');
const { DATA_DIR } = await runtime.import('src/lib/store.mjs');
const { run: realRun } = await runtime.import('src/lib/shell.mjs');
// orchestrator.mjs requires files under integrations/ at module load, so it
// cannot come from the src-only isolated copy — import it directly, exactly
// like test/orchestrator.test.mjs does. It never touches DATA_DIR itself
// (its state file is injected), so this stays hermetic.
const { createOrchestrator, createSimulatedAi, defaultOrchestratorConfig } = await import('../src/lib/orchestrator.mjs');
const { generateImage, IMAGE_PROVIDERS, imageProviderStatus } = await runtime.import('src/lib/image-gen.mjs');
const { unlockVault, saveConnection, lockVault } = await runtime.import('src/lib/vault.mjs');

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const caseDir = (name) => { const d = path.join(DATA_DIR, 'lw-' + name); fs.mkdirSync(d, { recursive: true }); return d; };

function zipOf(entries) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'lw-zip-'));
  for (const [name, content] of Object.entries(entries)) {
    const p = path.join(staging, name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  const out = staging + '.zip';
  const script = 'import zipfile,sys,os\nsrc,dst=sys.argv[1],sys.argv[2]\nwith zipfile.ZipFile(dst,"w") as z:\n    [z.write(os.path.join(r,f),os.path.relpath(os.path.join(r,f),src)) for r,ds,fs_ in os.walk(src) for f in fs_]\n';
  const r = spawnSync('python3', ['-c', script, staging, out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const bytes = fs.readFileSync(out);
  fs.rmSync(staging, { recursive: true, force: true }); fs.rmSync(out, { force: true });
  return bytes;
}

function fakeFetch(map) {
  return async (url) => {
    const bytes = map[String(url)];
    if (!bytes) return { ok: false, status: 404, body: null };
    return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }) };
  };
}

const ACE_ZIP = zipOf({ 'ACE-Step-1.5/start_api_server.bat': '@echo fixture\r\n', 'ACE-Step-1.5/README.txt': 'fixture' });
const SD_ZIP = zipOf({ 'sd-cli': '#!/bin/sh\necho fixture\n', 'sd-server': 'fixture' });
const MODEL = Buffer.alloc(8192, 4);

function fixtureCatalog({ aceSha = sha(ACE_ZIP), fluxModelSha = sha(MODEL) } = {}) {
  return [
    { id: 'ace-step', operation: 'media.music', kind: 'download', platforms: [process.platform], name: 'ACE fixture', shortName: 'ACE', license: 'MIT', purpose: 'fixture', requirements: 'fixture',
      artifacts: [{ name: 'ACE-Step-1.5.zip', role: 'archive', extractTo: 'app', url: 'https://fixture.local/ace.zip', sha256: aceSha, size: ACE_ZIP.length }] },
    { id: 'flux2-klein', operation: 'image.local', kind: 'download', platforms: [process.platform], name: 'FLUX fixture', shortName: 'FLUX', license: 'Apache-2.0', purpose: 'fixture', requirements: 'fixture',
      artifacts: [
        { name: 'sd-bin.zip', role: 'archive', extractTo: 'bin', url: 'https://fixture.local/sd.zip', sha256: sha(SD_ZIP), size: SD_ZIP.length },
        { name: 'flux-2-klein-4b-Q4_0.gguf', role: 'model', dest: 'models/flux-2-klein-4b-Q4_0.gguf', url: 'https://fixture.local/dit.gguf', sha256: fluxModelSha, size: MODEL.length },
        { name: 'Qwen3-4B-Q4_K_M.gguf', role: 'model', dest: 'models/Qwen3-4B-Q4_K_M.gguf', url: 'https://fixture.local/qwen.gguf', sha256: fluxModelSha, size: MODEL.length },
        { name: 'flux2-vae.safetensors', role: 'model', dest: 'models/flux2-vae.safetensors', url: 'https://fixture.local/vae.st', sha256: fluxModelSha, size: MODEL.length },
      ] },
  ];
}
const FIXTURE_BYTES = { 'https://fixture.local/ace.zip': ACE_ZIP, 'https://fixture.local/sd.zip': SD_ZIP, 'https://fixture.local/dit.gguf': MODEL, 'https://fixture.local/qwen.gguf': MODEL, 'https://fixture.local/vae.st': MODEL };
const HI_VRAM = async () => ({ vramMB: 16384, source: 'fixture', gpuName: 'Fixture RTX' });
const LO_VRAM = async () => ({ vramMB: 4096, source: 'fixture', gpuName: 'Fixture GTX 4G' });
const fakeFfmpeg = async (cmd, args) => { fs.writeFileSync(args[args.length - 1], Buffer.alloc(2048, 5)); return { code: 0, stdout: '', stderr: '' }; };

test('shipped catalog pins are complete, https, and FLUX stays klein-4B only', () => {
  for (const def of lw.WORKER_CATALOG) {
    for (const platform of ['win32', 'linux', 'darwin']) {
      for (const a of lw.workerArtifacts(def, platform)) {
        assert.match(a.url, /^https:\/\//, a.url);
        assert.match(a.sha256, /^[a-f0-9]{64}$/, a.name);
        assert.ok(a.size > 0, a.name);
      }
    }
  }
  const flux = lw.WORKER_CATALOG.find(w => w.id === 'flux2-klein');
  const models = lw.workerArtifacts(flux, 'win32').filter(a => a.role === 'model');
  assert.equal(models.length, 3);
  assert.match(models[0].url, /klein-4B/i);
  for (const a of lw.workerArtifacts(flux, 'win32')) assert.doesNotMatch(a.url, /flux[^/]*(9b|-dev|_dev)/i, a.url);
  const ace = lw.WORKER_CATALOG.find(w => w.id === 'ace-step');
  assert.equal(ace.license, 'MIT'); assert.equal(flux.license, 'Apache-2.0');
  assert.ok(lw.workerDownloadSize(flux, 'win32') > 5_000_000_000, 'flux pack is the real ~5.3 GB');
});

test('state machine: NOT_INSTALLED -> install -> READY -> DISABLED -> READY -> remove', async () => {
  const w = lw.createLocalWorkers({ dataDir: caseDir('sm'), catalog: fixtureCatalog(), fetchImpl: fakeFetch(FIXTURE_BYTES), vramProvider: HI_VRAM });
  assert.equal((await w.status('flux2-klein')).state, 'NOT_INSTALLED');
  await assert.rejects(() => w.generateImage({ prompt: 'x', outputBase: '/tmp/no.png' }), (e) => e.code === 'BLOCKED_WORKER');
  const st = await w.install('flux2-klein');
  assert.equal(st.state, 'READY');
  assert.ok(st.sizeBytes > 0);
  assert.ok(w._record('flux2-klein').binPath.endsWith('sd-cli'));
  assert.ok(fs.existsSync(path.join(w._dirOf('flux2-klein'), 'models', 'flux-2-klein-4b-Q4_0.gguf')));
  assert.equal((await w.setEnabled('flux2-klein', false)).state, 'DISABLED');
  await assert.rejects(() => w.generateImage({ prompt: 'x', outputBase: '/tmp/no.png' }), (e) => e.code === 'BLOCKED_WORKER');
  assert.equal((await w.setEnabled('flux2-klein', true)).state, 'READY');
  assert.equal((await w.remove('flux2-klein')).state, 'NOT_INSTALLED');
  assert.equal(fs.existsSync(w._dirOf('flux2-klein')), false);
});

test('capability gate: <8 GB VRAM warns in Vietnamese and defaults OFF; >=8 GB normal', async () => {
  const low = lw.fluxCapability(4096);
  assert.equal(low.tier, 'low'); assert.equal(low.defaultEnabled, false); assert.match(low.warning, /chậm/); assert.match(low.warning, /thumbnail/);
  const ok = lw.fluxCapability(16384);
  assert.equal(ok.tier, 'ok'); assert.equal(ok.defaultEnabled, true); assert.equal(ok.warning, null);
  const unk = lw.fluxCapability(null);
  assert.equal(unk.tier, 'unknown'); assert.equal(unk.defaultEnabled, false);
  // The gate is applied at install: a 4 GB machine gets the worker DISABLED.
  const w = lw.createLocalWorkers({ dataDir: caseDir('gate'), catalog: fixtureCatalog(), fetchImpl: fakeFetch(FIXTURE_BYTES), vramProvider: LO_VRAM });
  const st = await w.install('flux2-klein');
  assert.equal(st.state, 'DISABLED');
  assert.equal(st.capability.tier, 'low');
  assert.match(st.capability.warning, /4 GB VRAM/);
});

test('hash mismatch -> ERROR with verbatim reason, partial file deleted, op stays BLOCKED', async () => {
  const badCatalog = fixtureCatalog({ fluxModelSha: 'a'.repeat(64) });
  const w = lw.createLocalWorkers({ dataDir: caseDir('hash'), catalog: badCatalog, fetchImpl: fakeFetch(FIXTURE_BYTES), vramProvider: HI_VRAM });
  await assert.rejects(() => w.install('flux2-klein'), (e) => e.code === 'WORKER_HASH' && /SHA-256/.test(e.message));
  const st = await w.status('flux2-klein');
  assert.equal(st.state, 'ERROR');
  assert.match(st.lastError, /SHA-256 của flux-2-klein-4b-Q4_0\.gguf không khớp/);
  assert.equal(fs.existsSync(path.join(w._dirOf('flux2-klein'), 'models', 'flux-2-klein-4b-Q4_0.gguf')), false);
  await assert.rejects(() => w.generateImage({ prompt: 'x', outputBase: '/tmp/no.png' }), (e) => e.code === 'BLOCKED_WORKER');
  // ACE op is equally BLOCKED while never installed.
  await assert.rejects(() => w.generateMusic({ prompt: 'x', outputBase: '/tmp/no' }), (e) => e.code === 'BLOCKED_WORKER');
});

function aceFixtureApi() {
  const audio = Buffer.alloc(4096, 9);
  const server = http.createServer((req, res) => {
    req.resume(); req.on('end', () => {
      if (req.url === '/health') { res.setHeader('content-type', 'application/json'); return res.end('{"status":"ok"}'); }
      if (req.url === '/release_task') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ data: { task_id: 't-1' }, code: 200, error: null })); }
      if (req.url === '/query_result') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ data: [{ task_id: 't-1', status: 1, result: JSON.stringify([{ file: '/v1/audio?path=x.mp3', status: 1, dit_model: 'acestep-v15-turbo', lm_model: 'acestep-5Hz-lm-0.6B' }]) }], code: 200 })); }
      if (req.url.startsWith('/v1/audio')) { res.setHeader('content-type', 'audio/mpeg'); return res.end(audio); }
      res.statusCode = 404; res.end('{}');
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}`, audio })));
}

test('ACE-Step: adopt-external + media.music end-to-end against a fixture API; pipeline resolver uses it', async () => {
  const api = await aceFixtureApi();
  try {
    const hybridFetch = async (url, opts) => { const hit = FIXTURE_BYTES[String(url)]; return hit ? fakeFetch(FIXTURE_BYTES)(url) : globalThis.fetch(url, opts); };
    const w = lw.createLocalWorkers({ dataDir: caseDir('ace'), catalog: fixtureCatalog(), fetchImpl: hybridFetch, aceBaseUrl: api.url, acePollMs: 30 });
    await assert.rejects(() => w.generateMusic({ prompt: 'x', outputBase: '/tmp/no' }), (e) => e.code === 'BLOCKED_WORKER');
    const st = await w.adoptExternal('ace-step');
    assert.equal(st.state, 'READY'); assert.equal(st.installKind, 'external');
    const outBase = path.join(caseDir('ace'), 'song');
    const made = await w.generateMusic({ prompt: 'nhạc nền êm', tags: 'lofi, calm', durationSec: 30, instrumental: true, outputBase: outBase });
    assert.ok(made.file.endsWith('.mp3'));
    assert.equal(fs.readFileSync(made.file).length, 4096);
    assert.equal(made.provenance.worker, 'ace-step');
    assert.equal(made.provenance.model, 'acestep-v15-turbo');
    // Resolver (pipeline path) picks the worker and labels the source.
    const resolved = await w.resolveStoryMusic({ musicSource: 'ace-step', title: 'Tin sáng', outputBase: path.join(caseDir('ace'), 'story-music') });
    assert.equal(resolved.detail.source, 'ace-step');
    assert.ok(resolved.file && fs.existsSync(resolved.file));
  } finally { api.server.close(); }
  // Adopt with nothing listening -> honest refusal.
  const dead = lw.createLocalWorkers({ dataDir: caseDir('ace-dead'), catalog: fixtureCatalog(), aceBaseUrl: 'http://127.0.0.1:9' });
  await assert.rejects(() => dead.adoptExternal('ace-step'), (e) => e.code === 'WORKER_EXTERNAL');
});

test('resolveStoryMusic: bound-but-not-ready falls back to the synthesized bed, LABELED', async () => {
  const w = lw.createLocalWorkers({ dataDir: caseDir('resolve'), catalog: fixtureCatalog(), fetchImpl: fakeFetch(FIXTURE_BYTES), runImpl: fakeFfmpeg, vramProvider: HI_VRAM });
  const base = path.join(caseDir('resolve'), 'music');
  const fb = await w.resolveStoryMusic({ musicSource: 'ace-step', title: 'Tin', outputBase: base });
  assert.equal(fb.detail.source, 'synthesized');
  assert.equal(fb.detail.fallbackFrom, 'ace-step');
  assert.equal(fb.detail.reason, 'WORKER_NOT_READY');
  assert.equal(fb.detail.workerState, 'NOT_INSTALLED');
  assert.ok(fb.file.endsWith('-bed.m4a') && fs.existsSync(fb.file));
  const plain = await w.resolveStoryMusic({ musicSource: 'synthesized', title: 'Tin', outputBase: base });
  assert.deepEqual(plain.detail, { source: 'synthesized' });
});

test('FLUX op: real sd-cli invocation contract via a fake runner; failure surfaces stderr', async () => {
  const seen = [];
  let failNext = false;
  const runImpl = async (cmd, args, opts) => {
    if (String(cmd).includes('sd-cli')) {
      seen.push(args);
      if (failNext) return { code: 1, stdout: '', stderr: 'fixture CUDA error', timedOut: false };
      const out = args[args.indexOf('-o') + 1];
      fs.writeFileSync(out, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(2048, 3)]));
      return { code: 0, stdout: '', stderr: '', timedOut: false };
    }
    return realRun(cmd, args, opts);
  };
  const w = lw.createLocalWorkers({ dataDir: caseDir('fluxop'), catalog: fixtureCatalog(), fetchImpl: fakeFetch(FIXTURE_BYTES), runImpl, vramProvider: HI_VRAM });
  await w.install('flux2-klein');
  const outBase = path.join(caseDir('fluxop'), 'img');
  const made = await w.generateImage({ prompt: 'tiệm vàng buổi sáng', width: 512, height: 768, seed: 42, outputBase: outBase });
  assert.ok(made.file.endsWith('.png') && fs.existsSync(made.file));
  assert.match(made.provenance.model, /klein/i);
  assert.match(made.provenance.runner, /stable-diffusion\.cpp/);
  const args = seen[0];
  assert.ok(args.includes('--diffusion-model') && args.some(a => /klein-4b-Q4_0\.gguf$/.test(a)));
  assert.ok(args.includes('--vae') && args.some(a => /flux2-vae\.safetensors$/.test(a)));
  assert.ok(args.includes('--llm') && args.some(a => /Qwen3-4B-Q4_K_M\.gguf$/.test(a)));
  assert.equal(args[args.indexOf('-W') + 1], '512'); assert.equal(args[args.indexOf('-H') + 1], '768');
  assert.equal(args[args.indexOf('-s') + 1], '42');
  assert.ok(!args.includes('--offload-to-cpu'), 'no offload on a >=8 GB machine');
  failNext = true;
  await assert.rejects(() => w.generateImage({ prompt: 'x', outputBase: outBase + '2' }), (e) => e.code === 'WORKER_RUNTIME' && /CUDA error/.test(e.message));
  failNext = false;
  // Low-VRAM tier adds --offload-to-cpu.
  const wLow = lw.createLocalWorkers({ dataDir: caseDir('fluxlow'), catalog: fixtureCatalog(), fetchImpl: fakeFetch(FIXTURE_BYTES), runImpl, vramProvider: LO_VRAM });
  await wLow.install('flux2-klein');
  await wLow.setEnabled('flux2-klein', true);
  await wLow.generateImage({ prompt: 'x', outputBase: path.join(caseDir('fluxlow'), 'img') });
  assert.ok(seen.at(-1).includes('--offload-to-cpu'), 'offload forced on a <8 GB machine');
});

function fakeWorld(storyMusic) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-lw-orch-'));
  const storyParams = [];
  const tasks = new Map(); const artifacts = new Map(); let seq = 0;
  const host = {
    mediaWorkspace: path.join(dir, 'media'),
    submit({ projectId, operation, params }) {
      const id = 'task-' + (++seq);
      tasks.set(id, { id, projectId, operation, state: 'paused' });
      if (operation === 'media.story') { storyParams.push(params); artifacts.set('art-' + id, { id: 'art-' + id, name: 'story-video.mp4', bytes: 2048, projectId }); }
      return { id, state: 'paused' };
    },
    action(id) { const t = tasks.get(id); if (t) t.state = 'approved'; },
    core: { queue: { drain: async () => { for (const t of tasks.values()) if (t.state === 'approved') t.state = 'completed'; } }, state: { find: (id) => tasks.get(id) } },
    listArtifacts: (projectId) => [...artifacts.values()].filter(a => a.projectId === projectId),
    artifact: (id) => ({ bytes: Buffer.alloc(artifacts.get(id)?.bytes || 0, 3) }),
    publishRecords: { list: () => [] },
    refreshPublishMetrics: async () => [],
  };
  fs.mkdirSync(host.mediaWorkspace, { recursive: true });
  const orch = createOrchestrator({
    file: path.join(dir, 'orchestrator.json'),
    ingest: { listCards: () => [], listSources: () => [], scanSource: async () => ({ added: 0 }), markCardUsed: () => {} },
    host, storyMusic,
    createProject: ({ name }) => ({ id: 'project-' + (++seq), name }),
    aiAdapters: { simulated: createSimulatedAi(), gateway: { mode: 'gateway', async writeNewsScript() { throw new Error('blocked'); }, async writeIdeaScript() { throw new Error('blocked'); }, async translateSegments() { throw new Error('blocked'); } } },
    now: () => new Date('2026-10-21T09:00:00+07:00'), idgen: () => 'run-' + (++seq),
  });
  const cfg = defaultOrchestratorConfig();
  cfg.enabled = true;
  cfg.pipelines['idea-film'] = { ...cfg.pipelines['idea-film'], enabled: true, aiMode: 'simulated', requireApproval: true, platforms: ['youtube'], dailyCap: 1, activeHours: [0, 24], musicSource: 'ace-step' };
  orch.setConfig(cfg);
  return { orch, storyParams };
}

test('pipeline music selection: worker file reaches media.story and the step is journaled; labeled fallback likewise', async () => {
  const ace = fakeWorld(async () => ({ file: 'orchestrator/run-music.mp3', detail: { source: 'ace-step', worker: 'ace-step', model: 'acestep-v15-turbo' } }));
  const run1 = await ace.orch.startRun('idea-film', { ideaText: 'Một ngọn đèn cuối bến', title: 'Ngọn đèn' });
  assert.equal(ace.storyParams.length, 1);
  assert.equal(ace.storyParams[0].music, 'orchestrator/run-music.mp3');
  const step1 = run1.steps.find(s => s.name === 'produce.music');
  assert.ok(step1 && step1.detail.source === 'ace-step');

  const fb = fakeWorld(async () => ({ file: 'orchestrator/run-bed.m4a', detail: { source: 'synthesized', fallbackFrom: 'ace-step', reason: 'WORKER_NOT_READY' } }));
  const run2 = await fb.orch.startRun('idea-film', { ideaText: 'Ý tưởng hai', title: 'Hai' });
  assert.equal(fb.storyParams[0].music, 'orchestrator/run-bed.m4a');
  const step2 = run2.steps.find(s => s.name === 'produce.music');
  assert.equal(step2.detail.source, 'synthesized');
  assert.equal(step2.detail.fallbackFrom, 'ace-step');

  const none = fakeWorld(async () => ({ file: null, detail: { source: 'none' } }));
  const run3 = await none.orch.startRun('idea-film', { ideaText: 'Ý tưởng ba', title: 'Ba' });
  assert.equal('music' in none.storyParams[0], false);
  assert.equal(run3.steps.find(s => s.name === 'produce.music').detail.source, 'none');
});

test('image binding contract: local-flux is an explicit provider, bypasses the Vault, blocks honestly when the worker is not ready', async () => {
  assert.ok(IMAGE_PROVIDERS.includes('local-flux'));
  // Vault is locked in this isolated runtime and the worker is not
  // installed: the local route must answer BLOCKED_WORKER (not a Vault
  // error, not a fake image).
  await assert.rejects(
    () => generateImage({ provider: 'local-flux', prompt: 'tiệm vàng', output: path.join(caseDir('img'), 'x.png') }),
    (e) => e.code === 'BLOCKED_WORKER',
  );
  // 'auto' resolution draws only from account/API routes: even with a
  // ChatGPT account connection present, 'local-flux' never appears in the
  // auto route list — the local worker is reachable by explicit binding only.
  unlockVault('fixture-pass-1234');
  try {
    saveConnection({ kind: 'chatgpt_account', label: 'Fixture', data: {} });
    const status = imageProviderStatus();
    // A saved label without an account identity is not generation access.
    assert.equal(status.available, false);
    assert.deepEqual(status.routes, []);
    assert.equal(status.configured, true);
  } finally { lockVault(); }
});
