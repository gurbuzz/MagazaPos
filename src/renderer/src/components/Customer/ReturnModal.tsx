import React, { useState, useEffect } from 'react'
import { X, RotateCcw, AlertTriangle, Check, PackageCheck, ShoppingBag } from 'lucide-react'

interface ReturnModalProps {
  isOpen: boolean
  onClose: () => void
  sale: any | null
  onSuccess: () => void
}

export const ReturnModal: React.FC<ReturnModalProps> = ({ isOpen, onClose, sale, onSuccess }) => {
  const [returnItems, setReturnItems] = useState<{ [saleItemId: string]: number }>({})
  const [reason, setReason] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  useEffect(() => {
    if (isOpen && sale) {
      // Initialize return quantities to 0
      const initial: { [key: string]: number } = {}
      sale.items?.forEach((item: any) => {
        initial[item.id] = 0
      })
      setReturnItems(initial)
      setReason('')
      setErrorMsg('')
    }
  }, [isOpen, sale])

  if (!isOpen || !sale) return null

  const handleQtyChange = (saleItemId: string, maxAvailable: number, val: number) => {
    const validVal = Math.max(0, Math.min(maxAvailable, val))
    setReturnItems((prev) => ({
      ...prev,
      [saleItemId]: validVal,
    }))
  }

  // Calculate total refund sum
  const totalRefund = sale.items?.reduce((sum: number, item: any) => {
    const qty = returnItems[item.id] || 0
    return sum + qty * item.unitPrice
  }, 0) || 0

  const totalReturnCount = Object.values(returnItems).reduce((sum, q) => sum + q, 0)

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault()

    const itemsToSubmit = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([saleItemId, returnQuantity]) => ({ saleItemId, returnQuantity }))

    if (itemsToSubmit.length === 0) {
      setErrorMsg('Lütfen iade edilecek en az 1 adet ürün giriniz.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const res = await fetch(`/api/sales/${sale.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToSubmit,
          reason: reason.trim(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setErrorMsg(err.error || 'İade işlemi gerçekleştirilemedi.')
        setIsSubmitting(false)
        return
      }

      setIsSubmitting(false)
      onSuccess()
      onClose()
    } catch (err: any) {
      setErrorMsg(`Hata: ${err.message}`)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans select-none">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Ürün İadesi & Stok Girişi</h3>
              <span className="text-[11px] text-slate-500 font-mono">Fiş No: {sale.receiptNo}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmitReturn} className="p-4 flex-1 flex flex-col overflow-hidden space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-medium flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Badge */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Müşteri:</span>
            <span className="font-bold text-slate-900">
              {sale.customer?.firstName} {sale.customer?.lastName} ({sale.customer?.phone})
            </span>
          </div>

          {/* Item List Table */}
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {sale.items?.map((item: any) => {
              const returnedAlready = item.returnedQuantity || 0
              const availableToReturn = item.quantity - returnedAlready
              const currentReturnQty = returnItems[item.id] || 0
              const isFullyReturned = availableToReturn <= 0

              return (
                <div key={item.id} className="p-3 flex items-center justify-between space-x-3 bg-white">
                  <div className="flex-1 space-y-0.5">
                    <h4 className="font-bold text-slate-900 text-xs">
                      {item.variant?.product?.name || 'Ürün'}
                    </h4>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                      <span>
                        ({item.variant?.attributes?.color || '-'} / {item.variant?.attributes?.size || '-'})
                      </span>
                      <span>• {item.unitPrice.toFixed(2)} ₺ / ad</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Satın Alınan: <span className="font-semibold text-slate-700">{item.quantity} ad</span> | Daha Önce İade: <span className="font-semibold text-amber-700">{returnedAlready} ad</span>
                    </div>
                  </div>

                  {isFullyReturned ? (
                    <span className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px] font-semibold">
                      Tamamı İade Edildi
                    </span>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-slate-500 font-medium">İade:</span>
                      <div className="flex items-center border border-slate-300 rounded overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, availableToReturn, currentReturnQty - 1)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={availableToReturn}
                          value={currentReturnQty}
                          onChange={(e) =>
                            handleQtyChange(item.id, availableToReturn, parseInt(e.target.value) || 0)
                          }
                          className="w-12 text-center py-1 text-xs font-bold text-slate-900 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, availableToReturn, currentReturnQty + 1)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
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

          {/* Optional Return Reason */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
              İade Nedeni (Opsiyonel)
            </label>
            <input
              type="text"
              placeholder="Örn: Beden küçük geldi, ürün değişimi yapıldı..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-600 font-medium"
            />
          </div>

          {/* Refund Summary & Action Buttons */}
          <div className="pt-2 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between bg-amber-50/80 p-3 rounded-lg border border-amber-200">
              <div className="flex items-center space-x-2">
                <PackageCheck className="w-5 h-5 text-amber-700" />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Stoğa İade Edilecek: {totalReturnCount} Adet Ürün
                  </span>
                  <span className="text-[10px] text-amber-800">
                    İade onaylandığında varyant stokları otomatik güncellenecektir.
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase font-semibold">Geri Ödenecek</span>
                <span className="text-base font-bold text-amber-800 font-mono">
                  {totalRefund.toFixed(2)} ₺
                </span>
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded transition"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={isSubmitting || totalReturnCount === 0}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded transition flex items-center justify-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isSubmitting ? 'İade İşleniyor...' : 'İadeyi Onayla & Stoğa Ekle'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
