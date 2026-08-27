import React, { useState } from 'react'
import { X, CreditCard, Banknote, CheckCircle, Printer } from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { cartItems, discountAmount, getTotal, getSubtotal, cashierName, clearCart } = usePosStore()

  const [paymentMode, setPaymentMode] = useState<'CASH' | 'CARD' | 'SPLIT'>('CASH')
  const [cashAmount, setCashAmount] = useState<number>(0)
  const [cardAmount, setCardAmount] = useState<number>(0)
  const [givenCash, setGivenCash] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [completedSale, setCompletedSale] = useState<any>(null)

  if (!isOpen) return null

  const total = getTotal()

  const handleModeChange = (mode: 'CASH' | 'CARD' | 'SPLIT') => {
    setPaymentMode(mode)
    if (mode === 'CASH') {
      setCashAmount(total)
      setCardAmount(0)
    } else if (mode === 'CARD') {
      setCashAmount(0)
      setCardAmount(total)
    } else {
      setCashAmount(Math.round(total / 2))
      setCardAmount(Math.round(total / 2))
    }
  }

  const handleCheckoutSubmit = async () => {
    setIsProcessing(true)
    try {
      const payload = {
        items: cartItems,
        totalAmount: total,
        discountAmount,
        cashierName,
        paymentType:
          paymentMode === 'CASH'
            ? { cash: total, card: 0 }
            : paymentMode === 'CARD'
            ? { cash: 0, card: total }
            : { cash: cashAmount, card: cardAmount },
      }

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        alert(`Hata: ${err.error}`)
        setIsProcessing(false)
        return
      }

      const saleData = await res.json()
      setCompletedSale(saleData)
      setIsProcessing(false)
    } catch (err: any) {
      alert(`Tahsilat sırasında hata oluştu: ${err.message}`)
      setIsProcessing(false)
    }
  }

  const handleFinish = () => {
    clearCart()
    setCompletedSale(null)
    onSuccess()
    onClose()
  }

  const handlePrintReceipt = () => {
    if (!completedSale) return
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
            <h3>MAĞAZA POS</h3>
            <p>Fiş No: ${completedSale.receiptNo}</p>
            <p>Tarih: ${new Date().toLocaleString('tr-TR')}</p>
          </div>
          <div style="margin-top: 10px;">
            ${cartItems
              .map(
                (item) => `
              <div class="item">
                <span>${item.productName} (${item.attributes.color || ''} ${item.attributes.size || ''}) x${item.quantity}</span>
                <span>${item.totalPrice.toFixed(2)} TL</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="total">
            <div class="item"><span>Ara Toplam:</span><span>${getSubtotal().toFixed(2)} TL</span></div>
            <div class="item"><span>İndirim:</span><span>-${discountAmount.toFixed(2)} TL</span></div>
            <div class="item" style="font-size: 14px;"><span>GENEL TOPLAM:</span><span>${total.toFixed(2)} TL</span></div>
          </div>
          <div class="header" style="border-bottom: none; border-top: 1px dashed #000; margin-top: 10px;">
            <p>Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz!</p>
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

  const changeDue = parseFloat(givenCash || '0') - total

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h2 className="font-bold text-slate-900 text-sm">
            {completedSale ? 'Ödeme Tamamlandı' : 'Ödeme ve Tahsilat'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        {!completedSale ? (
          <div className="p-5 space-y-4">
            {/* Total Display */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3.5 text-center">
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                Ödenecek Toplam Tutar
              </span>
              <div className="text-2xl font-bold text-emerald-700 mt-0.5">
                {total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-tight">
                Ödeme Yöntemi
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('CASH')}
                  className={`p-3 rounded border flex flex-col items-center space-y-1.5 transition ${
                    paymentMode === 'CASH'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  <span className="text-xs">Nakit</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('CARD')}
                  className={`p-3 rounded border flex flex-col items-center space-y-1.5 transition ${
                    paymentMode === 'CARD'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-xs">Kredi Kartı</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('SPLIT')}
                  className={`p-3 rounded border flex flex-col items-center space-y-1.5 transition ${
                    paymentMode === 'SPLIT'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex space-x-1">
                    <Banknote className="w-4 h-4" />
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <span className="text-xs">Parçalı Ödeme</span>
                </button>
              </div>
            </div>

            {/* Inputs based on Mode */}
            {paymentMode === 'CASH' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Müşteriden Alınan Nakit (TL)
                </label>
                <input
                  type="number"
                  placeholder={total.toString()}
                  value={givenCash}
                  onChange={(e) => setGivenCash(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-bold text-base focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
                {givenCash && changeDue >= 0 && (
                  <div className="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded flex justify-between items-center">
                    <span>Para Üstü:</span>
                    <span className="font-bold text-sm">{changeDue.toFixed(2)} ₺</span>
                  </div>
                )}
              </div>
            )}

            {paymentMode === 'SPLIT' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nakit Tutar</label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Kart Tutar</label>
                  <input
                    type="number"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            )}

            {/* Action Submit Button */}
            <button
              disabled={isProcessing}
              onClick={handleCheckoutSubmit}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-sm transition flex items-center justify-center space-x-2 text-xs disabled:opacity-50 mt-2"
            >
              {isProcessing ? (
                <span>İşleniyor...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Tahsilatı Tamamla ve Fiş Kes</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Sale Success Screen */
          <div className="p-5 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Satış İşlemi Başarılı!</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Fiş No: {completedSale.receiptNo}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded p-3 text-left text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Ödeme Şekli:</span>
                <span className="font-semibold text-slate-900">{paymentMode}</span>
              </div>
              <div className="flex justify-between">
                <span>Tahsil Edilen Toplam:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {completedSale.totalAmount.toFixed(2)} ₺
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handlePrintReceipt}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded transition flex items-center justify-center space-x-1.5 text-xs border border-slate-300"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                <span>Fiş / Fatura Yazdır</span>
              </button>

              <button
                onClick={handleFinish}
                className="py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded transition shadow-2xs text-xs"
              >
                <span>Yeni Satışa Geç</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
