/**
 * Urlaubsplanner - Preload Script
 * Stellt sichere API für Renderer-Prozess bereit
 */

const { contextBridge, ipcRenderer } = require('electron');

// Sichere API für Renderer-Prozess
contextBridge.exposeInMainWorld('electronAPI', {
  // Datei-Dialoge
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),
  
  // App-Informationen
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getDatabasePath: () => ipcRenderer.invoke('app:getDatabasePath'),
  
  // Log-Funktionen
  getLogPath: () => ipcRenderer.invoke('app:getLogPath'),
  getLogFiles: () => ipcRenderer.invoke('app:getLogFiles'),
  readLog: (logFile) => ipcRenderer.invoke('app:readLog', logFile),
  
  // Datenbank-Operationen
  dbQuery: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
  dbGet: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
  dbRun: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
  dbExec: (sql) => ipcRenderer.invoke('db:exec', sql)
});