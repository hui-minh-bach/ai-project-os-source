# AI Project OS 0.9.72 — sửa nhận Local Worker và tiếp tục video

1. Dừng cửa sổ Local Worker cũ (Ctrl+C nếu đang chạy trong cửa sổ lệnh), không chỉ đóng tab trình duyệt.
2. Giải nén bản full này, chạy RUN-WINDOWS.cmd, mở lại app. Không xóa AppData hay thư mục dữ liệu/model đã cài.
3. Tại việc đang bị chặn, bấm **Kiểm tra Local Worker và tiếp tục**. App nhận lại giọng đã cài, thử tạo giọng thật rồi tiếp tục đúng yêu cầu. Không cần tạo lại đơn hàng.

Nếu đúng là chưa có bộ giọng Việt, mở **Cài / kiểm tra giọng Việt**. Chỉ sau khi bạn đồng ý, app mới tải phần giọng còn thiếu. Cài xong app kiểm tra và tiếp tục việc đang bị chặn; không bắt chọn lại engine/giọng cho từng video. FLUX tạo ảnh, ACE-Step tạo nhạc, Windows/Piper tạo lời đọc, FFmpeg/Concat dựng video — đã có một worker không có nghĩa mọi khả năng đều đã được cài.

## Đã sửa nguyên nhân, không chỉ sửa thông báo

- Nhận lại bộ Piper hoàn chỉnh trong thư mục local-voice của app khi mất cấu hình đường dẫn; tìm cả thư mục dữ liệu cũ trước khi nâng cấp. Không quét ổ đĩa, không nhận thư mục đang tải dở.
- Kiểm tra mới engine/model/config, bỏ trạng thái thiếu giọng cũ ngay khi file thay đổi hoặc bấm kiểm tra. Không mặc định ép Windows khi Piper đã sẵn sàng; lựa chọn Windows rõ ràng vẫn được tôn trọng.
- Thử lại một yêu cầu có lượt chạy thất bại bằng cơ chế retry của chính lượt đó. Dùng lại kịch bản/reviewer đã duyệt và cache sản phẩm; không trả mã lỗi cũ từ startRun rồi coi như đã thử lại.
- Sau cài/chọn giọng, kiểm tra và tiếp tục đúng yêu cầu còn bị chặn với mã chống lặp. Nếu chuyển dự án hoặc công việc đã đổi/đã xong thì không tự chạy công việc khác.
- Chấp nhận đúng CDN hiện tại của model Hugging Face, giữ nguyên SHA-256 model đã ghim; tên miền giả vẫn bị chặn. Với engine đã có nhưng thiếu model/config, chỉ bổ sung phần thiếu; không ghi đè file model đã bị thay đổi.
- Có thẻ Piper riêng trong Engine Hub. Không tự gọi giọng/ảnh API có phí, không tự đăng mạng xã hội.

## Bằng chứng hiện tại

Trong evidence/v0972 có báo cáo hồi quy, kiểm tra phát hiện engine/model, MP4 thực sự chứa giọng Việt do Piper ONNX sinh, kiểm tra HTTP và thao tác Chromium. Video real-piper-local-worker.mp4 là bằng chứng kỹ thuật: giọng neural và dựng video là thật; kịch bản AI và ảnh minh họa dùng fixture cục bộ, không phải sản phẩm thương mại hay ảnh sinh từ tài khoản của bạn.

Piper Python/ONNX CPU được chạy trên Linux để xác minh suy luận thật và adapter; chưa phải kiểm tra Piper EXE/SAPI/WinRT trên máy Windows của bạn. Các test Windows discovery/synthesis là fixture riêng được ghi rõ trong log. Không tuyên bố hoàn tất nghiệm thu thương mại hay chứng nhận tài khoản/kết nối thật trên máy khác.

Không cần UPSTREAM_ASSETS để chạy app. Bộ giọng/model đã cài nằm ở dữ liệu riêng trên máy và được giữ lại khi nâng cấp; ZIP này không nhúng các tài khoản hoặc model đang dùng của bạn.
