# Đại Việt 2099 · V6 robot assets

## Trạng thái tải lên

**Model GLB nhị phân chưa được đẩy trong commit chuẩn bị này.** Sử dụng gói `GITHUB_UPLOAD_DAI_VIET_2099_V6.zip` được cung cấp trong cuộc trò chuyện với chủ dự án, chạy `UPLOAD_V6_GITHUB.cmd` trên Windows sau khi đăng nhập GitHub với tài khoản `hui-minh-bach`.

**Tài khoản:** hui-minh-bach / vlam1889797@gmail.com  
**Nhánh:** `assets/dai-viet-2099-v6` (không thay `main`)  
**Nguồn gốc:** V6 nâng từ V5.2, giữ 36 xương, 37 clip cũ và thêm 6 clip, tổng 43 clip/mẫu.

## Các mẫu cần tải lên

| Mã | Thiết kế | Bản đầy đủ | Bản nhẹ |
| --- | --- | --- | --- |
| TÂM-10 | Đà Nẵng | `models/TAM_10_Da_Nang_V6.glb` | `models_lod/TAM_10_Da_Nang_V6.glb` |
| TÂM-11 | Hội An | `models/TAM_11_Hoi_An_V6.glb` | `models_lod/TAM_11_Hoi_An_V6.glb` |
| TÂM-12 | Quy Nhơn | `models/TAM_12_Quy_Nhon_V6.glb` | `models_lod/TAM_12_Quy_Nhon_V6.glb` |
| TÂM-13 | Nha Trang | `models/TAM_13_Nha_Trang_V6.glb` | `models_lod/TAM_13_Nha_Trang_V6.glb` |
| TÂM-14 | Đà Lạt | `models/TAM_14_Da_Lat_V6.glb` | `models_lod/TAM_14_Da_Lat_V6.glb` |

Mỗi mô hình đầy đủ khoảng 8–9 MB; file LOD khoảng 2–3 MB. `asset_manifest.json` lưu SHA256 để đối chiếu sau khi đẩy.

**Quan trọng:** repo hiện là **public**, các file được đẩy lên nhánh này sẽ công khai ngay cả trước khi merge. Đây chỉ là thư mục asset để quản lý phiên bản, **chưa tích hợp** vào mapping 8 nhân sự 3D hiện tại của `src/lib/office-models.mjs`.
