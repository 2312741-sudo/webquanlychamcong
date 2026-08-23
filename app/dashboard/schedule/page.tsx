'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import { getWeekSchedule, saveWeekSchedule, updateMemberOrder, toggleHideMemberSchedule } from '@/lib/firestore';
import { exportWeeklySchedule } from '@/lib/exportExcel';
import { ScheduleModel, DaySchedule, ShiftDefinition, getRoleLabel, canManageSchedule, canManageDelivery, normalizeRole, sortMembersByOrder } from '@/lib/types';

function getMondayOfWeek(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // adjust when day is sunday
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

const DEFAULT_SHIFTS: ShiftDefinition[] = [
  { id: 'morning', name: 'Ca sáng', startHour: 6, startMinute: 0, endHour: 14, endMinute: 0 },
  { id: 'afternoon', name: 'Ca chiều', startHour: 14, startMinute: 0, endHour: 22, endMinute: 0 },
  { id: 'evening', name: 'Ca tối', startHour: 22, startMinute: 0, endHour: 6, endMinute: 0 },
];

const DAY_KEYS: (keyof DaySchedule)[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

export default function SchedulePage() {
  const { storeId, store, members, user, role } = useApp();
  const currentMember = members.find(m => m.userId === user?.uid);
  const canEditSchedule = canManageSchedule(role); // Owner, Manager 1
  const canEditDelivery = canManageDelivery(role); // Owner, Manager 1, Manager 2
  const canInteract = canEditSchedule || canEditDelivery;
  const isOwner = normalizeRole(role) === 'owner';
  const [currentWeek, setCurrentWeek] = useState(() => getMondayOfWeek(new Date()));
  const [shifts, setShifts] = useState<Record<string, DaySchedule>>({});
  const [scheduleData, setScheduleData] = useState<ScheduleModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedMemberIdx, setDraggedMemberIdx] = useState<number | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{userId: string; dayKey: keyof DaySchedule; memberName: string; dateLabel: string} | null>(null);

  const activeMembers = members.filter(m => m.status === 'active');
  const sortedMembers = sortMembersByOrder(activeMembers, store?.memberOrder);
  const hiddenScheduleUserIds = store?.hiddenScheduleUserIds || [];

  const visibleMembers = isOwner 
    ? sortedMembers 
    : sortedMembers.filter(m => !hiddenScheduleUserIds.includes(m.userId) || m.userId === user?.uid);

  const handleMoveMemberOrder = async (fromIdx: number, toIdx: number) => {
    if (!storeId || !isOwner || toIdx < 0 || toIdx >= sortedMembers.length) return;
    const items = [...sortedMembers];
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    const newOrder = items.map(m => m.userId);
    try {
      await updateMemberOrder(storeId, newOrder);
    } catch (e) {
      alert('Lỗi khi lưu thứ tự nhân viên');
    }
  };

  const handleToggleHideSchedule = async (userId: string, currentlyHidden: boolean) => {
    if (!storeId || !isOwner) return;
    try {
      await toggleHideMemberSchedule(storeId, userId, !currentlyHidden);
    } catch (e) {
      alert('Lỗi khi thay đổi trạng thái ẩn lịch');
    }
  };

  const customShifts = (store?.customShifts && store.customShifts.length > 0)
    ? store.customShifts
    : DEFAULT_SHIFTS;

  useEffect(() => {
    if (!storeId || !currentWeek) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let isCancelled = false;

    getWeekSchedule(storeId, currentWeek).then(data => {
      if (isCancelled) return;
      setScheduleData(data);
      
      const loadedShifts = data?.shifts || {};
      const cleanShifts: Record<string, DaySchedule> = JSON.parse(JSON.stringify(loadedShifts));
      const validIds = new Set(customShifts.map(s => s.id));
      validIds.add('delivery');
      validIds.add('giaohang');

      for (const uid in cleanShifts) {
        if (!cleanShifts[uid]) continue;
        for (const day of DAY_KEYS) {
          const val = cleanShifts[uid][day];
          let arr = Array.isArray(val) ? val : (val === 'off' || !val ? [] : [val as string]);
          arr = arr.filter(s => {
            const shiftId = s.split('|')[0];
            return validIds.has(shiftId);
          });
          
          // Remove delivery/giaohang if no normal shifts
          if (!arr.some(id => id !== 'delivery' && id !== 'giaohang')) {
            arr = arr.filter(id => id !== 'delivery' && id !== 'giaohang');
          }
          
          cleanShifts[uid][day] = arr;
        }
      }
      
      setShifts(cleanShifts);
    }).catch(err => {
      if (isCancelled) return;
      console.error('Error fetching schedule:', err);
    }).finally(() => {
      if (!isCancelled) setLoading(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [storeId, currentWeek]);

  const changeWeek = (offset: number) => {
    const [y, m, d] = currentWeek.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offset * 7);
    setCurrentWeek(getMondayOfWeek(dateObj));
  };

  const goToCurrentWeek = () => {
    setCurrentWeek(getMondayOfWeek(new Date()));
  };

  const handleExport = () => {
    if (!store) return;
    const currentSchedule: ScheduleModel = {
      id: scheduleData?.id || '',
      storeId: storeId || '',
      weekStart: currentWeek,
      shifts: shifts
    };
    exportWeeklySchedule(visibleMembers, currentSchedule, currentWeek, store);
  };

  const openModal = (userId: string, dayKey: keyof DaySchedule, memberName: string, dateLabel: string) => {
    setEditingCell({ userId, dayKey, memberName, dateLabel });
    setModalOpen(true);
  };

  const toggleShiftForCell = (shiftId: string) => {
    if (!editingCell) return;
    if (shiftId === 'delivery' || shiftId === 'giaohang') {
      if (!canEditDelivery) return;
    } else {
      if (!canEditSchedule) return;
    }
    const { userId, dayKey } = editingCell;
    setShifts(prev => {
      const userSchedule = prev[userId] || { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[] };
      let currentArray = userSchedule[dayKey] || [];
      if (!Array.isArray(currentArray)) {
        currentArray = currentArray === 'off' || !currentArray ? [] : [currentArray as any];
      }
      
      let newArray: string[] = [];
      if (shiftId === 'delivery' || shiftId === 'giaohang') {
        newArray = currentArray.includes(shiftId) 
          ? currentArray.filter(id => id !== shiftId)
          : [...currentArray, shiftId];
      } else {
        const existingEntry = currentArray.find(s => s === shiftId || s.startsWith(`${shiftId}|`));
        newArray = existingEntry
          ? currentArray.filter(s => s !== existingEntry)
          : [...currentArray, shiftId];
          
        // If no normal shifts left, remove delivery and giaohang too
        if (!newArray.some(id => id !== 'delivery' && id !== 'giaohang')) {
          newArray = newArray.filter(id => id !== 'delivery' && id !== 'giaohang');
        }
      }

      return {
        ...prev,
        [userId]: {
          ...userSchedule,
          [dayKey]: newArray
        }
      };
    });
  };

  const saveChanges = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      // Clean up shifts before saving to Firestore to avoid undefined fields
      const sanitizedShifts: Record<string, DaySchedule> = {};
      for (const uid in shifts) {
        if (!shifts[uid]) continue;
        sanitizedShifts[uid] = {
          monday: shifts[uid].monday || [],
          tuesday: shifts[uid].tuesday || [],
          wednesday: shifts[uid].wednesday || [],
          thursday: shifts[uid].thursday || [],
          friday: shifts[uid].friday || [],
          saturday: shifts[uid].saturday || [],
          sunday: shifts[uid].sunday || [],
        };
      }

      await saveWeekSchedule(storeId, currentWeek, sanitizedShifts);
      const data = await getWeekSchedule(storeId, currentWeek);
      setScheduleData(data);
      setShifts(data?.shifts || {});
      alert('Đã lưu lịch làm việc thành công!');
    } catch (e) {
      console.error('Error saving schedule:', e);
      alert('Lỗi khi lưu lịch làm: ' + e);
    } finally {
      setSaving(false);
    }
  };

  const [monYear, monMonth, monDay] = currentWeek.split('-').map(Number);
  const mondayDate = new Date(monYear, monMonth - 1, monDay);
  const datesInWeek = Array.from({length: 7}, (_, i) => {
    const d = new Date(mondayDate);
    d.setDate(mondayDate.getDate() + i);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const getShiftLabel = (shiftIds: string[] | string) => {
    if (!shiftIds) return 'Nghỉ';
    const arr = Array.isArray(shiftIds) ? shiftIds : (shiftIds === 'off' || !shiftIds ? [] : [shiftIds]);
    if (arr.length === 0) return 'Nghỉ';
    
    const actualShifts = arr.filter(id => id !== 'delivery' && id !== 'giaohang');
    const hasDelivery = arr.includes('delivery');
    const hasGiaoHang = arr.includes('giaohang');
    
    if (actualShifts.length === 0) {
      if (hasDelivery && hasGiaoHang) return '📦 Chở + 🛵 Giao';
      if (hasDelivery) return '📦 Chở hàng';
      if (hasGiaoHang) return '🛵 Giao hàng';
      return 'Nghỉ';
    }

    const names = actualShifts.map(entry => {
      const [shiftId, deptId] = entry.split('|');
      const found = customShifts.find(s => s.id === shiftId);
      const dept = store?.departments?.find(d => d.id === deptId);
      
      const shiftName = found ? found.name : 'Ca làm';
      return dept ? `[${dept.shortName}] ${shiftName}` : shiftName;
    });
    
    if (hasDelivery) names.push('📦 Chở');
    if (hasGiaoHang) names.push('🛵 Giao');
    
    return names.join(' + ');
  };

  const getCellColor = (shiftIds: string[] | string) => {
    const arr = Array.isArray(shiftIds) ? shiftIds : (shiftIds === 'off' || !shiftIds ? [] : [shiftIds]);
    if (arr.length === 0) return 'transparent';
    return store?.themeColor || 'var(--primary)';
  };

  const calculateDayHours = (shiftIds: string[] | string | undefined): number => {
    if (!shiftIds) return 0;
    const arr = Array.isArray(shiftIds) ? shiftIds : (shiftIds === 'off' || !shiftIds ? [] : [shiftIds]);
    const actualShifts = arr.filter(id => id !== 'delivery' && id !== 'giaohang');
    if (actualShifts.length === 0) return 0;

    let totalDayHours = 0;
    actualShifts.forEach(entry => {
      const shiftId = entry.split('|')[0];
      const shiftDef = customShifts.find(s => s.id === shiftId) || DEFAULT_SHIFTS.find(s => s.id === shiftId);
      if (shiftDef) {
        let duration = (shiftDef.endHour - shiftDef.startHour) + (shiftDef.endMinute - shiftDef.startMinute) / 60;
        if (duration < 0) duration += 24;
        totalDayHours += duration;
      }
    });

    return totalDayHours;
  };

  const isDeliveryShift = (shiftIds: string[] | string | undefined): boolean => {
    if (!shiftIds) return false;
    const arr = Array.isArray(shiftIds) ? shiftIds : (shiftIds === 'off' || !shiftIds ? [] : [shiftIds]);
    const actualShifts = arr.filter(id => id !== 'delivery' && id !== 'giaohang');
    return arr.includes('delivery') && actualShifts.length > 0;
  };

  // Calculations for all visible members and all days
  const dayHoursTotals = DAY_KEYS.map(dayKey => {
    return visibleMembers.reduce((sum, m) => {
      const shiftVal = shifts[m.userId]?.[dayKey];
      return sum + calculateDayHours(shiftVal);
    }, 0);
  });

  const memberHoursTotals: Record<string, number> = {};
  const memberDeliveryTotals: Record<string, number> = {};

  visibleMembers.forEach(m => {
    let mHours = 0;
    let mDelivery = 0;
    DAY_KEYS.forEach(dayKey => {
      const shiftVal = shifts[m.userId]?.[dayKey];
      mHours += calculateDayHours(shiftVal);
      if (isDeliveryShift(shiftVal)) {
        mDelivery += 1;
      }
    });
    memberHoursTotals[m.userId] = mHours;
    memberDeliveryTotals[m.userId] = mDelivery;
  });

  const grandTotalHours = visibleMembers.reduce((sum, m) => sum + (memberHoursTotals[m.userId] || 0), 0);
  const grandTotalDelivery = visibleMembers.reduce((sum, m) => sum + (memberDeliveryTotals[m.userId] || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Lịch làm tuần</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Quản lý và phân ca làm việc cho nhân viên
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={goToCurrentWeek} className="btn btn-secondary">
            📅 Tuần này
          </button>
          <button onClick={handleExport} className="btn btn-primary" style={{ background: 'var(--success)' }}>
            📥 Xuất Excel
          </button>
          {canInteract && (
            <button onClick={saveChanges} className="btn btn-primary" disabled={saving || loading}>
              {saving ? 'Đang lưu...' : '💾 Lưu lịch'}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => changeWeek(-1)}>← Tuần trước</button>
          <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Tuần: {datesInWeek[0]} - {datesInWeek[6]} ({currentWeek})</span>
          </div>
          <button className="btn btn-ghost" onClick={() => changeWeek(1)}>Tuần sau →</button>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><span className="spinner spinner-primary" /></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 1240, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  <th style={{ width: 200, paddingLeft: 16 }}>Nhân viên</th>
                  {DAY_LABELS.map((d, i) => (
                    <th key={d} style={{ textAlign: 'center', width: 120 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{d}</div>
                      <div style={{ fontSize: 11, fontWeight: 400 }}>{datesInWeek[i]}</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', width: 120, padding: '8px 4px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>Tổng giờ công</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>Trong tuần</div>
                  </th>
                  <th style={{ textAlign: 'center', width: 120, padding: '8px 4px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>Tổng ca chở hàng</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>Trong tuần</div>
                  </th>
                </tr>
              </thead>
              <tbody style={{ background: 'var(--background)' }}>
                {/* HÀNG TỔNG THEO NGÀY (Dưới header) */}
                <tr 
                  style={{ 
                    background: '#F8F9FA', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  <td style={{ padding: '10px 14px', borderRadius: '8px 0 0 8px', minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 15 }}>📊</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--neutral)' }}>Tổng giờ theo ngày</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Cộng dồn tất cả NV</div>
                      </div>
                    </div>
                  </td>
                  {DAY_KEYS.map((dayKey, i) => {
                    const dayTotal = dayHoursTotals[i];
                    return (
                      <td key={`summary-${dayKey}`} style={{ padding: 4 }}>
                        <div
                          style={{
                            width: '100%',
                            minHeight: 48,
                            padding: '6px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            borderRadius: 8,
                            border: dayTotal > 0 ? '1px solid #A5D8FF' : '1px dashed var(--border)',
                            background: dayTotal > 0 ? '#E7F5FF' : 'var(--surface)',
                            color: dayTotal > 0 ? '#1971C2' : 'var(--text-secondary)',
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {dayTotal > 0 ? (dayTotal % 1 === 0 ? `${dayTotal}h` : `${dayTotal.toFixed(1)}h`) : '0h'}
                        </div>
                      </td>
                    );
                  })}
                  {/* Giao điểm với cột Tổng giờ công: Tổng giờ công cả tuần */}
                  <td style={{ padding: 4 }}>
                    <div
                      style={{
                        width: '100%',
                        minHeight: 48,
                        padding: '6px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        borderRadius: 8,
                        border: grandTotalHours > 0 ? '1px solid #96F2D7' : '1px dashed var(--border)',
                        background: grandTotalHours > 0 ? '#E6FCF5' : 'var(--surface)',
                        color: grandTotalHours > 0 ? '#0CA678' : 'var(--text-secondary)',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {grandTotalHours > 0 ? (grandTotalHours % 1 === 0 ? `${grandTotalHours}h` : `${grandTotalHours.toFixed(1)}h`) : '0h'}
                    </div>
                  </td>
                  {/* Giao điểm với cột Tổng ca chở hàng: Tổng ca chở hàng cả tuần */}
                  <td style={{ padding: 4, borderRadius: '0 8px 8px 0' }}>
                    <div
                      style={{
                        width: '100%',
                        minHeight: 48,
                        padding: '6px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        borderRadius: 8,
                        border: grandTotalDelivery > 0 ? '1px solid #FFD8A8' : '1px dashed var(--border)',
                        background: grandTotalDelivery > 0 ? '#FFF4E6' : 'var(--surface)',
                        color: grandTotalDelivery > 0 ? '#D9480F' : 'var(--text-secondary)',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      {grandTotalDelivery}
                    </div>
                  </td>
                </tr>

                {/* DANH SÁCH NHÂN VIÊN */}
                {visibleMembers.map((m, idx) => {
                  const isHidden = hiddenScheduleUserIds.includes(m.userId);
                  const memberHours = memberHoursTotals[m.userId] || 0;
                  const memberDelivery = memberDeliveryTotals[m.userId] || 0;

                  return (
                  <tr 
                    key={m.userId} 
                    draggable={isOwner}
                    onDragStart={() => setDraggedMemberIdx(idx)}
                    onDragOver={(e) => { if (isOwner) e.preventDefault(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedMemberIdx !== null && draggedMemberIdx !== idx) {
                        handleMoveMemberOrder(draggedMemberIdx, idx);
                      }
                      setDraggedMemberIdx(null);
                    }}
                    style={{ 
                      background: draggedMemberIdx === idx ? 'rgba(200, 16, 46, 0.05)' : 'white', 
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{ padding: '10px 14px', borderRadius: '8px 0 0 8px', minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isOwner && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <button 
                                type="button" 
                                title="Di chuyển lên"
                                disabled={idx === 0}
                                onClick={() => handleMoveMemberOrder(idx, idx - 1)}
                                style={{ border: 'none', background: 'transparent', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.2 : 0.7, padding: 0, fontSize: 10, lineHeight: 1 }}
                              >▲</button>
                              <button 
                                type="button" 
                                title="Di chuyển xuống"
                                disabled={idx === visibleMembers.length - 1}
                                onClick={() => handleMoveMemberOrder(idx, idx + 1)}
                                style={{ border: 'none', background: 'transparent', cursor: idx === visibleMembers.length - 1 ? 'default' : 'pointer', opacity: idx === visibleMembers.length - 1 ? 0.2 : 0.7, padding: 0, fontSize: 10, lineHeight: 1 }}
                              >▼</button>
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                              {m.name}
                              {isHidden && (
                                <span style={{ fontSize: 10, background: '#FFF3BF', color: '#D9480F', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                  Ẩn
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{getRoleLabel(m.role)}</div>
                          </div>
                        </div>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => handleToggleHideSchedule(m.userId, isHidden)}
                            title={isHidden ? "Lịch đang bị ẩn với người khác (Chỉ Chủ thấy). Bấm để hiện lại." : "Lịch đang hiện trên Lịch cửa hàng. Bấm để ẩn khỏi người khác."}
                            style={{
                              border: 'none',
                              background: isHidden ? '#FFF5F5' : 'transparent',
                              color: isHidden ? '#C8102E' : 'var(--text-secondary)',
                              padding: '4px 6px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontSize: 13
                            }}
                          >
                            {isHidden ? '🙈' : '👁️'}
                          </button>
                        )}
                      </div>
                    </td>
                    {DAY_KEYS.map((dayKey, i) => {
                      const currentVal = shifts[m.userId]?.[dayKey] || [];
                      const isOff = Array.isArray(currentVal) ? currentVal.length === 0 : (currentVal === 'off' || !currentVal);
                      const bgColor = getCellColor(currentVal);
                      const textColor = isOff ? 'var(--text-primary)' : 'white';
                      const label = getShiftLabel(currentVal);
                      
                      return (
                        <td key={dayKey} style={{ padding: 4 }}>
                          <div
                            onClick={() => canInteract && openModal(m.userId, dayKey, m.name, `${DAY_LABELS[i]} ${datesInWeek[i]}`)}
                            style={{
                              width: '100%',
                              minHeight: 48,
                              padding: '6px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              borderRadius: 8,
                              border: isOff ? '1px dashed var(--border)' : 'none',
                              background: isOff ? 'var(--surface)' : bgColor,
                              color: textColor,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: canInteract ? 'pointer' : 'default',
                              transition: 'all 0.2s',
                              wordBreak: 'break-word'
                            }}
                          >
                            {label}
                          </div>
                        </td>
                      );
                    })}
                    {/* Cột Tổng giờ công của nhân viên */}
                    <td style={{ padding: 4 }}>
                      <div
                        style={{
                          width: '100%',
                          minHeight: 48,
                          padding: '6px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          borderRadius: 8,
                          border: memberHours > 0 ? '1px solid var(--border)' : '1px dashed var(--border)',
                          background: memberHours > 0 ? '#F8F9FA' : 'var(--surface)',
                          color: memberHours > 0 ? 'var(--neutral)' : 'var(--text-secondary)',
                          fontSize: 12.5,
                          fontWeight: 700,
                        }}
                      >
                        {memberHours > 0 
                          ? (memberHours % 1 === 0 ? `${memberHours}h` : `${memberHours.toFixed(1)}h`) 
                          : '0'}
                      </div>
                    </td>
                    {/* Cột Tổng ca chở hàng của nhân viên */}
                    <td style={{ padding: 4, borderRadius: '0 8px 8px 0' }}>
                      <div
                        style={{
                          width: '100%',
                          minHeight: 48,
                          padding: '6px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          borderRadius: 8,
                          border: memberDelivery > 0 ? '1px solid #FFE066' : '1px dashed var(--border)',
                          background: memberDelivery > 0 ? '#FFF9DB' : 'var(--surface)',
                          color: memberDelivery > 0 ? '#E67700' : 'var(--text-secondary)',
                          fontSize: 12.5,
                          fontWeight: 700,
                        }}
                      >
                        {memberDelivery}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {visibleMembers.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Chưa có nhân viên hoạt động</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PHÂN CA */}
      {modalOpen && editingCell && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Chọn ca làm</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              {editingCell.memberName} • {editingCell.dateLabel}
            </p>

            {!canEditSchedule && canEditDelivery && (
              <div style={{ fontSize: 12, color: '#D9480F', background: '#FFF4E6', padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontWeight: 600, border: '1px solid #FFE066', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>ℹ️</span>
                <span>Tài khoản Quản lý 2: Chỉ được phép tích Chở hàng & Giao hàng (Không sửa ca làm việc).</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
              {customShifts.map(shift => {
                const currentArr = shifts[editingCell.userId]?.[editingCell.dayKey] || [];
                const arr = Array.isArray(currentArr) ? currentArr : (currentArr === 'off' || !currentArr ? [] : [currentArr]);
                const shiftEntry = arr.find(s => s === shift.id || s.startsWith(`${shift.id}|`));
                const isSelected = !!shiftEntry;
                const selectedDeptId = shiftEntry?.split('|')[1] || '';

                return (
                  <div key={shift.id} style={{
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius: 8,
                    background: isSelected ? 'var(--primary-light)' : 'white',
                    overflow: 'hidden',
                    flexShrink: 0,
                    opacity: canEditSchedule ? 1 : (isSelected ? 0.95 : 0.45)
                  }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                      cursor: canEditSchedule ? 'pointer' : 'not-allowed',
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      color: isSelected ? 'white' : 'var(--text-primary)'
                    }}>
                      <input 
                        type="checkbox" 
                        disabled={!canEditSchedule}
                        checked={isSelected}
                        onChange={() => canEditSchedule && toggleShiftForCell(shift.id)}
                        style={{ transform: 'scale(1.2)', cursor: canEditSchedule ? 'pointer' : 'not-allowed' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{shift.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {shift.startHour.toString().padStart(2,'0')}:{shift.startMinute.toString().padStart(2,'0')} - {shift.endHour.toString().padStart(2,'0')}:{shift.endMinute.toString().padStart(2,'0')}
                        </div>
                      </div>
                    </label>
                    
                    {isSelected && (normalizeRole(currentMember?.role) === 'owner' || store?.departmentSelectionEnabled !== false) && (
                      <div style={{ padding: '8px 12px', background: 'white' }}>
                        <select 
                          className="input" 
                          disabled={!canEditSchedule}
                          value={selectedDeptId}
                          onChange={(e) => {
                            if (!canEditSchedule) return;
                            const newDept = e.target.value;
                            setShifts(prev => {
                              const userSchedule = prev[editingCell.userId] || { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[] };
                              let cArr = userSchedule[editingCell.dayKey] || [];
                              if (!Array.isArray(cArr)) cArr = cArr === 'off' || !cArr ? [] : [cArr as any];
                              let nArr = [...cArr];
                              const idx = nArr.findIndex(s => s === shiftEntry);
                              if (idx !== -1) {
                                nArr[idx] = newDept ? `${shift.id}|${newDept}` : shift.id;
                              }
                              return { ...prev, [editingCell.userId]: { ...userSchedule, [editingCell.dayKey]: nArr } };
                            });
                          }}
                          style={{ width: '100%', padding: '6px 10px', fontSize: 13, cursor: canEditSchedule ? 'pointer' : 'not-allowed' }}
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
            </div>

            {(() => {
              const currentVal = shifts[editingCell.userId]?.[editingCell.dayKey];
              const cellShifts = Array.isArray(currentVal) ? currentVal : (currentVal === 'off' || !currentVal ? [] : [currentVal as string]);
              const hasNormalShift = cellShifts.some(id => id !== 'delivery' && id !== 'giaohang');
              const isDeliveryChecked = cellShifts.includes('delivery');
              const isGiaoHangChecked = cellShifts.includes('giaohang');
              const canTickDelivery = canEditDelivery && hasNormalShift;

              return (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: canTickDelivery ? 'pointer' : 'not-allowed', fontSize: 14, color: 'var(--primary)', fontWeight: 600, opacity: canTickDelivery ? 1 : 0.5 }}>
                      <input 
                        type="checkbox" 
                        disabled={!canTickDelivery}
                        checked={isDeliveryChecked}
                        onChange={() => canEditDelivery && toggleShiftForCell('delivery')}
                        style={{ transform: 'scale(1.2)', cursor: canTickDelivery ? 'pointer' : 'not-allowed' }}
                      />
                      📦 Chở hàng (được nhận phụ cấp)
                    </label>
                  </div>
                  
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: canTickDelivery ? 'pointer' : 'not-allowed', fontSize: 14, color: 'var(--primary)', fontWeight: 600, opacity: canTickDelivery ? 1 : 0.5 }}>
                      <input 
                        type="checkbox" 
                        disabled={!canTickDelivery}
                        checked={isGiaoHangChecked}
                        onChange={() => canEditDelivery && toggleShiftForCell('giaohang')}
                        style={{ transform: 'scale(1.2)', cursor: canTickDelivery ? 'pointer' : 'not-allowed' }}
                      />
                      🛵 Giao hàng (được nhận phụ cấp)
                    </label>
                  </div>

                  {!hasNormalShift ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      * Cần có ít nhất 1 ca làm việc để có thể tích chở hàng / giao hàng {canEditDelivery && !canEditSchedule ? '(Vui lòng nhờ Chủ quán hoặc Quản lý 1 xếp ca trước)' : ''}
                    </div>
                  ) : (!canEditSchedule && canEditDelivery ? (
                    <div style={{ fontSize: 12, color: '#0CA678', marginTop: 4, fontWeight: 600 }}>
                      ✓ Bạn có thể tích hoặc bỏ tích Chở hàng / Giao hàng cho ca làm này
                    </div>
                  ) : null)}
                </div>
              );
            })()}

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
