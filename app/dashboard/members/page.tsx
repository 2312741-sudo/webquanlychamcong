'use client';
import { useState } from 'react';
import { useApp } from '../layout';
import { setMemberStatus, updateMemberRole, updateMemberSalary, updateMemberInfo, updateMemberOrder, toggleHideMemberSchedule } from '@/lib/firestore';
import { Member, UserRole, getRoleLabel, normalizeRole, formatJoinedDate, canApproveMembers, sortMembersByOrder } from '@/lib/types';

export default function MembersPage() {
  const { storeId, store, members, role } = useApp();
  const [activeTab, setActiveTab] = useState<'active'|'pending'>('active');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [editingSalary, setEditingSalary] = useState<Member | null>(null);

  // Edit salary/info state
  const [empType, setEmpType] = useState<'fulltime'|'parttime'>('fulltime');
  const [salaryAmt, setSalaryAmt] = useState(0);
  const [stdHours, setStdHours] = useState(208);
  const [employeeCode, setEmployeeCode] = useState('');
  const [joinedAt, setJoinedAt] = useState('');
  const [hideSchedule, setHideSchedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const isOwner = normalizeRole(role) === 'owner';
  const canApprove = canApproveMembers(role);

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending');

  const sortedActiveMembers = sortMembersByOrder(activeMembers, store?.memberOrder);

  const filteredActiveMembers = sortedActiveMembers.filter(m => {
    const norm = normalizeRole(m.role);
    if (roleFilter === 'all') return true;
    if (roleFilter === 'owner') return norm === 'owner';
    if (roleFilter === 'manager1') return norm === 'manager1';
    if (roleFilter === 'manager2') return norm === 'manager2';
    if (roleFilter === 'employee') return norm === 'employee';
    return true;
  });

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!storeId || !isOwner) return;
    try {
      const firestoreRole = newRole === 'manager1' ? 'manager_1' : newRole === 'manager2' ? 'manager_2' : newRole;
      await updateMemberRole(storeId, userId, firestoreRole);
    } catch (e) {
      alert('Lỗi khi đổi vai trò');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'active'|'kicked') => {
    if (!storeId || !canApprove) return;
    if (newStatus === 'kicked' && !confirm('Bạn có chắc chắn muốn xóa/từ chối nhân viên này?')) return;
    try {
      await setMemberStatus(storeId, userId, newStatus);
    } catch (e) {
      alert('Lỗi khi cập nhật trạng thái');
    }
  };

  const handleToggleHide = async (userId: string, currentlyHidden: boolean) => {
    if (!storeId || !isOwner) return;
    try {
      await toggleHideMemberSchedule(storeId, userId, !currentlyHidden);
    } catch (e) {
      alert('Lỗi khi thay đổi trạng thái ẩn lịch');
    }
  };

  const handleMoveOrder = async (fromIdx: number, toIdx: number) => {
    if (!storeId || !isOwner || toIdx < 0 || toIdx >= sortedActiveMembers.length) return;
    const items = [...sortedActiveMembers];
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    const newOrder = items.map(m => m.userId);
    try {
      await updateMemberOrder(storeId, newOrder);
    } catch (e) {
      alert('Lỗi khi lưu thứ tự nhân viên');
    }
  };

  const openSalaryModal = (m: Member) => {
    setEditingSalary(m);
    setEmpType(m.employeeType || 'fulltime');
    setSalaryAmt(m.employeeType === 'fulltime' ? m.baseMonthlySalary : m.baseHourlyRate);
    setStdHours(m.standardHoursPerMonth || 208);
    setEmployeeCode(m.employeeCode || '');
    setJoinedAt(m.joinedAt || '');
    setHideSchedule((store?.hiddenScheduleUserIds || []).includes(m.userId));
  };

  const saveSalary = async () => {
    if (!storeId || !editingSalary || !isOwner) return;
    setSaving(true);
    try {
      await updateMemberSalary(storeId, editingSalary.userId, empType, salaryAmt, stdHours);
      await updateMemberInfo(storeId, editingSalary.userId, { employeeCode, joinedAt });
      await toggleHideMemberSchedule(storeId, editingSalary.userId, hideSchedule);
      setEditingSalary(null);
    } catch (e) {
      alert('Lỗi khi lưu thông tin');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeStyle = (memberRole: UserRole | string) => {
    const norm = normalizeRole(memberRole);
    switch (norm) {
      case 'owner':
        return { background: '#FFF5F5', color: '#C8102E', border: '1px solid #FFC9C9' };
      case 'manager1':
        return { background: '#E7F5FF', color: '#1C7ED6', border: '1px solid #A5D8FF' };
      case 'manager2':
        return { background: '#E6FCF5', color: '#0CA678', border: '1px solid #96F2D7' };
      case 'employee':
      default:
        return { background: '#F8F9FA', color: '#495057', border: '1px solid #CED4DA' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Quản lý Nhân viên</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Danh sách thành viên, phân quyền Quản lý 1/2 và xét duyệt thành viên
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            onClick={() => setActiveTab('active')}
            style={{ 
              background: activeTab === 'active' ? 'var(--neutral)' : 'transparent',
              color: activeTab === 'active' ? 'white' : 'var(--text-secondary)',
              padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14,
              border: 'none', cursor: 'pointer'
            }}
          >
            Đang hoạt động ({activeMembers.length})
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            style={{ 
              background: activeTab === 'pending' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'pending' ? 'white' : 'var(--text-secondary)',
              padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14,
              border: 'none', cursor: 'pointer'
            }}
          >
            Chờ xét duyệt ({pendingMembers.length})
          </button>
        </div>

        {activeTab === 'active' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'owner', label: 'Chủ' },
              { key: 'manager1', label: 'Quản lý 1' },
              { key: 'manager2', label: 'Quản lý 2' },
              { key: 'employee', label: 'Nhân viên' },
            ].map(chip => (
              <button
                key={chip.key}
                onClick={() => setRoleFilter(chip.key)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 16,
                  fontSize: 12,
                  fontWeight: roleFilter === chip.key ? 700 : 500,
                  background: roleFilter === chip.key ? 'var(--primary)' : 'var(--surface)',
                  color: roleFilter === chip.key ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${roleFilter === chip.key ? 'var(--primary)' : 'var(--border)'}`,
                  cursor: 'pointer'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'active' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                {isOwner && roleFilter === 'all' && <th style={{ width: 40, textAlign: 'center' }}>Thứ tự</th>}
                <th>Nhân viên</th>
                <th>Mã NV / Ngày vào</th>
                <th>Vai trò</th>
                <th>Loại hợp đồng</th>
                <th>Lương cơ bản</th>
                {isOwner && <th style={{ textAlign: 'center' }}>Lịch cửa hàng</th>}
                {isOwner && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {filteredActiveMembers.map((m, idx) => {
                const currentRoleValue = normalizeRole(m.role);
                const badgeStyle = getRoleBadgeStyle(m.role);
                const isHidden = (store?.hiddenScheduleUserIds || []).includes(m.userId);

                return (
                  <tr 
                    key={m.userId}
                    draggable={isOwner && roleFilter === 'all'}
                    onDragStart={() => setDraggedIdx(idx)}
                    onDragOver={(e) => {
                      if (isOwner && roleFilter === 'all') e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIdx !== null && draggedIdx !== idx) {
                        handleMoveOrder(draggedIdx, idx);
                      }
                      setDraggedIdx(null);
                    }}
                    style={{
                      background: draggedIdx === idx ? 'rgba(200, 16, 46, 0.05)' : undefined,
                      transition: 'background 0.2s'
                    }}
                  >
                    {isOwner && roleFilter === 'all' && (
                      <td style={{ textAlign: 'center', width: 60 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                          <button 
                            type="button" 
                            title="Di chuyển lên"
                            disabled={idx === 0}
                            onClick={() => handleMoveOrder(idx, idx - 1)}
                            style={{ border: 'none', background: 'transparent', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.2 : 0.7, padding: '2px 4px', fontSize: 11 }}
                          >▲</button>
                          <span style={{ cursor: 'grab', fontSize: 14, opacity: 0.5, userSelect: 'none' }} title="Kéo để đổi thứ tự">☰</span>
                          <button 
                            type="button" 
                            title="Di chuyển xuống"
                            disabled={idx === filteredActiveMembers.length - 1}
                            onClick={() => handleMoveOrder(idx, idx + 1)}
                            style={{ border: 'none', background: 'transparent', cursor: idx === filteredActiveMembers.length - 1 ? 'default' : 'pointer', opacity: idx === filteredActiveMembers.length - 1 ? 0.2 : 0.7, padding: '2px 4px', fontSize: 11 }}
                          >▼</button>
                        </div>
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-3">
                        {m.avatarUrl ? (
                          <img
                            src={m.avatarUrl}
                            alt={m.name}
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                          />
                        ) : (
                          <div className="avatar" style={{ width: 36, height: 36 }}>{m.name[0]}</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            {m.name}
                            {isHidden && (
                              <span style={{ fontSize: 10, background: '#FFF3BF', color: '#D9480F', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                Ẩn lịch
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.phone || 'Chưa cập nhật SĐT'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--neutral)' }}>{m.employeeCode || '-'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {formatJoinedDate(m.joinedAt)}
                      </div>
                    </td>
                    <td>
                      {isOwner ? (
                        <select 
                          className="select" 
                          style={{ padding: '6px 10px', fontSize: 13, width: 'auto', fontWeight: 600 }}
                          value={currentRoleValue}
                          onChange={e => handleRoleChange(m.userId, e.target.value)}
                        >
                          <option value="employee">Nhân viên</option>
                          <option value="manager1">Quản lý 1 (Xếp lịch & Duyệt NV)</option>
                          <option value="manager2">Quản lý 2 (Xem lịch)</option>
                          <option value="owner">Chủ</option>
                        </select>
                      ) : (
                        <span style={{
                          padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                          ...badgeStyle
                        }}>
                          {getRoleLabel(m.role)}
                        </span>
                      )}
                    </td>
                    <td>{m.employeeType === 'fulltime' ? 'Toàn thời gian' : 'Bán thời gian'}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {(m.employeeType === 'fulltime' ? (m.baseMonthlySalary || 0) : (m.baseHourlyRate || 0)).toLocaleString('vi-VN')} vnđ
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {m.employeeType === 'fulltime' ? ' / tháng' : ' / giờ'}
                        </span>
                      </div>
                    </td>
                    {isOwner && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleHide(m.userId, isHidden)}
                          title={isHidden ? "Đang ẩn khỏi Lịch cửa hàng (Chỉ Chủ thấy). Bấm để hiện lại." : "Đang hiện trên Lịch cửa hàng. Bấm để ẩn khỏi người khác."}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            border: `1px solid ${isHidden ? '#FFC9C9' : '#D0EBFF'}`,
                            background: isHidden ? '#FFF5F5' : '#E7F5FF',
                            color: isHidden ? '#C8102E' : '#1C7ED6',
                            cursor: 'pointer'
                          }}
                        >
                          {isHidden ? '🙈 Đã ẩn lịch' : '👁️ Hiện lịch'}
                        </button>
                      </td>
                    )}
                    {isOwner && (
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => openSalaryModal(m)}>Cài đặt</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)', borderColor: 'var(--primary-light)' }} onClick={() => handleStatusChange(m.userId, 'kicked')}>Xóa</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredActiveMembers.length === 0 && (
                <tr><td colSpan={isOwner ? 8 : 5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Không có nhân viên nào phù hợp</td></tr>
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
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Đăng ký xin vào cửa hàng</div>
                  {m.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>SĐT: {m.phone}</div>}
                </div>
              </div>
              {canApprove ? (
                <div className="flex gap-2">
                  <button className="btn btn-success flex-1" style={{ justifyContent: 'center' }} onClick={() => handleStatusChange(m.userId, 'active')}>Phê duyệt</button>
                  <button className="btn btn-ghost flex-1" style={{ justifyContent: 'center', color: 'var(--danger)' }} onClick={() => handleStatusChange(m.userId, 'kicked')}>Từ chối</button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Chỉ Chủ quán và Quản lý 1 mới có quyền duyệt thành viên
                </div>
              )}
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
      {editingSalary && isOwner && (
        <div className="modal-overlay" onClick={() => setEditingSalary(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Cài đặt nhân viên: {editingSalary.name}</div>
              <button className="modal-close" onClick={() => setEditingSalary(null)}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Mã nhân viên</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="VD: NV001"
                    value={employeeCode}
                    onChange={e => setEmployeeCode(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Ngày vào làm</label>
                  <input 
                    type="date" 
                    className="input" 
                    value={joinedAt}
                    onChange={e => setJoinedAt(e.target.value)}
                  />
                </div>
              </div>

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

              {/* Hide schedule checkbox */}
              <div style={{ padding: '12px 16px', background: '#F8F9FA', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--neutral)' }}>Ẩn lịch trên tab Lịch cửa hàng</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Khi bật, chỉ Chủ cửa hàng mới nhìn thấy lịch của nhân viên này</div>
                </div>
                <input 
                  type="checkbox" 
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                  checked={hideSchedule}
                  onChange={e => setHideSchedule(e.target.checked)}
                />
              </div>
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
