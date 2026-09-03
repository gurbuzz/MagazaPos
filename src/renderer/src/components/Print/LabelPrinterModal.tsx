import React, { useState, useEffect, useRef } from 'react'
import { Printer, Sliders, CheckCircle, Search, Tag, Barcode, Check, PackageCheck, Filter } from 'lucide-react'

export const LabelPrinterModal: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null)
  const [labelTemplate, setLabelTemplate] = useState<'BARCODE_MINI' | 'SHELF_TAG' | 'TEXTILE_TAG'>('BARCODE_MINI')
  const [printQuantity, setPrintQuantity] = useState<number>(10)
  const [isPrinting, setIsPrinting] = useState<boolean>(false)
  const [message, setMessage] = useState<string>('')

  const [printers, setPrinters] = useState<any[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data)
          if (data.length > 0 && data[0].variants?.length > 0) {
            setSelectedVariant({ ...data[0].variants[0], product: data[0] })
          }
        }
      })
      .catch(() => {})

    fetch('/api/products/categories')
      .then((res) => res.json())
      .then((catData) => {
        if (Array.isArray(catData)) setCategories(catData)
      })
      .catch(() => {})

    if (window.electron?.getPrinters) {
      window.electron.getPrinters().then((printerList) => {
        setPrinters(printerList || [])
        const defaultPrinter = printerList.find((p: any) => p.isDefault)?.name || printerList[0]?.name || ''
        setSelectedPrinter(defaultPrinter)
      })
    }
  }, [])

  // Build flattened variant array
  const allVariants: any[] = []
  products.forEach((prod) => {
    if (selectedCategoryId && prod.categoryId !== selectedCategoryId) return

    if (Array.isArray(prod.variants)) {
      prod.variants.forEach((v: any) => {
        allVariants.push({
          ...v,
          product: prod,
          categoryName: prod.category?.name || 'Kategorisiz',
        })
      })
    }
  })

  // Filter variants by search term
  const filteredVariants = allVariants.filter((v) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      v.product.name.toLowerCase().includes(term) ||
      v.product.code.toLowerCase().includes(term) ||
      v.sku.toLowerCase().includes(term) ||
      (v.barcode && v.barcode.toLowerCase().includes(term)) ||
      (v.attributes?.color && v.attributes.color.toLowerCase().includes(term)) ||
      (v.attributes?.size && v.attributes.size.toLowerCase().includes(term))
    )
  })

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
        await window.electron.printSilent(labelHtml, selectedPrinter || undefined)
      } else {
        await fetch('/api/print/label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant: selectedVariant,
            quantity: printQuantity,
            labelType: labelTemplate,
            printerName: selectedPrinter,
          }),
        })
      }

      setMessage(`${printQuantity} Adet Etiket Termal Yazıcıya Gönderildi!`)
    } catch (err: any) {
      setMessage(`Yazdırma hatası: ${err.message}`)
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 p-5 overflow-y-auto font-sans select-none">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex justify-between items-center shadow-2xs">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Printer className="w-5 h-5 text-blue-700" />
              <span>Etiket & Barkod Basım Merkezi</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Ürün seçin, arayın veya barkod okutun; termal yazıcıdan anında baskı alın.
            </p>
          </div>

          {selectedVariant && (
            <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded flex items-center space-x-3 text-xs">
              <div className="text-right">
                <span className="text-[10px] text-blue-700 font-bold block uppercase">Seçili Ürün</span>
                <span className="font-bold text-slate-900">{selectedVariant.product?.name}</span>
              </div>
              <span className="text-emerald-700 font-extrabold text-sm">{selectedVariant.salePrice?.toFixed(2)} ₺</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Product Search & Selector (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-2xs flex flex-col h-[620px]">
            <h2 className="font-bold text-slate-900 text-xs flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="flex items-center space-x-1.5">
                <PackageCheck className="w-4 h-4 text-blue-700" />
                <span>Basılacak Ürünü Arayın ve Seçin ({filteredVariants.length} Varyant)</span>
              </span>
            </h2>

            {/* Search Input Box */}
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ürün adı, kod, renk, beden veya barkod okutun..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedCategoryId('')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition shrink-0 ${
                  !selectedCategoryId
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tümü ({allVariants.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition shrink-0 ${
                    selectedCategoryId === cat.id
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Scrollable Variant List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredVariants.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  Arama kriterlerine uygun ürün bulunamadı.
                </div>
              ) : (
                filteredVariants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 rounded border cursor-pointer transition flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-slate-50'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center space-x-2">
                            <span>{v.product.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                              {v.attributes?.color} / {v.attributes?.size}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center space-x-3">
                            <span>Barkod: <strong className="text-slate-700">{v.barcode}</strong></span>
                            <span>SKU: {v.sku}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-emerald-700 text-xs block">{v.salePrice?.toFixed(2)} ₺</span>
                        <span className="text-[10px] text-slate-500 font-medium">Stok: {v.stockQuantity} Adet</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Print Controls & Live Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Print Parameters Form */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5 shadow-2xs">
              <h2 className="font-bold text-slate-900 text-xs flex items-center space-x-2 border-b border-slate-200 pb-2">
                <Sliders className="w-4 h-4 text-blue-700" />
                <span>Yazıcı ve Şablon Ayarları</span>
              </h2>

              {/* Target Printer Selection */}
              {printers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hedef Termal Yazıcı</label>
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? '(Varsayılan Termal Yazıcı)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Label Template Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Etiket Şablonu</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setLabelTemplate('BARCODE_MINI')}
                    className={`p-2 rounded border text-center font-semibold text-[11px] transition ${
                      labelTemplate === 'BARCODE_MINI'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Ürün Barkod (40x20mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelTemplate('SHELF_TAG')}
                    className={`p-2 rounded border text-center font-semibold text-[11px] transition ${
                      labelTemplate === 'SHELF_TAG'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Raf Etiketi (70x40mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelTemplate('TEXTILE_TAG')}
                    className={`p-2 rounded border text-center font-semibold text-[11px] transition ${
                      labelTemplate === 'TEXTILE_TAG'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Tekstil Etiketi
                  </button>
                </div>
              </div>

              {/* Copy Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Baskı Adedi (Kopya)</label>
                <input
                  type="number"
                  value={printQuantity}
                  onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Dispatch Print Button */}
              <button
                disabled={isPrinting || !selectedVariant}
                onClick={handlePrintDispatch}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded shadow-sm transition flex items-center justify-center space-x-2 text-xs disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{isPrinting ? 'Yazdırılıyor...' : 'Termal Yazıcıya Gönder (Silent Print)'}</span>
              </button>

              {message && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center space-x-2 font-semibold">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{message}</span>
                </div>
              )}
            </div>

            {/* Live Label Preview */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col items-center justify-center space-y-2">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                Canlı Etiket Önizleme
              </span>

              {selectedVariant ? (
                <div className="w-full max-w-[240px] bg-slate-50 text-slate-900 rounded p-3 shadow-2xs border border-slate-300 font-sans text-center space-y-1 select-none">
                  <div className="font-bold text-xs truncate">{selectedVariant.product?.name || 'Ürün Adı'}</div>
                  <div className="text-[10px] text-slate-600 font-medium">
                    {selectedVariant.attributes?.color} / {selectedVariant.attributes?.size}
                  </div>

                  {/* Simulated Barcode */}
                  <div className="py-1 border-y border-dashed border-slate-400">
                    <div className="font-mono text-base font-bold tracking-widest leading-none text-slate-800">
                      ||| | |||| || |
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-slate-700 mt-0.5">
                      {selectedVariant.barcode}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-slate-900">
                    {selectedVariant.salePrice?.toFixed(2)} ₺
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-6">Sol taraftan ürün seçin</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
