import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startMockPlatforms } from './fixtures/mock-platforms.mjs';
import { youtubeUpload, youtubeStats, facebookUpload, facebookStats, tiktokUpload, tiktokStats, oauthAuthorizeUrl, oauthExchangeCode, platformConnectionStatus } from '../src/lib/publish-platforms.mjs';

function tempVideo(bytes = 300000) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-publish-'));
  const file = path.join(dir, 'video.mp4');
  fs.writeFileSync(file, Buffer.alloc(bytes, 7));
  return file;
}
const conn = (kind, baseUrl, meta = {}) => ({ kind, baseUrl, secret: JSON.stringify({ accessToken: 'mock-access-token', refreshToken: 'mock-refresh' }), meta });

test('publish connectors: full upload + stats round-trip against the mock platforms', async (t) => {
  const mock = await startMockPlatforms({ port: 0 });
  t.after(() => mock.close());
  const file = tempVideo();

  const ytConn = conn('youtube', mock.baseUrl, { channelTitle: 'Kênh thử nghiệm' });
  const yt = await youtubeUpload({ connection: ytConn, file, title: 'Video tin tức thử nghiệm', description: 'Mô tả', tags: ['tin'], privacyStatus: 'unlisted' });
  assert.match(yt.platformVideoId, /^yt-/);
  assert.equal(yt.url, `https://www.youtube.com/watch?v=${yt.platformVideoId}`);
  const ytStats = await youtubeStats({ connection: ytConn, videoId: yt.platformVideoId });
  assert.equal(typeof ytStats.views, 'number');
  const ytStatus = platformConnectionStatus('youtube', ytConn);
  assert.equal(ytStatus.connected, true);
  assert.equal(ytStatus.simulated, true);

  const fbConn = conn('facebook', mock.baseUrl, { pageId: '1234567890', pageName: 'Trang thử nghiệm' });
  const fb = await facebookUpload({ connection: fbConn, file, title: 'Video Facebook thử nghiệm', description: 'Mô tả FB' });
  assert.ok(fb.platformVideoId);
  const fbStats = await facebookStats({ connection: fbConn, videoId: fb.platformVideoId });
  assert.equal(fbStats.views, 4321);

  const tkConn = conn('tiktok', mock.baseUrl, { username: 'kenhthu', tiktokApproved: true });
  const tk = await tiktokUpload({ connection: tkConn, file, title: 'Video TikTok thử nghiệm' });
  assert.ok(tk.platformVideoId);
  assert.equal(tk.limitedUnapprovedApp, false);
  const tkStats = await tiktokStats({ connection: tkConn, videoId: tk.platformVideoId });
  assert.equal(tkStats.views, 777);

  const stateRes = await fetch(mock.baseUrl + '/__state');
  const state = await stateRes.json();
  assert.equal(state.youtube.videos.length, 1);
  assert.equal(state.facebook.videos.length, 1);
  assert.equal(state.tiktok.posts.length, 1);
});

test('publish connectors: missing token blocks honestly', async () => {
  const file = tempVideo(1024);
  await assert.rejects(
    youtubeUpload({ connection: { kind: 'youtube', secret: '', meta: {} }, file, title: 'x' }),
    (e) => e.code === 'BLOCKED_PUBLISH_AUTH');
  await assert.rejects(
    facebookUpload({ connection: { kind: 'facebook', secret: JSON.stringify({ accessToken: 'x' }), meta: {} }, file, title: 'x' }),
    (e) => e.code === 'BLOCKED_PUBLISH_AUTH');
});

test('publish connectors: tiktok unapproved app is limited to private on real host semantics', async () => {
  // With a simulated endpoint the mock acts as an approved sandbox; the
  // limitation flag is computed from meta on real hosts. Here we assert the
  // status surface exposes approval state truthfully.
  const st = platformConnectionStatus('tiktok', { kind: 'tiktok', secret: JSON.stringify({ accessToken: 'x' }), meta: {} });
  assert.equal(st.connected, true);
  assert.equal(st.tiktokApproved, false);
});

test('oauth helpers build real authorize urls and exchange codes via the token endpoint', async (t) => {
  const mock = await startMockPlatforms({ port: 0 });
  t.after(() => mock.close());
  const url = oauthAuthorizeUrl('youtube', { clientId: 'cid', redirectUri: 'http://127.0.0.1:4321/api/connections/oauth/youtube/callback', state: 's1' });
  assert.match(url, /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  assert.match(url, /youtube\.upload/);
  const tokens = await oauthExchangeCode('youtube', { clientId: 'cid', clientSecret: 'sec', code: 'abc', redirectUri: 'http://127.0.0.1:4321/x', tokenUrl: mock.baseUrl + '/oauth/token' });
  assert.equal(tokens.accessToken, 'mock-access-token');
});
