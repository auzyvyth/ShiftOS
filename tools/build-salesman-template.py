#!/usr/bin/env python3
"""Builds the free salesman spreadsheet: public/downloads/template-salesman-kereta.xlsx

Two articles link to it (cara-kira-loan-kereta-excel, template-excel-rekod-
prospek-salesman-kereta). Rebuild after changing this file:

    python3 tools/build-salesman-template.py

Sheets: Cara guna, Kira Loan (EIR, a flat rate converted per tenure), Prospek
(lead list with stage + follow-up dropdowns, overdue rows turn red), Ringkasan.
The loan maths must match src/utils/financing.js: EIR on the reducing balance,
flat converted with RATE() (same as flatToEir). The sample loan (RM54,000 at
3.5% flat over 7 years) gives 6.44% EIR and RM800.36 a month, the numbers the
article quotes. Malay only, no brand name; the one link comes from SITE_URL in
src/config/site.js so the domain switch needs no edit here.
"""
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "downloads" / "template-salesman-kereta.xlsx"
SITE = re.search(r'ROOT_DOMAIN\s*=\s*"([^"]+)"', (ROOT / "src/config/site.js").read_text()).group(1)
APP_LINK = f"https://{SITE}/for-salesmen"

RED = "DC2626"
INK = "111827"
MUTED = "6B7280"
INPUT_FILL = PatternFill("solid", fgColor="FEF9C3")
HEAD_FILL = PatternFill("solid", fgColor=INK)
SOFT_FILL = PatternFill("solid", fgColor="F3F4F6")
THIN = Side(style="thin", color="E5E7EB")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
ROWS = 300  # prospect rows prepared with formulas, dropdowns and colours

SOURCES = ["WhatsApp", "TikTok", "Facebook", "Instagram", "Mudah / Carlist", "Walk-in", "Rujukan", "Lain-lain"]
STAGES = ["Baru", "Dihubungi", "Viewing", "Test drive", "Rundingan", "Deposit", "Menang", "Kalah"]


def title(ws, text, sub=None):
    ws["A1"] = text
    ws["A1"].font = Font(size=16, bold=True, color=INK)
    if sub:
        ws["A2"] = sub
        ws["A2"].font = Font(size=10, color=MUTED)


def header_row(ws, row, labels):
    for i, label in enumerate(labels, start=1):
        c = ws.cell(row=row, column=i, value=label)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = HEAD_FILL
        c.alignment = Alignment(vertical="center", wrap_text=True)
        c.border = BOX


def build_guide(ws):
    title(ws, "Template Salesman Kereta", "Kira loan + rekod prospek. Percuma, guna dan ubah ikut suka.")
    lines = [
        ("Kira Loan", "Isi kotak kuning: harga, deposit, kadar dan jenis kadar (Flat atau EIR). "
                      "Monthly 9, 7 dan 5 tahun keluar sendiri."),
        ("", "Kadar flat ditukar ke EIR untuk setiap tempoh, sebab sejak Akta Sewa Beli (Pindaan) 2026 "
             "(berkuat kuasa 1 Jun 2026) perjanjian sewa beli baru dikira atas baki berkurangan."),
        ("", "Jangan taip kadar flat sebagai EIR: monthly akan keluar terlalu rendah."),
        ("Prospek", "Satu baris satu pembeli. Pilih Sumber dan Stage dari senarai. "
                    "Isi 'Follow up seterusnya' setiap kali anda hubungi dia."),
        ("", "Baris jadi merah bila tarikh follow up dah sampai dan deal belum Menang atau Kalah."),
        ("", "Padam baris contoh (Ali) bila dah faham."),
        ("Ringkasan", "Bilangan pembeli ikut stage dan berapa follow up yang dah sampai masa. Dikira sendiri."),
        ("Data pelanggan", "Nombor telefon pembeli ialah data peribadi. Letak kata laluan pada fail ini, "
                           "jangan kongsi, dan padam pembeli yang dah tak berurusan dengan anda."),
        ("Anggaran", "Semua kiraan loan ialah anggaran. Kelulusan, kadar dan ansuran sebenar ditentukan oleh bank."),
        ("Nak lebih senang?", f"Lead dari WhatsApp, chat dan booking masuk sendiri, reminder follow up, "
                              f"dan monthly siap untuk setiap kereta masa live: {APP_LINK}"),
    ]
    r = 4
    for head, body in lines:
        ws.cell(row=r, column=1, value=head).font = Font(bold=True, color=RED if head else INK)
        c = ws.cell(row=r, column=2, value=body)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        r += 1
    ws.cell(row=r - 1, column=2).hyperlink = APP_LINK
    ws.column_dimensions["A"].width = 18
    ws.column_dimensions["B"].width = 95
    for row in range(4, r):
        ws.row_dimensions[row].height = 32


def build_loan(ws):
    title(ws, "Kira Loan Kereta (EIR, baki berkurangan)", "Isi kotak kuning sahaja. Anggaran; bank yang tentukan.")
    inputs = [
        ("Harga kereta (RM)", 60000, '#,##0'),
        ("Deposit (RM)", 6000, '#,##0'),
        ("Kadar faedah (% setahun)", 3.5, '0.00'),
        ("Jenis kadar", "Flat", None),
    ]
    for i, (label, val, fmt) in enumerate(inputs, start=4):
        ws.cell(row=i, column=1, value=label).font = Font(bold=True, color=INK)
        c = ws.cell(row=i, column=2, value=val)
        c.fill = INPUT_FILL
        c.border = BOX
        if fmt:
            c.number_format = fmt
    dv = DataValidation(type="list", formula1='"Flat,EIR"', allow_blank=False)
    ws.add_data_validation(dv)
    dv.add("B7")
    ws["C7"] = "Flat = kadar yang showroom biasa sebut. EIR = kadar dalam dokumen bank."
    ws["C7"].font = Font(size=9, color=MUTED)

    ws["A9"] = "Jumlah pinjaman (RM)"
    ws["A9"].font = Font(bold=True, color=INK)
    ws["B9"] = "=B4-B5"
    ws["B9"].number_format = '#,##0.00'
    ws["B9"].font = Font(bold=True, color=INK)

    header_row(ws, 11, ["Tempoh (tahun)", "Bulan", "EIR (%)", "Ansuran bulanan (RM)", "Jumlah faedah (RM)", "Jumlah bayar (RM)"])
    for r, years in zip(range(12, 15), (9, 7, 5)):
        ws.cell(row=r, column=1, value=years)
        ws.cell(row=r, column=2, value=f"=A{r}*12")
        # A flat rate becomes the EIR that gives the same instalment
        # (financing.js flatToEir); an EIR is used as typed.
        ws.cell(row=r, column=3, value=f'=IF($B$7="Flat",RATE(B{r},-$B$9*(1+$B$6/100*A{r})/B{r},$B$9)*12*100,$B$6)')
        ws.cell(row=r, column=4, value=f"=PMT(C{r}/100/12,B{r},-$B$9)")
        ws.cell(row=r, column=5, value=f"=D{r}*B{r}-$B$9")
        ws.cell(row=r, column=6, value=f"=D{r}*B{r}")
        for col, fmt in ((3, '0.00'), (4, '#,##0.00'), (5, '#,##0.00'), (6, '#,##0.00')):
            ws.cell(row=r, column=col).number_format = fmt
        ws.cell(row=r, column=4).font = Font(bold=True, color=RED)
        for col in range(1, 7):
            ws.cell(row=r, column=col).border = BOX
    ws["A16"] = "Anggaran sahaja. Kelulusan, kadar dan ansuran sebenar ditentukan oleh bank. Insurans tidak termasuk."
    ws["A16"].font = Font(size=9, color=MUTED)
    for col, w in zip("ABCDEF", (26, 12, 10, 22, 20, 18)):
        ws.column_dimensions[col].width = w


def build_prospects(ws):
    cols = ["Tarikh masuk", "Nama", "No. telefon", "Sumber", "Kereta diminati", "Bajet monthly (RM)",
            "Stage", "Hubungi terakhir", "Follow up seterusnya", "Hari sejak dihubungi", "Nota"]
    header_row(ws, 1, cols)
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "C2"
    last = ROWS + 1
    for r in range(2, last + 1):
        ws.cell(row=r, column=10, value=f'=IF(H{r}="","",TODAY()-H{r})')
        for col in (1, 8, 9):
            ws.cell(row=r, column=col).number_format = "dd/mm/yyyy"
        ws.cell(row=r, column=6).number_format = '#,##0'
    sample = ["=TODAY()-3", "Contoh: Ali (padam baris ini)", "012-345 6789", "TikTok", "Proton X50",
              800, "Dihubungi", "=TODAY()-2", "=TODAY()", None, "Tanya deposit 10%, nak test drive Sabtu"]
    for col, val in enumerate(sample, start=1):
        if val is not None:
            ws.cell(row=2, column=col, value=val)

    for values, col in ((SOURCES, "D"), (STAGES, "G")):
        dv = DataValidation(type="list", formula1='"' + ",".join(values) + '"', allow_blank=True)
        ws.add_data_validation(dv)
        dv.add(f"{col}2:{col}{last}")
    dates = DataValidation(type="date", operator="greaterThan", formula1="DATE(2020,1,1)", allow_blank=True)
    dates.error = "Taip tarikh, contoh 28/10/2026"
    ws.add_data_validation(dates)
    dates.add(f"H2:I{last}")

    span = f"A2:K{last}"
    ws.conditional_formatting.add(span, FormulaRule(
        formula=['AND($I2<>"",$I2<=TODAY(),$G2<>"Menang",$G2<>"Kalah")'],
        fill=PatternFill("solid", fgColor="FEE2E2"), font=Font(color="991B1B"), stopIfTrue=True))
    ws.conditional_formatting.add(span, FormulaRule(
        formula=['$G2="Menang"'], fill=PatternFill("solid", fgColor="DCFCE7"), stopIfTrue=True))
    ws.conditional_formatting.add(span, FormulaRule(
        formula=['$G2="Kalah"'], font=Font(color="9CA3AF"), stopIfTrue=True))
    for col, w in zip("ABCDEFGHIJK", (13, 28, 15, 15, 20, 12, 13, 15, 16, 12, 40)):
        ws.column_dimensions[col].width = w


def build_summary(ws):
    title(ws, "Ringkasan", "Dikira sendiri dari helaian Prospek.")
    last = ROWS + 1
    header_row(ws, 4, ["Stage", "Bilangan"])
    for i, stage in enumerate(STAGES, start=5):
        ws.cell(row=i, column=1, value=stage).border = BOX
        c = ws.cell(row=i, column=2, value=f'=COUNTIF(Prospek!$G$2:$G${last},A{i})')
        c.border = BOX
    r = 5 + len(STAGES) + 1
    ws.cell(row=r, column=1, value="Follow up dah sampai masa").font = Font(bold=True, color=RED)
    ws.cell(row=r, column=2, value=f'=COUNTIFS(Prospek!$I$2:$I${last},"<="&TODAY(),Prospek!$G$2:$G${last},"<>Menang",Prospek!$G$2:$G${last},"<>Kalah")').font = Font(bold=True, color=RED)
    ws.cell(row=r + 1, column=1, value="Jumlah pembeli")
    ws.cell(row=r + 1, column=2, value=f'=COUNTA(Prospek!$B$2:$B${last})')
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 12


def main():
    wb = Workbook()
    guide = wb.active
    guide.title = "Cara guna"
    build_guide(guide)
    build_loan(wb.create_sheet("Kira Loan"))
    build_prospects(wb.create_sheet("Prospek"))
    build_summary(wb.create_sheet("Ringkasan"))
    for ws in wb.worksheets:
        ws.sheet_view.showGridLines = ws.title == "Prospek"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
