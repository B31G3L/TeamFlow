const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:openFile', options),
  writeFile: (filePath, data) => ipcRenderer.invoke('fs:writeFile', filePath, data),

  getScriptDirectory: () => ipcRenderer.invoke('get-script-directory'),
  executeCommand: (command, args) => ipcRenderer.invoke('execute-command', command, args),
  presentFile: (filePath) => ipcRenderer.invoke('present-file', filePath),
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getDatabasePath: () => ipcRenderer.invoke('app:getDatabasePath'),
  exportExcel: (data) => ipcRenderer.invoke('export:excel', data),
  exportPdf: (data) => ipcRenderer.invoke('export:pdf', data),
  exportEmployeeDetailPdf: (data) => ipcRenderer.invoke('export:employeeDetailPdf', data),


  db: {
    query: (sql, params) => ipcRenderer.invoke('db:query', sql, params),
    get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
    run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
    exec: (sql) => ipcRenderer.invoke('db:exec', sql)
  }
});


