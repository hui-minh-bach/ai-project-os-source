// Kokoro TTS (0.9.43): optional local English engine installed on demand into
// the shared ai-tools folder. Hermetic tests — npm and Hugging Face are faked;
// the real synthesis was verified live against the downloaded model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64)]);

function fakeFetch(url) {
  if (url.includes('/api/models/')) return Promise.resolve({ ok: true, json: async () => [] });
  const big = url.endsWith('.bin') || url.endsWith('.onnx');
  return Promise.resolve({ ok: true, headers: { get: () => null }, body: null, arrayBuffer: async () => new ArrayBuffer(big ? 150_000 : 64) });
}

test('kokoro status, install (faked npm+HF) and synthesize guards', async () => {
  const f = isolatedRuntime('kokoro');
  const prevMin = process.env.KOKORO_MODEL_MIN_BYTES;
  process.env.KOKORO_MODEL_MIN_BYTES = '10';
  try {
    const kokoro = await f.import('src/lib/kokoro-tts.mjs');
    const managed = await f.import('src/lib/managed-cli.mjs');
    const toolsDir = managed.TOOLS_DIR;
    let st = kokoro.kokoroStatus();
    assert.equal(st.ready, false);
    assert.deepEqual(st.voices, []);
    await assert.rejects(() => kokoro.kokoroSynthesize({ text: 'Hello.', output: '/tmp/x.wav' }), /Chưa cài Kokoro/);
    // The isolated copy ships no tools/ — production installs copy the worker
    // from the app tree, so seed it the same way here.
    fs.mkdirSync(path.join(f.root, 'tools'), { recursive: true });
    fs.copyFileSync(new URL('../tools/kokoro-worker.mjs', import.meta.url), path.join(f.root, 'tools', 'kokoro-worker.mjs'));
    const fakeRun = async (cmd, args) => {
      fs.mkdirSync(path.join(toolsDir, 'node_modules', 'kokoro-js'), { recursive: true });
      fs.writeFileSync(path.join(toolsDir, 'node_modules', 'kokoro-js', 'package.json'), '{"name":"kokoro-js","version":"1.2.1"}');
      return { code: 0, stderr: '' };
    };
    st = await kokoro.kokoroInstall({ fetchImpl: fakeFetch, run: fakeRun, npmPath: '/fake/npm-cli.js' });
    assert.equal(st.ready, true);
    assert.deepEqual(st.voices, ['af_heart', 'af_bella', 'am_michael', 'bm_george']);
    assert.equal(kokoro.kokoroVoiceFor('en'), 'af_heart');
    assert.equal(kokoro.kokoroVoiceFor('bm_george'), 'bm_george');
    const out = path.join(f.root, 'out.wav');
    const synthRun = async (cmd, args) => { const job = JSON.parse(fs.readFileSync(args[1], 'utf8')); fs.writeFileSync(job.output, WAV); return { code: 0, stderr: '' }; };
    const r = await kokoro.kokoroSynthesize({ text: 'Hello world.', output: out, run: synthRun });
    assert.equal(r.provider, 'kokoro-local');
    assert.equal(r.voice, 'af_heart');
    await assert.rejects(() => kokoro.kokoroSynthesize({ text: 'Hi.', voice: 'zz_nope', output: out, run: synthRun }), /chưa được tải/);
    await assert.rejects(() => kokoro.kokoroSynthesize({ text: 'Hi.', output: 'relative.wav', run: synthRun }), /không hợp lệ/);
    await assert.rejects(() => kokoro.kokoroSynthesize({ text: '', output: out, run: synthRun }), /1-5.000/);
  } finally {
    if (prevMin === undefined) delete process.env.KOKORO_MODEL_MIN_BYTES; else process.env.KOKORO_MODEL_MIN_BYTES = prevMin;
    f.cleanup();
  }
});
