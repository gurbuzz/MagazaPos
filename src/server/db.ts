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
    normalized = `file:${normalized}`
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

    // SQLite header doğrulama: dosyanın ilk 16 baytı 'SQLite format 3\0' olmalıdır
    const fd = fs.openSync(filePath, 'r')
    const buffer = Buffer.alloc(16)
    fs.readSync(fd, buffer, 0, 16, 0)
    fs.closeSync(fd)
    if (!buffer.toString('ascii').startsWith('SQLite format 3')) {
      logDebug('DB_INIT', `Existing DB has invalid SQLite header, marking as invalid.`)
      return false
    }

    return true
  } catch (err: any) {
    logDebug('DB_INIT', `Error checking existing DB validity: ${err.message}`)
    return false
  }
}

// Tüm olası paketleme ve kurulum konumlarında hazır seed veritabanını (dev.db) arar
export function findSeedDb(): string | null {
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
    // 1. Process resourcesPath (NSIS Kurulum ve win-unpacked)
    path.join(resourcesPath, 'dev.db'),
    path.join(resourcesPath, 'prisma', 'dev.db'),
    path.join(resourcesPath, 'app.asar.unpacked', 'prisma', 'dev.db'),
    path.join(resourcesPath, 'app.asar.unpacked', 'dev.db'),

    // 2. app.getAppPath() çevresi (resources/app.asar konumu)
    appPath ? path.join(path.dirname(appPath), 'dev.db') : '',
    appPath ? path.join(path.dirname(appPath), 'prisma', 'dev.db') : '',
    appPath ? path.join(path.dirname(appPath), 'app.asar.unpacked', 'prisma', 'dev.db') : '',
    appPath ? path.join(appPath, 'prisma', 'dev.db') : '',
    appPath ? path.join(appPath, 'dev.db') : '',

    // 3. Çalışma dizini (process.cwd()) çevresi
    path.resolve(process.cwd(), 'resources', 'dev.db'),
    path.resolve(process.cwd(), 'resources', 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'prisma', 'dev.db'),
    path.resolve(process.cwd(), 'dev.db'),

    // 4. Modül konumu (__dirname) çevresi
    path.resolve(__dirname, '..', '..', '..', 'prisma', 'dev.db'),
    path.resolve(__dirname, '..', '..', 'prisma', 'dev.db'),
    path.resolve(__dirname, '..', 'prisma', 'dev.db'),
    path.resolve(__dirname, 'prisma', 'dev.db'),
    path.resolve(__dirname, 'dev.db'),
  ].filter(Boolean)

  logDebug('DB_INIT', `Candidate seed DB paths to search:`, candidateSeedDbs)

  for (const p of candidateSeedDbs) {
    try {
      if (fs.existsSync(p)) {
        const size = fs.statSync(p).size
        logDebug('DB_INIT', `Found candidate file at ${p} with size: ${size} bytes`)
        if (size > 20480) {
          logDebug('DB_INIT', `Valid seed DB selected: ${p}`)
          return p
        }
      }
    } catch {}
  }
  return null
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

  // İlk çalıştırma veya eksik/bozuk/0-byte veritabanı: hazır dev.db şablonunu ara
  const foundSeed = findSeedDb()

  if (foundSeed) {
    try {
      logDebug('DB_INIT', `Selected seed DB: ${foundSeed}. Attempting to copy to ${targetDbPath}...`)
      // Eğer hedefte 0-byte veya bozuk kalıntı dosya varsa önce temizle
      if (fs.existsSync(targetDbPath)) {
        try { fs.unlinkSync(targetDbPath) } catch {}
      }
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
  logDebug('DB_INIT', 'CRITICAL WARNING: No valid seed DB (dev.db) found! Creating empty fallback DB in User Data Dir.')
  console.warn('[DB] UYARI: Gecerli bir hazir veritabani (dev.db) bulunamadi! Bos veritabani olusturulacak (Tablolar otomatik onarilacak).')
  
  const fallbackUrl = toSqliteUrl(targetDbPath)
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

// Seed default categories & products if database is fresh
async function seedDefaultData() {
  try {
    const catUst = await prisma.category.upsert({
      where: { name: 'Üst Giyim' },
      update: {},
      create: { name: 'Üst Giyim' },
    })
    const catAlt = await prisma.category.upsert({
      where: { name: 'Alt Giyim' },
      update: {},
      create: { name: 'Alt Giyim' },
    })
    const catDis = await prisma.category.upsert({
      where: { name: 'Dış Giyim' },
      update: {},
      create: { name: 'Dış Giyim' },
    })
    const catAksesuar = await prisma.category.upsert({
      where: { name: 'Aksesuar' },
      update: {},
      create: { name: 'Aksesuar' },
    })

    const attr = (color: string, size: string) => JSON.stringify({ color, size })

    // Kazak
    await prisma.product.create({
      data: {
        code: 'PRD-KZK-001',
        name: 'Boğazlı Örme Kazak',
        brand: 'Lufian',
        basePrice: 899.9,
        description: '%100 Pamuklu kışlık boğazlı erkek kazak',
        categoryId: catUst.id,
        variants: {
          create: [
            { sku: 'KZK-RED-S', barcode: '869000000001', attributes: attr('Kırmızı', 'S'), costPrice: 400, salePrice: 899.9, stockQuantity: 15 },
            { sku: 'KZK-RED-M', barcode: '869000000002', attributes: attr('Kırmızı', 'M'), costPrice: 400, salePrice: 899.9, stockQuantity: 24 },
            { sku: 'KZK-BLK-L', barcode: '869000000003', attributes: attr('Siyah', 'L'), costPrice: 400, salePrice: 899.9, stockQuantity: 8 },
            { sku: 'KZK-GRY-XL', barcode: '869000000010', attributes: attr('Gri', 'XL'), costPrice: 400, salePrice: 899.9, stockQuantity: 18 },
          ],
        },
      },
    })

    // Pantolon
    await prisma.product.create({
      data: {
        code: 'PRD-JNS-002',
        name: 'Slim Fit Denim Pantolon',
        brand: 'Jack & Jones',
        basePrice: 1299.0,
        description: 'Esnek kot kumaş slim fit tasarım',
        categoryId: catAlt.id,
        variants: {
          create: [
            { sku: 'JNS-BLU-30', barcode: '869000000004', attributes: attr('Mavi', '30/32'), costPrice: 600, salePrice: 1299.0, stockQuantity: 12 },
            { sku: 'JNS-BLU-32', barcode: '869000000005', attributes: attr('Mavi', '32/32'), costPrice: 600, salePrice: 1299.0, stockQuantity: 30 },
            { sku: 'JNS-BLK-34', barcode: '869000000011', attributes: attr('Siyah', '34/32'), costPrice: 600, salePrice: 1299.0, stockQuantity: 5 },
          ],
        },
      },
    })

    // Tişört
    await prisma.product.create({
      data: {
        code: 'PRD-TSH-003',
        name: 'Oversize Basic Tişört',
        brand: 'Jack & Jones',
        basePrice: 349.9,
        description: '%100 Süprem pamuk basic unisex tişört',
        categoryId: catUst.id,
        variants: {
          create: [
            { sku: 'TSH-WHT-M', barcode: '869000000006', attributes: attr('Beyaz', 'M'), costPrice: 120, salePrice: 349.9, stockQuantity: 50 },
            { sku: 'TSH-WHT-L', barcode: '869000000007', attributes: attr('Beyaz', 'L'), costPrice: 120, salePrice: 349.9, stockQuantity: 42 },
            { sku: 'TSH-BLK-M', barcode: '869000000008', attributes: attr('Siyah', 'M'), costPrice: 120, salePrice: 349.9, stockQuantity: 18 },
            { sku: 'TSH-BEG-S', barcode: '869000000012', attributes: attr('Bej', 'S'), costPrice: 120, salePrice: 349.9, stockQuantity: 35 },
          ],
        },
      },
    })

    // Gömlek
    await prisma.product.create({
      data: {
        code: 'PRD-GMK-004',
        name: 'Ekoseli Oduncu Gömlek',
        brand: 'Lufian',
        basePrice: 649.9,
        description: 'Çift cepli sıcak tutan ekoseli gömlek',
        categoryId: catUst.id,
        variants: {
          create: [
            { sku: 'GMK-RED-M', barcode: '869000000020', attributes: attr('Kırmızı-Siyah', 'M'), costPrice: 280, salePrice: 649.9, stockQuantity: 16 },
            { sku: 'GMK-RED-L', barcode: '869000000021', attributes: attr('Kırmızı-Siyah', 'L'), costPrice: 280, salePrice: 649.9, stockQuantity: 22 },
            { sku: 'GMK-GRN-L', barcode: '869000000022', attributes: attr('Yeşil-Lacivert', 'L'), costPrice: 280, salePrice: 649.9, stockQuantity: 9 },
          ],
        },
      },
    })

    // Sweatshirt
    await prisma.product.create({
      data: {
        code: 'PRD-SWT-005',
        name: 'Kapüşonlu Basic Sweatshirt',
        brand: 'Jack & Jones',
        basePrice: 799.0,
        description: 'İçi şardonlu sıcak tutan kapüşonlu sweatshirt',
        categoryId: catUst.id,
        variants: {
          create: [
            { sku: 'SWT-ANT-M', barcode: '869000000030', attributes: attr('Antrasit', 'M'), costPrice: 350, salePrice: 799.0, stockQuantity: 28 },
            { sku: 'SWT-ANT-L', barcode: '869000000031', attributes: attr('Antrasit', 'L'), costPrice: 350, salePrice: 799.0, stockQuantity: 14 },
            { sku: 'SWT-NVY-XL', barcode: '869000000032', attributes: attr('Lacivert', 'XL'), costPrice: 350, salePrice: 799.0, stockQuantity: 40 },
          ],
        },
      },
    })

    // Mont
    await prisma.product.create({
      data: {
        code: 'PRD-MNT-007',
        name: 'Kaz Tüyü Şişme Mont',
        brand: 'Lufian',
        basePrice: 2499.0,
        description: 'Su geçirmez rüzgar kesici hafif kışlık şişme mont',
        categoryId: catDis.id,
        variants: {
          create: [
            { sku: 'MNT-BLK-M', barcode: '869000000050', attributes: attr('Siyah', 'M'), costPrice: 1100, salePrice: 2499.0, stockQuantity: 7 },
            { sku: 'MNT-BLK-L', barcode: '869000000051', attributes: attr('Siyah', 'L'), costPrice: 1100, salePrice: 2499.0, stockQuantity: 15 },
            { sku: 'MNT-KHA-L', barcode: '869000000052', attributes: attr('Haki', 'L'), costPrice: 1100, salePrice: 2499.0, stockQuantity: 6 },
          ],
        },
      },
    })

    // Kemer
    await prisma.product.create({
      data: {
        code: 'PRD-KMR-008',
        name: 'Hakiki Deri Erkek Kemer',
        brand: 'Lufian',
        basePrice: 399.0,
        description: '%100 Hakiki dana derisi metal tokalı kemer',
        categoryId: catAksesuar.id,
        variants: {
          create: [
            { sku: 'KMR-BRN-110', barcode: '869000000060', attributes: attr('Kahverengi', '110 cm'), costPrice: 150, salePrice: 399.0, stockQuantity: 30 },
            { sku: 'KMR-BLK-115', barcode: '869000000061', attributes: attr('Siyah', '115 cm'), costPrice: 150, salePrice: 399.0, stockQuantity: 45 },
          ],
        },
      },
    })
    console.log('[DB] Başlangıç ürünleri ve kategoriler başarıyla oluşturuldu.')
  } catch (e: any) {
    logDebug('DB_INIT', 'Error seeding default data', e)
    console.error('[DB] Başlangıç verileri oluşturulurken hata:', e)
  }
}

// Otomatik tablo oluşturma ve şema migrasyonu kontrolü
export async function ensureDatabaseSchema() {
  try {
    // 1. Product tablosu var mı kontrol et
    const tables: any = await prisma.$queryRawUnsafe(
      `SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='Product';`
    )
    const hasProductTable = Number(tables?.[0]?.count || 0) > 0

    if (!hasProductTable) {
      logDebug('DB_INIT', 'Product table missing! Executing automatic schema creation (DDL)...')
      console.log('[DB] Tablolar bulunamadi. Otomatik sema ve baslangic tablolari olusturuluyor...')

      const statements = [
        `CREATE TABLE IF NOT EXISTS "Category" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "name" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS "Product" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "code" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "brand" TEXT,
          "basePrice" REAL NOT NULL DEFAULT 0,
          "description" TEXT,
          "categoryId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS "ProductVariant" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "productId" TEXT NOT NULL,
          "sku" TEXT NOT NULL,
          "barcode" TEXT NOT NULL,
          "attributes" TEXT NOT NULL,
          "costPrice" REAL NOT NULL DEFAULT 0,
          "salePrice" REAL NOT NULL,
          "stockQuantity" INTEGER NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          "discountPrice" REAL,
          CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS "StockMovement" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "variantId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "note" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS "Customer" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "firstName" TEXT NOT NULL,
          "lastName" TEXT NOT NULL,
          "phone" TEXT NOT NULL,
          "city" TEXT NOT NULL,
          "district" TEXT NOT NULL,
          "notes" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
        );`,
        `CREATE TABLE IF NOT EXISTS "Sale" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "receiptNo" TEXT NOT NULL,
          "customerId" TEXT,
          "totalAmount" REAL NOT NULL,
          "discountAmount" REAL NOT NULL DEFAULT 0,
          "paymentType" TEXT NOT NULL,
          "cashierName" TEXT NOT NULL DEFAULT 'Kasiyer 1',
          "status" TEXT NOT NULL DEFAULT 'COMPLETED',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );`,
        `CREATE TABLE IF NOT EXISTS "SaleItem" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "saleId" TEXT NOT NULL,
          "variantId" TEXT NOT NULL,
          "quantity" INTEGER NOT NULL,
          "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
          "unitPrice" REAL NOT NULL,
          "totalPrice" REAL NOT NULL,
          CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_key" ON "Category"("name");`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "Product_code_key" ON "Product"("code");`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_sku_key" ON "ProductVariant"("sku");`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_barcode_key" ON "ProductVariant"("barcode");`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "Customer_phone_key" ON "Customer"("phone");`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "Sale_receiptNo_key" ON "Sale"("receiptNo");`
      ]

      for (const sql of statements) {
        await prisma.$queryRawUnsafe(sql)
      }
      logDebug('DB_INIT', 'Database schema created successfully!')
      console.log('[DB] Tablolar basariyla olusturuldu.')
    }

    // 2. Kolon migrasyonu kontrolü: ProductVariant tablosunda discountPrice var mı?
    try {
      const columns: any = await prisma.$queryRawUnsafe(`PRAGMA table_info("ProductVariant");`)
      if (Array.isArray(columns)) {
        const hasDiscountPrice = columns.some((c: any) => c.name === 'discountPrice')
        if (!hasDiscountPrice) {
          logDebug('DB_INIT', 'Column discountPrice missing on ProductVariant! Running ALTER TABLE...')
          await prisma.$queryRawUnsafe(`ALTER TABLE "ProductVariant" ADD COLUMN "discountPrice" REAL;`)
          logDebug('DB_INIT', 'Column discountPrice successfully added to ProductVariant.')
          console.log('[DB] ProductVariant tablosuna discountPrice kolonu eklendi.')
        }
      }
    } catch (migErr: any) {
      logDebug('DB_INIT', 'Error checking/migrating discountPrice column', migErr)
    }

    // 3. Tablo boş ise başlangıç örnek verilerini yükle
    try {
      const prodCount = await prisma.product.count()
      if (prodCount === 0) {
        logDebug('DB_INIT', 'No products found in DB. Seeding default products...')
        await seedDefaultData()
      }
    } catch (countErr: any) {
      logDebug('DB_INIT', 'Error checking product count', countErr)
    }
  } catch (err: any) {
    logDebug('DB_INIT', 'Error in ensureDatabaseSchema', err)
    console.error('[DB] Otomatik sema hazirlanirken hata:', err)
  }
}

// Configure SQLite WAL mode & busy timeout for concurrent read/write operations
export async function initDbPragmas() {
  try {
    logDebug('PRISMA_TEST', `Attempting to execute PRAGMA commands...`)
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')

    // Ensure database schema, migrations and starter data
    await ensureDatabaseSchema()

    // Test the database structure
    const tableCount: any = await prisma.$queryRawUnsafe(`SELECT count(*) as count FROM sqlite_master WHERE type='table';`)
    logDebug('PRISMA_TEST', `SUCCESS: Database connected. SQLite tables count: ${Number(tableCount?.[0]?.count || 0)}`)

    console.log(`[DB] SQLite WAL modu ve busy_timeout (5000ms) aktifleştirildi. [${dbUrl}]`)
  } catch (err: any) {
    logDebug('PRISMA_TEST', `ERROR: Failed to run PRAGMA commands or verify tables.`, err)
    console.error('[DB] PRAGMA ayarları uygulanırken hata:', err)
  }
}

initDbPragmas()

