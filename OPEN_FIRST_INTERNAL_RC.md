# v0.8.5 Internal RC – Media workflow corrections from customer recording (2026-10-16)

- Fixed misleading 3-step Video Studio flow: "Only plan" and "Render JSON" do **not** execute Whisper, Concat, voice or music options; they now refuse these selected options with an exact route to "Dựng MP4 theo mô tả".
- Missing Whisper model/Concat Remote configuration disables the relevant option. A true Concat RPC preflight is run before queuing a multitrack task, instead of failing after rendering.
- Video jobs now show original source name; current-source jobs are displayed first, while history from demo/other sources is hidden unless explicitly requested.
- Completed MP4 means **technically validated** only: human creative/editorial review remains required. A short clip is flagged in QA and commercialReady stays false.
- Reproduced the reported workflow in seven new regression tests; rendered an 8-second clip excerpted from the user's uploaded screen recording to 9:16, 7.96s result, visually confirmed input provenance. User's recording and test outputs are **not** included in the product ZIP.
- No claim of live Windows/Concat/Whisper or commercial acceptance.

---

# AI Project OS v0.8.4 — Chỉ sử dụng nội bộ

1. Sao lưu trong ứng dụng cũ rồi đóng mọi bản AI Project OS và Concat. Giải nén ZIP v0.8.4 vào thư mục mới, mở `AI-Project-OS.exe`.
2. Mở Vault, mở Video & Story Studio → Kế hoạch dựng → Kết nối trình biên tập Concat. Bấm **Cài + kết nối Concat tự động**, xác nhận cài phiên bản Concat chính thức, giấy phép AGPL và cảnh báo chưa ký số.
3. Nếu máy đã cài Concat, ứng dụng cấu hình Remote. Nếu chưa cài, ứng dụng tải **bản chính thức cố định v0.2.7** khi cần, xác thực SHA-256 và cài cho tài khoản Windows hiện tại. Chỉ bundle offline build từ `windows/Build-WorkerC-Internal-RC.ps1` mới có Concat ngay trong installer.
4. Không xóa dữ liệu `%LOCALAPPDATA%\AIProjectOSLocal\data`; không đổi thư mục `settings.json` đang chạy Concat (ứng dụng sẽ từ chối nếu Concat còn mở).
5. Chỉ chấp nhận tình trạng **Kết nối thật** sau khi API Concat phản hồi đúng. Nếu Concat không thể khởi động do Windows Smart App Control chặn phần mềm chưa ký số, không bỏ qua chính sách bảo mật của máy; dùng FFmpeg fallback và báo lỗi cho nhóm phát triển.

**CHƯA BÁN THƯƠNG MẠI:** Chưa thử Concat trên Windows vật lý, chưa đóng bộ cài offline đầy đủ trong môi trường này, chưa có chứng chỉ ký số, chưa hoàn thành nghiệm thu khách hàng và giấy phép.

---

# AI Project OS v0.8.3 RC — Codex account connection fix

**Internal testing only — not licensed for commercial distribution.**

Changes from v0.8.0: account quota works before model response verification; multiple account quota buckets remain isolated; failed Codex turn reasons are categorized safely; successful text-only responses are accepted from `item/completed`; unsupported `account/usage/read` no longer blocks quota display.

## Before updating

1. In the old app, back up from Hướng dẫn. Close the browser and the previous `AI-Project-OS.exe` and local Worker process.
2. Extract the entire v0.8.3 ZIP into a **new** application directory. Run the new `AI-Project-OS.exe` (Windows x64). Do not delete `%LOCALAPPDATA%\AIProjectOSLocal\data`.
3. Open Vault → Kết nối → choose the desired ChatGPT account. Even if its model is **Chưa thử**, the rate limit windows should appear. Use **Xem hạn mức** in the account dialog.
4. A shown five-hour window with **0% remaining** can prevent model verification. Wait until Codex reports the window reset or choose another authorized account/model. Do not repeatedly re-login to clear quota.
5. Only when the model returns text will its status change to verified and become eligible for role assignment. Failed turns never mark a model as verified.

The CLI model check uses a small real inference request. This could count against subscription quotas. Provider and billing eligibility vary by plan. No provider live account or Windows physical machine was available to the automated tests.

Go/no-go commercial release gates remain unchanged and **BLOCKED**.

## Video Studio local-first (v0.8.3)

Không cần HeyGen API. Tạo giọng trong Concat (GUI) rồi nạp âm thanh sang Video Studio, hoặc cài Piper + model riêng nếu muốn TTS tự động trong một tác vụ. Xem `VIDEO-CONCAT-SETUP-VI.md`.

## New in v0.8.3 – editable Concat multi-track projects

1. Install Concat from https://github.com/jub0t/concat/releases (external app; not bundled), open Settings → Remote and enable loopback `127.0.0.1:7420`.
2. In AI Project OS open Vault → Video & Story Studio → Kế hoạch dựng; save Concat Remote token and press **Kiểm tra kết nối thật**.
3. Upload a source clip and optionally a voice WAV, music, SRT and title. Tick **Tạo timeline Concat nhiều track thật**, then **Dựng MP4 theo mô tả** → **Phê duyệt & chạy**.
4. The output is saved under `%LOCALAPPDATA%\AIProjectOSLocal\data\media-workspace\concat-projects\aios-...` with the *editable* Concat project, source clips and export MP4. Use the **concat-multitrack-project.json** artifact for the exact path and verification data.
5. The app also saves FFmpeg preview/final independently. If the Concat service is off or export fails, the Concat step is an error, **not** a fake completion; turn off the Concat checkbox and use FFmpeg fallback instead.

Concat 0.2 JSON-RPC exposes project/edit/export functions but not automated Whisper/TTS. Create speech inside Concat GUI or use a local Piper setup; no HeyGen API is required. A Concat beta issue can hide captions after several cross-fades: multi-scene overlays therefore use safe cuts. This release has mock-verified JSON-RPC; Windows Concat must still be tested with a real running editor before commercial release.
