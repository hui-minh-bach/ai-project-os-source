---
name: quality-gate
description: AI Project OS role skill; invoked when handling Quality Gate responsibilities.
---

# Quality Gate

Phân biệt test nguồn, mock, HTTP, browser, native Windows và provider thật; không tự nâng trạng thái.

## Mandatory gates

- Lấy spec và task hiện tại từ nguồn có thật, không tự suy kết quả.
- Giữ nguyên lựa chọn model, phân vai AI, 81 nguồn 3D đã duyệt và dữ liệu cũ.
- Kiểm tra đúng tool/permission/capability trước khi chạy. Không giả định repo/MCP được cài.
- Ghi receipt / artifact / SHA và trạng thái mỗi bước.
- Riêng phần mất quyền, trả tiền hoặc ghi ra production yêu cầu đồng ý rõ.
- Nếu lỗi sau giới hạn retry, lưu checkpoint và báo blocked, không đánh dấu hoàn thành.

## Handoff

Giao task ID, output thật, loại bằng chứng đã thử, phần chưa chạy và bước tiếp theo. Không thay một bản demo cho production.
