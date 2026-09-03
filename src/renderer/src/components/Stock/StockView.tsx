import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, Layers, Edit3, PackageCheck, Tag, Barcode, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'
import { CategoryModal } from './CategoryModal'
import { notifyDataChanged } from '../../utils/events'

export const StockView: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [editingVariant, setEditingVariant] = useState<any | null>(null)
  const [newStockVal, setNewStockVal] = useState<string>('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Form states for new product
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newBasePrice, setNewBasePrice] = useState('')
  const [newColor, setNewColor] = useState('Siyah')
  const [newSize, setNewSize] = useState('M')
  const [newBarcode, setNewBarcode] = useState('')

  const barcodeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAddModalOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 150)
    }
  }, [isAddModalOpen])

  const generateBarcode = () => {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000)
    setNewBarcode(`869${randomDigits}`)
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      if (Array.isArray(data)) {
        setProducts(data)
        if (data.length > 0 && !selectedProduct) {
          setSelectedProduct(data[0])
        }
      } else {
        console.error('Expected array, got:', data)
        setProducts([])
      }
    } catch (err) {
      console.error('Error loading stock products:', err)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/products/categories')
      const data = await res.json()
      if (Array.isArray(data)) {
        setCategories(data)
      }
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()

    const handleDataUpdate = () => {
      fetchProducts()
      fetchCategories()
    }

    window.addEventListener('pos-data-updated', handleDataUpdate)
    window.addEventListener('focus', handleDataUpdate)

    const syncInterval = setInterval(() => {
      fetchProducts()
      fetchCategories()
    }, 10000)

    return () => {
      window.removeEventListener('pos-data-updated', handleDataUpdate)
      window.removeEventListener('focus', handleDataUpdate)
      clearInterval(syncInterval)
    }
  }, [])

  useEffect(() => {
    if (isAddModalOpen || isCategoryModalOpen) {
      fetchCategories()
    }
  }, [isAddModalOpen, isCategoryModalOpen])

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVariant) return

    try {
      const res = await fetch(`/api/variants/${editingVariant.id}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: parseInt(newStockVal || '0'),
          note: 'Manuel stok güncelleme',
        }),
      })

      if (res.ok) {
        setEditingVariant(null)
        fetchProducts()
        notifyDataChanged()
      } else {
        alert('Stok güncelleme hatası')
      }
    } catch (err) {
      alert('Hata oluştu')
    }
  }

  // Duplicate barcode check for real-time validation
  const trimmedBarcode = newBarcode.trim()
  const duplicateProduct = trimmedBarcode
    ? products.find((prod) =>
        prod.variants?.some((v: any) => v.barcode === trimmedBarcode)
      )
    : null

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCode || !newName || !newBarcode) {
      alert('Lütfen Ürün Kodu, Adı ve Barkod alanlarını doldurun!')
      return
    }

    if (duplicateProduct) {
      alert(`⚠️ Uyarı: Barkod numarası (${trimmedBarcode}) zaten "${duplicateProduct.name}" (${duplicateProduct.code}) üzerinde kayıtlıdır! Lütfen farklı bir barkod kullanın.`)
      return
    }

    const payload = {
      code: newCode,
      name: newName,
      brand: newBrand || 'Marka',
      categoryId: newCategoryId || null,
      basePrice: parseFloat(newBasePrice || '100'),
      variants: [
        {
          sku: `${newCode}-${newColor}-${newSize}`,
          barcode: trimmedBarcode,
          attributes: { color: newColor, size: newSize },
          costPrice: parseFloat(newBasePrice || '100') * 0.5,
          salePrice: parseFloat(newBasePrice || '100'),
          stockQuantity: 10,
        },
      ],
    }

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setIsAddModalOpen(false)
        setNewCode('')
        setNewName('')
        setNewBarcode('')
        setNewCategoryId('')
        fetchProducts()
        fetchCategories()
        notifyDataChanged()
      } else {
        const err = await res.json()
        alert(`Hata: ${err.error}`)
      }
    } catch (err: any) {
      alert(`Hata: ${err.message}`)
    }
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 flex overflow-hidden font-sans">
      {/* Left List: Products */}
      <div className="w-1/3 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-3.5 border-b border-slate-200 space-y-2.5 bg-slate-50">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-blue-700" />
              <span>Ürünler ({filteredProducts.length})</span>
            </h2>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-semibold flex items-center space-x-1 transition"
                title="Kategorileri Yönet"
              >
                <Tag className="w-3.5 h-3.5 text-blue-700" />
                <span>Kategoriler</span>
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold flex items-center space-x-1 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Ürün</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Ürün veya Kod Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>
        </div>

        {/* Product Selection Column */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {filteredProducts.map((prod) => {
            const totalStock = prod.variants?.reduce((acc: number, v: any) => acc + v.stockQuantity, 0) || 0
            const isSelected = selectedProduct?.id === prod.id

            return (
              <div
                key={prod.id}
                onClick={() => setSelectedProduct(prod)}
                className={`p-3 rounded border cursor-pointer transition ${
                  isSelected
                    ? 'bg-blue-50 border-blue-400 text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-blue-700 font-semibold uppercase">{prod.category?.name || 'Giyim'}</span>
                    <h3 className="font-bold text-xs mt-0.5 text-slate-900">{prod.name}</h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{prod.code}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                        totalStock > 10
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : totalStock > 0
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {totalStock} Adet
                    </span>
                    <span className="block text-xs font-bold text-slate-900 mt-1">{prod.basePrice.toFixed(2)} ₺</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Column: Variant & Stock Details */}
      <div className="flex-1 flex flex-col bg-white overflow-y-auto">
        {selectedProduct ? (
          <div className="p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
              <div>
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  {selectedProduct.category?.name || 'Kategorisiz'}
                </span>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">{selectedProduct.name}</h1>
                <p className="text-xs text-slate-500 font-mono mt-1">Ürün Kodu: {selectedProduct.code}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-right">
                <span className="text-[11px] text-slate-500 font-semibold block uppercase">Taban Satış Fiyatı</span>
                <span className="text-xl font-bold text-emerald-700">{selectedProduct.basePrice.toFixed(2)} ₺</span>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-tight mb-3 flex items-center space-x-1.5">
                <PackageCheck className="w-4 h-4 text-blue-700" />
                <span>Ürün Varyantları & Stok Seviyeleri</span>
              </h3>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="px-5 py-3">Varyant (Renk / Beden)</th>
                      <th className="px-5 py-3">SKU</th>
                      <th className="px-5 py-3">Barkod</th>
                      <th className="px-5 py-3">Satış Fiyatı</th>
                      <th className="px-5 py-3">Mevcut Stok</th>
                      <th className="px-5 py-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProduct.variants?.map((v: any) => {
                      return (
                        <tr key={v.id} className="hover:bg-slate-50 transition">
                          <td className="px-5 py-3 font-semibold text-slate-900">
                            {v.attributes?.color} / {v.attributes?.size}
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-500">{v.sku}</td>
                          <td className="px-5 py-3 font-mono text-slate-700 font-medium">{v.barcode}</td>
                          <td className="px-5 py-3 font-bold text-emerald-700">{v.salePrice.toFixed(2)} ₺</td>
                          <td className="px-5 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                v.stockQuantity > 10
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : v.stockQuantity > 0
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {v.stockQuantity} Adet
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => {
                                setEditingVariant(v)
                                setNewStockVal(v.stockQuantity.toString())
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded transition text-xs font-semibold flex items-center space-x-1 ml-auto"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Stok Düzelt</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <p>Sol listeden bir ürün seçin.</p>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {editingVariant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-sm shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Stok Güncelle</h3>
            <p className="text-xs text-slate-500 font-mono">
              {editingVariant.sku} ({editingVariant.attributes?.color} / {editingVariant.attributes?.size})
            </p>

            <form onSubmit={handleUpdateStock} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Yeni Stok Adedi</label>
                <input
                  type="number"
                  value={newStockVal}
                  onChange={(e) => setNewStockVal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-bold text-base focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingVariant(null)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold shadow-sm"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md shadow-xl space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Yeni Ürün Ekle</h3>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ürün Kodu (Örn: PRD-TSH-010)</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ürün Adı (Örn: Slim Fit Tişört)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kategori</label>
                  <select
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 focus:ring-1 focus:ring-blue-600 font-medium"
                  >
                    <option value="">-- Kategori Seçin --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Marka</label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Taban Fiyat (TL)</label>
                <input
                  type="number"
                  value={newBasePrice}
                  onChange={(e) => setNewBasePrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-semibold focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Varyant Renk</label>
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-900 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Beden</label>
                  <input
                    type="text"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-900 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Barcode Section with Scanner & Manual support and Real-time Duplicate Check */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold flex items-center space-x-1">
                    <Barcode className="w-3.5 h-3.5 text-blue-700" />
                    <span>Barkod Numarası</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateBarcode}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 hover:underline flex items-center space-x-1"
                    title="Otomatik 13 haneli EAN barkod üret"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Otomatik Üret</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    placeholder="Barkod okutun veya elle yazın..."
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    className={`w-full bg-slate-50 border rounded p-2 text-slate-900 font-mono font-bold text-xs focus:ring-1 focus:outline-none ${
                      duplicateProduct
                        ? 'border-rose-500 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                        : trimmedBarcode
                        ? 'border-emerald-500 bg-emerald-50/30 text-slate-900 focus:ring-emerald-500'
                        : 'border-slate-300 focus:ring-blue-600'
                    }`}
                    required
                  />
                  {trimmedBarcode && (
                    <div className="absolute right-2.5 top-2">
                      {duplicateProduct ? (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                  )}
                </div>

                {/* Duplicate or Validation Feedback */}
                {duplicateProduct && (
                  <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-700 font-semibold flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>
                      Bu barkod ({trimmedBarcode}) zaten <strong>"{duplicateProduct.name}"</strong> ({duplicateProduct.code}) üzerinde kayıtlı!
                    </span>
                  </div>
                )}
                {!duplicateProduct && trimmedBarcode && (
                  <div className="mt-1 text-[10px] text-emerald-700 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Barkod kullanılabilir. (Manuel veya Barkod Okuyucu ile girildi)</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={!!duplicateProduct}
                  className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  Ürünü Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false)
          fetchCategories()
        }}
        categories={categories}
        onRefresh={async () => {
          await fetchCategories()
          await fetchProducts()
        }}
      />
    </div>
  )
}
