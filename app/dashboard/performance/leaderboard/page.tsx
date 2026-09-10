// app/dashboard/performance/leaderboard/page.tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../layout';
import { watchPerformanceReports } from '@/lib/performance';
import {
  PerformanceReport,
  DEFAULT_STANDARDS,
  formatSecondsToMMSS,
  parseFirestoreTimestamp
} from '@/lib/performanceTypes';

type TimeFilter = '7days' | '30days' | 'this_month' | 'all';
type SortMetric = 'drink_speed' | 'drink_qty' | 'compliance' | 'sessions';

interface StaffStat {
  name: string;
  sessionCount: number;
  totalDrinkQty: number;
  totalDrinkSec: number;
  avgDrinkSec: number;
  totalCakeQty: number;
  totalCakeSec: number;
  avgCakeSec: number;
  compliantCount: number;
  complianceRate: number;
  incidentCount: number;
}

export default function PerformanceLeaderboardPage() {
  const { storeId, store } = useApp();
  const [reports, setReports] = useState<PerformanceReport[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30days');
  const [sortMetric, setSortMetric] = useState<SortMetric>('drink_speed');

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const unsub = watchPerformanceReports(storeId, (data) => {
      setReports(data);
      setLoading(false);
    });
    return unsub;
  }, [storeId]);

  const standards = useMemo(() => {
    return {
      drink: (store as any)?.performanceStandards?.drinkStandardSeconds || DEFAULT_STANDARDS.drinkStandardSeconds,
      cake: (store as any)?.performanceStandards?.cakeStandardSeconds || DEFAULT_STANDARDS.cakeStandardSeconds,
      order: (store as any)?.performanceStandards?.orderStandardSeconds || DEFAULT_STANDARDS.orderStandardSeconds,
    };
  }, [store]);

  // Lọc báo cáo theo thời gian
  const filteredReports = useMemo(() => {
    const now = new Date();
    return reports.filter((rep) => {
      const repDate = parseFirestoreTimestamp(rep.startedAt || rep.createdAt);
      if (timeFilter === '7days') {
        const past7 = new Date();
        past7.setDate(now.getDate() - 7);
        past7.setHours(0, 0, 0, 0);
        return repDate >= past7;
      }
      if (timeFilter === '30days') {
        const past30 = new Date();
        past30.setDate(now.getDate() - 30);
        past30.setHours(0, 0, 0, 0);
        return repDate >= past30;
      }
      if (timeFilter === 'this_month') {
        return (
          repDate.getMonth() === now.getMonth() &&
          repDate.getFullYear() === now.getFullYear()
        );
      }
      return true;
    });
  }, [reports, timeFilter]);

  // Tổng hợp dữ liệu theo từng nhân sự
  const staffStats = useMemo(() => {
    const map = new Map<string, StaffStat>();

    const getOrCreate = (name: string): StaffStat => {
      if (!map.has(name)) {
        map.set(name, {
          name,
          sessionCount: 0,
          totalDrinkQty: 0,
          totalDrinkSec: 0,
          avgDrinkSec: 0,
          totalCakeQty: 0,
          totalCakeSec: 0,
          avgCakeSec: 0,
          compliantCount: 0,
          complianceRate: 100,
          incidentCount: 0,
        });
      }
      return map.get(name)!;
    };

    filteredReports.forEach((rep) => {
      // Tập hợp tất cả nhân sự tham gia ca (Quản lý đứng ca + Nhân viên)
      const participants = new Set<string>();
      if (rep.managerOnDutyName?.trim()) participants.add(rep.managerOnDutyName.trim());
      (rep.employeeNames || []).forEach((n) => {
        if (n?.trim()) participants.add(n.trim());
      });

      const drinkOk = !rep.drinkAverageSeconds || rep.drinkAverageSeconds <= standards.drink;
      const cakeOk = !rep.cakeAverageSeconds || rep.cakeAverageSeconds <= standards.cake;
      const isCompliant = drinkOk && cakeOk;

      participants.forEach((name) => {
        const stat = getOrCreate(name);
        stat.sessionCount++;
        stat.totalDrinkQty += rep.drinkTotalQuantity || 0;
        stat.totalDrinkSec += rep.drinkTotalSeconds || 0;
        stat.totalCakeQty += rep.cakeTotalQuantity || 0;
        stat.totalCakeSec += rep.cakeTotalSeconds || 0;
        stat.incidentCount += rep.incidents?.length || 0;
        if (isCompliant) stat.compliantCount++;
      });
    });

    const list = Array.from(map.values()).map((s) => {
      const avgDrinkSec = s.totalDrinkQty > 0 ? Math.round(s.totalDrinkSec / s.totalDrinkQty) : 0;
      const avgCakeSec = s.totalCakeQty > 0 ? Math.round(s.totalCakeSec / s.totalCakeQty) : 0;
      const complianceRate = s.sessionCount > 0 ? Math.round((s.compliantCount / s.sessionCount) * 100) : 100;
      return {
        ...s,
        avgDrinkSec,
        avgCakeSec,
        complianceRate,
      };
    });

    // Sắp xếp theo chỉ số được chọn
    list.sort((a, b) => {
      if (sortMetric === 'drink_speed') {
        // Tốc độ nhanh hơn (ít giây hơn) xếp trước, nếu = 0 thì xếp sau
        if (a.avgDrinkSec === 0) return 1;
        if (b.avgDrinkSec === 0) return -1;
        return a.avgDrinkSec - b.avgDrinkSec;
      }
      if (sortMetric === 'drink_qty') {
        return b.totalDrinkQty - a.totalDrinkQty;
      }
      if (sortMetric === 'compliance') {
        return b.complianceRate - a.complianceRate;
      }
      if (sortMetric === 'sessions') {
        return b.sessionCount - a.sessionCount;
      }
      return 0;
    });

    return list;
  }, [filteredReports, standards, sortMetric]);

  const top1 = staffStats[0];
  const top2 = staffStats[1];
  const top3 = staffStats[2];

  return (
    <div>
      {/* Filters Toolbar */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Kỳ đánh giá:
          </span>
          <div style={{ display: 'inline-flex', background: 'var(--surface)', padding: 3, borderRadius: 8, gap: 2 }}>
            {[
              { id: '7days', label: '7 ngày qua' },
              { id: '30days', label: '30 ngày qua' },
              { id: 'this_month', label: 'Tháng này' },
              { id: 'all', label: 'Toàn bộ' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTimeFilter(f.id as TimeFilter)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: timeFilter === f.id ? 700 : 500,
                  background: timeFilter === f.id ? 'white' : 'transparent',
                  color: timeFilter === f.id ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: timeFilter === f.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Xếp hạng theo:</span>
          <select
            value={sortMetric}
            onChange={(e) => setSortMetric(e.target.value as SortMetric)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 12,
              fontWeight: 600,
              background: 'white',
            }}
          >
            <option value="drink_speed">Tốc độ pha Nước (Nhanh nhất)</option>
            <option value="drink_qty">Sản lượng pha chế (Nhiều nhất)</option>
            <option value="compliance">Tỷ lệ đạt chuẩn (%)</option>
            <option value="sessions">Số ca tham gia</option>
          </select>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {staffStats.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {/* Top 1 */}
          {top1 && (
            <div
              className="card"
              style={{
                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                border: '2px solid #F59E0B',
                position: 'relative',
                overflow: 'hidden',
                textAlign: 'center',
                padding: '24px 20px',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 4 }}>👑 🥇</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#B45309', letterSpacing: 1 }}>
                QUÁN QUÂN HIỆU NĂNG
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--neutral)', marginTop: 4 }}>
                {top1.name}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#B45309', marginTop: 10 }}>
                {top1.avgDrinkSec > 0 ? `${top1.avgDrinkSec}s / ly` : '--'}
              </div>
              <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
                {top1.sessionCount} ca • {top1.totalDrinkQty} ly • Đạt chuẩn {top1.complianceRate}%
              </div>
            </div>
          )}

          {/* Top 2 */}
          {top2 && (
            <div
              className="card"
              style={{
                background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
                border: '1px solid #94A3B8',
                textAlign: 'center',
                padding: '24px 20px',
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 4 }}>🥈</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: 1 }}>
                Á QUÂN 1
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--neutral)', marginTop: 4 }}>
                {top2.name}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#334155', marginTop: 10 }}>
                {top2.avgDrinkSec > 0 ? `${top2.avgDrinkSec}s / ly` : '--'}
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                {top2.sessionCount} ca • {top2.totalDrinkQty} ly • Đạt chuẩn {top2.complianceRate}%
              </div>
            </div>
          )}

          {/* Top 3 */}
          {top3 && (
            <div
              className="card"
              style={{
                background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
                border: '1px solid #FDBA74',
                textAlign: 'center',
                padding: '24px 20px',
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 4 }}>🥉</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#C2410C', letterSpacing: 1 }}>
                Á QUÂN 2
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--neutral)', marginTop: 4 }}>
                {top3.name}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#C2410C', marginTop: 10 }}>
                {top3.avgDrinkSec > 0 ? `${top3.avgDrinkSec}s / ly` : '--'}
              </div>
              <div style={{ fontSize: 12, color: '#9A3412', marginTop: 4 }}>
                {top3.sessionCount} ca • {top3.totalDrinkQty} ly • Đạt chuẩn {top3.complianceRate}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: '#FAF7F2' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral)' }}>
            Bảng Xếp Hạng Chi Tiết ({staffStats.length} nhân sự)
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 16px' }}>Hạng</th>
                <th style={{ padding: '10px 16px' }}>Nhân sự / Barista</th>
                <th style={{ padding: '10px 16px' }}>Số ca tham gia</th>
                <th style={{ padding: '10px 16px' }}>Tốc độ Nước TB</th>
                <th style={{ padding: '10px 16px' }}>Sản lượng Nước</th>
                <th style={{ padding: '10px 16px' }}>Tốc độ Bánh TB</th>
                <th style={{ padding: '10px 16px' }}>Sản lượng Bánh</th>
                <th style={{ padding: '10px 16px' }}>Tỷ lệ đạt chuẩn</th>
                <th style={{ padding: '10px 16px' }}>Sự cố liên đới</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 36, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Đang tính toán xếp hạng...
                  </td>
                </tr>
              ) : staffStats.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 36, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Chưa có dữ liệu nhân sự đo lường trong kỳ này.
                  </td>
                </tr>
              ) : (
                staffStats.map((staff, idx) => {
                  const rank = idx + 1;
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                  const isDrinkPass = staff.avgDrinkSec > 0 && staff.avgDrinkSec <= standards.drink;

                  return (
                    <tr key={staff.name} style={{ borderBottom: '1px solid var(--divider)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14 }}>
                        {medal}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--neutral)' }}>
                        {staff.name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {staff.sessionCount} ca
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: isDrinkPass ? '#1A6B5A' : '#CB2D2E' }}>
                        {staff.avgDrinkSec > 0 ? `${staff.avgDrinkSec}s (${formatSecondsToMMSS(staff.avgDrinkSec)})` : '--'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {staff.totalDrinkQty} ly
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {staff.avgCakeSec > 0 ? `${staff.avgCakeSec}s` : '--'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {staff.totalCakeQty} bánh
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 700, color: staff.complianceRate >= 85 ? '#1A6B5A' : '#C05621' }}>
                            {staff.complianceRate}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {staff.incidentCount > 0 ? (
                          <span style={{ color: '#CB2D2E', fontWeight: 600 }}>{staff.incidentCount} vụ</span>
                        ) : (
                          <span style={{ color: '#1A6B5A' }}>0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
