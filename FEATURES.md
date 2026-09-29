# ✨ Features

## MASTER Sheet Features

### ▶ Run Hours
- Reads weekly timesheets for all employees
- Calculates gross amounts using correct rate per status
- Fills SUMMARY sheet with revenue, G-Pay, ER Tax, Profit
- Rate selection:
  - W2/W2-R → F C RATE
  - W2-SLK-MONTHLY → CON RATE
  - W2-SLK-SEMI MONTHLY → CON RATE
  - C2C/C2C-P → C2C RATE

### 💰 Run Payroll
- Calculates GROSS REVENUE, G-PAY, GROSS PROFIT
- GROSS PROFIT = REVENUE − G-PAY − ER TAX
- Updates SUMMARY sheet

### 📋 Run C2C Summary
- Separate summary for C2C and C2C-P employees
- Simple: Revenue vs G-Pay vs Profit
- No tax calculations
- C2C first → C2C-P second (cluster order)

### 🔒 Lock System
- Lock any processed month
- Locked months cannot be rerun
- Unlock available if correction needed

### 📋 Rate History (onEdit trigger)
- Auto-detects rate changes in RATES sheet
- Popup with Dallas timestamp (editable)
- Saves entire old row to RATE HISTORY sheet
- Full audit trail of all rate changes

---

## OUTPUT Sheet Features

### ▶ 1. Run Hours
- Creates individual sheet per consultant
- Fills HOURS row with date, hours, rates, amount
- Batch processing — handles 200+ employees
- Auto-resumes if timeout occurs
- ADJ employees get sheet only (no hours)

### 💰 2. Run Tax & Payments
- PAYROLL rows with tax deductions
- PAYMENT rows from bank sheets (BOA, B1BANK, GPB)
- Split bank payments — each bank shown separately
- Semi-monthly: P1+P2 combined ADP payment
- Immigration fees from IMMI FEES sheet
- Medical/dental from MED INSURANCE sheet
- Expense reimbursements from bank EXP-REIM rows
- RET rows from AUTO RETURN sheet
- Smart skip: if payroll exists → only adds payment

### 📊 3. Update Cons Summary
- Select month → updates only that month
- Same cluster order as MASTER SUMMARY
- ER TAX from ADP (P1+P2 combined for semi)
- GROSS PROFIT = REVENUE − G-PAY − ER TAX

### 🔄 4. Update Closing Balances
- Monthly snapshot per employee
- Clickable EMP ID → links to individual sheet
- Red = negative, Green = positive
- DONE / NOT DONE payment status
- Total per month

### 👤 Run Single Employee
- Enter EMP ID → select month or ALL MONTHS
- Runs Hours + Tax & Payments for one employee
- All other employees completely untouched
- Perfect for fixing individual consultant sheets

### 📈 Dashboard
- KPI cards: Revenue, G-Pay, ER Tax, Profit, Margin%, Hours, Not Paid
- Revenue vs G-Pay bar chart
- Monthly profit trend line chart
- Month-over-month comparison with ▲▼ arrows
- Employee balance status counts
- Pending payments list

---

## Individual Consultant Ledger

Each sheet shows complete month-by-month history:

```
NAME — EMP ID
Bill: $X | Con-rate: $Y
← Back to Closing Balances

DATE | PARTICULARS | STATUS | HRS | B-RATE | C-RATE | AMOUNT | OTH AMT | E TAX | TAX | INSU OTH | PAYMENT | BALANCE | DATE | REMARKS

━━━━━━  JAN'2026  ━━━━━━
[HOURS row]
[PAYROLL row]
[PAYMENT row] DONE/NOT DONE
[IMMI FEE rows]
[MED INSURANCE rows]
[EXP-REIM rows]

━━━━━━  FEB'2026  ━━━━━━
...

CURRENT BALANCE
```
