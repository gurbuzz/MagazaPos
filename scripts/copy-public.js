const fs = require('fs')
const path = require('path')

const srcDir = path.resolve(__dirname, '../src/server/public')
const destDir = path.resolve(__dirname, '../dist-electron/main/public')

try {
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(destDir, { recursive: true })
    const files = fs.readdirSync(srcDir)
    for (const file of files) {
      const srcFile = path.join(srcDir, file)
      const destFile = path.join(destDir, file)
      if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, destFile)
      }
    }
    console.log('[Build] Statik mobil dosyalar dist-electron dizinine kopyalandi.')
  }
} catch (err) {
  console.error('[Build] Dosya kopyalama hatasi:', err)
}
