# AI Project OS v0.9.63 - Một nút bàn giao web (R6)

Bản source đầy đủ, không phải EXE cài đặt mới. Dựa trên R4; phần R5 bị gián đoạn chưa có source đã xác minh để gộp.

## Mở bản mới

1. Đóng app cũ và Local Worker. Sao lưu dữ liệu trước khi đổi bản.
2. Giải nén vào thư mục mới, chạy `RUN-WINDOWS.cmd`.
3. Mở Vault bằng mật khẩu cũ. Không xóa thư mục dữ liệu cũ.
4. Chọn dự án trong Idea Studio. Khung phòng 3D vẫn là Team R3.

## Quy trình

Kết nối AI, Vercel và Supabase khi cần -> Chuẩn bị giao việc -> Đọc yêu cầu và phạm vi -> Chốt một lần -> Đội AI làm / review / test -> Tạo hạ tầng -> Triển khai -> Nhận link + QR + ZIP source tại bảng sản phẩm.

Kết nối cloud phải là token quản trị lưu trong Vault. Kết nối plugin ở ChatGPT không tự cấp quyền cho app trên máy. Chọn đúng Team / Organization khi app đọc danh sách.

Cần Git và Node/npm. Chế độ Docker cần Docker đang chạy; Host chạy mã trực tiếp trên máy nên phải được đồng ý rõ ràng. App không bỏ test để báo xong.

## Khi gặp lỗi

Đọc lỗi, sửa kết nối hoặc điều kiện thiếu, rồi bấm **Tiếp tục / đối soát lượt này**. Không tạo lại dự án vì mất mạng. Dừng không xóa tài nguyên cloud đã tạo. Mỗi lượt bàn giao mới hiện dùng hạ tầng mới, không tự nâng cấp database khách cũ.

## Giới hạn phải biết

Đây là luồng thử có kiểm soát cho web static / Vite / Next.js, không phải cam kết mọi sản phẩm A-Z. Supabase hiện hỗ trợ bảng dữ liệu theo chủ sở hữu và bucket riêng tư. Chưa tự mua tên miền, cấu hình thanh toán/email, build app mobile/EXE hoặc xác nhận nghiệp vụ cho mọi ý tưởng.

Kiểm thử dùng AI/cloud giả lập cô lập, server/app/file/test/Git thật. Chưa nghiệm thu cloud và tài khoản thật của khách, Windows/GPU, hay RLS qua hai tài khoản Supabase thật. Xem `evidence/one-button-r6/` và `docs/ONE_BUTTON_R6_ACCEPTANCE.md`.
