import { Router } from 'express'
import { prisma } from '../db'
import { GiftVoucherError, moneyCents, redeemVoucher, refundVoucher } from '../services/giftVouchers'

import { matchesReportPayment, reportPaymentFilter, saleCollections } from '../../shared/salesReporting'
import { voucherCollections } from '../services/voucherCollections'
import { exchangeCredit, exchangeLines } from '../../shared/exchanges'
import { formatSale, returnQuote, salePayment, toCents } from '../../shared/saleAmounts'
import { consumeFunding, type Funding } from '../services/saleFunding'
import { randomUUID } from 'crypto'

export { formatSale } from '../../shared/saleAmounts'

export const salesRouter = Router()

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

    where.OR = [
      ...receiptQueries.map((q) => ({ receiptNo: { contains: q } })),
      { cashierName: { contains: textFilter } },
      ...(rawQuery.toUpperCase().startsWith('HC') ? [{ paymentType: { contains: rawQuery.toUpperCase() } }] : []),
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
    const searchWhere = buildSalesWhere({ search: req.query.search })
    const payment = reportPaymentFilter(req.query.payment)
    const [sales, returns, issues] = await prisma.$transaction(async tx => Promise.all([
      tx.sale.findMany({ where, include: { items: true } }),
      tx.saleReturn.findMany({ where: { createdAt: where.createdAt, sale: searchWhere }, include: { sale: true } }),
      voucherCollections(tx, { payment, start: where.createdAt?.gte, end: where.createdAt?.lte, search: req.query.search }),
    ]))
    let grossCash = 0, grossCard = 0, refundCash = 0, refundCard = 0
    let netGiftVoucher = 0, productGross = 0, productRefund = 0
    let activeSalesCount = 0, totalCount = 0, grossItemsSold = 0, returnedItemsCount = 0, exchangedItemsCount = 0
    let legacyReviewCount = 0
    const refunded = new Set<string>()
    for (const sale of sales) {
      const collection = saleCollections(sale)
      if ((payment === 'CASH' && !collection.cash) || (payment === 'CARD' && !collection.card)) continue
      totalCount++
      if (sale.status === 'CANCELLED') continue
      if (payment !== 'CARD') grossCash += collection.cash
      if (payment !== 'CASH') grossCard += collection.card
      netGiftVoucher += toCents(salePayment(sale).giftVoucher?.amount)
      productGross += toCents(sale.totalAmount)
      if (sale.totalAmount > 0) activeSalesCount++
      grossItemsSold += sale.items.reduce((sum, item) => sum + item.quantity, 0)
    }
    for (const event of returns) {
      if (event.sale.status === 'CANCELLED') continue
      const hasPayment = payment === 'ALL' || (payment === 'CASH' ? event.cashCents > 0 : event.cardCents > 0)
      if (event.source === 'EXCHANGE') {
        if (payment === 'ALL' || matchesReportPayment(event.sale, payment)) {
          exchangedItemsCount += JSON.parse(event.items).reduce((sum: number, item: any) => sum + item.returnQuantity, 0)
          if (event.needsReview) legacyReviewCount++
        }
        continue
      }
      if (!hasPayment) continue
      if (payment !== 'CARD') refundCash += event.cashCents
      if (payment !== 'CASH') refundCard += event.cardCents
      netGiftVoucher -= event.voucherCents
      productRefund += event.amountCents
      refunded.add(event.saleId)
      returnedItemsCount += JSON.parse(event.items).reduce((sum: number, item: any) => sum + item.returnQuantity, 0)
      if (event.needsReview) legacyReviewCount++
    }
    const grossRevenue = grossCash + grossCard + issues.cash + issues.card
    const totalRefund = refundCash + refundCard
    res.json({
      totalCount, activeSalesCount, refundedCount: refunded.size, legacyReviewCount,
      grossRevenue: grossRevenue / 100, totalRefund: totalRefund / 100,
      netRevenue: (grossRevenue - totalRefund) / 100,
      netCash: (grossCash - refundCash + issues.cash) / 100,
      netCard: (grossCard - refundCard + issues.card) / 100,
      netGiftVoucher: netGiftVoucher / 100,
      voucherIssueCash: issues.cash / 100, voucherIssueCard: issues.card / 100, voucherIssueCount: issues.count,
      productGrossRevenue: productGross / 100, productNetRevenue: (productGross - productRefund) / 100,
      avgReceiptAmount: activeSalesCount > 0 ? Math.round((productGross - productRefund) / activeSalesCount) / 100 : 0,
      grossItemsSold, returnedItemsCount, exchangedItemsCount,
      netItemsSold: grossItemsSold - returnedItemsCount - exchangedItemsCount,
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
    const payment = reportPaymentFilter(req.query.payment)

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
      take: payment === 'ALL' ? (limit > 0 ? limit : 20) : undefined
    })
    const formatted = sales.map(formatSale).filter(sale => matchesReportPayment(sale, payment))
    res.json(formatted.slice(0, limit > 0 ? limit : 20))
  } catch (error: any) {
    res.status(error instanceof GiftVoucherError ? 400 : 500).json({ error: error.message })
  }
})

// POST /api/sales - Create & Checkout POS Sale
salesRouter.post('/', async (req, res) => {
  try {
    let { items, totalAmount, discountAmount, paymentType, cashierName, customerId, receiptPrefix, exchange } = req.body
    if (!Array.isArray(items) || items.length === 0 || items.length > 1000) {
      res.status(400).json({ error: 'Sepette ürün bulunmamaktadır.' })
      return
    }
    totalAmount = moneyCents(totalAmount) / 100
    discountAmount = moneyCents(discountAmount ?? 0) / 100
    const surcharge = moneyCents(req.body.surchargeAmount ?? 0) / 100
    items = items.map((item: any) => {
      if (!item || typeof item.variantId !== 'string' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100000) throw new GiftVoucherError('Ürün veya adet geçersiz.')
      const unit = moneyCents(item.unitPrice), line = moneyCents(item.totalPrice)
      if (line !== unit * item.quantity) throw new GiftVoucherError('Ürün satır tutarı adet ve birim fiyatla eşleşmiyor.')
      return { variantId: item.variantId, quantity: item.quantity, unitPrice: unit / 100, totalPrice: line / 100 }
    })
    if (req.body.surchargeAmount !== undefined) {
      const subtotal = items.reduce((sum: number, item: any) => sum + toCents(item.totalPrice), 0)
      if (subtotal - toCents(discountAmount) + toCents(surcharge) !== toCents(totalAmount)) throw new GiftVoucherError('Ürün, indirim ve fiyat farkı toplamı satış tutarıyla eşleşmiyor.')
    }
    if (typeof paymentType === 'string') {
      if (paymentType === 'CASH' || paymentType === 'CARD') paymentType = paymentType === 'CARD' ? { cash: 0, card: totalAmount } : { cash: totalAmount, card: 0 }
      else { try { paymentType = JSON.parse(paymentType) } catch { throw new GiftVoucherError('Ödeme bilgisi geçersiz.') } }
    }
    if (paymentType === undefined) paymentType = { cash: totalAmount, card: 0 }
    if (!paymentType || typeof paymentType !== 'object' || Array.isArray(paymentType)) throw new GiftVoucherError('Ödeme bilgisi geçersiz.')
    const voucherInput = paymentType.giftVoucher
    paymentType = {
      cash: moneyCents(paymentType.cash ?? 0) / 100, card: moneyCents(paymentType.card ?? 0) / 100,
      ...(typeof paymentType.note === 'string' ? { note: paymentType.note.slice(0, 200) } : {}),
      ...(voucherInput ? { giftVoucher: { code: voucherInput.code, amount: moneyCents(voucherInput.amount) / 100, requestId: voucherInput.requestId } } : {}),
    }
    if (toCents(paymentType.cash) + toCents(paymentType.card) + toCents(paymentType.giftVoucher?.amount) !== toCents(totalAmount)) throw new GiftVoucherError('Nakit, kart ve çek toplamı satış tutarına eşit olmalıdır.')

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
      let inheritedFunding: Funding[] = []
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
      const transactionAt = new Date()
      if (exchange) {
        const original = await tx.sale.findUnique({ where: { id: exchange.saleId }, include: { items: true } })
        if (!original) throw new Error('Değiştirilecek fiş bulunamadı.')
        const selectedLines = exchangeLines(exchange)
        const credit = exchangeCredit(original, selectedLines)
        const consumed = await consumeFunding(tx, original, toCents(credit))
        const originalPay = consumed.payment
        inheritedFunding = consumed.funding
        if (Math.round(Number(exchange.credit) * 100) !== Math.round(credit * 100) || discountAmount < credit) {
          throw new Error('Değişim bedeli değişti; fişi yeniden seçin.')
        }
        const newSubtotal = items.reduce((sum: number, item: any) => sum + item.totalPrice, 0)
        if (newSubtotal + surcharge < discountAmount || Math.round((newSubtotal - discountAmount + surcharge) * 100) > Math.round(totalAmount * 100)) {
          throw new Error('Değişim tutarı veya tahsilat geçersiz.')
        }
        originalPay.exchangedItems = originalPay.exchangedItems || {}
        for (const line of selectedLines) {
          const oldItem = original.items.find(item => item.id === line.itemId)!
          originalPay.exchangedItems[oldItem.id] = (Number(originalPay.exchangedItems[oldItem.id]) || 0) + line.quantity
          await tx.saleItem.update({ where: { id: oldItem.id }, data: { returnedQuantity: { increment: line.quantity } } })
          await tx.productVariant.update({ where: { id: oldItem.variantId }, data: { stockQuantity: { increment: line.quantity } } })
          await tx.stockMovement.create({ data: { variantId: oldItem.variantId, type: 'EXCHANGE', quantity: line.quantity, note: `Değişim: ${original.receiptNo} → ${receiptNo}` } })
        }
        const allHandled = original.items.every(item => item.returnedQuantity + (selectedLines.find(line => line.itemId === item.id)?.quantity || 0) >= item.quantity)
        await tx.sale.update({ where: { id: original.id }, data: { status: allHandled ? 'EXCHANGED' : 'PARTIAL_EXCHANGE', paymentType: JSON.stringify(originalPay) } })
        await tx.saleReturn.create({ data: {
          id: randomUUID(), saleId: original.id, createdAt: transactionAt, cashCents: 0, cardCents: 0, voucherCents: 0, amountCents: 0,
          source: 'EXCHANGE', items: JSON.stringify(selectedLines.map(line => ({ saleItemId: line.itemId, returnQuantity: line.quantity }))),
        } })
        if (typeof paymentType === 'object' && paymentType) {
          paymentType.exchange = { receiptNo: original.receiptNo, saleId: original.id, items: selectedLines, ...(selectedLines.length === 1 ? { itemId: selectedLines[0].itemId } : {}), credit }
        }
      }
      // Voucher amounts and balance changes are verified in the sale transaction.
      let safePayment: any = { ...paymentType }
      const voucherPayment = safePayment.giftVoucher
      if (voucherPayment) {
        const voucherCents = moneyCents(voucherPayment.amount)
        const cashCents = moneyCents(safePayment.cash || 0)
        const cardCents = moneyCents(safePayment.card || 0)
        if (!voucherCents || cashCents + cardCents + voucherCents !== moneyCents(totalAmount)) throw new GiftVoucherError('Çek, nakit ve kart toplamı satış tutarına eşit olmalıdır.')
        if (!voucherPayment.code || typeof voucherPayment.code !== 'string') throw new GiftVoucherError('Çek kodu geçersiz.')
        safePayment = { cash: cashCents / 100, card: cardCents / 100, ...(safePayment.exchange ? { exchange: safePayment.exchange } : {}), giftVoucher: { code: voucherPayment.code, amount: voucherCents / 100 } }
      }
      // 1. Create Sale record
      const saleId = randomUUID()
      safePayment.funding = [...inheritedFunding,
        ...(toCents(safePayment.cash) ? [{ kind: 'CASH', cents: toCents(safePayment.cash) }] : []),
        ...(toCents(safePayment.card) ? [{ kind: 'CARD', cents: toCents(safePayment.card) }] : []),
        ...(voucherPayment ? [{ kind: 'VOUCHER', cents: toCents(voucherPayment.amount), code: voucherPayment.code, saleId }] : []),
      ]
      safePayment.fundingUsed = safePayment.funding.map(() => 0)
      const parsedTotal = totalAmount
      const parsedDiscount = discountAmount
      const sale = await tx.sale.create({
        data: {
          id: saleId,
          createdAt: transactionAt,
          receiptNo,
          customerId: customerId || null,
          totalAmount: parsedTotal,
          discountAmount: parsedDiscount,
          paymentType: JSON.stringify(safePayment),
          cashierName: cashierName || 'Kasiyer 1',
          items: {
            create: items.map((item: any) => ({
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice
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
        const qty = item.quantity
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
    if (req.body.refundMethod !== undefined && !['CASH', 'CARD', 'ORIGINAL'].includes(req.body.refundMethod)) throw new GiftVoucherError('İade ödeme yöntemi geçersiz.')
    // Validate return items
    for (const returnItem of items) {
      const existingItem = sale.items?.find((i: any) => i.id === returnItem.saleItemId)
      if (!existingItem) {
        res.status(400).json({ error: `Fişte ${returnItem.saleItemId} ID'li ürün bulunamadı.` })
        return
      }
      const qtyToReturn = returnItem.returnQuantity
      if (!Number.isSafeInteger(qtyToReturn) || qtyToReturn <= 0) {
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

      const refundCents = toCents(returnQuote(sale, items))
      const consumed = await consumeFunding(tx, sale, refundCents)
      const currentPay = consumed.payment
      let cash = 0, card = 0, voucher = 0
      for (const part of consumed.funding) {
        if (part.kind === 'VOUCHER') {
          await refundVoucher(tx, part.code!, part.cents, part.saleId!)
          voucher += part.cents
        } else if (part.kind === 'CASH') cash += part.cents
        else card += part.cents
      }
      // Explicit payout channels describe the actual outflow, even if that
      // channel collected less on the original receipt. Negative net cash is valid.
      const hasVoucherFunding = currentPay.funding.some((part: Funding) => part.kind === 'VOUCHER')
      if (!hasVoucherFunding && req.body.refundMethod === 'CASH') { cash += card; card = 0 }
      if (!hasVoucherFunding && req.body.refundMethod === 'CARD') { card += cash; cash = 0 }
      currentPay.refundCash = (toCents(currentPay.refundCash) + cash) / 100
      currentPay.refundCard = (toCents(currentPay.refundCard) + card) / 100
      currentPay.refundGiftVoucher = (toCents(currentPay.refundGiftVoucher) + voucher) / 100
      currentPay.refundTotal = currentPay.refundCash + currentPay.refundCard + currentPay.refundGiftVoucher
      currentPay.refundVersion = 2
      const event = await tx.saleReturn.create({ data: {
        id: randomUUID(), saleId: id, cashCents: cash, cardCents: card,
        voucherCents: voucher, amountCents: refundCents, items: JSON.stringify(items),
      } })

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

      return { ...finalSale, lastReturn: { id: event.id, amount: refundCents / 100, cash: cash / 100, card: card / 100, voucher: voucher / 100 } }
    })

    res.json(formatSale(updatedSale))
    return
  } catch (error: any) {
    res.status(error instanceof GiftVoucherError ? 400 : 500).json({ error: error.message })
    return
  }
})

