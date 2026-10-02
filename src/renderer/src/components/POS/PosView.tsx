import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  Tag,
  CreditCard,
  ShoppingCart,
  RefreshCw,
  Sparkles,
  X,
  Settings2,
  User,
  UserCheck,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  PackageMinus,
} from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'
import { CheckoutModal } from './CheckoutModal'
import { CampaignModal } from './CampaignModal'
import { CustomerSelectModal } from '../Customer/CustomerSelectModal'
import { ExchangeModal } from './ExchangeModal'
import { notifyDataChanged } from '../../utils/events'
import { syncCustomerDisplay } from '../../utils/customerDisplaySync'

export const PosView: React.FC = () => {
  const {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    discountAmount,
    customTotal,
    setCustomTotal,
    applyDiscount,
    campaigns,
    activeCampaign,
    applyCampaign,
    getSubtotal,
    getTotal,
    isLocked,
    selectedCustomer,
    clearSelectedCustomer,
    isStockOnlyMode,
    cashierName,
    receiptPrefix,
    clearCart,
  } = usePosStore()

  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [barcodeInput, setBarcodeInput] = useState<string>('')
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false)
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState<boolean>(false)
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState<boolean>(false)
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isEditingTotal, setIsEditingTotal] = useState<boolean>(false)
  const [tempTotalInput, setTempTotalInput] = useState<string>('')
  const [scanToast, setScanToast] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
    barcode?: string
  } | null>(null)

  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const totalInputRef = useRef<HTMLInputElement>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Web Audio API feedback for scan events
  const playAudioNotification = (type: 'success' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()

      if (type === 'success') {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime) // A5
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08) // E6
        gain.gain.setValueAtTime(0.12, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.08)
      } else {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(220, ctx.currentTime) // A3
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.08)
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.2)
      }
    } catch {
      // Audio not permitted or supported; silently ignore
    }
  }

  const showToast = (type: 'success' | 'error' | 'info', message: string, barcode?: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    setScanToast({ type, message, barcode })
    toastTimeoutRef.current = setTimeout(() => {
      setScanToast(null)
    }, 4500)
  }

  // Direct Stock Deduction in Stock-Only Mode (Processed as Cash in Background)
  const handleDirectStockDeduction = async () => {
    if (cartItems.length === 0 || isLoading) return
    setIsLoading(true)
    try {
      const totalAmount = getTotal()
      const payload = {
        items: cartItems,
        totalAmount,
        discountAmount,
        cashierName: cashierName || 'Kasiyer 1',
        customerId: selectedCustomer ? selectedCustomer.id : null,
        receiptPrefix: receiptPrefix || 'FIS',
        paymentType: { cash: totalAmount, card: 0 },
      }

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        showToast('error', `Hata: ${err.error}`)
        setIsLoading(false)
        return
      }

      const saleData = await res.json()

      // Broadcast completion to customer display without showing prices
      syncCustomerDisplay({
        status: 'completed',
        cartItems,
        subtotal: getSubtotal(),
        discountAmount,
        total: totalAmount,
        hidePrices: true,
        paymentInfo: {
          mode: 'CASH',
          receiptNo: saleData.receiptNo,
          isFinished: true,
        },
      })

      clearCart()
      await fetchProducts()
      notifyDataChanged()
      playAudioNotification('success')
      showToast('success', 'Ürünler stoktan başarıyla düşüldü.')

      // Reset customer display after brief thank you note
      setTimeout(() => {
        syncCustomerDisplay({
          status: 'idle',
          cartItems: [],
          force: true,
          hidePrices: isStockOnlyMode,
        })
      }, 3500)
    } catch (err: any) {
      showToast('error', `İşlem hatası: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const [resProd, resCat] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/products/categories'),
      ])
      const prodData = await resProd.json()
      const catData = await resCat.json()
      setProducts(Array.isArray(prodData) ? prodData : [])
      setCategories(Array.isArray(catData) ? catData : [])
    } catch (err) {
      console.error('Error fetching POS data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()

    const handleDataUpdate = () => {
      fetchProducts()
    }

    // Listen for instant internal data update events
    window.addEventListener('pos-data-updated', handleDataUpdate)

    // Refetch when window regains focus
    window.addEventListener('focus', handleDataUpdate)

    // Silent background poll every 10 seconds for mobile/external updates
    const syncInterval = setInterval(() => {
      fetchProducts()
    }, 10000)

    return () => {
      window.removeEventListener('pos-data-updated', handleDataUpdate)
      window.removeEventListener('focus', handleDataUpdate)
      clearInterval(syncInterval)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  // Safely restore focus to barcode input when app unlocks
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    if (isLocked) {
      setBarcodeInput('')
      barcodeInputRef.current?.blur()
    } else {
      timer = setTimeout(() => {
        barcodeInputRef.current?.focus()
      }, 100)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [isLocked])

  // Core Barcode Lookup Function
  const processBarcodeScan = async (rawCode: string) => {
    const code = rawCode.trim()
    if (!code) return

    try {
      const res = await fetch(`/api/products/variants/barcode/${encodeURIComponent(code)}`)
      if (res.ok) {
        const variant = await res.json()
        addToCart(variant)
        playAudioNotification('success')
        showToast(
          'success',
          `✅ "${variant.product?.name || 'Ürün'}" (${variant.attributes?.color || '-'} / ${
            variant.attributes?.size || '-'
          }) sepete eklendi.`
        )
      } else {
        playAudioNotification('error')
        showToast('error', `⚠️ Barkod sistemde bulunamadı: "${code}"`, code)
      }
    } catch (err: any) {
      console.error('Barkod okuma hatası:', err)
      playAudioNotification('error')
      showToast('error', `⚠️ Barkod okuma bağlantı hatası: ${err.message || ''}`, code)
    } finally {
      setBarcodeInput('')
      // Always safely restore focus to barcode input without blocking
      setTimeout(() => {
        if (
          !isLocked &&
          !isCheckoutOpen &&
          !isCampaignModalOpen &&
          !isCustomerModalOpen &&
          !isExchangeModalOpen &&
          !isEditingTotal
        ) {
          const active = document.activeElement
          if (!active || active === document.body || active === barcodeInputRef.current) {
            barcodeInputRef.current?.focus()
          }
        }
      }, 60)
    }
  }

  // Global Barcode Scanner Capture (USB HID Scanner)
  useEffect(() => {
    let barcodeBuffer = ''
    let lastKeyTime = Date.now()
    let charTimings: number[] = []

    const handleGlobalKeyDown = async (e: KeyboardEvent) => {
      // Never intercept when any modal is open or app is locked
      if (
        isLocked ||
        isCheckoutOpen ||
        isCampaignModalOpen ||
        isCustomerModalOpen ||
        isExchangeModalOpen ||
        isEditingTotal
      ) {
        return
      }

      const activeElement = document.activeElement
      const isBarcodeFieldFocused = activeElement === barcodeInputRef.current
      const isOtherInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'SELECT'

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTime
      lastKeyTime = currentTime

      // Reset buffer if inter-character delay > 120ms
      if (timeDiff > 120) {
        barcodeBuffer = ''
        charTimings = []
      }

      // Handle Enter (Barcode Scanner Suffix)
      if (e.key === 'Enter') {
        const code = barcodeBuffer.trim()
        // If focus was NOT on main barcode input (which handles its own form submission)
        if (!isBarcodeFieldFocused && code.length >= 3) {
          const avgTiming =
            charTimings.length > 0
              ? charTimings.reduce((a, b) => a + b, 0) / charTimings.length
              : 999
          const isRapidScanner = avgTiming < 45

          // Only process as scanner if not in another text input, OR if rapid HW scanner detected
          if (!isOtherInputFocused || isRapidScanner) {
            e.preventDefault()
            e.stopPropagation()
            barcodeBuffer = ''
            charTimings = []
            await processBarcodeScan(code)
            return
          }
        }
        barcodeBuffer = ''
        charTimings = []
        return
      }

      // Capture single printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isOtherInputFocused || isBarcodeFieldFocused || timeDiff < 40) {
          barcodeBuffer += e.key
          charTimings.push(timeDiff)
          if (charTimings.length > 30) charTimings.shift()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    isLocked,
    isCheckoutOpen,
    isCampaignModalOpen,
    isCustomerModalOpen,
    isExchangeModalOpen,
    isEditingTotal,
    addToCart,
  ])

  // Periodic Idle Focus Keeper - only focuses barcode input when idle & no modal is open
  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (
        !isLocked &&
        !isCheckoutOpen &&
        !isCampaignModalOpen &&
        !isCustomerModalOpen &&
        !isExchangeModalOpen &&
        !isEditingTotal
      ) {
        const active = document.activeElement
        const isAnyInputFocused =
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          active?.tagName === 'SELECT'

        if (!isAnyInputFocused) {
          barcodeInputRef.current?.focus()
        }
      }
    }, 1500)

    return () => clearInterval(focusInterval)
  }, [
    isLocked,
    isCheckoutOpen,
    isCampaignModalOpen,
    isCustomerModalOpen,
    isExchangeModalOpen,
    isEditingTotal,
  ])

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = barcodeInput.trim()
    if (!code) return
    await processBarcodeScan(code)
  }

  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'ALL' || prod.categoryId === selectedCategory
    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.code.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleStartEditTotal = () => {
    const currentTotal = getTotal()
    setTempTotalInput(currentTotal.toFixed(2))
    setIsEditingTotal(true)
    setTimeout(() => {
      totalInputRef.current?.select()
    }, 50)
  }

  const handleCustomTotalSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const parsed = parseFloat(tempTotalInput)
    if (!isNaN(parsed) && parsed >= 0) {
      setCustomTotal(parsed)
    }
    setIsEditingTotal(false)
  }

  const subtotal = getSubtotal()
  const total = getTotal()

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 flex overflow-hidden font-sans relative">
      {/* Toast Notification Banner */}
      {scanToast && (
        <div
          className={`absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-3 px-4 py-2.5 rounded-xl shadow-2xl border transition-all animate-in fade-in slide-in-from-top-2 duration-150 max-w-lg ${
            scanToast.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-rose-900/10'
              : scanToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-emerald-900/10'
              : 'bg-blue-50 border-blue-300 text-blue-950 shadow-blue-900/10'
          }`}
        >
          {scanToast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : scanToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <Tag className="w-5 h-5 text-blue-600 shrink-0" />
          )}
          <div className="text-xs">
            <p className="font-bold leading-tight">{scanToast.message}</p>
            {scanToast.type === 'error' && (
              <p className="text-[11px] text-rose-700 mt-0.5">
                Yeni ürün veya varyant tanımlamak için <strong>Stok & Varyant</strong> sekmesini kullanabilirsiniz.
              </p>
            )}
          </div>
          <button
            onClick={() => setScanToast(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-slate-400 hover:text-slate-700 transition shrink-0 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* LEFT COLUMN: Product Catalog & Quick Touch Grid */}
      <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden">
        {/* Top Search & Barcode Bar */}
        <div className="p-3 glass-panel border-b border-white/50 flex items-center space-x-3 shadow-xs">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Barkod okutun veya manuel yazın..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-white/70 backdrop-blur-xs border border-slate-300/80 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00268A] font-mono text-xs shadow-inner"
              />
              <Barcode className="w-4 h-4 text-[#00268A] absolute left-3 top-2.5" />
              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => setBarcodeInput('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={!barcodeInput.trim()}
              className="px-3.5 py-2 bg-[#00268A] hover:bg-[#001f70] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5 shrink-0"
              title="Barkodu Ara / Sepete Ekle"
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Ekle</span>
            </button>
          </form>

          <div className="w-64 flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Ürün adı ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-2 bg-white/70 backdrop-blur-xs border border-slate-300/80 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00268A] font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {}}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1 shrink-0"
              title="Ürün Ara"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Ara</span>
            </button>
          </div>

          <button
            onClick={fetchProducts}
            className="p-2 bg-white/80 hover:bg-white text-slate-700 rounded-xl border border-slate-300/80 transition shadow-2xs backdrop-blur-xs"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Categories Horizontal Bar */}
        <div className="px-3 py-2 glass-subtle border-b border-white/40 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'ALL'
                ? 'bg-[#00268A] text-white shadow-sm'
                : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 border border-white/80 backdrop-blur-xs'
            }`}
          >
            Tüm Kategoriler
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#00268A] text-white shadow-sm'
                  : 'bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900 border border-white/80 backdrop-blur-xs'
              }`}
            >
              {cat.name} ({cat._count?.products || 0})
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div className="flex-1 p-3.5 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="glass-card rounded-2xl p-3.5 flex flex-col justify-between hover:shadow-lg transition-all group"
            >
              <div>
                <span className="text-xs font-bold text-[#00268A] bg-blue-50/80 px-2.5 py-0.5 rounded-full border border-blue-200/60 uppercase tracking-tight backdrop-blur-xs">
                  {prod.category?.name || 'Giyim'}
                </span>
                <h3 className="font-extrabold text-slate-900 text-sm mt-1.5 leading-snug group-hover:text-[#00268A] transition-colors">
                  {prod.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{prod.code}</p>
              </div>

              {/* Variants Quick Add Buttons */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/50 space-y-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase block">Varyantlar:</span>
                <div className="flex flex-wrap gap-1.5">
                  {prod.variants?.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => addToCart({ ...v, product: prod })}
                      disabled={v.stockQuantity <= 0}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center space-x-1.5 transition ${
                        v.stockQuantity <= 0
                          ? 'bg-slate-100/60 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-50'
                          : 'bg-white/90 border-slate-200/80 text-slate-800 hover:bg-[#00268A] hover:border-[#00268A] hover:text-white shadow-2xs backdrop-blur-xs'
                      }`}
                    >
                      <span>
                        {v.attributes?.color || ''} {v.attributes?.size || ''}
                      </span>
                      {!isStockOnlyMode && (
                        <span className="font-extrabold text-emerald-700 group-hover:text-white">
                          {v.salePrice}₺
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: POS Cart & Checkout (Kasa Sepeti) */}
      <div className="w-96 glass-panel flex flex-col h-full shadow-2xl border-l border-white/60">
        {/* Cart Header */}
        <div className="px-4 py-3 border-b border-white/40 flex items-center justify-between bg-white/40 backdrop-blur-xs">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-4 h-4 text-[#00268A]" />
            <h2 className="font-bold text-slate-900 text-xs tracking-tight">Kasa Sepeti</h2>
          </div>
          <div className="flex items-center space-x-2">
            {cartItems.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Sepetteki tüm ürünler temizlensin mi?')) {
                    clearCart()
                  }
                }}
                className="text-[11px] text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-0.5 rounded transition font-semibold"
                title="Sepeti Temizle"
              >
                Temizle
              </button>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100/70 text-[#00268A] text-[11px] font-bold border border-blue-200/80 shadow-2xs">
              {cartItems.reduce((acc, i) => acc + i.quantity, 0)} Kalem
            </span>
          </div>
        </div>

        {/* Customer Selection Banner */}
        <div className="px-3.5 py-2 border-b border-white/40 bg-white/30 backdrop-blur-xs flex items-center justify-between text-xs">
          {selectedCustomer ? (
            <div className="flex items-center space-x-2 overflow-hidden mr-2">
              <UserCheck className="w-4 h-4 text-[#00268A] shrink-0" />
              <div className="truncate">
                <span className="font-bold text-slate-900 truncate">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block truncate">
                  {selectedCustomer.phone}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-slate-500 font-medium">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Müşteri: Anonim Satış</span>
            </div>
          )}

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => setIsExchangeModalOpen(true)}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[11px] font-semibold transition flex items-center space-x-1 shadow-2xs"
              title="Eski Fişten Beden / Ürün Değişimi Yap (Sıfır Fark)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Değişim</span>
            </button>
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-[#00268A] border border-blue-200 rounded text-[11px] font-semibold transition shadow-2xs"
            >
              {selectedCustomer ? 'Değiştir' : 'Müşteri Seç'}
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 p-3 overflow-y-auto space-y-2">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
              <Barcode className="w-10 h-10 stroke-[1.5] mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">Sepetiniz Boş</p>
              <p className="text-[11px] text-slate-400 mt-1">Barkod okutarak veya ürün seçerek işlem başlatın.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.variantId}
                className="glass-card rounded-xl p-2.5 flex flex-col space-y-1.5 shadow-xs transition-all hover:bg-white"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-snug">{item.productName}</h4>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="px-2 py-0.5 bg-white/95 rounded-md text-xs text-slate-800 font-bold border border-slate-200 shadow-2xs">
                        {item.attributes?.color || '-'} / {item.attributes?.size || '-'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{item.barcode}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.variantId)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60">
                  <div className="flex items-center space-x-1.5 bg-white/90 border border-slate-300/80 rounded-xl p-1 shadow-2xs backdrop-blur-xs">
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-sm"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-extrabold text-sm text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!isStockOnlyMode && (
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-medium block">
                        Birim: {(item.unitPrice || 0).toFixed(2)}₺
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm">
                        {(item.totalPrice || 0).toFixed(2)} ₺
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary & Action Area */}
        <div className="p-3.5 glass-panel border-t border-white/60 space-y-2.5">
          {isStockOnlyMode ? (
            /* Stock Only Mode - No Money / Clean Item Counter */
            <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                  Stok Çıkış Özeti
                </span>
                <span className="text-xs text-slate-600 font-medium">
                  {cartItems.length} Kalem Ürün
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-rose-800">
                  {cartItems.reduce((acc, i) => acc + i.quantity, 0)} Adet
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Campaign Header & Settings Trigger */}
              <div className="flex items-center justify-between">
                <span className="text-slate-700 font-semibold text-xs flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Kampanya & İndirim</span>
                </span>

                <button
                  onClick={() => setIsCampaignModalOpen(true)}
                  className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-medium transition flex items-center space-x-1"
                >
                  <Settings2 className="w-3 h-3" />
                  <span>Ayarla</span>
                </button>
              </div>

              {/* Preset Campaign Buttons Grid */}
              <div className="flex flex-wrap gap-1">
                {campaigns.map((camp) => {
                  const isActive = activeCampaign?.id === camp.id
                  return (
                    <button
                      key={camp.id}
                      onClick={() => {
                        if (isActive) {
                          applyCampaign(null)
                        } else {
                          applyCampaign(camp)
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition ${
                        isActive
                          ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/50'
                      }`}
                    >
                      {camp.name}
                    </button>
                  )
                })}
              </div>

              {/* Active Campaign Badge Notice */}
              {activeCampaign && (
                <div className="bg-amber-50 border border-amber-200 rounded p-1.5 flex items-center justify-between text-xs text-amber-800 font-medium">
                  <div className="flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    <span>Kampanya: {activeCampaign.name}</span>
                  </div>
                  <button
                    onClick={() => applyCampaign(null)}
                    className="text-amber-600 hover:text-amber-900 p-0.5"
                    title="Kampanyayı İptal Et"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Totals Summary */}
              <div className="space-y-1 text-xs text-slate-700 pt-1 border-t border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Ara Toplam</span>
                  <span className="font-semibold">{subtotal.toFixed(2)} ₺</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>İndirim Tutarı</span>
                    <span>-{discountAmount.toFixed(2)} ₺</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>GENEL TOPLAM</span>

                  {isEditingTotal ? (
                    <form onSubmit={handleCustomTotalSubmit} className="flex items-center space-x-1">
                      <input
                        ref={totalInputRef}
                        type="number"
                        step="0.01"
                        min="0"
                        value={tempTotalInput}
                        onChange={(e) => setTempTotalInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setIsEditingTotal(false)
                        }}
                        onBlur={handleCustomTotalSubmit}
                        className="w-24 px-2 py-0.5 border-2 border-emerald-500 rounded text-right font-bold text-base text-emerald-700 focus:outline-none bg-emerald-50 shadow-inner"
                        autoFocus
                      />
                      <span className="text-emerald-700 text-base font-bold">₺</span>
                    </form>
                  ) : (
                    <div
                      onDoubleClick={handleStartEditTotal}
                      className="cursor-pointer hover:bg-emerald-50 hover:scale-[1.02] px-2 py-0.5 rounded transition-all select-none"
                    >
                      <span className="text-emerald-700 text-lg font-bold">
                        {total.toFixed(2)} ₺
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Checkout or Direct Stock Deduction Trigger */}
          {isStockOnlyMode ? (
            <button
              disabled={cartItems.length === 0 || isLoading}
              onClick={handleDirectStockDeduction}
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-md transition flex items-center justify-center space-x-2.5 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <PackageMinus className="w-5 h-5 stroke-[2.2]" />
              <span>STOKTAN DÜŞ</span>
            </button>
          ) : (
            <button
              disabled={cartItems.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md transition flex items-center justify-center space-x-2.5 text-sm tracking-wide disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <CreditCard className="w-5 h-5 stroke-[2.2]" />
              <span>ÖDEME AL / TAHSİLAT</span>
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={fetchProducts}
      />

      <CampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
      />

      <CustomerSelectModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
      />

      <ExchangeModal
        isOpen={isExchangeModalOpen}
        onClose={() => setIsExchangeModalOpen(false)}
      />
    </div>
  )
}
