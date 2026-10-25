# AI Project OS v0.9.62 - Workflow Reliability R4

## Mở bản mới
Đây là ZIP source đầy đủ, không phải bản vá hay EXE cài đặt mới.

Đóng AI Project OS cũ (kể cả cửa sổ Local Worker) → giải nén vào một thư mục mới → chạy `RUN-WINDOWS.cmd` → mở Vault bằng mật khẩu cũ. Launcher phải báo **v0.9.62**; phòng 3D vẫn là **Team R3** đã duyệt.

Sao lưu dữ liệu trong app trước khi đổi bản. Không xóa `%LOCALAPPDATA%\AIProjectOSLocal\data`. Bản source không kèm tài khoản/API key hay dữ liệu khách hàng. Node.js 22+ và Git cần thiết cho luồng task/worktree; không cần cài npm dependencies cho phần app chính.

## Giao việc và chuyển AI
**Kết nối**: giữ tài khoản đã đăng nhập; chọn model có trong danh mục của chính tài khoản đó. Phân vai Founder, Council, Worker và Reviewer. Nên chọn Reviewer khác Worker. Có thể chỉ định AI dự phòng cho từng vai.

**Idea Studio**: gửi yêu cầu, sau đó bấm **Nhận việc & giao đội**. Nút này nay chạy phân tích và Council thật, không chỉ chuyển tab. Specification vẫn cần ông duyệt. Sau khi duyệt, bấm lại nút nhận việc để lập task và chạy các đợt phụ thuộc; hoặc tạo task từ Council rồi bấm **Chạy task sẵn sàng song song**.

Nếu A bị lỗi kết nối/xác thực/hạn mức/hết thời gian/model không khả dụng hoặc JSON sai, bộ điều phối thử AI dự phòng và các AI phù hợp trong phạm vi đã chọn. B nhận **cùng task, specification, lịch sử kết quả công cụ và workspace**. Thứ tự ưu tiên: AI đã tiếp nhận trong lượt hiện tại; AI chính; dự phòng của vai; các lựa chọn hợp lệ còn lại.

Phần cấu hình AI Team có **Tự chuyển AI khi lỗi**, **Phạm vi dự phòng** và **Tối đa AI thử/bước**. Mặc định thử tối đa 4 lượt/model-binding cho một lời gọi suy luận; không lặp vô hạn. Dự phòng có thể tiêu thụ hạn mức/chi phí của tài khoản khác. Chọn **Chỉ AI đã phân vai dự án** để giới hạn phạm vi chạy.

Nhật ký hiển thị A lỗi gì, chuyển sang B nào, model nào thật sự trả kết quả. Nếu tất cả AI không khả dụng, app giữ lại yêu cầu, báo lỗi và thời điểm có thể thử lại. **Thử lại** tin nhắn sử dụng lại ID cũ, không nhân đôi công việc.

## Tin tức và quy trình nội dung
Yêu cầu tin tức trong chat được đối chiếu thẻ tin/RSS đã cấu hình trong Radar, theo **ngày xuất bản UTC+07**, không phải ngày app tải tin về. Chưa có nguồn phù hợp thì app nói rõ thiếu dữ liệu; không tự bịa giá vàng hay coi tin cũ là tin hôm nay. Đây **không phải** công cụ tìm toàn bộ Internet.

Thẻ tin không tồn tại, thiếu video hay ý tưởng sẽ bị chặn **trước khi** tạo dự án/lượt chạy rác. Lượt nội dung lỗi có thể thử lại tại Publish: giữ cùng run/project, kịch bản và bước media đã xong. Không tự đăng lại khi lần đăng trước chưa rõ thành công hay thất bại; phải đối chiếu biên nhận trước.

## Giới hạn và an toàn
Phòng 3D/asset R3 được giữ nguyên. Chuyển AI áp dụng cho lời gọi văn bản Founder/Council/Native Worker/Reviewer và các bước media dùng chung bộ gọi. Lỗi công cụ, shell engine bên ngoài, quyền truy cập, Vault khóa, thay đổi danh tính, yêu cầu an toàn bị từ chối và specification cũ **không** được lách qua bằng cách đổi model.

Safe sandbox vẫn không chạy npm/shell. Đã merge file không đồng nghĩa test chạy PASS: app giữ riêng biên nhận test thật và review văn bản. Không tự cài/nâng gói AI hay nới quyền công cụ Antigravity.

Kiểm tra trong lần bàn giao này dùng Linux, HTTP server thật và AI fixture cục bộ. UI chạy trong Chromium harness nội bộ, truyền API qua bridge vì chính sách trình duyệt chặn localhost; không thay đổi chính sách đó. Không chạy lại WebGL trong harness này. **Chưa kiểm thử tài khoản AI thật, chi phí API, Windows/GPU hay đăng nội dung thật**. Xem `evidence/workflow-r4/verification.json`.

## Kiểm thử và tiếp tục dự án
`npm run check` → `npm test`; nhóm riêng: `npm run test:workflow`.

Kế hoạch: `docs/PLAN_WORKFLOW_RELIABILITY_R4.md`. Chi tiết thay đổi: `docs/R4_IMPLEMENTATION.md`. Tiến trình: `.project-state/state.json`. Skill điều phối đã nằm trong `.agents/skills/`; không có lời hứa chạy vĩnh viễn hay cài tự động vào tài khoản ChatGPT.
