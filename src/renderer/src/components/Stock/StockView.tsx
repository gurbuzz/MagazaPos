import React, { useState, useEffect, useRef } from 'react'
import { Plus, Search, Layers, Edit3, PackageCheck, Tag, Barcode, Sparkles, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { CategoryModal } from './CategoryModal'
import { AdminPinModal } from '../Security/AdminPinModal'
import { notifyDataChanged } from '../../utils/events'

export const StockView: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  
  // Variant Edit states
  const [editingVariant, setEditingVariant] = useState<any | null>(null)
  const [editColor, setEditColor] = useState('')
  const [editSize, setEditSize] = useState('')
  const [editSalePrice, setEditSalePrice] = useState('')
  const [editCostPrice, setEditCostPrice] = useState('')
  const [editBarcode, setEditBarcode] = useState('')
  const [editStockVal, setEditStockVal] = useState('')

  // Product Edit states
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [editProdName, setEditProdName] = useState('')
  const [editProdCode, setEditProdCode] = useState('')
  const [editProdBrand, setEditProdBrand] = useState('')
  const [editProdCategoryId, setEditProdCategoryId] = useState('')
  const [editProdBasePrice, setEditProdBasePrice] = useState('')

  // Quick Inbound Stock State
  const [addStockVariant, setAddStockVariant] = useState<any | null>(null)
  const [addQtyVal, setAddQtyVal] = useState<string>('')

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Admin PIN gate for corrections/edits
  const [isAdminPinOpen, setIsAdminPinOpen] = useState(false)
  const [pendingVariantEdit, setPendingVariantEdit] = useState<any | null>(null)
  const [pendingProductEdit, setPendingProductEdit] = useState<any | null>(null)
  const [adminVerifiedForSession, setAdminVerifiedForSession] = useState(false)

  // Form states for new product creation
  const [newCode, setNewCode] = useState('')
  const [newName, setNewName] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newBasePrice, setNewBasePrice] = useState('')
  const [newStockQuantity, setNewStockQuantity] = useState('0')
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
        setSelectedProduct((prev: any) => {
          if (!prev) return data[0] || null
          const updated = data.find((p: any) => p.id === prev.id)
          return updated || data[0] || null
        })
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

  // --- EDIT VARIANT HANDLERS ---
  const openVariantEditModal = (variant: any) => {
    setEditingVariant(variant)
    setEditColor(variant.attributes?.color || '')
    setEditSize(variant.attributes?.size || '')
    setEditSalePrice(variant.salePrice?.toString() || '0')
    setEditCostPrice(variant.costPrice?.toString() || '0')
    setEditBarcode(variant.barcode || '')
    setEditStockVal(variant.stockQuantity?.toString() || '0')
  }

  const handleStockEditClick = (variant: any) => {
    if (adminVerifiedForSession) {
      openVariantEditModal(variant)
    } else {
      setPendingVariantEdit(variant)
      setIsAdminPinOpen(true)
    }
  }

  const handleUpdateVariant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVariant) return

    try {
      const res = await fetch(`/api/products/variants/${editingVariant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': localStorage.getItem('pos_admin_pin_session') || '',
        },
        body: JSON.stringify({
          color: editColor,
          size: editSize,
          salePrice: parseFloat(editSalePrice || '0'),
          costPrice: parseFloat(editCostPrice || '0'),
          barcode: editBarcode,
          stockQuantity: parseInt(editStockVal || '0', 10),
          note: 'Varyant detay ve stok düzeltme',
        }),
      })

      if (res.ok) {
        setEditingVariant(null)
        fetchProducts()
        notifyDataChanged()
      } else {
        const errData = await res.json()
        if (errData.code === 'UNAUTHORIZED_ADMIN_PIN') {
          alert('Yönetici PIN doğrulama hatası. Lütfen tekrar deneyin.')
          setAdminVerifiedForSession(false)
        } else {
          alert('Güncelleme hatası: ' + (errData.error || 'Bilinmeyen hata'))
        }
      }
    } catch (err) {
      alert('Hata oluştu')
    }
  }

  // --- EDIT MAIN PRODUCT HANDLERS ---
  const openProductEditModal = (product: any) => {
    setEditingProduct(product)
    setEditProdName(product.name || '')
    setEditProdCode(product.code || '')
    setEditProdBrand(product.brand || '')
    setEditProdCategoryId(product.categoryId || '')
    setEditProdBasePrice(product.basePrice?.toString() || '0')
  }

  const handleProductEditClick = (product: any) => {
    if (adminVerifiedForSession) {
      openProductEditModal(product)
    } else {
      setPendingProductEdit(product)
      setIsAdminPinOpen(true)
    }
  }

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct) return

    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': localStorage.getItem('pos_admin_pin_session') || '',
        },
        body: JSON.stringify({
          name: editProdName,
          code: editProdCode,
          brand: editProdBrand,
          categoryId: editProdCategoryId || null,
          basePrice: parseFloat(editProdBasePrice || '0'),
        }),
      })

      if (res.ok) {
        setEditingProduct(null)
        fetchProducts()
        notifyDataChanged()
      } else {
        const errData = await res.json()
        if (errData.code === 'UNAUTHORIZED_ADMIN_PIN') {
          alert('Yönetici PIN doğrulama hatası. Lütfen tekrar deneyin.')
          setAdminVerifiedForSession(false)
        } else {
          alert('Ürün güncelleme hatası: ' + (errData.error || 'Bilinmeyen hata'))
        }
      }
    } catch (err) {
      alert('Hata oluştu')
    }
  }

  // --- QUICK ADD STOCK (MAL KABUL - NO PIN) ---
  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addStockVariant || !addQtyVal) return
    const qty = parseInt(addQtyVal)
    if (isNaN(qty) || qty <= 0) {
      alert('Lütfen geçerli bir adet girin!')
      return
    }

    try {
      const res = await fetch(`/api/variants/${addStockVariant.id}/add-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addedQuantity: qty,
          note: 'Mal kabul stok girişi',
        }),
      })

      if (res.ok) {
        setAddStockVariant(null)
        setAddQtyVal('')
        fetchProducts()
        notifyDataChanged()
      } else {
        const errData = await res.json()
        alert('Stok ekleme hatası: ' + (errData.error || 'Bilinmeyen hata'))
      }
    } catch {
      alert('Hata oluştu')
    }
  }

  // Admin PIN verified callback
  const handleAdminVerifiedForStock = () => {
    setIsAdminPinOpen(false)
    setAdminVerifiedForSession(true)
    if (pendingVariantEdit) {
      openVariantEditModal(pendingVariantEdit)
      setPendingVariantEdit(null)
    }
    if (pendingProductEdit) {
      openProductEditModal(pendingProductEdit)
      setPendingProductEdit(null)
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
          stockQuantity: parseInt(newStockQuantity || '0', 10),
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
        setNewStockQuantity('0')
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
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    {selectedProduct.category?.name || 'Kategorisiz'}
                  </span>
                  <button
                    onClick={() => handleProductEditClick(selectedProduct)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-300 hover:border-indigo-300 rounded text-[11px] font-semibold flex items-center space-x-1 transition"
                    title="Ana Ürün Adı, Kodu ve Fiyatını Düzenle"
                  >
                    <Edit3 className="w-3 h-3 text-indigo-600" />
                    <span>Ürünü Düzenle</span>
                    <ShieldAlert className="w-2.5 h-2.5 text-indigo-400 opacity-60" />
                  </button>
                </div>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">{selectedProduct.name}</h1>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Ürün Kodu: {selectedProduct.code} {selectedProduct.brand ? `| Marka: ${selectedProduct.brand}` : ''}
                </p>
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
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={() => {
                                  setAddStockVariant(v)
                                  setAddQtyVal('')
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded transition text-xs font-semibold flex items-center space-x-1"
                                title="Şifresiz Mal Kabul Stok Girişi"
                              >
                                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                <span>+ Stok Ekle</span>
                              </button>
                              <button
                                onClick={() => handleStockEditClick(v)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-300 hover:border-indigo-300 rounded transition text-xs font-semibold flex items-center space-x-1"
                                title="Yönetici PIN ile Tüm Varyant ve Stok Bilgilerini Düzelt"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Düzelt</span>
                                <ShieldAlert className="w-3 h-3 text-indigo-400 opacity-60" />
                              </button>
                            </div>
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

      {/* Variant Full Edit Modal (Price, Barcode, Color/Size, Stock) */}
      {editingVariant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Varyant & Stok Düzelt (Yönetici)</h3>
              </div>
              <button
                onClick={() => setEditingVariant(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateVariant} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Varyant Renk</label>
                  <input
                    type="text"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Beden</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Satış Fiyatı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSalePrice}
                    onChange={(e) => setEditSalePrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-emerald-700 focus:ring-1 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Alış Fiyatı (Maliyet ₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-semibold focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Barkod Numarası</label>
                <input
                  type="text"
                  value={editBarcode}
                  onChange={(e) => setEditBarcode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-mono font-bold focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mevcut Stok Adedi</label>
                <input
                  type="number"
                  value={editStockVal}
                  onChange={(e) => setEditStockVal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-base focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingVariant(null)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-semibold shadow-sm"
                >
                  Değişiklikleri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Product Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Ana Ürün Bilgilerini Düzenle</h3>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ürün Kodu</label>
                <input
                  type="text"
                  value={editProdCode}
                  onChange={(e) => setEditProdCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ürün Adı</label>
                <input
                  type="text"
                  value={editProdName}
                  onChange={(e) => setEditProdName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Kategori</label>
                  <select
                    value={editProdCategoryId}
                    onChange={(e) => setEditProdCategoryId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600"
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
                    value={editProdBrand}
                    onChange={(e) => setEditProdBrand(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Taban Satış Fiyatı (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editProdBasePrice}
                  onChange={(e) => setEditProdBasePrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-emerald-700 text-base focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-semibold shadow-sm"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Stock Modal (Mal Kabul - No PIN) */}
      {addStockVariant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-sm shadow-xl space-y-4">
            <div className="flex items-center space-x-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm">Hızlı Stok Ekle (Mal Kabul)</h3>
            </div>
            <p className="text-xs text-slate-500 font-mono">
              {addStockVariant.sku} ({addStockVariant.attributes?.color} / {addStockVariant.attributes?.size})
            </p>
            <p className="text-xs text-slate-600">
              Mevcut Stok: <strong className="text-slate-900">{addStockVariant.stockQuantity} Adet</strong>
            </p>

            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Eklenecek Stok Adedi (+)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Örn: 20"
                  value={addQtyVal}
                  onChange={(e) => setAddQtyVal(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-bold text-base focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAddStockVariant(null)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold shadow-sm"
                >
                  Stoğa Ekle
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Taban Fiyat (TL)</label>
                  <input
                    type="number"
                    value={newBasePrice}
                    onChange={(e) => setNewBasePrice(e.target.value)}
                    placeholder="100"
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-semibold focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Başlangıç Stok Adedi</label>
                  <input
                    type="number"
                    min="0"
                    value={newStockQuantity}
                    onChange={(e) => setNewStockQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-semibold focus:ring-1 focus:ring-blue-600"
                  />
                </div>
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

      {/* Admin PIN Modal for Stock/Product Corrections */}
      <AdminPinModal
        isOpen={isAdminPinOpen}
        onClose={() => {
          setIsAdminPinOpen(false)
          setPendingVariantEdit(null)
          setPendingProductEdit(null)
        }}
        onVerified={handleAdminVerifiedForStock}
        title="Düzenleme Yetkisi"
        subtitle="Ürün ve varyant bilgilerini değiştirmek için Yönetici PIN girin."
      />
    </div>
  )
}
