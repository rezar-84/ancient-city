import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { LANDMARKS } from '../content/landmarks'
import { useApp } from '../store'

function puffTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,0.55)'); grd.addColorStop(0.5, 'rgba(240,240,235,0.18)'); grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Low, drifting "breath of Hades" over the Ploutonion arena. */
export function PloutonionMist({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const era = useApp((s) => s.era)
  const group = useRef<THREE.Group>(null)
  const { center, puffs, mat } = useMemo(() => {
    const l = LANDMARKS.find((x) => x.id === 'ploutonion')!
    const [x, z] = terrain.toLocal(l.lat, l.lon)
    const mat = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0.5, color: '#e9eef0' })
    const puffs = Array.from({ length: 26 }, (_, i) => ({ a: (i / 26) * Math.PI * 2, r: 4 + Math.random() * 14, s: 8 + Math.random() * 10, ph: Math.random() * 10 }))
    return { center: new THREE.Vector3(x, terrain.heightAt(x, z) + 0.8, z), puffs, mat }
  }, [terrain])
  useFrame(({ clock }) => {
    const g = group.current; if (!g) return
    g.visible = mode !== 'plan' && era === 'ancient'
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      const p = puffs[i]
      const a = p.a + t * 0.04
      c.position.set(Math.cos(a) * p.r + Math.sin(t * 0.3 + p.ph) * 2, 0.6 + Math.sin(t * 0.5 + p.ph) * 0.4, Math.sin(a) * p.r)
      ;(c as THREE.Sprite).material.opacity = 0.35 + 0.15 * Math.sin(t * 0.7 + p.ph)
    })
  })
  return (
    <group ref={group} position={center}>
      {puffs.map((p, i) => <sprite key={i} material={mat} scale={[p.s, p.s * 0.45, 1]} />)}
    </group>
  )
}
