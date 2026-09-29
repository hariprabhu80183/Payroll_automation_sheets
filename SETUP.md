# ⚙️ Setup Guide

## Prerequisites

- Google Account
- Access to Google Sheets and Google Apps Script
- Two Google Sheets (MASTER and OUTPUT)

---

## Step 1 — Create Your Sheets

1. Create a new Google Sheet → name it **MASTER SHEET**
2. Create another Google Sheet → name it **OUTPUT SHEET**
3. Copy the Sheet IDs from the URLs:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
   ```

---

## Step 2 — Configure

1. Open `config/config.example.gs`
2. Copy it and fill in your Sheet IDs:
   ```javascript
   var MASTER_ID = 'your-master-sheet-id-here';
   ```

---

## Step 3 — Set Up MASTER Sheet

1. Open MASTER Sheet → **Extensions → Apps Script**
2. Create new file → paste `src/master/MASTER_SHEET.gs`
3. Create new file → paste `src/master/RATE_HISTORY.gs`
4. Add C2C Summary → paste `src/output/C2C_SUMMARY.gs`
5. Save all → Refresh sheet
6. Click **UIT Paysheet → ⚙️ Setup (run once)**

### Required sheet tabs in MASTER:
- `CONSULTANTS LIST`
- `TIMESHEETS`
- `RATES`
- `ADP-PAYROLL-SUM`
- `AUTO RETURN`
- `OP BALANCES`
- `BOA-2026`
- `B1BANK-2026`
- `GPB-2026`
- `IMMI FEES`
- `MED INSURANCE`

---

## Step 4 — Set Up OUTPUT Sheet

1. Open OUTPUT Sheet → **Extensions → Apps Script**
2. Paste `src/output/OUTPUT_SHEET.gs`
3. Create new file → paste `src/dashboard/DASHBOARD.gs`
4. Set MASTER_ID at top of OUTPUT_SHEET.gs
5. Save → Refresh sheet
6. Click **UIT Paysheet → ⚙️ Setup (run once)**

---

## Step 5 — Monthly Workflow

### MASTER Sheet (run first):
```
1. ▶ Run Hours      → fills SUMMARY + AUTO RETURN
2. 💰 Run Payroll   → calculates revenue, G-Pay, profit
3. 🔒 Lock Month    → locks processed month
```

### OUTPUT Sheet (run after MASTER):
```
1. ▶ Run Hours              → creates individual sheets
2. 💰 Run Tax & Payments    → adds payroll + payment rows
3. 📊 Update Cons Summary   → select month → updates summary
4. 🔄 Update Closing Balances → select month → updates balances
5. 📋 Run C2C Summary       → updates C2C sheet
```

---

## Step 6 — Set Up onEdit Trigger (Rate History)

1. Apps Script → **Triggers** (clock icon)
2. Add trigger:
   - Function: `onEdit`
   - Event: `From spreadsheet → On edit`
3. Save

This enables automatic rate change history logging.

---

## Tips

- Always run MASTER first, then OUTPUT
- Lock months after processing to prevent accidental edits
- Use **👤 Run Single Employee** to fix individual consultant sheets
- Dashboard reads from CONS SUMMARY — run that first
