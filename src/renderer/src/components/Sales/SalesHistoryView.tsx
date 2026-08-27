import React, { useState, useEffect } from 'react'
import {
  Receipt,
  RefreshCw,
  TrendingUp,
  Calendar,
  DollarSign,
  Search,
  Filter,
  CreditCard,
  Banknote,
  Printer,
  X,
  Eye,
  ShoppingBag,
} from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'

export const SalesHistoryView: React.FC = () => {
  const { receiptFooterNote, storeName, storeAddress, storePhone } = usePosStore()
  const [sales, setSales] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSale, setSelectedSale] = useState<any | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH' | 'CARD'>('ALL')

  const fetchSales = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/sales')
      const data = await res.json()
      setSales(data || [])
    } catch (err) {
      console.error('Error fetching sales history:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()
  }, [])

  // Helper date functions
  const now = new Date()
  const isToday = (date: Date) => {
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    )
  }

  const isThisMonth = (date: Date) => {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }

  // Calculate Revenue KPIs
  const todaySales = sales.filter((s) => isToday(new Date(s.createdAt)))
  const todayRevenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0)

  const monthlySales = sales.filter((s) => isThisMonth(new Date(s.createdAt)))
  const monthlyRevenue = monthlySales.reduce((sum, s) => sum + s.totalAmount, 0)

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0)

  const totalCash = sales.reduce((sum, s) => sum + (s.paymentType?.cash || 0), 0)
  const totalCard = sales.reduce((sum, s) => sum + (s.paymentType?.card || 0), 0)

  // Filter Sales
  const filteredSales = sales.filter((sale) => {
    const searchLower = searchTerm.toLowerCase()
    const matchesReceipt = sale.receiptNo?.toLowerCase().includes(searchLower)
    const matchesCashier = sale.cashierName?.toLowerCase().includes(searchLower)
    const matchesItem = sale.items?.some((i: any) =>
      i.variant?.product?.name?.toLowerCase().includes(searchLower)
    )
    const matchesSearch = matchesReceipt || matchesCashier || matchesItem

    let matchesPayment = true
    if (paymentFilter === 'CASH') {
      matchesPayment = (sale.paymentType?.cash || 0) > 0 && (sale.paymentType?.card || 0) === 0
    } else if (paymentFilter === 'CARD') {
      matchesPayment = (sale.paymentType?.card || 0) > 0 && (sale.paymentType?.cash || 0) === 0
    }

    return matchesSearch && matchesPayment
  })

  // Limit to last 20 sales
  const recent20Sales = filteredSales.slice(0, 20)

  const handlePrintReceipt = (sale: any) => {
    if (!sale) return
    const receiptHtml = `
      <html>
        <head>
          <style>
            body { font-family: monospace; width: 280px; padding: 10px; font-size: 12px; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; }
            .item { display: flex; justify-content: space-between; margin: 4px 0; }
            .total { border-top: 1px dashed #000; margin-top: 8px; padding-top: 5px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>${storeName || 'MAĞAZA POS'}</h3>
            <p>${storeAddress || ''}</p>
            <p>Tel: ${storePhone || ''}</p>
            <p>Fiş No: ${sale.receiptNo}</p>
            <p>Tarih: ${new Date(sale.createdAt).toLocaleString('tr-TR')}</p>
            <p>Kasiyer: ${sale.cashierName || 'Kasiyer'}</p>
          </div>
          <div style="margin-top: 10px;">
            ${sale.items
              ?.map(
                (item: any) => `
              <div class="item">
                <span>${item.variant?.product?.name || 'Ürün'} (${item.variant?.attributes?.color || ''} ${item.variant?.attributes?.size || ''}) x${item.quantity}</span>
                <span>${item.totalPrice?.toFixed(2)} TL</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="total">
            <div class="item"><span>İndirim:</span><span>-${(sale.discountAmount || 0).toFixed(2)} TL</span></div>
            <div class="item" style="font-size: 14px;"><span>GENEL TOPLAM:</span><span>${sale.totalAmount?.toFixed(2)} TL</span></div>
          </div>
          <div class="header" style="border-bottom: none; border-top: 1px dashed #000; margin-top: 10px;">
            <p>${receiptFooterNote || 'Teşekkür Ederiz!'}</p>
          </div>
        </body>
      </html>
    `

    if (window.electron?.printSilent) {
      window.electron.printSilent(receiptHtml)
    } else {
      const printWin = window.open('', '_blank')
      printWin?.document.write(receiptHtml)
      printWin?.print()
      printWin?.close()
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 p-5 overflow-y-auto select-none font-sans">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* TOP REVENUE KPI CARDS (Günlük, Aylık, Toplam Ciro) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Günlük Ciro Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-tight flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Günlük Ciro</span>
              </span>
              <div className="text-2xl font-bold text-slate-900">
                {todayRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <span className="text-xs text-slate-500 font-medium block pt-0.5">
                Bugün: <strong className="text-slate-800 font-semibold">{todaySales.length} Satış Fişi</strong>
              </span>
            </div>
            <div className="w-12 h-12 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Aylık Ciro Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-blue-700 uppercase tracking-tight flex items-center space-x-1.5">
                <Calendar className="w-4 h-4" />
                <span>Aylık Ciro</span>
              </span>
              <div className="text-2xl font-bold text-slate-900">
                {monthlyRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <span className="text-xs text-slate-500 font-medium block pt-0.5">
                Bu Ay: <strong className="text-slate-800 font-semibold">{monthlySales.length} Satış Fişi</strong>
              </span>
            </div>
            <div className="w-12 h-12 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

          {/* Toplam Ciro Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between relative overflow-hidden">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-tight flex items-center space-x-1.5">
                <DollarSign className="w-4 h-4" />
                <span>Toplam Ciro (Genel)</span>
              </span>
              <div className="text-2xl font-bold text-slate-900">
                {totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <div className="flex items-center space-x-2 pt-0.5 text-[11px]">
                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Nakit: {totalCash.toFixed(0)} ₺
                </span>
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  Kart: {totalCard.toFixed(0)} ₺
                </span>
              </div>
            </div>
            <div className="w-12 h-12 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* SALES HISTORY TABLE WITH FILTERS */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm space-y-0">
          {/* Header & Filter Controls */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <span>Satış Fişleri Geçmişi</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded border border-blue-100">
                    Son 20 Satış
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Toplam {sales.length} kayıt arasından son işlemler listelenmektedir.
                </p>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex items-center space-x-2">
              {/* Search Bar */}
              <div className="relative w-56">
                <input
                  type="text"
                  placeholder="Fiş No, Kasiyer veya Ürün ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-blue-600 focus:outline-none shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>

              {/* Payment Type Filter */}
              <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded p-0.5 shadow-2xs">
                <button
                  onClick={() => setPaymentFilter('ALL')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition ${
                    paymentFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setPaymentFilter('CASH')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition flex items-center space-x-1 ${
                    paymentFilter === 'CASH'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Banknote className="w-3 h-3" />
                  <span>Nakit</span>
                </button>
                <button
                  onClick={() => setPaymentFilter('CARD')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition flex items-center space-x-1 ${
                    paymentFilter === 'CARD'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Kart</span>
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchSales}
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 transition shadow-2xs"
                title="Yenile"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-5 py-3">Fiş No</th>
                  <th className="px-5 py-3">Tarih / Saat</th>
                  <th className="px-5 py-3">Kasiyer</th>
                  <th className="px-5 py-3">Ödeme Tipi</th>
                  <th className="px-5 py-3">Kalem Sayısı</th>
                  <th className="px-5 py-3">Toplam Tutar</th>
                  <th className="px-5 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent20Sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-semibold">
                      Arama kriterlerine uygun satış fişi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  recent20Sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition group">
                      <td className="px-5 py-3 font-mono font-bold text-slate-900">{sale.receiptNo}</td>
                      <td className="px-5 py-3 text-slate-500 font-medium">
                        {new Date(sale.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{sale.cashierName || 'Kasiyer 1'}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">
                          {(sale.paymentType?.cash || 0) > 0 && (sale.paymentType?.card || 0) > 0
                            ? `Parçalı (${sale.paymentType.cash}₺ Nakit / ${sale.paymentType.card}₺ Kart)`
                            : (sale.paymentType?.cash || 0) > 0
                            ? 'Nakit Ödeme'
                            : 'Kredi Kartı'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-700">
                        {sale.items?.length || 0} Kalem Ürün
                      </td>
                      <td className="px-5 py-3 font-bold text-emerald-700 text-xs">
                        {sale.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="px-5 py-3 text-right space-x-1.5">
                        <button
                          onClick={() => handlePrintReceipt(sale)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded transition font-semibold text-xs inline-flex items-center space-x-1"
                          title="Fiş Yazdır"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          <span>Yazdır</span>
                        </button>
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded transition font-semibold text-xs inline-flex items-center space-x-1 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>İncele</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SALE DETAIL MODAL */}
        {selectedSale && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-lg shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Fiş Detayı: {selectedSale.receiptNo}</h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {new Date(selectedSale.createdAt).toLocaleString('tr-TR')} | Kasiyer: {selectedSale.cashierName || 'Kasiyer 1'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {selectedSale.items?.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded flex justify-between items-center text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">
                        {item.variant?.product?.name || 'Giyim Ürünü'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {item.variant?.attributes?.color || ''} / {item.variant?.attributes?.size || ''} | Barkod: {item.variant?.barcode}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 font-medium text-[11px]">x{item.quantity} Adet</span>
                      <span className="font-bold text-slate-900 block">{item.totalPrice.toFixed(2)} ₺</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals & Footer Action */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Ödeme Türü:</span>
                  <span className="font-semibold text-slate-900">
                    {(selectedSale.paymentType?.cash || 0) > 0 && (selectedSale.paymentType?.card || 0) > 0
                      ? `Parçalı (${selectedSale.paymentType.cash}₺ Nakit / ${selectedSale.paymentType.card}₺ Kart)`
                      : (selectedSale.paymentType?.cash || 0) > 0
                      ? 'Nakit'
                      : 'Kredi Kartı'}
                  </span>
                </div>
                {selectedSale.discountAmount > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Uygulanan İndirim:</span>
                    <span>-{selectedSale.discountAmount.toFixed(2)} ₺</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>GENEL TOPLAM:</span>
                  <span className="text-emerald-700 font-bold text-sm">{selectedSale.totalAmount.toFixed(2)} ₺</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  onClick={() => handlePrintReceipt(selectedSale)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-semibold rounded text-xs flex items-center space-x-1 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                  <span>Fiş Yazdır</span>
                </button>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded text-xs transition shadow-2xs"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
