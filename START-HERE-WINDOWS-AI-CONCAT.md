# Bắt đầu: Giọng Windows + AI tạo ảnh + Concat

Phiên bản source: **0.9.66**. Nâng cấp đúng luồng video, không thay phòng 3D.

## Mở bản này
Sao lưu dữ liệu, đóng app và Local Worker cũ. Giải nén vào thư mục mới và chạy RUN-WINDOWS.cmd. Không xóa thư mục dữ liệu %LOCALAPPDATA%\AIProjectOSLocal\data. Mở Vault như cũ; kiểm tra phiên bản 0.9.66.

## Luồng chính
Trong Idea Studio, nhập ý tưởng hoặc chọn tin từ Radar, chọn làm video.
Tại bảng Trưởng phòng:
1. Giọng **Windows**: chọn giọng đã cài và nghe thử. Không cần Piper hay HeyGen cho luồng này.
2. Ảnh **AI tạo theo từng cảnh / Tự phân công**. Có thể xem tên nhóm model được phát hiện. Chỉ bật API ảnh có phí khi đồng ý dùng hạn mức tài khoản đó.
3. Công cụ xuất **Concat**, hiệu ứng **Zoom chậm + mờ vào/ra**. Bấm kiểm tra giọng / ảnh / Concat; lần kiểm tra chưa tạo ảnh tính phí.
4. Chốt và làm sản phẩm. App viết kịch bản, đọc giọng Windows, tạo ảnh, dựng các lớp Concat, xuất và kiểm tra MP4 rồi đưa vào Sản phẩm của đội AI.

Video Studio > Truyện/kịch bản cũng dùng cùng luồng này. Các dự án cũ giữ lựa chọn đã lưu; không tự đổi thành dịch vụ có phí.

## Thiết lập một lần khi thiếu
- Giọng Windows chỉ liệt kê giọng mà SAPI/WinRT thực sự cung cấp. Thiếu giọng Việt: mở nút Giọng Windows, xem hướng dẫn Windows Settings > Speech và kiểm tra lại. Cài bàn phím Việt không đồng nghĩa có giọng Việt. App không tự đọc bằng giọng Anh.
- Concat: nút Kết nối Concat dùng kết nối local đã lưu. Chưa cài thì có nút cài/kết nối sau khi cho phép. Token lưu trong Vault. Đây là Concat editor, không phải chỉ lệnh concat của FFmpeg.
- AI ảnh: làm mới danh mục model trong Kết nối. Model chỉ đọc hiểu ảnh không được coi là model tạo ảnh. Quyền sinh ảnh và hạn mức phụ thuộc tài khoản thực.

## Lỗi và thử lại
AI ảnh A lỗi mạng/hạn mức thì thử B trong nhóm đã cho phép, tối đa 4 lựa chọn mỗi cảnh. Từ chối an toàn thì dừng, không đổi model để né. Giọng/ảnh đã thành công giữ lại trong luợt thử lại. Không âm thầm dùng video câm, ảnh mẫu hay công cụ xuất khác.

## Phạm vi kiểm chứng
Xem evidence/media-pipeline/verification.json. Test chạy app/API/file/FFmpeg thật, nhưng Windows, AI và giao thức Concat dùng bộ mô phỏng cô lập. Video bằng chứng dùng eSpeak và bộ xuất mô phỏng FFmpeg, KHÔNG phải giọng Windows hay Concat native. Chưa nghiệm thu Windows thực, API ảnh thực hay GPU/Concat native. Đây không phải chứng nhận toàn app đạt chuẩn bán thương mại.
