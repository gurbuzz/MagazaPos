import React, { useState, useEffect, useRef } from 'react'
import { X, Search, RotateCcw, AlertCircle, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'

interface ExchangeModalProps {
  isOpen: boolean
  onClose: () => void
}

export const ExchangeModal: React.FC<ExchangeModalProps> = ({ isOpen, onClose }) => {
  const { setExchange } = usePosStore()

  const [searchReceipt, setSearchReceipt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [foundSale, setFoundSale] = useState<any | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSearchReceipt('')
      setErrorMsg('')
      setFoundSale(null)
      setSelectedItemId('')
      setSuccessMsg('')
      setTimeout(() => {
        inputRef.current?.focus()
      }, 60)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSearchSale = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawVal = inputRef.current?.value ?? searchReceipt
    // Fiş barkodu okutulduğunda gelen tüm '*' simgelerini otomatik temizle
    const cleanSearch = (rawVal || '').trim().replace(/\*/g, '')
    if (!cleanSearch) return

    setSearchReceipt(cleanSearch)
    setIsLoading(true)
    setErrorMsg('')
    setFoundSale(null)
    setSelectedItemId('')
    setSuccessMsg('')

    try {
      // 1. Temizlenen barkod / fiş numarası ile sorgula
      let res = await fetch(`/api/sales?search=${encodeURIComponent(cleanSearch)}`)
      if (!res.ok) throw new Error('Fiş arama başarısız.')
      let data = await res.json()

      const normSearch = cleanSearch.toLowerCase().replace(/[*_\s-]/g, '')

      const hasMatch = (list: any[]) =>
        Array.isArray(list) &&
        list.some((s: any) => {
          const normReceipt = String(s.receiptNo || '').toLowerCase().replace(/[*_\s-]/g, '')
          return (
            s.receiptNo?.toLowerCase() === cleanSearch.toLowerCase() ||
            (normSearch.length > 0 && normReceipt === normSearch) ||
            (normSearch.length > 0 && normReceipt.includes(normSearch))
          )
        })

      // Doğrudan eşleşme yoksa (örneğin veritabanında tire varken barkod sadece sayı geldiyse)
      if (!hasMatch(data)) {
        // Alternatif 1: Sadece rakamları alarak sorgula
        const numericOnly = cleanSearch.replace(/\D/g, '')
        if (numericOnly && numericOnly !== cleanSearch && numericOnly.length >= 4) {
          const resNum = await fetch(`/api/sales?search=${encodeURIComponent(numericOnly)}`)
          if (resNum.ok) {
            const numData = await resNum.json()
            if (hasMatch(numData)) {
              data = numData
            }
          }
        }
      }

      if (!hasMatch(data)) {
        // Alternatif 2: Son fişleri çekip istemci tarafında normalize ederek eşleştir
        const resRecent = await fetch('/api/sales?limit=100')
        if (resRecent.ok) {
          const recentData = await resRecent.json()
          if (Array.isArray(recentData)) {
            const matchedRecent = recentData.filter((s: any) => {
              const normReceipt = String(s.receiptNo || '').toLowerCase().replace(/[*_\s-]/g, '')
              return (
                normSearch.length > 0 &&
                (normReceipt === normSearch ||
                  normReceipt.includes(normSearch) ||
                  normSearch.includes(normReceipt))
              )
            })
            if (matchedRecent.length > 0) {
              data = matchedRecent
            }
          }
        }
      }

      const exact =
        data.find((s: any) => {
          const normReceipt = String(s.receiptNo || '').toLowerCase().replace(/[*_\s-]/g, '')
          return (
            s.receiptNo?.toLowerCase() === cleanSearch.toLowerCase() ||
            (normSearch.length > 0 && normReceipt === normSearch) ||
            (normSearch.length > 0 && normReceipt.includes(normSearch))
          )
        }) || (data.length === 1 ? data[0] : null)

      if (!exact) {
        setErrorMsg(`"${cleanSearch}" numaralı fiş bulunamadı.`)
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
      setErrorMsg('Lütfen değiştirilecek ürünü seçin.')
      return
    }

    const item = foundSale.items.find((i: any) => i.id === selectedItemId)
    if (!item) return

    const available = item.quantity - (item.returnedQuantity || 0)
    if (available <= 0) {
      setErrorMsg('Bu ürünün tüm adeti daha önce iade edilmiş veya değiştirilmiştir.')
      return
    }

    const subtotal = foundSale.items.reduce((sum: number, entry: any) => sum + entry.quantity * entry.unitPrice, 0)
    const paidValue = Number(foundSale.totalAmount) + (Number(foundSale.paymentType?.exchange?.credit) || 0)
    const credit = Math.round(item.unitPrice * (subtotal > 0 ? Math.min(1, paidValue / subtotal) : 1) * 100) / 100
    setExchange({ saleId: foundSale.id, itemId: item.id, credit })
    onClose()
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
                ref={inputRef}
                type="text"
                placeholder="Örn: FIS-12345678 veya barkod okutun"
                value={searchReceipt}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\*/g, '')
                  setSearchReceipt(cleaned)
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text')
                  if (pasted && pasted.includes('*')) {
                    e.preventDefault()
                    const cleaned = pasted.replace(/\*/g, '')
                    setSearchReceipt(cleaned)
                  }
                }}
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
                    Ürünün fişte ödenen bedeli sepette mahsup edilir. Değişim ve stok hareketi ödeme tamamlandığında kaydedilir.
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
