'use client';
import { useState } from 'react';
import { useApp } from '../layout';
import { setMemberStatus, updateMemberRole, updateMemberSalary } from '@/lib/firestore';
import { Member } from '@/lib/types';

export default function MembersPage() {
  const { storeId, members } = useApp();
  const [activeTab, setActiveTab] = useState<'active'|'pending'>('active');
  const [editingSalary, setEditingSalary] = useState<Member | null>(null);

  // Edit salary state
  const [empType, setEmpType] = useState<'fulltime'|'parttime'>('fulltime');
  const [salaryAmt, setSalaryAmt] = useState(0);
  const [stdHours, setStdHours] = useState(208);
  const [saving, setSaving] = useState(false);

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending');

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!storeId) return;
    try {
      await updateMemberRole(storeId, userId, newRole);
    } catch (e) {
      alert('Lỗi khi đổi vai trò');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'active'|'kicked') => {
    if (!storeId) return;
    if (newStatus === 'kicked' && !confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) return;
    try {
      await setMemberStatus(storeId, userId, newStatus);
    } catch (e) {
      alert('Lỗi khi cập nhật trạng thái');
    }
  };

  const openSalaryModal = (m: Member) => {
    setEditingSalary(m);
    setEmpType(m.employeeType);
    setSalaryAmt(m.employeeType === 'fulltime' ? m.baseMonthlySalary : m.baseHourlyRate);
    setStdHours(m.standardHoursPerMonth || 208);
  };

  const saveSalary = async () => {
    if (!storeId || !editingSalary) return;
    setSaving(true);
    try {
      await updateMemberSalary(storeId, editingSalary.userId, empType, salaryAmt, stdHours);
      setEditingSalary(null);
    } catch (e) {
      alert('Lỗi khi lưu lương');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Quản lý Nhân viên</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Thêm, xóa và phân quyền nhân viên trong cửa hàng
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button 
          onClick={() => setActiveTab('active')}
          style={{ 
            background: activeTab === 'active' ? 'var(--neutral)' : 'transparent',
            color: activeTab === 'active' ? 'white' : 'var(--text-secondary)',
            padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14
          }}
        >
          Đang hoạt động ({activeMembers.length})
        </button>
        <button 
          onClick={() => setActiveTab('pending')}
          style={{ 
            background: activeTab === 'pending' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'pending' ? 'white' : 'var(--text-secondary)',
            padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14
          }}
        >
          Chờ xét duyệt ({pendingMembers.length})
        </button>
      </div>

      {activeTab === 'active' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Vai trò</th>
                <th>Loại hợp đồng</th>
                <th>Lương cơ bản</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map(m => (
                <tr key={m.userId}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar" style={{ width: 36, height: 36 }}>{m.name[0]}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.phone || 'Chưa cập nhật SĐT'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select 
                      className="select" 
                      style={{ padding: '6px 10px', fontSize: 13, width: 'auto' }}
                      value={m.role}
                      onChange={e => handleRoleChange(m.userId, e.target.value)}
                    >
                      <option value="employee">Nhân viên</option>
                      <option value="manager">Quản lý</option>
                      <option value="owner">Chủ</option>
                    </select>
                  </td>
                  <td>{m.employeeType === 'fulltime' ? 'Toàn thời gian' : 'Bán thời gian'}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {(m.employeeType === 'fulltime' ? m.baseMonthlySalary : m.baseHourlyRate).toLocaleString('vi-VN')} vnđ
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
                        {m.employeeType === 'fulltime' ? ' / tháng' : ' / giờ'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => openSalaryModal(m)}>Sửa lương</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)', borderColor: 'var(--primary-light)' }} onClick={() => handleStatusChange(m.userId, 'kicked')}>Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {activeMembers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chưa có nhân viên nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'pending' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {pendingMembers.map(m => (
            <div key={m.userId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="flex items-center gap-3">
                <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>{m.name[0]}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Đăng ký tham gia</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-success flex-1" style={{ justifyContent: 'center' }} onClick={() => handleStatusChange(m.userId, 'active')}>Phê duyệt</button>
                <button className="btn btn-ghost flex-1" style={{ justifyContent: 'center' }} onClick={() => handleStatusChange(m.userId, 'kicked')}>Từ chối</button>
              </div>
            </div>
          ))}
          {pendingMembers.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-text">Không có yêu cầu nào đang chờ</div>
            </div>
          )}
        </div>
      )}

      {/* Salary Modal */}
      {editingSalary && (
        <div className="modal-overlay" onClick={() => setEditingSalary(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Cài đặt lương: {editingSalary.name}</div>
              <button className="modal-close" onClick={() => setEditingSalary(null)}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label className="label">Loại hợp đồng</label>
                <select className="select" value={empType} onChange={e => setEmpType(e.target.value as any)}>
                  <option value="fulltime">Toàn thời gian (Lương tháng)</option>
                  <option value="parttime">Bán thời gian (Lương theo giờ)</option>
                </select>
              </div>
              <div>
                <label className="label">Mức lương (VNĐ)</label>
                <input 
                  type="number" 
                  className="input" 
                  value={salaryAmt}
                  onChange={e => setSalaryAmt(Number(e.target.value))}
                />
              </div>
              {empType === 'fulltime' && (
                <div>
                  <label className="label">Số giờ chuẩn / tháng</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={stdHours}
                    onChange={e => setStdHours(Number(e.target.value))}
                  />
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Mặc định: 208 giờ (26 ngày x 8 tiếng)
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-ghost" onClick={() => setEditingSalary(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={saveSalary} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
