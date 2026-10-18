/**
 * Optional FPT.AI cloud speech port for the local-only Media Worker.
 * Vietnamese voices that sound far more natural than the local Piper model.
 * Credentials are read server-side only. The FPT.AI API is billed per
 * character by FPT.AI under the user's own API key; nothing is simulated:
 * without a key the provider blocks, and provider errors surface as-is.
 *
 * API shape (FPT.AI TTS v5): POST {base}/hmi/tts/v5 with header
 * `api-key: <key>` and JSON {text, voice, speed, format:'mp3'} returns
 * {error:0, async:'<mp3 url>', request_id}. The async URL serves the audio
 * once rendering finishes, so downloads retry briefly on 404.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const DEFAULT_BASE = 'https://api.fpt.ai';
const MAX_AUDIO = 25 * 1024 * 1024;
const fail = (code, message) => Object.assign(new Error(message), { code });

export const FPT_VOICES = [
  { id: 'banmai', name: 'Ban Mai — nữ, miền Bắc' },
  { id: 'lannhi', name: 'Lan Nhi — nữ, miền Nam' },
  { id: 'leminh', name: 'Lê Minh — nam, miền Bắc' },
  { id: 'giahuy', name: 'Gia Huy — nam, miền Nam' },
  { id: 'myan', name: 'Mỹ An — nữ, miền Trung' },
  { id: 'thuminh', name: 'Thu Minh — nữ, miền Bắc' },
  { id: 'linhsan', name: 'Linh San — nữ, miền Nam' },
];

function ffmpegConvert(bin, input, output) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input, '-ac', '1', '-ar', '44100', output], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', d => { err += d; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(fail('TTS_CONVERT', 'ffmpeg không chuyển được file giọng FPT.AI sang WAV.')));
  });
}

async function limitedBytes(response) {
  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length > MAX_AUDIO) throw fail('TTS_DOWNLOAD', 'File giọng FPT.AI vượt quá 25MB cho phép.');
  return buf;
}

export function createFptTts({ apiKey, defaultVoice, fetchImpl = fetch, ffmpegBin = 'ffmpeg', baseUrl = '', sleep = (ms) => new Promise(r => setTimeout(r, ms)) } = {}) {
  const keyNow = () => String(typeof apiKey === 'function' ? apiKey() : apiKey || '').trim();
  const voiceNow = () => String(typeof defaultVoice === 'function' ? defaultVoice() : defaultVoice || '').trim();
  const base = () => String(baseUrl || process.env.FPT_TTS_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
  const configured = () => Boolean(keyNow());

  function trustedAudioUrl(value) {
    let u; try { u = new URL(value); } catch { throw fail('TTS_DOWNLOAD', 'FPT.AI trả địa chỉ âm thanh không hợp lệ.'); }
    const host = u.hostname.toLowerCase();
    let baseHost = ''; try { baseHost = new URL(base()).hostname.toLowerCase(); } catch {}
    if (u.protocol !== 'https:' && !(base() && u.protocol === 'http:' && host === baseHost)) throw fail('TTS_DOWNLOAD', 'FPT.AI trả URL âm thanh không phải HTTPS; tải bị chặn.');
    if (u.username || u.password) throw fail('TTS_DOWNLOAD', 'URL âm thanh FPT.AI chứa thông tin đăng nhập; tải bị chặn.');
    if (!(host === 'fpt.ai' || host.endsWith('.fpt.ai') || host === baseHost)) throw fail('TTS_DOWNLOAD', 'FPT.AI trả URL âm thanh ngoài miền FPT.AI; tải bị chặn để bảo vệ Local Worker.');
    return u.href;
  }

  async function synthesize(input) {
    if (!configured()) throw fail('BLOCKED_TTS', 'Chưa cấu hình API key FPT.AI; nhập key trong Media Studio hoặc chọn Piper local.');
    const wanted = String(input?.voice || '').trim().toLowerCase();
    const voice = FPT_VOICES.some(v => v.id === wanted) ? wanted : (FPT_VOICES.some(v => v.id === voiceNow()) ? voiceNow() : 'banmai');
    const text = String(input?.text || '').trim();
    if (!text || text.length > 5000) throw fail('TTS_INPUT', 'Lời đọc phải có từ 1 đến 5.000 ký tự.');
    if (typeof input?.output !== 'string' || !path.isAbsolute(input.output)) throw fail('TTS_INPUT', 'Đường dẫn file kết quả phải do Worker cung cấp.');
    const lang = String(input?.language || 'vi').toLowerCase().split('-')[0];
    if (lang !== 'vi') throw fail('BLOCKED_DUB_VOICE', `Giọng FPT.AI chỉ đọc tiếng Việt, không khớp ngôn ngữ đích ${input?.language}. Chọn Piper/HeyGen cho ngôn ngữ khác.`);
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90000);
    let audioUrl, requestId = null;
    try {
      const response = await fetchImpl(`${base()}/hmi/tts/v5`, { method: 'POST', redirect: 'error', headers: { 'api-key': keyNow(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice, speed: '0', format: 'mp3' }), signal: controller.signal });
      if (!response.ok) throw fail('TTS_PROVIDER', `FPT.AI từ chối yêu cầu TTS (HTTP ${response.status}); kiểm tra API key và hạn mức ký tự.`);
      const data = await response.json();
      if (Number(data?.error ?? 0) !== 0 || typeof data?.async !== 'string') throw fail('TTS_PROVIDER', `FPT.AI trả lỗi: ${String(data?.message || 'không rõ')}. Không dựng file giả.`);
      audioUrl = data.async; requestId = data?.request_id ?? null;
    } finally { clearTimeout(timer); }
    const url = trustedAudioUrl(audioUrl);
    const tmp = path.join(path.dirname(input.output), `.fpt-${randomUUID()}.download`);
    try {
      let bytes = null, lastStatus = 0;
      for (let attempt = 0; attempt < 15 && !bytes; attempt++) {
        const dl = new AbortController(), dlTimer = setTimeout(() => dl.abort(), 30000);
        try {
          const response = await fetchImpl(url, { method: 'GET', redirect: 'error', signal: dl.signal });
          lastStatus = response.status;
          if (response.ok) { const b = await limitedBytes(response); if (b.length >= 64) bytes = b; }
        } finally { clearTimeout(dlTimer); }
        if (!bytes) await sleep(800);
      }
      if (!bytes) throw fail('TTS_DOWNLOAD', `Không tải được file giọng FPT.AI (HTTP ${lastStatus}) sau nhiều lần chờ render.`);
      fs.mkdirSync(path.dirname(input.output), { recursive: true });
      fs.writeFileSync(tmp, bytes, { flag: 'wx', mode: 0o600 });
      await ffmpegConvert(ffmpegBin, tmp, input.output);
      return { audioPath: input.output, voiceQuality: 'FPT_TTS_EXTERNAL_API', provider: 'fpt', voice, providerRequestId: requestId };
    } finally { try { fs.rmSync(tmp, { force: true }); } catch {} }
  }

  async function listVoices() { return FPT_VOICES.map(v => ({ ...v, language: 'vi' })); }
  return { configured, get defaultVoice() { return voiceNow(); }, synthesize, listVoices };
}
