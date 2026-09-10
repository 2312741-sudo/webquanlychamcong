// lib/performanceTypes.ts

export type SessionStatus = 'active' | 'completed' | 'cancelled';
export type PerformanceCategory = 'drink' | 'cake' | 'order';
export type MeasurementStatus = 'ready' | 'running' | 'paused' | 'completed' | 'cancelled';
export type ReportStatus = 'draft' | 'submitted' | 'viewed' | 'archived';

export interface PerformanceIncident {
  id: string;
  description: string;
  category: string;
  staffName?: string;
  reportedBy: string;
  timestamp: any;
}

export interface PerformanceSession {
  id: string;
  storeId: string;
  storeName: string;
  managerId: string;
  managerName: string;
  managerOnDutyId: string;
  managerOnDutyName: string;
  employeeIds: string[];
  employeeNames: string[];
  startedAt: any;
  endedAt?: any;
  status: SessionStatus;
  drinkCount: number;
  drinkTotalQuantity: number;
  drinkTotalSeconds: number;
  cakeCount: number;
  cakeTotalQuantity: number;
  cakeTotalSeconds: number;
  orderCount: number;
  orderTotalSeconds: number;
  createdAt: any;
  updatedAt?: any;
  formResponses: Record<string, any>;
  standardSnapshot: Record<string, number>;
  incidents: PerformanceIncident[];
}

export interface Measurement {
  id: string;
  sessionId: string;
  storeId: string;
  userId: string;
  category: PerformanceCategory;
  quantity: number;
  orderCode?: string;
  durationSeconds: number;
  startedAt: any;
  pausedAt?: any;
  totalPausedSeconds: number;
  completedAt?: any;
  status: MeasurementStatus;
  createdAt: any;
}

export interface PerformanceReport {
  id: string;
  sessionId: string;
  storeId: string;
  storeName: string;
  managerId: string;
  managerName: string;
  managerOnDutyId: string;
  managerOnDutyName: string;
  employeeIds: string[];
  employeeNames: string[];
  startedAt: any;
  endedAt: any;
  drinkTotalQuantity: number;
  drinkMeasurementCount: number;
  drinkTotalSeconds: number;
  drinkAverageSeconds: number;
  cakeTotalQuantity: number;
  cakeMeasurementCount: number;
  cakeTotalSeconds: number;
  cakeAverageSeconds: number;
  orderCount: number;
  orderTotalSeconds: number;
  orderAverageSeconds: number;
  status: ReportStatus;
  submittedAt?: any;
  viewedAt?: any;
  viewedBy?: string;
  createdAt: any;
  formResponses: Record<string, any>;
  standardSnapshot: Record<string, number>;
  incidents: PerformanceIncident[];
}

export interface StorePerformanceStandards {
  drinkStandardSeconds: number;
  cakeStandardSeconds: number;
  orderStandardSeconds: number;
}

export const DEFAULT_STANDARDS: StorePerformanceStandards = {
  drinkStandardSeconds: 120, // 2 phút
  cakeStandardSeconds: 120,  // 2 phút
  orderStandardSeconds: 180, // 3 phút
};

export interface EndSessionCriterion {
  id: string;
  title: string;
  type: 'checkbox' | 'number' | 'text' | 'rating';
  isRequired: boolean;
  order: number;
  helperText?: string;
}

// Helpers
export function formatSecondsToMMSS(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseFirestoreTimestamp(val: any): Date {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds != null) return new Date(val.seconds * 1000);
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getCategoryLabel(cat: PerformanceCategory): string {
  switch (cat) {
    case 'drink': return 'Làm nước';
    case 'cake': return 'Nướng bánh';
    case 'order': return 'SOS đơn hàng';
    default: return cat;
  }
}

export function getCategoryUnit(cat: PerformanceCategory): string {
  switch (cat) {
    case 'drink': return 'ly';
    case 'cake': return 'bánh';
    case 'order': return 'đơn';
    default: return 'mục';
  }
}
