# Trạm Mở Két — mở két tiền KiotViet qua máy in KV804

Phần mềm nhỏ chạy nền trên **laptop Windows** đang cắm máy in hóa đơn **KV804** (USB).
Két tiền cắm vào máy in (cổng DK / dây điện thoại).

## Cách mở két (mã dùng 1 lần)
- **Quản lý 1**: bấm **Mở két** (web trên laptop hoặc app cùng wifi) → chọn lý do → **Gửi yêu cầu cho Chủ**.
  Chủ nhận thông báo, mở app / web thấy **mã 6 số** → gửi cho quản lý → quản lý nhập mã → két bật.
- **Chủ**: bấm **Mở két** → chọn lý do → két bật ngay (không cần nhập mã).
- Mỗi mã chỉ mở **1 lần**, hết hạn sau **15 phút**; sai 5 lần thì mã bị hủy. Mọi lần mở đều ghi nhật ký.
- Mã được tạo từ **khóa bí mật chỉ Chủ và laptop biết** — laptop tự kiểm tra mã, quản lý không tự mở được.

## Cài đặt (một lần)
1. Cài driver máy in KV804 như bình thường, in thử được là được.
2. Tải `TramMoKet.zip` (web Chấm Công → **Két tiền** → *Tải phần mềm*), giải nén.
3. Bấm đúp **`CaiDat.bat`** → đồng ý quyền Admin. Trình duyệt mở `http://localhost:8787/status`,
   thấy `"ok":true` là chạy rồi. Phần mềm tự chạy lại mỗi lần bật máy.
4. **CHỦ** đăng nhập web Chấm Công **trên chính laptop đó** → **Két tiền** → **Ghép nối với laptop này**
   (làm ngay sau khi cài — lần ghép nối đầu tiên nhận khóa bí mật của Chủ), chọn đúng máy in, bấm **Mở két** để thử.

## Lỗi thường gặp
| Hiện tượng | Cách xử lý |
|---|---|
| Web báo không thấy phần mềm | Laptop chưa chạy phần mềm: chạy lại `CaiDat.bat` |
| App báo không kết nối được laptop | Điện thoại khác wifi với laptop / laptop tắt / IP laptop đổi → Chủ ghép nối lại trên web. Nên đặt IP cố định cho laptop trong router |
| Báo mở rồi nhưng két không bật | Chọn đúng máy in trong Két tiền; thử đổi **chân két** (chân 2 ↔ chân 5) |
| Báo "khóa bí mật đã được giao" khi Chủ ghép nối | Có người đã ghép nối trước: chạy `GoCaiDat.bat` rồi `CaiDat.bat` lại, Chủ ghép nối ngay |

Cấu hình: `%ProgramData%\TramMoKet\config.json` (chứa khóa bí mật — không chia sẻ) — Nhật ký: `%ProgramData%\TramMoKet\log.txt`.
Gỡ: chạy `GoCaiDat.bat`.

## Kỹ thuật
- Cổng `8787` (tường lửa chỉ mở cho mạng nội bộ). Lệnh mở két ESC/POS `ESC p m 25 250` gửi RAW qua driver máy in.
- `POST /open`: header `X-Drawer-Token` + body `{ nonce: "<mã yêu cầu>.<thời điểm ms>", otp, by, source }`,
  `otp` = 6 số từ HMAC-SHA256(khóa bí mật, nonce) (4 byte đầu, bỏ bit dấu, chia dư 1.000.000).
- `GET /pair` (chỉ từ chính laptop, chỉ web Chấm Công): khóa bí mật chỉ trả lần đầu (header `X-Claim: 1`)
  hoặc khi gửi kèm `X-Owner-Secret` đúng.
