/**
 * Teamplanner - Electron Main Process
 * Verwaltet Fenster, IPC und Systemintegration
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

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
    show: false // Erst zeigen wenn geladen
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * IPC Handlers
 */

// Datei-Dialog für Export
ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Datei-Dialog für Import
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// Datei schreiben (für Export)
ipcMain.handle('fs:writeFile', async (event, filePath, data) => {
  try {
    fs.writeFileSync(filePath, data, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App-Pfad abrufen
ipcMain.handle('app:getPath', async (event, name) => {
  return app.getPath(name);
});

// App-Version abrufen
ipcMain.handle('app:getVersion', async () => {
  return app.getVersion();
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
