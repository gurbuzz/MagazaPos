import React, { useState, useEffect } from 'react'
import { Printer, Sliders, CheckCircle } from 'lucide-react'

export const LabelPrinterModal: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null)
  const [labelTemplate, setLabelTemplate] = useState<'BARCODE_MINI' | 'SHELF_TAG' | 'TEXTILE_TAG'>('BARCODE_MINI')
  const [printQuantity, setPrintQuantity] = useState<number>(10)
  const [isPrinting, setIsPrinting] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        setProducts(data || [])
        if (data.length > 0 && data[0].variants?.length > 0) {
          setSelectedVariant({ ...data[0].variants[0], product: data[0] })
        }
      })
      .catch(() => {})
  }, [])

  const handlePrintDispatch = async () => {
    if (!selectedVariant) return
    setIsPrinting(true)
    setMessage('')

    try {
      const labelHtml = `
        <html>
          <head>
            <style>
              @page { size: 50mm 30mm; margin: 0; }
              body { font-family: sans-serif; width: 50mm; height: 30mm; padding: 2mm; box-sizing: border-box; text-align: center; }
              .title { font-size: 10px; font-weight: bold; margin-bottom: 2px; }
              .price { font-size: 14px; font-weight: bold; margin-top: 2px; }
              .attr { font-size: 8px; color: #333; }
              .barcode-box { font-family: monospace; font-size: 12px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; margin: 2px 0; }
            </style>
          </head>
          <body>
            <div class="title">${selectedVariant.product?.name || 'Ürün'}</div>
            <div class="attr">SKU: ${selectedVariant.sku}</div>
            <div class="attr">Renk: ${selectedVariant.attributes?.color || ''} | Beden: ${selectedVariant.attributes?.size || ''}</div>
            <div class="barcode-box">|||||| |||| ||||||<br>${selectedVariant.barcode}</div>
            <div class="price">${selectedVariant.salePrice.toFixed(2)} TL</div>
          </body>
        </html>
      `

      if (window.electron?.printSilent) {
        await window.electron.printSilent(labelHtml)
      } else {
        await fetch('/api/print/label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant: selectedVariant,
            quantity: printQuantity,
            labelType: labelTemplate,
          }),
        })
      }

      setMessage(`${printQuantity} Adet Etiket Başarıyla Termal Yazıcıya Gönderildi!`)
    } catch (err: any) {
      setMessage(`Yazdırma hatası: ${err.message}`)
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-slate-100 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex justify-between items-center shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center space-x-2">
              <Printer className="w-6 h-6 text-indigo-600" />
              <span>Toplu Barkod & Termal Raf Etiketi Basımı</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tarayıcı diyaloğu olmadan arka planda doğrudan termal yazıcıya (ZPL/RAW) baskı gönderin.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls Form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2 border-b border-slate-200 pb-3">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Etiket Parametreleri</span>
            </h2>

            {/* Select Product Variant */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Basılacak Ürün / Varyant</label>
              <select
                onChange={(e) => {
                  const [pId, vId] = e.target.value.split(':')
                  const p = products.find((prod) => prod.id === pId)
                  const v = p?.variants?.find((variant: any) => variant.id === vId)
                  if (v) setSelectedVariant({ ...v, product: p })
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {products.map((p) =>
                  p.variants?.map((v: any) => (
                    <option key={v.id} value={`${p.id}:${v.id}`}>
                      {p.name} - ({v.attributes?.color} / {v.attributes?.size}) [Barkod: {v.barcode}]
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Label Template Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Etiket Şablonu</label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLabelTemplate('BARCODE_MINI')}
                  className={`p-2.5 rounded-xl border text-center font-bold transition ${
                    labelTemplate === 'BARCODE_MINI'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Ürün Barkod (40x20mm)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelTemplate('SHELF_TAG')}
                  className={`p-2.5 rounded-xl border text-center font-bold transition ${
                    labelTemplate === 'SHELF_TAG'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Raf Etiketi (70x40mm)
                </button>
                <button
                  type="button"
                  onClick={() => setLabelTemplate('TEXTILE_TAG')}
                  className={`p-2.5 rounded-xl border text-center font-bold transition ${
                    labelTemplate === 'TEXTILE_TAG'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tekstil Etiketi
                </button>
              </div>
            </div>

            {/* Copy Quantity */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Baskı Adedi (Kopya)</label>
              <input
                type="number"
                value={printQuantity}
                onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 text-slate-900 font-extrabold text-base"
              />
            </div>

            {/* Dispatch Print Button */}
            <button
              disabled={isPrinting || !selectedVariant}
              onClick={handlePrintDispatch}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
            >
              <Printer className="w-5 h-5" />
              <span>{isPrinting ? 'Yazdırılıyor...' : 'Termal Yazıcıya Gönder (Silent Print)'}</span>
            </button>

            {message && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center space-x-2 font-bold">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}
          </div>

          {/* Live Label Preview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm flex flex-col items-center justify-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Canlı Etiket Önizleme
            </span>

            {selectedVariant ? (
              <div className="w-64 bg-slate-50 text-slate-900 rounded-xl p-4 shadow-md border border-slate-300 font-sans text-center space-y-2 select-none">
                <div className="font-extrabold text-xs truncate">{selectedVariant.product?.name || 'Ürün Adı'}</div>
                <div className="text-[10px] text-slate-600 font-medium">
                  Renk: {selectedVariant.attributes?.color} | Beden: {selectedVariant.attributes?.size}
                </div>

                {/* Simulated Barcode */}
                <div className="py-2 border-y border-dashed border-slate-400">
                  <div className="font-mono text-xl font-black tracking-widest leading-none text-slate-800">
                    ||| | |||| || |
                  </div>
                  <div className="font-mono text-[10px] font-bold text-slate-700 mt-1">
                    {selectedVariant.barcode}
                  </div>
                </div>

                <div className="text-lg font-black text-slate-900">
                  {selectedVariant.salePrice.toFixed(2)} ₺
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Ürün seçilmedi</p>
            )}

            <span className="text-[11px] text-slate-400 text-center max-w-xs font-medium">
              Seçilen thermal etiket yazıcısına RAW veri veya silent HTML olarak aktarılır.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
