import fs from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import type { AppUpdateResult, AppUpdateStatus } from '../shared/appUpdates'
import { updateErrorStatus } from '../shared/appUpdates'

export interface DownloadedInstaller {
  file: string
  sha512: string
  size?: number
  version: string
}

export class InstallerValidationError extends Error {
  constructor(message: string, readonly needsDownload: boolean) { super(message) }
}

export interface InstallationAttempt {
  fromVersion: string
  version: string
  backupPath: string
  startedAt: string
}

export function recordInstallationAttempt(filename: string, attempt: InstallationAttempt): void {
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  fs.writeFileSync(`${filename}.tmp`, JSON.stringify(attempt), 'utf8')
  fs.renameSync(`${filename}.tmp`, filename)
}

export function consumeInstallationAttempt(filename: string): InstallationAttempt | null {
  if (!fs.existsSync(filename)) return null
  const attempt = JSON.parse(fs.readFileSync(filename, 'utf8'))
  if (['fromVersion', 'version', 'backupPath', 'startedAt'].some(key => typeof attempt?.[key] !== 'string')) throw new Error('Önceki güncelleme kaydı geçersiz.')
  fs.unlinkSync(filename)
  return attempt
}

export async function validateDownloadedInstaller(installer: DownloadedInstaller, resourcesPath: string): Promise<void> {
  if (!path.isAbsolute(installer.file) || path.extname(installer.file).toLowerCase() !== '.exe') throw new InstallerValidationError('İndirilen kurulum dosyasının yolu geçersiz. Güncellemeyi yeniden indirin.', true)
  const stat = await fs.promises.stat(installer.file).catch(() => null)
  if (!stat?.isFile() || stat.size === 0 || (installer.size !== undefined && installer.size !== stat.size)) throw new InstallerValidationError('İndirilen kurulum dosyası bulunamadı veya boyutu değişti. Güncellemeyi yeniden indirin.', true)
  const hash = createHash('sha512')
  for await (const chunk of fs.createReadStream(installer.file)) hash.update(chunk)
  if (!installer.sha512 || hash.digest('base64') !== installer.sha512) throw new InstallerValidationError('İndirilen kurulum dosyasının bütünlüğü doğrulanamadı. Güncellemeyi yeniden indirin.', true)
  const helper = await fs.promises.stat(path.join(resourcesPath, 'elevate.exe')).catch(() => null)
  if (!helper?.isFile() || helper.size === 0) throw new Error('Windows yönetici izin yardımcısı (elevate.exe) mevcut kurulumda eksik. Yeni tam kurulum paketini mevcut kurulumun üzerine kurun.')
}

interface InstallationDependencies {
  validate(): Promise<void>
  beginMaintenance(): Promise<void>
  backup(): Promise<string>
  disconnect(): Promise<void>
  reconnect(): Promise<void>
  endMaintenance(): void
  launch(): void
  status(status: AppUpdateStatus): void
  log(message: string, error?: unknown): void
}

// quitAndInstall returns void. Its synchronous AND asynchronous error events
// must recover the maintenance gate; a successful call is only an install request.
export function createUpdateInstallation(deps: InstallationDependencies) {
  let busy = false
  let stage: AppUpdateStatus['stage']
  let version: string | undefined
  let backupPath: string | undefined
  let disconnected = false
  let failure: unknown
  let recovery: Promise<AppUpdateResult> | undefined
  let failureStatus: AppUpdateStatus | undefined
  let cancelQuitUntil = 0
  const progress = (next: AppUpdateStatus['stage']) => {
    stage = next
    deps.status({ state: 'installing', stage, version, backupPath })
    deps.log(`Güncelleme aşaması: ${stage}`)
  }
  const recover = (error: unknown): Promise<AppUpdateResult> => {
    if (recovery) return recovery
    failure = error
    // An updater error may precede its scheduled app.quit(). Cancel that one
    // quit so the operator can read the error and retry with the store open.
    cancelQuitUntil = stage === 'installer' ? Date.now() + 2000 : 0
    recovery = (async () => {
      deps.log(`Güncelleme başarısız (${stage}); yedek: ${backupPath || 'henüz alınmadı'}`, error)
      const status = { ...updateErrorStatus(error, 'install'), stage, version, backupPath }
      if (stage !== 'installer') {
        const label = { validation: 'Kurulum paketi doğrulaması', maintenance: 'Güncelleme hazırlığı', backup: 'Veritabanı yedeği', closing: 'Veritabanını kapatma' }
        status.message = `${label[stage || 'validation']} tamamlanamadı: ${error instanceof Error ? error.message : String(error)}`
      }
      // NsisUpdater retains quitAndInstallCalled after asynchronous spawn errors.
      // A fresh app process is required; retrying the same instance does nothing.
      failureStatus = stage === 'installer'
        ? { ...status, state: 'error', restartRequired: true, message: `${status.message} Güncellemeyi yeniden denemeden önce uygulamayı kapatıp tekrar açın.` }
        : status
      if (error instanceof InstallerValidationError && error.needsDownload) failureStatus.state = 'available'
      if (disconnected) {
        try { await deps.reconnect(); disconnected = false }
        catch (connectionError) {
          deps.log('Güncelleme hatasından sonra veritabanı bağlantısı açılamadı', connectionError)
          failureStatus.state = 'error'
          failureStatus.restartRequired = true
          failureStatus.message = 'Kurulum tamamlanamadı ve veritabanı bağlantısı yeniden açılamadı. Uygulamayı yeniden başlatın; güncelleme öncesi yedek korunuyor.'
          deps.status(failureStatus)
          busy = false
          return { success: false, error: failureStatus.message, status: failureStatus }
        }
      }
      deps.endMaintenance()
      busy = false
      deps.status(failureStatus)
      return { success: false, error: failureStatus.message, status: failureStatus }
    })()
    return recovery
  }
  return {
    get busy() { return busy },
    get launching() { return busy && stage === 'installer' },
    consumeCancelledQuit() { const cancel = Date.now() < cancelQuitUntil; cancelQuitUntil = 0; return cancel },
    handleError(error: unknown) { return busy ? recover(error) : undefined },
    async install(targetVersion?: string): Promise<AppUpdateResult> {
      if (failureStatus?.restartRequired) return { success: false, error: failureStatus.message, status: failureStatus }
      if (busy) return { success: false, error: 'Güncelleme kurulumu zaten devam ediyor.' }
      busy = true; failure = undefined; recovery = undefined; disconnected = false; cancelQuitUntil = 0
      version = targetVersion; backupPath = undefined
      try {
        progress('validation')
        await deps.validate()
        progress('maintenance')
        await deps.beginMaintenance()
        progress('backup')
        backupPath = await deps.backup()
        deps.log(`Güncelleme öncesi doğrulanmış yedek: ${backupPath}`)
        progress('closing')
        disconnected = true
        await deps.disconnect()
        progress('installer')
        deps.launch()
        if (failure) return await recover(failure)
        return { success: true, status: { state: 'installing', stage, version, backupPath } }
      } catch (error) { return recover(error) }
    },
  }
}
