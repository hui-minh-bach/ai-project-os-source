# AI Project OS — Bộ công cụ miễn phí chạy trên máy (bổ sung cho v0.9.66)

**Trạng thái:** Source tích hợp để thử nghiệm, **không phải bộ cài Windows đã nghiệm thu thương mại**. Phòng 3D và những phần đã duyệt được giữ nguyên.

## Đã bổ sung vào ứng dụng

- **Engine Hub → Công cụ miễn phí trên máy → Kiểm tra công cụ miễn phí:** kiểm tra khả năng đáp ứng tại chỗ của FLUX.2 Klein 4B, ComfyUI, Ollama, OpenCode, giọng nói Windows, FFmpeg và Concat. Không gọi API có phí và không tự tải model nặng.
- **Video Studio → Nhà cung cấp ảnh:** thêm `ComfyUI local`; lựa chọn `Tự động` ưu tiên ComfyUI được cấu hình và đang hoạt động, rồi đến FLUX local đã cài, rồi mới đến các tài khoản có quyền tạo ảnh. **API có phí không được gọi khi chưa duyệt `allowPaid`.**
- **ComfyUI qua HTTP loopback:** gửi yêu cầu vào workflow API do người dùng thiết lập, lấy ảnh PNG/JPEG/WebP có byte thật, lưu vào dự án; lỗi ComfyUI không được thay bằng ảnh giả.
- Giữ nguyên **giọng Windows, OpenCode, Concat, Local Worker, quy trình review và bàn giao web** đã có trong source gốc. Công cụ mới là tùy chọn, không thay chúng.

## Thiết lập lần đầu trên Windows

1. Giải nén bộ source vào **thư mục mới**, không đè dữ liệu cũ; chạy `RUN-WINDOWS.cmd`, mở Vault như bình thường.
2. Vào **Engine Hub**, bấm **Kiểm tra công cụ miễn phí**. Mục nào chưa sẵn sàng thì cài riêng từ website/repo chính thức của mục đó.
3. **Cách A, tạo ảnh bằng FLUX local:** nếu máy có tài nguyên đủ, vào mục Local Workers để tải/cài FLUX.2 Klein 4B theo quyền đã duyệt. Bộ model có thể rất lớn, không được app âm thầm tải.
4. **Cách B, tạo ảnh bằng ComfyUI:** cài ComfyUI độc lập, chạy trên `http://127.0.0.1:8188`. Trong ComfyUI tạo workflow tạo ảnh có nút **SaveImage**, xuất **API Format JSON**, thay text prompt trong node bằng `__AIOS_PROMPT__`. Lưu ở:

   `%LOCALAPPDATA%\AIProjectOSLocal\data\free-stack\comfyui-image-api.json`

   Chọn model cụ thể có giấy phép phù hợp (không phải model nào trong ComfyUI cũng được bán sản phẩm thương mại). Nếu cần dùng workflow nơi khác, biến môi trường `AIOS_COMFYUI_IMAGE_WORKFLOW` phải trỏ tới file JSON tuyệt đối. Bridge chỉ kết nối HTTP localhost, không mở ComfyUI ra Internet.
5. Ở **Video Studio**, chọn **Nhà cung cấp ảnh → Tự động** hoặc **ComfyUI local** để kiểm tra; chọn giọng Windows tiếng Việt hiện có rồi dùng Concat độc lập/FFmpeg theo quy trình đã có để dựng video.
6. **Tạo website/app web không tính phí API:** cài Ollama với model phù hợp giấy phép và OpenCode, kết nối model Ollama local qua adapter hiện hỗ trợ, rồi giao Worker + Reviewer trong Idea Studio. App có thể tạo và kiểm tra mã trong workspace; **không có bảo đảm model nhỏ sẽ lập trình được mọi loại sản phẩm**, và việc đưa website lên mạng vẫn tùy nhà cung cấp gói miễn phí.

## Repository nguồn chính thức và giấy phép

| Công cụ | Repository | Điều kiện quan trọng |
|---|---|---|
| FLUX.2 Klein 4B | https://github.com/black-forest-labs/flux2 | Model 4B Apache-2.0; **không tự mặc định** model 9B/dev là miễn phí thương mại |
| ComfyUI | https://github.com/Comfy-Org/ComfyUI | GPL-3.0; chạy như ứng dụng độc lập, không nhúng mã vào bộ source này |
| Wan2.2 | https://github.com/Wan-Video/Wan2.2 | Apache-2.0; cần GPU mạnh; **bản này mới đề xuất, chưa nối pipeline video AI Wan2.2** |
| OpenCode | https://github.com/anomalyco/opencode | MIT; vẫn cần model coding + kiểm soát quyền chạy lệnh |
| Ollama | https://github.com/ollama/ollama | Runtime MIT; **từng model có giấy phép riêng** |
| Concat | https://github.com/jub0t/Concat | AGPL-3.0; có JSON-RPC/MCP, kiểm tra nghĩa vụ phân phối |
| FFmpeg | https://ffmpeg.org | LGPL/GPL tùy cách build và codec |
| bolt.diy | https://github.com/stackblitz-labs/bolt.diy | Source có phép riêng, **WebContainers có thể yêu cầu cấp phép thương mại**; không chọn làm lõi sản phẩm bán |

## Điều không được hiểu lầm

- Miễn phí phần mềm/API tại chỗ **không phải** miễn phí GPU, RAM, điện, ổ cứng, hosting hoặc tên miền.
- **Antigravity chỉ có thể tạo ảnh nếu adapter và quyền tạo ảnh thật đã được xác minh**; không tự nhận model text là model ảnh.
- Việc **ComfyUI trả ảnh mẫu trong QA** được mô phỏng bằng API local kiểm soát: **chưa thử trên máy Windows của ông với model thật**. Concat/Windows Voice/GPU/real cloud cũng chưa nghiệm thu từ môi trường này.
- Không có trình tự A–Z tuyệt đối cho **mọi** web/app; chỉ những loại dự án có runtime, quyền và acceptance test phù hợp mới có thể hoàn tất trọn luồng.
- Không gửi ZIP này thay thế installer thương mại; kiểm tra Windows thật, bảo mật, quyền phân phối và người mới sử dụng trước khi bán.

Chi tiết thay đổi và bằng chứng test nằm tại `docs/FREE_LOCAL_STACK_INTEGRATION.md` và `evidence/free-local/qa-report.json` trong cùng ZIP.

## Bổ sung: ổn định nguồn ảnh miễn phí
Bản source này có thêm **Engine Hub → Chọn file JSON workflow ComfyUI → Lưu workflow local**; không cần tự chép JSON vào AppData nữa. File cần `SaveImage` và `__AIOS_PROMPT__`. Mỗi phân cảnh có nhận diện và hash để tránh tạo lại khi tiếp tục sau lỗi; bấm nhiều lần cùng cảnh không lập thêm lời gọi tạo ảnh. Chỉ những API ảnh trả phí được duyệt rõ mới có thể chạy. Đọc `docs/FREE_LOCAL_STABILIZATION.md` về giới hạn Windows và kiểm thử.
