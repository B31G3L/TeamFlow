const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { spawn } = require('child_process');

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
 * Ermittelt den Pfad für Export-Dateien (neben der .exe)
 * NEU: Eigener Export-Ordner für Excel/PDF
 */
function getExportPath() {
  let basePath;
  
  if (app.isPackaged) {
    // PORTABLE: Export-Ordner liegt neben der .exe
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      basePath = process.env.PORTABLE_EXECUTABLE_DIR;
    } else {
      basePath = path.dirname(app.getPath('exe'));
    }
  } else {
    // Development: Export liegt im Projekt-Root
    basePath = __dirname;
  }
  
  const exportPath = path.join(basePath, 'Export');
  
  // Stelle sicher, dass das Export-Verzeichnis existiert
  if (!fs.existsSync(exportPath)) {
    fs.mkdirSync(exportPath, { recursive: true });
    logger.info('📁 Export-Ordner erstellt', { path: exportPath });
  }
  
  return exportPath;
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

    // Mitarbeiter - NEU: Arbeitszeitmodell hinzugefügt
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
        wochenstunden REAL NOT NULL DEFAULT 40,
        status TEXT NOT NULL DEFAULT 'AKTIV',
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (abteilung_id) REFERENCES abteilungen(id)
      )
    `);

    // NEU: Arbeitszeitmodell-Tabelle
    db.exec(`
      CREATE TABLE IF NOT EXISTS arbeitszeitmodell (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mitarbeiter_id TEXT NOT NULL,
        wochentag INTEGER NOT NULL,
        arbeitszeit TEXT NOT NULL DEFAULT 'VOLL',
        erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE,
        UNIQUE(mitarbeiter_id, wochentag)
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

    // Migration: Füge wochenstunden Spalte hinzu falls nicht vorhanden
    try {
      const columns = db.prepare("PRAGMA table_info(mitarbeiter)").all();
      const hasWochenstunden = columns.some(col => col.name === 'wochenstunden');
      
      if (!hasWochenstunden) {
        logger.info('🔄 Migration: Füge wochenstunden Spalte hinzu');
        db.exec('ALTER TABLE mitarbeiter ADD COLUMN wochenstunden REAL NOT NULL DEFAULT 40');
        logger.success('✅ Migration erfolgreich: wochenstunden hinzugefügt');
      }
    } catch (error) {
      logger.warn('⚠️ Migration wochenstunden übersprungen', { error: error.message });
    }

    // NEU: Indizes für Performance erstellen
    createIndexes();
    
    // Standard-Abteilungen erstellen
    createDefaultDepartments();
    // In der createTables() Funktion nach Zeile 141 hinzufügen:

// Migration: Adresse und Gehalt hinzufügen
try {
  const columns = db.prepare("PRAGMA table_info(mitarbeiter)").all();
  
  const hasAdresse = columns.some(col => col.name === 'adresse');
  const hasGehalt = columns.some(col => col.name === 'gehalt');
  
  if (!hasAdresse) {
    logger.info('🔄 Migration: Füge adresse Spalte hinzu');
    db.exec('ALTER TABLE mitarbeiter ADD COLUMN adresse TEXT');
    logger.success('✅ Migration erfolgreich: adresse hinzugefügt');
  }
  
  if (!hasGehalt) {
    logger.info('🔄 Migration: Füge gehalt Spalte hinzu');
    db.exec('ALTER TABLE mitarbeiter ADD COLUMN gehalt REAL');
    logger.success('✅ Migration erfolgreich: gehalt hinzugefügt');
  }
} catch (error) {
  logger.warn('⚠️ Migration adresse/gehalt übersprungen', { error: error.message });
}
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
 * Erstellt Datenbankindizes für Performance
 * NEU: Optimiert häufige Abfragen
 */
function createIndexes() {
  logger.debug('🔍 Erstelle Datenbankindizes...');
  
  try {
    // Index für Urlaubsabfragen nach Mitarbeiter und Jahr
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_urlaub_mitarbeiter_jahr 
      ON urlaub(mitarbeiter_id, von_datum)
    `);
    
    // Index für Krankheitsabfragen nach Mitarbeiter und Jahr
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_krankheit_mitarbeiter_jahr 
      ON krankheit(mitarbeiter_id, von_datum)
    `);
    
    // Index für Schulungsabfragen nach Mitarbeiter und Jahr
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_schulung_mitarbeiter_jahr 
      ON schulung(mitarbeiter_id, datum)
    `);
    
    // Index für Überstundenabfragen nach Mitarbeiter und Jahr
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ueberstunden_mitarbeiter_jahr 
      ON ueberstunden(mitarbeiter_id, datum)
    `);
    
    // Index für Feiertagsabfragen nach Datum
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_feiertage_datum 
      ON feiertage(datum)
    `);
    
    // Index für Veranstaltungsabfragen nach Zeitraum
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_veranstaltungen_zeitraum 
      ON veranstaltungen(von_datum, bis_datum)
    `);
    
    // Index für Mitarbeiter nach Abteilung und Status
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mitarbeiter_abteilung_status 
      ON mitarbeiter(abteilung_id, status, austrittsdatum)
    `);
    
    logger.success('✅ Datenbankindizes erstellt');
  } catch (error) {
    logger.warn('⚠️ Fehler beim Erstellen der Indizes (möglicherweise bereits vorhanden)', {
      error: error.message
    });
  }
}


function getScriptPath(scriptName) {
    if (app.isPackaged) {
        // In der gebauten App: process.resourcesPath/scripts/
        return path.join(process.resourcesPath, 'scripts', scriptName);
    } else {
        // Im Development: ./scripts/
        return path.join(__dirname, 'scripts', scriptName);
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
 * FIX: Menüleiste wird ausgeblendet
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
    icon: path.join(__dirname, 'assets/icon.ico'),
    backgroundColor: '#1a1a1a',
    show: false,
    autoHideMenuBar: true // FIX: Blendet die Menüleiste (File, Edit, etc.) aus
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
 * Validiert ob ein Dateipfad sicher ist
 * SECURITY: Verhindert Path-Traversal-Angriffe
 */
/**
 * Validiert ob ein Dateipfad sicher ist
 * SECURITY: Verhindert Path-Traversal-Angriffe
 */
function isPathSafe(filePath) {
  try {
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(normalized);
    
    // Erlaubte Verzeichnisse
    const allowedDirs = [
      app.getPath('documents'),
      app.getPath('downloads'),
      app.getPath('desktop'),
      app.getPath('temp')
    ];
    
    // NEU: Export-Ordner neben der Datenbank erlauben
    const exportPath = getExportPath();
    allowedDirs.push(exportPath);
    
    // Prüfe ob Pfad in einem erlaubten Verzeichnis liegt
    return allowedDirs.some(dir => {
      const resolvedDir = path.resolve(dir);
      return resolved.startsWith(resolvedDir);
    });
  } catch (error) {
    logger.error('❌ Fehler bei Path-Validierung', { error: error.message, path: filePath });
    return false;
  }
}

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
    // NEU: Wenn Pfad /mnt/user-data/outputs enthält, schreibe in Export-Ordner
    let finalPath = filePath;
    if (filePath.includes('/mnt/user-data/outputs')) {
      const fileName = path.basename(filePath);
      const exportDir = getExportPath();
      finalPath = path.join(exportDir, fileName);
      logger.info('📂 Pfad umgeleitet', { 
        original: filePath, 
        redirected: finalPath 
      });
    }
    
    // SECURITY: Validiere Pfad
    if (!isPathSafe(finalPath)) {
      const error = 'Ungültiger Dateipfad: Zugriff verweigert';
      logger.error('🚨 Security: Ungültiger Dateipfad blockiert', { path: finalPath });
      return { success: false, error };
    }
    
    // Stelle sicher, dass das Verzeichnis existiert
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(finalPath, data, 'utf8');
    logger.success('✅ Datei erfolgreich geschrieben', { path: finalPath });
    return { success: true, path: finalPath }; // NEU: Gebe echten Pfad zurück
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



// Script-Verzeichnis zurückgeben
ipcMain.handle('get-script-directory', async () => {
  const isDev = !app.isPackaged;
  return isDev ? __dirname : process.resourcesPath;
});

// Command ausführen (für Python-Scripts)
ipcMain.handle('execute-command', async (event, command, args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: true });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
});

// Datei öffnen/präsentieren
ipcMain.handle('present-file', async (event, filePath) => {
  const { shell } = require('electron');
  await shell.openPath(filePath);
});


/**
 * EXPORT-SYSTEM
 * Erstellt Excel/PDF im Export-Ordner neben der .exe
 */

// Excel-Export
ipcMain.handle('export:excel', async (event, data) => {
  logger.info('📊 Excel-Export gestartet', { entries: data.length });
  
  try {
    const exportDir = getExportPath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const tempJsonPath = path.join(exportDir, `temp_${timestamp}.json`);
    const outputPath = path.join(exportDir, `Urlaub_${timestamp}.xlsx`);
    
    // 1. JSON schreiben
    fs.writeFileSync(tempJsonPath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info('✅ JSON geschrieben', { path: tempJsonPath });
    
    // 2. Python-Script Pfad ermitteln
    const isDev = !app.isPackaged;
    const scriptDir = isDev ? path.join(__dirname, 'scripts') : path.join(process.resourcesPath, 'scripts');
    const scriptPath = path.join(scriptDir, 'export_to_excel.py');
    
    logger.info('🐍 Führe Python-Script aus', { script: scriptPath });
    
    // 3. Python ausführen
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const result = await new Promise((resolve) => {
      const child = spawn(pythonCmd, [scriptPath, tempJsonPath, outputPath], { 
        shell: true,
        cwd: exportDir
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        logger.debug('Python:', text);
      });
      
      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        logger.warn('Python stderr:', text);
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          logger.success('✅ Excel erfolgreich erstellt', { path: outputPath });
          resolve({ success: true, path: outputPath });
        } else {
          logger.error('❌ Python-Script fehlgeschlagen', { code, stderr });
          resolve({ success: false, error: `Exit Code ${code}: ${stderr}` });
        }
      });
      
      child.on('error', (error) => {
        logger.error('❌ Python-Prozess Fehler', { error: error.message });
        resolve({ success: false, error: error.message });
      });
    });
    
    // 4. Temporäre JSON löschen
    try {
      fs.unlinkSync(tempJsonPath);
      logger.info('🗑️ Temporäre JSON gelöscht');
    } catch (err) {
      logger.warn('⚠️ Konnte temp JSON nicht löschen', { error: err.message });
    }
    
    // 5. Ordner öffnen bei Erfolg
    if (result.success) {
      const { shell } = require('electron');
      await shell.openPath(exportDir);
      logger.info('📂 Export-Ordner geöffnet');
    }
    
    return result;
    
  } catch (error) {
    logger.error('❌ Excel-Export fehlgeschlagen', { error: error.message });
    return { success: false, error: error.message };
  }
});

// PDF-Export
ipcMain.handle('export:pdf', async (event, data) => {
  logger.info('📄 PDF-Export gestartet', { entries: data.length });
  
  try {
    const exportDir = getExportPath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const tempJsonPath = path.join(exportDir, `temp_${timestamp}.json`);
    const outputPath = path.join(exportDir, `Urlaub_${timestamp}.pdf`);
    
    // 1. JSON schreiben
    fs.writeFileSync(tempJsonPath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info('✅ JSON geschrieben', { path: tempJsonPath });
    
    // 2. Python-Script Pfad ermitteln
    const isDev = !app.isPackaged;
    const scriptDir = isDev ? path.join(__dirname, 'scripts') : path.join(process.resourcesPath, 'scripts');
    const scriptPath = path.join(scriptDir, 'export_to_pdf.py');
    
    logger.info('🐍 Führe Python-Script aus', { script: scriptPath });
    
    // 3. Python ausführen
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const result = await new Promise((resolve) => {
      const child = spawn(pythonCmd, [scriptPath, tempJsonPath, outputPath], { 
        shell: true,
        cwd: exportDir
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        logger.debug('Python:', text);
      });
      
      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        logger.warn('Python stderr:', text);
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          logger.success('✅ PDF erfolgreich erstellt', { path: outputPath });
          resolve({ success: true, path: outputPath });
        } else {
          logger.error('❌ Python-Script fehlgeschlagen', { code, stderr });
          resolve({ success: false, error: `Exit Code ${code}: ${stderr}` });
        }
      });
      
      child.on('error', (error) => {
        logger.error('❌ Python-Prozess Fehler', { error: error.message });
        resolve({ success: false, error: error.message });
      });
    });
    
    // 4. Temporäre JSON löschen
    try {
      fs.unlinkSync(tempJsonPath);
      logger.info('🗑️ Temporäre JSON gelöscht');
    } catch (err) {
      logger.warn('⚠️ Konnte temp JSON nicht löschen', { error: err.message });
    }
    
    // 5. Ordner öffnen bei Erfolg
    if (result.success) {
      const { shell } = require('electron');
      await shell.openPath(exportDir);
      logger.info('📂 Export-Ordner geöffnet');
    }
    
    return result;
    
  } catch (error) {
    logger.error('❌ PDF-Export fehlgeschlagen', { error: error.message });
    return { success: false, error: error.message };
  }
});

// ========================================
// IPC-HANDLER FÜR MITARBEITER-DETAIL PDF-EXPORT
// Füge diesen Code zu deinen anderen IPC-Handlern in main.js hinzu
// ========================================

// Mitarbeiter-Detail PDF-Export
ipcMain.handle('export:employeeDetailPdf', async (event, data) => {
  logger.info('📄 Mitarbeiter-Detail PDF-Export gestartet', { employee: data.employee.name });
  
  try {
    const exportDir = getExportPath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const employeeName = data.employee.name.replace(/[^a-zA-Z0-9]/g, '_');
    const tempJsonPath = path.join(exportDir, `temp_${timestamp}.json`);
    const outputPath = path.join(exportDir, `Mitarbeiter_${employeeName}_${timestamp}.pdf`);
    
    // 1. JSON schreiben
    fs.writeFileSync(tempJsonPath, JSON.stringify(data, null, 2), 'utf-8');
    logger.info('✅ JSON geschrieben', { path: tempJsonPath });
    
    // 2. Python-Script Pfad ermitteln
    const isDev = !app.isPackaged;
    const scriptDir = isDev ? path.join(__dirname, 'scripts') : path.join(process.resourcesPath, 'scripts');
    const scriptPath = path.join(scriptDir, 'export_employee_detail.py');
    
    logger.info('🐍 Führe Python-Script aus', { script: scriptPath });
    
    // 3. Python ausführen
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const result = await new Promise((resolve) => {
      const child = spawn(pythonCmd, [scriptPath, tempJsonPath, outputPath], { 
        shell: true,
        cwd: exportDir
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        logger.debug('Python:', text);
      });
      
      child.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        logger.warn('Python stderr:', text);
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          logger.success('✅ PDF erfolgreich erstellt', { path: outputPath });
          resolve({ success: true, path: outputPath });
        } else {
          logger.error('❌ Python-Script fehlgeschlagen', { code, stderr });
          resolve({ success: false, error: `Exit Code ${code}: ${stderr}` });
        }
      });
      
      child.on('error', (error) => {
        logger.error('❌ Python-Prozess Fehler', { error: error.message });
        resolve({ success: false, error: error.message });
      });
    });
    
    // 4. Temporäre JSON löschen
    try {
      fs.unlinkSync(tempJsonPath);
      logger.info('🗑️ Temporäre JSON gelöscht');
    } catch (err) {
      logger.warn('⚠️ Konnte temp JSON nicht löschen', { error: err.message });
    }
    
    // 5. Ordner öffnen bei Erfolg
    if (result.success) {
      const { shell } = require('electron');
      await shell.openPath(exportDir);
      logger.info('📂 Export-Ordner geöffnet');
    }
    
    return result;
    
  } catch (error) {
    logger.error('❌ PDF-Export fehlgeschlagen', { error: error.message });
    return { success: false, error: error.message };
  }
});