# Idea Studio B2 — bàn/ghế tương tác V1 (source)

**Nguồn:** AI Project OS v0.9.60 + 2.5D chair preview patch V1. Có **source đầy đủ**, **không phải file EXE/installer Windows đã build**.

## Cách dùng trong mã nguồn

1. Dùng Node.js 22 trở lên. Chạy `npm run check` và `node --test test/office*.test.mjs`.
2. Khởi động ứng dụng theo README / `RUN-WINDOWS.cmd` (không chạy cùng bản đang sử dụng mà chưa sao lưu dữ liệu).
3. Mở tab **Idea Studio** → chế độ **Isometric** → bấm **🪑 Xem kéo ghế (demo)**. Bấm nút lần hai để dừng bất kỳ lúc nào.
4. Demo dài 20 giây, dùng TAM19 GLB thật + tách ghế từ ảnh phòng 2D B2 gốc. Cả nút và nhãn hình đều nói rõ **không phải trạng thái làm việc AI**. Lượt chạy, danh sách bot, tác vụ, pin, mô hình 3D truyền thống vẫn nguyên vẹn.

## Các file đã thay đổi

- `public/tabs/idea.html`: nút xem demo cạnh nút bật phòng 3D.
- `public/tabs/team.js`: vòng đời demo, dừng khi đổi tab/chế độ hoặc xây lại phòng, không cập nhật server state.
- `public/tabs/team.css`: phông thay riêng khi demo, lớp chiều sâu, ghế và model robot.
- `public/assets/chair-demo/office-iso-no-chair.jpg`: ảnh phòng 2D gốc đã xóa duy nhất chiếc ghế demo bằng khôi phục nền.
- `public/assets/chair-demo/chair-original-cutout.png`: chiếc ghế đúng pixel từ phông gốc, ảnh trong suốt để dịch chuyển theo thời gian.
- `public/office-chair-choreography.mjs`: timeline 14 pha; chân, tay robot; điểm chân/ghế tính trên canvas 1920×1280, mọi động tác dùng một đồng hồ.
- `public/office-chair-demo.mjs`: GLTFLoader, THREE.AnimationMixer, texture layering, rAF + WebGL cleanup.
- `test/office-chair-demo.test.mjs`: timeline, ghế bắt đầu kéo sau khi chạm, ghế về đúng vị trí, không nhảy tọa độ và kiểm tra asset.
- `IDEA_STUDIO_GHE_TUONG_TAC_V1.md`: hướng dẫn này.

## Giới hạn cần biết trước khi phát hành thương mại

- **Chế độ xem minh họa tại một chiếc ghế mẫu**, chưa tích hợp tự động vào mọi trạm / mọi tài khoản AI. Chưa nối robot thật đang làm việc với tương tác ghế (cố ý không giả kết quả AI).
- Không có vật lý bàn tay/IK chân toàn phần; bàn và ghế sprite nằm ở góc camera cố định. Không hỗ trợ xoay 360°.
- Đã kiểm tra mã/timeline, chưa xem thực tế WebGL trong Windows: trình duyệt QA của môi trường hiện tại chặn `localhost` (`ERR_BLOCKED_BY_ADMINISTRATOR`). Cần kiểm thử sau khi chạy app Windows trước khi coi là hoàn tất.
- Nếu WebGL không mở được, nguồn 2D cũ vẫn giữ nguyên, nút báo lỗi thay vì màn hình trắng.
- Bản ZIP patch dùng để ghi đè **thư mục mã nguồn trước khi build**, không chép thẳng lên một EXE đã đóng gói bằng Electron/NSIS.

**Hướng tiếp theo để thành tính năng thật:** đo và tách ghế cho từng trạm B2, thêm anchor `handGrip`/`seatContact` theo tỉ lệ của từng robot, solver IK bảo đảm tay/ghế và chân/sàn tiếp xúc, điều hướng quanh bàn, cập nhật từng bot theo job state thực tế, kiểm nghiệm bằng screen recording app Windows trước khi merge release.
