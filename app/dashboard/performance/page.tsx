// app/dashboard/performance/page.tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '../layout';
import { watchPerformanceReports } from '@/lib/performance';
import {
  PerformanceReport,
  DEFAULT_STANDARDS,
  formatSecondsToMMSS,
  parseFirestoreTimestamp
} from '@/lib/performanceTypes';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

type TimePreset = 'today' | '7days' | '30days' | 'this_month' | 'custom';

export default function PerformanceOverviewPage() {
  const { storeId, store } = useApp();
  const [reports, setReports] = useState<PerformanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Filters
  const [timePreset, setTimePreset] = useState<TimePreset>('7days');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lắng nghe dữ liệu báo cáo
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    const unsub = watchPerformanceReports(storeId, (data) => {
      setReports(data);
      setLoading(false);
    });
    return unsub;
  }, [storeId]);

  // Tiêu chuẩn áp dụng (lấy từ store hoặc mặc định)
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

      if (timePreset === 'today') {
        return (
          repDate.getDate() === now.getDate() &&
          repDate.getMonth() === now.getMonth() &&
          repDate.getFullYear() === now.getFullYear()
        );
      }
      if (timePreset === '7days') {
        const past7 = new Date();
        past7.setDate(now.getDate() - 7);
        past7.setHours(0, 0, 0, 0);
        return repDate >= past7;
      }
      if (timePreset === '30days') {
        const past30 = new Date();
        past30.setDate(now.getDate() - 30);
        past30.setHours(0, 0, 0, 0);
        return repDate >= past30;
      }
      if (timePreset === 'this_month') {
        return (
          repDate.getMonth() === now.getMonth() &&
          repDate.getFullYear() === now.getFullYear()
        );
      }
      if (timePreset === 'custom') {
        const s = new Date(customStartDate + 'T00:00:00');
        const e = new Date(customEndDate + 'T23:59:59');
        return repDate >= s && repDate <= e;
      }
      return true;
    });
  }, [reports, timePreset, customStartDate, customEndDate]);

  // Tổng hợp KPIs
  const stats = useMemo(() => {
    let totalDrinkSec = 0;
    let totalDrinkQty = 0;
    let totalDrinkCount = 0;

    let totalCakeSec = 0;
    let totalCakeQty = 0;
    let totalCakeCount = 0;

    let totalOrderSec = 0;
    let totalOrderCount = 0;

    let totalIncidents = 0;
    let compliantSessions = 0;

    filteredReports.forEach((rep) => {
      totalDrinkSec += rep.drinkTotalSeconds || 0;
      totalDrinkQty += rep.drinkTotalQuantity || 0;
      totalDrinkCount += rep.drinkMeasurementCount || 0;

      totalCakeSec += rep.cakeTotalSeconds || 0;
      totalCakeQty += rep.cakeTotalQuantity || 0;
      totalCakeCount += rep.cakeMeasurementCount || 0;

      totalOrderSec += rep.orderTotalSeconds || 0;
      totalOrderCount += rep.orderCount || 0;

      totalIncidents += rep.incidents?.length || 0;

      // Ca đạt chuẩn nếu TB nước và bánh <= chuẩn
      const drinkOk = !rep.drinkAverageSeconds || rep.drinkAverageSeconds <= standards.drink;
      const cakeOk = !rep.cakeAverageSeconds || rep.cakeAverageSeconds <= standards.cake;
      const orderOk = !rep.orderAverageSeconds || rep.orderAverageSeconds <= standards.order;
      if (drinkOk && cakeOk && orderOk) compliantSessions++;
    });

    const avgDrinkSec = totalDrinkQty > 0 ? Math.round(totalDrinkSec / totalDrinkQty) : 0;
    const avgCakeSec = totalCakeQty > 0 ? Math.round(totalCakeSec / totalCakeQty) : 0;
    const avgOrderSec = totalOrderCount > 0 ? Math.round(totalOrderSec / totalOrderCount) : 0;

    const complianceRate = filteredReports.length > 0 ? Math.round((compliantSessions / filteredReports.length) * 100) : 100;

    return {
      avgDrinkSec,
      totalDrinkQty,
      totalDrinkCount,
      avgCakeSec,
      totalCakeQty,
      totalCakeCount,
      avgOrderSec,
      totalOrderCount,
      totalIncidents,
      complianceRate,
      sessionCount: filteredReports.length,
    };
  }, [filteredReports, standards]);

  // Dữ liệu biểu đồ theo ngày (Recharts)
  const chartData = useMemo(() => {
    const map = new Map<string, {
      dateStr: string;
      drinkAvg: number;
      drinkQty: number;
      cakeAvg: number;
      cakeQty: number;
      orderAvg: number;
      orderQty: number;
      incidentCount: number;
      sessions: number;
      rawDrinkSec: number;
      rawDrinkQty: number;
      rawCakeSec: number;
      rawCakeQty: number;
      rawOrderSec: number;
      rawOrderCount: number;
    }>();

    // Sắp xếp báo cáo từ cũ đến mới để vẽ biểu đồ
    const sorted = [...filteredReports].reverse();

    sorted.forEach((rep) => {
      const d = parseFirestoreTimestamp(rep.startedAt || rep.createdAt);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;

      if (!map.has(key)) {
        map.set(key, {
          dateStr: key,
          drinkAvg: 0,
          drinkQty: 0,
          cakeAvg: 0,
          cakeQty: 0,
          orderAvg: 0,
          orderQty: 0,
          incidentCount: 0,
          sessions: 0,
          rawDrinkSec: 0,
          rawDrinkQty: 0,
          rawCakeSec: 0,
          rawCakeQty: 0,
          rawOrderSec: 0,
          rawOrderCount: 0,
        });
      }

      const cur = map.get(key)!;
      cur.sessions++;
      cur.rawDrinkSec += rep.drinkTotalSeconds || 0;
      cur.rawDrinkQty += rep.drinkTotalQuantity || 0;
      cur.rawCakeSec += rep.cakeTotalSeconds || 0;
      cur.rawCakeQty += rep.cakeTotalQuantity || 0;
      cur.rawOrderSec += rep.orderTotalSeconds || 0;
      cur.rawOrderCount += rep.orderCount || 0;
      cur.incidentCount += rep.incidents?.length || 0;
    });

    return Array.from(map.values()).map((v) => ({
      date: v.dateStr,
      'TB Làm nước (s)': v.rawDrinkQty > 0 ? Math.round(v.rawDrinkSec / v.rawDrinkQty) : null,
      'TB Nướng bánh (s)': v.rawCakeQty > 0 ? Math.round(v.rawCakeSec / v.rawCakeQty) : null,
      'TB SOS Đơn (s)': v.rawOrderCount > 0 ? Math.round(v.rawOrderSec / v.rawOrderCount) : null,
      'Số ly Làm nước': v.rawDrinkQty,
      'Số Nướng bánh': v.rawCakeQty,
      'Số SOS Đơn': v.rawOrderCount,
      'Sự cố': v.incidentCount,
    }));
  }, [filteredReports]);

  // Danh sách các ca cần chú ý (vượt chuẩn hoặc có sự cố)
  const attentionSessions = useMemo(() => {
    return filteredReports.filter((r) => {
      const hasInc = (r.incidents?.length || 0) > 0;
      const slowDrink = r.drinkAverageSeconds > standards.drink;
      const slowCake = r.cakeAverageSeconds > standards.cake;
      const slowOrder = r.orderAverageSeconds > standards.order;
      return hasInc || slowDrink || slowCake || slowOrder;
    }).slice(0, 5);
  }, [filteredReports, standards]);

  // Tổng hợp so sánh từng ngày trong tuần (Trạm vận hành 1 ca/ngày)
  const dailyComparison = useMemo(() => {
    const dayMap = new Map<string, {
      dayKey: string;
      dayOfWeek: string;
      dateFormatted: string;
      fullDate: string;
      managerNames: Set<string>;
      drinkSec: number;
      drinkQty: number;
      cakeSec: number;
      cakeQty: number;
      orderSec: number;
      orderCount: number;
      incidents: number;
      sessionCount: number;
    }>();

    filteredReports.forEach((rep) => {
      const d = parseFirestoreTimestamp(rep.startedAt || rep.createdAt);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayOfWeek = dayNames[d.getDay()];
      const dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const fullDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, {
          dayKey,
          dayOfWeek,
          dateFormatted,
          fullDate,
          managerNames: new Set<string>(),
          drinkSec: 0,
          drinkQty: 0,
          cakeSec: 0,
          cakeQty: 0,
          orderSec: 0,
          orderCount: 0,
          incidents: 0,
          sessionCount: 0,
        });
      }

      const cur = dayMap.get(dayKey)!;
      cur.sessionCount++;
      const mgr = rep.managerOnDutyName || rep.managerName;
      if (mgr) cur.managerNames.add(mgr);
      cur.drinkSec += rep.drinkTotalSeconds || 0;
      cur.drinkQty += rep.drinkTotalQuantity || 0;
      cur.cakeSec += rep.cakeTotalSeconds || 0;
      cur.cakeQty += rep.cakeTotalQuantity || 0;
      cur.orderSec += rep.orderTotalSeconds || 0;
      cur.orderCount += rep.orderCount || 0;
      cur.incidents += rep.incidents?.length || 0;
    });

    const list = Array.from(dayMap.values()).sort((a, b) => b.dayKey.localeCompare(a.dayKey));

    return list.map((item) => {
      const drinkAvg = item.drinkQty > 0 ? Math.round(item.drinkSec / item.drinkQty) : 0;
      const cakeAvg = item.cakeQty > 0 ? Math.round(item.cakeSec / item.cakeQty) : 0;
      const orderAvg = item.orderCount > 0 ? Math.round(item.orderSec / item.orderCount) : 0;

      let tested = 0;
      let passed = 0;
      if (item.drinkQty > 0) {
        tested++;
        if (drinkAvg <= standards.drink) passed++;
      }
      if (item.cakeQty > 0) {
        tested++;
        if (cakeAvg <= standards.cake) passed++;
      }
      if (item.orderCount > 0) {
        tested++;
        if (orderAvg <= standards.order) passed++;
      }
      const complianceRate = tested > 0 ? Math.round((passed / tested) * 100) : 100;

      let rating = '✅ Đạt chuẩn';
      let ratingBg = '#E6F4EA';
      let ratingColor = '#137333';
      if (complianceRate === 100 && item.incidents === 0) {
        rating = '🌟 Xuất sắc';
        ratingBg = '#DEF7EC';
        ratingColor = '#03543F';
      } else if (complianceRate < 70 || item.incidents >= 2) {
        rating = '⚠️ Cần cải thiện';
        ratingBg = '#FDE8E8';
        ratingColor = '#9B1C1C';
      } else if (complianceRate < 100 || item.incidents > 0) {
        rating = '⚡ Khá tốt';
        ratingBg = '#FEF3C7';
        ratingColor = '#92400E';
      }

      return {
        ...item,
        drinkAvg,
        cakeAvg,
        orderAvg,
        complianceRate,
        rating,
        ratingBg,
        ratingColor,
        managers: Array.from(item.managerNames).join(', ') || 'Chưa phân công',
        totalVolume: item.drinkQty + item.cakeQty + item.orderCount,
      };
    });
  }, [filteredReports, standards]);

  // Thẻ nổi bật theo ngày
  const dayHighlights = useMemo(() => {
    if (dailyComparison.length === 0) return null;

    const bestDay = [...dailyComparison].sort((a, b) => {
      if (b.complianceRate !== a.complianceRate) return b.complianceRate - a.complianceRate;
      if (a.incidents !== b.incidents) return a.incidents - b.incidents;
      return b.totalVolume - a.totalVolume;
    })[0];

    const peakDay = [...dailyComparison].sort((a, b) => b.totalVolume - a.totalVolume)[0];

    const attentionDay = [...dailyComparison].sort((a, b) => {
      if (b.incidents !== a.incidents) return b.incidents - a.incidents;
      return a.complianceRate - b.complianceRate;
    })[0];

    return { bestDay, peakDay, attentionDay };
  }, [dailyComparison]);

  return (
    <div>
      {/* Filter Toolbar */}
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
            Thời gian:
          </span>
          <div style={{ display: 'inline-flex', background: 'var(--surface)', padding: 3, borderRadius: 8, gap: 2 }}>
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: '7days', label: '7 ngày qua' },
              { id: '30days', label: '30 ngày' },
              { id: 'this_month', label: 'Tháng này' },
              { id: 'custom', label: 'Tùy chọn' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setTimePreset(p.id as TimePreset)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: timePreset === p.id ? 700 : 500,
                  background: timePreset === p.id ? 'white' : 'transparent',
                  color: timePreset === p.id ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: timePreset === p.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {timePreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>đến</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
              />
            </div>
          )}
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Cửa hàng: <strong style={{ color: 'var(--neutral)' }}>{store?.name || 'Tất cả'}</strong> • Tổng <strong style={{ color: 'var(--primary)' }}>{filteredReports.length}</strong> ca đo
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* NƯỚC */}
        <div className="card" style={{ borderLeft: '4px solid #0284C7', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>🥤 LÀM NƯỚC</span>
            <span style={{ fontSize: 11, background: '#E0F2FE', color: '#0369A1', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              Chuẩn: {standards.drink}s
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0284C7' }}>
            {stats.avgDrinkSec > 0 ? `${stats.avgDrinkSec}s` : '--'}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 6 }}>
              ({formatSecondsToMMSS(stats.avgDrinkSec)}/ly)
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            Tổng: <strong style={{ color: 'var(--neutral)' }}>{stats.totalDrinkQty} ly</strong> ({stats.totalDrinkCount} lần đo)
          </div>
        </div>

        {/* BÁNH */}
        <div className="card" style={{ borderLeft: '4px solid #D97706', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>🍰 NƯỚNG BÁNH</span>
            <span style={{ fontSize: 11, background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              Chuẩn: {standards.cake}s
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#D97706' }}>
            {stats.avgCakeSec > 0 ? `${stats.avgCakeSec}s` : '--'}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 6 }}>
              ({formatSecondsToMMSS(stats.avgCakeSec)}/bánh)
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            Tổng: <strong style={{ color: 'var(--neutral)' }}>{stats.totalCakeQty} bánh</strong> ({stats.totalCakeCount} lần đo)
          </div>
        </div>

        {/* ĐƠN HÀNG */}
        <div className="card" style={{ borderLeft: '4px solid #1C4E6B', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>📦 SOS ĐƠN HÀNG</span>
            <span style={{ fontSize: 11, background: '#E3EEF5', color: '#1C4E6B', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              Chuẩn: {standards.order}s
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1C4E6B' }}>
            {stats.avgOrderSec > 0 ? `${stats.avgOrderSec}s` : '--'}
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 6 }}>
              ({formatSecondsToMMSS(stats.avgOrderSec)}/đơn)
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            Tổng: <strong style={{ color: 'var(--neutral)' }}>{stats.totalOrderCount} đơn hàng</strong>
          </div>
        </div>

        {/* TỶ LỆ ĐẠT CHUẨN */}
        <div className="card" style={{ borderLeft: '4px solid #1A6B5A', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>🎯 ĐẠT TIÊU CHUẨN</span>
            <span style={{ fontSize: 11, background: '#E6F2EF', color: '#1A6B5A', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              Mục tiêu &ge; 85%
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: stats.complianceRate >= 85 ? '#1A6B5A' : '#C05621' }}>
            {stats.complianceRate}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            {stats.complianceRate >= 85 ? '✅ Đạt mục tiêu vận hành' : '⚠️ Cần đôn đốc cải thiện tốc độ'}
          </div>
        </div>

        {/* SỰ CỐ */}
        <div className="card" style={{ borderLeft: '4px solid #CB2D2E', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>⚠️ SỰ CỐ PHÁT SINH</span>
            <span style={{ fontSize: 11, background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              Trong ca
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: stats.totalIncidents > 0 ? '#CB2D2E' : '#1A6B5A' }}>
            {stats.totalIncidents}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
            {stats.totalIncidents === 0 ? 'Vận hành trơn tru, không có sự cố' : `${stats.totalIncidents} sự cố được ghi nhận`}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Biểu đồ xu hướng thời gian */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral)' }}>
                Xu Hướng Thời Gian Xử Lý (Giây)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                So sánh tốc độ pha chế thực tế với đường mốc tiêu chuẩn chuỗi
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: 280 }}>
            {mounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="s" />
                  <Tooltip formatter={(val: any) => [`${val} giây (${formatSecondsToMMSS(val)})`]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {/* Đường tiêu chuẩn */}
                  <ReferenceLine y={standards.drink} stroke="#0284C7" strokeDasharray="4 4" label={{ value: `Chuẩn Làm nước: ${standards.drink}s`, position: 'insideTopRight', fill: '#0284C7', fontSize: 10 }} />
                  <ReferenceLine y={standards.order} stroke="#1C4E6B" strokeDasharray="4 4" label={{ value: `Chuẩn SOS Đơn: ${standards.order}s`, position: 'insideTopRight', fill: '#1C4E6B', fontSize: 10 }} />
                  
                  <Line type="monotone" dataKey="TB Làm nước (s)" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="TB Nướng bánh (s)" stroke="#D97706" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="TB SOS Đơn (s)" stroke="#1C4E6B" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 13 }}>
                {loading ? 'Đang tải dữ liệu...' : 'Chưa có đủ dữ liệu để hiển thị biểu đồ thời gian'}
              </div>
            )}
          </div>
        </div>

        {/* Biểu đồ sản lượng theo ngày */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral)' }}>
                Sản Lượng Đo Lường Theo Ngày
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Tổng số ly làm nước, nướng bánh và SOS đơn hàng đã được đo trong các ca
              </p>
            </div>
          </div>

          <div style={{ width: '100%', height: 280 }}>
            {mounted && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0ECE6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Số ly Làm nước" fill="#0284C7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Số Nướng bánh" fill="#D97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Số SOS Đơn" fill="#1C4E6B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 13 }}>
                {loading ? 'Đang tải dữ liệu...' : 'Chưa có đủ dữ liệu để hiển thị biểu đồ sản lượng'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Performance Comparison & Highlights Section (Trạm 1 ca/ngày) */}
      {dailyComparison.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {/* Top 3 Summary Highlight Cards */}
          {dayHighlights && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
                marginBottom: 18,
              }}
            >
              {/* Card 1: Ngày hiệu suất tốt nhất */}
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  borderTop: '4px solid #059669',
                  background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#047857' }}>🏆 NGÀY HIỆU SUẤT CAO NHẤT</span>
                  <span style={{ fontSize: 11, background: '#DEF7EC', color: '#03543F', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                    SLA {dayHighlights.bestDay.complianceRate}%
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#064E3B', marginBottom: 4 }}>
                  {dayHighlights.bestDay.dayOfWeek}, {dayHighlights.bestDay.dateFormatted}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Phục vụ <strong>{dayHighlights.bestDay.totalVolume}</strong> món/đơn • Tốc độ TB: Nước {dayHighlights.bestDay.drinkAvg}s, Bánh {dayHighlights.bestDay.cakeAvg}s • QL: {dayHighlights.bestDay.managers}
                </div>
              </div>

              {/* Card 2: Ngày cao điểm sản lượng */}
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  borderTop: '4px solid #0284C7',
                  background: 'linear-gradient(180deg, #F0F9FF 0%, #FFFFFF 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0369A1' }}>🚀 NGÀY CAO ĐIỂM SẢN LƯỢNG</span>
                  <span style={{ fontSize: 11, background: '#E0F2FE', color: '#0284C7', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                    {dayHighlights.peakDay.totalVolume} món/đơn
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0C4A6E', marginBottom: 4 }}>
                  {dayHighlights.peakDay.dayOfWeek}, {dayHighlights.peakDay.dateFormatted}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Đạt đỉnh khối lượng phục vụ: <strong>{dayHighlights.peakDay.drinkQty} ly nước</strong>, <strong>{dayHighlights.peakDay.cakeQty} bánh</strong>, <strong>{dayHighlights.peakDay.orderCount} SOS đơn</strong>
                </div>
              </div>

              {/* Card 3: Ngày cần lưu ý */}
              <div
                className="card"
                style={{
                  padding: '16px 20px',
                  borderTop: '4px solid #D97706',
                  background: 'linear-gradient(180deg, #FFFBEB 0%, #FFFFFF 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#B45309' }}>⚠️ NGÀY CẦN CHÚ Ý VẬN HÀNH</span>
                  <span style={{ fontSize: 11, background: dayHighlights.attentionDay.incidents > 0 ? '#FEE2E2' : '#FEF3C7', color: dayHighlights.attentionDay.incidents > 0 ? '#B91C1C' : '#92400E', padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>
                    {dayHighlights.attentionDay.incidents > 0 ? `${dayHighlights.attentionDay.incidents} sự cố` : `SLA ${dayHighlights.attentionDay.complianceRate}%`}
                  </span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#78350F', marginBottom: 4 }}>
                  {dayHighlights.attentionDay.dayOfWeek}, {dayHighlights.attentionDay.dateFormatted}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Tỷ lệ đạt chuẩn: <strong>{dayHighlights.attentionDay.complianceRate}%</strong> • {dayHighlights.attentionDay.incidents > 0 ? `Ghi nhận ${dayHighlights.attentionDay.incidents} sự cố trong ca` : 'Có một số hạng mục chậm hơn tiêu chuẩn'} • QL: {dayHighlights.attentionDay.managers}
                </div>
              </div>
            </div>
          )}

          {/* Detailed Day-by-Day Table Card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral)' }}>
                  Bảng So Sánh & Đánh Giá Hiệu Năng Từng Ngày
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Theo dõi xu hướng tốc độ pha chế, sản lượng phục vụ và tỷ lệ đạt chuẩn SLA theo từng ngày (1 ca/ngày)
                </p>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Tổng cộng: <strong style={{ color: 'var(--primary)' }}>{dailyComparison.length} ngày</strong> có số liệu
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)', background: 'var(--surface)' }}>
                    <th style={{ padding: '10px 12px', borderRadius: '8px 0 0 8px' }}>Ngày & Thứ</th>
                    <th style={{ padding: '10px 12px' }}>Quản lý đứng ca</th>
                    <th style={{ padding: '10px 12px' }}>Làm nước (SL & TB/ly)</th>
                    <th style={{ padding: '10px 12px' }}>Nướng bánh (SL & TB/bánh)</th>
                    <th style={{ padding: '10px 12px' }}>SOS Đơn (SL & TB/đơn)</th>
                    <th style={{ padding: '10px 12px' }}>Đạt chuẩn SLA</th>
                    <th style={{ padding: '10px 12px' }}>Sự cố</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', borderRadius: '0 8px 8px 0' }}>Đánh giá ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyComparison.map((day) => {
                    const isDrinkOk = !day.drinkAvg || day.drinkAvg <= standards.drink;
                    const isCakeOk = !day.cakeAvg || day.cakeAvg <= standards.cake;
                    const isOrderOk = !day.orderAvg || day.orderAvg <= standards.order;

                    return (
                      <tr key={day.dayKey} style={{ borderBottom: '1px solid var(--divider)' }}>
                        <td style={{ padding: '12px 12px', fontWeight: 700 }}>
                          <div>{day.dayOfWeek}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{day.fullDate}</div>
                        </td>
                        <td style={{ padding: '12px 12px', color: 'var(--neutral)' }}>
                          {day.managers}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          {day.drinkQty > 0 ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ color: isDrinkOk ? '#0284C7' : '#DC2626' }}>{day.drinkAvg}s/ly</strong>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  background: isDrinkOk ? '#E0F2FE' : '#FEE2E2',
                                  color: isDrinkOk ? '#0369A1' : '#B91C1C',
                                }}>
                                  {isDrinkOk ? 'Đạt' : `+${day.drinkAvg - standards.drink}s`}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{day.drinkQty} ly</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-disabled)' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          {day.cakeQty > 0 ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ color: isCakeOk ? '#D97706' : '#DC2626' }}>{day.cakeAvg}s/bánh</strong>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  background: isCakeOk ? '#FEF3C7' : '#FEE2E2',
                                  color: isCakeOk ? '#B45309' : '#B91C1C',
                                }}>
                                  {isCakeOk ? 'Đạt' : `+${day.cakeAvg - standards.cake}s`}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{day.cakeQty} bánh</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-disabled)' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          {day.orderCount > 0 ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <strong style={{ color: isOrderOk ? '#1C4E6B' : '#DC2626' }}>{day.orderAvg}s/đơn</strong>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: 6,
                                  background: isOrderOk ? '#E3EEF5' : '#FEE2E2',
                                  color: isOrderOk ? '#1C4E6B' : '#B91C1C',
                                }}>
                                  {isOrderOk ? 'Đạt' : `+${day.orderAvg - standards.order}s`}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{day.orderCount} đơn</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-disabled)' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 48, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${day.complianceRate}%`,
                                  height: '100%',
                                  background: day.complianceRate >= 85 ? '#059669' : (day.complianceRate >= 70 ? '#D97706' : '#DC2626'),
                                }}
                              />
                            </div>
                            <strong style={{
                              fontSize: 12,
                              color: day.complianceRate >= 85 ? '#059669' : (day.complianceRate >= 70 ? '#D97706' : '#DC2626'),
                            }}>
                              {day.complianceRate}%
                            </strong>
                          </div>
                        </td>
                        <td style={{ padding: '12px 12px' }}>
                          {day.incidents > 0 ? (
                            <span style={{
                              background: '#FEE2E2',
                              color: '#B91C1C',
                              padding: '2px 8px',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 700,
                            }}>
                              {day.incidents} sự cố
                            </span>
                          ) : (
                            <span style={{ color: '#059669', fontSize: 12 }}>0</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 11,
                            fontWeight: 700,
                            background: day.ratingBg,
                            color: day.ratingColor,
                            display: 'inline-block',
                          }}>
                            {day.rating}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Attention Sessions Section */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--neutral)' }}>
              Các Ca Làm Việc Cần Lưu Ý
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Ca có phát sinh sự cố hoặc thời gian pha chế vượt tiêu chuẩn cửa hàng
            </p>
          </div>
          <Link
            href="/dashboard/performance/reports"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            Xem tất cả báo cáo &rarr;
          </Link>
        </div>

        {attentionSessions.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#1A6B5A', fontSize: 13 }}>
            🎉 Tất cả các ca đo trong kỳ đều đạt chuẩn tốt và không phát sinh sự cố!
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '8px 12px' }}>Thời gian ca</th>
                  <th style={{ padding: '8px 12px' }}>Quản lý đứng ca</th>
                  <th style={{ padding: '8px 12px' }}>Làm nước (TB/ly)</th>
                  <th style={{ padding: '8px 12px' }}>Nướng bánh (TB/bánh)</th>
                  <th style={{ padding: '8px 12px' }}>SOS đơn (TB/đơn)</th>
                  <th style={{ padding: '8px 12px' }}>Sự cố</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {attentionSessions.map((rep) => {
                  const started = parseFirestoreTimestamp(rep.startedAt);
                  const isSlowDrink = rep.drinkAverageSeconds > standards.drink;
                  const isSlowCake = rep.cakeAverageSeconds > standards.cake;
                  const isSlowOrder = rep.orderAverageSeconds > standards.order;
                  const hasInc = (rep.incidents?.length || 0) > 0;

                  return (
                    <tr key={rep.id} style={{ borderBottom: '1px solid var(--divider)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {started.toLocaleDateString('vi-VN')} {started.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {rep.managerOnDutyName || rep.managerName || 'Quản lý'}
                      </td>
                      <td style={{ padding: '10px 12px', color: isSlowDrink ? 'var(--primary)' : 'inherit', fontWeight: isSlowDrink ? 700 : 400 }}>
                        {rep.drinkAverageSeconds ? `${rep.drinkAverageSeconds}s` : '-'}
                        {isSlowDrink && <span style={{ fontSize: 10, marginLeft: 4 }}>⚠️</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: isSlowCake ? 'var(--primary)' : 'inherit', fontWeight: isSlowCake ? 700 : 400 }}>
                        {rep.cakeAverageSeconds ? `${rep.cakeAverageSeconds}s` : '-'}
                        {isSlowCake && <span style={{ fontSize: 10, marginLeft: 4 }}>⚠️</span>}
                      </td>
                      <td style={{ padding: '10px 12px', color: isSlowOrder ? 'var(--primary)' : 'inherit', fontWeight: isSlowOrder ? 700 : 400 }}>
                        {rep.orderAverageSeconds ? `${rep.orderAverageSeconds}s` : '-'}
                        {isSlowOrder && <span style={{ fontSize: 10, marginLeft: 4 }}>⚠️</span>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {hasInc ? (
                          <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                            {rep.incidents.length} sự cố
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <Link
                          href={`/dashboard/performance/reports?highlight=${rep.id}`}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                        >
                          Chi tiết
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
