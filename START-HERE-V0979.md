# AI Project OS v0.9.79 — phục hồi nền nhiều chi tiết

Dừng app cũ, giải nén FULL vào thư mục mới và chạy RUN-WINDOWS.cmd. Giữ dữ liệu/model đang có. Đây là source; chưa nghiệm thu Windows sạch và tài khoản thật.

## Cách dùng
Video Studio → nạp video → Xóa chữ/logo → Mở nguồn → chọn một vùng logo rõ nét → Nền phía sau logo: **Nền nhiều chi tiết — lấy nền sạch từ khung lân cận**. Chế độ tự bật bám chuyển động. Xem đường bám, xác nhận quyền rồi tạo/phê duyệt tác vụ. Hoặc bấm **Dùng vùng này cho Việt hóa 7 bước** để giữ nguyên lựa chọn phục hồi nền khi dịch/lồng tiếng/phụ đề.

App lấy pixel nền thật từ các khung lân cận, căn dịch chuyển camera và yêu cầu hai mẫu nền khớp nhau; không làm mờ rồi báo đã xóa. Báo cáo ghi từng khung tham chiếu/độ sai khác. Nếu không đủ nền sạch sẽ báo thời điểm lỗi, không tự dùng nội suy viền. Với 7 bước, xử lý này hoàn tất trước nhận giọng/dịch/giọng đọc để không tốn hạn mức cho đầu vào không xử lý được.

## Phạm vi
Một vùng, tối đa 30 giây, 720p, 30 FPS; tối đa 1,5 GB dữ liệu khung tạm và cần thêm dung lượng xuất MP4. Tự dọn khung tạm khi xong/lỗi. Camera dịch chuyển nguyên pixel tối đa 24 pixel giữa các khung so sánh. Theo dõi vẫn cần mẫu logo không đổi kích thước. Chế độ nội suy viền cũ vẫn dùng cho nền đơn giản, theo giới hạn .78.

Không cài thêm Python/GPU/model, không phải neural inpainting. Phần nền bị che suốt hoặc vật thể độc lập thay đổi dưới logo không thể khôi phục chính xác từ thông tin chưa từng xuất hiện. Chưa hỗ trợ zoom/xoay/biến dạng lớn. Có thể dừng khi chuyển cảnh hoặc thiếu mẫu; điểm tin cậy không chứng minh nền thật phía dưới vật che. Luôn xem lại kết quả.

## Bằng chứng
`evidence/v0979` chứa video trước/sau, nền gốc sạch, baseline nội suy viền và số đo sai lệch vùng. Có bài thử nền họa tiết/camera dịch chuyển và ảnh vật liệu chụp thực (camera/nhãn tổng hợp có kiểm soát), không phải clip khách hàng tự nhiên. Browser kiểm tra app/server thật tới MP4/receipt/tải/reload. Đợt này không gọi model/ASR/TTS; bằng chứng .77/.78 là lịch sử riêng, không phải nghiệm thu mới.

## File source để tải lên AI làm tiếp
Bản `AI_TEXT_SOURCE.zip` chỉ chứa TXT UTF-8, không chứa EXE/model/video/ZIP lồng hay dữ liệu nhị phân đổi tên/mã hóa. Mọi code/config dạng văn bản có đường dẫn gốc và SHA256, được chia part để đọc dễ hơn. Nếu AI chặn ZIP, giải nén và tải `PROJECT_CORE_FOR_AI.txt` trước rồi các `SOURCE_PART_*.txt` cần thiết. Bản CORE cũng được giao riêng để đính kèm trực tiếp. Không bảo đảm mọi nền tảng nhận ZIP; lưu đúng thông báo lỗi nếu vẫn bị chặn.

Gói TXT không phải bộ cài offline: các tài nguyên nhị phân nằm trong FULL và được kiểm kê, không bị giả thành văn bản. Có thể phục hồi cây source bằng `scripts/export-ai-text-source.mjs --restore RESTORE_INDEX.txt --out /thu-muc-moi-trong` (chạy bằng Node). Công cụ kiểm SHA256, không ghi đè và không thực thi code phục hồi.

## Kết quả đợt này
138 module / 809 bài kiểm tra đạt, không bỏ qua; 220 file kiểm cú pháp đạt. 83 tài nguyên 3D giữ nguyên. Trên ảnh nền gạch chụp thực với camera/nhãn tổng hợp, lỗi pixel trung bình vùng phục hồi: 2,67/255, so với 23,12/255 của nội suy viền (giảm 88,44% trong bài thử này). Không suy rộng số đo này ra mọi video. Gói source TXT thử phục hồi 1.295 file văn bản, đúng checksum, không chứa dữ liệu thực thi nhị phân.
