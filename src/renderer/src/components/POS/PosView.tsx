import React, { useState, useEffect, useRef } from 'react'
import { Search, Barcode, Trash2, Plus, Minus, Tag, CreditCard, ShoppingCart, RefreshCw, Sparkles, X, Settings2 } from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'
import { CheckoutModal } from './CheckoutModal'
import { CampaignModal } from './CampaignModal'

export const PosView: React.FC = () => {
  const {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    discountAmount,
    applyDiscount,
    campaigns,
    activeCampaign,
    applyCampaign,
    getSubtotal,
    getTotal,
    isLocked,
  } = usePosStore()

  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [barcodeInput, setBarcodeInput] = useState<string>('')
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false)
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const fetchProducts = async () => {
    setIsLoading(true)
    try {
      const [resProd, resCat] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/products/categories'),
      ])
      const prodData = await resProd.json()
      const catData = await resCat.json()
      setProducts(prodData || [])
      setCategories(catData || [])
    } catch (err) {
      console.error('Error fetching POS data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (isLocked) {
      setBarcodeInput('')
      barcodeInputRef.current?.blur()
    }
  }, [isLocked])

  useEffect(() => {
    const focusInterval = setInterval(() => {
      if (!isLocked && !isCheckoutOpen && !isCampaignModalOpen) {
        if (
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA' &&
          document.activeElement?.tagName !== 'SELECT'
        ) {
          barcodeInputRef.current?.focus()
        }
      }
    }, 1500)
    return () => clearInterval(focusInterval)
  }, [isLocked, isCheckoutOpen, isCampaignModalOpen])

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = barcodeInput.trim()
    if (!code) return

    try {
      const res = await fetch(`/api/products/variants/barcode/${encodeURIComponent(code)}`)
      if (!res.ok) {
        alert('Barkod sistemde bulunamadı!')
        setBarcodeInput('')
        return
      }
      const variant = await res.json()
      addToCart(variant)
      setBarcodeInput('')
    } catch (err) {
      alert('Barkod okuma hatası')
    }
  }

  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'ALL' || prod.categoryId === selectedCategory
    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.code.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const subtotal = getSubtotal()
  const total = getTotal()

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 flex overflow-hidden font-sans">
      {/* LEFT COLUMN: Product Catalog & Quick Touch Grid */}
      <div className="flex-1 flex flex-col border-r border-slate-200 overflow-hidden">
        {/* Top Search & Barcode Bar */}
        <div className="p-3 bg-white border-b border-slate-200 flex items-center space-x-3 shadow-sm">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Barkod okutun veya manuel yazıp Enter'a basın..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono text-xs shadow-inner"
            />
            <Barcode className="w-4 h-4 text-blue-600 absolute left-3 top-2.5" />
          </form>

          <div className="w-60 relative">
            <input
              type="text"
              placeholder="Ürün adı ile ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          <button
            onClick={fetchProducts}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition"
            title="Yenile"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Categories Horizontal Bar */}
        <div className="px-3 py-2 bg-white/90 border-b border-slate-200 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded text-xs font-semibold whitespace-nowrap transition ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            Tüm Kategoriler
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/60'
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
              className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between hover:border-slate-400 shadow-sm transition group"
            >
              <div>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tight">
                  {prod.category?.name || 'Giyim'}
                </span>
                <h3 className="font-bold text-slate-900 text-xs mt-1.5 leading-snug group-hover:text-blue-700 transition">
                  {prod.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{prod.code}</p>
              </div>

              {/* Variants Quick Add Buttons */}
              <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">Varyantlar:</span>
                <div className="flex flex-wrap gap-1">
                  {prod.variants?.map((v: any) => (
                    <button
                      key={v.id}
                      onClick={() => addToCart({ ...v, product: prod })}
                      disabled={v.stockQuantity <= 0}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border flex items-center space-x-1 transition ${
                        v.stockQuantity <= 0
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-600 hover:border-blue-600 hover:text-white'
                      }`}
                    >
                      <span>
                        {v.attributes?.color || ''} {v.attributes?.size || ''}
                      </span>
                      <span className="font-semibold text-emerald-700 group-hover:text-white">
                        {v.salePrice}₺
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: POS Cart & Checkout (Kasa Sepeti) */}
      <div className="w-96 bg-white flex flex-col h-full shadow-lg border-l border-slate-200">
        {/* Cart Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-4 h-4 text-blue-700" />
            <h2 className="font-bold text-slate-900 text-xs tracking-tight">Kasa Sepeti</h2>
          </div>
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-100">
            {cartItems.reduce((acc, i) => acc + i.quantity, 0)} Kalem
          </span>
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
                className="bg-slate-50/80 border border-slate-200 rounded p-2.5 flex flex-col space-y-1.5 shadow-2xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs leading-snug">{item.productName}</h4>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="px-1 py-0.2 bg-white rounded text-[10px] text-slate-700 font-medium border border-slate-200">
                        {item.attributes.color || '-'} / {item.attributes.size || '-'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">{item.barcode}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.variantId)}
                    className="text-slate-400 hover:text-rose-600 p-0.5 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                  <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded p-0.5 shadow-2xs">
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-semibold text-xs text-slate-900">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Birim: {item.unitPrice.toFixed(2)}₺</span>
                    <span className="font-bold text-slate-900 text-xs">{item.totalPrice.toFixed(2)} ₺</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Summary & Campaign Motor */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2.5">
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
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
              <span>GENEL TOPLAM</span>
              <span className="text-emerald-700 text-lg font-bold">{total.toFixed(2)} ₺</span>
            </div>
          </div>

          {/* Checkout Trigger */}
          <button
            disabled={cartItems.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm transition flex items-center justify-center space-x-2 text-xs tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CreditCard className="w-4 h-4" />
            <span>ÖDEME AL / TAHSİLAT</span>
          </button>
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
    </div>
  )
}
