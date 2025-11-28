"""
Überstunden-Dialog V2 – mit Aufbau/Abbau-Unterscheidung
✅ Wähle zwischen Aufbauen und Abbauen
✅ Minuten-Eingabe Support (1:30 = 1,5h)
✅ DateInput für Datum
✅ Vorzeichenbehandlung automatisch
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from datetime import datetime, date
from models.mitarbeiter import MitarbeiterStatistik
from models.data_manager_v3 import TeamplannerDataManager
from gui.components.date_input import DateInput
from gui.notification_manager import NotificationManager

import re


class UeberstundenDialog(ctk.CTkToplevel):
    """Überstunden-Dialog mit Aufbau/Abbau-Unterscheidung"""

    QUICK_WERTE_AUFBAU = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0]
    QUICK_WERTE_ABBAU = [-0.5, -1.0, -1.5, -2.0, -3.0, -4.0]

    def __init__(self, parent, stat: MitarbeiterStatistik, data_manager: TeamplannerDataManager):
        super().__init__(parent)

        self.stat = stat
        self.data_manager = data_manager
        self.result = None

        # Notification Manager
        self.notification_manager = NotificationManager(self)

        self.title(f"Überstunden – {stat.mitarbeiter.name}")
        self.resizable(True, True)
        self.minsize(600, 750)

        self.transient(parent)
        self.grab_set()

        self._setup_gui()

        self.update_idletasks()
        self._resize_to_content()
        self._center_window()

        self.bind("<Escape>", lambda e: self.abbrechen())
        self.bind("<Return>", lambda e: self.speichern())

        self.after(50, self.stunden_entry.focus_set)

    def _resize_to_content(self):
        self.update_idletasks()
        req_w = max(self.winfo_reqwidth(), 600)
        req_h = max(self.winfo_reqheight(), 750)
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
        header = ctk.CTkFrame(self, fg_color="#e67e22", height=44, corner_radius=0)
        header.pack(fill="x")
        header.pack_propagate(False)

        hdr = ctk.CTkFrame(header, fg_color="transparent")
        hdr.pack(fill="both", expand=True, padx=18, pady=8)

        ctk.CTkLabel(
            hdr, text="Überstunden eintragen",
            font=ctk.CTkFont(size=16, weight="bold"), text_color="white"
        ).pack(anchor="w")
        ctk.CTkLabel(
            hdr, text=self.stat.mitarbeiter.name,
            font=ctk.CTkFont(size=12), text_color="white"
        ).pack(anchor="w")

        # Scrollbarer Inhalt
        form_frame = ctk.CTkScrollableFrame(self, fg_color="transparent")
        form_frame.pack(fill="both", expand=True, padx=24, pady=16)

        def lbl(parent, text, size=12, bold=True, color=None, pady=(0, 5)):
            font = ctk.CTkFont(size=size, weight="bold" if bold else "normal")
            ctk.CTkLabel(parent, text=text, font=font, text_color=color).pack(anchor="w", pady=pady)

        # Datum
        heute = date.today()
        self.datum_input = DateInput(
            form_frame,
            initial_date=heute,
            label="Datum:"
        )
        self.datum_input.pack(fill="x", pady=(0, 12))

        # ✅ NEU: Art der Überstunden (Aufbau/Abbau)
        art_box = ctk.CTkFrame(form_frame, fg_color="#2b2b2b", corner_radius=8)
        art_box.pack(fill="x", pady=(0, 12))

        art_inner = ctk.CTkFrame(art_box, fg_color="transparent")
        art_inner.pack(fill="x", padx=15, pady=12)

        ctk.CTkLabel(
            art_inner,
            text="Art der Überstunden:",
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(anchor="w", pady=(0, 8))

        self.art_var = ctk.StringVar(value="aufbau")

        aufbau_radio = ctk.CTkRadioButton(
            art_inner,
            text="➕ Aufbauen (Überstunden geleistet)",
            variable=self.art_var,
            value="aufbau",
            font=ctk.CTkFont(size=12),
            command=self._on_art_changed
        )
        aufbau_radio.pack(anchor="w", pady=3)

        abbau_radio = ctk.CTkRadioButton(
            art_inner,
            text="➖ Abbauen (Überstunden genommen)",
            variable=self.art_var,
            value="abbau",
            font=ctk.CTkFont(size=12),
            command=self._on_art_changed
        )
        abbau_radio.pack(anchor="w", pady=3)

        # Stunden-Eingabe
        row = ctk.CTkFrame(form_frame, fg_color="transparent")
        row.pack(fill="x", pady=(0, 4))
        ctk.CTkLabel(row, text="Stunden:", font=ctk.CTkFont(size=12, weight="bold")).pack(side="left")
        ctk.CTkLabel(row, text="(z.B. 1.5 oder 1:30 für 1½ Stunden)",
                     font=ctk.CTkFont(size=10), text_color="#95a5a6"
                     ).pack(side="left", padx=(10, 0))

        vcmd = (self.register(self._validate_hours), "%P")
        self.stunden_entry = ctk.CTkEntry(
            form_frame, placeholder_text="z.B. 2.5 oder 1:30", height=38, font=ctk.CTkFont(size=13),
            validate="key", validatecommand=vcmd
        )
        self.stunden_entry.pack(fill="x", pady=(0, 10))

        # ✅ NEU: Dynamische Quick-Buttons (abhängig von Art)
        self.quick_frame = ctk.CTkFrame(form_frame, fg_color="#2b2b2b", corner_radius=8)
        self.quick_frame.pack(fill="x", pady=(0, 14))

        self.quick_header = ctk.CTkFrame(self.quick_frame, fg_color="transparent")
        self.quick_header.pack(fill="x", padx=12, pady=(10, 6))
        
        self.quick_title = ctk.CTkLabel(
            self.quick_header, text="⚡ Quick-Auswahl (Aufbauen):",
            font=ctk.CTkFont(size=11, weight="bold"), text_color="#27ae60"
        )
        self.quick_title.pack(side="left")

        self.quick_grid = ctk.CTkFrame(self.quick_frame, fg_color="transparent")
        self.quick_grid.pack(fill="x", padx=12, pady=(0, 10))
        for i in range(3):
            self.quick_grid.columnconfigure(i, weight=1, uniform="quick")

        # Initial: Aufbau-Buttons
        self._update_quick_buttons()

        # Notiz
        lbl(form_frame, "Notiz (optional):")
        self.notiz_entry = ctk.CTkTextbox(form_frame, height=80)
        self.notiz_entry.pack(fill="x", pady=(0, 10))

        # Info-Box
        info = ctk.CTkFrame(form_frame, fg_color="#2b2b2b", corner_radius=8)
        info.pack(fill="x", pady=(0, 10))
        ctk.CTkLabel(
            info, text=f"💡 Aktueller Stand: {self.stat.ueberstunden:.2f}h Überstunden",
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

    def _on_art_changed(self):
        """Wird aufgerufen wenn Art geändert wird"""
        self._update_quick_buttons()

    def _update_quick_buttons(self):
        """Aktualisiert Quick-Buttons basierend auf Art"""
        # Lösche alte Buttons
        for widget in self.quick_grid.winfo_children():
            widget.destroy()

        art = self.art_var.get()
        
        if art == "aufbau":
            werte = self.QUICK_WERTE_AUFBAU
            self.quick_title.configure(
                text="⚡ Quick-Auswahl (Aufbauen):",
                text_color="#27ae60"
            )
        else:
            werte = self.QUICK_WERTE_ABBAU
            self.quick_title.configure(
                text="⚡ Quick-Auswahl (Abbauen):",
                text_color="#e74c3c"
            )

        for i, val in enumerate(werte):
            r, c = divmod(i, 3)
            text = f"{abs(val)}h" if art == "aufbau" else f"-{abs(val)}h"
            
            ctk.CTkButton(
                self.quick_grid, text=text, height=36, 
                fg_color="#3d3d3d", hover_color="#4d4d4d",
                font=ctk.CTkFont(size=12, weight="bold"),
                command=lambda h=abs(val): self.set_stunden(h)
            ).grid(row=r, column=c, padx=5, pady=5, sticky="ew")

    def _validate_hours(self, value: str) -> bool:
        """Validiert Stunden-Eingabe (Dezimal oder Minuten-Format)"""
        if value == "":
            return True

        # Minuten-Format: 1:30
        if ":" in value:
            if not re.fullmatch(r"\d{1,2}:\d{0,2}", value):
                return False
            teile = value.split(":")
            if len(teile[1]) > 0:
                try:
                    min = int(teile[1])
                    return 0 <= min < 60
                except:
                    return False
            return True

        # Dezimal-Format: 12.5 oder 12,5
        if not re.fullmatch(r"\d{1,2}([\.,]\d{0,2})?", value):
            return False
        try:
            num = float(value.replace(",", "."))
            return 0 <= num <= 24
        except ValueError:
            return False

    def set_stunden(self, stunden: float):
        """Setzt Stunden-Wert aus Quick-Button"""
        self.stunden_entry.delete(0, "end")
        self.stunden_entry.insert(0, f"{stunden}".replace(".", ","))
        try:
            original = self.stunden_entry.cget("border_color")
            self.stunden_entry.configure(border_color="#27ae60")
            self.after(200, lambda: self.stunden_entry.configure(border_color=original))
        except Exception:
            pass

    def speichern(self):
        """Speichert Überstunden mit korrektem Vorzeichen"""
        try:
            # Datum
            try:
                datum = self.datum_input.get_date()
                if not datum:
                    messagebox.showerror("Fehler", "Bitte Datum eingeben!", parent=self)
                    self.datum_input.focus()
                    return
            except ValueError as e:
                messagebox.showerror("Fehler", str(e), parent=self)
                self.datum_input.focus()
                return

            # Art
            art = self.art_var.get()

            # Stunden
            stunden_str = (self.stunden_entry.get() or "").strip()
            if not stunden_str:
                messagebox.showerror("Fehler", "Bitte Stunden eingeben!", parent=self)
                self.stunden_entry.focus()
                return

            try:
                # Parse Stunden (Dezimal oder Minuten)
                if ":" in stunden_str:
                    teile = stunden_str.split(":")
                    if len(teile) != 2:
                        raise ValueError("Ungültiges Format")

                    std = int(teile[0])
                    min_str = teile[1]

                    if not min_str:
                        min = 0
                    else:
                        min = int(min_str)

                    if min < 0 or min >= 60:
                        raise ValueError("Minuten müssen zwischen 0-59 liegen")

                    stunden = std + (min / 60.0)
                else:
                    stunden = float(stunden_str.replace(",", "."))

                if stunden <= 0:
                    raise ValueError("Nicht-positiv")

                if stunden > 24:
                    if not messagebox.askyesno(
                        "Ungewöhnliche Eingabe",
                        f"{stunden:.2f}h sind sehr viel.\n\nTrotzdem speichern?",
                        parent=self,
                    ):
                        return

                # ✅ Vorzeichen basierend auf Art
                if art == "abbau":
                    stunden = -stunden

            except ValueError as ve:
                messagebox.showerror(
                    "Fehler",
                    f"Ungültige Eingabe!\n\n{str(ve)}\n\nBeispiele:\n• 2.5 (Dezimal)\n• 1:30 (1 Std 30 Min)",
                    parent=self
                )
                self.stunden_entry.focus()
                return

            notiz = self.notiz_entry.get("1.0", "end-1c").strip()

            neuer_eintrag = {
                "mitarbeiter_id": self.stat.mitarbeiter.id,
                "datum": datum.strftime("%Y-%m-%d"),
                "typ": "ueberstunden",
                "wert": stunden,
                "titel": "",
                "beschreibung": notiz,
                "kategorie": "",
                "erfasst_am": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }

            self.data_manager.speichere_eintrag(neuer_eintrag)
            self.result = True

            neuer_stand = self.stat.ueberstunden + stunden

            # Nachricht
            if art == "aufbau":
                msg = f"{stunden:.2f}h Überstunden aufgebaut!\n\nNeuer Stand: {neuer_stand:.2f}h"
            else:
                msg = f"{abs(stunden):.2f}h Überstunden abgebaut!\n\nNeuer Stand: {neuer_stand:.2f}h"

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