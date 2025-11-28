"""
Dialog zum Bearbeiten von Mitarbeitern - Mit DateInput Component
✅ Verwendet DateInput für Datumsfelder
✅ Konsistente Eingabe
✅ FIX: Lädt ALLE Abteilungen aus DB
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from typing import Dict
from datetime import date, datetime
from gui.components.date_input import DateInput


class MitarbeiterBearbeitenDialog(ctk.CTkToplevel):
    """Dialog zum Bearbeiten von Mitarbeitern (mit DateInput Component)"""

    def __init__(self, parent, ma_id: str, daten: Dict, data_manager):
        super().__init__(parent)

        self.ma_id = ma_id
        self.daten = daten.copy()
        self.data_manager = data_manager
        self.result = None

        # Fenster-Konfiguration
        self.title("Mitarbeiter bearbeiten")
        self.resizable(True, True)

        # Modal machen
        self.transient(parent)
        self.grab_set()

        self._setup_gui()

        # Layout finalisieren
        self.update_idletasks()
        self._resize_to_content()
        self._center_window()

        # Fokus auf erstes Feld
        self.after(50, lambda: self.vorname_entry.focus_set())

    # --------------------------
    # UI
    # --------------------------
    def _setup_gui(self):
        # Kompakter Header
        header = ctk.CTkFrame(self, fg_color="#1f538d", height=40, corner_radius=0)
        header.pack(fill="x")
        header.pack_propagate(False)

        ctk.CTkLabel(
            header,
            text="✏️ Mitarbeiter bearbeiten",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Scrollbarer Hauptbereich
        main = ctk.CTkScrollableFrame(self, fg_color="transparent")
        main.pack(fill="both", expand=True, padx=30, pady=15)

        def lbl(text: str):
            ctk.CTkLabel(main, text=text, font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=(0, 4))

        # Vorname
        lbl("Vorname:")
        self.vorname_entry = ctk.CTkEntry(main, height=32)
        self.vorname_entry.pack(fill="x", pady=(0, 10))
        self.vorname_entry.insert(0, self.daten.get("vorname", ""))

        # Nachname
        lbl("Nachname:")
        self.nachname_entry = ctk.CTkEntry(main, height=32)
        self.nachname_entry.pack(fill="x", pady=(0, 10))
        self.nachname_entry.insert(0, self.daten.get("nachname", ""))

        # ✅ GEBURTSDATUM - DateInput Component
        lbl("Geburtsdatum:")
        
        # Parse vorhandenes Datum
        initial_geburtsdatum = None
        if self.daten.get("geburtsdatum"):
            try:
                initial_geburtsdatum = datetime.strptime(
                    self.daten["geburtsdatum"], '%Y-%m-%d'
                ).date()
            except:
                pass
        
        self.geburtsdatum_input = DateInput(
            main,
            initial_date=initial_geburtsdatum,
            label="",
            show_today_button=False
        )
        self.geburtsdatum_input.pack(fill="x", pady=(0, 10))

        # ✅ EINSTELLUNGSDATUM - DateInput Component
        lbl("Einstellungsdatum:")
        
        # Parse vorhandenes Datum
        initial_einstellung = None
        einstellung = self.daten.get("einstellungsdatum", self.daten.get("eintrittsdatum"))
        if einstellung:
            try:
                initial_einstellung = datetime.strptime(einstellung, '%Y-%m-%d').date()
            except:
                pass
        
        self.einstellungsdatum_input = DateInput(
            main,
            initial_date=initial_einstellung,
            label="",
            show_today_button=True
        )
        self.einstellungsdatum_input.pack(fill="x", pady=(0, 10))

        # ✅ NEU: AUSTRITTSDATUM - DateInput Component
        lbl("Austrittsdatum (optional):")

        # Parse vorhandenes Austrittsdatum
        initial_austritt = None
        if self.daten.get("austrittsdatum"):
            try:
                initial_austritt = datetime.strptime(
                    self.daten["austrittsdatum"], '%Y-%m-%d'
                ).date()
            except:
                pass

        self.austrittsdatum_input = DateInput(
            main,
            initial_date=initial_austritt,
            label="",
            show_today_button=True
        )
        self.austrittsdatum_input.pack(fill="x", pady=(0, 10))

        # Info-Text für Austrittsdatum
        info_frame = ctk.CTkFrame(main, fg_color="#2b2b2b", corner_radius=6)
        info_frame.pack(fill="x", pady=(0, 15))
        ctk.CTkLabel(
            info_frame,
            text="ℹ️ Mitarbeiter mit Austrittsdatum werden automatisch ausgeblendet",
            font=ctk.CTkFont(size=10),
            text_color="#7f8c8d"
        ).pack(padx=10, pady=8)

        # ✅ FIX: Abteilung - Hole ALLE Abteilungen aus DB
        lbl("Abteilung:")
        try:
            # Hole ALLE Abteilungen aus der Datenbank
            abteilungen_objs = self.data_manager.db.abteilungen.get_all()
            dept_values = [abt.name for abt in abteilungen_objs]
            
            if not dept_values:
                raise ValueError("Keine Abteilungen in DB")
                
        except Exception as e:
            print(f"⚠️ Fehler beim Laden der Abteilungen: {e}")
            # Fallback
            dept_values = ["Werkstatt", "Verkauf", "Service", "Buchhaltung", "Geschäftsleitung"]

        self.abteilung_entry = ctk.CTkComboBox(main, values=dept_values, height=32)
        self.abteilung_entry.pack(fill="x", pady=(0, 10))
        self.abteilung_entry.set(self.daten.get("abteilung", dept_values[0]))

        # Urlaubstage
        lbl("Urlaubstage pro Jahr:")
        self.urlaubstage_entry = ctk.CTkEntry(main, height=32)
        self.urlaubstage_entry.pack(fill="x", pady=(0, 15))
        self.urlaubstage_entry.insert(0, str(self.daten.get("urlaubstage_jahr", 30)))

        # Buttons
        btns = ctk.CTkFrame(self, fg_color="transparent")
        btns.pack(fill="x", padx=30, pady=(0, 15))

        ctk.CTkButton(
            btns, text="Abbrechen", command=self.abbrechen,
            fg_color="gray", hover_color="#555555", height=36
        ).pack(side="left", fill="x", expand=True, padx=(0, 8))

        ctk.CTkButton(
            btns, text="Speichern", command=self.speichern, height=36
        ).pack(side="right", fill="x", expand=True, padx=(8, 0))

        # Shortcuts
        self.bind("<Return>", lambda e: self.speichern())
        self.bind("<Escape>", lambda e: self.abbrechen())

    # --------------------------
    # Größe & Position
    # --------------------------
    def _resize_to_content(self):
        self.update_idletasks()
        width = max(self.winfo_reqwidth(), 440)
        height = min(self.winfo_reqheight() + 10, int(self.winfo_screenheight() * 0.9))
        self.minsize(400, 480)
        self.geometry(f"{width}x{height}")

    def _center_window(self):
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    # --------------------------
    # Logik
    # --------------------------
    def speichern(self):
        vorname = self.vorname_entry.get().strip()
        nachname = self.nachname_entry.get().strip()
        abteilung = self.abteilung_entry.get().strip()
        urlaubstage_raw = self.urlaubstage_entry.get().strip()

        # Validierung
        if not vorname or not nachname:
            messagebox.showerror("Fehler", "Bitte Vor- und Nachname eingeben!", parent=self)
            return

        try:
            urlaubstage = int(urlaubstage_raw)
            if urlaubstage < 0 or urlaubstage > 50:
                raise ValueError()
        except ValueError:
            messagebox.showerror("Fehler", "Bitte gültige Urlaubstage eingeben (0–50)!", parent=self)
            return

        # ✅ Datumsfelder mit DateInput holen
        try:
            geburtsdatum = self.geburtsdatum_input.get_date()
            einstellungsdatum = self.einstellungsdatum_input.get_date()
            austrittsdatum = self.austrittsdatum_input.get_date()

            if not einstellungsdatum:
                einstellungsdatum = date.today()

            # ✅ Validierung: Austrittsdatum darf nicht vor Einstellungsdatum liegen
            if austrittsdatum and einstellungsdatum and austrittsdatum < einstellungsdatum:
                messagebox.showerror(
                    "Fehler",
                    "Austrittsdatum darf nicht vor dem Einstellungsdatum liegen!",
                    parent=self
                )
                return

        except ValueError as e:
            messagebox.showerror("Fehler", str(e), parent=self)
            return

        # Speichern
        self.result = {
            "vorname": vorname,
            "nachname": nachname,
            "geburtsdatum": geburtsdatum.strftime("%Y-%m-%d") if geburtsdatum else None,
            "einstellungsdatum": einstellungsdatum.strftime("%Y-%m-%d"),
            "austrittsdatum": austrittsdatum.strftime("%Y-%m-%d") if austrittsdatum else None,
            "abteilung": abteilung,
            "urlaubstage_jahr": urlaubstage,
        }
        self.destroy()

    def abbrechen(self):
        self.result = None
        self.destroy()