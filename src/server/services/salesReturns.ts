import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { formatSale, itemAllocations, itemPortion, salePayment, toCents } from '../../shared/saleAmounts'

// The migration preserves every existing sale and payment field. Legacy refunds
// have no per-operation money log; carry known totals and flag uncertain dates,
// missing money or old exchange-as-return records instead of inventing payments.
export async function ensureSalesReturnsSchema(db: PrismaClient, dbPath: string): Promise<void> {
  const tables = await db.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' AND name='SaleReturn'")
  if (tables.length) return
  const check = await db.$queryRawUnsafe<{ integrity_check: string }[]>('PRAGMA integrity_check')
  if (check.length !== 1 || check[0].integrity_check !== 'ok') throw new Error('Ciro güncellemesi öncesi veritabanı bütünlük kontrolü başarısız.')
  const backupDir = path.join(path.dirname(dbPath), 'backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `ciro_oncesi_${Date.now()}_${randomUUID()}.db`)
  await db.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/\\/g, '/').replace(/'/g, "''")}'`)
  const backup = new PrismaClient({ datasources: { db: { url: `file:${backupPath.replace(/\\/g, '/')}` } } })
  try {
    const verified = await backup.$queryRawUnsafe<{ integrity_check: string }[]>('PRAGMA integrity_check')
    if (verified.length !== 1 || verified[0].integrity_check !== 'ok') throw new Error('Ciro güncellemesi öncesi yedek doğrulanamadı.')
  } finally { await backup.$disconnect() }
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE TABLE "SaleReturn" (
      "id" TEXT NOT NULL PRIMARY KEY, "saleId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "cashCents" INTEGER NOT NULL, "cardCents" INTEGER NOT NULL,
      "voucherCents" INTEGER NOT NULL, "amountCents" INTEGER NOT NULL,
      "items" TEXT NOT NULL, "source" TEXT NOT NULL DEFAULT 'RECORDED',
      "needsReview" BOOLEAN NOT NULL DEFAULT false,
      FOREIGN KEY("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE)`)
    await tx.$executeRawUnsafe('CREATE INDEX "SaleReturn_createdAt_idx" ON "SaleReturn"("createdAt")')
    await tx.$executeRawUnsafe('CREATE INDEX "SaleReturn_saleId_idx" ON "SaleReturn"("saleId")')
    const sales = await tx.sale.findMany({ where: { status: { not: 'CANCELLED' }, items: { some: { returnedQuantity: { gt: 0 } } } }, include: { items: true } })
    for (const sale of sales) {
      const formatted = formatSale(sale)
      const pay = salePayment(sale)
      const exchanged = sale.items.map(item => ({ saleItemId: item.id, returnQuantity: Math.min(item.returnedQuantity, Number(pay.exchangedItems?.[item.id]) || 0) })).filter(item => item.returnQuantity > 0)
      if (exchanged.length) {
        const movements = await tx.stockMovement.findMany({ where: { type: 'EXCHANGE', note: { startsWith: `Değişim: ${sale.receiptNo} →` } }, orderBy: { createdAt: 'desc' } })
        await tx.saleReturn.create({ data: {
          id: `legacy-exchange-${sale.id}`, saleId: sale.id, createdAt: movements[0]?.createdAt || sale.createdAt,
          cashCents: 0, cardCents: 0, voucherCents: 0, amountCents: 0,
          items: JSON.stringify(exchanged), source: 'EXCHANGE', needsReview: movements.length !== 1,
        } })
      }
      const items = sale.items.map(item => ({ saleItemId: item.id, returnQuantity: Math.max(0, item.returnedQuantity - (Number(pay.exchangedItems?.[item.id]) || 0)) })).filter(item => item.returnQuantity > 0)
      if (!items.length) continue
      const prefix = `İade Fişi: ${sale.receiptNo} (`
      const movements = (await tx.stockMovement.findMany({ where: { type: 'RETURN', note: { startsWith: prefix } }, orderBy: { createdAt: 'asc' } })).filter(m => m.note?.startsWith(prefix))
      const cash = toCents(formatted.paymentType.refundCash), card = toCents(formatted.paymentType.refundCard), voucher = toCents(pay.refundGiftVoucher)
      const allocated = itemAllocations(sale)
      const expected = sale.items.reduce((sum, item, index) => {
        const exchangedQuantity = Math.min(item.returnedQuantity, Number(pay.exchangedItems?.[item.id]) || 0)
        return sum + itemPortion(allocated[index], item.quantity, exchangedQuantity, item.returnedQuantity - exchangedQuantity)
      }, 0)
      const oldExchange = movements.some(m => m.note?.includes('Beden / Ürün Değişimi (Sıfır Fark Mahsubu)'))
      await tx.saleReturn.create({ data: {
        id: `legacy-${sale.id}`, saleId: sale.id,
        createdAt: movements.at(-1)?.createdAt || sale.createdAt,
        cashCents: cash, cardCents: card, voucherCents: voucher, amountCents: cash + card + voucher,
        items: JSON.stringify(items), source: 'LEGACY',
        needsReview: oldExchange || movements.length !== 1 || cash + card + voucher !== expected
          || (pay.refundCash === undefined && pay.refundCard === undefined && pay.refundGiftVoucher === undefined)
          || movements.reduce((sum, movement) => sum + movement.quantity, 0) !== items.reduce((sum, item) => sum + item.returnQuantity, 0),
      } })
    }
  }, { timeout: 60000 })
}
