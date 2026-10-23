import React, { useState, useEffect } from 'react'
import { Header } from './components/Header'
import { PosView } from './components/POS/PosView'
import { CustomerView } from './components/Customer/CustomerView'
import { StockView } from './components/Stock/StockView'
import { LabelPrinterModal } from './components/Print/LabelPrinterModal'
import { SalesHistoryView } from './components/Sales/SalesHistoryView'
import { PinLockModal } from './components/Security/PinLockModal'
import { LicenseLockModal } from './components/Security/LicenseLockModal'
import { VirtualKeyboard } from './components/Common/VirtualKeyboard'
import { CustomerDisplayView } from './components/CustomerDisplay/CustomerDisplayView'
import { MusicPlayerAudio } from './components/Music/MusicPlayerAudio'
import { usePosStore } from './store/usePosStore'

export const App: React.FC = () => {
  const { activeTab, autoOpenCustomerDisplay } = usePosStore()

  // Hafızalı Sekme Yönetimi: Sadece Stok & Varyant ile Etiket Basımı sayfaları için
  const [stockVisited, setStockVisited] = useState(false)
  const [labelsVisited, setLabelsVisited] = useState(false)

  useEffect(() => {
    if (activeTab === 'stock' && !stockVisited) setStockVisited(true)
    if (activeTab === 'labels' && !labelsVisited) setLabelsVisited(true)
  }, [activeTab, stockVisited, labelsVisited])

  // Detect whether this window is running as the secondary Customer Display
  const isCustomerDisplay =
    window.location.hash === '#customer-display' ||
    window.location.search.includes('display=customer') ||
    window.location.pathname.includes('/customer-display')

  // Auto-launch customer display on secondary monitor once on initial boot if enabled
  const hasAutoLaunchedRef = React.useRef(false)
  useEffect(() => {
    if (isCustomerDisplay || hasAutoLaunchedRef.current) return

    if (autoOpenCustomerDisplay && window.electron?.getCustomerDisplayStatus && window.electron?.openCustomerDisplay) {
      hasAutoLaunchedRef.current = true
      window.electron.getCustomerDisplayStatus().then((status) => {
        // If secondary monitor is detected and customer window is not already opened, launch it automatically
        if (status.hasSecondary && !status.isOpen) {
          window.electron?.openCustomerDisplay()
        }
      }).catch(() => {})
    }
  }, [autoOpenCustomerDisplay, isCustomerDisplay])

  // If this window is dedicated for the customer display, render full-screen customer display directly
  if (isCustomerDisplay) {
    return <CustomerDisplayView />
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-100 via-[#edf3fc] to-slate-200/90 flex flex-col font-sans text-slate-800 antialiased select-none">
      <Header />
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'pos' && <PosView />}
        {activeTab === 'customers' && <CustomerView />}
        {activeTab === 'sales' && <SalesHistoryView />}

        {/* Hafızalı Sekmeler: Sadece Stok & Varyant ile Etiket Basımı */}
        {stockVisited && (
          <div className={activeTab === 'stock' ? 'h-full w-full' : 'hidden'}>
            <StockView />
          </div>
        )}
        {labelsVisited && (
          <div className={activeTab === 'labels' ? 'h-full w-full' : 'hidden'}>
            <LabelPrinterModal />
          </div>
        )}
      </main>

      {/* Security 4-Digit PIN Lock Screen */}
      <PinLockModal />

      {/* Hardware-Locked Single Device License Modal */}
      <LicenseLockModal />

      {/* On-Screen Touch Virtual Keyboard */}
      <VirtualKeyboard />

      {/* Store Radio Audio Engine */}
      <MusicPlayerAudio />
    </div>
  )
}

export default App

