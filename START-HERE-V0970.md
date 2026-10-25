# AI Project OS v0.9.70 — Gói source đầy đủ + skill/repo/MCP + kiểm tra A–Z

Giải nén vào một thư mục mới, chạy **RUN-WINDOWS.cmd**. Giữ nguyên thư mục dữ liệu ứng dụng hiện có. Launcher EXE cũ vẫn được giữ lại; đây là bản source mới, không phải bộ cài EXE Windows mới đã ký số.

## Phần đã thêm

- 83 bộ skill được chép kèm SKILL.md và các tài liệu/scripts đi kèm có sẵn. Vào **Skill Hub → Kho tích hợp đi kèm** để đọc toàn văn; chọn **Dùng làm skill trong app** để tạo bản chỉnh sửa, gán vai trò và dùng với công cụ của app. Bản gốc vẫn được giữ nguyên. Chỉ phần hướng dẫn đã thích ứng được đưa vào prompt, tối đa 5.000 ký tự theo giới hạn skill hiện có; tài liệu gốc không bị cắt.
- 13 repo công khai được đóng gói dưới dạng ZIP source, có commit và SHA-256 trong `integrations/catalog/repos.json`; không có model weights hoặc các runtime tự cài. Gói giữ nguyên giấy phép và source của từng repo. Repo được đóng gói để tham khảo/tích hợp, không có nghĩa mọi framework đã có adapter thực thi. Concat adapter đang dùng bản 0.2.x đi kèm; snapshot repo mới không tự thay runtime này.
- Danh mục 649 mô tả công cụ của môi trường ChatGPT. Các dịch vụ này chạy trên máy chủ riêng và cần kết nối riêng; gói không chứa mã máy chủ, tài khoản hoặc phiên đăng nhập của chúng.
- Kết nối MCP HTTP trong Skill Hub: lưu endpoint và token vào Vault, kiểm tra `tools/list`, chọn dự án, xem tham số và duyệt một lệnh `tools/call`. Có xử lý JSON/SSE, timeout, protocol 2025-11-25 / 2026-07-28 và biên nhận chống chạy trùng. Chưa có trình cài MCP stdio, tự đăng nhập OAuth MCP hoặc quyền cho AI tự gọi mọi tool.

## Phần đã sửa khi chạy kiểm tra

- Khôi phục mã QR website tại khu bàn giao, có nút tải QR.
- Luồng lồng tiếng giữ lựa chọn giọng Windows; xử lý `auto/windows` thống nhất thay vì ép sang Piper.
- Dùng một phiên bản Facebook Graph API thống nhất cho OAuth, lấy Page, tải video và số liệu. Mặc định v26.0; có biến cấu hình `AIOS_FACEBOOK_GRAPH_VERSION` cho môi trường đã được chủ tài khoản xác minh. Mốc mặc định đối chiếu với cấu hình SDK chính thức của Meta; không coi mock là nghiệm thu API thật.
- `npm test` chỉ chạy các bài kiểm tra của ứng dụng trong từng bản sao source cô lập. Không tự chạy test/script của các skill và repo bên ngoài; dữ liệu kiểm tra có thư mục riêng, kể cả khi chạy trên Windows.

## Kết quả và cách dùng

Mở **docs/BAO_CAO_V0970.html** để xem kết quả, giới hạn và bằng chứng. Các luồng đã chạy gồm đội 16 Worker + Reviewer, website từ ý tưởng đến source/QR, bài viết, tin tức, video có lời đọc, lồng tiếng, MCP, toàn bộ trang điều hướng và đăng video YouTube/Facebook/TikTok giả lập. Bài viết tin tức hiện được giao dưới dạng Markdown/bản nháp cục bộ; không tự nhận là đã đăng bài chữ lên Facebook.

Để làm việc thật, mở Vault và cấu hình AI, giọng đọc, ảnh và các tài khoản xuất bản của bạn tại máy đang dùng. Chọn đúng công cụ đã cài. Mọi lần đăng thật vẫn qua bước duyệt. Những tài khoản và máy chủ trong bài kiểm tra đều là fixture cục bộ, không được đưa vào cấu hình khởi chạy thông thường.

**Phân biệt nghiệm thu:** mã ứng dụng, Git, FFmpeg, file và trình duyệt được chạy thật; AI, STT/TTS hệ điều hành, sinh ảnh, Concat, cloud và mạng xã hội dùng dịch vụ giả lập có nhãn. Chưa kiểm thử cài đặt Windows, đăng nhập tài khoản AI thật, API mạng xã hội thật hoặc chất lượng sản phẩm với khách hàng thật. `commercial_ready` tiếp tục để `false` cho đến khi có các bằng chứng đó.

Gói tương đối lớn vì chứa đầy đủ 13 kho source theo yêu cầu. Không cần giải nén các ZIP trong `vendor/repo-snapshots` để chạy AI Project OS; chúng không được tự cài hoặc tự thực thi.


## Gói source và gói tài nguyên upstream
ZIP chính giữ nguyên source ứng dụng, toàn bộ tài nguyên phòng 3D, các skill/scripts và mã của 13 repo. Chỉ ảnh/video minh họa, âm thanh ví dụ và model kiểm thử của upstream được đưa sang `AI_Project_OS_v0.9.70_UPSTREAM_ASSETS.zip` để gói có thể lưu và tải được. Không có file mã nguồn hoặc giấy phép nào bị loại. Các tài nguyên này được giữ nguyên byte và có SHA. Dùng `python RESTORE_UPSTREAM_REPOS.py <đường-dẫn-gói-assets.zip>` nếu cần dựng lại đầy đủ kho upstream để nghiên cứu; thao tác này tạo thư mục mới, không cài hoặc chạy repo.
