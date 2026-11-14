import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Search,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  PackageCheck,
  Banknote,
  CreditCard,
  User,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { notifyDataChanged } from '../../utils/events'

interface PosReturnModalProps {
  isOpen: boolean
  onClose: () => void
}

export const PosReturnModal: React.FC<PosReturnModalProps> = ({ isOpen, onClose }) => {
  const [searchReceipt, setSearchReceipt] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [successMsg, setSuccessMsg] = useState<string>('')
  const [foundSale, setFoundSale] = useState<any | null>(null)
  const [returnItems, setReturnItems] = useState<{ [saleItemId: string]: number }>({})
  const [reason, setReason] = useState<string>('')
  const [anonCustomerName, setAnonCustomerName] = useState<string>('')
  const [anonPhone, setAnonPhone] = useState<string>('')
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD'>('CASH')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const hasGiftVoucher = Boolean(foundSale?.paymentType?.giftVoucher)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setSearchReceipt('')
      setIsLoading(false)
      setErrorMsg('')
      setSuccessMsg('')
      setFoundSale(null)
      setReturnItems({})
      setReason('')
      setAnonCustomerName('')
      setAnonPhone('')
      setRefundMethod('CASH')
      setIsSubmitting(false)

      setTimeout(() => {
        inputRef.current?.focus()
      }, 60)
    }
  }, [isOpen])

  if (!isOpen) return null

  // Fiş arama (Barkod okutulduğunda tüm '*' simgeleri temizlenir)
  const handleSearchSale = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawVal = inputRef.current?.value ?? searchReceipt
    const cleanSearch = (rawVal || '').trim().replace(/\*/g, '')
    if (!cleanSearch) return

    setSearchReceipt(cleanSearch)
    setIsLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    setFoundSale(null)
    setReturnItems({})

    try {
      // 1. Temizlenen barkod / fiş numarası ile ara
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

      // 2. Eşleşme yoksa sadece rakamlarla ara
      if (!hasMatch(data)) {
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

      // 3. Son fişleri çekip normalize ederek eşleştir
      if (!hasMatch(data)) {
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
        const initial: { [key: string]: number } = {}
        exact.items?.forEach((item: any) => {
          initial[item.id] = 0
        })
        setReturnItems(initial)

        // İade yöntemini satışın ödeme türüne göre varsayılan ayarla
        let pay = exact.paymentType || {}
        if (typeof pay === 'string') {
          try {
            pay = JSON.parse(pay)
          } catch {
            pay = {}
          }
        }
        if (typeof pay === 'object' && pay.card > 0 && (!pay.cash || pay.cash === 0)) {
          setRefundMethod('CARD')
        } else {
          setRefundMethod('CASH')
        }
      }
    } catch (err: any) {
      setErrorMsg(`Hata: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQtyChange = (saleItemId: string, maxAvailable: number, val: number) => {
    const validVal = Math.max(0, Math.min(maxAvailable, val))
    setReturnItems((prev) => ({
      ...prev,
      [saleItemId]: validVal,
    }))
  }

  const handleSelectAll = () => {
    if (!foundSale?.items) return
    const all: { [key: string]: number } = {}
    foundSale.items.forEach((item: any) => {
      const maxAvailable = item.quantity - (item.returnedQuantity || 0)
      all[item.id] = Math.max(0, maxAvailable)
    })
    setReturnItems(all)
  }

  const handleClearAll = () => {
    if (!foundSale?.items) return
    const zero: { [key: string]: number } = {}
    foundSale.items.forEach((item: any) => {
      zero[item.id] = 0
    })
    setReturnItems(zero)
  }

  // Toplam iade hesaplaması
  const totalRefund =
    foundSale?.items?.reduce((sum: number, item: any) => {
      const qty = returnItems[item.id] || 0
      return sum + qty * item.unitPrice
    }, 0) || 0

  const totalReturnCount = Object.values(returnItems).reduce((sum, q) => sum + q, 0)

  // İade edilebilir toplam ürün var mı kontrolü
  const totalAvailableInSale =
    foundSale?.items?.reduce((sum: number, item: any) => {
      return sum + Math.max(0, item.quantity - (item.returnedQuantity || 0))
    }, 0) || 0

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foundSale) return

    const itemsToSubmit = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([saleItemId, returnQuantity]) => ({ saleItemId, returnQuantity }))

    if (itemsToSubmit.length === 0) {
      setErrorMsg('Lütfen iade edilecek en az 1 adet ürün seçiniz.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const res = await fetch(`/api/sales/${foundSale.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSubmit,
          reason: reason.trim(),
          customerName: anonCustomerName.trim(),
          phone: anonPhone.trim(),
          refundMethod,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'İade işlemi kaydedilemedi.')
      }

      setSuccessMsg(
        `✅ İade başarıyla tamamlandı! ${totalReturnCount} adet ürün stoğa geri alındı ve ${totalRefund.toFixed(2)} ₺ kasadan düşüldü.`
      )
      notifyDataChanged()

      setTimeout(() => {
        setIsSubmitting(false)
        onClose()
      }, 1300)
    } catch (err: any) {
      setErrorMsg(`İade hatası: ${err.message}`)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans select-none">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-amber-700" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Fiş ile Ürün İadesi</h3>
              <span className="text-[11px] text-slate-500">
                Fiş barkodunu okutarak ürünleri stoğa geri alın ve kasadan tutarı düşün.
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
          {/* Search Barcode / Receipt Form */}
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
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                autoFocus
              />
              <button
                type="submit"
                disabled={isLoading || !searchReceipt.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs transition flex items-center space-x-1 disabled:opacity-50"
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

          {/* Found Sale View */}
          {foundSale && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              {/* Sale Info Card */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 font-mono text-sm">
                    Fiş: {foundSale.receiptNo}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(foundSale.createdAt).toLocaleDateString('tr-TR')}{' '}
                    {new Date(foundSale.createdAt).toLocaleTimeString('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    | Kasiyer: {foundSale.cashierName || 'Kasiyer'}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                    Fiş Tutarı
                  </span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {(Number(foundSale.totalAmount) || 0).toFixed(2)} ₺
                  </span>
                </div>
              </div>

              {/* Customer Info (Registered or Anonymous) */}
              {foundSale.customer ? (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Kayıtlı Müşteri:</span>
                  <span className="font-bold text-blue-900">
                    {foundSale.customer.firstName} {foundSale.customer.lastName} (
                    {foundSale.customer.phone})
                  </span>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center space-x-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>Anonim / Kayıtsız Fiş İadesi</span>
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Fişle İade Geçerli
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                    <input
                      type="text"
                      placeholder="Müşteri Adı (Opsiyonel)"
                      value={anonCustomerName}
                      onChange={(e) => setAnonCustomerName(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <input
                      type="text"
                      placeholder="Telefon (Opsiyonel)"
                      value={anonPhone}
                      onChange={(e) => setAnonPhone(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Check if fully returned */}
              {totalAvailableInSale <= 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center space-y-1">
                  <div className="font-bold text-amber-800 text-xs flex items-center justify-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Bu Fişteki Tüm Ürünler Daha Önce İade Edilmiş</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Fişte iade edilebilecek kalan ürün bulunmamaktadır.
                  </p>
                </div>
              ) : (
                <>
                  {/* Item List Header with Quick Select All */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      İade Edilecek Ürünleri Seçin:
                    </label>
                    <div className="space-x-2 text-[11px]">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-amber-800 hover:text-amber-950 font-bold hover:underline"
                      >
                        Tümünü Seç
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="text-slate-500 hover:text-slate-700 font-medium hover:underline"
                      >
                        Sıfırla
                      </button>
                    </div>
                  </div>

                  {/* Item List */}
                  <div className="space-y-2 max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {foundSale.items.map((item: any) => {
                      const returnedAlready = item.returnedQuantity || 0
                      const availableToReturn = item.quantity - returnedAlready
                      const currentReturnQty = returnItems[item.id] || 0
                      const isExhausted = availableToReturn <= 0

                      return (
                        <div
                          key={item.id}
                          className={`p-3 flex items-center justify-between space-x-3 transition ${
                            isExhausted
                              ? 'bg-slate-100 opacity-60 cursor-not-allowed'
                              : currentReturnQty > 0
                              ? 'bg-amber-50/50'
                              : 'bg-white'
                          }`}
                        >
                          <div className="flex-1 space-y-0.5">
                            <h4 className="font-bold text-slate-900 text-xs">
                              {item.variant?.product?.name || 'Ürün'}
                            </h4>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                              <span>
                                {item.variant?.attributes?.color || '-'} /{' '}
                                {item.variant?.attributes?.size || '-'}
                              </span>
                              <span>• {item.unitPrice.toFixed(2)} ₺</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Satın Alınan: {item.quantity} ad | Kalan İade Hakkı:{' '}
                              <span className="font-semibold text-slate-700">
                                {availableToReturn} ad
                              </span>
                            </div>
                          </div>

                          {isExhausted ? (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-semibold">
                              İade Edildi
                            </span>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <div className="flex items-center border border-slate-300 rounded overflow-hidden bg-white shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQtyChange(
                                      item.id,
                                      availableToReturn,
                                      currentReturnQty - 1
                                    )
                                  }
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={availableToReturn}
                                  value={currentReturnQty}
                                  onChange={(e) =>
                                    handleQtyChange(
                                      item.id,
                                      availableToReturn,
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                  className="w-10 text-center py-1 text-xs font-bold text-slate-900 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQtyChange(
                                      item.id,
                                      availableToReturn,
                                      currentReturnQty + 1
                                    )
                                  }
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                                >
                                  +
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono font-medium">
                                / max {availableToReturn}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Refund Method Selector (Kasadan Çıkış) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">
                      İade Ödeme Yöntemi (Kasadan Çıkış Şekli)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={hasGiftVoucher}
                onClick={() => setRefundMethod('CASH')}
                        className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                          refundMethod === 'CASH'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>Nakit Kasasından Çık</span>
                      </button>
                      <button
                        type="button"
                        disabled={hasGiftVoucher}
                onClick={() => setRefundMethod('CARD')}
                        className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                          refundMethod === 'CARD'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Kart / POS İptal</span>
                      </button>
                    </div>
                  </div>

                  {/* Return Reason */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase">
                      İade Nedeni (Opsiyonel)
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Beden uymadı, müşteri vazgeçti, kusurlu ürün..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                    />
                  </div>

                  {hasGiftVoucher && <p className="text-xs bg-purple-50 text-purple-800 p-3 rounded-lg">Çekle ödenen pay aynı çeke geri yüklenir. Nakit/kart payı ilk ödemedeki oranlarda iade edilir; çek tutarı nakit olarak ödenmez.</p>}
{/* Summary Card */}
                  <div className="flex items-center justify-between bg-amber-50/80 p-3 rounded-lg border border-amber-200">
                    <div className="flex items-center space-x-2">
                      <PackageCheck className="w-5 h-5 text-amber-700" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Stoğa İade: {totalReturnCount} Adet Ürün
                        </span>
                        <span className="text-[10px] text-amber-800">
                          {hasGiftVoucher ? 'İade, çek / nakit / kart paylarına göre yapılacak.' : <>Kasadan {refundMethod === 'CASH' ? 'nakit ödenecek' : 'kart iadesi düşülecek'}.</>}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                        Geri Ödenecek
                      </span>
                      <span className="text-base font-bold text-amber-800 font-mono">
                        {totalRefund.toFixed(2)} ₺
                      </span>
                    </div>
                  </div>
                </>
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
            disabled={!foundSale || totalReturnCount === 0 || isSubmitting}
            onClick={handleSubmitReturn}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition flex items-center space-x-1 disabled:opacity-50 shadow-xs"
          >
            <span>{isSubmitting ? 'İade İşleniyor...' : 'İadeyi Tamamla & Kasadan Düş'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
