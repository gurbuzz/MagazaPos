import React, { useEffect, useRef } from 'react'
import { useMusicStore } from '../../store/useMusicStore'

/**
 * Background HTML5 Audio Engine for MağazaPOS Store Music
 * Plays the store radio live streams (Lufian Lounge, Jack & Jones Energy, etc.)
 * through the computer's active audio output (PC Speakers / AUX / Connected Amplifier).
 *
 * NOTE: When in Spotify mode, Spotify Connect (Desktop App / Mobile / Connect Device)
 * handles playback directly. HTML5 Audio stays paused, silent, and unloaded.
 */
export const MusicPlayerAudio: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef = useRef(false)
  const { isPlaying, liveVolume, sourceMode, activePlaylist, fetchStatus } = useMusicStore()

  isPlayingRef.current = isPlaying

  // Initialize persistent audio instance once
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'none'
    audio.crossOrigin = 'anonymous'
    audioRef.current = audio

    // Initial fetch to sync store status on app boot
    fetchStatus()

    // Periodic heartbeat to stay in sync with store schedule (e.g. 09:30 open, 21:30 close)
    const syncInterval = setInterval(() => {
      fetchStatus()
    }, 4000)

    // Handle stream stall / network hiccup on live radio stream with soft reconnect
    const handleStall = () => {
      if (useMusicStore.getState().sourceMode === 'spotify') return
      if (isPlayingRef.current && audio.src) {
        console.warn('[MusicPlayerAudio] Radio stream stalled, reconnecting...')
        audio.load()
        audio.play().catch(() => {})
      }
    }

    // Never trigger track skips on stream end or reconnect!
    // Live radio streams should reconnect if ended/stalled, never advance or skip to other stations.
    audio.addEventListener('stalled', handleStall)
    audio.addEventListener('error', handleStall)
    audio.addEventListener('ended', handleStall)

    return () => {
      clearInterval(syncInterval)
      audio.removeEventListener('stalled', handleStall)
      audio.removeEventListener('error', handleStall)
      audio.removeEventListener('ended', handleStall)
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Sync Audio source and playback state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // In Spotify mode, Spotify handles playback natively.
    // HTML5 Audio must NEVER play preview clips or interfere!
    if (sourceMode === 'spotify') {
      audio.pause()
      if (audio.src) {
        audio.removeAttribute('src')
        audio.load()
      }
      return
    }

    // In Store Radio mode, play the 24/7 radio stream
    const streamUrl = activePlaylist?.streamUrl || null

    if (streamUrl) {
      if (audio.src !== streamUrl) {
        audio.src = streamUrl
        audio.load()
      }

      if (isPlaying) {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[MusicPlayerAudio] Radio stream playback notice:', err.message)
          })
        }
      } else {
        audio.pause()
      }
    } else {
      audio.pause()
      if (audio.src) {
        audio.removeAttribute('src')
        audio.load()
      }
    }
  }, [isPlaying, sourceMode, activePlaylist?.streamUrl])

  // Sync Live Volume (handles real-time smooth fade-in and fade-out smoothly)
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Volume in HTML5 Audio is 0.0 to 1.0
    const target = Math.max(0, Math.min(1, (liveVolume ?? 70) / 100))
    audio.volume = target
  }, [liveVolume])

  return null
}
