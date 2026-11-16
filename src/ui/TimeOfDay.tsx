import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { PRESETS, formatHour } from '../scene/sky'

const LABELS: Record<(typeof PRESETS)[number]['id'], { en: string; tr: string }> = {
  morning: { en: 'Morning', tr: 'Sabah' },
  noon: { en: 'Noon', tr: 'Öğle' },
  golden: { en: 'Golden hour', tr: 'Altın saat' },
  dusk: { en: 'Dusk', tr: 'Alacakaranlık' },
  night: { en: 'Night', tr: 'Gece' },
}
const tr = (lang: 'en' | 'tr', en: string, t: string) => (lang === 'en' ? en : t)
const isNight = (h: number) => h < 6 || h >= 18.7

/** Slider, presets and the optional day/night cycle. Shared by the top bar popover and walk settings. */
export function TimeOfDayPanel() {
  const lang = useApp((s) => s.lang)
  const hour = useApp((s) => s.hour)
  const cycle = useApp((s) => s.dayCycle)
  const set = useApp.getState()
  return (
    <div className="text-sm">
      <label className="block">
        <span className="mb-1 flex justify-between text-xs text-travertine/75">
          <span>{tr(lang, 'Time of day', 'Günün saati')}</span>
          <span className="tabular-nums">{formatHour(hour)}</span>
        </span>
        <input type="range" min={0} max={23.9} step={0.1} value={hour} className="w-full accent-amber-500"
          aria-label={tr(lang, 'Time of day', 'Günün saati')} onChange={(e) => set.setHour(Number(e.target.value))} />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => set.setHour(p.hour)}
            className={'rounded-full border px-2.5 py-1 text-xs ' + (Math.abs(hour - p.hour) < 0.3 ? 'border-gold bg-gold/80 text-ink' : 'border-white/25 hover:border-gold')}>
            {LABELS[p.id][lang]}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-travertine/75">{tr(lang, 'Let time pass', 'Zaman aksın')}<span className="block text-[11px] text-travertine/50">{tr(lang, '1 hour every 2 minutes', 'Her 2 dakikada 1 saat')}</span></span>
        <input type="checkbox" className="h-4 w-4 accent-amber-500" checked={cycle} onChange={(e) => set.setDayCycle(e.target.checked)} />
      </label>
      <p className="mt-2 text-[11px] text-travertine/50">{tr(lang, 'Keys [ and ] change the hour', '[ ve ] tuşları saati değiştirir')}</p>
    </div>
  )
}

/** Top-bar button: shows the current time; opens the panel. */
export function TimeOfDayButton() {
  const lang = useApp((s) => s.lang)
  const hour = useApp((s) => s.hour)
  const mode = useApp((s) => s.mode)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  if (mode === 'plan') return null
  return (
    <div className="relative" ref={ref}>
      <button className="glass btn-ghost gap-1.5 tabular-nums" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        title={tr(lang, 'Time of day', 'Günün saati')}>
        <span aria-hidden="true">{isNight(hour) ? '☾' : '☀'}</span>
        <span className="text-xs">{formatHour(hour)}</span>
      </button>
      {open && <div className="glass absolute right-0 top-12 z-40 w-72 rounded-2xl p-4"><TimeOfDayPanel /></div>}
    </div>
  )
}

/** Global [ / ] hour stepping (explore, tour and walk). */
export function useTimeKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key !== '[' && e.key !== ']') return
      const s = useApp.getState()
      if (s.mode === 'plan' || s.mode === 'intro') return
      s.setHour(Math.round(s.hour) + (e.key === ']' ? 1 : -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
