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
  let pay = sale.paymentType
  if (typeof pay === 'string') {
    try { pay = JSON.parse(pay) }
    catch { pay = pay === 'CARD' ? { card: sale.totalAmount } : { cash: sale.totalAmount } }
  }
  pay = pay && typeof pay === 'object' ? pay : {}
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
  refundCash = Math.min(cash, refundCash)
  refundCard = Math.min(card, refundCard)
  return { cash, card, refundCash, refundCard, netCash: cash - refundCash, netCard: card - refundCard }
}

export function matchesReportPayment(sale: Parameters<typeof saleCollections>[0], payment: PaymentFilter): boolean {
  if (payment === 'ALL') return true
  const collection = saleCollections(sale)
  return payment === 'CASH' ? collection.cash > 0 : collection.card > 0
}
