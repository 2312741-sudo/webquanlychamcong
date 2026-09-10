// app/dashboard/performance/reports/page.tsx
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '../layout';
import {
  watchPerformanceReports,
  getSessionMeasurements,
  markReportAsViewed
} from '@/lib/performance';
import {
  exportSessionPerformanceExcel,
  exportConsolidatedPerformanceReports
} from '@/lib/performanceExportExcel';
import {
  PerformanceReport,
  Measurement,
  formatSecondsToMMSS,
  parseFirestoreTimestamp,
  getCategoryLabel
} from '@/lib/performanceTypes';

export default function PerformanceReportsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Đang tải báo cáo...</div>}>
      <PerformanceReportsContent />
    </Suspense>
  );
}

function PerformanceReportsContent() {
  const { storeId, store, user } = useApp();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  const [reports, setReports] = useState<PerformanceReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'viewed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Drill-down Drawer State
  const [selectedReport, setSelectedReport] = useState<PerformanceReport | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [measurementCategoryFilter, setMeasurementCategoryFilter] = useState<'all' | 'drink' | 'cake' | 'order'>('all');
  const [actionLoading, setActionLoading] = useState(false);

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

  // Tự động mở ca đo nếu có query param highlight
  useEffect(() => {
    if (highlightId && reports.length > 0) {
      const found = reports.find((r) => r.id === highlightId);
      if (found) {
        openReportDrawer(found);
      }
    }
  }, [highlightId, reports]);

  // Mở Drawer chi tiết ca
  const openReportDrawer = async (rep: PerformanceReport) => {
    setSelectedReport(rep);
    setLoadingMeasurements(true);
    setMeasurementCategoryFilter('all');
    try {
      const list = await getSessionMeasurements(rep.sessionId);
      setMeasurements(list);
    } finally {
      setLoadingMeasurements(false);
    }
  };

  // Đóng Drawer
  const closeReportDrawer = () => {
    setSelectedReport(null);
    setMeasurements([]);
  };

  // Đánh dấu đã xem
  const handleMarkViewed = async () => {
    if (!selectedReport || !user) return;
    setActionLoading(true);
    try {
      await markReportAsViewed(selectedReport.id, user.uid);
      setSelectedReport((prev) => (prev ? { ...prev, status: 'viewed', viewedAt: new Date(), viewedBy: user.uid } : null));
    } catch (err) {
      console.error('Lỗi khi cập nhật trạng thái đã xem:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Xuất Excel 1 ca
  const handleExportSingle = async () => {
    if (!selectedReport) return;
    setActionLoading(true);
    try {
      await exportSessionPerformanceExcel(selectedReport, measurements);
    } finally {
      setActionLoading(false);
    }
  };

  // Xuất Excel tổng hợp
  const handleExportAll = async () => {
    if (filteredReports.length === 0) return;
    setActionLoading(true);
    try {
      const storeName = store?.name || 'Tat_ca_cua_hang';
      await exportConsolidatedPerformanceReports(
        filteredReports,
        storeName,
        `${filteredReports.length} ca đo`
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Lọc báo cáo
  const filteredReports = useMemo(() => {
    return reports.filter((rep) => {
      if (statusFilter !== 'all' && rep.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dateStr = parseFirestoreTimestamp(rep.startedAt).toLocaleDateString('vi-VN');
        const mDuty = (rep.managerOnDutyName || '').toLowerCase();
        const mName = (rep.managerName || '').toLowerCase();
        const staff = (rep.employeeNames || []).join(' ').toLowerCase();
        const match =
          dateStr.includes(q) ||
          mDuty.includes(q) ||
          mName.includes(q) ||
          staff.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [reports, statusFilter, searchQuery]);

  // Lọc measurements trong Drawer
  const filteredMeasurements = useMemo(() => {
    if (measurementCategoryFilter === 'all') return measurements;
    return measurements.filter((m) => m.category === measurementCategoryFilter);
  }, [measurements, measurementCategoryFilter]);

  const standards = useMemo(() => {
    return {
      drink: selectedReport?.standardSnapshot?.drinkStandardSeconds || 120,
      cake: selectedReport?.standardSnapshot?.cakeStandardSeconds || 120,
      order: selectedReport?.standardSnapshot?.orderStandardSeconds || 180,
    };
  }, [selectedReport]);

  return (
    <div>
      {/* Search & Actions Bar */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Search box */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm theo Quản lý, Nhân viên, Ngày..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 14px',
                paddingLeft: 32,
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13,
                width: 260,
              }}
            />
            <span style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-secondary)', fontSize: 14 }}>
              🔍
            </span>
          </div>

          {/* Status filter tabs */}
          <div style={{ display: 'inline-flex', background: 'var(--surface)', padding: 3, borderRadius: 8, gap: 2 }}>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'submitted', label: 'Chưa xem' },
              { id: 'viewed', label: 'Đã xem' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id as any)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: statusFilter === s.id ? 700 : 500,
                  background: statusFilter === s.id ? 'white' : 'transparent',
                  color: statusFilter === s.id ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: statusFilter === s.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right action: Export Consolidated Excel */}
        <button
          onClick={handleExportAll}
          disabled={actionLoading || filteredReports.length === 0}
          className="btn btn-secondary"
          style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <span>📥</span>
          Xuất Excel ({filteredReports.length} ca)
        </button>
      </div>

      {/* Reports Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#FAF7F2', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px' }}>Thời gian ca</th>
                <th style={{ padding: '12px 16px' }}>Quản lý đứng ca</th>
                <th style={{ padding: '12px 16px' }}>Nhân viên trong ca</th>
                <th style={{ padding: '12px 16px' }}>Làm nước (TB/ly)</th>
                <th style={{ padding: '12px 16px' }}>Nướng bánh (TB/bánh)</th>
                <th style={{ padding: '12px 16px' }}>SOS đơn hàng (TB/đơn)</th>
                <th style={{ padding: '12px 16px' }}>Sự cố</th>
                <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ padding: 36, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Đang tải danh sách báo cáo...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 36, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Không tìm thấy báo cáo ca nào phù hợp điều kiện lọc.
                  </td>
                </tr>
              ) : (
                filteredReports.map((rep) => {
                  const started = parseFirestoreTimestamp(rep.startedAt);
                  const ended = parseFirestoreTimestamp(rep.endedAt);
                  const isUnviewed = rep.status === 'submitted';

                  return (
                    <tr
                      key={rep.id}
                      style={{
                        borderBottom: '1px solid var(--divider)',
                        background: isUnviewed ? 'rgba(203, 45, 46, 0.02)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        <div style={{ color: 'var(--neutral)' }}>{started.toLocaleDateString('vi-VN')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {started.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {ended.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--neutral)' }}>
                          {rep.managerOnDutyName || rep.managerName || 'Quản lý'}
                        </div>
                        {rep.managerName && rep.managerName !== rep.managerOnDutyName && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            Tạo bởi: {rep.managerName}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', maxWidth: 200 }}>
                        {rep.employeeNames?.length ? (
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rep.employeeNames.join(', ')}>
                            {rep.employeeNames.join(', ')}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>-</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0284C7' }}>
                          {rep.drinkAverageSeconds ? `${rep.drinkAverageSeconds}s` : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {rep.drinkTotalQuantity} ly ({rep.drinkMeasurementCount} lần)
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#D97706' }}>
                          {rep.cakeAverageSeconds ? `${rep.cakeAverageSeconds}s` : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {rep.cakeTotalQuantity} bánh ({rep.cakeMeasurementCount} lần)
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#1C4E6B' }}>
                          {rep.orderAverageSeconds ? `${rep.orderAverageSeconds}s` : '--'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {rep.orderCount} đơn hàng
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {rep.incidents?.length ? (
                          <span style={{ background: '#FEE2E2', color: '#B91C1C', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                            {rep.incidents.length} sự cố
                          </span>
                        ) : (
                          <span style={{ color: '#1A6B5A', fontSize: 12 }}>0</span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {isUnviewed ? (
                          <span style={{ background: '#FFF1F2', color: '#E11D48', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, border: '1px solid #FFE4E6' }}>
                            Chưa xem
                          </span>
                        ) : (
                          <span style={{ background: '#E6F2EF', color: '#1A6B5A', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                            Đã xem
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => openReportDrawer(rep)}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                        >
                          Chi tiết &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Drawer / Modal for Drill-Down */}
      {selectedReport && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={closeReportDrawer}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 780,
              height: '100%',
              background: 'white',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FAF7F2',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--neutral)' }}>
                    Chi Tiết Ca Đo Hiệu Năng
                  </h2>
                  {selectedReport.status === 'submitted' ? (
                    <span style={{ background: '#FFF1F2', color: '#E11D48', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      Chưa xem
                    </span>
                  ) : (
                    <span style={{ background: '#E6F2EF', color: '#1A6B5A', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>
                      Đã xem
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Cửa hàng: {selectedReport.storeName} • {parseFirestoreTimestamp(selectedReport.startedAt).toLocaleDateString('vi-VN')}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handleExportSingle}
                  disabled={actionLoading}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Xuất Excel
                </button>
                {selectedReport.status === 'submitted' && (
                  <button
                    onClick={handleMarkViewed}
                    disabled={actionLoading}
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    Duyệt đã xem
                  </button>
                )}
                <button
                  onClick={closeReportDrawer}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: 20,
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    padding: 4,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {/* Personnel Summary */}
              <div
                style={{
                  background: 'var(--surface)',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 20,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Quản lý đứng ca:</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedReport.managerOnDutyName || 'Chưa rõ'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Quản lý tạo ca:</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedReport.managerName || 'Chưa rõ'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Thời gian ca:</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {parseFirestoreTimestamp(selectedReport.startedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {parseFirestoreTimestamp(selectedReport.endedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Nhân viên tham gia ca:</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {selectedReport.employeeNames?.length ? selectedReport.employeeNames.join(', ') : 'Không có'}
                  </div>
                </div>
              </div>

              {/* KPI Mini-cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                <div style={{ border: '1px solid #BAE6FD', background: '#F0F9FF', padding: 12, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1' }}>🥤 LÀM NƯỚC</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0284C7', marginTop: 4 }}>
                    {selectedReport.drinkAverageSeconds ? `${selectedReport.drinkAverageSeconds}s` : '--'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {selectedReport.drinkTotalQuantity} ly ({selectedReport.drinkMeasurementCount} lần) • Chuẩn {standards.drink}s
                  </div>
                </div>

                <div style={{ border: '1px solid #FDE68A', background: '#FFFBEB', padding: 12, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#B45309' }}>🍰 NƯỚNG BÁNH</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
                    {selectedReport.cakeAverageSeconds ? `${selectedReport.cakeAverageSeconds}s` : '--'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {selectedReport.cakeTotalQuantity} bánh ({selectedReport.cakeMeasurementCount} lần) • Chuẩn {standards.cake}s
                  </div>
                </div>

                <div style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', padding: 12, borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1C4E6B' }}>📦 SOS ĐƠN HÀNG</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1C4E6B', marginTop: 4 }}>
                    {selectedReport.orderAverageSeconds ? `${selectedReport.orderAverageSeconds}s` : '--'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {selectedReport.orderCount} đơn hàng • Chuẩn {standards.order}s
                  </div>
                </div>
              </div>

              {/* Measurements Drill-down */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral)' }}>
                    Chi Tiết Từng Lượt Bấm Giờ ({measurements.length})
                  </h3>

                  <div style={{ display: 'inline-flex', background: 'var(--surface)', padding: 2, borderRadius: 6, gap: 2 }}>
                    {[
                      { id: 'all', label: 'Tất cả' },
                      { id: 'drink', label: 'Làm nước' },
                      { id: 'cake', label: 'Nướng bánh' },
                      { id: 'order', label: 'SOS đơn' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setMeasurementCategoryFilter(cat.id as any)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: measurementCategoryFilter === cat.id ? 700 : 500,
                          background: measurementCategoryFilter === cat.id ? 'white' : 'transparent',
                          color: measurementCategoryFilter === cat.id ? 'var(--primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingMeasurements ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                    Đang tải danh sách lượt đo...
                  </div>
                ) : filteredMeasurements.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>
                    Không có lượt đo nào trong hạng mục này.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#FAF7F2', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '8px 12px' }}>#</th>
                          <th style={{ padding: '8px 12px' }}>Thời điểm</th>
                          <th style={{ padding: '8px 12px' }}>Hạng mục</th>
                          <th style={{ padding: '8px 12px' }}>Số lượng / Mã</th>
                          <th style={{ padding: '8px 12px' }}>Tổng thời gian</th>
                          <th style={{ padding: '8px 12px' }}>Tốc độ / mục</th>
                          <th style={{ padding: '8px 12px' }}>Đánh giá</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMeasurements.map((m, idx) => {
                          const startedM = parseFirestoreTimestamp(m.startedAt);
                          const avgSec = m.quantity > 0 ? Math.round(m.durationSeconds / m.quantity) : m.durationSeconds;
                          const std = m.category === 'drink' ? standards.drink : m.category === 'cake' ? standards.cake : standards.order;
                          const isPass = avgSec <= std;

                          return (
                            <tr key={m.id} style={{ borderBottom: '1px solid var(--divider)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                              <td style={{ padding: '8px 12px' }}>
                                {startedM.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                {getCategoryLabel(m.category)}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {m.category === 'order' ? (m.orderCode || 'Đơn hàng') : `${m.quantity} mục`}
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                                {formatSecondsToMMSS(m.durationSeconds)} ({m.durationSeconds}s)
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {avgSec}s / mục
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                {isPass ? (
                                  <span style={{ color: '#1A6B5A', fontWeight: 600 }}>✅ Đạt</span>
                                ) : (
                                  <span style={{ color: '#CB2D2E', fontWeight: 700 }}>+{avgSec - std}s</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Incidents Section */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral)', marginBottom: 10 }}>
                  Sự Cố Ghi Nhận ({selectedReport.incidents?.length || 0})
                </h3>
                {!selectedReport.incidents || selectedReport.incidents.length === 0 ? (
                  <div style={{ padding: '12px 16px', background: '#F0FDF4', color: '#166534', borderRadius: 8, fontSize: 12 }}>
                    ✅ Ca làm việc diễn ra suôn sẻ, không có sự cố nào phát sinh.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedReport.incidents.map((inc) => {
                      const incTime = parseFirestoreTimestamp(inc.timestamp);
                      return (
                        <div key={inc.id} style={{ border: '1px solid #FECACA', background: '#FEF2F2', padding: 12, borderRadius: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#991B1B', fontWeight: 700, marginBottom: 4 }}>
                            <span>{inc.category}</span>
                            <span>{incTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#7F1D1D' }}>{inc.description}</div>
                          {inc.staffName && (
                            <div style={{ fontSize: 11, color: '#991B1B', marginTop: 4 }}>
                              Nhân sự liên quan: <strong>{inc.staffName}</strong>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form Responses / Checklist */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--neutral)', marginBottom: 10 }}>
                  Khảo Sát / Tiêu Chí Kết Thúc Ca
                </h3>
                {Object.keys(selectedReport.formResponses || {}).length === 0 ? (
                  <div style={{ padding: '12px 16px', background: 'var(--surface)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 12 }}>
                    Không có câu hỏi bổ sung nào được ghi nhận.
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    {Object.entries(selectedReport.formResponses).map(([k, v], idx) => (
                      <div
                        key={k}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderBottom: idx < Object.keys(selectedReport.formResponses).length - 1 ? '1px solid var(--divider)' : 'none',
                          fontSize: 12,
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)', maxWidth: '65%' }}>{k}</span>
                        <strong style={{ color: 'var(--neutral)' }}>
                          {typeof v === 'boolean' ? (v ? '✅ Đạt' : '❌ Chưa đạt') : String(v)}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
