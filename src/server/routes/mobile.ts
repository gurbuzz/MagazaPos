import { Router } from 'express'
import { prisma } from '../db'

export const mobileRouter = Router()

function formatVariant(v: any) {
  let attrs = v.attributes
  if (typeof attrs === 'string') {
    try { attrs = JSON.parse(attrs) } catch (e) { attrs = {} }
  }
  return { ...v, attributes: attrs }
}

// GET /api/mobile/search?q=... - Quick stock search for mobile staff
mobileRouter.get('/search', async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim()

    if (!query) {
      // Return top 20 items if query is empty
      const variants = await prisma.productVariant.findMany({
        take: 20,
        include: {
          product: {
            include: { category: true }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })
      res.json(variants.map(formatVariant))
      return
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        OR: [
          { barcode: { contains: query } },
          { sku: { contains: query } },
          { product: { name: { contains: query } } },
          { product: { code: { contains: query } } }
        ]
      },
      include: {
        product: {
          include: { category: true }
        }
      },
      take: 30
    })

    res.json(variants.map(formatVariant))
    return
  } catch (error: any) {
    res.status(500).json({ error: error.message })
    return
  }
})
