"""
Zentraler DatePicker - verwendet von allen Dialogen
"""

import customtkinter as ctk
from datetime import date
import calendar


class DatePickerFrame(ctk.CTkFrame):
    """Custom Datumspicker mit dynamischer Tages-/Jahresliste"""

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
        span = range(center_year - self.year_window, center_year + self.year_window + 1)
        return [str(y) for y in span]

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