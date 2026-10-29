import { app, BrowserWindow, ipcMain, Menu, screen, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { startServer } from '../server'
import { prisma } from '../server/db'
import { getLocalIpAddress } from '../server/utils/network'

// MağazaPOS Main Electron Process & Express Server Entry
app.setName('MagazaPOS')

// Tekil Uygulama Kilidi (Single Instance Lock)
// Uygulama açıkken masaüstü simgesine tekrar tıklanırsa 2. veya 3. bir MagazaPOS kopyasının açılmasını engeller,
// mevcut açık pencereyi ekrana getirir.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  console.log('[Main] Başka bir MagazaPOS örneği zaten çalışıyor. Yeni kopya derhal sonlandırılıyor.')
  app.quit()
  process.exit(0)
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
}

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
let isCustomerDisplayBusy = false

function getAllCustomerWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows().filter((win) => {
    if (win === mainWindow || win.isDestroyed()) return false
    try {
      const title = win.getTitle() || ''
      const url = win.webContents?.getURL() || ''
      return (
        win === customerWindow ||
        title.includes('Müşteri Ekranı') ||
        url.includes('customer-display') ||
        url.includes('display=customer')
      )
    } catch {
      return win === customerWindow
    }
  })
}

function getCustomerDisplayStatus() {
  try {
    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    const secondaryDisplay = displays.find((d) => d.id !== primaryDisplay.id)
    const activeWindows = getAllCustomerWindows()
    const isOpen = activeWindows.length > 0 || (customerWindow !== null && !customerWindow.isDestroyed())

    return {
      isOpen,
      hasSecondary: Boolean(secondaryDisplay),
      displaysCount: displays.length,
      secondaryResolution: secondaryDisplay
        ? `${secondaryDisplay.bounds.width}x${secondaryDisplay.bounds.height}`
        : null,
    }
  } catch {
    const activeWindows = getAllCustomerWindows()
    return {
      isOpen: activeWindows.length > 0 || (customerWindow !== null && !customerWindow.isDestroyed()),
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

function enforceCustomerWindowBounds() {
  if (!customerWindow || customerWindow.isDestroyed()) return
  try {
    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    const secondaryDisplay = displays.find((d) => d.id !== primaryDisplay.id)
    if (secondaryDisplay) {
      const { x, y, width, height } = secondaryDisplay.bounds
      const cur = customerWindow.getBounds()
      if (cur.x !== x || cur.y !== y || cur.width !== width || cur.height !== height) {
        customerWindow.setBounds({ x, y, width, height })
      }
    }
  } catch (err) {
    console.warn('[CustomerDisplay] enforceBounds error:', err)
  }
}

function openCustomerDisplayWindow() {
  // 1. Zaten açık geçerli bir pencere varsa sadece öne getir, asla 2. pencere oluşturma
  if (customerWindow && !customerWindow.isDestroyed()) {
    try {
      enforceCustomerWindowBounds()
      customerWindow.show()
      broadcastCustomerDisplayStatus()
      return getCustomerDisplayStatus()
    } catch {}
  }

  // 2. Çoklu pencere açılmasını kesin önle: Varsa önceki yetim veya askıda pencereleri kapat
  const existing = getAllCustomerWindows()
  for (const win of existing) {
    try {
      if (!win.isDestroyed()) {
        win.removeAllListeners('closed')
        win.destroy()
      }
    } catch {}
  }
  customerWindow = null

  // 3. Tek pencere oluştur
  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()
  const secondaryDisplay = displays.find((d) => d.id !== primaryDisplay.id)

  const iconPath = path.resolve(__dirname, '../../public/icon.ico')

  if (secondaryDisplay) {
    // Çift ekranlı POS donanımı: 2. ekran koordinatlarına çerçevesiz tam ekran oturt
    const { x, y, width, height } = secondaryDisplay.bounds

    customerWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      resizable: false,
      movable: false,
      thickFrame: false, // Windows WS_THICKFRAME resize border ve blur anında kaymayı önler
      hasShadow: false,
      enableLargerThanScreen: true,
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
        backgroundThrottling: false, // Ana pencereye odaklanıldığında arka plandaki müşteri ekranının donmasını/yavaşlamasını engeller
      },
    })

    // Windows çoklu monitör DPI & focus kaybında kaymayı önlemek için bounds kilidi
    customerWindow.setBounds({ x, y, width, height })
    try {
      customerWindow.setAlwaysOnTop(true, 'screen-saver')
    } catch {
      customerWindow.setAlwaysOnTop(true)
    }

    // Windows OS focus/blur (kasa tıklandığında) pencerenin yukarı kaymasını kesin önleyen dinleyiciler
    let boundsDebounce: NodeJS.Timeout | null = null
    const handleShiftPrevent = () => {
      if (boundsDebounce) clearTimeout(boundsDebounce)
      boundsDebounce = setTimeout(() => {
        enforceCustomerWindowBounds()
      }, 30)
    }

    customerWindow.on('blur', handleShiftPrevent)
    customerWindow.on('move', handleShiftPrevent)
    customerWindow.on('resize', handleShiftPrevent)
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
  const existing = getAllCustomerWindows()
  let closedAny = false

  for (const win of existing) {
    try {
      if (!win.isDestroyed()) {
        win.removeAllListeners('closed')
        win.close()
        if (!win.isDestroyed()) {
          win.destroy()
        }
        closedAny = true
      }
    } catch (err) {
      console.error('[CustomerDisplay] Error closing window:', err)
    }
  }

  customerWindow = null
  broadcastCustomerDisplayStatus()
  return closedAny
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

  // Prevent multiple popups / hijack window.open for customer display & open web links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('customer-display') || url.includes('#customer-display')) {
      openCustomerDisplayWindow()
      return { action: 'deny' }
    }
    // External links and Spotify login should open in default browser
    if (url.startsWith('https:') || url.startsWith('http:') || url.startsWith('spotify:')) {
      shell.openExternal(url).catch((err) => console.error('Failed to open external URL:', err))
      return { action: 'deny' }
    }
    return { action: 'allow' }
  })

  // F11 tuşu ile kiosk / çerçevesiz tam ekran geçişi
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow?.setFullScreen(!mainWindow.isFullScreen())
      event.preventDefault()
    }
  })

  // Ana POS penceresi kapatıldığında bağlı tüm pencereleri (müşteri ekranı vb.) ve süreci temizce sonlandır
  mainWindow.on('closed', () => {
    mainWindow = null
    app.quit()
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
  try {
    const tempPath = path.join(app.getPath('temp'), `magazapos_print_${Date.now()}.html`)

    try {
      fs.writeFileSync(tempPath, htmlContent, 'utf-8')
    } catch (err: any) {
      console.error('Failed to write print temp file:', err)
    }

    // Calculate pixel size for the window from mm to prevent blank viewport
    const winWidth = customPageSize?.width ? Math.max(300, Math.round(customPageSize.width * 4)) : 400
    const winHeight = customPageSize?.height ? Math.max(300, Math.round(customPageSize.height * 4)) : 800

    let printWindow: BrowserWindow | null = new BrowserWindow({
      width: winWidth,
      height: winHeight,
      show: false,
      backgroundColor: '#ffffff',
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
            margins: { marginType: 'printableArea' },
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
  } catch (err: any) {
    console.error('print-silent unexpected error:', err)
    return { success: false, failureReason: err.message || 'Yazdırma penceresi başlatılamadı' }
  }
})

// IPC Handler: Raw ESC/POS Thermal Printing (Direct to Windows Print Spooler via winspool.drv)
ipcMain.handle('print-raw', async (_, printerName?: string, rawBase64?: string) => {
  if (!rawBase64) return { success: false, failureReason: 'Boş veri' }
  const buffer = Buffer.from(rawBase64, 'base64')

  if (process.platform !== 'win32') {
    console.log(`[RAW PRINT DEV] Sent ${buffer.length} bytes to printer: "${printerName || 'Default'}"`)
    return { success: true }
  }

  try {
    let targetPrinter = printerName?.trim()
    if (!targetPrinter && mainWindow && !mainWindow.isDestroyed()) {
      try {
        const printers = await mainWindow.webContents.getPrintersAsync()
        const def = printers.find((p) => p.isDefault) || printers[0]
        if (def) targetPrinter = def.name
      } catch {}
    }

    if (!targetPrinter) {
      return { success: false, failureReason: 'Varsayılan veya seçili yazıcı bulunamadı.' }
    }

    const tempBinPath = path.join(app.getPath('temp'), `magazapos_raw_${Date.now()}.bin`)
    fs.writeFileSync(tempBinPath, buffer)

    const psScriptPath = path.join(app.getPath('userData'), 'rawprint.ps1')
    const psScriptContent = `param([string]$pName, [string]$fPath)
$code = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public class DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO pDocInfo);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendFile(string szPrinterName, string szFileName) {
        if (!File.Exists(szFileName)) return false;
        byte[] bytes = File.ReadAllBytes(szFileName);
        IntPtr hPrinter;
        DOCINFO di = new DOCINFO();
        di.pDocName = "MagazaPOS Fis";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
            return true;
        }
        return false;
    }
}
'@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
$res = [RawPrinterHelper]::SendFile($pName, $fPath)
if ($res) { exit 0 } else { exit 1 }
`
    try {
      if (!fs.existsSync(psScriptPath) || fs.readFileSync(psScriptPath, 'utf-8') !== psScriptContent) {
        fs.writeFileSync(psScriptPath, psScriptContent, 'utf-8')
      }
    } catch {}

    return new Promise((resolve) => {
      const { execFile } = require('child_process')
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psScriptPath, targetPrinter, tempBinPath],
        { windowsHide: true, timeout: 8000 },
        (error: any) => {
          try {
            if (fs.existsSync(tempBinPath)) fs.unlinkSync(tempBinPath)
          } catch {}

          if (error) {
            console.error('print-raw powershell error:', error)
            resolve({ success: false, failureReason: error.message || 'Yazıcıya RAW komut gönderilemedi' })
          } else {
            resolve({ success: true })
          }
        }
      )
    })
  } catch (err: any) {
    console.error('print-raw exception:', err)
    return { success: false, failureReason: err.message || 'RAW yazdırma başlatılamadı' }
  }
})

// IPC Handler: Get system printers list
ipcMain.handle('get-printers', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return []
  try {
    return await mainWindow.webContents.getPrintersAsync()
  } catch (err) {
    console.error('getPrintersAsync error:', err)
    return []
  }
})

// IPC Handler: Get local IP for WiFi mobile connection
ipcMain.handle('get-local-ip', async () => {
  try {
    return getLocalIpAddress()
  } catch {
    return '127.0.0.1'
  }
})

// IPC Handler: Toggle fullscreen (F11) - targets the window that sent the event
ipcMain.handle('toggle-fullscreen', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
    if (!win || win.isDestroyed()) return false
    const isFull = !win.isFullScreen()
    win.setFullScreen(isFull)
    return isFull
  } catch {
    return false
  }
})

// IPC Handler: Query current fullscreen state
ipcMain.handle('is-fullscreen', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow
    if (!win || win.isDestroyed()) return false
    return win.isFullScreen()
  } catch {
    return false
  }
})


// IPC Handlers: Customer Display (Müşteri Ekranı) - Eşzamanlı çift çağrı kilidi (Mutex)
ipcMain.handle('open-customer-display', async () => {
  if (isCustomerDisplayBusy) return getCustomerDisplayStatus()
  isCustomerDisplayBusy = true
  try {
    return openCustomerDisplayWindow()
  } finally {
    setTimeout(() => {
      isCustomerDisplayBusy = false
    }, 400)
  }
})

ipcMain.handle('close-customer-display', async () => {
  if (isCustomerDisplayBusy) return true
  isCustomerDisplayBusy = true
  try {
    return closeCustomerDisplayWindow()
  } finally {
    setTimeout(() => {
      isCustomerDisplayBusy = false
    }, 400)
  }
})

ipcMain.handle('toggle-customer-display', async () => {
  if (isCustomerDisplayBusy) return getCustomerDisplayStatus()
  isCustomerDisplayBusy = true
  try {
    const active = getAllCustomerWindows()
    if (active.length > 0 || (customerWindow && !customerWindow.isDestroyed())) {
      closeCustomerDisplayWindow()
    } else {
      openCustomerDisplayWindow()
    }
    return getCustomerDisplayStatus()
  } finally {
    setTimeout(() => {
      isCustomerDisplayBusy = false
    }, 400)
  }
})

ipcMain.handle('get-customer-display-status', async () => {
  return getCustomerDisplayStatus()
})

ipcMain.handle('update-customer-display', async (_, data: any) => {
  cachedCustomerData = data
  try {
    if (customerWindow && !customerWindow.isDestroyed()) {
      enforceCustomerWindowBounds()
      customerWindow.webContents.send('customer-display-data', data)
    }
  } catch (err) {
    console.warn('[CustomerDisplay] Error sending IPC data:', err)
  }
  return true
})

ipcMain.handle('get-customer-display-state', async () => {
  return cachedCustomerData
})

ipcMain.handle('open-external', async (_, url: string) => {
  try {
    if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('spotify:'))) {
      await shell.openExternal(url)
      return { success: true }
    }
    return { success: false, error: 'Geçersiz URL' }
  } catch (err: any) {
    console.error('Failed to open external URL:', err)
    return { success: false, error: err.message }
  }
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
  app.quit()
})

app.on('before-quit', async () => {
  try {
    if (prisma) {
      await prisma.$disconnect().catch(() => {})
    }
  } catch {}
})

