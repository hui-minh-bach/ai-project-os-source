/**
 * Image generation routing for AI Project OS.
 * Routes, in the product's own connection model:
 *  - 'chatgpt-account': the logged-in ChatGPT account via the Codex CLI
 *    app-server hosted image tool (subscription quota, no API key).
 *  - 'gemini-api': a Gemini API connection (Vault key) calling an image
 *    model (gemini image output or Imagen predict).
 *  - 'openai-api': an OpenAI API connection (Vault key) /images/generations.
 * Account kinds without a verified image mechanism (Claude, Gemini account,
 * Antigravity) are refused honestly; nothing is ever simulated.
 */
import fs from 'node:fs';
import path from 'node:path';
import { listConnections, getConnection, vaultStatus } from './vault.mjs';
import { generateAccountImage } from './account-auth.mjs';

function err(code, message) { const e = new Error(message); e.code = code; return e; }
export const IMAGE_PROVIDERS = Object.freeze(['auto', 'chatgpt-account', 'gemini-api', 'openai-api']);
const ACCOUNT_KINDS_WITHOUT_IMAGE = Object.freeze(['claude_account', 'gemini_account', 'antigravity_account']);

export function imageProviderStatus() {
  if (!vaultStatus().unlocked) return { available: false, routes: [], reason: 'Vault đang khóa; chưa xác định được nhà cung cấp ảnh.' };
  let conns = [];
  try { conns = listConnections(); } catch { return { available: false, routes: [], reason: 'Không đọc được danh sách kết nối.' }; }
  const routes = [];
  if (conns.some(c => c.kind === 'chatgpt_account')) routes.push('chatgpt-account');
  if (conns.some(c => c.kind === 'gemini')) routes.push('gemini-api');
  if (conns.some(c => c.kind === 'openai')) routes.push('openai-api');
  return routes.length
    ? { available: true, routes, reason: null }
    : { available: false, routes: [], reason: 'Chưa có kết nối nào sinh được ảnh. Đăng nhập tài khoản ChatGPT (Codex) hoặc thêm kết nối Gemini/OpenAI API trong Vault.' };
}

function pickConnection(kind) {
  const c = listConnections().find(x => x.kind === kind);
  if (!c) return null;
  return getConnection(c.id);
}

function assertImageBytes(bytes) {
  if (!bytes || bytes.length <= 1000) throw err('BLOCKED_PROVIDER', 'Nhà cung cấp không trả dữ liệu ảnh hợp lệ. Không lưu tệp giả.');
  const ext = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? '.png'
    : bytes[0] === 0xff && bytes[1] === 0xd8 ? '.jpg'
    : bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP' ? '.webp' : null;
  if (!ext) throw err('BLOCKED_PROVIDER', 'Dữ liệu trả về không phải PNG/JPEG/WebP hợp lệ.');
  return ext;
}

function saveImage(bytes, output) {
  const ext = assertImageBytes(bytes);
  const finalPath = output.replace(/\.[a-z0-9]+$/i, '') + ext;
  fs.mkdirSync(path.dirname(finalPath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(finalPath, bytes, { mode: 0o600 });
  return finalPath;
}

async function geminiApiImage(conn, { prompt, output, fetchImpl }) {
  const secret = conn.secret;
  if (!secret) throw err('BLOCKED_PROVIDER', 'Kết nối Gemini API chưa có khóa trong Vault.');
  const model = /image|imagen/i.test(conn.model || '') ? conn.model : 'gemini-2.5-flash-image';
  const base = (conn.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  let bytes = null;
  if (/^imagen/i.test(model)) {
    const r = await fetchImpl(`${base}/models/${model}:predict`, { method: 'POST', headers: { 'x-goog-api-key': secret, 'content-type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '16:9' } }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw err('BLOCKED_PROVIDER', `Gemini Imagen từ chối yêu cầu (${r.status}).`);
    const b64 = j?.predictions?.[0]?.bytesBase64Encoded;
    if (b64) bytes = Buffer.from(b64, 'base64');
  } else {
    const r = await fetchImpl(`${base}/models/${model}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': secret, 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw err('BLOCKED_PROVIDER', `Gemini từ chối yêu cầu sinh ảnh (${r.status}).`);
    const part = (j?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data);
    if (part) bytes = Buffer.from(part.inlineData.data, 'base64');
  }
  if (!bytes) throw err('BLOCKED_PROVIDER', 'Gemini không trả ảnh trong phản hồi. Không thay bằng ảnh giả.');
  const file = saveImage(bytes, output);
  return { provider: 'gemini-api', model, file, bytes: bytes.length, revisedPrompt: null };
}

async function openaiApiImage(conn, { prompt, output, size, fetchImpl }) {
  const secret = conn.secret;
  if (!secret) throw err('BLOCKED_PROVIDER', 'Kết nối OpenAI API chưa có khóa trong Vault.');
  const model = /image|dall/i.test(conn.model || '') ? conn.model : 'gpt-image-1';
  const base = (conn.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '').replace(/\/responses$/, '');
  const r = await fetchImpl(`${base}/images/generations`, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify({ model, prompt, size: size || '1536x1024' }) });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw err('BLOCKED_PROVIDER', `OpenAI từ chối yêu cầu sinh ảnh (${r.status}).`);
  let bytes = null;
  if (j?.data?.[0]?.b64_json) bytes = Buffer.from(j.data[0].b64_json, 'base64');
  else if (j?.data?.[0]?.url) { const img = await fetchImpl(j.data[0].url); if (img.ok) bytes = Buffer.from(await img.arrayBuffer()); }
  if (!bytes) throw err('BLOCKED_PROVIDER', 'OpenAI không trả ảnh trong phản hồi. Không thay bằng ảnh giả.');
  const file = saveImage(bytes, output);
  return { provider: 'openai-api', model, file, bytes: bytes.length, revisedPrompt: j?.data?.[0]?.revised_prompt || null };
}

/**
 * Generate one image to `output` (extension is corrected to the real format).
 * 'auto' commits to the first configured route in account-first order and
 * surfaces that route's errors; it never silently falls back to a billable
 * API after a route has been chosen.
 */
export async function generateImage({ provider = 'auto', prompt, output, size, fetchImpl = globalThis.fetch } = {}) {
  if (!IMAGE_PROVIDERS.includes(provider)) throw err('MEDIA_INPUT', 'Nguồn sinh ảnh không hợp lệ.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 4000) throw err('MEDIA_INPUT', 'Mô tả ảnh cần 1-4.000 ký tự.');
  if (typeof output !== 'string' || !output) throw err('MEDIA_INPUT', 'Thiếu đường dẫn tệp ảnh đầu ra.');
  if (!vaultStatus().unlocked) throw err('BLOCKED_PROVIDER', 'Vault đang khóa; chưa thể dùng kết nối sinh ảnh.');
  let route = provider;
  if (route === 'auto') {
    const status = imageProviderStatus();
    if (!status.available) throw err('BLOCKED_PROVIDER', status.reason);
    route = status.routes[0];
  }
  if (route === 'chatgpt-account') {
    const conn = pickConnection('chatgpt_account');
    if (!conn) throw err('BLOCKED_PROVIDER', 'Chưa có kết nối tài khoản ChatGPT. Vào Kết nối, đăng nhập ChatGPT bằng Codex rồi thử lại.');
    return generateAccountImage(conn, { prompt, outputPath: output });
  }
  if (route === 'gemini-api') {
    const conn = pickConnection('gemini');
    if (!conn) throw err('BLOCKED_PROVIDER', 'Chưa có kết nối Gemini API trong Vault.');
    return geminiApiImage(conn, { prompt, output, fetchImpl });
  }
  if (route === 'openai-api') {
    const conn = pickConnection('openai');
    if (!conn) throw err('BLOCKED_PROVIDER', 'Chưa có kết nối OpenAI API trong Vault.');
    return openaiApiImage(conn, { prompt, output, size, fetchImpl });
  }
  throw err('BLOCKED_PROVIDER', 'Nguồn sinh ảnh chưa được hỗ trợ.');
}

export { ACCOUNT_KINDS_WITHOUT_IMAGE };
