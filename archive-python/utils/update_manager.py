"""
GitHub Release Update Manager für Teamplanner
- Prüft auf neue Versions über GitHub API
- Zeigt Changelog an
- Bietet Download-Link
"""

import requests
import json
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta
from pathlib import Path
import webbrowser


class UpdateManager:
    """Verwaltet Updates über GitHub Releases"""
    
    # GitHub Repository Info
    GITHUB_USER = "B31G3L"  
    GITHUB_REPO = "teamplanner-python"        
    
    # Aktuelle Version (wird aus __version__.py gelesen)
    CURRENT_VERSION = "1.0.0"  # Fallback
    
    # API URLs
    API_BASE = f"https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}"
    RELEASES_URL = f"{API_BASE}/releases"
    LATEST_RELEASE_URL = f"{API_BASE}/releases/latest"
    
    # Cache
    CACHE_FILE = Path("update_cache.json")
    CACHE_DURATION = timedelta(hours=6)  # 6 Stunden Cache
    
    def __init__(self):
        from utils.logger import get_logger
        self.logger = get_logger("update")
        
        # Versuche Version aus __version__.py zu lesen
        try:
            version_file = Path("__version__.py")
            if version_file.exists():
                with open(version_file, 'r') as f:
                    for line in f:
                        if line.startswith("__version__"):
                            self.CURRENT_VERSION = line.split("=")[1].strip().strip('"\'')
                            break
        except Exception as e:
            self.logger.warning(f"Version konnte nicht geladen werden: {e}")
        
        self.logger.info(f"UpdateManager initialisiert (Version: {self.CURRENT_VERSION})")
    
    def check_for_updates(self, force: bool = False) -> Optional[Dict]:
        """
        Prüft auf neue Version
        
        Args:
            force: Ignoriert Cache und prüft immer
        
        Returns:
            Dict mit Update-Info oder None wenn kein Update verfügbar
            {
                'version': '1.2.0',
                'name': 'Version 1.2.0 - Feature Update',
                'body': 'Changelog...',
                'html_url': 'https://github.com/...',
                'download_url': 'https://github.com/.../teamplanner.exe',
                'published_at': '2025-01-15T10:00:00Z',
                'size_mb': 15.5
            }
        """
        try:
            self.logger.info("Prüfe auf Updates...")
            
            # Cache prüfen (außer force)
            if not force:
                cached = self._load_cache()
                if cached:
                    self.logger.info("Update-Info aus Cache geladen")
                    return cached
            
            # GitHub API abfragen
            self.logger.debug(f"Rufe GitHub API ab: {self.LATEST_RELEASE_URL}")
            
            response = requests.get(
                self.LATEST_RELEASE_URL,
                timeout=10,
                headers={
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": f"Teamplanner/{self.CURRENT_VERSION}"
                }
            )
            
            if response.status_code == 404:
                self.logger.info("Keine Releases auf GitHub gefunden")
                return None
            
            response.raise_for_status()
            release_data = response.json()
            
            # Version extrahieren und vergleichen
            latest_version = release_data.get('tag_name', '').lstrip('v')
            
            if not latest_version:
                self.logger.warning("Keine Version in Release gefunden")
                return None
            
            self.logger.info(f"Neueste Version auf GitHub: {latest_version}")
            self.logger.info(f"Aktuelle Version: {self.CURRENT_VERSION}")
            
            # Versionsvergleich
            if not self._is_newer_version(latest_version, self.CURRENT_VERSION):
                self.logger.info("App ist aktuell")
                self._save_cache(None)  # Leerer Cache = kein Update
                return None
            
            # Update verfügbar!
            self.logger.info(f"🎉 Update verfügbar: {latest_version}")
            
            # Download-URL finden (erste .exe Datei in Assets)
            download_url = None
            file_size_mb = 0
            
            for asset in release_data.get('assets', []):
                if asset.get('name', '').endswith('.exe'):
                    download_url = asset.get('browser_download_url')
                    file_size_mb = asset.get('size', 0) / 1024 / 1024
                    break
            
            if not download_url:
                self.logger.warning("Keine .exe Datei in Release gefunden")
                # Fallback auf Release-Seite
                download_url = release_data.get('html_url')
            
            update_info = {
                'version': latest_version,
                'name': release_data.get('name', f'Version {latest_version}'),
                'body': release_data.get('body', 'Keine Beschreibung verfügbar'),
                'html_url': release_data.get('html_url'),
                'download_url': download_url,
                'published_at': release_data.get('published_at'),
                'size_mb': round(file_size_mb, 1) if file_size_mb else None
            }
            
            # Im Cache speichern
            self._save_cache(update_info)
            
            return update_info
            
        except requests.RequestException as e:
            self.logger.error(f"Fehler beim Abrufen der Updates: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Unerwarteter Fehler bei Update-Prüfung: {e}", exc_info=True)
            return None
    
    def _is_newer_version(self, latest: str, current: str) -> bool:
        """
        Vergleicht Versionen (Semantic Versioning)
        
        Returns:
            True wenn latest > current
        """
        try:
            # Bereinige Versionen (entferne 'v' prefix, etc.)
            latest = latest.lstrip('v').strip()
            current = current.lstrip('v').strip()
            
            # Split in Major.Minor.Patch
            latest_parts = [int(x) for x in latest.split('.')]
            current_parts = [int(x) for x in current.split('.')]
            
            # Fülle mit 0 auf (z.B. 1.0 -> 1.0.0)
            while len(latest_parts) < 3:
                latest_parts.append(0)
            while len(current_parts) < 3:
                current_parts.append(0)
            
            # Vergleiche
            for l, c in zip(latest_parts, current_parts):
                if l > c:
                    return True
                elif l < c:
                    return False
            
            return False  # Gleiche Version
            
        except Exception as e:
            self.logger.error(f"Fehler beim Versionsvergleich: {e}")
            return False
    
    def _load_cache(self) -> Optional[Dict]:
        """Lädt Update-Info aus Cache"""
        try:
            if not self.CACHE_FILE.exists():
                return None
            
            # Prüfe Alter
            cache_age = datetime.now() - datetime.fromtimestamp(
                self.CACHE_FILE.stat().st_mtime
            )
            
            if cache_age > self.CACHE_DURATION:
                self.logger.debug("Cache ist veraltet")
                return None
            
            # Lade Daten
            with open(self.CACHE_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # None bedeutet "kein Update verfügbar"
            if data is None:
                self.logger.debug("Cache: Kein Update verfügbar")
                return None
            
            self.logger.debug(f"Cache geladen: Version {data.get('version')}")
            return data
            
        except Exception as e:
            self.logger.error(f"Fehler beim Laden des Caches: {e}")
            return None
    
    def _save_cache(self, update_info: Optional[Dict]):
        """Speichert Update-Info im Cache"""
        try:
            with open(self.CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(update_info, f, indent=2, ensure_ascii=False)
            
            self.logger.debug("Cache gespeichert")
            
        except Exception as e:
            self.logger.error(f"Fehler beim Speichern des Caches: {e}")
    
    def open_download_page(self, url: str):
        """Öffnet Download-Seite im Browser"""
        try:
            self.logger.info(f"Öffne Download-Seite: {url}")
            webbrowser.open(url)
        except Exception as e:
            self.logger.error(f"Fehler beim Öffnen der Download-Seite: {e}")
    
    def get_current_version(self) -> str:
        """Gibt aktuelle Version zurück"""
        return self.CURRENT_VERSION
    
    def clear_cache(self):
        """Löscht Update-Cache"""
        try:
            if self.CACHE_FILE.exists():
                self.CACHE_FILE.unlink()
                self.logger.info("Update-Cache gelöscht")
        except Exception as e:
            self.logger.error(f"Fehler beim Löschen des Caches: {e}")


# Globale Update-Manager Instanz
_update_manager: Optional[UpdateManager] = None


def get_update_manager() -> UpdateManager:
    """Gibt Singleton Update-Manager zurück"""
    global _update_manager
    if _update_manager is None:
        _update_manager = UpdateManager()
    return _update_manager


def check_for_updates(force: bool = False) -> Optional[Dict]:
    """Convenience-Funktion für Update-Check"""
    manager = get_update_manager()
    return manager.check_for_updates(force=force)