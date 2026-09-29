// ============================================================
// UIT PAYSHEET — C2C_SUMMARY.gs
// SEPARATE FILE — paste as new file in MASTER sheet Apps Script
// Adds "📋 Run C2C Summary" to UIT Paysheet menu
// Reads from MASTER sheet tabs directly — no cross-sheet needed
// ============================================================

var C2C = {
  SHEET       : 'C2C SUMMARY',
  CONSULTANTS : 'CONSULTANTS LIST',
  TIMESHEETS  : 'TIMESHEETS',
  RATES       : 'RATES'
};

var C2C_CLR = {
  NAVY    : '#1F4E79',
  WHITE   : '#FFFFFF',
  SEP_BG  : '#D6E4F0',
  SEP_TX  : '#1F4E79',
  TOT_BG  : '#BDD7EE',
  ALT     : '#F2F7FB',
  GRN_BG  : '#C6EFCE', GRN_TX : '#006100',
  RED_BG  : '#FFC7CE', RED_TX : '#9C0006',
  YEL_BG  : '#FFEB9C'
};

// ── MENU ─────────────────────────────────────────────────────
// This function adds to existing menu when file is loaded
function onOpen_C2C() {
  // Called separately — add menu item manually or use trigger
}

// Add C2C Summary button to menu
// Call this from your existing onOpen in MASTER sheet:
// .addItem('📋 Run C2C Summary', 'runC2CSummary')
function runC2CSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  try {
    // Select month
    var month = pickC2CMonth(ss, ui);
    if (!month) return;

    ss.toast('Reading C2C data for ' + month + '...', 'C2C Summary', 5);

    // Read data
    var consultants = readC2CConsultants(ss);
    var rates       = readC2CRates(ss);
    var timesheets  = readC2CTimesheets(ss, month);

    if (!Object.keys(consultants).length) {
      ui.alert('No C2C employees found in CONSULTANTS LIST.');
      return;
    }

    // Build summary
    ss.toast('Building C2C Summary for ' + month + '...', 'C2C Summary', 5);
    buildC2CSummary(ss, month, consultants, rates, timesheets);

    ss.toast('✅ C2C Summary updated for ' + month + '!', 'C2C Summary', 4);

  } catch(err) {
    ui.alert('❌ Error:\n\n' + err.message);
    Logger.log(err.stack);
  }
}

// ── MONTH PICKER ─────────────────────────────────────────────
function pickC2CMonth(ss, ui) {
  // Get months from TIMESHEETS
  var ws = ss.getSheetByName(C2C.TIMESHEETS);
  if (!ws) { ui.alert('TIMESHEETS sheet not found.'); return null; }
  var d = ws.getDataRange().getValues();
  var months = {}, MN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  for (var i=1; i<d.length; i++) {
    var mo = d[i][12]; // col M = MONTH
    if (!mo) continue;
    var nm = c2cNormMonth(mo);
    if (nm) months[nm] = true;
  }

  var sorted = Object.keys(months).sort(function(a,b){ return c2cMonthNum(a)-c2cMonthNum(b); });
  if (!sorted.length) { ui.alert('No months found in TIMESHEETS.'); return null; }

  var list = '';
  for (var j=0; j<sorted.length; j++) list += (j+1) + '.  ' + sorted[j] + '\n';

  var res = ui.prompt(
    '📋 Run C2C Summary',
    'Available months:\n\n' + list + '\nEnter number:',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return null;
  var num = parseInt(res.getResponseText().trim()) - 1;
  if (isNaN(num) || num < 0 || num >= sorted.length) { ui.alert('Invalid number.'); return null; }
  return sorted[num];
}

// ── DATA READERS ─────────────────────────────────────────────

// Read C2C + C2C-P employees from CONSULTANTS LIST
// B=EMP CODE(idx1), C=NAME(idx2), D=STATUS(idx3)
function readC2CConsultants(ss) {
  var ws = ss.getSheetByName(C2C.CONSULTANTS);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var emp  = (d[i][1]||'').toString().trim(); // B = EMP CODE
    var name = (d[i][2]||'').toString().trim(); // C = NAME
    var st   = (d[i][3]||'').toString().trim(); // D = STATUS
    if (!emp) continue;
    var stUp = st.toUpperCase();
    if (stUp !== 'C2C' && stUp !== 'C2C-P') continue; // only C2C types
    r[emp] = { empId:emp, name:name, status:st };
  }
  return r;
}

// Read rates from RATES sheet
// B=EMP CODE(idx1), F=DEPT(idx5), G=BILL RATE(idx6), K=C2C RATE(idx10)
function readC2CRates(ss) {
  var ws = ss.getSheetByName(C2C.RATES);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var emp = (d[i][1]||'').toString().trim(); // B = EMP CODE
    if (!emp || r[emp]) continue;
    r[emp] = {
      bill    : parseFloat(d[i][6])  || 0, // G = BILL RATE
      c2cRate : parseFloat(d[i][10]) || 0, // K = C2C RATE
      dept    : (d[i][5]||'').toString().trim() // F = DEPT
    };
  }
  return r;
}

// Read timesheets for specific month
// A=EMP ID(idx0), J=TOTAL(idx9), M=MONTH(idx12)
function readC2CTimesheets(ss, month) {
  var ws = ss.getSheetByName(C2C.TIMESHEETS);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var emp = (d[i][0]||'').toString().trim(); // A = EMP ID
    var tot = d[i][9];  // J = TOTAL
    var mo  = d[i][12]; // M = MONTH
    if (!emp || !mo) continue;
    if (c2cNormMonth(mo) !== month) continue;
    r[emp] = (parseFloat(tot)||0);
  }
  return r;
}

// ── BUILD C2C SUMMARY ─────────────────────────────────────────
function buildC2CSummary(ss, month, consultants, rates, timesheets) {
  var ws = ss.getSheetByName(C2C.SHEET);
  if (!ws) {
    ws = ss.insertSheet(C2C.SHEET);
    setupC2CHeader(ws);
  }

  // Delete existing month section if present → rewrite fresh
  if (c2cMonthExists(ws, month)) deleteC2CMonth(ws, month);

  // Find insert position — after last used row
  var row = ws.getLastRow() + 2;
  if (row < 3) row = 3;

  // Month separator
  ws.getRange(row,1,1,11).merge()
    .setValue('━━━━━━  ' + month + '  ━━━━━━')
    .setBackground(C2C_CLR.SEP_BG).setFontColor(C2C_CLR.SEP_TX)
    .setFontWeight('bold').setFontSize(12)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(row, 28);
  row++;

  // Column headers
  var hdrs = ['S NO','MONTH','EMP ID','NAME','STATUS','TEAM','HOURS','BILL RATE','GROSS REVENUE','C2C RATE','G-PAY','GROSS PROFIT'];
  ws.getRange(row,1,1,12).setValues([hdrs])
    .setBackground(C2C_CLR.NAVY).setFontColor(C2C_CLR.WHITE)
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(row, 24);
  row++;

  var dataStart = row;
  var sno = 1;
  var totHours=0, totRevenue=0, totGPay=0, totProfit=0;

  // Sort: C2C first then C2C-P, then alphabetical within each
  var empIds = Object.keys(consultants).sort(function(a,b){
    var sa = consultants[a].status.toUpperCase();
    var sb = consultants[b].status.toUpperCase();
    if (sa !== sb) {
      if (sa === 'C2C') return -1;
      if (sb === 'C2C') return 1;
    }
    return consultants[a].name.localeCompare(consultants[b].name);
  });

  for (var e=0; e<empIds.length; e++) {
    var emp  = consultants[empIds[e]];
    var rate = rates[emp.empId] || { bill:0, c2cRate:0, dept:'' };
    var hrs  = timesheets[emp.empId] || 0;

    // Skip if no hours for this month
    if (hrs === 0) continue;

    var revenue = hrs * rate.bill;
    var gpay    = hrs * rate.c2cRate;
    var profit  = revenue - gpay;

    totHours   += hrs;
    totRevenue += revenue;
    totGPay    += gpay;
    totProfit  += profit;

    var bg = sno%2===0 ? C2C_CLR.ALT : C2C_CLR.WHITE;

    ws.getRange(row,1).setValue(sno).setBackground(bg).setHorizontalAlignment('center');
    ws.getRange(row,2).setValue(month).setBackground(bg).setHorizontalAlignment('center');
    ws.getRange(row,3).setValue(emp.empId).setBackground(bg).setHorizontalAlignment('center').setFontWeight('bold').setFontColor(C2C_CLR.NAVY);
    ws.getRange(row,4).setValue(emp.name).setBackground(bg);
    ws.getRange(row,5).setValue(emp.status).setBackground(bg).setHorizontalAlignment('center');
    ws.getRange(row,6).setValue(rate.dept).setBackground(bg).setHorizontalAlignment('center');
    ws.getRange(row,7).setValue(hrs).setBackground(bg).setNumberFormat('#,##0').setHorizontalAlignment('center');
    ws.getRange(row,8).setValue(rate.bill).setBackground(bg).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    ws.getRange(row,9).setValue(revenue).setBackground(bg).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    ws.getRange(row,10).setValue(rate.c2cRate).setBackground(bg).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
    ws.getRange(row,11).setValue(gpay).setBackground(bg).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');

    // Profit — green if positive, red if negative
    var pc = ws.getRange(row,12);
    pc.setValue(profit).setNumberFormat('$#,##0.00').setFontWeight('bold').setHorizontalAlignment('right');
    if (profit > 0) pc.setBackground(C2C_CLR.GRN_BG).setFontColor(C2C_CLR.GRN_TX);
    else if (profit < 0) pc.setBackground(C2C_CLR.RED_BG).setFontColor(C2C_CLR.RED_TX);
    else pc.setBackground(bg);

    ws.setRowHeight(row, 20);
    row++; sno++;
  }

  // Total row
  ws.getRange(row,1,1,12).setBackground(C2C_CLR.TOT_BG).setFontWeight('bold');
  ws.getRange(row,4).setValue('TOTAL — ' + month).setFontSize(11).setFontColor(C2C_CLR.NAVY);
  ws.getRange(row,7).setValue(totHours).setNumberFormat('#,##0').setHorizontalAlignment('center');
  ws.getRange(row,9).setValue(totRevenue).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');
  ws.getRange(row,11).setValue(totGPay).setNumberFormat('$#,##0.00').setHorizontalAlignment('right');

  var tc = ws.getRange(row,12);
  tc.setValue(totProfit).setNumberFormat('$#,##0.00').setFontWeight('bold').setFontSize(11).setHorizontalAlignment('right');
  if (totProfit > 0) tc.setFontColor(C2C_CLR.GRN_TX);
  else if (totProfit < 0) tc.setFontColor(C2C_CLR.RED_TX);
  ws.setRowHeight(row, 26);
}

// ── HEADER SETUP ─────────────────────────────────────────────
function setupC2CHeader(ws) {
  // Title
  ws.getRange('A1:L1').merge()
    .setValue('C2C CONSULTANT SUMMARY')
    .setBackground(C2C_CLR.NAVY).setFontColor(C2C_CLR.WHITE)
    .setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(1, 36);

  // Column widths
  var w = [50,90,90,220,90,90,70,90,120,90,110,120];
  for (var i=0; i<w.length; i++) ws.setColumnWidth(i+1, w[i]);

  ws.setFrozenRows(1);
}

// ── HELPERS ──────────────────────────────────────────────────
function c2cNormMonth(raw) {
  if (!raw) return '';
  var MN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  if (raw instanceof Date) return MN[raw.getMonth()] + "'" + raw.getFullYear();
  var s = raw.toString().trim().toUpperCase().replace(/\s/g,'');
  var m = s.match(/^([A-Z]{3,9})'?(\d{4})$/);
  if (m) {
    // Handle full month names
    var mon = m[1].substring(0,3);
    if (MN.indexOf(mon) >= 0) return mon + "'" + m[2];
  }
  return '';
}

function c2cMonthNum(m) {
  var mi = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
  var p = m.match(/([A-Z]{3})'(\d{4})/);
  return p ? parseInt(p[2])*100+(mi[p[1]]||0) : 0;
}

function c2cMonthExists(ws, month) {
  var lr = ws.getLastRow(); if (lr < 2) return false;
  var vals = ws.getRange(1,1,lr,1).getValues();
  for (var i=0; i<vals.length; i++) {
    if ((vals[i][0]||'').toString().toUpperCase().indexOf(month.toUpperCase()) >= 0) return true;
  }
  return false;
}

function deleteC2CMonth(ws, month) {
  var lr = ws.getLastRow(); if (lr < 2) return;
  var vals = ws.getRange(1,1,lr,1).getValues();
  var first=-1, last=-1, mo=month.toUpperCase();
  for (var i=0; i<vals.length; i++) {
    if ((vals[i][0]||'').toString().toUpperCase().indexOf(mo) >= 0) {
      if (first===-1) first=i+1;
      last=i+1;
    }
  }
  if (first===-1) return;
  var delStart = Math.max(2, first-1);
  var delCount = last - delStart + 3;
  ws.deleteRows(delStart, delCount);
}
