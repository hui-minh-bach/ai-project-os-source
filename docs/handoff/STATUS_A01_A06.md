# STATUS & BACKLOG — không báo DONE giả

| Mục | Trạng thái 15/10/2026 | Có thật / Còn thiếu |
|---|---|---|
| A01 Mã nguồn & hợp đồng | **PARTIAL** | ZIP đã xem, mô-đun backend và CoreServices v1 đã có; ZIP đầu vào không có `.git` và không có giao diện 10 tab AI Project OS. Không thể chốt **base upstream commit SHA**; chỉ chốt SHA-256 của ZIP và snapshot Git cục bộ. Backup/restore cài đặt chỉ được kiểm tra thiết kế, chưa chạy Windows thực. |
| A02 AI Connections | **PARTIAL/BLOCKED** | Adapter OpenAI, Anthropic/Claude, Gemini và OpenAI-compatible, phân vai theo modelRef, model-list API, budget mặc định 0, Vault mã hóa. **Chưa có lần gọi model thật** vì không có API key hợp lệ để kiểm thử. Quota/billing của nhà cung cấp chỉ ghi nếu API trả về; không tự khẳng định miễn phí. Retry mạng mặc định không tự gọi lặp để tránh chi phí ngoài ý muốn. |
| A03 AI Team | **PARTIAL** | Founder/Council/PM/Worker/Reviewer chạy với provider mô phỏng; queue thực, checkpoint và workspace riêng, trạng thái pause/resume/cancel/retry. Dependency failed/cancelled được báo BLOCKED thay vì queued vô hạn. Không có bằng chứng multi-provider live hoặc chạy Windows lâu dài. Người dùng phải phê duyệt quyền tool từng task. |
| A04 Skill/MCP/Engine | **PARTIAL/BLOCKED** | Registry bật/tắt skill, ToolRegistry có file read/write, git_status, node_check; MCP **adapter hook** chỉ nhận client được phê duyệt. Không tự cài MCP server, skill bên ngoài, FFmpeg hay Concat. Không có terminal tổng quát. Trạng thái máy Windows chưa dò được. |
| A05 Review & sửa lỗi | **PARTIAL** | Kiểm tra cú pháp/đầu ra, phát hiện lỗi có chủ ý và sửa có giới hạn; AI Reviewer khác model theo kiểm thử. **Kiểm tra node_syntax không chứng minh code chạy đúng; cần test chức năng dự án mẫu trước nghiệm thu.** **Chưa được reviewer độc lập ngoài nhóm kiểm thử phê duyệt**, chưa có PR gate GitHub. |
| A06 Local Worker core | **PARTIAL/BLOCKED** | Có Project Map backend, interface module `software`/`video_edit`/`story`/`publish`; ba loại media chưa có module GPT số 2 nên trả `blocked`, không giả lập xuất bản. Chưa ghép UI 10 tab do ZIP khác đặc tả, chưa chứng minh Docker/Host sandbox và publish app end-to-end. |

## Kiểm thử nghiệm thu theo yêu cầu

| Điều kiện | Kết quả và mức độ bằng chứng |
|---|---|
| 2 Worker làm 2 nhiệm vụ độc lập | PASS local test (tệp nguồn JS thực, Node.js thực) |
| Không ghi đè một worktree | PASS local test (hai Git worktree và hai workspace độc lập) |
| Reviewer phát hiện lỗi, Worker sửa | PASS local test (cú pháp JavaScript cố ý bị sai; sửa trong 2 vòng) |
| Khôi phục checkpoint khi restart | PASS local test (task file idempotent được đưa vào queue; task model không rõ side effect được BLOCKED chờ duyệt) |
| Gọi một model/provider thật | **BLOCKED — thiếu key/API quyền hợp lệ** |
| Phân vai đúng model được chọn | PASS unit test với provider giả lập; live chưa kiểm chứng |
| Không lộ API key | PASS test lưu Vault AES-GCM và redaction với token test; cần audit Windows/log triển khai |
| Không phát sinh chi phí ngoài budget | PASS local logic default 0 + ngân sách giả lập; chưa có billing thực để đối chiếu |
| Một dự án phần mềm mẫu runnable | PASS local test (JS source xuất file, Node require chạy ra kết quả); chưa phải end-to-end nhiều AI live |
| Trạng thái tool thật | `git_status`, `node_check` được dò trên môi trường chạy core; Windows thật **BLOCKED** |
| PR, commit upstream, merge gate | **BLOCKED — ZIP không có Git metadata & GitHub chưa kết nối đúng repo Local Worker** |
| Reviewer độc lập chấp thuận | **BLOCKED — chưa có phê duyệt độc lập** |

## Lỗi/hạn chế còn lại (không che giấu)
1. ZIP là bộ KBL Local AI/Video Worker có browser agent và video backend, không phải dự án AI Project OS 10 tab; bản này **không tạo giao diện mới**.
2. Các lớp cấu hình API này chưa được tích hợp tự động vào UI sẵn có: chạy `CHAY_AI_CORE_RIENG.cmd` theo lựa chọn. Không thay core cũ đang chạy.
3. Chưa kiểm tra API thật, model list thật, hạn mức tiền/token thật. Để kết luận DONE phải làm smoke test sau khi chủ sở hữu cấp thông tin qua Vault.
4. `pause/cancel` hợp tác, không thể thu hồi tác dụng phụ của lệnh ngoài hệ thống đã hoàn tất.
5. Lệnh shell tổng quát, Docker/Host toàn quyền và thao tác publish chưa được bật, đúng nguyên tắc bảo mật; muốn dùng cần đánh giá adapter quyền hẹp.
6. Skill Registry không tự tải/cài skill lạ; MCP hook cần đúng MCP client đã phê duyệt; các engine chưa được phát hiện trên máy Windows thực.
7. Chưa có test Windows PowerShell, Node version đích, Git bản đích, Windows ACL, đường dẫn Unicode, antivirus.
8. Không có cơ chế phối hợp merge ba nhánh khi GPT số 2/3 chưa cung cấp code và acceptance; chưa được phép push/main.
9. API hiện tại là local JSON, không có realtime WebSocket; GPT 3 cần dùng polling hoặc cung cấp adapter sau khi được phép.
10. `concat` (jub0t/concat) là tham chiếu kỹ thuật cho **GPT số 2**, không được đưa vào patch GPT 1 để tránh vượt phạm vi.

### Kết quả kiểm toán V3
28/28 bài kiểm thử cục bộ đạt. Với mã AI tạo ra chỉ có syntax/exists/AI review, trạng thái là `BLOCKED / REVIEW_INSUFFICIENT` thay vì `COMPLETED`. Cần cấu hình verifier kiểm thử chức năng độc lập chạy bên trong sandbox để đánh dấu DONE. Chưa có chạy Windows / model thật / PR upstream. Tham khảo `THIRD_PASS_AUDIT.md`.
