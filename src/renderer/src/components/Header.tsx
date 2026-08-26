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
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between select-none shadow-sm z-10">
      {/* Brand & Store Name */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm">
            POS
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-sm tracking-wide leading-none">{storeName}</h1>
            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Aktif: {cashierName}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <nav className="flex items-center space-x-2">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'pos'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Kasa (POS)</span>
        </button>

        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'stock'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Stok & Varyant</span>
        </button>

        <button
          onClick={() => setActiveTab('labels')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'labels'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Etiket Basımı</span>
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            activeTab === 'sales'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Ciro & Satış Raporları</span>
        </button>
      </nav>

      {/* Campaign & Settings Controls */}
      <div className="flex items-center space-x-2.5 text-xs">
        <button
          onClick={() => setIsCampaignModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-extrabold transition shadow-sm"
          title="Kampanya ve İndirim Yönetimi"
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>Kampanyalar</span>
        </button>

        <div className="h-6 w-px bg-slate-200" />

        {/* Quick Lock Button */}
        <button
          onClick={lockApp}
          className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl border border-slate-200 transition"
          title="Kayıtı Kilitle (PIN Girişi İster)"
        >
          <Lock className="w-4 h-4" />
        </button>

        {/* System Settings Gear Icon Button (Replaces old cashier text) */}
        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="p-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl border border-slate-200 transition"
          title="Sistem ve Kasa Ayarları"
        >
          <Settings className="w-5 h-5" />
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
