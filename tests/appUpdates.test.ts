import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateErrorStatus } from '../src/shared/appUpdates'

test('missing published releases are distinguished from an up-to-date application', () => {
  const missingRelease = Object.assign(new Error('No published versions on GitHub'), { code: 'ERR_UPDATER_NO_PUBLISHED_VERSIONS' })
  assert.equal(updateErrorStatus(missingRelease).state, 'unpublished')
  // The GitHub feed parser can wrap this message in a different error code.
  assert.equal(updateErrorStatus(new Error('Cannot parse releases feed: No published versions on GitHub')).state, 'unpublished')
})

test('missing update manifest explains the incomplete release', () => {
  const missingManifest = Object.assign(new Error('404'), { code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' })
  assert.match(updateErrorStatus(missingManifest).message!, /latest\.yml/)
  assert.equal(updateErrorStatus(missingManifest).state, 'error')
})

test('network and access failures never report that the application is current', () => {
  for (const error of [new Error('net::ERR_NAME_NOT_RESOLVED'), new Error('404 Not Found'), 'Connection timed out']) {
    const status = updateErrorStatus(error)
    assert.equal(status.state, 'error')
    assert.ok(status.message)
  }
})

test('Windows install failures are distinguished from download failures', () => {
  for (const code of ['EACCES', 'EPERM']) {
    const status = updateErrorStatus(Object.assign(new Error('installer denied'), { code }), 'install')
    assert.equal(status.state, 'downloaded')
    assert.match(status.message!, /yönetici izni/)
  }
  assert.match(updateErrorStatus(new Error('package unavailable'), 'install').message!, /Kurulum başlatılamadı/)
  assert.match(updateErrorStatus(new Error('network unavailable'), 'download').message!, /indirilemedi/)
  assert.match(updateErrorStatus(new Error('The operation was canceled by the user: 1223'), 'install').message!, /yönetici izni/)
})
