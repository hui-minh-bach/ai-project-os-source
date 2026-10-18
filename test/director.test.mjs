import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDirectorPlan, routeDirectorPlan, buildDirectorModelCall, DIRECTOR_INTENTS } from '../src/lib/media-ai.mjs';

test('director plan parsing validates the model JSON contract', () => {
  const plan = parseDirectorPlan('Rồi, đây là kế hoạch: {"intent":"doi-chu-de","summary":"Tôi hiểu bạn muốn đổi chủ đề","steps":["nghe video","viết kịch bản mới"],"topic":"văn hóa cà phê","targetLanguage":"vi"} — xong.');
  assert.equal(plan.intent, 'doi-chu-de');
  assert.equal(plan.topic, 'văn hóa cà phê');
  assert.throws(() => parseDirectorPlan('không có json'), /không trả kế hoạch JSON/);
  assert.throws(() => parseDirectorPlan('{"intent":"bay-len-troi"}'), /intent lạ/);
  assert.ok(DIRECTOR_INTENTS.includes('khong-ro'));
  const call = buildDirectorModelCall({ hasSource: true, seconds: 80, width: 1280, height: 720, hasAudio: true, transcript: 'xin chào', wish: 'thêm phụ đề', whisperReady: true });
  assert.match(call.instructions, /DUY NHẤT một JSON/);
  assert.match(call.prompt, /80 giây/);
});

test('director routing maps every intent onto real operations or an honest needs-input', () => {
  const base = { summary: 's', steps: ['a'], prompt: 'p', autoCaptions: false, title: '', topic: '', sourceLanguage: 'en', targetLanguage: 'vi', scriptDraft: '' };
  let r = routeDirectorPlan({ ...base, intent: 'chinh-sua', autoCaptions: true }, { source: 'uploads/x.mp4', whisperReady: false });
  assert.equal(r.operation, 'media.quick-edit');
  assert.equal(r.params.autoCaptions, false, 'no fake auto-captions without Whisper');
  assert.ok(r.warnings.length >= 1);
  assert.match(r.params.planSummary, /s \| a/);

  r = routeDirectorPlan({ ...base, intent: 'phu-de' }, { source: 'uploads/x.mp4', whisperReady: false });
  assert.equal(r.operation, null); assert.equal(r.needsInput, 'whisper');

  r = routeDirectorPlan({ ...base, intent: 'phu-de' }, { source: 'uploads/x.mp4', whisperReady: true });
  assert.equal(r.operation, 'media.quick-edit'); assert.equal(r.params.autoCaptions, true);

  r = routeDirectorPlan({ ...base, intent: 'doi-chu-de', topic: 'cà phê Việt' }, { source: 'uploads/x.mp4' });
  assert.equal(r.operation, 'media.retheme'); assert.equal(r.params.scriptSource, 'model'); assert.equal(r.params.topic, 'cà phê Việt');

  r = routeDirectorPlan({ ...base, intent: 'doi-chu-de', topic: '' }, { source: 'uploads/x.mp4' });
  assert.equal(r.needsInput, 'topic');

  r = routeDirectorPlan({ ...base, intent: 'long-tieng' }, { source: 'uploads/x.mp4' });
  assert.equal(r.operation, 'media.dub'); assert.equal(r.params.translationSource, 'model'); assert.equal(r.params.sourceLanguage, 'en');

  r = routeDirectorPlan({ ...base, intent: 'thay-giong' }, { source: 'uploads/x.mp4' });
  assert.equal(r.operation, null); assert.equal(r.needsInput, 'voice-file');

  r = routeDirectorPlan({ ...base, intent: 'y-tuong', scriptDraft: 'Xin chào, hôm nay...' }, {});
  assert.equal(r.operation, 'media.story'); assert.equal(r.params.mode, 'verbatim');

  r = routeDirectorPlan({ ...base, intent: 'khong-ro' }, { source: 'uploads/x.mp4' });
  assert.equal(r.operation, null); assert.equal(r.needsInput, 'clarify');

  r = routeDirectorPlan({ ...base, intent: 'chinh-sua' }, {});
  assert.equal(r.needsInput, 'source');
});

test('director is wired: host method, server route, Studio hero and plan card', () => {
  const host = readFileSync(new URL('../src/lib/integration-host.mjs', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
  assert.match(host, /async function directorPlan/);
  assert.match(host, /routeDirectorPlan/);
  assert.match(server, /\/api\/integrations\/media\/director\/plan/);
  for (const id of ['mediaDirectorWish', 'mediaDirectorGo', 'mediaDirectorPlan', 'mediaDirectorSource'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.match(js, /mediaDirectorRenderPlan/);
  assert.match(js, /mediaDirectorRenderFallback/);
  assert.match(js, /planSummary/);
});
