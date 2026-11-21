'use client';
/**
 * KÉT TIỀN (Chủ / Quản lý): ghép nối laptop cắm máy in KV804 (phần mềm Trạm Mở Két — chỉ Chủ), chọn máy in /
 * chân két, mã mở két của các yêu cầu đang chờ (Chủ), mở két và nhật ký mở két (web + app).
 */
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../layout';
import {
  AGENT_DOWNLOAD_URL, asList, isVirtualPrinter, looksLikeReceiptPrinter, canOpenCashDrawer, isOwnerRole, localAgentStatus, pairLocalAgent, readLocalAgentPair,
  storesPairedWith, unpairCashDrawer, updateLocalAgent, watchCashDrawerConfig, watchCashDrawerLogs, watchCashDrawerRequests,
  type AgentPairInfo, type CashDrawerConfig, type CashDrawerLog, type CashDrawerRequest,
} from '@/lib/cashDrawer';
import { CashDrawerModal, OwnerCodesPanel } from '../components/CashDrawer';

function fmtTime(at: CashDrawerLog['at']): string {
  try {
    const d = at?.toDate ? at.toDate() : at?.seconds ? new Date(at.seconds * 1000) : null;
    return d ? d.toLocaleString('vi-VN', { hour12: false }) : '…';
  } catch {
    return '';
  }
}

export default function CashDrawerPage() {
  const { user, storeId, currentMember, role, stores } = useApp();
  const [cfg, setCfg] = useState<CashDrawerConfig | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [local, setLocal] = useState<AgentPairInfo | null>(null);
  const [localChecked, setLocalChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [logs, setLogs] = useState<CashDrawerLog[]>([]);
  const [logError, setLogError] = useState('');
  const [requests, setRequests] = useState<CashDrawerRequest[]>([]);
  const [showOpen, setShowOpen] = useState(false);
  const [printer, setPrinter] = useState('');
  const [drawerPin, setDrawerPin] = useState(0);
  // Cửa hàng (của tài khoản này) đang dùng laptop đang mở trang — 1 laptop mở két cho nhiều cửa hàng
  const [pairedHere, setPairedHere] = useState<string[]>([]);

  const allowed = canOpenCashDrawer(role);
  const owner = isOwnerRole(role);

  useEffect(() => {
    if (!storeId || !allowed) return;
    const u1 = watchCashDrawerConfig(storeId, setCfg, (e) => setError(e.message));
    const u2 = watchCashDrawerLogs(storeId, setLogs, (e) => setLogError(e.message));
    const u3 = watchCashDrawerRequests(storeId, setRequests, () => {});
    return () => {
      u1();
      u2();
      u3();
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

  const storeIdsKey = stores.map((s) => s.id).join(',');
  const localToken = local?.token || '';
  useEffect(() => {
    let alive = true;
    const ids = storeIdsKey ? storeIdsKey.split(',') : [];
    if (!localToken || ids.length === 0) {
      Promise.resolve().then(() => alive && setPairedHere([]));
    } else {
      storesPairedWith(localToken, ids).then((r) => alive && setPairedHere(r));
    }
    return () => {
      alive = false;
    };
  }, [localToken, storeIdsKey, cfg?.token]);

  if (!user || !storeId) return null;
  if (!allowed) {
    return <div className="card" style={{ padding: 24 }}>Chỉ Chủ và Quản lý dùng được tính năng két tiền.</div>;
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
  const sameLaptop = !!local && paired && local.token === cfg?.token;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      {error && <div className="card" style={{ padding: 16, color: 'var(--danger)' }}>Không đọc được cấu hình: {error}</div>}
      {notice && (
        <div className="card" style={{ padding: 14, fontWeight: 600, color: notice.ok ? 'var(--success, #1a7f5a)' : 'var(--danger, #c0392b)' }}>
          {notice.text}
        </div>
      )}

      {/* Mã cho các yêu cầu đang chờ (Chủ) */}
      {owner && (
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Yêu cầu mở két đang chờ mã</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Gửi mã 6 số cho đúng quản lý đã xin. Mỗi mã chỉ mở két 1 lần, hết hạn sau 15 phút.
          </p>
          <OwnerCodesPanel storeId={storeId} requests={requests} />
        </div>
      )}

      {/* 1. Ghép nối */}
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>1. Laptop mở két</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Két tiền cắm vào máy in hóa đơn KV804, máy in cắm USB vào laptop. Cài phần mềm <b>Trạm Mở Két</b> trên laptop đó
          (giải nén, chạy <code>CaiDat.bat</code>), rồi <b>Chủ</b> đăng nhập trang này <b>trên chính laptop đó</b> và bấm ghép nối ngay
          (lần ghép nối đầu tiên nhận khóa bí mật để tạo mã mở két).
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
          {local && owner && (
            <button
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => run(async () => {
                const info = await pairLocalAgent(storeId, { uid: user.uid, name }, stores.map((s) => s.id));
                setLocal(info);
                return `Đã ghép nối với ${info.computer}. App điện thoại (cùng wifi) sẽ mở két qua IP ${asList(info.lanIps).join(', ')}.`;
              })}
            >
              {sameLaptop ? 'Ghép nối lại (cập nhật IP)' : 'Ghép nối với laptop này'}
            </button>
          )}
          {local && !owner && <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>Chỉ Chủ ghép nối được.</span>}
          {paired && owner && (
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
        {local && pairedHere.length > 0 && (
          <div style={{ fontSize: 13 }}>
            Laptop này đang mở két cho:{' '}
            <b>{pairedHere.map((id) => stores.find((s) => s.id === id)?.name || id).join(', ')}</b>
          </div>
        )}
        {owner && stores.length > 1 && (
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Nhiều cửa hàng dùng chung 1 laptop / 1 két: chọn từng cửa hàng ở menu cửa hàng rồi bấm ghép nối trên trang này (cùng tài khoản Chủ).
            Mỗi cửa hàng có yêu cầu và nhật ký mở két riêng.
          </p>
        )}
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
              {/* Máy in hóa đơn lên đầu; máy in ảo (Fax / PDF / XPS) không chọn được */}
              {[...asList(local.printers)]
                .sort((a, b) => Number(looksLikeReceiptPrinter(b)) - Number(looksLikeReceiptPrinter(a)))
                .map((p) => (
                  <option key={p} value={p} disabled={isVirtualPrinter(p)}>
                    {looksLikeReceiptPrinter(p) ? `★ ${p} (máy in hóa đơn)` : isVirtualPrinter(p) ? `${p} — máy in ảo, không dùng được` : p}
                  </option>
                ))}
            </select>
            <select className="input" value={drawerPin} onChange={(e) => setDrawerPin(Number(e.target.value))} style={{ width: 'auto' }}>
              <option value={0}>Chân két 2 (thường dùng)</option>
              <option value={1}>Chân két 5</option>
            </select>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy || !printer || isVirtualPrinter(printer)}
              onClick={() => run(async () => {
                await updateLocalAgent(storeId, { printerName: printer, drawerPin });
                await checkLocal();
                return 'Đã lưu máy in. Bấm "Mở két" để thử.';
              })}
            >
              Lưu
            </button>
          </div>
          {!asList(local.printers).some(looksLikeReceiptPrinter) && (
            <p style={{ fontSize: 13, color: 'var(--danger)' }}>
              Laptop chưa có máy in hóa đơn KV804 (danh sách chỉ là máy in ảo / máy in văn phòng của Windows). Cắm USB máy in KV804,
              cài driver máy in (đi kèm máy hoặc tải từ KiotViet — thường tên XP-80 / POS-80), in thử được rồi bấm &quot;Kiểm tra lại&quot;.
            </p>
          )}
          {printer && isVirtualPrinter(printer) && (
            <p style={{ fontSize: 13, color: 'var(--danger)' }}>&quot;{printer}&quot; là máy in ảo của Windows — két sẽ không mở. Hãy chọn máy in hóa đơn.</p>
          )}
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Danh sách là mọi máy in đã cài trên laptop. Chọn đúng máy in hóa đơn (★). Bấm thử mở két mà két không bật: đổi sang chân két còn lại.
          </p>
        </div>
      )}

      {/* 3. Mở két + nhật ký */}
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>{local ? '3' : '2'}. Nhật ký mở két</h3>
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
