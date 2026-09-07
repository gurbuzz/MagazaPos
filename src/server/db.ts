import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

// Otomatik .env kontrolü ve oluşturma
function ensureEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env')
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, 'DATABASE_URL="file:./dev.db"\nPORT=3782\n', 'utf-8')
      console.log('[DB] Eksik .env dosyası otomatik olarak oluşturuldu.')
    }
  } catch (e) {
    // Yazma izin hatası durumunda sessizce devam et
  }
}

// Windows dosya yollarını SQLite URI formatına dönüştürür (ters eğik çizgi '\\' yerine '/')
// Windows'ta 'file:C:\\...' kullanımı SQLite Error Code 14 (SQLITE_CANTOPEN) hatasına yol açar!
export function toSqliteUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.startsWith('file:') ? normalized : `file:${normalized}`
}

function getDatabaseUrl(): string {
  ensureEnvFile()

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:') && process.env.DATABASE_URL !== 'file:./dev.db') {
    return toSqliteUrl(process.env.DATABASE_URL)
  }

  const possiblePaths = [
    path.resolve(process.cwd(), 'prisma/dev.db'),
    path.resolve(process.cwd(), 'dev.db'),
    path.resolve(__dirname, '../../prisma/dev.db'),
    path.resolve(__dirname, '../../../prisma/dev.db'),
    path.join((process as any).resourcesPath || '', 'prisma/dev.db'),
  ]

  const found = possiblePaths.find((p) => fs.existsSync(p))
  if (found) {
    return toSqliteUrl(found)
  }

  // Varsayılan hedef: proje kökündeki prisma/dev.db
  const defaultPath = path.resolve(process.cwd(), 'prisma/dev.db')
  const dir = path.dirname(defaultPath)
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e) {
      console.error('[DB] Veritabanı klasörü oluşturulamadı:', e)
    }
  }

  return toSqliteUrl(defaultPath)
}

const dbUrl = getDatabaseUrl()
process.env.DATABASE_URL = dbUrl

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
})

// Veritabanında tablolar yoksa (yeni/boş dev.db) otomatik olarak şemayı oluştur
async function ensureDatabaseSchema() {
  try {
    const tables: any[] = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='Category';"
    )
    if (!tables || tables.length === 0) {
      console.log('[DB] Veritabanı tabloları bulunamadı. Şema otomatik oluşturuluyor...')

      const schemaPath = [
        path.resolve(process.cwd(), 'prisma/schema.prisma'),
        path.resolve(__dirname, '../../prisma/schema.prisma'),
        path.resolve(__dirname, '../../../prisma/schema.prisma'),
      ].find((p) => fs.existsSync(p))

      if (schemaPath) {
        try {
          execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate`, {
            stdio: 'pipe',
            env: { ...process.env, DATABASE_URL: dbUrl },
          })
          console.log('[DB] Veritabanı şeması başarıyla oluşturuldu.')

          const seedPath = [
            path.resolve(process.cwd(), 'prisma/seed.ts'),
            path.resolve(__dirname, '../../prisma/seed.ts'),
          ].find((p) => fs.existsSync(p))

          if (seedPath) {
            try {
              execSync(`npx tsx "${seedPath}"`, {
                stdio: 'pipe',
                env: { ...process.env, DATABASE_URL: dbUrl },
              })
              console.log('[DB] Başlangıç verileri başarıyla yüklendi.')
            } catch (seedErr) {
              console.warn('[DB] Seed verisi yüklenirken uyarı:', seedErr)
            }
          }
        } catch (pushErr) {
          console.error('[DB] prisma db push hatası:', pushErr)
        }
      }
    }
  } catch (err) {
    console.error('[DB] Tablo kontrolü sırasında hata:', err)
  }
}

// Configure SQLite WAL mode & busy timeout for concurrent read/write operations
export async function initDbPragmas() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
    console.log(`[DB] SQLite WAL modu ve busy_timeout (5000ms) aktifleştirildi. [${dbUrl}]`)

    await ensureDatabaseSchema()
  } catch (err) {
    console.error('[DB] PRAGMA ayarları uygulanırken hata:', err)
  }
}

initDbPragmas()


