import type { RequestHandler } from 'express'

export function createUpdateMaintenance(timeoutMs = 15000, pollMs = 100) {
  let maintenance = false
  let activeRequests = 0
  const middleware: RequestHandler = (req, res, next) => {
    if (maintenance) {
      res.status(503).json({ error: 'Güncelleme için uygulama kapatılıyor.' })
      return
    }
    // This read-only SSE endpoint intentionally remains open for the lifetime
    // of the customer display. It performs no database work to drain.
    if (req.method === 'GET' && req.path.replace(/\/+$/, '').toLowerCase() === '/api/customer-display/events') {
      next()
      return
    }
    activeRequests++
    let finished = false
    const done = () => { if (!finished) { finished = true; activeRequests-- } }
    res.once('finish', done)
    res.once('close', done)
    next()
  }
  async function begin(): Promise<void> {
    maintenance = true
    const deadline = Date.now() + timeoutMs
    while (activeRequests > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, pollMs))
    }
    if (activeRequests > 0) {
      maintenance = false
      throw new Error('Devam eden işlemler tamamlanamadı. Tekrar deneyin.')
    }
  }
  function end(): void { maintenance = false }
  return { middleware, begin, end }
}
