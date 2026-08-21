export type UserRole = 'owner' | 'manager' | 'manager1' | 'manager2' | 'manager_1' | 'manager_2' | 'employee';
export type MemberStatus = 'active' | 'pending' | 'kicked';
export type EmployeeType = 'fulltime' | 'parttime';
export type CheckInMethod = 'wifi' | 'gps' | 'manual' | 'qr';

export function normalizeRole(role?: UserRole | string | null): 'owner' | 'manager1' | 'manager2' | 'employee' {
  if (!role) return 'employee';
  if (role === 'owner') return 'owner';
  if (role === 'manager1' || role === 'manager_1' || role === 'manager') return 'manager1';
  if (role === 'manager2' || role === 'manager_2') return 'manager2';
  return 'employee';
}

export function getRoleLabel(role?: UserRole | string | null): string {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'owner':
      return 'Chủ';
    case 'manager1':
      return 'Quản lý 1';
    case 'manager2':
      return 'Quản lý 2';
    case 'employee':
    default:
      return 'Nhân viên';
  }
}

export function canManageSchedule(role?: UserRole | string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'owner' || norm === 'manager1';
}

export function canApproveMembers(role?: UserRole | string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'owner' || norm === 'manager1';
}

export function canAccessWeb(role?: UserRole | string | null): boolean {
  const norm = normalizeRole(role);
  return norm === 'owner' || norm === 'manager1' || norm === 'manager2';
}

export function formatJoinedDate(joinedAt: any): string {
  if (!joinedAt) return 'Chưa cập nhật';
  try {
    if (typeof joinedAt === 'object' && typeof joinedAt.toDate === 'function') {
      return joinedAt.toDate().toLocaleDateString('vi-VN');
    }
    if (typeof joinedAt === 'object' && joinedAt.seconds != null) {
      return new Date(joinedAt.seconds * 1000).toLocaleDateString('vi-VN');
    }
    const d = new Date(joinedAt);
    if (isNaN(d.getTime())) return 'Chưa cập nhật';
    return d.toLocaleDateString('vi-VN');
  } catch {
    return 'Chưa cập nhật';
  }
}


export interface Member {
  userId: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  status: MemberStatus;
  employeeType: EmployeeType;
  baseMonthlySalary: number;
  baseHourlyRate: number;
  standardHoursPerMonth: number;
  joinedAt: any;
  employeeCode?: string;
  birthday?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  storeId: string;
  date: string;
  checkIn: any;
  checkOut?: any;
  checkInMethod: CheckInMethod;
  totalHours: number;
  isEdited: boolean;
  editedBy?: string;
  editNote?: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  address?: string;
  networkIP?: string;
  wifis?: StoreWifi[];
  latitude?: number;
  longitude?: number;
  radiusMeters: number;
  customShifts?: ShiftDefinition[];
  themeColor?: string;
  deliveryAllowance?: number; // Chở hàng
  giaoHangAllowance?: number; // Giao hàng
  deliveryEnabled?: boolean;
  giaoHangEnabled?: boolean;
  departmentSelectionEnabled?: boolean;
  departments?: Department[];
  memberOrder?: string[];
  hiddenScheduleUserIds?: string[];
}

export function sortMembersByOrder(members: Member[], memberOrder?: string[]): Member[] {
  if (!memberOrder || memberOrder.length === 0) return [...members];
  return [...members].sort((a, b) => {
    const idxA = memberOrder.indexOf(a.userId);
    const idxB = memberOrder.indexOf(b.userId);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

export interface StoreWifi {
  name: string;
  ip: string;
}

export interface Department {
  id: string;
  name: string;
  shortName: string;
}

export interface ShiftDefinition {
  id: string;
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  isDelivery?: boolean; // Chở hàng
  isGiaoHang?: boolean; // Giao hàng
}

export interface DaySchedule {
  monday: string[];
  tuesday: string[];
  wednesday: string[];
  thursday: string[];
  friday: string[];
  saturday: string[];
  sunday: string[];
}

export interface ScheduleModel {
  id: string;
  storeId: string;
  weekStart: string;
  shifts: Record<string, DaySchedule>;
}

export interface AdvanceRequest {
  id: string;
  storeId: string;
  userId: string;
  month: string; // YYYY-MM
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string; // ISO string
  approvedDate?: string;
  note?: string;
}

// ─── Production / Efficiency Measurement ────────────────────────────────────

export type ProductionUnitType = 'time' | 'kg' | 'shift' | 'qty' | 'custom' | 'none' | string;

export interface ProductionTask {
  id: string;
  name: string;
  unit?: ProductionUnitType;    // loại đơn vị đo lường
  unitLabel?: string;          // nhãn hiển thị: "Phút", "Kg", "Gói", "Thùng", ... hoặc rỗng
  hasUnit?: boolean;           // có sử dụng đơn vị đo lường không
  active: boolean;             // bật/tắt
  order: number;               // thứ tự hiển thị
  createdAt?: any;
}

export interface ProductionTaskEntry {
  taskId: string;
  taskName: string;
  unit?: ProductionUnitType;
  unitLabel?: string;
  value: number;               // giá trị đo lường NV nhập (hoặc 1 nếu là tích checklist)
}

export interface ProductionReport {
  id: string;
  userId: string;
  memberName: string;
  date: string;                // YYYY-MM-DD
  shiftId: string;
  shiftName: string;
  checkoutTime: any;           // Firestore Timestamp
  note: string;
  tasks: ProductionTaskEntry[];
  createdAt?: any;
}

// ─── Notifications System ───────────────────────────────────────────────────

export type AppNotificationType =
  | 'join_request'
  | 'join_approved'
  | 'join_rejected'
  | 'advance_request'
  | 'advance_approved'
  | 'advance_rejected'
  | 'schedule_changed'
  | 'schedule_registration_reminder'
  | 'checklist_reminder'
  | 'delivery_update'
  | 'birthday'
  | 'general';

export interface AppNotification {
  id: string;
  storeId: string;
  title: string;
  body: string;
  type: AppNotificationType;
  createdAt: any;
  targetUserId?: string;
  targetRoles?: UserRole[];
  readBy: string[];
  routePath?: string;
  routeExtra?: Record<string, any>;
}
