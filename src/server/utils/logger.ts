import fs from 'fs'
import path from 'path'
import os from 'os'

export function logDebug(context: string, message: string, data?: any) {
  try {
    const desktopDir = path.join(os.homedir(), 'Desktop')
    const logFile = path.join(desktopDir, 'magazapos-debug.txt')
    
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
    console.error('Lof file could not be written:', err)
  }
}
