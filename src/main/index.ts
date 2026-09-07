import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { startServer } from '../server'
import { getLocalIpAddress } from '../server/utils/network'

// MağazaPOS Main Electron Process & Express Server Entry
let mainWindow: BrowserWindow | null = null

function createWindow() {
  // POS Kasa Ekranı: File, Edit, View, Window, Help menü çubuğunu gizle
  Menu.setApplicationMenu(null)

  const iconPath = path.resolve(__dirname, '../../public/icon.ico')

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 680,
    title: 'Lufian & Jack & Jones - POS ve Stok Yönetimi',
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Ekranı tam kaplayacak şekilde maximize et
  mainWindow.maximize()

  // F11 tuşu ile kiosk / çerçevesiz tam ekran geçişi
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow?.setFullScreen(!mainWindow.isFullScreen())
      event.preventDefault()
    }
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
    const prodPaths = [
      path.join(__dirname, '../../dist/index.html'),
      path.join(__dirname, '../renderer/index.html'),
      path.join(__dirname, '../../index.html'),
    ]
    const prodFile = prodPaths.find((p) => fs.existsSync(p)) || prodPaths[0]
    mainWindow.loadFile(prodFile)
  }
}

// IPC Handler: Silent Thermal Label/Receipt Printing
ipcMain.handle('print-silent', async (_, htmlContent: string, printerName?: string) => {
  let printWindow: BrowserWindow | null = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false }
  })

  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)

  return new Promise((resolve) => {
    printWindow?.webContents.on('did-finish-load', () => {
      const printOptions: any = {
        silent: true,
        printBackground: true,
      }

      if (printerName) {
        printOptions.deviceName = printerName
      }

      printWindow?.webContents.print(
        printOptions,
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
