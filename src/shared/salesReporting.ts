import { salePayment } from './saleAmounts'

export type PaymentFilter = 'ALL' | 'CASH' | 'CARD'

export function reportPaymentFilter(value: unknown): PaymentFilter {
  return value === 'CASH' || value === 'CARD' ? value : 'ALL'
}

const cents = (value: unknown) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0
}

// Product receipt totals stay unchanged. These metrics describe money collected
// at checkout, excluding prepaid voucher value and refunds restored to vouchers.
export function saleCollections(sale: { totalAmount?: unknown; paymentType?: any; refundAmount?: unknown; status?: string }) {
  const pay = salePayment(sale)
  if (sale.status === 'CANCELLED') return { cash: 0, card: 0, refundCash: 0, refundCard: 0, netCash: 0, netCard: 0 }
  const cash = cents(pay.cash)
  const card = cents(pay.card)
  let refundCash = cents(pay.refundCash)
  let refundCard = cents(pay.refundCard)
  if (pay.refundCash === undefined && pay.refundCard === undefined && !pay.giftVoucher) {
    const refund = Math.min(cash + card, cents(sale.refundAmount ?? (sale.status === 'RETURNED' ? sale.totalAmount : 0)))
    refundCash = cash + card > 0 ? Math.round(refund * cash / (cash + card)) : 0
    refundCard = refund - refundCash
  }
  return { cash, card, refundCash, refundCard, netCash: cash - refundCash, netCard: card - refundCard }
}

export function matchesReportPayment(sale: Parameters<typeof saleCollections>[0], payment: PaymentFilter): boolean {
  if (payment === 'ALL') return true
  const collection = saleCollections(sale)
  return payment === 'CASH' ? collection.cash > 0 || collection.refundCash > 0 : collection.card > 0 || collection.refundCard > 0
}

// datetime-local inputs omit the timezone. Send instants from the browser, and
// include the whole chosen end minute rather than stopping at second zero.
export function reportDateIso(value: string, end = false): string {
  const date = new Date(value)
  if (end && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) date.setSeconds(59, 999)
  return date.toISOString()
}
