import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Plus,
  Search,
  Layers,
  Edit3,
  Trash2,
  PackageCheck,
  Package,
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
import { usePosStore } from '../../store/usePosStore'

const parseDecimal = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = String(val).replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

// Cleans leaked barcode scanner numbers from text fields (e.g. Size/Color) if scanned by accident
const cleanBarcodeFromInput = (currentVal: any, scannedCode: string, fallbackDefault = ''): string => {
  if (!currentVal) return fallbackDefault
  const clean = String(currentVal).trim()
  if (!clean || clean === scannedCode) return fallbackDefault

  if (clean.endsWith(scannedCode)) {
    return clean.slice(0, -scannedCode.length).trim() || fallbackDefault
  }
  if (clean.includes(scannedCode)) {
    return clean.replace(scannedCode, '').trim() || fallbackDefault
  }
  const match = clean.match(/^([^\d]*)([\d]{3,})$/)
  if (match && scannedCode.startsWith(match[2])) {
    return match[1].trim() || fallbackDefault
  }
  return clean
}

const SIZE_ORDER: Record<string, number> = {
  'XXS': 1, '2XS': 1,
  'XS': 2,
  'S': 3,
  'M': 4,
  'L': 5,
  'XL': 6,
  'XXL': 7, '2XL': 7,
  '3XL': 8, 'XXXL': 8,
  '4XL': 9, 'XXXXL': 9,
  '5XL': 10,
  'STANDART': 11, 'STD': 11, 'TEK': 11, 'TEK EBAT': 11,
}

const compareSizes = (a: string = '', b: string = ''): number => {
  const normA = (a || '').trim().toUpperCase()
  const normB = (b || '').trim().toUpperCase()
  const orderA = SIZE_ORDER[normA]
  const orderB = SIZE_ORDER[normB]
  if (orderA !== undefined && orderB !== undefined) return orderA - orderB
  if (orderA !== undefined) return -1
  if (orderB !== undefined) return 1
  const numA = parseFloat(normA)
  const numB = parseFloat(normB)
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB
  return normA.localeCompare(normB, 'tr-TR')
}

// Safely extracts color and size from variant attributes whether object or JSON string
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

export const StockView: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>('ALL')

  // Reset color filter when product changes
  useEffect(() => {
    setSelectedColorFilter('ALL')
  }, [selectedProduct?.id])

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


  // Search input and barcode scan highlight states
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [highlightedVariantId, setHighlightedVariantId] = useState<string | null>(null)
  const [scanToast, setScanToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Identifies the active scanned variant if any
  const activeScannedVariant = useMemo(() => {
    if (!selectedProduct?.variants) return null
    const term = searchTerm.trim().toLowerCase()
    return (
      selectedProduct.variants.find((v: any) => {
        if (v.id === highlightedVariantId) return true
        if (!term) return false
        if (v.barcode && v.barcode.toLowerCase() === term) return true
        if (v.sku && v.sku.toLowerCase() === term) return true
        return false
      }) || null
    )
  }, [selectedProduct, highlightedVariantId, searchTerm])

  // Groups variants by Color for the fast visual stock matrix
  const variantsGroupedByColor = useMemo(() => {
    if (!selectedProduct?.variants) return []
    const map: Record<string, any[]> = {}
    selectedProduct.variants.forEach((v: any) => {
      const { color } = getVariantAttrs(v)
      if (!map[color]) map[color] = []
      map[color].push(v)
    })

    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b, 'tr-TR'))
      .map((color) => {
        const sortedVars = [...map[color]].sort((a, b) =>
          compareSizes(getVariantAttrs(a).size, getVariantAttrs(b).size)
        )
        const totalStock = sortedVars.reduce((sum, v) => sum + (v.stockQuantity || 0), 0)
        return {
          color,
          variants: sortedVars,
          totalStock,
        }
      })
  }, [selectedProduct])

  // Sorted and filtered list of variants for the table
  const sortedAndFilteredVariants = useMemo(() => {
    if (!selectedProduct?.variants) return []
    let list = [...selectedProduct.variants]

    if (selectedColorFilter && selectedColorFilter !== 'ALL') {
      list = list.filter(
        (v: any) => getVariantAttrs(v).color === selectedColorFilter
      )
    }

    list.sort((a: any, b: any) => {
      const { color: colorA, size: sizeA } = getVariantAttrs(a)
      const { color: colorB, size: sizeB } = getVariantAttrs(b)
      const cDiff = colorA.localeCompare(colorB, 'tr-TR')
      if (cDiff !== 0) return cDiff
      return compareSizes(sizeA, sizeB)
    })

    return list
  }, [selectedProduct, selectedColorFilter])


  const showToast = (type: 'success' | 'error' | 'info', message: string, duration = 4000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setScanToast({ type, message })
    toastTimerRef.current = setTimeout(() => {
      setScanToast(null)
    }, duration)
  }

  // Modal in-app error states (never use window.alert on Windows Electron to prevent unclickable app lockups)
  const [addModalError, setAddModalError] = useState<string | null>(null)
  const [addVarModalError, setAddVarModalError] = useState<string | null>(null)
  const [editVarModalError, setEditVarModalError] = useState<string | null>(null)
  const [editProdModalError, setEditProdModalError] = useState<string | null>(null)

  // Custom modal states for delete & archive confirmation (no window.confirm)
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState<any | null>(null)
  const [archiveConfirmData, setArchiveConfirmData] = useState<{ product: any; error: string } | null>(null)

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
  const newVarSizeInputRef = useRef<HTMLInputElement>(null)

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)


  // Excel Bulk Import Modal State
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false)
  const [excelRows, setExcelRows] = useState<any[]>([])
  const [rawParsedItems, setRawParsedItems] = useState<any[]>([])
  const [excelDefaultBrand, setExcelDefaultBrand] = useState('Lufian')
  const [excelBrandRule, setExcelBrandRule] = useState<'fallback' | 'force' | 'excel_only'>('fallback')
  const [excelFileName, setExcelFileName] = useState('')
  const [isExcelImporting, setIsExcelImporting] = useState(false)
  const [excelResult, setExcelResult] = useState<any | null>(null)
  const [excelError, setExcelError] = useState<string | null>(null)

  // Unique existing brands for auto-complete and quick select
  const existingBrands = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => {
      if (p.brand && typeof p.brand === 'string') {
        const b = p.brand.trim()
        if (b && b !== 'Marka' && b !== 'Mağaza') {
          set.add(b)
        }
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr-TR'))
  }, [products])

  // Dynamically recalculate excelRows whenever raw items, default brand, or brand rule changes
  useEffect(() => {
    if (rawParsedItems.length === 0) {
      setExcelRows([])
      return
    }

    const updated = rawParsedItems.map((item) => {
      let brandToAssign = ''
      if (excelBrandRule === 'force') {
        brandToAssign = excelDefaultBrand.trim()
      } else if (excelBrandRule === 'excel_only') {
        brandToAssign = item.rawBrand || ''
      } else {
        // fallback: use Excel column if present and non-empty, otherwise use user's default brand
        brandToAssign = item.rawBrand || excelDefaultBrand.trim()
      }

      return {
        ...item,
        brand: brandToAssign || null,
        forceBrand: excelBrandRule === 'force',
      }
    })

    setExcelRows(updated)
  }, [rawParsedItems, excelDefaultBrand, excelBrandRule])

  // Admin PIN gate for corrections/edits
  const [isAdminPinOpen, setIsAdminPinOpen] = useState(false)
  const [pendingVariantEdit, setPendingVariantEdit] = useState<any | null>(null)
  const [pendingProductEdit, setPendingProductEdit] = useState<any | null>(null)
  const [pendingProductDelete, setPendingProductDelete] = useState<any | null>(null)
  const [stockFilter, setStockFilter] = useState<'active' | 'archived'>('active')
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
  const newNameInputRef = useRef<HTMLInputElement>(null)
  const newBasePriceInputRef = useRef<HTMLInputElement>(null)
  const newColorInputRef = useRef<HTMLInputElement>(null)
  const newSizeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAddModalOpen) {
      setAddModalError(null)
      setTimeout(() => barcodeInputRef.current?.focus(), 150)
    }
  }, [isAddModalOpen])

  useEffect(() => {
    if (isAddVariantModalOpen) {
      setAddVarModalError(null)
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

    let lastUpdate = 0
    const handleDataUpdate = () => {
      const now = Date.now()
      if (now - lastUpdate < 500) return
      lastUpdate = now
      fetchProducts()
      fetchCategories()
    }

    window.addEventListener('pos-data-updated', handleDataUpdate)
    window.addEventListener('focus', handleDataUpdate)

    // Arka plan senkronizasyonu: Anlık güncellemeler zaten pos-data-updated ile anında tetiklenir.
    // Celeron işlemcide donma yaratmamak için periyodik kontrol 60 saniyeye çekildi.
    const syncInterval = setInterval(() => {
      if (usePosStore.getState().activeTab !== 'stock') return
      fetchProducts()
      fetchCategories()
    }, 60000)

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
        'Marka': 'Lufian'
      },
      {
        'Barkod': '8684195532120',
        'Madde Kodu': '112030204',
        'Madde Açıklaması': 'STORM',
        'Marka': 'Lufian',
        'ÜRÜN GRUBU': 'SWEAT SHIRT',
        'Renk Açıklaması': 'SİYAH',
        'Renk Kodu': '100100',
        'Beden': 'L',
        'PSFTL': 3999.99,
        'TSFTL': 1999.995,
        'Fiyat İskontolu': 879.998,
        'Miktar Toplam': 2,
        'CİNSİYET': 'ERKEK'
      },
      {
        'Barkod': '8684195523364',
        'Madde Kodu': '122050011',
        'Madde Açıklaması': 'CESSIE',
        'Marka': 'Lufian',
        'ÜRÜN GRUBU': 'EŞOFMAN',
        'Renk Açıklaması': 'KIRIK BEYAZ',
        'Renk Kodu': '100510',
        'Beden': 'L',
        'PSFTL': 4499.99,
        'TSFTL': 2249.99,
        'Fiyat İskontolu': 989.996,
        'Miktar Toplam': 1,
        'CİNSİYET': 'ERKEK'
      }
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ürün Listesi')
    XLSX.writeFile(wb, 'MagazaPOS_Urun_Sablonu.xlsx')
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

          const rawBrand = String(
            dict['marka'] ||
            dict['brand'] ||
            dict['markası'] ||
            dict['markasi'] ||
            dict['marka adı'] ||
            dict['marka adi'] ||
            dict['üretici'] ||
            dict['uretici'] ||
            dict['firma'] ||
            dict['tedarikçi'] ||
            dict['tedarikci'] ||
            ''
          ).trim()

          if (itemsMap.has(rawBarcode)) {
            const existing = itemsMap.get(rawBarcode)
            existing.quantity += quantity
            if (salePrice > 0) existing.salePrice = Math.round(salePrice * 100) / 100
            if (costPrice > 0) existing.costPrice = Math.round(costPrice * 100) / 100
            if (discountPrice > 0) existing.discountPrice = Math.round(discountPrice * 100) / 100
            if (!existing.rawBrand && rawBrand) existing.rawBrand = rawBrand
          } else {
            itemsMap.set(rawBarcode, {
              code: code || `PRD-${rawBarcode.slice(-6)}`,
              name: fullName,
              category: category || 'Giyim',
              rawBrand,
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

        setRawParsedItems(mapped)
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
    setEditVarModalError(null)
    if (!editingVariant) return

    try {
      const res = await fetch(`/api/products/variants/${editingVariant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': localStorage.getItem('pos_admin_pin_session') || '',
        },
        body: JSON.stringify({
          color: editColor.trim(),
          size: editSize.trim(),
          salePrice: parseDecimal(editSalePrice),
          costPrice: parseDecimal(editCostPrice),
          discountPrice: editDiscountPrice ? parseDecimal(editDiscountPrice) : null,
          barcode: editBarcode.trim(),
          stockQuantity: parseInt(editStockVal || '0', 10),
          note: 'Varyant detay ve stok düzeltme',
        }),
      })

      if (res.ok) {
        setEditingVariant(null)
        setEditVarModalError(null)
        showToast('success', 'Varyant bilgileri başarıyla güncellendi.')
        fetchProducts()
        notifyDataChanged()
      } else {
        const errData = await res.json()
        if (errData.code === 'UNAUTHORIZED_ADMIN_PIN') {
          showToast('error', 'Yönetici PIN doğrulama hatası. Lütfen tekrar deneyin.')
          setAdminVerifiedForSession(false)
        } else {
          setEditVarModalError(errData.error || 'Güncelleme hatası oluştu.')
        }
      }
    } catch (err: any) {
      setEditVarModalError(`Hata: ${err.message || 'Bilinmeyen hata'}`)
    }
  }

  // --- EDIT MAIN PRODUCT HANDLERS ---
  const openProductEditModal = (product: any) => {
    setEditingProduct(product)
    setEditProdModalError(null)
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
    setEditProdModalError(null)
    if (!editingProduct) return

    try {
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': localStorage.getItem('pos_admin_pin_session') || '',
        },
        body: JSON.stringify({
          name: editProdName.trim(),
          code: editProdCode.trim(),
          brand: editProdBrand ? editProdBrand.trim() : null,
          categoryId: editProdCategoryId || null,
          basePrice: parseDecimal(editProdBasePrice),
        }),
      })

      if (res.ok) {
        setEditingProduct(null)
        setEditProdModalError(null)
        showToast('success', 'Ürün bilgileri başarıyla güncellendi.')
        fetchProducts()
        notifyDataChanged()
      } else {
        const errData = await res.json()
        if (errData.code === 'UNAUTHORIZED_ADMIN_PIN') {
          showToast('error', 'Yönetici PIN doğrulama hatası. Lütfen tekrar deneyin.')
          setAdminVerifiedForSession(false)
        } else {
          setEditProdModalError(errData.error || 'Ürün güncelleme hatası.')
        }
      }
    } catch (err: any) {
      setEditProdModalError(`Hata: ${err.message || 'Bilinmeyen hata'}`)
    }
  }

  // --- QUICK ADD STOCK (MANUAL ROW CLICK - NO PIN) ---
  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addStockVariant || !addQtyVal) return
    const qty = parseInt(addQtyVal)
    if (isNaN(qty) || qty <= 0) {
      showToast('error', 'Lütfen geçerli bir adet girin!')
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
        showToast('success', `✅ "${targetSku}" stoğuna +${qty} adet başarıyla eklendi!`)
        setTimeout(() => setHighlightedVariantId(null), 6000)
        await fetchProducts()
        notifyDataChanged()
      } else {
        const errData = await res.json()
        showToast('error', 'Stok ekleme hatası: ' + (errData.error || 'Bilinmeyen hata'))
      }
    } catch {
      showToast('error', 'Hata oluştu')
    }
  }

  // --- ADD NEW VARIANT TO EXISTING PRODUCT ---
  const handleAddVariantToProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddVarModalError(null)
    if (!selectedProduct) return
    if (!newVarBarcode.trim()) {
      setAddVarModalError('Lütfen geçerli bir barkod numarası girin veya otomatik üretin!')
      return
    }

    setIsCreatingVariant(true)
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color: newVarColor.trim(),
          size: newVarSize.trim(),
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
        setAddVarModalError(null)
        setNewVarBarcode('')
        setNewVarDiscountPrice('')
        setNewVarStockQty('1')
        setHighlightedVariantId(data.id)
        showToast('success', `✅ Yeni varyant (${newVarColor} / ${newVarSize}) başarıyla eklendi!`)
        setTimeout(() => setHighlightedVariantId(null), 6000)
        await fetchProducts()
        notifyDataChanged()
      } else {
        setAddVarModalError(data.error || 'Varyant ekleme hatası.')
      }
    } catch (err: any) {
      setAddVarModalError(`Hata: ${err.message || 'Bilinmeyen hata'}`)
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
    if (pendingProductDelete) {
      performProductDelete(pendingProductDelete)
      setPendingProductDelete(null)
    }
  }

  // --- DELETE / ARCHIVE PRODUCT HANDLERS ---
  const handleProductDeleteClick = (product: any) => {
    if (!product) return
    // Show non-blocking custom confirmation modal (never window.confirm)
    setDeleteConfirmProduct(product)
  }

  const performProductDelete = async (product: any, action?: string) => {
    try {
      const url = action ? `/api/products/${product.id}?action=${action}` : `/api/products/${product.id}`
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Pin': localStorage.getItem('pos_admin_pin_session') || '',
        },
      })

      const data = await res.json()

      if (res.ok) {
        showToast('success', data.message || 'Ürün başarıyla silindi.')
        setSelectedProduct(null)
        fetchProducts()
        notifyDataChanged()
      } else {
        if (data.code === 'UNAUTHORIZED_ADMIN_PIN') {
          showToast('error', 'Yönetici PIN doğrulaması başarısız. Lütfen tekrar deneyin.')
          setAdminVerifiedForSession(false)
          setPendingProductDelete(product)
          setIsAdminPinOpen(true)
          return
        }

        // Eğer geçmiş satışı olduğu için silinemiyorsa arşive alma teklif et:
        if (data.hasSales) {
          setArchiveConfirmData({ product, error: data.error })
        } else {
          showToast('error', 'Silme hatası: ' + (data.error || 'Bilinmeyen hata'))
        }
      }
    } catch (err: any) {
      showToast('error', 'İşlem sırasında hata oluştu: ' + (err.message || ''))
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
    setAddModalError(null)

    if (!newCode.trim() || !newName.trim() || !newBarcode.trim()) {
      setAddModalError('Lütfen Ürün Kodu, Adı ve Barkod alanlarını doldurun!')
      return
    }

    if (duplicateProduct) {
      setAddModalError(`⚠️ Barkod numarası (${trimmedBarcode}) zaten "${duplicateProduct.name}" (${duplicateProduct.code}) üzerinde kayıtlıdır! Lütfen farklı bir barkod kullanın.`)
      return
    }

    const payload = {
      code: newCode.trim(),
      name: newName.trim(),
      brand: newBrand ? newBrand.trim() : null,
      categoryId: newCategoryId || null,
      basePrice: parseDecimal(newBasePrice || '100'),
      variants: [
        {
          sku: `${newCode.trim()}-${newColor.trim()}-${newSize.trim()}`,
          barcode: trimmedBarcode,
          attributes: { color: newColor.trim(), size: newSize.trim() },
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
        setAddModalError(null)
        setNewCode('')
        setNewName('')
        setNewBarcode('')
        setNewCategoryId('')
        setNewBasePrice('')
        setNewDiscountPrice('')
        setNewStockQuantity('0')
        showToast('success', `✅ "${newName}" ürünü ve varyantı (${newColor} / ${newSize}) başarıyla eklendi!`)
        fetchProducts()
        fetchCategories()
        notifyDataChanged()
      } else {
        const err = await res.json()
        setAddModalError(err.error || 'Ürün oluşturulamadı.')
      }
    } catch (err: any) {
      setAddModalError(`Hata: ${err.message || 'Bağlantı hatası'}`)
    }
  }

  const [displayLimit, setDisplayLimit] = useState(80)

  useEffect(() => {
    setDisplayLimit(80)
  }, [searchTerm, stockFilter])

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const totalStock = p.variants?.reduce((acc: number, v: any) => acc + (v.stockQuantity || 0), 0) || 0

      // Arama kutusunda bir şey yazmıyorsa sekmeye göre filtrele:
      if (!normalizedSearch) {
        if (stockFilter === 'active' && totalStock <= 0) return false
        if (stockFilter === 'archived' && totalStock > 0) return false
      }

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
  }, [products, normalizedSearch, stockFilter])

  // Celeron ve düşük donanımlı POS cihazlarında DOM kasmalarını önlemek için dilimlenmiş görünüm
  const visibleProducts = useMemo(() => {
    if (selectedProduct) {
      const idx = filteredProducts.findIndex((p) => p.id === selectedProduct.id)
      if (idx >= displayLimit) {
        return filteredProducts.slice(0, idx + 20)
      }
    }
    return filteredProducts.slice(0, displayLimit)
  }, [filteredProducts, displayLimit, selectedProduct])

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
      const prodTotalStock = matchedProduct.variants?.reduce((acc: number, v: any) => acc + (v.stockQuantity || 0), 0) || 0
      if (prodTotalStock <= 0 && stockFilter === 'active') {
        setStockFilter('archived')
      } else if (prodTotalStock > 0 && stockFilter === 'archived') {
        setStockFilter('active')
      }
      setSelectedProduct(matchedProduct)
      if (matchedVariant) {
        setHighlightedVariantId(matchedVariant.id)
        setTimeout(() => setHighlightedVariantId(null), 6000)
      }
      showToast(
        'success',
        `⚡ Bulundu: "${matchedProduct.name}" ${
          matchedVariant?.attributes?.color ? `(${matchedVariant.attributes.color} / ${matchedVariant.attributes.size})` : ''
        }`
      )
    } else {
      if (filteredProducts.length > 0) {
        setSelectedProduct(filteredProducts[0])
        showToast('success', `⚡ Eşleşen Ürün: "${filteredProducts[0].name}"`, 3000)
      } else {
        showToast('error', `⚠️ Barkod veya arama bulunamadı: "${raw}"`)
      }
    }
  }

  // --- GLOBAL USB HID BARCODE SCANNER LISTENER ---
  useEffect(() => {
    let barcodeBuffer = ''
    let lastKeyTime = Date.now()
    let charTimings: number[] = []

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (usePosStore.getState().activeTab !== 'stock') {
        return
      }

      // Modals that strictly do not accept barcodes
      if (
        isCategoryModalOpen ||
        isExcelModalOpen ||
        isAdminPinOpen ||
        addStockVariant ||
        editingProduct
      ) {
        return
      }

      const activeElement = document.activeElement as HTMLElement | null
      const isSearchFocused = activeElement === searchInputRef.current
      const isAddBarcodeFocused = activeElement === barcodeInputRef.current
      const isAddVarBarcodeFocused = activeElement === newVarBarcodeInputRef.current
      const isBarcodeFieldFocused = isSearchFocused || isAddBarcodeFocused || isAddVarBarcodeFocused

      const isOtherInputFocused =
        (activeElement?.tagName === 'INPUT' ||
          activeElement?.tagName === 'TEXTAREA' ||
          activeElement?.tagName === 'SELECT') &&
        !isBarcodeFieldFocused

      const currentTime = Date.now()
      const timeDiff = currentTime - lastKeyTime
      lastKeyTime = currentTime

      if (timeDiff > 120) {
        barcodeBuffer = ''
        charTimings = []
      }

      // Enter suffix from barcode scanner or user keyboard
      if (e.key === 'Enter') {
        const avgTiming =
          charTimings.length > 0
            ? charTimings.reduce((a, b) => a + b, 0) / charTimings.length
            : 999
        const isRapidScanner = avgTiming < 55 && charTimings.length >= 2

        // A. If "Yeni Ürün Ekle" modal is open:
        if (isAddModalOpen) {
          const code = (isAddBarcodeFocused ? newBarcode : barcodeBuffer).trim()
          if (isRapidScanner || isAddBarcodeFocused) {
            e.preventDefault()
            e.stopPropagation()
            if (code.length >= 3) {
              // Sanitize any field (like Beden/Size) that had focus during scan
              if (isOtherInputFocused) {
                setNewSize((prev) => cleanBarcodeFromInput(prev, code, 'M'))
                setNewColor((prev) => cleanBarcodeFromInput(prev, code, 'Siyah'))
                setNewName((prev) => cleanBarcodeFromInput(prev, code, ''))
                setNewCode((prev) => cleanBarcodeFromInput(prev, code, ''))
              }
              setNewBarcode(code)
              barcodeInputRef.current?.focus()
              showToast('success', `Barkod okuyucudan aktarıldı: ${code}`)
            }
          }
          barcodeBuffer = ''
          charTimings = []
          return
        }

        // B. If "Yeni Varyant Ekle" modal is open:
        if (isAddVariantModalOpen) {
          const code = (isAddVarBarcodeFocused ? newVarBarcode : barcodeBuffer).trim()
          if (isRapidScanner || isAddVarBarcodeFocused) {
            e.preventDefault()
            e.stopPropagation()
            if (code.length >= 3) {
              if (isOtherInputFocused) {
                setNewVarSize((prev) => cleanBarcodeFromInput(prev, code, 'M'))
                setNewVarColor((prev) => cleanBarcodeFromInput(prev, code, 'Siyah'))
              }
              setNewVarBarcode(code)
              newVarBarcodeInputRef.current?.focus()
              showToast('success', `Barkod okuyucudan aktarıldı: ${code}`)
            }
          }
          barcodeBuffer = ''
          charTimings = []
          return
        }

        // C. If "Varyant Düzenle" modal is open:
        if (editingVariant) {
          const code = barcodeBuffer.trim()
          if (isRapidScanner && code.length >= 3) {
            e.preventDefault()
            e.stopPropagation()
            if (isOtherInputFocused) {
              setEditSize((prev) => cleanBarcodeFromInput(prev, code, 'M'))
              setEditColor((prev) => cleanBarcodeFromInput(prev, code, 'Siyah'))
            }
            setEditBarcode(code)
            showToast('success', `Barkod okundu: ${code}`)
          }
          barcodeBuffer = ''
          charTimings = []
          return
        }

        // D. Main Stock Screen Table Search
        const code = (isSearchFocused ? searchTerm : barcodeBuffer).trim()
        if (code.length >= 2) {
          e.preventDefault()
          handleBarcodeSearchSubmit(code)
        }
        barcodeBuffer = ''
        charTimings = []
        return
      }

      // Capture single printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isOtherInputFocused || isBarcodeFieldFocused || timeDiff < 45) {
          barcodeBuffer += e.key
          charTimings.push(timeDiff)
          if (charTimings.length > 30) charTimings.shift()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [
    isAddModalOpen,
    isCategoryModalOpen,
    isExcelModalOpen,
    isAdminPinOpen,
    addStockVariant,
    editingVariant,
    editingProduct,
    isAddVariantModalOpen,
    searchTerm,
    newBarcode,
    newVarBarcode,
    products,
    filteredProducts,
    stockFilter,
  ])

  // Sekme değiştirildiğinde (Aktif vs Arşiv), seçili ürün yeni sekme kuralına uymuyorsa o sekmedeki ilk ürünü seç
  useEffect(() => {
    if (selectedProduct && !searchTerm.trim()) {
      const totalStock = selectedProduct.variants?.reduce((acc: number, v: any) => acc + (v.stockQuantity || 0), 0) || 0
      if (stockFilter === 'active' && totalStock <= 0) {
        const firstActive = products.find((p) => (p.variants?.reduce((s: number, v: any) => s + (v.stockQuantity || 0), 0) || 0) > 0)
        setSelectedProduct(firstActive || null)
      } else if (stockFilter === 'archived' && totalStock > 0) {
        const firstArchived = products.find((p) => (p.variants?.reduce((s: number, v: any) => s + (v.stockQuantity || 0), 0) || 0) <= 0)
        setSelectedProduct(firstArchived || null)
      }
    }
  }, [stockFilter, products])

    const activeProductsCount = useMemo(() => {
    return products.filter((p) => (p.variants?.reduce((s: number, v: any) => s + (v.stockQuantity || 0), 0) || 0) > 0).length
  }, [products])

  const archivedProductsCount = useMemo(() => {
    return products.filter((p) => (p.variants?.reduce((s: number, v: any) => s + (v.stockQuantity || 0), 0) || 0) <= 0).length
  }, [products])

  const totalStockCount = useMemo(() => {
    return products.reduce(
      (acc, p) => acc + (p.variants?.reduce((s: number, v: any) => s + (v.stockQuantity || 0), 0) || 0),
      0
    )
  }, [products])

  const filteredStockCount = useMemo(() => {
    return filteredProducts.reduce(
      (acc, p) => acc + (p.variants?.reduce((s: number, v: any) => s + (v.stockQuantity || 0), 0) || 0),
      0
    )
  }, [filteredProducts])

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 flex overflow-hidden font-sans">
      {/* Left List: Products */}
      <div className="w-[320px] lg:w-[340px] xl:w-[360px] shrink-0 border-r border-white/60 flex flex-col glass-panel shadow-lg">
        <div className="p-2.5 border-b border-white/40 space-y-2 bg-white/40 backdrop-blur-xs">
          <div className="flex items-center justify-between gap-1">
            <h2 className="font-bold text-slate-900 text-xs flex items-center space-x-1 shrink-0">
              <Layers className="w-3.5 h-3.5 text-blue-700" />
              <span>Ürünler</span>
            </h2>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setIsExcelModalOpen(true)
                  setRawParsedItems([])
                  setExcelRows([])
                  setExcelFileName('')
                  setExcelResult(null)
                  setExcelError(null)
                }}
                className="px-1.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-semibold flex items-center space-x-1 transition shadow-2xs whitespace-nowrap"
                title="Excel / CSV ile Toplu Ürün ve Stok Yükleme"
              >
                <FileSpreadsheet className="w-3 h-3 shrink-0" />
                <span>Toplu Excel</span>
              </button>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-1.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-semibold flex items-center space-x-1 transition shadow-2xs whitespace-nowrap"
                title="Kategorileri Yönet"
              >
                <Tag className="w-3 h-3 text-blue-700 shrink-0" />
                <span>Kategori</span>
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-2 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-[11px] font-semibold flex items-center space-x-1 transition shadow-xs whitespace-nowrap"
                title="Yeni Ürün Ekle"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span>Yeni Ürün</span>
              </button>
            </div>
          </div>

          {/* Toplam Kalem ve Toplam Ürün Sayısı Göstergesi */}
          <div className="flex items-center justify-between bg-white/80 border border-slate-200/90 rounded-lg px-2.5 py-1.5 shadow-2xs">
            <div className="flex items-center space-x-1.5">
              <Package className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span className="text-slate-600 font-semibold text-[11px]">Kalem:</span>
              <span className="font-bold text-slate-900 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                {searchTerm.trim() ? `${filteredProducts.length} / ${products.length}` : products.length} Kalem
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-600 font-semibold text-[11px]">Toplam Ürün:</span>
              <span className="font-bold text-emerald-700 text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {searchTerm.trim()
                  ? `${filteredStockCount.toLocaleString('tr-TR')} / ${totalStockCount.toLocaleString('tr-TR')}`
                  : `${totalStockCount.toLocaleString('tr-TR')} Adet`}
              </span>
            </div>
          </div>

          {/* Aktif Stok vs Arşiv Sekmesi */}
          <div className="flex items-center space-x-1 bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/60">
            <button
              type="button"
              onClick={() => setStockFilter('active')}
              className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                stockFilter === 'active'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📦 Aktif Stok</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                stockFilter === 'active' ? 'bg-blue-50 text-blue-800' : 'bg-slate-300 text-slate-700'
              }`}>
                {activeProductsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('archived')}
              className={`flex-1 py-1 px-1.5 rounded-md text-[11px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer ${
                stockFilter === 'archived'
                  ? 'bg-white text-amber-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🗄️ Arşiv / Tükenen</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                stockFilter === 'archived' ? 'bg-amber-50 text-amber-800' : 'bg-slate-300 text-slate-700'
              }`}>
                {archivedProductsCount}
              </span>
            </button>
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
        <div 
          className="flex-1 overflow-y-auto p-2.5 space-y-1.5"
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
            if (scrollHeight - scrollTop - clientHeight < 150) {
              if (displayLimit < filteredProducts.length) {
                setDisplayLimit((prev) => Math.min(prev + 60, filteredProducts.length))
              }
            }
          }}
        >
          {visibleProducts.map((prod) => {
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
                      {totalStock > 0 ? `${totalStock} Adet` : '0 (Tükendi / Arşiv)'}
                    </span>
                    <span className="block text-xs font-bold text-slate-900 mt-1">{(Number(prod.basePrice) || 0).toFixed(2)} ₺</span>
                  </div>
                </div>
              </div>
            )
          })}

          {filteredProducts.length > visibleProducts.length && (
            <div className="pt-2 pb-1 text-center">
              <button
                type="button"
                onClick={() => setDisplayLimit((prev) => prev + 60)}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300 hover:border-blue-300 rounded text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                Daha Fazla Ürün Göster ({filteredProducts.length - visibleProducts.length} ürün daha)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Variant & Stock Details */}
      <div className="flex-1 min-w-0 flex flex-col glass-panel overflow-y-auto">
        {selectedProduct ? (
          <div className="p-4 space-y-4">
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
                  <button
                    onClick={() => handleProductDeleteClick(selectedProduct)}
                    className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-300 rounded text-[11px] font-semibold flex items-center space-x-1 transition"
                    title="Ürünü Sil veya Arşive Gönder (Yönetici PIN Gerekli)"
                  >
                    <Trash2 className="w-3 h-3 text-rose-600" />
                    <span>Ürünü Sil</span>
                    <ShieldAlert className="w-2.5 h-2.5 text-rose-400 opacity-60" />
                  </button>
                </div>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">{selectedProduct.name}</h1>
                <p className="text-xs text-slate-500 font-mono mt-1">
                  Ürün Kodu: {selectedProduct.code} {selectedProduct.brand ? `| Marka: ${selectedProduct.brand}` : ''}
                </p>
              </div>
              <div className="glass-card rounded-2xl p-3.5 text-right shadow-xs shrink-0">
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
                    const firstVariant = selectedProduct.variants?.[0]
                    setNewVarColor('Siyah')
                    setNewVarSize('M')
                    if (firstVariant) {
                      setNewVarSalePrice(
                        firstVariant.salePrice != null
                          ? firstVariant.salePrice.toString()
                          : (selectedProduct.basePrice?.toString() || '100')
                      )
                      setNewVarCostPrice(
                        firstVariant.costPrice != null
                          ? firstVariant.costPrice.toString()
                          : ((parseFloat(selectedProduct.basePrice) || 100) * 0.5).toString()
                      )
                      setNewVarDiscountPrice(
                        firstVariant.discountPrice != null && firstVariant.discountPrice > 0
                          ? firstVariant.discountPrice.toString()
                          : ''
                      )
                    } else {
                      setNewVarSalePrice(selectedProduct.basePrice?.toString() || '100')
                      setNewVarCostPrice(((parseFloat(selectedProduct.basePrice) || 100) * 0.5).toString())
                      setNewVarDiscountPrice('')
                    }
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

              {/* Active Scanned Variant Alert Banner */}
              {activeScannedVariant && (
                <div className="p-3 bg-emerald-50/90 border-2 border-emerald-500 rounded-2xl flex items-center justify-between shadow-xs animate-fadeIn">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Barcode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                          📍 Okutulan Barkod Eşleşti
                        </span>
                        <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded border border-emerald-300">
                          {activeScannedVariant.barcode}
                        </span>
                      </div>
                      <div className="text-xs text-emerald-900 mt-0.5 flex flex-wrap items-center gap-x-2.5">
                        <span>
                          Renk: <strong className="font-black text-slate-900">{getVariantAttrs(activeScannedVariant).color}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Beden: <strong className="font-black text-slate-900">{getVariantAttrs(activeScannedVariant).size}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Satış Fiyatı:{' '}
                          <strong className="font-black text-emerald-800">
                            {(Number(activeScannedVariant.salePrice) || 0).toFixed(2)} ₺
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black border shadow-2xs ${
                        activeScannedVariant.stockQuantity > 0
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-rose-600 text-white border-rose-700'
                      }`}
                    >
                      {activeScannedVariant.stockQuantity > 0
                        ? `${activeScannedVariant.stockQuantity} Adet Mevcut`
                        : '0 Adet (Tükendi)'}
                    </span>
                  </div>
                </div>
              )}

              {/* Beden & Renk Hızlı Stok Dağılım Matrisi */}
              {variantsGroupedByColor.length > 0 && (
                <div className="bg-white/80 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-blue-700" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                        Beden & Renk Stok Dağılımı ({selectedProduct.variants?.length || 0} Çeşit Varyant)
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      Toplam Stok:{' '}
                      <strong className="text-slate-900 font-bold">
                        {selectedProduct.variants?.reduce(
                          (acc: number, v: any) => acc + (v.stockQuantity || 0),
                          0
                        )}{' '}
                        Adet
                      </strong>
                    </span>
                  </div>

                  {/* Renk Grupları ve Beden Rozetleri */}
                  <div className="space-y-2">
                    {variantsGroupedByColor.map(({ color, variants, totalStock }) => (
                      <div
                        key={color}
                        className="flex flex-wrap items-center gap-2 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80"
                      >
                        <div className="flex items-center space-x-1.5 min-w-[120px] shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                          <span className="font-bold text-xs text-slate-900">{color}</span>
                          <span className="text-[10px] text-slate-500 font-semibold">
                            ({totalStock} Adet)
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                          {variants.map((v) => {
                            const isTarget =
                              v.id === highlightedVariantId ||
                              (searchTerm.trim() && v.barcode === searchTerm.trim())
                            const hasStock = v.stockQuantity > 0

                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  setHighlightedVariantId(v.id)
                                  const el = document.getElementById(`variant-row-${v.id}`)
                                  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition flex items-center space-x-1.5 cursor-pointer ${
                                  isTarget
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400 scale-105'
                                    : hasStock
                                    ? 'bg-white hover:bg-blue-50 text-slate-800 border-slate-200/90 shadow-2xs'
                                    : 'bg-rose-50/70 hover:bg-rose-100 text-rose-700 border-rose-200/80'
                                }`}
                                title={`${color} / ${getVariantAttrs(v).size} - Mevcut Stok: ${v.stockQuantity} Adet | Barkod: ${v.barcode || '-'}`}
                              >
                                <span className="font-extrabold">{getVariantAttrs(v).size}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    isTarget
                                      ? 'bg-emerald-800 text-emerald-100'
                                      : hasStock
                                      ? 'bg-blue-100 text-blue-900'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {hasStock ? `${v.stockQuantity} Adet` : '0 - Tükendi'}
                                </span>
                                {isTarget && <span className="text-[10px]">📍</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Renk Bazında Hızlı Tablo Filtresi */}
                  {variantsGroupedByColor.length > 1 && (
                    <div className="pt-1 flex items-center space-x-1.5 flex-wrap gap-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Renk Filtresi:</span>
                      <button
                        type="button"
                        onClick={() => setSelectedColorFilter('ALL')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold transition border ${
                          selectedColorFilter === 'ALL'
                            ? 'bg-blue-700 text-white border-blue-800 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Tümü ({selectedProduct.variants?.length || 0})
                      </button>
                      {variantsGroupedByColor.map(({ color, variants }) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setSelectedColorFilter(color)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition border ${
                            selectedColorFilter === color
                              ? 'bg-blue-700 text-white border-blue-800 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {color} ({variants.length})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Varyantlar Tablosu - Ayrı Renk & Beden Sütunları, Yapışkan ve Tam Görünen İşlem Sütunu */}
              <div className="glass-card rounded-2xl overflow-x-auto shadow-xs border border-white/60">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="px-3.5 py-3 whitespace-nowrap">Renk</th>
                      <th className="px-3.5 py-3 whitespace-nowrap text-center">Beden</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Barkod & SKU</th>
                      <th className="px-3.5 py-3 whitespace-nowrap">Satış Fiyatı</th>
                      <th className="px-3.5 py-3 whitespace-nowrap text-center">Mevcut Stok</th>
                      <th className="px-3.5 py-3 text-right whitespace-nowrap w-[170px] min-w-[170px] sticky right-0 bg-slate-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] z-10">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedAndFilteredVariants.map((v: any) => {
                      const isHighlighted =
                        v.id === highlightedVariantId ||
                        (searchTerm.trim() && v.barcode === searchTerm.trim())

                      return (
                        <tr
                          id={`variant-row-${v.id}`}
                          key={v.id}
                          className={`transition group ${
                            isHighlighted
                              ? 'bg-emerald-50/90 font-medium'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Ayrı Renk Sütunu */}
                          <td className="px-3.5 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0 group-hover:scale-125 transition-transform"></span>
                              <span className="font-bold text-slate-800">
                                {getVariantAttrs(v).color}
                              </span>
                              {isHighlighted && (
                                <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded shadow-2xs flex items-center space-x-0.5 animate-pulse shrink-0">
                                  <Barcode className="w-2.5 h-2.5" />
                                  <span>Okutulan</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Ayrı Beden Sütunu */}
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200/90 text-[#00268A] text-xs font-black shadow-2xs">
                              {getVariantAttrs(v).size}
                            </span>
                          </td>

                          {/* Barkod ve Altında SKU */}
                          <td className="px-3.5 py-2 font-mono text-slate-700 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span
                                className={`text-xs ${
                                  isHighlighted ? 'text-emerald-800 font-extrabold' : 'font-bold'
                                }`}
                                title={v.barcode || ''}
                              >
                                {v.barcode || '-'}
                              </span>
                              {v.sku && (
                                <span
                                  className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]"
                                  title={`SKU: ${v.sku}`}
                                >
                                  SKU: {v.sku}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Satış Fiyatı */}
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            {v.discountPrice && v.discountPrice > 0 ? (
                              <div className="flex flex-col">
                                <span className="line-through text-slate-400 text-[10px]">
                                  {(Number(v.salePrice) || 0).toFixed(2)} ₺
                                </span>
                                <span className="font-extrabold text-rose-600 text-xs">
                                  {(Number(v.discountPrice) || 0).toFixed(2)} ₺
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-emerald-700 text-xs">
                                {(Number(v.salePrice) || 0).toFixed(2)} ₺
                              </span>
                            )}
                          </td>

                          {/* Mevcut Stok */}
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${
                                v.stockQuantity > 10
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : v.stockQuantity > 0
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {v.stockQuantity > 0 ? `${v.stockQuantity} Adet` : '0 - Tükendi'}
                            </span>
                          </td>

                          {/* İşlem Sütunu - STICKY ve TAM GÖRÜNÜR */}
                          <td
                            className={`px-3.5 py-2 text-right w-[170px] min-w-[170px] whitespace-nowrap sticky right-0 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] ${
                              isHighlighted
                                ? 'bg-emerald-50/95 backdrop-blur-xs'
                                : 'bg-white/95 backdrop-blur-xs group-hover:bg-slate-50/95'
                            }`}
                          >
                            <div className="flex items-center justify-end space-x-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setAddStockVariant(v)
                                  setAddQtyVal('')
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg transition text-xs font-bold flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs"
                                title="Şifresiz Mal Kabul Stok Girişi"
                              >
                                <Plus className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>+ Stok</span>
                              </button>
                              <button
                                onClick={() => handleStockEditClick(v)}
                                className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-300 hover:border-indigo-300 rounded-lg transition text-xs font-bold flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs"
                                title="Yönetici PIN ile Tüm Varyant ve Stok Bilgilerini Düzelt"
                              >
                                <Edit3 className="w-3 h-3 text-indigo-600 shrink-0" />
                                <span>Düzelt</span>
                                <ShieldAlert className="w-2.5 h-2.5 text-indigo-400 opacity-60 shrink-0" />
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

            {editVarModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold flex items-start space-x-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1 leading-snug">{editVarModalError}</span>
                <button
                  type="button"
                  onClick={() => setEditVarModalError(null)}
                  className="text-rose-400 hover:text-rose-600 font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleUpdateVariant} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Varyant Renk</label>
                  <input
                    type="text"
                    value={editColor}
                    onChange={(e) => {
                      setEditColor(e.target.value)
                      if (editVarModalError) setEditVarModalError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Beden</label>
                  <input
                    type="text"
                    value={editSize}
                    onChange={(e) => {
                      setEditSize(e.target.value)
                      if (editVarModalError) setEditVarModalError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-emerald-700 focus:ring-1 focus:ring-indigo-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">İndirimli Fiyat (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Opsiyonel"
                    value={editDiscountPrice}
                    onChange={(e) => setEditDiscountPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-semibold focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Barkod Numarası</label>
                <input
                  type="text"
                  value={editBarcode}
                  onChange={(e) => {
                    setEditBarcode(e.target.value)
                    if (editVarModalError) setEditVarModalError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleUpdateVariant(e)
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault()
                  }}
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

            {editProdModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold flex items-start space-x-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1 leading-snug">{editProdModalError}</span>
                <button
                  type="button"
                  onClick={() => setEditProdModalError(null)}
                  className="text-rose-400 hover:text-rose-600 font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleUpdateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ürün Kodu</label>
                <input
                  type="text"
                  value={editProdCode}
                  onChange={(e) => {
                    setEditProdCode(e.target.value)
                    if (editProdModalError) setEditProdModalError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault()
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ürün Adı</label>
                <input
                  type="text"
                  value={editProdName}
                  onChange={(e) => {
                    setEditProdName(e.target.value)
                    if (editProdModalError) setEditProdModalError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault()
                  }}
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.preventDefault()
                    }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleUpdateProduct(e)
                    }
                  }}
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
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-900 text-sm">Yeni Ürün Ekle</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {addModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold flex items-start space-x-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1 leading-snug">{addModalError}</span>
                <button
                  type="button"
                  onClick={() => setAddModalError(null)}
                  className="text-rose-400 hover:text-rose-600 font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ürün Kodu (Örn: PRD-TSH-010) *</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => {
                    setNewCode(e.target.value)
                    if (addModalError) setAddModalError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      newNameInputRef.current?.focus()
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-blue-600"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Ürün Adı (Örn: Slim Fit Tişört) *</label>
                <input
                  ref={newNameInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    if (addModalError) setAddModalError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      newBasePriceInputRef.current?.focus()
                    }
                  }}
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
                    ref={newBasePriceInputRef}
                    type="number"
                    value={newBasePrice}
                    onChange={(e) => setNewBasePrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        newColorInputRef.current?.focus()
                      }
                    }}
                    placeholder="100"
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold text-emerald-700 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">İndirimli Fiyat (TL)</label>
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
                    ref={newColorInputRef}
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        newSizeInputRef.current?.focus()
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-900 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Beden</label>
                  <input
                    ref={newSizeInputRef}
                    type="text"
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        barcodeInputRef.current?.focus()
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 text-slate-900 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Barcode Section with Scanner & Manual support and Real-time Duplicate Check */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold flex items-center space-x-1">
                    <Barcode className="w-3.5 h-3.5 text-blue-700" />
                    <span>Barkod Numarası *</span>
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
                    onChange={(e) => {
                      setNewBarcode(e.target.value)
                      if (addModalError) setAddModalError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateProduct(e)
                      }
                    }}
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
        }}
      />

      {/* Admin PIN Modal for Stock/Product Corrections */}
      <AdminPinModal
        isOpen={isAdminPinOpen}
        onClose={() => {
          setIsAdminPinOpen(false)
          setPendingVariantEdit(null)
          setPendingProductEdit(null)
          setPendingProductDelete(null)
        }}
        onVerified={handleAdminVerifiedForStock}
        title="Düzenleme ve Silme Yetkisi"
        subtitle="Ürün ve varyant bilgilerini değiştirmek veya silmek için Yönetici PIN girin."
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

              {/* Marka Atama / Yapılandırma Kartı */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800">Marka Atama Kuralı</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {excelDefaultBrand ? `Varsayılan: ${excelDefaultBrand}` : 'Varsayılan: Markasız (Boş)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {/* Kural Seçimi */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Marka Önceliği</label>
                    <select
                      value={excelBrandRule}
                      onChange={(e) => setExcelBrandRule(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      <option value="fallback">Excel'de Varsa Onu Al, Yoksa Varsayılan Markayı Ata</option>
                      <option value="force">Tüm Ürünlere Zorla Bu Markayı Ata</option>
                      <option value="excel_only">Sadece Excel'deki Markayı Al (Yoksa Boş Bırak)</option>
                    </select>
                  </div>

                  {/* Varsayılan Marka Girişi */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Varsayılan Marka {excelBrandRule === 'excel_only' && '(Devre Dışı)'}
                    </label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="text"
                        disabled={excelBrandRule === 'excel_only'}
                        placeholder="Örn: Lufian, Jack & Jones vb."
                        value={excelDefaultBrand}
                        onChange={(e) => setExcelDefaultBrand(e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                        list="excel-brand-suggestions"
                      />
                      <datalist id="excel-brand-suggestions">
                        {existingBrands.map((b) => (
                          <option key={b} value={b} />
                        ))}
                      </datalist>
                      {excelDefaultBrand && (
                        <button
                          type="button"
                          onClick={() => setExcelDefaultBrand('')}
                          className="px-2 py-1.5 text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-medium"
                          title="Markayı Temizle / Boş Bırak"
                        >
                          Temizle
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hızlı Seçim Butonları */}
                {excelBrandRule !== 'excel_only' && (
                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-medium">Hızlı Seç:</span>
                    {['Lufian', 'Jack & Jones', ...existingBrands.filter(b => b !== 'Lufian' && b !== 'Jack & Jones').slice(0, 3)].map((brandName) => (
                      <button
                        key={brandName}
                        type="button"
                        onClick={() => setExcelDefaultBrand(brandName)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                          excelDefaultBrand === brandName
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {brandName}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setExcelDefaultBrand('')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                        excelDefaultBrand === ''
                          ? 'bg-slate-700 text-white font-semibold'
                          : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-300'
                      }`}
                    >
                      Boş Bırak (Belirtilmemiş)
                    </button>
                  </div>
                )}
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
                        <th className="px-3 py-1.5">Marka</th>
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
                          <td className="px-3 py-1">
                            {row.brand ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {row.brand}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[10px]">Belirtilmemiş</span>
                            )}
                          </td>
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

            {addVarModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold flex items-start space-x-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="flex-1 leading-snug">{addVarModalError}</span>
                <button
                  type="button"
                  onClick={() => setAddVarModalError(null)}
                  className="text-rose-400 hover:text-rose-600 font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleAddVariantToProduct} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Varyant Renk *</label>
                  <input
                    type="text"
                    placeholder="Örn: Siyah, Mavi"
                    value={newVarColor}
                    onChange={(e) => {
                      setNewVarColor(e.target.value)
                      if (addVarModalError) setAddVarModalError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        newVarSizeInputRef.current?.focus()
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Beden *</label>
                  <input
                    ref={newVarSizeInputRef}
                    type="text"
                    placeholder="Örn: S, M, L, 42"
                    value={newVarSize}
                    onChange={(e) => {
                      setNewVarSize(e.target.value)
                      if (addVarModalError) setAddVarModalError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        newVarBarcodeInputRef.current?.focus()
                      }
                    }}
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
                    onChange={(e) => {
                      setNewVarBarcode(e.target.value)
                      if (addVarModalError) setAddVarModalError(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddVariantToProduct(e)
                      }
                    }}
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

              {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="text-[10px] text-blue-700 bg-blue-50/80 border border-blue-200/60 rounded px-2.5 py-1 flex items-center space-x-1 font-medium">
                  <span>ℹ️ Fiyatlar ürünün ilk varyantından otomatik dolduruldu (İstendiğinde değiştirilebilir).</span>
                </div>
              )}

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
                  <label className="block text-slate-700 font-semibold mb-1">İndirimli Fiyat (₺)</label>
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

      {/* Custom Non-blocking Product Delete Confirmation Modal */}
      {deleteConfirmProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Ürünü Silmek İstiyor Musunuz?</h3>
                <p className="text-xs text-slate-500 font-semibold">{deleteConfirmProduct.name} ({deleteConfirmProduct.code})</p>
              </div>
            </div>
            <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p>• Satış kaydı yoksa ürün veritabanından tamamen silinir.</p>
              <p>• Geçmiş satışı varsa fiş geçmişini korumak için stoğu 0 yapılarak "Arşiv / Tükenenler"e kaldırılır.</p>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmProduct(null)}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  const prod = deleteConfirmProduct
                  setDeleteConfirmProduct(null)
                  if (adminVerifiedForSession) {
                    performProductDelete(prod)
                  } else {
                    setPendingProductDelete(prod)
                    setIsAdminPinOpen(true)
                  }
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-sm"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Archive Prompt Modal (when product has sales history) */}
      {archiveConfirmData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-xl p-5 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Ürün Arşive Kaldırılsın mı?</h3>
                <p className="text-xs text-slate-500 font-semibold">{archiveConfirmData.product.name}</p>
              </div>
            </div>
            <div className="text-xs text-slate-700 bg-amber-50 p-3 rounded-lg border border-amber-200 leading-relaxed">
              <p className="font-semibold text-amber-900 mb-1">{archiveConfirmData.error}</p>
              <p>Stoğunu 0 yaparak bu ürünü "Arşiv / Tükenenler" sekmesine kaldırmak istiyor musunuz?</p>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setArchiveConfirmData(null)}
                className="px-3.5 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200 border border-slate-200"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => {
                  const prod = archiveConfirmData.product
                  setArchiveConfirmData(null)
                  performProductDelete(prod, 'zero_stock')
                }}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-semibold shadow-sm"
              >
                Arşive Kaldır
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Fixed High-Z Toast Banner (always visible on top of all modals) */}
      {scanToast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between border transition-all animate-fadeIn ${
            scanToast.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20'
              : scanToast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500 shadow-rose-500/20'
              : 'bg-slate-800 text-white border-slate-700 shadow-slate-900/30'
          }`}
        >
          <div className="flex items-center space-x-2.5 overflow-hidden">
            {scanToast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />
            )}
            <span className="text-xs font-bold leading-snug">{scanToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setScanToast(null)}
            className="text-white/80 hover:text-white text-xs ml-3 shrink-0 font-bold p-1 hover:bg-white/10 rounded"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
