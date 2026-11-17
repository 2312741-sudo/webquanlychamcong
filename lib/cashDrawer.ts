/**
 * MỞ KÉT TIỀN (KiotViet) qua máy in hóa đơn KV804 cắm USB vào laptop.
 *
 * Laptop chạy phần mềm "Trạm Mở Két" (tools/tram-mo-ket, tải ở /downloads/TramMoKet.zip) lắng nghe cổng 8787:
 *   web trên chính laptop gọi http://127.0.0.1:8787, app điện thoại gọi http://<IP LAN laptop>:8787 (cùng wifi).
 * Ghép nối: web trên laptop đọc mã ghép nối (/pair, chỉ trả cho web Chấm Công trên chính laptop) rồi lưu vào
 *   stores/{storeId}/private/cash_drawer  (chỉ Chủ / Quản lý 1 đọc được) để web + app dùng.
 * Mỗi Chủ / Quản lý 1 có PIN riêng (lưu dạng băm SHA-256 trong cùng tài liệu, trường pins.{uid}).
 * Mỗi lần mở két ghi stores/{storeId}/cash_drawer_logs.  Bản Dart song song: appchamcong lib/core/services/cash_drawer_service.dart
 */
import { db } from './firebase';
import {
  addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, deleteField,
} from 'firebase/firestore';
import { normalizeRole } from './types';

export const AGENT_PORT = 8787;
export const LOCAL_AGENT = `http://127.0.0.1:${AGENT_PORT}`;
export const AGENT_DOWNLOAD_URL = '/downloads/TramMoKet.zip';

export interface CashDrawerConfig {
  token: string;
  port: number;
  lanIps: string[];
  printer: string;
  computer: string;
  pairedAt?: unknown;
  pairedBy?: string;
  pairedByName?: string;
  /** uid → SHA-256(PIN) */
  pins?: Record<string, string>;
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
  at?: { toDate?: () => Date; seconds?: number } | null;
}

/** Chủ và Quản lý 1 được mở két (đọc được cấu hình riêng của cửa hàng) */
export function canOpenCashDrawer(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === 'owner' || r === 'manager1';
}

/** PowerShell có thể trả chuỗi thay vì mảng 1 phần tử */
export function asList(v: string[] | string | null | undefined): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  return v ? [String(v)] : [];
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/** Băm PIN gắn với cửa hàng + người dùng (khớp CashDrawerService.pinHash bên app) */
export async function pinHash(storeId: string, uid: string, pin: string): Promise<string> {
  const data = new TextEncoder().encode(`tram-mo-ket|${storeId}|${uid}|${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const configRef = (storeId: string) => doc(db, 'stores', storeId, 'private', 'cash_drawer');

export async function getCashDrawerConfig(storeId: string): Promise<CashDrawerConfig | null> {
  const snap = await getDoc(configRef(storeId));
  return snap.exists() ? (snap.data() as CashDrawerConfig) : null;
}

export function watchCashDrawerConfig(storeId: string, cb: (c: CashDrawerConfig | null) => void, onError?: (e: Error) => void) {
  return onSnapshot(configRef(storeId), (s) => cb(s.exists() ? (s.data() as CashDrawerConfig) : null), (e) => onError?.(e));
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

/** Đọc thông tin ghép nối từ phần mềm trên chính laptop (chỉ trả cho web Chấm Công) */
export async function readLocalAgentPair(): Promise<AgentPairInfo> {
  let r: Response;
  try {
    r = await fetchWithTimeout(`${LOCAL_AGENT}/pair`, {}, 4000);
  } catch {
    throw new Error('Không thấy phần mềm Trạm Mở Két trên máy này. Hãy cài và chạy CaiDat.bat trên laptop cắm máy in, rồi mở trang này trên chính laptop đó.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `Phần mềm từ chối ghép nối (${r.status})`);
  return j as AgentPairInfo;
}

/** Ghép nối: lưu mã + IP LAN của laptop vào cấu hình riêng của cửa hàng */
export async function pairLocalAgent(storeId: string, by: { uid: string; name: string }): Promise<AgentPairInfo> {
  const info = await readLocalAgentPair();
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
    },
    { merge: true },
  );
  return info;
}

export async function unpairCashDrawer(storeId: string): Promise<void> {
  await updateDoc(configRef(storeId), {
    token: deleteField(), lanIps: deleteField(), printer: deleteField(), computer: deleteField(),
  });
}

/** Đổi máy in / chân két trên phần mềm (chỉ từ chính laptop) và cập nhật cấu hình cửa hàng */
export async function updateLocalAgent(
  storeId: string,
  body: { printerName?: string; drawerPin?: number; enabled?: boolean; newToken?: boolean },
): Promise<void> {
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
  await setDoc(configRef(storeId), { token: j.token, printer: j.printer || '' }, { merge: true });
}

export async function setMyCashDrawerPin(storeId: string, uid: string, pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error('PIN gồm 4–6 chữ số');
  await setDoc(configRef(storeId), { pins: { [uid]: await pinHash(storeId, uid, pin) } }, { merge: true });
}

export async function checkCashDrawerPin(cfg: CashDrawerConfig | null, storeId: string, uid: string, pin: string): Promise<boolean> {
  const saved = cfg?.pins?.[uid];
  if (!saved || !isValidPin(pin)) return false;
  return saved === (await pinHash(storeId, uid, pin));
}

/** Thứ tự thử: phần mềm trên chính máy này (web mở trên laptop) rồi tới IP LAN của laptop */
export function agentUrls(cfg: Pick<CashDrawerConfig, 'port' | 'lanIps'>, includeLocal = true): string[] {
  const port = cfg.port || AGENT_PORT;
  const urls = includeLocal ? [`http://127.0.0.1:${port}`] : [];
  for (const ip of asList(cfg.lanIps)) urls.push(`http://${ip}:${port}`);
  return [...new Set(urls)];
}

/**
 * Gửi lệnh mở két TỪ WEB. Trình duyệt chỉ cho trang https gọi http tới chính máy (127.0.0.1), nên web chỉ mở két
 * được khi mở trên laptop cắm máy in; máy khác dùng app điện thoại (gọi IP LAN của laptop).
 * Trả về null nếu mở được, ngược lại là thông báo lỗi.
 */
export async function sendOpenCommand(cfg: CashDrawerConfig, by: string): Promise<string | null> {
  if (!cfg?.token) return 'Chưa ghép nối laptop mở két (Két tiền → Ghép nối)';
  const lastErr =
    'Không thấy phần mềm mở két trên máy này. Web chỉ mở két được trên chính laptop cắm máy in (đang bật phần mềm Trạm Mở Két); ở máy khác hãy dùng app điện thoại.';
  for (const base of agentUrls({ port: cfg.port, lanIps: [] })) {
    try {
      const r = await fetchWithTimeout(`${base}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Drawer-Token': cfg.token },
        body: JSON.stringify({ by, source: 'web' }),
      }, 4000);
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) return null;
      // Laptop trả lời nhưng báo lỗi (sai mã ghép nối, lỗi máy in) → không thử địa chỉ khác
      return j.error || `Laptop báo lỗi (${r.status})`;
    } catch {
      // thử địa chỉ tiếp theo
    }
  }
  return lastErr;
}

export async function logCashDrawerOpen(
  storeId: string,
  entry: { uid: string; name: string; role: string; reason: string; ok: boolean; error?: string },
): Promise<void> {
  await addDoc(collection(db, 'stores', storeId, 'cash_drawer_logs'), {
    ...entry,
    error: entry.error || null,
    source: 'web',
    at: serverTimestamp(),
  });
}

export function watchCashDrawerLogs(storeId: string, cb: (logs: CashDrawerLog[]) => void, onError?: (e: Error) => void, max = 200) {
  const q = query(collection(db, 'stores', storeId, 'cash_drawer_logs'), orderBy('at', 'desc'), limit(max));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CashDrawerLog, 'id'>) }))),
    (e) => onError?.(e),
  );
}
