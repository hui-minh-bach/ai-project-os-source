/**
 * Karaoke captions: the subtitle text lights up word by word, in step with
 * the spoken voice ("chữ ra tới đâu đọc tới đó"). Timing sources, in order:
 *  1. Measured word boundaries from local Whisper run over the FINAL speech
 *     track (the app's own synthesized voice) — real timing, no guessing.
 *  2. Deterministic proportional split of each segment window across its
 *     words (by word length) when Whisper is unavailable.
 * The DISPLAYED text always comes from the segment script/translation —
 * Whisper only ever contributes timing boundaries, never the words shown.
 * Rendering is standard ASS \kf karaoke through the usual subtitles burn.
 */

const wordsOf = text => String(text || '').trim().split(/\s+/).filter(Boolean);

/** Split one segment window across its own words, proportional to length. */
export function proportionalWords(segment) {
  const words = wordsOf(segment.text);
  if (!words.length) return [];
  const start = Number(segment.start), end = Number(segment.end);
  const span = Math.max(0.01, end - start);
  const weights = words.map(w => Math.max(2, w.length));
  const total = weights.reduce((a, b) => a + b, 0);
  let t = start;
  return words.map((text, i) => {
    const from = t;
    const to = i === words.length - 1 ? end : start + span * (weights.slice(0, i + 1).reduce((a, b) => a + b, 0) / total);
    t = to;
    return { text, start: Number(from.toFixed(3)), end: Number(to.toFixed(3)) };
  });
}

/**
 * Align Whisper word timings to the script's segments. Whisper contributes
 * boundary TIMES only: each segment's own words are laid over the whisper
 * boundaries found inside its window (resampled by character position when
 * the counts differ). Segments without usable whisper coverage fall back to
 * the proportional split. Reports which method produced the timings.
 */
export function alignWordsToSegments(segments, whisperWords) {
  const perSegment = [];
  let whisperTimed = 0, totalWords = 0;
  for (const seg of segments) {
    const own = wordsOf(seg.text);
    totalWords += own.length;
    const inside = (whisperWords || []).filter(w => {
      const mid = (w.start + w.end) / 2;
      return mid >= seg.start - 0.25 && mid <= seg.end + 0.25;
    });
    if (own.length && inside.length >= Math.max(1, Math.floor(own.length * 0.5))) {
      // Resample: cumulative character position of each script word mapped
      // onto the whisper words' start times (plus the segment end).
      const anchors = inside.map(w => w.start);
      anchors.push(Math.min(seg.end, inside[inside.length - 1].end));
      const cum = [0];
      for (const w of inside) cum.push(cum[cum.length - 1] + Math.max(1, w.text.length));
      const at = frac => {
        const pos = frac * (cum[cum.length - 1]);
        let j = 0; while (j < cum.length - 2 && cum[j + 1] < pos) j++;
        const span = Math.max(1e-6, cum[j + 1] - cum[j]);
        return anchors[j] + (anchors[Math.min(j + 1, anchors.length - 1)] - anchors[j]) * ((pos - cum[j]) / span);
      };
      const charTotal = own.reduce((a, w) => a + Math.max(1, w.length), 0);
      let acc = 0;
      const timed = own.map((text, i) => {
        const from = i === 0 ? Math.max(seg.start, Math.min(at(0), seg.end)) : at(acc / charTotal);
        acc += Math.max(1, text.length);
        const to = i === own.length - 1 ? seg.end : Math.max(from + 0.01, at(acc / charTotal));
        return { text, start: Number(Math.max(seg.start, from).toFixed(3)), end: Number(Math.min(seg.end, to).toFixed(3)) };
      });
      // Enforce monotonic non-overlapping boundaries.
      for (let i = 1; i < timed.length; i++) if (timed[i].start < timed[i - 1].end) { timed[i].start = timed[i - 1].end; if (timed[i].end < timed[i].start + 0.01) timed[i].end = Math.min(seg.end, timed[i].start + 0.01); }
      perSegment.push(timed);
      whisperTimed += own.length;
    } else {
      perSegment.push(proportionalWords(seg));
    }
  }
  const method = totalWords && whisperTimed >= totalWords * 0.7 ? 'whisper-words' : (whisperTimed > 0 ? 'proportional' : 'proportional');
  return { perSegment, method, wordCount: totalWords, whisperTimedWords: whisperTimed };
}

const assEscape = text => String(text || '').replace(/[{}\\]/g, '').replace(/\r?\n/g, ' ').trim();
const assTime = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = (s % 60).toFixed(2); return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(5, '0')}`; };

/**
 * ASS with \kf karaoke: unsung words render white (Secondary), the fill
 * sweeps to yellow (Primary) exactly as each word is spoken.
 */
export function buildKaraokeAss({ segments = [], perSegment = [], width = 1280, height = 720 } = {}) {
  const size = Math.max(20, Math.round(height * 0.05));
  const lines = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${width}`, `PlayResY: ${height}`, '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Karaoke, Arial, ${size}, &H0000FFFF, &H00FFFFFF, &H78000000, &H00000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 0, 2, 30, 30, ${Math.round(height * 0.045)}, 1`,
    '', '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  segments.forEach((seg, i) => {
    const timed = perSegment[i] || [];
    if (!timed.length) return;
    const segCs = Math.max(1, Math.round((seg.end - seg.start) * 100));
    let used = 0;
    const parts = [];
    const lead = Math.round((timed[0].start - seg.start) * 100);
    if (lead > 1) { parts.push(`{\\kf${lead}}`); used += lead; }
    timed.forEach((w, j) => {
      let cs = Math.round((w.end - w.start) * 100);
      if (j === timed.length - 1) cs = Math.max(1, segCs - used);
      else cs = Math.max(1, Math.min(cs, segCs - used - (timed.length - 1 - j)));
      used += cs;
      parts.push(`{\\kf${cs}}${assEscape(w.text)}`);
    });
    lines.push(`Dialogue: 0, ${assTime(seg.start)}, ${assTime(seg.end)}, Karaoke, , 0, 0, 0, , ${parts.join(' ')}`);
  });
  return lines.join('\n') + '\n';
}
