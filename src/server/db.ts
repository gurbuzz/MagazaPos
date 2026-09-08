import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { getUserDataDir } from './utils/paths'

// Windows dosya yollarını SQLite URI formatına dönüştürür (ters eğik çizgi '\\' yerine '/')
// Windows'ta 'file:C:\\...' kullanımı SQLite Error Code 14 (SQLITE_CANTOPEN) hatasına yol açar!
export function toSqliteUrl(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/')
  if (!normalized.startsWith('file:')) {
    // Windows absolute path starting with drive letter needs triple slash
    if (normalized.match(/^[a-zA-Z]:\//)) {
      normalized = `file:///${normalized}`
    } else {
      normalized = `file:${normalized}`
    }
  }
  return normalized
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
  if (!fs.existsSync(userDataDir)) {
    try {
      fs.mkdirSync(userDataDir, { recursive: true })
    } catch (e) {}
  }
  const targetDbPath = path.join(userDataDir, 'magazapos.db')

  // Eğer AppData içindeki kalıcı veritabanı zaten varsa ve geçerliyse doğrudan onu kullan
  if (isDatabaseValid(targetDbPath)) {
    console.log(`[DB] Mevcut kalıcı veritabanı kullanılıyor: ${targetDbPath}`)
    return toSqliteUrl(targetDbPath)
  }

  // İlk çalıştırma veya eksik/bozuk veritabanı: resources altındaki hazır dev.db şablonunu ara
  let appPath = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    if (app && typeof app.getAppPath === 'function') {
      appPath = app.getAppPath()
    }
  } catch (e) {}

  const resourcesPath = (process as any).resourcesPath || ''

  const candidateSeedDbs = [
    // 1. extraResources: "to": "dev.db" -> process.resourcesPath/dev.db
    path.join(resourcesPath, 'dev.db'),
    // 2. appPath/../dev.db (resources/dev.db)
    appPath ? path.join(path.dirname(appPath), 'dev.db') : '',
    // 3. Fallback yollar
    path.join(resourcesPath, 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'resources', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'dev.db'),
    path.resolve(__dirname, '..', '..', '..', 'prisma', 'dev.db'),
    path.resolve(__dirname, '..', '..', 'prisma', 'dev.db'),
  ].filter(Boolean)

  const foundSeed = candidateSeedDbs.find((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).size > 20480
    } catch {
      return false
    }
  })

  if (foundSeed) {
    try {
      fs.copyFileSync(foundSeed, targetDbPath)
      console.log(`[DB] Hazır veritabanı AppData konumuna başarıyla kopyalandı:\n  Kaynak: ${foundSeed}\n  Hedef: ${targetDbPath}`)
      return toSqliteUrl(targetDbPath)
    } catch (err) {
      console.error('[DB] Hazır veritabanı kopyalanırken hata, doğrudan kaynak kullanılacak:', err)
      return toSqliteUrl(foundSeed)
    }
  }

  // Geliştirme modu fallback veya paketlenmiş uygulamada eksik dev.db
  console.warn('[DB] UYARI: Gecerli bir hazir veritabani (dev.db) bulunamadi! Bos veritabani olusturulacak (Tablolar eksik olabilir).')
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

  let appPath = ''
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    if (app && typeof app.getAppPath === 'function') {
      appPath = app.getAppPath()
    }
  } catch (e) {}

  const resourcesPath = (process as any).resourcesPath || ''

  const candidateEnginePaths = [
    // 1. Electron unpacked asar via process.resourcesPath
    path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', '.prisma', 'client', engineFileName),
    // 2. Electron unpacked asar via app.getAppPath()
    appPath ? path.join(path.dirname(appPath), 'app.asar.unpacked', 'node_modules', '.prisma', 'client', engineFileName) : '',
    // 3. Fallback relative to __dirname
    path.resolve(__dirname, '..', '..', '..', 'app.asar.unpacked', 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(__dirname, '..', '..', 'app.asar.unpacked', 'node_modules', '.prisma', 'client', engineFileName),
    // 4. Local node_modules (dev / unpacked)
    path.join(resourcesPath, 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(process.cwd(), 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(__dirname, '..', '..', 'node_modules', '.prisma', 'client', engineFileName),
    path.resolve(__dirname, '..', '..', '..', 'node_modules', '.prisma', 'client', engineFileName),
  ].filter(Boolean)

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
  } else {
    console.warn('[DB] PRISMA_QUERY_ENGINE_LIBRARY BULUNAMADI! Prisma baslatilirken hata olusabilir.')
  }
}

configurePrismaEngine()
const dbUrl = initializeDatabaseFile()
process.env.DATABASE_URL = dbUrl
console.log(`[DB] Prisma DATABASE_URL: ${dbUrl}`)

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

// Configure SQLite WAL mode & busy timeout for concurrent read/write operations
export async function initDbPragmas() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
    console.log(`[DB] SQLite WAL modu ve busy_timeout (5000ms) aktifleştirildi. [${dbUrl}]`)
  } catch (err) {
    console.error('[DB] PRAGMA ayarları uygulanırken hata (Veritabani baglantisi saglanamamis veya tablolar eksik olabilir):', err)
  }
}

initDbPragmas()
