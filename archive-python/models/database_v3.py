"""
Teamplanner V3.0 Database Manager
Clean Architecture - Production Ready
"""

import sqlite3
from pathlib import Path
from typing import Optional, List, Tuple
from datetime import date, datetime, timedelta 

from .entities import *
from .repositories import *


class TeamplannerDatabase:
    """
    Hauptdatenbank-Manager
    Koordiniert alle Repositories und bietet High-Level API
    """
    
    def __init__(self, db_path: str = "teamplanner_v3.db"):
        """
        Initialisiert Datenbank
        
        Args:
            db_path: Pfad zur SQLite-Datei
        """
        self.db_path = Path(db_path)
        self.conn: Optional[sqlite3.Connection] = None
        
        # Repositories (werden bei Bedarf initialisiert)
        self._abteilungen: Optional[AbteilungRepository] = None
        self._mitarbeiter: Optional[MitarbeiterRepository] = None
        self._urlaub: Optional[UrlaubRepository] = None
        self._krankheit: Optional[KrankheitRepository] = None
        self._schulung: Optional[SchulungRepository] = None
        self._ueberstunden: Optional[UeberstundenRepository] = None
        self._feiertage: Optional[FeiertagRepository] = None
        self._veranstaltungen: Optional[VeranstaltungRepository] = None
        
        # Verbindung öffnen & Schema initialisieren
        self._connect()
        self._init_schema()
    
    # ==================== CONNECTION MANAGEMENT ====================
    
    def _connect(self):
        """Öffnet Datenbankverbindung"""
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        
        # Optimierungen
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.execute("PRAGMA synchronous = NORMAL")
        self.conn.execute("PRAGMA temp_store = MEMORY")
        self.conn.execute("PRAGMA cache_size = -64000")
        
        print(f"✅ Datenbank verbunden: {self.db_path}")
    
    def _init_schema(self):
        """Initialisiert Datenbankschema"""
        try:
            # Prüfe ob Schema bereits existiert
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='mitarbeiter'
            """)

            if cursor.fetchone():
                print("✅ Schema bereits vorhanden")
                # Führe Migrationen aus für bestehende Datenbanken
                self._run_migrations()
                return

            # Schema erstellen
            schema_file = Path(__file__).parent / "schema.sql"

            if schema_file.exists():
                print(f"📄 Lade Schema aus: {schema_file}")
                with open(schema_file, 'r', encoding='utf-8') as f:
                    schema_sql = f.read()
                self.conn.executescript(schema_sql)
                self.conn.commit()
                print("✅ Schema erstellt aus schema.sql")
            else:
                # Fallback: Inline Schema
                print(f"⚠️  Schema-Datei nicht gefunden: {schema_file}")
                print("📄 Erstelle Schema inline...")
                self._create_schema_inline()
                print("✅ Schema erstellt (inline)")

        except Exception as e:
            print(f"❌ Fehler bei Schema-Initialisierung: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def _create_schema_inline(self):
        """Erstellt Schema inline (wenn schema.sql nicht gefunden)"""
        schema = """
-- ============================================================================
-- TEAMPLANNER V3.0 DATABASE SCHEMA
-- Clean Architecture - Production Ready
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- STAMMDATEN
-- ============================================================================

CREATE TABLE abteilungen (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE COLLATE NOCASE,
    farbe_hex       TEXT NOT NULL DEFAULT '#95a5a6',
    sortierung      INTEGER NOT NULL DEFAULT 999,

    CHECK (length(name) >= 2),
    CHECK (farbe_hex GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')
);

CREATE TABLE mitarbeiter (
    id                  TEXT PRIMARY KEY CHECK (length(id) >= 3),
    abteilung_id        INTEGER NOT NULL REFERENCES abteilungen(id),

    vorname             TEXT NOT NULL CHECK (length(vorname) >= 2),
    nachname            TEXT NOT NULL CHECK (length(nachname) >= 2),
    email               TEXT UNIQUE CHECK (email IS NULL OR email LIKE '%@%.%'),

    geburtsdatum        DATE,
    eintrittsdatum      DATE NOT NULL,
    austrittsdatum      DATE,

    urlaubstage_jahr    INTEGER NOT NULL DEFAULT 30
                        CHECK (urlaubstage_jahr BETWEEN 20 AND 50),

    status              TEXT NOT NULL DEFAULT 'aktiv'
                        CHECK (status IN ('aktiv', 'ausgeschieden')),

    erstellt_am         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mitarbeiter_abteilung ON mitarbeiter(abteilung_id) WHERE status = 'aktiv';
CREATE INDEX idx_mitarbeiter_status ON mitarbeiter(status);

-- ============================================================================
-- BEWEGUNGSDATEN
-- ============================================================================

CREATE TABLE urlaub (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mitarbeiter_id  TEXT NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,

    von_datum       DATE NOT NULL,
    bis_datum       DATE NOT NULL CHECK (bis_datum >= von_datum),
    tage            REAL NOT NULL CHECK (tage > 0 AND tage <= 365),

    notiz           TEXT,
    erfasst_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (julianday(bis_datum) - julianday(von_datum) <= 365)
);

CREATE INDEX idx_urlaub_mitarbeiter ON urlaub(mitarbeiter_id);
CREATE INDEX idx_urlaub_datum ON urlaub(von_datum, bis_datum);
CREATE INDEX idx_urlaub_jahr ON urlaub(CAST(strftime('%Y', von_datum) AS INTEGER));

CREATE TABLE krankheit (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mitarbeiter_id  TEXT NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,

    von_datum       DATE NOT NULL,
    bis_datum       DATE NOT NULL CHECK (bis_datum >= von_datum),
    tage            REAL NOT NULL CHECK (tage > 0 AND tage <= 365),

    notiz           TEXT,
    erfasst_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_krankheit_mitarbeiter ON krankheit(mitarbeiter_id);
CREATE INDEX idx_krankheit_datum ON krankheit(von_datum);

CREATE TABLE schulung (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mitarbeiter_id  TEXT NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,

    datum           DATE NOT NULL,
    dauer_tage      REAL NOT NULL CHECK (dauer_tage > 0 AND dauer_tage <= 30),

    titel           TEXT CHECK (titel IS NULL OR length(titel) >= 3),
    anbieter        TEXT,
    notiz           TEXT,

    erfasst_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schulung_mitarbeiter ON schulung(mitarbeiter_id);
CREATE INDEX idx_schulung_datum ON schulung(datum);

CREATE TABLE ueberstunden (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mitarbeiter_id  TEXT NOT NULL REFERENCES mitarbeiter(id) ON DELETE CASCADE,

    datum           DATE NOT NULL,
    stunden         REAL NOT NULL CHECK (stunden BETWEEN -24 AND 24),

    notiz           TEXT,
    erfasst_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ueberstunden_mitarbeiter ON ueberstunden(mitarbeiter_id);
CREATE INDEX idx_ueberstunden_datum ON ueberstunden(datum);

-- ============================================================================
-- LOOKUP
-- ============================================================================

CREATE TABLE feiertage (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    datum           DATE NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    bundesland      TEXT,
    aktiv           BOOLEAN NOT NULL DEFAULT 1,

    CHECK (length(name) >= 3)
);

CREATE INDEX idx_feiertage_datum ON feiertage(datum) WHERE aktiv = 1;

CREATE TABLE veranstaltungen (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL CHECK (length(name) >= 3),
    von_datum       DATE NOT NULL,
    bis_datum       DATE NOT NULL CHECK (bis_datum >= von_datum),
    ort             TEXT,
    beschreibung    TEXT,
    max_teilnehmer  INTEGER CHECK (max_teilnehmer IS NULL OR max_teilnehmer > 0),
    erfasst_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_veranstaltungen_datum ON veranstaltungen(von_datum, bis_datum);
CREATE INDEX idx_veranstaltungen_jahr ON veranstaltungen(CAST(strftime('%Y', von_datum) AS INTEGER));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER mitarbeiter_update_timestamp
AFTER UPDATE ON mitarbeiter
FOR EACH ROW
BEGIN
    UPDATE mitarbeiter
    SET aktualisiert_am = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

INSERT INTO abteilungen (name, farbe_hex, sortierung) VALUES
    ('Geschäftsleitung', '#e74c3c', 1),
    ('Verkauf',          '#3498db', 2),
    ('Service',          '#9b59b6', 3),
    ('Werkstatt',        '#e67e22', 4),
    ('Buchhaltung',      '#27ae60', 5);

INSERT INTO feiertage (datum, name, bundesland) VALUES
    ('2025-01-01', 'Neujahr', NULL),
    ('2025-04-18', 'Karfreitag', NULL),
    ('2025-04-21', 'Ostermontag', NULL),
    ('2025-05-01', 'Tag der Arbeit', NULL),
    ('2025-05-29', 'Christi Himmelfahrt', NULL),
    ('2025-06-09', 'Pfingstmontag', NULL),
    ('2025-10-03', 'Tag der Deutschen Einheit', NULL),
    ('2025-12-25', '1. Weihnachtstag', NULL),
    ('2025-12-26', '2. Weihnachtstag', NULL);
        """
        self.conn.executescript(schema)
        self.conn.commit()

    def _run_migrations(self):
        """Führt Datenbank-Migrationen aus"""
        try:
            cursor = self.conn.cursor()

            # Migration 1: austrittsdatum zu mitarbeiter hinzufügen
            cursor.execute("PRAGMA table_info(mitarbeiter)")
            columns = [col[1] for col in cursor.fetchall()]

            if 'austrittsdatum' not in columns:
                print("🔄 Migration: Füge austrittsdatum zu mitarbeiter hinzu...")
                cursor.execute("""
                    ALTER TABLE mitarbeiter
                    ADD COLUMN austrittsdatum DATE
                """)
                self.conn.commit()
                print("✅ austrittsdatum-Spalte hinzugefügt")

            # Migration 2: farbe_hex zu abteilungen hinzufügen (falls nicht vorhanden)
            cursor.execute("PRAGMA table_info(abteilungen)")
            abteilung_columns = [col[1] for col in cursor.fetchall()]

            if 'farbe_hex' not in abteilung_columns:
                print("🔄 Migration: Füge farbe_hex zu abteilungen hinzu...")
                cursor.execute("""
                    ALTER TABLE abteilungen
                    ADD COLUMN farbe_hex TEXT NOT NULL DEFAULT '#95a5a6'
                """)
                self.conn.commit()
                print("✅ farbe_hex-Spalte zu abteilungen hinzugefügt")

            # Migration 3: Veranstaltungen-Tabelle hinzufügen
            cursor.execute("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name='veranstaltungen'
            """)

            if not cursor.fetchone():
                print("🔄 Migration: Erstelle Veranstaltungen-Tabelle...")

                cursor.execute("""
                    CREATE TABLE veranstaltungen (
                        id              INTEGER PRIMARY KEY AUTOINCREMENT,
                        name            TEXT NOT NULL CHECK (length(name) >= 3),
                        von_datum       DATE NOT NULL,
                        bis_datum       DATE NOT NULL CHECK (bis_datum >= von_datum),
                        ort             TEXT,
                        beschreibung    TEXT,
                        max_teilnehmer  INTEGER CHECK (max_teilnehmer IS NULL OR max_teilnehmer > 0),
                        erfasst_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    )
                """)

                cursor.execute("""
                    CREATE INDEX idx_veranstaltungen_datum
                    ON veranstaltungen(von_datum, bis_datum)
                """)

                cursor.execute("""
                    CREATE INDEX idx_veranstaltungen_jahr
                    ON veranstaltungen(CAST(strftime('%Y', von_datum) AS INTEGER))
                """)

                self.conn.commit()
                print("✅ Veranstaltungen-Tabelle erstellt")
            else:
                # Migration 4: Wenn Tabelle existiert, prüfe ob von_datum/bis_datum existieren
                cursor.execute("PRAGMA table_info(veranstaltungen)")
                columns = [col[1] for col in cursor.fetchall()]

                if 'datum' in columns and 'von_datum' not in columns:
                    print("🔄 Migration: Konvertiere 'datum' zu 'von_datum' und 'bis_datum'...")

                    # Temporäre Tabelle erstellen
                    cursor.execute("""
                        CREATE TABLE veranstaltungen_new (
                            id              INTEGER PRIMARY KEY AUTOINCREMENT,
                            name            TEXT NOT NULL CHECK (length(name) >= 3),
                            von_datum       DATE NOT NULL,
                            bis_datum       DATE NOT NULL CHECK (bis_datum >= von_datum),
                            ort             TEXT,
                            beschreibung    TEXT,
                            max_teilnehmer  INTEGER CHECK (max_teilnehmer IS NULL OR max_teilnehmer > 0),
                            erfasst_am      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                        )
                    """)

                    # Daten kopieren (datum wird zu von_datum und bis_datum)
                    cursor.execute("""
                        INSERT INTO veranstaltungen_new (id, name, von_datum, bis_datum, ort, beschreibung, max_teilnehmer, erfasst_am)
                        SELECT id, name, datum, datum, ort, beschreibung, max_teilnehmer, erfasst_am
                        FROM veranstaltungen
                    """)

                    # Alte Tabelle löschen
                    cursor.execute("DROP TABLE veranstaltungen")

                    # Neue Tabelle umbenennen
                    cursor.execute("ALTER TABLE veranstaltungen_new RENAME TO veranstaltungen")

                    # Indizes erstellen
                    cursor.execute("""
                        CREATE INDEX idx_veranstaltungen_datum
                        ON veranstaltungen(von_datum, bis_datum)
                    """)

                    cursor.execute("""
                        CREATE INDEX idx_veranstaltungen_jahr
                        ON veranstaltungen(CAST(strftime('%Y', von_datum) AS INTEGER))
                    """)

                    self.conn.commit()
                    print("✅ Veranstaltungen-Tabelle migriert (datum → von_datum/bis_datum)")

        except Exception as e:
            print(f"❌ Fehler bei Migration: {e}")
    
    def close(self):
        """Schließt Datenbankverbindung"""
        if self.conn:
            self.conn.close()
            print("✅ Datenbank geschlossen")
    
    def __enter__(self):
        """Context Manager Support"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context Manager Support"""
        self.close()
    
    # ==================== REPOSITORY PROPERTIES ====================
    
    @property
    def abteilungen(self) -> AbteilungRepository:
        """Abteilungen Repository"""
        if self._abteilungen is None:
            self._abteilungen = AbteilungRepository(self.conn)
        return self._abteilungen

    @property
    def mitarbeiter(self) -> MitarbeiterRepository:
        """Mitarbeiter Repository"""
        if self._mitarbeiter is None:
            self._mitarbeiter = MitarbeiterRepository(self.conn)
        return self._mitarbeiter
    
    @property
    def urlaub(self) -> UrlaubRepository:
        """Urlaub Repository"""
        if self._urlaub is None:
            self._urlaub = UrlaubRepository(self.conn)
        return self._urlaub
    
    @property
    def krankheit(self) -> KrankheitRepository:
        """Krankheit Repository"""
        if self._krankheit is None:
            self._krankheit = KrankheitRepository(self.conn)
        return self._krankheit
    
    @property
    def schulung(self) -> SchulungRepository:
        """Schulung Repository"""
        if self._schulung is None:
            self._schulung = SchulungRepository(self.conn)
        return self._schulung
    
    @property
    def ueberstunden(self) -> UeberstundenRepository:
        """Überstunden Repository"""
        if self._ueberstunden is None:
            self._ueberstunden = UeberstundenRepository(self.conn)
        return self._ueberstunden
    
    @property
    def feiertage(self) -> FeiertagRepository:
        """Feiertage Repository"""
        if self._feiertage is None:
            self._feiertage = FeiertagRepository(self.conn)
        return self._feiertage

    @property
    def veranstaltungen(self) -> VeranstaltungRepository:
        """Veranstaltungen Repository"""
        if self._veranstaltungen is None:
            self._veranstaltungen = VeranstaltungRepository(self.conn)
        return self._veranstaltungen

    # ==================== UTILITY METHODS ====================
    
    def backup(self, backup_path: str) -> bool:
        """
        Erstellt Backup der Datenbank
        
        Args:
            backup_path: Pfad für Backup
        
        Returns:
            True bei Erfolg
        """
        try:
            import shutil
            shutil.copy2(self.db_path, backup_path)
            print(f"✅ Backup erstellt: {backup_path}")
            return True
        except Exception as e:
            print(f"❌ Backup fehlgeschlagen: {e}")
            return False
    
    def vacuum(self):
        """Optimiert Datenbank (Defragmentierung)"""
        try:
            self.conn.execute("VACUUM")
            self.conn.commit()
            print("✅ Datenbank optimiert")
        except Exception as e:
            print(f"❌ Vacuum fehlgeschlagen: {e}")
    
    def get_database_info(self) -> dict:
        """
        Gibt Datenbank-Informationen zurück
        
        Returns:
            Dict mit Statistiken
        """
        cursor = self.conn.cursor()
        
        # Tabellengröße
        cursor.execute("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
        db_size = cursor.fetchone()[0]
        
        # Anzahl Einträge
        stats = {}
        for table in ['mitarbeiter', 'urlaub', 'krankheit', 'schulung', 'ueberstunden', 'veranstaltungen']:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            stats[table] = cursor.fetchone()[0]
        
        return {
            'db_path': str(self.db_path),
            'size_mb': db_size / (1024 * 1024),
            'tables': stats
        }


class TeamplannerService:
    """
    Service Layer - Business Logic
    Verwendet Database + Repositories für komplexe Operationen
    """
    
    def __init__(self, db: TeamplannerDatabase):
        """
        Initialisiert Service
        
        Args:
            db: TeamplannerDatabase Instanz
        """
        self.db = db
    
    # ==================== STATISTIK-METHODEN ====================
    
    def get_mitarbeiter_statistik(self, mitarbeiter_id: str, jahr: int) -> Optional[MitarbeiterStatistik]:
        """
        Holt Statistik für einen Mitarbeiter

        Args:
            mitarbeiter_id: Mitarbeiter ID
            jahr: Jahr

        Returns:
            MitarbeiterStatistik oder None
        """
        # Mitarbeiter laden
        mitarbeiter = self.db.mitarbeiter.get_by_id(mitarbeiter_id)
        if not mitarbeiter or not mitarbeiter.ist_aktiv:
            return None

        # Abteilung laden
        abteilung = self.db.abteilungen.get_by_id(mitarbeiter.abteilung_id)
        if not abteilung:
            return None

        # Daten sammeln
        urlaub_genommen = self.db.urlaub.get_summe_nach_jahr(mitarbeiter_id, jahr)
        krankheitstage = self.db.krankheit.get_summe_nach_jahr(mitarbeiter_id, jahr)
        schulungstage = self.db.schulung.get_summe_nach_jahr(mitarbeiter_id, jahr)
        ueberstunden = self.db.ueberstunden.get_summe_nach_jahr(mitarbeiter_id, jahr)

        # Übertrag vom Vorjahr berechnen
        uebertrag = self._berechne_uebertrag(mitarbeiter_id, jahr - 1)

        # ✅ NEU: Anteilige Urlaubstage berechnen wenn unterjährig eingetreten
        urlaubstage_jahr = self._berechne_anteilige_urlaubstage(mitarbeiter, jahr)

        return MitarbeiterStatistik(
            mitarbeiter=mitarbeiter,
            abteilung=abteilung,
            jahr=jahr,
            urlaubstage_jahr=urlaubstage_jahr,
            urlaub_genommen=urlaub_genommen,
            uebertrag_vorjahr=uebertrag,
            krankheitstage=krankheitstage,
            schulungstage=schulungstage,
            ueberstunden=ueberstunden
        )
    
    def get_alle_statistiken(self, jahr: int, abteilung_id: Optional[int] = None) -> List[MitarbeiterStatistik]:
        """
        Holt Statistiken für alle Mitarbeiter
        
        Args:
            jahr: Jahr
            abteilung_id: Optional - Filter nach Abteilung
        
        Returns:
            Liste von MitarbeiterStatistik
        """
        # Mitarbeiter laden
        if abteilung_id:
            mitarbeiter_liste = self.db.mitarbeiter.get_by_abteilung(abteilung_id)
        else:
            mitarbeiter_liste = self.db.mitarbeiter.get_all()
        
        # Statistiken erstellen
        statistiken = []
        for mitarbeiter in mitarbeiter_liste:
            stat = self.get_mitarbeiter_statistik(mitarbeiter.id, jahr)
            if stat:
                statistiken.append(stat)
        
        return statistiken
    
    def get_team_statistik(self, jahr: int) -> TeamStatistik:
        """
        Holt Team-Gesamtstatistik
        
        Args:
            jahr: Jahr
        
        Returns:
            TeamStatistik
        """
        alle_stats = self.get_alle_statistiken(jahr)
        
        if not alle_stats:
            return TeamStatistik(
                jahr=jahr,
                mitarbeiter_anzahl=0,
                gesamt_urlaub=0,
                gesamt_krank=0,
                gesamt_schulung=0,
                gesamt_ueberstunden=0,
                durchschnitt_urlaub=0
            )
        
        gesamt_urlaub = sum(s.urlaub_genommen for s in alle_stats)
        gesamt_krank = sum(s.krankheitstage for s in alle_stats)
        gesamt_schulung = sum(s.schulungstage for s in alle_stats)
        gesamt_ueberstunden = sum(s.ueberstunden for s in alle_stats)
        
        return TeamStatistik(
            jahr=jahr,
            mitarbeiter_anzahl=len(alle_stats),
            gesamt_urlaub=gesamt_urlaub,
            gesamt_krank=gesamt_krank,
            gesamt_schulung=gesamt_schulung,
            gesamt_ueberstunden=gesamt_ueberstunden,
            durchschnitt_urlaub=gesamt_urlaub / len(alle_stats)
        )
    
    # ==================== URLAUBSBERECHNUNG ====================

    def _berechne_anteilige_urlaubstage(self, mitarbeiter: Mitarbeiter, jahr: int) -> int:
        """
        Berechnet anteilige Urlaubstage bei unterjährigem Eintritt

        Args:
            mitarbeiter: Mitarbeiter
            jahr: Jahr

        Returns:
            Anteilige Urlaubstage (gerundet)
        """
        # Wenn Eintritt vor dem Jahr liegt, volle Urlaubstage
        if mitarbeiter.eintrittsdatum.year < jahr:
            return mitarbeiter.urlaubstage_jahr

        # Wenn Eintritt nach dem Jahr liegt, 0 Tage
        if mitarbeiter.eintrittsdatum.year > jahr:
            return 0

        # Eintritt im aktuellen Jahr -> Anteilige Berechnung
        eintrittsmonat = mitarbeiter.eintrittsdatum.month

        # Bei Austrittsdatum im selben Jahr, auch berücksichtigen
        if mitarbeiter.austrittsdatum and mitarbeiter.austrittsdatum.year == jahr:
            austrittsmonat = mitarbeiter.austrittsdatum.month
            # Monate zwischen Eintritt und Austritt (inklusive)
            monate_im_jahr = austrittsmonat - eintrittsmonat + 1
        else:
            # Vom Eintrittsmonat bis Jahresende
            monate_im_jahr = 12 - eintrittsmonat + 1

        # Anteilige Berechnung: (Urlaubstage / 12) * Anzahl Monate
        # Aufrunden auf ganze Tage (zugunsten des Mitarbeiters)
        import math
        anteilige_tage = (mitarbeiter.urlaubstage_jahr / 12.0) * monate_im_jahr

        return math.ceil(anteilige_tage)

    # ==================== ÜBERTRAG-BERECHNUNG ====================

    def _berechne_uebertrag(self, mitarbeiter_id: str, jahr: int) -> float:
        """
        Berechnet Urlaubsübertrag für ein Jahr
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
            jahr: Jahr
        
        Returns:
            Übertragbare Tage (max 30)
        """
        mitarbeiter = self.db.mitarbeiter.get_by_id(mitarbeiter_id)
        if not mitarbeiter:
            return 0.0
        
        # ✅ FIX: Kein Übertrag im Eintrittsjahr oder wenn Jahr VOR Eintritt liegt
        if jahr < mitarbeiter.eintrittsdatum.year:
            return 0.0

        # ✅ NEU: Verfügbare Tage im Jahr (anteilig bei unterjährigem Eintritt)
        verfuegbar = self._berechne_anteilige_urlaubstage(mitarbeiter, jahr)

        # Übertrag vom Vorjahr (rekursiv)
        verfuegbar += self._berechne_uebertrag(mitarbeiter_id, jahr - 1)
        
        # Genommene Tage
        genommen = self.db.urlaub.get_summe_nach_jahr(mitarbeiter_id, jahr)
        
        # Resturlaub
        resturlaub = verfuegbar - genommen
        
        # Max 30 Tage übertragbar (gesetzlich)
        return min(max(resturlaub, 0), 30)
    
    def erstelle_jahreswechsel(self, von_jahr: int, nach_jahr: int) -> dict:
        """
        Führt Jahreswechsel durch (berechnet Überträge)
        
        Args:
            von_jahr: Altes Jahr
            nach_jahr: Neues Jahr
        
        Returns:
            Dict mit Statistiken
        """
        alle_mitarbeiter = self.db.mitarbeiter.get_all()
        uebertraege = {}
        
        for mitarbeiter in alle_mitarbeiter:
            uebertrag = self._berechne_uebertrag(mitarbeiter.id, von_jahr)
            if uebertrag > 0:
                uebertraege[mitarbeiter.id] = {
                    'name': mitarbeiter.name,
                    'uebertrag': uebertrag
                }
        
        return {
            'von_jahr': von_jahr,
            'nach_jahr': nach_jahr,
            'mitarbeiter_anzahl': len(alle_mitarbeiter),
            'uebertraege_anzahl': len(uebertraege),
            'uebertraege': uebertraege
        }
    
    # ==================== WERKTAGE-BERECHNUNG ====================
    
    def berechne_werktage(self, von_datum: date, bis_datum: date) -> int:
        """
        Berechnet Werktage (Mo-Fr) zwischen zwei Daten
        Berücksichtigt Feiertage!
        
        Args:
            von_datum: Startdatum
            bis_datum: Enddatum
        
        Returns:
            Anzahl Werktage
        """
        if von_datum > bis_datum:
            return 0
        
        # Feiertage im Zeitraum laden
        jahr_start = von_datum.year
        jahr_ende = bis_datum.year
        
        feiertage_set = set()
        for jahr in range(jahr_start, jahr_ende + 1):
            feiertage = self.db.feiertage.get_all(jahr=jahr)
            feiertage_set.update(f.datum for f in feiertage)
        
        # Werktage zählen
        werktage = 0
        aktuell = von_datum
        
        while aktuell <= bis_datum:
            # Mo-Fr = 0-4
            if aktuell.weekday() < 5 and aktuell not in feiertage_set:
                werktage += 1
            
            aktuell += timedelta(days=1)
        
        return werktage
    
    # ==================== VALIDIERUNG ====================
    
    def pruefe_urlaubskollision(self, mitarbeiter_id: str, von_datum: date, 
                                bis_datum: date, ausnahme_id: Optional[int] = None) -> List[Urlaub]:
        """
        Prüft ob Urlaub mit bestehendem Urlaub kollidiert
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
            von_datum: Von-Datum
            bis_datum: Bis-Datum
            ausnahme_id: Optional - ID zum Ausschließen (bei Updates)
        
        Returns:
            Liste von kollidierenden Urlaubseinträgen
        """
        alle_urlaube = self.db.urlaub.get_all(mitarbeiter_id=mitarbeiter_id)
        
        kollisionen = []
        for urlaub in alle_urlaube:
            # Skip eigener Eintrag bei Update
            if ausnahme_id and urlaub.id == ausnahme_id:
                continue
            
            # Prüfe Überschneidung
            if not (bis_datum < urlaub.von_datum or von_datum > urlaub.bis_datum):
                kollisionen.append(urlaub)
        
        return kollisionen
    
    def pruefe_verfuegbare_urlaubstage(self, mitarbeiter_id: str,
                                       jahr: int, tage: float) -> Tuple[bool, float]:
        """
        Prüft ob genug Urlaubstage verfügbar sind
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
            jahr: Jahr
            tage: Gewünschte Tage
        
        Returns:
            (ist_verfuegbar, verbleibende_tage)
        """
        stat = self.get_mitarbeiter_statistik(mitarbeiter_id, jahr)
        if not stat:
            return False, 0
        
        verbleibend = stat.verbleibend
        ist_verfuegbar = verbleibend >= tage
        
        return ist_verfuegbar, verbleibend
    
    # ==================== CONVENIENCE METHODS ====================
    
    def erstelle_mitarbeiter(self, vorname: str, nachname: str, 
                           abteilung_name: str, **kwargs) -> Mitarbeiter:
        """
        Erstellt neuen Mitarbeiter (vereinfachte API)
        
        Args:
            vorname: Vorname
            nachname: Nachname
            abteilung_name: Name der Abteilung
            **kwargs: Weitere Parameter
        
        Returns:
            Erstellter Mitarbeiter
        """
        # Abteilung finden
        abteilung = self.db.abteilungen.get_by_name(abteilung_name)
        if not abteilung:
            raise ValueError(f"Abteilung '{abteilung_name}' nicht gefunden")
        
        # ID generieren
        ma_id = f"{vorname.lower()}_{nachname.lower()}"
        
        # Mitarbeiter erstellen
        mitarbeiter = Mitarbeiter(
            id=ma_id,
            abteilung_id=abteilung.id,
            vorname=vorname,
            nachname=nachname,
            urlaubstage_jahr=kwargs.get('urlaubstage_jahr', 30),
            eintrittsdatum=kwargs.get('eintrittsdatum', date.today()),
            status=MitarbeiterStatus.AKTIV,
            email=kwargs.get('email'),
            geburtsdatum=kwargs.get('geburtsdatum')
        )
        
        return self.db.mitarbeiter.create(mitarbeiter)
    
    def erstelle_urlaub(self, mitarbeiter_id: str, von_datum: date, 
                       bis_datum: date, notiz: str = None) -> Urlaub:
        """
        Erstellt Urlaubseintrag mit Werktage-Berechnung
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
            von_datum: Von-Datum
            bis_datum: Bis-Datum
            notiz: Optionale Notiz
        
        Returns:
            Erstellter Urlaub
        
        Raises:
            ValueError: Bei Validierungsfehlern
        """
        # Werktage berechnen
        werktage = self.berechne_werktage(von_datum, bis_datum)
        
        if werktage == 0:
            raise ValueError("Keine Werktage im gewählten Zeitraum")
        
        # Kollisionen prüfen
        kollisionen = self.pruefe_urlaubskollision(mitarbeiter_id, von_datum, bis_datum)
        if kollisionen:
            raise ValueError(f"Kollision mit bestehendem Urlaub: {kollisionen[0]}")
        
        # Verfügbarkeit prüfen
        jahr = von_datum.year
        ist_verfuegbar, verbleibend = self.pruefe_verfuegbare_urlaubstage(
            mitarbeiter_id, jahr, werktage
        )
        
        if not ist_verfuegbar:
            raise ValueError(
                f"Nicht genug Urlaubstage verfügbar! "
                f"Benötigt: {werktage}, Verfügbar: {verbleibend}"
            )
        
        # Urlaub erstellen
        urlaub = Urlaub(
            id=None,
            mitarbeiter_id=mitarbeiter_id,
            von_datum=von_datum,
            bis_datum=bis_datum,
            tage=werktage,
            notiz=notiz
        )
        
        return self.db.urlaub.create(urlaub)
    
    def erstelle_krankheit(self, mitarbeiter_id: str, von_datum: date, 
                          bis_datum: date, notiz: str = None) -> Krankheit:
        """
        Erstellt Krankheitseintrag mit Werktage-Berechnung
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
            von_datum: Von-Datum
            bis_datum: Bis-Datum
            notiz: Optionale Notiz
        
        Returns:
            Erstellte Krankheit
        """
        werktage = self.berechne_werktage(von_datum, bis_datum)
        
        krankheit = Krankheit(
            id=None,
            mitarbeiter_id=mitarbeiter_id,
            von_datum=von_datum,
            bis_datum=bis_datum,
            tage=werktage,
            notiz=notiz
        )
        
        return self.db.krankheit.create(krankheit)
    
    def erstelle_schulung(self, mitarbeiter_id: str, datum: date, 
                         dauer_tage: float, titel: str = None, 
                         anbieter: str = None, notiz: str = None) -> Schulung:
        """
        Erstellt Schulungseintrag
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
            datum: Datum
            dauer_tage: Dauer in Tagen
            titel: Optionaler Titel
            anbieter: Optionaler Anbieter
            notiz: Optionale Notiz
        
        Returns:
            Erstellte Schulung
        """
        schulung = Schulung(
            id=None,
            mitarbeiter_id=mitarbeiter_id,
            datum=datum,
            dauer_tage=dauer_tage,
            titel=titel,
            anbieter=anbieter,
            notiz=notiz
        )
        
        return self.db.schulung.create(schulung)
    
    def erstelle_ueberstunden(self, mitarbeiter_id: str, datum: date, 
                             stunden: float, notiz: str = None) -> Ueberstunden:
        """
        Erstellt Überstunden-Eintrag
        
        Args:
            mitarbeiter_id: Mitarbeiter ID
            datum: Datum
            stunden: Stunden (kann negativ sein für Abbau)
            notiz: Optionale Notiz
        
        Returns:
            Erstellte Überstunden
        """
        ueberstunden = Ueberstunden(
            id=None,
            mitarbeiter_id=mitarbeiter_id,
            datum=datum,
            stunden=stunden,
            notiz=notiz
        )
        
        return self.db.ueberstunden.create(ueberstunden)


# ==================== FACTORY FUNCTIONS ====================

def create_database(db_path: str = "teamplanner_v3.db") -> TeamplannerDatabase:
    """
    Factory für TeamplannerDatabase
    
    Args:
        db_path: Pfad zur Datenbank
    
    Returns:
        TeamplannerDatabase Instanz
    """
    return TeamplannerDatabase(db_path)


def create_service(db: Optional[TeamplannerDatabase] = None) -> TeamplannerService:
    """
    Factory für TeamplannerService
    
    Args:
        db: Optional - Datenbank (wird erstellt falls None)
    
    Returns:
        TeamplannerService Instanz
    """
    if db is None:
        db = create_database()
    
    return TeamplannerService(db)