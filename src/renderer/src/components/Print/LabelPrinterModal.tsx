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
  Copy,
  BadgePercent,
  Save,
  Tag as TagIcon,
  X
} from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'
import { generateCode128Svg } from '../../utils/barcode128'
import { notifyDataChanged, DATA_UPDATED_EVENT } from '../../utils/events'
import { AdminPinModal } from '../Security/AdminPinModal'

interface LabelPreset {
  id: string
  name: string
  width: number
  height: number
  orientation: 'HORIZONTAL' | 'VERTICAL'
  description: string
}

const PRESETS: LabelPreset[] = [
  // Standart Yatay Rulo Şablonları (Hem Yatay Hem 90° Dikey Baskı Uyumlu)
  {
    id: 'h_60_40',
    name: '60 x 40 mm (Önerilen)',
    width: 60,
    height: 40,
    orientation: 'HORIZONTAL',
    description: 'Standart Mağaza & Tekstil Rulosu (Hem Yatay Hem 90° Dikey Baskı Uyumlu)'
  },
  {
    id: 'h_40_20',
    name: '40 x 20 mm',
    width: 40,
    height: 20,
    orientation: 'HORIZONTAL',
    description: 'Mini / Kompakt Barkod'
  }
]

export const LabelPrinterModal: React.FC = () => {
  const { storeName } = usePosStore()
  const effectiveStoreName = storeName || 'LUFIAN'

  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null)

  // Orientation, Layout & Dimensions State
  const [printLayout, setPrintLayout] = useState<'HORIZONTAL' | 'ROTATED_VERTICAL' | 'NATURAL_VERTICAL'>('HORIZONTAL')
  const [selectedPresetId, setSelectedPresetId] = useState<string>('h_60_40')
  const [labelWidth, setLabelWidth] = useState<number>(60)
  const [labelHeight, setLabelHeight] = useState<number>(40)
  const [showStoreName, setShowStoreName] = useState<boolean>(true)
  const [fontScale, setFontScale] = useState<'COMPACT' | 'NORMAL' | 'LARGE'>('COMPACT')

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

  // Bulk Label Printing State
  const [selectedBulkVariantIds, setSelectedBulkVariantIds] = useState<Set<string>>(new Set())

  // Discount / İskontolu Etiket States
  const [isDiscountMode, setIsDiscountMode] = useState<boolean>(false)
  const [customOriginalPrice, setCustomOriginalPrice] = useState<string>('')
  const [customDiscountPrice, setCustomDiscountPrice] = useState<string>('')
  const [isSavingDiscount, setIsSavingDiscount] = useState<boolean>(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('')
  const [isAdminPinOpen, setIsAdminPinOpen] = useState<boolean>(false)

  // Sync pricing state when selectedVariant changes
  useEffect(() => {
    if (selectedVariant) {
      const orig = Number(selectedVariant.salePrice || 0)
      setCustomOriginalPrice(orig > 0 ? orig.toFixed(2) : '')
      if (selectedVariant.discountPrice && Number(selectedVariant.discountPrice) > 0) {
        setIsDiscountMode(true)
        setCustomDiscountPrice(Number(selectedVariant.discountPrice).toFixed(2))
      } else {
        setIsDiscountMode(false)
        setCustomDiscountPrice(orig > 0 ? (orig * 0.8).toFixed(2) : '')
      }
    }
  }, [selectedVariant?.id])

  const handleApplyDiscountPct = (pct: number) => {
    const orig = parseFloat(customOriginalPrice) || Number(selectedVariant?.salePrice || 0)
    if (orig > 0) {
      const discounted = orig * (1 - pct / 100)
      setCustomDiscountPrice(discounted.toFixed(2))
      setIsDiscountMode(true)
    }
  }

  const origPriceNum = parseFloat(customOriginalPrice) || Number(selectedVariant?.salePrice || 0)
  const discPriceNum = parseFloat(customDiscountPrice) || (selectedVariant?.discountPrice ? Number(selectedVariant.discountPrice) : 0)
  const isDiscounted = isDiscountMode && origPriceNum > 0 && discPriceNum > 0 && discPriceNum < origPriceNum
  const discountPct = isDiscounted
    ? Math.round(((origPriceNum - discPriceNum) / origPriceNum) * 100)
    : 0

  const handleSaveDiscountToProduct = async (overridePin?: string) => {
    if (!selectedVariant) return
    let adminPin = overridePin || localStorage.getItem('pos_admin_pin_session') || ''
    if (!adminPin) {
      setIsAdminPinOpen(true)
      return
    }

    setIsSavingDiscount(true)
    try {
      const discVal = isDiscountMode ? parseFloat(customDiscountPrice) : null

      const res = await fetch(`/api/products/variants/${selectedVariant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': adminPin,
        },
        body: JSON.stringify({
          discountPrice: (discVal && discVal > 0) ? discVal : null,
          note: 'Etiket ekranından indirimli fiyat güncellemesi'
        })
      })
      if (res.ok) {
        localStorage.setItem('pos_admin_pin_session', adminPin)
        const updated = await res.json()
        setSelectedVariant((prev: any) => ({ ...prev, discountPrice: updated.discountPrice }))
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            variants: p.variants?.map((v: any) =>
              v.id === selectedVariant.id ? { ...v, discountPrice: updated.discountPrice } : v
            ),
          }))
        )
        setSaveSuccessMsg('✅ İndirimli fiyat ürün kartına kaydedildi!')
        notifyDataChanged()
        setTimeout(() => setSaveSuccessMsg(''), 3500)
      } else {
        const err = await res.json()
        if (err.code === 'UNAUTHORIZED_ADMIN_PIN' || res.status === 401) {
          localStorage.removeItem('pos_admin_pin_session')
          setSaveSuccessMsg('❌ Geçersiz Yönetici PIN şifresi.')
          setTimeout(() => setSaveSuccessMsg(''), 3500)
        } else {
          setSaveSuccessMsg('❌ Kaydetme hatası: ' + (err.error || 'Bilinmeyen hata'))
          setTimeout(() => setSaveSuccessMsg(''), 3500)
        }
      }
    } catch (e: any) {
      setSaveSuccessMsg('❌ Hata: ' + e.message)
      setTimeout(() => setSaveSuccessMsg(''), 3500)
    } finally {
      setIsSavingDiscount(false)
    }
  }

  const loadProducts = () => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data)
          setSelectedVariant((curr: any) => {
            if (!curr) {
              if (data.length > 0 && data[0].variants?.length > 0) {
                return { ...data[0].variants[0], product: data[0] }
              }
              return null
            }
            // Keep currently viewed variant up-to-date with latest server data
            for (const prod of data) {
              const matched = prod.variants?.find((v: any) => v.id === curr.id)
              if (matched) {
                return { ...matched, product: prod }
              }
            }
            return curr
          })

          // Clean up any stale variant IDs from bulk selection if deleted
          const validIds = new Set(data.flatMap((p: any) => p.variants?.map((v: any) => v.id) || []))
          setSelectedBulkVariantIds((prev) => {
            let changed = false
            const next = new Set<string>()
            prev.forEach((id) => {
              if (validIds.has(id)) {
                next.add(id)
              } else {
                changed = true
              }
            })
            return changed ? next : prev
          })
        }
      })
      .catch(() => {})
  }

  const loadCategories = () => {
    fetch('/api/products/categories')
      .then((res) => res.json())
      .then((catData) => {
        if (Array.isArray(catData)) setCategories(catData)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadProducts()
    loadCategories()

    if (window.electron?.getPrinters) {
      window.electron.getPrinters().then((printerList) => {
        setPrinters(printerList || [])
        const defaultPrinter = printerList.find((p: any) => p.isDefault)?.name || printerList[0]?.name || ''
        setSelectedPrinter(defaultPrinter)
      })
    }

    let lastUpdate = 0
    const handleDataUpdate = () => {
      const now = Date.now()
      if (now - lastUpdate < 500) return
      lastUpdate = now
      loadProducts()
      loadCategories()
    }

    window.addEventListener(DATA_UPDATED_EVENT, handleDataUpdate)
    window.addEventListener('focus', handleDataUpdate)

    return () => {
      window.removeEventListener(DATA_UPDATED_EVENT, handleDataUpdate)
      window.removeEventListener('focus', handleDataUpdate)
    }
  }, [])

  // Choose preset
  const handleSelectPreset = (preset: LabelPreset) => {
    setSelectedPresetId(preset.id)
    setLabelWidth(preset.width)
    setLabelHeight(preset.height)
    if (preset.orientation === 'VERTICAL') {
      setPrintLayout('NATURAL_VERTICAL')
    } else {
      if (printLayout === 'NATURAL_VERTICAL') {
        setPrintLayout('HORIZONTAL')
      }
    }
  }

  // Swap Width and Height
  const handleSwapDimensions = () => {
    const newWidth = labelHeight
    const newHeight = labelWidth
    setLabelWidth(newWidth)
    setLabelHeight(newHeight)
    if (newWidth < newHeight) {
      setPrintLayout('NATURAL_VERTICAL')
    } else {
      setPrintLayout('HORIZONTAL')
    }
    const matching = PRESETS.find((p) => p.width === newWidth && p.height === newHeight)
    setSelectedPresetId(matching ? matching.id : 'custom')
  }

  const [displayLimit, setDisplayLimit] = useState<number>(80)

  useEffect(() => {
    setDisplayLimit(80)
  }, [searchTerm, selectedCategoryId])

  // Build flattened variant array with useMemo
  const allVariants = useMemo(() => {
    const list: any[] = []
    products.forEach((prod) => {
      if (selectedCategoryId && prod.categoryId !== selectedCategoryId) return

      if (Array.isArray(prod.variants)) {
        prod.variants.forEach((v: any) => {
          list.push({
            ...v,
            product: prod,
            categoryName: prod.category?.name || 'Kategorisiz',
          })
        })
      }
    })
    return list
  }, [products, selectedCategoryId])

  // Filter variants by search term with useMemo
  const filteredVariants = useMemo(() => {
    if (!searchTerm.trim()) return allVariants
    const term = searchTerm.toLowerCase()
    return allVariants.filter((v) => {
      return (
        v.product.name.toLowerCase().includes(term) ||
        v.product.code.toLowerCase().includes(term) ||
        v.sku.toLowerCase().includes(term) ||
        (v.barcode && v.barcode.toLowerCase().includes(term)) ||
        (v.attributes?.color && v.attributes.color.toLowerCase().includes(term)) ||
        (v.attributes?.size && v.attributes.size.toLowerCase().includes(term))
      )
    })
  }, [allVariants, searchTerm])

  // Celeron ve düşük donanımlı POS cihazlarında DOM kasmalarını önlemek için dilimlenmiş görünüm
  const visibleVariants = useMemo(() => {
    if (selectedVariant) {
      const idx = filteredVariants.findIndex((v) => v.id === selectedVariant.id)
      if (idx >= displayLimit) {
        return filteredVariants.slice(0, idx + 20)
      }
    }
    return filteredVariants.slice(0, displayLimit)
  }, [filteredVariants, displayLimit, selectedVariant])

  // SVG Barcode for Live Preview
  const previewBarcodeSvg = useMemo(() => {
    if (!selectedVariant) return ''
    const code = selectedVariant.barcode || selectedVariant.sku || '123456789012'
    const isVertical = printLayout === 'ROTATED_VERTICAL' || printLayout === 'NATURAL_VERTICAL'
    let svgHeight = isVertical ? 20 : 22
    if (fontScale === 'COMPACT') svgHeight = Math.max(16, svgHeight - 4)
    if (fontScale === 'LARGE') svgHeight += 3
    return generateCode128Svg(code, svgHeight)
  }, [selectedVariant, printLayout, labelHeight, labelWidth, fontScale])

  // Bulk Selection Helpers
  const toggleBulkVariant = (variantId: string) => {
    setSelectedBulkVariantIds((prev) => {
      const next = new Set(prev)
      if (next.has(variantId)) {
        next.delete(variantId)
      } else {
        next.add(variantId)
      }
      return next
    })
  }

  const handleClearBulkSelection = () => {
    setSelectedBulkVariantIds(new Set())
  }

  const allFilteredSelected =
    filteredVariants.length > 0 && filteredVariants.every((v) => selectedBulkVariantIds.has(v.id))

  const handleToggleAllFiltered = () => {
    setSelectedBulkVariantIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredVariants.forEach((v) => next.delete(v.id))
      } else {
        filteredVariants.forEach((v) => next.add(v.id))
      }
      return next
    })
  }

  // Dimension & typography calculations for print output (shared by single and bulk)
  const isRotatedVertical = printLayout === 'ROTATED_VERTICAL'
  const isNaturalVertical = printLayout === 'NATURAL_VERTICAL'
  const isAnyVertical = isRotatedVertical || isNaturalVertical

  const isTiny = labelHeight <= 25 || labelWidth <= 45
  const isSmall = labelHeight < 35 || labelWidth < 50

  // Horizontal text size calculations
  let hPriceFont = fontScale === 'COMPACT' ? 18 : fontScale === 'LARGE' ? 24 : 21
  let hDiscPriceFont = fontScale === 'COMPACT' ? 16 : fontScale === 'LARGE' ? 22 : 19
  let hTitleFont = fontScale === 'COMPACT' ? 10 : fontScale === 'LARGE' ? 12 : 11
  let hStoreFont = fontScale === 'COMPACT' ? 9 : fontScale === 'LARGE' ? 11 : 10
  let hBarcodeH = fontScale === 'COMPACT' ? 18 : fontScale === 'LARGE' ? 22 : 20

  if (isTiny) {
    hPriceFont = 14
    hDiscPriceFont = 13
    hTitleFont = 9
    hStoreFont = 8
    hBarcodeH = 14
  } else if (isSmall) {
    hPriceFont = Math.min(hPriceFont, 17)
    hDiscPriceFont = Math.min(hDiscPriceFont, 16)
    hTitleFont = Math.min(hTitleFont, 10)
    hBarcodeH = Math.min(hBarcodeH, 18)
  }

  // Vertical / Rotated Vertical (usable width is narrower, e.g. 40mm)
  let vPriceFont = fontScale === 'COMPACT' ? 18 : fontScale === 'LARGE' ? 24 : 21
  let vDiscPriceFont = fontScale === 'COMPACT' ? 16 : fontScale === 'LARGE' ? 21 : 19
  let vTitleFont = fontScale === 'COMPACT' ? 9.5 : fontScale === 'LARGE' ? 11.5 : 10.5
  let vStoreFont = fontScale === 'COMPACT' ? 9 : fontScale === 'LARGE' ? 11 : 10
  let vBarcodeH = fontScale === 'COMPACT' ? 16 : fontScale === 'LARGE' ? 20 : 18

  if (isTiny) {
    vPriceFont = 14
    vDiscPriceFont = 13
    vTitleFont = 8.5
    vStoreFont = 8
    vBarcodeH = 13
  } else if (isSmall) {
    vPriceFont = Math.min(vPriceFont, 17)
    vDiscPriceFont = Math.min(vDiscPriceFont, 16)
    vTitleFont = Math.min(vTitleFont, 9.5)
    vBarcodeH = Math.min(vBarcodeH, 16)
  }

  // Generates single page HTML fragment for any variant
  const buildSingleVariantLabelPage = (variant: any) => {
    if (!variant) return ''

    const barcode = variant.barcode || variant.sku || '123456789012'
    const productName = variant.product?.name || 'Ürün Adı'
    const color = variant.attributes?.color || '-'
    const size = variant.attributes?.size || '-'
    const sku = variant.sku || '-'

    const isCurrentActive = variant.id === selectedVariant?.id
    let isItemDiscounted = false
    let formattedOrigPrice = ''
    let formattedDiscPrice = ''
    let standardPrice = Number(variant.salePrice || 0).toFixed(2)

    if (isCurrentActive && isDiscounted) {
      isItemDiscounted = true
      formattedOrigPrice = origPriceNum.toFixed(2)
      formattedDiscPrice = discPriceNum.toFixed(2)
    } else if (
      variant.discountPrice &&
      Number(variant.discountPrice) > 0 &&
      Number(variant.discountPrice) < Number(variant.salePrice || 0)
    ) {
      isItemDiscounted = true
      formattedOrigPrice = Number(variant.salePrice || 0).toFixed(2)
      formattedDiscPrice = Number(variant.discountPrice || 0).toFixed(2)
    }

    const svgHeight = isAnyVertical ? vBarcodeH : hBarcodeH
    const vectorBarcodeSvg = generateCode128Svg(barcode, svgHeight)

    const horizontalPriceSection = isItemDiscounted
      ? `
        <div class="discount-price-row">
          <div class="old-price-col">
            <span class="old-price-lbl">ESKİ FİYAT</span>
            <span class="old-price-val">${formattedOrigPrice} TL</span>
          </div>
          <div class="new-price-col">
            <span class="new-price-lbl">İNDİRİMLİ FİYAT</span>
            <span class="new-price-val">${formattedDiscPrice} TL</span>
          </div>
        </div>
      `
      : `
        <div class="price-row">
          <span class="kdv-tag">KDV DAHİLDİR</span>
          <span class="price-val">${standardPrice} TL</span>
        </div>
      `

    const verticalPriceSection = isItemDiscounted
      ? `
        <div class="price-box discounted-box">
          <div class="v-old-row">
            <span class="v-old-lbl">ESKİ FİYAT:</span>
            <span class="v-old-val">${formattedOrigPrice} TL</span>
          </div>
          <div class="v-new-row">
            <div class="v-new-lbl">İNDİRİMLİ FİYAT</div>
            <div class="v-new-val">${formattedDiscPrice} TL</div>
          </div>
        </div>
      `
      : `
        <div class="price-box">
          <div class="price-label">FİYAT (KDV DAHİL)</div>
          <div class="price-val">${standardPrice} TL</div>
        </div>
      `

    if (isRotatedVertical) {
      return `
        <div class="label-page rotated-page">
          <div class="rotated-vertical-inner">
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
            ${verticalPriceSection}
          </div>
        </div>
      `
    } else if (isNaturalVertical) {
      return `
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
          ${verticalPriceSection}
        </div>
      `
    } else {
      return `
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
          ${horizontalPriceSection}
        </div>
      `
    }
  }

  // Wraps generated pages with full thermal printer CSS stylesheet
  const wrapLabelDocumentHtml = (allPagesHtml: string) => {
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
              box-sizing: border-box;
            }

            /* YATAY (HORIZONTAL) STİL */
            .horizontal {
              width: ${labelWidth}mm;
              height: ${labelHeight}mm;
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
              box-sizing: border-box;
              overflow: hidden;
            }
            .horizontal .h-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 0.8px solid #000;
              padding-bottom: 0.5px;
              line-height: 1;
            }
            .horizontal .store-name {
              text-transform: uppercase;
              font-size: ${hStoreFont}px;
              font-weight: 900;
              letter-spacing: 0.5px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 60%;
            }
            .horizontal .sku-text {
              font-family: 'Courier New', monospace;
              font-size: ${Math.max(7.5, hStoreFont - 1.5)}px;
              font-weight: 800;
              white-space: nowrap;
            }
            .horizontal .product-title {
              font-size: ${hTitleFont}px;
              font-weight: 900;
              line-height: 1.15;
              max-height: 25px;
              overflow: hidden;
              margin: 1px 0;
              color: #000;
              word-break: break-word;
            }
            .horizontal .variant-info {
              font-size: ${Math.max(8, hTitleFont - 1.5)}px;
              font-weight: 800;
              color: #000;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .horizontal .barcode-wrap {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin: 0.5px 0;
              overflow: hidden;
            }
            .horizontal .svg-container {
              width: 85%;
              max-height: ${hBarcodeH}px;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .horizontal .barcode-number {
              font-family: 'Courier New', monospace;
              font-size: ${Math.max(8, hStoreFont - 0.5)}px;
              font-weight: 900;
              letter-spacing: 1.2px;
              margin-top: 0.5px;
              color: #000;
              line-height: 1;
              white-space: nowrap;
            }
            .horizontal .price-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-top: 1.2px solid #000;
              padding-top: 1px;
              margin-top: 0.5px;
            }
            .horizontal .kdv-tag {
              font-size: 7.5px;
              font-weight: 900;
              letter-spacing: 0.3px;
              line-height: 1;
              padding-bottom: 1px;
              white-space: nowrap;
            }
            .horizontal .price-val {
              font-size: ${hPriceFont}px;
              font-weight: 900;
              letter-spacing: -0.5px;
              line-height: 1;
              white-space: nowrap;
            }

            /* YATAY İSKONTOLU FİYAT */
            .horizontal .discount-price-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-top: 1.2px solid #000;
              padding-top: 1px;
              margin-top: 0.5px;
            }
            .horizontal .old-price-col {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              text-align: left;
              line-height: 1;
              white-space: nowrap;
            }
            .horizontal .old-price-lbl {
              font-size: 6.5px;
              font-weight: 900;
              color: #333;
            }
            .horizontal .old-price-val {
              font-size: 10px;
              font-weight: 900;
              text-decoration: line-through;
              line-height: 1.1;
              white-space: nowrap;
            }
            .horizontal .badge-col {
              display: flex;
              align-items: center;
              padding: 0 2px;
              white-space: nowrap;
            }
            .horizontal .discount-badge {
              background: #000 !important;
              color: #fff !important;
              font-size: 9.5px;
              font-weight: 900;
              padding: 1.5px 4px;
              border-radius: 2px;
              letter-spacing: 0.3px;
              white-space: nowrap;
            }
            .horizontal .new-price-col {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              text-align: right;
              line-height: 1;
              white-space: nowrap;
            }
            .horizontal .new-price-lbl {
              font-size: 6.5px;
              font-weight: 900;
              color: #000;
            }
            .horizontal .new-price-val {
              font-size: ${hDiscPriceFont}px;
              font-weight: 900;
              letter-spacing: -0.5px;
              line-height: 1;
              white-space: nowrap;
            }

            /* ROTATED 90 DEGREE VERTICAL (Yatay Ruloya 90° Dikey Baskı) */
            .rotated-page {
              position: relative;
              overflow: hidden;
            }
            .rotated-vertical-inner {
              width: ${labelHeight}mm;
              height: ${labelWidth}mm;
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(90deg);
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              padding: 1.5mm 2mm;
              box-sizing: border-box;
              text-align: center;
              background-color: #fff !important;
              color: #000 !important;
              overflow: hidden;
            }

            /* DİKEY (VERTICAL) ORTAK STİL */
            .vertical {
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              text-align: center;
              box-sizing: border-box;
              overflow: hidden;
            }
            .vertical, .rotated-vertical-inner {
              text-align: center;
            }
            .vertical .v-header, .rotated-vertical-inner .v-header {
              border-bottom: 1.2px solid #000;
              padding-bottom: 1px;
              margin-bottom: 0.5px;
              line-height: 1;
            }
            .vertical .store-name, .rotated-vertical-inner .store-name {
              font-size: ${vStoreFont}px;
              font-weight: 900;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .vertical .product-title, .rotated-vertical-inner .product-title {
              font-size: ${vTitleFont}px;
              font-weight: 900;
              line-height: 1.15;
              max-height: 25px;
              overflow: hidden;
              margin: 0.5px 0;
              color: #000;
              word-break: break-word;
            }
            .vertical .attributes-grid, .rotated-vertical-inner .attributes-grid {
              border: 1px solid #000;
              border-radius: 2px;
              padding: 1.5px 3px;
              margin: 1px 0;
              font-size: 8.5px;
              text-align: left;
              line-height: 1.15;
            }
            .vertical .attr-row, .rotated-vertical-inner .attr-row {
              display: flex;
              justify-content: space-between;
              line-height: 1.2;
              white-space: nowrap;
            }
            .vertical .attr-lbl, .rotated-vertical-inner .attr-lbl {
              font-weight: 700;
            }
            .vertical .attr-val, .rotated-vertical-inner .attr-val {
              font-weight: 900;
            }
            .vertical .barcode-wrap, .rotated-vertical-inner .barcode-wrap {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin: 0.5px 0;
              overflow: hidden;
            }
            .vertical .svg-container, .rotated-vertical-inner .svg-container {
              width: 88%;
              max-height: ${vBarcodeH}px;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .vertical .barcode-number, .rotated-vertical-inner .barcode-number {
              font-family: 'Courier New', monospace;
              font-size: 9px;
              font-weight: 900;
              letter-spacing: 1px;
              margin-top: 0.5px;
              line-height: 1;
              white-space: nowrap;
            }
            .vertical .price-box, .rotated-vertical-inner .price-box {
              border: 1.5px solid #000;
              background-color: #fff;
              padding: 1.5px 2px;
              margin-top: 1px;
            }
            .vertical .price-label, .rotated-vertical-inner .price-label {
              font-size: 7.5px;
              font-weight: 800;
              letter-spacing: 0.3px;
              line-height: 1;
              white-space: nowrap;
            }
            .vertical .price-val, .rotated-vertical-inner .price-val {
              font-size: ${vPriceFont}px;
              font-weight: 900;
              letter-spacing: -0.5px;
              line-height: 1;
              white-space: nowrap;
            }

            /* DİKEY İSKONTOLU FİYAT */
            .vertical .discounted-box, .rotated-vertical-inner .discounted-box {
              border: 1.5px solid #000;
              background-color: #fff;
              padding: 1.5px 2px;
              margin-top: 1px;
            }
            .vertical .v-old-row, .rotated-vertical-inner .v-old-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 8px;
              font-weight: 800;
              border-bottom: 0.8px dashed #000;
              padding-bottom: 0.5px;
              margin-bottom: 0.5px;
              white-space: nowrap;
            }
            .vertical .v-old-lbl, .rotated-vertical-inner .v-old-lbl {
              font-size: 7px;
              color: #333;
              font-weight: 900;
            }
            .vertical .v-old-val, .rotated-vertical-inner .v-old-val {
              font-size: 9.5px;
              text-decoration: line-through;
              font-weight: 900;
              white-space: nowrap;
            }
            .vertical .v-badge-tag, .rotated-vertical-inner .v-badge-tag {
              background: #000 !important;
              color: #fff !important;
              font-size: 8.5px;
              font-weight: 900;
              text-align: center;
              padding: 1px;
              letter-spacing: 0.3px;
              border-radius: 2px;
              margin: 0.5px 0;
              white-space: nowrap;
            }
            .vertical .v-new-row, .rotated-vertical-inner .v-new-row {
              text-align: center;
              padding-top: 0.5px;
              white-space: nowrap;
            }
            .vertical .v-new-lbl, .rotated-vertical-inner .v-new-lbl {
              font-size: 6.5px;
              font-weight: 900;
            }
            .vertical .v-new-val, .rotated-vertical-inner .v-new-val {
              font-size: ${vDiscPriceFont}px;
              font-weight: 900;
              letter-spacing: -0.5px;
              line-height: 1;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          ${allPagesHtml}
        </body>
      </html>
    `
  }

  // Build Full HTML Document for Single Selected Variant
  const buildPrintHtml = (copiesCount: number) => {
    if (!selectedVariant) return ''
    const singlePage = buildSingleVariantLabelPage(selectedVariant)
    const allPagesHtml = Array.from({ length: copiesCount })
      .map(() => singlePage)
      .join('')
    return wrapLabelDocumentHtml(allPagesHtml)
  }

  // Build Full HTML Document for Bulk Selected Variants
  const buildBulkPrintHtml = (variantsList: any[], quantityPerItem: number) => {
    const allPagesHtml = variantsList
      .flatMap((v) => {
        const page = buildSingleVariantLabelPage(v)
        return Array.from({ length: quantityPerItem }).map(() => page)
      })
      .join('')
    return wrapLabelDocumentHtml(allPagesHtml)
  }

  // Bulk Print Dispatch (Sends all selected variants to thermal roll in one silent job)
  const handleBulkPrintDispatch = async (isSilent = true) => {
    const selectedList = allVariants.filter((v) => selectedBulkVariantIds.has(v.id))
    if (selectedList.length === 0) {
      setMessage('⚠️ Lütfen toplu etiket basımı için en az bir ürün seçin.')
      setTimeout(() => setMessage(''), 4000)
      return
    }

    setIsPrinting(true)
    setMessage('')

    try {
      const bulkHtml = buildBulkPrintHtml(selectedList, printQuantity)

      if (window.electron?.printSilent) {
        const result = await window.electron.printSilent(
          bulkHtml,
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
            variants: selectedList,
            quantity: printQuantity,
            orientation: printLayout === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL',
            layout: printLayout,
            width: labelWidth,
            height: labelHeight,
            printerName: selectedPrinter,
          }),
        })

        const printWin = window.open('', '_blank')
        if (printWin) {
          printWin.document.write(bulkHtml)
          printWin.document.close()
          setTimeout(() => {
            printWin.focus()
            printWin.print()
            printWin.close()
          }, 350)
        }
      }

      const totalLabels = selectedList.length * printQuantity
      const layoutLabel = printLayout === 'HORIZONTAL' ? '↔ Yatay' : '↕ 90° Dikey (Askı)'
      setMessage(
        `Toplu Yazdırma Başarılı: ${selectedList.length} ürün için toplam ${totalLabels} adet ${layoutLabel} (${labelWidth}x${labelHeight}mm) etiket yazıcıya gönderildi!`
      )
    } catch (err: any) {
      setMessage(`Toplu yazdırma hatası: ${err.message}`)
    } finally {
      setIsPrinting(false)
    }
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
            orientation: printLayout === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL',
            layout: printLayout,
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

      const layoutLabel = printLayout === 'HORIZONTAL' ? '↔ Yatay' : '↕ 90° Dikey (Askı)'
      setMessage(
        `${quantityToPrint} Adet ${layoutLabel} (${labelWidth}x${labelHeight}mm) Etiket Başarıyla Yazıcıya Gönderildi!`
      )
    } catch (err: any) {
      setMessage(`Yazdırma hatası: ${err.message}`)
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 p-3 sm:p-4 overflow-y-auto font-sans select-none">
      <div className="w-full max-w-[98%] 2xl:max-w-[1750px] mx-auto space-y-4">
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

            {selectedBulkVariantIds.size > 0 && (
              <div className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs font-bold shadow-2xs shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{selectedBulkVariantIds.size} Ürün Toplu Seçili</span>
              </div>
            )}

            {selectedVariant && (
              <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center space-x-3 text-xs">
                <div className="text-right">
                  <span className="text-[10px] text-blue-700 font-bold block uppercase">Seçili Ürün</span>
                  <span className="font-bold text-slate-900 truncate max-w-[150px] inline-block align-bottom">
                    {selectedVariant.product?.name}
                  </span>
                </div>
                {isDiscounted ? (
                  <div className="text-right">
                    <span className="text-slate-400 line-through text-[11px] block">{origPriceNum.toFixed(2)} ₺</span>
                    <span className="text-rose-700 font-extrabold text-sm block">{discPriceNum.toFixed(2)} ₺</span>
                  </div>
                ) : (
                  <span className="text-emerald-700 font-extrabold text-sm">{selectedVariant.salePrice?.toFixed(2)} ₺</span>
                )}
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

            {/* Toplu Seçim Kontrol ve Durum Çubuğu */}
            <div className="bg-gradient-to-r from-blue-50/80 to-slate-50 border border-blue-200/80 rounded-lg p-2.5 flex items-center justify-between text-xs gap-2">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                    selectedBulkVariantIds.size > 0
                      ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {selectedBulkVariantIds.size > 0 && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-slate-800">Toplu Seçim:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-extrabold text-[11px] ${
                      selectedBulkVariantIds.size > 0
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {selectedBulkVariantIds.size} Ürün Seçili
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleToggleAllFiltered}
                  className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-700 rounded transition cursor-pointer shadow-2xs"
                >
                  {allFilteredSelected ? 'Görünenleri Kaldır' : `Görünenleri Seç (${filteredVariants.length})`}
                </button>

                {selectedBulkVariantIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearBulkSelection}
                    className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 rounded transition flex items-center space-x-1 cursor-pointer shadow-2xs"
                    title="Tüm seçilen ürünlerin seçimini tek tıkla iptal et"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Seçimi İptal Et</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Variant List */}
            <div 
              className="flex-1 overflow-y-auto space-y-1.5 pr-1"
              onScroll={(e) => {
                const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
                if (scrollHeight - scrollTop - clientHeight < 150) {
                  if (displayLimit < filteredVariants.length) {
                    setDisplayLimit((prev) => Math.min(prev + 60, filteredVariants.length))
                  }
                }
              }}
            >
              {filteredVariants.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-2">
                  <Tag className="w-8 h-8 stroke-1 text-slate-300" />
                  <span>Arama kriterlerine uygun ürün bulunamadı.</span>
                </div>
              ) : (
                <>
                  {visibleVariants.map((v) => {
                    const isPreviewSelected = selectedVariant?.id === v.id
                    const isBulkSelected = selectedBulkVariantIds.has(v.id)
                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between text-xs ${
                          isPreviewSelected
                            ? 'bg-blue-50/90 border-blue-500 shadow-2xs ring-1 ring-blue-500'
                            : isBulkSelected
                            ? 'bg-blue-50/30 border-blue-300'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {/* Yuvarlak Mavi Tik Butonu (Toplu Seçim) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleBulkVariant(v.id)
                            }}
                            title={isBulkSelected ? 'Toplu seçimden kaldır' : 'Toplu basım için seç'}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition cursor-pointer ${
                              isBulkSelected
                                ? 'bg-blue-600 border-blue-600 text-white shadow-2xs scale-105'
                                : 'border-slate-300 bg-white hover:border-blue-500 hover:bg-blue-50/50'
                            }`}
                          >
                            {isBulkSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>

                          <div>
                            <div className="font-bold text-slate-900 flex items-center space-x-2">
                              <span>{v.product.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold">
                                {v.attributes?.color || '-'} / {v.attributes?.size || '-'}
                              </span>
                              {isPreviewSelected && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-blue-600 text-white font-extrabold rounded uppercase tracking-wider">
                                  Önizleniyor
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center space-x-3">
                              <span>
                                Barkod: <strong className="text-slate-800">{v.barcode}</strong>
                              </span>
                              <span>SKU: {v.sku}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {v.discountPrice && v.discountPrice > 0 ? (
                            <>
                              <span className="text-[10px] text-slate-400 line-through block">
                                {v.salePrice?.toFixed(2)} ₺
                              </span>
                              <span className="font-extrabold text-rose-700 text-xs block">
                                {v.discountPrice?.toFixed(2)} ₺
                              </span>
                            </>
                          ) : (
                            <span className="font-extrabold text-emerald-700 text-xs block">
                              {v.salePrice?.toFixed(2)} ₺
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-medium">Stok: {v.stockQuantity} Adet</span>
                        </div>
                      </div>
                    )
                  })}

                  {filteredVariants.length > visibleVariants.length && (
                    <div className="pt-2 pb-1 text-center">
                      <button
                        type="button"
                        onClick={() => setDisplayLimit((prev) => prev + 60)}
                        className="w-full py-2 px-3 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300 hover:border-blue-300 rounded text-xs font-semibold transition cursor-pointer shadow-2xs"
                      >
                        Daha Fazla Varyant Göster ({filteredVariants.length - visibleVariants.length} varyant daha)
                      </button>
                    </div>
                  )}
                </>
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

              {/* Baskı Tasarım Düzeni (Horizontal vs 90° Rotated Vertical) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Baskı Yönü & Tasarım Modu</span>
                  <span className="text-[10px] text-blue-700 font-black bg-blue-100/80 px-2 py-0.5 rounded border border-blue-300">
                    Rulo: {labelWidth} x {labelHeight} mm
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintLayout('HORIZONTAL')
                      if (labelHeight > labelWidth) {
                        const temp = labelWidth
                        setLabelWidth(labelHeight)
                        setLabelHeight(temp)
                      }
                    }}
                    className={`p-2.5 rounded-lg border flex flex-col items-center justify-center text-center transition cursor-pointer ${
                      printLayout === 'HORIZONTAL'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-bold text-xs">
                      <RectangleHorizontal className="w-4 h-4 shrink-0" />
                      <span>↔ Yatay Baskı</span>
                    </div>
                    <span className={`text-[10px] mt-0.5 ${printLayout === 'HORIZONTAL' ? 'text-blue-100' : 'text-slate-500'}`}>
                      Kutu, Raf & Ambalaj
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrintLayout('ROTATED_VERTICAL')
                      if (labelHeight > labelWidth) {
                        const temp = labelWidth
                        setLabelWidth(labelHeight)
                        setLabelHeight(temp)
                      }
                    }}
                    className={`p-2.5 rounded-lg border flex flex-col items-center justify-center text-center transition cursor-pointer ${
                      printLayout === 'ROTATED_VERTICAL'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-bold text-xs">
                      <RectangleVertical className="w-4 h-4 shrink-0" />
                      <span>↕ 90° Dikey Baskı</span>
                    </div>
                    <span className={`text-[10px] mt-0.5 ${printLayout === 'ROTATED_VERTICAL' ? 'text-blue-100' : 'text-slate-500'}`}>
                      Askı / Tekstil Sallama Kart
                    </span>
                  </button>
                </div>

                <div className="p-2 bg-blue-50/70 border border-blue-200/80 rounded text-[11px] text-blue-900 leading-snug">
                  {printLayout === 'HORIZONTAL' ? (
                    <span><strong>↔ Yatay Mod:</strong> Yazıcıdaki {labelWidth}x{labelHeight} mm etikete standart düz yatay formatta basar.</span>
                  ) : (
                    <span><strong>↕ 90° Dikey Askı Modu:</strong> Yazıcıdaki <u>aynı {labelWidth}x{labelHeight} mm yatay ruloya</u> içeriği 90° çevirip basar. Rulo değiştirmeden askı/sallama kartı elde edersiniz!</span>
                  )}
                </div>
              </div>

              {/* Rulo / Etiket Ölçü Şablonları */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rulo / Etiket Ölçü Şablonu (Yazıcıdaki Kağıt)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESETS.map((preset) => (
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

              {/* Font / Yazı Boyutu Seçimi (Taşma Koruması) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Yazı & Fiyat Boyutu (Taşma Koruması)</span>
                  <span className="text-[10px] text-blue-700 font-bold">
                    {fontScale === 'COMPACT' ? 'Kompakt (Dar)' : fontScale === 'NORMAL' ? 'Standart (Önerilen)' : 'Büyük'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFontScale('COMPACT')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition cursor-pointer text-center ${
                      fontScale === 'COMPACT'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Kompakt (Dar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontScale('NORMAL')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition cursor-pointer text-center ${
                      fontScale === 'NORMAL'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Standart
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontScale('LARGE')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition cursor-pointer text-center ${
                      fontScale === 'LARGE'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Büyük Yazı
                  </button>
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
                        if (val < labelHeight) setPrintLayout('NATURAL_VERTICAL')
                        if (val >= labelHeight && printLayout === 'NATURAL_VERTICAL') setPrintLayout('HORIZONTAL')
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
                        if (val > labelWidth) setPrintLayout('NATURAL_VERTICAL')
                        if (val <= labelWidth && printLayout === 'NATURAL_VERTICAL') setPrintLayout('HORIZONTAL')
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

              {/* İskonto & İndirimli Fiyat Ayarı */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-xs font-bold text-amber-950 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isDiscountMode}
                      onChange={(e) => setIsDiscountMode(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <span className="flex items-center space-x-1">
                      <BadgePercent className="w-4 h-4 text-amber-700" />
                      <span>İndirimli Fiyatlı Etiket Bas</span>
                    </span>
                  </label>
                </div>

                {isDiscountMode && (
                  <div className="space-y-2 pt-1 border-t border-amber-200/60">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                          Normal Fiyat (Üstü Çizili ₺)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={customOriginalPrice}
                          onChange={(e) => setCustomOriginalPrice(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-800 font-bold text-xs focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-rose-700 mb-0.5">
                          İndirimli Fiyat (₺)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={customDiscountPrice}
                          onChange={(e) => setCustomDiscountPrice(e.target.value)}
                          className="w-full bg-white border border-rose-300 rounded px-2 py-1 text-rose-700 font-extrabold text-xs focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    {/* Hızlı İndirim Oranları */}
                    <div className="flex items-center justify-between gap-1 pt-0.5">
                      <span className="text-[10px] font-semibold text-slate-600">Hızlı İndirim Oranı:</span>
                      <div className="flex items-center space-x-1">
                        {[10, 20, 25, 30, 40, 50].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handleApplyDiscountPct(pct)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                              discountPct === pct
                                ? 'bg-amber-800 text-white'
                                : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100'
                            }`}
                          >
                            %{pct}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ürün Kartına Kaydet Butonu */}
                    {selectedVariant && (
                      <div className="pt-1 flex items-center justify-between">
                        <button
                          type="button"
                          disabled={isSavingDiscount}
                          onClick={() => handleSaveDiscountToProduct()}
                          className="text-[11px] text-amber-900 bg-white hover:bg-amber-100 border border-amber-300 rounded px-2 py-1 font-bold flex items-center space-x-1 transition shadow-2xs"
                        >
                          <Save className="w-3 h-3 text-amber-700" />
                          <span>{isSavingDiscount ? 'Kaydediliyor...' : 'Bu İndirimi Ürüne Kaydet'}</span>
                        </button>
                        {saveSuccessMsg && (
                          <span className="text-[10px] font-bold text-emerald-700 animate-fadeIn">
                            {saveSuccessMsg}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                  <div className="flex items-center space-x-1 flex-wrap gap-y-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setPrintQuantity(qty)}
                        className={`px-2 py-1 min-w-[28px] text-center rounded text-xs font-bold transition cursor-pointer ${
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
              {selectedBulkVariantIds.size > 0 ? (
                <div className="pt-1 space-y-2">
                  {/* Toplu Yazdırma Ana Butonu */}
                  <button
                    disabled={isPrinting}
                    onClick={() => handleBulkPrintDispatch(true)}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-extrabold rounded-lg shadow-md transition flex items-center justify-center space-x-2 text-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {isPrinting
                        ? 'Toplu Yazdırılıyor...'
                        : `Toplu Yazdır: ${selectedBulkVariantIds.size} Ürün (Toplam ${selectedBulkVariantIds.size * printQuantity} Etiket)`}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={isPrinting}
                      onClick={() => handleBulkPrintDispatch(false)}
                      className="py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded-lg border border-blue-200 transition flex items-center justify-center space-x-1.5 text-[11px] disabled:opacity-50 cursor-pointer"
                      title="Seçili tüm ürünleri Windows yazdırma penceresi ile önizleyerek yazdır"
                    >
                      <Sliders className="w-3.5 h-3.5 text-blue-700" />
                      <span>Toplu Windows Diyaloğu</span>
                    </button>

                    <button
                      disabled={isPrinting || !selectedVariant}
                      onClick={() => handlePrintDispatch(printQuantity, true)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 transition flex items-center justify-center space-x-1.5 text-[11px] disabled:opacity-50 cursor-pointer"
                      title="Yalnızca önizlenen tekil ürünü yazdır"
                    >
                      <Tag className="w-3.5 h-3.5 text-slate-500" />
                      <span>Yalnızca Önizlenen ({printQuantity} Adet)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-1 space-y-2">
                  <button
                    disabled={isPrinting || !selectedVariant}
                    onClick={() => handlePrintDispatch(printQuantity, true)}
                    className="w-full py-2.5 bg-[#00268A] hover:bg-[#001f70] text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-2 text-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>
                      {isPrinting
                        ? 'Yazdırılıyor...'
                        : `${printQuantity} Adet ${printLayout === 'HORIZONTAL' ? 'Yatay' : '90° Dikey (Askı)'} Etiket Yazdır`}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={isPrinting || !selectedVariant}
                      onClick={() => handlePrintDispatch(printQuantity, false)}
                      className="py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded-lg border border-blue-200 transition flex items-center justify-center space-x-1.5 text-[11px] disabled:opacity-50 cursor-pointer"
                      title="Windows'un kendi yazdırma penceresini açar; kağıt boyutu ve önizlemeyi doğrulamanızı sağlar"
                    >
                      <Sliders className="w-3.5 h-3.5 text-blue-700" />
                      <span>Windows Diyaloğu Aç</span>
                    </button>

                    <button
                      disabled={isPrinting || !selectedVariant}
                      onClick={() => handlePrintDispatch(1, true)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 transition flex items-center justify-center space-x-1.5 text-[11px] disabled:opacity-50 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>1 Adet Test Baskısı</span>
                    </button>
                  </div>
                </div>
              )}

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
                  {printLayout === 'HORIZONTAL'
                    ? `↔ Yatay (${labelWidth}x${labelHeight}mm)`
                    : printLayout === 'ROTATED_VERTICAL'
                    ? `↕ 90° Dikey (Rulo: ${labelWidth}x${labelHeight}mm)`
                    : `↕ Dikey (${labelWidth}x${labelHeight}mm)`}
                </span>
              </div>

              {printLayout === 'ROTATED_VERTICAL' && (
                <div className="w-full bg-blue-50/90 border border-blue-200 text-blue-900 rounded-lg p-2 text-[11px] font-bold flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <TagIcon className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                    <span>Yatay {labelWidth}x{labelHeight} mm kağıda 90° döndürülerek basılır (Sıfır taşma!)</span>
                  </span>
                  <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">
                    Askı Modu
                  </span>
                </div>
              )}

              {selectedVariant ? (
                <div className="py-2 flex justify-center w-full">
                  {/* Dynamic Scaled Thermal Label Preview */}
                  <div
                    className="bg-white text-black border-2 border-slate-800 rounded shadow-md overflow-hidden flex flex-col justify-between select-none transition-all duration-200"
                    style={{
                      width: printLayout === 'HORIZONTAL' ? '280px' : '200px',
                      aspectRatio: printLayout === 'HORIZONTAL'
                        ? `${labelWidth} / ${labelHeight}`
                        : printLayout === 'ROTATED_VERTICAL'
                        ? `${labelHeight} / ${labelWidth}`
                        : `${labelWidth} / ${labelHeight}`,
                      padding: printLayout === 'HORIZONTAL' ? '8px 10px' : '10px 8px',
                    }}
                  >
                    {printLayout === 'HORIZONTAL' ? (
                      /* YATAY CANLI ÖNİZLEME */
                      <div className="h-full flex flex-col justify-between text-center overflow-hidden">
                        <div className="flex justify-between items-center text-[11px] font-black border-b border-black pb-0.5">
                          <span className="uppercase tracking-wider truncate max-w-[60%] text-left">
                            {showStoreName ? effectiveStoreName : ''}
                          </span>
                          <span className="font-mono text-[10px] shrink-0">KOD: {selectedVariant.sku || '-'}</span>
                        </div>

                        <div className="my-auto py-0.5">
                          <div className={`font-black text-black leading-snug line-clamp-2 ${
                            fontScale === 'COMPACT' ? 'text-xs' : fontScale === 'LARGE' ? 'text-sm' : 'text-[13px]'
                          }`}>
                            {selectedVariant.product?.name}
                          </div>
                          <div className="text-[10px] font-bold text-black mt-0.5 truncate">
                            Renk: {selectedVariant.attributes?.color || '-'} | Beden: {selectedVariant.attributes?.size || '-'}
                          </div>
                        </div>

                        <div className="my-0.5 flex flex-col items-center">
                          <div
                            className="w-[85%] max-h-[22px] flex items-center justify-center overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                          />
                          <div className="font-mono text-[11px] font-black tracking-widest text-black mt-0.5">
                            {selectedVariant.barcode}
                          </div>
                        </div>

                        {/* FİYAT ALANI (DENGELİ VE TAŞMAZ) */}
                        {isDiscounted ? (
                          <div className="flex justify-between items-center border-t-2 border-black pt-1">
                            <div className="flex flex-col text-left shrink-0">
                              <span className="text-[8px] font-black text-slate-600 leading-none">ESKİ FİYAT</span>
                              <span className="text-[11px] font-black text-slate-500 line-through leading-tight">
                                {origPriceNum.toFixed(2)} TL
                              </span>
                            </div>
                            <div className="flex flex-col text-right shrink-0">
                              <span className="text-[8px] font-black text-black leading-none">İNDİRİMLİ FİYAT</span>
                              <span className={`font-black text-black leading-none tracking-tight ${
                                fontScale === 'COMPACT' ? 'text-lg' : fontScale === 'LARGE' ? 'text-2xl' : 'text-xl'
                              }`}>
                                {discPriceNum.toFixed(2)} TL
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-between items-end border-t-2 border-black pt-1">
                            <span className="text-[9px] font-black text-black">KDV DAHİLDİR</span>
                            <span className={`font-black text-black leading-none tracking-tight ${
                              fontScale === 'COMPACT' ? 'text-xl' : fontScale === 'LARGE' ? 'text-3xl' : 'text-2xl'
                            }`}>
                              {selectedVariant.salePrice?.toFixed(2)} TL
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* DİKEY / 90° DÖNDÜRÜLMÜŞ CANLI ÖNİZLEME */
                      <div className="h-full flex flex-col justify-between text-center overflow-hidden">
                        <div className="border-b-2 border-black pb-0.5 mb-0.5">
                          <div className="font-black text-xs uppercase tracking-wider truncate">
                            {showStoreName ? effectiveStoreName : ''}
                          </div>
                        </div>

                        <div className={`font-black text-black leading-snug line-clamp-2 my-0.5 ${
                          fontScale === 'COMPACT' ? 'text-[11px]' : fontScale === 'LARGE' ? 'text-sm' : 'text-xs'
                        }`}>
                          {selectedVariant.product?.name}
                        </div>

                        <div className="border border-black rounded p-1 my-0.5 text-left text-[10px] space-y-0.5 font-black">
                          <div className="flex justify-between">
                            <span className="text-slate-800">RENK:</span>
                            <span className="truncate">{selectedVariant.attributes?.color || '-'}</span>
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

                        <div className="my-0.5 flex flex-col items-center">
                          <div
                            className="w-[88%] max-h-[20px] flex items-center justify-center overflow-hidden"
                            dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                          />
                          <div className="font-mono text-[10px] font-black tracking-widest text-black mt-0.5">
                            {selectedVariant.barcode}
                          </div>
                        </div>

                        {/* DİKEY FİYAT KUTUSU */}
                        {isDiscounted ? (
                          <div className="border-2 border-black p-1 text-center mt-0.5 bg-white">
                            <div className="flex justify-between items-center text-[9px] border-b border-black pb-0.5 mb-0.5 font-bold">
                              <span className="text-slate-600">ESKİ FİYAT:</span>
                              <span className="line-through text-slate-500 font-black">{origPriceNum.toFixed(2)} TL</span>
                            </div>
                            <div className="text-[7.5px] font-black text-black">İNDİRİMLİ FİYAT</div>
                            <div className={`font-black text-black leading-none mt-0.5 tracking-tight ${
                              fontScale === 'COMPACT' ? 'text-base' : fontScale === 'LARGE' ? 'text-xl' : 'text-lg'
                            }`}>
                              {discPriceNum.toFixed(2)} TL
                            </div>
                          </div>
                        ) : (
                          <div className="border-2 border-black p-1 text-center mt-0.5 bg-white">
                            <div className="text-[8px] font-bold tracking-wider">FİYAT (KDV DAHİL)</div>
                            <div className={`font-black text-black leading-none mt-0.5 tracking-tight ${
                              fontScale === 'COMPACT' ? 'text-lg' : fontScale === 'LARGE' ? 'text-2xl' : 'text-xl'
                            }`}>
                              {selectedVariant.salePrice?.toFixed(2)} TL
                            </div>
                          </div>
                        )}
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

      <AdminPinModal
        isOpen={isAdminPinOpen}
        onClose={() => setIsAdminPinOpen(false)}
        onVerified={() => {
          setIsAdminPinOpen(false)
          handleSaveDiscountToProduct()
        }}
        title="Yönetici PIN Girişi"
        subtitle="İndirimli fiyatı ürün kartına kalıcı olarak kaydetmek için 6 haneli PIN şifresini girin."
      />
    </div>
  )
}
export default LabelPrinterModal
