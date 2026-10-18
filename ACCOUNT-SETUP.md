# Tài khoản ChatGPT và thống kê sử dụng

Trong **Kết nối → OpenAI / ChatGPT**, chọn API key hoặc **Đăng nhập ChatGPT**. Có thể tạo nhiều hồ sơ và phân một tài khoản cho **Chatbox / Founder**, tài khoản khác cho **Worker / Builder** bằng các bộ chọn vai trò hiện có. Google Gemini, Anthropic và OpenAI-compatible dùng API key chính thức.

## Cài trên máy chạy ứng dụng

Cài Node.js và Codex CLI chính thức: `npm install -g @openai/codex@0.162.1`. Hướng dẫn: https://developers.openai.com/codex/cli. Các phiên bản đã kiểm chứng ranh giới môi trường: 0.159.2 và 0.162.1. Phiên bản khác có thể đăng nhập/xem hạn mức nhưng inference bị chặn cho tới khi được kiểm chứng.

Mở Vault, chọn đăng nhập qua trình duyệt hoặc mã thiết bị, rồi mở liên kết OpenAI chính thức. Ứng dụng không nhận mật khẩu, cookie hay token phiên website. Sau đăng nhập, bấm **Làm mới model**, chọn model và **Xác minh model**. Bước xác minh gửi một yêu cầu ngắn và có dùng hạn mức; chỉ model đã trả lời mới được chọn cho vai trò. Danh mục model tự nó không chứng minh quyền inference. Model đã xác minh hết hiệu lực sau 24 giờ hoặc khi đổi tài khoản.

Codex quản lý credential trong `.data/account-profiles/<connection-id>` riêng cho từng tài khoản. **Credential này không được mã hóa bằng mật khẩu Secret Vault**; chúng được Codex lưu trong hồ sơ cục bộ, có quyền thư mục riêng trên hệ điều hành hỗ trợ POSIX. Secret Vault vẫn mã hóa API key. Khóa Vault dừng các phiên Codex của ứng dụng; đăng xuất gọi API đăng xuất chính thức. Xóa kết nối xóa hồ sơ riêng sau khi đăng xuất. Không chia sẻ thư mục `.data` hoặc sao lưu hồ sơ đăng nhập vào kho mã nguồn.

## Ranh giới thực thi

Mỗi lần inference tạo thread tạm thời với `environments: []` ở thread và turn, không dynamic tools, không approval. Adapter chỉ chấp nhận phản hồi xác nhận không có environments, workspace roots hay instruction sources; đúng model, provider OpenAI và phiên bản đã kiểm chứng. Cấu hình hiệu lực có MCP bị chặn trước khi tạo thread; các cờ hạn chế được truyền bằng CLI override và vẫn tuân thủ managed requirements. Tất cả tool/approval request từ app-server bị từ chối. NativeWorker tiếp tục tự quản lý file tools, test, review và worktree theo ranh giới hiện có. Không cấp shell hoặc filesystem cho Codex để thay thế NativeWorker.

## Số liệu

Token là số liệu provider trả về, được ghi bền vững theo connection/model/vai trò khi biết. Input, output, cache đọc, cache ghi và reasoning giữ riêng; `Chưa có số liệu` không có nghĩa là 0. Bảng chi tiết có độ phủ từng chỉ số. Không cộng các trường có thể chồng lấp. Ledger chỉ tổng hợp các phản hồi thành công được ứng dụng nhận, kể cả nội dung rỗng; request lỗi, retry hoặc ứng dụng khác có thể dùng token mà ứng dụng không quan sát được.

**Giới hạn gói** đọc qua `account/rateLimits/read`: độ dài cửa sổ và thời điểm đặt lại do provider cung cấp, không cố định 5 giờ/tuần. API key không có phần trăm gói ChatGPT. Account lifetime token được hiển thị riêng nếu provider hỗ trợ. Sau đổi tài khoản trong cùng hồ sơ, thống kê không trộn với định danh cũ.

## Phạm vi kiểm chứng

Các test tự động dùng HTTP/stdio fixture tách biệt, không đăng nhập tài khoản thật. Codex 0.159.2 và 0.162.1 đã được kiểm tra thực thi với local HTTP fixture; tool filesystem/shell không có trong request và lệnh canary bị từ chối. Luồng live login, quyền model thật và hạn mức thuê bao thật chưa được kiểm chứng trong môi trường QA; phải hoàn tất đăng nhập trên máy người dùng. Các ảnh QA có số token/quota từ fixture được ghi nhãn là fixture, không phải hạn mức thật của người dùng.


## Bổ sung v0.7.1 — Đăng nhập trực tiếp Claude/Gemini bằng tài khoản chính thức

Kết nối Claude hoặc Gemini mở menu **API key / Đăng nhập qua CLI**. Nếu dùng CLI trên Windows, ứng dụng cung cấp nút cài CLI vào thư mục riêng trong `%LOCALAPPDATA%` (không cần Administrator), nút mở cửa sổ đăng nhập chính thức, và nút xác minh model bằng phản hồi thực. Có thể dùng `INSTALL-AI-TOOLS-WINDOWS.cmd`, `LOGIN-CLAUDE-WINDOWS.cmd`, `LOGIN-GEMINI-WINDOWS.cmd` nếu trình duyệt không mở được cửa sổ đăng nhập. Chỉ một tài khoản CLI cho mỗi provider trên một máy hiện được hỗ trợ; thêm tài khoản khác bằng API key. ChatGPT có các hồ sơ Codex riêng cho nhiều tài khoản.

Chưa xác minh phản hồi: **không thể chọn model cho vai trò**. Chỉ nhập model không đủ để được coi là đã kết nối. Claude/Gemini CLI được dùng ở chế độ chỉ văn bản, không cấp quyền chạy công cụ/shell cho model trong luồng tư vấn; Worker engine vẫn có luồng kiểm thử và phê duyệt độc lập. Không lưu email/password/cookie của trang web.


## v0.7.2 — Google cá nhân chuyển sang Antigravity (không dùng Gemini CLI cũ)

Google đã ngừng luồng Gemini Code Assist cá nhân trên Gemini CLI từ 18/6/2026. Mặc dù trang duyệt báo đăng nhập thành công, CLI cũ vẫn có thể từ chối phiên.

1. Mở **Kết nối → Google Gemini → Đăng nhập Google (Antigravity)**.
2. Bấm **Tự cài Antigravity trên Windows**. Nút này dùng gói `Google.AntigravityCLI` chính thức qua Windows Package Manager (WinGet); nếu WinGet bị chặn/không có, dùng liên kết Google chính thức ngay bên cạnh. Không tự tải một script không rõ nguồn hoặc yêu cầu người dùng tắt SmartScreen.
3. Bấm **Đăng nhập tài khoản Google**, hoàn tất đăng nhập trong cửa sổ Google riêng, rồi bấm **Tạo kết nối → Tải model khả dụng → Xác minh & sử dụng**.
4. Model chỉ sử dụng được sau khi chính Antigravity trả kết quả thành công từ yêu cầu kiểm tra, không tự giả thành công. Thời hạn kiểm chứng model giới hạn trong 24 giờ.
5. Nếu Google không cho phép tài khoản sử dụng Antigravity, chuyển sang **Gemini API key** từ https://aistudio.google.com/apikey. API riêng có hạn mức và thanh toán độc lập với gói Gemini.

**Lưu ý về an toàn:** Antigravity là AI agent hỗ trợ thao tác máy. Project OS dùng profile riêng, thư mục làm việc rỗng, chế độ plan/strict và sandbox, chặn các kết quả có phát sinh tool; tuy nhiên không có bằng chứng chứng nhận cô lập tuyệt đối trên tất cả Windows. Không gửi bí mật hoặc cho agent chạy công cụ trong môi trường production khi chưa thử thực tế. Phiên Google CLI thuộc Google/Windows, không tự động đồng bộ từ app Gemini Chat. Cấu hình không giữ mật khẩu/cookie website.

**Chưa được xác nhận:** login Google, gói thuê bao, quyền model và WinGet trên Windows máy khách thật; Release Candidate, không được quảng cáo là bản thương mại đã chứng nhận.
