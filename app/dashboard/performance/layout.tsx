// app/dashboard/performance/layout.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '../layout';
export { useApp };
import { normalizeRole } from '@/lib/types';
import { watchPerformanceReports } from '@/lib/performance';
import { PerformanceReport } from '@/lib/performanceTypes';

const TABS = [
  { href: '/dashboard/performance', label: 'Tổng quan', icon: '📊', exact: true },
  { href: '/dashboard/performance/reports', label: 'Báo cáo ca', icon: '📋', exact: false },
  { href: '/dashboard/performance/leaderboard', label: 'Bảng xếp hạng', icon: '🏆', exact: false },
  { href: '/dashboard/performance/settings', label: 'Tiêu chuẩn & Dữ liệu', icon: '⚙️', exact: false },
];

export default function PerformanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user, store, storeId } = useApp();
  const isOwner = user?.uid === store?.ownerId || normalizeRole(role) === 'owner';

  const [unviewedCount, setUnviewedCount] = useState(0);

  useEffect(() => {
    if (!storeId) return;
    const unsub = watchPerformanceReports(storeId, (reports: PerformanceReport[]) => {
      const count = reports.filter((r) => r.status === 'submitted').length;
      setUnviewedCount(count);
    });
    return unsub;
  }, [storeId]);

  if (!isOwner) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div className="card" style={{ maxWidth: 480, margin: '60px auto', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--neutral)' }}>
            Khu vực dành riêng cho Chủ cửa hàng
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
            Phân hệ Quản lý & Đo Hiệu Năng chỉ khả dụng cho tài khoản có quyền Chủ (Owner).
          </p>
          <button
            onClick={() => router.push('/dashboard/schedule')}
            className="btn btn-primary"
            style={{ margin: '0 auto' }}
          >
            Quay lại Lịch làm việc
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>⚡</span>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>
                Đo Hiệu Năng Vận Hành
              </h1>
              <span
                style={{
                  background: '#FDF3E3',
                  color: '#C05621',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 12,
                  border: '1px solid #FEEBC8',
                }}
              >
                Chủ cửa hàng
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Giám sát tốc độ pha chế Nước, Bánh, Đơn hàng, tỷ lệ đạt chuẩn và xử lý báo cáo ca.
            </p>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 20,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 0,
            overflowX: 'auto',
          }}
        >
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const isReportTab = tab.href === '/dashboard/performance/reports';
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderBottom: active ? '3px solid var(--primary)' : '3px solid transparent',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 16 }}>{tab.icon}</span>
                {tab.label}
                {isReportTab && unviewedCount > 0 && (
                  <span
                    style={{
                      background: 'var(--primary)',
                      color: 'white',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 10,
                      marginLeft: 2,
                    }}
                  >
                    {unviewedCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {children}
    </div>
  );
}
