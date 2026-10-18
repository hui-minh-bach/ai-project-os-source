import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hardsubCoverSegments } from '../src/lib/voiceover.mjs';

test('hardsub cover builds an honest blur or band graph over the bottom band only', () => {
  const off = hardsubCoverSegments({ mode: 'off', width: 1280, height: 720 });
  assert.equal(off.applied, false);
  assert.deepEqual(off.segments, []);

  const blur = hardsubCoverSegments({ mode: 'blur', regionPct: 22, width: 1280, height: 720 });
  assert.equal(blur.applied, true);
  assert.match(blur.segments[1], /crop=1280:158:0:562,boxblur/);
  assert.match(blur.segments[2], /overlay=0:562\[vcover\]/);

  const band = hardsubCoverSegments({ mode: 'band', regionPct: 30, width: 640, height: 360 });
  assert.match(band.segments[0], /drawbox=x=0:y=252:w=640:h=108/);

  const dflt = hardsubCoverSegments({ mode: 'blur', width: 1280, height: 720 });
  assert.equal(dflt.pct, 13, 'default cover height is a slim 13% band');
  const clamped = hardsubCoverSegments({ mode: 'blur', regionPct: 95, width: 640, height: 360 });
  assert.equal(clamped.pct, 40, 'region is clamped to at most 40% of the frame');
  assert.throws(() => hardsubCoverSegments({ mode: 'magic-erase', width: 640, height: 360 }), /không hợp lệ/);
});

test('hardsub cover is wired through host validation, handlers, reports and the Studio UI', () => {
  const host = readFileSync(new URL('../src/lib/integration-host.mjs', import.meta.url), 'utf8');
  const ai = readFileSync(new URL('../src/lib/media-ai.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
  assert.match(host, /hardsubCover!==undefined&&!\['off','blur','band'\]/);
  assert.match(host, /hardsubCover:\{mode:hardsubCover,regionPct:hardsubRegionPct\}/);
  assert.match(host, /hardsubCover:rendered\.hardsubCover/);
  assert.match(ai, /operation:'media\.dub'.*hardsubCover:'blur'/);
  assert.ok(html.includes('id="mediaRethemeHardsub"'));
  assert.ok(html.includes('id="mediaVoiceoverHardsub"'));
  assert.match(js, /mediaRethemeHardsub/);
  assert.match(js, /mediaVoiceoverHardsub/);
});
