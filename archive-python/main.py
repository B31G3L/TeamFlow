"""
Teamplanner - Haupteinstiegspunkt
Moderne Team- und Urlaubsverwaltung mit CustomTkinter

✅ Mit Logging, Auto-Backup und Validierung
"""

import customtkinter as ctk
import sys
from pathlib import Path

# Utils importieren (Logging, Backup, Validierung)
try:
    from utils import init_logging, get_logger, get_backup_manager
    UTILS_AVAILABLE = True
except ImportError:
    UTILS_AVAILABLE = False
    print("⚠️  Utils-Module nicht gefunden. Einige Features sind deaktiviert.")

from gui.hauptfenster import TeamplannerHauptfenster


def main():
    """Startet den Teamplanner"""
    
    # ============================================================
    # SCHRITT 1: Logging initialisieren
    # ============================================================
    if UTILS_AVAILABLE:
        init_logging()
        logger = get_logger("main")
        
        logger.info("=" * 80)
        logger.info("Teamplanner wird gestartet...")
        logger.info(f"Python Version: {sys.version}")
        logger.info(f"Arbeitsverzeichnis: {Path.cwd()}")
        logger.info("=" * 80)
    else:
        logger = None
    
    # Dark Mode aktivieren
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("blue")
    
    try:
        # ============================================================
        # SCHRITT 2: Backup-Manager initialisieren
        # ============================================================
        if UTILS_AVAILABLE:
            try:
                backup_manager = get_backup_manager()
                backup_manager.start_auto_backup()
                logger.info("✅ Auto-Backup aktiviert (täglich um 2:00 Uhr)")
                
                # Backup-Statistiken loggen
                stats = backup_manager.get_backup_statistics()
                if stats['anzahl'] > 0:
                    logger.info(f"📦 Vorhandene Backups: {stats['anzahl']} "
                              f"(Gesamt: {stats['gesamt_groesse_mb']:.2f} MB)")
                else:
                    logger.info("📦 Keine vorhandenen Backups")
            except Exception as e:
                logger.error(f"Fehler beim Backup-Manager: {e}", exc_info=True)
                print(f"⚠️  Backup-System konnte nicht gestartet werden: {e}")
        
        # ============================================================
        # SCHRITT 3: Hauptanwendung starten
        # ============================================================
        if logger:
            logger.info("Erstelle Hauptfenster...")
        
        app = TeamplannerHauptfenster()
        
        if logger:
            logger.info("✅ Hauptfenster erstellt")
            logger.info("Starte GUI-Event-Loop...")
        
        app.run()
        
        if logger:
            logger.info("GUI-Event-Loop beendet")
        
    except KeyboardInterrupt:
        if logger:
            logger.info("Benutzer hat Anwendung abgebrochen (Ctrl+C)")
        print("\n👋 Teamplanner wurde beendet")
        
    except Exception as e:
        if logger:
            logger.critical(f"❌ Kritischer Fehler beim Starten: {e}", exc_info=True)
        
        print("=" * 80)
        print(f"❌ FEHLER: {e}")
        print("=" * 80)
        
        if UTILS_AVAILABLE:
            print(f"\n📝 Details wurden in logs/errors.log gespeichert")
        
        import traceback
        traceback.print_exc()
        
        input("\nDrücke Enter zum Beenden...")
        
    finally:
        if logger:
            logger.info("Teamplanner wird beendet")
            logger.info("=" * 80)
            
            # Log-Cleanup (Logs älter als 90 Tage löschen)
            try:
                from utils.logger import TeamplannerLogger
                log_manager = TeamplannerLogger()
                log_manager.cleanup_old_logs(days=90)
            except Exception:
                pass


if __name__ == "__main__":
    main()