import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { ensureGiftVoucherSchema, issueVoucher, findVoucher, redeemVoucher, refundVoucher, moneyCents } from '../src/server/services/giftVouchers'
import { generateReceiptHtml, normalizeSaleToReceiptData } from '../src/renderer/src/utils/printReceipt'
import { generateEscposReceipt } from '../src/renderer/src/utils/escposReceipt'

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magazapos-voucher-test-'))
  process.env.MAGAZAPOS_USER_DATA = dir
  const dbPath = path.join(dir, 'magazapos.db')
  const db = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } })
  let runtimeDb: PrismaClient | undefined
  let server: import('node:http').Server | undefined
  try {
    // Generate only SQL for the OLD schema. Never connect to a store database.
    const schema = fs.readFileSync('prisma/schema.prisma', 'utf8').split('// Added by a backed-up, additive migration')[0]
    const schemaPath = path.join(dir, 'legacy.prisma')
    fs.writeFileSync(schemaPath, schema)
    const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'], { encoding: 'utf8' })
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement)
    await db.category.create({ data: { id: 'category', name: 'GERÇEK ÜRÜNLER' } })
    await db.product.create({ data: { id: 'product', code: 'KEEP', name: 'Korunacak ürün', categoryId: 'category', basePrice: 250 } })
    await db.productVariant.create({ data: { id: 'variant', productId: 'product', sku: 'KEEP', barcode: '123456', attributes: '{}', salePrice: 250, costPrice: 100, stockQuantity: 30 } })
    await db.customer.create({ data: { id: 'customer', firstName: 'Kayıt', lastName: 'Korunacak', phone: '05551112233', city: 'İstanbul', district: 'Merkez' } })
    await db.sale.create({ data: { id: 'old-sale', receiptNo: 'OLD', customerId: 'customer', totalAmount: 250, paymentType: '{"cash":250,"card":0}', items: { create: { variantId: 'variant', quantity: 1, unitPrice: 250, totalPrice: 250 } } } })
    const oldTables = ['Category','Product','ProductVariant','Customer','Sale','SaleItem','StockMovement']
    const snapshot = async (client: PrismaClient) => Promise.all(oldTables.map(table => client.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`)))
    const before = await snapshot(db)
    await ensureGiftVoucherSchema(db, dbPath)
    assert.deepEqual(await snapshot(db), before, 'Migration must preserve every old row and value')
    const backups = fs.readdirSync(path.join(dir, 'backups'))
    assert.equal(backups.length, 1)
    const backup = new PrismaClient({ datasources: { db: { url: `file:${path.join(dir, 'backups', backups[0])}` } } })
    try { assert.deepEqual(await snapshot(backup), before) } finally { await backup.$disconnect() }
    await ensureGiftVoucherSchema(db, dbPath)
    assert.equal(fs.readdirSync(path.join(dir, 'backups')).length, 1, 'Migration must run once')
    console.log('PASS: additive migration preserves all legacy records; verified backup; repeat startup')

    const failedDir = path.join(dir, 'blocked'); fs.mkdirSync(failedDir)
    const failPath = path.join(failedDir, 'magazapos.db')
    const failed = new PrismaClient({ datasources: { db: { url: `file:${failPath}` } } })
    try {
      await failed.$executeRawUnsafe('CREATE TABLE ExistingData (value TEXT)')
      await failed.$executeRawUnsafe("INSERT INTO ExistingData VALUES ('keep')")
      fs.writeFileSync(path.join(failedDir, 'backups'), 'prevent backup directory')
      await assert.rejects(ensureGiftVoucherSchema(failed, failPath))
      assert.deepEqual(await failed.$queryRawUnsafe('SELECT * FROM ExistingData'), [{ value: 'keep' }])
      assert.deepEqual(await failed.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE name='GiftVoucher'"), [])
    } finally { await failed.$disconnect() }
    console.log('PASS: backup failure prevents schema changes')

    for (const bad of [-1, 'NaN', '0.001', Infinity, '', null]) assert.throws(() => moneyCents(bad))
    const input = { amount: '1000,00', paymentMethod: 'CASH', cashierName: 'Test', requestId: randomUUID() }
    const voucher = await issueVoucher(db, input)
    assert.equal((await issueVoucher(db, input)).code, voucher.code)
    await assert.rejects(issueVoucher(db, { ...input, amount: 999 }))
    await db.$transaction(tx => redeemVoucher(tx, voucher.code, 65000, 'test-sale'))
    assert.equal((await findVoucher(db, voucher.code)).balanceCents, 35000)
    await assert.rejects(db.$transaction(tx => redeemVoucher(tx, voucher.code, 35001, 'overspend')))
    await assert.rejects(db.$transaction(async tx => { await redeemVoucher(tx, voucher.code, 10000, 'rollback'); throw Error('sale failure') }))
    assert.equal((await findVoucher(db, voucher.code)).balanceCents, 35000)
    await db.$transaction(tx => refundVoucher(tx, voucher.code, 65000, 'test-sale'))
    await assert.rejects(db.$transaction(tx => refundVoucher(tx, voucher.code, 1, 'test-sale')))
    assert.equal((await findVoucher(db, voucher.code)).balanceCents, 100000)
    const concurrent = await issueVoucher(db, { ...input, amount: 100, requestId: randomUUID() })
    const results = await Promise.allSettled([
      db.$transaction(tx => redeemVoucher(tx, concurrent.code, 8000, 'concurrent-1')),
      db.$transaction(tx => redeemVoucher(tx, concurrent.code, 8000, 'concurrent-2')),
    ])
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.equal((await findVoucher(db, concurrent.code)).balanceCents, 2000)
    console.log('PASS: issuance retry, partial spend, overspend, transaction rollback, concurrent spending, refund and double refund')
    await db.$disconnect()

    // Mount actual API routers against the isolated database (no running store API).
    const express = (await import('express')).default
    const runtime = await import('../src/server/db')
    runtimeDb = runtime.prisma
    await runtime.databaseReady
    const { salesRouter } = await import('../src/server/routes/sales')
    const { giftVouchersRouter } = await import('../src/server/routes/giftVouchers')
    const app = express(); app.use(express.json()); app.use('/sales', salesRouter); app.use('/vouchers', giftVouchersRouter)
    const preview = process.argv.includes('--preview')
    if (preview) {
      const { productRouter } = await import('../src/server/routes/products')
      app.use('/api/products', productRouter)
      app.use('/api/sales', salesRouter)
      app.use('/api/gift-vouchers', giftVouchersRouter)
      app.get('/api/license/status', (_req, res) => { res.json({ isLicensed: true }) })
      app.get('/api/health', (_req, res) => { res.json({ localIp: '127.0.0.1' }) })
      app.get('/api/music/status', (_req, res) => { res.json({ isPlaying: false, volume: 50, playlists: [] }) })
      app.post('/api/customer-display/state', (_req, res) => { res.json({ success: true }) })
      app.use(express.static(path.resolve('dist')))
    }
    server = app.listen(preview ? 3782 : 0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    const address = server.address() as import('node:net').AddressInfo
    const base = `http://127.0.0.1:${address.port}`
    const post = async (url: string, body: any) => {
      const res = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      return { status: res.status, data: await res.json() as any }
    }
    assert.equal((await post('/vouchers', { ...input, requestId: randomUUID(), paymentMethod: 'COMPLIMENTARY' })).status, 401)
    const stats = async (query = '') => {
      const response = await fetch(base + '/sales/stats' + query)
      const data = await response.json() as any
      assert.equal(response.status, 200, JSON.stringify(data))
      assert.equal(Math.round(data.netRevenue * 100), Math.round((data.netCash + data.netCard) * 100), 'Net revenue must equal cash plus card collections')
      assert.equal(Math.round(data.netRevenue * 100), Math.round((data.grossRevenue - data.totalRefund) * 100))
      return data
    }
    const beforeIssue = await stats()
    const issueInput = { ...input, amount: 300, requestId: randomUUID(), paymentMethod: 'CARD' }
    const issued = await post('/vouchers', issueInput)
    assert.equal(issued.status, 201)
    const afterIssue = await stats()
    assert.equal(afterIssue.netRevenue, beforeIssue.netRevenue + 300)
    assert.equal(afterIssue.netCard, beforeIssue.netCard + 300)
    assert.equal(afterIssue.netCash, beforeIssue.netCash)
    assert.equal(afterIssue.netItemsSold, beforeIssue.netItemsSold, 'Issuance is not a product sale')
    assert.equal((await post('/vouchers', issueInput)).data.code, issued.data.code)
    assert.equal((await stats()).netRevenue, afterIssue.netRevenue, 'Repeated issuance must count once')
    const payload = { items: [{ variantId: 'variant', quantity: 2, unitPrice: 250, totalPrice: 500 }], totalAmount: 500, discountAmount: 0, paymentType: { cash: 100, card: 100, giftVoucher: { code: issued.data.code, amount: 300, requestId: randomUUID() } } }
    const sale = await post('/sales', payload)
    assert.equal(sale.status, 201, JSON.stringify(sale.data))
    assert.equal(sale.data.paymentType.giftVoucher.balance, 0)
    const afterSale = await stats()
    assert.equal(afterSale.netRevenue, afterIssue.netRevenue + 200, 'Only extra cash/card at redemption counts')
    assert.equal(afterSale.netCash, afterIssue.netCash + 100)
    assert.equal(afterSale.netCard, afterIssue.netCard + 100)
    const replay = await post('/sales', payload)
    assert.equal(replay.data.id, sale.data.id, 'Retry must not create second sale')
    assert.equal((await stats()).netRevenue, afterSale.netRevenue)
    assert.equal((await runtimeDb.productVariant.findUniqueOrThrow({ where: { id: 'variant' } })).stockQuantity, 28)
    const failedSale = await post('/sales', { ...payload, paymentType: { ...payload.paymentType, giftVoucher: { ...payload.paymentType.giftVoucher, requestId: randomUUID() } } })
    assert.equal(failedSale.status, 400)
    assert.equal((await runtimeDb.productVariant.findUniqueOrThrow({ where: { id: 'variant' } })).stockQuantity, 28)
    const returned = await post(`/sales/${sale.data.id}/return`, { items: [{ saleItemId: sale.data.items[0].id, returnQuantity: 1 }], refundMethod: 'CASH' })
    assert.equal(returned.status, 200, JSON.stringify(returned.data))
    assert.equal(returned.data.paymentType.refundGiftVoucher, 150)
    const afterPartialReturn = await stats()
    assert.equal(afterPartialReturn.netRevenue, afterSale.netRevenue - 100, 'Voucher refund is restored balance, not cash outflow')
    assert.equal(afterPartialReturn.netCash, afterSale.netCash - 50)
    assert.equal(afterPartialReturn.netCard, afterSale.netCard - 50)
    assert.equal((await findVoucher(runtimeDb, issued.data.code)).balanceCents, 15000)
    const returnedAll = await post(`/sales/${sale.data.id}/return`, { items: [{ saleItemId: sale.data.items[0].id, returnQuantity: 1 }] })
    assert.equal(returnedAll.status, 200)
    assert.equal(returnedAll.data.paymentType.refundGiftVoucher, 300)
    assert.equal((await stats()).netRevenue, afterIssue.netRevenue, 'Full return reverses only the extra payment')
    assert.equal((await findVoucher(runtimeDb, issued.data.code)).balanceCents, 30000)
    assert.equal((await runtimeDb.productVariant.findUniqueOrThrow({ where: { id: 'variant' } })).stockQuantity, 30)
    assert.equal((await post(`/sales/${sale.data.id}/return`, { items: [{ saleItemId: sale.data.items[0].id, returnQuantity: 1 }] })).status, 400)
    // Existing cash/card checkout still works.
    const ordinary = await post('/sales', { ...payload, totalAmount: 500, paymentType: { cash: 0, card: 500 } })
    assert.equal(ordinary.status, 201)
    const stringPayment = await post('/sales', { ...payload, paymentType: JSON.stringify({ cash: 200, card: 0, giftVoucher: { code: issued.data.code, amount: 300, requestId: randomUUID() } }) })
    assert.equal(stringPayment.status, 201)
    assert.equal((await findVoucher(runtimeDb, issued.data.code)).balanceCents, 0)
    const invalid = await post('/sales', { ...payload, paymentType: { cash: 0, card: 0, giftVoucher: { code: issued.data.code, amount: 300, requestId: randomUUID() } } })
    assert.equal(invalid.status, 400)
    const beforeComplimentary = await stats()
    const complimentary = await issueVoucher(runtimeDb, { amount: 500, paymentMethod: 'COMPLIMENTARY', cashierName: 'Test', requestId: randomUUID() })
    assert.equal((await stats()).netRevenue, beforeComplimentary.netRevenue)
    const freeSale = await post('/sales', { ...payload, paymentType: { cash: 0, card: 0, giftVoucher: { code: complimentary.code, amount: 500, requestId: randomUUID() } } })
    assert.equal(freeSale.status, 201)
    assert.equal((await stats()).netRevenue, beforeComplimentary.netRevenue, 'Free voucher redemption does not create a collection')
    const freeReturn = await post('/sales/' + freeSale.data.id + '/return', { items: [{ saleItemId: freeSale.data.items[0].id, returnQuantity: 2 }] })
    assert.equal(freeReturn.status, 200)
    assert.equal((await stats()).netRevenue, beforeComplimentary.netRevenue, 'Voucher-only refund does not reduce cash revenue')
    const partialPaid = await post('/sales', { items: [{ variantId: 'variant', quantity: 1, unitPrice: 250, totalPrice: 250 }], totalAmount: 250, paymentType: { cash: 0, card: 0, giftVoucher: { code: voucher.code, amount: 250, requestId: randomUUID() } } })
    assert.equal(partialPaid.status, 201)
    assert.equal((await stats()).netRevenue, beforeComplimentary.netRevenue, 'Partial spend of paid voucher is not counted again')
    assert.equal((await findVoucher(runtimeDb, voucher.code)).balanceCents, 75000)

    const beforeDiscount = await stats()
    const discountedSale = await post('/sales', { ...payload, totalAmount: 400, discountAmount: 100, paymentType: { cash: 100, card: 0, giftVoucher: { code: voucher.code, amount: 300, requestId: randomUUID() } } })
    assert.equal(discountedSale.status, 201)
    assert.equal((await stats()).netRevenue, beforeDiscount.netRevenue + 100)
    const discountReturn = await post('/sales/' + discountedSale.data.id + '/return', { items: [{ saleItemId: discountedSale.data.items[0].id, returnQuantity: 1 }] })
    assert.equal(discountReturn.status, 200)
    assert.equal(discountReturn.data.paymentType.refundGiftVoucher, 150)
    assert.equal((await stats()).netRevenue, beforeDiscount.netRevenue + 50)
    assert.equal((await post('/sales/' + discountedSale.data.id + '/return', { items: [{ saleItemId: discountedSale.data.items[0].id, returnQuantity: 1 }] })).status, 200)
    assert.equal((await stats()).netRevenue, beforeDiscount.netRevenue)
    await runtimeDb.sale.create({ data: { receiptNo: 'CANCELLED-REPORT', cashierName: 'CANCELLED-REPORT', totalAmount: 100, paymentType: 'CASH', status: 'CANCELLED' } })
    const cancelled = await stats('?search=CANCELLED-REPORT')
    assert.equal(cancelled.netRevenue, 0)
    assert.equal(cancelled.grossRevenue, 0)
    assert.equal(cancelled.netItemsSold, 0)

    const datedCash = await issueVoucher(runtimeDb, { amount: '123,45', paymentMethod: 'CASH', cashierName: 'DATE-COLLECTION', requestId: randomUUID() })
    const datedCard = await issueVoucher(runtimeDb, { amount: 50, paymentMethod: 'CARD', cashierName: 'DATE-COLLECTION', requestId: randomUUID() })
    const datedFree = await issueVoucher(runtimeDb, { amount: 999, paymentMethod: 'COMPLIMENTARY', cashierName: 'DATE-COLLECTION', requestId: randomUUID() })
    for (const v of [datedCash, datedCard, datedFree]) await runtimeDb.$executeRaw`UPDATE "GiftVoucher" SET createdAt = ${'2020-01-01T21:30:00.000Z'} WHERE id = ${v.id}`
    const dateQuery = '?startDate=' + encodeURIComponent('2020-01-02T00:00:00+03:00') + '&endDate=' + encodeURIComponent('2020-01-02T23:59:59+03:00')
    const dated = await stats(dateQuery)
    assert.equal(dated.netRevenue, 173.45)
    assert.equal(dated.netCash, 123.45)
    assert.equal(dated.netCard, 50)
    assert.equal(dated.voucherIssueCount, 2)
    assert.equal(dated.netItemsSold, 0)
    assert.equal((await stats(dateQuery + '&payment=CASH')).netRevenue, 123.45)
    assert.equal((await stats(dateQuery + '&payment=CARD')).netRevenue, 50)
    assert.equal((await stats(dateQuery + '&search=DOES-NOT-MATCH')).netRevenue, 0)
    assert.equal((await stats(dateQuery + '&search=' + datedCash.code)).netRevenue, 123.45)
    const beforeDate = await stats('?endDate=' + encodeURIComponent('2020-01-01T23:59:59+03:00'))
    assert.equal(beforeDate.netRevenue, 0, 'Voucher issuance belongs to its own date, not redemption date')

    await runtimeDb.$transaction(Array.from({ length: 25 }, (_, i) => runtimeDb!.sale.create({ data: { receiptNo: 'COLLECTION-LIMIT-' + i, cashierName: 'COLLECTION-LIMIT', totalAmount: 1, paymentType: JSON.stringify({ cash: 0.4, card: 0.6 }) } })))
    await issueVoucher(runtimeDb, { amount: 10, paymentMethod: 'CASH', cashierName: 'COLLECTION-LIMIT', requestId: randomUUID() })
    const limitedQuery = '?search=COLLECTION-LIMIT'
    const limited = await stats(limitedQuery)
    assert.equal(limited.netRevenue, 35)
    assert.equal(limited.netCash, 20)
    assert.equal(limited.netCard, 15)
    assert.equal((await stats(limitedQuery + '&payment=CASH')).netRevenue, 20)
    assert.equal((await stats(limitedQuery + '&payment=CARD')).netRevenue, 15)
    const limitedList = await fetch(base + '/sales' + limitedQuery + '&payment=CASH&limit=20').then(r => r.json()) as any[]
    assert.equal(limitedList.length, 20, 'Payment filtering must include mixed payments before the display limit')
    console.log('PASS: voucher issue collections, no double counting, mixed payment differences, voucher-only/partial/full refunds, discounted returns, complimentary/cancelled transactions, date/timezone/search/payment filters, full totals beyond display limit')
    console.log('PASS: actual API mixed payment, checkout retry, insufficient funds rollback, partial/full returns, legacy card sale')

    const receipt = normalizeSaleToReceiptData(sale.data, { receiptPrintMode: 'HTML' })
    assert.ok(generateReceiptHtml(receipt).includes('Çek kalan: 0.00 TL'))
    assert.ok(Buffer.from(generateEscposReceipt(receipt)).toString('ascii').includes('Cek Kalan Bakiye'))
    const voucherReceipt = { receiptNo: issued.data.code, totalAmount: 300, items: [], storeInfo: { storeName: '<script>alert(1)</script>' }, voucherIssue: issued.data }
    assert.ok(!generateReceiptHtml(voucherReceipt).includes('<script>'))
    assert.ok(generateReceiptHtml(voucherReceipt).includes('HEDİYE ÇEKİ'))
    assert.ok(Buffer.from(generateEscposReceipt(voucherReceipt)).toString('ascii').includes(issued.data.code))
    console.log('PASS: HTML and ESC/POS voucher receipts, balance printing, HTML escaping')
    console.log('All gift voucher checks passed. Store databases were not used.')
    if (preview) {
      console.log('Isolated preview: http://127.0.0.1:3782 (test database only; Ctrl+C removes it)')
      await new Promise<void>(resolve => process.once('SIGINT', resolve))
    }
  } finally {
    if (server) await new Promise<void>(resolve => server.close(() => resolve()))
    await db.$disconnect()
    await runtimeDb?.$disconnect()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
main().catch(err => { console.error(err); process.exitCode = 1 })
