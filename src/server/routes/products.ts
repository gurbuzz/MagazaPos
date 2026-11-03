import { Router } from 'express'
import { prisma } from '../db'
import { logDebug } from '../utils/logger'
import { requireAdminPinAuth } from '../utils/security'

export const productRouter = Router()

function formatVariant(v: any) {
  let attrs = v.attributes
  if (typeof attrs === 'string') {
    try { attrs = JSON.parse(attrs) } catch (e) { attrs = {} }
  }
  return { ...v, attributes: attrs }
}

function parseDecimal(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = String(val).replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

function formatProduct(p: any) {
  return {
    ...p,
    variants: p.variants ? p.variants.map(formatVariant) : [],
  }
}

// GET /api/products - Get all products with variants
productRouter.get('/', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(products.map(formatProduct))
  } catch (error: any) {
    logDebug('API_ERROR', 'GET /api/products failed', error)
    res.status(500).json({ error: error.message })
  }
})

// GET /api/categories - Get all categories
productRouter.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    })
    res.json(categories)
  } catch (error: any) {
    logDebug('API_ERROR', 'GET /api/products/categories failed', error)
    res.status(500).json({ error: error.message })
  }
})

// POST /api/products/categories - Create category
productRouter.post('/categories', async (req, res) => {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Kategori adı gereklidir' })
      return
    }

    const upperName = name.trim().toLocaleUpperCase('tr-TR')

    // Case-insensitive duplicate check
    const existing = await prisma.category.findFirst({
      where: { name: upperName },
    })
    if (existing) {
      res.status(400).json({ error: 'Bu isimde bir kategori zaten mevcut' })
      return
    }

    const category = await prisma.category.create({
      data: { name: upperName },
      include: { _count: { select: { products: true } } },
    })
    res.status(201).json(category)
  } catch (error: any) {
    logDebug('API_ERROR', 'POST /api/products/categories failed', error)
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Bu isimde bir kategori zaten mevcut' })
      return
    }
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/products/categories/:id - Update category name
productRouter.put('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Kategori adı gereklidir' })
      return
    }

    const upperName = name.trim().toLocaleUpperCase('tr-TR')

    // Check if another category already has this name
    const existing = await prisma.category.findFirst({
      where: {
        name: upperName,
        id: { not: id },
      },
    })
    if (existing) {
      res.status(400).json({ error: 'Bu isimde başka bir kategori zaten mevcut' })
      return
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name: upperName },
      include: { _count: { select: { products: true } } },
    })
    res.json(category)
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Bu isimde başka bir kategori zaten mevcut' })
      return
    }
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/products/categories/:id - Delete category
productRouter.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Unlink products from category before deletion
    await prisma.product.updateMany({
      where: { categoryId: id },
      data: { categoryId: null },
    })

    await prisma.category.delete({
      where: { id },
    })

    res.json({ message: 'Kategori başarıyla silindi' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/variants/barcode/:barcode - Quick barcode lookup for POS scanner
productRouter.get('/variants/barcode/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params
    const rawBarcode = (barcode || '').trim()
    const cleanBarcode = rawBarcode.replace(/\*/g, '')

    let variant = await prisma.productVariant.findUnique({
      where: { barcode: rawBarcode },
      include: {
        product: {
          include: { category: true }
        }
      }
    })

    if (!variant && cleanBarcode && cleanBarcode !== rawBarcode) {
      variant = await prisma.productVariant.findUnique({
        where: { barcode: cleanBarcode },
        include: {
          product: {
            include: { category: true }
          }
        }
      })
    }

    if (!variant) {
      res.status(404).json({ error: 'Barkodlu ürün bulunamadı' })
      return
    }

    res.json(formatVariant(variant))
    return
  } catch (error: any) {
    res.status(500).json({ error: error.message })
    return
  }
})

// POST /api/products - Create new product with variants
productRouter.post('/', async (req, res) => {
  try {
    const { code, name, brand, basePrice, description, categoryId, variants } = req.body

    if (!code || !name) {
      res.status(400).json({ error: 'Ürün kodu ve ürün adı zorunludur' })
      return
    }

    const existingProduct = await prisma.product.findUnique({ where: { code } })
    if (existingProduct) {
      res.status(400).json({
        error: `Bu ürün kodu (${code}) zaten "${existingProduct.name}" ürününde kayıtlıdır! Mevcut ürüne varyant/beden eklemek için ürün detayındaki "+ Yeni Varyant Ekle" butonunu kullanabilirsiniz.`
      })
      return
    }

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          code,
          name,
          brand: brand ? String(brand).trim() : null,
          basePrice: parseFloat(basePrice) || 0,
          description,
          categoryId: categoryId || null,
          variants: {
            create: (variants || []).map((v: any) => {
              const attrs = typeof v.attributes === 'string' ? v.attributes : JSON.stringify(v.attributes || {})
              let parsedAttrs: any = {}
              try { parsedAttrs = JSON.parse(attrs) } catch (e) {}
              const clr = (parsedAttrs.color || 'Standart').toUpperCase()
              const sz = (parsedAttrs.size || 'Standart').toUpperCase()
              const safeSku = v.sku || `${code}-${clr}-${sz}-${Math.floor(1000 + Math.random() * 9000)}`

              return {
                sku: safeSku,
                barcode: v.barcode,
                attributes: attrs,
                costPrice: parseDecimal(v.costPrice || 0),
                salePrice: parseDecimal(v.salePrice || basePrice || 0),
                discountPrice: v.discountPrice ? parseDecimal(v.discountPrice) : null,
                stockQuantity: parseInt(v.stockQuantity || 0) || 0
              }
            })
          }
        },
        include: { variants: true }
      })

      for (const variant of p.variants) {
        if (variant.stockQuantity > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: variant.id,
              type: 'INBOUND',
              quantity: variant.stockQuantity,
              note: `Ürün ilk kayıt stok girişi (+${variant.stockQuantity} ad)`
            }
          })
        }
      }

      return p
    })

    res.status(201).json(formatProduct(product))
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Ürün kodu veya barkod numarası sistemde zaten kayıtlı!' })
      return
    }
    res.status(400).json({ error: error.message })
  }
})

// POST /api/products/:id/variants - Add a new variant to an existing product
productRouter.post('/:id/variants', async (req, res) => {
  try {
    const { id } = req.params
    const { color, size, barcode, salePrice, costPrice, discountPrice, stockQuantity } = req.body

    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) {
      res.status(404).json({ error: 'Ürün bulunamadı' })
      return
    }

    if (!barcode || !barcode.trim()) {
      res.status(400).json({ error: 'Barkod numarası zorunludur' })
      return
    }

    const trimmedBarcode = barcode.trim()
    const existingVariant = await prisma.productVariant.findUnique({
      where: { barcode: trimmedBarcode },
      include: { product: true }
    })

    if (existingVariant) {
      res.status(400).json({
        error: `Bu barkod (${trimmedBarcode}) zaten "${existingVariant.product?.name || 'Başka Ürün'}" (${existingVariant.sku}) üzerinde kayıtlıdır!`
      })
      return
    }

    const clr = (color || 'Standart').trim()
    const sz = (size || 'Standart').trim()
    const sku = `${product.code}-${clr.toUpperCase()}-${sz.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
    const sPrice = parseDecimal(salePrice) || parseDecimal(product.basePrice) || 0
    const cPrice = parseDecimal(costPrice) || (sPrice * 0.5)
    const dPrice = discountPrice !== undefined && discountPrice !== null && discountPrice !== '' && parseDecimal(discountPrice) > 0
      ? parseDecimal(discountPrice)
      : null
    const qty = parseInt(stockQuantity) || 0

    const newVariant = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.create({
        data: {
          productId: id,
          sku,
          barcode: trimmedBarcode,
          attributes: JSON.stringify({ color: clr, size: sz }),
          costPrice: cPrice,
          salePrice: sPrice,
          discountPrice: dPrice,
          stockQuantity: qty
        },
        include: {
          product: { include: { category: true } }
        }
      })

      if (qty > 0) {
        await tx.stockMovement.create({
          data: {
            variantId: v.id,
            type: 'INBOUND',
            quantity: qty,
            note: `Yeni varyant oluşturma stok girişi (+${qty} ad)`
          }
        })
      }

      return v
    })

    res.status(201).json(formatVariant(newVariant))
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Bu barkod veya SKU numarası zaten kayıtlıdır!' })
      return
    }
    res.status(400).json({ error: error.message })
  }
})

// POST /api/products/import - Bulk import products and variants (from Excel/CSV)
productRouter.post('/import', async (req, res) => {
  try {
    const { items } = req.body
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Yüklenecek veri bulunamadı.' })
      return
    }

    let createdProducts = 0
    let createdVariants = 0
    let updatedStockCount = 0
    const errors: string[] = []

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < items.length; i++) {
        const row = items[i]
        const rowIndex = i + 1

        const code = String(row.code || '').trim()
        const name = String(row.name || '').trim()
        const barcode = String(row.barcode || '').trim()
        const categoryName = String(row.category || '').trim().toLocaleUpperCase('tr-TR')
        const color = String(row.color || 'Standart').trim()
        const size = String(row.size || 'Standart').trim()
        const brand = row.brand !== undefined && row.brand !== null && String(row.brand).trim() !== ''
          ? String(row.brand).trim()
          : null
        const forceBrand = Boolean(row.forceBrand)
        const costPrice = parseDecimal(row.costPrice)
        const salePrice = parseDecimal(row.salePrice)
        const discountPrice = parseDecimal(row.discountPrice || row.indirimliFiyat || row.iskontoluFiyat)
        const quantity = parseInt(row.quantity) || 0

        const isGenericBrand = (currentBrand: string | null | undefined): boolean => {
          if (!currentBrand) return true
          const norm = currentBrand.trim().toLowerCase()
          return norm === '' || norm === 'marka' || norm === 'mağaza' || norm === 'magaza' || norm === 'bilinmiyor'
        }

        if (!name || !barcode) {
          errors.push(`Satır ${rowIndex}: Ürün adı ve barkod zorunludur.`)
          continue
        }

        // 1. Resolve Category
        let categoryId: string | null = null
        if (categoryName) {
          let category = await tx.category.findUnique({ where: { name: categoryName } })
          if (!category) {
            category = await tx.category.create({ data: { name: categoryName } })
          }
          categoryId = category.id
        }

        // 2. Check if variant already exists by barcode
        const existingVariant = await tx.productVariant.findUnique({
          where: { barcode },
          include: { product: true }
        })

        if (existingVariant) {
          if (brand && existingVariant.product && (forceBrand || isGenericBrand(existingVariant.product.brand))) {
            await tx.product.update({
              where: { id: existingVariant.product.id },
              data: { brand }
            })
          }

          const updateData: any = {}
          if (quantity > 0) {
            updateData.stockQuantity = { increment: quantity }
          }
          if (salePrice > 0) updateData.salePrice = salePrice
          if (costPrice > 0) updateData.costPrice = costPrice
          if (discountPrice > 0) updateData.discountPrice = discountPrice

          if (Object.keys(updateData).length > 0) {
            await tx.productVariant.update({
              where: { id: existingVariant.id },
              data: updateData
            })
          }

          if (quantity > 0) {
            await tx.stockMovement.create({
              data: {
                variantId: existingVariant.id,
                type: 'INBOUND',
                quantity,
                note: `Excel Toplu Stok Girişi (+${quantity} ad)`
              }
            })
            updatedStockCount++
          }
          continue
        }

        // 3. Resolve Product by code (or generate code if missing)
        const productCode = code || `PRD-${barcode.slice(-6)}`
        let product = await tx.product.findUnique({ where: { code: productCode } })

        if (!product) {
          product = await tx.product.create({
            data: {
              code: productCode,
              name,
              brand: brand || null,
              basePrice: salePrice > 0 ? salePrice : 100,
              categoryId: categoryId || null
            }
          })
          createdProducts++
        } else if (brand && (forceBrand || isGenericBrand(product.brand))) {
          await tx.product.update({
            where: { id: product.id },
            data: { brand }
          })
        }

        // 4. Create new variant
        const sku = `${productCode}-${color.toLocaleUpperCase('tr-TR')}-${size.toLocaleUpperCase('tr-TR')}-${Math.floor(1000 + Math.random() * 9000)}`
        const newVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            sku,
            barcode,
            attributes: JSON.stringify({ color, size }),
            costPrice,
            salePrice: salePrice > 0 ? salePrice : product.basePrice,
            discountPrice: discountPrice > 0 ? discountPrice : null,
            stockQuantity: quantity
          }
        })
        createdVariants++

        if (quantity > 0) {
          await tx.stockMovement.create({
            data: {
              variantId: newVariant.id,
              type: 'INBOUND',
              quantity,
              note: `Excel Toplu Yeni Ürün Girişi (+${quantity} ad)`
            }
          })
        }
      }
    })

    res.json({
      success: true,
      message: `${createdProducts} yeni ürün, ${createdVariants} yeni varyant oluşturuldu. ${updatedStockCount} ürünün stoğu artırıldı.`,
      stats: { createdProducts, createdVariants, updatedStockCount, errorCount: errors.length },
      errors
    })
  } catch (error: any) {
    res.status(500).json({ error: 'İçe aktarma hatası: ' + error.message })
  }
})

// PUT /api/variants/:id/stock - Update variant stock quantity atomically (Yönetici PIN Gerekli)
productRouter.put('/variants/:id/stock', requireAdminPinAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { quantity, note } = req.body
    const newQuantity = parseInt(quantity)
    if (isNaN(newQuantity) || newQuantity < 0) {
      res.status(400).json({ error: 'Geçersiz stok miktarı (0 veya daha büyük bir tam sayı girilmelidir)' })
      return
    }

    const updated = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id },
        data: {
          stockQuantity: newQuantity
        }
      })

      await tx.stockMovement.create({
        data: {
          variantId: id,
          type: 'ADJUSTMENT',
          quantity: newQuantity,
          note: note || 'Mobil/Manuel Stok Güncelleme'
        }
      })

      return variant
    })

    res.json(formatVariant(updated))
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// POST /api/variants/:id/add-stock - Incrementally add stock quantity (INBOUND Mal Kabul)
productRouter.post('/variants/:id/add-stock', async (req, res) => {
  try {
    const { id } = req.params
    const { addedQuantity, note } = req.body
    const qtyToAdd = parseInt(addedQuantity)

    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
      res.status(400).json({ error: 'Geçersiz stok miktarı' })
      return
    }

    const updated = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id },
        data: {
          stockQuantity: { increment: qtyToAdd }
        },
        include: {
          product: { include: { category: true } }
        }
      })

      await tx.stockMovement.create({
        data: {
          variantId: id,
          type: 'INBOUND',
          quantity: qtyToAdd,
          note: note || `Stok Girişi (+${qtyToAdd} Adet)`
        }
      })

      return variant
    })

    res.json(formatVariant(updated))
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/variants/:id/barcode - Update or assign barcode to a variant with uniqueness check
productRouter.put('/variants/:id/barcode', async (req, res) => {
  try {
    const { id } = req.params
    const { barcode } = req.body

    if (!barcode || !barcode.trim()) {
      res.status(400).json({ error: 'Barkod numarası boş olamaz' })
      return
    }

    const trimmedBarcode = barcode.trim()

    // Check if barcode is already used by another variant
    const existing = await prisma.productVariant.findUnique({
      where: { barcode: trimmedBarcode },
      include: { product: true }
    })

    if (existing && existing.id !== id) {
      res.status(400).json({
        error: `Bu barkod (${trimmedBarcode}) zaten "${existing.product?.name || 'Başka Bir Ürün'}" (${existing.sku}) üzerinde kayıtlıdır!`
      })
      return
    }

    const updated = await prisma.productVariant.update({
      where: { id },
      data: { barcode: trimmedBarcode },
      include: { product: { include: { category: true } } }
    })
    res.json(formatVariant(updated))
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Bu barkod numarası başka bir üründe kullanılmaktadır!' })
      return
    }
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/products/:id - Update main product details (Yönetici PIN Gerekli)
productRouter.put('/:id', requireAdminPinAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { name, code, brand, categoryId, basePrice } = req.body

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(brand !== undefined && { brand }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(basePrice !== undefined && { basePrice: parseFloat(basePrice) }),
      },
      include: {
        category: true,
        variants: true,
      },
    })

    res.json(formatProduct(updated))
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Bu ürün kodu başka bir üründe kullanılmaktadır!' })
      return
    }
    res.status(400).json({ error: error.message })
  }
})

// POST /api/products/variants/bulk-price-discount - Toplu Varyant Fiyatı ve İskonto Güncelleme (Yönetici PIN Gerekli)
const handleBulkPriceDiscount = async (req: any, res: any) => {
  try {
    const {
      variantIds,
      productId,
      colorFilter,
      sizeFilter,
      salePriceAction = 'keep',
      salePriceValue,
      discountAction = 'keep',
      discountValue,
      costPriceAction = 'keep',
      costPriceValue,
      rounding = 'none',
      updates,
      syncBasePrice = true
    } = req.body

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

    // 1. If explicit updates array is provided:
    if (Array.isArray(updates) && updates.length > 0) {
      const results = await prisma.$transaction(async (tx) => {
        const updatedList: any[] = []
        const affectedProductIds = new Set<string>()

        for (const u of updates) {
          if (!u.id) continue
          const data: any = {}
          if (u.salePrice !== undefined) data.salePrice = parseDecimal(u.salePrice)
          if (u.discountPrice !== undefined) {
            data.discountPrice = (u.discountPrice !== null && u.discountPrice !== '' && parseDecimal(u.discountPrice) > 0)
              ? parseDecimal(u.discountPrice)
              : null
          }
          if (u.costPrice !== undefined) data.costPrice = parseDecimal(u.costPrice)
          if (u.stockQuantity !== undefined) data.stockQuantity = Math.max(0, parseInt(u.stockQuantity) || 0)

          const updated = await tx.productVariant.update({
            where: { id: u.id },
            data,
            include: { product: true }
          })
          affectedProductIds.add(updated.productId)
          updatedList.push(updated)
        }

        if (syncBasePrice) {
          for (const prodId of affectedProductIds) {
            const minVar = await tx.productVariant.findFirst({
              where: { productId: prodId },
              orderBy: { salePrice: 'asc' }
            })
            if (minVar) {
              await tx.product.update({
                where: { id: prodId },
                data: { basePrice: minVar.salePrice }
              })
            }
          }
        }

        return updatedList
      })

      res.json({
        success: true,
        count: results.length,
        message: `${results.length} varyant başarıyla güncellendi.`,
        variants: results.map(formatVariant)
      })
      return
    }

    // 2. Rule-based bulk update:
    let targetVariants: any[] = []
    if (Array.isArray(variantIds) && variantIds.length > 0) {
      targetVariants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true }
      })
    } else if (productId) {
      targetVariants = await prisma.productVariant.findMany({
        where: { productId },
        include: { product: true }
      })
    } else {
      res.status(400).json({ error: 'Güncellenecek varyantlar (variantIds veya productId) belirtilmelidir.' })
      return
    }

    if (colorFilter && colorFilter !== 'ALL') {
      targetVariants = targetVariants.filter(v => {
        let attrs: any = {}
        try { attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : (v.attributes || {}) } catch (e) {}
        const clr = (attrs.color || attrs.Renk || attrs.renk || '').trim()
        return clr.toLowerCase() === colorFilter.trim().toLowerCase()
      })
    }

    if (sizeFilter && sizeFilter !== 'ALL') {
      targetVariants = targetVariants.filter(v => {
        let attrs: any = {}
        try { attrs = typeof v.attributes === 'string' ? JSON.parse(v.attributes) : (v.attributes || {}) } catch (e) {}
        const sz = (attrs.size || attrs.Beden || attrs.beden || '').trim()
        return sz.toLowerCase() === sizeFilter.trim().toLowerCase()
      })
    }

    if (targetVariants.length === 0) {
      res.status(400).json({ error: 'Kriterlere uygun varyant bulunamadı.' })
      return
    }

    const sVal = parseDecimal(salePriceValue)
    const dVal = parseDecimal(discountValue)
    const cVal = parseDecimal(costPriceValue)

    const updatedVariants = await prisma.$transaction(async (tx) => {
      const list: any[] = []
      const affectedProductIds = new Set<string>()

      for (const variant of targetVariants) {
        affectedProductIds.add(variant.productId)
        let newSalePrice = variant.salePrice

        // 1. Calculate new sale price
        if (salePriceAction === 'fixed') {
          newSalePrice = applyRounding(sVal)
        } else if (salePriceAction === 'increase_percent') {
          newSalePrice = applyRounding(variant.salePrice * (1 + sVal / 100))
        } else if (salePriceAction === 'decrease_percent') {
          newSalePrice = applyRounding(Math.max(0, variant.salePrice * (1 - sVal / 100)))
        } else if (salePriceAction === 'increase_amount') {
          newSalePrice = applyRounding(variant.salePrice + sVal)
        } else if (salePriceAction === 'decrease_amount') {
          newSalePrice = applyRounding(Math.max(0, variant.salePrice - sVal))
        }

        // 2. Calculate new discount price
        let newDiscountPrice: number | null = variant.discountPrice
        if (discountAction === 'remove') {
          newDiscountPrice = null
        } else if (discountAction === 'fixed') {
          if (dVal > 0) {
            newDiscountPrice = applyRounding(dVal)
          } else {
            newDiscountPrice = null
          }
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

        // If discount price is >= sale price or <= 0, discount is invalid -> set to null
        if (newDiscountPrice !== null && (newDiscountPrice >= newSalePrice || newDiscountPrice <= 0)) {
          newDiscountPrice = null
        }

        // 3. Calculate new cost price
        let newCostPrice = variant.costPrice
        if (costPriceAction === 'fixed') {
          newCostPrice = applyRounding(cVal)
        } else if (costPriceAction === 'percent_of_sale') {
          newCostPrice = applyRounding(newSalePrice * (cVal / 100))
        }

        const updated = await tx.productVariant.update({
          where: { id: variant.id },
          data: {
            salePrice: newSalePrice,
            discountPrice: newDiscountPrice,
            costPrice: newCostPrice,
          },
          include: { product: true }
        })
        list.push(updated)
      }

      // Sync parent product basePrice if requested
      if (syncBasePrice) {
        for (const prodId of affectedProductIds) {
          const minVar = await tx.productVariant.findFirst({
            where: { productId: prodId },
            orderBy: { salePrice: 'asc' }
          })
          if (minVar) {
            await tx.product.update({
              where: { id: prodId },
              data: { basePrice: minVar.salePrice }
            })
          }
        }
      }

      return list
    })

    res.json({
      success: true,
      count: updatedVariants.length,
      message: `${updatedVariants.length} varyantın fiyat ve iskontosu başarıyla güncellendi.`,
      variants: updatedVariants.map(formatVariant)
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Toplu fiyat güncelleme hatası: ' + error.message })
  }
}

productRouter.post('/variants/bulk-price-discount', requireAdminPinAuth, handleBulkPriceDiscount)
productRouter.put('/variants/bulk-price-discount', requireAdminPinAuth, handleBulkPriceDiscount)

// DELETE /api/products/variants/:id - Delete single variant (Yönetici PIN Gerekli)
productRouter.delete('/variants/:id', requireAdminPinAuth, async (req, res) => {
  try {
    const { id } = req.params

    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
        _count: { select: { saleItems: true } }
      }
    })

    if (!variant) {
      res.status(404).json({ error: 'Varyant bulunamadı' })
      return
    }

    if (variant._count.saleItems > 0) {
      res.status(400).json({
        canDelete: false,
        hasSales: true,
        salesCount: variant._count.saleItems,
        error: `Bu varyant (${variant.sku}) için ${variant._count.saleItems} adet geçmiş satış fişi bulunmaktadır! Mali verileri ve geçmiş fişleri korumak adına silinemez. Stoğunu 0 yapabilir veya indirimini düzenleyebilirsiniz.`
      })
      return
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.deleteMany({
        where: { variantId: id }
      })
      await tx.productVariant.delete({
        where: { id }
      })
    })

    res.json({
      success: true,
      message: `"${variant.sku}" kodlu varyant başarıyla silindi.`
    })
  } catch (error: any) {
    res.status(500).json({ error: 'Varyant silinirken hata oluştu: ' + error.message })
  }
})

// PUT /api/variants/:id - Update full variant details: price, barcode, color, size, stock (Yönetici PIN Gerekli)
productRouter.put('/variants/:id', requireAdminPinAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { salePrice, costPrice, discountPrice, barcode, color, size, stockQuantity, note } = req.body

    if (barcode && barcode.trim()) {
      const trimmedBarcode = barcode.trim()
      const existing = await prisma.productVariant.findUnique({
        where: { barcode: trimmedBarcode },
        include: { product: true },
      })
      if (existing && existing.id !== id) {
        res.status(400).json({
          error: `Bu barkod (${trimmedBarcode}) zaten "${existing.product?.name || 'Başka Ürün'}" (${existing.sku}) üzerinde kayıtlı!`,
        })
        return
      }
    }

    const currentVariant = await prisma.productVariant.findUnique({ where: { id } })
    if (!currentVariant) {
      res.status(404).json({ error: 'Varyant bulunamadı' })
      return
    }

    let existingAttrs: any = {}
    if (typeof currentVariant.attributes === 'string') {
      try { existingAttrs = JSON.parse(currentVariant.attributes) } catch (e) {}
    } else if (currentVariant.attributes) {
      existingAttrs = currentVariant.attributes
    }

    const newColor = color !== undefined ? color : (existingAttrs.color || '')
    const newSize = size !== undefined ? size : (existingAttrs.size || '')
    const newAttrs = { ...existingAttrs, color: newColor, size: newSize }

    const newStock = stockQuantity !== undefined ? parseInt(stockQuantity) : currentVariant.stockQuantity

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.productVariant.update({
        where: { id },
        data: {
          ...(salePrice !== undefined && { salePrice: parseDecimal(salePrice) }),
          ...(costPrice !== undefined && { costPrice: parseDecimal(costPrice) }),
          ...(discountPrice !== undefined && {
            discountPrice: (discountPrice !== null && discountPrice !== '' && parseDecimal(discountPrice) > 0)
              ? parseDecimal(discountPrice)
              : null
          }),
          ...(barcode !== undefined && { barcode: barcode.trim() }),
          attributes: JSON.stringify(newAttrs),
          ...(stockQuantity !== undefined && { stockQuantity: isNaN(newStock) ? 0 : Math.max(0, newStock) }),
        },
        include: {
          product: { include: { category: true } },
        },
      })

      if (stockQuantity !== undefined && newStock !== currentVariant.stockQuantity) {
        await tx.stockMovement.create({
          data: {
            variantId: id,
            type: 'ADJUSTMENT',
            quantity: newStock,
            note: note || `Stok ve Varyant Düzeltme (${currentVariant.stockQuantity} -> ${newStock})`,
          },
        })
      }

      return v
    })

    res.json(formatVariant(updated))
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// DELETE /api/products/:id - Satış Geçmişi Kontrollü Ürün Silme / Arşive Kaldırma (Yönetici PIN Gerekli)
productRouter.delete('/:id', requireAdminPinAuth, async (req, res) => {
  try {
    const { id } = req.params
    const action = req.query.action as string | undefined

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            saleItems: true,
          },
        },
      },
    })

    if (!product) {
      res.status(404).json({ error: 'Ürün bulunamadı!' })
      return
    }

    // Toplam satış kalemi sayısı
    const totalSalesCount = product.variants.reduce((acc, v) => acc + (v.saleItems?.length || 0), 0)

    // Kullanıcı geçmiş satışları olan ürünü stoğunu sıfırlayarak arşive kaldırmak istediyse:
    if (action === 'zero_stock') {
      await prisma.$transaction(async (tx) => {
        for (const v of product.variants) {
          if (v.stockQuantity > 0) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: { stockQuantity: 0 },
            })
            await tx.stockMovement.create({
              data: {
                variantId: v.id,
                type: 'ADJUSTMENT',
                quantity: 0,
                note: 'Ürün Arşivlendi (Stok Sıfırlandı)',
              },
            })
          }
        }
      })

      res.json({
        success: true,
        archived: true,
        message: `"${product.name}" ürünü geçmiş satış kayıtları korumak adına stoğu 0 yapılarak "Arşiv / Tükenenler" listesine kaldırıldı.`,
      })
      return
    }

    // Eğer geçmişte satışı varsa doğrudan silmeyi engelle
    if (totalSalesCount > 0) {
      res.status(400).json({
        canDelete: false,
        hasSales: true,
        totalSalesCount,
        error: `Bu ürüne ait ${totalSalesCount} adet geçmiş satış fişi bulunmaktadır! Mali geçmişi ve fişleri korumak adına tamamen silinemez. Stoğunu sıfırlayarak Arşiv'e kaldırabilirsiniz.`,
      })
      return
    }

    // Hiç satışı yoksa (test veya hatalı açılmış): Tamamen ve kalıcı olarak sil
    await prisma.$transaction(async (tx) => {
      for (const v of product.variants) {
        await tx.stockMovement.deleteMany({
          where: { variantId: v.id },
        })
      }
      await tx.product.delete({
        where: { id },
      })
    })

    res.json({
      success: true,
      deleted: true,
      message: `"${product.name}" ürünü hiç satış görmediği için veritabanından tamamen silindi ve barkodu boşa çıkarıldı.`,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Ürün silinirken bir hata oluştu!' })
  }
})


