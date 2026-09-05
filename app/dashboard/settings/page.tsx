'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import { updateStore, clearAllSchedules, deleteAllAttendances, deleteStoreAndCleanup } from '@/lib/firestore';
import { ShiftDefinition, Department, StoreLocation } from '@/lib/types';

export default function SettingsPage() {
  const { storeId, store } = useApp();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(100);
  const [themeColor, setThemeColor] = useState('#C8102E');
  const [deliveryAllowance, setDeliveryAllowance] = useState(0);
  const [giaoHangAllowance, setGiaoHangAllowance] = useState(0);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [giaoHangEnabled, setGiaoHangEnabled] = useState(true);
  const [wifis, setWifis] = useState<StoreWifi[]>([]);
  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deletePassword, setDeletePassword] = useState('123456');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (store) {
      setName(store.name || '');
      setAddress(store.address || '');
      setRadius(store.radiusMeters || 100);
      setThemeColor(store.themeColor || '#C8102E');
      setDeliveryAllowance(store.deliveryAllowance || 0);
      setGiaoHangAllowance(store.giaoHangAllowance || 0);
      setDeliveryEnabled(store.deliveryEnabled ?? true);
      setGiaoHangEnabled(store.giaoHangEnabled ?? true);
      setDepartmentSelectionEnabled(store.departmentSelectionEnabled ?? true);
      setWifis(store.wifis || []);
      const rawLocs: StoreLocation[] = (store as any).locations || [];
      if (rawLocs.length === 0 && (store.latitude || (store as any).latitude)) {
        setLocations([{
          id: 'loc_primary',
          name: 'Vị trí chính',
          latitude: store.latitude || (store as any).latitude,
          longitude: store.longitude || (store as any).longitude,
          radiusMeters: store.radiusMeters || 100,
        }]);
      } else {
        setLocations(rawLocs);
      }
      setShifts(store.customShifts || []);
      setDepartments(store.departments || []);
      setDeletePassword((store as any).deletePassword || '123456');
    }
  }, [store]);

  const handleSave = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      const primaryLoc = locations.length > 0 ? locations[0] : null;
      await updateStore(storeId, {
        name,
        address,
        radiusMeters: primaryLoc?.radiusMeters || radius,
        latitude: primaryLoc?.latitude ?? null,
        longitude: primaryLoc?.longitude ?? null,
        locations,
        themeColor,
        deliveryAllowance,
        giaoHangAllowance,
        deliveryEnabled,
        giaoHangEnabled,
        departmentSelectionEnabled,
        wifis,
        customShifts: shifts,
        departments,
      });
      alert('Đã lưu cài đặt');
    } catch (e) {
      alert('Lỗi khi lưu cài đặt');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!storeId) return;
    if (!oldPassword || !newPassword) {
      alert('Vui lòng nhập đủ mật khẩu cũ và mới');
      return;
    }
    const currentPass = (store as any).deletePassword || '123456';
    if (oldPassword !== currentPass) {
      alert('Mật khẩu cũ không chính xác!');
      return;
    }
    setSaving(true);
    try {
      await updateStore(storeId, { deletePassword: newPassword });
      setDeletePassword(newPassword);
      alert('Đổi mật khẩu thành công!');
      setOldPassword('');
      setNewPassword('');
    } catch (e) {
      alert('Lỗi khi đổi mật khẩu');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSchedules = async () => {
    if (!storeId) return;
    if (!confirm('BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ LỊCH LÀM?\n\nThao tác này sẽ xóa sạch lịch làm của tất cả các tuần trong cửa hàng này và không thể hoàn tác!')) return;
    
    const pass = window.prompt('Vui lòng nhập mật khẩu bảo mật để xác nhận xóa toàn bộ lịch làm:');
    if (pass !== deletePassword) {
      alert('Mật khẩu không đúng. Đã hủy thao tác xóa.');
      return;
    }

    setSaving(true);
    try {
      await clearAllSchedules(storeId);
      alert('Đã xóa toàn bộ lịch làm thành công!');
    } catch (e) {
      alert('Lỗi khi xóa lịch làm');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAttendances = async () => {
    if (!storeId) return;
    if (!confirm('BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ DỮ LIỆU IN/OUT?\n\nThao tác này sẽ xóa sạch dữ liệu chấm công của tất cả nhân viên và không thể hoàn tác!')) return;
    
    const pass = window.prompt('Vui lòng nhập mật khẩu bảo mật để xác nhận xóa toàn bộ dữ liệu IN/OUT:');
    if (pass !== deletePassword) {
      alert('Mật khẩu không đúng. Đã hủy thao tác xóa.');
      return;
    }

    setSaving(true);
    try {
      await deleteAllAttendances(storeId);
      alert('Đã xóa toàn bộ dữ liệu IN/OUT thành công!');
    } catch (e) {
      alert('Lỗi khi xóa dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  const addWifi = () => {
    if (wifis.length >= 10) return;
    setWifis([...wifis, { name: `WiFi ${wifis.length + 1}`, ssid: '', bssid: '' }]);
  };
  const updateWifi = (index: number, field: keyof StoreWifi, value: string) => {
    const newWifis = [...wifis];
    newWifis[index] = { ...newWifis[index], [field]: value };
    setWifis(newWifis);
  };
  const removeWifi = (index: number) => {
    setWifis(wifis.filter((_, i) => i !== index));
  };

  const addLocation = () => {
    if (locations.length >= 5) return;
    setLocations([
      ...locations,
      {
        id: `loc_${Date.now()}`,
        name: locations.length === 0 ? 'Cơ sở chính' : `Vị trí ${locations.length + 1}`,
        latitude: store?.latitude || 21.028511,
        longitude: store?.longitude || 105.854444,
        radiusMeters: 100,
      }
    ]);
  };

  const updateLocation = (index: number, field: keyof StoreLocation, val: any) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], [field]: val };
    setLocations(updated);
  };

  const removeLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const addShift = () => {
    setShifts([
      ...shifts,
      {
        id: Math.random().toString(36).substr(2, 9),
        name: 'Ca mới',
        startHour: 8,
        startMinute: 0,
        endHour: 17,
        endMinute: 0,
      }
    ]);
  };

  const updateShift = (index: number, field: keyof ShiftDefinition, value: any) => {
    const newShifts = [...shifts];
    newShifts[index] = { ...newShifts[index], [field]: value };
    setShifts(newShifts);
  };

  const removeShift = (index: number) => {
    setShifts(shifts.filter((_, i) => i !== index));
  };

  const addDepartment = () => {
    setDepartments([
      ...departments,
      { id: Math.random().toString(36).substr(2, 9), name: 'Bộ phận mới', shortName: 'NEW' }
    ]);
  };

  const updateDepartment = (index: number, field: keyof Department, value: string) => {
    const newDepts = [...departments];
    newDepts[index] = { ...newDepts[index], [field]: value };
    setDepartments(newDepts);
  };

  const removeDepartment = (index: number) => {
    setDepartments(departments.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--neutral)' }}>Cài đặt cửa hàng</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Cập nhật thông tin và cấu hình chấm công
        </p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Thông tin chung</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Tên cửa hàng</label>
            <input 
              type="text" 
              className="input" 
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          
          <div>
            <label className="label">Mã cửa hàng (Code)</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input 
                type="text" 
                className="input" 
                value={store?.code || ''}
                readOnly
                style={{ background: 'var(--surface)', fontWeight: 700, letterSpacing: 2 }}
              />
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(store?.code || '');
                  alert('Đã copy mã cửa hàng');
                }}
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="label">Địa chỉ</label>
            <textarea 
              className="input" 
              rows={3}
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Màu sắc chủ đạo (Excel)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input 
                type="color" 
                value={themeColor}
                onChange={e => setThemeColor(e.target.value)}
                style={{ width: 50, height: 40, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{themeColor}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Màu nền sẽ hiển thị khi xuất báo cáo Excel cho cửa hàng này.
            </p>
          </div>

          <div>
            <label className="label">Phụ cấp chở hàng (vnđ/ca)</label>
            <input 
              type="number" 
              className="input" 
              value={deliveryAllowance}
              onChange={e => setDeliveryAllowance(Number(e.target.value))}
            />
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Số tiền này sẽ được cộng thêm vào lương khi nhân viên được xếp lịch làm "ca chở hàng".
            </p>
          </div>

          <div>
            <label className="label">Phụ cấp giao hàng (vnđ/ca)</label>
            <input 
              type="number" 
              className="input" 
              value={giaoHangAllowance}
              onChange={e => setGiaoHangAllowance(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={deliveryEnabled} onChange={e => setDeliveryEnabled(e.target.checked)} />
              Cho phép NV đăng ký "Chở hàng" khi đăng ký lịch làm
            </label>
          </div>

          <div>
            <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={giaoHangEnabled} onChange={e => setGiaoHangEnabled(e.target.checked)} />
              Cho phép NV đăng ký "Giao hàng" khi đăng ký lịch làm
            </label>
          </div>

          <div>
            <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={departmentSelectionEnabled} onChange={e => setDepartmentSelectionEnabled(e.target.checked)} />
              Cho phép NV/QL đăng ký bộ phận
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Danh sách WiFi Chấm Công (BSSID Access Point)</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Cấu hình tối đa 10 địa chỉ WiFi (BSSID MAC Access Point) để nhân viên chấm công
            </p>
          </div>
          <button className="btn btn-secondary" onClick={addWifi} disabled={wifis.length >= 10} style={{ fontSize: 13, padding: '6px 12px' }}>
            + Thêm WiFi ({wifis.length}/10)
          </button>
        </div>
        
        {wifis.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: 8 }}>
            Chưa có WiFi nào. Bấm "Thêm WiFi" để tạo (tối đa 10 điểm).
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {wifis.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', padding: 12, borderRadius: 8 }}>
                <div style={{ flex: 1.2 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Tên nhận diện</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={w.name}
                    onChange={e => updateWifi(i, 'name', e.target.value)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: Quầy bar / Tầng 1"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>SSID (Tên mạng)</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={w.ssid || ''}
                    onChange={e => updateWifi(i, 'ssid', e.target.value)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: CuaHang_WiFi"
                  />
                </div>
                <div style={{ flex: 1.2 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>BSSID (MAC Access Point)</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={w.bssid || ''}
                    onChange={e => updateWifi(i, 'bssid', e.target.value)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="aa:bb:cc:dd:ee:ff"
                  />
                </div>
                <div style={{ paddingTop: 20 }}>
                  <button 
                    onClick={() => removeWifi(i)}
                    style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Danh sách Vị trí GPS Chấm Công</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Cấu hình tối đa 5 vị trí tọa độ GPS và đặt tên riêng cho từng vị trí để nhân viên chấm công
            </p>
          </div>
          <button className="btn btn-secondary" onClick={addLocation} disabled={locations.length >= 5} style={{ fontSize: 13, padding: '6px 12px' }}>
            + Thêm vị trí ({locations.length}/5)
          </button>
        </div>
        
        {locations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: 8 }}>
            Chưa có vị trí GPS nào. Bấm "+ Thêm vị trí" để tạo (tối đa 5 vị trí).
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {locations.map((loc, i) => (
              <div key={loc.id || i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', padding: 12, borderRadius: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(200, 16, 46, 0.1)', color: 'var(--primary)', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1.5 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Tên vị trí *</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={loc.name}
                    onChange={e => updateLocation(i, 'name', e.target.value)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: Cơ sở chính, Kho..."
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Vĩ độ (Lat)</label>
                  <input 
                    type="number"
                    step="any"
                    className="input" 
                    value={loc.latitude}
                    onChange={e => updateLocation(i, 'latitude', parseFloat(e.target.value) || 0)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: 21.02851"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Kinh độ (Lng)</label>
                  <input 
                    type="number"
                    step="any"
                    className="input" 
                    value={loc.longitude}
                    onChange={e => updateLocation(i, 'longitude', parseFloat(e.target.value) || 0)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: 105.85444"
                  />
                </div>
                <div style={{ width: 110 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Bán kính (m)</label>
                  <input 
                    type="number" 
                    className="input" 
                    value={loc.radiusMeters}
                    onChange={e => updateLocation(i, 'radiusMeters', parseInt(e.target.value) || 100)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="100"
                  />
                </div>
                <div style={{ paddingTop: 20 }}>
                  <button 
                    onClick={() => removeLocation(i)}
                    style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Xóa vị trí này"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Danh sách Bộ phận</h3>
          <button className="btn btn-secondary" onClick={addDepartment} style={{ fontSize: 13, padding: '6px 12px' }}>
            + Thêm bộ phận
          </button>
        </div>
        
        {departments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: 8 }}>
            Chưa có bộ phận nào. Bấm "Thêm bộ phận" để tạo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {departments.map((d, i) => (
              <div key={d.id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', padding: 12, borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Tên bộ phận</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={d.name}
                    onChange={e => updateDepartment(i, 'name', e.target.value)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: Pha chế"
                  />
                </div>
                <div style={{ width: 120 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Tên viết tắt</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={d.shortName}
                    onChange={e => updateDepartment(i, 'shortName', e.target.value)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: PC"
                    maxLength={10}
                  />
                </div>
                <div style={{ paddingTop: 20 }}>
                  <button 
                    onClick={() => removeDepartment(i)}
                    style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Danh sách ca làm việc</h3>
          <button className="btn btn-secondary" onClick={addShift} style={{ fontSize: 13, padding: '6px 12px' }}>
            + Thêm ca làm
          </button>
        </div>
        
        {shifts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: 8 }}>
            Chưa có ca làm nào. Bấm "Thêm ca làm" để tạo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shifts.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', padding: 12, borderRadius: '8px 8px 0 0' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Tên ca / Ký hiệu</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={s.name}
                      onChange={e => updateShift(i, 'name', e.target.value)}
                      style={{ padding: '6px 10px', marginTop: 4 }}
                      placeholder="VD: SX"
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Giờ vào</label>
                    <input 
                      type="number" 
                      className="input" 
                      value={s.startHour}
                      onChange={e => updateShift(i, 'startHour', Number(e.target.value))}
                      style={{ padding: '6px 10px', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Phút vào</label>
                    <input 
                      type="number" 
                      className="input" 
                      value={s.startMinute}
                      onChange={e => updateShift(i, 'startMinute', Number(e.target.value))}
                      style={{ padding: '6px 10px', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Giờ ra</label>
                    <input 
                      type="number" 
                      className="input" 
                      value={s.endHour}
                      onChange={e => updateShift(i, 'endHour', Number(e.target.value))}
                      style={{ padding: '6px 10px', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ width: 80 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Phút ra</label>
                    <input 
                      type="number" 
                      className="input" 
                      value={s.endMinute}
                      onChange={e => updateShift(i, 'endMinute', Number(e.target.value))}
                      style={{ padding: '6px 10px', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ paddingTop: 20 }}>
                    <button 
                      onClick={() => removeShift(i)}
                      style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Cấu hình chấm công GPS</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Bán kính cho phép (mét)</label>
            <input 
              type="number" 
              className="input" 
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Dữ liệu hệ thống</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Đổi mật khẩu bảo mật (dùng khi xóa dữ liệu)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 300 }}>
              <div>
                <label className="label">Mật khẩu cũ (Mặc định: 123456)</label>
                <input 
                  type="password" 
                  className="input" 
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Mật khẩu mới</label>
                <input 
                  type="password" 
                  className="input" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
              <button 
                className="btn btn-secondary"
                onClick={handleChangePassword}
                disabled={saving || !oldPassword || !newPassword}
                style={{ width: 'max-content', marginTop: 4 }}
              >
                Cập nhật mật khẩu
              </button>
            </div>
          </div>
            
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Nếu hệ thống bị lỗi hiển thị số liệu ca cũ do thay đổi nhiều cài đặt, bạn có thể xóa toàn bộ lịch làm để xếp lại từ đầu.
            </p>
            <button 
              className="btn btn-secondary" 
              onClick={handleClearSchedules}
              disabled={saving}
              style={{ color: 'white', background: 'var(--primary)', borderColor: 'var(--primary)', marginBottom: 12 }}
            >
              🗑️ Xóa toàn bộ dữ liệu lịch làm
            </button>
            <br/>
            <button 
              className="btn btn-secondary" 
              onClick={handleClearAttendances}
              disabled={saving}
              style={{ color: 'white', background: 'var(--primary)', borderColor: 'var(--primary)' }}
            >
              🗑️ Xóa toàn bộ dữ liệu IN/OUT (Chấm công)
            </button>
            <br/>
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #FFC9C9', background: '#FFF5F5', padding: 16, borderRadius: 8 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#C8102E', marginBottom: 8 }}>⚠️ Vùng nguy hiểm: Xóa cửa hàng</h4>
              <p style={{ fontSize: 12, color: '#495057', marginBottom: 12, lineHeight: 1.5 }}>
                Hành động này sẽ xóa vĩnh viễn cửa hàng <b>{store?.name}</b> cùng toàn bộ cấu hình, lịch làm và thành viên. Xác nhận bảo mật 2 bước là bắt buộc.
              </p>
              <button 
                className="btn" 
                onClick={async () => {
                  if (!storeId || !store) return;
                  if (!confirm(`CẢNH BÁO NGUY HIỂM!\n\nBạn có chắc chắn muốn XÓA VĨNH VIỄN cửa hàng "${store.name}"?\nToàn bộ dữ liệu thành viên, lịch làm và chấm công sẽ bị xóa và không thể khôi phục!`)) return;

                  const pass = window.prompt('Bước 1/2: Nhập mật khẩu bảo mật của cửa hàng:');
                  if (pass !== deletePassword) {
                    alert('Mật khẩu không đúng. Đã hủy thao tác.');
                    return;
                  }

                  const confirmName = window.prompt(`Bước 2/2: Nhập chính xác tên cửa hàng "${store.name}" hoặc chữ "XÓA" để hoàn tất:`);
                  if (confirmName !== store.name && confirmName !== 'XÓA' && confirmName !== 'XOA') {
                    alert('Tên xác nhận không khớp. Đã hủy thao tác xóa.');
                    return;
                  }

                  setSaving(true);
                  try {
                    await deleteStoreAndCleanup(storeId, store.name, store.ownerId);
                    alert('Đã xóa cửa hàng thành công!');
                    window.location.reload();
                  } catch (e) {
                    alert('Lỗi khi xóa cửa hàng: ' + (e as any)?.message);
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                style={{ color: 'white', background: '#C8102E', border: 'none', fontWeight: 700, padding: '10px 20px', borderRadius: 8, cursor: 'pointer' }}
              >
                🚨 Xóa vĩnh viễn cửa hàng này (2 Bước)
              </button>
            </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 40 }}>
        <button 
          className="btn btn-primary" 
          onClick={handleSave} 
          disabled={saving || !store}
          style={{ padding: '12px 32px', fontSize: 16 }}
        >
          {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
        </button>
      </div>
    </div>
  );
}
