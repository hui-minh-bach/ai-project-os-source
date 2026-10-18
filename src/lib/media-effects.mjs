/**
 * Curated, deterministic video effects for Media Studio (the CapCut-style
 * effects panel). The user picks presets; this module composes ONE ffmpeg
 * filter graph in a fixed order. No AI chooses or tunes anything here.
 * Text effects (title / lower-third) are rendered through a generated ASS
 * file burned with the same subtitles filter the dub pipeline uses.
 */
export const EFFECT_CATALOG = [
  { id: 'pad-vertical', group: 'Khung hình', label: 'Dọc 9:16 nền mờ', hint: 'cho TikTok / Reels / Shorts' },
  { id: 'pad-horizontal', group: 'Khung hình', label: 'Ngang 16:9 nền mờ', hint: 'cho YouTube' },
  { id: 'vivid', group: 'Màu sắc', label: 'Màu rực rỡ' },
  { id: 'bright', group: 'Màu sắc', label: 'Sáng hơn' },
  { id: 'warm', group: 'Màu sắc', label: 'Tông ấm' },
  { id: 'cool', group: 'Màu sắc', label: 'Tông lạnh' },
  { id: 'bw', group: 'Màu sắc', label: 'Trắng đen' },
  { id: 'vintage', group: 'Màu sắc', label: 'Cổ điển (vintage)' },
  { id: 'vignette', group: 'Màu sắc', label: 'Tối bốn góc' },
  { id: 'sharpen', group: 'Màu sắc', label: 'Làm nét' },
  { id: 'zoom-in', group: 'Chuyển động', label: 'Zoom chậm vào giữa' },
  { id: 'zoom-out', group: 'Chuyển động', label: 'Zoom chậm ra' },
  { id: 'speed-up', group: 'Chuyển động', label: 'Nhanh hơn 1.25x' },
  { id: 'slow-down', group: 'Chuyển động', label: 'Chậm lại 0.8x' },
  { id: 'fade', group: 'Chuyển động', label: 'Mờ mở đầu + kết thúc' },
  { id: 'title', group: 'Chữ', label: 'Tiêu đề mở đầu', hint: 'điền chữ ở ô Tiêu đề' },
  { id: 'lower-third', group: 'Chữ', label: 'Thẻ tên góc trái dưới', hint: 'điền chữ ở ô Thẻ tên' },
];
export const EFFECT_IDS = new Set(EFFECT_CATALOG.map(e => e.id));
const even = n => Math.max(2, Math.round(n / 2) * 2);

/**
 * Compose the video filter graph. Returns graph `parts` producing the label
 * [fxStage] (the caller may append a subtitles burn for text effects and map
 * [fxv]), the audio filter string (or null), what was applied/skipped and
 * the resulting geometry/duration. Pure and unit-testable.
 */
export function buildEffectsGraph({ effects = [], width = 0, height = 0, fps = 25, duration = 10 } = {}) {
  const want = new Set(effects);
  const applied = [], skipped = [], parts = [];
  let W = width, H = height, cur = '0:v', stage = 0;
  const next = () => 'fx' + (++stage);
  let speed = 1;
  if (want.has('speed-up')) { speed = 1.25; const l = next(); parts.push(`[${cur}]setpts=PTS/1.25[${l}]`); cur = l; applied.push('speed-up'); }
  if (want.has('slow-down')) {
    if (speed === 1) { speed = 0.8; const l = next(); parts.push(`[${cur}]setpts=PTS/0.8[${l}]`); cur = l; applied.push('slow-down'); }
    else skipped.push({ id: 'slow-down', reason: 'Đã chọn tăng tốc, không thể vừa nhanh vừa chậm' });
  }
  const outDuration = duration / speed;
  // Frame pads: blurred-background canvas in the other aspect ratio.
  const pad = (id, cw, ch) => {
    const l = next();
    parts.push(`[${cur}]split=2[${l}a][${l}b]`,
      `[${l}b]scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch},boxblur=luma_radius=28:luma_power=3[${l}bg]`,
      `[${l}a]scale=${cw}:${ch}:force_original_aspect_ratio=decrease[${l}fg]`,
      `[${l}bg][${l}fg]overlay=(W-w)/2:(H-h)/2[${l}]`);
    cur = l; W = cw; H = ch; applied.push(id);
  };
  // Full-size social canvases: a landscape source becomes a real 1080x1920
  // vertical frame (blurred backdrop upscaled), never the source height shrunk.
  if (want.has('pad-vertical')) {
    if (W > 0 && H > 0 && W / H > 9 / 16 + 0.01) pad('pad-vertical', 1080, 1920);
    else skipped.push({ id: 'pad-vertical', reason: 'Video đã là khung dọc 9:16 hoặc hẹp hơn' });
  } else if (want.has('pad-horizontal')) {
    if (W > 0 && H > 0 && H / W > 9 / 16 + 0.01) pad('pad-horizontal', 1920, 1080);
    else skipped.push({ id: 'pad-horizontal', reason: 'Video đã là khung ngang 16:9 hoặc rộng hơn' });
  }
  // Slow zooms (after pads, on the final frame size).
  const frames = Math.max(1, Math.round(outDuration * fps));
  for (const id of ['zoom-in', 'zoom-out']) {
    if (!want.has(id)) continue;
    if (applied.includes('zoom-in') || applied.includes('zoom-out')) { skipped.push({ id, reason: 'Chỉ chọn một kiểu zoom' }); continue; }
    const z = id === 'zoom-in' ? `min(1+0.3*on/${frames},1.3)` : `max(1.3-0.3*on/${frames},1)`;
    const l = next();
    parts.push(`[${cur}]scale=${even(W * 1.6)}:${even(H * 1.6)},zoompan=z='${z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${fps}[${l}]`);
    cur = l; applied.push(id);
  }
  // Colour + finish chain (single sequential run).
  const chain = [];
  if (want.has('vivid')) { chain.push('eq=contrast=1.08:saturation=1.35:brightness=0.02'); applied.push('vivid'); }
  if (want.has('bright')) { chain.push('eq=brightness=0.08:saturation=1.1'); applied.push('bright'); }
  if (want.has('warm')) { chain.push('colorbalance=rs=0.12:gs=0.04:bs=-0.12:rm=0.08:bm=-0.08'); applied.push('warm'); }
  if (want.has('cool')) { chain.push('colorbalance=rs=-0.10:bs=0.12:rm=-0.05:bm=0.08'); applied.push('cool'); }
  if (want.has('bw')) { chain.push('hue=s=0'); applied.push('bw'); }
  if (want.has('vintage')) { chain.push('colorbalance=rs=0.15:gs=0.05:bs=-0.15', 'eq=contrast=0.92:saturation=0.75:brightness=0.03'); applied.push('vintage'); }
  if (want.has('vignette')) { chain.push('vignette'); applied.push('vignette'); }
  if (want.has('sharpen')) { chain.push('unsharp=5:5:0.8:5:5:0.4'); applied.push('sharpen'); }
  if (want.has('fade')) { chain.push('fade=t=in:st=0:d=0.6', `fade=t=out:st=${Math.max(0, outDuration - 0.6).toFixed(3)}:d=0.6`); applied.push('fade'); }
  if (chain.length) { const l = next(); parts.push(`[${cur}]${chain.join(',')}[${l}]`); cur = l; }
  if (!parts.length) parts.push(`[0:v]null[${cur = next()}]`);
  // Audio side.
  const audio = [];
  if (speed !== 1) audio.push(`atempo=${speed}`);
  if (want.has('fade') && applied.includes('fade')) audio.push('afade=t=in:st=0:d=0.6', `afade=t=out:st=${Math.max(0, outDuration - 0.6).toFixed(3)}:d=0.6`);
  if (want.has('title')) applied.push('title');
  if (want.has('lower-third')) applied.push('lower-third');
  return { parts, finalLabel: cur, audioFilter: audio.length ? audio.join(',') : null, applied, skipped, outDuration, outWidth: W, outHeight: H, speed };
}

const assEscape = text => String(text || '').replace(/[{}\\]/g, '').replace(/\r?\n/g, ' ').trim().slice(0, 120);
const assTime = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = (s % 60).toFixed(2); return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(5, '0')}`; };

/** Minimal ASS with a big centred opening title and/or a boxed lower-third name card. */
export function buildEffectsAss({ title = '', name = '', width = 1280, height = 720 } = {}) {
  const titleSize = Math.max(28, Math.round(height * 0.078));
  const nameSize = Math.max(18, Math.round(height * 0.042));
  const lines = [
    '[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${width}`, `PlayResY: ${height}`, '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Title, Arial, ${titleSize}, &HFFFFFF, &HFFFFFF, &H78000000, &H00000000, -1, 0, 0, 0, 100, 100, 0, 0, 1, 3, 0, 8, 40, 40, ${Math.round(height * 0.3)}, 1`,
    `Style: Name, Arial, ${nameSize}, &HFFFFFF, &HFFFFFF, &H00000000, &HA6000000, -1, 0, 0, 0, 100, 100, 0, 0, 3, 2, 0, 1, ${Math.round(width * 0.045)}, 40, ${Math.round(height * 0.055)}, 1`,
    '', '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const t = assEscape(title), n = assEscape(name);
  if (t) lines.push(`Dialogue: 0, ${assTime(0.3)}, ${assTime(3.8)}, Title, , 0, 0, 0, , {\\fad(250,400)}${t}`);
  if (n) lines.push(`Dialogue: 0, ${assTime(1)}, ${assTime(6)}, Name, , 0, 0, 0, , {\\fad(250,250)}${n}`);
  return lines.join('\n') + '\n';
}
