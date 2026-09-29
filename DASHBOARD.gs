// ============================================================
// UIT PAYSHEET — DASHBOARD.gs
// COMPLETELY SEPARATE FILE — paste as new file in Apps Script
// Reads from CONS SUMMARY + CLOSING BALANCES sheets
// Run refreshDashboard() to update
// ============================================================

var DASH = {
  SHEET    : 'DASHBOARD',
  SUMMARY  : 'CONS SUMMARY',
  CLOSING  : 'CLOSING BALANCES'
};

// ── COLORS (hex only — no CSS vars in Sheets) ────────────────
var DC = {
  NAVY     : '#1F4E79',
  WHITE    : '#FFFFFF',
  GRN_BG   : '#C6EFCE', GRN_TX  : '#006100',
  RED_BG   : '#FFC7CE', RED_TX  : '#9C0006',
  YEL_BG   : '#FFEB9C', YEL_TX  : '#9C6500',
  BLUE_BG  : '#DDEEFF', BLUE_TX : '#1F4E79',
  SEP_BG   : '#D6E4F0',
  ALT      : '#F2F7FB',
  GREY_BG  : '#F5F5F5',
  ORANGE   : '#FF6600',
  PROFIT   : '#1D9E75',
  LOSS     : '#D85A30'
};

// ── MAIN FUNCTION ────────────────────────────────────────────
function refreshDashboard() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  try {
    ss.toast('Reading data...', 'Dashboard', 3);

    // Read CONS SUMMARY
    var sumWs = ss.getSheetByName(DASH.SUMMARY);
    if (!sumWs) { ui.alert('CONS SUMMARY sheet not found. Run Update Cons Summary first.'); return; }

    // Read CLOSING BALANCES
    var clsWs = ss.getSheetByName(DASH.CLOSING);
    if (!clsWs) { ui.alert('CLOSING BALANCES sheet not found. Run Update Closing Balances first.'); return; }

    // Parse data
    var monthlyData = parseConsSummary(sumWs);
    var balanceData = parseClosingBalances(clsWs);

    if (!monthlyData.months.length) {
      ui.alert('No data found in CONS SUMMARY. Run Update Cons Summary first.');
      return;
    }

    // Get or create dashboard sheet
    var ws = ss.getSheetByName(DASH.SHEET);
    if (!ws) { ws = ss.insertSheet(DASH.SHEET); }
    ws.clear();
    ws.clearFormats();

    // Set sheet properties
    ws.setTabColor('#1F4E79');
    ss.setActiveSheet(ws);

    // Build dashboard
    ss.toast('Building dashboard...', 'Dashboard', 5);
    var row = buildDashboard(ws, monthlyData, balanceData);

    ss.toast('✅ Dashboard refreshed!', 'Dashboard', 4);

  } catch(err) {
    ui.alert('❌ Error:\n\n' + err.message);
    Logger.log(err.stack);
  }
}

// ── PARSE CONS SUMMARY ───────────────────────────────────────
function parseConsSummary(ws) {
  var lr = ws.getLastRow();
  if (lr < 2) return { months:[], rows:[] };
  var data = ws.getRange(2, 1, lr-1, 13).getValues();

  var months    = {};
  var monthRows = {};

  for (var i=0; i<data.length; i++) {
    var mo      = (data[i][1]||'').toString().trim(); // col B = MONTH
    var empId   = (data[i][2]||'').toString().trim(); // col C = EMP ID
    var name    = (data[i][3]||'').toString().trim(); // col D = NAME
    var status  = (data[i][4]||'').toString().trim(); // col E = STATUS
    var hours   = parseFloat(data[i][6])  ||0;        // col G
    var bill    = parseFloat(data[i][7])  ||0;        // col H
    var revenue = parseFloat(data[i][8])  ||0;        // col I
    var payRate = parseFloat(data[i][9])  ||0;        // col J
    var gpay    = parseFloat(data[i][10]) ||0;        // col K
    var erTax   = parseFloat(data[i][11]) ||0;        // col L
    var profit  = parseFloat(data[i][12]) ||0;        // col M

    if (!mo || !empId) continue;
    if (mo.indexOf('TOTAL') > -1) continue;

    if (!months[mo]) {
      months[mo] = true;
      monthRows[mo] = { month:mo, revenue:0, gpay:0, erTax:0, profit:0, hours:0, employees:0 };
    }
    monthRows[mo].revenue   += revenue;
    monthRows[mo].gpay      += gpay;
    monthRows[mo].erTax     += erTax;
    monthRows[mo].profit    += profit;
    monthRows[mo].hours     += hours;
    monthRows[mo].employees += 1;
  }

  // Sort months chronologically
  var sortedMonths = Object.keys(monthRows).sort(function(a,b){
    return monthToNum(a) - monthToNum(b);
  });

  return {
    months   : sortedMonths,
    rows     : monthRows
  };
}

// ── PARSE CLOSING BALANCES ───────────────────────────────────
function parseClosingBalances(ws) {
  var lr = ws.getLastRow();
  if (lr < 5) return { positive:0, negative:0, total:0, notDone:[], employees:[] };
  var data = ws.getRange(5, 1, lr-4, 6).getValues();

  var positive=0, negative=0, total=0;
  var notDone  = [];
  var employees = [];

  for (var i=0; i<data.length; i++) {
    var empId  = (data[i][1]||'').toString().trim(); // col B
    var name   = (data[i][2]||'').toString().trim(); // col C
    var status = (data[i][3]||'').toString().trim(); // col D
    var bal    = parseFloat(data[i][4]) ||0;         // col E
    var ps     = (data[i][5]||'').toString().trim(); // col F

    if (!empId || empId === 'TOTAL') continue;

    total += bal;
    if (bal >= 0) positive++;
    else negative++;

    employees.push({ empId:empId, name:name, status:status, balance:bal, payStatus:ps });

    if (ps === 'NOT DONE') {
      notDone.push({ empId:empId, name:name, balance:bal });
    }
  }

  return { positive:positive, negative:negative, total:total, notDone:notDone, employees:employees };
}

// ── BUILD DASHBOARD ───────────────────────────────────────────
function buildDashboard(ws, md, bd) {
  var row = 1;

  // Column widths
  var cols = [4,18,16,16,16,16,16,16,4];
  for (var c=0; c<cols.length; c++) {
    ws.setColumnWidth(c+1, cols[c]*8);
  }

  // ── HEADER ────────────────────────────────────────────────
  row = writeHeader(ws, row);
  row++;

  // ── KPI CARDS ─────────────────────────────────────────────
  row = writeKPICards(ws, row, md, bd);
  row += 2;

  // ── MONTHLY BREAKDOWN TABLE ───────────────────────────────
  row = writeMonthlyTable(ws, row, md);
  row += 2;

  // ── MONTH OVER MONTH COMPARISON ───────────────────────────
  row = writeMoMComparison(ws, row, md);
  row += 2;

  // ── BALANCE STATUS ────────────────────────────────────────
  row = writeBalanceStatus(ws, row, bd);
  row += 2;

  // ── NOT DONE PAYMENTS ─────────────────────────────────────
  row = writeNotDone(ws, row, bd);
  row += 2;

  // ── CHARTS ────────────────────────────────────────────────
  buildCharts(ws, md);

  return row;
}

// ── HEADER ───────────────────────────────────────────────────
function writeHeader(ws, row) {
  var now = new Date();
  var dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm');

  ws.getRange(row,1,1,9).merge()
    .setValue('UIT PAYSHEET — FINANCIAL DASHBOARD')
    .setBackground(DC.NAVY).setFontColor(DC.WHITE)
    .setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(row, 40);
  row++;

  ws.getRange(row,1,1,9).merge()
    .setValue('Last updated: ' + dateStr)
    .setBackground(DC.SEP_BG).setFontColor(DC.NAVY)
    .setFontSize(10).setHorizontalAlignment('center');
  ws.setRowHeight(row, 22);
  row++;

  return row;
}

// ── KPI CARDS ─────────────────────────────────────────────────
function writeKPICards(ws, row, md, bd) {
  // Calculate totals
  var totRevenue=0, totGPay=0, totErTax=0, totProfit=0, totHours=0;
  for (var m=0; m<md.months.length; m++) {
    var r = md.rows[md.months[m]];
    totRevenue += r.revenue;
    totGPay    += r.gpay;
    totErTax   += r.erTax;
    totProfit  += r.profit;
    totHours   += r.hours;
  }
  var margin = totRevenue > 0 ? (totProfit/totRevenue*100) : 0;
  var notDoneCount = bd.notDone.length;

  // Section title
  ws.getRange(row,1,1,9).merge()
    .setValue('OVERALL SUMMARY')
    .setBackground(DC.SEP_BG).setFontColor(DC.NAVY)
    .setFontSize(11).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  ws.getRange(row,1);
  ws.setRowHeight(row, 26);
  row++;

  // KPI label row
  var kpiLabels = ['','GROSS REVENUE','TOTAL G-PAY','ER TAX TOTAL','GROSS PROFIT','MARGIN %','TOTAL HOURS','NOT PAID',''];
  ws.getRange(row,1,1,9).setValues([kpiLabels]);
  for (var c=2; c<=8; c++) {
    ws.getRange(row,c)
      .setBackground(DC.NAVY).setFontColor(DC.WHITE)
      .setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('center');
  }
  ws.getRange(row,1).setBackground(DC.WHITE);
  ws.getRange(row,9).setBackground(DC.WHITE);
  ws.setRowHeight(row, 22);
  row++;

  // KPI value row
  var kpiVals = [
    '',
    fmtMoney(totRevenue),
    fmtMoney(totGPay),
    fmtMoney(totErTax),
    fmtMoney(totProfit),
    margin.toFixed(1) + '%',
    Math.round(totHours).toLocaleString(),
    notDoneCount + ' employees',
    ''
  ];
  ws.getRange(row,1,1,9).setValues([kpiVals]);
  ws.getRange(row,2).setBackground(DC.BLUE_BG).setFontColor(DC.BLUE_TX).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,3).setBackground(DC.ALT).setFontColor(DC.NAVY).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,4).setBackground(DC.YEL_BG).setFontColor(DC.YEL_TX).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  var profitBg = totProfit >= 0 ? DC.GRN_BG : DC.RED_BG;
  var profitTx = totProfit >= 0 ? DC.GRN_TX : DC.RED_TX;
  ws.getRange(row,5).setBackground(profitBg).setFontColor(profitTx).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  var marginBg = margin >= 15 ? DC.GRN_BG : margin >= 8 ? DC.YEL_BG : DC.RED_BG;
  var marginTx = margin >= 15 ? DC.GRN_TX : margin >= 8 ? DC.YEL_TX : DC.RED_TX;
  ws.getRange(row,6).setBackground(marginBg).setFontColor(marginTx).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,7).setBackground(DC.ALT).setFontColor(DC.NAVY).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  var notDoneBg = notDoneCount === 0 ? DC.GRN_BG : DC.RED_BG;
  var notDoneTx = notDoneCount === 0 ? DC.GRN_TX : DC.RED_TX;
  ws.getRange(row,8).setBackground(notDoneBg).setFontColor(notDoneTx).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,1).setBackground(DC.WHITE);
  ws.getRange(row,9).setBackground(DC.WHITE);
  ws.setRowHeight(row, 36);
  row++;

  return row;
}

// ── MONTHLY BREAKDOWN TABLE ───────────────────────────────────
function writeMonthlyTable(ws, row, md) {
  ws.getRange(row,1,1,9).merge()
    .setValue('MONTHLY BREAKDOWN')
    .setBackground(DC.SEP_BG).setFontColor(DC.NAVY)
    .setFontSize(11).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  ws.getRange(row,1);
  ws.setRowHeight(row, 26);
  row++;

  // Headers
  var hdrs = ['','MONTH','GROSS REVENUE','G-PAY','ER TAX',"GROSS PROFIT",'MARGIN %','HOURS',''];
  ws.getRange(row,1,1,9).setValues([hdrs]);
  for (var c=2; c<=8; c++) {
    ws.getRange(row,c)
      .setBackground(DC.NAVY).setFontColor(DC.WHITE)
      .setFontSize(9).setFontWeight('bold')
      .setHorizontalAlignment('center');
  }
  ws.getRange(row,1).setBackground(DC.WHITE);
  ws.getRange(row,9).setBackground(DC.WHITE);
  ws.setRowHeight(row, 22);
  row++;

  var prevProfit = null;
  for (var m=0; m<md.months.length; m++) {
    var mo = md.months[m];
    var r  = md.rows[mo];
    var margin = r.revenue > 0 ? (r.profit/r.revenue*100) : 0;
    var trend = '';
    if (prevProfit !== null) {
      trend = r.profit >= prevProfit ? ' ▲' : ' ▼';
    }

    var rowBg = m % 2 === 0 ? DC.WHITE : DC.ALT;
    ws.getRange(row,1).setBackground(DC.WHITE);
    ws.getRange(row,2).setValue(mo).setBackground(rowBg).setFontWeight('bold').setFontColor(DC.NAVY).setHorizontalAlignment('center');
    ws.getRange(row,3).setValue(r.revenue).setBackground(rowBg).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    ws.getRange(row,4).setValue(r.gpay).setBackground(rowBg).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    ws.getRange(row,5).setValue(r.erTax).setBackground(DC.YEL_BG).setFontColor(DC.YEL_TX).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    var profBg = r.profit >= 0 ? DC.GRN_BG : DC.RED_BG;
    var profTx = r.profit >= 0 ? DC.GRN_TX : DC.RED_TX;
    ws.getRange(row,6).setValue(r.profit + (trend ? trend*1 : 0)).setValue(r.profit).setBackground(profBg).setFontColor(profTx).setFontWeight('bold').setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    var marBg = margin >= 15 ? DC.GRN_BG : margin >= 8 ? DC.YEL_BG : DC.RED_BG;
    var marTx = margin >= 15 ? DC.GRN_TX : margin >= 8 ? DC.YEL_TX : DC.RED_TX;
    ws.getRange(row,7).setValue(margin/100).setBackground(marBg).setFontColor(marTx).setFontWeight('bold').setNumberFormat('0.0%').setHorizontalAlignment('center');
    ws.getRange(row,8).setValue(r.hours).setBackground(rowBg).setNumberFormat('#,##0').setHorizontalAlignment('center');
    ws.getRange(row,9).setBackground(DC.WHITE);
    ws.setRowHeight(row, 22);
    prevProfit = r.profit;
    row++;
  }

  // Total row
  var totR=0, totG=0, totE=0, totP=0, totH=0;
  for (var m=0; m<md.months.length; m++) {
    var r = md.rows[md.months[m]];
    totR+=r.revenue; totG+=r.gpay; totE+=r.erTax; totP+=r.profit; totH+=r.hours;
  }
  var totMargin = totR > 0 ? (totP/totR*100) : 0;
  ws.getRange(row,1).setBackground(DC.WHITE);
  ws.getRange(row,2).setValue('TOTAL').setBackground(DC.SEP_BG).setFontWeight('bold').setFontColor(DC.NAVY).setHorizontalAlignment('center').setFontSize(10);
  ws.getRange(row,3).setValue(totR).setBackground(DC.SEP_BG).setFontWeight('bold').setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
  ws.getRange(row,4).setValue(totG).setBackground(DC.SEP_BG).setFontWeight('bold').setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
  ws.getRange(row,5).setValue(totE).setBackground(DC.YEL_BG).setFontColor(DC.YEL_TX).setFontWeight('bold').setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
  ws.getRange(row,6).setValue(totP).setBackground(totP>=0?DC.GRN_BG:DC.RED_BG).setFontColor(totP>=0?DC.GRN_TX:DC.RED_TX).setFontWeight('bold').setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
  ws.getRange(row,7).setValue(totMargin/100).setBackground(DC.SEP_BG).setFontWeight('bold').setNumberFormat('0.0%').setHorizontalAlignment('center');
  ws.getRange(row,8).setValue(totH).setBackground(DC.SEP_BG).setFontWeight('bold').setNumberFormat('#,##0').setHorizontalAlignment('center');
  ws.getRange(row,9).setBackground(DC.WHITE);
  ws.setRowHeight(row, 24);
  row++;

  return row;
}

// ── MONTH OVER MONTH COMPARISON ───────────────────────────────
function writeMoMComparison(ws, row, md) {
  if (md.months.length < 2) return row;

  ws.getRange(row,1,1,9).merge()
    .setValue('MONTH OVER MONTH COMPARISON')
    .setBackground(DC.SEP_BG).setFontColor(DC.NAVY)
    .setFontSize(11).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  ws.getRange(row,1);
  ws.setRowHeight(row, 26);
  row++;

  var hdrs = ['','COMPARISON','REVENUE CHANGE','G-PAY CHANGE','PROFIT CHANGE','MARGIN CHANGE','','',''];
  ws.getRange(row,1,1,9).setValues([hdrs]);
  for (var c=2; c<=6; c++) {
    ws.getRange(row,c).setBackground(DC.NAVY).setFontColor(DC.WHITE).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  }
  ws.getRange(row,1).setBackground(DC.WHITE);
  for (var c=7;c<=9;c++) ws.getRange(row,c).setBackground(DC.WHITE);
  ws.setRowHeight(row, 22);
  row++;

  for (var m=1; m<md.months.length; m++) {
    var curr = md.rows[md.months[m]];
    var prev = md.rows[md.months[m-1]];
    var label = md.months[m-1] + ' → ' + md.months[m];

    var revChg  = curr.revenue - prev.revenue;
    var gpayChg = curr.gpay - prev.gpay;
    var profChg = curr.profit - prev.profit;
    var prevMar = prev.revenue > 0 ? prev.profit/prev.revenue*100 : 0;
    var currMar = curr.revenue > 0 ? curr.profit/curr.revenue*100 : 0;
    var marChg  = currMar - prevMar;

    var rowBg = m % 2 === 0 ? DC.WHITE : DC.ALT;
    ws.getRange(row,1).setBackground(DC.WHITE);
    ws.getRange(row,2).setValue(label).setBackground(rowBg).setFontWeight('bold').setFontColor(DC.NAVY).setHorizontalAlignment('center');

    var revBg = revChg >= 0 ? DC.GRN_BG : DC.RED_BG;
    var revTx = revChg >= 0 ? DC.GRN_TX : DC.RED_TX;
    ws.getRange(row,3).setValue((revChg>=0?'▲ ':' ▼ ')+fmtMoney(Math.abs(revChg))).setBackground(revBg).setFontColor(revTx).setFontWeight('bold').setHorizontalAlignment('center');

    var gpBg = gpayChg <= 0 ? DC.GRN_BG : DC.RED_BG;
    var gpTx = gpayChg <= 0 ? DC.GRN_TX : DC.RED_TX;
    ws.getRange(row,4).setValue((gpayChg>=0?'▲ ':' ▼ ')+fmtMoney(Math.abs(gpayChg))).setBackground(gpBg).setFontColor(gpTx).setFontWeight('bold').setHorizontalAlignment('center');

    var prBg = profChg >= 0 ? DC.GRN_BG : DC.RED_BG;
    var prTx = profChg >= 0 ? DC.GRN_TX : DC.RED_TX;
    ws.getRange(row,5).setValue((profChg>=0?'▲ ':' ▼ ')+fmtMoney(Math.abs(profChg))).setBackground(prBg).setFontColor(prTx).setFontWeight('bold').setHorizontalAlignment('center');

    var mBg = marChg >= 0 ? DC.GRN_BG : DC.RED_BG;
    var mTx = marChg >= 0 ? DC.GRN_TX : DC.RED_TX;
    ws.getRange(row,6).setValue((marChg>=0?'▲ ':' ▼ ')+Math.abs(marChg).toFixed(1)+'%').setBackground(mBg).setFontColor(mTx).setFontWeight('bold').setHorizontalAlignment('center');

    for (var c=7;c<=9;c++) ws.getRange(row,c).setBackground(DC.WHITE);
    ws.setRowHeight(row, 22);
    row++;
  }
  return row;
}

// ── BALANCE STATUS ────────────────────────────────────────────
function writeBalanceStatus(ws, row, bd) {
  ws.getRange(row,1,1,9).merge()
    .setValue('EMPLOYEE BALANCE STATUS')
    .setBackground(DC.SEP_BG).setFontColor(DC.NAVY)
    .setFontSize(11).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  ws.getRange(row,1);
  ws.setRowHeight(row, 26);
  row++;

  // Summary cards
  var total = bd.positive + bd.negative;
  ws.getRange(row,1).setBackground(DC.WHITE);
  ws.getRange(row,2,1,2).merge().setValue('POSITIVE BALANCE').setBackground(DC.GRN_BG).setFontColor(DC.GRN_TX).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,4,1,2).merge().setValue('NEGATIVE BALANCE').setBackground(DC.RED_BG).setFontColor(DC.RED_TX).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,6,1,2).merge().setValue('PAYMENT DONE').setBackground(DC.GRN_BG).setFontColor(DC.GRN_TX).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,8).setValue('NOT DONE').setBackground(DC.RED_BG).setFontColor(DC.RED_TX).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,9).setBackground(DC.WHITE);
  ws.setRowHeight(row, 20);
  row++;

  var doneCount = bd.employees.filter(function(e){ return e.payStatus==='DONE'; }).length;
  var notDoneCount = bd.notDone.length;

  ws.getRange(row,1).setBackground(DC.WHITE);
  ws.getRange(row,2,1,2).merge().setValue(bd.positive + ' employees').setBackground(DC.GRN_BG).setFontColor(DC.GRN_TX).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,4,1,2).merge().setValue(bd.negative + ' employees').setBackground(DC.RED_BG).setFontColor(DC.RED_TX).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,6,1,2).merge().setValue(doneCount + ' employees').setBackground(DC.GRN_BG).setFontColor(DC.GRN_TX).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,8).setValue(notDoneCount).setBackground(DC.RED_BG).setFontColor(DC.RED_TX).setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,9).setBackground(DC.WHITE);
  ws.setRowHeight(row, 36);
  row++;

  return row;
}

// ── NOT DONE PAYMENTS ─────────────────────────────────────────
function writeNotDone(ws, row, bd) {
  if (!bd.notDone.length) return row;

  ws.getRange(row,1,1,9).merge()
    .setValue('⚠ PENDING PAYMENTS — ' + bd.notDone.length + ' EMPLOYEES')
    .setBackground(DC.RED_BG).setFontColor(DC.RED_TX)
    .setFontSize(11).setFontWeight('bold')
    .setHorizontalAlignment('left').setVerticalAlignment('middle');
  ws.getRange(row,1);
  ws.setRowHeight(row, 26);
  row++;

  // Headers
  ws.getRange(row,1).setBackground(DC.WHITE);
  ws.getRange(row,2).setValue('S.NO').setBackground(DC.NAVY).setFontColor(DC.WHITE).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,3,1,3).merge().setValue('EMPLOYEE NAME').setBackground(DC.NAVY).setFontColor(DC.WHITE).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,6).setValue('EMP ID').setBackground(DC.NAVY).setFontColor(DC.WHITE).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,7).setValue('BALANCE').setBackground(DC.NAVY).setFontColor(DC.WHITE).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,8).setValue('STATUS').setBackground(DC.NAVY).setFontColor(DC.WHITE).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
  ws.getRange(row,9).setBackground(DC.WHITE);
  ws.setRowHeight(row, 22);
  row++;

  // Sort by balance (most negative first)
  var sorted = bd.notDone.slice().sort(function(a,b){ return a.balance-b.balance; });

  for (var i=0; i<sorted.length; i++) {
    var e = sorted[i];
    var bg = i%2===0 ? DC.WHITE : DC.ALT;
    ws.getRange(row,1).setBackground(DC.WHITE);
    ws.getRange(row,2).setValue(i+1).setBackground(bg).setHorizontalAlignment('center');
    ws.getRange(row,3,1,3).merge().setValue(e.name).setBackground(bg).setFontColor(DC.NAVY);
    ws.getRange(row,6).setValue(e.empId).setBackground(bg).setHorizontalAlignment('center').setFontColor(DC.NAVY);
    var balBg = e.balance < 0 ? DC.RED_BG : DC.GRN_BG;
    var balTx = e.balance < 0 ? DC.RED_TX : DC.GRN_TX;
    ws.getRange(row,7).setValue(e.balance).setBackground(balBg).setFontColor(balTx).setFontWeight('bold').setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    ws.getRange(row,8).setValue('NOT DONE').setBackground(DC.RED_BG).setFontColor(DC.RED_TX).setFontWeight('bold').setHorizontalAlignment('center').setFontSize(9);
    ws.getRange(row,9).setBackground(DC.WHITE);
    ws.setRowHeight(row, 20);
    row++;
  }
  return row;
}

// ── BUILD CHARTS ──────────────────────────────────────────────
function buildCharts(ws, md) {
  if (md.months.length === 0) return;

  // Find data rows for chart — monthly table starts around row 9
  // We use the CONS SUMMARY data directly via ranges
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sumWs = ss.getSheetByName(DASH.SUMMARY);
  if (!sumWs) return;

  // ── Chart 1: Revenue vs G-Pay vs Profit (stacked bar) ───────
  try {
    var chartData = [];
    var months = md.months;
    for (var m=0; m<months.length; m++) {
      var r = md.rows[months[m]];
      chartData.push([months[m], r.revenue, r.gpay, r.profit]);
    }

    // Build a data table in a temp hidden area of dashboard
    var dashWs = ss.getSheetByName(DASH.SHEET);
    var tempRow = 500; // far down the sheet — hidden area for chart data
    dashWs.getRange(tempRow,1).setValue('MONTH');
    dashWs.getRange(tempRow,2).setValue('Revenue');
    dashWs.getRange(tempRow,3).setValue('G-Pay');
    dashWs.getRange(tempRow,4).setValue('Profit');

    for (var m=0; m<chartData.length; m++) {
      dashWs.getRange(tempRow+1+m,1).setValue(chartData[m][0]);
      dashWs.getRange(tempRow+1+m,2).setValue(chartData[m][1]);
      dashWs.getRange(tempRow+1+m,3).setValue(chartData[m][2]);
      dashWs.getRange(tempRow+1+m,4).setValue(chartData[m][3]);
    }

    // Revenue vs GPay chart
    var chartRange1 = dashWs.getRange(tempRow, 1, chartData.length+1, 3);
    var chart1 = dashWs.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(chartRange1)
      .setPosition(5, 10, 0, 0)
      .setOption('title', 'Revenue vs G-Pay by Month')
      .setOption('titleTextStyle', {fontSize: 13, bold: true, color: '#1F4E79'})
      .setOption('width', 500)
      .setOption('height', 300)
      .setOption('colors', ['#378ADD','#1D9E75'])
      .setOption('legend', {position: 'bottom'})
      .setOption('vAxis', {format: '$#,##0', gridlines: {color: '#F0F0F0'}})
      .setOption('hAxis', {textStyle: {fontSize: 11}})
      .setOption('backgroundColor', '#FFFFFF')
      .build();
    dashWs.insertChart(chart1);

    // Profit trend chart
    var chartRange2 = dashWs.getRange(tempRow, 1, chartData.length+1, 1);
    var chartRange2b = dashWs.getRange(tempRow, 4, chartData.length+1, 1);
    var chart2 = dashWs.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(chartRange2)
      .addRange(chartRange2b)
      .setPosition(5, 15, 0, 0)
      .setOption('title', 'Monthly Profit Trend')
      .setOption('titleTextStyle', {fontSize: 13, bold: true, color: '#1F4E79'})
      .setOption('width', 500)
      .setOption('height', 300)
      .setOption('colors', ['#1D9E75'])
      .setOption('legend', {position: 'bottom'})
      .setOption('vAxis', {format: '$#,##0', gridlines: {color: '#F0F0F0'}})
      .setOption('hAxis', {textStyle: {fontSize: 11}})
      .setOption('curveType', 'function')
      .setOption('pointSize', 6)
      .setOption('backgroundColor', '#FFFFFF')
      .build();
    dashWs.insertChart(chart2);

  } catch(e) {
    Logger.log('Chart error: ' + e.message);
  }
}

// ── HELPERS ──────────────────────────────────────────────────
function fmtMoney(val) {
  if (!val || val === 0) return '$0.00';
  var abs = Math.abs(val);
  var sign = val < 0 ? '-' : '';
  if (abs >= 1000000) return sign + '$' + (abs/1000000).toFixed(2) + 'M';
  if (abs >= 1000)    return sign + '$' + (abs/1000).toFixed(1) + 'K';
  return sign + '$' + abs.toFixed(2);
}

function monthToNum(m) {
  var mi = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
  var p = m.match(/([A-Z]{3})'(\d{4})/);
  return p ? parseInt(p[2])*100+(mi[p[1]]||0) : 0;
}
