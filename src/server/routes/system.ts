import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { prisma } from '../db'
import { requirePinAuth, requireAdminPinAuth, setSystemPin, getSystemPin, getAdminPin, setAdminPin } from '../utils/security'
import { getUserDataDir } from '../utils/paths'

export const systemRouter = Router()

// Multer configuration for DB file upload (restore)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') {
      cb(null, true)
    } else {
      cb(new Error('Sadece .db, .sqlite veya .sqlite3 dosyaları yüklenebilir.'))
    }
  },
})

import {
  createDatabaseBackup,
  restoreDatabase,
  createAutoSafetyBackup,
  getDatabaseInfo,
} from '../utils/databaseBackup'

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
    await createAutoSafetyBackup('before_reset_sales')
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    res.json({ success: true, message: 'Tüm satış geçmişi başarıyla sıfırlandı. (Otomatik güvenlik yedeği alındı)' })
  } catch (err: any) {
    console.error('Reset sales error:', err)
    res.status(500).json({ error: 'Satış geçmişi sıfırlanırken hata oluştu: ' + err.message })
  }
})

// Protected Route: POST /api/system/reset-all: Clear sales, stock movements, products, categories, and customers (Full Reset)
systemRouter.post('/reset-all', requireAdminPinAuth, async (req, res) => {
  try {
    await createAutoSafetyBackup('before_reset_all')
    await prisma.saleItem.deleteMany()
    await prisma.sale.deleteMany()
    await prisma.customer.deleteMany()
    await prisma.stockMovement.deleteMany()
    await prisma.productVariant.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    res.json({ success: true, message: 'Tüm veritabanı (satışlar, stoklar, ürünler ve müşteriler) tamamen sıfırlandı. (Otomatik güvenlik yedeği alındı)' })
  } catch (err: any) {
    console.error('Reset all error:', err)
    res.status(500).json({ error: 'Veritabanı sıfırlanırken hata oluştu: ' + err.message })
  }
})

// Protected Route: GET /api/system/backup-db: Download SQLite database file (Atomic VACUUM / Checkpointed)
systemRouter.get('/backup-db', requirePinAuth, async (req, res): Promise<void> => {
  let tempBackupPath: string | null = null
  try {
    tempBackupPath = await createDatabaseBackup()
    const stat = fs.statSync(tempBackupPath)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `magazapos_yedek_${timestamp}.db`

    console.log(`[Backup] Veritabanı yedeği gönderiliyor: ${filename} (${stat.size} bytes)`)

    res.setHeader('Content-Type', 'application/x-sqlite3')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', stat.size)

    res.download(tempBackupPath, filename, (downloadErr) => {
      if (downloadErr) {
        console.warn('[Backup] İndirme akışı kesildi veya hata:', downloadErr?.message)
      }
      // Geçici dışa aktarım dosyasını temizle
      if (tempBackupPath && fs.existsSync(tempBackupPath)) {
        try { fs.unlinkSync(tempBackupPath) } catch {}
      }
    })
  } catch (err: any) {
    if (tempBackupPath && fs.existsSync(tempBackupPath)) {
      try { fs.unlinkSync(tempBackupPath) } catch {}
    }
    console.error('Backup DB error:', err)
    res.status(500).json({ error: 'Yedekleme dosyası oluşturulurken hata: ' + err.message })
  }
})

// Protected Route: POST /api/system/restore-db: Upload and restore a .db backup file with pre-validation and rollback
systemRouter.post('/restore-db', requireAdminPinAuth, (req, res): void => {
  upload.single('dbFile')(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        const msg = uploadErr instanceof multer.MulterError
          ? `Dosya yükleme hatası: ${uploadErr.message}`
          : (uploadErr.message || 'Dosya yükleme hatası.')
        res.status(400).json({ error: msg })
        return
      }

      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'Yüklenecek .db dosyası bulunamadı.' })
        return
      }

      console.log(`[Restore] Yedek geri yükleme isteği alındı (${req.file.buffer.length} bytes)...`)

      // restoreDatabase: 1) Doğrula, 2) Otomatik Güvenlik Yedeği Al, 3) Canlı DB Değiştir, 4) Reconnect & Şema Doğrula
      const result = await restoreDatabase(req.file.buffer)

      res.json({
        success: true,
        message: result.message,
        details: result.details,
        needsRestart: false,
      })
    } catch (err: any) {
      console.error('Restore DB error:', err)
      res.status(500).json({ error: err.message || 'Veritabanı geri yüklenirken hata oluştu.' })
    }
  })
})

// Protected Route: GET /api/system/db-info: Get database statistics & health
systemRouter.get('/db-info', requirePinAuth, async (_req, res): Promise<void> => {
  try {
    const info = await getDatabaseInfo()
    res.json(info)
  } catch (err: any) {
    res.status(500).json({ error: 'Veritabanı durumu alınamadı: ' + err.message })
  }
})
