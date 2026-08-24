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
│ • Thông báo Real-time & Sinh nhật 🎂  │   │ • Xuất báo cáo Excel chuyên nghiệp    │
│ • Chấm công cho Chủ & Quản lý         │   │ • Sắp xếp thứ tự & Ẩn lịch linh hoạt  │
└───────────────────────────────────────┘   └───────────────────────────────────────┘
```

---

## 2. KIẾN TRÚC KỸ THUẬT & CÔNG NGHỆ (TECH STACK & ARCHITECTURE)

### 2.1. Mobile Application (`cham_cong_tram`)
- **Ngôn ngữ & SDK**: Dart 3.6+ / Flutter 3.29+
- **Kiến trúc mã nguồn**: Clean Feature-first Architecture kết hợp Repository Pattern.
- **Quản lý trạng thái (State Management)**: `flutter_riverpod: ^2.6.1` (`Notifier`, `StreamProvider`, `FutureProvider`).
- **Điều hướng (Routing)**: `go_router: ^14.3.0` với declarative routes và `GoRouterRefreshStream` lắng nghe thay đổi xác thực tức thì.
- **Xác thực (Authentication)**: Firebase Auth hỗ trợ Email/Password, **Google Sign-In** (`google_sign_in`), **Apple Sign-In** (`sign_in_with_apple`).
- **Phần cứng & Thiết bị ngoại vi**:
  - `geolocator: ^13.0.1`: Tính toán khoảng cách tọa độ GPS Haversine theo bán kính cửa hàng.
  - `network_info_plus: ^6.0.1`: Xác thực tên mạng Wi-Fi (SSID), BSSID và IP Gateway.
  - `mobile_scanner: ^6.0.11`: Quét mã QR Code động điểm danh tại cửa hàng.
  - `table_calendar: ^3.1.2` & `fl_chart: ^0.69.0`: Lịch chấm công & biểu đồ thu nhập.
  - `excel: ^4.0.6`, `path_provider`, `open_filex`, `share_plus`: Xuất và chia sẻ file Excel trực tiếp từ điện thoại.

### 2.2. Web Dashboard (`cham_cong_web`)
- **Ngôn ngữ & Framework**: Next.js 16 (App Router) + React 19 + TypeScript.
- **Styling**: Tailwind CSS + CSS Modules + Modern Glassmorphism.
- **Xử lý Excel chuyên sâu**: `exceljs: ^4.4.0` + `file-saver` (định dạng ô, màu sắc thương hiệu `themeColor`, công thức tính, gộp ô và canh lề chuẩn in ấn).
- **Hosting & CI/CD**: Vercel Production (`https://webquanlychamcong.vercel.app`) tự động build và deploy khi có commit mới trên nhánh `main`.

### 2.3. Dịch Vụ Đám Mây (Backend & Database)
- **Cơ sở dữ liệu**: Cloud Firestore (NoSQL, mô hình Document-Subcollection).
- **Lưu trữ tệp tin**: Firebase Storage (ảnh đại diện, hóa đơn).
- **Thông báo**: Firebase Cloud Messaging (FCM) + In-app Real-time Notification Collection.

---

## 3. CƠ SỞ DỮ LIỆU CLOUD FIRESTORE (DATA SCHEMAS & MODELS)

Hệ thống sử dụng cấu trúc cây thư mục Firestore chuẩn mực như sau:

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
| `memberOrder` | `string[]` | Mảng chứa danh sách `userId` quy định **thứ tự hiển thị nhân viên tùy chỉnh** do Chủ quán kéo thả |
| `hiddenScheduleUserIds` | `string[]` | Mảng các `userId` **bị ẩn lịch** trên Lịch chung của cửa hàng |
| `deletePassword` | `string` | Mật khẩu bảo mật dùng khi xóa dữ liệu hoặc xóa cửa hàng |
| `themeColor` | `string?` | Mã màu HEX thương hiệu cửa hàng |

#### 3. Subcollection `/stores/{storeId}/members/{userId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `userId` | `string` | UID của thành viên |
| `name` | `string` | Tên thành viên |
| `phone` | `string?` | Số điện thoại |
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
| `checkIn` | `Timestamp` | Thời điểm bấm vào ca |
| `checkOut` | `Timestamp?` | Thời điểm bấm ra ca (null nếu đang trong ca) |
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

#### 6. Subcollection `/stores/{storeId}/advances/{advanceId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | `string` | ID yêu cầu |
| `userId` | `string` | UID nhân viên xin tạm ứng |
| `month` | `string` | Tháng tạm ứng (`YYYY-MM`) |
| `amount` | `number` | Số tiền xin tạm ứng (VNĐ) |
| `status` | `string` | Trạng thái: `'pending'` (chờ duyệt) \| `'approved'` (đã duyệt) \| `'rejected'` (từ chối) |
| `requestDate` | `string` | Ngày tạo yêu cầu |
| `approvedDate` | `string?` | Ngày được xét duyệt |
| `note` | `string?` | Ghi chú / lý do tạm ứng |

#### 7. Subcollection `/stores/{storeId}/production_tasks/{taskId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | `string` | ID đầu việc |
| `name` | `string` | Tên đầu việc (VD: *Nấu trà sen*, *Rửa bình ủ*, *Vệ sinh sàn*) |
| `hasUnit` | `boolean` | Có sử dụng đơn vị đo lường hay là checklist thuần túy |
| `unit` | `string` | Kiểu đơn vị: `'custom'` \| `'none'` |
| `unitLabel` | `string` | Nhãn đơn vị đo lường tùy chỉnh (VD: *Kg*, *Phút*, *Thùng*, *Ly*, *Hộp*, *Gói*, *Bao*, *Cái*...) |
| `order` | `number` | Thứ tự sắp xếp hiển thị do Chủ quán cấu hình |
| `active` | `boolean` | Trạng thái kích hoạt đầu việc |

#### 8. Subcollection `/stores/{storeId}/production_reports/{reportId}`
| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `id` | `string` | ID báo cáo ca sản xuất |
| `userId` | `string` | UID nhân viên nộp báo cáo |
| `memberName` | `string` | Tên nhân viên |
| `date` | `string` | Ngày báo cáo (`YYYY-MM-DD`) |
| `shiftName` | `string` | Tên ca làm việc |
| `checkoutTime` | `Timestamp` | Thời gian bấm ra ca |
| `tasks` | `ProductionTaskEntry[]` | Mảng kết quả thực hiện (`taskId`, `taskName`, `unitLabel`, `value`) |
| `note` | `string?` | Ghi chú phát sinh trong ca |

---

## 4. MA TRẬN PHÂN QUYỀN VAI TRÒ (RBAC MATRIX)

Hệ thống phân cấp chặt chẽ thành **4 vai trò độc lập**:

| Chức năng / Quyền hạn | 👑 Chủ Cửa Hàng (`owner`) | 👔 Quản Lý 1 (`manager1`) | 👔 Quản Lý 2 (`manager2`) | 👤 Nhân Viên (`employee`) |
| :--- | :---: | :---: | :---: | :---: |
| **Truy cập Web Dashboard** | ✅ Toàn quyền | ✅ Lịch làm, Bảng công, Duyệt NV | ✅ Chỉ xem Lịch làm | ❌ Không có quyền |
| **Chấm công qua Mobile (WiFi/GPS/QR)** | ✅ Có | ✅ Có | ✅ Có | ✅ Có |
| **Xếp & Sửa Lịch làm việc tuần** | ✅ Toàn quyền | ✅ Toàn quyền | ❌ Chỉ xem | ❌ Đăng ký nguyện vọng |
| **Duyệt thành viên mới xin vào quán** | ✅ Có | ✅ Có | ❌ Không | ❌ Không |
| **Kéo thả đổi thứ tự nhân viên (`memberOrder`)** | ✅ Toàn quyền | ❌ Theo thứ tự của Chủ | ❌ Theo thứ tự của Chủ | ❌ Theo thứ tự của Chủ |
| **Bật/tắt Ẩn lịch nhân viên (`hiddenScheduleUserIds`)** | ✅ Toàn quyền | ❌ Không thấy NV bị ẩn | ❌ Không thấy NV bị ẩn | ❌ Không thấy NV bị ẩn |
| **Quản lý danh mục Checklist & Thứ tự SX** | ✅ Toàn quyền | ❌ Chỉ xem | ❌ Chỉ xem | ❌ Nộp báo cáo khi out ca |
| **Duyệt yêu cầu Tạm ứng lương** | ✅ Toàn quyền | ❌ Không | ❌ Không | ❌ Gửi yêu cầu |
| **Chỉnh sửa Bảng lương & Hợp đồng** | ✅ Toàn quyền | ❌ Không | ❌ Không | ❌ Xem lương cá nhân |
| **Sửa giờ công thủ công (Edit IN/OUT)** | ✅ Toàn quyền | ❌ Không | ❌ Không | ❌ Không |
| **Cài đặt cửa hàng (WiFi, GPS, Ca, Xóa quán)**| ✅ Toàn quyền | ❌ Không | ❌ Không | ❌ Không |
| **Xuất báo cáo Excel (Bảng công, Lương, Lịch)**| ✅ Toàn quyền | ✅ Theo phân quyền | ❌ Không | ❌ Không |

---

## 5. CÁC QUY TRÌNH NGHIỆP VỤ CỐT LÕI (CORE BUSINESS LOGIC)

### 5.1. Quy Trình Chấm Công Đa Kênh (Check-In / Check-Out)
1. **Chấm công qua Wi-Fi**: Thiết bị đọc SSID/BSSID hiện tại và đối chiếu với danh sách tối đa **10 điểm WiFi** được cấu hình trong `stores/{storeId}.wifis`.
2. **Chấm công qua GPS**: Thiết bị lấy tọa độ hiện tại qua Geolocator, tính khoảng cách tới `(latitude, longitude)` của quán. Hợp lệ nếu `khoangCach <= radiusMeters`.
3. **Chấm công qua QR Code**: Quét mã QR động của cửa hàng để xác thực tại chỗ.
4. **Tính toán giờ công**:
   - Tự động tính toán tổng số giờ làm `totalHours = (checkOut - checkIn) / 3600000`.
   - **Xử lý ca xuyên đêm (Cross-midnight)**: Khi ca làm việc bắt đầu từ `22:00` tối hôm nay và kết thúc vào `06:00` sáng hôm sau, hệ thống tính toán chính xác 8.0 giờ mà không bị âm thời gian.

### 5.2. Quy Trình Báo Cáo Checklist Sản Xuất (SX Checklist Trigger)
- **Cơ chế nhận diện tự động**:
  - Khi nhân viên bấm **Chấm Ra Ca (Check-out)** trên Mobile App, hệ thống kiểm tra lịch làm hôm nay của nhân viên đó.
  - Nếu trong ca trực có gán bộ phận Sản Xuất (`shortName == 'SX'`), app tự động bật BottomSheet/Modal yêu cầu hoàn thành Checklist Sản Xuất trước khi kết thúc ca.
- **Tính linh hoạt của đơn vị đo lường**:
  - Đơn vị đo lường là tùy chọn (`hasUnit: boolean`).
  - Nếu tắt đơn vị đo lường: Đầu việc hoạt động như checklist thuần túy (chỉ cần tích chọn `✓ Đã hoàn thành`, hệ thống tự ghi nhận `value = 1.0`).
  - Nếu bật đơn vị đo lường: Chủ quán có thể tùy ý gán nhãn đơn vị tự do (*Kg*, *Phút*, *Sản phẩm*, *Ca*, *Gói*, *Thùng*, *Ly*, *Hộp*, *Bao*, *Cái*...) và nhân viên nhập số lượng thực tế đạt được.

### 5.3. Quy Trình Tính Lương & Tạm Ứng
- **Nhân viên Toàn thời gian (Full-time)**:
  $$\text{Lương Thực Nhận} = \left(\text{Lương Cơ Bản} \times \frac{\text{Tổng Giờ Làm}}{\text{Giờ Chuẩn (208h)}}\right) + \text{Phụ Cấp Chở/Giao Hàng} - \text{Tạm Ứng Đã Duyệt}$$
- **Nhân viên Bán thời gian (Part-time)**:
  $$\text{Lương Thực Nhận} = \left(\text{Tổng Giờ Làm} \times \text{Đơn Giá Theo Giờ}\right) + \text{Phụ Cấp Chở/Giao Hàng} - \text{Tạm Ứng Đã Duyệt}$$
- **Lịch thu nhập tương tác (Earnings Calendar)**: Màn hình chi tiết lương trên Mobile hiển thị số tiền kiếm được theo từng ngày, giúp nhân viên theo dõi thu nhập minh bạch.

### 5.4. Quy Trình Sắp Xếp Thứ Tự Nhân Viên & Đồng Bộ Excel
- Khi Chủ quán sắp xếp thứ tự hiển thị nhân viên (Drag & Drop trên Web hoặc Mobile), mảng `memberOrder` được cập nhật lên document `stores/{storeId}`.
- Mọi giao diện danh sách nhân viên, bảng lịch làm việc và **tất cả 5 file xuất Excel** đều tự động áp dụng hàm `sortMembersByOrder(members, store.memberOrder)` để đồng bộ thứ tự 100% nhất quán.

### 5.5. Quy Trình Ẩn Lịch Nhân Viên Riêng Tư
- Khi nhân viên được gắn cờ trong `store.hiddenScheduleUserIds`:
  - **Chủ quán**: Vẫn xem đầy đủ và có nhãn 🙈 `Ẩn`.
  - **Bản thân nhân viên đó**: Vẫn xem được lịch cá nhân của mình.
  - **Quản lý & Nhân viên khác**: Hoàn toàn bị ẩn dòng lịch của nhân viên này trên lịch cửa hàng.

---

## 6. QUY CHUẨN XUẤT FILE EXCEL (.XLSX)

Hệ thống cung cấp bộ công cụ xuất file Excel chuẩn mực, chuyên nghiệp được định dạng tỉ mỉ bằng `ExcelJS`:

1. **Bảng Chấm Công Tháng (`exportMonthlyAttendance`)**:
   - File: `BangCong_[TenQuan]_T[Thang]-[Nam].xlsx`
   - Cột: Nhân viên, Vai trò, Tổng giờ, Ngày 1 -> Ngày 31.
   - Định dạng: Header phủ màu thương hiệu `themeColor`, ô có giờ làm được highlight màu nền nhẹ, số giờ định dạng `0.0`. Sắp xếp chuẩn theo `memberOrder`.
2. **Chi Tiết Giờ Vào/Ra IN-OUT (`exportDetailedInOut`)**:
   - File: `ChiTietInOut_[TenQuan]_T[Thang]-[Nam].xlsx`
   - Cột: Ngày, Mã NV, Tên nhân viên, Giờ, IN/OUT.
3. **Báo Cáo Bảng Lương Tháng (`exportMonthlySalary`)**:
   - File: `BaoCaoLuong_[TenQuan]_T[Thang]-[Nam].xlsx`
   - Cột: Tên nhân viên, Vai trò, Loại HĐ, Tổng giờ, Giờ chuẩn, Lương cơ bản, Số ca chở, Phụ cấp chở, Số ca giao, Phụ cấp giao, Đã tạm ứng, Lương thực nhận.
   - Định dạng tiền tệ: `#,##0` đ, tự động tính tổng quỹ lương.
4. **Lịch Làm Việc Tuần (`exportWeeklySchedule`)**:
   - File: `LichLam_[TenQuan]_T[Thang]-[Nam]_[Tuan].xlsx`
   - Bảng ma trận 7 ngày trong tuần, phân tách ca theo từng bộ phận (`[SX]`, `[BH]`, `📦 Chở`, `🛵 Giao`), hiển thị thời gian bắt đầu - kết thúc và tổng giờ từng ca.
5. **Báo Cáo Hiệu Quả Sản Xuất (`exportProductionReport`)**:
   - File: `BaoCaoSanXuat_[TenQuan]_T[Thang]-[Nam].xlsx`
   - Chi tiết từng ca nộp báo cáo kèm bảng **Tổng hợp theo từng nhân viên** ở cuối trang.

---

## 7. CƠ CHẾ TỰ PHỤC HỒI & AN TOÀN DỮ LIỆU (SELF-HEALING & SECURITY)

1. **Cơ chế tự phục hồi cửa hàng (Self-healing Stores Discovery)**:
   - Nếu mảng `storeIds` trong hồ sơ người dùng bị rỗng hoặc thiếu, hệ thống tự động chạy truy vấn `collectionGroup('members').where('userId', '==', uid)` để dò tìm toàn bộ các cửa hàng mà người dùng là thành viên hợp lệ và tự động phục hồi `storeIds`.
2. **Cập nhật Lịch làm việc nguyên tử (Atomic Dot-Notation Updates)**:
   - Khi lưu lịch ca của nhân viên, hệ thống sử dụng update dạng dot-notation `shifts.${userId}` để tránh ghi đè làm mất dữ liệu của các nhân viên khác khi thao tác đồng thời.
3. **Xóa cửa hàng bảo mật 2 lớp (2-Step Store Deletion)**:
   - Bước 1: Xác thực mật khẩu bảo mật của cửa hàng.
   - Bước 2: Yêu cầu gõ chính xác tên cửa hàng hoặc từ khóa "XÓA".
   - Thực hiện soft-delete (`status: 'deleted'`) và tự động dọn dẹp liên kết `storeIds` cho toàn bộ thành viên.

---

## 8. HƯỚNG DẪN DÀNH CHO AI & LẬP TRÌNH VIÊN TIẾP NHẬN

### Khi thực hiện chỉnh sửa hoặc thêm tính năng mới:
1. **Kiểm tra phân quyền (RBAC)**: Luôn sử dụng các hàm chuẩn hóa trong `lib/types.ts` trên Web (`normalizeRole`, `canManageSchedule`, `canApproveMembers`) hoặc `lib/core/auth/app_permissions.dart` trên Mobile.
2. **Đồng bộ song phương (Mobile & Web)**: Bất kỳ thay đổi nào liên quan đến cấu trúc dữ liệu Firestore (Schema), thứ tự sắp xếp (`memberOrder`), đơn vị checklist hay logic tính lương phải được triển khai đồng thời trên cả **Flutter Mobile App** (`cham_cong_tram`) và **Next.js Web Dashboard** (`cham_cong_web`).
3. **Quy tắc xuất Excel**: Mọi bảng xuất dữ liệu liên quan đến nhân viên phải luôn sắp xếp qua `sortMembersByOrder(members, store.memberOrder)`.
4. **Kiểm thử trước khi deploy**:
   - Mobile: Chạy `flutter test` (đảm bảo vượt qua toàn bộ test suites) và `flutter analyze` (0 errors).
   - Web: Chạy `npm run build` tại `cham_cong_web` để đảm bảo biên dịch TypeScript và Next.js thành công 100%.

---
*Tài liệu được cập nhật tự động và đồng bộ định kỳ theo tiến trình phát triển hệ thống Chấm Công Trạm.*
