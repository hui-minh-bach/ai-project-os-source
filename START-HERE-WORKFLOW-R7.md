# AI Project OS 0.9.64 - Workflow R7

## Mở bản full

1. Đóng app và cửa sổ Local Worker cũ. Tạo sao lưu có mật khẩu trong tab Hướng dẫn trước khi đổi bản.
2. Giải nén toàn bộ ZIP vào thư mục mới. Không chép vá chồng lên các bản trước.
3. Chạy `RUN-WINDOWS.cmd`, mở Vault bằng mật khẩu cũ. Bản này là source full, không phải EXE cài đặt mới đã ký số.
4. Kiểm tra phiên bản `0.9.64`. Không xóa `%LOCALAPPDATA%\AIProjectOSLocal\data`.

## Luồng làm việc chính

**Nhập ý tưởng/chọn tin -> Trưởng phòng -> phân công AI theo tên -> chốt yêu cầu -> thực hiện và kiểm tra -> Sản phẩm của đội AI.**

- Web/source: bấm **Phân tích và chốt kế hoạch tại đây**, đọc yêu cầu, chọn môi trường kiểm thử, rồi **Duyệt và giao đội làm**. Tải ZIP source ngay dưới khi task đã hoàn tất và review. Bảng sản phẩm phân biệt có/chưa có bằng chứng test.
- Vercel/Supabase/QR: mở mục **Triển khai web, Vercel + Supabase + QR** trong cùng bảng. Dùng token quản trị lưu trong Vault; chốt phạm vi và chi phí trước khi tạo hạ tầng. Liên kết CLI không tự trở thành token cho adapter này.
- Bài viết/video tin: Radar -> chọn lĩnh vực và độ mới -> chọn tin -> app chuyển về Trưởng phòng. Đầu vào chưa được duyệt sẽ không tự chạy.
- Video từ ý tưởng: trong dự án nháp, bấm **Làm video từ ý tưởng này**, sau đó chọn đúng kiểu giọng/video.
- **Nhận sản phẩm** chỉ xác nhận bàn giao tại máy, không đăng lên mạng xã hội. Nhật ký kỹ thuật nằm trong mục thu gọn.

## Giọng đọc và công cụ

Có Local Worker không đồng nghĩa đã có FFmpeg và giọng đọc. App kiểm tra trước khi tạo lượt video. Chọn **Video chữ - KHÔNG lời đọc** chỉ khi đó là đúng sản phẩm cần làm. Không có giọng thì app không giả vờ đã đọc và không tự dùng API trả phí.

Piper/Kokoro cần binary/model đã cài. Adapter Windows chỉ dùng giọng SAPI tiếng Việt có sẵn; chưa có bằng chứng nghiệm thu adapter này trên Windows. HeyGen/FPT là lựa chọn riêng, có chi phí theo tài khoản.

Thiếu Git hoặc FFmpeg: dùng `INSTALL-CODE-TOOLS-WINDOWS.cmd` / `INSTALL-VIDEO-TOOLS-WINDOWS.cmd` và đọc xác nhận cài phần mềm. Docker cần daemon và image đã chuẩn bị. **Host** chạy mã AI tạo trên máy thật, chỉ chọn khi hiểu và đồng ý rủi ro.

## Radar và khôi phục

**+ Thêm lĩnh vực** -> nhập tên -> **AI hiểu lĩnh vực & gợi ý từ khóa** -> kiểm tra/lưu. AI chỉ mở rộng truy vấn, không tự tạo tin. Nguồn đã tắt không bị app bật lại. Nguồn lỗi/không có tin là hai trạng thái riêng; không cam kết bao phủ toàn bộ Internet.

Lỗi AI: giữ lại công việc, dùng AI dự phòng trong phạm vi đã cấu hình. Lỗi sản xuất: dùng **Thử lại đúng lượt này**, không bấm tạo dự án trùng. Khóa Vault sẽ chặn tải tệp sản phẩm. Robot giữ ghế khi cùng nhiệm vụ còn đang chờ; không giả gõ phím trong khoảng chờ.

## Phạm vi kiểm tra

Xem `evidence/reception-r7/verification.json` và `docs/ACCEPTANCE_WORKFLOW_R7.md`. Các bài kiểm tra cục bộ dùng AI/cloud giả lập; file, Git, npm test và MP4 FFmpeg là kết quả thực tế. Chưa nghiệm thu tài khoản thật, chi phí cloud, GPU/Windows, ký số và vận hành khách hàng. Không gọi bản này là phần mềm hoàn hảo cho mọi ý tưởng A-Z.
