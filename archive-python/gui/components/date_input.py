"""
DateInput Component - SIMPLE & WORKING VERSION
✅ Cursor IMMER am Ende (keine komplizierten Berechnungen!)
✅ Funktioniert garantiert
"""

import customtkinter as ctk
from datetime import date, datetime
import re
from typing import Optional, Callable


class DateInput(ctk.CTkFrame):
    """Datumseingabe - SIMPLE VERSION (Cursor immer am Ende)"""
    
    def __init__(self, parent, initial_date: Optional[date] = None, 
                 label: str = "Datum:", show_today_button: bool = True,
                 **kwargs):
        super().__init__(parent, fg_color="transparent", **kwargs)
        
        self.callback: Optional[Callable] = None
        
        # Label
        label_frame = ctk.CTkFrame(self, fg_color="transparent")
        label_frame.pack(fill="x", pady=(0, 4))
        
        ctk.CTkLabel(
            label_frame,
            text=label,
            font=ctk.CTkFont(size=12, weight="bold")
        ).pack(side="left")
        
        ctk.CTkLabel(
            label_frame,
            text="(Format: TT.MM.JJJJ)",
            font=ctk.CTkFont(size=10),
            text_color="#95a5a6"
        ).pack(side="left", padx=(8, 0))
        
        # Entry
        self.entry = ctk.CTkEntry(
            self,
            placeholder_text="01.01.2025",
            height=35,
            font=ctk.CTkFont(size=13)
        )
        self.entry.pack(fill="x", pady=(0, 8))
        
        # ✅ SIMPLE: Validiere nur bei KeyRelease
        self.entry.bind('<KeyRelease>', self._on_key_release)
        self.entry.bind('<FocusOut>', self._on_focus_out)
        
        # Initial setzen
        if initial_date:
            self.set_date(initial_date)
        
        # Heute-Button
        if show_today_button:
            ctk.CTkButton(
                self,
                text="📅 Heute",
                width=100,
                height=28,
                command=self._set_today,
                fg_color="#3498db",
                hover_color="#2980b9",
                font=ctk.CTkFont(size=11)
            ).pack(anchor="w")
    
    def _on_key_release(self, event):
        """
        ✅ SIMPLE VERSION: Formatiert und setzt Cursor ans Ende
        """
        current = self.entry.get()
        
        # Erlaube leeren Input
        if not current or current in ['.', '..', '...']:
            return
        
        # Entferne alle Punkte und Nicht-Ziffern
        digits = ''.join(filter(str.isdigit, current))
        
        # Leerer String nach Filterung? Entry leeren
        if not digits:
            self.entry.delete(0, ctk.END)
            return
        
        # Maximal 8 Ziffern
        digits = digits[:8]
        
        # Formatiere
        formatted = self._format_simple(digits)
        
        # Nur updaten wenn anders
        if current != formatted:
            self.entry.delete(0, ctk.END)
            self.entry.insert(0, formatted)
            # ✅ CURSOR ANS ENDE!
            self.entry.icursor(len(formatted))
    
    def _format_simple(self, digits: str) -> str:
        """
        ✅ SIMPLE: Formatiert Ziffern zu TT.MM.JJJJ
        
        "02021990" → "02.02.1990"
        """
        length = len(digits)
        
        if length <= 2:
            # Nur Tag
            return digits
        
        elif length <= 4:
            # Tag + Monat
            # digits[0:2] = Tag (Zeichen 0-1)
            # digits[2:4] = Monat (Zeichen 2-3)
            return f"{digits[0:2]}.{digits[2:4]}"
        
        else:
            # Tag + Monat + Jahr
            # digits[0:2] = Tag (Zeichen 0-1)
            # digits[2:4] = Monat (Zeichen 2-3)
            # digits[4:8] = Jahr (Zeichen 4-7)
            return f"{digits[0:2]}.{digits[2:4]}.{digits[4:8]}"
    
    def _on_focus_out(self, event):
        """Validiert bei Fokusverlust"""
        try:
            datum = self.get_date()
            if datum:
                # Setze vollständiges Format
                self.entry.delete(0, ctk.END)
                self.entry.insert(0, datum.strftime("%d.%m.%Y"))
                self.entry.configure(border_color=["#3F3F3F", "#3F3F3F"])
        except ValueError:
            # Ungültiges Datum - rot markieren
            if self.entry.get().strip():
                self.entry.configure(border_color="#e74c3c")
    
    def _set_today(self):
        """Setzt heutiges Datum"""
        self.set_date(date.today())
        if self.callback:
            self.callback()
    
    def get_date(self) -> Optional[date]:
        """
        Holt Datum aus Eingabe
        
        Returns:
            date oder None wenn leer
            
        Raises:
            ValueError: Bei ungültigem Format
        """
        text = self.entry.get().strip()
        
        if not text:
            return None
        
        # Format prüfen
        if not re.match(r'^\d{2}\.\d{2}\.\d{4}$', text):
            raise ValueError(f"Ungültiges Format: {text} (erwarte TT.MM.JJJJ)")
        
        try:
            return datetime.strptime(text, "%d.%m.%Y").date()
        except ValueError:
            raise ValueError(f"Ungültiges Datum: {text}")
    
    def set_date(self, datum: date):
        """Setzt Datum"""
        self.entry.delete(0, ctk.END)
        self.entry.insert(0, datum.strftime("%d.%m.%Y"))
        self.entry.configure(border_color=["#3F3F3F", "#3F3F3F"])
    
    def clear(self):
        """Leert Eingabe"""
        self.entry.delete(0, ctk.END)
        self.entry.configure(border_color=["#3F3F3F", "#3F3F3F"])
    
    def set_callback(self, callback: Callable):
        """Setzt Callback"""
        self.callback = callback
    
    def focus(self):
        """Fokus auf Entry"""
        self.entry.focus()


# ==================== DETAILLIERTER TEST ====================

if __name__ == "__main__":
    import customtkinter as ctk
    
    app = ctk.CTk()
    app.title("DateInput - SIMPLE VERSION Test")
    app.geometry("600x500")
    
    ctk.set_appearance_mode("dark")
    
    test_frame = ctk.CTkFrame(app)
    test_frame.pack(fill="both", expand=True, padx=30, pady=30)
    
    # Header
    ctk.CTkLabel(
        test_frame,
        text="DateInput - SIMPLE VERSION",
        font=ctk.CTkFont(size=20, weight="bold")
    ).pack(pady=(0, 10))
    
    # Anleitung
    anleitung = ctk.CTkFrame(test_frame, fg_color="#2b2b2b", corner_radius=8)
    anleitung.pack(fill="x", pady=(0, 20))
    
    ctk.CTkLabel(
        anleitung,
        text="📝 Test-Anleitung",
        font=ctk.CTkFont(size=13, weight="bold"),
        anchor="w"
    ).pack(fill="x", padx=15, pady=(10, 5))
    
    anleitung_text = """
1. Tippe nacheinander: 0 → 2 → 0 → 2 → 1 → 9 → 9 → 0

2. Erwartetes Ergebnis:
   0 → 02 → 02.0 → 02.02 → 02.02.1 → 02.02.19 → 02.02.199 → 02.02.1990

3. Der Cursor steht immer am Ende (SIMPLE Lösung!)
    """
    
    ctk.CTkLabel(
        anleitung,
        text=anleitung_text,
        font=ctk.CTkFont(size=11),
        anchor="w",
        justify="left",
        text_color="#95a5a6"
    ).pack(fill="x", padx=15, pady=(0, 10))
    
    # DateInput
    date_input = DateInput(
        test_frame,
        initial_date=None,
        label="Test-Datum:",
        show_today_button=True
    )
    date_input.pack(fill="x", pady=10)
    
    # Real-Time Display
    display_frame = ctk.CTkFrame(test_frame, fg_color="#2b2b2b", corner_radius=8)
    display_frame.pack(fill="x", pady=10)
    
    current_label = ctk.CTkLabel(
        display_frame,
        text="Aktueller Wert: (leer)",
        font=ctk.CTkFont(size=12),
        text_color="#3498db"
    )
    current_label.pack(pady=10)
    
    def update_display(event=None):
        current = date_input.entry.get()
        if current:
            current_label.configure(text=f"Aktueller Wert: '{current}'")
        else:
            current_label.configure(text="Aktueller Wert: (leer)")
    
    date_input.entry.bind('<KeyRelease>', lambda e: [date_input._on_key_release(e), update_display()], add='+')
    
    # Test-Buttons
    btn_frame = ctk.CTkFrame(test_frame, fg_color="transparent")
    btn_frame.pack(pady=20)
    
    result_label = ctk.CTkLabel(
        test_frame,
        text="",
        font=ctk.CTkFont(size=13),
        wraplength=500
    )
    result_label.pack(pady=10)
    
    def get_value():
        try:
            datum = date_input.get_date()
            if datum:
                result_label.configure(
                    text=f"✅ Datum: {datum.strftime('%d.%m.%Y')} (Wochentag: {datum.strftime('%A')})",
                    text_color="#27ae60"
                )
            else:
                result_label.configure(
                    text="⚠️ Kein Datum eingegeben",
                    text_color="#e67e22"
                )
        except ValueError as e:
            result_label.configure(
                text=f"❌ Fehler: {e}",
                text_color="#e74c3c"
            )
    
    def auto_type():
        """Auto-Type Funktion zum Testen"""
        date_input.clear()
        result_label.configure(text="Tippe automatisch: 02021990...", text_color="#3498db")
        
        sequence = "02021990"
        
        def type_next(index=0):
            if index < len(sequence):
                # Füge Zeichen ein
                current = date_input.entry.get()
                date_input.entry.delete(0, ctk.END)
                date_input.entry.insert(0, current + sequence[index])
                
                # Trigger KeyRelease
                from tkinter import Event
                event = Event()
                event.widget = date_input.entry
                event.keysym = sequence[index]
                date_input._on_key_release(event)
                update_display()
                
                # Nächstes Zeichen nach 300ms
                app.after(300, lambda: type_next(index + 1))
            else:
                result_label.configure(text="✅ Auto-Type abgeschlossen! Prüfe Ergebnis.", text_color="#27ae60")
        
        type_next()
    
    ctk.CTkButton(
        btn_frame,
        text="Datum auslesen",
        command=get_value,
        fg_color="#27ae60"
    ).pack(side="left", padx=5)
    
    ctk.CTkButton(
        btn_frame,
        text="Leeren",
        command=lambda: [date_input.clear(), update_display()]
    ).pack(side="left", padx=5)
    
    ctk.CTkButton(
        btn_frame,
        text="🤖 Auto-Type Test",
        command=auto_type,
        fg_color="#3498db"
    ).pack(side="left", padx=5)
    
    
    app.mainloop()