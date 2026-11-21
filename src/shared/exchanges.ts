import { itemAllocations, itemPortion } from './saleAmounts'

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
  const allocated = itemAllocations(sale)
  let credit = 0
  for (const line of exchangeLines({ items: lines })) {
    const index = sale.items.findIndex(item => item.id === line.itemId)
    const item = sale.items[index]
    const handled = item?.returnedQuantity || 0
    if (!item || !Number.isSafeInteger(item.quantity) || item.quantity < 1
      || !Number.isSafeInteger(handled) || handled < 0 || line.quantity > item.quantity - handled) {
      throw new Error('Değiştirilecek ürün veya adet artık kullanılabilir değil; fişi yeniden sorgulayın.')
    }
    credit += itemPortion(allocated[index], item.quantity, handled, line.quantity)
  }
  return credit / 100
}
