import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Yêu Cầu Xóa Tài Khoản & Dữ Liệu | Chấm Công Trạm',
  description: 'Hướng dẫn quy trình xóa tài khoản và xóa dữ liệu người dùng ứng dụng Chấm Công Trạm',
};

export default function AccountDeletionPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10">
        <div className="border-b border-slate-100 pb-6 mb-6">
          <Link href="/privacy-policy" className="text-xs text-red-600 font-semibold hover:underline">
            ← Quay lại Chính sách quyền riêng tư
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-3">
            Quy Trình & Hướng Dẫn Xóa Dữ Liệu Tài Khoản
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ứng dụng <strong>Chấm Công Trạm</strong> tuân thủ quy chuẩn bảo mật của Apple App Store & Google Play Console.
          </p>
        </div>

        <div className="space-y-6 text-sm sm:text-base text-slate-700 leading-relaxed">
          <p>
            Người dùng ứng dụng <strong>Chấm Công Trạm</strong> có quyền yêu cầu xóa toàn bộ thông tin cá nhân và dữ liệu liên quan đến tài khoản của mình bất cứ lúc nào.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3">
              Cách 1: Tự xóa tài khoản trực tiếp trong ứng dụng di động (Tức thì)
            </h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>Mở ứng dụng <strong>Chấm Công Trạm</strong> trên điện thoại và đăng nhập tài khoản của bạn.</li>
              <li>Tại thanh điều hướng dưới cùng, chọn tab <strong>Hồ sơ</strong> (Profile) hoặc <strong>Cài đặt</strong>.</li>
              <li>Chọn mục <strong>Quản lý tài khoản</strong> ➔ <strong>Xóa tài khoản</strong>.</li>
              <li>Đọc kỹ cảnh báo xác nhận và bấm <strong>Xác nhận xóa tài khoản</strong>.</li>
              <li>Hệ thống sẽ lập tức xóa thông tin xác thực Firebase Auth và toàn bộ hồ sơ của bạn trên máy chủ.</li>
            </ol>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-3">
              Cách 2: Gửi yêu cầu hỗ trợ xóa qua Email
            </h2>
            <p className="text-sm mb-3">
              Nếu bạn không còn cài ứng dụng hoặc gặp khó khăn khi đăng nhập, vui lòng gửi email yêu cầu xóa dữ liệu đến:
            </p>
            <div className="bg-white border border-slate-200 p-4 rounded-lg text-sm space-y-1">
              <p>• <strong>Địa chỉ email tiếp nhận:</strong> <a href="mailto:nthanhtam.402@gmail.com" className="text-red-600 font-semibold">nthanhtam.402@gmail.com</a></p>
              <p>• <strong>Tiêu đề:</strong> Yêu cầu xóa tài khoản Chấm Công Trạm</p>
              <p>• <strong>Nội dung:</strong> Cung cấp địa chỉ email hoặc số điện thoại đã đăng ký tài khoản cần xóa.</p>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Chúng tôi sẽ tiến hành xác minh và hoàn tất xóa dữ liệu trong vòng tối đa 48 giờ làm việc kể từ khi nhận được yêu cầu.
            </p>
          </div>

          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-2">
              Dữ liệu nào sẽ được xử lý khi xóa?
            </h2>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>Dữ liệu bị xóa vĩnh viễn:</strong> Thông tin tài khoản, tên, email, ảnh đại diện, số điện thoại và token thiết bị liên kết.</li>
              <li><strong>Dữ liệu lưu trữ nội bộ theo quy định:</strong> Các bản ghi lịch sử chấm công đã phát sinh trước đó có thể được bảo lưu trong hồ sơ kế toán của cửa hàng theo quy định quản trị lao động của doanh nghiệp nhưng sẽ không còn liên kết với tài khoản cá nhân của bạn.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
