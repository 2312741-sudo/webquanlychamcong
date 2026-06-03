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
  latitude?: number;
  longitude?: number;
  radiusMeters: number;
  customShifts?: ShiftDefinition[];
  themeColor?: string;
  deliveryAllowance?: number;
  departments?: Department[];
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
