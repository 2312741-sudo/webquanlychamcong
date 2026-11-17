'use client';
/**
 * KÉT TIỀN (Chủ / Quản lý 1): ghép nối laptop cắm máy in KV804 (phần mềm Trạm Mở Két), chọn máy in / chân két,
 * đặt PIN mở két của mình, thử mở két và xem nhật ký mở két (web + app).
 */
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../layout';
import { normalizeRole } from '@/lib/types';
import {
  AGENT_DOWNLOAD_URL, asList, canOpenCashDrawer, checkCashDrawerPin, isValidPin, localAgentStatus, pairLocalAgent,
  readLocalAgentPair, setMyCashDrawerPin, unpairCashDrawer, updateLocalAgent, watchCashDrawerConfig, watchCashDrawerLogs,
  type AgentPairInfo, type CashDrawerConfig, type CashDrawerLog,
} from '@/lib/cashDrawer';
import { CashDrawerModal } from '../components/CashDrawer';

function fmtTime(at: CashDrawerLog['at']): string {
  try {
    const d = at?.toDate ? at.toDate() : at?.seconds ? new Date(at.seconds * 1000) : null;
    return d ? d.toLocaleString('vi-VN', { hour12: false }) : '…';
  } catch {
    return '';
  }
}

export default function CashDrawerPage() {
  const { user, storeId, currentMember, role } = useApp();
  const [cfg, setCfg] = useState<CashDrawerConfig | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [local, setLocal] = useState<AgentPairInfo | null>(null);
  const [localChecked, setLocalChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [logs, setLogs] = useState<CashDrawerLog[]>([]);
  const [logError, setLogError] = useState('');
  const [showOpen, setShowOpen] = useState(false);
  const [printer, setPrinter] = useState('');
  const [drawerPin, setDrawerPin] = useState(0);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');

  const allowed = canOpenCashDrawer(role);
  const isOwner = normalizeRole(role) === 'owner';

  useEffect(() => {
    if (!storeId || !allowed) return;
    const u1 = watchCashDrawerConfig(storeId, setCfg, (e) => setError(e.message));
    const u2 = watchCashDrawerLogs(storeId, setLogs, (e) => setLogError(e.message));
    return () => {
      u1();
      u2();
    };
  }, [storeId, allowed]);

  const checkLocal = useCallback(async () => {
    const st = await localAgentStatus();
    let info: AgentPairInfo | null = null;
    if (st?.ok) {
      try {
        info = await readLocalAgentPair();
      } catch {
        info = null;
      }
    }
    setLocal(info);
    setLocalChecked(true);
    if (info) {
      setPrinter(info.printer || '');
      setDrawerPin(Number(info.drawerPin) || 0);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await checkLocal();
    })();
    return () => {
      alive = false;
    };
  }, [checkLocal]);

  if (!user || !storeId) return null;
  if (!allowed) {
    return <div className="card" style={{ padding: 24 }}>Chỉ Chủ và Quản lý 1 dùng được tính năng két tiền.</div>;
  }

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ ok: true, text: await fn() });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const name = currentMember?.name || user.displayName || user.email || user.uid;
  const paired = !!cfg?.token;
  const hasPin = !!cfg?.pins?.[user.uid];
  const sameLaptop = !!local && paired && local.token === cfg?.token;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      {error && <div className="card" style={{ padding: 16, color: 'var(--danger)' }}>Không đọc được cấu hình: {error}</div>}
      {notice && (
        <div className="card" style={{ padding: 14, fontWeight: 600, color: notice.ok ? 'var(--success, #1a7f5a)' : 'var(--danger, #c0392b)' }}>
          {notice.text}
        </div>
      )}

      {/* 1. Ghép nối */}
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>1. Laptop mở két</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Két tiền cắm vào máy in hóa đơn KV804, máy in cắm USB vào laptop. Cài phần mềm <b>Trạm Mở Két</b> trên laptop đó
          (giải nén, chạy <code>CaiDat.bat</code>), rồi mở trang này <b>trên chính laptop đó</b> để ghép nối.
        </p>
        <div style={{ fontSize: 14 }}>
          {paired ? (
            <>
              Đã ghép nối: <b>{cfg?.computer || 'laptop'}</b> • máy in <b>{cfg?.printer || '—'}</b> • IP {asList(cfg?.lanIps).join(', ') || '—'}
              {cfg?.pairedByName ? ` • bởi ${cfg.pairedByName}` : ''}
            </>
          ) : (
            <span style={{ color: 'var(--danger)' }}>Chưa ghép nối laptop nào.</span>
          )}
        </div>
        <div style={{ fontSize: 14 }}>
          Máy đang dùng:{' '}
          {!localChecked ? 'đang kiểm tra…' : local ? (
            <b style={{ color: 'var(--success, #1a7f5a)' }}>đang chạy Trạm Mở Két {local.version} ({local.computer})</b>
          ) : (
            'không có phần mềm Trạm Mở Két'
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a className="btn btn-secondary btn-sm" href={AGENT_DOWNLOAD_URL} download>Tải phần mềm (Windows)</a>
          <button className="btn btn-ghost btn-sm" onClick={checkLocal} disabled={busy}>Kiểm tra lại</button>
          {local && (
            <button
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => run(async () => {
                const info = await pairLocalAgent(storeId, { uid: user.uid, name });
                setLocal(info);
                return `Đã ghép nối với ${info.computer}. App điện thoại (cùng wifi) sẽ mở két qua IP ${asList(info.lanIps).join(', ')}.`;
              })}
            >
              {sameLaptop ? 'Ghép nối lại (cập nhật IP)' : 'Ghép nối với laptop này'}
            </button>
          )}
          {paired && isOwner && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Hủy ghép nối? Web và app sẽ không mở két được cho tới khi ghép nối lại.')) return;
                run(async () => {
                  await unpairCashDrawer(storeId);
                  return 'Đã hủy ghép nối';
                });
              }}
            >
              Hủy ghép nối
            </button>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Mẹo: đặt IP cố định cho laptop trong router (hoặc ghép nối lại khi IP đổi) để app luôn tìm thấy laptop.
        </p>
      </div>

      {/* 2. Máy in & chân két (chỉ khi đang ở trên laptop có phần mềm) */}
      {local && (
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>2. Máy in &amp; chân két</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" value={printer} onChange={(e) => setPrinter(e.target.value)} style={{ width: 'auto', minWidth: 240 }}>
              <option value="">— Chọn máy in KV804 —</option>
              {asList(local.printers).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="input" value={drawerPin} onChange={(e) => setDrawerPin(Number(e.target.value))} style={{ width: 'auto' }}>
              <option value={0}>Chân két 2 (thường dùng)</option>
              <option value={1}>Chân két 5</option>
            </select>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !printer}
              onClick={() => run(async () => {
                await updateLocalAgent(storeId, { printerName: printer, drawerPin });
                await checkLocal();
                return 'Đã lưu máy in. Bấm "Mở két" để thử.';
              })}
            >
              Lưu
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bấm thử mở két mà két không bật: đổi sang chân két còn lại.</p>
        </div>
      )}

      {/* 3. PIN */}
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>3. PIN mở két của tôi</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Mỗi Chủ / Quản lý 1 có PIN riêng (4–6 số), nhập mỗi lần mở két trên web và app. {hasPin ? 'Bạn đã có PIN.' : 'Bạn chưa đặt PIN.'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hasPin && (
            <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder="PIN hiện tại" value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))} style={{ width: 140 }} />
          )}
          <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder="PIN mới" value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} style={{ width: 140 }} />
          <input className="input" type="password" inputMode="numeric" maxLength={6} placeholder="Nhập lại PIN mới" value={newPin2}
            onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ''))} style={{ width: 160 }} />
          <button
            className="btn btn-primary btn-sm"
            disabled={busy || !isValidPin(newPin)}
            onClick={() => run(async () => {
              if (newPin !== newPin2) throw new Error('Hai lần nhập PIN mới không khớp');
              if (hasPin && !(await checkCashDrawerPin(cfg ?? null, storeId, user.uid, oldPin))) throw new Error('PIN hiện tại không đúng');
              await setMyCashDrawerPin(storeId, user.uid, newPin);
              setOldPin('');
              setNewPin('');
              setNewPin2('');
              return 'Đã lưu PIN mở két';
            })}
          >
            {hasPin ? 'Đổi PIN' : 'Đặt PIN'}
          </button>
        </div>
      </div>

      {/* 4. Mở két + nhật ký */}
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>4. Nhật ký mở két</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowOpen(true)}>Mở két</button>
        </div>
        {logError && <p style={{ fontSize: 13, color: 'var(--danger)' }}>Không đọc được nhật ký: {logError}</p>}
        {logs.length === 0 && !logError ? (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Chưa có lần mở két nào.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr><th>Thời gian</th><th>Người mở</th><th>Lý do</th><th>Từ</th><th>Kết quả</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtTime(l.at)}</td>
                    <td>{l.name}</td>
                    <td>{l.reason}</td>
                    <td>{l.source === 'app' ? 'App' : 'Web'}</td>
                    <td style={{ color: l.ok ? 'var(--success, #1a7f5a)' : 'var(--danger, #c0392b)' }}>{l.ok ? 'Đã mở' : `Lỗi: ${l.error || ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOpen && <CashDrawerModal onClose={() => setShowOpen(false)} />}
    </div>
  );
}
