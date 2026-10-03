const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  openStorageFolder: () => ipcRenderer.invoke('app:open-storage-folder'),
  getSecureToken: (key) => ipcRenderer.invoke('app:get-secure-token', key),
  setSecureToken: (key, token) => ipcRenderer.invoke('app:set-secure-token', key, token),
  getDeviceId: () => ipcRenderer.invoke('app:get-device-id'),
  isDesktop: true,
});
