'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signInWithGoogle, signInWithApple } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');

  const isAnyLoading = loading || googleLoading || appleLoading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.');
      } else {
        setError(err.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/dashboard');
    } catch (err: any) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        // Người dùng đã đóng popup
      } else {
        setError('Đăng nhập Google thất bại: ' + (err.message || 'Vui lòng thử lại.'));
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setError('');
    setAppleLoading(true);
    try {
      await signInWithApple();
      router.replace('/dashboard');
    } catch (err: any) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        // Người dùng đã đóng popup
      } else {
        setError('Đăng nhập Apple thất bại: ' + (err.message || 'Vui lòng thử lại.'));
      }
    } finally {
      setAppleLoading(false);
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
                disabled={isAnyLoading}
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
                disabled={isAnyLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isAnyLoading}
              className="btn btn-primary"
              style={{ justifyContent:'center', padding:'13px 20px', marginTop:4, fontSize:15 }}
            >
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '22px 0 18px',
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
            <span style={{ padding: '0 12px', fontWeight: 500 }}>Hoặc tiếp tục với</span>
            <div style={{ flex: 1, height: 1, background: 'var(--divider)' }} />
          </div>

          {/* Social login buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Google Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAnyLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 14px',
                borderRadius: 12,
                border: '1.5px solid var(--border)',
                background: 'white',
                color: '#333333',
                fontSize: 14,
                fontWeight: 600,
                cursor: isAnyLoading ? 'not-allowed' : 'pointer',
                opacity: isAnyLoading ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!isAnyLoading) {
                  e.currentTarget.style.borderColor = '#bbb';
                  e.currentTarget.style.background = '#f9f9f9';
                }
              }}
              onMouseLeave={e => {
                if (!isAnyLoading) {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              {googleLoading ? (
                <div style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(0,0,0,0.1)',
                  borderTopColor: '#4285F4',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              )}
              <span>Google</span>
            </button>

            {/* Apple Button */}
            <button
              type="button"
              onClick={handleAppleSignIn}
              disabled={isAnyLoading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 14px',
                borderRadius: 12,
                border: '1.5px solid #000000',
                background: '#000000',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 600,
                cursor: isAnyLoading ? 'not-allowed' : 'pointer',
                opacity: isAnyLoading ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                if (!isAnyLoading) e.currentTarget.style.background = '#222222';
              }}
              onMouseLeave={e => {
                if (!isAnyLoading) e.currentTarget.style.background = '#000000';
              }}
            >
              {appleLoading ? (
                <div style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 170 170" fill="currentColor">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.59-7.71-11.66-14.01-6.19-9.56-11.02-20.46-14.49-32.68-3.47-12.23-5.21-23.75-5.21-34.57 0-14.35 3.7-26.04 11.09-35.08 7.39-9.04 16.65-13.68 27.78-13.92 5.01 0 10.33 1.27 15.96 3.81 5.63 2.54 9.17 3.86 10.63 3.96 1.7 0 5.48-1.42 11.35-4.27 5.86-2.85 11.08-4.18 15.65-3.99 12.08.74 21.72 5.37 28.91 13.89-10.55 6.34-15.71 15.22-15.48 26.63.22 8.91 3.59 16.32 10.11 22.23 6.52 5.91 14.35 9.3 23.49 10.18-2.28 6.74-4.89 13.37-7.83 19.92zm-35.6-107.03c0-6.73 2.45-12.92 7.34-18.57 4.9-5.65 10.97-9.35 18.23-11.11.87 6.95-.98 13.36-5.55 19.23-4.57 5.87-10.76 9.35-18.58 10.45h-1.44z"/>
                </svg>
              )}
              <span>Apple</span>
            </button>
          </div>

          <p style={{ textAlign:'center', marginTop:24, fontSize:13, color:'var(--text-secondary)' }}>
            Chỉ dành cho <strong style={{ color:'var(--primary)' }}>chủ cửa hàng</strong> và <strong style={{ color:'var(--info)' }}>quản lý</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
