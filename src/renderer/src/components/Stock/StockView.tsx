import React, { useState, useEffect } from 'react'
import { Plus, Search, Layers, Edit3, PackageCheck } from 'lucide-react'

export const StockView: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [editingVariant, setEditingVariant] = useState<any | null>(null)
  const [newStockVal, setNewStockVal] = useState<string>('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  // Form states for new product
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newBasePrice, setNewBasePrice] = useState('')
  const [newColor, setNewColor] = useState('Siyah')
  const [newSize, setNewSize] = useState('M')
  const [newBarcode, setNewBarcode] = useState('')

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data || [])
      if (data.length > 0 && !selectedProduct) {
        setSelectedProduct(data[0])
      }
    } catch (err) {
      console.error('Error loading stock products:', err)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

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
      } else {
        alert('Stok güncelleme hatası')
      }
    } catch (err) {
      alert('Hata oluştu')
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCode || !newName || !newBarcode) {
      alert('Lütfen Ürün Kodu, Adı ve Barkod alanlarını doldurun!')
      return
    }

    const payload = {
      code: newCode,
      name: newName,
      brand: newBrand || 'Marka',
      basePrice: parseFloat(newBasePrice || '100'),
      variants: [
        {
          sku: `${newCode}-${newColor}-${newSize}`,
          barcode: newBarcode,
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
        fetchProducts()
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
    <div className="h-[calc(100vh-4rem)] bg-slate-100 flex overflow-hidden">
      {/* Left List: Products */}
      <div className="w-1/3 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-200 space-y-3 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Ürün Listesi ({filteredProducts.length})</span>
            </h2>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-md shadow-indigo-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Ürün</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Ürün veya Kod Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Product Selection Column */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredProducts.map((prod) => {
            const totalStock = prod.variants?.reduce((acc: number, v: any) => acc + v.stockQuantity, 0) || 0
            const isSelected = selectedProduct?.id === prod.id

            return (
              <div
                key={prod.id}
                onClick={() => setSelectedProduct(prod)}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  isSelected
                    ? 'bg-indigo-50/80 border-indigo-500 text-slate-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-indigo-600 font-extrabold uppercase">{prod.category?.name || 'Giyim'}</span>
                    <h3 className="font-extrabold text-sm mt-0.5 text-slate-900">{prod.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{prod.code}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                        totalStock > 10
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : totalStock > 0
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {totalStock} Adet
                    </span>
                    <span className="block text-xs font-black text-slate-900 mt-1">{prod.basePrice.toFixed(2)} ₺</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right List: Variant Detail Matrix */}
      <div className="flex-1 flex flex-col bg-slate-100 p-6 overflow-y-auto">
        {selectedProduct ? (
          <div className="space-y-6 max-w-5xl">
            {/* Header info */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex justify-between items-center shadow-sm">
              <div>
                <span className="text-xs text-indigo-600 font-bold uppercase">{selectedProduct.category?.name || 'Giyim'}</span>
                <h1 className="text-2xl font-black text-slate-900 mt-1">{selectedProduct.name}</h1>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Ürün Kodu: {selectedProduct.code} | Marka: {selectedProduct.brand || '-'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium block">Taban Satış Fiyatı</span>
                <span className="text-2xl font-black text-emerald-600">{selectedProduct.basePrice.toFixed(2)} ₺</span>
              </div>
            </div>

            {/* Variant Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>Renk / Beden Stok Matrisi ({selectedProduct.variants?.length || 0} SKU)</span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3">Renk</th>
                      <th className="px-6 py-3">Beden</th>
                      <th className="px-6 py-3">SKU</th>
                      <th className="px-6 py-3">Barkod</th>
                      <th className="px-6 py-3">Satış Fiyatı</th>
                      <th className="px-6 py-3">Mevcut Stok</th>
                      <th className="px-6 py-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProduct.variants?.map((v: any) => {
                      const attrs = v.attributes || {}
                      return (
                        <tr key={v.id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-3.5 font-bold text-slate-900">{attrs.color || '-'}</td>
                          <td className="px-6 py-3.5 font-black text-indigo-600">{attrs.size || '-'}</td>
                          <td className="px-6 py-3.5 font-mono text-slate-500">{v.sku}</td>
                          <td className="px-6 py-3.5 font-mono text-slate-700 font-bold">{v.barcode}</td>
                          <td className="px-6 py-3.5 font-black text-emerald-600">{v.salePrice.toFixed(2)} ₺</td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
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
                          <td className="px-6 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setEditingVariant(v)
                                setNewStockVal(v.stockQuantity.toString())
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg transition text-xs font-bold flex items-center space-x-1 ml-auto"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">Stok Güncelle</h3>
            <p className="text-xs text-slate-500 font-mono">
              {editingVariant.sku} ({editingVariant.attributes?.color} / {editingVariant.attributes?.size})
            </p>

            <form onSubmit={handleUpdateStock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Yeni Stok Adedi</label>
                <input
                  type="number"
                  value={newStockVal}
                  onChange={(e) => setNewStockVal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-black text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingVariant(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20"
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">Yeni Giyim Ürünü Ekle</h3>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Ürün Kodu (Örn: PRD-TSH-010)</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Ürün Adı (Örn: Slim Fit Tişört)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Marka</label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Taban Fiyat (TL)</label>
                  <input
                    type="number"
                    value={newBasePrice}
                    onChange={(e) => setNewBasePrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Varyant Renk</label>
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Beden</label>
                  <input
                    type="text"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Barkod No</label>
                  <input
                    type="text"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-extrabold shadow-md shadow-indigo-600/20"
                >
                  Ürünü Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
