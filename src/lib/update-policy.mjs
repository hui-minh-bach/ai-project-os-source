import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ID } from './app-identity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// Public upstream key is retained ONLY to reject it as a Personal trust anchor.
const UPSTREAM_KEY = 'MCowBQYDK2VwAyEAzVC63rnj173w3DG62Jc48aC5MxeVVUAmJFCPUSpOuKE=';
export const DISABLED_UPDATE_POLICY = Object.freeze({ enabled: false, product: APP_ID, reason: 'UPDATE_DISABLED' });
export function updateError(code, message) { return Object.assign(new Error(message), { code }); }

export function trustedUpdateUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw updateError('UPDATE_TRUST', 'Địa chỉ cập nhật không hợp lệ.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      /hui-minh-bach/i.test(decodeURIComponent(url.href)))
    throw updateError('UPDATE_TRUST', 'Chỉ chấp nhận HTTPS của kênh Personal; kênh tác giả gốc bị chặn.');
  return url.href;
}

export function validateUpdatePolicy(input) {
  if (!input || input.enabled !== true) return DISABLED_UPDATE_POLICY;
  if (input.schemaVersion !== 1 || input.product !== APP_ID || !/^personal-[a-z0-9-]{1,40}$/.test(input.channel || ''))
    throw updateError('UPDATE_TRUST', 'Cấu hình phải định danh đúng kênh Personal.');
  let key;
  try { key = crypto.createPublicKey(input.publicKeyPem); } catch { throw updateError('UPDATE_TRUST', 'Thiếu public key Personal hợp lệ.'); }
  if (key.asymmetricKeyType !== 'ed25519' || key.export({ type: 'spki', format: 'der' }).toString('base64') === UPSTREAM_KEY)
    throw updateError('UPDATE_TRUST', 'Cần khóa Ed25519 riêng của Personal Edition.');
  return Object.freeze({ enabled: true, schemaVersion: 1, product: APP_ID, channel: input.channel,
    manifestUrl: trustedUpdateUrl(input.manifestUrl), publicKeyPem: key.export({ type: 'spki', format: 'pem' }) });
}

// Installation-owned trust, never loaded from backup-restored user data, browser
// URL settings or AIOS_UPDATE_MANIFEST_URL. Missing/invalid trust fails closed.
export function loadUpdatePolicy(appRoot = ROOT) {
  try { return validateUpdatePolicy(JSON.parse(fs.readFileSync(path.join(appRoot, 'personal-update-trust.json'), 'utf8'))); }
  catch { return Object.freeze({ ...DISABLED_UPDATE_POLICY, reason: 'UPDATE_TRUST_NOT_CONFIGURED' }); }
}

export function assertPackageChannel(manifest, policy) {
  if (!policy.enabled) throw updateError('UPDATE_DISABLED', 'Cập nhật Personal đang tắt.');
  if (manifest.product !== APP_ID || manifest.channel !== policy.channel)
    throw updateError('UPDATE_CHANNEL', 'Gói không thuộc kênh Personal đã tin cậy.');
  const url = trustedUpdateUrl(manifest.url);
  if (new URL(url).origin !== new URL(policy.manifestUrl).origin)
    throw updateError('UPDATE_CHANNEL', 'Gói phải nằm trên cùng máy chủ HTTPS với kênh đã tin cậy.');
}
