"""
Hauptfenster - DYNAMISCHES JAHR-SYSTEM
✅ FIXED: Jahr-Dropdown zeigt IMMER aktuelles Jahr + Jahre mit Einträgen
✅ Kein "Jahr erstellen"-Button
✅ Jahr-Dropdown zeigt automatisch alle Jahre mit Einträgen
✅ Übertrag wird live berechnet
"""

import customtkinter as ctk
import os
from datetime import datetime
from models.data_manager_v3 import TeamplannerDataManager
from gui.components.mitarbeiter_tabelle import MitarbeiterTabelle
from gui.dialogs.stammdaten.stammdaten_hinzufuegen_dialog import StammdatenHinzufuegenDialog
from gui.dialogs.stammdaten.stammdaten_verwalten_dialog import StammdatenVerwaltenDialog
from gui.notification_manager import init_notifications, show_success, show_error, show_info

try:
    from PIL import Image
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False


class TeamplannerHauptfenster:
    """Hauptfenster mit dynamischem Jahr-System"""
    
    def __init__(self):
        self.app = ctk.CTk()
        self.app.title("Teamplanner V3")
        self.app.geometry("1400x800")
        
        # DataManager V3
        self.data_manager = TeamplannerDataManager()
        
        # Notification-System
        self.notification_manager = init_notifications(self.app)
        
        # ✅ GEÄNDERT: Menü OHNE Jahreserstellung
        self._create_menu()
        
        # GUI
        self.setup_gui()
        
        # Icon
        self.app.after(100, self._set_window_icon_async)
        
        # Titel mit Jahr
        self.app.title(f"Teamplanner V3 - {self.data_manager.aktuelles_jahr}")
        
        # Willkommens-Notification
        self.app.after(500, lambda: self._show_welcome_notification())
    
    def _show_welcome_notification(self):
        """Zeigt Willkommens-Notification"""
        db_info = self.data_manager.db.get_database_info()
        
        show_info(
            f"Teamplanner V3 geladen\n"
            f"Jahr: {self.data_manager.aktuelles_jahr}\n"
            f"Mitarbeiter: {db_info['tables']['mitarbeiter']}",
            "Willkommen",
            duration=3000
        )
    
    def _set_window_icon_async(self):
        """Setzt Icon asynchron"""
        import platform
        system = platform.system()
        
        try:
            if system == "Windows":
                if os.path.exists("assets/logo_32.ico"):
                    self.app.iconbitmap("assets/logo_32.ico")
                elif os.path.exists("assets/logo.ico"):
                    self.app.iconbitmap("assets/logo.ico")
            elif system == "Darwin":
                if os.path.exists("assets/logo.icns"):
                    self.app.iconbitmap("assets/logo.icns")
                elif os.path.exists("assets/logo_128.png"):
                    from tkinter import PhotoImage
                    icon = PhotoImage(file="assets/logo_128.png")
                    self.app.iconphoto(True, icon)
            else:  # Linux
                if os.path.exists("assets/logo_64.png"):
                    from tkinter import PhotoImage
                    icon = PhotoImage(file="assets/logo_64.png")
                    self.app.iconphoto(True, icon)
        except Exception as e:
            print(f"⚠️  Icon konnte nicht gesetzt werden: {e}")
    
    def _create_menu(self):
        """✅ GEÄNDERT: Menü OHNE Jahreserstellung"""
        import tkinter as tk

        menubar = tk.Menu(self.app)
        self.app.configure(menu=menubar)

        # Stammdaten-Menü
        stammdaten_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Stammdaten", menu=stammdaten_menu)
        stammdaten_menu.add_command(label="Stammdaten hinzufügen", command=self._stammdaten_hinzufuegen)
        stammdaten_menu.add_command(label="Stammdaten verwalten", command=self._stammdaten_verwalten)

        # Veranstaltungen-Menü
        veranstaltungen_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Veranstaltungen", menu=veranstaltungen_menu)
        veranstaltungen_menu.add_command(label="Veranstaltungen verwalten", command=self._veranstaltungen_verwalten)

        # Feiertage-Menü
        feiertage_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Feiertage", menu=feiertage_menu)
        feiertage_menu.add_command(label="Feiertage verwalten", command=self._feiertage_verwalten)

        # Abteilungen-Menü
        abteilungen_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Abteilungen", menu=abteilungen_menu)
        abteilungen_menu.add_command(label="Abteilungen verwalten", command=self._abteilungen_verwalten)

        # ✅ ENTFERNT: Jahr-Menü (nicht mehr nötig!)
        # ✅ ENTFERNT: Einstellungen-Menü (Kategorien wurden in Abteilungen zusammengefasst)

        # Export-Menü
        export_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Export", menu=export_menu)
        export_menu.add_command(label="Daten exportieren...", command=self._export_daten)
    
    def _stammdaten_hinzufuegen(self):
        """Öffnet Hinzufügen-Dialog"""
        dialog = StammdatenHinzufuegenDialog(self.app, self.data_manager)
        self.app.wait_window(dialog)
        
        if dialog.result:
            ma_id = dialog.result['id']
            daten = {
                'vorname': dialog.result['vorname'],
                'nachname': dialog.result['nachname'],
                'geburtsdatum': dialog.result['geburtsdatum'],
                'einstellungsdatum': dialog.result['einstellungsdatum'],
                'abteilung': dialog.result['abteilung'],
                'kategorie': dialog.result.get('kategorie', 'Standard'),
                'urlaubstage_jahr': dialog.result['urlaubstage_jahr']
            }

            erfolg = self.data_manager.stammdaten_hinzufuegen(ma_id, daten)
            
            if erfolg:
                self._refresh_all()
                
                show_success(
                    f"{dialog.result['vorname']} {dialog.result['nachname']} wurde erfolgreich hinzugefügt!",
                    "Mitarbeiter hinzugefügt"
                )
            else:
                show_error(
                    "Mitarbeiter konnte nicht hinzugefügt werden.",
                    "Fehler"
                )
    
    def _stammdaten_verwalten(self):
        """Öffnet Verwaltungs-Dialog"""
        dialog = StammdatenVerwaltenDialog(self.app, self.data_manager)
        self.app.wait_window(dialog)
        self._refresh_all()

    def _veranstaltungen_verwalten(self):
        """Öffnet Veranstaltungs-Verwaltungs-Dialog"""
        from gui.dialogs.veranstaltungen.veranstaltungen_verwalten_dialog import VeranstaltungenVerwaltenDialog
        dialog = VeranstaltungenVerwaltenDialog(self.app, self.data_manager)
        self.app.wait_window(dialog)

    def _feiertage_verwalten(self):
        """Öffnet Feiertags-Verwaltungs-Dialog"""
        from gui.dialogs.feiertage.feiertage_verwalten_dialog import FeiertageVerwaltenDialog
        dialog = FeiertageVerwaltenDialog(self.app, self.data_manager)
        self.app.wait_window(dialog)

    def _abteilungen_verwalten(self):
        """Öffnet Abteilungs-Verwaltungs-Dialog"""
        from gui.dialogs.abteilungen.abteilungen_verwalten_dialog import AbteilungenVerwaltenDialog
        dialog = AbteilungenVerwaltenDialog(self.app, self.data_manager)
        self.app.wait_window(dialog)
        # Nach dem Schließen des Dialogs, UI aktualisieren falls nötig
        self.lade_mitarbeiter_uebersicht()

    def setup_gui(self):
        """GUI aufbauen"""
        # Header
        header = ctk.CTkFrame(self.app, height=80, fg_color="#1f538d")
        header.pack(fill="x", padx=0, pady=0)
        header.pack_propagate(False)
        
        header_content = ctk.CTkFrame(header, fg_color="transparent")
        header_content.pack(fill="both", expand=True, padx=30, pady=20)
        
        # Titel-Section (links)
        title_section = ctk.CTkFrame(header_content, fg_color="transparent")
        title_section.pack(side="left")
        
        # Logo
        if PILLOW_AVAILABLE and os.path.exists("assets/logo_64.png"):
            try:
                logo_image = Image.open("assets/logo_64.png")
                logo_ctk = ctk.CTkImage(light_image=logo_image, dark_image=logo_image, size=(64, 64))
                ctk.CTkLabel(title_section, image=logo_ctk, text="").pack(side="left")
            except:
                ctk.CTkLabel(title_section, text="🏢", font=ctk.CTkFont(size=48)).pack(side="left")
        else:
            ctk.CTkLabel(title_section, text="🏢", font=ctk.CTkFont(size=48)).pack(side="left")
        
        # Titel
        ctk.CTkLabel(
            title_section,
            text="Teamplanner",
            font=ctk.CTkFont(size=28, weight="bold"),
            text_color="white"
        ).pack(side="left", padx=(10, 0))
        
        # ✅ GEÄNDERT: Jahr-Auswahl mit dynamischen Jahren
        right_section = ctk.CTkFrame(header_content, fg_color="transparent")
        right_section.pack(side="right")
        
        jahr_frame = ctk.CTkFrame(right_section, fg_color="transparent")
        jahr_frame.pack(side="top", anchor="e")
        
        ctk.CTkLabel(
            jahr_frame,
            text="Jahr:",
            font=ctk.CTkFont(size=12, weight="bold"),
            text_color="white"
        ).pack(side="left", padx=(0, 8))
        
        # ✅ Dynamische Jahre aus Einträgen
        self.jahr_combo = ctk.CTkComboBox(
            jahr_frame,
            values=self._get_verfuegbare_jahre(),
            width=100,
            height=32,
            command=self.on_jahr_changed,
            font=ctk.CTkFont(size=12)
        )
        self.jahr_combo.pack(side="left")
        self.jahr_combo.set(str(self.data_manager.aktuelles_jahr))
        
        # Hauptbereich
        main_frame = ctk.CTkFrame(self.app, fg_color="transparent")
        main_frame.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Tabelle
        self.tabelle = MitarbeiterTabelle(parent=main_frame, data_manager=self.data_manager)
        self.tabelle.pack(fill="both", expand=True)
    
    def _get_verfuegbare_jahre(self) -> list:
        """
        ✅ FIXED: Zeigt Jahre mit Einträgen + IMMER aktuelles Jahr
        
        Returns:
            Liste von Jahr-Strings, sortiert (neueste zuerst)
        """
        try:
            cursor = self.data_manager.db.conn.cursor()
            
            # Hole alle Jahre mit Einträgen
            cursor.execute("""
                SELECT DISTINCT CAST(strftime('%Y', von_datum) AS INTEGER) as jahr
                FROM urlaub
                UNION
                SELECT DISTINCT CAST(strftime('%Y', von_datum) AS INTEGER) as jahr
                FROM krankheit
                UNION
                SELECT DISTINCT CAST(strftime('%Y', datum) AS INTEGER) as jahr
                FROM schulung
                UNION
                SELECT DISTINCT CAST(strftime('%Y', datum) AS INTEGER) as jahr
                FROM ueberstunden
            """)
            
            # ✅ FIX: Set verwenden (verhindert Duplikate)
            jahre = {row[0] for row in cursor.fetchall()}
            
            # ✅ FIX: Aktuelles Jahr IMMER hinzufügen (auch ohne Einträge!)
            aktuelles_jahr = datetime.now().year
            jahre.add(aktuelles_jahr)
            
            # ✅ FIX: Nächstes Jahr auch (für Planung)
            jahre.add(aktuelles_jahr + 1)
            
            # Sortiere (neueste zuerst) und konvertiere zu Strings
            jahre_sortiert = sorted(jahre, reverse=True)
            jahre_strings = [str(j) for j in jahre_sortiert]
            
            print(f"📅 Verfügbare Jahre: {', '.join(jahre_strings)}")
            
            return jahre_strings
            
        except Exception as e:
            print(f"❌ Fehler beim Laden der Jahre: {e}")
            # Fallback: Aktuelles + Nächstes Jahr
            aktuelles_jahr = datetime.now().year
            return [str(aktuelles_jahr + 1), str(aktuelles_jahr)]
    
    def _update_jahr_dropdown(self):
        """Aktualisiert Jahr-Dropdown"""
        try:
            jahre = self._get_verfuegbare_jahre()
            aktueller_wert = self.jahr_combo.get()
            
            self.jahr_combo.configure(values=jahre)
            
            if aktueller_wert in jahre:
                self.jahr_combo.set(aktueller_wert)
            else:
                self.jahr_combo.set(jahre[0])
            
            print(f"✅ Jahr-Dropdown aktualisiert: {len(jahre)} Jahre")
            
        except Exception as e:
            print(f"❌ Fehler beim Aktualisieren: {e}")
    
    def on_jahr_changed(self, neues_jahr: str):
        """
        ✅ Wird aufgerufen wenn Jahr geändert wird
        WICHTIG: Übertrag wird automatisch neu berechnet!
        """
        try:
            jahr = int(neues_jahr)
            
            # Jahr setzen
            self.data_manager.aktuelles_jahr = jahr
            
            # Cache invalidieren (damit Übertrag neu berechnet wird!)
            self.data_manager._invalidate_cache()
            
            # UI aktualisieren
            self._refresh_all()
            
            # Titel
            self.app.title(f"Teamplanner V3 - {jahr}")
            
            print(f"✅ Jahr gewechselt: {jahr} (Übertrag wird dynamisch berechnet)")
            
        except ValueError:
            print(f"❌ Ungültiges Jahr: {neues_jahr}")
    
    def _refresh_all(self):
        """Aktualisiert alle Komponenten"""
        self.tabelle.aktualisiere_tabelle()
        self._update_jahr_dropdown()

    def lade_mitarbeiter_uebersicht(self):
        """Lädt Mitarbeiter-Übersicht neu (wird nach Dialogen aufgerufen)"""
        self.data_manager._invalidate_cache()
        self.tabelle.aktualisiere_tabelle()
    
    def _export_daten(self):
        """Öffnet Export-Dialog"""
        from models.export_manager import zeige_export_dialog
        zeige_export_dialog(self.app, self.data_manager)
    
    def run(self):
        """Startet die Anwendung"""
        self.app.mainloop()