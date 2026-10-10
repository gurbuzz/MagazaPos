import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getUserDataDir } from './paths'

export const LICENSE_SECRET = 'MagazaPOS_2026_Secure_License_Key_@Antigravity'

let cachedRawHardwareId: string | null = null
let cachedDeviceId: string | null = null

function getLicenseFilePath(): string {
  const dataDir = path.join(getUserDataDir(), 'data')
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true })
    } catch (e) {}
  }
  const licensePath = path.join(dataDir, 'license.json')

  // Migration: If legacy license file exists in process.cwd()/data/license.json, copy it over
  try {
    const legacyPath = path.resolve(process.cwd(), 'data/license.json')
    if (legacyPath !== licensePath && fs.existsSync(legacyPath) && !fs.existsSync(licensePath)) {
      fs.copyFileSync(legacyPath, licensePath)
      console.log('[License] Migrated existing license file to AppData:', licensePath)
    }
  } catch (e) {}

  return licensePath
}

function getLicenseCandidatePaths(): string[] {
  const candidates: string[] = []
  try {
    candidates.push(path.join(getUserDataDir(), 'data', 'license.json'))
    candidates.push(path.join(getUserDataDir(), 'license.json'))
  } catch (e) {}

  if (process.platform === 'win32' && process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'MagazaPOS', 'data', 'license.json'))
    candidates.push(path.join(process.env.APPDATA, 'MagazaPOS', 'license.json'))
  }

  candidates.push(path.resolve(process.cwd(), 'data/license.json'))
  candidates.push(path.resolve(process.cwd(), 'license.json'))

  return [...new Set(candidates)]
}

interface LicenseData {
  deviceId: string
  activationKey: string
  activatedAt: string
}

/**
 * Reads a unique, stable hardware/OS identifier.
 * Windows: MachineGuid from Registry (<15ms via reg query), or PowerShell / WMIC fallback
 * Linux: /etc/machine-id or dbus machine-id
 * Fallback: os.hostname() + cpu details
 */
function getRawHardwareId(): string {
  if (cachedRawHardwareId) {
    return cachedRawHardwareId
  }

  if (process.platform === 'win32') {
    // 1. FASTEST & MOST RELIABLE: Direct reg.exe query (<15ms, built-in C binary in System32, zero PowerShell/.NET overhead)
    try {
      const output = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
        timeout: 5000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      }).toString()
      const match = output.match(/MachineGuid\s+REG_\w+\s+([^\r\n]+)/i)
      if (match && match[1] && match[1].trim().length > 5) {
        cachedRawHardwareId = match[1].trim()
        return cachedRawHardwareId
      }
    } catch {}

    // 2. PowerShell query with 10s timeout (generous for low-spec POS PCs like Celeron J6412 during startup)
    try {
      const output = execSync(
        'powershell -NoProfile -Command "(Get-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Cryptography\').MachineGuid"',
        { timeout: 10000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
      )
        .toString()
        .trim()
      if (output && output.length > 5) {
        cachedRawHardwareId = output
        return cachedRawHardwareId
      }
    } catch {}

    // 3. Fallback to wmic
    try {
      const output = execSync('wmic csproduct get uuid', {
        timeout: 10000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .toString()
        .replace(/UUID/i, '')
        .trim()
      if (output && output.length > 5) {
        cachedRawHardwareId = output
        return cachedRawHardwareId
      }
    } catch {}
  } else if (process.platform === 'linux') {
    const candidatePaths = ['/etc/machine-id', '/var/lib/dbus/machine-id']
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8').trim()
          if (content.length > 5) {
            cachedRawHardwareId = content
            return cachedRawHardwareId
          }
        } catch {}
      }
    }
  }

  // Generic fallback
  const cpus = os.cpus()
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'CPU'
  cachedRawHardwareId = `${os.hostname()}-${cpuModel}-${os.arch()}`
  return cachedRawHardwareId
}

/**
 * Returns formatted device ID: MPOS-XXXX-XXXX (8 uppercase chars)
 */
export function getDeviceId(): string {
  if (cachedDeviceId) {
    return cachedDeviceId
  }
  const rawId = getRawHardwareId()
  const hash = crypto.createHash('sha256').update(rawId).digest('hex').toUpperCase()
  cachedDeviceId = `MPOS-${hash.substring(0, 4)}-${hash.substring(4, 8)}`
  return cachedDeviceId
}

/**
 * Deterministically generates a 6-digit activation key for a given deviceId
 */
export function generateActivationKey(deviceId: string): string {
  const cleanId = deviceId.trim().toUpperCase()
  const hmac = crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(cleanId)
    .digest('hex')

  const numericCode = (parseInt(hmac.substring(0, 8), 16) % 900000) + 100000
  return numericCode.toString()
}

function readLicenseFile(): LicenseData | null {
  const candidatePaths = getLicenseCandidatePaths()
  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(content)
        if (parsed && parsed.deviceId && parsed.activationKey) {
          return parsed
        }
      }
    } catch (err) {
      // Continue checking next candidate
    }
  }
  return null
}

/**
 * Validates if the current machine has a valid matching license
 */
export function checkLicenseStatus(): { isLicensed: boolean; deviceId: string } {
  const currentDeviceId = getDeviceId()
  const license = readLicenseFile()

  if (!license) {
    return { isLicensed: false, deviceId: currentDeviceId }
  }

  const expectedKey = generateActivationKey(currentDeviceId)
  const isMatch =
    license.deviceId === currentDeviceId &&
    license.activationKey === expectedKey

  return {
    isLicensed: isMatch,
    deviceId: currentDeviceId
  }
}

/**
 * Activates license with provided key
 */
export function activateLicense(inputKey: string): { success: boolean; message: string } {
  const currentDeviceId = getDeviceId()
  const expectedKey = generateActivationKey(currentDeviceId)

  const cleanKey = inputKey.trim()

  if (cleanKey !== expectedKey) {
    return {
      success: false,
      message: 'Geçersiz aktivasyon şifresi! Lütfen geliştiricinizden aldığınız şifreyi kontrol ediniz.'
    }
  }

  try {
    const data: LicenseData = {
      deviceId: currentDeviceId,
      activationKey: cleanKey,
      activatedAt: new Date().toISOString()
    }
    const jsonStr = JSON.stringify(data, null, 2)

    // Save to primary path
    const primaryPath = getLicenseFilePath()
    fs.writeFileSync(primaryPath, jsonStr, 'utf-8')

    // Also mirror to project root data/ if directory exists or can be created
    try {
      const localDataDir = path.resolve(process.cwd(), 'data')
      if (!fs.existsSync(localDataDir)) {
        fs.mkdirSync(localDataDir, { recursive: true })
      }
      fs.writeFileSync(path.join(localDataDir, 'license.json'), jsonStr, 'utf-8')
    } catch (e) {}

    return {
      success: true,
      message: 'MağazaPOS bu cihaza başarıyla tanımlandı ve aktive edildi!'
    }
  } catch (err: any) {
    return {
      success: false,
      message: 'Lisans dosyası kaydedilirken hata oluştu: ' + err.message
    }
  }
}
