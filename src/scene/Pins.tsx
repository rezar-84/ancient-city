import { useEffect, useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { Terrain } from './terrainData'
import { LANDMARKS } from '../content/landmarks'
import { lname } from '../content/types'
import { useApp } from '../store'
import { flyTo, orbitPose } from './camera'
import type * as THREE from 'three'

export function landmarkTarget(terrain: Terrain, id: string): THREE.Vector3Tuple | null {
  const l = LANDMARKS.find((x) => x.id === id)
  if (!l) return null
  const [x, z] = terrain.toLocal(l.lat, l.lon)
  return [x, terrain.heightAt(x, z) + 6, z]
}

export function focusLandmark(terrain: Terrain, id: string, duration = 2.4) {
  const l = LANDMARKS.find((x) => x.id === id)
  const t = landmarkTarget(terrain, id)
  if (!l || !t) return Promise.resolve()
  const v = l.view ?? { bearing: 200, elev: 32, dist: 260 }
  const mode = useApp.getState().mode
  if (mode === 'plan') return flyTo([t[0], t[1] + Math.max(650, v.dist * 3), t[2] + 1], t, duration)
  return flyTo(orbitPose(t, v.bearing, v.elev, v.dist), t, duration)
}

export function Pins({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const lang = useApp((s) => s.lang)
  const era = useApp((s) => s.mode === 'plan' ? 'ancient' : s.era)
  const selected = useApp((s) => s.selected)
  const hovered = useApp((s) => s.hovered)
  const year = useApp((s) => s.year)

  const placed = useMemo(
    () =>
      LANDMARKS.map((l, i) => {
        const [x, z] = terrain.toLocal(l.lat, l.lon)
        return { l, n: i + 1, pos: [x, terrain.heightAt(x, z) + (l.pinHeight ?? 22), z] as THREE.Vector3Tuple }
      }),
    [terrain],
  )

  useEffect(() => {
    if (selected && (mode === 'explore' || mode === 'plan')) void focusLandmark(terrain, selected)
  }, [selected, mode, terrain])

  if (mode === 'intro') return null
  const plan = mode === 'plan'

  return (
    <>
      {placed.map(({ l, n, pos }) => {
        const exists = mode !== 'plan' || (year >= l.built && (l.until === undefined || year <= l.until))
        const active = selected === l.id || hovered === l.id
        const showLabel = active
        return (
          <Html key={l.id} position={pos} zIndexRange={[active ? 40 : 20, 0]} style={{ pointerEvents: 'none' }}>
            <button
              className="pin pointer-events-auto group relative flex flex-col items-center"
              style={{ opacity: exists ? 1 : 0.35 }}
              onPointerEnter={() => useApp.getState().hover(l.id)}
              onPointerLeave={() => useApp.getState().hover(null)}
              onClick={(e) => { e.stopPropagation(); useApp.getState().select(l.id) }}
              aria-label={lname(l, lang, era)}
            >
              {showLabel && (
                <span
                  className={
                    'mb-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium shadow-lg ' +
                    (plan && !active ? 'bg-parchment/90 text-ink font-serif text-[13px]' : 'bg-ink/85 text-travertine')
                  }
                >
                  {plan && <span className="mr-1 font-display text-terracotta">{n}</span>}
                  {lname(l, lang, era)}
                </span>
              )}
              <span className="relative grid h-6 w-6 place-items-center">
                {!plan && <span className="pin-ring absolute inset-0 rounded-full border-2 border-gold" />}
                <span
                  className={
                    'pin-dot relative grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold transition-transform ' +
                    (active ? 'scale-125 bg-travertine text-ink' : plan ? 'bg-terracotta text-white' : 'bg-gold text-ink')
                  }
                >
                  {n}
                </span>
              </span>
              <span className="h-4 w-px bg-gradient-to-b from-gold to-transparent" />
            </button>
          </Html>
        )
      })}
    </>
  )
}
