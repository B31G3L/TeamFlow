import customtkinter as ctk
import tkinter.messagebox as messagebox
from typing import Dict, List
from datetime import datetime, date


class FeiertageVerwaltenDialog(ctk.CTkToplevel):
    """Dialog zur Verwaltung von Feiertagen"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)

        self.data_manager = data_manager
        self.parent_window = parent

        # Fenster-Konfiguration
        self.title("Feiertage verwalten")
        self.geometry("1200x750")
        self.resizable(True, True)
        self.minsize(1000, 600)

        # Modal
        self.transient(parent)
        self.grab_set()

        # Notification-Manager für diesen Dialog initialisieren
        from gui.notification_manager import NotificationManager
        self.notification_manager = NotificationManager(self)

        # Jahr-Filter
        self.jahr_var = ctk.IntVar(value=datetime.now().year)

        self._setup_gui()
        self.lade_feiertage()

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
            text="🎉 Feiertage verwalten",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Kompakte Toolbar
        toolbar = ctk.CTkFrame(self, fg_color="transparent", height=44)
        toolbar.pack(fill="x", padx=20, pady=(12, 0))
        toolbar.pack_propagate(False)

        ctk.CTkButton(
            toolbar,
            text="➕ Neuer Feiertag",
            command=self.neuer_feiertag,
            width=180,
            height=34,
            fg_color="#27ae60",
            hover_color="#229954"
        ).pack(side="left", padx=(0, 10))

        ctk.CTkButton(
            toolbar,
            text="🔄 Aktualisieren",
            command=self.lade_feiertage,
            width=150,
            height=34
        ).pack(side="left", padx=(0, 10))

        # Jahr-Filter
        jahr_frame = ctk.CTkFrame(toolbar, fg_color="transparent")
        jahr_frame.pack(side="left", padx=(10, 0))

        ctk.CTkLabel(
            jahr_frame,
            text="Jahr:",
            font=ctk.CTkFont(size=11)
        ).pack(side="left", padx=(0, 5))

        jahr_entry = ctk.CTkEntry(
            jahr_frame,
            textvariable=self.jahr_var,
            width=80,
            height=34
        )
        jahr_entry.pack(side="left", padx=(0, 5))
        jahr_entry.bind("<Return>", lambda e: self.lade_feiertage())

        ctk.CTkButton(
            jahr_frame,
            text="Filter",
            command=self.lade_feiertage,
            width=70,
            height=34
        ).pack(side="left")

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
    def lade_feiertage(self):
        """Lädt alle Feiertage"""
        # Alte Einträge löschen
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()

        # Feiertage laden
        jahr = self.jahr_var.get()
        feiertage = self.data_manager.db.feiertage.get_all(jahr=jahr, nur_aktive=False)

        # Info-Badge
        aktive = sum(1 for f in feiertage if f.aktiv)
        self.info_label.configure(text=f"{len(feiertage)} Feiertage ({aktive} aktiv)")

        # Header
        self._create_table_header()

        # Feiertage rendern
        for idx, feiertag in enumerate(feiertage):
            self._create_feiertag_row(idx, feiertag)

        # Nach dem Rendern ggf. Höhe anpassen
        self.update_idletasks()
        self._resize_to_content()

    def _create_table_header(self):
        """Erstellt Tabellen-Header"""
        header_frame = ctk.CTkFrame(self.scroll_frame, fg_color="#2b2b2b", height=38)
        header_frame.pack(fill="x", pady=(0, 1))
        header_frame.pack_propagate(False)

        # 5 Spalten: Datum, Name, Bundesland, Aktiv, Aktionen
        for col, w in enumerate((1, 2, 1, 1, 1)):
            header_frame.columnconfigure(col, weight=w, uniform="cols")

        headers = ["Datum", "Name", "Bundesland", "Aktiv", "Aktionen"]

        for col, text in enumerate(headers):
            ctk.CTkLabel(
                header_frame,
                text=text,
                font=ctk.CTkFont(size=11, weight="bold"),
                text_color="#ffffff"
            ).grid(row=0, column=col, padx=4, pady=4, sticky="nsew")

    def _create_feiertag_row(self, index: int, feiertag):
        """Erstellt Feiertags-Zeile"""
        bg_color = "#1f1f1f" if index % 2 == 0 else "#242424"

        row_frame = ctk.CTkFrame(self.scroll_frame, fg_color=bg_color, height=50, corner_radius=0)
        row_frame.pack(fill="x", pady=0)
        row_frame.pack_propagate(False)

        for col, w in enumerate((1, 2, 1, 1, 1)):
            row_frame.columnconfigure(col, weight=w, uniform="cols")

        # Datum
        ctk.CTkLabel(
            row_frame,
            text=feiertag.datum.strftime('%d.%m.%Y'),
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=0, padx=4, sticky="ew")

        # Name
        ctk.CTkLabel(
            row_frame,
            text=feiertag.name,
            font=ctk.CTkFont(size=13, weight="bold"),
            anchor="w"
        ).grid(row=0, column=1, padx=8, sticky="ew")

        # Bundesland
        bundesland_str = feiertag.bundesland if feiertag.bundesland else "Bundesweit"
        ctk.CTkLabel(
            row_frame,
            text=bundesland_str,
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=2, padx=4, sticky="ew")

        # Aktiv
        aktiv_str = "✓" if feiertag.aktiv else "✗"
        aktiv_color = "#27ae60" if feiertag.aktiv else "#e74c3c"
        ctk.CTkLabel(
            row_frame,
            text=aktiv_str,
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color=aktiv_color,
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
            command=lambda: self.bearbeiten(feiertag)
        ).pack(side="left", padx=2)

        ctk.CTkButton(
            btn_inner,
            text="✕", width=32, height=28,
            fg_color="#e74c3c", hover_color="#c0392b",
            text_color="white", font=ctk.CTkFont(size=14, weight="bold"),
            command=lambda: self.loeschen(feiertag)
        ).pack(side="left", padx=2)

    # --------------------------
    # Aktionen
    # --------------------------
    def neuer_feiertag(self):
        """Öffnet Dialog zum Hinzufügen"""
        from gui.dialogs.feiertage.feiertag_hinzufuegen_dialog import FeiertagHinzufuegenDialog

        dialog = FeiertagHinzufuegenDialog(self, self.data_manager)
        self.wait_window(dialog)

        if dialog.result:
            # Feiertag erstellen
            from models.entities import Feiertag
            feiertag = Feiertag(
                id=0,  # Wird von DB gesetzt
                datum=dialog.result['datum'],
                name=dialog.result['name'],
                bundesland=dialog.result.get('bundesland'),
                aktiv=dialog.result.get('aktiv', True)
            )

            try:
                self.data_manager.db.feiertage.create(feiertag)
                self.lade_feiertage()

                self.notification_manager.show(
                    f"'{feiertag.name}' wurde erfolgreich erstellt!",
                    typ=self.notification_manager.SUCCESS,
                    title="Feiertag erstellt"
                )
            except Exception as e:
                self.notification_manager.show(
                    f"Fehler beim Erstellen: {str(e)}",
                    typ=self.notification_manager.ERROR,
                    title="Fehler"
                )

    def bearbeiten(self, feiertag):
        """Öffnet Bearbeitungs-Dialog"""
        from gui.dialogs.feiertage.feiertag_bearbeiten_dialog import FeiertagBearbeitenDialog

        dialog = FeiertagBearbeitenDialog(self, feiertag, self.data_manager)
        self.wait_window(dialog)

        if dialog.result:
            # Feiertag aktualisieren
            feiertag.datum = dialog.result['datum']
            feiertag.name = dialog.result['name']
            feiertag.bundesland = dialog.result.get('bundesland')
            feiertag.aktiv = dialog.result.get('aktiv', True)

            try:
                erfolg = self.data_manager.db.feiertage.update(feiertag)

                if erfolg:
                    self.lade_feiertage()

                    self.notification_manager.show(
                        f"'{feiertag.name}' wurde erfolgreich aktualisiert!",
                        typ=self.notification_manager.SUCCESS,
                        title="Feiertag aktualisiert"
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

    def loeschen(self, feiertag):
        """Löscht einen Feiertag"""
        # Bestätigungs-Dialog
        antwort = messagebox.askyesno(
            "Feiertag löschen",
            f"Möchten Sie den Feiertag '{feiertag.name}' am {feiertag.datum.strftime('%d.%m.%Y')} wirklich löschen?\n\n"
            f"Diese Aktion kann nicht rückgängig gemacht werden!",
            parent=self,
            icon='warning'
        )

        if antwort:
            try:
                erfolg = self.data_manager.db.feiertage.delete(feiertag.id)

                if erfolg:
                    self.lade_feiertage()

                    self.notification_manager.show(
                        f"'{feiertag.name}' wurde gelöscht!",
                        typ=self.notification_manager.SUCCESS,
                        title="Feiertag gelöscht",
                        duration=4000
                    )
                else:
                    self.notification_manager.show(
                        f"Fehler beim Löschen von '{feiertag.name}'",
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
