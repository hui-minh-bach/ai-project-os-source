import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupSpeechSegments } from '../src/lib/media-ai.mjs';

const seg = (start, end, text = 'câu thoại mẫu') => ({ start, end, text });

test('speech grouping merges close windows and splits on gaps, size and span', () => {
  const close = [seg(0, 3), seg(3.4, 6), seg(6.5, 9)];
  const g1 = groupSpeechSegments(close);
  assert.equal(g1.length, 1, 'windows 0.4-0.5s apart read as one passage');
  assert.deepEqual(g1[0].indexes, [0, 1, 2]);
  assert.equal(g1[0].start, 0);
  assert.equal(g1[0].end, 9);

  const far = [seg(0, 3), seg(6, 9)];
  assert.equal(groupSpeechSegments(far).length, 2, 'a 3s gap starts a new group');

  const wordy = [seg(0, 3, 'x'.repeat(400)), seg(3.2, 6, 'y'.repeat(400))];
  assert.equal(groupSpeechSegments(wordy).length, 2, 'char budget splits long passages');

  const long = Array.from({ length: 12 }, (_, i) => seg(i * 3, i * 3 + 2.8));
  const g4 = groupSpeechSegments(long);
  assert.ok(g4.length >= 2, 'span cap splits a long run');
  assert.ok(g4.every(g => g.end - g.start <= 30));

  assert.deepEqual(groupSpeechSegments([seg(1, 2)])[0].indexes, [0]);
});

test('dub and retheme share the smooth assembly: grouped TTS, gentler tempo, fades, room tone', () => {
  const host = readFileSync(new URL('../src/lib/integration-host.mjs', import.meta.url), 'utf8');
  assert.match(host, /async function assembleSpeechTrack/);
  assert.match(host, /groupSpeechSegments\(segments\.map/);
  assert.match(host, /Math\.min\(dur\/room,1\.25\)/);
  assert.match(host, /afade=t=in:st=0:d=0\.03/);
  assert.match(host, /anoisesrc=color=pink/);
  assert.equal((host.match(/await assembleSpeechTrack\(\{dir,segments,texts/g) || []).length, 2, 'both handlers use it');
  assert.ok(!/Math\.min\(dur\/room,1\.35\)/.test(host), 'the old 1.35x squeeze is gone');
});
