import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { db } from './firebase';
import {
  collection, doc, query, where, getDocs, getDoc,
  updateDoc, addDoc, orderBy, Timestamp, onSnapshot,
  setDoc, limit, DocumentSnapshot, deleteDoc, collectionGroup,
  arrayUnion, arrayRemove, writeBatch, serverTimestamp, deleteField
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Member, AttendanceRecord, Store, ScheduleModel, DaySchedule,
  AdvanceRequest, ProductionTask, ProductionReport, ProductionTaskEntry,
  AppNotification, normalizeRole, CheckInMethod,
  AssignedTask, TaskSubmission, TaskTargetType, TaskStatus
} from './types';

export async function getUserStoresData(uid: string): Promise<{ stores: Store[]; currentStoreId: string | null }> {
  try {
    const storeMap = new Map<string, Store>();
    const foundStoreIds = new Set<string>();
    let currentStoreId: string | null = null;
    let userHasStoreIds = false;

    // 1. Get storeIds & currentStoreId from users/{uid} document in 1 read
    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        const ids: string[] = uData?.storeIds || [];
        ids.forEach(id => { if (id) foundStoreIds.add(id); });
        if (uData?.currentStoreId) {
          foundStoreIds.add(uData.currentStoreId);
          currentStoreId = uData.currentStoreId;
        }
        if (ids.length > 0) {
          userHasStoreIds = true;
        }
      }
    } catch (e) {
      console.error('Error reading user document:', e);
    }

    // 2. Only fallback to collectionGroup if user doc had NO storeIds recorded
    if (!userHasStoreIds && foundStoreIds.size === 0) {
      try {
        const qMembers = query(collectionGroup(db, 'members'), where('userId', '==', uid));
        const mSnap = await getDocs(qMembers);
        for (const mDoc of mSnap.docs) {
          const storeRef = mDoc.ref.parent.parent;
          if (storeRef) {
            foundStoreIds.add(storeRef.id);
          }
        }
      } catch (e) {
        console.error('Error querying members collection group fallback:', e);
      }
    }

    // 3. Fetch store documents in parallel
    const allIds = Array.from(foundStoreIds);
    await Promise.all(
      allIds.map(async (storeId) => {
        try {
          const sDoc = await getDoc(doc(db, 'stores', storeId));
          if (sDoc.exists()) {
            const data = sDoc.data();
            if (data.status !== 'deleted') {
              storeMap.set(sDoc.id, { id: sDoc.id, ...data } as Store);
            }
          }
        } catch (e) {
          console.error(`Error fetching store ${storeId}:`, e);
        }
      })
    );

    const stores = Array.from(storeMap.values());
    if (!currentStoreId && stores.length > 0) {
      currentStoreId = stores[0].id;
    }

    // Self-heal if needed
    if (!userHasStoreIds && stores.length > 0) {
      const resultIds = stores.map(s => s.id);
      updateDoc(doc(db, 'users', uid), {
        storeIds: resultIds,
        currentStoreId: currentStoreId,
      }).catch(() => {});
    }

    return { stores, currentStoreId };
  } catch (err) {
    console.error('Error in getUserStoresData:', err);
    return { stores: [], currentStoreId: null };
  }
}

export async function getUserStoreId(uid: string): Promise<string | null> {
  const { currentStoreId } = await getUserStoresData(uid);
  return currentStoreId;
}

export async function getUserStores(uid: string): Promise<Store[]> {
  const { stores } = await getUserStoresData(uid);
  return stores;
}

export async function getAdvancesInRange(storeId: string, startDate: string, endDate: string): Promise<AdvanceRequest[]> {
  const q = query(
    collection(db, 'stores', storeId, 'advanceRequests'),
    where('monthKey', '>=', startDate.substring(0, 7)),
    where('monthKey', '<=', endDate.substring(0, 7))
  );
  const snap = await getDocs(q);
  // Filter by actual date
  const all = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      requestDate: data.requestDate?.toDate ? data.requestDate.toDate().toISOString() : new Date(data.requestDate).toISOString(),
      approvedDate: data.approvedDate?.toDate ? data.approvedDate.toDate().toISOString() : (data.approvedDate ? new Date(data.approvedDate).toISOString() : undefined),
    } as AdvanceRequest;
  });
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  
  return all.filter(a => {
    const d = new Date(a.requestDate);
    return d >= start && d <= end;
  });
}

export async function switchStore(uid: string, newStoreId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    currentStoreId: newStoreId
  });
}

export function watchMembers(storeId: string, cb: (members: Member[]) => void, onError?: (err: any) => void) {
  const colRef = collection(db, 'stores', storeId, 'members');
  return onSnapshot(
    colRef,
    snap => {
      const list = snap.docs
        .map(d => ({ userId: d.id, ...d.data() } as Member))
        .filter(m => m.status !== 'kicked');
      cb(list);
    },
    err => {
      console.error('Error in watchMembers:', err);
      if (onError) onError(err);
    }
  );
}

export function watchCurrentMember(
  storeId: string,
  uid: string,
  cb: (member: Member | null) => void,
  onError?: (err: any) => void
) {
  const memberDocRef = doc(db, 'stores', storeId, 'members', uid);
  return onSnapshot(
    memberDocRef,
    snap => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      cb({ userId: snap.id, ...snap.data() } as Member);
    },
    err => {
      console.error('Error in watchCurrentMember:', err);
      if (onError) onError(err);
    }
  );
}

export function watchStore(storeId: string, cb: (store: Store | null) => void) {
  return onSnapshot(doc(db, 'stores', storeId), (snap: DocumentSnapshot) => {
    if (!snap.exists()) { cb(null); return; }
    cb({ id: snap.id, ...snap.data() } as Store);
  });
}

export async function getMonthAttendances(storeId: string, month: string): Promise<AttendanceRecord[]> {
  try {
    const q = query(
      collection(db, 'stores', storeId, 'attendances'),
      where('date', '>=', `${month}-01`),
      where('date', '<=', `${month}-31`)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  } catch (err) {
    console.error('Error in getMonthAttendances:', err);
    return [];
  }
}

export async function getAttendancesInRange(storeId: string, startDate: string, endDate: string): Promise<AttendanceRecord[]> {
  try {
    const q = query(
      collection(db, 'stores', storeId, 'attendances'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  } catch (err) {
    console.error('Error in getAttendancesInRange:', err);
    return [];
  }
}

export async function getMemberMonthAttendances(storeId: string, userId: string, month: string): Promise<AttendanceRecord[]> {
  const q = query(
    collection(db, 'stores', storeId, 'attendances'),
    where('userId', '==', userId),
    where('date', '>=', `${month}-01`),
    where('date', '<=', `${month}-31`)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
}

export function getVietnamDateString(d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    const vnTime = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60000);
    return `${vnTime.getFullYear()}-${String(vnTime.getMonth() + 1).padStart(2, '0')}-${String(vnTime.getDate()).padStart(2, '0')}`;
  }
}

export function watchActiveAttendances(
  storeId: string,
  cb: (records: AttendanceRecord[]) => void,
  onError?: (err: any) => void
) {
  const q = query(
    collection(db, 'stores', storeId, 'attendances'),
    where('checkOut', '==', null)
  );
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
    list.sort((a, b) => {
      const tA = a.checkIn?.seconds ? a.checkIn.seconds * 1000 : (a.checkIn ? new Date(a.checkIn).getTime() : 0);
      const tB = b.checkIn?.seconds ? b.checkIn.seconds * 1000 : (b.checkIn ? new Date(b.checkIn).getTime() : 0);
      return tB - tA;
    });
    cb(list);
  }, err => {
    console.error('Error in watchActiveAttendances:', err);
    if (onError) onError(err);
    cb([]);
  });
}

export function watchTodayAttendances(
  storeId: string,
  cb: (records: AttendanceRecord[]) => void,
  onError?: (err: any) => void
) {
  const dateStr = getVietnamDateString();
  const q = query(
    collection(db, 'stores', storeId, 'attendances'),
    where('date', '==', dateStr)
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
  }, err => {
    console.error('Error in watchTodayAttendances:', err);
    if (onError) onError(err);
    cb([]);
  });
}

export async function editAttendance(
  storeId: string, attendanceId: string,
  date: string, checkIn: Date, checkOut: Date, editNote: string, editedBy: string
): Promise<void> {
  const totalHours = (checkOut.getTime() - checkIn.getTime()) / 3600000;
  await updateDoc(doc(db, 'stores', storeId, 'attendances', attendanceId), {
    date,
    checkIn: Timestamp.fromDate(checkIn),
    checkOut: Timestamp.fromDate(checkOut),
    totalHours: parseFloat(totalHours.toFixed(2)),
    isEdited: true,
    editedBy,
    editNote: editNote || 'Chỉnh sửa bởi quản lý',
  });
}

export async function createManualAttendance(
  storeId: string, userId: string, date: string,
  checkIn: Date, checkOut: Date, editNote: string, editedBy: string
): Promise<void> {
  const totalHours = (checkOut.getTime() - checkIn.getTime()) / 3600000;
  await addDoc(collection(db, 'stores', storeId, 'attendances'), {
    userId, storeId, date,
    checkIn: Timestamp.fromDate(checkIn),
    checkOut: Timestamp.fromDate(checkOut),
    checkInMethod: 'manual',
    totalHours: parseFloat(totalHours.toFixed(2)),
    isEdited: true, editedBy,
    editNote: editNote || 'Thêm thủ công',
    isOffline: false,
  });
}

export function watchUserActiveAttendance(
  storeId: string,
  userId: string,
  cb: (record: AttendanceRecord | null) => void,
  onError?: (err: any) => void
) {
  const q = query(
    collection(db, 'stores', storeId, 'attendances'),
    where('userId', '==', userId),
    where('checkOut', '==', null)
  );
  return onSnapshot(q, snap => {
    if (snap.empty) {
      cb(null);
    } else {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      // Sắp xếp giảm dần theo checkIn để luôn lấy ca đang làm gần nhất
      list.sort((a, b) => {
        const tA = a.checkIn?.seconds ? a.checkIn.seconds * 1000 : (a.checkIn ? new Date(a.checkIn).getTime() : 0);
        const tB = b.checkIn?.seconds ? b.checkIn.seconds * 1000 : (b.checkIn ? new Date(b.checkIn).getTime() : 0);
        return tB - tA;
      });
      cb(list[0]);
    }
  }, err => {
    console.error('Error in watchUserActiveAttendance:', err);
    if (onError) onError(err);
    cb(null);
  });
}

export function watchUserTodayAttendances(
  storeId: string,
  userId: string,
  dateStr: string,
  cb: (records: AttendanceRecord[]) => void
) {
  const q = query(
    collection(db, 'stores', storeId, 'attendances'),
    where('userId', '==', userId),
    where('date', '==', dateStr)
  );
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
    cb(list);
  }, err => {
    console.error('Error in watchUserTodayAttendances:', err);
    cb([]);
  });
}

export async function webCheckIn(
  storeId: string,
  userId: string,
  method: CheckInMethod = 'wifi',
  storeName?: string,
  memberName?: string
): Promise<string> {
  const now = new Date();
  const dateStr = getVietnamDateString(now);

  // Kiểm tra xem có ca nào đang hoạt động không (bất kể ngày nào để xử lý ca xuyên đêm)
  const activeQ = query(
    collection(db, 'stores', storeId, 'attendances'),
    where('userId', '==', userId),
    where('checkOut', '==', null)
  );
  const activeSnap = await getDocs(activeQ);
  if (!activeSnap.empty) {
    throw new Error('Bạn đang trong một ca làm việc chưa kết thúc.');
  }

  const docRef = await addDoc(collection(db, 'stores', storeId, 'attendances'), {
    userId,
    storeId,
    date: dateStr,
    checkIn: Timestamp.fromDate(now),
    checkOut: null,
    checkInMethod: method,
    totalHours: 0.0,
    isEdited: false,
    editedBy: null,
    editNote: null,
    isOffline: false,
  });

  // Gửi thông báo đến Quản lý & Chủ cửa hàng
  try {
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await addDoc(collection(db, 'stores', storeId, 'notifications'), {
      storeId,
      title: 'Nhân viên vào ca',
      body: `${memberName || 'Nhân viên'} tại ${storeName || 'Cửa hàng'} đã vào ca lúc ${timeStr} (Web).`,
      type: 'check_in',
      createdAt: Timestamp.fromDate(now),
      targetRoles: ['owner', 'manager_1', 'manager_2', 'manager', 'legacyManager', 'manager1', 'manager2'],
      readBy: [userId],
      routePath: '/active-staff',
      routeExtra: { storeId, userId, date: dateStr },
    });
  } catch (err) {
    console.warn('[webCheckIn] Notification error:', err);
  }

  return docRef.id;
}

export async function webCheckOut(
  storeId: string,
  attendanceId: string,
  userId: string,
  storeName?: string,
  memberName?: string
): Promise<number> {
  const now = new Date();
  const attRef = doc(db, 'stores', storeId, 'attendances', attendanceId);
  const snap = await getDoc(attRef);
  if (!snap.exists()) {
    throw new Error('Không tìm thấy ca làm việc.');
  }
  const data = snap.data();
  if (data.checkOut != null) {
    throw new Error('Ca làm việc này đã được kết thúc trước đó.');
  }

  const checkInDate = data.checkIn?.toDate ? data.checkIn.toDate() : new Date(data.checkIn.seconds * 1000);
  const diffMs = now.getTime() - checkInDate.getTime();
  const hours = Math.max(0, diffMs / 3600000);
  const totalHours = parseFloat(hours.toFixed(2));

  await updateDoc(attRef, {
    checkOut: Timestamp.fromDate(now),
    totalHours,
  });

  // Gửi thông báo đến Quản lý & Chủ cửa hàng
  try {
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await addDoc(collection(db, 'stores', storeId, 'notifications'), {
      storeId,
      title: 'Nhân viên kết thúc ca',
      body: `${memberName || 'Nhân viên'} tại ${storeName || 'Cửa hàng'} đã kết thúc ca lúc ${timeStr} (Tổng: ${totalHours.toFixed(1)}h).`,
      type: 'check_out',
      createdAt: Timestamp.fromDate(now),
      targetRoles: ['owner', 'manager_1', 'manager_2', 'manager', 'legacyManager', 'manager1', 'manager2'],
      readBy: [userId],
      routePath: '/attendance-table',
      routeExtra: { storeId, userId, date: data.date },
    });
  } catch (err) {
    console.warn('[webCheckOut] Notification error:', err);
  }

  return totalHours;
}

export async function setMemberStatus(storeId: string, userId: string, status: 'active' | 'kicked') {
  await updateDoc(doc(db, 'stores', storeId, 'members', userId), { status });
}

export async function updateMemberRole(storeId: string, userId: string, role: string) {
  await updateDoc(doc(db, 'stores', storeId, 'members', userId), { role });
}

export async function transferStoreOwnershipOnWeb(
  storeId: string,
  newOwnerId: string,
  currentOwnerId: string,
  newOwnerName?: string
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Cập nhật stores/{storeId}.ownerId
  const storeRef = doc(db, 'stores', storeId);
  batch.update(storeRef, {
    ownerId: newOwnerId,
    updatedAt: serverTimestamp(),
  });

  // 2. Thăng cấp newOwnerId thành 'owner'
  const newOwnerRef = doc(db, 'stores', storeId, 'members', newOwnerId);
  batch.update(newOwnerRef, {
    role: 'owner',
    promotedAt: serverTimestamp(),
    promotedReason: 'ownership_transfer_web',
  });

  // 3. Giáng cấp currentOwnerId thành 'manager_1' nếu khác newOwnerId
  if (currentOwnerId && currentOwnerId !== newOwnerId) {
    const currentOwnerRef = doc(db, 'stores', storeId, 'members', currentOwnerId);
    batch.update(currentOwnerRef, {
      role: 'manager_1',
    });
  }

  // 4. Ghi vết kiểm toán (Audit Trail)
  const auditRef = doc(collection(db, 'stores', storeId, 'audit_logs'));
  batch.set(auditRef, {
    action: 'ownership_transfer',
    storeId,
    previousOwnerId: currentOwnerId,
    newOwnerId,
    newOwnerName: newOwnerName || '',
    source: 'web_dashboard',
    timestamp: serverTimestamp(),
  });

  await batch.commit();
}

export async function updateMemberSalary(
  storeId: string, userId: string,
  employeeType: string, salary: number, standardHours: number
) {
  await updateDoc(doc(db, 'stores', storeId, 'members', userId), {
    employeeType,
    ...(employeeType === 'fulltime' ? { baseMonthlySalary: salary } : { baseHourlyRate: salary }),
    standardHoursPerMonth: standardHours,
  });
}

export async function updateMemberInfo(storeId: string, userId: string, data: Record<string, any>) {
  await updateDoc(doc(db, 'stores', storeId, 'members', userId), data);
}

export async function updateMemberOrder(storeId: string, memberOrder: string[]): Promise<void> {
  await updateDoc(doc(db, 'stores', storeId), { memberOrder });
}

export async function toggleHideMemberSchedule(storeId: string, userId: string, hide: boolean): Promise<void> {
  if (hide) {
    await updateDoc(doc(db, 'stores', storeId), {
      hiddenScheduleUserIds: arrayUnion(userId)
    });
  } else {
    await updateDoc(doc(db, 'stores', storeId), {
      hiddenScheduleUserIds: arrayRemove(userId)
    });
  }
}

export async function getWeekSchedule(storeId: string, weekStart: string): Promise<ScheduleModel | null> {
  try {
    const scheduleRef = doc(db, 'stores', storeId, 'schedules', weekStart);
    const snap = await getDoc(scheduleRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ScheduleModel;
  } catch (err) {
    console.error('Error in getWeekSchedule:', err);
    return null;
  }
}

export function watchWeekSchedule(
  storeId: string,
  weekStart: string,
  cb: (schedule: ScheduleModel | null) => void
) {
  const scheduleRef = doc(db, 'stores', storeId, 'schedules', weekStart);
  return onSnapshot(scheduleRef, (snap) => {
    if (!snap.exists()) {
      cb(null);
    } else {
      cb({ id: snap.id, ...snap.data() } as ScheduleModel);
    }
  }, (err) => {
    console.error('Error in watchWeekSchedule:', err);
    cb(null);
  });
}

export async function getSchedulesInRange(storeId: string, startDateStr: string, endDateStr: string): Promise<ScheduleModel[]> {
  try {
    const q = query(
      collection(db, 'stores', storeId, 'schedules'),
      where('weekStart', '>=', startDateStr),
      where('weekStart', '<=', endDateStr)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleModel));
  } catch (err) {
    console.error('Error in getSchedulesInRange:', err);
    return [];
  }
}

// ---------------- Advances ----------------
export async function createAdvanceRequest(storeId: string, data: Omit<AdvanceRequest, 'id'>): Promise<string> {
  const collRef = collection(db, 'stores', storeId, 'advances');
  const docRef = await addDoc(collRef, data);
  return docRef.id;
}

export async function updateAdvanceRequestStatus(storeId: string, advanceId: string, status: 'approved' | 'rejected', approvedDate?: string) {
  const docRef = doc(db, 'stores', storeId, 'advances', advanceId);
  const updateData: any = { status };
  if (approvedDate) {
    updateData.approvedDate = approvedDate;
  }
  await updateDoc(docRef, updateData);
}

export function watchAdvances(storeId: string, month: string, cb: (advances: AdvanceRequest[]) => void) {
  const q = query(
    collection(db, 'stores', storeId, 'advances'),
    where('month', '==', month)
  );
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AdvanceRequest));
    list.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
    cb(list);
  });
}



export async function saveWeekSchedule(
  storeId: string,
  weekStart: string,
  shifts: Record<string, DaySchedule>,
  updatedBy?: string
): Promise<void> {
  // Ghi trực tiếp vào Firestore để đảm bảo luôn hoạt động ổn định và tức thì (không phụ thuộc Cloud Function)
  const scheduleRef = doc(db, 'stores', storeId, 'schedules', weekStart);
  try {
    const snap = await getDoc(scheduleRef);
    const existingShifts = snap.exists() ? (snap.data().shifts || {}) : {};
    const mergedShifts = { ...existingShifts, ...shifts };
    await setDoc(scheduleRef, {
      storeId,
      weekStart,
      shifts: mergedShifts,
      updatedAt: Timestamp.now(),
      ...(updatedBy ? { updatedBy } : {}),
    }, { merge: true });
  } catch (_) {
    await setDoc(scheduleRef, {
      storeId,
      weekStart,
      shifts,
      updatedAt: Timestamp.now(),
      ...(updatedBy ? { updatedBy } : {}),
    }, { merge: true });
  }

  // Gửi thông báo đến toàn bộ nhân viên/quản lý trong cửa hàng
  try {
    const now = Timestamp.now();
    await addDoc(collection(db, 'stores', storeId, 'notifications'), {
      storeId,
      title: 'Lịch làm việc đã cập nhật',
      body: `Lịch làm việc tuần (${weekStart}) đã được cập nhật. Nhấn để xem chi tiết ca làm việc của bạn.`,
      type: 'schedule_changed',
      createdAt: now,
      targetRoles: ['employee', 'manager_1', 'manager_2', 'manager', 'legacyManager', 'owner'],
      readBy: updatedBy ? [updatedBy] : [],
      routePath: '/dashboard/schedule',
      routeExtra: { storeId, weekStart },
    });
  } catch (notifErr) {
    console.warn('[saveWeekSchedule] Could not post schedule notification:', notifErr);
  }
}

export async function saveUserSchedule(
  storeId: string,
  userId: string,
  weekStart: string,
  schedule: DaySchedule,
  memberName?: string
): Promise<void> {
  const scheduleRef = doc(db, 'stores', storeId, 'schedules', weekStart);
  const now = Timestamp.now();
  await setDoc(scheduleRef, {
    storeId,
    weekStart,
    shifts: {
      [userId]: schedule,
    },
    updatedAt: now,
    updatedBy: userId,
  }, { merge: true });

  // Gửi thông báo đến Quản lý & Chủ cửa hàng (giống logic Mobile)
  try {
    await addDoc(collection(db, 'stores', storeId, 'notifications'), {
      storeId,
      title: 'Đăng ký lịch làm mới',
      body: `${memberName || 'Nhân viên'} vừa đăng ký lịch làm việc tuần (${weekStart}).`,
      type: 'schedule_changed',
      createdAt: now,
      targetRoles: ['owner', 'manager_1', 'manager', 'legacyManager', 'manager1'],
      readBy: [userId],
      routePath: '/dashboard/schedule',
      routeExtra: { storeId, weekStart, userId },
    });
  } catch (notifErr) {
    console.warn('[saveUserSchedule] Could not post schedule notification:', notifErr);
  }
}

export async function updateStore(storeId: string, data: Record<string, any>) {
  await updateDoc(doc(db, 'stores', storeId), data);
}

/**
 * Mật khẩu xác nhận xóa dữ liệu lưu ở stores/{storeId}/private/settings
 * (chỉ Chủ / Quản lý 1 đọc được). Trường cũ `deletePassword` trên tài liệu cửa hàng
 * ai đăng nhập cũng đọc được nên chỉ dùng làm dữ liệu chuyển tiếp.
 */
const DEFAULT_DELETE_PASSWORD = '123456';

export async function getStoreDeletePassword(storeId: string, legacyPassword?: string): Promise<string> {
  const snap = await getDoc(doc(db, 'stores', storeId, 'private', 'settings'));
  const value = snap.exists() ? snap.data()?.deletePassword : undefined;
  if (typeof value === 'string' && value) return value;
  // Chưa chuyển: chép mật khẩu cũ sang chỗ riêng và xóa khỏi tài liệu công khai
  if (legacyPassword) {
    await setStoreDeletePassword(storeId, legacyPassword);
    return legacyPassword;
  }
  return DEFAULT_DELETE_PASSWORD;
}

export async function setStoreDeletePassword(storeId: string, password: string): Promise<void> {
  await setDoc(
    doc(db, 'stores', storeId, 'private', 'settings'),
    { deletePassword: password, updatedAt: serverTimestamp() },
    { merge: true },
  );
  // Xóa trường cũ (nếu còn) khỏi tài liệu cửa hàng
  await updateDoc(doc(db, 'stores', storeId), { deletePassword: deleteField() });
}

export async function clearAllSchedules(storeId: string): Promise<void> {
  const q = query(collection(db, 'stores', storeId, 'schedules'));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await updateDoc(d.ref, { shifts: {} });
  }
}

export async function deleteAllAttendances(storeId: string): Promise<void> {
  const q = query(collection(db, 'stores', storeId, 'attendances'));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
  }
}

export async function deleteStoreAndCleanup(storeId: string, storeName: string, ownerUid: string): Promise<void> {
  const now = new Date();
  // 1. Soft-delete store doc
  await updateDoc(doc(db, 'stores', storeId), {
    status: 'deleted',
    deletedAt: Timestamp.fromDate(now),
    deletedBy: ownerUid,
  });

  // 2. Fetch all members and remove storeId from their storeIds array
  try {
    const membersSnap = await getDocs(collection(db, 'stores', storeId, 'members'));
    const affectedUserIds = new Set<string>();
    membersSnap.forEach(d => affectedUserIds.add(d.id));
    affectedUserIds.add(ownerUid);

    for (const uid of Array.from(affectedUserIds)) {
      try {
        const userRef = doc(db, 'users', uid);
        const uDoc = await getDoc(userRef);
        if (!uDoc.exists()) continue;
        const uData = uDoc.data() || {};
        const currentStoreId = uData.currentStoreId;
        const userStoreIds: string[] = Array.isArray(uData.storeIds) ? uData.storeIds.filter((id: string) => id !== storeId) : [];

        const newCurrentStoreId = (currentStoreId === storeId)
          ? (userStoreIds.length > 0 ? userStoreIds[0] : null)
          : currentStoreId;

        await updateDoc(userRef, {
          storeIds: userStoreIds,
          currentStoreId: newCurrentStoreId,
        });
      } catch (err) {
        console.error(`Error updating user ${uid} on store deletion:`, err);
      }
    }
  } catch (err) {
    console.error('Error cleaning up members on store deletion:', err);
  }
}

// ─── Production Tasks ────────────────────────────────────────────────────────

export function watchProductionTasks(
  storeId: string,
  cb: (tasks: ProductionTask[]) => void
) {
  const q = query(
    collection(db, 'stores', storeId, 'production_tasks'),
    orderBy('order', 'asc')
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionTask)));
  });
}

export async function addProductionTask(
  storeId: string,
  task: Omit<ProductionTask, 'id'>
): Promise<void> {
  await addDoc(collection(db, 'stores', storeId, 'production_tasks'), {
    ...task,
    createdAt: Timestamp.now(),
  });
}

export async function updateProductionTask(
  storeId: string,
  taskId: string,
  data: Partial<ProductionTask>
): Promise<void> {
  await updateDoc(doc(db, 'stores', storeId, 'production_tasks', taskId), data);
}

export async function deleteProductionTask(
  storeId: string,
  taskId: string
): Promise<void> {
  await deleteDoc(doc(db, 'stores', storeId, 'production_tasks', taskId));
}

export async function reorderProductionTasks(
  storeId: string,
  orderedTasks: { id: string; order: number }[]
): Promise<void> {
  const batch = writeBatch(db);
  orderedTasks.forEach(({ id, order }) => {
    const ref = doc(db, 'stores', storeId, 'production_tasks', id);
    batch.update(ref, { order });
  });
  await batch.commit();
}

// ─── Production Reports ──────────────────────────────────────────────────────

export async function getProductionReports(
  storeId: string,
  month: string // YYYY-MM
): Promise<ProductionReport[]> {
  try {
    const q = query(
      collection(db, 'stores', storeId, 'production_reports'),
      where('date', '>=', `${month}-01`),
      where('date', '<=', `${month}-31`)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductionReport));
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  } catch (err) {
    console.error('Error in getProductionReports:', err);
    return [];
  }
}

export async function addProductionReport(
  storeId: string,
  report: Omit<ProductionReport, 'id'>
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'stores', storeId, 'production_reports'),
    { ...report, createdAt: Timestamp.now() }
  );
  return ref.id;
}

export async function updateProductionReport(
  storeId: string,
  reportId: string,
  data: Partial<ProductionReport>
): Promise<void> {
  await updateDoc(doc(db, 'stores', storeId, 'production_reports', reportId), data);
}

export async function deleteProductionReport(
  storeId: string,
  reportId: string
): Promise<void> {
  await deleteDoc(doc(db, 'stores', storeId, 'production_reports', reportId));
}

// ─── Assigned Tasks (Giao việc) ─────────────────────────────────────────────

export async function createTask(
  storeId: string,
  task: Omit<AssignedTask, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'stores', storeId, 'assigned_tasks'), {
    ...task,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTask(
  storeId: string,
  taskId: string,
  data: Partial<AssignedTask>
): Promise<void> {
  await updateDoc(doc(db, 'stores', storeId, 'assigned_tasks', taskId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(
  storeId: string,
  taskId: string
): Promise<void> {
  await deleteDoc(doc(db, 'stores', storeId, 'assigned_tasks', taskId));
}

export function watchStoreTasks(
  storeId: string,
  callback: (tasks: AssignedTask[]) => void,
  dateStr?: string
): () => void {
  const colRef = collection(db, 'stores', storeId, 'assigned_tasks');
  return onSnapshot(colRef, (snap) => {
    let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignedTask));
    tasks = tasks.filter(t => t.status !== 'archived');
    if (dateStr) {
      tasks = tasks.filter(t => Array.isArray(t.executionDates) && t.executionDates.includes(dateStr));
    }
    callback(tasks);
  }, (err) => {
    console.error('Error in watchStoreTasks:', err);
    callback([]);
  });
}

export async function getTasksForUserOnDate(
  storeId: string,
  userId: string,
  dateStr: string
): Promise<AssignedTask[]> {
  try {
    const q = query(
      collection(db, 'stores', storeId, 'assigned_tasks'),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as AssignedTask));
    return tasks.filter(task => {
      const matchDate = Array.isArray(task.executionDates) && task.executionDates.includes(dateStr);
      if (!matchDate) return false;
      if (task.targetType === 'allStore') return true;
      return Array.isArray(task.assignedUserIds) && task.assignedUserIds.includes(userId);
    });
  } catch (err) {
    console.error('Error in getTasksForUserOnDate:', err);
    return [];
  }
}

export function watchTaskSubmissions(
  storeId: string,
  taskId: string,
  callback: (subs: TaskSubmission[]) => void,
  workDate?: string
): () => void {
  const colRef = collection(db, 'stores', storeId, 'assigned_tasks', taskId, 'submissions');
  const q = workDate ? query(colRef, where('workDate', '==', workDate)) : colRef;
  return onSnapshot(q, (snap) => {
    let subs = snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskSubmission));
    if (workDate) {
      subs = subs.filter(s => s.workDate === workDate);
    }
    callback(subs);
  }, (err) => {
    console.error('Error in watchTaskSubmissions:', err);
    callback([]);
  });
}

export async function saveTaskSubmission(
  storeId: string,
  taskId: string,
  submission: Omit<TaskSubmission, 'lastSavedAt'>
): Promise<void> {
  const ref = doc(db, 'stores', storeId, 'assigned_tasks', taskId, 'submissions', submission.id);
  await setDoc(ref, {
    ...submission,
    lastSavedAt: serverTimestamp(),
  }, { merge: true });
}

export async function uploadTaskPhotoWeb(
  storeId: string,
  taskId: string,
  userId: string,
  dateStr: string,
  file: File
): Promise<string> {
  const storage = getStorage(app);
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `stores/${storeId}/task_reports/${dateStr}/${taskId}/${userId}_${Date.now()}.${ext}`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  const downloadUrl = await getDownloadURL(fileRef);
  return downloadUrl;
}

export async function getUnfinishedTasksForUserOnDate(
  storeId: string,
  userId: string,
  dateStr: string
): Promise<AssignedTask[]> {
  try {
    const tasks = await getTasksForUserOnDate(storeId, userId, dateStr);
    const checks = await Promise.all(
      tasks.map(async (task) => {
        try {
          const subRef = doc(
            db,
            'stores',
            storeId,
            'assigned_tasks',
            task.id,
            'submissions',
            `${userId}_${dateStr}`
          );
          const subSnap = await getDoc(subRef);
          if (!subSnap.exists()) {
            return { task, unfinished: true };
          }
          const data = subSnap.data() as TaskSubmission;
          return { task, unfinished: !data.isCompleted };
        } catch (subErr) {
          console.error(`Error checking submission for task ${task.id}:`, subErr);
          return { task, unfinished: true };
        }
      })
    );

    return checks.filter(c => c.unfinished).map(c => c.task);
  } catch (err) {
    console.error('Error in getUnfinishedTasksForUserOnDate:', err);
    return [];
  }
}

export { watchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from './notifications';
