/**
 * Urlaubsplanner - Electron Main Process
 * Verwaltet Fenster, IPC, Datenbank und Systemintegration
 * 
 * PORTABLE VERSION: Datenbank liegt neben der .exe
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let mainWindow;
let db;

/**
 * Ermittelt den Pfad für die Datenbank (neben der .exe)
 */
function getDatabasePath() {
  let basePath;
  
  if (app.isPackaged) {
    // PORTABLE: Datenbank liegt neben der .exe
    // Bei portable exe: process.env.PORTABLE_EXECUTABLE_DIR zeigt auf den Ordner der .exe
    // Bei installierter App: app.getPath('exe') zeigt auf die .exe
    
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      // Portable Version - Umgebungsvariable von electron-builder portable
      basePath = process.env.PORTABLE_EXECUTABLE_DIR;
    } else {
      // Installierte Version oder anderer Fall
      basePath = path.dirname(app.getPath('exe'));
    }
  } else {
    // Development: Datenbank liegt im Projekt-Root/database
    basePath = path.join(__dirname, 'database');
  }
  
  // Stelle sicher, dass das Verzeichnis existiert
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
  
  const dbPath = path.join(basePath, 'urlaubsplanner.db');
  
  console.log('📂 Datenbank-Pfad:', dbPath);
  console.log('📦 App ist gepackt:', app.isPackaged);
  console.log('📍 PORTABLE_EXECUTABLE_DIR:', process.env.PORTABLE_EXECUTABLE_DIR || 'nicht gesetzt');
  console.log('📍 Exe-Pfad:', app.getPath('exe'));
  
  return dbPath;
}

/**
 * Initialisiert die Datenbank
 */
function initDatabase() {
  const dbPath = getDatabasePath();

  // Datenbank öffnen
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Tabellen erstellen
  createTables();

  console.log('✅ Datenbank initialisiert');
}

/**
 * Erstellt alle Tabellen
 */
function createTables() {
  // Abteilungen
  db.exec(`
    CREATE TABLE IF NOT EXISTS abteilungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      farbe TEXT NOT NULL DEFAULT '#1f538d',
      beschreibung TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Mitarbeiter
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  db.exec(`
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
  createDefaultDepartments();
}

/**
 * Erstellt Standard-Abteilungen
 */
function createDefaultDepartments() {
  const count = db.prepare('SELECT COUNT(*) as count FROM abteilungen').get();

  if (count.count === 0) {
    const stmt = db.prepare(`
      INSERT INTO abteilungen (name, farbe, beschreibung)
      VALUES (?, ?, ?)
    `);

    const departments = [
      ['Werkstatt', '#dc3545', 'Werkstatt-Team'],
      ['Büro', '#1f538d', 'Büro-Team'],
      ['Lager', '#28a745', 'Lager-Team']
    ];

    const insert = db.transaction((depts) => {
      for (const dept of depts) {
        stmt.run(...dept);
      }
    });

    insert(departments);
    console.log('✅ Standard-Abteilungen erstellt');
  }
}

/**
 * Erstellt das Hauptfenster
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 1200,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'src/assets/logo.png'),
    backgroundColor: '#1a1a1a',
    show: false
  });

  // HTML laden
  mainWindow.loadFile('src/index.html');

  // DevTools in Entwicklung öffnen
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Fenster anzeigen wenn bereit
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Cleanup bei Schließen
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * App-Lifecycle Events
 */
app.whenReady().then(() => {
  // Datenbank initialisieren
  initDatabase();

  // Fenster erstellen
  createWindow();

  // macOS: Fenster neu erstellen wenn aktiviert
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Alle Fenster geschlossen
app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * IPC Handlers - Datei-Dialoge
 */
ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, data, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * IPC Handlers - App-Info
 */
ipcMain.handle('app:getPath', async (event, name) => {
  return app.getPath(name);
});

ipcMain.handle('app:getVersion', async () => {
  return app.getVersion();
});

/**
 * IPC Handler - Datenbank-Pfad (für Info-Anzeige)
 */
ipcMain.handle('app:getDatabasePath', async () => {
  return getDatabasePath();
});

/**
 * IPC Handlers - Datenbank-Queries
 */
ipcMain.handle('db:query', async (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.all(...params);
    return { success: true, data: result };
  } catch (error) {
    console.error('DB Query Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:get', async (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.get(...params);
    return { success: true, data: result };
  } catch (error) {
    console.error('DB Get Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:run', async (event, sql, params = []) => {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { success: true, data: result };
  } catch (error) {
    console.error('DB Run Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:exec', async (event, sql) => {
  try {
    db.exec(sql);
    return { success: true };
  } catch (error) {
    console.error('DB Exec Error:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Fehlerbehandlung
 */
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});