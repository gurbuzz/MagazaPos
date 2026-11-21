import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { ensureSalesReturnsSchema } from '../src/server/services/salesReturns'
import { ensureGiftVoucherSchema, issueVoucher, findVoucher } from '../src/server/services/giftVouchers'
import { returnQuote } from '../src/shared/saleAmounts'
import { reportDateIso } from '../src/shared/salesReporting'

test('revenue, returns, exchanges and safe legacy upgrade against an isolated database', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magazapos-revenue-test-'))
  process.env.MAGAZAPOS_USER_DATA = dir
  const dbPath = path.join(dir, 'magazapos.db')
  const db = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })
  let runtimeDb: PrismaClient | undefined
  let server: import('node:http').Server | undefined
  try {
    const schemaPath = path.join(dir, 'legacy.prisma')
    fs.writeFileSync(schemaPath, fs.readFileSync('prisma/schema.prisma', 'utf8').split('// Added by a backed-up, additive migration')[0].replace(/^\s*returns\s+SaleReturn\[\].*$/m, ''))
    const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'], { encoding: 'utf8' })
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement)
    await db.category.create({ data: { id: 'category', name: 'TEST' } })
    await db.product.create({ data: { id: 'product', code: 'TEST', name: 'Test product', categoryId: 'category' } })
    await db.productVariant.create({ data: { id: 'variant', productId: 'product', sku: 'TEST', barcode: '123456789', attributes: '{}', salePrice: 1000, stockQuantity: 1000 } })

    await t.test('migration takes a verified backup, preserves every old row and flags ambiguous history', async () => {
      for (const [id, note] of [['LEGACY-RETURN', 'Normal iade'], ['LEGACY-EXCHANGE', 'Beden / Ürün Değişimi (Sıfır Fark Mahsubu)']]) {
        await db.sale.create({ data: {
          id, receiptNo: id, cashierName: id, totalAmount: 1000, status: 'RETURNED',
          createdAt: new Date('2020-01-01T10:00:00Z'), paymentType: JSON.stringify({ cash: 1000, card: 0, refundCash: 1000, refundCard: 0 }),
          items: { create: { variantId: 'variant', quantity: 1, returnedQuantity: 1, unitPrice: 1000, totalPrice: 1000 } },
        } })
        await db.stockMovement.create({ data: { variantId: 'variant', type: 'RETURN', quantity: 1, createdAt: new Date('2020-01-03T10:00:00Z'), note: `İade Fişi: ${id} (1 ad) - Müşteri - Nedeni: ${note}` } })
      }
      const tables = ['Sale', 'SaleItem', 'Product', 'ProductVariant', 'Category', 'StockMovement']
      const snapshot = (client: PrismaClient) => Promise.all(tables.map(table => client.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`)))
      const before = await snapshot(db)
      await ensureSalesReturnsSchema(db, dbPath)
      assert.deepEqual(await snapshot(db), before)
      const returns = await db.saleReturn.findMany({ orderBy: { saleId: 'asc' } })
      assert.equal(returns.length, 2)
      assert.equal(returns[0].needsReview, true)
      assert.equal(returns[1].needsReview, false)
      assert.equal(returns[1].createdAt.toISOString(), '2020-01-03T10:00:00.000Z')
      const backupFile = fs.readdirSync(path.join(dir, 'backups'))[0]
      const backup = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, 'backups', backupFile)}` } } })
      try { assert.deepEqual(await snapshot(backup), before) } finally { await backup.$disconnect() }
      await ensureSalesReturnsSchema(db, dbPath)
      assert.equal(fs.readdirSync(path.join(dir, 'backups')).length, 1)
      assert.equal(await db.saleReturn.count(), 2)
    })
    await t.test('migration stops without changing schema when a backup cannot be created', async () => {
      const blockedDir = path.join(dir, 'blocked')
      fs.mkdirSync(blockedDir)
      const blockedPath = path.join(blockedDir, 'test.db')
      const blocked = new PrismaClient({ datasources: { db: { url: `file:${blockedPath}` } } })
      try {
        await blocked.$executeRawUnsafe('CREATE TABLE ExistingData (value TEXT)')
        await blocked.$executeRawUnsafe("INSERT INTO ExistingData VALUES ('keep')")
        fs.writeFileSync(path.join(blockedDir, 'backups'), 'blocked')
        await assert.rejects(ensureSalesReturnsSchema(blocked, blockedPath))
        assert.deepEqual(await blocked.$queryRawUnsafe('SELECT * FROM ExistingData'), [{ value: 'keep' }])
        assert.deepEqual(await blocked.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE name='SaleReturn'"), [])
      } finally { await blocked.$disconnect() }
    })
    await ensureGiftVoucherSchema(db, dbPath)
    await db.$disconnect()
    const runtime = await import('../src/server/db')
    runtimeDb = runtime.prisma
    await runtime.databaseReady
    const { salesRouter } = await import('../src/server/routes/sales')
    const express = (await import('express')).default
    const app = express(); app.use(express.json()); app.use('/sales', salesRouter)
    server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
    const post = async (url: string, body: any, status = 201) => {
      const res = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json() as any
      assert.equal(res.status, status, JSON.stringify(data))
      return data
    }
    const stats = async (label: string, filters: Record<string, string> = {}) => {
      const res = await fetch(base + '/sales/stats?' + new URLSearchParams({ search: label, ...filters }))
      const data = await res.json() as any
      assert.equal(res.status, 200, JSON.stringify(data))
      assert.equal(Math.round(data.netRevenue * 100), Math.round((data.netCash + data.netCard) * 100))
      assert.equal(Math.round(data.netRevenue * 100), Math.round((data.grossRevenue - data.totalRefund) * 100))
      return data
    }
    const sale = (label: string, total: number, payment = { cash: total, card: 0 }, quantity = 1, price = total / quantity) => post('/sales', {
      cashierName: label, totalAmount: total, discountAmount: Math.max(0, price * quantity - total), surchargeAmount: Math.max(0, total - price * quantity),
      items: [{ variantId: 'variant', quantity, unitPrice: price, totalPrice: price * quantity }], paymentType: payment,
    })
    const ret = (s: any, quantity: number, refundMethod = 'ORIGINAL') => post(`/sales/${s.id}/return`, { items: [{ saleItemId: s.items[0].id, returnQuantity: quantity }], refundMethod }, 200)
    const exchange = (label: string, source: any, price: number, quantity = 1, credit = source.receiptAmount) => post('/sales', {
      cashierName: label, items: [{ variantId: 'variant', quantity: 1, unitPrice: price, totalPrice: price }],
      exchange: { saleId: source.id, items: [{ itemId: source.items[0].id, quantity }], credit },
      totalAmount: price - credit, discountAmount: credit, paymentType: { cash: price - credit, card: 0 },
    })

    await t.test('equal-price exchanges do not change money and are counted separately from returns', async () => {
      const original = await sale('EQUAL', 1000)
      await exchange('EQUAL', original, 1000)
      const report = await stats('EQUAL')
      assert.equal(report.netRevenue, 1000)
      assert.equal(report.totalRefund, 0)
      assert.equal(report.returnedItemsCount, 0)
      assert.equal(report.exchangedItemsCount, 1)
      assert.equal(report.netItemsSold, 1)
      assert.equal(report.avgReceiptAmount, 1000)
    })
    await t.test('returning an exchange refunds all paid value exactly once', async () => {
      const original = await sale('FULL-EXCHANGE', 1000)
      const replacement = await exchange('FULL-EXCHANGE', original, 1200)
      assert.equal((await stats('FULL-EXCHANGE')).netRevenue, 1200)
      const returned = await ret(replacement, 1, 'CASH')
      assert.equal(returned.lastReturn.amount, 1200)
      assert.equal(returned.lastReturn.cash, 1200)
      assert.equal((await stats('FULL-EXCHANGE')).netRevenue, 0)
      await post(`/sales/${replacement.id}/return`, { items: [{ saleItemId: replacement.items[0].id, returnQuantity: 1 }] }, 400)
      await post(`/sales/${original.id}/return`, { items: [{ saleItemId: original.items[0].id, returnQuantity: 1 }] }, 400)
      assert.equal((await stats('FULL-EXCHANGE')).netRevenue, 0)
    })
    await t.test('the full value survives repeated exchanges', async () => {
      const first = await sale('CHAIN', 1000)
      const second = await exchange('CHAIN', first, 1200)
      const third = await exchange('CHAIN', second, 1400)
      assert.equal((await ret(third, 1)).lastReturn.amount, 1400)
      assert.equal((await stats('CHAIN')).netRevenue, 0)
    })
    await t.test('cash refunds of card and split payments retain the selected outflow channel', async () => {
      const card = await sale('CROSS', 1000, { cash: 0, card: 1000 })
      assert.equal((await ret(card, 1, 'CASH')).lastReturn.cash, 1000)
      assert.equal((await stats('CROSS')).netRevenue, 0)
      assert.equal((await stats('CROSS', { payment: 'CASH' })).netCash, -1000)
      assert.equal((await stats('CROSS', { payment: 'CARD' })).netCard, 1000)
      const split = await sale('SPLIT', 1000, { cash: 200, card: 800 })
      await ret(split, 1, 'CASH')
      const report = await stats('SPLIT')
      assert.equal(report.totalRefund, 1000)
      assert.equal(report.netRevenue, 0)
      assert.equal(report.netCash, -800)
      assert.equal(report.netCard, 800)
    })
    await t.test('surcharges and cent remainders are fully refunded across separate operations', async () => {
      const marked = await sale('MARKUP', 1200, undefined, 2, 500)
      assert.equal((await ret(marked, 1)).lastReturn.amount, 600)
      assert.equal((await ret(marked, 1)).lastReturn.amount, 600)
      assert.equal((await stats('MARKUP')).netRevenue, 0)
      let rounded = await sale('ROUNDING', 10, undefined, 3, 4)
      for (const expected of [3.33, 3.33, 3.34]) {
        assert.equal(returnQuote(rounded, [{ saleItemId: rounded.items[0].id, returnQuantity: 1 }]), expected)
        rounded = await ret(rounded, 1)
        assert.equal(rounded.lastReturn.amount, expected)
      }
      assert.equal((await stats('ROUNDING')).netRevenue, 0)
      assert.equal((await stats('ROUNDING')).totalRefund, 10)
    })
    await t.test('returns belong to their own day, including negative revenue on a day without sales', async () => {
      const original = await sale('DATED', 1000)
      await runtimeDb!.sale.update({ where: { id: original.id }, data: { createdAt: new Date('2020-01-01T10:00:00Z') } })
      const historical = { startDate: '2020-01-01T00:00:00Z', endDate: '2020-01-01T23:59:59.999Z' }
      await ret(original, 1)
      const previous = await stats('DATED', historical)
      assert.equal(previous.netRevenue, 1000)
      assert.equal(previous.totalRefund, 0)
      assert.equal(previous.netItemsSold, 1)
      const today = await stats('DATED', { startDate: '2021-01-01T00:00:00Z' })
      assert.equal(today.netRevenue, -1000)
      assert.equal(today.totalRefund, 1000)
      assert.equal(today.netItemsSold, -1)
      assert.equal(today.refundedCount, 1)
      const specificReceipt = await stats(original.receiptNo, { startDate: '2021-01-01T00:00:00Z' })
      assert.equal(specificReceipt.grossRevenue, 0, 'A receipt search must not silently discard report date filters')
    })
    await t.test('the final minute is included with an explicit browser timezone', async () => {
      const oldTimezone = process.env.TZ
      process.env.TZ = 'Europe/Istanbul'
      try {
        const original = await sale('FINAL-MINUTE', 1000)
        await runtimeDb!.sale.update({ where: { id: original.id }, data: { createdAt: new Date('2020-01-01T20:59:30Z') } })
        assert.equal((await stats('FINAL-MINUTE', { startDate: reportDateIso('2020-01-01T00:00'), endDate: reportDateIso('2020-01-01T23:59', true) })).netRevenue, 1000)
        assert.equal((await stats('FINAL-MINUTE', { startDate: reportDateIso('2020-01-02T00:00') })).netRevenue, 0)
      } finally { if (oldTimezone === undefined) delete process.env.TZ; else process.env.TZ = oldTimezone }
    })
    await t.test('invalid payment and item amounts are rejected without any stock or sale changes', async () => {
      const before = { sales: await runtimeDb!.sale.count(), stock: (await runtimeDb!.productVariant.findUniqueOrThrow({ where: { id: 'variant' } })).stockQuantity }
      const basePayload = { totalAmount: 1000, items: [{ variantId: 'variant', quantity: 1, unitPrice: 1000, totalPrice: 1000 }], paymentType: { cash: 1000, card: 0 } }
      for (const payload of [
        { ...basePayload, paymentType: { cash: 100, card: 0 } },
        { ...basePayload, paymentType: { cash: -1, card: 1001 } },
        { ...basePayload, items: [{ ...basePayload.items[0], quantity: 1.5 }] },
        { ...basePayload, items: [{ ...basePayload.items[0], totalPrice: 999 }] },
        { ...basePayload, totalAmount: 'NaN' },
        { ...basePayload, paymentType: 'UNKNOWN' },
      ]) await post('/sales', payload, 400)
      assert.equal(await runtimeDb!.sale.count(), before.sales)
      assert.equal((await runtimeDb!.productVariant.findUniqueOrThrow({ where: { id: 'variant' } })).stockQuantity, before.stock)
    })
    await t.test('partial return followed by exchange does not create extra refundable value', async () => {
      const source = await sale('MIXED', 180, undefined, 2, 100)
      await ret(source, 1)
      const replacement = await exchange('MIXED', source, 100, 1, 90)
      await ret(replacement, 1)
      assert.equal((await stats('MIXED')).netRevenue, 0)
    })
    await t.test('a failed replacement rolls back source funding, stock and exchange events', async () => {
      const original = await sale('ROLLBACK', 1000)
      const snapshot = async () => ({
        sale: await runtimeDb!.sale.findUniqueOrThrow({ where: { id: original.id }, include: { items: true } }),
        stock: await runtimeDb!.productVariant.findUniqueOrThrow({ where: { id: 'variant' } }),
        events: await runtimeDb!.saleReturn.count(),
      })
      const before = await snapshot()
      await post('/sales', {
        totalAmount: 200, discountAmount: 1000, cashierName: 'ROLLBACK', paymentType: { cash: 200, card: 0 },
        items: [{ variantId: 'missing', quantity: 1, unitPrice: 1200, totalPrice: 1200 }],
        exchange: { saleId: original.id, items: [{ itemId: original.items[0].id, quantity: 1 }], credit: 1000 },
      }, 500)
      assert.deepEqual(await snapshot(), before)
      assert.equal((await stats('ROLLBACK')).netRevenue, 1000)
    })
    await t.test('concurrent returns cannot refund the same last unit twice', async () => {
      const original = await sale('CONCURRENT', 1000)
      const results = await Promise.all([0, 1].map(async () => {
        const res = await fetch(base + `/sales/${original.id}/return`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ saleItemId: original.items[0].id, returnQuantity: 1 }], refundMethod: 'CASH' }),
        })
        return res.status
      }))
      assert.equal(results.filter(status => status === 200).length, 1)
      assert.equal(await runtimeDb!.saleReturn.count({ where: { saleId: original.id } }), 1)
      assert.equal((await stats('CONCURRENT')).netRevenue, 0)
    })
    await t.test('original voucher funding is restored when a replacement is returned', async () => {
      const voucher = await issueVoucher(runtimeDb!, { amount: 300, paymentMethod: 'CASH', cashierName: 'VOUCHER-CHAIN', requestId: randomUUID() })
      const original = await post('/sales', {
        cashierName: 'VOUCHER-CHAIN', totalAmount: 500,
        items: [{ variantId: 'variant', quantity: 1, unitPrice: 500, totalPrice: 500 }],
        paymentType: { cash: 200, card: 0, giftVoucher: { code: voucher.code, amount: 300, requestId: randomUUID() } },
      })
      const replacement = await exchange('VOUCHER-CHAIN', original, 600)
      const returned = await ret(replacement, 1, 'CASH')
      assert.equal(returned.lastReturn.voucher, 300)
      assert.equal(returned.lastReturn.cash, 300)
      assert.equal((await findVoucher(runtimeDb!, voucher.code)).balanceCents, 30000)
      assert.equal((await stats('VOUCHER-CHAIN')).netRevenue, 300, 'The voucher issuance remains collected and its balance is spendable again')
    })
    await t.test('legacy warnings are visible and legacy return dates are separate from sale dates', async () => {
      assert.equal((await stats('LEGACY-EXCHANGE')).legacyReviewCount, 1)
      assert.equal((await stats('LEGACY-RETURN', { endDate: '2020-01-01T23:59:59Z' })).netRevenue, 1000)
      assert.equal((await stats('LEGACY-RETURN', { startDate: '2020-01-03T00:00:00Z' })).netRevenue, -1000)
    })
  } finally {
    if (server) await new Promise<void>(resolve => server!.close(() => resolve()))
    await runtimeDb?.$disconnect()
    await db.$disconnect()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
