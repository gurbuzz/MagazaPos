import React, { useState, useMemo } from 'react'
import {
  Sparkles,
  Tag,
  Percent,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  X,
  Layers,
  ArrowRight,
  ShieldAlert,
  RotateCcw
} from 'lucide-react'

const parseDecimal = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = String(val).replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

const getVariantAttrs = (v: any): { color: string; size: string } => {
  if (!v) return { color: 'Standart', size: '-' }
  let attrs = v.attributes
  if (typeof attrs === 'string') {
    try {
      attrs = JSON.parse(attrs)
    } catch {
      attrs = {}
    }
  }
  const color = (attrs?.color || attrs?.Renk || attrs?.renk || 'Standart').trim()
  const size = (attrs?.size || attrs?.Beden || attrs?.beden || '-').trim()
  return { color: color || 'Standart', size: size || '-' }
}

interface BulkVariantPriceModalProps {
  isOpen: boolean
  onClose: () => void
  product: any
  preselectedVariantIds?: string[]
  adminVerified: boolean
  onRequestAdminPin: (callback: () => Promise<void>) => void
  onSuccess: (message: string) => void
}

type SalePriceAction = 'keep' | 'fixed' | 'increase_percent' | 'decrease_percent' | 'increase_amount' | 'decrease_amount'
type DiscountAction = 'keep' | 'remove' | 'fixed' | 'percent_off' | 'amount_off'
type CostPriceAction = 'keep' | 'fixed' | 'percent_of_sale'
type RoundingOption = 'none' | 'round' | 'ending_90' | 'ending_99'

export const BulkVariantPriceModal: React.FC<BulkVariantPriceModalProps> = ({
  isOpen,
  onClose,
  product,
  preselectedVariantIds = [],
  adminVerified,
  onRequestAdminPin,
  onSuccess,
}) => {
  if (!isOpen || !product) return null

  const variants: any[] = product.variants || []

  // Scope filter states
  const [scopeType, setScopeType] = useState<'all' | 'selected' | 'color' | 'size'>(
    preselectedVariantIds.length > 0 ? 'selected' : 'all'
  )
  const [selectedColor, setSelectedColor] = useState<string>('ALL')
  const [selectedSize, setSelectedSize] = useState<string>('ALL')

  // Available unique colors and sizes
  const uniqueColors = useMemo(() => {
    const set = new Set<string>()
    variants.forEach((v) => {
      const { color } = getVariantAttrs(v)
      if (color) set.add(color)
    })
    return Array.from(set).sort()
  }, [variants])

  const uniqueSizes = useMemo(() => {
    const set = new Set<string>()
    variants.forEach((v) => {
      const { size } = getVariantAttrs(v)
      if (size && size !== '-') set.add(size)
    })
    return Array.from(set).sort()
  }, [variants])

  // Sale Price Action
  const [salePriceAction, setSalePriceAction] = useState<SalePriceAction>('keep')
  const [salePriceValue, setSalePriceValue] = useState<string>('')

  // Discount Action
  const [discountAction, setDiscountAction] = useState<DiscountAction>('keep')
  const [discountValue, setDiscountValue] = useState<string>('')

  // Cost Price Action
  const [costPriceAction, setCostPriceAction] = useState<CostPriceAction>('keep')
  const [costPriceValue, setCostPriceValue] = useState<string>('')

  // Rounding
  const [rounding, setRounding] = useState<RoundingOption>('none')

  // UI / State helpers
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [previewSearch, setPreviewSearch] = useState('')

  // Compute targeted variants based on scope
  const targetVariants = useMemo(() => {
    return variants.filter((v) => {
      if (scopeType === 'selected') {
        return preselectedVariantIds.includes(v.id)
      }
      if (scopeType === 'color') {
        if (selectedColor === 'ALL') return true
        return getVariantAttrs(v).color === selectedColor
      }
      if (scopeType === 'size') {
        if (selectedSize === 'ALL') return true
        return getVariantAttrs(v).size === selectedSize
      }
      return true
    })
  }, [variants, scopeType, preselectedVariantIds, selectedColor, selectedSize])

  // Rounding helper
  const applyRounding = (val: number): number => {
    if (isNaN(val) || val < 0) return 0
    if (rounding === 'round') {
      return Math.round(val)
    } else if (rounding === 'ending_90') {
      if (val < 1) return 0.90
      const base = Math.floor(val) + 0.90
      return Math.round((base > val ? base - 1 : base) * 100) / 100
    } else if (rounding === 'ending_99') {
      if (val < 1) return 0.99
      const base = Math.floor(val) + 0.99
      return Math.round((base > val ? base - 1 : base) * 100) / 100
    }
    return Math.round(val * 100) / 100
  }

  // Live preview calculation for each target variant
  const previewList = useMemo(() => {
    const sVal = parseDecimal(salePriceValue)
    const dVal = parseDecimal(discountValue)
    const cVal = parseDecimal(costPriceValue)

    return targetVariants.map((v) => {
      const oldSalePrice = Number(v.salePrice) || 0
      const oldDiscountPrice = v.discountPrice != null && v.discountPrice > 0 ? Number(v.discountPrice) : null
      const oldCostPrice = Number(v.costPrice) || 0

      // Calculate new sale price
      let newSalePrice = oldSalePrice
      if (salePriceAction === 'fixed') {
        newSalePrice = applyRounding(sVal)
      } else if (salePriceAction === 'increase_percent') {
        newSalePrice = applyRounding(oldSalePrice * (1 + sVal / 100))
      } else if (salePriceAction === 'decrease_percent') {
        newSalePrice = applyRounding(Math.max(0, oldSalePrice * (1 - sVal / 100)))
      } else if (salePriceAction === 'increase_amount') {
        newSalePrice = applyRounding(oldSalePrice + sVal)
      } else if (salePriceAction === 'decrease_amount') {
        newSalePrice = applyRounding(Math.max(0, oldSalePrice - sVal))
      }

      // Calculate new discount price
      let newDiscountPrice: number | null = oldDiscountPrice
      if (discountAction === 'remove') {
        newDiscountPrice = null
      } else if (discountAction === 'fixed') {
        newDiscountPrice = dVal > 0 ? applyRounding(dVal) : null
      } else if (discountAction === 'percent_off') {
        if (dVal > 0 && dVal < 100) {
          newDiscountPrice = applyRounding(newSalePrice * (1 - dVal / 100))
        } else {
          newDiscountPrice = null
        }
      } else if (discountAction === 'amount_off') {
        if (dVal > 0 && dVal < newSalePrice) {
          newDiscountPrice = applyRounding(newSalePrice - dVal)
        } else {
          newDiscountPrice = null
        }
      }

      // Discount validation: must be strictly less than newSalePrice and > 0
      if (newDiscountPrice !== null && (newDiscountPrice >= newSalePrice || newDiscountPrice <= 0)) {
        newDiscountPrice = null
      }

      // Calculate new cost price
      let newCostPrice = oldCostPrice
      if (costPriceAction === 'fixed') {
        newCostPrice = applyRounding(cVal)
      } else if (costPriceAction === 'percent_of_sale') {
        newCostPrice = applyRounding(newSalePrice * (cVal / 100))
      }

      // Effective POS checkout price
      const effectivePrice = newDiscountPrice !== null && newDiscountPrice > 0 ? newDiscountPrice : newSalePrice

      // Price changed indicator
      const saleDiff = newSalePrice - oldSalePrice
      const hasDiscountChanged = newDiscountPrice !== oldDiscountPrice

      return {
        variant: v,
        attrs: getVariantAttrs(v),
        oldSalePrice,
        newSalePrice,
        saleDiff,
        oldDiscountPrice,
        newDiscountPrice,
        hasDiscountChanged,
        newCostPrice,
        effectivePrice,
      }
    })
  }, [
    targetVariants,
    salePriceAction,
    salePriceValue,
    discountAction,
    discountValue,
    costPriceAction,
    costPriceValue,
    rounding,
  ])

  // Filtered preview based on search
  const filteredPreview = useMemo(() => {
    if (!previewSearch.trim()) return previewList
    const term = previewSearch.trim().toLowerCase()
    return previewList.filter((item) => {
      const { color, size } = item.attrs
      const barcode = item.variant.barcode || ''
      const sku = item.variant.sku || ''
      return (
        color.toLowerCase().includes(term) ||
        size.toLowerCase().includes(term) ||
        barcode.toLowerCase().includes(term) ||
        sku.toLowerCase().includes(term)
      )
    })
  }, [previewList, previewSearch])

  // Execution handler
  const handleExecute = async () => {
    setErrorMsg(null)

    if (targetVariants.length === 0) {
      setErrorMsg('Güncellenecek varyant bulunamadı. Lütfen filtre veya seçimleri kontrol edin.')
      return
    }

    if (salePriceAction !== 'keep' && !salePriceValue) {
      setErrorMsg('Lütfen satış fiyatı için geçerli bir değer girin.')
      return
    }

    if (discountAction !== 'keep' && discountAction !== 'remove' && !discountValue) {
      setErrorMsg('Lütfen iskonto / indirim için geçerli bir değer girin.')
      return
    }

    const doSubmit = async () => {
      setIsSubmitting(true)
      try {
        const payload = {
          variantIds: targetVariants.map((v) => v.id),
          productId: product.id,
          salePriceAction,
          salePriceValue: parseDecimal(salePriceValue),
          discountAction,
          discountValue: parseDecimal(discountValue),
          costPriceAction,
          costPriceValue: parseDecimal(costPriceValue),
          rounding,
          syncBasePrice: true,
        }

        const res = await fetch('/api/products/variants/bulk-price-discount', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Pin': localStorage.getItem('pos_admin_pin_session') || '',
          },
          body: JSON.stringify(payload),
        })

        const data = await res.json()
        if (res.ok) {
          onSuccess(data.message || `${targetVariants.length} varyantın fiyat ve iskontosu güncellendi.`)
          onClose()
        } else {
          setErrorMsg(data.error || 'Toplu fiyat güncelleme işlemi başarısız oldu.')
        }
      } catch (err: any) {
        setErrorMsg('Bağlantı hatası: ' + err.message)
      } finally {
        setIsSubmitting(false)
      }
    }

    if (adminVerified) {
      await doSubmit()
    } else {
      onRequestAdminPin(doSubmit)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#00268A] to-indigo-800 text-white p-4 px-6 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Toplu Varyant Fiyatı & İskonto Düzenleme
                </h2>
                <span className="text-[10px] bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                  Toplu İşlem
                </span>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-0.5">
                Ürün: <strong className="text-white">{product.name}</strong> ({product.code}) • Toplam{' '}
                {variants.length} varyant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-800 bg-slate-50/60">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start space-x-2 animate-fadeIn shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="flex-1 leading-snug">{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-400 hover:text-rose-600 font-bold ml-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* 1. Scope Selection (Kapsam) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                  1. İşlem Kapsamı (Hangi Varyantlar?)
                </span>
              </div>
              <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                ⚡ {targetVariants.length} Varyant Seçili
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setScopeType('all')}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex flex-col justify-between ${
                  scopeType === 'all'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Tüm Varyantlar</span>
                <span className="text-sm font-extrabold text-slate-900 mt-1">{variants.length} Varyant</span>
              </button>

              <button
                type="button"
                onClick={() => setScopeType('selected')}
                disabled={preselectedVariantIds.length === 0}
                className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex flex-col justify-between ${
                  preselectedVariantIds.length === 0
                    ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed text-slate-400'
                    : scopeType === 'selected'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="text-slate-500 text-[10px] uppercase font-semibold">Tabloda Seçilenler</span>
                <span className="text-sm font-extrabold text-slate-900 mt-1">
                  {preselectedVariantIds.length} Varyant
                </span>
              </button>

              <div
                className={`p-2 rounded-xl border text-xs font-bold flex flex-col justify-between ${
                  scopeType === 'color'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Renge Göre</span>
                  <input
                    type="radio"
                    name="scope_radio"
                    checked={scopeType === 'color'}
                    onChange={() => setScopeType('color')}
                    className="accent-blue-600"
                  />
                </div>
                <select
                  value={selectedColor}
                  onChange={(e) => {
                    setScopeType('color')
                    setSelectedColor(e.target.value)
                  }}
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-bold text-slate-800"
                >
                  <option value="ALL">Tüm Renkler</option>
                  {uniqueColors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={`p-2 rounded-xl border text-xs font-bold flex flex-col justify-between ${
                  scopeType === 'size'
                    ? 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-500/30 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[10px] uppercase font-semibold">Bedene Göre</span>
                  <input
                    type="radio"
                    name="scope_radio"
                    checked={scopeType === 'size'}
                    onChange={() => setScopeType('size')}
                    className="accent-blue-600"
                  />
                </div>
                <select
                  value={selectedSize}
                  onChange={(e) => {
                    setScopeType('size')
                    setSelectedSize(e.target.value)
                  }}
                  className="mt-1 w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-bold text-slate-800"
                >
                  <option value="ALL">Tüm Bedenler</option>
                  {uniqueSizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Price and Discount Settings (İki Kart Yan Yana) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Satış Fiyatı Düzenleme Kartı */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <Tag className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                  2. Satış Fiyatı (Normal Liste Fiyatı)
                </h3>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Uygulanacak İşlem</label>
                <select
                  value={salePriceAction}
                  onChange={(e) => {
                    setSalePriceAction(e.target.value as SalePriceAction)
                    if (e.target.value === 'keep') setSalePriceValue('')
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="keep">Aynen Kalsın (Değiştirme)</option>
                  <option value="fixed">Sabit Yeni Satış Fiyatı Belirle (₺)</option>
                  <option value="increase_percent">Yüzdesel Zam / Artış Yap (+%)</option>
                  <option value="decrease_percent">Yüzdesel İndirim Yap (-%)</option>
                  <option value="increase_amount">Tutarsal Artış Ekle (+₺)</option>
                  <option value="decrease_amount">Tutarsal İndirim Yap (-₺)</option>
                </select>
              </div>

              {salePriceAction !== 'keep' && (
                <div className="space-y-2 pt-1 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700">
                      {salePriceAction === 'fixed'
                        ? 'Yeni Fiyat Tutarı (₺)'
                        : salePriceAction.includes('percent')
                        ? 'Uygulanacak Yüzde (%)'
                        : 'Uygulanacak Tutar (₺)'}
                    </label>
                    {salePriceAction.includes('percent') && (
                      <span className="text-[10px] text-slate-400 font-mono">Örn: 20 yazarsanız %20 uygular</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      placeholder={salePriceAction === 'fixed' ? 'Örn: 499.90' : 'Örn: 20'}
                      value={salePriceValue}
                      onChange={(e) => setSalePriceValue(e.target.value)}
                      className="w-full bg-emerald-50/50 border border-emerald-300 rounded-lg p-2 text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-emerald-600">
                      {salePriceAction.includes('percent') ? '%' : '₺'}
                    </span>
                  </div>

                  {/* Quick percentage buttons */}
                  {salePriceAction.includes('percent') && (
                    <div className="flex items-center space-x-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">Hızlı Seç:</span>
                      {[10, 15, 20, 25, 30, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setSalePriceValue(pct.toString())}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded text-[10px] font-bold border border-slate-200 transition"
                        >
                          %{pct}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* İskonto / Kampanya Fiyatı Düzenleme Kartı */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <Percent className="w-4 h-4 text-rose-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                  3. İskonto / Kampanyalı Fiyat
                </h3>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">İskonto İşlemi</label>
                <select
                  value={discountAction}
                  onChange={(e) => {
                    setDiscountAction(e.target.value as DiscountAction)
                    if (e.target.value === 'keep' || e.target.value === 'remove') setDiscountValue('')
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500"
                >
                  <option value="keep">Aynen Kalsın (Değiştirme)</option>
                  <option value="percent_off">Satış Fiyatından % İskonto Tanımla (örn: %25 indirim)</option>
                  <option value="fixed">Sabit İndirimli Fiyat Belirle (₺)</option>
                  <option value="amount_off">Satış Fiyatından Sabit Tutar Düş (-₺)</option>
                  <option value="remove">❌ İskontoyu / İndirimi Tamamen Kaldır (Normal Fiyat)</option>
                </select>
              </div>

              {discountAction !== 'keep' && discountAction !== 'remove' && (
                <div className="space-y-2 pt-1 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-700">
                      {discountAction === 'fixed'
                        ? 'İndirimli Satış Fiyatı (₺)'
                        : discountAction === 'percent_off'
                        ? 'İskonto Yüzdesi (%)'
                        : 'İndirilecek Tutar (₺)'}
                    </label>
                    {discountAction === 'percent_off' && (
                      <span className="text-[10px] text-slate-400 font-mono">Örn: 30 yazarsanız %30 düşer</span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      placeholder={discountAction === 'fixed' ? 'Örn: 299.90' : 'Örn: 25'}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-full bg-rose-50/50 border border-rose-300 rounded-lg p-2 text-sm font-bold text-rose-800 focus:ring-2 focus:ring-rose-500"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-rose-600">
                      {discountAction === 'percent_off' ? '%' : '₺'}
                    </span>
                  </div>

                  {/* Quick discount percentage buttons */}
                  {discountAction === 'percent_off' && (
                    <div className="flex items-center space-x-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">Hızlı Seç:</span>
                      {[15, 20, 25, 30, 40, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountValue(pct.toString())}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-800 rounded text-[10px] font-bold border border-slate-200 transition"
                        >
                          %{pct}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {discountAction === 'remove' && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs font-semibold flex items-center space-x-2 animate-fadeIn">
                  <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Seçili varyantların tüm indirimleri kaldırılarak normal satış fiyatına dönecektir.</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Yuvarlama & Maliyet Kolaylıkları (Katlanabilir/Yatay) */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Kuruş Yuvarlama / Fiyat Şablonu
              </label>
              <select
                value={rounding}
                onChange={(e) => setRounding(e.target.value as RoundingOption)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800"
              >
                <option value="none">Standart (Hesaplanan Kuruş)</option>
                <option value="round">Tam Sayıya Yuvarla (örn: 350.00 ₺)</option>
                <option value="ending_90">Psikolojik Fiyat: Sonu .90 (örn: 349.90 ₺)</option>
                <option value="ending_99">Psikolojik Fiyat: Sonu .99 (örn: 349.99 ₺)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Alış / Maliyet Fiyatı (Opsiyonel)
              </label>
              <div className="flex space-x-2">
                <select
                  value={costPriceAction}
                  onChange={(e) => {
                    setCostPriceAction(e.target.value as CostPriceAction)
                    if (e.target.value === 'keep') setCostPriceValue('')
                  }}
                  className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="keep">Aynen Kalsın</option>
                  <option value="fixed">Sabit Maliyet (₺)</option>
                  <option value="percent_of_sale">Satışın %'si</option>
                </select>
                {costPriceAction !== 'keep' && (
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Değer"
                    value={costPriceValue}
                    onChange={(e) => setCostPriceValue(e.target.value)}
                    className="w-1/2 bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 4. Canlı Değişiklik Önizleme Tablosu */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                  Canlı Önizleme ({previewList.length} Varyant)
                </span>
              </div>
              <div className="w-48">
                <input
                  type="text"
                  placeholder="Önizlemede ara (Renk, Beden, Barkod)..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold uppercase tracking-wider text-[10px] sticky top-0 shadow-2xs">
                  <tr>
                    <th className="px-3 py-2">Renk / Beden</th>
                    <th className="px-3 py-2">Barkod</th>
                    <th className="px-3 py-2 text-right">Eski Satış</th>
                    <th className="px-3 py-2 text-right">Yeni Satış</th>
                    <th className="px-3 py-2 text-right">Yeni İskontolu</th>
                    <th className="px-3 py-2 text-right font-bold text-indigo-900">Kasada Geçerli Fiyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredPreview.map((item) => {
                    const hasDiscount = item.newDiscountPrice !== null && item.newDiscountPrice > 0
                    return (
                      <tr key={item.variant.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">
                          {item.attrs.color} / <span className="text-blue-700">{item.attrs.size}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                          {item.variant.barcode || '-'}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-slate-400">
                          {item.oldSalePrice.toFixed(2)} ₺
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              item.saleDiff > 0
                                ? 'text-emerald-700'
                                : item.saleDiff < 0
                                ? 'text-rose-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {item.newSalePrice.toFixed(2)} ₺
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {hasDiscount ? (
                            <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-black text-[11px]">
                              {item.newDiscountPrice!.toFixed(2)} ₺
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className="font-extrabold text-sm text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                            {item.effectivePrice.toFixed(2)} ₺
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredPreview.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-slate-400 italic">
                        Kriterlere uyan varyant bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 p-4 px-6 flex items-center justify-between shrink-0 shadow-lg">
          <div className="text-xs text-slate-500">
            <span className="font-bold text-slate-800">{targetVariants.length}</span> adet varyant güncellenecek.
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleExecute}
              disabled={isSubmitting || targetVariants.length === 0}
              className="px-5 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Kaydediliyor...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Değişiklikleri Uygula ve Kaydet ({targetVariants.length} Varyant)</span>
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-200 opacity-70" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
