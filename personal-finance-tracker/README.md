# Personal Finance Excel Tracker

Structured Excel workbook for tracking **loans**, **school fees**, **EMIs**, and **other expenses**, with a **dashboard per category** plus an overall overview.

## Quick start

```bash
cd personal-finance-tracker
python create_finance_template.py
```

This creates `Personal_Finance_Tracker.xlsx`. Upload it to OneDrive or copy its structure into your existing file.

## Analyze your current OneDrive file

1. Download your Excel file from OneDrive to this machine (or upload it into the workspace).
2. Run:

```bash
python analyze_workbook.py /path/to/your/current-file.xlsx
```

You'll get sheet-by-sheet suggestions for missing columns, structural issues, and dashboard naming.

## Recommended structure

| Sheet | Purpose |
|-------|---------|
| `Overview_Dashboard` | Family-wide spending mix (pie chart + KPIs) |
| `Loans` + `Loans_Dashboard` | Home/car/personal loan payments |
| `School_Fees` + `School_Fees_Dashboard` | Per-child school fee tracking |
| `EMIs` + `EMIs_Dashboard` | Appliance, card, and vendor EMIs |
| `Other_Expenses` + `Other_Dashboard` | Groceries, utilities, healthcare, etc. |
| `Setup` | Dropdown lists (payment methods, statuses, categories) |

### Design rules

- **One row = one payment or due entry** — do not mix summary totals into the transaction log.
- **Consistent columns** across sheets: `Entry_Date`, amounts as numbers, `Status`, `Payment_Method`, `Notes`.
- **Excel Tables** on each data sheet so formulas and charts expand automatically when you add rows.
- **Dashboard sheets** only contain KPIs, helper pivot tables, and charts — never raw transaction entry.

## OneDrive workflow

1. Generate or customize the template locally.
2. Upload to OneDrive (or open in Excel Online).
3. Enter new transactions in the `*_` data sheets only.
4. Review summaries on the matching `*_Dashboard` tabs each month.
5. Pin `Overview_Dashboard` as your first tab for a quick health check.
