# AI Project OS v0.9.81 — sửa che phụ đề quá cao (Video Studio)

Bắt đầu từ source v0.9.80. Đây là bản vá Video Studio, không thay đổi 3D / AI Team / dự toán / quyền tài khoản.

## Vấn đề đã sửa

- Trước đây chế độ **Tìm chữ toàn khung bằng OCR** luôn thêm dải đen ngang 26% chiều cao; video vẫn 1920×1080 nhưng phần người/vật ở dưới bị che mất.
- Giờ **OCR mặc định** dựng các ô che nhỏ đúng quanh chữ phát hiện, dùng FFmpeg `delogo` (nội suy nền cục bộ) ở đúng khoảng thời gian. Không còn tự phủ dải đen toàn khung dưới trong chế độ OCR.
- Không có Tesseract: người dùng có thể **chủ động chọn** chế độ dải thấp, 8% mặc định; đây là che đen, không phải khôi phục nền. Nếu phụ đề nằm cao hơn 8%, chọn lại phạm vi hoặc cài OCR.
- Khoảng phụ đề Việt được vẽ sau bước che chữ; âm thanh gốc vẫn bị thay toàn bộ bởi giọng Việt. Việc nhận diện chữ nhanh/mờ và phục hồi nền phức tạp vẫn là giới hạn thực tế.
- Giữ tương thích với checkpoint cũ `opaque-bottom-band-and-real-ocr-boxes`: tác vụ đang dở không bị lén thay thuật toán sau duyệt, tạo tác vụ mới để áp dụng.

## Kiểm tra

Chạy `node --test test/media-precise-cover-v0981.test.mjs test/media-renewal-v0980.test.mjs` và `npm run check`. Bản sửa phải giữ nguyên độ phân giải/khung hình, không đụng vào vùng ngoài ô chữ, và không tự che băng lớn ở chế độ OCR. Bài kiểm thử/video demo đi kèm chỉ là ca cục bộ; không chứng minh xử lý mọi phụ đề, chuyển động, Windows hay video khách.

Chạy trên Windows: giải nén FULL SOURCE và `RUN-WINDOWS.cmd`. Cần FFmpeg, Tesseract + gói ngôn ngữ nếu chọn OCR, Whisper khi không có SRT, giọng Việt được cài/kết nối và Worker dịch thực.
