import path from 'path'
import fs from 'fs'

/**
 * Returns the persistent user data directory.
 * Priority:
 * 1. Electron Main process: app.getPath('userData')
 * 2. process.env.MAGAZAPOS_USER_DATA (set by Electron Main process)
 * 3. %APPDATA%/MagazaPOS (Windows fallback)
 * 4. ~/.config/MagazaPOS (Linux fallback)
 * 5. ./data (local fallback for dev/testing)
 */
export function getUserDataDir(): string {
  // 1. Electron Main process: app.getPath('userData')
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      const dir = app.getPath('userData')
      if (dir && dir.trim() !== '') {
        if (!fs.existsSync(dir)) {
          try {
            fs.mkdirSync(dir, { recursive: true })
          } catch (e) {}
        }
        return dir
      }
    }
  } catch (e) {}

  // 2. Environment variable
  if (process.env.MAGAZAPOS_USER_DATA && process.env.MAGAZAPOS_USER_DATA.trim() !== '') {
    const dir = process.env.MAGAZAPOS_USER_DATA.trim()
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (e) {
        console.error('[Paths] Error creating userData dir:', e)
      }
    }
    return dir
  }

  // 3. Windows standard AppData
  if (process.platform === 'win32' && process.env.APPDATA) {
    const dir = path.join(process.env.APPDATA, 'MagazaPOS')
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (e) {}
    }
    return dir
  }

  // 4. Linux / Mac standard config
  if (process.env.HOME) {
    const dir = path.join(process.env.HOME, '.config', 'MagazaPOS')
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (e) {}
    }
    return dir
  }

  // 5. Dev fallback
  const dir = path.resolve(process.cwd(), 'data')
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e) {}
  }
  return dir
}
