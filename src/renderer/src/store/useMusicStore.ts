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
}

export interface PlaylistInfo {
  id: string
  name: string
  description: string
  badge: string
  icon: string
  trackCount: number
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
  spotify: { hasKeys: boolean; isConnected: boolean }
  schedule: { enabled: boolean; startTime: string; endTime: string }
  playlists: PlaylistInfo[]
  searchResults: MusicTrack[]
  searchQuery: string
  isSearching: boolean
  config: any

  setIsModalOpen: (open: boolean) => void
  setActiveTab: (tab: 'player' | 'search' | 'playlists' | 'schedule' | 'spotify') => void
  fetchStatus: () => Promise<void>
  fetchPlaylists: () => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  setVolume: (vol: number) => Promise<void>
  search: (q: string) => Promise<void>
  selectTrack: (track: MusicTrack) => Promise<void>
  selectPlaylist: (id: string) => Promise<void>
  fetchConfig: () => Promise<void>
  saveConfig: (updates: any) => Promise<boolean>
}

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
  sourceMode: 'store_radio',
  spotify: { hasKeys: false, isConnected: false },
  schedule: { enabled: true, startTime: '09:30', endTime: '21:30' },
  playlists: [],
  searchResults: [],
  searchQuery: '',
  isSearching: false,
  config: null,

  setIsModalOpen: (open) => set({ isModalOpen: open }),
  setActiveTab: (tab) => set({ activeTab: tab }),

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
          spotify: data.spotify,
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
        set({ playlists: data.presets || [] })
      }
    } catch {}
  },

  play: async () => {
    try {
      set({ isPlaying: true, isFading: true })
      const res = await fetch('/api/music/play', { method: 'POST' })
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
    set({ isSearching: true })
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
      set({ currentTrack: track, isPlaying: true, isFading: true, trackProgressSec: 0 })
      const res = await fetch('/api/music/select-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.status) {
          set({
            currentTrack: data.status.currentTrack,
            isPlaying: data.status.isPlaying,
            isFading: data.status.isFading,
          })
        }
      }
    } catch {}
  },

  selectPlaylist: async (playlistId: string) => {
    try {
      set({ isFading: true })
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
