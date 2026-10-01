import React, { useEffect } from 'react'
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
import { usePosStore } from './store/usePosStore'

export const App: React.FC = () => {
  const { activeTab, autoOpenCustomerDisplay } = usePosStore()

  // Detect whether this window is running as the secondary Customer Display
  const isCustomerDisplay =
    window.location.hash === '#customer-display' ||
    window.location.search.includes('display=customer') ||
    window.location.pathname.includes('/customer-display')

  // Auto-launch customer display on secondary monitor if enabled
  useEffect(() => {
    if (isCustomerDisplay) return

    if (autoOpenCustomerDisplay && window.electron?.getCustomerDisplayStatus && window.electron?.openCustomerDisplay) {
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
      <main className="flex-1 overflow-hidden">
        {activeTab === 'pos' && <PosView />}
        {activeTab === 'customers' && <CustomerView />}
        {activeTab === 'stock' && <StockView />}
        {activeTab === 'labels' && <LabelPrinterModal />}
        {activeTab === 'sales' && <SalesHistoryView />}
      </main>

      {/* Security 4-Digit PIN Lock Screen */}
      <PinLockModal />

      {/* Hardware-Locked Single Device License Modal */}
      <LicenseLockModal />

      {/* On-Screen Touch Virtual Keyboard */}
      <VirtualKeyboard />
    </div>
  )
}

export default App

