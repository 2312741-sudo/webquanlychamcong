const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, UnderlineType, ShadingType
} = require('docx');

// Colors
const PRIMARY_COLOR = 'C8102E'; // Brand Red
const SECONDARY_COLOR = '1A6B5A'; // Green
const DARK_COLOR = '1A1A1A';
const LIGHT_BG = 'F8F4EE';
const ACCENT_COLOR = '1C4E6B'; // Blue
const BORDER_COLOR = 'D3D3D3';

function createTitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 36, // 18pt
        color: PRIMARY_COLOR,
        font: 'Arial',
      }),
    ],
  });
}

function createSubtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 360 },
    children: [
      new TextRun({
        text,
        italics: true,
        size: 24, // 12pt
        color: '666666',
        font: 'Arial',
      }),
    ],
  });
}

function createHeading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28, // 14pt
        color: PRIMARY_COLOR,
        font: 'Arial',
      }),
    ],
  });
}

function createHeading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24, // 12pt
        color: ACCENT_COLOR,
        font: 'Arial',
      }),
    ],
  });
}

function createHeading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22, // 11pt
        color: DARK_COLOR,
        font: 'Arial',
      }),
    ],
  });
}

function createParagraph(text, options = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276 },
    children: [
      new TextRun({
        text,
        size: 22, // 11pt
        font: 'Arial',
        color: options.color || DARK_COLOR,
        bold: options.bold || false,
        italics: options.italics || false,
      }),
    ],
  });
}

function createBullet(text, boldPrefix = '') {
  const children = [];
  if (boldPrefix) {
    children.push(new TextRun({
      text: boldPrefix + ' ',
      bold: true,
      size: 22,
      font: 'Arial',
      color: DARK_COLOR,
    }));
  }
  children.push(new TextRun({
    text,
    size: 22,
    font: 'Arial',
    color: DARK_COLOR,
  }));

  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40, line: 260 },
    children,
  });
}

function createCallout(title, content, type = 'info') {
  const bgColor = type === 'warning' ? 'FFF3CD' : type === 'success' ? 'E8F5E9' : 'F0F4FF';
  const textColor = type === 'warning' ? '856404' : type === 'success' ? '1A6B5A' : '1C4E6B';
  const borderColor = type === 'warning' ? 'FFEBAA' : type === 'success' ? 'C8E6C9' : 'D0EBFF';

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.SOLID, fill: bgColor },
            margins: { top: 140, bottom: 140, left: 180, right: 180 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
              left: { style: BorderStyle.SINGLE, size: 18, color: textColor },
              right: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
            },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    size: 22,
                    color: textColor,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: content,
                    size: 20,
                    color: textColor,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: 'Arial',
          size: 22,
          color: DARK_COLOR,
        },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
            bottom: 1440,
            left: 1440,
            right: 1440,
          },
        },
      },
      children: [
        // Title & Header
        createTitle('SỔ TAY HƯỚNG DẪN SỬ DỤNG'),
        createTitle('HỆ THỐNG CHẤM CÔNG TRẠM'),
        createSubtitle('Dành cho Chủ Cửa Hàng (Owner), Quản Lý (Manager) và Nhân Viên (Employee)\nÁp dụng trên cả Ứng dụng Mobile App và Bảng điều khiển Web Dashboard'),

        createCallout(
          '📌 THÔNG TIN HỆ THỐNG',
          '• Tên ứng dụng Mobile: Chấm Công Trạm (iOS & Android)\n• Địa chỉ Web Dashboard: https://webquanlychamcong.vercel.app\n• Cơ chế dữ liệu: Đồng bộ thời gian thực 100% qua Google Firebase Cloud Firestore.',
          'info'
        ),

        new Paragraph({ spacing: { before: 180, after: 180 } }),

        // PHẦN 1
        createHeading1('PHẦN 1: TỔNG QUAN VÀ PHÂN QUYỀN HỆ THỐNG'),
        createParagraph('Hệ thống Chấm Công Trạm được thiết kế chuyên biệt để quản lý nhân sự, chấm công thông minh qua WiFi/GPS, xếp lịch làm việc, tính lương tự động và đo lường năng suất sản xuất theo thời gian thực.'),

        createHeading2('1.1. Bảng phân quyền tài khoản:'),
        createBullet('Có toàn quyền cao nhất trên cả App Mobile và Web Dashboard. Được tạo cửa hàng, cấu hình WiFi (tối đa 10 điểm), tạo ca làm việc, phân bộ phận (Sản xuất, Bán hàng...), xếp lịch làm, duyệt/xóa nhân viên, cấu hình lương, quản lý checklist sản xuất, chỉnh sửa giờ công, tạm ứng lương và xuất các báo cáo Excel chuẩn.', '👑 Chủ Cửa Hàng (Owner):'),
        createBullet('Được xem danh sách nhân viên, hỗ trợ theo dõi chấm công, tham gia đăng ký lịch làm việc và truy cập tab Lịch làm việc trên Web Dashboard để xếp lịch cho đội nhóm.', '👔 Quản Lý (Manager):'),
        createBullet('Sử dụng App Mobile để chấm công vào/ra (Check-in / Check-out), hoàn thành checklist sản xuất khi out ca, đăng ký lịch làm việc tuần, theo dõi chi tiết bảng công và dự tính tiền lương cá nhân.', '👤 Nhân Viên (Employee):'),

        new Paragraph({ spacing: { before: 180, after: 180 } }),

        // PHẦN 2
        createHeading1('PHẦN 2: HƯỚNG DẪN DÀNH CHO CHỦ CỬA HÀNG (OWNER)'),
        createParagraph('Chủ cửa hàng có thể quản trị toàn diện qua cả Web Dashboard máy tính lẫn Ứng dụng điện thoại.'),

        createHeading2('2.1. Đăng ký và Khởi tạo Cửa hàng mới'),
        createBullet('Tải và mở ứng dụng Chấm Công Trạm, chọn "Đăng ký" tài khoản mới bằng Email và Mật khẩu.', 'Bước 1:'),
        createBullet('Tại màn hình chào mừng, chọn "Tạo cửa hàng mới".', 'Bước 2:'),
        createBullet('Điền Tên cửa hàng, Địa chỉ, Bán kính cho phép (mặc định 100m) và ấn nút lấy Vị trí GPS hiện tại hoặc nhập IP WiFi.', 'Bước 3:'),
        createBullet('Hệ thống tự động cấp một Mã cửa hàng (gồm 6 ký tự viết hoa) và Mã QR. Nhân viên sẽ dùng mã này để tham gia.', 'Bước 4:'),

        createHeading2('2.2. Cấu hình WiFi Chấm công (Tối đa 10 điểm WiFi)'),
        createParagraph('Hệ thống cho phép cấu hình tối đa 10 địa chỉ WiFi/IP để nhân viên có thể chấm công linh hoạt tại nhiều điểm bán hoặc nhiều tầng/khu vực:'),
        createBullet('Đăng nhập vào Web Dashboard hoặc mở mục "Cài đặt" trên App.', 'Trên Web & App:'),
        createBullet('Tại phần "Danh sách WiFi Chấm Công", bấm nút "+ Thêm WiFi".', 'Thêm mới:'),
        createBullet('Nhập Tên gợi nhớ (VD: Tầng 1, Tầng 2, Kho hàng) và Địa chỉ IP của mạng WiFi.', 'Điền thông tin:'),
        createBullet('Bấm "Lưu cài đặt". Nhân viên chỉ cần kết nối vào một trong các WiFi này là có thể chấm công hợp lệ.', 'Lưu lại:'),

        createHeading2('2.3. Thiết lập Ca làm việc, Bộ phận & Phụ cấp'),
        createBullet('Vào mục Cài đặt -> Danh sách ca làm việc. Bấm "Thêm ca" để định nghĩa các ca làm (VD: Ca sáng 06:00 - 14:00, Ca chiều 14:00 - 22:00, Ca tối 22:00 - 06:00).', 'Cấu hình Ca:'),
        createBullet('Thêm các bộ phận như Sản xuất (viết tắt SX), Bán hàng, Thu ngân. Nhân viên thuộc ca có gắn bộ phận SX sẽ tự động được kích hoạt kiểm tra checklist khi out ca.', 'Cấu hình Bộ phận:'),
        createBullet('Điền mức phụ cấp Chở hàng và Giao hàng (vnđ/ca) để hệ thống tự động cộng dồn vào bảng lương khi nhân viên được xếp lịch chở/giao hàng.', 'Phụ cấp Chở/Giao hàng:'),

        createHeading2('2.4. Quản lý Nhân viên & Cấu hình Lương'),
        createBullet('Vào tab "Nhân viên". Các yêu cầu xin vào cửa hàng mới sẽ hiển thị tại mục "Chờ duyệt". Bấm "Duyệt" để kích hoạt nhân viên.', 'Duyệt thành viên:'),
        createBullet('Chọn từng nhân viên -> Chọn loại hình lương: Toàn thời gian (Full-time: nhập lương tháng và giờ chuẩn ví dụ 208h) hoặc Bán thời gian (Part-time: nhập đơn giá tiền/giờ).', 'Cài đặt mức lương:'),
        createBullet('Có thể nâng quyền thành viên lên "Quản lý" hoặc giáng cấp về "Nhân viên" bất kỳ lúc nào.', 'Phân quyền Quản lý:'),

        createHeading2('2.5. Xếp lịch làm việc tuần & Xuất Excel Lịch làm'),
        createBullet('Truy cập tab "Lịch làm việc". Chọn tuần cần phân ca.', 'Bước 1:'),
        createBullet('Nhấp vào từng ô ngày của nhân viên -> Tích chọn ca làm việc tương ứng -> Chọn bộ phận hoặc tích chọn "Chở hàng / Giao hàng" nếu có.', 'Bước 2:'),
        createBullet('Bấm nút "💾 Lưu lịch" để lưu lên hệ thống (nhân viên sẽ thấy lịch ngay trên điện thoại).', 'Bước 3:'),
        createBullet('Bấm "📥 Xuất Excel" để tải file lịch làm việc chuẩn gồm 4 cột chi tiết/ngày (Giờ vào, Giờ ra, Tên ca/Bộ phận in đậm, Số giờ làm) và cột Tổng giờ trong tuần.', 'Bước 4:'),

        createHeading2('2.6. Quản lý Checklist & Đo lường Hiệu quả Sản xuất (Mới)'),
        createCallout(
          '✨ TÍNH NĂNG MỚI: ĐƠN VỊ ĐO LƯỜNG TÙY CHỈNH & TÙY CHỌN',
          'Chủ cửa hàng có thể bật/tắt đơn vị đo lường linh hoạt cho từng đầu việc. Đơn vị có thể chọn từ mẫu (Kg, Phút, Sản phẩm, Ca, Gói, Thùng, Ly, Hộp...) hoặc tự do nhập bất kỳ tên đơn vị nào theo nhu cầu thực tế.',
          'success'
        ),
        createBullet('Truy cập tab "Sản xuất" trên Web Dashboard -> Chọn "📋 Quản lý công việc".', 'Quản lý đầu việc:'),
        createBullet('Bấm "+ Thêm công việc". Điền tên công việc.', 'Thêm công việc:'),
        createBullet('Nếu cần đo lường số lượng: Tích bật "Yêu cầu nhập số lượng khi out ca" và chọn/gõ đơn vị đo (VD: Kg, Gói, Thùng, Ly...). Nếu chỉ cần tích hoàn thành: Bỏ tích để tạo Checklist thuần túy.', 'Cấu hình đo lường:'),
        createBullet('Chuyển sang tab "📊 Báo cáo sản xuất" để xem toàn bộ lịch sử gửi báo cáo của nhân sự khi out ca theo từng tháng, kèm nút "⬇️ Xuất Excel" tổng hợp.', 'Xem báo cáo:'),

        createHeading2('2.7. Quản lý Bảng chấm công & Chỉnh sửa công'),
        createBullet('Xem bảng công tổng hợp toàn bộ nhân viên theo từng ngày trong tháng.', 'Theo dõi:'),
        createBullet('Nếu nhân viên quên chấm công hoặc vào muộn có lý do chính đáng: Chủ nhấp vào ô ngày của nhân viên đó -> Sửa lại giờ vào/giờ ra thực tế -> Điền lý do chỉnh sửa -> Bấm Lưu.', 'Sửa giờ công:'),
        createBullet('Bấm "📥 Xuất Excel" để xuất Bảng công tổng hợp (kiểu số Numeric) hoặc Chi tiết Vào/Ra.', 'Xuất dữ liệu:'),

        createHeading2('2.8. Quản lý Bảng Lương, Tạm Ứng & Xuất Báo Cáo Lương'),
        createBullet('Truy cập tab "Bảng lương". Hệ thống tự động tính: Lương cơ bản theo giờ thực tế + Phụ cấp chở/giao hàng - Tiền tạm ứng = Lương thực lĩnh.', 'Tính lương tự động:'),
        createBullet('Bấm "Tạm ứng" để ghi nhận các khoản nhân viên đã ứng trước trong tháng.', 'Quản lý tạm ứng:'),
        createBullet('Bấm "📥 Xuất Excel" để tải file Bảng thanh toán lương chi tiết, hỗ trợ lọc theo cả cửa hàng hoặc riêng từng nhân viên.', 'Xuất báo cáo lương:'),

        new Paragraph({ spacing: { before: 180, after: 180 } }),

        // PHẦN 3
        createHeading1('PHẦN 3: HƯỚNG DẪN DÀNH CHO QUẢN LÝ (MANAGER)'),
        createParagraph('Quản lý là cánh tay đắc lực của Chủ cửa hàng, được cấp quyền quản lý đội nhóm trên App và truy cập tab Lịch làm việc trên Web Dashboard.'),

        createHeading2('3.1. Truy cập & Giám sát trên App Mobile'),
        createBullet('Quản lý thấy toàn bộ danh sách nhân sự đang trong ca làm việc hôm nay, thời gian vào ca và trạng thái thực tế.', 'Màn hình Dashboard:'),
        createBullet('Hỗ trợ nhắc nhở nhân viên chấm công đúng giờ và kiểm tra checklist sản xuất trước khi ra ca.', 'Giám sát:'),

        createHeading2('3.2. Quản lý & Xếp lịch làm việc trên Web Dashboard'),
        createBullet('Quản lý đăng nhập vào Web Dashboard -> Hệ thống tự động chuyển thẳng vào giao diện "Lịch làm việc tuần".', 'Truy cập Web:'),
        createBullet('Quản lý có thể xem lịch, phân ca làm cho từng nhân viên, tích chọn chở/giao hàng và bấm "Lưu lịch" để thông báo cho nhân viên.', 'Phân ca:'),
        createBullet('Bấm "Xuất Excel" để in hoặc chia sẻ lịch làm việc tuần cho toàn bộ nhóm.', 'Xuất lịch:'),

        new Paragraph({ spacing: { before: 180, after: 180 } }),

        // PHẦN 4
        createHeading1('PHẦN 4: HƯỚNG DẪN DÀNH CHO NHÂN VIÊN (EMPLOYEE)'),
        createParagraph('Nhân viên sử dụng ứng dụng di động "Chấm Công Trạm" trên điện thoại iOS hoặc Android để thực hiện toàn bộ nghiệp vụ hàng ngày.'),

        createHeading2('4.1. Cài đặt App & Tham gia Cửa hàng'),
        createBullet('Tải và cài đặt ứng dụng "Chấm Công Trạm" từ cửa hàng ứng dụng.', 'Bước 1:'),
        createBullet('Đăng ký tài khoản mới bằng Email và Mật khẩu, cập nhật Họ và tên chính xác.', 'Bước 2:'),
        createBullet('Tại màn hình chính, chọn "Tham gia cửa hàng" -> Nhập Mã 6 ký tự do Chủ cung cấp (HOẶC bấm "Quét mã QR" để quét trực tiếp mã từ máy của Chủ).', 'Bước 3:'),
        createBullet('Ứng dụng chuyển sang trạng thái "Chờ xét duyệt". Khi Chủ duyệt, bạn sẽ tự động vào màn hình làm việc.', 'Bước 4:'),

        createHeading2('4.2. Đăng ký Lịch làm việc Hàng tuần'),
        createBullet('Mở mục "Lịch làm" ở thanh điều hướng dưới cùng.', 'Bước 1:'),
        createBullet('Chọn tuần làm việc tiếp theo.', 'Bước 2:'),
        createBullet('Chọn ca làm việc mong muốn cho từng ngày trong tuần (Ca sáng, Ca chiều, Ca tối hoặc Nghỉ). Nếu có nguyện vọng Chở hàng/Giao hàng, hãy tích chọn tương ứng.', 'Bước 3:'),
        createBullet('Bấm "Lưu đăng ký" trước hạn chót của cửa hàng.', 'Bước 4:'),

        createHeading2('4.3. Thao tác Chấm Vào (Check-in) Đầu Ca'),
        createBullet('Đến cửa hàng, bật WiFi và kết nối vào đúng mạng WiFi của cửa hàng (HOẶC bật Định vị GPS trên điện thoại).', 'Bước 1:'),
        createBullet('Mở ứng dụng Chấm Công Trạm -> Màn hình chính sẽ hiển thị nút tròn lớn "CHẤM VÀO" màu đỏ.', 'Bước 2:'),
        createBullet('Ứng dụng tự động kiểm tra WiFi/GPS: Thẻ WiFi hiển thị dấu tích xanh nghĩa là vị trí hợp lệ.', 'Bước 3:'),
        createBullet('Bấm nút "CHẤM VÀO" -> Hệ thống ghi nhận giờ vào ca chính xác đến từng giây và chuyển nút sang màu xanh "Đang làm việc".', 'Bước 4:'),

        createHeading2('4.4. Thao tác Chấm Ra (Check-out) & Điền Checklist Sản Xuất'),
        createBullet('Khi hết ca làm việc, mở ứng dụng và bấm nút "CHẤM RA".', 'Bước 1:'),
        createBullet('Nếu bạn thuộc ca Sản xuất (SX) và cửa hàng có cấu hình danh sách công việc, màn hình "Báo cáo sản xuất & Checklist" sẽ tự động bật lên.', 'Bước 2 (Kiểm tra Checklist):'),
        createBullet('Tích chọn các công việc bạn đã hoàn thành trong ca. Với các đầu việc có đơn vị đo (Kg, Gói, Thùng...), hãy điền số lượng tương ứng.', 'Bước 3:'),
        createBullet('Bấm nút "HOÀN TẤT & RA CA". Hệ thống sẽ lưu báo cáo sản xuất và ghi nhận thời gian chấm ra thành công.', 'Bước 4:'),

        createHeading2('4.5. Xem Lịch sử Bảng công & Dự tính Lương cá nhân'),
        createBullet('Vào mục "Lịch sử": Xem chi tiết giờ vào, giờ ra và số giờ làm của từng ngày.', 'Bảng công:'),
        createBullet('Vào mục "Lương": Theo dõi tổng số giờ đã tích lũy trong tháng, số tiền lương dự tính nhận được và các khoản tạm ứng đã nhận.', 'Bảng lương:'),

        createHeading2('4.6. Cài đặt Tài khoản & Xóa Tài khoản Vĩnh viễn'),
        createBullet('Vào mục Tài khoản để đổi tên hiển thị hoặc mật khẩu.', 'Cập nhật:'),
        createBullet('Ứng dụng hỗ trợ tính năng "Xóa tài khoản vĩnh viễn" theo chuẩn bảo mật Apple/Google. Khi bấm xóa và nhập mật khẩu xác nhận, toàn bộ dữ liệu cá nhân sẽ được xóa sạch khỏi hệ thống.', 'Quyền riêng tư:'),

        new Paragraph({ spacing: { before: 180, after: 180 } }),

        // PHẦN 5
        createHeading1('PHẦN 5: CÂU HỎI THƯỜNG GẶP & XỬ LÝ SỰ CỐ (FAQ)'),

        createHeading2('5.1. Báo lỗi "Sai mạng WiFi cửa hàng" khi chấm công?'),
        createParagraph('Khắc phục: Kiểm tra xem điện thoại đã tắt 4G/5G và bật kết nối vào đúng mạng WiFi của cửa hàng chưa. Nếu cửa hàng mới đổi mạng, hãy nhờ Chủ cửa hàng vào mục Cài đặt để thêm IP WiFi mới vào danh sách 10 điểm WiFi cho phép.'),

        createHeading2('5.2. Báo lỗi "Không ở trong phạm vi cửa hàng" khi chấm GPS?'),
        createParagraph('Khắc phục: Bật dịch vụ Vị trí (GPS) ở chế độ Độ chính xác cao, cấp quyền truy cập vị trí "Khi dùng ứng dụng" cho app Chấm Công Trạm và đứng trong bán kính cho phép của cửa hàng.'),

        createHeading2('5.3. Bấm "Chấm ra" bị chặn không cho ra ca?'),
        createParagraph('Khắc phục: Đây là tính năng kiểm soát chất lượng ca Sản xuất (SX). Nhân viên bắt buộc phải tích chọn ít nhất một công việc trong bảng Checklist sản xuất và điền số lượng hợp lệ (nếu có đơn vị) thì mới được phép ra ca.'),

        createHeading2('5.4. Làm thế nào để xuất file Excel và chia sẻ qua Zalo/Email?'),
        createParagraph('Khắc phục: Trên Web Dashboard, bấm nút "Xuất Excel" để tải file .xlsx trực tiếp về máy tính. Trên App Mobile, bấm biểu tượng Xuất Excel ở góc trên -> Chọn ứng dụng Zalo, Gmail, Drive... để chia sẻ file ngay lập tức.'),

        new Paragraph({ spacing: { before: 240, after: 120 } }),
        createCallout(
          '📞 HỖ TRỢ KỸ THUẬT',
          'Nếu gặp khó khăn trong quá trình sử dụng hoặc cần hỗ trợ cấu hình hệ thống, vui lòng liên hệ Bộ phận Kỹ thuật Quản lý Hệ thống Chấm Công Trạm.',
          'info'
        ),
      ],
    },
  ],
});

// Write document
Packer.toBuffer(doc).then(buffer => {
  const outputPath = path.join('D:\\app_cham_cong', 'HUONG_DAN_SU_DUNG_CHAM_CONG_TRAM.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('Successfully generated Word user guide at:', outputPath);
}).catch(err => {
  console.error('Error generating document:', err);
});
