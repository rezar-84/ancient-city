import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from '../scene/terrainData'
import { solidMonumentAt } from '../scene/footprints'
import { gridFrame, stallSpots } from './spots'

/** Small, shared-geometry market animals, fetched only after entering walk mode. */
export function MarketSheep({ terrain, year }: { terrain: Terrain; year: number }) {
  const [source, setSource] = useState<THREE.Group | null>(null)
  useEffect(() => {
    let cancelled = false
    void import('three/examples/jsm/loaders/OBJLoader.js').then(({ OBJLoader }) =>
      new OBJLoader().loadAsync('/models/animals/sheep.obj'))
      .then(model => { if (cancelled) model.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() }); else setSource(model) })
      .catch(error => console.warn('Market sheep unavailable', error))
    return () => { cancelled = true }
  }, [])
  useEffect(() => () => {
    source?.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
  }, [source])
  const spots = useMemo(() => {
    const frame = gridFrame(terrain)
    const market = stallSpots(frame.L).filter((_, i) => i % 3 === 0).slice(0, 8)
      .map((stall, i) => {
        const [x, z] = frame.P(stall.u + (i % 2 ? 3 : -3), stall.side * 15)
        return { x, z, y: terrain.heightAt(x, z), angle: frame.yawU + stall.side * 0.65, phase: i * 1.9, radius: 0.55 }
      })
    // Grazing Anatolian fat-tailed sheep flock outside the northern gate / sanctuary pasture (especially rich in 150 BC wool town)
    const pastureCount = year < 0 ? 10 : 6
    const pasture = Array.from({ length: pastureCount }, (_, k) => {
      const a = k * 2.39996, r = 6 + (k % 4) * 3.8
      const [bx, bz] = frame.P(-22 - k * 2.5, 22 + Math.sin(a) * r)
      const x = bx + Math.cos(a) * r * 0.5, z = bz
      return { x, z, y: terrain.heightAt(x, z), angle: a, phase: k * 1.3 + 0.5, radius: 1.35 }
    })
    return [...market, ...pasture].filter(p => !solidMonumentAt(p.x, p.z, year, 1.4))
  }, [terrain, year])
  const parts = useMemo(() => {
    if (!source) return []
    const out: THREE.InstancedMesh[] = []
    source.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return
      const originals = Array.isArray(o.material) ? o.material : [o.material]
      const materials = originals.map(m => new THREE.MeshStandardMaterial({
        color: m.name === 'Black' ? '#302923' : '#d9d1bb', roughness: 0.92,
      }))
      const mesh = new THREE.InstancedMesh(o.geometry.clone(), materials.length === 1 ? materials[0] : materials, spots.length)
      mesh.castShadow = mesh.receiveShadow = true
      out.push(mesh)
    })
    return out
  }, [source, spots.length])
  useEffect(() => () => {
    parts.forEach(mesh => {
      mesh.geometry.dispose()
      mesh.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach(m => m.dispose())
    })
  }, [parts])
  const elapsed = useRef(0), lastUpdate = useRef(-1)
  const matrix = useMemo(() => new THREE.Matrix4(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const rotation = useMemo(() => new THREE.Quaternion(), [])
  const grazePitch = useMemo(() => new THREE.Quaternion(), [])
  const xAxis = useMemo(() => new THREE.Vector3(1, 0, 0), [])
  const scale = useMemo(() => new THREE.Vector3(0.2, 0.2, 0.2), [])
  const axis = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  useFrame((_, dt) => {
    if (!parts.length) return
    elapsed.current += Math.min(dt, 0.1)
    if (elapsed.current - lastUpdate.current < 0.08) return
    lastUpdate.current = elapsed.current
    spots.forEach((spot, i) => {
      const drift = elapsed.current * 0.22 + spot.phase
      const wx = spot.x + Math.cos(drift) * spot.radius * 0.35
      const wz = spot.z + Math.sin(drift * 0.8) * spot.radius * 0.35
      position.set(wx, terrain.heightAt(wx, wz) + 0.02, wz)
      rotation.setFromAxisAngle(axis, spot.angle + Math.sin(elapsed.current * 0.55 + spot.phase) * 0.22)
      // Periodic gentle grazing dip
      const nibble = Math.max(0, Math.sin(elapsed.current * 0.9 + spot.phase * 1.7) - 0.35) * 0.14
      grazePitch.setFromAxisAngle(xAxis, nibble)
      rotation.multiply(grazePitch)
      matrix.compose(position, rotation, scale)
      parts.forEach(mesh => mesh.setMatrixAt(i, matrix))
    })
    parts.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true })
  })
  return <group>{parts.map((mesh, i) => <primitive key={i} object={mesh} />)}</group>
}
