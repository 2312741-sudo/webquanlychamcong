// Đặt hàng ngày mai & soạn hàng khi vào ca — cùng schema Firestore với app (lib/models/supply_order_model.dart):
//   stores/{storeId}/supply_items/{id}       danh mục: code, name, unit, group, order, active
//   stores/{storeId}/supply_settings/config  cutoffTime ("HH:mm" | null), preparerDepartmentIds
//   stores/{storeId}/supply_orders/{yyyy-MM-dd}  date, updatedAt, lines.{itemId}
import { db } from './firebase';
import {
  collection, doc, onSnapshot, setDoc, updateDoc, addDoc, query, where, getDocs,
  serverTimestamp, increment, arrayUnion, deleteField,
} from 'firebase/firestore';
import { sanitize } from './exportExcel';

export interface SupplyItem {
  id: string;
  /** Mã hàng (VD: BB001), tuỳ chọn, không trùng trong cửa hàng */
  code: string;
  name: string;
  unit: string;
  group: string;
  order: number;
  active: boolean;
}

export interface SupplyContribution {
  uid: string;
  name: string;
  qty: number;
  at: number;
}

export interface SupplyOrderLine {
  itemId: string;
  code: string;
  name: string;
  unit: string;
  group: string;
  qty: number;
  note: string;
  contributors: SupplyContribution[];
  prepared: boolean;
  preparedBy: string;
  preparedByName: string;
  preparedAt: number | null;
}

export interface SupplyOrder {
  date: string;
  lines: SupplyOrderLine[];
}

export interface SupplySettings {
  cutoffTime: string | null;
  preparerDepartmentIds: string[];
}

// ==================== NGÀY (giờ Việt Nam, UTC+7) ====================

const VN_OFFSET_MS = 7 * 3600 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

function ymdUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function supplyToday(nowMs = Date.now()): string {
  return ymdUtc(new Date(nowMs + VN_OFFSET_MS));
}

export function supplyAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return ymdUtc(new Date(Date.UTC(y, m - 1, d + days)));
}

export function supplyDisplay(ymd: string): string {
  const p = ymd.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ymd;
}

export function supplyLabel(ymd: string, nowMs = Date.now()): string {
  const t = supplyToday(nowMs);
  if (ymd === t) return `Hôm nay (${supplyDisplay(ymd)})`;
  if (ymd === supplyAddDays(t, 1)) return `Ngày mai (${supplyDisplay(ymd)})`;
  if (ymd === supplyAddDays(t, -1)) return `Hôm qua (${supplyDisplay(ymd)})`;
  return supplyDisplay(ymd);
}

export function parseQty(text: string): number | null {
  const v = Number(text.trim().replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 1000) / 1000);
}

/** Hạn chốt đặt cho phiếu ngày [date] = [cutoff] của NGÀY HÔM TRƯỚC (giờ VN), dạng epoch ms */
export function cutoffDeadline(date: string, cutoff: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((cutoff ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  const [y, mo, d] = date.split('-').map(Number);
  return Date.UTC(y, mo - 1, d - 1, h, mi) - VN_OFFSET_MS;
}

export function isOrderLocked(date: string, cutoff: string | null | undefined, nowMs = Date.now()): boolean {
  const d = cutoffDeadline(date, cutoff);
  return d !== null && nowMs >= d;
}

export function cutoffLabel(date: string, cutoff: string | null | undefined): string | null {
  if (cutoffDeadline(date, cutoff) === null) return null;
  return `${cutoff!.trim()} ngày ${supplyDisplay(supplyAddDays(date, -1))}`;
}

/** Chuẩn hoá mã hàng: viết hoa, bỏ khoảng trắng (giống app) */
export function normalizeSupplyCode(raw: string): string {
  return (raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Mã hàng hợp lệ? Trả câu lỗi hoặc null. Rỗng = không bắt buộc. */
export function validateSupplyCode(code: string, items: SupplyItem[], exceptId?: string): string | null {
  const c = normalizeSupplyCode(code);
  if (!c) return null;
  if (c.length > 20) return 'Mã hàng tối đa 20 ký tự';
  if (!/^[A-Z0-9._-]+$/.test(c)) return 'Mã hàng chỉ gồm chữ không dấu, số và - _ .';
  const dup = items.find(i => i.id !== exceptId && normalizeSupplyCode(i.code) === c);
  return dup ? `Mã "${c}" đã dùng cho "${dup.name}"` : null;
}

export function contributorNames(line: SupplyOrderLine): string[] {
  const out: string[] = [];
  for (const c of line.contributors) {
    const n = c.name || c.uid;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

// ==================== PARSE ====================

const str = (v: unknown) => (v == null ? '' : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const t = v as { toMillis?: () => number };
  return typeof t.toMillis === 'function' ? t.toMillis() : null;
}

export function parseSupplyItem(id: string, data: Record<string, unknown>): SupplyItem {
  return {
    id,
    code: str(data.code),
    name: str(data.name),
    unit: str(data.unit),
    group: str(data.group),
    order: num(data.order),
    active: data.active !== false,
  };
}

export function parseSupplyOrder(date: string, data: Record<string, unknown> | undefined): SupplyOrder {
  const raw = (data?.lines ?? {}) as Record<string, Record<string, unknown>>;
  const lines: SupplyOrderLine[] = Object.entries(raw)
    .filter(([, v]) => v && typeof v === 'object')
    .map(([itemId, v]) => ({
      itemId,
      code: str(v.code),
      name: str(v.name),
      unit: str(v.unit),
      group: str(v.group),
      qty: num(v.qty),
      note: str(v.note),
      contributors: Array.isArray(v.contributors)
        ? (v.contributors as Record<string, unknown>[]).map(c => ({
            uid: str(c.uid), name: str(c.name), qty: num(c.qty), at: num(c.at),
          }))
        : [],
      prepared: v.prepared === true,
      preparedBy: str(v.preparedBy),
      preparedByName: str(v.preparedByName),
      preparedAt: toMs(v.preparedAt),
    }))
    .filter(l => l.qty > 0 || l.note);
  lines.sort((a, b) => a.group.localeCompare(b.group, 'vi') || a.name.localeCompare(b.name, 'vi'));
  return { date, lines };
}

export function parseSupplySettings(data: Record<string, unknown> | undefined): SupplySettings {
  const cut = str(data?.cutoffTime).trim();
  const deps = data?.preparerDepartmentIds;
  return {
    cutoffTime: /^\d{1,2}:\d{2}$/.test(cut) ? cut : null,
    preparerDepartmentIds: Array.isArray(deps) ? deps.map(String).filter(Boolean) : [],
  };
}

// ==================== FIRESTORE ====================

const itemsRef = (storeId: string) => collection(db, 'stores', storeId, 'supply_items');
const ordersRef = (storeId: string) => collection(db, 'stores', storeId, 'supply_orders');
const settingsRef = (storeId: string) => doc(db, 'stores', storeId, 'supply_settings', 'config');

export function watchSupplyItems(storeId: string, cb: (items: SupplyItem[]) => void) {
  return onSnapshot(itemsRef(storeId), snap => {
    const list = snap.docs.map(d => parseSupplyItem(d.id, d.data()));
    list.sort((a, b) =>
      a.group.toLowerCase().localeCompare(b.group.toLowerCase(), 'vi') ||
      a.order - b.order ||
      a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'vi'));
    cb(list);
  }, err => console.error('watchSupplyItems:', err));
}

export async function saveSupplyItem(storeId: string, item: Omit<SupplyItem, 'id'> & { id?: string }) {
  const data = {
    code: normalizeSupplyCode(item.code), name: item.name.trim(), unit: item.unit.trim(), group: item.group.trim(),
    order: item.order, active: item.active, updatedAt: serverTimestamp(),
  };
  if (!item.id) await addDoc(itemsRef(storeId), { ...data, createdAt: serverTimestamp() });
  else await setDoc(doc(itemsRef(storeId), item.id), data, { merge: true });
}

/** Ẩn / hiện mặt hàng (không xóa hẳn để phiếu cũ vẫn đọc được tên) */
export async function setSupplyItemActive(storeId: string, itemId: string, active: boolean) {
  await updateDoc(doc(itemsRef(storeId), itemId), { active, updatedAt: serverTimestamp() });
}

export function watchSupplySettings(storeId: string, cb: (s: SupplySettings) => void) {
  return onSnapshot(settingsRef(storeId), snap => cb(parseSupplySettings(snap.data())),
    err => console.error('watchSupplySettings:', err));
}

export async function saveSupplySettings(storeId: string, s: SupplySettings) {
  await setDoc(settingsRef(storeId), { ...s, updatedAt: serverTimestamp() }, { merge: true });
}

export function watchSupplyOrder(storeId: string, date: string, cb: (o: SupplyOrder) => void) {
  return onSnapshot(doc(ordersRef(storeId), date), snap => cb(parseSupplyOrder(date, snap.data())),
    err => console.error('watchSupplyOrder:', err));
}

export async function getSupplyOrdersInRange(storeId: string, from: string, to: string): Promise<SupplyOrder[]> {
  const snap = await getDocs(query(ordersRef(storeId), where('date', '>=', from), where('date', '<=', to)));
  return snap.docs
    .map(d => parseSupplyOrder(d.id, d.data()))
    .filter(o => o.lines.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Đặt nhiều mặt hàng một lần — CỘNG DỒN số lượng (increment) và ghi người đặt (arrayUnion), như app */
export async function addManySupplies(
  storeId: string, date: string,
  quantities: { item: SupplyItem; qty: number }[],
  uid: string, userName: string,
) {
  const entries = quantities.filter(e => e.qty > 0);
  if (entries.length === 0) return;
  const at = Date.now();
  const lines: Record<string, unknown> = {};
  for (const { item, qty } of entries) {
    lines[item.id] = {
      code: item.code, name: item.name, unit: item.unit, group: item.group,
      qty: increment(qty),
      contributors: arrayUnion({ uid, name: userName, qty, at }),
      prepared: false,
    };
  }
  await setDoc(doc(ordersRef(storeId), date), { date, updatedAt: serverTimestamp(), lines }, { merge: true });
}

export async function updateSupplyLine(
  storeId: string, date: string, itemId: string,
  qty: number, note: string, uid: string, userName: string,
) {
  await updateDoc(doc(ordersRef(storeId), date), {
    [`lines.${itemId}.qty`]: qty,
    [`lines.${itemId}.note`]: note.trim(),
    [`lines.${itemId}.contributors`]: arrayUnion({ uid, name: `${userName} (sửa thành ${formatQty(qty)})`, qty: 0, at: Date.now() }),
    updatedAt: serverTimestamp(),
  });
}

export async function removeSupplyLine(storeId: string, date: string, itemId: string) {
  await updateDoc(doc(ordersRef(storeId), date), {
    [`lines.${itemId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}

export async function setSupplyPrepared(
  storeId: string, date: string, itemId: string,
  prepared: boolean, uid: string, userName: string,
) {
  await updateDoc(doc(ordersRef(storeId), date), {
    [`lines.${itemId}.prepared`]: prepared,
    [`lines.${itemId}.preparedBy`]: prepared ? uid : deleteField(),
    [`lines.${itemId}.preparedByName`]: prepared ? userName : deleteField(),
    [`lines.${itemId}.preparedAt`]: prepared ? serverTimestamp() : deleteField(),
    updatedAt: serverTimestamp(),
  });
}

// ==================== EXCEL ====================

export const SUPPLY_EXPORT_HEADERS = [
  'Ngày nhận', 'Nhóm', 'Mã hàng', 'Mặt hàng', 'Đơn vị', 'Số lượng', 'Người đặt', 'Ghi chú', 'Đã soạn', 'Người soạn', 'Giờ soạn',
];

function vnTime(ms: number | null): string {
  if (ms == null) return '';
  const d = new Date(ms + VN_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

/** Mỗi món của mỗi phiếu một dòng (cùng cột với bản xuất trên app) */
export function supplyExportRows(orders: SupplyOrder[]): (string | number)[][] {
  return orders.flatMap(o => o.lines.map(l => [
    supplyDisplay(o.date), l.group, l.code, l.name, l.unit, l.qty,
    contributorNames(l).join(', '), l.note,
    l.prepared ? 'Đã soạn' : 'Chưa soạn',
    l.prepared ? (l.preparedByName || l.preparedBy) : '',
    l.prepared ? vnTime(l.preparedAt) : '',
  ]));
}

export async function exportSupplyOrders(orders: SupplyOrder[], from: string, to: string, storeName: string) {
  const [excelModule, fileSaverModule] = await Promise.all([import('exceljs'), import('file-saver')]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ExcelJS = ((excelModule as any).default || excelModule) as typeof import('exceljs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveAs = ((fileSaverModule as any).saveAs || (fileSaverModule as any).default) as (b: Blob, n: string) => void;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Đặt & soạn hàng');
  ws.addRow([`ĐẶT & SOẠN HÀNG — ${storeName}`]).font = { bold: true, size: 14 };
  ws.addRow([`Từ ${supplyDisplay(from)} đến ${supplyDisplay(to)}`]);
  ws.addRow([]);
  const header = ws.addRow(SUPPLY_EXPORT_HEADERS);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } }; });
  for (const r of supplyExportRows(orders)) ws.addRow(r);
  [12, 14, 12, 28, 10, 10, 30, 24, 12, 18, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Dat_soan_hang_${sanitize(storeName)}_${from}_${to}.xlsx`);
}
