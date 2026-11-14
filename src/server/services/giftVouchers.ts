import { PrismaClient, Prisma } from '@prisma/client'
import { randomBytes, randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

type Tx = Prisma.TransactionClient
export class GiftVoucherError extends Error {}
export type Voucher = {
  id: string; code: string; requestId: string; initialCents: number; balanceCents: number
  paymentMethod: string; cashierName: string; createdAt: string
}

export function moneyCents(value: unknown): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new GiftVoucherError('Geçersiz tutar.')
  const text = String(value).trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new GiftVoucherError('Tutar en fazla iki ondalık basamak içermelidir.')
  const cents = Math.round(Number(text) * 100)
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 100000000) throw new GiftVoucherError('Tutar sınır dışında.')
  return cents
}

// Only adds independent tables. Never rebuilds or updates existing store tables.
export async function ensureGiftVoucherSchema(db: PrismaClient, dbPath: string): Promise<void> {
  const existing = await db.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('GiftVoucher','GiftVoucherMovement')`)
  if (existing.length === 2) return
  if (existing.length) throw new Error('Hediye çeki şeması eksik. Veri korunması için güncelleme durduruldu.')
  const integrity = await db.$queryRawUnsafe<{ integrity_check: string }[]>('PRAGMA integrity_check')
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('Veritabanı bütünlük kontrolü başarısız.')
  const backupDir = path.join(path.dirname(dbPath), 'backups')
  fs.mkdirSync(backupDir, { recursive: true })
  const backupPath = path.join(backupDir, `hediye_oncesi_${Date.now()}_${randomUUID()}.db`)
  await db.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/\\/g, '/').replace(/'/g, "''")}'`)
  const backup = new PrismaClient({ datasources: { db: { url: `file:${backupPath.replace(/\\/g, '/')}` } } })
  try {
    const check = await backup.$queryRawUnsafe<{ integrity_check: string }[]>('PRAGMA integrity_check')
    if (check.length !== 1 || check[0].integrity_check !== 'ok') throw new Error('Güncelleme öncesi yedek doğrulanamadı.')
  } finally { await backup.$disconnect() }
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`CREATE TABLE "GiftVoucher" (
      "id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "requestId" TEXT NOT NULL UNIQUE,
      "initialCents" INTEGER NOT NULL CHECK(initialCents > 0),
      "balanceCents" INTEGER NOT NULL CHECK(balanceCents >= 0 AND balanceCents <= initialCents),
      "paymentMethod" TEXT NOT NULL, "cashierName" TEXT NOT NULL, "createdAt" TEXT NOT NULL)`)
    await tx.$executeRawUnsafe(`CREATE TABLE "GiftVoucherMovement" (
      "id" TEXT NOT NULL PRIMARY KEY, "voucherId" TEXT NOT NULL, "saleId" TEXT,
      "type" TEXT NOT NULL, "amountCents" INTEGER NOT NULL, "createdAt" TEXT NOT NULL,
      FOREIGN KEY("voucherId") REFERENCES "GiftVoucher"("id") ON DELETE RESTRICT)`)
    await tx.$executeRawUnsafe('CREATE INDEX "GiftVoucherMovement_saleId_idx" ON "GiftVoucherMovement"("saleId")')
    await tx.$executeRawUnsafe('CREATE INDEX "GiftVoucherMovement_voucherId_idx" ON "GiftVoucherMovement"("voucherId")')
  })
}

export async function findVoucher(tx: Tx, code: string): Promise<Voucher> {
  const rows = await tx.$queryRaw<Voucher[]>`SELECT * FROM "GiftVoucher" WHERE "code" = ${code.trim().toUpperCase()}`
  if (!rows[0]) throw new GiftVoucherError('Hediye çeki bulunamadı.')
  return rows[0]
}

export async function issueVoucher(db: PrismaClient, input: { amount: unknown; paymentMethod: string; cashierName: string; requestId: string }): Promise<Voucher> {
  const cents = moneyCents(input.amount)
  if (cents <= 0) throw new GiftVoucherError('Çek tutarı sıfırdan büyük olmalıdır.')
  if (!['CASH', 'CARD', 'COMPLIMENTARY'].includes(input.paymentMethod)) throw new GiftVoucherError('Ödeme yöntemi geçersiz.')
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId || '')) throw new GiftVoucherError('İşlem kimliği geçersiz.')
  return db.$transaction(async tx => {
    const existing = await tx.$queryRaw<Voucher[]>`SELECT * FROM "GiftVoucher" WHERE "requestId" = ${input.requestId}`
    if (existing[0]) {
      if (existing[0].initialCents !== cents || existing[0].paymentMethod !== input.paymentMethod) throw new GiftVoucherError('Bu işlem kimliği başka bir çek için kullanıldı.')
      return existing[0]
    }
    const voucher: Voucher = {
      id: randomUUID(), code: `HC${randomBytes(8).toString('hex').toUpperCase()}`, requestId: input.requestId,
      initialCents: cents, balanceCents: cents, paymentMethod: input.paymentMethod,
      cashierName: String(input.cashierName || 'Kasiyer').slice(0, 100), createdAt: new Date().toISOString(),
    }
    await tx.$executeRaw`INSERT INTO "GiftVoucher" (id,code,requestId,initialCents,balanceCents,paymentMethod,cashierName,createdAt) VALUES (${voucher.id},${voucher.code},${voucher.requestId},${cents},${cents},${voucher.paymentMethod},${voucher.cashierName},${voucher.createdAt})`
    await recordMovement(tx, voucher.id, null, 'ISSUE', cents)
    return voucher
  })
}

async function recordMovement(tx: Tx, voucherId: string, saleId: string | null, type: string, amountCents: number, movementId: string = randomUUID()) {
  await tx.$executeRaw`INSERT INTO "GiftVoucherMovement" (id,voucherId,saleId,type,amountCents,createdAt) VALUES (${movementId},${voucherId},${saleId},${type},${amountCents},${new Date().toISOString()})`
}

export async function redeemVoucher(tx: Tx, code: string, cents: number, saleId: string, requestId?: string) {
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new GiftVoucherError('Kullanılacak çek tutarı geçersiz.')
  const voucher = await findVoucher(tx, code)
  const changed = await tx.$executeRaw`UPDATE "GiftVoucher" SET "balanceCents" = "balanceCents" - ${cents} WHERE id = ${voucher.id} AND "balanceCents" >= ${cents}`
  if (changed !== 1) throw new GiftVoucherError('Hediye çeki bakiyesi yetersiz. Çeki yeniden sorgulayın.')
  await recordMovement(tx, voucher.id, saleId, 'REDEEM', -cents, requestId ? `checkout-${requestId}` : undefined)
  return { code: voucher.code, amount: cents / 100, balance: (voucher.balanceCents - cents) / 100 }
}

export async function refundVoucher(tx: Tx, code: string, cents: number, saleId: string) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new GiftVoucherError('İade tutarı geçersiz.')
  if (cents <= 0) return
  const voucher = await findVoucher(tx, code)
  const movements = await tx.$queryRaw<{ amount: bigint | number | null }[]>`SELECT SUM(amountCents) AS amount FROM "GiftVoucherMovement" WHERE "voucherId" = ${voucher.id} AND "saleId" = ${saleId}`
  if (cents > -Number(movements[0]?.amount || 0)) throw new GiftVoucherError('Çeke iade edilebilecek tutar aşıldı.')
  const changed = await tx.$executeRaw`UPDATE "GiftVoucher" SET "balanceCents" = "balanceCents" + ${cents} WHERE id = ${voucher.id} AND "balanceCents" + ${cents} <= "initialCents"`
  if (changed !== 1) throw new GiftVoucherError('Çek bakiyesi geri yüklenemedi.')
  await recordMovement(tx, voucher.id, saleId, 'REFUND', cents)
}
