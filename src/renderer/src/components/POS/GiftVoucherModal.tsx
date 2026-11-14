import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Gift, X, Printer, Search, Loader2 } from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'
import { printReceipt } from '../../utils/printReceipt'
import { PENDING_VOUCHER_ISSUE, readPending } from '../../utils/giftVoucherPending'

type Voucher = { code: string; initialCents: number; balanceCents: number; paymentMethod: string; createdAt: string; movements?: { id: string; type: string; amountCents: number; createdAt: string }[] }
const money = (cents: number) => (cents / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })

export function GiftVoucherModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const store = usePosStore()
  const [tab, setTab] = useState<'create' | 'lookup'>('create')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [adminPin, setAdminPin] = useState('')
  const [code, setCode] = useState('')
  const [selected, setSelected] = useState<Voucher | null>(null)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [totals, setTotals] = useState<{ paymentMethod: string; issued: number; balance: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const requestId = useRef('')
  const inFlight = useRef(false)
  const [uncertain, setUncertain] = useState(false)
  const [recoveryError, setRecoveryError] = useState(false)
  const load = async () => {
    const res = await fetch('/api/gift-vouchers')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    setVouchers(data.vouchers); setTotals(data.totals)
  }
  useEffect(() => {
    if (isOpen) {
      load().catch(err => setMessage(err.message))
      try {
        const pending = readPending<{ requestId: string; amount: string; method: string }>(PENDING_VOUCHER_ISSUE)
        if (pending) {
          requestId.current = pending.requestId; setAmount(pending.amount); setMethod(pending.method)
          setUncertain(true); setTab('create'); setSelected(null)
          setMessage('Önceki işlemin sonucu doğrulanamadı. Aynı İşlemi Yeniden Dene düğmesini kullanın; ikinci çek oluşturulmaz.')
        } else if (!requestId.current) requestId.current = crypto.randomUUID()
      } catch (err: any) { setMessage(err.message); setRecoveryError(true) }
    }
  }, [isOpen])
  if (!isOpen) return null

  const print = async (voucher: Voucher) => {
    const response = await fetch(`/api/gift-vouchers/${encodeURIComponent(voucher.code)}`)
    const current = await response.json()
    if (!response.ok) throw new Error(current.error || 'Çek bakiyesi doğrulanamadı.')
    voucher = current
    setSelected(current)
    const result = await printReceipt({
      receiptNo: voucher.code, createdAt: voucher.createdAt, totalAmount: voucher.initialCents / 100,
      items: [], storeInfo: store, voucherIssue: voucher,
    })
    setMessage(result.success ? 'Çek fişi yazıcıya gönderildi. Tekrar baskı aynı çeki kullanır.' : `Çek kayıtlı. Yazdırma başarısız: ${result.error}. Tekrar Yazdır düğmesini kullanın.`)
  }
  const create = async () => {
    if (inFlight.current || recoveryError) return
    inFlight.current = true; setBusy(true); setMessage('')
    try {
      setUncertain(true)
      localStorage.setItem(PENDING_VOUCHER_ISSUE, JSON.stringify({ requestId: requestId.current, amount, method }))
      const res = await fetch('/api/gift-vouchers', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(method === 'COMPLIMENTARY' ? { 'X-Admin-Pin': adminPin } : {}) }, body: JSON.stringify({ amount, paymentMethod: method, cashierName: store.cashierName, requestId: requestId.current }) })
      const data = await res.json()
      if (!res.ok) { setUncertain(false); localStorage.removeItem(PENDING_VOUCHER_ISSUE); throw new Error(data.error) }
      localStorage.removeItem(PENDING_VOUCHER_ISSUE)
      requestId.current = crypto.randomUUID()
      setSelected(data); setUncertain(false); setAdminPin('')
      await print(data)
      await load()
    } catch (err: any) { setMessage(err.message || 'Bağlantı hatası. Aynı işlemi yeniden deneyin.') }
    finally { setBusy(false); inFlight.current = false }
  }
  const lookup = async (target = code) => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setMessage(''); setSelected(null)
    try {
      const res = await fetch(`/api/gift-vouchers/${encodeURIComponent(target.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSelected(data)
    } catch (err: any) { setMessage(err.message) }
    finally { setBusy(false); inFlight.current = false }
  }
  const newVoucher = () => { requestId.current = crypto.randomUUID(); setSelected(null); setAmount(''); setMessage(''); setTab('create') }
  const close = () => { if (!busy && (!uncertain || window.confirm('İşlemin sonucu henüz doğrulanmadı. Tekrar açıp aynı işlemi deneyebilirsiniz. Pencere kapatılsın mı?'))) onClose() }

  return createPortal(<div className="fixed inset-0 z-[70] bg-slate-950/60 flex items-center justify-center p-4">
    <section role="dialog" aria-modal="true" aria-label="Hediye Çekleri" className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto text-slate-800">
      <div className="flex justify-between items-center p-4 border-b"><h2 className="font-bold flex gap-2 items-center"><Gift className="text-purple-600" />Hediye Çekleri</h2><button type="button" aria-label="Kapat" disabled={busy} onClick={close}><X /></button></div>
      <div className="p-4 space-y-4">
        <div className="flex gap-2"><button type="button" disabled={busy || uncertain} onClick={() => setTab('create')} className={`px-4 py-2 rounded-lg ${tab === 'create' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100'}`}>Çek Oluştur</button><button type="button" disabled={busy || uncertain} onClick={() => { setTab('lookup'); setSelected(null) }} className={`px-4 py-2 rounded-lg ${tab === 'lookup' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100'}`}>Sorgula / Tekrar Yazdır</button></div>
        {tab === 'create' && !selected && <form onSubmit={e => { e.preventDefault(); create() }} className="space-y-3">
          <p className="text-sm text-slate-600">Ürün eklemeden tutarlı çek oluşturun. Tahsilatı doğruladıktan sonra fişi basın.</p>
          <label className="block text-sm font-semibold">Çek tutarı (TL)<input required disabled={busy || uncertain} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="block w-full border rounded-lg p-3 mt-1 text-xl" placeholder="1.000,00 yerine 1000,00" /></label>
          <label className="block text-sm font-semibold">Tahsilat<select disabled={busy || uncertain} value={method} onChange={e => setMethod(e.target.value)} className="block border rounded-lg p-3 mt-1 w-full"><option value="CASH">Nakit tahsil edildi</option><option value="CARD">Kart tahsil edildi</option><option value="COMPLIMENTARY">Mağaza hediyesi (Yönetici PIN)</option></select></label>
          {method === 'COMPLIMENTARY' && <label className="block text-sm">Yönetici PIN<input type="password" required maxLength={6} value={adminPin} onChange={e => setAdminPin(e.target.value)} className="block border rounded-lg p-2 w-full" /></label>}
          <button disabled={busy || recoveryError || !amount.trim()} className="w-full bg-purple-700 text-white rounded-lg p-3 font-bold disabled:opacity-50">{busy ? 'İşleniyor…' : uncertain ? 'Aynı İşlemi Yeniden Dene' : 'Çeki Oluştur ve Fiş Bas'}</button>
        </form>}
        {tab === 'lookup' && <form onSubmit={e => { e.preventDefault(); lookup() }} className="flex gap-2"><input aria-label="Çek kodu" autoFocus value={code} onChange={e => setCode(e.target.value)} placeholder="Barkodu okutun veya çek kodunu girin" className="border rounded-lg p-2 flex-1 min-w-0" /><button type="submit" disabled={busy || !code.trim()} className="p-2 rounded-lg bg-purple-100" aria-label="Sorgula"><Search /></button></form>}
        {selected && <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 space-y-3">
          <div className="font-mono font-bold break-all">{selected.code}</div><div className="text-2xl font-bold text-purple-800">Kalan: {money(selected.balanceCents)}</div><div className="text-sm">İlk tutar: {money(selected.initialCents)} · {new Date(selected.createdAt).toLocaleString('tr-TR')}</div>
          <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await print(selected) } catch (err: any) { setMessage(err.message) } finally { setBusy(false) } }} className="bg-purple-700 text-white px-4 py-2 rounded-lg inline-flex gap-2"><Printer size={18} />Tekrar Yazdır</button>
          {tab === 'create' && <button type="button" disabled={busy} onClick={newVoucher} className="ml-3 underline">Yeni Çek</button>}
          {selected.movements?.map(m => <div key={m.id} className="text-xs border-t pt-2 flex justify-between"><span>{({ ISSUE: 'Oluşturma', REDEEM: 'Alışveriş', REFUND: 'İade' } as Record<string, string>)[m.type]} · {new Date(m.createdAt).toLocaleString('tr-TR')}</span><span>{money(m.amountCents)}</span></div>)}
        </div>}
        {busy && <Loader2 className="animate-spin text-purple-600" />}
        {message && <p role="status" className="text-sm rounded-lg bg-amber-50 text-amber-900 p-3">{message}</p>}
        <div className="text-xs text-slate-600 space-y-1 border-t pt-3"><p className="font-semibold">Çek tahsilatları (ürün satışlarından ayrı)</p>{totals.map(t => <p key={t.paymentMethod}>{({ CASH: 'Nakit', CARD: 'Kart', COMPLIMENTARY: 'Mağaza hediyesi' } as Record<string, string>)[t.paymentMethod]}: {t.issued.toFixed(2)} TL · Kullanılmamış: {t.balance.toFixed(2)} TL</p>)}</div>
        <div className="space-y-1"><h3 className="text-xs font-bold">Son 50 çek</h3>{vouchers.map(v => <button key={v.code} type="button" disabled={busy || uncertain} onClick={() => { setCode(v.code); setTab('lookup'); lookup(v.code) }} className="w-full flex justify-between text-xs p-2 rounded hover:bg-slate-100"><span className="font-mono">{v.code}</span><span>{money(v.balanceCents)}</span></button>)}</div>
      </div>
    </section>
  </div>, document.body)
}
