import type { Prisma } from '@prisma/client'
import { allocateCents, itemAllocations, itemPortion, receiptCents, salePayment, toCents } from '../../shared/saleAmounts'

export interface Funding {
  kind: 'CASH' | 'CARD' | 'VOUCHER'
  cents: number
  code?: string
  saleId?: string
}

export async function saleFunding(tx: Prisma.TransactionClient, sale: any, visited = new Set<string>()): Promise<Funding[]> {
  if (visited.has(sale.id) || visited.size > 100) throw new Error('Değişim ödeme zinciri doğrulanamadı.')
  visited.add(sale.id)
  const pay = salePayment(sale)
  if (Array.isArray(pay.funding)) return pay.funding
  let inherited: Funding[] = []
  if (toCents(pay.exchange?.credit)) {
    const original = await tx.sale.findUnique({ where: { id: pay.exchange.saleId }, include: { items: true } })
    if (!original) throw new Error('Değişimin ilk satış kaydı bulunamadı; iade öncesi kayıtları kontrol edin.')
    const funding = await saleFunding(tx, original, visited)
    const portions = allocateCents(toCents(pay.exchange.credit), funding.map(f => f.cents))
    inherited = funding.map((f, i) => ({ ...f, cents: portions[i] })).filter(f => f.cents)
  }
  return [...inherited,
    ...(toCents(pay.cash) ? [{ kind: 'CASH' as const, cents: toCents(pay.cash) }] : []),
    ...(toCents(pay.card) ? [{ kind: 'CARD' as const, cents: toCents(pay.card) }] : []),
    ...(toCents(pay.giftVoucher?.amount) ? [{ kind: 'VOUCHER' as const, cents: toCents(pay.giftVoucher.amount), code: pay.giftVoucher.code, saleId: sale.id }] : []),
  ]
}

// Consumed funding follows the product into the replacement receipt. Refunds on
// that receipt can restore original vouchers without paying their value in cash.
export async function consumeFunding(tx: Prisma.TransactionClient, sale: any, cents: number) {
  const pay = salePayment(sale)
  const funding = await saleFunding(tx, sale)
  if (funding.reduce((sum, f) => sum + f.cents, 0) !== receiptCents(sale)) throw new Error('Fiş ödeme dağılımı tutarsız; iade öncesi kayıtları kontrol edin.')
  let used: number[] = pay.fundingUsed
  if (!Array.isArray(used)) {
    const allocated = itemAllocations(sale)
    const handled = sale.items.reduce((sum: number, item: any, i: number) => sum + itemPortion(allocated[i], item.quantity, 0, item.returnedQuantity || 0), 0)
    used = allocateCents(handled, funding.map(f => f.cents))
  }
  const available = funding.map((f, i) => f.cents - (used[i] || 0))
  if (available.some(n => n < 0) || cents > available.reduce((a, b) => a + b, 0)) throw new Error('İade/değişim bedeli daha önce kullanılmış.')
  const amounts = allocateCents(cents, available)
  pay.funding = funding
  pay.fundingUsed = funding.map((_, i) => (used[i] || 0) + amounts[i])
  return { payment: pay, funding: funding.map((f, i) => ({ ...f, cents: amounts[i] })).filter(f => f.cents) }
}
