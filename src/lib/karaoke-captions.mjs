/**
 * Karaoke captions: the subtitle text lights up word by word, in step with
 * the spoken voice ("chữ ra tới đâu đọc tới đó").
 *
 * Timing model (fixed in 0.9.14 after a measured sync defect): the speech
 * track is assembled per GROUP — TTS reads a whole group continuously from
 * the group's start, then the track rests until the next group. Word times
 * must therefore be anchored to each group's ACTUAL speech span
 * [groupStart, groupStart + voiceSeconds/tempo], never spread across the
 * original per-segment windows (the 0.9.13 bug: words crawled across long
 * silent windows while the voice had already finished the passage).
 *
 * Within a group's speech span, boundaries come from measured Whisper word
 * timings on the final speech track when available (timing only — the
 * displayed text is always the script's), otherwise a deterministic
 * proportional split of the speech span by word length.
 * Rendering is standard ASS \kf karaoke through the usual subtitles burn.
 */

const wordsOf = text => String(text || '').trim().split(/\s+/).filter(Boolean);

/** Lay `words` (texts) over [start, end] proportionally to word length. */
function layProportional(words, start, end) {
  const span = Math.max(0.05, end - start);
  const weights = words.map(w => Math.max(2, w.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return words.map((text, i) => {
    const from = start + span * (acc / total);
    acc += weights[i];
    const to = i === words.length - 1 ? end : start + span * (acc / total);
    return { text, start: Number(from.toFixed(3)), end: Number(to.toFixed(3)) };
  });
}

/** Resample script words onto measured whisper anchors inside [start, end]. */
function layOnAnchors(words, anchors, start, end) {
  // anchors: [{start, text}] measured word starts + we append the span end.
  const points = anchors.map(a => a.start);
  points.push(end);
  const cum = [0];
  for (const a of anchors) cum.push(cum[cum.length - 1] + Math.max(1, a.text.length));
  const at = frac => {
    const pos = frac * cum[cum.length - 1];
    let j = 0; while (j < cum.length - 2 && cum[j + 1] < pos) j++;
    const span = Math.max(1e-6, cum[j + 1] - cum[j]);
    const v = points[j] + (points[Math.min(j + 1, points.length - 1)] - points[j]) * ((pos - cum[j]) / span);
    return Math.min(end, Math.max(start, v));
  };
  const charTotal = words.reduce((a, w) => a + Math.max(1, w.length), 0);
  let acc = 0;
  const timed = words.map((text, i) => {
    const from = i === 0 ? Math.max(start, Math.min(at(0), end)) : at(acc / charTotal);
    acc += Math.max(1, text.length);
    const to = i === words.length - 1 ? end : Math.max(from + 0.01, at(acc / charTotal));
    return { text, start: Number(from.toFixed(3)), end: Number(to.toFixed(3)) };
  });
  for (let i = 1; i < timed.length; i++) if (timed[i].start < timed[i - 1].end) { timed[i].start = timed[i - 1].end; if (timed[i].end < timed[i].start + 0.01) timed[i].end = Math.min(end, timed[i].start + 0.01); }
  return timed;
}

/**
 * Build timed words for the whole track.
 * groups: [{start, speechEnd, segmentIndexes:[...]}] — the real speech spans.
 * Returns {timedWords: [{text,start,end,segment}], method, wordCount}.
 */
export function alignKaraokeWords({ segments = [], texts = [], groups = [], whisperWords = null } = {}) {
  const timedWords = [];
  let whisperTimed = 0, total = 0;
  const groupList = groups.length ? groups : segments.map((s, i) => ({ start: s.start, speechEnd: s.end, segmentIndexes: [i] }));
  for (const g of groupList) {
    const words = [];
    const wordSeg = [];
    for (const si of g.segmentIndexes) { const ws = wordsOf(texts[si] ?? segments[si]?.text ?? ''); ws.forEach(w => { words.push(w); wordSeg.push(si); }); }
    if (!words.length) continue;
    total += words.length;
    const start = Number(g.start), end = Math.max(start + 0.05, Number(g.speechEnd));
    const inside = (whisperWords || []).filter(w => { const mid = (w.start + w.end) / 2; return mid >= start - 0.3 && mid <= end + 0.8; });
    let timed;
    if (inside.length >= Math.max(2, Math.floor(words.length * 0.4))) { timed = layOnAnchors(words, inside, start, end); whisperTimed += words.length; }
    else timed = layProportional(words, start, end);
    timed.forEach((w, i) => timedWords.push({ ...w, segment: wordSeg[i] }));
  }
  timedWords.sort((a, b) => a.start - b.start);
  const method = total && whisperTimed >= total * 0.7 ? 'whisper-words' : 'proportional';
  return { timedWords, method, wordCount: total, whisperTimedWords: whisperTimed };
}

const assEscape = text => String(text || '').replace(/[{}\\]/g, '').replace(/\r?\n/g, ' ').trim();
const assTime = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = (s % 60).toFixed(2); return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(5, '0')}`; };

/**
 * ASS with \kf karaoke, one Dialogue per script segment. Dialogue windows
 * follow the WORDS (the voice), not the original segment windows: a line
 * starts when its first word is spoken and ends when its last word ends.
 */
export const KARAOKE_PRESETS = ['sweep', 'pop', 'box'];

export function buildKaraokeAss({ segments = [], timedWords = [], width = 1280, height = 720, preset = 'sweep' } = {}) {
  const style = KARAOKE_PRESETS.includes(preset) ? preset : 'sweep';
  const size = Math.max(20, Math.round(height * (style === 'pop' ? 0.075 : 0.05)));
  // sweep: classic \kf fill (yellow sung / white unsung).
  // box:   the whole line sits on a solid highlight strip; words turn black
  //        as they are sung (BorderStyle 3 = opaque box in OutlineColour).
  // pop:   one word at a time, large, scaling in — the TikTok word style;
  //        rendered below from the same timed words, no \kf events.
  const styleLine = style === 'box'
    ? `Style: Karaoke, Arial, ${size}, &H00000000, &H00FFFFFF, &H0000FFFF, &H00000000, -1, 0, 0, 0, 100, 100, 0, 0, 3, 10, 0, 2, 30, 30, ${Math.round(height * 0.045)}, 1`
    : `Style: Karaoke, Arial, ${size}, &H0000FFFF, &H00FFFFFF, &H78000000, &H00000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 0, 2, 30, 30, ${Math.round(height * 0.045)}, 1`;
  const lines = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${width}`, `PlayResY: ${height}`, '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    styleLine,
    '', '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  if (style === 'pop') {
    let prevEnd = 0;
    segments.forEach((seg, si) => {
      const words = timedWords.filter(w => w.segment === si);
      words.forEach((w) => {
        const start = Math.max(prevEnd, w.start);
        const end = Math.max(start + 0.08, w.end);
        const big = Math.round(size * 1.35);
        lines.push(`Dialogue: 0, ${assTime(start)}, ${assTime(end)}, Karaoke, , 0, 0, 0, , {\\fs${big}\\t(0,110,\\fs${size})\\fad(35,45)}${assEscape(w.text)}`);
        prevEnd = end;
      });
    });
    return lines.join('\n') + '\n';
  }
  let prevEnd = 0;
  segments.forEach((seg, si) => {
    const words = timedWords.filter(w => w.segment === si);
    if (!words.length) return;
    const start = Math.max(prevEnd, words[0].start - 0.12);
    const end = words[words.length - 1].end;
    const totalCs = Math.max(1, Math.round((end - start) * 100));
    let used = 0;
    const parts = [];
    const lead = Math.round((words[0].start - start) * 100);
    if (lead > 1) { parts.push(`{\\kf${lead}}`); used += lead; }
    words.forEach((w, j) => {
      let cs = Math.round((w.end - w.start) * 100);
      if (j === words.length - 1) cs = Math.max(1, totalCs - used);
      else cs = Math.max(1, Math.min(cs, totalCs - used - (words.length - 1 - j)));
      used += cs;
      parts.push(`{\\kf${cs}}${assEscape(w.text)}`);
    });
    lines.push(`Dialogue: 0, ${assTime(start)}, ${assTime(end)}, Karaoke, , 0, 0, 0, , ${parts.join(' ')}`);
    prevEnd = end;
  });
  return lines.join('\n') + '\n';
}
