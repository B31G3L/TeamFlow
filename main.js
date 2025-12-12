/**
 * Urlaubsplanner - Electron Main Process
 * Verwaltet Fenster, IPC, Datenbank und Systemintegration
 * 
 * PORTABLE VERSION: Datenbank liegt neben der .exe
 * 
 * NEU: Integrierter Logger (ohne externe Abhängigkeit)
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let mainWindow;
let db;
let logger;

/**
 * Einfacher Logger (direkt integriert, keine externe Datei)
 */
class SimpleLogger {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.logDir = path.join(userDataPath, 'logs');
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    const today = new Date().toISOString().split('T')[0];
    this.logFile = path.join(this.logDir, `teamplanner-${today}.log`);
    
    this.info('📝 Logger initialisiert', { logFile: this.logFile });
    this.rotateLogs(30);
  }
  
  _formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      logMessage += '\n' + JSON.stringify(data, null, 2);
    }
    
    return logMessage;
  }
  
  _writeToFile(message) {
    try {
      fs.appendFileSync(this.logFile, message + '\n', 'utf8');
    } catch (error) {
      console.error('Fehler beim Schreiben der Log-Datei:', error);
    }
  }
  
  info(message, data = null) {
    const formatted = this._formatMessage('INFO', message, data);
    console.log(formatted);
    this._writeToFile(formatted);
  }
  
  warn(message, data = null) {
    const formatted = this._formatMessage('WARN', message, data);
    console.warn(formatted);
    this._writeToFile(formatted);
  }
  
  error(message, data = null) {
    const formatted = this._formatMessage('ERROR', message, data);
    console.error(formatted);
    this._writeToFile(formatted);
  }
  
  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this._formatMessage('DEBUG', message, data);
      console.log(formatted);
      this._writeToFile(formatted);
    }
  }
  
  success(message, data = null) {
    const formatted = this._formatMessage('SUCCESS', message, data);
    console.log(formatted);
    this._writeToFile(formatted);
  }
  
  rotateLogs(keepDays = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const maxAge = keepDays * 24 * 60 * 60 * 1000;
      
      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();
        
        if (age > maxAge && file.endsWith('.log')) {
          fs.unlinkSync(filePath);
          console.log(`📁 Alte Log-Datei gelöscht: ${file}`);
        }
      });
    } catch (error) {
      console.error('Fehler beim Rotieren der Logs:', error);
    }
  }
  
  getLogPath() {
    return this.logFile;
  }
  
  getLogFiles() {
    try {
      const files = fs.readdirSync(this.logDir);
      return files
        .filter(f => f.endsWith('.log'))
        .map(f => path.join(this.logDir, f))
        .sort()
        .reverse();
    } catch (error) {
      console.error('Fehler beim Abrufen der Log-Dateien:', error);
      return [];
    }
  }
  
  readLog(logFile = null) {
    try {
      const file = logFile || this.logFile;
      return fs.readFileSync(file, 'utf8');
    } catch (error) {
      console.error('Fehler beim Lesen der Log-Datei:', error);
      return '';
    }
  }
}

/**
 * Ermittelt den Pfad für die Datenbank (neben der .exe)
 */
function getDatabasePath() {
  let basePath;
  
  if (app.isPackaged) {
    // PORTABLE: Datenbank liegt neben der .exe
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      basePath = process.env.PORTABLE_EXECUTABLE_DIR;
    } else {
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
  
  logger.info('📂 Datenbank-Pfad ermittelt', {
    dbPath,
    isPackaged: app.isPackaged,
    portableDir: process.env.PORTABLE_EXECUTABLE_DIR,
    exePath: app.getPath('exe')
  });
  
  return dbPath;
}

/**
 * Initialisiert die Datenbank
 */
function initDatabase() {
  const dbPath = getDatabasePath();

  logger.info('🔧 Initialisiere Datenbank...', { path: dbPath });

  try {
    // Datenbank öffnen
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Tabellen erstellen
    createTables();

    logger.success('✅ Datenbank erfolgreich initialisiert');
  } catch (error) {
    logger.error('❌ Fehler bei Datenbank-Initialisierung', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Erstellt alle Tabellen
 */
function createTables() {
  logger.debug('📋 Erstelle Tabellen...');
  
  try {
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

    // Manueller Übertrag
    db.exec(`
      CREATE TABLE IF NOT EXISTS uebertrag_manuell (
        mitarbeiter_id TEXT NOT NULL,
        jahr INTEGER NOT NULL,
        uebertrag_tage REAL NOT NULL,
        notiz TEXT,
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (mitarbeiter_id, jahr),
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
      )
    `);

    // Standard-Abteilungen erstellen
    createDefaultDepartments();
    
    logger.debug('✅ Tabellen erstellt');
  } catch (error) {
    logger.error('❌ Fehler beim Erstellen der Tabellen', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Erstellt Standard-Abteilungen
 */
function createDefaultDepartments() {
  const count = db.prepare('SELECT COUNT(*) as count FROM abteilungen').get();

  if (count.count === 0) {
    logger.info('📁 Erstelle Standard-Abteilungen...');
    
    const stmt = db.prepare(`
      INSERT INTO abteilungen (name, farbe, beschreibung)
      VALUES (?, ?, ?)
    `);

    const departments = [
      ['Buchhaltung', '#0ce729', 'Buchhaltungs-Team'],
      ['Verkauf', '#044292', 'Verkaufs-Team'],
      ['Werkstatt', '#d84e0e', 'Werkstatt-Team'],
      ['Geschäftsleitung', '#b91601', 'Geschäftsleitung'],
      ['Service', '#a70b9f', 'Service-Team']
    ];

    const insert = db.transaction((depts) => {
      for (const dept of depts) {
        stmt.run(...dept);
      }
    });

    insert(departments);
    logger.success('✅ Standard-Abteilungen erstellt');
  }
}

/**
 * Erstellt das Hauptfenster
 */
function createWindow() {
  logger.info('🪟 Erstelle Hauptfenster...');
  
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
    logger.success('✅ Hauptfenster angezeigt');
  });

  // Cleanup bei Schließen
  mainWindow.on('closed', () => {
    logger.info('👋 Hauptfenster geschlossen');
    mainWindow = null;
  });
}

/**
 * App-Lifecycle Events
 */
app.whenReady().then(() => {
  // Logger initialisieren
  logger = new SimpleLogger();
  logger.info('🚀 Teamplanner startet...', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    node: process.versions.node
  });

  // Datenbank initialisieren
  initDatabase();

  // Fenster erstellen
  createWindow();

  // macOS: Fenster neu erstellen wenn aktiviert
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('🔄 App aktiviert, erstelle neues Fenster');
      createWindow();
    }
  });
});

// Alle Fenster geschlossen
app.on('window-all-closed', () => {
  logger.info('🛑 Alle Fenster geschlossen');
  
  if (db) {
    db.close();
    logger.info('📁 Datenbank geschlossen');
  }
  
  if (process.platform !== 'darwin') {
    logger.info('👋 App wird beendet');
    app.quit();
  }
});

/**
 * IPC Handlers - Datei-Dialoge
 */
ipcMain.handle('dialog:saveFile', async (event, options) => {
  logger.debug('💾 Zeige Speichern-Dialog', options);
  const result = await dialog.showSaveDialog(mainWindow, options);
  logger.debug('💾 Speichern-Dialog Ergebnis', result);
  return result;
});

ipcMain.handle('dialog:openFile', async (event, options) => {
  logger.debug('📂 Zeige Öffnen-Dialog', options);
  const result = await dialog.showOpenDialog(mainWindow, options);
  logger.debug('📂 Öffnen-Dialog Ergebnis', result);
  return result;
});

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  logger.info('📝 Schreibe Datei', { path: filePath, size: data.length });
  try {
    fs.writeFileSync(filePath, data, 'utf8');
    logger.success('✅ Datei erfolgreich geschrieben');
    return { success: true };
  } catch (error) {
    logger.error('❌ Fehler beim Schreiben der Datei', {
      error: error.message,
      path: filePath
    });
    return { success: false, error: error.message };
  }
});

/**
 * IPC Handlers - App-Info
 */
ipcMain.handle('app:getPath', async (event, name) => {
  const result = app.getPath(name);
  logger.debug('📍 App-Pfad abgerufen', { name, path: result });
  return result;
});

ipcMain.handle('app:getVersion', async () => {
  return app.getVersion();
});

ipcMain.handle('app:getDatabasePath', async () => {
  return getDatabasePath();
});

/**
 * IPC Handler - Logs
 */
ipcMain.handle('app:getLogPath', async () => {
  return logger.getLogPath();
});

ipcMain.handle('app:getLogFiles', async () => {
  return logger.getLogFiles();
});

ipcMain.handle('app:readLog', async (event, logFile) => {
  return logger.readLog(logFile);
});

/**
 * IPC Handlers - Datenbank-Queries
 */
ipcMain.handle('db:query', async (event, sql, params = []) => {
  logger.debug('🔍 DB Query', { sql, params });
  try {
    const stmt = db.prepare(sql);
    const result = stmt.all(...params);
    return { success: true, data: result };
  } catch (error) {
    logger.error('❌ DB Query Error', {
      error: error.message,
      sql,
      params
    });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:get', async (event, sql, params = []) => {
  logger.debug('🔍 DB Get', { sql, params });
  try {
    const stmt = db.prepare(sql);
    const result = stmt.get(...params);
    return { success: true, data: result };
  } catch (error) {
    logger.error('❌ DB Get Error', {
      error: error.message,
      sql,
      params
    });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:run', async (event, sql, params = []) => {
  logger.debug('✏️ DB Run', { sql, params });
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    logger.info('✅ DB Operation erfolgreich', {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    });
    return { success: true, data: result };
  } catch (error) {
    logger.error('❌ DB Run Error', {
      error: error.message,
      sql,
      params
    });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:exec', async (event, sql) => {
  logger.debug('⚙️ DB Exec', { sql });
  try {
    db.exec(sql);
    logger.success('✅ DB Exec erfolgreich');
    return { success: true };
  } catch (error) {
    logger.error('❌ DB Exec Error', {
      error: error.message,
      sql
    });
    return { success: false, error: error.message };
  }
});

/**
 * Fehlerbehandlung
 */
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
});