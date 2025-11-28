"""
Dialog zum Hinzufügen neuer Veranstaltungen
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from datetime import date, datetime
from gui.components.date_input import DateInput


class VeranstaltungHinzufuegenDialog(ctk.CTkToplevel):
    """Dialog zum Hinzufügen neuer Veranstaltungen"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)
        self.data_manager = data_manager
        self.result = None

        self.title("Neue Veranstaltung hinzufügen")
        self.geometry("500x600")
        self.resizable(True, True)
        self.transient(parent)
        self.grab_set()

        self._setup_gui()
        self.update_idletasks()
        self._resize_to_content()
        self._center_window()
        self.after(50, lambda: self.name_entry.focus_set())

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
            text="📅 Neue Veranstaltung",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Scrollbarer Bereich
        main_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=30, pady=15)

        def lbl(text):
            ctk.CTkLabel(main_frame, text=text, font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=(0, 4))

        # Name
        lbl("Name der Veranstaltung:")
        self.name_entry = ctk.CTkEntry(main_frame, placeholder_text="z.B. Sommerfest 2025", height=32)
        self.name_entry.pack(fill="x", pady=(0, 10))

        # Von-Datum
        lbl("Von (Startdatum):")
        self.von_datum_input = DateInput(
            main_frame,
            initial_date=date.today(),
            label="",
            show_today_button=True
        )
        self.von_datum_input.pack(fill="x", pady=(0, 10))

        # Bis-Datum
        lbl("Bis (Enddatum):")
        self.bis_datum_input = DateInput(
            main_frame,
            initial_date=date.today(),
            label="",
            show_today_button=True
        )
        self.bis_datum_input.pack(fill="x", pady=(0, 10))

        # Ort
        lbl("Ort (optional):")
        self.ort_entry = ctk.CTkEntry(main_frame, placeholder_text="z.B. Firmengelände", height=32)
        self.ort_entry.pack(fill="x", pady=(0, 10))

        # Beschreibung
        lbl("Beschreibung (optional):")
        self.beschreibung_text = ctk.CTkTextbox(main_frame, height=100)
        self.beschreibung_text.pack(fill="x", pady=(0, 10))

        # Max Teilnehmer
        lbl("Max. Teilnehmerzahl (optional):")
        self.max_teilnehmer_entry = ctk.CTkEntry(main_frame, placeholder_text="z.B. 50", height=32)
        self.max_teilnehmer_entry.pack(fill="x", pady=(0, 15))

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
        self.minsize(500, 550)
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
    def speichern(self):
        """Speichert Veranstaltung"""
        # Name validieren
        name = self.name_entry.get().strip()
        if not name or len(name) < 3:
            messagebox.showerror(
                "Ungültige Eingabe",
                "Bitte geben Sie einen Namen mit mindestens 3 Zeichen ein.",
                parent=self
            )
            return

        # Datum validieren
        von_datum = self.von_datum_input.get_date()
        bis_datum = self.bis_datum_input.get_date()

        if not von_datum or not bis_datum:
            messagebox.showerror(
                "Ungültige Daten",
                "Bitte geben Sie gültige Daten für Von und Bis ein.",
                parent=self
            )
            return

        if von_datum > bis_datum:
            messagebox.showerror(
                "Ungültige Daten",
                "Das Enddatum muss nach dem Startdatum liegen.",
                parent=self
            )
            return

        # Optionale Felder
        ort = self.ort_entry.get().strip() or None
        beschreibung = self.beschreibung_text.get("1.0", "end-1c").strip() or None

        # Max Teilnehmer validieren
        max_teilnehmer = None
        max_teilnehmer_str = self.max_teilnehmer_entry.get().strip()
        if max_teilnehmer_str:
            try:
                max_teilnehmer = int(max_teilnehmer_str)
                if max_teilnehmer <= 0:
                    raise ValueError()
            except ValueError:
                messagebox.showerror(
                    "Ungültige Eingabe",
                    "Bitte geben Sie eine gültige Teilnehmerzahl ein (positive Zahl).",
                    parent=self
                )
                return

        # Result setzen
        self.result = {
            'name': name,
            'von_datum': von_datum,
            'bis_datum': bis_datum,
            'ort': ort,
            'beschreibung': beschreibung,
            'max_teilnehmer': max_teilnehmer
        }

        self.destroy()

    def abbrechen(self):
        """Bricht ab"""
        self.result = None
        self.destroy()
