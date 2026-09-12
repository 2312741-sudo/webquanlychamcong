// lib/performance.ts
import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import {
  PerformanceReport,
  PerformanceSession,
  Measurement,
  StorePerformanceStandards,
  EndSessionCriterion,
  parseFirestoreTimestamp
} from './performanceTypes';

const SESSIONS_COL = 'performance_sessions';
const REPORTS_COL = 'performance_reports';

/**
 * Lắng nghe danh sách báo cáo hiệu năng theo thời gian thực (hỗ trợ lọc theo storeId hoặc tất cả)
 */
export function watchPerformanceReports(
  storeId: string | null | undefined,
  callback: (reports: PerformanceReport[]) => void
): Unsubscribe {
  const colRef = collection(db, REPORTS_COL);
  let q = query(colRef);

  if (storeId && storeId !== 'all') {
    q = query(colRef, where('storeId', '==', storeId));
  }

  return onSnapshot(
    q,
    (snap) => {
      const list: PerformanceReport[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          sessionId: d.sessionId || '',
          storeId: d.storeId || '',
          storeName: d.storeName || '',
          managerId: d.managerId || '',
          managerName: d.managerName || '',
          managerOnDutyId: d.managerOnDutyId || '',
          managerOnDutyName: d.managerOnDutyName || '',
          employeeIds: Array.isArray(d.employeeIds) ? d.employeeIds : [],
          employeeNames: Array.isArray(d.employeeNames) ? d.employeeNames : [],
          startedAt: d.startedAt,
          endedAt: d.endedAt,
          drinkTotalQuantity: d.drinkTotalQuantity || 0,
          drinkMeasurementCount: d.drinkMeasurementCount || 0,
          drinkTotalSeconds: d.drinkTotalSeconds || 0,
          drinkAverageSeconds: d.drinkAverageSeconds || 0,
          cakeTotalQuantity: d.cakeTotalQuantity || 0,
          cakeMeasurementCount: d.cakeMeasurementCount || 0,
          cakeTotalSeconds: d.cakeTotalSeconds || 0,
          cakeAverageSeconds: d.cakeAverageSeconds || 0,
          orderCount: d.orderCount || 0,
          orderTotalSeconds: d.orderTotalSeconds || 0,
          orderAverageSeconds: d.orderAverageSeconds || 0,
          status: d.status || 'submitted',
          submittedAt: d.submittedAt,
          viewedAt: d.viewedAt,
          viewedBy: d.viewedBy,
          createdAt: d.createdAt,
          formResponses: d.formResponses || {},
          standardSnapshot: d.standardSnapshot || {},
          incidents: Array.isArray(d.incidents) ? d.incidents : [],
        };
      });

      // Sắp xếp giảm dần theo thời gian tạo (mới nhất lên đầu)
      list.sort((a, b) => {
        const timeA = parseFirestoreTimestamp(a.createdAt || a.startedAt).getTime();
        const timeB = parseFirestoreTimestamp(b.createdAt || b.startedAt).getTime();
        return timeB - timeA;
      });

      callback(list);
    },
    (err) => {
      console.error('Lỗi khi lắng nghe performance_reports:', err);
    }
  );
}

/**
 * Lấy chi tiết các lượt bấm giờ trong subcollection measurements của phiên
 */
export async function getSessionMeasurements(sessionId: string): Promise<Measurement[]> {
  if (!sessionId) return [];
  try {
    const subColRef = collection(db, SESSIONS_COL, sessionId, 'measurements');
    const snap = await getDocs(subColRef);
    const list: Measurement[] = snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        sessionId: d.sessionId || sessionId,
        storeId: d.storeId || '',
        userId: d.userId || '',
        category: d.category || 'drink',
        quantity: d.quantity ?? 1,
        orderCode: d.orderCode,
        staffName: d.staffName,
        measuredByName: d.measuredByName,
        durationSeconds: d.durationSeconds || 0,
        startedAt: d.startedAt,
        pausedAt: d.pausedAt,
        totalPausedSeconds: d.totalPausedSeconds || 0,
        completedAt: d.completedAt,
        status: d.status || 'completed',
        createdAt: d.createdAt,
      };
    });

    list.sort((a, b) => {
      const timeA = parseFirestoreTimestamp(a.createdAt || a.startedAt).getTime();
      const timeB = parseFirestoreTimestamp(b.createdAt || b.startedAt).getTime();
      return timeA - timeB;
    });

    return list;
  } catch (err) {
    console.error(`Lỗi tải measurements cho session ${sessionId}:`, err);
    return [];
  }
}

/**
 * Đánh dấu báo cáo đã xem
 */
export async function markReportAsViewed(reportId: string, ownerUid: string): Promise<void> {
  if (!reportId) return;
  const ref = doc(db, REPORTS_COL, reportId);
  await updateDoc(ref, {
    status: 'viewed',
    viewedAt: Timestamp.now(),
    viewedBy: ownerUid,
  });
}

/**
 * Cập nhật tiêu chuẩn hiệu năng cho cửa hàng
 */
export async function updateStorePerformanceStandards(
  storeId: string,
  standards: StorePerformanceStandards
): Promise<void> {
  if (!storeId) return;
  const storeRef = doc(db, 'stores', storeId);
  await updateDoc(storeRef, {
    performanceStandards: standards,
  });
}

/**
 * Cập nhật tiêu chí checklist cuối ca cho cửa hàng
 */
export async function updateStoreEndSessionCriteria(
  storeId: string,
  criteria: EndSessionCriterion[]
): Promise<void> {
  if (!storeId) return;
  const storeRef = doc(db, 'stores', storeId);
  await updateDoc(storeRef, {
    endSessionCriteria: criteria,
  });
}

/**
 * Xóa dữ liệu đo lường theo bộ lọc thời gian hoặc xóa tất cả (Sessions + Subcollection Measurements + Reports)
 */
export async function deletePerformanceData(options: {
  storeId?: string | null;
  startDate?: Date;
  endDate?: Date;
  deleteAll?: boolean;
}): Promise<{ sessions: number; measurements: number; reports: number }> {
  const { storeId, startDate, endDate, deleteAll = false } = options;
  let deletedSessions = 0;
  let deletedMeasurements = 0;
  let deletedReports = 0;

  // 1. Sessions & subcollections
  const sessionColRef = collection(db, SESSIONS_COL);
  let sessionQuery = query(sessionColRef);
  if (storeId && storeId !== 'all') {
    sessionQuery = query(sessionColRef, where('storeId', '==', storeId));
  }
  const sessionSnap = await getDocs(sessionQuery);

  for (const sessionDoc of sessionSnap.docs) {
    const data = sessionDoc.data();
    const sessionDate = parseFirestoreTimestamp(data.startedAt || data.createdAt);

    let shouldDelete = deleteAll;
    if (!deleteAll && startDate && endDate) {
      shouldDelete = sessionDate >= startDate && sessionDate <= endDate;
    }

    if (shouldDelete) {
      // Xóa subcollection measurements
      const mCol = collection(db, SESSIONS_COL, sessionDoc.id, 'measurements');
      const mSnap = await getDocs(mCol);
      for (const mDoc of mSnap.docs) {
        await deleteDoc(mDoc.ref);
        deletedMeasurements++;
      }
      // Xóa session doc
      await deleteDoc(sessionDoc.ref);
      deletedSessions++;
    }
  }

  // 2. Reports
  const reportColRef = collection(db, REPORTS_COL);
  let reportQuery = query(reportColRef);
  if (storeId && storeId !== 'all') {
    reportQuery = query(reportColRef, where('storeId', '==', storeId));
  }
  const reportSnap = await getDocs(reportQuery);

  for (const reportDoc of reportSnap.docs) {
    const data = reportDoc.data();
    const reportDate = parseFirestoreTimestamp(data.startedAt || data.createdAt);

    let shouldDelete = deleteAll;
    if (!deleteAll && startDate && endDate) {
      shouldDelete = reportDate >= startDate && reportDate <= endDate;
    }

    if (shouldDelete) {
      await deleteDoc(reportDoc.ref);
      deletedReports++;
    }
  }

  return {
    sessions: deletedSessions,
    measurements: deletedMeasurements,
    reports: deletedReports,
  };
}
