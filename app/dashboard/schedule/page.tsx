'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '../layout';
import { getWeekSchedule, watchWeekSchedule, saveWeekSchedule, saveUserSchedule, updateMemberOrder, toggleHideMemberSchedule } from '@/lib/firestore';
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

export function getScheduleDeadline(weekStart: string): Date {
  const [y, m, d] = weekStart.split('-').map(Number);
  const monday = new Date(y, m - 1, d, 0, 0, 0, 0);
  const prevFriday = new Date(monday.getTime() - 3 * 24 * 60 * 60 * 1000);
  prevFriday.setHours(23, 59, 59, 999);
  return prevFriday;
}

export function isPastScheduleDeadline(weekStart: string): boolean {
  const deadline = getScheduleDeadline(weekStart);
  return Date.now() > deadline.getTime();
}

export function formatDeadline(weekStart: string): string {
  const deadline = getScheduleDeadline(weekStart);
  const d = String(deadline.getDate()).padStart(2, '0');
  const m = String(deadline.getMonth() + 1).padStart(2, '0');
  const y = deadline.getFullYear();
  return `23:59 Thứ 6 (${d}/${m}/${y})`;
}

export function getWeekNumber(weekStart: string): number {
  const [y, m, d] = weekStart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor((date.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil(diffDays / 7) + 1;
}

function cleanDayShifts(shifts: string[] | undefined): string[] {
  if (!shifts || !Array.isArray(shifts)) return [];
  const hasNormal = shifts.some(id => id !== 'delivery' && id !== 'giaohang');
  if (!hasNormal) return [];
  return [...shifts];
}

const DEFAULT_SHIFTS: ShiftDefinition[] = [
  { id: 'morning', name: 'Ca sáng', startHour: 6, startMinute: 0, endHour: 14, endMinute: 0 },
  { id: 'afternoon', name: 'Ca chiều', startHour: 14, startMinute: 0, endHour: 22, endMinute: 0 },
  { id: 'evening', name: 'Ca tối', startHour: 22, startMinute: 0, endHour: 6, endMinute: 0 },
];

const DAY_KEYS: (keyof DaySchedule)[] = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

export default function SchedulePage() {
  return <Suspense fallback={<p>Đang tải lịch...</p>}><ScheduleContent /></Suspense>;
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const { storeId, store, members, user, role } = useApp();
  const currentMember = members.find(m => m.userId === user?.uid);
  const canEditSchedule = canManageSchedule(role); // Owner, Manager 1
  const canEditDelivery = canManageDelivery(role); // Owner, Manager 1, Manager 2
  const canInteract = canEditSchedule || canEditDelivery;
  const isOwner = normalizeRole(role) === 'owner';
  const normRole = normalizeRole(role);
  const [activeTab, setActiveTab] = useState<'register' | 'store'>('register');
  const [registerDraft, setRegisterDraft] = useState<DaySchedule>({
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
  });
  const [registerSaving, setRegisterSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);

  const [currentWeek, setCurrentWeek] = useState(() => getMondayOfWeek(new Date()));
  useEffect(() => {
    const week = searchParams.get('weekStart');
    if (week && /^\d{4}-\d{2}-\d{2}$/.test(week) && !Number.isNaN(Date.parse(week))) setCurrentWeek(week);
  }, [searchParams]);

  const pastDeadline = isPastScheduleDeadline(currentWeek);
  const isBlocked = pastDeadline && !canEditSchedule;
  const isThisWeek = currentWeek === getMondayOfWeek(new Date());

  const [shifts, setShifts] = useState<Record<string, DaySchedule>>({});
  const [scheduleData, setScheduleData] = useState<ScheduleModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync user's draft schedule for registration tab
  useEffect(() => {
    if (!user) return;
    // Don't overwrite if user has unsaved edits in current week
    if (isDirty && loadedWeek === currentWeek) return;

    const userSchedule = shifts[user.uid];
    if (userSchedule) {
      setRegisterDraft({
        monday: Array.isArray(userSchedule.monday) ? [...userSchedule.monday] : (userSchedule.monday === 'off' || !userSchedule.monday ? [] : [userSchedule.monday as any]),
        tuesday: Array.isArray(userSchedule.tuesday) ? [...userSchedule.tuesday] : (userSchedule.tuesday === 'off' || !userSchedule.tuesday ? [] : [userSchedule.tuesday as any]),
        wednesday: Array.isArray(userSchedule.wednesday) ? [...userSchedule.wednesday] : (userSchedule.wednesday === 'off' || !userSchedule.wednesday ? [] : [userSchedule.wednesday as any]),
        thursday: Array.isArray(userSchedule.thursday) ? [...userSchedule.thursday] : (userSchedule.thursday === 'off' || !userSchedule.thursday ? [] : [userSchedule.thursday as any]),
        friday: Array.isArray(userSchedule.friday) ? [...userSchedule.friday] : (userSchedule.friday === 'off' || !userSchedule.friday ? [] : [userSchedule.friday as any]),
        saturday: Array.isArray(userSchedule.saturday) ? [...userSchedule.saturday] : (userSchedule.saturday === 'off' || !userSchedule.saturday ? [] : [userSchedule.saturday as any]),
        sunday: Array.isArray(userSchedule.sunday) ? [...userSchedule.sunday] : (userSchedule.sunday === 'off' || !userSchedule.sunday ? [] : [userSchedule.sunday as any]),
      });
    } else {
      setRegisterDraft({
        monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
      });
    }
    setLoadedWeek(currentWeek);
    setIsDirty(false);
  }, [user, shifts, currentWeek]);

  const toggleRegisterShift = (dayKey: keyof DaySchedule, shiftId: string) => {
    if (isBlocked) {
      showToast(`Đã qua hạn đăng ký (${formatDeadline(currentWeek)}). Vui lòng liên hệ Quản lý.`);
      return;
    }
    setIsDirty(true);
    setRegisterDraft(prev => {
      const current = prev[dayKey] || [];
      const existingEntry = current.find(s => s === shiftId || s.startsWith(`${shiftId}|`));
      let next: string[];
      if (existingEntry) {
        next = current.filter(s => s !== existingEntry);
        // Strip delivery & giaohang if no regular working shifts left
        const hasNormal = next.some(id => id !== 'delivery' && id !== 'giaohang');
        if (!hasNormal) {
          next = next.filter(id => id !== 'delivery' && id !== 'giaohang');
        }
      } else {
        next = [...current, shiftId];
      }
      return { ...prev, [dayKey]: next };
    });
  };

  const setRegisterShiftDepartment = (dayKey: keyof DaySchedule, shiftId: string, deptId: string) => {
    if (isBlocked) {
      showToast(`Đã qua hạn đăng ký (${formatDeadline(currentWeek)}). Vui lòng liên hệ Quản lý.`);
      return;
    }
    setIsDirty(true);
    setRegisterDraft(prev => {
      const current = prev[dayKey] || [];
      const existingEntry = current.find(s => s === shiftId || s.startsWith(`${shiftId}|`));
      if (!existingEntry) return prev;
      const newEntry = deptId ? `${shiftId}|${deptId}` : shiftId;
      const next = current.map(s => s === existingEntry ? newEntry : s);
      return { ...prev, [dayKey]: next };
    });
  };

  const toggleRegisterSpecial = (dayKey: keyof DaySchedule, specialType: 'delivery' | 'giaohang') => {
    if (isBlocked) {
      showToast(`Đã qua hạn đăng ký (${formatDeadline(currentWeek)}). Vui lòng liên hệ Quản lý.`);
      return;
    }
    const current = registerDraft[dayKey] || [];
    const hasNormal = current.some(id => id !== 'delivery' && id !== 'giaohang');
    if (!hasNormal) {
      showToast('Cần chọn ít nhất 1 ca làm việc trong ngày trước khi tích Chở hàng / Giao hàng.');
      return;
    }
    setIsDirty(true);
    setRegisterDraft(prev => {
      const c = prev[dayKey] || [];
      const exists = c.includes(specialType);
      const next = exists ? c.filter(id => id !== specialType) : [...c, specialType];
      return { ...prev, [dayKey]: next };
    });
  };

  const clearRegisterDay = (dayKey: keyof DaySchedule) => {
    if (isBlocked) {
      showToast(`Đã qua hạn đăng ký (${formatDeadline(currentWeek)}). Vui lòng liên hệ Quản lý.`);
      return;
    }
    setIsDirty(true);
    setRegisterDraft(prev => ({ ...prev, [dayKey]: [] }));
  };

  const handleSaveUserRegistration = async () => {
    if (!storeId || !user) return;
    if (isBlocked) {
      showToast(`Đã quá hạn đăng ký lịch làm tuần này (${formatDeadline(currentWeek)}). Vui lòng liên hệ Quản lý!`);
      return;
    }
    setRegisterSaving(true);
    try {
      const cleanedDraft: DaySchedule = {
        monday: cleanDayShifts(registerDraft.monday),
        tuesday: cleanDayShifts(registerDraft.tuesday),
        wednesday: cleanDayShifts(registerDraft.wednesday),
        thursday: cleanDayShifts(registerDraft.thursday),
        friday: cleanDayShifts(registerDraft.friday),
        saturday: cleanDayShifts(registerDraft.saturday),
        sunday: cleanDayShifts(registerDraft.sunday),
      };

      const memberName = currentMember?.name || user.displayName || user.email?.split('@')[0] || 'Nhân viên';
      await saveUserSchedule(storeId, user.uid, currentWeek, cleanedDraft, memberName);
      setIsDirty(false);
      showToast('Đã lưu đăng ký lịch làm việc thành công!');
    } catch (err: any) {
      showToast('Lỗi khi lưu đăng ký: ' + (err.message || err));
    } finally {
      setRegisterSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
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

    const unsubscribe = watchWeekSchedule(storeId, currentWeek, (data) => {
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
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [storeId, currentWeek]);

  const changeWeek = (offset: number) => {
    if (isDirty) {
      if (!window.confirm('Bạn có thay đổi lịch làm chưa lưu. Bạn có chắc muốn chuyển tuần mà không lưu không?')) {
        return;
      }
    }
    const [y, m, d] = currentWeek.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offset * 7);
    setCurrentWeek(getMondayOfWeek(dateObj));
    setIsDirty(false);
  };

  const goToCurrentWeek = () => {
    if (isDirty) {
      if (!window.confirm('Bạn có thay đổi lịch làm chưa lưu. Bạn có chắc muốn chuyển tuần mà không lưu không?')) {
        return;
      }
    }
    setCurrentWeek(getMondayOfWeek(new Date()));
    setIsDirty(false);
  };

  const handleTabSwitch = (tab: 'register' | 'store') => {
    if (isDirty) {
      if (!window.confirm('Bạn có thay đổi lịch làm chưa lưu. Bạn có chắc muốn chuyển tab mà không lưu không?')) {
        return;
      }
    }
    setIsDirty(false);
    setActiveTab(tab);
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
    const isSelf = user?.uid === userId;
    if (isSelf && !canEditSchedule && pastDeadline) {
      showToast(`Đã qua hạn đăng ký (${formatDeadline(currentWeek)}). Vui lòng liên hệ Quản lý.`);
      return;
    }
    setEditingCell({ userId, dayKey, memberName, dateLabel });
    setModalOpen(true);
  };

  const toggleShiftForCell = (shiftId: string) => {
    if (!editingCell) return;
    const isSelf = user?.uid === editingCell.userId;
    if (shiftId === 'delivery' || shiftId === 'giaohang') {
      if (!canEditDelivery && !isSelf) return;
    } else {
      if (!canEditSchedule && !isSelf) return;
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
    if (!storeId || !user) return;
    setSaving(true);
    try {
      if (!canEditSchedule && !canEditDelivery) {
        if (pastDeadline) {
          showToast(`Đã qua hạn đăng ký (${formatDeadline(currentWeek)}). Vui lòng liên hệ Quản lý!`);
          setSaving(false);
          return;
        }
        // Employee saving their own shifts
        const mySchedule = shifts[user.uid] || { monday:[], tuesday:[], wednesday:[], thursday:[], friday:[], saturday:[], sunday:[] };
        const memberName = currentMember?.name || user.displayName || user.email?.split('@')[0] || 'Nhân viên';
        await saveUserSchedule(storeId, user.uid, currentWeek, mySchedule, memberName);
        setSaving(false);
        showToast('Đã lưu lịch làm của bạn thành công!');
        return;
      }

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

      await saveWeekSchedule(storeId, currentWeek, sanitizedShifts, user?.uid);
      setSaving(false);
      showToast('Đã lưu lịch làm việc thành công!');
    } catch (e) {
      console.error('Error saving schedule:', e);
      setSaving(false);
      showToast('Lỗi khi lưu lịch làm: ' + e);
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

  // LƯU Ý: Thống kê giờ công dự kiến tính theo LỊCH ĐÃ XẾP (shifts) của tuần được chọn
  // (không phải giờ chấm công thực tế attendances, để quản lý tiện đối chiếu định mức xếp ca).
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
  const deliveryAllowance = Number(store?.deliveryAllowance || 0);
  const giaoHangAllowance = Number(store?.giaoHangAllowance || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Lịch làm việc</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Đăng ký và theo dõi lịch làm việc các ca trong tuần
          </p>
        </div>

        {/* Tab switchers */}
        <div style={{ display: 'flex', width: '100%', maxWidth: 420, background: 'var(--surface)', padding: 4, borderRadius: 12, border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => handleTabSwitch('register')}
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'register' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'register' ? 'white' : 'var(--neutral)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s'
            }}
          >
            <span>✏️</span>
            <span>Đăng ký lịch</span>
            {isDirty && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff6b6b' }} />}
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('store')}
            style={{
              flex: 1,
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'store' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'store' ? 'white' : 'var(--neutral)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s'
            }}
          >
            <span>🏪</span>
            <span>Lịch cửa hàng</span>
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={goToCurrentWeek} className="btn btn-secondary btn-sm">
            📅 Tuần này
          </button>
          {activeTab === 'store' && (
            <button onClick={handleExport} className="btn btn-primary btn-sm" style={{ background: 'var(--success)' }}>
              📥 Xuất Excel
            </button>
          )}
          {activeTab === 'store' && (canInteract || !pastDeadline) && (
            <button onClick={saveChanges} className="btn btn-primary btn-sm" disabled={saving || loading || (!canInteract && pastDeadline)}>
              {saving ? 'Đang lưu...' : '💾 Lưu lịch'}
            </button>
          )}
          {activeTab === 'register' && (
            <button
              onClick={handleSaveUserRegistration}
              className="btn btn-primary btn-sm"
              disabled={registerSaving || loading || isBlocked}
              title={isBlocked ? `Đã quá hạn đăng ký (${formatDeadline(currentWeek)})` : ''}
              style={{
                opacity: isBlocked ? 0.6 : 1,
                cursor: isBlocked ? 'not-allowed' : 'pointer'
              }}
            >
              {registerSaving ? 'Đang lưu...' : (isBlocked ? '🔒 Hết hạn' : (isDirty ? '💾 Lưu đăng ký *' : '💾 Lưu đăng ký'))}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => changeWeek(-1)}>
            <span className="hide-on-mobile">← Tuần trước</span>
            <span className="hide-on-desktop">← Trước</span>
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--neutral)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span>Tuần {getWeekNumber(currentWeek)}</span>
              {isThisWeek ? (
                <span style={{ fontSize: 11, background: '#E6FCF5', color: '#0CA678', padding: '2px 8px', borderRadius: 10, fontWeight: 700, border: '1px solid #96F2D7' }}>
                  Tuần hiện tại
                </span>
              ) : (
                <button
                  type="button"
                  onClick={goToCurrentWeek}
                  style={{
                    fontSize: 11,
                    background: 'var(--surface)',
                    color: 'var(--primary)',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontWeight: 700,
                    border: '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  📅 Về tuần này
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {datesInWeek[0]} → {datesInWeek[6]} ({currentWeek})
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => changeWeek(1)}>
            <span className="hide-on-mobile">Tuần sau →</span>
            <span className="hide-on-desktop">Sau →</span>
          </button>
        </div>

        {/* Deadline Warning Banners */}
        {activeTab === 'register' && (
          isBlocked ? (
            <div style={{
              background: '#FFF4E6',
              borderBottom: '1px solid #FFE066',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#D9480F'
            }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  Đã qua hạn đăng ký ({formatDeadline(currentWeek)}). Vui lòng liên hệ quản lý.
                </div>
                <div style={{ fontSize: 12, color: '#C92A2A', marginTop: 2 }}>
                  Theo quy định, nhân viên chốt ca trước 23:59 Thứ 6 của tuần trước. Bạn chỉ có thể xem lịch đã đăng ký.
                </div>
              </div>
            </div>
          ) : pastDeadline && canEditSchedule ? (
            <div style={{
              background: '#E7F5FF',
              borderBottom: '1px solid #A5D8FF',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#1971C2',
              fontSize: 13
            }}>
              <span>ℹ️</span>
              <div>
                <strong>Chế độ Quản lý:</strong> Đã qua hạn đăng ký thông thường của nhân viên ({formatDeadline(currentWeek)}). Bạn có quyền điều chỉnh và lưu lịch bất kỳ lúc nào.
              </div>
            </div>
          ) : (
            <div style={{
              background: '#E6FCF5',
              borderBottom: '1px solid #96F2D7',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#0CA678',
              fontSize: 13
            }}>
              <span>⏰</span>
              <div>
                Hạn chót đăng ký tuần này: <strong>{formatDeadline(currentWeek)}</strong> (Thứ 6 tuần trước khi bắt đầu tuần làm).
              </div>
            </div>
          )
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><span className="spinner spinner-primary" /></div>
        ) : activeTab === 'register' ? (
          <div style={{ padding: 20 }}>
            <div style={{
              background: 'var(--primary-light)',
              border: '1px solid rgba(26, 107, 90, 0.2)',
              borderRadius: 14,
              padding: '14px 18px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Đăng ký lịch làm: {currentMember?.name || user?.displayName || user?.email}</span>
                  {isDirty && (
                    <span style={{ fontSize: 11, background: '#FFE066', color: '#D9480F', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                      Có thay đổi chưa lưu
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Chọn các ca làm việc mong muốn cho từng ngày trong tuần. Nhấn vào ca để chọn / bỏ chọn.
                </div>
              </div>
              <button
                onClick={handleSaveUserRegistration}
                disabled={registerSaving || isBlocked}
                className="btn btn-primary"
                style={{
                  padding: '8px 20px',
                  fontSize: 14,
                  opacity: isBlocked ? 0.6 : 1,
                  cursor: isBlocked ? 'not-allowed' : 'pointer'
                }}
              >
                {registerSaving ? 'Đang lưu...' : (isBlocked ? '🔒 Hết hạn đăng ký' : (isDirty ? '💾 Lưu đăng ký *' : '💾 Lưu đăng ký của bạn'))}
              </button>
            </div>

            {/* 7 Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {DAY_KEYS.map((dayKey, i) => {
                const dayLabel = DAY_LABELS[i];
                const dateStr = datesInWeek[i];
                const selectedShifts = registerDraft[dayKey] || [];
                const normalShifts = selectedShifts.filter(s => s !== 'delivery' && s !== 'giaohang');
                const hasNormal = normalShifts.length > 0;
                const hasDelivery = selectedShifts.includes('delivery');
                const hasGiaoHang = selectedShifts.includes('giaohang');
                const isOff = selectedShifts.length === 0;

                return (
                  <div
                    key={dayKey}
                    style={{
                      background: 'var(--surface)',
                      borderRadius: 14,
                      border: isOff ? '1px solid var(--border)' : '2px solid var(--primary)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      transition: 'all 0.15s',
                      opacity: isBlocked ? 0.88 : 1
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--neutral)' }}>{dayLabel}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginLeft: 8 }}>({dateStr})</span>
                      </div>
                      {!isOff && (
                        <button
                          type="button"
                          disabled={isBlocked}
                          onClick={() => clearRegisterDay(dayKey)}
                          style={{
                            border: 'none',
                            background: isBlocked ? '#f1f3f5' : '#ffebee',
                            color: isBlocked ? '#868e96' : '#c62828',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: 6,
                            cursor: isBlocked ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Nghỉ
                        </button>
                      )}
                    </div>

                    {/* Shift options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {customShifts.map((shift) => {
                        const shiftEntry = selectedShifts.find(s => s === shift.id || s.startsWith(`${shift.id}|`));
                        const isSelected = !!shiftEntry;
                        const selectedDeptId = (isSelected && shiftEntry.includes('|')) ? shiftEntry.split('|')[1] : '';
                        const sh = String(shift.startHour).padStart(2, '0');
                        const sm = String(shift.startMinute).padStart(2, '0');
                        const eh = String(shift.endHour).padStart(2, '0');
                        const em = String(shift.endMinute).padStart(2, '0');
                        const timeStr = `${sh}:${sm} - ${eh}:${em}`;

                        return (
                          <div key={shift.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <button
                              type="button"
                              disabled={isBlocked}
                              onClick={() => toggleRegisterShift(dayKey, shift.id)}
                              style={{
                                padding: '10px 14px',
                                borderRadius: 10,
                                border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                                background: isSelected ? 'var(--primary)' : 'white',
                                color: isSelected ? 'white' : 'var(--neutral)',
                                cursor: isBlocked ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                textAlign: 'left',
                                fontWeight: 600,
                                fontSize: 13,
                                transition: 'all 0.15s',
                                opacity: isBlocked && !isSelected ? 0.6 : 1
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                  width: 18, height: 18, borderRadius: '50%',
                                  border: isSelected ? '2px solid white' : '2px solid #ccc',
                                  background: isSelected ? 'white' : 'transparent',
                                  color: 'var(--primary)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 11, fontWeight: 800
                                }}>
                                  {isSelected ? '✓' : ''}
                                </span>
                                <span>{shift.name}</span>
                              </div>
                              <span style={{ fontSize: 11, opacity: isSelected ? 0.9 : 0.6 }}>{timeStr}</span>
                            </button>

                            {/* Department selector when shift is selected */}
                            {isSelected && store?.departments && store.departments.length > 0 && (isOwner || store.departmentSelectionEnabled !== false) && (
                              <div style={{ padding: '4px 8px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginBottom: 2, fontWeight: 600 }}>Bộ phận cho ca này:</div>
                                <select
                                  value={selectedDeptId}
                                  disabled={isBlocked}
                                  onChange={(e) => setRegisterShiftDepartment(dayKey, shift.id, e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    fontSize: 12,
                                    cursor: isBlocked ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  <option value="">-- Mặc định --</option>
                                  {store.departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.shortName})</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Special Shifts / Allowances (Chở hàng / Giao hàng) */}
                    <div style={{
                      marginTop: 4,
                      paddingTop: 8,
                      borderTop: '1px dashed var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                        Phụ cấp & Ca đặc biệt
                      </div>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: hasDelivery ? '1px solid #FFE066' : '1px solid var(--border)',
                        background: hasDelivery ? '#FFF9DB' : 'white',
                        cursor: (hasNormal && !isBlocked) ? 'pointer' : 'not-allowed',
                        opacity: hasNormal ? 1 : 0.5,
                        transition: 'all 0.15s'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            disabled={!hasNormal || isBlocked}
                            checked={hasDelivery}
                            onChange={() => toggleRegisterSpecial(dayKey, 'delivery')}
                            style={{ transform: 'scale(1.1)', cursor: (hasNormal && !isBlocked) ? 'pointer' : 'not-allowed' }}
                          />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: hasDelivery ? '#D9480F' : 'var(--neutral)' }}>
                            📦 Chở hàng
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#D9480F' }}>
                          +{deliveryAllowance.toLocaleString()}đ
                        </span>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: hasGiaoHang ? '1px solid #FFE066' : '1px solid var(--border)',
                        background: hasGiaoHang ? '#FFF9DB' : 'white',
                        cursor: (hasNormal && !isBlocked) ? 'pointer' : 'not-allowed',
                        opacity: hasNormal ? 1 : 0.5,
                        transition: 'all 0.15s'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            disabled={!hasNormal || isBlocked}
                            checked={hasGiaoHang}
                            onChange={() => toggleRegisterSpecial(dayKey, 'giaohang')}
                            style={{ transform: 'scale(1.1)', cursor: (hasNormal && !isBlocked) ? 'pointer' : 'not-allowed' }}
                          />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: hasGiaoHang ? '#D9480F' : 'var(--neutral)' }}>
                            🛵 Giao hàng
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#D9480F' }}>
                          +{giaoHangAllowance.toLocaleString()}đ
                        </span>
                      </label>

                      {!hasNormal && (
                        <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          * Cần chọn ít nhất 1 ca làm để chọn phụ cấp
                        </div>
                      )}
                    </div>

                    {/* Status footer for this day */}
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: isOff ? 'var(--text-secondary)' : 'var(--primary)'
                    }}>
                      <span>{isOff ? '💤 Nghỉ' : `Đã chọn: ${normalShifts.length} ca`}</span>
                      {!isOff && (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          {hasDelivery && <span style={{ fontSize: 10, background: '#FFF9DB', color: '#D9480F', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>📦 Chở</span>}
                          {hasGiaoHang && <span style={{ fontSize: 10, background: '#FFF9DB', color: '#D9480F', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>🛵 Giao</span>}
                          <span>⏱️ {calculateDayHours(selectedShifts)}h</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom summary bar */}
            <div style={{
              marginTop: 24,
              padding: '18px 24px',
              borderRadius: 14,
              background: 'white',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16
            }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tổng ca đăng ký: </span>
                  <strong style={{ fontSize: 16, color: 'var(--neutral)' }}>
                    {DAY_KEYS.reduce((sum, k) => sum + (registerDraft[k]?.filter(s => s !== 'delivery' && s !== 'giaohang').length || 0), 0)} ca
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tổng giờ dự kiến: </span>
                  <strong style={{ fontSize: 16, color: 'var(--primary)' }}>
                    {DAY_KEYS.reduce((sum, k) => sum + calculateDayHours(registerDraft[k]), 0).toFixed(1)}h
                  </strong>
                </div>
                {DAY_KEYS.some(k => registerDraft[k]?.includes('delivery')) && (
                  <div style={{ fontSize: 12, color: '#D9480F', fontWeight: 600 }}>
                    📦 {DAY_KEYS.filter(k => registerDraft[k]?.includes('delivery')).length} ca chở
                  </div>
                )}
                {DAY_KEYS.some(k => registerDraft[k]?.includes('giaohang')) && (
                  <div style={{ fontSize: 12, color: '#D9480F', fontWeight: 600 }}>
                    🛵 {DAY_KEYS.filter(k => registerDraft[k]?.includes('giaohang')).length} ca giao
                  </div>
                )}
                {isDirty && (
                  <span style={{ fontSize: 12, background: '#FFF3BF', color: '#D9480F', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                    ⚠️ Có thay đổi chưa lưu
                  </span>
                )}
              </div>

              <button
                onClick={handleSaveUserRegistration}
                disabled={registerSaving || isBlocked}
                className="btn btn-primary"
                style={{
                  padding: '12px 32px',
                  fontSize: 15,
                  fontWeight: 700,
                  opacity: isBlocked ? 0.6 : 1,
                  cursor: isBlocked ? 'not-allowed' : 'pointer'
                }}
              >
                {registerSaving ? 'Đang lưu...' : (isBlocked ? '🔒 ĐÃ HẾT HẠN ĐĂNG KÝ' : (isDirty ? '💾 LƯU ĐĂNG KÝ (CÓ THAY ĐỔI CHƯA LƯU)' : '💾 LƯU ĐĂNG KÝ LỊCH LÀM'))}
              </button>
            </div>
          </div>
        ) : (
          <div className="touch-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table className="table" style={{ minWidth: 1100, borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <thead>
                <tr>
                  <th style={{ width: 190, paddingLeft: 16, position: 'sticky', left: 0, zIndex: 10, background: 'var(--surface)', boxShadow: '2px 0 6px rgba(0,0,0,0.06)' }}>Nhân viên</th>
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
                  <td style={{ padding: '10px 14px', borderRadius: '8px 0 0 8px', minWidth: 190, position: 'sticky', left: 0, zIndex: 8, background: '#F8F9FA', boxShadow: '2px 0 6px rgba(0,0,0,0.06)' }}>
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
                      background: draggedMemberIdx === idx ? 'rgba(200, 16, 46, 0.05)' : (m.userId === user?.uid ? '#f0fdf4' : 'white'), 
                      boxShadow: m.userId === user?.uid ? '0 0 0 1px #86efac' : '0 1px 3px rgba(0,0,0,0.05)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <td style={{
                      padding: '10px 14px',
                      borderRadius: '8px 0 0 8px',
                      minWidth: 200,
                      position: 'sticky',
                      left: 0,
                      zIndex: 6,
                      background: m.userId === user?.uid ? '#f0fdf4' : 'white',
                      boxShadow: '2px 0 6px rgba(0,0,0,0.06)'
                    }}>
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
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              alt={m.name}
                              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                            />
                          ) : (
                            <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{m.name[0]}</div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                              {m.name}
                              {m.userId === user?.uid && (
                                <span style={{ fontSize: 10, background: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                  Tôi
                                </span>
                              )}
                              {isHidden && (
                                <span style={{ fontSize: 10, background: '#FFF3BF', color: '#D9480F', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                                  Ẩn
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                              <span>{getRoleLabel(m.role)}</span>
                              <span>•</span>
                              <span style={{ fontWeight: 600, color: 'var(--neutral)' }}>
                                ⏱️ {memberHours > 0 ? (memberHours % 1 === 0 ? `${memberHours}h` : `${memberHours.toFixed(1)}h`) : '0h'}
                              </span>
                              {memberDelivery > 0 && (
                                <span style={{ fontWeight: 600, color: '#D9480F' }}>
                                  • 📦 {memberDelivery}
                                </span>
                              )}
                            </div>
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
                            onClick={() => {
                              const isSelf = m.userId === user?.uid;
                              if (!canInteract && !isSelf) return;
                              if (isSelf && !canEditSchedule && pastDeadline) {
                                showToast(`Đã qua hạn đăng ký (${formatDeadline(currentWeek)}). Vui lòng liên hệ Quản lý.`);
                                return;
                              }
                              openModal(m.userId, dayKey, m.name, `${DAY_LABELS[i]} ${datesInWeek[i]}`);
                            }}
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
                              cursor: (canInteract || (m.userId === user?.uid && !pastDeadline)) ? 'pointer' : 'default',
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

            {(() => {
              const isSelf = user?.uid === editingCell.userId;
              const canEditShift = canEditSchedule || (isSelf && !pastDeadline);

              return (
                <>
                  {isSelf && !canEditSchedule && pastDeadline && (
                    <div style={{ fontSize: 12, color: '#C92A2A', background: '#FFF5F5', padding: '8px 12px', borderRadius: 8, marginBottom: 14, fontWeight: 600, border: '1px solid #FFC9C9', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🔒</span>
                      <span>Đã qua hạn đăng ký ({formatDeadline(currentWeek)}). Bạn chỉ có thể xem ca làm việc này.</span>
                    </div>
                  )}

                  {!canEditSchedule && canEditDelivery && !isSelf && (
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
                          opacity: canEditShift ? 1 : (isSelected ? 0.95 : 0.45)
                        }}>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                            cursor: canEditShift ? 'pointer' : 'not-allowed',
                            background: isSelected ? 'var(--primary)' : 'transparent',
                            color: isSelected ? 'white' : 'var(--text-primary)'
                          }}>
                            <input 
                              type="checkbox" 
                              disabled={!canEditShift}
                              checked={isSelected}
                              onChange={() => canEditShift && toggleShiftForCell(shift.id)}
                              style={{ transform: 'scale(1.2)', cursor: canEditShift ? 'pointer' : 'not-allowed' }}
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
                                disabled={!canEditShift}
                                value={selectedDeptId}
                                onChange={(e) => {
                                  if (!canEditShift) return;
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
                                style={{ width: '100%', padding: '6px 10px', fontSize: 13, cursor: canEditShift ? 'pointer' : 'not-allowed' }}
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
                </>
              );
            })()}

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

      {/* Floating Non-Blocking Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          background: toastMessage.startsWith('Lỗi') ? '#C8102E' : '#1A6B5A',
          color: 'white',
          padding: '14px 24px',
          borderRadius: 12,
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          fontWeight: 700,
          fontSize: 14,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'all 0.3s ease'
        }}>
          <span>{toastMessage.startsWith('Lỗi') ? '❌' : '✅'}</span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
