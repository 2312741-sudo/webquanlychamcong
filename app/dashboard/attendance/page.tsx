'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import { getMonthAttendances, editAttendance, createManualAttendance, getSchedulesInRange } from '@/lib/firestore';
import { exportMonthlyAttendance } from '@/lib/exportExcel';
import { AttendanceRecord, ScheduleModel } from '@/lib/types';

export default function AttendancePage() {
  const { storeId, members, currentUser, store } = useApp();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleModel[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingCell, setEditingCell] = useState<{
    userId: string;
    date: string;
    att?: AttendanceRecord;
  } | null>(null);

  const [editForm, setEditForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    note: ''
  });

  const activeMembers = members.filter(m => m.status === 'active');

  useEffect(() => {
    if (!storeId || !currentMonth) return;
    setLoading(true);
    
    const [year, month] = currentMonth.split('-').map(Number);
    const startObj = new Date(year, month - 1, -7);
    const endObj = new Date(year, month, 7);
    const startStr = startObj.toISOString().slice(0, 10);
    const endStr = endObj.toISOString().slice(0, 10);

    Promise.all([
      getMonthAttendances(storeId, currentMonth),
      getSchedulesInRange(storeId, startStr, endStr)
    ]).then(([atts, scheds]) => {
      setAttendances(atts);
      setSchedules(scheds);
    }).finally(() => setLoading(false));
  }, [storeId, currentMonth]);

  const [year, mon] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return `${currentMonth}-${String(day).padStart(2, '0')}`;
  });

  const handleExport = () => {
    if (!store) return;
    exportMonthlyAttendance(activeMembers, attendances, currentMonth, store, schedules);
  };

  const openEditModal = (userId: string, date: string, att?: AttendanceRecord) => {
    setEditingCell({ userId, date, att });
    if (att && att.checkOut) {
      const ci = new Date(att.checkIn.seconds * 1000);
      const co = new Date(att.checkOut.seconds * 1000);
      setEditForm({
        checkInTime: `${String(ci.getHours()).padStart(2,'0')}:${String(ci.getMinutes()).padStart(2,'0')}`,
        checkOutTime: `${String(co.getHours()).padStart(2,'0')}:${String(co.getMinutes()).padStart(2,'0')}`,
        note: att.editNote || ''
      });
    } else {
      setEditForm({ checkInTime: '', checkOutTime: '', note: '' });
    }
  };

  const saveEdit = async () => {
    if (!editingCell || !storeId) return;
    if (!editForm.checkInTime || !editForm.checkOutTime) {
      alert('Vui lòng nhập giờ vào và giờ ra');
      return;
    }

    const { userId, date, att } = editingCell;
    const [inH, inM] = editForm.checkInTime.split(':').map(Number);
    const [outH, outM] = editForm.checkOutTime.split(':').map(Number);
    
    const [y, m, d] = date.split('-').map(Number);
    const ciDate = new Date(y, m - 1, d, inH, inM);
    const coDate = new Date(y, m - 1, d, outH, outM);
    if (coDate < ciDate) {
      coDate.setDate(coDate.getDate() + 1); // qua đêm
    }

    try {
      if (att) {
        await editAttendance(storeId, att.id, ciDate, coDate, editForm.note, currentUser?.name || 'Admin');
      } else {
        await createManualAttendance(storeId, userId, date, ciDate, coDate, editForm.note, currentUser?.name || 'Admin');
      }
      alert('Đã lưu');
      setEditingCell(null);
      // Reload
      const data = await getMonthAttendances(storeId, currentMonth);
      setAttendances(data);
    } catch (e) {
      alert('Lỗi khi lưu');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Bảng công</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Theo dõi giờ làm thực tế của nhân viên
          </p>
        </div>
        <div className="flex gap-3">
          <input 
            type="month" 
            className="input" 
            value={currentMonth}
            onChange={e => setCurrentMonth(e.target.value)}
            style={{ width: 150 }}
          />
          <button onClick={handleExport} className="btn btn-primary" style={{ background: 'var(--success)' }}>
            📥 Xuất Excel
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner spinner-primary" /></div>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
            <table className="table" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--background)' }}>
                <tr>
                  <th style={{ minWidth: 150, position: 'sticky', left: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>Nhân viên</th>
                  <th style={{ minWidth: 80, textAlign: 'center' }}>Tổng giờ</th>
                  {daysArray.map((dateStr, i) => (
                    <th key={dateStr} style={{ minWidth: 50, textAlign: 'center', padding: '12px 4px' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Ngày</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{i + 1}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeMembers.map(m => {
                  const memberAtts = attendances.filter(a => a.userId === m.userId);
                  const totalHours = memberAtts.reduce((sum, a) => sum + (a.totalHours || 0), 0);
                  
                  return (
                    <tr key={m.userId}>
                      <td style={{ position: 'sticky', left: 0, background: 'white', borderRight: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {m.role === 'owner' ? 'Chủ' : m.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)' }}>
                        {totalHours.toFixed(1)}h
                      </td>
                      {daysArray.map(dateStr => {
                        const att = memberAtts.find(a => a.date === dateStr);
                        const isEdited = att?.isEdited;
                        const hasHours = att && att.totalHours > 0;
                        
                        return (
                          <td 
                            key={dateStr} 
                            style={{ 
                              textAlign: 'center', 
                              padding: 4,
                              background: hasHours ? 'var(--success-light)' : 'transparent',
                              cursor: 'pointer'
                            }}
                            onClick={() => openEditModal(m.userId, dateStr, att)}
                            title={isEdited ? `Đã sửa bởi: ${att.editedBy}` : ''}
                          >
                            {hasHours ? (
                              <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: 13 }}>
                                {att.totalHours.toFixed(1)}h
                                {isEdited && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}
                              </div>
                            ) : (
                              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {activeMembers.length === 0 && (
                  <tr>
                    <td colSpan={daysArray.length + 2} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                      Không có nhân viên hoạt động
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingCell && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: 'white', padding: 24, borderRadius: 16, width: 400 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Chỉnh sửa chấm công</h3>
            <p style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>
              Ngày: {editingCell.date}
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="label">Giờ vào</label>
                <input 
                  type="time" 
                  className="input" 
                  value={editForm.checkInTime}
                  onChange={e => setEditForm({...editForm, checkInTime: e.target.value})}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Giờ ra</label>
                <input 
                  type="time" 
                  className="input" 
                  value={editForm.checkOutTime}
                  onChange={e => setEditForm({...editForm, checkOutTime: e.target.value})}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="label">Lý do chỉnh sửa</label>
              <input 
                type="text" 
                className="input" 
                placeholder="VD: Quên chấm công ra"
                value={editForm.note}
                onChange={e => setEditForm({...editForm, note: e.target.value})}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setEditingCell(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={saveEdit}>Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
