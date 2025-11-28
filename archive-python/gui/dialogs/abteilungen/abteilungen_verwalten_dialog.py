import customtkinter as ctk
import tkinter.messagebox as messagebox
from typing import Dict, List


class AbteilungenVerwaltenDialog(ctk.CTkToplevel):
    """Dialog zur Verwaltung von Abteilungen"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)

        self.data_manager = data_manager
        self.parent_window = parent

        # Fenster-Konfiguration
        self.title("Abteilungen verwalten")
        self.geometry("1100x650")
        self.resizable(True, True)
        self.minsize(900, 500)

        # Modal
        self.transient(parent)
        self.grab_set()

        # Notification-Manager für diesen Dialog initialisieren
        from gui.notification_manager import NotificationManager
        self.notification_manager = NotificationManager(self)

        self._setup_gui()
        self.lade_abteilungen()

        # Nach Layout: Größe an Inhalt anpassen & zentrieren
        self.update_idletasks()
        self._resize_to_content()
        self._center_window()

        # Re-Layout bei Größenänderung
        self.bind("<Configure>", self._on_configure)

    # --------------------------
    # Layout-Helfer
    # --------------------------
    def _resize_to_content(self):
        """Passt die Fenstergröße an den tatsächlichen Inhalt an."""
        self.update_idletasks()
        req_w = max(self.winfo_reqwidth(), 1100)
        req_h = max(self.winfo_reqheight(), 650)
        max_w = int(self.winfo_screenwidth() * 0.95)
        max_h = int(self.winfo_screenheight() * 0.9)
        width = min(req_w, max_w)
        height = min(req_h, max_h)
        self.geometry(f"{width}x{height}")

    def _center_window(self):
        """Zentriert das Fenster auf dem Bildschirm."""
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    def _on_configure(self, _evt):
        pass

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
            text="Abteilungen verwalten",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Kompakte Toolbar
        toolbar = ctk.CTkFrame(self, fg_color="transparent", height=44)
        toolbar.pack(fill="x", padx=20, pady=(12, 0))
        toolbar.pack_propagate(False)

        ctk.CTkButton(
            toolbar,
            text="+ Neue Abteilung",
            command=self.neue_abteilung,
            width=180,
            height=34,
            fg_color="#27ae60",
            hover_color="#229954"
        ).pack(side="left", padx=(0, 10))

        ctk.CTkButton(
            toolbar,
            text="Aktualisieren",
            command=self.lade_abteilungen,
            width=150,
            height=34
        ).pack(side="left", padx=(0, 10))

        self.info_label = ctk.CTkLabel(toolbar, text="", font=ctk.CTkFont(size=11))
        self.info_label.pack(side="right")

        # Scrollbare Liste
        self.scroll_frame = ctk.CTkScrollableFrame(self)
        self.scroll_frame.pack(fill="both", expand=True, padx=20, pady=12)

        # Close Button
        ctk.CTkButton(
            self,
            text="Schließen",
            command=self.destroy,
            height=36,
            fg_color="gray",
            hover_color="#555555"
        ).pack(fill="x", padx=20, pady=(0, 16))

    # --------------------------
    # Daten laden & rendern
    # --------------------------
    def lade_abteilungen(self):
        """Lädt alle Abteilungen"""
        # Alte Einträge löschen
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()

        # Abteilungen laden
        abteilungen = self.data_manager.db.abteilungen.get_all()

        # Info-Badge
        self.info_label.configure(text=f"{len(abteilungen)} Abteilungen")

        # Header
        self._create_table_header()

        # Abteilungen rendern
        for idx, abteilung in enumerate(abteilungen):
            self._create_abteilung_row(idx, abteilung)

        # Nach dem Rendern ggf. Höhe anpassen
        self.update_idletasks()
        self._resize_to_content()

    def _create_table_header(self):
        """Erstellt Tabellen-Header"""
        header_frame = ctk.CTkFrame(self.scroll_frame, fg_color="#2b2b2b", height=38)
        header_frame.pack(fill="x", pady=(0, 1))
        header_frame.pack_propagate(False)

        # 5 Spalten: Name, Farbe, Sortierung, Mitarbeiter, Aktionen
        for col, w in enumerate((3, 1, 1, 1, 1)):
            header_frame.columnconfigure(col, weight=w, uniform="cols")

        headers = ["Name", "Farbe", "Sortierung", "Mitarbeiter", "Aktionen"]

        for col, text in enumerate(headers):
            ctk.CTkLabel(
                header_frame,
                text=text,
                font=ctk.CTkFont(size=11, weight="bold"),
                text_color="#ffffff"
            ).grid(row=0, column=col, padx=4, pady=4, sticky="nsew")

    def _create_abteilung_row(self, index: int, abteilung):
        """Erstellt Abteilungs-Zeile"""
        bg_color = "#1f1f1f" if index % 2 == 0 else "#242424"

        row_frame = ctk.CTkFrame(self.scroll_frame, fg_color=bg_color, height=50, corner_radius=0)
        row_frame.pack(fill="x", pady=0)
        row_frame.pack_propagate(False)

        for col, w in enumerate((3, 1, 1, 1, 1)):
            row_frame.columnconfigure(col, weight=w, uniform="cols")

        # Name
        ctk.CTkLabel(
            row_frame,
            text=abteilung.name,
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w"
        ).grid(row=0, column=0, padx=8, sticky="ew")

        # Farbe (als Farb-Badge)
        farbe_frame = ctk.CTkFrame(row_frame, fg_color="transparent")
        farbe_frame.grid(row=0, column=1, padx=4, sticky="nsew")

        farbe_badge = ctk.CTkFrame(
            farbe_frame,
            fg_color=abteilung.farbe_hex,
            width=80,
            height=30,
            corner_radius=4
        )
        farbe_badge.pack(expand=True)
        farbe_badge.pack_propagate(False)

        ctk.CTkLabel(
            farbe_badge,
            text=abteilung.farbe_hex,
            font=ctk.CTkFont(size=10),
            text_color=self._get_contrast_color(abteilung.farbe_hex)
        ).pack(expand=True)

        # Sortierung
        ctk.CTkLabel(
            row_frame,
            text=str(abteilung.sortierung),
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=2, padx=4, sticky="ew")

        # Mitarbeiter-Anzahl
        mitarbeiter_count = self.data_manager.db.abteilungen.count_mitarbeiter(abteilung.id)
        ctk.CTkLabel(
            row_frame,
            text=str(mitarbeiter_count),
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=3, padx=4, sticky="ew")

        # Aktionen
        btn_container = ctk.CTkFrame(row_frame, fg_color="transparent")
        btn_container.grid(row=0, column=4, padx=4, sticky="ew")

        btn_inner = ctk.CTkFrame(btn_container, fg_color="transparent")
        btn_inner.pack(expand=True)

        ctk.CTkButton(
            btn_inner,
            text="✏", width=32, height=28,
            fg_color="#3498db", hover_color="#2980b9",
            font=ctk.CTkFont(size=14),
            command=lambda: self.bearbeiten(abteilung)
        ).pack(side="left", padx=2)

        ctk.CTkButton(
            btn_inner,
            text="✕", width=32, height=28,
            fg_color="#e74c3c", hover_color="#c0392b",
            text_color="white", font=ctk.CTkFont(size=14, weight="bold"),
            command=lambda: self.loeschen(abteilung)
        ).pack(side="left", padx=2)

    def _get_contrast_color(self, hex_color: str) -> str:
        """Berechnet Kontrastfarbe (hell/dunkel) für Text auf farbigem Hintergrund"""
        # Entferne '#' falls vorhanden
        hex_color = hex_color.lstrip('#')

        # Konvertiere zu RGB
        r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)

        # Berechne Helligkeit (0-255)
        brightness = (r * 299 + g * 587 + b * 114) / 1000

        # Rückgabe: Weiß für dunkle Farben, Schwarz für helle Farben
        return "#ffffff" if brightness < 128 else "#000000"

    # --------------------------
    # Aktionen
    # --------------------------
    def neue_abteilung(self):
        """Öffnet Dialog zum Hinzufügen"""
        from gui.dialogs.abteilungen.abteilung_hinzufuegen_dialog import AbteilungHinzufuegenDialog

        dialog = AbteilungHinzufuegenDialog(self, self.data_manager)
        self.wait_window(dialog)

        if dialog.result:
            try:
                # Abteilung erstellen
                abteilung = self.data_manager.db.abteilungen.create(
                    name=dialog.result['name'],
                    farbe_hex=dialog.result['farbe_hex'],
                    sortierung=dialog.result['sortierung']
                )

                self.lade_abteilungen()

                self.notification_manager.show(
                    f"Abteilung '{abteilung.name}' wurde erfolgreich erstellt!",
                    typ=self.notification_manager.SUCCESS,
                    title="Abteilung erstellt"
                )
            except Exception as e:
                self.notification_manager.show(
                    f"Fehler beim Erstellen: {str(e)}",
                    typ=self.notification_manager.ERROR,
                    title="Fehler"
                )

    def bearbeiten(self, abteilung):
        """Öffnet Bearbeitungs-Dialog"""
        from gui.dialogs.abteilungen.abteilung_bearbeiten_dialog import AbteilungBearbeitenDialog

        dialog = AbteilungBearbeitenDialog(self, abteilung, self.data_manager)
        self.wait_window(dialog)

        if dialog.result:
            # Abteilung aktualisieren
            abteilung.name = dialog.result['name']
            abteilung.farbe_hex = dialog.result['farbe_hex']
            abteilung.sortierung = dialog.result['sortierung']

            try:
                erfolg = self.data_manager.db.abteilungen.update(abteilung)

                if erfolg:
                    self.lade_abteilungen()

                    self.notification_manager.show(
                        f"Abteilung '{abteilung.name}' wurde erfolgreich aktualisiert!",
                        typ=self.notification_manager.SUCCESS,
                        title="Abteilung aktualisiert"
                    )
                else:
                    self.notification_manager.show(
                        "Fehler beim Aktualisieren",
                        typ=self.notification_manager.ERROR,
                        title="Fehler"
                    )
            except Exception as e:
                self.notification_manager.show(
                    f"Fehler: {str(e)}",
                    typ=self.notification_manager.ERROR,
                    title="Fehler"
                )

    def loeschen(self, abteilung):
        """Löscht eine Abteilung"""
        # Prüfe ob Mitarbeiter zugeordnet sind
        mitarbeiter_count = self.data_manager.db.abteilungen.count_mitarbeiter(abteilung.id)

        if mitarbeiter_count > 0:
            messagebox.showerror(
                "Abteilung kann nicht gelöscht werden",
                f"Die Abteilung '{abteilung.name}' hat noch {mitarbeiter_count} aktive(n) Mitarbeiter.\n\n"
                f"Bitte ordnen Sie zuerst alle Mitarbeiter einer anderen Abteilung zu."
            )
            return

        # Bestätigungs-Dialog
        antwort = messagebox.askyesno(
            "Abteilung löschen",
            f"Möchten Sie die Abteilung '{abteilung.name}' wirklich löschen?\n\n"
            f"Diese Aktion kann nicht rückgängig gemacht werden!"
        )

        if not antwort:
            return

        try:
            erfolg = self.data_manager.db.abteilungen.delete(abteilung.id)

            if erfolg:
                self.lade_abteilungen()

                self.notification_manager.show(
                    f"Abteilung '{abteilung.name}' wurde erfolgreich gelöscht!",
                    typ=self.notification_manager.SUCCESS,
                    title="Abteilung gelöscht"
                )
            else:
                self.notification_manager.show(
                    "Fehler beim Löschen",
                    typ=self.notification_manager.ERROR,
                    title="Fehler"
                )
        except Exception as e:
            self.notification_manager.show(
                f"Fehler: {str(e)}",
                typ=self.notification_manager.ERROR,
                title="Fehler"
            )
