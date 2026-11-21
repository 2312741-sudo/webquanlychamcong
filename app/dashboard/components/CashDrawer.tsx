'use client';
/**
 * KÉT TIỀN trên web — WEB KHÔNG MỞ KÉT (chỉ mở bằng app điện thoại, xem lib/cashDrawer.ts):
 *  - Chủ: thấy mã các yêu cầu đang chờ (gửi cho quản lý) — nút trên thanh trên cùng dẫn tới trang Két tiền.
 *  - Quản lý gửi yêu cầu và nhập mã trên app.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Vault } from 'lucide-react';
import { useApp } from '../layout';
import {
  getOwnerSecret, isOwnerRole, isRequestAlive, otpFor, setRequestStatus, watchCashDrawerRequests, type CashDrawerRequest,
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

/** Nút trên thanh trên cùng (CHỈ CHỦ): tới trang Két tiền xem mã; chấm đỏ khi có yêu cầu đang chờ mã. Web không mở két. */
export function CashDrawerButton() {
  const { role, storeId, user } = useApp();
  const [pending, setPending] = useState(0);
  const owner = !!storeId && isOwnerRole(role);

  useEffect(() => {
    if (!owner || !storeId) return;
    return watchCashDrawerRequests(storeId, (rs) => setPending(rs.filter((r) => isRequestAlive(r) && r.uid !== user?.uid).length));
  }, [owner, storeId, user?.uid]);

  if (!owner) return null;
  return (
    <Link
      href="/dashboard/cash-drawer"
      title={pending ? `${pending} yêu cầu mở két đang chờ mã` : 'Két tiền'}
      style={{
        background: pending ? 'var(--primary-light)' : 'var(--surface)', border: 'none', height: 38, borderRadius: 10, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 10px', position: 'relative',
        fontSize: 13, fontWeight: 600, color: 'var(--neutral)', flexShrink: 0, textDecoration: 'none',
      }}
    >
      <Vault size={18} strokeWidth={1.75} aria-hidden="true" />
      <span className="cash-drawer-label">{pending ? 'Mã mở két' : 'Két tiền'}</span>
      {pending > 0 && (
        <span style={{ position: 'absolute', top: -3, right: -3, background: 'var(--primary)', color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
          {pending}
        </span>
      )}
    </Link>
  );
}
