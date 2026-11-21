export interface AmountItem {
  id: string
  quantity: number
  returnedQuantity?: number
  unitPrice: number
}
export interface AmountSale {
  totalAmount: number
  paymentType?: any
  status?: string
  items: AmountItem[]
}

export const toCents = (amount: unknown): number => {
  const value = Number(amount)
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0
}

export function salePayment(sale: { totalAmount?: unknown; paymentType?: any }): any {
  let pay = sale.paymentType
  if (typeof pay === 'string') {
    try { pay = JSON.parse(pay) }
    catch { pay = pay === 'CARD' ? { cash: 0, card: sale.totalAmount } : pay === 'CASH' ? { cash: sale.totalAmount, card: 0 } : { note: pay } }
  }
  return pay && typeof pay === 'object' && !Array.isArray(pay) ? { ...pay } : {}
}

// Largest remainders keep the allocation exact, including discounts and surcharges.
export function allocateCents(total: number, weights: number[], keys = weights.map((_, i) => String(i))): number[] {
  if (!Number.isSafeInteger(total) || total < 0 || weights.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Fiş tutarı geçersiz.')
  const sum = weights.reduce((a, b) => a + b, 0)
  if (!Number.isSafeInteger(sum)) throw new Error('Fiş tutarı sınır dışında.')
  if (!sum) {
    if (total) throw new Error('Tutar paylaştırılamadı.')
    return weights.map(() => 0)
  }
  // BigInt avoids precision loss when multiplying two money amounts.
  const shares = weights.map(weight => BigInt(weight) * BigInt(total))
  const result = shares.map(value => Number(value / BigInt(sum)))
  const order = shares.map((value, index) => ({ index, remainder: value % BigInt(sum) }))
    .sort((a, b) => a.remainder === b.remainder ? keys[a.index].localeCompare(keys[b.index]) : a.remainder > b.remainder ? -1 : 1)
  let remaining = total - result.reduce((a, b) => a + b, 0)
  for (const { index } of order) { if (remaining-- <= 0) break; result[index]++ }
  return result
}

export function receiptCents(sale: Pick<AmountSale, 'totalAmount' | 'paymentType'>): number {
  return toCents(sale.totalAmount) + toCents(salePayment(sale).exchange?.credit)
}

export function itemAllocations(sale: AmountSale, budget = receiptCents(sale)): number[] {
  if (!sale.items.length) return []
  if (sale.items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0)) throw new Error('Fiş ürün tutarı veya adedi geçersiz.')
  let weights = sale.items.map(item => toCents(item.unitPrice) * item.quantity)
  if (!weights.some(Boolean)) weights = sale.items.map(item => item.quantity)
  return allocateCents(budget, weights, sale.items.map(item => item.id))
}

export function itemPortion(cents: number, quantity: number, offset: number, count: number): number {
  return Number(BigInt(cents) * BigInt(offset + count) / BigInt(quantity) - BigInt(cents) * BigInt(offset) / BigInt(quantity))
}

export function returnQuote(sale: AmountSale, lines: { saleItemId: string; returnQuantity: number }[]): number {
  const amounts = itemAllocations(sale)
  const seen = new Set<string>()
  return lines.reduce((sum, line) => {
    const index = sale.items.findIndex(item => item.id === line.saleItemId)
    const item = sale.items[index]
    const handled = item?.returnedQuantity || 0
    if (!item || seen.has(item.id) || !Number.isSafeInteger(line.returnQuantity) || line.returnQuantity <= 0
      || line.returnQuantity > item.quantity - handled) throw new Error('İade edilebilir ürün veya adet değişti; fişi yeniden sorgulayın.')
    seen.add(item.id)
    return sum + itemPortion(amounts[index], item.quantity, handled, line.returnQuantity)
  }, 0) / 100
}

export function formatSale(s: any) {
  const pay = salePayment(s)
  const items = s.items?.map((item: any) => {
    let attributes = item.variant?.attributes
    if (typeof attributes === 'string') { try { attributes = JSON.parse(attributes) } catch { attributes = {} } }
    return { ...item, variant: item.variant ? { ...item.variant, attributes } : undefined }
  })
  const receipt = receiptCents(s)
  const allocated = itemAllocations({ ...s, items: items || [] }, receipt)
  const calculated = (items || []).reduce((sum: number, item: any, index: number) => {
    const exchanged = Math.min(item.returnedQuantity || 0, Number(pay.exchangedItems?.[item.id]) || 0)
    const returned = Math.max(0, (item.returnedQuantity || 0) - exchanged)
    return sum + itemPortion(allocated[index], item.quantity, exchanged, returned)
  }, 0)
  const hasLoggedRefund = pay.refundCash !== undefined || pay.refundCard !== undefined || pay.refundGiftVoucher !== undefined
  const refund = hasLoggedRefund ? toCents(pay.refundCash) + toCents(pay.refundCard) + toCents(pay.refundGiftVoucher)
    : s.status === 'RETURNED' ? receipt : calculated
  if (!hasLoggedRefund && refund > 0 && !pay.giftVoucher) {
    const split = allocateCents(refund, [toCents(pay.cash), toCents(pay.card)])
    pay.refundCash = split[0] / 100
    pay.refundCard = split[1] / 100
  }
  const cash = toCents(pay.cash), card = toCents(pay.card)
  return {
    ...s, items, receiptAmount: receipt / 100, refundAmount: refund / 100,
    netAmount: (toCents(s.totalAmount) - refund) / 100,
    paymentType: {
      ...pay, cash: cash / 100, card: card / 100,
      refundCash: toCents(pay.refundCash) / 100, refundCard: toCents(pay.refundCard) / 100,
      refundTotal: refund / 100, netCash: (cash - toCents(pay.refundCash)) / 100,
      netCard: (card - toCents(pay.refundCard)) / 100,
      netGiftVoucher: Math.max(0, toCents(pay.giftVoucher?.amount) - toCents(pay.refundGiftVoucher)) / 100,
    },
  }
}
