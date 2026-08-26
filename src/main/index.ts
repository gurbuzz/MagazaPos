import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { startServer } from '../server'
import { getLocalIpAddress } from '../server/utils/network'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 680,
    title: 'MağazaPOS - POS ve Stok Yönetimi',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Start embedded Node.js Express server
  try {
    startServer()
  } catch (err) {
    console.log('Server already running or starting:', err)
  }

  // Load Vite dev server or production index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../index.html'))
  }
}

// IPC Handler: Silent Thermal Label/Receipt Printing
ipcMain.handle('print-silent', async (_, htmlContent: string) => {
  let printWindow: BrowserWindow | null = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false }
  })

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)

  return new Promise((resolve) => {
    printWindow?.webContents.on('did-finish-load', () => {
      printWindow?.webContents.print(
        {
          silent: true,
          printBackground: true,
        },
        (success, failureReason) => {
          if (!success) console.error('Print failed:', failureReason)
          printWindow?.close()
          printWindow = null
          resolve({ success, failureReason })
        }
      )
    })
  })
})

// IPC Handler: Get system printers list
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return []
  return await mainWindow.webContents.getPrintersAsync()
})

// IPC Handler: Get local IP for WiFi mobile connection
ipcMain.handle('get-local-ip', async () => {
  return getLocalIpAddress()
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
