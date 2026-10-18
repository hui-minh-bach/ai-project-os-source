import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rethemeBudgets, splitScriptAcrossWindows } from '../src/lib/media-ai.mjs';

test('retheme budgets scale with window length and stay in bounds', () => {
  const segs = [{ start: 0, end: 2 }, { start: 2, end: 12 }, { start: 12, end: 200 }];
  const b = rethemeBudgets(segs, 'vi');
  assert.equal(b.length, 3);
  assert.ok(b[0] >= 24 && b[0] < b[1] && b[1] < b[2]);
  assert.equal(b[2], 900); // capped
  const en = rethemeBudgets([{ start: 0, end: 10 }], 'en');
  assert.ok(en[0] > b[1] - 20); // EN rate slightly higher than VI for a 10s window
});

test('free-text script split keeps every word once, in order, proportional to windows', () => {
  const words = Array.from({ length: 60 }, (_, i) => 'w' + i);
  const text = words.join(' ');
  const segs = [{ start: 0, end: 10 }, { start: 10, end: 20 }, { start: 20, end: 30 }];
  const parts = splitScriptAcrossWindows(text, segs);
  assert.equal(parts.length, 3);
  assert.ok(parts.every((p) => p.length > 0));
  assert.deepEqual(parts.join(' ').split(' '), words);
  // Equal windows -> roughly equal shares.
  const lens = parts.map((p) => p.split(' ').length);
  assert.ok(Math.max(...lens) - Math.min(...lens) <= 2);
});

test('longer window receives the larger share of the script', () => {
  const text = Array.from({ length: 100 }, (_, i) => 'x' + i).join(' ');
  const parts = splitScriptAcrossWindows(text, [{ start: 0, end: 5 }, { start: 5, end: 30 }]);
  assert.ok(parts[1].split(' ').length > parts[0].split(' ').length * 3);
});

test('retheme is registered end to end: handler kind, studio mode, panel', () => {
  const host = fs.readFileSync(new URL('../src/lib/integration-host.mjs', import.meta.url), 'utf8');
  assert.ok(host.includes("'media.retheme':'video_edit'"));
  assert.ok(host.includes("'media.dub','media.retheme'"));
  assert.ok(host.includes("handlers.set('media.retheme'"));
  assert.ok(host.includes('video-with-new-voice.mp4'));
  assert.ok(host.includes('retheme-report.json'));
  const js = fs.readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
  assert.ok(js.includes("'retheme'"));
  assert.ok(js.includes('mediaRethemeTopic'));
  assert.ok(js.includes('Đổi chủ đề & giọng đọc'));
  const html = fs.readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
  assert.ok(html.includes('data-media-panel="retheme"'));
  assert.ok(html.includes('data-media-mode="retheme"'));
  assert.ok(html.includes('mediaRethemeScriptSource'));
});
