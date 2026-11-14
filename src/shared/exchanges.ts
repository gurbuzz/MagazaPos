export interface ExchangeLine { itemId: string; quantity: number }
export interface ExchangeSelection {
  saleId: string
  credit: number
  items?: (ExchangeLine & { productName?: string; variantLabel?: string })[]
  // Older saved carts and clients used a single item with quantity 1.
  itemId?: string
}

interface ExchangeSale {
  status?: string
  totalAmount: number
  paymentType?: any
  items: { id: string; quantity: number; returnedQuantity?: number; unitPrice: number }[]
}

export function exchangeLines(selection: Pick<ExchangeSelection, 'items' | 'itemId'>): ExchangeLine[] {
  const lines = selection.items === undefined && selection.itemId
    ? [{ itemId: selection.itemId, quantity: 1 }]
    : selection.items
  if (!Array.isArray(lines) || !lines.length || lines.length > 1000) throw new Error('Değiştirilecek ürünleri seçin.')
  const seen = new Set<string>()
  return lines.map(line => {
    if (!line || typeof line.itemId !== 'string' || !line.itemId || seen.has(line.itemId)
      || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error('Değişim ürünleri ve adetleri geçersiz.')
    seen.add(line.itemId)
    return { itemId: line.itemId, quantity: line.quantity }
  })
}

// Allocate the receipt's paid value in cents. Remainders stay on the receipt so
// multiple products/units never create extra credit through rounding.
export function exchangeCredit(sale: ExchangeSale, lines: ExchangeLine[]): number {
  if (sale.status === 'CANCELLED' || sale.status === 'RETURNED') throw new Error('Bu fiş değişim için kullanılamaz.')
  let payment = sale.paymentType
  if (typeof payment === 'string') { try { payment = JSON.parse(payment) } catch { payment = {} } }
  const values = sale.items.map(item => Math.round(Number(item.unitPrice) * 100) * item.quantity)
  if (values.some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('Fiş ürün tutarı geçersiz.')
  const subtotal = values.reduce((sum, value) => sum + value, 0)
  const paid = Math.round((Number(sale.totalAmount) + (Number(payment?.exchange?.credit) || 0)) * 100)
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || !Number.isSafeInteger(paid) || paid < 0) throw new Error('Fiş tutarı geçersiz.')
  const budget = Math.min(subtotal, paid)
  const shares = values.map(value => subtotal > 0 ? value * budget / subtotal : 0)
  const allocated = shares.map(Math.floor)
  let remainder = budget - allocated.reduce((sum, value) => sum + value, 0)
  const order = shares.map((value, index) => ({ index, fraction: value - allocated[index] }))
    .sort((a, b) => b.fraction - a.fraction || sale.items[a.index].id.localeCompare(sale.items[b.index].id))
  for (const { index } of order) { if (remainder-- <= 0) break; allocated[index]++ }
  let credit = 0
  for (const line of exchangeLines({ items: lines })) {
    const index = sale.items.findIndex(item => item.id === line.itemId)
    const item = sale.items[index]
    const handled = item?.returnedQuantity || 0
    if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1
      || !Number.isSafeInteger(handled) || handled < 0 || line.quantity > item.quantity - handled) {
      throw new Error('Değiştirilecek ürün veya adet artık kullanılabilir değil; fişi yeniden sorgulayın.')
    }
    credit += Math.floor(allocated[index] * (handled + line.quantity) / item.quantity)
      - Math.floor(allocated[index] * handled / item.quantity)
  }
  return credit / 100
}
