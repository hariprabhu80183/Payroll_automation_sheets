# 🏗️ Architecture

## Data Flow

```
MASTER SHEET (Data Source)
        │
        ├── CONSULTANTS LIST  → Employee master data
        ├── TIMESHEETS        → Weekly hours per employee
        ├── RATES             → Bill rate, pay rate, C2C rate
        ├── ADP-PAYROLL-SUM   → Payroll tax data
        ├── BOA / B1BANK / GPB→ Bank payment records
        ├── IMMI FEES         → Immigration fees per employee
        ├── MED INSURANCE     → Medical/dental insurance
        └── AUTO RETURN       → Manual return entries
                │
                ▼ (via openById)
OUTPUT SHEET (Processing Engine)
        │
        ├── Individual Sheets → One per consultant
        ├── CONS SUMMARY      → Monthly aggregated view
        ├── CLOSING BALANCES  → Monthly balance snapshot
        ├── C2C SUMMARY       → C2C consultant view
        └── DASHBOARD         → KPI visualization
```

## Key Design Decisions

### 1. Separation of MASTER and OUTPUT
- MASTER = raw data entry
- OUTPUT = processed results
- Allows multiple output formats without touching source data

### 2. Batch Processing
- 200+ employees cannot be processed in one 6-minute Apps Script run
- Solution: 4.5-minute timer → auto-stop → resume on next click
- Skips already-processed employees → safe to rerun

### 3. Read-Once Optimization
- ADP sheet read once → passed to all 3 ADP reader functions
- Bank sheets read once → shared by payment and EXP-REIM readers
- Reduces API calls from 15+ to 5 per button click

### 4. Month-by-Month Architecture
- Each month processed independently
- Lock system prevents double-processing
- Any month can be rerun without affecting others

### 5. Balance Calculation
Each individual sheet maintains a running balance:
```
Opening Balance
+ Hours Amount (hours × con rate)
- Employee Tax (from ADP)
- [Employer Tax for W2-B]
- Bank Payment
- Immigration Fees
- Medical Insurance
- Expense Reimbursements
= Current Balance
```

## Employee Type Flows

### W2 / W2-SLK-MONTHLY
```
HOURS → PAYROLL (emp tax) → PAYMENT (bank) → IMMI/MED
```

### W2-SLK-SEMI MONTHLY
```
HOURS → PAYROLL P1 (P1 tax) → PAYROLL P2 (P2 tax) → PAYMENT (ADP DD)
```

### W2-B (Special)
```
HOURS → PAYROLL (emp tax + er tax) → PAYMENT (bank)
```

### C2C / C2C-P
```
HOURS × BILL RATE = Revenue
HOURS × C2C RATE  = G-Pay
Revenue - G-Pay   = Profit
(No tax processing)
```
