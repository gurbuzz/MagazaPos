import { Request, Response, NextFunction } from 'express'
import fs from 'fs'
import path from 'path'
import { getUserDataDir } from './paths'

function getSecurityConfigPath(): string {
  const dataDir = path.join(getUserDataDir(), 'data')
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true })
    } catch (e) {}
  }
  const configPath = path.join(dataDir, 'security.json')

  // Migration: If legacy config exists in process.cwd()/data/security.json, copy it over
  try {
    const legacyPath = path.resolve(process.cwd(), 'data/security.json')
    if (legacyPath !== configPath && fs.existsSync(legacyPath) && !fs.existsSync(configPath)) {
      fs.copyFileSync(legacyPath, configPath)
      console.log('[Security] Migrated security.json to AppData:', configPath)
    }
  } catch (e) {}

  return configPath
}

interface SecurityConfig {
  pin: string
  adminPin: string
  updatedAt: string
}

function ensureConfigDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readConfig(): Partial<SecurityConfig> {
  const configPath = getSecurityConfigPath()
  try {
    ensureConfigDir(configPath)
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (err) {
    console.error('Error reading security config:', err)
  }
  return {}
}

function writeConfig(updates: Partial<SecurityConfig>): boolean {
  const configPath = getSecurityConfigPath()
  try {
    ensureConfigDir(configPath)
    const existing = readConfig()
    const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Error writing security config:', err)
    return false
  }
}

// ─── Kasa PIN (4 haneli) ───────────────────────────────────────

export function getSystemPin(): string {
  const data = readConfig()
  if (data.pin && typeof data.pin === 'string' && data.pin.length === 4) {
    return data.pin
  }
  return '1234'
}

export function setSystemPin(newPin: string): boolean {
  return writeConfig({ pin: newPin })
}

// ─── Yönetici PIN (6 haneli) ───────────────────────────────────

export function getAdminPin(): string {
  const data = readConfig()
  if (data.adminPin && typeof data.adminPin === 'string' && data.adminPin.length === 6) {
    return data.adminPin
  }
  return '000000'
}

export function setAdminPin(newPin: string): boolean {
  return writeConfig({ adminPin: newPin })
}

// ─── Middleware: Kasa PIN Doğrulama ────────────────────────────

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

// ─── Middleware: Yönetici PIN Doğrulama ────────────────────────

export function requireAdminPinAuth(req: Request, res: Response, next: NextFunction): void {
  const providedPin =
    (req.headers['x-admin-pin'] as string) ||
    (req.query.adminPin as string) ||
    (req.body && req.body.adminPin)

  const currentAdminPin = getAdminPin()

  if (!providedPin || providedPin !== currentAdminPin) {
    res.status(401).json({
      error: 'Yetkisiz işlem: Geçersiz Yönetici PIN Şifresi!',
      code: 'UNAUTHORIZED_ADMIN_PIN'
    })
    return
  }

  next()
}
