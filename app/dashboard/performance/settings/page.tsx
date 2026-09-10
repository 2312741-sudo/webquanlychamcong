// app/dashboard/performance/settings/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import {
  updateStorePerformanceStandards,
  updateStoreEndSessionCriteria,
  deletePerformanceData
} from '@/lib/performance';
import {
  DEFAULT_STANDARDS,
  StorePerformanceStandards,
  EndSessionCriterion
} from '@/lib/performanceTypes';

export default function PerformanceSettingsPage() {
  const { storeId, store } = useApp();

  // Standards State
  const [standards, setStandards] = useState<StorePerformanceStandards>(DEFAULT_STANDARDS);
  const [savingStandards, setSavingStandards] = useState(false);
  const [standardsMsg, setStandardsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Criteria State
  const [criteria, setCriteria] = useState<EndSessionCriterion[]>([]);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [criteriaMsg, setCriteriaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newCriterionTitle, setNewCriterionTitle] = useState('');
  const [newCriterionType, setNewCriterionType] = useState<'checkbox' | 'number' | 'text' | 'rating'>('checkbox');

  // Cleanup & Deletion State
  const [deleteMode, setDeleteMode] = useState<'week' | 'month' | 'range' | 'all'>('week');
  const [delStartDate, setDelStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [delEndDate, setDelEndDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ sessions: number; measurements: number; reports: number } | null>(null);

  // Sync standards & criteria from store
  useEffect(() => {
    if (!store) return;
    const s = (store as any).performanceStandards;
    if (s) {
      setStandards({
        drinkStandardSeconds: s.drinkStandardSeconds ?? DEFAULT_STANDARDS.drinkStandardSeconds,
        cakeStandardSeconds: s.cakeStandardSeconds ?? DEFAULT_STANDARDS.cakeStandardSeconds,
        orderStandardSeconds: s.orderStandardSeconds ?? DEFAULT_STANDARDS.orderStandardSeconds,
      });
    }
    const c = (store as any).endSessionCriteria;
    if (Array.isArray(c)) {
      setCriteria(c);
    }
  }, [store]);

  // Lưu tiêu chuẩn
  const handleSaveStandards = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    setSavingStandards(true);
    setStandardsMsg(null);
    try {
      await updateStorePerformanceStandards(storeId, standards);
      setStandardsMsg({ type: 'success', text: '✅ Đã lưu tiêu chuẩn hiệu năng thành công!' });
      setTimeout(() => setStandardsMsg(null), 3000);
    } catch (err) {
      setStandardsMsg({ type: 'error', text: '❌ Lỗi khi lưu tiêu chuẩn: ' + String(err) });
    } finally {
      setSavingStandards(false);
    }
  };

  // Thêm tiêu chí checklist
  const handleAddCriterion = () => {
    if (!newCriterionTitle.trim()) return;
    const newItem: EndSessionCriterion = {
      id: `crit_${Date.now()}`,
      title: newCriterionTitle.trim(),
      type: newCriterionType,
      isRequired: true,
      order: criteria.length,
    };
    setCriteria([...criteria, newItem]);
    setNewCriterionTitle('');
  };

  // Xóa tiêu chí
  const handleRemoveCriterion = (id: string) => {
    setCriteria(criteria.filter((c) => c.id !== id));
  };

  // Lưu danh sách tiêu chí
  const handleSaveCriteria = async () => {
    if (!storeId) return;
    setSavingCriteria(true);
    setCriteriaMsg(null);
    try {
      await updateStoreEndSessionCriteria(storeId, criteria);
      setCriteriaMsg({ type: 'success', text: '✅ Đã lưu tiêu chí khảo sát cuối ca!' });
      setTimeout(() => setCriteriaMsg(null), 3000);
    } catch (err) {
      setCriteriaMsg({ type: 'error', text: '❌ Lỗi lưu tiêu chí: ' + String(err) });
    } finally {
      setSavingCriteria(false);
    }
  };

  // Mở modal xác nhận xóa
  const handleOpenDeleteModal = () => {
    setConfirmInput('');
    setDeleteResult(null);
    setShowConfirmModal(true);
  };

  // Thực hiện xóa dữ liệu
  const handleExecuteDelete = async () => {
    if (!storeId || confirmInput.trim().toUpperCase() !== 'XÓA') return;
    setIsDeleting(true);
    try {
      let sDate: Date | undefined;
      let eDate: Date | undefined;
      const now = new Date();

      if (deleteMode === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        sDate = new Date(now.setDate(diff));
        sDate.setHours(0, 0, 0, 0);
        eDate = new Date();
        eDate.setHours(23, 59, 59, 999);
      } else if (deleteMode === 'month') {
        sDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        eDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (deleteMode === 'range') {
        sDate = new Date(delStartDate + 'T00:00:00');
        eDate = new Date(delEndDate + 'T23:59:59');
      }

      const res = await deletePerformanceData({
        storeId,
        startDate: sDate,
        endDate: eDate,
        deleteAll: deleteMode === 'all',
      });

      setDeleteResult(res);
    } catch (err) {
      alert('Lỗi khi xóa dữ liệu: ' + String(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* SECTION 1: Cài đặt Tiêu chuẩn thời gian */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral)' }}>
            1. Cài Đặt Tiêu Chuẩn Thời Gian Chuỗi
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Mốc thời gian quy định cho cửa hàng <strong>{store?.name}</strong>. Các lượt đo vượt mốc này sẽ bị đánh dấu cảnh báo.
          </p>
        </div>

        <form onSubmit={handleSaveStandards}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 20 }}>
            {/* Drink */}
            <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0284C7', marginBottom: 6 }}>
                🥤 Tiêu chuẩn Nước (giây / ly)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={standards.drinkStandardSeconds}
                  onChange={(e) => setStandards({ ...standards, drinkStandardSeconds: parseInt(e.target.value) || 0 })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 16,
                    fontWeight: 700,
                    width: 120,
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  giây (= {Math.floor(standards.drinkStandardSeconds / 60)} phút {standards.drinkStandardSeconds % 60}s)
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Mặc định khuyến nghị: 120 giây (2 phút)
              </div>
            </div>

            {/* Cake */}
            <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#D97706', marginBottom: 6 }}>
                🍰 Tiêu chuẩn Bánh (giây / bánh)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min={10}
                  max={600}
                  value={standards.cakeStandardSeconds}
                  onChange={(e) => setStandards({ ...standards, cakeStandardSeconds: parseInt(e.target.value) || 0 })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 16,
                    fontWeight: 700,
                    width: 120,
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  giây (= {Math.floor(standards.cakeStandardSeconds / 60)} phút {standards.cakeStandardSeconds % 60}s)
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Mặc định khuyến nghị: 120 giây (2 phút)
              </div>
            </div>

            {/* Order */}
            <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 10 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1C4E6B', marginBottom: 6 }}>
                📦 Tiêu chuẩn Đơn hàng (giây / đơn)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min={10}
                  max={1200}
                  value={standards.orderStandardSeconds}
                  onChange={(e) => setStandards({ ...standards, orderStandardSeconds: parseInt(e.target.value) || 0 })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 16,
                    fontWeight: 700,
                    width: 120,
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  giây (= {Math.floor(standards.orderStandardSeconds / 60)} phút {standards.orderStandardSeconds % 60}s)
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                Mặc định khuyến nghị: 180 giây (3 phút)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" disabled={savingStandards} className="btn btn-primary">
              {savingStandards ? 'Đang lưu...' : 'Lưu Thay Đổi Tiêu Chuẩn'}
            </button>
            {standardsMsg && (
              <span style={{ fontSize: 13, color: standardsMsg.type === 'success' ? '#1A6B5A' : '#CB2D2E', fontWeight: 600 }}>
                {standardsMsg.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* SECTION 2: Tiêu chí checklist kết thúc ca */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--neutral)' }}>
            2. Tiêu Chí Khảo Sát / Checklist Kết Thúc Ca
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Các câu hỏi yêu cầu Quản lý xác nhận trên ứng dụng trước khi bấm &quot;Kết thúc phiên đo&quot;.
          </p>
        </div>

        {/* Existing criteria list */}
        <div style={{ marginBottom: 16 }}>
          {criteria.length === 0 ? (
            <div style={{ padding: 14, background: 'var(--surface)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              Chưa thiết lập tiêu chí riêng (Hệ thống sẽ dùng bộ câu hỏi mặc định).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {criteria.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'white',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: 12 }}>#{idx + 1}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{item.title}</span>
                    <span style={{ fontSize: 11, background: 'var(--surface)', padding: '2px 8px', borderRadius: 6, color: 'var(--text-secondary)' }}>
                      {item.type === 'checkbox' ? 'Đúng/Sai (Checkbox)' : item.type === 'number' ? 'Số liệu (Number)' : item.type === 'rating' ? 'Đánh giá sao' : 'Văn bản (Text)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCriterion(item.id)}
                    style={{ background: 'none', border: 'none', color: '#CB2D2E', cursor: 'pointer', fontSize: 14 }}
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new criterion input */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            type="text"
            placeholder="Nội dung câu hỏi / tiêu chí mới..."
            value={newCriterionTitle}
            onChange={(e) => setNewCriterionTitle(e.target.value)}
            style={{
              flex: 1,
              minWidth: 260,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 13,
            }}
          />
          <select
            value={newCriterionType}
            onChange={(e) => setNewCriterionType(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 13,
              background: 'white',
            }}
          >
            <option value="checkbox">Checkbox (Đạt / Không đạt)</option>
            <option value="number">Số lượng (Number)</option>
            <option value="text">Văn bản (Text)</option>
            <option value="rating">Đánh giá sao (Rating)</option>
          </select>
          <button
            type="button"
            onClick={handleAddCriterion}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            + Thêm tiêu chí
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={handleSaveCriteria}
            disabled={savingCriteria}
            className="btn btn-primary"
          >
            {savingCriteria ? 'Đang lưu...' : 'Lưu Danh Sách Tiêu Chí'}
          </button>
          {criteriaMsg && (
            <span style={{ fontSize: 13, color: criteriaMsg.type === 'success' ? '#1A6B5A' : '#CB2D2E', fontWeight: 600 }}>
              {criteriaMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* SECTION 3: Công cụ Dọn dẹp & Xóa Dữ liệu Đo */}
      <div className="card" style={{ padding: 24, border: '1px solid #FECACA', background: '#FFFDFD' }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🗑️</span>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#B91C1C' }}>
              3. Công Cụ Dọn Dẹp & Xóa Dữ Liệu Đo Lường
            </h2>
          </div>
          <p style={{ fontSize: 13, color: '#7F1D1D', marginTop: 4 }}>
            Đồng bộ nghiệp vụ với ứng dụng di động: Xóa triệt để các phiên đo (`performance_sessions`), các lượt đo chi tiết (`measurements`), và các báo cáo (`performance_reports`) trên Firebase Firestore.
          </p>
        </div>

        {/* Delete Mode Selector */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--neutral)', marginBottom: 8 }}>
            Chọn phạm vi dữ liệu cần xóa:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { id: 'week', label: 'Tuần này', desc: 'Xóa dữ liệu đo từ thứ 2 đến nay' },
              { id: 'month', label: 'Tháng này', desc: 'Xóa dữ liệu đo trong tháng hiện tại' },
              { id: 'range', label: 'Khoảng thời gian', desc: 'Tùy chọn ngày bắt đầu & kết thúc' },
              { id: 'all', label: 'Toàn bộ dữ liệu', desc: 'Xóa sạch tất cả dữ liệu đo lường' },
            ].map((m) => (
              <div
                key={m.id}
                onClick={() => setDeleteMode(m.id as any)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: deleteMode === m.id ? '2px solid #CB2D2E' : '1px solid var(--border)',
                  background: deleteMode === m.id ? '#FFF1F2' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: deleteMode === m.id ? '#CB2D2E' : 'var(--neutral)' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {m.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {deleteMode === 'range' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Từ ngày:</span>
            <input
              type="date"
              value={delStartDate}
              onChange={(e) => setDelStartDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
            />
            <span style={{ fontSize: 13, fontWeight: 600 }}>đến:</span>
            <input
              type="date"
              value={delEndDate}
              onChange={(e) => setDelEndDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
            />
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleOpenDeleteModal}
            style={{
              background: '#DC2626',
              color: 'white',
              padding: '10px 20px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚠️</span>
            Tiến Hành Xóa Dữ Liệu Đo
          </button>
        </div>
      </div>

      {/* Safety Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => !isDeleting && setShowConfirmModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 500,
              width: '100%',
              padding: 28,
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {deleteResult ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#166534', marginBottom: 8 }}>
                  Dọn Dẹp Dữ Liệu Thành Công!
                </h3>
                <div style={{ background: '#F0FDF4', padding: 14, borderRadius: 8, fontSize: 13, color: '#166534', marginBottom: 20, textAlign: 'left' }}>
                  - Số phiên đo (`sessions`) đã xóa: <strong>{deleteResult.sessions}</strong><br />
                  - Số lượt bấm giờ (`measurements`) đã xóa: <strong>{deleteResult.measurements}</strong><br />
                  - Số báo cáo (`reports`) đã xóa: <strong>{deleteResult.reports}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 26 }}>🚨</span>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#B91C1C' }}>
                    Xác Nhận Xóa Vĩnh Viễn Dữ Liệu
                  </h3>
                </div>

                <p style={{ fontSize: 13, color: '#7F1D1D', lineHeight: 1.5, marginBottom: 16 }}>
                  Hành động này sẽ <strong>xóa hoàn toàn</strong> dữ liệu đo hiệu năng ({deleteMode === 'all' ? 'Toàn bộ' : deleteMode === 'week' ? 'Tuần này' : deleteMode === 'month' ? 'Tháng này' : 'Khoảng ngày đã chọn'}) của cửa hàng <strong>{store?.name}</strong> trên Firebase Firestore. Hành động này <strong>KHÔNG THỂ HOÀN TÁC</strong>!
                </p>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Vui lòng nhập chữ <span style={{ color: '#DC2626', fontWeight: 800 }}>XÓA</span> vào ô dưới đây để xác nhận:
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập XÓA để kích hoạt nút"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '2px solid #EF4444',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isDeleting}
                    className="btn btn-secondary"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteDelete}
                    disabled={isDeleting || confirmInput.trim().toUpperCase() !== 'XÓA'}
                    style={{
                      background: confirmInput.trim().toUpperCase() === 'XÓA' ? '#DC2626' : '#FCA5A5',
                      color: 'white',
                      padding: '10px 18px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: confirmInput.trim().toUpperCase() === 'XÓA' ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {isDeleting ? 'Đang xóa...' : 'Tôi Xác Nhận Xóa'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
