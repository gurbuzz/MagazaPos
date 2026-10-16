import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Printer,
  Sliders,
  CheckCircle,
  Search,
  Tag,
  Barcode,
  Check,
  PackageCheck,
  Filter,
  RectangleHorizontal,
  RectangleVertical,
  ArrowLeftRight,
  Layers,
  Sparkles,
  Store,
  RefreshCw,
  Copy
} from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'
import { generateCode128Svg } from '../../utils/barcode128'

interface LabelPreset {
  id: string
  name: string
  width: number
  height: number
  orientation: 'HORIZONTAL' | 'VERTICAL'
  description: string
}

const PRESETS: LabelPreset[] = [
  // Yatay Baskı Şablonları (Horizontal)
  {
    id: 'h_50_30',
    name: '50 x 30 mm',
    width: 50,
    height: 30,
    orientation: 'HORIZONTAL',
    description: 'Standart Yatay Barkod (En Popüler)'
  },
  {
    id: 'h_40_20',
    name: '40 x 20 mm',
    width: 40,
    height: 20,
    orientation: 'HORIZONTAL',
    description: 'Kompakt / Mini Barkod'
  },
  {
    id: 'h_60_40',
    name: '60 x 40 mm',
    width: 60,
    height: 40,
    orientation: 'HORIZONTAL',
    description: 'Geniş Ürün Etiketi'
  },
  {
    id: 'h_70_40',
    name: '70 x 40 mm',
    width: 70,
    height: 40,
    orientation: 'HORIZONTAL',
    description: 'Büyük Raf / İndirim Etiketi'
  },

  // Dikey Baskı Şablonları (Vertical)
  {
    id: 'v_30_50',
    name: '30 x 50 mm',
    width: 30,
    height: 50,
    orientation: 'VERTICAL',
    description: 'Standart Dikey Tekstil'
  },
  {
    id: 'v_40_60',
    name: '40 x 60 mm',
    width: 40,
    height: 60,
    orientation: 'VERTICAL',
    description: 'Tekstil & Sallama Etiketi'
  },
  {
    id: 'v_40_80',
    name: '40 x 80 mm',
    width: 40,
    height: 80,
    orientation: 'VERTICAL',
    description: 'Uzun Askı & Beden Kartı'
  },
  {
    id: 'v_50_70',
    name: '50 x 70 mm',
    width: 50,
    height: 70,
    orientation: 'VERTICAL',
    description: 'Büyük Fiyat & Ürün Kartı'
  }
]

export const LabelPrinterModal: React.FC = () => {
  const { storeName } = usePosStore()
  const effectiveStoreName = storeName || 'LUFIAN'

  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null)

  // Orientation & Dimensions State
  const [orientation, setOrientation] = useState<'HORIZONTAL' | 'VERTICAL'>('HORIZONTAL')
  const [selectedPresetId, setSelectedPresetId] = useState<string>('h_50_30')
  const [labelWidth, setLabelWidth] = useState<number>(50)
  const [labelHeight, setLabelHeight] = useState<number>(30)
  const [showStoreName, setShowStoreName] = useState<boolean>(true)

  // Print controls
  const [printQuantity, setPrintQuantity] = useState<number>(1)
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

  // Switch Orientation
  const handleOrientationChange = (newOrientation: 'HORIZONTAL' | 'VERTICAL') => {
    if (newOrientation === orientation) return
    setOrientation(newOrientation)

    if (newOrientation === 'HORIZONTAL') {
      const preset = PRESETS.find((p) => p.id === 'h_50_30') || PRESETS[0]
      setSelectedPresetId(preset.id)
      setLabelWidth(preset.width)
      setLabelHeight(preset.height)
    } else {
      const preset = PRESETS.find((p) => p.id === 'v_30_50') || PRESETS[4]
      setSelectedPresetId(preset.id)
      setLabelWidth(preset.width)
      setLabelHeight(preset.height)
    }
  }

  // Choose preset
  const handleSelectPreset = (preset: LabelPreset) => {
    setSelectedPresetId(preset.id)
    setOrientation(preset.orientation)
    setLabelWidth(preset.width)
    setLabelHeight(preset.height)
  }

  // Swap Width and Height
  const handleSwapDimensions = () => {
    const newWidth = labelHeight
    const newHeight = labelWidth
    const newOrientation = newWidth >= newHeight ? 'HORIZONTAL' : 'VERTICAL'

    setLabelWidth(newWidth)
    setLabelHeight(newHeight)
    setOrientation(newOrientation)

    const matching = PRESETS.find((p) => p.width === newWidth && p.height === newHeight)
    setSelectedPresetId(matching ? matching.id : 'custom')
  }

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

  // SVG Barcode for Live Preview
  const previewBarcodeSvg = useMemo(() => {
    if (!selectedVariant) return ''
    const code = selectedVariant.barcode || selectedVariant.sku || '123456789012'
    const svgHeight = orientation === 'HORIZONTAL'
      ? Math.max(18, Math.min(26, Math.round(labelHeight * 0.75)))
      : Math.max(22, Math.min(32, Math.round(labelHeight * 0.45)))
    return generateCode128Svg(code, svgHeight)
  }, [selectedVariant, orientation, labelHeight])

  // Build Full HTML Document for Silent Thermal Printing
  const buildPrintHtml = (copiesCount: number) => {
    if (!selectedVariant) return ''

    const barcode = selectedVariant.barcode || selectedVariant.sku || '123456789012'
    const price = Number(selectedVariant.salePrice || 0).toFixed(2)
    const productName = selectedVariant.product?.name || 'Ürün Adı'
    const color = selectedVariant.attributes?.color || '-'
    const size = selectedVariant.attributes?.size || '-'
    const sku = selectedVariant.sku || '-'

    const svgHeight = orientation === 'HORIZONTAL'
      ? Math.max(16, Math.min(26, Math.round(labelHeight * 0.75)))
      : Math.max(20, Math.min(32, Math.round(labelHeight * 0.45)))

    const vectorBarcodeSvg = generateCode128Svg(barcode, svgHeight)

    const singlePageContent = orientation === 'HORIZONTAL'
      ? `
        <div class="label-page horizontal">
          <div class="h-header">
            <span class="store-name">${showStoreName ? effectiveStoreName : ''}</span>
            <span class="sku-text">${sku ? `KOD: ${sku}` : ''}</span>
          </div>
          <div class="product-title">${productName}</div>
          <div class="variant-info">Renk: ${color} | Beden: ${size}</div>
          <div class="barcode-wrap">
            <div class="svg-container">${vectorBarcodeSvg}</div>
            <div class="barcode-number">${barcode}</div>
          </div>
          <div class="price-row">
            <span class="kdv-tag">KDV DAHİLDİR</span>
            <span class="price-val">${price} TL</span>
          </div>
        </div>
      `
      : `
        <div class="label-page vertical">
          <div class="v-header">
            <div class="store-name">${showStoreName ? effectiveStoreName : ''}</div>
          </div>
          <div class="product-title">${productName}</div>
          <div class="attributes-grid">
            <div class="attr-row"><span class="attr-lbl">RENK:</span> <span class="attr-val">${color}</span></div>
            <div class="attr-row"><span class="attr-lbl">BEDEN:</span> <span class="attr-val">${size}</span></div>
            <div class="attr-row"><span class="attr-lbl">KOD:</span> <span class="attr-val">${sku}</span></div>
          </div>
          <div class="barcode-wrap">
            <div class="svg-container">${vectorBarcodeSvg}</div>
            <div class="barcode-number">${barcode}</div>
          </div>
          <div class="price-box">
            <div class="price-label">FİYAT (KDV DAHİL)</div>
            <div class="price-val">${price} TL</div>
          </div>
        </div>
      `

    const allPagesHtml = Array.from({ length: copiesCount })
      .map(() => singlePageContent)
      .join('')

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Termal Etiket Baskı</title>
          <style>
            @page {
              size: ${labelWidth}mm ${labelHeight}mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            html, body {
              width: 100%;
              margin: 0;
              padding: 0;
              background-color: #ffffff !important;
              color: #000000 !important;
              font-family: Arial, Helvetica, sans-serif;
            }
            .label-page {
              width: ${labelWidth}mm;
              height: ${labelHeight}mm;
              overflow: hidden;
              page-break-after: always;
              break-after: page;
              background-color: #ffffff !important;
              color: #000000 !important;
            }

            /* YATAY (HORIZONTAL) STİL */
            .horizontal {
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
            }
            .horizontal .h-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              font-weight: 800;
              border-bottom: 0.6px solid #000;
              padding-bottom: 1px;
            }
            .horizontal .store-name {
              text-transform: uppercase;
              font-weight: 900;
              letter-spacing: 0.5px;
            }
            .horizontal .sku-text {
              font-family: 'Courier New', monospace;
              font-size: 7.5px;
              font-weight: bold;
            }
            .horizontal .product-title {
              font-size: 9.5px;
              font-weight: 900;
              line-height: 1.15;
              max-height: 22px;
              overflow: hidden;
              margin: 1px 0;
              color: #000;
            }
            .horizontal .variant-info {
              font-size: 8px;
              font-weight: bold;
              color: #000;
            }
            .horizontal .barcode-wrap {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin: 1px 0;
            }
            .horizontal .svg-container {
              width: 92%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .horizontal .barcode-number {
              font-family: 'Courier New', monospace;
              font-size: 8.5px;
              font-weight: 900;
              letter-spacing: 1.5px;
              margin-top: 1px;
              color: #000;
            }
            .horizontal .price-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-top: 0.8px solid #000;
              padding-top: 1.5px;
            }
            .horizontal .kdv-tag {
              font-size: 7px;
              font-weight: bold;
            }
            .horizontal .price-val {
              font-size: 13.5px;
              font-weight: 900;
              letter-spacing: -0.5px;
              line-height: 1;
            }

            /* DİKEY (VERTICAL) STİL */
            .vertical {
              padding: 2mm 2.2mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
            }
            .vertical .v-header {
              border-bottom: 1.5px solid #000;
              padding-bottom: 1.5px;
              margin-bottom: 2px;
            }
            .vertical .store-name {
              font-size: 10.5px;
              font-weight: 900;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .vertical .product-title {
              font-size: 10px;
              font-weight: 900;
              line-height: 1.15;
              margin: 1px 0;
              color: #000;
            }
            .vertical .attributes-grid {
              border: 1px solid #000;
              border-radius: 2px;
              padding: 2.5px 3.5px;
              margin: 2px 0;
              font-size: 8.5px;
              text-align: left;
            }
            .vertical .attr-row {
              display: flex;
              justify-content: space-between;
              line-height: 1.25;
            }
            .vertical .attr-lbl {
              font-weight: 700;
            }
            .vertical .attr-val {
              font-weight: 900;
            }
            .vertical .barcode-wrap {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin: 2px 0;
            }
            .vertical .svg-container {
              width: 95%;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .vertical .barcode-number {
              font-family: 'Courier New', monospace;
              font-size: 9px;
              font-weight: 900;
              letter-spacing: 1.5px;
              margin-top: 1px;
            }
            .vertical .price-box {
              border: 1.5px solid #000;
              background-color: #fff;
              padding: 2.5px;
              margin-top: 2px;
            }
            .vertical .price-label {
              font-size: 7px;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            .vertical .price-val {
              font-size: 15.5px;
              font-weight: 900;
              letter-spacing: -0.5px;
              line-height: 1.1;
            }
          </style>
        </head>
        <body>
          ${allPagesHtml}
        </body>
      </html>
    `
  }

  // Print Dispatch (Copies or 1-piece test, with silent or native dialog option)
  const handlePrintDispatch = async (quantityToPrint = printQuantity, isSilent = true) => {
    if (!selectedVariant) return
    setIsPrinting(true)
    setMessage('')

    try {
      const labelHtml = buildPrintHtml(quantityToPrint)

      if (window.electron?.printSilent) {
        const result = await window.electron.printSilent(
          labelHtml,
          selectedPrinter ? selectedPrinter.trim() : undefined,
          {
            width: labelWidth,
            height: labelHeight
          },
          isSilent
        )
        if (result && !result.success && result.failureReason) {
          throw new Error(result.failureReason)
        }
      } else {
        await fetch('/api/print/label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            variant: selectedVariant,
            quantity: quantityToPrint,
            orientation,
            width: labelWidth,
            height: labelHeight,
            printerName: selectedPrinter,
          }),
        })

        const printWin = window.open('', '_blank')
        if (printWin) {
          printWin.document.write(labelHtml)
          printWin.document.close()
          setTimeout(() => {
            printWin.focus()
            printWin.print()
            printWin.close()
          }, 350)
        }
      }

      setMessage(
        `${quantityToPrint} Adet ${orientation === 'HORIZONTAL' ? 'Yatay' : 'Dikey'} (${labelWidth}x${labelHeight}mm) Etiket Yazıcıya Gönderildi!`
      )
    } catch (err: any) {
      setMessage(`Yazdırma hatası: ${err.message}`)
    } finally {
      setIsPrinting(false)
    }
  }

  const currentPresets = PRESETS.filter((p) => p.orientation === orientation)

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 p-4 overflow-y-auto font-sans select-none">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap justify-between items-center shadow-xs gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Printer className="w-5 h-5 text-blue-700" />
              <span>Etiket & Barkod Basım Merkezi</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Termal rulo yazıcılar için yatay ve dikey baskı seçenekleri, vektör barkod ve anlık önizleme.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center space-x-2 text-xs">
              <Store className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-slate-600 font-medium">Mağaza:</span>
              <span className="font-bold text-slate-900 uppercase">{effectiveStoreName}</span>
            </div>

            {selectedVariant && (
              <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center space-x-3 text-xs">
                <div className="text-right">
                  <span className="text-[10px] text-blue-700 font-bold block uppercase">Seçili Ürün</span>
                  <span className="font-bold text-slate-900 truncate max-w-[150px] inline-block align-bottom">
                    {selectedVariant.product?.name}
                  </span>
                </div>
                <span className="text-emerald-700 font-extrabold text-sm">{selectedVariant.salePrice?.toFixed(2)} ₺</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Product Search & Variant Selector (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs flex flex-col h-[650px]">
            <h2 className="font-bold text-slate-900 text-xs flex items-center justify-between border-b border-slate-100 pb-2">
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
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
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
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-xs scrollbar-none">
              <button
                onClick={() => setSelectedCategoryId('')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition shrink-0 ${
                  !selectedCategoryId
                    ? 'bg-blue-700 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tümü ({allVariants.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition shrink-0 ${
                    selectedCategoryId === cat.id
                      ? 'bg-blue-700 text-white shadow-2xs'
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
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                  <Tag className="w-8 h-8 stroke-1 text-slate-300" />
                  <span>Arama kriterlerine uygun ürün bulunamadı.</span>
                </div>
              ) : (
                filteredVariants.map((v) => {
                  const isSelected = selectedVariant?.id === v.id
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-500 shadow-2xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-slate-50'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center space-x-2">
                            <span>{v.product.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold">
                              {v.attributes?.color || '-'} / {v.attributes?.size || '-'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center space-x-3">
                            <span>Barkod: <strong className="text-slate-800">{v.barcode}</strong></span>
                            <span>SKU: {v.sku}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-emerald-700 text-xs block">{v.salePrice?.toFixed(2)} ₺</span>
                        <span className="text-[10px] text-slate-500 font-medium">Stok: {v.stockQuantity} Adet</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Print Settings & Live Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Print Parameters Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 shadow-xs">
              <h2 className="font-bold text-slate-900 text-xs flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-blue-700" />
                  <span>Yazıcı ve Etiket Yönlendirme</span>
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                  {labelWidth} x {labelHeight} mm
                </span>
              </h2>

              {/* Target Printer Selection */}
              {printers.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hedef Termal Yazıcı</label>
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">-- Windows Varsayılan Yazıcısı (Otomatik) --</option>
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} {p.isDefault ? '(Varsayılan Termal Yazıcı)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Baskı Yönü Seçimi (Orientation Segmented Toggle) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Baskı Yönü</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOrientationChange('HORIZONTAL')}
                    className={`py-2 px-3 rounded-lg border flex items-center justify-center space-x-2 transition text-xs font-bold ${
                      orientation === 'HORIZONTAL'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <RectangleHorizontal className="w-4 h-4" />
                    <span>↔ Yatay Baskı</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOrientationChange('VERTICAL')}
                    className={`py-2 px-3 rounded-lg border flex items-center justify-center space-x-2 transition text-xs font-bold ${
                      orientation === 'VERTICAL'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <RectangleVertical className="w-4 h-4" />
                    <span>↕ Dikey Baskı</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  {orientation === 'HORIZONTAL'
                    ? 'Yatay rulo etiketler için uygundur (Raf, kutu ve standart ürün barkodu).'
                    : 'Dikey rulo ve askılı tekstil etiketleri için uygundur (Sallama ve giyim kartları).'}
                </p>
              </div>

              {/* Boyut Şablonları (Presets for selected orientation) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {orientation === 'HORIZONTAL' ? 'Yatay Ölçü Şablonları' : 'Dikey Ölçü Şablonları'}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {currentPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-1.5 rounded-lg border text-left text-xs transition ${
                        selectedPresetId === preset.id
                          ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[11px]">{preset.name}</span>
                        {selectedPresetId === preset.id && <Check className="w-3 h-3 text-blue-600" />}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Dimensions (Width / Height mm) & Dimension Swap */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Özel Boyut Ayarı (Milimetre)</span>
                  <button
                    type="button"
                    onClick={handleSwapDimensions}
                    className="flex items-center space-x-1 text-[11px] text-blue-700 hover:text-blue-800 font-bold bg-white px-2 py-0.5 rounded border border-blue-200 shadow-2xs hover:bg-blue-50 transition"
                    title="Genişlik ve Yüksekliği Değiş-Tokuş Et"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>W ⇄ H Çevir</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Genişlik (mm)</label>
                    <input
                      type="number"
                      min={15}
                      max={150}
                      value={labelWidth}
                      onChange={(e) => {
                        const val = Math.max(10, parseInt(e.target.value) || 10)
                        setLabelWidth(val)
                        setSelectedPresetId('custom')
                        if (val < labelHeight && orientation !== 'VERTICAL') setOrientation('VERTICAL')
                        if (val > labelHeight && orientation !== 'HORIZONTAL') setOrientation('HORIZONTAL')
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-900 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Yükseklik (mm)</label>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={labelHeight}
                      onChange={(e) => {
                        const val = Math.max(10, parseInt(e.target.value) || 10)
                        setLabelHeight(val)
                        setSelectedPresetId('custom')
                        if (val > labelWidth && orientation !== 'VERTICAL') setOrientation('VERTICAL')
                        if (val < labelWidth && orientation !== 'HORIZONTAL') setOrientation('HORIZONTAL')
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-900 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center space-x-1.5 text-[11px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStoreName}
                      onChange={(e) => setShowStoreName(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Mağaza Adını Etikette Göster ({effectiveStoreName})</span>
                  </label>
                </div>
              </div>

              {/* Baskı Adedi (Quantity Selection with Quick Chips) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Baskı Adedi (Kopya)</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={printQuantity}
                    onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 font-extrabold text-sm focus:outline-none focus:ring-1 focus:ring-blue-600 text-center"
                  />
                  <div className="flex items-center space-x-1">
                    {[1, 5, 10, 20, 50].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setPrintQuantity(qty)}
                        className={`px-2 py-1 rounded text-xs font-bold transition ${
                          printQuantity === qty
                            ? 'bg-blue-700 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Main Print, Windows Dialog & 1-Piece Test Print */}
              <div className="pt-1 space-y-2">
                <button
                  disabled={isPrinting || !selectedVariant}
                  onClick={() => handlePrintDispatch(printQuantity, true)}
                  className="w-full py-2.5 bg-[#00268A] hover:bg-[#001f70] text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-2 text-xs disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {isPrinting
                      ? 'Yazdırılıyor...'
                      : `${printQuantity} Adet ${orientation === 'HORIZONTAL' ? 'Yatay' : 'Dikey'} Etiket Yazdır`}
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={isPrinting || !selectedVariant}
                    onClick={() => handlePrintDispatch(printQuantity, false)}
                    className="py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded-lg border border-blue-200 transition flex items-center justify-center space-x-1.5 text-[11px] disabled:opacity-50"
                    title="Windows'un kendi yazdırma penceresini açar; kağıt boyutu ve önizlemeyi doğrulamanızı sağlar"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-700" />
                    <span>Windows Diyaloğu Aç</span>
                  </button>

                  <button
                    disabled={isPrinting || !selectedVariant}
                    onClick={() => handlePrintDispatch(1, true)}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 transition flex items-center justify-center space-x-1.5 text-[11px] disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>1 Adet Test Baskısı</span>
                  </button>
                </div>
              </div>

              {message && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center space-x-2 font-semibold">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{message}</span>
                </div>
              )}
            </div>

            {/* Live Label Preview Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col items-center justify-center space-y-3">
              <div className="w-full flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Canlı Termal Etiket Önizleme</span>
                </span>
                <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-200">
                  {orientation === 'HORIZONTAL' ? '↔ Yatay' : '↕ Dikey'} ({labelWidth}x{labelHeight}mm)
                </span>
              </div>

              {selectedVariant ? (
                <div className="py-2 flex justify-center w-full">
                  {/* Dynamic Scaled Thermal Label Preview */}
                  <div
                    className="bg-white text-black border-2 border-slate-800 rounded shadow-md overflow-hidden flex flex-col justify-between select-none transition-all duration-200"
                    style={{
                      width: orientation === 'HORIZONTAL' ? '280px' : '220px',
                      aspectRatio: `${labelWidth} / ${labelHeight}`,
                      padding: orientation === 'HORIZONTAL' ? '10px 12px' : '12px 10px',
                    }}
                  >
                    {orientation === 'HORIZONTAL' ? (
                      /* YATAY CANLI ÖNİZLEME */
                      <div className="h-full flex flex-col justify-between text-center">
                        <div className="flex justify-between items-center text-[10px] font-extrabold border-b border-black pb-0.5">
                          <span className="uppercase tracking-wider">{showStoreName ? effectiveStoreName : ''}</span>
                          <span className="font-mono text-[9px]">KOD: {selectedVariant.sku || '-'}</span>
                        </div>

                        <div className="my-auto py-1">
                          <div className="font-black text-xs text-black leading-tight truncate">
                            {selectedVariant.product?.name}
                          </div>
                          <div className="text-[10px] font-bold text-black mt-0.5">
                            Renk: {selectedVariant.attributes?.color || '-'} | Beden: {selectedVariant.attributes?.size || '-'}
                          </div>
                        </div>

                        <div className="my-1 flex flex-col items-center">
                          <div
                            className="w-[90%] max-h-[30px] flex items-center justify-center overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                          />
                          <div className="font-mono text-[10px] font-black tracking-widest text-black mt-0.5">
                            {selectedVariant.barcode}
                          </div>
                        </div>

                        <div className="flex justify-between items-end border-t border-black pt-1">
                          <span className="text-[8px] font-bold text-black">KDV DAHİLDİR</span>
                          <span className="text-base font-black text-black leading-none">
                            {selectedVariant.salePrice?.toFixed(2)} TL
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* DİKEY CANLI ÖNİZLEME */
                      <div className="h-full flex flex-col justify-between text-center">
                        <div className="border-b-2 border-black pb-1 mb-1">
                          <div className="font-black text-xs uppercase tracking-wider">
                            {showStoreName ? effectiveStoreName : ''}
                          </div>
                        </div>

                        <div className="font-black text-xs text-black leading-snug line-clamp-2 my-1">
                          {selectedVariant.product?.name}
                        </div>

                        <div className="border border-black rounded p-1.5 my-1 text-left text-[10px] space-y-0.5 font-bold">
                          <div className="flex justify-between">
                            <span className="text-slate-800">RENK:</span>
                            <span>{selectedVariant.attributes?.color || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-800">BEDEN:</span>
                            <span>{selectedVariant.attributes?.size || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-800">KOD:</span>
                            <span className="font-mono">{selectedVariant.sku || '-'}</span>
                          </div>
                        </div>

                        <div className="my-1 flex flex-col items-center">
                          <div
                            className="w-[95%] max-h-[32px] flex items-center justify-center overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                          />
                          <div className="font-mono text-[10px] font-black tracking-widest text-black mt-0.5">
                            {selectedVariant.barcode}
                          </div>
                        </div>

                        <div className="border-2 border-black p-1 text-center mt-1 bg-white">
                          <div className="text-[8px] font-bold tracking-wider">FİYAT (KDV DAHİL)</div>
                          <div className="text-base font-black text-black leading-none mt-0.5">
                            {selectedVariant.salePrice?.toFixed(2)} TL
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400 text-xs">
                  <Tag className="w-8 h-8 stroke-1 mx-auto mb-2 text-slate-300" />
                  <span>Önizlemek için soldaki listeden bir ürün seçin</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export default LabelPrinterModal
