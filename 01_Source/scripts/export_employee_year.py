#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Jahres-Export fuer TeamFlow
Erstellt eine formatierte PDF mit allen Eintraegen eines Mitarbeiters fuer ein Jahr
"""

import sys
import json
from datetime import datetime

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle,
        Paragraph, Spacer, HRFlowable
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
except ImportError:
    print("FEHLER: reportlab nicht installiert!", file=sys.stderr)
    sys.exit(1)


# ── Farben ────────────────────────────────────────────────────────────────────
C_PRIMARY   = colors.HexColor("#1F538D")
C_GREY      = colors.HexColor("#CCCCCC")
C_DARK      = colors.HexColor("#1A1A1A")
C_MUTED     = colors.HexColor("#666666")
C_WHITE     = colors.white
C_LIGHT     = colors.HexColor("#F5F5F5")

C_URLAUB    = colors.HexColor("#D6F0D6")
C_KRANKHEIT = colors.HexColor("#FAD4D4")
C_SCHULUNG  = colors.HexColor("#D4EEF7")
C_UEBERSTD  = colors.HexColor("#FFF3CD")

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
    "ueberstunden": "Ueberstunden",
}


def fmt_datum(d):
    if not d:
        return "–"
    try:
        return datetime.strptime(d[:10], "%Y-%m-%d").strftime("%d.%m.%Y")
    except Exception:
        return d


def fmt_zahl(v, einheit=""):
    if v is None:
        return "–"
    try:
        f = float(v)
        zahl = int(f) if f == int(f) else round(f, 2)
        return f"{zahl}{einheit}"
    except Exception:
        return "–"


def footer_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(C_MUTED)
    canvas.drawRightString(
        doc.pagesize[0] - 2*cm, 1.2*cm,
        f"Seite {doc.page}"
    )
    canvas.drawString(
        2*cm, 1.2*cm,
        f"TeamFlow – Jahresuebersicht – {datetime.now().strftime('%d.%m.%Y %H:%M')}"
    )
    canvas.setStrokeColor(C_GREY)
    canvas.setLineWidth(0.5)
    canvas.line(2*cm, 1.6*cm, doc.pagesize[0] - 2*cm, 1.6*cm)
    canvas.restoreState()


def create_year_pdf(data, output_path):
    emp      = data.get("employee", {})
    jahr     = data.get("jahr", "")
    stats    = data.get("stats", {})
    eintraege = data.get("eintraege", [])

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        topMargin=2*cm,
        bottomMargin=2.5*cm,
        leftMargin=2*cm,
        rightMargin=2*cm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # ── Header ────────────────────────────────────────────────────────────────
    header_style = ParagraphStyle(
        "Header", parent=styles["Normal"],
        fontSize=18, fontName="Helvetica-Bold",
        textColor=C_PRIMARY
    )
    sub_style = ParagraphStyle(
        "Sub", parent=styles["Normal"],
        fontSize=11, fontName="Helvetica",
        textColor=C_MUTED, spaceAfter=4
    )
    erstellt_style = ParagraphStyle(
        "Erstellt", parent=styles["Normal"],
        fontSize=8, textColor=C_MUTED,
        alignment=TA_RIGHT, spaceAfter=12
    )

    header_data = [[
        Paragraph(f"<font size='18' color='#1F538D'><b>{emp.get('name', '–')}</b></font>", styles["Normal"]),
        Paragraph(
            f"<font size='10' color='#666666'>{emp.get('department', '–')}</font>",
            ParagraphStyle("R", parent=styles["Normal"], alignment=TA_RIGHT)
        ),
    ]]
    header_table = Table(header_data, colWidths=[11*cm, 6*cm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "BOTTOM"),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=2, color=C_PRIMARY, spaceAfter=4))
    elements.append(Paragraph(
        f"Jahresuebersicht {jahr}  |  Erstellt am {datetime.now().strftime('%d.%m.%Y um %H:%M Uhr')}",
        erstellt_style
    ))

    # ── Urlaubs-Statistik ─────────────────────────────────────────────────────
    abschnitt_style = ParagraphStyle(
        "Abschnitt", parent=styles["Normal"],
        fontSize=10, fontName="Helvetica-Bold",
        textColor=C_PRIMARY, spaceBefore=10, spaceAfter=4,
    )

    elements.append(Paragraph("URLAUBSSTATISTIK", abschnitt_style))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=C_GREY, spaceAfter=6))

    stat_daten = [
        ["Jahresanspruch",        fmt_zahl(stats.get("urlaubsanspruch"), " Tage")],
        [f"Uebertrag aus {int(jahr)-1}",  fmt_zahl(stats.get("uebertrag_vorjahr"), " Tage")],
        ["Verfuegbar gesamt",     fmt_zahl(stats.get("urlaub_verfuegbar"), " Tage")],
        ["Genommen",              fmt_zahl(stats.get("urlaub_genommen"), " Tage")],
        ["Resturlaub",            fmt_zahl(stats.get("urlaub_rest"), " Tage")],
    ]

    stat_table = Table(stat_daten, colWidths=[6*cm, 4*cm])
    stat_table.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME",      (1,0), (1,-1), "Helvetica"),
        ("FONTSIZE",      (0,0), (-1,-1), 9),
        ("TEXTCOLOR",     (0,0), (0,-1), C_MUTED),
        ("TEXTCOLOR",     (1,0), (1,-1), C_DARK),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING",   (0,0), (-1,-1), 0),
        # Resturlaub-Zeile hervorheben
        ("FONTNAME",      (0,4), (-1,4), "Helvetica-Bold"),
        ("FONTSIZE",      (0,4), (-1,4), 10),
        ("LINEABOVE",     (0,4), (-1,4), 0.5, C_GREY),
    ]))
    elements.append(stat_table)
    elements.append(Spacer(1, 0.5*cm))

    # ── Abwesenheits-Uebersicht ────────────────────────────────────────────────
    krankheitstage  = stats.get("krankheitstage", 0)
    schulungstage   = stats.get("schulungstage", 0)
    ueberstunden    = stats.get("ueberstunden", 0)

    if any([krankheitstage, schulungstage, ueberstunden]):
        elements.append(Paragraph("WEITERE ABWESENHEITEN", abschnitt_style))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=C_GREY, spaceAfter=6))

        weitere = []
        if krankheitstage:
            weitere.append(["Krankheit", fmt_zahl(krankheitstage, " Tage")])
        if schulungstage:
            weitere.append(["Schulung", fmt_zahl(schulungstage, " Tage")])
        if ueberstunden is not None:
            vorzeichen = "+" if float(ueberstunden or 0) >= 0 else ""
            weitere.append(["Ueberstunden-Saldo", f"{vorzeichen}{fmt_zahl(ueberstunden, 'h')}"])

        if weitere:
            w_table = Table(weitere, colWidths=[6*cm, 4*cm])
            w_table.setStyle(TableStyle([
                ("FONTNAME",      (0,0), (0,-1), "Helvetica-Bold"),
                ("FONTNAME",      (1,0), (1,-1), "Helvetica"),
                ("FONTSIZE",      (0,0), (-1,-1), 9),
                ("TEXTCOLOR",     (0,0), (0,-1), C_MUTED),
                ("TEXTCOLOR",     (1,0), (1,-1), C_DARK),
                ("TOPPADDING",    (0,0), (-1,-1), 3),
                ("BOTTOMPADDING", (0,0), (-1,-1), 3),
                ("LEFTPADDING",   (0,0), (-1,-1), 0),
            ]))
            elements.append(w_table)
            elements.append(Spacer(1, 0.5*cm))

    # ── Einzeleintraege ───────────────────────────────────────────────────────
    elements.append(Paragraph("EINTRAEGE", abschnitt_style))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=C_GREY, spaceAfter=6))

    if not eintraege:
        elements.append(Paragraph(
            "Keine Eintraege fuer dieses Jahr vorhanden.",
            ParagraphStyle("Leer", parent=styles["Normal"], fontSize=9, textColor=C_MUTED)
        ))
    else:
        # Tabellen-Header
        tbl_header = ["Typ", "Von", "Bis", "Wert", "Notiz / Titel"]
        tbl_data   = [tbl_header]

        style_cmds = [
            ("BACKGROUND",    (0,0), (-1,0), C_PRIMARY),
            ("TEXTCOLOR",     (0,0), (-1,0), C_WHITE),
            ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,0), 9),
            ("ALIGN",         (0,0), (-1,0), "CENTER"),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING",    (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING",   (0,0), (-1,-1), 5),
            ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
            ("FONTSIZE",      (0,1), (-1,-1), 8),
            ("ALIGN",         (1,1), (3,-1), "CENTER"),
            ("GRID",          (0,0), (-1,-1), 0.4, C_GREY),
        ]

        for i, e in enumerate(eintraege, 1):
            typ   = e.get("typ", "")
            farbe = TYP_FARBEN.get(typ, C_WHITE)
            label = TYP_LABEL.get(typ, typ)

            # Von/Bis
            von_str = fmt_datum(e.get("von_datum") or e.get("datum"))
            bis_str = fmt_datum(e.get("bis_datum") or e.get("datum"))

            # Wert
            wert = e.get("wert", 0)
            if typ == "ueberstunden":
                vorzeichen = "+" if float(wert or 0) >= 0 else ""
                wert_str = f"{vorzeichen}{fmt_zahl(wert, 'h')}"
            else:
                wert_str = fmt_zahl(wert, " T")

            notiz = e.get("notiz") or e.get("titel") or ""

            tbl_data.append([label, von_str, bis_str, wert_str, notiz])

            # Typ-Farbe auf alle Spalten
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), farbe))

            # Abwechselnde Zeilen leicht aufhellen
            if i % 2 == 0:
                style_cmds.append(("BACKGROUND", (0, i), (-1, i),
                    colors.Color(farbe.red * 0.95, farbe.green * 0.95, farbe.blue * 0.95)))

        col_w = [3*cm, 2.8*cm, 2.8*cm, 2.4*cm, 0]
        seite_b = A4[0] - 4*cm
        col_w[-1] = seite_b - sum(col_w[:-1])

        tbl = Table(tbl_data, colWidths=col_w, repeatRows=1)
        tbl.setStyle(TableStyle(style_cmds))
        elements.append(tbl)

    # ── Legende ───────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 0.6*cm))
    legende_daten = [
        ["", "Urlaub"],
        ["", "Krankheit"],
        ["", "Schulung"],
        ["", "Ueberstunden"],
    ]
    legende_farben = [C_URLAUB, C_KRANKHEIT, C_SCHULUNG, C_UEBERSTD]

    leg_table = Table(legende_daten, colWidths=[1*cm, 5*cm])
    leg_cmds = [
        ("FONTSIZE",      (0,0), (-1,-1), 7),
        ("TEXTCOLOR",     (1,0), (1,-1), C_MUTED),
        ("TOPPADDING",    (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ("GRID",          (0,0), (-1,-1), 0.3, C_GREY),
    ]
    for i, farbe in enumerate(legende_farben):
        leg_cmds.append(("BACKGROUND", (0,i), (0,i), farbe))
    leg_table.setStyle(TableStyle(leg_cmds))
    elements.append(leg_table)

    # ── Bauen ──────────────────────────────────────────────────────────────────
    doc.build(elements, onFirstPage=footer_canvas, onLaterPages=footer_canvas)
    sys.stdout.buffer.write(f"PDF erfolgreich erstellt: {output_path}\n".encode("utf-8"))


def main():
    if len(sys.argv) != 3:
        sys.stderr.buffer.write(
            b"FEHLER: Usage: python export_employee_year.py <input.json> <output.pdf>\n"
        )
        sys.exit(1)

    input_file  = sys.argv[1]
    output_file = sys.argv[2]

    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        sys.stdout.buffer.write(b"JSON gelesen\n")
    except Exception as e:
        sys.stderr.buffer.write(f"FEHLER beim Lesen der JSON: {e}\n".encode("utf-8"))
        sys.exit(1)

    try:
        create_year_pdf(data, output_file)
    except Exception as e:
        sys.stderr.buffer.write(f"FEHLER beim Erstellen der PDF: {e}\n".encode("utf-8"))
        sys.exit(1)


if __name__ == "__main__":
    main()
