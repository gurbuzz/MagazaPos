import { Prisma, PrismaClient } from '@prisma/client'
import { PaymentFilter } from '../../shared/salesReporting'

export async function voucherCollections(db: PrismaClient | Prisma.TransactionClient, options: { payment: PaymentFilter; start?: Date; end?: Date; search?: unknown }) {
  // ISO text dates are compared as instants, including caller timezone offsets.
  const conditions = [Prisma.sql`paymentMethod IN ('CASH', 'CARD')`]
  if (options.payment !== 'ALL') conditions.push(Prisma.sql`paymentMethod = ${options.payment}`)
  if (options.start) conditions.push(Prisma.sql`julianday(createdAt) >= julianday(${options.start.toISOString()})`)
  if (options.end) conditions.push(Prisma.sql`julianday(createdAt) <= julianday(${options.end.toISOString()})`)
  if (typeof options.search === 'string' && options.search.trim()) {
    const search = options.search.trim().replace(/\*/g, '')
    conditions.push(Prisma.sql`(instr(lower(code), lower(${search})) > 0 OR instr(lower(cashierName), lower(${search})) > 0)`)
  }
  const rows = await db.$queryRaw<{ paymentMethod: string; amount: bigint | number; count: bigint | number }[]>(Prisma.sql`
    SELECT paymentMethod, SUM(initialCents) AS amount, COUNT(*) AS count
    FROM "GiftVoucher" WHERE ${Prisma.join(conditions, ' AND ')} GROUP BY paymentMethod`)
  const cash = Number(rows.find(row => row.paymentMethod === 'CASH')?.amount || 0)
  const card = Number(rows.find(row => row.paymentMethod === 'CARD')?.amount || 0)
  const count = rows.reduce((sum, row) => sum + Number(row.count), 0)
  return { cash, card, count }
}
