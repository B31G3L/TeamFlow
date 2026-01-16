#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF-Export für Teamplanner
Erstellt eine formatierte PDF-Datei aus Urlaubsdaten
"""

import sys
import json
from datetime import datetime
from pathlib import Path

try:
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
except ImportError:
    print("FEHLER: reportlab nicht installiert!", file=sys.stderr)
    print("Installiere mit: pip install reportlab", file=sys.stderr)
    sys.exit(1)


def create_pdf(data, output_path):
    """Erstellt PDF-Datei mit formatierten Urlaubsdaten"""
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        topMargin=1.5*cm,
        bottomMargin=1.5*cm,
        leftMargin=1.5*cm,
        rightMargin=1.5*cm
    )
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Titel
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1F538D'),
        spaceAfter=20,
        alignment=1  # Center
    )
    
    title = Paragraph("Urlaubsübersicht", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.5*cm))
    
    # Tabelle erstellen
    table_data = [["Mitarbeiter", "Abteilung", "Von", "Bis", "Tage", "Notiz"]]
    
    for entry in data:
        table_data.append([
            entry.get('mitarbeiter', ''),
            entry.get('abteilung', ''),
            entry.get('von', ''),
            entry.get('bis', ''),
            str(entry.get('tage', 0)),
            entry.get('notiz', '')[:50]  # Kürzen für PDF
        ])
    
    table = Table(table_data, colWidths=[5*cm, 4*cm, 3*cm, 3*cm, 2*cm, 7*cm])
    
    # Tabellen-Style
    table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F538D')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        
        # Daten
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
    ]))
    
    elements.append(table)
    
    # PDF erstellen
    doc.build(elements)
    print(f"✅ PDF erfolgreich erstellt: {output_path}")


def main():
    if len(sys.argv) != 3:
        print("FEHLER: Falsche Anzahl Parameter!", file=sys.stderr)
        print("Usage: python export_to_pdf.py <input.json> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # JSON lesen
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"📄 JSON gelesen: {len(data)} Einträge")
    except Exception as e:
        print(f"FEHLER beim Lesen der JSON: {e}", file=sys.stderr)
        sys.exit(1)
    
    # PDF erstellen
    try:
        create_pdf(data, output_file)
    except Exception as e:
        print(f"FEHLER beim Erstellen der PDF: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()