"""
Dialog zum Hinzufügen neuer Mitarbeiter - Mit DateInput Component
✅ Verwendet DateInput für Datumsfelder
✅ Konsistente Eingabe
✅ FIX: Lädt ALLE Abteilungen aus DB
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from datetime import date, datetime
from gui.components.date_input import DateInput


class StammdatenHinzufuegenDialog(ctk.CTkToplevel):
    """Dialog zum Hinzufügen neuer Mitarbeiter (mit DateInput Component)"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)
        self.data_manager = data_manager
        self.result = None

        self.title("Neuen Mitarbeiter hinzufügen")
        self.geometry("500x650")  # ✅ Feste Höhe für bessere Sichtbarkeit
        self.resizable(True, True)
        self.transient(parent)
        self.grab_set()

        self._setup_gui()
        self.update_idletasks()
        self._resize_to_content()
        self._center_window()
        self.after(50, lambda: self.vorname_entry.focus_set())

    # -----------------------------------------------------
    # UI-Aufbau
    # -----------------------------------------------------
    def _setup_gui(self):
        # Kompakter Header
        header = ctk.CTkFrame(self, fg_color="#1f538d", height=40, corner_radius=0)
        header.pack(fill="x", pady=0)
        header.pack_propagate(False)

        ctk.CTkLabel(
            header,
            text="👤 Neuer Mitarbeiter",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Scrollbarer Bereich
        main_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=30, pady=15)

        def lbl(text):
            ctk.CTkLabel(main_frame, text=text, font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=(0, 4))

        # Vorname
        lbl("Vorname:")
        self.vorname_entry = ctk.CTkEntry(main_frame, placeholder_text="Max", height=32)
        self.vorname_entry.pack(fill="x", pady=(0, 10))

        # Nachname
        lbl("Nachname:")
        self.nachname_entry = ctk.CTkEntry(main_frame, placeholder_text="Mustermann", height=32)
        self.nachname_entry.pack(fill="x", pady=(0, 10))

        # ✅ GEBURTSDATUM - DateInput Component
        lbl("Geburtsdatum:")
        self.geburtsdatum_input = DateInput(
            main_frame,
            initial_date=None,
            label="",  # Kein Label, da schon oben
            show_today_button=False
        )
        self.geburtsdatum_input.pack(fill="x", pady=(0, 10))

        # ✅ EINSTELLUNGSDATUM - DateInput Component
        lbl("Einstellungsdatum:")
        self.einstellungsdatum_input = DateInput(
            main_frame,
            initial_date=date.today(),
            label="",  # Kein Label, da schon oben
            show_today_button=True
        )
        self.einstellungsdatum_input.pack(fill="x", pady=(0, 10))

        # ✅ FIX: Abteilung - Hole ALLE Abteilungen aus DB
        lbl("Abteilung:")
        try:
            # Hole ALLE Abteilungen aus der Datenbank
            abteilungen_objs = self.data_manager.db.abteilungen.get_all()
            abteilungen_liste = [abt.name for abt in abteilungen_objs]

            if not abteilungen_liste:
                raise ValueError("Keine Abteilungen in DB")

        except Exception as e:
            print(f"⚠️ Fehler beim Laden der Abteilungen: {e}")
            # Fallback
            abteilungen_liste = ["Werkstatt", "Verkauf", "Service", "Buchhaltung", "Geschäftsleitung"]

        self.abteilung_entry = ctk.CTkComboBox(
            main_frame,
            values=abteilungen_liste,
            height=32
        )
        self.abteilung_entry.set(abteilungen_liste[0])  # Erste Abteilung als Default
        self.abteilung_entry.pack(fill="x", pady=(0, 10))

        # ✅ FIX: Urlaubstage - Mit anteiliger Berechnung
        lbl("Urlaubstage pro Jahr:")
        self.urlaubstage_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        self.urlaubstage_frame.pack(fill="x", pady=(0, 10))

        self.urlaubstage_entry = ctk.CTkEntry(
            self.urlaubstage_frame,
            placeholder_text="30",
            height=32
        )
        self.urlaubstage_entry.pack(side="left", fill="x", expand=True, padx=(0, 8))

        # ✅ NEU: Berechnen-Button
        self.berechnen_btn = ctk.CTkButton(
            self.urlaubstage_frame,
            text="Anteilig berechnen",
            command=self._berechne_urlaubstage,
            height=32,
            width=150
        )
        self.berechnen_btn.pack(side="left")

        # ✅ NEU: Initiale Berechnung
        self._berechne_urlaubstage()

        # Button-Leiste
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill="x", padx=30, pady=(0, 15))

        ctk.CTkButton(
            btn_frame, text="Abbrechen", command=self.abbrechen,
            fg_color="gray", hover_color="#555555", height=36
        ).pack(side="left", fill="x", expand=True, padx=(0, 8))

        ctk.CTkButton(
            btn_frame, text="Speichern", command=self.speichern,
            height=36
        ).pack(side="right", fill="x", expand=True, padx=(8, 0))

        self.bind("<Return>", lambda e: self.speichern())
        self.bind("<Escape>", lambda e: self.abbrechen())

    # -----------------------------------------------------
    # Größe / Zentrierung
    # -----------------------------------------------------
    def _resize_to_content(self):
        """Passt Fenstergröße automatisch an Inhalt an"""
        self.update_idletasks()
        width = max(self.winfo_reqwidth(), 440)
        height = min(self.winfo_reqheight() + 10, int(self.winfo_screenheight() * 0.9))
        self.minsize(500, 620)  # ✅ Höhere Mindesthöhe
        self.geometry(f"{width}x{height}")

    def _center_window(self):
        """Zentriert Fenster"""
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    # -----------------------------------------------------
    # Logik
    # -----------------------------------------------------
    def _berechne_urlaubstage(self):
        """✅ NEU: Berechnet anteilige Urlaubstage basierend auf Einstellungsdatum"""
        try:
            einstellungsdatum = self.einstellungsdatum_input.get_date()
            if not einstellungsdatum:
                # Kein Datum gesetzt -> volle 30 Tage
                self.urlaubstage_entry.delete(0, "end")
                self.urlaubstage_entry.insert(0, "30")
                return

            heute = date.today()
            aktuelles_jahr = self.data_manager.aktuelles_jahr

            # Wenn Einstellungsdatum vor dem aktuellen Jahr liegt -> volle 30 Tage
            if einstellungsdatum.year < aktuelles_jahr:
                self.urlaubstage_entry.delete(0, "end")
                self.urlaubstage_entry.insert(0, "30")
                return

            # Wenn Einstellungsdatum nach dem aktuellen Jahr liegt -> 0 Tage
            if einstellungsdatum.year > aktuelles_jahr:
                self.urlaubstage_entry.delete(0, "end")
                self.urlaubstage_entry.insert(0, "0")
                return

            # Einstellung im aktuellen Jahr -> anteilige Berechnung
            # Formel: 30 Tage / 12 Monate * verbleibende Monate (inkl. aktuellen Monat)
            eintrittsmonat = einstellungsdatum.month
            verbleibende_monate = 12 - eintrittsmonat + 1

            import math
            anteilige_tage = (30.0 / 12.0) * verbleibende_monate
            anteilige_tage_gerundet = math.ceil(anteilige_tage)

            self.urlaubstage_entry.delete(0, "end")
            self.urlaubstage_entry.insert(0, str(anteilige_tage_gerundet))

        except Exception as e:
            # Bei Fehler -> Default 30 Tage
            print(f"⚠️ Fehler bei Urlaubstage-Berechnung: {e}")
            self.urlaubstage_entry.delete(0, "end")
            self.urlaubstage_entry.insert(0, "30")

    def speichern(self):
        vorname = self.vorname_entry.get().strip()
        nachname = self.nachname_entry.get().strip()
        urlaubstage = self.urlaubstage_entry.get().strip()

        if not vorname or not nachname:
            messagebox.showerror("Fehler", "Bitte Vor- und Nachname eingeben!", parent=self)
            return

        try:
            urlaubstage = int(urlaubstage)
        except ValueError:
            messagebox.showerror("Fehler", "Urlaubstage müssen eine Zahl sein!", parent=self)
            return

        if not (0 <= urlaubstage <= 50):
            messagebox.showerror("Fehler", "Urlaubstage müssen zwischen 0 und 50 liegen!", parent=self)
            return

        # ✅ Datumsfelder mit DateInput holen
        try:
            geburtsdatum = self.geburtsdatum_input.get_date()
            einstellungsdatum = self.einstellungsdatum_input.get_date()
            
            if not einstellungsdatum:
                einstellungsdatum = date.today()
            
        except ValueError as e:
            messagebox.showerror("Fehler", str(e), parent=self)
            return

        self.result = {
            "id": f"{vorname.lower()}_{nachname.lower()}",
            "vorname": vorname,
            "nachname": nachname,
            "geburtsdatum": geburtsdatum.strftime("%Y-%m-%d") if geburtsdatum else None,
            "einstellungsdatum": einstellungsdatum.strftime("%Y-%m-%d"),
            "abteilung": self.abteilung_entry.get(),
            "urlaubstage_jahr": urlaubstage,
        }
        self.destroy()

    def abbrechen(self):
        self.result = None
        self.destroy()