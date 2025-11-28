"""
Export Manager - Excel und PDF Export
"""

import pandas as pd
from datetime import datetime
from typing import Optional
import os


class ExportManager:
    """Manager für Excel und PDF Exports"""
    
    def __init__(self, data_manager):
        self.data_manager = data_manager
    
    def export_excel(self, filepath: Optional[str] = None) -> str:
        """
        Exportiert Daten nach Excel
        Returns: Pfad zur erstellten Datei
        """
        if filepath is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = f"Teamplanner_Export_{timestamp}.xlsx"
        
        # Excel Writer erstellen
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            
            # === Sheet 1: Übersicht ===
            self._export_uebersicht(writer)
            
            # === Sheet 2: Mitarbeiter Details ===
            self._export_mitarbeiter_details(writer)
            
            # === Sheet 3: Alle Einträge ===
            self._export_eintraege(writer)
            
            # === Sheet 4: Statistiken ===
            self._export_statistiken(writer)
        
        return filepath
    
    def _export_uebersicht(self, writer):
        """Übersicht-Sheet"""
        alle_stats = self.data_manager.get_alle_statistiken()
        
        data = []
        for stat in alle_stats:
            data.append({
                'Mitarbeiter': stat.mitarbeiter.name,
                'Abteilung': stat.mitarbeiter.abteilung,
                'Urlaubstage Jahr': stat.mitarbeiter.urlaubstage_jahr,
                'Übertrag': stat.uebertrag_vorjahr,
                'Genommen': stat.urlaub_genommen,
                'Verbleibend': stat.verbleibende_urlaubstage,
                'Krankheitstage': stat.krankheitstage,
                'Schulungstage': stat.schulungstage,
                'Überstunden': stat.ueberstunden,
                'Status': stat.status
            })
        
        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='Übersicht', index=False)
        
        # Spaltenbreite anpassen
        worksheet = writer.sheets['Übersicht']
        for idx, col in enumerate(df.columns):
            max_length = max(df[col].astype(str).apply(len).max(), len(col)) + 2
            worksheet.column_dimensions[chr(65 + idx)].width = max_length
    
    def _export_mitarbeiter_details(self, writer):
        """Mitarbeiter Details Sheet"""
        mitarbeiter = []
        for ma_id, daten in self.data_manager.stammdaten.items():
            mitarbeiter.append({
                'ID': ma_id,
                'Vorname': daten['vorname'],
                'Nachname': daten['nachname'],
                'Geburtsdatum': daten.get('geburtsdatum', ''),
                'Einstellungsdatum': daten.get('einstellungsdatum', ''),
                'Abteilung': daten.get('abteilung', ''),
                'Urlaubstage/Jahr': daten.get('urlaubstage_jahr', 30)
            })
        
        df = pd.DataFrame(mitarbeiter)
        df.to_excel(writer, sheet_name='Mitarbeiter', index=False)
        
        worksheet = writer.sheets['Mitarbeiter']
        for idx, col in enumerate(df.columns):
            max_length = max(df[col].astype(str).apply(len).max(), len(col)) + 2
            worksheet.column_dimensions[chr(65 + idx)].width = max_length
    
    def _export_eintraege(self, writer):
        """Alle Einträge Sheet"""
        eintraege = self.data_manager.db.get_eintraege(
            jahr=self.data_manager.aktuelles_jahr
        )
        
        data = []
        for eintrag in eintraege:
            ma_daten = self.data_manager.stammdaten.get(eintrag['mitarbeiter_id'], {})
            name = f"{ma_daten.get('vorname', '')} {ma_daten.get('nachname', '')}"
            
            data.append({
                'Datum': eintrag['datum'],
                'Mitarbeiter': name,
                'Typ': eintrag['typ'].capitalize(),
                'Wert': eintrag['wert'],
                'Titel': eintrag.get('titel', ''),
                'Beschreibung': eintrag.get('beschreibung', ''),
                'Erfasst am': eintrag.get('erfasst_am', '')
            })
        
        df = pd.DataFrame(data)
        df = df.sort_values('Datum', ascending=False)
        df.to_excel(writer, sheet_name='Einträge', index=False)
        
        worksheet = writer.sheets['Einträge']
        for idx, col in enumerate(df.columns):
            max_length = max(df[col].astype(str).apply(len).max(), len(col)) + 2
            worksheet.column_dimensions[chr(65 + idx)].width = min(max_length, 50)
    
    def _export_statistiken(self, writer):
        """Statistiken Sheet"""
        team_stats = self.data_manager.get_team_statistiken()
        
        data = {
            'Statistik': [
                'Anzahl Mitarbeiter',
                'Gesamt Urlaubstage genommen',
                'Gesamt Krankheitstage',
                'Gesamt Schulungstage',
                'Gesamt Überstunden'
            ],
            'Wert': [
                team_stats['mitarbeiter_anzahl'],
                f"{team_stats['gesamt_urlaub']:.1f}",
                f"{team_stats['gesamt_krank']:.1f}",
                f"{team_stats['gesamt_schulung']:.1f}",
                f"{team_stats['gesamt_ueberstunden']:.1f}h"
            ]
        }
        
        df = pd.DataFrame(data)
        df.to_excel(writer, sheet_name='Statistiken', index=False)
        
        worksheet = writer.sheets['Statistiken']
        worksheet.column_dimensions['A'].width = 30
        worksheet.column_dimensions['B'].width = 20
    
    def export_pdf(self, filepath: Optional[str] = None) -> str:
        """
        Exportiert Daten als PDF
        Returns: Pfad zur erstellten Datei
        """
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import cm
        except ImportError:
            raise ImportError("reportlab nicht installiert. Bitte installieren: pip install reportlab")
        
        if filepath is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = f"Teamplanner_Report_{timestamp}.pdf"
        
        # PDF erstellen
        doc = SimpleDocTemplate(
            filepath,
            pagesize=landscape(A4),
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Titel
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1f538d'),
            spaceAfter=30,
            alignment=1  # Center
        )
        
        elements.append(Paragraph(
            f"Teamplanner Report - {self.data_manager.aktuelles_jahr}",
            title_style
        ))
        elements.append(Spacer(1, 0.5*cm))
        
        # === Team Statistiken ===
        elements.append(Paragraph("Team Statistiken", styles['Heading2']))
        elements.append(Spacer(1, 0.3*cm))
        
        team_stats = self.data_manager.get_team_statistiken()
        stats_data = [
            ['Statistik', 'Wert'],
            ['Anzahl Mitarbeiter', str(team_stats['mitarbeiter_anzahl'])],
            ['Gesamt Urlaubstage', f"{team_stats['gesamt_urlaub']:.1f}"],
            ['Gesamt Krankheitstage', f"{team_stats['gesamt_krank']:.1f}"],
            ['Gesamt Schulungstage', f"{team_stats['gesamt_schulung']:.1f}"],
            ['Gesamt Überstunden', f"{team_stats['gesamt_ueberstunden']:.1f}h"]
        ]
        
        stats_table = Table(stats_data, colWidths=[8*cm, 4*cm])
        stats_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        elements.append(stats_table)
        elements.append(PageBreak())
        
        # === Mitarbeiter Übersicht ===
        elements.append(Paragraph("Mitarbeiter Übersicht", styles['Heading2']))
        elements.append(Spacer(1, 0.3*cm))
        
        alle_stats = self.data_manager.get_alle_statistiken()
        
        ma_data = [['Name', 'Abt.', 'Jahr', 'Genommen', 'Verbleibend', 'Krank', 'Schulung', 'Ü-Std']]
        
        for stat in alle_stats:
            ma_data.append([
                stat.mitarbeiter.name[:20],
                stat.mitarbeiter.abteilung[:10],
                str(stat.mitarbeiter.urlaubstage_jahr),
                f"{stat.urlaub_genommen:.0f}",
                f"{stat.verbleibende_urlaubstage:.0f}",
                f"{stat.krankheitstage:.0f}",
                f"{stat.schulungstage:.0f}",
                f"{stat.ueberstunden:.0f}h"
            ])
        
        ma_table = Table(ma_data, colWidths=[6*cm, 3*cm, 2*cm, 2.5*cm, 2.5*cm, 2*cm, 2.5*cm, 2.5*cm])
        ma_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#27ae60')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        
        elements.append(ma_table)
        
        # Datum
        elements.append(Spacer(1, 1*cm))
        elements.append(Paragraph(
            f"Erstellt am: {datetime.now().strftime('%d.%m.%Y %H:%M')}",
            styles['Normal']
        ))
        
        # PDF generieren
        doc.build(elements)
        
        return filepath


def zeige_export_dialog(parent, data_manager):
    """Zeigt Export-Dialog"""
    import customtkinter as ctk
    import tkinter.messagebox as messagebox
    from tkinter import filedialog
    from gui.notification_manager import NotificationManager
    import os

    dialog = ctk.CTkToplevel(parent)
    dialog.title("Export")
    dialog.geometry("400x250")
    dialog.resizable(False, False)
    
    dialog.transient(parent)
    dialog.grab_set()

    # Notification Manager für diesen Dialog
    notification_manager = NotificationManager(dialog)

    # Zentrieren
    dialog.update_idletasks()
    width = dialog.winfo_width()
    height = dialog.winfo_height()
    x = (dialog.winfo_screenwidth() // 2) - (width // 2)
    y = (dialog.winfo_screenheight() // 2) - (height // 2)
    dialog.geometry(f'{width}x{height}+{x}+{y}')
    
    # Header
    header = ctk.CTkFrame(dialog, fg_color="#1f538d", height=60)
    header.pack(fill="x")
    header.pack_propagate(False)
    
    ctk.CTkLabel(
        header,
        text="Daten exportieren",
        font=ctk.CTkFont(size=18, weight="bold"),
        text_color="white"
    ).pack(pady=15)
    
    # Content
    content = ctk.CTkFrame(dialog, fg_color="transparent")
    content.pack(fill="both", expand=True, padx=30, pady=20)
    
    export_manager = ExportManager(data_manager)
    
    def export_excel_action():
        try:
            filepath = filedialog.asksaveasfilename(
                defaultextension=".xlsx",
                filetypes=[("Excel Dateien", "*.xlsx")],
                initialfile=f"Teamplanner_{data_manager.aktuelles_jahr}.xlsx"
            )
            
            if filepath:
                result = export_manager.export_excel(filepath)
                notification_manager.show(
                    f"Excel-Export erfolgreich!\n\nDatei: {os.path.basename(result)}",
                    typ=notification_manager.SUCCESS,
                    title="Erfolg",
                    duration=5000
                )
                dialog.destroy()
        except Exception as e:
            messagebox.showerror(
                "Fehler",
                f"Excel-Export fehlgeschlagen:\n{e}",
                parent=dialog
            )
    
    def export_pdf_action():
        try:
            filepath = filedialog.asksaveasfilename(
                defaultextension=".pdf",
                filetypes=[("PDF Dateien", "*.pdf")],
                initialfile=f"Teamplanner_Report_{data_manager.aktuelles_jahr}.pdf"
            )
            
            if filepath:
                result = export_manager.export_pdf(filepath)
                notification_manager.show(
                    f"PDF-Export erfolgreich!\n\nDatei: {os.path.basename(result)}",
                    typ=notification_manager.SUCCESS,
                    title="Erfolg",
                    duration=5000
                )
                dialog.destroy()
        except ImportError:
            messagebox.showerror(
                "Fehler",
                "reportlab ist nicht installiert!\n\n"
                "Bitte installieren:\npip install reportlab",
                parent=dialog
            )
        except Exception as e:
            messagebox.showerror(
                "Fehler",
                f"PDF-Export fehlgeschlagen:\n{e}",
                parent=dialog
            )
    
    # Buttons
    ctk.CTkButton(
        content,
        text="Excel Export (.xlsx)",
        command=export_excel_action,
        height=50,
        font=ctk.CTkFont(size=14),
        fg_color="#27ae60",
        hover_color="#229954"
    ).pack(fill="x", pady=(0, 15))
    
    ctk.CTkButton(
        content,
        text="PDF Report (.pdf)",
        command=export_pdf_action,
        height=50,
        font=ctk.CTkFont(size=14),
        fg_color="#e74c3c",
        hover_color="#c0392b"
    ).pack(fill="x", pady=(0, 15))
    
    ctk.CTkButton(
        content,
        text="Abbrechen",
        command=dialog.destroy,
        height=40,
        fg_color="gray",
        hover_color="#555555"
    ).pack(fill="x")