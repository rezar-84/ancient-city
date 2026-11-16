import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { buildWater, waterAt, waterUniforms, type WaterVolume } from './water'
import { sceneUniforms } from './Terrain'
import { SKY } from './sky'
import { useApp } from '../store'

/** water volumes of the current scene (Sacred Pool + travertine terraces), read by walk physics */
export let WATER_VOLUMES: WaterVolume[] = []
export const waterHere = (x: number, z: number) => (WATER_VOLUMES.length ? waterAt(WATER_VOLUMES, x, z) : null)

/** Sacred Pool with its fallen portico, the terraced travertine basins down the cliff, and thermal steam. */
export default function Water({ terrain }: { terrain: Terrain }) {
  const built = useMemo(() => buildWater(terrain), [terrain])
  const mode = useApp((s) => s.mode)
  useEffect(() => {
    WATER_VOLUMES = built.volumes
    const pool = built.volumes.find((v) => v.id === 'antique-pool')
    if (pool) {
      // cut the ground out of the basin: an ellipse just inside the coping
      const xs = pool.polygon.map((p) => p[0]), zs = pool.polygon.map((p) => p[1])
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2
      sceneUniforms.uHole.value.set(cx, cz, (Math.max(...xs) - Math.min(...xs)) / 2 * 0.9, (Math.max(...zs) - Math.min(...zs)) / 2 * 0.9)
    }
    return () => {
      WATER_VOLUMES = []
      sceneUniforms.uHole.value.set(0, 0, 0, 0)
      built.group.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose()
      })
    }
  }, [built])
  useFrame(() => {
    waterUniforms.uTime.value = sceneUniforms.uTime.value
    const u = built.group.userData.uSteam as { value: number } | undefined
    if (u) u.value = SKY.steam
  })
  return <primitive object={built.group} visible={mode !== 'plan'} />
}
