import { create } from 'zustand'

export type KeyboardMode = 'qwerty' | 'numpad'

interface KeyboardState {
  isOpen: boolean
  mode: KeyboardMode
  autoOpen: boolean
  targetElement: HTMLInputElement | HTMLTextAreaElement | null
  setIsOpen: (isOpen: boolean) => void
  toggleKeyboard: () => void
  setMode: (mode: KeyboardMode) => void
  setAutoOpen: (autoOpen: boolean) => void
  setTargetElement: (el: HTMLInputElement | HTMLTextAreaElement | null) => void
}

export const useKeyboardStore = create<KeyboardState>((set) => ({
  isOpen: false,
  mode: 'qwerty',
  autoOpen: localStorage.getItem('pos_auto_keyboard') !== 'false',
  targetElement: null,
  setIsOpen: (isOpen) => set((state) => ({ isOpen, mode: isOpen ? 'qwerty' : state.mode })),
  toggleKeyboard: () =>
    set((state) => {
      const nextOpen = !state.isOpen
      return {
        isOpen: nextOpen,
        mode: nextOpen ? 'qwerty' : state.mode,
      }
    }),
  setMode: (mode) => set({ mode }),
  setAutoOpen: (autoOpen) => {
    localStorage.setItem('pos_auto_keyboard', String(autoOpen))
    set({ autoOpen })
  },
  setTargetElement: (targetElement) => set({ targetElement }),
}))
