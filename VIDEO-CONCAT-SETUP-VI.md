## v0.8.4 — Concat được quản lý ngay trong AI Project OS

Khách chỉ thao tác trong AI Project OS: mở Vault → Video & Story Studio → Kế hoạch dựng → mở **Kết nối trình biên tập Concat (một lần)** → bấm **Cài + kết nối Concat tự động**. Nếu chưa có Concat, ứng dụng tự lấy **đúng bản Windows 0.2.7** từ GitHub và kiểm tra SHA-256 trước khi chạy; nếu đã có thì chỉ cấu hình Remote. Token không hiện trong trình duyệt, được lưu trong Vault.

**Bộ cài offline** chỉ có khi nhà phát hành thực hiện quy trình Windows `windows/Build-WorkerC-Internal-RC.ps1`; ZIP nhỏ đi kèm tài liệu này **không chứa tệp Concat 85 MB** vì chưa lấy được tệp đó trên máy build. Người dùng cần Internet lần đầu trên gói ZIP. Nếu bộ cài Concat chưa ký số bị Windows chặn, không được tắt Smart App Control để chạy; sử dụng FFmpeg hoặc yêu cầu bản có chữ ký hợp lệ.

Concat sử dụng AGPL-3.0-or-later và các thành phần giấy phép khác (xem `THIRD_PARTY.md`). Các bước dùng API nhiều track vẫn cần nghiệm thu xuất MP4 trên Concat Windows thật, không đủ cơ sở khẳng định 100% tương thích chỉ từ mock.

---

# Video Studio – Concat + FFmpeg + giọng local (v0.8.2 RC)

## Không bắt buộc HeyGen

Concat chính thức (https://github.com/jub0t/concat) đã có nhiều track, bộ hiệu ứng, Whisper offline, TTS và giọng nhân bản trong **giao diện Concat**. Ứng dụng AI Project OS không yêu cầu HeyGen API để phân tích/dựng video hoặc sử dụng giọng đã tạo.

### Hai cách dùng giọng không tốn API

1. Cài và chạy Concat riêng. Tải model tiếng nói hoặc Whisper trong Concat Settings nếu cần. Trong Concat tự tạo lời đọc, xuất audio WAV/MP3, rồi tại AI Project OS chọn **Thay giọng thật** để nhập âm thanh này. Dựng/xuất MP4 qua FFmpeg/Local Worker, sau khi duyệt tác vụ.
2. Muốn nhập lời thoại trong AI Project OS và tạo giọng **tự động**, cài Piper CLI (phiên bản tương thích) và model ONNX tiếng Việt được cấp phép phù hợp. Thiết lập `PIPER_CLI_PATH` (đường dẫn tới piper.exe), `PIPER_MODEL_PATH` (đường dẫn *.onnx) trên máy; có thể thêm `PIPER_CONFIG_PATH`. Mở lại app để cập nhật trạng thái. Piper chạy local không yêu cầu key hoặc mạng sau khi cài model. Hỗ trợ chất lượng phụ thuộc model.

HeyGen vẫn là tiện ích **tùy chọn trả phí**, chỉ dùng khi người dùng chọn rõ nguồn giọng HeyGen và phê duyệt tác vụ. Không tự dùng API để sinh giọng.

### Kết nối Concat

- Cài từ https://github.com/jub0t/concat/releases, bật Settings → Remote. Giữ API trên 127.0.0.1:7420 và sao chép token vào Vault của AI Project OS.
- Bấm **Kiểm tra kết nối thật** trước khi dùng. Concat là **trình biên tập chạy riêng**, không đóng gói lại mã Concat.
- JSON-RPC API v0.2 chỉ công bố các lệnh project, edit, media, catalogue, template, export và preview; **không công bố API TTS hoặc Whisper**. Vì vậy AI Project OS hiện tạo dự án Concat từ video đã dựng và không tự gọi các chức năng giọng/phụ đề qua RPC. Đừng nhầm nút kết nối thành “TTS tự động đã sẵn sàng”.
- FFmpeg vẫn là engine xuất MP4 tự động hiện có. Việc AI tự tạo timeline nhiều lớp Concat và gọi giọng Concat trực tiếp chưa nghiệm thu với Concat thật.

### Phụ đề

- Muốn tự tạo phụ đề tại AI Project OS cần whisper.cpp CLI và model cài trên máy (`WHISPER_CLI_PATH`, `WHISPER_MODEL_PATH`). Phụ đề tạo từ âm thanh sau khi thay giọng, không tự đoán mốc.
- Hoặc tạo phụ đề trong Concat rồi xuất SRT, tải SRT lên **Thay giọng thật**.

### Bản quyền

Concat phát hành theo **AGPL-3.0-or-later**. AI Project OS không đóng gói, sửa hoặc liên kết mã Concat vào ứng dụng; chỉ giao tiếp với Concat đã được người dùng cài riêng qua giao diện RPC công khai. **Chưa xác minh có ngoại lệ thương mại riêng**; trước khi phát hành bán cần rà soát pháp lý giấy phép AGPL và model giọng đã chọn. Không đưa Concat hay model giọng vào ZIP bán khi chưa được phép.

### Trạng thái

Đây là bản RC, chưa nghiệm thu trên Windows sạch với Concat đang chạy và model giọng thật. Không được coi là bộ dựng AI video thương mại hoàn chỉnh.


## Timeline Concat nhiều lớp v0.8.3

Chọn Video & Story Studio → Kế hoạch dựng → bật **Tạo timeline Concat nhiều track thật**. Mỗi cảnh được FFmpeg cắt từ video nguồn và import qua JSON-RPC; tiếng gốc, nhạc/giọng đọc, tiêu đề tùy chọn, từng câu SRT là các clip riêng có thời gian thực. Một project Concat được tạo và lưu trong `media-workspace/concat-projects`, kèm các tệp cảnh ngay trong thư mục dự án. Bấm vào artifact `concat-multitrack-project.json` để biết đường dẫn chính xác. MP4 xuất từ Concat phải vượt qua FFprobe/QA mới được đánh dấu hoàn thành.

**Chưa nghiệm thu Concat Windows thật**: mã đã kiểm thử với RPC mock, không xác nhận engine beta Windows đã xuất đẹp hoặc xử lý mọi bộ lọc/giọng. Chuyển cảnh nhiều cảnh liên tiếp có thể che phụ đề trong phiên beta; khi có hơn hai cảnh kèm chữ, AI Project OS chủ động giữ cắt thẳng để bảo toàn nội dung. TTS/Whisper có trong giao diện Concat nhưng không có lệnh JSON-RPC trong API 0.2, vì vậy chưa tự động hóa trực tiếp bằng Concat. Không cần HeyGen API.
