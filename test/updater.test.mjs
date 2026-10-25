import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
function generateLicenseKeyPair(){const{publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');return{publicKeyPem:publicKey.export({type:'spki',format:'pem'}),privateKeyPem:privateKey.export({type:'pkcs8',format:'pem'})};}
import {
  compareVersions, signManifest, verifyManifest, createZipBuffer, extractZipTo,
  createUpdater, applyPendingUpdate,
} from '../src/lib/updater.mjs';

const kp = generateLicenseKeyPair();
const trust = { enabled:true, schemaVersion:1, product:'ai-project-os-personal', channel:'personal-stable', manifestUrl:'https://personal.example/update-manifest.json', publicKeyPem:kp.publicKeyPem };
const fetchImpl = async (url, options) => { const r = await fetch(base + new URL(url).pathname, options); return {ok:r.ok, json:()=>r.json(), body:r.body}; };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aios-upd-'));

test('version compare', () => {
  assert.equal(compareVersions('0.9.0', '0.8.5'), 1);
  assert.equal(compareVersions('0.8.5', '0.9.0'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
});

test('manifest signature: valid passes, tampered rejected', () => {
  const m = signManifest(kp.privateKeyPem, { channel: 'personal-stable', version: '0.9.0', url: 'https://x/a.zip', sha256: 'ab'.repeat(32), size: 10 });
  assert.equal(verifyManifest(m, kp.publicKeyPem).version, '0.9.0');
  assert.throws(() => verifyManifest({ ...m, sha256: 'cd'.repeat(32) }, kp.publicKeyPem), (e) => e.code === 'UPDATE_MANIFEST_SIGNATURE');
});

test('zip roundtrip + traversal guard', () => {
  const dir = tmp();
  const buf = createZipBuffer({ 'src/a.txt': 'hello', 'b/c.txt': Buffer.from('world') });
  const written = extractZipTo(buf, dir);
  assert.deepEqual(written.sort(), ['b/c.txt', 'src/a.txt']);
  assert.equal(fs.readFileSync(path.join(dir, 'src/a.txt'), 'utf8'), 'hello');
  const evil = createZipBuffer({ '../evil.txt': 'x' });
  assert.throws(() => extractZipTo(evil, dir), (e) => e.code === 'UPDATE_ZIP_PATH');
  const dataEntry = createZipBuffer({ 'data/secret.txt': 'x' });
  assert.throws(() => extractZipTo(dataEntry, dir), (e) => e.code === 'UPDATE_ZIP_PATH');
});

// Mock update server: serves the signed manifest + zip like the owner's host.
let server, base, zipBuf, manifest;
before(async () => {
  zipBuf = createZipBuffer({ 'src/server.mjs': 'NEW SERVER', 'NEWFILE.txt': 'added' });
  const sha = crypto.createHash('sha256').update(zipBuf).digest('hex');
  server = http.createServer((req, res) => {
    if (req.url === '/update-manifest.json') {
      manifest = signManifest(kp.privateKeyPem, { channel: 'personal-stable', version: '0.9.0', url: 'https://personal.example/pkg.zip', sha256: sha, size: zipBuf.length });
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(manifest));
    } else if (req.url === '/pkg.zip') { res.writeHead(200, { 'content-type': 'application/zip' }); res.end(zipBuf); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('updater: check finds signed update, download stages a verified zip', async () => {
  const dataDir = tmp();
  const up = createUpdater({ dataDir, currentVersion: '0.8.5', policy: trust, fetchImpl });
  up.setConfig({ url: trust.manifestUrl });
  const c = await up.check();
  assert.equal(c.available, true);
  assert.equal(c.manifest.version, '0.9.0');
  const d = await up.download();
  assert.equal(d.downloaded, true);
  assert.equal(up.status().pending.version, '0.9.0');
  const up2 = createUpdater({ dataDir, currentVersion: '0.9.0', policy: trust, fetchImpl });
  const c2 = await up2.check();
  assert.equal(c2.available, false);
});

test('apply: updates + adds files with backup; corrupt staged zip rolls back cleanly', async () => {
  const dataDir = tmp(), appRoot = tmp();
  fs.mkdirSync(path.join(appRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(appRoot, 'src/server.mjs'), 'OLD SERVER');
  const up = createUpdater({ dataDir, currentVersion: '0.8.5', policy: trust, fetchImpl });
  up.setConfig({ url: trust.manifestUrl });
  await up.download();
  const r = applyPendingUpdate({ appRoot, dataDir, currentVersion:'0.8.5', policy:trust });
  assert.equal(r.applied, true);
  assert.equal(fs.readFileSync(path.join(appRoot, 'src/server.mjs'), 'utf8'), 'NEW SERVER');
  assert.equal(fs.readFileSync(path.join(appRoot, 'NEWFILE.txt'), 'utf8'), 'added');
  assert.equal(fs.readFileSync(path.join(r.backupDir, 'src/server.mjs'), 'utf8'), 'OLD SERVER');
  // Corrupt a second staged update: hash mismatch must refuse and keep files.
  await up.download();
  const pend = JSON.parse(fs.readFileSync(path.join(dataDir, 'pending-update.json'), 'utf8'));
  fs.writeFileSync(pend.file, 'tampered');
  const r2 = applyPendingUpdate({ appRoot, dataDir, currentVersion:'0.8.5', policy:trust });
  assert.equal(r2.applied, false);
  assert.equal(r2.reason, 'UPDATE_HASH');
  assert.equal(fs.readFileSync(path.join(appRoot, 'src/server.mjs'), 'utf8'), 'NEW SERVER');
});
