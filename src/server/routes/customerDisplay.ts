import { Router, Response } from 'express'

export const customerDisplayRouter = Router()

// Default initial state
let currentState: any = {
  status: 'idle', // 'idle' | 'cart' | 'checkout' | 'completed'
  storeName: 'JACK & JONES',
  storeAddress: 'Atatürk Cad. No:14/A Kadıköy / İstanbul',
  storePhone: '0216 345 67 89',
  cashierName: 'Kasiyer 1',
  cartItems: [],
  subtotal: 0,
  discountAmount: 0,
  total: 0,
  activeCampaign: null,
  selectedCustomer: null,
  paymentInfo: null,
  hidePrices: false,
  updatedAt: new Date().toISOString(),
}

// SSE Clients set
const sseClients = new Set<Response>()

function broadcastSSE(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`
  sseClients.forEach((client) => {
    try {
      client.write(payload)
    } catch {
      sseClients.delete(client)
    }
  })
}

// GET /api/customer-display/state - Get current display state
customerDisplayRouter.get('/state', (_req, res) => {
  res.json(currentState)
})

// POST /api/customer-display/state - Update state from Cashier POS
customerDisplayRouter.post('/state', (req, res) => {
  try {
    const update = req.body || {}
    currentState = {
      ...currentState,
      ...update,
      updatedAt: new Date().toISOString(),
    }
    broadcastSSE(currentState)
    res.json({ success: true, state: currentState })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/customer-display/events - SSE Stream for Live Web Tablets/Screens
customerDisplayRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  // Send current state immediately on connect
  res.write(`data: ${JSON.stringify(currentState)}\n\n`)

  sseClients.add(res)

  req.on('close', () => {
    sseClients.delete(res)
  })
})
