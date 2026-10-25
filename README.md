# AI Project OS — Personal Edition

Bản cá nhân **0.9.63-personal.1**, dựa trên upstream 0.9.62. Step 1 bổ sung định danh riêng, dữ liệu per-user riêng và vô hiệu hóa kênh cập nhật upstream. Chưa đóng gói Windows Portable mới.

Xem [hướng dẫn Step 1, cập nhật, nhập dữ liệu và rollback](docs/personal/STEP-1-FOUNDATION.md).

Tài liệu yêu cầu dự án (PRD) chính thức xuất hiện trong AI Council sau khi PO chốt Specification; xem [hướng dẫn PRD](docs/personal/PROJECT-PRD.md). Không trỏ Personal vào thư mục dữ liệu của bản gốc. `npm test` chạy với dữ liệu tạm riêng.

Phần bên dưới giữ tài liệu upstream để tham khảo các chức năng hiện có; các thông tin phiên bản/đóng gói cũ không phải chứng nhận phát hành Personal.

---

# AI Project OS v0.8.4 — Concat managed setup (INTERNAL RC)

**Một ứng dụng điều khiển, không còn yêu cầu khách tự đi tải Concat**: mở `AI-Project-OS.exe`, mở Vault, vào **Video & Story Studio → Kế hoạch dựng → Kết nối trình biên tập Concat**, bấm **Cài + kết nối Concat tự động**. Đồng ý với cài đặt ứng dụng Concat AGPL riêng. Nếu Concat đã cài thì ứng dụng chỉ cấu hình kết nối; nếu chưa thì tự xác minh SHA-256 của bộ cài chính thức, cấu hình localhost, lưu token vào Vault và khởi động Concat.

**Quan trọng — khác nhau giữa hai kiểu phát hành**:
- ZIP mã nguồn/EXE này **chưa kèm tệp Concat ~85 MB**; bước cài một lần cần Internet và sự cho phép vì môi trường đóng gói hiện tại không tải được asset Windows. Người dùng không phải tự tìm và chạy Concat Installer, nhưng phần mềm sẽ tải hộ.
- Để đóng **bộ cài thật sự offline** một lần cho khách, sử dụng `windows/Build-WorkerC-Internal-RC.ps1` (xem `docs/BUILD-ONE-OFFLINE-WINDOWS-INSTALLER.md`) trên máy build Windows có Internet và Inno Setup; quy trình sẽ nạp Concat installer chính thức vào `vendor/concat`, kiểm hash và kèm source/giấy phép trước khi tạo bộ cài. Bản build chưa được nghiệm thu Windows, chữ ký số chưa có, **không bán v0.8.4**.
- Concat là chương trình Rust độc lập AGPL, không phải thư viện Node.js và không biến thành mã độc quyền bằng cách chép `src` vào dự án. AI Project OS sử dụng JSON-RPC qua loopback; Concat vẫn là ứng dụng riêng nhưng có thể cài và dùng từ một giao diện quản lý.

---

# AI Project OS v0.8.3 — Internal RC, not for commercial sale

**Cập nhật từ v0.8.0:** sửa Codex nhiều tài khoản, hạn mức 5 giờ/tuần trước xác minh model, đọc lỗi Codex an toàn, nhận phản hồi text từ sự kiện hoàn tất. Xem `OPEN_FIRST_INTERNAL_RC.md` trước khi mở EXE. Giữ nguyên dữ liệu `%LOCALAPPDATA%\AIProjectOSLocal\data`, sao lưu trước khi cập nhật.

---

# AI Project OS Local v0.7.7 RC — Windows x64

**Cập nhật v0.7.7:** Sửa lỗi phân tích video FFmpeg `Unrecognized option vsync`; kiểm tra cảnh thật trong chẩn đoán máy; hiển thị hạn mức giờ/tuần dưới nút Dùng cho vai trò của từng thẻ AI. Sau khi mở Vault, hạn mức Codex được lấy từ tài khoản, không bịa hạn mức Claude/Gemini/API key. Nếu tác vụ cũ đã lỗi, bấm Thử lại sau khi cài phiên bản mới.

**Bắt đầu tại `START-HERE-KHACH-HANG.md` và `VIDEO-CONCAT-SETUP-VI.md`.** Phiên bản v0.7.7 bổ sung Video Studio dựng MP4 theo mô tả tiếng Việt; không bắt khách nhập timeline JSON. Một tác vụ có phê duyệt sẽ tạo kế hoạch, dựng preview, xuất final MP4 và kiểm tra SHA-256. Kết nối AI nếu đã xác minh; nếu chưa có AI, quy tắc local được ghi rõ. GPT không tự tạo footage hay lời đọc mới.

**Không xóa** `%LOCALAPPDATA%\AIProjectOSLocal\data` khi nâng cấp từ v0.7.3. EXE trong ZIP là launcher portable, chưa ký số, chưa thử trên Windows vật lý/đăng nhập tài khoản AI thật.

---

## Tài liệu phiên bản trước (lịch sử)

# AI Project OS Local v0.7.0 — Windows Customer RC

**Bắt đầu tại `START-HERE-KHACH-HANG.md` và `VIDEO-CONCAT-SETUP-VI.md`.** Giải nén toàn bộ ZIP và nhấp đúp `AI-Project-OS.exe` trên Windows x64. EXE chỉ là bộ khởi chạy portable; nếu chưa có Node.js >=22 thì cần Internet lần đầu để cài Node.js portable được kiểm tra SHA-256.

**Chưa nghiệm thu thương mại hoàn chỉnh.** Chữ ký số cho bộ cài, kiểm thử tài khoản AI thật trên Windows, TTS HeyGen trả phí và AI tạo video điện ảnh vẫn là các cổng chưa qua nghiệm thu. (Auto-update có chữ ký số đã tích hợp; phần mềm không dùng license.)

---

# AI Project OS Local v0.7.0 — Bản khách hàng thử nghiệm (Release Candidate)

**Khách hàng bắt đầu tại [START-HERE-KHACH-HANG.md](START-HERE-KHACH-HANG.md).** Có khởi chạy Windows tự cài Node portable, sao lưu mã hóa, dữ liệu per-user và cấu hình HeyGen trong Vault. Windows bản thử nghiệm chưa được nghiệm thu trên phần cứng khách. Không gộp với bản phát hành thương mại chính thức cho đến khi vượt qua checklist.

---

# BẢN TÍCH HỢP 3 NHIỆM VỤ — v0.5.1 NATURAL-VOICE PREVIEW

**Tài liệu lịch sử v0.5.1:** [README-INTEGRATED-VI.md](README-INTEGRATED-VI.md) và [VOICE-NATURAL-SETUP-VI.md](VOICE-NATURAL-SETUP-VI.md). Phần nội dung v0.4.2 bên dưới là tài liệu của phiên bản nền, không phản ánh toàn bộ trạng thái tích hợp mới.

---

# AI Project OS Local v0.4.2 — Pre-v0.5 Release Candidate

Local-first product operating system cho người mới: **ý tưởng → AI Council → đội AI → worktree/review → GitHub → Supabase khi cần → Vercel Preview/Production → domain**.

## Chạy
1. Cài Node.js 22+ và Git.
2. Giải nén.
3. Windows: double-click `start-windows.cmd`; macOS/Linux: `./start-macos-linux.sh`.
4. Launcher chỉ mở `http://127.0.0.1:4321` sau khi xác nhận đúng AI Project OS v0.4.2 đang chạy.

Không cần `npm install` cho chính AI Project OS.

## Mặc định an toàn
- Server chỉ bind `127.0.0.1`.
- Mutating API kiểm Host + Origin + Sec-Fetch-Site; UI có CSP.
- Secret Vault dùng AES-256-GCM, password tối thiểu 10 ký tự, atomic backup/recovery.
- **Safe mode là mặc định:** agent được sửa file trong worktree nhưng không được chạy command.
- Khi cần chạy test, chọn **Docker**. Docker chạy no-network, drop capabilities, no-new-privileges và có CPU/RAM/PID limits.
- **Host** và external mini-SWE là chế độ UNSAFE, bị khóa/cảnh báo rõ ràng.
- Workspace chặn traversal, symlink escape, `.env`, `.git` và các đường dẫn credential phổ biến.
- Git baseline không track `.env`, private keys, `.npmrc`, AWS/SSH credential paths.

## Multi-agent execution
- Mỗi task chạy trong Git worktree/branch riêng.
- Native engine là execution engine mặc định.
- Reviewer → optional repair pass → merge hoặc rollback.
- Git critical sections được khóa theo project; AI work vẫn chạy song song.
- Stress gate đã chạy 4 worker song song ở 4 branch và giữ đủ 4 state/merge.
- Nếu hai agent sửa cùng một file, branch conflict không ghi đè `main` âm thầm.
- Task đang chạy lúc app bị tắt/crash được đánh dấu `interrupted` và có thể chạy lại.

## AI providers
- OpenAI Responses API.
- Google Gemini generateContent API.
- Anthropic Messages API.
- OpenAI-compatible endpoint.
- Có retry/timeout cho lỗi tạm thời và giới hạn kích thước HTTP/model output/context.
- Không dùng email/password/cookie ChatGPT/Gemini/Claude.

## Connect & Deploy
### GitHub
- Ưu tiên phiên `gh auth login`; token trong Vault vẫn được hỗ trợ.
- Repo mặc định Private.
- Credential trong remote URL không được hiển thị.
- Trước publish, commit HEAD dùng GitHub noreply identity của account đang kết nối.
- Nếu workspace có `origin` khác owner/repo đang kết nối, hệ thống từ chối push để tránh ghi nhầm.

### Vercel
- Dùng `vercel login` hoặc token trong Vault.
- Preview trước, Production sau.
- Vercel token được truyền qua child-process environment thay vì xuất hiện trong `--token` command argument.
- Có flow gắn domain đã sở hữu.

### Supabase Wizard
Chỉ dùng khi Stack Analyzer xác định dự án cần database/auth/storage.
- Supabase CLI hoặc Management PAT.
- Liệt kê/tạo project và gắn publishable/anon key vào Vault.
- Không tự đưa secret/service-role key vào frontend.
- DB password không được ghi vào source.

## Engine Hub
- **Native Sandbox:** full execution trong ranh giới AI Project OS; Safe là mặc định.
- **mini-SWE-agent:** `unsafe-host`, chỉ được chọn khi người dùng chủ động bật external host execution.
- **OpenHands Agent Canvas:** catalog/launch target; chỉ báo runtime installed khi `agent-canvas` thật sự tồn tại.
- **CrewAI / MetaGPT:** workflow catalog targets.
- **Microsoft Agent Framework:** orchestration/library target; detection kiểm package/module thay vì chỉ kiểm Python.
- **GPT-Pilot:** blocked.

Clone source của engine ngoài **không đồng nghĩa execute**.

## Final gate của v0.4.2
```bash
npm run check
npm test
```

Kết quả: **31/31 automated tests PASS**, cộng HTTP same-origin/Host/CSP smoke gate và launcher occupied-port gate.

Chi tiết xem `AUDIT_REPORT.md`.

## Mức phát hành
Bản này là nền **private alpha / pre-v0.5 release candidate**. Có thể dùng cho dự án thử nghiệm và nhóm test nhỏ. Chưa phát public beta trước khi hoàn thành các mục credential broker, dependency sandbox/cache, cost budgets, supply-chain pinning, audit journal và target-OS E2E trong v0.5.


## Bản v0.7.1 RC: cài và đăng nhập AI qua CLI chính thức trên Windows

Đóng **AI Project OS** trước khi giải nén và thay bản chương trình. Giải nén toàn bộ ZIP vào cùng thư mục chương trình hoặc thư mục mới; không chép vào `%LOCALAPPDATA%\AIProjectOSLocal\data`. Mở `AI-Project-OS.exe` (Windows x64) hoặc `RUN-WINDOWS.cmd`. Nếu máy chưa có Node.js 22+, bộ khởi động tải Node.js portable từ nodejs.org, kiểm SHA-256 và kèm npm.

Vào **Kết nối → OpenAI / ChatGPT, Google Gemini hoặc Anthropic Claude → Quản lý**. Chọn **API key** hoặc **tài khoản qua CLI**. Để đăng nhập tài khoản, mở Secret Vault, bấm **Cài CLI**, sau đó **Mở đăng nhập chính thức** (hoặc dùng các file `.cmd` hỗ trợ), hoàn tất đăng nhập trong cửa sổ provider, rồi **Xác minh model** bằng phản hồi thực. Chỉ model đã xác minh mới có thể phân vai cho Founder / Council / Worker / Reviewer. Tài khoản ChatGPT sử dụng Codex; Claude dùng Claude Code; Gemini dùng Gemini CLI. Chính sách gói, hạn mức và khả năng đăng nhập theo điều khoản của từng nhà cung cấp, không được bảo đảm bởi ứng dụng.

**Quan trọng:** `ai-tools/` và hồ sơ đăng nhập ở vùng người dùng `%LOCALAPPDATA%\AIProjectOSLocal`, không nằm trong ZIP và không được chép đè khi cập nhật mã nguồn. Dữ liệu khách hàng, ảnh/video, dự án, Vault và cấu hình vẫn nằm ngoài thư mục ứng dụng. Không bao giờ gửi thư mục dữ liệu hoặc hồ sơ đăng nhập cho khách khác. Không nhập mật khẩu web, cookie hoặc token phiên vào giao diện.

**Tình trạng nghiệm thu:** Đã kiểm tra Node.js, API/giao diện ở mức source, mock CLI, dữ liệu khi thay thư mục, và xây dựng lại EXE x64. Chưa chạy thử đăng nhập thật của từng tài khoản trên Windows sạch, và không thay thế được kiểm thử với quyền tài khoản/thiết bị thật. Bản vẫn là **Release Candidate**, không phải bản thương mại đã chứng nhận.


### Windows v0.7.2 Google consumer login

`Kết nối → Google Gemini → Đăng nhập Google` sử dụng Google Antigravity CLI (không dùng Gemini CLI cá nhân đã ngừng hỗ trợ), có nút WinGet cài một lần, đăng nhập qua Google, tải danh mục model có thật rồi xác minh phản hồi. Gemini API key vẫn là lựa chọn riêng. Lưu dữ liệu ở `%LOCALAPPDATA%\AIProjectOSLocal\data` ngoài thư mục phát hành. Đây vẫn là Release Candidate chưa kiểm tra OAuth thật trên Windows.

## Concat editable timeline (v0.8.3)

The optional Concat connection now opens an actual multitrack project: separate pre-cut scene files, original audio, licensed music, narration, timed subtitle text clips and optional title. The external editor is controlled through the documented JSON-RPC 0.2 API; its AGPL code is not packaged. This is tested using FFmpeg media generation and a strict RPC mock, **not** a live Windows Concat install. Commercial release readiness remains blocked.

## v0.8.5 — lưu ý luồng Video Studio

Ở Bước 2, bấm **Dựng MP4 theo mô tả** để chạy các tùy chọn Whisper/Concat/giọng/nhạc đã bật. Nút **Chỉ lưu kế hoạch** chỉ tạo JSON. Bước 3 **Xuất MP4** chỉ dựng cơ bản theo timeline, không thể thay thế Concat/Whisper. Ứng dụng sẽ chặn các tính năng chưa sẵn sàng thay vì báo hoàn thành giả. Sau khi đổi video, hàng đợi chỉ hiển thị kết quả của video đang chọn (có nút xem lịch sử). MP4 có trạng thái kiểm tra kỹ thuật, không mặc định là sản phẩm đã đạt để đăng hay bán.
