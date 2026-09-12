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

// ─── Helper: Gerçek çalışan veritabanı dosyasının yolunu bul ────
function findActiveDatabasePath(): string | null {
  const userDataDir = getUserDataDir()
  const possiblePaths = [
    path.join(userDataDir, 'magazapos.db'),
    path.resolve(process.cwd(), 'prisma/dev.db'),
    path.resolve(__dirname, '../../../prisma/dev.db'),
    path.resolve(__dirname, '../../prisma/dev.db'),
  ]

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  return null
}

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
    const dbPath = findActiveDatabasePath()

    if (!dbPath) {
      res.status(404).json({ error: 'Veritabanı dosyası bulunamadı.' })
      return
    }

    console.log(`[Backup] Veritabanı yedekleniyor: ${dbPath} (${fs.statSync(dbPath).size} bytes)`)
    const filename = `magazapos_yedek_${new Date().toISOString().slice(0, 10)}.db`
    res.download(dbPath, filename)
  } catch (err: any) {
    console.error('Backup DB error:', err)
    res.status(500).json({ error: 'Yedekleme indirilirken hata oluştu: ' + err.message })
  }
})

// Protected Route: POST /api/system/restore-db: Upload and restore a .db backup file
systemRouter.post('/restore-db', requireAdminPinAuth, (req, res): void => {
  upload.single('dbFile')(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        if (uploadErr instanceof multer.MulterError) {
          res.status(400).json({ error: `Dosya yükleme hatası: ${uploadErr.message}` })
        } else {
          res.status(400).json({ error: uploadErr.message || 'Dosya yükleme hatası.' })
        }
        return
      }

      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: 'Yüklenecek .db dosyası bulunamadı.' })
        return
      }

      const uploadedBuffer = req.file.buffer

      // Validate SQLite header magic: first 16 bytes should start with "SQLite format 3\0"
      const SQLITE_MAGIC = 'SQLite format 3\0'
      const headerStr = uploadedBuffer.slice(0, 16).toString('ascii')
      if (headerStr !== SQLITE_MAGIC) {
        res.status(400).json({ error: 'Geçersiz veritabanı dosyası! Bu dosya geçerli bir SQLite veritabanı değil.' })
        return
      }

      // Find the target DB path
      const userDataDir = getUserDataDir()
      const targetDbPath = path.join(userDataDir, 'magazapos.db')

      // Create backup of current database before replacing
      if (fs.existsSync(targetDbPath)) {
        const backupName = `magazapos_restore_oncesi_${new Date().toISOString().replace(/[:.]/g, '-')}.db.backup`
        const backupPath = path.join(userDataDir, backupName)
        try {
          fs.copyFileSync(targetDbPath, backupPath)
          console.log(`[Restore] Mevcut DB yedeklendi: ${backupPath}`)
        } catch (backupErr: any) {
          console.warn(`[Restore] Mevcut DB yedeklenemedi (devam ediliyor): ${backupErr.message}`)
        }
      }

      // Disconnect Prisma before replacing the file
      try {
        await prisma.$disconnect()
      } catch (disconnectErr) {
        console.warn('[Restore] Prisma disconnect warning:', disconnectErr)
      }

      // Write the uploaded file to the target location
      fs.writeFileSync(targetDbPath, uploadedBuffer)
      console.log(`[Restore] Yeni veritabanı yazıldı: ${targetDbPath} (${uploadedBuffer.length} bytes)`)

      // Reconnect Prisma
      try {
        await prisma.$connect()
        // Re-apply WAL mode and busy timeout
        await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
        await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
        console.log('[Restore] Prisma yeniden bağlandı ve PRAGMA ayarları uygulandı.')
      } catch (reconnectErr: any) {
        console.error('[Restore] Prisma reconnect error:', reconnectErr)
        res.status(500).json({
          error: 'Veritabanı dosyası yüklendi ancak Prisma yeniden bağlanamadı. Uygulamayı yeniden başlatmanız gerekebilir.',
          needsRestart: true,
        })
        return
      }

      res.json({
        success: true,
        message: 'Veritabanı yedeği başarıyla geri yüklendi! Sayfa yeniden yüklenecek.',
        needsRestart: false,
      })
    } catch (err: any) {
      console.error('Restore DB error:', err)
      res.status(500).json({ error: 'Veritabanı geri yüklenirken hata oluştu: ' + err.message })
    }
  })
})
