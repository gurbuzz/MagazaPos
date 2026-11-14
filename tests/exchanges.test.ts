import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exchangeCredit, exchangeLines } from '../src/shared/exchanges'

test('multiple products and quantities share the original discounted paid value', () => {
  const sale = { totalAmount: 360, items: [
    { id: 'a', quantity: 2, returnedQuantity: 0, unitPrice: 100 },
    { id: 'b', quantity: 1, returnedQuantity: 0, unitPrice: 200 },
  ] }
  assert.equal(exchangeCredit(sale, [{ itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 1 }]), 360)
  assert.equal(exchangeCredit(sale, [{ itemId: 'a', quantity: 1 }, { itemId: 'b', quantity: 1 }]), 270)
  assert.deepEqual(exchangeLines({ itemId: 'a' }), [{ itemId: 'a', quantity: 1 }])
  assert.equal(exchangeCredit({ ...sale, totalAmount: 60, paymentType: { exchange: { credit: 300 } } }, [{ itemId: 'a', quantity: 2 }, { itemId: 'b', quantity: 1 }]), 360)
})

test('rounding cannot exceed the receipt value across separate exchange transactions', () => {
  const sale = { totalAmount: 1, items: [
    { id: 'a', quantity: 3, returnedQuantity: 0, unitPrice: 1 },
    { id: 'b', quantity: 1, returnedQuantity: 0, unitPrice: 1 },
  ] }
  let totalCents = 0
  for (let i = 0; i < 3; i++) {
    totalCents += Math.round(exchangeCredit(sale, [{ itemId: 'a', quantity: 1 }]) * 100)
    sale.items[0].returnedQuantity++
  }
  totalCents += Math.round(exchangeCredit(sale, [{ itemId: 'b', quantity: 1 }]) * 100)
  assert.equal(totalCents, 100)
  const tied = { totalAmount: 0.01, items: [{ id: 'b', quantity: 1, unitPrice: 1 }, { id: 'a', quantity: 1, unitPrice: 1 }] }
  assert.equal(exchangeCredit(tied, [{ itemId: 'a', quantity: 1 }]), exchangeCredit({ ...tied, items: [...tied.items].reverse() }, [{ itemId: 'a', quantity: 1 }]))
})

test('duplicate, missing, exhausted and invalid quantity selections are rejected', () => {
  for (const quantity of [0, -1, 1.5, Infinity, '2', NaN]) {
    assert.throws(() => exchangeLines({ items: [{ itemId: 'a', quantity: quantity as number }] }))
  }
  assert.throws(() => exchangeLines({ items: [{ itemId: 'a', quantity: 1 }, { itemId: 'a', quantity: 1 }] }))
  const sale = { totalAmount: 100, items: [{ id: 'a', quantity: 2, returnedQuantity: 1, unitPrice: 50 }] }
  assert.throws(() => exchangeCredit(sale, [{ itemId: 'a', quantity: 2 }]))
  assert.throws(() => exchangeCredit(sale, [{ itemId: 'missing', quantity: 1 }]))
  assert.throws(() => exchangeCredit({ ...sale, status: 'CANCELLED' }, [{ itemId: 'a', quantity: 1 }]))
})
