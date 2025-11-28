"""
Dialog zum Hinzufügen neuer Feiertage
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from datetime import date, datetime
from gui.components.date_input import DateInput


class FeiertagHinzufuegenDialog(ctk.CTkToplevel):
    """Dialog zum Hinzufügen neuer Feiertage"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)
        self.data_manager = data_manager
        self.result = None

        self.title("Neuen Feiertag hinzufügen")
        self.geometry("500x500")
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
            text="🎉 Neuer Feiertag",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Scrollbarer Bereich
        main_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=30, pady=15)

        def lbl(text):
            ctk.CTkLabel(main_frame, text=text, font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=(0, 4))

        # Name
        lbl("Name des Feiertags:")
        self.name_entry = ctk.CTkEntry(main_frame, placeholder_text="z.B. Neujahr", height=32)
        self.name_entry.pack(fill="x", pady=(0, 10))

        # Datum
        lbl("Datum:")
        self.datum_input = DateInput(
            main_frame,
            initial_date=date.today(),
            label="",
            show_today_button=True
        )
        self.datum_input.pack(fill="x", pady=(0, 10))

        # Bundesland
        lbl("Bundesland (optional):")
        self.bundesland_var = ctk.StringVar(value="Bundesweit")

        bundeslaender = [
            "Bundesweit",
            "Baden-Württemberg",
            "Bayern",
            "Berlin",
            "Brandenburg",
            "Bremen",
            "Hamburg",
            "Hessen",
            "Mecklenburg-Vorpommern",
            "Niedersachsen",
            "Nordrhein-Westfalen",
            "Rheinland-Pfalz",
            "Saarland",
            "Sachsen",
            "Sachsen-Anhalt",
            "Schleswig-Holstein",
            "Thüringen"
        ]

        self.bundesland_menu = ctk.CTkOptionMenu(
            main_frame,
            variable=self.bundesland_var,
            values=bundeslaender,
            height=32
        )
        self.bundesland_menu.pack(fill="x", pady=(0, 10))

        # Aktiv
        lbl("Status:")
        self.aktiv_var = ctk.BooleanVar(value=True)
        self.aktiv_checkbox = ctk.CTkCheckBox(
            main_frame,
            text="Feiertag ist aktiv",
            variable=self.aktiv_var,
            font=ctk.CTkFont(size=12)
        )
        self.aktiv_checkbox.pack(anchor="w", pady=(0, 15))

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
        self.minsize(500, 450)
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
        """Speichert Feiertag"""
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
        datum = self.datum_input.get_date()

        if not datum:
            messagebox.showerror(
                "Ungültiges Datum",
                "Bitte geben Sie ein gültiges Datum ein.",
                parent=self
            )
            return

        # Bundesland
        bundesland_str = self.bundesland_var.get()
        bundesland = None if bundesland_str == "Bundesweit" else bundesland_str

        # Aktiv
        aktiv = self.aktiv_var.get()

        # Result setzen
        self.result = {
            'datum': datum,
            'name': name,
            'bundesland': bundesland,
            'aktiv': aktiv
        }

        self.destroy()

    def abbrechen(self):
        """Bricht ab"""
        self.result = None
        self.destroy()
