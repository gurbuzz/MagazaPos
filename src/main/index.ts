import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import { startServer } from '../server'
import { getLocalIpAddress } from '../server/utils/network'

// MağazaPOS Main Electron Process & Express Server Entry
app.setName('MagazaPOS')

try {
  const userDataPath = app.getPath('userData')
  process.env.MAGAZAPOS_USER_DATA = userDataPath
  console.log('[Main] UserData directory configured:', userDataPath)
} catch (e) {
  console.warn('[Main] Could not get userData path:', e)
}

let mainWindow: BrowserWindow | null = null
let customerWindow: BrowserWindow | null = null
let cachedCustomerData: any = null

function getCustomerDisplayStatus() {
  try {
    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    const secondaryDisplay = displays.find((d) => d.id !== primaryDisplay.id)
    return {
      isOpen: customerWindow !== null && !customerWindow.isDestroyed(),
      hasSecondary: Boolean(secondaryDisplay),
      displaysCount: displays.length,
      secondaryResolution: secondaryDisplay
        ? `${secondaryDisplay.bounds.width}x${secondaryDisplay.bounds.height}`
        : null,
    }
  } catch {
    return {
      isOpen: customerWindow !== null && !customerWindow.isDestroyed(),
      hasSecondary: false,
      displaysCount: 1,
      secondaryResolution: null,
    }
  }
}

function broadcastCustomerDisplayStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('customer-display-status-change', getCustomerDisplayStatus())
  }
}

function openCustomerDisplayWindow() {
  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.show()
    customerWindow.focus()
    return getCustomerDisplayStatus()
  }

  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()
  const secondaryDisplay = displays.find((d) => d.id !== primaryDisplay.id)

  const iconPath = path.resolve(__dirname, '../../public/icon.ico')

  if (secondaryDisplay) {
    // Çift ekranlı POS donanımı: 2. ekran koordinatlarına çerçevesiz tam ekran (kiosk) oturt
    customerWindow = new BrowserWindow({
      x: secondaryDisplay.bounds.x,
      y: secondaryDisplay.bounds.y,
      width: secondaryDisplay.bounds.width,
      height: secondaryDisplay.bounds.height,
      frame: false,
      fullscreen: true,
      kiosk: true,
      autoHideMenuBar: true,
      title: 'JACK & JONES - Müşteri Ekranı',
      backgroundColor: '#020b24',
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    })
    customerWindow.setBounds(secondaryDisplay.bounds)
  } else {
    // Tek ekran (geliştirme veya tek monitörlü test modu): Ayrı önizleme penceresi
    customerWindow = new BrowserWindow({
      width: 1024,
      height: 720,
      minWidth: 800,
      minHeight: 560,
      title: 'JACK & JONES - Müşteri Ekranı (Önizleme Modu)',
      autoHideMenuBar: true,
      backgroundColor: '#020b24',
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    })
    customerWindow.center()
  }

  // F11 tuşu ile müşteri ekranında tam ekran geçişi
  customerWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      const isFull = !customerWindow?.isFullScreen()
      customerWindow?.setFullScreen(isFull)
      event.preventDefault()
    }
  })

  // Load URL
  if (process.env.VITE_DEV_SERVER_URL) {
    customerWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?display=customer#customer-display`)
  } else if (process.env.NODE_ENV === 'development') {
    customerWindow.loadURL('http://localhost:5173/?display=customer#customer-display')
  } else {
    const prodPaths = [
      path.join(__dirname, '../../dist/index.html'),
      path.join(__dirname, '../renderer/index.html'),
      path.join(__dirname, '../../index.html'),
    ]
    const prodFile = prodPaths.find((p) => fs.existsSync(p)) || prodPaths[0]
    customerWindow.loadFile(prodFile, { hash: 'customer-display' })
  }

  customerWindow.webContents.on('did-finish-load', () => {
    if (cachedCustomerData && customerWindow && !customerWindow.isDestroyed()) {
      customerWindow.webContents.send('customer-display-data', cachedCustomerData)
    }
  })

  customerWindow.on('closed', () => {
    customerWindow = null
    broadcastCustomerDisplayStatus()
  })

  broadcastCustomerDisplayStatus()
  return getCustomerDisplayStatus()
}

function closeCustomerDisplayWindow() {
  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.close()
    customerWindow = null
    broadcastCustomerDisplayStatus()
    return true
  }
  return false
}

function createWindow() {
  // POS Kasa Ekranı: File, Edit, View, Window, Help menü çubuğunu gizle
  Menu.setApplicationMenu(null)

  const iconPath = path.resolve(__dirname, '../../public/icon.ico')

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 680,
    title: 'JACK & JONES - POS ve Stok Yönetimi',
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

// IPC Handler: Toggle fullscreen (F11) - targets the window that sent the event
ipcMain.handle('toggle-fullscreen', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  if (!win) return false
  const isFull = !win.isFullScreen()
  win.setFullScreen(isFull)
  return isFull
})

// IPC Handler: Query current fullscreen state
ipcMain.handle('is-fullscreen', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
  if (!win) return false
  return win.isFullScreen()
})


// IPC Handlers: Customer Display (Müşteri Ekranı)
ipcMain.handle('open-customer-display', async () => {
  return openCustomerDisplayWindow()
})

ipcMain.handle('close-customer-display', async () => {
  return closeCustomerDisplayWindow()
})

ipcMain.handle('toggle-customer-display', async () => {
  if (customerWindow && !customerWindow.isDestroyed()) {
    closeCustomerDisplayWindow()
  } else {
    openCustomerDisplayWindow()
  }
  return getCustomerDisplayStatus()
})

ipcMain.handle('get-customer-display-status', async () => {
  return getCustomerDisplayStatus()
})

ipcMain.handle('update-customer-display', async (_, data: any) => {
  cachedCustomerData = data
  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.webContents.send('customer-display-data', data)
  }
  return true
})

ipcMain.handle('get-customer-display-state', async () => {
  return cachedCustomerData
})

app.whenReady().then(() => {
  createWindow()

  // Monitör takılıp çıkarıldığında durumu bildir
  screen.on('display-added', () => broadcastCustomerDisplayStatus())
  screen.on('display-removed', () => broadcastCustomerDisplayStatus())

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

