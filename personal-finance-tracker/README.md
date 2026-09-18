# Personal Finance Tracker

Tools and a rebuilt Excel workbook based on `Personal_Finance_Master_OneDrive.xlsx`.

## Files

| File | Purpose |
|------|---------|
| `source/Personal_Finance_Master_OneDrive.xlsx` | Your original OneDrive workbook (unchanged) |
| `Personal_Finance_Master_Restructured.xlsx` | **Use this going forward** — cleaned data + a dashboard per area |
| `rebuild_master.py` | Regenerates the restructured file from the source |
| `create_finance_template.py` | Generic blank template (optional) |
| `analyze_workbook.py` | Prints structural issues in any `.xlsx` |

```bash
cd personal-finance-tracker
python rebuild_master.py
```

Upload `Personal_Finance_Master_Restructured.xlsx` to OneDrive and keep the original as archive.

## What was wrong in the original file

1. **Amounts stored as text** (`₹40,000`) — `SUM`, charts, and remaining-balance formulas cannot add those cells. Phupa remaining showed `#VALUE!` for this reason.
2. **Summaries mixed into data sheets** — School Fees totals in columns L–P, Chit combined totals in rows 6–9, EMI total in the same list as lenders. That blocks Excel Tables and filters.
3. **Dashboard only covered the friend ledger** — School, EMI, Chits, Debt, Phupa, and Loans had no dedicated summary charts.
4. **Transaction dates as text** (`14-Mar-2023`, `Aug-2023`) — Monthly Summary `SUMIFS` against dates would miss those rows.
5. **Chit formula errors** — right-hand “Total Prize Received” summed remaining months; monthly payment column was text so `SUM` was 0.
6. **Two chit payment sheets** with overlapping `CHT-001` IDs.
7. **Loans vs EMI split was unclear** — bank EMIs lived on EMI; Loans only had `ravindra_2L` plus an unlabeled `35000` in B3.

## Recommended structure (implemented)

**Blue tabs = enter data. Green tabs = read-only dashboards. Orange Overview = home page.**

| Data sheet | Dashboard | What you track |
|------------|-----------|----------------|
| `School_Fees` | `School_Fees_Dashboard` | Daughter (Grade 5) and Son (SKG) terms / books |
| `EMI` | `EMI_Dashboard` | Car, Bajaj, IDFC, Bike, PhonePe, Pocket4, health insurance |
| `Chits` + `Chit_Payments` | `Chits_Dashboard` | Two chit sets; all monthly installments in one table |
| `Transactions` + `Monthly_Summary` | `Transactions_Dashboard` | Friend ledger (credit in / debit out) |
| `Debt_Settlements` | `Debt_Dashboard` | HDFC settlements + ICICI placeholder |
| `Phupa` | `Phupa_Dashboard` | Tractor / goats / opening ₹7,00,000 received |
| `Loans` | `Loans_Dashboard` | Loan contracts (`ravindra_2L`) |

Rules going forward:

- One row = one payment or installment. Never overwrite a paid row.
- Type amounts as numbers (₹ formatting is already applied).
- Use real dates (`01-Aug-2026`), not month names as text.
- Status values: Paid / Due / Partial / Active / Closed.

## Snapshot of your current numbers (from the source file)

These are the migrated figures, not advice:

- **School:** ₹2,50,000 total fees, ₹80,000 paid, ₹1,70,000 remaining. Daughter Term 2/3 still Due. Son Term 1 Partial (₹10,000 of ₹34,000).
- **EMI:** ₹60,725/month on loans + ₹1,600 health insurance = **₹62,325/month** if insurance is counted.
- **Chits:** ₹18,750 + ₹12,500 = **₹31,250/month**, ₹5,00,000 commitment.
- **Friend ledger:** started with ₹6,45,000 credit; many later debits. Dates from Mar-2023 through 03-Jun-2026.
- **HDFC settlements:** ₹29,000 + ₹46,000 paid Aug-2026; closure/no-dues still “To Confirm”. ICICI not filled in.
- **Phupa:** ₹10,10,000 due, ₹7,00,000 already received, **₹3,10,000 remaining**.
