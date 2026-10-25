import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { buildEffectsGraph } from '../src/lib/media-effects.mjs';

const require = createRequire(import.meta.url);
const { createPng, illustration } = require('../integrations/media-engine/src/images.cjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-quality-'));
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

test('procedural illustration v2 renders a 1280x720 PNG, deterministic per seed', () => {
  const a = path.join(tmp, 'a.png'), b = path.join(tmp, 'b.png'), c = path.join(tmp, 'c.png');
  createPng(a, { seed: 'village', scene: 0 });
  createPng(b, { seed: 'village', scene: 0 });
  createPng(c, { seed: 'village', scene: 3 });
  const buf = fs.readFileSync(a);
  assert.equal(buf.readUInt32BE(16), 1280);
  assert.equal(buf.readUInt32BE(20), 720);
  assert.equal(hash(a), hash(b), 'same seed+scene must be byte-identical');
  assert.notEqual(hash(a), hash(c), 'different scene mood must differ');
  assert.ok(buf.length > 200_000, 'v2 art should carry texture/grain, not flat fills');
});

test('AI illustration failure blocks instead of silently substituting procedural scenery', async () => {
  const out = path.join(tmp, 'fallback.png');
  const gateway = { invoke: async () => { throw new Error('BLOCKED_PROVIDER'); } };
  await assert.rejects(illustration({ gateway, description: 'a village at dusk', output: out, offline: false, scene: 1 }),/BLOCKED_PROVIDER/);
  assert.equal(fs.existsSync(out),false);
});

test('effects pads use full social canvases (1080x1920 / 1920x1080)', () => {
  const v = buildEffectsGraph({ effects: ['pad-vertical'], width: 1280, height: 720, duration: 5 });
  assert.equal(v.outWidth, 1080); assert.equal(v.outHeight, 1920);
  assert.deepEqual(v.skipped, []);
  const h = buildEffectsGraph({ effects: ['pad-horizontal'], width: 720, height: 1280, duration: 5 });
  assert.equal(h.outWidth, 1920); assert.equal(h.outHeight, 1080);
  const already = buildEffectsGraph({ effects: ['pad-vertical'], width: 720, height: 1280, duration: 5 });
  assert.equal(already.skipped.length, 1, 'already-vertical sources are not re-padded');
});

test('output quality wiring: profiles, loudnorm and Ken Burns variants are in the render paths', () => {
  const renderer = fs.readFileSync(new URL('../integrations/media-engine/src/renderer.cjs', import.meta.url), 'utf8');
  assert.match(renderer, /QUALITY_PROFILES/);
  assert.match(renderer, /loudnorm=I=-14/, 'story narration gets loudness normalization');
  assert.match(renderer, /KB=\[/, 'Ken Burns variants exist');
  const voiceover = fs.readFileSync(new URL('../src/lib/voiceover.mjs', import.meta.url), 'utf8');
  assert.match(voiceover, /loudnorm=I=-14/, 'dub/retheme finals get loudness normalization');
  assert.match(voiceover, /QUALITY_PROFILES/);
  assert.match(voiceover, /qualityProfile/, 'the encode-quality param must not shadow the QA quality module');
  assert.doesNotMatch(voiceover, /quality='high'/);
  const engine = fs.readFileSync(new URL('../integrations/media-engine/index.cjs', import.meta.url), 'utf8');
  assert.doesNotMatch(engine, /quality:quality\|\|/, 'the quality task param must not shadow the quality-checker module');
  assert.match(engine, /quality:qualityProfile/);
  const studio = fs.readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
  assert.match(studio, /id="mediaStoryQuality"/);
  assert.match(studio, /id="mediaStoryAiArt"/);
  assert.match(studio, /id="mediaRethemeQuality"/);
});
