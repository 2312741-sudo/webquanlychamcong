'use client';
import { useState, useEffect } from 'react';
import { useApp } from '../layout';
import { updateStore, clearAllSchedules, deleteAllAttendances } from '@/lib/firestore';
import { ShiftDefinition, Department } from '@/lib/types';

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
  const [departmentSelectionEnabled, setDepartmentSelectionEnabled] = useState(true);
  const [wifis, setWifis] = useState<{name: string; ip: string}[]>([]);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deletePassword, setDeletePassword] = useState('123456');
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
      setShifts(store.customShifts || []);
      setDepartments(store.departments || []);
      setDeletePassword((store as any).deletePassword || '123456');
    }
  }, [store]);

  const handleSave = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      await updateStore(storeId, {
        name,
        address,
        radiusMeters: radius,
        themeColor,
        deliveryAllowance,
        giaoHangAllowance,
        deliveryEnabled,
        giaoHangEnabled,
        departmentSelectionEnabled,
        wifis,
        customShifts: shifts,
        departments,
        deletePassword,
      });
      alert('Đã lưu cài đặt');
    } catch (e) {
      alert('Lỗi khi lưu cài đặt');
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
    if (wifis.length >= 3) return;
    setWifis([...wifis, { name: 'WiFi mới', ip: '' }]);
  };
  const updateWifi = (index: number, field: 'name' | 'ip', value: string) => {
    const newWifis = [...wifis];
    newWifis[index] = { ...newWifis[index], [field]: value };
    setWifis(newWifis);
  };
  const removeWifi = (index: number) => {
    setWifis(wifis.filter((_, i) => i !== index));
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
              Cho phép NV/QL đăng ký "Chở hàng" trên app/web
            </label>
          </div>

          <div>
            <label className="label" style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={giaoHangEnabled} onChange={e => setGiaoHangEnabled(e.target.checked)} />
              Hiển thị tích "Giao hàng" trên lịch làm cho Chủ/QL
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
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Danh sách WiFi Chấm Công</h3>
          <button className="btn btn-secondary" onClick={addWifi} disabled={wifis.length >= 3} style={{ fontSize: 13, padding: '6px 12px' }}>
            + Thêm WiFi ({wifis.length}/3)
          </button>
        </div>
        
        {wifis.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: 8 }}>
            Chưa có WiFi nào. Bấm "Thêm WiFi" để tạo (tối đa 3).
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {wifis.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--surface)', padding: 12, borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Tên WiFi</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={w.name}
                    onChange={e => updateWifi(i, 'name', e.target.value)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: CuaHang_T1"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Địa chỉ IP</label>
                  <input 
                    type="text" 
                    className="input" 
                    value={w.ip}
                    onChange={e => updateWifi(i, 'ip', e.target.value)}
                    style={{ padding: '6px 10px', marginTop: 4 }}
                    placeholder="VD: 113.113.113.113"
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
          <div>
            <label className="label">Mật khẩu bảo mật cho các thao tác xóa (Mặc định: 123456)</label>
            <input 
              type="text" 
              className="input" 
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              style={{ maxWidth: 300, marginBottom: 20 }}
            />
            
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
