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
    <div className="h-[calc(100vh-4rem)] bg-slate-100 p-6 overflow-y-auto select-none">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* TOP REVENUE KPI CARDS (Günlük, Aylık, Toplam Ciro) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Günlük Ciro Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <span className="text-xs font-black text-emerald-600 uppercase tracking-wider flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Günlük Ciro</span>
              </span>
              <div className="text-3xl font-black text-slate-900">
                {todayRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <span className="text-xs text-slate-500 font-bold block pt-1">
                Bugün Yapılan: <strong className="text-slate-800">{todaySales.length} Satış Fişi</strong>
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
              <TrendingUp className="w-7 h-7" />
            </div>
          </div>

          {/* Aylık Ciro Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <span className="text-xs font-black text-indigo-600 uppercase tracking-wider flex items-center space-x-1.5">
                <Calendar className="w-4 h-4" />
                <span>Aylık Ciro</span>
              </span>
              <div className="text-3xl font-black text-slate-900">
                {monthlyRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <span className="text-xs text-slate-500 font-bold block pt-1">
                Bu Ay Yapılan: <strong className="text-slate-800">{monthlySales.length} Satış Fişi</strong>
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
              <Calendar className="w-7 h-7" />
            </div>
          </div>

          {/* Toplam Ciro Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between relative overflow-hidden group">
            <div className="space-y-1">
              <span className="text-xs font-black text-purple-600 uppercase tracking-wider flex items-center space-x-1.5">
                <DollarSign className="w-4 h-4" />
                <span>Toplam Ciro (Genel)</span>
              </span>
              <div className="text-3xl font-black text-slate-900">
                {totalRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <div className="flex items-center space-x-3 pt-1 text-xs">
                <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  Nakit: {totalCash.toFixed(0)} ₺
                </span>
                <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                  Kart: {totalCard.toFixed(0)} ₺
                </span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
              <DollarSign className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* SALES HISTORY TABLE WITH FILTERS */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm space-y-0">
          {/* Header & Filter Controls */}
          <div className="p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-600">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center space-x-2">
                  <span>Satış Fişleri Geçmişi</span>
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-black rounded-full border border-indigo-200">
                    Son 20 Satış Gösteriliyor
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Toplam {sales.length} kayıt arasından son işlemler listelenmektedir.
                </p>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex items-center space-x-3">
              {/* Search Bar */}
              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="Fiş No, Kasiyer veya Ürün ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-sm"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>

              {/* Payment Type Filter */}
              <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-xl p-1 shadow-sm">
                <button
                  onClick={() => setPaymentFilter('ALL')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition ${
                    paymentFilter === 'ALL'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setPaymentFilter('CASH')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition flex items-center space-x-1 ${
                    paymentFilter === 'CASH'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Nakit</span>
                </button>
                <button
                  onClick={() => setPaymentFilter('CARD')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition flex items-center space-x-1 ${
                    paymentFilter === 'CARD'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Kart</span>
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchSales}
                className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-300 transition shadow-sm"
                title="Yenile"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Fiş No</th>
                  <th className="px-6 py-3.5">Tarih / Saat</th>
                  <th className="px-6 py-3.5">Kasiyer</th>
                  <th className="px-6 py-3.5">Ödeme Tipi</th>
                  <th className="px-6 py-3.5">Kalem Sayısı</th>
                  <th className="px-6 py-3.5">Toplam Tutar</th>
                  <th className="px-6 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent20Sales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 font-bold">
                      Arama kriterlerine uygun satış fişi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  recent20Sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition group">
                      <td className="px-6 py-4 font-mono font-black text-slate-900">{sale.receiptNo}</td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {new Date(sale.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{sale.cashierName || 'Kasiyer 1'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] font-extrabold text-indigo-700">
                          {(sale.paymentType?.cash || 0) > 0 && (sale.paymentType?.card || 0) > 0
                            ? `Parçalı (${sale.paymentType.cash}₺ Nakit / ${sale.paymentType.card}₺ Kart)`
                            : (sale.paymentType?.cash || 0) > 0
                            ? 'Nakit Ödeme'
                            : 'Kredi Kartı'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {sale.items?.length || 0} Kalem Ürün
                      </td>
                      <td className="px-6 py-4 font-black text-emerald-600 text-sm">
                        {sale.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handlePrintReceipt(sale)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl transition font-bold text-xs inline-flex items-center space-x-1"
                          title="Fiş Yazdır"
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Yazdır</span>
                        </button>
                        <button
                          onClick={() => setSelectedSale(sale)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition font-bold text-xs inline-flex items-center space-x-1 shadow-sm"
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
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5">
              <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div>
                  <h3 className="font-black text-slate-900 text-base">Fiş Detayı: {selectedSale.receiptNo}</h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {new Date(selectedSale.createdAt).toLocaleString('tr-TR')} | Kasiyer: {selectedSale.cashierName || 'Kasiyer 1'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedSale.items?.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center text-xs"
                  >
                    <div>
                      <h4 className="font-extrabold text-slate-900">
                        {item.variant?.product?.name || 'Giyim Ürünü'}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {item.variant?.attributes?.color || ''} / {item.variant?.attributes?.size || ''} | Barkod: {item.variant?.barcode}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 font-medium text-[11px]">x{item.quantity} Adet</span>
                      <span className="font-black text-slate-900 block">{item.totalPrice.toFixed(2)} ₺</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals & Footer Action */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Ödeme Türü:</span>
                  <span className="font-bold text-slate-900">
                    {(selectedSale.paymentType?.cash || 0) > 0 && (selectedSale.paymentType?.card || 0) > 0
                      ? `Parçalı (${selectedSale.paymentType.cash}₺ Nakit / ${selectedSale.paymentType.card}₺ Kart)`
                      : (selectedSale.paymentType?.cash || 0) > 0
                      ? 'Nakit'
                      : 'Kredi Kartı'}
                  </span>
                </div>
                {selectedSale.discountAmount > 0 && (
                  <div className="flex justify-between text-amber-600 font-bold">
                    <span>Uygulanan İndirim:</span>
                    <span>-{selectedSale.discountAmount.toFixed(2)} ₺</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>GENEL TOPLAM:</span>
                  <span className="text-emerald-600 font-black text-base">{selectedSale.totalAmount.toFixed(2)} ₺</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => handlePrintReceipt(selectedSale)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-extrabold rounded-xl text-xs flex items-center space-x-1.5 transition"
                >
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>Fiş Yazdır</span>
                </button>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition shadow-md"
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
