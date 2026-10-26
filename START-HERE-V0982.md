# Video Studio 0.9.82 — Giao diện đơn giản (nhánh kiểm thử)

Màn hình mặc định: **Tải video → Phân tích khả năng → Chọn giọng → Tạo MP4 → Xem và duyệt đăng**.

- Mỗi video tạo một tác vụ `media.localize` có phê duyệt; chạy lại engine 7 bước đã có, không tạo một tác vụ riêng cho từng bước.
- App tự nạp và kiểm tra Whisper, OCR, Worker dịch, TTS và FFmpeg. Thiếu công cụ thì chặn và chỉ ra nguyên nhân; không giả lập giọng/phụ đề thành phẩm.
- Người dùng xác nhận quyền, các giọng trả phí phải đồng ý chi phí. Không gọi API trả phí từ việc chọn tùy chọn một cách im lặng.
- Hệ thống hiển thị tệp `vietnamese-final.mp4` đã lưu và tải về được; không tự đăng. Người dùng mở **Duyệt & đăng đa nền tảng** để chọn kênh đã kết nối. Mỗi kênh tạo một tác vụ đăng được phê duyệt riêng; trạng thái chỉ hoàn tất khi nền tảng xác nhận.
- Tab **Công cụ chuyên sâu** giữ lại toàn bộ UI hiện tại, timeline, vùng logo, hiệu ứng, Concat, hàng đợi, nháp.
- Ở chế độ đơn giản, phân tích hiện kiểm tra thông số và năng lực; luồng dựng là Việt hóa 7 bước. Cắt dựng cinematic/hiệu ứng tự chọn theo ngữ nghĩa đầy đủ là việc còn mở, không quảng cáo là đã thực hiện.
- Tình trạng nhánh: mã nguồn đã cập nhật GitHub, **Node/Chromium/Windows E2E chưa chạy**, chưa kết luận chất lượng thương mại hay upload nền tảng thật. Các tài nguyên nhị phân ngoài GitHub vẫn cần ZIP nguồn đầy đủ riêng.
