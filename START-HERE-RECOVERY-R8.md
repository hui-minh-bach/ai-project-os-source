# AI Project OS v0.9.65 - Recovery R8

## Mở bản mới
Sao lưu dữ liệu trong app; đóng app và Local Worker cũ. Giải nén ZIP vào thư mục mới, chạy RUN-WINDOWS.cmd. Không xóa %LOCALAPPDATA%\AIProjectOSLocal\data. Không chép bản vá cũ vào R8. Kiểm tra phiên bản server 0.9.65.

## Nhập nguồn
Project Map: Ý tưởng mới / Từ GitHub / File trong máy. Nút mở đúng chế độ Idea Studio, không nới lỏng bảo mật trình duyệt. File trong máy là tệp văn bản yêu cầu (.txt/.md/.json/.csv), không phải trình nhập mọi ZIP source. GitHub dùng luồng nhập kho mã sẵn có; chưa kiểm thử tài khoản GitHub thật trong R8.

## Phân nhiều AI
Trong Trưởng phòng, chọn Phân công đội AI theo tên. Đánh dấu nhiều thành viên ở từng nhóm rồi Lưu toàn bộ đội. Chọn thêm không ghi đè người trước. Tab Kết nối cũng thêm/xóa được từng thành viên.
- Trưởng phòng đầu tiên chủ trì, những thành viên sau là dự phòng.
- Council phản biện qua nhóm đã chọn. Các task độc lập được chia qua Worker; một task chỉ có một Worker hoạt động tại một thời điểm.
- Reviewer không dùng đúng cặp tài khoản/model đã làm task. Ưu tiên chọn tài khoản khác để tách hạn mức; nhiều model cùng tài khoản vẫn dùng chung hạn mức.
- Giữ giới hạn song song 1-4 và chốt quyền/chi phí. Không nhân bản một task để cho nhiều AI ghi đè lẫn nhau.

## Video có ảnh và lời đọc
Chọn tin hoặc ý tưởng video, phân tích tại Trưởng phòng. Chọn giọng, bấm Nghe thử, chọn nguồn ảnh, chốt chi phí và làm sản phẩm.
- Ảnh của tôi: PNG/JPEG/WebP, tối đa 24 ảnh, mỗi ảnh 20 MB; cần có quyền sử dụng.
- AI tạo ảnh: cần kết nối thật có quyền tạo ảnh và đồng ý hạn mức/phí. Ảnh tạo là minh họa, không phải ảnh hiện trường.
- Local Worker không tự có model giọng. Nút Cài / chọn giọng Việt local hỗ trợ cài một lần trên Windows x64 hoặc chọn Piper đã cài. Xem docs/LOCAL_VOICE_R8.md về nguồn và giới hạn.
- Giọng Windows tiếng Việt đã cài, FPT/HeyGen đã cấp quyền là lựa chọn khác. Không tự chuyển sang dịch vụ trả phí.
- Thiếu ảnh/giọng hoặc nguồn lỗi sẽ báo rõ; không âm thầm thế ảnh phong cảnh hoặc xuất video câm.
- Bảng trên giữ phân công/tiến trình; bảng Sản phẩm chỉ hiện kết quả thực tế. Nhận sản phẩm không tự đăng công khai.

## Phạm vi xác minh
Bản source sửa các lỗi R8, không phải bộ cài EXE mới đã ký số. Test AI/cloud là dữ liệu cô lập. MP4 kiểm thử dùng giọng chẩn đoán eSpeak, không phải giọng Piper thần kinh đã nghiệm thu trên Windows. Chưa xác nhận Windows/GPU, tài khoản AI/cloud thật, hay toàn bộ app A-Z thương mại. Chi tiết: evidence/recovery-r8/verification.json.
