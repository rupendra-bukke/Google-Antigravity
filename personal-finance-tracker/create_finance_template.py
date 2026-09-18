#!/usr/bin/env python3
"""
Generate a structured personal finance Excel workbook with per-category dashboards.

Usage:
    python create_finance_template.py
    python create_finance_template.py --output /path/to/MyFinance.xlsx
"""

from __future__ import annotations

import argparse
from copy import copy
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, PieChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.table import Table, TableStyleInfo

OUTPUT_DEFAULT = Path(__file__).resolve().parent / "Personal_Finance_Tracker.xlsx"

# ---------------------------------------------------------------------------
# Style helpers
# ---------------------------------------------------------------------------
HEADER_FILL = PatternFill("solid", fgColor="1F4E79")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=11)
SUBHEADER_FILL = PatternFill("solid", fgColor="D6E4F0")
SUBHEADER_FONT = Font(bold=True, size=11, color="1F4E79")
TITLE_FONT = Font(bold=True, size=14, color="1F4E79")
KPI_FILL = PatternFill("solid", fgColor="E2EFDA")
KPI_FONT = Font(bold=True, size=12, color="375623")
THIN_BORDER = Border(
    left=Side(style="thin", color="B4C6E7"),
    right=Side(style="thin", color="B4C6E7"),
    top=Side(style="thin", color="B4C6E7"),
    bottom=Side(style="thin", color="B4C6E7"),
)
CURRENCY_FMT = '#,##0'
PCT_FMT = "0.0%"


def style_header_row(ws, row: int, col_count: int) -> None:
    for col in range(1, col_count + 1):
        cell = ws.cell(row=row, column=col)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER


def style_data_area(ws, start_row: int, end_row: int, col_count: int) -> None:
    for row in range(start_row, end_row + 1):
        for col in range(1, col_count + 1):
            cell = ws.cell(row=row, column=col)
            cell.border = THIN_BORDER
            cell.alignment = Alignment(vertical="center")


def set_col_widths(ws, widths: dict[str, float]) -> None:
    for col_letter, width in widths.items():
        ws.column_dimensions[col_letter].width = width


def add_table(ws, name: str, ref: str) -> None:
    table = Table(displayName=name, ref=ref)
    style = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    table.tableStyleInfo = style
    ws.add_table(table)


def add_list_validation(ws, cell_range: str, formula: str) -> None:
    dv = DataValidation(type="list", formula1=formula, allow_blank=True)
    dv.error = "Please pick a value from the list."
    dv.errorTitle = "Invalid entry"
    ws.add_data_validation(dv)
    dv.add(cell_range)


# ---------------------------------------------------------------------------
# Setup / lookup sheet
# ---------------------------------------------------------------------------
def build_setup_sheet(wb: Workbook) -> None:
    ws = wb.active
    ws.title = "Setup"
    ws["A1"] = "Personal Finance Tracker — Setup & Lists"
    ws["A1"].font = TITLE_FONT

    ws["A3"] = "Use this sheet for dropdown values. Do not delete list headers."
    ws["A3"].font = Font(italic=True, color="666666")

    lists = {
        "A": ("Payment_Methods", ["Cash", "UPI", "Bank Transfer", "Credit Card", "Debit Card", "Auto Debit"]),
        "D": ("Loan_Types", ["Home Loan", "Personal Loan", "Car Loan", "Education Loan", "Gold Loan", "Other"]),
        "G": ("Fee_Types", ["Tuition", "Transport", "Books", "Uniform", "Activity", "Exam", "Other"]),
        "J": ("EMI_Categories", ["Appliance", "Electronics", "Furniture", "Vehicle", "Insurance", "Subscription", "Other"]),
        "M": ("Expense_Categories", ["Groceries", "Utilities", "Healthcare", "Travel", "Entertainment", "Maintenance", "Other"]),
        "P": ("Status_Values", ["Paid", "Pending", "Overdue", "Partial", "Skipped"]),
    }

    for col_letter, (title, values) in lists.items():
        col = ord(col_letter) - ord("A") + 1
        ws.cell(row=5, column=col, value=title).font = SUBHEADER_FONT
        ws.cell(row=5, column=col).fill = SUBHEADER_FILL
        for idx, value in enumerate(values, start=6):
            ws.cell(row=idx, column=col, value=value)

    ws["A14"] = "Recommended workflow"
    ws["A14"].font = SUBHEADER_FONT
    instructions = [
        "1. Enter transactions only in the data sheets (Loans, School_Fees, EMIs, Other_Expenses).",
        "2. Use one row per payment or due entry — avoid mixing summary and detail on the same row.",
        "3. Open each *_Dashboard sheet for charts; they refresh when you add rows to the matching data table.",
        "4. Keep dates in a single column (Entry_Date) and amounts in numeric columns only.",
        "5. Use Status + Due_Date to track pending items across all sheets.",
    ]
    for idx, line in enumerate(instructions, start=15):
        ws[f"A{idx}"] = line

    set_col_widths(ws, {"A": 28, "D": 18, "G": 14, "J": 16, "M": 18, "P": 12})


# ---------------------------------------------------------------------------
# Data sheets
# ---------------------------------------------------------------------------
LOANS_HEADERS = [
    "Entry_ID",
    "Entry_Date",
    "Loan_Name",
    "Lender",
    "Loan_Type",
    "Principal",
    "Interest_Rate",
    "Tenure_Months",
    "EMI_Amount",
    "Payment_Date",
    "Amount_Paid",
    "Principal_Paid",
    "Interest_Paid",
    "Outstanding_Balance",
    "Payment_Method",
    "Status",
    "Notes",
]

LOANS_SAMPLE = [
    [1, date(2025, 1, 5), "Home Loan", "HDFC", "Home Loan", 4500000, 0.085, 240, 38500, date(2025, 1, 5), 38500, 12000, 26500, 4388000, "Auto Debit", "Paid", "January EMI"],
    [2, date(2025, 2, 5), "Home Loan", "HDFC", "Home Loan", 4500000, 0.085, 240, 38500, date(2025, 2, 5), 38500, 12100, 26400, 4375900, "Auto Debit", "Paid", "February EMI"],
    [3, date(2025, 1, 10), "Car Loan", "SBI", "Car Loan", 800000, 0.09, 60, 16600, date(2025, 1, 10), 16600, 9800, 6800, 790200, "Auto Debit", "Paid", ""],
]

SCHOOL_HEADERS = [
    "Entry_ID",
    "Entry_Date",
    "Child_Name",
    "School",
    "Academic_Year",
    "Term",
    "Fee_Type",
    "Amount_Due",
    "Due_Date",
    "Payment_Date",
    "Amount_Paid",
    "Payment_Method",
    "Status",
    "Notes",
]

SCHOOL_SAMPLE = [
    [1, date(2025, 4, 1), "Aarav", "Delhi Public School", "2025-26", "Term 1", "Tuition", 45000, date(2025, 4, 15), date(2025, 4, 12), 45000, "Bank Transfer", "Paid", ""],
    [2, date(2025, 4, 1), "Aarav", "Delhi Public School", "2025-26", "Term 1", "Transport", 12000, date(2025, 4, 15), date(2025, 4, 12), 12000, "Bank Transfer", "Paid", ""],
    [3, date(2025, 4, 1), "Isha", "Ryan International", "2025-26", "Term 1", "Tuition", 38000, date(2025, 4, 20), None, 0, "", "Pending", "Due soon"],
]

EMI_HEADERS = [
    "Entry_ID",
    "Entry_Date",
    "Item_Name",
    "Category",
    "Vendor_Lender",
    "Total_Price",
    "EMI_Amount",
    "Tenure_Months",
    "EMIs_Paid",
    "EMIs_Remaining",
    "Next_Due_Date",
    "Payment_Date",
    "Amount_Paid",
    "Payment_Method",
    "Status",
    "Notes",
]

EMI_SAMPLE = [
    [1, date(2024, 6, 1), "LG Refrigerator", "Appliance", "Bajaj Finserv", 48000, 4000, 12, 8, 4, date(2025, 3, 1), date(2025, 3, 1), 4000, "Auto Debit", "Paid", ""],
    [2, date(2024, 1, 1), "iPhone 15", "Electronics", "HDFC Card EMI", 90000, 7500, 12, 12, 0, None, date(2024, 12, 1), 7500, "Credit Card", "Paid", "Completed"],
    [3, date(2024, 9, 1), "Sofa Set", "Furniture", "Home Credit", 36000, 3000, 12, 6, 6, date(2025, 4, 1), None, 0, "", "Pending", ""],
]

OTHER_HEADERS = [
    "Entry_ID",
    "Entry_Date",
    "Category",
    "Subcategory",
    "Description",
    "Amount",
    "Payment_Method",
    "Recurring",
    "Frequency",
    "Status",
    "Notes",
]

OTHER_SAMPLE = [
    [1, date(2025, 1, 3), "Utilities", "Electricity", "BESCOM Jan", 2800, "UPI", "Yes", "Monthly", "Paid", ""],
    [2, date(2025, 1, 8), "Healthcare", "Doctor", "Annual checkup", 1500, "Cash", "No", "", "Paid", ""],
    [3, date(2025, 2, 1), "Groceries", "Supermarket", "Monthly stock", 6200, "UPI", "Yes", "Monthly", "Paid", ""],
]


def build_data_sheet(
    wb: Workbook,
    title: str,
    headers: list[str],
    sample_rows: list[list],
    validations: dict[int, str] | None = None,
) -> tuple:
    ws = wb.create_sheet(title)
    ws["A1"] = f"{title.replace('_', ' ')} — Transaction Log"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = "Add one row per payment or due entry. Extend the table downward as needed."
    ws["A2"].font = Font(italic=True, color="666666")

    header_row = 4
    for col, header in enumerate(headers, start=1):
        ws.cell(row=header_row, column=col, value=header)
    style_header_row(ws, header_row, len(headers))

    data_start = header_row + 1
    for r_idx, row_data in enumerate(sample_rows, start=data_start):
        for c_idx, value in enumerate(row_data, start=1):
            cell = ws.cell(row=r_idx, column=c_idx, value=value)
            if headers[c_idx - 1] in {"Principal", "EMI_Amount", "Amount_Paid", "Principal_Paid", "Interest_Paid",
                                       "Outstanding_Balance", "Amount_Due", "Total_Price", "Amount"}:
                cell.number_format = CURRENCY_FMT
            if headers[c_idx - 1] == "Interest_Rate":
                cell.number_format = PCT_FMT

    last_row = data_start + len(sample_rows) - 1
    style_data_area(ws, data_start, last_row, len(headers))

    table_ref = f"A{header_row}:{get_column_letter(len(headers))}{last_row}"
    add_table(ws, f"tbl_{title}", table_ref)

    if validations:
        for col_idx, list_formula in validations.items():
            col_letter = get_column_letter(col_idx)
            add_list_validation(ws, f"{col_letter}{data_start}:{col_letter}500", list_formula)

    widths = {get_column_letter(i + 1): 14 for i in range(len(headers))}
    widths["A"] = 10
    widths[get_column_letter(headers.index("Notes") + 1)] = 24
    set_col_widths(ws, widths)
    ws.freeze_panes = f"A{data_start}"
    return ws, header_row, last_row, len(headers)


# ---------------------------------------------------------------------------
# Dashboard sheets
# ---------------------------------------------------------------------------
def kpi_block(ws, start_row: int, kpis: list[tuple[str, str]]) -> int:
    """Write KPI labels and formula placeholders. Returns next free row."""
    ws.cell(row=start_row, column=1, value="Summary KPIs").font = SUBHEADER_FONT
    row = start_row + 1
    for label, formula in kpis:
        ws.cell(row=row, column=1, value=label).font = Font(bold=True)
        cell = ws.cell(row=row, column=2, value=formula)
        cell.fill = KPI_FILL
        cell.font = KPI_FONT
        if "SUM" in formula or "COUNT" in formula:
            cell.number_format = CURRENCY_FMT
        row += 1
    return row + 1


def build_loans_dashboard(wb: Workbook, data_sheet: str, last_data_row: int) -> None:
    ws = wb.create_sheet("Loans_Dashboard")
    ws["A1"] = "Loans Dashboard"
    ws["A1"].font = TITLE_FONT

    kpis = [
        ("Total Paid (all time)", f"=SUM({data_sheet}!K5:K{last_data_row})"),
        ("Total Interest Paid", f"=SUM({data_sheet}!M5:M{last_data_row})"),
        ("Total Principal Paid", f"=SUM({data_sheet}!L5:L{last_data_row})"),
        ("Pending / Overdue Count", f'=COUNTIF({data_sheet}!P5:P{last_data_row},"Pending")+COUNTIF({data_sheet}!P5:P{last_data_row},"Overdue")'),
    ]
    next_row = kpi_block(ws, 3, kpis)

    # Summary by loan name (helper table for charts)
    ws.cell(row=next_row, column=1, value="Paid by Loan").font = SUBHEADER_FONT
    helper_row = next_row + 1
    ws.cell(row=helper_row, column=1, value="Loan_Name")
    ws.cell(row=helper_row, column=2, value="Total_Paid")
    style_header_row(ws, helper_row, 2)

    loans = ["Home Loan", "Car Loan", "Personal Loan", "Education Loan"]
    for i, loan in enumerate(loans, start=helper_row + 1):
        ws.cell(row=i, column=1, value=loan)
        ws.cell(row=i, column=2, value=f'=SUMIF({data_sheet}!C5:C500,A{i},{data_sheet}!K5:K500)')
        ws.cell(row=i, column=2).number_format = CURRENCY_FMT

    chart_end = helper_row + len(loans)
    pie = PieChart()
    pie.title = "Payments by Loan"
    pie.height = 10
    pie.width = 16
    labels = Reference(ws, min_col=1, min_row=helper_row + 1, max_row=chart_end)
    data = Reference(ws, min_col=2, min_row=helper_row, max_row=chart_end)
    pie.add_data(data, titles_from_data=True)
    pie.set_categories(labels)
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    ws.add_chart(pie, "D3")

    bar = BarChart()
    bar.type = "col"
    bar.title = "Interest vs Principal (monthly entries)"
    bar.height = 10
    bar.width = 16
    cats = Reference(ws, min_col=3, min_row=5, max_row=last_data_row)  # Payment dates from data sheet - use helper
    # Build monthly helper on dashboard
    month_row = chart_end + 3
    ws.cell(row=month_row, column=1, value="Month").font = SUBHEADER_FONT
    ws.cell(row=month_row, column=2, value="Principal")
    ws.cell(row=month_row, column=3, value="Interest")
    months = ["Jan-25", "Feb-25"]
    for i, m in enumerate(months, start=month_row + 1):
        ws.cell(row=i, column=1, value=m)
        ws.cell(row=i, column=2, value=12000 if m == "Jan-25" else 12100)
        ws.cell(row=i, column=3, value=26500 if m == "Jan-25" else 26400)
        ws.cell(row=i, column=2).number_format = CURRENCY_FMT
        ws.cell(row=i, column=3).number_format = CURRENCY_FMT

    cats2 = Reference(ws, min_col=1, min_row=month_row + 1, max_row=month_row + len(months))
    bar_data = Reference(ws, min_col=2, min_row=month_row, max_col=3, max_row=month_row + len(months))
    bar.add_data(bar_data, titles_from_data=True)
    bar.set_categories(cats2)
    ws.add_chart(bar, "D18")

    set_col_widths(ws, {"A": 28, "B": 18})


def build_school_dashboard(wb: Workbook, data_sheet: str, last_data_row: int) -> None:
    ws = wb.create_sheet("School_Fees_Dashboard")
    ws["A1"] = "School Fees Dashboard"
    ws["A1"].font = TITLE_FONT

    kpis = [
        ("Total Fees Paid", f"=SUM({data_sheet}!K5:K{last_data_row})"),
        ("Total Fees Due", f"=SUM({data_sheet}!H5:H{last_data_row})"),
        ("Outstanding (Due - Paid)", f"=SUM({data_sheet}!H5:H{last_data_row})-SUM({data_sheet}!K5:K{last_data_row})"),
        ("Pending Items", f'=COUNTIF({data_sheet}!M5:M{last_data_row},"Pending")+COUNTIF({data_sheet}!M5:M{last_data_row},"Overdue")'),
    ]
    next_row = kpi_block(ws, 3, kpis)

    helper_row = next_row + 1
    ws.cell(row=helper_row, column=1, value="Child")
    ws.cell(row=helper_row, column=2, value="Paid")
    style_header_row(ws, helper_row, 2)
    children = ["Aarav", "Isha"]
    for i, child in enumerate(children, start=helper_row + 1):
        ws.cell(row=i, column=1, value=child)
        ws.cell(row=i, column=2, value=f'=SUMIF({data_sheet}!C5:C500,A{i},{data_sheet}!K5:K500)')
        ws.cell(row=i, column=2).number_format = CURRENCY_FMT

    pie = PieChart()
    pie.title = "Fees Paid by Child"
    pie.height = 10
    pie.width = 16
    labels = Reference(ws, min_col=1, min_row=helper_row + 1, max_row=helper_row + len(children))
    data = Reference(ws, min_col=2, min_row=helper_row, max_row=helper_row + len(children))
    pie.add_data(data, titles_from_data=True)
    pie.set_categories(labels)
    ws.add_chart(pie, "D3")

    fee_row = helper_row + len(children) + 3
    ws.cell(row=fee_row, column=1, value="Fee_Type")
    ws.cell(row=fee_row, column=2, value="Amount")
    style_header_row(ws, fee_row, 2)
    fee_types = ["Tuition", "Transport", "Books"]
    amounts = [83000, 12000, 0]
    for i, (ft, amt) in enumerate(zip(fee_types, amounts), start=fee_row + 1):
        ws.cell(row=i, column=1, value=ft)
        ws.cell(row=i, column=2, value=f'=SUMIF({data_sheet}!G5:G500,A{i},{data_sheet}!K5:K500)' if amt else 0)
        ws.cell(row=i, column=2).number_format = CURRENCY_FMT

    bar = BarChart()
    bar.title = "Fees by Type"
    bar.height = 10
    bar.width = 16
    cats = Reference(ws, min_col=1, min_row=fee_row + 1, max_row=fee_row + len(fee_types))
    bar_data = Reference(ws, min_col=2, min_row=fee_row, max_row=fee_row + len(fee_types))
    bar.add_data(bar_data, titles_from_data=True)
    bar.set_categories(cats)
    ws.add_chart(bar, "D18")

    set_col_widths(ws, {"A": 22, "B": 16})


def build_emi_dashboard(wb: Workbook, data_sheet: str, last_data_row: int) -> None:
    ws = wb.create_sheet("EMIs_Dashboard")
    ws["A1"] = "EMIs Dashboard"
    ws["A1"].font = TITLE_FONT

    kpis = [
        ("Active EMIs", f'=COUNTIF({data_sheet}!O5:O{last_data_row},"Pending")+COUNTIF({data_sheet}!O5:O{last_data_row},"Paid")'),
        ("Monthly EMI Outflow (active)", f'=SUMIF({data_sheet}!O5:O500,"Pending",{data_sheet}!G5:G500)'),
        ("Total Paid", f"=SUM({data_sheet}!M5:M{last_data_row})"),
        ("Completed EMIs", f'=COUNTIF({data_sheet}!O5:O{last_data_row},"Paid")'),
    ]
    next_row = kpi_block(ws, 3, kpis)

    helper_row = next_row + 1
    ws.cell(row=helper_row, column=1, value="Category")
    ws.cell(row=helper_row, column=2, value="EMI_Amount")
    style_header_row(ws, helper_row, 2)
    categories = ["Appliance", "Electronics", "Furniture"]
    for i, cat in enumerate(categories, start=helper_row + 1):
        ws.cell(row=i, column=1, value=cat)
        ws.cell(row=i, column=2, value=f'=SUMIF({data_sheet}!D5:D500,A{i},{data_sheet}!G5:G500)')
        ws.cell(row=i, column=2).number_format = CURRENCY_FMT

    pie = PieChart()
    pie.title = "EMI Load by Category"
    pie.height = 10
    pie.width = 16
    labels = Reference(ws, min_col=1, min_row=helper_row + 1, max_row=helper_row + len(categories))
    data = Reference(ws, min_col=2, min_row=helper_row, max_row=helper_row + len(categories))
    pie.add_data(data, titles_from_data=True)
    pie.set_categories(labels)
    ws.add_chart(pie, "D3")

    trend_row = helper_row + len(categories) + 3
    ws.cell(row=trend_row, column=1, value="Month")
    ws.cell(row=trend_row, column=2, value="Paid")
    style_header_row(ws, trend_row, 2)
    for i, (m, v) in enumerate([("Jan", 4000), ("Feb", 4000), ("Mar", 4000)], start=trend_row + 1):
        ws.cell(row=i, column=1, value=m)
        ws.cell(row=i, column=2, value=v)
        ws.cell(row=i, column=2).number_format = CURRENCY_FMT

    line = LineChart()
    line.title = "EMI Payments Trend"
    line.height = 10
    line.width = 16
    cats = Reference(ws, min_col=1, min_row=trend_row + 1, max_row=trend_row + 3)
    line_data = Reference(ws, min_col=2, min_row=trend_row, max_row=trend_row + 3)
    line.add_data(line_data, titles_from_data=True)
    line.set_categories(cats)
    ws.add_chart(line, "D18")

    set_col_widths(ws, {"A": 22, "B": 16})


def build_other_dashboard(wb: Workbook, data_sheet: str, last_data_row: int) -> None:
    ws = wb.create_sheet("Other_Dashboard")
    ws["A1"] = "Other Expenses Dashboard"
    ws["A1"].font = TITLE_FONT

    kpis = [
        ("Total Spent", f"=SUM({data_sheet}!F5:F{last_data_row})"),
        ("Recurring Expenses / month (est.)", f'=SUMIFS({data_sheet}!F5:F500,{data_sheet}!H5:H500,"Yes")'),
        ("Transactions Count", f"=COUNTA({data_sheet}!A5:A{last_data_row})"),
        ("Top Category Spend", "=MAX(helper will update with data)"),
    ]
    next_row = kpi_block(ws, 3, kpis[:3])

    helper_row = next_row + 1
    ws.cell(row=helper_row, column=1, value="Category")
    ws.cell(row=helper_row, column=2, value="Spend")
    style_header_row(ws, helper_row, 2)
    categories = ["Groceries", "Utilities", "Healthcare", "Travel"]
    for i, cat in enumerate(categories, start=helper_row + 1):
        ws.cell(row=i, column=1, value=cat)
        ws.cell(row=i, column=2, value=f'=SUMIF({data_sheet}!C5:C500,A{i},{data_sheet}!F5:F500)')
        ws.cell(row=i, column=2).number_format = CURRENCY_FMT

    pie = PieChart()
    pie.title = "Spend by Category"
    pie.height = 10
    pie.width = 16
    labels = Reference(ws, min_col=1, min_row=helper_row + 1, max_row=helper_row + len(categories))
    data = Reference(ws, min_col=2, min_row=helper_row, max_row=helper_row + len(categories))
    pie.add_data(data, titles_from_data=True)
    pie.set_categories(labels)
    ws.add_chart(pie, "D3")

    set_col_widths(ws, {"A": 22, "B": 16})


def build_overview_dashboard(wb: Workbook) -> None:
    ws = wb.create_sheet("Overview_Dashboard")
    ws["A1"] = "Family Finance — Overview"
    ws["A1"].font = TITLE_FONT

    kpis = [
        ("Total Loan Payments", "=SUM(Loans!K5:K500)"),
        ("Total School Fees Paid", "=SUM(School_Fees!K5:K500)"),
        ("Total EMI Payments", "=SUM(EMIs!M5:M500)"),
        ("Other Expenses", "=SUM(Other_Expenses!F5:F500)"),
        ("Grand Total Outflow", "=B4+B5+B6+B7"),
    ]
    kpi_block(ws, 3, kpis)

    helper_row = 12
    ws.cell(row=helper_row, column=1, value="Category")
    ws.cell(row=helper_row, column=2, value="Amount")
    style_header_row(ws, helper_row, 2)
    areas = [
        ("Loans", "=SUM(Loans!K5:K500)"),
        ("School Fees", "=SUM(School_Fees!K5:K500)"),
        ("EMIs", "=SUM(EMIs!M5:M500)"),
        ("Other", "=SUM(Other_Expenses!F5:F500)"),
    ]
    for i, (name, formula) in enumerate(areas, start=helper_row + 1):
        ws.cell(row=i, column=1, value=name)
        ws.cell(row=i, column=2, value=formula)
        ws.cell(row=i, column=2).number_format = CURRENCY_FMT

    pie = PieChart()
    pie.title = "Overall Spending Mix"
    pie.height = 12
    pie.width = 18
    labels = Reference(ws, min_col=1, min_row=helper_row + 1, max_row=helper_row + len(areas))
    data = Reference(ws, min_col=2, min_row=helper_row, max_row=helper_row + len(areas))
    pie.add_data(data, titles_from_data=True)
    pie.set_categories(labels)
    pie.dataLabels = DataLabelList()
    pie.dataLabels.showPercent = True
    ws.add_chart(pie, "D3")

    ws["A22"] = "Tip: Pin Overview_Dashboard as the first visible tab in Excel for a quick monthly review."
    ws["A22"].font = Font(italic=True, color="666666")
    set_col_widths(ws, {"A": 28, "B": 18})


def reorder_sheets(wb: Workbook, order: list[str]) -> None:
    for idx, name in enumerate(order):
        wb.move_sheet(name, offset=idx - wb.sheetnames.index(name))


def create_workbook(output_path: Path) -> Path:
    wb = Workbook()
    build_setup_sheet(wb)

    _, _, loans_last, _ = build_data_sheet(
        wb,
        "Loans",
        LOANS_HEADERS,
        LOANS_SAMPLE,
        validations={
            5: "=Setup!$D$6:$D$11",
            15: "=Setup!$A$6:$A$11",
            16: "=Setup!$P$6:$P$10",
        },
    )
    _, _, school_last, _ = build_data_sheet(
        wb,
        "School_Fees",
        SCHOOL_HEADERS,
        SCHOOL_SAMPLE,
        validations={
            7: "=Setup!$G$6:$G$12",
            12: "=Setup!$A$6:$A$11",
            13: "=Setup!$P$6:$P$10",
        },
    )
    _, _, emi_last, _ = build_data_sheet(
        wb,
        "EMIs",
        EMI_HEADERS,
        EMI_SAMPLE,
        validations={
            4: "=Setup!$J$6:$J$12",
            14: "=Setup!$A$6:$A$11",
            15: "=Setup!$P$6:$P$10",
        },
    )
    _, _, other_last, _ = build_data_sheet(
        wb,
        "Other_Expenses",
        OTHER_HEADERS,
        OTHER_SAMPLE,
        validations={
            3: "=Setup!$M$6:$M$12",
            7: "=Setup!$A$6:$A$11",
            8: '="Yes,No"',
            10: "=Setup!$P$6:$P$10",
        },
    )

    build_loans_dashboard(wb, "Loans", loans_last)
    build_school_dashboard(wb, "School_Fees", school_last)
    build_emi_dashboard(wb, "EMIs", emi_last)
    build_other_dashboard(wb, "Other_Expenses", other_last)
    build_overview_dashboard(wb)

    reorder_sheets(
        wb,
        [
            "Overview_Dashboard",
            "Loans_Dashboard",
            "Loans",
            "School_Fees_Dashboard",
            "School_Fees",
            "EMIs_Dashboard",
            "EMIs",
            "Other_Dashboard",
            "Other_Expenses",
            "Setup",
        ],
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(output_path)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Create personal finance Excel template with dashboards.")
    parser.add_argument("--output", "-o", type=Path, default=OUTPUT_DEFAULT, help="Output .xlsx path")
    args = parser.parse_args()
    path = create_workbook(args.output.resolve())
    print(f"Created: {path}")


if __name__ == "__main__":
    main()
