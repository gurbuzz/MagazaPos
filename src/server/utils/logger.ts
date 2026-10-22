import fs from 'fs'
import path from 'path'
import os from 'os'
import { getUserDataDir } from './paths'

let desktopCleaned = false

function cleanupLegacyDesktopLog() {
  if (desktopCleaned) return
  desktopCleaned = true

  try {
    const desktopDirs = [
      path.join(os.homedir(), 'Desktop', 'magazapos-debug.txt'),
      path.join(os.homedir(), 'Masaüstü', 'magazapos-debug.txt'),
    ]

    for (const legacyFile of desktopDirs) {
      if (fs.existsSync(legacyFile)) {
        try {
          fs.unlinkSync(legacyFile)
          console.log(`[Logger] Eski masaüstü log dosyası temizlendi: ${legacyFile}`)
        } catch {}
      }
    }
  } catch {}
}

export function getLogFilePath(): string {
  const baseDir = getUserDataDir()
  const logDir = path.join(baseDir, 'logs')
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true })
    } catch {}
  }
  return path.join(logDir, 'magazapos-debug.txt')
}

export function logDebug(context: string, message: string, data?: any) {
  try {
    // One-time cleanup of legacy desktop log file
    cleanupLegacyDesktopLog()

    const logFile = getLogFilePath()

    // Rotate if larger than 2MB
    if (fs.existsSync(logFile)) {
      try {
        const stats = fs.statSync(logFile)
        if (stats.size > 2 * 1024 * 1024) {
          const oldFile = `${logFile}.old`
          if (fs.existsSync(oldFile)) {
            try { fs.unlinkSync(oldFile) } catch {}
          }
          fs.renameSync(logFile, oldFile)
        }
      } catch {}
    }

    const timestamp = new Date().toISOString()
    let logLine = `[${timestamp}] [${context}] ${message}`

    if (data) {
      if (data instanceof Error) {
        logLine += `\nError Message: ${data.message}\nStack: ${data.stack}`
      } else {
        logLine += `\nData: ${JSON.stringify(data, null, 2)}`
      }
    }
    logLine += '\n\n'

    fs.appendFileSync(logFile, logLine, 'utf8')
    console.log(logLine)
  } catch (err) {
    console.error('Log file could not be written:', err)
  }
}
