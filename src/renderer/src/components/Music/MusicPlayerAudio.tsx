import React, { useEffect, useRef } from 'react'
import { useMusicStore } from '../../store/useMusicStore'

/**
 * Background HTML5 Audio Engine for MağazaPOS Store Music
 * Plays audio through the computer's active audio output (PC Speakers / AUX / Connected Amplifier).
 */
export const MusicPlayerAudio: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isPlayingRef = useRef(false)
  const { isPlaying, liveVolume, sourceMode, activePlaylist, currentTrack, fetchStatus } = useMusicStore()

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

    // Handle stream stall / disconnect with soft reconnect
    const handleStall = () => {
      if (isPlayingRef.current && audio.src) {
        console.warn('[MusicPlayerAudio] Stream stalled, refreshing source...')
        audio.load()
        audio.play().catch(() => {})
      }
    }

    const handleEnded = () => {
      // When preview ends, proceed to next track
      useMusicStore.getState().next()
    }

    audio.addEventListener('stalled', handleStall)
    audio.addEventListener('error', handleStall)
    audio.addEventListener('ended', handleEnded)

    return () => {
      clearInterval(syncInterval)
      audio.removeEventListener('stalled', handleStall)
      audio.removeEventListener('error', handleStall)
      audio.removeEventListener('ended', handleEnded)
      audio.pause()
      audio.src = ''
    }
  }, [])

  // Sync Audio source and playback state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Priority 1: Current track has preview audio URL (e.g. from song search)
    // Priority 2: Store radio live stream
    const targetUrl = currentTrack?.previewUrl || (sourceMode === 'store_radio' ? activePlaylist?.streamUrl : null)

    if (targetUrl) {
      // Update source if changed
      if (audio.src !== targetUrl) {
        audio.src = targetUrl
        audio.load()
      }

      if (isPlaying) {
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('[MusicPlayerAudio] Autoplay / Stream playback notice:', err.message)
          })
        }
      } else {
        audio.pause()
      }
    } else {
      // In Spotify mode or if no stream url, pause HTML5 audio (Spotify handles its own playback)
      audio.pause()
    }
  }, [isPlaying, sourceMode, activePlaylist?.streamUrl, currentTrack?.previewUrl])

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
