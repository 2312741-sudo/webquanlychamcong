import { db } from './firebase';
import {
  collection, doc, query, where, getDocs, getDoc,
  updateDoc, addDoc, orderBy, Timestamp, onSnapshot,
  setDoc, limit, DocumentSnapshot, deleteDoc
} from 'firebase/firestore';
import { Member, AttendanceRecord, Store, ScheduleModel, DaySchedule } from './types';

export async function getUserStoreId(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.currentStoreId ?? null;
}

export async function getUserStores(uid: string): Promise<Store[]> {
  const snap = await getDoc(doc(db, 'users', uid));
  const storeIds = snap.data()?.storeIds || [];
  if (storeIds.length === 0) return [];
  
  const stores: Store[] = [];
  for (const id of storeIds) {
    const sDoc = await getDoc(doc(db, 'stores', id));
    if (sDoc.exists()) {
      stores.push({ id: sDoc.id, ...sDoc.data() } as Store);
    }
  }
  return stores;
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
  const q = query(
    collection(db, 'stores', storeId, 'attendances'),
    where('date', '>=', `${month}-01`),
    where('date', '<=', `${month}-31`),
    orderBy('date')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
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
  const q = query(
    collection(db, 'stores', storeId, 'schedules'),
    where('weekStart', '==', weekStart),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ScheduleModel;
}

export async function getSchedulesInRange(storeId: string, startDateStr: string, endDateStr: string): Promise<ScheduleModel[]> {
  const q = query(
    collection(db, 'stores', storeId, 'schedules'),
    where('weekStart', '>=', startDateStr),
    where('weekStart', '<=', endDateStr)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleModel));
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
