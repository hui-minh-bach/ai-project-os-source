# Step 3 — Architecture Lite

Phạm vi: Step 3 của Personal Edition. Chưa triển khai Step 4.

## Sử dụng

1. Tạo Specification trong AI Council từ brief hiện tại.
2. Tại Idea Studio hoặc AI Council, chọn **Tạo đề xuất**. Model Founder đã cấu hình thực hiện vai Technical Architect với skill `system-architecture` và `security-review` hiện có.
3. Đọc tám nhóm nội dung: tổng quan; Tech Stack với lý do và đánh đổi; cấu trúc module; trách nhiệm và ranh giới; luồng dữ liệu và lưu trữ; tích hợp và API contracts; bảo mật/NFR; ràng buộc triển khai và quy tắc kiến trúc. Độ dài theo độ phức tạp; không có yêu cầu 27 mục.
4. Chốt Specification nguồn, rồi tại AI Council đánh dấu xác nhận của PO và chọn **PO duyệt kiến trúc**. AI tạo đề xuất không thể tự chuyển trạng thái thành Approved.
5. Project Map hiển thị baseline được duyệt. Tải `ARCHITECTURE-vN.md` từ bản đã duyệt hoặc lịch sử.

Idea Studio, AI Council và Project Map dùng cùng dữ liệu component/relationship, dựng SVG cục bộ, không có animation hay dịch vụ bên ngoài. Giao diện dùng font, màu và các thành phần hiện có. Proposed, Approved và Outdated có nhãn riêng; bản lịch sử vẫn đọc và tải được.

## Phiên bản và bảo vệ baseline

- Mỗi đề xuất hợp lệ có ID, phiên bản tăng dần, ID và phiên bản Specification nguồn, fingerprint yêu cầu và hash nội dung.
- Duyệt yêu cầu phiên bản hiện tại, hash đúng bản PO đã đọc và `explicitApproval: true`; Specification nguồn phải đã được PO chốt. Không thay baseline khi task đang chạy.
- Brief/Specification đổi hoặc phiên bản bị thay thế khiến tài liệu thành Outdated. Bản đã duyệt trước đó được giữ nguyên trong lịch sử. Đề xuất mới cùng Specification không thay baseline đang được duyệt cho tới khi PO phê duyệt phiên bản mới.
- Baseline có thẩm quyền nằm trong kho dữ liệu ứng dụng, ngoài workspace/worktree của Agent. Không có API sửa/xóa tài liệu baseline. Các API duyệt dùng phiên browser hiện có và kiểm tra cùng nguồn; operator token không có quyền duyệt kiến trúc.
- Native workspace tools giới hạn trong workspace; thay một bản Markdown ở đó không thay baseline. Hash được kiểm tra khi đọc, xuất hoặc dùng tài liệu. Đây là ranh giới ứng dụng và workspace hiện tại; chế độ Host/External unsafe vẫn là quyền thực thi do người dùng tin cậy, không phải sandbox chống tiến trình độc hại có toàn quyền máy.
- Dự án mới phải có kiến trúc được duyệt trước khi lập kế hoạch hoặc chạy Worker. PM, Worker và Reviewer nhận cùng tài liệu đã duyệt; run ghi lại hash và từ chối merge khi baseline thay đổi.

## Baseline đầu tiên · chính sách hiện hành từ Step 5

Theo yêu cầu PO, đây là phiên bản đầu tiên và không phân loại dự án legacy. Dự án bắt đầu ở trạng thái chưa có baseline. Cần tạo Specification và Architecture Lite rồi PO phê duyệt trước khi coding, merge hoặc tạo release. Không tự chuyển văn bản cũ thành baseline được duyệt, không có nhánh WARNING để bỏ qua điều kiện này. Bằng chứng Step 3 giữ nguyên theo lịch sử; chính sách trên thay thế phần tiếp nhận legacy trước đây.

## Xác minh

- `npm run check`
- `node tools/run-tests.mjs test/project-architecture.test.mjs test/project-prd.test.mjs test/project-prd-agent.test.mjs test/project-prd-api.test.mjs test/council-contract.test.mjs test/map-contract.test.mjs test/team-execution-contract.test.mjs`
- `node tools/verify-architecture-ui.mjs` — Chrome headless thực, dữ liệu tạm riêng và AI giả lập qua HTTP local. Script dùng Chrome tại đường dẫn macOS; không cần thư viện diagram hay browser dependency mới.

Bằng chứng UI thực: [kết quả](evidence/step3/ui-results.json), [Idea Proposed](evidence/step3/idea-proposed.png), [Council Approved](evidence/step3/council-approved.png), [Map Approved](evidence/step3/map-approved.png), [Map Outdated](evidence/step3/map-outdated.png), [mobile](evidence/step3/idea-mobile.png), [Markdown đã tải](evidence/step3/ARCHITECTURE-v1.md). Tất cả là dữ liệu fixture, không phải PO duyệt dự án thật.

Hai sửa hồi quy liền kề: xác nhận Specification lặp lại không thay `updatedAt`; PRD lịch sử không còn hiện hành sau khi brief đổi.

Kiểm tra rộng ngoài tập nghiệm thu: **427 test, 378 đạt, 44 lỗi, 5 bỏ qua**, loại `account-usage.test.mjs` vì hai lần chạy toàn bộ đều treo sau khi báo các check thành công của file này. Các lỗi gồm thiếu FFmpeg, media samples và office assets, cùng các assertion UI/connection-area/skill/publish khác. [Danh sách lỗi và phạm vi chạy](evidence/step3/regression-results.json). Không kết luận toàn bộ repository đã đạt; không mở rộng Step 3 sang sửa các hệ thống này.

Tập nghiệm thu Step 3 và các luồng liền kề: **40/40 đạt**. Sau cùng, chạy riêng **4/4** ca kiến trúc để xác minh thêm cổng tiếp nhận dự án cũ khi còn task đang chạy. Syntax và diff checks đạt. [Kết quả kiểm thử chi tiết](evidence/step3/test-results.json).
