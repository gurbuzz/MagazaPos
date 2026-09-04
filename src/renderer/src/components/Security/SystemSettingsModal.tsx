import React, { useState, useEffect } from 'react'
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
  Trash2,
  Percent,
  AlertTriangle,
  FileText,
  MapPin,
  Phone,
  Wifi,
  Globe,
  RefreshCw,
} from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'

interface SystemSettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

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
    customIp,
    updateSystemSettings,
    lockApp,
  } = usePosStore()

  const [activeTab, setActiveTab] = useState<'general' | 'receipt' | 'network' | 'database'>('general')

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
  const [formCustomIp, setFormCustomIp] = useState(customIp)

  // Admin PIN change fields
  const [formNewAdminPin, setFormNewAdminPin] = useState('')
  const [formConfirmAdminPin, setFormConfirmAdminPin] = useState('')
  const [adminPinSaveStatus, setAdminPinSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [adminPinError, setAdminPinError] = useState('')

  const [detectedIps, setDetectedIps] = useState<any[]>([])
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

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
    setFormCustomIp(customIp)

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
    customIp,
  ])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formPinCode || formPinCode.length !== 4 || !/^\d{4}$/.test(formPinCode)) {
      alert('PIN Şifresi tam 4 haneli rakamlardan oluşmalıdır! (Örn: 1234)')
      return
    }

    updateSystemSettings({
      storeName: formStoreName.trim() || 'MağazaPOS Giyim',
      storeAddress: formStoreAddress.trim(),
      storePhone: formStorePhone.trim(),
      cashierName: formCashierName.trim() || 'Kasiyer 1',
      pinCode: formPinCode,
      receiptPrefix: formReceiptPrefix.trim() || 'FIS-',
      receiptFooterNote: formReceiptFooter.trim(),
      vatRate: Number(formVatRate) || 10,
      lowStockThreshold: Number(formLowStock) || 5,
      autoPrintReceipt: formAutoPrint,
      customIp: formCustomIp.trim(),
    })

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

  const handleBackupDb = () => {
    window.open(`/api/system/backup-db?pin=${encodeURIComponent(pinCode)}`, '_blank')
  }

  const handleResetSales = async () => {
    const inputPin = prompt('DİKKAT: Tüm geçmiş satış kayıtları silinecektir! İşlemi onaylamak için 6 Haneli Yönetici PIN şifrenizi girin:')
    if (!inputPin) return

    setIsResetting(true)
    try {
      const res = await fetch('/api/system/reset-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': inputPin,
        },
        body: JSON.stringify({ adminPin: inputPin }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Satış geçmişi sıfırlandı.')
      } else {
        alert(data.error || 'Yetkisiz erişim veya hata oluştu.')
      }
    } catch (err: any) {
      alert('Sıfırlama hatası: ' + err.message)
    } finally {
      setIsResetting(false)
    }
  }

  const handleResetAll = async () => {
    const inputPin = prompt('DİKKAT: Tüm stoklar, ürünler ve satışlar silinecektir! İşlemi onaylamak için 6 Haneli Yönetici PIN şifrenizi girin:')
    if (!inputPin) return

    setIsResetting(true)
    try {
      const res = await fetch('/api/system/reset-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': inputPin,
        },
        body: JSON.stringify({ adminPin: inputPin }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Tüm veriler tamamen sıfırlandı.')
        window.location.reload()
      } else {
        alert(data.error || 'Yetkisiz erişim veya hata oluştu.')
      }
    } catch (err: any) {
      alert('Sıfırlama hatası: ' + err.message)
    } finally {
      setIsResetting(false)
    }
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
        // Update session with new admin PIN
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full overflow-hidden shadow-xl space-y-0">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
              <Settings className="w-4 h-4" />
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
                    placeholder="Örn: Show Apparel Mağazası"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-none"
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
                    className="w-4 h-4 text-blue-700 rounded focus:ring-blue-600 border-slate-300"
                  />
                  <label htmlFor="autoPrint" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Tahsilat Sonrası Otomatik Fiş Yazdır
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Network & Mobile IP */}
          {activeTab === 'network' && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded space-y-2">
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
                  Personel cep telefonları veya tabletlerinden stok ve beden sorgulamak için aşağıdaki adresi mobil tarayıcıya yazın:
                </p>
                <div className="p-2.5 bg-white border border-emerald-300 rounded flex items-center justify-between">
                  <code className="font-mono text-emerald-900 font-bold text-xs select-all">
                    http://{formCustomIp || '192.168.1.84'}:3782/mobile
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`http://${formCustomIp || '192.168.1.84'}:3782/mobile`)
                      alert('Mobil depo adresi kopyalandı!')
                    }}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold transition shadow-2xs"
                  >
                    Adresi Kopyala
                  </button>
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
              {/* Backup Card */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-emerald-900 text-xs flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Veritabanı Yedekle (.db İndir)</span>
                  </h5>
                  <p className="text-[11px] text-emerald-800 mt-0.5 font-medium">
                    Tüm ürün, stok ve satış geçmişinizi SQLite veritabanı kopyası olarak bilgisayarınıza indirin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackupDb}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded transition flex items-center space-x-1 shadow-2xs whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Yedek İndir</span>
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
                    Stoklar ve ürün katologları korunur, sadece güncel Z Raporu ve geçmiş satış fişleri temizlenir.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleResetSales}
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
                    ⚠️ Tüm ürünler, varyantlar, stoklar ve satış kayıtları kalıcı olarak silinir. (PIN Onayı İstenecektir)
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleResetAll}
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
    </div>
  )
}
