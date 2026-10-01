import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Delete,
  CornerDownLeft,
  ChevronDown,
  ArrowBigUp,
  Hash,
  Type,
  Trash2,
  Check,
  Minimize2,
  Keyboard as KeyboardIcon,
} from 'lucide-react'
import { useKeyboardStore, KeyboardMode } from '../../store/useKeyboardStore'

export const VirtualKeyboard: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    mode,
    setMode,
    autoOpen,
    setAutoOpen,
    targetElement,
    setTargetElement,
  } = useKeyboardStore()

  const [isShift, setIsShift] = useState(false)
  const [isCaps, setIsCaps] = useState(false)
  const [liveValue, setLiveValue] = useState('')
  const [caretIndex, setCaretIndex] = useState<number | null>(null)

  // Track the most recent user touch/click target
  const lastUserTouchTimeRef = useRef<number>(0)
  const lastUserTouchedElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      lastUserTouchTimeRef.current = Date.now()
      lastUserTouchedElementRef.current = e.target as HTMLElement | null
    }

    window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true })
    }
  }, [])

  // Listen globally to all inputs focusing & value changes
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      const isInput = target.tagName === 'INPUT'
      const isTextarea = target.tagName === 'TEXTAREA'

      if (isInput || isTextarea) {
        const inputEl = target as HTMLInputElement | HTMLTextAreaElement
        const type = (inputEl.getAttribute('type') || '').toLowerCase()

        // Ignore non-text input types
        if (['file', 'checkbox', 'radio', 'hidden', 'range', 'color'].includes(type)) {
          return
        }

        setTargetElement(inputEl)
        setLiveValue(inputEl.value || '')
        try {
          setCaretIndex(inputEl.selectionStart)
        } catch {
          setCaretIndex((inputEl.value || '').length)
        }

        // SADECE kullanıcı bu input'a doğrudan dokunduysa/tıkladıysa otomatik aç!
        // Arka plan kod odaklanmaları (ör. barcode focus timer, boş yere tıklayınca blur sonrası focus)
        // klavyeyi istenmeyen şekilde AÇMAZ.
        const isDirectTouch =
          lastUserTouchedElementRef.current === inputEl &&
          Date.now() - lastUserTouchTimeRef.current < 600

        if (isDirectTouch) {
          setMode('qwerty')
          if (autoOpen) {
            setIsOpen(true)
          }
        }
      }
    }

    const handleInputOrSelection = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement | null
      if (target && target === targetElement) {
        setLiveValue(target.value || '')
        try {
          setCaretIndex(target.selectionStart)
        } catch {
          setCaretIndex((target.value || '').length)
        }
      }
    }

    const handleSelectionChange = () => {
      if (targetElement && document.activeElement === targetElement) {
        try {
          setCaretIndex(targetElement.selectionStart)
        } catch {
          setCaretIndex((targetElement.value || '').length)
        }
      }
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('input', handleInputOrSelection)
    document.addEventListener('selectionchange', handleSelectionChange)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('input', handleInputOrSelection)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [autoOpen, setTargetElement, setMode, setIsOpen, targetElement])

  // Synchronized input updater: ensures cursor position and React state remain 100% in sync
  const updateTargetValue = (newValue: string, newCaretPosition: number) => {
    const target = targetElement || (document.activeElement as HTMLInputElement | HTMLTextAreaElement)
    if (!target) return

    target.focus({ preventScroll: true })

    const proto =
      target instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    if (setter) {
      setter.call(target, newValue)
    } else {
      target.value = newValue
    }

    try {
      target.setSelectionRange(newCaretPosition, newCaretPosition)
    } catch {
      // Ignore if input type doesn't support setSelectionRange
    }

    target.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    target.dispatchEvent(new Event('change', { bubbles: true, composed: true }))

    setLiveValue(newValue)
    setCaretIndex(newCaretPosition)
  }

  // Insert character without losing input focus
  const handleKeyClick = (char: string) => {
    const target = targetElement || (document.activeElement as HTMLInputElement | HTMLTextAreaElement)
    if (!target || (!target.tagName.includes('INPUT') && !target.tagName.includes('TEXTAREA'))) return

    const charToInsert = isShift || isCaps ? char.toUpperCase() : char.toLowerCase()
    const val = target.value || ''

    let start = val.length
    let end = val.length
    try {
      start = target.selectionStart ?? val.length
      end = target.selectionEnd ?? val.length
    } catch {
      start = val.length
      end = val.length
    }

    const newVal = val.substring(0, start) + charToInsert + val.substring(end)
    const newPos = start + charToInsert.length

    updateTargetValue(newVal, newPos)

    if (isShift) {
      setIsShift(false)
    }
  }

  // Backspace handler
  const handleBackspace = () => {
    const target = targetElement || (document.activeElement as HTMLInputElement | HTMLTextAreaElement)
    if (!target) return

    const val = target.value || ''
    let start = val.length
    let end = val.length
    try {
      start = target.selectionStart ?? val.length
      end = target.selectionEnd ?? val.length
    } catch {
      start = val.length
      end = val.length
    }

    if (start === end && start > 0) {
      const newVal = val.substring(0, start - 1) + val.substring(end)
      updateTargetValue(newVal, start - 1)
    } else if (start !== end) {
      const newVal = val.substring(0, start) + val.substring(end)
      updateTargetValue(newVal, start)
    }
  }

  // Clear all text
  const handleClear = () => {
    const target = targetElement || (document.activeElement as HTMLInputElement | HTMLTextAreaElement)
    if (!target) return
    updateTargetValue('', 0)
  }

  // Enter / Submit handler
  const handleEnter = () => {
    const target = targetElement || (document.activeElement as HTMLInputElement | HTMLTextAreaElement)
    if (!target) return

    target.focus({ preventScroll: true })

    const enterDown = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(enterDown)

    const enterUp = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    })
    target.dispatchEvent(enterUp)

    if (target.form) {
      if (typeof target.form.requestSubmit === 'function') {
        target.form.requestSubmit()
      } else {
        target.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      }
    }
  }

  // Prevent button mousedown from stealing focus from active input
  const preventFocusLoss = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
  }

  // Keyboard Rows: Turkish QWERTY
  const row1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '-']
  const row2 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü']
  const row3 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ']
  const row4 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç']

  return createPortal(
    <>
      {/* Sol Alt Köşe Hızlı Dokunmatik Klavye Butonu */}
      <button
        type="button"
        onMouseDown={preventFocusLoss}
        onClick={() => {
          if (!isOpen) {
            setMode('qwerty')
            setIsOpen(true)
          } else {
            setIsOpen(false)
          }
        }}
        className={`fixed ${
          isOpen ? 'bottom-[395px]' : 'bottom-3'
        } left-3 z-[9995] px-4 py-3 rounded-2xl border transition-all duration-200 shadow-xl backdrop-blur-md flex items-center justify-center gap-2 group cursor-pointer ${
          isOpen
            ? 'bg-[#00268A] text-white border-blue-400 ring-4 ring-blue-500/25 shadow-blue-950/30'
            : 'bg-white/95 hover:bg-white text-[#00268A] border-slate-200 hover:scale-105 active:scale-95 shadow-slate-900/10'
        }`}
        title={isOpen ? 'Ekran Klavyesini Gizle' : 'Ekran Klavyesini Aç (Harf)'}
      >
        <KeyboardIcon className={`w-5 h-5 stroke-[2.2] transition-transform ${isOpen ? 'rotate-180' : 'group-hover:scale-110'}`} />
        <span className="text-xs font-black tracking-wide">
          {isOpen ? 'Klavyeyi Gizle' : 'Klavye'}
        </span>
      </button>

      {/* Klavye Paneli (Yalnızca isOpen durumunda) */}
      {isOpen && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[9990] select-none font-sans animate-in slide-in-from-bottom-6 duration-200"
          onMouseDown={preventFocusLoss}
          onTouchStart={preventFocusLoss}
        >
          <div className="max-w-6xl mx-auto glass-modal border-t-2 border-x-2 border-white/80 rounded-t-3xl shadow-[0_-15px_50px_rgba(0,38,138,0.25)] p-4 pb-5 backdrop-blur-2xl">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-slate-200/80 px-1">
          {/* Left: Mode Switcher */}
          <div className="flex items-center space-x-1.5 bg-slate-200/70 p-1.5 rounded-xl backdrop-blur-xs">
            <button
              type="button"
              onClick={() => setMode('qwerty')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center space-x-1.5 ${
                mode === 'qwerty'
                  ? 'bg-[#00268A] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white/60'
              }`}
            >
              <Type className="w-4 h-4" />
              <span>Harf (Q Klavye)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('numpad')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition flex items-center space-x-1.5 ${
                mode === 'numpad'
                  ? 'bg-[#00268A] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-white/60'
              }`}
            >
              <Hash className="w-4 h-4" />
              <span>Sayısal (Numpad)</span>
            </button>
          </div>

          {/* Center: Live Synchronized Input & Caret Preview */}
          <div className="flex-1 max-w-lg mx-3 px-3 py-1 bg-white/95 border border-blue-200/90 rounded-xl flex items-center justify-between text-xs shadow-inner">
            <div className="flex items-center space-x-2 truncate w-full">
              <span className="shrink-0 text-[11px] font-black uppercase text-[#00268A] bg-blue-100/80 px-2 py-0.5 rounded-md">
                {targetElement?.placeholder || targetElement?.name || 'Giriş Alanı'}
              </span>
              <div className="flex-1 font-bold text-slate-800 tracking-wider font-mono text-sm truncate flex items-center">
                {liveValue ? (
                  <>
                    <span className="truncate">{caretIndex !== null ? liveValue.substring(0, caretIndex) : liveValue}</span>
                    <span className="inline-block w-0.5 h-4 bg-[#00268A] animate-pulse align-middle mx-0.5 shrink-0" />
                    <span className="truncate">{caretIndex !== null ? liveValue.substring(caretIndex) : ''}</span>
                  </>
                ) : (
                  <span className="text-slate-400 font-normal italic flex items-center">
                    Metin girin
                    <span className="inline-block w-0.5 h-4 bg-[#00268A] animate-pulse align-middle ml-1 shrink-0" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions (Clear, Auto-toggle, Close) */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition flex items-center space-x-1.5 shadow-2xs"
              title="Hedef Kutudaki Tüm Yazıyı Temizle"
            >
              <Trash2 className="w-4 h-4" />
              <span>Temizle</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition shadow-2xs"
              title="Klavyeyi Gizle / Kapat"
            >
              <ChevronDown className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Keyboard Layouts */}
        {mode === 'numpad' ? (
          /* NUMPAD / CALCULATOR STYLE FOR POS */
          <div className="max-w-lg mx-auto grid grid-cols-4 gap-2.5 pt-1">
            {/* Column 1-3: Digits */}
            <div className="col-span-3 grid grid-cols-3 gap-2.5">
              {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '00', ','].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeyClick(num)}
                  className="h-16 bg-white/95 hover:bg-[#00268A] hover:text-white active:scale-95 text-slate-900 border border-slate-200/90 rounded-2xl font-black text-2xl shadow-xs transition-all flex items-center justify-center backdrop-blur-xs"
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Column 4: Function Keys */}
            <div className="col-span-1 flex flex-col space-y-2.5">
              <button
                type="button"
                onClick={handleBackspace}
                className="h-16 bg-rose-50 hover:bg-rose-600 hover:text-white active:scale-95 text-rose-700 border border-rose-200 rounded-2xl font-bold flex items-center justify-center shadow-xs transition-all"
                title="Geri Sil"
              >
                <Delete className="w-7 h-7 stroke-[2.2]" />
              </button>

              <button
                type="button"
                onClick={() => setMode('qwerty')}
                className="h-16 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 border border-slate-200 rounded-2xl font-black text-base flex items-center justify-center shadow-xs transition-all"
                title="Harf Klavyesine Geç"
              >
                ABC
              </button>

              <button
                type="button"
                onClick={handleEnter}
                className="flex-1 min-h-[90px] bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white border border-emerald-700 rounded-2xl font-black text-base flex flex-col items-center justify-center shadow-md transition-all space-y-1.5"
                title="Girişi Onayla / Ara (Enter)"
              >
                <CornerDownLeft className="w-7 h-7 stroke-[2.5]" />
                <span className="text-xs font-black uppercase tracking-wider">Onayla</span>
              </button>
            </div>
          </div>
        ) : (
          /* FULL TURKISH QWERTY KEYBOARD */
          <div className="space-y-2 pt-1">
            {/* Row 1: Numbers */}
            <div className="flex space-x-2 justify-center">
              {row1.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => handleKeyClick(char)}
                  className="flex-1 max-w-[84px] h-14 bg-white/95 hover:bg-[#00268A] hover:text-white active:scale-95 text-slate-900 border border-slate-200 rounded-2xl font-black text-lg shadow-xs transition-all flex items-center justify-center backdrop-blur-xs"
                >
                  {char}
                </button>
              ))}
            </div>

            {/* Row 2: QWERTY... */}
            <div className="flex space-x-2 justify-center">
              {row2.map((char) => {
                const displayChar = isShift || isCaps ? char.toUpperCase() : char.toLowerCase()
                return (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyClick(char)}
                    className="flex-1 max-w-[84px] h-14 bg-white/95 hover:bg-[#00268A] hover:text-white active:scale-95 text-slate-900 border border-slate-200 rounded-2xl font-black text-lg shadow-xs transition-all flex items-center justify-center backdrop-blur-xs"
                  >
                    {displayChar}
                  </button>
                )
              })}
            </div>

            {/* Row 3: ASDF... */}
            <div className="flex space-x-2 justify-center px-4">
              {row3.map((char) => {
                const displayChar = isShift || isCaps ? char.toUpperCase() : char.toLowerCase()
                return (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyClick(char)}
                    className="flex-1 max-w-[84px] h-14 bg-white/95 hover:bg-[#00268A] hover:text-white active:scale-95 text-slate-900 border border-slate-200 rounded-2xl font-black text-lg shadow-xs transition-all flex items-center justify-center backdrop-blur-xs"
                  >
                    {displayChar}
                  </button>
                )
              })}
            </div>

            {/* Row 4: Shift, ZXCV..., Backspace */}
            <div className="flex space-x-2 justify-center">
              <button
                type="button"
                onClick={() => setIsCaps(!isCaps)}
                className={`w-24 h-14 rounded-2xl font-black text-xs border transition-all flex items-center justify-center space-x-1.5 active:scale-95 shadow-xs ${
                  isCaps
                    ? 'bg-[#00268A] text-white border-[#00268A]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
                title="Büyük / Küçük Harf Kilidi (Caps Lock)"
              >
                <ArrowBigUp className={`w-5 h-5 ${isCaps ? 'fill-current' : ''}`} />
                <span>CAPS</span>
              </button>

              {row4.map((char) => {
                const displayChar = isShift || isCaps ? char.toUpperCase() : char.toLowerCase()
                return (
                  <button
                    key={char}
                    type="button"
                    onClick={() => handleKeyClick(char)}
                    className="flex-1 max-w-[84px] h-14 bg-white/95 hover:bg-[#00268A] hover:text-white active:scale-95 text-slate-900 border border-slate-200 rounded-2xl font-black text-lg shadow-xs transition-all flex items-center justify-center backdrop-blur-xs"
                  >
                    {displayChar}
                  </button>
                )
              })}

              <button
                type="button"
                onClick={handleBackspace}
                className="w-24 h-14 bg-rose-50 hover:bg-rose-600 hover:text-white active:scale-95 text-rose-700 border border-rose-200 rounded-2xl font-bold flex items-center justify-center shadow-xs transition-all"
                title="Geri Sil (Backspace)"
              >
                <Delete className="w-6 h-6 stroke-[2.2]" />
              </button>
            </div>

            {/* Row 5: Switch, Space, Special, Enter */}
            <div className="flex space-x-2 justify-center pt-1">
              <button
                type="button"
                onClick={() => setMode('numpad')}
                className="w-28 h-14 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 border border-slate-200 rounded-2xl font-black text-sm flex items-center justify-center shadow-xs transition"
              >
                123 #
              </button>

              <button
                type="button"
                onClick={() => handleKeyClick('@')}
                className="w-16 h-14 bg-white/90 hover:bg-slate-100 active:scale-95 text-slate-800 border border-slate-200 rounded-2xl font-black text-base flex items-center justify-center shadow-xs transition"
              >
                @
              </button>

              <button
                type="button"
                onClick={() => handleKeyClick('.')}
                className="w-16 h-14 bg-white/90 hover:bg-slate-100 active:scale-95 text-slate-800 border border-slate-200 rounded-2xl font-black text-xl flex items-center justify-center shadow-xs transition"
              >
                .
              </button>

              <button
                type="button"
                onClick={() => handleKeyClick(' ')}
                className="flex-1 max-w-md h-14 bg-white/95 hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-200 rounded-2xl font-black text-sm shadow-xs transition flex items-center justify-center tracking-widest"
              >
                BOŞLUK (SPACE)
              </button>

              <button
                type="button"
                onClick={handleEnter}
                className="w-44 h-14 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white border border-emerald-700 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 shadow-md transition"
              >
                <CornerDownLeft className="w-5 h-5 stroke-[2.5]" />
                <span>ONAYLA / ARA</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )}
</>,
document.body
)
}
