import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Member, AttendanceRecord, ScheduleModel, Store, ShiftDefinition, DaySchedule, AdvanceRequest } from './types';

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

export async function exportMonthlyAttendance(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
  store: Store,
  schedules: ScheduleModel[],
  options?: { startDate?: Date; endDate?: Date }
) {
  const [year, mon] = month.split('-').map(Number);
  
  let daysArray: { day: number, dateStr: string, label: string }[] = [];
  if (options?.startDate && options?.endDate) {
    let current = new Date(options.startDate);
    const end = new Date(options.endDate);
    while (current <= end) {
      const d = current.getDate();
      const m = current.getMonth() + 1;
      const y = current.getFullYear();
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysArray.push({ day: d, dateStr, label: `${d}/${m}` });
      current.setDate(current.getDate() + 1);
    }
  } else {
    const daysInMonth = new Date(year, mon, 0).getDate();
    daysArray = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      return { day: d, dateStr, label: `NGÀY ${d}` };
    });
  }

  const themeColor = (store.themeColor || '#C8102E').replace('#', '');
  const lightColorHex = getLightHex(themeColor);

  const headers = [
    'NHÂN VIÊN', 'VAI TRÒ', 'TỔNG GIỜ',
    ...daysArray.map(d => d.label)
  ];

  const rows = members.map(member => {
    const memberAtts = attendances.filter(a => a.userId === member.userId);
    let totalHours = 0;
    const dayCells = daysArray.map(d => {
      const att = memberAtts.find(a => a.date === d.dateStr);
      const h = att?.totalHours ?? 0;
      totalHours += h;
      if (att) {
        return `${h.toFixed(1)}h`;
      }
      return '-';
    });

    return [
      member.name, 
      ROLE_LABELS[member.role] || member.role, 
      `${totalHours.toFixed(1)}h`,
      ...dayCells
    ];
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bảng Công');

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${themeColor}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  
  rows.forEach(r => {
    const row = sheet.addRow(r);
    row.eachCell((cell, colNumber) => {
      if (colNumber > 3) {
        cell.alignment = { horizontal: 'center' };
        if (cell.value && cell.value !== '-') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightColorHex } };
        }
      }
    });
  });

  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 10;
  for (let i = 4; i <= daysArray.length + 3; i++) {
    sheet.getColumn(i).width = 10;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `BangCong_${options?.startDate ? 'Filter' : month}.xlsx`);
}

function getLightHex(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * 0.85)).toString(16).padStart(2, '0');
  const lg = Math.min(255, Math.round(g + (255 - g) * 0.85)).toString(16).padStart(2, '0');
  const lb = Math.min(255, Math.round(b + (255 - b) * 0.85)).toString(16).padStart(2, '0');
  return `FF${lr}${lg}${lb}`.toUpperCase();
}

export async function exportDetailedInOut(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
  store?: Store,
) {
  const themeColor = (store?.themeColor || '#C8102E').replace('#', '');
  const lightColorHex = getLightHex(themeColor);
  const detailHeaders = ['NGÀY', 'MÃ NV', 'TÊN NHÂN VIÊN', 'GIỜ', 'IN/OUT'];
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Chi Tiết IN-OUT');

  const headerRow = sheet.addRow(detailHeaders);
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${themeColor}` }
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  
  detailRows.forEach(r => {
    const row = sheet.addRow(r);
    row.eachCell((cell, colNumber) => {
      if (colNumber > 3) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: lightColorHex }
        };
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  sheet.getColumn(1).width = 15;
  sheet.getColumn(2).width = 15;
  sheet.getColumn(3).width = 25;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 12;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `ChiTietInOut_${month}.xlsx`);
}

export async function exportMonthlySalary(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
  store: Store,
  schedules: ScheduleModel[],
  advances: AdvanceRequest[] = [],
  options?: { startDate?: Date; endDate?: Date }
) {
  const themeColor = (store.themeColor || '#C8102E').replace('#', '');
  const lightColorHex = getLightHex(themeColor);

  const headers = [
    'TÊN NHÂN VIÊN', 'VAI TRÒ', 'LOẠI HĐ',
    'TỔNG GIỜ', 'GIỜ CHUẨN', 'LƯƠNG CƠ BẢN', 'SỐ CA CHỞ HÀNG', 'PHỤ CẤP CHỞ', 'SỐ CA GIAO', 'PHỤ CẤP GIAO', 'ĐÃ TẠM ỨNG', 'LƯƠNG THỰC NHẬN',
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
        
        const inRange = (options?.startDate && options?.endDate)
          ? (date >= options.startDate && date <= options.endDate)
          : (date.getFullYear() === Number(yearStr) && date.getMonth() + 1 === Number(monthStr));
          
        if (inRange) {
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

    let totalAdvance = advances
      .filter(a => a.userId === member.userId && a.status === 'approved')
      .reduce((sum, a) => sum + a.amount, 0);

    const netSalary = calculatedSalary - totalAdvance;

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
      `${totalAdvance.toLocaleString('vi-VN')} vnđ`,
      `${Math.round(netSalary).toLocaleString('vi-VN')} vnđ`,
    ];
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lương Tháng');

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${themeColor}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  
  rows.forEach(r => {
    const row = sheet.addRow(r);
    row.eachCell((cell, colNumber) => {
      if (colNumber > 3) {
        cell.alignment = { horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightColorHex } };
      }
    });
  });

  sheet.columns = [
    { width: 22 }, { width: 12 }, { width: 16 }, { width: 10 }, { width: 10 },
    { width: 16 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 20 }
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `BaoCaoLuong_${options?.startDate ? 'Filter' : month}.xlsx`);
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
