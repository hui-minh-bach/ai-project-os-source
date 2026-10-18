import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proportionalWords, alignWordsToSegments, buildKaraokeAss } from '../src/lib/karaoke-captions.mjs';

const segs = [
  { start: 0, end: 4, text: 'Xin chào các bạn' },
  { start: 5, end: 9, text: 'Hôm nay trời đẹp lắm' },
];

test('proportional split covers the whole window exactly, word by word', () => {
  const w = proportionalWords(segs[0]);
  assert.equal(w.length, 4);
  assert.equal(w[0].start, 0);
  assert.equal(w[3].end, 4);
  for (let i = 1; i < w.length; i++) assert.equal(w[i].start, w[i - 1].end, 'no gaps or overlaps');
});

test('whisper timings realign the script words without changing the shown text', () => {
  const whisper = [
    { start: 0.10, end: 0.50, text: 'Xin' }, { start: 0.55, end: 0.95, text: 'chào' },
    { start: 1.05, end: 1.40, text: 'các' }, { start: 1.50, end: 2.10, text: 'bạn' },
    { start: 5.10, end: 5.60, text: 'Hôm' }, { start: 5.70, end: 6.10, text: 'nay' },
    { start: 6.20, end: 6.60, text: 'trời' }, { start: 6.70, end: 7.20, text: 'đẹp' }, { start: 7.30, end: 7.90, text: 'lắm' },
  ];
  const aligned = alignWordsToSegments(segs, whisper);
  assert.equal(aligned.method, 'whisper-words');
  assert.equal(aligned.wordCount, 9);
  assert.deepEqual(aligned.perSegment[0].map(w => w.text), ['Xin', 'chào', 'các', 'bạn'], 'shown text is the script, not the transcript');
  assert.ok(Math.abs(aligned.perSegment[0][0].start - 0.10) < 0.05, 'first word starts at the measured whisper boundary');
  for (const seg of aligned.perSegment)
    for (let i = 1; i < seg.length; i++) assert.ok(seg[i].start >= seg[i - 1].end - 0.001, 'monotonic');
});

test('karaoke ASS sweeps word by word and the fills sum to the segment window', () => {
  const aligned = alignWordsToSegments(segs, null);
  assert.equal(aligned.method, 'proportional');
  const ass = buildKaraokeAss({ segments: segs, perSegment: aligned.perSegment, width: 1280, height: 720 });
  assert.match(ass, /Style: Karaoke/);
  const line = ass.split('\n').find(l => l.includes('Xin'));
  assert.ok(line, 'dialogue line present');
  const fills = [...line.matchAll(/\\kf(\d+)/g)].map(m => Number(m[1]));
  assert.ok(fills.length >= 4, 'one fill per word');
  assert.equal(fills.reduce((a, b) => a + b, 0), 400, 'fills sum to the 4s window in centiseconds');
});

test('karaoke is wired into dub, retheme, the director and the Studio UI', () => {
  const host = readFileSync(new URL('../src/lib/integration-host.mjs', import.meta.url), 'utf8');
  const ai = readFileSync(new URL('../src/lib/media-ai.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
  const whisper = readFileSync(new URL('../src/lib/local-whisper.mjs', import.meta.url), 'utf8');
  assert.match(host, /karaokeBurnCaptions/);
  assert.match(host, /captionStyle,captionTiming/);
  assert.match(host, /captions-karaoke\.ass/);
  assert.match(whisper, /transcribeWordsLocal/);
  assert.match(ai, /karaokeCaptions:true/);
  assert.ok(html.includes('id="mediaRethemeKaraoke"'));
  assert.match(js, /mediaRethemeKaraoke/);
});
