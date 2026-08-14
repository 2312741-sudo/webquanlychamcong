import { db } from './firebase';
import {
  collection, doc, query, where, getDocs, getDoc,
  updateDoc, addDoc, orderBy, Timestamp, onSnapshot,
  setDoc, limit, DocumentSnapshot, deleteDoc, collectionGroup
} from 'firebase/firestore';
import { Member, AttendanceRecord, Store, ScheduleModel, DaySchedule, AdvanceRequest, ProductionTask, ProductionReport, ProductionTaskEntry } from './types';

export async function getUserStoreId(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    let sid = snap.data()?.currentStoreId ?? null;
    if (!sid) {
      const stores = await getUserStores(uid);
      if (stores.length > 0) {
        sid = stores[0].id;
        await updateDoc(doc(db, 'users', uid), { currentStoreId: sid }).catch(() => {});
      }
    }
    return sid;
  } catch (err) {
    console.error('Error in getUserStoreId:', err);
    return null;
  }
}

export async function getUserStores(uid: string): Promise<Store[]> {
  try {
    const storeMap = new Map<string, Store>();
    const foundStoreIds = new Set<string>();

    // 1. Get storeIds & currentStoreId from users/{uid} document
    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      if (uSnap.exists()) {
        const uData = uSnap.data();
        const ids: string[] = uData?.storeIds || [];
        ids.forEach(id => { if (id) foundStoreIds.add(id); });
        if (uData?.currentStoreId) foundStoreIds.add(uData.currentStoreId);
      }
    } catch (e) {
      console.error('Error reading user document:', e);
    }

    // 2. Query collectionGroup('members') where userId == uid to find all joined stores
    try {
      const qMembers = query(collectionGroup(db, 'members'), where('userId', '==', uid));
      const mSnap = await getDocs(qMembers);
      for (const mDoc of mSnap.docs) {
        // mDoc.ref.path is stores/{storeId}/members/{userId}
        const storeRef = mDoc.ref.parent.parent;
        if (storeRef) {
          foundStoreIds.add(storeRef.id);
        }
      }
    } catch (e) {
      console.error('Error querying members collection group:', e);
    }

    // 3. Fetch store documents in parallel
    const allIds = Array.from(foundStoreIds);
    await Promise.all(
      allIds.map(async (storeId) => {
        try {
          const sDoc = await getDoc(doc(db, 'stores', storeId));
          if (sDoc.exists()) {
            storeMap.set(sDoc.id, { id: sDoc.id, ...sDoc.data() } as Store);
          }
        } catch (e) {
          console.error(`Error fetching store ${storeId}:`, e);
        }
      })
    );

    const result = Array.from(storeMap.values());

    // 4. Self-heal: Update user's storeIds array if new stores were discovered via collectionGroup
    if (result.length > 0) {
      const resultIds = result.map(s => s.id);
      updateDoc(doc(db, 'users', uid), {
        storeIds: resultIds,
        ...(resultIds.length > 0 ? {} : {})
      }).catch(() => {});
    }

    return result;
  } catch (err) {
    console.error('Error in getUserStores:', err);
    return [];
  }
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

export function watchMembers(storeId: string, cb: (members: Member[]) => void) {
  const q = query(
    collection(db, 'stores', storeId, 'members'),
    where('status', 'in', ['active', 'pending'])
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ userId: d.id, ...d.data() } as Member)));
  });
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

export function watchTodayAttendances(storeId: string, cb: (records: AttendanceRecord[]) => void) {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const q = query(
    collection(db, 'stores', storeId, 'attendances'),
    where('date', '==', dateStr)
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
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

export async function setMemberStatus(storeId: string, userId: string, status: 'active' | 'kicked') {
  await updateDoc(doc(db, 'stores', storeId, 'members', userId), { status });
}

export async function updateMemberRole(storeId: string, userId: string, role: string) {
  await updateDoc(doc(db, 'stores', storeId, 'members', userId), { role });
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

export async function getWeekSchedule(storeId: string, weekStart: string): Promise<ScheduleModel | null> {
  try {
    const q = query(
      collection(db, 'stores', storeId, 'schedules'),
      where('weekStart', '==', weekStart),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ScheduleModel;
  } catch (err) {
    console.error('Error in getWeekSchedule:', err);
    return null;
  }
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
  storeId: string, weekStart: string, shifts: Record<string, DaySchedule>
): Promise<void> {
  const q = query(
    collection(db, 'stores', storeId, 'schedules'),
    where('weekStart', '==', weekStart),
    limit(1)
  );
  const snap = await getDocs(q);
  const data = { storeId, weekStart, shifts };
  if (snap.empty) {
    await addDoc(collection(db, 'stores', storeId, 'schedules'), data);
  } else {
    await updateDoc(snap.docs[0].ref, { shifts });
  }
}

export async function updateStore(storeId: string, data: Record<string, any>) {
  await updateDoc(doc(db, 'stores', storeId), data);
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
