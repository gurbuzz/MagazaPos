import { Router } from 'express'
import { musicController, PRESET_PLAYLISTS } from '../utils/musicController'

export const musicRouter = Router()

// Helper to calculate callback redirect URI based on current request
function getRedirectUri(req: any): string {
  const host = req.get('host') || 'localhost:3782'
  const protocol = req.protocol || 'http'
  return `${protocol}://${host}/api/music/spotify/callback`
}

// GET /api/music/status - Get current player and schedule status
musicRouter.get('/status', (_req, res) => {
  try {
    const status = musicController.getStatus()
    res.json(status)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/music/playlists - List all store presets and Spotify user playlists if connected
musicRouter.get('/playlists', async (_req, res) => {
  try {
    let spotifyPlaylists: any[] = []
    const config = musicController.getConfig()
    if (config.spotifyRefreshToken || config.spotifyAccessToken) {
      spotifyPlaylists = await musicController.getUserPlaylists()
    }

    res.json({
      presets: PRESET_PLAYLISTS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        badge: p.badge,
        icon: p.icon,
        trackCount: p.tracks.length,
      })),
      userPlaylists: spotifyPlaylists,
      activeId: config.activePlaylistId,
      sourceMode: config.sourceMode,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/music/search?q=... - Search songs / artists (Real Spotify catalog)
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
    res.status(400).json({ error: err.message })
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
    res.status(400).json({ error: err.message })
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

// ==========================================
// SPOTIFY OAUTH & CONNECT ROUTES
// ==========================================

// GET /api/music/spotify/login - Generate or redirect to Spotify login
musicRouter.get('/spotify/login', (req, res) => {
  try {
    const redirectUri = getRedirectUri(req)
    const authUrl = musicController.getSpotifyAuthUrl(redirectUri)

    if (req.query.json === 'true') {
      res.json({ url: authUrl, redirectUri })
    } else {
      res.redirect(authUrl)
    }
  } catch (err: any) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Spotify Giriş Hatası</title><meta charset="utf-8">
        <style>body{font-family:sans-serif;background:#0f172a;color:#f87171;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
        .card{background:#1e293b;padding:30px;border-radius:16px;max-width:480px;border:1px solid #334155;}h3{margin-top:0;}</style>
        </head>
        <body><div class="card"><h3>⚠️ Spotify Giriş Hatası</h3><p>${err.message}</p></div></body>
      </html>
    `)
  }
})

// GET /api/music/spotify/callback - Handle Spotify redirect callback
musicRouter.get('/spotify/callback', async (req, res) => {
  const code = req.query.code as string
  const error = req.query.error as string

  if (error) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Spotify Yetkilendirme Reddedildi</title><meta charset="utf-8">
        <style>body{font-family:sans-serif;background:#0f172a;color:#f87171;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
        .box{background:#1e293b;padding:32px;border-radius:16px;border:1px solid #334155;}h3{margin-top:0;}</style></head>
        <body><div class="box"><h3>⚠️ Spotify Bağlantısı Başarısız</h3><p>${error}</p><button onclick="window.close()" style="background:#475569;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:bold;">Pencereyi Kapat</button></div></body>
      </html>
    `)
    return
  }

  if (!code) {
    res.status(400).send('Yetkilendirme kodu bulunamadı.')
    return
  }

  try {
    const redirectUri = getRedirectUri(req)
    await musicController.handleSpotifyCallback(code, redirectUri)

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Bağlantısı Başarılı</title>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0b1120; color: white; text-align: center; }
            .card { background: #1e293b; padding: 36px 48px; border-radius: 20px; border: 1px solid #334155; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
            h2 { margin: 0 0 12px 0; color: #10b981; font-size: 22px; }
            p { color: #94a3b8; font-size: 14px; margin: 0 0 20px 0; }
            .badge { display: inline-block; background: rgba(16,185,129,0.15); color: #34d399; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: bold; border: 1px solid rgba(16,185,129,0.3); }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✅ Spotify Başarıyla Bağlandı!</h2>
            <p>Mağaza müzik sistemi hesabınızla eşleştirildi.<br/>Bu pencere otomatik olarak kapanacaktır.</p>
            <div class="badge">Eşleşme Tamamlandı</div>
          </div>
          <script>
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS' }, '*');
              }
            } catch(e){}
            setTimeout(function() {
              window.close();
            }, 1200);
          </script>
        </body>
      </html>
    `)
  } catch (err: any) {
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Hata</title><meta charset="utf-8">
        <style>body{font-family:sans-serif;background:#0f172a;color:#f87171;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
        .card{background:#1e293b;padding:32px;border-radius:16px;border:1px solid #334155;max-width:500px;}h3{margin-top:0;}</style>
        </head>
        <body><div class="card"><h3>⚠️ Spotify Token Takası Başarısız</h3><p>${err.message}</p><button onclick="window.close()" style="background:#475569;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-weight:bold;">Kapat</button></div></body>
      </html>
    `)
  }
})

// POST /api/music/spotify/disconnect - Disconnect Spotify account
musicRouter.post('/spotify/disconnect', (_req, res) => {
  try {
    musicController.disconnectSpotify()
    res.json({ success: true, status: musicController.getStatus() })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/music/spotify/devices - Get available Spotify Connect devices
musicRouter.get('/spotify/devices', async (_req, res) => {
  try {
    const devices = await musicController.getDevices()
    res.json({ devices })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/music/spotify/transfer - Transfer playback to selected device
musicRouter.post('/spotify/transfer', async (req, res) => {
  try {
    const deviceId = req.body?.deviceId
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId parametresi gerekli.' })
      return
    }
    const play = Boolean(req.body?.play)
    await musicController.transferPlayback(deviceId, play)
    res.json({ success: true, activeDeviceId: deviceId })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/music/spotify/play-playlist - Start playing a user Spotify playlist
musicRouter.post('/spotify/play-playlist', async (req, res) => {
  try {
    const uri = req.body?.uri
    if (!uri) {
      res.status(400).json({ error: 'Çalma listesi URI bilgisi (uri) gerekli.' })
      return
    }
    await musicController.playSpotifyPlaylist(uri)
    res.json({ success: true, status: musicController.getStatus() })
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// GET /api/music/config - Get full configuration (credentials & schedules)
musicRouter.get('/config', (req, res) => {
  try {
    const config = musicController.getConfig()
    const redirectUri = getRedirectUri(req)

    res.json({
      spotifyClientId: config.spotifyClientId,
      hasClientSecret: Boolean(config.spotifyClientSecret),
      spotifyClientSecret: config.spotifyClientSecret ? '••••••••••••' : '',
      spotifyUser: config.spotifyUser,
      activeDeviceId: config.activeDeviceId,
      activeDeviceName: config.activeDeviceName,
      volume: config.volume,
      fadeDurationSec: config.fadeDurationSec,
      scheduleEnabled: config.scheduleEnabled,
      startTime: config.startTime,
      endTime: config.endTime,
      sourceMode: config.sourceMode,
      activePlaylistId: config.activePlaylistId,
      isSpotifyConnected: Boolean(config.spotifyAccessToken || config.spotifyRefreshToken),
      redirectUri,
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
    if (typeof updates.activeDeviceId === 'string') {
      sanitized.activeDeviceId = updates.activeDeviceId
    }

    const saved = musicController.saveConfig(sanitized)
    res.json({ success: true, config: saved })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
