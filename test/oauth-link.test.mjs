import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startMockPlatforms } from './fixtures/mock-platforms.mjs';
import { fetchPlatformIdentity, oauthRefreshToken, facebookUpload } from '../src/lib/publish-platforms.mjs';

// The linking flow the Connections tab drives (0.9.16): after the OAuth
// callback exchanges the code, the app asks the platform WHO the token
// belongs to, stores Facebook Page tokens, picks the Page token when
// posting, and refreshes YouTube tokens. All verified against the
// protocol-faithful mock platforms.

test('identity: YouTube channel, Facebook pages + page tokens, TikTok user', async (t) => {
  const mock = await startMockPlatforms();
  t.after(() => mock.close());
  const conn = (kind) => ({ kind, baseUrl: mock.baseUrl, secret: JSON.stringify({ accessToken: 'mock-access-token' }) });
  const yt = await fetchPlatformIdentity('youtube', { connection: conn('youtube') });
  assert.equal(yt.channelTitle, 'Kênh Mock');
  assert.equal(yt.channelId, 'mock-channel-1');
  assert.equal(yt.accountLabel, 'Kênh Mock');
  const fb = await fetchPlatformIdentity('facebook', { connection: conn('facebook') });
  assert.equal(fb.pages.length, 2);
  assert.equal(fb.pages[0].name, 'Page Một');
  assert.equal(fb.pageTokens['page-2'], 'mock-page-token-2');
  const tt = await fetchPlatformIdentity('tiktok', { connection: conn('tiktok') });
  assert.equal(tt.username, 'mock.creator');
  assert.equal(tt.accountLabel, 'Mock Creator');
});

test('youtube refresh keeps the refresh token when the response omits it', async () => {
  const stub = async (url, init) => {
    assert.match(String(init.body), /grant_type=refresh_token/);
    return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'fresh-access', expires_in: 3600 }) };
  };
  const out = await oauthRefreshToken('youtube', { clientId: 'cid', clientSecret: 'cs', refreshToken: 'rt-1', fetchImpl: stub });
  assert.equal(out.accessToken, 'fresh-access');
  assert.equal(out.refreshToken, 'rt-1');
  assert.ok(out.expiresAt);
});

test('facebook upload posts with the PAGE token, not the user token', async (t) => {
  const mock = await startMockPlatforms();
  t.after(() => mock.close());
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aios-fb-')), 'clip.mp4');
  fs.writeFileSync(file, Buffer.alloc(2048, 7));
  const seenAuth = [];
  const recordingFetch = (url, init = {}) => { if (init.headers?.authorization) seenAuth.push(init.headers.authorization); return fetch(url, init); };
  const connection = { kind: 'facebook', baseUrl: mock.baseUrl, meta: { pageId: 'page-1', pageName: 'Page Một' }, secret: JSON.stringify({ accessToken: 'mock-user-token', pageTokens: { 'page-1': 'mock-page-token-1', 'page-2': 'mock-page-token-2' } }) };
  const res = await facebookUpload({ connection, file, title: 'Video Page', fetchImpl: recordingFetch });
  assert.ok(res.platformVideoId);
  assert.ok(seenAuth.length >= 2);
  assert.ok(seenAuth.every(a => a === 'Bearer mock-page-token-1'), 'every call used the page token: ' + seenAuth.join(','));
});

test('Connections tab carries the linking UI wired to the OAuth routes', () => {
  const html = fs.readFileSync(new URL('../public/tabs/connections.html', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../public/tabs/connections.js', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  assert.ok(html.includes('id="platformGrid"'), 'platform grid mount');
  assert.match(js, /renderConnectionPlatforms/, 'platform cards rendered');
  assert.match(js, /\/api\/connections\/oauth\//, 'oauth start wired');
  assert.match(js, /platform-page/, 'facebook page picker wired');
  assert.match(js, /api\/connections\/oauth\/\$\{kind\}\/callback/, 'redirect uri shown to the user');
  assert.match(server, /fetchPlatformIdentity\(kind/, 'callback resolves the real account identity');
});
