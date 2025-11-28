import customtkinter as ctk
import tkinter.messagebox as messagebox
from typing import Dict
from datetime import datetime, date


class StammdatenVerwaltenDialog(ctk.CTkToplevel):
    """Dialog zur Verwaltung bestehender Mitarbeiter (wie MitarbeiterTabelle)"""

    def __init__(self, parent, data_manager):
        super().__init__(parent)

        self.data_manager = data_manager
        self.parent_window = parent

        # Fenster-Konfiguration
        self.title("Stammdaten verwalten")
        self.geometry("1200x750")
        self.resizable(True, True)
        self.minsize(1000, 600)

        # Modal
        self.transient(parent)
        self.grab_set()

        # ✅ Notification-Manager für diesen Dialog initialisieren
        from gui.notification_manager import NotificationManager
        self.notification_manager = NotificationManager(self)

        self._setup_gui()
        self.lade_mitarbeiter()

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
            text="⚙️ Stammdaten verwalten",
            font=ctk.CTkFont(size=16, weight="bold"),
            text_color="white"
        ).pack(pady=8)

        # Kompakte Toolbar
        toolbar = ctk.CTkFrame(self, fg_color="transparent", height=44)
        toolbar.pack(fill="x", padx=20, pady=(12, 0))
        toolbar.pack_propagate(False)

        ctk.CTkButton(
            toolbar,
            text="🔄 Aktualisieren",
            command=self.lade_mitarbeiter,
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
    def lade_mitarbeiter(self):
        """Lädt alle Mitarbeiter - gruppiert nach Abteilung wie MitarbeiterTabelle."""
        # Alte Einträge löschen
        for widget in self.scroll_frame.winfo_children():
            widget.destroy()

        # Mitarbeiter nach Abteilung gruppieren
        abteilungen = {}
        for ma_id, daten in self.data_manager.stammdaten.items():
            abteilung = daten.get("abteilung", "Keine Abteilung")
            abteilungen.setdefault(abteilung, []).append((ma_id, daten))

        # Sortierung
        sortierte_abteilungen = sorted(abteilungen.keys())

        # Info-Badge
        gesamt_anzahl = sum(len(mitarbeiter) for mitarbeiter in abteilungen.values())
        self.info_label.configure(text=f"{gesamt_anzahl} Mitarbeiter in {len(abteilungen)} Abteilungen")

        # ✅ EINMAL HEADER GANZ OBEN
        self._create_table_header()

        # Render je Abteilung
        row_index = 0
        for abteilung in sortierte_abteilungen:
            mitarbeiter_liste = sorted(
                abteilungen[abteilung],
                key=lambda x: f"{x[1].get('vorname','')} {x[1].get('nachname','')}"
            )

            # Abteilungs-Header
            self._create_abteilung_header(abteilung, len(mitarbeiter_liste))

            # Mitarbeiter-Zeilen
            for idx, (ma_id, daten) in enumerate(mitarbeiter_liste):
                self._create_mitarbeiter_row(row_index, ma_id, daten)
                row_index += 1

            # Kleiner Abstand nach jeder Abteilung
            spacer = ctk.CTkFrame(self.scroll_frame, height=8, fg_color="transparent")
            spacer.pack(fill="x")

        # Nach dem Rendern ggf. Höhe anpassen
        self.update_idletasks()
        self._resize_to_content()

    def _create_table_header(self):
        """✅ Erstellt EINEN globalen Tabellen-Header (wie in MitarbeiterTabelle)."""
        header_frame = ctk.CTkFrame(self.scroll_frame, fg_color="#2b2b2b", height=38)
        header_frame.pack(fill="x", pady=(0, 1))
        header_frame.pack_propagate(False)

        # 7 Spalten (responsiv per weight)
        for col, w in enumerate((2, 2, 1, 1, 1, 1, 1)):
            header_frame.columnconfigure(col, weight=w, uniform="cols")

        headers = [
            "Name", "Abteilung", "Geburtsdatum", "Einstellung",
            "Betriebs­zugehörigkeit", "Urlaubstage", "Aktionen"
        ]

        for col, text in enumerate(headers):
            ctk.CTkLabel(
                header_frame,
                text=text,
                font=ctk.CTkFont(size=11, weight="bold"),
                text_color="#ffffff"
            ).grid(row=0, column=col, padx=4, pady=4, sticky="nsew")

    def _create_abteilung_header(self, abteilung: str, anzahl: int):
        """✅ Erstellt Abteilungs-Header (wie in MitarbeiterTabelle)."""
        farben = {
            "Werkstatt": "#e67e22",
            "Verkauf": "#3498db",
            "Service": "#9b59b6",
            "Buchhaltung": "#27ae60",
            "Geschäftsleitung": "#e74c3c"
        }
        farbe = farben.get(abteilung, "#7f8c8d")

        header = ctk.CTkFrame(self.scroll_frame, fg_color=farbe, height=38)
        header.pack(fill="x", pady=(0, 0))
        header.pack_propagate(False)

        inner = ctk.CTkFrame(header, fg_color="transparent")
        inner.pack(fill="both", expand=True, padx=16, pady=0)

        # Name + Anzahl horizontal zentriert
        content = ctk.CTkFrame(inner, fg_color="transparent")
        content.pack(expand=True)

        ctk.CTkLabel(
            content,
            text=abteilung,
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="white"
        ).pack(side="left", padx=(0, 10))

        ctk.CTkLabel(
            content,
            text=f"({anzahl} Mitarbeiter)",
            font=ctk.CTkFont(size=10),
            text_color="white"
        ).pack(side="left")

    def _create_mitarbeiter_row(self, index: int, ma_id: str, daten: Dict):
        """✅ Erstellt Mitarbeiter-Zeile (wie in MitarbeiterTabelle)."""
        bg_color = "#1f1f1f" if index % 2 == 0 else "#242424"

        row_frame = ctk.CTkFrame(self.scroll_frame, fg_color=bg_color, height=50, corner_radius=0)
        row_frame.pack(fill="x", pady=0)
        row_frame.pack_propagate(False)

        for col, w in enumerate((2, 2, 1, 1, 1, 1, 1)):
            row_frame.columnconfigure(col, weight=w, uniform="cols")

        # Name
        name_text = f"{daten.get('vorname','')} {daten.get('nachname','')}".strip()
        ctk.CTkLabel(
            row_frame, text=name_text, 
            font=ctk.CTkFont(size=13), 
            anchor="w"
        ).grid(row=0, column=0, padx=8, sticky="ew")

        # Abteilung (mit Farbe)
        abt = daten.get('abteilung', '-')
        abt_farben = {
            "Werkstatt": "#e67e22",
            "Verkauf": "#3498db",
            "Service": "#9b59b6",
            "Buchhaltung": "#27ae60",
            "Geschäftsleitung": "#e74c3c"
        }
        abt_farbe = abt_farben.get(abt, "#7f8c8d")
        
        ctk.CTkLabel(
            row_frame, text=abt,
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=abt_farbe,
            anchor="w"
        ).grid(row=0, column=1, padx=8, sticky="ew")

        # Geburtsdatum
        geburtsdatum_str = daten.get('geburtsdatum', '-')
        if geburtsdatum_str and geburtsdatum_str != '-':
            try:
                geb_date = datetime.strptime(geburtsdatum_str, '%Y-%m-%d')
                geburtsdatum_str = geb_date.strftime('%d.%m.%Y')
            except Exception:
                pass
        ctk.CTkLabel(
            row_frame, text=geburtsdatum_str,
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=2, padx=4, sticky="ew")

        # Einstellungsdatum
        einstellung_raw = daten.get('einstellungsdatum', daten.get('eintrittsdatum', '-'))
        einstellung_str = einstellung_raw
        if einstellung_raw and einstellung_raw != '-':
            try:
                ein_date = datetime.strptime(einstellung_raw, '%Y-%m-%d')
                einstellung_str = ein_date.strftime('%d.%m.%Y')
            except Exception:
                pass
        ctk.CTkLabel(
            row_frame, text=einstellung_str,
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=3, padx=4, sticky="ew")

        # Betriebszugehörigkeit
        zugehoerigkeit_str = "-"
        if einstellung_raw and einstellung_raw != '-':
            try:
                ein_date = datetime.strptime(einstellung_raw, '%Y-%m-%d')
                jahre = (datetime.now() - ein_date).days / 365.25
                zugehoerigkeit_str = f"{jahre:.1f} Jahre"
            except Exception:
                pass
        ctk.CTkLabel(
            row_frame, text=zugehoerigkeit_str,
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=4, padx=4, sticky="ew")

        # Urlaubstage
        ctk.CTkLabel(
            row_frame, text=str(daten.get('urlaubstage_jahr', 30)),
            font=ctk.CTkFont(size=11),
            anchor="center"
        ).grid(row=0, column=5, padx=4, sticky="ew")

        # Aktionen
        btn_container = ctk.CTkFrame(row_frame, fg_color="transparent")
        btn_container.grid(row=0, column=6, padx=4, sticky="ew")
        btn_inner = ctk.CTkFrame(btn_container, fg_color="transparent")
        btn_inner.pack(expand=True)

        ctk.CTkButton(
            btn_inner,
            text="✏", width=32, height=28,
            fg_color="#3498db", hover_color="#2980b9",
            font=ctk.CTkFont(size=14),
            command=lambda: self.bearbeiten(ma_id, daten)
        ).pack(side="left", padx=2)

        ctk.CTkButton(
            btn_inner,
            text="✕", width=32, height=28,
            fg_color="#e74c3c", hover_color="#c0392b",
            text_color="white", font=ctk.CTkFont(size=14, weight="bold"),
            command=lambda: self.loeschen(ma_id, daten)
        ).pack(side="left", padx=2)

    # --------------------------
    # Aktionen
    # --------------------------
    def bearbeiten(self, ma_id: str, daten: Dict):
        """Öffnet Bearbeitungs-Dialog"""
        from gui.dialogs.stammdaten.stammdaten_bearbeiten_dialog import MitarbeiterBearbeitenDialog

        dialog = MitarbeiterBearbeitenDialog(self, ma_id, daten, self.data_manager)
        self.wait_window(dialog)

        if dialog.result:
            # ✅ V3: Nutze Repository statt alte Methode
            try:
                # Hole Mitarbeiter aus DB
                mitarbeiter = self.data_manager.db.mitarbeiter.get_by_id(ma_id)
                
                if not mitarbeiter:
                    self.notification_manager.show(
                        "Mitarbeiter nicht gefunden",
                        typ=self.notification_manager.ERROR,
                        title="Fehler"
                    )
                    return
                
                # Abteilung finden
                abteilung = self.data_manager.db.abteilungen.get_by_name(
                    dialog.result.get('abteilung', 'Werkstatt')
                )

                if not abteilung:
                    self.notification_manager.show(
                        f"Abteilung '{dialog.result.get('abteilung')}' nicht gefunden",
                        typ=self.notification_manager.ERROR,
                        title="Fehler"
                    )
                    return

                # Aktualisiere Mitarbeiter-Objekt
                mitarbeiter.vorname = dialog.result['vorname']
                mitarbeiter.nachname = dialog.result['nachname']
                mitarbeiter.abteilung_id = abteilung.id
                mitarbeiter.urlaubstage_jahr = dialog.result.get('urlaubstage_jahr', 30)
                
                # Datumsfelder
                if 'geburtsdatum' in dialog.result and dialog.result['geburtsdatum']:
                    from datetime import datetime
                    mitarbeiter.geburtsdatum = datetime.strptime(
                        dialog.result['geburtsdatum'], '%Y-%m-%d'
                    ).date()
                
                if 'einstellungsdatum' in dialog.result and dialog.result['einstellungsdatum']:
                    from datetime import datetime
                    mitarbeiter.eintrittsdatum = datetime.strptime(
                        dialog.result['einstellungsdatum'], '%Y-%m-%d'
                    ).date()
                
                # In DB speichern
                erfolg = self.data_manager.db.mitarbeiter.update(mitarbeiter)
                
                if erfolg:
                    # Cache aktualisieren
                    self.data_manager.stammdaten[ma_id] = dialog.result
                    self.data_manager._invalidate_cache()
                    
                    # Tabelle neu laden
                    self.lade_mitarbeiter()
                    
                    # Notification
                    name = f"{dialog.result.get('vorname', '')} {dialog.result.get('nachname', '')}".strip()
                    self.notification_manager.show(
                        f"{name} wurde erfolgreich aktualisiert!",
                        typ=self.notification_manager.SUCCESS,
                        title="Mitarbeiter aktualisiert"
                    )
                else:
                    self.notification_manager.show(
                        "Fehler beim Aktualisieren des Mitarbeiters",
                        typ=self.notification_manager.ERROR,
                        title="Fehler"
                    )
            
            except Exception as e:
                self.notification_manager.show(
                    f"Fehler: {str(e)}",
                    typ=self.notification_manager.ERROR,
                    title="Fehler"
                )

    def loeschen(self, ma_id: str, daten: Dict):
        """Löscht einen Mitarbeiter permanent inkl. ALLER Bewegungsdaten"""
        name = f"{daten.get('vorname','')} {daten.get('nachname','')}".strip()
        
        # Zähle vorhandene Einträge (V3-Style)
        try:
            urlaube = self.data_manager.db.urlaub.get_all(mitarbeiter_id=ma_id)
            krankheiten = self.data_manager.db.krankheit.get_all(mitarbeiter_id=ma_id)
            schulungen = self.data_manager.db.schulung.get_all(mitarbeiter_id=ma_id)
            ueberstunden = self.data_manager.db.ueberstunden.get_all(mitarbeiter_id=ma_id)
            
            anzahl_eintraege = len(urlaube) + len(krankheiten) + len(schulungen) + len(ueberstunden)
        except Exception:
            anzahl_eintraege = 0
        
        # Bestätigungs-Dialog
        import tkinter.messagebox as messagebox
        warnung = (
            f"Möchten Sie {name} wirklich PERMANENT löschen?\n\n"
            f"⚠️ WARNUNG - Folgendes wird UNWIDERRUFLICH gelöscht:\n\n"
            f"• Mitarbeiter-Stammdaten\n"
            f"• ALLE {anzahl_eintraege} Bewegungsdaten (Urlaub, Krankheit, Schulung, Überstunden)\n"
            f"• Alle historischen Daten\n\n"
            f"❌ Diese Aktion kann NICHT rückgängig gemacht werden!\n\n"
            f"Wirklich ALLES löschen?"
        )
        
        antwort = messagebox.askyesno(
            "Mitarbeiter & Daten löschen",
            warnung,
            parent=self,
            icon='warning'
        )
        
        if antwort:
            try:
                # ✅ V3: Nutze Repository (CASCADE löscht automatisch alle Einträge!)
                erfolg = self.data_manager.db.mitarbeiter.delete(ma_id)
                
                if erfolg:
                    # Aus Cache entfernen
                    if ma_id in self.data_manager.stammdaten:
                        del self.data_manager.stammdaten[ma_id]
                    
                    # Cache invalidieren
                    self.data_manager._invalidate_cache()
                    
                    # Tabelle neu laden
                    self.lade_mitarbeiter()
                    
                    # Erfolgs-Notification
                    self.notification_manager.show(
                        f"{name} wurde vollständig gelöscht!\n"
                        f"• Stammdaten gelöscht\n"
                        f"• {anzahl_eintraege} Einträge gelöscht (CASCADE)",
                        typ=self.notification_manager.SUCCESS,
                        title="Mitarbeiter gelöscht",
                        duration=6000
                    )
                else:
                    self.notification_manager.show(
                        f"Fehler beim Löschen von {name}",
                        typ=self.notification_manager.ERROR,
                        title="Fehler",
                        duration=4000
                    )
                    
            except Exception as e:
                # Fehler-Notification
                self.notification_manager.show(
                    f"Fehler beim Löschen von {name}:\n{str(e)[:100]}", 
                    typ=self.notification_manager.ERROR,
                    title="Fehler beim Löschen",
                    duration=8000
                )