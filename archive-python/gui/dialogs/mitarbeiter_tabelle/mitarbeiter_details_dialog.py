"""
Mitarbeiter-Details-Dialog mit Von-Bis-Anzeige + Bearbeiten/Löschen
✅ V2: Erweiterte Überstunden-Anzeige mit Aufbau/Abbau
✅ Zeigt Zeitraum bei Urlaub/Krank/Schulung an
✅ Zeigt Titel bei Schulungen an
✅ Bearbeiten und Löschen von Einträgen
✅ Aktualisiert Statistik-Cards nach Änderungen
✅ Klickbare Statistik-Cards zum direkten Erstellen von Einträgen
✅ Optimiertes Design mit dezenteren Buttons
✅ Notification-System für Feedback
✅ Zeigt nur Einträge des aktuellen Jahres
✅ FIXED: Header wird nach Bearbeitung aktualisiert
✅ NEU: Überstunden mit Aufbau/Abbau-Details
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from models.mitarbeiter import MitarbeiterStatistik
from models.data_manager_v3 import TeamplannerDataManager
import pandas as pd
from datetime import timedelta


class MitarbeiterDetailsDialog(ctk.CTkToplevel):
    """Dialog mit Lazy Loading + Bearbeiten/Löschen + Klickbare Stats + Notifications + Überstunden V2"""

    ABTEILUNGS_FARBEN = {
        "Werkstatt": "#e67e22",
        "Verkauf": "#3498db",
        "Service": "#9b59b6",
        "Buchhaltung": "#27ae60",
        "Geschäftsleitung": "#e74c3c",
    }

    TYP_FARBEN = {
        "urlaub": "#27ae60",
        "krank": "#e74c3c",
        "schulung": "#3498db",
        "ueberstunden": "#e67e22",
    }

    TYP_NAMEN = {
        "urlaub": "Urlaub",
        "krank": "Krank",
        "schulung": "Schulung",
        "ueberstunden": "Überstunden",
    }

    def __init__(self, parent, stat: MitarbeiterStatistik, data_manager: TeamplannerDataManager):
        super().__init__(parent)
        self.stat = stat
        self.data_manager = data_manager

        self._font_header = ctk.CTkFont(size=22, weight="bold")
        self._font_subheader = ctk.CTkFont(size=13, weight="bold")
        self._font_normal = ctk.CTkFont(size=11)
        self._font_small = ctk.CTkFont(size=10)
        self._font_stat_label = ctk.CTkFont(size=10)
        self._font_stat_value = ctk.CTkFont(size=18, weight="bold")

        # ✅ Titel zeigt jetzt auch das Jahr
        self.title(f"Details: {stat.mitarbeiter.name} - {data_manager.aktuelles_jahr}")
        self.resizable(True, True)
        self.minsize(1000, 560)

        self.transient(parent)
        self.grab_set()

        # Notification-System für diesen Dialog initialisieren
        from gui.notification_manager import NotificationManager
        self.notification_manager = NotificationManager(self)

        self._setup_gui()

        self.update_idletasks()
        self._resize_to_content()
        self._center_window()

        self.after(50, self._load_entries_lazy)

        self.bind("<Escape>", lambda e: self.destroy())

    def _resize_to_content(self):
        self.update_idletasks()
        req_w = max(self.winfo_reqwidth(), 1000)
        req_h = max(self.winfo_reqheight(), 560)
        max_w = int(self.winfo_screenwidth() * 0.92)
        max_h = int(self.winfo_screenheight() * 0.92)
        self.geometry(f"{min(req_w, max_w)}x{min(req_h, max_h)}")

    def _center_window(self):
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    def _setup_gui(self):
        # Header höher gemacht (70px statt 52px)
        self.header = ctk.CTkFrame(self, fg_color="#1f538d", height=70, corner_radius=0)
        self.header.pack(fill="x")
        self.header.pack_propagate(False)

        self.header_content = ctk.CTkFrame(self.header, fg_color="transparent")
        self.header_content.pack(fill="both", expand=True, padx=24, pady=12)

        # Name und Bearbeiten-Button in einer Zeile
        top_row = ctk.CTkFrame(self.header_content, fg_color="transparent")
        top_row.pack(fill="x", anchor="w")

        # Name links
        self.name_label = ctk.CTkLabel(
            top_row, 
            text=self.stat.mitarbeiter.name, 
            font=self._font_header, 
            text_color="white"
        )
        self.name_label.pack(side="left")

        # Bearbeiten-Button rechts, klein und dezent (nur Icon)
        ctk.CTkButton(
            top_row,
            text="✏",
            width=32,
            height=32,
            command=self.mitarbeiter_bearbeiten,
            fg_color="#2980b9",
            hover_color="#3498db",
            font=ctk.CTkFont(size=14),
            corner_radius=6
        ).pack(side="right", padx=(10, 0))

        # ✅ Jahr-Badge neben dem Namen
        jahr_badge = ctk.CTkLabel(
            top_row,
            text=str(self.data_manager.aktuelles_jahr),
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="white",
            fg_color="#2980b9",
            corner_radius=6,
            padx=10,
            pady=4
        )
        jahr_badge.pack(side="left", padx=(15, 0))

        # Abteilung darunter
        abt_farbe = self.ABTEILUNGS_FARBEN.get(self.stat.mitarbeiter.abteilung, "#7f8c8d")
        self.abteilung_label = ctk.CTkLabel(
            self.header_content, 
            text=self.stat.mitarbeiter.abteilung, 
            font=self._font_subheader, 
            text_color=abt_farbe
        )
        self.abteilung_label.pack(anchor="w", pady=(5, 0))

        # Stats Frame (speichern als Instanzvariable für Updates)
        self.stats_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.stats_frame.pack(fill="x", padx=24, pady=14)
        for i in range(5):
            self.stats_frame.columnconfigure(i, weight=1)

        # Erstelle klickbare Statistik-Cards
        self._create_clickable_stat_card(
            self.stats_frame,
            "Genommen",
            f"{self.stat.urlaub_genommen:.0f}",
            "#27ae60",
            0,
            lambda: self._neuer_eintrag("urlaub")
        )

        self._create_clickable_stat_card(
            self.stats_frame,
            "Verbleibend",
            f"{self.stat.verbleibende_urlaubstage:.0f}",
            self.stat.status_farbe,
            1,
            lambda: self._neuer_eintrag("urlaub")
        )

        self._create_clickable_stat_card(
            self.stats_frame,
            "Krankheitstage",
            f"{self.stat.krankheitstage:.0f}",
            "#e74c3c",
            2,
            lambda: self._neuer_eintrag("krank")
        )

        self._create_clickable_stat_card(
            self.stats_frame,
            "Schulungstage",
            f"{self.stat.schulungstage:.0f}",
            "#3498db",
            3,
            lambda: self._neuer_eintrag("schulung")
        )
        
        # ✅ NEU: Erweiterte Überstunden-Card mit Aufbau/Abbau-Details
        self._create_ueberstunden_card()
        
        # ✅ Einträge Label mit Jahr
        eintraege_header = ctk.CTkFrame(self, fg_color="transparent")
        eintraege_header.pack(fill="x", padx=24, pady=(6, 8))
        
        ctk.CTkLabel(
            eintraege_header, 
            text="Alle Einträge", 
            font=ctk.CTkFont(size=16, weight="bold")
        ).pack(side="left")
        
        ctk.CTkLabel(
            eintraege_header,
            text=f"({self.data_manager.aktuelles_jahr})",
            font=ctk.CTkFont(size=12),
            text_color="#7f8c8d"
        ).pack(side="left", padx=(8, 0))

        # Tabelle-Container
        self.table_container = ctk.CTkFrame(self, fg_color="transparent")
        self.table_container.pack(fill="both", expand=True, padx=24, pady=(0, 12))

        self.loading_label = ctk.CTkLabel(self.table_container, text="Lade Einträge …",
                                          font=self._font_normal, text_color="#95a5a6")
        self.loading_label.pack(pady=16)

        # Nur noch Schließen-Button (Bearbeiten ist jetzt im Header)
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill="x", padx=24, pady=(0, 16))

        ctk.CTkButton(
            btn_frame,
            text="Schließen",
            command=self.destroy,
            height=36,
            fg_color="gray",
            hover_color="#555555"
        ).pack(fill="x")

    def _create_clickable_stat_card(self, parent, titel, wert, farbe, column, click_callback=None):
        """Erstellt klickbare Statistik-Card"""
        # Bestimme Cursor und Hover-Farbe
        cursor = "hand2" if click_callback else ""
        # Hover-Effekt transparenter (nur 5% dunkler statt 15%)
        hover_color = self._lighten_color(farbe, factor=0.95) if click_callback else None
        
        # Card Frame
        card = ctk.CTkFrame(parent, fg_color="#2b2b2b", corner_radius=8)
        card.grid(row=0, column=column, padx=5, sticky="ew")
        
        # Hover-Effekt wenn klickbar
        if click_callback:
            original_color = "#2b2b2b"
            
            def on_enter(e):
                card.configure(fg_color=hover_color)
            
            def on_leave(e):
                card.configure(fg_color=original_color)
            
            card.bind("<Enter>", on_enter)
            card.bind("<Leave>", on_leave)
            card.bind("<Button-1>", lambda e: click_callback())
            card.configure(cursor=cursor)
        
        # Label Container (damit auch Labels klickbar sind)
        label_container = ctk.CTkFrame(card, fg_color="transparent")
        label_container.pack(fill="both", expand=True, pady=(10, 10))
        
        # Titel Label
        titel_label = ctk.CTkLabel(
            label_container, 
            text=titel, 
            font=self._font_stat_label, 
            text_color="#95a5a6"
        )
        titel_label.pack(pady=(0, 2))
        
        # Wert Label
        wert_label = ctk.CTkLabel(
            label_container, 
            text=wert, 
            font=self._font_stat_value, 
            text_color=farbe
        )
        wert_label.pack(pady=(0, 0))
        
        # Labels auch klickbar machen
        if click_callback:
            for widget in [label_container, titel_label, wert_label]:
                widget.configure(cursor=cursor)
                widget.bind("<Button-1>", lambda e: click_callback())
                
                # Hover-Effekt auch für Labels
                widget.bind("<Enter>", lambda e: card.configure(fg_color=hover_color))
                widget.bind("<Leave>", lambda e: card.configure(fg_color="#2b2b2b"))
    
    def _create_ueberstunden_card(self):
        """✅ NEU: Erstellt erweiterte Überstunden-Card mit Aufbau/Abbau-Details"""
        ueberstunden_gesamt = self.stat.ueberstunden
        
        # Hole Details für Aufbau/Abbau
        try:
            ueberstunden_liste = self.data_manager.db.ueberstunden.get_all(
                mitarbeiter_id=self.stat.mitarbeiter.id,
                jahr=self.data_manager.aktuelles_jahr
            )
            
            aufbau = sum(ue.stunden for ue in ueberstunden_liste if ue.stunden > 0)
            abbau = sum(abs(ue.stunden) for ue in ueberstunden_liste if ue.stunden < 0)
        except:
            aufbau = ueberstunden_gesamt if ueberstunden_gesamt > 0 else 0
            abbau = 0
        
        # Bestimme Cursor und Hover-Farbe (Card ist klickbar)
        cursor = "hand2"
        original_color = "#2b2b2b"
        hover_color = self._lighten_color("#e67e22", factor=0.95)
        
        # Card Frame
        card = ctk.CTkFrame(self.stats_frame, fg_color="#2b2b2b", corner_radius=8)
        card.grid(row=0, column=5, padx=5, sticky="ew")
        
        # Hover-Effekt
        def on_enter(e):
            card.configure(fg_color=hover_color)
        
        def on_leave(e):
            card.configure(fg_color=original_color)
        
        def on_click(e=None):
            self._neuer_eintrag("ueberstunden")
        
        card.bind("<Enter>", on_enter)
        card.bind("<Leave>", on_leave)
        card.bind("<Button-1>", on_click)
        card.configure(cursor=cursor)
        
        # Label Container
        label_container = ctk.CTkFrame(card, fg_color="transparent")
        label_container.pack(fill="both", expand=True, pady=(10, 10))
        
        # Titel Label
        titel_label = ctk.CTkLabel(
            label_container, 
            text="Überstunden", 
            font=self._font_stat_label, 
            text_color="#95a5a6"
        )
        titel_label.pack(pady=(0, 2))
        
        # Wert Label - Mehrzeilig wenn Details vorhanden
        if aufbau > 0 or abbau > 0:
            # Gesamt
            wert_label = ctk.CTkLabel(
                label_container, 
                text=f"{ueberstunden_gesamt:.1f}h", 
                font=self._font_stat_value, 
                text_color="#e67e22"
            )
            wert_label.pack(pady=(0, 2))
            
            # Details
            detail_text = f"(+{aufbau:.1f} / -{abbau:.1f})"
            detail_label = ctk.CTkLabel(
                label_container,
                text=detail_text,
                font=ctk.CTkFont(size=10),
                text_color="#95a5a6"
            )
            detail_label.pack()
            
            # Details auch klickbar machen
            detail_label.configure(cursor=cursor)
            detail_label.bind("<Button-1>", on_click)
            detail_label.bind("<Enter>", lambda e: card.configure(fg_color=hover_color))
            detail_label.bind("<Leave>", lambda e: card.configure(fg_color=original_color))
        else:
            wert_label = ctk.CTkLabel(
                label_container, 
                text=f"{ueberstunden_gesamt:.1f}h", 
                font=self._font_stat_value, 
                text_color="#e67e22"
            )
            wert_label.pack(pady=(0, 0))
        
        # Labels klickbar machen
        for widget in [label_container, titel_label, wert_label]:
            widget.configure(cursor=cursor)
            widget.bind("<Button-1>", on_click)
            widget.bind("<Enter>", lambda e: card.configure(fg_color=hover_color))
            widget.bind("<Leave>", lambda e: card.configure(fg_color=original_color))
    
    def _lighten_color(self, hex_color: str, factor: float = 0.95) -> str:
        """Macht Farbe subtiler dunkler für Hover-Effekt"""
        hex_color = hex_color.lstrip('#')
        r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        
        # Nur leicht abdunkeln (95% statt 85%)
        r = max(0, int(r * factor))
        g = max(0, int(g * factor))
        b = max(0, int(b * factor))
        
        return f"#{r:02x}{g:02x}{b:02x}"

    def _load_entries_lazy(self):
        self.loading_label.destroy()
        self._create_eintrage_tabelle()

    def _create_eintrage_tabelle(self):
        # Header mit 8 Spalten (Von, Bis, Typ, Tage, Titel, Notiz, Erfasst, Aktionen)
        header_frame = ctk.CTkFrame(self.table_container, fg_color="#2b2b2b", height=38)
        header_frame.pack(fill="x", pady=(0, 1))
        header_frame.pack_propagate(False)

        for i in range(8):
            header_frame.columnconfigure(i, weight=1, uniform="cols")

        headers = ["Von", "Bis", "Typ", "Tage", "Titel", "Notiz", "Erfasst", "Aktionen"]
        for col, text in enumerate(headers):
            ctk.CTkLabel(header_frame, text=text, font=ctk.CTkFont(size=11, weight="bold"), text_color="white"
                         ).grid(row=0, column=col, padx=4, pady=6, sticky="nsew")

        scroll = ctk.CTkScrollableFrame(self.table_container, fg_color="transparent")
        scroll.pack(fill="both", expand=True)

        eintraege = self._get_mitarbeiter_eintraege()
        if not eintraege:
            # ✅ Keine Einträge - zeige Hinweis mit Jahr
            no_data_frame = ctk.CTkFrame(scroll, fg_color="transparent")
            no_data_frame.pack(pady=30)
            
            ctk.CTkLabel(
                no_data_frame, 
                text="📋", 
                font=ctk.CTkFont(size=48)
            ).pack()
            
            ctk.CTkLabel(
                no_data_frame,
                text=f"Keine Einträge für {self.data_manager.aktuelles_jahr}",
                font=ctk.CTkFont(size=14, weight="bold"),
                text_color="#95a5a6"
            ).pack(pady=(10, 5))
            
            ctk.CTkLabel(
                no_data_frame,
                text="Klicken Sie auf eine Statistik-Card oben, um einen Eintrag zu erstellen",
                font=ctk.CTkFont(size=11),
                text_color="#7f8c8d"
            ).pack()
        else:
            self._render_entries_batch(scroll, eintraege, 0)

    def _render_entries_batch(self, parent, eintraege, start_idx, batch_size=24):
        end = min(start_idx + batch_size, len(eintraege))
        for idx in range(start_idx, end):
            self._create_eintrag_row(parent, idx, eintraege[idx])
        if end < len(eintraege):
            self.after(10, lambda: self._render_entries_batch(parent, eintraege, end, batch_size))

    def _get_mitarbeiter_eintraege(self):
        """✅ FIXED: Holt Einträge aus V3-Repositories"""
        items = []
        
        # ✅ V3: Hole Einträge aus allen Repositories
        jahr = self.data_manager.aktuelles_jahr
        
        # Urlaub
        urlaube = self.data_manager.db.urlaub.get_all(
            mitarbeiter_id=self.stat.mitarbeiter.id,
            jahr=jahr
        )
        for u in urlaube:
            items.append({
                'id': u.id,
                'mitarbeiter_id': u.mitarbeiter_id,
                'datum': u.von_datum.strftime('%Y-%m-%d'),
                'typ': 'urlaub',
                'wert': u.tage,
                'titel': '',
                'beschreibung': u.notiz or '',
                'erfasst_am': u.erfasst_am.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        # Krankheit
        krankheiten = self.data_manager.db.krankheit.get_all(
            mitarbeiter_id=self.stat.mitarbeiter.id,
            jahr=jahr
        )
        for k in krankheiten:
            items.append({
                'id': k.id,
                'mitarbeiter_id': k.mitarbeiter_id,
                'datum': k.von_datum.strftime('%Y-%m-%d'),
                'typ': 'krank',
                'wert': k.tage,
                'titel': '',
                'beschreibung': k.notiz or '',
                'erfasst_am': k.erfasst_am.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        # Schulung
        schulungen = self.data_manager.db.schulung.get_all(
            mitarbeiter_id=self.stat.mitarbeiter.id,
            jahr=jahr
        )
        for s in schulungen:
            items.append({
                'id': s.id,
                'mitarbeiter_id': s.mitarbeiter_id,
                'datum': s.datum.strftime('%Y-%m-%d'),
                'typ': 'schulung',
                'wert': s.dauer_tage,
                'titel': s.titel or '',
                'beschreibung': s.notiz or '',
                'erfasst_am': s.erfasst_am.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        # Überstunden
        ueberstunden = self.data_manager.db.ueberstunden.get_all(
            mitarbeiter_id=self.stat.mitarbeiter.id,
            jahr=jahr
        )
        for ue in ueberstunden:
            items.append({
                'id': ue.id,
                'mitarbeiter_id': ue.mitarbeiter_id,
                'datum': ue.datum.strftime('%Y-%m-%d'),
                'typ': 'ueberstunden',
                'wert': ue.stunden,
                'titel': '',
                'beschreibung': ue.notiz or '',
                'erfasst_am': ue.erfasst_am.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        # Sortiere nach Datum (neueste zuerst)
        items = sorted(items, key=lambda x: x['datum'], reverse=True)
        
        return items
    
    def _create_eintrag_row(self, parent, index, e):
        bg = "#1f1f1f" if index % 2 == 0 else "#242424"
        row = ctk.CTkFrame(parent, corner_radius=0, height=40, fg_color=bg)
        row.pack(fill="x")
        row.pack_propagate(False)
        for i in range(8):
            row.columnconfigure(i, weight=1, uniform="cols")

        # Von-Datum
        try:
            von_datum = pd.to_datetime(e["datum"])
            von_str = von_datum.strftime("%d.%m.%Y")
        except Exception:
            von_str = e.get("datum", "-")
        
        ctk.CTkLabel(row, text=von_str, font=self._font_normal, anchor="center"
                     ).grid(row=0, column=0, padx=4, sticky="nsew")

        # Bis-Datum
        typ = e.get("typ", "-")
        wert = e.get("wert", 0)
        
        bis_str = "-"
        if typ in ["urlaub", "krank", "schulung"] and wert > 0:
            try:
                von_date = pd.to_datetime(e["datum"]).date()
                bis_date = von_date + timedelta(days=int(wert) - 1)
                bis_str = bis_date.strftime("%d.%m.%Y")
            except Exception:
                bis_str = "-"
        
        ctk.CTkLabel(row, text=bis_str, font=self._font_normal, anchor="center", text_color="#95a5a6"
                     ).grid(row=0, column=1, padx=4, sticky="nsew")

        # Typ
        ctk.CTkLabel(row, text=self.TYP_NAMEN.get(typ, typ), font=ctk.CTkFont(size=11, weight="bold"),
                     text_color=self.TYP_FARBEN.get(typ, "#95a5a6"), anchor="center"
                     ).grid(row=0, column=2, padx=4, sticky="nsew")

        # ✅ ERWEITERT: Wert mit Vorzeichen bei Überstunden
        if typ == "ueberstunden":
            # Zeige Vorzeichen explizit
            if wert > 0:
                wert_txt = f"+{wert:.1f}h"
                wert_farbe = "#27ae60"  # Grün für Aufbau
            elif wert < 0:
                wert_txt = f"{wert:.1f}h"  # Negativ-Zeichen ist schon da
                wert_farbe = "#e74c3c"  # Rot für Abbau
            else:
                wert_txt = "0.0h"
                wert_farbe = "#7f8c8d"
            
            wert_label = ctk.CTkLabel(
                row, text=wert_txt, 
                font=self._font_normal, 
                text_color=wert_farbe,
                anchor="center"
            )
            wert_label.grid(row=0, column=3, padx=4, sticky="nsew")
        else:
            # Normale Anzeige für andere Typen
            wert_txt = f"{wert:.0f}"
            ctk.CTkLabel(row, text=wert_txt, font=self._font_normal, anchor="center"
                         ).grid(row=0, column=3, padx=4, sticky="nsew")

        # Titel
        titel = (e.get("titel") or "").strip() or "-"
        if len(titel) > 25:
            titel = titel[:22] + "…"
        ctk.CTkLabel(row, text=titel, font=self._font_small, text_color="#95a5a6", anchor="w"
                     ).grid(row=0, column=4, padx=8, sticky="nsew")

        # Notiz
        notiz = (e.get("beschreibung") or "").strip() or "-"
        if len(notiz) > 25:
            notiz = notiz[:22] + "…"
        ctk.CTkLabel(row, text=notiz, font=self._font_small, text_color="#95a5a6", anchor="w"
                     ).grid(row=0, column=5, padx=8, sticky="nsew")

        # Erfasst am
        erfasst = e.get("erfasst_am", "-")
        try:
            erfasst = pd.to_datetime(erfasst).strftime("%d.%m.%Y")
        except Exception:
            pass
        ctk.CTkLabel(row, text=erfasst, font=ctk.CTkFont(size=9), text_color="#7f8c8d", anchor="center"
                     ).grid(row=0, column=6, padx=4, sticky="nsew")

        # Aktionen - dezentere Buttons
        btn_container = ctk.CTkFrame(row, fg_color="transparent")
        btn_container.grid(row=0, column=7, padx=4, sticky="nsew")
        
        btn_inner = ctk.CTkFrame(btn_container, fg_color="transparent")
        btn_inner.pack(expand=True)
        
        # Bearbeiten Button - dezenter
        ctk.CTkButton(
            btn_inner,
            text="✏",
            width=28,
            height=24,
            fg_color="#34495e",
            hover_color="#3498db",
            font=ctk.CTkFont(size=12),
            corner_radius=4,
            command=lambda eintrag=e: self._bearbeiten_eintrag(eintrag)
        ).pack(side="left", padx=2)
        
        # Löschen Button - dezenter
        ctk.CTkButton(
            btn_inner,
            text="✕",
            width=28,
            height=24,
            fg_color="#34495e",
            hover_color="#e74c3c",
            text_color="#95a5a6",
            font=ctk.CTkFont(size=12, weight="bold"),
            corner_radius=4,
            command=lambda eintrag=e: self._loeschen_eintrag(eintrag)
        ).pack(side="left", padx=2)

    def _bearbeiten_eintrag(self, eintrag):
        """Öffnet Bearbeiten-Dialog mit Notification"""
        from gui.dialogs.mitarbeiter_tabelle.eintrag_bearbeiten_dialog import EintragBearbeitenDialog
        
        dialog = EintragBearbeitenDialog(self, eintrag, self.data_manager)
        self.wait_window(dialog)
        
        if dialog.result:
            # Cache invalidieren und Statistiken neu laden
            self.data_manager._invalidate_cache()
            self.stat = self.data_manager.get_mitarbeiter_statistik(self.stat.mitarbeiter.id)
            
            # Statistik-Cards aktualisieren
            self._update_stat_cards()
            
            # Tabelle neu laden
            self._refresh_table()
            
            # Notification anzeigen
            typ_name = self.TYP_NAMEN.get(eintrag['typ'], 'Eintrag')
            try:
                datum = pd.to_datetime(eintrag['datum']).strftime("%d.%m.%Y")
            except:
                datum = eintrag.get('datum', '?')
            
            self.notification_manager.show(
                f"{typ_name} vom {datum} wurde aktualisiert!",
                typ=self.notification_manager.SUCCESS,
                title="Eintrag bearbeitet",
                duration=4000
            )

    def _loeschen_eintrag(self, eintrag):
        """Löscht Eintrag mit Notification statt MessageBox"""
        # Typ-Name
        typ_name = self.TYP_NAMEN.get(eintrag['typ'], 'Eintrag')
        
        # Datum formatieren
        try:
            datum = pd.to_datetime(eintrag['datum']).strftime("%d.%m.%Y")
        except:
            datum = eintrag.get('datum', '?')
        
        # Bestätigung bleibt als Dialog (wichtig für kritische Aktion)
        antwort = messagebox.askyesno(
            "Eintrag löschen",
            f"{typ_name} vom {datum} wirklich löschen?\n\n"
            f"Wert: {eintrag['wert']}\n"
            f"{'Titel: ' + eintrag.get('titel', '') if eintrag.get('titel') else ''}\n\n"
            f"⚠️ Diese Aktion kann nicht rückgängig gemacht werden!",
            parent=self
        )
        
        if antwort:
            try:
                cursor = self.data_manager.db.conn.cursor()
                cursor.execute("DELETE FROM eintraege WHERE id = ?", (eintrag['id'],))
                self.data_manager.db.conn.commit()
                
                # Cache invalidieren und Statistiken neu laden
                self.data_manager._invalidate_cache()
                self.stat = self.data_manager.get_mitarbeiter_statistik(self.stat.mitarbeiter.id)
                
                # Statistik-Cards aktualisieren
                self._update_stat_cards()
                
                # Tabelle neu laden
                self._refresh_table()
                
                # Notification statt MessageBox
                self.notification_manager.show(
                    f"{typ_name} vom {datum} wurde gelöscht!",
                    typ=self.notification_manager.SUCCESS,
                    title="Eintrag gelöscht",
                    duration=4000
                )
                
            except Exception as e:
                # Fehler-Notification
                self.notification_manager.show(
                    f"Fehler beim Löschen: {str(e)[:100]}",
                    typ=self.notification_manager.ERROR,
                    title="Fehler",
                    duration=6000
                )

    def _neuer_eintrag(self, typ: str):
        """Öffnet Dialog für neuen Eintrag mit Notification"""
        if typ == "ueberstunden":
            from gui.dialogs.mitarbeiter_tabelle.ueberstunden_dialog import UeberstundenDialog
            dialog = UeberstundenDialog(self, self.stat, self.data_manager)
        elif typ == "schulung":
            from gui.dialogs.mitarbeiter_tabelle.schulung_dialog import SchulungDialog
            dialog = SchulungDialog(self, self.stat, self.data_manager)
        elif typ == "krank":
            from gui.dialogs.mitarbeiter_tabelle.krank_dialog import KrankDialog
            dialog = KrankDialog(self, self.stat, self.data_manager)
        elif typ == "urlaub":
            from gui.dialogs.mitarbeiter_tabelle.urlaub_dialog import UrlaubDialog
            dialog = UrlaubDialog(self, self.stat, self.data_manager)
        else:
            self.notification_manager.show(
                f"Unbekannter Eintrag-Typ: {typ}",
                typ=self.notification_manager.ERROR,
                title="Fehler",
                duration=4000
            )
            return
        
        self.wait_window(dialog)
        
        if dialog.result:
            # ✅ FIX: Cache invalidieren und Statistiken neu laden
            self.data_manager._invalidate_cache()
            self.stat = self.data_manager.get_mitarbeiter_statistik(self.stat.mitarbeiter.id)
            
            # ✅ FIX: Statistik-Cards aktualisieren
            self._update_stat_cards()
            
            # ✅ FIX: Tabelle neu laden
            self._refresh_table()

    def _update_stat_cards(self):
        """Aktualisiert die Statistik-Cards mit neuen Werten"""
        # Lösche alte Cards
        for widget in self.stats_frame.winfo_children():
            widget.destroy()
        
        # Erstelle neue Cards mit aktualisierten Werten
        self._create_clickable_stat_card(
            self.stats_frame,
            "Genommen",
            f"{self.stat.urlaub_genommen:.0f}",
            "#27ae60",
            0,
            lambda: self._neuer_eintrag("urlaub")
        )

        self._create_clickable_stat_card(
            self.stats_frame,
            "Verbleibend",
            f"{self.stat.verbleibende_urlaubstage:.0f}",
            self.stat.status_farbe,
            1,
            lambda: self._neuer_eintrag("urlaub")
        )

        self._create_clickable_stat_card(
            self.stats_frame,
            "Krankheitstage",
            f"{self.stat.krankheitstage:.0f}",
            "#e74c3c",
            2,
            lambda: self._neuer_eintrag("krank")
        )

        self._create_clickable_stat_card(
            self.stats_frame,
            "Schulungstage",
            f"{self.stat.schulungstage:.0f}",
            "#3498db",
            3,
            lambda: self._neuer_eintrag("schulung")
        )
        
        # ✅ NEU: Überstunden-Card neu erstellen
        self._create_ueberstunden_card()

    def _refresh_table(self):
        """Lädt Tabelle neu"""
        # Alte Tabelle löschen
        for widget in self.table_container.winfo_children():
            widget.destroy()
        
        # Loading-Label
        self.loading_label = ctk.CTkLabel(
            self.table_container,
            text="Lade Einträge …",
            font=self._font_normal,
            text_color="#95a5a6"
        )
        self.loading_label.pack(pady=16)
        
        # Neu laden (nach kurzer Verzögerung)
        self.after(50, self._load_entries_lazy)

    def mitarbeiter_bearbeiten(self):
        """Öffnet Bearbeitungs-Dialog mit Notification"""
        from gui.dialogs.stammdaten.stammdaten_bearbeiten_dialog import MitarbeiterBearbeitenDialog
        
        # Stammdaten aus data_manager holen
        ma_daten = self.data_manager.stammdaten.get(self.stat.mitarbeiter.id, {})
        
        if not ma_daten:
            # Fehler-Notification
            self.notification_manager.show(
                "Stammdaten nicht gefunden",
                typ=self.notification_manager.ERROR,
                title="Fehler",
                duration=4000
            )
            return
        
        dialog = MitarbeiterBearbeitenDialog(
            self, 
            self.stat.mitarbeiter.id, 
            ma_daten, 
            self.data_manager
        )
        self.wait_window(dialog)
        
        if dialog.result:
            # ✅ V3: Nutze Repository statt alte Methode
            try:
                # Hole Mitarbeiter aus DB
                mitarbeiter = self.data_manager.db.mitarbeiter.get_by_id(self.stat.mitarbeiter.id)
                
                if not mitarbeiter:
                    self.notification_manager.show(
                        "Mitarbeiter nicht gefunden",
                        typ=self.notification_manager.ERROR,
                        title="Fehler",
                        duration=4000
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
                        title="Fehler",
                        duration=4000
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
                
                # In DB aktualisieren
                erfolg = self.data_manager.db.mitarbeiter.update(mitarbeiter)
                
                if erfolg:
                    # Cache aktualisieren
                    self.data_manager.stammdaten[self.stat.mitarbeiter.id] = dialog.result
                    self.data_manager._invalidate_cache()
                    
                    # ✅ FIXED: Statistik neu laden
                    self.stat = self.data_manager.get_mitarbeiter_statistik(self.stat.mitarbeiter.id)
                    
                    # ✅ FIXED: Header aktualisieren (Name + Abteilung)
                    self._update_header()
                    
                    # ✅ FIXED: Stats und Tabelle aktualisieren
                    self._update_stat_cards()
                    self._refresh_table()
                    
                    # Erfolgs-Notification
                    name = f"{dialog.result.get('vorname', '')} {dialog.result.get('nachname', '')}".strip()
                    self.notification_manager.show(
                        f"{name} wurde erfolgreich aktualisiert!",
                        typ=self.notification_manager.SUCCESS,
                        title="Mitarbeiter aktualisiert",
                        duration=4000
                    )
                else:
                    self.notification_manager.show(
                        "Fehler beim Aktualisieren des Mitarbeiters",
                        typ=self.notification_manager.ERROR,
                        title="Fehler",
                        duration=4000
                    )
            
            except Exception as e:
                self.notification_manager.show(
                    f"Fehler: {str(e)}",
                    typ=self.notification_manager.ERROR,
                    title="Fehler",
                    duration=4000
                )
    
    def _update_header(self):
        """✅ NEU: Aktualisiert Header-Informationen direkt"""
        # Name aktualisieren
        self.name_label.configure(text=self.stat.mitarbeiter.name)
        
        # Abteilung aktualisieren
        abt_farbe = self.ABTEILUNGS_FARBEN.get(
            self.stat.mitarbeiter.abteilung, 
            "#7f8c8d"
        )
        self.abteilung_label.configure(
            text=self.stat.mitarbeiter.abteilung,
            text_color=abt_farbe
        )
        
        # Titel aktualisieren
        self.title(f"Details: {self.stat.mitarbeiter.name} - {self.data_manager.aktuelles_jahr}")