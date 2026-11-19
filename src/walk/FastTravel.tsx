import { useEffect } from 'react'
import * as THREE from 'three'
import { useApp } from '../store'
import { LANDMARKS } from '../content/landmarks'
import { lname } from '../content/types'
import { PLAN_VIEW } from '../content/plan'
import { getTerrain } from '../scene/terrainData'
import { PlanSVG } from '../guide/PlanSVG'
import { teleport, walk } from './WalkControls'

const { s, n, w, e } = PLAN_VIEW
const kx = Math.cos(((s + n) / 2) * Math.PI / 180)
const ASPECT = (n - s) / ((e - w) * kx)

/** standing point in front of a monument, facing it (from its preferred camera bearing) */
export function standPoint(id: string) {
  const t = getTerrain(), l = LANDMARKS.find((x) => x.id === id)
  if (!t || !l) return null
  const [tx, tz] = t.toLocal(l.lat, l.lon)
  const v = l.view ?? { bearing: 200, elev: 30, dist: 120 }
  const b = THREE.MathUtils.degToRad(v.bearing)
  const d = THREE.MathUtils.clamp(v.dist * 0.32, 14, 55)
  const x = tx + Math.sin(b) * d, z = tz + Math.cos(b) * d
  return { x, z, yaw: Math.atan2(-(tx - x), -(tz - z)) }
}

let fadeEl: HTMLDivElement | null = null
let travelVersion = 0
function setOpen(open: boolean) {
  const state = useApp.getState()
  if (open && (state.mode !== 'walk' || state.walkPaused)) return
  state.setWalkOverlay(open ? 'map' : null)
  if (open && document.pointerLockElement) void document.exitPointerLock()
}
/** fade to black, move, fade back */
export function travelTo(id: string) {
  const p = standPoint(id)
  if (!p) return
  const version = ++travelVersion
  if (!fadeEl) {
    fadeEl = document.createElement('div')
    Object.assign(fadeEl.style, { position: 'fixed', inset: '0', background: '#0b0806', opacity: '0', pointerEvents: 'none', transition: 'opacity .35s ease', zIndex: '60' })
    document.body.appendChild(fadeEl)
  }
  fadeEl.style.opacity = '1'
  window.setTimeout(() => {
    if (version !== travelVersion) return
    if (useApp.getState().mode !== 'walk') { if (fadeEl) fadeEl.style.opacity = '0'; return }
    teleport(p.x, p.z, p.yaw)
    window.dispatchEvent(new Event('walk:arrive'))
    window.setTimeout(() => { if (fadeEl && version === travelVersion) fadeEl.style.opacity = '0' }, 180)
  }, 380)
}

/** Full-screen map for walk mode: click a monument to travel there. */
export function FastTravel() {
  const mode = useApp((st) => st.mode)
  const lang = useApp((st) => st.lang)
  const year = useApp((st) => st.year)
  const open = useApp(st => st.walkOverlay === 'map')
  const active = mode === 'walk'

  useEffect(() => {
    if (!active) { setOpen(false); return }
    const key = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || useApp.getState().walkPaused || useApp.getState().walkOverlay === 'settings' || useApp.getState().selected) return
      if (ev.key.toLowerCase() === 'm') {
        if (!ev.repeat) setOpen(useApp.getState().walkOverlay !== 'map')
      }
      const num = Number(ev.key)
      if (num >= 1 && num <= 9 && !ev.repeat) {
        const l = LANDMARKS[num - 1]
        if (l) { setOpen(false); travelTo(l.id) }
      }
    }
    const openEv = () => setOpen(true)
    window.addEventListener('keydown', key)
    window.addEventListener('walk:map', openEv)
    return () => { travelVersion++; if (fadeEl) fadeEl.style.opacity = '0'; window.removeEventListener('keydown', key); window.removeEventListener('walk:map', openEv) }
  }, [active])

  if (!active || !open) return null
  const t = getTerrain()
  const me = t ? t.toLatLon(walk.x, walk.z) : null
  const heading = ((-walk.yaw * 180) / Math.PI % 360 + 360) % 360
  return (
    <div data-walkui data-fastmap className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="glass relative flex max-h-full w-full max-w-5xl flex-col gap-3 rounded-3xl p-3 sm:flex-row sm:p-4" onClick={(ev) => ev.stopPropagation()}>
        <div className="relative mx-auto overflow-hidden rounded-2xl" style={{ height: 'min(78vh, 900px)', aspectRatio: `${1 / ASPECT}` }}>
          <PlanSVG lang={lang} width={700} withLabels grid fit />
          {LANDMARKS.map((l, i) => {
            const exists = year >= l.built && (l.until === undefined || year <= l.until)
            return (
              <button key={l.id} onClick={() => { setOpen(false); travelTo(l.id) }}
                className={'absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition hover:scale-125 ' + (exists ? '' : 'opacity-40')}
                style={{ left: `${((l.lon - w) / (e - w)) * 100}%`, top: `${((n - l.lat) / (n - s)) * 100}%`, width: 30, height: 30 }}
                title={lname(l, lang)} aria-label={lname(l, lang)}>
                <span className="block h-full w-full rounded-full ring-2 ring-gold/0 hover:ring-gold" />
                <span className="sr-only">{i + 1}</span>
              </button>
            )
          })}
          {me && (
            <div className="pointer-events-none absolute h-0 w-0" style={{
              left: `${((me[1] - w) / (e - w)) * 100}%`, top: `${((n - me[0]) / (n - s)) * 100}%`,
              borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '18px solid #c9553a',
              transform: `translate(-50%,-50%) rotate(${heading}deg)`, filter: 'drop-shadow(0 0 3px #fff)',
            }} />
          )}
        </div>
        <div className="flex min-w-0 flex-col sm:w-64">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg tracking-[0.12em] text-gold">{lang === 'en' ? 'TRAVEL' : 'YOLCULUK'}</h2>
            <button className="btn-ghost px-2" onClick={() => setOpen(false)} aria-label="close">✕</button>
          </div>
          <p className="text-xs text-travertine/60">{lang === 'en' ? 'Click a place on the map or in the list. Keys 1–9 travel directly.' : 'Haritada veya listede bir yere tıklayın. 1–9 tuşları doğrudan götürür.'}</p>
          <ol className="scroll-thin mt-2 max-h-[40vh] space-y-0.5 overflow-y-auto text-sm sm:max-h-none sm:flex-1">
            {LANDMARKS.map((l, i) => {
              const exists = year >= l.built && (l.until === undefined || year <= l.until)
              return (
                <li key={l.id}>
                  <button className={'flex w-full gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/10 ' + (exists ? '' : 'opacity-45')} onClick={() => { setOpen(false); travelTo(l.id) }}>
                    <span className="w-5 shrink-0 text-right font-display text-gold">{i + 1}</span>
                    <span className="truncate">{lname(l, lang)}</span>
                    {!exists && <span className="ml-auto shrink-0 text-[10px] text-travertine/50">{lang === 'en' ? 'not yet / gone' : 'henüz yok / yok oldu'}</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}
if (import.meta.env.DEV) (window as unknown as { __travel: typeof travelTo }).__travel = travelTo
