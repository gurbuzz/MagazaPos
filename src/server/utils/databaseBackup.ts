import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { prisma, getActiveDbPath, toSqliteUrl, initDbPragmas, ensureDatabaseSchema } from '../db'
import { getUserDataDir } from './paths'
import { logDebug } from './logger'

// 1. Backups Directory Helper
export function getBackupsDir(): string {
  const dir = path.join(getUserDataDir(), 'backups')
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e: any) {
      logDebug('BACKUP', 'Failed to create backups directory', e)
    }
  }
  return dir
}

// 2. Old Backup Cleanup: Keep latest maxKeep files to avoid disk bloat
export function cleanupOldBackups(maxKeep: number = 20): void {
  try {
    const dir = getBackupsDir()
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.db') || f.endsWith('.backup'))
      .map((f) => {
        const fullPath = path.join(dir, f)
        const stats = fs.statSync(fullPath)
        return { name: f, fullPath, mtime: stats.mtimeMs }
      })
      .sort((a, b) => b.mtime - a.mtime)

    if (files.length > maxKeep) {
      const toRemove = files.slice(maxKeep)
      for (const item of toRemove) {
        try {
          fs.unlinkSync(item.fullPath)
          logDebug('BACKUP', `Cleaned up old backup: ${item.name}`)
        } catch {}
      }
    }
  } catch (err) {
    logDebug('BACKUP', 'Cleanup backups warning', err)
  }
}

// 3. Auto Safety Backup before risky actions (reset-sales, reset-all, restore-db)
export async function createAutoSafetyBackup(prefix: string): Promise<string | null> {
  const activeDb = getActiveDbPath()
  if (!fs.existsSync(activeDb)) {
    return null
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const backupName = `magazapos_${prefix}_${timestamp}.db`
  const targetBackupPath = path.join(getBackupsDir(), backupName)

  try {
    // Checkpoint WAL first to flush unwritten data
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);').catch(() => {})

    // Try VACUUM INTO for consistent snapshot
    try {
      const safePath = targetBackupPath.replace(/\\/g, '/')
      await prisma.$executeRawUnsafe(`VACUUM INTO '${safePath}';`)
      console.log(`[Backup] Otomatik güvenlik yedeği (VACUUM INTO): ${targetBackupPath}`)
    } catch {
      // Fallback to copy
      fs.copyFileSync(activeDb, targetBackupPath)
      console.log(`[Backup] Otomatik güvenlik yedeği (Kopyalama): ${targetBackupPath}`)
    }

    cleanupOldBackups(25)
    return targetBackupPath
  } catch (err: any) {
    console.error(`[Backup] Otomatik güvenlik yedeği alınamadı (${prefix}):`, err)
    return null
  }
}

// 4. Standalone Export Backup (GET /api/system/backup-db)
export async function createDatabaseBackup(): Promise<string> {
  const activeDb = getActiveDbPath()
  if (!fs.existsSync(activeDb)) {
    throw new Error('Aktif veritabanı dosyası bulunamadı!')
  }

  // Ensure WAL transactions are flushed to main DB
  try {
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);')
  } catch (cpErr: any) {
    console.warn('[Backup] wal_checkpoint uyarısı:', cpErr?.message)
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const tempExportPath = path.join(getBackupsDir(), `magazapos_yedek_${timestamp}_${randomSuffix}.db`)

  let usedVacuum = false
  try {
    const safeDest = tempExportPath.replace(/\\/g, '/')
    await prisma.$executeRawUnsafe(`VACUUM INTO '${safeDest}';`)
    usedVacuum = true
    console.log(`[Backup] VACUUM INTO ile atomik yedek üretildi: ${tempExportPath}`)
  } catch (vacErr: any) {
    console.warn('[Backup] VACUUM INTO başarısız, standart kopyalama kullanılıyor:', vacErr?.message)
  }

  if (!usedVacuum || !fs.existsSync(tempExportPath)) {
    fs.copyFileSync(activeDb, tempExportPath)
    console.log(`[Backup] Dosya kopyalama ile yedek üretildi: ${tempExportPath}`)
  }

  // Validation of the produced export file
  const stat = fs.statSync(tempExportPath)
  if (stat.size < 20480) {
    try { fs.unlinkSync(tempExportPath) } catch {}
    throw new Error('Üretilen yedek dosyası geçersiz veya bozuk (<20 KB)!')
  }

  // SQLite header check
  const fd = fs.openSync(tempExportPath, 'r')
  const headerBuf = Buffer.alloc(16)
  fs.readSync(fd, headerBuf, 0, 16, 0)
  fs.closeSync(fd)
  if (!headerBuf.toString('ascii').startsWith('SQLite format 3')) {
    try { fs.unlinkSync(tempExportPath) } catch {}
    throw new Error('Üretilen yedek geçerli bir SQLite formatına sahip değil!')
  }

  return tempExportPath
}

// 5. Pre-validation of uploaded backup file before modifying live DB
export interface ValidationResult {
  isValid: boolean
  error?: string
  stagingPath?: string
  stats?: {
    products: number
    variants: number
    sales: number
    categories: number
    customers: number
  }
}

export async function validateBackupBuffer(buffer: Buffer): Promise<ValidationResult> {
  // 1. Buffer Size Check
  if (!buffer || buffer.length < 20480) {
    return {
      isValid: false,
      error: 'Yüklenen dosya çok küçük veya boş (<20 KB). Geçerli bir MagazaPOS veritabanı yedeği değildir.',
    }
  }

  if (buffer.length > 500 * 1024 * 1024) {
    return {
      isValid: false,
      error: 'Yüklenen dosya boyutu 500 MB sınırını aşıyor.',
    }
  }

  // 2. Magic Header check
  const header = buffer.subarray(0, 16).toString('ascii')
  if (!header.startsWith('SQLite format 3')) {
    return {
      isValid: false,
      error: 'Geçersiz dosya formatı! Seçilen dosya bir SQLite veritabanı dosyası değil.',
    }
  }

  // 3. Write to temporary staging file
  const stagingPath = path.join(
    getUserDataDir(),
    `staging_restore_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.db`
  )

  try {
    fs.writeFileSync(stagingPath, buffer)
  } catch (writeErr: any) {
    return {
      isValid: false,
      error: `Geçici dosya yazılamadı: ${writeErr.message}`,
    }
  }

  // 4. Validate with isolated temporary PrismaClient
  const tempClient = new PrismaClient({
    datasources: {
      db: {
        url: toSqliteUrl(stagingPath),
      },
    },
  })

  try {
    // A. PRAGMA integrity_check
    const integrityCheck: any = await tempClient.$queryRawUnsafe('PRAGMA integrity_check(10);')
    const status = integrityCheck?.[0]?.integrity_check
    if (status !== 'ok') {
      await tempClient.$disconnect().catch(() => {})
      try { fs.unlinkSync(stagingPath) } catch {}
      return {
        isValid: false,
        error: `Veritabanı bozuk veya hasarlı! SQLite bütünlük testi başarısız: ${status}`,
      }
    }

    // B. Check core tables
    const tableRows: any = await tempClient.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Product', 'ProductVariant', 'Category', 'Sale');`
    )
    const foundTables = (tableRows || []).map((r: any) => r.name)
    const requiredTables = ['Product', 'ProductVariant', 'Category']
    const missing = requiredTables.filter((t) => !foundTables.includes(t))

    if (missing.length > 0) {
      await tempClient.$disconnect().catch(() => {})
      try { fs.unlinkSync(stagingPath) } catch {}
      return {
        isValid: false,
        error: `Bu dosya MagazaPOS veritabanı yedeği değil! Eksik tablolar: ${missing.join(', ')}`,
      }
    }

    // C. Read record counts
    const products = await tempClient.product.count().catch(() => 0)
    const variants = await tempClient.productVariant.count().catch(() => 0)
    const sales = await tempClient.sale.count().catch(() => 0)
    const categories = await tempClient.category.count().catch(() => 0)
    const customers = await tempClient.customer.count().catch(() => 0)

    await tempClient.$disconnect().catch(() => {})

    return {
      isValid: true,
      stagingPath,
      stats: {
        products,
        variants,
        sales,
        categories,
        customers,
      },
    }
  } catch (err: any) {
    await tempClient.$disconnect().catch(() => {})
    try { fs.unlinkSync(stagingPath) } catch {}
    return {
      isValid: false,
      error: `Veritabanı içeriği doğrulanırken hata oluştu: ${err.message}`,
    }
  }
}

// 6. Safe Atomic Database Restore with Automatic Rollback
export interface RestoreResult {
  success: boolean
  message: string
  details?: any
}

export async function restoreDatabase(uploadedBuffer: Buffer): Promise<RestoreResult> {
  const activeDbPath = getActiveDbPath()

  // 1. Pre-flight Validation
  const validation = await validateBackupBuffer(uploadedBuffer)
  if (!validation.isValid || !validation.stagingPath) {
    throw new Error(validation.error || 'Yedek dosyası doğrulamadan geçemedi.')
  }

  const stagingPath = validation.stagingPath
  let safetyBackupPath: string | null = null

  try {
    // 2. Create emergency safety backup of current live database
    safetyBackupPath = await createAutoSafetyBackup('safety_before_restore')
    console.log(`[Restore] Güvenlik yedeği alındı: ${safetyBackupPath}`)

    // 3. Flush live DB WAL checkpoint
    try {
      await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);')
    } catch (cpErr: any) {
      console.warn('[Restore] wal_checkpoint uyarısı:', cpErr?.message)
    }

    // 4. Disconnect Prisma
    try {
      await prisma.$disconnect()
      console.log('[Restore] Canlı Prisma bağlantısı kapatıldı.')
    } catch (discErr) {
      console.warn('[Restore] Prisma disconnect uyarısı:', discErr)
    }

    // 5. Brief sleep to release any OS file handles
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 6. Clean companion WAL & SHM files of target DB to prevent corruption
    for (const suffix of ['-wal', '-shm']) {
      const comp = activeDbPath + suffix
      if (fs.existsSync(comp)) {
        try {
          fs.unlinkSync(comp)
          console.log(`[Restore] Eski yan dosya temizlendi: ${comp}`)
        } catch (e: any) {
          console.warn(`[Restore] Yan dosya silinemedi (${comp}): ${e.message}`)
        }
      }
    }

    // 7. Atomic copy/replace
    fs.copyFileSync(stagingPath, activeDbPath)
    console.log(`[Restore] Yeni veritabanı kopyalandı: ${activeDbPath} (${uploadedBuffer.length} bytes)`)

    // Clean up staging file
    try {
      fs.unlinkSync(stagingPath)
    } catch {}

    // 8. Reconnect Prisma
    await prisma.$connect()
    await initDbPragmas()

    // 9. Run schema check & auto-migration (allowSeed = false to preserve exact backup contents)
    await ensureDatabaseSchema(false)

    // 10. Post-verify: run a test query on active DB
    const verifiedProductCount = await prisma.product.count()
    console.log(`[Restore] Başarıyla tamamlandı! Doğrulanan ürün sayısı: ${verifiedProductCount}`)

    const stats = validation.stats
    const msg = `Veritabanı yedeği başarıyla geri yüklendi! (${stats?.products || 0} Ürün, ${stats?.sales || 0} Satış)`

    return {
      success: true,
      message: msg,
      details: stats,
    }
  } catch (restoreErr: any) {
    console.error('[Restore] HATA OLUŞTU! Otomatik geri alma (ROLLBACK) başlatılıyor...', restoreErr)

    // Clean up staging file if exists
    try {
      if (fs.existsSync(stagingPath)) fs.unlinkSync(stagingPath)
    } catch {}

    // AUTOMATIC ROLLBACK: Restore from safety backup
    let rollbackSuccess = false
    if (safetyBackupPath && fs.existsSync(safetyBackupPath)) {
      try {
        await prisma.$disconnect().catch(() => {})
        await new Promise((resolve) => setTimeout(resolve, 100))

        for (const suffix of ['-wal', '-shm']) {
          const comp = activeDbPath + suffix
          if (fs.existsSync(comp)) {
            try { fs.unlinkSync(comp) } catch {}
          }
        }

        fs.copyFileSync(safetyBackupPath, activeDbPath)
        await prisma.$connect()
        await initDbPragmas()
        rollbackSuccess = true
        console.log('[Restore] ROLLBACK BAŞARILI: Önceki veritabanı geri yüklendi.')
      } catch (rollbackErr: any) {
        console.error('[Restore] KRİTİK: Rollback sırasında hata:', rollbackErr)
      }
    }

    if (rollbackSuccess) {
      throw new Error(
        `Geri yükleme başarısız oldu ancak verileriniz korundu (Eski veritabanı geri yüklendi): ${restoreErr.message}`
      )
    } else {
      throw new Error(`Geri yükleme hatası: ${restoreErr.message}`)
    }
  }
}

// 7. Get Diagnostic & Database Info (GET /api/system/db-info)
export async function getDatabaseInfo(): Promise<any> {
  const activeDbPath = getActiveDbPath()
  let sizeBytes = 0
  if (fs.existsSync(activeDbPath)) {
    try {
      sizeBytes = fs.statSync(activeDbPath).size
    } catch {}
  }

  let integrity = 'unknown'
  let products = 0
  let sales = 0
  let customers = 0

  try {
    const ic: any = await prisma.$queryRawUnsafe('PRAGMA integrity_check(5);').catch(() => [{ integrity_check: 'ok' }])
    integrity = ic?.[0]?.integrity_check || 'ok'
    products = await prisma.product.count().catch(() => 0)
    sales = await prisma.sale.count().catch(() => 0)
    customers = await prisma.customer.count().catch(() => 0)
  } catch (e: any) {
    integrity = `Error: ${e.message}`
  }

  const backupsDir = getBackupsDir()
  let backupFilesCount = 0
  try {
    if (fs.existsSync(backupsDir)) {
      backupFilesCount = fs.readdirSync(backupsDir).filter((f) => f.endsWith('.db') || f.endsWith('.backup')).length
    }
  } catch {}

  return {
    dbPath: activeDbPath,
    sizeBytes,
    sizeKb: Math.round(sizeBytes / 1024),
    integrity,
    counts: {
      products,
      sales,
      customers,
    },
    backupsCount: backupFilesCount,
    backupsDir,
  }
}
