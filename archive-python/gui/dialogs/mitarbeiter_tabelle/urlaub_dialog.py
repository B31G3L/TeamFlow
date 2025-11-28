"""
Urlaubs-Dialog V3 - Nutzt neue Service-Layer API
✅ Automatische Werktage-Berechnung (mit Feiertagen!)
✅ Validierung über Service
✅ Kollisionsprüfung
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from datetime import date, timedelta
from typing import Optional
from gui.components.date_input import DateInput

from models.mitarbeiter import MitarbeiterStatistik
from models.data_manager_v3 import TeamplannerDataManager
from gui.components.date_picker import DatePickerFrame
from gui.notification_manager import NotificationManager


class UrlaubDialog(ctk.CTkToplevel):
    """Urlaubs-Dialog mit V3 Backend"""

    def __init__(self, parent, stat: MitarbeiterStatistik, data_manager: TeamplannerDataManager):
        super().__init__(parent)

        self.stat = stat
        self.data_manager = data_manager
        self.result = None

        # Notification Manager
        self.notification_manager = NotificationManager(self)
        
        self.title(f"Urlaub – {stat.mitarbeiter.name}")
        self.resizable(True, True)
        self.minsize(520, 600)
        
        self.transient(parent)
        self.grab_set()
        
        self._setup_gui()
        
        self.update_idletasks()
        self._resize_to_content()
        self._center_window()
        
        self.bind("<Escape>", lambda e: self.abbrechen())
        self.bind("<Return>", lambda e: self.speichern())
    
    def _resize_to_content(self):
        self.update_idletasks()
        req_w = max(self.winfo_reqwidth(), 600)
        req_h = max(self.winfo_reqheight(), 620)
        max_w = int(self.winfo_screenwidth() * 0.9)
        max_h = int(self.winfo_screenheight() * 0.9)
        self.geometry(f"{min(req_w, max_w)}x{min(req_h, max_h)}")
    
    def _center_window(self):
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")
    
    def _setup_gui(self):
        # Header
        header = ctk.CTkFrame(self, fg_color="#27ae60", height=44, corner_radius=0)
        header.pack(fill="x")
        header.pack_propagate(False)
        
        header_content = ctk.CTkFrame(header, fg_color="transparent")
        header_content.pack(fill="both", expand=True, padx=18, pady=8)
        
        ctk.CTkLabel(
            header_content,
            text="Urlaub eintragen",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(anchor="w")
        
        ctk.CTkLabel(
            header_content,
            text=self.stat.mitarbeiter.name,
            font=ctk.CTkFont(size=12),
            text_color="white"
        ).pack(anchor="w")
        
        # Content
        form_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        form_frame.pack(fill="both", expand=True, padx=24, pady=16)
        
        def lbl(text, size=12, bold=True):
            ctk.CTkLabel(
                form_frame,
                text=text,
                font=ctk.CTkFont(size=size, weight="bold" if bold else "normal")
            ).pack(anchor="w", pady=(0, 5))
        
        # Von/Bis DatePicker
        lbl("Von:")
        self.von_datum_input = DateInput(
            form_frame,
            initial_date=date.today(),
            label=""
        )
        self.von_datum_input.pack(fill="x", pady=(0, 12))
        # ✅ NEU: Callback der Bis-Datum aktualisiert
        self.von_datum_input.set_callback(self._on_von_datum_changed)

        lbl("Bis:")
        self.bis_datum_input = DateInput(
            form_frame,
            initial_date=date.today(),
            label=""
        )
        self.bis_datum_input.pack(fill="x", pady=(0, 12))
        self.bis_datum_input.set_callback(self._on_datum_changed)

       

        # Werktage-Anzeige (automatisch!)
        self.tage_label = ctk.CTkLabel(
            form_frame,
            text="Werktage: 1 (inkl. Feiertage)",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#27ae60"
        )
        self.tage_label.pack(anchor="w", pady=(0, 4))
        
        # Verbleibend-Anzeige
        self.verbleibend_label = ctk.CTkLabel(
            form_frame,
            text=f"Verfügbar: {self.stat.verbleibende_urlaubstage:.0f} Tage",
            font=ctk.CTkFont(size=11),
            text_color="#95a5a6"
        )
        self.verbleibend_label.pack(anchor="w", pady=(0, 12))
        
        # Feiertage-Info
        self.feiertage_label = ctk.CTkLabel(
            form_frame,
            text="",
            font=ctk.CTkFont(size=10),
            text_color="#e67e22",
            wraplength=500,
            justify="left"
        )
        self.feiertage_label.pack(anchor="w", pady=(0, 12))
        
        # Kollisions-Warnung
        self.kollision_label = ctk.CTkLabel(
            form_frame,
            text="",
            font=ctk.CTkFont(size=10),
            text_color="#e74c3c",
            wraplength=500,
            justify="left"
        )
        self.kollision_label.pack(anchor="w", pady=(0, 12))

        # Veranstaltungs-Info
        self.veranstaltung_label = ctk.CTkLabel(
            form_frame,
            text="",
            font=ctk.CTkFont(size=10),
            text_color="#3498db",
            wraplength=500,
            justify="left"
        )
        self.veranstaltung_label.pack(anchor="w", pady=(0, 12))
        
        # Notiz
        lbl("Notiz (optional):")
        self.notiz_entry = ctk.CTkTextbox(form_frame, height=80)
        self.notiz_entry.pack(fill="x", pady=(0, 12))
        
        # Info-Box
        info_frame = ctk.CTkFrame(form_frame, fg_color="#2b2b2b", corner_radius=8)
        info_frame.pack(fill="x", pady=(0, 12))
        
        ctk.CTkLabel(
            info_frame,
            text=f"ℹ️ Aktueller Stand: {self.stat.urlaub_genommen:.0f} Tage genommen",
            font=ctk.CTkFont(size=11),
            text_color="#3498db"
        ).pack(pady=8)
        
        # Buttons
        btn_frame = ctk.CTkFrame(self, fg_color="transparent", height=52)
        btn_frame.pack(fill="x", padx=24, pady=(0, 14))
        btn_frame.pack_propagate(False)
        
        inner = ctk.CTkFrame(btn_frame, fg_color="transparent")
        inner.pack(fill="both", expand=True)
        
        ctk.CTkButton(
            inner,
            text="Abbrechen",
            command=self.abbrechen,
            fg_color="#7f8c8d",
            hover_color="#636e72",
            height=36,
            font=ctk.CTkFont(size=13),
            corner_radius=8
        ).pack(side="left", fill="x", expand=True, padx=(0, 8))
        
        ctk.CTkButton(
            inner,
            text="Speichern",
            command=self.speichern,
            height=36,
            fg_color="#27ae60",
            hover_color="#229954",
            font=ctk.CTkFont(size=13, weight="bold"),
            corner_radius=8
        ).pack(side="right", fill="x", expand=True, padx=(8, 0))
        
        # Initial berechnen
        self._on_datum_changed()
    def _on_von_datum_changed(self):
            """Wird aufgerufen wenn Von-Datum geändert wird - setzt Bis-Datum"""
            try:
                von = self.von_datum_input.get_date()
                
                # ✅ Setze Bis-Datum auf Von-Datum (Single-Day Default)
                self.bis_datum_input.set_date(von)
                
                # Normale Berechnung
                self._on_datum_changed()
                
            except ValueError:
                # Ungültiges Datum - ignorieren
                pass
    def _on_datum_changed(self):
        """Wird aufgerufen wenn Datum geändert wird"""
        try:
            von = self.von_datum_input.get_date()  # ✅ Korrekt
            bis = self.bis_datum_input.get_date()
            
            if von > bis:
                self.tage_label.configure(
                    text="Werktage: Fehler (Von > Bis)",
                    text_color="#e74c3c"
                )
                return
            
            # ✅ NEU: Service nutzt Feiertage automatisch!
            werktage = self.data_manager.service.berechne_werktage(von, bis)
            kalendertage = (bis - von).days + 1
            
            # Feiertage im Zeitraum finden
            feiertage = self.data_manager.db.feiertage.get_all(jahr=von.year)
            feiertage_im_zeitraum = [
                f for f in feiertage
                if von <= f.datum <= bis and f.datum.weekday() < 5
            ]
            
            # Anzeige
            text = f"Werktage: {werktage}"
            if werktage != kalendertage:
                text += f" ({kalendertage} Kalendertage)"
            
            self.tage_label.configure(text=text, text_color="#27ae60")
            
            # Feiertage anzeigen
            if feiertage_im_zeitraum:
                feiertage_text = "🎉 Enthält Feiertage: " + ", ".join(
                    f.name for f in feiertage_im_zeitraum
                )
                self.feiertage_label.configure(text=feiertage_text)
            else:
                self.feiertage_label.configure(text="")
            
            # Verbleibend berechnen
            nach_buchung = self.stat.verbleibende_urlaubstage - werktage
            
            if nach_buchung < 0:
                self.verbleibend_label.configure(
                    text=f"Nach Buchung: {nach_buchung:.1f} Tage (ÜBERZOGEN!)",
                    text_color="#e74c3c"
                )
            elif nach_buchung < 5:
                self.verbleibend_label.configure(
                    text=f"Nach Buchung: {nach_buchung:.1f} Tage (Wenig verbleibend)",
                    text_color="#e67e22"
                )
            else:
                self.verbleibend_label.configure(
                    text=f"Nach Buchung: {nach_buchung:.1f} Tage",
                    text_color="#27ae60"
                )
            
            # ✅ NEU: Kollisionsprüfung über Service
            kollisionen = self.data_manager.service.pruefe_urlaubskollision(
                self.stat.mitarbeiter.id,
                von,
                bis
            )

            if kollisionen:
                kollision_text = "⚠️ Kollision mit bestehendem Urlaub:\n"
                for k in kollisionen:
                    kollision_text += f"  • {k.von_datum_input} - {k.bis_datum}\n"
                self.kollision_label.configure(text=kollision_text)
            else:
                self.kollision_label.configure(text="")

            # ✅ NEU: Prüfe auf Veranstaltungen
            veranstaltungen = self.data_manager.db.veranstaltungen.get_by_zeitraum(von, bis)

            if veranstaltungen:
                veranstaltung_text = "📅 Hinweis: Im gewählten Zeitraum finden Veranstaltungen statt:\n"
                for v in veranstaltungen:
                    if v.von_datum == v.bis_datum:
                        veranstaltung_text += f"  • {v.name} am {v.von_datum.strftime('%d.%m.%Y')}\n"
                    else:
                        veranstaltung_text += f"  • {v.name} vom {v.von_datum.strftime('%d.%m.%Y')} bis {v.bis_datum.strftime('%d.%m.%Y')}\n"
                self.veranstaltung_label.configure(text=veranstaltung_text)
            else:
                self.veranstaltung_label.configure(text="")
            
        except Exception as e:
            self.tage_label.configure(
                text=f"Werktage: Fehler ({e})",
                text_color="#e74c3c"
            )
    
    def speichern(self):
        """Speichert Urlaub über Service"""
        try:
            try:
                von = self.von_datum_input.get_date()
                bis = self.bis_datum_input.get_date()
                
                if not von or not bis:
                    messagebox.showerror("Fehler", "Bitte beide Datumsfelder ausfüllen!", parent=self)
                    return
            except ValueError as e:
                messagebox.showerror("Fehler", str(e), parent=self)
                return
            notiz = self.notiz_entry.get("1.0", "end-1c").strip()
            
            if von > bis:
                messagebox.showerror(
                    "Fehler",
                    "Von-Datum muss vor Bis-Datum liegen!",
                    parent=self
                )
                return
            
            # ✅ NEU: Service macht automatisch Werktage-Berechnung & Validierung!
            try:
                urlaub = self.data_manager.service.erstelle_urlaub(
                    mitarbeiter_id=self.stat.mitarbeiter.id,
                    von_datum=von,
                    bis_datum=bis,
                    notiz=notiz
                )
                
                self.result = True

                self.notification_manager.show(
                    f"{urlaub.tage} Werktage Urlaub gespeichert!\n"
                    f"Zeitraum: {von.strftime('%d.%m.%Y')} - {bis.strftime('%d.%m.%Y')}\n"
                    f"Verbleibend: {self.stat.verbleibende_urlaubstage - urlaub.tage:.1f} Tage",
                    typ=self.notification_manager.SUCCESS,
                    title="Erfolg",
                    duration=5000
                )

                self.destroy()
                
            except ValueError as ve:
                # Service wirft ValueError bei Validierungsfehlern
                messagebox.showerror("Fehler", str(ve), parent=self)
                
        except Exception as e:
            messagebox.showerror(
                "Fehler",
                f"Fehler beim Speichern: {e}",
                parent=self
            )
    
    def abbrechen(self):
        self.result = None
        self.destroy()