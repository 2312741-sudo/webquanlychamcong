export type UserRole = 'owner' | 'manager' | 'manager1' | 'manager2' | 'employee';
export type MemberStatus = 'active' | 'pending' | 'kicked';
export type EmployeeType = 'fulltime' | 'parttime';
export type CheckInMethod = 'wifi' | 'gps' | 'manual' | 'qr';

export function getRoleLabel(role?: UserRole | string): string {
  switch (role) {
    case 'owner':
      return 'Chủ';
    case 'manager1':
    case 'manager':
      return 'Quản lý 1';
    case 'manager2':
      return 'Quản lý 2';
    case 'employee':
    default:
      return 'Nhân viên';
  }
}

export function canManageSchedule(role?: UserRole | string): boolean {
  return role === 'owner' || role === 'manager1' || role === 'manager';
}

export function canApproveMembers(role?: UserRole | string): boolean {
  return role === 'owner' || role === 'manager1' || role === 'manager';
}

export function canAccessWeb(role?: UserRole | string): boolean {
  return role === 'owner' || role === 'manager1' || role === 'manager2' || role === 'manager';
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
