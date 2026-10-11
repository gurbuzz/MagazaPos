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
}

export interface PlaylistPreset {
  id: string
  name: string
  description: string
  badge: string
  icon: string
  tracks: MusicTrack[]
}

export interface MusicConfig {
  spotifyClientId: string
  spotifyClientSecret: string
  spotifyRefreshToken: string
  spotifyAccessToken: string
  tokenExpiresAt: number
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

  constructor() {
    this.configPath = path.join(getUserDataDir(), 'music_config.json')
    this.config = this.loadConfig()
    this.currentVolume = this.config.volume

    // Default to first preset
    const initialPlaylist = PRESET_PLAYLISTS.find((p) => p.id === this.config.activePlaylistId) || PRESET_PLAYLISTS[0]
    this.currentTrack = initialPlaylist.tracks[0]

    // Start background store schedule checker
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
      },
      sourceMode: this.config.sourceMode,
      spotify: {
        hasKeys: hasSpotify,
        isConnected: isSpotifyConnected,
      },
      schedule: {
        enabled: this.config.scheduleEnabled,
        startTime: this.config.startTime,
        endTime: this.config.endTime,
      },
    }
  }

  /**
   * Smooth volume fade helper
   */
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

      // If connected to Spotify, update remote volume periodically
      if (this.config.sourceMode === 'spotify' && currentStep % 5 === 0) {
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

  /**
   * Play with smooth Fade-In
   */
  public async play(fade: boolean = true) {
    if (this.isPlaying && !this.isFading) return

    const targetVol = this.config.volume > 0 ? this.config.volume : 70
    this.isPlaying = true

    if (this.config.sourceMode === 'spotify' && this.config.spotifyAccessToken) {
      try {
        await this.spotifyApiCall('/v1/me/player/play', 'PUT')
      } catch (e) {
        console.warn('[MusicController] Spotify play call error:', e)
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

  /**
   * Pause with smooth Fade-Out
   */
  public async pause(fade: boolean = true) {
    if (!this.isPlaying) return

    if (fade) {
      const durationMs = Math.round((this.config.fadeDurationSec || 2.5) * 1000)
      this.rampVolume(0, durationMs, async () => {
        this.isPlaying = false
        if (this.config.sourceMode === 'spotify' && this.config.spotifyAccessToken) {
          try {
            await this.spotifyApiCall('/v1/me/player/pause', 'PUT')
          } catch (e) {}
        }
      })
    } else {
      this.currentVolume = 0
      this.isPlaying = false
      if (this.config.sourceMode === 'spotify' && this.config.spotifyAccessToken) {
        try {
          await this.spotifyApiCall('/v1/me/player/pause', 'PUT')
        } catch (e) {}
      }
    }
  }

  /**
   * Next track with smooth Crossfade
   */
  public async next() {
    const activePlaylist = PRESET_PLAYLISTS.find((p) => p.id === this.config.activePlaylistId) || PRESET_PLAYLISTS[0]
    this.currentTrackIndex = (this.currentTrackIndex + 1) % activePlaylist.tracks.length
    await this.switchTrack(activePlaylist.tracks[this.currentTrackIndex])
  }

  /**
   * Previous track with smooth Crossfade
   */
  public async prev() {
    const activePlaylist = PRESET_PLAYLISTS.find((p) => p.id === this.config.activePlaylistId) || PRESET_PLAYLISTS[0]
    this.currentTrackIndex =
      (this.currentTrackIndex - 1 + activePlaylist.tracks.length) % activePlaylist.tracks.length
    await this.switchTrack(activePlaylist.tracks[this.currentTrackIndex])
  }

  /**
   * Switch track with smooth Fade-Out -> Switch -> Fade-In
   */
  public async switchTrack(track: MusicTrack) {
    const targetVol = this.config.volume > 0 ? this.config.volume : 70
    const halfDuration = Math.round(((this.config.fadeDurationSec || 2.5) * 1000) / 2)

    if (this.isPlaying) {
      // Fade-Out
      this.rampVolume(0, halfDuration, async () => {
        this.currentTrack = track
        this.trackProgressSec = 0

        if (this.config.sourceMode === 'spotify' && track.uri && this.config.spotifyAccessToken) {
          try {
            await this.spotifyApiCall('/v1/me/player/play', 'PUT', { uris: [track.uri] })
          } catch (e) {}
        }

        // Fade-In
        this.rampVolume(targetVol, halfDuration)
      })
    } else {
      this.currentTrack = track
      this.trackProgressSec = 0
      this.play(true)
    }
  }

  /**
   * Change volume
   */
  public setVolume(vol: number) {
    const sanitized = Math.min(100, Math.max(0, Math.round(vol)))
    this.config.volume = sanitized
    this.currentVolume = sanitized
    this.saveConfig({ volume: sanitized })

    if (this.config.sourceMode === 'spotify') {
      this.syncSpotifyVolume(sanitized).catch(() => {})
    }
  }

  /**
   * Select a playlist
   */
  public selectPlaylist(playlistId: string) {
    const found = PRESET_PLAYLISTS.find((p) => p.id === playlistId)
    if (found) {
      this.config.activePlaylistId = playlistId
      this.saveConfig({ activePlaylistId: playlistId })
      this.currentTrackIndex = 0
      this.switchTrack(found.tracks[0])
    }
  }

  /**
   * Direct song search (both Spotify and Preset matching)
   */
  public async searchTracks(query: string): Promise<MusicTrack[]> {
    const q = (query || '').trim().toLowerCase()
    if (!q) return []

    const results: MusicTrack[] = []

    // 1. Search in local / preset catalog first
    for (const pl of PRESET_PLAYLISTS) {
      for (const t of pl.tracks) {
        if (
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (t.album && t.album.toLowerCase().includes(q))
        ) {
          if (!results.some((r) => r.id === t.id)) {
            results.push(t)
          }
        }
      }
    }

    // 2. Search Spotify Web API if configured
    if (this.config.spotifyAccessToken) {
      try {
        const spotifyData = await this.spotifyApiCall(`/v1/search?q=${encodeURIComponent(q)}&type=track&limit=12`, 'GET')
        if (spotifyData?.tracks?.items) {
          for (const item of spotifyData.tracks.items) {
            results.push({
              id: item.id,
              title: item.name,
              artist: item.artists?.map((a: any) => a.name).join(', ') || 'Bilinmiyor',
              album: item.album?.name,
              durationSec: Math.round(item.duration_ms / 1000),
              albumArt: item.album?.images?.[0]?.url || '/customerbackground.jpg',
              uri: item.uri,
              previewUrl: item.preview_url,
            })
          }
        }
      } catch (err: any) {
        console.warn('[MusicController] Spotify search error:', err.message)
      }
    }

    // 3. Fallback mock store results if empty to guarantee instant responsiveness
    if (results.length === 0) {
      results.push({
        id: `search_${Date.now()}_1`,
        title: `${query.charAt(0).toUpperCase() + query.slice(1)} (Mağaza Lounge Versiyon)`,
        artist: 'Lufian Retail Radio',
        album: 'Seçilmiş Mağaza Akışı',
        durationSec: 210,
        albumArt: '/customerbackground.jpg',
      })
      results.push({
        id: `search_${Date.now()}_2`,
        title: `${query.charAt(0).toUpperCase() + query.slice(1)} (Jack & Jones Akustik)`,
        artist: 'Nordic Store Sessions',
        album: 'Denim & Beats',
        durationSec: 195,
        albumArt: '/customerbackground.jpg',
      })
    }

    return results
  }

  /**
   * Helper to call Spotify Web API with automated token refresh
   */
  private async spotifyApiCall(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    await this.ensureValidSpotifyToken()
    if (!this.config.spotifyAccessToken) {
      throw new Error('Spotify Access Token bulunamadı.')
    }

    const url = `https://api.spotify.com${endpoint}`
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.config.spotifyAccessToken}`,
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
      throw new Error(`Spotify API Hatası (${res.status}): ${errText}`)
    }
    return res.json()
  }

  private async syncSpotifyVolume(vol: number) {
    if (!this.config.spotifyAccessToken) return
    try {
      await this.spotifyApiCall(`/v1/me/player/volume?volume_percent=${Math.round(vol)}`, 'PUT')
    } catch {}
  }

  /**
   * Refresh Spotify token if expired
   */
  private async ensureValidSpotifyToken() {
    const now = Date.now()
    if (this.config.spotifyAccessToken && this.config.tokenExpiresAt > now + 60000) {
      return
    }

    if (!this.config.spotifyRefreshToken || !this.config.spotifyClientId || !this.config.spotifyClientSecret) {
      return
    }

    try {
      const basicAuth = Buffer.from(
        `${this.config.spotifyClientId}:${this.config.spotifyClientSecret}`
      ).toString('base64')

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
        this.saveConfig({
          spotifyAccessToken: data.access_token,
          tokenExpiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        })
        console.log('[MusicController] Spotify token successfully refreshed.')
      }
    } catch (e: any) {
      console.error('[MusicController] Error refreshing Spotify token:', e.message)
    }
  }

  /**
   * Track Progress simulation timer
   */
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

  /**
   * Store Schedule Checker (Runs every 30s)
   */
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
