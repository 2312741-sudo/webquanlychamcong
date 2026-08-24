# BÁO CÁO CẬP NHẬT TÍNH NĂNG & NHẬT KÝ THAY ĐỔI (CHANGELOG)
**Ngày cập nhật:** 24/08/2026  
**Phiên bản:** `v1.0.4` (Mobile App: `1.0.4+5`, Web Dashboard: `1.0.4`)  
**Tác giả:** Nguyễn Thanh Tâm ([nthanhtam.402@gmail.com](mailto:nthanhtam.402@gmail.com))  

---

## 📌 TỔNG HỢP CÁC TÍNH NĂNG & NÂNG CẤP ĐÃ HOÀN TẤT

### 1. [TASK 1] Tính Năng Ảnh Đại Diện (Avatar) & Bảo Mật Storage
- **Tải lên & Xử lý ảnh:**
  - Tích hợp chọn ảnh từ Thư viện ảnh (Gallery) và Chụp ảnh trực tiếp từ Camera trên Mobile App (`ProfileSettingsScreen`).
  - Nén và resize ảnh tự động phía client (`maxWidth: 800`, `maxHeight: 800`, `imageQuality: 85`) trước khi upload để tối ưu tốc độ và dung lượng.
  - Tải lên Firebase Storage tại đường dẫn `avatars/{userId}.jpg`.
- **Đồng bộ Real-time giữa các tài khoản:**
  - URL ảnh đại diện được lưu vào Document người dùng `/users/{userId}`, `FirebaseAuth.currentUser.photoURL` và tự động đồng bộ tức thì vào subcollection `/stores/{storeId}/members/{userId}` của toàn bộ cửa hàng mà người dùng tham gia.
  - Khi tài khoản A đổi ảnh đại diện, TẤT CẢ các tài khoản khác trong cùng cửa hàng (Chủ, Quản lý, Nhân viên) đều thấy ảnh đại diện mới của A cập nhật tức thì trên Danh sách nhân sự, Chi tiết thành viên, Lịch làm việc... trên cả Mobile App và Web Dashboard.
  - Tự động hiển thị avatar mặc định (chữ cái đầu tên trên nền màu thương hiệu) khi người dùng chưa có ảnh.
- **Quy tắc bảo mật Firebase Storage (`storage.rules`):**
  - Mọi người dùng đã xác thực đều được đọc avatar của các thành viên.
  - Chỉ người dùng chính chủ mới có quyền ghi/ghi đè avatar của chính mình (`request.auth.uid == userId`, dung lượng `< 5MB`, định dạng `image/*`).

---

### 2. [TASK 2] Rà Soát & Khắc Phục Lỗi Push Notification trên iOS
- **Khắc phục các nguyên nhân cốt lõi:**
  - **APNs Token Bridge (Swift):** Cập nhật `AppDelegate.swift` nhận APNs device token từ iOS và gán vào `Messaging.messaging().apnsToken = deviceToken`.
  - **Background & Foreground Handlers:** Đăng ký `@pragma('vm:entry-point') Future<void> _firebaseMessagingBackgroundHandler` cho `FirebaseMessaging.onBackgroundMessage` và khởi tạo `NotificationService().initialize()` ngay khi app khởi động.
  - **Foreground Presentation Options:** Thiết lập `setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true)` để thông báo vẫn hiển thị banner khi app đang mở.
  - **FCM Token Lifecycle:** Lắng nghe `FirebaseMessaging.onTokenRefresh` tự động cập nhật token mới vào Firestore kèm timestamp.
  - **Payload APNs chuẩn từ Cloud Functions:** Cập nhật toàn bộ các Cloud Function (`onScheduleChanged`, `onAdvanceCreated`, `onAdvanceUpdated`, `shiftReminders`) luôn đính kèm `notification: { title, body }` và `apns: { payload: { aps: { alert: { title, body }, badge: 1, sound: 'default' } } }` để iOS tự động hiển thị banner kể cả khi app bị tắt hoàn toàn (killed).
  - **Đồng bộ Channel Android:** Thiết lập Channel ID `cham_cong_notifications` ("Thông báo Chấm Công") đồng bộ trên AndroidManifest, NotificationService và Cloud Functions.

---

### 3. [TASK 3] UI Thống Kê Năng Suất Trên Tab Lịch Cửa Hàng
- **Mini-badges thống kê trên trục danh sách nhân viên:**
  - **Tổng giờ công theo tuần:** Hiển thị `⏱️ X.Xh` (tính toán dựa trên **Lịch đã xếp (`shifts`)** của tuần được chọn để quản lý tiện đối chiếu định mức phân ca).
  - **Tổng ca chở hàng theo tuần:** Hiển thị `📦 Y ca` (badge màu cam nổi bật).
- **Tuân thủ quy tắc ẩn lịch (`hiddenScheduleUserIds`):**
  - Khi nhân viên bị ẩn lịch, toàn bộ hàng lịch và mini-badge thống kê của nhân viên đó cũng được ẩn hoàn toàn đối với các nhân sự khác (chỉ Chủ cửa hàng mới nhìn thấy kèm nhãn `Ẩn`).
- **Đồng bộ giao diện Mobile & Web:**
  - Mobile: Mini-badge đặt ngay dưới tên nhân viên, giữ nguyên lưới lịch 7 ngày mượt mà.
  - Web: Cột 1 hiển thị mini-stats dưới tên nhân viên, kết hợp với 2 cột tổng kết chi tiết ở cuối bảng.

---

### 4. [TASK 4] Điều Chỉnh Chức Năng Xem/Sửa Ca Làm Theo RBAC (Manager 1 & 2)
- **Modal Chi Tiết Ca Làm Việc:**
  - Bấm vào bất kỳ ô ca làm nào trên lịch mở modal hiển thị danh sách chi tiết các ca làm việc trong ngày (Giờ làm, Bộ phận, Phụ cấp...).
- **Ma trận phân quyền (RBAC) chuẩn hóa qua `AppPermissions`:**
  - **Nhân viên (`employee`):** Chế độ chỉ xem chi tiết ca làm trong ngày, không có quyền chỉnh sửa.
  - **Quản lý 1 (`manager1`) & Chủ quán (`owner`):** Xem chi tiết ca làm, có 2 checkbox tick **📦 Chở hàng** / **🛵 Giao hàng** và nút **"✏️ Sửa ca làm việc"** để mở bộ chọn ca làm.
  - **Quản lý 2 (`manager2`):** Xem chi tiết ca làm, có 2 checkbox tick **📦 Chở hàng** / **🛵 Giao hàng** để phân công giao nhận hàng, **ẨN HOÀN TOÀN nút "Sửa ca làm việc"** (chặn không cho sửa ca làm chính).
- **Ghi nhật ký truy vết (Audit Logging):**
  - Khi lưu lịch hoặc tick chọn Chở hàng / Giao hàng, hệ thống tự động ghi nhận `updatedBy: user.uid` và `updatedAt: Timestamp.now()` vào document lịch `/stores/{storeId}/schedules/{weekStart}`.

---

---

### 5. [HOTFIX v1.0.4-patch] Sửa 5 Lỗi Hệ Thống & Nâng Cấp Luồng Thông Báo Mở Chi Tiết

1. **LỖI 1: Checklist Sản Xuất cho phép nhập số thập phân:**
   - Cấu hình `inputFormatters` chấp nhận số, dấu chấm `.`, dấu phẩy `,` (`[\d.,]`).
   - Tự động chuẩn hóa dấu phẩy thành dấu chấm trước khi parse sang `double`, cho phép nhập liệu linh hoạt (`2,5`, `0.75`, `12,5`...).

2. **LỖI 2: Khắc phục triệt để mất dữ liệu đăng ký lịch làm:**
   - **Repository Mobile:** Bổ sung `SetOptions(merge: true)` cho `setFullSchedule` để bảo toàn lịch tự đăng ký của nhân viên khác.
   - **Web Dashboard:** Tự động nạp và merge dữ liệu Firestore mới nhất trước khi lưu; đồng thời chuyển sang `watchWeekSchedule` (real-time stream).
   - **Navigation:** Router và màn hình Quản lý lịch hỗ trợ tham số `initialWeekStart`, điều hướng chính xác vào tuần nhân viên đăng ký khi nhấn vào thông báo.

3. **LỖI 3: Khắc phục lệch 7 tiếng múi giờ:**
   - Thêm `.toLocal()` tại Box "Đang làm việc" ở Owner Dashboard, Manager Dashboard, thẻ chấm công cá nhân của Chủ quán và màn hình Lịch sử chấm công.

4. **LỖI 4: Chi tiết hóa toàn bộ nội dung Push Notification:**
   - Cập nhật các hàm Cloud Function với nội dung tường minh: tên nhân viên, tên cửa hàng, format tiền tệ VNĐ chuẩn (`500.000đ`), thời gian ca và khoảng ngày tuần.
   - Bổ sung trigger `onNotificationCreated` tự động bắn push notification khi có thông báo in-app mới.

5. **TASK 5: Khắc phục lỗi mất dữ liệu ca làm xuyên đêm (Cross-Midnight):**
   - Thêm `watchActiveAttendance` và sửa `checkOut` truy vấn theo `checkOut == null` (không bị chặn bởi `date == today`), duy trì trạng thái "Đang làm việc" và tính toán số giờ công chính xác khi bước qua 00:00.

6. **TÍNH NĂNG MỚI: Luồng chạm thông báo ngoài màn hình -> Mở chi tiết trong App:**
   - Xử lý mở thông báo khi app ở Background (`onMessageOpenedApp`), Foreground (`onDidReceiveNotificationResponse`), và Cold Start (`getInitialMessage` + `SplashScreen`).
   - Người dùng chạm vào thông báo trên màn hình khóa hoặc thanh thông báo sẽ tự động được điều hướng vào màn hình Thông báo (`/notifications`) để xem đầy đủ chi tiết.

---

## 🧪 KẾT QUẢ KIỂM THỬ HỆ THỐNG
- **Mobile App (`cham_cong_tram`):** Vượt qua toàn bộ **62/62 test cases (0 lỗi)** (`All tests passed!`). `flutter analyze` 0 errors.
- **Web Dashboard (`cham_cong_web`):** Lệnh `npm run build` thành công 100% (`Compiled successfully, 12/12 static pages generated`).
