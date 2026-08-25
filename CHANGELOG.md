# 📋 NHẬT KÝ THAY ĐỔI CHI TIẾT (CHANGELOG) — 24/08/2026 & 25/08/2026

**Dự án:** Chấm Công Trạm (`cham_cong_tram` Mobile App & `cham_cong_web` Web Dashboard)  
**Tác giả:** Nguyễn Thanh Tâm ([nthanhtam.402@gmail.com](mailto:nthanhtam.402@gmail.com))  
**Phiên bản hiện tại:** `v1.0.4-patch` (Mobile: `1.0.4+5`, Web: `1.0.4`)

---

## 🚀 TỔNG HỢP NÂNG CẤP & SỬA LỖI TRONG 2 NGÀY GẦN NHẤT

```
                                  DÒNG THỜI GIAN PHÁT TRIỂN
                                  
  ┌─────────────────────────────────┐               ┌─────────────────────────────────┐
  │         NGÀY 24/08/2026         │               │         NGÀY 25/08/2026         │
  ├─────────────────────────────────┤               ├─────────────────────────────────┤
  │ 1. Tính năng Avatar & Storage   │               │ 1. Sửa lỗi Checklist SX Float   │
  │ 2. Fix Push Notification iOS    │   ────────►   │ 2. Fix mất dữ liệu đăng ký lịch │
  │ 3. UI Thống kê năng suất tuần   │               │ 3. Fix lệch múi giờ 7 tiếng     │
  │ 4. RBAC Xem/Sửa ca Quản lý 1 & 2│               │ 4. Push Notification chi tiết   │
  │ 5. AI Knowledge Index v1        │               │ 5. Fix ca xuyên đêm qua 00:00   │
  └─────────────────────────────────┘               │ 6. Luồng chạm thông báo mở App  │
                                                    │ 7. Khóa xem/sửa bảng công QL 2  │
                                                    └─────────────────────────────────┘
```

---

## 📅 NGÀY 25/08/2026: BẢN VÁ LỖI HỆ THỐNG & ĐIỀU CHỈNH PHÂN QUYỀN (v1.0.4-patch)

### 0. [NÂNG CẤP MỚI] Khắc Phục 4 Vấn Đề Vừa Phát Sinh (Avatar, FCM Logout, Back Button, Web Perf)
- **Vấn đề 1 (Avatar Trắng/Xám trên Mobile):**
  - Cập nhật `storage.rules` cho phép `allow read: if true;` đối với `avatars/{fileName}`, giúp các HTTP client như `CachedNetworkImage` và thẻ `<img>` đọc ảnh mượt mà không bị 403 Forbidden.
  - Đồng bộ `AvatarWidget` với fallback chữ cái đầu tên trên nền màu thương hiệu vào Drawer (`store_drawer.dart`) và các dashboard; tự động fallback sang `photoURL` từ Firebase Auth nếu `avatarUrl` trong Firestore chưa kịp đồng bộ.
- **Vấn đề 2 (Đè Tài Khoản Thông Báo & Lặp Thông Báo):**
  - **Khi Đăng xuất:** Thêm `clearTokenForUser(uid)` tự động xóa field `fcmToken` khỏi Firestore `/users/{uid}`, gọi `deleteToken()` trên thiết bị và hủy toàn bộ stream subscriptions trước khi hoàn tất đăng xuất.
  - **Khi Đăng nhập:** Thêm cơ chế **Deduplication** tự động quét và xóa token cũ của các tài khoản khác trên cùng thiết bị này, đảm bảo mỗi device token chỉ gắn với 1 tài khoản đang hoạt động duy nhất.
- **Vấn đề 3 (Nút Quay Về Màn Hình Thông Báo Bị Trùng Màu):**
  - Bổ sung `leading: IconButton(icon: Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF1A1A1A)))` và `iconTheme: IconThemeData(color: Color(0xFF1A1A1A))` trong `notifications_screen.dart`, tạo độ tương phản rõ ràng và bấm dễ dàng trên AppBar nền trắng.
- **Vấn đề 4 (Web Load Chậm Khi F5 & Xoay Lâu Khi Lưu Lịch):**
  - **Tối ưu F5:** Chuyển `getUserStoresData` sang đọc 1 lần duy nhất từ document `/users/{uid}` và tải danh sách cửa hàng song song (`Promise.all`). Bỏ query nặng `collectionGroup` khi đã có sẵn `storeIds`. Giới hạn `watchNotifications` ở `limit(50)` mới nhất.
  - **Tối ưu Lưu Lịch:** Thay thế hàm `window.alert()` chặn luồng (blocking) bằng thông báo Toast nổi (`toastMessage`) tự động đóng sau 3 giây, tắt trạng thái xoay loading ngay khi Firestore ghi thành công.

### 0.2 [FIX TRIỆT ĐỂ] Sửa Lỗi Phải Bấm Đăng Xuất 2 Lần (Mobile & Web)
- **Nguyên nhân cốt lõi phát hiện:**
  1. **GoRouter Redirect Lag:** Trước đây Router đọc `ref.read(authStateChangesProvider)` (StreamProvider bất đồng bộ) thay vì `FirebaseAuth.instance.currentUser` (trạng thái tức thời). Khi gọi `context.go('/login')` lúc StreamProvider chưa kịp phát ra `null`, GoRouter tưởng người dùng vẫn còn đăng nhập trên trang auth và lập tức redirect ngược về `/splash` -> Dashboard.
  2. **Xung đột `ref.listen` trong các Dashboard:** Khi `signOut()` gọi `_invalidateAllUserData()`, các bộ lắng nghe `ref.listen` trên `currentMemberProvider` và `storeMembersProvider` bị kích hoạt và tự động gọi `context.go(...)` đè lên luồng đăng xuất.
  3. **Google Sign-In Token:** `AuthRepository.signOut()` chưa gọi `GoogleSignIn().signOut()`.
- **Giải pháp triệt để:**
  - Cập nhật `router.dart`: Kiểm tra trực tiếp `FirebaseAuth.instance.currentUser != null` (đồng bộ 100%).
  - Chặn đứng toàn bộ `ref.listen` trong `owner_dashboard.dart`, `manager_dashboard.dart`, `employee_dashboard.dart` bằng điều kiện `if (FirebaseAuth.instance.currentUser == null) return;`.
  - Tích hợp `GoogleSignIn().signOut()` vào `AuthRepository.signOut()`.
  - Đảm bảo gọi `await signOut()` hoàn tất trước khi chuyển trang trên tất cả các màn hình và Drawer.



### 1. [RBAC] Khóa Quyền Xem & Sửa Bảng Chấm Công Đối Với Quản Lý 2 (`manager2`)
- **Vấn đề phát hiện:** Trước đây Quản lý 2 vẫn có thể xem danh sách bảng công toàn bộ nhân viên và mở modal chỉnh sửa giờ vào/ra của nhân sự khác.
- **Giải pháp triển khai:**
  - **Mobile (`app_permissions.dart`):** Bổ sung 2 hàm phân quyền `canEditAttendance(role)` và `canViewAllAttendance(role)`. Cả 2 hàm đều trả về `false` đối với `manager2` và `employee`.
  - **Manager Dashboard (`manager_dashboard.dart`):** Ẩn hoàn toàn thẻ công cụ *"Bảng chấm công"* khỏi màn hình làm việc của Quản lý 2.
  - **Attendance Table Screen (`attendance_table_screen.dart`):** Khóa quyền truy cập màn hình `/attendance-table` đối với Quản lý 2 kèm thông báo cảnh báo bảo mật.
  - **Monthly Attendance Screen (`monthly_attendance_screen.dart`):** Chặn Quản lý 2 xem bảng công tháng của nhân viên khác; đồng thời ẩn nút *"Sửa giờ vào/ra"*, *"Thêm chấm công"* và khóa phương thức `_save()` không cho lưu chỉnh sửa.
  - **Web Dashboard (`types.ts`, `attendance/page.tsx`, `layout.tsx`):** Đồng bộ ẩn menu Bảng công ở Sidebar, vô hiệu hóa tính năng click vào ô lịch sử công để sửa giờ và chặn truy cập trực tiếp nếu không đủ quyền.

### 2. [LỖI 1] Checklist Sản Xuất Cho Phép Nhập Số Thập Phân (Float/Double)
- **Triệu chứng cũ:** Trường nhập số lượng chỉ cho nhập số nguyên; nếu nhập dấu phẩy `,` (ví dụ `2,5`) thì hàm `double.tryParse` trả về `null`, dẫn đến lỗi validation chặn không cho nhân viên bấm checkout ra ca.
- **Khắc phục (`check_in_screen.dart`):**
  - Cấu hình `inputFormatters` cho phép nhập chữ số, dấu chấm `.`, dấu phẩy `,` (`RegExp(r'[\d.,]')`) cùng `keyboardType: TextInputType.numberWithOptions(decimal: true)`.
  - Chuẩn hóa chuỗi đầu vào: `valStr.replaceAll(',', '.')` trước khi parse sang `double`. Cho phép nhập liệu tự nhiên `2,5`, `0.75`, `12,5` kg.

### 3. [LỖI 2] Khắc Phục Triệt Để Mất Dữ Liệu Đăng Ký Lịch Làm Việc
- **Triệu chứng cũ:** Nhân viên tự đăng ký ca tuần, Quản lý nhận thông báo nhưng khi Quản lý vào lưu lịch thì dữ liệu đăng ký của nhân viên bị ghi đè xóa sạch.
- **Khắc phục:**
  - **Mobile (`schedule_repository.dart`):** Bổ sung `SetOptions(merge: true)` cho hàm `setFullSchedule` để chỉ cập nhật ca của các nhân sự được chỉ định mà không xóa đè ca của nhân viên khác.
  - **Web (`firestore.ts`, `schedule/page.tsx`):** Hàm `saveWeekSchedule` tự động lấy document Firestore mới nhất và merge với state cục bộ trước khi ghi. Chuyển sang `watchWeekSchedule` để lắng nghe stream real-time từ Firestore.
  - **Điều hướng tuần (`router.dart`, `schedule_manager_screen.dart`):** Hỗ trợ tham số `initialWeekStart`, giúp khi chạm vào thông báo trên điện thoại sẽ mở ngay đúng tuần nhân viên đăng ký.

### 4. [LỖI 3] Sửa Lỗi Lệch 7 Tiếng Múi Giờ (UTC vs Local Time)
- **Triệu chứng cũ:** Nhân viên vào ca lúc 12:00 nhưng Box "Nhân viên đang làm" và thẻ cá nhân của Chủ quán hiển thị 05:00 do đọc trực tiếp `att.checkIn.hour` từ UTC `Timestamp` mà quên chuyển sang Local Time.
- **Khắc phục:** Thêm `.toLocal()` tại `owner_dashboard.dart`, `manager_dashboard.dart` và `attendance_history_screen.dart`. Giờ vào/ra hiển thị chuẩn xác theo giờ Việt Nam (UTC+7).

### 5. [LỖI 4] Chi Tiết Hóa Nội Dung Push Notifications & APNs Payload
- **Khắc phục (`firebase_functions/functions/index.js`):**
  - `onScheduleChanged`: Thêm tên quán, khoảng ngày tuần (`25/08 - 31/08`).
  - `onAdvanceCreated`: Thêm tên nhân viên, format tiền Việt chuẩn (`500.000đ`), lý do tạm ứng và tên quán.
  - `onAdvanceUpdated`: Thông báo rõ trạng thái duyệt/từ chối kèm tên quán.
  - `shiftReminders`: Thông báo chi tiết khung ca (`06:00 - 14:00`, `14:00 - 22:00`, `22:00 - 06:00`) và tên chi nhánh.
  - Thêm Cloud Function trigger `onNotificationCreated` tự động bắn push notification ra màn hình khóa khi có thông báo in-app mới trong Firestore.

### 6. [TASK 5] Khắc Phục Lỗi Mất Dữ Liệu Ca Làm Xuyên Đêm (Cross-Midnight Bug)
- **Triệu chứng cũ:** Khi ca làm việc bước qua mốc 00:00 (sau 24:00), truy vấn `date == today` không tìm thấy bản ghi hôm qua khiến app tưởng chưa vào ca, làm mất trạng thái "Đang trong ca làm" và không checkout được.
- **Khắc phục (`attendance_repository.dart`, `attendance_provider.dart`):**
  - Thêm hàm `watchActiveAttendance` truy vấn theo `checkOut == null` không giới hạn theo ngày.
  - Sửa hàm `checkOut` tìm bản ghi mở theo `checkOut == null`, duy trì trạng thái "Đang làm việc" và tính đúng tổng số giờ công qua đêm.

### 7. [TÍNH NĂNG MỚI] Luồng Chạm Thông Báo Ngoài Màn Hình Mở Chi Tiết Trong App
- **Khắc phục (`notification_service.dart`, `router.dart`, `splash_screen.dart`):**
  - Cấu hình `rootNavigatorKey` toàn cục cho GoRouter.
  - Xử lý mở thông báo ở cả 3 trạng thái: **Background** (`FirebaseMessaging.onMessageOpenedApp`), **Cold Start** (`FirebaseMessaging.instance.getInitialMessage`), **Foreground** (`onDidReceiveNotificationResponse`).
  - Tự động điều hướng người dùng thẳng vào màn hình danh sách Thông báo (`/notifications`) để đọc nội dung chi tiết.

---

## 📅 NGÀY 24/08/2026: TÍNH NĂNG AVATAR, PUSH NOTIFICATION IOS, NĂNG SUẤT LỊCH & RBAC

### 1. [TASK 1] Tính Năng Ảnh Đại Diện (Avatar) & Đồng Bộ Toàn Hệ Thống
- **Tải lên & Xử lý ảnh:** Chọn ảnh từ Thư viện hoặc Camera trên Mobile App (`profile_settings_screen.dart`), client tự động resize & nén (`800x800`, chất lượng 85%) và tải lên Firebase Storage `avatars/{userId}.jpg`.
- **Đồng bộ Real-time:** Tự động đồng bộ URL ảnh vào `/users/{userId}`, `FirebaseAuth.currentUser.photoURL` và subcollection `/stores/{storeId}/members/{userId}` của toàn bộ cửa hàng liên quan.
- **Quy tắc bảo mật (`storage.rules`):** Chỉ người dùng chính chủ mới có quyền ghi đè avatar của chính mình (`request.auth.uid == userId`, `< 5MB`, định dạng `image/*`).

### 2. [TASK 2] Rà Soát & Khắc Phục Triệt Để Push Notification Trên iOS
- **APNs Native Token Bridge:** Thêm xử lý trong `ios/Runner/AppDelegate.swift` nhận APNs device token từ iOS và gán vào `Messaging.messaging().apnsToken = deviceToken`.
- **Foreground Presentation:** Thiết lập `setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true)` hiển thị banner ngay cả khi đang mở app.
- **FCM Token Lifecycle:** Lắng nghe `onTokenRefresh` tự động cập nhật token mới vào Firestore kèm timestamp.
- **Android Channel Sync:** Thiết lập Channel ID `cham_cong_notifications` đồng bộ trên AndroidManifest, NotificationService và Cloud Functions.

### 3. [TASK 3] UI Thống Kê Năng Suất Trực Quan Trên Tab Lịch Cửa Hàng
- **Mini-badges trên trục danh sách nhân viên:**
  - `⏱️ X.Xh`: Tổng số giờ công đã xếp trong tuần của nhân viên.
  - `📦 Y ca`: Tổng số ca chở hàng trong tuần (badge màu cam).
- **Tuân thủ quy tắc ẩn lịch (`hiddenScheduleUserIds`):** Nhân viên bị ẩn lịch sẽ ẩn toàn bộ hàng lịch và mini-badge thống kê đối với các tài khoản khác (chỉ Chủ quán mới thấy kèm nhãn `Ẩn`).

### 4. [TASK 4] Modal Chi Tiết Ca Làm Việc & Phân Quyền RBAC Quản Lý 1 & 2
- **Modal Chi Tiết Ca:** Chạm vào bất kỳ ô ca làm nào trên lịch để xem danh sách chi tiết các ca trực trong ngày (Giờ làm, Bộ phận, Phụ cấp...).
- **Phân quyền RBAC:**
  - **Nhân viên (`employee`):** Chế độ chỉ xem.
  - **Quản lý 1 (`manager1`) & Chủ quán (`owner`):** Xem ca, tick Chở/Giao hàng, nút "✏️ Sửa ca làm việc" để xếp lịch.
  - **Quản lý 2 (`manager2`):** Xem ca, tick Chở/Giao hàng, ẩn hoàn toàn nút "Sửa ca làm việc".
- **Audit Logging:** Tự động ghi nhận `updatedBy: user.uid` và `updatedAt: Timestamp.now()` vào document lịch khi có thao tác lưu lịch hoặc tick phụ cấp.

### 5. [DOCS] Chỉ Mục Tri Thức Hệ Thống (AI Knowledge Index)
- Xây dựng tài liệu chuẩn mực [`AI_KNOWLEDGE_INDEX.md`](file:///d:/app_cham_cong/cham_cong_tram/AI_KNOWLEDGE_INDEX.md) quy tụ 100% kiến trúc, mô hình dữ liệu, phân quyền và quy trình nghiệp vụ cho hệ thống Chấm Công Trạm.

---

## 🧪 KẾT QUẢ KIỂM THỬ HỆ THỐNG

- **Mobile App (`cham_cong_tram`):** Vượt qua toàn bộ **66/66 test cases (0 lỗi)** (`All tests passed!`). `flutter analyze` 0 errors.
- **Web Dashboard (`cham_cong_web`):** Lệnh `npm run build` thành công 100% (`Compiled successfully, 12/12 static pages generated`).
- **Kho lưu trữ GitHub:** Đồng bộ mã nguồn mới nhất trên cả 2 repository:
  - Mobile App: `https://github.com/2312741-sudo/appchamcong.git`
  - Web Dashboard: `https://github.com/2312741-sudo/webquanlychamcong.git`
