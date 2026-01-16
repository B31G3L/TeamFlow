/**
 * Urlaubsplanner - Preload Script
 * Stellt sichere API für Renderer-Prozess bereit
 * 
 * FIX: Korrekte Verschachtelung der DB-Funktionen unter electronAPI.db
 */

const { contextBridge, ipcRenderer } = require('electron');

// Sichere API für Renderer-Prozess
contextBridge.exposeInMainWorld('electronAPI', {
  // Datei-Dialoge
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  
  getScriptDirectory: () => ipcRenderer.invoke('get-script-directory'),
  executeCommand: (command, args) => ipcRenderer.invoke('execute-command', command, args),
  presentFile: (filePath) => ipcRenderer.invoke('present-file', filePath),
  // App-Informationen
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getDatabasePath: () => ipcRenderer.invoke('app:getDatabasePath'),
  
  // Log-Funktionen
  getLogPath: () => ipcRenderer.invoke('app:getLogPath'),
  getLogFiles: () => ipcRenderer.invoke('app:getLogFiles'),
  readLog: (logFile) => ipcRenderer.invoke('app:readLog', logFile),
  
  // Datenbank-Operationen (WICHTIG: Korrekt verschachtelt unter .db)
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
    run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
    exec: (sql) => ipcRenderer.invoke('db:exec', sql)
  }
});


