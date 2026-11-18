import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Terrain } from '../scene/terrainData'
import { GRID } from '../content/grid'
import { LANDMARKS } from '../content/landmarks'
import { solidMonumentAt } from '../scene/footprints'
import { CHARACTERS } from '../content/characters'
import { useApp, walkInputBlocked } from '../store'
import { createCartGeometry, createCrowdAttributes, createHorseGeometry, createPersonGeometry, ERA_PALETTES, patchCrowdMaterial, SKIN_TONES } from './npcGeometry'
import { gridFrame, stallSpots } from './spots'
import { walk } from './WalkControls'
import { WorldProbe } from './physics'
import { createRiggedCitizen, loadCitizenAssets } from './riggedCitizen'
import { MarketSheep } from './MarketSheep'

type Variant = 'greek' | 'roman' | 'byzantine'
const variantFor = (year: number): Variant => (year < -133 ? 'greek' : year < 330 ? 'roman' : 'byzantine')

function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** NPC kinds: street walkers, idle chatting groups, merchants at stalls, praying priests. */
interface Npc {
  kind: 'walker' | 'cross' | 'idle' | 'merchant' | 'priest' | 'pilgrim'
  u: number; v: number; dir: number; speed: number; min: number; max: number
  /** fixed spot (idle/merchant/priest) in local metres, and facing */
  x?: number; z?: number; face?: number
  side: number; phase: number; pose: number; look: number
  /** for bark targeting: index into NPCS */
}

/** live NPC positions for barks (x, z, yaw, voice) */
export const NPC_STATE: { x: Float32Array; z: Float32Array; count: number; female: Uint8Array } = { x: new Float32Array(0), z: new Float32Array(0), count: 0, female: new Uint8Array(0) }

export function Crowd({ terrain }: { terrain: Terrain }) {
  const mode = useApp((s) => s.mode)
  const [citizenAssets, setCitizenAssets] = useState(false)
  useEffect(() => {
    if (mode !== 'walk' || citizenAssets) return
    let cancelled = false
    void loadCitizenAssets().then(() => { if (!cancelled) setCitizenAssets(true) })
      .catch(error => console.warn('Detailed citizens unavailable; keeping the instanced crowd.', error))
    return () => { cancelled = true }
  }, [mode, citizenAssets])
  const scene = useThree(s => s.scene)
  const probe = useMemo(() => new WorldProbe(), [])
  const groundCache = useRef(new Map<number, { x: number; z: number; y: number }>())
  const era = useApp((s) => s.era)
  const showGrid = useApp((s) => s.showGrid)
  const year = useApp((s) => s.year)
  const character = useApp((s) => s.character)
  const variant: Variant = mode === 'walk' || mode === 'plan' ? variantFor(year) : 'roman'
  const visible = era === 'ancient' && (mode === 'walk' || (mode === 'explore' && showGrid) || mode === 'tour')

  useEffect(() => {
    const timer = window.setTimeout(() => { probe.refresh(scene); groundCache.current.clear() }, 400)
    return () => window.clearTimeout(timer)
  }, [scene, probe, year, showGrid, mode])
  const surfaceY = (x: number, z: number, id: number) => {
    const terrainY = terrain.heightAt(x, z)
    const cached = groundCache.current.get(id)
    if (!cached || Math.hypot(x - cached.x, z - cached.z) > 0.35) {
      const y = Math.max(terrainY, probe.ground(x, z, terrainY + 2.5))
      groundCache.current.set(id, { x, z, y })
      return y + 0.015
    }
    return Math.max(terrainY, cached.y) + 0.015
  }

  const sim = useMemo(() => {
    const F = gridFrame(terrain)
    const rand = rng(85 + variant.length)
    const npcs: Npc[] = []
    const yr = mode === 'walk' || mode === 'plan' ? year : 200
    const spawnYr = mode === 'walk' || mode === 'plan' ? year : null
    const stands = (id: string) => { const l = LANDMARKS.find((x) => x.id === id); return !!l && yr >= l.built && (l.until === undefined || yr <= l.until) }
    const at = (id: string) => { const l = LANDMARKS.find((x) => x.id === id)!; return terrain.toLocal(l.lat, l.lon) }
    const pop = variant === 'roman' ? 1 : 0.65
    const nWalk = Math.round(240 * pop), nCross = Math.round(70 * pop)
    for (let i = 0; i < nWalk; i++) {
      const lane = [-9.5, -6, -2.2, 2.2, 6, 9.5][Math.floor(rand() * 6)]
      let uu = 0
      for (let k = 0; k < 8; k++) { uu = rand() < 0.45 ? 15 + rand() * 280 : 20 + rand() * (F.L - 40); if (!solidMonumentAt(...F.P(uu, lane), spawnYr, 1)) break }
      npcs.push({ kind: 'walker', u: uu, v: lane + (rand() - 0.5), dir: rand() < 0.5 ? 1 : -1, speed: 1.0 + rand() * 0.45, min: 12, max: F.L - 12, side: 0, phase: rand() * 6.28, pose: 0, look: 0 })
    }
    for (let i = 0; i < nCross; i++) {
      const k = 3 + Math.floor(rand() * (F.L / GRID.pitchU - 6)), side = rand() < 0.5 ? 1 : -1
      npcs.push({ kind: 'cross', u: k * GRID.pitchU + (rand() - 0.5) * 1.2, v: side * (14 + rand() * 180), dir: rand() < 0.5 ? 1 : -1, speed: 0.9 + rand() * 0.4, min: side > 0 ? 14 : -200, max: side > 0 ? 200 : -14, side: 0, phase: rand() * 6.28, pose: 0, look: 0 })
    }
    // chatting groups: agora edge and around the nymphaeum
    const groupAt = (cx: number, cz: number, n: number) => {
      for (let g = 0; g < n; g++) {
        // never inside a monument (the nymphaeum basin, temple cella…): resample a few times, else skip
        let gx = 0, gz = 0, ok = false
        for (let k = 0; k < 12 && !ok; k++) { gx = cx + (rand() - 0.5) * 60; gz = cz + (rand() - 0.5) * 60; ok = !solidMonumentAt(gx, gz, spawnYr, 2) }
        if (!ok) continue
        const size = 2 + Math.floor(rand() * 3)
        for (let m = 0; m < size; m++) {
          const a = (m / size) * Math.PI * 2 + rand() * 0.4, r = 0.9 + rand() * 0.3
          const x = gx + Math.cos(a) * r, z = gz + Math.sin(a) * r
          npcs.push({ kind: 'idle', u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x, z, face: Math.atan2(gx - x, gz - z), side: 0, phase: rand() * 6.28, pose: rand() < 0.45 ? 1 : 0, look: 0 })
        }
      }
    }
    if (stands('agora')) { const [x, z] = at('agora'); groupAt(x, z, variant === 'roman' ? 9 : 6) }
    if (stands('tritons')) { const [x, z] = at('tritons'); groupAt(x, z, 3) }
    if (stands('theatre')) { const [x, z] = at('theatre'); groupAt(x - 40, z, 3) }
    // merchants behind the stalls
    for (const st of stallSpots(F.L)) {
      const [x, z] = F.P(st.u, st.side * 10.6)
      npcs.push({ kind: 'merchant', u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x, z, face: F.yawV + (st.side > 0 ? Math.PI : 0), side: 0, phase: rand() * 6.28, pose: 1, look: 0 })
    }
    // priests / monks praying at the sanctuaries that stand in this year
    const pray = (id: string, n: number, r = 7) => {
      if (!stands(id)) return
      const [cx, cz] = at(id)
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
        npcs.push({ kind: 'priest', u: 0, v: 0, dir: 1, speed: 0, min: 0, max: 0, x, z, face: Math.atan2(cx - x, cz - z), side: 0, phase: rand() * 6.28, pose: 2, look: 0 })
      }
    }
    pray('apollo', 3, 14); pray('ploutonion', 4, 9); pray('martyrium', 4, 22); pray('cathedral', 3, 16); pray('philip-church', 3, 14)
    // Byzantine pilgrims between the church of St Philip and the Martyrium
    if (variant === 'byzantine' && stands('martyrium')) {
      const [ax, az] = at('philip-church'), [bx, bz] = at('martyrium')
      for (let i = 0; i < 26; i++) {
        const t = rand()
        npcs.push({ kind: 'pilgrim', u: t, v: (rand() - 0.5) * 3, dir: rand() < 0.5 ? 1 : -1, speed: 0.7 + rand() * 0.3, min: 0, max: 1, x: ax, z: az, face: Math.atan2(bx - ax, bz - az), side: Math.hypot(bx - ax, bz - az), phase: rand() * 6.28, pose: 0, look: 0 })
        void bx; void bz
      }
      npcs.forEach((n) => { if (n.kind === 'pilgrim') { n.max = 1; (n as Npc & { bx?: number; bz?: number }).bx = bx; (n as Npc & { bx?: number; bz?: number }).bz = bz } })
    }

    // meshes
    const pal = ERA_PALETTES[variant]
    const pGeo = createPersonGeometry(variant)
    const pAttr = createCrowdAttributes(npcs.length + 1)
    pGeo.setAttribute('iAnim', pAttr.anim); pGeo.setAttribute('iTint0', pAttr.tint0); pGeo.setAttribute('iTint1', pAttr.tint1); pGeo.setAttribute('iTint2', pAttr.tint2)
    const pMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })
    patchCrowdMaterial(pMat, 'person')
    const people = new THREE.InstancedMesh(pGeo, pMat, npcs.length + 1) // last instance = the player's avatar
    const c = new THREE.Color()
    const female = new Uint8Array(npcs.length)
    npcs.forEach((n, i) => {
      const priest = n.kind === 'priest'
      c.set(priest ? (variant === 'byzantine' ? '#2e2620' : '#efe8dc') : pal.cloth[Math.floor(rand() * pal.cloth.length)]); pAttr.tint0.setXYZ(i, c.r, c.g, c.b)
      c.set(SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)]); pAttr.tint1.setXYZ(i, c.r, c.g, c.b)
      c.set(pal.accent[Math.floor(rand() * pal.accent.length)]); pAttr.tint2.setXYZ(i, c.r, c.g, c.b)
      pAttr.anim.setXYZW(i, n.phase, 0, n.pose, 0)
      female[i] = rand() < 0.45 ? 1 : 0
    })
    const ch = CHARACTERS.find((x) => x.id === character) ?? CHARACTERS[2]
    c.set(ch.colors.body); pAttr.tint0.setXYZ(npcs.length, c.r, c.g, c.b)
    c.set(SKIN_TONES[2]); pAttr.tint1.setXYZ(npcs.length, c.r, c.g, c.b)
    c.set(ch.colors.accent); pAttr.tint2.setXYZ(npcs.length, c.r, c.g, c.b)

    const avatar = citizenAssets ? createRiggedCitizen(variant, { cloth: new THREE.Color(ch.colors.body), skin: new THREE.Color(SKIN_TONES[2]), accent: new THREE.Color(ch.colors.accent) }, ch.gender) : null
    if (avatar) avatar.root.visible = false
    const poolSize = window.matchMedia('(pointer: coarse)').matches ? 2 : 6
    const closePeople = Array.from({ length: citizenAssets ? poolSize : 0 }, (_, slotIndex) => {
      const gender = slotIndex % 2 ? 'f' as const : 'm' as const
      const citizen = createRiggedCitizen(variant, { cloth: new THREE.Color(pal.cloth[0]), skin: new THREE.Color(SKIN_TONES[2]), accent: new THREE.Color(pal.accent[0]) }, gender)
      citizen.root.visible = false
      return { citizen, id: -1, gender }
    })

    const nCarts = variant === 'roman' ? 16 : 9
    const carts = Array.from({ length: nCarts }, (_, i) => ({ u: 40 + rand() * (F.L - 80), v: i % 2 ? 2.4 : -2.4, dir: i % 2 ? 1 : -1, speed: 1.2 + rand() * 0.3, phase: rand() * 6.28 }))
    const hGeo = createHorseGeometry(), hAttr = createCrowdAttributes(nCarts)
    hGeo.setAttribute('iAnim', hAttr.anim); hGeo.setAttribute('iTint0', hAttr.tint0); hGeo.setAttribute('iTint1', hAttr.tint1); hGeo.setAttribute('iTint2', hAttr.tint2)
    const cGeo = createCartGeometry(), cAttr = createCrowdAttributes(nCarts)
    cGeo.setAttribute('iAnim', cAttr.anim); cGeo.setAttribute('iTint0', cAttr.tint0); cGeo.setAttribute('iTint1', cAttr.tint1); cGeo.setAttribute('iTint2', cAttr.tint2)
    const hMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }); patchCrowdMaterial(hMat, 'horse')
    const cMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }); patchCrowdMaterial(cMat, 'cart')
    const coats = ['#6b4a32', '#3b2a1e', '#8a6a4a', '#d8c6a8', '#5a4a40']
    carts.forEach((cr, i) => {
      c.set(coats[i % coats.length]); hAttr.tint0.setXYZ(i, c.r, c.g, c.b)
      c.set('#2a1d15'); hAttr.tint1.setXYZ(i, c.r, c.g, c.b)
      c.set('#7a2f2a'); hAttr.tint2.setXYZ(i, c.r, c.g, c.b)
      hAttr.anim.setXYZW(i, cr.phase, 0.5, 0, 0); cAttr.anim.setXYZW(i, cr.phase, 0.5, 0, 0)
      c.set('#8a6a4a'); cAttr.tint0.setXYZ(i, c.r, c.g, c.b); cAttr.tint2.setXYZ(i, 0.55, 0.25, 0.35)
    })
    const horses = new THREE.InstancedMesh(hGeo, hMat, nCarts)
    const cartMesh = new THREE.InstancedMesh(cGeo, cMat, nCarts)
    for (const m of [people, horses, cartMesh]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage) }
    const depthMats = ([['person', people], ['horse', horses], ['cart', cartMesh]] as const).map(([kind, mesh]) => {
      const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
      patchCrowdMaterial(depth, kind)
      mesh.customDepthMaterial = depth
      return depth
    })
    NPC_STATE.x = new Float32Array(npcs.length); NPC_STATE.z = new Float32Array(npcs.length); NPC_STATE.count = npcs.length; NPC_STATE.female = female
    return { F, npcs, carts, people, horses, cartMesh, pAttr, hAttr, cAttr, avatar, closePeople, mats: [pMat, hMat, cMat, ...depthMats] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, variant, character, citizenAssets, mode === 'walk' ? year : 0])

  useEffect(() => () => {
    sim.people.geometry.dispose(); sim.horses.geometry.dispose(); sim.cartMesh.geometry.dispose()
    sim.mats.forEach((m) => m.dispose())
    sim.avatar?.dispose(); sim.closePeople.forEach(slot => slot.citizen.dispose())
  }, [sim])

  const footGround = (x: number, z: number) => {
    const y = terrain.heightAt(x, z)
    return Math.max(y, probe.ground(x, z, y + 2.5))
  }

  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const hidden = useMemo(() => new THREE.Vector3(0, -9999, 0), [])
  const clock = useRef(0)

  useFrame((_, rawDt) => {
    if (!visible) return
    if (mode === 'walk' && walkInputBlocked(useApp.getState())) return
    const dt = Math.min(rawDt, 0.1); clock.current += dt
    const simYear = mode === 'walk' ? year : null
    const { F, npcs, carts, people, horses, cartMesh, pAttr, hAttr, cAttr, mats } = sim
    for (const m of mats) (m.userData.uTime as { value: number }).value = clock.current
    const walking = mode === 'walk'
    const px = walk.x, pz = walk.z
    // Keep expensive skeletal animation limited to the player and a small nearby pool.
    const candidates = walking ? npcs.map((_, i) => ({ i, d: Math.hypot(NPC_STATE.x[i] - px, NPC_STATE.z[i] - pz) }))
      .filter(p => p.d < 22).sort((a, b) => a.d - b.d).slice(0, sim.closePeople.length).map(p => p.i) : []
    for (const slot of sim.closePeople) {
      if (!candidates.includes(slot.id)) { slot.id = -1; slot.citizen.root.visible = false }
    }
    for (const id of candidates) if (!sim.closePeople.some(slot => slot.id === id)) {
      const slot = sim.closePeople.find(slot => slot.id === -1 && slot.gender === (NPC_STATE.female[id] ? 'f' : 'm'))
      if (slot) {
        slot.id = id
        slot.citizen.reset()
        slot.citizen.setPalette({ cloth: new THREE.Color().fromBufferAttribute(pAttr.tint0, id), skin: new THREE.Color().fromBufferAttribute(pAttr.tint1, id), accent: new THREE.Color().fromBufferAttribute(pAttr.tint2, id) })
      }
    }
    npcs.forEach((n, i) => {
      let x: number, z: number, yaw: number, gait = 0
      if (n.kind === 'walker' || n.kind === 'cross') {
        if (n.kind === 'cross') { n.v += n.dir * n.speed * dt; if (n.v > n.max || n.v < n.min) n.dir *= -1 }
        else { n.u += n.dir * n.speed * dt; if (n.u > n.max || n.u < n.min) n.dir *= -1 }
        // turn back before walking into a monument (look 0.8 m ahead)
        const ahead = n.dir * 0.8
        const [ax, az] = n.kind === 'cross' ? F.P(n.u, n.v + ahead + n.side) : F.P(n.u + ahead, n.v + n.side)
        if (solidMonumentAt(ax, az, simYear)) n.dir *= -1
        ;[x, z] = F.P(n.u, n.v + n.side)
        // step aside for the player
        if (walking) {
          const d = Math.hypot(x - px, z - pz)
          const want = d < 1.6 ? (((x - px) * F.v[0] + (z - pz) * F.v[1]) >= 0 ? 1.4 : -1.4) : 0
          n.side += (want - n.side) * Math.min(1, dt * 3)
        }
        yaw = (n.kind === 'cross' ? F.yawV : F.yawU) + (n.dir > 0 ? 0 : Math.PI)
        gait = 0.5
      } else if (n.kind === 'pilgrim') {
        const p = n as Npc & { bx: number; bz: number }
        n.u += n.dir * (n.speed / Math.max(1, n.side)) * dt
        if (n.u > 1 || n.u < 0) n.dir *= -1
        x = n.x! + (p.bx - n.x!) * n.u + Math.cos(n.face!) * n.v
        z = n.z! + (p.bz - n.z!) * n.u - Math.sin(n.face!) * n.v
        yaw = n.face! + (n.dir > 0 ? 0 : Math.PI); gait = 0.45
      } else {
        x = n.x!; z = n.z!; yaw = n.face!
      }
      // turn the head toward a nearby player
      let look = 0
      if (walking) {
        const dx = px - x, dz = pz - z, d = Math.hypot(dx, dz)
        if (d < 5) { const angle = Math.atan2(dx, dz) - yaw; look = THREE.MathUtils.clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -1, 1) }
      }
      n.look += (look - n.look) * Math.min(1, dt * 4)
      const replying = walking && performance.now() < walk.waveUntil && Math.hypot(px - x, pz - z) < 5
      pAttr.anim.setXYZW(i, n.phase, gait, replying ? 1 : n.pose, THREE.MathUtils.clamp(n.look, -1, 1))
      NPC_STATE.x[i] = x; NPC_STATE.z[i] = z
      pos.set(x, surfaceY(x, z, i), z)
      q.setFromAxisAngle(up, yaw)
      const stature = 0.94 + ((i * 0.381966) % 1) * 0.13
      const build = 0.9 + ((i * 0.618034) % 1) * 0.22
      one.set(build, stature, build)
      const close = sim.closePeople.find(slot => slot.id === i)
      if (close) {
        close.citizen.root.visible = true
        close.citizen.root.position.copy(pos); close.citizen.root.quaternion.copy(q); close.citizen.root.scale.copy(one)
        close.citizen.update(dt, { speed: gait ? n.speed : 0, grounded: true, wave: replying, look: n.look, groundAt: footGround })
        m4.compose(hidden, q, one)
      } else m4.compose(pos, q, one)
      people.setMatrixAt(i, m4)
    })
    // the player's own figure (third person)
    one.set(1, 1, 1)
    const av = npcs.length
    if (sim.avatar) sim.avatar.root.visible = walking && walk.view === 'third'
    if (sim.avatar?.root.visible) {
      pos.set(walk.x, walk.feet, walk.z); q.setFromAxisAngle(up, walk.yaw + Math.PI)
      sim.avatar.root.position.copy(pos); sim.avatar.root.quaternion.copy(q)
      sim.avatar.update(dt, { speed: walk.speed, grounded: walk.grounded, wave: performance.now() < walk.waveUntil, look: 0, groundAt: footGround })
      m4.compose(hidden, q, one)
      pAttr.anim.setXYZW(av, 0, walk.speed < 0.3 ? 0 : walk.speed > 4 ? 1 : 0.5, performance.now() < walk.waveUntil ? 1 : 0, 0)
    } else if (walking && walk.view === 'third') {
      pos.set(walk.x, walk.feet, walk.z); q.setFromAxisAngle(up, walk.yaw + Math.PI)
      m4.compose(pos, q, one)
      pAttr.anim.setXYZW(av, 0, walk.speed < 0.3 ? 0 : 0.5, 0, 0)
    } else m4.compose(hidden, q.identity(), one)
    people.setMatrixAt(av, m4)

    carts.forEach((cr, i) => {
      cr.u += cr.dir * cr.speed * dt; if (cr.u > F.L - 30 || cr.u < 30) cr.dir *= -1
      const [x, z] = F.P(cr.u, cr.v)
      pos.set(x, surfaceY(x, z, npcs.length + 1 + i * 2), z)
      q.setFromAxisAngle(up, F.yawU + (cr.dir > 0 ? 0 : Math.PI))
      m4.compose(pos, q, one); horses.setMatrixAt(i, m4)
      // cart trails 2.6 m behind the horse
      const [cx, cz] = F.P(cr.u - cr.dir * 2.6, cr.v)
      pos.set(cx, surfaceY(cx, cz, npcs.length + 2 + i * 2), cz); m4.compose(pos, q, one); cartMesh.setMatrixAt(i, m4)
    })
    people.instanceMatrix.needsUpdate = true; horses.instanceMatrix.needsUpdate = true; cartMesh.instanceMatrix.needsUpdate = true
    pAttr.anim.needsUpdate = true; hAttr.anim.needsUpdate = true; cAttr.anim.needsUpdate = true
  })

  return (
    <group visible={visible}>
      <primitive object={sim.people} />
      {sim.avatar && <primitive object={sim.avatar.root} />}
      {sim.closePeople.map((slot, i) => <primitive key={i} object={slot.citizen.root} />)}
      <primitive object={sim.horses} />
      <primitive object={sim.cartMesh} />
      {mode === 'walk' && <MarketSheep terrain={terrain} year={year} />}
    </group>
  )
}
