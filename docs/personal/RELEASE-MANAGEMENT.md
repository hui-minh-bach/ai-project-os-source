# Step 5 — Release Management

Chỉ triển khai Step 5; chưa bắt đầu Step 6.

## Quyết định PO cho phiên bản đầu tiên

Dự án không được phân loại “legacy”. Trạng thái khởi đầu là **Chưa có baseline**. Cần PO duyệt Specification và Architecture Lite trước khi coding, merge hoặc tạo release. Thiếu baseline, thiếu approval hash của Specification, thiếu task reference hoặc `architectureRequired: false` đều không tạo quyền bỏ qua guard. Không tự tạo baseline giả và không thay dữ liệu dự án thật khi nâng code.

Đây là thay đổi chính sách dự án theo yêu cầu PO, thay thế nhánh `LEGACY_NO_BASELINE` ở Step 4. Các WARNING về phạm vi phân tích ngữ nghĩa vẫn được giữ trung thực. Các profile đăng nhập CLI và cơ chế bảo toàn tài khoản không bị đổi bởi quyết định này.

## Sử dụng

Trong **Project Map → Quản lý phát hành**:

1. Tạo phiên bản như `v0.1.0` hoặc `v1.0.0`, mô tả, ngày dự kiến, known issues và limitations. Version được chuẩn hóa và không trùng trong cùng dự án.
2. Gán các task đã có cùng baseline; phân loại tính năng hoặc sửa lỗi. Không tạo thêm hệ thống task. Một task được định danh bằng `planId + taskId` và thuộc tối đa một release; T1 của kế hoạch mới không ghi đè T1 của release cũ.
3. Theo dõi task đã xác minh build/Git, test runtime, nghiệm thu và công việc còn lại. Cột task của Idea Studio hiển thị release đã gán trong chi tiết task.
4. Khi cần, PO kiểm tra các acceptance criteria hiện có và ghi bằng chứng nghiệm thu. Đây là receipt của PO theo đúng task/run/merge/criterion, không phải Agent tự đánh dấu.
5. Khi đủ điều kiện, PO chốt bàn giao để đóng băng snapshot. Release đã chốt không sửa kế hoạch/phạm vi; tạo version mới cho thay đổi tiếp theo.
6. Chỉ sau khi triển khai thật, PO xác nhận **Deployed** với đích triển khai và mô tả bằng chứng. App không tự deploy trong Step 5.
7. Sinh/tải Release Notes Markdown. Mỗi lần sinh tạo revision mới, giữ nguyên bản trước.

## Trạng thái và bằng chứng

| Mốc | Điều kiện |
| --- | --- |
| Build Complete | Có ít nhất một task và tất cả task được xác minh: phiên thực thi cuối cùng done, commit/merge khớp, Specification/Architecture/acceptance reference đúng, review phù hợp setting đã chụp lúc chạy, receipt Architecture hợp lệ và commit Git thật nằm trên main. |
| Tested | Build Complete và task nào cũng có receipt **test** cuối cùng từ runtime với `PASS` và `exitCode: 0`. |
| Ready for Handover | Tested, baseline hiện hành và mọi acceptance criterion có bằng chứng reviewer trong đúng run hoặc receipt PO tương ứng. |
| PO chốt bàn giao | PO xác nhận evidence hash hiện tại; lưu snapshot bất biến và commit main dùng cho bàn giao. |
| Deployed | PO xác nhận snapshot đã chốt, đích triển khai và bằng chứng. Không suy ra từ build, test, URL nhập sẵn hay lời Agent. |

Receipt `external-command`, model summary, receipt giả source Agent, test NOT_RUN/BLOCKED/FAIL hoặc PASS thiếu exit 0 không đủ xác nhận Tested. Test thất bại ở lượt cuối không được che bằng PASS cũ. Reviewer tắt không ngăn Build Complete nếu các guard khác đạt, nhưng được ghi là limitation; PO vẫn phải nghiệm thu trước bàn giao.

Build Complete xác nhận hoàn tất task/Git, không tự khẳng định compiler hoặc build script đã chạy. Nếu có receipt runtime của lệnh `build`, trạng thái cuối phải PASS/exit 0; build đã biết thất bại sẽ chặn hoàn tất release. Nếu không có lệnh build riêng, giới hạn này được ghi rõ trong Release Notes.

Tiến độ build = số task có bằng chứng hợp lệ / số task được gán. Release rỗng có 0%, không được coi là hoàn tất. Known issues/limitations do PO ghi được tách khỏi bằng chứng tự tính, không thể dùng API sửa metadata để tự ghi trạng thái, receipts hoặc source versions.

Git được đọc bằng commit object và kiểm tra ancestor; không chỉ kiểm tra SHA có định dạng đúng. Mỗi lượt đánh giá ghim một commit main để đối chiếu các task. Code chỉ đọc Git, không tag, push, deploy hay publish tự động.

## Lịch sử và Release Notes

Release ghi ID/version/hash Specification và Architecture khi tạo. Không tự đổi sang baseline mới. Draft theo baseline cũ giữ nguyên thông tin nhưng không đủ điều kiện bàn giao; tạo release mới theo baseline mới. Snapshot đã bàn giao vẫn là hồ sơ lịch sử đúng thời điểm chốt dù dự án đang phát triển phiên bản tiếp theo.

Task được tìm trong kế hoạch hiện tại, task archive và plan history. Snapshot bàn giao và mỗi bản Release Notes có hash nội dung, API không cho sửa/xóa tùy ý. Bản Markdown sinh từ bằng chứng đã xác minh gồm:

- Tính năng và sửa lỗi có build/Git được xác minh; test chưa đạt được ghi rõ, không gọi là đã triển khai.
- Phạm vi dự kiến, công việc chưa hoàn tất và lý do thiếu bằng chứng.
- Test status, exit code và receipt ID từ runtime.
- Tình trạng nghiệm thu, known issues và limitations.
- Specification/Architecture versions/hashes, worker/merge commit SHA và xác nhận triển khai của PO nếu có.

Tên xuất: `RELEASE-NOTES-v0.1.0-r1.md`. Sinh lại tạo r2; không ghi đè r1. Thay đổi trong lúc đánh giá hoặc evidence hash UI lỗi thời khiến thao tác xác nhận bị từ chối, cần tải lại.

## Phạm vi API

Tất cả dưới `/api/projects/:projectId/releases`, dùng browser session và kiểm tra cùng nguồn sẵn có:

- GET/POST collection: xem hoặc tạo release.
- GET/PATCH `/:releaseId`: xem hoặc sửa các trường kế hoạch cho draft.
- POST `/:releaseId/tasks`: gán task hiện có theo plan/task key và feature/fix.
- POST `/:releaseId/acceptance`: PO xác nhận tiêu chí và bằng chứng.
- POST `/:releaseId/handover`: PO chốt snapshot đủ điều kiện.
- POST `/:releaseId/deployed`: PO xác nhận triển khai thực tế của snapshot.
- POST `/:releaseId/notes`: sinh revision từ bằng chứng, không nhận Markdown do client/Agent khai.
- GET `/:releaseId/notes/:noteId/markdown`: tải bản lịch sử đã lưu.

Operator token không được cấp quyền tự xác nhận nghiệm thu/bàn giao/triển khai release. Worker file tools không ghi được kho release có thẩm quyền nằm ngoài worktree.

## Giới hạn

- Deployed là **xác nhận của PO**, không phải kết quả kiểm tra health của môi trường từ xa. Không có tự động deploy ở Step 5. Trạng thái Website/hosting trong Project Map vẫn dùng nguồn xác minh riêng.
- Test PASS chứng minh lệnh test đã chạy thành công, không chứng minh test bao phủ mọi yêu cầu. Nghiệm thu và semantic review vẫn cần PO/Reviewer.
- Commit main có thể chứa thay đổi ngoài các task được gán release; Step 5 quản lý hồ sơ release, chưa xây hệ đóng gói artifact hay nhánh phát hành riêng.
- Snapshot lịch sử ghi sự thật tại thời điểm chốt. Release Notes draft đánh giá lại dữ liệu/Git hiện có; snapshot bàn giao không tự viết lại vì task hoặc main về sau thay đổi.
- Hỗ trợ version ba phần số, tối đa 50 release/project và 50 revision notes/release. Không tự tạo Git tag, push, phát hành ra dịch vụ bên ngoài hay thực hiện Step 6.
- Ranh giới bảo vệ là API/ứng dụng/worktree hiện có, không chống tiến trình có toàn quyền tự sửa kho dữ liệu bên ngoài app.

## Kiểm thử và UI thực

[Chi tiết kết quả](evidence/step5/test-results.json) · [Kết quả Chrome](evidence/step5/ui-results.json) · [Hồi quy rộng](evidence/step5/regression-results.json)

Script UI: `node tools/verify-releases-ui.mjs`. Dữ liệu tạm riêng, AI giả lập local, Native Worker/Git/npm test thực. Các xác nhận PO trong script là thao tác fixture để kiểm tra UI, **không phải triển khai dự án thật**.

Ảnh: [Kế hoạch · dark](evidence/step5/release-planned-dark.png), [Đã kiểm thử, chưa bàn giao](evidence/step5/release-tested-dark.png), [PO xác nhận fixture · light](evidence/step5/release-deployed-light.png), [Mobile 390px](evidence/step5/release-mobile.png).

Markdown đã tải qua API: [r1 còn công việc chưa xong](evidence/step5/RELEASE-NOTES-v0.1.0-r1.md), [r2 sau nghiệm thu và xác nhận PO giả lập](evidence/step5/RELEASE-NOTES-v0.1.0-r2.md).

Kết quả: **97/97** ca nghiệm thu và hồi quy liên quan đạt; sau cùng chạy riêng **10/10** ca release/API với kiểm tra build runtime bổ sung đều đạt. Syntax/diff checks và Chrome UI thực đạt. Các lần chạy có ca trùng, không cộng số lượng.

Lượt hồi quy rộng ghi nhận **461 test: 411 đạt, 45 lỗi, 5 bỏ qua**, loại file account-usage do vấn đề treo đã ghi từ trước. Hai fixture v041 đã được sửa và xác minh đạt trong lượt 97 test sau đó; không chạy lại toàn bộ broad suite sau hai sửa fixture này. Danh sách lỗi và các giới hạn nằm trong regression-results.json. Không báo toàn bộ repository đã đạt.
