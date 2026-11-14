import { Router } from 'express'
import { prisma } from '../db'
import { findVoucher, issueVoucher } from '../services/giftVouchers'
import { requireAdminPinAuth } from '../utils/security'

export const giftVouchersRouter = Router()

giftVouchersRouter.get('/', async (_req, res) => {
  try {
    const vouchers = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "GiftVoucher" ORDER BY "createdAt" DESC LIMIT 50')
    const totals = await prisma.$queryRawUnsafe<any[]>(`SELECT paymentMethod, SUM(initialCents) AS issued, SUM(balanceCents) AS balance FROM "GiftVoucher" GROUP BY paymentMethod`)
    res.json({ vouchers, totals: totals.map(t => ({ paymentMethod: t.paymentMethod, issued: Number(t.issued) / 100, balance: Number(t.balance) / 100 })) })
  } catch (err: any) { res.status(400).json({ error: err.message }) }
})

giftVouchersRouter.get('/:code', async (req, res) => {
  try {
    const voucher = await findVoucher(prisma, req.params.code)
    const movements = await prisma.$queryRaw<any[]>`SELECT * FROM "GiftVoucherMovement" WHERE "voucherId" = ${voucher.id} ORDER BY "createdAt" DESC`
    res.json({ ...voucher, movements })
  } catch (err: any) { res.status(404).json({ error: err.message }) }
})

giftVouchersRouter.post('/', (req, res, next) => {
  if (req.body.paymentMethod === 'COMPLIMENTARY') requireAdminPinAuth(req, res, next)
  else next()
}, async (req, res) => {
  try { res.status(201).json(await issueVoucher(prisma, req.body)) }
  catch (err: any) { res.status(400).json({ error: err.message }) }
})
