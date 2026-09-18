#!/usr/bin/env python3
"""
Rebuild Personal_Finance_Master_OneDrive.xlsx into a structured workbook:

- One row per transaction (summaries moved off data sheets)
- Amounts stored as numbers (not ₹ text)
- Dates stored as dates
- Dedicated dashboard + charts for every data category
"""

from __future__ import annotations

import argparse
import re
from datetime import date, datetime
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.chart import BarChart, LineChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.chart.series import DataPoint
from openpyxl.formatting.rule import ColorScaleRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Protection, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.drawing.line import LineProperties
from openpyxl.chart.marker import DataPoint as MarkerDataPoint  # noqa: F401

SRC_DEFAULT = Path(__file__).resolve().parent / "source" / "Personal_Finance_Master_OneDrive.xlsx"
OUT_DEFAULT = Path(__file__).resolve().parent / "Personal_Finance_Master_Restructured.xlsx"

INR = '"₹"#,##,##0'
INR_DEC = '"₹"#,##,##0.00'
PCT = "0.0%"
DATE_FMT = "DD-MMM-YYYY"
HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=11, name="Calibri")
TITLE_FONT = Font(bold=True, size=16, color="1F4E79", name="Calibri")
SUB_FONT = Font(bold=True, size=12, color="1F4E79", name="Calibri")
KPI_FILL = PatternFill("solid", fgColor="E2EFDA")
KPI_WARN = PatternFill("solid", fgColor="FCE4D6")
KPI_BLUE = PatternFill("solid", fgColor="D6EAF8")
MUTED = Font(italic=True, color="666666", name="Calibri")
THIN = Border(
    left=Side(style="thin", color="B4C6E7"),
    right=Side(style="thin", color="B4C6E7"),
    top=Side(style="thin", color="B4C6E7"),
    bottom=Side(style="thin", color="B4C6E7"),
)


def parse_inr(value) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value)
    text = text.replace("₹", "").replace(",", "").replace("**", "").replace("—", "").strip()
    if text in {"", "-", "NA", "N/A"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def parse_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%d-%b-%Y", "%d-%b-%y", "%b-%Y", "%B-%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def style_header(ws, row: int, cols: int) -> None:
    ws.row_dimensions[row].height = 22
    for col in range(1, cols + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN


def add_table(ws, name: str, ref: str) -> None:
    table = Table(displayName=name, ref=ref)
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showRowStripes=True,
        showColumnStripes=False,
        showFirstColumn=False,
        showLastColumn=False,
    )
    ws.add_table(table)


def widths(ws, mapping: dict[str, float]) -> None:
    for letter, width in mapping.items():
        ws.column_dimensions[letter].width = width


def add_list_dv(ws, cell_range: str, formula: str) -> None:
    dv = DataValidation(type="list", formula1=formula, allow_blank=True)
    dv.error = "Pick a value from the list"
    dv.errorTitle = "Invalid value"
    ws.add_data_validation(dv)
    dv.add(cell_range)


def write_title(ws, text: str, subtitle: str | None = None) -> None:
    ws["A1"] = text
    ws["A1"].font = TITLE_FONT
    if subtitle:
        ws["A2"] = subtitle
        ws["A2"].font = MUTED


def kpi(ws, row: int, label: str, formula: str, fill=KPI_FILL, number_format=INR) -> None:
    ws.cell(row=row, column=1, value=label).font = Font(bold=True, name="Calibri")
    cell = ws.cell(row=row, column=2, value=formula)
    cell.fill = fill
    cell.font = Font(bold=True, size=12, name="Calibri")
    cell.number_format = number_format
    cell.border = THIN
    ws.cell(row=row, column=1).border = THIN


def pie_chart(ws, title: str, label_col: int, data_col: int, header_row: int, last_row: int, anchor: str):
    chart = PieChart()
    chart.title = title
    chart.height = 8
    chart.width = 12
    labels = Reference(ws, min_col=label_col, min_row=header_row + 1, max_row=last_row)
    data = Reference(ws, min_col=data_col, min_row=header_row, max_row=last_row)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(labels)
    chart.dataLabels = DataLabelList()
    chart.dataLabels.showPercent = True
    chart.dataLabels.showVal = False
    chart.dataLabels.showCatName = False
    ws.add_chart(chart, anchor)
    return chart


def bar_chart(ws, title: str, cat_col: int, data_col: int, header_row: int, last_row: int, anchor: str, stacked=False):
    chart = BarChart()
    chart.type = "col"
    chart.grouping = "stacked" if stacked else "clustered"
    chart.title = title
    chart.height = 8
    chart.width = 14
    cats = Reference(ws, min_col=cat_col, min_row=header_row + 1, max_row=last_row)
    data = Reference(ws, min_col=data_col, min_row=header_row, max_row=last_row)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.y_axis.numFmt = INR
    ws.add_chart(chart, anchor)
    return chart


def line_chart(ws, title: str, cat_col: int, data_min: int, data_max: int, header_row: int, last_row: int, anchor: str):
    chart = LineChart()
    chart.title = title
    chart.height = 8
    chart.width = 16
    cats = Reference(ws, min_col=cat_col, min_row=header_row + 1, max_row=last_row)
    data = Reference(ws, min_col=data_min, min_row=header_row, max_col=data_max, max_row=last_row)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.y_axis.numFmt = INR
    ws.add_chart(chart, anchor)
    return chart


def rows_until_blank(ws, start=2, id_col=1, max_row=None) -> list[int]:
    last = max_row or ws.max_row
    out = []
    for r in range(start, last + 1):
        if ws.cell(r, id_col).value not in (None, ""):
            out.append(r)
    return out


# ---------------------------------------------------------------------------
# Source extractors
# ---------------------------------------------------------------------------
def extract_school(src) -> list[list]:
    ws = src["School Fees"]
    rows = []
    for r in range(2, 20):
        tid = ws.cell(r, 1).value
        if not tid or not str(tid).startswith("SF-"):
            continue
        due = parse_inr(ws.cell(r, 7).value) or 0
        paid = parse_inr(ws.cell(r, 8).value) or 0
        remaining = due - paid
        status = ws.cell(r, 9).value or ("Paid" if remaining <= 0 else ("Partial" if paid else "Due"))
        rows.append(
            [
                tid,
                ws.cell(r, 2).value,
                ws.cell(r, 3).value,
                ws.cell(r, 4).value,
                parse_date(ws.cell(r, 5).value),
                parse_date(ws.cell(r, 6).value),
                due,
                paid,
                remaining,  # overwritten by formula later
                status,
                ws.cell(r, 10).value,
            ]
        )
    return rows


def extract_debt(src) -> list[list]:
    ws = src["Debt Settlements"]
    rows = []
    for r in range(2, 10):
        tid = ws.cell(r, 1).value
        if not tid or not str(tid).startswith("DEBT-"):
            continue
        acct = ws.cell(r, 3).value
        if isinstance(acct, float):
            acct = str(int(acct))
        rows.append(
            [
                tid,
                ws.cell(r, 2).value,
                acct,
                ws.cell(r, 4).value,
                parse_inr(ws.cell(r, 5).value),
                parse_inr(ws.cell(r, 6).value),
                parse_inr(ws.cell(r, 7).value),
                parse_date(ws.cell(r, 8).value),
                ws.cell(r, 9).value,
                ws.cell(r, 10).value,
                ws.cell(r, 11).value,
                ws.cell(r, 12).value,
                ws.cell(r, 13).value,
            ]
        )
    return rows


def extract_transactions(src) -> list[list]:
    ws = src["Transactions"]
    rows = []
    for r in range(2, ws.max_row + 1):
        tid = ws.cell(r, 1).value
        if not tid:
            continue
        raw_date = ws.cell(r, 2).value
        dt = parse_date(raw_date)
        note = ws.cell(r, 10).value or ""
        if dt is None and raw_date:
            note = (note + " | original date: " + str(raw_date)).strip(" |")
        credit = parse_inr(ws.cell(r, 5).value) or 0
        debit = parse_inr(ws.cell(r, 6).value) or 0
        rows.append(
            [
                tid,
                dt,
                ws.cell(r, 3).value,
                ws.cell(r, 4).value,
                credit,
                debit,
                None,  # balance formula
                ws.cell(r, 8).value,
                ws.cell(r, 9).value,
                note or None,
            ]
        )
    return rows


def extract_chits(src) -> list[list]:
    ws = src["Chits"]
    rows = []
    for r in range(2, 6):
        tid = ws.cell(r, 1).value
        if not tid or not str(tid).startswith("CHIT-"):
            continue
        monthly = parse_inr(ws.cell(r, 6).value)
        tenure = parse_inr(ws.cell(r, 5).value)
        paid = parse_inr(ws.cell(r, 11).value)
        commitment = parse_inr(ws.cell(r, 10).value)
        remaining = parse_inr(ws.cell(r, 12).value)
        rows.append(
            [
                tid,
                ws.cell(r, 2).value,
                int(ws.cell(r, 3).value or 0),
                parse_date(ws.cell(r, 4).value),
                int(tenure or 0),
                monthly,
                int(ws.cell(r, 7).value or 0),
                parse_date(ws.cell(r, 8).value),
                ws.cell(r, 9).value,
                commitment,
                paid,
                remaining,
                int(parse_inr(ws.cell(r, 13).value) or 0),
                ws.cell(r, 15).value or ws.cell(r, 16).value,
            ]
        )
    return rows


def extract_chit_payments(src) -> list[list]:
    rows = []
    for sheet in ("Chit1 Payments", "Chit2 Payments"):
        ws = src[sheet]
        for r in range(2, ws.max_row + 1):
            tid = ws.cell(r, 1).value
            if not tid:
                continue
            expected = parse_inr(ws.cell(r, 7).value)
            paid = parse_inr(ws.cell(r, 8).value)
            month_no = ws.cell(r, 4).value
            set_id = ws.cell(r, 2).value or "CHIT"
            month_tag = int(month_no) if month_no else r
            rows.append(
                [
                    f"{set_id}-M{month_tag:02d}",
                    ws.cell(r, 2).value,
                    ws.cell(r, 3).value,
                    int(month_no) if month_no else None,
                    parse_date(ws.cell(r, 5).value),
                    parse_date(ws.cell(r, 6).value),
                    expected,
                    paid,
                    ws.cell(r, 9).value or ("Paid" if paid else "Due"),
                    ws.cell(r, 10).value,
                    ws.cell(r, 11).value,
                    ws.cell(r, 12).value,
                ]
            )
    return rows


def extract_emi(src) -> list[list]:
    ws = src["EMI"]
    rows = []
    for r in range(2, 20):
        lender = ws.cell(r, 2).value
        monthly = parse_inr(ws.cell(r, 3).value)
        if not lender or monthly is None:
            continue
        if str(lender).lower().startswith("total"):
            continue
        status = ws.cell(r, 5).value or "Active"
        purpose = (ws.cell(r, 4).value or "").strip()
        account = (ws.cell(r, 6).value or "").strip()
        principal = parse_inr(ws.cell(r, 7).value)
        priority = ws.cell(r, 1).value
        if priority in ("—", "-", None):
            priority = None
        else:
            try:
                priority = int(priority)
            except (TypeError, ValueError):
                priority = None
        category = "Insurance" if "insurance" in str(lender).lower() else "EMI / Loan"
        rows.append(
            [
                f"EMI-{len(rows)+1:03d}",
                priority,
                str(lender).strip(),
                monthly,
                purpose or None,
                category,
                status,
                account or None,
                principal,
                None,  # remaining months – unknown
                None,
            ]
        )
    return rows


def extract_loans(src) -> list[list]:
    ws = src["Loans"]
    rows = []
    for r in range(2, 20):
        tid = ws.cell(r, 1).value
        name = ws.cell(r, 2).value
        if not tid and not (isinstance(name, str) and name):
            continue
        if tid and str(tid).startswith("LOAN-"):
            rows.append(
                [
                    tid,
                    name,
                    ws.cell(r, 3).value,
                    ws.cell(r, 4).value,
                    parse_date(ws.cell(r, 5).value),
                    parse_date(ws.cell(r, 6).value),
                    parse_inr(ws.cell(r, 7).value),
                    parse_inr(ws.cell(r, 8).value),
                    parse_inr(ws.cell(r, 9).value),
                    parse_inr(ws.cell(r, 10).value) or parse_inr(ws.cell(3, 2).value),  # stray 35000 on B3
                    parse_inr(ws.cell(r, 11).value),
                    parse_inr(ws.cell(r, 12).value),
                    parse_date(ws.cell(r, 13).value),
                    ws.cell(r, 14).value,
                    (
                        ((ws.cell(r, 15).value or "").strip() + " ").strip()
                        + (
                            "Possible EMI ₹35,000 was in Loans!B3 (unlabeled). Confirm whether it belongs in the EMI column."
                            if parse_inr(ws.cell(3, 2).value)
                            else ""
                        )
                    ).strip()
                    or None,
                ]
            )
    return rows


def extract_phupa(src) -> list[list]:
    ws = src["Phupa"]
    rows = []
    for r in range(2, 15):
        tid = ws.cell(r, 1).value
        if not tid:
            continue
        due = parse_inr(ws.cell(r, 4).value) or 0
        received = parse_inr(ws.cell(r, 5).value) or 0
        rows.append(
            [
                tid,
                parse_date(ws.cell(r, 2).value),
                ws.cell(r, 3).value,
                due,
                received,
                None,
                ws.cell(r, 6).value,
            ]
        )
    return rows


# ---------------------------------------------------------------------------
# Sheet builders
# ---------------------------------------------------------------------------
def build_setup(wb: Workbook) -> None:
    ws = wb.active
    ws.title = "Setup"
    write_title(ws, "Setup & dropdown lists", "Edit lists here. Data sheets use these for Status, Method, and Category.")

    lists = {
        1: ("Status", ["Paid", "Due", "Partial", "Pending", "Overdue", "Active", "Closed", "Skipped", "Not Updated"]),
        3: ("Payment_Method", ["UPI", "Bank/UPI", "Bank Transfer", "Cash", "Auto Debit", "Credit Card"]),
        5: ("Child", ["Daughter", "Son"]),
        7: ("Fee_Type", ["Term 1", "Term 2", "Term 3", "Books & Uniform", "Transport", "Exam", "Other"]),
        9: ("EMI_Status", ["Active", "Closed", "Paused"]),
        11: ("Closure_Status", ["To Confirm", "Confirmed", "Not Confirmed", "Closed"]),
    }
    for col, (title, values) in lists.items():
        ws.cell(5, col, title).font = SUB_FONT
        ws.cell(5, col).fill = PatternFill("solid", fgColor="D6E4F0")
        for i, v in enumerate(values, start=6):
            ws.cell(i, col, v)
    widths(ws, {"A": 18, "C": 16, "E": 14, "G": 18, "I": 12, "K": 16})


def write_data_sheet(
    wb: Workbook,
    title: str,
    heading: str,
    subtitle: str,
    headers: list[str],
    rows: list[list],
    money_cols: set[int],
    date_cols: set[int],
    table_name: str,
    extra_formulas: dict[int, str] | None = None,
    pct_cols: set[int] | None = None,
) -> tuple:
    ws = wb.create_sheet(title)
    write_title(ws, heading, subtitle)
    header_row = 4
    for i, h in enumerate(headers, start=1):
        ws.cell(header_row, i, h)
    style_header(ws, header_row, len(headers))

    start = header_row + 1
    for r_idx, row in enumerate(rows, start=start):
        for c_idx, value in enumerate(row, start=1):
            if extra_formulas and c_idx in extra_formulas:
                formula = extra_formulas[c_idx].replace("{row}", str(r_idx))
                cell = ws.cell(r_idx, c_idx, formula)
            else:
                cell = ws.cell(r_idx, c_idx, value)
            cell.border = THIN
            cell.alignment = Alignment(vertical="center")
            if c_idx in money_cols:
                cell.number_format = INR
            if c_idx in date_cols:
                cell.number_format = DATE_FMT
            if pct_cols and c_idx in pct_cols:
                cell.number_format = PCT
    last = start + len(rows) - 1 if rows else start
    if not rows:
        last = start
        for c in range(1, len(headers) + 1):
            ws.cell(start, c).border = THIN
    add_table(ws, table_name, f"A{header_row}:{get_column_letter(len(headers))}{last}")
    ws.freeze_panes = f"A{start}"
    ws.auto_filter.ref = f"A{header_row}:{get_column_letter(len(headers))}{last}"
    col_w = {get_column_letter(i): 14 for i in range(1, len(headers) + 1)}
    col_w["A"] = 14
    if "Notes" in headers:
        col_w[get_column_letter(headers.index("Notes") + 1)] = 40
    widths(ws, col_w)
    ws.sheet_properties.tabColor = "1F4E79"
    return ws, header_row, last, len(headers)


def build_school(wb, rows):
    headers = [
        "Transaction_ID",
        "Child",
        "Grade",
        "Fee_Type",
        "Due_Date",
        "Paid_Date",
        "Amount_Due",
        "Amount_Paid",
        "Remaining",
        "Status",
        "Notes",
    ]
    ws, hr, last, n = write_data_sheet(
        wb,
        "School_Fees",
        "School Fees — transaction log",
        "One row per fee installment. Fill Due_Date / Paid_Date when you have them. Remaining is calculated.",
        headers,
        rows,
        money_cols={7, 8, 9},
        date_cols={5, 6},
        table_name="tbl_SchoolFees",
        extra_formulas={9: "=G{row}-H{row}"},
    )
    add_list_dv(ws, f"B5:B200", "=Setup!$E$6:$E$7")
    add_list_dv(ws, f"D5:D200", "=Setup!$G$6:$G$12")
    add_list_dv(ws, f"J5:J200", "=Setup!$A$6:$A$14")
    return last


def build_school_dash(wb, last: int):
    ws = wb.create_sheet("School_Fees_Dashboard")
    write_title(ws, "School Fees Dashboard", "Live totals from School_Fees. Use this tab for a quick check.")
    kpi(ws, 4, "Total fee (all children)", "=SUM(School_Fees!G5:G500)")
    kpi(ws, 5, "Total paid", "=SUM(School_Fees!H5:H500)")
    kpi(ws, 6, "Remaining", "=SUM(School_Fees!I5:I500)", KPI_WARN)
    kpi(ws, 7, "Payment progress", "=IF(B4=0,0,B5/B4)", KPI_BLUE, PCT)
    kpi(ws, 8, "Open items (Due/Partial)", '=COUNTIF(School_Fees!J5:J500,"Due")+COUNTIF(School_Fees!J5:J500,"Partial")', KPI_WARN, "0")

    ws["A10"] = "By child"
    ws["A10"].font = SUB_FONT
    ws["A11"] = "Child"
    ws["B11"] = "Due"
    ws["C11"] = "Paid"
    ws["D11"] = "Remaining"
    style_header(ws, 11, 4)
    ws["A12"] = "Daughter"
    ws["B12"] = '=SUMIF(School_Fees!B:B,A12,School_Fees!G:G)'
    ws["C12"] = '=SUMIF(School_Fees!B:B,A12,School_Fees!H:H)'
    ws["D12"] = "=B12-C12"
    ws["A13"] = "Son"
    ws["B13"] = '=SUMIF(School_Fees!B:B,A13,School_Fees!G:G)'
    ws["C13"] = '=SUMIF(School_Fees!B:B,A13,School_Fees!H:H)'
    ws["D13"] = "=B13-C13"
    for r in (12, 13):
        for c in (2, 3, 4):
            ws.cell(r, c).number_format = INR
            ws.cell(r, c).border = THIN

    ws["A15"] = "By fee type"
    ws["A15"].font = SUB_FONT
    ws["A16"] = "Fee_Type"
    ws["B16"] = "Due"
    ws["C16"] = "Paid"
    style_header(ws, 16, 3)
    types = ["Term 1", "Term 2", "Term 3", "Books & Uniform"]
    for i, t in enumerate(types):
        r = 17 + i
        ws.cell(r, 1, t)
        ws.cell(r, 2, f'=SUMIF(School_Fees!D:D,A{r},School_Fees!G:G)')
        ws.cell(r, 3, f'=SUMIF(School_Fees!D:D,A{r},School_Fees!H:H)')
        ws.cell(r, 2).number_format = INR
        ws.cell(r, 3).number_format = INR

    pie_chart(ws, "Remaining by child", 1, 4, 11, 13, "F4")
    chart = BarChart()
    chart.type = "col"
    chart.title = "Due vs Paid by type"
    chart.height = 8
    chart.width = 14
    cats = Reference(ws, min_col=1, min_row=17, max_row=20)
    data = Reference(ws, min_col=2, min_row=16, max_col=3, max_row=20)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.y_axis.numFmt = INR
    ws.add_chart(chart, "F20")

    widths(ws, {"A": 28, "B": 16, "C": 16, "D": 16})
    ws.sheet_properties.tabColor = "548235"


def build_emi(wb, rows):
    headers = [
        "EMI_ID",
        "Priority",
        "Lender",
        "Monthly_EMI",
        "Product",
        "Category",
        "Status",
        "Debit_Account",
        "Principal",
        "EMIs_Remaining",
        "Notes",
    ]
    ws, hr, last, n = write_data_sheet(
        wb,
        "EMI",
        "EMI register",
        "One row per active/closed EMI. Do not put totals in this table — see EMI_Dashboard.",
        headers,
        rows,
        money_cols={4, 9},
        date_cols=set(),
        table_name="tbl_EMI",
    )
    add_list_dv(ws, "G5:G200", "=Setup!$I$6:$I$8")
    return last


def build_emi_dash(wb, last):
    ws = wb.create_sheet("EMI_Dashboard")
    write_title(ws, "EMI Dashboard", "Monthly outflow and mix. Health insurance is included as a recurring item.")
    kpi(ws, 4, "Active monthly EMI", '=SUMIF(EMI!G:G,"Active",EMI!D:D)')
    kpi(ws, 5, "Active EMI count", '=COUNTIF(EMI!G:G,"Active")', KPI_BLUE, "0")
    kpi(ws, 6, "Known principal (where filled)", "=SUM(EMI!I5:I500)", KPI_BLUE)
    kpi(ws, 7, "Annual EMI outflow (active × 12)", "=B4*12", KPI_WARN)

    ws["A9"] = "By lender (active)"
    ws["A9"].font = SUB_FONT
    ws["A10"] = "Lender"
    ws["B10"] = "Monthly_EMI"
    style_header(ws, 10, 2)
    for i, name in enumerate(
        ["Car EMI", "Direct D. Bajaj", "IDFC First", "New Bike EMI", "New PhonePe Loan", "Pocket4 – Bajaj", "Health insurance"]
    ):
        r = 11 + i
        ws.cell(r, 1, name)
        ws.cell(r, 2, f'=SUMIFS(EMI!D:D,EMI!C:C,A{r},EMI!G:G,"Active")')
        ws.cell(r, 2).number_format = INR

    pie_chart(ws, "Active EMI mix", 1, 2, 10, 17, "D4")
    bar_chart(ws, "Monthly EMI by lender", 1, 2, 10, 17, "D20")
    widths(ws, {"A": 28, "B": 16})
    ws.sheet_properties.tabColor = "548235"


def build_chits(wb, rows):
    headers = [
        "Chit_Set_ID",
        "Chit_Set",
        "No_of_Chits",
        "Start_Date",
        "Tenure_Months",
        "Monthly_Payment",
        "Current_Month_No",
        "Current_Month",
        "Amount_Taken",
        "Total_Commitment",
        "Paid_To_Date",
        "Remaining",
        "Remaining_Months",
        "Notes",
    ]
    ws, hr, last, n = write_data_sheet(
        wb,
        "Chits",
        "Chit master",
        "One row per chit set. Paid_To_Date and Remaining are calculated from Chit_Payments.",
        headers,
        rows,
        money_cols={6, 10, 11, 12},
        date_cols={4, 8},
        table_name="tbl_Chits",
        extra_formulas={
            11: '=SUMIF(Chit_Payments!B:B,A{row},Chit_Payments!H:H)',
            12: "=J{row}-K{row}",
            13: '=COUNTIFS(Chit_Payments!B:B,A{row},Chit_Payments!I:I,"Due")',
        },
    )
    return last


def build_chit_payments(wb, rows):
    headers = [
        "Payment_ID",
        "Chit_Set_ID",
        "Chit_Set",
        "Month_No",
        "Due_Date",
        "Paid_Date",
        "Expected_Amount",
        "Paid_Amount",
        "Status",
        "Payment_Method",
        "Reference_UTR",
        "Notes",
    ]
    ws, hr, last, n = write_data_sheet(
        wb,
        "Chit_Payments",
        "Chit installment log",
        "Merged from former Chit1 Payments + Chit2 Payments. One row per month per set. Do not overwrite old rows.",
        headers,
        rows,
        money_cols={7, 8},
        date_cols={5, 6},
        table_name="tbl_ChitPayments",
    )
    add_list_dv(ws, "I5:I500", "=Setup!$A$6:$A$14")
    add_list_dv(ws, "J5:J500", "=Setup!$C$6:$C$11")
    return last


def build_chits_dash(wb):
    ws = wb.create_sheet("Chits_Dashboard")
    write_title(ws, "Chits Dashboard", "Master + installment view. Combined monthly = ₹31,250 while both sets run.")
    kpi(ws, 4, "Combined monthly payment", "=SUM(Chits!F5:F500)")
    kpi(ws, 5, "Total commitment", "=SUM(Chits!J5:J500)")
    kpi(ws, 6, "Paid to date (from installments)", "=SUM(Chit_Payments!H5:H500)")
    kpi(ws, 7, "Remaining commitment", "=B5-B6", KPI_WARN)
    kpi(ws, 8, "Paid installments", '=COUNTIF(Chit_Payments!I:I,"Paid")', KPI_BLUE, "0")
    kpi(ws, 9, "Upcoming / due installments", '=COUNTIF(Chit_Payments!I:I,"Due")', KPI_WARN, "0")

    ws["A11"] = "By chit set"
    ws["A11"].font = SUB_FONT
    ws["A12"] = "Chit_Set"
    ws["B12"] = "Monthly"
    ws["C12"] = "Paid"
    ws["D12"] = "Remaining"
    style_header(ws, 12, 4)
    ws["A13"] = '=IF(Chits!B5="","",Chits!B5)'
    ws["B13"] = "=IF(A13=\"\",\"\",Chits!F5)"
    ws["C13"] = "=IF(A13=\"\",\"\",Chits!K5)"
    ws["D13"] = "=IF(A13=\"\",\"\",Chits!L5)"
    ws["A14"] = '=IF(Chits!B6="","",Chits!B6)'
    ws["B14"] = "=IF(A14=\"\",\"\",Chits!F6)"
    ws["C14"] = "=IF(A14=\"\",\"\",Chits!K6)"
    ws["D14"] = "=IF(A14=\"\",\"\",Chits!L6)"
    for r in (13, 14):
        for c in (2, 3, 4):
            ws.cell(r, c).number_format = INR

    pie_chart(ws, "Remaining by chit set", 1, 4, 12, 14, "F4")
    bar_chart(ws, "Paid vs remaining", 1, 3, 12, 14, "F20")
    chart = BarChart()
    chart.type = "col"
    chart.title = "Paid vs remaining by set"
    chart.height = 8
    chart.width = 14
    cats = Reference(ws, min_col=1, min_row=13, max_row=14)
    data = Reference(ws, min_col=3, min_row=12, max_col=4, max_row=14)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.y_axis.numFmt = INR
    ws.add_chart(chart, "F20")
    widths(ws, {"A": 28, "B": 16, "C": 16, "D": 16})
    ws.sheet_properties.tabColor = "548235"


def build_transactions(wb, rows):
    headers = [
        "Transaction_ID",
        "Date",
        "Person",
        "Description",
        "Credit",
        "Debit",
        "Running_Balance",
        "Payment_Method",
        "Reference_UTR",
        "Notes",
    ]
    extra = {7: "=SUM($E$5:E{row})-SUM($F$5:F{row})"}
    ws, hr, last, n = write_data_sheet(
        wb,
        "Transactions",
        "Friend / money ledger",
        "Credit = money received. Debit = money given. Dates are real date values (month-only entries used 1st of that month).",
        headers,
        rows,
        money_cols={5, 6, 7},
        date_cols={2},
        table_name="tbl_Transactions",
        extra_formulas=extra,
    )
    add_list_dv(ws, "H5:H500", "=Setup!$C$6:$C$11")
    return last


def build_monthly(wb):
    ws = wb.create_sheet("Monthly_Summary")
    write_title(
        ws,
        "Monthly summary (from Transactions)",
        "Requires real dates in Transactions!B. Month-only source dates were converted to the 1st of that month.",
    )
    headers = ["Month", "Total_Credit", "Total_Debit", "Net", "Closing_Balance"]
    for i, h in enumerate(headers, 1):
        ws.cell(4, i, h)
    style_header(ws, 4, 5)
    # Mar 2023 through Dec 2027
    start = date(2023, 3, 1)
    r = 5
    y, m = start.year, start.month
    while (y, m) <= (2027, 12):
        ws.cell(r, 1, date(y, m, 1)).number_format = "MMM-YYYY"
        ws.cell(r, 2, f'=SUMIFS(Transactions!$E:$E,Transactions!$B:$B,">="&A{r},Transactions!$B:$B,"<"&EDATE(A{r},1))')
        ws.cell(r, 3, f'=SUMIFS(Transactions!$F:$F,Transactions!$B:$B,">="&A{r},Transactions!$B:$B,"<"&EDATE(A{r},1))')
        ws.cell(r, 4, f"=B{r}-C{r}")
        ws.cell(r, 5, f'=SUMIFS(Transactions!$E:$E,Transactions!$B:$B,"<"&EDATE(A{r},1))-SUMIFS(Transactions!$F:$F,Transactions!$B:$B,"<"&EDATE(A{r},1))')
        for c in range(2, 6):
            ws.cell(r, c).number_format = INR
        r += 1
        m += 1
        if m == 13:
            m = 1
            y += 1
    last = r - 1
    add_table(ws, "tbl_Monthly", f"A4:E{last}")
    widths(ws, {"A": 14, "B": 16, "C": 16, "D": 16, "E": 18})
    return last


def build_txn_dash(wb, monthly_last: int):
    ws = wb.create_sheet("Transactions_Dashboard")
    write_title(ws, "Transactions Dashboard", "Friend ledger health check.")
    kpi(ws, 4, "Total credit received", "=SUM(Transactions!E5:E500)")
    kpi(ws, 5, "Total debit given", "=SUM(Transactions!F5:F500)", KPI_WARN)
    kpi(ws, 6, "Current balance (positive = net still with the other party)", "=B4-B5", KPI_BLUE)
    kpi(ws, 7, "Transaction count", '=COUNTA(Transactions!A5:A500)', KPI_BLUE, "0")

    widths(ws, {"A": 52, "B": 18})
    ws["A10"] = "Credit vs debit trend charts are on Monthly_Summary (same sheet as the month table)."
    ws["A10"].font = MUTED
    ws.sheet_properties.tabColor = "548235"


def add_monthly_charts(wb, monthly_last: int):
    ws = wb["Monthly_Summary"]
    line_chart(ws, "Credit vs Debit by month", 1, 2, 3, 4, monthly_last, "G4")
    line_chart(ws, "Closing balance", 1, 5, 5, 4, monthly_last, "G20")


def build_debt(wb, rows):
    headers = [
        "Debt_ID",
        "Lender",
        "Account_Ending",
        "Liability_Type",
        "Original_Outstanding",
        "Settlement_Amount",
        "Paid_Amount",
        "Settlement_Date",
        "Payment_Status",
        "Closure_Status",
        "No_Dues_Status",
        "Reference_UTR",
        "Notes",
    ]
    ws, hr, last, n = write_data_sheet(
        wb,
        "Debt_Settlements",
        "Debt settlements",
        "Track settlement vs closure. HDFC items are paid; confirm closure / no-dues. Fill ICICI amounts when known.",
        headers,
        rows,
        money_cols={5, 6, 7},
        date_cols={8},
        table_name="tbl_Debt",
    )
    add_list_dv(ws, "I5:I200", "=Setup!$A$6:$A$14")
    add_list_dv(ws, "J5:J200", "=Setup!$K$6:$K$9")
    add_list_dv(ws, "K5:K200", "=Setup!$K$6:$K$9")
    return last


def build_debt_dash(wb):
    ws = wb.create_sheet("Debt_Dashboard")
    write_title(ws, "Debt Settlements Dashboard")
    kpi(ws, 4, "Settlement amount (all)", "=SUM(Debt_Settlements!F5:F500)")
    kpi(ws, 5, "Paid towards settlements", "=SUM(Debt_Settlements!G5:G500)")
    kpi(ws, 6, "Unpaid settlement gap", "=B4-B5", KPI_WARN)
    kpi(ws, 7, "Paid but closure not confirmed", '=COUNTIFS(Debt_Settlements!I5:I500,"Paid",Debt_Settlements!J5:J500,"To Confirm")', KPI_WARN, "0")
    kpi(ws, 8, "Rows still Not Updated", '=COUNTIF(Debt_Settlements!I5:I500,"Not Updated")', KPI_WARN, "0")

    ws["A10"] = "By lender"
    ws["A10"].font = SUB_FONT
    ws["A11"] = "Lender"
    ws["B11"] = "Paid"
    style_header(ws, 11, 2)
    ws["A12"] = "HDFC Bank"
    ws["B12"] = '=SUMIF(Debt_Settlements!B:B,A12,Debt_Settlements!G:G)'
    ws["A13"] = "ICICI Bank"
    ws["B13"] = '=SUMIF(Debt_Settlements!B:B,A13,Debt_Settlements!G:G)'
    ws["B12"].number_format = INR
    ws["B13"].number_format = INR
    pie_chart(ws, "Settlement payments by lender", 1, 2, 11, 13, "D4")
    widths(ws, {"A": 36, "B": 18})
    ws.sheet_properties.tabColor = "548235"


def build_phupa(wb, rows):
    headers = [
        "Transaction_ID",
        "Date",
        "Category",
        "Amount_Due",
        "Amount_Received",
        "Remaining",
        "Notes",
    ]
    ws, hr, last, n = write_data_sheet(
        wb,
        "Phupa",
        "Phupa ledger",
        "Opening ₹7,00,000 received is one row. Add each new receipt as a new row. Remaining is calculated.",
        headers,
        rows,
        money_cols={4, 5, 6},
        date_cols={2},
        table_name="tbl_Phupa",
        extra_formulas={6: "=D{row}-E{row}"},
    )
    return last


def build_phupa_dash(wb):
    ws = wb.create_sheet("Phupa_Dashboard")
    write_title(ws, "Phupa Dashboard", "Fixes the old #VALUE! remaining balance (amounts are numbers now).")
    kpi(ws, 4, "Total amount due", "=SUM(Phupa!D5:D500)")
    kpi(ws, 5, "Total received", "=SUM(Phupa!E5:E500)")
    kpi(ws, 6, "Remaining", "=B4-B5", KPI_WARN)

    ws["A8"] = "By category"
    ws["A8"].font = SUB_FONT
    ws["A9"] = "Category"
    ws["B9"] = "Due"
    ws["C9"] = "Received"
    style_header(ws, 9, 3)
    for i, cat in enumerate(["Tractor", "Goats", "Goat kids", "Phupi", "Opening amount already received"]):
        r = 10 + i
        ws.cell(r, 1, cat)
        ws.cell(r, 2, f'=SUMIF(Phupa!C:C,A{r},Phupa!D:D)')
        ws.cell(r, 3, f'=SUMIF(Phupa!C:C,A{r},Phupa!E:E)')
        ws.cell(r, 2).number_format = INR
        ws.cell(r, 3).number_format = INR
    pie_chart(ws, "Due by category", 1, 2, 9, 14, "E4")
    widths(ws, {"A": 36, "B": 16, "C": 16})
    ws.sheet_properties.tabColor = "548235"


def build_loans(wb, rows):
    headers = [
        "Loan_ID",
        "Loan_Name",
        "Lender",
        "Loan_Type",
        "Start_Date",
        "End_Date",
        "Original_Principal",
        "Interest_Rate_Pct",
        "Tenure_Months",
        "EMI",
        "EMIs_Paid",
        "Outstanding_Principal",
        "Next_EMI_Date",
        "Status",
        "Notes",
    ]
    ws, hr, last, n = write_data_sheet(
        wb,
        "Loans",
        "Loan master",
        "Use this for loan contracts. Use EMI sheet for the monthly installment register (Car, Bajaj, IDFC, Bike, PhonePe, Pocket4).",
        headers,
        rows,
        money_cols={7, 10, 12},
        date_cols={5, 6, 13},
        table_name="tbl_Loans",
        extra_formulas={},
        pct_cols={8},
    )
    # Interest was entered as 2.0 meaning 2% — store as 0.02 if value > 1
    # already written; fix cell H5
    if last >= 5:
        cell = ws["H5"]
        if isinstance(cell.value, (int, float)) and cell.value > 1:
            cell.value = cell.value / 100.0
        cell.number_format = PCT
    add_list_dv(ws, "N5:N200", "=Setup!$I$6:$I$8")
    return last


def build_loans_dash(wb):
    ws = wb.create_sheet("Loans_Dashboard")
    write_title(ws, "Loans Dashboard", "Master loan contracts only. Monthly bank EMIs are on EMI_Dashboard.")
    kpi(ws, 4, "Original principal", "=SUM(Loans!G5:G500)")
    kpi(ws, 5, "Outstanding principal (where filled)", "=SUM(Loans!L5:L500)", KPI_WARN)
    kpi(ws, 6, "Monthly EMI (this sheet)", "=SUM(Loans!J5:J500)")
    kpi(ws, 7, "Active loans", '=COUNTIF(Loans!N:N,"Active")', KPI_BLUE, "0")
    ws["A9"] = "If a bank EMI is missing here, it is probably only on the EMI sheet — that is OK. Optionally add a matching Loans row later."
    ws["A9"].font = MUTED
    widths(ws, {"A": 42, "B": 18})
    ws.sheet_properties.tabColor = "548235"


def build_overview(wb):
    ws = wb.create_sheet("Overview")
    write_title(
        ws,
        "Personal Finance — Overview",
        "Open this tab first. All figures are live formulas against the data sheets.",
    )
    ws["A4"] = "Current monthly commitments"
    ws["A4"].font = SUB_FONT
    kpi(ws, 5, "Active EMIs (incl. insurance)", '=SUMIF(EMI!G:G,"Active",EMI!D:D)')
    kpi(ws, 6, "Chit monthly", "=SUM(Chits!F5:F500)")
    kpi(ws, 7, "Combined EMI + Chit / month", "=B5+B6", KPI_WARN)

    ws["A9"] = "Balances & remaining"
    ws["A9"].font = SUB_FONT
    kpi(ws, 10, "Friend ledger balance", "=SUM(Transactions!E5:E500)-SUM(Transactions!F5:F500)", KPI_BLUE)
    kpi(ws, 11, "School fees remaining", "=SUM(School_Fees!I5:I500)", KPI_WARN)
    kpi(ws, 12, "Chit remaining", "=SUM(Chits!L5:L500)", KPI_WARN)
    kpi(ws, 13, "Phupa remaining", "=SUM(Phupa!D5:D500)-SUM(Phupa!E5:E500)", KPI_WARN)
    kpi(ws, 14, "Debt settlements paid", "=SUM(Debt_Settlements!G5:G500)", KPI_BLUE)

    ws["A16"] = "Monthly mix"
    ws["A16"].font = SUB_FONT
    ws["A17"] = "Item"
    ws["B17"] = "Amount"
    style_header(ws, 17, 2)
    ws["A18"] = "EMIs"
    ws["B18"] = "=B5"
    ws["A19"] = "Chits"
    ws["B19"] = "=B6"
    ws["B18"].number_format = INR
    ws["B19"].number_format = INR
    pie_chart(ws, "Monthly commitment mix", 1, 2, 17, 19, "D4")

    ws["A21"] = "Open items to action"
    ws["A21"].font = SUB_FONT
    ws["A22"] = "School installments still Due/Partial"
    ws["B22"] = '=COUNTIF(School_Fees!J:J,"Due")+COUNTIF(School_Fees!J:J,"Partial")'
    ws["B22"].number_format = "0"
    ws["A23"] = "Chit installments still Due"
    ws["B23"] = '=COUNTIF(Chit_Payments!I:I,"Due")'
    ws["B23"].number_format = "0"
    ws["A24"] = "Settlements awaiting closure confirmation"
    ws["B24"] = '=COUNTIFS(Debt_Settlements!I:I,"Paid",Debt_Settlements!J:I,"To Confirm")'
    # Fix COUNTIFS range typo - J:I is wrong
    ws["B24"] = '=COUNTIFS(Debt_Settlements!I:I,"Paid",Debt_Settlements!J:J,"To Confirm")'
    ws["B24"].number_format = "0"

    ws["A26"] = "How to use"
    ws["A26"].font = SUB_FONT
    ws["A27"] = "Enter data only on the dark-blue tabs (School_Fees, EMI, Chits, Chit_Payments, Transactions, Debt_Settlements, Phupa, Loans)."
    ws["A28"] = "Green tabs are dashboards — do not type transactions there."
    ws["A29"] = "Always add a new row; never overwrite a paid installment."
    ws["A27"].font = MUTED
    ws["A28"].font = MUTED
    ws["A29"].font = MUTED
    widths(ws, {"A": 48, "B": 18})
    ws.sheet_properties.tabColor = "C65911"


def build_how_to(wb):
    ws = wb.create_sheet("How_to_Use")
    write_title(ws, "How to maintain this workbook")
    lines = [
        "1. Overview is the home page. Check it once a month.",
        "2. Add every new payment as a NEW row on the matching data sheet. Do not overwrite old rows.",
        "3. Store amounts as numbers. The ₹ format is applied automatically — do not type the ₹ symbol.",
        "4. Store dates with Excel date picker (or DD-MMM-YYYY). Avoid 'Aug-2026' text if you can use 01-Aug-2026.",
        "5. School_Fees: remaining = due − paid. Status should be Paid / Partial / Due.",
        "6. EMI: this is your monthly installment register (Car, Bajaj, IDFC, Bike, PhonePe, Pocket4, insurance). Loans is for contract master data.",
        "7. Chits: keep two master rows. Log each month in Chit_Payments (both sets live in one table now).",
        "8. Transactions: Credit = received from friend; Debit = given. Running balance is automatic.",
        "9. Debt_Settlements: HDFC ₹29,000 + ₹46,000 are paid; still confirm closure / no-dues. Add ICICI figures when known.",
        "10. Phupa: remaining is now a formula. Add each new receipt as its own row so the ₹7,00,000 opening stays intact.",
        "11. After adding rows, if a table does not expand, click any cell in the table → Table Design → Resize Table.",
        "12. Dashboards and Overview recalculate when you open the file in Excel / Excel Online.",
    ]
    for i, line in enumerate(lines, start=4):
        ws[f"A{i}"] = line
    widths(ws, {"A": 140})


def reorder(wb, order: list[str]) -> None:
    for idx, name in enumerate(order):
        current = wb.sheetnames.index(name)
        wb.move_sheet(name, offset=idx - current)


def rebuild(src_path: Path, out_path: Path) -> Path:
    src = load_workbook(src_path, data_only=False)

    school = extract_school(src)
    debt = extract_debt(src)
    txns = extract_transactions(src)
    chits = extract_chits(src)
    chit_pay = extract_chit_payments(src)
    emis = extract_emi(src)
    loans = extract_loans(src)
    phupa = extract_phupa(src)

    wb = Workbook()
    build_setup(wb)
    build_school(wb, school)
    build_school_dash(wb, 4 + len(school))
    build_emi(wb, emis)
    build_emi_dash(wb, 4 + len(emis))
    build_chits(wb, chits)
    build_chit_payments(wb, chit_pay)
    build_chits_dash(wb)
    last_txn = build_transactions(wb, txns)
    monthly_last = build_monthly(wb)
    build_txn_dash(wb, monthly_last)
    add_monthly_charts(wb, monthly_last)
    build_debt(wb, debt)
    build_debt_dash(wb)
    build_phupa(wb, phupa)
    build_phupa_dash(wb)
    build_loans(wb, loans)
    build_loans_dash(wb)
    build_overview(wb)
    build_how_to(wb)

    order = [
        "Overview",
        "School_Fees_Dashboard",
        "School_Fees",
        "EMI_Dashboard",
        "EMI",
        "Chits_Dashboard",
        "Chits",
        "Chit_Payments",
        "Transactions_Dashboard",
        "Transactions",
        "Monthly_Summary",
        "Debt_Dashboard",
        "Debt_Settlements",
        "Phupa_Dashboard",
        "Phupa",
        "Loans_Dashboard",
        "Loans",
        "Setup",
        "How_to_Use",
    ]
    reorder(wb, order)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(out_path)
    return out_path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, default=SRC_DEFAULT)
    p.add_argument("--output", type=Path, default=OUT_DEFAULT)
    args = p.parse_args()
    path = rebuild(args.source.resolve(), args.output.resolve())
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
