import React, { useState } from 'react'
import { X, Search, RotateCcw, AlertCircle, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'
import { notifyDataChanged } from '../../utils/events'

interface ExchangeModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ExchangeModal: React.FC<ExchangeModalProps> = ({ isOpen, onClose }) => {
  const { applyDiscount } = usePosStore()

  const [searchReceipt, setSearchReceipt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [foundSale, setFoundSale] = useState<any | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen) return null

  const handleSearchSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchReceipt.trim()) return

    setIsLoading(true)
    setErrorMsg('')
    setFoundSale(null)
    setSelectedItemId('')
    setSuccessMsg('')

    try {
      const res = await fetch(`/api/sales?search=${encodeURIComponent(searchReceipt.trim())}`)
      if (!res.ok) throw new Error('Fiş arama başarısız.')
      const data = await res.json()

      const exact =
        data.find(
          (s: any) => s.receiptNo.toLowerCase() === searchReceipt.trim().toLowerCase()
        ) || data[0]

      if (!exact) {
        setErrorMsg(`"${searchReceipt}" numaralı fiş bulunamadı.`)
      } else {
        setFoundSale(exact)
      }
    } catch (err: any) {
      setErrorMsg(`Hata: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApplyExchange = async () => {
    if (!foundSale || !selectedItemId) {
      alert('Lütfen değiştirilecek ürünü seçin.')
      return
    }

    const item = foundSale.items.find((i: any) => i.id === selectedItemId)
    if (!item) return

    const available = item.quantity - (item.returnedQuantity || 0)
    if (available <= 0) {
      alert('Bu ürünün tüm adeti daha önce iade edilmiş veya değiştirilmiştir.')
      return
    }

    setIsProcessing(true)
    setErrorMsg('')

    try {
      // 1. Process return of 1 qty for exchange
      const res = await fetch(`/api/sales/${foundSale.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ saleItemId: item.id, returnQuantity: 1 }],
          reason: 'Beden / Ürün Değişimi (Sıfır Fark Mahsubu)',
          customerName: foundSale.customer
            ? `${foundSale.customer.firstName} ${foundSale.customer.lastName}`
            : 'Anonim Değişim Müşterisi',
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'İade işlemi kaydedilemedi.')
      }

      // 2. Apply credit/discount to cart equal to returned item's unit price
      const creditAmount = item.unitPrice
      applyDiscount(creditAmount)

      setSuccessMsg(
        `✅ "${item.variant?.product?.name || 'Ürün'}" iade stoğuna alındı ve ${creditAmount.toFixed(2)} ₺ değişim mahsubu sepete uygulandı!`
      )
      notifyDataChanged()

      setTimeout(() => {
        setIsProcessing(false)
        onClose()
      }, 1200)
    } catch (err: any) {
      setErrorMsg(`Değişim hatası: ${err.message}`)
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans select-none">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Ürün & Beden Değişimi</h3>
              <span className="text-[11px] text-slate-500">
                Eski fişi sorgulayıp sıfır farkla birebir değişim başlatın.
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Search Form */}
          <form onSubmit={handleSearchSale} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight">
              Eski Fiş Numarası (veya Barkodu)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Örn: FIS-12345678"
                value={searchReceipt}
                onChange={(e) => setSearchReceipt(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !searchReceipt.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs transition flex items-center space-x-1 disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Aranıyor...' : 'Bul'}</span>
              </button>
            </div>
          </form>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Found Sale Items Selection */}
          {foundSale && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-900">Fiş: {foundSale.receiptNo}</span>
                <span className="text-[11px] text-slate-500">
                  {new Date(foundSale.createdAt).toLocaleDateString('tr-TR')}
                </span>
              </div>

              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Değiştirilmek İstenen Ürünü Seçin:
              </label>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {foundSale.items.map((item: any) => {
                  const available = item.quantity - (item.returnedQuantity || 0)
                  const isSelected = selectedItemId === item.id
                  const isExhausted = available <= 0

                  return (
                    <div
                      key={item.id}
                      onClick={() => !isExhausted && setSelectedItemId(item.id)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-center justify-between ${
                        isExhausted
                          ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-500'
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div>
                        <h4 className="font-bold text-slate-900">
                          {item.variant?.product?.name || 'Ürün'}
                        </h4>
                        <span className="text-[10px] text-slate-500">
                          {item.variant?.attributes?.color || ''} / {item.variant?.attributes?.size || ''}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {isExhausted
                            ? 'Tamamı İade/Değişim Yapılmış'
                            : `Kalan Değiştirilebilir Adet: ${available}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-indigo-700 font-mono text-sm block">
                          {item.unitPrice.toFixed(2)} ₺
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-indigo-600">Seçildi ✓</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Zero-Difference Explanation Card */}
              {selectedItemId && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-emerald-800 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Sıfır Fark Değişim Kuralı</span>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Seçilen ürün stoğa geri alınacak ve <strong>{foundSale.items.find((i: any) => i.id === selectedItemId)?.unitPrice.toFixed(2)} ₺</strong> tutarındaki bedel sepete indirim/mahsup olarak yansıtılacaktır.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!selectedItemId || isProcessing}
            onClick={handleApplyExchange}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition flex items-center space-x-1 disabled:opacity-50 shadow-xs"
          >
            <span>{isProcessing ? 'İşleniyor...' : 'Değişimi Sepete Aktar'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
