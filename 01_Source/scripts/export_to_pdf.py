#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF-Export fuer TeamFlow
Neue Struktur: Zusammenfassung + Detailtabelle
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
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
except ImportError:
    print("FEHLER: reportlab nicht installiert!", file=sys.stderr)
    print("Installiere mit: pip install reportlab", file=sys.stderr)
    sys.exit(1)


# ── Farben ───────────────────────────────────────────────────────────────────
C_PRIMARY   = colors.HexColor("#1F538D")
C_ABT       = colors.HexColor("#2D5FA8")
C_URLAUB    = colors.HexColor("#D6F0D6")
C_KRANKHEIT = colors.HexColor("#FAD4D4")
C_SCHULUNG  = colors.HexColor("#D4EEF7")
C_UEBERSTD  = colors.HexColor("#FFF3CD")
C_SUMME     = colors.HexColor("#E8E8E8")
C_WHITE     = colors.white
C_LIGHT     = colors.HexColor("#F5F5F5")
C_GREY      = colors.HexColor("#CCCCCC")
C_TEXT      = colors.HexColor("#1A1A1A")

TYP_FARBEN = {
    "urlaub":       C_URLAUB,
    "krankheit":    C_KRANKHEIT,
    "schulung":     C_SCHULUNG,
    "ueberstunden": C_UEBERSTD,
}

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
        "Titel",
        parent=base["Normal"],
        fontSize=18,
        textColor=C_PRIMARY,
        fontName="Helvetica-Bold",
        spaceAfter=4,
        alignment=TA_CENTER,
    )
    untertitel = ParagraphStyle(
        "Untertitel",
        parent=base["Normal"],
        fontSize=10,
        textColor=colors.grey,
        fontName="Helvetica",
        spaceAfter=16,
        alignment=TA_CENTER,
    )
    abschnitt = ParagraphStyle(
        "Abschnitt",
        parent=base["Normal"],
        fontSize=12,
        textColor=C_PRIMARY,
        fontName="Helvetica-Bold",
        spaceBefore=12,
        spaceAfter=6,
    )
    klein = ParagraphStyle(
        "Klein",
        parent=base["Normal"],
        fontSize=8,
        textColor=colors.grey,
        fontName="Helvetica",
        alignment=TA_RIGHT,
    )
    return titel, untertitel, abschnitt, klein


# ── Seitennummer ─────────────────────────────────────────────────────────────
def footer_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawRightString(
        doc.pagesize[0] - 1.5*cm,
        1.0*cm,
        f"Seite {doc.page}"
    )
    canvas.drawString(
        1.5*cm,
        1.0*cm,
        f"TeamFlow Export – {datetime.now().strftime('%d.%m.%Y %H:%M')}"
    )
    canvas.restoreState()


# ── Zusammenfassungs-Tabelle ──────────────────────────────────────────────────
def baue_zusammenfassung(mitarbeiter_liste, von_datum, bis_datum):
    elements = []

    # Kopf-Tabelle mit Zeitraum
    info_data = [[
        f"Zeitraum:  {fmt_datum(von_datum)} – {fmt_datum(bis_datum)}",
        f"Mitarbeiter:  {len(mitarbeiter_liste)}",
        f"Erstellt:  {datetime.now().strftime('%d.%m.%Y')}",
    ]]
    info_table = Table(info_data, colWidths=[8*cm, 5*cm, 6*cm])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), C_LIGHT),
        ("FONTNAME",   (0,0), (-1,-1), "Helvetica"),
        ("FONTSIZE",   (0,0), (-1,-1), 9),
        ("TEXTCOLOR",  (0,0), (-1,-1), C_TEXT),
        ("ALIGN",      (0,0), (-1,-1), "LEFT"),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("GRID",       (0,0), (-1,-1), 0.5, C_GREY),
        ("ROUNDEDCORNERS", [4]),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.5*cm))

    # Tabellen-Header
    headers = ["Mitarbeiter", "Abteilung", "Urlaub\n(T)", "Krank\n(T)", "Schulung\n(T)", "UE-Abbau\n(h)", "Eintr."]
    col_widths = [5.5*cm, 4*cm, 2.2*cm, 2.2*cm, 2.5*cm, 2.5*cm, 1.8*cm]

    table_data = [headers]
    style_cmds = [
        # Header
        ("BACKGROUND",    (0,0), (-1,0), C_PRIMARY),
        ("TEXTCOLOR",     (0,0), (-1,0), C_WHITE),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 9),
        ("ALIGN",         (0,0), (-1,0), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING",    (0,0), (-1,0), 7),
        ("BOTTOMPADDING", (0,0), (-1,0), 7),
        # Daten
        ("FONTNAME",  (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",  (0,1), (-1,-1), 8),
        ("ALIGN",     (2,1), (-1,-1), "CENTER"),
        ("ALIGN",     (0,1), (1,-1), "LEFT"),
        ("TOPPADDING",    (0,1), (-1,-1), 4),
        ("BOTTOMPADDING", (0,1), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ("GRID",      (0,0), (-1,-1), 0.4, C_GREY),
    ]

    aktuelle_abteilung = None
    data_row = 1

    for eintrag in mitarbeiter_liste:
        ma  = eintrag.get("mitarbeiter", {})
        zus = eintrag.get("zusammenfassung", {})
        abt = ma.get("abteilung", "")

        # Abteilungs-Trennzeile
        if abt != aktuelle_abteilung:
            aktuelle_abteilung = abt
            table_data.append([abt, "", "", "", "", "", ""])
            style_cmds += [
                ("BACKGROUND", (0, data_row), (-1, data_row), C_ABT),
                ("TEXTCOLOR",  (0, data_row), (-1, data_row), C_WHITE),
                ("FONTNAME",   (0, data_row), (-1, data_row), "Helvetica-Bold"),
                ("FONTSIZE",   (0, data_row), (-1, data_row), 9),
                ("SPAN",       (0, data_row), (-1, data_row)),
            ]
            data_row += 1

        anzahl = len(eintrag.get("eintraege", []))
        zeile = [
            ma.get("name", ""),
            abt,
            fmt_zahl(zus.get("urlaub_tage", 0)),
            fmt_zahl(zus.get("krankheit_tage", 0)),
            fmt_zahl(zus.get("schulung_tage", 0)),
            fmt_zahl(zus.get("ueberstunden_abbau", 0)),
            anzahl,
        ]
        table_data.append(zeile)

        # Abwechselnde Zeilenfarbe
        if data_row % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, data_row), (-1, data_row), C_LIGHT))

        data_row += 1

    # Summenzeile
    table_data.append([
        "GESAMT", "",
        sum(fmt_zahl(e.get("zusammenfassung", {}).get("urlaub_tage", 0))        for e in mitarbeiter_liste),
        sum(fmt_zahl(e.get("zusammenfassung", {}).get("krankheit_tage", 0))     for e in mitarbeiter_liste),
        sum(fmt_zahl(e.get("zusammenfassung", {}).get("schulung_tage", 0))      for e in mitarbeiter_liste),
        sum(fmt_zahl(e.get("zusammenfassung", {}).get("ueberstunden_abbau", 0)) for e in mitarbeiter_liste),
        sum(len(e.get("eintraege", []))                                          for e in mitarbeiter_liste),
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


# ── Detail-Tabelle ────────────────────────────────────────────────────────────
def baue_detail(mitarbeiter_liste, von_datum, bis_datum):
    elements = []
    elements.append(Spacer(1, 0.5*cm))

    headers = ["Mitarbeiter", "Abteilung", "Typ", "Von", "Bis", "Wert", "Notiz / Titel"]
    col_widths = [4.5*cm, 3.5*cm, 2.8*cm, 2.5*cm, 2.5*cm, 2*cm, 0]  # letzte Spalte füllt Rest

    # Gesamtbreite berechnen (Querformat A4 = 29.7cm - 3cm Rand = 26.7cm)
    seite_b = landscape(A4)[0] - 3*cm
    feste_b = sum(col_widths[:-1])
    col_widths[-1] = seite_b - feste_b

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
        ("ALIGN",         (3,1), (5,-1), "CENTER"),
        ("ALIGN",         (0,1), (2,-1), "LEFT"),
        ("TOPPADDING",    (0,1), (-1,-1), 3),
        ("BOTTOMPADDING", (0,1), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 5),
        ("GRID",          (0,0), (-1,-1), 0.4, C_GREY),
    ]

    aktuelle_abteilung = None
    data_row = 1

    for eintrag in mitarbeiter_liste:
        ma       = eintrag.get("mitarbeiter", {})
        eintraege = eintrag.get("eintraege", [])
        abt      = ma.get("abteilung", "")
        name     = ma.get("name", "")

        if not eintraege:
            continue

        # Abteilungs-Trennzeile
        if abt != aktuelle_abteilung:
            aktuelle_abteilung = abt
            table_data.append([abt, "", "", "", "", "", ""])
            style_cmds += [
                ("BACKGROUND", (0, data_row), (-1, data_row), C_ABT),
                ("TEXTCOLOR",  (0, data_row), (-1, data_row), C_WHITE),
                ("FONTNAME",   (0, data_row), (-1, data_row), "Helvetica-Bold"),
                ("FONTSIZE",   (0, data_row), (-1, data_row), 9),
                ("SPAN",       (0, data_row), (-1, data_row)),
            ]
            data_row += 1

        for e in eintraege:
            typ   = e.get("typ", "")
            farbe = TYP_FARBEN.get(typ, C_WHITE)
            label = TYP_LABEL.get(typ, typ)

            wert     = fmt_zahl(e.get("wert", 0))
            einheit  = "h" if typ == "ueberstunden" else "T"
            wert_str = f"{wert} {einheit}"
            notiz    = e.get("notiz") or e.get("titel") or ""

            zeile = [name, abt, label, fmt_datum(e.get("von_datum")), fmt_datum(e.get("bis_datum")), wert_str, notiz]
            table_data.append(zeile)

            # Typ-Farbe auf Spalten 3-6
            style_cmds.append(("BACKGROUND", (2, data_row), (5, data_row), farbe))

            data_row += 1

    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle(style_cmds))
    elements.append(table)

    return elements


# ── Legende ───────────────────────────────────────────────────────────────────
def baue_legende():
    elements = [Spacer(1, 0.6*cm)]
    legende_data = [
        ["Farbe", "Bedeutung"],
        ["", "Urlaub (Tage)"],
        ["", "Krankheit (Tage)"],
        ["", "Schulung (Tage)"],
        ["", "Ueberstunden-Abbau (Stunden)"],
    ]
    farben = [C_PRIMARY, C_URLAUB, C_KRANKHEIT, C_SCHULUNG, C_UEBERSTD]

    t = Table(legende_data, colWidths=[1.5*cm, 6*cm])
    style_cmds = [
        ("BACKGROUND", (0,0), (-1,0), C_PRIMARY),
        ("TEXTCOLOR",  (0,0), (-1,0), C_WHITE),
        ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",   (0,0), (-1,-1), 8),
        ("GRID",       (0,0), (-1,-1), 0.4, C_GREY),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]
    for i, farbe in enumerate(farben[1:], 1):
        style_cmds.append(("BACKGROUND", (0, i), (0, i), farbe))

    t.setStyle(TableStyle(style_cmds))
    elements.append(t)
    return elements


# ── Haupt ─────────────────────────────────────────────────────────────────────
def create_pdf(payload, output_path):
    export_data       = payload.get("exportData", payload)
    mitarbeiter_liste = export_data.get("mitarbeiter", [])
    von_datum         = export_data.get("vonDatum", "")
    bis_datum         = export_data.get("bisDatum", "")

    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        topMargin=1.5*cm,
        bottomMargin=2*cm,
        leftMargin=1.5*cm,
        rightMargin=1.5*cm,
    )

    s_titel, s_untertitel, s_abschnitt, s_klein = get_styles()

    elements = []

    # ── Seite 1: Zusammenfassung ──
    elements.append(Paragraph("Abwesenheits-Uebersicht", s_titel))
    elements.append(Paragraph(
        f"{fmt_datum(von_datum)} – {fmt_datum(bis_datum)}",
        s_untertitel
    ))
    elements.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceAfter=10))
    elements.append(Paragraph("Zusammenfassung", s_abschnitt))
    elements.extend(baue_zusammenfassung(mitarbeiter_liste, von_datum, bis_datum))

    # ── Seite 2: Details ──
    elements.append(PageBreak())
    elements.append(Paragraph("Abwesenheits-Uebersicht", s_titel))
    elements.append(Paragraph(
        f"{fmt_datum(von_datum)} – {fmt_datum(bis_datum)}",
        s_untertitel
    ))
    elements.append(HRFlowable(width="100%", thickness=1, color=C_PRIMARY, spaceAfter=10))
    elements.append(Paragraph("Details", s_abschnitt))
    elements.extend(baue_detail(mitarbeiter_liste, von_datum, bis_datum))

    # ── Legende ──
    elements.extend(baue_legende())

    doc.build(elements, onFirstPage=footer_canvas, onLaterPages=footer_canvas)
    sys.stdout.buffer.write(f"PDF erfolgreich erstellt: {output_path}\n".encode("utf-8"))


def main():
    if len(sys.argv) != 3:
        sys.stderr.write("FEHLER: Usage: python export_to_pdf.py <input.json> <output.pdf>\n")
        sys.exit(1)

    input_file  = sys.argv[1]
    output_file = sys.argv[2]

    try:
        with io.open(input_file, "r", encoding="utf-8-sig") as f:
            payload = json.load(f)
        mitarbeiter_liste = payload.get("exportData", payload).get("mitarbeiter", payload)
        anzahl = len(mitarbeiter_liste) if isinstance(mitarbeiter_liste, list) else "?"
        sys.stdout.buffer.write(f"JSON gelesen: {anzahl} Mitarbeiter\n".encode("utf-8"))
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