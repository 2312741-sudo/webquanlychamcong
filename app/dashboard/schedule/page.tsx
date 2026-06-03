'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import { getWeekSchedule, saveWeekSchedule } from '@/lib/firestore';
import { exportWeeklySchedule } from '@/lib/exportExcel';
import { ScheduleModel, DaySchedule, ShiftDefinition } from '@/lib/types';

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

const DAY_KEYS: (keyof DaySchedule)[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

export default function SchedulePage() {
  const { storeId, store, members, user } = useApp();
  const currentMember = members.find(m => m.userId === user?.uid);
  const [currentWeek, setCurrentWeek] = useState(() => getMondayOfWeek(new Date()));
  const [shifts, setShifts] = useState<Record<string, DaySchedule>>({});
  const [scheduleData, setScheduleData] = useState<ScheduleModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{userId: string; dayKey: keyof DaySchedule; memberName: string; dateLabel: string} | null>(null);

  const activeMembers = members.filter(m => m.status === 'active');
  const customShifts = store?.customShifts || [];

  useEffect(() => {
    if (!storeId || !currentWeek) return;
    setLoading(true);
    getWeekSchedule(storeId, currentWeek).then(data => {
      setScheduleData(data);
      
      // Auto-cleanup deleted shifts
      const loadedShifts = data?.shifts || {};
      const cleanShifts: Record<string, DaySchedule> = JSON.parse(JSON.stringify(loadedShifts));
      const validIds = new Set((store?.customShifts || []).map(s => s.id));
      validIds.add('delivery');

      for (const uid in cleanShifts) {
        for (const day of DAY_KEYS) {
          const val = cleanShifts[uid][day];
          let arr = Array.isArray(val) ? val : (val === 'off' ? [] : [val as string]);
          arr = arr.filter(s => {
            const shiftId = s.split('|')[0];
            return validIds.has(shiftId);
          });
          
          // Remove delivery if no normal shifts
          if (!arr.some(id => id !== 'delivery')) {
            arr = arr.filter(id => id !== 'delivery');
          }
          
          cleanShifts[uid][day] = arr;
        }
      }
      
      setShifts(cleanShifts);
    }).finally(() => setLoading(false));
  }, [storeId, currentWeek, store?.customShifts]);

  const changeWeek = (offset: number) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + offset * 7);
    setCurrentWeek(getMondayOfWeek(d));
  };

  const handleExport = () => {
    if (!store) return;
    exportWeeklySchedule(activeMembers, scheduleData, currentWeek, store);
  };

  const openModal = (userId: string, dayKey: keyof DaySchedule, memberName: string, dateLabel: string) => {
    setEditingCell({ userId, dayKey, memberName, dateLabel });
    setModalOpen(true);
  };

  const toggleShiftForCell = (shiftId: string) => {
    if (!editingCell) return;
    const { userId, dayKey } = editingCell;
    setShifts(prev => {
      const userSchedule = prev[userId] || { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[] };
      let currentArray = userSchedule[dayKey] || [];
      if (!Array.isArray(currentArray)) {
        currentArray = currentArray === 'off' ? [] : [currentArray as any];
      }
      
      if (shiftId === 'delivery') {
        const newArray = currentArray.includes('delivery') 
          ? currentArray.filter(id => id !== 'delivery')
          : [...currentArray, 'delivery'];
        return { ...prev, [userId]: { ...userSchedule, [dayKey]: newArray } };
      }

      const existingEntry = currentArray.find(s => s === shiftId || s.startsWith(`${shiftId}|`));
      let newArray = existingEntry
        ? currentArray.filter(s => s !== existingEntry)
        : [...currentArray, shiftId];
        
      // If no normal shifts left, remove delivery too
      if (!newArray.some(id => id !== 'delivery')) {
        newArray = newArray.filter(id => id !== 'delivery');
      }

      return { ...prev, [userId]: { ...userSchedule, [dayKey]: newArray } };
    });
  };

  const saveChanges = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      await saveWeekSchedule(storeId, currentWeek, shifts);
      const data = await getWeekSchedule(storeId, currentWeek);
      setScheduleData(data);
      setShifts(data?.shifts || {});
      alert('Đã lưu lịch làm');
    } catch (e) {
      alert('Lỗi khi lưu lịch');
    } finally {
      setSaving(false);
    }
  };

  const mondayDate = new Date(currentWeek);
  const datesInWeek = Array.from({length: 7}, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const getShiftLabel = (shiftIds: string[] | string) => {
    if (!shiftIds) return 'Nghỉ';
    const arr = Array.isArray(shiftIds) ? shiftIds : (shiftIds === 'off' ? [] : [shiftIds]);
    if (arr.length === 0) return 'Nghỉ';
    
    const actualShifts = arr.filter(id => id !== 'delivery');
    const hasDelivery = arr.includes('delivery');
    
    if (actualShifts.length === 0) return 'Nghỉ';

    const names = actualShifts.map(entry => {
      const [shiftId, deptId] = entry.split('|');
      const found = customShifts.find(s => s.id === shiftId);
      const dept = store?.departments?.find(d => d.id === deptId);
      
      const shiftName = found ? found.name : 'Ca cũ';
      return dept ? `[${dept.shortName}] ${shiftName}` : shiftName;
    });
    
    if (hasDelivery) names.push('📦 Chở hàng');
    
    return names.join(' + ');
  };

  const getCellColor = (shiftIds: string[] | string) => {
    const arr = Array.isArray(shiftIds) ? shiftIds : (shiftIds === 'off' ? [] : [shiftIds]);
    if (arr.length === 0) return 'transparent';
    return store?.themeColor || 'var(--primary)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Lịch làm tuần</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Quản lý và phân ca cho nhân viên
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="btn btn-primary" style={{ background: 'var(--success)' }}>
            📥 Xuất Excel
          </button>
          <button onClick={saveChanges} className="btn btn-primary" disabled={saving || loading}>
            {saving ? 'Đang lưu...' : '💾 Lưu lịch'}
          </button>
        </div>
      </div>

      {customShifts.length === 0 && (
        <div style={{ padding: 16, background: '#FFF3CD', color: '#856404', borderRadius: 8, fontSize: 14 }}>
          <strong>Lưu ý:</strong> Bạn chưa tạo ca làm việc nào. Hãy vào trang <strong>Cài đặt</strong> để thêm danh sách ca trước khi xếp lịch.
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => changeWeek(-1)}>← Tuần trước</button>
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            Tuần: {datesInWeek[0]} - {datesInWeek[6]}
          </div>
          <button className="btn btn-ghost" onClick={() => changeWeek(1)}>Tuần sau →</button>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><span className="spinner spinner-primary" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 1000, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  <th style={{ width: 200, paddingLeft: 16 }}>Nhân viên</th>
                  {DAY_LABELS.map((d, i) => (
                    <th key={d} style={{ textAlign: 'center', width: 120 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{d}</div>
                      <div style={{ fontSize: 11, fontWeight: 400 }}>{datesInWeek[i]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody style={{ background: 'var(--background)' }}>
                {activeMembers.map(m => (
                  <tr key={m.userId} style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <td style={{ padding: '12px 16px', borderRadius: '8px 0 0 8px' }}>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m.role === 'owner' ? 'Chủ' : m.role === 'manager' ? 'Quản lý' : 'Nhân viên'}</div>
                    </td>
                    {DAY_KEYS.map((dayKey, i) => {
                      const currentVal = shifts[m.userId]?.[dayKey] || [];
                      const isOff = Array.isArray(currentVal) ? currentVal.length === 0 : currentVal === 'off';
                      const bgColor = getCellColor(currentVal);
                      const textColor = isOff ? 'var(--text-primary)' : 'white';
                      const label = getShiftLabel(currentVal);
                      
                      return (
                        <td key={dayKey} style={{ padding: 4, borderRadius: i === 6 ? '0 8px 8px 0' : 0 }}>
                          <div
                            onClick={() => openModal(m.userId, dayKey, m.name, `${DAY_LABELS[i]} ${datesInWeek[i]}`)}
                            style={{
                              width: '100%',
                              height: 48,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 8,
                              border: isOff ? '1px dashed var(--border)' : 'none',
                              background: isOff ? 'var(--surface)' : bgColor,
                              color: textColor,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                            }}
                          >
                            {label}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {activeMembers.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chưa có nhân viên</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL */}
      {modalOpen && editingCell && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Chọn ca làm</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {editingCell.memberName} • {editingCell.dateLabel}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
              {customShifts.map(shift => {
                const currentArr = shifts[editingCell.userId]?.[editingCell.dayKey] || [];
                const arr = Array.isArray(currentArr) ? currentArr : (currentArr === 'off' ? [] : [currentArr]);
                const shiftEntry = arr.find(s => s === shift.id || s.startsWith(`${shift.id}|`));
                const isSelected = !!shiftEntry;
                const selectedDeptId = shiftEntry?.split('|')[1] || '';

                return (
                  <div key={shift.id} style={{
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 8,
                    background: isSelected ? 'var(--primary-light)' : 'white',
                    overflow: 'hidden',
                    flexShrink: 0
                  }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: 12, cursor: 'pointer',
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      color: isSelected ? 'white' : 'var(--text-primary)'
                    }}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleShiftForCell(shift.id)}
                        style={{ transform: 'scale(1.2)' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{shift.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {shift.startHour.toString().padStart(2,'0')}:{shift.startMinute.toString().padStart(2,'0')} - {shift.endHour.toString().padStart(2,'0')}:{shift.endMinute.toString().padStart(2,'0')}
                        </div>
                      </div>
                    </label>
                    
                    {isSelected && currentMember?.role === 'owner' && (
                      <div style={{ padding: '8px 12px', background: 'white' }}>
                        <select 
                          className="input" 
                          value={selectedDeptId}
                          onChange={(e) => {
                            const newDept = e.target.value;
                            setShifts(prev => {
                              const userSchedule = prev[editingCell.userId] || { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[] };
                              let cArr = userSchedule[editingCell.dayKey] || [];
                              if (!Array.isArray(cArr)) cArr = cArr === 'off' ? [] : [cArr as any];
                              let nArr = [...cArr];
                              const idx = nArr.findIndex(s => s === shiftEntry);
                              if (idx !== -1) {
                                nArr[idx] = newDept ? `${shift.id}|${newDept}` : shift.id;
                              }
                              return { ...prev, [editingCell.userId]: { ...userSchedule, [editingCell.dayKey]: nArr } };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
                        >
                          <option value="">-- Bộ phận mặc định --</option>
                          {store?.departments?.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.shortName})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
              {customShifts.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>
                  Vui lòng thêm ca làm trong trang Cài đặt.
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  disabled={!(shifts[editingCell.userId]?.[editingCell.dayKey as keyof DaySchedule] || []).some(id => id !== 'delivery')}
                  checked={(shifts[editingCell.userId]?.[editingCell.dayKey as keyof DaySchedule] || []).includes('delivery')}
                  onChange={() => toggleShiftForCell('delivery')}
                  style={{ transform: 'scale(1.2)' }}
                />
                Có chở hàng (được nhận phụ cấp)
              </label>
              {!(shifts[editingCell.userId]?.[editingCell.dayKey as keyof DaySchedule] || []).some(id => id !== 'delivery') && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  * Cần chọn ít nhất 1 ca làm để có thể tích chở hàng
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setModalOpen(false)}>
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
