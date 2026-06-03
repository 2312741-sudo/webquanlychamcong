'use client';
import { useEffect, useState } from 'react';
import { useApp } from './layout';
import { watchTodayAttendances, getMonthAttendances } from '@/lib/firestore';
import { AttendanceRecord, Member } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
      <div style={{
        width:48, height:48, borderRadius:14,
        background: color ? `${color}18` : 'var(--primary-light)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0
      }}>{icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, color:'var(--text-secondary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:26, fontWeight:800, color:'var(--neutral)', lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4 }}>{sub}</div>}
      </div>
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = {
  gps: '📍 GPS', wifi: '📶 WiFi', qr: '📷 QR', manual: '✏️ Thủ công'
};

export default function DashboardPage() {
  const { storeId, members } = useApp();
  const [todayAtts, setTodayAtts] = useState<AttendanceRecord[]>([]);
  const [chartData, setChartData] = useState<{ date: string; hours: number }[]>([]);
  const [totalMonthHours, setTotalMonthHours] = useState(0);

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending');
  const inProgressToday = todayAtts.filter(a => !a.checkOut);
  const doneToday = todayAtts.filter(a => a.checkOut);

  useEffect(() => {
    if (!storeId) return;
    const unsub = watchTodayAttendances(storeId, setTodayAtts);
    return unsub;
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    getMonthAttendances(storeId, month).then(atts => {
      const total = atts.reduce((sum, a) => sum + (a.totalHours || 0), 0);
      setTotalMonthHours(total);
      // Build last 14 days chart
      const dayMap: Record<string, number> = {};
      atts.forEach(a => { dayMap[a.date] = (dayMap[a.date] || 0) + (a.totalHours || 0); });
      const days: { date: string; hours: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        days.push({ date: `${d.getDate()}/${d.getMonth()+1}`, hours: parseFloat((dayMap[key] || 0).toFixed(1)) });
      }
      setChartData(days);
    });
  }, [storeId]);

  const getMemberName = (userId: string) => members.find(m => m.userId === userId)?.name || userId;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:800, color:'var(--neutral)' }}>Tổng quan</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:13, marginTop:4 }}>
          {new Date().toLocaleDateString('vi-VN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
        </p>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16 }}>
        <StatCard icon="👥" label="Nhân viên hoạt động" value={activeMembers.length} sub={`${pendingMembers.length} chờ duyệt`} color="#1A6B5A" />
        <StatCard icon="✅" label="Đang làm hôm nay" value={inProgressToday.length} sub={`${doneToday.length} đã ra ca`} color="#1565C0" />
        <StatCard icon="⏱️" label="Tổng giờ tháng này" value={`${totalMonthHours.toFixed(1)}h`} sub="Toàn bộ nhân viên" color="#CB2D2E" />
        <StatCard icon="📋" label="Số ca hôm nay" value={todayAtts.length} sub="Tổng lượt chấm công" color="#EB9B28" />
      </div>

      {/* Chart + Today */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        {/* Chart */}
        <div className="card">
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Tổng giờ công 14 ngày gần nhất</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top:4, right:8, bottom:4, left:-20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'var(--text-secondary)' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize:10, fill:'var(--text-secondary)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius:10, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)', fontSize:13 }}
                formatter={(v: number) => [`${v}h`, 'Tổng giờ']}
              />
              <Line type="monotone" dataKey="hours" stroke="var(--primary)" strokeWidth={2.5} dot={{ r:3, fill:'var(--primary)' }} activeDot={{ r:5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Today's attendance */}
        <div className="card" style={{ overflow:'hidden' }}>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>Đang làm việc hôm nay</h3>
          {inProgressToday.length === 0 ? (
            <div className="empty-state" style={{ padding:'24px 0' }}>
              <div className="empty-state-icon" style={{ fontSize:32 }}>😴</div>
              <div className="empty-state-sub">Không có ai đang làm</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {inProgressToday.slice(0, 6).map(att => {
                const checkInTime = att.checkIn?.toDate ? att.checkIn.toDate() : new Date(att.checkIn?.seconds * 1000);
                return (
                  <div key={att.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div className="avatar" style={{ width:34, height:34, fontSize:12, flexShrink:0 }}>
                      {getMemberName(att.userId).split(' ').pop()?.[0] ?? '?'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{getMemberName(att.userId)}</div>
                      <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
                        Vào: {checkInTime.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })} &nbsp;·&nbsp;
                        <span style={{ color:'var(--success)' }}>{METHOD_LABEL[att.checkInMethod] || att.checkInMethod}</span>
                      </div>
                    </div>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--success)', flexShrink:0 }} />
                  </div>
                );
              })}
              {inProgressToday.length > 6 && (
                <div style={{ textAlign:'center', fontSize:12, color:'var(--text-secondary)' }}>+{inProgressToday.length - 6} người khác</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pending members */}
      {pendingMembers.length > 0 && (
        <div className="card" style={{ borderLeft:'4px solid var(--accent)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:18 }}>⏳</span>
            <h3 style={{ fontSize:15, fontWeight:700 }}>Nhân viên chờ duyệt ({pendingMembers.length})</h3>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
            {pendingMembers.map(m => (
              <a key={m.userId} href="/dashboard/members" style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', background:'var(--accent-light)', borderRadius:100, textDecoration:'none' }}>
                <div className="avatar" style={{ width:24, height:24, fontSize:10 }}>{m.name[0]}</div>
                <span style={{ fontSize:13, color:'var(--accent)', fontWeight:600 }}>{m.name}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
