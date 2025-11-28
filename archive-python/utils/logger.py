"""
Zentrales Logging-System für Teamplanner
- Rotation nach Größe und Datum
- Verschiedene Log-Level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- Separate Logs für DB, GUI, Business Logic
"""

import logging
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
import os
from datetime import datetime
from pathlib import Path


class TeamplannerLogger:
    """Zentraler Logger mit konfigurierbaren Handlern"""
    
    # Singleton
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        
        # Log-Verzeichnis erstellen
        self.log_dir = Path("logs")
        self.log_dir.mkdir(exist_ok=True)
        
        # Root-Logger konfigurieren
        self.root_logger = logging.getLogger("teamplanner")
        self.root_logger.setLevel(logging.DEBUG)
        
        # Formatter
        self.detailed_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)-20s | %(funcName)-25s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        self.simple_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%H:%M:%S'
        )
        
        # Handler erstellen
        self._setup_handlers()
        
        # Initial-Log
        self.root_logger.info("=" * 80)
        self.root_logger.info(f"Teamplanner gestartet - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.root_logger.info("=" * 80)
    
    def _setup_handlers(self):
        """Richtet alle Log-Handler ein"""
        
        # 1. Console Handler (nur INFO+)
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(self.simple_formatter)
        self.root_logger.addHandler(console_handler)
        
        # 2. Haupt-Logfile (alle Levels, rotiert nach Größe)
        main_file = self.log_dir / "teamplanner.log"
        main_handler = RotatingFileHandler(
            main_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding='utf-8'
        )
        main_handler.setLevel(logging.DEBUG)
        main_handler.setFormatter(self.detailed_formatter)
        self.root_logger.addHandler(main_handler)
        
        # 3. Error-Logfile (nur ERROR+, rotiert täglich)
        error_file = self.log_dir / "errors.log"
        error_handler = TimedRotatingFileHandler(
            error_file,
            when='midnight',
            interval=1,
            backupCount=30,
            encoding='utf-8'
        )
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(self.detailed_formatter)
        self.root_logger.addHandler(error_handler)
        
        # 4. Database-Logfile (spezifisch für DB-Operationen)
        db_file = self.log_dir / "database.log"
        db_handler = RotatingFileHandler(
            db_file,
            maxBytes=5 * 1024 * 1024,  # 5 MB
            backupCount=3,
            encoding='utf-8'
        )
        db_handler.setLevel(logging.DEBUG)
        db_handler.setFormatter(self.detailed_formatter)
        
        # DB-Logger extra erstellen
        db_logger = logging.getLogger("teamplanner.database")
        db_logger.addHandler(db_handler)
        db_logger.setLevel(logging.DEBUG)
    
    def get_logger(self, name: str = None) -> logging.Logger:
        """
        Gibt einen Logger zurück
        
        Args:
            name: Name des Loggers (z.B. 'gui', 'database', 'export')
                 Wenn None, wird Root-Logger zurückgegeben
        
        Returns:
            Logger-Instanz
        """
        if name:
            return logging.getLogger(f"teamplanner.{name}")
        return self.root_logger
    
    def cleanup_old_logs(self, days: int = 90):
        """
        Löscht Log-Dateien älter als X Tage
        
        Args:
            days: Alter in Tagen
        """
        logger = self.get_logger("cleanup")
        logger.info(f"Starte Log-Cleanup (älter als {days} Tage)")
        
        cutoff = datetime.now().timestamp() - (days * 24 * 3600)
        deleted = 0
        
        for log_file in self.log_dir.glob("*.log*"):
            if log_file.stat().st_mtime < cutoff:
                try:
                    log_file.unlink()
                    deleted += 1
                    logger.debug(f"Gelöscht: {log_file.name}")
                except Exception as e:
                    logger.error(f"Fehler beim Löschen von {log_file.name}: {e}")
        
        logger.info(f"Log-Cleanup abgeschlossen: {deleted} Dateien gelöscht")


# Globale Logger-Instanz
_logger_instance = None


def get_logger(name: str = None) -> logging.Logger:
    """
    Convenience-Funktion zum Abrufen eines Loggers
    
    Usage:
        from utils.logger import get_logger
        logger = get_logger("gui")
        logger.info("Hauptfenster geöffnet")
    """
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = TeamplannerLogger()
    return _logger_instance.get_logger(name)


def init_logging():
    """Initialisiert das Logging-System"""
    global _logger_instance
    if _logger_instance is None:
        _logger_instance = TeamplannerLogger()
    return _logger_instance


# Spezielle Logger für häufig verwendete Module
def get_gui_logger():
    return get_logger("gui")


def get_db_logger():
    return get_logger("database")


def get_export_logger():
    return get_logger("export")


def get_validation_logger():
    return get_logger("validation")