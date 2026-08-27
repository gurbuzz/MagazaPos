import { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.resolve(process.cwd(), 'data/security.json')

function ensureConfigDir() {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function getSystemPin(): string {
  try {
    ensureConfigDir()
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
      if (data && typeof data.pin === 'string' && data.pin.length === 4) {
        return data.pin
      }
    }
  } catch (err) {
    console.error('Error reading security pin:', err)
  }
  return '1234'
}

export function setSystemPin(newPin: string): boolean {
  try {
    ensureConfigDir()
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ pin: newPin, updatedAt: new Date().toISOString() }, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Error writing security pin:', err)
    return false
  }
}

export function requirePinAuth(req: Request, res: Response, next: NextFunction): void {
  const providedPin =
    (req.headers['x-pin-code'] as string) ||
    (req.query.pin as string) ||
    (req.body && req.body.pinCode)

  const currentPin = getSystemPin()

  if (!providedPin || providedPin !== currentPin) {
    res.status(401).json({
      error: 'Yetkisiz işlem: Geçersiz Kasa Güvenlik PIN Şifresi!',
      code: 'UNAUTHORIZED_PIN'
    })
    return
  }

  next()
}
