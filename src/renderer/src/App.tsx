import React from 'react'
import { Header } from './components/Header'
import { PosView } from './components/POS/PosView'
import { CustomerView } from './components/Customer/CustomerView'
import { StockView } from './components/Stock/StockView'
import { LabelPrinterModal } from './components/Print/LabelPrinterModal'
import { SalesHistoryView } from './components/Sales/SalesHistoryView'
import { PinLockModal } from './components/Security/PinLockModal'
import { usePosStore } from './store/usePosStore'

export const App: React.FC = () => {
  const { activeTab } = usePosStore()

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 flex flex-col font-sans text-slate-800 antialiased select-none">
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
    </div>
  )
}

export default App
