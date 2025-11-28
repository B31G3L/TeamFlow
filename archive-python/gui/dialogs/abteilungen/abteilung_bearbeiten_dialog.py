"""
Dialog zum Bearbeiten von Abteilungen
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from tkinter import colorchooser
from models.entities import Abteilung


class AbteilungBearbeitenDialog(ctk.CTkToplevel):
    """Dialog zum Bearbeiten von Abteilungen"""

    def __init__(self, parent, abteilung: Abteilung, data_manager):
        super().__init__(parent)
        self.data_manager = data_manager
        self.abteilung = abteilung
        self.result = None

        self.title(f"Abteilung bearbeiten: {abteilung.name}")
        self.geometry("500x450")
        self.resizable(True, True)
        self.transient(parent)
        self.grab_set()

        # Aktuelle Farbe
        self.farbe_hex = abteilung.farbe_hex

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
            text="Abteilung bearbeiten",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Scrollbarer Bereich
        main_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=30, pady=15)

        def lbl(text):
            ctk.CTkLabel(main_frame, text=text, font=ctk.CTkFont(size=12, weight="bold")).pack(anchor="w", pady=(0, 4))

        # Name
        lbl("Name der Abteilung:")
        self.name_entry = ctk.CTkEntry(main_frame, placeholder_text="z.B. Geschäftsleitung", height=32)
        self.name_entry.insert(0, self.abteilung.name)
        self.name_entry.pack(fill="x", pady=(0, 10))

        # Farbe
        lbl("Farbe:")
        farbe_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        farbe_frame.pack(fill="x", pady=(0, 10))

        self.farbe_preview = ctk.CTkFrame(
            farbe_frame,
            fg_color=self.farbe_hex,
            width=80,
            height=32,
            corner_radius=4
        )
        self.farbe_preview.pack(side="left", padx=(0, 10))
        self.farbe_preview.pack_propagate(False)

        ctk.CTkButton(
            farbe_frame,
            text="Farbe wählen",
            command=self.farbe_waehlen,
            height=32,
            width=150
        ).pack(side="left", padx=(0, 10))

        self.farbe_label = ctk.CTkLabel(
            farbe_frame,
            text=self.farbe_hex,
            font=ctk.CTkFont(size=11)
        )
        self.farbe_label.pack(side="left")

        # Vordefinierte Farben
        lbl("Oder wählen Sie eine vordefinierte Farbe:")
        farben_frame = ctk.CTkFrame(main_frame, fg_color="transparent")
        farben_frame.pack(fill="x", pady=(0, 10))

        vordefinierte_farben = [
            ("#e74c3c", "Rot"),
            ("#3498db", "Blau"),
            ("#9b59b6", "Lila"),
            ("#e67e22", "Orange"),
            ("#27ae60", "Grün"),
            ("#95a5a6", "Grau"),
            ("#f39c12", "Gelb"),
            ("#1abc9c", "Türkis"),
        ]

        for i, (farbe, name) in enumerate(vordefinierte_farben):
            btn = ctk.CTkButton(
                farben_frame,
                text="",
                fg_color=farbe,
                width=40,
                height=32,
                corner_radius=4,
                hover_color=farbe,
                command=lambda f=farbe: self.setze_farbe(f)
            )
            btn.grid(row=i // 4, column=i % 4, padx=4, pady=4)

        # Sortierung
        lbl("Sortierung (niedrigere Zahlen erscheinen zuerst):")
        self.sortierung_entry = ctk.CTkEntry(main_frame, placeholder_text="z.B. 10", height=32)
        self.sortierung_entry.insert(0, str(self.abteilung.sortierung))
        self.sortierung_entry.pack(fill="x", pady=(0, 10))

        # Info über Mitarbeiter
        mitarbeiter_count = self.data_manager.db.abteilungen.count_mitarbeiter(self.abteilung.id)
        info_frame = ctk.CTkFrame(main_frame, fg_color="#2b2b2b", corner_radius=8)
        info_frame.pack(fill="x", pady=(10, 0))

        ctk.CTkLabel(
            info_frame,
            text="ℹ️ Information",
            font=ctk.CTkFont(size=11, weight="bold"),
            anchor="w"
        ).pack(anchor="w", padx=10, pady=(8, 2))

        ctk.CTkLabel(
            info_frame,
            text=f"Diese Abteilung hat aktuell {mitarbeiter_count} aktive(n) Mitarbeiter.",
            font=ctk.CTkFont(size=10),
            anchor="w",
            justify="left"
        ).pack(anchor="w", padx=10, pady=(0, 8))

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
    # Farb-Funktionen
    # -----------------------------------------------------
    def farbe_waehlen(self):
        """Öffnet Farb-Auswahl-Dialog"""
        farbe = colorchooser.askcolor(
            initialcolor=self.farbe_hex,
            title="Farbe wählen",
            parent=self
        )

        if farbe and farbe[1]:
            self.setze_farbe(farbe[1])

    def setze_farbe(self, hex_farbe: str):
        """Setzt die gewählte Farbe"""
        self.farbe_hex = hex_farbe
        self.farbe_preview.configure(fg_color=hex_farbe)
        self.farbe_label.configure(text=hex_farbe)

    # -----------------------------------------------------
    # Größe / Zentrierung
    # -----------------------------------------------------
    def _resize_to_content(self):
        """Passt Fenstergröße automatisch an Inhalt an"""
        self.update_idletasks()
        width = max(self.winfo_reqwidth(), 500)
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
        """Speichert Abteilung"""
        # Name validieren
        name = self.name_entry.get().strip()
        if not name or len(name) < 2:
            messagebox.showerror(
                "Ungültige Eingabe",
                "Bitte geben Sie einen Namen mit mindestens 2 Zeichen ein.",
                parent=self
            )
            return

        # Prüfe ob Name bereits existiert (außer bei sich selbst)
        if name.lower() != self.abteilung.name.lower():
            existierende_abteilung = self.data_manager.db.abteilungen.get_by_name(name)
            if existierende_abteilung:
                messagebox.showerror(
                    "Name bereits vergeben",
                    f"Eine Abteilung mit dem Namen '{name}' existiert bereits.\nBitte wählen Sie einen anderen Namen.",
                    parent=self
                )
                return

        # Sortierung validieren
        try:
            sortierung = int(self.sortierung_entry.get().strip())
            if sortierung < 0:
                raise ValueError("Sortierung muss positiv sein")
        except ValueError:
            messagebox.showerror(
                "Ungültige Sortierung",
                "Bitte geben Sie eine gültige Zahl für die Sortierung ein (0 oder größer).",
                parent=self
            )
            return

        # Farbe validieren (Format: #RRGGBB)
        if not self._validate_hex_color(self.farbe_hex):
            messagebox.showerror(
                "Ungültige Farbe",
                "Die gewählte Farbe ist ungültig. Bitte wählen Sie eine andere Farbe.",
                parent=self
            )
            return

        # Result setzen
        self.result = {
            'name': name,
            'farbe_hex': self.farbe_hex,
            'sortierung': sortierung
        }

        self.destroy()

    def _validate_hex_color(self, hex_color: str) -> bool:
        """Validiert Hex-Farbcode"""
        if not hex_color or not hex_color.startswith('#'):
            return False
        if len(hex_color) != 7:
            return False
        try:
            int(hex_color[1:], 16)
            return True
        except ValueError:
            return False

    def abbrechen(self):
        """Bricht ab"""
        self.result = None
        self.destroy()
