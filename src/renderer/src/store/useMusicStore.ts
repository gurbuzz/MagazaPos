import { create } from 'zustand'

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

export interface PlaylistInfo {
  id: string
  name: string
  description: string
  badge: string
  icon: string
  trackCount: number
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

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  volume_percent: number | null
}

export interface SpotifyUser {
  id: string
  name: string
  email?: string
  avatarUrl?: string
  product?: string
}

interface MusicState {
  isModalOpen: boolean
  activeTab: 'player' | 'search' | 'playlists' | 'schedule' | 'spotify'
  isPlaying: boolean
  isFading: boolean
  volume: number
  liveVolume: number
  trackProgressSec: number
  currentTrack: MusicTrack | null
  activePlaylist: { id: string; name: string; badge: string; totalTracks: number; streamUrl?: string } | null
  sourceMode: 'spotify' | 'store_radio'
  spotify: {
    hasKeys: boolean
    isConnected: boolean
    user: SpotifyUser | null
    activeDeviceId: string
    activeDeviceName: string
  }
  schedule: { enabled: boolean; startTime: string; endTime: string }
  playlists: PlaylistInfo[]
  userPlaylists: SpotifyPlaylist[]
  devices: SpotifyDevice[]
  searchResults: MusicTrack[]
  searchQuery: string
  isSearching: boolean
  errorMessage: string | null
  config: any

  isConnectingSpotify: boolean
  setIsModalOpen: (open: boolean) => void
  setActiveTab: (tab: 'player' | 'search' | 'playlists' | 'schedule' | 'spotify') => void
  setErrorMessage: (msg: string | null) => void
  fetchStatus: () => Promise<void>
  fetchPlaylists: () => Promise<void>
  fetchDevices: () => Promise<void>
  transferDevice: (deviceId: string) => Promise<boolean>
  play: () => Promise<void>
  pause: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  setVolume: (vol: number) => Promise<void>
  search: (q: string) => Promise<void>
  selectTrack: (track: MusicTrack) => Promise<void>
  selectPlaylist: (id: string) => Promise<void>
  playSpotifyPlaylist: (uri: string) => Promise<void>
  connectSpotify: () => Promise<void>
  cancelSpotifyConnect: () => void
  disconnectSpotify: () => Promise<void>
  fetchConfig: () => Promise<void>
  saveConfig: (updates: any) => Promise<boolean>
}

let spotifyListenerAttached = false
let spotifyPollTimer: any = null

export const useMusicStore = create<MusicState>((set, get) => ({
  isModalOpen: false,
  activeTab: 'player',
  isPlaying: false,
  isFading: false,
  volume: 70,
  liveVolume: 70,
  trackProgressSec: 0,
  currentTrack: null,
  activePlaylist: null,
  sourceMode: 'spotify',
  spotify: {
    hasKeys: false,
    isConnected: false,
    user: null,
    activeDeviceId: '',
    activeDeviceName: '',
  },
  schedule: { enabled: true, startTime: '09:30', endTime: '21:30' },
  playlists: [],
  userPlaylists: [],
  devices: [],
  searchResults: [],
  searchQuery: '',
  isSearching: false,
  errorMessage: null,
  config: null,
  isConnectingSpotify: false,

  setIsModalOpen: (open) => {
    set({ isModalOpen: open })
    if (open) {
      get().fetchStatus()
      get().fetchPlaylists()
      get().fetchConfig()
      get().fetchDevices()
    }
  },

  setActiveTab: (tab) => {
    set({ activeTab: tab })
    if (tab === 'spotify') {
      get().fetchDevices()
      get().fetchConfig()
    } else if (tab === 'playlists') {
      get().fetchPlaylists()
    }
  },

  setErrorMessage: (msg) => set({ errorMessage: msg }),

  fetchStatus: async () => {
    try {
      const res = await fetch('/api/music/status')
      if (res.ok) {
        const data = await res.json()
        set({
          isPlaying: data.isPlaying,
          isFading: data.isFading,
          volume: data.volume,
          liveVolume: data.liveVolume,
          trackProgressSec: data.trackProgressSec,
          currentTrack: data.currentTrack,
          activePlaylist: data.activePlaylist,
          sourceMode: data.sourceMode,
          spotify: data.spotify || {
            hasKeys: false,
            isConnected: false,
            user: null,
            activeDeviceId: '',
            activeDeviceName: '',
          },
          schedule: data.schedule,
        })
      }
    } catch {}
  },

  fetchPlaylists: async () => {
    try {
      const res = await fetch('/api/music/playlists')
      if (res.ok) {
        const data = await res.json()
        set({
          playlists: data.presets || [],
          userPlaylists: data.userPlaylists || [],
        })
      }
    } catch {}
  },

  fetchDevices: async () => {
    try {
      const res = await fetch('/api/music/spotify/devices')
      if (res.ok) {
        const data = await res.json()
        set({ devices: data.devices || [] })
      }
    } catch {}
  },

  transferDevice: async (deviceId: string) => {
    try {
      const res = await fetch('/api/music/spotify/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, play: true }),
      })
      if (res.ok) {
        await get().fetchDevices()
        await get().fetchStatus()
        return true
      }
      return false
    } catch {
      return false
    }
  },

  play: async () => {
    try {
      set({ errorMessage: null, isFading: true })
      const res = await fetch('/api/music/play', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        set({ errorMessage: data.error || 'Oynatma başlatılamadı.', isFading: false })
        return
      }
      if (data.status) {
        set({
          isPlaying: data.status.isPlaying,
          isFading: data.status.isFading,
          liveVolume: data.status.liveVolume,
          sourceMode: data.status.sourceMode,
          currentTrack: data.status.currentTrack,
          activePlaylist: data.status.activePlaylist,
        })
      }
    } catch (e: any) {
      set({ errorMessage: e.message, isFading: false })
    }
  },

  pause: async () => {
    try {
      set({ isFading: true })
      const res = await fetch('/api/music/pause', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.status) {
          set({
            isPlaying: data.status.isPlaying,
            isFading: data.status.isFading,
            liveVolume: data.status.liveVolume,
            sourceMode: data.status.sourceMode,
          })
        }
      }
    } catch {}
  },

  next: async () => {
    try {
      set({ isFading: true })
      const res = await fetch('/api/music/next', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.status) {
          set({
            currentTrack: data.status.currentTrack,
            isPlaying: data.status.isPlaying,
            isFading: data.status.isFading,
            sourceMode: data.status.sourceMode,
            activePlaylist: data.status.activePlaylist,
            trackProgressSec: data.status.trackProgressSec ?? 0,
          })
        }
      }
    } catch {}
  },

  prev: async () => {
    try {
      set({ isFading: true })
      const res = await fetch('/api/music/prev', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.status) {
          set({
            currentTrack: data.status.currentTrack,
            isPlaying: data.status.isPlaying,
            isFading: data.status.isFading,
            sourceMode: data.status.sourceMode,
            activePlaylist: data.status.activePlaylist,
            trackProgressSec: data.status.trackProgressSec ?? 0,
          })
        }
      }
    } catch {}
  },

  setVolume: async (vol: number) => {
    set({ volume: vol, liveVolume: vol })
    try {
      await fetch('/api/music/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: vol }),
      })
    } catch {}
  },

  search: async (q: string) => {
    set({ searchQuery: q })
    if (!q.trim()) {
      set({ searchResults: [], isSearching: false })
      return
    }
    set({ isSearching: true, errorMessage: null })
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q.trim())}`)
      if (res.ok) {
        const data = await res.json()
        set({ searchResults: data, isSearching: false })
      } else {
        set({ isSearching: false })
      }
    } catch {
      set({ isSearching: false })
    }
  },

  selectTrack: async (track: MusicTrack) => {
    try {
      const isSpotify = Boolean(
        (track.uri && track.uri.startsWith('spotify:')) ||
        get().spotify.isConnected ||
        get().sourceMode === 'spotify'
      )
      set({
        currentTrack: track,
        isPlaying: true,
        isFading: true,
        trackProgressSec: 0,
        sourceMode: isSpotify ? 'spotify' : get().sourceMode,
        errorMessage: null,
      })
      const res = await fetch('/api/music/select-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track }),
      })
      const data = await res.json()
      if (!res.ok) {
        set({ errorMessage: data.error || 'Şarkı açılamadı.', isFading: false })
        return
      }
      if (data.status) {
        set({
          currentTrack: data.status.currentTrack,
          isPlaying: data.status.isPlaying,
          isFading: data.status.isFading,
          sourceMode: data.status.sourceMode,
          activePlaylist: data.status.activePlaylist,
          trackProgressSec: data.status.trackProgressSec ?? 0,
        })
      }
    } catch (e: any) {
      set({ errorMessage: e.message, isFading: false })
    }
  },

  selectPlaylist: async (playlistId: string) => {
    try {
      set({ isFading: true, sourceMode: 'store_radio', errorMessage: null })
      const res = await fetch('/api/music/select-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.status) {
          set({
            currentTrack: data.status.currentTrack,
            activePlaylist: data.status.activePlaylist,
            isPlaying: data.status.isPlaying,
            isFading: data.status.isFading,
            sourceMode: data.status.sourceMode,
            trackProgressSec: 0,
          })
        }
      }
    } catch {}
  },

  playSpotifyPlaylist: async (uri: string) => {
    try {
      set({ isFading: true, sourceMode: 'spotify', errorMessage: null })
      const res = await fetch('/api/music/spotify/play-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri }),
      })
      const data = await res.json()
      if (!res.ok) {
        set({ errorMessage: data.error || 'Çalma listesi başlatılamadı.', isFading: false })
        return
      }
      if (data.status) {
        set({
          currentTrack: data.status.currentTrack,
          isPlaying: data.status.isPlaying,
          isFading: data.status.isFading,
          sourceMode: data.status.sourceMode,
          activePlaylist: data.status.activePlaylist,
          trackProgressSec: data.status.trackProgressSec ?? 0,
        })
      }
    } catch (e: any) {
      set({ errorMessage: e.message, isFading: false })
    }
  },

  connectSpotify: async () => {
    const state = get()
    const clientId = (state.config?.spotifyClientId || '').trim()
    const is32Hex = /^[0-9a-fA-F]{32}$/.test(clientId)

    if (!is32Hex) {
      set({
        errorMessage:
          'Spotify bağlantısı için geçerli bir 32 haneli Client ID gereklidir. Spotify kullanıcı adınız veya e-postanız DEĞİLDİR. Lütfen "Spotify API & Giriş" sekmesindeki rehberi takip ederek developer.spotify.com üzerinden aldığınız 32 haneli Client ID kodunu kaydediniz.',
        activeTab: 'spotify',
      })
      return
    }

    try {
      set({ isConnectingSpotify: true, errorMessage: null })

      // Server'dan tam Spotify yetkilendirme URL'sini al
      const res = await fetch('/api/music/spotify/login?json=true')
      const data = await res.json()

      if (!res.ok) {
        set({
          isConnectingSpotify: false,
          errorMessage: data.error || 'Spotify bağlantı adresi alınamadı. Lütfen Client ID ayarlarınızı kontrol edin.',
          activeTab: 'spotify',
        })
        return
      }

      const authUrl = data.url
      if (!authUrl) {
        throw new Error('Spotify yetkilendirme bağlantısı oluşturulamadı.')
      }

      // 2. Tarayıcıda veya popup pencerede aç
      if ((window as any).electron?.openExternal) {
        await (window as any).electron.openExternal(authUrl)
      } else {
        const width = 540
        const height = 720
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2
        window.open(
          authUrl,
          'spotify_login_window',
          `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
        )
      }

      // 3. PostMessage dinleyicisi (popup üzerinden mesaj dönerse)
      if (!spotifyListenerAttached) {
        spotifyListenerAttached = true
        window.addEventListener('message', (event) => {
          if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
            if (spotifyPollTimer) {
              clearInterval(spotifyPollTimer)
              spotifyPollTimer = null
            }
            set({ isConnectingSpotify: false, errorMessage: null })
            get().fetchConfig()
            get().fetchStatus()
            get().fetchPlaylists()
            get().fetchDevices()
          }
        })
      }

      // 4. Polling: Tarayıcıda 'Kabul Et' tıklandığında durumu otomatik tespit et
      if (spotifyPollTimer) {
        clearInterval(spotifyPollTimer)
        spotifyPollTimer = null
      }

      let attempts = 0
      const maxAttempts = 60 // 60 * 1500ms = 90 saniye

      spotifyPollTimer = setInterval(async () => {
        attempts++
        try {
          await get().fetchStatus()
          const current = get()
          if (current.spotify.isConnected) {
            if (spotifyPollTimer) {
              clearInterval(spotifyPollTimer)
              spotifyPollTimer = null
            }
            set({ isConnectingSpotify: false, errorMessage: null })
            await get().fetchConfig()
            await get().fetchPlaylists()
            await get().fetchDevices()
          } else if (attempts >= maxAttempts) {
            if (spotifyPollTimer) {
              clearInterval(spotifyPollTimer)
              spotifyPollTimer = null
            }
            set({ isConnectingSpotify: false })
          }
        } catch {
          if (attempts >= maxAttempts) {
            if (spotifyPollTimer) {
              clearInterval(spotifyPollTimer)
              spotifyPollTimer = null
            }
            set({ isConnectingSpotify: false })
          }
        }
      }, 1500)
    } catch (err: any) {
      set({
        isConnectingSpotify: false,
        errorMessage: err.message || 'Spotify bağlantısı başlatılamadı.',
      })
    }
  },

  cancelSpotifyConnect: () => {
    if (spotifyPollTimer) {
      clearInterval(spotifyPollTimer)
      spotifyPollTimer = null
    }
    set({ isConnectingSpotify: false })
  },

  disconnectSpotify: async () => {
    try {
      if (spotifyPollTimer) {
        clearInterval(spotifyPollTimer)
        spotifyPollTimer = null
      }
      set({ isConnectingSpotify: false })
      const res = await fetch('/api/music/spotify/disconnect', { method: 'POST' })
      if (res.ok) {
        await get().fetchConfig()
        await get().fetchStatus()
        set({ userPlaylists: [], devices: [] })
      }
    } catch {}
  },

  fetchConfig: async () => {
    try {
      const res = await fetch('/api/music/config')
      if (res.ok) {
        const data = await res.json()
        set({ config: data })
      }
    } catch {}
  },

  saveConfig: async (updates: any) => {
    try {
      const res = await fetch('/api/music/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json()
        set({ config: data.config })
        get().fetchStatus()
        return true
      }
      return false
    } catch {
      return false
    }
  },
}))
