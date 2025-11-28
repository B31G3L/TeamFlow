"""
Mitarbeiter-Tabelle mit Callback für Dashboard-Updates
✅ FIXED: Keine leeren Zeilen mehr bei gefilterten Ansichten
"""

from __future__ import annotations
from typing import List, Dict, Callable, Optional
import customtkinter as ctk
from models.data_manager_v3 import TeamplannerDataManager
from models.mitarbeiter import MitarbeiterStatistik
from gui.notification_manager import show_info, show_warning


class MitarbeiterTabelle(ctk.CTkFrame):
    """Ultra-optimierte Tabelle mit Callback-System - FIXED VERSION"""

    ROW_HEIGHT = 50
    FONT_SIZE = 13

    def __init__(self, parent, data_manager: TeamplannerDataManager):
        super().__init__(parent, fg_color="transparent")

        self.data_manager = data_manager
        self.abteilungs_filter = "Alle"

        # ✅ NEU: Callback für Datenänderungen
        self.on_data_changed: Optional[Callable] = None

        # ✅ FIX: Lade Abteilungsfarben dynamisch aus DB
        self.abteilungs_farben = self._lade_abteilungs_farben()

        self.aktuelle_stats: List[MitarbeiterStatistik] = []
        self.row_widgets: List[Dict] = []
        self.visible_count = 0

        self._font_normal = ctk.CTkFont(size=self.FONT_SIZE)
        self._font_bold = ctk.CTkFont(size=self.FONT_SIZE, weight="bold")
        self._font_header = ctk.CTkFont(size=11, weight="bold")

        self.setup_gui()
        self.after(10, self.aktualisiere_tabelle)

    def _lade_abteilungs_farben(self) -> Dict[str, str]:
        """✅ NEU: Lädt Abteilungsfarben dynamisch aus DB"""
        try:
            abteilungen = self.data_manager.db.abteilungen.get_all()
            return {abt.name: abt.farbe_hex for abt in abteilungen}
        except Exception as e:
            print(f"⚠️ Fehler beim Laden der Abteilungsfarben: {e}")
            # Fallback auf Default-Farben
            return {
                "Werkstatt": "#e67e22",
                "Verkauf": "#3498db",
                "Service": "#9b59b6",
                "Buchhaltung": "#27ae60",
                "Geschäftsleitung": "#e74c3c"
            }

    def setup_gui(self):
        """GUI-Elemente erstellen"""
        # Filter-Leiste
        filter_frame = ctk.CTkFrame(self, height=50)
        filter_frame.pack(fill="x", padx=0, pady=(0, 8))
        filter_frame.pack_propagate(False)

        filter_content = ctk.CTkFrame(filter_frame, fg_color="transparent")
        filter_content.pack(fill="both", expand=True, padx=16, pady=10)

        ctk.CTkLabel(
            filter_content,
            text="Abteilung:",
            font=self._font_header
        ).pack(side="left", padx=(0, 8))

        # ✅ FIX: Verwende dynamische Abteilungsliste aus DB
        abteilungen = ["Alle"] + sorted(self.abteilungs_farben.keys())
        self.abteilungs_combo = ctk.CTkComboBox(
            filter_content,
            values=abteilungen,
            width=200,
            height=32,
            command=self.on_abteilung_changed
        )
        self.abteilungs_combo.pack(side="left")
        self.abteilungs_combo.set("Alle")

        # Container
        table_container = ctk.CTkFrame(self, fg_color="transparent")
        table_container.pack(fill="both", expand=True, padx=0, pady=0)

        # Header mit 9 Spalten
        self.header_frame = ctk.CTkFrame(table_container, fg_color="#2b2b2b", height=45)
        self.header_frame.pack(fill="x", padx=0, pady=(0, 1))
        self.header_frame.pack_propagate(False)

        for i in range(9):
            self.header_frame.columnconfigure(i, weight=1, uniform="cols")

        headers = [
            "Mitarbeiter", "Abteilung", "Tage/Jahr",
            "Übertrag", "Genommen", "Verbleibend", "Krank",
            "Schulung", "Überstunden"
        ]

        for col, text in enumerate(headers):
            ctk.CTkLabel(
                self.header_frame,
                text=text,
                font=self._font_header,
                text_color="#ffffff"
            ).grid(row=0, column=col, padx=4, pady=4, sticky="nsew")

        # Scrollbare Tabelle
        self.scroll_frame = ctk.CTkScrollableFrame(
            table_container,
            fg_color="transparent"
        )
        self.scroll_frame.pack(fill="both", expand=True, padx=0, pady=0)

    def on_abteilung_changed(self, value: str):
        """Abteilungsfilter geändert"""
        if self.abteilungs_filter == value:
            return
        
        self.abteilungs_filter = value
        self.aktualisiere_tabelle_gefiltert()

    def aktualisiere_tabelle(self):
        """✅ GEÄNDERT: Lädt Daten neu und triggert Callback"""
        # ✅ FIX: Lade Farben neu (falls Abteilungen geändert wurden)
        self.abteilungs_farben = self._lade_abteilungs_farben()

        self.data_manager._rebuild_cache()
        self.aktualisiere_tabelle_gefiltert()

        # ✅ NEU: Callback ausführen
        if self.on_data_changed:
            self.on_data_changed()

    def aktualisiere_tabelle_gefiltert(self):
        """✅ FIXED: Aktualisiert nur die Anzeige - keine leeren Zeilen mehr"""
        # Alte Widgets komplett löschen
        self._clear_all_widgets()
        
        if self.abteilungs_filter == "Alle":
            alle_stats = self.data_manager.get_alle_statistiken()
            
            # Nach Abteilung gruppieren
            abteilungen = {}
            for stat in alle_stats:
                abt = stat.mitarbeiter.abteilung or "Keine Abteilung"
                if abt not in abteilungen:
                    abteilungen[abt] = []
                abteilungen[abt].append(stat)
            
            sortierte_abteilungen = sorted(abteilungen.keys())
            
            # Flache Liste mit Markern
            self.aktuelle_stats = []
            for abteilung in sortierte_abteilungen:
                marker = type('obj', (object,), {
                    'is_abteilung_header': True,
                    'abteilung': abteilung,
                    'anzahl': len(abteilungen[abteilung])
                })()
                self.aktuelle_stats.append(marker)
                
                mitarbeiter = sorted(abteilungen[abteilung], 
                                   key=lambda s: s.mitarbeiter.name)
                self.aktuelle_stats.extend(mitarbeiter)
        else:
            # ✅ FIXED: Nur gefilterte Abteilung ohne Header
            self.aktuelle_stats = self.data_manager.get_alle_statistiken(
                abteilung=self.abteilungs_filter
            )
        
        self._render_rows()

    def _clear_all_widgets(self):
        """✅ NEU: Löscht alle vorhandenen Widgets komplett"""
        for widget_dict in self.row_widgets:
            if 'frame' in widget_dict and widget_dict['frame'].winfo_exists():
                widget_dict['frame'].destroy()
        
        self.row_widgets.clear()
        self.visible_count = 0

    def _render_rows(self):
        """✅ FIXED: Rendert Zeilen - erstellt nur benötigte Widgets"""
        anzahl = len(self.aktuelle_stats)
        
        # Erstelle nur so viele Widgets wie nötig
        for idx in range(anzahl):
            item = self.aktuelle_stats[idx]
            widgets = self._create_row_widget(idx)
            
            if not hasattr(item, 'mitarbeiter'):
                self._update_abteilung_header(widgets, item, idx)
            else:
                self._update_row_content(widgets, item, idx)
        
        self.visible_count = anzahl
    
    def _create_row_widget(self, index: int) -> Dict:
        """✅ FIXED: Erstellt Widget-Zeile nur wenn nötig"""
        bg_color = "#1f1f1f" if index % 2 == 0 else "#242424"
        
        row_frame = ctk.CTkFrame(
            self.scroll_frame,
            corner_radius=0,
            height=self.ROW_HEIGHT,
            fg_color=bg_color
        )
        row_frame.pack(fill="x", padx=0, pady=0)
        row_frame.pack_propagate(False)
        
        for i in range(9):
            row_frame.columnconfigure(i, weight=1, uniform="cols")
        
        widgets = {
            'frame': row_frame,
            'bg_color': bg_color,
            'current_stat_id': None
        }
        
        # Labels erstellen
        widgets['name'] = ctk.CTkLabel(
            row_frame, text="", font=self._font_normal,
            anchor="w", cursor="hand2"
        )
        widgets['name'].grid(row=0, column=0, padx=8, pady=0, sticky="nsew")
        
        widgets['abteilung'] = ctk.CTkLabel(
            row_frame, text="", font=self._font_bold, anchor="w"
        )
        widgets['abteilung'].grid(row=0, column=1, padx=8, pady=0, sticky="nsew")
        
        widgets['jahr'] = ctk.CTkLabel(
            row_frame, text="", font=self._font_normal, anchor="center"
        )
        widgets['jahr'].grid(row=0, column=2, padx=4, pady=0, sticky="nsew")
        
        for key, col in [
            ('uebertrag', 3), ('genommen', 4), ('verbleibend', 5), ('krank', 6),
            ('schulung', 7), ('ueberstunden', 8)
        ]:
            widgets[key] = ctk.CTkLabel(
                row_frame, text="", font=self._font_normal,
                anchor="center", cursor="hand2"
            )
            widgets[key].grid(row=0, column=col, padx=4, pady=0, sticky="nsew")
        
        self.row_widgets.append(widgets)
        return widgets

    def _update_abteilung_header(self, widgets: Dict, marker, index: int):
        """Rendert Abteilungs-Header"""
        # ✅ FIX: Verwende dynamische Farben aus DB
        farbe = self.abteilungs_farben.get(marker.abteilung, "#7f8c8d")
        
        widgets['frame'].configure(fg_color=farbe, height=50)
        widgets['bg_color'] = farbe
        
        for key in ['abteilung', 'jahr', 'uebertrag', 'genommen', 'verbleibend', 'krank', 'schulung', 'ueberstunden']:
            widgets[key].grid_remove()
        
        widgets['name'].grid()
        widgets['name'].configure(
            text=marker.abteilung,
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="white",
            cursor=""
        )
        
        widgets['name'].unbind("<Button-1>")
        widgets['current_stat_id'] = f"header_{marker.abteilung}"

    def _update_row_content(self, widgets: Dict, stat: MitarbeiterStatistik, index: int):
        """Aktualisiert Zeilen-Inhalt"""
        expected_bg = "#1f1f1f" if index % 2 == 0 else "#242424"
        if widgets['bg_color'] != expected_bg:
            widgets['frame'].configure(fg_color=expected_bg, height=self.ROW_HEIGHT)
            widgets['bg_color'] = expected_bg
        
        # Alle Labels sichtbar machen
        widgets['name'].grid()
        for key in ['abteilung', 'jahr', 'uebertrag', 'genommen', 'verbleibend', 'krank', 'schulung', 'ueberstunden']:
            widgets[key].grid()
        
        # Text-Updates
        widgets['name'].configure(
            text=stat.mitarbeiter.name,
            font=self._font_normal,
            text_color="white",
            cursor="hand2"
        )

        # ✅ FIX: Verwende dynamische Farben aus DB
        abt_farbe = self.abteilungs_farben.get(stat.mitarbeiter.abteilung, "#7f8c8d")
        widgets['abteilung'].configure(
            text=stat.mitarbeiter.abteilung or "-",
            text_color=abt_farbe
        )
        
        widgets['jahr'].configure(text=str(stat.mitarbeiter.urlaubstage_jahr))
        
        # Übertrag
        from datetime import date
        heute = date.today()
        verfallsdatum = date(self.data_manager.aktuelles_jahr, 3, 31)
        
        if stat.uebertrag_vorjahr > 0:
            if heute <= verfallsdatum:
                widgets['uebertrag'].configure(
                    text=f"+{stat.uebertrag_vorjahr:.0f}",
                    text_color="#27ae60"
                )
            else:
                widgets['uebertrag'].configure(
                    text=f"({stat.uebertrag_vorjahr:.0f})",
                    text_color="#7f8c8d"
                )
        else:
            widgets['uebertrag'].configure(text="-", text_color="#7f8c8d")
        
        widgets['genommen'].configure(text=f"{stat.urlaub_genommen:.0f}")
        widgets['verbleibend'].configure(text=f"{stat.verbleibende_urlaubstage:.0f}")
        widgets['krank'].configure(text=f"{stat.krankheitstage:.0f}")
        widgets['schulung'].configure(text=f"{stat.schulungstage:.0f}")
        widgets['ueberstunden'].configure(text=f"{stat.ueberstunden:.2f}h")
        
        # Bindings
        stat_id = stat.mitarbeiter.id
        if widgets['current_stat_id'] != stat_id:
            for widget in ['name', 'uebertrag', 'genommen', 'verbleibend', 'krank', 'schulung', 'ueberstunden']:
                widgets[widget].unbind("<Button-1>")
            
            widgets['name'].bind("<Button-1>", lambda e, s=stat: self._mitarbeiter_details(s))
            widgets['uebertrag'].bind("<Button-1>", lambda e, s=stat: self._zeige_uebertrag_info(s))
            widgets['genommen'].bind("<Button-1>", lambda e, s=stat: self._neuer_eintrag("urlaub", s))
            widgets['verbleibend'].bind("<Button-1>", lambda e, s=stat: self._neuer_eintrag("urlaub", s))
            widgets['krank'].bind("<Button-1>", lambda e, s=stat: self._neuer_eintrag("krank", s))
            widgets['schulung'].bind("<Button-1>", lambda e, s=stat: self._neuer_eintrag("schulung", s))
            widgets['ueberstunden'].bind("<Button-1>", lambda e, s=stat: self._neuer_eintrag("ueberstunden", s))
            
            widgets['current_stat_id'] = stat_id
    
    def _zeige_uebertrag_info(self, stat: MitarbeiterStatistik):
        """Zeigt Info über Urlaubsübertrag"""
        from datetime import date

        if stat.uebertrag_vorjahr <= 0:
            show_info(
                f"{stat.mitarbeiter.name} hat keinen Urlaubsübertrag aus dem Vorjahr.",
                title="Kein Übertrag",
                duration=4000
            )
            return

        heute = date.today()
        jahr = self.data_manager.aktuelles_jahr
        verfallsdatum = date(jahr, 3, 31)

        if heute <= verfallsdatum:
            tage_bis_verfall = (verfallsdatum - heute).days
            show_info(
                f"{stat.mitarbeiter.name}\n"
                f"Übertrag aus Vorjahr: {stat.uebertrag_vorjahr:.1f} Tage\n"
                f"Verfallsdatum: 31. März {jahr}\n"
                f"Noch {tage_bis_verfall} Tage bis zum Verfall!",
                title="Urlaubsübertrag",
                duration=5000
            )
        else:
            show_warning(
                f"{stat.mitarbeiter.name}\n"
                f"Der Übertrag von {stat.uebertrag_vorjahr:.1f} Tagen ist am 31. März {jahr} verfallen.",
                title="Übertrag verfallen",
                duration=6000
            )
    
    def _mitarbeiter_details(self, stat: MitarbeiterStatistik):
        """✅ GEÄNDERT: Öffnet Detailansicht + triggert Update"""
        from gui.dialogs.mitarbeiter_tabelle.mitarbeiter_details_dialog import MitarbeiterDetailsDialog
        
        dialog = MitarbeiterDetailsDialog(self.winfo_toplevel(), stat, self.data_manager)
        self.wait_window(dialog)
        
        self.aktualisiere_tabelle()

    def _neuer_eintrag(self, typ: str, stat: MitarbeiterStatistik):
        """✅ GEÄNDERT: Öffnet Dialog für neuen Eintrag + triggert Update"""
        if typ == "ueberstunden":
            from gui.dialogs.mitarbeiter_tabelle.ueberstunden_dialog import UeberstundenDialog
            dialog = UeberstundenDialog(self.winfo_toplevel(), stat, self.data_manager)
        elif typ == "schulung":
            from gui.dialogs.mitarbeiter_tabelle.schulung_dialog import SchulungDialog
            dialog = SchulungDialog(self.winfo_toplevel(), stat, self.data_manager)
        elif typ == "krank":
            from gui.dialogs.mitarbeiter_tabelle.krank_dialog import KrankDialog
            dialog = KrankDialog(self.winfo_toplevel(), stat, self.data_manager)
        elif typ == "urlaub":
            from gui.dialogs.mitarbeiter_tabelle.urlaub_dialog import UrlaubDialog
            dialog = UrlaubDialog(self.winfo_toplevel(), stat, self.data_manager)
        else:
            import tkinter.messagebox as messagebox
            messagebox.showerror(
                "Fehler",
                f"Unbekannter Eintrag-Typ: {typ}",
                parent=self.winfo_toplevel()
            )
            return
        
        self.wait_window(dialog)
        
        if dialog.result:
            # ✅ FIX: Cache EXPLIZIT invalidieren
            self.data_manager._invalidate_cache()
            
            # ✅ FIX: Tabelle komplett neu laden
            self.aktualisiere_tabelle()