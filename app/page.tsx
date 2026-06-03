'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChanged } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const unsub = onAuthChanged(user => {
      router.replace(user ? '/dashboard' : '/login');
    });
    return unsub;
  }, [router]);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--primary)' }}>
      <div style={{ textAlign:'center', color:'white' }}>
        <div style={{ fontSize:36, fontWeight:800, marginBottom:8 }}>Chấm Công Trạm</div>
        <div style={{ opacity:0.7 }}>Đang tải...</div>
      </div>
    </div>
  );
}
