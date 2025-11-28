"""
Notification Manager - Moderne Toast-Benachrichtigungen
Container-basiert (direkt im Hauptfenster)
✅ FIX: Sichtbarkeit durch dedizierten Container und Z-Order Management
"""

import customtkinter as ctk
from typing import Literal, Optional
from datetime import datetime


class NotificationManager:
    """Verwaltet Toast-Benachrichtigungen im Hauptfenster"""
    
    # Notification-Typen
    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    
    # Farben pro Typ
    COLORS = {
        SUCCESS: {"bg": "#27ae60", "icon": "✓"},
        ERROR: {"bg": "#e74c3c", "icon": "✕"},
        WARNING: {"bg": "#e67e22", "icon": "⚠"},
        INFO: {"bg": "#3498db", "icon": "ℹ"}
    }
    
    def __init__(self, parent):
        self.parent = parent
        self.notifications = []
        self.max_notifications = 5
        self.notification_width = 400
        self.notification_height = 90
        self.padding = 15
        
        # ✅ Container wird erst bei Bedarf erstellt
        self.notification_container = None
        
    def _ensure_container(self):
        """Erstellt Container nur wenn noch nicht vorhanden"""
        if self.notification_container is None:
            self.notification_container = ctk.CTkFrame(
                self.parent,
                fg_color="transparent"
            )
            
            # Container rechts unten positionieren
            self.notification_container.place(
                relx=1.0,
                rely=1.0,
                x=-self.padding,
                y=-self.padding,
                anchor="se"
            )
            
            # Container immer im Vordergrund
            self.notification_container.lift()
            
            # ✅ Container bei Fenster-Updates aktualisieren
            self.parent.bind("<Configure>", lambda e: self._refresh_container(), add="+")
        
    def _refresh_container(self):
        """Stellt sicher dass Container immer oben ist"""
        try:
            if self.notification_container:
                self.notification_container.lift()
                for notif in self.notifications:
                    notif.lift()
        except:
            pass
        
    def show(self, 
             message: str, 
             typ: Literal["success", "error", "warning", "info"] = INFO,
             title: Optional[str] = None,
             duration: int = 4000):
        """
        Zeigt eine Notification an
        
        Args:
            message: Nachricht
            typ: success, error, warning, info
            title: Optional - Titel
            duration: Anzeigedauer in ms (0 = unbegrenzt)
        """
        # ✅ Container erstellen falls noch nicht vorhanden
        self._ensure_container()
        
        # Titel basierend auf Typ
        if title is None:
            titles = {
                self.SUCCESS: "Erfolg",
                self.ERROR: "Fehler",
                self.WARNING: "Warnung",
                self.INFO: "Info"
            }
            title = titles.get(typ, "Benachrichtigung")
        
        # Zu viele Notifications? Älteste entfernen
        if len(self.notifications) >= self.max_notifications:
            oldest = self.notifications[0]
            self.close_notification(oldest)
        
        # Neue Notification erstellen
        notification = self._create_notification(message, typ, title)
        self.notifications.append(notification)
        
        # Position berechnen und platzieren
        self._position_notifications()
        
        # Einblenden (Animation)
        self._animate_in(notification)
        
        # Auto-Close
        if duration > 0:
            notification.after(duration, lambda: self.close_notification(notification))
        
        return notification
    
    def _create_notification(self, message: str, typ: str, title: str) -> ctk.CTkFrame:
        """Erstellt Notification-Widget IM Container (nicht direkt im Parent)"""
        # Farben
        colors = self.COLORS.get(typ, self.COLORS[self.INFO])
        bg_color = colors["bg"]
        icon = colors["icon"]
        
        # ✅ WICHTIG: Notification im notification_container erstellen (nicht im parent!)
        notification = ctk.CTkFrame(
            self.notification_container,  # ✅ Hier ist der Fix!
            fg_color=bg_color,
            corner_radius=12,
            width=self.notification_width,
            height=self.notification_height,
            border_width=2,
            border_color=self._darken_color(bg_color)
        )
        notification.pack_propagate(False)
        
        # Content Frame
        content_frame = ctk.CTkFrame(notification, fg_color="transparent")
        content_frame.pack(fill="both", expand=True, padx=15, pady=12)
        
        # Icon + Titel Zeile
        header_frame = ctk.CTkFrame(content_frame, fg_color="transparent")
        header_frame.pack(fill="x", pady=(0, 5))
        
        # Icon
        ctk.CTkLabel(
            header_frame,
            text=icon,
            font=ctk.CTkFont(size=24, weight="bold"),
            text_color="white"
        ).pack(side="left", padx=(0, 10))
        
        # Titel
        ctk.CTkLabel(
            header_frame,
            text=title,
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="white"
        ).pack(side="left")
        
        # Close Button
        close_btn = ctk.CTkButton(
            header_frame,
            text="✕",
            width=28,
            height=28,
            fg_color="transparent",
            hover_color=self._darken_color(bg_color),
            text_color="white",
            font=ctk.CTkFont(size=16, weight="bold"),
            command=lambda: self.close_notification(notification)
        )
        close_btn.pack(side="right")
        
        # Nachricht
        message_label = ctk.CTkLabel(
            content_frame,
            text=message,
            font=ctk.CTkFont(size=12),
            text_color="white",
            anchor="w",
            justify="left",
            wraplength=340
        )
        message_label.pack(fill="x", pady=(0, 0))
        
        # Zeitstempel
        timestamp = datetime.now().strftime("%H:%M:%S")
        ctk.CTkLabel(
            content_frame,
            text=timestamp,
            font=ctk.CTkFont(size=9),
            text_color="#e0e0e0",
            anchor="e"
        ).pack(fill="x", pady=(5, 0))
        
        return notification
    
    def _position_notifications(self):
        """Positioniert alle Notifications vertikal (von unten nach oben) mit pack()"""
        # ✅ Verwende pack() statt place() - viel einfacher und keine Z-Order Probleme!
        for notif in self.notifications:
            notif.pack(side="bottom", pady=5)
            notif.lift()
    
    def _animate_in(self, notification: ctk.CTkFrame):
        """Animiert Notification ein (Fade)"""
        # Start bei 20% Opacity (simuliert durch Border)
        notification.configure(border_width=0)
        
        # Animation über 200ms
        steps = 10
        delay = 20
        
        def animate_step(step):
            if step > steps:
                notification.configure(border_width=2)
                return
            
            alpha = step / steps
            notification.configure(border_width=int(2 * alpha))
            
            notification.after(delay, lambda: animate_step(step + 1))
        
        animate_step(1)
    
    def _animate_out(self, notification: ctk.CTkFrame, callback=None):
        """Animiert Notification aus (Fade)"""
        steps = 8
        delay = 20
        
        def animate_step(step):
            if step > steps:
                notification.destroy()
                if callback:
                    callback()
                return
            
            # Opacity reduzieren
            alpha = 1 - (step / steps)
            notification.configure(border_width=max(0, int(2 * alpha)))
            
            notification.after(delay, lambda: animate_step(step + 1))
        
        animate_step(1)
    
    def close_notification(self, notification: ctk.CTkFrame):
        """Schließt eine Notification mit Animation"""
        if notification in self.notifications:
            self.notifications.remove(notification)
            
            # Ausblenden
            self._animate_out(notification, lambda: self._cleanup_after_close())
    
    def _cleanup_after_close(self):
        """Räumt auf nachdem Notification geschlossen wurde"""
        self._position_notifications()
        
        # ✅ Container entfernen wenn keine Notifications mehr da sind
        if len(self.notifications) == 0 and self.notification_container:
            self.notification_container.place_forget()
            self.notification_container.destroy()
            self.notification_container = None
    
    def _darken_color(self, hex_color: str) -> str:
        """Macht Farbe dunkler für Hover-Effekt"""
        # Entferne '#' falls vorhanden
        hex_color = hex_color.lstrip('#')
        
        # Konvertiere zu RGB
        r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        
        # Verdunkle um 20%
        r = max(0, int(r * 0.8))
        g = max(0, int(g * 0.8))
        b = max(0, int(b * 0.8))
        
        return f"#{r:02x}{g:02x}{b:02x}"
    
    def close_all(self):
        """Schließt alle Notifications"""
        for notification in self.notifications[:]:
            self.close_notification(notification)


# Globale Notification-Instanz
_notification_manager: Optional[NotificationManager] = None


def init_notifications(parent):
    """Initialisiert das Notification-System"""
    global _notification_manager
    _notification_manager = NotificationManager(parent)
    return _notification_manager


def show_success(message: str, title: str = None, duration: int = 4000):
    """Zeigt Erfolgs-Notification"""
    if _notification_manager:
        _notification_manager.show(message, NotificationManager.SUCCESS, title, duration)


def show_error(message: str, title: str = None, duration: int = 6000):
    """Zeigt Fehler-Notification"""
    if _notification_manager:
        _notification_manager.show(message, NotificationManager.ERROR, title, duration)


def show_warning(message: str, title: str = None, duration: int = 5000):
    """Zeigt Warnungs-Notification"""
    if _notification_manager:
        _notification_manager.show(message, NotificationManager.WARNING, title, duration)


def show_info(message: str, title: str = None, duration: int = 4000):
    """Zeigt Info-Notification"""
    if _notification_manager:
        _notification_manager.show(message, NotificationManager.INFO, title, duration)