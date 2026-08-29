import { Router } from 'express'
import { prisma } from '../db'

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
      include: { _count: { select: { products: true } } }
    })
    res.json(categories)
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

// PUT /api/variants/:id/stock - Update variant stock quantity atomically
productRouter.put('/variants/:id/stock', async (req, res) => {
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
