#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kalender-Export fuer TeamFlow (PDF)
Tagesweise Uebersicht aller Abwesenheiten + Liste der Tage,
an denen alle Mitarbeiter anwesend waren (ohne Wochenende/Feiertag).
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
        Paragraph, Spacer, HRFlowable
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
except ImportError:
    print("FEHLER: reportlab nicht installiert!", file=sys.stderr)
    print("Installiere mit: pip install reportlab", file=sys.stderr)
    sys.exit(1)


# ── Farben ──────────────────────────────────────────────────────────────────
C_PRIMARY    = colors.HexColor("#1F538D")
C_ALLE_DA    = colors.HexColor("#D6F0D6")
C_WOCHENENDE = colors.HexColor("#E8E8E8")
C_FEIERTAG   = colors.HexColor("#E4D6F5")
C_WHITE      = colors.white
C_LIGHT      = colors.HexColor("#F5F5F5")
C_GREY       = colors.HexColor("#CCCCCC")
C_TEXT       = colors.HexColor("#1A1A1A")

TYP_LABEL = {
    "urlaub":       "Urlaub",
    "krankheit":    "Krankheit",
    "schulung":     "Schulung",
    "ueberstunden": "UE-Abbau",
}


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
    zelle = ParagraphStyle(
        "Zelle", parent=base["Normal"], fontSize=8, textColor=C_TEXT,
        fontName="Helvetica", leading=10,
    )
    return titel, untertitel, abschnitt, zelle


def footer_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(doc.pagesize[0] - 1.5*cm, 1.0*cm, f"Seite {doc.page}")
    canvas.drawString(1.5*cm, 1.0*cm, f"TeamFlow Kalender-Export - {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    canvas.restoreState()


def baue_alle_anwesend_block(alle_anwesend, abschnitt_style, zelle_style):
    elements = [Paragraph(f"Alle Mitarbeiter anwesend ({len(alle_anwesend)} Tage)", abschnitt_style)]
    if alle_anwesend:
        text = ", ".join(f"{t.get('wochentagName','')[:2]}. {fmt_datum(t.get('datum'))}" for t in alle_anwesend)
        elements.append(Paragraph(text, zelle_style))
    else:
        elements.append(Paragraph("Keine Tage mit vollstaendiger Anwesenheit im Zeitraum", zelle_style))
    elements.append(Spacer(1, 0.4*cm))
    return elements


def baue_kalender_tabelle(tage, zelle_style):
    headers = ["Datum", "Wochentag", "Status", "Eintraege"]
    col_widths = [2.6*cm, 2.8*cm, 3.5*cm, 0]
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
        ("TOPPADDING",    (0,0), (-1,0), 6),
        ("BOTTOMPADDING", (0,0), (-1,0), 6),
        ("FONTNAME",      (0,1), (2,-1), "Helvetica"),
        ("FONTSIZE",      (0,1), (2,-1), 8),
        ("ALIGN",         (0,1), (2,-1), "CENTER"),
        ("TOPPADDING",    (0,1), (-1,-1), 3),
        ("BOTTOMPADDING", (0,1), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 4),
        ("GRID",          (0,0), (-1,-1), 0.4, C_GREY),
    ]

    data_row = 1
    for tag in tage:
        datum_str      = fmt_datum(tag.get("datum"))
        wochentag      = tag.get("wochentagName", "")
        ist_wochenende = tag.get("istWochenende", False)
        ist_feiertag   = tag.get("istFeiertag", False)
        feiertag_name  = tag.get("feiertagName") or ""
        alle_da        = tag.get("alleAnwesend", False)
        eintraege      = tag.get("eintraege", [])

        if alle_da:
            status, farbe = "Alle anwesend", C_ALLE_DA
        elif ist_wochenende:
            status, farbe = "Wochenende", C_WOCHENENDE
        elif ist_feiertag:
            status, farbe = f"Feiertag: {feiertag_name}", C_FEIERTAG
        else:
            status, farbe = "", None

        if eintraege:
            zeilen = []
            for e in eintraege:
                wert = fmt_zahl(e.get("wert", 0))
                einheit = e.get("einheit", "T")
                typ_label = TYP_LABEL.get(e.get("typ", ""), e.get("typ", ""))
                notiz = e.get("notiz") or ""
                zusatz = f" - {notiz}" if notiz else ""
                zeilen.append(f"{e.get('mitarbeiter','')}: {typ_label} ({wert} {einheit}){zusatz}")
            eintraege_para = Paragraph("<br/>".join(zeilen), zelle_style)
        else:
            eintraege_para = ""

        table_data.append([datum_str, wochentag, status, eintraege_para])

        if farbe:
            style_cmds.append(("BACKGROUND", (2, data_row), (2, data_row), farbe))
        if data_row % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, data_row), (1, data_row), C_LIGHT))

        data_row += 1

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle(style_cmds))
    return [table]


def create_pdf(payload, output_path):
    export_data   = payload.get("exportData", payload)
    tage          = export_data.get("tage", [])
    alle_anwesend = export_data.get("alleAnwesendTage", [])
    von_datum     = export_data.get("vonDatum", "")
    bis_datum     = export_data.get("bisDatum", "")

    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        topMargin=1.5*cm, bottomMargin=2*cm, leftMargin=1.5*cm, rightMargin=1.5*cm,
    )

    s_titel, s_untertitel, s_abschnitt, s_zelle = get_styles()

    elements = [
        Paragraph("Kalenderuebersicht", s_titel),
        Paragraph(f"{fmt_datum(von_datum)} - {fmt_datum(bis_datum)}", s_untertitel),
        HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceAfter=10),
    ]
    elements.extend(baue_alle_anwesend_block(alle_anwesend, s_abschnitt, s_zelle))
    elements.append(Paragraph("Tagesuebersicht", s_abschnitt))
    elements.extend(baue_kalender_tabelle(tage, s_zelle))

    doc.build(elements, onFirstPage=footer_canvas, onLaterPages=footer_canvas)
    sys.stdout.buffer.write(f"PDF erfolgreich erstellt: {output_path}\n".encode("utf-8"))


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("FEHLER: Usage: python export_kalender_pdf.py <input.json> <output.pdf>\n")
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
