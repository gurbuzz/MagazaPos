import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use IPC
contextBridge.exposeInMainWorld('electron', {
  printSilent: (htmlContent: string, printerName?: string) => ipcRenderer.invoke('print-silent', htmlContent, printerName),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getLocalIp: () => ipcRenderer.invoke('get-local-ip'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('is-fullscreen'),

  // Customer Display (Müşteri Ekranı) IPC methods
  openCustomerDisplay: () => ipcRenderer.invoke('open-customer-display'),
  closeCustomerDisplay: () => ipcRenderer.invoke('close-customer-display'),
  toggleCustomerDisplay: () => ipcRenderer.invoke('toggle-customer-display'),
  getCustomerDisplayStatus: () => ipcRenderer.invoke('get-customer-display-status'),
  updateCustomerDisplay: (data: any) => ipcRenderer.invoke('update-customer-display', data),
  getCustomerDisplayState: () => ipcRenderer.invoke('get-customer-display-state'),

  onCustomerDisplayUpdate: (callback: (data: any) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('customer-display-data', handler)
    return () => {
      ipcRenderer.removeListener('customer-display-data', handler)
    }
  },

  onCustomerDisplayStatusChange: (callback: (status: any) => void) => {
    const handler = (_: any, status: any) => callback(status)
    ipcRenderer.on('customer-display-status-change', handler)
    return () => {
      ipcRenderer.removeListener('customer-display-status-change', handler)
    }
  },
})

