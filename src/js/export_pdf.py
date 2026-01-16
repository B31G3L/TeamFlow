#!/usr/bin/env python3
"""
PDF Export für Teamplanner
Erstellt professionelles PDF mit Mitarbeiter-Statistiken
"""

import sys
import json
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER

def format_number(value):
    """Formatiert Zahlen: Ganzzahlen ohne Nachkommastellen, Dezimalzahlen mit 2 Stellen"""
    if value is None or value == '':
        return '0'
    
    try:
        num = float(value)
        if num == int(num):
            return str(int(num))
        return f"{num:.2f}"
    except (ValueError, TypeError):
        return '0'

def create_pdf(data, jahr, output_path):
    """Erstellt PDF-Datei mit Mitarbeiter-Daten"""
    
    # Querformat A4
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=1*cm,
        rightMargin=1*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm
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
        alignment=TA_CENTER
    )
    
    title = Paragraph(f"Teamplanner - Urlaubsplaner {jahr}", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.5*cm))
    
    # Tabellendaten vorbereiten
    table_data = [[
        'Vorname', 'Nachname', 'Abteilung', 'Anspruch', 'Übertrag',
        'Verfügbar', 'Genommen', 'Rest', 'Krank', 'Schulung', 'Überstunden'
    ]]
    
    for mitarbeiter in data:
        anspruch = format_number(mitarbeiter.get('urlaub_anspruch', 0))
        uebertrag = format_number(mitarbeiter.get('urlaub_uebertrag', 0))
        genommen = format_number(mitarbeiter.get('urlaub_genommen', 0))
        
        # Berechne Verfügbar und Rest
        try:
            verfuegbar = float(anspruch) + float(uebertrag)
            rest = verfuegbar - float(genommen)
        except (ValueError, TypeError):
            verfuegbar = 0
            rest = 0
        
        row = [
            mitarbeiter.get('vorname', ''),
            mitarbeiter.get('nachname', ''),
            mitarbeiter.get('abteilung', ''),
            anspruch,
            uebertrag,
            format_number(verfuegbar),
            genommen,
            format_number(rest),
            format_number(mitarbeiter.get('krankheit', 0)),
            format_number(mitarbeiter.get('schulung', 0)),
            format_number(mitarbeiter.get('ueberstunden', 0))
        ]
        table_data.append(row)
    
    # Tabelle erstellen
    # Spaltenbreiten anpassen (Querformat A4 ist ca. 27cm nutzbar)
    col_widths = [2.2*cm, 2.2*cm, 3*cm, 1.8*cm, 1.8*cm, 1.8*cm, 1.8*cm, 1.5*cm, 1.5*cm, 1.8*cm, 2*cm]
    
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    # Tabellen-Stil
    table.setStyle(TableStyle([
        # Header-Style
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F538D')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        
        # Daten-Style
        ('ALIGN', (0, 1), (1, -1), 'LEFT'),  # Vorname, Nachname links
        ('ALIGN', (2, 1), (-1, -1), 'CENTER'),  # Rest zentriert
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        
        # Alternating row colors
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    
    elements.append(table)
    
    # PDF erstellen
    doc.build(elements)

if __name__ == "__main__":
    try:
        if len(sys.argv) != 4:
            print(json.dumps({
                "success": False,
                "error": "Usage: export_pdf.py <data_json> <jahr> <output_path>"
            }))
            sys.exit(1)
        
        data_json = sys.argv[1]
        jahr = sys.argv[2]
        output_path = sys.argv[3]
        
        data = json.loads(data_json)
        
        create_pdf(data, jahr, output_path)
        
        print(json.dumps({
            "success": True,
            "path": output_path
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)
