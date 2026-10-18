/**
 * End-to-end contract tests for the local mock platform APIs
 * (test/fixtures/mock-platforms.mjs). Each platform is driven exactly the
 * way a real API client would: token → phased/resumable upload → status →
 * statistics, with /__state as the assertion surface.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { startMockPlatforms } from './fixtures/mock-platforms.mjs';

const AUTH = { authorization: 'Bearer mock-access-token' };
let mock;

test.before(async () => { mock = await startMockPlatforms({ port: 0 }); });
test.after(async () => { await mock.close(); });

const api = (path, init = {}) => fetch(mock.baseUrl + path, init);
const getState = async () => (await api('/__state')).json();

test('oauth stub issues a bearer token for any grant', async () => {
  const r = await api('/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&refresh_token=whatever',
  });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.access_token, 'mock-access-token');
  assert.equal(j.refresh_token, 'mock-refresh-token');
  assert.equal(j.expires_in, 3600);
  assert.equal(j.token_type, 'Bearer');
});

test('api routes reject missing bearer tokens in each platform error shape', async () => {
  const yt = await api('/youtube/v3/videos?id=yt-1');
  assert.equal(yt.status, 401);
  assert.equal((await yt.json()).error.code, 401);

  const fb = await api('/v19.0/fb-1?fields=views');
  assert.equal(fb.status, 401);
  const fbBody = await fb.json();
  assert.equal(fbBody.error.type, 'OAuthException');
  assert.equal(fbBody.error.code, 190);

  const tt = await api('/v2/post/publish/status/fetch/', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(tt.status, 401);
  assert.notEqual((await tt.json()).error.code, 'ok');
});

test('youtube: resumable init → single-shot PUT → statistics', async () => {
  const videoBytes = Buffer.from('fake-mp4-bytes-for-youtube');
  const init = await api('/upload/youtube/v3/videos?uploadType=resumable', {
    method: 'POST',
    headers: {
      ...AUTH,
      'content-type': 'application/json',
      'x-upload-content-length': String(videoBytes.length),
      'x-upload-content-type': 'video/mp4',
    },
    body: JSON.stringify({
      snippet: { title: 'Mock YouTube Video', description: 'made by the mock test' },
      status: { privacyStatus: 'unlisted' },
    }),
  });
  assert.equal(init.status, 200);
  const location = init.headers.get('location');
  assert.ok(location && location.includes('/upload/session/'), 'Location header carries the session URL');
  assert.ok(init.headers.get('x-guuploader-uploadid'), 'upload id header present');

  const put = await fetch(location, { method: 'PUT', headers: { 'content-type': 'video/mp4' }, body: videoBytes });
  assert.equal(put.status, 200);
  const video = await put.json();
  assert.match(video.id, /^yt-\d+$/);
  assert.equal(video.kind, 'youtube#video');
  assert.equal(video.snippet.title, 'Mock YouTube Video');
  assert.equal(video.status.privacyStatus, 'unlisted');

  const stats = await api(`/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${video.id}`, { headers: AUTH });
  assert.equal(stats.status, 200);
  const item = (await stats.json()).items[0];
  assert.equal(item.id, video.id);
  assert.equal(item.snippet.title, 'Mock YouTube Video');
  assert.match(item.statistics.viewCount, /^\d+$/);
  assert.match(item.statistics.likeCount, /^\d+$/);
  assert.match(item.statistics.commentCount, /^\d+$/);

  // Statistics are deterministic per id.
  const again = await api(`/youtube/v3/videos?part=statistics&id=${video.id}`, { headers: AUTH });
  assert.deepEqual((await again.json()).items[0].statistics, item.statistics);

  const st = await getState();
  assert.equal(st.youtube.videos.length, 1);
  assert.equal(st.youtube.videos[0].id, video.id);
  assert.equal(st.youtube.videos[0].title, 'Mock YouTube Video');
  assert.equal(st.youtube.videos[0].bytes, videoBytes.length);
});

test('youtube: chunked resumable upload resumes with 308 then completes', async () => {
  const part1 = Buffer.from('01234');
  const part2 = Buffer.from('56789');
  const total = part1.length + part2.length;
  const init = await api('/upload/youtube/v3/videos?uploadType=resumable', {
    method: 'POST',
    headers: { ...AUTH, 'content-type': 'application/json', 'x-upload-content-length': String(total) },
    body: JSON.stringify({ snippet: { title: 'Chunked' }, status: { privacyStatus: 'private' } }),
  });
  const location = init.headers.get('location');

  const r1 = await fetch(location, {
    method: 'PUT',
    headers: { 'content-range': `bytes 0-${part1.length - 1}/${total}` },
    body: part1,
  });
  assert.equal(r1.status, 308);
  assert.equal(r1.headers.get('range'), `bytes=0-${part1.length - 1}`);

  const r2 = await fetch(location, {
    method: 'PUT',
    headers: { 'content-range': `bytes ${part1.length}-${total - 1}/${total}` },
    body: part2,
  });
  assert.equal(r2.status, 200);
  const video = await r2.json();
  assert.match(video.id, /^yt-\d+$/);
  assert.equal(video.snippet.title, 'Chunked');

  const st = await getState();
  const record = st.youtube.videos.find((v) => v.id === video.id);
  assert.equal(record.bytes, total);
});

test('facebook: phased start → transfer → finish → stats', async () => {
  const pageId = '1234567890';
  const chunk = Buffer.from('facebook-video-chunk-bytes');

  const startForm = new FormData();
  startForm.set('upload_phase', 'start');
  startForm.set('file_size', String(chunk.length));
  const start = await api(`/v19.0/${pageId}/videos`, { method: 'POST', headers: AUTH, body: startForm });
  assert.equal(start.status, 200);
  const startBody = await start.json();
  assert.match(startBody.video_id, /^fb-\d+$/);
  assert.ok(startBody.upload_session_id);
  assert.equal(startBody.start_offset, 0);
  assert.equal(startBody.end_offset, chunk.length);

  const transferForm = new FormData();
  transferForm.set('upload_phase', 'transfer');
  transferForm.set('upload_session_id', startBody.upload_session_id);
  transferForm.set('file_offset', '0');
  transferForm.set('video_file_chunk', new Blob([chunk]), 'chunk.bin');
  const transfer = await api(`/v19.0/${pageId}/videos`, { method: 'POST', headers: AUTH, body: transferForm });
  assert.equal(transfer.status, 200);
  const transferBody = await transfer.json();
  assert.equal(transferBody.start_offset, chunk.length);
  assert.equal(transferBody.end_offset, chunk.length);

  const finishForm = new FormData();
  finishForm.set('upload_phase', 'finish');
  finishForm.set('upload_session_id', startBody.upload_session_id);
  finishForm.set('title', 'Mock Facebook Video');
  finishForm.set('description', 'phased upload test');
  const finish = await api(`/v19.0/${pageId}/videos`, { method: 'POST', headers: AUTH, body: finishForm });
  assert.equal(finish.status, 200);
  assert.equal((await finish.json()).success, true);

  const stats = await api(`/v19.0/${startBody.video_id}?fields=views,likes.summary(true)`, { headers: AUTH });
  assert.equal(stats.status, 200);
  const statsBody = await stats.json();
  assert.equal(statsBody.views, 4321);
  assert.equal(statsBody.likes.summary.total_count, 88);

  const st = await getState();
  assert.equal(st.facebook.videos.length, 1);
  assert.equal(st.facebook.videos[0].id, startBody.video_id);
  assert.equal(st.facebook.videos[0].title, 'Mock Facebook Video');
  assert.equal(st.facebook.videos[0].pageId, pageId);
  assert.equal(st.facebook.videos[0].bytes, chunk.length);
});

test('facebook: simple single-POST upload returns an id', async () => {
  const form = new FormData();
  form.set('source', new Blob([Buffer.from('one-shot-fb-video')]), 'video.mp4');
  form.set('title', 'One Shot');
  const r = await api('/v19.0/1234567890/videos', { method: 'POST', headers: AUTH, body: form });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.match(body.id, /^fb-\d+$/);
  const st = await getState();
  assert.equal(st.facebook.videos.find((v) => v.id === body.id)?.title, 'One Shot');
});

test('tiktok: init → chunked PUT → status fetch → video list', async () => {
  const part1 = Buffer.from('tiktok-part-1-');
  const part2 = Buffer.from('tiktok-part-2');
  const total = part1.length + part2.length;

  const init = await api('/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { ...AUTH, 'content-type': 'application/json' },
    body: JSON.stringify({
      post_info: { title: 'Mock TikTok Video', privacy_level: 'PUBLIC_TO_EVERYONE' },
      source_info: { source: 'FILE_UPLOAD', video_size: total, chunk_size: part1.length, total_chunk_count: 2 },
    }),
  });
  assert.equal(init.status, 200);
  const initBody = await init.json();
  assert.equal(initBody.error.code, 'ok');
  assert.ok(initBody.data.publish_id);
  assert.ok(initBody.data.upload_url.includes('/tiktok/upload/'));

  const up1 = await fetch(initBody.data.upload_url, {
    method: 'PUT',
    headers: { 'content-range': `bytes 0-${part1.length - 1}/${total}`, 'content-type': 'video/mp4' },
    body: part1,
  });
  assert.equal(up1.status, 201);
  const up2 = await fetch(initBody.data.upload_url, {
    method: 'PUT',
    headers: { 'content-range': `bytes ${part1.length}-${total - 1}/${total}`, 'content-type': 'video/mp4' },
    body: part2,
  });
  assert.equal(up2.status, 201);

  const status = await api('/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: { ...AUTH, 'content-type': 'application/json' },
    body: JSON.stringify({ publish_id: initBody.data.publish_id }),
  });
  assert.equal(status.status, 200);
  const statusBody = await status.json();
  assert.equal(statusBody.error.code, 'ok');
  assert.equal(statusBody.data.status, 'PUBLISH_COMPLETE');
  assert.equal(statusBody.data.publicaly_available_post_id.length, 1);

  const list = await api('/v2/video/list/', {
    method: 'POST',
    headers: { ...AUTH, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: ['id', 'view_count', 'like_count', 'comment_count'] }),
  });
  assert.equal(list.status, 200);
  const listBody = await list.json();
  assert.equal(listBody.data.videos.length, 1);
  assert.equal(listBody.data.videos[0].view_count, 777);
  assert.equal(listBody.data.videos[0].like_count, 66);
  assert.equal(listBody.data.videos[0].comment_count, 5);

  const st = await getState();
  assert.equal(st.tiktok.posts.length, 1);
  assert.equal(st.tiktok.posts[0].publishId, initBody.data.publish_id);
  assert.equal(st.tiktok.posts[0].title, 'Mock TikTok Video');
  assert.equal(st.tiktok.posts[0].bytes, total);
});
