/**
 * Local mock of the YouTube / Facebook / TikTok platform APIs.
 *
 * Purpose: let the product's publish connectors be verified end-to-end
 * WITHOUT real platform accounts. This is a faithful-but-tiny stand-in for
 * the three public APIs (same routes, same phased upload protocols, same
 * response envelopes and per-platform error shapes), backed by in-memory
 * storage only. Zero dependencies: node:http only.
 *
 * Library use:
 *   import { startMockPlatforms } from './fixtures/mock-platforms.mjs';
 *   const mock = await startMockPlatforms({ port: 0 });
 *   // mock.baseUrl, mock.state (posted videos per platform), mock.close()
 *
 * Standalone:
 *   node test/fixtures/mock-platforms.mjs   → listens on port 7799
 *
 * Auth model (mirrors the real protocols):
 *   - API routes require any `Authorization: Bearer <token>` header; a
 *     missing/invalid header returns 401 in that platform's error shape.
 *   - /oauth/token and /__state never require auth.
 *   - Upload session URLs (YouTube `Location`, TikTok `upload_url`) are
 *     pre-signed capabilities in the real APIs, so they do not require an
 *     Authorization header either.
 */
import http from 'node:http';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
    ...extraHeaders,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseJsonBody(buf) {
  if (!buf || buf.length === 0) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch { return {}; }
}

/** Minimal multipart/form-data parser (fields + file parts), zero deps. */
function parseMultipart(buf, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType || '');
  if (!m) return { fields: {}, files: {} };
  const boundary = Buffer.from('--' + (m[1] || m[2]));
  const fields = {}; const files = {};
  let pos = 0;
  while (true) {
    const start = buf.indexOf(boundary, pos);
    if (start === -1) break;
    let p = start + boundary.length;
    if (buf[p] === 0x2d && buf[p + 1] === 0x2d) break; // closing "--"
    if (buf[p] === 0x0d && buf[p + 1] === 0x0a) p += 2;
    const headerEnd = buf.indexOf('\r\n\r\n', p);
    if (headerEnd === -1) break;
    const headerText = buf.toString('latin1', p, headerEnd);
    const dataStart = headerEnd + 4;
    const next = buf.indexOf(boundary, dataStart);
    if (next === -1) break;
    const dataEnd = next - 2; // strip trailing CRLF before the boundary
    const data = buf.subarray(dataStart, Math.max(dataStart, dataEnd));
    const disp = /content-disposition:\s*form-data;([^\r\n]*)/i.exec(headerText)?.[1] || '';
    const name = /name="([^"]+)"/.exec(disp)?.[1];
    const filename = /filename="([^"]*)"/.exec(disp)?.[1];
    if (name) {
      if (filename !== undefined) files[name] = { filename, data: Buffer.from(data) };
      else fields[name] = data.toString('utf8');
    }
    pos = next;
  }
  return { fields, files };
}

/** Accept JSON, urlencoded or multipart form bodies uniformly. */
function parseFormBody(buf, contentType = '') {
  if (!buf || buf.length === 0) return { fields: {}, files: {} };
  if (contentType.includes('multipart/form-data')) return parseMultipart(buf, contentType);
  if (contentType.includes('application/json')) {
    return { fields: parseJsonBody(buf), files: {} };
  }
  // application/x-www-form-urlencoded and friends
  const fields = {};
  for (const [k, v] of new URLSearchParams(buf.toString('utf8'))) fields[k] = v;
  return { fields, files: {} };
}

/** Parse "bytes 0-499/2048" / "bytes *\/2048" Content-Range headers. */
function parseContentRange(header) {
  if (!header) return null;
  const m = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/.exec(header.trim());
  if (m) return { start: Number(m[1]), end: Number(m[2]), total: m[3] === '*' ? null : Number(m[3]), query: false };
  const q = /^bytes\s+\*\/(\d+)$/.exec(header.trim());
  if (q) return { start: null, end: null, total: Number(q[1]), query: true };
  return null;
}

/** Deterministic pseudo-statistics derived from a YouTube video id. */
function youtubeStats(id) {
  let h = 7;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return {
    viewCount: String(1000 + (h % 9000)),
    likeCount: String(h % 300),
    commentCount: String(h % 60),
  };
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

function createState() {
  return {
    counters: { youtube: 0, facebook: 0, tiktok: 0 },
    // Public, assertion-friendly records of everything "posted".
    youtube: { videos: [] },   // {id, title, description, privacyStatus, bytes}
    facebook: { videos: [] },  // {id, pageId, title, description, bytes}
    tiktok: { posts: [] },     // {publishId, id, title, privacyLevel, bytes, status}
    // Internal upload sessions.
    sessions: { youtube: new Map(), facebook: new Map(), tiktok: new Map() },
  };
}

function stateDump(state) {
  return {
    youtube: { videos: state.youtube.videos },
    facebook: { videos: state.facebook.videos },
    tiktok: { posts: state.tiktok.posts },
  };
}

/* ------------------------------------------------------------------ */
/* Per-platform 401s                                                   */
/* ------------------------------------------------------------------ */

function unauthorized(res, platform) {
  if (platform === 'facebook') {
    return sendJson(res, 401, {
      error: {
        message: 'Invalid OAuth access token.',
        type: 'OAuthException',
        code: 190,
        fbtrace_id: 'mock-fbtrace-id',
      },
    });
  }
  if (platform === 'tiktok') {
    return sendJson(res, 401, {
      data: {},
      error: { code: 'unauthorized', message: 'Authentication is required.', logid: 'mock-logid' },
    });
  }
  return sendJson(res, 401, {
    error: {
      code: 401,
      message: 'Request is missing required authentication credential.',
      status: 'UNAUTHENTICATED',
      errors: [{ message: 'Login Required.', domain: 'global', reason: 'unauthorized' }],
    },
  });
}

function hasBearer(req) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') && h.slice(7).trim().length > 0;
}

/* ------------------------------------------------------------------ */
/* YouTube Data API v3 (resumable upload + statistics)                 */
/* ------------------------------------------------------------------ */

async function youtubeInitUpload(req, res, state, baseUrl) {
  if (!hasBearer(req)) return unauthorized(res, 'youtube');
  const body = await readBody(req);
  const metadata = parseJsonBody(body);
  const total = Number(req.headers['x-upload-content-length'] || 0) || null;
  const id = `ytsess-${++state.counters.youtube}-${Date.now().toString(36)}`;
  state.sessions.youtube.set(id, { metadata, total, received: 0 });
  return sendJson(res, 200, {}, {
    location: `${baseUrl}/upload/session/${id}`,
    'x-guuploader-uploadid': id,
  });
}

async function youtubeUploadSession(req, res, state, sessionId) {
  const session = state.sessions.youtube.get(sessionId);
  if (!session) {
    return sendJson(res, 404, { error: { code: 404, message: 'Upload session not found.', errors: [{ domain: 'global', reason: 'notFound', message: 'Upload session not found.' }] } });
  }
  const body = await readBody(req);
  const range = parseContentRange(req.headers['content-range']);
  const finalize = () => {
    const n = ++state.counters.youtube;
    const record = {
      id: `yt-${n}`,
      title: session.metadata?.snippet?.title || '',
      description: session.metadata?.snippet?.description || '',
      privacyStatus: session.metadata?.status?.privacyStatus || 'private',
      bytes: session.received,
    };
    state.youtube.videos.push(record);
    session.video = record;
    return record;
  };
  const resourceFor = (record) => ({
    id: record.id,
    kind: 'youtube#video',
    snippet: { title: record.title, description: record.description },
    status: { privacyStatus: record.privacyStatus },
  });

  // Status query: "Content-Range: bytes */total" with an empty body.
  if (range?.query || (body.length === 0 && req.method === 'POST')) {
    if (session.video) return sendJson(res, 200, resourceFor(session.video));
    if (session.total !== null && session.received >= session.total) {
      return sendJson(res, 200, resourceFor(finalize()));
    }
    const headers = session.received > 0 ? { range: `bytes=0-${session.received - 1}` } : {};
    res.writeHead(308, headers);
    return res.end();
  }

  session.received += body.length;
  if (session.video) return sendJson(res, 200, resourceFor(session.video));
  const complete = session.total === null || session.received >= session.total;
  if (!complete) {
    res.writeHead(308, { range: `bytes=0-${session.received - 1}` });
    return res.end();
  }
  return sendJson(res, 200, resourceFor(finalize()));
}

function youtubeListVideos(req, res, state, url) {
  if (!hasBearer(req)) return unauthorized(res, 'youtube');
  const ids = String(url.searchParams.get('id') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const items = state.youtube.videos
    .filter((v) => ids.length === 0 || ids.includes(v.id))
    .map((v) => ({
      id: v.id,
      kind: 'youtube#video',
      snippet: { title: v.title, description: v.description },
      statistics: youtubeStats(v.id),
    }));
  return sendJson(res, 200, { kind: 'youtube#videoListResponse', items });
}

/* ------------------------------------------------------------------ */
/* Facebook Graph API (phased resumable video upload)                  */
/* ------------------------------------------------------------------ */

async function facebookVideos(req, res, state, pageId) {
  if (!hasBearer(req)) return unauthorized(res, 'facebook');
  const body = await readBody(req);
  const contentType = String(req.headers['content-type'] || '');
  const isMultipart = contentType.includes('multipart/form-data');
  const { fields, files } = parseFormBody(body, contentType);
  const phase = fields.upload_phase;

  if (phase === 'start') {
    const n = ++state.counters.facebook;
    const sessionId = `fbsess-${n}`;
    const fileSize = Number(fields.file_size || 0) || 0;
    state.sessions.facebook.set(sessionId, {
      videoId: `fb-${n}`, pageId, fileSize, received: 0, title: '', description: '',
    });
    return sendJson(res, 200, {
      video_id: `fb-${n}`,
      upload_session_id: sessionId,
      start_offset: 0,
      end_offset: fileSize,
    });
  }

  if (phase === 'transfer') {
    const session = state.sessions.facebook.get(String(fields.upload_session_id || ''));
    if (!session) return sendJson(res, 400, { error: { message: 'Invalid upload_session_id.', type: 'OAuthException', code: 100, fbtrace_id: 'mock-fbtrace-id' } });
    const chunk = files.video_file_chunk?.data || files.file?.data || files.source?.data
      || Object.values(files)[0]?.data || (isMultipart ? Buffer.alloc(0) : body);
    session.received += chunk.length;
    return sendJson(res, 200, { start_offset: session.received, end_offset: session.fileSize });
  }

  if (phase === 'finish') {
    const session = state.sessions.facebook.get(String(fields.upload_session_id || ''));
    if (!session) return sendJson(res, 400, { error: { message: 'Invalid upload_session_id.', type: 'OAuthException', code: 100, fbtrace_id: 'mock-fbtrace-id' } });
    session.title = String(fields.title || '');
    session.description = String(fields.description || '');
    state.facebook.videos.push({
      id: session.videoId,
      pageId: session.pageId,
      title: session.title,
      description: session.description,
      bytes: session.received,
    });
    state.sessions.facebook.delete(String(fields.upload_session_id));
    return sendJson(res, 200, { success: true });
  }

  // Simple single-shot upload: file part (or raw body) and no upload_phase.
  const fileData = files.source?.data || files.file?.data || Object.values(files)[0]?.data
    || (!isMultipart && body.length > 0 && !fields.upload_phase ? body : null);
  if (fileData) {
    const n = ++state.counters.facebook;
    const record = {
      id: `fb-${n}`,
      pageId,
      title: String(fields.title || ''),
      description: String(fields.description || ''),
      bytes: fileData.length,
    };
    state.facebook.videos.push(record);
    return sendJson(res, 200, { id: record.id });
  }
  return sendJson(res, 400, { error: { message: 'Missing upload_phase or file source.', type: 'OAuthException', code: 100, fbtrace_id: 'mock-fbtrace-id' } });
}

function facebookGetVideo(req, res, state, videoId) {
  if (!hasBearer(req)) return unauthorized(res, 'facebook');
  const record = state.facebook.videos.find((v) => v.id === videoId);
  if (!record) return sendJson(res, 404, { error: { message: `Unsupported get request. Object with ID '${videoId}' does not exist.`, type: 'GraphMethodException', code: 100, fbtrace_id: 'mock-fbtrace-id' } });
  return sendJson(res, 200, {
    id: record.id,
    title: record.title,
    views: 4321,
    likes: { summary: { total_count: 88 } },
  });
}

/* ------------------------------------------------------------------ */
/* TikTok Content Posting API                                          */
/* ------------------------------------------------------------------ */

async function tiktokInit(req, res, state, baseUrl) {
  if (!hasBearer(req)) return unauthorized(res, 'tiktok');
  const payload = parseJsonBody(await readBody(req));
  const n = ++state.counters.tiktok;
  const publishId = `ttpub-${n}`;
  const uploadId = `ttup-${n}`;
  const post = {
    publishId,
    id: String(987654320 + n),
    title: String(payload?.post_info?.title || ''),
    privacyLevel: String(payload?.post_info?.privacy_level || ''),
    bytes: 0,
    status: 'PROCESSING_UPLOAD',
  };
  state.tiktok.posts.push(post);
  state.sessions.tiktok.set(uploadId, {
    post,
    total: Number(payload?.source_info?.video_size || 0) || null,
    received: 0,
  });
  return sendJson(res, 200, {
    data: { publish_id: publishId, upload_url: `${baseUrl}/tiktok/upload/${uploadId}` },
    error: { code: 'ok', message: '', logid: 'mock-logid' },
  });
}

async function tiktokUploadChunk(req, res, state, uploadId) {
  // The upload_url is a pre-signed capability: no Authorization required.
  const session = state.sessions.tiktok.get(uploadId);
  if (!session) return sendJson(res, 404, { data: {}, error: { code: 'invalid_upload_id', message: 'Upload session not found.', logid: 'mock-logid' } });
  const body = await readBody(req);
  session.received += body.length;
  session.post.bytes = session.received;
  if (session.total === null || session.received >= session.total) session.post.status = 'PUBLISH_COMPLETE';
  res.writeHead(201);
  return res.end();
}

async function tiktokStatusFetch(req, res, state) {
  if (!hasBearer(req)) return unauthorized(res, 'tiktok');
  const payload = parseJsonBody(await readBody(req));
  const post = state.tiktok.posts.find((p) => p.publishId === String(payload?.publish_id || ''));
  if (!post) return sendJson(res, 400, { data: {}, error: { code: 'invalid_publish_id', message: 'Publish id not found.', logid: 'mock-logid' } });
  const data = { status: post.status };
  if (post.status === 'PUBLISH_COMPLETE') data.publicaly_available_post_id = [Number(post.id)];
  return sendJson(res, 200, { data, error: { code: 'ok', message: '', logid: 'mock-logid' } });
}

async function tiktokVideoList(req, res, state) {
  if (!hasBearer(req)) return unauthorized(res, 'tiktok');
  await readBody(req); // consume any JSON body
  const videos = state.tiktok.posts
    .filter((p) => p.status === 'PUBLISH_COMPLETE')
    .map((p) => ({ id: p.id, title: p.title, view_count: 777, like_count: 66, comment_count: 5 }));
  return sendJson(res, 200, { data: { videos, cursor: 0, has_more: false }, error: { code: 'ok', message: '', logid: 'mock-logid' } });
}

/* ------------------------------------------------------------------ */
/* Router + server                                                     */
/* ------------------------------------------------------------------ */

async function handleRequest(req, res, state) {
  const baseUrl = `http://${req.headers.host || '127.0.0.1'}`;
  const url = new URL(req.url || '/', baseUrl);
  const path = url.pathname;
  const method = req.method || 'GET';
  try {
    // OAuth token stub (any grant).
    if (method === 'POST' && path === '/oauth/token') {
      await readBody(req);
      return sendJson(res, 200, {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }
    // Introspection for assertions.
    if (method === 'GET' && path === '/__state') return sendJson(res, 200, stateDump(state));

    // Identity endpoints (used by the OAuth callback right after linking).
    if (method === 'GET' && path === '/youtube/v3/channels') {
      return sendJson(res, 200, { items: [{ id: 'mock-channel-1', snippet: { title: 'Kênh Mock' } }] });
    }
    if (method === 'GET' && path === '/v19.0/me/accounts') {
      return sendJson(res, 200, { data: [
        { id: 'page-1', name: 'Page Một', access_token: 'mock-page-token-1' },
        { id: 'page-2', name: 'Page Hai', access_token: 'mock-page-token-2' },
      ] });
    }
    if (method === 'POST' && path === '/v2/user/info/') {
      await readBody(req);
      return sendJson(res, 200, { data: { user: { open_id: 'tt-open-1', username: 'mock.creator', display_name: 'Mock Creator' } }, error: { code: 'ok', message: '' } });
    }

    // YouTube.
    if (method === 'POST' && path === '/upload/youtube/v3/videos') return youtubeInitUpload(req, res, state, baseUrl);
    const ytSession = /^\/upload\/session\/([^/]+)$/.exec(path);
    if (ytSession && (method === 'PUT' || method === 'POST')) return youtubeUploadSession(req, res, state, ytSession[1]);
    if (method === 'GET' && path === '/youtube/v3/videos') return youtubeListVideos(req, res, state, url);

    // Facebook.
    const fbUpload = /^\/v19\.0\/([^/]+)\/(?:videos|video_reels)$/.exec(path);
    if (fbUpload && method === 'POST') return facebookVideos(req, res, state, fbUpload[1]);
    const fbGet = /^\/v19\.0\/([^/]+)$/.exec(path);
    if (fbGet && method === 'GET') return facebookGetVideo(req, res, state, fbGet[1]);

    // TikTok.
    if (method === 'POST' && path === '/v2/post/publish/video/init/') return tiktokInit(req, res, state, baseUrl);
    const ttUpload = /^\/tiktok\/upload\/([^/]+)$/.exec(path);
    if (ttUpload && method === 'PUT') return tiktokUploadChunk(req, res, state, ttUpload[1]);
    if (method === 'POST' && path === '/v2/post/publish/status/fetch/') return tiktokStatusFetch(req, res, state);
    if (method === 'POST' && path === '/v2/video/list/') return tiktokVideoList(req, res, state);

    return sendJson(res, 404, { error: { message: `Mock platform: no route for ${method} ${path}` } });
  } catch (e) {
    return sendJson(res, 500, { error: { message: 'Mock platform internal error: ' + String(e?.message || e) } });
  }
}

/**
 * Start the mock platform server.
 * @param {{port?: number}} [options] port 0 (default) = ephemeral port.
 * @returns {Promise<{baseUrl: string, close: () => Promise<void>, state: object}>}
 */
export async function startMockPlatforms({ port = 0 } = {}) {
  const state = createState();
  const server = http.createServer((req, res) => { void handleRequest(req, res, state); });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const actualPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${actualPort}`;
  const close = () => new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
  return { baseUrl, close, state };
}

// Standalone mode: `node test/fixtures/mock-platforms.mjs` → port 7799.
// NODE_TEST_CONTEXT is set when the file is merely loaded/executed by the
// node test runner's discovery (it lives under test/), which must not boot
// a real server.
if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { baseUrl } = await startMockPlatforms({ port: 7799 });
  console.log(`Mock platforms listening at ${baseUrl}`);
  console.log(`State dump: ${baseUrl}/__state`);
}
