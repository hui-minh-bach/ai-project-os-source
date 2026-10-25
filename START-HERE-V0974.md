# AI Project OS 0.9.74 — GitHub và kênh mạng xã hội

Dừng app/Local Worker cũ bằng Ctrl+C, giải nén bản full và chạy RUN-WINDOWS.cmd. Không xóa AppData, dữ liệu hay model đã cài. Chỉ cần một file FULL_SOURCE; không cần UPSTREAM_ASSETS để chạy app.

## Tiếp tục dự án GitHub

- Idea Studio → Từ GitHub → dán link repo vào **Repo GitHub cần làm tiếp**, hoặc nạp danh sách và chọn repo. Ô Vercel chỉ dùng tên/link dự án Vercel, có thể để trống. Ảnh lỗi của bạn đang đặt link GitHub trong ô Vercel.
- App xác minh GitHub rồi tải code với xác thực riêng cho tiến trình; không mở trình hỏi mật khẩu Git ẩn hoặc sửa credential helper toàn máy. Dùng clone nông cho nhánh mặc định, bỏ tự tải LFS để không bị chặn bởi tài nguyên lớn; không tự chạy npm install hoặc script trong repo.
- Tiến độ được lưu và tiếp tục theo dõi khi tải lại trang. Clone có hạn thời gian; thất bại không tạo dự án trống. Nhập xong app tự chọn chính xác dự án mới, đọc hướng dẫn/issue/TODO và sao chép đội AI đã xác minh từ dự án đang chọn. Nếu phân công hết hiệu lực, app báo cần xác minh lại.
- Giao việc và trao đổi trong Trưởng phòng tiếp nhận. Việc viết/chạy code vẫn qua quy trình yêu cầu/spec và cổng duyệt hiện có. Đã nhập repo không có nghĩa đã hoàn tất các việc trong repo.
- Repo đã nhập có nút **Mở dự án**. Nút **Đẩy lên GitHub (tạo Pull Request)** là hành động riêng; import không tự push, deploy hay sửa repo trên GitHub.

Cảnh báo Windows trong ảnh nhắc Bonjour/mdnsNSP.dll bị bảo vệ LSA chặn. Bản source này không gỡ Bonjour, không sửa Winsock/registry và không tắt LSA. Chưa xác nhận cảnh báo đó là nguyên nhân máy bạn bị kẹt; sửa app loại bỏ luồng clone chờ đăng nhập ẩn. Nếu cảnh báo còn xuất hiện, kiểm tra cập nhật Bonjour từ nhà cung cấp đang dùng, giữ bảo vệ Windows bật.

## Kênh mạng xã hội trong Publish

| Kênh | Phạm vi bản này |
| --- | --- |
| YouTube, Facebook Page, TikTok | Giữ bộ đăng video/vòng khép kín và OAuth đã có; quyền công khai phụ thuộc tài khoản/ứng dụng |
| Threads | Kết nối access token, xác minh tài khoản, đăng bài chữ tối đa 500 ký tự sau khi duyệt |
| X | User access token có quyền phù hợp, bài chữ; cần đồng ý chi phí API của tài khoản trước khi đăng |
| Zalo OA | Token OA, bài viết có tiêu đề và URL ảnh bìa HTTPS công khai; xác minh mã bài sau khi tạo |
| Instagram, Zalo cá nhân, LinkedIn, Pinterest, Telegram, Discord, Bluesky, Mastodon, Reddit, Snapchat, WhatsApp Business | Lưu bản nháp và tải nội dung .txt để đăng thủ công. Chưa có bộ đăng tự động cho các kênh này |

Chọn dự án, chọn nền tảng, nhập nội dung rồi **Lưu bản nháp**. Kênh API: **Liên kết bằng token** để xác minh, chọn tài khoản của bài → **Xem và duyệt đăng** → đọc đúng tài khoản/nội dung → duyệt. Không cung cấp mật khẩu tài khoản cho app. Token lưu trong Vault mã hóa. Đây là kết nối token thủ công cho ba kênh mới, không phải một nút OAuth cho tất cả nền tảng.

Chỉ ghi đã đăng khi nền tảng trả mã bài xác nhận. Token tiến trình Zalo chưa phải mã bài. Gặp mất phản hồi sau khi gửi thì app đánh dấu chưa rõ, không tự đăng lại; Zalo có thể kiểm tra tiếp đúng tiến trình đã gửi. Xác thực và quyền ghi thật vẫn do nền tảng quyết định. Số liệu chưa lấy được hiển thị “—”, không suy ra lượt xem từ việc đăng bài.

## Bằng chứng và giới hạn

Trong evidence/v0974 có hồi quy toàn app, kiểm tra Git thật với remote cục bộ, nhánh thử/PR bằng CLI giả lập, HTTP/Chromium cho nhập repo và 3 kênh mới. AI, danh tính CLI và API mạng xã hội dùng fixture; không có bài đăng thật hay thay đổi cloud của bạn. Kiểm tra trình duyệt phần GitHub/social không khởi tạo 3D; toàn bộ source/asset phòng 3D được giữ byte-identical với v0.9.73.

Chưa kiểm tra trực tiếp máy Windows, Bonjour, repo riêng tư thật hoặc token xã hội thật của bạn. Chưa chứng nhận hoàn thiện thương mại. Giữ các sửa local voice, ảnh Codex lớn, hội thoại và ghế robot của v0.9.73.
