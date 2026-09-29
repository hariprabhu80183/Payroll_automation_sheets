// ============================================================
// UIT PAYSHEET — MASTER SHEET COMPLETE CODE V2
// Changes:
// 1. SUMMARY driven by TIMESHEETS (not CONSULTANTS LIST)
// 2. AUTO RETURN sheet added for W2-ADJ employees
// ============================================================

// ── SHEET NAMES ─────────────────────────────────────────────
var CFG = {
  SUMMARY     : 'SUMMARY',
  CONSULTANTS : 'CONSULTANTS LIST',
  TIMESHEETS  : 'TIMESHEETS',
  RATES       : 'RATES',
  ADP_PAYROLL : 'ADP-PAYROLL-SUM',
  ADJ_PAYROLL : 'ADJ PAYROLL SUM',
  ADJ_RETURN  : 'ADJ RT',
  AUTO_RETURN : 'AUTO RETURN',
  BOA         : 'BANK1-YEAR',
  B1BANK      : 'BANK2-YEAR',
  GPB         : 'BANK3-YEAR',
  LOCKS       : 'LOCKS'
};

// ── VERIFIED COLUMN POSITIONS ────────────────────────────────
// CONSULTANTS LIST: A=S NO | B=EMP CODE | C=Employee name | D=STATUS
// TIMESHEETS: A=EMP ID | J=TOTAL | M=MONTH
// RATES: A=EMP CODE | F=DEPT | G=BILL RATE | J=F W2 RATE
// ADP-PAYROLL-SUM: A=Month | C=EMP CODE | F=Total Paid | G=Emp Tax | I=Net Pay | K=Employer Liability | L=Total Expenses
// Semi-monthly payroll periods for a specific month
// Handles: JAN'(1-15), JAN(1-15), JAN"(16-30) formats
function readSemiPayrollForMonth(ss, month) {
  var ws=ss.getSheetByName(CFG.ADP_PAYROLL);
  if (!ws) return {};
  var d=ws.getDataRange().getValues(), r={};
  for (var i=1;i<d.length;i++) {
    var mo=d[i][0], emp=d[i][2];
    if (!mo||!emp) continue;
    if (!isSemiPeriod(mo)) continue; // only semi period rows
    var payDate=d[i][13]||null; // col N = Payment date
    var bm=semiToBaseMonth(mo, payDate);
    if (!bm||bm!==month) continue;
    var k=emp.toString().trim();
    if (!r[k]) r[k]=[];
    r[k].push({
      totalPaid: parseFloat(d[i][5])||0,
      empTax   : parseFloat(d[i][6])||0,
      erLiab   : parseFloat(d[i][10])||0,
      netPay   : parseFloat(d[i][8])||0,
      payDate  : payDate
    });
  }
  return r;
}

// ADJ PAYROLL SUM: same columns as ADP
// AUTO RETURN: A=S NO | B=FIRST | C=LAST | D=STATUS | E=PAYROLL | F=TAX | G=PAYCHECK | H=EMP TAX | I=TOTAL | J=RECEIVED | K=ADVANCE | L=PAID TO | M=MONTH

// ── STATUS GROUPS (cluster order in SUMMARY) ─────────────────
var STATUS_GROUPS = [
  { types:['W2','W2-R'],                                             kind:'NORMAL' },
  { types:['W2-SLK-SEMI MONTHLY'],                                   kind:'SEMI'   },
  { types:['W2-SLK-MONTHLY'],                                        kind:'NORMAL' },
  { types:['W2-ADJ','W2-ADJ-O','W2-ADJ-H','W2-ADJ-OTH','W2-OTH'], kind:'ADJ'    }
];

// ── COLORS ───────────────────────────────────────────────────
var CLR = {
  NAVY:'#1F4E79', WHITE:'#FFFFFF',
  GRN_BG:'#C6EFCE', GRN_TX:'#006100',
  RED_BG:'#FFC7CE', RED_TX:'#9C0006',
  YEL_BG:'#FFFF00', SEP_BG:'#D6E4F0', SEP_TX:'#1F4E79',
  TOT_BG:'#BDD7EE', ADJ_BG:'#FAEEDA', ALT:'#F2F7FB'
};

// ── HELPERS ──────────────────────────────────────────────────
function normMonth(raw) {
  if (!raw) return '';
  var MN=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  if (raw instanceof Date) return MN[raw.getMonth()]+"'"+raw.getFullYear();
  var s=raw.toString().trim().toUpperCase().replace(/\s/g,'');
  var m=s.match(/^([A-Z]{3})'?(\d{4})$/);
  if (m&&MN.indexOf(m[1])>=0) return m[1]+"'"+m[2];
  return s;
}
function baseMonth(raw) {
  if (!raw) return '';
  var MN=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var s=raw.toString().trim().toUpperCase();
  // Check if regular month format JAN'2026
  var reg=s.replace(/\s/g,'').match(/^([A-Z]{3})'?(\d{4})$/);
  if (reg&&MN.indexOf(reg[1])>=0) return reg[1]+"'"+reg[2];
  // Check if semi period: JAN'(1-15), JAN(1-15), JAN"(16-30) etc
  // Just extract first 3 letters - year comes from payment date
  var mMatch=s.match(/^([A-Z]{3})/);
  if (mMatch&&MN.indexOf(mMatch[1])>=0) {
    // Has bracket = semi period, return as-is for isSemiPeriod to handle
    if (/[\(\["]/.test(s)) return s;
  }
  return normMonth(raw);
}

function isSemiPeriod(raw) {
  if (!raw) return false;
  var s=raw.toString().trim();
  return /^[A-Za-z]{3}['"\s]*[\(\[]/.test(s);
}

// Convert semi period to base month using payment date for year
// Handles: JAN'(1-15), JAN(1-15), JAN"(16-30), JAN'(16-31)
function semiToBaseMonth(rawMonth, payDate) {
  if (!rawMonth) return '';
  var MN=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var s=rawMonth.toString().trim().toUpperCase();
  // Extract only first 3 letters
  var mMatch=s.match(/^([A-Z]{3})/);
  if (!mMatch||MN.indexOf(mMatch[1])===-1) return '';
  var mon=mMatch[1];
  // Get year from payment date
  var year='';
  if (payDate instanceof Date) { year=payDate.getFullYear().toString(); }
  else if (payDate) { var d=new Date(payDate); if (!isNaN(d.getTime())) year=d.getFullYear().toString(); }
  if (!year) year='2026';
  return mon+"'"+year;
}
function monthNum(m) {
  var mi={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
  var p=m.match(/([A-Z]{3})'(\d{4})/);
  return p?parseInt(p[2])*100+(mi[p[1]]||0):0;
}
function getGroupOrder(s) {
  if (!s) return 99;
  s=s.toString().trim().toUpperCase();
  for (var g=0;g<STATUS_GROUPS.length;g++)
    for (var t=0;t<STATUS_GROUPS[g].types.length;t++)
      if (STATUS_GROUPS[g].types[t].toUpperCase()===s) return g;
  return 99;
}
function isAdj(s) {
  if (!s) return false;
  return getGroupOrder(s)===3; // ADJ is group 3
}

// ── MENU ─────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('UIT Paysheet')
    .addItem('⚙️  Setup (run once)','setupMaster')
    .addSeparator()
    .addItem('▶  Run Hours','runHours')
    .addItem('💰 Run Payroll','runPayroll')
    .addSeparator()
    .addItem('🔒 Lock a Month','lockMonth')
    .addItem('🔓 Unlock a Month','unlockMonth')
    .addToUi();
}

function setupMaster() {
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  setupLockSheet(ss);
  setupSummaryHeader(ss);
  setupAutoReturnHeader(ss);
  ss.toast('✅ Setup done! Use Run Hours → Run Payroll.','UIT Paysheet',5);
}

// ── DATA READERS ─────────────────────────────────────────────

// CONSULTANTS LIST: B=EMP CODE(idx1), C=name(idx2), D=STATUS(idx3)
// Returns lookup map — used to enrich timesheet data
function readConsultants(ss) {
  var ws=ss.getSheetByName(CFG.CONSULTANTS);
  if (!ws) return {};
  var d=ws.getDataRange().getValues(), r={};
  for (var i=1;i<d.length;i++) {
    var emp=d[i][1]; // B = EMP CODE
    if (!emp) continue;
    r[emp.toString().trim()]={
      name  : (d[i][2]||'').toString().trim(), // C
      status: (d[i][3]||'').toString().trim()  // D
    };
  }
  return r;
}

// RATES: A=EMP CODE(idx0), F=DEPT(idx5), G=BILL(idx6), J=FW2(idx9)
function readRates(ss) {
  var ws=ss.getSheetByName(CFG.RATES);
  if (!ws) return {};
  var d=ws.getDataRange().getValues(), r={};
  for (var i=1;i<d.length;i++) {
    var emp=d[i][1]; // col B = EMP CODE (col A is S.NO)
    if (!emp) continue;
    var k=emp.toString().trim();
    if (r[k]) continue;
    r[k]={
      bill    : parseFloat(d[i][6])||0,  // G = BILL RATE
      conRate : parseFloat(d[i][9])||0,  // J = F C RATE (W2)
      slkRate : parseFloat(d[i][7])||0,  // H = CON- RATE (MONTHLY/SEMI)
      c2cRate : parseFloat(d[i][10])||0, // K = C2C RATE
      dept    : (d[i][5]||'').toString().trim() // F
    };
  }
  return r;
}

// TIMESHEETS: A=EMP ID(idx0), J=TOTAL(idx9), M=MONTH(idx12)
// Returns employees who have hours in the selected month
// THIS IS NOW THE MAIN KEY FOR SUMMARY
function readTimesheetsForMonth(ss, month) {
  var ws=ss.getSheetByName(CFG.TIMESHEETS);
  if (!ws) throw new Error('Sheet not found: '+CFG.TIMESHEETS);
  var d=ws.getDataRange().getValues(), r=[];
  for (var i=1;i<d.length;i++) {
    var emp=d[i][0];  // A = EMP ID
    var tot=d[i][9];  // J = TOTAL
    var mo =d[i][12]; // M = MONTH
    if (!emp||!mo) continue;
    if (normMonth(mo)!==month) continue;
    var hours=parseFloat(tot)||0;
    if (hours<=0) continue; // skip zero hours
    r.push({
      empId : emp.toString().trim(),
      hours : hours
    });
  }
  return r;
}

// ADP-PAYROLL-SUM: A=Month(idx0), C=EMP CODE(idx2)
function readAdpPayroll(ss, month) {
  var ws=ss.getSheetByName(CFG.ADP_PAYROLL);
  if (!ws) return {};
  var d=ws.getDataRange().getValues(), r={};
  for (var i=1;i<d.length;i++) {
    var mo=d[i][0], emp=d[i][2];
    if (!mo||!emp) continue;
    var nm=normMonth(mo), bm=baseMonth(mo);
    if (nm!==bm) continue; // skip semi periods
    if (nm!==month) continue;
    r[emp.toString().trim()]={
      totalPaid: parseFloat(d[i][5]) ||0, // F
      empTax   : parseFloat(d[i][6]) ||0, // G
      erLiab   : parseFloat(d[i][10])||0, // K
      netPay   : parseFloat(d[i][8]) ||0  // I
    };
  }
  return r;
}

// ADJ employees are in ADP-PAYROLL-SUM filtered by W2-ADJ status
// Returns ALL ADJ entries for the month (for AUTO RETURN sheet)
var ADJ_STATUSES = ['W2-ADJ','W2-ADJ-O','W2-ADJ-H','W2-ADJ-OTH','W2-OTH'];
function isAdjStatus(s) {
  if (!s) return false;
  s = s.toString().trim().toUpperCase();
  return ADJ_STATUSES.some(function(x){ return x.toUpperCase()===s; });
}
function readAdjPayroll(ss, month) {
  var ws=ss.getSheetByName(CFG.ADP_PAYROLL); // same sheet as ADP
  if (!ws) return [];
  var d=ws.getDataRange().getValues(), r=[];
  for (var i=1;i<d.length;i++) {
    var mo    = d[i][0]; // A = Month
    var nm    = d[i][1]; // B = Name
    var emp   = d[i][2]; // C = EMP CODE
    var status= d[i][3]; // D = STATUS
    if (!mo||!emp) continue;
    if (isSemiPeriod(mo)) continue; // skip semi period rows
    if (normMonth(mo)!==month) continue;
    if (!isAdjStatus(status)) continue; // only W2-ADJ types
    r.push({
      empId    : emp.toString().trim(),
      fullName : nm.toString().trim(),
      month    : month,
      totalPaid: parseFloat(d[i][5]) ||0,  // F = Total Paid → PAYROLL
      empTax   : parseFloat(d[i][6]) ||0,  // G = Emp Tax → TAX
      netPay   : parseFloat(d[i][8]) ||0,  // I = Net Pay → PAYCHECK
      erLiab   : parseFloat(d[i][10])||0,  // K = Employer Liability → EMP TAX
      totalExp : parseFloat(d[i][11])||0   // L = Total Expenses → TOTAL
    });
  }
  return r;
}

// All available months from TIMESHEETS + ADP + ADJ
function readMonths(ss) {
  var months={};
  var checks=[[CFG.TIMESHEETS,12],[CFG.ADP_PAYROLL,0],[CFG.ADJ_PAYROLL,0]];
  for (var s=0;s<checks.length;s++) {
    var ws=ss.getSheetByName(checks[s][0]);
    if (!ws) continue;
    var d=ws.getDataRange().getValues(), c=checks[s][1];
    for (var i=1;i<d.length;i++) { var mo=d[i][c]; if (mo) months[baseMonth(mo)]=true; }
  }
  return Object.keys(months).sort(function(a,b){ return monthNum(a)-monthNum(b); });
}

// ── LOCK SYSTEM ──────────────────────────────────────────────
function setupLockSheet(ss) {
  if (!ss) ss=SpreadsheetApp.getActiveSpreadsheet();
  var ws=ss.getSheetByName(CFG.LOCKS);
  if (!ws) {
    ws=ss.insertSheet(CFG.LOCKS);
    ws.getRange(1,1,1,3).setValues([['LOCKED MONTH','LOCKED ON','LOCKED BY']]);
    ws.getRange(1,1,1,3).setBackground(CLR.NAVY).setFontColor(CLR.WHITE).setFontWeight('bold');
    ws.setColumnWidth(1,140); ws.setColumnWidth(2,160); ws.setColumnWidth(3,220);
    ws.hideSheet();
  }
}
function getLocks(ss) {
  if (!ss) ss=SpreadsheetApp.getActiveSpreadsheet();
  var ws=ss.getSheetByName(CFG.LOCKS);
  if (!ws) return {};
  var d=ws.getDataRange().getValues(), r={};
  for (var i=1;i<d.length;i++) { if (d[i][0]) r[d[i][0].toString().trim()]=true; }
  return r;
}
function lockMonth() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  var all=readMonths(ss), lks=getLocks(ss);
  if (!all.length) { ui.alert('No months found.'); return; }
  var list='';
  for (var i=0;i<all.length;i++) list+=(i+1)+'.  '+all[i]+(lks[all[i]]?'  🔒':'')+'\n';
  var res=ui.prompt('🔒 Lock a Month','Months:\n\n'+list+'\nEnter number:',ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton()!==ui.Button.OK) return;
  var num=parseInt(res.getResponseText().trim())-1;
  if (isNaN(num)||num<0||num>=all.length) { ui.alert('Invalid.'); return; }
  var month=all[num];
  if (lks[month]) { ui.alert('Already locked!'); return; }
  setupLockSheet(ss);
  var ws=ss.getSheetByName(CFG.LOCKS), lr=ws.getLastRow()+1;
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
  var ws=ss.getSheetByName(CFG.LOCKS), d=ws.getDataRange().getValues();
  for (var i=1;i<d.length;i++) {
    if (d[i][0]&&d[i][0].toString().trim()===month) { ws.deleteRow(i+1); break; }
  }
  ui.alert('🔓 '+month+' unlocked.');
}
function pickMonth(ss, title) {
  if (!ss) ss=SpreadsheetApp.getActiveSpreadsheet();
  var ui=SpreadsheetApp.getUi();
  var all=readMonths(ss);
  if (!all.length) { ui.alert('No data found in sheets.'); return null; }
  var lks=getLocks(ss), list='';
  for (var i=0;i<all.length;i++) list+=(i+1)+'.  '+(lks[all[i]]?'🔒 ':'')+all[i]+'\n';
  var res=ui.prompt(title,'Available months:\n\n'+list+'\nEnter number:',ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton()!==ui.Button.OK) return null;
  var num=parseInt(res.getResponseText().trim())-1;
  if (isNaN(num)||num<0||num>=all.length) { ui.alert('Invalid number.'); return null; }
  var month=all[num];
  if (lks[month]) { ui.alert('🔒 '+month+' is LOCKED.'); return null; }
  return month;
}

// ── RUN HOURS ─────────────────────────────────────────────────
// 1. Fills SUMMARY from TIMESHEETS (main key)
// 2. Fills AUTO RETURN from ADJ PAYROLL SUM
function runHours() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  try {
    var month=pickMonth(ss,'▶ Run Hours — Select Month');
    if (!month) return;
    ss.toast('Reading data for '+month+'...','UIT Paysheet',5);

    // Read all needed data
    var consultants = readConsultants(ss);
    var rates       = readRates(ss);
    var tsEmps      = readTimesheetsForMonth(ss, month);
    var adpPayroll  = readAdpPayroll(ss, month);
    var semiPayroll = readSemiPayrollForMonth(ss, month);
    var adjPayroll  = readAdjPayroll(ss, month);

    // Fill SUMMARY sheet
    ss.toast('Filling SUMMARY sheet...','UIT Paysheet',5);
    fillSummary(ss, month, tsEmps, consultants, rates, adpPayroll, semiPayroll);

    // Fill AUTO RETURN sheet
    ss.toast('Filling AUTO RETURN sheet...','UIT Paysheet',5);
    fillAutoReturn(ss, month, adjPayroll, consultants);

    ss.toast('✅ Hours done for '+month+'! Now click Run Payroll.','UIT Paysheet',5);
  } catch(err) {
    ui.alert('❌ Error:\n\n'+err.message);
    Logger.log(err.stack);
  }
}

// ── RUN PAYROLL ───────────────────────────────────────────────
// Calculates GROSS REVENUE, G-PAY, GROSS PROFIT for selected month
function runPayroll() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  try {
    var ws=ss.getSheetByName(CFG.SUMMARY);
    if (!ws) { ui.alert('Run Hours first.'); return; }
    var month=pickMonth(ss,'💰 Run Payroll — Select Month');
    if (!month) return;
    ss.toast('Calculating payroll for '+month+'...','UIT Paysheet',5);
    var lr=ws.getLastRow();
    if (lr<2) { ui.alert('No data. Run Hours first.'); return; }
    var data=ws.getRange(2,1,lr-1,13).getValues();
    for (var i=0;i<data.length;i++) {
      var mo    =(data[i][1]||'').toString().trim(); // col B = MONTH
      var empId =(data[i][2]||'').toString().trim(); // col C = EMP ID
      if (mo!==month||!empId) continue;
      var row    =i+2;
      var hours  =parseFloat(data[i][6]) ||0; // col G = HOURS
      var bill   =parseFloat(data[i][7]) ||0; // col H = BILL RATE
      var payRate=parseFloat(data[i][9]) ||0; // col J = PAY RATE
      var revenue=hours*bill;
      var gpay   =hours*payRate;
      // Read ER TAX from col L for this row
      var erTaxVal=parseFloat(data[i][11])||0; // col L = EMP'RR-TAX
      var profit =revenue-gpay-erTaxVal; // GROSS PROFIT = REVENUE − G-PAY − EMP'RR-TAX
      if (revenue>0) ws.getRange(row,9).setValue(revenue).setNumberFormat('$#,##0.00');
      if (gpay>0)    ws.getRange(row,11).setValue(gpay).setNumberFormat('$#,##0.00');
      if (profit!==0) {
        var pc=ws.getRange(row,13);
        pc.setValue(profit).setNumberFormat('$#,##0.00');
        pc.setFontColor(profit>0?CLR.GRN_TX:CLR.RED_TX).setFontWeight('bold');
      }
    }
    ss.toast('✅ Payroll calculated for '+month+'!','UIT Paysheet',4);
  } catch(err) {
    ui.alert('❌ Error:\n\n'+err.message);
    Logger.log(err.stack);
  }
}

// ── FILL SUMMARY SHEET ────────────────────────────────────────
// Main key = TIMESHEETS
// Everyone who has hours in that month appears — regardless of CONSULTANTS LIST
function fillSummary(ss, month, tsEmps, consultants, rates, adpPayroll, semiPayroll) {
  if (!semiPayroll) semiPayroll = {};
  var ws=ss.getSheetByName(CFG.SUMMARY);
  if (!ws) throw new Error('SUMMARY sheet not found. Run Setup first.');

  // Delete existing month if present
  if (monthExistsInSummary(ws,month)) deleteSummaryMonth(ws,month);

  if (!tsEmps.length) {
    ss.toast('No hours found in TIMESHEETS for '+month,'UIT Paysheet',4);
    return;
  }

  // Sort by group order (W2 → SEMI → MONTHLY → unknown at end)
  tsEmps.sort(function(a,b) {
    var conA=consultants[a.empId]||{status:''};
    var conB=consultants[b.empId]||{status:''};
    var orderA=getGroupOrder(conA.status);
    var orderB=getGroupOrder(conB.status);
    if (orderA!==orderB) return orderA-orderB;
    return a.empId.localeCompare(b.empId);
  });

  // Find insert position
  var insertRow=findInsertRow(ws,month);
  ws.insertRowsBefore(insertRow, tsEmps.length+3);
  var r=insertRow;

  // Gap row
  ws.getRange(r,1,1,13).setBackground(CLR.WHITE); r++;

  // Month separator
  ws.getRange(r,1,1,13).merge()
    .setValue('━━━━━━  '+month+'  ━━━━━━')
    .setBackground(CLR.SEP_BG).setFontColor(CLR.SEP_TX)
    .setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(r,26); r++;

  var dataStart=r;

  for (var i=0;i<tsEmps.length;i++) {
    var emp     = tsEmps[i];
    var con     = consultants[emp.empId] || { name:emp.empId, status:'' };
    var rate    = rates[emp.empId]       || { bill:0, conRate:0, slkRate:0, c2cRate:0, dept:'' };
    // Select correct PAY RATE based on status
    var payRate = 0;
    var st = con.status.toUpperCase();
    if (st==='C2C'||st==='C2C-P')                           payRate = rate.c2cRate; // K = C2C RATE
    else if (st==='W2-SLK-MONTHLY'||st.indexOf('SEMI')>-1)  payRate = rate.slkRate; // H = CON- RATE
    else                                                      payRate = rate.conRate; // J = F C RATE (W2)
    var adp     = adpPayroll[emp.empId]  || null;
    var con_status = con.status || '';
    // For SEMI: sum P1+P2 erLiab. For others: use adp erLiab
    var erTax = 0;
    if (con_status.toUpperCase().indexOf('SEMI') > -1) {
      var semiPrs = semiPayroll[emp.empId] || [];
      for (var sp=0; sp<semiPrs.length; sp++) erTax += semiPrs[sp].erLiab||0;
    } else {
      erTax = adp ? adp.erLiab : 0;
    }
    var bg      = i%2===0 ? CLR.WHITE : CLR.ALT;

    ws.getRange(r,1,1,13).setBackground(bg).setFontSize(10).setVerticalAlignment('middle');
    ws.getRange(r,1).setValue('');               // S NO (renumbered after)
    ws.getRange(r,2).setValue(month);            // MONTH
    ws.getRange(r,3).setValue(emp.empId);        // EMP ID
    ws.getRange(r,4).setValue(con.name);         // CONSULTANTS
    ws.getRange(r,5).setValue(con.status);       // STATUS
    ws.getRange(r,6).setValue(rate.dept);        // TEAM
    ws.getRange(r,7).setValue(emp.hours).setNumberFormat('#,##0'); // HOURS
    if (rate.bill>0) ws.getRange(r,8).setValue(rate.bill).setNumberFormat('$#,##0.00');   // BILL RATE
    // col 9 = GROSS REVENUE → Run Payroll fills
    if (payRate>0)   ws.getRange(r,10).setValue(payRate).setNumberFormat('$#,##0.00');    // PAY RATE
    // col 11 = G-PAY → Run Payroll fills
    // col 12 = EMP'RR-TAX
    if (erTax>0) { ws.getRange(r,12).setValue(erTax).setNumberFormat('$#,##0.00'); }
    else         { ws.getRange(r,12).setBackground(CLR.YEL_BG); }
    // col 13 = PROFIT → Run Payroll fills
    r++;
  }

  var dataEnd=r-1;

  // Totals row
  ws.getRange(r,1,1,13).setBackground(CLR.TOT_BG).setFontWeight('bold');
  ws.getRange(r,4).setValue('TOTAL — '+month).setFontSize(11);
  ws.getRange(r,7).setFormula('=SUM(G'+dataStart+':G'+dataEnd+')').setNumberFormat('#,##0');
  ws.getRange(r,9).setFormula('=SUM(I'+dataStart+':I'+dataEnd+')').setNumberFormat('$#,##0.00');
  ws.getRange(r,11).setFormula('=SUM(K'+dataStart+':K'+dataEnd+')').setNumberFormat('$#,##0.00');
  ws.getRange(r,12).setFormula('=SUM(L'+dataStart+':L'+dataEnd+')').setNumberFormat('$#,##0.00');
  ws.getRange(r,13).setFormula('=SUM(M'+dataStart+':M'+dataEnd+')').setNumberFormat('$#,##0.00');

  renumberSummary(ws);
}

// ── FILL AUTO RETURN SHEET ────────────────────────────────────
// Only W2-ADJ employees from ADJ PAYROLL SUM
// Auto fills up to TOTAL column — rest left empty for manual entry
function fillAutoReturn(ss, month, adjPayroll, consultants) {
  if (!adjPayroll.length) return; // no ADJ data for this month

  var ws=ss.getSheetByName(CFG.AUTO_RETURN);
  if (!ws) { ws=ss.insertSheet(CFG.AUTO_RETURN); setupAutoReturnHeader(ws); }

  var sno=ws.getLastRow(); // continue S NO from last row
  if (sno<1) sno=1;

  for (var i=0;i<adjPayroll.length;i++) {
    var adj=adjPayroll[i];
    // Check if this emp+month already exists in AUTO RETURN → skip
    if (autoReturnExists(ws, adj.empId, month)) continue;

    // Get name parts — try CONSULTANTS LIST first, fall back to ADP name
    var con=consultants[adj.empId]||{name:'',status:''};
    var nameSource = con.name || adj.fullName || '';
    var nameParts=splitName(nameSource);
    var status=con.status||'W2-ADJ';

    var lr=ws.getLastRow()+1;
    ws.getRange(lr,1).setValue(lr-1);              // A = S NO
    ws.getRange(lr,2).setValue(nameParts.first);   // B = FIRST
    ws.getRange(lr,3).setValue(nameParts.last);    // C = LAST
    ws.getRange(lr,4).setValue(status);            // D = STATUS
    ws.getRange(lr,5).setValue(adj.totalPaid).setNumberFormat('$#,##0.00'); // E = PAYROLL
    ws.getRange(lr,6).setValue(adj.empTax).setNumberFormat('$#,##0.00');    // F = TAX
    ws.getRange(lr,7).setValue(adj.netPay).setNumberFormat('$#,##0.00');    // G = PAYCHECK
    ws.getRange(lr,8).setValue(adj.erLiab).setNumberFormat('$#,##0.00');    // H = EMP TAX
    ws.getRange(lr,9).setValue(adj.totalExp).setNumberFormat('$#,##0.00');  // I = TOTAL
    // J=RECEIVED, K=ADVANCE, L=PAID TO → left empty (manual)
    ws.getRange(lr,13).setValue(month);            // M = MONTH
    ws.getRange(lr,14).setValue(adj.empId);        // N = EMP ID (for duplicate check)

    // Light formatting
    ws.getRange(lr,1,1,14).setFontSize(10).setVerticalAlignment('middle');
    if ((lr-1)%2===0) ws.getRange(lr,1,1,14).setBackground(CLR.ALT);
  }
}

// Split "Kagitha, Kavitha" → {first:'KAVITHA', last:'KAGITHA'}
// Or "Kavitha Kagitha" → {first:'KAVITHA', last:'KAGITHA'}
function splitName(fullName) {
  if (!fullName) return {first:'',last:''};
  var parts=fullName.split(',');
  if (parts.length>=2) {
    return { last:parts[0].trim().toUpperCase(), first:parts[1].trim().toUpperCase() };
  }
  var words=fullName.trim().split(/\s+/);
  if (words.length>=2) {
    return { first:words[0].toUpperCase(), last:words[words.length-1].toUpperCase() };
  }
  return { first:fullName.toUpperCase(), last:'' };
}

// Check if EMP ID + MONTH already in AUTO RETURN
// Checks col C (EMP CODE equivalent - we use FIRST+LAST) and col M (MONTH)
function autoReturnExists(ws, empId, month) {
  var lr=ws.getLastRow();
  if (lr<2) return false;
  // We store empId in a hidden way - check by matching month + row count
  // Better: check col M=MONTH and we need to track empId
  // Since we don't store empId directly, check MONTH + PAYROLL amount
  // Simplest: store empId in col N (after MONTH col M)
  var vals=ws.getRange(2,13,lr-1,2).getValues(); // col M=MONTH, col N=EMPID
  for (var i=0;i<vals.length;i++) {
    var rowMonth = (vals[i][0]||'').toString().trim();
    var rowEmpId = (vals[i][1]||'').toString().trim();
    if (rowMonth===month && rowEmpId===empId) return true;
  }
  return false;
}

// ── SUMMARY HELPERS ───────────────────────────────────────────
function monthExistsInSummary(ws,month) {
  var lr=ws.getLastRow(); if (lr<2) return false;
  var vals=ws.getRange(2,2,lr-1,1).getValues();
  for (var i=0;i<vals.length;i++) if ((vals[i][0]||'').toString().trim()===month) return true;
  return false;
}
function deleteSummaryMonth(ws,month) {
  var lr=ws.getLastRow(); if (lr<2) return;
  var vals=ws.getRange(2,2,lr-1,1).getValues();
  var first=-1,last=-1;
  for (var i=0;i<vals.length;i++) { if ((vals[i][0]||'').toString().trim()===month) { if (first===-1) first=i+2; last=i+2; } }
  if (first===-1) return;
  ws.deleteRows(Math.max(2,first-2),last-Math.max(2,first-2)+2);
}
function findInsertRow(ws,month) {
  var lr=ws.getLastRow(); if (lr<2) return 2;
  var vals=ws.getRange(2,2,lr-1,1).getValues();
  for (var i=0;i<vals.length;i++) { var v=(vals[i][0]||'').toString().trim(); if (v&&monthNum(v)>monthNum(month)) return i+2; }
  return lr+2;
}
function renumberSummary(ws) {
  var lr=ws.getLastRow(); if (lr<2) return;
  var vals=ws.getRange(2,3,lr-1,1).getValues(); var sno=1;
  for (var i=0;i<vals.length;i++) {
    var row=i+2;
    if ((vals[i][0]||'').toString().trim()) ws.getRange(row,1).setValue(sno++).setHorizontalAlignment('center');
    else ws.getRange(row,1).setValue('');
  }
}

// ── SETUP HEADERS ─────────────────────────────────────────────
function setupSummaryHeader(ss) {
  var ws=ss.getSheetByName(CFG.SUMMARY);
  if (!ws) { ws=ss.insertSheet(CFG.SUMMARY); ss.moveActiveSheet(1); }
  var hdrs=['S NO','MONTH','EMP ID','CONSULTANTS','STATUS','TEAM','HOURS','BILL RATE','GROSS REVENUE','PAY RATE','G-PAY',"EMP'RR-TAX",'GROSS PROFIT'];
  ws.getRange(1,1,1,13).setValues([hdrs])
    .setBackground(CLR.NAVY).setFontColor(CLR.WHITE)
    .setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(1,28); ws.setFrozenRows(1);
  ws.getRange(1,12).setBackground(CLR.YEL_BG).setFontColor(CLR.NAVY)
    .setNote('Auto from ADP. Yellow = data missing.');
  var w=[50,90,80,220,140,100,70,90,120,90,100,100,110];
  for (var i=0;i<w.length;i++) ws.setColumnWidth(i+1,w[i]);
}

function setupAutoReturnHeader(ss) {
  var ws;
  if (ss.getSheetByName) { ws=ss.getSheetByName(CFG.AUTO_RETURN); }
  else { ws=ss; } // called with sheet directly
  if (!ws) { ws=ss.insertSheet(CFG.AUTO_RETURN); }
  if (ws.getLastRow()>0) return; // already set up
  var hdrs=['S NO','FIRST','LAST','STATUS','PAYROLL','TAX','PAYCHECK','EMP TAX','TOTAL','RECEIVED','ADVANCE','PAID TO','MONTH','EMP CODE'];
  ws.getRange(1,1,1,14).setValues([hdrs])
    .setBackground(CLR.NAVY).setFontColor(CLR.WHITE)
    .setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  ws.setRowHeight(1,28); ws.setFrozenRows(1);
  // Mark auto-filled columns (A-I) and manual columns (J-L)
  ws.getRange(1,10,1,3).setBackground('#7B2C2C').setNote('Fill manually: RECEIVED, ADVANCE, PAID TO');
  var w=[50,100,100,120,100,90,100,90,100,100,90,100,100];
  for (var i=0;i<w.length;i++) ws.setColumnWidth(i+1,w[i]);
}


// ── RATE HISTORY ─────────────────────────────────────────────
// Sheet name for rate history
var RATE_HISTORY_SHEET = 'RATE HISTORY';

// Rate columns that trigger history save (1-based)
// Col 7=BILL RATE, Col 8=CON RATE, Col 10=FC RATE, Col 11=C2C RATE
var RATE_COLS = [7, 8, 10, 11];

// onEdit trigger — watches RATES sheet for rate column changes
function onEdit(e) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = e.range.getSheet();
    var col   = e.range.getColumn();
    var row   = e.range.getRow();

    // Only trigger on RATES sheet
    if (sheet.getName() !== CFG.RATES) return;

    // Only trigger on rate columns
    if (RATE_COLS.indexOf(col) === -1) return;

    // Skip header row
    if (row <= 1) return;

    // Get old value (before edit)
    var oldVal = e.oldValue;
    if (!oldVal || oldVal === '') return; // skip if no old value

    // Get entire row data
    var rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    var empCode = rowData[1]; // col B = EMP CODE
    var empName = rowData[2]; // col C = NAME
    if (!empCode) return;

    // Get Dallas time
    var dalласTime = Utilities.formatDate(
      new Date(),
      'America/Chicago',
      'MM/dd/yyyy'
    );

    // Show popup with editable date
    var ui = SpreadsheetApp.getUi();
    var colName = sheet.getRange(1, col).getValue();
    var res = ui.prompt(
      '📋 Rate Change Detected',
      'Employee: ' + empCode + ' — ' + empName + '
' +
      'Column changed: ' + colName + '
' +
      'Old value: $' + oldVal + '

' +
      'Effective from date (Dallas time):
' +
      '(Edit if needed, then click OK)',
      ui.ButtonSet.OK_CANCEL
    );

    if (res.getSelectedButton() !== ui.Button.OK) return;

    var effectiveDate = res.getResponseText().trim() || dalласTime;

    // Save to RATE HISTORY sheet
    saveRateHistory(ss, rowData, effectiveDate, oldVal, colName);

  } catch(err) {
    Logger.log('onEdit error: ' + err.message);
  }
}

// Save entire row to RATE HISTORY sheet
function saveRateHistory(ss, rowData, effectiveDate, oldVal, colName) {
  var ws = ss.getSheetByName(RATE_HISTORY_SHEET);
  if (!ws) {
    ws = ss.insertSheet(RATE_HISTORY_SHEET);
    setupRateHistoryHeader(ws);
  }

  var changedBy = Session.getActiveUser().getEmail();
  var lr = ws.getLastRow() + 1;

  // Write: DATE CHANGED | all original row data | CHANGED COL | OLD VALUE | EFFECTIVE DATE | CHANGED BY
  var saveRow = [effectiveDate].concat(rowData).concat([colName, oldVal, effectiveDate, changedBy]);
  ws.getRange(lr, 1, 1, saveRow.length).setValues([saveRow]);
  ws.getRange(lr, 1).setNumberFormat('MM/DD/YYYY');
}

// Setup RATE HISTORY sheet header
function setupRateHistoryHeader(ws) {
  var hdrs = [
    'DATE CHANGED','S NO','EMP CODE','NAME','START DATE','STATUS',
    'DEPT','BILL RATE','CON RATE','ADMIN','FC RATE','C2C RATE',
    'CUSTOMER','COLUMN CHANGED','OLD VALUE','EFFECTIVE DATE','CHANGED BY'
  ];
  ws.getRange(1, 1, 1, hdrs.length).setValues([hdrs])
    .setBackground('#1F4E79').setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center');
  ws.setFrozenRows(1);
  ws.setRowHeight(1, 26);
  // Column widths
  var w = [110,50,90,180,100,100,90,90,90,70,90,90,120,120,90,110,180];
  for (var i=0; i<w.length; i++) ws.setColumnWidth(i+1, w[i]);
}
