import customtkinter as ctk
import tkinter.messagebox as messagebox
from typing import Dict, List
from datetime import datetime, date


class VeranstaltungenVerwaltenDialog(ctk.CTkToplevel):
    """Dialog zur Verwaltung von Veranstaltungen"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)

        self.data_manager = data_manager
        self.parent_window = parent

        # Fenster-Konfiguration
        self.title("Veranstaltungen verwalten")
        self.geometry("1200x750")
        self.resizable(True, True)
        self.minsize(1000, 600)

        # Modal
        self.transient(parent)
        self.grab_set()

        # Notification-Manager für diesen Dialog initialisieren
        from gui.notification_manager import NotificationManager
        self.notification_manager = NotificationManager(self)

        self._setup_gui()
        self.lade_veranstaltungen()

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
        req_w = max(self.winfo_reqwidth(), 1200)
        req_h = max(self.winfo_reqheight(), 750)
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
            text="📅 Veranstaltungen verwalten",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Kompakte Toolbar
        toolbar = ctk.CTkFrame(self, fg_color="transparent", height=44)
        toolbar.pack(fill="x", padx=20, pady=(12, 0))
        toolbar.pack_propagate(False)

        ctk.CTkButton(
            toolbar,
            text="➕ Neue Veranstaltung",
            command=self.neue_veranstaltung,
            width=180,
            height=34,
            fg_color="#27ae60",
            hover_color="#229954"
        ).pack(side="left", padx=(0, 10))

        ctk.CTkButton(
            toolbar,
            text="🔄 Aktualisieren",
            command=self.lade_veranstaltungen,
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
    def lade_veranstaltungen(self):
        """Lädt alle Veranstaltungen"""
        # Alte Einträge löschen
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()

        # Veranstaltungen laden
        veranstaltungen = self.data_manager.db.veranstaltungen.get_all()

        # Info-Badge
        self.info_label.configure(text=f"{len(veranstaltungen)} Veranstaltungen")

        # Header
        self._create_table_header()

        # Veranstaltungen rendern
        for idx, veranstaltung in enumerate(veranstaltungen):
            self._create_veranstaltung_row(idx, veranstaltung)

        # Nach dem Rendern ggf. Höhe anpassen
        self.update_idletasks()
        self._resize_to_content()

    def _create_table_header(self):
        """Erstellt Tabellen-Header"""
        header_frame = ctk.CTkFrame(self.scroll_frame, fg_color="#2b2b2b", height=38)
        header_frame.pack(fill="x", pady=(0, 1))
        header_frame.pack_propagate(False)

        # 5 Spalten
        for col, w in enumerate((2, 1, 2, 1, 1)):
            header_frame.columnconfigure(col, weight=w, uniform="cols")

        headers = ["Name", "Von - Bis", "Ort", "Max. Teilnehmer", "Aktionen"]

        for col, text in enumerate(headers):
            ctk.CTkLabel(
                header_frame,
                text=text,
                font=ctk.CTkFont(size=11, weight="bold"),
                text_color="#ffffff"
            ).grid(row=0, column=col, padx=4, pady=4, sticky="nsew")

    def _create_veranstaltung_row(self, index: int, veranstaltung):
        """Erstellt Veranstaltungs-Zeile"""
        bg_color = "#1f1f1f" if index % 2 == 0 else "#242424"

        row_frame = ctk.CTkFrame(self.scroll_frame, fg_color=bg_color, height=50, corner_radius=0)
        row_frame.pack(fill="x", pady=0)
        row_frame.pack_propagate(False)

        for col, w in enumerate((2, 1, 2, 1, 1)):
            row_frame.columnconfigure(col, weight=w, uniform="cols")

        # Name
        ctk.CTkLabel(
            row_frame, text=veranstaltung.name,
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w"
        ).grid(row=0, column=0, padx=8, sticky="ew")

        # Datum
        if veranstaltung.von_datum == veranstaltung.bis_datum:
            datum_str = veranstaltung.von_datum.strftime('%d.%m.%Y')
        else:
            datum_str = f"{veranstaltung.von_datum.strftime('%d.%m.%Y')} - {veranstaltung.bis_datum.strftime('%d.%m.%Y')}"
        ctk.CTkLabel(
            row_frame, text=datum_str,
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=1, padx=4, sticky="ew")

        # Ort
        ort_str = veranstaltung.ort if veranstaltung.ort else "-"
        ctk.CTkLabel(
            row_frame, text=ort_str,
            font=ctk.CTkFont(size=11),
            anchor="w"
        ).grid(row=0, column=2, padx=8, sticky="ew")

        # Max Teilnehmer
        teilnehmer_str = str(veranstaltung.max_teilnehmer) if veranstaltung.max_teilnehmer else "-"
        ctk.CTkLabel(
            row_frame, text=teilnehmer_str,
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
            command=lambda: self.bearbeiten(veranstaltung)
        ).pack(side="left", padx=2)

        ctk.CTkButton(
            btn_inner,
            text="✕", width=32, height=28,
            fg_color="#e74c3c", hover_color="#c0392b",
            text_color="white", font=ctk.CTkFont(size=14, weight="bold"),
            command=lambda: self.loeschen(veranstaltung)
        ).pack(side="left", padx=2)

    # --------------------------
    # Aktionen
    # --------------------------
    def neue_veranstaltung(self):
        """Öffnet Dialog zum Hinzufügen"""
        from gui.dialogs.veranstaltungen.veranstaltungen_hinzufuegen_dialog import VeranstaltungHinzufuegenDialog

        dialog = VeranstaltungHinzufuegenDialog(self, self.data_manager)
        self.wait_window(dialog)

        if dialog.result:
            # Veranstaltung erstellen
            from models.entities import Veranstaltung
            veranstaltung = Veranstaltung(
                id=None,
                name=dialog.result['name'],
                von_datum=dialog.result['von_datum'],
                bis_datum=dialog.result['bis_datum'],
                ort=dialog.result.get('ort'),
                beschreibung=dialog.result.get('beschreibung'),
                max_teilnehmer=dialog.result.get('max_teilnehmer')
            )

            try:
                self.data_manager.db.veranstaltungen.create(veranstaltung)
                self.lade_veranstaltungen()

                self.notification_manager.show(
                    f"'{veranstaltung.name}' wurde erfolgreich erstellt!",
                    typ=self.notification_manager.SUCCESS,
                    title="Veranstaltung erstellt"
                )
            except Exception as e:
                self.notification_manager.show(
                    f"Fehler beim Erstellen: {str(e)}",
                    typ=self.notification_manager.ERROR,
                    title="Fehler"
                )

    def bearbeiten(self, veranstaltung):
        """Öffnet Bearbeitungs-Dialog"""
        from gui.dialogs.veranstaltungen.veranstaltungen_bearbeiten_dialog import VeranstaltungBearbeitenDialog

        dialog = VeranstaltungBearbeitenDialog(self, veranstaltung, self.data_manager)
        self.wait_window(dialog)

        if dialog.result:
            # Veranstaltung aktualisieren
            veranstaltung.name = dialog.result['name']
            veranstaltung.von_datum = dialog.result['von_datum']
            veranstaltung.bis_datum = dialog.result['bis_datum']
            veranstaltung.ort = dialog.result.get('ort')
            veranstaltung.beschreibung = dialog.result.get('beschreibung')
            veranstaltung.max_teilnehmer = dialog.result.get('max_teilnehmer')

            try:
                erfolg = self.data_manager.db.veranstaltungen.update(veranstaltung)

                if erfolg:
                    self.lade_veranstaltungen()

                    self.notification_manager.show(
                        f"'{veranstaltung.name}' wurde erfolgreich aktualisiert!",
                        typ=self.notification_manager.SUCCESS,
                        title="Veranstaltung aktualisiert"
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

    def loeschen(self, veranstaltung):
        """Löscht eine Veranstaltung"""
        # Bestätigungs-Dialog
        antwort = messagebox.askyesno(
            "Veranstaltung löschen",
            f"Möchten Sie die Veranstaltung '{veranstaltung.name}' wirklich löschen?\n\n"
            f"Diese Aktion kann nicht rückgängig gemacht werden!",
            parent=self,
            icon='warning'
        )

        if antwort:
            try:
                erfolg = self.data_manager.db.veranstaltungen.delete(veranstaltung.id)

                if erfolg:
                    self.lade_veranstaltungen()

                    self.notification_manager.show(
                        f"'{veranstaltung.name}' wurde gelöscht!",
                        typ=self.notification_manager.SUCCESS,
                        title="Veranstaltung gelöscht",
                        duration=4000
                    )
                else:
                    self.notification_manager.show(
                        f"Fehler beim Löschen von '{veranstaltung.name}'",
                        typ=self.notification_manager.ERROR,
                        title="Fehler",
                        duration=4000
                    )

            except Exception as e:
                self.notification_manager.show(
                    f"Fehler beim Löschen:\n{str(e)[:100]}",
                    typ=self.notification_manager.ERROR,
                    title="Fehler beim Löschen",
                    duration=8000
                )
