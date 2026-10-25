# Step 4 — Architecture Compliance Guard

Tài liệu mô tả guard của Step 4. **Chính sách hiện hành được PO cập nhật ở Step 5:** đây là phiên bản đầu tiên, không có loại dự án legacy hay miễn kiểm tra khi thiếu baseline. Bằng chứng Step 4 cũ giữ nguyên theo lịch sử; chính sách hiện hành ở dưới và trong `RELEASE-MANAGEMENT.md`.

## Hành vi

Task mới được server gắn với ID/phiên bản Specification đã duyệt, ID/phiên bản/hash Architecture đã duyệt, các component áp dụng, hash quy tắc và hash acceptance criteria. Trước Worker, server kiểm tra lại các tham chiếu và yêu cầu tiêu chí nghiệm thu không rỗng. Worker và Reviewer nhận baseline chỉ đọc, module responsibilities/boundaries, rules, policy và acceptance criteria. Reviewer nhận thêm receipt kiểm tra kiến trúc từ runtime.

Mặc định task tham chiếu toàn bộ component vì không tự suy đoán scope từ văn bản. PO có thể giới hạn `moduleIds` khi gắn baseline qua API. Các ranh giới import giữa module vẫn được thực thi dù task liên quan nhiều component.

- **PASS**: các kiểm tra xác định trong phạm vi hỗ trợ đạt; không khẳng định mọi hành vi của chương trình đều đúng.
- **WARNING**: có giới hạn kiểm chứng, mã cần semantic review, module mới hoặc khả năng trùng chức năng. Receipt ghi rõ lý do; không biến nhận định AI thành bằng chứng chắc chắn.
- **BLOCKED**: vi phạm/không kiểm chứng được thay đổi quan trọng; không được merge, kể cả khi `reviewRequired: false` hoặc model Reviewer muốn duyệt.

Idea Studio hiển thị Architecture Compliance Guard trong chi tiết task, phiên bản nguồn và receipt. Task bị chặn giữ branch để PO xem diff, cùng Architecture Change Proposal trong AI Council. Có thể sửa code để tuân thủ baseline hiện tại hoặc tạo một phiên bản kiến trúc mới để PO duyệt. Không có nút “bỏ qua guard”.

## Chính sách PO duyệt cùng Architecture Lite

`compliancePolicy` là phần tùy chọn trong đề xuất Architecture Lite, hiển thị đầy đủ để PO đọc, được đưa vào hash baseline và Markdown xuất ra. Bổ sung policy cần đề xuất/phiên bản/PO approval mới; không sửa baseline cũ tại chỗ.

| Trường | Ý nghĩa |
| --- | --- |
| `modules` | `componentId`, các đường dẫn file/prefix thư mục, danh sách `allowedImports` tới component khác. Prefix thư mục kết thúc bằng `/`; `.` chỉ toàn project. Prefix cụ thể nhất quyết định module. |
| `dependencies` | Tên `npm:package` và chính xác giá trị version được phép trong package.json. |
| `protectedFiles` | File API/database/security/config cùng SHA-256 của nội dung PO cho phép. Giá trị `deleted` cho phép xóa chính file đó. |
| `rules` | ID, lý do, phạm vi `paths`, các chuỗi literal `forbiddenText`; không chạy regex/script do Agent cung cấp. |

Architect nhận inventory local với hash thực, manifests và thông tin đầy đủ/thiếu dữ liệu. Với Change Proposal, Architect nhận cả hash các file thay đổi và diff từ Git object được ghim. Đây là dữ liệu để đề xuất, không phải tự động cấp quyền. PO vẫn phải đánh giá lý do, đánh đổi và nội dung mới.

## Kiểm tra xác định

- Thêm/đổi dependency ngoài version đã duyệt bị chặn. Thay scripts, module resolution và cấu hình thực thi package phải có hash được PO duyệt. Lockfile, manifest hệ khác và định dạng chưa hỗ trợ cần hash mới được PO duyệt; không giả định dependency resolution đã được kiểm chứng.
- File hợp đồng API được bảo vệ bằng hash; đổi/xóa mà không có nội dung đích được duyệt bị chặn. Kiểm tra bảo thủ phát hiện export/chữ ký công khai bị bỏ/đổi; class, CommonJS, export-list và public syntax chưa phân tích đủ yêu cầu hash được duyệt.
- JS/TS import literal được đối chiếu với module paths và allowedImports. Import vượt root, không resolve được, alias không được hỗ trợ, import động hoặc loader gián tiếp bị chặn. Sensitive built-ins như `node:sqlite`, `node:fs`, `node:crypto`, network/process/VM cần PO duyệt hash code.
- Thay đổi đường dẫn API/database/security/deployment, schema/migration, dấu hiệu SQL/auth/permissions, script hoặc external resource trong HTML/SVG bị chặn bảo thủ nếu chưa có hash phù hợp.
- Sửa bản `ARCHITECTURE.md`, `PRD.md`, `SPECIFICATION.md` hoặc các tên baseline dành riêng trong task bị chặn. Baseline có thẩm quyền vẫn ở kho dữ liệu ứng dụng ngoài Agent worktree, không có API sửa/xóa tùy ý.
- Module mới tạo WARNING; file giống hệt Git blob đã có tạo WARNING về khả năng trùng chức năng. Rule literal bị vi phạm tạo BLOCKED.
- File lớn, binary/encoding không đọc được, symlink/submodule, tree/quy mô task vượt giới hạn kiểm tra tạo BLOCKED; không dựa vào diff bị cắt.

## Cổng chạy và merge

1. Trước Worker: xác minh các phiên bản nguồn và task reference; lỗi không gọi model hay tạo worktree.
2. Sau Worker commit, trước test và AI review: đọc các Git object bất biến, không dùng summary do Worker khai.
3. Trong khóa Git: xác minh task/run/worktree/branch/HEAD đã ghim và quét lại; gọi trực tiếp `mergeTask` mà thiếu execution hợp lệ không bỏ qua được guard.
4. Với dự án đã tiếp nhận Architecture Lite, Git merge dùng `--no-commit`; quét cây merge tạm và kiểm tra staged secrets trước khi tạo merge commit. Vi phạm hủy merge tạm, giữ HEAD trước đó.
5. Sau commit: xác minh lại baseline và cây kết quả, rollback nếu phát hiện drift. Rollback lỗi được ghi là main chưa xác minh và giữ branch để khôi phục.

Các kiểm tra độc lập với AI Reviewer. Không đổi cơ chế worktree riêng, Git lock, secret checks, review/test receipts hay quyền opt-in unsafe hiện có.

PO không thể thay baseline đang duyệt khi task còn chạy. Đề xuất mới có thể được chuẩn bị, nhưng chưa thành baseline. Nếu baseline bị đổi ngoài API trong khi Worker/Reviewer đợi, guard phát hiện và từ chối merge. Task cũ không tự chuyển sang phiên bản mới; PO dùng nút **PO: gắn Architecture hiện tại** (hoặc lập kế hoạch lại). Gắn baseline không miễn kiểm tra code.

API gắn task: `POST /api/projects/:id/tasks/:taskId/architecture-bind`, cần browser session hiện có, `explicitApproval: true`, `architectureId`, `contentHash` đang đọc, và tùy chọn `moduleIds`. Generic task update từ chối ghi các state/reference này. Operator token không cấp quyền duyệt/gắn kiến trúc.

Change Proposal được tạo từ receipt BLOCKED, chứa phiên bản gốc, findings, base/candidate SHA và hash nội dung file. Nút tại AI Council gọi luồng đề xuất Architecture Lite hiện có với `changeProposalId`. Chỉ PO duyệt phiên bản mới qua cổng Council mới đánh dấu proposal được chấp thuận. Policy mới vẫn phải cho phép đúng thay đổi đích; không có blanket waiver.

## Tương thích và giới hạn

- **Không có nhánh legacy cho dự án.** Dự án chưa có Specification/Architecture được PO duyệt là “Chưa có baseline”; coding, merge và tạo release bị chặn cho tới khi PO duyệt baseline đầu tiên. Trường `architectureRequired: false` hoặc thiếu trường này không bỏ qua guard. Specification thiếu hash chốt lúc PO duyệt cũng không được coi là baseline hợp lệ.
- Baseline Step 3 chỉ có văn bản vẫn đọc/xuất được. Thay đổi file tĩnh đơn giản có WARNING; mã thực thi bị chặn cho tới khi PO duyệt machine policy/hash phù hợp. Không tự bịa ranh giới đường dẫn từ văn bản.
- Task runner hiện hỗ trợ **Native** và **mini-SWE-agent**; cả hai dùng cùng guard coding/merge. OpenCode và các engine khác chưa thuộc đường task runner này, bị từ chối tại `runTask`. Adapter độc lập không có quyền bypass merge của managed project.
- Static analysis là bộ lọc bảo thủ cho JS/TS imports/public surfaces và các primitive/API/database/security đã liệt kê. Không chứng minh tương đương ngữ nghĩa, không phát hiện mọi cách obfuscation, không thay thế acceptance tests/human review. False positive có thể cần PO duyệt hash code chính xác. Duplicate detection chỉ nhận nội dung giống hệt; sự cần thiết và chức năng trùng ngữ nghĩa vẫn cần người xem xét.
- Giới hạn: tối đa 2000 file trong Git tree, 150 file thay đổi, 180000 byte/file text và 8 MB dữ liệu text/quét. Vượt giới hạn sẽ bị chặn, cần chia task hoặc mở rộng bộ kiểm tra.
- Native file tools và Git pipeline giữ ranh giới ứng dụng/worktree. Host/External unsafe vẫn là quyền thực thi do người dùng tin cậy; guard không phải sandbox chống tiến trình độc hại có toàn quyền máy hoặc người trực tiếp tự sửa Git/data bên ngoài ứng dụng.

## Bằng chứng kiểm thử

- Bộ nghiệm thu và hồi quy liên quan: `architecture-guard`, Architecture Lite, Council, PRD API/agent, Project Map, task execution, hardening và Personal foundation.
- Ca bắt buộc: CSS hợp lệ PASS; import xuyên module, đổi API/chữ ký BLOCKED; Reviewer tắt không bypass; baseline lỗi thời trước/trong Worker không merge; dự án chưa có baseline bị chặn và các luồng PRD/Council/worktree có baseline đã duyệt tiếp tục được kiểm thử.
- Ca bổ sung: dependency/database/security/baseline edits; dynamic loaders và inline script; sensitive database built-in, SQL; gọi merge trực tiếp; PO Change Proposal tạo baseline mới rồi chạy lại; cây merge từ main đồng thời bị chặn trước commit; duplicate/new module WARNING; scan không đầy đủ BLOCKED.

[Chi tiết kết quả](evidence/step4/test-results.json) · [Kết quả Chrome thật](evidence/step4/ui-results.json)

Ảnh thực, dữ liệu fixture riêng: [Task BLOCKED](evidence/step4/task-blocked.png), [Task PASS](evidence/step4/task-pass.png), [Change Proposal chờ PO](evidence/step4/council-change-proposal.png). Script tái hiện: `node tools/verify-architecture-guard-ui.mjs` (Chrome macOS, CDP, không thêm dependency).

Không chạy lại toàn bộ bộ test không liên quan của repository trong Step 4; các giới hạn/lỗi hồi quy rộng đã ghi trong bằng chứng Step 3 không được coi là đã khắc phục ở đây.

Kết quả: **79/79** trong bộ nghiệm thu/hồi quy liên quan; mở rộng guard nhạy cảm **24/24**; kiểm tra cuối cho public API và compliant flow **3/3**. Các lần chạy có ca trùng nhau, không cộng số lượng. Syntax/diff checks đạt; Chrome UI thực đạt.
