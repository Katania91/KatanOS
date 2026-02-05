const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('katanos', {
  saveSnapshot: (payload) => ipcRenderer.invoke('katanos:saveSnapshot', payload),
  exportSnapshot: (payload, suggestedName) =>
    ipcRenderer.invoke('katanos:exportSnapshot', payload, suggestedName),
  exportUserFolder: (payload, suggestedName) =>
    ipcRenderer.invoke('katanos:exportUserFolder', payload, suggestedName),
  importUserFolder: () => ipcRenderer.invoke('katanos:importUserFolder'),
  setFullScreen: (enabled) => ipcRenderer.invoke('katanos:setFullScreen', enabled),
  isFullScreen: () => ipcRenderer.invoke('katanos:isFullScreen'),
  minimize: () => ipcRenderer.invoke('katanos:minimize'),
  confirmClose: () => ipcRenderer.invoke('katanos:confirmClose'),
  deleteUserData: (userId) => ipcRenderer.invoke('katanos:deleteUserData', userId),
  openExternal: (url) => ipcRenderer.invoke('katanos:openExternal', url),
  copyText: (text) => ipcRenderer.invoke('katanos:copyText', text),
  openStorePage: () => ipcRenderer.invoke('katanos:openStorePage'),
  setRichPresence: (payload) => ipcRenderer.invoke('katanos:setRichPresence', payload),
  logError: (payload) => ipcRenderer.invoke('katanos:logError', payload),
  getAppInfo: () => ipcRenderer.invoke('katanos:getAppInfo'),
  openLogFolder: () => ipcRenderer.invoke('katanos:openLogFolder'),
  encryptSecret: (value) => ipcRenderer.invoke('katanos:encryptSecret', value),
  decryptSecret: (value) => ipcRenderer.invoke('katanos:decryptSecret', value),
  signalReady: () => ipcRenderer.invoke('katanos:signalReady'),
  // Backup system APIs
  selectBackupFolder: () => ipcRenderer.invoke('katanos:selectBackupFolder'),
  writeBackupFile: (options) => ipcRenderer.invoke('katanos:writeBackupFile', options),
  listBackupFiles: (folderPath) => ipcRenderer.invoke('katanos:listBackupFiles', folderPath),
  deleteBackupFile: (filePath) => ipcRenderer.invoke('katanos:deleteBackupFile', filePath),
  checkFolderWritable: (folderPath) => ipcRenderer.invoke('katanos:checkFolderWritable', folderPath),
  onRequestClose: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('katanos:requestClose', listener);
    return () => ipcRenderer.removeListener('katanos:requestClose', listener);
  },
});
