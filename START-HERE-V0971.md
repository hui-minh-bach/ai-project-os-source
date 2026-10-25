# AI Project OS 0.9.71 — sửa trạng thái media và tên robot

Giải nén toàn bộ rồi chạy RUN-WINDOWS.cmd. Giữ dữ liệu và tài khoản tại đường dẫn cũ của app; không xóa AppData. Không cần file UPSTREAM_ASSETS để chạy app.

## Sửa trong bản này
- Concat chỉ báo đã kết nối khi API local xác thực và trả lời. Đã tìm thấy bản cài hoặc đã lưu token chưa đủ. Kiểm tra công cụ không tự mở/cài Concat.
- FFmpeg/FFprobe sẵn sàng được báo riêng với giọng đọc. Video có tiếng cần giọng Việt Windows/Piper. Concat Remote hiện tại nhận audio để dựng, không sinh giọng TTS qua adapter này.
- Lỗi MEDIA_VOICE_REQUIRED có nút Cài / kiểm tra giọng Việt và Đã cài giọng · Kiểm tra lại ngay trong khung nhận việc. Việc kiểm tra không tự mua/gọi API trả phí.
- Nhãn robot thu gọn về tên, neo sát đầu robot, đường nối chỉ rõ tài khoản. Chi tiết trạng thái vẫn xem được khi bấm tên. Không thay đổi hình phòng, mesh, camera hay chuyển động.

## Máy đang thiếu giọng đọc
Bấm Cài / kiểm tra giọng Việt trong thông báo lỗi. Nếu dùng Piper, đọc xác nhận tải/chạy rồi chọn cài. Hoặc cài giọng tiếng Việt trong Windows Settings > Speech, sau đó bấm Đã cài giọng · Kiểm tra lại và thử lại việc cũ. Không chỉ cài bàn phím tiếng Việt. Nếu kiểm tra vẫn không nhận giọng, chưa thể xuất video có lời đọc bằng đường miễn phí này.

## Phạm vi kiểm chứng
Xem evidence/v0971: Chromium/SwiftShader thật với GLB thật và tên tài khoản giả lập; HTTP app bình thường, không preload fixture; MP4 qua FFmpeg thật; hồi quy app. Chưa điều khiển máy Windows của chủ ứng dụng, chưa xác nhận giọng Việt hoặc Concat native trên máy đó. Không chứng nhận bản thương mại.
