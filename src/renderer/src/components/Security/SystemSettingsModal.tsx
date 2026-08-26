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
    if (isOpen) {
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
      setSavedSuccess(false)
      fetchNetworkIps()
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

    setSavedSuccess(true)
    setTimeout(() => {
      setSavedSuccess(false)
      onClose()
    }, 1000)
  }

  const handleBackupDb = () => {
    window.open('/api/system/backup-db', '_blank')
  }

  const handleResetSales = async () => {
    if (!window.confirm('DİKKAT: Tüm geçmiş satış kayıtları silinecektir! Emin misiniz?')) {
      return
    }

    setIsResetting(true)
    try {
      const res = await fetch('/api/system/reset-sales', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Satış geçmişi sıfırlandı.')
      } else {
        alert(data.error || 'Hata oluştu.')
      }
    } catch (err: any) {
      alert('Sıfırlama hatası: ' + err.message)
    } finally {
      setIsResetting(false)
    }
  }

  const handleResetAll = async () => {
    const inputPin = prompt('DİKKAT: Tüm stoklar, ürünler ve satışlar silinecektir! İşlemi onaylamak için 4 Haneli PIN şifrenizi girin:')
    if (inputPin !== pinCode) {
      alert('Hatalı PIN! Veritabanı sıfırlama iptal edildi.')
      return
    }

    setIsResetting(true)
    try {
      const res = await fetch('/api/system/reset-all', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(data.message || 'Tüm veriler tamamen sıfırlandı.')
        window.location.reload()
      } else {
        alert(data.error || 'Hata oluştu.')
      }
    } catch (err: any) {
      alert('Sıfırlama hatası: ' + err.message)
    } finally {
      setIsResetting(false)
    }
  }

  const handleLockNow = () => {
    onClose()
    lockApp()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Sistem ve Kasa Ayarları</h3>
              <p className="text-xs text-slate-500 font-medium">Mağaza, fiş, IP adresi ve veritabanı yönetimi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-slate-50/80 border-b border-slate-200 flex space-x-2">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition border-b-2 ${
              activeTab === 'general'
                ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Genel & Güvenlik
          </button>

          <button
            onClick={() => setActiveTab('receipt')}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition border-b-2 ${
              activeTab === 'receipt'
                ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Fiş & Fatura
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition border-b-2 ${
              activeTab === 'network'
                ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Ağ & Mobil IP
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition border-b-2 ${
              activeTab === 'database'
                ? 'bg-white border-rose-600 text-rose-600 shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Veritabanı & Yedek
          </button>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* TAB 1: General & Security */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                    <Store className="w-4 h-4 text-indigo-600" />
                    <span>Mağaza / Firma Adı</span>
                  </label>
                  <input
                    type="text"
                    value={formStoreName}
                    onChange={(e) => setFormStoreName(e.target.value)}
                    placeholder="Örn: Show Apparel Mağazası"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Aktif Kasiyer Adı</span>
                  </label>
                  <input
                    type="text"
                    value={formCashierName}
                    onChange={(e) => setFormCashierName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    <span>Mağaza Adresi</span>
                  </label>
                  <input
                    type="text"
                    value={formStoreAddress}
                    onChange={(e) => setFormStoreAddress(e.target.value)}
                    placeholder="Örn: Atatürk Cad. No:14 Kadıköy"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <span>Mağaza Telefonu</span>
                  </label>
                  <input
                    type="text"
                    value={formStorePhone}
                    onChange={(e) => setFormStorePhone(e.target.value)}
                    placeholder="Örn: 0216 345 67 89"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-3">
                <label className="block text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>4 Haneli Kasa Giriş PIN Şifresi</span>
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    maxLength={4}
                    value={formPinCode}
                    onChange={(e) => setFormPinCode(e.target.value)}
                    placeholder="1234"
                    className="w-36 px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono text-base tracking-widest font-black focus:ring-2 focus:ring-indigo-500 focus:outline-none text-center"
                  />
                  <span className="text-[11px] text-slate-600 font-medium">
                    Açılışta ve kilitlemede bu 4 haneli PIN istenir.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Receipt & Printers */}
          {activeTab === 'receipt' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                    <Hash className="w-4 h-4 text-indigo-600" />
                    <span>Fiş Numarası Öneki</span>
                  </label>
                  <input
                    type="text"
                    value={formReceiptPrefix}
                    onChange={(e) => setFormReceiptPrefix(e.target.value)}
                    placeholder="FIS-"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    <span>Varsayılan KDV Oranı (%)</span>
                  </label>
                  <input
                    type="number"
                    value={formVatRate}
                    onChange={(e) => setFormVatRate(Number(e.target.value))}
                    placeholder="10"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Fiş Alt Bilgi Notu / Değişim Politikası</span>
                </label>
                <textarea
                  rows={2}
                  value={formReceiptFooter}
                  onChange={(e) => setFormReceiptFooter(e.target.value)}
                  placeholder="Ürün değişimleriniz için fişinizle birlikte 14 gün içinde müracaat ediniz."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Kritik Stok Uyarısı Eşiği</span>
                  </label>
                  <input
                    type="number"
                    value={formLowStock}
                    onChange={(e) => setFormLowStock(Number(e.target.value))}
                    placeholder="5"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-3 pt-6">
                  <input
                    type="checkbox"
                    id="autoPrint"
                    checked={formAutoPrint}
                    onChange={(e) => setFormAutoPrint(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
                  />
                  <label htmlFor="autoPrint" className="text-xs font-bold text-slate-700 cursor-pointer">
                    Tahsilat Sonrası Otomatik Fiş Yazdır
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Network & Mobile IP */}
          {activeTab === 'network' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-emerald-900 text-xs flex items-center space-x-1.5">
                    <Wifi className="w-4 h-4 text-emerald-600" />
                    <span>Mobil Depo Ağı Adresi</span>
                  </h5>
                  <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[10px] font-black">
                    Wi-Fi Bağlantısı
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 font-medium">
                  Personel cep telefonları veya tabletlerinden stok ve beden sorgulamak için aşağıdaki adresi mobil tarayıcıya yazın:
                </p>
                <div className="p-3 bg-white border border-emerald-300 rounded-xl flex items-center justify-between">
                  <code className="font-mono text-emerald-800 font-black text-sm select-all">
                    http://{formCustomIp || '192.168.1.84'}:3000/mobile
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`http://${formCustomIp || '192.168.1.84'}:3000/mobile`)
                      alert('Mobil depo adresi kopyalandı!')
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    Adresi Kopyala
                  </button>
                </div>
              </div>

              {/* Detected IPs Selection List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <span>Tespit Edilen Ağ Arabirimleri (IP Listesi)</span>
                  </label>
                  <button
                    type="button"
                    onClick={fetchNetworkIps}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
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
                      className={`p-3 rounded-2xl border text-left flex justify-between items-center transition ${
                        formCustomIp === ipObj.address
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <span className="font-mono text-sm font-black text-slate-900 block">{ipObj.address}</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Ağ Kartı: {ipObj.name} {ipObj.isWifiOrEthernet ? '(Fiziki Wi-Fi/Ethernet ✅)' : '(Sanal Köprü)'}
                        </span>
                      </div>
                      {formCustomIp === ipObj.address && (
                        <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black">
                          Seçili
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Custom IP Entry */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Özel / Manuel IP Adresi (Gerektiğinde Manuel Değiştirin):
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={formCustomIp}
                    onChange={(e) => setFormCustomIp(e.target.value)}
                    placeholder="Örn: 192.168.1.84"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  {formCustomIp && (
                    <button
                      type="button"
                      onClick={() => setFormCustomIp('')}
                      className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition"
                    >
                      Otomatik IP'ye Dön
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Mobil URL Örneği: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-bold">http://{formCustomIp || '192.168.1.84'}:3000/mobile</code>
                </span>
              </div>
            </div>
          )}

          {/* TAB 4: Database & Maintenance */}
          {activeTab === 'database' && (
            <div className="space-y-4">
              {/* Backup Card */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-emerald-900 text-xs flex items-center space-x-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Veritabanı Yedekle (.db İndir)</span>
                  </h5>
                  <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                    Tüm ürün, stok ve satış geçmişinizi SQLite veritabanı kopyası olarak bilgisayarınıza indirin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackupDb}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Yedek İndir</span>
                </button>
              </div>

              {/* Reset Sales Only */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-amber-900 text-xs flex items-center space-x-1.5">
                    <Trash2 className="w-4 h-4 text-amber-600" />
                    <span>Sadece Satış Geçmişini Sıfırla</span>
                  </h5>
                  <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                    Stoklar ve ürün katologları korunur, sadece güncel Z Raporu ve geçmiş satış fişleri temizlenir.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleResetSales}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm whitespace-nowrap disabled:opacity-50"
                >
                  <span>Geçmişi Sil</span>
                </button>
              </div>

              {/* Full Database Reset */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                <div>
                  <h5 className="font-extrabold text-rose-900 text-xs flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Tüm Veritabanını Fabrika Ayarlarına Sıfırla</span>
                  </h5>
                  <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
                    ⚠️ Tüm ürünler, varyantlar, stoklar ve satış kayıtları kalıcı olarak silinir. (PIN Onayı İstenecektir)
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleResetAll}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-rose-600/20 whitespace-nowrap disabled:opacity-50"
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
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition flex items-center space-x-1.5 border border-slate-200"
            >
              <Lock className="w-4 h-4 text-indigo-600" />
              <span>Sistemi Şimdi Kilitle</span>
            </button>

            <div className="flex items-center space-x-2">
              {savedSuccess && (
                <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
                  <Check className="w-4 h-4" />
                  <span>Kaydedildi!</span>
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-indigo-600/20"
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
