import path from 'path'
import fs from 'fs'
import { getUserDataDir } from './paths'

export interface MusicTrack {
  id: string
  title: string
  artist: string
  album?: string
  durationSec: number
  albumArt: string
  uri?: string
  previewUrl?: string
  externalUrl?: string
}

export interface PlaylistPreset {
  id: string
  name: string
  description: string
  badge: string
  icon: string
  streamUrl?: string
  tracks: MusicTrack[]
}

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  is_restricted: boolean
  volume_percent: number | null
}

export interface SpotifyUser {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  product?: string
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  trackCount: number
  imageUrl: string
  uri: string
  owner: string
}

export interface MusicConfig {
  spotifyClientId: string
  spotifyClientSecret: string
  spotifyRefreshToken: string
  spotifyAccessToken: string
  tokenExpiresAt: number
  spotifyUser: SpotifyUser | null
  activeDeviceId: string
  activeDeviceName: string
  volume: number // 0-100
  fadeDurationSec: number // e.g. 2.5s
  scheduleEnabled: boolean
  startTime: string // "09:30"
  endTime: string // "21:30"
  sourceMode: 'spotify' | 'store_radio'
  activePlaylistId: string
}

export const PRESET_PLAYLISTS: PlaylistPreset[] = [
  {
    id: 'lufian_lounge',
    name: 'Lufian Mağaza Akustik & Lounge',
    description: 'Sıcak akustik melodiler, modern lounge ve yumuşak vokal tınıları.',
    badge: 'Akustik & Sakin',
    icon: '☕',
    streamUrl: 'https://ice1.somafm.com/lush-128-mp3',
    tracks: [
      {
        id: 'luf_1',
        title: 'Morning Serenade',
        artist: 'Lufian Acoustic Ensemble',
        album: 'Store Essentials Vol. 1',
        durationSec: 215,
        albumArt: '/customerbackground.jpg',
      },
      {
        id: 'luf_2',
        title: 'City Lights Velvet',
        artist: 'Nordic Lounge Project',
        album: 'Autumn Velvet',
        durationSec: 198,
        albumArt: '/customerbackground.jpg',
      },
      {
        id: 'luf_3',
        title: 'Breeze & Wool',
        artist: 'Gentle Beats',
        album: 'Boutique Collection',
        durationSec: 240,
        albumArt: '/customerbackground.jpg',
      },
      {
        id: 'luf_4',
        title: 'Sunlit Boulevard',
        artist: 'Milano Sunset Trio',
        album: 'Milano Sunset',
        durationSec: 185,
        albumArt: '/customerbackground.jpg',
      },
    ],
  },
  {
    id: 'jackjones_energy',
    name: 'Jack & Jones Enerjik Pop & Denim',
    description: 'Dinamik ritimler, indie pop ve genç mağaza enerjisi.',
    badge: 'Dinamik & Enerjik',
    icon: '⚡',
    streamUrl: 'https://ice1.somafm.com/poptron-128-mp3',
    tracks: [
      {
        id: 'jj_1',
        title: 'Urban Denim Pulse',
        artist: 'Copenhagen Beats',
        album: 'Street & Style 2026',
        durationSec: 182,
        albumArt: '/customerbackground.jpg',
      },
      {
        id: 'jj_2',
        title: 'Electric Horizon',
        artist: 'The Modern Waves',
        album: 'Raw & Pure',
        durationSec: 210,
        albumArt: '/customerbackground.jpg',
      },
      {
        id: 'jj_3',
        title: 'Runaway Groove',
        artist: 'Denim Collective',
        album: 'Jack Vibes',
        durationSec: 195,
        albumArt: '/customerbackground.jpg',
      },
    ],
  },
  {
    id: 'store_chill',
    name: 'Akşam & Kapanış Sakin Caz',
    description: 'Akşam alışverişi için dinlendirici saksafon, piyano ve yumuşak caz.',
    badge: 'Akşam Cazı',
    icon: '🌆',
    streamUrl: 'https://ice1.somafm.com/illstreet-128-mp3',
    tracks: [
      {
        id: 'jazz_1',
        title: 'Midnight in Paris',
        artist: 'Smooth Jazz Quartet',
        album: 'Nightfall Elegance',
        durationSec: 260,
        albumArt: '/customerbackground.jpg',
      },
      {
        id: 'jazz_2',
        title: 'Blue Coffee',
        artist: 'Velvet Brass Project',
        album: 'Quiet Hours',
        durationSec: 234,
        albumArt: '/customerbackground.jpg',
      },
    ],
  },
  {
    id: 'weekend_retail',
    name: 'Hafta Sonu Yoğun Alışveriş Modu',
    description: 'Kalabalık saatlerde tempoyu artıran neşeli ve modern mağaza akışı.',
    badge: 'Hafta Sonu Modu',
    icon: '🛍️',
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    tracks: [
      {
        id: 'wk_1',
        title: 'Sunny Retail Grooves',
        artist: 'Weekend Vibes',
        album: 'Shopping Rush',
        durationSec: 190,
        albumArt: '/customerbackground.jpg',
      },
      {
        id: 'wk_2',
        title: 'Happy Steps',
        artist: 'Indie Pop Factory',
        album: 'Joy & Rhythm',
        durationSec: 175,
        albumArt: '/customerbackground.jpg',
      },
    ],
  },
]

class MusicController {
  private configPath: string
  private config: MusicConfig
  private isPlaying: boolean = false
  private isFading: boolean = false
  private currentVolume: number = 70 // Live volume currently playing
  private currentTrackIndex: number = 0
  private currentTrack: MusicTrack
  private fadeInterval: NodeJS.Timeout | null = null
  private schedulerInterval: NodeJS.Timeout | null = null
  private playbackTimer: NodeJS.Timeout | null = null
  private trackProgressSec: number = 0
  private lastTriggeredMinute: string = ''
  private lastSpotifySync: number = 0

  constructor() {
    this.configPath = path.join(getUserDataDir(), 'music_config.json')
    this.config = this.loadConfig()
    this.currentVolume = this.config.volume

    // Default to first preset
    const initialPlaylist = PRESET_PLAYLISTS.find((p) => p.id === this.config.activePlaylistId) || PRESET_PLAYLISTS[0]
    this.currentTrack = initialPlaylist.tracks[0]

    // Start background store schedule checker & progress timer
    this.startScheduler()
    this.startTrackProgressTimer()
  }

  private loadConfig(): MusicConfig {
    const defaults: MusicConfig = {
      spotifyClientId: '',
      spotifyClientSecret: '',
      spotifyRefreshToken: '',
      spotifyAccessToken: '',
      tokenExpiresAt: 0,
      spotifyUser: null,
      activeDeviceId: '',
      activeDeviceName: '',
      volume: 70,
      fadeDurationSec: 2.5,
      scheduleEnabled: true,
      startTime: '09:30',
      endTime: '21:30',
      sourceMode: 'store_radio',
      activePlaylistId: 'lufian_lounge',
    }

    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        return { ...defaults, ...JSON.parse(raw) }
      }
    } catch (e) {
      console.error('[MusicController] Error loading config:', e)
    }
    return defaults
  }

  public saveConfig(updates: Partial<MusicConfig>): MusicConfig {
    this.config = { ...this.config, ...updates }
    try {
      const dir = path.dirname(this.configPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (e) {
      console.error('[MusicController] Error saving config:', e)
    }
    return this.config
  }

  public getConfig(): MusicConfig {
    return { ...this.config }
  }

  public getStatus() {
    // If Spotify is connected and source mode is Spotify, occasionally sync player state
    if (this.config.sourceMode === 'spotify' && this.config.spotifyAccessToken && Date.now() - this.lastSpotifySync > 4000) {
      this.syncSpotifyPlayerState().catch(() => {})
    }

    const activePlaylist = PRESET_PLAYLISTS.find((p) => p.id === this.config.activePlaylistId) || PRESET_PLAYLISTS[0]
    const hasSpotify = Boolean(this.config.spotifyClientId && this.config.spotifyClientSecret)
    const isSpotifyConnected = Boolean(this.config.spotifyRefreshToken || this.config.spotifyAccessToken)

    return {
      isPlaying: this.isPlaying,
      isFading: this.isFading,
      volume: this.config.volume,
      liveVolume: Math.round(this.currentVolume),
      trackProgressSec: this.trackProgressSec,
      currentTrack: this.currentTrack,
      activePlaylist: {
        id: activePlaylist.id,
        name: activePlaylist.name,
        badge: activePlaylist.badge,
        totalTracks: activePlaylist.tracks.length,
        streamUrl: activePlaylist.streamUrl,
      },
      sourceMode: this.config.sourceMode,
      spotify: {
        hasKeys: hasSpotify,
        isConnected: isSpotifyConnected,
        user: this.config.spotifyUser,
        activeDeviceId: this.config.activeDeviceId,
        activeDeviceName: this.config.activeDeviceName,
      },
      schedule: {
        enabled: this.config.scheduleEnabled,
        startTime: this.config.startTime,
        endTime: this.config.endTime,
      },
    }
  }

  // ==========================================
  // SPOTIFY OAUTH & API AUTHENTICATION
  // ==========================================

  public getSpotifyAuthUrl(redirectUri: string): string {
    const clientId = (this.config.spotifyClientId || '').trim()
    if (!clientId) {
      throw new Error(
        'Spotify Client ID henüz tanımlanmamış. Lütfen önce "Spotify API & Giriş" sekmesinden 32 haneli Client ID bilginizi girip kaydedin.'
      )
    }

    if (!/^[0-9a-fA-F]{32}$/.test(clientId)) {
      throw new Error(
        `Girdiğiniz Spotify Client ID geçersiz formatta ("${clientId}"). Spotify Client ID kullanıcı adınız veya e-postanız değildir; developer.spotify.com adresinden alınan 32 karakterli özel uygulama kodudur (Örn: 4a9f8b2c1d3e5f6a7b8c9d0e1f2a3b4c).`
      )
    }

    const scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-read-email',
      'user-read-private',
    ].join(' ')

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      show_dialog: 'true',
    })

    return `https://accounts.spotify.com/authorize?${params.toString()}`
  }

  public async handleSpotifyCallback(code: string, redirectUri: string) {
    if (!this.config.spotifyClientId || !this.config.spotifyClientSecret) {
      throw new Error('Spotify Client ID veya Client Secret eksik.')
    }

    const basicAuth = Buffer.from(
      `${this.config.spotifyClientId}:${this.config.spotifyClientSecret}`
    ).toString('base64')

    const params = new URLSearchParams()
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('redirect_uri', redirectUri)

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      throw new Error(`Spotify token alımı başarısız (${tokenRes.status}): ${errBody}`)
    }

    const tokenData = await tokenRes.json()
    const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000

    this.saveConfig({
      spotifyAccessToken: tokenData.access_token,
      spotifyRefreshToken: tokenData.refresh_token || this.config.spotifyRefreshToken,
      tokenExpiresAt: expiresAt,
      sourceMode: 'spotify',
    })

    // Fetch user profile
    try {
      const userProfile = await this.spotifyApiCall('/v1/me', 'GET')
      const spotifyUser: SpotifyUser = {
        id: userProfile.id,
        name: userProfile.display_name || userProfile.id,
        email: userProfile.email,
        avatarUrl: userProfile.images?.[0]?.url,
        product: userProfile.product,
      }
      this.saveConfig({ spotifyUser })
    } catch (profileErr: any) {
      console.warn('[MusicController] Spotify /v1/me profile fetch warning:', profileErr.message)
    }

    // Try finding active device
    try {
      await this.getDevices()
    } catch {}

    return { success: true, user: this.config.spotifyUser }
  }

  public disconnectSpotify() {
    this.saveConfig({
      spotifyAccessToken: '',
      spotifyRefreshToken: '',
      tokenExpiresAt: 0,
      spotifyUser: null,
      activeDeviceId: '',
      activeDeviceName: '',
      sourceMode: 'store_radio',
    })
    return { success: true }
  }

  public async ensureValidSpotifyToken(): Promise<string | null> {
    const now = Date.now()
    if (this.config.spotifyAccessToken && this.config.tokenExpiresAt > now + 60000) {
      return this.config.spotifyAccessToken
    }

    if (!this.config.spotifyClientId || !this.config.spotifyClientSecret) {
      return null
    }

    const basicAuth = Buffer.from(
      `${this.config.spotifyClientId}:${this.config.spotifyClientSecret}`
    ).toString('base64')

    // Scenario A: We have a refresh token (OAuth user)
    if (this.config.spotifyRefreshToken) {
      try {
        const params = new URLSearchParams()
        params.append('grant_type', 'refresh_token')
        params.append('refresh_token', this.config.spotifyRefreshToken)

        const res = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        })

        if (res.ok) {
          const data = await res.json()
          const updates: Partial<MusicConfig> = {
            spotifyAccessToken: data.access_token,
            tokenExpiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          }
          if (data.refresh_token) {
            updates.spotifyRefreshToken = data.refresh_token
          }
          this.saveConfig(updates)
          return data.access_token
        }
      } catch (e: any) {
        console.error('[MusicController] Spotify refresh token error:', e.message)
      }
    }

    // Scenario B: Client Credentials (app token for search & public metadata)
    try {
      const params = new URLSearchParams()
      params.append('grant_type', 'client_credentials')

      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      })

      if (res.ok) {
        const data = await res.json()
        this.saveConfig({
          spotifyAccessToken: data.access_token,
          tokenExpiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        })
        return data.access_token
      }
    } catch (e: any) {
      console.error('[MusicController] Spotify client credentials error:', e.message)
    }

    return null
  }

  public async spotifyApiCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const token = await this.ensureValidSpotifyToken()
    if (!token) {
      throw new Error('Spotify bağlantısı veya yetkilendirme anahtarları bulunamadı.')
    }

    const url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com${endpoint}`
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
    if (body) {
      options.body = JSON.stringify(body)
    }

    const res = await fetch(url, options)
    if (res.status === 204) return null
    if (!res.ok) {
      const errText = await res.text()
      let parsedMsg = errText
      try {
        const jsonErr = JSON.parse(errText)
        parsedMsg = jsonErr?.error?.message || errText
      } catch {}

      const err: any = new Error(parsedMsg)
      err.status = res.status
      throw err
    }

    return res.json()
  }

  // ==========================================
  // SPOTIFY CONNECT & DEVICE MANAGEMENT
  // ==========================================

  public async getDevices(): Promise<SpotifyDevice[]> {
    try {
      const data = await this.spotifyApiCall('/v1/me/player/devices', 'GET')
      const devices: SpotifyDevice[] = data?.devices || []
      const active = devices.find((d) => d.is_active)
      if (active) {
        this.saveConfig({
          activeDeviceId: active.id,
          activeDeviceName: active.name,
        })
      } else if (devices.length > 0 && !this.config.activeDeviceId) {
        this.saveConfig({
          activeDeviceId: devices[0].id,
          activeDeviceName: devices[0].name,
        })
      }
      return devices
    } catch (e: any) {
      return []
    }
  }

  public async transferPlayback(deviceId: string, play: boolean = false): Promise<boolean> {
    try {
      await this.spotifyApiCall('/v1/me/player', 'PUT', {
        device_ids: [deviceId],
        play,
      })
      const devices = await this.getDevices()
      const chosen = devices.find((d) => d.id === deviceId)
      if (chosen) {
        this.saveConfig({
          activeDeviceId: chosen.id,
          activeDeviceName: chosen.name,
        })
      }
      return true
    } catch (e: any) {
      console.warn('[MusicController] transferPlayback error:', e.message)
      throw e
    }
  }

  /**
   * Helper to execute remote Spotify play with auto-device recovery
   */
  private async executeSpotifyPlay(playBody?: any) {
    try {
      let endpoint = '/v1/me/player/play'
      if (this.config.activeDeviceId) {
        endpoint += `?device_id=${encodeURIComponent(this.config.activeDeviceId)}`
      }
      await this.spotifyApiCall(endpoint, 'PUT', playBody)
      return
    } catch (err: any) {
      // 404 NO_ACTIVE_DEVICE: check devices and auto-transfer if possible
      if (err.status === 404 || err.message?.includes('Device not found') || err.message?.includes('No active device')) {
        const devices = await this.getDevices()
        if (devices.length > 0) {
          const target = devices.find((d) => d.is_active) || devices[0]
          await this.transferPlayback(target.id, false)
          // Wait 400ms for Spotify Connect state to register
          await new Promise((r) => setTimeout(r, 400))
          await this.spotifyApiCall(`/v1/me/player/play?device_id=${encodeURIComponent(target.id)}`, 'PUT', playBody)
          return
        }
        throw new Error(
          'Aktif Spotify cihazı bulunamadı. Lütfen bilgisayarınızda (Spotify masaüstü uygulaması / Web oynatıcı) veya telefonunuzda Spotify uygulamasını açın.'
        )
      }
      throw err
    }
  }

  public async syncSpotifyPlayerState() {
    this.lastSpotifySync = Date.now()
    if (!this.config.spotifyAccessToken || !this.config.spotifyRefreshToken) return

    try {
      const data = await this.spotifyApiCall('/v1/me/player', 'GET')
      if (!data) return

      this.isPlaying = Boolean(data.is_playing)
      if (typeof data.progress_ms === 'number') {
        this.trackProgressSec = Math.round(data.progress_ms / 1000)
      }

      if (data.device) {
        if (data.device.volume_percent !== null && !this.isFading) {
          this.currentVolume = data.device.volume_percent
          this.config.volume = data.device.volume_percent
        }
        if (data.device.id) {
          this.config.activeDeviceId = data.device.id
          this.config.activeDeviceName = data.device.name
        }
      }

      if (data.item) {
        this.currentTrack = {
          id: data.item.id,
          title: data.item.name,
          artist: data.item.artists?.map((a: any) => a.name).join(', ') || 'Bilinmiyor',
          album: data.item.album?.name,
          durationSec: Math.round((data.item.duration_ms || 200000) / 1000),
          albumArt: data.item.album?.images?.[0]?.url || '/customerbackground.jpg',
          uri: data.item.uri,
          previewUrl: data.item.preview_url,
          externalUrl: data.item.external_urls?.spotify,
        }
      }
    } catch {}
  }

  // ==========================================
  // PLAYBACK & VOLUME CONTROLS (WITH CROSSFADE)
  // ==========================================

  private rampVolume(target: number, durationMs: number, onComplete?: () => void) {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval)
      this.fadeInterval = null
    }

    this.isFading = true
    const steps = 25
    const stepInterval = Math.max(20, Math.floor(durationMs / steps))
    const startVolume = this.currentVolume
    const delta = (target - startVolume) / steps
    let currentStep = 0

    this.fadeInterval = setInterval(() => {
      currentStep++
      this.currentVolume = Math.min(100, Math.max(0, startVolume + delta * currentStep))

      // If connected to Spotify, update remote volume periodically during fade
      if (this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken && currentStep % 6 === 0) {
        this.syncSpotifyVolume(this.currentVolume).catch(() => {})
      }

      if (currentStep >= steps) {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval)
          this.fadeInterval = null
        }
        this.currentVolume = target
        this.isFading = false
        if (onComplete) onComplete()
      }
    }, stepInterval)
  }

  public async play(fade: boolean = true) {
    if (this.isPlaying && !this.isFading) return

    const targetVol = this.config.volume > 0 ? this.config.volume : 70
    this.isPlaying = true

    if (this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken) {
      try {
        await this.executeSpotifyPlay()
      } catch (e: any) {
        console.warn('[MusicController] Spotify play error:', e.message)
        // If device not found, let error bubble or log
        if (e.message?.includes('Spotify cihazı bulunamadı')) {
          this.isPlaying = false
          throw e
        }
      }
    }

    if (fade) {
      this.currentVolume = 0
      const durationMs = Math.round((this.config.fadeDurationSec || 2.5) * 1000)
      this.rampVolume(targetVol, durationMs)
    } else {
      this.currentVolume = targetVol
      this.isFading = false
    }
  }

  public async pause(fade: boolean = true) {
    if (!this.isPlaying) return

    if (fade) {
      const durationMs = Math.round((this.config.fadeDurationSec || 2.5) * 1000)
      this.rampVolume(0, durationMs, async () => {
        this.isPlaying = false
        if (this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken) {
          try {
            await this.spotifyApiCall('/v1/me/player/pause', 'PUT')
          } catch (e) {}
        }
      })
    } else {
      this.currentVolume = 0
      this.isPlaying = false
      if (this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken) {
        try {
          await this.spotifyApiCall('/v1/me/player/pause', 'PUT')
        } catch (e) {}
      }
    }
  }

  public async next() {
    if (this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken) {
      try {
        await this.spotifyApiCall('/v1/me/player/next', 'POST')
        setTimeout(() => this.syncSpotifyPlayerState(), 400)
        return
      } catch (e) {}
    }

    const activePlaylist = PRESET_PLAYLISTS.find((p) => p.id === this.config.activePlaylistId) || PRESET_PLAYLISTS[0]
    this.currentTrackIndex = (this.currentTrackIndex + 1) % activePlaylist.tracks.length
    await this.switchTrack(activePlaylist.tracks[this.currentTrackIndex])
  }

  public async prev() {
    if (this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken) {
      try {
        await this.spotifyApiCall('/v1/me/player/previous', 'POST')
        setTimeout(() => this.syncSpotifyPlayerState(), 400)
        return
      } catch (e) {}
    }

    const activePlaylist = PRESET_PLAYLISTS.find((p) => p.id === this.config.activePlaylistId) || PRESET_PLAYLISTS[0]
    this.currentTrackIndex =
      (this.currentTrackIndex - 1 + activePlaylist.tracks.length) % activePlaylist.tracks.length
    await this.switchTrack(activePlaylist.tracks[this.currentTrackIndex])
  }

  public async switchTrack(track: MusicTrack) {
    const targetVol = this.config.volume > 0 ? this.config.volume : 70
    const halfDuration = Math.round(((this.config.fadeDurationSec || 2.5) * 1000) / 2)

    if (this.isPlaying) {
      this.rampVolume(0, halfDuration, async () => {
        this.currentTrack = track
        this.trackProgressSec = 0

        if (track.uri && this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken) {
          try {
            await this.executeSpotifyPlay({ uris: [track.uri] })
          } catch (e: any) {
            console.warn('[MusicController] switchTrack Spotify error:', e.message)
          }
        }

        this.rampVolume(targetVol, halfDuration)
      })
    } else {
      this.currentTrack = track
      this.trackProgressSec = 0
      if (track.uri && this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken) {
        try {
          await this.executeSpotifyPlay({ uris: [track.uri] })
        } catch (e: any) {
          console.warn('[MusicController] switchTrack Spotify error:', e.message)
        }
      }
      this.play(true)
    }
  }

  public async playSpotifyPlaylist(playlistUri: string) {
    this.config.sourceMode = 'spotify'
    this.saveConfig({ sourceMode: 'spotify' })

    const targetVol = this.config.volume > 0 ? this.config.volume : 70
    const halfDuration = Math.round(((this.config.fadeDurationSec || 2.5) * 1000) / 2)

    if (this.isPlaying) {
      this.rampVolume(0, halfDuration, async () => {
        try {
          await this.executeSpotifyPlay({ context_uri: playlistUri })
        } catch (e: any) {
          console.warn('[MusicController] playSpotifyPlaylist error:', e.message)
          throw e
        }
        setTimeout(() => this.syncSpotifyPlayerState(), 500)
        this.rampVolume(targetVol, halfDuration)
      })
    } else {
      try {
        await this.executeSpotifyPlay({ context_uri: playlistUri })
      } catch (e: any) {
        console.warn('[MusicController] playSpotifyPlaylist error:', e.message)
        throw e
      }
      this.play(true)
      setTimeout(() => this.syncSpotifyPlayerState(), 500)
    }
  }

  public setVolume(vol: number) {
    const sanitized = Math.min(100, Math.max(0, Math.round(vol)))
    this.config.volume = sanitized
    this.currentVolume = sanitized
    this.saveConfig({ volume: sanitized })

    if (this.config.sourceMode === 'spotify' && this.config.spotifyRefreshToken) {
      this.syncSpotifyVolume(sanitized).catch(() => {})
    }
  }

  private async syncSpotifyVolume(vol: number) {
    if (!this.config.spotifyAccessToken) return
    try {
      await this.spotifyApiCall(`/v1/me/player/volume?volume_percent=${Math.round(vol)}`, 'PUT')
    } catch {}
  }

  public selectPlaylist(playlistId: string) {
    const found = PRESET_PLAYLISTS.find((p) => p.id === playlistId)
    if (found) {
      this.config.sourceMode = 'store_radio'
      this.config.activePlaylistId = playlistId
      this.saveConfig({ activePlaylistId: playlistId, sourceMode: 'store_radio' })
      this.currentTrackIndex = 0
      this.switchTrack(found.tracks[0])
    }
  }

  // ==========================================
  // SPOTIFY USER PLAYLISTS & REAL TRACK SEARCH
  // ==========================================

  public async getUserPlaylists(): Promise<SpotifyPlaylist[]> {
    if (!this.config.spotifyRefreshToken && !this.config.spotifyAccessToken) {
      return []
    }

    try {
      const data = await this.spotifyApiCall('/v1/me/playlists?limit=50', 'GET')
      if (!data?.items) return []

      return data.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        trackCount: item.tracks?.total || 0,
        imageUrl: item.images?.[0]?.url || item.images?.[1]?.url || '/customerbackground.jpg',
        uri: item.uri,
        owner: item.owner?.display_name || 'Spotify',
      }))
    } catch (e: any) {
      console.warn('[MusicController] getUserPlaylists error:', e.message)
      return []
    }
  }

  public async searchTracks(query: string): Promise<MusicTrack[]> {
    const q = (query || '').trim()
    if (!q) return []

    const results: MusicTrack[] = []

    // 1. Search Spotify Web API (using user OAuth or Client Credentials token)
    try {
      const spotifyData = await this.spotifyApiCall(
        `/v1/search?q=${encodeURIComponent(q)}&type=track&limit=25`,
        'GET'
      )
      if (spotifyData?.tracks?.items) {
        for (const item of spotifyData.tracks.items) {
          results.push({
            id: item.id,
            title: item.name,
            artist: item.artists?.map((a: any) => a.name).join(', ') || 'Bilinmiyor',
            album: item.album?.name,
            durationSec: Math.round(item.duration_ms / 1000),
            albumArt: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || '/customerbackground.jpg',
            uri: item.uri,
            previewUrl: item.preview_url,
            externalUrl: item.external_urls?.spotify,
          })
        }
      }
    } catch (err: any) {
      console.warn('[MusicController] Spotify search error:', err.message)
    }

    // 2. Universal Global Catalog Search (iTunes Search API - over 100M Turkish & Global songs, works with 0 API keys)
    if (results.length === 0) {
      try {
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=25`,
          { headers: { 'User-Agent': 'MagazaPOS/1.0' } }
        )
        if (itunesRes.ok) {
          const itunesData: any = await itunesRes.json()
          if (itunesData?.results && Array.isArray(itunesData.results)) {
            for (const item of itunesData.results) {
              results.push({
                id: `itunes_${item.trackId}`,
                title: item.trackName || 'Bilinmeyen Şarkı',
                artist: item.artistName || 'Bilinmeyen Sanatçı',
                album: item.collectionName,
                durationSec: Math.round((item.trackTimeMillis || 180000) / 1000),
                albumArt:
                  (item.artworkUrl100 || item.artworkUrl60 || '').replace('100x100bb', '600x600bb') ||
                  '/customerbackground.jpg',
                previewUrl: item.previewUrl,
                externalUrl: item.trackViewUrl,
              })
            }
          }
        }
      } catch (itunesErr: any) {
        console.warn('[MusicController] iTunes search notice:', itunesErr.message)
      }
    }

    // 3. Match with preset catalog if still empty
    if (results.length === 0) {
      const qLower = q.toLowerCase()
      for (const pl of PRESET_PLAYLISTS) {
        for (const t of pl.tracks) {
          if (
            t.title.toLowerCase().includes(qLower) ||
            t.artist.toLowerCase().includes(qLower) ||
            (t.album && t.album.toLowerCase().includes(qLower))
          ) {
            if (!results.some((r) => r.id === t.id)) {
              results.push(t)
            }
          }
        }
      }
    }

    return results
  }

  // ==========================================
  // PROGRESS & STORE SCHEDULE TIMERS
  // ==========================================

  private startTrackProgressTimer() {
    if (this.playbackTimer) clearInterval(this.playbackTimer)
    this.playbackTimer = setInterval(() => {
      if (this.isPlaying) {
        this.trackProgressSec++
        const maxSec = this.currentTrack?.durationSec || 200
        if (this.trackProgressSec >= maxSec) {
          this.trackProgressSec = 0
          this.next()
        }
      }
    }, 1000)
  }

  private startScheduler() {
    if (this.schedulerInterval) clearInterval(this.schedulerInterval)
    this.schedulerInterval = setInterval(() => {
      if (!this.config.scheduleEnabled) return

      const now = new Date()
      const currentHours = String(now.getHours()).padStart(2, '0')
      const currentMinutes = String(now.getMinutes()).padStart(2, '0')
      const currentTimeStr = `${currentHours}:${currentMinutes}`

      if (this.lastTriggeredMinute === currentTimeStr) return

      // Sabah açılış saati
      if (currentTimeStr === this.config.startTime && !this.isPlaying) {
        this.lastTriggeredMinute = currentTimeStr
        console.log(`[MusicScheduler] Mağaza açılış saati geldi (${currentTimeStr}). Müzik yumuşakça başlatılıyor...`)
        this.play(true)
      }

      // Akşam kapanış saati
      if (currentTimeStr === this.config.endTime && this.isPlaying) {
        this.lastTriggeredMinute = currentTimeStr
        console.log(`[MusicScheduler] Mağaza kapanış saati geldi (${currentTimeStr}). Müzik yumuşakça durduruluyor...`)
        this.pause(true)
      }
    }, 30000)
  }
}

export const musicController = new MusicController()
