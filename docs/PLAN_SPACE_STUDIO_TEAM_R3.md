# Idea Space Studio R3 - Kế hoạch và tiến trình

## Mục tiêu đã được chủ dự án duyệt
Giữ nguyên căn phòng R2 trong ảnh Windows được duyệt. Chỉ giảm chói nhẹ, thêm đội robot từ tài khoản AI thật, bảng tên/vai trò/trạng thái và hành vi theo công việc thật. Không thiết kế lại phòng, không thay robot TAM19, không chỉnh luồng tài khoản, thanh toán, công thức, media, phân việc, duyệt hoặc triển khai.

## 1. Khóa phạm vi và bản nền
- Nguồn: AI_Project_OS_v0.9.61_SPACE_STUDIO_R2_FULL_SOURCE.zip, SHA-256 4fecf778a635bd6cf931e35e557903f16221a50b23816c2e747166cd76ba1fe2.
- Giữ 9 bàn, khu điều phối, lounge, 4 khoang sạc, khoang năng lượng, camera và toàn bộ hình học/mỹ thuật phòng.
- Không lưu tài khoản, email, khóa API hoặc dữ liệu người dùng trong gói bàn giao.
- Bản source giữ phiên bản ứng dụng 0.9.61; tính năng có revision riêng space-studio-team-r3.

## 2. Ánh sáng
- Mặc định bằng 85% exposure trước, giảm quầng sáng nhẹ; không đổi palette và mô hình.
- Thanh độ sáng riêng có lưu lựa chọn cục bộ; có thể trở lại 100%.
- Không tự hạ chất lượng chỉ vì màn hình có tỉ lệ điểm ảnh cao.

## 3. Nguồn dữ liệu thật (chỉ đọc)
- Endpoint riêng /api/office/space-fleet, cùng kiểm soát session và Vault hiện có. Giữ nguyên /api/office/fleet cho phòng cũ.
- Một connectionId AI duy nhất tương ứng một robot. Không dùng email để nhận diện; tên giống nhau vẫn là hai tài khoản khác nhau. Không sinh robot placeholder.
- Đọc phân vai founder/council/worker/reviewer, executionRuns đóng băng của task, council members đang chạy và lượt orchestrator.
- Gắn quan sát tối thiểu quanh lời gọi provider đã định tuyến để tài khoản dự phòng được nhận đúng; không đổi đầu vào, thứ tự routing, giá trị trả về, exception hoặc số lần gọi. Không ghi prompt/response/secret.
- Phân biệt request AI thật, tác vụ được phân công, bước engine, đang chờ, quota, offline, lỗi và mô phỏng. Không coi video render đang chạy là provider đang trả lời.
- Tắt/khóa/mất phiên/mất kết nối phải dừng trạng thái làm việc trực tiếp; không giữ nhãn working vô hạn.

## 4. Hiển thị và hành vi
- Clone TAM19 từ asset có sẵn; mỗi bộ khớp độc lập, geometry/material dùng chung khi phù hợp.
- Bảng tên neo đầu robot, click chọn để xem tên, provider, phân vai, công việc, nguồn trạng thái. Không chèn tên bằng innerHTML.
- Chỗ ngồi giữ ổn định trong phiên; một bàn một robot; nhiều hơn 9 tài khoản vẫn có trong danh sách và khu chờ (không nhân thêm nội thất).
- Khi mở phòng, phục hồi tư thế ban đầu không tạo lịch sử việc giả. Robot sẵn sàng có thể ngồi nghỉ; chỉ gõ bàn phím khi dữ liệu việc phù hợp.
- Khi nhận việc từ khu chờ: tìm đường theo không gian hiện có, đi tới điểm cạnh ghế, nắm/kéo, đứng trước ghế, ngồi, dịch vào bàn, làm việc.
- Khi hoàn tất/ngắt việc: dừng gõ, lùi ghế, đứng, trả ghế, đi về khu chờ. Công việc đổi giữa chuyển động phải được cập nhật tức thì và hoàn thành chuyển tư thế an toàn.
- Bảo lưu chỗ ngồi trong lúc ra/vào. Hành lang có quyền đi; không có đường thì chờ, không xuyên vật thể/teleport. Dùng chuyển động gọn phù hợp khoảng cách các hàng bàn; giữ demo R2 nguyên vẹn.
- Tạm dừng chỉ dừng hoạt cảnh, không hủy task thật. Demo được gắn nhãn và tách hẳn khỏi đội thật.

## 5. Kiểm tra và tiêu chí bàn giao
- Unit: 0/1/nhiều tài khoản, trùng tên, thêm/xóa/đổi tên, đổi phân vai, dự phòng, quota, offline, khóa Vault, dữ liệu cũ, tác vụ đồng thời.
- Motion: không trùng ghế, cùng ID giữ vị trí, không đi qua bàn, hành lang chờ an toàn, hông/mặt ghế đồng bộ, không đứng trên đệm, chân/tay đúng điểm tiếp xúc.
- Lifecycle: mở/đóng liên tục, đổi tab khi đang tải GLB, resize, camera, pause/resume, reload, mất GLB và WebGL.
- HTTP: phiên bắt buộc, chỉ GET, không lộ secret, không làm thay đổi task, không tự gọi nhà cung cấp.
- Hồi quy: chạy nhóm office/model-routing/account/task + bộ test toàn dự án; so sánh dấu kiểm tra file ngoài phạm vi.
- Hình ảnh: kiểm tra từ source thật. Nếu WebGL không chạy, kiểm tra geometry/pose ngoại tuyến và ghi rõ chưa kiểm chứng GPU/Windows; không gọi đó là ảnh chụp ứng dụng Windows.

## Không làm trong đợt này
Không xây lại căn phòng; không thêm quản lý dự án khác; không tự chọn model/mua API; không thêm cron hay bật tự chạy có phí; không thêm tab; không coi hoạt cảnh là kết quả AI.

## Trình tự thực hiện
Khóa baseline -> dữ liệu read-only -> roster và ghế -> hoạt cảnh -> giao diện và độ sáng -> kiểm tra hành vi/hồi quy/hình ảnh -> ZIP full. Tiến độ thực được lưu trong .project-state/state.json và evidence/space-studio-r3; mỗi tiêu chí chưa được thực nghiệm phải ghi rõ.

## Tiến độ bàn giao R3

| Chặng | Kết quả trong gói source | Bằng chứng |
|---|---|---|
| 1. Khóa bản nền | Hoàn tất; 488/502 file cũ giữ nguyên, 14 file đổi đúng phạm vi | protected-scope.json |
| 2. Giảm chói | Hoàn tất; 85% mặc định, thanh 60-105%, không đổi palette | browser-geometry.json, hero.png |
| 3. Robot theo tài khoản | Hoàn tất; ID riêng, tên/vai trò/trạng thái, thêm/xóa/đổi tên | 80 test Space Studio, 21 kiểm tra scene/DOM |
| 4. Hoạt cảnh theo việc | Hoàn tất trong source; đặt ghế, chờ lối đi, ngồi/làm/đứng/trả ghế | live-motion tests, browser-geometry.json, video fixture |
| 5. Tích hợp và đóng gói | Hoàn tất kiểm tra source/Linux, 567 test đạt, 1 bỏ qua | verification.json, state.json |

**Chưa kiểm thử:** GPU/WebGL thực tế, FPS và cài đặt trên Windows, lượt gọi AI có phí bằng tài khoản của người dùng. Các mục này không được đánh dấu đạt bằng unit test. Video/ảnh dùng 6 tài khoản thử, không phải dữ liệu thật của chủ tài khoản.
