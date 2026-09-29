// ============================================================
// UIT PAYSHEET — OUTPUT SHEET COMPLETE CODE
// ============================================================
// STEP 1: Paste your MASTER sheet ID below
// STEP 2: Extensions → Apps Script → paste → Save
// STEP 3: Refresh sheet → UIT Paysheet menu appears
// STEP 4: Click Setup first → then use buttons in order
// ============================================================

var MASTER_ID = 'YOUR_MASTER_SHEET_ID_HERE'; // See config/config.example.gs

// ── MASTER SHEET NAMES ──────────────────────────────────────
var M = {
  CONSULTANTS  : 'CONSULTANTS LIST',
  TIMESHEETS   : 'TIMESHEETS',
  RATES        : 'RATES',
  ADP_PAYROLL  : 'ADP-PAYROLL-SUM',
  AUTO_RETURN  : 'AUTO RETURN',
  BOA          : 'BANK1-YEAR',
  B1BANK       : 'BANK2-YEAR',
  GPB          : 'BANK3-YEAR',
  OP_BALANCES  : 'OP BALANCES',
  IMMI_FEES    : 'IMMI FEES',
  MED_INS      : 'MED INSURANCE'
};

// ── OUTPUT SHEET NAMES ──────────────────────────────────────
var O = {
  CLOSING : 'CLOSING BALANCES',
  SUMMARY : 'CONS SUMMARY',
  LOCKS   : 'MONTH LOCKS'
};

// ── COLORS ──────────────────────────────────────────────────
var C = {
  NAVY    : '#1F4E79', WHITE   : '#FFFFFF',
  GRN_BG  : '#C6EFCE', GRN_TX : '#006100',
  RED_BG  : '#FFC7CE', RED_TX : '#9C0006',
  BLUE_BG : '#E6F1FB', PURP_BG : '#EEEDFE',
  PMT_BG  : '#E1F5EE', RET_BG  : '#FAEEDA',
  SEP_BG  : '#D6E4F0', SEP_TX  : '#1F4E79',
  TOT_BG  : '#BDD7EE', ADJ_BG  : '#FAEEDA',
  ALT     : '#F2F7FB', YEL_BG  : '#FFFF00'
};

// ── STATUS HELPERS ───────────────────────────────────────────
var NORMAL_W2   = ['W2','W2-R'];
var MONTHLY_SLK = ['W2-SLK-MONTHLY'];
var SEMI_SLK    = ['W2-SLK-SEMI MONTHLY'];
var ADJ_TYPES   = ['W2-ADJ','W2-ADJ-O','W2-ADJ-H','W2-ADJ-OTH','W2-OTH'];
var W2B_TYPES   = ['W2-B']; // Special: has hours+rates but deducts BOTH taxes like ADJ
var SKIP_TYPES  = ['W2-MGMT','W2-ADMIN','C2C','C2C-P'];

var CLUSTERS = [
  { types: NORMAL_W2,   kind: 'NORMAL' },
  { types: SEMI_SLK,    kind: 'SEMI'   },
  { types: MONTHLY_SLK, kind: 'MONTHLY'},
  { types: W2B_TYPES,   kind: 'W2B'    },
  { types: ADJ_TYPES,   kind: 'ADJ'    }
];

function isW2(s) {
  if (!s) return false;
  s = s.toString().trim().toUpperCase();
  return NORMAL_W2.some(function(x){ return x.toUpperCase()===s; });
}
function isMonthly(s) {
  if (!s) return false;
  s = s.toString().trim().toUpperCase();
  return MONTHLY_SLK.some(function(x){ return x.toUpperCase()===s; });
}
function isSemi(s) {
  if (!s) return false;
  s = s.toString().trim().toUpperCase();
  return SEMI_SLK.some(function(x){ return x.toUpperCase()===s; });
}
function isAdj(s) {
  if (!s) return false;
  s = s.toString().trim().toUpperCase();
  return ADJ_TYPES.some(function(x){ return x.toUpperCase()===s; });
}
function isW2B(s) {
  if (!s) return false;
  s = s.toString().trim().toUpperCase();
  return W2B_TYPES.some(function(x){ return x.toUpperCase()===s; });
}
function isNormal(s) { return isW2(s) || isMonthly(s); }
function isSkip(s) {
  if (!s) return true;
  s = s.toString().trim().toUpperCase();
  return SKIP_TYPES.some(function(x){ return x.toUpperCase()===s; });
}
function getClusterOrder(s) {
  if (!s) return 99;
  s = s.toString().trim().toUpperCase();
  for (var c=0; c<CLUSTERS.length; c++)
    for (var t=0; t<CLUSTERS[c].types.length; t++)
      if (CLUSTERS[c].types[t].toUpperCase()===s) return c;
  return 99;
}

// ── MONTH HELPERS ────────────────────────────────────────────
function normMonth(raw) {
  if (!raw) return '';
  var MN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  if (raw instanceof Date) return MN[raw.getMonth()]+"'"+raw.getFullYear();
  var s = raw.toString().trim().toUpperCase().replace(/\s/g,'');
  var m = s.match(/^([A-Z]{3})'?(\d{4})$/);
  if (m && MN.indexOf(m[1])>=0) return m[1]+"'"+m[2];
  return s;
}

// Convert semi-monthly period format to base month
// Handles ALL formats: JAN'(1-15), JAN(1-15), JAN"(16-30), JAN'(16-31) etc
// Just extracts first 3 letters + year from payment date column N
function semiToBaseMonth(rawMonth, payDate) {
  if (!rawMonth) return '';
  var MN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var s = rawMonth.toString().trim().toUpperCase();
  // Extract ONLY first 3 letters — ignore everything else (apostrophe, bracket, dash)
  var mMatch = s.match(/^([A-Z]{3})/);
  if (!mMatch) return '';
  var mon = mMatch[1];
  if (MN.indexOf(mon) === -1) return '';
  // Get year from payment date column N — most reliable source
  var year = '';
  if (payDate instanceof Date) {
    year = payDate.getFullYear().toString();
  } else if (payDate) {
    var d = new Date(payDate);
    if (!isNaN(d.getTime())) year = d.getFullYear().toString();
  }
  // Fallback: try extract year from raw string
  if (!year) {
    var yMatch = s.match(/(\d{4})/);
    if (yMatch) year = yMatch[1];
  }
  if (!year) year = '2026'; // last resort
  return mon + "'" + year;
}

// Detect semi-monthly period format
// Matches: JAN'(1-15), JAN(1-15), JAN"(16-30), JAN'(16-31) etc
function isSemiPeriod(raw) {
  if (!raw) return false;
  var s = raw.toString().trim();
  // Has bracket or parenthesis after month name = semi period
  // {3,9} handles JAN(3), JUNE(4), JULY(4), SEPTEMBER(9) etc
  return /^[A-Za-z]{3,9}['"\s]*[\(\[]/.test(s);
}

function monthNum(m) {
  var mi = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
  var p = m.match(/([A-Z]{3})'(\d{4})/);
  return p ? parseInt(p[2])*100+(mi[p[1]]||0) : 0;
}

function setDate(ws, row, col, val) {
  if (!val) return;
  var cell = ws.getRange(row, col);
  if (val instanceof Date) { cell.setValue(val).setNumberFormat('MM/DD/YYYY'); }
  else { var d=new Date(val); if (!isNaN(d.getTime())) cell.setValue(d).setNumberFormat('MM/DD/YYYY'); else cell.setValue(val.toString()); }
}

// Get correct pay rate based on status
// W2/W2-R → col J (F C RATE idx9)
// W2-SLK-MONTHLY → col H (CON- RATE idx7)
// W2-SLK-SEMI MONTHLY → col H (CON- RATE idx7)
// C2C/C2C-P → col K (C2C RATE idx10) — skipped in OUTPUT
function getConRate(rateRow, status) {
  if (!rateRow) return 0;
  if (isW2(status)) return parseFloat(rateRow[9]) || 0;      // col J = F C RATE
  if (isSemi(status)) return parseFloat(rateRow[7]) || 0;    // col H = CON- RATE
  if (isMonthly(status)) return parseFloat(rateRow[7]) || 0; // col H = CON- RATE
  return parseFloat(rateRow[9]) || 0;
}

// ── MENU ────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('UIT Paysheet')
    .addItem('⚙️  Setup (run once)',          'setupOutput')
    .addSeparator()
    .addItem('▶  1. Run Hours',               'runHours')
    .addItem('💰 2. Run Tax & Payments',      'runTaxAndPayments')
    .addItem('📊 3. Update Cons Summary',     'updateConsSummary')
    .addItem('🔄 4. Update Closing Balances', 'updateClosingBalances')
    .addSeparator()
    .addItem('👤 Run Single Employee',         'runSingleEmployee')
    .addSeparator()
    .addItem('🔒 Lock a Month',               'lockMonth')
    .addItem('🔓 Unlock a Month',             'unlockMonth')
    .addToUi();
}

// ── SETUP ────────────────────────────────────────────────────
function setupOutput() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupLockSheet(ss);
  if (!ss.getSheetByName(O.CLOSING)) { var ws=ss.insertSheet(O.CLOSING); ss.setActiveSheet(ws); ss.moveActiveSheet(1); }
  if (!ss.getSheetByName(O.SUMMARY)) { var sw=ss.insertSheet(O.SUMMARY); setupSummaryHeader(sw); }
  ss.toast('✅ Setup done!', 'UIT Paysheet', 4);
}

// ── MASTER READERS ───────────────────────────────────────────
function getMaster() { return SpreadsheetApp.openById(MASTER_ID); }

// CONSULTANTS LIST: B=EMP CODE(idx1), C=name(idx2), D=STATUS(idx3)
function readConsultants(master) {
  var ws = master.getSheetByName(M.CONSULTANTS);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var emp=d[i][1], nm=d[i][2], st=d[i][3];
    if (!emp) continue;
    emp = emp.toString().trim();
    r[emp] = { empId:emp, name:(nm||'').toString().trim(), status:(st||'').toString().trim() };
  }
  return r;
}

// RATES: A=EMP CODE(idx0), F=DEPT(idx5), G=BILL(idx6), H=CON RATE(idx7), J=F W2 RATE(idx9)
function readRates(master) {
  var ws = master.getSheetByName(M.RATES);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var emp = d[i][1]; // B = EMP CODE (col A is S.NO)
    if (!emp) continue;
    var k = emp.toString().trim();
    if (r[k]) continue;
    r[k] = {
      bill    : parseFloat(d[i][6]) || 0,  // G = BILL RATE
      dept    : (d[i][5]||'').toString().trim(), // F = DEPT
      row     : d[i]  // keep full row for rate selection per status
    };
  }
  return r;
}

// TIMESHEETS: A=EMP ID(idx0), J=TOTAL(idx9), M=MONTH(idx12)
function readTimesheets(master, month) {
  var ws = master.getSheetByName(M.TIMESHEETS);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var emp=d[i][0], tot=d[i][9], mo=d[i][12];
    if (!emp||!mo) continue;
    if (normMonth(mo) !== month) continue;
    var k = emp.toString().trim();
    if (!r[k]) r[k] = 0; // first row wins if duplicate
    r[k] += parseFloat(tot)||0;
  }
  return r;
}

// Read ADP sheet once — reused by all ADP functions
function readAdpRaw(master) {
  var ws = master.getSheetByName(M.ADP_PAYROLL);
  if (!ws) return [];
  return ws.getDataRange().getValues();
}

// Read all 3 bank sheets once — reused by readBanks and readExpReim
function readBanksRaw(master) {
  var raw = {};
  var sheets = [[M.BOA,'BOA'],[M.B1BANK,'B1BANK'],[M.GPB,'GPB']];
  for (var b=0; b<sheets.length; b++) {
    var ws = master.getSheetByName(sheets[b][0]);
    raw[sheets[b][1]] = ws ? ws.getDataRange().getValues() : [];
  }
  return raw;
}

// ADP-PAYROLL-SUM normal rows (non-semi): A=Month(idx0), C=EMP CODE(idx2), D=STATUS(idx3)
function readAdpNormal(master, month, adpRaw) {
  var d = adpRaw || readAdpRaw(master);
  var r = {};
  for (var i=1; i<d.length; i++) {
    var mo=d[i][0], emp=d[i][2], st=d[i][3];
    if (!mo||!emp) continue;
    if (isSemiPeriod(mo)) continue; // skip semi periods
    if (normMonth(mo) !== month) continue;
    if (isAdj(st)) continue; // skip ADJ here
    r[emp.toString().trim()] = {
      totalPaid : parseFloat(d[i][5]) ||0,  // F
      empTax    : parseFloat(d[i][6]) ||0,  // G
      erLiab    : parseFloat(d[i][10])||0,  // K
      netPay    : parseFloat(d[i][8]) ||0   // I
    };
  }
  return r;
}

// ADP-PAYROLL-SUM semi periods: returns {empId: [P1, P2]}
function readAdpSemi(master, month, adpRaw) {
  var d = adpRaw || readAdpRaw(master);
  var r = {};
  for (var i=1; i<d.length; i++) {
    var mo=d[i][0], emp=d[i][2], st=d[i][3];
    if (!mo||!emp) continue;
    if (!isSemiPeriod(mo)) continue; // only semi periods
    // Get base month using payment date col N(idx13)
    var payDate = d[i][13];
    var baseMo = semiToBaseMonth(mo, payDate);
    if (baseMo !== month) continue;
    var k = emp.toString().trim();
    if (!r[k]) r[k] = [];
    r[k].push({
      rawMonth  : mo.toString().trim(),
      totalPaid : parseFloat(d[i][5]) ||0,
      empTax    : parseFloat(d[i][6]) ||0,
      erLiab    : parseFloat(d[i][10])||0,
      netPay    : parseFloat(d[i][8]) ||0,
      payDate   : payDate || null
    });
  }
  return r;
}

// ADP-PAYROLL-SUM ADJ rows filtered by W2-ADJ status
function readAdpAdj(master, month, adpRaw) {
  var d = adpRaw || readAdpRaw(master);
  var r = {};
  for (var i=1; i<d.length; i++) {
    var mo=d[i][0], emp=d[i][2], st=d[i][3];
    if (!mo||!emp) continue;
    if (normMonth(mo) !== month) continue;
    if (!isAdj(st)) continue;
    r[emp.toString().trim()] = {
      totalPaid : parseFloat(d[i][5]) ||0,
      empTax    : parseFloat(d[i][6]) ||0,
      erLiab    : parseFloat(d[i][10])||0,
      netPay    : parseFloat(d[i][8]) ||0
    };
  }
  return r;
}

// BANK payments: A=DATE(idx0), C=ACCOUNT(idx2), E=DEBIT(idx4), G=EMP CODE(idx6), I=MONTH(idx8)
// Returns LIST of payments per employee — each bank payment shown separately
function readBanks(master, month, banksRaw) {
  var r = {};
  var sheets = ['BOA','B1BANK','GPB'];
  var raw = banksRaw || readBanksRaw(master);
  for (var b=0; b<sheets.length; b++) {
    var d = raw[sheets[b]] || [];
    for (var i=1; i<d.length; i++) {
      var acc = (d[i][2]||'').toString().trim().toUpperCase();
      if (acc.indexOf('PAYROLL') === -1) continue;
      var emp=d[i][6], mo=d[i][8];
      if (!emp||!mo) continue;
      if (normMonth(mo) !== month) continue;
      var key = emp.toString().trim();
      var deb = parseFloat(d[i][4])||0;
      if (!r[key]) r[key] = [];
      r[key].push({ debit:deb, date:d[i][0], bank:sheets[b] });
    }
  }
  return r;
}

// AUTO RETURN sheet: read RECEIVED amount per emp+month
// A=S NO, B=FIRST, C=LAST, D=STATUS, E=PAYROLL, F=TAX, G=PAYCHECK, H=EMP TAX, I=TOTAL
// J=RECEIVED, K=ADVANCE, L=PAID TO, M=MONTH, N=EMP CODE
function readAutoReturn(master, month) {
  var ws = master.getSheetByName(M.AUTO_RETURN);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var mo  = d[i][12]; // M = MONTH
    var emp = d[i][13]; // N = EMP CODE
    var rec = d[i][9];  // J = RECEIVED
    if (!mo||!emp) continue;
    if (normMonth(mo) !== month) continue;
    r[emp.toString().trim()] = parseFloat(rec)||0;
  }
  return r;
}

// IMMI FEES: idx0=DATE, idx2=ACCOUNT, idx4=DEBIT, idx6=EMP CODE
// Only rows where EMP CODE is filled → employee specific fees
// If DATE is empty → carry date from row above (attorney fee pattern)
function readImmiFees(master, month) {
  var ws = master.getSheetByName(M.IMMI_FEES);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  var MN=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var lastDate = null; // carry date from previous row

  for (var i=1; i<d.length; i++) {
    var emp  = d[i][6]; // G = EMP CODE
    if (!emp || emp.toString().trim() === '') continue; // skip rows without EMP CODE
    var date = d[i][0]; // A = DATE
    var acc  = (d[i][2]||'').toString().trim(); // C = ACCOUNT
    var deb  = parseFloat(d[i][4])||0; // E = DEBIT
    if (!deb) continue;

    // Use date from this row if available, else carry from above
    if (date instanceof Date && !isNaN(date.getTime())) {
      lastDate = date;
    } else if (lastDate) {
      date = lastDate; // use carried date
    } else {
      continue; // no date available at all → skip
    }

    // Match month from DATE
    var rowMo = MN[date.getMonth()]+"'"+date.getFullYear();
    if (rowMo !== month) continue;

    var key = emp.toString().trim();
    if (!r[key]) r[key] = [];
    r[key].push({ date:date, account:acc, amount:deb });
  }
  return r;
}

// MED INSURANCE: idx1=EMP CODE, idx3=ACCOUNT, idx4=MONTH, idx5=INSURANCE AMT
function readMedInsurance(master, month) {
  var ws = master.getSheetByName(M.MED_INS);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var emp = d[i][1]; // B = EMP CODE
    var acc = (d[i][3]||'').toString().trim(); // D = ACCOUNT
    var mo  = d[i][4]; // E = MONTH
    var amt = parseFloat(d[i][5])||0; // F = INSURANCE AMT
    if (!emp||!mo||!amt) continue;
    if (normMonth(mo) !== month) continue;
    var key = emp.toString().trim();
    if (!r[key]) r[key] = [];
    r[key].push({ account:acc, amount:amt });
  }
  return r;
}

// EXP-REIM: reads from all 3 bank sheets where ACCOUNT = EXP-REIM
function readExpReim(master, month, banksRaw) {
  var r = {};
  var sheets = ['BOA','B1BANK','GPB'];
  var raw = banksRaw || readBanksRaw(master);
  for (var b=0; b<sheets.length; b++) {
    var d = raw[sheets[b]] || [];
    for (var i=1; i<d.length; i++) {
      var acc = (d[i][2]||'').toString().trim().toUpperCase();
      if (acc !== 'EXP-REIM') continue;
      var emp = d[i][6];
      var mo  = d[i][8];
      if (!emp||!mo) continue;
      if (normMonth(mo) !== month) continue;
      var key = emp.toString().trim();
      if (!r[key]) r[key] = [];
      r[key].push({ date:d[i][0], amount:parseFloat(d[i][4])||0 });
    }
  }
  return r;
}

// OP BALANCES: C=EMP CODE(idx2), E=BALANCE(idx4)
function readOpenBals(master) {
  var ws = master.getSheetByName(M.OP_BALANCES);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) {
    var emp=d[i][1], bal=d[i][4]; // B=EMP CODE, E=BALANCE
    if (!emp) continue;
    r[emp.toString().trim()] = parseFloat(bal)||0;
  }
  return r;
}

function readMonths(master) {
  var months = {};
  var MN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var checks = [[M.TIMESHEETS,12],[M.ADP_PAYROLL,0]];
  for (var s=0; s<checks.length; s++) {
    var ws = master.getSheetByName(checks[s][0]);
    if (!ws) continue;
    var d = ws.getDataRange().getValues(), c = checks[s][1];
    for (var i=1; i<d.length; i++) {
      var mo = d[i][c];
      if (!mo) continue;
      if (isSemiPeriod(mo)) continue; // skip semi periods
      var nm = normMonth(mo);
      if (nm) months[nm] = true;
    }
  }
  return Object.keys(months).sort(function(a,b){ return monthNum(a)-monthNum(b); });
}

// ── LOCK SYSTEM ──────────────────────────────────────────────
function setupLockSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(O.LOCKS);
  if (!ws) {
    ws = ss.insertSheet(O.LOCKS);
    ws.getRange(1,1,1,3).setValues([['LOCKED MONTH','LOCKED ON','LOCKED BY']]);
    ws.getRange(1,1,1,3).setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold');
    ws.setColumnWidth(1,140); ws.setColumnWidth(2,160); ws.setColumnWidth(3,220);
    ws.hideSheet();
  }
}
function getLocks(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var ws = ss.getSheetByName(O.LOCKS);
  if (!ws) return {};
  var d = ws.getDataRange().getValues(), r = {};
  for (var i=1; i<d.length; i++) { if (d[i][0]) r[d[i][0].toString().trim()] = true; }
  return r;
}
function isLocked(ss, month) { return !!getLocks(ss)[month]; }

function lockMonth() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  var master=getMaster(), months=readMonths(master), locks=getLocks(ss);
  if (!months.length) { ui.alert('No months found.'); return; }
  var list='';
  for (var i=0;i<months.length;i++) list+=(i+1)+'.  '+months[i]+(locks[months[i]]?'  🔒':'')+'\n';
  var res=ui.prompt('🔒 Lock a Month','Months:\n\n'+list+'\nEnter number:',ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton()!==ui.Button.OK) return;
  var num=parseInt(res.getResponseText().trim())-1;
  if (isNaN(num)||num<0||num>=months.length) { ui.alert('Invalid.'); return; }
  var month=months[num];
  if (locks[month]) { ui.alert('Already locked!'); return; }
  setupLockSheet(ss);
  var ws=ss.getSheetByName(O.LOCKS), lr=ws.getLastRow()+1;
  ws.getRange(lr,1).setValue(month);
  ws.getRange(lr,2).setValue(new Date()).setNumberFormat('MM/DD/YYYY');
  ws.getRange(lr,3).setValue(Session.getActiveUser().getEmail());
  ui.alert('✅ '+month+' is now LOCKED.');
}

function unlockMonth() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  var lks=getLocks(ss), locked=Object.keys(lks);
  if (!locked.length) { ui.alert('No months locked.'); return; }
  var list='';
  for (var i=0;i<locked.length;i++) list+=(i+1)+'.  '+locked[i]+'\n';
  var res=ui.prompt('🔓 Unlock','⚠️ Warning!\n\n'+list+'\nEnter number:',ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton()!==ui.Button.OK) return;
  var num=parseInt(res.getResponseText().trim())-1;
  if (isNaN(num)||num<0||num>=locked.length) { ui.alert('Invalid.'); return; }
  var month=locked[num];
  var ws=ss.getSheetByName(O.LOCKS), d=ws.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (d[i][0]&&d[i][0].toString().trim()===month) { ws.deleteRow(i+1); break; }
  }
  ui.alert('🔓 '+month+' unlocked.');
}

function pickMonth(master, ss, title) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var months = readMonths(master);
  if (!months.length) { ui.alert('No data found in Master sheet.'); return null; }
  var locks = getLocks(ss), list = '';
  for (var i=0; i<months.length; i++) list+=(i+1)+'.  '+(locks[months[i]]?'🔒 ':'')+months[i]+'\n';
  var res = ui.prompt(title,'Available months:\n\n'+list+'\nEnter number:',ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton()!==ui.Button.OK) return null;
  var num = parseInt(res.getResponseText().trim())-1;
  if (isNaN(num)||num<0||num>=months.length) { ui.alert('Invalid number.'); return null; }
  var month = months[num];
  if (locks[month]) { ui.alert('🔒 '+month+' is LOCKED.'); return null; }
  return month;
}

// ── BUTTON 1 — RUN HOURS ────────────────────────────────────
// Creates individual sheets + fills HOURS rows
// Processes 50 employees per run to avoid timeout
// Keep clicking until All Done message shows
var BATCH_SIZE = 50;

function runHours() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  try {
    var master = getMaster();
    var month  = pickMonth(master, ss, '▶ Run Hours — Select Month');
    if (!month) return;
    if (isLocked(ss,month)) { ui.alert('🔒 '+month+' is LOCKED.'); return; }

    ss.toast('Reading data...', 'UIT Paysheet', 5);
    var consultants = readConsultants(master);
    var rates       = readRates(master);
    var timesheets  = readTimesheets(master, month);
    var openBals    = readOpenBals(master);

    // Sort employees in cluster order
    var empIds = Object.keys(consultants).sort(function(a,b){
      return getClusterOrder(consultants[a].status) - getClusterOrder(consultants[b].status);
    });

    // Filter out skipped types
    var toProcess = empIds.filter(function(id){
      return !isSkip(consultants[id].status);
    });

    var total   = toProcess.length;
    var created = 0;
    var done    = 0;
    var startTime = new Date().getTime();

    for (var e=0; e<total; e++) {
      // Stop if 4.5 minutes elapsed — avoid timeout
      if (new Date().getTime() - startTime > 270000) {
        ss.toast(
          '⏳ Processed '+done+' of '+total+' employees. Click Run Hours again to continue.',
          'UIT Paysheet', 10
        );
        return;
      }

      var emp  = consultants[toProcess[e]];
      var rate = rates[emp.empId] || { bill:0, dept:'', row:null };
      var oBal = openBals[emp.empId] || 0;
      var conRate = rate.row ? getConRate(rate.row, emp.status) : 0;

      var ws    = ss.getSheetByName(emp.empId);
      var isNew = !ws;
      if (isNew) {
        ws = ss.insertSheet(emp.empId);
        buildHeader(ws, emp, rate.bill, conRate, oBal);
        created++;
      }

      // Skip if month already processed for this employee
      if (monthRowExists(ws, month)) { done++; continue; }

      var bal = getBalance(ws);

      if (isAdj(emp.status)) {
        // ADJ: create sheet only — no hours row
        removeBalRow(ws);
        writeSep(ws, month);
      writeBalRow(ws, bal);
        done++; continue;
      }

      // W2 / SEMI / MONTHLY: write HOURS row
      var hours  = timesheets[emp.empId] || 0;
      var amount = hours * conRate;
      bal += amount;

      removeBalRow(ws);
      writeSep(ws, month);

      var lr = ws.getLastRow()+1;
      rowBg(ws, lr, C.BLUE_BG);
      ws.getRange(lr,2).setValue(month+' HOURS');
      ws.getRange(lr,3).setValue(emp.status);
      ws.getRange(lr,4).setValue(hours||0);
      ws.getRange(lr,5).setValue(rate.bill).setNumberFormat('$#,##0.00');
      ws.getRange(lr,6).setValue(conRate).setNumberFormat('$#,##0.00');
      ws.getRange(lr,7).setValue(amount).setNumberFormat('$#,##0.00');
      ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
      colBal(ws, lr, 13, bal);

      writeBalRow(ws, bal);
      done++;
    }

    ss.toast(
      '✅ All done for '+month+'! '+created+' new sheets created.',
      'UIT Paysheet', 5
    );
  } catch(err) {
    ui.alert('❌ Error:\n\n'+err.message+'\n\nCheck MASTER_ID is correct.');
    Logger.log(err.stack);
  }
}

// ── BUTTON 2 — RUN TAX & PAYMENTS ──────────────────────────
// Fills PAYROLL + PAYMENT rows for all employee types
function runTaxAndPayments() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  try {
    var master = getMaster();
    var month  = pickMonth(master, ss, '💰 Run Tax & Payments — Select Month');
    if (!month) return;
    if (isLocked(ss,month)) { ui.alert('🔒 '+month+' is LOCKED.'); return; }

    ss.toast('Reading payment data...', 'UIT Paysheet', 5);
    var consultants = readConsultants(master);
    var rates       = readRates(master);
    // Read ADP and bank sheets ONCE — reused by all functions
    var adpRaw      = readAdpRaw(master);
    var banksRaw    = readBanksRaw(master);
    var adpNormal   = readAdpNormal(master, month, adpRaw);
    var adpSemi     = readAdpSemi(master, month, adpRaw);
    var adpAdj      = readAdpAdj(master, month, adpRaw);
    var banks       = readBanks(master, month, banksRaw);
    var autoReturn  = readAutoReturn(master, month);
    var immiFees    = readImmiFees(master, month);
    var medIns      = readMedInsurance(master, month);
    var expReim     = readExpReim(master, month, banksRaw);

    var empIds = Object.keys(consultants).sort(function(a,b){
      return getClusterOrder(consultants[a].status) - getClusterOrder(consultants[b].status);
    });

    for (var e=0; e<empIds.length; e++) {
      var emp = consultants[empIds[e]];
      if (isSkip(emp.status)) continue;

      var ws = ss.getSheetByName(emp.empId);
      if (!ws) continue; // run Button 1 first

      var rate    = rates[emp.empId] || { bill:0, dept:'', row:null };
      var conRate = rate.row ? getConRate(rate.row, emp.status) : 0;
      var empBanks = banks[emp.empId] || [];
      var bal     = getBalance(ws);

      // Check what already exists
      var hasPayroll  = payrollRowExistsCheck(ws, month);
      var hasPayment  = paymentRowExists(ws, month);

      // If both exist → skip completely
      if (hasPayroll && hasPayment) continue;

      removeBalRow(ws);
      // Only write separator if not already exists
      if (!sepExists(ws, month)) writeSep(ws, month);

      if (isW2B(emp.status)) {
        // W2-B: has hours+rates but deducts BOTH taxes like ADJ
        var pr = adpNormal[emp.empId] || null;
        if (!hasPayroll && !hasPayment) {
          bal = writeW2BPayroll(ws, month, pr, empBanks, bal, emp.status);
        } else if (hasPayroll && !hasPayment) {
          bal = writeNormalPaymentOnly(ws, month, empBanks, bal, emp.status);
        }

      } else if (isNormal(emp.status)) {
        var pr = adpNormal[emp.empId] || null;
        if (!hasPayroll && !hasPayment) {
          // Write both PAYROLL and PAYMENT
          bal = writeNormalPayroll(ws, month, pr, empBanks, bal, emp.status);
        } else if (hasPayroll && !hasPayment) {
          // Only add PAYMENT rows
          bal = writeNormalPaymentOnly(ws, month, empBanks, bal, emp.status);
        }

      } else if (isSemi(emp.status)) {
        var prs = adpSemi[emp.empId] || [];
        if (!hasPayroll && !hasPayment) {
          bal = writeSemiPayroll(ws, month, prs, bal, emp.status);
        } else if (hasPayroll && !hasPayment) {
          bal = writeSemiPaymentOnly(ws, month, prs, bal, emp.status);
        }

      } else if (isAdj(emp.status)) {
        var adj = adpAdj[emp.empId] || null;
        var ret = autoReturn[emp.empId] || 0;
        if (!hasPayroll && !hasPayment) {
          bal = writeAdjAll(ws, month, adj, empBanks, ret, bal, emp.status);
        } else if (hasPayroll && !hasPayment) {
          bal = writeAdjPaymentOnly(ws, month, adj, empBanks, ret, bal, emp.status);
        }
      }

      // Write IMMI FEES + MED INSURANCE + EXP-REIM rows
      // Only write if not already written for this month
      if (!immiRowExists(ws, month)) {
        bal = writeImmiAndMed(ws, month, immiFees[emp.empId]||[], medIns[emp.empId]||[], expReim[emp.empId]||[], bal, emp.status);
      }

      writeBalRow(ws, bal);
    }

    ss.toast('✅ Tax & Payments done for '+month+'!', 'UIT Paysheet', 5);
  } catch(err) {
    ui.alert('❌ Error:\n\n'+err.message);
    Logger.log(err.stack);
  }
}

// ── BUTTON 3 — UPDATE CONS SUMMARY (select month) ───────────
// Only updates CONS SUMMARY for selected month
function updateConsSummary() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  try {
    var master      = getMaster();
    var month       = pickMonth(master, ss, '📊 Update Cons Summary — Select Month');
    if (!month) return;
    var consultants = readConsultants(master);
    var rates       = readRates(master);

    ss.toast('Updating CONS SUMMARY for '+month+'...', 'UIT Paysheet', 5);
    buildConsSummary(ss, master, consultants, rates, month);

    ss.toast('✅ CONS SUMMARY updated for '+month+'!', 'UIT Paysheet', 4);
  } catch(err) {
    ui.alert('❌ Error:\n\n'+err.message);
    Logger.log(err.stack);
  }
}

// ── BUTTON 4 — UPDATE CLOSING BALANCES (select month) ───────
// Adds selected month balances below previous months
function updateClosingBalances() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  try {
    var master      = getMaster();
    var month       = pickMonth(master, ss, '🔄 Update Closing Balances — Select Month');
    if (!month) return;
    var consultants = readConsultants(master);

    ss.toast('Updating Closing Balances for '+month+'...', 'UIT Paysheet', 5);
    buildClosingMonth(ss, consultants, month);

    ss.toast('✅ Closing Balances updated for '+month+'!', 'UIT Paysheet', 4);
  } catch(err) {
    ui.alert('❌ Error:\n\n'+err.message);
    Logger.log(err.stack);
  }
}

// ── SINGLE EMPLOYEE RUN ─────────────────────────────────────
// Runs both Hours AND Tax & Payments for one employee
// Select EMP ID → select month or ALL months
function runSingleEmployee() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  try {
    var master = getMaster();

    // Step 1: Ask for EMP ID
    var empRes = ui.prompt(
      '👤 Run Single Employee',
      'Enter EMP ID (e.g. UIT-001):',
      ui.ButtonSet.OK_CANCEL
    );
    if (empRes.getSelectedButton() !== ui.Button.OK) return;
    var empId = empRes.getResponseText().trim().toUpperCase();
    if (!empId) { ui.alert('No EMP ID entered.'); return; }

    // Step 2: Get consultants and verify EMP ID exists
    var consultants = readConsultants(master);
    if (!consultants[empId]) { ui.alert('EMP ID not found: ' + empId); return; }
    var emp = consultants[empId];

    // Step 3: Select month or ALL
    var months = readMonths(master);
    if (!months.length) { ui.alert('No months found.'); return; }
    var list = '';
    for (var i=0; i<months.length; i++) list += (i+1) + '.  ' + months[i] + String.fromCharCode(10);
    list += (months.length+1) + '.  ALL MONTHS';
    var sep = String.fromCharCode(10);

    var moRes = ui.prompt(
      'Run Single Employee - ' + empId + ' - ' + emp.name,
      'Select month:' + sep + sep + list + sep + sep + 'Enter number:',
      ui.ButtonSet.OK_CANCEL
    );
    if (moRes.getSelectedButton() !== ui.Button.OK) return;
    var moNum = parseInt(moRes.getResponseText().trim()) - 1;
    if (isNaN(moNum) || moNum < 0 || moNum > months.length) { ui.alert('Invalid number.'); return; }

    // Determine months to process
    var selectedMonths = moNum === months.length ? months : [months[moNum]];

    // Step 4: Read all data once
    ss.toast('Reading data for ' + empId + '...', 'UIT Paysheet', 5);
    var rates    = readRates(master);
    var openBals = readOpenBals(master);
    var rate     = rates[empId] || { bill:0, dept:'', row:null };
    var oBal     = openBals[empId] || 0;
    var conRate  = rate.row ? getConRate(rate.row, emp.status) : 0;

    // Step 5: Process each selected month
    for (var m=0; m<selectedMonths.length; m++) {
      var month = selectedMonths[m];
      ss.toast('Processing ' + empId + ' — ' + month + ' (' + (m+1) + ' of ' + selectedMonths.length + ')', 'UIT Paysheet', 5);

      // ── RUN HOURS ──
      var timesheets = readTimesheets(master, month);
      var ws = ss.getSheetByName(empId);
      if (!ws) {
        ws = ss.insertSheet(empId);
        buildHeader(ws, emp, rate.bill, conRate, oBal);
      }

      if (!monthRowExists(ws, month)) {
        var bal = getBalance(ws);
        if (isAdj(emp.status)) {
          removeBalRow(ws);
          if (!sepExists(ws, month)) writeSep(ws, month);
          writeBalRow(ws, bal);
        } else {
          var hours  = timesheets[empId] || 0;
          var amount = hours * conRate;
          bal += amount;
          removeBalRow(ws);
          writeSep(ws, month);
          var lr = ws.getLastRow()+1;
          rowBg(ws, lr, C.BLUE_BG);
          ws.getRange(lr,2).setValue(month+' HOURS');
          ws.getRange(lr,3).setValue(emp.status);
          ws.getRange(lr,4).setValue(hours||0);
          ws.getRange(lr,5).setValue(rate.bill).setNumberFormat('$#,##0.00');
          ws.getRange(lr,6).setValue(conRate).setNumberFormat('$#,##0.00');
          ws.getRange(lr,7).setValue(amount).setNumberFormat('$#,##0.00');
          ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
          colBal(ws, lr, 13, bal);
          writeBalRow(ws, bal);
        }
      }

      // ── RUN TAX & PAYMENTS ──
      var adpRaw   = readAdpRaw(master);
      var banksRaw = readBanksRaw(master);
      var adpNormal  = readAdpNormal(master, month, adpRaw);
      var adpSemi    = readAdpSemi(master, month, adpRaw);
      var adpAdj     = readAdpAdj(master, month, adpRaw);
      var banks      = readBanks(master, month, banksRaw);
      var autoReturn = readAutoReturn(master, month);
      var immiFees   = readImmiFees(master, month);
      var medIns     = readMedInsurance(master, month);
      var expReim    = readExpReim(master, month, banksRaw);

      var hasPayroll = payrollRowExistsCheck(ws, month);
      var hasPayment = paymentRowExists(ws, month);

      if (!(hasPayroll && hasPayment)) {
        var empBanks = banks[empId] || [];
        var bal2 = getBalance(ws);
        removeBalRow(ws);
        if (!sepExists(ws, month)) writeSep(ws, month);

        if (isW2B(emp.status)) {
          var pr = adpNormal[empId] || null;
          if (!hasPayroll && !hasPayment) bal2 = writeW2BPayroll(ws, month, pr, empBanks, bal2, emp.status);
          else if (hasPayroll && !hasPayment) bal2 = writeNormalPaymentOnly(ws, month, empBanks, bal2, emp.status);
        } else if (isNormal(emp.status)) {
          var pr = adpNormal[empId] || null;
          if (!hasPayroll && !hasPayment) bal2 = writeNormalPayroll(ws, month, pr, empBanks, bal2, emp.status);
          else if (hasPayroll && !hasPayment) bal2 = writeNormalPaymentOnly(ws, month, empBanks, bal2, emp.status);
        } else if (isSemi(emp.status)) {
          var prs = adpSemi[empId] || [];
          if (!hasPayroll && !hasPayment) bal2 = writeSemiPayroll(ws, month, prs, bal2, emp.status);
          else if (hasPayroll && !hasPayment) bal2 = writeSemiPaymentOnly(ws, month, prs, bal2, emp.status);
        } else if (isAdj(emp.status)) {
          var adj = adpAdj[empId] || null;
          var ret = autoReturn[empId] || 0;
          if (!hasPayroll && !hasPayment) bal2 = writeAdjAll(ws, month, adj, empBanks, ret, bal2, emp.status);
          else if (hasPayroll && !hasPayment) bal2 = writeAdjPaymentOnly(ws, month, adj, empBanks, ret, bal2, emp.status);
        }

        if (!immiRowExists(ws, month)) {
          bal2 = writeImmiAndMed(ws, month, immiFees[empId]||[], medIns[empId]||[], expReim[empId]||[], bal2, emp.status);
        }
        writeBalRow(ws, bal2);
      }
    }

    ss.toast('✅ Done! ' + empId + ' processed for ' + selectedMonths.length + ' month(s).', 'UIT Paysheet', 5);

  } catch(err) {
    ui.alert('❌ Error:

' + err.message);
    Logger.log(err.stack);
  }
}

// ── ROW WRITERS ─────────────────────────────────────────────

// W2 / W2-SLK-MONTHLY: PAYROLL → PAYMENT (bank)
// Each bank payment shown as separate row
function writeNormalPayroll(ws, month, pr, banks, bal, status) {
  var lr = ws.getLastRow()+1;

  // PAYROLL ROW — balance = prev − empTax only
  if (pr && pr.totalPaid>0) {
    bal -= pr.empTax;
    rowBg(ws, lr, C.PURP_BG);
    // Use first bank date on payroll row
    if (banks&&banks.length>0&&banks[0].date) setDate(ws,lr,1,banks[0].date);
    ws.getRange(lr,2).setValue(month+' PAYROLL—$'+Math.round(pr.totalPaid));
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,10).setValue(pr.empTax).setNumberFormat('$#,##0.00');
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    colBal(ws,lr,13,bal); lr++;
  }

  // PAYMENT ROWS — one per bank payment
  if (banks && banks.length>0) {
    for (var b=0; b<banks.length; b++) {
      var pmt = banks[b];
      bal -= pmt.debit;
      rowBg(ws, lr, C.PMT_BG);
      setDate(ws,lr,1,pmt.date);
      setDate(ws,lr,14,pmt.date);
      ws.getRange(lr,2).setValue(month+' PAYMENT ('+pmt.bank+')');
      ws.getRange(lr,3).setValue(status);
      ws.getRange(lr,12).setValue(pmt.debit).setNumberFormat('$#,##0.00');
      ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
      ws.getRange(lr,15).setValue('DONE').setBackground(C.GRN_BG).setFontColor(C.GRN_TX).setFontWeight('bold').setHorizontalAlignment('center');
      colBal(ws,lr,13,bal); lr++;
    }
  } else {
    // No bank payment found — NOT DONE
    rowBg(ws, lr, C.PMT_BG);
    ws.getRange(lr,2).setValue(month+' PAYMENT');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('NOT DONE').setBackground(C.RED_BG).setFontColor(C.RED_TX).setFontWeight('bold').setHorizontalAlignment('center');
    colBal(ws,lr,13,bal);
  }
  return bal;
}

// W2-B: has hours+rates, deducts BOTH E TAX + TAX in PAYROLL row
function writeW2BPayroll(ws, month, pr, banks, bal, status) {
  var lr = ws.getLastRow()+1;

  // PAYROLL ROW — balance = prev − erLiab − empTax (BOTH like ADJ)
  if (pr && pr.totalPaid>0) {
    bal -= (pr.erLiab + pr.empTax); // deduct BOTH taxes
    rowBg(ws, lr, C.PURP_BG);
    if (banks&&banks.length>0&&banks[0].date) setDate(ws,lr,1,banks[0].date);
    ws.getRange(lr,2).setValue(month+' PAYROLL—$'+Math.round(pr.totalPaid));
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,9).setValue(pr.erLiab).setNumberFormat('$#,##0.00');  // E TAX
    ws.getRange(lr,10).setValue(pr.empTax).setNumberFormat('$#,##0.00'); // TAX
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    colBal(ws,lr,13,bal); lr++;
  }

  // PAYMENT ROW — from bank (same as W2)
  rowBg(ws, lr, C.PMT_BG);
  if (banks && banks.length>0) {
    for (var b=0; b<banks.length; b++) {
      var pmt = banks[b];
      bal -= pmt.debit;
      rowBg(ws, lr, C.PMT_BG);
      setDate(ws,lr,1,pmt.date); setDate(ws,lr,14,pmt.date);
      ws.getRange(lr,2).setValue(month+' PAYMENT ('+pmt.bank+')');
      ws.getRange(lr,3).setValue(status);
      ws.getRange(lr,12).setValue(pmt.debit).setNumberFormat('$#,##0.00');
      ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
      ws.getRange(lr,15).setValue('DONE').setBackground(C.GRN_BG).setFontColor(C.GRN_TX).setFontWeight('bold').setHorizontalAlignment('center');
      colBal(ws,lr,13,bal); lr++;
    }
  } else {
    ws.getRange(lr,2).setValue(month+' PAYMENT');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('NOT DONE').setBackground(C.RED_BG).setFontColor(C.RED_TX).setFontWeight('bold').setHorizontalAlignment('center');
    colBal(ws,lr,13,bal);
  }
  return bal;
}

// W2-SLK-SEMI MONTHLY: PAYROLL P1 + P2 → PAYMENT (ADP net pay)
function writeSemiPayroll(ws, month, prs, bal, status) {
  var lr = ws.getLastRow()+1;
  var totalNetPay=0, allDone=true, lastPayDate=null;

  // PAYROLL ROWS — one per period
  for (var p=0; p<prs.length; p++) {
    var pr=prs[p], period='P'+(p+1);
    bal -= pr.empTax;
    totalNetPay += pr.netPay||0;
    if ((pr.payDate+'').toLowerCase().indexOf('done')===-1 && !pr.payDate) allDone=false;
    if (pr.payDate) lastPayDate = pr.payDate;

    rowBg(ws, lr, C.PURP_BG);
    if (pr.payDate) setDate(ws,lr,1,pr.payDate);
    ws.getRange(lr,2).setValue(month+' PAYROLL '+period+'—$'+Math.round(pr.totalPaid));
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,10).setValue(pr.empTax).setNumberFormat('$#,##0.00');
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    colBal(ws,lr,13,bal); lr++;
  }

  // PAYMENT ROW — combined P1+P2 net pay from ADP
  rowBg(ws, lr, C.PMT_BG);
  if (totalNetPay>0) {
    bal -= totalNetPay;
    if (lastPayDate) { setDate(ws,lr,1,lastPayDate); setDate(ws,lr,14,lastPayDate); }
    ws.getRange(lr,2).setValue(month+' PAYMENT (ADP-DD)');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,12).setValue(totalNetPay).setNumberFormat('$#,##0.00');
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('DONE').setBackground(C.GRN_BG).setFontColor(C.GRN_TX).setFontWeight('bold').setHorizontalAlignment('center');
  } else {
    ws.getRange(lr,2).setValue(month+' PAYMENT (ADP-DD)');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('NOT DONE').setBackground(C.RED_BG).setFontColor(C.RED_TX).setFontWeight('bold').setHorizontalAlignment('center');
  }
  colBal(ws,lr,13,bal);
  return bal;
}

// W2-ADJ: PAYROLL → PAYMENT (bank debit, each separate) → RET (AUTO RETURN)
function writeAdjAll(ws, month, adj, banks, retAmount, bal, status) {
  var lr = ws.getLastRow()+1;

  // PAYROLL ROW — balance = prev − erLiab − empTax
  var totalPaid = adj ? adj.totalPaid : 0;
  var erLiab    = adj ? adj.erLiab   : 0;
  var empTax    = adj ? adj.empTax   : 0;

  bal -= (erLiab + empTax);
  rowBg(ws, lr, C.PURP_BG);
  if (banks&&banks.length>0&&banks[0].date) setDate(ws,lr,1,banks[0].date);
  ws.getRange(lr,2).setValue(month+' PAYROLL'+(totalPaid>0?'—$'+Math.round(totalPaid):''));
  ws.getRange(lr,3).setValue(status);
  if (erLiab>0) ws.getRange(lr,9).setValue(erLiab).setNumberFormat('$#,##0.00');
  if (empTax>0) ws.getRange(lr,10).setValue(empTax).setNumberFormat('$#,##0.00');
  ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
  colBal(ws,lr,13,bal); lr++;

  // PAYMENT ROWS — one per bank payment, each deducted separately
  if (banks && banks.length>0) {
    for (var b=0; b<banks.length; b++) {
      var pmt = banks[b];
      bal -= pmt.debit;
      rowBg(ws, lr, C.PMT_BG);
      setDate(ws,lr,1,pmt.date);
      setDate(ws,lr,14,pmt.date);
      ws.getRange(lr,2).setValue(month+' PAYMENT ('+pmt.bank+')');
      ws.getRange(lr,3).setValue(status);
      ws.getRange(lr,12).setValue(pmt.debit).setNumberFormat('$#,##0.00');
      ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
      ws.getRange(lr,15).setValue('DONE').setBackground(C.GRN_BG).setFontColor(C.GRN_TX).setFontWeight('bold').setHorizontalAlignment('center');
      colBal(ws,lr,13,bal); lr++;
    }
  } else {
    // No bank payment — NOT DONE
    rowBg(ws, lr, C.PMT_BG);
    ws.getRange(lr,2).setValue(month+' PAYMENT');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('NOT DONE').setBackground(C.RED_BG).setFontColor(C.RED_TX).setFontWeight('bold').setHorizontalAlignment('center');
    colBal(ws,lr,13,bal); lr++;
  }

  // RET ROW — balance = prev + return received from AUTO RETURN
  rowBg(ws, lr, C.RET_BG);
  ws.getRange(lr,2).setValue('RET');
  if (retAmount>0) {
    bal += retAmount;
    ws.getRange(lr,8).setValue(retAmount).setNumberFormat('$#,##0.00');
  }
  ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
  colBal(ws,lr,13,bal);
  return bal;
}

// Write IMMI FEES + MED INSURANCE + EXP-REIM rows after PAYMENT
// All go in INSU OTH column (col 11), deducted from balance
function writeImmiAndMed(ws, month, immiFees, medIns, expReim, bal, status) {
  var lr = ws.getLastRow()+1;

  // IMMI FEES rows — one per entry
  for (var i=0; i<immiFees.length; i++) {
    var fee = immiFees[i];
    bal -= fee.amount;
    rowBg(ws, lr, C.ALT);
    if (fee.date) setDate(ws, lr, 1, fee.date);
    ws.getRange(lr,2).setValue(month+' '+fee.account);
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,11).setValue(fee.amount).setNumberFormat('$#,##0.00');
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    colBal(ws,lr,13,bal); lr++;
  }

  // MED INSURANCE rows — one per type
  for (var j=0; j<medIns.length; j++) {
    var ins = medIns[j];
    bal -= ins.amount;
    rowBg(ws, lr, C.ALT);
    ws.getRange(lr,2).setValue(month+' '+ins.account);
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,11).setValue(ins.amount).setNumberFormat('$#,##0.00');
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    colBal(ws,lr,13,bal); lr++;
  }

  // EXP-REIM rows — one per entry from bank sheets
  for (var k=0; k<expReim.length; k++) {
    var exp = expReim[k];
    bal -= exp.amount;
    rowBg(ws, lr, C.ALT);
    if (exp.date) setDate(ws, lr, 1, exp.date);
    ws.getRange(lr,2).setValue(month+' EXP-REIM');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,11).setValue(exp.amount).setNumberFormat('$#,##0.00');
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    colBal(ws,lr,13,bal); lr++;
  }

  return bal;
}

// NORMAL — add PAYMENT only (PAYROLL already exists)
function writeNormalPaymentOnly(ws, month, banks, bal, status) {
  var lr = ws.getLastRow()+1;
  if (banks && banks.length>0) {
    for (var b=0; b<banks.length; b++) {
      var pmt = banks[b];
      bal -= pmt.debit;
      rowBg(ws, lr, C.PMT_BG);
      setDate(ws,lr,1,pmt.date); setDate(ws,lr,14,pmt.date);
      ws.getRange(lr,2).setValue(month+' PAYMENT ('+pmt.bank+')');
      ws.getRange(lr,3).setValue(status);
      ws.getRange(lr,12).setValue(pmt.debit).setNumberFormat('$#,##0.00');
      ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
      ws.getRange(lr,15).setValue('DONE').setBackground(C.GRN_BG).setFontColor(C.GRN_TX).setFontWeight('bold').setHorizontalAlignment('center');
      colBal(ws,lr,13,bal); lr++;
    }
  } else {
    rowBg(ws, lr, C.PMT_BG);
    ws.getRange(lr,2).setValue(month+' PAYMENT');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('NOT DONE').setBackground(C.RED_BG).setFontColor(C.RED_TX).setFontWeight('bold').setHorizontalAlignment('center');
    colBal(ws,lr,13,bal);
  }
  return bal;
}

// SEMI — add PAYMENT only (PAYROLL P1+P2 already exist)
function writeSemiPaymentOnly(ws, month, prs, bal, status) {
  var totalNetPay=0, lastPayDate=null;
  for (var p=0; p<prs.length; p++) {
    totalNetPay += prs[p].netPay||0;
    if (prs[p].payDate) lastPayDate = prs[p].payDate;
  }
  var lr = ws.getLastRow()+1;
  rowBg(ws, lr, C.PMT_BG);
  if (totalNetPay>0) {
    bal -= totalNetPay;
    if (lastPayDate) { setDate(ws,lr,1,lastPayDate); setDate(ws,lr,14,lastPayDate); }
    ws.getRange(lr,2).setValue(month+' PAYMENT (ADP-DD)');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,12).setValue(totalNetPay).setNumberFormat('$#,##0.00');
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('DONE').setBackground(C.GRN_BG).setFontColor(C.GRN_TX).setFontWeight('bold').setHorizontalAlignment('center');
  } else {
    ws.getRange(lr,2).setValue(month+' PAYMENT (ADP-DD)');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('NOT DONE').setBackground(C.RED_BG).setFontColor(C.RED_TX).setFontWeight('bold').setHorizontalAlignment('center');
  }
  colBal(ws,lr,13,bal);
  return bal;
}

// ADJ — add PAYMENT + RET only (PAYROLL already exists)
function writeAdjPaymentOnly(ws, month, adj, banks, retAmount, bal, status) {
  var lr = ws.getLastRow()+1;
  // PAYMENT ROW
  if (banks && banks.length>0) {
    for (var b=0; b<banks.length; b++) {
      var pmt = banks[b];
      bal -= pmt.debit;
      rowBg(ws, lr, C.PMT_BG);
      setDate(ws,lr,1,pmt.date); setDate(ws,lr,14,pmt.date);
      ws.getRange(lr,2).setValue(month+' PAYMENT ('+pmt.bank+')');
      ws.getRange(lr,3).setValue(status);
      ws.getRange(lr,12).setValue(pmt.debit).setNumberFormat('$#,##0.00');
      ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
      ws.getRange(lr,15).setValue('DONE').setBackground(C.GRN_BG).setFontColor(C.GRN_TX).setFontWeight('bold').setHorizontalAlignment('center');
      colBal(ws,lr,13,bal); lr++;
    }
  } else {
    rowBg(ws, lr, C.PMT_BG);
    ws.getRange(lr,2).setValue(month+' PAYMENT');
    ws.getRange(lr,3).setValue(status);
    ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
    ws.getRange(lr,15).setValue('NOT DONE').setBackground(C.RED_BG).setFontColor(C.RED_TX).setFontWeight('bold').setHorizontalAlignment('center');
    colBal(ws,lr,13,bal); lr++;
  }
  // RET ROW
  rowBg(ws, lr, C.RET_BG);
  ws.getRange(lr,2).setValue('RET');
  if (retAmount>0) {
    bal += retAmount;
    ws.getRange(lr,8).setValue(retAmount).setNumberFormat('$#,##0.00');
  }
  ws.getRange(lr,13).setValue(bal).setNumberFormat('$#,##0.00');
  colBal(ws,lr,13,bal);
  return bal;
}

// ── CLOSING BALANCES ─────────────────────────────────────────
// Check if closing balances already has this month
function closingMonthExists(ws, month) {
  var lr=ws.getLastRow(); if (lr<2) return false;
  var vals=ws.getRange(1,1,lr,1).getValues();
  for (var i=0;i<vals.length;i++) {
    var v=(vals[i][0]||'').toString().toUpperCase();
    if (v.indexOf(month.toUpperCase())>=0) return true;
  }
  return false;
}

// Build closing balances for one month — adds below existing months
function buildClosingMonth(ss, consultants, month) {
  var ws = ss.getSheetByName(O.CLOSING);
  if (!ws) {
    ws = ss.insertSheet(O.CLOSING);
    ss.setActiveSheet(ws);
    ss.moveActiveSheet(1);
    // Title + subtitle only on first run
    ws.getRange('A1').setValue('CLOSING BALANCES — MONTHLY').setFontSize(18).setFontWeight('bold').setFontColor(C.NAVY);
    ws.getRange('A1:F1').merge().setHorizontalAlignment('center');
    ws.getRange('A2').setValue('Click EMP ID to view individual sheet').setFontSize(10).setFontColor('#666666').setFontStyle('italic');
    ws.getRange('A2:F2').merge().setHorizontalAlignment('center');
  }

  // If month already exists → delete it and rewrite
  if (closingMonthExists(ws, month)) {
    deleteClosingMonth(ws, month);
  }

  // Find insert position — after last used row
  var row = ws.getLastRow() + 2;
  if (row < 4) row = 4;

  // Column widths
  ws.setColumnWidth(1,50); ws.setColumnWidth(2,110); ws.setColumnWidth(3,260);
  ws.setColumnWidth(4,160); ws.setColumnWidth(5,120); ws.setColumnWidth(6,130);

  // Month separator
  ws.getRange(row,1,1,6).merge()
    .setValue('━━━━━━  '+month+'  ━━━━━━')
    .setBackground(C.SEP_BG).setFontColor(C.NAVY)
    .setFontWeight('bold').setFontSize(12)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(row, 28);
  row++;

  // Headers
  var hdrs = ['S.NO','EMP ID','NAME','STATUS','BALANCE','PAYMENT STATUS'];
  for (var h=0;h<hdrs.length;h++) ws.getRange(row,h+1).setValue(hdrs[h]);
  ws.getRange(row,1,1,6).setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  ws.setRowHeight(row, 24);
  row++;

  // Sort employees by cluster order
  var empIds = Object.keys(consultants).sort(function(a,b){
    var oa=getClusterOrder(consultants[a].status), ob=getClusterOrder(consultants[b].status);
    return oa!==ob ? oa-ob : consultants[a].name.localeCompare(consultants[b].name);
  });

  var sno=1, dataStart=row, totalBal=0;

  for (var e=0; e<empIds.length; e++) {
    var emp = consultants[empIds[e]];
    if (isSkip(emp.status)) continue;
    var indiv = ss.getSheetByName(emp.empId);
    if (!indiv) continue;

    // Get balance for this specific month from individual sheet
    var balance = getMonthBalance(indiv, month);
    var ps      = checkMonthPaid(indiv, month) ? 'DONE' : 'NOT DONE';

    totalBal += balance;

    ws.getRange(row,1).setValue(sno).setHorizontalAlignment('center');
    ws.getRange(row,2).setRichTextValue(
      SpreadsheetApp.newRichTextValue().setText(emp.empId).setLinkUrl('#gid='+indiv.getSheetId()).build()
    ).setFontColor('#0563C1').setFontWeight('bold').setHorizontalAlignment('center');
    ws.getRange(row,3).setValue(emp.name);
    ws.getRange(row,4).setValue(emp.status);

    var bc = ws.getRange(row,5);
    bc.setValue(balance).setNumberFormat('$#,##0.00').setFontWeight('bold');
    if (balance<-0.5) { bc.setBackground(C.RED_BG).setFontColor(C.RED_TX); }
    else              { bc.setBackground(C.GRN_BG).setFontColor(C.GRN_TX); }

    var pc = ws.getRange(row,6);
    pc.setValue(ps).setHorizontalAlignment('center').setFontWeight('bold');
    if (ps==='DONE') { pc.setBackground(C.GRN_BG).setFontColor(C.GRN_TX); }
    else             { pc.setBackground(C.RED_BG).setFontColor(C.RED_TX); }

    if (sno%2===0) {
      ws.getRange(row,1).setBackground(C.ALT);
      ws.getRange(row,3).setBackground(C.ALT);
      ws.getRange(row,4).setBackground(C.ALT);
    }
    ws.setRowHeight(row, 20);
    row++; sno++;
  }

  // Total row
  ws.getRange(row,1,1,6).setBackground(C.TOT_BG);
  ws.getRange(row,3).setValue('TOTAL — '+month).setFontWeight('bold').setFontSize(11).setFontColor(C.NAVY);
  var tc = ws.getRange(row,5);
  tc.setValue(totalBal).setNumberFormat('$#,##0.00').setFontWeight('bold').setFontSize(12);
  if (totalBal<-0.5) { tc.setBackground(C.RED_BG).setFontColor(C.RED_TX); }
  else               { tc.setBackground(C.GRN_BG).setFontColor(C.GRN_TX); }
  ws.setRowHeight(row, 26);
}

// Delete a month section from closing balances
function deleteClosingMonth(ws, month) {
  var lr=ws.getLastRow(); if (lr<4) return;
  var vals=ws.getRange(1,1,lr,1).getValues();
  var first=-1, last=-1;
  var mo=month.toUpperCase();
  for (var i=0;i<vals.length;i++) {
    var v=(vals[i][0]||'').toString().toUpperCase();
    if (v.indexOf(mo)>=0) {
      if (first===-1) first=i+1;
      last=i+1;
    }
  }
  if (first===-1) return;
  // Delete from separator (2 rows above first match) to last+2
  var delStart = Math.max(4, first-1);
  var delCount = last - delStart + 3;
  ws.deleteRows(delStart, delCount);
}

// Get balance at end of specific month from individual sheet
function getMonthBalance(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return 0;
  var vals=ws.getRange(6,1,lr-5,15).getValues();
  var mo=month.toUpperCase();
  var lastBal=0, inMonth=false;

  for (var i=0;i<vals.length;i++) {
    var part=(vals[i][1]||'').toString().toUpperCase(); // col B = PARTICULARS
    var bal = parseFloat(vals[i][12])||0; // col M = BALANCE

    // Check if we entered next month
    if (part.indexOf('HOURS')>=0 || part.indexOf('PAYROLL')>=0 || part.indexOf('PAYMENT')>=0) {
      var rowMo = part.substring(0,8).trim();
      if (rowMo && rowMo!==mo && inMonth) break; // moved past target month
      if (rowMo===mo) inMonth=true;
    }
    if (inMonth && bal!==0) lastBal=bal;
  }
  return lastBal;
}

// Check if month is fully paid in individual sheet
function checkMonthPaid(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  var vals=ws.getRange(6,1,lr-5,15).getValues();
  var mo=month.toUpperCase();
  var hasDone=false, hasNotDone=false, inMonth=false;

  for (var i=0;i<vals.length;i++) {
    var part=(vals[i][1]||'').toString().toUpperCase();
    var rem =(vals[i][14]||'').toString().trim(); // col O = REMARKS

    if (part.indexOf(mo)>=0) inMonth=true;
    else if (inMonth && (part.indexOf("'2")>=0)) break; // new month

    if (inMonth) {
      if (rem==='DONE') hasDone=true;
      if (rem==='NOT DONE') hasNotDone=true;
    }
  }
  if (hasNotDone) return false;
  return hasDone;
}

function buildClosing(ss, consultants) {
  var ws = ss.getSheetByName(O.CLOSING);
  if (!ws) { ws=ss.insertSheet(O.CLOSING); ss.setActiveSheet(ws); ss.moveActiveSheet(1); }
  ws.clear();

  ws.getRange('A1').setValue('CLOSING BALANCES').setFontSize(18).setFontWeight('bold').setFontColor(C.NAVY);
  ws.getRange('A1:F1').merge().setHorizontalAlignment('center');
  ws.getRange('A2').setValue('Click EMP ID to view individual payment detail').setFontSize(10).setFontColor('#666666').setFontStyle('italic');
  ws.getRange('A2:F2').merge().setHorizontalAlignment('center');

  var hdrs = ['S.NO','EMP ID','NAME','STATUS','BALANCE','PAYMENT STATUS'];
  for (var h=0;h<hdrs.length;h++) ws.getRange(4,h+1).setValue(hdrs[h]);
  ws.getRange(4,1,1,6).setBackground(C.NAVY).setFontColor(C.WHITE).setFontWeight('bold').setFontSize(11).setHorizontalAlignment('center');
  ws.setFrozenRows(4); ws.setRowHeight(4,28);
  ws.setColumnWidth(1,50); ws.setColumnWidth(2,110); ws.setColumnWidth(3,260);
  ws.setColumnWidth(4,160); ws.setColumnWidth(5,120); ws.setColumnWidth(6,130);

  var row=5, sno=1;
  var empIds = Object.keys(consultants).sort(function(a,b){
    var oa=getClusterOrder(consultants[a].status), ob=getClusterOrder(consultants[b].status);
    return oa!==ob ? oa-ob : consultants[a].name.localeCompare(consultants[b].name);
  });

  for (var e=0; e<empIds.length; e++) {
    var emp   = consultants[empIds[e]];
    if (isSkip(emp.status)) continue;
    var indiv = ss.getSheetByName(emp.empId);
    if (!indiv) continue;

    var balance = getBalance(indiv);
    var ps      = checkPaid(indiv) ? 'DONE' : 'NOT DONE';

    ws.getRange(row,1).setValue(sno).setHorizontalAlignment('center');
    ws.getRange(row,2).setRichTextValue(
      SpreadsheetApp.newRichTextValue().setText(emp.empId).setLinkUrl('#gid='+indiv.getSheetId()).build()
    ).setFontColor('#0563C1').setFontWeight('bold').setHorizontalAlignment('center');
    ws.getRange(row,3).setValue(emp.name);
    ws.getRange(row,4).setValue(emp.status);

    var bc = ws.getRange(row,5);
    bc.setValue(balance).setNumberFormat('$#,##0.00').setFontWeight('bold');
    if (balance<-0.5) { bc.setBackground(C.RED_BG).setFontColor(C.RED_TX); }
    else              { bc.setBackground(C.GRN_BG).setFontColor(C.GRN_TX); }

    var pc = ws.getRange(row,6);
    pc.setValue(ps).setHorizontalAlignment('center').setFontWeight('bold');
    if (ps==='DONE') { pc.setBackground(C.GRN_BG).setFontColor(C.GRN_TX); }
    else             { pc.setBackground(C.RED_BG).setFontColor(C.RED_TX); }

    if (sno%2===0) { ws.getRange(row,1).setBackground(C.ALT); ws.getRange(row,3).setBackground(C.ALT); ws.getRange(row,4).setBackground(C.ALT); }
    row++; sno++;
  }

  ws.getRange(row,3).setValue('TOTAL').setFontWeight('bold');
  if (row>5) ws.getRange(row,5).setFormula('=SUM(E5:E'+(row-1)+')').setNumberFormat('$#,##0.00').setFontWeight('bold');
  ws.getRange(row,1,1,6).setBackground(C.SEP_BG);
}

// ── CONS SUMMARY ─────────────────────────────────────────────
function buildConsSummary(ss, master, consultants, rates, selectedMonth) {
  var ws = ss.getSheetByName(O.SUMMARY);
  if (!ws) { ws=ss.insertSheet(O.SUMMARY); setupSummaryHeader(ws); }

  // If specific month selected → delete that month and rewrite it only
  // If no month → clear all and rebuild
  if (selectedMonth) {
    if (summaryMonthExists(ws, selectedMonth)) deleteSummaryMonth(ws, selectedMonth);
  } else {
    ws.clear();
    setupSummaryHeader(ws);
  }

  // Determine which months to process
  var sortedMonths = [];
  if (selectedMonth) {
    sortedMonths = [selectedMonth];
  } else {
    // Collect all months from individual sheets
    var months = {};
    var empIds = Object.keys(consultants);
    for (var e=0; e<empIds.length; e++) {
      var indiv = ss.getSheetByName(empIds[e]);
      if (!indiv) continue;
      var lr = indiv.getLastRow();
      if (lr<6) continue;
      var vals = indiv.getRange(6,2,lr-5,1).getValues();
      for (var v=0; v<vals.length; v++) {
        var txt = (vals[v][0]||'').toString().toUpperCase();
        var mMatch = txt.match(/([A-Z]{3}'\d{4})\s+(HOURS|PAYROLL)/);
        if (mMatch) months[normMonth(mMatch[1])] = true;
      }
    }
    sortedMonths = Object.keys(months).sort(function(a,b){ return monthNum(a)-monthNum(b); });
  }

  if (!sortedMonths.length) {
    ss.toast('No data found.', 'UIT Paysheet', 4);
    return;
  }

  // Find insert position for selected month
  var row = selectedMonth ? findSummaryInsertRow(ws, selectedMonth) : 2;
  var sno = 1;

  for (var mi=0; mi<sortedMonths.length; mi++) {
    var month = sortedMonths[mi];

    // Read ADP data for this month for ER TAX — use cached raw data
    var adpRawC = readAdpRaw(master);
    var adpNorm = readAdpNormal(master, month, adpRawC);
    var adpAdj  = readAdpAdj(master, month, adpRawC);
    var adpSemi = readAdpSemi(master, month, adpRawC);

    // Gap + separator
    ws.getRange(row,1,1,13).setBackground(C.WHITE); row++;
    ws.getRange(row,1,1,13).merge()
      .setValue('━━━━━━  '+month+'  ━━━━━━')
      .setBackground(C.SEP_BG).setFontColor(C.SEP_TX)
      .setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    ws.setRowHeight(row,26); row++;

    var dataStart = row;

    // Write in cluster order
    var sortedEmps = Object.keys(consultants).sort(function(a,b){
      var oa=getClusterOrder(consultants[a].status), ob=getClusterOrder(consultants[b].status);
      return oa!==ob ? oa-ob : consultants[a].name.localeCompare(consultants[b].name);
    });

    for (var e=0; e<sortedEmps.length; e++) {
      var emp   = consultants[sortedEmps[e]];
      if (isSkip(emp.status)) continue;
      if (isAdj(emp.status)) continue; // No ADJ in CONS SUMMARY
      var indiv = ss.getSheetByName(emp.empId);
      if (!indiv) continue;

      // Check if this employee has data for this month
      var empHasMonth = empHasMonthData(indiv, month);
      if (!empHasMonth) continue;

      var rate    = rates[emp.empId] || { bill:0, dept:'', row:null };
      var conRate = rate.row ? getConRate(rate.row, emp.status) : 0;
      var bg      = isAdj(emp.status) ? C.ADJ_BG : (sno%2===0 ? C.ALT : C.WHITE);

      ws.getRange(row,1,1,13).setBackground(bg).setFontSize(10).setVerticalAlignment('middle');
      ws.getRange(row,1).setValue(sno);
      ws.getRange(row,2).setValue(month);
      ws.getRange(row,3).setValue(emp.empId);
      ws.getRange(row,4).setValue(emp.name);
      ws.getRange(row,5).setValue(emp.status);
      ws.getRange(row,6).setValue(rate.dept);

      if (isAdj(emp.status)) {
        // ADJ: show G-PAY (total paid) and EMP'RR-TAX only
        var adjData = adpAdj[emp.empId] || null;
        if (adjData) {
          ws.getRange(row,11).setValue(adjData.totalPaid).setNumberFormat('$#,##0.00'); // G-PAY = total paid
          ws.getRange(row,12).setValue(adjData.erLiab).setNumberFormat('$#,##0.00');    // EMP'RR-TAX
        }
      } else {
        // W2/SEMI/MONTHLY: full data
        var hrs = getHoursFromSheet(indiv, month);
        var rev = hrs * rate.bill;
        var gpay = hrs * conRate;
        var prof = rev - gpay; // erTax deducted after erTax calculated

        // ER TAX from ADP
        var erTax = 0;
        if (isSemi(emp.status)) {
          var semiData = adpSemi[emp.empId] || [];
          for (var sp=0; sp<semiData.length; sp++) erTax += semiData[sp].erLiab||0;
        } else {
          var normData = adpNorm[emp.empId] || null;
          if (normData) erTax = normData.erLiab||0;
        }

        prof = rev - gpay - erTax; // GROSS PROFIT = REVENUE − G-PAY − EMP'RR-TAX
        if (hrs>0)  ws.getRange(row,7).setValue(hrs).setNumberFormat('#,##0');
        if (rate.bill>0) ws.getRange(row,8).setValue(rate.bill).setNumberFormat('$#,##0.00');
        if (rev>0)  ws.getRange(row,9).setValue(rev).setNumberFormat('$#,##0.00');
        if (conRate>0) ws.getRange(row,10).setValue(conRate).setNumberFormat('$#,##0.00');
        if (gpay>0) ws.getRange(row,11).setValue(gpay).setNumberFormat('$#,##0.00');
        if (erTax>0) { ws.getRange(row,12).setValue(erTax).setNumberFormat('$#,##0.00'); }
        else         { ws.getRange(row,12).setBackground(C.YEL_BG); }
        if (prof!==0) {
          var pc = ws.getRange(row,13);
          pc.setValue(prof).setNumberFormat('$#,##0.00');
          if (prof>0) pc.setFontColor(C.GRN_TX).setFontWeight('bold');
          else        pc.setFontColor(C.RED_TX).setFontWeight('bold');
        }
      }
      row++; sno++;
    }

    // Totals row
    var dataEnd = row-1;
    ws.getRange(row,1,1,13).setBackground(C.TOT_BG).setFontWeight('bold');
    ws.getRange(row,4).setValue('TOTAL — '+month).setFontSize(11);
    ws.getRange(row,7).setFormula('=SUM(G'+dataStart+':G'+dataEnd+')').setNumberFormat('#,##0');
    ws.getRange(row,9).setFormula('=SUM(I'+dataStart+':I'+dataEnd+')').setNumberFormat('$#,##0.00');
    ws.getRange(row,11).setFormula('=SUM(K'+dataStart+':K'+dataEnd+')').setNumberFormat('$#,##0.00');
    ws.getRange(row,12).setFormula('=SUM(L'+dataStart+':L'+dataEnd+')').setNumberFormat('$#,##0.00');
    ws.getRange(row,13).setFormula('=SUM(M'+dataStart+':M'+dataEnd+')').setNumberFormat('$#,##0.00');
    row++;
  }
}

function summaryMonthExists(ws, month) {
  var lr=ws.getLastRow(); if (lr<2) return false;
  var vals=ws.getRange(2,2,lr-1,1).getValues();
  for (var i=0;i<vals.length;i++) if ((vals[i][0]||'').toString().trim()===month) return true;
  return false;
}
function deleteSummaryMonth(ws, month) {
  var lr=ws.getLastRow(); if (lr<2) return;
  var vals=ws.getRange(2,2,lr-1,1).getValues();
  var first=-1, last=-1;
  for (var i=0;i<vals.length;i++) {
    if ((vals[i][0]||'').toString().trim()===month) { if (first===-1) first=i+2; last=i+2; }
  }
  if (first===-1) return;
  ws.deleteRows(Math.max(2,first-2), last-Math.max(2,first-2)+2);
}
function findSummaryInsertRow(ws, month) {
  var lr=ws.getLastRow(); if (lr<2) return 2;
  var vals=ws.getRange(2,2,lr-1,1).getValues();
  for (var i=0;i<vals.length;i++) {
    var v=(vals[i][0]||'').toString().trim();
    if (v&&monthNum(v)>monthNum(month)) return i+2;
  }
  return lr+2;
}
function setupSummaryHeader(ws) {
  var hdrs = ['S NO','MONTH','EMP ID','CONSULTANTS','STATUS','TEAM','HOURS','BILL RATE','GROSS REVENUE','PAY RATE','G-PAY',"EMP'RR-TAX",'GROSS PROFIT'];
  ws.getRange(1,1,1,13).setValues([hdrs])
    .setBackground(C.NAVY).setFontColor(C.WHITE)
    .setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setFrozenRows(1); ws.setRowHeight(1,28);
  ws.getRange(1,12).setBackground(C.YEL_BG).setFontColor(C.NAVY);
  var w = [50,90,80,220,140,100,70,90,120,90,100,100,110];
  for (var i=0;i<w.length;i++) ws.setColumnWidth(i+1,w[i]);
}

// ── INDIVIDUAL SHEET HEADER ──────────────────────────────────
// Batched API calls — minimum requests to Google Sheets API
function buildHeader(ws, emp, billRate, conRate, openBal) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var cls = ss.getSheetByName(O.CLOSING);

  // Row 1 — Name and EMP ID (batched)
  ws.getRange('A1:O1').merge()
    .setValue(emp.name+' — '+emp.empId)
    .setFontSize(14).setFontWeight('bold')
    .setFontColor(C.NAVY).setHorizontalAlignment('center');

  // Row 2 — Bill/Con rate info (batched)
  var info = (!isAdj(emp.status) && conRate>0) ? 'Bill: $'+billRate+'  |  Con-rate: $'+conRate : '';
  ws.getRange('A2:O2').merge()
    .setValue(info).setFontSize(10)
    .setFontColor('#666666').setHorizontalAlignment('center');

  // Row 3 — Back link (batched)
  ws.getRange('A3:O3').merge().setHorizontalAlignment('center');
  if (cls) {
    ws.getRange('A3').setRichTextValue(
      SpreadsheetApp.newRichTextValue()
        .setText('← Back to Closing Balances')
        .setLinkUrl('#gid='+cls.getSheetId()).build()
    ).setFontSize(10).setFontColor('#0563C1');
  } else {
    ws.getRange('A3').setValue('← Back to Closing Balances')
      .setFontSize(10).setFontColor('#0563C1');
  }

  // Row 5 — Headers (one batch write)
  var hdrs = [['DATE','PARTICULARS','STATUS','HOURS','B-RATE','C-RATE','AMOUNT','OTH AMT','E TAX','TAX','INSU OTH','PAYMENT','BALANCE','DATE','REMARKS']];
  ws.getRange(5,1,1,15).setValues(hdrs)
    .setBackground(C.NAVY).setFontColor(C.WHITE)
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setFrozenRows(5);

  // Column widths (one batch)
  var w = [96,220,130,60,70,70,90,90,80,80,70,100,100,96,120];
  for (var i=0;i<w.length;i++) ws.setColumnWidth(i+1,w[i]);

  // Row 6 — Opening balance (batched if exists)
  if (openBal!==0) {
    ws.getRange(6,1,1,15).setBackground(C.SEP_BG).setFontSize(10).setVerticalAlignment('middle');
    ws.getRange(6,2).setValue('OPENING BALANCE').setFontWeight('bold');
    ws.getRange(6,13).setValue(openBal).setNumberFormat('$#,##0.00').setFontWeight('bold');
    colBal(ws,6,13,openBal);
  }
}

// ── UTILITIES ────────────────────────────────────────────────
function rowBg(ws,row,bg) { ws.getRange(row,1,1,15).setBackground(bg).setFontSize(10).setVerticalAlignment('middle'); }
function colBal(ws,row,col,val) {
  var cell=ws.getRange(row,col); cell.setFontWeight('bold');
  if (val<-0.5) { cell.setBackground(C.RED_BG).setFontColor(C.RED_TX); }
  else          { cell.setBackground(C.GRN_BG).setFontColor(C.GRN_TX); }
}
function writeSep(ws, month) {
  var lr=ws.getLastRow()+1; if (lr<7) lr=7;
  ws.getRange(lr,1,1,15).setBackground(C.WHITE); lr++;
  ws.getRange(lr,1,1,15).merge()
    .setValue('━━━━━━  '+month+'  ━━━━━━')
    .setBackground(C.SEP_BG).setFontColor(C.SEP_TX)
    .setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(lr,26);
}
function getBalance(ws) {
  var lr=ws.getLastRow(); if (lr<6) return 0;
  var vals=ws.getRange(6,13,lr-5,1).getValues();
  for (var i=vals.length-1;i>=0;i--) { var v=vals[i][0]; if (v!==''&&v!==null&&!isNaN(parseFloat(v))) return parseFloat(v); }
  return 0;
}
function removeBalRow(ws) {
  var lr=ws.getLastRow(); if (lr<6) return;
  var vals=ws.getRange(6,2,lr-5,1).getValues();
  for (var i=vals.length-1;i>=0;i--) {
    if ((vals[i][0]||'').toString().trim()==='CURRENT BALANCE') {
      ws.deleteRow(i+6);
      if (i+5>=6) { var above=ws.getRange(i+5,1,1,15).getValues()[0]; if (above.every(function(v){ return v===''||v===null; })) ws.deleteRow(i+5); }
      return;
    }
  }
}
function writeBalRow(ws, bal) {
  var gap=ws.getLastRow()+1;
  ws.getRange(gap,1,1,15).setBackground(C.WHITE);
  var br=gap+1;
  rowBg(ws,br,C.SEP_BG);
  ws.getRange(br,2).setValue('CURRENT BALANCE').setFontWeight('bold').setFontSize(11);
  ws.getRange(br,13).setValue(bal).setNumberFormat('$#,##0.00').setFontWeight('bold').setFontSize(12);
  colBal(ws,br,13,bal); ws.setRowHeight(br,28);
}
function paymentRowExists(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  var vals=ws.getRange(6,2,lr-5,1).getValues();
  for (var i=0;i<vals.length;i++) {
    var v=(vals[i][0]||'').toString().toUpperCase();
    if (v.indexOf(month.toUpperCase())>=0&&v.indexOf('PAYMENT')>=0) return true;
  }
  return false;
}
function payrollRowExistsCheck(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  var vals=ws.getRange(6,2,lr-5,1).getValues();
  for (var i=0;i<vals.length;i++) {
    var v=(vals[i][0]||'').toString().toUpperCase();
    if (v.indexOf(month.toUpperCase())>=0&&v.indexOf('PAYROLL')>=0) return true;
  }
  return false;
}
function monthRowExists(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  var vals=ws.getRange(6,2,lr-5,1).getValues();
  for (var i=0;i<vals.length;i++) { var v=(vals[i][0]||'').toString().toUpperCase(); if (v.indexOf(month.toUpperCase())>=0&&(v.indexOf('HOURS')>=0||v.indexOf('PAYROLL')>=0)) return true; }
  return false;
}
function payrollRowExists(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  var vals=ws.getRange(6,2,lr-5,1).getValues();
  for (var i=0;i<vals.length;i++) { var v=(vals[i][0]||'').toString().toUpperCase(); if (v.indexOf(month.toUpperCase())>=0&&v.indexOf('PAYROLL')>=0) return true; }
  return false;
}
function deleteSheetMonth(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return;
  var vals=ws.getRange(6,2,lr-5,1).getValues();
  var first=-1, last=-1;
  for (var i=0;i<vals.length;i++) { var v=(vals[i][0]||'').toString().toUpperCase(); if (v.indexOf(month.toUpperCase())>=0) { if (first===-1) first=i+6; last=i+6; } }
  if (first===-1) return;
  ws.deleteRows(Math.max(6,first-2), last-Math.max(6,first-2)+1);
}
function checkPaid(ws) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  var vals=ws.getRange(6,15,lr-5,1).getValues(); var hasDone=false;
  for (var i=0;i<vals.length;i++) { var v=(vals[i][0]||'').toString().trim(); if (v==='NOT DONE') return false; if (v==='DONE') hasDone=true; }
  return hasDone;
}
function empHasMonthData(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  var vals=ws.getRange(6,2,lr-5,1).getValues();
  for (var i=0;i<vals.length;i++) { var v=(vals[i][0]||'').toString().toUpperCase(); if (v.indexOf(month.toUpperCase())>=0) return true; }
  return false;
}
function getHoursFromSheet(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return 0;
  var vals=ws.getRange(6,1,lr-5,15).getValues();
  for (var i=0;i<vals.length;i++) {
    var part=(vals[i][1]||'').toString().toUpperCase();
    if (part.indexOf(month.toUpperCase())>=0 && part.indexOf('HOURS')>=0) {
      return parseFloat(vals[i][3])||0; // col D = HOURS
    }
  }
  return 0;
}// Check if separator already exists for this month
// Check if IMMI/MED/EXP rows already written for this month
function immiRowExists(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  var vals=ws.getRange(6,2,lr-5,1).getValues();
  var mo = month.toUpperCase();
  for (var i=0;i<vals.length;i++) {
    var v=(vals[i][0]||'').toString().toUpperCase();
    if (v.indexOf(mo)>=0 && (
      v.indexOf('IMMI')>=0 ||
      v.indexOf('ATTORNEY')>=0 ||
      v.indexOf('MEDICAL')>=0 ||
      v.indexOf('DENTAL')>=0 ||
      v.indexOf('EXP-REIM')>=0
    )) return true;
  }
  return false;
}

function sepExists(ws, month) {
  var lr=ws.getLastRow(); if (lr<6) return false;
  // Check BOTH col A and col B since separator is a merged row
  var valsA=ws.getRange(6,1,lr-5,1).getValues();
  var valsB=ws.getRange(6,2,lr-5,1).getValues();
  for (var i=0;i<valsA.length;i++) {
    var a=(valsA[i][0]||'').toString().toUpperCase();
    var b=(valsB[i][0]||'').toString().toUpperCase();
    if (a.indexOf(month.toUpperCase())>=0) return true;
    if (b.indexOf(month.toUpperCase())>=0) return true;
  }
  return false;
}


