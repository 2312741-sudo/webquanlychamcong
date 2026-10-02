'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import {
  watchUserActiveAttendance,
  watchUserTodayAttendances,
  getMemberMonthAttendances,
  webCheckIn,
  webCheckOut
} from '@/lib/firestore';
import { AttendanceRecord, CheckInMethod, getRoleLabel } from '@/lib/types';

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CheckInPage() {
  const { storeId, store, user, currentMember, role } = useApp();
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [activeAttendance, setActiveAttendance] = useState<AttendanceRecord | null>(null);
  const [todayAttendances, setTodayAttendances] = useState<AttendanceRecord[]>([]);
  const [monthAttendances, setMonthAttendances] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [method, setMethod] = useState<CheckInMethod>('wifi');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // GPS state
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsDistanceText, setGpsDistanceText] = useState<string | null>(null);

  // Checkout confirmation modal
  const [showCheckOutConfirm, setShowCheckOutConfirm] = useState(false);

  // Live timer update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today string YYYY-MM-DD
  const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

  // Watch active attendance for current user
  useEffect(() => {
    if (!storeId || !user) return;
    const unsub = watchUserActiveAttendance(storeId, user.uid, (att) => {
      setActiveAttendance(att);
    });
    return () => unsub();
  }, [storeId, user]);

  // Watch today's attendance sessions
  useEffect(() => {
    if (!storeId || !user) return;
    const unsub = watchUserTodayAttendances(storeId, user.uid, todayStr, (records) => {
      setTodayAttendances(records);
    });
    return () => unsub();
  }, [storeId, user, todayStr]);

  // Load monthly attendances for history
  useEffect(() => {
    if (!storeId || !user || !selectedMonth) return;
    getMemberMonthAttendances(storeId, user.uid, selectedMonth).then((records) => {
      records.sort((a, b) => b.date.localeCompare(a.date));
      setMonthAttendances(records);
    }).catch(err => {
      console.error('Lỗi khi tải bảng công tháng:', err);
    });
  }, [storeId, user, selectedMonth, activeAttendance]);

  // Check GPS location when GPS method is chosen
  useEffect(() => {
    if (method !== 'gps') return;
    if (!navigator.geolocation) {
      setGpsError('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    setGpsDistanceText(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsCoords({ lat: latitude, lng: longitude, accuracy });

        // Calculate distance if store has locations
        if (store?.locations && store.locations.length > 0) {
          let minDistance = Infinity;
          let matchedLoc = null;
          for (const loc of store.locations) {
            const dist = getDistanceMeters(latitude, longitude, loc.latitude, loc.longitude);
            if (dist < minDistance) {
              minDistance = dist;
              matchedLoc = loc;
            }
          }
          if (matchedLoc) {
            const distRound = Math.round(minDistance);
            const inRange = minDistance <= matchedLoc.radiusMeters;
            setGpsDistanceText(`Cách "${matchedLoc.name}" khoảng ${distRound}m (Bán kính: ${matchedLoc.radiusMeters}m) - ${inRange ? '✅ Hợp lệ' : '⚠️ Ngoài phạm vi'}`);
          }
        } else if (store?.latitude && store?.longitude) {
          const dist = Math.round(getDistanceMeters(latitude, longitude, store.latitude, store.longitude));
          const inRange = dist <= (store.radiusMeters || 100);
          setGpsDistanceText(`Cách cửa hàng khoảng ${dist}m (Bán kính: ${store.radiusMeters || 100}m) - ${inRange ? '✅ Hợp lệ' : '⚠️ Ngoài phạm vi'}`);
        } else {
          setGpsDistanceText(`Đã nhận toạ độ GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setGpsError('Bạn đã từ chối quyền truy cập vị trí. Vui lòng cho phép quyền định vị trong trình duyệt.');
        } else {
          setGpsError(`Không thể lấy toạ độ: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [method, store]);

  // Elapsed time for active shift
  const getElapsedDuration = (checkIn: any) => {
    if (!checkIn) return '00:00:00';
    try {
      const start = checkIn.toDate ? checkIn.toDate() : new Date(checkIn.seconds * 1000);
      const diffMs = Math.max(0, currentTime.getTime() - start.getTime());
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } catch {
      return '00:00:00';
    }
  };

  const handleCheckIn = async () => {
    if (!storeId || !user) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // Optional GPS distance check warning
    if (method === 'gps') {
      if (store?.locations && store.locations.length > 0 && gpsCoords) {
        let minDistance = Infinity;
        let matchedLoc = null;
        for (const loc of store.locations) {
          const dist = getDistanceMeters(gpsCoords.lat, gpsCoords.lng, loc.latitude, loc.longitude);
          if (dist < minDistance) {
            minDistance = dist;
            matchedLoc = loc;
          }
        }
        if (matchedLoc && minDistance > matchedLoc.radiusMeters) {
          const conf = confirm(`Bạn đang ở cách vị trí cửa hàng ${Math.round(minDistance)}m (ngoài bán kính ${matchedLoc.radiusMeters}m). Bạn có chắc chắn muốn tiếp tục vào ca?`);
          if (!conf) return;
        }
      }
    }

    setLoading(true);
    try {
      const memberName = currentMember?.name || user.displayName || user.email?.split('@')[0] || 'Nhân viên';
      await webCheckIn(storeId, user.uid, method, store?.name, memberName);
      setSuccessMsg('🎉 Chúc bạn một ca làm việc tràn đầy năng lượng! Đã chấm vào ca thành công.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Chấm vào thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!storeId || !user || !activeAttendance) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    setShowCheckOutConfirm(false);

    try {
      const memberName = currentMember?.name || user.displayName || user.email?.split('@')[0] || 'Nhân viên';
      const hours = await webCheckOut(storeId, activeAttendance.id, user.uid, store?.name, memberName);
      setSuccessMsg(`👏 Đã ra ca thành công! Tổng giờ làm của ca này: ${hours.toFixed(2)} giờ.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Chấm ra thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '--:--';
    try {
      const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const getMethodLabel = (m: string) => {
    switch (m) {
      case 'wifi': return '📶 WiFi / Web';
      case 'gps': return '📍 GPS Vị trí';
      case 'qr': return '📷 Mã QR';
      case 'manual': return '✏️ Thủ công';
      default: return m;
    }
  };

  // Monthly stats
  const totalMonthHours = monthAttendances.reduce((acc, a) => acc + (a.totalHours || 0), 0);
  const totalCompletedShifts = monthAttendances.filter(a => a.checkOut).length;

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #114b3e 100%)',
        color: 'white',
        padding: '24px 28px',
        borderRadius: 20,
        boxShadow: '0 10px 30px rgba(26, 107, 90, 0.2)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9, fontSize: 13, marginBottom: 4 }}>
            <span>🏪 {store?.name || 'Cửa hàng'}</span>
            <span>·</span>
            <span>Mã: <strong>{store?.code}</strong></span>
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Chấm Công Trực Tuyến</h1>
          <p style={{ margin: '6px 0 0 0', opacity: 0.85, fontSize: 13 }}>
            Chấm vào ca và kết thúc ca làm việc trực tiếp trên trình duyệt Web
          </p>
        </div>

        {/* Live digital clock */}
        <div style={{
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '12px 20px',
          borderRadius: 16,
          textAlign: 'right'
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1.5, fontFamily: 'monospace' }}>
            {currentTime.toLocaleTimeString('vi-VN')}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2, textTransform: 'capitalize' }}>
            {currentTime.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMsg && (
        <div style={{
          background: '#ffebee',
          color: '#c62828',
          padding: '14px 18px',
          borderRadius: 12,
          border: '1px solid #ffcdd2',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: '#e8f5e9',
          color: '#2e7d32',
          padding: '14px 18px',
          borderRadius: 12,
          border: '1px solid #c8e6c9',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Check-In / Check-Out Action Card */}
      <div className="card" style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
        {/* User bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {currentMember?.avatarUrl || user?.photoURL ? (
              <img
                src={currentMember?.avatarUrl || user?.photoURL || ''}
                alt="Avatar"
                style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div className="avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                {(currentMember?.name || user?.displayName || user?.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--neutral)' }}>
                {currentMember?.name || user?.displayName || user?.email}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Chức vụ: <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{getRoleLabel(role)}</span>
              </div>
            </div>
          </div>

          <div>
            {activeAttendance ? (
              <span style={{
                background: '#e8f5e9',
                color: '#2e7d32',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2e7d32', animation: 'pulse 1.5s infinite' }} />
                Đang trong ca làm việc
              </span>
            ) : (
              <span style={{
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600
              }}>
                Chưa vào ca
              </span>
            )}
          </div>
        </div>

        {/* Content based on status */}
        {activeAttendance ? (
          /* ACTIVE SHIFT: Show running timer and Check-Out button */
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Thời gian đã làm việc trong ca:
            </div>
            <div style={{
              fontSize: 48,
              fontWeight: 800,
              fontFamily: 'monospace',
              color: 'var(--primary)',
              letterSpacing: 2,
              marginBottom: 12
            }}>
              {getElapsedDuration(activeAttendance.checkIn)}
            </div>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 16,
              background: 'var(--surface)',
              padding: '10px 20px',
              borderRadius: 12,
              fontSize: 13,
              color: 'var(--neutral)',
              marginBottom: 28
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Giờ vào ca: </span>
                <strong>{formatTime(activeAttendance.checkIn)}</strong>
              </div>
              <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Phương thức: </span>
                <strong>{getMethodLabel(activeAttendance.checkInMethod)}</strong>
              </div>
            </div>

            <div>
              <button
                onClick={() => setShowCheckOutConfirm(true)}
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '16px 48px',
                  borderRadius: 16,
                  fontSize: 18,
                  fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 24px rgba(211, 47, 47, 0.35)',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10
                }}
              >
                {loading ? <span className="spinner spinner-white" /> : '🛑 RA CA (KẾT THÚC CA)'}
              </button>
            </div>
          </div>
        ) : (
          /* NOT CHECKED IN: Method selection & Check-In button */
          <div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--neutral)', marginBottom: 10 }}>
                Chọn phương thức chấm công:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setMethod('wifi')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: method === 'wifi' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: method === 'wifi' ? 'var(--primary-light)' : 'white',
                    color: method === 'wifi' ? 'var(--primary)' : 'var(--neutral)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: 24 }}>📶</span>
                  <span>WiFi / Web</span>
                  <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>Chấm trực tuyến tiện lợi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('gps')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: method === 'gps' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: method === 'gps' ? 'var(--primary-light)' : 'white',
                    color: method === 'gps' ? 'var(--primary)' : 'var(--neutral)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: 24 }}>📍</span>
                  <span>Định vị GPS</span>
                  <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>Xác thực vị trí làm việc</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('manual')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: method === 'manual' ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: method === 'manual' ? 'var(--primary-light)' : 'white',
                    color: method === 'manual' ? 'var(--primary)' : 'var(--neutral)',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s'
                  }}
                >
                  <span style={{ fontSize: 24 }}>✏️</span>
                  <span>Thủ công</span>
                  <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.7 }}>Ghi nhận ca nhanh</span>
                </button>
              </div>

              {/* GPS status feedback */}
              {method === 'gps' && (
                <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: 'var(--surface)', fontSize: 13, border: '1px solid var(--border)' }}>
                  {gpsLoading && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span>🔄</span> Đang tìm kiếm toạ độ vị trí hiện tại của bạn...</div>}
                  {gpsError && <div style={{ color: 'var(--danger)' }}>❌ {gpsError}</div>}
                  {gpsDistanceText && !gpsLoading && <div>{gpsDistanceText}</div>}
                </div>
              )}
            </div>

            {/* Check-In Button */}
            <div style={{ textAlign: 'center', marginTop: 32 }}>
              <button
                onClick={handleCheckIn}
                disabled={loading || (method === 'gps' && gpsLoading)}
                style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, #15803d 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '18px 56px',
                  borderRadius: 18,
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 10px 30px rgba(26, 107, 90, 0.35)',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                {loading ? <span className="spinner spinner-white" /> : '🟢 VÀO CA NGAY'}
              </button>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
                Hệ thống sẽ lưu lại thời gian và thông báo tới quản lý cửa hàng
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Today's Completed Sessions */}
      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📋</span> Các ca làm việc hôm nay ({todayAttendances.length})
        </h3>

        {todayAttendances.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Hôm nay bạn chưa có lượt chấm công nào.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {todayAttendances.map((att, idx) => {
              const isActive = !att.checkOut;
              return (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: isActive ? 'var(--primary-light)' : 'var(--surface)',
                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: isActive ? 'var(--primary)' : '#e0e0e0',
                      color: isActive ? 'white' : 'var(--text-secondary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 12
                    }}>
                      #{idx + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Vào: <strong>{formatTime(att.checkIn)}</strong> → Ra: <strong>{att.checkOut ? formatTime(att.checkOut) : 'Đang làm việc...'}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Phương thức: {getMethodLabel(att.checkInMethod)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {isActive ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 14 }}>
                        Đang làm...
                      </span>
                    ) : (
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--neutral)' }}>
                        {(att.totalHours || 0).toFixed(2)}h
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Monthly Attendance Summary & History */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📅</span> Lịch sử công tháng
          </h3>
          <input
            type="month"
            className="input"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: 160 }}
          />
        </div>

        {/* Stats tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'var(--primary-light)', padding: 16, borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>TỔNG GIỜ LÀM</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
              {totalMonthHours.toFixed(1)}h
            </div>
          </div>

          <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>SỐ CA HOÀN THÀNH</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--neutral)', marginTop: 4 }}>
              {totalCompletedShifts} ca
            </div>
          </div>
        </div>

        {/* Attendance table */}
        {monthAttendances.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Chưa có dữ liệu chấm công cho tháng {selectedMonth}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giờ vào</th>
                  <th>Giờ ra</th>
                  <th>Phương thức</th>
                  <th style={{ textAlign: 'right' }}>Số giờ</th>
                </tr>
              </thead>
              <tbody>
                {monthAttendances.map((att) => (
                  <tr key={att.id}>
                    <td style={{ fontWeight: 600 }}>{att.date}</td>
                    <td>{formatTime(att.checkIn)}</td>
                    <td>{att.checkOut ? formatTime(att.checkOut) : <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Đang làm việc</span>}</td>
                    <td>{getMethodLabel(att.checkInMethod)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                      {(att.totalHours || 0).toFixed(2)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Check-Out Confirmation Modal */}
      {showCheckOutConfirm && activeAttendance && (
        <div className="modal-overlay" onClick={() => setShowCheckOutConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">Xác nhận kết thúc ca</div>
              <button className="modal-close" onClick={() => setShowCheckOutConfirm(false)}>×</button>
            </div>
            <div style={{ padding: '16px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
              <p style={{ fontSize: 15, margin: 0, color: 'var(--neutral)', lineHeight: 1.5 }}>
                Bạn đã làm việc được <strong>{getElapsedDuration(activeAttendance.checkIn)}</strong>.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                Bạn có chắc chắn muốn kết thúc ca làm việc lúc này?
              </p>
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCheckOutConfirm(false)}
              >
                Tiếp tục làm
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleCheckOut}
                disabled={loading}
              >
                {loading ? <span className="spinner spinner-white" /> : 'Xác nhận ra ca'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
