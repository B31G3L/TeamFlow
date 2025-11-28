"""
Update-Dialog für Teamplanner
Zeigt verfügbare Updates mit Changelog an
"""

import customtkinter as ctk
import tkinter.messagebox as messagebox
from typing import Dict, Optional
import markdown2
from gui.notification_manager import NotificationManager


class UpdateDialog(ctk.CTkToplevel):
    """Dialog für verfügbare Updates"""

    def __init__(self, parent, update_info: Dict, update_manager):
        super().__init__(parent)

        self.update_info = update_info
        self.update_manager = update_manager
        self.result = None

        # Notification Manager
        self.notification_manager = NotificationManager(self)
        
        # Fenster konfigurieren
        self.title("Update verfügbar")
        self.geometry("700x600")
        self.resizable(True, True)
        self.minsize(600, 500)
        
        # Modal
        self.transient(parent)
        self.grab_set()
        
        self._setup_gui()
        
        # Zentrieren
        self.update_idletasks()
        self._center_window()
        
        # Focus
        self.focus()
    
    def _center_window(self):
        """Zentriert Fenster"""
        width = self.winfo_width()
        height = self.winfo_height()
        x = (self.winfo_screenwidth() // 2) - (width // 2)
        y = (self.winfo_screenheight() // 2) - (height // 2)
        self.geometry(f"{width}x{height}+{x}+{y}")
    
    def _setup_gui(self):
        """Erstellt UI"""
        
        # Header mit Gradient-Effekt
        header = ctk.CTkFrame(self, fg_color="#27ae60", height=100, corner_radius=0)
        header.pack(fill="x")
        header.pack_propagate(False)
        
        header_content = ctk.CTkFrame(header, fg_color="transparent")
        header_content.pack(fill="both", expand=True, padx=30, pady=20)
        
        # Icon + Titel
        title_frame = ctk.CTkFrame(header_content, fg_color="transparent")
        title_frame.pack(fill="x")
        
        ctk.CTkLabel(
            title_frame,
            text="🎉",
            font=ctk.CTkFont(size=48)
        ).pack(side="left", padx=(0, 15))
        
        version_frame = ctk.CTkFrame(title_frame, fg_color="transparent")
        version_frame.pack(side="left", fill="both", expand=True)
        
        ctk.CTkLabel(
            version_frame,
            text="Update verfügbar!",
            font=ctk.CTkFont(size=24, weight="bold"),
            text_color="white"
        ).pack(anchor="w")
        
        version_text = f"Version {self.update_info['version']}"
        if self.update_info.get('size_mb'):
            version_text += f" ({self.update_info['size_mb']} MB)"
        
        ctk.CTkLabel(
            version_frame,
            text=version_text,
            font=ctk.CTkFont(size=14),
            text_color="white"
        ).pack(anchor="w")
        
        # Aktuelle Version
        current_version = self.update_manager.get_current_version()
        ctk.CTkLabel(
            header_content,
            text=f"Installierte Version: {current_version}",
            font=ctk.CTkFont(size=11),
            text_color="#e8f5e9"
        ).pack(anchor="w", pady=(5, 0))
        
        # Changelog
        changelog_frame = ctk.CTkFrame(self, fg_color="transparent")
        changelog_frame.pack(fill="both", expand=True, padx=30, pady=20)
        
        ctk.CTkLabel(
            changelog_frame,
            text="📝 Was ist neu?",
            font=ctk.CTkFont(size=16, weight="bold"),
            anchor="w"
        ).pack(fill="x", pady=(0, 10))
        
        # Scrollbarer Changelog
        self.changelog_text = ctk.CTkTextbox(
            changelog_frame,
            wrap="word",
            font=ctk.CTkFont(size=12)
        )
        self.changelog_text.pack(fill="both", expand=True)
        
        # Changelog einfügen
        changelog = self.update_info.get('body', 'Keine Informationen verfügbar')
        self._format_changelog(changelog)
        
        self.changelog_text.configure(state="disabled")
        
        # Veröffentlichungsdatum
        if self.update_info.get('published_at'):
            try:
                from datetime import datetime
                pub_date = datetime.fromisoformat(
                    self.update_info['published_at'].replace('Z', '+00:00')
                )
                date_str = pub_date.strftime("%d.%m.%Y %H:%M")
                
                ctk.CTkLabel(
                    changelog_frame,
                    text=f"Veröffentlicht: {date_str}",
                    font=ctk.CTkFont(size=10),
                    text_color="#7f8c8d"
                ).pack(anchor="w", pady=(5, 0))
            except Exception:
                pass
        
        # Buttons
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill="x", padx=30, pady=(0, 20))
        
        # Später erinnern
        ctk.CTkButton(
            btn_frame,
            text="Später erinnern",
            command=self.spaeter,
            height=40,
            fg_color="#95a5a6",
            hover_color="#7f8c8d",
            font=ctk.CTkFont(size=13)
        ).pack(side="left", fill="x", expand=True, padx=(0, 10))
        
        # Update herunterladen
        download_text = "Jetzt herunterladen" if self.update_info.get('download_url', '').endswith('.exe') else "Release-Seite öffnen"
        
        self.download_btn = ctk.CTkButton(
            btn_frame,
            text=download_text,
            command=self.herunterladen,
            height=40,
            fg_color="#27ae60",
            hover_color="#229954",
            font=ctk.CTkFont(size=13, weight="bold")
        )
        self.download_btn.pack(side="right", fill="x", expand=True, padx=(10, 0))
        
        # Keyboard Shortcuts
        self.bind("<Escape>", lambda e: self.spaeter())
        self.bind("<Return>", lambda e: self.herunterladen())
    
    def _format_changelog(self, changelog: str):
        """Formatiert Changelog (Markdown -> Text mit Formatierung)"""
        self.changelog_text.configure(state="normal")
        
        lines = changelog.split('\n')
        
        for line in lines:
            line = line.strip()
            
            if not line:
                self.changelog_text.insert("end", "\n")
                continue
            
            # Überschriften
            if line.startswith('###'):
                text = line.replace('###', '').strip()
                self.changelog_text.insert("end", f"\n{text}\n", "heading3")
                continue
            elif line.startswith('##'):
                text = line.replace('##', '').strip()
                self.changelog_text.insert("end", f"\n{text}\n", "heading2")
                continue
            elif line.startswith('#'):
                text = line.replace('#', '').strip()
                self.changelog_text.insert("end", f"\n{text}\n", "heading1")
                continue
            
            # Listenpunkte
            if line.startswith('- ') or line.startswith('* '):
                text = line[2:].strip()
                self.changelog_text.insert("end", f"  • {text}\n")
                continue
            
            # Normale Zeile
            self.changelog_text.insert("end", f"{line}\n")
        
        # Tags konfigurieren
        self.changelog_text.tag_config("heading1", font=ctk.CTkFont(size=16, weight="bold"))
        self.changelog_text.tag_config("heading2", font=ctk.CTkFont(size=14, weight="bold"))
        self.changelog_text.tag_config("heading3", font=ctk.CTkFont(size=12, weight="bold"))
    
    def herunterladen(self):
        """Öffnet Download-Link"""
        url = self.update_info.get('download_url') or self.update_info.get('html_url')
        
        if not url:
            messagebox.showerror(
                "Fehler",
                "Kein Download-Link verfügbar",
                parent=self
            )
            return
        
        # Browser öffnen
        self.update_manager.open_download_page(url)

        # Info-Notification
        self.notification_manager.show(
            "Der Download wurde im Browser geöffnet.\n\n"
            "Nach dem Download:\n"
            "1. Teamplanner schließen\n"
            "2. Neue Version installieren\n"
            "3. Teamplanner neu starten",
            typ=self.notification_manager.INFO,
            title="Download gestartet",
            duration=7000
        )

        self.result = "download"
        self.destroy()
    
    def spaeter(self):
        """Schließt Dialog ohne Download"""
        self.result = "later"
        self.destroy()


def show_update_dialog(parent, update_info: Dict, update_manager) -> Optional[str]:
    """
    Zeigt Update-Dialog an
    
    Returns:
        'download' oder 'later' oder None
    """
    dialog = UpdateDialog(parent, update_info, update_manager)
    parent.wait_window(dialog)
    return dialog.result