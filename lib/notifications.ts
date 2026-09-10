import { db, auth } from './firebase';
import { collection, doc, query, where, orderBy, limit, onSnapshot, getDoc, getDocs, updateDoc, serverTimestamp, writeBatch, Query, arrayUnion } from 'firebase/firestore';
import { AppNotification, normalizeRole, canApproveMembers, canViewAllAttendance } from './types';

const accountItems = (uid: string) => collection(db, 'notificationInboxes', uid, 'accountItems');
const storeItems = (uid: string, storeId: string) => collection(db, 'notificationInboxes', uid, 'stores', storeId, 'items');
const storeNotifications = (storeId: string) => collection(db, 'stores', storeId, 'notifications');

export function watchNotifications(
  storeId: string,
  userId: string | null | undefined,
  role: string | null | undefined,
  cb: (items: AppNotification[]) => void,
  onError: (error: Error) => void = () => {},
  pageSize = 50,
  onUnread?: (count: number) => void
) {
  cb([]);
  onUnread?.(0);
  if (!userId) return () => {};

  let stopped = false;
  let unsubs: (() => void)[] = [];

  const unsubProfile = onSnapshot(doc(db, 'users', userId), profile => {
    unsubs.forEach(stop => stop());
    unsubs = [];
    if (stopped) return;

    const notifyShiftInOut = profile.data()?.notifyShiftInOut !== false;
    let storeList: AppNotification[] = [];
    let accountList: AppNotification[] = [];

    const emit = () => {
      if (stopped) return;
      const map = new Map<string, AppNotification>();
      storeList.forEach(item => map.set(item.id, item));
      accountList.forEach(item => map.set(item.id, item));
      const sorted = Array.from(map.values()).sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return timeB - timeA || a.id.localeCompare(b.id);
      });
      cb(sorted.slice(0, pageSize));
      const unread = sorted.filter(item => !item.readBy?.includes(userId) && !item.readAt).length;
      onUnread?.(unread);
    };

    // 1. Primary: stores/{storeId}/notifications
    if (storeId) {
      try {
        const stopStore = onSnapshot(storeNotifications(storeId), snapshot => {
          if (stopped) return;
          storeList = snapshot.docs
            .map(d => {
              const data = d.data();
              return { ...data, id: d.id, readBy: data.readBy || [] } as AppNotification;
            })
            .filter(item => {
              if (!notifyShiftInOut && (item.type === 'check_in' || item.type === 'check_out')) return false;
              if (item.targetUserId && item.targetUserId !== userId) return false;
              if (item.targetRoles && item.targetRoles.length > 0) {
                const normRole = normalizeRole(role);
                const matches = item.targetRoles.some(r => normalizeRole(r) === normRole);
                if (!matches) return false;
              }
              return true;
            });
          emit();
        }, err => {
          console.warn('Web store notifications listener warning:', err);
        });
        unsubs.push(stopStore);
      } catch (err) {
        console.warn('Web store notifications attach error:', err);
      }
    }

    // 2. Account items fallback (if any)
    try {
      const stopAccount = onSnapshot(accountItems(userId), snapshot => {
        if (stopped) return;
        accountList = snapshot.docs.map(d => {
          const data = d.data();
          return { ...data, id: d.id, readBy: data.readAt ? [userId] : [] } as AppNotification;
        });
        emit();
      }, err => {
        // Safe to ignore permission error on accountItems
      });
      unsubs.push(stopAccount);
    } catch (_) {}
  }, err => {
    console.warn('Web profile listener error:', err);
  });

  return () => {
    stopped = true;
    unsubProfile();
    unsubs.forEach(stop => stop());
  };
}

export async function markNotificationAsRead(storeId: string, id: string, uid: string, account = false) {
  try {
    if (storeId) {
      await updateDoc(doc(db, 'stores', storeId, 'notifications', id), {
        readBy: arrayUnion(uid),
      }).catch(() => {});
    }
  } catch (_) {}
  try {
    await updateDoc(doc(account ? accountItems(uid) : storeItems(uid, storeId), id), { readAt: serverTimestamp() }).catch(() => {});
  } catch (_) {}
}

export async function markAllNotificationsAsRead(storeId: string, uid: string, role?: string | null) {
  try {
    if (storeId) {
      const snap = await getDocs(storeNotifications(storeId));
      const batch = writeBatch(db);
      let count = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        const readBy: string[] = data.readBy || [];
        if (!readBy.includes(uid)) {
          batch.update(d.ref, { readBy: arrayUnion(uid) });
          count++;
        }
      });
      if (count > 0) {
        await batch.commit();
      }
    }
  } catch (_) {}
}

export async function notificationDestination(item: AppNotification): Promise<string | null> {
  const uid = auth.currentUser?.uid;
  if (!uid || (item.targetUserId && item.targetUserId !== uid)) return null;
  const storeId = item.storeId;
  if (!storeId) return null;

  const [store, member] = await Promise.all([
    getDoc(doc(db, 'stores', storeId)),
    getDoc(doc(db, 'stores', storeId, 'members', uid))
  ]);
  if (!store.exists() || store.data().status === 'deleted') return null;
  const memberData = member.data();
  const memStatus = memberData?.status;
  if (memStatus && memStatus !== 'active') return null;

  const role = memberData?.role;
  const routes: Record<string, string> = {
    '/schedule': '/dashboard/schedule',
    '/schedule-manager': '/dashboard/schedule',
    ...(canApproveMembers(role) ? { '/pending-members': '/dashboard/members' } : {}),
    ...(canViewAllAttendance(role) ? { '/attendance-table': '/dashboard/attendance' } : {}),
    ...(normalizeRole(role) === 'owner' ? { '/manage-advances': '/dashboard/salary', '/salary': '/dashboard/salary' } : {}),
  };

  let destination = routes[item.routePath || ''];
  if (!destination) return null;
  const extra = item.routeExtra || {};
  if (destination === '/dashboard/schedule' && /^\d{4}-\d{2}-\d{2}$/.test(extra.weekStart || '')) {
    destination += `?weekStart=${extra.weekStart}`;
  }
  return destination;
}
