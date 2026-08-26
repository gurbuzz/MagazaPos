import React, { useState, useEffect } from 'react'
import { Lock, Delete, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'

export const PinLockModal: React.FC = () => {
  const { isLocked, unlockApp, storeName, cashierName } = usePosStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLocked) return
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          handleInput(e.key)
        }
      } else if (e.key === 'Backspace') {
        handleDelete()
      } else if (e.key === 'Enter') {
        if (pin.length === 4) {
          verifyPin(pin)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLocked, pin])

  if (!isLocked) return null

  const handleInput = (digit: string) => {
    if (pin.length >= 4) return
    const nextPin = pin + digit
    setPin(nextPin)
    setError(false)

    if (nextPin.length === 4) {
      setTimeout(() => verifyPin(nextPin), 150)
    }
  }

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1))
    setError(false)
  }

  const handleClear = () => {
    setPin('')
    setError(false)
  }

  const verifyPin = (codeToTest: string) => {
    const success = unlockApp(codeToTest)
    if (success) {
      setPin('')
      setError(false)
    } else {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setTimeout(() => setPin(''), 600)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 select-none">
      <div
        className={`bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 text-center transform transition-all ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        {/* Top Logo & Lock Icon */}
        <div className="space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-indigo-600 mx-auto shadow-sm">
            <Lock className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              {storeName}
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-2">Kasa Güvenlik Girişi</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Aktif Personel: <strong className="text-slate-800 font-bold">{cashierName}</strong>
            </p>
          </div>
        </div>

        {/* 4 PIN Dots */}
        <div className="space-y-2">
          <div className="flex justify-center items-center space-x-4 py-2">
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index
              return (
                <div
                  key={index}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    error
                      ? 'bg-rose-500 border-rose-600 scale-110 shadow-md shadow-rose-500/30'
                      : isFilled
                      ? 'bg-indigo-600 border-indigo-600 scale-125 shadow-md shadow-indigo-600/30'
                      : 'border-slate-300 bg-slate-100'
                  }`}
                />
              )
            })}
          </div>

          {error ? (
            <p className="text-xs font-extrabold text-rose-600 animate-pulse">
              ⚠️ Hatalı PIN Şifresi! Lütfen tekrar deneyin.
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 font-medium flex items-center justify-center space-x-1">
              <KeyRound className="w-3 h-3 text-indigo-500" />
              <span>Lütfen 4 haneli Kasa PIN şifrenizi girin</span>
            </p>
          )}
        </div>

        {/* On-Screen Touch Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleInput(digit)}
              className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-800 font-black text-xl flex items-center justify-center shadow-sm active:scale-95 transition"
            >
              {digit}
            </button>
          ))}

          <button
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center transition"
          >
            Temizle
          </button>

          <button
            onClick={() => handleInput('0')}
            className="h-14 rounded-2xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-800 font-black text-xl flex items-center justify-center shadow-sm active:scale-95 transition"
          >
            0
          </button>

          <button
            onClick={handleDelete}
            className="h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center transition"
            title="Sil"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Default PIN Notice */}
        <div className="pt-2 border-t border-slate-100">
          <span className="text-[10px] text-slate-400 font-bold">
            💡 Varsayılan Giriş PIN Şifresi: <code className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">1234</code>
          </span>
        </div>
      </div>
    </div>
  )
}
