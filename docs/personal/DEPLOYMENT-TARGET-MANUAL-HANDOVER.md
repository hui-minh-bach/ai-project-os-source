# Step 6 — Optional Deployment Target & Manual Handover

Phạm vi là **ứng dụng của dự án được AI Agent tạo**, không phải bộ cài hay bản cập nhật AI Project OS. Chỉ triển khai Step 6; chưa bắt đầu Step 7.

## Deployment Target tùy chọn, một cấu hình có thẩm quyền

`project.deploymentTarget` có đúng năm lựa chọn:

| Giá trị | Ý nghĩa |
| --- | --- |
| `not-specified` | Chưa chỉ định đích; không cấp quyền triển khai. |
| `local-only` | Chỉ chạy/xem trước trên máy cục bộ. |
| `windows-desktop` | Ứng dụng desktop cho Windows; lựa chọn này không có nghĩa đã có installer. |
| `on-premises` | Máy chủ nội bộ, do quản trị viên cài đặt thủ công. |
| `cloud-manual` | Cloud, triển khai thủ công; không bắt buộc tài khoản cloud để cấu hình hoặc bàn giao. |

Có thể chọn trong **Idea Studio → Đích triển khai** hoặc đổi sau tại **Project Map → Cài đặt dự án → Đích triển khai ứng dụng**. Cả hai ghi vào cùng trường trên project; không có bản cấu hình khác trong `settings`. Revision/history và các giá trị trong Architecture/release/package là dấu vết hoặc snapshot lịch sử, không phải cấu hình song song.

`productType`/Loại sản phẩm vẫn tách riêng. Website không tự đổi thành desktop app khi chọn Windows; chọn cloud cũng không tự biến ứng dụng thành SaaS. Giá trị mặc định là Not Specified; không bắt người dùng chọn đích trước khi mô tả ý tưởng.

Founder, Council brief và Architect nhận target. Đề xuất kiến trúc ghi target và có thể khai `deploymentSupport: {targets, rationale}` cho các môi trường thật sự tương thích. PO thấy thông tin này trong UI và Markdown trước khi duyệt. Worker/Reviewer nhận target hiện tại và đánh giá tác động cùng context kiến trúc.

## Thay đổi sau khi Architecture được duyệt

Thay đổi riêng Deployment Target không tự viết lại Specification hay Architecture đã duyệt.

- **Compatible**: cùng target; trở về Not Specified mà không cấp quyền triển khai mới; hoặc target đã được baseline phê duyệt liệt kê rõ trong `deploymentSupport`. Không cần version Architecture mới.
- **Review Required**: chưa đủ bằng chứng để chắc thay đổi chỉ ảnh hưởng hướng dẫn bàn giao. PO xem xét runtime, network, storage và security. Nếu xác nhận không có thay đổi đáng kể bằng lý do kỹ thuật, hệ thống lưu quyết định tác động riêng và giữ nguyên baseline.
- **Architecture Required**: đổi runtime Windows Desktop vào/ra mà baseline chưa hỗ trợ, hoặc PO xác nhận tác động đáng kể. Cần đề xuất và PO duyệt quyết định Architecture mới. Không có nút miễn kiểm tra thay đổi desktop bắt buộc.
- **Initial Decision**: chưa có Architecture; đưa target vào quyết định kiến trúc đầu tiên theo luồng hiện có.

Trong lúc chờ đánh giá/quyết định bắt buộc, coding/merge, bàn giao mới và xác nhận triển khai không được vượt guard. Task đang chạy bị từ chối merge nếu target đổi sang trạng thái cần quyết định. Đề xuất Architecture tạo trong lúc target đổi bị từ chối lưu kết quả cũ. Thay đổi target trong cửa sổ Git commit được khóa theo cơ chế baseline hiện có.

Quyết định PO về tác động gắn revision target và ID/hash Architecture. Quyết định cũ không tự áp dụng cho revision khác. Bản Architecture mới vẫn cần PO duyệt, không để Agent tự chấp thuận deviation.

## Cơ chế mở rộng nhỏ cho bàn giao

`src/lib/manual-handover.mjs` có registry trusted-code `HANDOVER_ADAPTERS`, hiện chỉ một adapter:

**`static-web-v1` — website tĩnh độc lập HTML/CSS/JS**

Phạm vi đã kiểm chứng:

- Có `index.html` tại root, các asset tĩnh nội bộ và đường dẫn được resolve trong gói.
- Không cần dependency npm, project build script, backend/server runtime hoặc module loader.
- Hỗ trợ file static HTML/CSS/JS/JSON/SVG, text và ảnh/font nhị phân thông dụng trong giới hạn kiểm tra.
- Chạy thủ công/xem trước được trên máy có Node.js 22 trở lên. Server preview chỉ bind **127.0.0.1**, chỉ GET/HEAD, không phục vụ symlink và không dùng làm server production.
- Có thể bàn giao cùng artifact cho on-premises/cloud manual sau quyết định kiến trúc phù hợp; quản trị viên tự cấu hình dịch vụ web/TLS/quyền truy cập/mạng.

Chưa có adapter Windows EXE/MSI, Electron/Tauri, framework build, backend hay packager đa ngôn ngữ. Không chạy `npm install`, không chạy project build script và không giả định thư mục output là thành công. Chọn target không tự cài thêm công cụ hoặc tạo account.

Thêm adapter về sau cần sửa trusted code, mô tả targets/capabilities, kiểm thử artifact và workflow. API không nhận command, đường dẫn nguồn, plugin upload hay script tùy ý. Adapter tương lai có build command phải đi qua sandbox/runtime receipts hiện có; không được lách Safe/Docker/Host policy. Adapter tĩnh hiện tại không thực thi mã dự án nên không cần nới sandbox.

## Chuẩn bị gói bàn giao

Tại **Project Map → release đã chốt bàn giao → Gói bàn giao thủ công**:

1. Dùng snapshot release đã được PO chốt ở Step 5, có task/Git/test/acceptance evidence hợp lệ.
2. Chọn workflow đã kiểm chứng và bấm **Chuẩn bị gói bàn giao cục bộ**.
3. Hệ thống đọc **Git object của commit trong snapshot**, không lấy working tree đang sửa hoặc file chưa commit.
4. Kết quả READY có ZIP và SHA-256. Đọc giới hạn, tải về, giải nén và làm theo hướng dẫn. Packaging không tự đặt Deployed.

Nội dung gói:

| File/thư mục | Nội dung |
| --- | --- |
| `app/` | Artifact static từ commit release đã chốt. |
| `preview.mjs` | Server xem trước cục bộ, không phải installer/server production. |
| `config.example.json` | Cấu hình công khai mẫu do adapter sinh, không có credential; không sao chép `.env`/cấu hình local. |
| `VERSION.json` | Version ứng dụng, commit, snapshot hash, Specification/Architecture versions, target và adapter. Không dùng version của AI Project OS. |
| `TEST-RESULTS.json` | Test/review/acceptance/architecture evidence từ snapshot và kết quả validation của packager; không bịa browser test trong bước packaging. |
| `INSTALL-RUN.md` | Hướng dẫn giải nén, xem trước và bàn giao thủ công theo đích. |
| `RELEASE-NOTES.md` | Release Notes của release snapshot, từ bằng chứng Step 5. |
| `ROLLBACK.md` | Giữ gói trước và backup, phục hồi thủ công; không tự xóa dữ liệu hoặc database. Nếu chưa có bản trước thì ghi rõ chưa có gói rollback. |
| `SHA256SUMS.json` | Hash và kích thước các file payload; hash ZIP được kiểm tra riêng, bảo vệ cả manifest. |

Gói và lịch sử được lưu ngoài Agent worktree, thuộc dữ liệu ứng dụng. Mỗi lần chuẩn bị có ID, target/revision, source commit, snapshot hash và status riêng. Đổi target hoặc tạo gói mới không ghi đè archive cũ. Tải lại kiểm tra hash bản ghi và ZIP; archive bị sửa không được trả về như một gói hợp lệ.

## Trạng thái trung thực và bảo vệ

- **READY**: validation và tạo archive thành công trong phạm vi adapter. Không đồng nghĩa đã cài, chạy ở production hay Deployed.
- **UNSUPPORTED**: chưa có adapter/công nghệ được kiểm chứng, framework/build step, Windows installer, asset thiếu hoặc external resource/module loader ngoài phạm vi.
- **BLOCKED**: chưa chốt release, snapshot/target revision lỗi thời, tác động kiến trúc chưa được xử lý, đường dẫn/symlink không an toàn, file hoặc tài liệu có dấu hiệu credential.
- **FAILED**: không hoàn tất đọc Git/đóng gói do lỗi thực thi; không có artifact thành công được công bố.

Không đóng gói `.env`, key, credential profile, Vault, submodule hay symlink. Kiểm tra tên portable và trùng tên khi không phân biệt hoa/thường, giới hạn 1000 file Git, 2 MB/file và 10 MB tổng dữ liệu được đọc. Resolve asset/import dựa trên cú pháp literal được hỗ trợ, không chứng minh mọi hành vi JavaScript động đều độc lập mạng. Quét credential theo mẫu và redactor hiện có là bộ lọc bảo thủ, không chứng minh mọi bí mật bị obfuscate đều được phát hiện; PO vẫn cần xem nội dung bàn giao.

Ứng dụng AI Project OS có package name `ai-project-os-personal` bị từ chối trong adapter. ZIP chỉ được tạo từ workspace riêng của project và commit release, không từ thư mục cài AI Project OS. Hàm ZIP thuần có sẵn được tái sử dụng; không gọi updater, installer, launcher hoặc quy trình phát hành AI Project OS.

## Ranh giới triển khai

Step 6 không push GitHub, không SSH/cài on-premises, không upload cloud và không gọi Vercel/Supabase deployment. Các tính năng cloud tùy chọn đã có được giữ nguyên để người dùng chủ động sử dụng riêng. Chọn Deployment Target không gọi các tính năng này.

Đối với Not Specified, READY chỉ xác nhận gói static và khả năng xem trước cục bộ; suitability production chưa được xác minh. Đối với Windows Desktop, lựa chọn target vẫn được lưu nhưng không tạo installer giả. Đối với on-premises/cloud manual, gói chỉ cung cấp artifact và hướng dẫn; quản trị viên chịu trách nhiệm môi trường, TLS, backup và quyền truy cập.

Xác nhận Deployed vẫn là hành động riêng của PO ở Step 5, chỉ sau khi thật sự triển khai/kiểm tra đích; các gate tác động target hiện hành vẫn áp dụng. Preview chạy trong kiểm thử không phải triển khai production. Không thực hiện Step 7.

## API và kiểm thử

Dùng browser session/same-origin checks sẵn có:

- GET `/api/projects/:id/deployment-target`: canonical target/revision, impact/history/decisions và adapter metadata.
- POST `/api/projects/:id/brief` hoặc `/settings` với `deploymentTarget`: cùng một cấu hình.
- POST `/api/projects/:id/deployment-target/impact`: PO xác nhận material/non-material với rationale, revision và Architecture ID/hash.
- POST `/api/projects/:id/releases/:releaseId/manual-handover`: nhận `adapterId`, snapshot hash và target revision; không nhận command/path.
- GET `/api/projects/:id/releases/:releaseId/manual-handover/:packageId/archive`: ZIP đã xác minh hash.

[Chi tiết kiểm thử](evidence/step6/test-results.json) · [Kết quả Chrome](evidence/step6/ui-results.json)

Ảnh thật với fixture riêng: [Idea target](evidence/step6/idea-target-dark.png), [Đánh giá tác động](evidence/step6/target-impact-review.png), [Gói READY · dark](evidence/step6/handover-ready-dark.png), [Gói READY · light](evidence/step6/handover-ready-light.png), [Mobile](evidence/step6/handover-mobile.png), [Thay đổi Windows cần kiến trúc mới](evidence/step6/target-material-blocked.png).

[Gói ứng dụng fixture đã tải qua API](evidence/step6/HANDOVER-v0.1.0.zip). Script `node tools/verify-manual-handover-ui.mjs` dùng Chrome/CDP, Native Worker/Git/npm tests thực, tạo/tải/giải nén ZIP và chạy `preview.mjs` trên loopback. Đây là ứng dụng fixture do quy trình Agent tạo, không phải bộ cài AI Project OS hay triển khai máy chủ thật.

Các lỗi hồi quy rộng ngoài phạm vi đã ghi ở Step 5 không được coi là đã sửa trong Step 6. Lượt nghiệm thu Step 6 tập trung target/packaging và hồi quy Idea, Council, Architecture Guard, release, PRD, task execution, provider, Git/sandbox và Personal foundation.

Kết quả: **119/119** ca nghiệm thu và hồi quy liên quan đạt; lượt kiểm tra cuối context/API/packaging **20/20** đạt. Các lượt chạy có ca trùng nhau, không cộng số lượng. Syntax/diff checks và Chrome UI thực đạt. ZIP fixture đã tải qua API, kiểm tra hash, giải nén và chạy trên loopback; không triển khai production.
