import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { getUserDataDir } from './utils/paths'
import { logDebug } from './utils/logger'

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
    if (!fs.existsSync(filePath)) {
      logDebug('DB_INIT', `Target DB does not exist at: ${filePath}`)
      return false
    }
    const stat = fs.statSync(filePath)
    logDebug('DB_INIT', `Existing DB found at: ${filePath}, size: ${stat.size} bytes`)
    // Şema ve başlangıç verileriyle dolu bir MagazaPOS veritabanı ~108 KB'dir.
    // 20 KB'den küçükse tablolar eksik veya boştur.
    if (stat.size < 20480) {
      logDebug('DB_INIT', `Existing DB is too small (<20KB), marking as invalid.`)
      return false
    }
    return true
  } catch (err: any) {
    logDebug('DB_INIT', `Error checking existing DB validity: ${err.message}`)
    return false
  }
}

function initializeDatabaseFile(): string {
  logDebug('DB_INIT', 'Starting Database Initialization...')
  const userDataDir = getUserDataDir()
  logDebug('DB_INIT', `User Data Dir resolved to: ${userDataDir}`)

  if (!fs.existsSync(userDataDir)) {
    try {
      fs.mkdirSync(userDataDir, { recursive: true })
      logDebug('DB_INIT', `Created User Data Dir.`)
    } catch (e: any) {
      logDebug('DB_INIT', `Failed to create User Data Dir: ${e.message}`)
    }
  }
  
  const targetDbPath = path.join(userDataDir, 'magazapos.db')
  logDebug('DB_INIT', `Target persistent DB path: ${targetDbPath}`)

  // Eğer AppData içindeki kalıcı veritabanı zaten varsa ve geçerliyse doğrudan onu kullan
  if (isDatabaseValid(targetDbPath)) {
    const url = toSqliteUrl(targetDbPath)
    logDebug('DB_INIT', `Using existing persistent DB at URL: ${url}`)
    console.log(`[DB] Mevcut kalıcı veritabanı kullanılıyor: ${targetDbPath}`)
    return url
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
  logDebug('DB_INIT', `resourcesPath: ${resourcesPath}, appPath: ${appPath}, cwd: ${process.cwd()}, __dirname: ${__dirname}`)

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

  logDebug('DB_INIT', `Candidate seed DB paths to search:`, candidateSeedDbs)

  const foundSeed = candidateSeedDbs.find((p) => {
    try {
      const exists = fs.existsSync(p)
      if (!exists) return false
      const size = fs.statSync(p).size
      logDebug('DB_INIT', `Found candidate file at ${p} with size: ${size} bytes`)
      return size > 20480
    } catch {
      return false
    }
  })

  if (foundSeed) {
    try {
      logDebug('DB_INIT', `Selected seed DB: ${foundSeed}. Attempting to copy to ${targetDbPath}...`)
      fs.copyFileSync(foundSeed, targetDbPath)
      const url = toSqliteUrl(targetDbPath)
      logDebug('DB_INIT', `Seed DB successfully copied. Returning URL: ${url}`)
      console.log(`[DB] Hazır veritabanı AppData konumuna başarıyla kopyalandı:\n  Kaynak: ${foundSeed}\n  Hedef: ${targetDbPath}`)
      return url
    } catch (err: any) {
      logDebug('DB_INIT', `Error copying seed database! Using seed DB directly as fallback.`, err)
      console.error('[DB] Hazır veritabanı kopyalanırken hata, doğrudan kaynak kullanılacak:', err)
      return toSqliteUrl(foundSeed)
    }
  }

  // Geliştirme modu fallback veya paketlenmiş uygulamada eksik dev.db
  logDebug('DB_INIT', 'CRITICAL WARNING: No valid seed DB (dev.db) found! Creating empty fallback DB.')
  console.warn('[DB] UYARI: Gecerli bir hazir veritabani (dev.db) bulunamadi! Bos veritabani olusturulacak (Tablolar eksik olabilir).')
  const defaultLocalDb = path.resolve(process.cwd(), 'prisma/dev.db')
  const dir = path.dirname(defaultLocalDb)
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e) {}
  }

  const fallbackUrl = toSqliteUrl(defaultLocalDb)
  logDebug('DB_INIT', `Fallback DB URL: ${fallbackUrl}`)
  return fallbackUrl
}

function configurePrismaEngine() {
  logDebug('PRISMA_ENGINE', 'Starting query engine configuration...')
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

  logDebug('PRISMA_ENGINE', `Engine search candidates:`, candidateEnginePaths)

  const found = candidateEnginePaths.find((p) => {
    try {
      const exists = fs.existsSync(p)
      if (exists) {
        logDebug('PRISMA_ENGINE', `Found engine candidate at: ${p} (Size: ${fs.statSync(p).size} bytes)`)
      }
      return exists && fs.statSync(p).size > 0
    } catch {
      return false
    }
  })

  if (found) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = found
    logDebug('PRISMA_ENGINE', `SUCCESS: Engine library configured: ${found}`)
    console.log('[DB] PRISMA_QUERY_ENGINE_LIBRARY configured:', found)
  } else {
    logDebug('PRISMA_ENGINE', `ERROR: QUERY ENGINE LIBRARY NOT FOUND IN ANY CANDIDATE PATH!`)
    console.warn('[DB] PRISMA_QUERY_ENGINE_LIBRARY BULUNAMADI! Prisma baslatilirken hata olusabilir.')
  }
}

logDebug('STARTUP', '===================================================\nApplication starting...')
configurePrismaEngine()
const dbUrl = initializeDatabaseFile()
process.env.DATABASE_URL = dbUrl

logDebug('STARTUP', `Final process.env.DATABASE_URL = ${process.env.DATABASE_URL}`)
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
    logDebug('PRISMA_TEST', `Attempting to execute PRAGMA commands...`)
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
    
    // Test the database structure
    const tableCount: any = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM sqlite_master WHERE type='table';`)
    logDebug('PRISMA_TEST', `SUCCESS: Database connected. SQLite tables count: ${Number(tableCount?.[0]?.count || 0)}`)
    
    console.log(`[DB] SQLite WAL modu ve busy_timeout (5000ms) aktifleştirildi. [${dbUrl}]`)
  } catch (err: any) {
    logDebug('PRISMA_TEST', `ERROR: Failed to run PRAGMA commands or verify tables. Is the DB file empty?`, err)
    console.error('[DB] PRAGMA ayarları uygulanırken hata (Veritabani baglantisi saglanamamis veya tablolar eksik olabilir):', err)
  }
}

initDbPragmas()
