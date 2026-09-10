// lib/performanceExportExcel.ts
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  PerformanceReport,
  Measurement,
  formatSecondsToMMSS,
  parseFirestoreTimestamp
} from './performanceTypes';

const NAVY = '1C4E6B';
const RED = 'CB2D2E';
const LIGHT_BG = 'F8F4EE';
const BORDER_COLOR = 'E0DAD4';

function styleHeaderRow(row: ExcelJS.Row, bgColor: string = NAVY) {
  row.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: bgColor }
  };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 28;
}

function applyCellBorders(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } },
  };
}

/**
 * Xuất file Excel chi tiết một ca đo (5 sheets: Tổng quan, Nước, Bánh, Đơn hàng, Sự cố & Checklist)
 */
export async function exportSessionPerformanceExcel(
  report: PerformanceReport,
  measurements: Measurement[]
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Trạm - Đo Hiệu Năng';
  wb.created = new Date();

  const started = parseFirestoreTimestamp(report.startedAt);
  const ended = parseFirestoreTimestamp(report.endedAt);
  const dateStr = started.toLocaleDateString('vi-VN');
  const timeRange = `${started.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${ended.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

  const drinkStd = report.standardSnapshot?.drinkStandardSeconds || 120;
  const cakeStd = report.standardSnapshot?.cakeStandardSeconds || 120;
  const orderStd = report.standardSnapshot?.orderStandardSeconds || 180;

  // ──────────────────────────────────────────
  // Sheet 1: TỔNG QUAN
  // ──────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Tổng Quan Ca Đo', {
    views: [{ showGridLines: true }]
  });

  wsSummary.columns = [
    { width: 6 },
    { width: 26 },
    { width: 35 },
    { width: 20 },
    { width: 20 }
  ];

  // Title
  wsSummary.mergeCells('B2:E2');
  const titleCell = wsSummary.getCell('B2');
  titleCell.value = 'BÁO CÁO ĐO HIỆU NĂNG CA LÀM VIỆC';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: RED } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsSummary.getRow(2).height = 35;

  wsSummary.mergeCells('B3:E3');
  const subTitleCell = wsSummary.getCell('B3');
  subTitleCell.value = `Cửa hàng: ${report.storeName}  |  Ngày: ${dateStr}  |  Thời gian: ${timeRange}`;
  subTitleCell.font = { name: 'Arial', size: 11, italic: true, color: { argb: '555555' } };
  subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Section 1: Personnel Info
  let r = 5;
  wsSummary.getCell(`B${r}`).value = 'THÔNG TIN NHÂN SỰ CA ĐO';
  wsSummary.getCell(`B${r}`).font = { bold: true, color: { argb: NAVY }, size: 12 };
  r++;

  const personnelData = [
    ['Quản lý đứng ca:', report.managerOnDutyName || 'Chưa cập nhật'],
    ['Quản lý tạo ca:', report.managerName || 'Chưa cập nhật'],
    ['Nhân sự trong ca:', report.employeeNames?.length ? report.employeeNames.join(', ') : 'Không có'],
    ['Trạng thái báo cáo:', report.status === 'viewed' ? 'Đã xem' : 'Chưa xem']
  ];

  personnelData.forEach(([label, val]) => {
    wsSummary.getCell(`B${r}`).value = label;
    wsSummary.getCell(`B${r}`).font = { bold: true };
    wsSummary.getCell(`C${r}`).value = val;
    applyCellBorders(wsSummary.getCell(`B${r}`));
    applyCellBorders(wsSummary.getCell(`C${r}`));
    r++;
  });

  // Section 2: Metrics Summary Table
  r += 2;
  wsSummary.getCell(`B${r}`).value = 'TỔNG HỢP CHỈ SỐ HIỆU NĂNG';
  wsSummary.getCell(`B${r}`).font = { bold: true, color: { argb: NAVY }, size: 12 };
  r++;

  const metricHeaderRow = wsSummary.getRow(r);
  metricHeaderRow.values = ['', 'Hạng mục đo', 'Số lượt đo / Số lượng', 'Thời gian TB', 'Tiêu chuẩn', 'Đánh giá'];
  styleHeaderRow(metricHeaderRow, NAVY);
  r++;

  const drinkStatus = report.drinkAverageSeconds <= drinkStd ? 'Đạt chuẩn' : `Vượt +${report.drinkAverageSeconds - drinkStd}s`;
  const cakeStatus = report.cakeAverageSeconds <= cakeStd ? 'Đạt chuẩn' : `Vượt +${report.cakeAverageSeconds - cakeStd}s`;
  const orderStatus = report.orderAverageSeconds <= orderStd ? 'Đạt chuẩn' : `Vượt +${report.orderAverageSeconds - orderStd}s`;

  const metricRows = [
    ['🥤 Nước', `${report.drinkMeasurementCount} lượt (${report.drinkTotalQuantity} ly)`, `${formatSecondsToMMSS(report.drinkAverageSeconds)} / ly`, `${formatSecondsToMMSS(drinkStd)} / ly`, drinkStatus],
    ['🍰 Bánh', `${report.cakeMeasurementCount} lượt (${report.cakeTotalQuantity} bánh)`, `${formatSecondsToMMSS(report.cakeAverageSeconds)} / bánh`, `${formatSecondsToMMSS(cakeStd)} / bánh`, cakeStatus],
    ['📦 Đơn hàng', `${report.orderCount} đơn hàng`, `${formatSecondsToMMSS(report.orderAverageSeconds)} / đơn`, `${formatSecondsToMMSS(orderStd)} / đơn`, orderStatus],
    ['⚠️ Sự cố trong ca', `${report.incidents?.length || 0} vụ việc`, '-', '-', (report.incidents?.length || 0) === 0 ? 'Tốt' : 'Cần lưu ý']
  ];

  metricRows.forEach((rowVals) => {
    const row = wsSummary.getRow(r);
    row.values = ['', ...rowVals];
    row.font = { name: 'Arial', size: 11 };
    row.height = 24;
    for (let c = 2; c <= 6; c++) {
      applyCellBorders(row.getCell(c));
    }
    r++;
  });

  // ──────────────────────────────────────────
  // Sheet 2: CHI TIẾT NƯỚC
  // ──────────────────────────────────────────
  const drinkMeasurements = measurements.filter((m) => m.category === 'drink');
  const wsDrinks = wb.addWorksheet('Chi Tiết Nước', { views: [{ showGridLines: true }] });
  wsDrinks.columns = [
    { width: 6 },
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Thời điểm đo', key: 'time', width: 18 },
    { header: 'Số lượng (ly)', key: 'quantity', width: 15 },
    { header: 'Tổng thời gian (s)', key: 'durationSec', width: 18 },
    { header: 'Thời gian (MM:SS)', key: 'durationFormatted', width: 20 },
    { header: 'TB / 1 Ly (s)', key: 'avgSec', width: 16 },
    { header: 'Tiêu chuẩn', key: 'std', width: 15 },
    { header: 'Kết quả', key: 'result', width: 18 }
  ];

  const drinkHeader = wsDrinks.getRow(1);
  styleHeaderRow(drinkHeader, NAVY);

  drinkMeasurements.forEach((m, idx) => {
    const startedM = parseFirestoreTimestamp(m.startedAt);
    const avgSec = m.quantity > 0 ? Math.round(m.durationSeconds / m.quantity) : m.durationSeconds;
    const isPass = avgSec <= drinkStd;
    const row = wsDrinks.addRow([
      '',
      idx + 1,
      startedM.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      m.quantity,
      m.durationSeconds,
      formatSecondsToMMSS(m.durationSeconds),
      avgSec,
      `${drinkStd}s`,
      isPass ? 'Đạt chuẩn' : `Vượt +${avgSec - drinkStd}s`
    ]);
    row.height = 22;
    for (let c = 2; c <= 9; c++) {
      applyCellBorders(row.getCell(c));
      if (c === 9) {
        row.getCell(c).font = { color: { argb: isPass ? '1A6B5A' : RED }, bold: true };
      }
    }
  });

  // ──────────────────────────────────────────
  // Sheet 3: CHI TIẾT BÁNH
  // ──────────────────────────────────────────
  const cakeMeasurements = measurements.filter((m) => m.category === 'cake');
  const wsCakes = wb.addWorksheet('Chi Tiết Bánh', { views: [{ showGridLines: true }] });
  wsCakes.columns = [
    { width: 6 },
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Thời điểm đo', key: 'time', width: 18 },
    { header: 'Số lượng (bánh)', key: 'quantity', width: 18 },
    { header: 'Tổng thời gian (s)', key: 'durationSec', width: 18 },
    { header: 'Thời gian (MM:SS)', key: 'durationFormatted', width: 20 },
    { header: 'TB / 1 Bánh (s)', key: 'avgSec', width: 16 },
    { header: 'Tiêu chuẩn', key: 'std', width: 15 },
    { header: 'Kết quả', key: 'result', width: 18 }
  ];

  const cakeHeader = wsCakes.getRow(1);
  styleHeaderRow(cakeHeader, NAVY);

  cakeMeasurements.forEach((m, idx) => {
    const startedM = parseFirestoreTimestamp(m.startedAt);
    const avgSec = m.quantity > 0 ? Math.round(m.durationSeconds / m.quantity) : m.durationSeconds;
    const isPass = avgSec <= cakeStd;
    const row = wsCakes.addRow([
      '',
      idx + 1,
      startedM.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      m.quantity,
      m.durationSeconds,
      formatSecondsToMMSS(m.durationSeconds),
      avgSec,
      `${cakeStd}s`,
      isPass ? 'Đạt chuẩn' : `Vượt +${avgSec - cakeStd}s`
    ]);
    row.height = 22;
    for (let c = 2; c <= 9; c++) {
      applyCellBorders(row.getCell(c));
      if (c === 9) {
        row.getCell(c).font = { color: { argb: isPass ? '1A6B5A' : RED }, bold: true };
      }
    }
  });

  // ──────────────────────────────────────────
  // Sheet 4: CHI TIẾT ĐƠN HÀNG
  // ──────────────────────────────────────────
  const orderMeasurements = measurements.filter((m) => m.category === 'order');
  const wsOrders = wb.addWorksheet('Chi Tiết Đơn Hàng', { views: [{ showGridLines: true }] });
  wsOrders.columns = [
    { width: 6 },
    { header: 'STT', key: 'stt', width: 8 },
    { header: 'Mã đơn / Nhãn', key: 'orderCode', width: 20 },
    { header: 'Thời điểm đo', key: 'time', width: 18 },
    { header: 'Thời gian đo (s)', key: 'durationSec', width: 18 },
    { header: 'Thời gian (MM:SS)', key: 'durationFormatted', width: 20 },
    { header: 'Tiêu chuẩn', key: 'std', width: 15 },
    { header: 'Kết quả', key: 'result', width: 18 }
  ];

  const orderHeader = wsOrders.getRow(1);
  styleHeaderRow(orderHeader, NAVY);

  orderMeasurements.forEach((m, idx) => {
    const startedM = parseFirestoreTimestamp(m.startedAt);
    const isPass = m.durationSeconds <= orderStd;
    const row = wsOrders.addRow([
      '',
      idx + 1,
      m.orderCode || `Đơn #${idx + 1}`,
      startedM.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      m.durationSeconds,
      formatSecondsToMMSS(m.durationSeconds),
      `${orderStd}s`,
      isPass ? 'Đạt chuẩn' : `Vượt +${m.durationSeconds - orderStd}s`
    ]);
    row.height = 22;
    for (let c = 2; c <= 8; c++) {
      applyCellBorders(row.getCell(c));
      if (c === 8) {
        row.getCell(c).font = { color: { argb: isPass ? '1A6B5A' : RED }, bold: true };
      }
    }
  });

  // ──────────────────────────────────────────
  // Sheet 5: SỰ CỐ & CHECKLIST
  // ──────────────────────────────────────────
  const wsIncidents = wb.addWorksheet('Sự Cố & Checklist', { views: [{ showGridLines: true }] });
  wsIncidents.columns = [
    { width: 6 },
    { width: 8 },
    { width: 24 },
    { width: 40 },
    { width: 20 },
    { width: 18 }
  ];

  // Incidents section
  wsIncidents.mergeCells('B2:F2');
  const incTitle = wsIncidents.getCell('B2');
  incTitle.value = 'DANH SÁCH SỰ CỐ PHÁT SINH TRONG CA';
  incTitle.font = { bold: true, size: 12, color: { argb: RED } };

  const incHeaderRow = wsIncidents.getRow(4);
  incHeaderRow.values = ['', 'STT', 'Phân loại', 'Mô tả sự cố', 'Nhân sự liên quan', 'Thời điểm'];
  styleHeaderRow(incHeaderRow, RED);

  let curRow = 5;
  if (!report.incidents || report.incidents.length === 0) {
    const emptyRow = wsIncidents.getRow(curRow);
    emptyRow.values = ['', '-', 'Không có', 'Ca làm việc không phát sinh sự cố', '-', '-'];
    for (let c = 2; c <= 6; c++) applyCellBorders(emptyRow.getCell(c));
    curRow++;
  } else {
    report.incidents.forEach((inc, idx) => {
      const incTime = parseFirestoreTimestamp(inc.timestamp);
      const row = wsIncidents.getRow(curRow);
      row.values = [
        '',
        idx + 1,
        inc.category || 'Khác',
        inc.description || '',
        inc.staffName || inc.reportedBy || '-',
        incTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      ];
      for (let c = 2; c <= 6; c++) applyCellBorders(row.getCell(c));
      curRow++;
    });
  }

  // End-session form checklist section
  curRow += 3;
  wsIncidents.mergeCells(`B${curRow}:D${curRow}`);
  const chkTitle = wsIncidents.getCell(`B${curRow}`);
  chkTitle.value = 'KẾT QUẢ CHECKLIST / KHẢO SÁT CUỐI CA';
  chkTitle.font = { bold: true, size: 12, color: { argb: NAVY } };
  curRow += 2;

  const chkHeader = wsIncidents.getRow(curRow);
  chkHeader.values = ['', 'STT', 'Tiêu chí đánh giá', 'Kết quả thực tế / Phản hồi'];
  styleHeaderRow(chkHeader, NAVY);
  curRow++;

  const responses = Object.entries(report.formResponses || {});
  if (responses.length === 0) {
    const emptyForm = wsIncidents.getRow(curRow);
    emptyForm.values = ['', '-', 'Không có câu hỏi bổ sung', '-'];
    for (let c = 2; c <= 4; c++) applyCellBorders(emptyForm.getCell(c));
  } else {
    responses.forEach(([k, v], idx) => {
      const row = wsIncidents.getRow(curRow);
      let valStr = String(v);
      if (typeof v === 'boolean') valStr = v ? '✅ Đạt / Có' : '❌ Chưa đạt / Không';
      row.values = ['', idx + 1, k, valStr];
      for (let c = 2; c <= 4; c++) applyCellBorders(row.getCell(c));
      curRow++;
    });
  }

  // Generate and save file
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const cleanStoreName = (report.storeName || 'Tram').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `BaoCao_HieuNang_${cleanStoreName}_${dateStr.replace(/\//g, '-')}.xlsx`;
  saveAs(blob, filename);
}

/**
 * Xuất file Excel tổng hợp danh sách nhiều ca đo
 */
export async function exportConsolidatedPerformanceReports(
  reports: PerformanceReport[],
  storeLabel: string,
  dateRangeLabel: string
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Trạm - Đo Hiệu Năng';
  wb.created = new Date();

  const ws = wb.addWorksheet('Danh Sách Ca Đo', { views: [{ showGridLines: true }] });
  ws.columns = [
    { width: 5 },
    { header: 'STT', width: 6 },
    { header: 'Ngày ca', width: 14 },
    { header: 'Khung giờ', width: 16 },
    { header: 'Cửa hàng', width: 22 },
    { header: 'Quản lý đứng ca', width: 20 },
    { header: 'Nhân viên tham gia', width: 28 },
    { header: 'Nước (Ly)', width: 12 },
    { header: 'TB Nước (s)', width: 14 },
    { header: 'Bánh (Cái)', width: 12 },
    { header: 'TB Bánh (s)', width: 14 },
    { header: 'Đơn hàng', width: 12 },
    { header: 'TB Đơn (s)', width: 14 },
    { header: 'Sự cố', width: 10 },
    { header: 'Trạng thái', width: 14 }
  ];

  // Title
  ws.spliceRows(1, 0, []);
  ws.spliceRows(1, 0, []);
  ws.mergeCells('B1:O1');
  const title = ws.getCell('B1');
  title.value = `BÁO CÁO TỔNG HỢP HIỆU NĂNG - ${storeLabel.toUpperCase()}`;
  title.font = { name: 'Arial', size: 14, bold: true, color: { argb: RED } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('B2:O2');
  const sub = ws.getCell('B2');
  sub.value = `Khoảng thời gian: ${dateRangeLabel}  |  Tổng số ca: ${reports.length}`;
  sub.font = { italic: true, size: 11, color: { argb: '666666' } };
  sub.alignment = { horizontal: 'center', vertical: 'middle' };

  const headerRow = ws.getRow(4);
  styleHeaderRow(headerRow, NAVY);

  reports.forEach((rep, idx) => {
    const started = parseFirestoreTimestamp(rep.startedAt);
    const ended = parseFirestoreTimestamp(rep.endedAt);
    const row = ws.addRow([
      '',
      idx + 1,
      started.toLocaleDateString('vi-VN'),
      `${started.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${ended.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
      rep.storeName || '',
      rep.managerOnDutyName || rep.managerName || '',
      rep.employeeNames?.join(', ') || '',
      rep.drinkTotalQuantity,
      rep.drinkAverageSeconds ? `${rep.drinkAverageSeconds}s (${formatSecondsToMMSS(rep.drinkAverageSeconds)})` : '-',
      rep.cakeTotalQuantity,
      rep.cakeAverageSeconds ? `${rep.cakeAverageSeconds}s (${formatSecondsToMMSS(rep.cakeAverageSeconds)})` : '-',
      rep.orderCount,
      rep.orderAverageSeconds ? `${rep.orderAverageSeconds}s (${formatSecondsToMMSS(rep.orderAverageSeconds)})` : '-',
      rep.incidents?.length || 0,
      rep.status === 'viewed' ? 'Đã xem' : 'Chưa xem'
    ]);
    row.height = 24;
    for (let c = 2; c <= 15; c++) {
      applyCellBorders(row.getCell(c));
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `TongHop_HieuNang_${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, filename);
}
