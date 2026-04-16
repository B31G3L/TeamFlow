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
    this.logFile = path.join(this.logDir, `TeamFlow-${today}.log`);

    this.info('📝 Logger initialisiert', { logFile: this.logFile });
    this.rotateLogs(30);
  }

  _formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    if (data) logMessage += '\n' + JSON.stringify(data, null, 2);
    return logMessage;
  }

  _writeToFile(message) {
    try {
      fs.appendFileSync(this.logFile, message + '\n', 'utf8');
    } catch (error) {
      console.error('Fehler beim Schreiben der Log-Datei:', error);
    }
  }

  info(message, data = null)    { const f = this._formatMessage('INFO',    message, data); console.log(f);   this._writeToFile(f); }
  warn(message, data = null)    { const f = this._formatMessage('WARN',    message, data); console.warn(f);  this._writeToFile(f); }
  error(message, data = null)   { const f = this._formatMessage('ERROR',   message, data); console.error(f); this._writeToFile(f); }
  success(message, data = null) { const f = this._formatMessage('SUCCESS', message, data); console.log(f);   this._writeToFile(f); }

  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      const f = this._formatMessage('DEBUG', message, data);
      console.log(f);
      this._writeToFile(f);
    }
  }

  rotateLogs(keepDays = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const maxAge = keepDays * 24 * 60 * 60 * 1000;
      files.forEach(file => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtime.getTime() > maxAge && file.endsWith('.log')) {
          fs.unlinkSync(filePath);
          console.log(`📁 Alte Log-Datei gelöscht: ${file}`);
        }
      });
    } catch (error) {
      console.error('Fehler beim Rotieren der Logs:', error);
    }
  }

  getLogPath()  { return this.logFile; }
  getLogFiles() {
    try {
      return fs.readdirSync(this.logDir)
        .filter(f => f.endsWith('.log'))
        .map(f => path.join(this.logDir, f))
        .sort().reverse();
    } catch { return []; }
  }
  readLog(logFile = null) {
    try { return fs.readFileSync(logFile || this.logFile, 'utf8'); }
    catch { return ''; }
  }
}

/**
 * Ermittelt den Pfad für die Datenbank (neben der .exe)
 */
function getDatabasePath() {
  let basePath;
  if (app.isPackaged) {
    basePath = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
  } else {
    basePath = path.join(__dirname, 'database');
  }
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
  const dbPath = path.join(basePath, '_TeamFlowDB.db');
  logger.info('📂 Datenbank-Pfad ermittelt', { dbPath, isPackaged: app.isPackaged });
  return dbPath;
}

/**
 * Ermittelt den Pfad für Export-Dateien (neben der .exe)
 */
function getExportPath() {
  let basePath;
  if (app.isPackaged) {
    basePath = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
  } else {
    basePath = __dirname;
  }
  const exportPath = path.join(basePath, 'Export');
  if (!fs.existsSync(exportPath)) {
    fs.mkdirSync(exportPath, { recursive: true });
    logger.info('📁 Export-Ordner erstellt', { path: exportPath });
  }
  return exportPath;
}

/**
 * FIX: isPathSafe() berücksichtigt jetzt auch den Export-Ordner.
 * Vorher fehlte getExportPath() in der allowedDirs-Liste, was dazu führte,
 * dass fs:writeFile für alle Export-Pfade mit "Zugriff verweigert" fehlschlug.
 */
function isPathSafe(filePath) {
  try {
    const resolved = path.resolve(path.normalize(filePath));

    const allowedDirs = [
      app.getPath('documents'),
      app.getPath('downloads'),
      app.getPath('desktop'),
      app.getPath('temp'),
      getExportPath(),                          // FIX: war vorher nicht immer enthalten
      path.dirname(app.getPath('exe')),         // FIX: neben der .exe generell erlauben
    ];
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
      allowedDirs.push(process.env.PORTABLE_EXECUTABLE_DIR);
    }

    return allowedDirs.some(dir => resolved.startsWith(path.resolve(dir)));
  } catch (error) {
    logger.error('❌ Fehler bei Path-Validierung', { error: error.message, path: filePath });
    return false;
  }
}

/**
 * Initialisiert die Datenbank
 */
function initDatabase() {
  const dbPath = getDatabasePath();
  logger.info('🔧 Initialisiere Datenbank...', { path: dbPath });
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    createTables();
    logger.success('✅ Datenbank erfolgreich initialisiert');
  } catch (error) {
    logger.error('❌ Fehler bei Datenbank-Initialisierung', { error: error.message, stack: error.stack });
    throw error;
  }
}

function createTables() {
  logger.debug('📋 Erstelle Tabellen...');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS abteilungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      farbe TEXT NOT NULL DEFAULT '#1f538d',
      beschreibung TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS mitarbeiter (
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
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS arbeitszeitmodell (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mitarbeiter_id TEXT NOT NULL,
      wochentag INTEGER NOT NULL,
      arbeitszeit TEXT NOT NULL DEFAULT 'VOLL',
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE,
      UNIQUE(mitarbeiter_id, wochentag)
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS urlaub (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mitarbeiter_id TEXT NOT NULL,
      von_datum DATE NOT NULL,
      bis_datum DATE NOT NULL,
      tage REAL NOT NULL,
      notiz TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS krankheit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mitarbeiter_id TEXT NOT NULL,
      von_datum DATE NOT NULL,
      bis_datum DATE NOT NULL,
      tage REAL NOT NULL,
      notiz TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS schulung (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mitarbeiter_id TEXT NOT NULL,
      datum DATE NOT NULL,
      dauer_tage REAL NOT NULL,
      titel TEXT,
      notiz TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS ueberstunden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mitarbeiter_id TEXT NOT NULL,
      datum DATE NOT NULL,
      stunden REAL NOT NULL,
      notiz TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS feiertage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datum DATE NOT NULL UNIQUE,
      name TEXT NOT NULL,
      beschreibung TEXT,
      bundesland TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS veranstaltungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      von_datum DATE NOT NULL,
      bis_datum DATE NOT NULL,
      titel TEXT NOT NULL,
      beschreibung TEXT,
      typ TEXT DEFAULT 'SONSTIGES',
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.exec(`CREATE TABLE IF NOT EXISTS uebertrag_manuell (
      mitarbeiter_id TEXT NOT NULL,
      jahr INTEGER NOT NULL,
      uebertrag_tage REAL NOT NULL,
      notiz TEXT,
      erstellt_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      aktualisiert_am DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (mitarbeiter_id, jahr),
      FOREIGN KEY (mitarbeiter_id) REFERENCES mitarbeiter(id) ON DELETE CASCADE
    )`);

    // Migrationen
    const runMigration = (sql, label) => {
      try { db.exec(sql); logger.success(`✅ Migration: ${label}`); }
      catch { logger.debug(`Migration übersprungen (bereits vorhanden): ${label}`); }
    };
    runMigration('ALTER TABLE mitarbeiter ADD COLUMN wochenstunden REAL NOT NULL DEFAULT 40', 'wochenstunden');
    runMigration('ALTER TABLE mitarbeiter ADD COLUMN adresse TEXT', 'adresse');
    runMigration('ALTER TABLE mitarbeiter ADD COLUMN gehalt REAL', 'gehalt');
    runMigration('ALTER TABLE mitarbeiter ADD COLUMN uebertrag_verfaellt INTEGER NOT NULL DEFAULT 1', 'uebertrag_verfaellt');

    createIndexes();
    createDefaultDepartments();
    logger.debug('✅ Tabellen erstellt');
  } catch (error) {
    logger.error('❌ Fehler beim Erstellen der Tabellen', { error: error.message });
    throw error;
  }
}

function createIndexes() {
  const indexes = [
    ['idx_urlaub_mitarbeiter_jahr',    'urlaub(mitarbeiter_id, von_datum)'],
    ['idx_krankheit_mitarbeiter_jahr', 'krankheit(mitarbeiter_id, von_datum)'],
    ['idx_schulung_mitarbeiter_jahr',  'schulung(mitarbeiter_id, datum)'],
    ['idx_ueberstunden_mitarbeiter_jahr', 'ueberstunden(mitarbeiter_id, datum)'],
    ['idx_feiertage_datum',            'feiertage(datum)'],
    ['idx_veranstaltungen_zeitraum',   'veranstaltungen(von_datum, bis_datum)'],
    ['idx_mitarbeiter_abteilung_status', 'mitarbeiter(abteilung_id, status, austrittsdatum)'],
  ];
  indexes.forEach(([name, def]) => {
    try { db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${def}`); }
    catch (e) { logger.warn(`Index ${name} übersprungen`, { error: e.message }); }
  });
  logger.success('✅ Datenbankindizes erstellt');
}

function createDefaultDepartments() {
  const count = db.prepare('SELECT COUNT(*) as count FROM abteilungen').get();
  if (count.count === 0) {
    logger.info('📁 Erstelle Standard-Abteilungen...');
    const stmt = db.prepare('INSERT INTO abteilungen (name, farbe, beschreibung) VALUES (?, ?, ?)');
    const insert = db.transaction((depts) => { for (const d of depts) stmt.run(...d); });
    insert([
      ['Buchhaltung',   '#0ce729', 'Buchhaltungs-Team'],
      ['Verkauf',       '#044292', 'Verkaufs-Team'],
      ['Werkstatt',     '#d84e0e', 'Werkstatt-Team'],
      ['Geschäftsleitung', '#b91601', 'Geschäftsleitung'],
      ['Service',       '#a70b9f', 'Service-Team'],
    ]);
    logger.success('✅ Standard-Abteilungen erstellt');
  }
}

function createWindow() {
  logger.info('🪟 Erstelle Hauptfenster...');
  mainWindow = new BrowserWindow({
    width: 1400, height: 800, minWidth: 1200, minHeight: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
    icon: path.join(__dirname, 'assets/icon.ico'),
    backgroundColor: '#1a1a1a',
    show: false,
    autoHideMenuBar: true,
  });
  mainWindow.loadFile('src/index.html');
  if (process.env.NODE_ENV === 'development') mainWindow.webContents.openDevTools();
  mainWindow.once('ready-to-show', () => { mainWindow.show(); logger.success('✅ Hauptfenster angezeigt'); });
  mainWindow.on('closed', () => { logger.info('👋 Hauptfenster geschlossen'); mainWindow = null; });
}

app.whenReady().then(() => {
  logger = new SimpleLogger();
  logger.info('🚀 TeamFlow startet...', {
    version: app.getVersion(), platform: process.platform,
    electron: process.versions.electron, node: process.versions.node,
  });
  initDatabase();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  logger.info('🛑 Alle Fenster geschlossen');
  if (db) { db.close(); logger.info('📁 Datenbank geschlossen'); }
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Dialoge ──────────────────────────────────────────────────────────────
ipcMain.handle('dialog:saveFile', async (event, options) => dialog.showSaveDialog(mainWindow, options));
ipcMain.handle('dialog:openFile', async (event, options) => dialog.showOpenDialog(mainWindow, options));

ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  logger.info('📝 Schreibe Datei', { path: filePath });
  try {
    let finalPath = filePath;
    if (filePath.includes('/mnt/user-data/outputs')) {
      finalPath = path.join(getExportPath(), path.basename(filePath));
      logger.info('📂 Pfad umgeleitet', { original: filePath, redirected: finalPath });
    }
    if (!isPathSafe(finalPath)) {
      logger.error('🚨 Security: Ungültiger Dateipfad blockiert', { path: finalPath });
      return { success: false, error: 'Ungültiger Dateipfad: Zugriff verweigert' };
    }
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(finalPath, data, 'utf8');
    logger.success('✅ Datei geschrieben', { path: finalPath });
    return { success: true, path: finalPath };
  } catch (error) {
    logger.error('❌ Fehler beim Schreiben', { error: error.message });
    return { success: false, error: error.message };
  }
});

// ── IPC: App-Info ─────────────────────────────────────────────────────────────
ipcMain.handle('app:getPath',        async (event, name) => app.getPath(name));
ipcMain.handle('app:getVersion',     async () => app.getVersion());
ipcMain.handle('app:getDatabasePath',async () => getDatabasePath());
ipcMain.handle('get-script-directory', async () => app.isPackaged ? process.resourcesPath : __dirname);

// ── IPC: Datenbank ────────────────────────────────────────────────────────────
ipcMain.handle('db:query', async (event, sql, params = []) => {
  logger.debug('🔍 DB Query', { sql, params });
  try { return { success: true, data: db.prepare(sql).all(...params) }; }
  catch (e) { logger.error('❌ DB Query Error', { error: e.message, sql }); return { success: false, error: e.message }; }
});

ipcMain.handle('db:get', async (event, sql, params = []) => {
  logger.debug('🔍 DB Get', { sql, params });
  try { return { success: true, data: db.prepare(sql).get(...params) }; }
  catch (e) { logger.error('❌ DB Get Error', { error: e.message, sql }); return { success: false, error: e.message }; }
});

ipcMain.handle('db:run', async (event, sql, params = []) => {
  logger.debug('✏️ DB Run', { sql, params });
  try {
    const result = db.prepare(sql).run(...params);
    return { success: true, data: result };
  } catch (e) { logger.error('❌ DB Run Error', { error: e.message, sql }); return { success: false, error: e.message }; }
});

ipcMain.handle('db:exec', async (event, sql) => {
  logger.debug('⚙️ DB Exec', { sql });
  try { db.exec(sql); return { success: true }; }
  catch (e) { logger.error('❌ DB Exec Error', { error: e.message }); return { success: false, error: e.message }; }
});

// ── IPC: Sonstiges ────────────────────────────────────────────────────────────
ipcMain.handle('execute-command', async (event, command, args) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ code, stdout, stderr }));
    child.on('error', reject);
  });
});

ipcMain.handle('present-file', async (event, filePath) => {
  const { shell } = require('electron');
  await shell.openPath(filePath);
});

// ── Export: gemeinsame Hilfsfunktion ──────────────────────────────────────────
/**
 * FIX: Export-Handler waren 4× identisch dupliziert (~80 Zeilen je Handler).
 * Jetzt eine einzige Funktion; alle vier Handler delegieren hierher.
 *
 * @param {object} data        - Daten für das Script (werden als JSON geschrieben)
 * @param {string} scriptName  - Dateiname des Python-Scripts ohne Pfad (z.B. 'export_to_excel.py')
 * @param {string} outputName  - Dateiname der Ausgabedatei inkl. Endung
 * @returns {{ success: boolean, path?: string, error?: string }}
 */
async function runExportScript(data, scriptName, outputName) {
  const exportDir  = getExportPath();
  const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const tempJson   = path.join(exportDir, `temp_${timestamp}.json`);
  const outputPath = path.join(exportDir, outputName.replace('{ts}', timestamp));

  fs.writeFileSync(tempJson, JSON.stringify(data, null, 2), 'utf-8');
  logger.info('✅ Export-JSON geschrieben', { script: scriptName, output: outputPath });

  const scriptDir = app.isPackaged
    ? path.join(process.resourcesPath, 'scripts')
    : path.join(__dirname, 'scripts');

  let command, args;
  if (app.isPackaged) {
    command = path.join(scriptDir, scriptName.replace('.py', '.exe'));
    args = [tempJson, outputPath];
  } else {
    command = process.platform === 'win32' ? 'python' : 'python3';
    args = [path.join(scriptDir, scriptName), tempJson, outputPath];
  }

  const result = await new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, cwd: exportDir });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); logger.debug('Export stdout:', d.toString()); });
    child.stderr.on('data', d => { stderr += d.toString(); logger.warn('Export stderr:', d.toString()); });
    child.on('close', code => {
      if (code === 0) {
        logger.success('✅ Export erfolgreich', { path: outputPath });
        resolve({ success: true, path: outputPath });
      } else {
        logger.error('❌ Export fehlgeschlagen', { code, stderr });
        resolve({ success: false, error: `Exit Code ${code}: ${stderr}` });
      }
    });
    child.on('error', e => { logger.error('❌ Prozess Fehler', { error: e.message }); resolve({ success: false, error: e.message }); });
  });

  try { fs.unlinkSync(tempJson); } catch (_) { /* ignore */ }

  if (result.success) {
    const { shell } = require('electron');
    await shell.openPath(exportDir);
  }
  return result;
}

ipcMain.handle('export:excel', async (event, data) => {
  logger.info('📊 Excel-Export gestartet');
  return runExportScript(data, 'export_to_excel.py', `Abwesenheit_{ts}.xlsx`);
});

ipcMain.handle('export:pdf', async (event, data) => {
  logger.info('📄 PDF-Export gestartet');
  return runExportScript(data, 'export_to_pdf.py', `Abwesenheit_{ts}.pdf`);
});

ipcMain.handle('export:employeeDetailPdf', async (event, data) => {
  const name = (data.employee?.name || 'Mitarbeiter').replace(/[^a-zA-Z0-9]/g, '_');
  logger.info('📄 Stammdaten-PDF-Export gestartet', { employee: data.employee?.name });
  return runExportScript(data, 'export_employee_detail.py', `Mitarbeiter_${name}_{ts}.pdf`);
});

ipcMain.handle('export:employeeYearPdf', async (event, data) => {
  const name = (data.employee?.name || 'Mitarbeiter').replace(/[^a-zA-Z0-9]/g, '_');
  logger.info('📄 Jahres-PDF-Export gestartet', { employee: data.employee?.name, jahr: data.jahr });
  return runExportScript(data, 'export_employee_year.py', `Jahresuebersicht_${name}_${data.jahr}_{ts}.pdf`);
});

// ── Fehlerbehandlung ──────────────────────────────────────────────────────────
process.on('uncaughtException',  (e) => logger.error('💥 Uncaught Exception',   { error: e.message, stack: e.stack }));
process.on('unhandledRejection', (r) => logger.error('💥 Unhandled Rejection',  { reason: r }));