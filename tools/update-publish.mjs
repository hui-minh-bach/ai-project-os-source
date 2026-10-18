#!/usr/bin/env node
// Owner tool — publish a signed update manifest for AI Project OS. OWNER ONLY.
// Usage:
//   node tools/update-publish.mjs --zip <AI_PROJECT_OS_vX.Y.Z.zip> --version X.Y.Z \
//     --base-url https://updates.example.com/aios --private <owner-private.pem> \
//     [--notes "Ghi chú phát hành"] [--out update-manifest.json]
// The customer app downloads <base-url>/update-manifest.json, verifies the
// Ed25519 signature + the zip SHA-256, stages the zip, and the launcher
// applies it on next start with backup/rollback.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { signManifest } from '../src/lib/updater.mjs';

function arg(name, fallback = null) { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : fallback; }
const zip = arg('zip'), version = arg('version'), baseUrl = arg('base-url'), priv = arg('private');
if (!zip || !fs.existsSync(zip) || !version || !baseUrl || !priv || !fs.existsSync(priv)) {
  console.error('Thiếu --zip/--version/--base-url/--private hợp lệ'); process.exit(1);
}
const buf = fs.readFileSync(zip);
const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
const manifest = signManifest(fs.readFileSync(priv, 'utf8'), {
  version, url: baseUrl.replace(/\/$/, '') + '/' + path.basename(zip),
  sha256, size: buf.length, releasedAt: new Date().toISOString(), notes: arg('notes', ''),
});
const out = arg('out', 'update-manifest.json');
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log('Đã ký manifest:', out);
console.log(JSON.stringify(manifest, null, 2));
console.log('\nĐưa 2 file này lên máy chủ cập nhật:', path.basename(zip), '+', out);
