'use client';
import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../layout';
import {
  watchProductionTasks, addProductionTask, updateProductionTask,
  deleteProductionTask, getProductionReports, deleteProductionReport,
} from '@/lib/firestore';
import { exportProductionReport } from '@/lib/exportExcel';
import { ProductionTask, ProductionReport } from '@/lib/types';

const COMMON_UNIT_PRESETS = [
  'Kg', 'Phút', 'Sản phẩm', 'Ca', 'Gói', 'Thùng', 'Ly', 'Hộp', 'Bao', 'Cái', 'Đơn'
];

export default function ProductionPage() {
  const { storeId, store, members } = useApp();
  const [activeTab, setActiveTab] = useState<'tasks' | 'reports'>('tasks');

  // — Task state —
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ProductionTask | null>(null);
  const [taskForm, setTaskForm] = useState({
    name: '',
    hasUnit: true,
    unitLabel: 'Kg'
  });
  const [taskSaving, setTaskSaving] = useState(false);

  // — Report state —
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [filterUserId, setFilterUserId] = useState('');
  const [exporting, setExporting] = useState(false);

  // Subscribe to tasks
  useEffect(() => {
    if (!storeId) return;
    const unsub = watchProductionTasks(storeId, setTasks);
    return unsub;
  }, [storeId]);

  // Fetch reports when month changes
  const fetchReports = useCallback(async () => {
    if (!storeId) return;
    setReportLoading(true);
    try {
      const data = await getProductionReports(storeId, reportMonth);
      setReports(data);
    } finally {
      setReportLoading(false);
    }
  }, [storeId, reportMonth]);

  useEffect(() => {
    if (activeTab === 'reports') fetchReports();
  }, [activeTab, fetchReports]);

  // — Task handlers —
  const openAddTask = () => {
    setEditingTask(null);
    setTaskForm({ name: '', hasUnit: true, unitLabel: 'Kg' });
    setShowTaskModal(true);
  };

  const openEditTask = (task: ProductionTask) => {
    setEditingTask(task);
    const hasUnit = task.unitLabel ? task.unitLabel.trim().length > 0 : (task.unit !== 'none' && task.hasUnit !== false);
    setTaskForm({
      name: task.name,
      hasUnit: hasUnit,
      unitLabel: task.unitLabel || 'Kg'
    });
    setShowTaskModal(true);
  };

  const saveTask = async () => {
    if (!storeId || !taskForm.name.trim()) return;
    setTaskSaving(true);
    const finalUnitLabel = taskForm.hasUnit ? (taskForm.unitLabel.trim() || 'Sản phẩm') : '';
    const finalUnitType = taskForm.hasUnit ? 'custom' : 'none';

    try {
      if (editingTask) {
        await updateProductionTask(storeId, editingTask.id, {
          name: taskForm.name.trim(),
          unit: finalUnitType,
          unitLabel: finalUnitLabel,
          hasUnit: taskForm.hasUnit,
        });
      } else {
        await addProductionTask(storeId, {
          name: taskForm.name.trim(),
          unit: finalUnitType,
          unitLabel: finalUnitLabel,
          hasUnit: taskForm.hasUnit,
          active: true,
          order: tasks.length + 1,
        });
      }
      setShowTaskModal(false);
    } finally {
      setTaskSaving(false);
    }
  };

  const toggleTask = async (task: ProductionTask) => {
    if (!storeId) return;
    await updateProductionTask(storeId, task.id, { active: !task.active });
  };

  const deleteTask = async (task: ProductionTask) => {
    if (!storeId) return;
    if (!confirm(`Xóa công việc "${task.name}"? Hành động không thể hoàn tác.`)) return;
    await deleteProductionTask(storeId, task.id);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!storeId) return;
    if (!confirm('Xóa báo cáo này?')) return;
    await deleteProductionReport(storeId, reportId);
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  const handleExport = async () => {
    if (!store) return;
    setExporting(true);
    try {
      const filtered = filterUserId ? reports.filter(r => r.userId === filterUserId) : reports;
      await exportProductionReport(filtered, tasks, members, store.name, reportMonth);
    } finally {
      setExporting(false);
    }
  };

  const activeMembersList = members.filter(m => m.status === 'active');
  const filteredReports = filterUserId ? reports.filter(r => r.userId === filterUserId) : reports;
  const activeTasks = tasks.filter(t => t.active);

  const formatCheckout = (ts: any) => {
    if (!ts) return '—';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    } catch { return '—'; }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
          🏭 Công cụ Đo lường Hiệu quả Sản xuất & Checklist
        </h1>
        <p style={{ color: '#666', marginTop: '6px', fontSize: '14px' }}>
          Quản lý danh sách công việc/checklist và theo dõi báo cáo hiệu suất nhân viên khi out ca
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #eee', paddingBottom: '0' }}>
        {[
          { key: 'tasks', label: '📋 Quản lý công việc & Checklist' },
          { key: 'reports', label: '📊 Báo cáo sản xuất' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none',
              fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? '#C8102E' : '#666',
              borderBottom: activeTab === tab.key ? '3px solid #C8102E' : '3px solid transparent',
              cursor: 'pointer', fontSize: '14px', marginBottom: '-2px',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: Quản lý công việc ─────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '14px', color: '#666' }}>
                {tasks.filter(t => t.active).length} công việc đang bật / {tasks.length} tổng
              </span>
            </div>
            <button
              onClick={openAddTask}
              style={{
                background: '#C8102E', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              + Thêm công việc
            </button>
          </div>

          {tasks.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: '12px', border: '1px solid #eee',
              padding: '60px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <h3 style={{ color: '#999', fontWeight: 500 }}>Chưa có công việc nào</h3>
              <p style={{ color: '#bbb', fontSize: '14px' }}>Bấm "Thêm công việc" để tạo danh sách checklist cho nhân viên</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f8f8' }}>
                    {['STT', 'Tên công việc', 'Đơn vị đo lường', 'Trạng thái', 'Thao tác'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#555', borderBottom: '1px solid #eee' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, idx) => {
                    const hasUnit = task.unitLabel && task.unitLabel.trim().length > 0;
                    return (
                      <tr key={task.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '12px 16px', color: '#999', fontSize: '13px' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a1a' }}>{task.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {hasUnit ? (
                            <span style={{
                              background: '#f0f4ff', color: '#3b5bdb',
                              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                            }}>
                              🏷️ {task.unitLabel}
                            </span>
                          ) : (
                            <span style={{
                              background: '#f1f3f5', color: '#868e96',
                              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                            }}>
                              ✓ Checklist (Không bắt buộc đơn vị)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button
                            onClick={() => toggleTask(task)}
                            style={{
                              background: task.active ? '#e8f5e9' : '#fafafa',
                              color: task.active ? '#1A6B5A' : '#999',
                              border: `1px solid ${task.active ? '#1A6B5A' : '#ddd'}`,
                              padding: '4px 12px', borderRadius: '20px', cursor: 'pointer',
                              fontSize: '12px', fontWeight: 600,
                            }}
                          >
                            {task.active ? '✓ Đang bật' : '○ Đang tắt'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => openEditTask(task)}
                              style={{ background: '#f0f4ff', color: '#3b5bdb', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                            >
                              ✏️ Sửa
                            </button>
                            <button
                              onClick={() => deleteTask(task)}
                              style={{ background: '#fff5f5', color: '#C8102E', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                            >
                              🗑️ Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Hướng dẫn */}
          <div style={{ marginTop: '24px', background: '#fffbf0', border: '1px solid #f5c842', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 8px', color: '#856404', fontSize: '14px' }}>💡 Hướng dẫn cài đặt Checklist & Đơn vị đo lường</h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404', fontSize: '13px', lineHeight: '1.8' }}>
              <li><b>Đơn vị đo lường là tùy chọn:</b> Bạn có thể bật hoặc tắt đơn vị đo lường cho từng công việc.</li>
              <li><b>Tùy chỉnh đơn vị tự do:</b> Bạn có thể chọn nhanh các đơn vị có sẵn (Kg, Phút, Sản phẩm, Ca, Gói, Thùng, Ly, Hộp...) hoặc tự gõ bất kỳ đơn vị nào theo nhu cầu thực tế.</li>
              <li><b>Khi tắt đơn vị đo:</b> Nhân viên chỉ cần tích chọn hoàn thành công việc trước khi out ca mà không cần nhập số liệu.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Báo cáo sản xuất ──────────────────────────────── */}
      {activeTab === 'reports' && (
        <div>
          {/* Bộ lọc */}
          <div style={{
            display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center',
            background: '#fff', padding: '16px', borderRadius: '10px', border: '1px solid #eee',
          }}>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Tháng</label>
              <input
                type="month" value={reportMonth}
                onChange={e => setReportMonth(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>Nhân viên</label>
              <select
                value={filterUserId}
                onChange={e => setFilterUserId(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', minWidth: '160px' }}
              >
                <option value="">Tất cả nhân viên</option>
                {activeMembersList.map(m => (
                  <option key={m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                onClick={fetchReports}
                style={{ background: '#f0f4ff', color: '#3b5bdb', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
              >
                🔄 Tải lại
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || filteredReports.length === 0}
                style={{
                  background: '#1A6B5A', color: '#fff', border: 'none',
                  padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: 600, fontSize: '14px', opacity: (exporting || filteredReports.length === 0) ? 0.6 : 1,
                }}
              >
                {exporting ? '⏳ Đang xuất...' : '⬇️ Xuất Excel'}
              </button>
            </div>
          </div>

          {/* Thống kê nhanh */}
          {!reportLoading && filteredReports.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#C8102E' }}>{filteredReports.length}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Tổng lượt báo cáo</div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: '#1A6B5A' }}>
                  {new Set(filteredReports.map(r => r.userId)).size}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Nhân viên đã báo cáo</div>
              </div>
              {activeTasks.filter(t => t.unitLabel && t.unitLabel.trim().length > 0).slice(0, 2).map(task => {
                const total = filteredReports.reduce((sum, r) => {
                  const entry = r.tasks?.find(t => t.taskId === task.id);
                  return sum + (entry?.value || 0);
                }, 0);
                return (
                  <div key={task.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#1C4E6B' }}>{total.toLocaleString()}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Tổng {task.name} ({task.unitLabel})</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bảng báo cáo */}
          {reportLoading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
              <p>Đang tải dữ liệu...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <h3 style={{ color: '#999', fontWeight: 500 }}>Chưa có báo cáo nào</h3>
              <p style={{ color: '#bbb', fontSize: '14px' }}>Nhân viên chưa gửi báo cáo công việc cho tháng này</p>
              <p style={{ color: '#bbb', fontSize: '13px', marginTop: '8px' }}>
                (Báo cáo được tự động ghi nhận khi nhân viên hoàn thành checklist và out ca trên app)
              </p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #eee', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: `${400 + activeTasks.length * 140}px` }}>
                <thead>
                  <tr style={{ background: '#C8102E' }}>
                    {['Ngày', 'Tên NV', 'Ca làm', ...activeTasks.map(t => `${t.name}${t.unitLabel ? ` (${t.unitLabel})` : ''}`), 'Giờ out ca', 'Ghi chú', ''].map(h => (
                      <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report, idx) => (
                    <tr key={report.id} style={{ borderBottom: '1px solid #f5f5f5', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#555', whiteSpace: 'nowrap' }}>{report.date}</td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>
                        {members.find(m => m.userId === report.userId)?.name || report.memberName}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#555' }}>{report.shiftName}</td>
                      {activeTasks.map(task => {
                        const entry = report.tasks?.find(t => t.taskId === task.id);
                        if (!entry) {
                          return <td key={task.id} style={{ padding: '11px 14px', fontSize: '13px', textAlign: 'center', color: '#ccc' }}>—</td>;
                        }
                        const hasUnit = entry.unitLabel && entry.unitLabel.trim().length > 0;
                        return (
                          <td key={task.id} style={{ padding: '11px 14px', fontSize: '13px', textAlign: 'center' }}>
                            {hasUnit ? (
                              <span style={{ fontWeight: 600, color: '#1C4E6B' }}>
                                {entry.value} <span style={{ fontSize: '11px', color: '#999' }}>{entry.unitLabel}</span>
                              </span>
                            ) : (
                              <span style={{ fontWeight: 600, color: '#1A6B5A', background: '#e8f5e9', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                                ✓ Hoàn thành
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#555', textAlign: 'center' }}>
                        {formatCheckout(report.checkoutTime)}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: '13px', color: '#777', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {report.note || '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '16px' }}
                          title="Xóa báo cáo"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Modal thêm/sửa công việc ─────────────────────────────── */}
      {showTaskModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '28px',
            width: '480px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: 700 }}>
              {editingTask ? '✏️ Sửa công việc / Checklist' : '+ Thêm công việc / Checklist mới'}
            </h2>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '6px' }}>
                Tên công việc / Đầu mục checklist *
              </label>
              <input
                value={taskForm.name}
                onChange={e => setTaskForm(f => ({ ...f, name: e.target.value }))}
                placeholder="VD: Đóng gói sản phẩm, Lau dọn máy móc, Kiểm tra nguyên liệu..."
                style={{
                  width: '100%', padding: '10px 14px', border: '1.5px solid #ddd',
                  borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box',
                  outline: 'none',
                }}
                onFocus={e => e.target.style.borderColor = '#C8102E'}
                onBlur={e => e.target.style.borderColor = '#ddd'}
                autoFocus
              />
            </div>

            {/* Toggle sử dụng đơn vị đo */}
            <div style={{
              background: '#f8f9fa', padding: '14px 16px', borderRadius: '10px',
              border: '1px solid #e9ecef', marginBottom: '18px'
            }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', userSelect: 'none', fontSize: '14px', fontWeight: 600, color: '#333'
              }}>
                <input
                  type="checkbox"
                  checked={taskForm.hasUnit}
                  onChange={e => setTaskForm(f => ({ ...f, hasUnit: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#C8102E' }}
                />
                Yêu cầu nhập số lượng / Khối lượng / Thời gian khi out ca
              </label>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginLeft: '28px' }}>
                {taskForm.hasUnit
                  ? 'Nhân viên sẽ phải nhập số liệu cụ thể kèm đơn vị đo trước khi ra ca.'
                  : 'Không cần đơn vị đo: Nhân viên chỉ cần tích dấu hoàn thành công việc.'}
              </div>
            </div>

            {/* Nếu có đơn vị đo lường: chọn mẫu hoặc tự gõ tùy ý */}
            {taskForm.hasUnit && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '8px' }}>
                  Đơn vị đo lường (Tự do chỉnh sửa theo ý thích) *
                </label>
                
                {/* Input tùy chỉnh trực tiếp */}
                <div style={{ marginBottom: '10px' }}>
                  <input
                    value={taskForm.unitLabel}
                    onChange={e => setTaskForm(f => ({ ...f, unitLabel: e.target.value }))}
                    placeholder="Nhập đơn vị đo (VD: Kg, Gói, Thùng, Ly, Hộp, Mét, Bao...)"
                    style={{
                      width: '100%', padding: '10px 14px', border: '1.5px solid #C8102E',
                      borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box',
                      outline: 'none', fontWeight: 600, color: '#C8102E', background: '#fff9f9'
                    }}
                  />
                </div>

                {/* Các nút chọn nhanh */}
                <div>
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Hoặc chọn nhanh từ danh sách:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {COMMON_UNIT_PRESETS.map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setTaskForm(f => ({ ...f, unitLabel: u }))}
                        style={{
                          padding: '5px 12px',
                          border: `1px solid ${taskForm.unitLabel === u ? '#C8102E' : '#ddd'}`,
                          borderRadius: '16px',
                          background: taskForm.unitLabel === u ? '#C8102E' : '#fff',
                          color: taskForm.unitLabel === u ? '#fff' : '#444',
                          fontSize: '12px',
                          fontWeight: taskForm.unitLabel === u ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowTaskModal(false)}
                style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', background: '#fff', fontSize: '14px' }}
              >
                Hủy
              </button>
              <button
                onClick={saveTask}
                disabled={taskSaving || !taskForm.name.trim() || (taskForm.hasUnit && !taskForm.unitLabel.trim())}
                style={{
                  padding: '10px 24px', background: '#C8102E', color: '#fff',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: 600, fontSize: '14px',
                  opacity: (taskSaving || !taskForm.name.trim() || (taskForm.hasUnit && !taskForm.unitLabel.trim())) ? 0.6 : 1,
                }}
              >
                {taskSaving ? 'Đang lưu...' : editingTask ? 'Lưu thay đổi' : 'Thêm công việc'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
