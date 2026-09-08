import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getUserDataDir } from './paths'

export const LICENSE_SECRET = 'MagazaPOS_2026_Secure_License_Key_@Antigravity'

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

interface LicenseData {
  deviceId: string
  activationKey: string
  activatedAt: string
}

/**
 * Reads a unique, stable hardware/OS identifier.
 * Windows: MachineGuid from Registry (or ComputerSystemProduct UUID)
 * Linux: /etc/machine-id or dbus machine-id
 * Fallback: os.hostname() + cpu details
 */
function getRawHardwareId(): string {
  if (process.platform === 'win32') {
    try {
      const output = execSync(
        'powershell -NoProfile -Command "(Get-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Cryptography\').MachineGuid"',
        { timeout: 3000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
      )
        .toString()
        .trim()
      if (output && output.length > 5) return output
    } catch {
      // Fallback to wmic
      try {
        const output = execSync('wmic csproduct get uuid', {
          timeout: 3000,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'ignore']
        })
          .toString()
          .replace('UUID', '')
          .trim()
        if (output && output.length > 5) return output
      } catch {}
    }
  } else if (process.platform === 'linux') {
    const candidatePaths = ['/etc/machine-id', '/var/lib/dbus/machine-id']
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8').trim()
          if (content.length > 5) return content
        } catch {}
      }
    }
  }

  // Generic fallback
  const cpus = os.cpus()
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'CPU'
  return `${os.hostname()}-${cpuModel}-${os.arch()}`
}

/**
 * Returns formatted device ID: MPOS-XXXX-XXXX (8 uppercase chars)
 */
export function getDeviceId(): string {
  const rawId = getRawHardwareId()
  const hash = crypto.createHash('sha256').update(rawId).digest('hex').toUpperCase()
  return `MPOS-${hash.substring(0, 4)}-${hash.substring(4, 8)}`
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
  try {
    const filePath = getLicenseFilePath()
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (err) {
    console.error('License file read error:', err)
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
    const filePath = getLicenseFilePath()
    const data: LicenseData = {
      deviceId: currentDeviceId,
      activationKey: cleanKey,
      activatedAt: new Date().toISOString()
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
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
