import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { execFileSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

test('backup upload replaces a populated database without resetting and stops safely on failures', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magazapos-restore-test-'))
  process.env.MAGAZAPOS_USER_DATA = dir
  const livePath = path.join(dir, 'magazapos.db')
  const incomingPath = path.join(dir, 'incoming.db')
  const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { encoding: 'utf8' })
  const tables = ['Category', 'Customer', 'Product', 'ProductVariant', 'Sale', 'SaleItem', 'StockMovement', 'GiftVoucher', 'GiftVoucherMovement', 'SaleReturn']
  const snapshot = async (client: PrismaClient) => Promise.all(tables.map(table => client.$queryRawUnsafe(`SELECT * FROM "${table}" ORDER BY id`)))
  const readFile = async (file: string) => {
    const client = new PrismaClient({ datasources: { db: { url: `file:${file}` } } })
    try { return await snapshot(client) } finally { await client.$disconnect() }
  }
  for (const [file, label, amount] of [[livePath, 'LIVE', 1000], [incomingPath, 'IMPORTED', 2024.10]] as const) {
    const client = new PrismaClient({ datasources: { db: { url: `file:${file}` } } })
    try {
      for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await client.$executeRawUnsafe(statement)
      await client.category.create({ data: { id: label, name: label } })
      await client.product.create({ data: { id: label, code: label, name: label, categoryId: label } })
      await client.productVariant.create({ data: { id: label, productId: label, sku: label, barcode: label, attributes: '{}', salePrice: amount, stockQuantity: 8 } })
      await client.customer.create({ data: { id: label, firstName: label, lastName: 'TEST', phone: label, city: 'TEST', district: 'TEST' } })
      await client.sale.create({ data: { id: label, receiptNo: label, customerId: label, totalAmount: amount, paymentType: JSON.stringify({ cash: 0, card: amount }), items: { create: { id: label, variantId: label, quantity: 1, unitPrice: amount, totalPrice: amount } } } })
      await client.stockMovement.create({ data: { id: label, variantId: label, type: 'SALE', quantity: 1, note: label } })
    } finally { await client.$disconnect() }
  }
  fs.mkdirSync(path.join(dir, 'data'))
  fs.writeFileSync(path.join(dir, 'data', 'security.json'), JSON.stringify({ pin: '1234', adminPin: '654321' }))
  const incomingRows = await readFile(incomingPath)
  const payload = fs.readFileSync(incomingPath)
  const runtime = await import('../src/server/db')
  await runtime.databaseReady
  const { systemRouter } = await import('../src/server/routes/system')
  const express = (await import('express')).default
  const app = express(); app.use(express.json()); app.use('/api/system', systemRouter)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const url = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/api/system/restore-db`
  const upload = async (bytes = payload, filename = 'backup.db', pin = '654321') => {
    const form = new FormData()
    form.append('dbFile', new Blob([bytes]), filename)
    form.append('adminPin', pin)
    const response = await fetch(url, { method: 'POST', headers: { 'X-Admin-Pin': pin }, body: form })
    return { status: response.status, data: await response.json() as any }
  }
  try {
    await t.test('wrong admin PIN and invalid files preserve every existing row', async () => {
      const before = await snapshot(runtime.prisma)
      assert.equal((await upload(payload, 'backup.db', '111111')).status, 401)
      assert.equal((await upload(payload, 'backup.txt')).status, 400)
      const invalid = await upload(Buffer.alloc(25000), 'broken.db')
      assert.equal(invalid.status, 500)
      assert.deepEqual(await snapshot(runtime.prisma), before)
    })
    await t.test('a failed safety backup prevents replacement and leaves the database usable', async () => {
      const before = await snapshot(runtime.prisma)
      const backups = path.join(dir, 'backups')
      assert.equal(fs.existsSync(backups), false)
      fs.writeFileSync(backups, 'Backup directory unavailable')
      try {
        const result = await upload()
        assert.equal(result.status, 500)
        assert.match(result.data.error, /Güvenlik yedeği alınamadı/)
        assert.deepEqual(await snapshot(runtime.prisma), before)
      } finally { fs.unlinkSync(backups) }
    })
    await t.test('an unreadable backup cannot be used to roll back an untouched live database', async () => {
      const before = await snapshot(runtime.prisma)
      const execute = runtime.prisma.$executeRawUnsafe.bind(runtime.prisma)
      const copy = fs.copyFileSync.bind(fs)
      const executeMock = mock.method(runtime.prisma, '$executeRawUnsafe', (query: string, ...args: any[]) => {
        if (query.startsWith('VACUUM INTO') && query.includes('safety_before_restore')) throw new Error('Simulated VACUUM failure')
        return execute(query, ...args)
      })
      const copyMock = mock.method(fs, 'copyFileSync', (source: fs.PathLike, destination: fs.PathLike, mode?: number) => {
        if (String(destination).includes('safety_before_restore')) { fs.writeFileSync(destination, Buffer.alloc(25000)); return }
        return copy(source, destination, mode)
      })
      try {
        assert.equal((await upload()).status, 500)
        assert.deepEqual(await snapshot(runtime.prisma), before)
      } finally { executeMock.mock.restore(); copyMock.mock.restore() }
    })
    await t.test('a partially failed file replacement restores the verified safety backup', async () => {
      const before = await snapshot(runtime.prisma)
      const copy = fs.copyFileSync.bind(fs)
      const copyMock = mock.method(fs, 'copyFileSync', (source: fs.PathLike, destination: fs.PathLike, mode?: number) => {
        if (String(source).includes('staging_restore_') && String(destination) === livePath) {
          fs.writeFileSync(destination, Buffer.alloc(25000))
          throw new Error('Simulated partial restore write')
        }
        return copy(source, destination, mode)
      })
      try {
        const result = await upload()
        assert.equal(result.status, 500)
        assert.match(result.data.error, /Eski veritabanı geri yüklendi/)
        assert.deepEqual(await snapshot(runtime.prisma), before)
      } finally { copyMock.mock.restore() }
    })
    await t.test('the same multipart request as the settings screen restores without any reset call', async () => {
      const before = await snapshot(runtime.prisma)
      const result = await upload()
      assert.equal(result.status, 200, JSON.stringify(result.data))
      assert.equal(result.data.success, true)
      assert.equal(result.data.details.sales, 1)
      assert.equal(result.data.details.products, 1)
      assert.equal(result.data.needsRestart, false)
      assert.deepEqual(await snapshot(runtime.prisma), incomingRows)
      const backups = fs.readdirSync(path.join(dir, 'backups')).filter(file => file.includes('safety_before_restore'))
      assert(backups.length > 0)
      assert.deepEqual(await readFile(path.join(dir, 'backups', backups.at(-1)!)), before)
      assert.equal((await runtime.prisma.sale.findUniqueOrThrow({ where: { id: 'IMPORTED' } })).totalAmount, 2024.10)
    })
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    await runtime.prisma.$disconnect()
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
