# HỒ SƠ NGHIỆM THU TÍCH HỢP A + B + C — 2026-10-16

## Nguồn và nguyên tắc
- Baseline: AI_PROJECT_OS_V077_FULL_WINDOWS_RENDER_CLIP_FIX_2026-10-16.zip, SHA256 `bdf3b08a52d19366c3970a5e4b1cff88c9e2e454c832e1a5852ec5c495219b97`.
- A đã cung cấp patch giới hạn trong `integrations/ai-core/` (19 tệp). B sửa 6/thêm 2 file Media. C sửa 9/thêm 7 file giao diện, launcher và installer QA.
- Đã gộp tuần tự A → B → C trên baseline, không có tệp bị hai worker cùng sửa. Integration owner sửa riêng host, version, UI xung đột và test.
- **Kết luận phát hành: RED — KHÔNG BÁN, KHÔNG ĐÁNH DẤU THƯƠNG MẠI.** Các kết quả Linux/Chromium fixture không thay thế nghiệm thu Windows và tài khoản thật.

## Các kết quả kiểm thử trong môi trường tích hợp
- `npm run check`: đạt (cú pháp JS), chạy sau cập nhật version.
- `npm test`: **238 PASS, 1 SKIP, 0 FAIL**; chạy tuần tự trên Linux Node 22; bài skip phải được kiểm tra ở môi trường hỗ trợ.
- Bộ 5 lệnh `verify:media-source-binding`, `verify:media-e2e`, `verify:quick-media`, `verify:media-user-flow`, `verify:large-media`: đều exit 0; sử dụng nguồn video kiểm thử tổng hợp, không phải video điện thoại của khách.
- Bộ AI Core riêng: **59 PASS**. Các test dùng giả lập nhà cung cấp khi không có tài khoản thật và chưa chứng minh chi phí thực tế.
- UI offline Playwright Chromium: 10 tab x 5 themes x 2 kích thước = **100 ảnh + 100 lần chuyển tab**, không có JavaScript pageerror; test thao tác nút mở dự án, Escape modal, lỗi mất backend và Retry. Đây là fixture, **không phải đăng nhập hay chạy backend thật**.
- Tích hợp: 4 bài kiểm thử từng đỏ đã chuyển xanh (nguồn bị sửa / duration khai báo sai / timeline v1 / source quick-edit). Nút kết nối không còn đè tiêu đề trên Arctic Light 1366px theo screenshot fixture.
- Launcher: Go cross-build ra PE32+ x86_64 phiên bản 0.8.0; **chưa có bằng chứng thực thi trên Windows/Defender/SmartScreen**.
- `verify:release-readiness --enforce`: phải trả mã 2 (gating RED). Mã hash source ZIP chưa phải chữ ký số.

## So với 20 điều kiện trong 05_INTEGRATION_RELEASE.md
| Gate | Kết quả | Còn thiếu trước khi bán |
|---|---|---|
| W01, W02 | CHƯA KIỂM CHỨNG | Windows 10/11 sạch, người dùng thường, EXE chạy 2 lần, không cần Node thủ công |
| W03, W04 | CHƯA KIỂM CHỨNG | Dữ liệu/vault v0.7.7 nâng cấp, backup và rollback thực tế |
| W05 | CHƯA KIỂM CHỨNG | Máy 8GB RAM không GPU, video H264 thật, ổ cứng gần đầy |
| A01 | ĐẠT LOCAL MỘT PHẦN | Chạy offline khi Node đã có; thử ngắt mạng thật trên Windows |
| A02 | CHƯA KIỂM CHỨNG | Đăng nhập Codex/Claude/Google bằng tài khoản được phép |
| A03 | ĐẠT MOCK, CHƯA LIVE | 401/429, hạn mức, mất kết nối, chi phí thật; giao diện duyệt 1 lần |
| A04 | ĐẠT UNIT, CHƯA GIT THẬT | Tranh chấp worktree/merge + review thật trên GitHub private |
| A05 | ĐẠT TEST LOCAL | Thử cách ly máy khách, symlink Windows và host shell |
| M01 | ĐẠT LINUX, CHƯA WINDOWS | Bản FFmpeg.exe/codec Windows và video điện thoại VFR |
| M02 | ĐẠT TEST TÍCH HỢP | Đối chiếu thêm media gốc của khách và 30 render lặp |
| M03 | ĐẠT VIDEO TỔNG HỢP, CHƯA ĐỦ | 10+ định dạng/video thật, 30 bản xuất liên tiếp, âm thanh/phụ đề khớp |
| M04 | ĐẠT MÔ PHỎNG, CHƯA LIVE | Kết nối Concat thực bằng token và FFmpeg fallback trên Windows |
| M05 | KHÔNG CÓ | Concat 2 clip chỉnh sửa riêng và 1 hiệu ứng thật, lưu/mở/xuất |
| M06 | CHƯA KIỂM CHỨNG | Whisper.cpp/TTS model + giọng thật + đồng bộ và phê duyệt phí |
| P01 | ĐẠT DRAFT LOCAL MỘT PHẦN | AI Idea → Council → Team → reviewer → GitHub private → Vercel Preview có smoke |
| P02 | CHƯA KIỂM CHỨNG | Người phê duyệt production/domain, xác nhận đích/rollback |
| P03 | ĐẠT LOCAL MỘT PHẦN | Tài liệu/nghiên cứu có nguồn truy xuất thật và xuất tệp dùng được |
| U01 | ĐẠT OFFLINE FIXTURE MỘT PHẦN | Playwright/axe UI + thao tác thực trên Windows 10/11 các DPI |
| S01 | KHÔNG ĐẠT | Ký số installer, EULA, license, tự cập nhật có rollback/signature |
| S02 | KHÔNG ĐẠT | >=5 người dùng thử tối thiểu 7 ngày, không còn lỗi P0/P1 |

## Lỗi/nguy cơ còn nghiêm trọng
1. Commercial Core strict có code và mock test nhưng **chưa có host route phê duyệt theo phiên UI**; triển khai chi phí trên giao diện legacy chưa đi qua A commercial policy. Không quảng bá trần chi phí tuyệt đối.
2. Launcher `.exe` đã cross-build nhưng gói portable không bao gồm Node Windows runtime offline; Inno Setup C là **mẫu nội bộ chưa được biên dịch/ký số**.
3. Chưa có cơ chế auto-update an toàn, license/activation thương mại, định giá, terms/legal audit; Concat AGPL chỉ tích hợp qua API.
4. Chưa có tài khoản và quyền được ủy quyền để kiểm chứng GitHub/Vercel/Whisper/HeyGen/AI; không hứa tính năng live.
5. Media Engine phân cảnh bằng heuristic FFmpeg, chưa có AI thị giác hiểu nội dung; Concat còn một clip đã ghép.

## Quyết định
- **Cho phép tiếp tục kiểm thử nội bộ v0.8.0 RC** theo dữ liệu kiểm thử và sao lưu.
- **Không cho phép bán, deploy production, quảng cáo tất cả tính năng là hoàn chỉnh.** Chỉ đánh dấu release khi từng gate có bằng chứng Windows/nhà cung cấp/người thử thật, kiểm tra độc lập và không còn P0/P1.
