/**
 * Hai khu tài khoản (0.9.53): "Khu Codex" vs "Khu Chatbox".
 *
 * Chỉ đạo của chủ sở hữu: "chọn bên nào lấy model bên đó" — vai trò được
 * phân vào KHU nào thì chỉ dùng model của các kết nối thuộc khu đó, và hạn
 * mức trừ đúng vào tài khoản của khu đó. Trước 0.9.53 app chỉ có một loại
 * kết nối ChatGPT (chatgpt_account qua Codex CLI) và danh mục model đọc
 * từ CLI theo từng tài khoản; hai khu là lớp TỔ CHỨC + PHÂN VAI trên các
 * đường đăng nhập tài khoản chính thức sẵn có (Codex CLI, Gemini CLI,
 * Antigravity CLI, Claude CLI). Khu KHÔNG phải một đường thực thi mới:
 * tuyệt đối không tự động hoá giao diện web chat miễn phí của bất kỳ hãng
 * nào — mọi thực thi vẫn đi qua CLI/đăng nhập chính thức như trước.
 *
 * Ánh xạ xác định theo `kind` của kết nối:
 * - Khu Codex: họ OpenAI — tài khoản Codex CLI (chatgpt_account; danh mục
 *   Sol/Terra/Luna, hạn mức 5 giờ/tuần riêng từng tài khoản) và bản API
 *   song sinh (openai).
 * - Khu Chatbox: các tài khoản kiểu chat — Antigravity (antigravity_account),
 *   Gemini (gemini_account, gemini), Claude (claude_account, anthropic);
 *   mỗi tài khoản có hạn mức riêng của hãng mình.
 * - Không thuộc khu nào (null): openai_compatible (ô endpoint riêng do
 *   người dùng tự cắm key — chọn được ở cả hai khu khi phân vai, hạn mức
 *   là tiền của chính người dùng tại endpoint đó) và mọi kết nối hạ tầng/
 *   nền tảng (github, vercel, supabase, nền tảng đăng bài, other) — nhóm
 *   "Công cụ", logic khu không chạm tới.
 */

export const CONNECTION_AREAS = Object.freeze(['codex', 'chatbox']);

// Canonical map — public/tabs/connections.js carries a mirror
// (CC_AREA_BY_KIND) that test/connection-areas.test.mjs keeps in sync.
export const CONNECTION_AREA_BY_KIND = Object.freeze({
  chatgpt_account: 'codex',
  openai: 'codex',
  antigravity_account: 'chatbox',
  gemini_account: 'chatbox',
  gemini: 'chatbox',
  claude_account: 'chatbox',
  anthropic: 'chatbox',
});

const AREA_LABEL = Object.freeze({ codex: 'Khu Codex', chatbox: 'Khu Chatbox' });

/** Khu của một loại kết nối: 'codex' | 'chatbox' | null (không thuộc khu). */
export function connectionArea(kind) {
  return CONNECTION_AREA_BY_KIND[kind] ?? null;
}

/** Nhãn hiển thị của khu: 'Khu Codex' | 'Khu Chatbox' | null. */
export function areaLabel(area) {
  return AREA_LABEL[area] ?? null;
}

/**
 * Kiểm tra phân vai có khớp khu không. `bindingArea` là khu đã lưu/gửi
 * kèm phân vai (có thể trống với phân vai cũ); `kind` là loại kết nối của
 * model được chọn. Ném lỗi khi CẢ HAI phía đều thuộc một khu mà khác
 * nhau — chọn bên nào thì model và hạn mức phải đi theo bên đó. Kết nối
 * trung lập (không thuộc khu) không bao giờ bị chặn ở đây.
 */
export function assertBindingArea(bindingArea, kind) {
  const connArea = connectionArea(kind);
  if (bindingArea && connArea && bindingArea !== connArea) {
    throw new Error(`Model này thuộc ${areaLabel(connArea)} — không thể phân vai vào ${areaLabel(bindingArea) || 'khu đã chọn'}. Chọn bên nào thì dùng model và hạn mức bên đó; hãy chọn model trong đúng khu.`);
  }
  return connArea;
}
