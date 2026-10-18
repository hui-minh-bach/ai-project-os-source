# HƯỚNG DẪN CÀI MODULE AI MEDIA ENGINE VÀO LOCAL WORKER

## Cảnh báo bảo toàn dữ liệu
Không chép đè tệp `kbl-video-worker.js`, `config.json`, `worker.pid`, Vault, AI Core hay các tab hiện hành. Không tắt Worker đang chạy chỉ để xem video mẫu. Gói này là module tách rời, **chưa được ghép vào AI Core vì mã CoreServices v1 chưa có trong ZIP nguồn**.

## 1. Xem thành phẩm có sẵn
Giải nén ZIP, mở `artifacts/samples/story_720p.mp4` để xem video đọc truyện thử, mở `artifacts/samples/editor_final.mp4` để xem video cắt dựng. File `story_captions.srt` có 24 phụ đề tiếng Việt; `storyboard.json` có timeline 7 cảnh. Mẫu giọng eSpeak là **máy móc**, không phải giọng lồng tiếng tự nhiên chất lượng thương mại.

## 2. Chạy kiểm thử trên Windows
Cài Node.js 20+, FFmpeg và FFprobe, thêm thư mục thực thi vào PATH. Mở PowerShell trong thư mục module:

```powershell
node --version
ffmpeg -version
ffprobe -version
node --test tests/*.test.cjs
```

`npm run demo` cần cài thêm `espeak` có giọng tiếng Việt, hoặc thay demo gateway bằng provider TTS riêng do bạn cho phép. Không có bước nào đòi API trả phí.

## 3. Ghép vào AI Project OS
Người giữ AI Core phải cung cấp đối tượng CoreServices v1 hoặc các phương thức thật tương ứng với `TaskQueue.registerTask`, `ProviderGateway.invoke`, `ArtifactStore.putFile/putJson`, `EventBus.publish`. Sau đó chỉ đăng ký module qua `registerMediaEngine`, ví dụ trong `docs/INTEGRATION.md`. Không yêu cầu sửa backend/router của GPT số 1.

## 4. Bật thêm chức năng khi đã có provider
- STT: cài `whisper.cpp` + model hợp pháp, khai báo qua `ProviderGateway`; `adapters/whisper-cli-gateway.cjs` chỉ là ví dụ phía host.
- TTS tự nhiên: test thực tế giọng Việt nam/nữ, nghe kiểm định rồi mới đổi sang sử dụng. Không báo hỗ trợ nếu engine chưa đọc tốt.
- Ảnh AI: bật `allowProviderImages` và có nguồn ảnh được quyền dùng. Nếu không sẽ sinh tranh phong cảnh procedural ngoại tuyến.
- Concat: mặc định **không dùng**. Chỉ thử loopback token và tương thích phiên bản trước khi bật; FFmpeg vẫn là render chính.
- Publisher: chỉ có tạo nháp. Đăng thật **BLOCKED** cho đến V10, OAuth và kiểm thử API nền tảng thật.

## 5. Quản lý máy yếu
Dựng 720p trước, không bật nhiều tác vụ render song song; bản demo và module giới hạn CPU 2 luồng FFmpeg, 1 tác vụ nặng đồng thời. Với máy yếu hơn chọn `resolution:'360p'`. Muốn 1080p chọn `resolution:'1080p'` và tăng dung lượng trống; đừng cố ép GPU chạy model sinh video nặng.

## 6. Nhận xét nghiệm thu
Bảng `docs/ACCEPTANCE.md` ghi chi tiết PASS/BLOCKED, `artifacts/validation.json` lưu số liệu FFprobe và QA kiểm tra video thật, `SHA256SUMS.txt` ghi mã băm tệp gói. Không coi toàn bộ Nhiệm vụ 02 DONE khi chưa kết nối CoreServices/Whisper và kiểm thử Publisher V10.
