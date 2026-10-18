# AI PROJECT OS — Gói giao việc gọn cho GPT-6 Astra

## Mục tiêu và trạng thái đã chốt

AI Project OS điều phối nhiều tài khoản/model cho nhiều loại dự án: nghiên cứu, nội dung, tài liệu, dữ liệu, thiết kế, video và phần mềm. Chọn model không tự tạo khả năng sử dụng công cụ. Mỗi loại đầu ra phải có bộ thực thi, quyền truy cập và cách kiểm chứng thật.

Bản file 7 đã merge tại commit `146209c0c25c28e28209a0b1c688766b6a4a842c`. Bảy tab đã duyệt: Tổng quan, Kết nối, Idea Studio, AI Council, AI Team, Skill Hub, Engine Hub. Bổ sung phân tài khoản/model và usage được Reviewer duyệt, 91/91 test pass bằng QA fixtures. Live OAuth, entitlement và quota tài khoản thật chưa được kiểm chứng. Project Map, Publish, Hướng dẫn và E2E cuối toàn bộ 10 tab chưa nghiệm thu. Người dùng đã cho phép hoàn thiện toàn dự án. Tiếp tục các phần còn lại và nghiệm thu toàn hệ thống; không giữ điểm dừng file 7. Những kết quả ở trên là checkpoint lịch sử, không phải bằng chứng cho bản hiện tại.

Skill hiện là hướng dẫn prompt; custom engine hiện lưu metadata. Plugin/MCP tùy ý và nhập repo tùy ý chưa có bộ thực thi đầy đủ. MVP là đầu ra sản phẩm đầu tiên, không phải kết nối công cụ. Không mô tả những phần này là đã chạy.

## Quy tắc tiết kiệm tài nguyên

1. Điều phối viên giữ trạng thái tổng; mỗi Worker chỉ nhận một nhiệm vụ, một tab và đúng ảnh của tab đó. Không gửi lịch sử chat hoặc toàn bộ 10 ảnh.
2. Trước khi sửa, tạo packet có phạm vi, nguồn cần đọc, đầu ra, tiêu chí nghiệm thu và kiểm thử. Nếu thông tin có sẵn trong source thì tự kiểm tra; chỉ hỏi khi thiếu thông tin làm thay đổi kết quả.
3. Tìm bằng `rg`, đọc đoạn liên quan trước; không dump toàn repo hoặc log. Có thể gom các lần đọc độc lập. Những bước sửa, review và merge phải theo thứ tự.
4. Dùng reasoning vừa đủ cho việc thường lệ nếu runtime có hỗ trợ lựa chọn. Dành phân tích sâu cho kiến trúc, auth, bảo mật, dữ liệu và lỗi khó. Không khẳng định điều chỉnh reasoning sẽ giảm một tỷ lệ token cụ thể.
5. Giữ test/log/bằng chứng trong file. Trong hội thoại chỉ báo kết quả, lỗi cần xử lý và đường dẫn. Không lặp lại kế hoạch hoặc source ở mỗi lượt.
6. Sau gián đoạn, đọc checkpoint và tiếp tục cổng đang dở. Không làm lại cổng đã đạt nếu SHA, cấu hình và dữ liệu liên quan vẫn giữ nguyên.
7. Reviewer kiểm exact SHA độc lập. Worker sửa đúng findings; chỉ chạy lại kiểm tra bị ảnh hưởng và cổng bắt buộc. Sửa source thì bằng chứng liên quan phải tạo lại.
8. Khi kiểm tra đã đủ, giao sản phẩm. Không tự thêm tính năng, refactor hoặc kiểm thử ngoài phạm vi để kéo dài tác vụ.
9. Không đặt trần token khiến bỏ qua kiểm tra bắt buộc. Nếu môi trường cho phép, theo dõi usage thực theo vai trò/nhiệm vụ, lập ngân sách và dừng ở checkpoint khi thiếu tài nguyên. Quota gói không đồng nghĩa token và không đảm bảo số tiền tiết kiệm.
10. Không tự đổi model. Điều phối viên, Worker và Reviewer giữ model người dùng đã chọn; chỉ dùng model khác khi người dùng cho phép. Tên/API model phải được xác minh trong runtime đang sử dụng.

## Quy trình thực hiện

**Chốt đầu ra → packet → Worker → kiểm chứng thật → Reviewer → sửa nếu cần → merge/giao → checkpoint.**

Với nâng cấp UI theo ảnh: thực hiện tuần tự từng tab, chạy app, chụp screenshot thật, đối chiếu trực tiếp, kiểm workflow và console. Reviewer APPROVE đúng SHA trước merge. Worker không thay đổi UI tab khác. Thay đổi shared backend phải được điều phối viên ghi rõ trong phạm vi và kiểm regression các phần bị ảnh hưởng.

Với dự án nhiều loại đầu ra: Founder chốt mục tiêu và tiêu chí; Council phân tích khi thực sự cần lựa chọn phương án; Team chia nhiệm vụ; Worker sử dụng công cụ thật; Reviewer kiểm sản phẩm. Không bắt mọi yêu cầu đơn giản đi qua nhiều vòng Council. Không dùng sự đồng thuận giữa model thay cho bằng chứng.

## Mẫu packet giao Worker — điền trước khi chạy

```text
VAI TRÒ: Worker cho đúng một nhiệm vụ trong AI Project OS.
MODEL: Giữ model đã chọn của người dùng và khả năng runtime.

NHIỆM VỤ: [một việc cụ thể]
BASE SHA / CHECKPOINT: [...]
ĐẦU RA: [file/app/tài liệu/dataset/video cụ thể và nơi giao]
TIÊU CHÍ ĐẠT: [các điều kiện quan sát/đo được]
PHẠM VI ĐƯỢC SỬA: [đường dẫn/endpoint/cấu hình cụ thể]
NGUỒN CẦN ĐỌC: [file + đoạn/hàm liên quan]
ẢNH THAM CHIẾU: [chỉ ảnh của tab này, nếu là nhiệm vụ UI]
CÔNG CỤ / QUYỀN ĐÃ CÓ: [...]
KIỂM TRA BẮT BUỘC: [workflow, test, screenshot, dữ liệu thật/fixture ghi rõ]
GIỚI HẠN ĐÃ BIẾT: [...]

Đọc chỉ nguồn liên quan rồi thực hiện đến khi có sản phẩm kiểm chứng được.
Không sửa tab khác hoặc mở rộng tính năng. Không fake trạng thái/usage.
Thiếu khả năng thì báo chính xác phần chưa khả dụng.
Không yêu cầu xác nhận lại thao tác đã được người dùng cho phép.
Nếu cần shared change ngoài phạm vi, báo điều phối viên để xác định phạm vi trước.
Không tự merge hoặc tự APPROVE.
Handoff ngắn: SHA; file đổi; kết quả và log kiểm tra; screenshot;
giới hạn; findings còn lại. Nội dung chi tiết nằm trong file bằng chứng.
```

## Mẫu packet giao Reviewer

```text
Kiểm độc lập candidate SHA [...], so với base [...]. Không sửa source.
Đọc packet Worker, diff liên quan và bằng chứng hiện có.
Đối chiếu sản phẩm thật với tiêu chí; UI thì xem đúng ảnh và screenshot thật.
Kiểm dữ liệu/backend, workflow và regression bị ảnh hưởng.
Không tin lời Worker nếu thiếu bằng chứng; không chạy lại cổng đã xác minh
chỉ để tạo thêm log. Không suy ra live success từ fixture.
Trả APPROVE exact SHA hoặc REJECT với lỗi cụ thể, mức độ, bước tái hiện
và điều kiện để đạt. Không merge. Lưu verdict cùng bằng chứng.
```

## Checkpoint tối thiểu

```json
{
  "task": "Một nhiệm vụ",
  "baseSha": "...",
  "candidateSha": "...",
  "status": "WORKING | REVIEWING | REJECTED | APPROVED | MERGED",
  "completedGates": [],
  "remainingGates": [],
  "findings": [],
  "evidencePaths": [],
  "nextAction": "Một bước tiếp theo",
  "limitations": []
}
```

## Điều kiện đóng việc

Chỉ đóng nhiệm vụ khi sản phẩm tồn tại, tiêu chí đã kiểm, Reviewer APPROVE đúng SHA và đã merge/giao trong phạm vi được phép. Chỉ báo hoàn tất toàn hệ thống khi đủ 10 tab được duyệt và workflow E2E toàn hệ thống đạt. Đăng nhập/quyền model thật chưa thử phải ghi rõ. Gói này là quy trình và prompt để dùng khi điều phối, chưa tự tích hợp bộ kiểm soát ngân sách hoặc plugin vào app.

## Tích hợp trong app

Built-in `ai-project-os-workflow` trong Skill Hub có bật/tắt được lưu bền. Prompt ngắn và hướng dẫn đúng vai trò được áp dụng ở Founder, planning/Council, Worker native/external và Reviewer; tối đa bốn skill mỗi request có workflow. Registry kiểm lại trạng thái trước request (external tại lúc khởi chạy). Tài liệu đầy đủ này không được nhét vào mọi request. Đây là hướng dẫn prompt, không tự triển khai budget enforcement, thay đổi model hoặc thực thi các cổng review.
