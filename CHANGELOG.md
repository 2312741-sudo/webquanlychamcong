# Nhật Ký Thay Đổi (Changelog) - Web Quản Lý Chấm Công

Tất cả các thay đổi đáng chú ý của dự án **Web Quản Lý Chấm Công** (`cham_cong_web`) sẽ được ghi lại chi tiết trong tài liệu này.

---

## [1.0.3] - 22/08/2026

### 🚀 Tính Năng Mới & Nâng Cấp Vận Hành
- **Sắp xếp thứ tự nhân viên tùy chỉnh (Drag & Drop + Lên/Xuống):**
  - Hỗ trợ kéo-thả hàng hoặc bấm nút ▲ / ▼ để sắp xếp thứ tự hiển thị nhân viên trong trang **Nhân viên** (`/dashboard/members`) và trang **Lịch làm việc** (`/dashboard/schedule`).
  - Lưu và đồng bộ trực tiếp vào `stores/{storeId}.memberOrder` trên Cloud Firestore.
  - **Quy tắc phân quyền:** Chỉ có tài khoản **Chủ cửa hàng (Owner)** mới hiển thị các nút thao tác kéo/di chuyển thứ tự. Các tài khoản khác (*Quản lý 1, Quản lý 2, Nhân viên*) tự động xem danh sách theo đúng thứ tự tùy chỉnh mà Chủ quán đã lưu.
- **Dấu tick ẩn lịch nhân viên tùy chọn trong tab Lịch cửa hàng:**
  - Bổ sung cột/nút thao tác nhanh 👁️ / 🙈 và checkbox trong modal chỉnh sửa thông tin thành viên.
  - Khi nhân viên bị ẩn lịch: Chỉ Chủ cửa hàng nhìn thấy dòng lịch của nhân viên đó trên bảng lịch tuần (kèm huy hiệu 🙈 `Ẩn`). Quản lý và các nhân viên khác hoàn toàn không thấy dòng này.
  - Đồng bộ qua mảng `stores/{storeId}.hiddenScheduleUserIds`.
- **Sắp xếp danh mục Checklist sản xuất:**
  - Bổ sung cột thứ tự với các nút ▲ / ▼ và kéo-thả trên trang **Sản xuất** (`/dashboard/production`).
  - **Quy tắc phân quyền:** Chỉ Chủ cửa hàng mới thấy nút `+ Thêm công việc`, nút sửa, xóa, toggle trạng thái bật/tắt và kéo sắp xếp thứ tự checklist. Các vai trò khác chỉ xem ở chế độ Read-only.
- **Tích hợp Chấm công cho Chủ cửa hàng:**
  - Tài khoản Chủ cửa hàng được đưa đầy đủ vào bảng tính công tháng và xuất file báo cáo Excel chi tiết / tổng hợp.

### ⚡ Sửa Lỗi & Tối Ưu Hóa
- Chuẩn hóa hàm kiểm tra vai trò `normalizeRole` và phân quyền nhất quán giữa Web và Mobile.
- Tối ưu hóa build Next.js 16 (Turbopack), hoàn thành 100% không lỗi biên dịch TypeScript.

---

## [1.0.2] - 20/08/2026
- Bổ sung xác thực đăng nhập Google Sign-In & Apple Sign-In trên nền tảng Web.
- Tối ưu xuất báo cáo Excel theo nhiều ca làm và bộ phận.

---

## [1.0.1] - 16/08/2026
- Hoàn thiện giao diện Quản lý ca làm, Quản lý nhân viên, Bảng công tháng và Tính lương.
- Tích hợp Cloud Firestore Real-time listeners.
