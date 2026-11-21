import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { consumeInstallationAttempt, createUpdateInstallation, InstallerValidationError, recordInstallationAttempt, validateDownloadedInstaller } from '../src/main/updateInstallation'
import type { AppUpdateStatus } from '../src/shared/appUpdates'

function fixture(failing?: string) {
  const calls: string[] = []
  const statuses: AppUpdateStatus[] = []
  const step = async (name: string) => { calls.push(name); if (failing === name) throw new Error(`${name} failed`) }
  const deps = {
    validate: () => step('validate'), beginMaintenance: () => step('maintenance'),
    backup: async () => { await step('backup'); return 'verified-backup.db' },
    disconnect: () => step('disconnect'), reconnect: () => step('reconnect'),
    endMaintenance: () => { calls.push('resume') },
    launch: () => { calls.push('launch'); if (failing === 'launch') throw new Error('launch failed') },
    status: (status: AppUpdateStatus) => { statuses.push(status) }, log: () => {},
  }
  return { calls, statuses, deps }
}

test('installation requires a verified backup and a closed database before launching Windows setup', async () => {
  const f = fixture()
  const install = createUpdateInstallation(f.deps)
  const result = await install.install('1.0.5')
  assert.deepEqual(f.calls, ['validate', 'maintenance', 'backup', 'disconnect', 'launch'])
  assert.equal(result.success, true)
  assert.equal(result.status?.backupPath, 'verified-backup.db')
  assert.equal(result.status?.state, 'installing', 'Requesting setup must not claim it has completed')
  assert.equal(install.busy, true)
  assert.deepEqual(f.statuses.map(s => s.stage), ['validation', 'maintenance', 'backup', 'closing', 'installer'])
  assert.equal((await install.install()).success, false)
  assert.equal(f.calls.filter(c => c === 'launch').length, 1)
})

test('validation, drain and backup failures never disconnect the database or launch setup', async () => {
  for (const failing of ['validate', 'maintenance', 'backup']) {
    const f = fixture(failing)
    const install = createUpdateInstallation(f.deps)
    const result = await install.install('1.0.5')
    assert.equal(result.success, false)
    assert.ok(!f.calls.includes('disconnect'))
    assert.ok(!f.calls.includes('launch'))
    assert.equal(f.calls.at(-1), 'resume')
    assert.equal(install.busy, false)
    assert.equal(result.status?.version, '1.0.5')
  }
})

test('disconnect and synchronous installer failures reconnect the database before allowing sales', async () => {
  for (const failing of ['disconnect', 'launch']) {
    const f = fixture(failing)
    const install = createUpdateInstallation(f.deps)
    const result = await install.install()
    assert.equal(result.success, false)
    assert.deepEqual(f.calls.slice(-2), ['reconnect', 'resume'])
    assert.equal(result.status?.backupPath, 'verified-backup.db')
    assert.equal(install.busy, false)
    assert.equal(install.consumeCancelledQuit(), failing === 'launch')
    assert.equal(install.consumeCancelledQuit(), false)
  }
})

test('a synchronous updater error event is not mistaken for a successful installation request', async () => {
  const f = fixture()
  const install = createUpdateInstallation({ ...f.deps, launch: () => { void install.handleError(new Error('No update filepath provided')) } })
  const result = await install.install()
  assert.equal(result.success, false)
  assert.equal(install.busy, false)
  assert.deepEqual(f.calls.slice(-2), ['reconnect', 'resume'])
})

test('late Windows launch errors release maintenance and require a fresh updater process', async () => {
  const f = fixture()
  const install = createUpdateInstallation(f.deps)
  await install.install('1.0.5')
  const result = await install.handleError(Object.assign(new Error('spawn elevate.exe EACCES'), { code: 'EACCES' }))
  assert.equal(result?.success, false)
  assert.equal(result?.status?.state, 'error')
  assert.equal(result?.status?.restartRequired, true)
  assert.equal(result?.status?.version, '1.0.5')
  assert.match(result?.status?.message || '', /yönetici izni/)
  assert.equal(install.busy, false)
  assert.deepEqual(f.calls.slice(-2), ['reconnect', 'resume'])
  assert.equal(install.consumeCancelledQuit(), true)
  assert.equal((await install.install('1.0.5')).success, false)
  assert.equal(f.calls.filter(c => c === 'launch').length, 1)
})

test('duplicate updater errors reconnect and release the gate only once', async () => {
  const f = fixture()
  let resume: () => void = () => {}
  const reconnect = new Promise<void>(resolve => { resume = resolve })
  const install = createUpdateInstallation({ ...f.deps, reconnect: () => { f.calls.push('reconnect'); return reconnect } })
  await install.install()
  const first = install.handleError(new Error('first failure'))
  const second = install.handleError(new Error('duplicate failure'))
  assert.equal(first, second)
  resume()
  await first
  assert.equal(f.calls.filter(c => c === 'reconnect').length, 1)
  assert.equal(f.calls.filter(c => c === 'resume').length, 1)
})

test('failed database recovery leaves writes blocked and clearly requires a restart', async () => {
  const f = fixture('reconnect')
  const install = createUpdateInstallation(f.deps)
  await install.install()
  const result = await install.handleError(new Error('setup failed'))
  assert.equal(result?.status?.state, 'error')
  assert.match(result?.error || '', /yeniden başlatın/)
  assert.ok(!f.calls.includes('resume'))
})

test('damaged cached packages request a new download rather than an endless install retry', async () => {
  const f = fixture()
  const install = createUpdateInstallation({ ...f.deps, validate: async () => { throw new InstallerValidationError('Paket bozuk; yeniden indirin.', true) } })
  const result = await install.install('1.0.5')
  assert.equal(result.status?.state, 'available')
  assert.equal(result.status?.version, '1.0.5')
  assert.ok(!f.calls.includes('backup'))
})

test('installer validation verifies the downloaded hash, size and installed elevation helper', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magazapos-update-test-'))
  try {
    const file = path.join(dir, 'setup.exe')
    fs.writeFileSync(file, 'MZ-test-downloaded-installer')
    fs.writeFileSync(path.join(dir, 'elevate.exe'), 'MZ-test-helper')
    const original = fs.readFileSync(file)
    const installer = { file, sha512: createHash('sha512').update(original).digest('base64'), size: original.length, version: '1.0.5' }
    await validateDownloadedInstaller(installer, dir)
    fs.writeFileSync(file, Buffer.alloc(original.length, 'x'))
    await assert.rejects(validateDownloadedInstaller(installer, dir), /bütünlüğü/)
    fs.writeFileSync(file, 'short')
    await assert.rejects(validateDownloadedInstaller(installer, dir), /boyutu/)
    fs.writeFileSync(file, original)
    fs.unlinkSync(path.join(dir, 'elevate.exe'))
    await assert.rejects(validateDownloadedInstaller(installer, dir), /elevate\.exe/)
    fs.unlinkSync(file)
    await assert.rejects(validateDownloadedInstaller(installer, dir), /bulunamadı/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('an interrupted installer leaves the requested version and verified backup available at next startup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magazapos-update-attempt-'))
  try {
    const filename = path.join(dir, 'attempt.json')
    assert.equal(consumeInstallationAttempt(filename), null)
    const attempt = { fromVersion: '1.0.4', version: '1.0.5', backupPath: path.join(dir, 'verified.db'), startedAt: new Date().toISOString() }
    recordInstallationAttempt(filename, attempt)
    assert.deepEqual(consumeInstallationAttempt(filename), attempt)
    assert.equal(consumeInstallationAttempt(filename), null)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
