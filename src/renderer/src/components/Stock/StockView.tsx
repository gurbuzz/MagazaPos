import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Search,
  Layers,
  Edit3,
  PackageCheck,
  Tag,
  Barcode,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  Scan,
  Check,
  FileSpreadsheet,
  Upload,
  Download,
  FileCheck,
  RefreshCw,
} from 'lucide-react'
import * as XLSX from 'xlsx'
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

  // Quick Inbound Stock State (Manual Table Click)
  const [addStockVariant, setAddStockVariant] = useState<any | null>(null)
  const [addQtyVal, setAddQtyVal] = useState<string>('')

  // Barcode Scanner Quick Stock Entry Modal State
  const [isBarcodeStockModalOpen, setIsBarcodeStockModalOpen] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState('')
  const [scannedQty, setScannedQty] = useState('1')
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Quick Create inside Barcode Intake Modal
  const [quickName, setQuickName] = useState('')
  const [quickCategoryId, setQuickCategoryId] = useState('')
  const [quickColor, setQuickColor] = useState('Siyah')
  const [quickSize, setQuickSize] = useState('M')
  const [quickSalePrice, setQuickSalePrice] = useState('150')
  const [quickCostPrice, setQuickCostPrice] = useState('75')
  const [quickQty, setQuickQty] = useState('1')
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false)

  // Excel Bulk Import Modal State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
  const [excelRows, setExcelRows] = useState<any[]>([])
  const [excelFileName, setExcelFileName] = useState('')
  const [isExcelImporting, setIsExcelImporting] = useState(false)
  const [excelResult, setExcelResult] = useState<any | null>(null)
  const [excelError, setExcelError] = useState<string | null>(null)

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

  useEffect(() => {
    if (isBarcodeStockModalOpen) {
      setTimeout(() => scanInputRef.current?.focus(), 150)
    }
  }, [isBarcodeStockModalOpen])

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

  // --- BARCODE SCANNER MATCHING LOGIC ---
  const foundScannedVariant = scannedBarcode.trim()
    ? products
        .flatMap((p) => (p.variants || []).map((v: any) => ({ ...v, product: p })))
        .find((v: any) => v.barcode === scannedBarcode.trim())
    : null

  const handleBarcodeStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!foundScannedVariant) {
      alert('Bu barkoda ait ürün bulunamadı!')
      return
    }

    const qty = parseInt(scannedQty)
    if (isNaN(qty) || qty <= 0) {
      alert('Lütfen geçerli bir adet girin!')
      return
    }

    try {
      const res = await fetch(`/api/variants/${foundScannedVariant.id}/add-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addedQuantity: qty,
          note: 'Barkod okutarak hızlı stok kabulü',
        }),
      })

      if (res.ok) {
        setLastScannedResult(
          `✅ "${foundScannedVariant.product.name}" (${foundScannedVariant.attributes?.color} / ${foundScannedVariant.attributes?.size}) -> +${qty} adet stoğa eklendi!`
        )
        setScannedBarcode('')
        setScannedQty('1')
        fetchProducts()
        notifyDataChanged()
        setTimeout(() => scanInputRef.current?.focus(), 100)
      } else {
        const errData = await res.json()
        alert('Stok ekleme hatası: ' + (errData.error || 'Bilinmeyen hata'))
      }
    } catch {
      alert('Hata oluştu')
    }
  }

  // --- QUICK CREATE AND STOCK INTAKE (UNREGISTERED BARCODE) ---
  const handleQuickCreateAndStock = async () => {
    if (!quickName.trim() || !scannedBarcode.trim()) {
      alert('Lütfen ürün adını giriniz!')
      return
    }
    const salePriceNum = parseFloat(quickSalePrice) || 0
    const qtyNum = parseInt(quickQty) || 1
    const costPriceNum = parseFloat(quickCostPrice) || salePriceNum * 0.5

    const code = `PRD-${scannedBarcode.trim().slice(-6)}`
    const payload = {
      code,
      name: quickName.trim(),
      brand: 'Mağaza',
      categoryId: quickCategoryId || null,
      basePrice: salePriceNum,
      variants: [
        {
          sku: `${code}-${quickColor.trim().toUpperCase()}-${quickSize.trim().toUpperCase()}`,
          barcode: scannedBarcode.trim(),
          attributes: { color: quickColor.trim() || 'Standart', size: quickSize.trim() || 'Standart' },
          costPrice: costPriceNum,
          salePrice: salePriceNum,
          stockQuantity: qtyNum,
        },
      ],
    }

    setIsQuickSubmitting(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setLastScannedResult(
          `✅ Yeni ürün "${quickName}" (${quickColor} / ${quickSize}) tanımlandı ve +${qtyNum} adet stoğa eklendi!`
        )
        setQuickName('')
        setScannedBarcode('')
        setScannedQty('1')
        fetchProducts()
        fetchCategories()
        notifyDataChanged()
        setTimeout(() => scanInputRef.current?.focus(), 150)
      } else {
        const err = await res.json()
        alert('Ürün oluşturma hatası: ' + (err.error || 'Bilinmeyen hata'))
      }
    } catch (err: any) {
      alert('Hata: ' + err.message)
    } finally {
      setIsQuickSubmitting(false)
    }
  }

  // --- EXCEL / CSV BULK IMPORT HANDLERS ---
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        'Ürün Kodu': 'TSH-001',
        'Ürün Adı': 'Oversize Basic Tişört',
        'Kategori': 'Tişört',
        'Marka': 'Mağaza',
        'Barkod': '8690001112223',
        'Renk': 'Siyah',
        'Beden': 'M',
        'Alış Fiyatı': 100,
        'Satış Fiyatı': 250,
        'Stok Adedi': 20,
      },
      {
        'Ürün Kodu': 'TSH-001',
        'Ürün Adı': 'Oversize Basic Tişört',
        'Kategori': 'Tişört',
        'Marka': 'Mağaza',
        'Barkod': '8690001112224',
        'Renk': 'Siyah',
        'Beden': 'L',
        'Alış Fiyatı': 100,
        'Satış Fiyatı': 250,
        'Stok Adedi': 15,
      },
      {
        'Ürün Kodu': 'PNT-101',
        'Ürün Adı': 'Slim Fit Chino Pantolon',
        'Kategori': 'Pantolon',
        'Marka': 'Mağaza',
        'Barkod': '8690001112225',
        'Renk': 'Bej',
        'Beden': '32',
        'Alış Fiyatı': 250,
        'Satış Fiyatı': 550,
        'Stok Adedi': 10,
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ürünler')
    XLSX.writeFile(wb, 'MagazaPOS_Ornek_Urun_Sablonu.xlsx')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExcelFileName(file.name)
    setExcelError(null)
    setExcelResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'array' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws)

        if (rawJson.length === 0) {
          setExcelError('Dosya boş görünüyor.')
          return
        }

        const mapped = rawJson
          .map((row: any) => ({
            code: row['Ürün Kodu'] || row['Urun Kodu'] || row['Kod'] || row['Code'] || '',
            name: row['Ürün Adı'] || row['Urun Adi'] || row['Ad'] || row['Name'] || '',
            category: row['Kategori'] || row['Category'] || '',
            brand: row['Marka'] || row['Brand'] || 'Mağaza',
            barcode: String(row['Barkod'] || row['Barcode'] || '').trim(),
            color: String(row['Renk'] || row['Color'] || 'Standart').trim(),
            size: String(row['Beden'] || row['Size'] || 'Standart').trim(),
            costPrice: parseFloat(row['Alış Fiyatı'] || row['Alis Fiyati'] || row['Cost'] || 0),
            salePrice: parseFloat(row['Satış Fiyatı'] || row['Satis Fiyati'] || row['Price'] || 0),
            quantity: parseInt(row['Stok Adedi'] || row['Stok'] || row['Adet'] || row['Quantity'] || 0),
          }))
          .filter((r) => r.name && r.barcode)

        if (mapped.length === 0) {
          setExcelError('Geçerli ürün bulunamadı. Lütfen "Ürün Adı" ve "Barkod" sütunlarının dolu olduğundan emin olun.')
          return
        }

        setExcelRows(mapped)
      } catch (err: any) {
        setExcelError('Dosya okunurken hata oluştu: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleExecuteImport = async () => {
    if (excelRows.length === 0) return
    setIsExcelImporting(true)
    setExcelError(null)

    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: excelRows }),
      })

      const data = await res.json()
      if (res.ok) {
        setExcelResult(data)
        fetchProducts()
        fetchCategories()
        notifyDataChanged()
      } else {
        setExcelError(data.error || 'İçe aktarma başarısız oldu.')
      }
    } catch (err: any) {
      setExcelError('Hata: ' + err.message)
    } finally {
      setIsExcelImporting(false)
    }
  }

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

  // --- QUICK ADD STOCK (MANUAL ROW CLICK - NO PIN) ---
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

  // Duplicate barcode check for real-time validation (New product creation)
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
              <Layers className="w-4 h-4 text-blue-700" />
              <span>Ürünler ({filteredProducts.length})</span>
            </h2>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => {
                  setIsBarcodeStockModalOpen(true)
                  setLastScannedResult(null)
                  setScannedBarcode('')
                  setScannedQty('1')
                }}
                className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center space-x-1 transition shadow-xs"
                title="Barkod Okuyucu İle Hızlı Stok Girişi (Mal Kabul)"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Barkodlu Mal Kabul</span>
              </button>
              <button
                onClick={() => {
                  setIsExcelModalOpen(true)
                  setExcelRows([])
                  setExcelFileName('')
                  setExcelResult(null)
                  setExcelError(null)
                }}
                className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center space-x-1 transition shadow-xs"
                title="Excel / CSV ile Toplu Ürün ve Stok Yükleme"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Toplu Excel</span>
              </button>
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

      {/* BARCODE SCANNER FAST STOCK ENTRY MODAL (MAL KABUL) */}
      {isBarcodeStockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-lg shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Scan className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Barkod Okutarak Stok Kabulü</h3>
                  <p className="text-[11px] text-slate-500">Barkod okuyucu ile okutun veya barkod numarasını yazıp enter'a basın.</p>
                </div>
              </div>
              <button
                onClick={() => setIsBarcodeStockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base px-2"
              >
                ✕
              </button>
            </div>

            {lastScannedResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs font-semibold text-emerald-800 flex items-center space-x-2 animate-fadeIn">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{lastScannedResult}</span>
              </div>
            )}

            <form onSubmit={handleBarcodeStockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Barkod Okutun (veya yazın)</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    Otomatik Odaklı ⚡
                  </span>
                </label>
                <div className="relative">
                  <input
                    ref={scanInputRef}
                    type="text"
                    placeholder="Barkod okuyucu hazır..."
                    value={scannedBarcode}
                    onChange={(e) => setScannedBarcode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2.5 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                  {scannedBarcode && (
                    <div className="absolute right-3 top-3">
                      {foundScannedVariant ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Matched Product Details Card */}
              {scannedBarcode.trim() && (
                <div>
                  {foundScannedVariant ? (
                    <div className="p-3.5 bg-slate-50 border border-emerald-300 rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold text-emerald-700 uppercase">
                            {foundScannedVariant.product.category?.name || 'Giyim'}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{foundScannedVariant.product.name}</h4>
                          <p className="text-xs text-slate-600 font-medium">
                            Varyant: <span className="font-bold text-slate-900">{foundScannedVariant.attributes?.color} / {foundScannedVariant.attributes?.size}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">SKU: {foundScannedVariant.sku} | Barkod: {foundScannedVariant.barcode}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block font-semibold">Mevcut Stok</span>
                          <span className="text-sm font-bold text-slate-900">{foundScannedVariant.stockQuantity} Adet</span>
                          <span className="block text-xs font-bold text-emerald-700 mt-0.5">{foundScannedVariant.salePrice.toFixed(2)} ₺</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center space-x-3">
                        <div className="w-1/2">
                          <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Stoğa Eklenecek Adet (+)</label>
                          <input
                            type="number"
                            min="1"
                            value={scannedQty}
                            onChange={(e) => setScannedQty(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-bold text-sm focus:ring-1 focus:ring-emerald-500"
                            required
                          />
                        </div>
                        <div className="w-1/2 pt-4">
                          <button
                            type="submit"
                            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs flex items-center justify-center space-x-1"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Stoğa Ekle (Enter)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-lg space-y-3">
                      <div className="flex items-center space-x-2 text-amber-800 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Bu barkod (<strong>{scannedBarcode}</strong>) sistemde kayıtlı değil!</span>
                      </div>

                      <div className="bg-white p-3 rounded border border-amber-200 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                          <span className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>⚡ Bu Barkodla Hızlı Ürün Tanımla ve Stoğa Ekle</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Barkod: {scannedBarcode}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="col-span-2">
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Ürün Adı *</label>
                            <input
                              type="text"
                              placeholder="Örn: Pamuklu Polo Tişört"
                              value={quickName}
                              onChange={(e) => setQuickName(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Kategori</label>
                            <select
                              value={quickCategoryId}
                              onChange={(e) => setQuickCategoryId(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-medium focus:outline-none"
                            >
                              <option value="">Kategorisiz</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Renk</label>
                              <input
                                type="text"
                                placeholder="Renk"
                                value={quickColor}
                                onChange={(e) => setQuickColor(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Beden</label>
                              <input
                                type="text"
                                placeholder="Beden"
                                value={quickSize}
                                onChange={(e) => setQuickSize(e.target.value)}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-medium"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Satış Fiyatı (₺) *</label>
                            <input
                              type="number"
                              step="0.01"
                              value={quickSalePrice}
                              onChange={(e) => setQuickSalePrice(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-emerald-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Giriş Stoğu (Adet) *</label>
                            <input
                              type="number"
                              min="1"
                              value={quickQty}
                              onChange={(e) => setQuickQty(e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-900"
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                          <button
                            type="button"
                            onClick={handleQuickCreateAndStock}
                            disabled={isQuickSubmitting || !quickName.trim()}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shadow-xs flex items-center space-x-1 disabled:opacity-50"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{isQuickSubmitting ? 'Kaydediliyor...' : 'Kaydet ve Stoğa Al'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsBarcodeStockModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  Kapat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Quick Add Stock Modal (Manual Row Click - No PIN) */}
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

      {/* EXCEL / CSV BULK IMPORT MODAL */}
      {isExcelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Excel / CSV ile Toplu Ürün & Stok Yükleme</h3>
                  <p className="text-[11px] text-slate-500">
                    Tedarikçiden gelen veya hazırladığınız Excel tablosunu tek tıkla sisteme aktarın.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExcelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-base px-2"
              >
                ✕
              </button>
            </div>

            {/* Template Download & File Upload Bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg">
                <div className="text-xs text-indigo-950 font-medium">
                  <strong>Örnek Şablon:</strong> Formatı görmek için hazır şablonu indirin ve doldurun.
                </div>
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Şablonu İndir (.xlsx)</span>
                </button>
              </div>

              {/* Upload Input Area */}
              <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-lg p-4 text-center transition bg-slate-50">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="excelFileInput"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                >
                  <Upload className="w-6 h-6 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">
                    {excelFileName ? `Seçilen Dosya: ${excelFileName}` : 'Excel (.xlsx) veya CSV Dosyası Seçin'}
                  </span>
                  <span className="text-[10px] text-slate-500">Tıklayın veya dosyayı buraya bırakın</span>
                </label>
              </div>

              {/* Error Box */}
              {excelError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{excelError}</span>
                </div>
              )}

              {/* Success Result Box */}
              {excelResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{excelResult.message}</span>
                  </div>
                  {excelResult.errors && excelResult.errors.length > 0 && (
                    <div className="text-[11px] text-amber-800 pt-1 border-t border-emerald-200">
                      <strong>Uyarılar:</strong>
                      <ul className="list-disc pl-4 space-y-0.5 mt-0.5">
                        {excelResult.errors.slice(0, 5).map((e: string, idx: number) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Preview Table */}
            {excelRows.length > 0 && !excelResult && (
              <div className="flex-1 overflow-hidden flex flex-col border border-slate-200 rounded-lg">
                <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-semibold text-slate-700">
                  <span>Önizleme ({excelRows.length} Geçerli Satır Okundu)</span>
                  <span className="text-[11px] text-slate-500 font-normal">İlk 10 satır gösteriliyor</span>
                </div>
                <div className="overflow-auto flex-1 max-h-48 text-[11px]">
                  <table className="w-full text-left text-slate-700">
                    <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5">Kod</th>
                        <th className="px-3 py-1.5">Ürün Adı</th>
                        <th className="px-3 py-1.5">Kategori</th>
                        <th className="px-3 py-1.5">Barkod</th>
                        <th className="px-3 py-1.5">Varyant</th>
                        <th className="px-3 py-1.5">Fiyat</th>
                        <th className="px-3 py-1.5 text-right">Adet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {excelRows.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-3 py-1 font-mono text-[10px] text-slate-600">{row.code || '-'}</td>
                          <td className="px-3 py-1 font-bold text-slate-900">{row.name}</td>
                          <td className="px-3 py-1">{row.category || '-'}</td>
                          <td className="px-3 py-1 font-mono">{row.barcode}</td>
                          <td className="px-3 py-1">
                            {row.color} / {row.size}
                          </td>
                          <td className="px-3 py-1 text-emerald-700 font-semibold">{row.salePrice.toFixed(2)} ₺</td>
                          <td className="px-3 py-1 text-right font-bold text-slate-900">+{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                {excelRows.length > 0 && !excelResult ? `${excelRows.length} ürün aktarılmaya hazır.` : ''}
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsExcelModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  {excelResult ? 'Tamamla' : 'İptal'}
                </button>
                {excelRows.length > 0 && !excelResult && (
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isExcelImporting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>{isExcelImporting ? 'Stoğa Aktarılıyor...' : 'Stoğa Aktarımı Başlat'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
