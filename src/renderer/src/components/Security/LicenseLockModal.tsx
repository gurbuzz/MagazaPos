import React, { useState, useEffect } from 'react'
import { ShieldAlert, KeyRound, Copy, Check, CheckCircle2, Lock, ArrowRight, Delete } from 'lucide-react'

export const LicenseLockModal: React.FC = () => {
  const [isChecking, setIsChecking] = useState(true)
  const [isLicensed, setIsLicensed] = useState(true)
  const [deviceId, setDeviceId] = useState('')
  const [activationKey, setActivationKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Check license status on mount
  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      setIsChecking(true)
      const res = await fetch('/api/license/status')
      const data = await res.json()
      if (data && typeof data.isLicensed === 'boolean') {
        setIsLicensed(data.isLicensed)
        if (data.deviceId) {
          setDeviceId(data.deviceId)
        }
      }
    } catch (err) {
      console.error('License check error:', err)
      // If server failed, keep locked to be safe
      setIsLicensed(false)
    } finally {
      setIsChecking(false)
    }
  }

  const handleCopy = () => {
    if (!deviceId) return
    navigator.clipboard.writeText(deviceId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleKeypadPress = (val: string) => {
    if (activationKey.length >= 6) return
    setActivationKey((prev) => prev + val)
    setErrorMsg('')
  }

  const handleDelete = () => {
    setActivationKey((prev) => prev.slice(0, -1))
    setErrorMsg('')
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (activationKey.length !== 6) {
      setErrorMsg('Lütfen 6 haneli aktivasyon şifresini eksiksiz giriniz.')
      return
    }

    try {
      setSubmitting(true)
      setErrorMsg('')
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activationKey })
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Cihaz başarıyla lisanslandı!')
        setTimeout(() => {
          setIsLicensed(true)
        }, 1500)
      } else {
        setErrorMsg(data.message || 'Hatalı aktivasyon şifresi! Lütfen tekrar deneyin.')
      }
    } catch (err: any) {
      setErrorMsg('Aktivasyon işlemi sırasında sunucu hatası oluştu: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // If still checking or already licensed, do not render modal
  if (isChecking || isLicensed) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/90 backdrop-blur-md select-none p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-600 to-indigo-700 px-6 py-5 text-white flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">MağazaPOS - Cihaz Aktivasyonu</h2>
            <p className="text-xs text-amber-100 mt-0.5">
              Bu yazılım tek bir bilgisayara kilitli lisanslanmaktadır
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {successMsg ? (
            <div className="py-8 flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Aktivasyon Başarılı!</h3>
              <p className="text-sm text-slate-600 max-w-xs">{successMsg}</p>
              <p className="text-xs text-slate-400">Sistem açılıyor, lütfen bekleyiniz...</p>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Bu Cihaz İçin Yetkilendirme Gerekli</p>
                  <p className="text-amber-800 leading-relaxed">
                    Yazılımın bu bilgisayarda çalışabilmesi için aşağıdaki <strong>Cihaz Kodunu</strong> yazılım sağlayıcınıza ileterek 6 haneli aktivasyon şifrenizi alınız.
                  </p>
                </div>
              </div>

              {/* Hardware Device ID Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Bilgisayar Cihaz Kodu
                  </span>
                  <span className="font-mono text-xl font-extrabold text-indigo-900 tracking-wider">
                    {deviceId || 'YÜKLENİYOR...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-indigo-600 active:scale-95 transition-all shadow-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Kopyalandı</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Kodu Kopyala</span>
                    </>
                  )}
                </button>
              </div>

              {/* Activation Code Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                    6 Haneli Aktivasyon Şifresi
                  </label>
                  <div className="flex justify-center gap-2">
                    {[0, 1, 2, 3, 4, 5].map((index) => {
                      const char = activationKey[index] || ''
                      return (
                        <div
                          key={index}
                          className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center font-mono text-2xl font-bold transition-all shadow-sm ${
                            char
                              ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 shadow-indigo-100'
                              : 'border-slate-300 bg-white text-slate-400'
                          }`}
                        >
                          {char || '•'}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center text-xs font-medium text-rose-700 animate-shake">
                    {errorMsg}
                  </div>
                )}

                {/* Touch Numpad */}
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleKeypadPress(digit)}
                      className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-lg transition-colors flex items-center justify-center shadow-sm"
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setActivationKey('')
                      setErrorMsg('')
                    }}
                    className="h-11 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-500 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center"
                  >
                    Temizle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-lg transition-colors flex items-center justify-center shadow-sm"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition-colors flex items-center justify-center shadow-sm"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || activationKey.length !== 6}
                  className="w-full h-12 mt-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm tracking-wide shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all"
                >
                  {submitting ? (
                    <span>Doğrulanıyor...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Sistemi Aktive Et</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-400">
          MağazaPOS Lisans Güvenlik Modülü • Tek Cihaz Koruması
        </div>
      </div>
    </div>
  )
}
