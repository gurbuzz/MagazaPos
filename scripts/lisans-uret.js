#!/usr/bin/env node

/**
 * MağazaPOS - Cihaz Aktivasyon Şifresi Üretici (Keygen)
 * 
 * Bu betik geliştiriciye özeldir ve müşteriye dağıtılan derlenmiş (.exe) pakete dahil edilmez.
 * 
 * Kullanım:
 *   npm run lisans <CIHAZ_KODU>
 *   veya:
 *   node scripts/lisans-uret.js MPOS-8F2B-91AC
 *   veya bu bilgisayarın kendi kodunu üretmek için:
 *   node scripts/lisans-uret.js --current
 */

const crypto = require('crypto')
const readline = require('readline')
const path = require('path')

const LICENSE_SECRET = 'MagazaPOS_2026_Secure_License_Key_@Antigravity'

function generateActivationKey(deviceId) {
  const cleanId = deviceId.trim().toUpperCase()
  const hmac = crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(cleanId)
    .digest('hex')

  const numericCode = (parseInt(hmac.substring(0, 8), 16) % 900000) + 100000
  return numericCode.toString()
}

function printResult(deviceId) {
  const cleanId = deviceId.trim().toUpperCase()
  const key = generateActivationKey(cleanId)

  console.log('')
  console.log('============================================================')
  console.log('  🔑 MağazaPOS Cihaz Lisans & Aktivasyon Şifresi')
  console.log('============================================================')
  console.log(`  🖥️  Cihaz Kodu       : ${cleanId}`)
  console.log(`  ⭐  Aktivasyon Şifresi: ${key}`)
  console.log('============================================================')
  console.log('  ℹ️  Bu 6 haneli şifreyi müşteriye iletebilirsiniz.')
  console.log('  Müşteri bu şifreyi girdiğinde yazılım o cihaza kilitlenecektir.')
  console.log('============================================================')
  console.log('')
}

function getRawHardwareId() {
  const { execSync } = require('child_process')
  const fs = require('fs')
  const os = require('os')

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

  const cpus = os.cpus()
  const cpuModel = cpus.length > 0 ? cpus[0].model : 'CPU'
  return `${os.hostname()}-${cpuModel}-${os.arch()}`
}

function getLocalDeviceId() {
  const rawId = getRawHardwareId()
  const hash = crypto.createHash('sha256').update(rawId).digest('hex').toUpperCase()
  return `MPOS-${hash.substring(0, 4)}-${hash.substring(4, 8)}`
}

const arg = process.argv[2]

if (arg && arg !== '--current') {
  printResult(arg)
} else if (arg === '--current') {
  try {
    const currentId = getLocalDeviceId()
    printResult(currentId)
  } catch (err) {
    console.error('Mevcut cihaz kimliği okunurken hata:', err.message)
  }
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  console.log('')
  console.log('--- MağazaPOS Lisans Şifresi Üretici ---')
  rl.question('Müşteri ekranındaki Cihaz Kodunu girin (örn: MPOS-XXXX-XXXX): ', (answer) => {
    if (answer && answer.trim()) {
      printResult(answer)
    } else {
      console.log('[HATA] Cihaz kodu boş bırakılamaz.')
    }
    rl.close()
  })
}
