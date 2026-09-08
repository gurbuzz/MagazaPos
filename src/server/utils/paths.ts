import path from 'path'
import fs from 'fs'

/**
 * Returns the persistent user data directory.
 * Priority:
 * 1. process.env.MAGAZAPOS_USER_DATA (set by Electron Main process via app.getPath('userData'))
 * 2. %APPDATA%/MagazaPOS (Windows fallback)
 * 3. ~/.config/MagazaPOS (Linux fallback)
 * 4. ./data (local fallback for dev/testing)
 */
export function getUserDataDir(): string {
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

  // Windows standard AppData
  if (process.platform === 'win32' && process.env.APPDATA) {
    const dir = path.join(process.env.APPDATA, 'MagazaPOS')
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (e) {}
    }
    return dir
  }

  // Linux / Mac standard config
  if (process.env.HOME) {
    const dir = path.join(process.env.HOME, '.config', 'MagazaPOS')
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (e) {}
    }
    return dir
  }

  // Dev fallback
  const dir = path.resolve(process.cwd(), 'data')
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true })
    } catch (e) {}
  }
  return dir
}
