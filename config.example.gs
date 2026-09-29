// ============================================================
// CONFIGURATION — Copy this file and fill in your sheet IDs
// DO NOT commit real IDs to version control
// ============================================================

// ── OUTPUT SHEET CONFIG ──────────────────────────────────────
// Paste this at the top of OUTPUT_SHEET.gs
// Replace with your actual MASTER sheet ID from the URL:
// https://docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit

var MASTER_ID = 'YOUR_MASTER_SHEET_ID_HERE';

// ── MASTER SHEET NAMES ───────────────────────────────────────
// These must match your exact sheet tab names in MASTER sheet
var SHEET_NAMES = {
  CONSULTANTS : 'CONSULTANTS LIST',   // Employee master list
  TIMESHEETS  : 'TIMESHEETS',         // Weekly hours
  RATES       : 'RATES',              // Bill rates, pay rates
  ADP_PAYROLL : 'ADP-PAYROLL-SUM',   // Payroll tax summary
  AUTO_RETURN : 'AUTO RETURN',        // Return entries
  BOA         : 'BOA-2026',          // Bank 1 payments
  B1BANK      : 'B1BANK-2026',       // Bank 2 payments
  GPB         : 'GPB-2026',          // Bank 3 payments
  OP_BALANCES : 'OP BALANCES',        // Opening balances
  IMMI_FEES   : 'IMMI FEES',         // Immigration fees
  MED_INS     : 'MED INSURANCE'      // Medical insurance
};

// ── OUTPUT SHEET NAMES ───────────────────────────────────────
var OUTPUT_SHEETS = {
  CLOSING : 'CLOSING BALANCES',
  SUMMARY : 'CONS SUMMARY',
  LOCKS   : 'MONTH LOCKS'
};

// ── EMPLOYEE STATUS TYPES ────────────────────────────────────
// Modify if your status names differ
var STATUS = {
  NORMAL   : ['W2', 'W2-R'],
  MONTHLY  : ['W2-SLK-MONTHLY'],
  SEMI     : ['W2-SLK-SEMI MONTHLY'],
  W2B      : ['W2-B'],
  C2C      : ['C2C', 'C2C-P'],
  SKIP     : ['W2-MGMT', 'W2-ADMIN']
};
