import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MEDIA_TEMPLATES, templateById, directorPlanForTemplate } from '../src/lib/media-templates.mjs';

const require = createRequire(import.meta.url);
const timeline = require('../integrations/media-engine/src/timeline.cjs');

test('five templates, each mapped to a real operation', () => {
  assert.equal(MEDIA_TEMPLATES.length, 5);
  const ops = new Set(MEDIA_TEMPLATES.map(t => t.operation));
  for (const op of ops) assert.match(op, /^media\.(retheme|dub|story|effects)$/);
  assert.equal(templateById('news-vertical').operation, 'media.retheme');
  assert.equal(templateById('nope'), null);
});

test('template director plans are deterministic presets', () => {
  const news = directorPlanForTemplate(templateById('news-vertical'), { source: 'uploads/a.mp4' });
  assert.equal(news.operation, 'media.retheme');
  assert.equal(news.params.captionPreset, 'pop');
  assert.equal(news.params.source, 'uploads/a.mp4');
  assert.equal(news.needsInput, null);
  const noSource = directorPlanForTemplate(templateById('dub-film'), {});
  assert.match(noSource.needsInput, /nạp video/);
  const story = directorPlanForTemplate(templateById('story-telling'), {});
  assert.equal(story.operation, 'media.story');
  assert.equal(story.params.transition, 'slideleft');
});

test('timeline validator accepts the new transition kinds and rejects junk', () => {
  const media = { seconds: 30, streams: [{ codec_type: 'video' }], path: '/tmp/x.mp4' };
  for (const transition of ['crossfade', 'fadeblack', 'slideleft', 'slideright', 'wipeleft']) {
    const plan = timeline.validate({ kind: 'edit', ratio: '16:9', framing: 'fit', transition, transitionSeconds: 0.35, segments: [{ start: 0, end: 10 }, { start: 10, end: 20 }] }, media);
    assert.equal(plan.transition, transition);
    assert.ok(plan.transitionSeconds > 0);
  }
  assert.throws(() => timeline.validate({ kind: 'edit', ratio: '16:9', transition: 'spin', segments: [{ start: 0, end: 10 }] }, media), /Unsupported transition/);
});

test('server + UI expose templates, presets and the FPT voice route', async () => {
  const fs = await import('node:fs');
  const server = fs.readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  const studio = fs.readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
  const html = fs.readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
  assert.match(server, /\/api\/integrations\/media\/templates/);
  assert.match(server, /\/api\/system\/tts\/fpt\/config/);
  assert.match(html, /mediaTemplateGrid/);
  assert.match(html, /mediaRethemeCaptionPreset/);
  assert.match(html, /mediaStoryTransition/);
  assert.match(html, /mediaDirectorVoice/);
  assert.match(studio, /mediaTemplatesLoad/);
  assert.match(studio, /captionPreset/);
});
