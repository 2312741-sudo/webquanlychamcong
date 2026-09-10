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
      'TB Nước (s)': v.rawDrinkQty > 0 ? Math.round(v.rawDrinkSec / v.rawDrinkQty) : null,
      'TB Bánh (s)': v.rawCakeQty > 0 ? Math.round(v.rawCakeSec / v.rawCakeQty) : null,
      'TB Đơn (s)': v.rawOrderCount > 0 ? Math.round(v.rawOrderSec / v.rawOrderCount) : null,
      'Số ly Nước': v.rawDrinkQty,
      'Số Bánh': v.rawCakeQty,
      'Số Đơn hàng': v.rawOrderCount,
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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>🥤 PHA CHẾ NƯỚC</span>
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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>🍰 CHẾ BIẾN BÁNH</span>
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
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>📦 XỬ LÝ ĐƠN HÀNG</span>
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
                  <ReferenceLine y={standards.drink} stroke="#0284C7" strokeDasharray="4 4" label={{ value: `Chuẩn Nước: ${standards.drink}s`, position: 'insideTopRight', fill: '#0284C7', fontSize: 10 }} />
                  <ReferenceLine y={standards.order} stroke="#1C4E6B" strokeDasharray="4 4" label={{ value: `Chuẩn Đơn: ${standards.order}s`, position: 'insideTopRight', fill: '#1C4E6B', fontSize: 10 }} />
                  
                  <Line type="monotone" dataKey="TB Nước (s)" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="TB Bánh (s)" stroke="#D97706" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="TB Đơn (s)" stroke="#1C4E6B" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
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
                Tổng số ly nước, bánh và đơn hàng đã được đo trong các ca
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
                  <Bar dataKey="Số ly Nước" fill="#0284C7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Số Bánh" fill="#D97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Số Đơn hàng" fill="#1C4E6B" radius={[4, 4, 0, 0]} />
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
                  <th style={{ padding: '8px 12px' }}>Nước (TB/ly)</th>
                  <th style={{ padding: '8px 12px' }}>Bánh (TB/bánh)</th>
                  <th style={{ padding: '8px 12px' }}>Đơn (TB/đơn)</th>
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
