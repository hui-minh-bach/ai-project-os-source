# v0.8.5 Internal RC – Media workflow corrections from customer recording (2026-10-16)

- Fixed misleading 3-step Video Studio flow: "Only plan" and "Render JSON" do **not** execute Whisper, Concat, voice or music options; they now refuse these selected options with an exact route to "Dựng MP4 theo mô tả".
- Missing Whisper model/Concat Remote configuration disables the relevant option. A true Concat RPC preflight is run before queuing a multitrack task, instead of failing after rendering.
- Video jobs now show original source name; current-source jobs are displayed first, while history from demo/other sources is hidden unless explicitly requested.
- Completed MP4 means **technically validated** only: human creative/editorial review remains required. A short clip is flagged in QA and commercialReady stays false.
- Reproduced the reported workflow in seven new regression tests; rendered an 8-second clip excerpted from the user's uploaded screen recording to 9:16, 7.96s result, visually confirmed input provenance. User's recording and test outputs are **not** included in the product ZIP.
- No claim of live Windows/Concat/Whisper or commercial acceptance.

---

## v0.8.4 Internal RC — Managed Concat setup and one-application onboarding (2026-10-16)

- Thêm cài đặt Concat 0.2.7 từ trong Video Studio: phát hiện ứng dụng đã cài; nếu chưa có, ưu tiên bộ cài đóng kèm bản offline do máy build Windows tạo hoặc tự tải bản phát hành chính thức từ GitHub. Kiểm tra cố định SHA-256 và kích thước trước khi thực thi, yêu cầu người dùng xác nhận.
- Kết nối Concat Remote qua `127.0.0.1:7420` với token ngẫu nhiên lưu trong Vault; giữ nguyên cài đặt Concat khác và sao lưu cấu hình trước khi sửa. Không tự tắt editor đang làm việc, không gửi token về trình duyệt.
- Hỗ trợ đánh thức Concat khi công việc bắt đầu và Remote đã được cấu hình an toàn. Vẫn giữ dựng FFmpeg độc lập khi không có Concat.
- Thêm `windows/Prepare-Concat-Bundle.ps1` và cập nhật bộ tạo Inno Setup để đưa riêng bộ cài, source upstream và thông báo giấy phép Concat vào một bản cài **offline** trên máy build Windows có Internet.
- **ZIP này chưa mang binary Concat**: bộ cài upstream ~85 MB không thể tải xuống trong môi trường build hiện tại; nút một-chạm có tải HTTPS lần đầu. `Build-WorkerC-Internal-RC.ps1` phải được chạy và nghiệm thu thật trên Windows để phát hành bộ cài offline.
- Chưa thể kết luận thương mại: Concat upstream chưa ký số, yêu cầu kiểm toán nghĩa vụ AGPL, test Windows thật và chất lượng video/giọng đầu ra.

## v0.8.3 RC – Concat multitrack timeline from real scenes (2026-10-16)

- Replaced previous single flattened-MP4 import when the user enables Concat Project with independent editable video scene clips imported from the source, along with separate original audio, uploaded narration, royalty-cleared music, optional title and timed SRT text layers.
- Real JSON-RPC 0.2 sequence: `project.create`, `media.import`, `edit.apply`, `project.save`, `export.run` and export event verification. Concat is not bundled or modified (AGPL-3.0-or-later).
- Scene sources are created with local FFmpeg and kept **inside the Concat project folder** for backup/reopening. User-selected title is optional; no automatic watermark or promotional text.
- Built-in Concat `cross-fade` used when feasible; fail-safe hard cuts when 3+ overlapping scenes with text overlays might trigger known beta rendering overlap bug. Subtitles/narration require actual local data, not fabricated AI output.
- Media Studio quick editor now allows optional local voice/music/SRT uploads and a Concat title. Cloud HeyGen remains explicitly opt-in only.
- Exact SHA-256 source binding, duration, path confinement, approval and final export QA remain enforced. Dedicated integration tests generate actual scene clips with FFmpeg and exercise a strict JSON-RPC **mock**. Windows Concat 0.2 live playback/exports are not yet verified: NOT COMMERCIAL RELEASE.

## v0.8.2 RC – Concat/local-first voice (2026-10-16)
- Không còn coi HeyGen API là điều kiện Video Studio. Concat editor/giọng local/Whisper được đưa lên đầu hướng dẫn.
- Thêm adapter Piper TTS offline (tự cài model/CLI có giấy phép), ưu tiên giọng local; nếu dùng API trả phí phải lựa chọn riêng.
- Tách trạng thái giọng Concat (trong ứng dụng) khỏi API RPC 0.2 (không có phương thức TTS/Whisper).
- Sửa doctor và hướng dẫn; giữ HeyGen như tùy chọn tương thích, không gắn thông báo bắt buộc.
- Vẫn là RC nội bộ. Cần nghiệm thu Concat/Piper/Windows/tài khoản thật.

## v0.8.1 RC (2026-10-16) — Codex account & quota recovery
- Phân biệt phiên đăng nhập với trạng thái model phản hồi; không giả xác minh từ hạn mức.
- Đọc quota 5 giờ/tuần của mỗi tài khoản đã đăng nhập dù model chưa xác minh.
- Xử lý Codex `turn/completed` thất bại theo nhóm hạn mức 429, 401, lỗi model và mạng (không lộ lỗi thô).
- Nhận phản hồi văn bản từ `item/completed` khi `turn.items` không có nội dung.
- Bỏ RPC `account/usage/read` không được đảm bảo hỗ trợ trong đường đọc hạn mức.
- Khi thêm ChatGPT account, chọn đúng tài khoản mới và quota tương ứng; giữ hồ sơ cũ trong data.
- Kiểm thử bằng Codex app-server mô phỏng, không phải đăng nhập thật. Giữ nguyên RC chưa bán.

## 0.7.7 RC - 2026-10-16 - Fix old-plan/new-source render mismatch

- Video Studio no longer silently reuses a completed timeline from a different video. Switching source clears the previously selected plan; applying an old plan explicitly asks to switch back to its original source.
- Media Engine now binds each newly created plan to its source SHA-256 and duration. The Local Worker rejects a mismatched source or out-of-range clips before queuing a doomed MP4 render. Historic plans also check the video path.
- Invalid-clip tasks show a repair action that restores the original source and guides a fresh quick edit, instead of retrying the same invalid timeline.
- Real local API smoke test covers plan creation, switched source rejected, same-source MP4 export, and SHA-256 of the completed result. No real account OAuth / Windows machine acceptance was performed.

## 0.7.6 RC — 16/10/2026 — Fix FFmpeg scene analysis + quota in AI provider cards

- Phân tích cảnh dùng `select/showinfo` mà không truyền `-vsync`; tương thích các build FFmpeg không nhận tuỳ chọn đó; giữ pipeline Local Worker/FFmpeg hiện có.
- Chẩn đoán máy có bài thử riêng bộ lọc phân cảnh FFmpeg, ngoài việc phát hiện FFmpeg và xuất H.264.
- Trung tâm Kết nối đặt hạn mức giờ/tuần ngay dưới Dùng cho vai trò trong từng thẻ provider. Hạn mức Codex chỉ hiển thị nếu backend đọc được cửa sổ rate-limit thật; không bịa hạn mức API, Claude, Gemini. Làm mới có giới hạn, chỉ đọc sau mở Vault, ẩn khi Vault khoá.
- Chuyển phần thống kê token dài thành một hàng tóm tắt với nút xem chi tiết, giữ API/token ledger và các vai trò hiện có.
- Giới hạn: chưa chạy FFmpeg và OAuth trên Windows thực tế của người dùng; model quota có thể là nhóm dùng chung không gắn với model cụ thể. Các tác vụ cũ bị lỗi cần bấm Thử lại sau khi mở bản mới.

## 0.7.5 RC — 16/10/2026 — Concat external API + smart scene editing (partial)

- Đã thêm Concat Remote JSON-RPC v0.2: xác thực token từ Vault, probe bản chạy thật, tạo dự án trong ứng dụng Concat riêng, nhập final MP4 rồi xuất video qua Concat. **Dự án Concat mới có một clip tổng đã render, chưa phải timeline từng cảnh và chưa dùng hết hiệu ứng của Concat.**
- FFmpeg phát hiện đổi cảnh thực và khoảng lặng; khi mô tả “chuyển cảnh mượt” thực hiện crossfade hình và audio. Có thể vừa rút ngắn vừa chuyển cảnh.
- Phụ đề tiếng Việt từ Whisper local cần cài whisper.cpp + model. Khi HeyGen không cấp word timestamps, nếu Whisper local có sẵn sẽ nhận lại giọng đã tạo rồi dùng thời gian phụ đề thật.
- Gắn các lựa chọn Concat / phụ đề / lời thoại vào tab Kế hoạch dựng, một tác vụ chờ duyệt. Không đưa token/API key vào tham số tiến trình hay ZIP.
- Giới hạn công khai: không thể đọc hiểu ngữ nghĩa cảnh bằng GPT chỉ từ timestamp; chưa tự dùng 170+ hiệu ứng Concat, chưa tích hợp trực tiếp speech API của Concat; không phát hành thương mại, không thử live Concat/HeyGen/Windows thật.

## 0.7.4 RC — 16/10/2026 — Media Studio dựng MP4 theo mô tả

- Sửa lỗi mắc kẹt ở Kế hoạch dựng / Dựng video: cho phép nhập tiếng Việt, tạo một tác vụ duy nhất, phê duyệt, chạy FFmpeg dựng preview và MP4 final có kiểm tra SHA-256. Không bắt khách nhập JSON.
- Có thể nạp kế hoạch đã hoàn thành từ hàng đợi cho chế độ chuyên sâu. Hàng đợi hiển thị trình phát video final và tệp kết quả. Không tự phê duyệt chi phí API.
- Media Planner ưu tiên AI Worker đã phân vai và xác minh trong Kết nối, hoặc model đã xác minh. Nếu Vault khóa/chưa xác minh thì có chế độ local được ghi rõ không phải AI. Không tự gửi video gốc lên model văn bản.
- Các thao tác local được hỗ trợ theo quy tắc gồm tỷ lệ 9:16/1:1/16:9, crop/fit, cắt video ngắn và fade hình; không quảng cáo tạo cảnh AI, phân tích hình ảnh bằng GPT, TTS hoặc tự đăng bài khi chưa có dịch vụ thật.
- Bổ sung bài kiểm thử dựng video thật qua HTTP + localhost session, riêng test định tuyến Worker dùng mock provider (không tính là đã đăng nhập GPT thật).
- Giữ dữ liệu người dùng ngoài thư mục ứng dụng; không đổi Vault hoặc định dạng backup. Windows sạch / OAuth thật / trình duyệt thực tế chưa nghiệm thu trong môi trường này.

## 0.7.3 RC — 16/10/2026

- Sửa giao diện Arctic Light theo màu chữ/nền thống nhất trên cả 10 tab, trạng thái chọn, modal, bảng thông tin, công cụ, lỗi và cảnh báo. Không thay đổi bốn giao diện tối.
- Sửa tương phản nút chính và nhãn trạng thái (WCAG AA cho văn bản thông thường đối với các phần đã kiểm tra bằng phân tích CSS tĩnh).
- Áp dụng chủ đề đã lưu trước khi tải CSS để tránh chớp nền tối khi mở app.
- Vé cấp phiên trình duyệt localhost dùng đúng một lần và tự xoay vòng; cho phép mở lại qua launcher mà không tái sử dụng đường dẫn cũ.
- Không sửa API AI/chi phí model, dữ liệu dự án, Vault, định dạng backup hay bộ xử lý Media.
- Giới hạn: Chrome kiểm thử trong môi trường này bị policy chặn nên chưa chạy E2E bằng trình duyệt vật lý/Windows sạch; nghiệm thu tương phản với CSS tĩnh và kiểm thử tự động, không phải xác nhận tuyệt đối mọi nội dung tạo động.

## 0.7.2 RC — 16/10/2026

- Bổ sung Google Antigravity CLI thay cho Gemini CLI cá nhân đã ngừng hỗ trợ.
- Cài Antigravity qua Windows WinGet bằng nút giao diện với đường dẫn tài liệu chính thức dự phòng.
- Đọc model và kết quả NDJSON theo cấu trúc Antigravity mới (result/result), chỉ xác nhận model nếu có phản hồi thật.
- Gửi prompt qua stdin JSON riêng tư (không lộ trong đối số tiến trình Windows).
- Thêm chế độ plan, strict, sandbox và profile tách biệt để hạn chế thực thi công cụ.
- Giữ luồng Codex/Claude Code, Vault, dự án, video, 10 tab và tệp dữ liệu ngoài thư mục cài.
- Hạn chế: OAuth thực tế/Windows 10/11, SmartScreen, WinGet chưa được thử trên máy của khách.

## v0.7.1 — Kết nối tài khoản AI và cập nhật an toàn (15/10/2026)

- Giữ đầy đủ 10 tab, AI Core, Media Engine và bản khởi chạy Windows từ v0.7.0. Không thay đổi công thức, dữ liệu dự án hoặc định dạng Vault cũ.
- Tab **Kết nối** cho phép chọn API key hoặc đăng nhập tài khoản chính thức qua Codex (ChatGPT), Claude Code và Gemini CLI. Thêm nút cài CLI trên máy, mở cửa sổ đăng nhập riêng, xác minh model bằng một yêu cầu thực; model chưa phản hồi không được phân vai.
- Trình cài CLI đặt trong thư mục dữ liệu công cụ của người dùng, không cài toàn máy và không lưu mật khẩu/cookie web. Claude/Gemini CLI tách biệt và dùng chế độ chỉ văn bản để không chạy lệnh hệ thống trong tác vụ tư vấn.
- Sửa Node.js portable thiếu npm khi nâng cấp; tải đủ bộ từ Node.js chính thức với SHA-256 đúng, biên dịch lại EXE Windows x64. Bản mới có health version riêng v0.7.1 để tránh dùng nhầm tiến trình cũ.
- Kiểm thử 163/163 bài tự động, API server/mocked CLI, các kết nối bị lỗi, Vault bị khóa, dữ liệu được giữ qua chuyển thư mục chương trình. Kiểm thử FFmpeg media E2E và media lớn đạt. **Chưa xác minh OAuth thực trên máy Windows sạch, SmartScreen hoặc điều khoản gói của nhà cung cấp.** Đây là Release Candidate.

---

## v0.7.0 — Windows launcher và local-access hardening (15/10/2026)

- Tạo `AI-Project-OS.exe` Windows x64 bằng Go, mở dự án từ đường dẫn cài đặt và khởi động Local Worker không cần thao tác CMD (chưa ký số, chưa thử trên Windows vật lý).
- Cấp phiên trình duyệt bằng vé ngẫu nhiên + cookie HttpOnly/SameSite Strict, tránh việc gõ trực tiếp localhost để truy cập dự án mà chưa mở từ launcher. Vẫn giữ kiểm Origin/Sec-Fetch-Site, host loopback.
- `Hướng dẫn → Chạy kiểm tra thật`: thử ghi dữ liệu, đếm dung lượng ổ, FFmpeg, FFprobe, mã hóa MP4 H.264 bằng clip tổng hợp không có nội dung cá nhân, kiểm Git và trạng thái AI Core. Không gọi API thu phí.
- Khóa cứng các thông báo: cấu hình HeyGen không đồng nghĩa đã kiểm chứng quyền gọi thật. Không làm giả cảnh AI/STT.
- Hướng dẫn cài Windows x64, chuyển phiên bản và giới hạn sử dụng khách hàng.

# v0.7.0 Customer Release Candidate — 2026-10-15

- Thêm `RUN-WINDOWS.cmd` để khách giải nén và nhấp đúp, tự cài Node.js portable từ nodejs.org sau khi kiểm tra SHA-256 của bản v22.23.3. Node không kèm trong ZIP.
- Giữ dữ liệu trong `%LOCALAPPDATA%\AIProjectOSLocal\data` của từng tài khoản Windows; không ghi vào thư mục cài đặt. Có trình chuyển dữ liệu `.data` cũ không tự ghi đè dữ liệu mới.
- Thêm backup `.aiosbackup` được mã hóa AES-256-GCM, scrypt và manifest kiểm SHA-256, phục hồi có staging/rollback khi ứng dụng đã đóng.
- Bổ sung UI Hướng dẫn/Trạng thái: kiểm tra AI Core, Git, FFmpeg/FFprobe, HeyGen, sao lưu và tải backup; Vault cấu hình API giọng HeyGen phía server.
- Phải phê duyệt tác vụ trước khi gọi cloud TTS; loại bỏ lỗi dùng callback `voice_id` cũ trong Worker; giữ endpoint private, không trả API key ra UI.
- Bảo vệ backup trước yêu cầu ghi dữ liệu đồng thời; chặn backup nếu đang có tác vụ local hoặc media hoạt động.
- Thêm trình cài Git và FFmpeg qua winget có yêu cầu xác nhận riêng (không bundle bên thứ ba).
- Regression: 154/154 test đạt trong môi trường Linux; media E2E / large-media / trích ZIP tạo dự án và backup đạt. **Chưa nghiệm thu cài đặt trực tiếp trên Windows, kết nối API HeyGen tính phí, installer ký số, auto-update, hệ thống license hoặc video AI điện ảnh.**

---

## 2026-10-15 — v0.5.1 natural voice worker preview
- Added real `media.voiceover`: accept a user-owned WAV/MP3/M4A, replace robotic/old video audio, optionally mix licensed music, burn provided SRT, align video to speech without truncation, store SHA-256 artifacts.
- Added optional `media.tts-video` HeyGen Starfish speech adapter with server-side API env vars and explicit per-job approval BEFORE paid text-to-speech; only use provider-supplied word timestamps for automatic captions.
- Added voice selection fetch and new video studio modes. API errors are not silently replaced by fake voice. ChatGPT/HeyGen connector login does not grant local API credentials.
- Validated user's 56.97-second natural-voice file through Local Worker and generated real H.264/AAC MP4. Regression: 149/149 automated tests; media/large-media end-to-end checks passed independently.
- CLOUD LIMITATION: HeyGen endpoint exercised only with mocked API responses; no real API key/paid-provider test. Windows GUI/live user acceptance outstanding; this remains preview-only.

## 2026-10-15 — v0.5.0 integration preview (3 tasks)
- Kept AI Project OS Local 10 tabs and base tests; integrated unchanged AI Core v1 and unchanged Media Engine V07-V10 sources behind a local host bridge.
- Added five reference-derived themes, dashboard side panel and video/story studio inside Engine Hub.
- Added explicit per-job approval, local fallback timeline origin labels, local storyboard and local-only draft.
- Added full-size video artifacts with persistent SHA-256 integrity and HTTP Range streaming, without increasing AI Core 15 MB artifact limit.
- Kept actual STT/TTS, Core model binding, official social OAuth/API blocked until verified. No automatic GitHub/Vercel release.

# Changelog

## v0.4.2 — Pre-v0.5 hardened release candidate
- Strict reviewer approval typing; string values such as `"false"` cannot approve code.
- Planner output can no longer override task IDs, status, engine or system skills; dependency graph is validated.
- Symlink escape protection for workspace access and Git security files.
- Atomic project/Vault persistence with latest-valid backup recovery.
- Stronger Vault KDF migration and minimum 10-character Vault password.
- Safe execution is the default; host-shell execution is explicitly unsafe.
- Docker test execution hardened with no network, dropped capabilities, no-new-privileges and CPU/memory/PID limits.
- External child processes no longer inherit unrelated ambient machine secrets.
- Sensitive Git file defaults and staged-file checks prevent `.env`, private keys and common credential files entering AI Project OS commits.
- GitHub publish resolves authenticated noreply commit identity before release push.
- Git remote credentials are redacted and CLI publishing refuses origin owner/repo mismatches.
- GitHub/Vercel token handoff moved away from visible token command arguments where supported.
- Local mutating HTTP routes now validate Origin and Sec-Fetch-Site in addition to Host; CSP remains enabled.
- Startup recovery changes interrupted agent tasks to a safe rerunnable state.
- Launcher verifies exact local health/version and refuses to open a foreign process occupying port 4321.
- Provider HTTP response/body and worker prompt history are bounded.
- Engine runtime detection no longer treats Docker/Python alone as proof that OpenHands/Microsoft Agent Framework is installed.
- Supabase CLI attachment, provider retry/timeout, PATH portability and engine source refresh fixes retained from the first v0.4 audit.
- Release gate expanded to **31/31 automated tests** plus HTTP and launcher smoke tests.

## v0.4.1 — First audited patch
- Parallel Git critical-section locking and safe merge/rollback behavior.
- Better model JSON parsing and API retry handling.
- CLI/runtime simulation for GitHub, Vercel, Supabase and mini-SWE.
- Supabase CLI project attachment and Git remote redaction.

## v0.4.0 — Connect & Deploy
- GitHub CLI connection and CLI-backed repo publish.
- Vercel CLI connection and local-session deploy.
- Supabase CLI and Management PAT project workflows.
- Vercel custom-domain flow.
- Beginner publish ribbon.
- v0.3 worktree/review/rollback execution retained.

## v0.3.0 — Multi-agent execution
- Per-task Git worktrees/branches.
- Review-before-merge, repair pass, rollback and conflict preservation.
- Parallel ready-task runner.
- Docker npm-script sandbox option.
- mini-SWE-agent adapter.
