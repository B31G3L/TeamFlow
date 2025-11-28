"""
Schulungs-Dialog – kompakter Header, dynamische Größe, smarter DatePicker, Halber-Tag-Support
FIX: BooleanVar korrekt initialisiert
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from datetime import datetime, timedelta, date
from gui.components.date_input import DateInput
from models.mitarbeiter import MitarbeiterStatistik
from models.data_manager_v3 import TeamplannerDataManager
from gui.notification_manager import NotificationManager

class SchulungDialog(ctk.CTkToplevel):
    """Optimierter Dialog für Schulungen"""

    QUICK_WERTE = [
        ("Halber Tag", 0.5),
        ("1 Tag", 1),
        ("2 Tage", 2),
        ("3 Tage", 3),
        ("1 Woche", 5),
        ("2 Wochen", 10),
    ]

    def __init__(self, parent, stat: MitarbeiterStatistik, data_manager: TeamplannerDataManager):
        super().__init__(parent)

        self.stat = stat
        self.data_manager = data_manager
        self.result = None

        # Notification Manager
        self.notification_manager = NotificationManager(self)
        
        # ✅ FIX: BooleanVar mit self als master initialisieren
        self.halber_tag_var = ctk.BooleanVar(master=self, value=False)

        # Fenster
        self.title(f"Schulung – {stat.mitarbeiter.name}")
        self.resizable(True, True)
        self.minsize(520, 560)

        # Modal
        self.transient(parent)
        self.grab_set()

        # UI
        self._setup_gui()

        # Layout finalisieren
        self.update_idletasks()
        self._resize_to_content()
        self._center_window()

        # Shortcuts
        self.bind("<Escape>", lambda e: self.abbrechen())
        self.bind("<Return>", lambda e: self.speichern())

    def _resize_to_content(self):
        self.update_idletasks()
        req_w = max(self.winfo_reqwidth(), 560)
        req_h = max(self.winfo_reqheight(), 560)
        max_w = int(self.winfo_screenwidth() * 0.9)
        max_h = int(self.winfo_screenheight() * 0.9)
        self.geometry(f"{min(req_w, max_w)}x{min(req_h, max_h)}")

    def _center_window(self):
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (w // 2)
        y = (self.winfo_screenheight() // 2) - (h // 2)
        self.geometry(f"{w}x{h}+{x}+{y}")

    def _setup_gui(self):
        # Kompakter Header
        header = ctk.CTkFrame(self, fg_color="#3498db", height=44, corner_radius=0)
        header.pack(fill="x")
        header.pack_propagate(False)

        header_content = ctk.CTkFrame(header, fg_color="transparent")
        header_content.pack(fill="both", expand=True, padx=18, pady=8)

        ctk.CTkLabel(
            header_content, text="Schulung eintragen",
            font=ctk.CTkFont(size=16, weight="bold"), text_color="white"
        ).pack(anchor="w")
        ctk.CTkLabel(
            header_content, text=self.stat.mitarbeiter.name,
            font=ctk.CTkFont(size=12), text_color="white"
        ).pack(anchor="w")

        # Scrollbarer Inhalt
        form_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        form_frame.pack(fill="both", expand=True, padx=24, pady=16)

        def lbl(parent, text, size=12, bold=True, color=None, pady=(0, 5)):
            font = ctk.CTkFont(size=size, weight="bold" if bold else "normal")
            ctk.CTkLabel(parent, text=text, font=font, text_color=color).pack(anchor="w", pady=pady)

        lbl(form_frame, "Von:")
        self.von_datum_input = DateInput(form_frame, initial_date=date.today(), label="")
        self.von_datum_input.pack(fill="x", pady=(0, 12))
        self.von_datum_input.set_callback(self._berechne_tage)

        lbl(form_frame, "Bis:")
        self.bis_datum_input = DateInput(form_frame, initial_date=date.today(), label="")
        self.bis_datum_input.pack(fill="x", pady=(0, 12))
        self.bis_datum_input.set_callback(self._berechne_tage)


        # Halber-Tag-Checkbox
        self.halber_tag_check = ctk.CTkCheckBox(
            form_frame, text="Halber Tag (0,5)",
            variable=self.halber_tag_var,
            command=self._berechne_tage
        )
        self.halber_tag_check.pack(anchor="w", pady=(2, 10))

        # Tage-Anzeige
        self.tage_label = ctk.CTkLabel(
            form_frame, text="Werktage: 1",
            font=ctk.CTkFont(size=14, weight="bold"), text_color="#27ae60"
        )
        self.tage_label.pack(anchor="w", pady=(0, 12))

        # Quick-Buttons
        quick_frame = ctk.CTkFrame(form_frame, fg_color="#2b2b2b", corner_radius=8)
        quick_frame.pack(fill="x", pady=(0, 14))

        quick_header = ctk.CTkFrame(quick_frame, fg_color="transparent")
        quick_header.pack(fill="x", padx=12, pady=(10, 6))
        ctk.CTkLabel(
            quick_header, text="Quick-Auswahl (Werktage Mo–Fr):",
            font=ctk.CTkFont(size=11, weight="bold"), text_color="#3498db"
        ).pack(side="left")
        ctk.CTkLabel(
            quick_header, text="(setzt Zeitraum ab Von-Datum)",
            font=ctk.CTkFont(size=9), text_color="#95a5a6"
        ).pack(side="left", padx=(8, 0))

        quick_grid = ctk.CTkFrame(quick_frame, fg_color="transparent")
        quick_grid.pack(fill="x", padx=12, pady=(0, 10))
        for i in range(3):
            quick_grid.columnconfigure(i, weight=1, uniform="quick")

        for idx, (label, werktage) in enumerate(self.QUICK_WERTE):
            r, c = divmod(idx, 3)
            ctk.CTkButton(
                quick_grid, text=label, height=38,
                fg_color="#3d3d3d", hover_color="#4d4d4d",
                font=ctk.CTkFont(size=12),
                command=lambda w=werktage: self.set_werktage(w)
            ).grid(row=r, column=c, padx=5, pady=5, sticky="ew")

        # Titel
        lbl(form_frame, "Schulungstitel (optional):")
        self.titel_entry = ctk.CTkEntry(
            form_frame, placeholder_text="z. B. Excel Grundlagen, Erste Hilfe, …", height=35
        )
        self.titel_entry.pack(fill="x", pady=(0, 10))

        # Notiz
        lbl(form_frame, "Notiz (optional):")
        self.notiz_entry = ctk.CTkTextbox(form_frame, height=80)
        self.notiz_entry.pack(fill="x", pady=(0, 12))

        # Veranstaltungs-Info
        self.veranstaltung_label = ctk.CTkLabel(
            form_frame,
            text="",
            font=ctk.CTkFont(size=10),
            text_color="#3498db",
            wraplength=500,
            justify="left"
        )
        self.veranstaltung_label.pack(anchor="w", pady=(0, 12))

        # Info
        info_frame = ctk.CTkFrame(form_frame, fg_color="#2b2b2b", corner_radius=8)
        info_frame.pack(fill="x", pady=(0, 12))
        ctk.CTkLabel(
            info_frame,
            text=f"Aktueller Stand: {self.stat.schulungstage:.0f} Schulungstage",
            font=ctk.CTkFont(size=11), text_color="#3498db"
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

        # Initial
        self._berechne_tage()

    def _berechne_tage(self):
        """Berechnet Werktage"""
        try:
            von = self.von_datum_input.get_date()
            bis = self.bis_datum_input.get_date()

            # Halber Tag nur wenn gleicher Tag
            if self.halber_tag_var.get() and von != bis:
                self.halber_tag_var.set(False)

            if von > bis:
                self.tage_label.configure(text="Werktage: Fehler (Von > Bis)", text_color="#e74c3c")
                return

            if self.halber_tag_var.get():
                self.tage_label.configure(text="Werktage: 0,5 (Halber Tag)", text_color="#27ae60")
            else:
                werktage = self._berechne_werktage(von, bis)
                kalendertage = (bis - von).days + 1

                if werktage != kalendertage:
                    self.tage_label.configure(
                        text=f"Werktage: {werktage} ({kalendertage} Kalendertage)", text_color="#27ae60"
                    )
                else:
                    self.tage_label.configure(text=f"Werktage: {werktage}", text_color="#27ae60")

            # ✅ NEU: Prüfe auf Veranstaltungen
            veranstaltungen = self.data_manager.db.veranstaltungen.get_by_zeitraum(von, bis)

            if veranstaltungen:
                veranstaltung_text = "📅 Hinweis: Im gewählten Zeitraum finden Veranstaltungen statt:\n"
                for v in veranstaltungen:
                    if v.von_datum == v.bis_datum:
                        veranstaltung_text += f"  • {v.name} am {v.von_datum.strftime('%d.%m.%Y')}\n"
                    else:
                        veranstaltung_text += f"  • {v.name} vom {v.von_datum.strftime('%d.%m.%Y')} bis {v.bis_datum.strftime('%d.%m.%Y')}\n"
                self.veranstaltung_label.configure(text=veranstaltung_text)
            else:
                self.veranstaltung_label.configure(text="")

        except Exception as e:
            self.tage_label.configure(text=f"Werktage: Fehler ({e})", text_color="#e74c3c")

    def _berechne_werktage(self, von: date, bis: date) -> int:
        """Zählt Mo–Fr"""
        days = (bis - von).days + 1
        full_weeks, rem = divmod(days, 7)
        werktage = full_weeks * 5
        for i in range(rem):
            if (von + timedelta(days=i)).weekday() < 5:
                werktage += 1
        return werktage

    def _addiere_werktage(self, start_datum: date, anzahl_werktage: int) -> date:
        """Addiert X Werktage"""
        aktuell = start_datum
        gez = 1
        while gez < anzahl_werktage:
            aktuell += timedelta(days=1)
            if aktuell.weekday() < 5:
                gez += 1
        return aktuell

    def set_werktage(self, werktage: float):
        """Quick-Set"""
        von = self.von_datum_input.get_date()
        while von.weekday() >= 5:
            von += timedelta(days=1)

        if werktage == 0.5:
            bis = von
            self.halber_tag_var.set(True)
        else:
            bis = self._addiere_werktage(von, int(werktage))
            self.halber_tag_var.set(False)

        self.von_datum_input.set_date(von)
        self.bis_datum_input.set_date(bis)
        self._berechne_tage()
        self.tage_label.configure(text_color="#27ae60")

    def speichern(self):
        """Speichert die Schulung"""
        try:
            try:
                von = self.von_datum_input.get_date()
                bis = self.bis_datum_input.get_date()
                
                if not von or not bis:
                    messagebox.showerror("Fehler", "Bitte beide Datumsfelder ausfüllen!", parent=self)
                    return
            except ValueError as e:
                messagebox.showerror("Fehler", str(e), parent=self)
                return

            if von > bis:
                messagebox.showerror("Fehler", "Von-Datum muss vor Bis-Datum liegen!", parent=self)
                return

            if self.halber_tag_var.get():
                wert = 0.5
                kalendertage = 1
            else:
                wert = float(self._berechne_werktage(von, bis))
                kalendertage = (bis - von).days + 1

            titel = self.titel_entry.get().strip()
            notiz = self.notiz_entry.get("1.0", "end-1c").strip()

            neuer_eintrag = {
                "mitarbeiter_id": self.stat.mitarbeiter.id,
                "datum": von.strftime("%Y-%m-%d"),
                "typ": "schulung",
                "wert": wert,
                "titel": titel,
                "beschreibung": notiz,
                "kategorie": "",
                "erfasst_am": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }

            self.data_manager.speichere_eintrag(neuer_eintrag)
            self.result = True

            neuer_stand = self.stat.schulungstage + wert
            if wert == 0.5:
                msg = "0,5 Werktag Schulung gespeichert!"
            else:
                msg = f"{int(wert)} Werktag{'e' if wert != 1 else ''} Schulung gespeichert!"
                if wert != kalendertage:
                    wochenende = kalendertage - int(wert)
                    msg += f"\n({kalendertage} Kalendertage, {wochenende} Wochenendtag{'e' if wochenende != 1 else ''})"

            if titel:
                msg += f"\n{titel}"
            msg += f"\n\nNeuer Stand: {neuer_stand:.1f} Schulungstage"

            self.notification_manager.show(
                msg,
                typ=self.notification_manager.SUCCESS,
                title="Erfolg",
                duration=5000
            )
            self.destroy()

        except Exception as e:
            messagebox.showerror("Fehler", f"Fehler beim Speichern: {e}", parent=self)

    def abbrechen(self):
        self.result = None
        self.destroy()