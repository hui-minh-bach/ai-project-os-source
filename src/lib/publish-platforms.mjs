/**
 * Social platform publishing (YouTube / Facebook Page / TikTok).
 *
 * Real API clients for the official upload protocols. They NEVER pretend a
 * post exists: a publish only returns a platform id/URL after the platform
 * API confirms it. Connections live in the Vault (kinds youtube/facebook/
 * tiktok); the connection `secret` holds a JSON token bundle
 * {accessToken, refreshToken?, expiresAt?} and `meta` holds account facts
 * (channelId/pageId/username, tiktokApproved). A connection `baseUrl`
 * overrides the API origin (used for local verification against a faithful
 * mock and for regional endpoints); records always state the endpoint host
 * and whether it was the platform's real host.
 */
import fs from 'node:fs';

export const PLATFORM_KINDS = ['youtube', 'facebook', 'tiktok'];
// Default matches Meta's official Python Business SDK apiconfig.py (checked 2026-10-24).
export const FACEBOOK_GRAPH_VERSION=process.env.AIOS_FACEBOOK_GRAPH_VERSION||'v26.0';
if(!/^v[0-9]{1,3}\.[0-9]{1,2}$/.test(FACEBOOK_GRAPH_VERSION))throw new Error('AIOS_FACEBOOK_GRAPH_VERSION không hợp lệ.');
export const REAL_HOSTS = { youtube: 'www.googleapis.com', facebook: 'graph.facebook.com', tiktok: 'open.tiktokapis.com' };
const DEFAULT_BASE = { youtube: 'https://www.googleapis.com', facebook: 'https://graph.facebook.com', tiktok: 'https://open.tiktokapis.com' };

function err(code, message) { const e = new Error(message); e.code = code; return e; }

export function platformBase(kind, connection) {
  const raw = String(connection?.baseUrl || DEFAULT_BASE[kind] || '').replace(/\/$/, '');
  return raw;
}
export function isSimulatedEndpoint(kind, connection) {
  try { return new URL(platformBase(kind, connection)).hostname !== REAL_HOSTS[kind]; } catch { return true; }
}
export function tokenBundle(connection) {
  try { const t = JSON.parse(String(connection?.secret || '')); if (t && typeof t.accessToken === 'string' && t.accessToken) return t; } catch { /* not json */ }
  if (connection?.secret) return { accessToken: String(connection.secret) };
  return null;
}
function requireToken(kind, connection) {
  const t = tokenBundle(connection);
  if (!t) throw err('BLOCKED_PUBLISH_AUTH', `Kết nối ${kind} chưa có token truy cập. Hãy liên kết tài khoản trong tab Kết nối.`);
  return t;
}
async function readBody(res) { const text = await res.text().catch(() => ''); try { return { json: JSON.parse(text), text }; } catch { return { json: null, text }; } }
function httpErr(kind, status, body) {
  const detail = body?.json?.error?.message || body?.json?.error?.code || body?.text?.slice(0, 200) || '';
  return err('PUBLISH_HTTP_' + status, `Nền tảng ${kind} trả lỗi HTTP ${status}${detail ? ': ' + detail : ''}`);
}

/* ---------------- OAuth ---------------- */

const OAUTH = {
  youtube: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
    extra: { access_type: 'offline', prompt: 'consent' },
  },
  facebook: {
    authorize: `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth`,
    token: `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`,
    scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'],
    extra: {},
  },
  tiktok: {
    authorize: 'https://www.tiktok.com/v2/auth/authorize/',
    token: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.upload', 'video.publish'],
    extra: {},
  },
};

export function oauthAuthorizeUrl(kind, { clientId, redirectUri, state }) {
  const cfg = OAUTH[kind]; if (!cfg) throw err('PUBLISH_KIND', 'Nền tảng không hợp lệ.');
  const u = new URL(cfg.authorize);
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', cfg.scopes.join(kind === 'tiktok' ? ',' : ' '));
  u.searchParams.set('state', state);
  for (const [k, v] of Object.entries(cfg.extra)) u.searchParams.set(k, v);
  return u.toString();
}

export async function oauthExchangeCode(kind, { clientId, clientSecret, code, redirectUri, tokenUrl, fetchImpl = fetch }) {
  const cfg = OAUTH[kind]; if (!cfg) throw err('PUBLISH_KIND', 'Nền tảng không hợp lệ.');
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri });
  const res = await fetchImpl(tokenUrl || cfg.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const parsed = await readBody(res);
  if (!res.ok || !parsed.json?.access_token) throw httpErr(kind, res.status, parsed);
  return { accessToken: parsed.json.access_token, refreshToken: parsed.json.refresh_token || null, expiresAt: parsed.json.expires_in ? new Date(Date.now() + parsed.json.expires_in * 1000).toISOString() : null, scope: parsed.json.scope || null };
}

/* ------------- OAuth identity + refresh ------------- */

export async function oauthRefreshToken(kind, { clientId, clientSecret, refreshToken, tokenUrl, fetchImpl = fetch }) {
  const cfg = OAUTH[kind]; if (!cfg) throw err('PUBLISH_KIND', 'Nền tảng không hợp lệ.');
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken });
  const res = await fetchImpl(tokenUrl || cfg.token, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const parsed = await readBody(res);
  if (!res.ok || !parsed.json?.access_token) throw httpErr(kind, res.status, parsed);
  return { accessToken: parsed.json.access_token, refreshToken: parsed.json.refresh_token || refreshToken, expiresAt: parsed.json.expires_in ? new Date(Date.now() + parsed.json.expires_in * 1000).toISOString() : null, scope: parsed.json.scope || null };
}

/** Who is behind this token? Used right after the OAuth callback so the
 * connection shows the REAL account (channel title, Pages, username)
 * instead of a generic label. Facebook also returns per-Page tokens,
 * which posting to a Page requires. */
export async function fetchPlatformIdentity(kind, { connection, token, fetchImpl = fetch } = {}) {
  const cfg = OAUTH[kind]; if (!cfg) throw err('PUBLISH_KIND', 'Nền tảng không hợp lệ.');
  const bundle = token || tokenBundle(connection);
  if (!bundle?.accessToken) throw err('BLOCKED_PUBLISH_AUTH', `Kết nối ${kind} chưa có token truy cập.`);
  const base = connection ? platformBase(kind, connection) : DEFAULT_BASE[kind];
  const auth = { authorization: `Bearer ${bundle.accessToken}` };
  if (kind === 'youtube') {
    const res = await fetchImpl(`${base}/youtube/v3/channels?part=snippet&mine=true`, { headers: auth });
    const body = await readBody(res);
    if (!res.ok) throw httpErr(kind, res.status, body);
    const item = body.json?.items?.[0];
    if (!item) return { accountLabel: 'Kênh YouTube', channelId: null, channelTitle: null };
    return { accountLabel: String(item.snippet?.title || 'Kênh YouTube'), channelId: item.id ? String(item.id) : null, channelTitle: String(item.snippet?.title || '') };
  }
  if (kind === 'facebook') {
    const res = await fetchImpl(`${base}/${FACEBOOK_GRAPH_VERSION}/me/accounts?fields=id,name,access_token&limit=100`, { headers: auth });
    const body = await readBody(res);
    if (!res.ok) throw httpErr(kind, res.status, body);
    const pages = []; const pageTokens = {};
    for (const pg of body.json?.data || []) {
      if (!pg?.id) continue;
      pages.push({ id: String(pg.id), name: String(pg.name || pg.id) });
      if (pg.access_token) pageTokens[String(pg.id)] = String(pg.access_token);
    }
    return { accountLabel: pages.length ? `Facebook · ${pages.length} Page` : 'Tài khoản Facebook (chưa có Page)', pages, pageTokens };
  }
  const res = await fetchImpl(`${base}/v2/user/info/`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ fields: ['open_id', 'username', 'display_name'] }) });
  const body = await readBody(res);
  const code = body.json?.error?.code;
  if (!res.ok || (code && code !== 'ok')) throw httpErr(kind, res.status, body);
  const user = body.json?.data?.user || {};
  return { accountLabel: String(user.display_name || user.username || 'Tài khoản TikTok'), username: String(user.username || '') };
}

/* ---------------- YouTube ---------------- */

export async function youtubeUpload({ connection, file, title, description = '', tags = [], privacyStatus = 'unlisted', fetchImpl = fetch }) {
  const kind = 'youtube';
  const token = requireToken(kind, connection);
  const base = platformBase(kind, connection);
  const size = fs.statSync(file).size;
  const metadata = {
    snippet: { title: String(title).slice(0, 100), description: String(description).slice(0, 5000), tags: Array.isArray(tags) ? tags.slice(0, 30).map(t => String(t).slice(0, 100)) : [], categoryId: '22' },
    status: { privacyStatus: ['public', 'unlisted', 'private'].includes(privacyStatus) ? privacyStatus : 'unlisted', selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
  };
  const init = await fetchImpl(`${base}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token.accessToken}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-length': String(size), 'x-upload-content-type': 'video/mp4' },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) throw httpErr(kind, init.status, await readBody(init));
  const sessionUrl = init.headers.get('location');
  if (!sessionUrl) throw err('PUBLISH_PROTOCOL', 'YouTube không trả về địa chỉ phiên tải lên.');
  const data = fs.readFileSync(file);
  let sent = 0;
  let finalJson = null;
  while (sent < size) {
    const end = Math.min(size, sent + 8 * 1024 * 1024);
    const res = await fetchImpl(sessionUrl, { method: 'PUT', headers: { 'content-length': String(end - sent), 'content-range': `bytes ${sent}-${end - 1}/${size}` }, body: data.subarray(sent, end) });
    if (res.status === 200 || res.status === 201) { finalJson = (await readBody(res)).json; sent = end; break; }
    if (res.status === 308) {
      const range = res.headers.get('range') || '';
      const m = range.match(/bytes=0-(\d+)/);
      sent = m ? Number(m[1]) + 1 : end;
      continue;
    }
    throw httpErr(kind, res.status, await readBody(res));
  }
  if (!finalJson?.id) throw err('PUBLISH_PROTOCOL', 'YouTube không xác nhận video sau khi tải lên.');
  return { platform: kind, platformVideoId: String(finalJson.id), url: `https://www.youtube.com/watch?v=${finalJson.id}`, privacyStatus: finalJson.status?.privacyStatus || metadata.status.privacyStatus, title: metadata.snippet.title };
}

export async function youtubeStats({ connection, videoId, fetchImpl = fetch }) {
  const kind = 'youtube';
  const token = requireToken(kind, connection);
  const base = platformBase(kind, connection);
  const res = await fetchImpl(`${base}/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}`, { headers: { authorization: `Bearer ${token.accessToken}` } });
  const parsed = await readBody(res);
  if (!res.ok) throw httpErr(kind, res.status, parsed);
  const s = parsed.json?.items?.[0]?.statistics;
  if (!s) throw err('PUBLISH_NOT_FOUND', 'Không tìm thấy video trên YouTube.');
  return { views: Number(s.viewCount || 0), likes: Number(s.likeCount || 0), comments: Number(s.commentCount || 0) };
}

/* ---------------- Facebook Page ---------------- */

export async function facebookUpload({ connection, file, title, description = '', fetchImpl = fetch }) {
  const kind = 'facebook';
  const bundle = requireToken(kind, connection);
  // Posting to a Page needs the PAGE access token (returned by /me/accounts
  // at link time and kept in the token bundle), not the user token.
  const pageToken = bundle.pageTokens?.[String(connection?.meta?.pageId || '')];
  const token = pageToken ? { ...bundle, accessToken: pageToken } : bundle;
  const pageId = String(connection?.meta?.pageId || '');
  if (!pageId) throw err('BLOCKED_PUBLISH_AUTH', 'Kết nối Facebook chưa có Page ID. Hãy chọn Page khi liên kết tài khoản.');
  const base = platformBase(kind, connection);
  const size = fs.statSync(file).size;
  const data = fs.readFileSync(file);
  const form = (fields, chunk, chunkName) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, String(v)); if (chunk) f.set(chunkName || 'video_file_chunk', new Blob([chunk]), 'chunk.mp4'); return f; };
  const startRes = await fetchImpl(`${base}/${FACEBOOK_GRAPH_VERSION}/${pageId}/videos`, { method: 'POST', headers: { authorization: `Bearer ${token.accessToken}` }, body: form({ upload_phase: 'start', file_size: size }) });
  const startBody = await readBody(startRes);
  if (!startRes.ok || !startBody.json?.upload_session_id) throw httpErr(kind, startRes.status, startBody);
  const session = startBody.json;
  let offset = Number(session.start_offset || 0);
  const endOffset = Number(session.end_offset || size);
  let guard = 0;
  while (offset < size && guard++ < 1000) {
    const end = Math.min(size, endOffset > offset ? endOffset : size);
    const res = await fetchImpl(`${base}/${FACEBOOK_GRAPH_VERSION}/${pageId}/videos`, { method: 'POST', headers: { authorization: `Bearer ${token.accessToken}` }, body: form({ upload_phase: 'transfer', upload_session_id: session.upload_session_id, start_offset: offset }, data.subarray(offset, end)) });
    const body = await readBody(res);
    if (!res.ok) throw httpErr(kind, res.status, body);
    const next = Number(body.json?.start_offset);
    offset = Number.isFinite(next) && next > offset ? next : end;
  }
  const finRes = await fetchImpl(`${base}/${FACEBOOK_GRAPH_VERSION}/${pageId}/videos`, { method: 'POST', headers: { authorization: `Bearer ${token.accessToken}` }, body: form({ upload_phase: 'finish', upload_session_id: session.upload_session_id, title: String(title).slice(0, 255), description: String(description).slice(0, 2000) }) });
  const finBody = await readBody(finRes);
  if (!finRes.ok || finBody.json?.success !== true) throw httpErr(kind, finRes.status, finBody);
  const videoId = String(session.video_id || finBody.json?.video_id || '');
  if (!videoId) throw err('PUBLISH_PROTOCOL', 'Facebook không xác nhận video sau khi tải lên.');
  return { platform: kind, platformVideoId: videoId, url: `https://www.facebook.com/watch/?v=${videoId}`, privacyStatus: 'page-public', title: String(title).slice(0, 255) };
}

export async function facebookStats({ connection, videoId, fetchImpl = fetch }) {
  const kind = 'facebook';
  const token = requireToken(kind, connection);
  const base = platformBase(kind, connection);
  const res = await fetchImpl(`${base}/${FACEBOOK_GRAPH_VERSION}/${encodeURIComponent(videoId)}?fields=views,likes.summary(true),comments.summary(true)`, { headers: { authorization: `Bearer ${token.accessToken}` } });
  const parsed = await readBody(res);
  if (!res.ok) throw httpErr(kind, res.status, parsed);
  return { views: Number(parsed.json?.views || 0), likes: Number(parsed.json?.likes?.summary?.total_count || 0), comments: Number(parsed.json?.comments?.summary?.total_count || 0) };
}

/* ---------------- TikTok ---------------- */

export async function tiktokUpload({ connection, file, title, privacyLevel = 'PUBLIC_TO_EVERYONE', fetchImpl = fetch }) {
  const kind = 'tiktok';
  const token = requireToken(kind, connection);
  const base = platformBase(kind, connection);
  const simulated = isSimulatedEndpoint(kind, connection);
  const approved = connection?.meta?.tiktokApproved === true || simulated;
  // TikTok rule: clients the platform has not approved may only post
  // privately. Enforce it here instead of letting the upload fail opaquely.
  const effectivePrivacy = approved ? privacyLevel : 'SELF_ONLY';
  const size = fs.statSync(file).size;
  const chunkSize = size <= 64 * 1024 * 1024 ? size : 10 * 1024 * 1024;
  const totalChunks = Math.max(1, Math.ceil(size / chunkSize));
  const initRes = await fetchImpl(`${base}/v2/post/publish/video/init/`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token.accessToken}`, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ post_info: { title: String(title).slice(0, 2200), privacy_level: effectivePrivacy, disable_comment: false, disable_duet: false, disable_stitch: false }, source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: totalChunks } }),
  });
  const initBody = await readBody(initRes);
  if (!initRes.ok || initBody.json?.error?.code !== 'ok' || !initBody.json?.data?.publish_id) throw httpErr(kind, initRes.status, initBody);
  const { publish_id: publishId, upload_url: uploadUrl } = initBody.json.data;
  const data = fs.readFileSync(file);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize, end = Math.min(size, start + chunkSize);
    const res = await fetchImpl(uploadUrl, { method: 'PUT', headers: { 'content-type': 'video/mp4', 'content-range': `bytes ${start}-${end - 1}/${size}` }, body: data.subarray(start, end) });
    if (![200, 201, 206].includes(res.status)) throw httpErr(kind, res.status, await readBody(res));
  }
  let postId = null, status = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetchImpl(`${base}/v2/post/publish/status/fetch/`, { method: 'POST', headers: { authorization: `Bearer ${token.accessToken}`, 'content-type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ publish_id: publishId }) });
    const body = await readBody(res);
    if (!res.ok || body.json?.error?.code !== 'ok') throw httpErr(kind, res.status, body);
    status = body.json.data?.status || '';
    const ids = body.json.data?.publicaly_available_post_id;
    if (Array.isArray(ids) && ids.length) { postId = String(ids[0]); break; }
    if (status === 'PUBLISH_COMPLETE') break;
    if (status === 'FAILED') throw err('PUBLISH_FAILED', 'TikTok báo đăng bài thất bại: ' + (body.json.data?.fail_reason || 'không rõ lý do'));
    await new Promise(r => setTimeout(r, 1000));
  }
  const username = String(connection?.meta?.username || '');
  return { platform: kind, platformVideoId: postId || publishId, publishId, url: postId && username ? `https://www.tiktok.com/@${username}/video/${postId}` : (postId ? `https://www.tiktok.com/video/${postId}` : null), privacyStatus: effectivePrivacy, limitedUnapprovedApp: !approved, title: String(title).slice(0, 2200) };
}

export async function tiktokStats({ connection, videoId, fetchImpl = fetch }) {
  const kind = 'tiktok';
  const token = requireToken(kind, connection);
  const base = platformBase(kind, connection);
  const res = await fetchImpl(`${base}/v2/video/list/`, { method: 'POST', headers: { authorization: `Bearer ${token.accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ fields: ['id', 'view_count', 'like_count', 'comment_count'], max_count: 100 }) });
  const parsed = await readBody(res);
  if (!res.ok || parsed.json?.error?.code !== 'ok') throw httpErr(kind, res.status, parsed);
  const v = (parsed.json?.data?.videos || []).find(x => String(x.id) === String(videoId)) || (parsed.json?.data?.videos || [])[0];
  if (!v) throw err('PUBLISH_NOT_FOUND', 'Không tìm thấy video trên TikTok.');
  return { views: Number(v.view_count || 0), likes: Number(v.like_count || 0), comments: Number(v.comment_count || 0) };
}

/* ---------------- Status ---------------- */

export function platformConnectionStatus(kind, connection) {
  if (!connection) return { platform: kind, connected: false, reason: 'not-linked' };
  const token = tokenBundle(connection);
  return {
    platform: kind,
    connected: Boolean(token),
    accountLabel: String(connection.meta?.accountLabel || connection.meta?.channelTitle || connection.meta?.pageName || connection.meta?.username || ''),
    expiresAt: token?.expiresAt || null,
    endpointHost: (() => { try { return new URL(platformBase(kind, connection)).hostname; } catch { return ''; } })(),
    simulated: isSimulatedEndpoint(kind, connection),
    tiktokApproved: kind === 'tiktok' ? connection.meta?.tiktokApproved === true : undefined,
  };
}
