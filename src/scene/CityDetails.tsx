import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from './terrainData'
import { getMaterials } from './materials'
import { altar, amphoraStack, bench, lampPost, marketStall, milestone, parkedCart, statueOnPedestal, streetFountain, type PropParts } from './generators/props'
import { createFoliageMaterial, cypress, grassTuft, olive, patchSwayMaterial, plane, type VegetationParts } from './generators/vegetation'
import { GRID } from '../content/grid'
import { PLAN } from '../content/plan'
import { LANDMARKS } from '../content/landmarks'
import { timeGated, useApp } from '../store'
import { gridFrame, stallSpots } from '../walk/spots'
import { onStreet, walk } from '../walk/WalkControls'
import { waterHere } from './Water'
import { FACADE_MODULES } from './generators/house'
import { FACADE_PLACEMENTS } from './CityGrid'

type Parts = PropParts | VegetationParts
interface Place { x: number; z: number; yaw: number; s?: number }

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
function inPoly(x: number, z: number, poly: Array<[number, number]>) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

const foliage = {
  cypress: createFoliageMaterial('#34431f'),
  olive: createFoliageMaterial('#7b8a5f'),
  plane: createFoliageMaterial('#56702f'),
  grass: (() => { const m = createFoliageMaterial('#8d8a52'); patchSwayMaterial(m); return m })(),
}

/** one InstancedMesh per material part */
function instanced(parts: Parts, places: Place[], t: Terrain, foliageMat?: THREE.Material, shadows = true) {
  const out: THREE.InstancedMesh[] = []
  if (!places.length) return out
  const mats = getMaterials() as unknown as Record<string, THREE.Material>
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
  for (const part of parts.parts) {
    const mat = part.key === 'foliage' ? foliageMat! : mats[part.key]
    const im = new THREE.InstancedMesh(part.geometry, mat, places.length)
    places.forEach((pl, i) => {
      p.set(pl.x, t.heightAt(pl.x, pl.z) - 0.05, pl.z); q.setFromAxisAngle(up, pl.yaw); s.setScalar(pl.s ?? 1)
      im.setMatrixAt(i, m4.compose(p, q, s))
    })
    im.castShadow = shadows; im.receiveShadow = true; im.computeBoundingSphere()
    out.push(im)
  }
  return out
}

/** Street furniture, market stalls, statues, fountains, trees and (in walk mode) grass around you. */
export function CityDetails({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const era = useApp((s) => s.era)
  const showGrid = useApp((s) => s.showGrid)
  const year = useApp((s) => s.year)
  const yr = timeGated(mode) ? year : 200
  const visible = era === 'ancient' && (showGrid || mode === 'walk') && mode !== 'plan' && yr >= GRID.built && yr <= GRID.until

  const meshes = useMemo(() => {
    if (!showGrid && mode !== 'walk') return []
    const F = gridFrame(terrain), rand = rng(2026)
    const out: THREE.InstancedMesh[] = []
    const stands = (id: string) => { const l = LANDMARKS.find((x) => x.id === id); return !!l && yr >= l.built && (l.until === undefined || yr <= l.until) }
    const at = (id: string) => { const l = LANDMARKS.find((x) => x.id === id)!; return terrain.toLocal(l.lat, l.lon) }

    // market stalls in the porticoes, facing the street
    const stalls: Place[][] = [[], [], []], amph: Place[] = []
    for (const st of stallSpots(F.L)) {
      const [x, z] = F.P(st.u, st.side * 9.4)
      const yaw = F.yawV + (st.side > 0 ? Math.PI : 0)
      stalls[st.variant].push({ x, z, yaw })
      if (st.variant === 1) { const [ax, az] = F.P(st.u + 2.2, st.side * 10.2); amph.push({ x: ax, z: az, yaw }) }
    }
    stalls.forEach((pl, v) => out.push(...instanced(marketStall(v as 0 | 1 | 2), pl, terrain)))
    out.push(...instanced(amphoraStack(), amph, terrain))

    // statues along the carriageway, fountains + benches at every 4th junction
    const statues: Place[] = [], fountains: Place[] = [], benches: Place[] = [], lamps: Place[] = []
    for (let u = 45; u < F.L - 40; u += 72) for (const sd of [1, -1]) { const [x, z] = F.P(u, sd * 7.3); statues.push({ x, z, yaw: F.yawV + (sd > 0 ? Math.PI : 0) }) }
    for (let k = 2; k * GRID.pitchU < F.L - 20; k += 4) for (const sd of [1, -1]) {
      const [x, z] = F.P(k * GRID.pitchU + 2.6, sd * 14.5); fountains.push({ x, z, yaw: F.yawU })
      const [bx, bz] = F.P(k * GRID.pitchU + 5.2, sd * 14.5); benches.push({ x: bx, z: bz, yaw: F.yawV + (sd > 0 ? Math.PI : 0) })
    }
    if (yr >= 330) for (let u = 30; u < F.L - 30; u += 40) for (const sd of [1, -1]) { const [x, z] = F.P(u, sd * 6.9); lamps.push({ x, z, yaw: 0 }) }
    out.push(...instanced(statueOnPedestal(), yr < 330 ? statues : statues.filter((_, i) => i % 3 === 0), terrain))
    out.push(...instanced(streetFountain(), fountains, terrain))
    out.push(...instanced(bench(), benches, terrain))
    out.push(...instanced(lampPost(), lamps, terrain))

    // milestones and parked carts at the Frontinus Gate; altars before standing temples
    const miles: Place[] = [F.P(10, 7.5), F.P(10, -7.5)].map(([x, z]) => ({ x, z, yaw: F.yawU }))
    const parked: Place[] = [F.P(-18, 6), F.P(-24, -5), F.P(-30, 7)].map(([x, z], i) => ({ x, z, yaw: F.yawU + 0.3 * (i - 1) }))
    const altars: Place[] = []
    for (const id of ['apollo', 'ploutonion']) if (stands(id)) { const [x, z] = at(id); altars.push({ x: x + 9, z: z + 9, yaw: rand() * 6.28 }) }
    out.push(...instanced(milestone(), miles, terrain))
    out.push(...instanced(parkedCart(), parked, terrain))
    out.push(...instanced(altar(), altars, terrain))

    // trees: cypresses along the necropolis road, olive groves outside the walls, plane trees by the agora
    const cyp: Place[] = [], oli: Place[] = [], pla: Place[] = []
    const road = PLAN.streets[1].line.map(([la, lo]) => terrain.toLocal(la, lo))
    for (let i = 1; i < road.length; i++) {
      const [ax, az] = road[i - 1], [bx, bz] = road[i], len = Math.hypot(bx - ax, bz - az)
      const nx = -(bz - az) / len, nz = (bx - ax) / len
      for (let d = 0; d < len; d += 18 + rand() * 10) for (const sd of [1, -1]) {
        const x = ax + (bx - ax) * (d / len) + nx * sd * (7 + rand() * 3), z = az + (bz - az) * (d / len) + nz * sd * (7 + rand() * 3)
        cyp.push({ x, z, yaw: rand() * 6.28, s: 0.8 + rand() * 0.45 })
      }
    }
    const region = GRID.region.map(([la, lo]) => terrain.toLocal(la, lo))
    const trav = PLAN.zones.find((z) => z.kind === 'travertine')!.poly.map(([la, lo]) => terrain.toLocal(la, lo))
    const [cx, cz] = F.P(F.L / 2, 0)
    for (let n = 0; n < 900 && oli.length < 420; n++) {
      const a = rand() * Math.PI * 2, r = 380 + rand() * 900
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      if (inPoly(x, z, region) || inPoly(x, z, trav)) continue
      const h = terrain.heightAt(x, z), slope = Math.abs(terrain.heightAt(x + 4, z) - h) + Math.abs(terrain.heightAt(x, z + 4) - h)
      if (slope > 2.2) continue
      // groves: cluster around a few seeds
      for (let k = 0; k < 3 && oli.length < 420; k++) oli.push({ x: x + (rand() - 0.5) * 18, z: z + (rand() - 0.5) * 18, yaw: rand() * 6.28, s: 0.75 + rand() * 0.5 })
    }
    if (stands('agora')) { const [ax, az] = at('agora'); for (let i = 0; i < 8; i++) pla.push({ x: ax + (rand() - 0.5) * 120, z: az + (rand() - 0.5) * 120, yaw: rand() * 6.28, s: 0.9 + rand() * 0.3 }) }
    out.push(...instanced(cypress(), cyp, terrain, foliage.cypress))
    out.push(...instanced(olive(), oli, terrain, foliage.olive))
    out.push(...instanced(plane(), pla, terrain, foliage.plane))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, showGrid, mode === 'walk', yr])

  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])

  // grass tufts recycled around the walker
  const grass = useMemo(() => {
    const parts = grassTuft().parts
    const im = new THREE.InstancedMesh(parts[0].geometry, foliage.grass, 2200)
    im.frustumCulled = false; im.receiveShadow = true
    return im
  }, [])
  // house facades near the walker (doors, windows, shop fronts, string courses, eaves, balconies)
  const facades = useMemo(() => {
    const mats = getMaterials() as unknown as Record<string, THREE.Material>
    const CAP = 2600
    return Object.entries(FACADE_MODULES).map(([name, parts]) => ({
      name,
      meshes: parts.map((p) => { const im = new THREE.InstancedMesh(p.geometry, mats[p.key], CAP); im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; return im }),
    }))
  }, [])
  const lastF = useRef({ x: 1e9, z: 1e9, n: -1 })
  const last = useRef({ x: 1e9, z: 1e9 })
  const clock = useRef(0)
  useFrame((_, dt) => {
    clock.current += dt
    ;(foliage.grass.userData.uTime as { value: number }).value = clock.current
    if (mode !== 'walk') { grass.visible = false; facades.forEach((f) => f.meshes.forEach((m) => { m.count = 0 })); lastF.current.n = -1; return }
    grass.visible = true
    if (Math.hypot(walk.x - lastF.current.x, walk.z - lastF.current.z) > 15 || lastF.current.n !== FACADE_PLACEMENTS.length) {
      lastF.current = { x: walk.x, z: walk.z, n: FACADE_PLACEMENTS.length }
      const counts = new Map<string, number>()
      const byName = new Map(facades.map((f) => [f.name, f.meshes]))
      for (const pl of FACADE_PLACEMENTS) {
        if (Math.abs(pl.x - walk.x) > 110 || Math.abs(pl.z - walk.z) > 110) continue
        const ms = byName.get(pl.module); if (!ms) continue
        const i = counts.get(pl.module) ?? 0
        if (i >= ms[0].instanceMatrix.count) continue
        for (const m of ms) m.setMatrixAt(i, pl.m)
        counts.set(pl.module, i + 1)
      }
      for (const f of facades) for (const m of f.meshes) { m.count = counts.get(f.name) ?? 0; m.instanceMatrix.needsUpdate = true }
    }
    if (Math.hypot(walk.x - last.current.x, walk.z - last.current.z) < 15) return
    last.current = { x: walk.x, z: walk.z }
    const rand = rng(Math.floor(walk.x) * 73856093 ^ Math.floor(walk.z) * 19349663)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0)
    for (let i = 0; i < grass.count; i++) {
      const a = rand() * Math.PI * 2, r = 2 + Math.sqrt(rand()) * 45
      const x = walk.x + Math.cos(a) * r, z = walk.z + Math.sin(a) * r
      if (onStreet(x, z) || waterHere(x, z)) { grass.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue }
      p.set(x, terrain.heightAt(x, z), z); q.setFromAxisAngle(up, rand() * 6.28); s.setScalar(0.7 + rand() * 0.9)
      grass.setMatrixAt(i, m4.compose(p, q, s))
    }
    grass.instanceMatrix.needsUpdate = true
  })

  return (
    <group visible={visible}>
      {meshes.map((m, i) => <primitive key={i} object={m} />)}
      <primitive object={grass} />
      {facades.map((f) => f.meshes.map((m, i) => <primitive key={f.name + i} object={m} />))}
    </group>
  )
}
