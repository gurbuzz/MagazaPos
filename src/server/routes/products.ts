import { Router } from 'express'
import { prisma } from '../db'
import { requireAdminPinAuth } from '../utils/security'

export const productRouter = Router()

function formatVariant(v: any) {
  let attrs = v.attributes
  if (typeof attrs === 'string') {
    try { attrs = JSON.parse(attrs) } catch (e) { attrs = {} }
  }
  return { ...v, attributes: attrs }
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

    const category = await prisma.category.create({
      data: { name: name.trim() },
      include: { _count: { select: { products: true } } },
    })
    res.status(201).json(category)
  } catch (error: any) {
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

    const category = await prisma.category.update({
      where: { id },
      data: { name: name.trim() },
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
    const variant = await prisma.productVariant.findUnique({
      where: { barcode },
      include: {
        product: {
          include: { category: true }
        }
      }
    })

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

    const product = await prisma.product.create({
      data: {
        code,
        name,
        brand,
        basePrice: parseFloat(basePrice),
        description,
        categoryId: categoryId || null,
        variants: {
          create: variants.map((v: any) => ({
            sku: v.sku,
            barcode: v.barcode,
            attributes: typeof v.attributes === 'string' ? v.attributes : JSON.stringify(v.attributes || {}),
            costPrice: parseFloat(v.costPrice || 0),
            salePrice: parseFloat(v.salePrice || basePrice),
            stockQuantity: parseInt(v.stockQuantity || 0)
          }))
        }
      },
      include: { variants: true }
    })

    res.status(201).json(formatProduct(product))
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
})

// PUT /api/variants/:id/stock - Update variant stock quantity atomically (Yönetici PIN Gerekli)
productRouter.put('/variants/:id/stock', requireAdminPinAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { quantity, note } = req.body
    const newQuantity = parseInt(quantity)

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

// PUT /api/variants/:id - Update full variant details: price, barcode, color, size, stock (Yönetici PIN Gerekli)
productRouter.put('/variants/:id', requireAdminPinAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { salePrice, costPrice, barcode, color, size, stockQuantity, note } = req.body

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
          ...(salePrice !== undefined && { salePrice: parseFloat(salePrice) }),
          ...(costPrice !== undefined && { costPrice: parseFloat(costPrice) }),
          ...(barcode !== undefined && { barcode: barcode.trim() }),
          attributes: JSON.stringify(newAttrs),
          ...(stockQuantity !== undefined && { stockQuantity: newStock }),
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

