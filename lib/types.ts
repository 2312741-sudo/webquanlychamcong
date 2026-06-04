export type UserRole = 'owner' | 'manager' | 'employee';
export type MemberStatus = 'active' | 'pending' | 'kicked';
export type EmployeeType = 'fulltime' | 'parttime';
export type CheckInMethod = 'wifi' | 'gps' | 'manual' | 'qr';

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
  isDelivery?: boolean;
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
