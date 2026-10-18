# CoreServices v1 — Hợp đồng giao tiếp (GPT 1 → GPT 2 & GPT 3)

**Phiên bản**: `CoreServices v1` | **Port mặc định**: `39879` | **Giao thức**: HTTP JSON loopback **127.0.0.1 ONLY**

## Cảnh báo tích hợp
- ZIP đầu vào là **KBL Local AI / Video Worker**, không chứa UI 10 tab của AI Project OS, không có lịch sử `.git`.
- Module AI Core thêm tại `KBL-AI-ADMIN39/ai-core/`. Không chỉnh `KBL-AI-ADMIN39/public`, EXTENSION, UI hay logic render/video.
- **Mặc định KHÔNG chạy tự động**; khởi động riêng bằng `CHAY_AI_CORE_RIENG.cmd` sau khi thiết lập biến môi trường. Không thay thế START_KBL_LOCAL_AI.exe hiện tại.
- API mới không tự động công khai cho website. Tuyệt đối không proxy Internet hoặc mở firewall port.
- Mọi POST / GET cần header `Authorization: Bearer <KBL_CORE_HTTP_TOKEN>` (tối thiểu 32 ký tự ngẫu nhiên); không ghi token vào JavaScript trình duyệt.

## Mô hình nhiệm vụ
Các khóa bắt buộc theo JSON schema `CoreTask-v1.schema.json`:
```
{
  "id":"UUID", "projectId":"my-project", "kind":"software|video_edit|story|publish",
  "state":"queued|running|paused|blocked|review|completed|failed|cancelled",
  "progress":0, "dependencyIds":[],
  "modelRef":{"providerId":"openai-office","model":"model-selected-by-user"},
  "outputArtifactIds":[], "error":null,
  "createdAt":"2026-10-15T00:00:00.000Z", "updatedAt":"2026-10-15T00:00:00.000Z",
  "startedAt":null,"completedAt":null,"attempts":0,"maxAttempts":2,
  "input":{"approved":false,"allowedTools":[],"prompt":"task-specific"},
  "checkpoint":{"stage":"queued"}, "review":null
}
```
Thời điểm là ISO-8601 UTC. `projectId` định danh ASCII. `id` UUID do lõi sinh ra khi POST /v1/tasks.

## Core interfaces
1. **ProviderGateway**: `register`, `assign(role, modelRef)`, `resolve`, `listModels(providerId)`, `setBudget(usd)`, `generate(role,...)`. Vai trò: Founder, Council, PM, Worker, Reviewer; không thay model đã khóa theo task.
2. **TaskQueue**: `add`, `approve`, `tick`, `pause`, `resume`, `cancel`, `retry`, `drain`, `registerVerifier(fn,{approved:true})`, `verifyTask(id)`, `registerModule(kind, handler, {approved:true})`, `approveGitRepo(projectId,path)`.
3. **ArtifactStore**: `put({projectId,taskId,name,content})`, `get(id)`, `read(id)`, `list(projectId)`; hash SHA-256 và file riêng từng task.
4. **EventBus**: `state.emit(type,payload)`, `state.events.items` (persist, 1.000 sự kiện cuối); sự kiện `task.created`, `task.updated`, `provider.usage`, `git.worktree`. **Chưa có WebSocket/SSE**.
5. **ToolRegistry**: `register({name,description,run,approvalRequired})`, `call(name,args,permission)`, `list()`; công cụ mặc định file_read, file_write, git_status, node_check. Không có shell tổng quát.
6. **SkillRegistry**: `add`, `enable`, `get`; task truyền `input.skillIds` và phê duyệt mọi tool kỹ năng cần.
7. **McpRegistry**: `register({id,client,approved:true})` và `importTools(id)`; **chỉ là điểm gắn client MCP đã được cấp quyền**, chưa bao gồm engine stdio/HTTP hoặc tự cài plugin từ mạng.

## HTTP API (backend GPT 3 có thể gọi qua local trusted adapter, không qua browser trực tiếp)
| Method | Route | Kết quả |
| --- | --- | --- |
| GET | `/v1/health` | version, trạng thái, cờ `liveModelVerified` |
| GET / POST | `/v1/tasks` | danh sách hoặc tạo Task |
| POST | `/v1/tasks/:id/approve` | cấp tool (body `{"allowedTools":[...]}`) |
| POST | `/v1/tasks/:id/pause` | tạm dừng có phối hợp |
| POST | `/v1/tasks/:id/resume` | trả vào queue |
| POST | `/v1/tasks/:id/cancel` | hủy, chặn ghi file bởi AI khi request kết thúc |
| POST | `/v1/tasks/:id/retry` | thử lại trong giới hạn |
| POST | `/v1/projects/plan` | Founder → (Council tùy chọn) → PM, trả danh sách Task cần phê duyệt |
| GET | `/v1/projects/:id/map` | Project Map trạng thái backend |
| GET | `/v1/events` | nhật ký sự kiện đã redaction |
| GET | `/v1/tools`, `/v1/skills` | trạng thái công cụ và kỹ năng |
| POST | `/v1/skills`, `/v1/skills/:id/enable` | đăng ký/bật/tắt kỹ năng |
| GET / POST | `/v1/providers` | provider metadata, không API key |
| GET | `/v1/providers/:id/models` | danh sách model do provider trả về (nếu có API) |
| POST | `/v1/roles`, `/v1/budget` | phân vai model, hạn mức USD |
| GET | `/v1/artifacts/:id` | metadata, không tự trả nội dung file |

### Tích hợp GPT số 2
- GPT số 2 **tự thực hiện** engine `video_edit`, `story`, `publish`. GPT 1 chỉ cung cấp `queue.registerModule`.
- Ví dụ giao diện module: `async ({task,workspace,artifactStore}) => ({artifacts:[artifactId]})`. Chỉ trả ID artifact đã ghi thực tế, Reviewer sẽ kiểm tra lại.
- Chưa gắn Concat, FFmpeg, TTS hoặc tài khoản mạng xã hội. Không coi `registerModule` là đã có video/publish thật.

### Tích hợp GPT số 3
- Không đổi theme/10 tab. UI sử dụng API qua backend proxy có bảo vệ và phải giữ token kín.
- Dùng `state` và `progress` thật; `blocked` là một trạng thái có nghĩa, tuyệt đối không thay bằng thành công giả.
- `CoreServices v1` là API bổ sung, không thay route /api/video-studio/* của worker hiện tại.

## Vòng đời, độ an toàn, hạn chế hiện tại
- Hai Worker dùng workspace `workspaces/<projectId>/<taskUUID>`; nếu có Git repo được ủy quyền, mỗi task là một `git worktree`/branch riêng. Không tự merge/push.
- Khi không gắn Git repo, mỗi software task tạo một Git repository/nhánh *riêng biệt*, không liên kết dự án mã nguồn chính.
- Mọi thao tác ghi file cần `input.approved:true` và allowlist `input.allowedTools`; quyền tool không suy ra từ prompt AI.
- Restart khôi phục checkpoint: thao tác file nội bộ có thể replay an toàn về `queued`, còn model/external side effect chưa rõ được đặt `blocked` để tránh tính phí hay tác dụng phụ lặp. Thao tác không idempotent, side effect bên ngoài, terminal tùy ý, Git publish **không** được cho phép mặc định.
- `pause/cancel` là hủy có phối hợp: lệnh hệ điều hành đang chạy không có hard-kill, nhưng phản hồi model đến muộn không được tiếp tục ghi source.
- Vault AES-256-GCM dùng master key ngoài tệp; API key không nhập vào URL, Git, frontend. Không dùng cookie trình duyệt/ChatGPT.
- `budgetUsd` mặc định 0; giá token theo cấu hình người dùng, đây là dự tính có giới hạn, **không phải hóa đơn/quota live**.

## Tương thích dữ liệu cũ
Tất cả dữ liệu cũ (`config.json`, `work/`, `output/`, browser profiles, Vault cũ) không được di chuyển. Dữ liệu riêng CoreServices v1 nằm ở `work/ai-core-v1/` và không được tự nhận là thay thế định dạng DB cũ.

## Bổ sung tương thích V1 / V3
- `queue.registerVerifier()` + `queue.verifyTask()` là hook backend chỉ cho adapter kiểm thử **độc lập được phê duyệt**, nhận `evidenceArtifactId` có thật; mã do Worker tự tạo chưa tự nhận DONE. Không có route HTTP kích hoạt tùy tiện.
- Model task có `REVIEW_INSUFFICIENT` phải **được kiểm chứng**, không được `approve/resume/retry` để qua bước review.
- Lệnh `resume/retry/approve` trả `TASK_IN_FLIGHT` nếu lời gọi trước chưa kết thúc.
- `GET /v1/tools` trả `installed:null, status:"unverified"` cho các adapter chưa có bằng chứng health live; không được hiểu là đã cài trên Windows.
