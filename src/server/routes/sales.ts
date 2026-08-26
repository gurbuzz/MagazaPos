import { Router } from 'express'
import { prisma } from '../db'

export const salesRouter = Router()

function formatSale(s: any) {
  let pay = s.paymentType
  if (typeof pay === 'string') {
    try { pay = JSON.parse(pay) } catch (e) { pay = {} }
  }
  const items = s.items?.map((item: any) => {
    let attrs = item.variant?.attributes
    if (typeof attrs === 'string') {
      try { attrs = JSON.parse(attrs) } catch (e) { attrs = {} }
    }
    return {
      ...item,
      variant: item.variant ? { ...item.variant, attributes: attrs } : undefined,
    }
  })
  return { ...s, paymentType: pay, items }
}

// GET /api/sales - Sales history
salesRouter.get('/', async (req, res) => {
  try {
    const sales = await prisma.sale.findMany({
      include: {
        items: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    res.json(sales.map(formatSale))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/sales - Create & Checkout POS Sale
salesRouter.post('/', async (req, res) => {
  try {
    const { items, totalAmount, discountAmount, paymentType, cashierName } = req.body

    if (!items || items.length === 0) {
      res.status(400).json({ error: 'Sepette ürün bulunmamaktadır.' })
      return
    }

    const receiptNo = `FIS-${Date.now().toString().slice(-8)}`

    // Transaction to create sale, items, update stock and log movements atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Sale record
      const sale = await tx.sale.create({
        data: {
          receiptNo,
          totalAmount: parseFloat(totalAmount),
          discountAmount: parseFloat(discountAmount || 0),
          paymentType: typeof paymentType === 'string' ? paymentType : JSON.stringify(paymentType || { cash: totalAmount }),
          cashierName: cashierName || 'Kasiyer 1',
          items: {
            create: items.map((item: any) => ({
              variantId: item.variantId,
              quantity: parseInt(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              totalPrice: parseFloat(item.totalPrice)
            }))
          }
        },
        include: { items: true }
      })

      // 2. Update stock quantities & record movements
      for (const item of items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: {
              decrement: parseInt(item.quantity)
            }
          }
        })

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'SALE',
            quantity: -parseInt(item.quantity),
            note: `Satış Fişi: ${receiptNo}`
          }
        })
      }

      return sale
    })

    res.status(201).json(formatSale(result))
    return
  } catch (error: any) {
    res.status(500).json({ error: error.message })
    return
  }
})
