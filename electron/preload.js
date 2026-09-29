const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  openStorageFolder: () => ipcRenderer.invoke('app:open-storage-folder'),
  isDesktop: true,
});
