# BÁO CÁO BÀN GIAO — NHIỆM VỤ 02
Ngày: 15/10/2026. Nhánh nguồn đóng gói: `feat/ai-media` (local Git bundle). Không ghi đè bất kỳ file nào trong nguồn gốc `không xóa không xóa.zip`.

## Những việc đã làm và có bằng chứng
- Module độc lập Node CommonJS `@ai-project-os/media-engine`: bảy TaskQueue handlers, ProviderGateway, ArtifactStore, EventBus được kiểm tra qua adapter giả lập, không sửa AI Core hay giao diện.
- FFprobe kiểm tra luồng âm thanh/video, kích thước, codec, thời lượng, băm file và giới hạn dung lượng/ổ đĩa; FFmpeg trích âm thanh/khung hình, phân tích chuyển cảnh và khoảng lặng.
- Có edit plan có cấu trúc với tỷ lệ 16:9, 9:16, 1:1; fallback theo quy tắc khi chưa có AI model; giới hạn tài nguyên; render từng đoạn có fingerprint để dùng lại checkpoint.
- Phụ đề có SRT/VTT, chỉnh từng đoạn, tạo từ transcript nếu STT provider có mốc thời gian, dịch qua model do user chọn.
- Story Studio đọc TXT, DOCX (Python) và PDF dạng có text (pdftotext), chia chương/cảnh, lưu storyboard, nhận giọng qua ProviderGateway và tạo tranh phong cảnh procedural ngoại tuyến.
- Đã thực sự render một video nguồn 6,021 giây và một video kể chuyện Việt 2.237 ký tự, 7 cảnh, 128,571 giây ở **1280×720**, AAC/H.264, phụ đề 24 đoạn. Sai lệch từ cuối phụ đề đến cuối MP4 đo được: **0,020 giây**. Đây là so mốc **phụ đề cấp câu với clip tổng thể**, không phải phép đo độ lệch từng từ so với âm vị lời đọc.
- QA thực tế video mẫu không thấy lỗi BLACK kéo dài, không thiếu audio, kết quả đạt. Bộ unit test **10/10 PASS**, ví dụ Concat JSON-RPC mock token/loopback, chống truy cập vượt workspace, idempotency và chặn Publisher.

## Các giới hạn và trạng thái chưa đạt DONE
- Chưa có Whisper hoặc model nhận dạng tiếng nói có thể chạy trong môi trường xây dựng này; **không có bằng chứng STT thực tế**. Demo SRT lấy từ text được tổng hợp thành giọng, không mạo nhận đó là transcript được AI nhận dạng.
- Giọng eSpeak Việt chỉ dùng cho test để tạo WAV thật; giọng máy, **chưa vượt nghiệm thu tự nhiên**. Tùy biến cảm xúc/đa nhân vật cần provider thích hợp.
- Tranh minh họa mẫu là procedural landscape, **không phải AI tạo nhân vật theo cảnh**. Provider hình ảnh cần kết nối và phép sử dụng hợp pháp.
- Local Worker KBL V5.7 trong ZIP không chứa hợp đồng CoreServices v1; do đó chỉ test được adapter với fake CoreServices, **chưa kiểm chứng gắn vào Local Worker thật**.
- Concat được nghiên cứu nhưng không cài lên máy người dùng và chưa kiểm tra thực tế Concat export API. Concat tùy chọn và không ảnh hưởng FFmpeg.
- V10 Publisher chỉ tạo nháp, gọi đăng nội dung bị khóa cứng; chưa có OAuth/API nền tảng thật nên **BLOCKED đúng yêu cầu**.
- Không tạo được Pull Request vào AI Project OS vì chưa có URL/permission của đúng repo đó; repo GitHub Concat không có quyền push, còn repo `build-my-home` không liên quan. Bàn giao nhánh local `feat/ai-media` dạng Git bundle và patch, không đẩy mã vào repo khác.

## File chứng minh
`artifacts/samples/story_720p.mp4`, `story_preview.mp4`, `story_captions.srt`, `storyboard.json`, `editor_final.mp4`, `editor_preview.mp4`, `analysis.json`, `source.mp4`, `story_frame_at_35s.png`, `artifacts/validation.json`.

Lệnh tái kiểm chứng: `npm test`, `node scripts/verify-samples.cjs`. Lệnh tự dựng lại demo cần cài FFmpeg, FFprobe và eSpeak giọng vi: `npm run demo`.

**Trạng thái cuối: BẢN MODULE V07–V09 CHẠY ĐƯỢC CÁC ĐƯỜNG FFmpeg/TTS THỬ; CHƯA ĐỦ ĐIỀU KIỆN 'DONE' TOÀN BỘ NHIỆM VỤ 02.**
