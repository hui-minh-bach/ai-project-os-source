# HƯỚNG DẪN DÙNG GIỌNG TỰ NHIÊN — LOCAL WORKER v0.5.1

> **Đúng mục tiêu sửa lỗi:** Local Worker không được tự thay giọng TTS tự nhiên bằng giọng `espeak` máy móc mà vẫn báo hoàn thành chất lượng cao. Có hai cách: dùng file giọng tốt có sẵn (hoàn toàn offline) hoặc gọi HeyGen TTS thật qua API riêng (cần kết nối, có thể tính phí). Không tạo âm thanh giả khi không có API.

## 1. Cài và mở chương trình

- Giải nén ZIP vào **thư mục mới**. Không chép đè lên dữ liệu công việc; sao lưu `.data` nếu đang sử dụng bản cũ.
- Trên Windows cài **Node.js 22+** và **FFmpeg** (bao gồm `ffmpeg.exe` và `ffprobe.exe` trong `PATH`). Khởi chạy bằng cách nhấp đúp `start-windows.cmd`.
- Mở `http://127.0.0.1:4321` → Chọn/tạo dự án → **Engine Hub** → **Video & Story Studio**.
- Đầu tiên, ở **Phân tích video**, tải video nguồn lên máy Worker hoặc dùng video mẫu.

## 2. Cách chắc chắn chạy được: THAY GIỌNG THẬT (không cần API)

1. Chọn **Thay giọng thật**.
2. Tải file WAV, MP3 hoặc M4A (ví dụ file giọng tự nhiên `heygen-speech.wav` đã tạo từ HeyGen) và bấm **Nạp giọng đọc**.
3. Nếu cần, tải thêm phụ đề `.srt` đã căn thời gian đúng với tiếng, cùng nhạc nền mà bạn có quyền sử dụng.
4. Chọn **Giữ khung cuối nếu thiếu hình** (không tăng tốc bất ngờ) hoặc **Co giãn tốc độ hình**; chọn âm lượng nhạc 8–30%.
5. Bấm **Tạo tác vụ chờ duyệt**; kiểm tra nội dung → **Phê duyệt & chạy**.
6. Trong **Hàng đợi & kết quả thật**, tải `video-with-natural-voice.mp4`; báo cáo `voiceover-report.json` ghi QA và thời lượng. File được bảo vệ bằng SHA-256.

**Đã kiểm chứng:** dùng file người dùng cung cấp có thời lượng **56,97 giây**, cùng video nguồn/nghệ thuật minh họa, Local Worker đã tự dựng MP4 HD 720p có phụ đề, nhạc, giữ đủ đoạn cuối. Bản demo xuất: `AI_PROJECT_OS_LOCAL_WORKER_GIONG_MC_KHANH_LY_V051.mp4` được gửi riêng.

**Lưu ý:** file giọng đã tạo chỉ dùng cho đúng đoạn đã đọc. Muốn lời thoại mới theo đúng giọng đó phải gọi dịch vụ TTS sở hữu giọng tương thích; phần mềm không thể tạo lời thoại mới bằng cách kéo dài file cũ.

## 3. Kịch bản → giọng đọc AI → MP4 (HeyGen API)

**Điều kiện:** tài khoản HeyGen phải có API key được phép gọi endpoint `POST /v3/voices/speech`, và một **voice ID tương thích Starfish** từ `GET /v3/voices?engine=starfish` (hoặc nhập ID hợp lệ do HeyGen cung cấp). Đăng nhập HeyGen bằng ChatGPT Plugin/connector **không đồng nghĩa** Local Worker đã có API key. API dịch vụ có thể phát sinh phí/hạn mức; phải kiểm tra trước trên bảng điều khiển HeyGen.

Khuyến cáo **không lưu key trong ZIP hoặc JavaScript frontend**. Dùng CMD trên máy Windows để cấu hình riêng cho phiên chạy:

```bat
set "HEYGEN_API_KEY=KEY_API_CUA_BAN"
set "HEYGEN_TTS_VOICE_ID=VOICE_ID_STARFISH_HOP_LE"
start-windows.cmd
```

Hoặc dùng biến môi trường do hệ điều hành quản lý trước khi khởi chạy Worker. Chỉ nhập khóa trên máy tin cậy. Nếu chưa có voice mặc định, dùng nút **Danh sách giọng** sau khi cấu hình key và chọn giọng cho job.

Sau đó: **Phân tích video** → nạp video nền → **AI Tạo giọng từ kịch bản** → dán văn bản tiếng Việt (không quá 5.000 ký tự) → chọn giọng → **Tạo tác vụ chờ duyệt** → chỉ khi bấm **Phê duyệt & chạy** Worker mới gửi văn bản đến API tạo giọng và tải audio. Nếu HeyGen trả timestamps từng từ, Worker tạo SRT đúng mốc, rồi trộn nhạc/xuất MP4. Nếu không trả mốc, có thể nạp SRT chính xác của bạn; Worker không tự bịa phụ đề.

- Endpoint tạo giọng và danh sách giọng đã được lập trình theo tài liệu chính thức; **mới kiểm thử HTTP bằng mô phỏng (mock)**, chưa gọi API bằng tài khoản/khóa thật, chưa bảo đảm mọi giọng/hạn mức gói đều dùng được.
- File `heygen-speech.wav` đã gửi là một đoạn ghi âm được tạo bởi giọng **MC Khánh Ly** ở môi trường HeyGen khác. **Không có đảm bảo chính voice ID ấy hoạt động với Starfish API**; hãy chọn giọng tương thích theo API của chính tài khoản.
- Không cam kết tự sinh cảnh video điện ảnh từ một câu kịch bản; hiện vẫn cần video hoặc hình dựng thành video làm nguồn.

## 4. Giới hạn và an toàn

- Mỗi tác vụ cần phê duyệt riêng. Trong bản này chưa có dự toán phí API theo từng ký tự. Trước khi bấm duyệt, người dùng cần xác nhận chi phí và quyền sử dụng giọng/nhạc.
- Giọng nhập mới **thay** tiếng gốc video; nhạc được trộn ở mức đã chọn.
- Giữ khung cuối khi video ngắn hơn lời đọc, hoặc stretch tốc độ hình theo lựa chọn. Không cắt đoạn giọng cuối.
- Worker hiện chưa nhận diện lời nói STT từ audio, chưa hỗ trợ voice cloning, chưa tự đăng Facebook/TikTok/YouTube, và chưa có exe Windows thương mại.
- Nếu Key/API/FFmpeg lỗi, hiện lỗi thật; không có chế độ âm thanh mô phỏng tự động tráo thay.
- Dữ liệu dự án nằm tại `.data/`; bản ZIP phát hành không bao gồm dữ liệu cá nhân, file audio mẫu của người dùng, hoặc API key.

## 5. Chạy QA (cho người phát triển)

```bat
npm run check
npm test
npm run verify:media-e2e
npm run verify:large-media
```

**Kết quả QA tại thời điểm đóng gói:** 149/149 bài kiểm thử Node đạt; các kiểm tra Media end-to-end/large media độc lập đạt; ca dựng MP4 từ file giọng người dùng thực tế đạt. Việc điều khiển UI trên trình duyệt Windows thật và gọi API HeyGen bằng key thương mại cần thử thêm tại máy đích.
