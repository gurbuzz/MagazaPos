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
import lufianLogo from '../assets/lufian-og.png'

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
    <header className="h-16 navbar-gradient border-b border-blue-200/50 px-2.5 sm:px-4 lg:px-5 flex items-center justify-between gap-1.5 sm:gap-2 select-none shadow-md z-20 transition-all overflow-hidden">
      {/* Brand Logo */}
      <div className="flex items-center shrink-0">
        {/* Logo Container: Crisp White Pill */}
        <div className="bg-white px-2.5 sm:px-3 py-1 rounded-xl shadow-xs flex items-center justify-center h-9 sm:h-10 border border-white/40 transition-transform hover:scale-[1.02] shrink-0">
          <img
            src={lufianLogo}
            alt="LUFIAN"
            className="h-6 sm:h-7 w-auto max-w-[100px] sm:max-w-[125px] object-contain select-none"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              if (!target.dataset.triedFallback) {
                target.dataset.triedFallback = 'true'
                target.src = '/lufian-og.png'
                return
              }
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent) {
                parent.innerHTML = '<span class="text-slate-900 font-black text-xs sm:text-sm tracking-widest whitespace-nowrap">LUFIAN</span>'
              }
            }}
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="relative z-10 flex items-center gap-1 xl:gap-1.5 bg-[#001a61]/85 p-1 sm:p-1.5 rounded-2xl border border-white/20 backdrop-blur-md shadow-inner shrink-0">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center gap-1.5 xl:gap-2 px-2.5 sm:px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'pos'
              ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
              : 'text-blue-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 xl:w-4 xl:h-4 stroke-[2.2] shrink-0" />
          <span className="whitespace-nowrap">Kasa (POS)</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-1.5 xl:gap-2 px-2.5 sm:px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'customers'
              ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
              : 'text-blue-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <Users className="w-3.5 h-3.5 xl:w-4 xl:h-4 stroke-[2.2] shrink-0" />
          <span className="whitespace-nowrap">Müşteriler</span>
        </button>

        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-1.5 xl:gap-2 px-2.5 sm:px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'stock'
              ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
              : 'text-blue-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <Package className="w-3.5 h-3.5 xl:w-4 xl:h-4 stroke-[2.2] shrink-0" />
          <span className="whitespace-nowrap">Stok & Varyant</span>
        </button>

        <button
          onClick={() => setActiveTab('labels')}
          className={`flex items-center gap-1.5 xl:gap-2 px-2.5 sm:px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 transition-all ${
            activeTab === 'labels'
              ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
              : 'text-blue-100 hover:text-white hover:bg-white/10'
          }`}
        >
          <Printer className="w-3.5 h-3.5 xl:w-4 xl:h-4 stroke-[2.2] shrink-0" />
          <span className="whitespace-nowrap">Etiket Basımı</span>
        </button>

        {!isStockOnlyMode && (
          <button
            onClick={() => handleProtectedAction('sales')}
            className={`flex items-center gap-1.5 xl:gap-2 px-2.5 sm:px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 transition-all ${
              activeTab === 'sales'
                ? 'bg-white text-[#00268A] shadow-md scale-[1.02]'
                : 'text-blue-100 hover:text-white hover:bg-white/10'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 xl:w-4 xl:h-4 stroke-[2.2] shrink-0" />
            <span className="whitespace-nowrap hidden 2xl:inline">Ciro & Satış Raporları</span>
            <span className="whitespace-nowrap 2xl:hidden">Ciro & Raporlar</span>
            <Lock className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-blue-200 stroke-[2.2] shrink-0" />
          </button>
        )}
      </nav>

      {/* Campaign & Settings Controls */}
      <div className="relative z-10 flex items-center gap-1 sm:gap-1.5 text-sm bg-white/85 p-1 sm:p-1.5 rounded-2xl border border-white/60 shadow-xs backdrop-blur-sm shrink-0">
        <button
          onClick={() => setIsCampaignModalOpen(true)}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition shadow-xs whitespace-nowrap shrink-0"
          title="Kampanya ve İndirim Yönetimi"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-200 shrink-0" />
          <span className="hidden sm:inline">Kampanyalar</span>
          <span className="sm:hidden">Kampanya</span>
        </button>

        <div className="h-5 w-px bg-slate-300 mx-0.5 shrink-0" />

        {/* Customer Display (Müşteri Ekranı) Dual-Screen Button */}
        <button
          onClick={handleToggleCustomerDisplay}
          className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl border transition shadow-xs flex items-center justify-center shrink-0 relative ${
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
          <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
          {customerDisplayStatus.isOpen && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse" />
          )}
        </button>

        {/* Fiyatsız Stok / Gizlilik Modu Butonu (Açık Kırmızı, Simgesiz) */}
        <button
          onClick={toggleStockOnlyMode}
          className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl border transition-all shadow-xs flex items-center justify-center shrink-0 relative ${
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
          className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl border transition shadow-xs flex items-center justify-center shrink-0 ${
            isKeyboardOpen
              ? 'bg-[#00268A] text-white border-[#00268A] shadow-sm ring-2 ring-blue-300'
              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-[#00268A] border-slate-200'
          }`}
          title={isKeyboardOpen ? 'Sanal Klavyeyi Kapat' : 'Ekran Dokunmatik Klavyesini Aç'}
        >
          <KeyboardIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
        </button>

        {/* Fullscreen Mode Button */}
        <button
          onClick={handleToggleFullscreen}
          className={`w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-xl border transition shadow-xs flex items-center justify-center shrink-0 ${
            isFullscreen
              ? 'bg-[#00268A] text-white border-[#00268A] shadow-sm'
              : 'bg-white hover:bg-blue-50 text-slate-700 hover:text-[#00268A] border-slate-200'
          }`}
          title={isFullscreen ? 'Tam Ekrandan Çık (F11)' : 'Tam Ekran Modu (F11)'}
        >
          {isFullscreen ? (
            <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
          ) : (
            <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2]" />
          )}
        </button>

        {/* Quick Lock Button */}
        <button
          onClick={lockApp}
          className="w-8 h-8 sm:w-8.5 sm:h-8.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 rounded-xl border border-slate-200 transition shadow-xs flex items-center justify-center shrink-0"
          title="Kayıtı Kilitle (PIN Girişi İster)"
        >
          <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
        </button>

        {/* System Settings Gear Icon Button — Admin PIN Protected */}
        <button
          onClick={() => handleProtectedAction('settings')}
          className="w-8 h-8 sm:w-8.5 sm:h-8.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 transition shadow-xs flex items-center justify-center shrink-0"
          title="Sistem ve Kasa Ayarları (Yönetici PIN Gerekli)"
        >
          <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2]" />
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

