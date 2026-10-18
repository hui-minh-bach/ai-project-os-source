import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EFFECT_CATALOG, EFFECT_IDS, buildEffectsGraph, buildEffectsAss } from '../src/lib/media-effects.mjs';

test('effects catalog is complete and every id is unique', () => {
  assert.equal(EFFECT_CATALOG.length, 17);
  assert.equal(EFFECT_IDS.size, 17);
  for (const group of ['Khung hình', 'Màu sắc', 'Chuyển động', 'Chữ'])
    assert.ok(EFFECT_CATALOG.some(e => e.group === group), 'group present: ' + group);
});

test('effects graph composes pads, colour and speed deterministically', () => {
  const g = buildEffectsGraph({ effects: ['pad-vertical', 'vivid', 'vignette'], width: 1280, height: 720, fps: 25, duration: 20 });
  assert.deepEqual(g.applied, ['pad-vertical', 'vivid', 'vignette']);
  assert.equal(g.outWidth, 1080, 'vertical canvas is the full 1080x1920 social frame');
  assert.equal(g.outHeight, 1920);
  const graph = g.parts.join(';');
  assert.match(graph, /boxblur/);
  assert.match(graph, /eq=contrast=1\.08:saturation=1\.35/);
  assert.match(graph, /vignette/);
  assert.equal(g.audioFilter, null);

  const fast = buildEffectsGraph({ effects: ['speed-up', 'fade'], width: 640, height: 360, duration: 20 });
  assert.equal(fast.outDuration, 16);
  assert.match(fast.audioFilter, /atempo=1\.25/);
  assert.match(fast.audioFilter, /afade=t=in/);

  const both = buildEffectsGraph({ effects: ['speed-up', 'slow-down'], width: 640, height: 360, duration: 20 });
  assert.deepEqual(both.applied, ['speed-up']);
  assert.equal(both.skipped.length, 1);

  const alreadyVertical = buildEffectsGraph({ effects: ['pad-vertical'], width: 720, height: 1280, duration: 5 });
  assert.equal(alreadyVertical.applied.length, 0);
  assert.equal(alreadyVertical.skipped[0].id, 'pad-vertical');

  const zoom = buildEffectsGraph({ effects: ['zoom-in'], width: 1280, height: 720, fps: 30, duration: 10 });
  assert.match(zoom.parts.join(';'), /zoompan/);
});

test('effects ASS carries the title and the name card with escaped text', () => {
  const ass = buildEffectsAss({ title: 'Du lịch {Đà Lạt}', name: 'Nguyễn Văn A', width: 406, height: 720 });
  assert.match(ass, /PlayResX: 406/);
  assert.match(ass, /Du lịch Đà Lạt/);
  assert.ok(!ass.includes('{Đà Lạt}'), 'override braces are stripped from user text');
  assert.match(ass, /Nguyễn Văn A/);
  assert.match(ass, /Style: Title/);
  assert.match(ass, /Style: Name/);
});

test('effects are wired through the host allow-list, validation, handler and Studio UI', () => {
  const host = readFileSync(new URL('../src/lib/integration-host.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
  assert.match(host, /'media\.effects':'video_edit'/);
  assert.match(host, /handlers\.set\('media\.effects'/);
  assert.match(host, /operation==='media\.effects'/);
  assert.match(host, /video-with-effects\.mp4/);
  assert.ok(html.includes('data-media-mode="effects"'));
  assert.ok(html.includes('data-media-panel="effects"'));
  assert.ok(html.includes('id="mediaFxPanel"'));
  assert.match(js, /mode==='effects'/);
  assert.match(js, /'media\.effects':'Hiệu ứng video'/);
});
