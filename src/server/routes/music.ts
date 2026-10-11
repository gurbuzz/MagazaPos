import { Router } from 'express'
import { musicController, PRESET_PLAYLISTS } from '../utils/musicController'

export const musicRouter = Router()

// GET /api/music/status - Get current player and schedule status
musicRouter.get('/status', (_req, res) => {
  try {
    const status = musicController.getStatus()
    res.json(status)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/music/playlists - List all available store presets & playlists
musicRouter.get('/playlists', (_req, res) => {
  try {
    res.json({
      presets: PRESET_PLAYLISTS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        badge: p.badge,
        icon: p.icon,
        trackCount: p.tracks.length,
      })),
      activeId: musicController.getConfig().activePlaylistId,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/music/search?q=... - Search songs / artists
musicRouter.get('/search', async (req, res) => {
  try {
    const query = (req.query.q as string) || ''
    const results = await musicController.searchTracks(query)
    res.json(results)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/play - Start playback with smooth fade-in
musicRouter.post('/play', async (req, res) => {
  try {
    const fade = req.body?.fade !== false
    await musicController.play(fade)
    res.json({ success: true, status: musicController.getStatus() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/pause - Pause playback with smooth fade-out
musicRouter.post('/pause', async (req, res) => {
  try {
    const fade = req.body?.fade !== false
    await musicController.pause(fade)
    res.json({ success: true, status: musicController.getStatus() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/next - Next track with smooth crossfade
musicRouter.post('/next', async (_req, res) => {
  try {
    await musicController.next()
    res.json({ success: true, status: musicController.getStatus() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/prev - Previous track with smooth crossfade
musicRouter.post('/prev', async (_req, res) => {
  try {
    await musicController.prev()
    res.json({ success: true, status: musicController.getStatus() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/select-track - Switch directly to a selected track
musicRouter.post('/select-track', async (req, res) => {
  try {
    const track = req.body?.track
    if (!track || !track.title) {
      res.status(400).json({ error: 'Geçersiz şarkı nesnesi.' })
      return
    }
    await musicController.switchTrack(track)
    res.json({ success: true, status: musicController.getStatus() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/select-playlist - Switch to a preset playlist
musicRouter.post('/select-playlist', (req, res) => {
  try {
    const playlistId = req.body?.playlistId
    if (!playlistId) {
      res.status(400).json({ error: 'Çalma listesi kimliği (playlistId) gerekli.' })
      return
    }
    musicController.selectPlaylist(playlistId)
    res.json({ success: true, status: musicController.getStatus() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/volume - Set target volume
musicRouter.post('/volume', (req, res) => {
  try {
    const volume = Number(req.body?.volume)
    if (isNaN(volume)) {
      res.status(400).json({ error: 'Geçersiz ses değeri.' })
      return
    }
    musicController.setVolume(volume)
    res.json({ success: true, volume: musicController.getStatus().volume })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/music/config - Get full configuration (credentials & schedules)
musicRouter.get('/config', (_req, res) => {
  try {
    const config = musicController.getConfig()
    res.json({
      spotifyClientId: config.spotifyClientId,
      hasClientSecret: Boolean(config.spotifyClientSecret),
      spotifyClientSecret: config.spotifyClientSecret ? '••••••••••••' : '',
      volume: config.volume,
      fadeDurationSec: config.fadeDurationSec,
      scheduleEnabled: config.scheduleEnabled,
      startTime: config.startTime,
      endTime: config.endTime,
      sourceMode: config.sourceMode,
      activePlaylistId: config.activePlaylistId,
      isSpotifyConnected: Boolean(config.spotifyAccessToken || config.spotifyRefreshToken),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/config - Save configuration updates
musicRouter.post('/config', (req, res) => {
  try {
    const updates = req.body || {}
    const sanitized: any = {}

    if (typeof updates.spotifyClientId === 'string') {
      sanitized.spotifyClientId = updates.spotifyClientId.trim()
    }
    if (typeof updates.spotifyClientSecret === 'string' && updates.spotifyClientSecret !== '••••••••••••') {
      sanitized.spotifyClientSecret = updates.spotifyClientSecret.trim()
    }
    if (typeof updates.spotifyRefreshToken === 'string') {
      sanitized.spotifyRefreshToken = updates.spotifyRefreshToken.trim()
    }
    if (typeof updates.volume === 'number') {
      sanitized.volume = Math.min(100, Math.max(0, updates.volume))
    }
    if (typeof updates.fadeDurationSec === 'number') {
      sanitized.fadeDurationSec = Math.min(10, Math.max(0.5, updates.fadeDurationSec))
    }
    if (typeof updates.scheduleEnabled === 'boolean') {
      sanitized.scheduleEnabled = updates.scheduleEnabled
    }
    if (typeof updates.startTime === 'string' && /^\d{2}:\d{2}$/.test(updates.startTime)) {
      sanitized.startTime = updates.startTime
    }
    if (typeof updates.endTime === 'string' && /^\d{2}:\d{2}$/.test(updates.endTime)) {
      sanitized.endTime = updates.endTime
    }
    if (updates.sourceMode === 'spotify' || updates.sourceMode === 'store_radio') {
      sanitized.sourceMode = updates.sourceMode
    }

    const saved = musicController.saveConfig(sanitized)
    res.json({ success: true, config: saved })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
