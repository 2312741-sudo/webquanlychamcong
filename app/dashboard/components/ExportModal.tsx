import { useState } from 'react';
import { Member } from '@/lib/types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onExport: (filters: { memberId?: string, type: 'month' | 'range', month?: string, startDate?: string, endDate?: string }) => void;
  title: string;
}

export default function ExportModal({ isOpen, onClose, members, onExport, title }: ExportModalProps) {
  const [memberId, setMemberId] = useState<string>('all');
  const [type, setType] = useState<'month' | 'range'>('month');
  
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState<string>(currentMonth);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onExport({
      memberId: memberId === 'all' ? undefined : memberId,
      type,
      month: type === 'month' ? month : undefined,
      startDate: type === 'range' ? startDate : undefined,
      endDate: type === 'range' ? endDate : undefined,
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
        width: '400px', maxWidth: '90%'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem' }}>{title}</h2>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Nhân viên</label>
          <select 
            className="input" 
            value={memberId} 
            onChange={(e) => setMemberId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="all">Tất cả nhân viên</option>
            {members.map(m => (
              <option key={m.userId} value={m.userId}>{m.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Thời gian</label>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input 
                type="radio" 
                checked={type === 'month'} 
                onChange={() => setType('month')} 
              />
              Theo tháng
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input 
                type="radio" 
                checked={type === 'range'} 
                onChange={() => setType('range')} 
              />
              Khoảng ngày
            </label>
          </div>

          {type === 'month' ? (
            <input 
              type="month" 
              className="input" 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: '100%' }}
            />
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="date" 
                className="input" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ flex: 1 }}
              />
              <span style={{ display: 'flex', alignItems: 'center' }}>-</span>
              <input 
                type="date" 
                className="input" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button onClick={onClose} className="btn" style={{ backgroundColor: '#e2e8f0', color: '#475569' }}>
            Hủy
          </button>
          <button 
            onClick={handleSubmit} 
            className="btn btn-primary"
            disabled={type === 'range' && (!startDate || !endDate)}
          >
            Xuất Excel
          </button>
        </div>
      </div>
    </div>
  );
}
