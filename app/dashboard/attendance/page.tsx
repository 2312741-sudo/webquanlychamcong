'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../layout';
import { getMonthAttendances, getMemberMonthAttendances, editAttendance, createManualAttendance, getSchedulesInRange, getAttendancesInRange } from '@/lib/firestore';
import { exportMonthlyAttendance, exportDetailedInOut } from '@/lib/exportExcel';
import { AttendanceRecord, ScheduleModel, canViewAllAttendance, canEditAttendance } from '@/lib/types';
import ExportModal from '../components/ExportModal';

export default function AttendancePage() {
  const { storeId, members, user, store, role } = useApp();
  const canView = canViewAllAttendance(role);
  const canEdit = canEditAttendance(role);
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

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'summary'|'detailed'>('summary');

  const [editForm, setEditForm] = useState({
    checkInDate: '',
    checkInTime: '',
    checkOutDate: '',
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

    const fetchAtts = canView
      ? getMonthAttendances(storeId, currentMonth)
      : (user ? getMemberMonthAttendances(storeId, user.uid, currentMonth) : Promise.resolve([]));

    Promise.all([
      fetchAtts,
      getSchedulesInRange(storeId, startStr, endStr)
    ]).then(([atts, scheds]) => {
      setAttendances(atts);
      setSchedules(scheds);
    }).finally(() => setLoading(false));
  }, [storeId, currentMonth, canView, user]);

  const [year, mon] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return `${currentMonth}-${String(day).padStart(2, '0')}`;
  });

  const handleExportSummary = () => {
    setExportMode('summary');
    setIsExportModalOpen(true);
  };

  const handleExportDetailed = () => {
    setExportMode('detailed');
    setIsExportModalOpen(true);
  };

  const handleExportConfirm = async (filters: { memberId?: string, type: 'month' | 'range', month?: string, startDate?: string, endDate?: string }) => {
    if (!store || !storeId) return;
    try {
      setLoading(true);
      const filteredMembers = filters.memberId 
        ? activeMembers.filter(m => m.userId === filters.memberId)
        : activeMembers;
        
      let dataAttendances: AttendanceRecord[] = [];
      let startObj: Date | undefined;
      let endObj: Date | undefined;
      
      if (filters.type === 'month' && filters.month) {
        dataAttendances = filters.month === currentMonth ? attendances : await getMonthAttendances(storeId, filters.month);
      } else if (filters.type === 'range' && filters.startDate && filters.endDate) {
        dataAttendances = await getAttendancesInRange(storeId, filters.startDate, filters.endDate);
        startObj = new Date(filters.startDate);
        endObj = new Date(filters.endDate);
      }
      
      const selectedMemberName = filters.memberId ? filteredMembers[0]?.name : undefined;
      const monthParam = filters.type === 'month' ? filters.month! : currentMonth;

      if (exportMode === 'summary') {
        await exportMonthlyAttendance(filteredMembers, dataAttendances, monthParam, store, schedules, { 
          startDate: startObj, 
          endDate: endObj,
          memberName: selectedMemberName
        });
      } else {
        if (store) {
          await exportDetailedInOut(filteredMembers, dataAttendances, monthParam, store, {
            startDate: startObj,
            endDate: endObj,
            memberName: selectedMemberName
          });
        }
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi xuất dữ liệu: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (userId: string, date: string, att?: AttendanceRecord) => {
    if (!canEdit) return;
    setEditingCell({ userId, date, att });
    if (att) {
      const ci = att.checkIn ? new Date(att.checkIn.seconds ? att.checkIn.seconds * 1000 : att.checkIn) : null;
      const co = att.checkOut ? new Date(att.checkOut.seconds ? att.checkOut.seconds * 1000 : att.checkOut) : null;
      setEditForm({
        checkInDate: ci ? `${ci.getFullYear()}-${String(ci.getMonth() + 1).padStart(2,'0')}-${String(ci.getDate()).padStart(2,'0')}` : date,
        checkInTime: ci ? `${String(ci.getHours()).padStart(2,'0')}:${String(ci.getMinutes()).padStart(2,'0')}` : '',
        checkOutDate: co ? `${co.getFullYear()}-${String(co.getMonth() + 1).padStart(2,'0')}-${String(co.getDate()).padStart(2,'0')}` : date,
        checkOutTime: co ? `${String(co.getHours()).padStart(2,'0')}:${String(co.getMinutes()).padStart(2,'0')}` : '',
        note: att.editNote || ''
      });
    } else {
      setEditForm({ checkInDate: date, checkInTime: '', checkOutDate: date, checkOutTime: '', note: '' });
    }
  };

  const saveEdit = async () => {
    if (!canEdit) {
      alert('Bạn không có quyền chỉnh sửa giờ công của nhân viên.');
      return;
    }
    if (!editingCell || !storeId) return;
    if (!editForm.checkInTime || !editForm.checkOutTime) {
      alert('Vui lòng nhập giờ vào và giờ ra');
      return;
    }

    const { userId, date, att } = editingCell;
    const [inH, inM] = editForm.checkInTime.split(':').map(Number);
    const [outH, outM] = editForm.checkOutTime.split(':').map(Number);
    const [inY, inMon, inD] = editForm.checkInDate.split('-').map(Number);
    const [outY, outMon, outD] = editForm.checkOutDate.split('-').map(Number);
    
    const ciDate = new Date(inY, inMon - 1, inD, inH, inM);
    const coDate = new Date(outY, outMon - 1, outD, outH, outM);

    if (coDate < ciDate) {
      alert('Giờ ra không thể trước giờ vào');
      return;
    }

    const assignedDate = editForm.checkInDate;

    try {
      if (att) {
        await editAttendance(storeId, att.id, assignedDate, ciDate, coDate, editForm.note, user?.displayName || 'Admin');
      } else {
        await createManualAttendance(storeId, userId, assignedDate, ciDate, coDate, editForm.note, user?.displayName || 'Admin');
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

  if (!canView) {
    const myAtts = attendances;
    const totalHours = myAtts.reduce((sum, a) => sum + (a.totalHours || 0), 0);
    const completedShifts = myAtts.filter(a => a.checkOut).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Quick check-in banner */}
        <div style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, #15803d 100%)',
          color: 'white',
          padding: '20px 24px',
          borderRadius: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Chấm Công Hôm Nay</h2>
            <p style={{ margin: '4px 0 0 0', opacity: 0.85, fontSize: 13 }}>
              Vào ca và kết thúc ca làm việc trực tuyến ngay trên web
            </p>
          </div>
          <Link
            href="/dashboard/checkin"
            style={{
              background: 'white',
              color: 'var(--primary)',
              padding: '10px 20px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <span>⏰</span>
            <span>Chấm công ngay →</span>
          </Link>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Bảng công cá nhân</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
              Xem chi tiết số giờ công bạn đã làm việc trong tháng
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
          </div>
        </div>

        {/* Monthly Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>TỔNG GIỜ CÔNG THÁNG</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)', marginTop: 6 }}>
              {totalHours.toFixed(1)}h
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Tháng {currentMonth}</div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>SỐ CA ĐÃ HOÀN THÀNH</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--neutral)', marginTop: 6 }}>
              {completedShifts} ca
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>Tổng lượt hoàn thành</div>
          </div>
        </div>

        {/* Day-by-day table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner spinner-primary" /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Ngày</th>
                    <th>Trạng thái</th>
                    <th>Giờ vào</th>
                    <th>Giờ ra</th>
                    <th>Phương thức</th>
                    <th style={{ textAlign: 'right' }}>Số giờ</th>
                  </tr>
                </thead>
                <tbody>
                  {daysArray.map(dateStr => {
                    const dayAtts = myAtts.filter(a => a.date === dateStr);
                    const d = new Date(dateStr);
                    const dayName = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d.getDay()];

                    if (dayAtts.length === 0) {
                      return (
                        <tr key={dateStr} style={{ opacity: 0.6 }}>
                          <td>{dateStr} ({dayName})</td>
                          <td style={{ color: 'var(--text-secondary)' }}>Nghỉ</td>
                          <td>--:--</td>
                          <td>--:--</td>
                          <td>--</td>
                          <td style={{ textAlign: 'right' }}>0.0h</td>
                        </tr>
                      );
                    }

                    return dayAtts.map((att, aIdx) => {
                      const ci = att.checkIn ? (att.checkIn.toDate ? att.checkIn.toDate() : new Date(att.checkIn.seconds * 1000)) : null;
                      const co = att.checkOut ? (att.checkOut.toDate ? att.checkOut.toDate() : new Date(att.checkOut.seconds * 1000)) : null;
                      const inStr = ci ? ci.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                      const outStr = co ? co.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : (att.checkOut === null ? 'Đang làm việc...' : '--:--');

                      return (
                        <tr key={att.id} style={{ background: !att.checkOut ? 'var(--primary-light)' : undefined }}>
                          <td style={{ fontWeight: 600 }}>{dateStr} ({dayName}) {dayAtts.length > 1 ? `(Ca ${aIdx + 1})` : ''}</td>
                          <td>
                            {!att.checkOut ? (
                              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>🟢 Đang làm</span>
                            ) : (
                              <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Hoàn thành</span>
                            )}
                          </td>
                          <td>{inStr}</td>
                          <td>{outStr}</td>
                          <td>{att.checkInMethod === 'wifi' ? '📶 WiFi' : att.checkInMethod === 'gps' ? '📍 GPS' : att.checkInMethod === 'manual' ? '✏️ Thủ công' : att.checkInMethod}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                            {(att.totalHours || 0).toFixed(2)}h
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Bảng công</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Theo dõi giờ làm thực tế của nhân viên
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <Link href="/dashboard/checkin" className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏰</span> Chấm công của bạn
          </Link>
          <input 
            type="month" 
            className="input" 
            value={currentMonth}
            onChange={e => setCurrentMonth(e.target.value)}
            style={{ width: 150 }}
          />
          <button onClick={handleExportSummary} className="btn btn-primary" style={{ background: 'var(--success)' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>download</span> Tổng Hợp
          </button>
          <button onClick={handleExportDetailed} className="btn btn-primary" style={{ background: 'var(--accent)' }}>
            <span className="material-icons" style={{ fontSize: 18 }}>download</span> IN-OUT
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
              Ngày ban đầu: {editingCell.date}
            </p>

            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="label">Ngày vào</label>
                <input 
                  type="date" 
                  className="input" 
                  value={editForm.checkInDate}
                  onChange={e => setEditForm({...editForm, checkInDate: e.target.value})}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Giờ vào</label>
                <input 
                  type="time" 
                  className="input" 
                  value={editForm.checkInTime}
                  onChange={e => setEditForm({...editForm, checkInTime: e.target.value})}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="label">Ngày ra</label>
                <input 
                  type="date" 
                  className="input" 
                  value={editForm.checkOutDate}
                  onChange={e => setEditForm({...editForm, checkOutDate: e.target.value})}
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
      
      <ExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        members={activeMembers}
        onExport={handleExportConfirm}
        title={exportMode === 'summary' ? "Xuất Bảng Công Tổng Hợp" : "Xuất Bảng Công Chi Tiết (IN/OUT)"}
      />
    </div>
  );
}
