# Space Studio Team R3 - bản nâng cấp có giới hạn phạm vi

## Mở bản này
Đóng AI Project OS cũ. Giải nén ZIP full vào một thư mục mới, chạy `RUN-WINDOWS.cmd`, mở Idea Studio và chọn **Phòng 3D R3**. Cần Node.js 22 trở lên theo yêu cầu sẵn có của dự án. Đây là source full, không phải một EXE cài đặt mới.

Bản nền vẫn là **0.9.61**, revision phòng là **space-studio-team-r3.0**. Không thay đổi cơ chế lưu dữ liệu Windows: thư mục người dùng nằm ngoài source. ZIP không chứa tài khoản, khóa API hay dữ liệu tiệm. Không chồng các bản vá cũ lên bản full này.

## Những gì giữ nguyên
Toàn bộ hình học phòng đã duyệt: 9 bàn, ghế, khu lãnh đạo, lounge, sàn, cây, khoang sạc, buồng năng lượng, vật liệu, các góc camera và model TAM19. Không vẽ lại phòng, không thay ngoại hình robot.

Các luồng đăng nhập, Vault, phân vai, hạn mức, chuyển tài khoản dự phòng, chạy task, review, media, publish, lưu trữ và phòng cũ không bị thiết kế lại. Lời gọi provider chỉ được bọc một lớp quan sát tối thiểu, giữ nguyên kết quả/lỗi/định tuyến.

## Đội robot
Mỗi kết nối AI trong tab Kết nối được nhận diện bằng `connectionId`, không phải tên hay provider. Hai tài khoản trùng tên vẫn là hai robot. Một tài khoản kiêm nhiều vai vẫn chỉ có một robot. Không tự thêm robot trình diễn vào đội thật.

Tên, vai trò, trạng thái hiển thị trên nhãn và danh sách dưới phòng. Nhấn nhãn/robot/danh sách để xem chi tiết; nút cận cảnh đưa camera tới đúng robot. Đổi tên, thêm, xóa kết nối được đồng bộ qua GET cục bộ, mỗi khoảng 2,5 giây sau khi lần đọc trước hoàn tất. Đóng phòng, chuyển tab hoặc ẩn cửa sổ sẽ dừng polling tương ứng.

9 ghế có đặt chỗ riêng. Khi nhiều AI hơn bàn, robot còn lại ở vị trí chờ; không chồng người hay tự tạo thêm bàn. Đã kiểm tra 24 tài khoản thử. Diện tích phòng hữu hạn; khi không còn vị trí hợp lệ, tài khoản vẫn có trong danh sách và không được đặt xuyên nội thất.

## Automation đúng nghĩa trong bản này
Phòng đọc công việc đang chạy **trong AI Project OS**: task native, Worker/Reviewer, Council, luồng render và lời gọi AI thật sau định tuyến. Nguồn trạng thái được ghi rõ; chờ engine không bị gắn nhãn đang gõ code.

Robot ở bàn sẽ chuyển sang tư thế làm việc khi nhận task. Robot ở khu chờ sẽ tìm đường, tới bàn đã đặt, chạm/kéo ghế, ngồi và làm. Khi xong, robot đứng dậy, trả ghế và về khu chờ. Một robot di chuyển qua lối đi mỗi lần để giảm giao cắt; các AI thật vẫn chạy đồng thời. Việc chờ ghế/lối đi chỉ là hoạt cảnh, không giữ task.

**Mở phòng không tự gọi AI, không tạo task, không tiêu hạn mức.** Bản này không theo dõi các cuộc chat độc lập trên website ChatGPT/Claude/Gemini bên ngoài app. Tài khoản sẵn sàng là theo cấu hình/model catalog cục bộ; không phải bảo đảm provider luôn đang online.

## Điều khiển
Độ sáng mặc định **85%**; thanh trượt 60-105% lưu riêng trong trình duyệt. Nút **Dừng chuyển động** chỉ dừng hình ảnh, không hủy công việc. Nút **Xem demo** giữ nguyên bài diễn họa R2 riêng, có nhãn DEMO. Có thể tắt nhãn tên và về phòng cũ.

Mất đồng bộ: dừng hoạt cảnh, hiển thị **Mất đồng bộ**, không suy đoán AI đang làm. Vault khóa hoặc phiên hết hạn: xóa nhãn và robot khỏi phòng. Lỗi WebGL: giữ phòng cũ để sử dụng.

## Kế hoạch và bằng chứng
- `docs/PLAN_SPACE_STUDIO_TEAM_R3.md`: phạm vi, chặng việc, tiêu chí hoàn tất.
- `.project-state/state.json`: tiến độ và các kiểm tra chưa thực hiện; R2 lưu trong `archive`.
- `evidence/space-studio-r3/`: kết quả test, đối chiếu file bảo vệ, hình/video từ source.
- `.agents/skills/project-continuity-orchestrator/`: skill dự án đã giữ nguyên; không đồng nghĩa với cài tự động vào tài khoản ChatGPT.

Ảnh/video R3 dùng tài khoản thử ghi rõ, render ngoại tuyến từ chính geometry/GLB/controller mới. Không phải quay Windows và không chứng minh task AI thật đã chạy. Các kiểm tra HTTP dùng server thật trên Linux với dữ liệu cô lập; kiểm tra Three.js/GLB/DOM dùng adapter hình học CPU. **Chưa kiểm thử GPU/WebGL thành công hay đo FPS trên Windows.**

Kiểm tra lại source: `npm run check`, `npm test`, `npm run test:space-studio`. Không chạy bộ test trực tiếp trên bản đang chứa dữ liệu người dùng; dùng bản source sao chép riêng và môi trường test cô lập.
