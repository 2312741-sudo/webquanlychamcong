import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Member, AttendanceRecord, ScheduleModel, Store, ShiftDefinition, DaySchedule, AdvanceRequest, ProductionReport, ProductionTask } from './types';

const DAY_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Chủ',
  manager1: 'Quản lý 1',
  manager: 'Quản lý 1',
  manager2: 'Quản lý 2',
  employee: 'Nhân viên',
};

/**
 * Sanitize tên file: bỏ dấu tiếng Việt, thay khoảng trắng bằng _, bỏ ký tự đặc biệt
 */
export function sanitize(input: string): string {
  if (!input) return '';
  const vietMap: Record<string, string> = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
    'đ': 'd',
    'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A',
    'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A',
    'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
    'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E',
    'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
    'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
    'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O',
    'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O',
    'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
    'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U',
    'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
    'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
    'Đ': 'D',
  };
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    result += vietMap[char] ?? char;
  }
  return result
    .replace(/[^a-zA-Z0-9\s_\-]/g, '')
    .replace(/\s+/g, '_');
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

// ─── 1. Xuất Bảng Công ────────────────────────────────────────────────────────

export async function exportMonthlyAttendance(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
  store: Store,
  schedules: ScheduleModel[],
  options?: { startDate?: Date; endDate?: Date; memberName?: string }
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Bảng Công');

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${themeColor}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  members.forEach(member => {
    const memberAtts = attendances.filter(a => a.userId === member.userId);
    let totalHours = 0;
    
    const dayValues: number[] = [];
    daysArray.forEach(d => {
      const att = memberAtts.find(a => a.date === d.dateStr);
      const h = att?.totalHours ?? 0;
      totalHours += h;
      dayValues.push(h);
    });

    const rowData: (string | number)[] = [
      member.name, 
      ROLE_LABELS[member.role] || member.role, 
      totalHours,
      ...dayValues
    ];

    const row = sheet.addRow(rowData);

    // Styling
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Total hours numeric formatting
    const totalCell = row.getCell(3);
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell.numFmt = '0.0';

    // Day cells
    dayValues.forEach((hours, idx) => {
      const cell = row.getCell(idx + 4);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.numFmt = '0.0';
      if (hours > 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightColorHex } };
      }
    });
  });

  sheet.getColumn(1).width = 25;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 12;
  for (let i = 4; i <= daysArray.length + 3; i++) {
    sheet.getColumn(i).width = 10;
  }

  // Filename formatting
  const storePart = sanitize(store.name);
  let timePart = '';
  if (options?.startDate && options?.endDate) {
    const startStr = `${String(options.startDate.getDate()).padStart(2, '0')}.${String(options.startDate.getMonth() + 1).padStart(2, '0')}`;
    const endStr = `${String(options.endDate.getDate()).padStart(2, '0')}.${String(options.endDate.getMonth() + 1).padStart(2, '0')}.${options.endDate.getFullYear()}`;
    timePart = `${startStr}-${endStr}`;
  } else {
    const [y, m] = month.split('-');
    timePart = `T${m}-${y}`;
  }
  const memberPart = options?.memberName ? `_${sanitize(options.memberName)}` : '';
  const fileName = `BangCong_${storePart}_${timePart}${memberPart}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
}

// ─── 2. Xuất Chi Tiết IN/OUT ──────────────────────────────────────────────────

export async function exportDetailedInOut(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
  store?: Store,
  options?: { startDate?: Date; endDate?: Date; memberName?: string }
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

  // Filename formatting
  const storePart = sanitize(store?.name || '');
  let timePart = '';
  if (options?.startDate && options?.endDate) {
    const startStr = `${String(options.startDate.getDate()).padStart(2, '0')}.${String(options.startDate.getMonth() + 1).padStart(2, '0')}`;
    const endStr = `${String(options.endDate.getDate()).padStart(2, '0')}.${String(options.endDate.getMonth() + 1).padStart(2, '0')}.${options.endDate.getFullYear()}`;
    timePart = `${startStr}-${endStr}`;
  } else {
    const [y, m] = month.split('-');
    timePart = `T${m}-${y}`;
  }
  const memberPart = options?.memberName ? `_${sanitize(options.memberName)}` : '';
  const fileName = `ChiTietInOut_${storePart}_${timePart}${memberPart}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
}

// ─── 3. Xuất Báo Cáo Lương ────────────────────────────────────────────────────

export async function exportMonthlySalary(
  members: Member[],
  attendances: AttendanceRecord[],
  month: string,
  store: Store,
  schedules: ScheduleModel[],
  advances: AdvanceRequest[] = [],
  options?: { startDate?: Date; endDate?: Date; memberName?: string }
) {
  const themeColor = (store.themeColor || '#C8102E').replace('#', '');
  const lightColorHex = getLightHex(themeColor);

  const headers = [
    'TÊN NHÂN VIÊN', 'VAI TRÒ', 'LOẠI HĐ',
    'TỔNG GIỜ', 'GIỜ CHUẨN', 'LƯƠNG CƠ BẢN', 'SỐ CA CHỞ HÀNG', 'PHỤ CẤP CHỞ', 'SỐ CA GIAO', 'PHỤ CẤP GIAO', 'ĐÃ TẠM ỨNG', 'LƯƠNG THỰC NHẬN',
  ];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lương Tháng');

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${themeColor}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  members.forEach(member => {
    const memberAtts = attendances.filter(a => a.userId === member.userId);
    const totalHours = memberAtts.reduce((sum, a) => sum + (a.totalHours || 0), 0);
    const typeLabel = member.employeeType === 'fulltime' ? 'Toàn thời gian' : 'Bán thời gian';
    const standardHours = member.standardHoursPerMonth || 208;
    
    let calculatedSalary = 0;
    if (member.employeeType === 'fulltime') {
      calculatedSalary = member.baseMonthlySalary * (totalHours / standardHours);
    } else {
      calculatedSalary = totalHours * member.baseHourlyRate;
    }
    const baseSalary = member.employeeType === 'fulltime' ? member.baseMonthlySalary : member.baseHourlyRate;

    // Calculate delivery counts
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
          const shiftVal = userShifts[dayKey as keyof typeof userShifts] || [];
          const arr = Array.isArray(shiftVal) ? shiftVal : (shiftVal === 'off' ? [] : [shiftVal as string]);
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

    const totalAdvance = advances
      .filter(a => a.userId === member.userId && a.status === 'approved')
      .reduce((sum, a) => sum + a.amount, 0);

    const netSalary = calculatedSalary - totalAdvance;

    // Numeric row data
    const rowData: (string | number)[] = [
      member.name,
      ROLE_LABELS[member.role] || member.role,
      typeLabel,
      totalHours,
      standardHours,
      baseSalary,
      deliveryCount,
      deliveryPay,
      giaoHangCount,
      giaoHangPay,
      totalAdvance,
      Math.round(netSalary),
    ];

    const row = sheet.addRow(rowData);

    // Styling & Number Formatting
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    // Format numbers
    const numFormats = [
      '0.0',       // Col 4: TỔNG GIỜ
      '0',         // Col 5: GIỜ CHUẨN
      '#,##0',     // Col 6: LƯƠNG CƠ BẢN
      '0',         // Col 7: SỐ CA CHỞ
      '#,##0',     // Col 8: PHỤ CẤP CHỞ
      '0',         // Col 9: SỐ CA GIAO
      '#,##0',     // Col 10: PHỤ CẤP GIAO
      '#,##0',     // Col 11: ĐÃ TẠM ỨNG
      '#,##0',     // Col 12: LƯƠNG THỰC NHẬN
    ];

    for (let c = 0; c < numFormats.length; c++) {
      const cell = row.getCell(c + 4);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.numFmt = numFormats[c];
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightColorHex } };
    }
  });

  sheet.columns = [
    { width: 25 }, { width: 14 }, { width: 18 }, { width: 12 }, { width: 12 },
    { width: 18 }, { width: 16 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 22 }
  ];

  // Filename formatting
  const storePart = sanitize(store.name);
  let timePart = '';
  if (options?.startDate && options?.endDate) {
    const startStr = `${String(options.startDate.getDate()).padStart(2, '0')}.${String(options.startDate.getMonth() + 1).padStart(2, '0')}`;
    const endStr = `${String(options.endDate.getDate()).padStart(2, '0')}.${String(options.endDate.getMonth() + 1).padStart(2, '0')}.${options.endDate.getFullYear()}`;
    timePart = `${startStr}-${endStr}`;
  } else {
    const [y, m] = month.split('-');
    timePart = `T${m}-${y}`;
  }
  const memberPart = options?.memberName ? `_${sanitize(options.memberName)}` : '';
  const fileName = `BaoCaoLuong_${storePart}_${timePart}${memberPart}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
}

// ─── 4. Xuất Lịch Làm Tuần ─────────────────────────────────────────────────────

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
  const themeColor = (store.themeColor || '#C8102E').replace('#', '');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lịch Làm');

  // Title Row
  const titleText = `CÔNG VIỆC THÁNG ${month} NĂM ${year} ${store.name.toUpperCase()}`;
  sheet.mergeCells('A1:AD1');
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
    const startCol = 2 + i * 4;
    
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

  let currentRow = 4;

  members.forEach(member => {
    const daySchedule = (schedule?.shifts[member.userId] || {}) as Partial<DaySchedule>;
    
    let maxShifts = 1;
    DAY_KEYS.forEach(key => {
      const shiftsForDay = daySchedule[key as keyof DaySchedule] || [];
      const arr = Array.isArray(shiftsForDay) ? shiftsForDay : (shiftsForDay === 'off' ? [] : [shiftsForDay]);
      const actualArr = arr.filter(id => id !== 'delivery' && id !== 'giaohang');
      if (actualArr.length > maxShifts) maxShifts = actualArr.length;
    });

    const startRow = currentRow;
    const endRow = currentRow + maxShifts - 1;

    if (maxShifts > 1) {
      sheet.mergeCells(`A${startRow}:A${endRow}`);
    }
    const nameCell = sheet.getCell(`A${startRow}`);
    nameCell.value = member.name.toUpperCase();
    nameCell.alignment = { vertical: 'middle', wrapText: true };
    nameCell.font = { bold: true };

    let totalHoursInWeek = 0;

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
            sheet.getCell(startRow + r, startCol).value = `${startH}:${startM}`;
            sheet.getCell(startRow + r, startCol + 1).value = `${endH}:${endM}`;
            const sNameCell = sheet.getCell(startRow + r, startCol + 2);
            sNameCell.value = shiftName;
            
            const durCell = sheet.getCell(startRow + r, startCol + 3);
            durCell.value = durationH;
            durCell.numFmt = '0.0';
            
            for(let c = 0; c < 4; c++) {
              const currentCell = sheet.getCell(startRow + r, startCol + c);
              currentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
              currentCell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            
            if (dept) {
              sNameCell.font = { bold: true };
            }
          }
        } else {
          sheet.getCell(startRow + r, startCol).value = '-';
          sheet.getCell(startRow + r, startCol + 1).value = '-';
          sheet.getCell(startRow + r, startCol + 2).value = '-';
          const emptyDurCell = sheet.getCell(startRow + r, startCol + 3);
          emptyDurCell.value = 0;
          emptyDurCell.numFmt = '0.0';
          for(let c = 0; c < 4; c++) {
            const currentCell = sheet.getCell(startRow + r, startCol + c);
            currentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
            currentCell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        }
      }
    }
    
    if (maxShifts > 1) {
      sheet.mergeCells(startRow, 30, endRow, 30);
    }
    const totalCell = sheet.getCell(startRow, 30);
    totalCell.value = totalHoursInWeek;
    totalCell.numFmt = '0.0';
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalCell.font = { bold: true };

    for (let r = startRow; r <= endRow; r++) {
      for (let c = 1; c <= 30; c++) {
        sheet.getCell(r, c).border = {
          top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
        };
      }
    }
    
    currentRow += maxShifts;
  });

  for (let c = 1; c <= 30; c++) {
    sheet.getCell(2, c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
    sheet.getCell(3, c).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
  }

  sheet.getColumn(1).width = 25;
  for (let i = 0; i < 7; i++) {
    const startCol = 2 + i * 4;
    sheet.getColumn(startCol).width = 7;
    sheet.getColumn(startCol + 1).width = 7;
    sheet.getColumn(startCol + 2).width = 6;
    sheet.getColumn(startCol + 3).width = 6;
  }
  sheet.getColumn(30).width = 15;

  // Filename formatting
  const storePart = sanitize(store.name);
  const storePrefix = storePart ? `${storePart}_` : '';
  const mondayStr = `${String(monday.getDate()).padStart(2, '0')}.${String(monday.getMonth() + 1).padStart(2, '0')}`;
  const sunday = days[6];
  const sundayStr = `${String(sunday.getDate()).padStart(2, '0')}.${String(sunday.getMonth() + 1).padStart(2, '0')}.${sunday.getFullYear()}`;
  const fileName = `LichLam_${storePrefix}Tuan_${mondayStr}-${sundayStr}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
}

// ─── 5. Xuất Báo Cáo Sản Xuất ────────────────────────────────────────────────

export async function exportProductionReport(
  reports: ProductionReport[],
  tasks: ProductionTask[],
  members: Member[],
  storeName: string,
  month: string // YYYY-MM
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Báo cáo sản xuất');

  const headerFill: ExcelJS.Fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFC8102E' },
  };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const subHeaderFill: ExcelJS.Fill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFFFF3CD' },
  };
  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' }, bottom: { style: 'thin' },
    left: { style: 'thin' }, right: { style: 'thin' },
  };

  const activeTasks = tasks.filter(t => t.active);

  // Title row
  sheet.mergeCells(1, 1, 1, 5 + activeTasks.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `BÁO CÁO HIỆU QUẢ SẢN XUẤT - ${storeName} - Tháng ${month}`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFC8102E' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 28;

  // Headers
  const headers = [
    'Ngày', 'Tên nhân viên', 'Ca làm',
    ...activeTasks.map(t => `${t.name}${t.unitLabel ? ` (${t.unitLabel})` : ''}`),
    'Giờ out ca', 'Ghi chú',
  ];

  const headerRow = sheet.getRow(2);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderStyle;
  });
  headerRow.height = 36;

  // Data rows
  const memberMap = new Map(members.map(m => [m.userId, m.name]));

  reports.forEach((report, idx) => {
    const row = sheet.getRow(3 + idx);

    let checkoutStr = '';
    if (report.checkoutTime) {
      try {
        const ts = report.checkoutTime.toDate ? report.checkoutTime.toDate() : new Date(report.checkoutTime);
        checkoutStr = ts.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
      } catch { checkoutStr = ''; }
    }

    const taskValues = activeTasks.map(task => {
      const entry = report.tasks?.find(t => t.taskId === task.id);
      return entry ? (typeof entry.value === 'number' ? entry.value : 0) : 0;
    });

    const rowData: (string | number)[] = [
      report.date,
      memberMap.get(report.userId) || report.memberName,
      report.shiftName,
      ...taskValues,
      checkoutStr,
      report.note || '',
    ];

    rowData.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val as any;
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', horizontal: i === 0 || i >= 3 + activeTasks.length ? 'center' : 'left' };
      
      // If task value column, set number format
      if (i >= 3 && i < 3 + activeTasks.length) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.numFmt = '#,##0.0';
      }

      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    });
    row.height = 22;
  });

  // Summary rows
  const summaryStartRow = 3 + reports.length + 1;
  const summaryTitle = sheet.getRow(summaryStartRow);
  sheet.mergeCells(summaryStartRow, 1, summaryStartRow, 5 + activeTasks.length);
  summaryTitle.getCell(1).value = 'TỔNG HỢP THEO NHÂN VIÊN';
  summaryTitle.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1A6B5A' } };
  summaryTitle.getCell(1).fill = subHeaderFill;
  summaryTitle.height = 24;

  const summaryHeaderRow = sheet.getRow(summaryStartRow + 1);
  ['Tên nhân viên', 'Số ca báo cáo', ...activeTasks.map(t => `Tổng ${t.name}${t.unitLabel ? ` (${t.unitLabel})` : ''}`)].forEach((h, i) => {
    const cell = summaryHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.fill = subHeaderFill;
    cell.font = { bold: true, size: 10 };
    cell.border = borderStyle;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Group by member
  const memberSummary = new Map<string, { name: string; count: number; taskTotals: number[] }>();
  reports.forEach(report => {
    if (!memberSummary.has(report.userId)) {
      memberSummary.set(report.userId, {
        name: memberMap.get(report.userId) || report.memberName,
        count: 0,
        taskTotals: activeTasks.map(() => 0),
      });
    }
    const entry = memberSummary.get(report.userId)!;
    entry.count++;
    activeTasks.forEach((task, ti) => {
      const taskEntry = report.tasks?.find(t => t.taskId === task.id);
      if (taskEntry && typeof taskEntry.value === 'number') {
        entry.taskTotals[ti] += taskEntry.value;
      }
    });
  });

  let rowIdx = summaryStartRow + 2;
  memberSummary.forEach(({ name, count, taskTotals }) => {
    const row = sheet.getRow(rowIdx);
    const summaryData: (string | number)[] = [name, count, ...taskTotals];
    summaryData.forEach((val, i) => {
      const cell = row.getCell(i + 1);
      cell.value = val as any;
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'center' };
      if (i >= 1) {
        cell.numFmt = '#,##0.0';
      }
    });
    row.height = 20;
    rowIdx++;
  });

  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 16;
  activeTasks.forEach((_, i) => { sheet.getColumn(4 + i).width = 18; });
  sheet.getColumn(4 + activeTasks.length).width = 12;
  sheet.getColumn(5 + activeTasks.length).width = 24;

  // Filename formatting
  const storePart = sanitize(storeName);
  const [y, m] = month.split('-');
  const timePart = `T${m}-${y}`;
  const fileName = `BaoCaoSanXuat_${storePart}_${timePart}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), fileName);
}
