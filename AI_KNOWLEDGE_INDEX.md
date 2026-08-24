# 🧠 CHẤM CÔNG TRẠM — TÀI LIỆU TOÀN DIỆN & CHỈ MỤC TRI THỨC HỆ THỐNG (AI KNOWLEDGE INDEX)

> **Dành cho các AI Agents, Nhà phát triển & Kỹ sư hệ thống kế thừa.**  
> Tài liệu này chuẩn hóa toàn bộ bức tranh kiến trúc, mô hình dữ liệu, phân quyền (RBAC), quy trình nghiệp vụ và các quy chuẩn kỹ thuật của hệ thống **Chấm Công Trạm**. Bất kỳ AI hoặc lập trình viên nào khi đọc tài liệu này đều có thể nắm bắt 100% ngữ cảnh để tiếp tục phát triển, bảo trì hoặc mở rộng hệ thống mà không làm gãy vỡ logic hiện tại.

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

- **Tên dự án**: **Chấm Công Trạm** (`chamcongtram` / `cham_cong_tram`)
- **Tác giả & Chủ sở hữu**: Nguyễn Thanh Tâm ([nthanhtam.402@gmail.com](mailto:nthanhtam.402@gmail.com))
- **Mục tiêu & Nghiệp vụ cốt lõi**:
  - Hệ thống quản lý chấm công thông minh, xếp lịch làm việc theo ca linh hoạt, phân quyền nhân sự 4 cấp bậc, theo dõi checklist sản xuất và tự động tính lương chuyên biệt cho chuỗi cửa hàng F&B / bán lẻ (đặc biệt là mô hình Trạm Chanh, trà sữa, cafe, nhà hàng).
  - Tích hợp 2 nền tảng: **Mobile App** (iOS & Android) và **Web Dashboard** (Cổng quản lý trên trình duyệt).
  - Kết nối dữ liệu thời gian thực (Real-time NoSQL) qua đám mây Google Firebase.

### 🌐 Hệ Sinh Thái Sản Phẩm (Product Ecosystem)

```
                       ┌──────────────────────────────────────────────┐
                       │        GOOGLE FIREBASE CLOUD BACKEND         │
                       │  (Auth | Firestore | Storage | Messaging)    │
                       └──────────────────────┬───────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│       FLUTTER MOBILE APPLICATION      │   │        NEXT.JS WEB DASHBOARD          │
│    (iOS & Android - cham_cong_tram)   │   │  (webquanlychamcong.vercel.app)       │
├───────────────────────────────────────┤   ├───────────────────────────────────────┤
│ • Chấm công đa kênh (WiFi, GPS, QR)   │   │ • Bảng điều khiển tổng quan (Metrics) │
│ • Lịch làm việc & Đăng ký ca tuần     │   │ • Quản lý & duyệt nhân sự (RBAC)      │
│ • Xem bảng lương & Lịch thu nhập      │   │ • Xếp lịch làm việc trực quan         │
│ • Gửi yêu cầu ứng lương               │   │ • Cấu hình ca, WiFi, GPS & Chi nhánh  │
│ • Checklist & Báo cáo ca Sản Xuất (SX)│   │ • Quản lý Checklist & Hiệu suất SX    │
│ • Thông báo Push FCM & Sinh nhật 🎂   │   │ • Xuất báo cáo Excel chuyên nghiệp    │
│ • Chấm công cho Chủ & Quản lý         │   │ • Sắp xếp thứ tự & Ẩn lịch linh hoạt  │
│ • Avatar đồng bộ toàn hệ thống        │   │ • Live Stream đồng bộ với Mobile      │
└───────────────────────────────────────┘   └───────────────────────────────────────┘
```

---

## 2. KIẾN TRÚC KỸ THUẬT & CÔNG NGHỆ (TECH STACK & ARCHITECTURE)

### 2.1. Mobile Application (`cham_cong_tram`)
- **Ngôn ngữ & SDK**: Dart 3.6+ / Flutter 3.29+
- **Kiến trúc mã nguồn**: Clean Feature-first Architecture kết hợp Repository Pattern.
- **Quản lý trạng thái (State Management)**: `flutter_riverpod: ^2.6.1` (`Notifier`, `StreamProvider`, `FutureProvider`).
- **Điều hướng (Routing)**: `go_router: ^14.3.0` kết hợp `rootNavigatorKey` toàn cục phục vụ điều hướng thông báo đẩy tức thì.
- **Xác thực (Authentication)**: Firebase Auth hỗ trợ Email/Password, **Google Sign-In** (`google_sign_in`), **Apple Sign-In** (`sign_in_with_apple`).
- **Push Notification & FCM Lifecycle**:
  - `firebase_messaging: ^15.1.3` & `flutter_local_notifications: ^18.0.1`.
  - Hỗ trợ đầy đủ 3 trạng thái click: **Cold Start** (`getInitialMessage`), **Background** (`onMessageOpenedApp`), **Foreground** (`onDidReceiveNotificationResponse`).
  - Native iOS APNs bridge trong `AppDelegate.swift` (`Messaging.messaging().apnsToken = deviceToken`).
  - Android Notification Channel: `cham_cong_notifications` ("Thông báo Chấm Công").
- **Phần cứng & Thiết bị ngoại vi**:
  - `geolocator: ^13.0.1`: Tính toán khoảng cách tọa độ GPS Haversine theo bán kính cửa hàng.
  - `network_info_plus: ^6.0.1`: Xác thực tên mạng Wi-Fi (SSID), BSSID và IP Gateway.
  - `mobile_scanner: ^6.0.11`: Quét mã QR Code động điểm danh tại cửa hàng.
  - `image_picker: ^1.1.2`: Chụp ảnh & chọn ảnh đại diện từ thư viện.
  - `table_calendar: ^3.1.2` & `fl_chart: ^0.69.0`: Lịch chấm công & biểu đồ thu nhập.
  - `excel: ^4.0.6`, `path_provider`, `open_filex`, `share_plus`: Xuất và chia sẻ file Excel trực tiếp từ điện thoại.

### 2.2. Web Dashboard (`cham_cong_web`)
- **Ngôn ngữ & Framework**: Next.js 16 (App Router) + React 19 + TypeScript.
- **Styling**: Tailwind CSS + CSS Modules + Modern Glassmorphism.
- **Xử lý Excel chuyên sâu**: `exceljs: ^4.4.0` + `file-saver` (định dạng ô, màu sắc thương hiệu `themeColor`, công thức tính, gộp ô và canh lề chuẩn in ấn).
- **Hosting & CI/CD**: Vercel Production (`https://webquanlychamcong.vercel.app`) tự động build và deploy khi có commit mới trên nhánh `main`.

### 2.3. Dịch Vụ Đám Mây (Backend & Database)
- **Cơ sở dữ liệu**: Cloud Firestore (NoSQL, mô hình Document-Subcollection).
- **Lưu trữ tệp tin**: Firebase Storage (`storage.rules`) cho ảnh đại diện (`avatars/{userId}.jpg`).
- **Cloud Functions**: Node.js Firebase Functions v2 (`onScheduleChanged`, `onAdvanceCreated`, `onAdvanceUpdated`, `shiftReminders`, `onNotificationCreated`).

---

## 3. CƠ SỞ DỮ LIỆU CLOUD FIRESTORE (DATA SCHEMAS & MODELS)

```
cloud_firestore
├── /users/{userId}                              [Thông tin tài khoản toàn cục]
└── /stores/{storeId}                            [Thông tin cửa hàng / chi nhánh]
    ├── /members/{userId}                        [Danh sách thành viên cửa hàng]
    ├── /attendances/{attendanceId}              [Nhật ký chấm công vào/ra]
    ├── /schedules/{scheduleId}                  [Lịch làm việc các tuần]
    ├── /advances/{advanceId}                    [Yêu cầu tạm ứng lương]
    ├── /notifications/{notificationId}          [Hệ thống thông báo thời gian thực]
    ├── /production_tasks/{taskId}               [Danh mục đầu việc Checklist SX]
    └── /production_reports/{reportId}           [Báo cáo hoàn thành ca SX]
```

### Chi Tiết Cấu Trúc Các Documents & Subcollections:

#### 1. Document `/users/{userId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` / `userId` | `string` | UID người dùng từ Firebase Authentication |
| `name` | `string` | Họ và tên hiển thị |
| `email` | `string` | Địa chỉ email đăng nhập |
| `phone` | `string?` | Số điện thoại liên hệ |
| `avatarUrl` | `string?` | URL ảnh đại diện trên Firebase Storage |
| `fcmToken` | `string?` | Token thiết bị nhận push notifications |
| `birthday` | `string?` / `Timestamp` | Ngày sinh (phục vụ tự động chúc mừng sinh nhật 🎂) |
| `currentStoreId` | `string?` | ID cửa hàng đang được kích hoạt làm việc |
| `storeIds` | `string[]` | Danh sách tất cả cửa hàng mà người dùng đã tham gia |
| `createdAt` | `Timestamp` | Thời gian tạo tài khoản |

#### 2. Document `/stores/{storeId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | `string` | Mã định danh cửa hàng trên Firestore |
| `name` | `string` | Tên cửa hàng (VD: *Trạm Chanh Tràng Tiền*) |
| `code` | `string` | Mã tham gia 6 ký tự viết hoa (VD: `TC8899`) |
| `ownerId` | `string` | UID của Chủ cửa hàng |
| `address` | `string?` | Địa chỉ vật lý |
| `latitude`, `longitude` | `number?` | Tọa độ GPS của cửa hàng |
| `radiusMeters` | `number` | Bán kính cho phép chấm công GPS (Mặc định: 100m) |
| `wifis` | `StoreWifi[]` | Danh sách tối đa **10 điểm WiFi** (`name`, `ip`) |
| `customShifts` | `ShiftDefinition[]` | Cấu hình ca làm việc riêng (`id`, `name`, `startHour`, `startMinute`, `endHour`, `endMinute`) |
| `departments` | `Department[]` | Danh sách bộ phận (`id`, `name`, `shortName` e.g. `SX`, `BH`, `KHO`) |
| `deliveryAllowance` | `number` | Mức phụ cấp mỗi ca chở hàng (VNĐ) |
| `giaoHangAllowance` | `number` | Mức phụ cấp mỗi ca giao hàng (VNĐ) |
| `memberOrder` | `string[]` | Mảng chứa danh sách `userId` quy định **thứ tự hiển thị nhân viên tùy chỉnh** do Chủ quán sắp xếp |
| `hiddenScheduleUserIds` | `string[]` | Mảng các `userId` **bị ẩn lịch** trên Lịch chung của cửa hàng |
| `deletePassword` | `string` | Mật khẩu bảo mật dùng khi xóa dữ liệu hoặc xóa cửa hàng |
| `themeColor` | `string?` | Mã màu HEX thương hiệu cửa hàng |

#### 3. Subcollection `/stores/{storeId}/members/{userId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `userId` | `string` | UID của thành viên |
| `name` | `string` | Tên thành viên |
| `phone` | `string?` | Số điện thoại |
| `avatarUrl` | `string?` | URL ảnh đại diện đồng bộ tức thì |
| `role` | `string` | Vai trò: `'owner'` \| `'manager1'` (`'manager_1'`) \| `'manager2'` (`'manager_2'`) \| `'employee'` |
| `status` | `string` | Trạng thái: `'active'` (đang hoạt động) \| `'pending'` (chờ duyệt) \| `'kicked'` (đã xóa) |
| `employeeType` | `string` | Loại hợp đồng: `'fulltime'` (lương tháng) \| `'parttime'` (lương giờ) |
| `baseMonthlySalary` | `number` | Mức lương cơ bản tháng (Fulltime, VNĐ) |
| `baseHourlyRate` | `number` | Đơn giá lương theo giờ (Parttime, VNĐ) |
| `standardHoursPerMonth` | `number` | Số giờ làm việc chuẩn trong tháng (Mặc định: 208h) |
| `employeeCode` | `string?` | Mã nhân viên (VD: `NV01`, `NV02`) |
| `joinedAt` | `string?` / `Timestamp` | Ngày chính thức vào làm |

#### 4. Subcollection `/stores/{storeId}/attendances/{attendanceId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | `string` | Mã bản ghi chấm công |
| `userId` | `string` | UID nhân viên chấm công |
| `date` | `string` | Ngày chấm công (`YYYY-MM-DD`) |
| `checkIn` | `Timestamp` | Thời điểm bấm vào ca (UTC) |
| `checkOut` | `Timestamp?` | Thời điểm bấm ra ca (UTC, null nếu đang trong ca) |
| `checkInMethod` | `string` | Phương thức: `'wifi'` \| `'gps'` \| `'qr'` \| `'manual'` |
| `totalHours` | `number` | Tổng số giờ làm việc thực tế tính được |
| `isEdited` | `boolean` | Cờ đánh dấu đã qua chỉnh sửa thủ công |
| `editedBy` | `string?` | Tên/UID người thực hiện chỉnh sửa |
| `editNote` | `string?` | Lý do điều chỉnh giờ công |

#### 5. Subcollection `/stores/{storeId}/schedules/{scheduleId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | `string` | ID document |
| `storeId` | `string` | ID cửa hàng |
| `weekStart` | `string` | Ngày Thứ Hai đầu tuần (`YYYY-MM-DD`) |
| `shifts` | `Record<userId, DaySchedule>` | Bản đồ ca trực trong tuần của từng nhân viên (`monday`, `tuesday`...`sunday` chứa mảng các mã ca như `['morning|deptId', 'delivery']`) |
| `updatedBy` | `string?` | UID của người cập nhật lịch gần nhất (Audit log) |
| `updatedAt` | `Timestamp?` | Thời gian cập nhật gần nhất |

---

## 4. MA TRẬN PHÂN QUYỀN VAI TRÒ (RBAC MATRIX)

Hệ thống phân cấp chặt chẽ thành **4 vai trò độc lập** (`AppPermissions` trên Mobile & `can*` trên Web):

| Chức năng / Quyền hạn | 👑 Chủ Cửa Hàng (`owner`) | 👔 Quản Lý 1 (`manager1`) | 👔 Quản Lý 2 (`manager2`) | 👤 Nhân Viên (`employee`) |
| :--- | :---: | :---: | :---: | :---: |
| **Truy cập Web Dashboard** | ✅ Toàn quyền | ✅ Lịch làm, Bảng công, Duyệt NV | ✅ Chỉ xem Lịch làm | ❌ Không có quyền |
| **Chấm công qua Mobile (WiFi/GPS/QR)** | ✅ Có | ✅ Có | ✅ Có | ✅ Có |
| **Xếp & Sửa Lịch làm việc tuần** | ✅ Toàn quyền | ✅ Toàn quyền | ❌ Chỉ xem | ❌ Đăng ký nguyện vọng |
| **Xếp / Tick phụ cấp Chở & Giao hàng**| ✅ Toàn quyền | ✅ Có | ✅ Có | ❌ Không |
| **Duyệt thành viên mới xin vào quán** | ✅ Có | ✅ Có | ❌ Không | ❌ Không |
| **Xem bảng chấm công toàn bộ NV** | ✅ Có | ✅ Có | ❌ **(ĐÃ KHÓA)** | ❌ |
| **Sửa giờ in/out công của NV** | ✅ Toàn quyền | ✅ Có | ❌ **(ĐÃ KHÓA)** | ❌ |
| **Kéo thả đổi thứ tự nhân viên (`memberOrder`)** | ✅ Toàn quyền | ❌ Theo thứ tự của Chủ | ❌ Theo thứ tự của Chủ | ❌ Theo thứ tự của Chủ |
| **Bật/tắt Ẩn lịch nhân viên (`hiddenScheduleUserIds`)** | ✅ Toàn quyền | ❌ Không thấy NV bị ẩn | ❌ Không thấy NV bị ẩn | ❌ Không thấy NV bị ẩn |
| **Quản lý danh mục Checklist & Thứ tự SX** | ✅ Toàn quyền | ❌ Chỉ xem | ❌ Chỉ xem | ❌ Nộp báo cáo khi out ca |
| **Duyệt yêu cầu Tạm ứng lương** | ✅ Toàn quyền | ❌ Không | ❌ Không | ❌ Gửi yêu cầu |
| **Chỉnh sửa Bảng lương & Hợp đồng** | ✅ Toàn quyền | ❌ Không | ❌ Không | ❌ Xem lương cá nhân |
| **Cài đặt cửa hàng (WiFi, GPS, Ca, Xóa quán)**| ✅ Toàn quyền | ❌ Không | ❌ Không | ❌ Không |
| **Xuất báo cáo Excel (Bảng công, Lương, Lịch)**| ✅ Toàn quyền | ✅ Theo phân quyền | ❌ Không | ❌ Không |

---

## 5. CÁC QUY TRÌNH NGHIỆP VỤ CỐT LÕI (CORE BUSINESS LOGIC)

### 5.1. Quy Trình Chấm Công Đa Kênh & Ca Xuyên Đêm (Cross-Midnight)
1. **Chấm công đa phương thức**: Hỗ trợ WiFi (so khớp tối đa 10 IP/SSID), GPS (bán kính `radiusMeters`) và QR Code động.
2. **Cơ chế ca xuyên đêm (Cross-Midnight Persistence)**:
   - Hệ thống truy vấn trạng thái làm việc qua `watchActiveAttendance(storeId, userId)`: Tìm bản ghi có `checkOut == null` (không bị giới hạn cứng bởi ngày `date == today`).
   - Khi nhân viên vào ca lúc `22:00` tối hôm nay và checkout lúc `06:00` sáng hôm sau, trạng thái "Đang làm việc" vẫn duy trì nguyên vẹn và số giờ công được tính chính xác là 8.0 giờ.

### 5.2. Quy Trình Báo Cáo Checklist Sản Xuất (SX Checklist)
- **Kích hoạt tự động khi Checkout**: Nếu ca trực hôm nay có gán bộ phận Sản Xuất (`shortName == 'SX'`), app tự động mở modal Checklist Sản Xuất trước khi cho phép ra ca.
- **Hỗ trợ số thập phân linh hoạt**: Ô nhập số lượng chấp nhận cả dấu chấm `.` và dấu phẩy `,` (`2,5`, `0.75`, `12,5` kg). Hệ thống tự động chuẩn hóa sang định dạng `double` chuẩn trước khi lưu Firestore.

### 5.3. Quy Trình Đăng Ký Lịch & Bảo Toàn Dữ Liệu (Merge Scheduling)
- Khi nhân viên tự đăng ký ca tuần, quản lý nhận được thông báo đẩy dẫn thẳng vào đúng tuần làm việc (`initialWeekStart`).
- Khi Quản lý hoặc Chủ lưu lịch làm việc, phương thức `setFullSchedule` tự động sử dụng `SetOptions(merge: true)` và merge dữ liệu Firestore mới nhất trên Web để không ghi đè làm mất lịch của các nhân sự khác.
- Mini-badges thống kê năng suất tuần hiển thị tức thì trên danh sách nhân sự: `⏱️ X.Xh` (tổng giờ làm đã xếp) và `📦 Y ca` (tổng ca chở hàng).

### 5.4. Quy Trình Tải Lên & Đồng Bộ Ảnh Đại Diện (Avatar Sync)
- Người dùng chụp ảnh hoặc chọn ảnh từ máy $\rightarrow$ Client nén ảnh (`800x800`, chất lượng 85%) $\rightarrow$ Tải lên Firebase Storage `avatars/{userId}.jpg` $\rightarrow$ Cập nhật `/users/{userId}`, `FirebaseAuth.currentUser.photoURL` và tự động phát tán tới `/stores/{storeId}/members/{userId}` của toàn bộ cửa hàng liên quan.
- Quy tắc `storage.rules` đảm bảo chỉ chính chủ mới có quyền ghi đè avatar của chính mình.

### 5.5. Quy Trình Điều Hướng Thông Báo Đẩy (FCM Deep Linking)
- Khi nhận được push notification trên màn hình khóa hoặc thanh thông báo hệ điều hành (kể cả khi app đang chạy ngầm hoặc bị tắt hoàn toàn), việc chạm vào thông báo sẽ tự động kích hoạt `handleNotificationTap` điều hướng người dùng thẳng vào màn hình danh sách Thông báo (`/notifications`) để xem chi tiết.

---

## 6. QUY CHUẨN XUẤT FILE EXCEL (.XLSX)

1. **Bảng Chấm Công Tháng (`exportMonthlyAttendance`)**: Header phủ màu thương hiệu `themeColor`, sắp xếp đúng thứ tự `memberOrder`, hiển thị chi tiết số giờ từng ngày và tổng giờ tháng.
2. **Chi Tiết Giờ Vào/Ra IN-OUT (`exportDetailedInOut`)**: Xuất chi tiết mốc thời gian IN/OUT thực tế.
3. **Báo Cáo Bảng Lương Tháng (`exportMonthlySalary`)**: Phân tách rõ lương cơ bản, số ca chở/giao hàng, tiền phụ cấp, tạm ứng và lương thực nhận.
4. **Lịch Làm Việc Tuần (`exportWeeklySchedule`)**: Ma trận lịch 7 ngày phân ca theo bộ phận.
5. **Báo Cáo Hiệu Quả Sản Xuất (`exportProductionReport`)**: Thống kê sản lượng hoàn thành của từng nhân viên.

---

## 7. HƯỚNG DẪN DÀNH CHO AI & LẬP TRÌNH VIÊN TIẾP NHẬN

1. **Tuân thủ RBAC**: Luôn kiểm tra quyền thông qua `AppPermissions` (Mobile) và `lib/types.ts` (Web). Tuyệt đối không hardcode logic kiểm tra vai trò đơn lẻ.
2. **Đồng bộ song phương**: Bất kỳ nâng cấp logic nào về dữ liệu, tính lương, lịch làm việc hoặc checklist phải được cập nhật đồng thời trên cả Mobile và Web.
3. **Kiểm thử tự động bắt buộc**:
   - Mobile: Chạy `flutter test` (đảm bảo vượt qua toàn bộ 66/66 test cases) và `flutter analyze` (0 errors).
   - Web: Chạy `npm run build` tại `cham_cong_web` (đảm bảo biên dịch thành công 12/12 routes).

---
*Tài liệu được cập nhật tự động và đồng bộ định kỳ theo tiến trình phát triển hệ thống Chấm Công Trạm.*
