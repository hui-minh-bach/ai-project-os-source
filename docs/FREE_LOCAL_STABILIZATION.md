# AI Project OS – Ổn định luồng miễn phí (tích hợp vào source 0.9.66)

## Giao đúng một bộ source, giữ nguyên phần đã duyệt
Đợt này không dựng lại căn phòng 3D, không thay đăng nhập/Vault hoặc cài thêm engine ngoài. Không tự tải model nặng, không tạo dự án cloud và không gọi API trả phí. Các module tạo sản phẩm hiện có được giữ nguyên, chỉ sửa các đường sử dụng cụ thể được liệt kê dưới đây.

## Những thay đổi kiểm được trong source
1. **Chặn API ảnh có phí vượt quyền**: `media.image` không còn đặt `allowPaid=true` vì người dùng chỉ chọn một provider. Chọn `openai-api` hoặc `gemini-api` mà chưa duyệt chi phí bị từ chối ngay khi giao task.
2. **Tiếp tục đúng cảnh ảnh**: mỗi scene có receipt gắn hash yêu cầu và hash bytes ảnh. Khi scene 1, 2 hoàn thành nhưng scene 3 lỗi, chạy lại cùng task sẽ dùng lại ảnh đã kiểm chứng. Đổi prompt hoặc thay bytes file khiến cache mất hiệu lực. Bấm hai lần đồng thời cùng cảnh chỉ chạy một tác vụ tạo ảnh; yêu cầu khác cho cùng cảnh bị giữ lại.
3. **Nhập ComfyUI không cần chép AppData**: vào Engine Hub > Công cụ miễn phí trên máy, chọn JSON đã `Export (API Format)` và bấm `Lưu workflow local`. File phải có node `SaveImage` và `__AIOS_PROMPT__`, giới hạn 2MB. Cập nhật chỉ được phép khi mở Vault, kiểm tra JSON trước khi ghi và không tự chạy model.
4. **Miễn phí trước**: ComfyUI hoặc FLUX đã cài không cần checkbox chi phí API. Nếu chọn tài khoản ảnh có phí phải đồng ý riêng; không âm thầm chuyển sang API trả phí khi local lỗi.
5. **Giữ đúng tên khả năng**: ComfyUI trong bảng công cụ hiện chỉ là adapter tạo ảnh; chưa nhận là bộ dựng video động Wan2.2 đã tích hợp.

## Quy trình kiểm tra tại Windows
- Sao lưu dữ liệu ứng dụng trước, không xóa `%LOCALAPPDATA%\AIProjectOSLocal\data`.
- Giải nén ZIP full ra thư mục mới, chạy `RUN-WINDOWS.cmd`, mở Vault.
- Vào Engine Hub > `Kiểm tra công cụ miễn phí`. Nếu chưa có ComfyUI, cài từ repository chính thức của ComfyUI dưới dạng chương trình độc lập. Các model là tệp riêng, cần máy có RAM/GPU phù hợp và giấy phép phù hợp với thương mại.
- Trong ComfyUI, xây workflow có node SaveImage, chèn `__AIOS_PROMPT__` trong input prompt, xuất API Format JSON. Import qua nút mới ở Engine Hub.
- Kiểm tra trạng thái xanh khi ComfyUI đang mở ở 127.0.0.1:8188.
- Tạo video: trong Idea Studio hoặc Video Studio, chọn Nguồn ảnh: Tự động (local trước); chọn giọng tiếng Việt đã cài Windows hoặc giọng local có sẵn; xuất bằng FFmpeg hoặc Concat nếu đã kết nối. Nếu không có model/giọng/Concat, app phải báo lỗi rõ trước khi tiêu phí.
- Mọi file sau thử nghiệm chỉ là sản phẩm khi có ảnh/giọng/video bytes thật; không dùng demo giả làm ảnh do AI tạo.

## Bằng chứng kiểm thử
- Cú pháp: 190 file JS/MJS/CJS đạt.
- Bộ test trọng tâm: 40/40 đạt (image routing, Concat, voice fixtures, resume).
- Bộ test security/customer/3D/launch: 36/36 đạt.
- Bộ kiểm thử import workflow HTTP thực: 1/1 đạt, cookie + Vault bắt buộc, workflow lỗi từ chối với HTTP 400.
- `npm run verify:media-e2e`: tạo được `final.mp4` từ media fixture bằng FFmpeg. Media và TTS trong những ca này là fixtures, không phải bằng chứng image/giọng Windows hoặc Wan thật.
- Hệ thống đầy đủ vẫn còn `commercialReady=false`: thiếu Windows máy sạch, người dùng thật, chạy các công cụ local trên Windows thật, GPU/WebGL, quyền phân phối và thử nghiệm dài ngày. Bộ test tổng một lần gặp tiến trình treo, KHÔNG đánh dấu tất cả pass.

## Phạm vi chưa thực hiện và phải ghi nhận
- Chưa chạy GPU FLUX/ComfyUI/Wan2.2 thật trong môi trường hiện tại; đặc biệt chưa nối tự sinh video động Wan2.2 vào timeline. Concat native và tiếng Việt Windows chưa được nghiệm thu trực tiếp trên Windows.
- Chưa thể bảo đảm tự tạo **mọi** web/app A-Z hoặc host miễn phí vĩnh viễn. Quyền cloud, OAuth, người dùng và chi phí cần kiểm tra riêng.
- Phần mềm miễn phí không đồng nghĩa máy/GPU/dung lượng/hosting/giấy phép model đều miễn phí. ComfyUI là GPL-3.0, Concat là AGPL-3.0; đang được dùng như các chương trình độc lập, không nhúng mã nguồn của chúng vào gói này.
- Không giới thiệu bản này là EXE đã nghiệm thu thương mại. Đây là source tích hợp đã sửa và QA tại Linux để người dùng kiểm thử tiếp bằng chính Windows của mình.
