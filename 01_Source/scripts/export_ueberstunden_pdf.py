#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ueberstunden-Export fuer TeamFlow (PDF)
Nur geleistete Ueberstunden (Stunden > 0): wer, wann, wie viel, Notiz + Summen.
"""

import sys
import json
import io
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle,
        Paragraph, Spacer, PageBreak, HRFlowable
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
except ImportError:
    print("FEHLER: reportlab nicht installiert!", file=sys.stderr)
    print("Installiere mit: pip install reportlab", file=sys.stderr)
    sys.exit(1)


# ── Farben ──────────────────────────────────────────────────────────────────
C_PRIMARY    = colors.HexColor("#1F538D")
C_ABT        = colors.HexColor("#2D5FA8")
C_UEBERSTD_G = colors.HexColor("#CFE2FF")
C_SUMME      = colors.HexColor("#E8E8E8")
C_WHITE      = colors.white
C_LIGHT      = colors.HexColor("#F5F5F5")
C_GREY       = colors.HexColor("#CCCCCC")
C_TEXT       = colors.HexColor("#1A1A1A")


def fmt_datum(d):
    if not d:
        return ""
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").strftime("%d.%m.%Y")
    except Exception:
        return d


def fmt_zahl(v):
    if v is None:
        return 0
    try:
        f = float(v)
        return int(f) if f == int(f) else round(f, 2)
    except Exception:
        return 0


def get_styles():
    base = getSampleStyleSheet()
    titel = ParagraphStyle(
        "Titel", parent=base["Normal"], fontSize=18, textColor=C_PRIMARY,
        fontName="Helvetica-Bold", spaceAfter=4, alignment=TA_CENTER,
    )
    untertitel = ParagraphStyle(
        "Untertitel", parent=base["Normal"], fontSize=10, textColor=colors.grey,
        fontName="Helvetica", spaceAfter=16, alignment=TA_CENTER,
    )
    abschnitt = ParagraphStyle(
        "Abschnitt", parent=base["Normal"], fontSize=12, textColor=C_PRIMARY,
        fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=6,
    )
    return titel, untertitel, abschnitt


def footer_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(doc.pagesize[0] - 1.5*cm, 1.0*cm, f"Seite {doc.page}")
    canvas.drawString(1.5*cm, 1.0*cm, f"TeamFlow Ueberstunden-Export - {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    canvas.restoreState()


def baue_zusammenfassung(mitarbeiter_liste, gesamt_alle):
    elements = []
    headers = ["Mitarbeiter", "Abteilung", "Geleistete Stunden", "Anzahl Eintraege"]
    col_widths = [7*cm, 5*cm, 5*cm, 5*cm]

    table_data = [headers]
    style_cmds = [
        ("BACKGROUND",    (0,0), (-1,0), C_PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0), C_WHITE),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 9),
        ("ALIGN",         (0,0), (-1,0), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,0), 7),
        ("BOTTOMPADDING", (0,0), (-1,0), 7),
        ("FONTNAME",  (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",  (0,1), (-1,-1), 9),
        ("ALIGN",     (2,1), (-1,-1), "CENTER"),
        ("ALIGN",     (0,1), (1,-1), "LEFT"),
        ("TOPPADDING",    (0,1), (-1,-1), 5),
        ("BOTTOMPADDING", (0,1), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("GRID",      (0,0), (-1,-1), 0.4, C_GREY),
    ]

    aktuelle_abteilung = None
    data_row = 1

    for eintrag in mitarbeiter_liste:
        ma = eintrag.get("mitarbeiter", {})
        abt = ma.get("abteilung", "")

        if abt != aktuelle_abteilung:
            aktuelle_abteilung = abt
            table_data.append([abt, "", "", ""])
            style_cmds += [
                ("BACKGROUND", (0, data_row), (-1, data_row), C_ABT),
                ("TEXTCOLOR",  (0, data_row), (-1, data_row), C_WHITE),
                ("FONTNAME",   (0, data_row), (-1, data_row), "Helvetica-Bold"),
                ("FONTSIZE",   (0, data_row), (-1, data_row), 9),
                ("SPAN",       (0, data_row), (-1, data_row)),
            ]
            data_row += 1

        zeile = [
            ma.get("name", ""),
            abt,
            f"{fmt_zahl(eintrag.get('gesamtStunden', 0))} h",
            len(eintrag.get("eintraege", [])),
        ]
        table_data.append(zeile)
        if data_row % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, data_row), (-1, data_row), C_LIGHT))
        data_row += 1

    table_data.append([
        "GESAMT", "",
        f"{fmt_zahl(gesamt_alle)} h",
        sum(len(e.get("eintraege", [])) for e in mitarbeiter_liste),
    ])
    style_cmds += [
        ("BACKGROUND", (0, data_row), (-1, data_row), C_SUMME),
        ("FONTNAME",   (0, data_row), (-1, data_row), "Helvetica-Bold"),
        ("FONTSIZE",   (0, data_row), (-1, data_row), 9),
        ("SPAN",       (0, data_row), (1, data_row)),
    ]

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)
    return elements


def baue_detail(mitarbeiter_liste):
    elements = [Spacer(1, 0.5*cm)]

    headers = ["Mitarbeiter", "Abteilung", "Datum", "Stunden", "Notiz"]
    col_widths = [4.5*cm, 3.5*cm, 2.5*cm, 2.5*cm, 0]
    seite_b = landscape(A4)[0] - 3*cm
    col_widths[-1] = seite_b - sum(col_widths[:-1])

    table_data = [headers]
    style_cmds = [
        ("BACKGROUND",    (0,0), (-1,0), C_PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0), C_WHITE),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 9),
        ("ALIGN",         (0,0), (-1,0), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,0), 7),
        ("BOTTOMPADDING", (0,0), (-1,0), 7),
        ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",      (0,1), (-1,-1), 8),
        ("ALIGN",         (2,1), (3,-1), "CENTER"),
        ("ALIGN",         (0,1), (1,-1), "LEFT"),
        ("TOPPADDING",    (0,1), (-1,-1), 3),
        ("BOTTOMPADDING", (0,1), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ("GRID",          (0,0), (-1,-1), 0.4, C_GREY),
    ]

    aktuelle_abteilung = None
    data_row = 1

    for eintrag in mitarbeiter_liste:
        ma = eintrag.get("mitarbeiter", {})
        abt = ma.get("abteilung", "")
        name = ma.get("name", "")
        eintraege = eintrag.get("eintraege", [])

        if not eintraege:
            continue

        if abt != aktuelle_abteilung:
            aktuelle_abteilung = abt
            table_data.append([abt, "", "", "", ""])
            style_cmds += [
                ("BACKGROUND", (0, data_row), (-1, data_row), C_ABT),
                ("TEXTCOLOR",  (0, data_row), (-1, data_row), C_WHITE),
                ("FONTNAME",   (0, data_row), (-1, data_row), "Helvetica-Bold"),
                ("FONTSIZE",   (0, data_row), (-1, data_row), 9),
                ("SPAN",       (0, data_row), (-1, data_row)),
            ]
            data_row += 1

        for e in eintraege:
            zeile = [name, abt, fmt_datum(e.get("datum")), f"{fmt_zahl(e.get('stunden', 0))} h", e.get("notiz") or ""]
            table_data.append(zeile)
            style_cmds.append(("BACKGROUND", (3, data_row), (3, data_row), C_UEBERSTD_G))
            data_row += 1

        summe = sum(fmt_zahl(e.get("stunden", 0)) for e in eintraege)
        table_data.append([f"Summe {name}", "", "", f"{fmt_zahl(summe)} h", ""])
        style_cmds += [
            ("BACKGROUND", (0, data_row), (-1, data_row), C_SUMME),
            ("FONTNAME",   (0, data_row), (-1, data_row), "Helvetica-Bold"),
            ("FONTSIZE",   (0, data_row), (-1, data_row), 8),
            ("SPAN",       (0, data_row), (2, data_row)),
        ]
        data_row += 1

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)
    return elements


def create_pdf(payload, output_path):
    export_data       = payload.get("exportData", payload)
    mitarbeiter_liste = export_data.get("mitarbeiter", [])
    von_datum         = export_data.get("vonDatum", "")
    bis_datum         = export_data.get("bisDatum", "")
    gesamt_alle       = export_data.get("gesamtStundenAlle", 0)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        topMargin=1.5*cm, bottomMargin=2*cm, leftMargin=1.5*cm, rightMargin=1.5*cm,
    )

    s_titel, s_untertitel, s_abschnitt = get_styles()

    elements = [
        Paragraph("Ueberstunden-Uebersicht", s_titel),
        Paragraph(f"{fmt_datum(von_datum)} - {fmt_datum(bis_datum)}", s_untertitel),
        HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceAfter=10),
        Paragraph("Zusammenfassung", s_abschnitt),
    ]
    elements.extend(baue_zusammenfassung(mitarbeiter_liste, gesamt_alle))

    elements.append(PageBreak())
    elements.append(Paragraph("Ueberstunden-Uebersicht", s_titel))
    elements.append(Paragraph(f"{fmt_datum(von_datum)} - {fmt_datum(bis_datum)}", s_untertitel))
    elements.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceAfter=10))
    elements.append(Paragraph("Details", s_abschnitt))
    elements.extend(baue_detail(mitarbeiter_liste))

    doc.build(elements, onFirstPage=footer_canvas, onLaterPages=footer_canvas)
    sys.stdout.buffer.write(f"PDF erfolgreich erstellt: {output_path}\n".encode("utf-8"))


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("FEHLER: Usage: python export_ueberstunden_pdf.py <input.json> <output.pdf>\n")
        sys.exit(1)

    input_file  = sys.argv[1]
    output_file = sys.argv[2]

    try:
        with io.open(input_file, "r", encoding="utf-8-sig") as f:
            payload = json.load(f)
        sys.stdout.buffer.write(b"JSON gelesen\n")
    except Exception as e:
        sys.stderr.buffer.write(f"FEHLER beim Lesen der JSON: {e}\n".encode("utf-8"))
        sys.exit(1)

    try:
        create_pdf(payload, output_file)
    except Exception as e:
        sys.stderr.buffer.write(f"FEHLER beim Erstellen der PDF: {e}\n".encode("utf-8"))
        sys.exit(1)


if __name__ == "__main__":
    main()
