import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chấm Công Trạm - Quản lý',
  description: 'Hệ thống quản lý chấm công cho chủ cửa hàng',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
