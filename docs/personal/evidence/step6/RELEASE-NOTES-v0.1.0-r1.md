# Release Notes v0.1.0 · Bản đầu tiên

Trạng thái: Đang thực hiện

Specification v1 (test-approved-spec) · Architecture v1 (019668b8-07f0-47d5-8886-0ff9d4308b95)

Requirements hash: 8ec8601051560683cc15544e4bf0d7d1a304f0122af4245a228db137879ed1d3
Architecture hash: 95dedf5096d87827c02164032d79b009d00a7fc942c28be557c2260ffacd4eea

Bằng chứng ghi nhận: 2026-10-25T05:07:04.734Z

## Tính năng có bằng chứng build

- Feature UI · T1 / ef3af5ae-f841-43ac-8af8-cb6e12665f09 · Worker 991527282eb62f1d089741cc7eb859477c2b385f · Merge 6bece0abc29c966eb6198bfd1e4d8b6f1b5b865d · Test PASS

## Sửa lỗi có bằng chứng build

Chưa có bằng chứng được xác minh.

## Phạm vi dự kiến và công việc còn lại

- Fix UI: Task chưa có phiên hoàn tất/merge cùng baseline.; Chưa có receipt test từ runtime.; Tiêu chí nghiệm thu chưa được xác nhận bằng bằng chứng.

## Lệnh build riêng

- T1: Chưa có receipt lệnh build riêng; xem giới hạn của Build Complete.
- T2: Chưa có receipt lệnh build riêng; xem giới hạn của Build Complete.

## Kết quả kiểm thử

- T1 · runtime · PASS · exit 0 · receipt 2091b3a6-77e0-4fc1-b487-6d207d222390 · đủ điều kiện Tested
- T2 · không có runtime receipt · NOT\_RUN · exit chưa xác định · receipt — · chưa đủ điều kiện Tested

## Nghiệm thu

- T1: 0/1 tiêu chí có bằng chứng
- T2: 0/1 tiêu chí có bằng chứng

## Vấn đề đã biết

- Chưa kiểm tra trên mọi thiết bị
- T1: Tiêu chí nghiệm thu chưa được xác nhận bằng bằng chứng.
- T2: Task chưa có phiên hoàn tất/merge cùng baseline.; Chưa có receipt test từ runtime.; Tiêu chí nghiệm thu chưa được xác nhận bằng bằng chứng.

## Giới hạn

- Dữ liệu fixture, chưa triển khai thực tế
- Chưa có receipt lệnh build riêng; Build Complete xác nhận task/Git, không tự khẳng định compiler hoặc build script đã chạy.
- AI Reviewer đã tắt; không có phê duyệt review độc lập.
- Release Notes chỉ ghi bằng chứng tại thời điểm tạo; không xác nhận tương đương ngữ nghĩa hoặc test chưa thực thi.
- Commit main có thể chứa công việc khác ngoài các task được gán release; đây không phải gói artifact được tự động triển khai.

## Triển khai

Chưa có xác nhận Deployed của PO. Build, test và lời Agent không phải bằng chứng triển khai thành công.
