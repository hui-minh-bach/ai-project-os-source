// Diagnose Codex app-server turn failures without revealing raw provider
// diagnostics, URLs, paths, bearer tokens or private user prompts to the UI.
const text = value => typeof value === 'string' ? value.slice(0, 2000) : '';
function safeStatusCode(error) {
  const detail = error?.codexErrorInfo;
  const objects = [error, detail, detail?.httpConnectionFailed, detail?.responseStreamDisconnected];
  for (const part of objects) {
    const n = part?.httpStatusCode ?? part?.http_status_code ?? part?.statusCode;
    if (Number.isInteger(n) && n >= 100 && n <= 599) return n;
  }
  return null;
}
function category(code, message) {
  const lower = message.toLowerCase();
  if (code === 429 || /(?:usage|rate|quota|capacity|plan|weekly|hourly).{0,45}(?:limit|exceed|exhaust|reach|reset|cap)|(?:limit|exhaust|reach).{0,45}(?:usage|quota)|too many requests|kh[aá]c hạn mức/i.test(lower)) return 'quota';
  if (code === 401 || /(?:unauthorized|authentication|invalid|expired).{0,45}(?:token|credential|session)|not logged in|refresh token failed/i.test(lower)) return 'auth';
  if (code === 403 || /(?:model|access|entitlement|permission).{0,45}(?:not available|denied|not allowed)|model_not_found/i.test(lower)) return 'access';
  if (code === 404 || /model.{0,30}(?:not found|not supported)|unsupported model/i.test(lower)) return 'model';
  if (/workspace routing discovery failed/i.test(lower)) return 'service';
  if (code >= 500 || /responseStreamDisconnected|httpConnectionFailed|connection|network|unavailable|timeout|timed out|service unavailable/i.test(lower)) return 'network';
  return 'other';
}
export function describeCodexTurnFailure(turnError, lastError, status = 'failed') {
  const source = turnError && typeof turnError === 'object' ? turnError : lastError && typeof lastError === 'object' ? lastError : null;
  const raw = [source?.message, source?.additionalDetails, JSON.stringify(source?.codexErrorInfo || '')].map(v=>text(v)).join(' ');
  const code = safeStatusCode(source);
  const kind = category(code, raw);
  const cases = {
    quota: ['CODEX_RATE_LIMIT', 'Codex có thể đã hết hạn mức sử dụng cho cửa sổ hiện tại. Mở Xem hạn mức để kiểm tra thời điểm đặt lại hoặc chuyển sang tài khoản còn lượt.'],
    auth: ['CODEX_AUTH_EXPIRED', 'Phiên đăng nhập Codex bị từ chối hoặc đã hết hạn. Kiểm tra trạng thái tài khoản và đăng nhập lại nếu cần.'],
    access: ['CODEX_ACCESS_DENIED', 'Tài khoản không có quyền dùng model này. Hãy chọn model khác trong danh mục tài khoản.'],
    model: ['CODEX_MODEL_UNAVAILABLE', 'Model được chọn không còn khả dụng qua Codex. Làm mới danh mục và thử model khác.'],
    service: ['CODEX_SERVICE_ERROR', 'Dịch vụ Codex chưa khởi tạo được phiên làm việc. Hãy thử lại sau; việc đăng nhập và lấy hạn mức vẫn có thể thành công.'],
    network: ['CODEX_NETWORK_ERROR', 'Kết nối tới dịch vụ Codex gặp sự cố. Kiểm tra mạng và thử lại sau; không cần xóa tài khoản.'],
    other: ['CODEX_TURN_FAILED', status === 'interrupted' ? 'Yêu cầu Codex đã bị gián đoạn, chưa thể xác minh model.' : 'Codex không hoàn thành lượt trả lời. Kiểm tra hạn mức 5 giờ/1 tuần và thử lại; không cần đăng nhập lại nếu trạng thái vẫn kết nối.']
  };
  const [name, message] = cases[kind];
  const err = new Error(message);err.code = name;return err;
}
export function chooseCodexText(turnItems, completedItems) {
  const messages = items => Array.isArray(items) ? items.filter(x => x?.type === 'agentMessage' && typeof x.text === 'string' && x.text.trim()).map(x => x.text) : [];
  const final = messages(turnItems);
  return (final.length ? final : messages(completedItems)).join('\n').trim();
}
export function quotaWindowNotice(rateLimits, model = '') {
  // A single shared bucket or a bucket named exactly like the selected model
  // is actionable. Never guess that another model's bucket is exhausted.
  const buckets = rateLimits?.rateLimitsByLimitId || {};
  const exact = Object.entries(buckets).find(([name]) => name.toLowerCase() === String(model).toLowerCase())?.[1];
  const root = rateLimits?.rateLimits;
  const group = exact || (Object.keys(buckets).length === 0 ? root : null);
  const windows = [group?.primary, group?.secondary].filter(w => w && Number.isFinite(w.usedPercent) && w.windowDurationMins > 0);
  const blocked = windows.find(w => w.usedPercent >= 100 && (!w.resetsAt || w.resetsAt * 1000 > Date.now()));
  return blocked ? { exhausted: true, windowDurationMins:blocked.windowDurationMins, resetsAt:blocked.resetsAt || null } : null;
}
