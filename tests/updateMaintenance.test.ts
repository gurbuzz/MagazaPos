import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { createUpdateMaintenance } from '../src/server/services/updateMaintenance'
import express from 'express'
import { get } from 'node:http'
import { once } from 'node:events'
import { customerDisplayRouter } from '../src/server/routes/customerDisplay'

function request(gate: ReturnType<typeof createUpdateMaintenance>, method: string, path: string) {
  const response = Object.assign(new EventEmitter(), {
    statusCode: 200, body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this },
    json(body: unknown) { this.body = body; return this },
  })
  let accepted = false
  gate.middleware({ method, path } as any, response as any, () => { accepted = true })
  return { response, accepted }
}

test('open customer display SSE does not block update backup and installation', async () => {
  const gate = createUpdateMaintenance(0)
  assert.equal(request(gate, 'GET', '/api/customer-display/events').accepted, true)
  await gate.begin()
  assert.equal(request(gate, 'GET', '/api/customer-display/events').response.statusCode, 503)
  gate.end()
  assert.equal(request(gate, 'GET', '/api/customer-display/events/').accepted, true)
})

test('in-flight sales must finish and new sales are blocked during maintenance', async () => {
  const gate = createUpdateMaintenance(1000, 1)
  const sale = request(gate, 'POST', '/api/sales')
  let ready = false
  const starting = gate.begin().then(() => { ready = true })
  assert.equal(ready, false)
  const blocked = request(gate, 'POST', '/api/sales')
  assert.equal(blocked.accepted, false)
  assert.equal(blocked.response.statusCode, 503)
  sale.response.emit('finish')
  await starting
  assert.equal(ready, true)
  gate.end()
  assert.equal(request(gate, 'POST', '/api/sales').accepted, true)
})

test('timeout resumes normal service instead of allowing installation with an active sale', async () => {
  const gate = createUpdateMaintenance(0)
  request(gate, 'POST', '/api/sales')
  await assert.rejects(gate.begin(), /Devam eden işlemler/)
  assert.equal(request(gate, 'GET', '/api/health').accepted, true)
})

test('finish followed by close is counted once; only the read-only SSE path is exempt', async () => {
  const gate = createUpdateMaintenance(0)
  const finished = request(gate, 'GET', '/api/health')
  finished.response.emit('finish')
  finished.response.emit('close')
  const write = request(gate, 'POST', '/api/customer-display/events')
  await assert.rejects(gate.begin())
  write.response.emit('close')
  await gate.begin()
})

test('a real open customer display stream does not prevent update preparation', async () => {
  const gate = createUpdateMaintenance(100, 1)
  const app = express()
  app.use(gate.middleware)
  app.use('/api/customer-display', customerDisplayRouter)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`
  const req = get(base + '/api/customer-display/events')
  try {
    const [response] = await once(req, 'response') as [import('node:http').IncomingMessage]
    await once(response, 'data')
    assert.equal(response.headers['content-type'], 'text/event-stream')
    assert.equal(response.complete, false)
    await gate.begin()
    assert.equal((await fetch(base + '/api/customer-display/state')).status, 503)
    gate.end()
    assert.equal((await fetch(base + '/api/customer-display/state')).status, 200)
  } finally {
    req.destroy()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
