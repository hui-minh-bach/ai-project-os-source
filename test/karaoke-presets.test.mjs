import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKaraokeAss } from '../src/lib/karaoke-captions.mjs';

const segments = [{ start: 0, end: 4, text: 'Xin chào Việt Nam' }];
const timedWords = [
  { segment: 0, start: 0.1, end: 0.7, text: 'Xin' },
  { segment: 0, start: 0.7, end: 1.3, text: 'chào' },
  { segment: 0, start: 1.3, end: 2.2, text: 'Việt' },
  { segment: 0, start: 2.2, end: 3.0, text: 'Nam' },
];

test('sweep preset keeps the classic \\kf fill', () => {
  const ass = buildKaraokeAss({ segments, timedWords, width: 720, height: 1280, preset: 'sweep' });
  assert.match(ass, /\\kf/);
  assert.match(ass, /, 1, 3, 0, 2,/); // BorderStyle 1
});

test('box preset puts the line on a solid highlight strip', () => {
  const ass = buildKaraokeAss({ segments, timedWords, width: 720, height: 1280, preset: 'box' });
  assert.match(ass, /, 3, 10, 0, 2,/); // BorderStyle 3, wide outline = the box
  assert.match(ass, /\\kf/); // words still sweep (to black)
});

test('pop preset renders one big word at a time with a scale-in', () => {
  const ass = buildKaraokeAss({ segments, timedWords, width: 720, height: 1280, preset: 'pop' });
  assert.doesNotMatch(ass, /\\kf/);
  const dialogues = ass.split('\n').filter(l => l.startsWith('Dialogue:'));
  assert.equal(dialogues.length, 4); // one per word
  assert.match(dialogues[0], /\\t\(0,110,/); // scale animation
  assert.match(dialogues[0], /Xin/);
  assert.match(dialogues[3], /Nam/);
});

test('unknown preset falls back to sweep', () => {
  const ass = buildKaraokeAss({ segments, timedWords, preset: 'neon' });
  assert.match(ass, /\\kf/);
});
