import React, { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, Delete, KeyRound, X } from 'lucide-react'

interface AdminPinModalProps {
  isOpen: boolean
  onClose: () => void
  onVerified: () => void
  title?: string
  subtitle?: string
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  title = 'Yönetici Yetkisi Gerekli',
  subtitle = 'Bu işlem için 6 haneli Yönetici PIN şifresini girin.',
}) => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('')
      setError(false)
      setShake(false)
      setIsVerifying(false)

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
    }
  }, [isOpen])

  const verifyPin = useCallback(async (codeToTest: string) => {
    setIsVerifying(true)
    try {
      const res = await fetch('/api/system/verify-admin-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin: codeToTest }),
      })

      if (res.ok) {
        setPin('')
        setError(false)
        // Store admin PIN in session for subsequent API calls
        sessionStorage.setItem('pos_admin_pin_session', codeToTest)
        localStorage.setItem('pos_admin_pin_session', codeToTest)
        onVerified()
      } else {
        setError(true)
        setShake(true)
        setTimeout(() => setShake(false), 400)
        setTimeout(() => setPin(''), 600)
      }
    } catch {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 400)
      setTimeout(() => setPin(''), 600)
    } finally {
      setIsVerifying(false)
    }
  }, [onVerified])

  const handleInput = useCallback((digit: string) => {
    if (pin.length >= 6) return
    const nextPin = pin + digit
    setPin(nextPin)
    setError(false)

    if (nextPin.length === 6) {
      setTimeout(() => verifyPin(nextPin), 150)
    }
  }, [pin, verifyPin])

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1))
    setError(false)
  }, [])

  const handleClear = useCallback(() => {
    setPin('')
    setError(false)
  }, [])

  // Keyboard listener
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key >= '0' && e.key <= '9') || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 6) {
          handleInput(e.key)
        }
      } else if (e.key === 'Backspace') {
        handleDelete()
      } else if (e.key === 'Enter') {
        if (pin.length === 6) {
          verifyPin(pin)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, pin, handleInput, handleDelete, verifyPin, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans">
      <div
        className={`bg-white border border-slate-200 rounded-lg max-w-sm w-full p-6 shadow-xl space-y-5 text-center transform transition-all ${
          shake ? 'animate-bounce' : ''
        }`}
      >
        {/* Close Button */}
        <div className="flex justify-end -mt-2 -mr-2">
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Icon & Title */}
        <div className="space-y-2 -mt-2">
          <div className="w-12 h-12 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 mx-auto">
            <ShieldAlert className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 mt-1.5">{title}</h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* 6 PIN Dots */}
        <div className="space-y-1.5">
          <div className="flex justify-center items-center space-x-2.5 py-1">
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const isFilled = pin.length > index
              return (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full border transition-all duration-200 ${
                    error
                      ? 'bg-rose-500 border-rose-600 scale-110 shadow-2xs'
                      : isFilled
                      ? 'bg-indigo-700 border-indigo-700 scale-110 shadow-2xs'
                      : 'border-slate-300 bg-slate-100'
                  }`}
                />
              )
            })}
          </div>

          {error ? (
            <p className="text-xs font-bold text-rose-600">
              ⚠️ Hatalı Yönetici PIN! Lütfen tekrar deneyin.
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center space-x-1">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <span>6 haneli Yönetici PIN şifresini girin</span>
            </p>
          )}
        </div>

        {/* On-Screen Touch Keypad */}
        <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto pt-1">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleInput(digit)}
              disabled={isVerifying}
              className="h-12 rounded bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center shadow-2xs active:scale-95 transition disabled:opacity-50"
            >
              {digit}
            </button>
          ))}

          <button
            onClick={handleClear}
            disabled={isVerifying}
            className="h-12 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs flex items-center justify-center transition border border-slate-200 disabled:opacity-50"
          >
            Temizle
          </button>

          <button
            onClick={() => handleInput('0')}
            disabled={isVerifying}
            className="h-12 rounded bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center shadow-2xs active:scale-95 transition disabled:opacity-50"
          >
            0
          </button>

          <button
            onClick={handleDelete}
            disabled={isVerifying}
            className="h-12 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold flex items-center justify-center transition border border-slate-200 disabled:opacity-50"
            title="Sil"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
