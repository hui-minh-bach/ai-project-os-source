# Personal Edition — Step 1

Phiên bản: **0.9.63-personal.1**, product ID `ai-project-os-personal`.
Nền upstream: `0.9.62`, commit `accbfe06018af8fca69d16fe3b68b9208086bfc8`.
Phạm vi: định danh, cô lập cập nhật và dữ liệu. Chưa triển khai Step 2 hoặc tạo bản Portable phát hành.

## Định danh và giao diện

`src/lib/app-identity.mjs` cung cấp identity runtime. `package.json` và `RELEASE.json` phải khớp version; test kiểm tra điều này. Server, system doctor dùng cùng version. Go launcher đọc identity từ `RELEASE.json`; Node launcher đọc version sau bước xử lý pending. UI hiển thị version do server điền. Cookie `aios_personal_session` và ticket có product ID ngăn nhận nhầm phiên bản gốc. Nếu cổng mặc định đã có dịch vụ khác, launcher tìm cổng tiếp theo; cổng chỉ định rõ thì từ chối dùng chung.

Theme, CSS, font, layout và workflow agent được giữ nguyên. Khu vực cập nhật hiển thị trạng thái bằng tiếng Việt.

## Cập nhật: mặc định tắt

Không có URL hay khóa tin cậy mặc định. `AIOS_UPDATE_MANIFEST_URL` và `<data>/update-config.json` của upstream không được sử dụng. API không cho đổi URL để tự thiết lập trust. `pending-update.json` cũ được giữ nguyên, báo bị chặn, không áp dụng khi khởi động.

Khóa công khai upstream chỉ còn được nhận diện để **từ chối** làm trust anchor Personal. Không sử dụng khóa ký riêng upstream.

Nếu sau này PO chủ động thiết lập kênh riêng, tạo file **tại thư mục ứng dụng** `personal-update-trust.json`:

```json
{
  "enabled": false,
  "schemaVersion": 1,
  "product": "ai-project-os-personal",
  "channel": "personal-stable",
  "manifestUrl": "https://updates.example.com/personal/manifest.json",
  "publicKeyPem": "PUBLIC KEY ED25519 RIENG CUA PERSONAL"
}
```

Đây là mẫu tắt, không phải cấu hình đang hoạt động. Chỉ bật sau khi có máy chủ và khóa Ed25519 riêng đã kiểm chứng. Private key ở ngoài repo, dữ liệu ứng dụng và gói phát hành. File trust được gitignore và loại khỏi script đóng gói nội bộ. File trust trong dữ liệu restore không được đọc. Không hỗ trợ thay trust qua payload cập nhật.

Kênh phải dùng HTTPS, không chứa tài khoản trong URL; payload phải cùng origin với manifest; từ chối redirect. Kênh tác giả gốc bị chặn. Manifest schema 2 ký product, channel, version, URL, SHA-256, kích thước. Cả bước tải và apply đều kiểm chữ ký; apply kiểm lại bytes, staging path và version. Pending thiếu manifest đã ký bị từ chối, kể cả sau khi đã bật kênh Personal.

ZIP được kiểm toàn bộ trước khi backup/ghi: traversal, symlink, Windows device/ADS paths, đường dẫn trùng, dữ liệu người dùng, `.git`, `.env`, trust file, CRC, kích thước giải nén. File ghi đè có backup riêng; lỗi giữa quá trình ghi được rollback. Nếu rollback thất bại, launcher dừng và chỉ đường dẫn backup.

Giới hạn kênh tương lai: không redirect (kể cả CDN), payload tối đa 512 MiB, giải nén tối đa 2 GiB; không nhận ZIP64. Chưa có kênh production, private key hay chứng nhận Windows mới.

## Dữ liệu riêng và chạy cùng bản gốc

| Hệ điều hành | Mặc định |
|---|---|
| Windows | `%LOCALAPPDATA%\AIProjectOSPersonal\data` |
| macOS | `~/Library/Application Support/AIProjectOSPersonal/data` |
| Linux | `$XDG_DATA_HOME/AIProjectOSPersonal/data`, hoặc `~/.local/share/AIProjectOSPersonal/data` |

Backups nằm ở thư mục `backups` cạnh `data`; ticket ở `run` cạnh `data`. Go launcher dùng log dưới `AIProjectOSPersonal`. Shortcut và installer nội bộ dùng tên/thư mục/AppId riêng.

`AI_PROJECT_OS_PERSONAL_DATA_DIR` cho phép chọn đường dẫn tuyệt đối. `AI_PROJECT_OS_DATA_DIR` cũ vẫn được hỗ trợ như override có chủ đích; biến Personal được ưu tiên. Tương tự cho `AI_PROJECT_OS_PERSONAL_BACKUP_DIR` / `AI_PROJECT_OS_BACKUP_DIR`. Không trỏ override vào dữ liệu bản gốc. Đường dẫn chứa namespace `AIProjectOSLocal` và `.data` ngay trong source bị từ chối. Không tự tìm, nhập, hợp nhất hoặc xóa dữ liệu cũ.

## Nhập dữ liệu chủ động bằng backup

1. Đóng tác vụ và ứng dụng. Dùng công cụ backup của **bản gốc** tạo file `.aiosbackup` có mật khẩu. Giữ bản gốc và bản backup.
2. Đóng cả hai ứng dụng. Tại thư mục Personal, chạy `RESTORE-WINDOWS.cmd "duong-dan.aiosbackup"` hoặc `node tools/customer-data.mjs restore /duong/dan.aiosbackup`.
3. Công cụ yêu cầu nhập `CHAPNHAN` và mật khẩu; giải mã/xác thực ở staging trước khi thay dữ liệu Personal. Dữ liệu Personal cũ được dời sang thư mục `.before-restore-...`, đường dẫn in ra sau thao tác.
4. Khởi động Personal, kiểm tra dự án, workspace và Vault. Pending upstream trong bản restore vẫn bị chặn. Một số CLI bên ngoài lưu đường dẫn/profile riêng có thể cần kết nối lại; không tự chỉnh hay xóa hồ sơ của bản gốc.

Lệnh `migrate` cũ không còn sao chép trực tiếp; nó hướng dẫn dùng backup/restore có xác nhận. Backup/restore giữ định dạng AIOSBKP1 tương thích. Không có migration nào đã chạy khi triển khai Step 1.

Rollback nhập dữ liệu: đóng ứng dụng; giữ lại thư mục Personal vừa nhập bằng tên khác, rồi đưa thư mục `.before-restore-...` về đúng vị trí dữ liệu Personal, hoặc restore bản backup Personal đã giữ. Không thao tác trên thư mục bản gốc.

## Kiểm thử

`npm test -- test/personal-foundation.test.mjs test/personal-update-security.test.mjs test/updater.test.mjs`.

`tools/run-tests.mjs` tạo dữ liệu/backup/thư mục tạm riêng và tắt mở trình duyệt. Trên macOS chuẩn hóa đường dẫn tạm thật để Git worktree không nhầm `/var` với `/private/var`. Một số test cần quyền mở cổng loopback. `npm run check` kiểm cú pháp.

Các test bao phủ identity/version, đường dẫn ba hệ điều hành, clean data, original cookie/ticket, pending khi chạy launcher thật, cấu hình/env legacy, trust riêng, restore, chữ ký sai, hash sai, channel sai, redirect, ZIP độc hại và rollback giữa chừng. Bộ hồi quy giữ Council/Idea/Team/Map, backup và theme.

## Rollback Step 1

Đóng Personal và giữ backup dữ liệu Personal. Dùng bản source gốc ở checkout/thư mục riêng tại tag `backup/original-2026-10-25`; không reset hoặc ghi đè working tree đang có thay đổi. Bản gốc dùng dữ liệu gốc, không trỏ vào thư mục Personal. Pending của bản gốc vẫn thuộc cơ chế upstream của chính bản gốc.

Rollback code không xóa dữ liệu Personal. Giữ `.before-restore-*`, backup và bằng chứng test. Chưa rebuild EXE; launcher Go, script PowerShell/Inno cần được compile/smoke trực tiếp trên môi trường build Windows ở bước phát hành.
