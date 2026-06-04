'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import { getMonthAttendances, getSchedulesInRange, watchAdvances, createAdvanceRequest, updateAdvanceRequestStatus } from '@/lib/firestore';
import { exportMonthlySalary } from '@/lib/exportExcel';
import { AttendanceRecord, ScheduleModel, DaySchedule, AdvanceRequest } from '@/lib/types';
import { auth } from '@/lib/firebase';

export default function SalaryPage() {
  const { storeId, store, members } = useApp();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleModel[]>([]);
  const [advances, setAdvances] = useState<AdvanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNote, setAdvanceNote] = useState('');
  const currentUser = auth.currentUser;
  
  const currentMember = currentUser ? members.find(m => m.userId === currentUser.uid) : null;
  const isOwner = currentMember?.role === 'owner';

  const activeMembers = members.filter(m => m.status === 'active');

  useEffect(() => {
    if (!storeId || !currentMonth) return;
    setLoading(true);
    
    // Calculate a safe range for schedules (e.g. from 1 week before the month to end of month)
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

    const unsubscribeAdvances = watchAdvances(storeId, currentMonth, (advs) => {
      setAdvances(advs);
    });

    return () => unsubscribeAdvances();
  }, [storeId, currentMonth]);

  const getDeliveryShiftsCount = (userId: string) => {
    const DAY_KEYS: (keyof DaySchedule)[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    
    let count = 0;
    const [yearStr, monthStr] = currentMonth.split('-');
    
    // We count deliveries only for dates that fall exactly in `currentMonth`
    schedules.forEach(sched => {
      const weekStart = new Date(sched.weekStart);
      const userShifts = sched.shifts[userId];
      if (!userShifts) return;

      DAY_KEYS.forEach((dayKey, i) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        
        // Check if date is within current month
        if (date.getFullYear() === Number(yearStr) && date.getMonth() + 1 === Number(monthStr)) {
          const shiftVal = userShifts[dayKey] || [];
          const arr = Array.isArray(shiftVal) ? shiftVal : (shiftVal === 'off' ? [] : [shiftVal as string]);
          
          const validIds = new Set((store?.customShifts || []).map(s => s.id));
          const hasValidNormalShift = arr.some(id => {
            const baseId = id.split('|')[0];
            return baseId !== 'delivery' && validIds.has(baseId);
          });
          if (arr.includes('delivery') && hasValidNormalShift) {
            count++;
          }
        }
      });
    });
    return count;
  };

  const handleExport = () => {
    if (!store) return;
    // We pass schedules down to the export function so it can calculate delivery pay
    exportMonthlySalary(activeMembers, attendances, currentMonth, store, schedules, advances);
  };

  let totalPayout = 0;
  let totalHoursAll = 0;
  let totalDeliveries = 0;

  const rows = activeMembers.map(m => {
    const memberAtts = attendances.filter(a => a.userId === m.userId);
    const totalHours = memberAtts.reduce((sum, a) => sum + (a.totalHours || 0), 0);
    totalHoursAll += totalHours;

    let calculatedSalary = 0;
    if (m.employeeType === 'fulltime') {
      calculatedSalary = m.baseMonthlySalary * (totalHours / (m.standardHoursPerMonth || 208));
    } else {
      calculatedSalary = totalHours * m.baseHourlyRate;
    }
    
    const deliveryCount = getDeliveryShiftsCount(m.userId);
    const deliveryPay = deliveryCount * (store?.deliveryAllowance || 0);
    totalDeliveries += deliveryCount;
    calculatedSalary += deliveryPay;
    
    totalPayout += calculatedSalary;

    let totalAdvance = advances
      .filter(a => a.userId === m.userId && a.status === 'approved')
      .reduce((sum, a) => sum + a.amount, 0);

    const netSalary = calculatedSalary - totalAdvance;

    return {
      ...m,
      totalHours,
      calculatedSalary,
      deliveryCount,
      deliveryPay,
      totalAdvance,
      netSalary,
      baseSalaryStr: m.employeeType === 'fulltime' ? m.baseMonthlySalary : m.baseHourlyRate
    };
  });

  const handleRequestAdvance = async () => {
    if (!storeId || !currentUser || !advanceAmount) return;
    const amountNum = parseInt(advanceAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    await createAdvanceRequest(storeId, {
      userId: currentUser.uid,
      storeId: storeId,
      month: currentMonth,
      amount: amountNum,
      status: 'pending',
      requestDate: new Date().toISOString(),
      note: advanceNote
    });

    setShowAdvanceModal(false);
    setAdvanceAmount('');
    setAdvanceNote('');
    alert('Đã gửi yêu cầu ứng lương thành công!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Báo cáo lương</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Tổng hợp lương tháng của toàn bộ nhân viên
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
          {!isOwner && (
            <button onClick={() => setShowAdvanceModal(true)} className="btn btn-secondary">
              💵 Xin ứng lương
            </button>
          )}
          <button onClick={handleExport} className="btn btn-primary" style={{ background: 'var(--success)' }}>
            📥 Xuất Excel
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--info-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👥</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>NHÂN VIÊN</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{activeMembers.length}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⏱️</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>GIỜ CÔNG</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{totalHoursAll.toFixed(1)}h</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FFF3CD', color: '#856404', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📦</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>CHỞ HÀNG</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{totalDeliveries} ca</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💰</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>TỔNG LƯƠNG TRẢ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
              {Math.round(totalPayout).toLocaleString('vi-VN')} vnđ
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner spinner-primary" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Loại HĐ</th>
                  <th>Tổng giờ</th>
                  <th>Lương cơ bản</th>
                  <th>Phụ cấp chở hàng</th>
                  <th>Đã tạm ứng</th>
                  <th>Lương thực nhận</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.userId}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{row.name[0]}</div>
                        <div>
                          <span style={{ fontWeight: 600 }}>{row.name}</span>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {row.role === 'owner' ? 'Chủ' : row.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{row.employeeType === 'fulltime' ? 'Toàn thời gian' : 'Bán thời gian'}</td>
                    <td style={{ fontWeight: 600 }}>{row.totalHours.toFixed(1)}h</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.baseSalaryStr.toLocaleString('vi-VN')} vnđ</td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {row.deliveryCount} ca = {row.deliveryPay.toLocaleString('vi-VN')} vnđ
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>
                      {row.totalAdvance > 0 ? `-${Math.round(row.totalAdvance).toLocaleString('vi-VN')} đ` : '0 đ'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {Math.round(row.netSalary).toLocaleString('vi-VN')} vnđ
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                      Không có nhân viên hoạt động
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isOwner && advances.filter(a => a.status === 'pending').length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Yêu cầu ứng lương cần duyệt</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {advances.filter(a => a.status === 'pending').map(adv => {
              const member = members.find(m => m.userId === adv.userId);
              return (
                <div key={adv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{member?.name || 'Nhân viên'} xin ứng {adv.amount.toLocaleString('vi-VN')} đ</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Ngày xin: {new Date(adv.requestDate).toLocaleString('vi-VN')}
                      {adv.note && ` - Ghi chú: ${adv.note}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="btn btn-primary" 
                      onClick={() => updateAdvanceRequestStatus(storeId, adv.id, 'approved', new Date().toISOString())}
                      style={{ padding: '6px 12px', fontSize: 13 }}
                    >
                      Duyệt
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => updateAdvanceRequestStatus(storeId, adv.id, 'rejected')}
                      style={{ padding: '6px 12px', fontSize: 13, color: 'var(--danger)' }}
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAdvanceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Xin ứng lương</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">Số tiền (VNĐ)</label>
                <input 
                  type="number" 
                  className="input" 
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                  placeholder="VD: 500000"
                />
              </div>
              <div>
                <label className="label">Lý do (không bắt buộc)</label>
                <input 
                  type="text" 
                  className="input" 
                  value={advanceNote}
                  onChange={e => setAdvanceNote(e.target.value)}
                  placeholder="VD: Có việc gấp"
                />
              </div>
              
              {advances.filter(a => a.userId === currentUser?.uid && a.status === 'pending').length > 0 && (
                <div style={{ color: 'var(--warning)', fontSize: 13, padding: 8, background: '#fff3cd', borderRadius: 4 }}>
                  ⚠️ Bạn đang có 1 yêu cầu chờ duyệt, gửi thêm sẽ tạo yêu cầu mới.
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowAdvanceModal(false)}>Hủy</button>
                <button className="btn btn-primary" onClick={handleRequestAdvance} disabled={!advanceAmount}>Gửi yêu cầu</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
