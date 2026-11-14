import { Router } from 'express'
import { prisma } from '../db'
import { GiftVoucherError, moneyCents, redeemVoucher, refundVoucher } from '../services/giftVouchers'

export const salesRouter = Router()

function parseDecimal(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = String(val).replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

export function formatSale(s: any) {
  let pay = s.paymentType
  if (typeof pay === 'string') {
    try {
      pay = JSON.parse(pay)
    } catch (e) {
      if (pay === 'CASH') pay = { cash: s.totalAmount || 0, card: 0 }
      else if (pay === 'CARD') pay = { cash: 0, card: s.totalAmount || 0 }
      else pay = { note: pay }
    }
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

  // Calculate item-based refund
  const itemsSubtotal = (items || []).reduce(
    (sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0
  )
  const totalAmountNum = Number(s.totalAmount) || 0
  const discountFactor = itemsSubtotal > 0 ? Math.min(1, totalAmountNum / itemsSubtotal) : 1

  let calculatedRefund = (items || []).reduce((sum: number, it: any) => {
    const retQty = Math.max(0, (Number(it.returnedQuantity) || 0) - (Number(pay?.exchangedItems?.[it.id]) || 0))
    return sum + retQty * (Number(it.unitPrice) || 0) * discountFactor
  }, 0)
  calculatedRefund = Math.round(calculatedRefund * 100) / 100

  const isFullyReturned = s.status === 'RETURNED' && !Object.keys(pay?.exchangedItems || {}).length

  const refundAmount = isFullyReturned ? totalAmountNum : Math.min(totalAmountNum, calculatedRefund)
  const netAmount = isFullyReturned ? 0 : Math.max(0, Math.round((totalAmountNum - refundAmount) * 100) / 100)

  // Payment breakdown & refund deductions
  const origCash = Number(pay?.cash) || 0
  const origCard = Number(pay?.card) || 0

  let refundCash = Number(pay?.refundCash) || 0
  let refundCard = Number(pay?.refundCard) || 0

  // If refund occurred but refundCash/refundCard was not explicitly logged, derive from original payment method:
  if (refundAmount > 0 && refundCash === 0 && refundCard === 0 && !pay?.giftVoucher) {
    if (origCash > 0 && origCard === 0) {
      refundCash = refundAmount
    } else if (origCard > 0 && origCash === 0) {
      refundCard = refundAmount
    } else if (origCash + origCard > 0) {
      const cashRatio = origCash / (origCash + origCard)
      refundCash = Math.round(refundAmount * cashRatio * 100) / 100
      refundCard = Math.round((refundAmount - refundCash) * 100) / 100
    }
  }

  const netCash = Math.max(0, Math.round((origCash - refundCash) * 100) / 100)
  const netCard = Math.max(0, Math.round((origCard - refundCard) * 100) / 100)

  const updatedPaymentType = {
    ...pay,
    cash: origCash,
    card: origCard,
    refundCash,
    refundCard,
    refundTotal: refundAmount,
    netCash,
    netCard,
    netGiftVoucher: Math.max(0, (Number(pay?.giftVoucher?.amount) || 0) - (Number(pay?.refundGiftVoucher) || 0))
  }

  return {
    ...s,
    paymentType: updatedPaymentType,
    items,
    refundAmount,
    netAmount
  }
}


function buildSalesWhere(query: any): any {
  const { startDate, endDate, search } = query
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
    const rawQuery = search.trim()
    const cleanQuery = rawQuery.replace(/^\*+|\*+$/g, '').replace(/\*+/g, '-').trim()
    const strippedQuery = cleanQuery.replace(/[-_]/g, '').trim()
    const pureNoStars = rawQuery.replace(/\*/g, '').trim()
    const numericOnly = rawQuery.replace(/\D/g, '').trim()

    const receiptQueries = Array.from(
      new Set(
        [
          rawQuery,
          cleanQuery,
          strippedQuery,
          pureNoStars,
          numericOnly.length >= 4 ? numericOnly : null,
        ].filter(Boolean) as string[]
      )
    )

    const textFilter = pureNoStars || cleanQuery

    const hasSpecificReceiptQuery =
      receiptQueries.some(
        (q) => q.toUpperCase().includes('REC') || (numericOnly.length >= 6 && q === numericOnly)
      )

    // Direct receipt lookup should not be blocked by date filter if the user scanned a specific receipt
    if (hasSpecificReceiptQuery && where.createdAt) {
      delete where.createdAt
    }

    where.OR = [
      ...receiptQueries.map((q) => ({ receiptNo: { contains: q } })),
      { cashierName: { contains: textFilter } },
      {
        customer: {
          OR: [
            { firstName: { contains: textFilter } },
            { lastName: { contains: textFilter } },
            { phone: { contains: textFilter } },
          ]
        }
      },
      {
        items: {
          some: {
            variant: {
              OR: [
                { barcode: { contains: textFilter } },
                { sku: { contains: textFilter } },
                { product: { name: { contains: textFilter } } }
              ]
            }
          }
        }
      }
    ]
  }

  return where
}

// GET /api/sales/stats - Aggregated turnover metrics for selected date range
salesRouter.get('/stats', async (req, res) => {
  try {
    const where = buildSalesWhere(req.query)

    const sales = await prisma.sale.findMany({
      where,
      select: {
        id: true,
        totalAmount: true,
        paymentType: true,
        status: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            returnedQuantity: true,
          }
        }
      }
    })

    let totalGross = 0
    let totalRefund = 0
    let totalNet = 0
    let netCash = 0
    let netCard = 0
    let netGiftVoucher = 0
    let refundedCount = 0
    let activeSalesCount = 0
    let grossItemsSold = 0
    let returnedItemsCount = 0

    for (const s of sales) {
      const formatted = formatSale(s)
      totalGross += Number(formatted.totalAmount) || 0
      totalRefund += Number(formatted.refundAmount) || 0
      totalNet += Number(formatted.netAmount) || 0
      netCash += Number(formatted.paymentType?.netCash) || 0
      netCard += Number(formatted.paymentType?.netCard) || 0
      netGiftVoucher += Number(formatted.paymentType?.netGiftVoucher) || 0

      const isFullyReturned = formatted.status === 'RETURNED'
      for (const it of (formatted.items || [])) {
        const qty = Number(it.quantity) || 0
        const retQty = isFullyReturned ? qty : (Number(it.returnedQuantity) || 0)
        grossItemsSold += qty
        returnedItemsCount += retQty
      }

      if (formatted.status === 'RETURNED' || (formatted.refundAmount && formatted.refundAmount > 0)) {
        refundedCount++
      }
      if (formatted.status !== 'RETURNED') {
        activeSalesCount++
      }
    }

    const netItemsSold = Math.max(0, grossItemsSold - returnedItemsCount)

    res.json({
      totalCount: sales.length,
      activeSalesCount,
      refundedCount,
      grossRevenue: Math.round(totalGross * 100) / 100,
      totalRefund: Math.round(totalRefund * 100) / 100,
      netRevenue: Math.round(totalNet * 100) / 100,
      netCash: Math.round(netCash * 100) / 100,
      netCard: Math.round(netCard * 100) / 100,
      netGiftVoucher: Math.round(netGiftVoucher * 100) / 100,
      avgReceiptAmount: activeSalesCount > 0 ? Math.round((totalNet / activeSalesCount) * 100) / 100 : 0,
      grossItemsSold,
      returnedItemsCount,
      netItemsSold,
    })
  } catch (error: any) {
    res.status(error instanceof GiftVoucherError ? 400 : 500).json({ error: error.message })
  }
})

// GET /api/sales - Sales history with optional date-time range filters and search (default limit: 20)
salesRouter.get('/', async (req, res) => {
  try {
    const where = buildSalesWhere(req.query)
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20

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
      take: limit > 0 ? limit : 20
    })
    res.json(sales.map(formatSale))
  } catch (error: any) {
    res.status(error instanceof GiftVoucherError ? 400 : 500).json({ error: error.message })
  }
})

// POST /api/sales - Create & Checkout POS Sale
salesRouter.post('/', async (req, res) => {
  try {
    let { items, totalAmount, discountAmount, paymentType, cashierName, customerId, receiptPrefix, exchange } = req.body
    if (typeof paymentType === 'string' && paymentType.trim().startsWith('{')) paymentType = JSON.parse(paymentType)

    if (!items || items.length === 0) {
      res.status(400).json({ error: 'Sepette ürün bulunmamaktadır.' })
      return
    }

    const prefix = typeof receiptPrefix === 'string' && receiptPrefix.trim() ? receiptPrefix.trim().replace(/[-_]+$/, '') : 'FIS'

    // Generate collision-resistant unique receipt number (e.g. FIS-261024-081520-4821)
    let receiptNo = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date()
      const datePart = `${now.getFullYear().toString().slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
      const rand = Math.floor(1000 + Math.random() * 9000)
      const candidate = `${prefix}-${datePart}-${timePart}-${rand}`
      const existing = await prisma.sale.findUnique({ where: { receiptNo: candidate } })
      if (!existing) {
        receiptNo = candidate
        break
      }
    }
    if (!receiptNo) {
      receiptNo = `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
    }

    // Transaction to create sale, items, update stock and log movements atomically
    const result = await prisma.$transaction(async (tx) => {
      const requestVoucher = typeof paymentType === 'object' ? paymentType?.giftVoucher : null
      if (requestVoucher) {
        if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestVoucher.requestId || '')) throw new GiftVoucherError('Çek ödeme işlem kimliği geçersiz.')
        const previous = await tx.$queryRaw<{ saleId: string }[]>`SELECT saleId FROM "GiftVoucherMovement" WHERE id = ${`checkout-${requestVoucher.requestId}`}`
        if (previous[0]) {
          const existing = await tx.sale.findUnique({ where: { id: previous[0].saleId }, include: { customer: true, items: { include: { variant: { include: { product: true } } } } } })
          if (!existing) throw new GiftVoucherError('Bu çek işlemi daha önce işlendi; satış geçmişini kontrol edin.')
          const pay = JSON.parse(existing.paymentType)
          if (pay.giftVoucher?.code !== requestVoucher.code || moneyCents(pay.giftVoucher.amount) !== moneyCents(requestVoucher.amount) || moneyCents(existing.totalAmount) !== moneyCents(totalAmount)) throw new GiftVoucherError('İşlem daha önce farklı tutarla tamamlandı. Satış geçmişini kontrol edin.')
          const signature = (lines: any[]) => JSON.stringify(lines.map(item => ({ variantId: item.variantId, quantity: Number(item.quantity), unitPrice: moneyCents(item.unitPrice), totalPrice: moneyCents(item.totalPrice) })).sort((a, b) => a.variantId.localeCompare(b.variantId)))
          if (signature(existing.items) !== signature(items) || moneyCents(pay.cash || 0) !== moneyCents(paymentType.cash || 0) || moneyCents(pay.card || 0) !== moneyCents(paymentType.card || 0)) throw new GiftVoucherError('Bu işlem önceki sepetle tamamlandı. Önce satış geçmişini kontrol edin.')
          return existing
        }
      }
      if (exchange) {
        const original = await tx.sale.findUnique({ where: { id: exchange.saleId }, include: { items: true } })
        const oldItem = original?.items.find(item => item.id === exchange.itemId)
        if (!original || !oldItem || original.status === 'CANCELLED' || oldItem.returnedQuantity >= oldItem.quantity) {
          throw new Error('Değiştirilecek ürün artık kullanılabilir değil.')
        }
        let originalPay: any = {}
        try { originalPay = JSON.parse(original.paymentType) } catch {
          originalPay = original.paymentType === 'CARD' ? { cash: 0, card: original.totalAmount } : { cash: original.totalAmount, card: 0 }
        }
        const subtotal = original.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        const paidValue = original.totalAmount + (Number(originalPay?.exchange?.credit) || 0)
        const credit = Math.round(oldItem.unitPrice * (subtotal > 0 ? Math.min(1, paidValue / subtotal) : 1) * 100) / 100
        if (Math.round(Number(exchange.credit) * 100) !== Math.round(credit * 100) || parseDecimal(discountAmount) < credit) {
          throw new Error('Değişim bedeli değişti; fişi yeniden seçin.')
        }
        const newSubtotal = items.reduce((sum: number, item: any) => sum + parseDecimal(item.totalPrice), 0)
        if (newSubtotal < parseDecimal(discountAmount) || Math.round((newSubtotal - parseDecimal(discountAmount)) * 100) > Math.round(parseDecimal(totalAmount) * 100)) {
          throw new Error('Değişim tutarı veya tahsilat geçersiz.')
        }
        originalPay.exchangedItems = originalPay.exchangedItems || {}
        originalPay.exchangedItems[oldItem.id] = (Number(originalPay.exchangedItems[oldItem.id]) || 0) + 1
        await tx.saleItem.update({ where: { id: oldItem.id }, data: { returnedQuantity: { increment: 1 } } })
        await tx.productVariant.update({ where: { id: oldItem.variantId }, data: { stockQuantity: { increment: 1 } } })
        await tx.stockMovement.create({ data: { variantId: oldItem.variantId, type: 'EXCHANGE', quantity: 1, note: `Değişim: ${original.receiptNo} → ${receiptNo}` } })
        const allHandled = original.items.every(item => item.returnedQuantity + (item.id === oldItem.id ? 1 : 0) >= item.quantity)
        await tx.sale.update({ where: { id: original.id }, data: { status: allHandled ? 'EXCHANGED' : 'PARTIAL_EXCHANGE', paymentType: JSON.stringify(originalPay) } })
        if (typeof paymentType === 'object' && paymentType) {
          paymentType.exchange = { receiptNo: original.receiptNo, saleId: original.id, itemId: oldItem.id, credit }
        }
      }
      // Voucher amounts and balance changes are verified in the sale transaction.
      let safePayment: any = typeof paymentType === 'string' ? paymentType : { ...(paymentType || { cash: parseDecimal(totalAmount) }) }
      const voucherPayment = typeof safePayment === 'object' ? safePayment.giftVoucher : null
      if (voucherPayment) {
        const voucherCents = moneyCents(voucherPayment.amount)
        const cashCents = moneyCents(safePayment.cash || 0)
        const cardCents = moneyCents(safePayment.card || 0)
        if (!voucherCents || cashCents + cardCents + voucherCents !== moneyCents(totalAmount)) throw new GiftVoucherError('Çek, nakit ve kart toplamı satış tutarına eşit olmalıdır.')
        if (!voucherPayment.code || typeof voucherPayment.code !== 'string') throw new GiftVoucherError('Çek kodu geçersiz.')
        safePayment = { cash: cashCents / 100, card: cardCents / 100, ...(safePayment.exchange ? { exchange: safePayment.exchange } : {}), giftVoucher: { code: voucherPayment.code, amount: voucherCents / 100 } }
      }
      // 1. Create Sale record
      const parsedTotal = parseDecimal(totalAmount)
      const parsedDiscount = parseDecimal(discountAmount)
      const sale = await tx.sale.create({
        data: {
          receiptNo,
          customerId: customerId || null,
          totalAmount: parsedTotal,
          discountAmount: parsedDiscount,
          paymentType: typeof safePayment === 'string' ? safePayment : JSON.stringify(safePayment),
          cashierName: cashierName || 'Kasiyer 1',
          items: {
            create: items.map((item: any) => ({
              variantId: item.variantId,
              quantity: parseInt(item.quantity) || 1,
              unitPrice: parseDecimal(item.unitPrice),
              totalPrice: parseDecimal(item.totalPrice)
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

      if (voucherPayment) {
        const applied = await redeemVoucher(tx, voucherPayment.code, moneyCents(voucherPayment.amount), sale.id, voucherPayment.requestId)
        sale.paymentType = JSON.stringify({ ...safePayment, giftVoucher: applied })
        await tx.sale.update({ where: { id: sale.id }, data: { paymentType: sale.paymentType } })
      }
      // 2. Update stock quantities & record movements
      for (const item of items) {
        const qty = Math.max(1, parseInt(item.quantity) || 1)
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            stockQuantity: {
              decrement: qty
            }
          }
        })

        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'SALE',
            quantity: -qty,
            note: `Satış Fişi: ${receiptNo}`
          }
        })
      }

      return sale
    })

    res.status(201).json(formatSale(result))
    return
  } catch (error: any) {
    res.status(error instanceof GiftVoucherError ? 400 : 500).json({ error: error.message })
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

    let sale: any = await prisma.sale.findUnique({
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

    if (new Set(items.map((item: any) => item.saleItemId)).size !== items.length) {
      res.status(400).json({ error: 'Aynı ürün birden fazla kez seçilemez.' }); return
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
      sale = await tx.sale.findUnique({ where: { id }, include: { customer: true, items: { include: { variant: { include: { product: true } } } } } })
      if (!sale || sale.status === 'CANCELLED') throw new Error('İade edilebilir satış bulunamadı.')
      for (const input of items) {
        const item = sale.items.find((i: any) => i.id === input.saleItemId)
        if (!item || !Number.isInteger(Number(input.returnQuantity)) || Number(input.returnQuantity) < 1 || Number(input.returnQuantity) > item.quantity - item.returnedQuantity) throw new Error('İade miktarı değişti; fişi yeniden sorgulayın.')
      }
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
      let hasExchanges = false
      try { hasExchanges = Object.keys(JSON.parse(sale.paymentType)?.exchangedItems || {}).length > 0 } catch {}
      const newStatus = allFullyReturned ? (hasExchanges ? 'EXCHANGED' : 'RETURNED') : 'PARTIAL_RETURN'

      // Calculate refund amount for items returned in this transaction
      const itemsSubtotal = (sale.items || []).reduce(
        (sum: number, it: any) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
        0
      )
      const totalAmountNum = Number(sale.totalAmount) || 0
      const discountFactor = itemsSubtotal > 0 ? Math.min(1, totalAmountNum / itemsSubtotal) : 1

      let currentBatchRefund = 0
      for (const returnItem of items) {
        const existingItem = sale.items?.find((i: any) => i.id === returnItem.saleItemId)!
        const qtyToReturn = parseInt(returnItem.returnQuantity)
        currentBatchRefund += qtyToReturn * (Number(existingItem.unitPrice) || 0) * discountFactor
      }
      currentBatchRefund = Math.round(currentBatchRefund * 100) / 100

      // Update paymentType JSON with refund deductions
      let currentPay: any = {}
      try {
        currentPay = typeof sale.paymentType === 'string' ? JSON.parse(sale.paymentType) : (sale.paymentType || {})
      } catch (e) {
        currentPay = { cash: totalAmountNum, card: 0 }
      }

      const origCash = Number(currentPay.cash) || 0
      const origCard = Number(currentPay.card) || 0
      let prevRefundCash = Number(currentPay.refundCash) || 0
      let prevRefundCard = Number(currentPay.refundCard) || 0

      let addCash = 0
      let addCard = 0

      if (req.body.refundMethod === 'CASH') {
        addCash = currentBatchRefund
      } else if (req.body.refundMethod === 'CARD') {
        addCard = currentBatchRefund
      } else {
        // 'ORIGINAL' or undefined: follow original payment proportions
        if (origCash > 0 && origCard === 0) {
          addCash = currentBatchRefund
        } else if (origCard > 0 && origCash === 0) {
          addCard = currentBatchRefund
        } else if (origCash + origCard > 0) {
          const cashRatio = origCash / (origCash + origCard)
          addCash = Math.round(currentBatchRefund * cashRatio * 100) / 100
          addCard = Math.round((currentBatchRefund - addCash) * 100) / 100
        } else {
          addCash = currentBatchRefund
        }
      }

      if (currentPay.giftVoucher) {
        const usedCents = moneyCents(currentPay.giftVoucher.amount)
        const previousGiftCents = moneyCents(currentPay.refundGiftVoucher || 0)
        const cumulativeRefund = Math.min(totalAmountNum, formatSale({ ...sale, items: freshSaleItems, status: newStatus }).refundAmount)
        const targetGiftCents = Math.min(usedCents, Math.round(usedCents * (totalAmountNum > 0 ? cumulativeRefund / totalAmountNum : 0)))
        const giftReturnCents = Math.max(0, targetGiftCents - previousGiftCents)
        await refundVoucher(tx, currentPay.giftVoucher.code, giftReturnCents, id)
        currentPay.refundGiftVoucher = targetGiftCents / 100
        const externalTargetCents = Math.max(0, Math.round(cumulativeRefund * 100) - targetGiftCents)
        const externalTotalCents = Math.round((origCash + origCard) * 100)
        const cashTarget = externalTotalCents ? Math.round(externalTargetCents * Math.round(origCash * 100) / externalTotalCents) / 100 : 0
        addCash = Math.max(0, cashTarget - prevRefundCash)
        addCard = Math.max(0, externalTargetCents / 100 - cashTarget - prevRefundCard)
      }
      const newRefundCash = Math.min(origCash, Math.round((prevRefundCash + addCash) * 100) / 100)
      const newRefundCard = Math.min(origCard, Math.round((prevRefundCard + addCard) * 100) / 100)
      const newRefundTotal = Math.min(totalAmountNum, Math.round((newRefundCash + newRefundCard + (Number(currentPay.refundGiftVoucher) || 0)) * 100) / 100)

      currentPay.refundCash = newRefundCash
      currentPay.refundCard = newRefundCard
      currentPay.refundTotal = newRefundTotal

      const finalSale = await (tx.sale as any).update({
        where: { id },
        data: {
          status: newStatus,
          paymentType: JSON.stringify(currentPay)
        },
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
    res.status(error instanceof GiftVoucherError ? 400 : 500).json({ error: error.message })
    return
  }
})

