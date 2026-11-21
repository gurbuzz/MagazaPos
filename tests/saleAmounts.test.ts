import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allocateCents, formatSale, returnQuote } from '../src/shared/saleAmounts'
import { exchangeCredit } from '../src/shared/exchanges'
import { reportDateIso, saleCollections } from '../src/shared/salesReporting'

test('separate returns use the same discounted receipt allocation as exchanges', () => {
  const sale = { totalAmount: 10, paymentType: { cash: 10, card: 0 }, items: [{ id: 'a', quantity: 3, returnedQuantity: 0, unitPrice: 4 }] }
  const refunds: number[] = []
  for (let i = 0; i < 3; i++) {
    const refund = returnQuote(sale, [{ saleItemId: 'a', returnQuantity: 1 }])
    assert.equal(refund, exchangeCredit(sale, [{ itemId: 'a', quantity: 1 }]))
    refunds.push(refund)
    sale.items[0].returnedQuantity++
  }
  assert.deepEqual(refunds, [3.33, 3.33, 3.34])
  assert.equal(Math.round(refunds.reduce((a, b) => a + b, 0) * 100), 1000)
})

test('surcharges and exchange credit are included in the value of returned goods', () => {
  const sale = { totalAmount: 1200, items: [{ id: 'a', quantity: 2, unitPrice: 500 }] }
  assert.equal(returnQuote(sale, [{ saleItemId: 'a', returnQuantity: 2 }]), 1200)
  assert.equal(exchangeCredit(sale, [{ itemId: 'a', quantity: 2 }]), 1200)
  const replacement = { ...sale, totalAmount: 200, paymentType: { cash: 200, exchange: { credit: 1000 } } }
  assert.equal(returnQuote(replacement, [{ saleItemId: 'a', returnQuantity: 2 }]), 1200)
})

test('a return may make one payment channel negative without losing any refund', () => {
  const sale = { totalAmount: 1000, paymentType: { cash: 200, card: 800, refundCash: 1000, refundCard: 0 }, items: [{ id: 'a', quantity: 1, unitPrice: 1000, returnedQuantity: 1 }], status: 'RETURNED' }
  assert.deepEqual(saleCollections(formatSale(sale)), { cash: 20000, card: 80000, refundCash: 100000, refundCard: 0, netCash: -80000, netCard: 80000 })
  const explicitZero = formatSale({ ...sale, paymentType: { cash: 200, card: 800, refundCash: 0, refundCard: 0 } })
  assert.equal(explicitZero.refundAmount, 0, 'Explicit historical zeros are not replaced with invented payouts')
})

test('allocation conserves money for small and large amounts and is independent of item order', () => {
  for (const total of [0, 1, 2, 1000, 100000000]) {
    const shares = allocateCents(total, [33333333, 77777777, 99999999], ['a', 'b', 'c'])
    assert.equal(shares.reduce((a, b) => a + b, 0), total)
    assert.ok(shares.every(n => n >= 0 && Number.isSafeInteger(n)))
  }
  const items = [{ id: 'b', quantity: 1, unitPrice: 1 }, { id: 'a', quantity: 1, unitPrice: 1 }]
  assert.equal(returnQuote({ totalAmount: 0.01, items }, [{ saleItemId: 'a', returnQuantity: 1 }]), returnQuote({ totalAmount: 0.01, items: [...items].reverse() }, [{ saleItemId: 'a', returnQuantity: 1 }]))
})

test('end-of-minute report bounds include seconds and carry the browser timezone', () => {
  const previous = process.env.TZ
  process.env.TZ = 'Europe/Istanbul'
  try {
    assert.equal(reportDateIso('2020-01-01T23:59', true), '2020-01-01T20:59:59.999Z')
    assert.equal(reportDateIso('2020-01-01T00:00'), '2019-12-31T21:00:00.000Z')
    assert.equal(reportDateIso('2020-01-01T23:59:30+03:00', true), '2020-01-01T20:59:30.000Z')
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})
