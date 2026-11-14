export interface AppUpdateStatus {
  state: string
  currentVersion?: string
  version?: string
  message?: string
  percent?: number
}

export interface AppUpdateResult {
  success: boolean
  error?: string
  status?: AppUpdateStatus
}

export function updateErrorStatus(error: unknown): AppUpdateStatus {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: string } | null)?.code
  if (code === 'ERR_UPDATER_NO_PUBLISHED_VERSIONS' || /No published versions on GitHub/i.test(message)) {
    return { state: 'unpublished', message: 'Henüz yayımlanmış bir güncelleme paketi yok. Kaynak kodunu GitHub’a göndermek tek başına güncelleme yayımlamaz.' }
  }
  if (code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') {
    return { state: 'error', message: 'Yayımlanan sürümde latest.yml güncelleme dosyası eksik. Windows kurulum paketi ve güncelleme dosyaları aynı Release içinde yayımlanmalıdır.' }
  }
  return { state: 'error', message: `Güncelleme kontrolü veya indirme tamamlanamadı: ${message}` }
}
