import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alignKaraokeWords, buildKaraokeAss } from '../src/lib/karaoke-captions.mjs';

test('words are anchored to the GROUP speech span, never spread across silent windows (0.9.14 regression)', () => {
  // The 0.9.13 defect: five short windows spanning 0..29s, but the grouped
  // voice reads the whole passage in the first ~4.9s, then rests.
  const segments = [
    { start: 0, end: 4.92 }, { start: 4.92, end: 7.02 }, { start: 7.02, end: 11 },
    { start: 11, end: 14.5 }, { start: 14.5, end: 29 },
  ];
  const texts = ['Văn hóa trà Việt', 'Nam có', 'từ lâu đời.', 'Chén trà mở', 'đầu câu chuyện,'];
  const groups = [{ start: 0, speechEnd: 4.9, segmentIndexes: [0, 1, 2, 3, 4] }];
  const aligned = alignKaraokeWords({ segments, texts, groups, whisperWords: null });
  assert.equal(aligned.method, 'proportional');
  assert.equal(aligned.wordCount, 15);
  for (const w of aligned.timedWords) assert.ok(w.end <= 4.9 + 0.001, `word "${w.text}" ends at ${w.end}, inside the 4.9s speech span`);
  const ass = buildKaraokeAss({ segments: segments.map((s, i) => ({ ...s, text: texts[i] })), timedWords: aligned.timedWords, width: 1280, height: 720 });
  const dialogues = ass.split('\n').filter(l => l.startsWith('Dialogue:'));
  assert.equal(dialogues.length, 5, 'one line per script segment');
  assert.ok(dialogues.every(l => !l.includes('0:00:2')), 'no dialogue window reaches into the silent 20s+ region');
});

test('whisper anchors refine word times inside the group span', () => {
  const segments = [{ start: 10, end: 16, text: 'Xin chào các bạn' }];
  const groups = [{ start: 10, speechEnd: 13, segmentIndexes: [0] }];
  const whisper = [
    { start: 10.05, end: 10.45, text: 'Xin' }, { start: 10.55, end: 10.95, text: 'chào' },
    { start: 11.10, end: 11.45, text: 'các' }, { start: 11.60, end: 12.20, text: 'bạn' },
  ];
  const aligned = alignKaraokeWords({ segments, texts: ['Xin chào các bạn'], groups, whisperWords: whisper });
  assert.equal(aligned.method, 'whisper-words');
  assert.deepEqual(aligned.timedWords.map(w => w.text), ['Xin', 'chào', 'các', 'bạn'], 'shown text is the script');
  assert.ok(Math.abs(aligned.timedWords[0].start - 10.05) < 0.05, 'first word at the measured boundary');
  assert.ok(aligned.timedWords.every(w => w.start >= 10 && w.end <= 13.001), 'all words inside the speech span');
});

test('karaoke ASS sweeps word by word and fills sum to the spoken line window', () => {
  const segments = [{ start: 0, end: 4, text: 'Xin chào các bạn' }];
  const groups = [{ start: 0, speechEnd: 4, segmentIndexes: [0] }];
  const aligned = alignKaraokeWords({ segments, texts: ['Xin chào các bạn'], groups, whisperWords: null });
  const ass = buildKaraokeAss({ segments, timedWords: aligned.timedWords, width: 1280, height: 720 });
  assert.match(ass, /Style: Karaoke/);
  const line = ass.split('\n').find(l => l.includes('Xin'));
  const fills = [...line.matchAll(/\\kf(\d+)/g)].map(m => Number(m[1]));
  assert.ok(fills.length >= 4, 'one fill per word');
  const total = fills.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 400) <= 12, 'fills sum to the spoken window (4s, allowing the small lead-in)');
});

test('karaoke is wired into dub, retheme, the director and the Studio UI', () => {
  const host = readFileSync(new URL('../src/lib/integration-host.mjs', import.meta.url), 'utf8');
  const ai = readFileSync(new URL('../src/lib/media-ai.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
  const whisper = readFileSync(new URL('../src/lib/local-whisper.mjs', import.meta.url), 'utf8');
  assert.match(host, /karaokeBurnCaptions/);
  assert.match(host, /segReports:dubAsm\.segReports/);
  assert.match(host, /segReports:rtAsm\.segReports/);
  assert.match(host, /captionStyle,captionTiming/);
  assert.match(host, /captions-karaoke\.ass/);
  assert.match(whisper, /transcribeWordsLocal/);
  assert.match(ai, /karaokeCaptions:true/);
  assert.ok(html.includes('id="mediaRethemeKaraoke"'));
  assert.match(js, /mediaRethemeKaraoke/);
});
