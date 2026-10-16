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
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { CategoryModal } from './CategoryModal'
import { AdminPinModal } from '../Security/AdminPinModal'
import { notifyDataChanged } from '../../utils/events'

const parseDecimal = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = String(val).replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

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
  const [editDiscountPrice, setEditDiscountPrice] = useState('')
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
  const [unregisteredBarcode, setUnregisteredBarcode] = useState<string | null>(null)
  const [scannedQty, setScannedQty] = useState('1')
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  // Search input and barcode scan highlight states
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [highlightedVariantId, setHighlightedVariantId] = useState<string | null>(null)
  const [scanToast, setScanToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // Add Variant to Existing Product Modal State
  const [isAddVariantModalOpen, setIsAddVariantModalOpen] = useState(false)
  const [newVarColor, setNewVarColor] = useState('Siyah')
  const [newVarSize, setNewVarSize] = useState('M')
  const [newVarBarcode, setNewVarBarcode] = useState('')
  const [newVarSalePrice, setNewVarSalePrice] = useState('')
  const [newVarCostPrice, setNewVarCostPrice] = useState('')
  const [newVarDiscountPrice, setNewVarDiscountPrice] = useState('')
  const [newVarStockQty, setNewVarStockQty] = useState('1')
  const [isCreatingVariant, setIsCreatingVariant] = useState(false)
  const newVarBarcodeInputRef = useRef<HTMLInputElement>(null)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  // Quick Create inside Barcode Intake Modal
  const [quickName, setQuickName] = useState('')
  const [quickCategoryId, setQuickCategoryId] = useState('')
  const [quickColor, setQuickColor] = useState('Siyah')
  const [quickSize, setQuickSize] = useState('M')
  const [quickSalePrice, setQuickSalePrice] = useState('150')
  const [quickDiscountPrice, setQuickDiscountPrice] = useState('')
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
  const [newDiscountPrice, setNewDiscountPrice] = useState('')
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
      setScannedBarcode('')
      setUnregisteredBarcode(null)
      setLastScannedResult(null)
      setScannedQty('1')
      setQuickName('')
      setTimeout(() => scanInputRef.current?.focus(), 150)
    }
  }, [isBarcodeStockModalOpen])

  useEffect(() => {
    if (isAddVariantModalOpen) {
      setTimeout(() => newVarBarcodeInputRef.current?.focus(), 150)
    }
  }, [isAddVariantModalOpen])

  const generateBarcode = () => {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000)
    setNewBarcode(`869${randomDigits}`)
  }

  const generateVariantBarcode = () => {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000)
    setNewVarBarcode(`869${randomDigits}`)
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
    const cleanBarcode = scannedBarcode.trim()
    if (!cleanBarcode) return

    if (!foundScannedVariant) {
      setUnregisteredBarcode(cleanBarcode)
      setLastScannedResult(null)
      setTimeout(() => scanInputRef.current?.select(), 50)
      return
    }

    const qty = parseInt(scannedQty)
    if (isNaN(qty) || qty <= 0) {
      alert('Lütfen geçerli bir adet girin!')
      return
    }

    try {
      const res = await fetch(`/api/products/variants/${foundScannedVariant.id}/add-stock`, {
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
        setUnregisteredBarcode(null)
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
    const cleanBarcode = (unregisteredBarcode || scannedBarcode).trim()
    if (!quickName.trim() || !cleanBarcode) {
      alert('Lütfen ürün adını giriniz!')
      return
    }
    const salePriceNum = parseDecimal(quickSalePrice)
    const qtyNum = parseInt(quickQty) || 1
    const costPriceNum = parseDecimal(quickCostPrice) || salePriceNum * 0.5

    const barcodeSuffix = cleanBarcode.length >= 6 ? cleanBarcode.slice(-6) : cleanBarcode.padStart(6, '0')
    const code = `PRD-${barcodeSuffix}-${Date.now().toString().slice(-4)}`
    const clr = quickColor.trim() || 'Standart'
    const sz = quickSize.trim() || 'Standart'
    const sku = `${code}-${clr.toUpperCase()}-${sz.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`

    const payload = {
      code,
      name: quickName.trim(),
      brand: 'Mağaza',
      categoryId: quickCategoryId || null,
      basePrice: salePriceNum,
      variants: [
        {
          sku,
          barcode: cleanBarcode,
          attributes: { color: clr, size: sz },
          costPrice: costPriceNum,
          salePrice: salePriceNum,
          discountPrice: quickDiscountPrice ? parseDecimal(quickDiscountPrice) : null,
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
          `✅ Yeni ürün "${quickName}" (${clr} / ${sz}) tanımlandı ve +${qtyNum} adet stoğa eklendi!`
        )
        setQuickName('')
        setQuickDiscountPrice('')
        setScannedBarcode('')
        setUnregisteredBarcode(null)
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
  // --- EXCEL / CSV BULK IMPORT HANDLERS ---
  const downloadExcelTemplate = () => {
    const templateData = [
      {
        'Barkod': '8682030133891',
        'Madde Kodu': '111230300',
        'Madde Açıklaması': 'MAX',
        'ÜRÜN GRUBU': 'AYAKKABI',
        'Renk Açıklaması': 'BEYAZ',
        'Renk Kodu': '100500',
        'Beden': '42',
        'PSFTL': 6249.99,
        'TSFTL': 3124.995,
        'Fiyat İskontolu': 1249.998,
        'Miktar Toplam': 1,
        'CİNSİYET': 'ERKEK',
        'Müşteri Firma Adı': 'Muhammet Güneysu'
      },
      {
        'Barkod': '8684195457690',
        'Madde Kodu': '111200243',
        'Madde Açıklaması': 'LUTA',
        'ÜRÜN GRUBU': 'DENİM',
        'Renk Açıklaması': 'ANTRASİT',
        'Renk Kodu': '100110',
        'Beden': '32/32',
        'PSFTL': 4499.99,
        'TSFTL': 2249.995,
        'Fiyat İskontolu': 899.998,
        'Miktar Toplam': 2,
        'CİNSİYET': 'ERKEK',
        'Müşteri Firma Adı': 'Muhammet Güneysu'
      },
      {
        'Barkod': '8684195532120',
        'Madde Kodu': '112030204',
        'Madde Açıklaması': 'STORM',
        'ÜRÜN GRUBU': 'SWEAT SHIRT',
        'Renk Açıklaması': 'SİYAH',
        'Renk Kodu': '100100',
        'Beden': 'L',
        'PSFTL': 3999.99,
        'TSFTL': 1999.995,
        'Fiyat İskontolu': 879.998,
        'Miktar Toplam': 2,
        'CİNSİYET': 'ERKEK',
        'Müşteri Firma Adı': 'Muhammet Güneysu'
      },
      {
        'Barkod': '8684195523364',
        'Madde Kodu': '122050011',
        'Madde Açıklaması': 'CESSIE',
        'ÜRÜN GRUBU': 'EŞOFMAN',
        'Renk Açıklaması': 'KIRIK BEYAZ',
        'Renk Kodu': '100510',
        'Beden': 'L',
        'PSFTL': 4499.99,
        'TSFTL': 2249.99,
        'Fiyat İskontolu': 989.996,
        'Miktar Toplam': 1,
        'CİNSİYET': 'ERKEK',
        'Müşteri Firma Adı': 'Muhammet Güneysu'
      }
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ürün Listesi')
    XLSX.writeFile(wb, 'Guneysu_Lufian_Urun_Sablonu.xlsx')
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
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        if (!rows || rows.length === 0) {
          setExcelError('Dosya boş görünüyor.')
          return
        }

        // 1. Find Header Row (the row containing 'barkod' or 'barcode' or 'madde' or 'ürün')
        let headerRowIdx = -1
        for (let i = 0; i < Math.min(10, rows.length); i++) {
          const row = rows[i] || []
          if (
            row.some((cell) => {
              const s = String(cell || '').toLowerCase().trim()
              return (
                s.includes('barkod') ||
                s.includes('barcode') ||
                s.includes('madde') ||
                s.includes('ürün') ||
                s.includes('urun')
              )
            })
          ) {
            headerRowIdx = i
            break
          }
        }

        if (headerRowIdx === -1) {
          headerRowIdx = 0
        }

        const headerRow = rows[headerRowIdx] || []
        const nextRow = rows[headerRowIdx + 1] || []

        // Merge headers if second row has column titles (e.g. 'Miktar Toplam' in row 1 of Güneysu)
        const combinedHeaders: string[] = []
        const maxCols = Math.max(headerRow.length, nextRow.length)
        for (let c = 0; c < maxCols; c++) {
          let name = headerRow[c] != null ? String(headerRow[c]).trim() : ''
          if (!name && nextRow[c] != null && typeof nextRow[c] === 'string' && isNaN(Number(nextRow[c]))) {
            name = String(nextRow[c]).trim()
          }
          combinedHeaders.push(name)
        }

        let dataStartIdx = headerRowIdx + 1
        if (nextRow.some((c) => String(c || '').toLowerCase().includes('miktar toplam'))) {
          dataStartIdx = headerRowIdx + 2
        }

        const itemsMap = new Map<string, any>()

        for (let r = dataStartIdx; r < rows.length; r++) {
          const row = rows[r] || []
          if (row.length === 0 || !row.some((c) => c !== null && c !== undefined && c !== '')) continue

          const dict: Record<string, any> = {}
          for (let c = 0; c < combinedHeaders.length; c++) {
            const h = combinedHeaders[c]
            if (h) {
              dict[h.toLowerCase().trim()] = row[c]
            }
          }

          const rawBarcode = String(
            dict['barkod'] ||
            dict['barcode'] ||
            dict['bar kod'] ||
            row[6] ||
            ''
          ).trim()

          // Skip total / subtotal rows or invalid barcodes
          if (
            !rawBarcode ||
            rawBarcode.length < 4 ||
            rawBarcode.toLowerCase().includes('toplam') ||
            row.some((cell) => String(cell || '').toLowerCase().includes('toplam') && !rawBarcode)
          ) {
            continue
          }

          const code = String(
            dict['madde kodu'] ||
            dict['ürün kodu'] ||
            dict['urun kodu'] ||
            dict['model kodu'] ||
            dict['stok kodu'] ||
            dict['kod'] ||
            dict['code'] ||
            row[8] ||
            ''
          ).trim()

          const rawName = String(
            dict['ürün adı'] ||
            dict['urun adi'] ||
            dict['madde açıklaması'] ||
            dict['madde aciklamasi'] ||
            dict['model'] ||
            dict['ad'] ||
            dict['name'] ||
            row[9] ||
            ''
          ).trim()

          const category = String(
            dict['ürün grubu'] ||
            dict['urun grubu'] ||
            dict['kategori'] ||
            dict['category'] ||
            row[7] ||
            ''
          ).trim()

          const color = String(
            dict['renk açıklaması'] ||
            dict['renk aciklamasi'] ||
            dict['renk'] ||
            dict['color'] ||
            row[10] ||
            'Standart'
          ).trim()

          const size = String(
            dict['beden'] ||
            dict['size'] ||
            row[12] ||
            'Standart'
          ).trim()

          const salePrice = parseDecimal(
            dict['psftl'] ||
            dict['psf'] ||
            dict['satış fiyatı'] ||
            dict['satis fiyati'] ||
            dict['fiyat'] ||
            dict['price'] ||
            row[13]
          )

          const discountPrice = parseDecimal(
            dict['fiyat iskontolu'] ||
            dict['iskontolu fiyat'] ||
            dict['indirimli fiyat'] ||
            dict['indirimli satış fiyatı'] ||
            dict['indirimli satis fiyati'] ||
            dict['discount price'] ||
            dict['discount'] ||
            row[14]
          )

          const costPrice = parseDecimal(
            dict['tsftl'] ||
            dict['tsf'] ||
            dict['alış fiyatı'] ||
            dict['alis fiyati'] ||
            dict['maliyet'] ||
            dict['cost'] ||
            row[15]
          )

          const rawQty = parseInt(
            dict['miktar toplam'] ||
            dict['miktar'] ||
            dict['stok adedi'] ||
            dict['stok'] ||
            dict['adet'] ||
            dict['quantity'] ||
            row[16] ||
            1
          )
          const quantity = isNaN(rawQty) || rawQty < 0 ? 0 : rawQty

          let fullName = rawName
          if (
            (dict['madde açıklaması'] || dict['madde aciklamasi']) &&
            !dict['ürün adı'] &&
            !dict['urun adi'] &&
            category &&
            !rawName.toLowerCase().includes(category.toLowerCase())
          ) {
            fullName = `${rawName} (${category})`
          } else if (!fullName) {
            fullName = category || 'Ürün'
          }

          const brand = String(
            dict['marka'] ||
            dict['brand'] ||
            (dict['müşteri firma adı'] ? 'Lufian' : 'Mağaza')
          ).trim()

          if (itemsMap.has(rawBarcode)) {
            const existing = itemsMap.get(rawBarcode)
            existing.quantity += quantity
            if (salePrice > 0) existing.salePrice = Math.round(salePrice * 100) / 100
            if (costPrice > 0) existing.costPrice = Math.round(costPrice * 100) / 100
            if (discountPrice > 0) existing.discountPrice = Math.round(discountPrice * 100) / 100
          } else {
            itemsMap.set(rawBarcode, {
              code: code || `PRD-${rawBarcode.slice(-6)}`,
              name: fullName,
              category: category || 'Giyim',
              brand: brand || 'Lufian',
              barcode: rawBarcode,
              color: color || 'Standart',
              size: size || 'Standart',
              costPrice: isNaN(costPrice) ? 0 : Math.round(costPrice * 100) / 100,
              salePrice: isNaN(salePrice) ? 0 : Math.round(salePrice * 100) / 100,
              discountPrice: discountPrice > 0 ? Math.round(discountPrice * 100) / 100 : null,
              quantity,
            })
          }
        }

        const mapped = Array.from(itemsMap.values())

        if (mapped.length === 0) {
          setExcelError('Geçerli ürün bulunamadı. Lütfen "Barkod" ve "Ürün Adı / Madde Açıklaması" sütunlarının dolu olduğundan emin olun.')
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
    setEditDiscountPrice(variant.discountPrice ? variant.discountPrice.toString() : '')
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
          salePrice: parseDecimal(editSalePrice),
          costPrice: parseDecimal(editCostPrice),
          discountPrice: editDiscountPrice ? parseDecimal(editDiscountPrice) : null,
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
          basePrice: parseDecimal(editProdBasePrice),
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
      const res = await fetch(`/api/products/variants/${addStockVariant.id}/add-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addedQuantity: qty,
          note: 'Mal kabul stok girişi',
        }),
      })

      if (res.ok) {
        const targetId = addStockVariant.id
        const targetSku = addStockVariant.sku
        setAddStockVariant(null)
        setAddQtyVal('')
        setHighlightedVariantId(targetId)
        setScanToast({
          type: 'success',
          message: `✅ "${targetSku}" stoğuna +${qty} adet başarıyla eklendi!`,
        })
        setTimeout(() => setScanToast(null), 4000)
        setTimeout(() => setHighlightedVariantId(null), 6000)
        await fetchProducts()
        notifyDataChanged()
      } else {
        const errData = await res.json()
        alert('Stok ekleme hatası: ' + (errData.error || 'Bilinmeyen hata'))
      }
    } catch {
      alert('Hata oluştu')
    }
  }

  // --- ADD NEW VARIANT TO EXISTING PRODUCT ---
  const handleAddVariantToProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return
    if (!newVarBarcode.trim()) {
      alert('Lütfen geçerli bir barkod numarası girin veya otomatik üretin!')
      return
    }

    setIsCreatingVariant(true)
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color: newVarColor,
          size: newVarSize,
          barcode: newVarBarcode.trim(),
          salePrice: parseDecimal(newVarSalePrice) || selectedProduct.basePrice,
          costPrice: parseDecimal(newVarCostPrice) || ((parseDecimal(newVarSalePrice) || selectedProduct.basePrice) * 0.5),
          discountPrice: newVarDiscountPrice ? parseDecimal(newVarDiscountPrice) : null,
          stockQuantity: parseInt(newVarStockQty) || 0,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setIsAddVariantModalOpen(false)
        setNewVarBarcode('')
        setNewVarDiscountPrice('')
        setNewVarStockQty('1')
        setHighlightedVariantId(data.id)
        setScanToast({
          type: 'success',
          message: `✅ Yeni varyant (${newVarColor} / ${newVarSize}) başarıyla eklendi!`,
        })
        setTimeout(() => setScanToast(null), 4000)
        setTimeout(() => setHighlightedVariantId(null), 6000)
        await fetchProducts()
        notifyDataChanged()
      } else {
        alert('Varyant ekleme hatası: ' + (data.error || 'Bilinmeyen hata'))
      }
    } catch (err: any) {
      alert('Hata: ' + err.message)
    } finally {
      setIsCreatingVariant(false)
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
      basePrice: parseDecimal(newBasePrice || '100'),
      variants: [
        {
          sku: `${newCode}-${newColor}-${newSize}`,
          barcode: trimmedBarcode,
          attributes: { color: newColor, size: newSize },
          costPrice: parseDecimal(newBasePrice || '100') * 0.5,
          salePrice: parseDecimal(newBasePrice || '100'),
          discountPrice: newDiscountPrice ? parseDecimal(newDiscountPrice) : null,
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
        setNewBasePrice('')
        setNewDiscountPrice('')
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

  // --- BARCODE SEARCH & LOOKUP HANDLER ---
  const handleBarcodeSearchSubmit = async (codeToSearch: string) => {
    const raw = codeToSearch.trim()
    if (!raw) return

    // 1. Check in-memory variants by barcode or SKU
    let matchedProduct: any = null
    let matchedVariant: any = null

    for (const prod of products) {
      const v = prod.variants?.find(
        (variant: any) =>
          variant.barcode === raw ||
          variant.sku?.toLowerCase() === raw.toLowerCase()
      )
      if (v) {
        matchedProduct = prod
        matchedVariant = v
        break
      }
    }

    // 2. If not matched by barcode, check if product code matches exactly
    if (!matchedProduct) {
      matchedProduct = products.find((prod) => prod.code?.toLowerCase() === raw.toLowerCase())
      if (matchedProduct && matchedProduct.variants?.length > 0) {
        matchedVariant = matchedProduct.variants[0]
      }
    }

    // 3. If still not found in memory, query server barcode lookup
    if (!matchedProduct) {
      try {
        const res = await fetch(`/api/products/variants/barcode/${encodeURIComponent(raw)}`)
        if (res.ok) {
          const vData = await res.json()
          matchedVariant = vData
          matchedProduct = products.find((p) => p.id === vData.productId) || vData.product
        }
      } catch (err) {
        console.error('Barcode lookup error:', err)
      }
    }

    if (matchedProduct) {
      setSelectedProduct(matchedProduct)
      if (matchedVariant) {
        setHighlightedVariantId(matchedVariant.id)
        setTimeout(() => setHighlightedVariantId(null), 6000)
      }
      setScanToast({
        type: 'success',
        message: `⚡ Bulundu: "${matchedProduct.name}" ${
          matchedVariant?.attributes?.color ? `(${matchedVariant.attributes.color} / ${matchedVariant.attributes.size})` : ''
        }`,
      })
      setTimeout(() => setScanToast(null), 4000)
    } else {
      if (filteredProducts.length > 0) {
        setSelectedProduct(filteredProducts[0])
        setScanToast({
          type: 'success',
          message: `⚡ Eşleşen Ürün: "${filteredProducts[0].name}"`,
        })
        setTimeout(() => setScanToast(null), 3000)
      } else {
        setScanToast({
          type: 'error',
          message: `⚠️ Barkod veya arama bulunamadı: "${raw}"`,
        })
        setTimeout(() => setScanToast(null), 4000)
      }
    }
  }

  // --- GLOBAL USB HID BARCODE SCANNER LISTENER ---
  useEffect(() => {
    let barcodeBuffer = ''
    let lastKeyTime = Date.now()

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        isAddModalOpen ||
        isBarcodeStockModalOpen ||
        isCategoryModalOpen ||
        isExcelModalOpen ||
        isAdminPinOpen ||
        addStockVariant ||
        editingVariant ||
        editingProduct ||
        isAddVariantModalOpen
      ) {
        return
      }

      const activeElement = document.activeElement
      const isSearchFocused = activeElement === searchInputRef.current
      const isOtherInputFocused =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'SELECT'

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTime
      lastKeyTime = currentTime

      if (timeDiff > 120) {
        barcodeBuffer = ''
      }

      if (e.key === 'Enter') {
        const code = (isSearchFocused ? searchTerm : barcodeBuffer).trim()
        if (code.length >= 2) {
          e.preventDefault()
          handleBarcodeSearchSubmit(code)
        }
        barcodeBuffer = ''
        return
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isOtherInputFocused || isSearchFocused || timeDiff < 50) {
          barcodeBuffer += e.key
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    isAddModalOpen,
    isBarcodeStockModalOpen,
    isCategoryModalOpen,
    isExcelModalOpen,
    isAdminPinOpen,
    addStockVariant,
    editingVariant,
    editingProduct,
    isAddVariantModalOpen,
    searchTerm,
    products,
  ])

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredProducts = products.filter((p) => {
    if (!normalizedSearch) return true
    if (p.name?.toLowerCase().includes(normalizedSearch)) return true
    if (p.code?.toLowerCase().includes(normalizedSearch)) return true
    if (p.brand && p.brand.toLowerCase().includes(normalizedSearch)) return true
    if (p.category?.name && p.category.name.toLowerCase().includes(normalizedSearch)) return true
    if (p.variants?.some((v: any) => {
      const bc = String(v.barcode || '').toLowerCase()
      const sku = String(v.sku || '').toLowerCase()
      const clr = String(v.attributes?.color || '').toLowerCase()
      const sz = String(v.attributes?.size || '').toLowerCase()
      return bc.includes(normalizedSearch) || sku.includes(normalizedSearch) || clr.includes(normalizedSearch) || sz.includes(normalizedSearch)
    })) {
      return true
    }
    return false
  })

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 flex overflow-hidden font-sans">
      {/* Left List: Products */}
      <div className="w-1/3 border-r border-white/60 flex flex-col glass-panel shadow-lg">
        <div className="p-3.5 border-b border-white/40 space-y-2.5 bg-white/40 backdrop-blur-xs">
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
                  setUnregisteredBarcode(null)
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

          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Ürün Adı, Kod veya Barkod Okutun..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleBarcodeSearchSubmit(searchTerm)
                  }
                }}
                className="w-full pl-8 pr-16 py-2 bg-white/70 backdrop-blur-xs border border-slate-300/80 rounded-xl text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <div className="absolute right-2 top-2 flex items-center space-x-1">
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('')
                      searchInputRef.current?.focus()
                    }}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                    title="Aramayı Temizle"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <div
                  className="flex items-center text-emerald-600 pl-0.5"
                  title="Barkod okuyucu aktif: Barkodu okutup Enter tuşuna basabilirsiniz."
                >
                  <Barcode className="w-4 h-4" />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleBarcodeSearchSubmit(searchTerm)}
              className="px-3.5 py-2 bg-[#00268A] hover:bg-[#001f70] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5 shrink-0"
              title="Aramayı Başlat"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Ara</span>
            </button>
          </div>

          {/* Barcode Search Toast / Feedback Notification */}
          {scanToast && (
            <div
              className={`p-2 rounded text-xs font-semibold flex items-center justify-between border transition animate-fadeIn ${
                scanToast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <div className="flex items-center space-x-1.5 overflow-hidden">
                {scanToast.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                )}
                <span className="truncate">{scanToast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setScanToast(null)}
                className="text-slate-400 hover:text-slate-600 text-xs ml-2 shrink-0 font-bold"
              >
                ✕
              </button>
            </div>
          )}
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
                    <span className="block text-xs font-bold text-slate-900 mt-1">{(Number(prod.basePrice) || 0).toFixed(2)} ₺</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Column: Variant & Stock Details */}
      <div className="flex-1 flex flex-col glass-panel overflow-y-auto">
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
              <div className="glass-card rounded-2xl p-3.5 text-right shadow-xs">
                <span className="text-[11px] text-slate-500 font-semibold block uppercase">Taban Satış Fiyatı</span>
                <span className="text-xl font-bold text-emerald-700">{(Number(selectedProduct.basePrice) || 0).toFixed(2)} ₺</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-tight flex items-center space-x-1.5">
                  <PackageCheck className="w-4 h-4 text-blue-700" />
                  <span>Ürün Varyantları & Stok Seviyeleri</span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setNewVarColor('Siyah')
                    setNewVarSize('M')
                    setNewVarSalePrice(selectedProduct.basePrice?.toString() || '100')
                    setNewVarCostPrice(((parseFloat(selectedProduct.basePrice) || 100) * 0.5).toString())
                    setNewVarDiscountPrice('')
                    setNewVarBarcode('')
                    setNewVarStockQty('1')
                    setIsAddVariantModalOpen(true)
                  }}
                  className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold flex items-center space-x-1 shadow-xs transition"
                  title="Bu ürüne yeni renk, beden veya barkod varyantı ekle"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Yeni Varyant Ekle</span>
                </button>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden shadow-xs border border-white/60">
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
                      const isHighlighted =
                        v.id === highlightedVariantId ||
                        (searchTerm.trim() && v.barcode === searchTerm.trim())

                      return (
                        <tr
                          key={v.id}
                          className={`transition ${
                            isHighlighted
                              ? 'bg-emerald-50 border-2 border-emerald-500 shadow-xs'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-5 py-3 font-semibold text-slate-900">
                            <div className="flex items-center space-x-1.5">
                              <span>{v.attributes?.color} / {v.attributes?.size}</span>
                              {isHighlighted && (
                                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded shadow-2xs flex items-center space-x-0.5 animate-pulse">
                                  <Barcode className="w-2.5 h-2.5" />
                                  <span>Barkod Eşleşti</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3 font-mono text-slate-500">{v.sku}</td>
                          <td className="px-5 py-3 font-mono text-slate-700 font-medium">
                            <span className={isHighlighted ? 'text-emerald-800 font-bold' : ''}>
                              {v.barcode}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {v.discountPrice && v.discountPrice > 0 ? (
                              <div className="flex flex-col">
                                <span className="line-through text-slate-400 text-xs font-normal">
                                  {(Number(v.salePrice) || 0).toFixed(2)} ₺
                                </span>
                                <span className="font-extrabold text-rose-600 text-sm">
                                  {(Number(v.discountPrice) || 0).toFixed(2)} ₺
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-emerald-700">
                                {(Number(v.salePrice) || 0).toFixed(2)} ₺
                              </span>
                            )}
                          </td>
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
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-lg shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Scan className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Barkod Okutarak Stok Kabulü</h3>
                  <p className="text-[11px] text-slate-500">Barkod okuyucu ile okutun veya barkod numarasını yazıp enter'a basın.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsBarcodeStockModalOpen(false)
                  setScannedBarcode('')
                  setUnregisteredBarcode(null)
                }}
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
                <div className="relative flex items-center">
                  <input
                    ref={scanInputRef}
                    type="text"
                    placeholder="Barkod okuyucu hazır..."
                    value={scannedBarcode}
                    onChange={(e) => {
                      const val = e.target.value
                      setScannedBarcode(val)
                      if (unregisteredBarcode && val.trim() !== unregisteredBarcode) {
                        setUnregisteredBarcode(null)
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2.5 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-16"
                    autoFocus
                  />
                  <div className="absolute right-2.5 flex items-center space-x-1.5">
                    {scannedBarcode && (
                      <button
                        type="button"
                        onClick={() => {
                          setScannedBarcode('')
                          setUnregisteredBarcode(null)
                          scanInputRef.current?.focus()
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded hover:bg-slate-200 transition"
                        title="Temizle"
                      >
                        ✕
                      </button>
                    )}
                    {foundScannedVariant ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      scannedBarcode.trim() && <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                  </div>
                </div>
              </div>

              {/* Matched Product Details Card (Found in database) */}
              {foundScannedVariant && (
                <div className="p-3.5 bg-slate-50 border border-emerald-300 rounded-lg space-y-2 animate-fadeIn">
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
                      <span className="block text-xs font-bold text-emerald-700 mt-0.5">{(Number(foundScannedVariant.salePrice) || 0).toFixed(2)} ₺</span>
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
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-xs flex items-center justify-center space-x-1 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Stoğa Ekle (Enter)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Unregistered Barcode: Quick Register Card */}
              {/* Only shown after user/scanner enters barcode and Enter confirms it does NOT exist */}
              {!foundScannedVariant && unregisteredBarcode && (
                <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-lg space-y-3 animate-fadeIn">
                  <div className="flex items-center space-x-2 text-amber-800 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Bu barkod (<strong>{unregisteredBarcode}</strong>) sistemde kayıtlı değil!</span>
                  </div>

                  <div className="bg-white p-3 rounded border border-amber-200 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-xs text-slate-800 flex items-center space-x-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>⚡ Bu Barkodla Hızlı Ürün Tanımla ve Stoğa Ekle</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Barkod: {unregisteredBarcode}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Ürün Adı *</label>
                        <input
                          type="text"
                          placeholder="Örn: Pamuklu Polo Tişört"
                          value={quickName}
                          onChange={(e) => setQuickName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleQuickCreateAndStock()
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Satış Fiyatı (₺) *</label>
                          <input
                            type="number"
                            step="0.01"
                            value={quickSalePrice}
                            onChange={(e) => setQuickSalePrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleQuickCreateAndStock()
                              }
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-emerald-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-rose-700 uppercase mb-0.5">İskontolu Fiyat (₺)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Opsiyonel"
                            value={quickDiscountPrice}
                            onChange={(e) => setQuickDiscountPrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleQuickCreateAndStock()
                              }
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-rose-300 rounded text-xs font-bold text-rose-600"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Giriş Stoğu (Adet) *</label>
                        <input
                          type="number"
                          min="1"
                          value={quickQty}
                          onChange={(e) => setQuickQty(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleQuickCreateAndStock()
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        Veya yeni bir barkod okutarak devam edin
                      </span>
                      <button
                        type="button"
                        onClick={handleQuickCreateAndStock}
                        disabled={isQuickSubmitting || !quickName.trim()}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shadow-xs flex items-center space-x-1 disabled:opacity-50 transition cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isQuickSubmitting ? 'Kaydediliyor...' : 'Kaydet ve Stoğa Al'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBarcodeStockModalOpen(false)
                    setScannedBarcode('')
                    setUnregisteredBarcode(null)
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200 transition"
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

              <div className="grid grid-cols-3 gap-3">
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
                  <label className="block text-slate-700 font-semibold mb-1">İskontolu Fiyat (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Opsiyonel"
                    value={editDiscountPrice}
                    onChange={(e) => setEditDiscountPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-rose-600 focus:ring-1 focus:ring-indigo-600"
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Satış Fiyatı (TL)</label>
                  <input
                    type="number"
                    value={newBasePrice}
                    onChange={(e) => setNewBasePrice(e.target.value)}
                    placeholder="100"
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-emerald-700 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">İskontolu Fiyat (TL)</label>
                  <input
                    type="number"
                    value={newDiscountPrice}
                    onChange={(e) => setNewDiscountPrice(e.target.value)}
                    placeholder="Opsiyonel"
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-rose-600 focus:ring-1 focus:ring-blue-600"
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
                  <span>Önizleme ({excelRows.length} Benzersiz Ürün / Varyant - Toplam {excelRows.reduce((s, r) => s + r.quantity, 0)} Adet Stok)</span>
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
                          <td className="px-3 py-1 text-emerald-700 font-semibold">{(Number(row.salePrice) || 0).toFixed(2)} ₺</td>
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
                {excelRows.length > 0 && !excelResult
                  ? `${excelRows.length} benzersiz ürün/barkod (Toplam ${excelRows.reduce((s, r) => s + r.quantity, 0)} adet stok) aktarılmaya hazır.`
                  : ''}
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

      {/* New Variant Modal for Selected Product */}
      {isAddVariantModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <Plus className="w-5 h-5 text-blue-700" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Mevcut Ürüne Yeni Varyant Ekle</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedProduct.name} ({selectedProduct.code})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVariantModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddVariantToProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Varyant Renk *</label>
                  <input
                    type="text"
                    placeholder="Örn: Siyah, Mavi"
                    value={newVarColor}
                    onChange={(e) => setNewVarColor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Beden *</label>
                  <input
                    type="text"
                    placeholder="Örn: S, M, L, 42"
                    value={newVarSize}
                    onChange={(e) => setNewVarSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Barcode Section with Scanner / Generator */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold flex items-center space-x-1">
                    <Barcode className="w-3.5 h-3.5 text-blue-700" />
                    <span>Barkod Numarası *</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateVariantBarcode}
                    className="text-[11px] font-semibold text-blue-700 hover:text-blue-800 hover:underline flex items-center space-x-1"
                    title="Otomatik 13 haneli EAN barkod üret"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>Otomatik Üret</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    ref={newVarBarcodeInputRef}
                    type="text"
                    placeholder="Barkod okutun veya elle yazın..."
                    value={newVarBarcode}
                    onChange={(e) => setNewVarBarcode(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-mono font-bold text-xs focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                  {newVarBarcode.trim() && (
                    <div className="absolute right-2.5 top-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Satış Fiyatı (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newVarSalePrice}
                    onChange={(e) => setNewVarSalePrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-emerald-700 focus:ring-1 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">İskontolu Fiyat (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Opsiyonel"
                    value={newVarDiscountPrice}
                    onChange={(e) => setNewVarDiscountPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-rose-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Alış Fiyatı (Maliyet ₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newVarCostPrice}
                    onChange={(e) => setNewVarCostPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-semibold focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Başlangıç Stoğu (Adet)</label>
                <input
                  type="number"
                  min="0"
                  value={newVarStockQty}
                  onChange={(e) => setNewVarStockQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-base focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddVariantModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingVariant}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold shadow-sm flex items-center space-x-1 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingVariant ? 'Ekleniyor...' : 'Varyantı Kaydet & Stoğa Al'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
