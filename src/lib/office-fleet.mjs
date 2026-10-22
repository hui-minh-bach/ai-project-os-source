/**
 * Đội bot tài khoản của Văn phòng AI (từ bản 0.9.33).
 *
 * Mỗi kết nối AI (tài khoản đăng nhập CLI hoặc API key) là MỘT bot TAM01 trong
 * văn phòng. Trạng thái của bot suy ra 100% từ dữ kiện thật của app:
 * - working : có lượt chạy orchestrator đang chạy mà dự án của lượt đó phân
 *             vai Worker cho đúng kết nối này (model-bindings).
 * - failed  : lượt chạy THẤT BẠI gần nhất trong 24 giờ thuộc về kết nối này và
 *             chưa có lượt hoàn thành nào của kết nối này sau đó (bot vào
 *             chuồng chích điện; bàn của nó được nhường cho bot khác đang chờ).
 * - charging: đã kết nối (đăng nhập + có danh mục model) nhưng hiện không
 *             có việc — gồm cả bot đang NGHỈ SẠC vì chạm hạn mức (resting,
 *             kèm giờ mở lại lấy từ trạng thái nguội của bể tài khoản).
 * - offline : kết nối tồn tại nhưng chưa kết nối được (chưa đăng nhập xong /
 *             vault khóa / chưa có danh mục model) — bot đứng tối ở khu sạc.
 * Hàm thuần, không I/O — server truyền dữ kiện vào, test kiểm độc lập.
 */

export const FLEET_MAX_BOTS = 10;
/** Thứ tự bàn làm việc trong văn phòng (trạm 3D/2D có sẵn). */
export const FLEET_DESKS = Object.freeze(['news', 'script', 'image', 'media', 'review', 'publish', 'pm']);
export const FLEET_FAILED_WINDOW_MS = 24 * 60 * 60 * 1000;

const PROVIDER_LABEL = Object.freeze({
  chatgpt_account: 'ChatGPT', claude_account: 'Claude', gemini_account: 'Gemini',
  antigravity_account: 'Antigravity', openai: 'OpenAI', anthropic: 'Anthropic',
  gemini: 'Gemini API', openai_compatible: 'OpenAI-compatible',
});
const PROVIDER_COLOR = Object.freeze({
  chatgpt_account: '#10a37f', claude_account: '#d97757', gemini_account: '#4285f4',
  antigravity_account: '#a855f7', openai: '#10a37f', anthropic: '#d97757',
  gemini: '#4285f4', openai_compatible: '#57e6ff',
});

export function fleetProviderLabel(kind) { return PROVIDER_LABEL[kind] || 'AI'; }
export function fleetProviderColor(kind) { return PROVIDER_COLOR[kind] || '#57e6ff'; }

function runTime(run) {
  const t = Date.parse(run?.updatedAt || run?.createdAt || '');
  return Number.isFinite(t) ? t : 0;
}

/**
 * @param {Object} input
 * @param {Array<{id:string, kind:string, name?:string, connected:boolean, coolingUntil?:string|null}>} input.connections
 *        Các kết nối AI theo thứ tự tạo; `connected` = đã đăng nhập + có
 *        danh mục model; `coolingUntil` = mốc ISO tài khoản đang nghỉ hạn mức.
 * @param {Array<Object>} input.runs  Mọi lượt chạy gần đây (mảng thô của orchestrator).
 * @param {Object<string,string>} input.workerConnByProject  projectId -> connectionId (vai Worker).
 * @param {number} [input.nowMs]
 * @returns {{bots: Array<Object>, overflow: number}}
 */
export function deriveFleet({ connections = [], runs = [], workerConnByProject = {}, nowMs = Date.now() } = {}) {
  const all = Array.isArray(connections) ? connections.filter(c => c && c.id) : [];
  const bots = all.slice(0, FLEET_MAX_BOTS).map((c, i) => ({
    connectionId: String(c.id),
    kind: String(c.kind || ''),
    provider: fleetProviderLabel(c.kind),
    color: fleetProviderColor(c.kind),
    label: String(c.name || '').trim() || fleetProviderLabel(c.kind),
    connected: !!c.connected,
    // Đang nghỉ sạc: tài khoản chạm hạn mức, bể đã cho nghỉ tới mốc này.
    // Vẫn ở trạm sạc (state charging) — phân biệt bằng cờ resting để bảng
    // tên/roster ghi rõ "đang nghỉ sạc · mở lại HH:MM".
    resting: !!(c.connected && c.coolingUntil && Date.parse(c.coolingUntil) > nowMs),
    coolingUntil: c.coolingUntil || null,
    state: c.connected ? 'charging' : 'offline',
    station: 'bay',
    baySlot: -1,
    deskIndex: -1,
    runId: null,
    projectId: null,
    order: i,
  }));
  const byConn = new Map(bots.map(b => [b.connectionId, b]));
  const connOfRun = (run) => {
    const cid = workerConnByProject[run?.projectId || ''];
    return cid ? byConn.get(String(cid)) || null : null;
  };

  // Lượt đang chạy -> bot working (lượt bắt đầu sớm nhất giữ bàn trước).
  const active = runs.filter(r => r && r.state === 'running')
    .sort((a, b) => runTime(a) - runTime(b));
  for (const run of active) {
    const bot = connOfRun(run);
    if (bot && bot.state !== 'working') {
      bot.state = 'working';
      bot.runId = String(run.id || '') || null;
      bot.projectId = run.projectId ? String(run.projectId) : null;
    }
  }

  // Lượt lỗi gần nhất trong 24h theo từng kết nối + lượt hoàn thành mới nhất.
  const latestFailed = new Map(); const latestDone = new Map();
  for (const run of runs) {
    if (!run) continue;
    const bot = connOfRun(run); if (!bot) continue;
    const t = runTime(run);
    if (run.state === 'failed' && nowMs - t <= FLEET_FAILED_WINDOW_MS) {
      if (!latestFailed.has(bot.connectionId) || t > latestFailed.get(bot.connectionId).t) {
        latestFailed.set(bot.connectionId, { t, run });
      }
    }
    if (run.state === 'completed') {
      if (!latestDone.has(bot.connectionId) || t > latestDone.get(bot.connectionId)) {
        latestDone.set(bot.connectionId, t);
      }
    }
  }
  for (const [cid, f] of latestFailed) {
    const bot = byConn.get(cid);
    if (!bot || bot.state === 'working') continue;
    const done = latestDone.get(cid) || 0;
    if (f.t > done) {
      bot.state = 'failed';
      bot.runId = String(f.run.id || '') || null;
      bot.projectId = f.run.projectId ? String(f.run.projectId) : null;
    }
  }

  // Phân bàn: bot working theo thứ tự lượt chạy. Bot lỗi: chỉ bot lỗi MỚI NHẤT
  // vào chuồng chích điện (chuồng chứa một), các bot lỗi còn lại đứng ở khu
  // sạc với trạng thái failed để bot khác ra thay bàn của chúng.
  let desk = 0;
  for (const bot of bots) {
    if (bot.state === 'working') {
      bot.deskIndex = desk;
      bot.station = FLEET_DESKS[desk] || 'pm';
      desk++;
    }
  }
  let cageBot = null;
  for (const bot of bots) {
    if (bot.state !== 'failed') continue;
    bot.failedAt = latestFailed.get(bot.connectionId)?.run?.updatedAt || latestFailed.get(bot.connectionId)?.run?.createdAt || null;
    if (!cageBot || String(bot.failedAt || '') > String(cageBot.failedAt || '')) cageBot = bot;
  }
  if (cageBot) { cageBot.station = 'cage'; cageBot.cage = true; }
  let slot = 0;
  for (const bot of bots) if (bot.station === 'bay') { bot.baySlot = slot++; }
  return { bots, overflow: Math.max(0, all.length - bots.length) };
}
