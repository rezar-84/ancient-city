import { SKY } from '../scene/sky'
import { useEffect, useRef, useState } from 'react'
import { timeGated, useApp } from '../store'
import { LANDMARKS } from '../content/landmarks'
import { LANG_LABEL, PLACE_SOUND, langForYear, type VoiceLine } from '../content/soundscapes'
import { getTerrain } from '../scene/terrainData'
import { rig, flightListeners } from '../scene/camera'
import { walk } from '../walk/WalkControls'
import * as CrowdModule from '../walk/Crowd'
import { ensureAudio, musicAvailable, onVoice, playAmbientOneShot, playOneShot, playUi, playVoice, setBedLevels, setMusic, stopVoice, type Layer } from './engine'
import { setBreezeLevel } from '../ui/ambient'
import { GRID } from '../content/grid'
import { TORCH_SPOTS } from '../scene/Torches'

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
/** beds that also exist in today's landscape (nature), the rest are the ancient city */
const NATURE = new Set(['spring', 'necropolis-wind'])
const CHRISTIAN = new Set(['martyrium', 'philip-church', 'cathedral'])

// ---- time of day ----------------------------------------------------------------------------
type Band = 'dawn' | 'day' | 'dusk' | 'night'
/** dawn 5–8, day 8–17, dusk 17–20, night 20–5 */
function bandOf(hour: number): Band {
  const h = ((hour % 24) + 24) % 24
  return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'dusk' : 'night'
}
const BAND_START: Record<Band, number> = { dawn: 5, day: 8, dusk: 17, night: 20 }
const BAND_END: Record<Band, number> = { dawn: 8, day: 17, dusk: 20, night: 29 }
/** soft 0..1 membership of the hour in a band, crossfading over ±0.5 h at the edges */
function bandWeight(band: Band, hour: number) {
  let h = ((hour % 24) + 24) % 24
  if (band === 'night' && h < 12) h += 24
  return smooth(BAND_START[band] - 0.5, BAND_START[band] + 0.5, h) * (1 - smooth(BAND_END[band] - 0.5, BAND_END[band] + 0.5, h))
}
/** city-wide nature bed per band and its level on the ambience layer */
const NATURE_BED: Record<Band, [string, number]> = {
  dawn: ['dawn-birds', 0.55], day: ['cicadas-day', 0.32], dusk: ['swifts-dusk', 0.45], night: ['crickets-night', 0.4],
}
const BANDS: Band[] = ['dawn', 'day', 'dusk', 'night']

// ---- place music ----------------------------------------------------------------------------
/** landmark → score cue while you stand near it (explore and walk) */
function placeTrack(id: string, ctx: { ancient: boolean; band: Band; year: number }): string | null {
  switch (id) {
    case 'theatre': return ctx.ancient && ctx.year < 330 ? 'theatre-festival' : null
    case 'apollo': return 'sacred-hellenistic'
    case 'ploutonion': return 'tension'
    case 'martyrium': case 'philip-church': case 'cathedral': return 'byzantine'
    case 'agora': case 'frontinus-street': return ctx.ancient && ctx.band === 'day' ? 'market-day' : null
    case 'baths': case 'antique-pool': return 'baths-calm'
    case 'necropolis': return 'necropolis-sombre'
    default: return null
  }
}
const PLACE_ENTER = 60, PLACE_LEAVE = 80, DWELL_MS = 20000

/** the marching squad (exported by the crowd once patrols exist; absent before) */
const patrolState = () => (CrowdModule as unknown as { PATROL_STATE?: { x: number; z: number; active: boolean } }).PATROL_STATE
/** action hooks added to the walk state for rolls and long jumps (absent on older builds) */
const walkExt = walk as typeof walk & Partial<{ onRoll: Set<() => void>; onLongJump: Set<() => void> }>
const BED_LAYER: Record<string, Layer> = { 'dawn-birds': 'ambience', 'cicadas-day': 'ambience', 'swifts-dusk': 'ambience', 'crickets-night': 'ambience' }

/** Drives the place soundscape from camera position, selection, mode and era. No DOM output except
 *  the caption shown while an ancient voice plays. */
export function PlaceAudio() {
  const lang = useApp((s) => s.lang)
  const selected = useApp((s) => s.selected)
  const mode = useApp((s) => s.mode)
  const [voice, setVoice] = useState<VoiceLine | null>(null)
  const pos = useRef<Map<string, [number, number]>>(new Map())
  const discovered = useRef<Set<string>>(new Set())

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
      if (!t || !ctl || !cam || s.mode === 'intro') { setBedLevels({}); setBreezeLevel(1); return }
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
      // time of day: one nature bed per band, crossfaded at the band edges; the breeze drops at night
      for (const b of BANDS) {
        const w = bandWeight(b, s.hour)
        if (w > 0.01) { const [bed, lv] = NATURE_BED[b]; levels[bed] = lv * w * (s.mode === 'plan' ? 0.5 : 1) }
      }
      setBreezeLevel(1 - 0.55 * bandWeight('night', s.hour))
      // a marching patrol nearby, panned to its side of the camera
      const pan: Record<string, number> = {}
      const patrol = patrolState()
      if (walking && patrol?.active && s.era === 'ancient') {
        const dx = patrol.x - walk.x, dz = patrol.z - walk.z, d = Math.hypot(dx, dz)
        if (d < 40) {
          levels['march-patrol'] = smooth(40, 6, d) * 0.7
          const m = cam.matrixWorld.elements // camera right vector = first column
          const rl = Math.hypot(m[0], m[2]) || 1
          pan['march-patrol'] = d > 0.5 ? ((dx * m[0] + dz * m[2]) / (d * rl)) * 0.8 : 0
        }
      }
      // lit torches crackle at dusk and night when you walk past one, panned like the patrol
      const lit = Math.max(bandWeight('dusk', s.hour), bandWeight('night', s.hour))
      if (walking && lit > 0.05 && s.era === 'ancient') {
        let best = Infinity, bx = 0, bz = 0
        for (const [tx, , tz] of TORCH_SPOTS.list) {
          const d = Math.hypot(tx - walk.x, tz - walk.z)
          if (d < best) { best = d; bx = tx; bz = tz }
        }
        if (best < 12) {
          levels['torch-crackle'] = smooth(12, 1.5, best) * 0.55 * lit
          const m = cam.matrixWorld.elements, rl = Math.hypot(m[0], m[2]) || 1
          pan['torch-crackle'] = best > 0.5 ? (((bx - walk.x) * m[0] + (bz - walk.z) * m[2]) / (best * rl)) * 0.8 : 0
        }
      }
      // discovery: a soft kithara chord the first time you come within 25 m of each place this walk
      if (!s.walkSession) discovered.current.clear()
      if (walking && s.walkSession) {
        for (const l of LANDMARKS) {
          const p = pos.current.get(l.id)
          if (!p || discovered.current.has(l.id)) continue
          if (!(s.year >= l.built && (l.until === undefined || s.year <= l.until))) continue
          if (Math.hypot(walk.x - p[0], walk.z - p[1]) < 25) { discovered.current.add(l.id); playOneShot('discover-chime', 'ui', 0.55); break }
        }
      }
      setBedLevels(levels, { layer: BED_LAYER, pan })
    }, 120)
    return () => window.clearInterval(id)
  }, [])

  // score: dramatic theme on the title and tour; in explore and walk a cue for the place you are at
  // (hysteresis 60/80 m, at least 20 s per cue), otherwise a cue for the time of day
  const era = useApp((s) => s.era)
  const year = useApp((s) => s.year)
  useEffect(() => {
    let place: string | null = null
    let roaming: string | null = null, roamingSince = -Infinity
    const id = window.setInterval(() => {
      const s = useApp.getState()
      // the previous logic, also the fallback when a newer cue has no file yet
      let base: string = 'explore'
      if (timeGated(s.mode) && s.year >= 330) base = 'byzantine'
      if (s.mode === 'intro' || s.mode === 'tour') { roaming = null; setMusic('theme'); return }
      if (s.selected === 'ploutonion') { roaming = null; setMusic('tension'); return }
      if (s.selected && CHRISTIAN.has(s.selected)) { roaming = null; setMusic('byzantine'); return }
      if (s.mode === 'choose') { roaming = null; setMusic('theme'); return }
      if (s.mode !== 'explore' && s.mode !== 'walk') { roaming = null; setMusic(base); return }

      const t = getTerrain(), ctl = rig.controls, cam = rig.camera
      const walking = s.mode === 'walk'
      const band = bandOf(s.hour)
      const gated = timeGated(s.mode)
      // nearest existing landmark to the focus, with hysteresis
      let next: string | null = null
      if (t && (walking || (ctl && cam && cam.position.distanceTo(ctl.target) < 700))) {
        if (!pos.current.size) for (const l of LANDMARKS) pos.current.set(l.id, t.toLocal(l.lat, l.lon))
        const fx = walking ? walk.x : ctl!.target.x, fz = walking ? walk.z : ctl!.target.z
        let best = Infinity
        for (const l of LANDMARKS) {
          const p = pos.current.get(l.id)
          if (!p || (gated && !(s.year >= l.built && (l.until === undefined || s.year <= l.until)))) continue
          const d = Math.hypot(fx - p[0], fz - p[1])
          if (l.id === place && d < PLACE_LEAVE) { next = l.id; best = -1 }
          else if (d < PLACE_ENTER && d < best) { next = l.id; best = d }
        }
      }
      place = next
      const cueCtx = { ancient: s.era === 'ancient', band, year: gated ? s.year : 150 }
      let want = place ? placeTrack(place, cueCtx) : null
      if (!want) {
        want = band === 'dawn' ? 'dawn' : band === 'dusk' ? 'dusk' : band === 'night' ? 'night'
          : gated && s.year >= 330 ? 'byzantine-secular' : 'explore'
      }
      // missing file ⇒ the previous logic's track (availability is checked once and cached)
      if (musicAvailable(want) !== true) want = base
      const now = performance.now()
      if (want !== roaming && (roaming === null || now - roamingSince >= DWELL_MS)) { roaming = want; roamingSince = now }
      setMusic(roaming)
    }, 400)
    return () => window.clearInterval(id)
  }, [])

  /** the focus is inside the ancient city walls (roughly: near the main street axis) */
  const cityNear = () => {
    const t = getTerrain(), ctl = rig.controls
    if (!t || !ctl) return false
    const s = useApp.getState()
    const fx = s.mode === 'walk' ? walk.x : ctl.target.x, fz = s.mode === 'walk' ? walk.z : ctl.target.z
    const [ax, az] = t.toLocal(...GRID.axisFrom), [bx, bz] = t.toLocal(...GRID.axisTo)
    return Math.hypot(fx - (ax + bx) / 2, fz - (az + bz) / 2) < 600
  }

  // nature: now and then a soft gust of wind or distant birds, never constant
  useEffect(() => {
    let t = 0
    const next = () => {
      t = window.setTimeout(() => {
        const s = useApp.getState()
        if (s.mode !== 'intro') {
          const band = bandOf(s.hour), r = Math.random(), g = 0.5 + Math.random() * 0.4
          // a rooster at dawn only inside the living city; an owl at night
          const inCity = s.era === 'ancient' && (s.mode === 'walk' || s.mode === 'explore') && cityNear()
          if (band === 'dawn' && inCity && r < 0.4) playAmbientOneShot('rooster', g * 0.8)
          else if (band === 'night' && r < 0.35) playAmbientOneShot('owl', g * 0.7)
          else playAmbientOneShot(r < 0.6 || SKY.night > 0.5 ? 'gust' : 'birds', g)
        }
        next()
      }, 18000 + Math.random() * 30000)
    }
    next()
    return () => window.clearTimeout(t)
  }, [])

  // walk mode: footsteps by surface, landing thud, long jump / roll / greet / arrival
  useEffect(() => {
    let alt = 0
    const step = (surf: 'stone' | 'gravel' | 'grass' | 'water', k: number) => {
      alt = 1 - alt
      playOneShot(`step-${surf}-${1 + Math.floor(Math.random() * 4)}`, 'places', 0.55 * k, alt ? 0.12 : -0.12, 0.92 + Math.random() * 0.16)
    }
    const land = (v: number) => playOneShot('land', 'places', Math.min(1, 0.4 + v / 10))
    const jump = () => playOneShot(`step-${walk.surface}-1`, 'places', 0.25, 0, 1.12)
    const splash = (k: number) => playOneShot('splash', 'places', 0.35 + 0.5 * k)
    const stroke = () => playOneShot(`swim-${1 + Math.floor(Math.random() * 2)}`, 'places', 0.45, 0, 0.94 + Math.random() * 0.12)
    const longJump = () => playOneShot('longjump-whoosh', 'places', 0.6, 0, 0.95 + Math.random() * 0.1)
    const roll = () => playOneShot('roll-rustle', 'places', 0.7, 0, 0.95 + Math.random() * 0.1)
    const greet = () => { if (useApp.getState().mode === 'walk') playOneShot('wave-swish', 'places', 0.35) }
    const arrive = () => playOneShot('travel-arrive', 'ui', 0.6)
    walk.onJump.add(jump)
    walk.onStep.add(step); walk.onLand.add(land); walk.onSplash.add(splash); walk.onStroke.add(stroke)
    walkExt.onLongJump?.add(longJump); walkExt.onRoll?.add(roll)
    window.addEventListener('walk:greet', greet); window.addEventListener('walk:arrive', arrive)
    return () => {
      walk.onJump.delete(jump); walk.onStep.delete(step); walk.onLand.delete(land); walk.onSplash.delete(splash); walk.onStroke.delete(stroke)
      walkExt.onLongJump?.delete(longJump); walkExt.onRoll?.delete(roll)
      window.removeEventListener('walk:greet', greet); window.removeEventListener('walk:arrive', arrive)
    }
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
