#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Stammdaten-Export fuer TeamFlow
Erstellt eine formatierte PDF mit den Stammdaten eines Mitarbeiters
"""

import sys
import json
import io
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
    print("Installiere mit: pip install reportlab", file=sys.stderr)
    sys.exit(1)


# ── Farben ────────────────────────────────────────────────────────────────────
C_PRIMARY  = colors.HexColor("#1F538D")
C_LIGHT    = colors.HexColor("#F0F4FA")
C_GREY     = colors.HexColor("#CCCCCC")
C_DARK     = colors.HexColor("#1A1A1A")
C_MUTED    = colors.HexColor("#666666")
C_WHITE    = colors.white
C_SECTION  = colors.HexColor("#E8EEF7")


def fmt_datum(d):
    """YYYY-MM-DD -> DD.MM.YYYY"""
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


def fmt_waehrung(v):
    if v is None or v == "":
        return "–"
    try:
        f = float(v)
        return f"{f:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "–"


def footer_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(C_MUTED)
    canvas.drawRightString(
        doc.pagesize[0] - 2*cm,
        1.2*cm,
        f"Seite {doc.page}"
    )
    canvas.drawString(
        2*cm,
        1.2*cm,
        f"TeamFlow – Stammdaten-Export – {datetime.now().strftime('%d.%m.%Y %H:%M')}"
    )
    # Linie
    canvas.setStrokeColor(C_GREY)
    canvas.setLineWidth(0.5)
    canvas.line(2*cm, 1.6*cm, doc.pagesize[0] - 2*cm, 1.6*cm)
    canvas.restoreState()


def abschnitt_header(text, styles):
    """Erstellt einen farbigen Abschnitts-Header"""
    style = ParagraphStyle(
        "AbschnittHeader",
        parent=styles["Normal"],
        fontSize=10,
        fontName="Helvetica-Bold",
        textColor=C_PRIMARY,
        spaceBefore=14,
        spaceAfter=4,
    )
    return Paragraph(text.upper(), style)


def info_zeile(label, wert, col_widths=(5*cm, 10*cm)):
    """Erstellt eine Label/Wert-Zeile als kleine Tabelle"""
    data = [[label, wert if wert else "–"]]
    t = Table(data, colWidths=list(col_widths))
    t.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (0, 0), "Helvetica-Bold"),
        ("FONTNAME",      (1, 0), (1, 0), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 10),
        ("TEXTCOLOR",     (0, 0), (0, 0), C_MUTED),
        ("TEXTCOLOR",     (1, 0), (1, 0), C_DARK),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
    ]))
    return t


def create_stammdaten_pdf(data, output_path):
    emp = data.get("employee", {})

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

    # ── Kopfzeile ─────────────────────────────────────────────────────────────
    header_data = [[
        Paragraph(
            f"<font size='18' color='#1F538D'><b>{emp.get('name', '–')}</b></font>",
            styles["Normal"]
        ),
        Paragraph(
            f"<font size='10' color='#666666'>{emp.get('department', '–')}</font>",
            ParagraphStyle("R", parent=styles["Normal"], alignment=TA_RIGHT)
        ),
    ]]
    header_table = Table(header_data, colWidths=[11*cm, 6*cm])
    header_table.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=2, color=C_PRIMARY, spaceAfter=4))

    erstellt_style = ParagraphStyle(
        "Erstellt", parent=styles["Normal"],
        fontSize=8, textColor=C_MUTED, alignment=TA_RIGHT, spaceAfter=16
    )
    elements.append(Paragraph(
        f"Erstellt am {datetime.now().strftime('%d.%m.%Y um %H:%M Uhr')}",
        erstellt_style
    ))

    col_w = (5*cm, 10*cm)

    # ── Persönliche Daten ─────────────────────────────────────────────────────
    elements.append(abschnitt_header("Persönliche Daten", styles))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=C_GREY, spaceAfter=6))

    pers_felder = [
        ("Vorname",      emp.get("vorname")),
        ("Nachname",     emp.get("nachname")),
        ("Geburtsdatum", fmt_datum(emp.get("geburtsdatum"))),
        ("E-Mail",       emp.get("email")),
    ]
    for label, wert in pers_felder:
        if wert and wert != "–":
            elements.append(info_zeile(label, str(wert), col_w))

    elements.append(Spacer(1, 0.3*cm))

    # ── Adresse ───────────────────────────────────────────────────────────────
    adresse = emp.get("adresse")
    if adresse and adresse.strip():
        elements.append(abschnitt_header("Adresse", styles))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=C_GREY, spaceAfter=6))

        # Adresse zeilenweise ausgeben
        zeilen = [z.strip() for z in adresse.split("\n") if z.strip()]
        for zeile in zeilen:
            elements.append(info_zeile("", zeile, (0.5*cm, 14.5*cm)))

        elements.append(Spacer(1, 0.3*cm))

    # ── Arbeitsbeziehung ──────────────────────────────────────────────────────
    elements.append(abschnitt_header("Arbeitsbeziehung", styles))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=C_GREY, spaceAfter=6))

    arb_felder = [
        ("Abteilung",       emp.get("department")),
        ("Eintrittsdatum",  fmt_datum(emp.get("eintrittsdatum"))),
        ("Austrittsdatum",  fmt_datum(emp.get("austrittsdatum")) if emp.get("austrittsdatum") else None),
        ("Status",          emp.get("status")),
        ("Urlaubstage/Jahr", fmt_zahl(emp.get("urlaubstage_jahr"), " Tage")),
    ]
    for label, wert in arb_felder:
        if wert and wert != "–":
            elements.append(info_zeile(label, str(wert), col_w))

    elements.append(Spacer(1, 0.3*cm))

    # ── Arbeitszeit ───────────────────────────────────────────────────────────
    elements.append(abschnitt_header("Arbeitszeit", styles))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=C_GREY, spaceAfter=6))

    elements.append(info_zeile("Wochenstunden", fmt_zahl(emp.get("wochenstunden"), "h"), col_w))

    # Arbeitszeitmodell wenn vorhanden
    modell = emp.get("arbeitszeitmodell")
    if modell:
        wochentage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
        labels_map = {"VOLL": "Ganztag", "HALB": "Halbtag", "FREI": "Frei"}

        modell_zeilen = []
        for tag in modell:
            wt_idx = tag.get("wochentag", 0)
            wt_name = wochentage[wt_idx] if wt_idx < 7 else str(wt_idx)
            az = labels_map.get(tag.get("arbeitszeit", "VOLL"), tag.get("arbeitszeit", ""))
            modell_zeilen.append(f"{wt_name}: {az}")

        if modell_zeilen:
            modell_text = "  |  ".join(modell_zeilen)
            elements.append(info_zeile("Wochenplan", modell_text, col_w))

    elements.append(Spacer(1, 0.3*cm))

    # ── Gehalt (nur wenn vorhanden) ───────────────────────────────────────────
    gehalt = emp.get("gehalt")
    if gehalt:
        elements.append(abschnitt_header("Gehalt", styles))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=C_GREY, spaceAfter=6))
        elements.append(info_zeile("Bruttogehalt/Monat", fmt_waehrung(gehalt), col_w))
        elements.append(Spacer(1, 0.3*cm))

    # ── PDF bauen ─────────────────────────────────────────────────────────────
    doc.build(elements, onFirstPage=footer_canvas, onLaterPages=footer_canvas)
    sys.stdout.buffer.write(f"PDF erfolgreich erstellt: {output_path}\n".encode("utf-8"))


def main():
    if len(sys.argv) != 3:
        sys.stderr.buffer.write(
            b"FEHLER: Usage: python export_employee_detail.py <input.json> <output.pdf>\n"
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
        create_stammdaten_pdf(data, output_file)
    except Exception as e:
        sys.stderr.buffer.write(f"FEHLER beim Erstellen der PDF: {e}\n".encode("utf-8"))
        sys.exit(1)


if __name__ == "__main__":
    main()