export interface AppUpdateStatus {
  state: string
  currentVersion?: string
  version?: string
  message?: string
  percent?: number
  stage?: 'validation' | 'maintenance' | 'backup' | 'closing' | 'installer'
  backupPath?: string
  restartRequired?: boolean
}

export interface AppUpdateResult {
  success: boolean
  error?: string
  status?: AppUpdateStatus
}

export function updateErrorStatus(error: unknown, operation: 'check' | 'download' | 'install' = 'check'): AppUpdateStatus {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: string } | null)?.code
  if (code === 'ERR_UPDATER_NO_PUBLISHED_VERSIONS' || /No published versions on GitHub/i.test(message)) {
    return { state: 'unpublished', message: 'Henüz yayımlanmış bir güncelleme paketi yok. Kaynak kodunu GitHub’a göndermek tek başına güncelleme yayımlamaz.' }
  }
  if (code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') {
    return { state: 'error', message: 'Yayımlanan sürümde latest.yml güncelleme dosyası eksik. Windows kurulum paketi ve güncelleme dosyaları aynı Release içinde yayımlanmalıdır.' }
  }
  if (operation === 'install') {
    if (code === 'EACCES' || code === 'EPERM' || /1223|cancelled by the user|canceled by the user/i.test(message)) {
      return { state: 'downloaded', stage: 'installer', message: 'Windows kurulumu başlatamadı veya yönetici izni verilmedi. Windows izin penceresini kontrol edin. İndirilen paket korunuyor.' }
    }
    return { state: 'downloaded', stage: 'installer', message: `Kurulum başlatılamadı: ${message}` }
  }
  return { state: 'error', message: `${operation === 'download' ? 'Güncelleme indirilemedi' : 'Güncelleme kontrolü tamamlanamadı'}: ${message}` }
}
