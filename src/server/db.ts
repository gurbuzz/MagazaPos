import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'

function getDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:') && process.env.DATABASE_URL !== 'file:./dev.db') {
    return process.env.DATABASE_URL
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
    return `file:${found}`
  }
  return 'file:./prisma/dev.db'
}

process.env.DATABASE_URL = getDatabaseUrl()

export const prisma = new PrismaClient()

// Configure SQLite WAL mode & busy timeout for concurrent read/write operations
export async function initDbPragmas() {
  try {
    await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000;')
    await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;')
    console.log('[DB] SQLite WAL modu ve busy_timeout (5000ms) aktifleştirildi.')
  } catch (err) {
    console.error('[DB] PRAGMA ayarları uygulanırken hata:', err)
  }
}

initDbPragmas()

