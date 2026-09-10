import { db, auth } from './firebase';
import { collection, doc, query, where, orderBy, limit, onSnapshot, getDoc, getDocs, updateDoc, serverTimestamp, writeBatch, Query } from 'firebase/firestore';
import { AppNotification, normalizeRole, canApproveMembers, canViewAllAttendance } from './types';
const accountItems = (uid: string) => collection(db, 'notificationInboxes', uid, 'accountItems');
const storeItems = (uid: string, storeId: string) => collection(db, 'notificationInboxes', uid, 'stores', storeId, 'items');
const scopes = (role?: string | null, attendance = true) => role ? [
  'member', ...(canApproveMembers(role) ? ['approver'] : []),
  ...(canViewAllAttendance(role) && attendance ? ['attendance'] : []), ...(normalizeRole(role) === 'owner' ? ['owner'] : []),
] : [];
function queries(storeId: string, uid: string, role?: string | null, attendance = true): Query[] {
  const result: Query[] = [accountItems(uid)];
  const allowed = scopes(role, attendance);
  if (storeId && allowed.length) result.push(query(storeItems(uid, storeId), where('scope', 'in', allowed)));
  return result;
}
export function watchNotifications(storeId: string, userId: string | null | undefined,
  role: string | null | undefined, cb: (items: AppNotification[]) => void,
  onError: (error: Error) => void = () => {}, pageSize = 50, onUnread?: (count: number) => void) {
  cb([]); onUnread?.(0);
  if (!userId) return () => {};
  let subscriptions: (() => void)[] = [];
  let stopped = false;
  const unsubscribeProfile = onSnapshot(doc(db, 'users', userId), profile => {
    subscriptions.forEach(stop => stop());
    cb([]); onUnread?.(0);
    const sources = queries(storeId, userId, role, profile.data()?.notifyShiftInOut !== false);
    const pages = new Map<number, AppNotification[]>();
    const counts = new Map<number, number>();
    const fail = (error: Error) => { if (!stopped) { cb([]); onUnread?.(0); onError(error); } };
    subscriptions = sources.flatMap((source, index) => [
      onSnapshot(query(source, orderBy('createdAt', 'desc'), limit(pageSize)), snapshot => {
        if (stopped) return;
        pages.set(index, snapshot.docs.map(item => {
          const data = item.data();
          return { ...data, id: item.id, readBy: data.readAt ? [userId] : [] } as AppNotification;
        }));
        if (pages.size === sources.length) cb([...pages.values()].flat().sort((a, b) =>
          (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0) || a.id.localeCompare(b.id)));
      }, fail),
      onSnapshot(query(source, where('readAt', '==', null)), snapshot => {
        if (stopped) return;
        counts.set(index, snapshot.size);
        if (counts.size === sources.length) onUnread?.([...counts.values()].reduce((a, b) => a + b, 0));
      }, fail),
    ]);
  }, error => { cb([]); onUnread?.(0); onError(error); });
  return () => { stopped = true; unsubscribeProfile(); subscriptions.forEach(stop => stop()); };
}
export async function markNotificationAsRead(storeId: string, id: string, uid: string, account = false) {
  await updateDoc(doc(account ? accountItems(uid) : storeItems(uid, storeId), id), { readAt: serverTimestamp() });
}
export async function markAllNotificationsAsRead(storeId: string, uid: string, role?: string | null) {
  const profile = await getDoc(doc(db, 'users', uid));
  const snapshots = await Promise.all(queries(storeId, uid, role, profile.data()?.notifyShiftInOut !== false)
    .map(source => getDocs(query(source, where('readAt', '==', null)))));
  const items = snapshots.flatMap(snapshot => snapshot.docs);
  for (let offset = 0; offset < items.length; offset += 400) {
    const batch = writeBatch(db);
    items.slice(offset, offset + 400).forEach(item => batch.update(item.ref, { readAt: serverTimestamp() }));
    await batch.commit();
  }
}
export async function notificationDestination(item: AppNotification): Promise<string | null> {
  const uid = auth.currentUser?.uid;
  if (!uid || item.targetUserId !== uid) return null;
  const fresh = await getDoc(doc(item.scope === 'account' ? accountItems(uid) : storeItems(uid, item.storeId), item.id));
  if (!fresh.exists()) throw new Error('Thông báo không còn tồn tại.');
  const data = fresh.data();
  const [store, member] = await Promise.all([getDoc(doc(db, 'stores', item.storeId)), getDoc(doc(db, 'stores', item.storeId, 'members', uid))]);
  if (!store.exists() || store.data().status === 'deleted' || member.data()?.status !== 'active') return null;
  const role = member.data()?.role;
  const routes: Record<string, string> = {
    '/schedule': '/dashboard/schedule', '/schedule-manager': '/dashboard/schedule',
    ...(canApproveMembers(role) ? { '/pending-members': '/dashboard/members' } : {}),
    ...(canViewAllAttendance(role) ? { '/attendance-table': '/dashboard/attendance' } : {}),
    ...(normalizeRole(role) === 'owner' ? { '/manage-advances': '/dashboard/salary', '/salary': '/dashboard/salary' } : {}),
  };
  let destination = routes[data.routePath];
  if (!destination) return null;
  const extra = data.routeExtra || {};
  const source = extra.advanceId ? ['advances', extra.advanceId] : extra.attendanceId ? ['attendances', extra.attendanceId]
    : data.type === 'join_request' && extra.memberId ? ['members', extra.memberId]
    : data.type === 'schedule_changed' && extra.weekStart ? ['schedules', extra.weekStart] : null;
  if (source && !(await getDoc(doc(db, 'stores', item.storeId, source[0], source[1]))).exists()) throw new Error('Dữ liệu liên quan không còn tồn tại.');
  if (destination === '/dashboard/schedule' && /^\d{4}-\d{2}-\d{2}$/.test(extra.weekStart || '')) destination += `?weekStart=${extra.weekStart}`;
  return destination;
}
