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
  connectSpotify: () => void
  disconnectSpotify: () => Promise<void>
  fetchConfig: () => Promise<void>
  saveConfig: (updates: any) => Promise<boolean>
}

let spotifyListenerAttached = false

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
            trackProgressSec: 0,
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
            trackProgressSec: 0,
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
      set({ currentTrack: track, isPlaying: true, isFading: true, trackProgressSec: 0, errorMessage: null })
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
        })
      }
    } catch (e: any) {
      set({ errorMessage: e.message, isFading: false })
    }
  },

  selectPlaylist: async (playlistId: string) => {
    try {
      set({ isFading: true, errorMessage: null })
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
          })
        }
      }
    } catch {}
  },

  playSpotifyPlaylist: async (uri: string) => {
    try {
      set({ isFading: true, errorMessage: null })
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
        })
      }
    } catch (e: any) {
      set({ errorMessage: e.message, isFading: false })
    }
  },

  connectSpotify: () => {
    // Open OAuth login popup
    const width = 540
    const height = 720
    const left = window.screen.width / 2 - width / 2
    const top = window.screen.height / 2 - height / 2

    const popup = window.open(
      '/api/music/spotify/login',
      'spotify_login_window',
      `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`
    )

    if (!spotifyListenerAttached) {
      spotifyListenerAttached = true
      window.addEventListener('message', (event) => {
        if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
          if (popup && !popup.closed) popup.close()
          get().fetchConfig()
          get().fetchStatus()
          get().fetchPlaylists()
          get().fetchDevices()
        }
      })
    }
  },

  disconnectSpotify: async () => {
    try {
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
