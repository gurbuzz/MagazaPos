import fs from 'fs'
import path from 'path'
import { getUserDataDir } from './paths'

export function logDebug(context: string, message: string, data?: any) {
  try {
    const userDataDir = getUserDataDir()
    const logFile = path.join(userDataDir, 'magazapos-debug.log')
    
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
