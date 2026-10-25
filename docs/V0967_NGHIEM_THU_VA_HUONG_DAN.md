# AI Project OS v0.9.67 — bàn giao source có kiểm chứng

## Đã tích hợp

- Tiếp tục nền **v0.9.66 full source**, không xây dựng lại: cấu trúc 10 tab, đội AI nhiều thành viên theo vai trò, giao việc ở Trưởng phòng, dashboard và 3D hiện có.
- Sáu skill điều phối dự án từ nhánh v0.9.67: Project Manager, Requirements to Spec, Task Dispatcher, Checkpoint Resume, Quality Gate, Delivery Manager. Skill là chỉ dẫn; không tự tạo hoặc cấp quyền chạy worker.
- Radar tin mở qua event listener tương thích CSP (không dùng inline `onclick`).
- Idea Studio nhận văn bản TXT/MD/JSON/CSV (<=64KB đưa vào chat), ảnh PNG/JPEG/WebP (<=20MB), video MP4/MOV/M4V/WEBM (<=150MB) qua API upload đã có và bảo vệ bằng phiên cục bộ. Ảnh/video chuyển sang Media Studio; ảnh được nhớ theo dự án trong localStorage, bytes lưu ở media workspace cục bộ. **Tải lên không có nghĩa AI đã đọc nội dung ảnh/video.**
- Không ghi đè các vai trò AI cũ khi gán thành viên; màn hình nhóm nhiều Worker, Founder và Reviewer đã vượt qua kiểm thử giao diện.
- 3D: giữ nguyên byte-for-byte **81/81** tài sản đã chốt; bổ sung màn hình báo lỗi WebGL **ngoài** mã hình học, giữ phòng 2D khi GPU không hỗ trợ.
- Media Engine: có đường ra FFmpeg và Concat có điều kiện. Nếu chưa kết nối Concat phải chọn FFmpeg rõ ràng; không âm thầm thay engine. Lời đọc thật cần Piper/giọng Windows hoặc provider đang hoạt động.

## Kiểm tra và bằng chứng

- Node.js: **732 kiểm thử, 731 PASS, 0 FAIL, 1 SKIP** (`npm test`).
- Browser/HTTP: **11 kiểm tra PASS** (nguồn ý tưởng, upload PNG đến Media Studio, đội AI, tách project, nghe thử và xuất video). Dùng Chromium giao diện thật nạp vào bộ kiểm thử cách ly và localhost API thật; tài khoản AI giả lập, không phải đăng nhập thật.
- Đã tạo MP4 H.264 có luồng âm thanh AAC, ảnh đầu vào, phụ đề, âm thanh eSpeak chẩn đoán có nghe được qua FFmpeg **chọn chủ động**. Tệp mẫu: `evidence/recovery-r8/browser/narrated-illustrated-diagnostic.mp4`. Đây là **video kiểm chứng pipeline**, không phải video thương mại về tin tức và **không dùng giọng Piper thật**.
- 7 kiểm tra vòng đời 3D pass dạng DOM fixture. WebGL headless trong môi trường này trả lỗi tạo context; fallback hiển thị thông báo. Ảnh/phim R3 lịch sử nằm trong `evidence/space-studio-r3/`; không xem đó là render Windows đã kiểm thử mới.
- 81 tệp 3D giữ nguyên so với v0.9.66; có biên bản SHA/byte trong `evidence/v0967/`.

## Chạy trên máy Windows

1. Giải nén toàn bộ ZIP, **không chép đè lên thư mục chứa dữ liệu người dùng**. Đọc README.md về yêu cầu Node.js/launcher. Giữ bản backup và bảo vệ Vault.
2. Dùng script khởi chạy trong bộ nguồn hoặc bản launcher Windows sẵn có. `AI-Project-OS.exe` trong gói là file gốc v0.9.66 được giữ nguyên, **không phải bản nhị phân Windows v0.9.67 mới build**; source/server là 0.9.67.
3. Mở Vault và gắn tài khoản AI/CLI mong muốn. Muốn dựng video có lời đọc cần cài/cấu hình giọng Việt phù hợp. Bật AI Core, kiểm tra FFmpeg hoặc nối Concat thật trước khi chọn Concat.
4. Idea Studio: kẹp giấy để nhập ảnh/video; Media Studio chọn ảnh của mình, giọng đọc, engine, xuất MP4. Với Concat phải kết nối; nếu chưa kết nối thì chọn FFmpeg. Không chọn API có phí nếu chưa chủ động đồng ý.
5. Kiểm tra trực tiếp trên Windows với tài khoản AI, GPU, loa, cấu hình Concat, Piper/FLUX để nghiệm thu native.

**Trạng thái:** Source QA đã qua; **CHƯA thể xác nhận 100% / chuẩn thương mại** vì chưa chạy native Windows, GPU WebGL thực của máy khách, AI cloud/live, Piper và Concat native. Không có cập nhật nào được đẩy lên GitHub.
