import React, { useEffect, useState } from 'react'
import { ShoppingBag, Package, Printer, Receipt, Wifi, Sparkles, Settings, Lock } from 'lucide-react'
import { usePosStore } from '../store/usePosStore'
import { CampaignModal } from './POS/CampaignModal'
import { SystemSettingsModal } from './Security/SystemSettingsModal'

export const Header: React.FC = () => {
  const { activeTab, setActiveTab, localIp, setLocalIp, storeName, cashierName, lockApp } = usePosStore()
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  useEffect(() => {
    if (window.electron?.getLocalIp) {
      window.electron.getLocalIp().then((ip: string) => setLocalIp(ip))
    } else {
      fetch('/api/health')
        .then((res) => res.json())
        .then((data) => setLocalIp(data.localIp || '127.0.0.1'))
        .catch(() => {})
    }
  }, [setLocalIp])

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-5 flex items-center justify-between select-none shadow-md z-20">
      {/* Brand & Store Name */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2.5 bg-slate-800/80 border border-slate-700/60 px-3 py-1 rounded-md">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
            POS
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-slate-100 text-xs tracking-tight leading-tight">{storeName}</h1>
            <span className="text-[10px] text-slate-400 font-medium">Kasa: <span className="text-blue-400 font-semibold">{cashierName}</span></span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="flex items-center space-x-1 bg-slate-950/60 p-1 rounded-md border border-slate-800">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
            activeTab === 'pos'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Kasa (POS)</span>
        </button>

        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
            activeTab === 'stock'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Stok & Varyant</span>
        </button>

        <button
          onClick={() => setActiveTab('labels')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
            activeTab === 'labels'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Etiket Basımı</span>
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded text-xs font-semibold transition ${
            activeTab === 'sales'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Ciro & Satış Raporları</span>
        </button>
      </nav>

      {/* Campaign & Settings Controls */}
      <div className="flex items-center space-x-2 text-xs">
        <button
          onClick={() => setIsCampaignModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded text-xs font-semibold transition"
          title="Kampanya ve İndirim Yönetimi"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Kampanyalar</span>
        </button>

        <div className="h-5 w-px bg-slate-800" />

        {/* Quick Lock Button */}
        <button
          onClick={lockApp}
          className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 rounded border border-slate-700 transition"
          title="Kayıtı Kilitle (PIN Girişi İster)"
        >
          <Lock className="w-4 h-4" />
        </button>

        {/* System Settings Gear Icon Button */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 transition"
          title="Sistem ve Kasa Ayarları"
        >
          <Settings className="w-4 h-4" />
        </button>

        <CampaignModal
          isOpen={isCampaignModalOpen}
          onClose={() => setIsCampaignModalOpen(false)}
        />

        <SystemSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      </div>
    </header>
  )
}
