import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Member, AttendanceRecord, ScheduleModel, Store, ShiftDefinition, DaySchedule } from './types';

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DAY_LABELS = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'];
const SHIFT_LABELS: Record<string, string> = {
  morning: 'Ca sáng (06:00-14:00)',
  afternoon: 'Ca chiều (14:00-22:00)',
  evening: 'Ca tối (22:00-06:00)',
  off: 'Nghỉ',
};
const ROLE_LABELS: Record<string, string> = {
  owner: 'Chủ', manager: 'Quản lý', employee: 'Nhân viên',
};

export function exportMonthlyAttendance(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
  store: Store,
  schedules: ScheduleModel[]
) {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();

  const formatTime = (val: any) => {
    if (!val) return null;
    const d = val.toDate ? val.toDate() : (val.seconds ? new Date(val.seconds * 1000) : new Date(val));
    return isNaN(d.getTime()) ? null : d;
  };

  const headers = [
    'Tên nhân viên', 'Vai trò',
    ...Array.from({ length: daysInMonth }, (_, i) => `Ngày ${i + 1}`),
    'Tổng giờ', 'Số ca chở', 'Tiền chở', 'Số ca giao', 'Tiền giao'
  ];

  const rows = members.map(member => {
    const memberAtts = attendances.filter(a => a.userId === member.userId);
    let totalHours = 0;
    const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${month}-${String(day).padStart(2, '0')}`;
      const att = memberAtts.find(a => a.date === dateStr);
      const h = att?.totalHours ?? 0;
      totalHours += h;
      if (att) {
        const inD = formatTime(att.checkIn);
        const outD = formatTime(att.checkOut);
        let str = '';
        if (inD) str += `${inD.getHours().toString().padStart(2, '0')}:${inD.getMinutes().toString().padStart(2, '0')}`;
        str += '-';
        if (outD) {
          str += `${outD.getHours().toString().padStart(2, '0')}:${outD.getMinutes().toString().padStart(2, '0')}`;
          if (inD && outD.getDate() !== inD.getDate()) str += '(+1)';
        }
        return `${str} (${h.toFixed(1)}h)`;
      }
      return '0h';
    });
    // Calculate delivery
    let deliveryCount = 0;
    let giaoHangCount = 0;
    const [yearStr, monthStr] = month.split('-');
    schedules.forEach(sched => {
      const weekStart = new Date(sched.weekStart);
      const userShifts = sched.shifts[member.userId];
      if (!userShifts) return;
      DAY_KEYS.forEach((dayKey, i) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        if (date.getFullYear() === Number(yearStr) && date.getMonth() + 1 === Number(monthStr)) {
          const arr = (userShifts[dayKey as keyof typeof userShifts] || []) as string[];
          const validIds = new Set((store?.customShifts || []).map(s => s.id));
          const hasValidNormalShift = arr.some(id => {
            const baseId = id.split('|')[0];
            return baseId !== 'delivery' && baseId !== 'giaohang' && validIds.has(baseId);
          });
          if (arr.includes('delivery') && hasValidNormalShift) deliveryCount++;
          if (arr.includes('giaohang') && hasValidNormalShift) giaoHangCount++;
        }
      });
    });
    const deliveryPay = deliveryCount * (store.deliveryAllowance || 0);
    const giaoHangPay = giaoHangCount * (store.giaoHangAllowance || 0);

    return [
      member.name, 
      ROLE_LABELS[member.role] || member.role, 
      ...dayCells, 
      `${totalHours.toFixed(1)}h`,
      `${deliveryCount} ca`,
      `${deliveryPay.toLocaleString('vi-VN')} vnđ`,
      `${giaoHangCount} ca`,
      `${giaoHangPay.toLocaleString('vi-VN')} vnđ`
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, ...Array(daysInMonth).fill({ wch: 16 }), { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Bảng Công');
  XLSX.writeFile(wb, `BangCong_${month}.xlsx`);
}

export function exportDetailedInOut(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
) {
  const detailHeaders = ['ngày', 'mã nv', 'tên nhân viên', 'giờ', 'in/out'];
  const detailRows: any[][] = [];
  
  const sortedAtts = [...attendances].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const formatTime = (val: any) => {
      if (!val) return null;
      const d = val.toDate ? val.toDate() : (val.seconds ? new Date(val.seconds * 1000) : new Date(val));
      return isNaN(d.getTime()) ? null : d;
    };
    const timeA = formatTime(a.checkIn)?.getTime() || 0;
    const timeB = formatTime(b.checkIn)?.getTime() || 0;
    return timeA - timeB;
  });

  const formatTimeHelper = (val: any) => {
    if (!val) return null;
    const d = val.toDate ? val.toDate() : (val.seconds ? new Date(val.seconds * 1000) : new Date(val));
    return isNaN(d.getTime()) ? null : d;
  };

  sortedAtts.forEach(att => {
    const member = members.find(m => m.userId === att.userId);
    if (!member) return;
    
    const inD = formatTimeHelper(att.checkIn);
    const outD = formatTimeHelper(att.checkOut);
    
    const formatStrDate = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    const formatStrTime = (d: Date) => `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    
    if (inD) {
      detailRows.push([
        formatStrDate(inD),
        member.employeeCode || '',
        member.name,
        formatStrTime(inD),
        'IN'
      ]);
    }
    
    if (outD) {
      detailRows.push([
        formatStrDate(outD),
        member.employeeCode || '',
        member.name,
        formatStrTime(outD),
        'OUT'
      ]);
    }
  });

  const wb = XLSX.utils.book_new();
  const ws2 = XLSX.utils.aoa_to_sheet([detailHeaders, ...detailRows]);
  ws2['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Chi Tiết IN-OUT');

  XLSX.writeFile(wb, `ChiTietInOut_${month}.xlsx`);
}

export function exportMonthlySalary(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
  store: Store,
  schedules: ScheduleModel[]
) {
  const headers = [
    'Tên nhân viên', 'Vai trò', 'Loại HĐ',
    'Tổng giờ', 'Giờ chuẩn', 'Lương cơ bản', 'Số ca chở hàng', 'Phụ cấp chở', 'Số ca giao', 'Phụ cấp giao', 'Lương thực nhận',
  ];

  const rows = members.map(member => {
    const memberAtts = attendances.filter(a => a.userId === member.userId);
    const totalHours = memberAtts.reduce((sum, a) => sum + (a.totalHours || 0), 0);
    const typeLabel = member.employeeType === 'fulltime' ? 'Toàn thời gian' : 'Bán thời gian';
    let calculatedSalary = 0;
    if (member.employeeType === 'fulltime') {
      calculatedSalary = member.baseMonthlySalary * (totalHours / (member.standardHoursPerMonth || 208));
    } else {
      calculatedSalary = totalHours * member.baseHourlyRate;
    }
    const baseSalary = member.employeeType === 'fulltime' ? member.baseMonthlySalary : member.baseHourlyRate;

    // Calculate delivery
    let deliveryCount = 0;
    let giaoHangCount = 0;
    const [yearStr, monthStr] = month.split('-');
    schedules.forEach(sched => {
      const weekStart = new Date(sched.weekStart);
      const userShifts = sched.shifts[member.userId];
      if (!userShifts) return;
      DAY_KEYS.forEach((dayKey, i) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        if (date.getFullYear() === Number(yearStr) && date.getMonth() + 1 === Number(monthStr)) {
          const arr = (userShifts[dayKey as keyof typeof userShifts] || []) as string[];
          const validIds = new Set((store?.customShifts || []).map(s => s.id));
          const hasValidNormalShift = arr.some(id => {
            const baseId = id.split('|')[0];
            return baseId !== 'delivery' && baseId !== 'giaohang' && validIds.has(baseId);
          });
          if (arr.includes('delivery') && hasValidNormalShift) deliveryCount++;
          if (arr.includes('giaohang') && hasValidNormalShift) giaoHangCount++;
        }
      });
    });
    const deliveryPay = deliveryCount * (store.deliveryAllowance || 0);
    const giaoHangPay = giaoHangCount * (store.giaoHangAllowance || 0);
    calculatedSalary += deliveryPay + giaoHangPay;

    return [
      member.name,
      ROLE_LABELS[member.role] || member.role,
      typeLabel,
      `${totalHours.toFixed(1)}h`,
      `${member.standardHoursPerMonth}h`,
      `${baseSalary.toLocaleString('vi-VN')} vnđ`,
      `${deliveryCount} ca`,
      `${deliveryPay.toLocaleString('vi-VN')} vnđ`,
      `${giaoHangCount} ca`,
      `${giaoHangPay.toLocaleString('vi-VN')} vnđ`,
      `${Math.round(calculatedSalary).toLocaleString('vi-VN')} vnđ`,
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Lương Tháng');
  XLSX.writeFile(wb, `BaoCaoLuong_${month}.xlsx`);
}

export async function exportWeeklySchedule(
  members: Member[],
  schedule: ScheduleModel | null,
  weekStart: string,
  store: Store
) {
  const monday = new Date(weekStart);
  const month = monday.getMonth() + 1;
  const year = monday.getFullYear();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const customShifts = store.customShifts || [];
  const themeColor = (store.themeColor || '#C8102E').replace('#', ''); // e.g. 'C8102E'

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lịch Làm');

  // Title Row
  const titleText = `CÔNG VIỆC THÁNG ${month} NĂM ${year} ${store.name.toUpperCase()}`;
  sheet.mergeCells('A1:AD1'); // Columns A to AD (1 + 7*4 + 1 = 30 columns)
  const titleCell = sheet.getCell('A1');
  titleCell.value = titleText;
  titleCell.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: themeColor } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // Header Row 1 (Days)
  sheet.getCell('A2').value = 'TÍNH CHẤT';
  sheet.mergeCells('A2:A3');
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A2').font = { bold: true };
  sheet.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };

  const dayNamesEn = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  for (let i = 0; i < 7; i++) {
    const startCol = 2 + i * 4; // B is 2
    
    // Row 2: Day name
    sheet.mergeCells(2, startCol, 2, startCol + 3);
    const dayCell = sheet.getCell(2, startCol);
    dayCell.value = dayNamesEn[i];
    dayCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dayCell.font = { bold: true };
    
    // Row 3: Date
    sheet.mergeCells(3, startCol, 3, startCol + 3);
    const dateCell = sheet.getCell(3, startCol);
    const dateStr = `${days[i].getDate().toString().padStart(2, '0')}/${(days[i].getMonth() + 1).toString().padStart(2, '0')}`;
    dateCell.value = dateStr;
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dateCell.font = { bold: true };
    
    // Background for day and date
    for(let r = 2; r <= 3; r++) {
      for(let c = 0; c < 4; c++) {
        sheet.getCell(r, startCol + c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };
      }
    }
  }

  sheet.getCell(2, 30).value = 'TỔNG SỐ GIỜ\nTRONG TUẦN';
  sheet.mergeCells(2, 30, 3, 30);
  sheet.getCell(2, 30).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  sheet.getCell(2, 30).font = { bold: true };
  sheet.getCell(2, 30).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };

  // Column Headers under Days (not explicitly in sample, but implied)
  // The sample image shows data directly under the date headers, but it has sub-columns.
  // We'll skip adding a sub-header row to match the image, and just dump data in row 4+
  
  let currentRow = 4;

  members.forEach(member => {
    const daySchedule = (schedule?.shifts[member.userId] || {}) as Partial<DaySchedule>;
    
    // Find max shifts per day for this employee to determine how many sub-rows they need
    let maxShifts = 1;
    DAY_KEYS.forEach(key => {
      const shiftsForDay = daySchedule[key as keyof DaySchedule] || [];
      const arr = Array.isArray(shiftsForDay) ? shiftsForDay : (shiftsForDay === 'off' ? [] : [shiftsForDay]);
      const actualArr = arr.filter(id => id !== 'delivery' && id !== 'giaohang');
      if (actualArr.length > maxShifts) maxShifts = actualArr.length;
    });

    const startRow = currentRow;
    const endRow = currentRow + maxShifts - 1;

    // Merge employee name cell vertically
    if (maxShifts > 1) {
      sheet.mergeCells(`A${startRow}:A${endRow}`);
    }
    const nameCell = sheet.getCell(`A${startRow}`);
    nameCell.value = member.name.toUpperCase();
    nameCell.alignment = { vertical: 'middle', wrapText: true };
    nameCell.font = { bold: true };

    let totalHoursInWeek = 0;

    // Fill the shift data
    for (let r = 0; r < maxShifts; r++) {
      for (let i = 0; i < 7; i++) {
        const dayKey = DAY_KEYS[i];
        const shiftsForDay = daySchedule[dayKey as keyof DaySchedule] || [];
        const arr = Array.isArray(shiftsForDay) ? shiftsForDay : (shiftsForDay === 'off' ? [] : [shiftsForDay]);
        
        const actualShifts = arr.filter(id => id !== 'delivery' && id !== 'giaohang');

        const startCol = 2 + i * 4;
        
        if (r < actualShifts.length) {
          const entry = actualShifts[r];
          const [shiftId, deptId] = entry.includes('|') ? entry.split('|') : [entry, ''];
          const dept = store.departments?.find(d => d.id === deptId);
          
          let shiftName = '';
          let startH = '', startM = '', endH = '', endM = '';
          let durationH = 0;

          const shiftDef = customShifts.find(s => s.id === shiftId);
          if (shiftDef) {
            shiftName = dept ? dept.shortName : shiftDef.name;
            startH = shiftDef.startHour.toString().padStart(2, '0');
            startM = shiftDef.startMinute.toString().padStart(2, '0');
            endH = shiftDef.endHour.toString().padStart(2, '0');
            endM = shiftDef.endMinute.toString().padStart(2, '0');
            durationH = shiftDef.endHour - shiftDef.startHour + (shiftDef.endMinute - shiftDef.startMinute) / 60;
            if (durationH < 0) durationH += 24;
          }
          
          if (shiftName) {
            totalHoursInWeek += durationH;
          }

          if (shiftName) {
            sheet.getCell(startRow + r, startCol).value = startH === '-' ? '-' : `${startH}:${startM}`;
            sheet.getCell(startRow + r, startCol + 1).value = endH === '-' ? '-' : `${endH}:${endM}`;
            const nameCell = sheet.getCell(startRow + r, startCol + 2);
            nameCell.value = shiftName;
            
            sheet.getCell(startRow + r, startCol + 3).value = durationH;
            
            // Background color for shift cells
            for(let c=0; c<4; c++) {
              const currentCell = sheet.getCell(startRow + r, startCol + c);
              currentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }; // Light blue
              currentCell.alignment = { horizontal: 'center' };
            }
            
            // Bold department name
            if (dept) {
              nameCell.font = { bold: true };
            }
          }
        } else {
          // empty shift cell
          sheet.getCell(startRow + r, startCol).value = '-';
          sheet.getCell(startRow + r, startCol + 1).value = '-';
          sheet.getCell(startRow + r, startCol + 2).value = '-';
          sheet.getCell(startRow + r, startCol + 3).value = '0,00';
          for(let c=0; c<4; c++) {
            sheet.getCell(startRow + r, startCol + c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            sheet.getCell(startRow + r, startCol + c).alignment = { horizontal: 'center' };
          }
        }
      }
    }
    
    // Add total shifts cell
    if (maxShifts > 1) {
      sheet.mergeCells(startRow, 30, endRow, 30);
    }
    const totalCell = sheet.getCell(startRow, 30);
    totalCell.value = `${totalHoursInWeek.toFixed(1)}h`;
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell.font = { bold: true };

    // Add borders to the employee block
    for (let r = startRow; r <= endRow; r++) {
      for (let c = 1; c <= 30; c++) {
        sheet.getCell(r, c).border = {
          top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
        };
      }
    }
    
    currentRow += maxShifts;
  });

  // Borders for Header
  for (let c = 1; c <= 30; c++) {
    sheet.getCell(2, c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    sheet.getCell(3, c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
  }

  // Adjust column widths
  sheet.getColumn(1).width = 25; // Employee name
  for (let i = 0; i < 7; i++) {
    const startCol = 2 + i * 4;
    sheet.getColumn(startCol).width = 7;
    sheet.getColumn(startCol + 1).width = 7;
    sheet.getColumn(startCol + 2).width = 6;
    sheet.getColumn(startCol + 3).width = 6;
  }
  sheet.getColumn(30).width = 15; // Tổng số giờ

  const buffer = await workbook.xlsx.writeBuffer();
  const monthStr = month.toString().padStart(2, '0');
  const cleanStoreName = store.name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  saveAs(new Blob([buffer]), `LichLam-${monthStr},${year}-${cleanStoreName}.xlsx`);
}
