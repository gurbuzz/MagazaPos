import React, { useEffect, useState } from 'react'
import {
  ShoppingBag,
  Package,
  Printer,
  Receipt,
  Users,
  Wifi,
  Sparkles,
  Settings,
  Lock,
  Maximize,
  Minimize,
  Keyboard as KeyboardIcon,
  Tv,
} from 'lucide-react'
import { usePosStore } from '../store/usePosStore'
import { useKeyboardStore } from '../store/useKeyboardStore'
import { CampaignModal } from './POS/CampaignModal'
import { SystemSettingsModal } from './Security/SystemSettingsModal'
import { AdminPinModal } from './Security/AdminPinModal'

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, setLocalIp, lockApp, isStockOnlyMode, toggleStockOnlyMode } = usePosStore()
  const { isOpen: isKeyboardOpen, toggleKeyboard } = useKeyboardStore()
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [customerDisplayStatus, setCustomerDisplayStatus] = useState<{
    isOpen: boolean
    hasSecondary: boolean
    displaysCount: number
  }>({
    isOpen: false,
    hasSecondary: false,
    displaysCount: 1,
  })

  // Admin PIN gate state
  const [isAdminPinOpen, setIsAdminPinOpen] = useState(false)
  const [pendingAdminAction, setPendingAdminAction] = useState<'sales' | 'settings' | null>(null)

  useEffect(() => {
    if (window.electron?.getLocalIp) {
      window.electron.getLocalIp().then((ip: string) => setLocalIp(ip))
    } else {
      fetch('/api/health')
        .then((res) => res.json())
        .then((data) => setLocalIp(data.localIp || '127.0.0.1'))
        .catch(() => {})
    }

    // Customer display status tracking
    if (window.electron?.getCustomerDisplayStatus) {
      window.electron.getCustomerDisplayStatus().then((res) => setCustomerDisplayStatus(res))
    }

    let unsubCustomerDisplay: (() => void) | undefined
    if (window.electron?.onCustomerDisplayStatusChange) {
      unsubCustomerDisplay = window.electron.onCustomerDisplayStatusChange((res) => {
        setCustomerDisplayStatus(res)
      })
    }

    // Fullscreen state sync
    if (window.electron?.isFullscreen) {
      window.electron.isFullscreen().then((res) => setIsFullscreen(res))
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        setTimeout(() => {
          if (window.electron?.isFullscreen) {
            window.electron.isFullscreen().then((res) => setIsFullscreen(res))
          } else {
            setIsFullscreen(!!document.fullscreenElement)
          }
        }, 150)
      }
    }

    const handleFullscreenChange = () => {
      if (window.electron?.isFullscreen) {
        window.electron.isFullscreen().then((res) => setIsFullscreen(res))
      } else {
        setIsFullscreen(!!document.fullscreenElement)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (unsubCustomerDisplay) unsubCustomerDisplay()
    }
  }, [setLocalIp])

  const handleToggleFullscreen = async () => {
    if (window.electron?.toggleFullscreen) {
      const isFull = await window.electron.toggleFullscreen()
      setIsFullscreen(isFull)
    } else {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {})
        setIsFullscreen(true)
      } else {
        await document.exitFullscreen().catch(() => {})
        setIsFullscreen(false)
      }
    }
  }

  const handleToggleCustomerDisplay = async () => {
    if (window.electron?.toggleCustomerDisplay) {
      const res = await window.electron.toggleCustomerDisplay()
      setCustomerDisplayStatus(res)
    } else {
      window.open('/#customer-display', 'CustomerDisplay', 'width=1024,height=720')
    }
  }

  const handleProtectedAction = (action: 'sales' | 'settings') => {
    setPendingAdminAction(action)
    setIsAdminPinOpen(true)
  }

  const handleAdminVerified = () => {
    setIsAdminPinOpen(false)
    if (pendingAdminAction === 'sales') {
      setActiveTab('sales')
    } else if (pendingAdminAction === 'settings') {
      setIsSettingsModalOpen(true)
    }
    setPendingAdminAction(null)
  }

  return (
    <header className="h-16 navbar-gradient border-b border-blue-200/50 px-5 flex items-center justify-between select-none shadow-md z-20 transition-all">
      {/* Brand Logo */}
      <div className="flex items-center">
        {/* Logo Container: Crisp White Pill */}
        <div className="bg-white px-3.5 py-1.5 rounded-lg shadow-sm flex items-center justify-center h-10 border border-white/40 transition-transform hover:scale-[1.02]">
          <img
            src="/org_logo.svg"
            alt="JACK & JONES"
            className="h-6 w-auto object-contain select-none"
            onError={(e) => {
              const target = e.target as HTMLElement
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                parent.innerHTML = '<span class="text-[#00268A] font-black text-sm tracking-wider">JACK & JONES</span>'
              }
            }}
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="relative z-10 flex items-center space-x-2 bg-[#001a61]/85 p-1.5 rounded-2xl border border-white/20 backdrop-blur-md shadow-inner">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
            activeTab === 'pos'
              ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
              : 'text-blue-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <ShoppingBag className="w-4 h-4 stroke-[2.2]" />
          <span>Kasa (POS)</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
            activeTab === 'customers'
              ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
              : 'text-blue-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <Users className="w-4 h-4 stroke-[2.2]" />
          <span>Müşteriler</span>
        </button>

        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
            activeTab === 'stock'
              ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
              : 'text-blue-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <Package className="w-4 h-4 stroke-[2.2]" />
          <span>Stok & Varyant</span>
        </button>

        <button
          onClick={() => setActiveTab('labels')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
            activeTab === 'labels'
              ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
              : 'text-blue-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <Printer className="w-4 h-4 stroke-[2.2]" />
          <span>Etiket Basımı</span>
        </button>

        {!isStockOnlyMode && (
          <button
            onClick={() => handleProtectedAction('sales')}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
              activeTab === 'sales'
                ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
                : 'text-blue-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <Receipt className="w-4 h-4 stroke-[2.2]" />
            <span>Ciro & Satış Raporları</span>
            <Lock className="w-3.5 h-3.5 text-blue-200 stroke-[2.2]" />
          </button>
        )}
      </nav>

      {/* Campaign & Settings Controls */}
      <div className="relative z-10 flex items-center space-x-2 text-sm bg-white/80 p-1.5 rounded-2xl border border-white/60 shadow-xs backdrop-blur-sm">
        <button
          onClick={() => setIsCampaignModalOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition shadow-xs"
          title="Kampanya ve İndirim Yönetimi"
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span>Kampanyalar</span>
        </button>

        <div className="h-5 w-px bg-slate-300" />

        {/* Customer Display (Müşteri Ekranı) Dual-Screen Button */}
        <button
          onClick={handleToggleCustomerDisplay}
          className={`p-2 rounded-xl border transition shadow-xs flex items-center justify-center relative ${
            customerDisplayStatus.isOpen
              ? 'bg-[#00268A] text-white border-[#00268A] shadow-sm ring-2 ring-emerald-400'
              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-[#00268A] border-slate-200'
          }`}
          title={
            customerDisplayStatus.isOpen
              ? 'Müşteri Ekranı Açık (Kapatmak için tıklayın)'
              : customerDisplayStatus.hasSecondary
              ? 'Müşteri Ekranını 2. Ekranda Başlat (Çift Monitör Hazır)'
              : 'Müşteri Ekranını Aç (Önizleme Penceresi)'
          }
        >
          <Tv className="w-4 h-4 stroke-[2.2]" />
          {customerDisplayStatus.isOpen && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
          )}
        </button>

        {/* Fiyatsız Stok / Gizlilik Modu Butonu (Açık Kırmızı, Simgesiz) */}
        <button
          onClick={toggleStockOnlyMode}
          className={`w-9 h-9 rounded-xl border transition-all shadow-xs flex items-center justify-center relative ${
            isStockOnlyMode
              ? 'bg-rose-500 hover:bg-rose-600 border-rose-600 shadow-sm ring-2 ring-rose-300'
              : 'bg-rose-100 hover:bg-rose-200 border-rose-200 hover:border-rose-300'
          }`}
          title={isStockOnlyMode ? 'Stok Modundan Çık (Fiyatları Göster)' : 'Stok Moduna Geç (Fiyatları Gizle)'}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              isStockOnlyMode ? 'bg-white shadow-xs' : 'bg-rose-400'
            }`}
          />
        </button>

        {/* On-Screen Touch Virtual Keyboard Toggle */}
        <button
          onClick={toggleKeyboard}
          className={`p-2 rounded-xl border transition shadow-xs flex items-center justify-center ${
            isKeyboardOpen
              ? 'bg-[#00268A] text-white border-[#00268A] shadow-sm ring-2 ring-blue-300'
              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-[#00268A] border-slate-200'
          }`}
          title={isKeyboardOpen ? 'Sanal Klavyeyi Kapat' : 'Ekran Dokunmatik Klavyesini Aç'}
        >
          <KeyboardIcon className="w-4 h-4 stroke-[2.2]" />
        </button>

        {/* Fullscreen Mode Button */}
        <button
          onClick={handleToggleFullscreen}
          className={`p-2 rounded-xl border transition shadow-xs flex items-center justify-center ${
            isFullscreen
              ? 'bg-[#00268A] text-white border-[#00268A] shadow-sm'
              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-[#00268A] border-slate-200'
          }`}
          title={isFullscreen ? 'Tam Ekrandan Çık (F11)' : 'Tam Ekran Modu (F11)'}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4 stroke-[2.2]" />
          ) : (
            <Maximize className="w-4 h-4 stroke-[2.2]" />
          )}
        </button>

        {/* Quick Lock Button */}
        <button
          onClick={lockApp}
          className="p-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-xl border border-slate-200 transition shadow-xs"
          title="Kayıtı Kilitle (PIN Girişi İster)"
        >
          <Lock className="w-4 h-4 stroke-[2]" />
        </button>

        {/* System Settings Gear Icon Button — Admin PIN Protected */}
        <button
          onClick={() => handleProtectedAction('settings')}
          className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition shadow-xs"
          title="Sistem ve Kasa Ayarları (Yönetici PIN Gerekli)"
        >
          <Settings className="w-4 h-4 stroke-[2]" />
        </button>
      </div>

      <CampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
      />

      <SystemSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Admin PIN Verification Gate */}
      <AdminPinModal
        isOpen={isAdminPinOpen}
        onClose={() => {
          setIsAdminPinOpen(false)
          setPendingAdminAction(null)
        }}
        onVerified={handleAdminVerified}
        title={
          pendingAdminAction === 'sales'
            ? 'Ciro & Satış Raporları'
            : pendingAdminAction === 'settings'
            ? 'Sistem Ayarları'
            : 'Yönetici Yetkisi Gerekli'
        }
        subtitle={
          pendingAdminAction === 'sales'
            ? 'Satış raporlarını görüntülemek için Yönetici PIN girin.'
            : pendingAdminAction === 'settings'
            ? 'Sistem ayarlarına erişmek için Yönetici PIN girin.'
            : 'Bu işlem için 6 haneli Yönetici PIN şifresini girin.'
        }
      />
    </header>
  )
}

