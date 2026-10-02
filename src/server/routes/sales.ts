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

// GET /api/sales - Sales history with optional date-time range filters and search
salesRouter.get('/', async (req, res) => {
  try {
    const { startDate, endDate, limit, search } = req.query
    const where: any = {}

    if (startDate || endDate) {
      const createdAtFilter: any = {}
      if (startDate) {
        const sDate = new Date(startDate as string)
        if (!isNaN(sDate.getTime())) createdAtFilter.gte = sDate
      }
      if (endDate) {
        const eDate = new Date(endDate as string)
        if (!isNaN(eDate.getTime())) createdAtFilter.lte = eDate
      }
      if (Object.keys(createdAtFilter).length > 0) {
        where.createdAt = createdAtFilter
      }
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const query = search.trim()
      where.OR = [
        { receiptNo: { contains: query } },
        { cashierName: { contains: query } },
        {
          customer: {
            OR: [
              { firstName: { contains: query } },
              { lastName: { contains: query } },
              { phone: { contains: query } },
            ]
          }
        },
        {
          items: {
            some: {
              variant: {
                OR: [
                  { barcode: { contains: query } },
                  { sku: { contains: query } },
                  { product: { name: { contains: query } } }
                ]
              }
            }
          }
        }
      ]
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string) : 200
    })
    res.json(sales.map(formatSale))
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/sales - Create & Checkout POS Sale
salesRouter.post('/', async (req, res) => {
  try {
    const { items, totalAmount, discountAmount, paymentType, cashierName, customerId, receiptPrefix } = req.body

    if (!items || items.length === 0) {
      res.status(400).json({ error: 'Sepette ürün bulunmamaktadır.' })
      return
    }

    const prefix = typeof receiptPrefix === 'string' && receiptPrefix.trim() ? receiptPrefix.trim().replace(/[-_]+$/, '') : 'FIS'
    const receiptNo = `${prefix}-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`

    // Transaction to create sale, items, update stock and log movements atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Sale record
      const parsedTotal = parseFloat(totalAmount) || 0
      const parsedDiscount = parseFloat(discountAmount || 0) || 0
      const sale = await tx.sale.create({
        data: {
          receiptNo,
          customerId: customerId || null,
          totalAmount: parsedTotal,
          discountAmount: parsedDiscount,
          paymentType: typeof paymentType === 'string' ? paymentType : JSON.stringify(paymentType || { cash: parsedTotal }),
          cashierName: cashierName || 'Kasiyer 1',
          items: {
            create: items.map((item: any) => ({
              variantId: item.variantId,
              quantity: parseInt(item.quantity) || 1,
              unitPrice: parseFloat(item.unitPrice) || 0,
              totalPrice: parseFloat(item.totalPrice) || 0
            }))
          }
        },
        include: {
          customer: true,
          items: {
            include: {
              variant: {
                include: { product: true }
              }
            }
          }
        }
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

// POST /api/sales/:id/return - Return items from a sale (Registered & Anonymous)
salesRouter.post('/:id/return', async (req, res) => {
  try {
    const { id } = req.params
    const { items, reason, customerName, phone } = req.body // items: Array<{ saleItemId: string, returnQuantity: number }>

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'İade edilecek ürün seçilmedi.' })
      return
    }

    const sale: any = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            variant: { include: { product: true } }
          }
        }
      }
    })

    if (!sale) {
      res.status(404).json({ error: 'Satış kaydı bulunamadı.' })
      return
    }

    // Validate return items
    for (const returnItem of items) {
      const existingItem = sale.items?.find((i: any) => i.id === returnItem.saleItemId)
      if (!existingItem) {
        res.status(400).json({ error: `Fişte ${returnItem.saleItemId} ID'li ürün bulunamadı.` })
        return
      }
      const qtyToReturn = parseInt(returnItem.returnQuantity)
      if (isNaN(qtyToReturn) || qtyToReturn <= 0) {
        res.status(400).json({ error: 'İade miktarı pozitif bir sayı olmalıdır.' })
        return
      }
      const availableToReturn = existingItem.quantity - (existingItem.returnedQuantity || 0)
      if (qtyToReturn > availableToReturn) {
        res.status(400).json({
          error: `"${existingItem.variant?.product?.name || 'Ürün'}" için iade edilebilir maksimum adet ${availableToReturn} adettir.`
        })
        return
      }
    }

    // Process return in atomic transaction
    const updatedSale = await prisma.$transaction(async (tx) => {
      const effectiveCustomerName = sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName}`
        : customerName && customerName.trim()
        ? `${customerName.trim()}${phone ? ` (${phone.trim()})` : ''}`
        : 'Anonim Müşteri'

      for (const returnItem of items) {
        const qtyToReturn = parseInt(returnItem.returnQuantity)
        const existingItem = sale.items?.find((i: any) => i.id === returnItem.saleItemId)!

        // 1. Increment returnedQuantity on SaleItem
        await (tx.saleItem as any).update({
          where: { id: returnItem.saleItemId },
          data: {
            returnedQuantity: {
              increment: qtyToReturn
            }
          }
        })

        // 2. Increment stockQuantity on ProductVariant (Stock re-entry!)
        await tx.productVariant.update({
          where: { id: existingItem.variantId },
          data: {
            stockQuantity: {
              increment: qtyToReturn
            }
          }
        })

        // 3. Log stock movement
        await tx.stockMovement.create({
          data: {
            variantId: existingItem.variantId,
            type: 'RETURN',
            quantity: qtyToReturn,
            note: `İade Fişi: ${sale.receiptNo} (${qtyToReturn} ad) - ${effectiveCustomerName}${reason ? ` - Nedeni: ${reason}` : ''}`
          }
        })
      }

      // Check if all items in sale are fully returned
      const freshSaleItems: any[] = await tx.saleItem.findMany({ where: { saleId: id } })
      const allFullyReturned = freshSaleItems.every((item: any) => (item.returnedQuantity || 0) >= item.quantity)
      const newStatus = allFullyReturned ? 'RETURNED' : 'PARTIAL_RETURN'

      const finalSale = await (tx.sale as any).update({
        where: { id },
        data: { status: newStatus },
        include: {
          customer: true,
          items: {
            include: {
              variant: { include: { product: true } }
            }
          }
        }
      })

      return finalSale
    })

    res.json(formatSale(updatedSale))
    return
  } catch (error: any) {
    res.status(500).json({ error: error.message })
    return
  }
})

