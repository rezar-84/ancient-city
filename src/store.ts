import { create } from 'zustand'

export type Mode = 'intro' | 'explore' | 'plan' | 'tour' | 'walk' | 'choose'
/** modes where the timeline year decides which monuments stand */
export const timeGated = (m: Mode) => m === 'plan' || m === 'walk'
export type Era = 'ancient' | 'today'
export type Lang = 'en' | 'tr'
export type WalkOverlay = 'map' | 'settings' | null

export const walkInputBlocked = (s: { mode: Mode; walkPaused: boolean; selected: string | null; walkOverlay: WalkOverlay }) =>
  s.mode !== 'walk' || s.walkPaused || s.selected !== null || s.walkOverlay !== null

interface State {
  mode: Mode
  era: Era
  lang: Lang
  selected: string | null
  hovered: string | null
  /** year shown by the timeline slider (negative = BC) */
  year: number
  tourIndex: number
  tourPlaying: boolean
  arOpen: boolean
  showPerf: boolean
  /** whole-city layer: street grid, houses, mapped ruins */
  showGrid: boolean
  /** first-person character (walk mode) */
  walkPaused: boolean
  walkOverlay: WalkOverlay
  setWalkOverlay: (overlay: WalkOverlay) => void
  walkEscape: () => void
  walkSession: boolean
  setWalkPaused: (paused: boolean) => void
  setWalkSession: (available: boolean) => void
  character: string | null
  setCharacter: (id: string | null) => void
  setShowGrid: (v: boolean) => void
  tiles: 'off' | 'loading' | 'ready' | 'error'
  setTiles: (t: State['tiles']) => void
  setMode: (m: Mode) => void
  setEra: (e: Era) => void
  setLang: (l: Lang) => void
  select: (id: string | null) => void
  hover: (id: string | null) => void
  setYear: (y: number) => void
  setTour: (i: number, playing?: boolean) => void
  setTourPlaying: (p: boolean) => void
  setAR: (o: boolean) => void
  togglePerf: () => void
  /** local solar time 0–24 h; 16 h is the default warm afternoon light */
  hour: number
  /** let time pass slowly (1 game hour = 2 real minutes); moving the slider pauses it */
  dayCycle: boolean
  setHour: (h: number, fromCycle?: boolean) => void
  setDayCycle: (on: boolean) => void
}

const initialLang = (() => {
  try { const l = localStorage.getItem('lang'); if (l === 'en' || l === 'tr') return l } catch { /* ignore */ }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en'
})() as Lang

export const useApp = create<State>((set) => ({
  mode: 'intro',
  era: 'ancient',
  lang: initialLang,
  selected: null,
  hovered: null,
  year: 200,
  tourIndex: 0,
  tourPlaying: false,
  arOpen: false,
  showPerf: false,
  showGrid: false,
  walkPaused: false,
  walkOverlay: null,
  setWalkOverlay: (walkOverlay) => set({ walkOverlay }),
  walkEscape: () => set((s) => s.walkOverlay ? { walkOverlay: null } : s.selected ? { selected: null } : { walkPaused: !s.walkPaused }),
  walkSession: false,
  setWalkPaused: (walkPaused) => set((s) => ({ walkPaused, walkOverlay: walkPaused ? null : s.walkOverlay })),
  setWalkSession: (walkSession) => set({ walkSession }),
  character: null,
  setCharacter: (character) => set({ character }),
  setShowGrid: (showGrid) => set({ showGrid }),
  tiles: 'off',
  setTiles: (tiles) => set({ tiles }),
  setMode: (mode) => set({ mode, hovered: null, walkOverlay: null, walkPaused: false }),
  setEra: (era) => set({ era }),
  setLang: (lang) => { try { localStorage.setItem('lang', lang) } catch { /* ignore */ } set({ lang }) },
  select: (selected) => set({ selected }),
  hover: (hovered) => set({ hovered }),
  setYear: (year) => set({ year }),
  setTour: (tourIndex, playing) => set((s) => ({ tourIndex, tourPlaying: playing ?? s.tourPlaying })),
  setTourPlaying: (tourPlaying) => set({ tourPlaying }),
  setAR: (arOpen) => set({ arOpen }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
  hour: 16,
  dayCycle: false,
  setHour: (h, fromCycle = false) => set((s) => ({ hour: ((h % 24) + 24) % 24, dayCycle: fromCycle ? s.dayCycle : false })),
  setDayCycle: (dayCycle) => set({ dayCycle }),
}))

if (import.meta.env.DEV) (window as unknown as { __app: typeof useApp }).__app = useApp
