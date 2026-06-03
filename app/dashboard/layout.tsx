'use client';
import { useEffect, useState, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { onAuthChanged, signOut, getUserCurrentStoreId } from '@/lib/auth';
import { watchStore, watchMembers, getUserStores, switchStore } from '@/lib/firestore';
import { Store, Member } from '@/lib/types';
import { User } from 'firebase/auth';

interface AppCtx {
  user: User | null;
  storeId: string | null;
  store: Store | null;
  members: Member[];
}
const AppContext = createContext<AppCtx>({ user: null, storeId: null, store: null, members: [] });
export const useApp = () => useContext(AppContext);

const NAV = [
  { href: '/dashboard', icon: '📊', label: 'Tổng quan' },
  { href: '/dashboard/attendance', icon: '📅', label: 'Bảng công' },
  { href: '/dashboard/salary', icon: '💰', label: 'Báo cáo lương' },
  { href: '/dashboard/members', icon: '👥', label: 'Nhân viên' },
  { href: '/dashboard/schedule', icon: '🗓️', label: 'Lịch làm' },
  { href: '/dashboard/settings', icon: '⚙️', label: 'Cài đặt' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [userStores, setUserStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showStoreSwitcher, setShowStoreSwitcher] = useState(false);

  useEffect(() => {
    const unsub = onAuthChanged(async (u) => {
      if (!u) { router.replace('/login'); return; }
      setUser(u);
      const sid = await getUserCurrentStoreId(u.uid);
      setStoreId(sid);
      const stores = await getUserStores(u.uid);
      setUserStores(stores);
      setLoading(false);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!storeId) return;
    const unsubStore = watchStore(storeId, s => setStore(s));
    const unsubMembers = watchMembers(storeId, m => setMembers(m));
    return () => { unsubStore(); unsubMembers(); };
  }, [storeId]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--surface)' }}>
      <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <div style={{ width:48, height:48, border:'3px solid var(--primary-light)', borderTopColor:'var(--primary)', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} />
        <p style={{ color:'var(--text-secondary)', fontSize:14 }}>Đang tải dữ liệu...</p>
      </div>
    </div>
  );

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0] ?? 'U').toUpperCase();

  const currentMember = user ? members.find(m => m.userId === user.uid) : null;
  const role = currentMember?.role;

  // Nếu đã load xong thông tin store mà member là nhân viên thì chặn
  if (storeId && members.length > 0 && role === 'employee') {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--surface)' }}>
        <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:16, background:'white', padding:40, borderRadius:20, boxShadow:'0 10px 40px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize:48 }}>📱</div>
          <h2 style={{ margin:0, color:'var(--danger)' }}>Truy cập bị từ chối</h2>
          <p style={{ margin:0, color:'var(--text-secondary)', maxWidth:300, lineHeight:1.5 }}>
            Tài khoản nhân viên không được phép sử dụng trang quản lý Web. Vui lòng tải ứng dụng Mobile để chấm công và xem lịch làm.
          </p>
          <button onClick={signOut} className="btn btn-primary" style={{ marginTop:16 }}>
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  // Quản lý chỉ được xem lịch làm
  useEffect(() => {
    if (role === 'manager') {
      if (pathname !== '/dashboard/schedule') {
        router.replace('/dashboard/schedule');
      }
    }
  }, [role, pathname, router]);

  const filteredNav = NAV.filter(item => {
    if (role === 'manager') {
      return item.href === '/dashboard/schedule';
    }
    return true;
  });

  return (
    <AppContext.Provider value={{ user, storeId, store, members }}>
      <div style={{ display:'flex', minHeight:'100vh' }}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:40, display:'block'
          }} className="lg-hidden" />
        )}

        {/* Sidebar */}
        <aside style={{
          width: 'var(--sidebar-width)',
          background: 'var(--neutral)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: sidebarOpen ? 0 : '-240px',
          height: '100vh',
          zIndex: 50,
          transition: 'left 0.25s ease',
          boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
        }}>
          {/* Logo */}
          <div style={{ padding:'24px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <img src="/logo.jpg" alt="Logo" style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }} />
              <div>
                <div style={{ fontWeight:800, fontSize:14, lineHeight:1.2 }}>Chấm Công Trạm</div>
                <div style={{ fontSize:11, opacity:0.6, marginTop:2 }}>Cổng quản lý</div>
              </div>
            </div>
          </div>

          {/* Store info */}
          {store && (
            <div 
              style={{ padding:'12px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.04)', cursor:'pointer' }}
              onClick={() => setShowStoreSwitcher(true)}
            >
              <div style={{ fontSize:11, opacity:0.5, marginBottom:2 }}>Cửa hàng (Nhấn để đổi) ▾</div>
              <div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{store.name}</div>
              <div style={{ fontSize:11, opacity:0.5, marginTop:2 }}>Mã: <strong style={{ opacity:1, letterSpacing:1 }}>{store.code}</strong></div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex:1, padding:'12px 10px', display:'flex', flexDirection:'column', gap:2, overflowY:'auto' }}>
            {filteredNav.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} style={{
                  display:'flex', alignItems:'center', gap:10,
                  padding:'10px 12px',
                  borderRadius:10,
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? 'white' : 'rgba(255,255,255,0.65)',
                  fontWeight: active ? 700 : 500,
                  fontSize:14,
                  transition:'all 0.15s',
                  textDecoration:'none',
                }}>
                  <span style={{ fontSize:16 }}>{item.icon}</span>
                  {item.label}
                  {active && <div style={{ marginLeft:'auto', width:6, height:6, borderRadius:'50%', background:'rgba(255,255,255,0.8)' }} />}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div className="avatar" style={{ width:36, height:36, fontSize:13 }}>{initials}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {user?.displayName || user?.email}
                </div>
                <div style={{ fontSize:11, opacity:0.5 }}>
                  {role === 'owner' ? 'Chủ cửa hàng' : role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                </div>
              </div>
              <button onClick={signOut} title="Đăng xuất" style={{
                background:'rgba(255,255,255,0.1)', border:'none', color:'rgba(255,255,255,0.7)',
                width:30, height:30, borderRadius:8, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center'
              }}>↩</button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div style={{ flex:1, marginLeft:0, display:'flex', flexDirection:'column', minWidth:0 }}>
          {/* Top bar */}
          <header style={{
            background:'white',
            borderBottom:'1px solid var(--divider)',
            padding:'0 24px',
            height:60,
            display:'flex',
            alignItems:'center',
            gap:16,
            position:'sticky', top:0, zIndex:30,
          }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background:'var(--surface)', border:'none', width:38, height:38, borderRadius:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}
            >☰</button>
            <div style={{ flex:1 }}>
              <span style={{ fontSize:13, color:'var(--text-secondary)' }}>
                {filteredNav.find(n => pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href)))?.label ?? 'Dashboard'}
              </span>
            </div>
            <div style={{ fontSize:13, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--success)', display:'inline-block' }} />
              {members.filter(m => m.status === 'active').length} nhân viên
            </div>
          </header>

          {/* Content */}
          <main style={{ flex:1, padding:24, overflow:'auto' }}>
            {storeId ? children : (
              <div className="empty-state">
                <div className="empty-state-icon">🏪</div>
                <div className="empty-state-text">Bạn chưa tham gia cửa hàng nào</div>
                <div className="empty-state-sub">Vui lòng mở app điện thoại để tạo hoặc tham gia cửa hàng</div>
              </div>
            )}
          </main>
        </div>

        {/* Store Switcher Modal */}
        {showStoreSwitcher && (
          <div className="modal-overlay" onClick={() => setShowStoreSwitcher(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Chuyển cửa hàng</div>
                <button className="modal-close" onClick={() => setShowStoreSwitcher(false)}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
                {userStores.map(s => (
                  <button 
                    key={s.id}
                    onClick={async () => {
                      if (user) {
                        await switchStore(user.uid, s.id);
                        setStoreId(s.id);
                        setShowStoreSwitcher(false);
                      }
                    }}
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      border: s.id === storeId ? '2px solid var(--primary)' : '1px solid var(--border)',
                      background: s.id === storeId ? 'var(--primary-light)' : 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--neutral)' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mã: {s.code}</div>
                  </button>
                ))}
                {userStores.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Bạn chưa tham gia cửa hàng nào
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
