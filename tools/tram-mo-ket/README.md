# Trạm Mở Két — mở két tiền KiotViet qua máy in KV804

Phần mềm nhỏ chạy nền trên **laptop Windows** đang cắm máy in hóa đơn **KV804** (USB).
Két tiền cắm vào máy in (cổng DK / dây điện thoại). Quản lý bấm **Mở két** trên web Chấm Công
(trên laptop) hoặc trên **app điện thoại** (cùng wifi quán) → nhập **PIN** → két bật ra.
Mỗi lần mở được ghi nhật ký (ai, lúc nào, lý do, từ web hay app).

## Cài đặt (một lần)
1. Cài driver máy in KV804 như bình thường, in thử được là được.
2. Tải `TramMoKet.zip` (web Chấm Công → Cài đặt → Két tiền → *Tải phần mềm*), giải nén.
3. Bấm đúp **`CaiDat.bat`** → đồng ý quyền Admin. Trình duyệt mở trang `http://localhost:8787/status`,
   thấy `"ok":true` là chạy rồi. Phần mềm tự chạy lại mỗi lần bật máy.
4. Mở **web Chấm Công trên chính laptop đó** → Cài đặt → **Két tiền** → **Ghép nối với laptop này**,
   chọn đúng máy in (KV804), bấm **Thử mở két**.
5. Mỗi Chủ / Quản lý 1 đặt **PIN mở két** của mình (Cài đặt → Két tiền, hoặc ngay lần đầu bấm Mở két).

## Dùng
- Web (trên laptop): nút **Mở két** ở thanh trên cùng → nhập PIN (+ lý do).
- App: trang chủ Chủ / Quản lý → **Mở két** → nhập PIN. Điện thoại phải **cùng wifi** với laptop, laptop đang bật.

## Lỗi thường gặp
| Hiện tượng | Cách xử lý |
|---|---|
| Web báo không thấy phần mềm | Laptop chưa chạy phần mềm: chạy lại `CaiDat.bat` |
| App báo không kết nối được laptop | Điện thoại khác wifi với laptop / laptop tắt / IP laptop đổi → ghép nối lại trên web (lấy IP mới). Nên đặt IP cố định cho laptop trong router |
| Báo mở rồi nhưng két không bật | Chọn đúng máy in trong Cài đặt → Két tiền; thử đổi **chân két** (chân 2 ↔ chân 5) |
| Báo sai mã ghép nối | Ghép nối lại trên web |

Cấu hình: `%ProgramData%\TramMoKet\config.json` — Nhật ký trên laptop: `%ProgramData%\TramMoKet\log.txt`.
Gỡ: chạy `GoCaiDat.bat`.

## Kỹ thuật
- Cổng `8787` (tường lửa chỉ mở cho mạng nội bộ). Lệnh mở két ESC/POS `ESC p m 25 250` gửi RAW qua driver máy in.
- `GET /status` · `GET /pair` (chỉ từ chính laptop, chỉ web Chấm Công) · `POST /config` (như /pair) ·
  `POST /open` (header `X-Drawer-Token` = mã ghép nối).
- Mã ghép nối chỉ lưu ở laptop và `stores/{storeId}/private/cash_drawer` (Chủ / Quản lý 1 đọc được).
