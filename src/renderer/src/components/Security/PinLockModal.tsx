import React, { useState, useEffect } from 'react'
import { Lock, Delete, ArrowRight, ShieldCheck, KeyRound } from 'lucide-react'
import { usePosStore } from '../../store/usePosStore'

export const PinLockModal: React.FC = () => {
  const { isLocked, unlockApp, storeName, cashierName } = usePosStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (!isLocked) return

    // Immediately remove focus from any background input when app is locked
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLocked) return

      if ((e.key >= '0' && e.key <= '9') || e.key === 'Backspace' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
      }

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

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
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
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div
        className={`bg-white border border-slate-200 rounded-lg max-w-sm w-full p-6 shadow-xl space-y-5 text-center transform transition-all ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        {/* Top Logo & Lock Icon */}
        <div className="space-y-2">
          <div className="w-12 h-12 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 mx-auto">
            <Lock className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {storeName}
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-1.5">Kasa Güvenlik Girişi</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Aktif Personel: <strong className="text-slate-800 font-semibold">{cashierName}</strong>
            </p>
          </div>
        </div>

        {/* 4 PIN Dots */}
        <div className="space-y-1.5">
          <div className="flex justify-center items-center space-x-3 py-1">
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index
              return (
                <div
                  key={index}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                    error
                      ? 'bg-rose-500 border-rose-600 scale-110 shadow-2xs'
                      : isFilled
                      ? 'bg-blue-700 border-blue-700 scale-110 shadow-2xs'
                      : 'border-slate-300 bg-slate-100'
                  }`}
                />
              )
            })}
          </div>

          {error ? (
            <p className="text-xs font-bold text-rose-600">
              ⚠️ Hatalı PIN Şifresi! Lütfen tekrar deneyin.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center space-x-1">
              <KeyRound className="w-3.5 h-3.5 text-blue-600" />
              <span>Lütfen 4 haneli Kasa PIN şifrenizi girin</span>
            </p>
          )}
        </div>

        {/* On-Screen Touch Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleInput(digit)}
              className="h-12 rounded bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center shadow-2xs active:scale-95 transition"
            >
              {digit}
            </button>
          ))}

          <button
            onClick={handleClear}
            className="h-12 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs flex items-center justify-center transition border border-slate-200"
          >
            Temizle
          </button>

          <button
            onClick={() => handleInput('0')}
            className="h-12 rounded bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center shadow-2xs active:scale-95 transition"
          >
            0
          </button>

          <button
            onClick={handleDelete}
            className="h-12 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold flex items-center justify-center transition border border-slate-200"
            title="Sil"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
