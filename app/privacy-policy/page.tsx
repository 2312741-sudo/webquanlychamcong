import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Chính Sách Quyền Riêng Tư | Chấm Công Trạm',
  description: 'Chính sách bảo mật và quyền riêng tư của ứng dụng Chấm Công Trạm',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10">
        {/* Header */}
        <div className="border-b border-slate-100 pb-8 mb-8 text-center">
          <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full uppercase tracking-wider mb-3">
            Chính Sách Bảo Mật & An Toàn Dữ Liệu
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Chính Sách Quyền Riêng Tư
          </h1>
          <p className="text-sm text-slate-500">
            Ứng dụng <strong>Chấm Công Trạm</strong> • Cập nhật lần cuối: 11/09/2026
          </p>
        </div>

        {/* Intro */}
        <div className="prose prose-slate max-w-none space-y-6 text-slate-700 leading-relaxed text-sm sm:text-base">
          <p>
            Chào mừng bạn đến với ứng dụng <strong>Chấm Công Trạm</strong>. Chúng tôi tôn trọng quyền riêng tư và cam kết bảo vệ dữ liệu cá nhân của mọi người dùng (chủ cửa hàng, quản lý và nhân viên). Chính sách Quyền Riêng Tư này giải thích minh bạch cách chúng tôi thu thập, sử dụng, lưu trữ và bảo mật thông tin khi bạn sử dụng ứng dụng di động cũng như hệ thống quản lý web của chúng tôi.
          </p>

          {/* Section 1 */}
          <div className="bg-slate-50 border-l-4 border-red-600 p-4 rounded-r-lg">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
              1. Thông Tin và Dữ Liệu Chúng Tôi Thu Thập
            </h2>
            <p className="mb-3">Để phục vụ công tác quản lý ca kíp và chấm công chuẩn xác, ứng dụng thu thập các thông tin sau:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Thông tin cá nhân:</strong> Họ và tên, địa chỉ email, số điện thoại, ảnh đại diện (avatar), chức vụ và bộ phận làm việc tại từng cửa hàng.
              </li>
              <li>
                <strong>Quyền Vị trí (GPS):</strong> Ứng dụng chỉ yêu cầu quyền vị trí khi bạn bấm thao tác <em>Chấm công vào ca (Check-in)</em> hoặc <em>Ra ca (Check-out)</em> nhằm đối soát tọa độ thực tế với phạm vi bán kính cho phép của cửa hàng. Chúng tôi <strong>tuyệt đối không theo dõi vị trí nền (No continuous background tracking)</strong> khi bạn không chấm công.
              </li>
              <li>
                <strong>Thông tin Kết nối Wi-Fi (SSID & BSSID):</strong> Ứng dụng đọc thông tin tên Wi-Fi (SSID) và địa chỉ MAC điểm truy cập (BSSID) tại thời điểm chấm công để xác thực bạn đang kết nối đúng mạng Wi-Fi nội bộ của nơi làm việc.
              </li>
              <li>
                <strong>Quyền Máy ảnh (Camera):</strong> Chỉ dùng khi bạn kích hoạt tính năng quét mã QR để chấm công hoặc quét mã QR tham gia cửa hàng. Ứng dụng không tự ý chụp ảnh hay quay phim khi chưa có sự cho phép trực tiếp.
              </li>
              <li>
                <strong>Mã định danh thiết bị & Thông báo (FCM Token):</strong> Nhận diện thiết bị để gửi thông báo đẩy (Push Notification) về lịch ca làm, đơn duyệt ca và thông báo khẩn từ quản lý.
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
              2. Mục Đích Sử Dụng Thông Tin
            </h2>
            <p className="mb-2">Thông tin được thu thập chỉ phục vụ các mục đích chính đáng sau:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Xác thực danh tính và ghi nhận thời gian làm việc minh bạch của nhân viên.</li>
              <li>Hỗ trợ chủ cửa hàng/quản lý tính toán tổng giờ công, ngày công và lập bảng lương chính xác.</li>
              <li>Thông báo lịch làm việc, nhắc ca và gửi cập nhật vận hành nội bộ.</li>
              <li>Đảm bảo tính trung thực, phòng ngừa gian lận chấm công từ xa.</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
              3. Cơ Chế Bảo Mật & Lưu Trữ Dữ Liệu
            </h2>
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-900 mb-3">
              <p className="font-semibold mb-1">✓ Mã hóa toàn bộ dữ liệu khi truyền tải (SSL/TLS)</p>
              <p className="text-sm">
                Mọi dữ liệu trao đổi giữa ứng dụng và máy chủ đều được mã hóa bằng giao thức HTTPS/TLS tiêu chuẩn quốc tế. Cơ sở dữ liệu được lưu trữ an toàn trên nền tảng đám mây Google Cloud Platform (Firebase) với hệ thống tường lửa và bảo mật đa tầng.
              </p>
            </div>
            <p className="font-medium text-slate-800">
              Cam kết bảo mật: Chúng tôi <strong>không bao giờ bán, cho thuê, thương mại hóa hay chia sẻ</strong> dữ liệu cá nhân của người dùng cho bất kỳ bên thứ ba nào vì mục đích quảng cáo hoặc tiếp thị.
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
              4. Quyền Của Người Dùng & Cơ Chế Xóa Dữ Liệu (Account Deletion)
            </h2>
            <p className="mb-2">Bạn có toàn quyền kiểm soát dữ liệu cá nhân của mình:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Xem và chỉnh sửa:</strong> Bạn có thể kiểm tra và cập nhật thông tin cá nhân, ảnh đại diện bất cứ lúc nào trong mục <em>Hồ sơ của tôi</em>.
              </li>
              <li>
                <strong>Xóa tài khoản vĩnh viễn:</strong> Người dùng có thể tự xóa tài khoản vĩnh viễn ngay trong ứng dụng bất cứ lúc nào tại đường dẫn:  
                <span className="block mt-1 p-2 bg-slate-100 rounded text-slate-800 font-mono text-xs sm:text-sm">
                  Cài đặt / Hồ sơ của tôi ➔ Quản lý tài khoản ➔ Xóa tài khoản vĩnh viễn
                </span>
                Khi xác nhận xóa, tài khoản Firebase Authentication, hồ sơ cá nhân và các phiên đăng nhập sẽ bị xóa hoàn toàn khỏi hệ thống máy chủ.
              </li>
              <li>
                <strong>Yêu cầu xóa dữ liệu thủ công:</strong> Nếu gặp sự cố hoặc không thể truy cập ứng dụng, bạn có thể gửi yêu cầu xóa dữ liệu qua email hỗ trợ của chúng tôi bên dưới. Chúng tôi sẽ xử lý yêu cầu trong vòng 48 giờ làm việc.
              </li>
            </ul>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
              5. Quyền Riêng Tư Trẻ Em
            </h2>
            <p>
              Ứng dụng Chấm Công Trạm được thiết kế dành cho người lao động, doanh nghiệp và các chuỗi bán lẻ. Chúng tôi không cố ý thu thập bất kỳ thông tin nào từ trẻ em dưới 13 tuổi.
            </p>
          </div>

          {/* Section 6 */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3">
              6. Thay Đổi Chính Sách Quyền Riêng Tư
            </h2>
            <p>
              Chúng tôi có thể cập nhật nội dung Chính Sách Quyền Riêng Tư theo định kỳ để phản ánh các cải tiến sản phẩm và yêu cầu pháp lý. Mọi thay đổi sẽ được công bố trực tiếp tại trang web này kèm ngày tháng cập nhật mới nhất.
            </p>
          </div>

          {/* Section 7: Contact */}
          <div className="bg-red-50 border border-red-200 p-5 rounded-2xl mt-8">
            <h3 className="text-lg font-bold text-red-900 mb-2">
              7. Thông Tin Liên Hệ & Đơn Vị Quản Lý (Contact & Support)
            </h3>
            <p className="text-slate-700 text-sm mb-3">
              Nếu bạn có bất kỳ câu hỏi, thắc mắc hoặc cần hỗ trợ liên quan đến Quyền riêng tư & An toàn dữ liệu, xin vui lòng liên hệ trực tiếp với chúng tôi:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500 block">Đơn vị phát triển / Đại diện:</span>
                <strong className="text-slate-900">Nguyễn Thanh Tâm</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Ứng dụng:</span>
                <strong className="text-slate-900">Chấm Công Trạm</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Email hỗ trợ:</span>
                <a href="mailto:nthanhtam.402@gmail.com" className="text-red-600 font-semibold hover:underline">
                  nthanhtam.402@gmail.com
                </a>
              </div>
              <div>
                <span className="text-slate-500 block">Hotline:</span>
                <a href="tel:0865062205" className="text-red-600 font-semibold hover:underline">
                  0865 062 205
                </a>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block">Website chính thức:</span>
                <a href="https://webquanlychamcong.vercel.app" target="_blank" rel="noreferrer" className="text-red-600 font-semibold hover:underline">
                  https://webquanlychamcong.vercel.app
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© 2026 Chấm Công Trạm. Tất cả các quyền được bảo lưu.</p>
          <div className="mt-3 sm:mt-0 space-x-4">
            <Link href="/login" className="hover:text-red-600 underline">
              Cổng Quản Lý Web
            </Link>
            <Link href="/account-deletion" className="hover:text-red-600 underline">
              Hướng dẫn xóa dữ liệu
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
