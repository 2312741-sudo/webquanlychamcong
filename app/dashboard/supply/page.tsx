'use client';
import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../layout';
import { watchWeekSchedule } from '@/lib/firestore';
import { getMondayOfWeek, isUserInDepartmentOnDate } from '@/lib/departmentUtils';
import { normalizeRole, ScheduleModel } from '@/lib/types';
import {
  SupplyItem, SupplyOrder, SupplySettings,
  watchSupplyItems, watchSupplyOrder, watchSupplySettings,
  saveSupplyItem, setSupplyItemActive, saveSupplySettings,
  addManySupplies, updateSupplyLine, removeSupplyLine, setSupplyPrepared,
  getSupplyOrdersInRange, exportSupplyOrders,
  supplyToday, supplyAddDays, supplyLabel, supplyDisplay, parseQty, formatQty,
  isOrderLocked, cutoffLabel, contributorNames, validateSupplyCode,
} from '@/lib/supply';

type Tab = 'order' | 'prep' | 'items' | 'history' | 'settings';

const box: React.CSSProperties = { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 16, marginBottom: 16 };
const groupTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#666', margin: '12px 0 6px', textTransform: 'uppercase' };
const codeTag: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, color: '#555', background: '#f1f1f1', borderRadius: 4, padding: '1px 5px', marginRight: 6, fontWeight: 600 };
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f3f3f3' };

/** Báo lỗi lưu cho người dùng (không để lỗi im lặng) */
function alertError(e: unknown) {
  const code = (e as { code?: string })?.code;
  alert(code === 'permission-denied'
    ? 'Không lưu được: không có quyền. Kiểm tra quyền của bạn hoặc Firestore rules chưa được cập nhật.'
    : 'Không lưu được: ' + ((e as Error)?.message || String(e)));
}

function groupBy<T>(list: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x) || 'Khác';
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return [...m.entries()];
}

export default function SupplyPage() {
  const { storeId, store, members, user, currentMember, role } = useApp();
  const isManager = normalizeRole(role) !== 'employee';
  const userName = currentMember?.name || user?.displayName || user?.email || 'Không rõ';

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const today = supplyToday(now);

  const [tab, setTab] = useState<Tab>('order');
  const [date, setDate] = useState(() => supplyAddDays(supplyToday(), 1));
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [settings, setSettings] = useState<SupplySettings>({ cutoffTime: null, preparerDepartmentIds: [] });
  const [order, setOrder] = useState<SupplyOrder>({ date, lines: [] });
  const [schedule, setSchedule] = useState<ScheduleModel | null>(null);

  useEffect(() => {
    if (!storeId) return;
    const a = watchSupplyItems(storeId, setItems);
    const b = watchSupplySettings(storeId, setSettings);
    return () => { a(); b(); };
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    return watchSupplyOrder(storeId, date, setOrder);
  }, [storeId, date]);

  const weekStart = getMondayOfWeek(date);
  useEffect(() => {
    if (!storeId) return;
    return watchWeekSchedule(storeId, weekStart, setSchedule);
  }, [storeId, weekStart]);

  // Người soạn: thuộc bộ phận soạn hàng trong lịch làm ngày đó; chưa chọn bộ phận = ai cũng soạn được
  const isPreparer = useMemo(() => {
    if (!user) return false;
    if (settings.preparerDepartmentIds.length === 0) return true;
    return isUserInDepartmentOnDate({
      userId: user.uid,
      dateStr: date,
      targetDeptIds: settings.preparerDepartmentIds,
      schedule,
      memberDepartment: currentMember?.department,
      storeDepartments: store?.departments,
    });
  }, [user, date, settings.preparerDepartmentIds, schedule, currentMember?.department, store?.departments]);

  const canPrep = isManager || isPreparer;
  const locked = !isManager && isOrderLocked(date, settings.cutoffTime, now);
  const cutoff = cutoffLabel(date, settings.cutoffTime);
  const activeItems = items.filter(i => i.active);
  const prepared = order.lines.filter(l => l.prepared).length;

  const preparerNames = useMemo(() => {
    if (settings.preparerDepartmentIds.length === 0) return [];
    return members
      .filter(m => m.status === 'active')
      .filter(m => isUserInDepartmentOnDate({
        userId: m.userId, dateStr: date, targetDeptIds: settings.preparerDepartmentIds,
        schedule, memberDepartment: m.department, storeDepartments: store?.departments,
      }))
      .map(m => m.name);
  }, [members, date, settings.preparerDepartmentIds, schedule, store?.departments]);

  if (!storeId || !user) return null;

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'order', label: 'Đặt hàng', show: true },
    { id: 'prep', label: `Soạn hàng${order.lines.length ? ` (${prepared}/${order.lines.length})` : ''}`, show: true },
    { id: 'history', label: 'Lịch sử & Excel', show: true },
    { id: 'items', label: 'Danh mục', show: isManager },
    { id: 'settings', label: 'Cài đặt', show: isManager },
  ];

  const dateChips = [-1, 0, 1, 2].map(d => supplyAddDays(today, d));

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', margin: '0 0 6px' }}>Đặt & soạn hàng</h1>
        <p style={{ color: '#666', margin: 0, fontSize: 14 }}>
          Đặt hàng hoá / bao bì cho ngày hôm sau. Người vào ca hôm đó kiểm và tích &quot;Đã soạn&quot;.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #eee', flexWrap: 'wrap' }}>
        {tabs.filter(t => t.show).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? 'var(--primary)' : '#666',
            borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -2,
          }}>{t.label}</button>
        ))}
      </div>

      {(tab === 'order' || tab === 'prep') && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          {dateChips.map(d => (
            <button key={d} className={`btn btn-sm ${d === date ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDate(d)}>
              {supplyLabel(d, now)}
            </button>
          ))}
          <input type="date" className="input" style={{ width: 170 }} value={date}
            onChange={e => e.target.value && setDate(e.target.value)} />
        </div>
      )}

      {tab === 'order' && (
        <OrderTab key={date} storeId={storeId} date={date} items={activeItems} order={order}
          locked={locked} cutoff={cutoff} uid={user.uid} userName={userName} isManager={isManager} />
      )}
      {tab === 'prep' && (
        <PrepTab storeId={storeId} date={date} order={order} canPrep={canPrep}
          preparerNames={preparerNames} filtered={settings.preparerDepartmentIds.length > 0}
          uid={user.uid} userName={userName} />
      )}
      {tab === 'history' && <HistoryTab storeId={storeId} storeName={store?.name ?? ''} today={today} />}
      {tab === 'items' && isManager && <ItemsTab storeId={storeId} items={items} />}
      {tab === 'settings' && isManager && (
        <SettingsTab key={JSON.stringify(settings)} storeId={storeId} settings={settings}
          departments={store?.departments ?? []} />
      )}
    </div>
  );
}

// ==================== ĐẶT HÀNG ====================

function OrderTab({ storeId, date, items, order, locked, cutoff, uid, userName, isManager }: {
  storeId: string; date: string; items: SupplyItem[]; order: SupplyOrder;
  locked: boolean; cutoff: string | null; uid: string; userName: string; isManager: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState<{ itemId: string; qty: string; note: string } | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) : items;

  const ordered = new Map(order.lines.map(l => [l.itemId, l]));
  const filled = items.map(item => ({ item, qty: parseQty(draft[item.id] ?? '') ?? 0 })).filter(e => e.qty > 0);

  const submit = async () => {
    if (filled.length === 0) return;
    setSaving(true);
    setMsg('');
    try {
      await addManySupplies(storeId, date, filled, uid, userName);
      setDraft({});
      setMsg(`Đã thêm ${filled.length} món vào phiếu ${supplyDisplay(date)}`);
    } catch (e) {
      setMsg((e as { code?: string })?.code === 'permission-denied' ? 'Lỗi: không có quyền lưu (Firestore rules chưa cập nhật?)' : 'Lỗi: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const q = parseQty(editing.qty);
    if (q === null) { setMsg('Số lượng không hợp lệ'); return; }
    try {
      await updateSupplyLine(storeId, date, editing.itemId, q, editing.note, uid, userName);
      setEditing(null);
    } catch (e) { alertError(e); }
  };

  return (
    <>
      {cutoff && (
        <div style={{ ...box, background: locked ? '#fff4f4' : '#f6faf6', borderColor: locked ? '#f5c2c2' : '#cfe8cf' }}>
          {locked
            ? <>Đã quá giờ chốt đặt (<b>{cutoff}</b>). Liên hệ quản lý nếu cần thêm hàng.</>
            : <>Giờ chốt đặt cho phiếu này: <b>{cutoff}</b>{isManager ? ' (quản lý vẫn sửa được sau giờ chốt)' : ''}</>}
        </div>
      )}

      {!locked && (
        <div style={box}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Nhập số lượng / trọng lượng cần đặt</div>
          <div style={{ fontSize: 13, color: '#888' }}>Nhiều người cùng đặt sẽ được cộng dồn vào một phiếu.</div>
          {items.length === 0 && <p style={{ color: '#888' }}>Chưa có danh mục hàng. Quản lý thêm ở tab &quot;Danh mục&quot;.</p>}
          {items.length > 8 && (
            <input className="input" style={{ width: '100%', margin: '10px 0 0' }} placeholder="Tìm theo tên hoặc mã hàng"
              value={query} onChange={e => setQuery(e.target.value)} />
          )}
          {q && shown.length === 0 && <p style={{ color: '#888' }}>Không có mặt hàng khớp &quot;{query}&quot;.</p>}
          {groupBy(shown, i => i.group).map(([g, list]) => (
            <div key={g}>
              <div style={groupTitle}>{g}</div>
              {list.map(item => {
                const cur = ordered.get(item.id);
                return (
                  <div key={item.id} style={row}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{item.code && <span style={codeTag}>{item.code}</span>}{item.name}</div>
                      {cur && <div style={{ fontSize: 12, color: 'var(--primary)' }}>Đã đặt: {formatQty(cur.qty)} {cur.unit}</div>}
                    </div>
                    <input className="input" inputMode="decimal" placeholder="0" style={{ width: 100, textAlign: 'right' }}
                      value={draft[item.id] ?? ''}
                      onChange={e => setDraft(d => ({ ...d, [item.id]: e.target.value }))} />
                    <span style={{ width: 60, color: '#666', fontSize: 13 }}>{item.unit}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" disabled={saving || filled.length === 0} onClick={submit}>
              {saving ? 'Đang lưu…' : `Thêm vào phiếu (${filled.length} món)`}
            </button>
            {msg && <span style={{ fontSize: 13, color: msg.startsWith('Lỗi') ? 'var(--danger)' : 'var(--primary)' }}>{msg}</span>}
          </div>
        </div>
      )}

      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Phiếu {supplyDisplay(date)} — {order.lines.length} món</div>
        {order.lines.length === 0 && <p style={{ color: '#888', margin: 0 }}>Chưa ai đặt hàng cho ngày này.</p>}
        {order.lines.map(l => (
          <div key={l.itemId} style={row}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{l.code && <span style={codeTag}>{l.code}</span>}{l.name} <span style={{ color: '#888', fontWeight: 400 }}>· {l.group}</span></div>
              <div style={{ fontSize: 12, color: '#888' }}>Người đặt: {contributorNames(l).join(', ')}{l.note ? ` · Ghi chú: ${l.note}` : ''}</div>
            </div>
            {editing?.itemId === l.itemId ? (
              <>
                <input className="input" style={{ width: 80 }} value={editing.qty}
                  onChange={e => setEditing({ ...editing, qty: e.target.value })} />
                <input className="input" style={{ width: 140 }} placeholder="Ghi chú" value={editing.note}
                  onChange={e => setEditing({ ...editing, note: e.target.value })} />
                <button className="btn btn-sm btn-primary" onClick={saveEdit}>Lưu</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>Huỷ</button>
              </>
            ) : (
              <>
                <b>{formatQty(l.qty)} {l.unit}</b>
                {l.prepared && <span className="badge badge-active">Đã soạn</span>}
                {!locked && (
                  <button className="btn btn-sm btn-ghost"
                    onClick={() => setEditing({ itemId: l.itemId, qty: formatQty(l.qty), note: l.note })}>Sửa</button>
                )}
                {isManager && (
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }}
                    onClick={() => confirm(`Xoá "${l.name}" khỏi phiếu?`) && removeSupplyLine(storeId, date, l.itemId).catch(alertError)}>Xoá</button>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ==================== SOẠN HÀNG ====================

function PrepTab({ storeId, date, order, canPrep, preparerNames, filtered, uid, userName }: {
  storeId: string; date: string; order: SupplyOrder; canPrep: boolean;
  preparerNames: string[]; filtered: boolean; uid: string; userName: string;
}) {
  const done = order.lines.filter(l => l.prepared).length;
  return (
    <>
      <div style={box}>
        {filtered
          ? <>Người soạn hàng {supplyDisplay(date)} (theo lịch làm): <b>{preparerNames.length ? preparerNames.join(', ') : 'chưa có ai trong lịch'}</b></>
          : <>Chưa giới hạn bộ phận soạn hàng — ai vào ca cũng tích được.</>}
        {!canPrep && <div style={{ marginTop: 6, color: 'var(--danger)', fontSize: 13 }}>Bạn không thuộc bộ phận soạn hàng ngày này nên chỉ xem được.</div>}
      </div>
      <div style={box}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          Đã soạn {done}/{order.lines.length}        </div>
        {order.lines.length === 0 && <p style={{ color: '#888', margin: 0 }}>Phiếu ngày này trống.</p>}
        {groupBy(order.lines, l => l.group).map(([g, list]) => (
          <div key={g}>
            <div style={groupTitle}>{g}</div>
            {list.map(l => (
              <label key={l.itemId} style={{ ...row, cursor: canPrep ? 'pointer' : 'default', opacity: l.prepared ? 0.7 : 1 }}>
                <input type="checkbox" checked={l.prepared} disabled={!canPrep} style={{ width: 18, height: 18 }}
                  onChange={e => setSupplyPrepared(storeId, date, l.itemId, e.target.checked, uid, userName).catch(alertError)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, textDecoration: l.prepared ? 'line-through' : 'none' }}>{l.code && <span style={codeTag}>{l.code}</span>}{l.name}</div>
                  {l.note && <div style={{ fontSize: 12, color: '#888' }}>Ghi chú: {l.note}</div>}
                  {l.prepared && <div style={{ fontSize: 12, color: 'var(--primary)' }}>✓ {l.preparedByName || l.preparedBy}</div>}
                </div>
                <b>{formatQty(l.qty)} {l.unit}</b>
              </label>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ==================== LỊCH SỬ & EXCEL ====================

function HistoryTab({ storeId, storeName, today }: { storeId: string; storeName: string; today: string }) {
  const [from, setFrom] = useState(() => supplyAddDays(today, -6));
  const [to, setTo] = useState(() => supplyAddDays(today, 1));
  const [orders, setOrders] = useState<SupplyOrder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setOrders(await getSupplyOrdersInRange(storeId, from, to)); } finally { setLoading(false); }
  };

  const doExport = async () => {
    setExporting(true);
    try {
      const data = orders ?? await getSupplyOrdersInRange(storeId, from, to);
      if (data.length === 0) { alert('Không có phiếu nào trong khoảng ngày này'); return; }
      await exportSupplyOrders(data, from, to, storeName);
    } finally { setExporting(false); }
  };

  return (
    <>
      <div style={{ ...box, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        Từ <input type="date" className="input" style={{ width: 170 }} value={from} onChange={e => { setFrom(e.target.value); setOrders(null); }} />
        đến <input type="date" className="input" style={{ width: 170 }} value={to} onChange={e => { setTo(e.target.value); setOrders(null); }} />
        <button className="btn btn-secondary" disabled={loading || !from || !to || from > to} onClick={load}>{loading ? 'Đang tải…' : 'Xem'}</button>
        <button className="btn btn-primary" disabled={exporting || !from || !to || from > to} onClick={doExport}>{exporting ? 'Đang xuất…' : 'Xuất Excel'}</button>
      </div>
      {orders?.length === 0 && <div style={box}>Không có phiếu nào.</div>}
      {orders?.map(o => {
        const done = o.lines.filter(l => l.prepared).length;
        return (
          <div key={o.date} style={box}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {supplyDisplay(o.date)} · {o.lines.length} món · Đã soạn {done}/{o.lines.length}
            </div>
            <table className="table">
              <tbody>
                {o.lines.map(l => (
                  <tr key={l.itemId}>
                    <td>{l.code && <span style={codeTag}>{l.code}</span>}{l.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatQty(l.qty)} {l.unit}</td>
                    <td style={{ color: '#888', fontSize: 13 }}>{contributorNames(l).join(', ')}</td>
                    <td>{l.prepared ? `✓ ${l.preparedByName || l.preparedBy}` : <span style={{ color: 'var(--danger)' }}>Chưa soạn</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

// ==================== DANH MỤC ====================

const emptyItem = { id: '', code: '', name: '', unit: '', group: '', order: 0, active: true };

function ItemsTab({ storeId, items }: { storeId: string; items: SupplyItem[] }) {
  const [form, setForm] = useState<SupplyItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const groups = [...new Set(items.map(i => i.group).filter(Boolean))];

  const save = async () => {
    if (!form || !form.name.trim() || !form.unit.trim()) return;
    const err = validateSupplyCode(form.code, items, form.id || undefined);
    setCodeError(err);
    if (err) return;
    setSaving(true);
    try {
      await saveSupplyItem(storeId, { ...form, id: form.id || undefined });
      setForm(null);
    } catch (e) { alertError(e); } finally { setSaving(false); }
  };

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <b>Danh mục hàng ({items.filter(i => i.active).length} đang dùng)</b>
        <button className="btn btn-sm btn-primary" onClick={() => setForm({ ...emptyItem, order: items.length })}>+ Thêm mặt hàng</button>
      </div>

      {form && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: 12, background: '#fafafa', borderRadius: 8, marginBottom: 12 }}>
          <input className="input" style={{ width: 110, textTransform: 'uppercase' }} placeholder="Mã (BB001)" title="Mã hàng, không bắt buộc" value={form.code}
            onChange={e => { setForm({ ...form, code: e.target.value }); setCodeError(null); }} />
          <input className="input" style={{ flex: 2, minWidth: 160 }} placeholder="Tên món *" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input" style={{ width: 100 }} placeholder="Đơn vị * (kg, gói…)" value={form.unit}
            onChange={e => setForm({ ...form, unit: e.target.value })} />
          <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Nhóm (Bao bì…)" list="supply-groups" value={form.group}
            onChange={e => setForm({ ...form, group: e.target.value })} />
          <datalist id="supply-groups">{groups.map(g => <option key={g} value={g} />)}</datalist>
          <input className="input" style={{ width: 80 }} type="number" title="Thứ tự" value={form.order}
            onChange={e => setForm({ ...form, order: Number(e.target.value) || 0 })} />
          <button className="btn btn-sm btn-primary" disabled={saving || !form.name.trim() || !form.unit.trim()} onClick={save}>Lưu</button>
          <button className="btn btn-sm btn-ghost" onClick={() => { setForm(null); setCodeError(null); }}>Huỷ</button>
          {codeError && <div style={{ width: '100%', color: 'var(--danger)', fontSize: 13 }}>{codeError}</div>}
        </div>
      )}

      {items.length === 0 && <p style={{ color: '#888' }}>Chưa có mặt hàng nào.</p>}
      {groupBy(items, i => i.group).map(([g, list]) => (
        <div key={g}>
          <div style={groupTitle}>{g}</div>
          {list.map(i => (
            <div key={i.id} style={{ ...row, opacity: i.active ? 1 : 0.5 }}>
              <div style={{ flex: 1 }}>{i.code && <span style={codeTag}>{i.code}</span>}<b>{i.name}</b> <span style={{ color: '#888' }}>· {i.unit}</span>{!i.active && ' (đã ẩn)'}</div>
              <button className="btn btn-sm btn-ghost" onClick={() => setForm(i)}>Sửa</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setSupplyItemActive(storeId, i.id, !i.active).catch(alertError)}>
                {i.active ? 'Ẩn' : 'Hiện lại'}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ==================== CÀI ĐẶT ====================

function SettingsTab({ storeId, settings, departments }: {
  storeId: string; settings: SupplySettings; departments: { id: string; name: string }[];
}) {
  const [cutoffOn, setCutoffOn] = useState(settings.cutoffTime !== null);
  const [cutoff, setCutoff] = useState(settings.cutoffTime ?? '21:00');
  const [deps, setDeps] = useState<string[]>(settings.preparerDepartmentIds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveSupplySettings(storeId, { cutoffTime: cutoffOn ? cutoff : null, preparerDepartmentIds: deps });
      setSaved(true);
    } catch (e) { alertError(e); } finally { setSaving(false); }
  };

  return (
    <div style={box}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Giờ chốt đặt hàng</div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input type="checkbox" checked={cutoffOn} onChange={e => setCutoffOn(e.target.checked)} />
        Khoá đặt hàng sau giờ chốt (ngày hôm trước)
      </label>
      {cutoffOn && (
        <input type="time" className="input" style={{ width: 140, marginBottom: 8 }} value={cutoff}
          onChange={e => setCutoff(e.target.value)} />
      )}
      <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
        Sau giờ chốt nhân viên không thêm/sửa được; chủ và quản lý vẫn sửa được. App nhắc trước giờ chốt 30 phút nếu phiếu ngày mai còn trống.
      </div>

      <div style={{ fontWeight: 700, marginBottom: 8 }}>Bộ phận soạn hàng (theo lịch làm)</div>
      {departments.length === 0 && <p style={{ color: '#888' }}>Cửa hàng chưa có bộ phận nào.</p>}
      {departments.map(d => (
        <label key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
          <input type="checkbox" checked={deps.includes(d.id)}
            onChange={e => setDeps(e.target.checked ? [...deps, d.id] : deps.filter(x => x !== d.id))} />
          {d.name}
        </label>
      ))}
      <div style={{ fontSize: 13, color: '#888', margin: '4px 0 16px' }}>Không chọn bộ phận nào = ai vào ca cũng tích &quot;Đã soạn&quot; được.</div>

      <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu cài đặt'}</button>
      {saved && <span style={{ marginLeft: 12, color: 'var(--primary)', fontSize: 13 }}>Đã lưu</span>}
    </div>
  );
}
