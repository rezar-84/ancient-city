import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
import { playCharacterClip, stopCharacterVoice, voiceSupported } from '../audio/characterVoice'
import { LangSwitch } from '../ui/TopBar'

const tr = (lang: 'en' | 'tr', en: string, t: string) => (lang === 'en' ? en : t)
const MAP_W = 170
/** Top-right HUD buttons: a fixed 44px square on phones so the row has a stable width (3 × 44 + 2 × 8 = 148px). */
const TOP_BTN = 'glass btn-ghost h-11 w-11 shrink-0 justify-center px-0 sm:w-auto sm:px-4'
const ROUND_BTN = 'glass pointer-events-auto grid touch-none place-items-center rounded-full text-sm'
const greet = () => window.dispatchEvent(new Event('walk:greet'))
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
  const overlay = useApp((st) => st.walkOverlay)
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
    if (!active || paused || selected || overlay) {
      setStoryOpen(false)
      if (!active || paused) { stopCharacterVoice(); setSpeaking(false) }
    }
  }, [active, paused, selected, overlay])

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
    const ok = playCharacterClip(c.id, 'intro', lang, `${c.greeting.gloss[lang]} ${c.backstory[lang]}`, { gender: c.gender, ...c.voice }, () => setSpeaking(false))
    if (ok) setSpeaking(true)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* below the waterline: turquoise travertine water */}
      <div ref={tint} aria-hidden="true" className="absolute inset-0 opacity-0 transition-opacity duration-200" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(120,210,205,0.35), rgba(20,90,100,0.6))', backdropFilter: 'blur(2px)' }} />
      {/* character pill + backstory journal drawer (J) */}
      <div data-walkui className="pointer-events-auto absolute left-[max(0.625rem,env(safe-area-inset-left))] top-[max(0.625rem,env(safe-area-inset-top))] max-w-[calc(100vw-11rem)] sm:left-4 sm:top-4 sm:max-w-[calc(100vw-20rem)] md:max-w-[calc(50vw-9rem)]">
        <button type="button" onClick={() => { setStoryOpen((v) => !v); if (document.pointerLockElement) void document.exitPointerLock() }}
          aria-expanded={storyOpen} title={tr(lang, 'Character backstory & voice (J)', 'Karakter hikâyesi ve ses (J)')}
          className="glass flex min-h-11 max-w-full items-center gap-2.5 rounded-full py-1 pl-1 pr-4 text-left transition hover:ring-1 hover:ring-gold/60">
          <img src={c.portrait} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover object-top ring-2 ring-gold/70" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-sm">{c.name}</p>
            <p className="truncate text-[10px] text-travertine/65">{c.role[lang]} · {ERA_LABEL[c.era][lang]}<span className="hidden sm:inline"> · {formatYear(year, lang)}</span></p>
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
      <div data-walkui className="pointer-events-auto absolute right-[max(0.625rem,env(safe-area-inset-right))] top-[max(0.625rem,env(safe-area-inset-top))] flex w-[9.25rem] shrink-0 items-center justify-end gap-2 sm:right-4 sm:top-4 sm:w-auto">
        <button data-walkui className={TOP_BTN} aria-label={tr(lang, 'Map and travel', 'Harita ve yolculuk')} onClick={() => window.dispatchEvent(new Event('walk:map'))} title="M">🗺 <span className="hidden sm:inline">{tr(lang, 'Map', 'Harita')}</span></button>
        <SettingsButton lang={lang} />
        <button data-walkui className={TOP_BTN} aria-label={tr(lang, 'Pause', 'Duraklat')} onClick={() => { useApp.getState().setWalkPaused(true); if (document.pointerLockElement) void document.exitPointerLock() }}>Ⅱ <span className="hidden sm:inline">{tr(lang, 'Pause', 'Duraklat')}</span></button>
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
      <div data-walkui onClick={() => window.dispatchEvent(new Event('walk:map'))} className={'glass pointer-events-auto absolute bottom-4 right-4 hidden cursor-pointer overflow-hidden rounded-2xl p-1 ' + (selected ? '' : 'sm:[@media(pointer:fine)]:block')} title="M">
        <div className="relative overflow-hidden rounded-xl" style={{ width: MAP_W, height: MAP_H }}>
          <PlanSVG lang={lang} width={MAP_W * 2} withLabels={false} grid />
          <div ref={dot} className="absolute h-0 w-0" style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '14px solid #c9553a', filter: 'drop-shadow(0 0 2px #fff)' }} />
        </div>
      </div>

      {/* interaction prompt */}
      {nearL && !selected && (
        <div data-walkui className="pointer-events-none absolute inset-x-0 bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+9.5rem)] mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 [@media(pointer:fine)]:bottom-24">
          <button data-walkui className="glass pointer-events-auto flex min-h-11 max-w-full items-center gap-2 rounded-full px-4 py-2 text-left text-sm" onClick={() => interact(nearL.id)}>
            <kbd className="hidden rounded bg-travertine/90 px-1.5 font-sans text-xs text-ink sm:inline">E</kbd>
            <span className="sm:hidden">ⓘ</span>
            {tr(lang, 'About', 'Hakkında')} <b className="font-display">{lname(nearL, lang)}</b>
          </button>
          {hasReflection && (
            <button data-walkui className="glass pointer-events-auto flex min-h-11 items-center gap-1.5 rounded-full border border-gold/40 px-3.5 py-2 text-sm text-gold"
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
          <p className="hidden sm:block">{tr(lang, 'Click to look around · W A S D walk · Shift run · double-tap W sprint · Space jump · G greet · F reflect · J story · E learn about a place · M map & travel · V third person · Esc pause / resume', 'Bakmak için tıklayın · W A S D yürü · Shift koş · W’ye iki kez bas: depar · Boşluk zıpla · G selam ver · F düşünce · J hikâye · E bilgi · M harita ve yolculuk · V üçüncü şahıs · Esc duraklat / devam et')}</p>
          <p className="sm:hidden">{tr(lang, 'Use the joystick to walk and drag to look around', 'Yürümek için joystick’i kullanın, bakmak için sürükleyin')}</p>
        </div>
      )}

      {/* desktop: greet button in the free bottom-left corner (joystick and touch cluster are touch-only) */}
      {!paused && !selected && <button data-walkui className="glass btn-ghost pointer-events-auto absolute bottom-4 left-4 hidden min-h-11 [@media(pointer:fine)]:inline-flex" onClick={greet}>
        {tr(lang, 'Greet · G', 'Selam ver · G')}
      </button>}
      {!paused && <Joystick lang={lang} />}
      {/* touch: bottom-right action cluster, as tall as the joystick so the prompt clears both thumb zones */}
      {!paused && (
        <div data-walkui className="pointer-events-none absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] grid grid-cols-[3.5rem_4rem] items-end justify-items-center gap-2.5 [@media(pointer:fine)]:hidden">
          <button data-walkui className={ROUND_BTN + ' h-11 w-11'} onClick={greet} aria-label={tr(lang, 'Wave', 'El salla')} title={tr(lang, 'Wave', 'El salla')}>👋</button>
          <button data-walkui className={ROUND_BTN + ' h-11 w-11'} onClick={() => { walk.view = walk.view === 'first' ? 'third' : 'first' }} aria-label={tr(lang, 'Switch camera view', 'Kamera görünümünü değiştir')} title={tr(lang, 'View', 'Görünüm')}>👁</button>
          <button data-walkui className={ROUND_BTN + ' h-14 w-14 text-lg'} onPointerDown={() => { walk.rollPressed = true }} aria-label={tr(lang, 'Roll', 'Yuvarlan')} title={tr(lang, 'Roll', 'Yuvarlan')}>⟳</button>
          <button data-walkui className={ROUND_BTN + ' h-16 w-16 font-display text-xl'} onPointerDown={() => { walk.jumpPressed = true }} aria-label={tr(lang, 'Jump', 'Zıpla')} title={tr(lang, 'Jump', 'Zıpla')}>⤒</button>
        </div>
      )}
    </div>
  )
}

/** Touch joystick (phones/tablets) — direct DOM transform avoids React rerenders on pointermove. */
function Joystick({ lang }: { lang: 'en' | 'tr' }) {
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
  const end = (ev: ReactPointerEvent) => {
    if (ev.pointerId !== id.current) return
    id.current = null; setTransform(0, 0); walk.joy.x = walk.joy.y = 0
  }
  const start = (ev: ReactPointerEvent<HTMLDivElement>) => {
    if (id.current !== null) return
    // only grab the pointer when the touch lands inside the circle, not the square box's corners
    const r = ev.currentTarget.getBoundingClientRect()
    if (Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2)) > r.width / 2) return
    id.current = ev.pointerId
    ev.currentTarget.setPointerCapture(ev.pointerId)
    update(ev.clientX, ev.clientY)
  }
  return (
    <div
      ref={base} data-joystick role="application" aria-label={tr(lang, 'Movement joystick', 'Hareket joystick’i')}
      className="pointer-events-auto absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-[max(1.5rem,env(safe-area-inset-left))] h-32 w-32 touch-none rounded-full border border-white/25 bg-black/25 backdrop-blur-sm [@media(pointer:fine)]:hidden"
      onPointerDown={start}
      onPointerMove={(ev) => { if (ev.pointerId === id.current) update(ev.clientX, ev.clientY) }}
      onPointerUp={end} onPointerCancel={end}
    >
      <div ref={knobRef} className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-travertine/80 shadow-lg" style={{ transform: 'translate(-50%, -50%)' }} />
    </div>
  )
}

function SettingsButton({ lang }: { lang: 'en' | 'tr' }) {
  const open = useApp(s => s.walkOverlay === 'settings')
  const [, force] = useState(0)
  return (
    <div className="relative">
      <button data-walkui className={TOP_BTN} onClick={() => { useApp.getState().setWalkOverlay(open ? null : 'settings'); if (document.pointerLockElement) void document.exitPointerLock() }} aria-expanded={open} aria-label={tr(lang, 'Settings', 'Ayarlar')}>⚙</button>
      {open && (
        <div className="glass absolute right-0 top-12 w-[min(18rem,calc(100vw-5.5rem))] max-h-[75vh] overflow-y-auto rounded-2xl p-4 text-sm">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="text-travertine/75">{tr(lang, 'Language', 'Dil')}</span>
            <LangSwitch touch />
          </div>
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
