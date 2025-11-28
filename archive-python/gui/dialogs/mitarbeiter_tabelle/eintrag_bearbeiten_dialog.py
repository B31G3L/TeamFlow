"""
Dialog zum Bearbeiten von Einträgen
✅ Unterstützt alle Typen: Urlaub, Krank, Schulung, Überstunden
✅ DatePicker für Datum
✅ Validierung
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from datetime import datetime, timedelta, date
import calendar
from typing import Dict
from models.data_manager_v3 import TeamplannerDataManager
from gui.notification_manager import NotificationManager



class DatePickerFrame(ctk.CTkFrame):
    """Custom Datumspicker"""

    def __init__(self, parent, initial_date=None, year_window=10, **kwargs):
        super().__init__(parent, **kwargs)
        self.configure(fg_color="transparent")

        self.selected_date = initial_date or date.today()
        self.callback = None
        self.year_window = year_window

        self.day_var = ctk.StringVar(value=str(self.selected_date.day))
        self.month_var = ctk.StringVar(value=str(self.selected_date.month))
        self.year_var = ctk.StringVar(value=str(self.selected_date.year))

        self.day_menu = ctk.CTkOptionMenu(
            self, variable=self.day_var,
            values=self._days_for(self.selected_date.year, self.selected_date.month),
            width=70, command=self._on_change
        )
        self.day_menu.pack(side="left", padx=(0, 5))

        self.month_menu = ctk.CTkOptionMenu(
            self, variable=self.month_var,
            values=[str(i) for i in range(1, 13)],
            width=70, command=self._on_change
        )
        self.month_menu.pack(side="left", padx=(0, 5))

        self.year_menu = ctk.CTkOptionMenu(
            self, variable=self.year_var,
            values=self._years_around(self.selected_date.year),
            width=90, command=self._on_change
        )
        self.year_menu.pack(side="left")

        self.display_label = ctk.CTkLabel(
            self, text=self.selected_date.strftime("%d.%m.%Y"),
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color="#3498db"
        )
        self.display_label.pack(side="left", padx=(15, 0))

    def _years_around(self, center_year: int):
        return [str(y) for y in range(center_year - self.year_window, center_year + self.year_window + 1)]

    def _days_for(self, year: int, month: int):
        last_day = calendar.monthrange(year, month)[1]
        return [str(i) for i in range(1, last_day + 1)]

    def _maybe_expand_years(self, year: int):
        years = list(map(int, self.year_menu.cget("values")))
        if year < years[0] or year > years[-1]:
            self.year_menu.configure(values=self._years_around(year))

    def _sync_day_values(self, year: int, month: int):
        days = self._days_for(year, month)
        cur_day = int(self.day_var.get())
        self.day_menu.configure(values=days)
        if str(cur_day) not in days:
            self.day_var.set(days[-1])

    def _on_change(self, *_):
        try:
            y = int(self.year_var.get())
            m = int(self.month_var.get())
            self._maybe_expand_years(y)
            self._sync_day_values(y, m)

            d = int(self.day_var.get())
            self.selected_date = date(y, m, d)

            self.display_label.configure(
                text=self.selected_date.strftime("%d.%m.%Y"),
                text_color="#3498db"
            )

            if self.callback:
                self.callback()
        except Exception:
            self.display_label.configure(text="Ungültiges Datum", text_color="#e74c3c")

    def get_date(self) -> date:
        return self.selected_date

    def set_date(self, new_date: date):
        self.selected_date = new_date
        self._maybe_expand_years(new_date.year)
        self.month_var.set(str(new_date.month))
        self.year_var.set(str(new_date.year))
        self._sync_day_values(new_date.year, new_date.month)
        self.day_var.set(str(new_date.day))
        self.display_label.configure(text=new_date.strftime("%d.%m.%Y"), text_color="#3498db")
        if self.callback:
            self.callback()

    def set_callback(self, callback):
        self.callback = callback


class EintragBearbeitenDialog(ctk.CTkToplevel):
    """Dialog zum Bearbeiten eines Eintrags"""

    TYP_FARBEN = {
        "urlaub": "#27ae60",
        "krank": "#e74c3c",
        "schulung": "#3498db",
        "ueberstunden": "#e67e22",
    }

    TYP_NAMEN = {
        "urlaub": "Urlaub",
        "krank": "Krankheit",
        "schulung": "Schulung",
        "ueberstunden": "Überstunden",
    }

    def __init__(self, parent, eintrag: Dict, data_manager):
        super().__init__(parent)

        self.eintrag = eintrag
        self.data_manager = data_manager
        self.result = None

        # Notification Manager
        self.notification_manager = NotificationManager(self)

        # Typ
        self.typ = eintrag['typ']
        farbe = self.TYP_FARBEN.get(self.typ, "#7f8c8d")

        self.title(f"{self.TYP_NAMEN.get(self.typ, 'Eintrag')} bearbeiten")
        self.resizable(True, True)
        self.minsize(520, 480)

        self.transient(parent)
        self.grab_set()

        self._setup_gui(farbe)

        self.update_idletasks()
        self._resize_to_content()
        self._center_window()

        self.bind("<Escape>", lambda e: self.abbrechen())
        self.bind("<Return>", lambda e: self.speichern())

    def _resize_to_content(self):
        self.update_idletasks()
        req_w = max(self.winfo_reqwidth(), 560)
        req_h = max(self.winfo_reqheight(), 500)
        max_w = int(self.winfo_screenwidth() * 0.9)
        max_h = int(self.winfo_screenheight() * 0.9)
        self.geometry(f"{min(req_w, max_w)}x{min(req_h, max_h)}")

    def _center_window(self):
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    def _setup_gui(self, farbe):
        # Header
        header = ctk.CTkFrame(self, fg_color=farbe, height=44, corner_radius=0)
        header.pack(fill="x")
        header.pack_propagate(False)

        header_content = ctk.CTkFrame(header, fg_color="transparent")
        header_content.pack(fill="both", expand=True, padx=18, pady=8)

        ctk.CTkLabel(
            header_content, text=f"{self.TYP_NAMEN.get(self.typ, 'Eintrag')} bearbeiten",
            font=ctk.CTkFont(size=16, weight="bold"), text_color="white"
        ).pack(anchor="w")

        # Mitarbeiter-Name
        ma_daten = self.data_manager.stammdaten.get(self.eintrag['mitarbeiter_id'], {})
        ma_name = f"{ma_daten.get('vorname', '')} {ma_daten.get('nachname', '')}".strip()
        
        ctk.CTkLabel(
            header_content, text=ma_name,
            font=ctk.CTkFont(size=12), text_color="white"
        ).pack(anchor="w")

        # Content
        form_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        form_frame.pack(fill="both", expand=True, padx=24, pady=16)

        def lbl(text, size=12, bold=True):
            ctk.CTkLabel(form_frame, text=text, font=ctk.CTkFont(size=size, weight="bold" if bold else "normal")
                         ).pack(anchor="w", pady=(0, 5))

        # Datum
        lbl("Datum:")
        try:
            datum_initial = datetime.strptime(self.eintrag['datum'], '%Y-%m-%d').date()
        except:
            datum_initial = date.today()
        
        self.datum_picker = DatePickerFrame(form_frame, initial_date=datum_initial)
        self.datum_picker.pack(fill="x", pady=(0, 12))

        # Typ-Auswahl
        lbl("Typ:")
        self.typ_combo = ctk.CTkComboBox(
            form_frame,
            values=["urlaub", "krank", "schulung", "ueberstunden"],
            height=35
        )
        self.typ_combo.set(self.typ)
        self.typ_combo.pack(fill="x", pady=(0, 12))

        # Wert (Tage oder Stunden)
        if self.typ == "ueberstunden":
            lbl("Stunden:")
        else:
            lbl("Tage:")
        
        self.wert_entry = ctk.CTkEntry(form_frame, height=35)
        self.wert_entry.insert(0, str(self.eintrag.get('wert', 0)))
        self.wert_entry.pack(fill="x", pady=(0, 12))

        # Titel (nur bei Schulung sichtbar)
        lbl("Titel (optional):")
        self.titel_entry = ctk.CTkEntry(form_frame, height=35)
        self.titel_entry.insert(0, self.eintrag.get('titel', ''))
        self.titel_entry.pack(fill="x", pady=(0, 12))

        # Notiz
        lbl("Notiz (optional):")
        self.notiz_entry = ctk.CTkTextbox(form_frame, height=80)
        self.notiz_entry.insert("1.0", self.eintrag.get('beschreibung', ''))
        self.notiz_entry.pack(fill="x", pady=(0, 12))

        # Info
        info_frame = ctk.CTkFrame(form_frame, fg_color="#2b2b2b", corner_radius=8)
        info_frame.pack(fill="x", pady=(0, 12))
        
        erfasst_am = self.eintrag.get('erfasst_am', '')
        if erfasst_am:
            try:
                erfasst_dt = datetime.strptime(erfasst_am, '%Y-%m-%d %H:%M:%S')
                erfasst_text = erfasst_dt.strftime('%d.%m.%Y um %H:%M Uhr')
            except:
                erfasst_text = erfasst_am
        else:
            erfasst_text = "Unbekannt"
        
        ctk.CTkLabel(
            info_frame,
            text=f"Erstmals erfasst am: {erfasst_text}",
            font=ctk.CTkFont(size=10), text_color="#95a5a6"
        ).pack(pady=8)

        # Buttons
        btn_frame = ctk.CTkFrame(self, fg_color="transparent", height=52)
        btn_frame.pack(fill="x", padx=24, pady=(0, 14))
        btn_frame.pack_propagate(False)

        inner = ctk.CTkFrame(btn_frame, fg_color="transparent")
        inner.pack(fill="both", expand=True)

        ctk.CTkButton(
            inner, text="Abbrechen", command=self.abbrechen,
            fg_color="#7f8c8d", hover_color="#636e72",
            height=36, font=ctk.CTkFont(size=13), corner_radius=8
        ).pack(side="left", fill="x", expand=True, padx=(0, 8))

        ctk.CTkButton(
            inner, text="Speichern", command=self.speichern,
            height=36, fg_color="#27ae60", hover_color="#229954",
            font=ctk.CTkFont(size=13, weight="bold"), corner_radius=8
        ).pack(side="right", fill="x", expand=True, padx=(8, 0))

    def speichern(self):
        """Speichert geänderten Eintrag"""
        try:
            # Daten sammeln
            neues_datum = self.datum_picker.get_date()
            neuer_typ = self.typ_combo.get()
            wert_str = self.wert_entry.get().strip()
            titel = self.titel_entry.get().strip()
            notiz = self.notiz_entry.get("1.0", "end-1c").strip()

            # Validierung
            if not wert_str:
                messagebox.showerror("Fehler", "Bitte Wert eingeben!", parent=self)
                return

            try:
                wert = float(wert_str.replace(",", "."))
                if wert <= 0:
                    raise ValueError()
            except:
                messagebox.showerror("Fehler", "Bitte gültigen Wert eingeben!", parent=self)
                return

            # In DB updaten
            cursor = self.data_manager.db.conn.cursor()
            
            jahr = neues_datum.year
            
            cursor.execute("""
                UPDATE eintraege
                SET datum = ?, typ = ?, wert = ?, titel = ?, 
                    beschreibung = ?, jahr = ?
                WHERE id = ?
            """, (
                neues_datum.strftime("%Y-%m-%d"),
                neuer_typ,
                wert,
                titel,
                notiz,
                jahr,
                self.eintrag['id']
            ))
            
            self.data_manager.db.conn.commit()

            self.result = True

            self.notification_manager.show(
                "Eintrag wurde erfolgreich aktualisiert!",
                typ=self.notification_manager.SUCCESS,
                title="Erfolg",
                duration=4000
            )
            self.destroy()

        except Exception as e:
            messagebox.showerror("Fehler", f"Fehler beim Speichern: {e}", parent=self)

    def abbrechen(self):
        self.result = None
        self.destroy()