# v0.8.4 RC — Hướng dẫn thử nghiệm Concat một nút

Khách thử nghiệm **không phải mở GitHub để tải Concat thủ công**: trong Video Studio, mở Vault và bấm **Cài + kết nối Concat tự động**, cấp quyền cài. Gói thử nghiệm hiện tại tự tải bộ cài official qua HTTPS khi Concat chưa có, kiểm tra SHA-256. Gói installer offline đầy đủ cần được nhà phát triển build trên Windows theo `windows/Build-WorkerC-Internal-RC.ps1` (không phải thao tác của khách). Chưa đủ điều kiện bán thương mại hoặc nghiệm thu Smart App Control trên Windows.

---

# AI Project OS v0.7.7 RC — Dựng video theo yêu cầu, không cần nhập JSON

**Fix v0.7.7:** Old completed timelines are bound to their original uploaded video. If a prior export failed with `Invalid clip 0`, use **Dung lai tu video** on the failed job, then approve a new quick-edit task. The old failed task is kept as history; do not repeatedly retry a plan from another video.

**Nâng cấp từ v0.7.3:** sao lưu dữ liệu từ tab Hướng dẫn, tắt ứng dụng cũ, giải nén gói FULL mới và thay tệp chương trình. Không xóa `%LOCALAPPDATA%\AIProjectOSLocal\data`. Mở lại bằng `AI-Project-OS.exe`.

**Video & Story Studio → quy trình mới:**

1. Tạo/chọn một dự án. Vào **Phân tích video**, nạp MP4 hoặc bấm **Dùng clip mẫu thật**. Nạp file chưa thực thi tác vụ hay gọi AI.
2. Chuyển **Kế hoạch dựng**, nhập yêu cầu bằng tiếng Việt (ví dụ `video dọc 9:16, thêm hiệu ứng mờ dần`). Bấm **Dựng MP4 theo mô tả**.
3. Bên phải, chọn **Phê duyệt & chạy** cho đúng tác vụ mới. Sau khi chạy xong sẽ có trình xem video và link tải **final.mp4** (có SHA-256). Chưa cần biết timeline JSON.
4. Muốn làm riêng từng bước, bấm **Chỉ lập kế hoạch (tùy chọn)**, phê duyệt job, rồi sang **Dựng video → Lấy kế hoạch đã hoàn thành** và phê duyệt render.

**Dùng GPT đã kết nối:** ChatGPT được cài trên máy chưa đồng nghĩa đã cấp quyền cho Media Studio. Hệ thống ưu tiên **model Worker đã xác minh** của dự án; nếu chưa phân vai, sử dụng model đã xác minh và đang chọn ở Trung tâm Kết nối. Trạng thái lập kế hoạch hiển thị rõ **AI / quy tắc local**. Vault khóa, model chưa được xác minh hoặc tài khoản chưa đăng nhập sẽ dùng quy tắc local. AI chỉ nhận yêu cầu văn bản và metadata video, **không xem toàn bộ khung hình**, không tự tạo cảnh mới hoặc giọng đọc AI.

**Giới hạn v0.7.7:** cắt/thu ngắn, đổi khung 9:16 (crop giữa), đổi cảnh bằng FFmpeg crossfade có điều kiện, mờ dần đầu và cuối. Chi tiết Concat/Whisper ở `VIDEO-CONCAT-SETUP-VI.md`. Đây là bộ dựng MP4 bằng FFmpeg, **không phải** công cụ sinh video điện ảnh. Giọng HeyGen cần API/chi phí riêng; đăng mạng xã hội vẫn khóa. AI có thể dùng hạn mức gói tài khoản hoặc chi phí API — mỗi tác vụ phải phê duyệt trước.

**Kiểm chứng:** logic render và FFmpeg đã chạy trên Linux; chưa thử giao diện Windows sạch và chưa gọi GPT tài khoản của ông. Đây vẫn là Release Candidate, không bảo đảm tương thích mọi máy hoặc mọi lệnh dựng.

---

# AI Project OS v0.7.3 RC — giao diện Arctic Light

Giao diện **☀ Arctic Light** đã được sửa màu chữ tại 10 tab. Để đổi giao diện, chọn ô giao diện ở góc trên bên phải, không cần khởi động lại. Lựa chọn được lưu trên máy.

**Nâng cấp từ v0.7.2:** Sao lưu dữ liệu bằng chức năng trong tab Hướng dẫn trước, đóng mọi tiến trình ứng dụng cũ, giải nén ZIP full v0.7.3 và thay thư mục chương trình. Không xóa `%LOCALAPPDATA%\AIProjectOSLocal\data`. Mở lại bằng `AI-Project-OS.exe`.

**Lưu ý:** Bản này vẫn là Release Candidate, chưa nghiệm thu cài đặt vật lý trên Windows 10/11, màn hình DPI khác nhau, đăng nhập AI bằng tài khoản thật và cảnh báo Defender/SmartScreen.

---

## MỚI v0.7.0: Mở trực tiếp bằng EXE

1. Giải nén **toàn bộ ZIP** ra một thư mục cố định, ví dụ Documents\AI Project OS. **Không chạy EXE khi ZIP chưa giải nén.**
2. Trên máy **Windows 10/11 64-bit (Intel/AMD)**, nhấp đúp `AI-Project-OS.exe`. Đây là **bộ mở chương trình portable**, chưa phải bộ cài có chữ ký số.
3. Lần đầu, nếu không có Node.js 22+, EXE dùng PowerShell tải Node.js từ nodejs.org và đối chiếu SHA-256 đã ghim. Cần Internet. Nếu không tải được, EXE dừng an toàn. Có thể dùng `RUN-WINDOWS.cmd` dự phòng.
4. Trình duyệt được mở bằng phiên truy cập nội bộ một lần; **không dùng đường dẫn localhost từ người khác**. Cửa sổ mở chương trình phải được giữ trong khi sử dụng.
5. Vào **Hướng dẫn → Chạy kiểm tra thật** để thử lưu dữ liệu, sao lưu, Git và xuất một MP4 H.264. Bài kiểm tra này không gọi API AI mất phí.
6. Nếu cần Video Studio mà chưa có FFmpeg, chạy `INSTALL-VIDEO-TOOLS-WINDOWS.cmd` rồi mở lại ứng dụng. AI Team cần Git, cài qua `INSTALL-CODE-TOOLS-WINDOWS.cmd`.

**Quyền riêng tư:** Dữ liệu nằm tại `%LOCALAPPDATA%\AIProjectOSLocal\data`, bản backup tại `...\backups`, phiên truy cập nội bộ tại `...\run`. Phiên cũ mất hiệu lực khi server khởi động lại. Không được mở cổng 4321 ra Internet.

**Giới hạn:** Không có EXE ký số, chưa nghiệm thu trên Windows vật lý, không tự tạo cảnh video điện ảnh, chưa có cơ chế kích hoạt bản quyền hoặc hệ thống quản trị thuê bao. Cổng HeyGen vẫn cần API key và quyền dùng thật; **chưa xác nhận được cuộc gọi API có tính phí**. Bản phát hành này dành cho thử nghiệm khách hàng được kiểm soát.

---

# AI Project OS Local Worker v0.7.0 — Hướng dẫn cho khách hàng

> **Ứng dụng cài trên từng máy Windows, KHÔNG phải dịch vụ chia sẻ nhiều người trên Internet.** Mỗi người có dữ liệu riêng, không tự gửi dự án lên cloud. Đây là bản **Release Candidate** phục vụ chạy thử/triển khai giới hạn: một số API và Windows vật lý chưa được nghiệm thu; không được coi là bản thương mại đã chứng nhận.

## Cài cho máy Windows 10/11 64-bit (kết nối Internet lần đầu)

1. Giải nén toàn bộ ZIP vào **thư mục cố định**, ví dụ `C:\Users\<TEN-MAY>\Documents\AI Project OS` (không chạy ngay trong ZIP). Không cần quyền Administrator.
2. Nhấp đúp `RUN-WINDOWS.cmd`. Nếu máy chưa có Node.js >=22, chương trình hỏi Internet rồi tải **Node.js 22.23.3 portable từ `nodejs.org`**, kiểm SHA-256 trước khi chạy. Node nằm trong thư mục ứng dụng. Không chạy bản tải về nếu mã SHA khác.
3. Chờ giao diện mở trong trình duyệt tại `http://127.0.0.1:4321`. Không tắt cửa sổ đen khi đang dùng.
4. Nếu muốn dựng video/ghép tiếng: nhấp `INSTALL-VIDEO-TOOLS-WINDOWS.cmd`. Xác nhận cài `Gyan.FFmpeg` qua winget (phần mềm GPL riêng). Đóng ứng dụng, mở lại rồi tới **Hướng dẫn → Kiểm tra khả năng trên máy này**.
5. Nếu muốn AI Team viết code, quản lý nhánh và review, bấm `INSTALL-CODE-TOOLS-WINDOWS.cmd` và xác nhận cài Git for Windows qua winget (nếu máy chưa có). Khởi động lại app để nhận Git.
6. Có thể nhấp `TAO-LOI-TAT-WINDOWS.cmd` để tạo lối tắt trong Start Menu.

**Máy không có Internet lần đầu:** cần tự cài Node.js 22+ từ trang chính thức; chức năng offline sau đó có thể chạy mà không cần API. Tạo giọng AI từ kịch bản và kết nối model yêu cầu Internet/API riêng.

## Làm thử 4 thao tác

1. **Tổng quan → Tạo dự án** và nhập ý tưởng.
2. **Engine Hub → Video & Story Studio** → `Dùng clip mẫu thật` → Phân tích, hoặc nhập MP4 của bạn.
3. Chọn **Thay giọng thật** rồi tải WAV/MP3/M4A, tạo tác vụ, xem lại và **Phê duyệt & chạy** → tải MP4 hoàn chỉnh. Đây là tính năng có thể chạy local khi FFmpeg sẵn sàng.
4. Trong **Hướng dẫn → Sao lưu dữ liệu có mật khẩu**, đặt mật khẩu ít nhất 12 ký tự, tải file `.aiosbackup` về ổ khác.

## Tạo giọng AI tự nhiên từ văn bản

1. Trên giao diện, nhấn **Mở Vault** và tạo mật khẩu Vault (ghi nhớ cho các lần sau).
2. Chọn **Hướng dẫn → Kết nối giọng đọc HeyGen**; dán API key và Voice ID tương thích của riêng bạn rồi bấm **Lưu trong Vault**. API key **không nằm trong ZIP, không hiện ngược lại trong UI**.
3. Vào **Video Studio → AI Tạo giọng từ kịch bản**, dán văn bản tiếng Việt, chọn nguồn video rồi tạo tác vụ. Chỉ khi bấm phê duyệt, Worker mới gọi API có thể tính phí.

**Không có HeyGen API?** Dùng tính năng `Thay giọng thật` với file WAV/MP3 bạn đã có. Không có chế độ sinh ra giọng đẹp hoàn toàn offline từ văn bản ở bản này.

## Dữ liệu/đổi bản

- Dữ liệu nằm riêng tại `%LOCALAPPDATA%\AIProjectOSLocal\data` và **không bị xóa khi thay thư mục chương trình**.
- File backup nằm tại `%LOCALAPPDATA%\AIProjectOSLocal\backups`; hãy tải file ra ổ USB/cloud riêng trước khi thay máy. **Không ai giúp phục hồi được nếu quên mật khẩu backup.**
- Đổi từ v0.5.1 cũ: trước khi chạy bản mới, đóng v0.5.1, để bản cũ nguyên vẹn; nếu dữ liệu cũ đang nằm trong `.data` thì sử dụng `MIGRATE-OLD-DATA-WINDOWS.cmd` tại **thư mục của bản mới có chứa bản `.data` cũ được chép vào trước**. Không tự trộn hai kho dữ liệu khác nhau. Nếu đã có dữ liệu ở máy mới, cần kỹ thuật viên hỗ trợ hợp nhất.
- Khi cần phục hồi, tắt Worker, kéo file `.aiosbackup` thả lên `RESTORE-WINDOWS.cmd`; xác nhận và nhập mật khẩu. Dữ liệu hiện tại được chuyển sang thư mục `.before-restore-...` để đề phòng.

## Giới hạn công khai và thông tin cần biết

- Các chức năng offline: ghi dự án, lập storyboard local, import video, phân tích, timeline, phụ đề, render MP4, ghép WAV/MP3 có bản quyền.
- Chức năng chỉ chạy khi có quyền: các model OpenAI/Gemini/Claude, HeyGen TTS, GitHub/Vercel, môi trường chạy code bổ sung. Mỗi nhà cung cấp có phí và điều khoản riêng.
- Chưa hỗ trợ: tạo cảnh AI điện ảnh theo kịch bản hoàn toàn tự động, STT mặc định, đồng bộ dự án giữa nhiều máy, đăng nhập quản trị doanh nghiệp, Windows EXE ký số.
- Đã có: tự động cập nhật có chữ ký số (tab Kết nối → Cập nhật phần mềm). Phần mềm không dùng license/kích hoạt — cài là dùng.
- Không đưa ứng dụng local này trực tiếp lên public IP hoặc mở port 4321. Chỉ phục vụ 127.0.0.1 trên mỗi máy cá nhân.
- Bộ khởi chạy PowerShell và nút Winget cần xác nhận trên Windows thật trước triển khai diện rộng. Nếu có SmartScreen/cảnh báo antivirus vì chưa ký số, khách không nên bỏ qua cảnh báo một cách mù quáng.
- Sao lưu vẫn có chứa dữ liệu nhạy cảm nhưng đã mã hóa. Chọn mật khẩu mạnh và lưu bản backup đúng nơi.
- Chỉ dùng nội dung/giọng/hình ảnh có quyền, không dùng API key hoặc tài khoản của người khác.

## Hỗ trợ

Mở mục **Hướng dẫn → Kiểm tra khả năng trên máy này** và ghi lại báo lỗi, phiên bản Windows, ảnh màn hình (che API key/mật khẩu). Không gửi file Vault, dữ liệu dự án hoặc bản backup khi chưa có quy trình bảo mật.


## Bản nâng cấp v0.7.2: AI tài khoản Claude, Gemini và ChatGPT

1. Đóng ứng dụng cũ, sao lưu dữ liệu `%LOCALAPPDATA%\AIProjectOSLocal\data` nếu đang làm việc quan trọng.
2. Giải nén toàn bộ ZIP vào thư mục chương trình cũ (đồng ý ghi đè file chương trình), hoặc dùng thư mục mới; tuyệt đối **không xóa thư mục dữ liệu trong `%LOCALAPPDATA%`**.
3. Mở `AI-Project-OS.exe` trên Windows x64 hoặc `RUN-WINDOWS.cmd`.
4. Chọn **Kết nối**, mở Vault và chọn provider. Bấm **Cài CLI → Mở đăng nhập → Xác minh model**. Với ChatGPT, dùng Codex CLI (nút cài trong dialog).
5. Kiểm tra bản `0.7.2` tại `/api/health`, và bảo đảm dự án cũ vẫn xuất hiện trước khi xóa bản chương trình cũ.

Đây là bản thử có mã nguồn đầy đủ. Xác thực thực tế với nhà cung cấp phụ thuộc gói tài khoản, Internet và trình duyệt trên chính máy của bạn.


## Cập nhật v0.7.2 (16/10/2026)

**Đăng nhập AI bằng tài khoản**: ChatGPT qua nút Đăng nhập ChatGPT (Codex), Claude qua Cài Claude CLI/Mở đăng nhập, Google cá nhân qua Antigravity. Trong Kết nối → Gemini chọn **Đăng nhập Google**; bấm **Tự cài Antigravity trên Windows**, **Đăng nhập**, **Tạo kết nối**, **Tải model**, **Xác minh**. Không cần gõ lệnh trong PowerShell.

**Cảnh báo từ Google:** Gemini CLI đăng nhập cá nhân cũ không còn được hỗ trợ từ 18/6/2026. Đừng dùng mục Gemini CLI cũ cho tài khoản cá nhân, dù trình duyệt báo xác thực thành công. Nếu không có WinGet hoặc Google không cấp quyền model, chọn liên kết cài Antigravity chính thức hoặc **Gemini API key** (phí/hạn mức có thể khác). Không nhập mật khẩu tài khoản vào Project OS.

**Nâng cấp:** đóng app trước khi chép đè toàn bộ thư mục mã nguồn. Không xóa `%LOCALAPPDATA%\AIProjectOSLocal\data`; đây là dữ liệu/Secret Vault của chính khách. Sau đó mở `AI-Project-OS.exe`, kiểm tra `/api/health` trả `0.7.7`. Sao lưu có mật khẩu trước khi chuyển máy.

**Chưa xác nhận trên máy Windows của khách:** đăng nhập Google/Claude/ChatGPT thật, quyền model, Defender/SmartScreen, WinGet. Kết nối AI chỉ báo đã sẵn sàng khi model thực tế phản hồi.

## Mới ở v0.7.7: Phân cảnh FFmpeg và hạn mức AI

- Nếu tác vụ phân tích video cũ báo lỗi `Unrecognized option 'vsync'`: đóng AI Project OS cũ, sao lưu dữ liệu, giải nén toàn bộ bản v0.7.7 rồi chạy EXE mới. Vào Video & Story Studio và chọn **Thử lại** tác vụ thất bại. Bản mới không dùng tham số đó.
- Vào **Hướng dẫn → Kiểm tra khả năng trên máy này**, chạy chẩn đoán đầy đủ và kiểm tra dòng **Phân tích cảnh bằng FFmpeg**; không chỉ nhìn dòng `FFmpeg đã phát hiện`.
- Vào **Kết nối → Mở Vault**. Thanh hạn mức xuất hiện **dưới Dùng cho vai trò** ở từng thẻ AI. Bấm **Cập nhật** nếu muốn đọc lại ngay. Tùy provider, hạn mức có thể là của gói dùng chung, của nhóm model hoặc không được cung cấp; phần trăm bị ẩn nếu không xác minh được.
- Việc cài ChatGPT trên máy, chưa mở Vault hay chưa xác minh model **không đồng nghĩa** Media Engine đã được quyền gọi GPT. Dựng video FFmpeg local vẫn có thể chạy mà không cần đăng nhập AI, nhưng không nên gắn nhãn đây là AI xem hiểu ngữ nghĩa từng cảnh.

