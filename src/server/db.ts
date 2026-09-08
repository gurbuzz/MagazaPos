import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import { getUserDataDir } from './utils/paths'

// Windows dosya yollarını SQLite URI formatına dönüştürür (ters eğik çizgi '\\' yerine '/')
// Windows'ta 'file:C:\\...' kullanımı SQLite Error Code 14 (SQLITE_CANTOPEN) hatasına yol açar!
export function toSqliteUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.startsWith('file:') ? normalized : `file:${normalized}`
}

// Veritabanının dolu ve tablolarının mevcut olduğunu doğrular (boş veya 0-byte SQLite dosyalarını eler)
function isDatabaseValid(filePath: string): boolean {
  try {
    if (!fs.existsSync(filePath)) return false
    const stat = fs.statSync(filePath)
    // Şema ve başlangıç verileriyle dolu bir MagazaPOS veritabanı ~108 KB'dir.
    // 20 KB'den küçükse tablolar eksik veya boştur.
    if (stat.size < 20480) return false
    return true
  } catch {
    return false
  }
}

function initializeDatabaseFile(): string {
  const userDataDir = getUserDataDir()
  const targetDbPath = path.join(userDataDir, 'magazapos.db')

  // Eğer AppData içindeki kalıcı veritabanı zaten varsa ve geçerliyse doğrudan onu kullan
  if (isDatabaseValid(targetDbPath)) {
    console.log(`[DB] Mevcut kalıcı veritabanı kullanılıyor: ${targetDbPath}`)
    return toSqliteUrl(targetDbPath)
  }

  // İlk çalıştırma veya eksik/bozuk veritabanı: Paketlenmiş veya yerel hazır/örnek veritabanını ara
  const candidateSeedDbs = [
    path.join((process as any).resourcesPath || '', 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'resources', 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'dev.db'),
    path.resolve(__dirname, '..', '..', '..', 'prisma', 'dev.db'),
    path.resolve(__dirname, '..', '..', 'prisma', 'dev.db'),
  ]

  const foundSeed = candidateSeedDbs.find((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).size > 20480
    } catch {
      return false
    }
  })

  if (foundSeed) {
    try {
      const targetDir = path.dirname(targetDbPath)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }
      fs.copyFileSync(foundSeed, targetDbPath)
      console.log(`[DB] Hazır veritabanı AppData konumuna başarıyla kopyalandı:\n  Kaynak: ${foundSeed}\n  Hedef: ${targetDbPath}`)
      return toSqliteUrl(targetDbPath)
    } catch (err) {
      console.error('[DB] Hazır veritabanı kopyalanırken hata, doğrudan kaynak kullanılacak:', err)
      return toSqliteUrl(foundSeed)
    }
  }

  // Geliştirme modu fallback (eğer hiçbir veritabanı bulunamazsa)
  const defaultLocalDb = path.resolve(process.cwd(), 'prisma/dev.db')
  const dir = path.dirname(defaultLocalDb)
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e) {}
  }

  return toSqliteUrl(defaultLocalDb)
}

function configurePrismaEngine() {
  const isWindows = process.platform === 'win32'
  const engineFileName = isWindows ? 'query_engine-windows.dll.node' : 'libquery_engine-debian-openssl-3.0.x.so.node'

  const candidateEnginePaths = [
    // Unpacked asar paths in Electron production (resources/app.asar.unpacked/...)
    path.join((process as any).resourcesPath || '', 'app.asar.unpacked', 'node_modules', '.prisma', 'client', engineFileName),
    path.join((process as any).resourcesPath || '', 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(__dirname, '..', '..', '..', 'app.asar.unpacked', 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(__dirname, '..', '..', 'app.asar.unpacked', 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(process.cwd(), 'resources', 'app.asar.unpacked', 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(process.cwd(), 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(__dirname, '..', '..', 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(__dirname, '..', '..', '..', 'node_modules', '.prisma', 'client', engineFileName),
  ]

  const found = candidateEnginePaths.find((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).size > 0
    } catch {
      return false
    }
  })

  if (found) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = found
    console.log('[DB] PRISMA_QUERY_ENGINE_LIBRARY configured:', found)
  }
}

configurePrismaEngine()
const dbUrl = initializeDatabaseFile()
process.env.DATABASE_URL = dbUrl

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

// Sadece geliştirme ortamında (npx mevcutken) eksik tablo varsa şemayı oluştur
async function ensureDevDatabaseSchema() {
  // Paketli prod ortamında npx çalıştırmayı deneme (npx yoktur)
  const isPackaged = !process.env.VITE_DEV_SERVER_URL && process.env.NODE_ENV === 'production'
  if (isPackaged) {
    return
  }

  try {
    const tables: any[] = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Category';"
    )
    if (!tables || tables.length === 0) {
      console.log('[DB-DEV] Veritabanı tabloları bulunamadı. Şema dev modunda oluşturuluyor...')

      const schemaPath = [
        path.resolve(process.cwd(), 'prisma/schema.prisma'),
        path.resolve(__dirname, '../../prisma/schema.prisma'),
      ].find((p) => fs.existsSync(p))

      if (schemaPath) {
        try {
          execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
            stdio: 'pipe',
            env: { ...process.env, DATABASE_URL: dbUrl },
          })
          console.log('[DB-DEV] Veritabanı şeması oluşturuldu.')

          const seedPath = [
            path.resolve(process.cwd(), 'prisma/seed.ts'),
            path.resolve(__dirname, '../../prisma/seed.ts'),
          ].find((p) => fs.existsSync(p))

          if (seedPath) {
            execSync(`npx tsx "${seedPath}"`, {
              stdio: 'pipe',
              env: { ...process.env, DATABASE_URL: dbUrl },
            })
            console.log('[DB-DEV] Başlangıç verileri yüklendi.')
          }
        } catch (e) {
          console.warn('[DB-DEV] Şema oluşturma uyarısı:', e)
        }
      }
    }
  } catch (err) {
    console.warn('[DB-DEV] Tablo kontrolü:', err)
  }
}

// Configure SQLite WAL mode & busy timeout for concurrent read/write operations
export async function initDbPragmas() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
    console.log(`[DB] SQLite WAL modu ve busy_timeout (5000ms) aktifleştirildi. [${dbUrl}]`)

    await ensureDevDatabaseSchema()
  } catch (err) {
    console.error('[DB] PRAGMA ayarları uygulanırken hata:', err)
  }
}

initDbPragmas()
