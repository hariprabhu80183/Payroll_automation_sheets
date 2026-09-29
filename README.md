# 💼 Payroll Automation System — Google Sheets & Apps Script

> A fully automated payroll management system built with Google Apps Script, designed to handle end-to-end payroll processing for 200+ consultants across multiple months — eliminating manual effort and reducing processing time from days to minutes.

![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google%20Sheets-34A853?style=for-the-badge&logo=google-sheets&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---

## 🚀 Overview

This system automates the entire payroll lifecycle for a consulting firm managing **200+ employees** across **multiple employment types** (W2, Semi-Monthly, C2C). Built entirely in Google Apps Script with zero external dependencies.

### ⚡ What it replaces
- Manual Excel calculations prone to human error
- Hours of monthly payroll reconciliation
- Scattered bank payment tracking across 3 banks
- No audit trail for rate changes or payment history

### ✅ What it delivers
- One-click payroll processing per month
- Automated individual consultant ledger sheets
- Real-time balance tracking with color-coded status
- Multi-bank payment reconciliation
- Immigration fee and medical insurance tracking
- Interactive KPI dashboard
- Complete rate change history

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   MASTER SHEET                       │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Consultants │  │Timesheets│  │  ADP Payroll  │  │
│  │    List     │  │ (Weekly) │  │   Summary     │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │    Rates    │  │  Banks   │  │  Immi + Med   │  │
│  │  + History  │  │ BOA/B1/G │  │   Insurance   │  │
│  └─────────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  OUTPUT SHEET                        │
│  ┌─────────────────────────────────────────────┐   │
│  │     Individual Consultant Ledger Sheets      │   │
│  │   (Auto-generated per employee per month)   │   │
│  └─────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌────────────────────────────┐  │
│  │ CONS SUMMARY │  │   CLOSING BALANCES         │  │
│  │ (Monthly)    │  │   (Monthly per employee)   │  │
│  └──────────────┘  └────────────────────────────┘  │
│  ┌──────────────┐  ┌────────────────────────────┐  │
│  │  C2C SUMMARY │  │      DASHBOARD             │  │
│  │  (Separate)  │  │   (KPIs + Charts)          │  │
│  └──────────────┘  └────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
payroll-automation-sheets/
├── src/
│   ├── master/
│   │   ├── MASTER_SHEET.gs       # Core payroll logic
│   │   └── RATE_HISTORY.gs       # Rate change tracking
│   ├── output/
│   │   ├── OUTPUT_SHEET.gs       # Individual ledger generation
│   │   └── C2C_SUMMARY.gs        # C2C consultant summary
│   └── dashboard/
│       └── DASHBOARD.gs          # KPI dashboard
├── config/
│   └── config.example.gs         # Configuration template
├── docs/
│   ├── ARCHITECTURE.md           # System design details
│   ├── SETUP.md                  # Step-by-step setup guide
│   └── FEATURES.md               # Complete feature list
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🧩 Employee Types Supported

| Type | Description | Flow |
|------|-------------|------|
| **W2** | Standard hourly employees | Hours → Payroll → Bank Payment |
| **W2-SLK-SEMI MONTHLY** | Bi-monthly payroll employees | Hours → P1 Tax → P2 Tax → ADP Payment |
| **W2-SLK-MONTHLY** | Monthly salary employees | Hours → Payroll → Bank Payment |
| **W2-B** | Special category with dual tax | Hours → Both taxes → Bank Payment |
| **C2C / C2C-P** | Corp-to-Corp contractors | Hours → Revenue → C2C Pay |

---

## ✨ Key Features

### 🔢 Master Sheet
- **Run Hours** — Reads weekly timesheets, calculates amounts per employee
- **Run Payroll** — Processes tax calculations, generates SUMMARY sheet
- **Rate History** — Auto-captures rate changes with Dallas timestamp via `onEdit` trigger
- **Lock System** — Locks processed months to prevent accidental edits
- **C2C Summary** — Separate summary for Corp-to-Corp consultants

### 📊 Output Sheet
- **4-button workflow** — Run Hours → Run Tax & Payments → Update Cons Summary → Update Closing Balances
- **Individual Ledger Sheets** — Auto-generated per consultant showing full month-by-month breakdown
- **Batch Processing** — Handles 200+ employees with smart timeout prevention (4.5 min timer)
- **Single Employee Run** — Process any one employee for any month without affecting others
- **Split Bank Payments** — Tracks payments across 3 banks (BOA, B1BANK, GPB)
- **IMMI Fees + Medical Insurance** — Automatically deducted from consultant balance
- **Expense Reimbursements** — EXP-REIM tracking per employee
- **Semi-Monthly Processing** — Correctly handles P1+P2 ADP payments
- **Closing Balances** — Monthly snapshot with green/red indicators

### 📈 Dashboard
- KPI cards — Revenue, G-Pay, ER Tax, Profit, Margin %, Hours
- Revenue vs G-Pay bar chart
- Monthly profit trend line chart
- Employee balance status (positive vs negative)
- Pending payments list

---

## 🛠️ Tech Stack

- **Google Apps Script** (ES5 JavaScript)
- **Google Sheets API** (Spreadsheet service)
- **No external libraries or dependencies**
- **No backend server required**

---

## ⚙️ Setup

See [docs/SETUP.md](docs/SETUP.md) for complete step-by-step instructions.

**Quick start:**
1. Copy `config/config.example.gs` → set your sheet IDs
2. Paste each `.gs` file into Apps Script
3. Run `setupMaster()` and `setupOutput()` once
4. Use the menu buttons in order

---

## 📐 Individual Consultant Ledger

Each consultant gets an auto-generated sheet showing:

```
━━━━━━  JAN'2026  ━━━━━━
DATE     | PARTICULARS        | HRS | B-RATE | C-RATE | AMOUNT  | TAX    | PAYMENT | BALANCE
         | JAN'2026 HOURS     | 160 | $85    | $70    | $11,200 |        |         | $11,200
03/18/26 | JAN'2026 PAYROLL   |     |        |        |         | $1,510 |         | $9,690
03/18/26 | JAN'2026 PAYMENT   |     |        |        |         |        | $9,371  | $319    DONE
01/29/26 | JAN'2026 IMMI FEE  |     |        |        |         |        |         | -$2,561 (INSU OTH)
         | JAN'2026 MED INS   |     |        |        |         |        |         | -$3,821
```

---

## 🔒 Security

- **No hardcoded credentials** — All IDs in config file
- **Lock system** — Prevents reprocessing of finalized months
- **Rate history audit trail** — Every rate change logged with timestamp and user email
- **No sensitive data in repo** — All real data stays in Google Sheets

---

## 📊 Scale

- **200+ consultants** processed monthly
- **6+ months** of historical data
- **3 bank sources** reconciled automatically
- **Multiple fee types** tracked per consultant
- Processing time: **~4-5 minutes** for full monthly run (vs hours manually)

---

## 👨‍💻 Author

**Hari Prabhu Naraharisetty**
- GitHub: [@hariprabhu80183](https://github.com/hariprabhu80183)
- Built over **4 months** of iterative development
- Sole developer — from architecture to deployment

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

Built to solve a real-world payroll challenge — turning a manual, error-prone monthly process into a reliable automated system used in production.
