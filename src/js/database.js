/**
 * Teamplanner Database Layer
 * SQLite Wrapper mit better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class TeamplannerDatabase {
  constructor(dbPath = null) {
    // Standard-Pfad: userData/teamplanner_v3.db
    if (!dbPath && typeof process !== 'undefined') {
      const userDataPath = process.env.APPDATA ||
        (process.platform === 'darwin'
          ? path.join(process.env.HOME, 'Library', 'Application Support')
          : path.join(process.env.HOME, '.local', 'share'));

      const appDir = path.join(userDataPath, 'Teamplanner');
      if (!fs.existsSync(appDir)) {
        fs.mkdirSync(appDir, { recursive: true });
      }

      dbPath = path.join(appDir, 'teamplanner_v3.db');
    } else if (!dbPath) {
      dbPath = path.join(__dirname, '../../database/teamplanner_v3.db');
    }

    console.log('📂 Datenbank-Pfad:', dbPath);

    // Datenbank öffnen
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    // Tabellen erstellen
    this.initDatabase();

    console.log('✅ Datenbank initialisiert');
  }

  /**
   * Erstellt alle Tabellen
   */
  initDatabase() {
    // Abteilungen
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS abteilungen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        farbe TEXT NOT NULL DEFAULT '#1f538d',
        beschreibung TEXT,
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Mitarbeiter
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mitarbeiter (
        id TEXT PRIMARY KEY,
        abteilung_id INTEGER NOT NULL,
        vorname TEXT NOT NULL,
        nachname TEXT NOT NULL,
        email TEXT,
        geburtsdatum DATE,
        eintrittsdatum DATE NOT NULL,
        austrittsdatum DATE,
        urlaubstage_jahr REAL NOT NULL DEFAULT 30,
        status TEXT NOT NULL DEFAULT 'AKTIV',
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (abteilung_id) REFERENCES abteilungen(id)
      )
    `);

    // Urlaub
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS urlaub (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mitarbeiter_id TEXT NOT NULL,
        von_datum DATE NOT NULL,
        bis_datum DATE NOT NULL,
        tage REAL NOT NULL,
        notiz TEXT,
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
      )
    `);

    // Krankheit
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS krankheit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mitarbeiter_id TEXT NOT NULL,
        von_datum DATE NOT NULL,
        bis_datum DATE NOT NULL,
        tage REAL NOT NULL,
        notiz TEXT,
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
      )
    `);

    // Schulung
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schulung (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mitarbeiter_id TEXT NOT NULL,
        datum DATE NOT NULL,
        dauer_tage REAL NOT NULL,
        titel TEXT,
        notiz TEXT,
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
      )
    `);

    // Überstunden
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ueberstunden (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mitarbeiter_id TEXT NOT NULL,
        datum DATE NOT NULL,
        stunden REAL NOT NULL,
        notiz TEXT,
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
      )
    `);

    // Feiertage
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feiertage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        datum DATE NOT NULL UNIQUE,
        name TEXT NOT NULL,
        beschreibung TEXT,
        bundesland TEXT,
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Veranstaltungen
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS veranstaltungen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        von_datum DATE NOT NULL,
        bis_datum DATE NOT NULL,
        titel TEXT NOT NULL,
        beschreibung TEXT,
        typ TEXT DEFAULT 'SONSTIGES',
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Standard-Abteilungen erstellen
    this.createDefaultDepartments();
  }

  /**
   * Erstellt Standard-Abteilungen wenn keine vorhanden
   */
  createDefaultDepartments() {
    const count = this.db.prepare('SELECT COUNT(*) as count FROM abteilungen').get();

    if (count.count === 0) {
      const stmt = this.db.prepare(`
        INSERT INTO abteilungen (name, farbe, beschreibung)
        VALUES (?, ?, ?)
      `);

      const departments = [
        ['Werkstatt', '#dc3545', 'Werkstatt-Team'],
        ['Büro', '#1f538d', 'Büro-Team'],
        ['Lager', '#28a745', 'Lager-Team']
      ];

      const insert = this.db.transaction((depts) => {
        for (const dept of depts) {
          stmt.run(...dept);
        }
      });

      insert(departments);
      console.log('✅ Standard-Abteilungen erstellt');
    }
  }

  /**
   * Gibt Datenbank-Informationen zurück
   */
  getDatabaseInfo() {
    const tables = {
      mitarbeiter: this.db.prepare('SELECT COUNT(*) as count FROM mitarbeiter').get().count,
      abteilungen: this.db.prepare('SELECT COUNT(*) as count FROM abteilungen').get().count,
      urlaub: this.db.prepare('SELECT COUNT(*) as count FROM urlaub').get().count,
      krankheit: this.db.prepare('SELECT COUNT(*) as count FROM krankheit').get().count,
      schulung: this.db.prepare('SELECT COUNT(*) as count FROM schulung').get().count,
      ueberstunden: this.db.prepare('SELECT COUNT(*) as count FROM ueberstunden').get().count,
      feiertage: this.db.prepare('SELECT COUNT(*) as count FROM feiertage').get().count,
      veranstaltungen: this.db.prepare('SELECT COUNT(*) as count FROM veranstaltungen').get().count
    };

    return {
      path: this.db.name,
      tables
    };
  }

  /**
   * Schließt die Datenbankverbindung
   */
  close() {
    this.db.close();
  }
}

// Export für Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TeamplannerDatabase;
}
