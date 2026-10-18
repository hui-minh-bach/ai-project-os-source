# Kiểm toán vòng 2 (15/10/2026) — độc lập với báo cáo ban đầu

Đã mở lại ZIP `AI_CORE_GPT1_feat-ai-core_2026-10-15.zip` và kiểm tra từng file. Kết quả: 18/18 test ban đầu chạy lại đạt, checksum của 14 file bản vá khớp manifest; những test này không thay thế kiểm thử Windows hoặc provider thực.

## Phát hiện và xử lý

1. **Đã sửa:** `startStandalone` trước đây tạo Core nhưng không nối Vault bằng `KBL_CORE_MASTER_KEY`, khiến luồng provider thật vẫn khóa. Bản v2 yêu cầu master key 32+ ký tự, khởi tạo Vault khi server bắt đầu. Thêm test bootstrap tích hợp với provider giả lập.
2. **Đã sửa:** downstream task có prerequisite `failed`/`cancelled` trước đây vẫn `queued` vô hạn. Bản v2 đưa xuống `blocked`, lỗi `DEPENDENCY_UNAVAILABLE`, lan tới toàn chuỗi và cần operator xét duyệt. Thêm test hồi quy.
3. **Chưa giải quyết do ranh giới an toàn:** `node_syntax` chấp nhận JavaScript đúng cú pháp dù lỗi runtime. Cần dự án mẫu với test chức năng, môi trường chạy mã chưa đáng tin đã cô lập và Reviewer độc lập. **Không chạy code AI trên Host không có sandbox.**

## Bằng chứng

- 20/20 test Node.js trong container Linux; trong đó 2 test mới liên quan hai lỗi ở trên.
- Hash `FILE_MANIFEST.json` mới được cập nhật cho 14 file bản vá.
- Không có lần gọi OpenAI/Gemini/Claude bằng API key thật; provider trong bài test là fake `fetchImpl`.
- Không chạy được PowerShell Windows tại đây; chưa kiểm tra startup `STARTUP42.cjs` với AI Core nhúng vào Local Worker.
- Git bundle chỉ là nhánh tạo từ snapshot gốc **giả lập**, chưa có nhánh/PR trên GitHub Local Worker.

**Trạng thái cuối: PARTIAL / BLOCKED, chưa đủ điều kiện DONE.**
