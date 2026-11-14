const fs = require('fs')
const path = require('path')

const srcDir = path.resolve(__dirname, '../src/server/public')
const destDir = path.resolve(__dirname, '../dist-electron/main/public')

try {
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(destDir, { recursive: true })
    fs.cpSync(srcDir, destDir, { recursive: true })
    // The server directory is the source for mobile pages and scanner assets.
    const vitePublic = path.resolve(__dirname, '../public')
    for (const file of ['mobile.html', 'mobile-scanner.js', 'vendor']) {
      fs.cpSync(path.join(srcDir, file), path.join(vitePublic, file), { recursive: true })
    }
    console.log('[Build] Statik mobil dosyalar dist-electron dizinine kopyalandi.')
  }
} catch (err) {
  console.error('[Build] Dosya kopyalama hatasi:', err)
  process.exitCode = 1
}
