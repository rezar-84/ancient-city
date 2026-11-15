import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store'
import { LANDMARKS } from '../content/landmarks'
import { LANG_LABEL, PLACE_SOUND, langForYear, type VoiceLine } from '../content/soundscapes'
import { getTerrain } from '../scene/terrainData'
import { rig, flightListeners } from '../scene/camera'
import { ensureAudio, onVoice, playUi, playVoice, setBedLevels, stopVoice } from './engine'
import { GRID } from '../content/grid'

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
/** beds that also exist in today's landscape (nature), the rest are the ancient city */
const NATURE = new Set(['spring', 'necropolis'])

/** Drives the place soundscape from camera position, selection, mode and era. No DOM output except
 *  the caption shown while an ancient voice plays. */
export function PlaceAudio() {
  const lang = useApp((s) => s.lang)
  const selected = useApp((s) => s.selected)
  const mode = useApp((s) => s.mode)
  const [voice, setVoice] = useState<VoiceLine | null>(null)
  const pos = useRef<Map<string, [number, number]>>(new Map())

  useEffect(() => onVoice(setVoice), [])

  // interface clicks + flight whooshes
  useEffect(() => {
    const down = (e: PointerEvent) => {
      ensureAudio()
      if ((e.target as HTMLElement | null)?.closest('button, a, input[type=range]')) playUi('ui-click', 0.9)
    }
    const fly = (d: number) => playUi('whoosh', Math.min(1, 0.4 + d / 6))
    window.addEventListener('pointerdown', down, true)
    flightListeners.add(fly)
    return () => { window.removeEventListener('pointerdown', down, true); flightListeners.delete(fly) }
  }, [])

  // proximity mix, ~8 Hz
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = getTerrain(), ctl = rig.controls, cam = rig.camera
      const s = useApp.getState()
      if (!t || !ctl || !cam || s.mode === 'intro') { setBedLevels({}); return }
      if (!pos.current.size) for (const l of LANDMARKS) pos.current.set(l.id, t.toLocal(l.lat, l.lon))
      const zoom = cam.position.distanceTo(ctl.target)
      const today = s.era === 'today' && s.mode !== 'plan'
      const levels: Record<string, number> = {}
      const add = (bed: string, v: number) => { if (today && !NATURE.has(bed)) v *= 0.15; levels[bed] = Math.max(levels[bed] ?? 0, v) }
      for (const l of LANDMARKS) {
        const ps = PLACE_SOUND[l.id], p = pos.current.get(l.id)
        if (!ps || !p) continue
        const exists = s.mode !== 'plan' || (s.year >= l.built && (l.until === undefined || s.year <= l.until))
        if (!exists) continue
        let w = 0
        if (s.mode !== 'plan') {
          const focus = Math.hypot(ctl.target.x - p[0], ctl.target.z - p[1])
          w = smooth(280, 40, focus) * smooth(1500, 260, zoom)
        }
        if (s.selected === l.id) w = Math.max(w, s.mode === 'plan' ? 0.55 : 0.9)
        if (w > 0) add(ps.bed, w * 0.85)
      }
      // the living city around you when the whole-city layer is on
      if (s.showGrid && s.mode === 'explore' && s.era === 'ancient') {
        const [ax, az] = t.toLocal(...GRID.axisFrom), [bx, bz] = t.toLocal(...GRID.axisTo)
        const mx = (ax + bx) / 2, mz = (az + bz) / 2
        const inCity = smooth(750, 350, Math.hypot(ctl.target.x - mx, ctl.target.z - mz))
        add('street', inCity * smooth(1600, 300, zoom) * 0.6)
      }
      setBedLevels(levels)
    }, 120)
    return () => window.clearInterval(id)
  }, [])

  // ancient voice when a place is selected (not during the narrated tour)
  useEffect(() => {
    stopVoice()
    if (!selected || mode === 'tour' || mode === 'intro') return
    const l = LANDMARKS.find((x) => x.id === selected)
    const ps = PLACE_SOUND[selected]
    if (!l || !ps?.voice) return
    const s = useApp.getState()
    const year = mode === 'plan' ? s.year : l.built
    const v = ps.voice[langForYear(year)]
    if (!v) return
    const timer = window.setTimeout(() => { void playVoice(v) }, 1400)
    return () => window.clearTimeout(timer)
  }, [selected, mode])

  if (!voice) return null
  return (
    <div className={'pointer-events-auto absolute left-4 top-20 z-20 max-w-sm rounded-2xl glass px-4 py-3 text-sm sm:left-6 ' + (mode === 'plan' ? 'md:left-72 md:top-32' : 'md:top-auto md:bottom-28')}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gold">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold" />
        {LANG_LABEL[voice.lang][lang]}
        <button className="ml-auto text-travertine/60 hover:text-white" onClick={stopVoice} aria-label="stop">✕</button>
      </div>
      <p className="mt-1 font-serif italic text-travertine/90">“{voice.gloss[lang]}”</p>
      <p className="mt-1 text-[11px] text-travertine/50">{voice.source}</p>
    </div>
  )
}
