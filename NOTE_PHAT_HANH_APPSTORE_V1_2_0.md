# 📱 TÀI LIỆU PHÁT HÀNH APP STORE & GOOGLE PLAY — CHẤM CÔNG TRẠM v1.2.0

> **Ứng dụng:** Chấm Công Trạm (Hệ sinh thái chấm công & quản trị nhân sự thông minh)  
> **Phiên bản (Version):** `1.2.0`  
> **Số bản dựng (Build Number):** `30`  
> **Bundle Identifier (iOS):** `com.chamcong.chamCongTram`  
> **Package Name (Android):** `com.chamcong.chamCongTram`  
> **Apple Team ID:** `W97CS7VC54`  
> **Ngày phát hành:** 30/10/2026  
> **Nền tảng hỗ trợ:** iOS, Android, Web Dashboard (Next.js)  

---

## 1. THÔNG TIN ĐIỀN TRÊN APP STORE CONNECT & GOOGLE PLAY CONSOLE

### 1.1. Số phiên bản & Bản dựng
- **Version Number:** `1.2.0`
- **Build Number:** `30`
- **Tên phiên bản phát hành:** `v1.2.0 - Phân Hệ Đặt & Soạn Hàng, Bộ Icon Lucide Đồng Bộ & Cải Tiến Giao Diện Toàn Diện`

---

### 1.2. Có gì mới trong phiên bản này? (What's New in This Version)

#### Tiếng Việt (Dành cho App Store Connect & Google Play Console):
```text
Phiên bản 1.2.0 ra mắt phân hệ Đặt & Soạn hàng thông minh cùng cải tiến toàn diện giao diện trải nghiệm:
- 📦 Phân hệ Đặt & Soạn hàng: Hỗ trợ nhân viên/quản lý đặt hàng nguyên vật liệu cho ngày mai nhanh chóng theo danh mục mặt hàng cửa hàng. Nhân sự ca làm tiếp theo dễ dàng theo dõi và tích chọn kiểm tra các món đã soạn xong ngay khi vào ca.
- ⏰ Cấu hình giờ chốt & nhắc việc tự động: Thiết lập giờ chốt đặt hàng linh hoạt theo từng cơ sở. Tự động gửi thông báo nhắc nhở ngoài ứng dụng trước giờ chốt 30 phút nếu nhân viên đang trong ca làm việc mà phiếu đặt hàng ngày mai chưa hoàn thành.
- ✨ Bộ icon Lucide vector hiện đại: Thay thế toàn bộ biểu tượng hệ thống bằng bộ icon Lucide cao cấp, loại bỏ hoàn toàn emoji thô, mang lại giao diện tinh gọn, chuyên nghiệp và đồng bộ 1:1 với Web Dashboard.
- 🎨 Tối ưu hóa thanh tiêu đề (AppBar): Chuẩn hóa chữ và icon màu trắng nổi bật trên nền màu thương hiệu tại 26 màn hình, đảm bảo tính thẩm mỹ và độ tương phản cao.
- 📱 Tối ưu màn hình hẹp: Khắc phục hiện tượng tràn chữ trên thẻ công việc và các thành phần giao diện đối với các dòng máy màn hình nhỏ.
- 🛡️ Nâng cấp an toàn & hiệu năng: 100% kiểm thử tự động (207/207 tests) vượt qua tiêu chuẩn.
```

#### English (For English Storefronts):
```text
Version 1.2.0 introduces the Supply Order & Preparation module along with comprehensive UI/UX refinements:
- 📦 Supply Order & Preparation Checklist: Easily place ingredient and supply orders for the next day directly from store categories. Incoming shift staff can track and check off prepared items in real-time.
- ⏰ Cutoff Time & Smart Push Reminder: Configurable order cutoff times per store. Automatic local reminder notifications scheduled 30 minutes before cutoff if an on-duty shift has an empty order sheet.
- ✨ Modern Lucide Vector Icons: Replaced legacy icons with sleek Lucide vector icons across all screens, ensuring a modern and cohesive design language across mobile and web.
- 🎨 Standardized AppBar Navigation: White text and icons on brand-colored headers across 26 screens for optimal contrast and accessibility.
- 📱 Responsive Layout Improvements: Fixed potential text truncation and layout constraints on narrow screen devices.
- 🛡️ Stability & Security: 100% automated test suite pass rate (207/207 tests passed).
```

---

### 1.3. Văn bản quảng bá (Promotional Text - Tối đa 170 ký tự)
```text
Chấm Công Trạm v1.2.0: Ra mắt phân hệ Đặt & Soạn hàng thông minh, nhắc việc tự động trước giờ chốt và đồng bộ bộ icon Lucide cao cấp!
```

---

### 1.4. Từ khóa tìm kiếm (Keywords - Tối đa 100 ký tự)
```text
cham cong,cham cong tram,dat hang,soan hang,nguyen vat lieu,giao viec,bang cong,tinh luong,nhan su
```

---

### 1.5. Phân loại & Giới hạn tuổi (Category & Age Rating)
- **Primary Category:** `Business` (Doanh nghiệp) hoặc `Productivity` (Năng suất)
- **Secondary Category:** `Utilities` (Tiện ích)
- **Age Rating:** `4+` (Không chứa nội dung nhạy cảm)

---

### 1.6. Thông tin liên hệ & Hỗ trợ (Support Information)
- **URL hỗ trợ (Support URL):** `https://chamcongtram.firebaseapp.com`
- **Chính sách quyền riêng tư (Privacy Policy URL):** `https://chamcongtram.firebaseapp.com/privacy`
- **Cổng Quản Trị Web (Web Portal):** `https://webquanlychamcong.vercel.app`
- **Email hỗ trợ kỹ thuật:** `nthanhtam.402@gmail.com`

---

## 2. CHI TIẾT CÁC TÍNH NĂNG NÂNG CẤP TRONG BẢN 1.2.0

| STT | Phân hệ | Tính năng / Cải tiến | Mô tả chi tiết kỹ thuật & Nghiệp vụ |
| :---: | :--- | :--- | :--- |
| **1** | **Vận hành & Nguyên vật liệu** | Đặt hàng nguyên vật liệu ngày mai (`supply_orders`) | Cho phép nhân sự trong ca chọn mặt hàng từ danh mục, nhập số lượng và gửi phiếu đặt hàng cho ngày tiếp theo. |
| **2** | **Bàn giao ca trực** | Danh sách soạn hàng khi vào ca (`prepared`) | Nhân sự ca tiếp theo nhận ca dễ dàng tra cứu phiếu đặt hàng và đánh dấu trực tiếp các món đã soạn xong theo thời gian thực. |
| **3** | **Quản lý danh mục** | Danh mục mặt hàng cửa hàng (`supply_items`) | Chủ quán và Quản lý dễ dàng cấu hình danh sách nguyên vật liệu, đơn vị tính, sắp xếp thứ tự và bật/tắt mặt hàng. |
| **4** | **Nhắc nhở thông minh** | Nhắc việc ngoài app (`SupplyReminderService`) | Tự động tính toán giờ chốt đặt hàng của cơ sở và gửi thông báo nhắc nhở trước 30 phút nếu ca trực chưa hoàn tất phiếu. |
| **5** | **Giao diện & Biểu tượng** | Bộ Icon Lucide cao cấp (`lucide_icons_flutter`) | Thay thế toàn bộ Material Icons và emoji dạng biểu tượng sang phong cách thiết kế phẳng hiện đại của Lucide. |
| **6** | **Trải nghiệm người dùng** | Đồng bộ màu sắc thanh điều hướng AppBar | Chuẩn hóa màu chữ và icon màu trắng tinh khiết trên nền màu nhận diện thương hiệu tại 26 màn hình chức năng. |
| **7** | **Bảo mật & Quyền hạn** | Ràng buộc phân quyền Firestore Rules | Phân định rõ ràng quyền tạo/sửa danh mục, đặt hàng và soạn hàng giữa Chủ quán, Quản lý và Nhân viên. |
| **8** | **Đảm bảo chất lượng** | 100% Automated Tests & Phân tích tĩnh | Hệ thống đạt **207/207 tests PASS 100%**. Dart analyze đạt chuẩn **0 error**. Web Portal biên dịch 24/24 trang thành công. |

---

## 3. THÔNG TIN PHỤC VỤ APPLE & GOOGLE REVIEW

- **Tài khoản kiểm thử (Demo Account):**
  - **Tài khoản Chủ quán (Owner):** `demo_owner@tramchanh.vn` / `123456`
  - **Tài khoản Quản lý 1 (Manager 1):** `demo_ql1@tramchanh.vn` / `123456`
  - **Tài khoản Quản lý 2 (Manager 2):** `demo_ql2@tramchanh.vn` / `123456`
  - **Tài khoản Nhân viên (Staff):** `demo_nv@tramchanh.vn` / `123456`
  - **Mã cửa hàng Demo:** `TCDEMO` (TRẠM CHANH DEMO)
