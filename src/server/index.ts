import express from 'express'
import cors from 'cors'
import path from 'path'
import { getLocalIpAddress, getAllLocalIpAddresses } from './utils/network'
import { productRouter } from './routes/products'
import { salesRouter } from './routes/sales'
import { mobileRouter } from './routes/mobile'
import { printRouter } from './routes/print'
import { systemRouter } from './routes/system'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

import fs from 'fs'

// Determine public directory for mobile static assets
const getPublicDir = () => {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/server/public'),
    path.resolve(process.cwd(), 'dist-electron/main/public'),
    path.join(__dirname, 'public'),
    path.join(__dirname, '../public'),
  ]
  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'mobile.html'))) {
      return p
    }
  }
  return path.resolve(process.cwd(), 'src/server/public')
}

const publicDir = getPublicDir()

// Serve mobile static assets
app.use('/mobile', express.static(publicDir))
app.get('/mobile', (req, res) => {
  const mobileHtmlPath = path.join(publicDir, 'mobile.html')
  if (fs.existsSync(mobileHtmlPath)) {
    res.sendFile(mobileHtmlPath)
  } else {
    res.status(404).send('Mobil sayfa dosyası bulunamadı.')
  }
})

// Register API Routes
app.use('/api/products', productRouter)
app.use('/api/sales', salesRouter)
app.use('/api/mobile', mobileRouter)
app.use('/api/print', printRouter)
app.use('/api/system', systemRouter)

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    serverTime: new Date().toISOString(),
    localIp: getLocalIpAddress(),
    allIps: getAllLocalIpAddresses(),
    port: PORT
  })
})

export function startServer() {
  const server = app.listen(PORT, () => {
    const localIp = getLocalIpAddress()
    console.log(`====================================================`)
    console.log(`🚀 MagazaPOS Sunucusu Başlatıldı!`)
    console.log(`📡 Yerel Masaüstü API: http://localhost:${PORT}`)
    console.log(`📱 Mobil Depo/Wi-Fi Erişimi: http://${localIp}:${PORT}/mobile`)
    console.log(`====================================================`)
  })

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[INFO] Port ${PORT} halihazırda kullanımda. Sunucu çalışmaya devam ediyor.`)
    } else {
      console.error('Sunucu hatası:', err)
    }
  })

  return server
}

// Start standalone if executed directly
if (require.main === module) {
  startServer()
}
