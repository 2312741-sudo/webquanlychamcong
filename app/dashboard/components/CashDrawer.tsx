'use client';
/**
 * Nút + hộp thoại MỞ KÉT — mã dùng 1 lần (xem lib/cashDrawer.ts):
 *  - Quản lý 1: chọn lý do → gửi yêu cầu cho Chủ → nhập mã 6 số Chủ gửi → két bật.
 *  - Chủ: thấy mã các yêu cầu đang chờ (gửi cho quản lý); tự mở két không cần nhập mã.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Vault } from 'lucide-react';
import { useApp } from '../layout';
import {
  CASH_DRAWER_REASONS, canOpenCashDrawer, createOpenRequest, fullReason, getOwnerSecret, isOwnerRole, isRequestAlive,
  logCashDrawerOpen, otpFor, sendOpenCommand, setRequestStatus, watchCashDrawerConfig, watchCashDrawerRequests,
  type CashDrawerConfig, type CashDrawerRequest,
} from '@/lib/cashDrawer';

function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function minutesLeft(r: CashDrawerRequest, now: number): number {
  return Math.max(0, Math.ceil((r.createdAtMs + 15 * 60_000 - now) / 60_000));
}

/** CHỦ: mã của các yêu cầu đang chờ (của quản lý) để gửi cho họ */
export function OwnerCodesPanel({ storeId, requests, compact = false }: { storeId: string; requests: CashDrawerRequest[]; compact?: boolean }) {
  const now = useNow();
  const [secret, setSecret] = useState<string | null | undefined>(undefined);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState('');
  const { user } = useApp();
  const alive = useMemo(() => requests.filter((r) => isRequestAlive(r, now) && r.uid !== user?.uid), [requests, now, user?.uid]);

  useEffect(() => {
    let ok = true;
    getOwnerSecret(storeId).then((s) => ok && setSecret(s)).catch(() => ok && setSecret(null));
    return () => {
      ok = false;
    };
  }, [storeId]);

  useEffect(() => {
    if (!secret) return;
    let ok = true;
    Promise.all(alive.map(async (r) => [r.id, await otpFor(secret, r.nonce)] as const)).then((pairs) => {
      if (ok) setCodes(Object.fromEntries(pairs));
    });
    return () => {
      ok = false;
    };
  }, [secret, alive]);

  if (alive.length === 0) return compact ? null : <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Không có yêu cầu mở két nào đang chờ.</p>;
  if (secret === null) {
    return <p style={{ fontSize: 13, color: 'var(--danger)' }}>Có yêu cầu mở két nhưng Chủ chưa có khóa: ghép nối laptop (Két tiền) trên chính laptop cắm máy in.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alive.map((r) => (
        <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.reason} • còn {minutesLeft(r, now)} phút</div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, fontVariantNumeric: 'tabular-nums' }}>{codes[r.id] ?? '······'}</div>
          <button
            className="btn btn-secondary btn-sm"
            disabled={!codes[r.id]}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(codes[r.id]);
                setCopied(r.id);
                setTimeout(() => setCopied(''), 1500);
              } catch {
                // trình duyệt chặn chép — người dùng đọc mã trên màn hình
              }
            }}
          >
            {copied === r.id ? 'Đã chép' : 'Chép mã'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setRequestStatus(storeId, r.id, 'cancelled').catch(() => {})}>Từ chối</button>
        </div>
      ))}
    </div>
  );
}

export function CashDrawerModal({ onClose }: { onClose: () => void }) {
  const { user, storeId, currentMember, role } = useApp();
  const now = useNow();
  const [cfg, setCfg] = useState<CashDrawerConfig | null | undefined>(undefined);
  const [requests, setRequests] = useState<CashDrawerRequest[]>([]);
  const [loadError, setLoadError] = useState('');
  const [reason, setReason] = useState(CASH_DRAWER_REASONS[0]);
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const owner = isOwnerRole(role);

  useEffect(() => {
    if (!storeId) return;
    const u1 = watchCashDrawerConfig(storeId, setCfg, (e) => setLoadError(e.message));
    const u2 = watchCashDrawerRequests(storeId, setRequests, (e) => setLoadError(e.message));
    return () => {
      u1();
      u2();
    };
  }, [storeId]);

  if (!user || !storeId) return null;
  const uid = user.uid;
  const name = currentMember?.name || user.displayName || user.email || uid;
  const paired = !!cfg?.token;
  // Yêu cầu còn hạn của chính mình (quản lý đang chờ mã)
  const myPending = owner ? undefined : requests.find((r) => r.uid === uid && isRequestAlive(r, now));

  const finish = async (req: CashDrawerRequest, err: string | null) => {
    try {
      await logCashDrawerOpen(storeId, { uid, name, role: String(role || ''), reason: req.reason, ok: !err, error: err || undefined, requestId: req.id });
    } catch (logErr) {
      console.warn('[CashDrawer] Không ghi được nhật ký mở két:', logErr);
    }
    if (!err) {
      await setRequestStatus(storeId, req.id, 'opened').catch(() => {});
      setMsg({ ok: true, text: 'Đã mở két' });
      setTimeout(onClose, 1200);
    } else {
      setMsg({ ok: false, text: err });
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  // CHỦ: mở ngay (tự tính mã từ khóa bí mật)
  const ownerOpen = () => run(async () => {
    if (!cfg) return;
    const secret = await getOwnerSecret(storeId);
    if (!secret) throw new Error('Chủ chưa có khóa mở két: ghép nối laptop (Két tiền) trên chính laptop cắm máy in.');
    const req = await createOpenRequest(storeId, { uid, name, role: String(role || '') }, fullReason(reason, note), false);
    await finish(req, await sendOpenCommand(cfg, { nonce: req.nonce, otp: await otpFor(secret, req.nonce), by: name }));
  });

  // QUẢN LÝ: gửi yêu cầu cho Chủ
  const sendRequest = () => run(async () => {
    await createOpenRequest(storeId, { uid, name, role: String(role || '') }, fullReason(reason, note), true);
    setMsg({ ok: true, text: 'Đã gửi yêu cầu cho Chủ. Nhập mã 6 số Chủ gửi cho bạn.' });
  });

  // QUẢN LÝ: nhập mã
  const submitCode = () => run(async () => {
    if (!cfg || !myPending) return;
    if (!/^\d{6}$/.test(code)) throw new Error('Mã gồm 6 số');
    const err = await sendOpenCommand(cfg, { nonce: myPending.nonce, otp: code, by: name });
    if (err) setCode('');
    await finish(myPending, err);
  });

  const reasonFields = (
    <>
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
    </>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <span className="modal-title">Mở két tiền</span>
          <button className="modal-close" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        {cfg === undefined && !loadError && <p style={{ fontSize: 14 }}>Đang tải…</p>}
        {loadError && <p style={{ color: 'var(--danger)', fontSize: 14 }}>Không đọc được dữ liệu két: {loadError}</p>}

        {cfg !== undefined && !paired && (
          <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p>Chưa ghép nối laptop mở két. Cài phần mềm <b>Trạm Mở Két</b> trên laptop cắm máy in KV804, rồi <b>Chủ</b> ghép nối.</p>
            <Link href="/dashboard/cash-drawer" className="btn btn-primary" onClick={onClose}>Đi tới trang Két tiền</Link>
          </div>
        )}

        {paired && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {owner && (
              <>
                <OwnerCodesPanel storeId={storeId} requests={requests} compact />
                {reasonFields}
                <button className="btn btn-primary" disabled={busy} onClick={ownerOpen}>{busy ? 'Đang mở…' : 'Mở két ngay'}</button>
              </>
            )}

            {!owner && !myPending && (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Gửi yêu cầu cho Chủ. Chủ sẽ gửi bạn mã 6 số dùng 1 lần (hết hạn sau 15 phút).</p>
                {reasonFields}
                <button className="btn btn-primary" disabled={busy} onClick={sendRequest}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu cho Chủ'}</button>
              </>
            )}

            {!owner && myPending && (
              <>
                <p style={{ fontSize: 13 }}>
                  Yêu cầu: <b>{myPending.reason}</b> • còn {minutesLeft(myPending, now)} phút. Nhập mã 6 số Chủ gửi cho bạn:
                </p>
                <input
                  className="input"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) submitCode(); }}
                  style={{ letterSpacing: 8, fontSize: 24, textAlign: 'center' }}
                />
                <button className="btn btn-primary" disabled={busy || code.length !== 6} onClick={submitCode}>{busy ? 'Đang mở…' : 'Mở két'}</button>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => setRequestStatus(storeId, myPending.id, 'cancelled'))}>
                  Hủy yêu cầu
                </button>
              </>
            )}

            {msg && <p style={{ fontSize: 14, fontWeight: 600, color: msg.ok ? 'var(--success, #1a7f5a)' : 'var(--danger, #c0392b)' }}>{msg.text}</p>}
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Web chỉ mở két được trên chính laptop cắm máy in; ở máy khác dùng app điện thoại. Mỗi lần mở đều được ghi nhật ký.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Nút trên thanh trên cùng (Chủ / Quản lý 1). Chủ: có chấm đỏ khi có yêu cầu đang chờ mã */
export function CashDrawerButton() {
  const { role, storeId, user } = useApp();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const allowed = !!storeId && canOpenCashDrawer(role);
  const owner = isOwnerRole(role);

  useEffect(() => {
    if (!allowed || !owner || !storeId) return;
    return watchCashDrawerRequests(storeId, (rs) => setPending(rs.filter((r) => isRequestAlive(r) && r.uid !== user?.uid).length));
  }, [allowed, owner, storeId, user?.uid]);

  if (!allowed) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={pending ? `${pending} yêu cầu mở két đang chờ mã` : 'Mở két tiền'}
        style={{
          background: pending ? 'var(--primary-light)' : 'var(--surface)', border: 'none', height: 38, borderRadius: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 10px', position: 'relative',
          fontSize: 13, fontWeight: 600, color: 'var(--neutral)', flexShrink: 0,
        }}
      >
        <Vault size={18} strokeWidth={1.75} aria-hidden="true" />
        <span className="cash-drawer-label">Mở két</span>
        {pending > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, background: 'var(--primary)', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {pending}
          </span>
        )}
      </button>
      {open && <CashDrawerModal onClose={() => setOpen(false)} />}
    </>
  );
}
