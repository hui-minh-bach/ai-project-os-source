# Tài liệu yêu cầu dự án (PRD) — Personal Edition

PRD nằm trong tab **AI Council**, dưới Specification, và có lối vào từ Idea Studio. Sau khi PO bấm **Chốt specification**, ứng dụng chiếu các trường đã duyệt thành PRD chính thức vN. Không có nút duyệt PRD riêng, không dùng hội thoại Founder/Council chưa được chốt làm nguồn.

Các mục gồm: mục tiêu kinh doanh, phạm vi, ngoài phạm vi, yêu cầu chức năng, luồng người dùng, yêu cầu phi chức năng và bảo mật, dữ liệu, tích hợp và tiêu chí nghiệm thu. Mục trống được ghi rõ là chưa xác định, không tự suy đoán. Metadata gồm ID Specification, phiên Council, version, thời điểm duyệt và SHA-256 nội dung. PRD mới được khóa dấu vân tay ngay trong thao tác chốt Specification hiện có.

Các bản đã duyệt cũ vẫn xem/xuất được khi Specification hiện hành đổi. Dự án tạo trước tính năng này dùng provenance từ Council và metadata phê duyệt đã có; nhãn xác minh `legacy-council-provenance` cho biết không có hash chụp tại lúc duyệt cũ. Nếu nội dung cũ khác kết luận Chair lưu kèm, PRD bị từ chối.

Worker và Reviewer nhận toàn bộ PRD cùng version/hash trong context; Project Manager cũng lập kế hoạch từ PRD. Mỗi run lưu `requirementsVersion` và `requirementsHash`; kiểm tra lại nội dung trước và sau từng lượt, kể cả trước merge. PRD được lưu dưới dữ liệu ứng dụng, không tạo file chính thức có quyền ghi trong workspace agent. API chỉ có GET danh sách, từng bản và Markdown download. Browser phải có phiên local hợp lệ; POST/PATCH/DELETE bị từ chối. Chế độ external shell/Host vốn được đánh dấu UNSAFE của Core có quyền máy chủ rộng hơn; PRD hash giúp phát hiện thay đổi nội dung khi run tiếp tục, nhưng không phải cơ chế cách ly hệ điều hành tuyệt đối trước phần mềm chạy cùng tài khoản người dùng.

Markdown là file tải về từ dữ liệu đã duyệt. Export không sửa trạng thái, không tự đăng lên cloud. Dữ liệu dự án cũ không bị migration hay ghi lại khi chỉ xem PRD.
