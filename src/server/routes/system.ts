import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { prisma } from '../db'
import { requirePinAuth, requireAdminPinAuth, setSystemPin, getSystemPin, getAdminPin, setAdminPin } from '../utils/security'

export const systemRouter = Router()

// ─── Kasa PIN (4 haneli) ───────────────────────────────────────

// POST /api/system/update-pin: Update PIN stored on server
systemRouter.post('/update-pin', (req, res) => {
  const { pinCode } = req.body
  if (!pinCode || pinCode.length !== 4 || !/^\d{4}$/.test(pinCode)) {
    res.status(400).json({ error: 'PIN şifresi tam 4 haneli rakam olmalıdır.' })
    return
  }

  const success = setSystemPin(pinCode)
  if (success) {
    res.json({ success: true, message: 'Sistem PIN şifresi güncellendi.' })
  } else {
    res.status(500).json({ error: 'PIN şifresi güncellenirken sunucu hatası oluştu.' })
  }
})

// POST /api/system/verify-pin: Check if provided PIN is correct
systemRouter.post('/verify-pin', (req, res) => {
  const { pinCode } = req.body
  const currentPin = getSystemPin()
  if (pinCode === currentPin) {
    res.json({ success: true })
  } else {
    res.status(401).json({ success: false, error: 'Hatalı PIN Şifresi' })
  }
})

// ─── Yönetici PIN (6 haneli) ───────────────────────────────────

// POST /api/system/verify-admin-pin: Check if provided admin PIN is correct
systemRouter.post('/verify-admin-pin', (req, res) => {
  const { adminPin } = req.body
  const currentAdminPin = getAdminPin()
  if (adminPin === currentAdminPin) {
    res.json({ success: true })
  } else {
    res.status(401).json({ success: false, error: 'Hatalı Yönetici PIN Şifresi' })
  }
})

// POST /api/system/update-admin-pin: Update admin PIN (requires current admin PIN)
systemRouter.post('/update-admin-pin', requireAdminPinAuth, (req, res) => {
  const { newAdminPin } = req.body
  if (!newAdminPin || newAdminPin.length !== 6 || !/^\d{6}$/.test(newAdminPin)) {
    res.status(400).json({ error: 'Yönetici PIN şifresi tam 6 haneli rakam olmalıdır.' })
    return
  }

  const success = setAdminPin(newAdminPin)
  if (success) {
    res.json({ success: true, message: 'Yönetici PIN şifresi güncellendi.' })
  } else {
    res.status(500).json({ error: 'Yönetici PIN güncellenirken sunucu hatası oluştu.' })
  }
})

// ─── Korumalı Tehlikeli İşlemler (Yönetici PIN Gerekli) ────────

// Protected Route: POST /api/system/reset-sales: Only clear sales history (keep stock & products)
systemRouter.post('/reset-sales', requireAdminPinAuth, async (req, res) => {
  try {
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    res.json({ success: true, message: 'Tüm satış geçmişi başarıyla sıfırlandı.' })
  } catch (err: any) {
    console.error('Reset sales error:', err)
    res.status(500).json({ error: 'Satış geçmişi sıfırlanırken hata oluştu: ' + err.message })
  }
})

// Protected Route: POST /api/system/reset-all: Clear sales, stock movements, products, and categories (Full Reset)
systemRouter.post('/reset-all', requireAdminPinAuth, async (req, res) => {
  try {
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    await prisma.stockMovement.deleteMany()
    await prisma.productVariant.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    res.json({ success: true, message: 'Tüm veritabanı tamamen sıfırlandı.' })
  } catch (err: any) {
    console.error('Reset all error:', err)
    res.status(500).json({ error: 'Veritabanı sıfırlanırken hata oluştu: ' + err.message })
  }
})

// Protected Route: GET /api/system/backup-db: Download SQLite database file
systemRouter.get('/backup-db', requirePinAuth, (req, res): void => {
  try {
    const possibleDbPaths = [
      path.resolve(process.cwd(), 'prisma/dev.db'),
      path.resolve(__dirname, '../../../prisma/dev.db'),
      path.resolve(__dirname, '../../prisma/dev.db'),
    ]

    const dbPath = possibleDbPaths.find((p) => fs.existsSync(p)) || possibleDbPaths[0]

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
