/**
 * Teamplanner - Preload Script
 * Sichere Bridge zwischen Main und Renderer Process
 * 
 * FIX: getDatabasePath hinzugefügt
 */

const { contextBridge, ipcRenderer } = require('electron');

// Exponiere sichere API für Renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog APIs
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),

  // Filesystem APIs
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),

  // App APIs
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // FIX: Diese Funktion fehlte!
  getDatabasePath: () => ipcRenderer.invoke('app:getDatabasePath'),

  // Database APIs
  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
    run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
    exec: (sql) => ipcRenderer.invoke('db:exec', sql)
  }
});