import { create } from 'zustand'

export type Mode = 'intro' | 'explore' | 'plan' | 'tour'
export type Era = 'ancient' | 'today'
export type Lang = 'en' | 'tr'

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
  setShowGrid: (showGrid) => set({ showGrid }),
  tiles: 'off',
  setTiles: (tiles) => set({ tiles }),
  setMode: (mode) => set({ mode, hovered: null }),
  setEra: (era) => set({ era }),
  setLang: (lang) => { try { localStorage.setItem('lang', lang) } catch { /* ignore */ } set({ lang }) },
  select: (selected) => set({ selected }),
  hover: (hovered) => set({ hovered }),
  setYear: (year) => set({ year }),
  setTour: (tourIndex, playing) => set((s) => ({ tourIndex, tourPlaying: playing ?? s.tourPlaying })),
  setTourPlaying: (tourPlaying) => set({ tourPlaying }),
  setAR: (arOpen) => set({ arOpen }),
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
}))

if (import.meta.env.DEV) (window as unknown as { __app: typeof useApp }).__app = useApp
