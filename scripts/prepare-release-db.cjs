// Only the disposable GitHub runner checkout may have its template replaced.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { PrismaClient } = require('@prisma/client')

async function main() {
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.RUNNER_TEMP) {
    throw new Error('Release template preparation is restricted to the disposable GitHub Actions runner.')
  }
  const dir = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'magazapos-template-'))
  const dbPath = path.join(dir, 'empty.db')
  const schema = path.resolve('prisma/schema.prisma')
  const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schema, '--script'], { encoding: 'utf8' })
  const db = new PrismaClient({ datasources: { db: { url: `file:${dbPath.replace(/\\/g, '/')}` } } })
  try {
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement)
    const tables = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    for (const { name } of tables) {
      const rows = await db.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM "${name.replace(/"/g, '""')}"`)
      if (Number(rows[0].count) !== 0) throw Error(`Template table must be empty: ${name}`)
    }
  } finally { await db.$disconnect() }
  fs.copyFileSync(dbPath, 'prisma/dev.db')
  console.log('Installer template contains schema only, with no store records.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
