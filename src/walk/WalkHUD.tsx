import { useEffect, useRef, useState } from 'react'
import { useApp, walkInputBlocked } from '../store'
import { CHARACTERS, ERA_LABEL } from '../content/characters'
import { LANDMARKS } from '../content/landmarks'
import { lname } from '../content/types'
import { PLAN_VIEW } from '../content/plan'
import { getTerrain } from '../scene/terrainData'
import { PlanSVG } from '../guide/PlanSVG'
import { walk } from './WalkControls'
import { formatYear } from '../i18n'
import { TimeOfDayPanel } from '../ui/TimeOfDay'
import { speakCharacterLine, stopCharacterVoice, voiceSupported } from '../audio/characterVoice'

const tr = (lang: 'en' | 'tr', en: string, t: string) => (lang === 'en' ? en : t)
const MAP_W = 170
const { s, n, w, e } = PLAN_VIEW
const kx = Math.cos(((s + n) / 2) * Math.PI / 180)
const MAP_H = MAP_W * ((n - s) / ((e - w) * kx))

function exitWalk() {
  stopCharacterVoice()
  if (document.pointerLockElement) void document.exitPointerLock()
  const st = useApp.getState()
  st.select(null)
  st.setMode('explore')
}

function interact(id: string) {
  if (document.pointerLockElement) void document.exitPointerLock()
  useApp.getState().select(id)
}

/** Heads-up display for walk mode. */
export function WalkHUD() {
  const mode = useApp((st) => st.mode)
  const lang = useApp((st) => st.lang)
  const character = useApp((st) => st.character)
  const year = useApp((st) => st.year)
  const selected = useApp((st) => st.selected)
  const paused = useApp((st) => st.walkPaused)
  const pauseDialog = useRef<HTMLDialogElement>(null)
  const [near, setNear] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [moved, setMoved] = useState(false)
  const [storyOpen, setStoryOpen] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const dot = useRef<HTMLDivElement>(null)
  const ribbon = useRef<HTMLDivElement>(null)
  const tint = useRef<HTMLDivElement>(null)
  const active = mode === 'walk'

  useEffect(() => {
    const dialog = pauseDialog.current
    if (active && paused) { if (dialog && !dialog.open) dialog.showModal() }
    else dialog?.close()
  }, [active, paused])

  useEffect(() => {
    if (!active) return
    let raf = 0
    let lastNearAt = -1e9
    const tick = (now: number) => {
      const t = getTerrain()
      if (t) {
        const [la, lo] = t.toLatLon(walk.x, walk.z)
        const heading = ((-walk.yaw * 180) / Math.PI % 360 + 360) % 360
        if (dot.current) {
          dot.current.style.left = `${((lo - w) / (e - w)) * MAP_W}px`
          dot.current.style.top = `${((n - la) / (n - s)) * MAP_H}px`
          dot.current.style.transform = `translate(-50%,-50%) rotate(${heading}deg)`
        }
        if (ribbon.current) ribbon.current.style.transform = `translateX(${-heading * 2}px)`
        if (tint.current) tint.current.style.opacity = walk.underwater ? '1' : '0'
        if (now - lastNearAt >= 100) {
          lastNearAt = now
          // nearest standing monument within reach
          let best: string | null = null, bd = 70
          for (const l of LANDMARKS) {
            if (year < l.built || (l.until !== undefined && year > l.until)) continue
            const [x, z] = t.toLocal(l.lat, l.lon)
            const d = Math.hypot(x - walk.x, z - walk.z)
            if (d < bd) { bd = d; best = l.id }
          }
          setNear((p) => (p === best ? p : best))
        }
        setLocked((p) => (p === walk.locked ? p : walk.locked))
        if (walk.moving) setMoved((p) => (p ? p : true))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const key = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase()
      if (k !== 'escape' && (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement)) return
      if (k === 'e' && !walkInputBlocked(useApp.getState()) && nearRef.current) interact(nearRef.current)
      if (k === 'f' && !walkInputBlocked(useApp.getState()) && nearRef.current) {
        window.dispatchEvent(new CustomEvent('walk:reflect', { detail: nearRef.current }))
      }
      if (k === 'j' && !walkInputBlocked(useApp.getState())) {
        setStoryOpen((v) => !v)
        if (document.pointerLockElement) void document.exitPointerLock()
      }
      if (k === 'escape' && !useApp.getState().walkPaused) {
        if (storyOpenRef.current) { setStoryOpen(false); return }
        const state = useApp.getState()
        state.walkEscape()
        if (useApp.getState().walkPaused && document.pointerLockElement) void document.exitPointerLock()
      }
    }
    window.addEventListener('keydown', key)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key) }
  }, [active, year])
  const nearRef = useRef<string | null>(null)
  nearRef.current = near
  const storyOpenRef = useRef(false)
  storyOpenRef.current = storyOpen

  if (!active) return null
  const c = CHARACTERS.find((x) => x.id === character) ?? CHARACTERS[2]
  const nearL = near ? LANDMARKS.find((l) => l.id === near) : null
  const hasReflection = !!(nearL && c.reflections[nearL.id])
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const toggleBackstoryVoice = () => {
    if (speaking) { stopCharacterVoice(); setSpeaking(false); return }
    const ok = speakCharacterLine(`${c.backstory[lang]} ${c.goal[lang]}`, lang, { gender: c.gender, ...c.voice }, () => setSpeaking(false))
    if (ok) setSpeaking(true)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* below the waterline: turquoise travertine water */}
      <div ref={tint} aria-hidden="true" className="absolute inset-0 opacity-0 transition-opacity duration-200" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(120,210,205,0.35), rgba(20,90,100,0.6))', backdropFilter: 'blur(2px)' }} />
      {/* character pill + backstory journal drawer (J) */}
      <div data-walkui className="pointer-events-auto absolute left-2.5 top-[max(0.625rem,env(safe-area-inset-top))] sm:left-4 sm:top-4">
        <button type="button" onClick={() => { setStoryOpen((v) => !v); if (document.pointerLockElement) void document.exitPointerLock() }}
          aria-expanded={storyOpen} title={tr(lang, 'Character backstory & voice (J)', 'Karakter hikâyesi ve ses (J)')}
          className="glass flex items-center gap-2.5 rounded-full py-1 pl-1 pr-4 text-left transition hover:ring-1 hover:ring-gold/60">
          <img src={c.portrait} alt="" className="h-10 w-10 rounded-full object-cover object-top ring-2 ring-gold/70" />
          <div className="leading-tight">
            <p className="font-display text-sm">{c.name}</p>
            <p className="text-[10px] text-travertine/65">{c.role[lang]} · {ERA_LABEL[c.era][lang]} · {formatYear(year, lang)}</p>
          </div>
        </button>
        {storyOpen && (
          <div className="glass mt-2 w-[min(90vw,360px)] rounded-2xl border border-gold/30 p-4 text-xs text-travertine shadow-2xl">
            <p className="font-serif italic text-gold/90">“{c.greeting.text}”</p>
            <p className="mt-2 leading-relaxed text-travertine/90">{c.backstory[lang]}</p>
            <p className="mt-2.5 rounded-xl bg-black/30 px-3 py-2 text-[11px] text-travertine/85">
              <strong className="text-gold">{tr(lang, 'Today’s goal:', 'Bugünün hedefi:')}</strong> {c.goal[lang]}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              {voiceSupported() && (
                <button type="button" className="btn-gold px-3 py-1.5 text-xs" onClick={toggleBackstoryVoice}>
                  {speaking ? tr(lang, '■ Stop voice', '■ Sesi durdur') : tr(lang, '🔊 Hear backstory', '🔊 Hikâyeyi dinle')}
                </button>
              )}
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setStoryOpen(false)}>{tr(lang, 'Close · J', 'Kapat · J')}</button>
            </div>
          </div>
        )}
      </div>

      {/* compass ribbon */}
      <div className="glass absolute left-1/2 top-[max(0.625rem,env(safe-area-inset-top))] hidden h-8 w-64 -translate-x-1/2 overflow-hidden rounded-full sm:top-4 md:block">
        <div ref={ribbon} className="absolute left-1/2 top-0 h-full">
          {Array.from({ length: 49 }, (_, i) => {
            const deg = -180 + i * 15
            const major = ((deg % 45) + 45) % 45 === 0
            return (
              <span key={i} className={'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs ' + (major ? 'font-display text-gold' : 'text-travertine/40')} style={{ left: deg * 2 }}>
                {major ? dirs[(((deg / 45) % 8) + 8) % 8] : '·'}
              </span>
            )
          })}
        </div>
        <div className="absolute left-1/2 top-0 h-full w-px bg-gold/80" />
      </div>

      {/* exit */}
      <div data-walkui className="pointer-events-auto absolute right-2.5 top-[max(0.625rem,env(safe-area-inset-top))] flex items-center gap-2 sm:right-4 sm:top-4">
        <button className="glass btn-ghost" onClick={() => window.dispatchEvent(new Event('walk:map'))} title="M">🗺 <span className="hidden sm:inline">{tr(lang, 'Map', 'Harita')}</span></button>
        <SettingsButton lang={lang} />
        <button className="glass btn-ghost" onClick={() => { useApp.getState().setWalkPaused(true); if (document.pointerLockElement) void document.exitPointerLock() }}>Ⅱ <span className="hidden sm:inline">{tr(lang, 'Pause', 'Duraklat')}</span></button>
      </div>

      <dialog ref={pauseDialog} data-walkui aria-labelledby="walk-pause-title"
        onCancel={event => { event.preventDefault(); useApp.getState().setWalkPaused(false) }}
        className="pointer-events-auto m-auto w-[min(90vw,420px)] rounded-2xl border border-gold/30 bg-ink p-6 text-travertine backdrop:bg-black/65">
        <h2 id="walk-pause-title" className="font-display text-2xl">{tr(lang, 'Walk paused', 'Yürüyüş duraklatıldı')}</h2>
        <p className="mt-2 text-sm text-travertine/80">{tr(lang, 'Your position is kept for this visit. Resume, then click the scene to look around.', 'Konumunuz bu ziyaret için saklanır. Devam edin, ardından etrafa bakmak için sahneye tıklayın.')}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button autoFocus className="btn-gold min-h-11" onClick={() => useApp.getState().setWalkPaused(false)}>{tr(lang, 'Resume walk', 'Yürüyüşe devam et')}</button>
          <button className="btn-ghost min-h-11" onClick={() => { exitWalk(); useApp.getState().setMode('choose') }}>{tr(lang, 'Choose another character', 'Başka karakter seç')}</button>
          <button className="btn-ghost min-h-11" onClick={exitWalk}>{tr(lang, 'Return to city map', 'Kent haritasına dön')}</button>
        </div>
      </dialog>

      {/* crosshair */}
      {locked && <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow" />}

      {/* minimap */}
      <div data-walkui onClick={() => window.dispatchEvent(new Event('walk:map'))} className={'glass pointer-events-auto absolute bottom-4 right-4 hidden cursor-pointer overflow-hidden rounded-2xl p-1 ' + (selected ? '' : 'sm:block')} title="M">
        <div className="relative overflow-hidden rounded-xl" style={{ width: MAP_W, height: MAP_H }}>
          <PlanSVG lang={lang} width={MAP_W * 2} withLabels={false} grid />
          <div ref={dot} className="absolute h-0 w-0" style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '14px solid #c9553a', filter: 'drop-shadow(0 0 2px #fff)' }} />
        </div>
      </div>

      {/* interaction prompt */}
      {nearL && !selected && (
        <div data-walkui className="pointer-events-auto absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-24">
          <button className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm" onClick={() => interact(nearL.id)}>
            <kbd className="hidden rounded bg-travertine/90 px-1.5 font-sans text-xs text-ink sm:inline">E</kbd>
            <span className="sm:hidden">ⓘ</span>
            {tr(lang, 'About', 'Hakkında')} <b className="font-display">{lname(nearL, lang)}</b>
          </button>
          {hasReflection && (
            <button className="glass flex items-center gap-1.5 rounded-full border border-gold/40 px-3.5 py-2 text-sm text-gold"
              onClick={() => window.dispatchEvent(new CustomEvent('walk:reflect', { detail: nearL.id }))}>
              <kbd className="hidden rounded bg-gold/90 px-1.5 font-sans text-xs text-ink sm:inline">F</kbd>
              🔊 {tr(lang, 'Reflect', 'Düşünce')}
            </button>
          )}
        </div>
      )}

      {/* first-time help */}
      {!moved && !selected && (
        <div className="glass absolute left-1/2 top-1/2 max-w-sm -translate-x-1/2 translate-y-10 rounded-2xl px-5 py-3 text-center text-sm">
          <p className="hidden sm:block">{tr(lang, 'Click to look around · W A S D walk · Shift run · double-tap W sprint · Space jump · G greet · E learn about a place · M map & travel · V third person · Esc pause / resume', 'Bakmak için tıklayın · W A S D yürü · Shift koş · W’ye iki kez bas: depar · Boşluk zıpla · G selam ver · E bilgi · M harita ve yolculuk · V üçüncü şahıs · Esc duraklat / devam et')}</p>
          <p className="sm:hidden">{tr(lang, 'Use the joystick to walk and drag to look around', 'Yürümek için joystick’i kullanın, bakmak için sürükleyin')}</p>
        </div>
      )}

      {!paused && !selected && <button data-walkui className="glass btn-ghost pointer-events-auto absolute bottom-20 left-4 min-h-11" onClick={() => window.dispatchEvent(new Event('walk:greet'))}>
        {tr(lang, 'Greet · G', 'Selam ver · G')}
      </button>}
      {!paused && <Joystick />}
      {/* phone: jump + view */}
      <div data-walkui className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 flex flex-col items-center gap-3 [@media(pointer:fine)]:hidden">
        <button className="glass grid h-11 w-11 place-items-center rounded-full text-sm" onClick={() => { walk.view = walk.view === 'first' ? 'third' : 'first' }} aria-label="view">👁</button>
        <button className="glass grid h-16 w-16 place-items-center rounded-full font-display text-sm" onPointerDown={() => { walk.jumpPressed = true }} aria-label="jump">⤒</button>
      </div>
    </div>
  )
}

/** Touch joystick (phones/tablets) — direct DOM transform avoids React rerenders on pointermove. */
function Joystick() {
  const base = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const id = useRef<number | null>(null)
  const R = 48
  const setTransform = (x: number, y: number) => {
    if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
  }
  const update = (cx: number, cy: number) => {
    const r = base.current!.getBoundingClientRect()
    let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > R) { dx *= R / d; dy *= R / d }
    setTransform(dx, dy)
    walk.joy.x = dx / R; walk.joy.y = dy / R
  }
  const end = () => { id.current = null; setTransform(0, 0); walk.joy.x = walk.joy.y = 0 }
  return (
    <div
      ref={base} data-joystick
      className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 h-32 w-32 touch-none rounded-full border border-white/25 bg-black/25 backdrop-blur-sm [@media(pointer:fine)]:hidden"
      onPointerDown={(ev) => { id.current = ev.pointerId; (ev.target as HTMLElement).setPointerCapture(ev.pointerId); update(ev.clientX, ev.clientY) }}
      onPointerMove={(ev) => { if (ev.pointerId === id.current) update(ev.clientX, ev.clientY) }}
      onPointerUp={end} onPointerCancel={end}
    >
      <div ref={knobRef} className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-travertine/80 shadow-lg" style={{ transform: 'translate(-50%, -50%)' }} />
    </div>
  )
}

function SettingsButton({ lang }: { lang: 'en' | 'tr' }) {
  const open = useApp(s => s.walkOverlay === 'settings')
  const [, force] = useState(0)
  return (
    <div className="relative">
      <button className="glass btn-ghost" onClick={() => { useApp.getState().setWalkOverlay(open ? null : 'settings'); if (document.pointerLockElement) void document.exitPointerLock() }} aria-expanded={open} aria-label="settings">⚙</button>
      {open && (
        <div className="glass absolute right-0 top-12 w-72 max-h-[75vh] overflow-y-auto rounded-2xl p-4 text-sm">
          <label className="block">
            <span className="mb-1 flex justify-between text-xs text-travertine/75"><span>{tr(lang, 'Walking speed', 'Yürüme hızı')}</span><span className="tabular-nums">{walk.speedMul.toFixed(2)}×</span></span>
            <input type="range" min={0.75} max={1.75} step={0.05} value={walk.speedMul} className="w-full accent-amber-500"
              onChange={(ev) => { walk.speedMul = Number(ev.target.value); force((n) => n + 1) }} />
          </label>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-travertine/75">{tr(lang, 'Camera', 'Kamera')}</span>
            <div className="flex rounded-full bg-white/10 p-0.5">
              {(['first', 'third'] as const).map((v) => (
                <button key={v} className={'rounded-full px-3 py-1 ' + (walk.view === v ? 'bg-travertine text-ink' : '')} onClick={() => { walk.view = v; force((n) => n + 1) }}>
                  {v === 'first' ? tr(lang, '1st person', '1. şahıs') : tr(lang, '3rd person', '3. şahıs')}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-3"><TimeOfDayPanel /></div>
        </div>
      )}
    </div>
  )
}
