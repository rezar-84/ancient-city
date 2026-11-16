import { useEffect, useRef, useState } from 'react'
import { timeGated, useApp } from '../store'
import { LANDMARKS } from '../content/landmarks'
import { LANG_LABEL, PLACE_SOUND, langForYear, type VoiceLine } from '../content/soundscapes'
import { getTerrain } from '../scene/terrainData'
import { rig, flightListeners } from '../scene/camera'
import { walk } from '../walk/WalkControls'
import { ensureAudio, onVoice, playAmbientOneShot, playOneShot, playUi, playVoice, setBedLevels, setMusic, stopVoice } from './engine'
import { GRID } from '../content/grid'

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
/** beds that also exist in today's landscape (nature), the rest are the ancient city */
const NATURE = new Set(['spring', 'necropolis-wind'])
const CHRISTIAN = new Set(['martyrium', 'philip-church', 'cathedral'])

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
      const walking = s.mode === 'walk'
      const zoom = walking ? 120 : cam.position.distanceTo(ctl.target)
      const focusPt = walking ? cam.position : ctl.target
      const today = s.era === 'today' && s.mode !== 'plan'
      const levels: Record<string, number> = {}
      const add = (bed: string, v: number) => { if (today && !NATURE.has(bed)) v *= 0.15; levels[bed] = Math.max(levels[bed] ?? 0, v) }
      for (const l of LANDMARKS) {
        const ps = PLACE_SOUND[l.id], p = pos.current.get(l.id)
        if (!ps || !p) continue
        const exists = !timeGated(s.mode) || (s.year >= l.built && (l.until === undefined || s.year <= l.until))
        if (!exists) continue
        let w = 0
        if (s.mode !== 'plan') {
          const focus = Math.hypot(focusPt.x - p[0], focusPt.z - p[1])
          w = smooth(280, 40, focus) * smooth(1500, 260, zoom)
        }
        if (s.selected === l.id) w = Math.max(w, s.mode === 'plan' ? 0.55 : 0.9)
        if (w > 0) add(ps.bed, w * 0.6)
      }
      // the living city around you when the whole-city layer is on
      if (s.showGrid && (s.mode === 'explore' || walking) && s.era === 'ancient') {
        const [ax, az] = t.toLocal(...GRID.axisFrom), [bx, bz] = t.toLocal(...GRID.axisTo)
        const mx = (ax + bx) / 2, mz = (az + bz) / 2
        const inCity = smooth(750, 350, Math.hypot(focusPt.x - mx, focusPt.z - mz))
        add('street', inCity * smooth(1600, 300, zoom) * 0.4)
      }
      setBedLevels(levels)
    }, 120)
    return () => window.clearInterval(id)
  }, [])

  // score: dramatic theme on the title and tour, exploration score otherwise, cues per place/era
  const era = useApp((s) => s.era)
  const year = useApp((s) => s.year)
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = useApp.getState()
      let track: string | null = 'explore'
      if (s.mode === 'intro' || s.mode === 'tour') track = 'theme'
      else if (s.selected === 'ploutonion') track = 'tension'
      else if (s.selected && CHRISTIAN.has(s.selected)) track = 'byzantine'
      else if (timeGated(s.mode) && s.year >= 330) track = 'byzantine'
      else if (s.mode === 'choose') track = 'theme'
      setMusic(track)
    }, 400)
    return () => window.clearInterval(id)
  }, [])

  // nature: now and then a soft gust of wind or distant birds, never constant
  useEffect(() => {
    let t = 0
    const next = () => {
      t = window.setTimeout(() => {
        const s = useApp.getState()
        if (s.mode !== 'intro') playAmbientOneShot(Math.random() < 0.6 ? 'gust' : 'birds', 0.5 + Math.random() * 0.4)
        next()
      }, 18000 + Math.random() * 30000)
    }
    next()
    return () => window.clearTimeout(t)
  }, [])

  // walk mode: footsteps by surface, landing thud
  useEffect(() => {
    let alt = 0
    const step = (surf: 'stone' | 'gravel' | 'grass', k: number) => {
      alt = 1 - alt
      playOneShot(`step-${surf}-${1 + Math.floor(Math.random() * 4)}`, 'places', 0.55 * k, alt ? 0.12 : -0.12, 0.92 + Math.random() * 0.16)
    }
    const land = (v: number) => playOneShot('land', 'places', Math.min(1, 0.4 + v / 10))
    walk.onStep.add(step); walk.onLand.add(land)
    return () => { walk.onStep.delete(step); walk.onLand.delete(land) }
  }, [])

  // event sounds
  const showGrid = useApp((s) => s.showGrid)
  const hovered = useApp((s) => s.hovered)
  const first = useRef(true)
  useEffect(() => { if (!first.current) playUi('drum', 0.9) }, [mode])
  useEffect(() => { if (!first.current) playUi('shimmer', 0.8) }, [era, showGrid])
  useEffect(() => { if (!first.current && selected) playUi('open', 0.8) }, [selected])
  useEffect(() => { if (!first.current && hovered) playUi('hover', 0.7) }, [hovered])
  useEffect(() => { if (!first.current && mode === 'plan') playUi('hover', 0.4) }, [year, mode])
  useEffect(() => { first.current = false }, [])

  // ancient voice when a place is selected (not during the narrated tour)
  useEffect(() => {
    stopVoice()
    if (!selected || mode === 'tour' || mode === 'intro') return
    const l = LANDMARKS.find((x) => x.id === selected)
    const ps = PLACE_SOUND[selected]
    if (!l || !ps?.voice) return
    const s = useApp.getState()
    const year = timeGated(mode) ? s.year : l.built
    const v = ps.voice[langForYear(year)]
    if (!v) return
    const timer = window.setTimeout(() => { void playVoice(v) }, 1400)
    return () => window.clearTimeout(timer)
  }, [selected, mode])

  if (!voice) return null
  return (
    <div className={'pointer-events-auto absolute inset-x-2.5 top-14 z-20 rounded-2xl glass px-3 py-2 text-xs sm:inset-x-auto sm:left-6 sm:top-20 sm:max-w-sm sm:px-4 sm:py-3 sm:text-sm ' + (mode === 'plan' ? 'md:left-72 md:top-32' : 'md:top-auto md:bottom-28')}>
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
