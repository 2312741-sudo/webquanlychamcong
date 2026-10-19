import { Department, Member, ScheduleModel, DaySchedule } from './types';

/**
 * Chuẩn hóa chuỗi: chuyển chữ thường, bỏ khoảng trắng thừa và xóa dấu tiếng Việt
 */
export function normalizeDeptString(text?: string | null): string {
  if (!text) return '';
  let result = text.trim().toLowerCase();
  const withDia = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
  const noDia   = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';
  for (let i = 0; i < withDia.length; i++) {
    result = result.replace(new RegExp(withDia[i], 'g'), noDia[i]);
  }
  return result;
}

/**
 * Lấy ngày Thứ Hai đầu tuần (YYYY-MM-DD) tương ứng với một ngày bất kỳ
 */
export function getMondayOfWeek(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      // In JS: 0 = Sun, 1 = Mon ... 6 = Sat
      const dayOfWeek = d.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      d.setDate(d.getDate() + diffToMonday);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
}

/**
 * Lấy key thứ trong tuần của DaySchedule tương ứng với ngày dateStr ('monday', 'tuesday', ...)
 */
export function getDayKeyForDate(dateStr: string): keyof DaySchedule | null {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      switch (dayOfWeek) {
        case 1: return 'monday';
        case 2: return 'tuesday';
        case 3: return 'wednesday';
        case 4: return 'thursday';
        case 5: return 'friday';
        case 6: return 'saturday';
        case 0: return 'sunday';
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Kiểm tra xem candidate có đại diện cho bộ phận Sản Xuất (SX) hay không
 */
export function isProductionDept(
  candidate?: string | null,
  storeDepartments?: Department[]
): boolean {
  if (!candidate) return false;
  const clean = normalizeDeptString(candidate);
  if (['sx', 'dept_sx', 'san_xuat', 'sanxuat'].includes(clean)) return true;
  if (clean.includes('san xuat')) return true;

  if (storeDepartments && storeDepartments.length > 0) {
    const d = storeDepartments.find(
      x => x.id === candidate || x.shortName.toUpperCase() === candidate.toUpperCase()
    );
    if (d) {
      const normDName = normalizeDeptString(d.name);
      if (['sx', 'dept_sx', 'san_xuat', 'sanxuat'].includes(normalizeDeptString(d.id)) ||
          d.shortName.toUpperCase() === 'SX' ||
          normDName.includes('san xuat')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * So khớp candidate (từ ca làm hoặc hồ sơ) với bộ phận mục tiêu targetDeptId / targetDeptName
 */
export function isDepartmentMatch({
  candidate,
  targetDeptId,
  targetDeptName,
  storeDepartments,
}: {
  candidate?: string | null;
  targetDeptId?: string | null;
  targetDeptName?: string | null;
  storeDepartments?: Department[];
}): boolean {
  if (!candidate || !candidate.trim()) return false;
  const cleanCand = candidate.trim().toLowerCase();
  const normCand = normalizeDeptString(candidate);

  const cleanTargetId = (targetDeptId || '').trim().toLowerCase();
  const normTargetId = normalizeDeptString(targetDeptId);

  const cleanTargetName = (targetDeptName || '').trim().toLowerCase();
  const normTargetName = normalizeDeptString(targetDeptName);

  // 1. So sánh trực tiếp hoặc qua chuẩn hóa xóa dấu
  if (cleanTargetId && (cleanCand === cleanTargetId || normCand === normTargetId)) {
    return true;
  }
  if (cleanTargetName && (cleanCand === cleanTargetName || normCand === normTargetName)) {
    return true;
  }

  // 2. Kiểm tra bộ phận sản xuất đặc thù
  const isTargetProd =
    (targetDeptId && isProductionDept(targetDeptId, storeDepartments)) ||
    (targetDeptName && isProductionDept(targetDeptName, storeDepartments));
  if (isTargetProd && isProductionDept(candidate, storeDepartments)) {
    return true;
  }

  // 3. Tra cứu qua storeDepartments
  if (storeDepartments && storeDepartments.length > 0) {
    const matchedDept = storeDepartments.find((d) => {
      const dId = d.id.trim().toLowerCase();
      const dName = d.name.trim().toLowerCase();
      const dShort = d.shortName.trim().toLowerCase();
      const normDName = normalizeDeptString(d.name);
      return cleanCand === dId || cleanCand === dName || cleanCand === dShort || normCand === normDName;
    });

    if (matchedDept) {
      const mId = matchedDept.id.trim().toLowerCase();
      const mName = matchedDept.name.trim().toLowerCase();
      const normMName = normalizeDeptString(matchedDept.name);

      if (cleanTargetId && (mId === cleanTargetId || normMName === normTargetId)) {
        return true;
      }
      if (cleanTargetName && (mName === cleanTargetName || normMName === normTargetName || mId === cleanTargetName)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Kiểm tra xem ngày dateStr có thỏa mãn cấu hình lặp lại / ngày thực hiện của task hay không
 * 1 = Thứ 2, 2 = Thứ 3, ..., 6 = Thứ 7, 7 = Chủ Nhật
 */
export function isDateMatchingTask(
  dateStr: string,
  task: {
    repeatDaily?: boolean;
    repeatDaysOfWeek?: number[];
    executionDates?: string[];
  }
): boolean {
  if (task.repeatDaily) return true;
  if (Array.isArray(task.repeatDaysOfWeek) && task.repeatDaysOfWeek.length > 0) {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const jsDay = d.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
        const isoWeekday = jsDay === 0 ? 7 : jsDay; // 1 = T2 ... 7 = CN
        return task.repeatDaysOfWeek.includes(isoWeekday);
      }
    } catch (_) {}
  }
  return Array.isArray(task.executionDates) && task.executionDates.includes(dateStr);
}

/**
 * Kiểm tra xem user có làm việc tại bộ phận đích vào ngày dateStr hay không (hỗ trợ nhiều bộ phận)
 */
export function isUserInDepartmentOnDate({
  userId,
  dateStr,
  targetDeptId,
  targetDeptName,
  targetDeptIds,
  targetDeptNames,
  schedule,
  memberDepartment,
  storeDepartments,
}: {
  userId: string;
  dateStr: string;
  targetDeptId?: string | null;
  targetDeptName?: string | null;
  targetDeptIds?: string[] | null;
  targetDeptNames?: string[] | null;
  schedule?: ScheduleModel | null;
  memberDepartment?: string | null;
  storeDepartments?: Department[];
}): boolean {
  const allTargetIds = Array.from(new Set([
    ...(targetDeptIds || []),
    ...(targetDeptId ? [targetDeptId] : []),
  ])).filter(Boolean);
  const allTargetNames = Array.from(new Set([
    ...(targetDeptNames || []),
    ...(targetDeptName ? [targetDeptName] : []),
  ])).filter(Boolean);

  if (allTargetIds.length === 0 && allTargetNames.length === 0) return false;

  const matchesAny = (candidate?: string | null): boolean => {
    if (!candidate || !candidate.trim()) return false;
    for (const tId of allTargetIds) {
      if (isDepartmentMatch({ candidate, targetDeptId: tId, storeDepartments })) return true;
    }
    for (const tName of allTargetNames) {
      if (isDepartmentMatch({ candidate, targetDeptName: tName, storeDepartments })) return true;
    }
    return false;
  };

  // 1. Nếu có lịch làm việc trong tuần của ngày này
  if (schedule && schedule.shifts && schedule.shifts[userId]) {
    const userSchedule = schedule.shifts[userId];
    const dayKey = getDayKeyForDate(dateStr);

    if (dayKey && Array.isArray(userSchedule[dayKey])) {
      const dayShifts = userSchedule[dayKey];

      if (dayShifts.length > 0) {
        // Kiểm tra nếu tất cả ca là 'off' -> User nghỉ làm hôm nay
        const isAllOff = dayShifts.every((s) => s.trim().toLowerCase() === 'off');
        if (isAllOff) {
          return false;
        }

        for (const entry of dayShifts) {
          const trimmed = entry.trim();
          if (trimmed === 'off' || trimmed === 'delivery' || trimmed === 'giaohang') {
            continue;
          }
          if (trimmed.includes('|')) {
            const shiftDeptId = trimmed.split('|')[1];
            if (matchesAny(shiftDeptId)) {
              return true;
            }
          } else {
            // Ca không ghi đè bộ phận -> kế thừa bộ phận mặc định của thành viên
            if (memberDepartment && matchesAny(memberDepartment)) {
              return true;
            }
          }
        }
        // Có ca làm nhưng không thuộc bộ phận đích
        return false;
      } else {
        // Không có ca nào trong ngày này. Nếu trong tuần có ca khác -> hôm nay không làm
        const hasOtherWorkdays = (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as (keyof DaySchedule)[])
          .some((k) => Array.isArray(userSchedule[k]) && userSchedule[k].length > 0 && !userSchedule[k].every((s) => s.trim().toLowerCase() === 'off'));
        if (hasOtherWorkdays) {
          return false;
        }
      }
    }
  }

  // 2. Fallback nếu không có lịch làm việc hoặc nhân viên không có lịch tuần:
  // So khớp trực tiếp với bộ phận của thành viên
  if (memberDepartment && memberDepartment.trim().length > 0) {
    return matchesAny(memberDepartment);
  }

  return false;
}

/**
 * Lấy danh sách ID các thành viên thuộc hoặc có ca làm tại bộ phận đích vào ngày dateStr
 */
export function getUserIdsInDepartmentOnDate({
  dateStr,
  targetDeptId,
  targetDeptName,
  targetDeptIds,
  targetDeptNames,
  allMembers,
  schedule,
  storeDepartments,
}: {
  dateStr: string;
  targetDeptId?: string | null;
  targetDeptName?: string | null;
  targetDeptIds?: string[] | null;
  targetDeptNames?: string[] | null;
  allMembers: Member[];
  schedule?: ScheduleModel | null;
  storeDepartments?: Department[];
}): string[] {
  const result: string[] = [];
  for (const m of allMembers) {
    if (isUserInDepartmentOnDate({
      userId: m.userId,
      dateStr,
      targetDeptId,
      targetDeptName,
      targetDeptIds,
      targetDeptNames,
      schedule,
      memberDepartment: m.department,
      storeDepartments,
    })) {
      result.push(m.userId);
    }
  }
  return result;
}
