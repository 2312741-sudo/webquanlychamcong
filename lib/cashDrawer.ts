/**
 * MỞ KÉT TIỀN (KiotViet) qua máy in hóa đơn KV804 cắm USB vào laptop — MÃ MỞ KÉT DÙNG 1 LẦN.
 *
 * Laptop chạy phần mềm "Trạm Mở Két" (tools/tram-mo-ket, tải ở /downloads/TramMoKet.zip) ở cổng 8787.
 * CHỈ APP ĐIỆN THOẠI MỞ KÉT (gọi http://<IP LAN laptop>:8787, cùng wifi). Web KHÔNG mở két: web trên chính laptop chỉ
 * ghép nối / chọn máy in (http://127.0.0.1:8787) và cho Chủ xem mã.
 * Quy trình:
 *   - Quản lý (QL1 / QL2) tạo YÊU CẦU (stores/{id}/cash_drawer_requests, nonce = "<id>.<thời điểm ms>") → thông báo cho Chủ.
 *   - Chủ thấy MÃ 6 SỐ = HMAC-SHA256(khóa bí mật của Chủ, nonce) trên app / web → gửi quản lý → quản lý nhập mã.
 *   - Laptop tự kiểm tra mã (biết khóa bí mật), mỗi mã chỉ mở 1 lần, hết hạn 15 phút. Chủ tự mở không cần nhập mã.
 * Khóa bí mật: laptop giao cho CHỦ ở lần ghép nối đầu, lưu stores/{id}/owner_private/cash_drawer (chỉ Chủ đọc).
 * NHIỀU CỬA HÀNG, 1 TÀI KHOẢN CHỦ: một laptop ghép nối được cho nhiều cửa hàng — cửa hàng ghép sau dùng khóa bí mật
 * Chủ đã lưu ở cửa hàng khác (laptop xác nhận khóa rồi mới cho ghép); mọi cửa hàng dùng chung khóa + mã ghép nối của laptop.
 * Cấu hình chung (mã ghép nối, IP, máy in): stores/{id}/private/cash_drawer (đọc: Chủ / QL1 / QL2; ghi: Chủ / QL1).
 * Nhật ký: stores/{id}/cash_drawer_logs.  Bản Dart song song: appchamcong lib/core/services/cash_drawer_service.dart
 */
import { db } from './firebase';
import {
  collection, deleteField, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { normalizeRole } from './types';

export const AGENT_PORT = 8787;
export const LOCAL_AGENT = `http://127.0.0.1:${AGENT_PORT}`;
export const AGENT_DOWNLOAD_URL = '/downloads/TramMoKet.zip';
/** Mã hết hạn sau 15 phút (khớp phần mềm trên laptop) */
export const OTP_TTL_MS = 15 * 60 * 1000;
export const CASH_DRAWER_REASONS = ['Đổi tiền lẻ', 'Thối tiền cho khách', 'Nộp tiền vào két', 'Kiểm két / giao ca', 'Khác'];

export interface CashDrawerConfig {
  token: string;
  port: number;
  lanIps: string[];
  printer: string;
  computer: string;
  pairedAt?: unknown;
  pairedBy?: string;
  pairedByName?: string;
}

export interface AgentPairInfo {
  ok: boolean;
  version: string;
  token: string;
  port: number;
  lanIps: string[] | string;
  printer: string;
  printers: string[] | string;
  drawerPin: number;
  enabled: boolean;
  computer: string;
  claimed?: boolean;
  ownerVerified?: boolean;
  ownerSecret?: string;
}

export type CashDrawerRequestStatus = 'pending' | 'opened' | 'cancelled';

export interface CashDrawerRequest {
  id: string;
  uid: string;
  name: string;
  role: string;
  reason: string;
  nonce: string;
  createdAtMs: number;
  status: CashDrawerRequestStatus;
  source: 'web' | 'app';
}

export interface CashDrawerLog {
  id: string;
  uid: string;
  name: string;
  role: string;
  source: 'web' | 'app';
  reason: string;
  ok: boolean;
  error?: string;
  requestId?: string;
  at?: { toDate?: () => Date; seconds?: number } | null;
}

/** Chủ, Quản lý 1 và Quản lý 2 được mở két (Quản lý phải có mã của Chủ) */
export function canOpenCashDrawer(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === 'owner' || r === 'manager1' || r === 'manager2';
}

export function isOwnerRole(role?: string | null): boolean {
  return normalizeRole(role) === 'owner';
}

/** Máy in ảo của Windows (Fax, PDF, XPS, OneNote) — gửi lệnh mở két vào đây không có tác dụng. Khớp Trạm Mở Két. */
export function isVirtualPrinter(name: string): boolean {
  return /^(Fax|Microsoft Print to PDF|Microsoft XPS Document Writer|OneNote.*|Send To OneNote.*|Adobe PDF|.*PDF.*Printer.*)$/i.test(name.trim());
}

/** Tên giống máy in hóa đơn (KV804 / Xprinter / POS-80…) */
export function looksLikeReceiptPrinter(name: string): boolean {
  return !isVirtualPrinter(name) && /KV|KIOT|POS|XP-|XPRINTER|RECEIPT|THERMAL|80MM|80C|TM-T|RONGTA|GPRINTER|SUNMI/i.test(name);
}

/** PowerShell có thể trả chuỗi thay vì mảng 1 phần tử */
export function asList(v: string[] | string | null | undefined): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return v ? [String(v)] : [];
}

export function fullReason(reason: string, note: string): string {
  const n = note.trim();
  if (reason === 'Khác') return n || 'Khác';
  return n ? `${reason} — ${n}` : reason;
}

/** Yêu cầu còn hạn dùng mã (15 phút kể từ lúc tạo) */
export function isRequestAlive(r: Pick<CashDrawerRequest, 'status' | 'createdAtMs'>, nowMs = Date.now()): boolean {
  return r.status === 'pending' && nowMs - r.createdAtMs < OTP_TTL_MS;
}

/**
 * Mã 6 số dùng 1 lần: HMAC-SHA256(khóa = UTF8(secret), dữ liệu = UTF8(nonce)) → 4 byte đầu (big-endian), bỏ bit dấu,
 * chia dư 1.000.000. Khớp phần mềm trên laptop (Get-Otp) và app (CashDrawerService.otpFor).
 */
export async function otpFor(secret: string, nonce: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(nonce)));
  const v = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) & 0x7fffffff;
  return String(v % 1_000_000).padStart(6, '0');
}

const configRef = (storeId: string) => doc(db, 'stores', storeId, 'private', 'cash_drawer');
const secretRef = (storeId: string) => doc(db, 'stores', storeId, 'owner_private', 'cash_drawer');
const requestsCol = (storeId: string) => collection(db, 'stores', storeId, 'cash_drawer_requests');

export async function getCashDrawerConfig(storeId: string): Promise<CashDrawerConfig | null> {
  const snap = await getDoc(configRef(storeId));
  return snap.exists() ? (snap.data() as CashDrawerConfig) : null;
}

export function watchCashDrawerConfig(storeId: string, cb: (c: CashDrawerConfig | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(configRef(storeId), (s) => cb(s.exists() ? (s.data() as CashDrawerConfig) : null), (e) => onError?.(e));
}

/** Khóa bí mật (chỉ Chủ đọc được — người khác gọi sẽ lỗi quyền) */
export async function getOwnerSecret(storeId: string): Promise<string | null> {
  const snap = await getDoc(secretRef(storeId));
  const v = snap.exists() ? snap.data()?.secret : null;
  return typeof v === 'string' && v ? v : null;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 4000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

/** Phần mềm trên CHÍNH máy này có đang chạy không */
export async function localAgentStatus(): Promise<{ ok: boolean; version?: string; printer?: string } | null> {
  try {
    const r = await fetchWithTimeout(`${LOCAL_AGENT}/status`, {}, 2500);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Đọc thông tin phần mềm trên chính laptop (không lấy khóa bí mật trừ khi [claim]) */
export async function readLocalAgentPair(opts: { claim?: boolean; ownerSecret?: string | null } = {}): Promise<AgentPairInfo> {
  const headers: Record<string, string> = {};
  if (opts.claim) headers['X-Claim'] = '1';
  if (opts.ownerSecret) headers['X-Owner-Secret'] = opts.ownerSecret;
  let r: Response;
  try {
    r = await fetchWithTimeout(`${LOCAL_AGENT}/pair`, { headers }, 4000);
  } catch {
    throw new Error('Không thấy phần mềm Trạm Mở Két trên máy này. Hãy cài và chạy CaiDat.bat trên laptop cắm máy in, rồi mở trang này trên chính laptop đó.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `Phần mềm từ chối (${r.status})`);
  return j as AgentPairInfo;
}

/**
 * Ghép nối (CHỈ CHỦ, trên chính laptop): nhận khóa bí mật (lần đầu) hoặc xác nhận khóa đã có, rồi lưu mã ghép nối
 * + IP LAN để web / app gửi lệnh.
 * [otherStoreIds]: các cửa hàng khác của Chủ — laptop đã ghép cho cửa hàng khác thì dùng khóa bí mật Chủ lưu ở đó
 * (1 laptop mở két cho nhiều cửa hàng của cùng tài khoản Chủ).
 */
export async function pairLocalAgent(
  storeId: string,
  by: { uid: string; name: string },
  otherStoreIds: string[] = [],
): Promise<AgentPairInfo> {
  const saved = await getOwnerSecret(storeId).catch(() => null);
  let info = await readLocalAgentPair({ claim: true, ownerSecret: saved });
  if (!info.ownerSecret && !info.ownerVerified) {
    // Laptop đã giao khóa cho lần ghép nối trước → thử khóa Chủ đã lưu ở các cửa hàng khác
    const tried = new Set<string>(saved ? [saved] : []);
    for (const id of otherStoreIds) {
      if (!id || id === storeId) continue;
      const s = await getOwnerSecret(id).catch(() => null);
      if (!s || tried.has(s)) continue;
      tried.add(s);
      const r = await readLocalAgentPair({ claim: true, ownerSecret: s });
      if (r.ownerVerified) {
        info = { ...r, ownerSecret: r.ownerSecret || s };
        break;
      }
    }
  }
  if (info.ownerSecret) {
    await setDoc(secretRef(storeId), { secret: info.ownerSecret, updatedAt: serverTimestamp() }, { merge: true });
  } else if (!info.ownerVerified) {
    throw new Error(
      'Laptop này đã giao khóa bí mật cho một lần ghép nối khác, và không cửa hàng nào của tài khoản Chủ này giữ khóa đó. ' +
        'Nếu laptop đang ghép cho cửa hàng của bạn: đăng nhập đúng tài khoản Chủ của cửa hàng đó. ' +
        'Nếu không: chạy GoCaiDat.bat rồi CaiDat.bat trên laptop, sau đó CHỦ ghép nối ngay.',
    );
  }
  await setDoc(
    configRef(storeId),
    {
      token: info.token,
      port: info.port || AGENT_PORT,
      lanIps: asList(info.lanIps),
      printer: info.printer || '',
      computer: info.computer || '',
      pairedAt: serverTimestamp(),
      pairedBy: by.uid,
      pairedByName: by.name,
      pins: deleteField(), // PIN cũ (bản trước) không còn dùng
    },
    { merge: true },
  );
  return info;
}

/** Các cửa hàng (trong [storeIds]) đang ghép nối với laptop có mã ghép nối [token] */
export async function storesPairedWith(token: string, storeIds: string[]): Promise<string[]> {
  if (!token) return [];
  const hits = await Promise.all(
    storeIds.map(async (id) => ((await getCashDrawerConfig(id).catch(() => null))?.token === token ? id : null)),
  );
  return hits.filter((x): x is string => !!x);
}

export async function unpairCashDrawer(storeId: string): Promise<void> {
  await updateDoc(configRef(storeId), {
    token: deleteField(), lanIps: deleteField(), printer: deleteField(), computer: deleteField(),
  });
}

/** Đổi máy in / chân két trên phần mềm (chỉ từ chính laptop) và cập nhật cấu hình cửa hàng */
export async function updateLocalAgent(storeId: string, body: { printerName?: string; drawerPin?: number }): Promise<void> {
  let r: Response;
  try {
    r = await fetchWithTimeout(`${LOCAL_AGENT}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Không kết nối được phần mềm Trạm Mở Két trên máy này');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `Phần mềm báo lỗi (${r.status})`);
  await setDoc(configRef(storeId), { printer: j.printer || '' }, { merge: true });
}

export async function setRequestStatus(storeId: string, id: string, status: CashDrawerRequestStatus): Promise<void> {
  await updateDoc(doc(requestsCol(storeId), id), {
    status,
    ...(status === 'opened' ? { openedAt: serverTimestamp() } : {}),
  });
}

export function watchCashDrawerRequests(storeId: string, cb: (r: CashDrawerRequest[]) => void, onError?: (e: Error) => void) {
  const q = query(requestsCol(storeId), orderBy('createdAtMs', 'desc'), limit(30));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CashDrawerRequest, 'id'>) }))),
    (e) => onError?.(e),
  );
}

export function watchCashDrawerLogs(storeId: string, cb: (logs: CashDrawerLog[]) => void, onError?: (e: Error) => void, max = 200) {
  const q = query(collection(db, 'stores', storeId, 'cash_drawer_logs'), orderBy('at', 'desc'), limit(max));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CashDrawerLog, 'id'>) }))),
    (e) => onError?.(e),
  );
}
