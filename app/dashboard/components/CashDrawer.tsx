'use client';
/**
 * Nút + hộp thoại MỞ KÉT (Chủ / Quản lý 1): nhập PIN (lần đầu đặt PIN) + lý do → gửi lệnh tới phần mềm
 * Trạm Mở Két trên laptop cắm máy in KV804 → ghi nhật ký. Xem lib/cashDrawer.ts.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Vault } from 'lucide-react';
import { useApp } from '../layout';
import {
  canOpenCashDrawer, checkCashDrawerPin, isValidPin, logCashDrawerOpen, sendOpenCommand, setMyCashDrawerPin,
  watchCashDrawerConfig, type CashDrawerConfig,
} from '@/lib/cashDrawer';

export const CASH_DRAWER_REASONS = ['Đổi tiền lẻ', 'Thối tiền cho khách', 'Nộp tiền vào két', 'Kiểm két / giao ca', 'Khác'];

const MAX_WRONG = 5;
const LOCK_MS = 60_000;
// Đếm sai PIN dùng chung cho cả tab (chặn dò PIN)
let wrongCount = 0;
let lockedUntil = 0;

export function CashDrawerModal({ onClose }: { onClose: () => void }) {
  const { user, storeId, currentMember, role } = useApp();
  const [cfg, setCfg] = useState<CashDrawerConfig | null | undefined>(undefined);
  const [cfgError, setCfgError] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [reason, setReason] = useState(CASH_DRAWER_REASONS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!storeId) return;
    return watchCashDrawerConfig(storeId, setCfg, (e) => setCfgError(e.message));
  }, [storeId]);

  useEffect(() => {
    pinRef.current?.focus();
  }, [cfg]);

  if (!user || !storeId) return null;
  const uid = user.uid;
  const name = currentMember?.name || user.displayName || user.email || uid;
  const paired = !!cfg?.token;
  const hasPin = !!cfg?.pins?.[uid];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!cfg) return;
    if (Date.now() < lockedUntil) {
      setMsg({ ok: false, text: `Nhập sai PIN quá nhiều lần. Thử lại sau ${Math.ceil((lockedUntil - Date.now()) / 1000)} giây.` });
      return;
    }
    if (!isValidPin(pin)) {
      setMsg({ ok: false, text: 'PIN gồm 4–6 chữ số' });
      return;
    }
    setBusy(true);
    try {
      if (!hasPin) {
        if (pin !== pin2) {
          setMsg({ ok: false, text: 'Hai lần nhập PIN không khớp' });
          return;
        }
        await setMyCashDrawerPin(storeId, uid, pin);
      } else if (!(await checkCashDrawerPin(cfg, storeId, uid, pin))) {
        wrongCount += 1;
        if (wrongCount >= MAX_WRONG) {
          lockedUntil = Date.now() + LOCK_MS;
          wrongCount = 0;
        }
        setMsg({ ok: false, text: 'Sai PIN' });
        setPin('');
        return;
      }
      wrongCount = 0;
      const fullReason = reason === 'Khác' ? note.trim() || 'Khác' : note.trim() ? `${reason} — ${note.trim()}` : reason;
      const err = await sendOpenCommand(cfg, name);
      // Nhật ký: ghi cả lần thất bại; lỗi ghi nhật ký (vd chưa cập nhật luật Firestore) không chặn việc mở két
      try {
        await logCashDrawerOpen(storeId, { uid, name, role: String(role || ''), reason: fullReason, ok: !err, error: err || undefined });
      } catch (logErr) {
        console.warn('[CashDrawer] Không ghi được nhật ký mở két:', logErr);
      }
      if (err) setMsg({ ok: false, text: err });
      else {
        setMsg({ ok: true, text: 'Đã mở két' });
        setTimeout(onClose, 1200);
      }
    } catch (e2) {
      setMsg({ ok: false, text: e2 instanceof Error ? e2.message : String(e2) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <span className="modal-title">Mở két tiền</span>
          <button className="modal-close" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        {cfg === undefined && !cfgError && <p style={{ fontSize: 14 }}>Đang tải…</p>}
        {cfgError && <p style={{ color: 'var(--danger)', fontSize: 14 }}>Không đọc được cấu hình két: {cfgError}</p>}

        {cfg !== undefined && !paired && (
          <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p>Chưa ghép nối laptop mở két. Cài phần mềm <b>Trạm Mở Két</b> trên laptop cắm máy in KV804 rồi ghép nối.</p>
            <Link href="/dashboard/cash-drawer" className="btn btn-primary" onClick={onClose}>Đi tới trang Két tiền</Link>
          </div>
        )}

        {paired && (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              {hasPin ? 'PIN mở két của bạn' : 'Đặt PIN mở két của bạn (4–6 số)'}
              <input
                ref={pinRef}
                className="input"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                style={{ marginTop: 6, letterSpacing: 6, fontSize: 20, textAlign: 'center' }}
              />
            </label>
            {!hasPin && (
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Nhập lại PIN
                <input
                  className="input"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
                  style={{ marginTop: 6, letterSpacing: 6, fontSize: 20, textAlign: 'center' }}
                />
              </label>
            )}
            <label style={{ fontSize: 13, fontWeight: 600 }}>
              Lý do
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginTop: 6 }}>
                {CASH_DRAWER_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <input
              className="input"
              placeholder={reason === 'Khác' ? 'Ghi rõ lý do' : 'Ghi chú (không bắt buộc)'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
            />
            {msg && (
              <p style={{ fontSize: 14, fontWeight: 600, color: msg.ok ? 'var(--success, #1a7f5a)' : 'var(--danger, #c0392b)' }}>{msg.text}</p>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy || pin.length < 4}>
              {busy ? 'Đang mở…' : hasPin ? 'Mở két' : 'Lưu PIN & mở két'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Web chỉ mở két được trên chính laptop cắm máy in. Mỗi lần mở đều được ghi nhật ký.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/** Nút trên thanh trên cùng (chỉ Chủ / Quản lý 1) */
export function CashDrawerButton() {
  const { role, storeId } = useApp();
  const [open, setOpen] = useState(false);
  if (!storeId || !canOpenCashDrawer(role)) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Mở két tiền"
        style={{
          background: 'var(--surface)', border: 'none', height: 38, borderRadius: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 10px',
          fontSize: 13, fontWeight: 600, color: 'var(--neutral)', flexShrink: 0,
        }}
      >
        <Vault size={18} strokeWidth={1.75} aria-hidden="true" />
        <span className="cash-drawer-label">Mở két</span>
      </button>
      {open && <CashDrawerModal onClose={() => setOpen(false)} />}
    </>
  );
}
