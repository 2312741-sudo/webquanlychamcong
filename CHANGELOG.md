# 📋 NHẬT KÝ THAY ĐỔI CHI TIẾT (CHANGELOG)

**Dự án:** Chấm Công Trạm (`cham_cong_tram` Mobile App & `cham_cong_web` Web Dashboard)  
**Tác giả:** Nguyễn Thanh Tâm ([nthanhtam.402@gmail.com](mailto:nthanhtam.402@gmail.com))  
**Phiên bản hiện tại:** `v1.1.9` (Mobile: `1.1.9+29`, Web: `1.1.9`)

---

## 📅 NGÀY 25/10/2026: NEO CÔNG VIỆC THEO CA QUA ĐÊM, GIAO VIỆC ĐA BỘ PHẬN & LẶP THEO THỨ (v1.1.9)

### 1. [TÍNH NĂNG MỚI] Neo Công Việc Theo Ca Làm Việc Đang Mở (Overnight Shift Task Support)
- **Giải quyết triệt để vấn đề ca qua đêm:** Khắc phục lỗi công việc tự động reset sang ngày hôm sau khi đồng hồ điểm qua 12h đêm (00:00).
- **Cơ chế neo ca trực:** Hệ thống tự động kiểm tra ca chấm công đang mở (`activeAttendance` có `checkOut == null`). Danh sách công việc của ca đêm được giữ nguyên vẹn cho đến khi nhân sự thực hiện **Ra ca (Out ca)**.
- **Nhận diện trực quan:** Thẻ công việc hiển thị rõ ràng nhãn `🌙 Ca hiện tại (dd/MM) • Qua đêm` cùng banner thông báo trạng thái ca trực.
- **Nút điều hướng thông minh:** Bổ sung nút `⚡ Về ca hiện tại (dd/MM)` giúp nhân sự quay trở lại danh sách việc của ca đang làm chỉ với 1 chạm sau khi duyệt xem ngày khác.
- **Báo cáo đồng bộ:** Màn hình `TaskReportScreen` tự động gắn kết quả và hình ảnh minh chứng vào đúng ngày của ca làm việc đang mở.

### 2. [TÍNH NĂNG MỚI] Giao Việc Cho Nhiều Bộ Phận Cùng Lúc (Multi-Department Assignment)
- **Hỗ trợ chọn đa bộ phận:** Phân hệ tạo/sửa công việc cho phép chọn cùng lúc nhiều bộ phận (`targetDepartmentIds`). Nhân sự thuộc bất kỳ bộ phận nào trong danh sách đều tự động nhận đúng việc.
- **Đồng bộ đa nền tảng:** Áp dụng trên cả ứng dụng Flutter và Web Next.js.

### 3. [TÍNH NĂNG MỚI] Lặp Lại Công Việc Theo Thứ Hàng Tuần (Weekly Day-of-Week Recurrence)
- **Lập lịch theo thứ linh hoạt:** Hỗ trợ thiết lập công việc lặp lại định kỳ vào các thứ mong muốn trong tuần (`repeatDaysOfWeek`: T2 đến Chủ nhật).
- **Tự động áp dụng theo ngày:** Hệ thống tự động so khớp thứ của ngày làm việc với cấu hình lặp mà không cần tạo lặp thủ công.

### 4. [BẢO MẬT & LUỒNG ĐIỀU HƯỚNG] Vào Thẳng Màn Hình Đăng Nhập & Đăng Xuất Toàn Diện (Guideline 2.1)
- **Khởi động an toàn:** Sửa luồng khởi động app khi chưa đăng nhập (`authUser == null`) vào thẳng 100% `LoginScreen`, hiển thị sẵn trường Email và Mật khẩu.
- **Khóa Router:** `publicScreens` chỉ cho phép `login` và `register`. Ngăn chặn việc lọt vào màn hình tham gia cửa hàng khi chưa đăng nhập.
- **Đăng xuất mọi nơi:** Bổ sung nút Đăng xuất trên toàn bộ các màn hình onboarding (`welcome`, `joinStore`, `createStore`, `pendingApproval`).

### 5. [THIẾT KẾ & ĐỒNG BỘ NỀN TẢNG] (Guideline 4 - Design)
- **Nút đăng nhập Apple & Google:** Chuẩn hóa kiểu dáng, typography và artwork theo Apple Human Interface Guidelines.
- **Web Portal:** Nâng cấp tab Việc của tôi tự động neo theo ca mở, thêm banner ca qua đêm và đồng bộ giao việc đa bộ phận.
- **Kiểm thử tự động:** 33/33 Unit tests tự động đạt 100% PASS. `dart analyze` sạch 0 lỗi. Web Next.js biên dịch hoàn tất 21/21 static pages.

---

## 📅 NGÀY 19/10/2026: CHỈNH SỬA VIỆC ĐÃ GIAO, PHÂN VIỆC THEO CA ĐỘNG & TỐI ƯU TRẢI NGHIỆM (v1.1.8)

### 1. [TÍNH NĂNG MỚI] Chỉnh Sửa Công Việc Đã Giao (Edit Assigned Tasks)
- Cho phép Quản lý và Chủ quán cập nhật linh hoạt tiêu đề, mô tả, danh sách ngày, đối tượng nhận việc, yêu cầu chụp ảnh và chế độ lặp mà không cần xóa tạo lại.

### 2. [TÍNH NĂNG MỚI] Phân Việc Theo Ca Làm Việc Động (Dynamic Shift-Based Tasks)
- Tích hợp sâu với lịch làm việc tuần: Tự động phân tích lịch trực thực tế của nhân sự trong ngày để giao đúng việc theo bộ phận ca trực.

### 3. [TỐI ƯU GIAO DIỆN & TRẢI NGHIỆM]
- Bố cục thẻ việc co giãn thông minh, loại bỏ hoàn toàn hiện tượng tràn viền hay che khuất nút điều hướng.
- Cơ chế chống chớp trạng thái "Đã xong" (Anti-flicker) khi chuyển ngày với xử lý bất đồng bộ đa luồng song song.

---

## 📅 NGÀY 12/10/2026: NÂNG CẤP GIAO VIỆC THEO BỘ PHẬN, CHỤP ẢNH TRỰC TIẾP & LẶP MỖI NGÀY (v1.1.7)

### 1. [TÍNH NĂNG MỚI] Giao Việc Theo Bộ Phận (Department Task Assignment)
- **Hỗ trợ phân chia theo bộ phận:** Bổ sung loại đối tượng `TaskTargetType.department`. Cấp quản lý (Chủ quán, Quản lý 1, Quản lý 2) có thể giao việc cho từng bộ phận riêng biệt (ví dụ: Pha chế, Thu ngân, Bếp, Phục vụ...).
- **Giao diện tạo việc trực quan:** Hộp thoại tạo việc hiển thị danh sách bộ phận của cửa hàng, kèm thống kê số lượng nhân sự trực thuộc và avatar đại diện.
- **Tự động nhận việc chính xác:** Khi nhân viên vào ca, hệ thống tự động kiểm tra `userDepartment` và lọc đúng các nhiệm vụ được giao cho bộ phận của nhân viên đó.
- **Hiển thị huy hiệu:** Gắn badge `🏢 Bộ phận: [Tên bộ phận]` trên thẻ công việc ngoài ca, màn hình chi tiết và danh sách quản lý.

### 2. [BẢO MẬT & MINH CHỨNG] Khóa Chọn Từ Thư Viện, Bắt Buộc Chụp Ảnh Trực Tiếp (Camera-Only Verification)
- **Khóa hoàn toàn thư viện:** Gỡ bỏ nút chọn ảnh từ album/thư viện (`ImageSource.gallery`) khi nộp báo cáo hoàn thành công việc.
- **Xác thực thời gian thực:** Bắt buộc chụp ảnh trực tiếp từ camera (`ImageSource.camera`) tại thời điểm hoàn thành để đảm bảo tính trung thực và ngăn chặn sử dụng ảnh cũ.
- **Banner cảnh báo bảo mật:** Bổ sung thanh thông báo xác thực cam kết minh chứng rõ ràng trên cả Mobile App và Web Portal.

### 3. [TÍNH NĂNG MỚI] Chế Độ Công Việc Lặp Mỗi Ngày (Daily Recurring Tasks)
- **Switch 1 chạm "Lặp mỗi ngày":** Cho phép tạo các công việc lặp lại định kỳ mỗi ngày (`repeatDaily: true`).
- **Tự động lập lịch 60 ngày:** Khi bật lặp mỗi ngày, hệ thống tự động sinh 60 ngày liên tục vào `executionDates` để duy trì tương thích 100% với truy vấn `arrayContains` của Firestore và logic kiểm tra hoàn thành khi ra ca.
- **Tối ưu hiển thị:** Thẻ công việc hiển thị gọn gàng nhãn `🔁 Lặp mỗi ngày` / `Lịch thực hiện: 🔁 Tự động lặp lại mỗi ngày` thay vì dàn trải danh sách ngày.

### 4. [ĐỒNG BỘ WEB DASHBOARD]
- Đồng bộ toàn diện trên Web Next.js (`cham_cong_web`):
  - Form tạo việc bổ sung tùy chọn radio "Theo bộ phận" & dropdown danh sách bộ phận.
  - Switch bật/tắt "Lặp mỗi ngày" tự động lập lịch.
  - Form báo cáo bổ sung thuộc tính `capture="environment"` mở trực tiếp camera.
  - Trang `/dashboard/tasks` và modal báo cáo lọc nhân viên theo bộ phận chuẩn xác.

### 5. [KIỂM THỬ TỰ ĐỘNG & ĐỘ ỔN ĐỊNH]
- **Flutter:** Bổ sung test Group 6 (Department matching) và Group 7 (repeatDaily recurrence). Toàn bộ **22/22 tests PASS 100%**, `dart analyze` sạch 0 lỗi.
- **Web Next.js:** `npm run build` biên dịch thành công 100% toàn bộ static routes, không có lỗi TypeScript (`npx tsc --noEmit`).

---

## 📅 NGÀY 11/10/2026: NÂNG CẤP RA CA LINH HOẠT & ĐIỀU HƯỚNG CÔNG VIỆC THÔNG MINH (v1.1.6)

### 1. [TỐI ƯU TRẢI NGHIỆM] Cơ Chế Ra Ca Không Bị Chặn (Non-blocking Check-out)
- **Bỏ cơ chế ép buộc:** Thay thế việc bắt buộc phải làm xong toàn bộ việc được giao mới được out ca. Nhân sự có thể ra ca bình thường bất cứ lúc nào.
- **Bảng nhắc việc 1 chạm:** Khi bấm Chấm ra, nếu còn việc chưa hoàn thành, app hiển thị modal nhắc việc lịch sự kèm tóm tắt thời gian ca làm việc và nút **"Xác nhận ra ca (Hoàn thành sau)"** để out ca tức thì.
- **Tùy chọn hoàn thành tại chỗ:** Nếu muốn nộp báo cáo trước khi về, nhân viên có thể bấm "Báo cáo" ngay trên từng thẻ công việc.

### 2. [TÍNH NĂNG MỚI] Thanh Điều Hướng Ngày Thông Minh Trên Dashboard (`ShiftTasksCard`)
- **Chuyển ngày linh hoạt:** Thêm nút `<` (ngày trước / hôm qua) và `>` (ngày sau / ngày mai) giúp nhân viên nhanh chóng xem lại các công việc được giao của những ngày trước.
- **Lịch chọn ngày tùy ý:** Dropdown lịch cho phép mở và chọn bất kỳ ngày nào trong quá khứ hoặc tương lai.
- **Nút tiện ích "Về hôm nay":** Nhanh chóng quay trở lại ngày hiện tại chỉ với một chạm.
- **Báo cáo bù mọi lúc:** Nhân viên có thể nộp báo cáo, đính kèm ảnh minh chứng và bấm "Hoàn thành công việc" vào bất kỳ thời điểm nào (kể cả sau ca, tại nhà hoặc hôm sau).

### 3. [SỬA LỖI GIAO DIỆN & PHÍM]
- **Khắc phục lỗi đè chữ trên thẻ việc:** Sắp xếp phân cấp dọc giữa tiêu đề, thông tin người giao (có text-overflow ellipsis) và nhãn "Cần ảnh chụp", loại bỏ hoàn toàn hiện tượng tràn chữ đè lên nút "Báo cáo".
- **Khắc phục lỗi không ẩn được bàn phím:** Triển khai `GestureDetector` toàn cục tại gốc ứng dụng và thuộc tính cuộn ẩn phím `keyboardDismissBehavior: onDrag` trên toàn bộ các màn hình nhập liệu.

### 4. [ĐỒNG BỘ WEB DASHBOARD]
- Cập nhật trang `/dashboard/checkin` trên Web với modal cảnh báo đi kèm nút "Xác nhận ra ca (Hoàn thành sau)", đồng bộ tính năng không chặn ra ca và tab "Việc của tôi trong ca" tại `/dashboard/tasks`.

---

## 📅 NGÀY 09/10/2026: NÂNG CẤP HỆ THỐNG GIAO VIỆC & BÁO CÁO CÔNG VIỆC TRONG CA (v1.1.5)

### 1. [TÍNH NĂNG MỚI] Giao Việc & Lập Lịch Ngày Linh Hoạt (Task Assignment)
- **Phân quyền giao việc:** Chủ cửa hàng (`owner`), Quản lý 1 (`manager1`) và Quản lý 2 (`manager2`) có toàn quyền tạo và giao việc.
- **Đối tượng nhận việc:**
  - Hỗ trợ giao cho **Toàn bộ cửa hàng** (`allStore`) hoặc **Chỉ định danh sách cá nhân / nhóm** cụ thể.
  - Cả Chủ, QL1, QL2 và Nhân viên đều có thể nhận việc và nộp báo cáo.
- **Lập lịch ngày tùy ý:**
  - Cho phép chọn nhiều ngày trong tương lai (Hôm nay, Ngày mai, CN, T2, T3, T4, T5, T6, T7 hoặc DatePicker tùy chọn).
  - Tự động hiển thị và nhắc nhở công việc khi đến đúng ngày làm việc.

### 2. [TÍNH NĂNG MỚI] Báo Cáo Tiến Độ & Minh Chứng Hình Ảnh Trong Ca (Task Reporting)
- **Soạn thảo báo cáo tự do:** Nhân sự có thể nhập văn bản báo cáo tiến độ, kết quả công việc mọi lúc trong ca (không phải checklist cứng nhắc).
- **Đính kèm hình ảnh minh chứng:**
  - Hỗ trợ chụp trực tiếp từ Camera hoặc chọn từ Thư viện ảnh.
  - Tự động upload lên Firebase Storage với đường dẫn phân cấp: `stores/{storeId}/task_reports/{date}/{taskId}/{userId}_{timestamp}.jpg`.
  - Hỗ trợ xem ảnh phóng to toàn màn hình (InteractiveViewer / Lightbox).
- **Lưu nháp & Hoàn thành tức thì:**
  - Cho phép lưu nháp nhiều lần trong suốt ca làm việc.
  - Nhân sự chỉ cần bấm **"Hoàn thành công việc"** là được ghi nhận ngay lập tức mà không cần chờ duyệt.
  - Tự động kiểm tra điều kiện bắt buộc chụp ảnh nếu công việc có cờ `requirePhoto`.

### 3. [TÍNH NĂNG MỚI] Cổng Ràng Buộc Ra Ca (Checkout Gatekeeper)
- **Kiểm soát trước khi out ca:** Khi người dùng bấm nút **"Chấm ra / Kết thúc ca"**, hệ thống tự động quét toàn bộ các công việc được giao trong ngày của nhân sự đó qua hàm `getUnfinishedTasksForUserOnDate`.
- **Chặn ra ca khi còn việc dở dang:** Nếu còn việc chưa hoàn thành, hệ thống chặn không cho out ca và hiển thị thông báo/modal cảnh báo chi tiết kèm danh sách việc cần hoàn thành và phím tắt làm việc nhanh.
- **Mở khóa tức thì:** Ngay sau khi hoàn thành công việc cuối cùng, cổng chặn tự động mở để nhân viên tiếp tục quy trình ra ca bình thường.

### 4. [TỐI ƯU HIỆU NĂNG] Đồng Bộ Dữ Liệu Thời Gian Thực (Real-time Reactivity)
- **Khắc phục triệt để lỗi Box công việc không cập nhật:**
  - Chuyển đổi `todayUserTasksProvider` và `unfinishedUserTasksProvider` từ `FutureProvider.family` sang `StreamProvider.family` lắng nghe trực tiếp snapshot Firestore.
  - Hộp công việc trên Dashboard của mọi vai trò cập nhật ngay tức thì khi có việc mới được giao mà không cần thoát app ra vào lại.

### 5. [ĐỒNG BỘ WEB] Triển Khai Toàn Diện Trên Web Dashboard (Next.js)
- Xây dựng trang `/dashboard/tasks` trên Web Dashboard:
  - Tab 1: **"Giao việc & Quản lý"** dành cho Chủ và Quản lý với đầy đủ bộ lọc theo ngày, trạng thái, tạo việc mới và xem chi tiết báo cáo của từng nhân sự kèm ảnh phóng to.
  - Tab 2: **"Việc của tôi trong ca"** dành cho tất cả các vai trò để nhập báo cáo, tải ảnh và bấm hoàn thành công việc.
- Tích hợp cổng chặn ra ca tại `/dashboard/checkin` trên Web.

### 6. [BẢO MẬT & KIỂM THỬ]
- Bổ sung Section 4.8 trong `firestore.rules` và quy tắc lưu trữ trong `storage.rules`, triển khai an toàn lên Firebase production.
- Đạt **171/171 Flutter unit tests passed**, `dart analyze` không có cảnh báo.
- Biên dịch Next.js thành công 100% với 21/21 static routes được tối ưu hóa.

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
