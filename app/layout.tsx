import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
});

export const metadata: Metadata = {
  title: 'Chấm Công Trạm - Quản lý',
  description: 'Hệ thống quản lý chấm công và ca làm việc cho chủ cửa hàng và nhân viên',
  icons: {
    icon: [
      { url: '/icon.png?v=3', type: 'image/png' },
      { url: '/favicon.ico?v=3' },
    ],
    shortcut: '/icon.png?v=3',
    apple: '/apple-icon.png?v=3',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Chấm Công Trạm',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#7E2930',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <head>
        <link rel="icon" type="image/png" sizes="256x256" href="/icon.png?v=3" />
        <link rel="icon" href="/favicon.ico?v=3" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.png?v=3" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={beVietnamPro.className}>{children}</body>
    </html>
  );
}

