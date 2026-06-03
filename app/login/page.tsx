'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch {
      setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #CB2D2E 0%, #A82425 50%, #1A1A1A 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Decorative circles */}
      <div style={{ position:'fixed', top:-100, right:-100, width:400, height:400, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:-150, left:-100, width:500, height:500, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:420, zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32, color:'white' }}>
          <img 
            src="/logo.jpg" 
            alt="Logo" 
            style={{
              width:72, height:72,
              borderRadius:20,
              objectFit:'cover',
              margin:'0 auto 16px',
              border:'2px solid rgba(255,255,255,0.2)',
              boxShadow:'0 8px 32px rgba(0,0,0,0.15)'
            }} 
          />
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:'-0.5px' }}>Chấm Công Trạm</h1>
          <p style={{ opacity:0.7, marginTop:6, fontSize:14 }}>Cổng quản lý dành cho chủ cửa hàng</p>
        </div>

        {/* Card */}
        <div style={{
          background:'white',
          borderRadius:24,
          padding:32,
          boxShadow:'0 24px 80px rgba(0,0,0,0.25)',
        }}>
          <h2 style={{ fontSize:20, fontWeight:700, marginBottom:24, color:'var(--neutral)' }}>Đăng nhập</h2>

          {error && (
            <div style={{
              background:'var(--primary-light)',
              color:'var(--primary)',
              padding:'12px 16px',
              borderRadius:10,
              fontSize:13,
              marginBottom:16,
              borderLeft:'3px solid var(--primary)',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="example@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Mật khẩu</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ justifyContent:'center', padding:'13px 20px', marginTop:4, fontSize:15 }}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'var(--text-secondary)' }}>
            Chỉ dành cho <strong style={{ color:'var(--primary)' }}>chủ cửa hàng</strong> và <strong style={{ color:'var(--info)' }}>quản lý</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
