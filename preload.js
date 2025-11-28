/**
 * Teamplanner - Preload Script
 * Sichere Bridge zwischen Main und Renderer Process
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
});
