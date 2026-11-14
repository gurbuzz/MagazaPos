export const PENDING_VOUCHER_ISSUE = 'pos_pending_voucher_issue'
export const PENDING_VOUCHER_CHECKOUT = 'pos_pending_voucher_checkout'

export function readPending<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try { return JSON.parse(raw) as T }
  catch { throw new Error('Önceki çek işlemi okunamadı. Yeni işlem yapmadan satış geçmişini kontrol edin.') }
}
