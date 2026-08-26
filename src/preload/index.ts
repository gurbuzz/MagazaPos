import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use IPC
contextBridge.exposeInMainWorld('electron', {
  printSilent: (htmlContent: string) => ipcRenderer.invoke('print-silent', htmlContent),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getLocalIp: () => ipcRenderer.invoke('get-local-ip'),
})
