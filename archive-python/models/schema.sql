-- ============================================================================
-- TEAMPLANNER V3.0 DATABASE SCHEMA
-- Clean Architecture - Production Ready
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;


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

    -- ✅ FIXED: Keine date() in CHECK Constraints!
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
    ('Geschäftsleitung',     '#e74c3c', 1),
    ('Verkauf',              '#3498db', 2),
    ('Service',              '#9b59b6', 3),
    ('Werkstatt',            '#e67e22', 4),
    ('Buchhaltung',          '#27ae60', 5),
    ('Azubi KFZ',            '#f39c12', 6),
    ('Azubi kaufmännisch',   '#1abc9c', 7);

-- Deutsche Feiertage 2025
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