import React, { useEffect, useState } from 'react'
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Volume1,
  Search,
  ListMusic,
  Clock,
  Key,
  Radio,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Sliders,
  Music2,
  Wifi,
} from 'lucide-react'
import { useMusicStore, MusicTrack } from '../../store/useMusicStore'

export const MusicModal: React.FC = () => {
  const {
    isModalOpen,
    setIsModalOpen,
    activeTab,
    setActiveTab,
    isPlaying,
    isFading,
    volume,
    liveVolume,
    trackProgressSec,
    currentTrack,
    activePlaylist,
    playlists,
    searchResults,
    searchQuery,
    isSearching,
    config,
    fetchStatus,
    fetchPlaylists,
    fetchConfig,
    play,
    pause,
    next,
    prev,
    setVolume,
    search,
    selectTrack,
    selectPlaylist,
    saveConfig,
  } = useMusicStore()

  // Local form state for settings
  const [formClientId, setFormClientId] = useState('')
  const [formClientSecret, setFormClientSecret] = useState('')
  const [formStartTime, setFormStartTime] = useState('09:30')
  const [formEndTime, setFormEndTime] = useState('21:30')
  const [formScheduleEnabled, setFormScheduleEnabled] = useState(true)
  const [formFadeDuration, setFormFadeDuration] = useState(2.5)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  useEffect(() => {
    if (isModalOpen) {
      fetchStatus()
      fetchPlaylists()
      fetchConfig()
    }
  }, [isModalOpen])

  useEffect(() => {
    if (config) {
      setFormClientId(config.spotifyClientId || '')
      setFormClientSecret(config.spotifyClientSecret || '')
      setFormStartTime(config.startTime || '09:30')
      setFormEndTime(config.endTime || '21:30')
      setFormScheduleEnabled(config.scheduleEnabled ?? true)
      setFormFadeDuration(config.fadeDurationSec ?? 2.5)
    }
  }, [config])

  // Periodic poll and Escape key listener while modal is open
  useEffect(() => {
    if (!isModalOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    const interval = setInterval(() => {
      fetchStatus()
    }, 1500)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearInterval(interval)
    }
  }, [isModalOpen])

  if (!isModalOpen) return null

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    const success = await saveConfig({
      spotifyClientId: formClientId,
      spotifyClientSecret: formClientSecret,
      startTime: formStartTime,
      endTime: formEndTime,
      scheduleEnabled: formScheduleEnabled,
      fadeDurationSec: Number(formFadeDuration) || 2.5,
    })
    if (success) {
      setSaveSuccessMsg('Ayarlar başarıyla kaydedildi!')
      setTimeout(() => setSaveSuccessMsg(''), 3000)
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsModalOpen(false)
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#00268A] via-[#0034a8] to-[#001c66] text-white p-4 sm:p-5 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
              <Music2 className="w-5 h-5 text-blue-200 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight">Mağaza Müzik & Ses Sistemi</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                  <span>Amfi Yayını</span>
                </span>
              </div>
              <p className="text-xs text-blue-200 font-medium">Lufian & Jack & Jones Mağaza İçi Müzik Yönetimi</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 gap-1 overflow-x-auto shrink-0 select-none">
          <button
            onClick={() => setActiveTab('player')}
            className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap ${
              activeTab === 'player'
                ? 'border-[#00268A] text-[#00268A] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Şimdi Çalıyor</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-[#00268A] text-[#00268A] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Şarkı Ara</span>
          </button>

          <button
            onClick={() => setActiveTab('playlists')}
            className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap ${
              activeTab === 'playlists'
                ? 'border-[#00268A] text-[#00268A] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Çalma Listeleri</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap ${
              activeTab === 'schedule'
                ? 'border-[#00268A] text-[#00268A] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Mağaza Saatleri</span>
          </button>

          <button
            onClick={() => setActiveTab('spotify')}
            className={`flex items-center space-x-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 whitespace-nowrap ${
              activeTab === 'spotify'
                ? 'border-[#00268A] text-[#00268A] bg-white shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Spotify API</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-white space-y-4">
          {/* TAB 1: PLAYER */}
          {activeTab === 'player' && (
            <div className="space-y-4">
              {/* Now Playing Banner */}
              <div className="bg-gradient-to-br from-slate-900 to-[#02133d] text-white rounded-2xl p-5 shadow-lg border border-slate-800 flex flex-col sm:flex-row items-center gap-5">
                {/* Album Art / Vinyl Graphic */}
                <div className="relative shrink-0">
                  <div className={`w-28 h-28 rounded-2xl overflow-hidden bg-slate-800 border-2 border-white/20 shadow-md ${isPlaying ? 'ring-4 ring-emerald-500/30' : ''}`}>
                    <img
                      src={currentTrack?.albumArt || '/customerbackground.jpg'}
                      alt="Album Art"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {isPlaying && (
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Track Details & Controls */}
                <div className="flex-1 text-center sm:text-left space-y-2 w-full">
                  <div className="flex items-center justify-center sm:justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-bold border border-blue-400/20">
                      {activePlaylist?.badge || 'Mağaza Müzik Akışı'}
                    </span>
                    {isFading && (
                      <span className="text-[11px] font-bold text-amber-300 animate-pulse">
                        Yumuşak Geçiş Yapılıyor...
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-base sm:text-lg font-black text-white leading-tight truncate">
                      {currentTrack?.title || 'Mağaza Müzik Sistemi'}
                    </h4>
                    <p className="text-xs text-slate-300 font-semibold truncate">
                      {currentTrack?.artist || 'Lufian & Jack & Jones'}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            ((trackProgressSec || 0) / (currentTrack?.durationSec || 200)) * 100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>{formatTime(trackProgressSec || 0)}</span>
                      <span>{formatTime(currentTrack?.durationSec || 200)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Playback Control Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Skip / Play / Skip Buttons */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={prev}
                    title="Önceki Şarkı (Yumuşak Geçiş)"
                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-[#00268A] shadow-xs active:scale-95 transition"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    onClick={isPlaying ? pause : play}
                    title={isPlaying ? 'Durdur (Yumuşak Fade-Out)' : 'Oynat (Yumuşak Fade-In)'}
                    className={`px-6 py-3 rounded-2xl text-white font-black text-sm flex items-center space-x-2 shadow-md active:scale-95 transition ${
                      isPlaying
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-[#00268A] hover:bg-[#001f70]'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-5 h-5 fill-current" />
                        <span>Durdur</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" />
                        <span>Oynat</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={next}
                    title="Sonraki Şarkı (Yumuşak Geçiş)"
                    className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-[#00268A] shadow-xs active:scale-95 transition"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                {/* Volume Slider with Live Ramp Indicator */}
                <div className="flex items-center space-x-3 w-full sm:w-60 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    onClick={() => setVolume(volume > 0 ? 0 : 70)}
                    className="text-slate-500 hover:text-[#00268A] transition"
                  >
                    {volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-500" />
                    ) : volume < 50 ? (
                      <Volume1 className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#00268A]"
                  />

                  <div className="text-right w-12 shrink-0">
                    <span className="text-xs font-black text-slate-800 font-mono">%{volume}</span>
                    {isFading && liveVolume !== volume && (
                      <span className="block text-[9px] text-amber-600 font-bold leading-none">
                        ({liveVolume}%)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Informational Callout */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 font-medium">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>
                    <strong>Yumuşak Geçiş (Crossfade):</strong> Şarkı başlatıldığında, durdurulduğunda veya değiştirildiğinde ses aniden kesilmez, amfiden yumuşak bir eğriyle kısılarak sönüp başlar.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Şarkı adı, sanatçı veya tarz arayın (Örn: Sezen Aksu, Akustik, The Weeknd)..."
                  value={searchQuery}
                  onChange={(e) => search(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00268A] focus:bg-white transition"
                />
              </div>

              {/* Search Results List */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {isSearching && (
                  <div className="text-center py-6 text-slate-400 text-xs font-bold">
                    Şarkılar aranıyor...
                  </div>
                )}

                {!isSearching && searchResults.length === 0 && searchQuery.trim() !== '' && (
                  <div className="text-center py-6 text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-slate-200">
                    Sonuç bulunamadı.
                  </div>
                )}

                {!isSearching && searchResults.length === 0 && searchQuery.trim() === '' && (
                  <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-600">Doğrudan İstediğiniz Şarkıyı Açın</p>
                    <p className="text-[11px]">Yukarıdaki arama çubuğuna şarkı adı yazıp tek tıkla yumuşak geçişle çalabilirsiniz.</p>
                  </div>
                )}

                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => selectTrack(track)}
                    className="p-3 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl flex items-center justify-between cursor-pointer transition shadow-2xs group"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                        <img
                          src={track.albumArt || '/customerbackground.jpg'}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="truncate">
                        <h5 className="font-bold text-xs text-slate-900 group-hover:text-[#00268A] truncate">
                          {track.title}
                        </h5>
                        <p className="text-[11px] text-slate-500 font-medium truncate">
                          {track.artist} {track.album ? `• ${track.album}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-[10px] font-mono text-slate-400 font-semibold">
                        {formatTime(track.durationSec)}
                      </span>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-[#00268A] group-hover:bg-[#001f70] text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-2xs"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Çal</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PLAYLISTS */}
          {activeTab === 'playlists' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Mağaza atmosferine uygun tematik çalma listelerini seçebilirsiniz:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {playlists.map((pl) => {
                  const isActive = activePlaylist?.id === pl.id
                  return (
                    <div
                      key={pl.id}
                      onClick={() => selectPlaylist(pl.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                        isActive
                          ? 'bg-blue-50/80 border-[#00268A] ring-2 ring-[#00268A]/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xl">{pl.icon}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isActive
                              ? 'bg-[#00268A] text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {pl.badge}
                          </span>
                        </div>
                        <h5 className="font-bold text-xs text-slate-900 leading-tight">
                          {pl.name}
                        </h5>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          {pl.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold">{pl.trackCount} Parça</span>
                        <span className={`font-bold ${isActive ? 'text-[#00268A]' : 'text-slate-600'}`}>
                          {isActive ? '● Çalıyor' : 'Seç & Çal'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SCHEDULE */}
          {activeTab === 'schedule' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-emerald-900 flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-emerald-700" />
                      <span>Akıllı Mağaza Açılış & Kapanış Zamanlayıcısı</span>
                    </h5>
                    <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                      Kasa açık olduğunda müzik sabah saatinde otomatik fade-in ile başlar, akşam kapanışta otomatik fade-out ile durur.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={formScheduleEnabled}
                      onChange={(e) => setFormScheduleEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                      Sabah Açılış Saati
                    </label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full mt-1 font-mono font-bold text-sm text-slate-800 bg-transparent border-0 focus:outline-none"
                    />
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-200">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                      Akşam Kapanış Saati
                    </label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full mt-1 font-mono font-bold text-sm text-slate-800 bg-transparent border-0 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Crossfade Duration Picker */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Yumuşak Geçiş (Crossfade) Süresi
                </label>
                <p className="text-[11px] text-slate-500 font-medium">
                  Şarkı değişirken veya müzik açılıp kapanırken sesin sönme ve yükselme hızı:
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[1.5, 2.5, 4.0].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setFormFadeDuration(dur)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        formFadeDuration === dur
                          ? 'bg-[#00268A] text-white border-[#00268A] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {dur} Saniye {dur === 2.5 ? '(Önerilen)' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold text-center">
                  {saveSuccessMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#00268A] hover:bg-[#001f70] text-white rounded-xl font-bold text-xs shadow-md transition"
              >
                Saat Ayarlarını Kaydet
              </button>
            </form>
          )}

          {/* TAB 5: SPOTIFY API SETTINGS */}
          {activeTab === 'spotify' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                    <Key className="w-4 h-4 text-emerald-600" />
                    <span>Spotify Developer API Anahtarları</span>
                  </h5>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    formClientId ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {formClientId ? '● Anahtarlar Tanımlı' : 'Tanımlanmadı'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 font-medium">
                  Spotify hesabınızı bağlamak için <strong>developer.spotify.com/dashboard</strong> adresinde ücretsiz bir uygulama açıp Client ID ve Secret değerlerini buraya yapıştırabilirsiniz.
                </p>

                <div className="space-y-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Spotify Client ID
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: 4a9f8b2c1d3e..."
                      value={formClientId}
                      onChange={(e) => setFormClientId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00268A]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Spotify Client Secret
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••••••••••"
                      value={formClientSecret}
                      onChange={(e) => setFormClientSecret(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00268A]"
                    />
                  </div>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold text-center">
                  {saveSuccessMsg}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-[#00268A] hover:bg-[#001f70] text-white rounded-xl font-bold text-xs shadow-md transition"
              >
                Spotify API Bilgilerini Kaydet
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
