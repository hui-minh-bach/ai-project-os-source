# Thông báo quyền riêng tư — AI Project OS v0.6.0 local

- Theo thiết kế hiện tại, UI/backend chạy trên `127.0.0.1`; không cung cấp login từ Internet, telemetry mặc định hay quảng cáo trong ứng dụng.
- Dữ liệu dự án, Vault và các tệp Media nằm trên máy chủ local của người dùng. Kết nối model/API/đăng nhập bên thứ ba chỉ diễn ra sau thao tác hoặc cấu hình của người dùng; nội dung gửi tới provider chịu điều khoản của provider đó.
- TTS HeyGen có thể xử lý lời thoại trên hệ thống của HeyGen, có giới hạn và tính phí riêng. Không lưu HeyGen key trong frontend; kết nối lưu trong AES Vault của ứng dụng.
- Tạo backup sử dụng AES-256-GCM, password được nhập trên máy local; file backup có thể bao gồm cả thông tin đăng nhập ứng dụng và dữ liệu cá nhân. Người dùng tự bảo vệ file và mật khẩu.
- Xuất bản GitHub/Vercel là thao tác riêng sau khi người dùng cấp quyền. Không tự động đăng mạng xã hội.
- Bản này chưa có hệ thống quản lý người dùng đa thuê bao, thu phí, và yêu cầu pháp lý GDPR/luật Bảo vệ Dữ liệu Cá nhân cần được chủ sở hữu xem xét trước khi bán rộng rãi.
