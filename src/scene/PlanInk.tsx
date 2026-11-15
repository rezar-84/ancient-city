import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { RUINS, RUIN_LABELS } from '../content/ruins'
import { useApp } from '../store'
import { sceneUniforms } from './Terrain'

const COLORS: Record<string, string> = { ruin: '#5a3b26', tower: '#2b2118', gate: '#2b2118', wall: '#2b2118', tomb: '#7a5a3a' }

/** OSM-mapped ruin footprints drawn as ink on the terrain in plan mode (one LineSegments per kind). */
export function PlanInk({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const lang = useApp((s) => s.lang)
  const group = useRef<THREE.Group>(null)
  const layers = useMemo(() => {
    const byKind = new Map<string, number[]>()
    for (const sh of RUINS) {
      const pts = sh.p.map(([la, lo]) => terrain.toLocal(la, lo))
      const arr = byKind.get(sh.k) ?? []
      const n = pts.length
      for (let i = 0; i < n - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1]
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4))
        for (let k = 0; k < steps; k++) {
          const t0 = k / steps, t1 = (k + 1) / steps
          const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1
          arr.push(x0, terrain.heightAt(x0, z0) + 0.8, z0, x1, terrain.heightAt(x1, z1) + 0.8, z1)
        }
      }
      byKind.set(sh.k, arr)
    }
    return [...byKind].map(([k, arr]) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
      const m = new THREE.LineBasicMaterial({ color: COLORS[k], transparent: true, opacity: 0, depthWrite: false })
      return { k, g, m }
    })
  }, [terrain])
  const labels = useMemo(() => RUIN_LABELS.map((l) => {
    const [x, z] = terrain.toLocal(l.lat, l.lon)
    return { ...l, pos: [x, terrain.heightAt(x, z) + 2, z] as THREE.Vector3Tuple }
  }), [terrain])

  useFrame(() => {
    const o = Math.max(0, sceneUniforms.uPlan.value * 1.2 - 0.2)
    for (const l of layers) l.m.opacity = o * 0.95
    if (group.current) group.current.visible = o > 0.01
  })

  return (
    <group ref={group}>
      {layers.map((l) => <lineSegments key={l.k} geometry={l.g} material={l.m} renderOrder={5} />)}
      {mode === 'plan' && labels.map((l) => (
        <Html key={l.en + l.lat} position={l.pos} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <span className="whitespace-nowrap font-serif text-[11px] italic text-ink/75 [text-shadow:0_0_3px_#efe2c4,0_0_6px_#efe2c4]">{l[lang]}</span>
        </Html>
      ))}
    </group>
  )
}
