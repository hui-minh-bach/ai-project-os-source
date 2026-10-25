# ARCHITECTURE v1

Trạng thái: approved · Specification v1 (test-approved-spec)

PO duyệt: 2026-10-25T03:39:54.008Z · SHA-256: 459974602bd91c11c5cce058fc99552e59e4da5b34b03cfbbf285554316c6732

## 1. Tổng quan hệ thống

Ứng dụng trang tĩnh đơn giản, không cần API hay database.

## 2. Tech Stack · lý do và đánh đổi

HTML / CSS: Phù hợp hai trang tĩnh · Đánh đổi: Không có nội dung động

## 3. Cấu trúc component / module

user: Người dùng

frontend: Frontend

## 4. Trách nhiệm và ranh giới

Người dùng: Đọc trang · Ranh giới: Trình duyệt cá nhân

Frontend: Hiển thị nội dung · Ranh giới: Không có backend

## 5. Luồng dữ liệu và lưu trữ

user → frontend: HTTPS GET / → HTML

File tĩnh; không lưu dữ liệu người dùng

## 6. Tích hợp và API contracts

Không có API bên ngoài; HTTPS GET / trả HTML, lỗi 404 khi không tồn tại

## 7. Bảo mật và yêu cầu phi chức năng

Không lưu credentials; trang responsive

## 8. Triển khai và quy tắc kiến trúc

Static hosting; không thêm backend nếu chưa PO duyệt
