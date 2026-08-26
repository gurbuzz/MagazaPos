import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

export const systemRouter = Router()
const prisma = new PrismaClient()

// POST /api/system/reset-sales: Only clear sales history (keep stock & products)
systemRouter.post('/reset-sales', async (req, res) => {
  try {
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    res.json({ success: true, message: 'Tüm satış geçmişi sıfırlandı.' })
  } catch (err: any) {
    console.error('Reset sales error:', err)
    res.status(500).json({ error: 'Satış geçmişi sıfırlanırken hata oluştu: ' + err.message })
  }
})

// POST /api/system/reset-all: Clear sales, products, and categories (Full Database Reset)
systemRouter.post('/reset-all', async (req, res) => {
  try {
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    await prisma.productVariant.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    res.json({ success: true, message: 'Tüm veritabanı tamamen sıfırlandı.' })
  } catch (err: any) {
    console.error('Reset all error:', err)
    res.status(500).json({ error: 'Veritabanı sıfırlanırken hata oluştu: ' + err.message })
  }
})

// GET /api/system/backup-db: Download SQLite database file
systemRouter.get('/backup-db', (req, res): void => {
  try {
    const dbPath = path.resolve(__dirname, '../../../prisma/dev.db')
    if (!fs.existsSync(dbPath)) {
      res.status(404).json({ error: 'Veritabanı dosyası bulunamadı.' })
      return
    }

    const filename = `magazapos_yedek_${new Date().toISOString().slice(0, 10)}.db`
    res.download(dbPath, filename)
  } catch (err: any) {
    console.error('Backup DB error:', err)
    res.status(500).json({ error: 'Yedekleme indirilirken hata oluştu: ' + err.message })
  }
})
