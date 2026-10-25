# AI Project OS 0.9.69 — Nhận đơn khách, làm việc và giao hồ sơ

**Đây là bộ mã nguồn đầy đủ có kiểm thử; không phải bản EXE 0.9.69 đã build/kiểm thử trên Windows, và không chứng minh đã có doanh thu.** Bộ `AI-Project-OS.exe` được giữ nguyên từ bản cũ. Không cài đè lên hệ thống đang kinh doanh.

## Cài đặt và kiểm thử trên máy của bạn

1. Sao lưu cấu hình/dữ liệu đang dùng. Giải nén ZIP vào một thư mục **mới**, không đè thư mục cũ. Chạy `RUN-WINDOWS.cmd` trên Windows có Node.js >=22, FFmpeg và FFprobe. Nếu dùng trình khởi chạy EXE có sẵn, nhớ nó là launcher cũ, không phải bản Windows mới được đóng gói cho 0.9.69.
2. Mở Vault tại máy bạn. Vào **Kết nối**, đăng nhập/xác minh các tài khoản AI thật, gán **Worker** để sáng tác và **Reviewer** dùng kết nối/model độc lập để duyệt. Không nhập khóa API vào chat hoặc file source.
3. Nếu giao **video**, cài một giọng đọc tiếng Việt (Windows/Piper), cung cấp ảnh có quyền sử dụng hoặc thiết lập ComfyUI/FLUX trên máy. Thiết lập Concat cục bộ nếu có; khi không có Concat mà FFmpeg hoạt động, ứng dụng sẽ sử dụng FFmpeg có gắn nhãn công cụ thực tế. Concat không phải bộ tạo giọng; WAV phải được sinh trước.
4. Vào **Idea Studio → Nhận yêu cầu dịch vụ của khách**, điền tiêu đề (không bắt buộc) và brief tối thiểu 30 ký tự, mô tả đúng sản phẩm, đối tượng, thông tin đã xác minh và lời kêu gọi. Bấm **Tạo bài đăng** hoặc **Tạo video có tiếng** một lần.
5. Theo dõi khu **Giao file khi hoàn thành**. Lượt giao việc có trạng thái Worker, Reviewer, các công cụ media; lỗi được báo rõ, không phát sản phẩm giả hoặc tự đăng mạng xã hội.
6. Chỉ khi có `client-delivery.zip` mới là hồ sơ đã qua cổng tự động: có `manifest.json` và SHA-256 các tệp. Với bài viết: `article-final.md`. Với video: `video-final.mp4`, `voice.wav`, `captions.srt`, `captions.vtt` (khi có), `script-final.md`, `thumbnail.png` (khi có).
7. Mở MP4 và kiểm tra **nội dung, người đọc, âm lượng, hình ảnh, phụ đề**, đồng thời xác nhận thông tin bán hàng và quyền sử dụng hình/nhạc trước khi gửi khách. Reviewer AI chỉ đối chiếu văn bản với brief, không phải kiểm định pháp lý.
8. Không bật tự đăng, thanh toán tự động hoặc thuê dịch vụ có phí mà chưa đồng ý từng lần. Việc giao file cho khách hay phát sinh doanh thu là hành động ngoài hệ thống và chưa được xác minh.

## Hai dịch vụ có thể bắt đầu chào bán

- **Bài đăng quảng cáo có kiểm duyệt**: khách cung cấp brief → nhận nội dung Markdown/caption để đăng trên Facebook/Zalo. Không tự sáng tác số điện thoại, giá, ưu đãi, chứng thực hoặc cam kết.
- **Video quảng cáo có lời đọc tiếng Việt**: brief → kịch bản → giọng/ảnh hợp lệ → MP4 có tiếng + phụ đề + thumbnail và file dự án xuất. Chỉ chào bán khi máy của bạn đã chạy thành công bằng provider thật.

Quy định phạm vi việc làm, số lần sửa, thời điểm giao, giá bán và hóa đơn với khách **trước khi nhận tiền**. Phần mềm không tự tạo doanh thu, không làm thanh toán và không có sẵn hệ thống khách hàng online đa người dùng.

**Báo cáo kiểm thử, giới hạn và đường dẫn bằng chứng:** `docs/V0969_CLIENT_SERVICE_ACCEPTANCE.md`.
