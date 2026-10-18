# Lưu ý quyền sử dụng khi phát hành cho khách

Ứng dụng là sự kết hợp mã nguồn riêng của AI Project OS, AI Core và AI Media Engine do chủ dự án cung cấp. Việc bán lại/cho thuê phải dựa trên xác nhận quyền sở hữu và hợp đồng của chủ dự án; đây không phải chứng nhận pháp lý về quyền sở hữu mọi thành phần.

- Node.js portable được tải trực tiếp từ nodejs.org tại máy khách, bản ZIP của chúng tôi không phát hành lại binary Node. Node.js có giấy phép riêng trong archive chính thức.
- Git for Windows được cài riêng theo lựa chọn khách bằng `INSTALL-CODE-TOOLS-WINDOWS.cmd` (winget), không bundle trong ZIP. Git được phát hành theo giấy phép GPL-2.0.
- FFmpeg/ffprobe **không được bundle** trong ZIP thương mại thử nghiệm. Tệp `INSTALL-VIDEO-TOOLS-WINDOWS.cmd` chỉ đề nghị khách tự cài Gyan.FFmpeg thông qua winget, tuân thủ giấy phép GPL của nhà phân phối.
- Danh mục các engine ngoài chỉ mô tả và có thể clone từ upstream theo thao tác người dùng; không tự sao chép mã của họ vào gói phát hành.
- Các tài liệu, video minh họa hoặc ảnh dùng quảng cáo phải được chủ sở hữu xác nhận quyền thương mại trước khi phát hành chính thức.
- Chưa triển khai license activation hoặc hệ thống thanh toán. Không quảng cáo là bản có quản lý thuê bao/khóa bản quyền.
