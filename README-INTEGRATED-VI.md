# BỔ SUNG CÔNG CỤ LOCAL MIỄN PHÍ (source v0.9.66)

**Đọc [START-HERE-MIEN-PHI.md](START-HERE-MIEN-PHI.md) trước.** Bản này thêm cầu nối ảnh ComfyUI localhost, ưu tiên công cụ local miễn phí API, và kiểm tra tình trạng công cụ trong Engine Hub. Không thay phòng 3D. **Chưa nghiệm thu Windows/GPU hay đạt A–Z thương mại.** Các thông tin phiên bản bên dưới là lịch sử và có thể cũ hơn.

---

# 0.9.66: Windows voice / AI images / Concat

Read `START-HERE-WINDOWS-AI-CONCAT.md` first. Scope and honest test boundaries: `docs/WINDOWS_AI_CONCAT_IMPLEMENTATION.md`. Earlier notes below are historical.

> Current source: v0.9.65 / Recovery R8. Start with `START-HERE-RECOVERY-R8.md`; current evidence: `evidence/recovery-r8/verification.json`. Prior sections below are historical. Windows/live-services commercial acceptance remains open.

# Cập nhật v0.7.0 — Phát hành thử cho khách

Đọc `START-HERE-KHACH-HANG.md` và `RELEASE-CHECKLIST-V070.md` trước. Bản này bổ sung lưu dữ liệu tách khỏi thư mục ứng dụng trên Windows, backup/restore AES256-GCM, kết nối HeyGen qua Vault và khởi chạy Node portable sau khi kiểm SHA. Báo cáo v0.5.1 bên dưới giữ nguyên làm lịch sử kỹ thuật; **chưa kết luận sẵn sàng thương mại chính thức**.

---

# AI PROJECT OS — BẢN GHÉP 3 NHIỆM VỤ

**Bản bàn giao:** `0.5.1-natural-voice-preview` · 15/10/2026  
**Nền:** AI Project OS Local v0.4.2, giữ nguyên 10 tab và local worker.  
**Ghép:** AI Core v1 + AI Media Engine V07–V10 + UI/UX 5 chủ đề; bổ sung giọng đọc tự nhiên trên Local Worker.

> Đây là **bản tích hợp chạy thử có mã nguồn và bài kiểm thử**, chưa được tuyên bố là bản thương mại cuối cùng. Không cần API key để chạy chức năng media local. Các tính năng đòi dịch vụ bên ngoài chỉ báo hoàn thành khi có provider/OAuth thật đã được thiết lập và kiểm chứng.

## Bắt đầu đơn giản

1. Giải nén ZIP vào **thư mục mới**. Không ghi đè bản đang kinh doanh/chạy công việc của bạn.
2. Máy Windows: cài **Node.js 22 trở lên**, Git. Mở `start-windows.cmd` bằng nhấp đúp. Linux/macOS: `./start-macos-linux.sh` (cho phép thực thi nếu máy yêu cầu).
3. Mở đường dẫn **http://127.0.0.1:4321**. Dịch vụ chỉ mở tại máy local, không tự triển khai công khai.
4. Chọn một trong 5 giao diện ở góc phải: **Ocean Blue / Emerald Teal / Aurora Violet / Arctic Light / Amber Copper**.
5. Chọn hoặc tạo **Dự án** → mở **Engine Hub** → đến **Video & Story Studio**.
6. Trong Media Studio, bấm **Dùng clip mẫu thật** hoặc chọn video, bấm **Tạo tác vụ chờ duyệt**, xem tác vụ rồi bấm **Phê duyệt & chạy**. Kết quả có link tệp/sha256. Không chạy trước khi bạn chấp thuận.

**Để dựng/phân tích video**, máy cần cài `ffmpeg` và `ffprobe` và phải gọi được hai lệnh này trên PATH. Nếu chưa có, giao diện hiển thị thiếu dependency, không giả lập kết quả. Bản ZIP này KHÔNG nhúng FFmpeg; cài từ nguồn chính thức theo giấy phép của bạn.

**Dữ liệu cũ:** bản ZIP *không chứa* `.data` từ máy hay người dùng khác. Dữ liệu tạo mới nằm trong `.data` ngay trong thư mục chạy. Khi thay bản, hãy sao lưu thư mục `.data` của bản trước rồi kiểm tra tính tương thích; không tự chép đè khi chưa backup.

## Phạm vi chức năng đã có mã và kiểm thử

| Tính năng | Trạng thái |
| --- | --- |
| 10 tab AI Project OS / project local / Vault gốc | Giữ nguyên bản nền, qua regression |
| 5 giao diện đổi qua menu | Có theme + ảnh nền từ tham chiếu + lưu tuỳ chọn trên trình duyệt |
| AI Core TaskQueue, task theo project, kiểm tra SHA-256 | Tích hợp thật, có approval riêng |
| Media phân tích video qua FFprobe/FFmpeg, trích khung & âm thanh | Có; đã chạy video thật |
| Phụ đề nhập và biên tập bằng JSON → SRT/VTT | Có; tạo artifact thật |
| Lập kế hoạch cắt ghép local | Có; ghi `deterministic-rule-not-ai` nếu chưa gọi model |
| Render preview + final bằng FFmpeg | Có; video thật qua quality check |
| Storyboard từ truyện (chia cảnh dạng văn bản) | Có; ghi `deterministic-local-not-ai`, KHÔNG phải video |
| Nháp tiêu đề/metadata đăng bài | Có, lưu local; KHÔNG đăng tự động |
| Video lớn hơn 15MB | Có kho media riêng, SHA-256, kiểm lại sau restart, hỗ trợ HTTP Range |
| Ghép file giọng đọc WAV/MP3/M4A tự nhiên vào video | **ĐÃ KIỂM THỬ THẬT QUA LOCAL WORKER**; video 56,97 giây, giữ đủ câu cuối |
| Phụ đề SRT, nhạc nền và khớp độ dài video với giọng | Đã kiểm thử local; giữ khung cuối hoặc đổi tốc độ phát video |
| Kịch bản → HeyGen TTS → dựng MP4 | Adapter **đã viết, đã kiểm thử với phản hồi API mô phỏng**; cần API key/voice hợp lệ; chưa nghiệm thu với tài khoản API thật |
| Nhận diện lời nói tự động (STT) | CHƯA mở — cần adapter/provider thật |
| Tự tạo giọng từ văn bản không có video nguồn | Chưa có luồng riêng: chế độ AI Tạo giọng hiện yêu cầu video nguồn để dựng MP4; cần HeyGen API |
| Dựng bằng AI model từ Media Studio | Core Vault/Worker/model/budget cần cấu hình thêm; khi chưa có, chỉ dùng timeline quy tắc local |
| V10 đăng TikTok/YouTube/Facebook tự động | BỊ KHÓA — chưa nghiệm thu OAuth/API chính thức |
| Windows exe / installer đã ký / auto-updater | CHƯA có; đây là source chạy bằng Node |
| Screenshot QA trên trình duyệt thật và Windows người dùng | CHƯA nghiệm thu trên máy đích; kiểm thử HTML/CSS/API local được thực hiện |

## Cách vận hành Core bảo mật

- Mặc định, Core chạy **local-only**, không đòi API key. Các job nhập media, phân tích, render và storyboard local hoạt động khi FFmpeg sẵn sàng.
- Chỉ để bật **Core Vault riêng**, khai báo biến môi trường `KBL_CORE_MASTER_KEY` dài **ít nhất 32 ký tự trước khi chạy**. Giữ nguyên khoá khi mở lại để dữ liệu Vault vẫn giải mã được. **Không** dán mật khẩu/key vào JavaScript frontend, repo, thư mục chia sẻ hoặc bản ZIP.
- Kho Vault của Core và kho kết nối AI của 10 tab gốc là **hai lớp riêng**. Bản này **chưa tự đồng bộ** các tài khoản/API được lưu trong tab *Kết nối* sang Core Worker. Do đó việc có key ở tab Kết nối **không đồng nghĩa** Media gọi model được.
- Để Core gọi provider, cần cấu hình **real provider/role Worker/budget** trong adapter Core theo tài liệu `docs/handoff/`. Mọi cuộc gọi model chưa xác minh phải báo chưa xác minh; không gắn nhãn AI đã chạy nếu chỉ dùng quy tắc local.
- Server chỉ bind **127.0.0.1:4321**; chống Origin và Host không thuộc máy local. Tác vụ Core không liên quan media không thể bị duyệt hoặc lấy file qua endpoint Media. Upload media tối đa 150 MB/lần; artifact media local tối đa 1 GB. Cả input và output được ràng buộc thư mục local; lớn hơn 15 MB lưu trong registry riêng với receipt SHA ở Core.

## Mã nguồn ghép — ai sở hữu phần nào

- `src/`, `public/tabs/` (trừ `media-studio.html`): mã nền AI Project OS Local được giữ lại.
- `integrations/ai-core/`: mã AI Core v1 tiếp nhận từ nhiệm vụ số 1, phần runtime gốc không sửa.
- `integrations/media-engine/`: mã AI Media Engine V07–V10 tiếp nhận từ nhiệm vụ số 2, nguồn engine gốc không sửa.
- `src/lib/integration-host.mjs`: **adapter chủ tích hợp**, cô lập vùng dữ liệu, API, phê duyệt, artifact, STT/provider gate, không sửa chéo backend.
- `src/lib/voiceover.mjs`, `src/lib/heygen-tts.mjs`, `src/lib/voice-captions.mjs`: thay tiếng offline, cổng HeyGen Starfish và tạo SRT từ timestamp có thật, tất cả chạy qua hàng đợi phê duyệt.
- `public/experience.*`, `public/theme.js`, `public/media-studio.js`, `public/tabs/media-studio.html`, `public/assets/hero-*.webp`: nhiệm vụ số 3, không tạo thêm tab; Video Studio nằm trong Engine Hub.
- `scripts/verify-media-e2e.mjs`, `scripts/verify-large-media.mjs`, `test/integration-host.test.mjs`: kiểm tra thực tế hoạt động tích hợp. 

## Chạy bài kiểm thử trên máy phát triển

```bash
npm run check
npm test
npm run verify:media-e2e
npm run verify:large-media
```

**Nghiệm thu v0.5.1 ngày 15/10/2026:** `npm test` **149/149** bài đạt (thêm 8 bài cho giọng nói); `verify:media-e2e` và `verify:large-media` đã chạy đạt khi gọi độc lập. Đã thực hiện một lần dựng MP4 bằng giọng người dùng qua `media.voiceover`, dài **56,97 giây**, QA đạt. Chưa có bằng chứng thực nghiệm dùng `HEYGEN_API_KEY` thật.

`verify:media-e2e` tạo clip demo/trích ảnh/video output trong thư mục tạm rồi dọn sạch. `verify:large-media` kiểm video >15MB, thử đọc lại sau restart và chứng minh dữ liệu bị sửa sẽ bị chặn khi tải. **Các bài test không gọi model/cloud API**. `npm test` chạy regression nền và các test Core/Media độc lập. Chỉ khi các bài kiểm thử này chạy đạt trên máy phát triển **và** kiểm tra thủ công Windows mới có cơ sở đóng bản thương mại.

## Giọng đọc tự nhiên mới

Xem **`VOICE-NATURAL-SETUP-VI.md`** để thao tác chi tiết. Chế độ **Thay giọng thật** chạy hoàn toàn local với file audio đã tạo và không đòi API key. Chế độ **AI Tạo giọng từ kịch bản** yêu cầu tài khoản HeyGen có quyền API và voice ID tương thích; khóa nằm trong biến môi trường phía máy chủ, không nhập trên trang web. Cả hai đều tạo tác vụ chờ phê duyệt.

## Hạn chế đã biết và nghiệm thu còn lại

1. Xác minh UX bằng trình duyệt GUI trên **Windows thật**, cả 5 theme với DPI/zoom và màn hình nhỏ. Giao diện mới đã được smoke-test bằng trình duyệt mô phỏng DOM, chưa phải nghiệm thu Windows vật lý.
2. Kết nối và kiểm chứng API/model thật theo cơ chế ngân sách/tiết kiệm token. Kết nối Core Provider từ tab Kết nối gốc hiện chưa tự động.
3. Đã có adapter TTS HeyGen và phối giọng; còn cần **kiểm chứng API thật, hạn mức chi phí/đồng ý của người dùng**. STT vẫn chưa có provider. Storyboard local **không** được coi là video tạo tự động.
4. Xác nhận OAuth + scope + giới hạn official API trước khi cho phép phát hành V10.
5. Đóng gói runtime FFmpeg hợp pháp cho Windows nếu muốn 1-click cài đặt và thêm test trên phần cứng mục tiêu; hoàn thiện EXE/installer, backup/migration, hướng dẫn sử dụng trước thương mại.
6. Cần chủ sở hữu kiểm tra và phê duyệt trước khi đẩy lên `main` hoặc phát hành công khai. **Không tự push hoặc deploy** từ bản này.
