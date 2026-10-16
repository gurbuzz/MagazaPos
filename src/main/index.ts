import { app, BrowserWindow, ipcMain, Menu, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import { startServer } from '../server'
import { getLocalIpAddress } from '../server/utils/network'

// MağazaPOS Main Electron Process & Express Server Entry
app.setName('MagazaPOS')

app.commandLine.appendSwitch('high-dpi-support', '1')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

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
    const { x, y, width, height } = secondaryDisplay.bounds

    customerWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      resizable: false,
      movable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      autoHideMenuBar: true,
      title: 'LUFIAN - Müşteri Ekranı',
      backgroundColor: '#020b24',
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    // Windows çoklu monitör DPI & taskbar sızıntısını önlemek için koordinat ve kiosk kilitlemesi
    customerWindow.setPosition(x, y)
    customerWindow.setBounds({ x, y, width, height })
    customerWindow.setKiosk(true)
    try {
      customerWindow.setAlwaysOnTop(true, 'screen-saver')
    } catch {
      customerWindow.setAlwaysOnTop(true)
    }
  } else {
    // Tek ekran (geliştirme veya tek monitörlü test modu): Ayrı önizleme penceresi
    customerWindow = new BrowserWindow({
      width: 1024,
      height: 720,
      minWidth: 800,
      minHeight: 560,
      title: 'LUFIAN - Müşteri Ekranı (Önizleme Modu)',
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
    title: 'LUFIAN - POS ve Stok Yönetimi',
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
ipcMain.handle('print-silent', async (_, htmlContent: string, printerName?: string, customPageSize?: { width: number; height: number }, silent: boolean = true) => {
  const tempPath = path.join(app.getPath('temp'), `magazapos_print_${Date.now()}.html`)

  try {
    fs.writeFileSync(tempPath, htmlContent, 'utf-8')
  } catch (err: any) {
    console.error('Failed to write print temp file:', err)
  }

  // Calculate pixel size for the window from mm to prevent blank viewport
  const winWidth = customPageSize?.width ? Math.max(300, Math.round(customPageSize.width * 4)) : 400
  const winHeight = customPageSize?.height ? Math.max(300, Math.round(customPageSize.height * 4)) : 600

  let printWindow: BrowserWindow | null = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      backgroundThrottling: false, // CRITICAL: Never pause paint/rasterization in background
    }
  })

  return new Promise((resolve) => {
    let resolved = false

    const safeCleanup = (result: { success: boolean; failureReason?: string }) => {
      if (resolved) return
      resolved = true
      clearTimeout(failsafeTimer)
      resolve(result)

      // CRITICAL: Keep window alive for 2 seconds after print call so Windows Print Spooler (spoolsv.exe)
      // completely flushes the EMF/GDI raster data to the printer driver. Immediate destruction cuts off the spool!
      setTimeout(() => {
        if (printWindow && !printWindow.isDestroyed()) {
          try { printWindow.close() } catch {}
          printWindow = null
        }
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath)
        } catch {}
      }, 2000)
    }

    const failsafeTimer = setTimeout(() => {
      safeCleanup({ success: false, failureReason: 'Yazdırma zaman aşımına uğradı (15sn)' })
    }, 15000)

    printWindow?.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
      safeCleanup({ success: false, failureReason: `Yükleme hatası: ${errorDescription} (${errorCode})` })
    })

    printWindow?.webContents.on('did-finish-load', () => {
      // 450ms delay to guarantee full CSS layout, font rasterization and SVG paint before dispatching to print spooler
      setTimeout(() => {
        if (!printWindow || printWindow.isDestroyed()) return

        const printOptions: any = {
          silent: silent !== false,
          printBackground: true,
          margins: { marginType: 'none' },
        }

        if (printerName && printerName.trim()) {
          printOptions.deviceName = printerName.trim()
        }

        if (customPageSize && customPageSize.width && customPageSize.height) {
          // Electron pageSize in microns (1 mm = 1000 microns)
          printOptions.pageSize = {
            width: Math.round(customPageSize.width * 1000),
            height: Math.round(customPageSize.height * 1000),
          }
        }

        printWindow.webContents.print(
          printOptions,
          (success, failureReason) => {
            if (!success) console.error('Print failed:', failureReason)
            safeCleanup({ success, failureReason })
          }
        )
      }, 450)
    })

    // Load local temp file (more reliable than data: URLs on Windows drivers)
    if (printWindow) {
      if (fs.existsSync(tempPath)) {
        printWindow.loadFile(tempPath)
      } else {
        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
      }
    }
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

