'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import { getMonthAttendances, getSchedulesInRange } from '@/lib/firestore';
import { exportMonthlySalary } from '@/lib/exportExcel';
import { AttendanceRecord, ScheduleModel, DaySchedule } from '@/lib/types';

export default function SalaryPage() {
  const { storeId, store, members } = useApp();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleModel[]>([]);
  const [loading, setLoading] = useState(false);

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
    exportMonthlySalary(activeMembers, attendances, currentMonth, store, schedules);
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

    return {
      ...m,
      totalHours,
      calculatedSalary,
      deliveryCount,
      deliveryPay,
      baseSalaryStr: m.employeeType === 'fulltime' ? m.baseMonthlySalary : m.baseHourlyRate
    };
  });

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
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {Math.round(row.calculatedSalary).toLocaleString('vi-VN')} vnđ
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
    </div>
  );
}
