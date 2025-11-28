"""
Automatisches Backup-System für Teamplanner
- Tägliche automatische Backups
- Backup-Rotation (behalte nur X neueste)
- Komprimierung (ZIP)
- Integrity-Checks
"""

import sqlite3
import shutil
from pathlib import Path
from datetime import datetime, timedelta
import zipfile
import json
from typing import Optional, List, Tuple
import threading
import time


class BackupManager:
    """Verwaltet automatische Datenbank-Backups"""
    
    def __init__(self, db_path: str = "teamplanner.db", 
                 backup_dir: str = "backups",
                 max_backups: int = 30,
                 auto_backup_hour: int = 2):
        """
        Args:
            db_path: Pfad zur Datenbank
            backup_dir: Backup-Verzeichnis
            max_backups: Max. Anzahl Backups (älteste werden gelöscht)
            auto_backup_hour: Uhrzeit für tägliches Backup (0-23)
        """
        from utils.logger import get_logger
        self.logger = get_logger("backup")
        
        self.db_path = Path(db_path)
        self.backup_dir = Path(backup_dir)
        self.max_backups = max_backups
        self.auto_backup_hour = auto_backup_hour
        
        # Backup-Verzeichnis erstellen
        self.backup_dir.mkdir(exist_ok=True)
        
        # Metadaten-Datei
        self.metadata_file = self.backup_dir / "backup_metadata.json"
        
        # Auto-Backup Thread
        self.auto_backup_thread = None
        self.auto_backup_running = False
        
        self.logger.info(f"BackupManager initialisiert: {self.backup_dir}")
    
    def create_backup(self, beschreibung: str = "") -> Optional[Path]:
        """
        Erstellt ein Backup der Datenbank
        
        Args:
            beschreibung: Optionale Beschreibung
        
        Returns:
            Pfad zum Backup oder None bei Fehler
        """
        try:
            self.logger.info("Starte Backup-Erstellung...")
            
            # Prüfe ob DB existiert
            if not self.db_path.exists():
                self.logger.error(f"Datenbank nicht gefunden: {self.db_path}")
                return None
            
            # Timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            
            # Backup-Name
            backup_name = f"teamplanner_backup_{timestamp}"
            backup_path = self.backup_dir / f"{backup_name}.db"
            zip_path = self.backup_dir / f"{backup_name}.zip"
            
            # 1. Datenbank-Backup (SQLite Backup API für konsistentes Backup)
            self._backup_database(backup_path)
            
            # 2. Integrity Check
            if not self._verify_backup(backup_path):
                self.logger.error("Backup-Verifizierung fehlgeschlagen")
                backup_path.unlink()
                return None
            
            # 3. Komprimieren
            self._compress_backup(backup_path, zip_path)
            
            # Unkomprimierte Datei löschen
            backup_path.unlink()
            
            # 4. Metadaten speichern
            self._save_metadata(zip_path, beschreibung)
            
            # 5. Alte Backups rotieren
            self._rotate_backups()
            
            file_size = zip_path.stat().st_size / 1024 / 1024  # MB
            self.logger.info(f"✅ Backup erfolgreich erstellt: {zip_path.name} ({file_size:.2f} MB)")
            
            return zip_path
            
        except Exception as e:
            self.logger.error(f"❌ Fehler beim Backup: {e}", exc_info=True)
            return None
    
    def _backup_database(self, target_path: Path):
        """Erstellt konsistentes Datenbank-Backup"""
        self.logger.debug(f"Kopiere Datenbank nach {target_path}")
        
        # SQLite Backup API verwenden (konsistenter als file copy)
        source_conn = sqlite3.connect(str(self.db_path))
        target_conn = sqlite3.connect(str(target_path))
        
        with target_conn:
            source_conn.backup(target_conn)
        
        source_conn.close()
        target_conn.close()
    
    def _verify_backup(self, backup_path: Path) -> bool:
        """Verifiziert Backup-Integrität"""
        self.logger.debug(f"Verifiziere Backup: {backup_path}")
        
        try:
            conn = sqlite3.connect(str(backup_path))
            cursor = conn.cursor()
            
            # PRAGMA integrity_check
            cursor.execute("PRAGMA integrity_check")
            result = cursor.fetchone()
            
            conn.close()
            
            is_ok = result[0] == "ok"
            if is_ok:
                self.logger.debug("✓ Backup-Integrität OK")
            else:
                self.logger.error(f"✗ Backup-Integrität fehlgeschlagen: {result}")
            
            return is_ok
            
        except Exception as e:
            self.logger.error(f"Fehler bei Backup-Verifizierung: {e}")
            return False
    
    def _compress_backup(self, source: Path, target: Path):
        """Komprimiert Backup als ZIP"""
        self.logger.debug(f"Komprimiere Backup nach {target}")
        
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(source, source.name)
    
    def _save_metadata(self, backup_path: Path, beschreibung: str):
        """Speichert Backup-Metadaten"""
        metadata = self._load_metadata()
        
        metadata[backup_path.name] = {
            "timestamp": datetime.now().isoformat(),
            "beschreibung": beschreibung,
            "size_bytes": backup_path.stat().st_size,
            "db_path": str(self.db_path)
        }
        
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    def _load_metadata(self) -> dict:
        """Lädt Backup-Metadaten"""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}
    
    def _rotate_backups(self):
        """Löscht alte Backups"""
        backups = self.list_backups()
        
        if len(backups) <= self.max_backups:
            return
        
        # Älteste zuerst
        backups_sorted = sorted(backups, key=lambda x: x[1])
        
        # Zu löschende Backups
        to_delete = backups_sorted[:len(backups) - self.max_backups]
        
        for backup_path, _ in to_delete:
            try:
                backup_path.unlink()
                self.logger.info(f"Altes Backup gelöscht: {backup_path.name}")
            except Exception as e:
                self.logger.error(f"Fehler beim Löschen von {backup_path.name}: {e}")
        
        # Metadaten aktualisieren
        metadata = self._load_metadata()
        for backup_path, _ in to_delete:
            metadata.pop(backup_path.name, None)
        
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    def list_backups(self) -> List[Tuple[Path, datetime]]:
        """
        Listet alle Backups auf
        
        Returns:
            Liste von (Path, datetime) Tupeln
        """
        backups = []
        
        for backup_file in self.backup_dir.glob("teamplanner_backup_*.zip"):
            # Timestamp aus Dateinamen extrahieren
            try:
                timestamp_str = backup_file.stem.split("_")[-2] + "_" + backup_file.stem.split("_")[-1]
                timestamp = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                backups.append((backup_file, timestamp))
            except Exception:
                continue
        
        return backups
    
    def restore_backup(self, backup_path: Path, target_path: Optional[Path] = None) -> bool:
        """
        Stellt Backup wieder her
        
        Args:
            backup_path: Pfad zum Backup-ZIP
            target_path: Ziel-Pfad (default: original db_path)
        
        Returns:
            True bei Erfolg
        """
        try:
            self.logger.info(f"Starte Wiederherstellung von {backup_path.name}")
            
            if target_path is None:
                target_path = self.db_path
            
            # Backup des aktuellen Zustands
            if target_path.exists():
                backup_current = target_path.with_suffix(f".db.before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
                shutil.copy2(target_path, backup_current)
                self.logger.info(f"Aktueller Zustand gesichert: {backup_current.name}")
            
            # Entpacken
            temp_dir = self.backup_dir / "temp_restore"
            temp_dir.mkdir(exist_ok=True)
            
            with zipfile.ZipFile(backup_path, 'r') as zipf:
                zipf.extractall(temp_dir)
            
            # DB-Datei finden
            restored_db = None
            for file in temp_dir.glob("*.db"):
                restored_db = file
                break
            
            if not restored_db:
                self.logger.error("Keine DB-Datei im Backup gefunden")
                shutil.rmtree(temp_dir)
                return False
            
            # Verifizieren
            if not self._verify_backup(restored_db):
                self.logger.error("Wiederhergestellte Datenbank ist beschädigt")
                shutil.rmtree(temp_dir)
                return False
            
            # Kopieren
            shutil.copy2(restored_db, target_path)
            
            # Temp aufräumen
            shutil.rmtree(temp_dir)
            
            self.logger.info(f"✅ Backup erfolgreich wiederhergestellt")
            return True
            
        except Exception as e:
            self.logger.error(f"❌ Fehler bei Wiederherstellung: {e}", exc_info=True)
            return False
    
    def start_auto_backup(self):
        """Startet automatisches tägliches Backup"""
        if self.auto_backup_running:
            self.logger.warning("Auto-Backup läuft bereits")
            return
        
        self.auto_backup_running = True
        self.auto_backup_thread = threading.Thread(
            target=self._auto_backup_worker,
            daemon=True
        )
        self.auto_backup_thread.start()
        
        self.logger.info(f"Auto-Backup gestartet (täglich um {self.auto_backup_hour}:00 Uhr)")
    
    def stop_auto_backup(self):
        """Stoppt automatisches Backup"""
        self.auto_backup_running = False
        self.logger.info("Auto-Backup gestoppt")
    
    def _auto_backup_worker(self):
        """Worker-Thread für automatische Backups"""
        last_backup_date = None
        
        while self.auto_backup_running:
            now = datetime.now()
            
            # Prüfen ob Backup-Zeit erreicht und noch nicht heute gemacht
            if (now.hour == self.auto_backup_hour and 
                last_backup_date != now.date()):
                
                self.logger.info("Starte automatisches Backup...")
                backup_path = self.create_backup(beschreibung="Automatisches Backup")
                
                if backup_path:
                    last_backup_date = now.date()
                else:
                    self.logger.error("Automatisches Backup fehlgeschlagen")
            
            # Warte 1 Stunde
            time.sleep(3600)
    
    def get_backup_statistics(self) -> dict:
        """Gibt Backup-Statistiken zurück"""
        backups = self.list_backups()
        
        if not backups:
            return {
                "anzahl": 0,
                "aeltestes": None,
                "neuestes": None,
                "gesamt_groesse_mb": 0
            }
        
        backups_sorted = sorted(backups, key=lambda x: x[1])
        
        total_size = sum(b[0].stat().st_size for b in backups)
        
        return {
            "anzahl": len(backups),
            "aeltestes": backups_sorted[0][1],
            "neuestes": backups_sorted[-1][1],
            "gesamt_groesse_mb": total_size / 1024 / 1024
        }


# Globale Backup-Manager Instanz
_backup_manager = None


def get_backup_manager(db_path: str = "teamplanner.db") -> BackupManager:
    """Gibt Singleton Backup-Manager zurück"""
    global _backup_manager
    if _backup_manager is None:
        _backup_manager = BackupManager(db_path=db_path)
    return _backup_manager


def create_backup_now(beschreibung: str = "Manuelles Backup") -> Optional[Path]:
    """Erstellt sofort ein Backup"""
    manager = get_backup_manager()
    return manager.create_backup(beschreibung)