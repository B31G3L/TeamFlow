"""
Datenbank-Migrationen
Fügt fehlende Tabellen zu bestehenden Datenbanken hinzu
"""

import sqlite3
from pathlib import Path


def migrate_add_veranstaltungen_table(db_path: str = "teamplanner_v3.db"):
    """
    Fügt die Veranstaltungen-Tabelle hinzu, falls sie noch nicht existiert

    Args:
        db_path: Pfad zur Datenbank
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Prüfe ob Tabelle bereits existiert
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='veranstaltungen'
        """)

        if cursor.fetchone():
            print("✅ Veranstaltungen-Tabelle existiert bereits")
            return

        # Tabelle erstellen
        cursor.execute("""
            CREATE TABLE veranstaltungen (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT NOT NULL CHECK (length(name) >= 3),
                datum           DATE NOT NULL,
                ort             TEXT,
                beschreibung    TEXT,
                max_teilnehmer  INTEGER CHECK (max_teilnehmer IS NULL OR max_teilnehmer > 0),
                erfasst_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Indizes erstellen
        cursor.execute("""
            CREATE INDEX idx_veranstaltungen_datum
            ON veranstaltungen(datum)
        """)

        cursor.execute("""
            CREATE INDEX idx_veranstaltungen_jahr
            ON veranstaltungen(CAST(strftime('%Y', datum) AS INTEGER))
        """)

        conn.commit()
        print("✅ Veranstaltungen-Tabelle erfolgreich erstellt")

    except Exception as e:
        print(f"❌ Fehler bei Migration: {e}")
        conn.rollback()
    finally:
        conn.close()


def run_all_migrations(db_path: str = "teamplanner_v3.db"):
    """
    Führt alle Migrationen aus

    Args:
        db_path: Pfad zur Datenbank
    """
    print("🔄 Führe Datenbank-Migrationen aus...")
    migrate_add_veranstaltungen_table(db_path)
    print("✅ Alle Migrationen abgeschlossen")


if __name__ == "__main__":
    # Kann direkt ausgeführt werden
    run_all_migrations()
