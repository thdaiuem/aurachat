# 💬 AuraChat - Ứng dụng nhắn tin trực tuyến thời gian thực

AuraChat là ứng dụng web chat online thời gian thực với phong cách thiết kế Dark Glassmorphism hiện đại, hỗ trợ nhiều phòng chat, chia sẻ hình ảnh, thả reaction và tổng hợp âm thanh bằng Web Audio API.

## 🚀 Tính năng nổi bật

- **PWA (Progressive Web App):** Cài đặt trực tiếp thành app trên iOS & Android, mở toàn màn hình, hỗ trợ offline shell.
- **Bảo mật truy cập bằng mật khẩu:** Khóa bảo vệ ứng dụng với mã truy cập tùy biến (`APP_PASSWORD`).
- **Web Push Notifications (Chạy cả khi TẮT HẲN app):** Tích hợp Web Push Protocol (VAPID) gửi thông báo qua Apple APNs & Google FCM tới Service Worker, hiển thị thông báo và rung ngay trên màn hình khóa điện thoại cả khi app đã đóng hoàn toàn.
- **Thời gian thực (Socket.IO):** Gửi và nhận tin nhắn không độ trễ.
- **Đa phòng chat:** Hỗ trợ sảnh chung, công nghệ, chém gió, học tập hoặc tự tạo phòng mới.
- **Gửi hình ảnh:** Nén ảnh tự động ngay trên trình duyệt trước khi truyền qua socket.
- **Trích dẫn trả lời (Reply) & Thả biểu cảm (Reaction):** Tương tác linh hoạt trên từng tin nhắn.
- **Âm thanh chân thực:** Tích hợp âm thanh tương tác trực tiếp bằng Web Audio API (không phụ thuộc file ngoài).
- **Trạng thái trực tuyến & Gõ phím:** Hiển thị danh sách online và typing indicator.

## 🔑 Mật khẩu truy cập ứng dụng

- **Mật khẩu mặc định:** `123456`
- **Tùy chỉnh mật khẩu:** Khởi chạy bằng biến môi trường `APP_PASSWORD`:
  ```bash
  # Windows PowerShell
  $env:APP_PASSWORD="MatKhauCuaBan"; npm start

  # Linux / macOS
  APP_PASSWORD="MatKhauCuaBan" npm start
  ```

## 📱 Hướng dẫn cài đặt App (PWA) trên điện thoại

- **Android (Chrome / Edge):** Bấm nút **"📲 Cài đặt App"** trên giao diện hoặc vào menu 3 chấm của trình duyệt -> chọn **"Cài đặt ứng dụng"** (Install app).
- **iOS (Safari trên iPhone / iPad):** Bấm nút **Chia sẻ** (biểu tượng hộp có mũi tên trỏ lên ⎋) -> cuộn xuống chọn **"Thêm vào MH chính" (Add to Home Screen)**.

## 🛠️ Cài đặt & Khởi chạy

```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi chạy ứng dụng
npm start
```

Truy cập tại: `http://localhost:3000`
