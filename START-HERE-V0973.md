# AI Project OS 0.9.73

1. Dừng cửa sổ Local Worker/app cũ bằng Ctrl+C; đóng tab chưa dừng server.
2. Giải nén bản full này, chạy RUN-WINDOWS.cmd. Giữ nguyên dữ liệu AppData và các model đã cài.
3. Mở dự án cũ và thử lại lượt bị lỗi. Các cảnh đã tạo được giữ trong cache; không cần tạo dự án mới.

## Thay đổi

- Bỏ form “Nhận yêu cầu dịch vụ của khách”. “Kết quả dự án” nằm tại vị trí đó và chỉ liệt kê file đã được tạo.
- “Trưởng phòng tiếp nhận” hiện lời trả về công khai của Worker/Reviewer, tên tài khoản và model; tiến độ thực hiện nằm ở dải trạng thái riêng trong cùng khung. Không tạo lời thoại giả hay hiển thị suy luận riêng.
- Worker/Reviewer giữ ghế và nhãn “Đang làm việc” trong lúc dự án còn dựng ảnh/video. Kết thúc một lần gọi model không kết thúc cả dự án. Nếu model dự phòng thực sự nhận việc, việc được gắn cho đúng tài khoản đó.
- Sửa kênh Codex từng ngắt JSON vượt 2 MB: phản hồi ảnh hợp lệ được xử lý riêng với giới hạn hữu hạn. Nhận ảnh từ item, turn hoặc savedPath hợp lệ. Kiểm tra khả năng tạo ảnh của phiên tài khoản; thông báo lý do an toàn theo từng nguồn thay vì chỉ IMAGE_PROVIDER_ERROR.
- Không tự chuyển sang API trả phí. Đăng nhập chat thành công không bảo đảm phiên có quyền tạo ảnh. Nếu nguồn không hỗ trợ hoặc hết hạn mức, app báo đúng lý do; không giả ảnh thành công.

## Phạm vi đã kiểm tra

Xem evidence/v0973: kiểm tra transport với PNG hợp lệ trên 2 MB; trình duyệt Chromium/WebGL và FFmpeg thực, giữ ghế qua 240 giây giả lập, xuất MP4 và tải lại trang. AI và dịch vụ ảnh trong luồng kiểm thử là fixture; âm thanh dùng lại mẫu QA đã lưu, không phải gọi tài khoản thật của bạn. Chưa nghiệm thu tài khoản tạo ảnh thật hay máy Windows của bạn; chưa chứng nhận hoàn thiện thương mại.

Một file FULL_SOURCE đủ source chạy app; không cần UPSTREAM_ASSETS để chạy. Có 83 bộ skill, 13 snapshot repo và 649 tham chiếu công cụ host; tham chiếu MCP không đồng nghĩa sao chép dịch vụ hay phiên đăng nhập. Model/engine ngoài vẫn cần được cài và cấp quyền tương ứng.
