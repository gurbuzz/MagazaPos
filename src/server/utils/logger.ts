import fs from 'fs'
import path from 'path'
import os from 'os'

export function logDebug(context: string, message: string, data?: any) {
  try {
    const desktopDir = path.join(os.homedir(), 'Desktop')
    let targetDir = desktopDir
    if (!fs.existsSync(desktopDir)) {
      const masaustuDir = path.join(os.homedir(), 'Masaüstü')
      if (fs.existsSync(masaustuDir)) {
        targetDir = masaustuDir
      } else {
        try {
          fs.mkdirSync(desktopDir, { recursive: true })
        } catch {
          targetDir = os.homedir()
        }
      }
    }
    const logFile = path.join(targetDir, 'magazapos-debug.txt')
    
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
