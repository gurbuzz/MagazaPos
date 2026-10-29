import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Settings,
  ShieldCheck,
  Lock,
  Store,
  User,
  Hash,
  Check,
  Database,
  Download,
  Upload,
  Trash2,
  Percent,
  AlertTriangle,
  FileText,
  MapPin,
  Phone,
  Wifi,
  Globe,
  RefreshCw,
  Loader2,
  Tv,
  Monitor,
  ExternalLink,
  QrCode,
  Sun,
  Moon,
  Printer,
} from 'lucide-react'
import QRCode from 'qrcode'
import { usePosStore } from '../../store/usePosStore'
import { useKeyboardStore } from '../../store/useKeyboardStore'
import { syncCustomerDisplay } from '../../utils/customerDisplaySync'
import { printReceipt } from '../../utils/printReceipt'
import lufianLogo from '../../assets/lufian-og.png'
import jackJonesLogo from '../../assets/org_logo.svg'

interface SystemSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

// Inline PIN Confirmation Dialog types
type PinDialogAction = 'reset-sales' | 'reset-all' | 'restore-db' | null

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    storeName,
    storeAddress,
    storePhone,
    cashierName,
    pinCode,
    receiptPrefix,
    receiptFooterNote,
    vatRate,
    lowStockThreshold,
    autoPrintReceipt,
    receiptPrinter,
    receiptPrintMode,
    customIp,
    localIp,
    autoOpenCustomerDisplay,
    customerDisplayMessage,
    customerDisplayTheme,
    updateSystemSettings,
    lockApp,
  } = usePosStore()

  const [activeTab, setActiveTab] = useState<'general' | 'receipt' | 'display' | 'network' | 'database'>('general')

  const [formStoreName, setFormStoreName] = useState(storeName)
  const [formStoreAddress, setFormStoreAddress] = useState(storeAddress)
  const [formStorePhone, setFormStorePhone] = useState(storePhone)
  const [formCashierName, setFormCashierName] = useState(cashierName)
  const [formPinCode, setFormPinCode] = useState(pinCode)
  const [formReceiptPrefix, setFormReceiptPrefix] = useState(receiptPrefix)
  const [formReceiptFooter, setFormReceiptFooter] = useState(receiptFooterNote)
  const [formVatRate, setFormVatRate] = useState(vatRate)
  const [formLowStock, setFormLowStock] = useState(lowStockThreshold)
  const [formAutoPrint, setFormAutoPrint] = useState(autoPrintReceipt)
  const [formReceiptPrinter, setFormReceiptPrinter] = useState(receiptPrinter)
  const [formReceiptPrintMode, setFormReceiptPrintMode] = useState<'ESC_POS' | 'HTML'>(receiptPrintMode || 'ESC_POS')
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([])
  const [isTestingPrinter, setIsTestingPrinter] = useState(false)
  const [testPrinterResult, setTestPrinterResult] = useState<string | null>(null)
  const [formCustomIp, setFormCustomIp] = useState(customIp)
  const [formAutoOpenCustomerDisplay, setFormAutoOpenCustomerDisplay] = useState(autoOpenCustomerDisplay)
  const [formCustomerDisplayMessage, setFormCustomerDisplayMessage] = useState(customerDisplayMessage)
  const [formCustomerDisplayTheme, setFormCustomerDisplayTheme] = useState<'dark' | 'light'>(customerDisplayTheme || 'dark')

  const { autoOpen: autoOpenKeyboard, setAutoOpen: setAutoOpenKeyboard } = useKeyboardStore()
  const [formAutoOpenKeyboard, setFormAutoOpenKeyboard] = useState(autoOpenKeyboard)

  const [customerDisplayHardware, setCustomerDisplayHardware] = useState<{
    isOpen: boolean
    hasSecondary: boolean
    displaysCount: number
    secondaryResolution?: string | null
  }>({
    isOpen: false,
    hasSecondary: false,
    displaysCount: 1,
  })

  // Admin PIN change fields
  const [formNewAdminPin, setFormNewAdminPin] = useState('')
  const [formConfirmAdminPin, setFormConfirmAdminPin] = useState('')
  const [adminPinSaveStatus, setAdminPinSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [adminPinError, setAdminPinError] = useState('')

  const [detectedIps, setDetectedIps] = useState<any[]>([])
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [copiedNotice, setCopiedNotice] = useState<'display' | 'mobile' | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [mobileQrDataUrl, setMobileQrDataUrl] = useState<string>('')

  const activeIp = (formCustomIp || '').trim() || localIp || '127.0.0.1'
  const mobileUrl = `http://${activeIp}:3782/mobile`
  const customerDisplayUrl = `http://${activeIp}:3782/customer-display`

  useEffect(() => {
    QRCode.toDataURL(mobileUrl, {
      margin: 1,
      width: 130,
      color: { dark: '#00268A', light: '#ffffff' },
    })
      .then(setMobileQrDataUrl)
      .catch(() => {})
  }, [mobileUrl])

  // Backup download state
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Inline PIN Dialog state
  const [pinDialogAction, setPinDialogAction] = useState<PinDialogAction>(null)
  const [pinDialogInput, setPinDialogInput] = useState('')
  const [pinDialogError, setPinDialogError] = useState('')
  const [pinDialogLoading, setPinDialogLoading] = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [restoreError, setRestoreError] = useState('')
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live Database Health & Diagnostics state
  const [dbInfo, setDbInfo] = useState<{
    dbPath?: string
    sizeKb?: number
    integrity?: string
    counts?: { products: number; sales: number; customers: number }
    backupsCount?: number
  } | null>(null)
  const [isLoadingDbInfo, setIsLoadingDbInfo] = useState(false)

  const fetchDbInfo = () => {
    setIsLoadingDbInfo(true)
    fetch(`/api/system/db-info?pin=${encodeURIComponent(pinCode)}`, {
      headers: { 'X-Pin-Code': pinCode },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setDbInfo(data)
      })
      .catch(() => {})
      .finally(() => setIsLoadingDbInfo(false))
  }

  const fetchNetworkIps = () => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.allIps) {
          setDetectedIps(data.allIps)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    setFormStoreName(storeName)
    setFormStoreAddress(storeAddress)
    setFormStorePhone(storePhone)
    setFormCashierName(cashierName)
    setFormPinCode(pinCode)
    setFormReceiptPrefix(receiptPrefix)
    setFormReceiptFooter(receiptFooterNote)
    setFormVatRate(vatRate)
    setFormLowStock(lowStockThreshold)
    setFormAutoPrint(autoPrintReceipt)
    setFormReceiptPrinter(receiptPrinter)
    setFormReceiptPrintMode(receiptPrintMode || 'ESC_POS')
    setTestPrinterResult(null)
    setFormCustomIp(customIp)
    setFormAutoOpenCustomerDisplay(autoOpenCustomerDisplay)
    setFormCustomerDisplayMessage(customerDisplayMessage)
    setFormCustomerDisplayTheme(customerDisplayTheme || 'dark')
    setFormAutoOpenKeyboard(autoOpenKeyboard)

    // Load system printers for receipt printer selection
    if (window.electron?.getPrinters) {
      window.electron.getPrinters().then((list) => {
        setAvailablePrinters(list || [])
      }).catch(() => {})
    }

    // Check display hardware
    if (window.electron?.getCustomerDisplayStatus) {
      window.electron.getCustomerDisplayStatus().then((s) => {
        setCustomerDisplayHardware(s || { isOpen: false, hasSecondary: false, displaysCount: 1 })
      }).catch(() => {})
    }

    // Ensure server security PIN is synchronized when settings modal opens
    if (isOpen && pinCode) {
      fetch('/api/system/update-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinCode }),
      }).catch(() => {})
    }
  }, [
    isOpen,
    storeName,
    storeAddress,
    storePhone,
    cashierName,
    pinCode,
    receiptPrefix,
    receiptFooterNote,
    vatRate,
    lowStockThreshold,
    autoPrintReceipt,
    receiptPrinter,
    customIp,
    autoOpenCustomerDisplay,
    customerDisplayMessage,
    customerDisplayTheme,
    autoOpenKeyboard,
  ])

  // Focus PIN input when dialog opens
  useEffect(() => {
    if (pinDialogAction && pinInputRef.current) {
      setTimeout(() => pinInputRef.current?.focus(), 100)
    }
  }, [pinDialogAction])

  // Fetch DB diagnostics when database tab is clicked
  useEffect(() => {
    if (isOpen && activeTab === 'database') {
      fetchDbInfo()
    }
  }, [isOpen, activeTab])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSettingsError(null)

    if (!formPinCode || formPinCode.length !== 4 || !/^\d{4}$/.test(formPinCode)) {
      setSettingsError('PIN Şifresi tam 4 haneli rakamlardan oluşmalıdır! (Örn: 1234)')
      return
    }

    updateSystemSettings({
      storeName: (formStoreName || '').trim() || 'JACK & JONES',
      storeAddress: (formStoreAddress || '').trim(),
      storePhone: (formStorePhone || '').trim(),
      cashierName: (formCashierName || '').trim() || 'Kasiyer 1',
      pinCode: formPinCode,
      receiptPrefix: (formReceiptPrefix || '').trim() || 'FIS-',
      receiptFooterNote: (formReceiptFooter || '').trim(),
      vatRate: Number(formVatRate) || 10,
      lowStockThreshold: Number(formLowStock) || 5,
      autoPrintReceipt: formAutoPrint,
      receiptPrinter: formReceiptPrinter,
      receiptPrintMode: formReceiptPrintMode,
      customIp: (formCustomIp || '').trim(),
      autoOpenCustomerDisplay: formAutoOpenCustomerDisplay,
      customerDisplayMessage: (formCustomerDisplayMessage || '').trim(),
      customerDisplayTheme: formCustomerDisplayTheme,
    })

    syncCustomerDisplay({
      theme: formCustomerDisplayTheme,
      force: true,
    })

    setAutoOpenKeyboard(formAutoOpenKeyboard)

    // Sync PIN to backend security manager
    fetch('/api/system/update-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinCode: formPinCode }),
    }).catch(() => {})

    setSavedSuccess(true)
    setTimeout(() => {
      setSavedSuccess(false)
      onClose()
    }, 1000)
  }

  // ─── Test Print Receipt ─────────────────────────────────────────
  const handleTestPrintReceipt = async (modeOverride?: 'ESC_POS' | 'HTML') => {
    setIsTestingPrinter(true)
    setTestPrinterResult(null)
    const activeMode = modeOverride || formReceiptPrintMode
    try {
      const result = await printReceipt(
        {
          receiptNo: `${formReceiptPrefix || 'FIS-'}TEST`,
          createdAt: new Date(),
          cashierName: formCashierName || 'Kasiyer 1',
          totalAmount: 149.90,
          subtotal: 149.90,
          paymentMode: 'CASH',
          givenCash: 200,
          changeDue: 50.10,
          items: [
            {
              productName: 'TEST ÜRÜNÜ (DENEME)',
              color: 'Siyah',
              size: 'M',
              quantity: 1,
              unitPrice: 149.90,
              totalPrice: 149.90,
            },
          ],
          storeInfo: {
            storeName: formStoreName || 'JACK & JONES',
            storeAddress: formStoreAddress,
            storePhone: formStorePhone,
            receiptFooterNote: formReceiptFooter || 'Test fişi başarıyla yazdırıldı.',
            vatRate: Number(formVatRate) || 10,
            receiptPrinter: formReceiptPrinter,
            receiptPrintMode: activeMode,
          },
        },
        activeMode
      )

      if (result.success) {
        setTestPrinterResult(`Test fişi (${activeMode === 'ESC_POS' ? 'ESC/POS Komut' : 'Grafik Modu'}) başarıyla yazıcıya gönderildi!`)
        setTimeout(() => setTestPrinterResult(null), 5000)
      } else {
        setTestPrinterResult(`Test hatası: ${result.error || 'Yazıcıya ulaşılamadı'}`)
      }
    } catch (err: any) {
      setTestPrinterResult(`Test hatası: ${err.message || 'Bilinmeyen hata'}`)
    } finally {
      setIsTestingPrinter(false)
    }
  }

  // ─── Backup Download (fetch + Blob) ────────────────────────────
  const handleBackupDb = async () => {
    setIsDownloading(true)
    setDownloadStatus('idle')
    try {
      const res = await fetch(`/api/system/backup-db?pin=${encodeURIComponent(pinCode)}`, {
        headers: {
          'X-Pin-Code': pinCode,
        },
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      // Read filename from Content-Disposition header if provided
      const disposition = res.headers.get('content-disposition')
      let filename = `magazapos_yedek_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.db`
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/)
        if (match && match[1]) {
          filename = match[1]
        }
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setDownloadStatus('success')
      setTimeout(() => setDownloadStatus('idle'), 3000)
      fetchDbInfo()
    } catch (err: any) {
      console.error('Backup download error:', err)
      setDownloadStatus('error')
      setTimeout(() => setDownloadStatus('idle'), 4000)
    } finally {
      setIsDownloading(false)
    }
  }

  // ─── PIN Dialog Helpers ────────────────────────────────────────
  const openPinDialog = (action: PinDialogAction) => {
    setPinDialogAction(action)
    setPinDialogInput('')
    setPinDialogError('')
    setPinDialogLoading(false)
  }

  const closePinDialog = () => {
    setPinDialogAction(null)
    setPinDialogInput('')
    setPinDialogError('')
    setPinDialogLoading(false)
  }

  const getPinDialogTitle = (): string => {
    switch (pinDialogAction) {
      case 'reset-sales':
        return '⚠️ Satış Geçmişini Sıfırla'
      case 'reset-all':
        return '🔴 Tüm Veritabanını Sıfırla'
      case 'restore-db':
        return '📦 Yedekten Geri Yükle'
      default:
        return ''
    }
  }

  const getPinDialogWarning = (): string => {
    switch (pinDialogAction) {
      case 'reset-sales':
        return 'Tüm geçmiş satış kayıtları ve Z Raporu verileri temizlenecektir. İşlem öncesi otomatik güvenlik yedeği alınacaktır.'
      case 'reset-all':
        return 'DİKKAT: Tüm ürünler, varyantlar, stoklar, müşteriler ve satış kayıtları sıfırlanacaktır! İşlem öncesi otomatik güvenlik yedeği alınacaktır.'
      case 'restore-db':
        return 'Mevcut veritabanı seçilen yedek dosyası ile değiştirilecektir. İşlem öncesi mevcut canlı verilerinizin güvenlik yedeği otomatik olarak alınacaktır.'
      default:
        return ''
    }
  }

  const handlePinDialogSubmit = async () => {
    if (!pinDialogInput || pinDialogInput.length !== 6 || !/^\d{6}$/.test(pinDialogInput)) {
      setPinDialogError('6 haneli Yönetici PIN şifresi giriniz.')
      return
    }

    setPinDialogLoading(true)
    setPinDialogError('')

    try {
      if (pinDialogAction === 'reset-sales') {
        const res = await fetch('/api/system/reset-sales', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Pin': pinDialogInput,
          },
          body: JSON.stringify({ adminPin: pinDialogInput }),
        })
        const data = await res.json()
        if (res.ok) {
          closePinDialog()
          setDownloadStatus('success')
          fetchDbInfo()
          setTimeout(() => setDownloadStatus('idle'), 3000)
          setIsResetting(false)
        } else {
          setPinDialogError(data.error || 'Yetkisiz erişim veya hata oluştu.')
        }
      } else if (pinDialogAction === 'reset-all') {
        const res = await fetch('/api/system/reset-all', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Pin': pinDialogInput,
          },
          body: JSON.stringify({ adminPin: pinDialogInput }),
        })
        const data = await res.json()
        if (res.ok) {
          closePinDialog()
          window.location.reload()
        } else {
          setPinDialogError(data.error || 'Yetkisiz erişim veya hata oluştu.')
        }
      } else if (pinDialogAction === 'restore-db') {
        if (!restoreFile) {
          setPinDialogError('Lütfen önce bir yedek dosyası seçin.')
          setPinDialogLoading(false)
          return
        }

        setIsRestoring(true)
        const formData = new FormData()
        formData.append('dbFile', restoreFile)
        formData.append('adminPin', pinDialogInput)

        const res = await fetch('/api/system/restore-db', {
          method: 'POST',
          headers: {
            'X-Admin-Pin': pinDialogInput,
          },
          body: formData,
        })
        const data = await res.json()
        if (res.ok && data.success) {
          closePinDialog()
          const details = data.details
          const detailMsg = details
            ? `Veritabanı başarıyla geri yüklendi! (${details.products || 0} Ürün, ${details.sales || 0} Satış)`
            : (data.message || 'Veritabanı yedeği başarıyla geri yüklendi!')
          setRestoreSuccessMessage(detailMsg)
          setRestoreStatus('success')
          setRestoreFile(null)
          // Reload after short delay to let user see success
          setTimeout(() => window.location.reload(), 1800)
        } else {
          const errMsg = data.error || 'Geri yükleme hatası oluştu.'
          setPinDialogError(errMsg)
          setRestoreError(errMsg)
          setIsRestoring(false)
        }
      }
    } catch (err: any) {
      const errMsg = 'Sunucu hatası: ' + err.message
      setPinDialogError(errMsg)
      setRestoreError(errMsg)
      setIsRestoring(false)
    } finally {
      setPinDialogLoading(false)
    }
  }

  // ─── Restore file selection ────────────────────────────────────
  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!['db', 'sqlite', 'sqlite3'].includes(ext || '')) {
        setRestoreError('Lütfen sadece .db, .sqlite veya .sqlite3 uzantılı bir yedek dosyası seçin.')
        setRestoreFile(null)
        return
      }
      if (file.size < 20480) {
        setRestoreError('Seçilen dosya çok küçük (< 20 KB). Geçerli bir MagazaPOS veritabanı yedeği değildir.')
        setRestoreFile(null)
        return
      }
      setRestoreFile(file)
      setRestoreError('')
      setRestoreStatus('idle')
      setRestoreSuccessMessage('')
    }
  }

  const handleRestoreStart = () => {
    if (!restoreFile) {
      setRestoreError('Lütfen bir .db yedek dosyası seçin.')
      return
    }
    openPinDialog('restore-db')
  }

  const handleAdminPinChange = async () => {
    setAdminPinError('')
    setAdminPinSaveStatus('idle')

    if (!formNewAdminPin || formNewAdminPin.length !== 6 || !/^\d{6}$/.test(formNewAdminPin)) {
      setAdminPinError('Yeni Yönetici PIN tam 6 haneli rakam olmalıdır.')
      return
    }

    if (formNewAdminPin !== formConfirmAdminPin) {
      setAdminPinError('Yeni PIN ile tekrarı eşleşmiyor!')
      return
    }

    try {
      const currentAdminPin = localStorage.getItem('pos_admin_pin_session') || sessionStorage.getItem('pos_admin_pin_session') || ''
      const res = await fetch('/api/system/update-admin-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': currentAdminPin,
        },
        body: JSON.stringify({
          adminPin: currentAdminPin,
          newAdminPin: formNewAdminPin,
        }),
      })

      if (res.ok) {
        setAdminPinSaveStatus('success')
        sessionStorage.setItem('pos_admin_pin_session', formNewAdminPin)
        localStorage.setItem('pos_admin_pin_session', formNewAdminPin)
        setFormNewAdminPin('')
        setFormConfirmAdminPin('')
        setTimeout(() => setAdminPinSaveStatus('idle'), 3000)
      } else {
        const data = await res.json()
        setAdminPinError(data.error || 'PIN güncellenemedi.')
        setAdminPinSaveStatus('error')
      }
    } catch (err: any) {
      setAdminPinError('Sunucu hatası: ' + err.message)
      setAdminPinSaveStatus('error')
    }
  }

  const handleLockNow = () => {
    onClose()
    lockApp()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
      <div className="glass-modal rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs flex items-center space-x-1.5">
              <img
                src={lufianLogo}
                alt="LUFIAN"
                className="h-4 w-auto max-w-[65px] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = 'true'
                    target.src = './lufian-og.png'
                  }
                }}
              />
              <div className="h-3.5 w-px bg-slate-300" />
              <img
                src={jackJonesLogo}
                alt="JACK & JONES"
                className="h-3 w-auto max-w-[75px] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = 'true'
                    target.src = './org_logo.svg'
                  }
                }}
              />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Sistem ve Kasa Ayarları</h3>
              <p className="text-[11px] text-slate-500 font-medium">Mağaza, fiş, IP adresi ve veritabanı yönetimi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 pt-2 bg-slate-50 border-b border-slate-200 flex space-x-1">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-t transition border-b-2 ${
              activeTab === 'general'
                ? 'bg-white border-blue-700 text-blue-700 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Genel & Güvenlik
          </button>

          <button
            onClick={() => setActiveTab('receipt')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-t transition border-b-2 ${
              activeTab === 'receipt'
                ? 'bg-white border-blue-700 text-blue-700 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Fiş & Fatura
          </button>

          <button
            onClick={() => {
              setActiveTab('display')
              if (window.electron?.getCustomerDisplayStatus) {
                window.electron.getCustomerDisplayStatus().then((s) => setCustomerDisplayHardware(s))
              }
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-t transition border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'display'
                ? 'bg-white border-blue-700 text-blue-700 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Müşteri Ekranı (2. Ekran)</span>
            {customerDisplayHardware?.hasSecondary && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-t transition border-b-2 ${
              activeTab === 'network'
                ? 'bg-white border-blue-700 text-blue-700 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Ağ & Mobil IP
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-t transition border-b-2 ${
              activeTab === 'database'
                ? 'bg-white border-rose-700 text-rose-700 shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Veritabanı & Yedek
          </button>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {settingsError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-semibold text-rose-800 flex items-center justify-between shadow-2xs">
              <span>⚠️ {settingsError}</span>
              <button
                type="button"
                onClick={() => setSettingsError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: General & Security */}
          {activeTab === 'general' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-700" />
                    <span>Mağaza / Firma Adı</span>
                  </label>
                  <input
                    type="text"
                    value={formStoreName}
                    onChange={(e) => setFormStoreName(e.target.value)}
                    placeholder="Örn: JACK & JONES"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-[#00268A] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-blue-700" />
                    <span>Aktif Kasiyer Adı</span>
                  </label>
                  <input
                    type="text"
                    value={formCashierName}
                    onChange={(e) => setFormCashierName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-700" />
                    <span>Mağaza Adresi</span>
                  </label>
                  <input
                    type="text"
                    value={formStoreAddress}
                    onChange={(e) => setFormStoreAddress(e.target.value)}
                    placeholder="Örn: Atatürk Cad. No:14 Kadıköy"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-blue-700" />
                    <span>Mağaza Telefonu</span>
                  </label>
                  <input
                    type="text"
                    value={formStorePhone}
                    onChange={(e) => setFormStorePhone(e.target.value)}
                    placeholder="Örn: 0216 345 67 89"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded space-y-2">
                <label className="block text-xs font-semibold text-blue-900 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>4 Haneli Kasa Giriş PIN Şifresi</span>
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    maxLength={4}
                    value={formPinCode}
                    onChange={(e) => setFormPinCode(e.target.value)}
                    placeholder="1234"
                    className="w-32 px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono text-sm tracking-widest font-bold focus:ring-1 focus:ring-blue-600 focus:outline-none text-center"
                  />
                  <span className="text-[11px] text-slate-600 font-medium">
                    Açılışta ve kilitlemede bu 4 haneli PIN istenir.
                  </span>
                </div>
              </div>

              {/* Admin PIN Change Section */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded space-y-2.5">
                <label className="block text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
                  <Lock className="w-4 h-4 text-indigo-700" />
                  <span>6 Haneli Yönetici PIN Şifresi</span>
                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] rounded font-bold uppercase tracking-wider">
                    Sadece Patron / Yönetici
                  </span>
                </label>
                <p className="text-[10px] text-indigo-700 font-medium">
                  Ciro raporları, stok düzeltme ve sistem ayarlarına erişim için bu şifre gereklidir. Kasiyerlere paylaşmayın!
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Yeni Yönetici PIN</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={formNewAdminPin}
                      onChange={(e) => setFormNewAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono text-sm tracking-widest font-bold focus:ring-1 focus:ring-indigo-600 focus:outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">PIN Tekrarı</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={formConfirmAdminPin}
                      onChange={(e) => setFormConfirmAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-900 font-mono text-sm tracking-widest font-bold focus:ring-1 focus:ring-indigo-600 focus:outline-none text-center"
                    />
                  </div>
                </div>
                {adminPinError && (
                  <p className="text-[11px] text-rose-600 font-bold">⚠️ {adminPinError}</p>
                )}
                {adminPinSaveStatus === 'success' && (
                  <p className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Yönetici PIN başarıyla güncellendi!</span>
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleAdminPinChange}
                  disabled={!formNewAdminPin || !formConfirmAdminPin}
                  className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded transition shadow-2xs disabled:opacity-40"
                >
                  Yönetici PIN'i Güncelle
                </button>
              </div>

              {/* Virtual Keyboard Behavior */}
              <div className="flex items-center space-x-2.5 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <input
                  type="checkbox"
                  id="autoOpenVirtualKeyboard"
                  checked={formAutoOpenKeyboard}
                  onChange={(e) => setFormAutoOpenKeyboard(e.target.checked)}
                  className="w-4 h-4 text-blue-700 rounded focus:ring-blue-600 border-slate-300"
                />
                <div>
                  <label htmlFor="autoOpenVirtualKeyboard" className="text-xs font-bold text-slate-800 cursor-pointer block">
                    Kutulara Tıklandığında Sanal Ekran Klavyesini Otomatik Aç
                  </label>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Kapalıyken dokunmatik sanal klavye yalnızca sol alttaki veya üst bardaki "Klavye" butonuna tıklandığında açılır.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Receipt & Printers */}
          {activeTab === 'receipt' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <Hash className="w-3.5 h-3.5 text-blue-700" />
                    <span>Fiş Numarası Öneki</span>
                  </label>
                  <input
                    type="text"
                    value={formReceiptPrefix}
                    onChange={(e) => setFormReceiptPrefix(e.target.value)}
                    placeholder="FIS-"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono text-xs font-bold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <Percent className="w-3.5 h-3.5 text-blue-700" />
                    <span>Varsayılan KDV Oranı (%)</span>
                  </label>
                  <input
                    type="number"
                    value={formVatRate}
                    onChange={(e) => setFormVatRate(Number(e.target.value))}
                    placeholder="10"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-bold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-700" />
                  <span>Fiş Alt Bilgi Notu / Değişim Politikası</span>
                </label>
                <textarea
                  rows={2}
                  value={formReceiptFooter}
                  onChange={(e) => setFormReceiptFooter(e.target.value)}
                  placeholder="Ürün değişimleriniz için fişinizle birlikte 14 gün içinde müracaat ediniz."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Kritik Stok Uyarısı Eşiği</span>
                  </label>
                  <input
                    type="number"
                    value={formLowStock}
                    onChange={(e) => setFormLowStock(Number(e.target.value))}
                    placeholder="5"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-bold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="autoPrint"
                    checked={formAutoPrint}
                    onChange={(e) => setFormAutoPrint(e.target.checked)}
                    className="w-4 h-4 text-blue-700 rounded focus:ring-blue-600 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="autoPrint" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Tahsilat Sonrası Otomatik Fiş Yazdır
                  </label>
                </div>
              </div>

              {/* Receipt / Thermal Printer Hardware Selection */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Printer className="w-4 h-4 text-blue-700" />
                    <span>Fiş / Termal Yazıcı Donanımı (80mm)</span>
                  </label>
                  {availablePrinters.length > 0 && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      {availablePrinters.length} yazıcı algılandı
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Hedef Fiş Yazıcısı:
                  </label>
                  <select
                    value={formReceiptPrinter}
                    onChange={(e) => setFormReceiptPrinter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  >
                    <option value="">Varsayılan Termal Yazıcı (İşletim Sistemi Varsayılanı)</option>
                    {availablePrinters.map((p: any) => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? ' (Sistem Varsayılanı)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Print Engine Mode Selection */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Baskı Teknolojisi / Yazdırma Modu:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormReceiptPrintMode('ESC_POS')}
                      className={`p-2.5 rounded-lg border text-left transition flex flex-col space-y-1 cursor-pointer ${
                        formReceiptPrintMode === 'ESC_POS'
                          ? 'bg-blue-50/80 border-blue-600 text-[#00268A] ring-1 ring-blue-600'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold flex items-center space-x-1">
                          <span>⚡ ESC/POS Modu</span>
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Önerilen
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Doğrudan termal komut. Generic/Salt Metin ve tüm 80mm fiş yazıcılarıyla %100 uyumludur. Boş kağıt sorununu çözer.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormReceiptPrintMode('HTML')}
                      className={`p-2.5 rounded-lg border text-left transition flex flex-col space-y-1 cursor-pointer ${
                        formReceiptPrintMode === 'HTML'
                          ? 'bg-blue-50/80 border-blue-600 text-[#00268A] ring-1 ring-blue-600'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">📄 Grafik / HTML Modu</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Windows grafik sürücüsü. Sayfa düzenini HTML motoru üzerinden sürücüye EMF olarak iletir.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Test Print Buttons */}
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    disabled={isTestingPrinter}
                    onClick={() => handleTestPrintReceipt('ESC_POS')}
                    className="flex-1 px-3 py-2 bg-[#00268A] hover:bg-[#001f70] text-white rounded text-xs font-bold transition flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isTestingPrinter ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Yazdırılıyor...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="w-3.5 h-3.5 text-white" />
                        <span>⚡ ESC/POS Test Fişi Kes</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isTestingPrinter}
                    onClick={() => handleTestPrintReceipt('HTML')}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <span>📄 Grafik Testi</span>
                  </button>
                </div>

                {testPrinterResult && (
                  <div
                    className={`p-2 rounded text-xs font-medium flex items-center justify-between ${
                      testPrinterResult.includes('başarıyla')
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-50 text-amber-800 border border-amber-300'
                    }`}
                  >
                    <span>{testPrinterResult}</span>
                    <button
                      type="button"
                      onClick={() => setTestPrinterResult(null)}
                      className="ml-2 font-bold text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Troubleshooting Note */}
                <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg text-[11px] text-blue-900 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <span>💡 Fiş Yazıcıdan Boş Kağıt Çıkıyorsa Çözüm:</span>
                  </div>
                  <p>
                    Windows aygıtlarından sınama sayfası yazdırılabiliyor ama programdan boş kağıt çıkıyorsa; fiş yazıcınız Windows'ta <strong>"Generic / Text Only" (Genel / Salt Metin)</strong> sürücüsüyle yüklenmiş olabilir veya sürücü grafik sayfa boyutunu reddediyordur.
                  </p>
                  <p className="font-semibold text-blue-950">
                    ➡️ Yukarıdaki <strong>"⚡ ESC/POS Modu"</strong> seçeneğini işaretleyip <strong>"Ayarları Kaydet"</strong> butonuna basınız. ESC/POS komutları Windows grafik katmanını atlayıp doğrudan donanıma ulaştığı için yazı eksiksiz ve anında basılacaktır.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Customer Display (Müşteri Ekranı) */}
          {activeTab === 'display' && (
            <div className="space-y-4">
              {/* Hardware Monitor Detection Status */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4 text-blue-700" />
                    <h5 className="font-bold text-xs text-slate-800">
                      Çift Ekran POS Donanım Durumu
                    </h5>
                  </div>
                  {customerDisplayHardware?.hasSecondary ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span>2. Ekran Algılandı (Çift Ekran Aktif ✅)</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-bold">
                      Tek Monitör (Önizleme Modu)
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p>
                    {customerDisplayHardware?.hasSecondary ? (
                      <>
                        Bilgisayarınıza bağlı <strong>{customerDisplayHardware?.displaysCount || 2} adet monitör</strong> tespit edildi.
                        {customerDisplayHardware?.secondaryResolution && (
                          <span className="ml-1 text-slate-500 font-mono">
                            (2. Ekran Çözünürlüğü: {customerDisplayHardware.secondaryResolution})
                          </span>
                        )}
                        {' '}Müşteri ekranı açıldığında otomatik olarak 2. ekrana çerçevesiz ve tam ekran olarak yansıtılacaktır.
                      </>
                    ) : (
                      <>
                        Şu anda sisteme bağlı <strong>1 adet ana monitör</strong> görünüyor. Müşteri ekranını açtığınızda test ve önizleme amaçlı bağımsız bir pencerede görüntülenecektir.
                      </>
                    )}
                  </p>
                </div>

                {/* Instant Actions */}
                <div className="flex items-center space-x-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.electron?.openCustomerDisplay) {
                        const s = await window.electron.openCustomerDisplay()
                        setCustomerDisplayHardware(s)
                      } else {
                        window.open('/#customer-display', 'CustomerDisplay', 'width=1024,height=720')
                      }
                    }}
                    className="px-3 py-1.5 bg-[#00268A] hover:bg-[#001f70] text-white rounded text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs"
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Müşteri Ekranını Şimdi Aç / Test Et</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (window.electron?.closeCustomerDisplay) {
                        await window.electron.closeCustomerDisplay()
                        if (window.electron.getCustomerDisplayStatus) {
                          const s = await window.electron.getCustomerDisplayStatus()
                          setCustomerDisplayHardware(s)
                        }
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border border-slate-300 transition"
                  >
                    Ekranı Kapat
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (window.electron?.getCustomerDisplayStatus) {
                        const s = await window.electron.getCustomerDisplayStatus()
                        setCustomerDisplayHardware(s)
                      }
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200 transition"
                    title="Monitörleri Yeniden Algıla"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Startup & Behavior Settings */}
              <div className="space-y-3 pt-1">
                {/* Theme Selector for Customer Display */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block">
                        Müşteri Ekranı Teması / Arka Plan Rengi
                      </label>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Müşteri ekranının renk düzenini seçin (yalnızca renkler değişir, yerleşim ve özellikler korunur).
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {formCustomerDisplayTheme === 'light' ? 'Açık / Beyaz Tema' : 'Klasik Koyu Tema'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Dark Theme Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormCustomerDisplayTheme('dark')
                        syncCustomerDisplay({ theme: 'dark', force: true })
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                        formCustomerDisplayTheme === 'dark'
                          ? 'bg-slate-900 text-white border-blue-600 shadow-md ring-2 ring-blue-500/40'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Moon className={`w-4 h-4 ${formCustomerDisplayTheme === 'dark' ? 'text-blue-400' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold flex items-center space-x-1.5">
                          <span>Koyu Tema</span>
                          {formCustomerDisplayTheme === 'dark' && (
                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                          )}
                        </div>
                        <div className={`text-[10px] truncate ${formCustomerDisplayTheme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
                          Klasik koyu lacivert arka plan
                        </div>
                      </div>
                    </button>

                    {/* Light / White Theme Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormCustomerDisplayTheme('light')
                        syncCustomerDisplay({ theme: 'light', force: true })
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center space-x-3 transition-all cursor-pointer ${
                        formCustomerDisplayTheme === 'light'
                          ? 'bg-white text-slate-900 border-blue-600 shadow-md ring-2 ring-blue-500/40'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                        <Sun className={`w-4 h-4 ${formCustomerDisplayTheme === 'light' ? 'text-amber-500' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold flex items-center space-x-1.5">
                          <span>Beyaz / Açık Tema</span>
                          {formCustomerDisplayTheme === 'light' && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          )}
                        </div>
                        <div className={`text-[10px] truncate ${formCustomerDisplayTheme === 'light' ? 'text-slate-600' : 'text-slate-500'}`}>
                          Ferah modern beyaz arka plan
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2.5 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <input
                    type="checkbox"
                    id="autoOpenDisplay"
                    checked={formAutoOpenCustomerDisplay}
                    onChange={(e) => setFormAutoOpenCustomerDisplay(e.target.checked)}
                    className="w-4 h-4 text-blue-700 rounded focus:ring-blue-600 border-slate-300"
                  />
                  <div>
                    <label htmlFor="autoOpenDisplay" className="text-xs font-bold text-slate-800 cursor-pointer block">
                      Program Başlatıldığında 2. Ekranı Otomatik Aç
                    </label>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Çift ekranlı POS cihazlarında uygulama açıldığında müşteri ekranı otomatik olarak 2. monitörde başlar.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bekleme Modu Karşılama Sloganı:
                  </label>
                  <input
                    type="text"
                    value={formCustomerDisplayMessage}
                    onChange={(e) => setFormCustomerDisplayMessage(e.target.value)}
                    placeholder="Örn: JACK & JONES Kalitesiyle Keyifli Alışverişler Dileriz"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Sepet boşken ve kasa beklemedeyken müşteri ekranında bu mesaj görüntülenir.
                  </span>
                </div>
              </div>

              {/* Wireless Wi-Fi Tablet Display Option */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-blue-950 text-xs flex items-center space-x-1.5">
                    <Wifi className="w-3.5 h-3.5 text-blue-700" />
                    <span>Kablosuz Tablet / iPad Müşteri Ekranı Bağlantısı</span>
                  </h5>
                  <span className="px-2 py-0.5 bg-blue-200/80 text-blue-900 rounded text-[10px] font-bold">
                    Wi-Fi Canlı Yansıtma
                  </span>
                </div>

                <p className="text-[11px] text-blue-900/80 font-medium">
                  Kasa tezgahına koyacağınız harici bir Android tablet, iPad veya ikinci bir bilgisayardan bu adresi açarak gerçek zamanlı müşteri ekranı olarak kullanabilirsiniz:
                </p>

                <div className="p-2.5 bg-white border border-blue-300 rounded-xl flex items-center justify-between">
                  <code className="font-mono text-blue-950 font-bold text-xs select-all">
                    {customerDisplayUrl}
                  </code>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(customerDisplayUrl)
                        setCopiedNotice('display')
                        setTimeout(() => setCopiedNotice(null), 3000)
                      }}
                      className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold transition shadow-2xs cursor-pointer"
                    >
                      {copiedNotice === 'display' ? '✓ Kopyalandı' : 'Adresi Kopyala'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        window.open(customerDisplayUrl, '_blank')
                      }}
                      className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition border border-slate-300"
                      title="Tarayıcıda Aç"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Network & Mobile IP */}
          {activeTab === 'network' && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-emerald-900 text-xs flex items-center space-x-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Mobil Depo Ağı Adresi</span>
                  </h5>
                  <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[10px] font-bold">
                    Wi-Fi Bağlantısı
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 font-medium">
                  Personel cep telefonları veya tabletlerinden stok ve beden sorgulamak için aşağıdaki QR kodu telefon kamerasıyla okutun veya adresi tarayıcıya yazın:
                </p>

                <div className="bg-white border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row items-center gap-3 shadow-2xs">
                  {mobileQrDataUrl && (
                    <div className="p-1.5 bg-white border border-slate-200 rounded-xl shadow-2xs shrink-0 text-center">
                      <img src={mobileQrDataUrl} alt="Mobil QR Kodu" className="w-24 h-24 object-contain mx-auto" />
                      <span className="block text-[9px] font-bold text-slate-500 mt-1">Kamerayla Okut</span>
                    </div>
                  )}
                  <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-tight block">
                        Wi-Fi Bağlantı Adresi:
                      </span>
                      <code className="font-mono text-emerald-950 font-bold text-xs select-all bg-emerald-50 px-2 py-1 rounded border border-emerald-200 block truncate mt-0.5">
                        {mobileUrl}
                      </code>
                    </div>
                    <div className="flex items-center space-x-2 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(mobileUrl)
                          setCopiedNotice('mobile')
                          setTimeout(() => setCopiedNotice(null), 3000)
                        }}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition shadow-2xs cursor-pointer"
                      >
                        {copiedNotice === 'mobile' ? '✓ Kopyalandı' : 'Adresi Kopyala'}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(mobileUrl, '_blank')}
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition border border-slate-300 flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Tarayıcıda Aç</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detected IPs Selection List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-700" />
                    <span>Tespit Edilen Ağ Arabirimleri (IP Listesi)</span>
                  </label>
                  <button
                    type="button"
                    onClick={fetchNetworkIps}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Yenile</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {detectedIps.map((ipObj) => (
                    <button
                      key={ipObj.address}
                      type="button"
                      onClick={() => setFormCustomIp(ipObj.address)}
                      className={`p-2.5 rounded border text-left flex justify-between items-center transition ${
                        formCustomIp === ipObj.address
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900 block">{ipObj.address}</span>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                          Ağ Kartı: {ipObj.name} {ipObj.isWifiOrEthernet ? '(Fiziki Wi-Fi/Ethernet ✅)' : '(Sanal Köprü)'}
                        </span>
                      </div>
                      {formCustomIp === ipObj.address && (
                        <span className="px-2 py-0.5 bg-blue-700 text-white rounded text-[10px] font-semibold">
                          Seçili
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Custom IP Entry */}
              <div className="pt-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Özel / Manuel IP Adresi:
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formCustomIp}
                    onChange={(e) => setFormCustomIp(e.target.value)}
                    placeholder="Örn: 192.168.1.84"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono text-xs font-bold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                  {formCustomIp && (
                    <button
                      type="button"
                      onClick={() => setFormCustomIp('')}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded border border-slate-300 transition"
                    >
                      Otomatik IP'ye Dön
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Database & Maintenance */}
          {activeTab === 'database' && (
            <div className="space-y-3.5">
              {/* Database Health & Diagnostic Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-700" />
                    <span>Veritabanı Durumu & Güvenlik Göstergesi</span>
                  </h5>
                  <button
                    type="button"
                    onClick={fetchDbInfo}
                    disabled={isLoadingDbInfo}
                    title="Durumu Yenile"
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDbInfo ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block">Bütünlük Kontrolü</span>
                    <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1 mt-0.5">
                      <Check className="w-3 h-3" />
                      <span>{dbInfo?.integrity === 'ok' ? 'Sağlıklı (OK)' : (dbInfo?.integrity || 'Kontrol ediliyor...')}</span>
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block">Veritabanı Boyutu</span>
                    <span className="text-xs font-bold text-slate-800 mt-0.5 block font-mono">
                      {dbInfo?.sizeKb ? `${dbInfo.sizeKb} KB` : '...'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block">Kayıtlı Ürün / Satış</span>
                    <span className="text-xs font-bold text-blue-800 mt-0.5 block">
                      {dbInfo?.counts ? `${dbInfo.counts.products} Ürün / ${dbInfo.counts.sales} Satış` : '...'}
                    </span>
                  </div>

                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold block">Güvenlik Yedekleri</span>
                    <span className="text-xs font-bold text-indigo-700 mt-0.5 block">
                      {dbInfo?.backupsCount !== undefined ? `${dbInfo.backupsCount} Otomatik Kopya` : '...'}
                    </span>
                  </div>
                </div>

                {dbInfo?.dbPath && (
                  <p className="text-[10px] text-slate-500 font-mono truncate pt-0.5">
                    Aktif Dosya: <span className="text-slate-700">{dbInfo.dbPath}</span>
                  </p>
                )}
              </div>

              {/* Backup Card */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-emerald-900 text-xs flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Veritabanı Yedekle (.db İndir)</span>
                  </h5>
                  <p className="text-[11px] text-emerald-800 mt-0.5 font-medium">
                    Tüm ürün, varyant, müşteri ve satış geçmişinizi tutarlı SQLite kopyası olarak bilgisayarınıza indirin.
                  </p>
                  {downloadStatus === 'success' && (
                    <p className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1 mt-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Yedek başarıyla üretildi ve indirildi!</span>
                    </p>
                  )}
                  {downloadStatus === 'error' && (
                    <p className="text-[11px] text-rose-600 font-bold mt-1">
                      ⚠️ Yedek indirilemedi. Lütfen tekrar deneyin.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleBackupDb}
                  disabled={isDownloading}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded transition flex items-center space-x-1 shadow-2xs whitespace-nowrap disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>İndiriliyor...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Yedek İndir</span>
                    </>
                  )}
                </button>
              </div>

              {/* Restore from Backup Card */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-blue-900 text-xs flex items-center space-x-1.5">
                      <Upload className="w-3.5 h-3.5 text-blue-700" />
                      <span>Yedekten Geri Yükle (.db Yükle)</span>
                    </h5>
                    <p className="text-[11px] text-blue-800 mt-0.5 font-medium">
                      Daha önce indirdiğiniz bir yedek dosyasını (.db) seçerek geri yükleyin.
                      Yükleme öncesi mevcut verilerinizin kopyası otomatik olarak yedeklenir ve dosya SQLite testinden geçirilir.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    onChange={handleRestoreFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded border border-slate-300 transition flex items-center space-x-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>{restoreFile ? 'Dosya Değiştir' : 'Yedek Dosyası Seç'}</span>
                  </button>
                  {restoreFile && (
                    <span className="text-[11px] text-slate-700 font-semibold bg-slate-100 px-2 py-1 rounded truncate max-w-[200px]">
                      📄 {restoreFile.name} ({(restoreFile.size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </div>

                {restoreError && (
                  <p className="text-[11px] text-rose-600 font-bold bg-rose-50 p-2 rounded border border-rose-200">
                    ⚠️ {restoreError}
                  </p>
                )}
                {restoreStatus === 'success' && (
                  <p className="text-[11px] text-emerald-700 font-bold flex items-center space-x-1 bg-emerald-100/60 p-2 rounded border border-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                    <span>{restoreSuccessMessage || 'Veritabanı başarıyla geri yüklendi! Sayfa yenileniyor...'}</span>
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleRestoreStart}
                  disabled={!restoreFile || isRestoring}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded transition flex items-center space-x-1 shadow-2xs disabled:opacity-40"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Doğrulanıyor ve Yükleniyor...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Yedeği Geri Yükle</span>
                    </>
                  )}
                </button>
              </div>

              {/* Reset Sales Only */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-amber-900 text-xs flex items-center space-x-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                    <span>Sadece Satış Geçmişini Sıfırla</span>
                  </h5>
                  <p className="text-[11px] text-amber-800 mt-0.5 font-medium">
                    Stoklar ve ürün katologları korunur, sadece güncel Z Raporu ve geçmiş satış fişleri temizlenir. (Otomatik Güvenlik Yedeği Alınır)
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => openPinDialog('reset-sales')}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded transition flex items-center space-x-1 shadow-2xs whitespace-nowrap disabled:opacity-50"
                >
                  <span>Geçmişi Sil</span>
                </button>
              </div>

              {/* Full Database Reset */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-rose-900 text-xs flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                    <span>Tüm Veritabanını Fabrika Ayarlarına Sıfırla</span>
                  </h5>
                  <p className="text-[11px] text-rose-800 mt-0.5 font-medium">
                    ⚠️ Tüm ürünler, varyantlar, stoklar, müşteriler ve satış kayıtları sıfırlanır. (Otomatik Güvenlik Yedeği Alınır)
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => openPinDialog('reset-all')}
                  className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded transition flex items-center space-x-1 shadow-2xs whitespace-nowrap disabled:opacity-50"
                >
                  <span>Tamamen Sıfırla</span>
                </button>
              </div>
            </div>
          )}

          {/* Instant Lock & Footer Controls */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleLockNow}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition flex items-center space-x-1.5 border border-slate-200"
            >
              <Lock className="w-3.5 h-3.5 text-blue-700" />
              <span>Sistemi Şimdi Kilitle</span>
            </button>

            <div className="flex items-center space-x-2">
              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-700 flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Kaydedildi!</span>
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded hover:bg-slate-200 transition border border-slate-200"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded transition shadow-2xs"
              >
                Ayarları Kaydet
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ─── Inline PIN Confirmation Dialog Overlay ─── */}
      {pinDialogAction && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-sm shadow-2xl overflow-hidden">
            {/* Dialog Header */}
            <div className={`px-4 py-3 border-b ${
              pinDialogAction === 'reset-all' ? 'bg-rose-50 border-rose-200' :
              pinDialogAction === 'reset-sales' ? 'bg-amber-50 border-amber-200' :
              'bg-blue-50 border-blue-200'
            }`}>
              <h4 className={`font-bold text-sm ${
                pinDialogAction === 'reset-all' ? 'text-rose-900' :
                pinDialogAction === 'reset-sales' ? 'text-amber-900' :
                'text-blue-900'
              }`}>
                {getPinDialogTitle()}
              </h4>
            </div>

            {/* Dialog Body */}
            <div className="p-4 space-y-3">
              <p className={`text-[11px] font-medium p-2.5 rounded border ${
                pinDialogAction === 'reset-all'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : pinDialogAction === 'reset-sales'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                {getPinDialogWarning()}
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-700" />
                  <span>6 Haneli Yönetici PIN Şifresi</span>
                </label>
                <input
                  ref={pinInputRef}
                  type="password"
                  maxLength={6}
                  value={pinDialogInput}
                  onChange={(e) => {
                    setPinDialogInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                    setPinDialogError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePinDialogSubmit()
                    if (e.key === 'Escape') closePinDialog()
                  }}
                  placeholder="••••••"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono text-base tracking-[0.35em] font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center"
                />
              </div>

              {pinDialogError && (
                <p className="text-[11px] text-rose-600 font-bold bg-rose-50 px-2.5 py-1.5 rounded border border-rose-200">
                  ⚠️ {pinDialogError}
                </p>
              )}
            </div>

            {/* Dialog Footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={closePinDialog}
                disabled={pinDialogLoading}
                className="px-3.5 py-1.5 bg-white text-slate-700 text-xs font-semibold rounded hover:bg-slate-100 transition border border-slate-200 disabled:opacity-50"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handlePinDialogSubmit}
                disabled={pinDialogLoading || pinDialogInput.length !== 6}
                className={`px-4 py-1.5 text-white text-xs font-bold rounded transition shadow-2xs disabled:opacity-40 flex items-center space-x-1.5 ${
                  pinDialogAction === 'reset-all'
                    ? 'bg-rose-700 hover:bg-rose-800'
                    : pinDialogAction === 'reset-sales'
                    ? 'bg-amber-700 hover:bg-amber-800'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                {pinDialogLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>İşleniyor...</span>
                  </>
                ) : (
                  <span>Onayla ve Çalıştır</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
