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
  RotateCcw,
  Check,
  Loader2,
} from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'
import { ReturnModal } from '../Customer/ReturnModal'
import { printReceipt, normalizeSaleToReceiptData } from '../../utils/printReceipt'

export const SalesHistoryView: React.FC = () => {
  const { receiptFooterNote, storeName, storeAddress, storePhone, vatRate, receiptPrinter } = usePosStore()
  const [sales, setSales] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSale, setSelectedSale] = useState<any | null>(null)
  const [returnSale, setReturnSale] = useState<any | null>(null)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null)
  const [printedSaleId, setPrintedSaleId] = useState<string | null>(null)
  const [printFeedback, setPrintFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Filter States
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CASH' | 'CARD'>('ALL')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const fetchSales = async () => {
    setIsLoading(true)
    try {
      let url = '/api/sales?limit=300'
      if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`
      if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`

      const res = await fetch(url)
      const data = await res.json()
      setSales(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching sales history:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSales()

    const handleDataUpdate = () => {
      fetchSales()
    }

    window.addEventListener('pos-data-updated', handleDataUpdate)
    window.addEventListener('focus', handleDataUpdate)

    return () => {
      window.removeEventListener('pos-data-updated', handleDataUpdate)
      window.removeEventListener('focus', handleDataUpdate)
    }
  }, [startDate, endDate])

  // Helper date functions for quick presets
  const formatDateTimeLocal = (d: Date) => {
    const pad = (n: number) => (n < 10 ? '0' + n : n)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const setPresetToday = () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    setStartDate(formatDateTimeLocal(start))
    setEndDate(formatDateTimeLocal(end))
  }

  const setPresetYesterday = () => {
    const start = new Date()
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setDate(end.getDate() - 1)
    end.setHours(23, 59, 59, 999)
    setStartDate(formatDateTimeLocal(start))
    setEndDate(formatDateTimeLocal(end))
  }

  const setPresetThisMonth = () => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    setStartDate(formatDateTimeLocal(start))
    setEndDate(formatDateTimeLocal(end))
  }

  const clearDateFilter = () => {
    setStartDate('')
    setEndDate('')
  }

  // Filter Sales locally
  const filteredSales = sales.filter((sale) => {
    const saleTime = new Date(sale.createdAt).getTime()
    if (startDate && saleTime < new Date(startDate).getTime()) return false
    if (endDate && saleTime > new Date(endDate).getTime()) return false

    const searchLower = searchTerm.toLowerCase()
    const matchesReceipt = sale.receiptNo?.toLowerCase().includes(searchLower)
    const matchesCashier = sale.cashierName?.toLowerCase().includes(searchLower)
    const matchesItem = sale.items?.some((i: any) =>
      i.variant?.product?.name?.toLowerCase().includes(searchLower)
    )
    const matchesSearch = matchesReceipt || matchesCashier || matchesItem

    let matchesPayment = true
    if (paymentFilter === 'CASH') {
      const isCash = (sale.paymentType?.cash || 0) > 0 && (sale.paymentType?.card || 0) === 0
      const isLegacyCash = typeof sale.paymentType === 'string' && sale.paymentType === 'CASH'
      matchesPayment = isCash || isLegacyCash
    } else if (paymentFilter === 'CARD') {
      const isCard = (sale.paymentType?.card || 0) > 0 && (sale.paymentType?.cash || 0) === 0
      const isLegacyCard = typeof sale.paymentType === 'string' && sale.paymentType === 'CARD'
      matchesPayment = isCard || isLegacyCard
    }

    return matchesSearch && matchesPayment
  })

  // Helper to extract net finances for a sale (Kasadan düşülmüş net rakamlar)
  const getSaleMetrics = (s: any) => {
    const isFullyReturned = s.status === 'RETURNED'
    const total = Number(s.totalAmount) || 0
    let refund = Number(s.refundAmount)
    if (isNaN(refund)) {
      if (isFullyReturned) {
        refund = total
      } else {
        const itemRefund = (s.items || []).reduce((sum: number, it: any) => {
          return sum + (Number(it.returnedQuantity) || 0) * (Number(it.unitPrice) || 0)
        }, 0)
        refund = Math.min(total, itemRefund)
      }
    }
    const net = isFullyReturned ? 0 : (s.netAmount !== undefined ? Number(s.netAmount) : Math.max(0, total - refund))

    let netCash = s.paymentType?.netCash !== undefined ? Number(s.paymentType.netCash) : undefined
    let netCard = s.paymentType?.netCard !== undefined ? Number(s.paymentType.netCard) : undefined

    if (netCash === undefined || netCard === undefined) {
      const origCash = Number(s.paymentType?.cash) || 0
      const origCard = Number(s.paymentType?.card) || 0
      if (isFullyReturned) {
        netCash = 0
        netCard = 0
      } else if (origCash > 0 && origCard === 0) {
        netCash = Math.max(0, origCash - refund)
        netCard = 0
      } else if (origCard > 0 && origCash === 0) {
        netCard = Math.max(0, origCard - refund)
        netCash = 0
      } else {
        const totalPay = origCash + origCard || 1
        netCash = Math.max(0, origCash - (refund * (origCash / totalPay)))
        netCard = Math.max(0, origCard - (refund * (origCard / totalPay)))
      }
    }

    return { total, refund, net, netCash: netCash || 0, netCard: netCard || 0 }
  }

  // Calculate Net Revenue KPIs based on filtered set (KASADAN DÜŞÜLMÜŞ GERÇEK RAKAMLAR)
  const filteredGrossRevenue = filteredSales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0)
  const filteredTotalRefund = filteredSales.reduce((sum, s) => sum + getSaleMetrics(s).refund, 0)
  const filteredNetRevenue = filteredSales.reduce((sum, s) => sum + getSaleMetrics(s).net, 0)
  const filteredNetCash = filteredSales.reduce((sum, s) => sum + getSaleMetrics(s).netCash, 0)
  const filteredNetCard = filteredSales.reduce((sum, s) => sum + getSaleMetrics(s).netCard, 0)
  const refundedSalesCount = filteredSales.filter(
    (s) => s.status === 'RETURNED' || s.status === 'PARTIAL_RETURN' || getSaleMetrics(s).refund > 0
  ).length
  const activeSalesCount = filteredSales.filter((s) => s.status !== 'RETURNED').length
  const avgReceiptAmount = activeSalesCount > 0 ? filteredNetRevenue / activeSalesCount : 0

  const handlePrintReceipt = async (sale: any) => {
    if (!sale) return
    setPrintingSaleId(sale.id)
    setPrintFeedback(null)

    try {
      const receiptData = normalizeSaleToReceiptData(sale, {
        storeName,
        storeAddress,
        storePhone,
        receiptFooterNote,
        vatRate,
        receiptPrinter,
        cashierName: sale.cashierName,
      })
      const res = await printReceipt(receiptData)
      if (res.success) {
        setPrintedSaleId(sale.id)
        setPrintFeedback({
          text: `Fiş (${sale.receiptNo}) başarıyla yazıcıya gönderildi.`,
          type: 'success',
        })
        setTimeout(() => {
          setPrintedSaleId(null)
          setPrintFeedback(null)
        }, 4000)
      } else {
        setPrintFeedback({
          text: `Yazdırma uyarısı (${sale.receiptNo}): ${res.error || 'Yazıcıya ulaşılamadı'}`,
          type: 'error',
        })
      }
    } catch (err: any) {
      console.error('Print receipt error:', err)
      setPrintFeedback({
        text: `Yazdırma hatası: ${err.message || 'Bilinmeyen hata'}`,
        type: 'error',
      })
    } finally {
      setPrintingSaleId(null)
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 p-5 overflow-y-auto select-none font-sans">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* DATE & TIME RANGE FILTER BAR */}
        <div className="glass-panel rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-[#00268A]">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-tight">Tarih & Saat Aralığı İle Filtrele</h3>
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={setPresetToday}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-[#00268A] text-slate-700 border border-slate-200 rounded text-xs font-semibold transition"
              >
                Bugün
              </button>
              <button
                onClick={setPresetYesterday}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-[#00268A] text-slate-700 border border-slate-200 rounded text-xs font-semibold transition"
              >
                Dün
              </button>
              <button
                onClick={setPresetThisMonth}
                className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-[#00268A] text-slate-700 border border-slate-200 rounded text-xs font-semibold transition"
              >
                Bu Ay
              </button>
              {(startDate || endDate) && (
                <button
                  onClick={clearDateFilter}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition flex items-center space-x-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Filtreyi Temizle</span>
                </button>
              )}
            </div>
          </div>

          {/* Date & Time Picker Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Başlangıç Tarihi & Saati</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 font-medium focus:ring-1 focus:ring-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bitiş Tarihi & Saati</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 font-medium focus:ring-1 focus:ring-blue-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Arama (Fiş / Kasiyer / Ürün)</label>
              <div className="flex items-center space-x-1.5">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Fiş No, Kasiyer veya Ürün ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-8 py-2 bg-white/80 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-[#00268A] focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {}}
                  className="px-3.5 py-2 bg-[#00268A] hover:bg-[#001f70] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1 shrink-0"
                  title="Arama Yap"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Ara</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Ödeme Yöntemi</label>
              <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded p-0.5">
                <button
                  onClick={() => setPaymentFilter('ALL')}
                  className={`flex-1 py-1 text-[11px] font-semibold rounded transition ${
                    paymentFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tümü
                </button>
                <button
                  onClick={() => setPaymentFilter('CASH')}
                  className={`flex-1 py-1 text-[11px] font-semibold rounded transition flex items-center justify-center space-x-1 ${
                    paymentFilter === 'CASH'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Banknote className="w-3 h-3" />
                  <span>Nakit</span>
                </button>
                <button
                  onClick={() => setPaymentFilter('CARD')}
                  className={`flex-1 py-1 text-[11px] font-semibold rounded transition flex items-center justify-center space-x-1 ${
                    paymentFilter === 'CARD'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Kart</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TOP DYNAMIC KPI CARDS (Net Ciro, Net Nakit Kasa, Net Kart, Toplam İadeler) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          {/* Net Dönem Cirosu */}
          <div className="glass-card rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-tight flex items-center space-x-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Net Kasa Cirosu</span>
              </span>
              <div className="text-xl font-bold text-slate-900">
                {filteredNetRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <span className="text-[11px] text-slate-500 font-medium block">
                Brüt: {filteredGrossRevenue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                {filteredTotalRefund > 0 && (
                  <span className="text-amber-700 font-semibold ml-1">
                    (-{filteredTotalRefund.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ İade)
                  </span>
                )}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50/80 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          {/* Net Nakit Kasa */}
          <div className="glass-card rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-tight flex items-center space-x-1.5">
                <Banknote className="w-3.5 h-3.5" />
                <span>Net Nakit Kasa</span>
              </span>
              <div className="text-xl font-bold text-slate-900">
                {filteredNetCash.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <span className="text-[11px] text-slate-500 font-medium block">
                Kasada Bulunması Gereken Net Nakit
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50/80 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs">
              <Banknote className="w-5 h-5" />
            </div>
          </div>

          {/* Net Kredi Kartı */}
          <div className="glass-card rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-tight flex items-center space-x-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Net Kart Tahsilat</span>
              </span>
              <div className="text-xl font-bold text-slate-900">
                {filteredNetCard.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <span className="text-[11px] text-slate-500 font-medium block">
                POS Cihazı Net Tahsilatı
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          {/* Toplam İadeler (Kasadan Düşülen) */}
          <div className="glass-card rounded-2xl p-4 shadow-sm hover:shadow-lg transition-all flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-tight flex items-center space-x-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Toplam İadeler</span>
              </span>
              <div className="text-xl font-bold text-slate-900">
                {filteredTotalRefund.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
              <span className="text-[11px] text-slate-500 font-medium block">
                {refundedSalesCount > 0
                  ? `${refundedSalesCount} Fiş İadesi Kasadan Düşüldü`
                  : 'Dönemde İade Bulunmuyor'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50/80 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* SALES HISTORY TABLE */}
        <div className="glass-panel rounded-2xl overflow-hidden shadow-md space-y-0">
          {/* Header Bar */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-xs flex items-center space-x-2">
                  <span>Satış Fişleri Kayıt Listesi</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded border border-blue-100">
                    {filteredSales.length} Fiş Listelendi
                  </span>
                </h3>
              </div>
            </div>

            <button
              onClick={fetchSales}
              className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 transition shadow-2xs flex items-center space-x-1 text-xs font-semibold cursor-pointer"
              title="Listeyi Yenile"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>
          </div>

          {printFeedback && (
            <div
              className={`p-2.5 mx-3.5 mt-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs ${
                printFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-300'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <span>{printFeedback.type === 'success' ? '🧾' : '⚠️'}</span>
                <span>{printFeedback.text}</span>
              </span>
              <button
                type="button"
                onClick={() => setPrintFeedback(null)}
                className="ml-2 font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-4 py-3">Fiş No</th>
                  <th className="px-4 py-3">Tarih / Saat</th>
                  <th className="px-4 py-3">Kasiyer</th>
                  <th className="px-4 py-3">Ödeme Tipi</th>
                  <th className="px-4 py-3">Kalem Sayısı</th>
                  <th className="px-4 py-3">Toplam Tutar</th>
                  <th className="px-4 py-3 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 font-semibold">
                      Arama ve tarih filtre kriterlerine uygun satış fişi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 transition group">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{sale.receiptNo}</td>
                      <td className="px-4 py-2.5 text-slate-600 font-medium">
                        {new Date(sale.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{sale.cashierName || 'Kasiyer 1'}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">
                          {(sale.paymentType?.cash || 0) > 0 && (sale.paymentType?.card || 0) > 0
                            ? `Parçalı (${sale.paymentType.cash}₺ Nakit / ${sale.paymentType.card}₺ Kart)`
                            : (sale.paymentType?.cash || 0) > 0
                            ? 'Nakit Ödeme'
                            : 'Kredi Kartı'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-700">
                        {sale.items?.length || 0} Kalem Ürün
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {sale.status === 'RETURNED' ? (
                          <div className="space-y-0.5">
                            <span className="line-through text-slate-400 text-[11px] block">
                              {sale.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </span>
                            <span className="font-bold text-rose-600 flex items-center space-x-1">
                              <span>0,00 ₺</span>
                              <span className="text-[10px] bg-rose-50 text-rose-700 px-1 py-0.2 rounded font-semibold border border-rose-200">
                                İade Edildi
                              </span>
                            </span>
                          </div>
                        ) : sale.status === 'PARTIAL_RETURN' || (sale.refundAmount && sale.refundAmount > 0) ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-emerald-700 block">
                              {(sale.netAmount !== undefined
                                ? sale.netAmount
                                : Math.max(0, sale.totalAmount - (sale.refundAmount || 0))
                              ).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                              ₺
                            </span>
                            <span className="text-[10px] font-semibold text-amber-700 block">
                              (-{(sale.refundAmount || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺ İade)
                            </span>
                          </div>
                        ) : (
                          <span className="font-bold text-emerald-700">
                            {sale.totalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right space-x-1.5">
                        <button
                          type="button"
                          disabled={printingSaleId === sale.id}
                          onClick={() => handlePrintReceipt(sale)}
                          className={`px-2.5 py-1 rounded transition font-semibold text-xs inline-flex items-center space-x-1 border cursor-pointer ${
                            printedSaleId === sale.id
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                          } disabled:opacity-60`}
                          title="Fiş Kes / Yazdır"
                        >
                          {printingSaleId === sale.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                              <span>Basılıyor...</span>
                            </>
                          ) : printedSaleId === sale.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Fiş Kesildi</span>
                            </>
                          ) : (
                            <>
                              <Printer className="w-3.5 h-3.5 text-blue-600" />
                              <span>Fiş Kes</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setReturnSale(sale)
                            setIsReturnModalOpen(true)
                          }}
                          disabled={sale.status === 'RETURNED'}
                          className={`px-2.5 py-1 rounded transition font-semibold text-xs inline-flex items-center space-x-1 ${
                            sale.status === 'RETURNED'
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs'
                          }`}
                          title={sale.status === 'RETURNED' ? 'Bu fiş tamamen iade edilmiştir' : 'Ürün İadesi Yap'}
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          <span>{sale.status === 'RETURNED' ? 'İade Edildi' : sale.status === 'PARTIAL_RETURN' ? 'Kısmi İade' : 'İade'}</span>
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
            <div className="glass-modal rounded-2xl p-5 w-full max-w-lg shadow-2xl space-y-4">
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
                <div className="flex justify-between text-xs font-semibold text-slate-600 pt-1 border-t border-slate-200">
                  <span>Fiş Satış Tutarı:</span>
                  <span>{selectedSale.totalAmount.toFixed(2)} ₺</span>
                </div>
                {(selectedSale.refundAmount > 0 || selectedSale.status === 'RETURNED') && (
                  <div className="flex justify-between text-xs font-bold text-rose-600">
                    <span>Kasadan Yapılan İade:</span>
                    <span>
                      -
                      {(selectedSale.refundAmount !== undefined
                        ? selectedSale.refundAmount
                        : selectedSale.totalAmount
                      ).toFixed(2)}{' '}
                      ₺
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>NET KASA GELİRİ:</span>
                  <span className="text-emerald-700 font-bold text-sm">
                    {(selectedSale.netAmount !== undefined
                      ? selectedSale.netAmount
                      : selectedSale.status === 'RETURNED'
                      ? 0
                      : Math.max(0, selectedSale.totalAmount - (selectedSale.refundAmount || 0))
                    ).toFixed(2)}{' '}
                    ₺
                  </span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  disabled={printingSaleId === selectedSale.id}
                  onClick={() => handlePrintReceipt(selectedSale)}
                  className={`px-3.5 py-1.5 font-semibold rounded text-xs flex items-center space-x-1.5 transition border cursor-pointer ${
                    printedSaleId === selectedSale.id
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  } disabled:opacity-60`}
                  title="Fiş Kes / Yazdır"
                >
                  {printingSaleId === selectedSale.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      <span>Basılıyor...</span>
                    </>
                  ) : printedSaleId === selectedSale.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fiş Kesildi</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                      <span>Fiş Kes / Yazdır</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setReturnSale(selectedSale)
                    setIsReturnModalOpen(true)
                    setSelectedSale(null)
                  }}
                  disabled={selectedSale.status === 'RETURNED'}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded text-xs flex items-center space-x-1 transition shadow-2xs disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>İade Yap</span>
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

        {/* RETURN MODAL */}
        <ReturnModal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          sale={returnSale}
          onSuccess={() => {
            fetchSales()
          }}
        />
      </div>
    </div>
  )
}
